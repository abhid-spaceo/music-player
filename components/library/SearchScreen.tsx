'use client';

import { useCallback, useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { useDebouncedSearch } from '@/lib/api/use-debounced-search';
import { isPlayable, toTrack, type ApiTrackRow } from '@/lib/library/types';
import { TrackRow } from './TrackRow';
import styles from './LibraryScreen.module.css';
import search from './SearchScreen.module.css';

/**
 * Searches MY stored metadata, never YouTube. Calling `search.list` would cap
 * this at 100 requests a day — see the standing constraint in
 * docs/phase-0-youtube-grounding.md §1.2.
 */
export function SearchScreen() {
  const { current, playQueue } = usePlayer();
  const [term, setTerm] = useState('');

  const buildPath = useCallback(
    (t: string) => `/api/tracks?limit=100&q=${encodeURIComponent(t)}`,
    [],
  );
  const { results, searching, error, ran } = useDebouncedSearch<ApiTrackRow>(term, buildPath);

  const hits = useMemo(() => results.map(toTrack), [results]);
  const playable = hits.filter(isPlayable);

  const meta = searching
    ? 'SEARCHING…'
    : ran
      ? `${hits.length} MATCHES`
      : 'YOUR LIBRARY ONLY';

  return (
    <>
      <ScreenHeader title="Search" meta={meta} />
      <div className={search.field}>
        <input
          className={search.input}
          type="search"
          placeholder="Title or channel"
          aria-label="Search your library"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      <div className={styles.rule} />
      <ol className={`${styles.list} no-scrollbar`}>
        {error ? (
          <li className={styles.state} role="status">
            {error}
          </li>
        ) : !ran ? (
          <li className={styles.state}>Type to search titles and channels.</li>
        ) : hits.length === 0 && !searching ? (
          <li className={styles.state}>Nothing matches “{term.trim()}”.</li>
        ) : (
          hits.map((t) => (
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
