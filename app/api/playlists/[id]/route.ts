import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/guard';
import { query, queryOne } from '@/lib/db/client';

const Id = z.string().uuid();
const Patch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid playlist id', 400);

    // owner_id in the WHERE clause is the authorization check. A playlist that
    // is not yours is indistinguishable from one that does not exist.
    const playlist = await queryOne(
      'SELECT id, name, description, created_at, updated_at FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, session.uid],
    );
    if (!playlist) return fail('No such playlist', 404);

    const tracks = await query(
      `SELECT t.id, t.youtube_id, t.title, t.channel_title, t.duration_sec,
              t.sort_artist, t.note, t.availability, t.live_broadcast_content,
              pt.position
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
        WHERE pt.playlist_id = $1
        ORDER BY pt.position`,
      [id],
    );

    return ok({ playlist, tracks });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid playlist id', 400);

    const parsed = Patch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Invalid input', 400);

    const updated = await queryOne(
      `UPDATE playlists
          SET name = COALESCE($3, name), description = COALESCE($4, description)
        WHERE id = $1 AND owner_id = $2
        RETURNING id, name, description, updated_at`,
      [id, session.uid, parsed.data.name ?? null, parsed.data.description ?? null],
    );
    if (!updated) return fail('No such playlist', 404);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid playlist id', 400);

    const deleted = await queryOne<{ id: string }>(
      'DELETE FROM playlists WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, session.uid],
    );
    if (!deleted) return fail('No such playlist', 404);
    return ok(deleted);
  } catch (err) {
    return handleError(err);
  }
}
