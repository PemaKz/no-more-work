const { Worker } = require('zyket');

/**
 * Adapter del worker para la queue `agent-tick`. La lógica vive en
 * `src/services/nmw-engine/modes/tick.js`. Este archivo existe porque
 * zyket auto-carga workers SOLO desde `src/workers/`.
 */
module.exports = class AgentTickWorker extends Worker {
  queueName = 'agent-tick';

  async handle({ container, job }) {
    const { agentId } = job.data || {};
    if (!agentId) return { skipped: 'no-agent-id' };
    return container.get('nmw-engine').run('tick', { agentId });
  }
};
