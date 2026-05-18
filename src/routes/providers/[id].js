const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { emitToOrg } = require('../../utils/realtime');
const {
  setProviderApiKey,
  clearProviderApiKey,
} = require('../../utils/providerSecrets');

const VALID_KINDS = new Set(['anthropic', 'openai', 'openai_compatible']);

function serialize(p) {
  const json = p.toJSON();
  return {
    ...json,
    hasApiKey: !!json.apiKeySecretId,
    apiKeySecretId: undefined,
  };
}

module.exports = class ProviderRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const db = container.get('database');
    const { Provider } = db.models;
    const { sequelize } = db;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const provider = await Provider.findOne({
      where: { id, organizationId: orgId },
    });
    if (!provider) {
      return { status: 404, success: false, message: 'Provider not found' };
    }

    const body = request.body || {};
    const updates = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.kind === 'string') {
      const k = body.kind.toLowerCase();
      if (!VALID_KINDS.has(k)) {
        return { status: 400, success: false, message: 'invalid kind' };
      }
      updates.kind = k;
    }
    if (typeof body.baseURL === 'string') {
      updates.baseURL = body.baseURL.trim() || null;
    }
    if (typeof body.defaultModel === 'string' && body.defaultModel.trim()) {
      updates.defaultModel = body.defaultModel.trim();
    }

    const finalKind = updates.kind || provider.kind;
    const finalBaseURL =
      'baseURL' in updates ? updates.baseURL : provider.baseURL;
    if (finalKind === 'openai_compatible' && !finalBaseURL) {
      return {
        status: 400,
        success: false,
        message: 'baseURL is required for openai_compatible',
      };
    }

    // API key: si viene como string no vacío, crear/actualizar. Si viene
    // explícitamente como null o false, borrar. Si no viene, no tocar.
    const hasApiKeyAction = 'apiKey' in body;
    const newApiKey =
      typeof body.apiKey === 'string' ? body.apiKey.trim() : null;
    const wantsClear = body.apiKey === null || body.apiKey === false;

    await sequelize.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await provider.update(updates, { transaction: tx });
      }
      if (hasApiKeyAction) {
        if (wantsClear) {
          await clearProviderApiKey(container, provider, tx);
        } else if (newApiKey) {
          await setProviderApiKey(container, provider, newApiKey, tx);
        }
        // apiKey: '' → ignorar (no cambio)
      }
    });

    await provider.reload();
    const payload = serialize(provider);
    emitToOrg(container, orgId, 'provider:updated', payload);
    return { provider: payload };
  }

  async delete({ container, request }) {
    const db = container.get('database');
    const { Provider, Agent } = db.models;
    const { sequelize } = db;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const provider = await Provider.findOne({
      where: { id, organizationId: orgId },
    });
    if (!provider) {
      return { status: 404, success: false, message: 'Provider not found' };
    }

    await sequelize.transaction(async (tx) => {
      // Desreferenciar agentes que apuntan a este provider
      await Agent.update(
        { providerId: null },
        {
          where: { providerId: id, organizationId: orgId },
          transaction: tx,
        }
      );
      // Borrar secret interno si existe
      await clearProviderApiKey(container, provider, tx);
      await provider.destroy({ transaction: tx });
    });

    emitToOrg(container, orgId, 'provider:deleted', { id });
    return { id };
  }
};
