'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api/client';
import styles from './AddToPlaylistMenu.module.css';

type Playlist = { id: string; name: string; track_count: number };

/** A bottom sheet that adds the given track to one of the user's playlists. */
export function AddToPlaylistMenu({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    apiGet<Playlist[]>('/api/playlists')
      .then((res) => setLists(res.data))
      .catch(() => setLists([]));
  }, []);

  async function add(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      await apiSend(`/api/playlists/${id}/tracks`, 'POST', { trackId });
      setMsg('Added ✓');
      setTimeout(onClose, 700);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setBusy(null);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy('new');
    setMsg(null);
    try {
      const created = await apiSend<{ id: string }>('/api/playlists', 'POST', { name });
      await apiSend(`/api/playlists/${created.id}/tracks`, 'POST', { trackId });
      setMsg('Created & added ✓');
      setTimeout(onClose, 700);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not create');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-label="Add to playlist"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>Add to playlist</header>
        {msg ? <p className={styles.msg}>{msg}</p> : null}
        {lists === null ? <p className={styles.msg}>Loading…</p> : null}
        {lists?.length === 0 ? <p className={styles.msg}>No playlists yet — create one below.</p> : null}
        <ul className={styles.list}>
          {lists?.map((pl) => (
            <li key={pl.id}>
              <button type="button" disabled={busy !== null} onClick={() => add(pl.id)}>
                <span>{pl.name}</span>
                <span className={styles.count}>{pl.track_count}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.createRow}>
          <input
            className={styles.input}
            placeholder="New playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New playlist name"
          />
          <button type="button" disabled={busy !== null || !newName.trim()} onClick={createAndAdd}>
            Create
          </button>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
