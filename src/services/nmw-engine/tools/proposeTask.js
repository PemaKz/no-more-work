const { z } = require('zod');
const { emitToOrg } = require('../../../utils/realtime');

module.exports = {
  name: 'propose_task',
  description:
    'Propone una task accionable para una zona estándar. Se crea como sub-task de esta deliberación (parentTaskId).',
  schema: z.object({
    zoneName: z
      .string()
      .describe('Nombre exacto de la zona destino (de las listadas)'),
    title: z.string().describe('Título corto y accionable'),
    type: z.enum(['custom', 'objective', 'incident']).default('objective'),
    input: z.any().optional().describe('Payload opcional con detalles'),
  }),
  availableIn: ['deliberation'],
  async execute({ args, ctx }) {
    const target = (ctx.otherZones || []).find(
      (z) => z.name.toLowerCase() === args.zoneName.toLowerCase()
    );
    if (!target) {
      const list = (ctx.otherZones || []).map((z) => z.name).join(', ');
      return { error: `Zona "${args.zoneName}" no encontrada. Disponibles: ${list}` };
    }
    const { Task } = ctx.container.get('database').models;
    const created = await Task.create({
      organizationId: ctx.task.organizationId,
      zoneId: target.id,
      type: args.type,
      status: 'pending',
      title: args.title,
      input: args.input ?? null,
      parentTaskId: ctx.task.id,
    });
    emitToOrg(
      ctx.container,
      ctx.task.organizationId,
      'task:created',
      created.toJSON()
    );
    ctx.state.createdTasks ??= [];
    ctx.state.createdTasks.push({
      id: created.id,
      zoneName: target.name,
      title: args.title,
      proposedBy: ctx.agent.name,
    });
    return { id: created.id, ok: true };
  },
};
