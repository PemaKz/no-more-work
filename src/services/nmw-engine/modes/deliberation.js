const { generateText, stepCountIs } = require('ai');
const { buildPrompt } = require('../prompts/build');
const identity = require('../prompts/augmenters/identity');
const role = require('../prompts/augmenters/role');
const instructionsFactory = require('../prompts/augmenters/instructions');
const otherZones = require('../prompts/augmenters/otherZones');
const recentEntries = require('../prompts/augmenters/recentEntries');
const {
  loadRecentEntries,
  loadOtherZones,
} = require('../core/context');
const { getLLM } = require('../core/providers');
const {
  patchAgent,
  recordEvent,
  summarizeToolCalls,
} = require('../core/runtime');
const { emitToOrg } = require('../../../utils/realtime');

const MAX_STEPS_PER_TURN = 4;
const RECENT_LIMIT = 20;

// Orden semántico: planner abre, critic cuestiona, executor traduce a tasks,
// facilitator cierra. Roles desconocidos van al final por nombre.
const ROLE_ORDER = { planner: 0, critic: 1, executor: 2, facilitator: 3 };

function sortAgents(agents) {
  return [...agents].sort((a, b) => {
    const ra = ROLE_ORDER[(a.role || '').toLowerCase()] ?? 99;
    const rb = ROLE_ORDER[(b.role || '').toLowerCase()] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

const deliberationIntro = instructionsFactory(
  'Participas en una DELIBERACIÓN colectiva con el resto de agentes orquestadores. ' +
    'Vuestro objetivo es decidir próximos pasos y repartir trabajo en forma de tasks ' +
    'concretas a las zonas disponibles.'
);

const deliberationActions = instructionsFactory(
  [
    'En tu turno, elige UNA o varias herramientas:',
    '  • propose_task — crea una task accionable en una zona concreta',
    '  • add_context_entry — registra una decisión/insight para el equipo',
    '  • pass_turn — no añades valor sobre lo dicho',
    'Sé conciso. No repitas lo que otros ya dijeron — complementa o discrepa.',
  ].join('\n')
);

const SYSTEM_AUGMENTERS = [
  identity,
  role,
  deliberationIntro,
  otherZones,
  recentEntries,
  deliberationActions,
];

function buildUserPrompt(task, contributions) {
  const parts = [`Deliberación: ${task.title}`];
  if (task.input) {
    parts.push(`Input:\n\`\`\`json\n${JSON.stringify(task.input, null, 2)}\n\`\`\``);
  }
  if (contributions.length === 0) {
    parts.push('Eres el PRIMER agente en hablar. Marca el tono.');
  } else {
    parts.push(
      `Contribuciones previas (${contributions.length}):\n` +
        contributions
          .map((c) => {
            const tag = `→ ${c.agent}${c.role ? ` (${c.role})` : ''}`;
            if (c.error) return `${tag}: [error: ${c.error}]`;
            if (c.passed) return `${tag}: [pass]`;
            const txt = (c.text || '').trim() || '[sin texto]';
            return `${tag}:\n${txt}`;
          })
          .join('\n\n')
    );
  }
  return parts.join('\n\n');
}

async function run({ engine, container, taskId }) {
  const db = container.get('database');
  const { Sequelize } = db;
  const { Task, Agent, Zone, Provider } = db.models;
  const logger = container.get('logger');

  const task = await Task.findByPk(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (['done', 'cancelled', 'error'].includes(task.status)) return task;

  await task.update({
    status: 'running',
    startedAt: task.startedAt || new Date(),
    errorMessage: null,
  });
  emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());

  try {
    const zone = await Zone.findByPk(task.zoneId);
    if (!zone) throw new Error('Zone not found');
    if (zone.kind !== 'controller') {
      throw new Error('Las deliberaciones solo pueden ejecutarse en la zona orquestadora');
    }

    const agents = sortAgents(
      await Agent.findAll({
        where: {
          zoneId: zone.id,
          organizationId: task.organizationId,
          providerId: { [Sequelize.Op.not]: null },
        },
      })
    );
    if (agents.length === 0) {
      throw new Error('Sin agentes con provider en el orquestador');
    }

    const otherZonesData = await loadOtherZones(container, {
      organizationId: task.organizationId,
    });
    const recent = await loadRecentEntries(
      container,
      { organizationId: task.organizationId, zoneId: zone.id },
      RECENT_LIMIT
    );

    const contributions = [];
    // `state` se comparte entre tools y mode dentro de un turno (passed,
    // createdTasks). Se resetea por turno.
    let state = { passed: false, createdTasks: [] };

    for (const agent of agents) {
      logger?.info?.(
        `[nmw-engine][deliberation ${task.id.slice(0, 8)}] turn → ${agent.name} (${agent.role || 'miembro'})`
      );
      state = { passed: false, createdTasks: state.createdTasks };

      const provider = await Provider.findByPk(agent.providerId);
      if (!provider) {
        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          error: 'provider not found',
        });
        continue;
      }

      const ctx = {
        container,
        agent,
        zone,
        task,
        mode: 'deliberation',
        state,
        otherZones: otherZonesData,
        recentEntries: recent,
      };

      await patchAgent(container, agent, {
        status: 'working',
        currentActivity: `Deliberando: ${task.title}`.slice(0, 120),
        currentTaskId: task.id,
      });

      try {
        const llm = await getLLM(provider, container);
        const systemPrompt = await buildPrompt(SYSTEM_AUGMENTERS, ctx);
        const userPrompt = buildUserPrompt(task, contributions);
        const tools = engine.tools.buildAiSdkTools('deliberation', ctx);

        const result = await generateText({
          model: llm,
          system: systemPrompt,
          prompt: userPrompt,
          tools,
          stopWhen: stepCountIs(MAX_STEPS_PER_TURN),
        });

        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          text: result.text || '',
          passed: state.passed,
        });
        await patchAgent(container, agent, {
          status: 'idle',
          currentActivity: null,
          currentTaskId: null,
        });

        const toolCalls = summarizeToolCalls(result.steps);
        const summary = state.passed
          ? `Deliberación: pasó turno`
          : toolCalls.length
            ? `Deliberación → ${toolCalls.join(', ')}`.slice(0, 240)
            : `Deliberación: aportó texto`;
        await recordEvent(container, {
          agent,
          kind: 'deliberation_turn',
          summary,
          taskId: task.id,
          detail: {
            text: (result.text || '').slice(0, 2000),
            toolCalls,
            steps: Array.isArray(result.steps) ? result.steps.length : 0,
            passed: state.passed,
          },
        });
      } catch (err) {
        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          error: err.message,
        });
        logger?.warn?.(`[nmw-engine][deliberation] ${agent.name} falló: ${err.message}`);
        await patchAgent(container, agent, {
          status: 'error',
          currentActivity: null,
          currentTaskId: null,
        });
        await recordEvent(container, {
          agent,
          kind: 'deliberation_error',
          summary: `Error deliberando: ${err.message}`.slice(0, 240),
          taskId: task.id,
          detail: { error: err.message },
        });
      }
    }

    await task.update({
      status: 'done',
      output: {
        summary: `Deliberación entre ${agents.length} agente(s); ${state.createdTasks.length} task(s) propuestas.`,
        contributions,
        createdTasks: state.createdTasks,
      },
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    return task;
  } catch (err) {
    await task.update({
      status: 'error',
      errorMessage: err.message,
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    logger?.error?.(`[nmw-engine][deliberation] task ${taskId} failed: ${err.message}`);
    return task;
  }
}

module.exports = { name: 'deliberation', run };
