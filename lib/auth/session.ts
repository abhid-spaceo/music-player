import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'mp_session';
/** 12 hours. Short enough that a lazy revocation window stays tolerable. */
export const SESSION_TTL_SEC = 12 * 60 * 60;

export type Role = 'admin' | 'listener';

export type SessionPayload = {
  /** user id */
  uid: string;
  role: Role;
  /** users.session_version at issue time — bumping it invalidates the cookie */
  sv: number;
  /** unix seconds */
  exp: number;
};

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  }
  return Buffer.from(s, 'utf8');
}

const b64u = (b: Buffer) => b.toString('base64url');

/**
 * The label domain-separates this MAC from the CSRF one. Both derive from
 * SESSION_SECRET and both produce `<body>.<mac>`, so without a label a token
 * signed by one helper verifies in the other — a forgery oracle waiting for
 * the first future helper that signs user-supplied text.
 */
const SESSION_LABEL = 'mp.session.v1|';

function sign(body: string): string {
  return b64u(createHmac('sha256', secret()).update(SESSION_LABEL + body).digest());
}

/**
 * Stateless signed cookie: no database read on the hot path. Neon's compute
 * allowance, not convenience, is the reason — a per-request session lookup is
 * the single largest driver of awake-time (phase-0 §5). The cost is that
 * revocation is lazy; `sv` plus a 12h TTL bounds it.
 */
export function serializeSession(payload: SessionPayload): string {
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body)}`;
}

export function parseSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = Buffer.from(sign(body), 'base64url');

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const p = parsed as Partial<SessionPayload>;
  if (typeof p.uid !== 'string' || typeof p.sv !== 'number' || typeof p.exp !== 'number') {
    return null;
  }
  if (p.role !== 'admin' && p.role !== 'listener') return null;
  if (p.exp <= Math.floor(Date.now() / 1000)) return null;

  return { uid: p.uid, role: p.role, sv: p.sv, exp: p.exp };
}

export const sessionCookieOptions = {
  httpOnly: true,
  // Secure is dropped on plain-HTTP localhost or the cookie is never stored.
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SEC,
};

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}
