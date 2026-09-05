/**
 * Add-links logic shared by the Current (`AddTracksPanel`) and Glass
 * (`GlassAdminScreen`) admin surfaces, so both post through one code path and
 * render the same outcomes. Presentation (badge classes, layout) stays per-view.
 */

/** Mirrors the union returned by POST /api/admin/tracks, one entry per input. */
export type Outcome =
  | { input: string; status: 'added'; videoId: string; title: string }
  | {
      input: string;
      status: 'playlist';
      playlistId: string;
      found: number;
      skipped: number;
      truncated: boolean;
    }
  | { input: string; status: 'duplicate'; videoId: string }
  | { input: string; status: 'invalid'; reason: string }
  | { input: string; status: 'not-found'; videoId: string };

export type Counts = {
  added: number;
  duplicate: number;
  invalid: number;
  notFound: number;
  playlists: number;
  quotaUnitsSpent: number;
};

export const LABEL: Record<Outcome['status'], string> = {
  added: 'ADDED',
  playlist: 'PLAYLIST',
  duplicate: 'DUPLICATE',
  invalid: 'INVALID',
  'not-found': 'NOT FOUND',
};

export function detail(outcome: Outcome): string {
  if (outcome.status === 'added') return outcome.title;
  if (outcome.status === 'playlist') {
    const parts = [`${outcome.found} videos found`];
    if (outcome.skipped) parts.push(`${outcome.skipped} deleted or private, skipped`);
    if (outcome.truncated) parts.push('capped at 500 — import the rest separately');
    return parts.join(' · ');
  }
  if (outcome.status === 'invalid') return outcome.reason;
  if (outcome.status === 'duplicate') return 'Already in the library';
  return 'Deleted or private on YouTube';
}

export function summarise(counts: Counts): string {
  return (
    `${counts.added} added · ${counts.duplicate} duplicate · ` +
    `${counts.invalid} invalid · ${counts.notFound} not found · ` +
    (counts.playlists ? `${counts.playlists} playlist(s) expanded · ` : '') +
    `${counts.quotaUnitsSpent} quota units spent`
  );
}

/**
 * Split the paste field into individual link tokens the way the server will —
 * newline or comma separated, trimmed, empties dropped. Used only for the live
 * "N links detected" counter; the server remains the source of truth.
 */
export function detectLinks(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A cheap client-side estimate of YouTube quota units. videos.list batches up to
 * 50 ids per 1-unit call, so a paste of N links costs ~ceil(N/50) units (at
 * least 1 when anything is present). Playlist expansion can cost more — the real
 * spend is reported back in the response `meta`.
 */
export function estimateQuota(linkCount: number): number {
  return linkCount === 0 ? 0 : Math.max(1, Math.ceil(linkCount / 50));
}

/**
 * Posts directly rather than through `apiSend`, which returns only the `data`
 * half of the envelope. The per-status counts and the quota spend live in
 * `meta`, and both are the point of this screen.
 */
export async function addLinks(text: string): Promise<{ outcomes: Outcome[]; counts: Counts }> {
  const session = await fetch('/api/session', { credentials: 'same-origin' });
  const sessionBody = (await session.json()) as { data?: { csrfToken?: string } };

  const res = await fetch('/api/admin/tracks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': sessionBody.data?.csrfToken ?? '',
    },
    body: JSON.stringify({ text }),
  });

  const body = (await res.json()) as
    | { ok: true; data: Outcome[]; meta: Counts }
    | { ok: false; error: string };

  if (!body.ok) throw new Error(body.error);
  return { outcomes: body.data, counts: body.meta };
}
