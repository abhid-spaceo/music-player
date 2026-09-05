'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/api/client';
import {
  DEFAULT_THEME,
  normalizeTheme,
  serializeThemeCookie,
  type ThemeName,
} from '@/lib/theme/theme';
import styles from './AccountMenu.module.css';

/**
 * Account affordance in the screen header: a person icon that opens a small
 * menu showing the signed-in email and a sign-out button. Rendered once inside
 * ScreenHeader, so it appears on every screen that has a header.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Seeded from the <html data-theme> the server already set, so the menu shows
  // the true current choice. Lazy (not an effect) to avoid a cascading render;
  // safe because the theme UI only renders once the menu is opened, after
  // hydration. Falls back to the default during SSR where document is absent.
  const [theme, setTheme] = useState<ThemeName>(() =>
    typeof document === 'undefined'
      ? DEFAULT_THEME
      : normalizeTheme(document.documentElement.dataset.theme),
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  function chooseTheme(next: ThemeName) {
    if (next === theme) return;
    // 1) persist for future loads, 2) re-skin instantly with no reload,
    // 3) refresh so any server-rendered output agrees with the cookie.
    document.cookie = serializeThemeCookie(next);
    document.documentElement.dataset.theme = next;
    setTheme(next);
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (!cancelled) setEmail(s.user?.email ?? null);
      })
      .catch(() => {
        // The header still works without the email; the sign-out button is the
        // point, and it does not depend on this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While open, close on an outside tap or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even if the request fails, fall through to the sign-in page — the cookie
      // may already be gone, and this is the recovery path.
    } finally {
      // /sign-in lives outside the (app) layout, so this unmounts the player and
      // the rest of the authed subtree. replace() keeps the signed-out page out
      // of history, so Back cannot return into the app.
      router.replace('/sign-in');
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <PersonGlyph />
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          {email ? (
            <p className={styles.who}>
              <span className={styles.whoLabel}>SIGNED IN AS</span>
              <span className={`${styles.email} truncate`}>{email}</span>
            </p>
          ) : null}

          <div className={styles.section}>
            <span className={styles.sectionLabel}>DESIGN</span>
            <div className={styles.segmented} role="group" aria-label="Design">
              <button
                type="button"
                className={styles.segment}
                role="menuitemradio"
                aria-checked={theme === 'glass'}
                data-active={theme === 'glass'}
                onClick={() => chooseTheme('glass')}
              >
                Glass
              </button>
              <button
                type="button"
                className={styles.segment}
                role="menuitemradio"
                aria-checked={theme === 'current'}
                data-active={theme === 'current'}
                onClick={() => chooseTheme('current')}
              >
                Current
              </button>
            </div>
          </div>

          <button
            type="button"
            className={styles.signout}
            role="menuitem"
            onClick={signOut}
            disabled={busy}
          >
            {busy ? 'SIGNING OUT…' : 'SIGN OUT'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const PersonGlyph = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);
