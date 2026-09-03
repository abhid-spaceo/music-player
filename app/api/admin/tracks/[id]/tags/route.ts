import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { withTransaction } from '@/lib/db/client';

/** Replace the full set of mood/genre tags on a track. */
const Body = z.object({ tagIds: z.array(z.string().uuid()).max(50) });
const Id = z.string().uuid();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid track id', 400);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide tagIds (array of uuids)', 400);

    await withTransaction(async (q) => {
      await q('DELETE FROM track_tags WHERE track_id = $1', [id]);
      for (const tagId of parsed.data.tagIds) {
        await q(
          `INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, tagId],
        );
      }
    });
    return ok({ trackId: id, tagIds: parsed.data.tagIds });
  } catch (err) {
    return handleError(err);
  }
}
