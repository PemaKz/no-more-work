import { useEffect, useRef, useState } from "react";
import useAuth from "../../hooks/useAuth";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ChevronIcon = (p) => (
  <svg viewBox="0 0 24 24" width="12" height="12" {...stroke} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LogoutIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = user?.name?.[0]?.toUpperCase() || "·";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-[var(--radius-full)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-surface-3)] hover:border-[color:var(--color-border-strong)] transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
      >
        <span className="w-7 h-7 rounded-full bg-[color:var(--color-surface-3)] flex items-center justify-center text-xs font-semibold">
          {initial}
        </span>
        <ChevronIcon className="text-[color:var(--color-text-dim)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-64 panel-floating !p-0">
          <div className="px-4 py-3 border-b border-[color:var(--color-border)]">
            <p className="text-sm font-semibold truncate">{user?.name || "Operador"}</p>
            <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] truncate mt-0.5">
              {user?.email || "—"}
            </p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-3)] transition-colors"
            >
              <LogoutIcon />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
