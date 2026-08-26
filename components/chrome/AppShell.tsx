'use client';

import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import styles from './AppShell.module.css';

/**
 * Chrome only. The player surface is deliberately absent until Phase 3, which
 * must mount it ABOVE the router as a single never-remounted instance — a
 * client-side navigation that unmounts the iframe stops playback.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>{children}</div>
      <TabBar />
    </div>
  );
}
