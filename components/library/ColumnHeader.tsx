import styles from './ColumnHeader.module.css';

export function ColumnHeader() {
  return (
    <div className={styles.header} role="presentation">
      <span className={styles.title}>TITLE / CHANNEL</span>
      <span className={styles.dl} aria-label="Playback status">!</span>
      <span className={styles.time}>TIME</span>
      <span className={styles.overflowReserve} />
    </div>
  );
}
