'use client';

import { useState } from 'react';
import { addDirectTrack } from '@/lib/admin/addLinks';
import styles from './AddDirectAudio.module.css';

/**
 * Adds one direct-audio track: a track whose audio is an https URL played
 * through the app's own <audio> element instead of the YouTube embed. That is
 * the only kind of track that keeps playing when the phone is locked.
 *
 * Three fields rather than the paste box next door, because a URL alone gives
 * no title and the paste box splits on whitespace. Shared by both admin
 * surfaces so Current and Glass post through one path.
 */
export function AddDirectAudio() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const ready = url.trim() !== '' && title.trim() !== '' && artist.trim() !== '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    setAdded(null);
    try {
      const track = await addDirectTrack(url.trim(), title.trim(), artist.trim());
      setAdded(`${track.title} — ${track.artist}`);
      setUrl('');
      setTitle('');
      setArtist('');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add that track');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>Add an audio link</h2>
        <span className={styles.badge}>plays in the background · no quota</span>
      </div>
      <p className={styles.lede}>
        A direct link to an audio file, for example from the Internet Archive. Unlike a
        YouTube track this keeps playing when the screen is locked, and shows controls on
        the lock screen. Nothing is uploaded — only the address is stored.
      </p>

      <form onSubmit={submit}>
        <div className={styles.rows}>
          <label className={styles.badge} htmlFor="direct-url">
            Audio URL
          </label>
          <input
            id="direct-url"
            className={styles.input}
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2000}
            placeholder="https://archive.org/download/…/track.mp3"
          />
          <div className={styles.pair}>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              aria-label="Title"
              placeholder="Title"
            />
            <input
              className={styles.input}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              maxLength={300}
              aria-label="Artist"
              placeholder="Artist"
            />
          </div>
        </div>
        <div className={styles.foot}>
          <button type="submit" className={styles.submit} disabled={busy || !ready}>
            {busy ? 'Checking the link…' : 'Add track'}
          </button>
        </div>
      </form>

      {problem ? (
        <p className={`${styles.note} ${styles.bad}`} role="alert">
          {problem}
        </p>
      ) : null}
      {added ? (
        <p className={`${styles.note} ${styles.good}`} role="status">
          Added {added}
        </p>
      ) : null}
    </section>
  );
}
