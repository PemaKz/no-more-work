module.exports = ({ sequelize, Sequelize }) => {
  const ZoneSecret = sequelize.define(
    'ZoneSecret',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      key: { type: Sequelize.STRING, allowNull: false },
      valueEncrypted: { type: Sequelize.TEXT, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
    },
    {
      tableName: 'zone_secrets',
      indexes: [
        { fields: ['zoneId'] },
        { fields: ['zoneId', 'key'], unique: true },
      ],
    }
  );

  ZoneSecret.associate = (models) => {
    ZoneSecret.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
  };

  return ZoneSecret;
};
