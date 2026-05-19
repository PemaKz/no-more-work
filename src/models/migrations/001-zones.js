/**
 * Crea la tabla `zones` — contenedores del office a los que pertenecen
 * agentes, contextos, MCPs, skills y secrets. Una organización tiene
 * exactamente una zona `kind='controller'` (creada bajo demanda en
 * GET /zones) y muchas `kind='standard'`.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('zones', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      name: { type: S.STRING, allowNull: false },
      type: { type: S.STRING, allowNull: false, defaultValue: 'research' },
      color: { type: S.STRING, allowNull: true },
      kind: { type: S.STRING, allowNull: false, defaultValue: 'standard' },
      description: { type: S.TEXT, allowNull: true },
      x: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      y: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: S.INTEGER, allowNull: false, defaultValue: 480 },
      height: { type: S.INTEGER, allowNull: false, defaultValue: 320 },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('zones', ['organizationId']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('zones');
  },
};
