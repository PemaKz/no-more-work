module.exports = ({ sequelize, Sequelize }) => {
  const Task = sequelize.define(
    'Task',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      // 'incident' | 'tick' | 'objective' | 'deliberation' | 'custom'
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'custom',
      },
      // 'pending' | 'running' | 'done' | 'cancelled' | 'error'
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      input: { type: Sequelize.JSON, allowNull: true },
      output: { type: Sequelize.JSON, allowNull: true },
      // Para encadenar tasks (delegación, sub-tasks…). Sin FK formal para
      // simplicidad — referencia lógica.
      parentTaskId: { type: Sequelize.UUID, allowNull: true },
      // Agente que la ejecuta. Null = sin asignar, el scheduler decide.
      assignedAgentId: { type: Sequelize.UUID, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      finishedAt: { type: Sequelize.DATE, allowNull: true },
    },
    {
      tableName: 'tasks',
      indexes: [
        { fields: ['organizationId'] },
        { fields: ['zoneId'] },
        { fields: ['status'] },
        { fields: ['assignedAgentId'] },
        { fields: ['parentTaskId'] },
      ],
    }
  );

  Task.associate = (models) => {
    Task.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
    Task.belongsTo(models.Agent, {
      foreignKey: 'assignedAgentId',
      as: 'assignedAgent',
    });
  };

  return Task;
};
