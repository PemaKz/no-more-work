/**
 * Recursos a nivel ZONA — escopados a una zona concreta. Son el
 * equivalente local de `org_*`: cuando un agente arranca, recibe la
 * unión de los recursos org + los de su zona.
 *
 *   - zone_contexts: bloques de contexto específicos de la zona.
 *   - zone_mcps:     servidores MCP solo para esta zona.
 *   - zone_skills:   capacidades extra solo para esta zona.
 *   - zone_secrets:  API keys/tokens cifrados, locales a la zona.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;

    await queryInterface.createTable('zone_contexts', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      zoneId: { type: S.UUID, allowNull: false },
      title: { type: S.STRING, allowNull: true },
      content: { type: S.TEXT, allowNull: false },
      order: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('zone_contexts', ['zoneId']);

    await queryInterface.createTable('zone_mcps', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      zoneId: { type: S.UUID, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      transport: { type: S.STRING, allowNull: false, defaultValue: 'stdio' },
      command: { type: S.STRING, allowNull: true },
      args: { type: S.JSON, allowNull: true },
      env: { type: S.JSON, allowNull: true },
      url: { type: S.STRING, allowNull: true },
      enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('zone_mcps', ['zoneId']);

    await queryInterface.createTable('zone_skills', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      zoneId: { type: S.UUID, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      description: { type: S.TEXT, allowNull: true },
      enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('zone_skills', ['zoneId']);

    await queryInterface.createTable('zone_secrets', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      zoneId: { type: S.UUID, allowNull: false },
      key: { type: S.STRING, allowNull: false },
      valueEncrypted: { type: S.TEXT, allowNull: true },
      description: { type: S.TEXT, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('zone_secrets', ['zoneId']);
    await queryInterface.addIndex('zone_secrets', ['zoneId', 'key'], {
      unique: true,
    });
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('zone_secrets');
    await queryInterface.dropTable('zone_skills');
    await queryInterface.dropTable('zone_mcps');
    await queryInterface.dropTable('zone_contexts');
  },
};
