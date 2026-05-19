/**
 * Crea la tabla `agents`. Cada agente vive en una zona y ejecuta el
 * engine (ver `src/services/nmw-engine/`). `isSystem=true` marca agentes
 * creados y mantenidos por el sistema (p. ej. el coordinador del
 * orquestador), configurables pero no eliminables.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('agents', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      zoneId: { type: S.UUID, allowNull: false },
      organizationId: { type: S.STRING, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      description: { type: S.TEXT, allowNull: true },
      status: { type: S.STRING, allowNull: false, defaultValue: 'idle' },
      x: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      y: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      providerId: { type: S.UUID, allowNull: true },
      systemPrompt: { type: S.TEXT, allowNull: true },
      loopEnabled: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      loopIntervalSec: { type: S.INTEGER, allowNull: false, defaultValue: 300 },
      role: { type: S.STRING, allowNull: true },
      lastTickAt: { type: S.DATE, allowNull: true },
      currentTaskId: { type: S.UUID, allowNull: true },
      currentActivity: { type: S.STRING, allowNull: true },
      isSystem: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('agents', ['zoneId']);
    await queryInterface.addIndex('agents', ['organizationId']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('agents');
  },
};
