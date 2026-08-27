import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePlaylistId } from '../lib/youtube/parse-url';

const PL = 'PLhoegK_UdCYrQ8ohnm81eXWCbfGBLJA48';

const accepts: Array<[label: string, input: string]> = [
  ['canonical playlist page', `https://www.youtube.com/playlist?list=${PL}`],
  ['no www', `https://youtube.com/playlist?list=${PL}`],
  ['scheme-less paste', `youtube.com/playlist?list=${PL}`],
  ['with si param', `https://www.youtube.com/playlist?list=${PL}&si=AbCdEf`],
  ['mobile host', `https://m.youtube.com/playlist?list=${PL}`],
  ['music host', `https://music.youtube.com/playlist?list=${PL}`],
  ['watch with list but no video', `https://www.youtube.com/watch?list=${PL}`],
];

for (const [label, input] of accepts) {
  test(`playlist accepted: ${label}`, () => {
    const r = parsePlaylistId(input);
    assert.equal(r.ok, true, `expected ok for ${input}`);
    if (r.ok) assert.equal(r.playlistId, PL);
  });
}

test('a normal video link is NOT treated as a playlist', () => {
  const r = parsePlaylistId('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(r.ok, false);
});

test('a video inside a playlist still adds only that video', () => {
  // watch?v=…&list=… must stay a single-video add, or pasting any link copied
  // from inside a playlist would silently import hundreds of songs.
  const r = parsePlaylistId(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}`);
  assert.equal(r.ok, false);
});

test('a YouTube Mix is rejected with its own reason', () => {
  const r = parsePlaylistId('https://www.youtube.com/playlist?list=RDdQw4w9WgXcQ');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'mix-not-supported');
});

test('a channel link is not a playlist', () => {
  assert.equal(parsePlaylistId('https://www.youtube.com/@someone').ok, false);
});

test('rubbish is not a playlist', () => {
  assert.equal(parsePlaylistId('not-a-link').ok, false);
  assert.equal(parsePlaylistId('').ok, false);
});
