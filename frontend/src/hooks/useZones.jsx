import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export default function useZones() {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [zones, setZones] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchZones = useCallback(async () => {
    if (!orgId) {
      setZones([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/zones`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setZones(data.zones || []);
    } catch (err) {
      setError(err);
      setZones([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // ─── Socket realtime ──────────────────────────────────────────────────
  // Suscribe a eventos emitidos por el server: zonas y agentes creados,
  // actualizados y borrados. Handlers usan setZones(prev => ...) para no
  // capturar stale state — los listeners se attachan una vez por socket.
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;

    const onZoneCreated = (zone) => {
      setZones((zs) =>
        zs.some((z) => z.id === zone.id) ? zs : [...zs, zone]
      );
    };
    const onZoneUpdated = (zone) => {
      setZones((zs) =>
        zs.map((z) => (z.id === zone.id ? { ...z, ...zone } : z))
      );
    };
    const onZoneDeleted = (payload) => {
      const id = payload?.id;
      if (!id) return;
      setZones((zs) => zs.filter((z) => z.id !== id));
    };

    const onAgentCreated = (agent) => {
      setZones((zs) =>
        zs.map((z) => {
          if (z.id !== agent.zoneId) return z;
          if ((z.agents || []).some((a) => a.id === agent.id)) return z;
          return { ...z, agents: [...(z.agents || []), agent] };
        })
      );
    };
    const onAgentUpdated = (agent) => {
      setZones((zs) =>
        zs.map((z) => {
          const agents = z.agents || [];
          const has = agents.some((a) => a.id === agent.id);
          if (has && z.id === agent.zoneId) {
            return {
              ...z,
              agents: agents.map((a) => (a.id === agent.id ? agent : a)),
            };
          }
          if (has && z.id !== agent.zoneId) {
            // El agente se movió a otra zona — quitarlo de ésta
            return { ...z, agents: agents.filter((a) => a.id !== agent.id) };
          }
          if (!has && z.id === agent.zoneId) {
            return { ...z, agents: [...agents, agent] };
          }
          return z;
        })
      );
    };
    const onAgentDeleted = (payload) => {
      const id = payload?.id;
      if (!id) return;
      setZones((zs) =>
        zs.map((z) => ({
          ...z,
          agents: (z.agents || []).filter((a) => a.id !== id),
        }))
      );
    };

    // Si el socket reconecta tras una caída, sincroniza con un refetch
    // por si nos perdimos eventos durante la desconexión.
    const onConnect = () => {
      fetchZones();
    };

    socket.on("zone:created", onZoneCreated);
    socket.on("zone:updated", onZoneUpdated);
    socket.on("zone:deleted", onZoneDeleted);
    socket.on("agent:created", onAgentCreated);
    socket.on("agent:updated", onAgentUpdated);
    socket.on("agent:deleted", onAgentDeleted);
    socket.on("connect", onConnect);

    return () => {
      socket.off("zone:created", onZoneCreated);
      socket.off("zone:updated", onZoneUpdated);
      socket.off("zone:deleted", onZoneDeleted);
      socket.off("agent:created", onAgentCreated);
      socket.off("agent:updated", onAgentUpdated);
      socket.off("agent:deleted", onAgentDeleted);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchZones]);

  const createZone = useCallback(
    async (payload) => {
      const res = await fetch(`${API_BASE}/zones`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await fetchZones();
      return data.zone;
    },
    [fetchZones]
  );

  // Optimista: actualiza la lista local primero, luego sincroniza con el
  // servidor. Si falla, refetch para volver al estado real.
  const updateZone = useCallback(
    async (id, payload) => {
      setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...payload } : z)));
      try {
        const res = await fetch(`${API_BASE}/zones/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        return data.zone;
      } catch (err) {
        await fetchZones();
        throw err;
      }
    },
    [fetchZones]
  );

  const deleteZone = useCallback(
    async (id) => {
      // Optimista: quitar de la lista inmediatamente
      const previous = zones;
      setZones((zs) => zs.filter((z) => z.id !== id));
      try {
        const res = await fetch(`${API_BASE}/zones/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        // restaurar
        setZones(previous);
        throw err;
      }
    },
    [zones]
  );

  // ─── Agents ────────────────────────────────────────────────────────────

  const createAgent = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/agents`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    const agent = data.agent;
    setZones((zs) =>
      zs.map((z) =>
        z.id === agent.zoneId
          ? { ...z, agents: [...(z.agents || []), agent] }
          : z
      )
    );
    return agent;
  }, []);

  const updateAgent = useCallback(
    async (id, payload) => {
      // Snapshot para rollback
      let oldZoneId = null;
      let oldAgent = null;
      for (const z of zones) {
        const found = (z.agents || []).find((a) => a.id === id);
        if (found) {
          oldAgent = found;
          oldZoneId = z.id;
          break;
        }
      }
      if (!oldAgent) {
        throw new Error("Agente no encontrado");
      }
      const newZoneId = payload.zoneId ?? oldZoneId;
      const optimistic = { ...oldAgent, ...payload, zoneId: newZoneId };

      // Optimista: actualizar/mover entre zonas
      setZones((zs) =>
        zs.map((z) => {
          let agents = z.agents || [];
          if (z.id === oldZoneId && oldZoneId !== newZoneId) {
            agents = agents.filter((a) => a.id !== id);
          } else if (z.id === newZoneId && oldZoneId !== newZoneId) {
            agents = [...agents, optimistic];
          } else if (z.id === oldZoneId) {
            agents = agents.map((a) => (a.id === id ? optimistic : a));
          }
          return { ...z, agents };
        })
      );

      try {
        const res = await fetch(`${API_BASE}/agents/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        const serverAgent = data.agent;
        // Reemplaza el optimista con el del servidor
        setZones((zs) =>
          zs.map((z) => ({
            ...z,
            agents: (z.agents || []).map((a) =>
              a.id === id ? serverAgent : a
            ),
          }))
        );
        return serverAgent;
      } catch (err) {
        await fetchZones();
        throw err;
      }
    },
    [zones, fetchZones]
  );

  const deleteAgent = useCallback(
    async (id) => {
      const previous = zones;
      setZones((zs) =>
        zs.map((z) => ({
          ...z,
          agents: (z.agents || []).filter((a) => a.id !== id),
        }))
      );
      try {
        const res = await fetch(`${API_BASE}/agents/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
      } catch (err) {
        setZones(previous);
        throw err;
      }
    },
    [zones]
  );

  return {
    zones,
    isLoading,
    error,
    refetch: fetchZones,
    createZone,
    updateZone,
    deleteZone,
    createAgent,
    updateAgent,
    deleteAgent,
  };
}
