'use client';

import { useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { usePlayer } from '@/components/player/PlayerProvider';
import { useApi } from '@/lib/api/client';
import { isPlayable, toTrack, type ApiTrackRow } from '@/lib/library/types';
import { TrackRow } from './TrackRow';
import styles from './LibraryScreen.module.css';
import search from './SearchScreen.module.css';

/**
 * Searches my own stored metadata, never YouTube. Calling `search.list` would
 * cap this feature at 100 requests a day — see the standing constraint in
 * docs/phase-0-youtube-grounding.md §1.2.
 *
 * Filtering is in-memory for now; debouncing and request cancellation arrive
 * with the server-side query in Phase 5.
 */
export function SearchScreen() {
  const { current, playQueue } = usePlayer();
  const [term, setTerm] = useState('');
  const { data, loading } = useApi<ApiTrackRow[]>('/api/tracks?limit=100');

  const tracks = useMemo(() => (data ?? []).map(toTrack), [data]);
  const needle = term.trim().toLowerCase();

  const hits = useMemo(() => {
    if (!needle) return [];
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.channelTitle.toLowerCase().includes(needle) ||
        (t.sortArtist ?? '').toLowerCase().includes(needle),
    );
  }, [tracks, needle]);

  const playable = hits.filter(isPlayable);

  return (
    <>
      <ScreenHeader
        title="Search"
        meta={needle ? `${hits.length} MATCHES` : loading ? 'LOADING…' : 'YOUR LIBRARY ONLY'}
      />
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
        {!needle ? (
          <li className={styles.state}>Type to search titles and channels.</li>
        ) : hits.length === 0 ? (
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
