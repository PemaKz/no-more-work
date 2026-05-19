/**
 * Tabla `context_entries` — log auditable y compartido. Cada entrada
 * tiene scope (`org` | `zone`) y source (`user` | `agent` | `system`). El
 * engine inyecta entradas recientes al system prompt vía el augmenter
 * `recentEntries` para que los agentes recuerden lo decidido.
 */
module.exports = {
  async up({ context: { queryInterface } }) {
    const S = queryInterface.sequelize.Sequelize;
    await queryInterface.createTable('context_entries', {
      id: { type: S.UUID, defaultValue: S.UUIDV4, primaryKey: true },
      organizationId: { type: S.STRING, allowNull: false },
      scope: { type: S.STRING, allowNull: false, defaultValue: 'zone' },
      scopeId: { type: S.STRING, allowNull: false },
      sourceType: { type: S.STRING, allowNull: false, defaultValue: 'system' },
      sourceId: { type: S.STRING, allowNull: true },
      kind: { type: S.STRING, allowNull: false, defaultValue: 'observation' },
      content: { type: S.TEXT, allowNull: false },
      metadata: { type: S.JSON, allowNull: true },
      pinned: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      sourceTaskId: { type: S.UUID, allowNull: true },
      createdAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      updatedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    });
    await queryInterface.addIndex('context_entries', ['organizationId']);
    await queryInterface.addIndex('context_entries', ['scope', 'scopeId']);
    await queryInterface.addIndex('context_entries', ['pinned']);
    await queryInterface.addIndex('context_entries', ['createdAt']);
  },

  async down({ context: { queryInterface } }) {
    await queryInterface.dropTable('context_entries');
  },
};
