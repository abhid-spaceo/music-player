'use client';

import { useState } from 'react';
import styles from './GlassSignIn.module.css';

interface GlassSignInProps {
  email: string;
  password: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  busy: boolean;
  hydrated: boolean;
  error: string | null;
}

/**
 * Glass sign-in (design mock 3d / Image #8): brand mark, a frosted "Welcome
 * back" card with the email/password fields and a gradient CTA, and a footer
 * note. Presentational only — all auth state/logic stays in SignInPage and is
 * passed in, so Current and Glass share one submit path.
 */
export function GlassSignIn({
  email,
  password,
  onEmail,
  onPassword,
  onSubmit,
  busy,
  hydrated,
  error,
}: GlassSignInProps) {
  const [reveal, setReveal] = useState(false);
  const [hint, setHint] = useState(false);

  return (
    <main className={styles.wrap}>
      <div className={styles.bloom} aria-hidden="true" />

      <div className={styles.column}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true" />
          <span className={styles.brandName}>Personal FM</span>
        </div>

        <form className={styles.card} onSubmit={onSubmit}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Your library is waiting where you left it.</p>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <label className={styles.label} htmlFor="email">
            EMAIL
          </label>
          <div className={styles.fieldBox}>
            <input
              id="email"
              className={styles.input}
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => onEmail(e.target.value)}
            />
          </div>

          <label className={styles.label} htmlFor="password">
            PASSWORD
          </label>
          <div className={styles.fieldBox}>
            <input
              id="password"
              className={styles.input}
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => onPassword(e.target.value)}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              aria-pressed={reveal}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </button>
          </div>

          <button className={styles.submit} type="submit" disabled={busy || !hydrated}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <button type="button" className={styles.forgot} onClick={() => setHint((v) => !v)}>
            Forgot your password?
          </button>
          {hint ? <p className={styles.hint}>Accounts are managed by the owner — ask them to reset it.</p> : null}
        </form>

        <p className={styles.footer}>
          <ShieldGlyph />
          One account, your library. Sessions are signed, not stored — signing out everywhere takes
          one click.
        </p>
      </div>
    </main>
  );
}

const Eye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3-.5" />
  </svg>
);

const ShieldGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6l7-3Z" />
  </svg>
);
