import { Navigate, Routes, Route, NavLink } from "react-router-dom";
import useLayout from "../../hooks/useLayout";
import useTheme from "../../hooks/useTheme";
import layoutRoutes from "./routes";
import OrgSwitcher from "./OrgSwitcher";
import UserMenu from "./UserMenu";
import NotificationsMenu from "./NotificationsMenu";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Icon = {
  Office: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v8h4" />
      <path d="M18 9h2a2 2 0 0 1 2 2v11h-4" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Sun: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
};

const navItems = [
  { name: "Office", path: "/panel/dashboard", icon: Icon.Office },
  { name: "Config", path: "/panel/settings", icon: Icon.Settings },
];

function Divider() {
  return <div className="h-6 w-px bg-[color:var(--color-border)] mx-1" aria-hidden="true" />;
}

export default function PanelLayout() {
  const { routes } = useLayout(layoutRoutes);
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    // h-screen (no min-h-screen): la altura explícita permite que el
    // <main flex-1> tenga una altura computada definida, y que `h-full`
    // dentro de las vistas (p.ej. el mapa de Office) resuelva correctamente.
    // Vistas que quieran scroll deben envolver su contenido en
    // `<div className="h-full overflow-auto">`.
    <div className="h-screen flex flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)]">
        {/* Org switcher */}
        <div className="w-52 flex-shrink-0">
          <OrgSwitcher />
        </div>

        <Divider />

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          {navItems.map((item) => {
            const IconCmp = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 h-9 px-3 rounded-[var(--radius)] text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-3)]",
                  ].join(" ")
                }
              >
                <IconCmp />
                <span className="hidden md:inline">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={isDark ? "Modo claro" : "Modo oscuro"}
          >
            {isDark ? <Icon.Sun /> : <Icon.Moon />}
          </button>
          <NotificationsMenu />
          <UserMenu />
        </div>
      </header>

      {/* Main — cada vista decide su propio layout/padding/scroll. */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          {routes}
          <Route path="*" element={<Navigate to="/panel/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
