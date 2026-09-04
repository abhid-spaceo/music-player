# Now Playing Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scrubbable seek bar, a full-screen Now Playing page (opened from the mini bar) with Favourite / Add-to-Playlist / play-count, and an Up Next queue with tap-to-jump and drag-to-reorder.

**Architecture:** The queue is in-memory client state in `PlayerProvider`. Extract queue math and seek math into pure, unit-testable helpers (`lib/player/queue.ts`, `lib/player/seek.ts`) tested with `node:test`. Wire them into `PlayerProvider`. Build UI (`SeekBar`, `NowPlaying`, `AddToPlaylistMenu`) reusing existing primitives (`FavouriteButton`) and API envelope helpers (`ok/fail/handleError`, `requireUser`, `assertCsrf`). Play counts persist to the existing-but-unused `play_history` table via a new `/api/plays` route.

**Tech Stack:** Next.js 16 (App Router, RSC + `'use client'`), TypeScript, `pg`, `node:test` for unit tests, Playwright (`npm run e2e`) for UI.

**Repo note:** This is a *customized* Next.js — before writing app code read the relevant guide under `node_modules/next/dist/docs/` (see repo `AGENTS.md`). Match the response/auth patterns in `app/api/admin/tracks/route.ts` and `lib/api/respond.ts`.

**Commands:** unit tests `npm test`; lint `npm run lint`; typecheck `npm run typecheck`; e2e `npm run e2e`; dev `npm run dev`.

---

### Task 1: Pure queue helpers

**Files:**
- Create: `lib/player/queue.ts`
- Test: `tests/player-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/player-queue.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorder, removeAt, indexAfterRemove } from '../lib/player/queue';

const q = (...xs: string[]) => xs;

test('reorder moves an item and preserves the rest', () => {
  assert.deepEqual(reorder(q('a', 'b', 'c', 'd'), 2, 0), q('c', 'a', 'b', 'd'));
});
test('reorder is a no-op for equal indices', () => {
  assert.deepEqual(reorder(q('a', 'b', 'c'), 1, 1), q('a', 'b', 'c'));
});
test('reorder ignores out-of-range indices', () => {
  assert.deepEqual(reorder(q('a', 'b'), 5, 0), q('a', 'b'));
});
test('removeAt drops the given index', () => {
  assert.deepEqual(removeAt(q('a', 'b', 'c'), 1), q('a', 'c'));
});
test('indexAfterRemove: removing before current shifts current down', () => {
  assert.equal(indexAfterRemove(3, 1), 2);
});
test('indexAfterRemove: removing after current keeps current', () => {
  assert.equal(indexAfterRemove(3, 5), 3);
});
test('indexAfterRemove: removing current keeps position (next song slides in)', () => {
  assert.equal(indexAfterRemove(3, 3), 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/player/queue'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/player/queue.ts
/** Pure helpers for the in-memory playback queue. No React, no side effects. */

/** Move the item at `from` to `to`. Returns a new array; no-op if out of range. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to) return list.slice();
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Remove the item at `at`. Returns a new array; no-op if out of range. */
export function removeAt<T>(list: readonly T[], at: number): T[] {
  if (at < 0 || at >= list.length) return list.slice();
  const next = list.slice();
  next.splice(at, 1);
  return next;
}

/**
 * New `index` after removing `removed` from the queue, keeping the *current*
 * track stable. Removing the current index keeps the number so the next track
 * slides into the slot.
 */
export function indexAfterRemove(current: number, removed: number): number {
  if (removed < current) return current - 1;
  return current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/player/queue.ts tests/player-queue.test.ts
git commit -m "feat(player): pure queue reorder/remove helpers"
```

---

### Task 2: Pure seek helpers

**Files:**
- Create: `lib/player/seek.ts`
- Test: `tests/player-seek.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/player-seek.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampSeconds, secondsFromRatio, nudge } from '../lib/player/seek';

test('clampSeconds keeps within [0,total]', () => {
  assert.equal(clampSeconds(-5, 100), 0);
  assert.equal(clampSeconds(150, 100), 100);
  assert.equal(clampSeconds(42, 100), 42);
});
test('secondsFromRatio maps 0..1 to seconds', () => {
  assert.equal(secondsFromRatio(0.5, 200), 100);
  assert.equal(secondsFromRatio(-1, 200), 0);
  assert.equal(secondsFromRatio(2, 200), 200);
});
test('nudge steps by delta and clamps', () => {
  assert.equal(nudge(10, 5, 100), 15);
  assert.equal(nudge(98, 5, 100), 100);
  assert.equal(nudge(2, -5, 100), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/player/seek'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/player/seek.ts
/** Pure seek math shared by the mini bar and the Now Playing page. */

export function clampSeconds(seconds: number, total: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(0, seconds), Math.max(0, total));
}

/** ratio is 0..1 across the bar's width. */
export function secondsFromRatio(ratio: number, total: number): number {
  return clampSeconds(ratio * total, total);
}

export function nudge(position: number, delta: number, total: number): number {
  return clampSeconds(position + delta, total);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/player/seek.ts tests/player-seek.test.ts
git commit -m "feat(player): pure seek math helpers"
```

---

### Task 3: Extend PlayerProvider (queue ops, expanded state, play recording hook)

**Files:**
- Modify: `components/player/PlayerProvider.tsx`
- Create: `lib/player/record-play.ts`
- Test: `tests/record-play.test.ts`

- [ ] **Step 1: Write the failing test for the dedupe rule**

```ts
// tests/record-play.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldRecordPlay } from '../lib/player/record-play';

test('records when the track id changes', () => {
  assert.equal(shouldRecordPlay(null, 't1'), true);
  assert.equal(shouldRecordPlay('t1', 't2'), true);
});
test('does not record the same track twice in a row', () => {
  assert.equal(shouldRecordPlay('t1', 't1'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/player/record-play'`.

- [ ] **Step 3: Implement the dedupe helper + a fire-and-forget poster**

```ts
// lib/player/record-play.ts
/** True when a play should be recorded: only when the track actually changed. */
export function shouldRecordPlay(lastTrackId: string | null, trackId: string): boolean {
  return lastTrackId !== trackId;
}

/** Fire-and-forget POST to /api/plays. Never throws into playback. */
export function postPlay(trackId: string, source = 'queue'): void {
  void fetch('/api/plays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId, source }),
  }).catch(() => {
    /* a missed stat must never interrupt music */
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add queue ops + expanded state to `PlayerApi`**

In `components/player/PlayerProvider.tsx`, extend the `PlayerApi` type (after `registerHost`):

```ts
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  jumpTo: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  removeAt: (index: number) => void;
```

Add imports at the top:

```ts
import { reorder, removeAt as removeAtPure, indexAfterRemove } from '@/lib/player/queue';
import { shouldRecordPlay, postPlay } from '@/lib/player/record-play';
```

Add state near the other `useState` calls:

```ts
  const [expanded, setExpanded] = useState(false);
  const lastRecordedRef = useRef<string | null>(null);
```

- [ ] **Step 6: Implement the ops and record a play when a track loads**

In the same file, add these `useCallback`s (place beside `seek`):

```ts
  const recordPlay = useCallback((track: Track) => {
    if (shouldRecordPlay(lastRecordedRef.current, track.id)) {
      lastRecordedRef.current = track.id;
      postPlay(track.id);
    }
  }, []);

  const jumpTo = useCallback((i: number) => {
    const q = queueRef.current;
    if (i < 0 || i >= q.length) return;
    const track = q[i]!;
    setIndex(i);
    setError(null);
    if (playerRef.current && readyRef.current) playerRef.current.loadVideoById(track.youtubeId);
    else pendingRef.current = track.youtubeId;
    recordPlay(track);
  }, [recordPlay]);

  const reorderQueue = useCallback((from: number, to: number) => {
    setQueue((prev) => {
      const nextQueue = reorder(prev, from, to);
      // Keep the *currently playing* track selected after the shuffle of order.
      const currentId = prev[indexRef.current]?.id;
      const newIndex = nextQueue.findIndex((t) => t.id === currentId);
      if (newIndex >= 0) setIndex(newIndex);
      return nextQueue;
    });
  }, []);

  const removeAt = useCallback((i: number) => {
    setQueue((prev) => {
      const nextQueue = removeAtPure(prev, i);
      setIndex((cur) => indexAfterRemove(cur, i));
      return nextQueue;
    });
  }, []);
```

Then, so the FIRST track of a queue and every auto-advance are counted, add `recordPlay` calls:
- In `playQueue`, right after `const track = tracks[startIndex] ?? tracks[0]!;` add `recordPlay(track);`
- In `advance`, right after `const track = q[nextIndex];` and its null check, add `recordPlay(track);`

- [ ] **Step 7: Expose the new API**

In the `useMemo` value object add: `expanded, setExpanded, jumpTo, reorderQueue, removeAt,` and add every new dependency (`expanded, jumpTo, reorderQueue, removeAt, recordPlay`) to the dependency array.

- [ ] **Step 8: Verify build + types**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/player/PlayerProvider.tsx lib/player/record-play.ts tests/record-play.test.ts
git commit -m "feat(player): queue ops, expanded state, play recording"
```

---

### Task 4: Play-history API route

**Files:**
- Create: `app/api/plays/route.ts`
- Test: manual (curl) — no DB test harness exists in this repo.

- [ ] **Step 1: Implement POST (record) and GET (stats), matching the envelope pattern**

```ts
// app/api/plays/route.ts
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/auth/csrf';
import { query, queryOne } from '@/lib/db/client';

const PostBody = z.object({
  trackId: z.string().uuid(),
  source: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    await assertCsrf(request);
    const parsed = PostBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide a valid trackId', 400);

    await query(
      `INSERT INTO play_history (user_id, track_id, source)
       VALUES ($1, $2, $3)`,
      [session.uid, parsed.data.trackId, parsed.data.source ?? 'queue'],
    );
    return ok({ recorded: true }, undefined, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const trackId = new URL(request.url).searchParams.get('trackId');
    if (!trackId) return fail('trackId is required', 400);

    const row = await queryOne<{ count: string; last_played_at: string | null }>(
      `SELECT count(*)::text AS count, max(played_at) AS last_played_at
         FROM play_history
        WHERE user_id = $1 AND track_id = $2`,
      [session.uid, trackId],
    );
    return ok({
      count: Number(row?.count ?? '0'),
      lastPlayedAt: row?.last_played_at ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
```

> Note: `assertCsrf` is required on POST because it mutates. Match how `app/api/favourites/route.ts` calls it (same signature).

- [ ] **Step 2: Verify locally against the dev DB**

Run: `npm run dev`, sign in, play a song, then in the browser devtools Network tab confirm `POST /api/plays` returns 201, and:
`curl` is not needed — CSRF requires the session cookie + header. Instead verify in devtools that a second GET `/api/plays?trackId=…` returns `count >= 1`.

Expected: POST 201; GET shows an increasing count.

- [ ] **Step 3: Commit**

```bash
git add app/api/plays/route.ts
git commit -m "feat(api): record and read per-user play history"
```

---

### Task 5: Shared SeekBar component (drag + keyboard)

**Files:**
- Create: `components/player/SeekBar.tsx`
- Create: `components/player/SeekBar.module.css`
- Modify: `components/player/PlayerPanel.tsx` (adopt SeekBar for the top progress bar)

- [ ] **Step 1: Implement SeekBar using the pure seek math**

```tsx
// components/player/SeekBar.tsx
'use client';

import { useRef, useState } from 'react';
import { nudge, secondsFromRatio } from '@/lib/player/seek';
import { formatDuration } from '@/lib/format';
import styles from './SeekBar.module.css';

type Props = {
  position: number;
  total: number;
  onSeek: (seconds: number) => void;
  variant?: 'mini' | 'full';
  ariaLabel?: string;
};

export function SeekBar({ position, total, onSeek, variant = 'mini', ariaLabel = 'Playback position' }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null); // seconds while dragging

  const shown = drag ?? position;
  const pct = total > 0 ? `${Math.min(100, (shown / total) * 100).toFixed(2)}%` : '0%';

  const secondsAt = (clientX: number) => {
    const box = barRef.current!.getBoundingClientRect();
    return secondsFromRatio((clientX - box.left) / box.width, total);
  };

  return (
    <div
      ref={barRef}
      className={`${styles.bar} ${styles[variant]}`}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${formatDuration(shown)} of ${formatDuration(total)}`}
      onPointerDown={(e) => {
        if (total <= 0) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDrag(secondsAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (drag === null) return;
        setDrag(secondsAt(e.clientX));
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        const secs = secondsAt(e.clientX);
        setDrag(null);
        onSeek(secs);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(nudge(position, -5, total)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(nudge(position, 5, total)); }
      }}
    >
      <i className={styles.fill} style={{ width: pct }} />
      <i className={styles.knob} style={{ left: pct }} aria-hidden="true" />
      {drag !== null ? <span className={styles.preview} style={{ left: pct }}>{formatDuration(drag)}</span> : null}
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

```css
/* components/player/SeekBar.module.css */
.bar { position: relative; width: 100%; cursor: pointer; touch-action: none; }
.bar:focus-visible { outline: 2px solid var(--accent, #4af); outline-offset: 2px; }
.mini { height: 6px; }
.full { height: 12px; }
.bar::before { content: ''; position: absolute; inset: 0; margin: auto 0; height: 4px; border-radius: 999px; background: rgba(255,255,255,.18); }
.fill { position: absolute; left: 0; top: 0; bottom: 0; margin: auto 0; height: 4px; border-radius: 999px; background: currentColor; }
.knob { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: currentColor; transform: translate(-50%, -50%); opacity: 0; transition: opacity .12s; }
.bar:hover .knob, .bar:focus-visible .knob, .full .knob { opacity: 1; }
.preview { position: absolute; bottom: 100%; transform: translateX(-50%); font-size: 11px; padding: 2px 4px; border-radius: 4px; background: #000; color: #fff; white-space: nowrap; }
```

- [ ] **Step 3: Adopt SeekBar in the mini bar**

In `components/player/PlayerPanel.tsx`, replace the existing `<div className={styles.progress} role="progressbar" …>…</div>` block (the click-to-seek bar near the top of the returned JSX) with:

```tsx
      <SeekBar position={position} total={total} onSeek={seek} variant="mini" />
```

Add the import: `import { SeekBar } from './SeekBar';`. Remove the now-unused `pct` computation ONLY if nothing else uses it (the `aside` scrub `--pos` still uses `pct`; keep `pct` for that, remove only the old progress `<div>`).

- [ ] **Step 4: Verify the mini bar still seeks (regression)**

Run: `npm run dev`, play a song, click AND drag the top bar; press ←/→ when it's focused.
Expected: position jumps on click, follows the drag, and nudges ±5s with arrows. No console errors. The hidden iframe stays hidden.

- [ ] **Step 5: Commit**

```bash
git add components/player/SeekBar.tsx components/player/SeekBar.module.css components/player/PlayerPanel.tsx
git commit -m "feat(player): draggable SeekBar, adopted by the mini bar"
```

---

### Task 6: AddToPlaylist menu

**Files:**
- Create: `components/player/AddToPlaylistMenu.tsx`
- Create: `components/player/AddToPlaylistMenu.module.css`
- Reference (do not change): existing `GET /api/playlists`, `POST /api/playlists`, `POST /api/playlists/[id]/tracks`.

- [ ] **Step 1: Confirm the playlist API shapes**

Read `app/api/playlists/route.ts` and `app/api/playlists/[id]/tracks/route.ts`. Note the exact request body each expects and the CSRF header name (`CSRF_HEADER` from `lib/auth/csrf.ts`) and where the token comes from (`GET /api/session`). Use the SAME client fetch pattern the existing screens use (grep `CSRF_HEADER` in `components/`).

- [ ] **Step 2: Implement the menu**

```tsx
// components/player/AddToPlaylistMenu.tsx
'use client';

import { useEffect, useState } from 'react';
import styles from './AddToPlaylistMenu.module.css';
import { csrfHeaders } from '@/lib/client/csrf'; // if this helper exists; else inline per Step 1

type Playlist = { id: string; name: string; hasTrack?: boolean };

export function AddToPlaylistMenu({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((env) => setLists(env.ok ? env.data : []))
      .catch(() => setLists([]));
  }, []);

  async function add(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/playlists/${id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
        body: JSON.stringify({ trackId }),
      });
      if (res.ok) onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.sheet} role="dialog" aria-label="Add to playlist">
      <header className={styles.head}>Add to playlist</header>
      {lists === null ? <p className={styles.msg}>Loading…</p> : null}
      {lists?.length === 0 ? <p className={styles.msg}>No playlists yet.</p> : null}
      <ul className={styles.list}>
        {lists?.map((pl) => (
          <li key={pl.id}>
            <button type="button" disabled={busy === pl.id} onClick={() => add(pl.id)}>
              {pl.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.close} onClick={onClose}>Close</button>
    </div>
  );
}
```

> If a `lib/client/csrf.ts` helper does NOT exist, replace `csrfHeaders()` with the inline pattern found in Step 1 (fetch `/api/session` for the token, send it under `CSRF_HEADER`). Do not invent a new CSRF mechanism.

- [ ] **Step 3: Add minimal styles**

```css
/* components/player/AddToPlaylistMenu.module.css */
.sheet { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: min(420px, 100%); background: #111; color: #fff; border-radius: 16px 16px 0 0; padding: 16px; z-index: 60; }
.head { font-weight: 600; margin-bottom: 8px; }
.list { list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow: auto; }
.list button { width: 100%; text-align: left; padding: 12px; background: none; color: inherit; border: 0; border-radius: 8px; }
.list button:disabled { opacity: .5; }
.msg { opacity: .7; padding: 12px; }
.close { margin-top: 8px; width: 100%; padding: 12px; border-radius: 8px; }
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, from a track open the menu, add to a playlist, confirm the playlist detail screen shows the track.
Expected: track added; menu closes; no duplicate error (existing API handles dupes).

- [ ] **Step 5: Commit**

```bash
git add components/player/AddToPlaylistMenu.tsx components/player/AddToPlaylistMenu.module.css
git commit -m "feat(player): add-to-playlist menu"
```

---

### Task 7: Now Playing page (overlay) with actions, play count, and Up Next

**Files:**
- Create: `components/player/NowPlaying.tsx`
- Create: `components/player/NowPlaying.module.css`
- Modify: `app/(app)/layout.tsx` (render `<NowPlaying />` beside `<PlayerPanel />`)
- Modify: `components/player/PlayerPanel.tsx` (tap identity → `setExpanded(true)`)

- [ ] **Step 1: Make the mini bar open the page**

In `PlayerPanel.tsx`, pull `expanded, setExpanded` from `usePlayer()`. Wrap the identity block (`styles.identity`) trigger: add `onClick={() => setExpanded(true)}` to the artwork/title area (NOT the FavouriteButton — keep that separate; stop propagation on the heart).

- [ ] **Step 2: Implement NowPlaying**

```tsx
// components/player/NowPlaying.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePlayer } from './PlayerProvider';
import { SeekBar } from './SeekBar';
import { AddToPlaylistMenu } from './AddToPlaylistMenu';
import { FavouriteButton } from '@/components/primitives/FavouriteButton';
import { PauseIcon, PlayIcon, ShuffleIcon } from '@/components/primitives/Icons';
import { formatDuration } from '@/lib/format';
import { reorder } from '@/lib/player/queue';
import styles from './NowPlaying.module.css';

export function NowPlaying() {
  const {
    current, queue, index, playing, position, duration, expanded, setExpanded,
    toggle, next, previous, seek, shuffle, setShuffle, repeat, cycleRepeat,
    jumpTo, reorderQueue, removeAt,
  } = usePlayer();

  const [showAdd, setShowAdd] = useState(false);
  const [stats, setStats] = useState<{ count: number; lastPlayedAt: string | null } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const total = duration || current?.durationSec || 0;

  // Load play stats whenever the track changes and the page is open.
  useEffect(() => {
    if (!expanded || !current) return;
    setStats(null);
    fetch(`/api/plays?trackId=${current.id}`)
      .then((r) => r.json())
      .then((env) => env.ok && setStats(env.data))
      .catch(() => {});
  }, [expanded, current?.id]);

  // Android back / Esc closes.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  if (!expanded || !current) return null;

  const upNext = queue.slice(index + 1);

  return (
    <div className={styles.overlay} role="dialog" aria-label="Now playing">
      <header className={styles.top}>
        <button type="button" className={styles.chevron} onClick={() => setExpanded(false)} aria-label="Close">⌄</button>
        <span>Now Playing</span>
        <span aria-hidden="true" />
      </header>

      <div className={styles.artWrap}>
        {current.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.thumbnailUrl} alt="" className={styles.art} />
        ) : null}
      </div>

      <h1 className={styles.title}>{current.title}</h1>
      <p className={styles.artist}>{current.sortArtist ?? current.channelTitle}</p>

      <div className={styles.actions}>
        <FavouriteButton key={current.id} trackId={current.id} initial={current.isFavourite} title={current.title} />
        <button type="button" onClick={() => setShowAdd(true)} aria-label="Add to playlist">＋ Playlist</button>
        <span className={styles.plays}>
          {stats ? `▶ ${stats.count} play${stats.count === 1 ? '' : 's'}` : '▶ …'}
        </span>
      </div>

      <SeekBar position={position} total={total} onSeek={seek} variant="full" />
      <div className={styles.times}>
        <span>{formatDuration(position)}</span>
        <span>{formatDuration(total)}</span>
      </div>

      <div className={styles.transport}>
        <button type="button" onClick={() => setShuffle(!shuffle)} aria-pressed={shuffle} aria-label="Shuffle"><ShuffleIcon size={20} /></button>
        <button type="button" onClick={previous} aria-label="Previous">⏮</button>
        <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
        <button type="button" onClick={next} aria-label="Next">⏭</button>
        <button type="button" onClick={cycleRepeat} aria-label={`Repeat: ${repeat}`} data-off={repeat === 'off'}>🔁</button>
      </div>

      <section className={styles.upNext} aria-label="Up next">
        <h2>Up Next</h2>
        {upNext.length === 0 ? <p className={styles.empty}>Nothing queued.</p> : null}
        <ul>
          {upNext.map((t, i) => {
            const qIndex = index + 1 + i;
            return (
              <li
                key={t.id}
                draggable
                onDragStart={() => setDragFrom(qIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null) reorderQueue(dragFrom, qIndex); setDragFrom(null); }}
                className={styles.row}
              >
                <span className={styles.handle} aria-hidden="true">⠿</span>
                <button type="button" className={styles.rowMain} onClick={() => jumpTo(qIndex)}>
                  <span className={styles.rowTitle}>{t.title}</span>
                  <span className={styles.rowArtist}>{t.sortArtist ?? t.channelTitle}</span>
                </button>
                <button type="button" className={styles.remove} onClick={() => removeAt(qIndex)} aria-label={`Remove ${t.title} from queue`}>✕</button>
              </li>
            );
          })}
        </ul>
      </section>

      {showAdd ? <AddToPlaylistMenu trackId={current.id} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}
```

> `reorder` is imported for parity but the actual reorder goes through `reorderQueue` (provider). Remove the unused import if lint flags it.

- [ ] **Step 3: Add styles (full-screen, mobile-first)**

```css
/* components/player/NowPlaying.module.css */
.overlay { position: fixed; inset: 0; z-index: 50; background: #0b0b0d; color: #fff; display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow-y: auto; }
.top { display: flex; justify-content: space-between; align-items: center; }
.chevron { font-size: 24px; background: none; border: 0; color: inherit; }
.artWrap { display: flex; justify-content: center; }
.art { width: min(70vw, 320px); aspect-ratio: 1; object-fit: cover; border-radius: 12px; }
.title { font-size: 22px; margin: 8px 0 0; }
.artist { opacity: .7; margin: 0; }
.actions { display: flex; align-items: center; gap: 16px; }
.plays { margin-left: auto; opacity: .8; font-size: 13px; }
.times { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; font-size: 12px; opacity: .8; }
.transport { display: flex; align-items: center; justify-content: space-between; }
.play { width: 64px; height: 64px; border-radius: 50%; background: #fff; color: #000; border: 0; display: grid; place-items: center; }
.upNext h2 { font-size: 13px; text-transform: uppercase; opacity: .6; }
.row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.handle { cursor: grab; opacity: .5; }
.rowMain { flex: 1; text-align: left; background: none; border: 0; color: inherit; display: flex; flex-direction: column; }
.rowArtist { opacity: .6; font-size: 12px; }
.remove { background: none; border: 0; color: inherit; opacity: .6; }
.empty { opacity: .6; }
```

- [ ] **Step 4: Render it in the layout**

In `app/(app)/layout.tsx`, next to `<PlayerPanel />`, add `<NowPlaying />` (import it). It renders nothing until `expanded`.

- [ ] **Step 5: Verify the whole flow**

Run: `npm run dev` on a phone viewport (devtools). Play a song → tap the bar → page opens with artwork/title/artist. Scrub the big bar. Favourite. Add to playlist. See "▶ N plays" (play a few times, reopen — count rises). Queue several songs → Up Next lists them → tap one jumps → drag ⠿ reorders → ✕ removes → current song keeps playing throughout. Close with ⌄ / Esc.
Expected: all pass; music never stops during queue edits.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint
git add components/player/NowPlaying.tsx components/player/NowPlaying.module.css app/\(app\)/layout.tsx components/player/PlayerPanel.tsx
git commit -m "feat(player): full Now Playing page with actions, play count, and up-next reorder"
```

---

### Task 8: Playwright coverage for the new flows

**Files:**
- Create: `e2e/now-playing.spec.ts`

- [ ] **Step 1: Write the E2E spec** (follow the existing specs under `e2e/` for the login helper + selectors)

```ts
// e2e/now-playing.spec.ts
import { test, expect } from '@playwright/test';
// Reuse the existing sign-in helper pattern from the other specs in e2e/.

test('open now playing, scrub, and reorder up next', async ({ page }) => {
  // 1. sign in (use existing helper) and start a queue from the Library.
  // 2. open the player bar -> now playing dialog is visible
  await expect(page.getByRole('dialog', { name: 'Now playing' })).toBeVisible();
  // 3. scrub the full seek bar and assert aria-valuenow changed
  const bar = page.getByRole('slider', { name: 'Playback position' }).last();
  const box = await bar.boundingBox();
  if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  // 4. Up Next present; jump to second item; remove one; assert list length drops
  await expect(page.getByRole('region', { name: 'Up next' })).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e -- now-playing`
Expected: PASS (fill in the sign-in + queue-start steps from the sibling specs).

- [ ] **Step 3: Commit**

```bash
git add e2e/now-playing.spec.ts
git commit -m "test(e2e): now playing open, scrub, up-next"
```

---

## Self-Review

- **Spec coverage:** A seek→Task5; B page→Task7; C add-to-playlist→Task6; D favourite→Task7 (reuse); E play count→Task3+4+7; F up next+reorder→Task1+3+7. All covered.
- **Type consistency:** `reorder/removeAt/indexAfterRemove` (Task1) used in Task3; `jumpTo/reorderQueue/removeAt/expanded/setExpanded` defined in Task3 and consumed in Task7; `SeekBar` props (Task5) match Task7 usage; `postPlay`/`shouldRecordPlay` (Task3) consistent.
- **Placeholder scan:** the only conditional instructions (CSRF helper in Task6, Playwright sign-in helper in Task8) point at concrete existing files to copy from, not TBDs.

## Known follow-ups (out of this plan)
- If `GET /api/playlists` does not already return a `hasTrack` flag, "disable playlists the song is already in" degrades gracefully (add still no-ops via the dupe-safe API). Add the flag later if wanted.
