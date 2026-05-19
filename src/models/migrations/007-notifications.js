/**
 * Tabla `notifications` — campana del topbar. Notifs por usuario+org;
 * cuando el usuario cambia de org sólo ve las suyas en ese contexto.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('notifications', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      userId: { type: S.STRING, allowNull: false },
      organizationId: { type: S.STRING, allowNull: false },
      type: { type: S.STRING, allowNull: false, defaultValue: 'info' },
      title: { type: S.STRING, allowNull: false },
      body: { type: S.TEXT, allowNull: true },
      link: { type: S.STRING, allowNull: true },
      read: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('notifications', [
      'userId',
      'organizationId',
      'createdAt',
    ]);
    await queryInterface.addIndex('notifications', [
      'userId',
      'organizationId',
      'read',
    ]);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('notifications');
  },
};
