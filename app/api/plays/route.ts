import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/auth/csrf';
import { query, queryOne } from '@/lib/db/client';

const PostBody = z.object({
  trackId: z.string().uuid(),
  source: z.string().max(40).optional(),
});

/** Record one play for the current user. Fire-and-forget from the client. */
export async function POST(request: Request) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const parsed = PostBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide a valid trackId', 400);

    await query(
      `INSERT INTO play_history (user_id, track_id, source)
       VALUES ($1, $2, $3)`,
      [session.uid, parsed.data.trackId, parsed.data.source ?? 'queue'],
    );
    return ok({ recorded: true }, undefined, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** Per-user play stats for one track: how many times, and when last. */
export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const trackId = new URL(request.url).searchParams.get('trackId');
    if (!trackId) return fail('trackId is required', 400);

    const row = await queryOne<{ count: string; last_played_at: string | null }>(
      `SELECT count(*)::text AS count, max(played_at) AS last_played_at
         FROM play_history
        WHERE user_id = $1 AND track_id = $2`,
      [session.uid, trackId],
    );
    return ok({
      count: Number(row?.count ?? '0'),
      lastPlayedAt: row?.last_played_at ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
