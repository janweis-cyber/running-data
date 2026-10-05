import { useCallback, useEffect, useState } from 'react';
import type { Tag } from './types';
import type { Creds } from './intervals';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode / quota — app still works for this session */
  }
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => read(key, fallback));
  const set = useCallback((n: T) => {
    setV(n);
    write(key, n);
  }, [key]);
  return [v, set];
}

export const useTags = () => useLocal<Record<string, Tag>>('barre.tags', {});
export const useCreds = () => useLocal<Creds | null>('barre.creds', null);
export const useMirrorUrl = (def: string) => useLocal<string>('barre.mirror', def);

export function useAsync<T>(fn: (() => Promise<T>) | null, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!fn });
  useEffect(() => {
    if (!fn) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: String(e?.message ?? e), loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
