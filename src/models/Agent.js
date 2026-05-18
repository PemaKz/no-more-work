module.exports = ({ sequelize, Sequelize }) => {
  const Agent = sequelize.define(
    'Agent',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      zoneId: { type: Sequelize.UUID, allowNull: false },
      // Denormalizado para queries org-scoped sin hacer JOIN.
      organizationId: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      // Estado runtime (visual): idle | working | success | warning | error
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'idle',
      },
      // Posición LOCAL dentro de su zona (no world coords).
      x: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      y: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      // ─── Engine fields ────────────────────────────────────────────────
      // Provider LLM que ejecuta este agente. Null = agente sin motor (no
      // procesará tasks ni hará loops hasta asignarle uno).
      providerId: { type: Sequelize.UUID, allowNull: true },
      // System prompt específico del agente. Se concatena con contexto de
      // zona/org en el momento de invocar al LLM.
      systemPrompt: { type: Sequelize.TEXT, allowNull: true },
      // Si true, el scheduler le mandará ticks periódicos para que trabaje
      // sobre su contexto sin necesidad de una task explícita.
      loopEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Intervalo entre ticks en segundos. Mínimo razonable ~30s.
      loopIntervalSec: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 300,
      },
      // Rol semántico libre. Útil sobre todo en el orquestador
      // (planner / executor / critic / facilitator…) para que el sistema
      // de consenso sepa qué papel juega cada uno.
      role: { type: Sequelize.STRING, allowNull: true },

      // ─── Runtime visibility ──────────────────────────────────────────
      // Última vez que el agente arrancó un tick. El frontend lo usa para
      // calcular la cuenta atrás del próximo tick (lastTickAt + loopIntervalSec).
      lastTickAt: { type: Sequelize.DATE, allowNull: true },
      // Task que está procesando ahora mismo (si la hay). Permite enlazar
      // la actividad visible con la task real desde el mapa.
      currentTaskId: { type: Sequelize.UUID, allowNull: true },
      // Texto corto legible para el usuario sobre qué está haciendo el
      // agente AHORA. Ej.: "Tick", "Resolviendo: Investigar competencia",
      // "Deliberando: ¿lanzamos v2?". Null = inactivo.
      currentActivity: { type: Sequelize.STRING, allowNull: true },
    },
    {
      tableName: 'agents',
      indexes: [
        { fields: ['zoneId'] },
        { fields: ['organizationId'] },
      ],
    }
  );

  Agent.associate = (models) => {
    Agent.belongsTo(models.Zone, { foreignKey: 'zoneId', as: 'zone' });
    Agent.belongsTo(models.Provider, {
      foreignKey: 'providerId',
      as: 'provider',
    });
  };

  return Agent;
};
