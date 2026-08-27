import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/guard';
import { query, queryOne } from '@/lib/db/client';

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});

export async function GET() {
  try {
    const session = await requireUser();
    // Playlists are per-user, so the owner filter is the authorization.
    const rows = await query(
      `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
              count(pt.track_id)::int AS track_count,
              COALESCE(sum(t.duration_sec), 0)::int AS total_sec
         FROM playlists p
         LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         LEFT JOIN tracks t          ON t.id = pt.track_id
        WHERE p.owner_id = $1
        GROUP BY p.id
        ORDER BY p.updated_at DESC`,
      [session.uid],
    );
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('A playlist needs a name', 400);

    const created = await queryOne(
      `INSERT INTO playlists (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [session.uid, parsed.data.name, parsed.data.description ?? null],
    );
    return ok(created, undefined, 201);
  } catch (err) {
    return handleError(err);
  }
}
