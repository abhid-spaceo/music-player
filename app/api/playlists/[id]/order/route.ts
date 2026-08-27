import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/guard';
import { queryOne, withTransaction } from '@/lib/db/client';

const Id = z.string().uuid();
const Body = z.object({ trackIds: z.array(z.string().uuid()).min(1).max(2000) });

/**
 * Rewrites the whole order in one transaction.
 *
 * `playlist_tracks(playlist_id, position)` is UNIQUE DEFERRABLE INITIALLY
 * DEFERRED, so intermediate states during the rewrite are allowed and the
 * constraint is only checked at COMMIT. Without DEFERRED this would need a
 * two-pass shuffle through temporary offsets.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid playlist id', 400);

    const owned = await queryOne<{ id: string }>(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, session.uid],
    );
    if (!owned) return fail('No such playlist', 404);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide trackIds in the new order', 400);
    const { trackIds } = parsed.data;

    if (new Set(trackIds).size !== trackIds.length) {
      return fail('trackIds contains duplicates', 400);
    }

    const result = await withTransaction(async (tx) => {
      const existing = await tx<{ track_id: string }>(
        'SELECT track_id FROM playlist_tracks WHERE playlist_id = $1',
        [id],
      );
      const have = new Set(existing.map((r) => r.track_id));

      // Refuse a partial reorder: silently dropping or inventing membership
      // would be worse than an error.
      if (have.size !== trackIds.length || trackIds.some((t) => !have.has(t))) {
        return { mismatch: true, expected: have.size, got: trackIds.length };
      }

      for (let i = 0; i < trackIds.length; i++) {
        await tx('UPDATE playlist_tracks SET position = $3 WHERE playlist_id = $1 AND track_id = $2', [
          id,
          trackIds[i],
          i,
        ]);
      }
      await tx('UPDATE playlists SET name = name WHERE id = $1', [id]);
      return { mismatch: false, count: trackIds.length };
    });

    if (result.mismatch) {
      return fail(
        `trackIds must list every track in the playlist exactly once (playlist has ${result.expected}, received ${result.got})`,
        409,
      );
    }
    return ok({ reordered: result.count });
  } catch (err) {
    return handleError(err);
  }
}
