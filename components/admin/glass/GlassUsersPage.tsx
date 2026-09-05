'use client';

import { useState } from 'react';
import { apiSend, useApi } from '@/lib/api/client';
import styles from './GlassUsersPage.module.css';

/** Mirrors the GET /api/admin/users row shape exactly (see route.ts). */
type UserRow = {
  id: string;
  email: string;
  role: 'admin' | 'listener';
  display_name: string;
  last_login_at: string | null;
  created_at: string;
};

type Role = 'admin' | 'listener';

/** Renders a timestamp as a short local date, or a dash when never set. */
function formatWhen(value: string | null): string {
  if (!value) return '—';
  const when = new Date(value);
  return Number.isNaN(when.getTime()) ? '—' : when.toLocaleDateString();
}

export function GlassUsersPage(): React.JSX.Element {
  const { data, error, loading, refetch } = useApi<UserRow[]>('/api/admin/users');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('listener');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const users = data ?? [];
  // The API enforces password min 12; mirror it here so the button gates early.
  const canSubmit = email.trim().length > 2 && password.length >= 12 && displayName.trim().length > 0;

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await apiSend('/api/admin/users', 'POST', {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
      });
      // Reset the form, then pull the fresh list so the new row appears.
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('listener');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: UserRow): Promise<void> {
    // confirm() guard — deletion is destructive and there is no undo.
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setProblem(null);
    try {
      await apiSend(`/api/admin/users/${user.id}`, 'DELETE');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not delete user');
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={create}>
        <div className={styles.fields}>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            autoComplete="off"
          />
          <input
            className={styles.input}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            aria-label="Display name"
            maxLength={120}
          />
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 12 chars)"
            aria-label="Password"
            autoComplete="new-password"
          />
          <select
            className={styles.input}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            aria-label="Role"
          >
            <option value="listener">listener</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button type="submit" className={styles.submit} disabled={!canSubmit || busy}>
          {busy ? 'Adding…' : 'Add user'}
        </button>
      </form>

      {problem ? <p className={styles.problem} role="alert">{problem}</p> : null}

      {error ? (
        <p className={styles.state} role="status">Could not load users — {error}</p>
      ) : loading ? (
        <p className={styles.state}>Loading users…</p>
      ) : users.length === 0 ? (
        <p className={styles.state}>No users yet. Add one above.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Last login</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={styles.email}>{user.email}</td>
                <td>{user.display_name}</td>
                <td>
                  <span className={styles.badge}>{user.role}</span>
                </td>
                <td className={styles.when}>{formatWhen(user.last_login_at)}</td>
                <td className={styles.actions}>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => remove(user)}
                    aria-label={`Remove ${user.email}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
