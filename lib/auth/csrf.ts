import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const CSRF_COOKIE = 'mp_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie. The token is readable by JS (so the client can echo it
 * into a header) but signed, so it cannot be forged by an attacker who can set
 * cookies but does not hold SESSION_SECRET.
 */
/** Domain separation — see the matching note in session.ts. */
const CSRF_LABEL = 'mp.csrf.v1|';

function sign(nonce: string): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  }
  return createHmac('sha256', s).update(CSRF_LABEL + nonce).digest('base64url');
}

export function issueCsrfToken(): string {
  const nonce = randomBytes(18).toString('base64url');
  return `${nonce}.${sign(nonce)}`;
}

export function isCsrfTokenWellFormed(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const nonce = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = Buffer.from(sign(nonce), 'base64url');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export const csrfCookieOptions = {
  httpOnly: false, // the client must read it to echo it back
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 12 * 60 * 60,
};

/**
 * Two independent checks, either of which is sufficient to stop a classic CSRF:
 * a same-origin assertion, and a signed token echoed from a cookie into a
 * header. Both are required here.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host');
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new CsrfError('Malformed Origin header');
    }
    if (!host || originHost !== host) {
      throw new CsrfError('Origin does not match Host');
    }
  }

  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) throw new CsrfError('CSRF token missing');

  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(headerToken, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new CsrfError('CSRF token mismatch');
  }
  if (!isCsrfTokenWellFormed(cookieToken)) throw new CsrfError('CSRF token not signed by this server');
}

export class CsrfError extends Error {}
