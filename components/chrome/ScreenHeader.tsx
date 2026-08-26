import styles from './ScreenHeader.module.css';

type Props = {
  title: string;
  /** e.g. "16 TRACKS · 8 OFFLINE". Omitted on screens with nothing to count. */
  meta?: string;
  actions?: React.ReactNode;
  /** Filter chips or similar, on their own row beneath the meta line. */
  below?: React.ReactNode;
};

export function ScreenHeader({ title, meta, actions, below }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={`${styles.title} truncate`}>{title}</h1>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {meta ? <p className={`${styles.meta} tnum`}>{meta}</p> : null}
      {below ? <div className={styles.below}>{below}</div> : null}
    </header>
  );
}
