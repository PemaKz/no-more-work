/**
 * Tabla `tasks` — unidad de trabajo del engine. Las routes encolan tasks
 * vía POST /tasks/:id/run y los workers de `nmw-engine` las procesan en
 * background (BullMQ). `parentTaskId` permite encadenar sub-tasks creadas
 * desde deliberaciones (`propose_task`).
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('tasks', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      zoneId: { type: S.UUID, allowNull: false },
      type: { type: S.STRING, allowNull: false, defaultValue: 'custom' },
      status: { type: S.STRING, allowNull: false, defaultValue: 'pending' },
      title: { type: S.STRING, allowNull: false },
      input: { type: S.JSON, allowNull: true },
      output: { type: S.JSON, allowNull: true },
      parentTaskId: { type: S.UUID, allowNull: true },
      assignedAgentId: { type: S.UUID, allowNull: true },
      errorMessage: { type: S.TEXT, allowNull: true },
      startedAt: { type: S.DATE, allowNull: true },
      finishedAt: { type: S.DATE, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('tasks', ['organizationId']);
    await queryInterface.addIndex('tasks', ['zoneId']);
    await queryInterface.addIndex('tasks', ['status']);
    await queryInterface.addIndex('tasks', ['assignedAgentId']);
    await queryInterface.addIndex('tasks', ['parentTaskId']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('tasks');
  },
};
