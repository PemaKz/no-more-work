module.exports = ({ sequelize, Sequelize }) => {
  const OrgSecret = sequelize.define(
    'OrgSecret',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      organizationId: { type: Sequelize.STRING, allowNull: false },
      // Convención: SCREAMING_SNAKE_CASE. Único dentro de la org.
      key: { type: Sequelize.STRING, allowNull: false },
      // Cifrado con AES-256-GCM. Formato: iv:tag:ciphertext en base64.
      valueEncrypted: { type: Sequelize.TEXT, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      // true = gestionado internamente (p.ej. desde un Provider). Estos
      // no aparecen en el listado de Secrets del Config; viven detrás de
      // la entidad que los posee.
      internal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'org_secrets',
      indexes: [
        { fields: ['organizationId'] },
        { fields: ['organizationId', 'key'], unique: true },
      ],
    }
  );

  return OrgSecret;
};
