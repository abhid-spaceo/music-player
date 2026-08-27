'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A deliberately small fetch layer. No query library yet: the Phase 2 API
 * contract is settled but the caching policy is a Neon-compute decision that
 * belongs with the rest of the server-state work.
 */
let csrfToken: string | null = null;

export type Session = { user: { id: string; role: 'admin' | 'listener' } | null };

export async function getSession(): Promise<Session> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  const body = (await res.json()) as { ok: boolean; data?: { user: Session['user']; csrfToken: string } };
  csrfToken = body.data?.csrfToken ?? null;
  return { user: body.data?.user ?? null };
}

export async function apiGet<T>(path: string): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(path, { credentials: 'same-origin' });
  const body = (await res.json()) as
    | { ok: true; data: T; meta?: Record<string, unknown> }
    | { ok: false; error: string };
  if (!('ok' in body) || !body.ok) {
    throw new Error('error' in body ? body.error : 'Request failed');
  }
  return { data: body.data, meta: body.meta };
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  payload?: unknown,
): Promise<T> {
  if (!csrfToken) await getSession();
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = (await res.json()) as
    | { ok: true; data: T }
    | { ok: false; error: string };
  if (!body.ok) throw new Error(body.error);
  return body.data;
}

/**
 * Fetches an API path into loading/error/data state. Takes a path rather than a
 * callback so the dependency is a primitive — no ref juggling, and no stale
 * closure. Runs on mount and whenever `refetch` bumps the nonce.
 *
 * There is no cache and no automatic revalidation, deliberately: a refetch
 * policy is a Neon-compute decision and belongs with the server-state work.
 */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Every setState below runs in a promise callback, never synchronously in
    // the effect body.
    apiGet<T>(path)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, meta, error, loading, refetch };
}
