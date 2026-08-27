'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { PlayIcon, SearchIcon, ShuffleIcon } from '@/components/primitives/Icons';
import btn from '@/components/primitives/Buttons.module.css';
import { useApi } from '@/lib/api/client';
import { toTrack, isPlayable, type ApiTrackRow, type Track } from '@/lib/library/types';
import { ColumnHeader } from './ColumnHeader';
import { FilterChips, type Filter } from './FilterChips';
import { TrackRow } from './TrackRow';
import styles from './LibraryScreen.module.css';

/** Shuffles a copy. Fisher-Yates, so every ordering is equally likely. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function LibraryScreen() {
  const { current, playQueue } = usePlayer();
  const [filter, setFilter] = useState<Filter>('RECENT');

  // FAVES is a server-side scope, not an in-memory filter: favourites live in
  // their own table and the row already reports is_favourite.
  const path =
    filter === 'FAVES'
      ? '/api/tracks?limit=100&scope=favourites'
      : '/api/tracks?limit=100';
  const { data, meta: listMeta, error, loading } = useApi<ApiTrackRow[]>(path);

  const tracks: Track[] = useMemo(() => (data ?? []).map(toTrack), [data]);
  const unavailable = Number(listMeta?.unavailable ?? 0);

  const visible = useMemo(() => {
    const list = [...tracks];
    switch (filter) {
      case 'A–Z':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'CHANNEL':
        return list.sort(
          (a, b) => a.channelTitle.localeCompare(b.channelTitle) || a.title.localeCompare(b.title),
        );
      case 'ISSUES':
        return list.filter((t) => !isPlayable(t));
      case 'FAVES':
        return list;
      default:
        return list;
    }
  }, [tracks, filter]);

  const playable = visible.filter(isPlayable);

  const meta = loading
    ? 'LOADING…'
    : `${tracks.length} TRACKS${unavailable ? ` · ${unavailable} UNAVAILABLE` : ''}`;

  return (
    <>
      <ScreenHeader
        title="Library"
        meta={meta}
        actions={
          <>
            <button
              type="button"
              className={btn.playAll}
              disabled={playable.length === 0}
              onClick={() => playQueue(playable, 0)}
            >
              <PlayIcon size={13} color="var(--base)" />
              PLAY ALL
            </button>
            <button
              type="button"
              className={btn.iconOutlined}
              disabled={playable.length === 0}
              onClick={() => playQueue(shuffled(playable), 0)}
              aria-label="Shuffle all"
            >
              <ShuffleIcon />
            </button>
            <Link href="/search" className={btn.iconBare} aria-label="Search">
              <SearchIcon />
            </Link>
          </>
        }
        below={<FilterChips active={filter} onChange={setFilter} />}
      />

      <div className={styles.rule} />
      <ColumnHeader />
      <div className={styles.rule} />

      <ol className={`${styles.list} no-scrollbar`}>
        {error ? (
          <li className={styles.state} role="status">
            Could not load the library — {error}
          </li>
        ) : loading ? (
          <li className={styles.state} role="status">
            Loading…
          </li>
        ) : visible.length === 0 ? (
          <li className={styles.state}>
            {filter === 'ISSUES'
              ? 'Nothing is broken. Every track plays.'
              : filter === 'FAVES'
                ? 'No favourites yet. Tap the heart on any row.'
                : 'No tracks yet. An admin adds them by pasting YouTube links.'}
          </li>
        ) : (
          visible.map((t) => (
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
