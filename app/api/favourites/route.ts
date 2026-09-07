import { handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const session = await requireUser();
    const rows = await query(
      `SELECT t.id, t.youtube_id, t.audio_url, t.source,
              t.title, t.channel_title, t.duration_sec,
              t.sort_artist, t.note, t.availability, t.live_broadcast_content
         FROM favourites f
         JOIN tracks t ON t.id = f.track_id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC`,
      [session.uid],
    );
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}
