const { z } = require('zod');

module.exports = {
  name: 'end_tick',
  description:
    'Termina el tick sin acciones. Llámalo si no hay nada útil que hacer ahora mismo.',
  schema: z.object({
    reason: z.string().optional(),
  }),
  availableIn: ['tick'],
  async execute({ args, ctx }) {
    ctx.state.ended = true;
    return { ok: true, reason: args.reason || 'nothing-to-do' };
  },
};
