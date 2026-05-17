module.exports = ({ sequelize, Sequelize }) => {
  const OrgSkill = sequelize.define(
    'OrgSkill',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'org_skills',
      indexes: [{ fields: ['organizationId'] }],
    }
  );

  return OrgSkill;
};
