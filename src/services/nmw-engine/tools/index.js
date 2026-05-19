const { ToolRegistry } = require('./registry');

const addContextEntry = require('./addContextEntry');
const createTask = require('./createTask');
const completeTask = require('./completeTask');
const endTick = require('./endTick');
const proposeTask = require('./proposeTask');
const passTurn = require('./passTurn');

/**
 * Construye un ToolRegistry precargado con las tools por defecto del
 * engine. Si quieres registrar tools custom desde otro sitio (p. ej. un
 * service externo), usa el `engine.tools.register(def)` desde tu boot —
 * NO modifiques esta función salvo para añadir tools que vengan con
 * el engine por defecto.
 */
function buildDefaultRegistry() {
  const registry = new ToolRegistry();
  registry.register(addContextEntry);
  registry.register(createTask);
  registry.register(completeTask);
  registry.register(endTick);
  registry.register(proposeTask);
  registry.register(passTurn);
  return registry;
}

module.exports = { ToolRegistry, buildDefaultRegistry };
