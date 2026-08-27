import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';
import {
  fetchPlaylistVideoIds,
  fetchVideoMetadata,
  YouTubeApiError,
  YouTubeQuotaError,
  type VideoMetadata,
} from '@/lib/youtube/api';
import { youtubeApiKey, youtubeRegion } from '@/lib/youtube/config';
import {
  PARSE_FAILURE_MESSAGES,
  PLAYLIST_FAILURE_MESSAGES,
  parsePlaylistId,
  parseYouTubeUrl,
} from '@/lib/youtube/parse-url';

/** Either a list of URLs or one pasted blob to split on whitespace. */
const Body = z
  .object({
    urls: z.array(z.string()).max(500).optional(),
    text: z.string().max(50_000).optional(),
  })
  .refine((b) => b.urls?.length || b.text, { message: 'Provide urls or text' });

type Outcome =
  | { input: string; status: 'added'; videoId: string; title: string }
  | {
      input: string;
      status: 'playlist';
      playlistId: string;
      found: number;
      skipped: number;
      truncated: boolean;
    }
  | { input: string; status: 'duplicate'; videoId: string }
  | { input: string; status: 'invalid'; reason: string }
  | { input: string; status: 'not-found'; videoId: string };

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide `urls` (array) or `text` (pasted blob)', 400);

    const inputs = [
      ...(parsed.data.urls ?? []),
      ...(parsed.data.text ?? '').split(/[\s,]+/),
    ]
      .map((s) => s.trim())
      .filter(Boolean);

    if (inputs.length === 0) return fail('Nothing to add', 400);

    const outcomes: Outcome[] = [];
    // videoId -> the first input that produced it, so a repeat inside one paste
    // is reported without costing a second lookup.
    const wanted = new Map<string, string>();

    let apiCalls = 0;

    for (const input of inputs) {
      // A playlist link expands into its videos, which then run through exactly
      // the same duplicate-check and metadata path as a pasted video link.
      // `watch?v=X&list=Y` is deliberately NOT a playlist — see parsePlaylistId.
      const asPlaylist = parsePlaylistId(input);
      if (asPlaylist.ok) {
        try {
          const list = await fetchPlaylistVideoIds(asPlaylist.playlistId, {
            apiKey: youtubeApiKey(),
          });
          apiCalls += list.callCount;
          outcomes.push({
            input,
            status: 'playlist',
            playlistId: asPlaylist.playlistId,
            found: list.videoIds.length,
            skipped: list.skipped,
            truncated: list.truncated,
          });
          for (const videoId of list.videoIds) {
            if (!wanted.has(videoId)) wanted.set(videoId, input);
          }
        } catch (err) {
          if (err instanceof YouTubeQuotaError) return fail(err.message, 429);
          if (err instanceof YouTubeApiError) {
            outcomes.push({ input, status: 'invalid', reason: err.message });
            continue;
          }
          throw err;
        }
        continue;
      }
      if (asPlaylist.reason !== 'not-a-playlist') {
        outcomes.push({
          input,
          status: 'invalid',
          reason: PLAYLIST_FAILURE_MESSAGES[asPlaylist.reason],
        });
        continue;
      }

      const result = parseYouTubeUrl(input);
      if (!result.ok) {
        outcomes.push({
          input,
          status: 'invalid',
          reason: PARSE_FAILURE_MESSAGES[result.reason],
        });
        continue;
      }
      if (wanted.has(result.videoId)) {
        outcomes.push({ input, status: 'duplicate', videoId: result.videoId });
        continue;
      }
      wanted.set(result.videoId, input);
    }

    // Already in the library? The UNIQUE constraint would catch it anyway, but
    // checking first keeps duplicates out of the quota spend.
    const ids = [...wanted.keys()];
    const existing = ids.length
      ? await query<{ youtube_id: string }>(
          'SELECT youtube_id FROM tracks WHERE youtube_id = ANY($1::text[])',
          [ids],
        )
      : [];

    for (const row of existing) {
      outcomes.push({
        input: wanted.get(row.youtube_id)!,
        status: 'duplicate',
        videoId: row.youtube_id,
      });
      wanted.delete(row.youtube_id);
    }

    const toFetch = [...wanted.keys()];

    if (toFetch.length > 0) {
      let found: VideoMetadata[] = [];
      let missing: string[] = [];
      try {
        const result = await fetchVideoMetadata(toFetch, {
          apiKey: youtubeApiKey(),
          region: youtubeRegion(),
        });
        found = result.found;
        missing = result.missing;
        apiCalls += result.callCount;
      } catch (err) {
        if (err instanceof YouTubeQuotaError) return fail(err.message, 429);
        if (err instanceof YouTubeApiError) return fail(err.message, 502);
        throw err;
      }

      const session = await requireAdmin();
      for (const meta of found) {
        await query(
          `INSERT INTO tracks (youtube_id, title, channel_title, channel_id,
                               duration_sec, thumbnail_url, embeddable,
                               privacy_status, upload_status, region_blocked,
                               region_allowed, made_for_kids, age_restricted,
                               live_broadcast_content, availability,
                               metadata_fetched_at, availability_checked_at,
                               added_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                   now(),now(),$16)
           ON CONFLICT (youtube_id) DO NOTHING`,
          [
            meta.youtubeId, meta.title, meta.channelTitle, meta.channelId,
            meta.durationSec, meta.thumbnailUrl, meta.embeddable,
            meta.privacyStatus, meta.uploadStatus, meta.regionBlocked,
            meta.regionAllowed, meta.madeForKids, meta.ageRestricted,
            meta.liveBroadcastContent, meta.availability, session.uid,
          ],
        );
        outcomes.push({
          input: wanted.get(meta.youtubeId)!,
          status: 'added',
          videoId: meta.youtubeId,
          title: meta.title,
        });
      }

      // Absent from the response: deleted or private. The API does not let us
      // tell those apart, so we do not pretend to.
      for (const id of missing) {
        outcomes.push({ input: wanted.get(id)!, status: 'not-found', videoId: id });
      }
    }

    const counts = {
      added: outcomes.filter((o) => o.status === 'added').length,
      duplicate: outcomes.filter((o) => o.status === 'duplicate').length,
      invalid: outcomes.filter((o) => o.status === 'invalid').length,
      playlists: outcomes.filter((o) => o.status === 'playlist').length,
      notFound: outcomes.filter((o) => o.status === 'not-found').length,
    };

    return ok(outcomes, { ...counts, apiCalls, quotaUnitsSpent: apiCalls }, 201);
  } catch (err) {
    return handleError(err);
  }
}
