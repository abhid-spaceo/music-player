import { NextResponse } from 'next/server';
import { CsrfError } from '@/lib/auth/csrf';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/guard';

/** One envelope for every response, success or failure. */
export type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: string; detail?: unknown };

/**
 * Every API response is per-user and must never be stored by a browser, a
 * back-forward cache, or an intermediary — /api/session carries a CSRF token
 * and /api/admin/users carries every user's email.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<ApiEnvelope<T>>(
    { ok: true, data, meta },
    { status, headers: NO_STORE },
  );
}

export function fail(error: string, status: number, detail?: unknown) {
  return NextResponse.json<ApiEnvelope<never>>(
    { ok: false, error, detail },
    { status, headers: NO_STORE },
  );
}

/**
 * Maps the auth/validation error types to status codes so no route has to
 * remember which is which — and so an unexpected error can never leak a stack
 * trace to the client.
 */
export function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) return fail(err.message, 401);
  if (err instanceof ForbiddenError) return fail(err.message, 403);
  if (err instanceof CsrfError) return fail(err.message, 403);

  console.error('[api] unhandled', err);
  return fail('Internal error', 500);
}

/** Vercel sets x-forwarded-for; fall back to a constant so rate limiting still
 *  groups attempts when the header is absent (e.g. local curl). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'local';
}
