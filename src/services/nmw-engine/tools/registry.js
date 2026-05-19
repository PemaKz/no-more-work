const { tool } = require('ai');

/**
 * Registry de tools del engine. Una **tool definition** tiene el shape:
 *
 *   {
 *     name: string,                    // ej "create_task"
 *     description: string,             // visible al modelo
 *     schema: ZodSchema,               // args
 *     availableIn: string[],           // modes donde aparece, ej ['tick', 'task']
 *     execute({ args, ctx }) -> any    // ctx incluye agent, zone, task?, container, emit, etc
 *   }
 *
 * Para añadir una tool nueva basta con crear un archivo en `tools/` que
 * exporte ese objeto y registrarla en `index.js` del registry. NO hace
 * falta tocar los modes existentes — el mode declara los tool names que
 * acepta y el registry filtra automáticamente.
 *
 * `buildAiSdkTools(modeName, ctx)` devuelve el objeto `tools` que
 * `generateText` del Vercel AI SDK espera.
 */
class ToolRegistry {
  #tools = new Map();

  register(def) {
    if (!def?.name) throw new Error('Tool def needs a name');
    if (!def.schema) throw new Error(`Tool "${def.name}" needs a schema`);
    if (typeof def.execute !== 'function') {
      throw new Error(`Tool "${def.name}" needs execute()`);
    }
    if (!Array.isArray(def.availableIn) || def.availableIn.length === 0) {
      throw new Error(`Tool "${def.name}" needs availableIn[]`);
    }
    this.#tools.set(def.name, def);
    return this;
  }

  get(name) {
    return this.#tools.get(name);
  }

  list() {
    return [...this.#tools.values()];
  }

  /**
   * Construye el objeto `tools` para Vercel AI SDK a partir del mode y un
   * `ctx` que se enmascara al execute. Solo se incluyen tools cuyo
   * `availableIn` contiene `modeName`.
   */
  buildAiSdkTools(modeName, ctx) {
    const result = {};
    for (const def of this.#tools.values()) {
      if (!def.availableIn.includes(modeName)) continue;
      result[def.name] = tool({
        description: def.description,
        inputSchema: def.schema,
        execute: async (args) => def.execute({ args, ctx }),
      });
    }
    return result;
  }
}

module.exports = { ToolRegistry };
