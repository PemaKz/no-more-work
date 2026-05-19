/**
 * Bloque inicial del prompt: identidad del agente y zona en la que opera.
 * Si el agente tiene `systemPrompt` propio, se respeta tal cual.
 */
module.exports = function identity(ctx) {
  const { agent, zone } = ctx;
  if (agent.systemPrompt) return agent.systemPrompt;
  if (!zone) return `Eres ${agent.name}.`;
  return `Eres ${agent.name}, agente de la zona "${zone.name}" (tipo: ${zone.type}).`;
};
