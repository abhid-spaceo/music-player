import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/guard';
import { queryOne, withTransaction } from '@/lib/db/client';

const Id = z.string().uuid();
const Body = z.object({ trackId: z.string().uuid() });

async function assertOwned(playlistId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
    [playlistId, userId],
  );
  return !!row;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const { id } = await params;
    if (!Id.safeParse(id).success) return fail('Invalid playlist id', 400);
    if (!(await assertOwned(id, session.uid))) return fail('No such playlist', 404);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide a trackId', 400);

    // Appends at the end. The composite PK means a track cannot appear twice in
    // one playlist — a deliberate restriction, surfaced as 409 rather than 500.
    const added = await withTransaction(async (tx) => {
      const next = await tx<{ next: number }>(
        'SELECT COALESCE(max(position) + 1, 0)::int AS next FROM playlist_tracks WHERE playlist_id = $1',
        [id],
      );
      const rows = await tx<{ track_id: string; position: number }>(
        `INSERT INTO playlist_tracks (playlist_id, track_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (playlist_id, track_id) DO NOTHING
         RETURNING track_id, position`,
        [id, parsed.data.trackId, next[0]!.next],
      );
      // Bump updated_at so the playlist list re-sorts.
      await tx('UPDATE playlists SET name = name WHERE id = $1', [id]);
      return rows[0] ?? null;
    });

    if (!added) return fail('That track is already in this playlist', 409);
    return ok(added, undefined, 201);
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
    if (!(await assertOwned(id, session.uid))) return fail('No such playlist', 404);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide a trackId', 400);

    // Removing leaves a gap in `position`; the reorder endpoint rewrites the
    // whole sequence, and ORDER BY position does not care about gaps.
    const removed = await withTransaction(async (tx) => {
      const rows = await tx<{ track_id: string }>(
        'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2 RETURNING track_id',
        [id, parsed.data.trackId],
      );
      await tx('UPDATE playlists SET name = name WHERE id = $1', [id]);
      return rows[0] ?? null;
    });

    if (!removed) return fail('That track is not in this playlist', 404);
    return ok(removed);
  } catch (err) {
    return handleError(err);
  }
}
