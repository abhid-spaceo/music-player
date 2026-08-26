import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { query, queryOne } from '@/lib/db/client';

/** There is no public sign-up: accounts exist because an admin made them. */
const Body = z.object({
  email: z.string().trim().min(3).max(320).email(),
  password: z.string().min(12).max(1024),
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'listener']).default('listener'),
});

export async function GET() {
  try {
    await requireAdmin();
    const rows = await query(
      `SELECT id, email, role, display_name, last_login_at, created_at
         FROM users ORDER BY created_at`,
    );
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('Invalid input', 400, parsed.error.flatten().fieldErrors);
    }
    const { email, password, displayName, role } = parsed.data;

    // One statement, no check-then-insert race. Two concurrent creates for the
    // same email used to make the loser a 500 on the unique constraint.
    const created = await queryOne<{ id: string; email: string; role: string }>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role`,
      [email, await hashPassword(password), displayName, role],
    );
    if (!created) return fail('That email is already registered', 409);

    return ok(created, undefined, 201);
  } catch (err) {
    return handleError(err);
  }
}
