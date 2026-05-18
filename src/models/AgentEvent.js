/**
 * Append-only log de actividad por agente. Cada vez que un agente arranca
 * o termina un tick / task / turno de deliberación, escribimos una fila.
 *
 * Esto da al usuario una vista cronológica de "qué ha estado haciendo este
 * agente", incluyendo ticks que terminaron sin acciones (end_tick) y
 * errores — cosas que de otra forma no dejarían rastro auditable.
 */
module.exports = ({ sequelize, Sequelize }) => {
  const AgentEvent = sequelize.define(
    'AgentEvent',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      // Scope queries
      organizationId: { type: Sequelize.STRING, allowNull: false },
      agentId: { type: Sequelize.UUID, allowNull: false },
      // Denormalizado para filtros por zona sin JOIN.
      zoneId: { type: Sequelize.UUID, allowNull: true },

      // Discriminador. Mantener finito para que el UI pueda mapear icono/color.
      //   tick_start | tick_end | tick_error
      //   task_start | task_end | task_error
      //   deliberation_turn | deliberation_error
      kind: { type: Sequelize.STRING, allowNull: false },

      // Texto corto legible — lo que mostramos en el timeline sin abrir.
      // Ej.: "Tick → 1 insight, 1 task creada" / "Error: timeout".
      summary: { type: Sequelize.STRING, allowNull: false },

      // JSON con lo que el LLM produjo: text final, lista de toolCalls
      // (nombre + args resumidos), error message, métricas (steps). Opcional.
      detail: { type: Sequelize.JSON, allowNull: true },

      // Si el evento está ligado a una task concreta.
      taskId: { type: Sequelize.UUID, allowNull: true },
    },
    {
      tableName: 'agent_events',
      indexes: [
        { fields: ['agentId', 'createdAt'] },
        { fields: ['organizationId', 'createdAt'] },
        { fields: ['taskId'] },
      ],
    }
  );

  AgentEvent.associate = (models) => {
    AgentEvent.belongsTo(models.Agent, {
      foreignKey: 'agentId',
      as: 'agent',
    });
  };

  return AgentEvent;
};
