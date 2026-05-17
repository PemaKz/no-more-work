const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');

module.exports = class AgentRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const { Agent, Zone } = container.get('database').models;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const agent = await Agent.findOne({
      where: { id, organizationId: orgId },
    });
    if (!agent) {
      return { status: 404, success: false, message: 'Agent not found' };
    }

    const body = request.body || {};
    const updates = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      updates.description = body.description || null;
    }
    // `status` no es editable por el usuario: lo asigna el runtime del
    // sistema. Cualquier valor enviado en el body se ignora.
    if (Number.isFinite(body.x)) updates.x = Math.round(body.x);
    if (Number.isFinite(body.y)) updates.y = Math.round(body.y);

    // Mover a otra zona: validar pertenencia a la org.
    if (typeof body.zoneId === 'string' && body.zoneId !== agent.zoneId) {
      const zone = await Zone.findOne({
        where: { id: body.zoneId, organizationId: orgId },
      });
      if (!zone) {
        return {
          status: 400,
          success: false,
          message: 'Target zone not found',
        };
      }
      updates.zoneId = zone.id;
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }

    await agent.update(updates);
    const payload = agent.toJSON();
    emitToOrg(
      container,
      request.activeOrganizationId,
      'agent:updated',
      payload
    );
    return { agent: payload };
  }

  async delete({ container, request }) {
    const { Agent } = container.get('database').models;
    const id = request.params.id;

    const agent = await Agent.findOne({
      where: { id, organizationId: request.activeOrganizationId },
    });
    if (!agent) {
      return { status: 404, success: false, message: 'Agent not found' };
    }

    await agent.destroy();
    emitToOrg(container, request.activeOrganizationId, 'agent:deleted', {
      id,
      zoneId: agent.zoneId,
    });
    return { id };
  }
};
