import { useEffect, useRef, useState } from "react";
import useNotifications from "../../hooks/useNotifications";
import timeAgo from "../../utils/timeAgo";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const BellIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const TYPE_STATUS = {
  zone_created: "success",
  agent_created: "success",
  agent_moved: "info",
  info: "info",
  warning: "warning",
  error: "error",
};

export default function NotificationsMenu() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    refetch,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Refetch fresh data al abrir
  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  // Cerrar con click fuera o Esc
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

  const handleNotificationClick = (n) => {
    if (!n.read) {
      markRead(n.id).catch(() => {});
    }
    // Futuro: navegar a n.link si existe
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllRead().catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-sm btn-icon relative"
        aria-label="Notificaciones"
        title="Notificaciones"
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[color:var(--color-accent)] text-white text-[9px] font-semibold flex items-center justify-center leading-none"
            aria-label={`${unreadCount} sin leer`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-40 w-[360px] panel-floating !p-0 overflow-hidden"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-[color:var(--color-border)] flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-accent)]">
                  {unreadCount} sin leer
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <ul className="max-h-[420px] overflow-auto divide-y divide-[color:var(--color-border)]">
            {notifications.length === 0 && (
              <li className="px-4 py-8 text-center">
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  Sin notificaciones
                </p>
                <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                  todo al día
                </p>
              </li>
            )}
            {notifications.map((n) => {
              const dotStatus = TYPE_STATUS[n.type] || "info";
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className="w-full text-left px-4 py-3 hover:bg-[color:var(--color-surface-3)] transition-colors flex gap-3 items-start"
                  >
                    <span
                      className="status-dot mt-[6px] flex-shrink-0"
                      data-status={n.read ? "idle" : dotStatus}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          n.read
                            ? "text-sm text-[color:var(--color-text-muted)]"
                            : "text-sm font-semibold text-[color:var(--color-text)]"
                        }
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1.5">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
