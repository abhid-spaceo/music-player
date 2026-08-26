import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { queryOne } from '@/lib/db/client';

/**
 * Only the owner's ADDITIVE fields are editable. `title`, `channel_title`,
 * `duration_sec` and `thumbnail_url` come from YouTube and are displayed
 * unaltered, as the API policies require — there is deliberately no route that
 * can overwrite them by hand.
 */
const Patch = z
  .object({
    sortArtist: z.string().trim().max(200).nullable().optional(),
    note: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });

const Id = z.string().uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid track id', 400);

    const parsed = Patch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('Only sortArtist and note are editable', 400, parsed.error.flatten());
    }
    const { sortArtist, note } = parsed.data;

    const updated = await queryOne(
      `UPDATE tracks
          SET sort_artist = COALESCE($2, sort_artist),
              note        = COALESCE($3, note)
        WHERE id = $1
        RETURNING id, youtube_id, title, channel_title, sort_artist, note`,
      [id, sortArtist ?? null, note ?? null],
    );
    if (!updated) return fail('No such track', 404);

    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid track id', 400);

    // Playlist entries, favourites and history cascade from the FK definitions.
    const deleted = await queryOne<{ id: string; youtube_id: string }>(
      'DELETE FROM tracks WHERE id = $1 RETURNING id, youtube_id',
      [id],
    );
    if (!deleted) return fail('No such track', 404);

    return ok(deleted);
  } catch (err) {
    return handleError(err);
  }
}
