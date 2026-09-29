"use client";

import { useCallback, useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs a lib/api.ts (or lib/dataSource.ts) call and tracks loading and errors.
 * Wrap `load` in useCallback so it only re-runs when its inputs change.
 */
export function useApi<T>(load: () => Promise<T>): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{
    load: () => Promise<T>;
    nonce: number;
    data?: T;
    error?: unknown;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setResult({ load, nonce, data }),
      (error: unknown) => !cancelled && setResult({ load, nonce, error: error ?? new Error("Unknown error") }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = result && result.load === load && result.nonce === nonce ? result : null;
  return { data: current?.data, error: current?.error, loading: current === null, reload };
}
