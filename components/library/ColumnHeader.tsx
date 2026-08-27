import styles from './ColumnHeader.module.css';

export function ColumnHeader() {
  return (
    <div className={styles.header} role="presentation">
      <span className={styles.title}>TITLE / CHANNEL</span>
      {/* Deliberately blank. The column is empty unless a video is blocked, so a
          permanent label would be noise — "everything that isn't information is
          removed". The meaning is carried by each row's accessible name. */}
      <span className={styles.dl}>
        <span className="sr-only">Playback status</span>
      </span>
      <span className={styles.time}>TIME</span>
      <span className={styles.overflowReserve} />
    </div>
  );
}
