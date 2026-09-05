'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { GlassSignIn } from './GlassSignIn';
import styles from './page.module.css';

export default function SignInPage() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Until React has hydrated, onSubmit is not attached and a click performs a
   * native GET — which navigates away and puts the typed credentials in the URL
   * bar. Keeping the button disabled until then closes that window.
   *
   * useSyncExternalStore rather than an effect: the server snapshot is false
   * and the client snapshot is true, with no cascading render.
   */
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/auth/login', 'POST', { email, password });
      router.replace('/library');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  if (theme === 'glass') {
    return (
      <GlassSignIn
        email={email}
        password={password}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={submit}
        busy={busy}
        hydrated={hydrated}
        error={error}
      />
    );
  }

  return (
    <main className={styles.wrap}>
      <form className={styles.form} onSubmit={submit}>
        <h1 className={styles.title}>Sign in</h1>
        {/* No public sign-up: accounts exist because an admin created them. */}
        <p className={styles.meta}>ACCOUNTS ARE CREATED BY THE OWNER</p>
        <div className={styles.rule} />

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <label className={styles.label} htmlFor="email">
          EMAIL
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className={styles.label} htmlFor="password">
          PASSWORD
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className={styles.submit} type="submit" disabled={busy || !hydrated}>
          {busy ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
      </form>
    </main>
  );
}
