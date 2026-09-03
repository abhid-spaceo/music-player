'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { PlayIcon } from '@/components/primitives/Icons';
import btn from '@/components/primitives/Buttons.module.css';
import { apiGet, useApi } from '@/lib/api/client';
import { toTrack, isPlayable, type ApiTrackRow, type Track } from '@/lib/library/types';
import { ColumnHeader } from './ColumnHeader';
import { TrackRow } from './TrackRow';
import styles from './LibraryScreen.module.css';
import browse from './BrowseScreen.module.css';

type Tag = { id: string; kind: 'mood' | 'genre'; name: string; slug: string };
type Selected = { kind: 'mood' | 'genre'; slug: string; name: string } | null;

export function BrowseScreen() {
  const { current, playQueue } = usePlayer();
  const { data: tags } = useApi<Tag[]>('/api/tags');
  const [selected, setSelected] = useState<Selected>(null);
  const [result, setResult] = useState<{ key: string; tracks: Track[] } | null>(null);

  const moods = useMemo(() => (tags ?? []).filter((t) => t.kind === 'mood'), [tags]);
  const genres = useMemo(() => (tags ?? []).filter((t) => t.kind === 'genre'), [tags]);

  const selKey = selected ? `${selected.kind}:${selected.slug}` : '';

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    apiGet<ApiTrackRow[]>(`/api/tracks?limit=100&${selected.kind}=${selected.slug}`)
      .then((res) => {
        if (!cancelled) setResult({ key: selKey, tracks: res.data.map(toTrack) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: selKey, tracks: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selected, selKey]);

  // Only trust results that match the current selection.
  const tracks = result && result.key === selKey ? result.tracks : null;
  const loading = !!selected && tracks === null;
  const playable = (tracks ?? []).filter(isPlayable);

  return (
    <>
      <ScreenHeader
        title="Browse"
        meta={selected ? `${selected.name.toUpperCase()} · ${tracks?.length ?? 0} TRACKS` : 'PICK A MOOD OR GENRE'}
        actions={
          <button
            type="button"
            className={btn.playAll}
            disabled={playable.length === 0}
            onClick={() => playQueue(playable, 0)}
          >
            <PlayIcon size={13} color="var(--base)" />
            PLAY ALL
          </button>
        }
        below={
          <div className={browse.groups}>
            <div className={browse.group}>
              <span className={browse.label}>MOODS</span>
              <div className={browse.chips}>
                {moods.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={browse.chip}
                    aria-pressed={selected?.kind === 'mood' && selected.slug === t.slug}
                    onClick={() => setSelected({ kind: 'mood', slug: t.slug, name: t.name })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className={browse.group}>
              <span className={browse.label}>GENRES</span>
              <div className={browse.chips}>
                {genres.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={browse.chip}
                    aria-pressed={selected?.kind === 'genre' && selected.slug === t.slug}
                    onClick={() => setSelected({ kind: 'genre', slug: t.slug, name: t.name })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <div className={styles.rule} />
      <ColumnHeader />
      <div className={styles.rule} />

      <ol className={`${styles.list} no-scrollbar`}>
        {!selected ? (
          <li className={styles.state}>Pick a mood or genre above to see songs.</li>
        ) : loading ? (
          <li className={styles.state} role="status">Loading…</li>
        ) : (tracks ?? []).length === 0 ? (
          <li className={styles.state}>No songs tagged “{selected.name}” yet.</li>
        ) : (
          (tracks ?? []).map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              playing={current?.id === t.id}
              onPlay={() =>
                playQueue(playable, Math.max(0, playable.findIndex((p) => p.id === t.id)))
              }
            />
          ))
        )}
        <li className={styles.spacer} aria-hidden="true" />
      </ol>
    </>
  );
}
