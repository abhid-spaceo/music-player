'use client';

import { useState } from 'react';
import { addLinks, detail, LABEL, summarise, type Outcome } from '@/lib/admin/addLinks';
import styles from './AdminScreen.module.css';

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
