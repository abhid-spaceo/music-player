'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  QueueIcon,
  LibraryIcon,
  PlaylistsIcon,
  SearchIcon,
} from '@/components/primitives/Icons';
import styles from './TabBar.module.css';

export const DESTINATIONS = [
  { href: '/library', label: 'LIBRARY', Icon: LibraryIcon },
  { href: '/search', label: 'SEARCH', Icon: SearchIcon },
  { href: '/playlists', label: 'PLAYLISTS', Icon: PlaylistsIcon },
  { href: '/queue', label: 'QUEUE', Icon: QueueIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Primary">
      {DESTINATIONS.map(({ href, label, Icon }) => {
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
