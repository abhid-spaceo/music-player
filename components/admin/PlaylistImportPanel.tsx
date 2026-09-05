'use client';

import { useMemo, useState } from 'react';
import styles from './AdminScreen.module.css';

type PreviewItem = { videoId: string; title: string; alreadyInLibrary: boolean };
type PreviewMeta = {
  playlistId: string;
  total: number;
  alreadyInLibrary: number;
  skipped: number;
  truncated: boolean;
  quotaUnitsSpent: number;
};
type AddCounts = { added: number; duplicate: number; notFound: number; invalid: number };

/** The CSRF token lives on the session envelope, same as the other admin posts. */
async function csrfToken(): Promise<string> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  const body = (await res.json()) as { data?: { csrfToken?: string } };
  return body.data?.csrfToken ?? '';
}

async function previewPlaylist(url: string): Promise<{ items: PreviewItem[]; meta: PreviewMeta }> {
  const res = await fetch('/api/admin/playlist/preview', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': await csrfToken() },
    body: JSON.stringify({ url }),
  });
  const body = (await res.json()) as
    | { ok: true; data: PreviewItem[]; meta: PreviewMeta }
    | { ok: false; error: string };
  if (!body.ok) throw new Error(body.error);
  return { items: body.data, meta: body.meta };
}

/** Reuses the existing add route: it dedupes, fetches metadata and inserts. */
async function addSelected(videoIds: string[]): Promise<AddCounts> {
  const res = await fetch('/api/admin/tracks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': await csrfToken() },
    body: JSON.stringify({ urls: videoIds.map((id) => `https://www.youtube.com/watch?v=${id}`) }),
  });
  const body = (await res.json()) as
    | { ok: true; data: unknown[]; meta: AddCounts }
    | { ok: false; error: string };
  if (!body.ok) throw new Error(body.error);
  return body.meta;
}

export function PlaylistImportPanel() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const selectable = useMemo(() => (items ?? []).filter((i) => !i.alreadyInLibrary), [items]);

  async function preview(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    setSummary(null);
    try {
      const result = await previewPlaylist(url.trim());
      setItems(result.items);
      setMeta(result.meta);
      // Start with everything that is not already in the library ticked.
      setSelected(new Set(result.items.filter((i) => !i.alreadyInLibrary).map((i) => i.videoId)));
    } catch (err: unknown) {
      setItems(null);
      setMeta(null);
      setProblem(err instanceof Error ? err.message : 'Could not load playlist');
    } finally {
      setBusy(false);
    }
  }

  function toggle(videoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  async function add() {
    if (adding || selected.size === 0) return;
    setAdding(true);
    setProblem(null);
    try {
      const counts = await addSelected([...selected]);
      setSummary(
        `${counts.added} added · ${counts.duplicate} already there · ${counts.notFound} unavailable`,
      );
      // Reflect the result: the ones we just added are now in the library.
      setItems((prev) =>
        (prev ?? []).map((i) => (selected.has(i.videoId) ? { ...i, alreadyInLibrary: true } : i)),
      );
      setSelected(new Set());
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add selected');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.panel}>
      <form onSubmit={preview}>
        <label className={styles.label} htmlFor="playlist-url">
          Playlist link
        </label>
        <input
          id="playlist-url"
          className={styles.search}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=…"
        />
        <p className={styles.hint}>
          Paste a playlist link (a plain playlist?list=… URL, not a watch link). Load it,
          then tick the songs you want — only the ones you pick are added. Duplicates and
          unavailable videos are skipped automatically.
        </p>
        <button type="submit" className={styles.primary} disabled={busy || !url.trim()}>
          {busy ? 'LOADING…' : 'LOAD PLAYLIST'}
        </button>
      </form>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}
      {summary ? (
        <p className={styles.summary} role="status">
          {summary}
        </p>
      ) : null}

      {items ? (
        items.length === 0 ? (
          <p className={styles.summary}>This playlist has no importable videos.</p>
        ) : (
          <>
            <div className={styles.pickBar}>
              <span className={styles.pickCount} role="status">
                {selected.size} of {selectable.length} selected
                {meta?.alreadyInLibrary ? ` · ${meta.alreadyInLibrary} in library` : ''}
                {meta?.truncated ? ' · capped at 500' : ''}
              </span>
              <div className={styles.pickActions}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => setSelected(new Set(selectable.map((i) => i.videoId)))}
                >
                  ALL
                </button>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => setSelected(new Set())}
                >
                  NONE
                </button>
              </div>
            </div>

            <button
              type="button"
              className={styles.primary}
              onClick={add}
              disabled={adding || selected.size === 0}
            >
              {adding ? 'ADDING…' : `ADD SELECTED (${selected.size})`}
            </button>

            <ul className={styles.pickList} aria-label="Playlist songs">
              {items.map((item) => (
                <li key={item.videoId} className={styles.pickRow}>
                  <label className={styles.pick}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selected.has(item.videoId)}
                      disabled={item.alreadyInLibrary}
                      onChange={() => toggle(item.videoId)}
                    />
                    <span className={`${styles.pickTitle} truncate`}>{item.title}</span>
                  </label>
                  {item.alreadyInLibrary ? <span className={styles.pickTag}>IN LIBRARY</span> : null}
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}
