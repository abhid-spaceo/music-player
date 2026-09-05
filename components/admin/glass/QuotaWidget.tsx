import styles from './QuotaWidget.module.css';

interface QuotaWidgetProps {
  /** Units spent today. SP1 passes a static placeholder; SP2 wires the real meter. */
  used: number;
  /** Daily YouTube Data API allowance. */
  limit: number;
}

/**
 * The "YOUTUBE QUOTA n / limit" card from the Admin mock. SP1 renders it with a
 * static value (there is no quota-accounting store yet) — SP2 replaces the props
 * source with real per-day usage. Purely presentational.
 */
export function QuotaWidget({ used, limit }: QuotaWidgetProps) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = Math.max(0, limit - used).toLocaleString();

  return (
    <div className={styles.card}>
      <span className={styles.label}>YOUTUBE QUOTA</span>
      <p className={styles.value}>
        <strong>{remaining}</strong>
        <span className={styles.of}> / {limit.toLocaleString()}</span>
      </p>
      <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.resets}>Resets 00:00 PT</span>
    </div>
  );
}
