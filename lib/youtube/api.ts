/**
 * YouTube Data API v3 client.
 *
 * Quota discipline, from docs/phase-0-youtube-grounding.md §1.1:
 *  - `videos.list` costs 1 unit and accepts up to 50 ids, so N videos cost
 *    ceil(N/50) units, not N.
 *  - "Every API request, even if invalid, will cost at least one quota point",
 *    so there is no blind retry anywhere in here.
 *  - This module is never called during a page render. Only add-a-track, an
 *    explicit refresh, and the availability sweep reach it.
 */

export const MAX_IDS_PER_CALL = 50;

/**
 * Overridable only so the end-to-end verification can point at a local stub
 * that speaks the same response shape. Unset in every real environment.
 */
function apiBase(): string {
  return process.env.YOUTUBE_API_BASE ?? 'https://www.googleapis.com/youtube/v3';
}

export type Availability =
  | 'ok'
  | 'unavailable'
  | 'not_embeddable'
  | 'region_blocked'
  | 'age_restricted';

export type VideoMetadata = {
  youtubeId: string;
  title: string;
  channelTitle: string;
  channelId: string | null;
  durationSec: number;
  thumbnailUrl: string | null;
  embeddable: boolean | null;
  privacyStatus: string | null;
  uploadStatus: string | null;
  regionBlocked: string[] | null;
  regionAllowed: string[] | null;
  /** Policy: tracking must be off for a Made For Kids player. */
  madeForKids: boolean | null;
  /** Cannot play on most third-party sites; onError cannot distinguish it. */
  ageRestricted: boolean;
  /** 'live' | 'upcoming' | 'none'. Live/upcoming report duration as P0D. */
  liveBroadcastContent: string | null;
  availability: Availability;
};

export type FetchResult = {
  found: VideoMetadata[];
  /** Requested but absent from the response — deleted or private. */
  missing: string[];
  /** Quota units spent. One per call, so this IS the unit count. */
  callCount: number;
};

export class YouTubeQuotaError extends Error {}
export class YouTubeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * ISO 8601 durations, as `contentDetails.duration` returns them (e.g. PT15M33S).
 * Two shapes that are easy to get wrong and are both handled here:
 *  - `P0D` / `PT0S` for a live or upcoming broadcast — yields 0, which is
 *    correct; `liveBroadcastContent` is what tells you it is not a parse failure.
 *  - `P#DT#H#M#S` for anything at least a day long (archived streams, DJ sets).
 */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3_600 +
    Number(min ?? 0) * 60 +
    Math.round(Number(s ?? 0))
  );
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type RawItem = {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  contentDetails?: {
    duration?: string;
    regionRestriction?: { blocked?: string[]; allowed?: string[] };
    contentRating?: { ytRating?: string };
  };
  status?: {
    embeddable?: boolean;
    privacyStatus?: string;
    uploadStatus?: string;
    madeForKids?: boolean;
  };
};

/** `medium` (320x180) is the smallest source that still holds up when the 40px
 *  row thumbnail is drawn on a 2x display. */
function pickThumbnail(t: RawItem['snippet']): string | null {
  const th = t?.thumbnails;
  if (!th) return null;
  return th.medium?.url ?? th.high?.url ?? th.default?.url ?? null;
}

function deriveAvailability(item: RawItem, region: string): Availability {
  // Ordered by how hard the block is. Age restriction is checked first because
  // at playback it is indistinguishable from a disabled embed, so the ingest
  // signal is the only chance to label it correctly.
  if (item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') {
    return 'age_restricted';
  }
  if (item.status?.embeddable === false) return 'not_embeddable';

  const rr = item.contentDetails?.regionRestriction;
  if (rr?.blocked?.includes(region)) return 'region_blocked';
  if (rr?.allowed && !rr.allowed.includes(region)) return 'region_blocked';

  const upload = item.status?.uploadStatus;
  if (upload === 'deleted' || upload === 'rejected' || upload === 'failed') {
    return 'unavailable';
  }
  return 'ok';
}

export type FetchOptions = {
  apiKey: string;
  /** Region-blocking is per viewer, so this must be where the owner watches. */
  region: string;
  fetchImpl?: typeof fetch;
};

export async function fetchVideoMetadata(
  ids: readonly string[],
  { apiKey, region, fetchImpl = fetch }: FetchOptions,
): Promise<FetchResult> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { found: [], missing: [], callCount: 0 };
  if (!apiKey) throw new YouTubeApiError('YOUTUBE_API_KEY is not set', 500);

  const found: VideoMetadata[] = [];
  const seen = new Set<string>();
  let callCount = 0;

  for (const group of chunk(unique, MAX_IDS_PER_CALL)) {
    const url = new URL(`${apiBase()}/videos`);
    url.searchParams.set('part', 'snippet,contentDetails,status');
    url.searchParams.set('id', group.join(','));
    url.searchParams.set('maxResults', String(MAX_IDS_PER_CALL));
    url.searchParams.set('key', apiKey);

    const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
    callCount++;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // 403 with quotaExceeded is the one failure that must be unmistakable —
      // a silent empty result would look like "all your videos vanished".
      if (response.status === 403 && /quota/i.test(body)) {
        throw new YouTubeQuotaError(
          'YouTube Data API daily quota exhausted. Adding tracks will work again after the quota resets.',
        );
      }
      throw new YouTubeApiError(
        `YouTube API returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`,
        response.status,
      );
    }

    const payload = (await response.json()) as { items?: RawItem[] };
    for (const item of payload.items ?? []) {
      if (!item.id) continue;
      seen.add(item.id);
      found.push({
        youtubeId: item.id,
        title: item.snippet?.title ?? '(untitled)',
        channelTitle: item.snippet?.channelTitle ?? '(unknown channel)',
        channelId: item.snippet?.channelId ?? null,
        durationSec: parseIsoDuration(item.contentDetails?.duration ?? ''),
        thumbnailUrl: pickThumbnail(item.snippet),
        embeddable: item.status?.embeddable ?? null,
        privacyStatus: item.status?.privacyStatus ?? null,
        uploadStatus: item.status?.uploadStatus ?? null,
        regionBlocked: item.contentDetails?.regionRestriction?.blocked ?? null,
        regionAllowed: item.contentDetails?.regionRestriction?.allowed ?? null,
        madeForKids: item.status?.madeForKids ?? null,
        ageRestricted: item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted',
        liveBroadcastContent: item.snippet?.liveBroadcastContent ?? null,
        availability: deriveAvailability(item, region),
      });
    }
  }

  return { found, missing: unique.filter((id) => !seen.has(id)), callCount };
}
