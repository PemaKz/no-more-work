const { generateText, tool, stepCountIs } = require('ai');
const { z } = require('zod');
const { getLLM } = require('./llm');
const { emitToOrg } = require('../utils/realtime');
const { notify } = require('../utils/notifications');
const {
  patchAgentRuntime,
  recordAgentEvent,
  summarizeToolCalls,
} = require('./agentRuntime');

const MAX_STEPS = 5;
const RECENT_ENTRIES_LIMIT = 20;

/**
 * Construye el system prompt de un agente concatenando: su instrucción
 * propia, los contextos de la org y de la zona, y las entradas recientes
 * del log (pinneadas primero).
 */
function buildSystemPrompt(agent, zone, orgContexts, zoneContexts, recentEntries) {
  const parts = [];

  parts.push(
    agent.systemPrompt ||
      `Eres ${agent.name}, un agente de la zona "${zone.name}" (tipo: ${zone.type}).`
  );

  if (agent.role) parts.push(`Rol semántico: ${agent.role}.`);

  if (orgContexts.length) {
    parts.push(
      '── Contexto organizacional ──\n' +
        orgContexts
          .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
          .join('\n')
    );
  }

  if (zoneContexts.length) {
    parts.push(
      `── Contexto de la zona "${zone.name}" ──\n` +
        zoneContexts
          .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
          .join('\n')
    );
  }

  if (recentEntries.length) {
    parts.push(
      '── Log reciente (más nuevo arriba; ★ = pinned) ──\n' +
        recentEntries
          .map(
            (e) =>
              `${e.pinned ? '★ ' : '  '}[${e.kind}] ${e.content.slice(0, 280)}`
          )
          .join('\n')
    );
  }

  parts.push(
    'Decide qué acciones tomar usando las tools disponibles. Cuando la task ' +
      'esté completada, llama a complete_task con un resumen. Si no puedes ' +
      'avanzar, usa add_context_entry para registrar el bloqueo.'
  );

  return parts.join('\n\n');
}

/**
 * Ejecuta una task contra el LLM del agente asignado (o uno disponible
 * en la zona). Crea ContextEntries y actualiza el estado de la task.
 *
 * Diseñado para correrse en background — emite eventos socket en cada
 * cambio de estado para que el cliente vea el progreso en tiempo real.
 */
async function runTask(taskId, container) {
  const db = container.get('database');
  const { Sequelize } = db;
  const {
    Task,
    Agent,
    Zone,
    Provider,
    ContextEntry,
    OrgContext,
    ZoneContext,
  } = db.models;
  const logger = container.get('logger');

  const task = await Task.findByPk(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Idempotencia: no re-ejecutar tasks ya finalizadas
  if (['done', 'cancelled', 'error'].includes(task.status)) {
    return task;
  }

  // Routing por tipo: las deliberaciones tienen su propio flujo
  // multi-agente (consenso entre orquestadores).
  if (task.type === 'deliberation') {
    const { runDeliberation } = require('./runDeliberation');
    return runDeliberation(taskId, container);
  }

  const markRunning = async () => {
    await task.update({
      status: 'running',
      startedAt: task.startedAt || new Date(),
      errorMessage: null,
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
  };

  const markError = async (err) => {
    await task.update({
      status: 'error',
      errorMessage: err?.message || String(err),
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    logger?.error?.(`[engine] task ${taskId} failed:`, err?.message || err);
  };

  await markRunning();

  // Lo declaramos fuera del try para que el catch pueda marcarlo como error.
  let resolvedAgent = null;
  try {
    // ── Resolver agente ────────────────────────────────────────────────
    let agent;
    if (task.assignedAgentId) {
      agent = await Agent.findOne({
        where: {
          id: task.assignedAgentId,
          organizationId: task.organizationId,
        },
      });
    }
    if (!agent) {
      // Coger cualquier agente de la zona con provider configurado
      agent = await Agent.findOne({
        where: {
          zoneId: task.zoneId,
          organizationId: task.organizationId,
          providerId: { [Sequelize.Op.not]: null },
        },
      });
      if (agent) {
        await task.update({ assignedAgentId: agent.id });
      }
    }
    if (!agent) {
      throw new Error('Sin agentes con provider configurado en la zona');
    }
    if (!agent.providerId) {
      throw new Error(
        `El agente "${agent.name}" no tiene provider asignado`
      );
    }
    resolvedAgent = agent;

    const provider = await Provider.findOne({
      where: {
        id: agent.providerId,
        organizationId: task.organizationId,
      },
    });
    if (!provider) {
      throw new Error('Provider no encontrado');
    }

    const zone = await Zone.findByPk(task.zoneId);

    // Marca al agente como working con la task actual ANTES de invocar al
    // LLM, para que el mapa muestre actividad en vivo.
    await patchAgentRuntime(container, agent, {
      status: 'working',
      currentActivity: `Resolviendo: ${task.title}`.slice(0, 120),
      currentTaskId: task.id,
    });
    await recordAgentEvent(container, {
      agent,
      kind: 'task_start',
      summary: `Empieza task: ${task.title}`.slice(0, 240),
      taskId: task.id,
    });

    // ── Cargar contexto ────────────────────────────────────────────────
    const [orgContexts, zoneContexts, recentEntries] = await Promise.all([
      OrgContext.findAll({
        where: { organizationId: task.organizationId },
        order: [
          ['order', 'ASC'],
          ['createdAt', 'ASC'],
        ],
      }),
      ZoneContext.findAll({
        where: { zoneId: zone.id },
        order: [
          ['order', 'ASC'],
          ['createdAt', 'ASC'],
        ],
      }),
      ContextEntry.findAll({
        where: {
          organizationId: task.organizationId,
          [Sequelize.Op.or]: [
            { scope: 'org', scopeId: task.organizationId },
            { scope: 'zone', scopeId: zone.id },
          ],
        },
        order: [
          ['pinned', 'DESC'],
          ['createdAt', 'DESC'],
        ],
        limit: RECENT_ENTRIES_LIMIT,
      }),
    ]);

    const systemPrompt = buildSystemPrompt(
      agent,
      zone,
      orgContexts,
      zoneContexts,
      recentEntries
    );

    const userPrompt = [
      `Task: ${task.title}`,
      `Tipo: ${task.type}`,
      task.input
        ? `Input:\n\`\`\`json\n${JSON.stringify(task.input, null, 2)}\n\`\`\``
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    // ── Tools ─────────────────────────────────────────────────────────
    let taskCompleted = false;

    const tools = {
      add_context_entry: tool({
        description:
          'Añade una entrada al log de contexto auditable. Úsalo para registrar insights, decisiones, observaciones o memos que el equipo deba recordar.',
        inputSchema: z.object({
          kind: z
            .enum(['insight', 'decision', 'observation', 'memo'])
            .describe('Tipo de entrada'),
          content: z
            .string()
            .describe('Contenido textual de la entrada (claro y conciso)'),
          scope: z
            .enum(['org', 'zone'])
            .default('zone')
            .describe(
              'org = visible a toda la organización; zone = visible solo a esta zona'
            ),
        }),
        execute: async ({ kind, content, scope }) => {
          const entry = await ContextEntry.create({
            organizationId: task.organizationId,
            scope,
            scopeId: scope === 'zone' ? zone.id : task.organizationId,
            sourceType: 'agent',
            sourceId: agent.id,
            kind,
            content,
            sourceTaskId: task.id,
          });
          emitToOrg(
            container,
            task.organizationId,
            'context-entry:created',
            entry.toJSON()
          );
          return { id: entry.id, ok: true };
        },
      }),

      complete_task: tool({
        description:
          'Marca esta task como completada. Llámalo cuando hayas terminado todo el trabajo.',
        inputSchema: z.object({
          summary: z
            .string()
            .describe('Resumen breve de lo que se hizo y el resultado'),
          result: z
            .any()
            .optional()
            .describe('Datos estructurados opcionales del resultado'),
        }),
        execute: async ({ summary, result }) => {
          await task.update({
            status: 'done',
            output: { summary, result: result ?? null },
            finishedAt: new Date(),
          });
          taskCompleted = true;
          emitToOrg(
            container,
            task.organizationId,
            'task:updated',
            task.toJSON()
          );
          return { ok: true };
        },
      }),
    };

    // ── Invocación ─────────────────────────────────────────────────────
    const llm = await getLLM(provider, container);
    logger?.info?.(
      `[engine] running task ${task.id.slice(0, 8)} via ${provider.kind}:${provider.defaultModel} (agent=${agent.name})`
    );

    const result = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    // Si tras todos los steps no llamó a complete_task, cerramos con el
    // texto generado como output.
    await task.reload();
    if (!taskCompleted && task.status === 'running') {
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

    // Libera al agente — status='success' deja un feedback visual del
    // último resultado hasta el próximo evento.
    await patchAgentRuntime(container, agent, {
      status: 'success',
      currentActivity: null,
      currentTaskId: null,
    });

    const toolCalls = summarizeToolCalls(result.steps);
    const summary = taskCompleted
      ? `Task completada: ${task.title}`.slice(0, 240)
      : toolCalls.length
        ? `Task → ${toolCalls.join(', ')}`.slice(0, 240)
        : `Task cerrada sin complete_task`;
    await recordAgentEvent(container, {
      agent,
      kind: 'task_end',
      summary,
      taskId: task.id,
      detail: {
        text: (result.text || '').slice(0, 2000),
        toolCalls,
        steps: Array.isArray(result.steps) ? result.steps.length : 0,
        completedExplicitly: taskCompleted,
      },
    });

    return task;
  } catch (err) {
    await markError(err);
    if (resolvedAgent) {
      await patchAgentRuntime(container, resolvedAgent, {
        status: 'error',
        currentActivity: null,
        currentTaskId: null,
      });
      await recordAgentEvent(container, {
        agent: resolvedAgent,
        kind: 'task_error',
        summary: `Error en task "${task.title}": ${err.message}`.slice(0, 240),
        taskId: task.id,
        detail: { error: err.message },
      });
    }
    // Best-effort notificación al usuario que disparó la task (si la tarea
    // fue creada con metadata.userId; por ahora omitimos, se puede añadir).
    return task;
  }
}

module.exports = { runTask };
