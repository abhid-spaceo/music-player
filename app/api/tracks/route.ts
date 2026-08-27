import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { query, queryOne } from '@/lib/db/client';

const Params = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  /** Substring search over MY metadata. YouTube's search.list is never called. */
  q: z.string().trim().max(200).optional(),
  /** 'favourites' narrows to the caller's favourites. */
  scope: z.enum(['all', 'favourites']).default('all'),
});

/** Paginated library read. Any signed-in role may read; only admins write. */
export async function GET(request: Request) {
  try {
    const session = await requireUser();

    const url = new URL(request.url);
    const parsed = Params.safeParse({
      // `|| undefined` not `??`: an empty `?limit=` must fall back to the
      // default rather than fail validation.
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
      q: url.searchParams.get('q') || undefined,
      scope: url.searchParams.get('scope') || undefined,
    });
    if (!parsed.success) return fail('Invalid query parameters', 400);
    const { limit, offset, q, scope } = parsed.data;

    // Trigram-backed substring match (see migration 004). ILIKE with a leading
    // wildcard cannot use a btree, which is why the trigram GIN indexes exist.
    const needle = q ? `%${q}%` : null;
    const favouritesOnly = scope === 'favourites';

    const rows = await query(
      // `id` is the tiebreaker. Without it, rows sharing an added_at — every
      // row of a bulk add does — have undefined relative order, so paging can
      // show a track twice and skip another.
      `SELECT t.id, t.youtube_id, t.title, t.channel_title, t.duration_sec,
              t.thumbnail_url, t.sort_artist, t.note, t.availability,
              t.made_for_kids, t.age_restricted, t.live_broadcast_content,
              t.added_at,
              (f.track_id IS NOT NULL) AS is_favourite
         FROM tracks t
         LEFT JOIN favourites f ON f.track_id = t.id AND f.user_id = $3
        WHERE ($4::text IS NULL
               OR t.title ILIKE $4
               OR t.channel_title ILIKE $4
               OR t.sort_artist ILIKE $4)
          AND (NOT $5::boolean OR f.track_id IS NOT NULL)
        ORDER BY t.added_at DESC, t.id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset, session.uid, needle, favouritesOnly],
    );

    // Full-table aggregate only on the first page. Running it per page gave
    // back much of the Neon compute the stateless session cookie saves.
    // Full-table aggregate only on an unfiltered first page. Running it per
    // page gave back much of the Neon compute the stateless cookie saves.
    const counts =
      offset === 0 && !needle && !favouritesOnly
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
