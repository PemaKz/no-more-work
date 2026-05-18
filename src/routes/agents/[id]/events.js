const { Route } = require('zyket');
const AuthMiddleware = require('../../../middlewares/auth');

/**
 * GET /agents/:id/events — timeline cronológico (más reciente primero) de
 * la actividad del agente. Lo consume el AgentDialog para pintar el
 * panel "Actividad" en tiempo real (combinado con socket events).
 */
module.exports = class AgentEventsRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { Agent, AgentEvent } = container.get('database').models;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    // Verifica que el agente pertenece a la org del usuario.
    const agent = await Agent.findOne({
      where: { id, organizationId: orgId },
      attributes: ['id'],
    });
    if (!agent) {
      return { status: 404, success: false, message: 'Agent not found' };
    }

    const limit = Math.min(
      200,
      Math.max(1, parseInt(request.query?.limit, 10) || 50)
    );

    const events = await AgentEvent.findAll({
      where: { agentId: id, organizationId: orgId },
      order: [['createdAt', 'DESC']],
      limit,
    });

    return { events: events.map((e) => e.toJSON()) };
  }
};
