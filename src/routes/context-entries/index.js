const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');

const VALID_SCOPES = new Set(['org', 'zone']);
const VALID_KINDS = new Set(['insight', 'decision', 'observation', 'memo']);

module.exports = class ContextEntriesRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { ContextEntry } = container.get('database').models;
    const orgId = request.activeOrganizationId;
    const where = { organizationId: orgId };
    if (request.query?.scope) where.scope = request.query.scope;
    if (request.query?.scopeId) where.scopeId = request.query.scopeId;
    if (request.query?.pinned === 'true') where.pinned = true;

    const rows = await ContextEntry.findAll({
      where,
      order: [
        ['pinned', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: Math.min(parseInt(request.query?.limit, 10) || 100, 500),
    });
    return { entries: rows.map((r) => r.toJSON()) };
  }

  async post({ container, request }) {
    const { ContextEntry, Zone } = container.get('database').models;
    const orgId = request.activeOrganizationId;
    const body = request.body || {};

    const content = (body.content || '').trim();
    if (!content) {
      return { status: 400, success: false, message: 'content is required' };
    }
    const scope = body.scope === 'org' ? 'org' : 'zone';
    if (!VALID_SCOPES.has(scope)) {
      return { status: 400, success: false, message: 'invalid scope' };
    }

    let scopeId;
    if (scope === 'org') {
      scopeId = orgId;
    } else {
      const zoneId = (body.scopeId || body.zoneId || '').trim();
      if (!zoneId) {
        return {
          status: 400,
          success: false,
          message: 'scopeId required for zone scope',
        };
      }
      const zone = await Zone.findOne({
        where: { id: zoneId, organizationId: orgId },
      });
      if (!zone) {
        return { status: 404, success: false, message: 'Zone not found' };
      }
      scopeId = zone.id;
    }

    const kind = VALID_KINDS.has(body.kind) ? body.kind : 'observation';

    const entry = await ContextEntry.create({
      organizationId: orgId,
      scope,
      scopeId,
      sourceType: 'user',
      sourceId: request.user.id,
      kind,
      content,
      metadata: body.metadata || null,
      pinned: body.pinned === true,
      sourceTaskId: body.sourceTaskId || null,
    });

    const payload = entry.toJSON();
    emitToOrg(container, orgId, 'context-entry:created', payload);
    return { status: 201, entry: payload };
  }
};
