'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import { usePlayer } from '@/components/player/PlayerProvider';
import { useApi } from '@/lib/api/client';
import { useDebouncedSearch } from '@/lib/api/use-debounced-search';
import { isPlayable, toTrack, type ApiTrackRow, type Track } from '@/lib/library/types';
import { TrackRow } from './TrackRow';
import styles from './GlassSearchScreen.module.css';

/**
 * Glass-themed Search. Reuses the SAME data layer as SearchScreen:
 * `useDebouncedSearch` against `/api/tracks?limit=100&q=…`, mapped with
 * `toTrack`, and `playQueue` from the player. This search hits MY stored
 * metadata only, never YouTube (docs/phase-0-youtube-grounding.md §1.2).
 *
 * The app has no album/note *search* concept — the endpoint returns only
 * tracks — so we render only ALL / TRACKS tabs. We never fabricate
 * album/note counts.
 */

/** One case-insensitive match wrap. Splits `text` on `q` and marks each hit. */
function highlight(text: string, q: string): React.ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  // Escape regex metacharacters so a query like "c++" is matched literally.
  const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className={styles.mark}>
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Meta line under a track name: channel, plus sortArtist/note when present. */
function metaLine(t: Track, q: string): React.ReactNode {
  const extra = t.sortArtist ?? t.note;
  return (
    <>
      {highlight(t.channelTitle, q)}
      {extra ? <> · {highlight(extra, q)}</> : null}
    </>
  );
}

export function GlassSearchScreen(): React.JSX.Element {
  const { current, playQueue } = usePlayer();
  const [term, setTerm] = useState('');

  const buildPath = useCallback(
    (t: string) => `/api/tracks?limit=100&q=${encodeURIComponent(t)}`,
    [],
  );
  const { results, searching, error, ran } = useDebouncedSearch<ApiTrackRow>(term, buildPath);

  // Library size for the hero + tab context. A search response omits meta.total
  // (the endpoint only counts on an unfiltered first page), so we read it once
  // from the unfiltered list. Cheap: limit=1 returns a single row plus the count.
  const library = useApi<ApiTrackRow[]>('/api/tracks?limit=1');
  const total = typeof library.meta?.total === 'number' ? library.meta.total : null;

  const hits = useMemo(() => results.map(toTrack), [results]);
  const playable = useMemo(() => hits.filter(isPlayable), [hits]);
  const top = hits[0] ?? null;
  const rest = hits.slice(1);

  const q = term.trim();
  const play = useCallback(
    (t: Track) =>
      playQueue(playable, Math.max(0, playable.findIndex((p) => p.id === t.id))),
    [playQueue, playable],
  );

  return (
    <div className={styles.screen}>
      <div className={styles.bloom} aria-hidden="true" />

      <header className={styles.header}>
        <h1 className={styles.title}>Search</h1>

        <div className={styles.searchRow}>
          <div className={styles.field}>
            <svg
              className={styles.searchIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className={styles.input}
              type="search"
              placeholder="Title or channel"
              aria-label="Search your library"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            {term ? (
              <button
                type="button"
                className={styles.clear}
                onClick={() => setTerm('')}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {ran && !error ? (
            <p className={styles.count}>
              {hits.length} result{hits.length === 1 ? '' : 's'}
              {total !== null ? ` in ${total} tracks` : ''}
            </p>
          ) : null}
        </div>

        {ran && !error && hits.length > 0 ? (
          <div className={styles.tabs} role="tablist" aria-label="Result types">
            <span className={`${styles.tab} ${styles.tabActive}`}>ALL {hits.length}</span>
            <span className={styles.tab}>TRACKS {hits.length}</span>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className={styles.state} role="status">
          {error}
        </p>
      ) : !ran ? (
        <div className={styles.hero}>
          <p className={styles.heroTitle}>
            Search your {total !== null ? total : ''} tracks
          </p>
          <p className={styles.heroHint}>Type a title or channel to find a track.</p>
        </div>
      ) : hits.length === 0 && !searching ? (
        <p className={styles.state}>Nothing matches “{q}”.</p>
      ) : (
        <div className={styles.results}>
          {top ? (
            <section className={styles.topWrap}>
              <p className={styles.sectionLabel}>TOP RESULT</p>
              <div className={styles.topCard}>
                <span className={styles.topArt} aria-hidden="true">
                  {top.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={top.thumbnailUrl} alt="" className={styles.topArtImg} />
                  ) : null}
                </span>
                <div className={styles.topText}>
                  <div className={`${styles.topName} truncate`}>{highlight(top.title, q)}</div>
                  <div className={`${styles.topMeta} truncate`}>{metaLine(top, q)}</div>
                </div>
                <button
                  type="button"
                  className={styles.topPlay}
                  onClick={() => play(top)}
                  disabled={!isPlayable(top)}
                >
                  Play
                </button>
              </div>
            </section>
          ) : null}

          <section className={styles.tracksWrap}>
            <p className={styles.sectionLabel}>TRACKS</p>
            <ol className={`${styles.list} no-scrollbar`}>
              {rest.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  playing={current?.id === t.id}
                  onPlay={() => play(t)}
                />
              ))}
              <li className={styles.spacer} aria-hidden="true" />
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
