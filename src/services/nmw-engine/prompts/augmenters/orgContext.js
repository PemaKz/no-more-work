module.exports = function orgContext(ctx) {
  const items = ctx.orgContexts || [];
  if (!items.length) return null;
  return (
    '── Contexto organizacional ──\n' +
    items
      .map((c) => `• ${c.title ? `[${c.title}] ` : ''}${c.content}`)
      .join('\n')
  );
};
