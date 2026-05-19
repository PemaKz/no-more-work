/**
 * Builder de prompts basado en *augmenters*. Cada augmenter es:
 *
 *   async (ctx) => string | null
 *
 * y aporta un bloque al prompt final (separado por `\n\n`). Los bloques
 * null/vacíos se descartan. El orden del array `augmenters` determina el
 * orden de los bloques.
 *
 * Para añadir contenido nuevo al prompt de un mode: crea un augmenter en
 * `prompts/augmenters/`, importa y añádelo al array del mode. No toques
 * los augmenters existentes salvo para mejorarlos.
 *
 * `ctx` típicamente lleva: { agent, zone, task?, contributions?, container,
 * mode, recentEntries, orgContexts, zoneContexts, otherZones, ... }
 *
 * Buena práctica: los augmenters NO hacen I/O. El mode precarga los datos
 * y los pasa por `ctx`. Eso mantiene los augmenters baratos y testeables.
 */
async function buildPrompt(augmenters, ctx) {
  const blocks = [];
  for (const aug of augmenters) {
    const block = typeof aug === 'function' ? await aug(ctx) : aug;
    if (block) blocks.push(block);
  }
  return blocks.join('\n\n');
}

module.exports = { buildPrompt };
