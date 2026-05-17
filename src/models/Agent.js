module.exports = ({ sequelize, Sequelize }) => {
  const Agent = sequelize.define(
    'Agent',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      // Denormalizado para queries org-scoped sin hacer JOIN.
      organizationId: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      // Estado runtime (visual): idle | working | success | warning | error
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'idle',
      },
      // Posición LOCAL dentro de su zona (no world coords).
      x: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      y: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'agents',
      indexes: [
        { fields: ['zoneId'] },
        { fields: ['organizationId'] },
      ],
    }
  );

  Agent.associate = (models) => {
    Agent.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
  };

  return Agent;
};
