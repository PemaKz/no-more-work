/**
 * Cargadores de contexto que los modes y augmenters reutilizan. Centralizar
 * aquí evita que cada mode duplique queries y mantiene los límites/orden
 * consistentes en todas partes.
 *
 * Cada función recibe `container` + lo que necesita y devuelve filas
 * Sequelize. Si añades un nuevo loader, sigue el mismo shape.
 */

const DEFAULT_RECENT_LIMIT = 20;

async function loadOrgContexts(container, organizationId) {
  const { OrgContext } = container.get('database').models;
  return OrgContext.findAll({
    where: { organizationId },
    order: [
      ['order', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
}

async function loadZoneContexts(container, zoneId) {
  const { ZoneContext } = container.get('database').models;
  return ZoneContext.findAll({
    where: { zoneId },
    order: [
      ['order', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
}

async function loadRecentEntries(
  container,
  { organizationId, zoneId },
  limit = DEFAULT_RECENT_LIMIT
) {
  const db = container.get('database');
  const { ContextEntry } = db.models;
  const { Sequelize } = db;
  return ContextEntry.findAll({
    where: {
      organizationId,
      [Sequelize.Op.or]: [
        { scope: 'org', scopeId: organizationId },
        { scope: 'zone', scopeId: zoneId },
      ],
    },
    order: [
      ['pinned', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit,
  });
}

async function loadPendingTasks(container, { zoneId, limit = 10 }) {
  const { Task } = container.get('database').models;
  return Task.findAll({
    where: { zoneId, status: 'pending' },
    attributes: ['id', 'title'],
    limit,
  });
}

async function loadOtherZones(container, { organizationId, kind = 'standard' }) {
  const { Zone } = container.get('database').models;
  return Zone.findAll({
    where: { organizationId, kind },
    attributes: ['id', 'name', 'type'],
  });
}

module.exports = {
  loadOrgContexts,
  loadZoneContexts,
  loadRecentEntries,
  loadPendingTasks,
  loadOtherZones,
};
