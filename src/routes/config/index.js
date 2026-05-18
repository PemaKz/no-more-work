const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { encrypt } = require('../../utils/crypto');

function serializeRows(rows) {
  return (rows || []).map((r) => r.toJSON());
}

function serializeSecrets(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    key: r.key,
    description: r.description,
    hasValue: !!r.valueEncrypted,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

function normalizeSecrets(arr) {
  const seen = new Set();
  const out = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const raw = arr[i];
    if (!raw) continue;
    const key = (raw.key || '').trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const item = {
      key,
      description: raw.description || null,
    };
    if (typeof raw.value === 'string') item.value = raw.value;
    out.unshift(item);
  }
  return out;
}

async function loadConfig(models, orgId) {
  const { OrgContext, OrgMcp, OrgSkill, OrgSecret } = models;
  const where = { where: { organizationId: orgId } };
  const [contexts, mcps, skills, secrets] = await Promise.all([
    OrgContext.findAll({
      ...where,
      order: [
        ['order', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    }),
    OrgMcp.findAll({ ...where, order: [['createdAt', 'ASC']] }),
    OrgSkill.findAll({ ...where, order: [['createdAt', 'ASC']] }),
    // Solo secrets gestionados por el usuario — los `internal` (creados
    // por providers, etc.) viven detrás de su entidad dueña.
    OrgSecret.findAll({
      where: { organizationId: orgId, internal: false },
      order: [['createdAt', 'ASC']],
    }),
  ]);
  return {
    contexts: serializeRows(contexts),
    mcps: serializeRows(mcps),
    skills: serializeRows(skills),
    secrets: serializeSecrets(secrets),
  };
}

/**
 * GET  /config — devuelve los recursos a nivel organización
 * PUT  /config — reemplaza por completo cualquier array que venga en el body
 *                (estrategia replace-all en transacción). Las claves que no
 *                vengan se respetan.
 *
 * Estos recursos viven a nivel organización y son heredados/compartidos por
 * todas las zonas del office.
 */
module.exports = class ConfigRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
    put: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const config = await loadConfig(
      container.get('database').models,
      request.activeOrganizationId
    );
    return { config };
  }

  async put({ container, request }) {
    const db = container.get('database');
    const { OrgContext, OrgMcp, OrgSkill, OrgSecret } = db.models;
    const { sequelize } = db;
    const orgId = request.activeOrganizationId;
    const body = request.body || {};

    const contexts = Array.isArray(body.contexts) ? body.contexts : null;
    const mcps = Array.isArray(body.mcps) ? body.mcps : null;
    const skills = Array.isArray(body.skills) ? body.skills : null;
    const secrets = Array.isArray(body.secrets)
      ? normalizeSecrets(body.secrets)
      : null;

    if (
      contexts === null &&
      mcps === null &&
      skills === null &&
      secrets === null
    ) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }

    await sequelize.transaction(async (tx) => {
      if (contexts !== null) {
        await OrgContext.destroy({
          where: { organizationId: orgId },
          transaction: tx,
        });
        const rows = contexts
          .filter((c) => c && (c.content || '').trim())
          .map((c, i) => ({
            organizationId: orgId,
            title: c.title || null,
            content: c.content,
            order: c.order ?? i,
          }));
        if (rows.length) await OrgContext.bulkCreate(rows, { transaction: tx });
      }
      if (mcps !== null) {
        await OrgMcp.destroy({
          where: { organizationId: orgId },
          transaction: tx,
        });
        const rows = mcps
          .filter((m) => m && (m.name || '').trim())
          .map((m) => ({
            organizationId: orgId,
            name: m.name,
            transport: m.transport || 'stdio',
            command: m.command || null,
            url: m.url || null,
            args: Array.isArray(m.args) ? m.args : null,
            env:
              m.env && typeof m.env === 'object' && !Array.isArray(m.env)
                ? m.env
                : null,
            enabled: m.enabled !== false,
          }));
        if (rows.length) await OrgMcp.bulkCreate(rows, { transaction: tx });
      }
      if (skills !== null) {
        await OrgSkill.destroy({
          where: { organizationId: orgId },
          transaction: tx,
        });
        const rows = skills
          .filter((s) => s && (s.name || '').trim())
          .map((s) => ({
            organizationId: orgId,
            name: s.name,
            description: s.description || null,
            enabled: s.enabled !== false,
          }));
        if (rows.length) await OrgSkill.bulkCreate(rows, { transaction: tx });
      }
      if (secrets !== null) {
        // Diff por key (mismo patrón que zones): preserva valores cifrados
        // existentes cuando el cliente no envía `value`. Solo opera sobre
        // los user-managed — los internal (gestionados por providers, etc.)
        // no se tocan desde aquí.
        const existing = await OrgSecret.findAll({
          where: { organizationId: orgId, internal: false },
          transaction: tx,
        });
        const submittedKeys = new Set(secrets.map((s) => s.key));
        const existingByKey = new Map(existing.map((s) => [s.key, s]));

        for (const ex of existing) {
          if (!submittedKeys.has(ex.key)) {
            await ex.destroy({ transaction: tx });
          }
        }
        for (const s of secrets) {
          const ex = existingByKey.get(s.key);
          if (ex) {
            const upd = { description: s.description };
            if (typeof s.value === 'string') {
              upd.valueEncrypted = encrypt(s.value);
            }
            await ex.update(upd, { transaction: tx });
          } else {
            await OrgSecret.create(
              {
                organizationId: orgId,
                key: s.key,
                valueEncrypted: encrypt(s.value ?? ''),
                description: s.description,
              },
              { transaction: tx }
            );
          }
        }
      }
    });

    const config = await loadConfig(db.models, orgId);
    return { config };
  }
};
