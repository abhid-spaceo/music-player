'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BrowseIcon,
  LibraryIcon,
  PlaylistsIcon,
  QueueIcon,
  SearchIcon,
} from '@/components/primitives/Icons';
import { getSession, useApi } from '@/lib/api/client';
import { QuotaWidget } from '@/components/admin/glass/QuotaWidget';
import type { Role } from './TabBar';
import styles from './GlassSidebar.module.css';

/** Primary nav — mirrors the design's rail (Library/Browse/Search/Playlists/Queue). */
const NAV = [
  { href: '/library', label: 'Library', Icon: LibraryIcon },
  { href: '/browse', label: 'Browse', Icon: BrowseIcon },
  { href: '/search', label: 'Search', Icon: SearchIcon },
  { href: '/playlists', label: 'Playlists', Icon: PlaylistsIcon },
  { href: '/queue', label: 'Queue', Icon: QueueIcon },
] as const;

/** The admin sub-nav, shown only on /admin* routes for an admin (design 3e). */
const ADMIN_SECTION = [
  { href: '/admin', label: 'Add links' },
  { href: '/admin/tracks', label: 'Tracks' },
  { href: '/admin/playlist-import', label: 'Playlist import' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/link-health', label: 'Link health' },
] as const;

/** Rotating tile gradients so each playlist chip carries its own colour. */
const TILE_GRADIENTS = [
  'linear-gradient(140deg,#8A5CFF,#3B2BFF)',
  'linear-gradient(140deg,#FF6B6B,#FFB86B)',
  'linear-gradient(140deg,#2FD3B0,#1E7BFF)',
  'linear-gradient(140deg,#C4B5FD,#FF8FC3)',
];

type PlaylistRow = { id: string; name: string };

/**
 * The glass "Personal FM" rail (design desktop artboards): brand mark, primary
 * nav, the user's playlists, and an account card pinned to the bottom — the
 * account/sign-out lives here, so glass desktop needs no top bar. On /admin*
 * routes for an admin it also grows the ADMIN sub-nav + live quota widget.
 *
 * Glass-only: AppShell renders the Current `Sidebar` instead when the theme is
 * current, so this never affects that theme.
 */
export function GlassSidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const { data: playlists } = useApi<PlaylistRow[]>('/api/playlists');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (!cancelled) setEmail(s.user?.email ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const showAdmin = role === 'admin' && pathname.startsWith('/admin');
  const initial = (email?.[0] ?? 'A').toUpperCase();

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true" />
        <span className={styles.brandName}>Personal FM</span>
      </div>

      <div className={styles.nav}>
        {NAV.map(({ href, label, Icon }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={styles.navItem}
              aria-current={current ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {showAdmin ? (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>ADMIN</span>
          {ADMIN_SECTION.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={styles.subLink}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
          <div className={styles.quota}>
            <QuotaWidget />
          </div>
        </div>
      ) : (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>YOUR PLAYLISTS</span>
          {(playlists ?? []).slice(0, 6).map((p, i) => (
            <Link key={p.id} href={`/playlists/${p.id}`} className={styles.playlistRow}>
              <span
                className={styles.tile}
                style={{ background: TILE_GRADIENTS[i % TILE_GRADIENTS.length] }}
                aria-hidden="true"
              />
              <span className={`${styles.playlistName} truncate`}>{p.name}</span>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.account}>
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.accountText}>
          <span className={`${styles.email} truncate`}>{email ?? '—'}</span>
          {role === 'admin' ? <span className={styles.adminBadge}>ADMIN</span> : null}
        </span>
      </div>
    </nav>
  );
}
