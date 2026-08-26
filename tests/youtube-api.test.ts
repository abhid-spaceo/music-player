import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chunk,
  fetchVideoMetadata,
  MAX_IDS_PER_CALL,
  parseIsoDuration,
  YouTubeApiError,
  YouTubeQuotaError,
} from '../lib/youtube/api';

const id = (n: number) => `vid${String(n).padStart(8, '0')}`;

/** A fake transport that records every call, so quota cost is observable. */
function fakeApi(handler?: (ids: string[]) => unknown) {
  const calls: string[][] = [];
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    const ids = (url.searchParams.get('id') ?? '').split(',').filter(Boolean);
    calls.push(ids);
    const body = handler
      ? handler(ids)
      : { items: ids.map((i) => ({ id: i, snippet: { title: `T ${i}` } })) };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const opts = (fetchImpl: typeof fetch) => ({ apiKey: 'k', region: 'IN', fetchImpl });

test('ISO 8601 durations', () => {
  assert.equal(parseIsoDuration('PT15M33S'), 933);
  assert.equal(parseIsoDuration('PT19S'), 19);
  assert.equal(parseIsoDuration('PT1H'), 3600);
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('P1DT2H'), 93_600);
  assert.equal(parseIsoDuration('PT0S'), 0);
  assert.equal(parseIsoDuration('rubbish'), 0);
});

test('chunking never exceeds the API limit', () => {
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(chunk(Array.from({ length: 120 }, (_, i) => i), 50).length, 3);
});

test('20 ids cost exactly 1 call — the brief\'s bulk-add check', async () => {
  const { calls, fetchImpl } = fakeApi();
  const ids = Array.from({ length: 20 }, (_, i) => id(i));
  const result = await fetchVideoMetadata(ids, opts(fetchImpl));

  assert.equal(result.callCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.length, 20);
  assert.equal(result.found.length, 20);
});

test('120 ids cost 3 calls, batched at 50', async () => {
  const { calls, fetchImpl } = fakeApi();
  const ids = Array.from({ length: 120 }, (_, i) => id(i));
  const result = await fetchVideoMetadata(ids, opts(fetchImpl));

  assert.equal(result.callCount, 3);
  assert.deepEqual(calls.map((c) => c.length), [50, 50, 20]);
  assert.ok(calls.every((c) => c.length <= MAX_IDS_PER_CALL));
});

test('duplicate ids are collapsed before any call is made', async () => {
  const { calls, fetchImpl } = fakeApi();
  const result = await fetchVideoMetadata([id(1), id(1), id(1), id(2)], opts(fetchImpl));
  assert.equal(result.callCount, 1);
  assert.equal(calls[0]!.length, 2);
});

test('an empty id list spends no quota at all', async () => {
  const { calls, fetchImpl } = fakeApi();
  const result = await fetchVideoMetadata([], opts(fetchImpl));
  assert.equal(result.callCount, 0);
  assert.equal(calls.length, 0);
});

test('ids absent from the response are reported as missing', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: ids.slice(0, 1).map((i) => ({ id: i, snippet: { title: 'kept' } })),
  }));
  const result = await fetchVideoMetadata([id(1), id(2), id(3)], opts(fetchImpl));
  assert.deepEqual(result.missing, [id(2), id(3)]);
  assert.equal(result.found.length, 1);
});

test('availability: embeddable false wins', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], status: { embeddable: false, privacyStatus: 'public' } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.availability, 'not_embeddable');
});

test('availability: blocked in our region', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], contentDetails: { regionRestriction: { blocked: ['IN', 'DE'] } } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.availability, 'region_blocked');
});

test('availability: an allow-list that omits our region', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], contentDetails: { regionRestriction: { allowed: ['US'] } } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.availability, 'region_blocked');
});

test('availability: an allow-list that includes our region is fine', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], contentDetails: { regionRestriction: { allowed: ['IN', 'US'] } } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.availability, 'ok');
});

test('availability: uploadStatus deleted', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], status: { uploadStatus: 'deleted' } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.availability, 'unavailable');
});

test('quota exhaustion throws loudly, never an empty result', async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }),
      { status: 403 },
    )) as unknown as typeof fetch;

  await assert.rejects(
    () => fetchVideoMetadata([id(1)], opts(fetchImpl)),
    YouTubeQuotaError,
  );
});

test('other API failures surface with their status, and do not retry', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('bad request', { status: 400 });
  }) as unknown as typeof fetch;

  await assert.rejects(() => fetchVideoMetadata([id(1)], opts(fetchImpl)), YouTubeApiError);
  assert.equal(calls, 1, 'must not retry — every request costs quota');
});

test('a missing API key fails before spending a call', async () => {
  const { calls, fetchImpl } = fakeApi();
  await assert.rejects(
    () => fetchVideoMetadata([id(1)], { apiKey: '', region: 'IN', fetchImpl }),
    YouTubeApiError,
  );
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Policy fields the Phase 0 review found missing. All arrive in the same
// part=snippet,contentDetails,status call, so none of these costs extra quota.

test('age restriction is detected at ingest and outranks embeddable', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{
      id: ids[0],
      // Deliberately also embeddable:false — age restriction must win, because
      // at playback the two are indistinguishable (both onError 101/150).
      status: { embeddable: false },
      contentDetails: { duration: 'PT4M', contentRating: { ytRating: 'ytAgeRestricted' } },
    }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.ageRestricted, true);
  assert.equal(r.found[0]!.availability, 'age_restricted');
});

test('madeForKids is captured (tracking must be off for those players)', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], status: { madeForKids: true, embeddable: true } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.madeForKids, true);
});

test('an allow-list is stored, not just a block-list', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{ id: ids[0], contentDetails: { regionRestriction: { allowed: ['US', 'CA'] } } }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.deepEqual(r.found[0]!.regionAllowed, ['US', 'CA']);
  assert.equal(r.found[0]!.regionBlocked, null);
  assert.equal(r.found[0]!.availability, 'region_blocked');
});

test('a live broadcast reports P0D — 0 seconds, not a parse failure', async () => {
  const { fetchImpl } = fakeApi((ids) => ({
    items: [{
      id: ids[0],
      snippet: { title: 'Live now', liveBroadcastContent: 'live' },
      contentDetails: { duration: 'P0D' },
    }],
  }));
  const r = await fetchVideoMetadata([id(1)], opts(fetchImpl));
  assert.equal(r.found[0]!.durationSec, 0);
  assert.equal(r.found[0]!.liveBroadcastContent, 'live');
});

test('P0D and PT0S both parse to 0; multi-day durations parse fully', () => {
  assert.equal(parseIsoDuration('P0D'), 0);
  assert.equal(parseIsoDuration('PT0S'), 0);
  assert.equal(parseIsoDuration('P1DT2H3M4S'), 93_784);
  assert.equal(parseIsoDuration('P2D'), 172_800);
});
