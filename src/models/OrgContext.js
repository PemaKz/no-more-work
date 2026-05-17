module.exports = ({ sequelize, Sequelize }) => {
  const OrgContext = sequelize.define(
    'OrgContext',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: false },
      order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'org_contexts',
      indexes: [{ fields: ['organizationId'] }],
    }
  );

  return OrgContext;
};
