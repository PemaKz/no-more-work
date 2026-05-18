const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');
const {
  upsertAgentSchedule,
  removeAgentSchedule,
} = require('../../engine/scheduler');

module.exports = class AgentRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const { Agent, Zone, Provider } = container.get('database').models;
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

    // ── Engine fields ────────────────────────────────────────────────────
    if ('providerId' in body) {
      if (body.providerId === null || body.providerId === '') {
        updates.providerId = null;
      } else {
        const provider = await Provider.findOne({
          where: { id: body.providerId, organizationId: orgId },
        });
        if (!provider) {
          return {
            status: 400,
            success: false,
            message: 'providerId not found',
          };
        }
        updates.providerId = provider.id;
      }
    }
    if ('systemPrompt' in body) {
      updates.systemPrompt =
        typeof body.systemPrompt === 'string'
          ? body.systemPrompt || null
          : null;
    }
    if ('loopEnabled' in body) updates.loopEnabled = body.loopEnabled === true;
    if (Number.isFinite(body.loopIntervalSec)) {
      updates.loopIntervalSec = Math.max(30, Math.round(body.loopIntervalSec));
    }
    if ('role' in body) {
      updates.role =
        typeof body.role === 'string' && body.role.trim()
          ? body.role.trim()
          : null;
    }

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

    // Detectar transición OFF→ON del loop para forzar tick inmediato — así
    // el usuario ve algo en el mapa al activar el loop en vez de esperar
    // loopIntervalSec segundos para el primer run.
    const loopJustEnabled =
      'loopEnabled' in updates &&
      updates.loopEnabled === true &&
      agent.loopEnabled !== true;

    await agent.update(updates);
    const payload = agent.toJSON();
    emitToOrg(
      container,
      request.activeOrganizationId,
      'agent:updated',
      payload
    );
    // Re-sincroniza el scheduler en caso de cambio en loopEnabled o
    // loopIntervalSec. upsertAgentSchedule maneja ambos casos
    // internamente (también borra si loopEnabled pasó a false).
    await upsertAgentSchedule(container, agent, { immediate: loopJustEnabled });
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
    await removeAgentSchedule(container, id);
    return { id };
  }
};
