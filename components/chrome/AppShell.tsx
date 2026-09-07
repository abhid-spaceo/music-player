'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api/client';
import { KeyboardShortcuts } from '@/components/player/KeyboardShortcuts';
import { PlayerPanel } from '@/components/player/PlayerPanel';
import { NowPlaying } from '@/components/player/NowPlaying';
import { GlassNowPlaying } from '@/components/player/GlassNowPlaying';
import { ServiceWorkerRegistrar } from './ServiceWorkerRegistrar';
import { usePlayer } from '@/components/player/PlayerProvider';
import { useArtGlow } from '@/lib/theme/useArtGlow';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Sidebar } from './Sidebar';
import { GlassSidebar } from './GlassSidebar';
import { TabBar } from './TabBar';
import styles from './AppShell.module.css';

/**
 * The player panel is rendered HERE, in the layout, not in any page. A page
 * unmounts on every client-side navigation; this does not. That is the whole
 * reason playback survives moving between tabs.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const theme = useTheme();
  const { current } = usePlayer();
  // Drives the Glass theme's ambient glow from the current track's artwork.
  // A no-op in the current theme, where --art-glow is unused.
  useArtGlow(current?.thumbnailUrl);
  const [checked, setChecked] = useState(false);
  const [role, setRole] = useState<'admin' | 'listener' | null>(null);

  // One session check per shell mount. This is also the call that revalidates
  // the cookie against the database, so a revoked session lands here.
  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (cancelled) return;
        if (!s.user) router.replace('/sign-in');
        else {
          setRole(s.user.role);
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace('/sign-in');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // The list's bottom spacer has to clear the panel, and the panel is only
  // there when something is queued. 207 is the measured tallest case (360px
  // wide, where the meta column wraps most); it was 226 while the 200px video
  // was in flow. Over-reserving on wider screens only adds blank scroll space.
  const playerHeight = current ? 207 : 0;

  return (
    <div
      className={styles.shell}
      style={{ '--player-h': `${playerHeight}px` } as React.CSSProperties}
    >
      <div className={styles.ambient} aria-hidden="true" />
      {theme === 'glass' ? <GlassSidebar role={role} /> : <Sidebar role={role} />}
      <div className={styles.main}>{checked ? children : null}</div>
      <PlayerPanel />
      {theme === 'glass' ? <GlassNowPlaying /> : <NowPlaying />}
      <TabBar role={role} />
      <KeyboardShortcuts />
      <ServiceWorkerRegistrar />
    </div>
  );
}
