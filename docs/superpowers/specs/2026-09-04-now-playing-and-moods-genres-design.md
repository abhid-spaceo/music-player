# Design: Now Playing experience + Moods & Genres

**Date:** 2026-09-04
**Status:** Approved (design), pending implementation plan
**Author:** pairing session

## Overview

Two slices, designed together, built together:

1. **Now Playing experience** — a scrubbable seek bar, a full-screen Now Playing
   page opened from the mini player bar, prominent Favourite + Add-to-Playlist
   actions, an app-owned "play count / last played" stat, and an "Up Next" queue
   list with tap-to-jump and drag-to-reorder.
2. **Moods & Genres** — an admin-assigned tagging system (fixed taxonomy) with a
   new Browse screen and mood/genre filters in the Library.

## Goals

- Make the player feel like Spotify / YT Music: tap the bar → full page, scrub
  the timeline, manage what plays next.
- Surface data the app *owns* (play counts) rather than mirroring YouTube.
- Let the owner organise the catalogue by mood and genre, and let listeners
  browse by them.

## Non-goals (explicitly out of scope)

- YouTube like/dislike/view/comment counts. Dislikes no longer exist in the API;
  likes/views are YouTube-global, not meaningful for this app. **Not built.**
- Lyrics, social features, recommendations/auto-mixes.
- Free-form user tagging or auto-tagging from YouTube categories (rejected in
  favour of a curated, admin-assigned taxonomy).

## Grounding (current code)

- `components/player/PlayerProvider.tsx` — in-memory `queue: Track[]` + `index`;
  working `seek(seconds)`; no `play_history` write; no queue reorder/jump/remove.
- `components/player/PlayerPanel.tsx` — mini bar; progress bar supports
  **click**-to-seek only; already has Favourite, Shuffle, Repeat, volume.
- `components/primitives/FavouriteButton.tsx` — reusable, works.
- `components/primitives/OverflowButton.tsx` — trigger only; **menu never built.**
- DB (`db/migrations/001–004`): `tracks`, `playlists`, `playlist_tracks`
  (position + DEFERRABLE for reorder), `favourites`, `play_history`
  (`user_id, track_id, played_at, ms_played, completed, source`) — **exists but
  unused**. No mood/genre anywhere.
- `lib/library/types.ts` — `Track` type; extend additively.

---

## Part 1 — Now Playing experience

### A. Scrubbable seek bar (shared component)

- New `components/player/SeekBar.tsx` (+ CSS). Props: `position`, `total`,
  `onSeek(seconds)`, size variant (`mini` | `full`).
- Interactions: click-to-seek (preserve current behaviour), **pointer drag**
  (mouse + touch), and `←/→` arrow keys to nudge ±5s when focused. While
  dragging, show a time preview and do not fight the 500ms poll (drag owns the
  displayed position until pointerup, then commit via `onSeek`).
- Adopt it in both `PlayerPanel` (mini) and the Now Playing page (full).
- **Risk:** shared surface. Verify the mini bar's click-seek still works and the
  hidden iframe is untouched.

### B. Full Now Playing page (overlay)

- New `components/player/NowPlaying.tsx` (+ CSS). Rendered from the `(app)`
  layout next to `PlayerPanel` so the audio host is never unmounted. **Overlay,
  not a route** — toggled by an `expanded` boolean added to `PlayerProvider`
  (no new context).
- Open: tap the mini bar's identity area (artwork/title). Close: chevron,
  swipe-down, Android back (history state), or Esc.
- Layout (mobile-first, matches reference): big artwork, title + `sortArtist ??
  channelTitle`, action row (Favourite, Add-to-Playlist, play-count chip), big
  SeekBar with times, transport row (shuffle/prev/play-pause/next/repeat), then
  the Up Next list.

### C. Add to playlist menu

- New `components/player/AddToPlaylistMenu.tsx`. Opens from the ＋ action.
- Lists the current user's playlists (GET existing playlists API), tap to add
  (existing `POST /api/playlists/[id]/tracks`), plus "＋ New playlist" (existing
  create API). Toast on success; entries the song is already in are disabled.

### D. Favourite

- Reuse `FavouriteButton` (keyed by track id), shown large on the page. No
  backend change.

### E. Play count & last played

- **Write:** when a new track *begins* (at the `loadVideoById` call in
  `playQueue`/`advance`), the client fires `POST /api/plays { trackId, source }`
  → inserts one `play_history` row (`source='queue'`). Deduped per load via a
  ref holding the last-recorded track id, so repeats/seeks don't double-count.
- **Read:** `GET /api/plays?trackId=…` → `{ count, lastPlayedAt }` for the
  current user, shown as "Played N times · last played <relative>".
- Files: `app/api/plays/route.ts`; a client hook + a `recordPlay` call in
  `PlayerProvider`.

### F. Up Next list + drag reorder

- Now Playing shows queue items from `index + 1` onward.
- `PlayerProvider` gains: `jumpTo(i)`, `reorderQueue(from, to)`, `removeAt(i)` —
  pure array ops that keep the *current* track stable (adjust `index`).
- Tap a row → `jumpTo`. Drag the ⠿ handle → `reorderQueue`. ✕ / swipe →
  `removeAt`. Ephemeral queue, so **no API/DB** involved.
- Drag: pointer-based reorder within the list (accessible fallback: move up/down
  in the row overflow).

---

## Part 2 — Moods & Genres

### Data model (new migration `005_moods_genres.sql`, with existence checks)

```
tags (
  id    uuid pk default gen_random_uuid(),
  kind  text not null check (kind in ('mood','genre')),
  name  text not null,
  slug  text not null,
  unique (kind, slug)
)
track_tags (
  track_id uuid references tracks(id) on delete cascade,
  tag_id   uuid references tags(id)   on delete cascade,
  primary key (track_id, tag_id)
)
```

- Seed taxonomy (idempotent, `ON CONFLICT DO NOTHING`):
  - Moods: Romantic, Sad, Happy, Party, Devotional, Retro
  - Genres: Bollywood, Ghazal, Qawwali, Classical, Pop, Rock
- `Track` type gains `moods: string[]` and `genres: string[]` (additive).

### Assign (admin)

- In the admin track panel, a mood/genre multi-select per song → writes
  `track_tags` via a new admin endpoint (`POST /api/admin/tracks/[id]/tags`,
  admin-guarded + CSRF, replaces the set for that track).

### Browse + filter

- **New Browse screen** (`/browse`): mood chips and genre chips; tapping one
  opens a filtered track list that can be played as a queue.
- **Library filters:** extend the existing filter chips with mood/genre.
- Read APIs: `GET /api/tags` (list), `GET /api/tracks?mood=&genre=` (filter) —
  extend the existing tracks query rather than adding a parallel one.

---

## Testing / verification

- **Unit:** queue ops (`jumpTo`/`reorder`/`removeAt`) keep `current` correct;
  seek clamping; play-count dedupe.
- **E2E (Playwright):** open Now Playing from the bar; drag the seek bar and
  assert position; add to playlist; favourite toggles; reorder Up Next; tag a
  song as admin and find it in Browse and Library filter.
- **Manual (browser, prod-like):** every flow on a phone viewport.
- **Migration:** re-runnable; existence checks on tables/indexes; verify on a
  scratch DB before Neon.

### What this does NOT cover

- No verification of YouTube-side data (not used). No load testing. Drag-reorder
  is exercised via pointer events in E2E, not real touch hardware.

## Rollout

Single combined effort, but implementable/verifiable in this order to keep each
step shippable: A (seek) → B (page shell) → D/C (favourite/playlist) → E (play
count) → F (up next) → G (moods & genres). Each step browser-verified before the
next.

## Files touched (summary)

- New: `SeekBar.tsx`, `NowPlaying.tsx`, `AddToPlaylistMenu.tsx`,
  `app/api/plays/route.ts`, `db/migrations/005_moods_genres.sql`,
  `app/(app)/browse/page.tsx` + Browse components,
  `app/api/admin/tracks/[id]/tags/route.ts`.
- Edited: `PlayerProvider.tsx` (queue ops, play record, expanded state),
  `PlayerPanel.tsx` (adopt SeekBar, open trigger), `lib/library/types.ts`
  (moods/genres, play stats), Library filter chips + tracks query, admin track
  panel (tag picker), `GET /api/tags`.
```
