'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { PlayIcon } from '@/components/primitives/Icons';
import btn from '@/components/primitives/Buttons.module.css';
import { apiGet, apiSend } from '@/lib/api/client';
import { useDebouncedSearch } from '@/lib/api/use-debounced-search';
import { formatDuration } from '@/lib/format';
import { isPlayable, toTrack, type ApiTrackRow, type Track } from '@/lib/library/types';
import styles from './LibraryScreen.module.css';
import own from './PlaylistsScreen.module.css';
import search from './SearchScreen.module.css';

type Payload = { playlist: { id: string; name: string }; tracks: ApiTrackRow[] };

export function PlaylistDetailScreen({ id }: { id: string }) {
  const { playQueue, current } = usePlayer();
  const [name, setName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [term, setTerm] = useState('');

  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Every setState is inside a promise callback, never synchronous in the
    // effect body.
    apiGet<Payload>(`/api/playlists/${id}`)
      .then((res) => {
        if (cancelled) return;
        setName(res.data.playlist.name);
        setTracks(res.data.tracks.map(toTrack));
      })
      .catch((err: unknown) => {
        if (!cancelled) setProblem(err instanceof Error ? err.message : 'Could not load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadNonce]);

  /**
   * The live order, updated synchronously by `move`.
   *
   * Reading `tracks` inside `move` is not safe: two quick clicks both see the
   * pre-first-click state, so the second computes from a stale array and one of
   * the two moves is silently lost. The ref is what makes rapid reordering
   * correct.
   */
  const orderRef = useRef<Track[]>([]);
  useEffect(() => {
    orderRef.current = tracks;
  }, [tracks]);

  /** Serialises writes so a slow earlier PUT cannot land after a faster later one. */
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  const move = useCallback(
    (from: number, to: number) => {
      const current = orderRef.current;
      if (to < 0 || to >= current.length || from === to) return;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);

      orderRef.current = next; // immediately, so the next click builds on this
      setTracks(next); // optimistic

      writeChain.current = writeChain.current
        .then(() =>
          apiSend(`/api/playlists/${id}/order`, 'PUT', {
            trackIds: next.map((t) => t.id),
          }),
        )
        .catch((err: unknown) => {
          orderRef.current = current;
          setTracks(current); // roll back to the order this move started from
          setProblem(err instanceof Error ? err.message : 'Could not reorder');
        });
    },
    [id],
  );

  async function removeTrack(trackId: string) {
    try {
      await apiSend(`/api/playlists/${id}/tracks`, 'DELETE', { trackId });
      setTracks((t) => t.filter((x) => x.id !== trackId));
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not remove');
    }
  }

  async function addTrack(trackId: string) {
    try {
      await apiSend(`/api/playlists/${id}/tracks`, 'POST', { trackId });
      setTerm('');
      reload();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add');
    }
  }

  const buildPath = useCallback(
    (t: string) => `/api/tracks?limit=20&q=${encodeURIComponent(t)}`,
    [],
  );
  const { results } = useDebouncedSearch<ApiTrackRow>(term, buildPath);

  const playable = tracks.filter(isPlayable);
  const total = tracks.reduce((n, t) => n + t.durationSec, 0);

  return (
    <>
      <ScreenHeader
        title={name || 'Playlist'}
        meta={loading ? 'LOADING…' : `${tracks.length} TRACKS · ${formatDuration(total)}`}
        actions={
          <button
            type="button"
            className={btn.playAll}
            disabled={playable.length === 0}
            onClick={() => playQueue(playable, 0)}
          >
            <PlayIcon size={13} color="var(--base)" />
            PLAY
          </button>
        }
      />

      <div className={search.field}>
        <input
          className={search.input}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Add a track by title"
          aria-label="Search the library to add a track"
        />
      </div>
      {results.length > 0 ? (
        <ul className={own.addList}>
          {results.slice(0, 6).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={own.addRow}
                onClick={() => addTrack(r.id)}
                aria-label={`Add ${r.title} to this playlist`}
              >
                <span className="truncate">{r.title}</span>
                <span aria-hidden="true">+</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.rule} />

      <ol className={`${styles.list} no-scrollbar`}>
        {problem ? <li className={styles.state} role="alert">{problem}</li> : null}
        {tracks.length === 0 && !loading ? (
          <li className={styles.state}>Empty. Search above to add tracks.</li>
        ) : (
          tracks.map((t, i) => (
            <li
              key={t.id}
              className={`${own.row} ${dragIndex === i ? own.dragging : ''} ${
                overIndex === i ? own.dropTarget : ''
              }`}
              // Drag works on desktop. The move buttons below are what actually
              // work on touch, and they are keyboard-operable too.
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragEnd={() => {
                if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex);
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              <span className={own.grip} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                </svg>
              </span>

              <button
                type="button"
                className={`${own.name} truncate`}
                style={{ textAlign: 'left', color: current?.id === t.id ? 'var(--signal)' : undefined }}
                onClick={() => playQueue(playable, Math.max(0, playable.findIndex((p) => p.id === t.id)))}
                disabled={!isPlayable(t)}
              >
                {t.title}
              </button>

              <span className={`${own.count} tnum`}>{formatDuration(t.durationSec)}</span>

              <button type="button" className={own.move} onClick={() => move(i, i - 1)}
                disabled={i === 0} aria-label={`Move ${t.title} up`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 14l6-6 6 6" /></svg>
              </button>
              <button type="button" className={own.move} onClick={() => move(i, i + 1)}
                disabled={i === tracks.length - 1} aria-label={`Move ${t.title} down`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 10l6 6 6-6" /></svg>
              </button>
              <button type="button" className={own.del} onClick={() => removeTrack(t.id)}
                aria-label={`Remove ${t.title} from this playlist`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 18 18 6" /><path d="M6 6l12 12" /></svg>
              </button>
            </li>
          ))
        )}
        <li className={styles.spacer} aria-hidden="true" />
      </ol>
    </>
  );
}
