import { Navigate, Routes, Route } from "react-router-dom";
import useLayout from "../../hooks/useLayout";
import layoutRoutes from "./routes";

function NmwMark({ size = 40 }) {
  return (
    <div
      className="nmw-mark"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      NMW
    </div>
  );
}

/**
 * Preview del mapa que se muestra en el panel izquierdo del auth.
 * Mock estático con zonas, markers de agente y una ruta animada — sirve
 * para comunicar el producto antes del login. Cuando exista el mapa real,
 * podrá reutilizarse o reemplazarse por una versión "demo" del componente.
 */
function MapPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 map-grid" />
      <div className="absolute inset-0 map-vignette" />

      {/* Zonas */}
      <div
        className="map-zone"
        style={{
          top: "18%",
          left: "12%",
          width: 192,
          height: 144,
          color: "var(--color-zone-research)",
        }}
      >
        <span className="map-zone-label">research</span>
      </div>
      <div
        className="map-zone"
        style={{
          top: "55%",
          left: "30%",
          width: 168,
          height: 120,
          color: "var(--color-zone-trade)",
        }}
      >
        <span className="map-zone-label">trade</span>
      </div>
      <div
        className="map-zone"
        style={{
          top: "22%",
          right: "8%",
          width: 156,
          height: 168,
          color: "var(--color-zone-build)",
        }}
      >
        <span className="map-zone-label">build</span>
      </div>

      {/* Agentes */}
      <div className="map-agent" style={{ top: "30%", left: "22%" }} data-status="working" />
      <div className="map-agent" style={{ top: "38%", left: "18%" }} data-status="success" />
      <div className="map-agent" style={{ top: "65%", left: "38%" }} data-status="working" />
      <div className="map-agent" style={{ top: "72%", left: "50%" }} data-status="idle" />
      <div className="map-agent" style={{ top: "35%", right: "16%" }} data-status="working" />
      <div className="map-agent" style={{ top: "55%", right: "12%" }} data-status="warning" />

      {/* Ruta entre dos agentes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <path className="map-route" d="M 25% 32% Q 40% 55%, 42% 67%" />
        <path className="map-route" d="M 42% 67% Q 65% 60%, 82% 38%" />
      </svg>
    </div>
  );
}

export default function AuthLayout() {
  const { routes } = useLayout(layoutRoutes);

  return (
    <div className="min-h-screen flex bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      {/* Pane izquierdo: preview del producto. Oculto en mobile. */}
      <aside className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-[color:var(--color-surface-1)] border-r border-[color:var(--color-border)] flex-col">
        {/* Header de marca */}
        <div className="relative z-10 flex items-center gap-3 px-10 py-8">
          <NmwMark size={40} />
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-[15px] tracking-tight">no more work</span>
            <span className="mono text-[10px] uppercase tracking-wider mt-1 text-[color:var(--color-text-dim)]">
              operaciones autónomas
            </span>
          </div>
        </div>

        {/* Map preview */}
        <div className="relative flex-1">
          <MapPreview />
        </div>

        {/* Tagline inferior */}
        <div className="relative z-10 px-10 py-8 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-1)]">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            Configura zonas. Despliega agentes. Observa el trabajo en vivo.
          </h2>
          <p className="text-sm text-[color:var(--color-text-muted)] max-w-md">
            NMW es un panel de operaciones donde tus agentes de IA trabajan de forma
            continua en las tareas que les asignas — desde investigación hasta
            ejecución — y tú solo decides el qué.
          </p>

          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              <span className="status-dot" data-status="working" />
              <span>3 trabajando</span>
            </div>
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              <span className="status-dot" data-status="success" />
              <span>1 saludable</span>
            </div>
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              <span className="status-dot" data-status="warning" />
              <span>1 atención</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Pane derecho: rutas (login, etc.) */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* En mobile, mostrar el mark arriba */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <NmwMark size={36} />
          <span className="font-semibold text-sm tracking-tight">no more work</span>
        </div>

        <div className="w-full max-w-sm">
          <Routes>
            {routes}
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </div>

        <footer className="absolute bottom-6 right-6 mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          © {new Date().getFullYear()} No More Work
        </footer>
      </main>
    </div>
  );
}
