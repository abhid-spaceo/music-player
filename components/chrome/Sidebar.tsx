'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DESTINATIONS } from './TabBar';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      {DESTINATIONS.map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={styles.link}
            aria-current={current ? 'page' : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
