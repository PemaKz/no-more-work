module.exports = ({ sequelize, Sequelize }) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      // A quién va dirigida (FK lógico a better-auth user.id).
      userId: { type: Sequelize.STRING, allowNull: false },
      // Org en cuyo contexto se generó (para filtrar al cambiar de org).
      organizationId: { type: Sequelize.STRING, allowNull: false },
      // Categoría libre — p.ej. zone_created, agent_created, info, error.
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'info',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      // Ruta in-app o URL opcional. La UI puede navegar al click.
      link: { type: Sequelize.STRING, allowNull: true },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'notifications',
      indexes: [
        { fields: ['userId', 'organizationId', 'createdAt'] },
        { fields: ['userId', 'organizationId', 'read'] },
      ],
    }
  );

  return Notification;
};
