import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiHealth } from '@careerlens/core';
import { api } from '../lib/api';

export type ApiStatus = 'checking' | 'online' | 'offline';

interface ApiStatusValue {
  status: ApiStatus;
  health: ApiHealth | null;
  error: string | null;
  /** True when the API is reachable AND an AI provider is configured. */
  aiAvailable: boolean;
  refresh: () => Promise<void>;
}

const ApiStatusContext = createContext<ApiStatusValue | null>(null);

/** Polls the API health endpoint so the UI can label what is running where. */
export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    const result = await api.health();
    if (result.ok) {
      setHealth(result.data);
      setStatus('online');
      setError(null);
    } else {
      setHealth(null);
      setStatus('offline');
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ApiStatusValue>(
    () => ({
      status,
      health,
      error,
      aiAvailable: status === 'online' && Boolean(health?.ai.configured),
      refresh,
    }),
    [status, health, error, refresh],
  );

  return <ApiStatusContext.Provider value={value}>{children}</ApiStatusContext.Provider>;
}

export function useApiStatus(): ApiStatusValue {
  const context = useContext(ApiStatusContext);
  if (!context) throw new Error('useApiStatus must be used inside an ApiStatusProvider.');
  return context;
}
