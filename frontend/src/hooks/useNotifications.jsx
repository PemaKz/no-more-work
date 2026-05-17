import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const POLL_INTERVAL_MS = 60_000;

export default function useNotifications() {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!orgId) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling como red de seguridad (60s) por si el socket no está disponible.
  // Las nuevas notificaciones reales llegan vía evento socket — el polling
  // solo cubre desconexiones largas o entornos sin socket.
  useEffect(() => {
    if (!orgId) return;
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [orgId, fetchNotifications]);

  // ─── Socket realtime ──────────────────────────────────────────────────
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;

    const onCreated = (n) => {
      setNotifications((ns) => {
        if (ns.some((x) => x.id === n.id)) return ns;
        // Mantén las 50 más recientes alineadas con el server.
        return [n, ...ns].slice(0, 50);
      });
    };
    const onConnect = () => {
      fetchNotifications();
    };

    socket.on("notification:created", onCreated);
    socket.on("connect", onConnect);
    return () => {
      socket.off("notification:created", onCreated);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchNotifications]);

  const markRead = useCallback(
    async (id) => {
      setNotifications((ns) =>
        ns.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      try {
        const res = await fetch(`${API_BASE}/notifications/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        await fetchNotifications();
        throw err;
      }
    },
    [fetchNotifications]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      await fetchNotifications();
      throw err;
    }
  }, [fetchNotifications]);

  const removeNotification = useCallback(
    async (id) => {
      const previous = notifications;
      setNotifications((ns) => ns.filter((n) => n.id !== id));
      try {
        const res = await fetch(`${API_BASE}/notifications/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setNotifications(previous);
        throw err;
      }
    },
    [notifications]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
    removeNotification,
  };
}
