'use client';

import styles from './FilterChips.module.css';

/**
 * The canvas's chips, adapted to the product: there is no offline in this
 * architecture, a YouTube video has a channel rather than an artist, and
 * ISSUES surfaces the link rot that a library of links accumulates.
 */
export const FILTERS = ['RECENT', 'A–Z', 'CHANNEL', 'FAVES', 'ISSUES'] as const;
export type Filter = (typeof FILTERS)[number];

type Props = { active: Filter; onChange: (f: Filter) => void };

export function FilterChips({ active, onChange }: Props) {
  return (
    <div className={styles.chips} role="group" aria-label="Sort and filter">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          className={styles.chip}
          aria-pressed={f === active}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
