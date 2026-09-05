import { detail, LABEL, type Counts, type Outcome } from '@/lib/admin/addLinks';
import { formatDuration } from '@/lib/format';
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

/** Title column: the track title for an add, otherwise the outcome's reason. */
function titleCell(outcome: Outcome): string {
  return outcome.status === 'added' ? outcome.title : detail(outcome);
}

/** Channel column: the real channel for an add, otherwise the raw input. */
function channelCell(outcome: Outcome): string {
  return outcome.status === 'added' ? outcome.channelTitle : outcome.input;
}

/** Length column: the duration for an add, blank otherwise. */
function lengthCell(outcome: Outcome): string {
  return outcome.status === 'added' ? formatDuration(outcome.durationSec) : '';
}

/**
 * The "LAST BATCH" summary pills + the results table from the Admin mock, with
 * the STATUS / TITLE / CHANNEL / LENGTH columns. Added rows carry the real
 * channel + duration (returned by the add endpoint); other rows put their reason
 * in TITLE and the raw input in CHANNEL.
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
            <th scope="col">CHANNEL</th>
            <th scope="col">LENGTH</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((outcome, i) => (
            <tr key={`${outcome.input}-${i}`}>
              <td>
                <span className={`${styles.badge} ${BADGE[outcome.status]}`}>{LABEL[outcome.status]}</span>
              </td>
              <td className={`${styles.title} truncate`}>{titleCell(outcome)}</td>
              <td className={`${styles.detail} truncate`}>{channelCell(outcome)}</td>
              <td className={styles.length}>{lengthCell(outcome)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
