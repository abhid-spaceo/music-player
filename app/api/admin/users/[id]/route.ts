import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { queryOne } from '@/lib/db/client';

const Patch = z.object({
  role: z.enum(['admin', 'listener']).optional(),
  /** Invalidates every outstanding cookie for this user immediately. */
  signOutEverywhere: z.boolean().optional(),
}).refine((b) => b.role !== undefined || b.signOutEverywhere, {
  message: 'Nothing to change',
});

const Id = z.string().uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await assertCsrf(request);

    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid user id', 400);

    const parsed = Patch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide role and/or signOutEverywhere', 400);
    const { role, signOutEverywhere } = parsed.data;

    // A role change MUST bump session_version, or the demoted user's signed
    // cookie keeps asserting the old role until it expires.
    const bump = signOutEverywhere || role !== undefined;

    const updated = await queryOne<{ id: string; role: string; session_version: number }>(
      `UPDATE users
          SET role = COALESCE($2, role),
              session_version = session_version + CASE WHEN $3 THEN 1 ELSE 0 END
        WHERE id = $1
        RETURNING id, role, session_version`,
      [id, role ?? null, bump],
    );
    if (!updated) return fail('No such user', 404);

    return ok({ ...updated, changedBy: admin.uid });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await assertCsrf(request);

    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid user id', 400);
    if (id === admin.uid) return fail('You cannot delete your own account', 409);

    const deleted = await queryOne<{ id: string; email: string }>(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id],
    );
    if (!deleted) return fail('No such user', 404);

    return ok(deleted);
  } catch (err) {
    return handleError(err);
  }
}
