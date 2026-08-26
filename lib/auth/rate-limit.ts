import { query, queryOne } from '@/lib/db/client';

/** 5 failures from the same email+IP inside 15 minutes blocks further attempts. */
const WINDOW_MIN = 15;
const MAX_FAILURES = 5;
/** Cumulative failures on the account itself trigger a timed lock. */
const LOCK_AFTER = 10;
const LOCK_MIN = 30;

export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkLoginRate(email: string, ip: string): Promise<RateVerdict> {
  const row = await queryOne<{ failures: string; oldest: Date | null }>(
    `SELECT count(*)::text AS failures, min(attempted_at) AS oldest
       FROM login_attempts
      WHERE email = $1 AND ip = $2
        AND succeeded = false
        AND attempted_at > now() - ($3 || ' minutes')::interval`,
    [email, ip, String(WINDOW_MIN)],
  );

  const failures = Number(row?.failures ?? 0);
  if (failures < MAX_FAILURES) return { allowed: true };

  const oldest = row?.oldest ? row.oldest.getTime() : Date.now();
  const retryAfterSec = Math.max(
    1,
    Math.ceil((oldest + WINDOW_MIN * 60_000 - Date.now()) / 1000),
  );
  return { allowed: false, retryAfterSec };
}

/** On success, drop the failure window so a run of typos cannot lock the owner
 *  out with the correct password in hand (and so the window cannot accumulate
 *  across verification runs). */
export async function clearFailures(email: string, ip: string): Promise<void> {
  await query(
    'DELETE FROM login_attempts WHERE email = $1 AND ip = $2 AND succeeded = false',
    [email, ip],
  );
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  succeeded: boolean,
): Promise<void> {
  await query(
    'INSERT INTO login_attempts (email, ip, succeeded) VALUES ($1, $2, $3)',
    [email, ip, succeeded],
  );
}

/** Clears the per-account counter on success; escalates to a lock on failure. */
export async function updateAccountLock(userId: string, succeeded: boolean): Promise<void> {
  if (succeeded) {
    await query(
      `UPDATE users
          SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
        WHERE id = $1`,
      [userId],
    );
    return;
  }

  // The counter resets once a lock has expired. Without that reset, every
  // subsequent failure re-armed a fresh lock forever, so an unauthenticated
  // attacker could keep the only admin account locked out indefinitely at a
  // cost of one request per lock window.
  await query(
    `UPDATE users
        SET failed_login_count = CASE
              WHEN locked_until IS NOT NULL AND locked_until < now() THEN 1
              ELSE failed_login_count + 1
            END,
            locked_until = CASE
              WHEN locked_until IS NOT NULL AND locked_until < now() THEN NULL
              WHEN failed_login_count + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
              ELSE locked_until
            END
      WHERE id = $1`,
    [userId, LOCK_AFTER, String(LOCK_MIN)],
  );
}

/**
 * Called opportunistically from the login route (roughly 1 in 50 attempts) so
 * the table stays bounded without a cron. Failures are swallowed: hygiene must
 * never break a login.
 */
export async function maybePruneLoginAttempts(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await query("DELETE FROM login_attempts WHERE attempted_at < now() - interval '7 days'");
  } catch {
    /* ignore */
  }
}
