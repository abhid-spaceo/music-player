import { readSession, type Role, type SessionPayload } from './session';

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/** Null when there is no valid cookie. Never touches the database. */
export async function currentUser(): Promise<SessionPayload | null> {
  return readSession();
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) throw new UnauthorizedError('Not signed in');
  return session;
}

/**
 * Role is read from the signed cookie, so this is a real server-side check —
 * the value cannot be tampered with without SESSION_SECRET. It is enforced in
 * every route and server action, never only in the UI.
 */
export async function requireRole(role: Role): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role !== role) throw new ForbiddenError(`Requires ${role} role`);
  return session;
}

export const requireAdmin = () => requireRole('admin');
