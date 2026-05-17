module.exports = ({ sequelize, Sequelize }) => {
  const ZoneMcp = sequelize.define(
    'ZoneMcp',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      // 'stdio' | 'http' | 'sse'
      transport: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'stdio',
      },
      // Para stdio
      command: { type: Sequelize.STRING, allowNull: true },
      args: { type: Sequelize.JSON, allowNull: true },
      env: { type: Sequelize.JSON, allowNull: true },
      // Para http/sse
      url: { type: Sequelize.STRING, allowNull: true },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'zone_mcps',
      indexes: [{ fields: ['zoneId'] }],
    }
  );

  ZoneMcp.associate = (models) => {
    ZoneMcp.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
  };

  return ZoneMcp;
};
