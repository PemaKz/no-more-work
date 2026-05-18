const { Worker } = require('zyket');
const { runAgentTick } = require('../engine/runAgentTick');

/**
 * Worker para la queue `agent-tick`. Cada job representa un tick del loop
 * autónomo de un agente concreto, encolado por el scheduler periódico.
 */
module.exports = class AgentTickWorker extends Worker {
  queueName = 'agent-tick';

  async handle({ container, job }) {
    const { agentId } = job.data || {};
    if (!agentId) return { skipped: 'no-agent-id' };

    const result = await runAgentTick(agentId, container);
    return result;
  }
};
