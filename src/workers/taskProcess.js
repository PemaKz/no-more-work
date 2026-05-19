const { Worker } = require('zyket');

/**
 * Adapter del worker para la queue `task-process`. La lógica vive en
 * `src/services/nmw-engine/modes/task.js`. Este archivo existe porque
 * zyket auto-carga workers SOLO desde `src/workers/`.
 */
module.exports = class TaskProcessWorker extends Worker {
  queueName = 'task-process';

  async handle({ container, job }) {
    const { taskId } = job.data || {};
    if (!taskId) return { skipped: 'no-task-id' };
    await container.get('nmw-engine').run('task', { taskId });
    return { ok: true };
  }
};
