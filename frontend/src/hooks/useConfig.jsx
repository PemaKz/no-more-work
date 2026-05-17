import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const EMPTY_CONFIG = { contexts: [], mcps: [], skills: [] };

export default function useConfig() {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    if (!orgId) {
      setConfig(EMPTY_CONFIG);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/config`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setConfig(data.config || EMPTY_CONFIG);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (payload) => {
    const res = await fetch(`${API_BASE}/config`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    setConfig(data.config || EMPTY_CONFIG);
    return data.config;
  }, []);

  return { config, isLoading, error, refetch: fetchConfig, updateConfig };
}
