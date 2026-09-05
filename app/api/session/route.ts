import { cookies } from 'next/headers';
import { ok } from '@/lib/api/respond';
import {
  CSRF_COOKIE,
  csrfCookieOptions,
  isCsrfTokenWellFormed,
  issueCsrfToken,
} from '@/lib/auth/csrf';
import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  readSession,
  serializeSession,
  sessionCookieOptions,
  type Role,
} from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';

/**
 * The only endpoint a client may call before authenticating, and the place
 * where a session is revalidated against the database.
 *
 * This is the "refresh leg" the stateless-cookie design depends on. Requests
 * on the hot path do NOT read the database — but a page load does, exactly
 * once, which is what makes revocation possible at all. Without it `sv` would
 * be write-only and a demoted admin would keep admin rights for the full 12h
 * cookie lifetime.
 */
export async function GET() {
  const store = await cookies();
  const session = await readSession();

  let user: { id: string; role: Role; email: string } | null = null;

  if (session) {
    const row = await queryOne<{ id: string; role: Role; email: string; session_version: number }>(
      'SELECT id, role, email, session_version FROM users WHERE id = $1',
      [session.uid],
    );

    if (!row || row.session_version !== session.sv) {
      // Deleted, or session_version bumped by a role change or a forced
      // sign-out everywhere. Drop the cookie.
      store.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    } else {
      user = { id: row.id, role: row.role, email: row.email };
      // Re-issue if the role moved, so the signed cookie stops asserting a
      // privilege the database no longer grants.
      if (row.role !== session.role) {
        store.set(
          SESSION_COOKIE,
          serializeSession({
            uid: row.id,
            role: row.role,
            sv: row.session_version,
            exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
          }),
          sessionCookieOptions,
        );
      }
    }
  }

  // Re-mint when absent OR present-but-unverifiable. Only re-minting when
  // absent means a SESSION_SECRET rotation leaves every browser holding a
  // stale token that this endpoint hands straight back, and every mutation —
  // including login — 403s until the cookie expires.
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token || !isCsrfTokenWellFormed(token)) {
    token = issueCsrfToken();
    store.set(CSRF_COOKIE, token, csrfCookieOptions);
  }

  return ok({ user, csrfToken: token });
}
