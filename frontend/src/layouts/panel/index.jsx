import { Navigate, Routes, Route, NavLink, useLocation } from "react-router-dom";
import useLayout from "../../hooks/useLayout";
import useAuth from "../../hooks/useAuth";
import useTheme from "../../hooks/useTheme";
import layoutRoutes from "./routes";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Icon = {
  Map: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <path d="M9 6 3 9v12l6-3" />
      <path d="m9 6 6 3" />
      <path d="M9 6v15" />
      <path d="m15 9 6-3v12l-6 3" />
      <path d="M15 9v15" />
    </svg>
  ),
  Zones: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Agents: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21v-1.5A4.5 4.5 0 0 1 6.5 15h5A4.5 4.5 0 0 1 16 19.5V21" />
      <circle cx="17" cy="8" r="3" />
      <path d="M22 21v-1a4 4 0 0 0-4-4" />
    </svg>
  ),
  Tasks: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <path d="m3 5 2 2 4-4" />
      <path d="m3 12 2 2 4-4" />
      <path d="m3 19 2 2 4-4" />
      <line x1="13" y1="6" x2="21" y2="6" />
      <line x1="13" y1="13" x2="21" y2="13" />
      <line x1="13" y1="20" x2="21" y2="20" />
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Sun: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
  Logout: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

const navItems = [
  { name: "Mapa", path: "/panel/dashboard", icon: Icon.Map },
  { name: "Zonas", path: "/panel/zones", icon: Icon.Zones },
  { name: "Agentes", path: "/panel/agents", icon: Icon.Agents },
  { name: "Tareas", path: "/panel/tasks", icon: Icon.Tasks },
  { name: "Configuración", path: "/panel/settings", icon: Icon.Settings },
];

const pageTitleByPath = {
  "/panel/dashboard": "Mapa",
  "/panel/zones": "Zonas",
  "/panel/agents": "Agentes",
  "/panel/tasks": "Tareas",
  "/panel/settings": "Configuración",
};

export default function PanelLayout() {
  const location = useLocation();
  const { routes } = useLayout(layoutRoutes);
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
  };

  const pageTitle = pageTitleByPath[location.pathname] || "Panel";

  return (
    <div className="min-h-screen flex bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      {/* Sidebar */}
      <aside className="w-64 bg-[color:var(--color-surface-1)] border-r border-[color:var(--color-border)] flex flex-col">
        <div className="px-5 py-6 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="nmw-mark" style={{ width: 36, height: 36, fontSize: 11 }}>
              NMW
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-semibold text-[14px] tracking-tight">no more work</span>
              <span className="mono text-[10px] uppercase tracking-wider mt-1 text-[color:var(--color-text-dim)]">
                operaciones
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const IconCmp = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-3)]",
                  ].join(" ")
                }
              >
                <IconCmp />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User block */}
        <div className="px-3 py-4 border-t border-[color:var(--color-border)]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-[color:var(--color-surface-3)] flex items-center justify-center border border-[color:var(--color-border)]">
              <span className="text-xs font-semibold text-[color:var(--color-text)]">
                {user?.name?.[0]?.toUpperCase() || "·"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "Operador"}</p>
              <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] truncate">
                {user?.email || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm w-full mt-2 justify-start"
          >
            <Icon.Logout />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="sticky top-0 z-20 h-16 px-8 flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              {location.pathname}
            </span>
            <span className="text-[color:var(--color-text-faint)]">·</span>
            <h1 className="text-base font-semibold">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 h-8 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <span className="status-dot" data-status="working" />
              <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                3 agentes activos
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              title={isDark ? "Modo claro" : "Modo oscuro"}
            >
              {isDark ? <Icon.Sun /> : <Icon.Moon />}
            </button>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <Icon.Bell />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-[1400px] mx-auto">
            <Routes>
              {routes}
              <Route path="*" element={<Navigate to="/panel/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
