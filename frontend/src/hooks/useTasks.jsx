import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * Fetch tasks de la org filtradas opcionalmente por zoneId. Suscribe a
 * eventos task:created|updated|deleted vía socket.
 */
export default function useTasks({ zoneId } = {}) {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!orgId) {
      setTasks([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (zoneId) qs.set("zoneId", zoneId);
      const res = await fetch(`${API_BASE}/tasks?${qs.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, zoneId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    setTasks((ts) =>
      ts.some((t) => t.id === data.task.id) ? ts : [data.task, ...ts]
    );
    return data.task;
  }, []);

  const updateTask = useCallback(async (id, payload) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    setTasks((ts) => ts.map((t) => (t.id === id ? data.task : t)));
    return data.task;
  }, []);

  const deleteTask = useCallback(
    async (id) => {
      const previous = tasks;
      setTasks((ts) => ts.filter((t) => t.id !== id));
      try {
        const res = await fetch(`${API_BASE}/tasks/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        setTasks(previous);
        throw err;
      }
    },
    [tasks]
  );

  // Dispara la ejecución (fire-and-forget en el server; el progreso llega
  // por socket vía task:updated).
  const runTask = useCallback(async (id) => {
    const res = await fetch(`${API_BASE}/tasks/${id}/run`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return data.task;
  }, []);

  // ── Socket realtime ───────────────────────────────────────────────────
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const matchesScope = (t) => !zoneId || t.zoneId === zoneId;

    const onCreated = (t) => {
      if (!matchesScope(t)) return;
      setTasks((ts) => (ts.some((x) => x.id === t.id) ? ts : [t, ...ts]));
    };
    const onUpdated = (t) => {
      if (!matchesScope(t)) {
        // Task se movió fuera de nuestro scope — quitarla si la teníamos
        setTasks((ts) => ts.filter((x) => x.id !== t.id));
        return;
      }
      setTasks((ts) => {
        if (!ts.some((x) => x.id === t.id)) return [t, ...ts];
        return ts.map((x) => (x.id === t.id ? t : x));
      });
    };
    const onDeleted = ({ id }) => {
      setTasks((ts) => ts.filter((x) => x.id !== id));
    };
    const onConnect = () => fetchTasks();

    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:deleted", onDeleted);
    socket.on("connect", onConnect);
    return () => {
      socket.off("task:created", onCreated);
      socket.off("task:updated", onUpdated);
      socket.off("task:deleted", onDeleted);
      socket.off("connect", onConnect);
    };
  }, [socket, zoneId, fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    runTask,
  };
}
