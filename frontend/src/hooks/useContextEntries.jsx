import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * Fetch context entries filtradas por scope+scopeId. Suscribe a eventos
 * context-entry:* vía socket.
 */
export default function useContextEntries({ scope, scopeId } = {}) {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (!orgId || !scope || !scopeId) {
      setEntries([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ scope, scopeId });
      const res = await fetch(`${API_BASE}/context-entries?${qs}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setEntries(data.entries || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, scope, scopeId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const createEntry = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/context-entries`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    // El socket también lo entregará; deduplicamos por id
    return data.entry;
  }, []);

  const updateEntry = useCallback(async (id, payload) => {
    const res = await fetch(`${API_BASE}/context-entries/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    setEntries((es) => es.map((e) => (e.id === id ? data.entry : e)));
    return data.entry;
  }, []);

  const deleteEntry = useCallback(
    async (id) => {
      const previous = entries;
      setEntries((es) => es.filter((e) => e.id !== id));
      try {
        const res = await fetch(`${API_BASE}/context-entries/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        setEntries(previous);
        throw err;
      }
    },
    [entries]
  );

  // ── Socket realtime ───────────────────────────────────────────────────
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !scope || !scopeId) return;
    const matches = (e) => e.scope === scope && e.scopeId === scopeId;

    const onCreated = (e) => {
      if (!matches(e)) return;
      setEntries((es) => {
        if (es.some((x) => x.id === e.id)) return es;
        // Mantener orden pinned-first, createdAt desc — más nuevo arriba
        return [e, ...es];
      });
    };
    const onUpdated = (e) => {
      if (!matches(e)) {
        setEntries((es) => es.filter((x) => x.id !== e.id));
        return;
      }
      setEntries((es) => es.map((x) => (x.id === e.id ? e : x)));
    };
    const onDeleted = ({ id }) => {
      setEntries((es) => es.filter((x) => x.id !== id));
    };
    const onConnect = () => fetchEntries();

    socket.on("context-entry:created", onCreated);
    socket.on("context-entry:updated", onUpdated);
    socket.on("context-entry:deleted", onDeleted);
    socket.on("connect", onConnect);
    return () => {
      socket.off("context-entry:created", onCreated);
      socket.off("context-entry:updated", onUpdated);
      socket.off("context-entry:deleted", onDeleted);
      socket.off("connect", onConnect);
    };
  }, [socket, scope, scopeId, fetchEntries]);

  return {
    entries,
    isLoading,
    error,
    refetch: fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
