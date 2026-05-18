const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');
const { setProviderApiKey } = require('../../utils/providerSecrets');

const VALID_KINDS = new Set(['anthropic', 'openai', 'openai_compatible']);

function serialize(p) {
  const json = p.toJSON();
  // Exponer si tiene key configurada, sin revelar ni el id del secret
  return {
    ...json,
    hasApiKey: !!json.apiKeySecretId,
    // No exponemos apiKeySecretId hacia el cliente — es detalle interno
    apiKeySecretId: undefined,
  };
}

module.exports = class ProvidersRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { Provider } = container.get('database').models;
    const rows = await Provider.findAll({
      where: { organizationId: request.activeOrganizationId },
      order: [['createdAt', 'ASC']],
    });
    return { providers: rows.map(serialize) };
  }

  async post({ container, request }) {
    const db = container.get('database');
    const { Provider } = db.models;
    const { sequelize } = db;
    const orgId = request.activeOrganizationId;
    const body = request.body || {};

    const name = (body.name || '').trim();
    if (!name) {
      return { status: 400, success: false, message: 'name is required' };
    }
    const kind = (body.kind || 'anthropic').toLowerCase();
    if (!VALID_KINDS.has(kind)) {
      return { status: 400, success: false, message: 'invalid kind' };
    }
    const defaultModel = (body.defaultModel || '').trim();
    if (!defaultModel) {
      return {
        status: 400,
        success: false,
        message: 'defaultModel is required',
      };
    }
    let baseURL = null;
    if (kind === 'openai_compatible') {
      baseURL = (body.baseURL || '').trim() || null;
      if (!baseURL) {
        return {
          status: 400,
          success: false,
          message: 'baseURL is required for openai_compatible',
        };
      }
    }

    const apiKey =
      typeof body.apiKey === 'string' ? body.apiKey.trim() : null;

    const provider = await sequelize.transaction(async (tx) => {
      const created = await Provider.create(
        {
          organizationId: orgId,
          name,
          kind,
          baseURL,
          defaultModel,
          apiKeySecretId: null,
        },
        { transaction: tx }
      );
      if (apiKey) {
        await setProviderApiKey(container, created, apiKey, tx);
      }
      return created;
    });

    const payload = serialize(provider);
    emitToOrg(container, orgId, 'provider:created', payload);
    return { status: 201, provider: payload };
  }
};
