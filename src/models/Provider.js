module.exports = ({ sequelize, Sequelize }) => {
  const Provider = sequelize.define(
    'Provider',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      // 'anthropic' | 'openai' | 'openai_compatible' (ollama, vllm, litellm…)
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'anthropic',
      },
      // Solo se usa para `openai_compatible` (p.ej. http://localhost:11434/v1)
      baseURL: { type: Sequelize.STRING, allowNull: true },
      // Modelo por defecto (p.ej. 'claude-sonnet-4-5', 'gpt-4o', 'llama3.1:8b')
      defaultModel: { type: Sequelize.STRING, allowNull: false },
      // Referencia a OrgSecret. El valor real se resuelve en runtime
      // (decrypt at-rest) y nunca viaja al cliente. Null = sin auth
      // (algunas instancias self-hosted no piden API key).
      apiKeySecretId: { type: Sequelize.UUID, allowNull: true },
    },
    {
      tableName: 'providers',
      indexes: [{ fields: ['organizationId'] }],
    }
  );

  return Provider;
};
