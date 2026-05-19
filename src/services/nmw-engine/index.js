const { Service } = require('zyket');
const { buildDefaultRegistry } = require('./tools');
const { Scheduler } = require('./scheduler');
const { ensureControllerAgent } = require('./core/bootstrap');

const tickMode = require('./modes/tick');
const taskMode = require('./modes/task');
const deliberationMode = require('./modes/deliberation');

/**
 * NMW Engine
 * ──────────
 * Servicio de zyket que orquesta agentes LLM. Expone tres conceptos:
 *
 *   1. `engine.run(modeName, args)` — ejecuta un MODE (flow del agente)
 *      • 'tick'         — ciclo autónomo periódico (sin task explícita)
 *      • 'task'         — ejecutar una Task asignada (resuelve agente, llama LLM)
 *      • 'deliberation' — round-robin multi-agente en la zona controladora
 *
 *   2. `engine.tools` — ToolRegistry. Cada tool declara en qué modes está
 *      disponible. Para añadir una tool nueva ver tools/README en el
 *      directorio del service o el README de la raíz.
 *
 *   3. `engine.scheduler` — gestor de loops periódicos de agentes
 *      (`upsert`, `remove`, `init`).
 *
 * Pensado para que el código de cada pieza sea corto: la lógica vive
 * repartida en core/, prompts/, tools/, modes/, scheduler/.
 */
module.exports = class NmwEngine extends Service {
  #container;
  #modes;

  constructor(container) {
    super('nmw-engine');
    this.#container = container;
    this.tools = buildDefaultRegistry();
    this.scheduler = new Scheduler(container);
    this.#modes = new Map([
      [tickMode.name, tickMode],
      [taskMode.name, taskMode],
      [deliberationMode.name, deliberationMode],
    ]);
  }

  async boot() {
    // El scheduler depende de bullmq + database. Ambos se botean antes
    // si están registrados antes en services[]. Si por alguna razón
    // bullmq no está activo, scheduler.init() se ocupa de loguear y salir.
    // Asume que las migraciones ya están aplicadas — el service `migrations`
    // se registra antes que éste en index.js.
    await this.scheduler.init();
    this.#container
      .get('logger')
      ?.info?.(
        `[nmw-engine] booted (modes: ${[...this.#modes.keys()].join(', ')}; tools: ${this.tools.list().length})`
      );
  }

  /**
   * Garantiza que la org tenga su agente system en el orquestador. Las
   * routes que toquen zonas/agentes lo invocan oportunísticamente; es
   * idempotente.
   */
  async ensureControllerAgent(organizationId) {
    return ensureControllerAgent(this.#container, organizationId);
  }

  /**
   * Punto de entrada principal. `args` se forwardea al mode tal cual,
   * además de `{ engine, container }`.
   */
  async run(modeName, args = {}) {
    const mode = this.#modes.get(modeName);
    if (!mode) throw new Error(`Unknown mode: ${modeName}`);
    return mode.run({ engine: this, container: this.#container, ...args });
  }

  /** Registra un mode custom. Opcional: para extender desde otro service. */
  registerMode(mode) {
    if (!mode?.name || typeof mode.run !== 'function') {
      throw new Error('Mode needs { name, run() }');
    }
    this.#modes.set(mode.name, mode);
    return this;
  }
};
