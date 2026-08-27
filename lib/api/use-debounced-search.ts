'use client';

import { useEffect, useState } from 'react';

export type SearchState<T> = {
  results: T[];
  searching: boolean;
  error: string | null;
  /** True once a term has been submitted, so "no results" can differ from idle. */
  ran: boolean;
};

/**
 * Debounces the term, then fetches — and aborts the in-flight request whenever
 * a newer keystroke supersedes it. Without the abort, a slow early response can
 * land after a fast later one and overwrite the correct results.
 */
export function useDebouncedSearch<T>(
  term: string,
  buildPath: (term: string) => string,
  delayMs = 250,
): SearchState<T> {
  const [state, setState] = useState<SearchState<T>>({
    results: [],
    searching: false,
    error: null,
    ran: false,
  });

  const trimmed = term.trim();

  useEffect(() => {
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, searching: true, error: null }));
      fetch(buildPath(trimmed), {
        credentials: 'same-origin',
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((body: { ok: boolean; data?: T[]; error?: string }) => {
          if (controller.signal.aborted) return;
          if (!body.ok) throw new Error(body.error ?? 'Search failed');
          setState({ results: body.data ?? [], searching: false, error: null, ran: true });
        })
        .catch((err: unknown) => {
          // An abort is the expected outcome for a superseded request, not an
          // error the user should ever see.
          if (controller.signal.aborted) return;
          setState({
            results: [],
            searching: false,
            error: err instanceof Error ? err.message : 'Search failed',
            ran: true,
          });
        });
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, buildPath, delayMs]);

  // The idle case is derived, not stored: writing it from the effect would be a
  // synchronous setState during render's commit and cause a cascading render.
  if (!trimmed) return { results: [], searching: false, error: null, ran: false };
  return state;
}
