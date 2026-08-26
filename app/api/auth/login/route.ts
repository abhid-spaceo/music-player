import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp, fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { burnPasswordWork, verifyPassword } from '@/lib/auth/password';
import {
  checkLoginRate,
  clearFailures,
  maybePruneLoginAttempts,
  recordLoginAttempt,
  updateAccountLock,
} from '@/lib/auth/rate-limit';
import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  serializeSession,
  sessionCookieOptions,
  type Role,
} from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';

const Body = z.object({
  email: z.string().trim().min(3).max(320).email(),
  password: z.string().min(1).max(1024),
});

type UserRow = {
  id: string;
  password_hash: string;
  role: Role;
  session_version: number;
  locked_until: Date | null;
};

export async function POST(request: Request) {
  try {
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Invalid email or password format', 400);

    const { email, password } = parsed.data;
    const ip = clientIp(request);

    const rate = await checkLoginRate(email, ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
      );
    }

    const user = await queryOne<UserRow>(
      `SELECT id, password_hash, role, session_version, locked_until
         FROM users WHERE email = $1`,
      [email],
    );

    // Spend the same Argon2 work whether or not the email exists. Skipping the
    // verify for an unknown email leaks account existence through response
    // time — ~25ms vs ~0ms, far above network jitter.
    if (!user) {
      await burnPasswordWork(password);
      await recordLoginAttempt(email, ip, false);
      await maybePruneLoginAttempts();
      return fail('Invalid credentials', 401);
    }

    const valid = await verifyPassword(user.password_hash, password);
    const locked = !!user.locked_until && user.locked_until.getTime() > Date.now();

    await recordLoginAttempt(email, ip, valid && !locked);
    await updateAccountLock(user.id, valid && !locked);
    await maybePruneLoginAttempts();

    // A locked account only reveals itself to someone who already has the
    // right password. Returning 423 on a wrong password would make the status
    // code an account-existence oracle.
    if (!valid) return fail('Invalid credentials', 401);
    if (locked) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((user.locked_until!.getTime() - Date.now()) / 1000),
      );
      return NextResponse.json(
        { ok: false, error: 'Account temporarily locked' },
        { status: 423, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    await clearFailures(email, ip);

    const store = await cookies();
    store.set(
      SESSION_COOKIE,
      serializeSession({
        uid: user.id,
        role: user.role,
        sv: user.session_version,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
      }),
      sessionCookieOptions,
    );

    return ok({ id: user.id, role: user.role });
  } catch (err) {
    return handleError(err);
  }
}
