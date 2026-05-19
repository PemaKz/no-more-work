const { generateText, stepCountIs } = require('ai');
const { buildPrompt } = require('../prompts/build');
const identity = require('../prompts/augmenters/identity');
const role = require('../prompts/augmenters/role');
const instructionsFactory = require('../prompts/augmenters/instructions');
const orgContext = require('../prompts/augmenters/orgContext');
const zoneContext = require('../prompts/augmenters/zoneContext');
const recentEntries = require('../prompts/augmenters/recentEntries');
const pendingTasks = require('../prompts/augmenters/pendingTasks');
const {
  loadOrgContexts,
  loadZoneContexts,
  loadRecentEntries,
  loadPendingTasks,
} = require('../core/context');
const { getLLM } = require('../core/providers');
const {
  patchAgent,
  recordEvent,
  summarizeToolCalls,
} = require('../core/runtime');

const MAX_STEPS = 3;
const RECENT_LIMIT = 15;

const tickInstructions = instructionsFactory(
  [
    'Este es un TICK de tu loop autónomo. Observa el contexto y decide:',
    '  • si detectas algo relevante → add_context_entry (insight/observation/decision/memo)',
    '  • si detectas trabajo concreto que hacer → create_task',
    '  • si no hay nada nuevo o útil → end_tick (NO generes ruido)',
    'Sé breve. La economía importa: estos ticks corren periódicamente.',
  ].join('\n')
);

const SYSTEM_AUGMENTERS = [
  identity,
  role,
  tickInstructions,
  orgContext,
  zoneContext,
  recentEntries,
];

/**
 * Un tick del loop autónomo del agente. Se programa vía scheduler;
 * cada ejecución es independiente. Si nada que hacer → end_tick.
 *
 * Devuelve `{ ok, ended, error? }` — nunca tira para no romper el
 * scheduler. Errores se persisten como AgentEvent kind=tick_error.
 */
async function run({ engine, container, agentId }) {
  const db = container.get('database');
  const { Agent, Zone, Provider } = db.models;
  const logger = container.get('logger');

  const agent = await Agent.findByPk(agentId);
  if (!agent) return { skipped: 'agent-not-found' };
  if (!agent.loopEnabled) return { skipped: 'loop-disabled' };
  if (!agent.providerId) return { skipped: 'no-provider' };

  const [provider, zone] = await Promise.all([
    Provider.findByPk(agent.providerId),
    Zone.findByPk(agent.zoneId),
  ]);
  if (!provider) return { skipped: 'provider-not-found' };
  if (!zone) return { skipped: 'zone-not-found' };

  const [orgCtxs, zoneCtxs, recent, pending] = await Promise.all([
    loadOrgContexts(container, agent.organizationId),
    loadZoneContexts(container, zone.id),
    loadRecentEntries(
      container,
      { organizationId: agent.organizationId, zoneId: zone.id },
      RECENT_LIMIT
    ),
    loadPendingTasks(container, { zoneId: zone.id }),
  ]);

  const state = { ended: false };
  const ctx = {
    container,
    agent,
    zone,
    mode: 'tick',
    state,
    orgContexts: orgCtxs,
    zoneContexts: zoneCtxs,
    recentEntries: recent,
    pendingTasks: pending,
  };

  await patchAgent(container, agent, {
    status: 'working',
    currentActivity: 'Tick',
    lastTickAt: new Date(),
  });
  await recordEvent(container, { agent, kind: 'tick_start', summary: 'Tick iniciado' });

  try {
    const systemPrompt = await buildPrompt(SYSTEM_AUGMENTERS, ctx);
    const userPrompt = [
      `Tick a las ${new Date().toISOString()}.`,
      await pendingTasks(ctx),
    ]
      .filter(Boolean)
      .join('\n\n');

    const tools = engine.tools.buildAiSdkTools('tick', ctx);
    const llm = await getLLM(provider, container);
    logger?.debug?.(
      `[nmw-engine][tick] agent=${agent.name} provider=${provider.kind}:${provider.defaultModel}`
    );

    const result = await generateText({
      model: llm,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    await patchAgent(container, agent, { status: 'idle', currentActivity: null });

    const toolCalls = summarizeToolCalls(result.steps);
    const summary = toolCalls.length
      ? `Tick → ${toolCalls.join(', ')}`.slice(0, 240)
      : state.ended
        ? 'Tick → sin acciones (end_tick)'
        : 'Tick → sin acciones';
    await recordEvent(container, {
      agent,
      kind: 'tick_end',
      summary,
      detail: {
        text: (result.text || '').slice(0, 2000),
        toolCalls,
        steps: Array.isArray(result.steps) ? result.steps.length : 0,
        endedExplicitly: state.ended,
      },
    });
    return { ok: true, ended: state.ended };
  } catch (err) {
    logger?.warn?.(`[nmw-engine][tick] agent=${agent.name} failed: ${err.message}`);
    await patchAgent(container, agent, { status: 'error', currentActivity: null });
    await recordEvent(container, {
      agent,
      kind: 'tick_error',
      summary: `Error: ${err.message}`.slice(0, 240),
      detail: { error: err.message },
    });
    return { ok: false, error: err.message };
  }
}

module.exports = { name: 'tick', run };
