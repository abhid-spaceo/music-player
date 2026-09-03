export type Availability =
  | 'ok'
  | 'unavailable'
  | 'not_embeddable'
  | 'region_blocked'
  | 'age_restricted';

/** A track as the UI uses it. Mapped from the API's snake_case rows. */
export type Track = {
  id: string;
  youtubeId: string;
  title: string;
  channelTitle: string;
  durationSec: number;
  /** YouTube's own thumbnail. Shown as artwork; never re-hosted or altered. */
  thumbnailUrl: string | null;
  /** My own field. Additive — it never replaces `title` or `channelTitle`. */
  sortArtist: string | null;
  note: string | null;
  availability: Availability;
  liveBroadcastContent: string | null;
  isFavourite: boolean;
  /** Curated tags. Additive; default to [] when the API omits them. */
  moods: string[];
  genres: string[];
};

export type ApiTrackRow = {
  id: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  duration_sec: number;
  thumbnail_url: string | null;
  sort_artist: string | null;
  note: string | null;
  availability: Availability;
  live_broadcast_content: string | null;
  is_favourite?: boolean;
  position?: number;
  moods?: string[];
  genres?: string[];
};

export function toTrack(row: ApiTrackRow): Track {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    channelTitle: row.channel_title,
    durationSec: row.duration_sec,
    thumbnailUrl: row.thumbnail_url,
    sortArtist: row.sort_artist,
    note: row.note,
    availability: row.availability,
    liveBroadcastContent: row.live_broadcast_content,
    isFavourite: row.is_favourite ?? false,
    moods: row.moods ?? [],
    genres: row.genres ?? [],
  };
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  ok: '',
  unavailable: 'Removed or made private',
  not_embeddable: 'Cannot play outside YouTube',
  region_blocked: 'Not available in your region',
  age_restricted: 'Age-restricted — YouTube only',
};

export function isPlayable(t: Track): boolean {
  return t.availability === 'ok';
}
