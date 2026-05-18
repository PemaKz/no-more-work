const { generateText, tool, stepCountIs } = require('ai');
const { z } = require('zod');
const { getLLM } = require('./llm');
const { emitToOrg } = require('../utils/realtime');
const {
  patchAgentRuntime,
  recordAgentEvent,
  summarizeToolCalls,
} = require('./agentRuntime');

const MAX_STEPS = 3;
const RECENT_ENTRIES_LIMIT = 15;

/**
 * Un tick del loop autónomo de un agente. A diferencia de runTask (que
 * tiene una task explícita), aquí el agente sólo observa contexto y
 * decide si genera insights, crea tasks o no hace nada (end_tick).
 *
 * Diseño deliberadamente conservador: pocos steps, prompt corto, salida
 * estructurada con tool calls. La idea es que estos ticks sean baratos
 * (de ahí la insistencia en self-hosted), porque corren cada N segundos.
 */
async function runAgentTick(agentId, container) {
  const db = container.get('database');
  const { Sequelize } = db;
  const {
    Agent,
    Zone,
    Provider,
    ContextEntry,
    OrgContext,
    ZoneContext,
    Task,
  } = db.models;
  const logger = container.get('logger');

  const agent = await Agent.findByPk(agentId);
  if (!agent) return { skipped: 'agent-not-found' };
  if (!agent.loopEnabled) return { skipped: 'loop-disabled' };
  if (!agent.providerId) return { skipped: 'no-provider' };

  const provider = await Provider.findByPk(agent.providerId);
  if (!provider) return { skipped: 'provider-not-found' };

  const zone = await Zone.findByPk(agent.zoneId);
  if (!zone) return { skipped: 'zone-not-found' };

  const [orgContexts, zoneContexts, recentEntries, pendingTasks] = await Promise.all([
    OrgContext.findAll({
      where: { organizationId: agent.organizationId },
      order: [['order', 'ASC']],
    }),
    ZoneContext.findAll({
      where: { zoneId: zone.id },
      order: [['order', 'ASC']],
    }),
    ContextEntry.findAll({
      where: {
        organizationId: agent.organizationId,
        [Sequelize.Op.or]: [
          { scope: 'org', scopeId: agent.organizationId },
          { scope: 'zone', scopeId: zone.id },
        ],
      },
      order: [
        ['pinned', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: RECENT_ENTRIES_LIMIT,
    }),
    Task.findAll({
      where: { zoneId: zone.id, status: 'pending' },
      attributes: ['id', 'title'],
      limit: 10,
    }),
  ]);

  const systemPrompt = [
    agent.systemPrompt ||
      `Eres ${agent.name}, agente de la zona "${zone.name}".`,
    agent.role ? `Rol: ${agent.role}.` : null,
    'Este es un TICK de tu loop autónomo. Observa el contexto y decide:',
    '  • si detectas algo relevante → add_context_entry (insight/observation/decision/memo)',
    '  • si detectas trabajo concreto que hacer → create_task',
    '  • si no hay nada nuevo o útil → end_tick (NO generes ruido)',
    'Sé breve. La economía importa: estos ticks corren periódicamente.',
    orgContexts.length
      ? '── Contexto org ──\n' +
        orgContexts
          .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
          .join('\n')
      : null,
    zoneContexts.length
      ? `── Contexto zona "${zone.name}" ──\n` +
        zoneContexts
          .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
          .join('\n')
      : null,
    recentEntries.length
      ? '── Log reciente (★ = pinned) ──\n' +
        recentEntries
          .map(
            (e) =>
              `${e.pinned ? '★ ' : '  '}[${e.kind}] ${e.content.slice(0, 240)}`
          )
          .join('\n')
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const userPrompt = [
    `Tick a las ${new Date().toISOString()}.`,
    pendingTasks.length
      ? `Tasks pendientes en la zona (${pendingTasks.length}):\n` +
        pendingTasks.map((t) => `  - ${t.title}`).join('\n')
      : 'No hay tasks pendientes en la zona.',
  ].join('\n');

  let ended = false;

  const tools = {
    add_context_entry: tool({
      description:
        'Añade entrada al log auditable. Úsalo solo si aporta valor (no repitas lo que ya está).',
      inputSchema: z.object({
        kind: z.enum(['insight', 'decision', 'observation', 'memo']),
        content: z.string(),
        scope: z.enum(['org', 'zone']).default('zone'),
      }),
      execute: async ({ kind, content, scope }) => {
        const entry = await ContextEntry.create({
          organizationId: agent.organizationId,
          scope,
          scopeId: scope === 'zone' ? zone.id : agent.organizationId,
          sourceType: 'agent',
          sourceId: agent.id,
          kind,
          content,
        });
        emitToOrg(
          container,
          agent.organizationId,
          'context-entry:created',
          entry.toJSON()
        );
        return { id: entry.id, ok: true };
      },
    }),

    create_task: tool({
      description:
        'Crea una task concreta en la zona. Solo cuando hay trabajo identificable y accionable.',
      inputSchema: z.object({
        title: z.string().describe('Título corto, accionable'),
        type: z
          .enum(['custom', 'objective', 'incident'])
          .default('custom'),
        input: z
          .any()
          .optional()
          .describe('Payload opcional con detalles'),
      }),
      execute: async ({ title, type, input }) => {
        const task = await Task.create({
          organizationId: agent.organizationId,
          zoneId: zone.id,
          type,
          status: 'pending',
          title,
          input: input ?? null,
        });
        emitToOrg(container, agent.organizationId, 'task:created', task.toJSON());
        return { id: task.id, ok: true };
      },
    }),

    end_tick: tool({
      description:
        'Termina el tick sin acciones. Llámalo si no hay nada útil que hacer ahora mismo.',
      inputSchema: z.object({
        reason: z.string().optional(),
      }),
      execute: async ({ reason }) => {
        ended = true;
        return { ok: true, reason: reason || 'nothing-to-do' };
      },
    }),
  };

  // Marcamos working ANTES de empezar para que el mapa lo refleje en vivo
  // (halo + texto "Tick"). lastTickAt sirve para calcular cuenta atrás del
  // siguiente tick en el frontend.
  await patchAgentRuntime(container, agent, {
    status: 'working',
    currentActivity: 'Tick',
    lastTickAt: new Date(),
  });
  await recordAgentEvent(container, {
    agent,
    kind: 'tick_start',
    summary: 'Tick iniciado',
  });

  try {
    const llm = await getLLM(provider, container);
    logger?.debug?.(
      `[tick] agent=${agent.name} provider=${provider.kind}:${provider.defaultModel}`
    );
    const result = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
    await patchAgentRuntime(container, agent, {
      status: 'idle',
      currentActivity: null,
    });

    const toolCalls = summarizeToolCalls(result.steps);
    const summary = toolCalls.length
      ? `Tick → ${toolCalls.join(', ')}`.slice(0, 240)
      : ended
        ? 'Tick → sin acciones (end_tick)'
        : 'Tick → sin acciones';
    await recordAgentEvent(container, {
      agent,
      kind: 'tick_end',
      summary,
      detail: {
        text: (result.text || '').slice(0, 2000),
        toolCalls,
        steps: Array.isArray(result.steps) ? result.steps.length : 0,
        endedExplicitly: ended,
      },
    });

    return { ok: true, ended };
  } catch (err) {
    logger?.warn?.(`[tick] agent=${agent.name} failed: ${err.message}`);
    await patchAgentRuntime(container, agent, {
      status: 'error',
      currentActivity: null,
    });
    await recordAgentEvent(container, {
      agent,
      kind: 'tick_error',
      summary: `Error: ${err.message}`.slice(0, 240),
      detail: { error: err.message },
    });
    // No re-throw — un tick fallido no debe parar el scheduler.
    return { ok: false, error: err.message };
  }
}

module.exports = { runAgentTick };
