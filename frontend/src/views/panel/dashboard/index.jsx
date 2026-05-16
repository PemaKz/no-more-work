import useAuth from "../../../hooks/useAuth";

function StatCard({ label, value, trend, status }) {
  return (
    <div className="panel flex flex-col gap-3 !p-5">
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          {label}
        </span>
        {status && <span className="status-dot" data-status={status} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {trend && (
          <span className="mono text-xs text-[color:var(--color-text-muted)]">{trend}</span>
        )}
      </div>
    </div>
  );
}

function ZoneOutline({ top, left, width, height, color, label }) {
  return (
    <div
      className="map-zone"
      style={{ top, left, width, height, color: `var(${color})` }}
    >
      <span className="map-zone-label">{label}</span>
    </div>
  );
}

function Agent({ top, left, status }) {
  return <div className="map-agent" style={{ top, left }} data-status={status} />;
}

function MapPreview() {
  return (
    <div className="panel-1 relative overflow-hidden h-[420px]">
      <div className="absolute inset-0 map-grid" />
      <div className="absolute inset-0 map-vignette" />

      <ZoneOutline top="12%" left="6%" width={220} height={150} color="--color-zone-research" label="research" />
      <ZoneOutline top="55%" left="22%" width={200} height={120} color="--color-zone-trade" label="trade" />
      <ZoneOutline top="18%" left="48%" width={180} height={170} color="--color-zone-build" label="build" />
      <ZoneOutline top="60%" left="62%" width={170} height={130} color="--color-zone-monitor" label="monitor" />

      <Agent top="22%" left="14%" status="working" />
      <Agent top="30%" left="20%" status="success" />
      <Agent top="65%" left="28%" status="working" />
      <Agent top="72%" left="38%" status="idle" />
      <Agent top="28%" left="56%" status="working" />
      <Agent top="40%" left="62%" status="error" />
      <Agent top="70%" left="70%" status="warning" />
      <Agent top="78%" left="78%" status="working" />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <path className="map-route" d="M 16% 25% Q 30% 50%, 32% 68%" />
        <path className="map-route" d="M 60% 30% Q 70% 55%, 74% 73%" />
      </svg>

      {/* HUD inferior */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="panel-floating !p-3 flex items-center gap-3">
          <span className="status-dot" data-status="working" />
          <span className="mono text-[11px] uppercase tracking-wider">
            sim · zoom 100%
          </span>
        </div>
        <button className="btn btn-secondary btn-sm">Abrir mapa completo →</button>
      </div>
    </div>
  );
}

const activity = [
  { id: 1, agent: "Atlas-07", zone: "research", action: "Completó análisis de fuentes", time: "hace 1 min", status: "success" },
  { id: 2, agent: "Helix-02", zone: "trade", action: "Ejecutó orden #4291", time: "hace 3 min", status: "working" },
  { id: 3, agent: "Sentry-11", zone: "monitor", action: "Throttling detectado en API externa", time: "hace 8 min", status: "warning" },
  { id: 4, agent: "Forge-05", zone: "build", action: "Pipeline desplegado", time: "hace 12 min", status: "success" },
  { id: 5, agent: "Vector-09", zone: "research", action: "Iniciada nueva exploración", time: "hace 18 min", status: "working" },
  { id: 6, agent: "Helix-03", zone: "trade", action: "Conexión rechazada por proveedor", time: "hace 26 min", status: "error" },
];

function ActivityFeed() {
  return (
    <div className="panel !p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-border)]">
        <h3 className="text-sm font-semibold">Telemetría reciente</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          live
        </span>
      </div>
      <ul className="divide-y divide-[color:var(--color-border)]">
        {activity.map((event) => (
          <li key={event.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="status-dot mt-1.5" data-status={event.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium">{event.agent}</span>
                <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                  · {event.zone}
                </span>
              </div>
              <p className="text-sm text-[color:var(--color-text-muted)] mt-0.5">
                {event.action}
              </p>
            </div>
            <span className="mono text-[11px] text-[color:var(--color-text-dim)] whitespace-nowrap pt-1">
              {event.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const zones = [
  { name: "research", color: "--color-zone-research", agents: 4, tasks: 12 },
  { name: "trade", color: "--color-zone-trade", agents: 3, tasks: 28 },
  { name: "build", color: "--color-zone-build", agents: 2, tasks: 6 },
  { name: "monitor", color: "--color-zone-monitor", agents: 3, tasks: 17 },
];

function ZonesPanel() {
  return (
    <div className="panel !p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-border)]">
        <h3 className="text-sm font-semibold">Zonas</h3>
        <button className="btn btn-ghost btn-sm">+ Nueva zona</button>
      </div>
      <ul>
        {zones.map((zone) => (
          <li
            key={zone.name}
            className="flex items-center gap-4 px-5 py-3 border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-3)] transition-colors cursor-pointer"
          >
            <span
              className="w-2 h-8 rounded-sm flex-shrink-0"
              style={{ backgroundColor: `var(${zone.color})` }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{zone.name}</p>
              <p className="mono text-[11px] text-[color:var(--color-text-dim)] uppercase tracking-wider mt-0.5">
                {zone.agents} agentes · {zone.tasks} tareas activas
              </p>
            </div>
            <span className="status-dot" data-status="working" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PanelDashboardView() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
            sesión activa
          </span>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">
            Hola, {user?.name || "operador"}.
          </h2>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
            Tus agentes están trabajando. Esto es lo que ocurre ahora mismo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm">Exportar telemetría</button>
          <button className="btn btn-primary btn-sm">Desplegar agente</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Agentes activos" value="12" trend="+2 hoy" status="working" />
        <StatCard label="Zonas configuradas" value="4" trend="estable" status="success" />
        <StatCard label="Tareas hoy" value="247" trend="+18 vs ayer" />
        <StatCard label="Incidencias" value="2" trend="últimas 24h" status="warning" />
      </div>

      {/* Map */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Mapa de operaciones</h3>
          <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
            vista previa
          </span>
        </div>
        <MapPreview />
      </div>

      {/* Activity + Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <div>
          <ZonesPanel />
        </div>
      </div>
    </div>
  );
}
