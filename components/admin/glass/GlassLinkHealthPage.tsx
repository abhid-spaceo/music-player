'use client';

import { useMemo, useState } from 'react';
import { apiSend, useApi } from '@/lib/api/client';
import {
  AVAILABILITY_LABEL,
  toTrack,
  type ApiTrackRow,
  type Track,
} from '@/lib/library/types';
import styles from './GlassLinkHealthPage.module.css';

/** Shape returned by POST /api/admin/tracks/refresh (see the route handler). */
type RefreshResult = { refreshed: number; markedUnavailable: string[] };

/**
 * Glass-themed Link health admin page. Surfaces only the tracks whose YouTube
 * availability is a problem, and offers a re-check that drives the SAME sweep
 * the classic TrackAdminPanel's "check for dead links" uses.
 *
 * Data note: the list read is GET /api/tracks (the endpoint TrackAdminPanel
 * fetches). That row does NOT carry `availability_checked_at`, so there is no
 * LAST CHECKED column here — inventing a timestamp would be worse than omitting
 * one. The page's <h1> "Link health" is rendered by the route, not here.
 */
export function GlassLinkHealthPage() {
  // 100 is the list route's hard maximum; the unhealthy set is small in
  // practice, so a single unfiltered page is enough to surface problems.
  const { data, error, loading, refetch } = useApi<ApiTrackRow[]>('/api/tracks?limit=100');

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Only unhealthy rows. 'ok' is the one healthy value (lib/youtube/api.ts).
  const unhealthy: Track[] = useMemo(
    () => (data ?? []).map(toTrack).filter((t) => t.availability !== 'ok'),
    [data],
  );

  async function runCheck() {
    if (checking) return;
    setChecking(true);
    setProblem(null);
    try {
      // Same endpoint + method + payload as TrackAdminPanel.checkDeadLinks.
      // apiSend attaches the CSRF token, exactly like PlaylistsScreen's delete.
      const res = await apiSend<RefreshResult>('/api/admin/tracks/refresh', 'POST', {
        limit: 50,
      });
      setResult(
        `Re-checked ${res.refreshed} · ${res.markedUnavailable.length} now unavailable`,
      );
      // The sweep may have healed or flagged rows; reload the list to reflect it.
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not run check');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.headLabel}>UNHEALTHY LINKS</span>
        <div className={styles.actions}>
          {result ? (
            <span className={styles.summary} role="status" data-testid="check-result">
              {result}
            </span>
          ) : null}
          <button
            type="button"
            className={styles.run}
            onClick={runCheck}
            disabled={checking}
          >
            {checking ? 'RUNNING…' : 'RUN CHECK'}
          </button>
        </div>
      </div>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}

      {error ? (
        <p className={styles.state} role="status">
          Could not load tracks — {error}
        </p>
      ) : loading ? (
        <p className={styles.state} role="status">
          Loading…
        </p>
      ) : unhealthy.length === 0 ? (
        <p className={styles.empty} role="status">
          All links healthy.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>TITLE</th>
              <th>CHANNEL</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {unhealthy.map((track) => (
              <tr key={track.id}>
                <td className={styles.title}>{track.title}</td>
                <td className={styles.channel}>{track.channelTitle}</td>
                <td>
                  <span className={styles.badge} data-status={track.availability}>
                    {/* Human label, falling back to the raw reason if unlabelled. */}
                    {AVAILABILITY_LABEL[track.availability] || track.availability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
