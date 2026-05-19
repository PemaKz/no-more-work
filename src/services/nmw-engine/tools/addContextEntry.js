const { z } = require('zod');
const { emitToOrg } = require('../../../utils/realtime');

module.exports = {
  name: 'add_context_entry',
  description:
    'Añade una entrada al log auditable. Úsalo para registrar insights, decisiones, observaciones o memos relevantes.',
  schema: z.object({
    kind: z.enum(['insight', 'decision', 'observation', 'memo']),
    content: z.string(),
    scope: z.enum(['org', 'zone']).default('zone'),
  }),
  availableIn: ['tick', 'task', 'deliberation'],
  async execute({ args, ctx }) {
    const { ContextEntry } = ctx.container.get('database').models;
    const entry = await ContextEntry.create({
      organizationId: ctx.agent.organizationId,
      scope: args.scope,
      scopeId:
        args.scope === 'zone' ? ctx.zone.id : ctx.agent.organizationId,
      sourceType: 'agent',
      sourceId: ctx.agent.id,
      kind: args.kind,
      content: args.content,
      sourceTaskId: ctx.task?.id || null,
    });
    emitToOrg(
      ctx.container,
      ctx.agent.organizationId,
      'context-entry:created',
      entry.toJSON()
    );
    return { id: entry.id, ok: true };
  },
};
