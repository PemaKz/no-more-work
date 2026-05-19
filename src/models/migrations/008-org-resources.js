/**
 * Recursos a nivel ORGANIZACIÓN — heredados por todas las zonas/agentes.
 *   - org_contexts: bloques de contexto que se inyectan al system prompt.
 *   - org_mcps:     servidores MCP disponibles globalmente.
 *   - org_skills:   capacidades nombradas que los agentes pueden invocar.
 *   - org_secrets:  API keys y similares, cifradas at-rest (AES-256-GCM).
 *
 * Agrupados aquí porque comparten dominio y patrón (4 catálogos
 * "por organización"). Si crece la complejidad de cualquiera, sácalo a
 * su propia migración.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;

    await queryInterface.createTable('org_contexts', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      title: { type: S.STRING, allowNull: true },
      content: { type: S.TEXT, allowNull: false },
      order: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('org_contexts', ['organizationId']);

    await queryInterface.createTable('org_mcps', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
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
    await queryInterface.addIndex('org_mcps', ['organizationId']);

    await queryInterface.createTable('org_skills', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      description: { type: S.TEXT, allowNull: true },
      enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('org_skills', ['organizationId']);

    await queryInterface.createTable('org_secrets', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      key: { type: S.STRING, allowNull: false },
      valueEncrypted: { type: S.TEXT, allowNull: true },
      description: { type: S.TEXT, allowNull: true },
      internal: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('org_secrets', ['organizationId']);
    await queryInterface.addIndex('org_secrets', ['organizationId', 'key'], {
      unique: true,
    });
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('org_secrets');
    await queryInterface.dropTable('org_skills');
    await queryInterface.dropTable('org_mcps');
    await queryInterface.dropTable('org_contexts');
  },
};
