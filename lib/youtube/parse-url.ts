/**
 * Extracts a YouTube video ID from anything a person might paste.
 *
 * A video ID is exactly 11 characters from [A-Za-z0-9_-]. That is tight enough
 * to validate, and the database enforces the same rule with a CHECK constraint,
 * so a bad ID cannot reach a row even if this function is bypassed.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const VIDEO_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

/** Path prefixes that carry the id as the next segment. */
const PATH_FORMS = ['shorts', 'embed', 'live', 'v', 'e'];

export type ParseResult =
  | { ok: true; videoId: string }
  | { ok: false; reason: ParseFailure };

export type ParseFailure =
  | 'empty'
  | 'not-a-youtube-url'
  | 'no-video-id'
  | 'malformed-video-id'
  | 'playlist-without-video'
  | 'channel-or-user-url';

export function parseYouTubeUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };

  // A bare id pasted on its own.
  if (ID_RE.test(raw)) return { ok: true, videoId: raw };

  // Accept a scheme-less paste like "youtu.be/xxxx" or "www.youtube.com/watch?v=x".
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'not-a-youtube-url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'not-a-youtube-url' };
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (SHORT_HOSTS.has(host)) {
    // youtu.be/<id>[?t=30]
    const candidate = segments[0];
    if (!candidate) return { ok: false, reason: 'no-video-id' };
    return finish(candidate);
  }

  if (!VIDEO_HOSTS.has(host)) return { ok: false, reason: 'not-a-youtube-url' };

  // /watch?v=<id>, plus any number of extra params (list, t, index, si…).
  if (segments[0] === 'watch') {
    const v = url.searchParams.get('v');
    if (!v) {
      return url.searchParams.has('list')
        ? { ok: false, reason: 'playlist-without-video' }
        : { ok: false, reason: 'no-video-id' };
    }
    return finish(v);
  }

  // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>, /e/<id>
  if (segments[0] && PATH_FORMS.includes(segments[0])) {
    const candidate = segments[1];
    if (!candidate) return { ok: false, reason: 'no-video-id' };
    return finish(candidate);
  }

  // /playlist?list=…  — a real YouTube URL, but not a video.
  if (segments[0] === 'playlist') return { ok: false, reason: 'playlist-without-video' };

  // /@handle, /channel/UC…, /c/Name, /user/Name
  if (
    segments[0] &&
    (segments[0].startsWith('@') || ['channel', 'c', 'user'].includes(segments[0]))
  ) {
    return { ok: false, reason: 'channel-or-user-url' };
  }

  // Some shares put a bare id at the root: youtube.com/<id>
  if (segments.length === 1 && segments[0] && ID_RE.test(segments[0])) {
    return { ok: true, videoId: segments[0] };
  }

  return { ok: false, reason: 'no-video-id' };
}

function finish(candidate: string): ParseResult {
  // Strip a stray timestamp fragment some clients append to the path segment.
  const cleaned = candidate.split(/[?&#]/)[0] ?? '';
  if (!cleaned) return { ok: false, reason: 'no-video-id' };
  return ID_RE.test(cleaned)
    ? { ok: true, videoId: cleaned }
    : { ok: false, reason: 'malformed-video-id' };
}

export const PARSE_FAILURE_MESSAGES: Record<ParseFailure, string> = {
  'empty': 'Nothing to add.',
  'not-a-youtube-url': 'That is not a YouTube link.',
  'no-video-id': 'No video ID in that link.',
  'malformed-video-id': 'That video ID is not 11 valid characters.',
  'playlist-without-video': 'That is a playlist link, not a video. Open a video and copy its link.',
  'channel-or-user-url': 'That is a channel link, not a video.',
};


/* ------------------------------------------------------------------------ *
 * Playlists
 *
 * Deliberately a separate function rather than a new `parseYouTubeUrl` branch.
 * `watch?v=X&list=Y` must keep adding only video X — anyone copying a link from
 * inside a playlist would otherwise import hundreds of songs by accident. So a
 * link counts as a playlist only when it carries no video id at all, which is
 * exactly the existing `playlist-without-video` case.
 * ------------------------------------------------------------------------ */

/** PL/UU/FL/OL/LL ids vary in length; RD (Mix) is handled separately below. */
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{13,64}$/;

export type PlaylistParseFailure = 'not-a-playlist' | 'mix-not-supported' | 'malformed-playlist-id';

export type PlaylistParseResult =
  | { ok: true; playlistId: string }
  | { ok: false; reason: PlaylistParseFailure };

export function parsePlaylistId(input: string): PlaylistParseResult {
  // Only a link with no video in it can be a playlist import.
  const asVideo = parseYouTubeUrl(input);
  if (asVideo.ok || asVideo.reason !== 'playlist-without-video') {
    return { ok: false, reason: 'not-a-playlist' };
  }

  const raw = input.trim();
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;

  let list: string | null;
  try {
    list = new URL(withScheme).searchParams.get('list');
  } catch {
    return { ok: false, reason: 'not-a-playlist' };
  }
  if (!list) return { ok: false, reason: 'not-a-playlist' };

  // RD… is a Mix: generated per viewer, and the Data API will not serve it.
  // Saying so beats letting the request fail with an opaque 404.
  if (/^RD/.test(list)) return { ok: false, reason: 'mix-not-supported' };

  return PLAYLIST_ID_RE.test(list)
    ? { ok: true, playlistId: list }
    : { ok: false, reason: 'malformed-playlist-id' };
}

export const PLAYLIST_FAILURE_MESSAGES: Record<PlaylistParseFailure, string> = {
  'not-a-playlist': 'That is not a playlist link.',
  'mix-not-supported':
    'YouTube Mixes (list=RD…) are generated per viewer and cannot be imported. Open the playlist itself and copy that link.',
  'malformed-playlist-id': 'That playlist ID does not look valid.',
};
