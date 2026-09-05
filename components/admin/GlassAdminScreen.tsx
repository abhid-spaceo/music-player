'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSession } from '@/lib/api/client';
import {
  addLinks,
  detectLinks,
  estimateQuota,
  type Counts,
  type Outcome,
} from '@/lib/admin/addLinks';
import { QuotaWidget } from './glass/QuotaWidget';
import { AddLinksResults } from './glass/AddLinksResults';
import styles from './GlassAdminScreen.module.css';

type Batch = { outcomes: Outcome[]; counts: Counts };

/**
 * Sub-nav from the Admin mock. Only "Add links" is live in SP1; the rest render
 * but are inert — SP2 builds them as real glass pages and folds this rail into
 * the global sidebar. Kept here (not in the shared Sidebar) so SP1 does not
 * touch chrome used by every other screen.
 */
const SUBNAV = ['Add links', 'Tracks', 'Playlist import', 'Users', 'Link health'] as const;

/**
 * Glass variant of the Admin add-links screen (mock 3e): flat --bg-deep, no
 * bloom (a data surface). Glass appears only on the paste field and the result
 * pills/table. Reuses the shared add-links network path so Current and Glass
 * post identically.
 */
export function GlassAdminScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (!cancelled) setEmail(s.user?.email ?? null);
      })
      .catch(() => {
        // The screen works without the email; the pill just omits it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const detected = useMemo(() => detectLinks(text), [text]);
  const estUnits = estimateQuota(detected.length);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await addLinks(text);
      setBatch({ outcomes: result.outcomes, counts: result.counts });
      setText('');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <nav className={styles.subnav} aria-label="Admin sections">
        {SUBNAV.map((item) => {
          const active = item === 'Add links';
          return (
            <button
              key={item}
              type="button"
              className={styles.subnavItem}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              aria-disabled={active ? undefined : true}
              title={active ? undefined : 'Coming in SP2'}
              onClick={active ? undefined : (e) => e.preventDefault()}
            >
              {item}
            </button>
          );
        })}
      </nav>

      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <h1 className={styles.title}>Add links</h1>
          <p className={styles.lede}>
            Paste any number of YouTube links, one per line or comma separated. Invalid links
            and duplicates cost no quota — they are rejected before the API is called.
          </p>
        </div>
        <div className={styles.aside}>
          <span className={styles.adminPill}>
            <span className={styles.dot} aria-hidden="true" />
            ADMIN · {email ?? '—'}
          </span>
          <QuotaWidget used={12} limit={10_000} />
        </div>
      </header>

      <form className={styles.field} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="glass-links">
          YouTube links
        </label>
        <textarea
          id="glass-links"
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          maxLength={50_000}
          placeholder={
            'https://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=9bZkp7q19f0\nyoutube.com/shorts/aB3dEfGhIjK'
          }
        />
        <div className={styles.fieldFoot}>
          <span className={styles.detected}>
            {detected.length} LINK{detected.length === 1 ? '' : 'S'} DETECTED · EST. {estUnits} QUOTA
            UNIT{estUnits === 1 ? '' : 'S'}
          </span>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.clear}
              onClick={() => setText('')}
              disabled={busy || !text}
            >
              Clear
            </button>
            <button type="submit" className={styles.primary} disabled={busy || !text.trim()}>
              {busy ? 'Adding…' : 'Add to library'}
            </button>
          </div>
        </div>
      </form>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}
      {batch ? <AddLinksResults outcomes={batch.outcomes} counts={batch.counts} /> : null}
    </div>
  );
}
