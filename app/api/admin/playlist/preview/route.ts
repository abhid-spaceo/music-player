import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';
import { fetchPlaylistVideoIds, YouTubeApiError, YouTubeQuotaError } from '@/lib/youtube/api';
import { youtubeApiKey } from '@/lib/youtube/config';
import { recordQuotaFireAndForget } from '@/lib/youtube/quota';
import { PLAYLIST_FAILURE_MESSAGES, parsePlaylistId } from '@/lib/youtube/parse-url';

/**
 * Lists a playlist's videos so the admin can pick which to import, WITHOUT
 * adding anything. Titles come free with the playlist call; each item is flagged
 * if it is already in the library. The actual add is done by the existing
 * POST /api/admin/tracks with the chosen ids — this route never writes.
 */
const Body = z.object({ url: z.string().min(1).max(2000) });

type PreviewItem = { videoId: string; title: string; alreadyInLibrary: boolean };

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide a playlist `url`', 400);

    const asPlaylist = parsePlaylistId(parsed.data.url.trim());
    if (!asPlaylist.ok) {
      return fail(PLAYLIST_FAILURE_MESSAGES[asPlaylist.reason], 400);
    }

    let list;
    try {
      list = await fetchPlaylistVideoIds(asPlaylist.playlistId, {
        apiKey: youtubeApiKey(),
        onQuota: recordQuotaFireAndForget,
      });
    } catch (err) {
      if (err instanceof YouTubeQuotaError) return fail(err.message, 429);
      if (err instanceof YouTubeApiError) return fail(err.message, err.status);
      throw err;
    }

    const ids = list.items.map((i) => i.videoId);
    const existing = ids.length
      ? await query<{ youtube_id: string }>(
          'SELECT youtube_id FROM tracks WHERE youtube_id = ANY($1::text[])',
          [ids],
        )
      : [];
    const inLibrary = new Set(existing.map((r) => r.youtube_id));

    const items: PreviewItem[] = list.items.map((i) => ({
      videoId: i.videoId,
      title: i.title,
      alreadyInLibrary: inLibrary.has(i.videoId),
    }));

    return ok(items, {
      playlistId: asPlaylist.playlistId,
      total: items.length,
      alreadyInLibrary: inLibrary.size,
      skipped: list.skipped,
      truncated: list.truncated,
      quotaUnitsSpent: list.callCount,
    });
  } catch (err) {
    return handleError(err);
  }
}
