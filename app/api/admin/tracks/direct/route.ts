import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/guard';
import { query, queryOne } from '@/lib/db/client';

/**
 * Adds one direct-audio track: a track whose audio is an https URL we play
 * through our own <audio> element rather than the YouTube embed. That is what
 * makes background and lock-screen playback possible.
 *
 * Deliberately separate from POST /api/admin/tracks. That route splits its
 * input on whitespace to accept a paste of many links, which leaves no room for
 * a title, and it is the path all existing tracks already flow through.
 *
 * Nothing is uploaded or stored here but the URL itself.
 */

const Body = z.object({
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(300),
  /** Shown where a YouTube track shows its channel. */
  artist: z.string().trim().min(1).max(300),
});

/** How long to wait when checking the link is real before giving up. */
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Confirm the URL actually serves audio before it enters the library. Catching
 * a typo now is far better than a track that silently fails to play later.
 */
async function probe(url: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `That link returned ${res.status}. Check it opens in a browser.` };
    }
    const type = res.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('audio/')) {
      return {
        ok: false,
        reason: `That link serves "${type || 'an unknown type'}", not audio. Link the audio file itself.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'That link could not be reached. Check the address and try again.' };
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('Provide `url`, `title` and `artist`', 400);
    }
    const { url, title, artist } = parsed.data;

    // The database enforces this too; failing here gives a better message.
    if (!url.startsWith('https://')) {
      return fail('The audio URL must start with https:// — a http link is blocked by the browser', 400);
    }

    const already = await queryOne<{ id: string }>(
      'SELECT id FROM tracks WHERE audio_url = $1',
      [url],
    );
    if (already) return fail('That audio URL is already in the library', 409);

    const check = await probe(url);
    if (!check.ok) return fail(check.reason, 400);

    // duration_sec stays 0: the real length arrives from the <audio> element on
    // first play, and downloading the file here just to measure it is not worth
    // the bandwidth.
    const rows = await query<{ id: string }>(
      `INSERT INTO tracks (source, audio_url, title, channel_title, duration_sec,
                           availability, metadata_fetched_at, added_by)
       VALUES ('direct', $1, $2, $3, 0, 'ok', now(), $4)
       ON CONFLICT (audio_url) DO NOTHING
       RETURNING id`,
      [url, title, artist, session.uid],
    );
    if (rows.length === 0) return fail('That audio URL is already in the library', 409);

    return ok({ id: rows[0]!.id, url, title, artist }, undefined, 201);
  } catch (err) {
    return handleError(err);
  }
}
