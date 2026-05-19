/**
 * Scheduler de agentes: gestiona repeatable jobs en la queue `agent-tick`
 * vía BullMQ Job Schedulers (v5+).
 *
 * Cada agente con `loopEnabled=true` tiene su propio scheduler con id
 * `agent-tick-<agentId>` y un interval definido por `loopIntervalSec`.
 *
 * Uso desde routes:
 *   const eng = container.get('nmw-engine');
 *   await eng.scheduler.upsert(agent, { immediate: true });
 *   await eng.scheduler.remove(agentId);
 *
 * Al boot del service se llama a `init()` para reconciliar Redis con la
 * BD tras un restart.
 */

const QUEUE_NAME = 'agent-tick';
const MIN_INTERVAL_SEC = 30;
const DEFAULT_INTERVAL_SEC = 300;

function jobSchedulerId(agentId) {
  return `agent-tick-${agentId}`;
}

class Scheduler {
  #container;
  constructor(container) {
    this.#container = container;
  }

  #getQueue() {
    try {
      const has =
        typeof this.#container?.has === 'function'
          ? this.#container.has('bullmq')
          : true;
      if (!has) return null;
      const svc = this.#container.get('bullmq');
      return svc?.queues?.[QUEUE_NAME] || null;
    } catch {
      return null;
    }
  }

  async upsert(agent, { immediate = false } = {}) {
    const queue = this.#getQueue();
    if (!queue || !agent?.id) return;

    if (!agent.loopEnabled) {
      return this.remove(agent.id);
    }

    const intervalMs =
      Math.max(MIN_INTERVAL_SEC, agent.loopIntervalSec || DEFAULT_INTERVAL_SEC) *
      1000;
    const id = jobSchedulerId(agent.id);
    const data = { agentId: agent.id, organizationId: agent.organizationId };
    const opts = { removeOnComplete: 50, removeOnFail: 50, attempts: 1 };

    try {
      await queue.upsertJobScheduler(
        id,
        { every: intervalMs },
        { name: 'tick', data, opts }
      );
      // BullMQ con `every` espera intervalMs antes del PRIMER run del
      // scheduler. Sin esto, al activar un loop con interval grande no pasa
      // nada visible durante minutos. Encolamos uno inmediato extra (solo
      // en upserts manuales — init() pasa immediate=false para no spammear).
      if (immediate) {
        await queue.add('tick', data, opts);
      }
    } catch (err) {
      this.#container
        .get('logger')
        ?.warn?.(`[nmw-engine][scheduler] upsert ${id} failed: ${err.message}`);
    }
  }

  async remove(agentId) {
    const queue = this.#getQueue();
    if (!queue || !agentId) return;
    try {
      await queue.removeJobScheduler(jobSchedulerId(agentId));
    } catch {
      // no existía — ok
    }
  }

  /**
   * Reconciliar Redis con la BD al boot. Recorre todos los agentes
   * loopEnabled y vuelve a programar su scheduler (sin immediate).
   */
  async init() {
    const queue = this.#getQueue();
    const logger = this.#container.get('logger');
    if (!queue) {
      logger?.warn?.('[nmw-engine][scheduler] queue agent-tick no disponible — loops desactivados');
      return;
    }
    const { Agent } = this.#container.get('database').models;
    const agents = await Agent.findAll({
      where: { loopEnabled: true },
      attributes: ['id', 'organizationId', 'loopIntervalSec'],
    });
    for (const a of agents) {
      await this.upsert(a);
    }
    logger.info(`[nmw-engine][scheduler] ${agents.length} agent loops scheduled`);
  }
}

module.exports = { Scheduler, QUEUE_NAME };
