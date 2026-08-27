'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api/client';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { PlayerPanel } from '@/components/player/PlayerPanel';
import { ServiceWorkerRegistrar } from './ServiceWorkerRegistrar';
import { usePlayer } from '@/components/player/PlayerProvider';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import styles from './AppShell.module.css';

/**
 * The player panel is rendered HERE, in the layout, not in any page. A page
 * unmounts on every client-side navigation; this does not. That is the whole
 * reason playback survives moving between tabs.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { current } = usePlayer();
  const [checked, setChecked] = useState(false);

  // One session check per shell mount. This is also the call that revalidates
  // the cookie against the database, so a revoked session lands here.
  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (cancelled) return;
        if (!s.user) router.replace('/sign-in');
        else setChecked(true);
      })
      .catch(() => {
        if (!cancelled) router.replace('/sign-in');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // The list's bottom spacer has to clear the panel, and the panel is only
  // there when something is queued.
  const playerHeight = current ? 226 : 0;

  return (
    <div
      className={styles.shell}
      style={{ '--player-h': `${playerHeight}px` } as React.CSSProperties}
    >
      <Sidebar />
      <div className={styles.main}>{checked ? children : null}</div>
      <PlayerPanel />
      <TabBar />
      <KeyboardShortcuts />
      <ServiceWorkerRegistrar />
    </div>
  );
}
