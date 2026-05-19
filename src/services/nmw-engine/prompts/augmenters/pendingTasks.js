/**
 * Lista de tasks pendientes de la zona del agente. Se usa principalmente
 * en `mode: tick` para que el agente sepa qué cola tiene su zona y no
 * cree duplicados.
 */
module.exports = function pendingTasks(ctx) {
  const items = ctx.pendingTasks || [];
  if (!items.length) return 'No hay tasks pendientes en la zona.';
  return (
    `Tasks pendientes en la zona (${items.length}):\n` +
    items.map((t) => `  - ${t.title}`).join('\n')
  );
};
