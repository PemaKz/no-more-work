const { generateText, tool, stepCountIs } = require('ai');
const { z } = require('zod');
const { getLLM } = require('./llm');
const { emitToOrg } = require('../utils/realtime');
const {
  patchAgentRuntime,
  recordAgentEvent,
  summarizeToolCalls,
} = require('./agentRuntime');

const MAX_STEPS_PER_TURN = 4;
const RECENT_ENTRIES_LIMIT = 20;

// Orden semántico: planner abre, critic cuestiona, executor traduce a tasks,
// facilitator cierra. Roles desconocidos van al final por nombre.
const ROLE_ORDER = {
  planner: 0,
  critic: 1,
  executor: 2,
  facilitator: 3,
};

function sortAgents(agents) {
  return [...agents].sort((a, b) => {
    const ra = ROLE_ORDER[(a.role || '').toLowerCase()] ?? 99;
    const rb = ROLE_ORDER[(b.role || '').toLowerCase()] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function buildSystemPrompt(agent, zone, otherZones, recentEntries) {
  const parts = [];
  parts.push(
    agent.systemPrompt ||
      `Eres ${agent.name}, agente orquestador de la zona "${zone.name}".`
  );
  if (agent.role) parts.push(`Rol asignado: ${agent.role}.`);

  parts.push(
    'Participas en una DELIBERACIÓN colectiva con el resto de agentes orquestadores. ' +
      'Vuestro objetivo es decidir próximos pasos y repartir trabajo en forma de tasks ' +
      'concretas a las zonas disponibles.'
  );

  if (otherZones.length) {
    parts.push(
      '── Zonas disponibles para delegar ──\n' +
        otherZones
          .map((z) => `• ${z.name}  (tipo: ${z.type})`)
          .join('\n')
    );
  } else {
    parts.push(
      'No hay zonas estándar todavía — limítate a registrar contexto o pasar el turno.'
    );
  }

  if (recentEntries.length) {
    parts.push(
      '── Contexto reciente (★ = pinned) ──\n' +
        recentEntries
          .map(
            (e) =>
              `${e.pinned ? '★ ' : '  '}[${e.kind}] ${e.content.slice(0, 220)}`
          )
          .join('\n')
    );
  }

  parts.push(
    'En tu turno, elige UNA o varias herramientas:',
    '  • propose_task — crea una task accionable en una zona concreta',
    '  • add_context_entry — registra una decisión/insight para el equipo',
    '  • pass_turn — no añades valor sobre lo dicho',
    'Sé conciso. No repitas lo que otros ya dijeron — complementa o discrepa.'
  );

  return parts.join('\n\n');
}

function buildUserPrompt(task, contributions) {
  const parts = [`Deliberación: ${task.title}`];
  if (task.input) {
    parts.push(`Input:\n\`\`\`json\n${JSON.stringify(task.input, null, 2)}\n\`\`\``);
  }
  if (contributions.length === 0) {
    parts.push('Eres el PRIMER agente en hablar. Marca el tono.');
  } else {
    parts.push(
      `Contribuciones previas (${contributions.length}):\n` +
        contributions
          .map((c) => {
            const tag = `→ ${c.agent}${c.role ? ` (${c.role})` : ''}`;
            if (c.error) return `${tag}: [error: ${c.error}]`;
            if (c.passed) return `${tag}: [pass]`;
            const txt = (c.text || '').trim() || '[sin texto]';
            return `${tag}:\n${txt}`;
          })
          .join('\n\n')
    );
  }
  return parts.join('\n\n');
}

/**
 * Ejecuta una task de tipo `deliberation`. Solo válido en la zona
 * controladora. Hace un round-robin secuencial por todos los agentes
 * orquestadores con provider asignado, ordenados por rol semántico
 * (planner → critic → executor → facilitator → resto).
 *
 * Cada agente puede:
 *   - proponer tasks para otras zonas (auto-encadenadas como sub-tasks)
 *   - añadir entradas al log (decisiones/insights del equipo)
 *   - pasar turno si no aporta
 *
 * El output de la task de deliberación incluye todas las contribuciones
 * y las tasks creadas, para auditoría.
 */
async function runDeliberation(taskId, container) {
  const db = container.get('database');
  const { Sequelize } = db;
  const { Task, Agent, Zone, Provider, ContextEntry } = db.models;
  const logger = container.get('logger');

  const task = await Task.findByPk(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (['done', 'cancelled', 'error'].includes(task.status)) return task;

  await task.update({
    status: 'running',
    startedAt: task.startedAt || new Date(),
    errorMessage: null,
  });
  emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());

  try {
    const zone = await Zone.findByPk(task.zoneId);
    if (!zone) throw new Error('Zone not found');
    if (zone.kind !== 'controller') {
      throw new Error(
        'Las deliberaciones solo pueden ejecutarse en la zona orquestadora'
      );
    }

    const agents = sortAgents(
      await Agent.findAll({
        where: {
          zoneId: zone.id,
          organizationId: task.organizationId,
          providerId: { [Sequelize.Op.not]: null },
        },
      })
    );
    if (agents.length === 0) {
      throw new Error('Sin agentes con provider en el orquestador');
    }

    const otherZones = await Zone.findAll({
      where: {
        organizationId: task.organizationId,
        kind: 'standard',
      },
      attributes: ['id', 'name', 'type'],
    });

    const recentEntries = await ContextEntry.findAll({
      where: {
        organizationId: task.organizationId,
        [Sequelize.Op.or]: [
          { scope: 'org', scopeId: task.organizationId },
          { scope: 'zone', scopeId: zone.id },
        ],
      },
      order: [
        ['pinned', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit: RECENT_ENTRIES_LIMIT,
    });

    const contributions = [];
    const createdTasks = [];

    for (const agent of agents) {
      logger?.info?.(
        `[deliberation ${task.id.slice(0, 8)}] turn → ${agent.name} (${agent.role || 'miembro'})`
      );

      const provider = await Provider.findByPk(agent.providerId);
      if (!provider) {
        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          error: 'provider not found',
        });
        continue;
      }

      let passed = false;
      const tools = {
        add_context_entry: tool({
          description:
            'Añade entrada al log auditable visible al equipo (decisión, insight, observación, memo).',
          inputSchema: z.object({
            kind: z.enum(['insight', 'decision', 'observation', 'memo']),
            content: z.string(),
            scope: z.enum(['org', 'zone']).default('org'),
          }),
          execute: async ({ kind, content, scope }) => {
            const entry = await ContextEntry.create({
              organizationId: task.organizationId,
              scope,
              scopeId: scope === 'zone' ? zone.id : task.organizationId,
              sourceType: 'agent',
              sourceId: agent.id,
              kind,
              content,
              sourceTaskId: task.id,
            });
            emitToOrg(
              container,
              task.organizationId,
              'context-entry:created',
              entry.toJSON()
            );
            return { id: entry.id, ok: true };
          },
        }),

        propose_task: tool({
          description:
            'Propone una task accionable para una zona estándar. Se crea como sub-task de esta deliberación (parentTaskId).',
          inputSchema: z.object({
            zoneName: z
              .string()
              .describe('Nombre exacto de la zona destino (de las listadas)'),
            title: z.string().describe('Título corto y accionable'),
            type: z
              .enum(['custom', 'objective', 'incident'])
              .default('objective'),
            input: z
              .any()
              .optional()
              .describe('Payload opcional con detalles'),
          }),
          execute: async ({ zoneName, title, type, input }) => {
            const target = otherZones.find(
              (z) => z.name.toLowerCase() === zoneName.toLowerCase()
            );
            if (!target) {
              return {
                error: `Zona "${zoneName}" no encontrada. Zonas disponibles: ${otherZones
                  .map((z) => z.name)
                  .join(', ')}`,
              };
            }
            const created = await Task.create({
              organizationId: task.organizationId,
              zoneId: target.id,
              type,
              status: 'pending',
              title,
              input: input ?? null,
              parentTaskId: task.id,
            });
            emitToOrg(
              container,
              task.organizationId,
              'task:created',
              created.toJSON()
            );
            createdTasks.push({
              id: created.id,
              zoneName: target.name,
              title,
              proposedBy: agent.name,
            });
            return { id: created.id, ok: true };
          },
        }),

        pass_turn: tool({
          description:
            'Pasa tu turno sin acciones. Úsalo si no tienes nada que añadir a lo ya dicho.',
          inputSchema: z.object({
            reason: z.string().optional(),
          }),
          execute: async ({ reason }) => {
            passed = true;
            return { ok: true, reason: reason || 'nothing-to-add' };
          },
        }),
      };

      // Mientras este agente delibera, lo marcamos working con el título
      // de la deliberación; al pasar el turno o fallar lo soltamos.
      await patchAgentRuntime(container, agent, {
        status: 'working',
        currentActivity: `Deliberando: ${task.title}`.slice(0, 120),
        currentTaskId: task.id,
      });

      try {
        const llm = await getLLM(provider, container);
        const systemPrompt = buildSystemPrompt(
          agent,
          zone,
          otherZones,
          recentEntries
        );
        const userPrompt = buildUserPrompt(task, contributions);

        const result = await generateText({
          model: llm,
          system: systemPrompt,
          prompt: userPrompt,
          tools,
          stopWhen: stepCountIs(MAX_STEPS_PER_TURN),
        });

        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          text: result.text || '',
          passed,
        });
        await patchAgentRuntime(container, agent, {
          status: 'idle',
          currentActivity: null,
          currentTaskId: null,
        });

        const toolCalls = summarizeToolCalls(result.steps);
        const summary = passed
          ? `Deliberación: pasó turno`
          : toolCalls.length
            ? `Deliberación → ${toolCalls.join(', ')}`.slice(0, 240)
            : `Deliberación: aportó texto`;
        await recordAgentEvent(container, {
          agent,
          kind: 'deliberation_turn',
          summary,
          taskId: task.id,
          detail: {
            text: (result.text || '').slice(0, 2000),
            toolCalls,
            steps: Array.isArray(result.steps) ? result.steps.length : 0,
            passed,
          },
        });
      } catch (err) {
        contributions.push({
          agent: agent.name,
          role: agent.role || null,
          error: err.message,
        });
        logger?.warn?.(
          `[deliberation] ${agent.name} falló: ${err.message}`
        );
        await patchAgentRuntime(container, agent, {
          status: 'error',
          currentActivity: null,
          currentTaskId: null,
        });
        await recordAgentEvent(container, {
          agent,
          kind: 'deliberation_error',
          summary: `Error deliberando: ${err.message}`.slice(0, 240),
          taskId: task.id,
          detail: { error: err.message },
        });
      }
    }

    await task.update({
      status: 'done',
      output: {
        summary: `Deliberación entre ${agents.length} agente(s); ${createdTasks.length} task(s) propuestas.`,
        contributions,
        createdTasks,
      },
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());

    return task;
  } catch (err) {
    await task.update({
      status: 'error',
      errorMessage: err.message,
      finishedAt: new Date(),
    });
    emitToOrg(container, task.organizationId, 'task:updated', task.toJSON());
    logger?.error?.(
      `[deliberation] task ${taskId} failed: ${err.message}`
    );
    return task;
  }
}

module.exports = { runDeliberation };
