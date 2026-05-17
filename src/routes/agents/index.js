const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { notify } = require('../../utils/notifications');
const { emitToOrg } = require('../../utils/realtime');

/**
 * Coloca el nuevo agente en un grid simple dentro de la zona, evitando
 * solapamiento con agentes existentes. Si no encuentra hueco, devuelve el
 * centro.
 */
function nextAgentPosition(zone, existing) {
  const PAD = 24;
  const CELL = 28;
  const cols = Math.max(1, Math.floor((zone.width - PAD * 2) / CELL));
  const occupied = new Set(
    existing.map((a) => {
      const col = Math.round((a.x - PAD) / CELL);
      const row = Math.round((a.y - PAD) / CELL);
      return `${col}:${row}`;
    })
  );
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col < cols; col++) {
      if (!occupied.has(`${col}:${row}`)) {
        const x = PAD + col * CELL;
        const y = PAD + row * CELL;
        if (y < zone.height - PAD) return { x, y };
      }
    }
  }
  return { x: Math.round(zone.width / 2), y: Math.round(zone.height / 2) };
}

module.exports = class AgentsRoute extends Route {
  middlewares = {
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async post({ container, request }) {
    const db = container.get('database');
    const { Zone, Agent } = db.models;
    const orgId = request.activeOrganizationId;
    const body = request.body || {};

    const name = (body.name || '').toString().trim();
    if (!name) {
      return { status: 400, success: false, message: 'name is required' };
    }
    const zoneId = (body.zoneId || '').toString().trim();
    if (!zoneId) {
      return { status: 400, success: false, message: 'zoneId is required' };
    }

    const zone = await Zone.findOne({
      where: { id: zoneId, organizationId: orgId },
    });
    if (!zone) {
      return { status: 404, success: false, message: 'Zone not found' };
    }

    // `status` lo asigna el sistema runtime — el cliente no puede setearlo.
    // Siempre arranca en 'idle' (default del modelo).
    const description =
      typeof body.description === 'string' ? body.description || null : null;

    let x = Number.isFinite(body.x) ? Math.round(body.x) : null;
    let y = Number.isFinite(body.y) ? Math.round(body.y) : null;
    if (x == null || y == null) {
      const existing = await Agent.findAll({
        where: { zoneId: zone.id },
        attributes: ['x', 'y'],
      });
      const pos = nextAgentPosition(zone, existing);
      x = pos.x;
      y = pos.y;
    }

    const agent = await Agent.create({
      zoneId: zone.id,
      organizationId: orgId,
      name,
      description,
      x,
      y,
    });

    await notify(container, {
      userId: request.user.id,
      organizationId: orgId,
      type: 'agent_created',
      title: 'Agente añadido',
      body: `Has añadido el agente "${agent.name}" a la zona "${zone.name}".`,
    });

    const payload = agent.toJSON();
    emitToOrg(container, orgId, 'agent:created', payload);

    return { status: 201, agent: payload };
  }
};
