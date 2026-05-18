/**
 * Scheduler de agentes: gestiona repeatable jobs en la queue `agent-tick`
 * vía BullMQ Job Schedulers (v5+).
 *
 * Cada agente con `loopEnabled=true` tiene su propio scheduler con id
 * `agent-tick-<agentId>` y un interval definido por `loopIntervalSec`.
 *
 * Las rutas de agents llaman a `upsertAgentSchedule` tras create/update y
 * a `removeAgentSchedule` tras delete. Al boot, `initScheduler` recorre
 * todos los agentes loopEnabled para sincronizar el estado en Redis tras
 * un restart.
 */
const QUEUE_NAME = 'agent-tick';

function getQueue(container) {
  try {
    // El servicio BullMQ de zyket se registra bajo la clave "bullmq" en el
    // container, aunque internamente su `name` sea "queues". El acceso debe
    // ser por la clave del container.
    if (typeof container?.has === 'function' && !container.has('bullmq')) {
      return null;
    }
    const svc = container.get('bullmq');
    return svc?.queues?.[QUEUE_NAME] || null;
  } catch {
    return null;
  }
}

function jobSchedulerId(agentId) {
  return `agent-tick-${agentId}`;
}

async function upsertAgentSchedule(container, agent, { immediate = false } = {}) {
  const queue = getQueue(container);
  if (!queue) return;
  if (!agent?.id) return;

  if (!agent.loopEnabled) {
    return removeAgentSchedule(container, agent.id);
  }

  const intervalMs = Math.max(30, agent.loopIntervalSec || 300) * 1000;
  const id = jobSchedulerId(agent.id);
  const data = { agentId: agent.id, organizationId: agent.organizationId };
  const opts = { removeOnComplete: 50, removeOnFail: 50, attempts: 1 };

  try {
    await queue.upsertJobScheduler(
      id,
      { every: intervalMs },
      { name: 'tick', data, opts }
    );
    // BullMQ con `every` espera `intervalMs` antes del PRIMER run del
    // scheduler. Sin esto, al activar un loop con interval grande no pasa
    // nada visible durante minutos. Encolamos uno inmediato extra (solo en
    // upserts manuales — initScheduler pasa immediate=false para no spammear
    // tokens en cada restart).
    if (immediate) {
      await queue.add('tick', data, opts);
    }
  } catch (err) {
    container
      .get('logger')
      ?.warn?.(`[scheduler] failed to upsert ${id}: ${err.message}`);
  }
}

async function removeAgentSchedule(container, agentId) {
  const queue = getQueue(container);
  if (!queue || !agentId) return;
  try {
    await queue.removeJobScheduler(jobSchedulerId(agentId));
  } catch {
    // no existía
  }
}

/**
 * Llamado al boot. Re-sincroniza los schedulers desde la BD.
 */
async function initScheduler(container) {
  const queue = getQueue(container);
  if (!queue) {
    container
      .get('logger')
      ?.warn?.('[scheduler] queue agent-tick no disponible — loops desactivados');
    return;
  }
  const { Agent } = container.get('database').models;
  const agents = await Agent.findAll({
    where: { loopEnabled: true },
    attributes: ['id', 'organizationId', 'loopIntervalSec'],
  });
  for (const a of agents) {
    await upsertAgentSchedule(container, a);
  }
  container
    .get('logger')
    .info(`[scheduler] ${agents.length} agent loops scheduled`);
}

module.exports = {
  initScheduler,
  upsertAgentSchedule,
  removeAgentSchedule,
};
