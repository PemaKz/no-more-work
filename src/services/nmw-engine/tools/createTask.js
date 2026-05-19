const { z } = require('zod');
const { emitToOrg } = require('../../../utils/realtime');

module.exports = {
  name: 'create_task',
  description:
    'Crea una task concreta en la zona del agente. Solo cuando hay trabajo identificable y accionable.',
  schema: z.object({
    title: z.string().describe('Título corto, accionable'),
    type: z.enum(['custom', 'objective', 'incident']).default('custom'),
    input: z.any().optional().describe('Payload opcional con detalles'),
  }),
  availableIn: ['tick'],
  async execute({ args, ctx }) {
    const { Task } = ctx.container.get('database').models;
    const task = await Task.create({
      organizationId: ctx.agent.organizationId,
      zoneId: ctx.zone.id,
      type: args.type,
      status: 'pending',
      title: args.title,
      input: args.input ?? null,
    });
    emitToOrg(
      ctx.container,
      ctx.agent.organizationId,
      'task:created',
      task.toJSON()
    );
    return { id: task.id, ok: true };
  },
};
