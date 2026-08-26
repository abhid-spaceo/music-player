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
