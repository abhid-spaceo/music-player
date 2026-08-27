import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchPlaylistVideoIds,
  MAX_PLAYLIST_ITEMS,
  YouTubeApiError,
} from '../lib/youtube/api';

const vid = (n: number) => `pl${String(n).padStart(9, '0')}`;

/** A fake playlistItems endpoint that pages 50 at a time, like the real one. */
function fakePlaylist(total: number, opts: { deletedAt?: number[] } = {}) {
  const calls: string[][] = [];
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    const playlistId = url.searchParams.get('playlistId') ?? '';
    const token = url.searchParams.get('pageToken') ?? '0';
    calls.push([playlistId, token]);

    const start = Number(token);
    const page = Math.min(50, total - start);
    const items = Array.from({ length: page }, (_, i) => {
      const n = start + i;
      const deleted = opts.deletedAt?.includes(n);
      return {
        contentDetails: { videoId: vid(n) },
        snippet: { title: deleted ? 'Deleted video' : `Song ${n}` },
      };
    });
    const next = start + page < total ? String(start + page) : undefined;
    return new Response(
      JSON.stringify({ items, nextPageToken: next, pageInfo: { totalResults: total } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const opts = (fetchImpl: typeof fetch) => ({ apiKey: 'k', fetchImpl });

test('a 50-video playlist costs exactly one call', async () => {
  const { calls, fetchImpl } = fakePlaylist(50);
  const r = await fetchPlaylistVideoIds('PLtest', opts(fetchImpl));
  assert.equal(r.callCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(r.videoIds.length, 50);
});

test('269 videos page correctly and cost ceil(269/50) = 6 calls', async () => {
  const { fetchImpl } = fakePlaylist(269);
  const r = await fetchPlaylistVideoIds('PLtest', opts(fetchImpl));
  assert.equal(r.callCount, 6);
  assert.equal(r.videoIds.length, 269);
  assert.equal(new Set(r.videoIds).size, 269, 'no duplicates across pages');
});

test('deleted entries are skipped and counted, not passed on', async () => {
  const { fetchImpl } = fakePlaylist(10, { deletedAt: [2, 7] });
  const r = await fetchPlaylistVideoIds('PLtest', opts(fetchImpl));
  assert.equal(r.videoIds.length, 8);
  assert.equal(r.skipped, 2);
  assert.ok(!r.videoIds.includes(vid(2)));
});

test('a huge playlist stops at the cap and says so', async () => {
  const { fetchImpl } = fakePlaylist(MAX_PLAYLIST_ITEMS + 120);
  const r = await fetchPlaylistVideoIds('PLtest', opts(fetchImpl));
  assert.equal(r.videoIds.length, MAX_PLAYLIST_ITEMS);
  assert.equal(r.truncated, true);
});

test('an empty playlist is not an error', async () => {
  const { fetchImpl } = fakePlaylist(0);
  const r = await fetchPlaylistVideoIds('PLtest', opts(fetchImpl));
  assert.equal(r.videoIds.length, 0);
  assert.equal(r.truncated, false);
});

test('a 404 from YouTube surfaces as a YouTubeApiError', async () => {
  const fetchImpl = (async () =>
    new Response('{"error":{"message":"not found"}}', { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(
    () => fetchPlaylistVideoIds('PLmissing', opts(fetchImpl)),
    YouTubeApiError,
  );
});

test('a missing api key fails before any request', async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
  await assert.rejects(() => fetchPlaylistVideoIds('PLx', { apiKey: '', fetchImpl }));
  assert.equal(called, false);
});
