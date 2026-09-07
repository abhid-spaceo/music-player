'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '@/components/player/PlayerProvider';
import { SearchIcon, ShuffleIcon } from '@/components/primitives/Icons';
import { apiGet, useApi } from '@/lib/api/client';
import { isPlayable, toTrack, type ApiTrackRow, type Track } from '@/lib/library/types';
import styles from './GlassBrowseScreen.module.css';

// Same tag/selection shapes BrowseScreen uses — kept local (BrowseScreen keeps
// them local too) so this stays self-contained.
type Tag = { id: string; kind: 'mood' | 'genre'; name: string; slug: string };
type Selected = { kind: 'mood' | 'genre'; slug: string; name: string } | null;

// Playlist row as /api/playlists returns it (see app/api/playlists/route.ts:
// id, name, description, track_count, total_sec). Only the fields the tiles show.
type PlaylistRow = { id: string; name: string; track_count: number };

// How many artwork tiles a section shows before "See all". The desktop artboard
// lays out five across; one row of tiles is enough for the landing view.
const TILE_COUNT = 10;

export function GlassBrowseScreen() {
  const { current, playQueue } = usePlayer();

  // Real tag list (moods + genres) — same endpoint and hook BrowseScreen uses.
  const { data: tags } = useApi<Tag[]>('/api/tags');
  // Recently-played source: /api/tracks is ordered added_at DESC. The app has no
  // per-user play-history feed yet, so "most recently added" is the closest real
  // ordering — an approximation, not fabricated data.
  const { data: recentRows } = useApi<ApiTrackRow[]>(`/api/tracks?limit=${TILE_COUNT}`);
  const { data: playlists } = useApi<PlaylistRow[]>('/api/playlists');

  const chips = useMemo(() => tags ?? [], [tags]);
  const recent = useMemo<Track[]>(() => (recentRows ?? []).map(toTrack), [recentRows]);

  // Chip filter — mirrors BrowseScreen: pick a mood/genre, fetch filtered tracks,
  // only trust the result whose key matches the current selection.
  const [selected, setSelected] = useState<Selected>(null);
  const [result, setResult] = useState<{ key: string; tracks: Track[] } | null>(null);
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

  const filtered = result && result.key === selKey ? result.tracks : null;
  // When a chip is active the tiles show the filtered tracks; otherwise "recent".
  const tiles = selected ? filtered ?? [] : recent;

  // Play a single tile: build a playable queue from what's on screen and start
  // at the clicked track — same play integration as BrowseScreen/TrackRow.
  const playFrom = (track: Track): void => {
    const playable = tiles.filter(isPlayable);
    const start = Math.max(0, playable.findIndex((p) => p.id === track.id));
    if (playable.length > 0) playQueue(playable, start);
  };

  // Shuffle library: play every currently-shown playable track from a random
  // start. No fabricated shuffle state — just a random entry point.
  const shuffleLibrary = (): void => {
    const playable = recent.filter(isPlayable);
    if (playable.length === 0) return;
    const start = Math.floor(Math.random() * playable.length);
    playQueue(playable, start);
  };

  const toggleChip = (t: Tag): void =>
    setSelected((prev) =>
      prev && prev.kind === t.kind && prev.slug === t.slug
        ? null
        : { kind: t.kind, slug: t.slug, name: t.name },
    );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Browse</h1>
          <p className={styles.subtitle}>
            Everything you have listened to lately, and what sits next to it
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.shuffle} onClick={shuffleLibrary}>
            <ShuffleIcon size={16} />
            Shuffle library
          </button>
          <button type="button" className={styles.searchBtn} aria-label="Search">
            <SearchIcon size={18} />
          </button>
        </div>
      </header>

      {/* Flat row of real mood + genre chips. Clicking filters the tiles. */}
      <div className={styles.chips}>
        {chips.map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.chip}
            aria-pressed={selected?.kind === t.kind && selected.slug === t.slug}
            onClick={() => toggleChip(t)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>
            {selected ? selected.name.toUpperCase() : 'RECENTLY PLAYED'}
          </span>
          <button type="button" className={styles.seeAll}>
            See all
          </button>
        </div>
        <div className={styles.tileGrid}>
          {tiles.map((track) => (
            <button
              key={track.id}
              type="button"
              className={styles.tile}
              data-playing={current?.id === track.id}
              disabled={!isPlayable(track)}
              onClick={() => playFrom(track)}
            >
              <span className={styles.cover}>
                {track.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.thumbnailUrl} alt="" className={styles.coverImg} />
                ) : null}
              </span>
              <span className={`${styles.tileName} truncate`}>{track.title}</span>
              <span className={`${styles.tileSub} truncate`}>{track.channelTitle}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>YOUR PLAYLISTS</span>
          <button type="button" className={styles.seeAll}>
            New playlist
          </button>
        </div>
        <div className={styles.tileGrid}>
          {(playlists ?? []).map((p) => (
            <div key={p.id} className={styles.playlistTile}>
              <span className={styles.playlistCover} aria-hidden="true" />
              <span className={`${styles.tileName} truncate`}>{p.name}</span>
              <span className={styles.tileSub}>{p.track_count} tracks</span>
            </div>
          ))}
          {/* Dashed creator tile — parity with the artboard's "NEW" affordance. */}
          <button type="button" className={styles.newTile}>
            <span className={styles.plus} aria-hidden="true">
              +
            </span>
            <span className={styles.newLabel}>NEW</span>
          </button>
        </div>
      </section>
    </div>
  );
}
