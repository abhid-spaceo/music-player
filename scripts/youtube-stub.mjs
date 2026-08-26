/**
 * A stand-in for googleapis.com/youtube/v3 that returns the real response
 * shape, so Phase 2 can be verified end to end without a live API key. It also
 * counts requests, which is how the "20 URLs cost 1 call" claim is proven
 * through the actual route rather than only in a unit test.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 3199);
let calls = 0;
const batches = [];

/** Deterministic fake metadata keyed off the id, plus a few special cases. */
function itemFor(id) {
  if (id === 'MISSINGxxxx') return null;                    // deleted or private
  if (id === 'NOEMBEDxxxx') {
    return base(id, { status: { embeddable: false, privacyStatus: 'public', uploadStatus: 'processed' } });
  }
  if (id === 'EDITMExxxxx') return base(id, {});
  if (id === 'AGEGATExxxx') {
    return base(id, { contentDetails: { duration: 'PT3M', contentRating: { ytRating: 'ytAgeRestricted' } } });
  }
  if (id === 'KIDSVIDxxxx') {
    return base(id, { status: { embeddable: true, madeForKids: true, privacyStatus: 'public', uploadStatus: 'processed' } });
  }
  if (id === 'LIVENOWxxxx') {
    return base(id, { snippet: { liveBroadcastContent: 'live' }, contentDetails: { duration: 'P0D' } });
  }
  if (id === 'ALLOWUSxxxx') {
    return base(id, { contentDetails: { duration: 'PT3M', regionRestriction: { allowed: ['US'] } } });
  }
  if (id === 'BLOCKEDxxxx') {
    return base(id, { contentDetails: { duration: 'PT3M20S', regionRestriction: { blocked: ['IN'] } } });
  }
  return base(id, {});
}

function base(id, over) {
  return {
    id,
    snippet: {
      title: `Stub title for ${id}`,
      channelTitle: `Stub Channel ${id.slice(0, 3)}`,
      channelId: `UC${id}`,
      thumbnails: {
        default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` },
        medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
      },
      ...over.snippet,
    },
    contentDetails: { duration: 'PT4M13S', ...over.contentDetails },
    status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed', ...over.status },
  };
}

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/__stats') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ calls, batches }));
    return;
  }
  if (url.pathname === '/__reset') {
    calls = 0; batches.length = 0;
    res.writeHead(200).end('{}');
    return;
  }
  if (url.pathname.endsWith('/videos')) {
    const ids = (url.searchParams.get('id') ?? '').split(',').filter(Boolean);
    calls++;
    batches.push(ids.length);
    if (ids.length > 50) { res.writeHead(400).end('too many ids'); return; }
    if (url.searchParams.get('key') === 'QUOTA_EXHAUSTED') {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }));
      return;
    }
    const items = ids.map(itemFor).filter(Boolean);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ kind: 'youtube#videoListResponse', items }));
    return;
  }
  res.writeHead(404).end('{}');
}).listen(PORT, '127.0.0.1', () => console.log(`youtube stub on ${PORT}`));
