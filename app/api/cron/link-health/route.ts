import { fail, handleError, ok } from '@/lib/api/respond';
import { query } from '@/lib/db/client';
import { MAX_IDS_PER_CALL, fetchVideoMetadata, YouTubeApiError, YouTubeQuotaError } from '@/lib/youtube/api';
import { youtubeApiKey, youtubeRegion } from '@/lib/youtube/config';

/**
 * The link-health sweep. A library of links rots: videos are removed, made
 * private, have embedding disabled, or become region-blocked.
 *
 * It is also a compliance requirement, not an optimisation. The YouTube
 * Developer Policies allow storing API data for "not longer than 30 calendar
 * days", after which it "must either delete or refresh the stored data" — so
 * this job is what keeps the library legal, and it must not silently stop.
 *
 * Vercel Hobby runs cron ONCE PER DAY at an unpredictable hour (±59 min), and a
 * more frequent expression fails at deploy time. So one pass has to cover the
 * whole library: oldest-checked first, batched at 50 ids per quota unit.
 */

/** Bounded so one run cannot exceed Hobby's 300s function ceiling. */
const MAX_BATCHES = 40; // 40 * 50 = 2,000 tracks, 40 quota units

export async function GET(request: Request) {
  try {
    // Vercel sets this header on its own cron invocations. In production a
    // secret is required, so the endpoint is not an open quota-burning URL.
    const secret = process.env.CRON_SECRET;
    const authorized =
      request.headers.get('authorization') === `Bearer ${secret}` ||
      (!secret && process.env.NODE_ENV !== 'production');
    if (!authorized) return fail('Not authorized', 401);

    const stale = await query<{ youtube_id: string }>(
      `SELECT youtube_id FROM tracks
        ORDER BY availability_checked_at ASC NULLS FIRST
        LIMIT $1`,
      [MAX_BATCHES * MAX_IDS_PER_CALL],
    );
    if (stale.length === 0) return ok({ checked: 0, apiCalls: 0 });

    let result;
    try {
      result = await fetchVideoMetadata(
        stale.map((r) => r.youtube_id),
        { apiKey: youtubeApiKey(), region: youtubeRegion() },
      );
    } catch (err) {
      // Fail loudly. A silent empty result would look like the whole library
      // vanished, and would also leave the 30-day clock running.
      if (err instanceof YouTubeQuotaError) return fail(err.message, 429);
      if (err instanceof YouTubeApiError) return fail(err.message, 502);
      throw err;
    }

    const changed: string[] = [];
    for (const m of result.found) {
      const rows = await query<{ youtube_id: string }>(
        `UPDATE tracks
            SET title = $2, channel_title = $3, channel_id = $4, duration_sec = $5,
                thumbnail_url = $6, embeddable = $7, privacy_status = $8,
                upload_status = $9, region_blocked = $10, region_allowed = $11,
                made_for_kids = $12, age_restricted = $13,
                live_broadcast_content = $14, availability = $15,
                metadata_fetched_at = now(), availability_checked_at = now()
          WHERE youtube_id = $1 AND availability <> $15
        RETURNING youtube_id`,
        [
          m.youtubeId, m.title, m.channelTitle, m.channelId, m.durationSec,
          m.thumbnailUrl, m.embeddable, m.privacyStatus, m.uploadStatus,
          m.regionBlocked, m.regionAllowed, m.madeForKids, m.ageRestricted,
          m.liveBroadcastContent, m.availability,
        ],
      );
      if (rows.length) changed.push(m.youtubeId);
      // Always stamp the check, even when nothing changed, or the same rows
      // come back every run and the tail is never reached.
      await query(
        `UPDATE tracks SET metadata_fetched_at = now(), availability_checked_at = now(),
                           title = $2, channel_title = $3, availability = $4
          WHERE youtube_id = $1`,
        [m.youtubeId, m.title, m.channelTitle, m.availability],
      );
    }

    // Gone from the API entirely: flag, never delete. A video can come back,
    // and deleting the row would take the owner's playlist entries with it.
    if (result.missing.length > 0) {
      await query(
        `UPDATE tracks
            SET availability = 'unavailable', availability_checked_at = now()
          WHERE youtube_id = ANY($1::text[])`,
        [result.missing],
      );
    }

    return ok(
      {
        checked: stale.length,
        stillFine: result.found.filter((m) => m.availability === 'ok').length,
        nowBlocked: result.found.filter((m) => m.availability !== 'ok').map((m) => m.youtubeId),
        wentMissing: result.missing,
        changed,
      },
      { apiCalls: result.callCount, quotaUnitsSpent: result.callCount },
    );
  } catch (err) {
    return handleError(err);
  }
}
