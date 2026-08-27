'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { apiSend, useApi } from '@/lib/api/client';
import { formatDuration } from '@/lib/format';
import styles from './LibraryScreen.module.css';
import own from './PlaylistsScreen.module.css';

type PlaylistRow = {
  id: string;
  name: string;
  description: string | null;
  track_count: number;
  total_sec: number;
};

export function PlaylistsScreen() {
  const { data, error, loading, refetch } = useApi<PlaylistRow[]>('/api/playlists');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const playlists = data ?? [];

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await apiSend('/api/playlists', 'POST', { name: name.trim() });
      setName('');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/playlists/${id}`, 'DELETE');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <>
      <ScreenHeader
        title="Playlists"
        meta={loading ? 'LOADING…' : `${playlists.length} PLAYLISTS`}
      />
      <form className={own.create} onSubmit={create}>
        <input
          className={own.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name"
          aria-label="New playlist name"
          maxLength={120}
        />
        <button type="submit" className={own.del} disabled={busy || !name.trim()} aria-label="Create playlist">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      </form>

      <div className={styles.rule} />
      <ol className={`${styles.list} no-scrollbar`}>
        {problem ? <li className={styles.state} role="alert">{problem}</li> : null}
        {error ? (
          <li className={styles.state} role="status">Could not load playlists — {error}</li>
        ) : playlists.length === 0 && !loading ? (
          <li className={styles.state}>No playlists yet. Name one above.</li>
        ) : (
          playlists.map((p) => (
            <li key={p.id} className={own.row}>
              <Link href={`/playlists/${p.id}`} className={`${own.name} truncate`}>
                {p.name}
              </Link>
              <span className={`${own.count} tnum`}>
                {p.track_count} · {formatDuration(p.total_sec)}
              </span>
              <button
                type="button"
                className={own.del}
                onClick={() => remove(p.id)}
                aria-label={`Delete playlist ${p.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 18 18 6" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))
        )}
        <li className={styles.spacer} aria-hidden="true" />
      </ol>
    </>
  );
}
