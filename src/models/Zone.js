module.exports = ({ sequelize, Sequelize }) => {
  const Zone = sequelize.define(
    'Zone',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Categoría libre de la zona. Los 6 presets visuales son
      // research | build | trade | monitor | security | comms.
      // Cualquier otro string es válido (tipo custom).
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'research',
      },
      // Color hex (#rrggbb) usado para renderizar la zona en el mapa.
      // Si es null, el renderer cae a la paleta por defecto según `type`.
      color: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      // 'standard' (default) o 'controller' (zona orquestador/dios; única
      // por organización, no se puede eliminar).
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'standard',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      x: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      y: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 480 },
      height: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 320 },
    },
    {
      tableName: 'zones',
      indexes: [{ fields: ['organizationId'] }],
    }
  );

  Zone.associate = (models) => {
    Zone.hasMany(models.ZoneContext, {
      foreignKey: 'zoneId',
      as: 'contexts',
      onDelete: 'CASCADE',
    });
    Zone.hasMany(models.ZoneMcp, {
      foreignKey: 'zoneId',
      as: 'mcps',
      onDelete: 'CASCADE',
    });
    Zone.hasMany(models.ZoneSkill, {
      foreignKey: 'zoneId',
      as: 'skills',
      onDelete: 'CASCADE',
    });
    Zone.hasMany(models.ZoneSecret, {
      foreignKey: 'zoneId',
      as: 'secrets',
      onDelete: 'CASCADE',
    });
    Zone.hasMany(models.Agent, {
      foreignKey: 'zoneId',
      as: 'agents',
      onDelete: 'CASCADE',
    });
  };

  return Zone;
};
