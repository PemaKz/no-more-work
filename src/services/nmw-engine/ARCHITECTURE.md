# nmw-engine — arquitectura visual

Diagramas en [Mermaid](https://mermaid.js.org/). GitHub y el preview de
Markdown de VSCode los renderizan nativamente. Para editar uno, modifica
el bloque de código directamente.

## 1. Vista de conjunto

Quién depende de quién dentro del service y desde dónde se invoca.

```mermaid
flowchart LR
  classDef ext fill:#1f2937,stroke:#374151,color:#e5e7eb
  classDef svc fill:#1e3a8a,stroke:#3b82f6,color:#dbeafe
  classDef mod fill:#064e3b,stroke:#10b981,color:#d1fae5
  classDef plain fill:#111827,stroke:#374151,color:#e5e7eb

  subgraph EXT["Exterior al service"]
    R["HTTP routes<br/>(agents, zones, tasks)"]:::ext
    W["Workers<br/>(src/workers/*)"]:::ext
    K["Kernel boot<br/>(index.js)"]:::ext
  end

  subgraph ENG["src/services/nmw-engine"]
    IDX[["index.js<br/><b>NmwEngine</b><br/>· run(mode, args)<br/>· tools<br/>· scheduler"]]:::svc

    subgraph MODES["modes/"]
      MT["tick.js"]:::mod
      MK["task.js"]:::mod
      MD["deliberation.js"]:::mod
    end

    subgraph CORE["core/"]
      CR["runtime.js<br/>patchAgent · recordEvent"]:::plain
      CP["providers.js<br/>getLLM(provider)"]:::plain
      CC["context.js<br/>loadOrg/Zone/Recent/..."]:::plain
    end

    subgraph PROMPTS["prompts/"]
      PB["build.js<br/>buildPrompt(augs, ctx)"]:::plain
      PA["augmenters/<br/>identity · role · orgContext · ..."]:::plain
    end

    subgraph TOOLS["tools/"]
      TR["registry.js<br/>ToolRegistry"]:::plain
      TL["addContextEntry · createTask<br/>completeTask · endTick<br/>proposeTask · passTurn"]:::plain
    end

    SCH["scheduler/<br/>BullMQ Job Schedulers"]:::plain
  end

  R --> IDX
  W --> IDX
  K -.boot.-> IDX

  IDX --> MODES
  MODES --> CORE
  MODES --> PROMPTS
  MODES --> TOOLS
  IDX --> SCH

  TOOLS --> TR
  TR --> TL
  PROMPTS --> PB
  PB --> PA
  CORE --> CR
  CORE --> CP
  CORE --> CC
```

## 2. Vida de un **mode** (tick / task / deliberation)

Cada mode sigue el mismo patrón: cargar estado → construir prompt →
construir toolset → llamar LLM → persistir eventos.

```mermaid
sequenceDiagram
  autonumber
  participant Caller as Worker / Route
  participant Engine as engine.run(mode, args)
  participant Mode as modes/{mode}.js
  participant Core as core/context.js
  participant Prompt as prompts/build.js
  participant Tools as tools/registry.js
  participant AI as Vercel AI SDK
  participant DB as core/runtime.js + DB

  Caller->>Engine: run('task', { taskId })
  Engine->>Mode: mode.run({ engine, container, taskId })
  Mode->>DB: cargar Task / Agent / Provider / Zone
  Mode->>Core: loadOrgContexts, loadZoneContexts, loadRecentEntries
  Core-->>Mode: arrays
  Mode->>DB: patchAgent(status='working') + recordEvent('task_start')
  Mode->>Prompt: buildPrompt(augmenters, ctx)
  Prompt-->>Mode: systemPrompt
  Mode->>Tools: buildAiSdkTools('task', ctx)
  Tools-->>Mode: { add_context_entry, complete_task, ... }
  Mode->>AI: generateText(model, system, prompt, tools, stopWhen)
  AI-->>Mode: { text, steps, toolCalls }
  Mode->>DB: cerrar task + patchAgent('success') + recordEvent('task_end')
  Mode-->>Engine: task
  Engine-->>Caller: task
```

## 3. Cómo se enruta una task desde el HTTP request

Desde que el usuario hace `POST /tasks/:id/run` hasta que el LLM corre,
con el fallback in-process si BullMQ no está disponible.

```mermaid
flowchart TB
  classDef happy fill:#064e3b,stroke:#10b981,color:#d1fae5
  classDef warn fill:#7c2d12,stroke:#f97316,color:#ffedd5
  classDef plain fill:#1e293b,stroke:#475569,color:#e2e8f0

  U["Usuario<br/>POST /tasks/:id/run"]:::plain
  RT["routes/tasks/[id]/run.js"]:::plain
  Q{"¿bullmq activo<br/>y queue ready?"}:::plain
  BQ["queue.addJob('task-process')"]:::happy
  W["src/workers/taskProcess.js<br/>adapter"]:::happy
  FB["engine.run('task', { taskId })<br/>fire-and-forget"]:::warn
  E["NmwEngine.run('task')"]:::plain
  M["modes/task.js"]:::plain

  U --> RT
  RT --> Q
  Q -- sí --> BQ --> W --> E
  Q -- no --> FB --> E
  E --> M
```

## 4. ToolRegistry — filtrado por mode

El registry guarda todas las tools registradas; al construir el toolset
para un mode concreto, sólo expone las que tienen ese mode en su
`availableIn`.

```mermaid
flowchart LR
  classDef tool fill:#1e3a8a,stroke:#3b82f6,color:#dbeafe
  classDef mode fill:#064e3b,stroke:#10b981,color:#d1fae5
  classDef reg fill:#111827,stroke:#374151,color:#e5e7eb

  subgraph REG["ToolRegistry"]
    T1["add_context_entry<br/>availableIn: tick, task, deliberation"]:::tool
    T2["create_task<br/>availableIn: tick"]:::tool
    T3["complete_task<br/>availableIn: task"]:::tool
    T4["end_tick<br/>availableIn: tick"]:::tool
    T5["propose_task<br/>availableIn: deliberation"]:::tool
    T6["pass_turn<br/>availableIn: deliberation"]:::tool
  end

  REG -.buildAiSdkTools('tick').-> TickSet["tick toolset<br/>add_context_entry<br/>create_task<br/>end_tick"]:::mode
  REG -.buildAiSdkTools('task').-> TaskSet["task toolset<br/>add_context_entry<br/>complete_task"]:::mode
  REG -.buildAiSdkTools('deliberation').-> DelibSet["deliberation toolset<br/>add_context_entry<br/>propose_task<br/>pass_turn"]:::mode
```

## 5. Anatomía de un prompt

Cada mode declara una lista de augmenters; `buildPrompt` los corre en
orden y concatena los bloques no-nulos con `\n\n`.

```mermaid
flowchart TB
  classDef aug fill:#064e3b,stroke:#10b981,color:#d1fae5
  classDef out fill:#1e3a8a,stroke:#3b82f6,color:#dbeafe
  classDef plain fill:#111827,stroke:#374151,color:#e5e7eb

  CTX["ctx (agent, zone, task?, contexts, ...)"]:::plain

  subgraph AUGS["augmenters (orden importa)"]
    direction TB
    A1["identity<br/>Eres X, agente de zona Y"]:::aug
    A2["role<br/>Rol: planner"]:::aug
    A3["instructions(mode)<br/>Decide... usa tools..."]:::aug
    A4["orgContext"]:::aug
    A5["zoneContext"]:::aug
    A6["recentEntries"]:::aug
    A7["pendingTasks / otherZones"]:::aug
  end

  CTX --> A1 --> A2 --> A3 --> A4 --> A5 --> A6 --> A7
  A7 --> P["systemPrompt = blocks.join('\\n\\n')"]:::out
```

## 6. Scheduler de ticks

`engine.scheduler` administra los repeatable jobs de BullMQ que disparan
los ticks autónomos. Las routes lo invocan en create/update/delete de
agentes.

```mermaid
sequenceDiagram
  autonumber
  participant Route as routes/agents
  participant Sched as engine.scheduler
  participant BMQ as BullMQ (Redis)
  participant Wrk as workers/agentTick.js
  participant Eng as engine.run('tick')

  Route->>Sched: upsert(agent, {immediate:true})
  Sched->>BMQ: upsertJobScheduler('agent-tick-{id}', {every: N})
  Sched->>BMQ: add('tick', ...) (extra inmediato)
  loop cada loopIntervalSec
    BMQ-->>Wrk: 'tick' job
    Wrk->>Eng: run('tick', { agentId })
  end
```

---

### Cómo regenerar / exportar a imagen estática

Si en algún momento necesitas un PNG/SVG en lugar del bloque Mermaid:

- **VSCode**: instala *Markdown Preview Mermaid Support* y haz screenshot
  desde el preview (rápido y suficiente para presentaciones).
- **CLI**: `npx -p @mermaid-js/mermaid-cli mmdc -i ARCHITECTURE.md -o
  diagram.svg` (requiere Chromium).
- **Online**: pega el bloque en <https://mermaid.live> y descarga.

Mantener los diagramas como Mermaid en el repo permite que evolucionen
con el código sin que se queden obsoletos.
