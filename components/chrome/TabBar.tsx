'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  QueueIcon,
  LibraryIcon,
  PlaylistsIcon,
  SearchIcon,
  AdminIcon,
} from '@/components/primitives/Icons';
import styles from './TabBar.module.css';

export type Role = 'admin' | 'listener';

export const DESTINATIONS = [
  { href: '/library', label: 'LIBRARY', Icon: LibraryIcon, adminOnly: false },
  { href: '/search', label: 'SEARCH', Icon: SearchIcon, adminOnly: false },
  { href: '/playlists', label: 'PLAYLISTS', Icon: PlaylistsIcon, adminOnly: false },
  { href: '/queue', label: 'QUEUE', Icon: QueueIcon, adminOnly: false },
  { href: '/admin', label: 'ADMIN', Icon: AdminIcon, adminOnly: true },
] as const;

/**
 * Hides admin-only entries. The server enforces the role on every admin route;
 * this is chrome, so a wrong answer here is a cosmetic bug, never a hole.
 */
export function visibleDestinations(role: Role | null) {
  return DESTINATIONS.filter((d) => !d.adminOnly || role === 'admin');
}

export function TabBar({ role }: { role: Role | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Primary">
      {visibleDestinations(role).map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={styles.tab}
            aria-current={current ? 'page' : undefined}
          >
            <Icon />
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
