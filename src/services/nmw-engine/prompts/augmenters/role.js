module.exports = function role(ctx) {
  return ctx.agent.role ? `Rol: ${ctx.agent.role}.` : null;
};
