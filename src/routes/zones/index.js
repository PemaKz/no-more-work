const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');
const { encrypt } = require('../../utils/crypto');
const { notify } = require('../../utils/notifications');
const { emitToOrg } = require('../../utils/realtime');

/**
 * Auto-coloca la nueva zona en flow horizontal con wrap a la siguiente fila.
 * Todas las dimensiones snapean a tiles de 48px para alinear con el grid
 * visible del mapa.
 *
 * Layout:
 *   - 4 columnas por fila (configurable vía COLS)
 *   - Celda 12x8 tiles = 576x384
 *   - Gap de 1 tile entre celdas (48)
 *   - Origin a 1 tile del (0,0) (48)
 */
function nextZonePosition(existingZones) {
  const TILE = 48;
  const CELL_W = 12 * TILE; // 576
  const CELL_H = 8 * TILE; // 384
  const GAP = TILE; // 48
  const COLS = 4;
  const ORIGIN_X = TILE;
  const ORIGIN_Y = TILE;
  const PITCH_X = CELL_W + GAP;
  const PITCH_Y = CELL_H + GAP;

  const occupied = new Set(
    existingZones.map((z) => {
      const col = Math.round((z.x - ORIGIN_X) / PITCH_X);
      const row = Math.round((z.y - ORIGIN_Y) / PITCH_Y);
      return `${col}:${row}`;
    })
  );

  for (let row = 0; row < 10000; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!occupied.has(`${col}:${row}`)) {
        return {
          x: ORIGIN_X + col * PITCH_X,
          y: ORIGIN_Y + row * PITCH_Y,
          width: CELL_W,
          height: CELL_H,
        };
      }
    }
  }
  return { x: ORIGIN_X, y: ORIGIN_Y, width: CELL_W, height: CELL_H };
}

function serializeZone(zone) {
  const json = zone.toJSON();
  return {
    ...json,
    contexts: (zone.contexts || []).map((c) => c.toJSON()),
    mcps: (zone.mcps || []).map((m) => m.toJSON()),
    skills: (zone.skills || []).map((s) => s.toJSON()),
    // Los valores cifrados NUNCA viajan al cliente. Solo metadatos.
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

/**
 * Dedupe + normaliza secrets (key uppercase, último gana). Preserva si el
 * cliente envió `value` o no — distinción importante: ausencia = mantener
 * el valor cifrado existente; presencia (incluso "") = sobrescribir.
 */
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

module.exports = class ZonesRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { Zone, ZoneContext, ZoneMcp, ZoneSkill, ZoneSecret, Agent } =
      container.get('database').models;
    const orgId = request.activeOrganizationId;

    // Garantiza que la organización tenga su zona controladora. Es atómico:
    // findOrCreate respeta concurrencia para que dos requests simultáneos no
    // dupliquen.
    await Zone.findOrCreate({
      where: { organizationId: orgId, kind: 'controller' },
      defaults: {
        organizationId: orgId,
        kind: 'controller',
        name: 'Orquestador',
        type: 'controller',
        color: '#6366f1',
        x: 48, // col 0, row 0 — alineado al grid de 48px
        y: 48,
        width: 12 * 48,
        height: 8 * 48,
      },
    });

    const zones = await Zone.findAll({
      where: { organizationId: orgId },
      include: [
        { model: ZoneContext, as: 'contexts' },
        { model: ZoneMcp, as: 'mcps' },
        { model: ZoneSkill, as: 'skills' },
        { model: ZoneSecret, as: 'secrets' },
        { model: Agent, as: 'agents' },
      ],
      order: [['createdAt', 'ASC']],
    });

    return { zones: zones.map(serializeZone) };
  }

  async post({ container, request }) {
    const db = container.get('database');
    const { Zone, ZoneContext, ZoneMcp, ZoneSkill, ZoneSecret } = db.models;
    const { sequelize } = db;

    const body = request.body || {};
    const name = (body.name || '').trim();
    if (!name) {
      return { status: 400, success: false, message: 'name is required' };
    }

    const type = (body.type || 'research').toString().trim() || 'research';
    const color =
      typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)
        ? body.color.toLowerCase()
        : null;
    const description = body.description ?? null;
    const contexts = Array.isArray(body.contexts) ? body.contexts : [];
    const mcps = Array.isArray(body.mcps) ? body.mcps : [];
    const skills = Array.isArray(body.skills) ? body.skills : [];
    const secrets = Array.isArray(body.secrets)
      ? normalizeSecrets(body.secrets)
      : [];

    // Posición: usa la del body si viene, si no auto-coloca
    let { x, y, width, height } = body;
    if (x == null || y == null || width == null || height == null) {
      const existing = await Zone.findAll({
        where: { organizationId: request.activeOrganizationId },
        attributes: ['x', 'y'],
      });
      const pos = nextZonePosition(existing);
      x = x ?? pos.x;
      y = y ?? pos.y;
      width = width ?? pos.width;
      height = height ?? pos.height;
    }

    const zone = await sequelize.transaction(async (tx) => {
      const created = await Zone.create(
        {
          organizationId: request.activeOrganizationId,
          name,
          type,
          color,
          description,
          x,
          y,
          width,
          height,
        },
        { transaction: tx }
      );

      if (contexts.length) {
        await ZoneContext.bulkCreate(
          contexts
            .filter((c) => c && (c.content || '').trim())
            .map((c, i) => ({
              zoneId: created.id,
              title: c.title || null,
              content: c.content,
              order: c.order ?? i,
            })),
          { transaction: tx }
        );
      }

      if (mcps.length) {
        await ZoneMcp.bulkCreate(
          mcps
            .filter((m) => m && (m.name || '').trim())
            .map((m) => ({
              zoneId: created.id,
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
            })),
          { transaction: tx }
        );
      }

      if (skills.length) {
        await ZoneSkill.bulkCreate(
          skills
            .filter((s) => s && (s.name || '').trim())
            .map((s) => ({
              zoneId: created.id,
              name: s.name,
              description: s.description || null,
              enabled: s.enabled !== false,
            })),
          { transaction: tx }
        );
      }

      if (secrets.length) {
        // En POST siempre son nuevos — encripta el valor (o "" si no vino).
        await ZoneSecret.bulkCreate(
          secrets.map((s) => ({
            zoneId: created.id,
            key: s.key,
            valueEncrypted: encrypt(s.value ?? ''),
            description: s.description,
          })),
          { transaction: tx }
        );
      }

      return created;
    });

    // Recarga con relaciones
    const full = await Zone.findByPk(zone.id, {
      include: [
        { model: ZoneContext, as: 'contexts' },
        { model: ZoneMcp, as: 'mcps' },
        { model: ZoneSkill, as: 'skills' },
        { model: ZoneSecret, as: 'secrets' },
      ],
    });

    await notify(container, {
      userId: request.user.id,
      organizationId: request.activeOrganizationId,
      type: 'zone_created',
      title: 'Zona creada',
      body: `Has creado la zona "${name}".`,
    });

    const payload = serializeZone(full);
    emitToOrg(container, request.activeOrganizationId, 'zone:created', payload);

    return { status: 201, zone: payload };
  }
};
