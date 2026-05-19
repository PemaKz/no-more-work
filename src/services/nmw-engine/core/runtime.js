const { emitToOrg } = require('../../../utils/realtime');

/**
 * Helpers de runtime que TODOS los modes usan para coordinar:
 *   - patchAgent: actualiza state runtime del agente y emite a la org.
 *   - recordEvent: persiste un AgentEvent y lo emite (timeline en UI).
 *   - summarizeToolCalls: resumen humano del array `steps` del AI SDK.
 *
 * Diseño: best-effort. Si falla la BD no rompemos la ejecución del agente.
 * Si pasamos a este helper un container sin el modelo registrado, el helper
 * loguea y devuelve null — el caller decide qué hacer.
 */

async function patchAgent(container, agent, patch) {
  if (!agent) return;
  await agent.update(patch);
  emitToOrg(container, agent.organizationId, 'agent:updated', agent.toJSON());
}

async function recordEvent(
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
      ?.warn?.(`[nmw-engine] no se pudo persistir AgentEvent: ${err.message}`);
    return null;
  }
}

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

module.exports = { patchAgent, recordEvent, summarizeToolCalls };
