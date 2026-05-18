const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');

const VALID_KINDS = new Set(['insight', 'decision', 'observation', 'memo']);

module.exports = class ContextEntryRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const { ContextEntry } = container.get('database').models;
    const orgId = request.activeOrganizationId;
    const id = request.params.id;

    const entry = await ContextEntry.findOne({
      where: { id, organizationId: orgId },
    });
    if (!entry) {
      return { status: 404, success: false, message: 'Entry not found' };
    }

    const body = request.body || {};
    const updates = {};
    if (typeof body.pinned === 'boolean') updates.pinned = body.pinned;
    if (typeof body.content === 'string' && body.content.trim()) {
      updates.content = body.content.trim();
    }
    if (typeof body.kind === 'string' && VALID_KINDS.has(body.kind)) {
      updates.kind = body.kind;
    }
    if ('metadata' in body) updates.metadata = body.metadata || null;

    if (Object.keys(updates).length === 0) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }

    await entry.update(updates);
    const payload = entry.toJSON();
    emitToOrg(container, orgId, 'context-entry:updated', payload);
    return { entry: payload };
  }

  async delete({ container, request }) {
    const { ContextEntry } = container.get('database').models;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const entry = await ContextEntry.findOne({
      where: { id, organizationId: orgId },
    });
    if (!entry) {
      return { status: 404, success: false, message: 'Entry not found' };
    }

    await entry.destroy();
    emitToOrg(container, orgId, 'context-entry:deleted', {
      id,
      scope: entry.scope,
      scopeId: entry.scopeId,
    });
    return { id };
  }
};
