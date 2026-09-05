'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { QuotaWidget } from '@/components/admin/glass/QuotaWidget';
import { visibleDestinations, type Role } from './TabBar';
import styles from './Sidebar.module.css';

/** The ADMIN sub-nav (design 3e). Real routes; the current theme redirects the
 *  sub-routes back to /admin, so these only ever resolve to a glass page. */
const ADMIN_SECTION = [
  { href: '/admin', label: 'Add links' },
  { href: '/admin/tracks', label: 'Tracks' },
  { href: '/admin/playlist-import', label: 'Playlist import' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/link-health', label: 'Link health' },
] as const;

export function Sidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const theme = useTheme();

  // The single rail from Image #6: the ADMIN sub-nav + quota fold into the
  // sidebar, but only for an admin on an admin route in the glass theme.
  // Everywhere else the sidebar is exactly as before.
  const showAdmin = theme === 'glass' && role === 'admin' && pathname.startsWith('/admin');

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      {visibleDestinations(role).map(({ href, label, Icon }) => {
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

      {showAdmin ? (
        <>
          <div className={styles.adminSection}>
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
          </div>
          <div className={styles.quota}>
            <QuotaWidget />
          </div>
        </>
      ) : null}
    </nav>
  );
}
