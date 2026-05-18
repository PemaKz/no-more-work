module.exports = ({ sequelize, Sequelize }) => {
  const ContextEntry = sequelize.define(
    'ContextEntry',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      // 'org' | 'zone'
      scope: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'zone',
      },
      // organizationId si scope='org', zone.id si scope='zone'
      scopeId: { type: Sequelize.STRING, allowNull: false },
      // 'user' | 'agent' | 'system'
      sourceType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'system',
      },
      // userId o agentId según sourceType
      sourceId: { type: Sequelize.STRING, allowNull: true },
      // 'insight' | 'decision' | 'observation' | 'memo'
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'observation',
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: true },
      // pin = el usuario quiere que sobreviva. Auto-prune evitará pinned.
      pinned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Task que originó esta entrada (si fue producto de ejecución LLM).
      sourceTaskId: { type: Sequelize.UUID, allowNull: true },
    },
    {
      tableName: 'context_entries',
      indexes: [
        { fields: ['organizationId'] },
        { fields: ['scope', 'scopeId'] },
        { fields: ['pinned'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return ContextEntry;
};
