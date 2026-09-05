import { detail, LABEL, type Counts, type Outcome } from '@/lib/admin/addLinks';
import styles from './AddLinksResults.module.css';

interface AddLinksResultsProps {
  outcomes: Outcome[];
  counts: Counts;
}

/** Shade class per status — the word carries meaning, the class only tints it. */
const BADGE: Record<Outcome['status'], string> = {
  added: styles.added ?? '',
  playlist: styles.playlist ?? '',
  duplicate: styles.duplicate ?? '',
  invalid: styles.invalid ?? '',
  'not-found': styles.notfound ?? '',
};

function primary(outcome: Outcome): string {
  if (outcome.status === 'added') return outcome.title;
  return outcome.input;
}

/**
 * The "LAST BATCH" summary pills + the results table from the Admin mock. The
 * design's CHANNEL / LENGTH columns need per-track metadata the add endpoint
 * does not return yet (an SP2 backend item), so SP1 shows STATUS / TITLE /
 * DETAIL — the fields the response actually carries.
 */
export function AddLinksResults({ outcomes, counts }: AddLinksResultsProps) {
  const inputs = outcomes.length;

  return (
    <section className={styles.wrap} aria-label="Last batch results">
      <header className={styles.head}>
        <span className={styles.headLabel}>
          LAST BATCH · {inputs} INPUT{inputs === 1 ? '' : 'S'} · {counts.quotaUnitsSpent} QUOTA UNIT
          {counts.quotaUnitsSpent === 1 ? '' : 'S'} SPENT
        </span>
        <div className={styles.pills}>
          {counts.added ? <span className={`${styles.pill} ${styles.added}`}>{counts.added} ADDED</span> : null}
          {counts.duplicate ? (
            <span className={`${styles.pill} ${styles.duplicate}`}>{counts.duplicate} DUPLICATE</span>
          ) : null}
          {counts.invalid ? (
            <span className={`${styles.pill} ${styles.invalid}`}>{counts.invalid} INVALID</span>
          ) : null}
          {counts.notFound ? (
            <span className={`${styles.pill} ${styles.notfound}`}>{counts.notFound} NOT FOUND</span>
          ) : null}
        </div>
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">STATUS</th>
            <th scope="col">TITLE</th>
            <th scope="col">DETAIL</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((outcome, i) => (
            <tr key={`${outcome.input}-${i}`}>
              <td>
                <span className={`${styles.badge} ${BADGE[outcome.status]}`}>{LABEL[outcome.status]}</span>
              </td>
              <td className={`${styles.title} truncate`}>{primary(outcome)}</td>
              <td className={`${styles.detail} truncate`}>{detail(outcome)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
