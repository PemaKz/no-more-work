const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');

const VALID_TYPES = new Set([
  'incident',
  'tick',
  'objective',
  'deliberation',
  'custom',
]);
const VALID_STATUSES = new Set([
  'pending',
  'running',
  'done',
  'cancelled',
  'error',
]);

module.exports = class TasksRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { Task } = container.get('database').models;
    const where = { organizationId: request.activeOrganizationId };
    if (request.query?.zoneId) where.zoneId = request.query.zoneId;
    if (request.query?.status) where.status = request.query.status;

    const rows = await Task.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(request.query?.limit, 10) || 100, 500),
    });
    return { tasks: rows.map((t) => t.toJSON()) };
  }

  async post({ container, request }) {
    const { Task, Zone, Agent } = container.get('database').models;
    const orgId = request.activeOrganizationId;
    const body = request.body || {};

    const title = (body.title || '').trim();
    if (!title) {
      return { status: 400, success: false, message: 'title is required' };
    }
    const zoneId = (body.zoneId || '').trim();
    if (!zoneId) {
      return { status: 400, success: false, message: 'zoneId is required' };
    }
    const zone = await Zone.findOne({
      where: { id: zoneId, organizationId: orgId },
    });
    if (!zone) {
      return { status: 404, success: false, message: 'Zone not found' };
    }

    const type = VALID_TYPES.has(body.type) ? body.type : 'custom';

    // Las deliberaciones solo tienen sentido en el orquestador.
    if (type === 'deliberation' && zone.kind !== 'controller') {
      return {
        status: 400,
        success: false,
        message:
          'Las tasks de tipo deliberation solo pueden crearse en la zona orquestadora.',
      };
    }

    let assignedAgentId = null;
    if (body.assignedAgentId) {
      const agent = await Agent.findOne({
        where: {
          id: body.assignedAgentId,
          zoneId: zone.id,
          organizationId: orgId,
        },
      });
      if (!agent) {
        return {
          status: 400,
          success: false,
          message: 'assignedAgent not found in zone',
        };
      }
      assignedAgentId = agent.id;
    }

    const task = await Task.create({
      organizationId: orgId,
      zoneId: zone.id,
      type,
      status: 'pending',
      title,
      input: body.input || null,
      parentTaskId: body.parentTaskId || null,
      assignedAgentId,
    });

    const payload = task.toJSON();
    emitToOrg(container, orgId, 'task:created', payload);
    return { status: 201, task: payload };
  }
};
