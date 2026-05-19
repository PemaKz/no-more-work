/**
 * Append-only log de actividad por agente. Cada vez que el engine arranca
 * o termina un tick/task/turno escribe una fila aquí. Alimenta el
 * timeline del AgentDialog en el frontend.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('agent_events', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      agentId: { type: S.UUID, allowNull: false },
      zoneId: { type: S.UUID, allowNull: true },
      kind: { type: S.STRING, allowNull: false },
      summary: { type: S.STRING, allowNull: false },
      detail: { type: S.JSON, allowNull: true },
      taskId: { type: S.UUID, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('agent_events', ['agentId', 'createdAt']);
    await queryInterface.addIndex('agent_events', ['organizationId', 'createdAt']);
    await queryInterface.addIndex('agent_events', ['taskId']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('agent_events');
  },
};
