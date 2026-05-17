module.exports = ({ sequelize, Sequelize }) => {
  const ZoneSkill = sequelize.define(
    'ZoneSkill',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'zone_skills',
      indexes: [{ fields: ['zoneId'] }],
    }
  );

  ZoneSkill.associate = (models) => {
    ZoneSkill.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
  };

  return ZoneSkill;
};
