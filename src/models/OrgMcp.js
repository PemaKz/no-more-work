module.exports = ({ sequelize, Sequelize }) => {
  const OrgMcp = sequelize.define(
    'OrgMcp',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      transport: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'stdio',
      },
      command: { type: Sequelize.STRING, allowNull: true },
      args: { type: Sequelize.JSON, allowNull: true },
      env: { type: Sequelize.JSON, allowNull: true },
      url: { type: Sequelize.STRING, allowNull: true },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'org_mcps',
      indexes: [{ fields: ['organizationId'] }],
    }
  );

  return OrgMcp;
};
