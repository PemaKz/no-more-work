module.exports = ({ sequelize, Sequelize }) => {
  const ZoneContext = sequelize.define(
    'ZoneContext',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: false },
      order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'zone_contexts',
      indexes: [{ fields: ['zoneId'] }],
    }
  );

  ZoneContext.associate = (models) => {
    ZoneContext.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
  };

  return ZoneContext;
};
