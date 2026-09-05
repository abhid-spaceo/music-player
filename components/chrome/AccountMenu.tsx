'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/api/client';
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

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
