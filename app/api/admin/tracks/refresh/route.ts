import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';
import { MAX_IDS_PER_CALL, fetchVideoMetadata, YouTubeApiError, YouTubeQuotaError } from '@/lib/youtube/api';
import { youtubeApiKey, youtubeRegion } from '@/lib/youtube/config';
import { recordQuotaFireAndForget } from '@/lib/youtube/quota';

/**
 * A deliberate refresh. Availability and descriptive metadata come back in the
 * same call, so there is never a reason to schedule them separately.
 * Oldest-checked first, so repeated runs sweep the whole library.
 */
const Body = z.object({ limit: z.number().int().min(1).max(500).default(50) });

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const parsed = Body.safeParse((await request.json().catch(() => null)) ?? {});
    const limit = parsed.success ? parsed.data.limit : 50;

    const stale = await query<{ youtube_id: string }>(
      `SELECT youtube_id FROM tracks
        ORDER BY availability_checked_at ASC NULLS FIRST
        LIMIT $1`,
      [limit],
    );
    if (stale.length === 0) return ok([], { refreshed: 0, apiCalls: 0 });

    const ids = stale.map((r) => r.youtube_id);
    let result;
    try {
      result = await fetchVideoMetadata(ids, {
        apiKey: youtubeApiKey(),
        region: youtubeRegion(),
        onQuota: recordQuotaFireAndForget,
      });
    } catch (err) {
      if (err instanceof YouTubeQuotaError) return fail(err.message, 429);
      if (err instanceof YouTubeApiError) return fail(err.message, 502);
      throw err;
    }

    for (const m of result.found) {
      await query(
        `UPDATE tracks
            SET title = $2, channel_title = $3, channel_id = $4,
                duration_sec = $5, thumbnail_url = $6, embeddable = $7,
                privacy_status = $8, upload_status = $9, region_blocked = $10,
                region_allowed = $11, made_for_kids = $12, age_restricted = $13,
                live_broadcast_content = $14, availability = $15,
                metadata_fetched_at = now(), availability_checked_at = now()
          WHERE youtube_id = $1`,
        [
          m.youtubeId, m.title, m.channelTitle, m.channelId, m.durationSec,
          m.thumbnailUrl, m.embeddable, m.privacyStatus, m.uploadStatus,
          m.regionBlocked, m.regionAllowed, m.madeForKids, m.ageRestricted,
          m.liveBroadcastContent, m.availability,
        ],
      );
    }

    // Gone from the API entirely — flag rather than delete. A video can come
    // back, and silently dropping a row loses the owner's playlists too.
    if (result.missing.length > 0) {
      await query(
        `UPDATE tracks
            SET availability = 'unavailable', availability_checked_at = now()
          WHERE youtube_id = ANY($1::text[])`,
        [result.missing],
      );
    }

    return ok(
      { refreshed: result.found.length, markedUnavailable: result.missing },
      { apiCalls: result.callCount, quotaUnitsSpent: result.callCount, batchSize: MAX_IDS_PER_CALL },
    );
  } catch (err) {
    return handleError(err);
  }
}
