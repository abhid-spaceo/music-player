import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/guard';
import { queryOne } from '@/lib/db/client';

const Id = z.string().uuid();

export async function PUT(request: Request, { params }: { params: Promise<{ trackId: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { trackId } = await params;
    if (!Id.safeParse(trackId).success) return fail('Invalid track id', 400);

    // Idempotent: favouriting twice is not an error.
    const row = await queryOne(
      `INSERT INTO favourites (user_id, track_id) VALUES ($1, $2)
       ON CONFLICT (user_id, track_id) DO NOTHING
       RETURNING track_id, created_at`,
      [session.uid, trackId],
    );
    return ok(row ?? { track_id: trackId, alreadyFavourite: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ trackId: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { trackId } = await params;
    if (!Id.safeParse(trackId).success) return fail('Invalid track id', 400);

    await queryOne('DELETE FROM favourites WHERE user_id = $1 AND track_id = $2 RETURNING track_id', [
      session.uid,
      trackId,
    ]);
    // Idempotent in both directions.
    return ok({ track_id: trackId, favourite: false });
  } catch (err) {
    return handleError(err);
  }
}
