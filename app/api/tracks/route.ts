import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { query, queryOne } from '@/lib/db/client';

const Params = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Paginated library read. Any signed-in role may read; only admins write. */
export async function GET(request: Request) {
  try {
    await requireUser();

    const url = new URL(request.url);
    const parsed = Params.safeParse({
      // `|| undefined` not `??`: an empty `?limit=` must fall back to the
      // default rather than fail validation.
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
    });
    if (!parsed.success) return fail('Invalid pagination parameters', 400);
    const { limit, offset } = parsed.data;

    const rows = await query(
      // `id` is the tiebreaker. Without it, rows sharing an added_at — every
      // row of a bulk add does — have undefined relative order, so paging can
      // show a track twice and skip another.
      `SELECT id, youtube_id, title, channel_title, duration_sec,
              thumbnail_url, sort_artist, note, availability,
              made_for_kids, age_restricted, live_broadcast_content, added_at
         FROM tracks
        ORDER BY added_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    // Full-table aggregate only on the first page. Running it per page gave
    // back much of the Neon compute the stateless session cookie saves.
    const counts =
      offset === 0
        ? await queryOne<{ total: string; unavailable: string }>(
            `SELECT count(*)::text AS total,
                    count(*) FILTER (WHERE availability <> 'ok')::text AS unavailable
               FROM tracks`,
          )
        : null;

    return ok(rows, {
      limit,
      offset,
      ...(counts
        ? {
            total: Number(counts.total),
            unavailable: Number(counts.unavailable),
          }
        : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
