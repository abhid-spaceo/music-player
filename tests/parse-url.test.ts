import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseYouTubeUrl } from '../lib/youtube/parse-url';

const ID = 'dQw4w9WgXcQ';

const accepts: Array<[label: string, input: string]> = [
  ['canonical watch',            `https://www.youtube.com/watch?v=${ID}`],
  ['watch, no www',              `https://youtube.com/watch?v=${ID}`],
  ['watch over http',            `http://www.youtube.com/watch?v=${ID}`],
  ['mobile watch',               `https://m.youtube.com/watch?v=${ID}`],
  ['music.youtube watch',        `https://music.youtube.com/watch?v=${ID}`],
  ['watch + playlist param',     `https://www.youtube.com/watch?v=${ID}&list=PLabcdefghijklmnop`],
  ['watch + timestamp',          `https://www.youtube.com/watch?v=${ID}&t=42s`],
  ['watch + list + index + t',   `https://www.youtube.com/watch?v=${ID}&list=PLx&index=4&t=1m30s`],
  ['watch with v not first',     `https://www.youtube.com/watch?list=PLx&v=${ID}`],
  ['short link',                 `https://youtu.be/${ID}`],
  ['short link + timestamp',     `https://youtu.be/${ID}?t=30`],
  ['short link + si param',      `https://youtu.be/${ID}?si=AbCdEf`],
  ['shorts',                     `https://www.youtube.com/shorts/${ID}`],
  ['shorts + params',            `https://youtube.com/shorts/${ID}?feature=share`],
  ['embed',                      `https://www.youtube.com/embed/${ID}`],
  ['nocookie embed',             `https://www.youtube-nocookie.com/embed/${ID}`],
  ['live',                       `https://www.youtube.com/live/${ID}`],
  ['legacy /v/',                 `https://www.youtube.com/v/${ID}`],
  ['bare id',                    ID],
  ['bare id with whitespace',    `  ${ID}  `],
  ['scheme-less short link',     `youtu.be/${ID}`],
  ['scheme-less watch',          `www.youtube.com/watch?v=${ID}`],
  ['id at root',                 `https://youtube.com/${ID}`],
  ['id with - and _',            'https://youtu.be/a-b_c1D2e3F'],
];

for (const [label, input] of accepts) {
  test(`accepts: ${label}`, () => {
    const result = parseYouTubeUrl(input);
    assert.equal(result.ok, true, `expected ok for ${input}`);
    if (result.ok) assert.match(result.videoId, /^[A-Za-z0-9_-]{11}$/);
  });
}

test('extracts the right id, not just any 11 chars', () => {
  const r = parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&list=PLabcdefghijk`);
  assert.equal(r.ok && r.videoId, ID);
});

test('id with - and _ round-trips exactly', () => {
  const r = parseYouTubeUrl('https://youtu.be/a-b_c1D2e3F');
  assert.equal(r.ok && r.videoId, 'a-b_c1D2e3F');
});

const rejects: Array<[label: string, input: string, reason: string]> = [
  ['empty string',            '',                                                'empty'],
  ['whitespace only',         '   ',                                             'empty'],
  ['not youtube',             'https://vimeo.com/12345678',                      'not-a-youtube-url'],
  ['lookalike host',          'https://youtube.com.evil.test/watch?v=' + ID,     'not-a-youtube-url'],
  ['subdomain lookalike',     'https://notyoutube.com/watch?v=' + ID,            'not-a-youtube-url'],
  ['ftp scheme',              'ftp://youtube.com/watch?v=' + ID,                 'not-a-youtube-url'],
  ['watch without v',         'https://www.youtube.com/watch',                   'no-video-id'],
  ['playlist page',           'https://www.youtube.com/playlist?list=PLabc',     'playlist-without-video'],
  ['watch with only list',    'https://www.youtube.com/watch?list=PLabc',        'playlist-without-video'],
  ['channel handle',          'https://www.youtube.com/@SomeChannel',            'channel-or-user-url'],
  ['channel id',              'https://www.youtube.com/channel/UCabcdefghijklmn','channel-or-user-url'],
  ['legacy user url',         'https://www.youtube.com/user/SomeUser',           'channel-or-user-url'],
  ['id too short',            'https://youtu.be/abc',                            'malformed-video-id'],
  ['id too long',             'https://youtu.be/abcdefghijkl',                   'malformed-video-id'],
  ['id with bad char',        'https://youtu.be/abcdefghij!',                    'malformed-video-id'],
  ['id with a space',         'https://www.youtube.com/watch?v=abc defghij',      'malformed-video-id'],
  ['shorts with no id',       'https://www.youtube.com/shorts/',                 'no-video-id'],
  ['bare word',               'not a url at all',                                'not-a-youtube-url'],
];

for (const [label, input, reason] of rejects) {
  test(`rejects: ${label}`, () => {
    const result = parseYouTubeUrl(input);
    assert.equal(result.ok, false, `expected failure for ${JSON.stringify(input)}`);
    if (!result.ok) assert.equal(result.reason, reason);
  });
}
