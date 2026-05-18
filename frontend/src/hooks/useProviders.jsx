import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export default function useProviders() {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProviders = useCallback(async () => {
    if (!orgId) {
      setProviders([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/providers`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setProviders(data.providers || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const createProvider = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/providers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    setProviders((ps) =>
      ps.some((p) => p.id === data.provider.id) ? ps : [...ps, data.provider]
    );
    return data.provider;
  }, []);

  const updateProvider = useCallback(
    async (id, payload) => {
      const previous = providers;
      setProviders((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...payload } : p))
      );
      try {
        const res = await fetch(`${API_BASE}/providers/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        setProviders((ps) =>
          ps.map((p) => (p.id === id ? data.provider : p))
        );
        return data.provider;
      } catch (err) {
        setProviders(previous);
        throw err;
      }
    },
    [providers]
  );

  const deleteProvider = useCallback(
    async (id) => {
      const previous = providers;
      setProviders((ps) => ps.filter((p) => p.id !== id));
      try {
        const res = await fetch(`${API_BASE}/providers/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        setProviders(previous);
        throw err;
      }
    },
    [providers]
  );

  // Socket realtime
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;

    const onCreated = (p) => {
      setProviders((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p]));
    };
    const onUpdated = (p) => {
      setProviders((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
    };
    const onDeleted = ({ id }) => {
      setProviders((ps) => ps.filter((x) => x.id !== id));
    };
    const onConnect = () => fetchProviders();

    socket.on("provider:created", onCreated);
    socket.on("provider:updated", onUpdated);
    socket.on("provider:deleted", onDeleted);
    socket.on("connect", onConnect);
    return () => {
      socket.off("provider:created", onCreated);
      socket.off("provider:updated", onUpdated);
      socket.off("provider:deleted", onDeleted);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchProviders]);

  return {
    providers,
    isLoading,
    error,
    refetch: fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  };
}
