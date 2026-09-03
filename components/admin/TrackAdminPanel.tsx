'use client';

import { useMemo, useState } from 'react';
import { apiSend, useApi } from '@/lib/api/client';
import { formatDuration } from '@/lib/format';
import { AVAILABILITY_LABEL, toTrack, type ApiTrackRow, type Track } from '@/lib/library/types';
import styles from './AdminScreen.module.css';

type RefreshResult = { refreshed: number; markedUnavailable: string[] };
type TagOption = { id: string; kind: 'mood' | 'genre'; name: string; slug: string };

export function TrackAdminPanel() {
  const [term, setTerm] = useState('');
  const { data: tagData } = useApi<TagOption[]>('/api/tags');
  const allTags: TagOption[] = useMemo(() => tagData ?? [], [tagData]);
  // 100 is the route's hard maximum (app/api/tracks/route.ts). Beyond that the
  // table needs paging; search is the way through a bigger library for now.
  const path = term.trim()
    ? `/api/tracks?limit=100&q=${encodeURIComponent(term.trim())}`
    : '/api/tracks?limit=100';
  const { data, error, loading, refetch } = useApi<ApiTrackRow[]>(path);

  const [editing, setEditing] = useState<string | null>(null);
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const tracks: Track[] = useMemo(() => (data ?? []).map(toTrack), [data]);

  function open(track: Track) {
    setEditing(track.id);
    setArtist(track.sortArtist ?? '');
    setNote(track.note ?? '');
    setProblem(null);
    // Pre-select the track's current tags by matching name within each kind.
    const initial = new Set(
      allTags
        .filter(
          (tag) =>
            (tag.kind === 'mood' && track.moods.includes(tag.name)) ||
            (tag.kind === 'genre' && track.genres.includes(tag.name)),
        )
        .map((tag) => tag.id),
    );
    setSelectedTags(initial);
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(id: string) {
    // Blank values are omitted rather than sent as null. The route updates with
    // COALESCE, which ignores null, so sending it would silently keep the old
    // text and look like a save that worked. Clearing is not supported.
    const payload: { sortArtist?: string; note?: string } = {};
    if (artist.trim()) payload.sortArtist = artist.trim();
    if (note.trim()) payload.note = note.trim();
    try {
      // Additive fields only PATCH when provided (route COALESCEs nulls away).
      if (Object.keys(payload).length > 0) {
        await apiSend(`/api/admin/tracks/${id}`, 'PATCH', payload);
      }
      // Tags always save (replace-the-set), so tag-only edits work too.
      await apiSend(`/api/admin/tracks/${id}/tags`, 'PUT', {
        tagIds: [...selectedTags],
      });
      setEditing(null);
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function remove(track: Track) {
    if (!window.confirm(`Delete "${track.title}"? It will also leave every playlist.`)) {
      return;
    }
    try {
      await apiSend(`/api/admin/tracks/${track.id}`, 'DELETE');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  async function checkDeadLinks() {
    if (checking) return;
    setChecking(true);
    setProblem(null);
    try {
      const res = await apiSend<RefreshResult>('/api/admin/tracks/refresh', 'POST', {
        limit: 50,
      });
      setCheckResult(
        `${res.refreshed} re-checked · ${res.markedUnavailable.length} now unavailable`,
      );
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not check');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.panel}>
      <label className={styles.label} htmlFor="track-search">
        Search tracks
      </label>
      <input
        id="track-search"
        className={styles.search}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Title, channel or artist"
      />

      <div className={styles.checkRow}>
        <button
          type="button"
          className={styles.rowButton}
          onClick={checkDeadLinks}
          disabled={checking}
        >
          {checking ? 'CHECKING…' : 'CHECK FOR DEAD LINKS'}
        </button>
        {checkResult ? (
          <span className={styles.summary} role="status" data-testid="check-result">
            {checkResult}
          </span>
        ) : null}
      </div>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}

      <ul className={styles.tracks} aria-label="Tracks">
        {error ? (
          <li className={styles.state} role="status">
            Could not load tracks — {error}
          </li>
        ) : tracks.length === 0 && !loading ? (
          <li className={styles.state}>No tracks match.</li>
        ) : (
          tracks.map((track) => (
            <li key={track.id} className={styles.trackRow}>
              <div className={styles.trackMain}>
                <span className={`${styles.trackTitle} truncate`}>{track.title}</span>
                <span className={`${styles.trackMeta} truncate`}>
                  {track.sortArtist ?? track.channelTitle} ·{' '}
                  {formatDuration(track.durationSec)}
                  {AVAILABILITY_LABEL[track.availability]
                    ? ` · ${AVAILABILITY_LABEL[track.availability]}`
                    : ''}
                </span>

                {editing === track.id ? (
                  <div className={styles.editor}>
                    <label className={styles.label} htmlFor={`artist-${track.id}`}>
                      Sort artist
                    </label>
                    <input
                      id={`artist-${track.id}`}
                      className={styles.search}
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      maxLength={200}
                    />
                    <label className={styles.label} htmlFor={`note-${track.id}`}>
                      Note
                    </label>
                    <input
                      id={`note-${track.id}`}
                      className={styles.search}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                    />
                    <span className={styles.label}>Moods</span>
                    <div className={styles.tagChips}>
                      {allTags
                        .filter((tag) => tag.kind === 'mood')
                        .map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            className={styles.tagChip}
                            aria-pressed={selectedTags.has(tag.id)}
                            onClick={() => toggleTag(tag.id)}
                          >
                            {tag.name}
                          </button>
                        ))}
                    </div>
                    <span className={styles.label}>Genres</span>
                    <div className={styles.tagChips}>
                      {allTags
                        .filter((tag) => tag.kind === 'genre')
                        .map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            className={styles.tagChip}
                            aria-pressed={selectedTags.has(tag.id)}
                            onClick={() => toggleTag(tag.id)}
                          >
                            {tag.name}
                          </button>
                        ))}
                    </div>
                    <div className={styles.editorActions}>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => save(track.id)}
                      >
                        SAVE
                      </button>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => setEditing(null)}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className={styles.rowButton}
                onClick={() => open(track)}
                aria-label={`Edit ${track.title}`}
              >
                EDIT
              </button>
              <button
                type="button"
                className={styles.rowButton}
                onClick={() => remove(track)}
                aria-label={`Delete ${track.title}`}
              >
                DELETE
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
