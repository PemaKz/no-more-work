const { z } = require('zod');

module.exports = {
  name: 'pass_turn',
  description:
    'Pasa tu turno sin acciones. Úsalo si no tienes nada que añadir a lo ya dicho.',
  schema: z.object({
    reason: z.string().optional(),
  }),
  availableIn: ['deliberation'],
  async execute({ args, ctx }) {
    ctx.state.passed = true;
    return { ok: true, reason: args.reason || 'nothing-to-add' };
  },
};
