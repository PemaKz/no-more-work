module.exports = function zoneContext(ctx) {
  const items = ctx.zoneContexts || [];
  if (!items.length || !ctx.zone) return null;
  return (
    `── Contexto de la zona "${ctx.zone.name}" ──\n` +
    items
      .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
      .join('\n')
  );
};
