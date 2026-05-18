const { emitToOrg } = require('../utils/realtime');

/**
 * Actualiza campos runtime de un agente y emite `agent:updated` para que
 * el mapa lo refleje en vivo. Hace .update + .reload para asegurar que
 * el payload emitido incluye los valores reales (no los del cache JS).
 *
 * Pensado para llamarse desde runTask / runAgentTick / runDeliberation
 * sin tener que repetir el patrón en cada sitio.
 */
async function patchAgentRuntime(container, agent, patch) {
  if (!agent) return;
  await agent.update(patch);
  emitToOrg(
    container,
    agent.organizationId,
    'agent:updated',
    agent.toJSON()
  );
}

/**
 * Persiste un evento en el log per-agente (AgentEvent) y emite el
 * `agent-event:created` por socket para que el AgentDialog abierto lo
 * pinte en vivo en su timeline.
 *
 * `kind` debe ser una de las constantes que el UI conoce:
 *   tick_start | tick_end | tick_error
 *   task_start | task_end | task_error
 *   deliberation_turn | deliberation_error
 *
 * Best-effort: si la BD falla no rompemos la ejecución del agente.
 */
async function recordAgentEvent(
  container,
  { agent, kind, summary, detail = null, taskId = null }
) {
  if (!agent) return null;
  try {
    const { AgentEvent } = container.get('database').models;
    const event = await AgentEvent.create({
      organizationId: agent.organizationId,
      agentId: agent.id,
      zoneId: agent.zoneId || null,
      kind,
      summary,
      detail,
      taskId,
    });
    emitToOrg(
      container,
      agent.organizationId,
      'agent-event:created',
      event.toJSON()
    );
    return event;
  } catch (err) {
    container
      .get('logger')
      ?.warn?.(`[agent-event] no se pudo persistir: ${err.message}`);
    return null;
  }
}

/**
 * Resumen humano de los toolCalls de un step de Vercel AI SDK. Devuelve
 * algo como "add_context_entry(insight), create_task('Investigar X')".
 */
function summarizeToolCalls(steps) {
  if (!Array.isArray(steps)) return [];
  const calls = [];
  for (const step of steps) {
    for (const tc of step.toolCalls || []) {
      const name = tc.toolName || tc.name || 'tool';
      const args = tc.args || tc.input || {};
      const hint =
        args.kind ||
        args.title ||
        args.summary ||
        args.reason ||
        args.zoneName ||
        null;
      calls.push(hint ? `${name}(${String(hint).slice(0, 40)})` : name);
    }
  }
  return calls;
}

module.exports = { patchAgentRuntime, recordAgentEvent, summarizeToolCalls };
