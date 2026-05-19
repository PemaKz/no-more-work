const { emitToOrg } = require('../../../utils/realtime');

/**
 * Tareas que el engine ejecuta al arrancar o cuando se le pide garantizar
 * estado por organización. Los diffs de schema se aplican vía migraciones
 * (umzug, ver `src/models/migrations/`) — no aquí.
 */

/**
 * Garantiza que la organización tenga su agente coordinador en la zona
 * controller. Llamar tras crear/encontrar la zona controller. Es atómico:
 * usa findOrCreate, así que dos requests simultáneos no duplican.
 *
 * El agente arranca SIN provider — el admin lo configura desde la UI.
 */
async function ensureControllerAgent(container, organizationId) {
  const { Zone, Agent } = container.get('database').models;

  const controller = await Zone.findOne({
    where: { organizationId, kind: 'controller' },
  });
  if (!controller) return null;

  const [agent, created] = await Agent.findOrCreate({
    where: {
      organizationId,
      zoneId: controller.id,
      isSystem: true,
    },
    defaults: {
      organizationId,
      zoneId: controller.id,
      isSystem: true,
      name: 'Coordinador',
      description:
        'Agente principal del orquestador. Coordina deliberaciones y propone trabajo a las zonas. Configurable pero no eliminable.',
      role: 'facilitator',
      x: 96,
      y: 96,
    },
  });

  if (created) {
    emitToOrg(container, organizationId, 'agent:created', agent.toJSON());
    container
      .get('logger')
      ?.info?.(
        `[nmw-engine] system agent created for org=${organizationId.slice(0, 8)}`
      );
  }

  return agent;
}

module.exports = { ensureControllerAgent };
