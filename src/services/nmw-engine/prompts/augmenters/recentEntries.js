/**
 * Log reciente de ContextEntries. Pinneadas primero, truncadas a 280 chars.
 * Si necesitas un límite distinto, ajusta el loader (no el augmenter).
 */
module.exports = function recentEntries(ctx) {
  const items = ctx.recentEntries || [];
  if (!items.length) return null;
  return (
    '── Log reciente (★ = pinned) ──\n' +
    items
      .map(
        (e) =>
          `${e.pinned ? '★ ' : '  '}[${e.kind}] ${e.content.slice(0, 280)}`
      )
      .join('\n')
  );
};
