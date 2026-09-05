import styles from './GlassAdminShell.module.css';

/**
 * Layout frame for the glass admin sub-pages (Tracks / Playlist import / Users /
 * Link health). Provides the screen padding and the page title; the sub-nav and
 * quota live in the sidebar rail, so a sub-page only supplies its title + body.
 */
export function GlassAdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
