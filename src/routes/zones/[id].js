const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { encrypt } = require('../../utils/crypto');
const { emitToOrg } = require('../../utils/realtime');

function serializeZone(zone) {
  const json = zone.toJSON();
  return {
    ...json,
    contexts: (zone.contexts || []).map((c) => c.toJSON()),
    mcps: (zone.mcps || []).map((m) => m.toJSON()),
    skills: (zone.skills || []).map((s) => s.toJSON()),
    secrets: (zone.secrets || []).map((s) => ({
      id: s.id,
      key: s.key,
      description: s.description,
      hasValue: !!s.valueEncrypted,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    agents: (zone.agents || []).map((a) => a.toJSON()),
  };
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

module.exports = class ZoneRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const db = container.get('database');
    const { Zone, ZoneContext, ZoneMcp, ZoneSkill, ZoneSecret, Agent } =
      db.models;
    const { sequelize } = db;
    const id = request.params.id;

    const zone = await Zone.findOne({
      where: { id, organizationId: request.activeOrganizationId },
    });
    if (!zone) {
      return { status: 404, success: false, message: 'Zone not found' };
    }

    const body = request.body || {};
    const updates = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.type === 'string' && body.type.trim()) {
      updates.type = body.type.trim();
    }
    if (
      typeof body.color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(body.color)
    ) {
      updates.color = body.color.toLowerCase();
    }
    if (typeof body.description === 'string') {
      updates.description = body.description || null;
    }
    if (Number.isFinite(body.x)) updates.x = Math.round(body.x);
    if (Number.isFinite(body.y)) updates.y = Math.round(body.y);
    if (Number.isFinite(body.width)) updates.width = Math.round(body.width);
    if (Number.isFinite(body.height)) updates.height = Math.round(body.height);

    // Relaciones anidadas: cuando vienen como array, se reemplazan por
    // completo (estrategia simple replace-all). Si la clave no viene, no
    // se tocan. Pasar array vacío == borrar todas.
    const contexts = Array.isArray(body.contexts) ? body.contexts : null;
    const mcps = Array.isArray(body.mcps) ? body.mcps : null;
    const skills = Array.isArray(body.skills) ? body.skills : null;
    const secrets = Array.isArray(body.secrets)
      ? normalizeSecrets(body.secrets)
      : null;

    const hasFieldUpdates = Object.keys(updates).length > 0;
    const hasNested =
      contexts !== null ||
      mcps !== null ||
      skills !== null ||
      secrets !== null;
    if (!hasFieldUpdates && !hasNested) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }

    await sequelize.transaction(async (tx) => {
      if (hasFieldUpdates) {
        await zone.update(updates, { transaction: tx });
      }
      if (contexts !== null) {
        await ZoneContext.destroy({ where: { zoneId: zone.id }, transaction: tx });
        const rows = contexts
          .filter((c) => c && (c.content || '').trim())
          .map((c, i) => ({
            zoneId: zone.id,
            title: c.title || null,
            content: c.content,
            order: c.order ?? i,
          }));
        if (rows.length) await ZoneContext.bulkCreate(rows, { transaction: tx });
      }
      if (mcps !== null) {
        await ZoneMcp.destroy({ where: { zoneId: zone.id }, transaction: tx });
        const rows = mcps
          .filter((m) => m && (m.name || '').trim())
          .map((m) => ({
            zoneId: zone.id,
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
        if (rows.length) await ZoneMcp.bulkCreate(rows, { transaction: tx });
      }
      if (skills !== null) {
        await ZoneSkill.destroy({ where: { zoneId: zone.id }, transaction: tx });
        const rows = skills
          .filter((s) => s && (s.name || '').trim())
          .map((s) => ({
            zoneId: zone.id,
            name: s.name,
            description: s.description || null,
            enabled: s.enabled !== false,
          }));
        if (rows.length) await ZoneSkill.bulkCreate(rows, { transaction: tx });
      }
      if (secrets !== null) {
        // Diff por key: preserva valueEncrypted cuando el cliente no
        // envía `value` (porque nunca se le mostró). Borra los que no
        // estén en el submission. Crea los nuevos. Actualiza los
        // existentes (descripción siempre; valor solo si vino).
        const existing = await ZoneSecret.findAll({
          where: { zoneId: zone.id },
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
            await ZoneSecret.create(
              {
                zoneId: zone.id,
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

    const full = await Zone.findByPk(zone.id, {
      include: [
        { model: ZoneContext, as: 'contexts' },
        { model: ZoneMcp, as: 'mcps' },
        { model: ZoneSkill, as: 'skills' },
        { model: ZoneSecret, as: 'secrets' },
        { model: Agent, as: 'agents' },
      ],
    });
    const payload = serializeZone(full);
    emitToOrg(container, request.activeOrganizationId, 'zone:updated', payload);
    return { zone: payload };
  }

  async delete({ container, request }) {
    const { Zone } = container.get('database').models;
    const id = request.params.id;

    const zone = await Zone.findOne({
      where: { id, organizationId: request.activeOrganizationId },
    });
    if (!zone) {
      return { status: 404, success: false, message: 'Zone not found' };
    }
    if (zone.kind === 'controller') {
      return {
        status: 400,
        success: false,
        message: 'La zona controladora no se puede eliminar.',
      };
    }

    await zone.destroy();
    emitToOrg(container, request.activeOrganizationId, 'zone:deleted', { id });
    return { id };
  }
};
