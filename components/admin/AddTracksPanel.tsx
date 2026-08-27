'use client';

import { useState } from 'react';
import styles from './AdminScreen.module.css';

/** Mirrors the union returned by POST /api/admin/tracks, one entry per input. */
type Outcome =
  | { input: string; status: 'added'; videoId: string; title: string }
  | {
      input: string;
      status: 'playlist';
      playlistId: string;
      found: number;
      skipped: number;
      truncated: boolean;
    }
  | { input: string; status: 'duplicate'; videoId: string }
  | { input: string; status: 'invalid'; reason: string }
  | { input: string; status: 'not-found'; videoId: string };

type Counts = {
  added: number;
  duplicate: number;
  invalid: number;
  notFound: number;
  playlists: number;
  quotaUnitsSpent: number;
};

const LABEL: Record<Outcome['status'], string> = {
  added: 'ADDED',
  playlist: 'PLAYLIST',
  duplicate: 'DUPLICATE',
  invalid: 'INVALID',
  'not-found': 'NOT FOUND',
};

/**
 * The palette has one colour, so the status word carries the meaning and the
 * class only shades it. CSS module classes are typed as possibly-undefined, so
 * each falls back to no class rather than the string "undefined".
 */
const BADGE: Record<Outcome['status'], string> = {
  added: styles.added ?? '',
  playlist: styles.playlist ?? '',
  duplicate: styles.duplicate ?? '',
  invalid: styles.invalid ?? '',
  'not-found': styles.notfound ?? '',
};

function detail(outcome: Outcome): string {
  if (outcome.status === 'added') return outcome.title;
  if (outcome.status === 'playlist') {
    const parts = [`${outcome.found} videos found`];
    if (outcome.skipped) parts.push(`${outcome.skipped} deleted or private, skipped`);
    if (outcome.truncated) parts.push('capped at 500 — import the rest separately');
    return parts.join(' · ');
  }
  if (outcome.status === 'invalid') return outcome.reason;
  if (outcome.status === 'duplicate') return 'Already in the library';
  return 'Deleted or private on YouTube';
}

function summarise(counts: Counts): string {
  return (
    `${counts.added} added · ${counts.duplicate} duplicate · ` +
    `${counts.invalid} invalid · ${counts.notFound} not found · ` +
    (counts.playlists ? `${counts.playlists} playlist(s) expanded · ` : '') +
    `${counts.quotaUnitsSpent} quota units spent`
  );
}

/**
 * Posts directly rather than through `apiSend`, which returns only the `data`
 * half of the envelope. The per-status counts and the quota spend live in
 * `meta`, and both are the point of this screen.
 */
async function addLinks(text: string): Promise<{ outcomes: Outcome[]; counts: Counts }> {
  const session = await fetch('/api/session', { credentials: 'same-origin' });
  const sessionBody = (await session.json()) as { data?: { csrfToken?: string } };

  const res = await fetch('/api/admin/tracks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': sessionBody.data?.csrfToken ?? '',
    },
    body: JSON.stringify({ text }),
  });

  const body = (await res.json()) as
    | { ok: true; data: Outcome[]; meta: Counts }
    | { ok: false; error: string };

  if (!body.ok) throw new Error(body.error);
  return { outcomes: body.data, counts: body.meta };
}

export function AddTracksPanel() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await addLinks(text);
      setOutcomes(result.outcomes);
      setSummary(summarise(result.counts));
      setText('');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="links">
          YouTube links
        </label>
        <textarea
          id="links"
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={50_000}
          placeholder={'https://youtu.be/…\nhttps://www.youtube.com/watch?v=…'}
        />
        <p className={styles.hint}>
          One per line or comma separated. watch, youtu.be, shorts, embed, live, Music and
          bare ids all work. A playlist link imports every video in it. Duplicates and
          invalid links cost no YouTube quota.
        </p>
        <button type="submit" className={styles.primary} disabled={busy || !text.trim()}>
          {busy ? 'ADDING…' : 'ADD LINKS'}
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
      {outcomes ? (
        <ul className={styles.results} aria-label="Results">
          {outcomes.map((outcome, i) => (
            <li key={`${outcome.input}-${i}`} className={styles.result}>
              <span className={`${styles.badge} ${BADGE[outcome.status]}`}>
                {LABEL[outcome.status]}
              </span>
              <span className={`${styles.resultInput} truncate`}>{outcome.input}</span>
              <span className={`${styles.resultDetail} truncate`}>{detail(outcome)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
