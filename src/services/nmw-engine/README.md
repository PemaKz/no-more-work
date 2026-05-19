# nmw-engine

Servicio de zyket que orquesta agentes LLM (loops, tasks, deliberaciones).

> Diagramas de arquitectura: ver [ARCHITECTURE.md](./ARCHITECTURE.md).

## Cómo se usa desde el código de la app

```js
const engine = container.get('nmw-engine');

// Ejecutar un mode
await engine.run('tick', { agentId });
await engine.run('task', { taskId });
await engine.run('deliberation', { taskId });

// Scheduler de loops periódicos
await engine.scheduler.upsert(agent, { immediate: true });
await engine.scheduler.remove(agentId);

// Registrar una tool nueva
engine.tools.register(require('./mi-tool'));
```

Workers (`src/workers/agentTick.js`, `taskProcess.js`) son adapters que
delegan en `engine.run('tick'|'task', ...)`. Existen en esa ubicación
porque zyket autoloadea workers SOLO desde `src/workers/`.

## Estructura del directorio

```
core/        # helpers comunes a todos los modes
  runtime.js     # patchAgent, recordEvent, summarizeToolCalls
  providers.js   # getLLM (anthropic | openai | openai_compatible)
  context.js     # loaders: orgContexts, zoneContexts, recentEntries, ...

prompts/     # generación de prompts modular
  build.js                  # buildPrompt(augmenters[], ctx) -> string
  augmenters/
    identity.js, role.js, instructions.js,
    orgContext.js, zoneContext.js, recentEntries.js,
    pendingTasks.js, otherZones.js

tools/       # tools que el LLM puede invocar (Vercel AI SDK)
  registry.js               # ToolRegistry + buildAiSdkTools(mode, ctx)
  index.js                  # buildDefaultRegistry()
  addContextEntry.js, createTask.js, completeTask.js,
  endTick.js, proposeTask.js, passTurn.js

modes/       # cada flow LLM del agente
  tick.js          # loop autónomo periódico
  task.js          # ejecutar una Task asignada
  deliberation.js  # round-robin multi-agente

scheduler/   # gestión BullMQ Job Schedulers (agent-tick queue)
  index.js
```

## Cómo añadir una **tool**

Una tool tiene este shape (ver `tools/addContextEntry.js` como referencia):

```js
const { z } = require('zod');

module.exports = {
  name: 'my_tool',
  description: 'Texto que verá el LLM.',
  schema: z.object({ foo: z.string() }),
  availableIn: ['tick', 'task'],    // en qué modes aparece
  async execute({ args, ctx }) {
    // ctx tiene: container, agent, zone, task?, mode, state, ...
    // El return se devuelve al modelo como JSON.
    return { ok: true };
  },
};
```

Pasos:

1. Crea `tools/myTool.js` con ese shape.
2. Regístrala en `tools/index.js` (`registry.register(require('./myTool'))`),
   **o** desde otro service: `container.get('nmw-engine').tools.register(def)`.
3. Cualquier mode que la tenga en `availableIn` la verá automáticamente.

No hace falta tocar los modes existentes para añadir tools — el registry
filtra por `availableIn` cuando construye el toolset para Vercel AI SDK.

### `ctx.state`

Sirve para tools que necesitan dejar marcadores entre llamadas dentro del
mismo turno (ej. `end_tick` pone `state.ended=true`, `complete_task` pone
`state.taskCompleted=true`, `propose_task` empuja a `state.createdTasks`).
El mode decide qué hacer con esos marcadores tras la invocación.

## Cómo añadir un **augmenter** de prompt

Un augmenter es una función pura:

```js
// prompts/augmenters/myBlock.js
module.exports = function myBlock(ctx) {
  if (!ctx.foo) return null;
  return `── Mi bloque ──\n${ctx.foo}`;
};
```

Reglas:

- **NO hagas I/O dentro del augmenter.** Cargar datos es responsabilidad
  del mode (vía `core/context.js`). Eso mantiene los augmenters baratos,
  ordenables y testeables.
- Devuelve `null` si el augmenter no aplica — el builder lo descarta.
- El orden del array de augmenters en el mode = orden de los bloques en
  el prompt final.

Para usarlo: import en el mode y añade al array `SYSTEM_AUGMENTERS`.

## Cómo añadir un **mode**

Un mode es:

```js
// modes/myMode.js
async function run({ engine, container, ...args }) {
  // 1. Cargar estado (agente, zona, contextos) usando core/context.js
  // 2. Construir prompt con buildPrompt(augmenters, ctx)
  // 3. Construir tools con engine.tools.buildAiSdkTools('myMode', ctx)
  // 4. Llamar generateText(...)
  // 5. Persistir eventos con core/runtime.js (patchAgent, recordEvent)
}

module.exports = { name: 'myMode', run };
```

Regístralo en `src/services/nmw-engine/index.js` (constructor del service)
o desde fuera con `engine.registerMode(def)`.

## Decisiones de diseño

- **Archivos cortos.** Cada augmenter, tool, mode y helper vive en su
  propio archivo. Si un archivo supera ~150-200 líneas, parte alguna pieza.
- **`run(mode, args)` como único punto de entrada.** Evita imports
  cruzados raros y permite extender modes/tools desde otros services.
- **`ctx.state` como bolsa mutable por turno.** Más simple que un emitter
  para los pocos marcadores que las tools necesitan comunicar al mode.
- **Workers como adapters.** Zyket impone que vivan en `src/workers/`;
  los dejamos minimalistas, toda la lógica está en `modes/`.
