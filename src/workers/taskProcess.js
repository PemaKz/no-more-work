const { Worker } = require('zyket');
const { runTask } = require('../engine/runTask');

/**
 * Worker para la queue `task-process`. Procesa tasks encoladas vía
 * `POST /tasks/:id/run`. Aísla la ejecución LLM del request HTTP — el
 * cliente recibe respuesta inmediata y el progreso llega por socket.
 */
module.exports = class TaskProcessWorker extends Worker {
  queueName = 'task-process';

  async handle({ container, job }) {
    const { taskId } = job.data || {};
    if (!taskId) return { skipped: 'no-task-id' };

    await runTask(taskId, container);
    return { ok: true };
  }
};
