const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');

const VALID_STATUSES = new Set([
  'pending',
  'running',
  'done',
  'cancelled',
  'error',
]);

module.exports = class TaskRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const { Task, Agent } = container.get('database').models;
    const orgId = request.activeOrganizationId;
    const id = request.params.id;

    const task = await Task.findOne({
      where: { id, organizationId: orgId },
    });
    if (!task) {
      return { status: 404, success: false, message: 'Task not found' };
    }

    const body = request.body || {};
    const updates = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
      updates.status = body.status;
      // Auto-stamp transitions
      if (body.status === 'running' && !task.startedAt) {
        updates.startedAt = new Date();
      }
      if (
        ['done', 'cancelled', 'error'].includes(body.status) &&
        !task.finishedAt
      ) {
        updates.finishedAt = new Date();
      }
    }
    if ('input' in body) updates.input = body.input ?? null;
    if ('output' in body) updates.output = body.output ?? null;
    if ('errorMessage' in body) updates.errorMessage = body.errorMessage || null;

    if ('assignedAgentId' in body) {
      if (!body.assignedAgentId) {
        updates.assignedAgentId = null;
      } else {
        const agent = await Agent.findOne({
          where: {
            id: body.assignedAgentId,
            zoneId: task.zoneId,
            organizationId: orgId,
          },
        });
        if (!agent) {
          return {
            status: 400,
            success: false,
            message: 'assignedAgent not in zone',
          };
        }
        updates.assignedAgentId = agent.id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }

    await task.update(updates);
    const payload = task.toJSON();
    emitToOrg(container, orgId, 'task:updated', payload);
    return { task: payload };
  }

  async delete({ container, request }) {
    const { Task } = container.get('database').models;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const task = await Task.findOne({
      where: { id, organizationId: orgId },
    });
    if (!task) {
      return { status: 404, success: false, message: 'Task not found' };
    }

    await task.destroy();
    emitToOrg(container, orgId, 'task:deleted', { id, zoneId: task.zoneId });
    return { id };
  }
};
