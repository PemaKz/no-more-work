const { Route } = require('zyket');
const AuthMiddleware = require('../../../middlewares/auth');

const QUEUE_NAME = 'task-process';

module.exports = class TaskRunRoute extends Route {
  middlewares = {
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async post({ container, request }) {
    const { Task } = container.get('database').models;
    const id = request.params.id;
    const orgId = request.activeOrganizationId;

    const task = await Task.findOne({
      where: { id, organizationId: orgId },
    });
    if (!task) {
      return { status: 404, success: false, message: 'Task not found' };
    }
    if (['running', 'done', 'cancelled'].includes(task.status)) {
      return {
        status: 400,
        success: false,
        message: `Task ya está ${task.status}`,
      };
    }

    // Preferir queue (BullMQ) si está disponible; fallback a in-process
    // fire-and-forget si por alguna razón no hay queue (Redis caído,
    // bullmq deshabilitado…).
    let queued = false;
    try {
      // El servicio BullMQ se registra como "bullmq" en el container de zyket.
      if (container.has?.('bullmq')) {
        const queues = container.get('bullmq');
        if (queues?.queues?.[QUEUE_NAME]) {
          await queues.addJob(
            QUEUE_NAME,
            'run-task',
            { taskId: task.id },
            { attempts: 1, removeOnComplete: 100, removeOnFail: 100 }
          );
          queued = true;
        }
      }
    } catch (err) {
      container
        .get('logger')
        ?.warn?.(`[tasks/run] enqueue failed, falling back: ${err.message}`);
    }

    if (!queued) {
      container
        .get('nmw-engine')
        .run('task', { taskId: task.id })
        .catch((err) => {
          container
            .get('logger')
            ?.error?.(`[nmw-engine] task ${task.id} threw: ${err.message}`);
        });
    }

    return {
      status: 202,
      task: { ...task.toJSON(), status: 'pending' },
      queued,
    };
  }
};
