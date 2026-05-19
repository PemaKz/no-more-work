const { generateText, stepCountIs } = require('ai');
const { buildPrompt } = require('../prompts/build');
const identity = require('../prompts/augmenters/identity');
const role = require('../prompts/augmenters/role');
const instructionsFactory = require('../prompts/augmenters/instructions');
const orgContext = require('../prompts/augmenters/orgContext');
const zoneContext = require('../prompts/augmenters/zoneContext');
const recentEntries = require('../prompts/augmenters/recentEntries');
const {
  loadOrgContexts,
  loadZoneContexts,
  loadRecentEntries,
} = require('../core/context');
const { getLLM } = require('../core/providers');
const {
  patchAgent,
  recordEvent,
  summarizeToolCalls,
} = require('../core/runtime');
const { emitToOrg } = require('../../../utils/realtime');

const MAX_STEPS = 5;
const RECENT_LIMIT = 20;

const taskInstructions = instructionsFactory(
  'Decide qué acciones tomar usando las tools disponibles. Cuando la task ' +
    'esté completada, llama a complete_task con un resumen. Si no puedes ' +
    'avanzar, usa add_context_entry para registrar el bloqueo.'
);

const SYSTEM_AUGMENTERS = [
  identity,
  role,
  orgContext,
  zoneContext,
  recentEntries,
  taskInstructions,
];

async function resolveAgent(container, task) {
  const db = container.get('database');
  const { Agent } = db.models;
  const { Sequelize } = db;
  if (task.assignedAgentId) {
    const a = await Agent.findOne({
      where: { id: task.assignedAgentId, organizationId: task.organizationId },
    });
    if (a) return a;
  }
  const a = await Agent.findOne({
    where: {
      zoneId: task.zoneId,
      organizationId: task.organizationId,
      providerId: { [Sequelize.Op.not]: null },
    },
  });
  if (a) await task.update({ assignedAgentId: a.id });
  return a;
}

/**
 * Ejecuta una task. Si la task es `type: deliberation`, delega al mode
 * deliberation (decisión vive en el routeo del engine, no aquí).
 *
 * Devuelve siempre la Task actualizada — los errores se persisten en
 * la propia task (status='error', errorMessage).
 */
async function run({ engine, container, taskId }) {
  const db = container.get('database');
  const { Task, Provider, Zone } = db.models;
  const logger = container.get('logger');

  const task = await Task.findByPk(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (['done', 'cancelled', 'error'].includes(task.status)) return task;

  if (task.type === 'deliberation') {
    return engine.run('deliberation', { taskId });
  }

  await task.update({
    status: 'running',
    startedAt: task.startedAt || new Date(),
    errorMessage: null,
  });
  emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());

  let resolvedAgent = null;
  try {
    const agent = await resolveAgent(container, task);
    if (!agent) throw new Error('Sin agentes con provider configurado en la zona');
    if (!agent.providerId) throw new Error(`El agente "${agent.name}" no tiene provider asignado`);
    resolvedAgent = agent;

    const provider = await Provider.findOne({
      where: { id: agent.providerId, organizationId: task.organizationId },
    });
    if (!provider) throw new Error('Provider no encontrado');

    const zone = await Zone.findByPk(task.zoneId);

    await patchAgent(container, agent, {
      status: 'working',
      currentActivity: `Resolviendo: ${task.title}`.slice(0, 120),
      currentTaskId: task.id,
    });
    await recordEvent(container, {
      agent,
      kind: 'task_start',
      summary: `Empieza task: ${task.title}`.slice(0, 240),
      taskId: task.id,
    });

    const [orgCtxs, zoneCtxs, recent] = await Promise.all([
      loadOrgContexts(container, task.organizationId),
      loadZoneContexts(container, zone.id),
      loadRecentEntries(
        container,
        { organizationId: task.organizationId, zoneId: zone.id },
        RECENT_LIMIT
      ),
    ]);

    const state = { taskCompleted: false };
    const ctx = {
      container,
      agent,
      zone,
      task,
      mode: 'task',
      state,
      orgContexts: orgCtxs,
      zoneContexts: zoneCtxs,
      recentEntries: recent,
    };

    const systemPrompt = await buildPrompt(SYSTEM_AUGMENTERS, ctx);
    const userPrompt = [
      `Task: ${task.title}`,
      `Tipo: ${task.type}`,
      task.input
        ? `Input:\n\`\`\`json\n${JSON.stringify(task.input, null, 2)}\n\`\`\``
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const tools = engine.tools.buildAiSdkTools('task', ctx);
    const llm = await getLLM(provider, container);
    logger?.info?.(
      `[nmw-engine][task] ${task.id.slice(0, 8)} via ${provider.kind}:${provider.defaultModel} (agent=${agent.name})`
    );

    const result = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    // Fallback: si tras todos los steps no llamó a complete_task, cerramos
    // con el texto generado como output.
    await task.reload();
    if (!state.taskCompleted && task.status === 'running') {
      await task.update({
        status: 'done',
        output: {
          summary: 'Sin llamada explícita a complete_task',
          text: result.text || '',
        },
        finishedAt: new Date(),
      });
      emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    }

    await patchAgent(container, agent, {
      status: 'success',
      currentActivity: null,
      currentTaskId: null,
    });

    const toolCalls = summarizeToolCalls(result.steps);
    const summary = state.taskCompleted
      ? `Task completada: ${task.title}`.slice(0, 240)
      : toolCalls.length
        ? `Task → ${toolCalls.join(', ')}`.slice(0, 240)
        : `Task cerrada sin complete_task`;
    await recordEvent(container, {
      agent,
      kind: 'task_end',
      summary,
      taskId: task.id,
      detail: {
        text: (result.text || '').slice(0, 2000),
        toolCalls,
        steps: Array.isArray(result.steps) ? result.steps.length : 0,
        completedExplicitly: state.taskCompleted,
      },
    });
    return task;
  } catch (err) {
    await task.update({
      status: 'error',
      errorMessage: err?.message || String(err),
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    logger?.error?.(`[nmw-engine][task] ${taskId} failed: ${err.message || err}`);
    if (resolvedAgent) {
      await patchAgent(container, resolvedAgent, {
        status: 'error',
        currentActivity: null,
        currentTaskId: null,
      });
      await recordEvent(container, {
        agent: resolvedAgent,
        kind: 'task_error',
        summary: `Error en task "${task.title}": ${err.message}`.slice(0, 240),
        taskId: task.id,
        detail: { error: err.message },
      });
    }
    return task;
  }
}

module.exports = { name: 'task', run };
