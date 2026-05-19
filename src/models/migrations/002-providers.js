/**
 * Crea la tabla `providers` — endpoints LLM (anthropic, openai, openai-
 * compatible) que los agentes utilizan para correr tasks y ticks. La API
 * key vive en `org_secrets` referenciada por `apiKeySecretId`.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('providers', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      kind: { type: S.STRING, allowNull: false, defaultValue: 'anthropic' },
      baseURL: { type: S.STRING, allowNull: true },
      defaultModel: { type: S.STRING, allowNull: false },
      apiKeySecretId: { type: S.UUID, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('providers', ['organizationId']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('providers');
  },
};
