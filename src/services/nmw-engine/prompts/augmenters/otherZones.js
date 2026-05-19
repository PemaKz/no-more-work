/**
 * Listado de zonas a las que se puede delegar trabajo. Usado por el mode
 * `deliberation` para que el agente sepa a qué zona dirigir cada
 * propose_task. Si no hay zonas estándar, emite el aviso correspondiente.
 */
module.exports = function otherZones(ctx) {
  const zones = ctx.otherZones || [];
  if (!zones.length) {
    return 'No hay zonas estándar todavía — limítate a registrar contexto o pasar el turno.';
  }
  return (
    '── Zonas disponibles para delegar ──\n' +
    zones.map((z) => `• ${z.name}  (tipo: ${z.type})`).join('\n')
  );
};
