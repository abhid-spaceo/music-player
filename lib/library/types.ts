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
  /** My own field. Additive — it never replaces `title` or `channelTitle`. */
  sortArtist: string | null;
  note: string | null;
  availability: Availability;
  liveBroadcastContent: string | null;
};

export type ApiTrackRow = {
  id: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  duration_sec: number;
  sort_artist: string | null;
  note: string | null;
  availability: Availability;
  live_broadcast_content: string | null;
};

export function toTrack(row: ApiTrackRow): Track {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    channelTitle: row.channel_title,
    durationSec: row.duration_sec,
    sortArtist: row.sort_artist,
    note: row.note,
    availability: row.availability,
    liveBroadcastContent: row.live_broadcast_content,
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
