import { cookies } from 'next/headers';
import { handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    await assertCsrf(request);
    const store = await cookies();
    store.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return ok({ signedOut: true });
  } catch (err) {
    return handleError(err);
  }
}
