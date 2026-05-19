const { z } = require('zod');
const { emitToOrg } = require('../../../utils/realtime');

module.exports = {
  name: 'complete_task',
  description:
    'Marca la task actual como completada. Llámalo cuando hayas terminado todo el trabajo.',
  schema: z.object({
    summary: z
      .string()
      .describe('Resumen breve de lo que se hizo y el resultado'),
    result: z
      .any()
      .optional()
      .describe('Datos estructurados opcionales del resultado'),
  }),
  availableIn: ['task'],
  async execute({ args, ctx }) {
    if (!ctx.task) {
      return { error: 'complete_task requiere una task en contexto' };
    }
    await ctx.task.update({
      status: 'done',
      output: { summary: args.summary, result: args.result ?? null },
      finishedAt: new Date(),
    });
    // Marker para que el mode sepa que el modelo cerró explícitamente.
    ctx.state.taskCompleted = true;
    emitToOrg(
      ctx.container,
      ctx.task.organizationId,
      'task:updated',
      ctx.task.toJSON()
    );
    return { ok: true };
  },
};
