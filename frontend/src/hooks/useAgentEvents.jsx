import { useCallback, useEffect, useState } from "react";
import useSocket from "./useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * Timeline de eventos de un agente concreto. Hace fetch inicial al GET
 * /agents/:id/events y a partir de ahí escucha `agent-event:created` por
 * socket para append en vivo (filtrando por agentId).
 *
 * `agentId` puede ser null cuando el dialog aún no tiene agente seleccionado;
 * en ese caso el hook no hace nada.
 */
export default function useAgentEvents(agentId, { limit = 50 } = {}) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    if (!agentId) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/agents/${agentId}/events?limit=${limit}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setEvents(data.events || []);
    } catch (err) {
      setError(err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const socket = useSocket();
  useEffect(() => {
    if (!socket || !agentId) return;
    const onCreated = (event) => {
      if (!event || event.agentId !== agentId) return;
      setEvents((evs) => {
        // De-dupe por si llega antes via socket y luego via refetch
        if (evs.some((e) => e.id === event.id)) return evs;
        return [event, ...evs].slice(0, limit);
      });
    };
    socket.on("agent-event:created", onCreated);
    return () => socket.off("agent-event:created", onCreated);
  }, [socket, agentId, limit]);

  return { events, isLoading, error, refetch: fetchEvents };
}
