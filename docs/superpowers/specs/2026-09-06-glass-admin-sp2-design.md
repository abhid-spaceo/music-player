# Design spec — Glass Admin suite, for real (SP2)

**Date:** 2026-09-06
**Status:** Approved design (decisions locked in brainstorming), ready for implementation plan
**Builds on:** SP1 (`2026-09-05-glass-sp1-foundation-design.md`) — foundation, theme architecture,
and the SP1 add-links screen whose quota/sub-nav were intentionally stubbed.

## Goal

Make the Glass Admin match Image #6 for real: fold the ADMIN sub-nav + quota into the shared
sidebar as one rail, add **real per-call quota metering**, show CHANNEL/LENGTH in the results
table, and build the four sub-pages (**Tracks / Playlist import / Users / Link health**) as glass
routes. The Current admin (tabs) is untouched.

## Decisions (locked)

| Question | Decision |
|---|---|
| Scope | **Whole SP2 in one spec** (user's call), delivered as a phased plan. |
| Quota accuracy | **Real per-call accounting** — a Pacific-date counter, incremented on every YouTube API call. |
| Sub-nav structure | **Real routes** (`/admin`, `/admin/tracks`, `/admin/playlist-import`, `/admin/users`, `/admin/link-health`). Glass renders the glass page; **Current theme redirects every sub-route to `/admin`** (keeps its tabs). |
| The rail | Fold the ADMIN sub-nav + quota into the **shared `Sidebar`**, shown only on glass + `/admin*` + admin role. Everywhere else the Sidebar is unchanged. |

## Architecture

### 1. Real routes + the rail

- New route folders under `app/(app)/admin/`: `tracks/`, `playlist-import/`, `users/`,
  `link-health/`, each a `page.tsx` that calls `getServerTheme()` and returns
  `glass ? <GlassXPage/> : redirect('/admin')`. `/admin` itself stays
  `glass ? <GlassAdminScreen/> : <AdminScreen/>` (SP1).
- **`Sidebar` becomes contextual.** It already reads `usePathname()` and `role`. Add: when
  `theme === 'glass'` **and** `pathname.startsWith('/admin')` **and** `role === 'admin'`, render an
  **ADMIN section** (a labelled group of links: Add links / Tracks / Playlist import / Users / Link
  health) below the primary nav, and pin the **`QuotaWidget`** at the bottom. `useTheme()` supplies
  the theme. Guarded so non-glass, non-admin-route, and non-admin renders are byte-for-byte as today.
- **Remove SP1's in-page sub-nav stub** from `GlassAdminScreen` (the rail owns nav now). The
  `screen` padding/layout stays.

### 2. Real quota metering

- **Migration** (idempotent, existence-checked, into the project's migration mechanism):
  `CREATE TABLE IF NOT EXISTS quota_usage (pt_date DATE PRIMARY KEY, units_spent INTEGER NOT NULL DEFAULT 0)`.
- **`lib/youtube/quota.ts`:**
  - `ptDate(now = new Date()): string` — the `YYYY-MM-DD` calendar date in `America/Los_Angeles`
    (via `Intl.DateTimeFormat` with that timeZone). Pure, unit-testable with an injected `now`.
  - `recordQuota(units: number): Promise<void>` — `INSERT … ON CONFLICT (pt_date) DO UPDATE SET
    units_spent = quota_usage.units_spent + $units`. No-op when `units <= 0`.
  - `getQuotaToday(): Promise<{ used: number; limit: number; resetsAt: string }>` — reads today's PT
    row (0 if none); `limit` from `YOUTUBE_DAILY_QUOTA` env (default 10000); `resetsAt` = next PT
    midnight ISO. Reset is implicit: a new PT date is a new row.
- **Instrumentation:** the only two quota-spending functions are `fetchVideoMetadata` and
  `fetchPlaylistVideoIds`, and each already returns a `callCount`. After a successful fetch, record
  it. To keep the YouTube client free of a hard DB import (and keep its unit tests pure), add an
  **optional `onQuota?: (units: number) => void` to `FetchOptions`**; callers in the API routes pass
  `recordQuota`. A tiny helper `withQuotaRecording` (or just passing `onQuota: (n) => void recordQuota(n)`)
  is used by `/api/admin/tracks`, `/api/admin/playlist/preview`, and `/api/cron/link-health`.
  *(Fire-and-forget with a caught rejection — a metering write must never fail an add.)*
- **Read endpoint:** `GET /api/admin/quota` (admin-guarded) → `getQuotaToday()`. `QuotaWidget`
  fetches it on mount and renders real numbers (replacing SP1's static props).

### 3. CHANNEL / LENGTH in results

- The `tracks` table already stores `channel_title` + `duration_sec`, and `fetchVideoMetadata`
  returns `channelTitle` + `durationSec`. Extend the `added` outcome from `POST /api/admin/tracks`
  to include `channelTitle` and `durationSec`.
- Update the shared `Outcome` type in `lib/admin/addLinks.ts` and render **CHANNEL** + **LENGTH**
  columns in `AddLinksResults` (LENGTH via `formatDuration`). Current `AddTracksPanel` ignores the
  new fields — unaffected.

### 4. The four glass pages

Each is a focused glass page rendered by its route; **logic is reused, not duplicated**:

- **`GlassTracksPage`** — ports `TrackAdminPanel` (list, search, edit sort-artist/tags, dead-link
  check) into glass styling. Extract shared data/handlers if that avoids duplicating fetches.
- **`GlassPlaylistImportPage`** — ports `PlaylistImportPanel` (preview + import) into glass.
- **`GlassUsersPage`** — new glass UI over the existing users API: list (GET), create (POST:
  email/password/displayName/role), delete (DELETE `[id]`), with confirm on delete.
- **`GlassLinkHealthPage`** — lists tracks whose `availability` is not "available" (reason +
  `availability_checked_at`), plus a "run check" action reusing the existing dead-link trigger.

## Components & files

**Create:** `lib/youtube/quota.ts`; `app/api/admin/quota/route.ts`; route `page.tsx` for
`tracks`/`playlist-import`/`users`/`link-health`; `GlassTracksPage`, `GlassPlaylistImportPage`,
`GlassUsersPage`, `GlassLinkHealthPage` (+ CSS), each <300 lines; a `Sidebar` admin-section subpart
if it keeps `Sidebar` small.

**Modify:** the migration script (add `quota_usage`); `lib/youtube/api.ts` (`onQuota` option on the
two fetchers); `/api/admin/tracks` (return channel/duration; pass `onQuota`);
`/api/admin/playlist/preview` + `/api/cron/link-health` (pass `onQuota`); `lib/admin/addLinks.ts`
(`Outcome.added` fields); `components/admin/glass/AddLinksResults.tsx` (+CSS) (columns);
`components/admin/glass/QuotaWidget.tsx` (fetch real data); `components/admin/GlassAdminScreen.tsx`
(drop the sub-nav stub); `components/chrome/Sidebar.tsx` (+CSS) (contextual ADMIN section + quota).

## Testing

- **Unit:** `ptDate()` at PT day boundaries (fixed `now`, incl. a UTC time that is the previous PT
  day); `recordQuota` upsert increment (against the test DB or a mocked client); results CHANNEL/
  LENGTH formatting.
- **E2E:** quota widget shows a number that **increases** after a real add; each admin sub-route
  renders in glass and **redirects to `/admin` in the current theme**; users create→appears→delete;
  link-health renders; the rail shows the ADMIN section only for an admin on `/admin*` in glass.
- **Not covered:** pixel-perfect vs mock; real midnight-PT rollover in a live clock; real cron timing.

## Risks & mitigations

1. **Shared `Sidebar` change** (every screen) → strictly guard by theme+route+role; verify the five
   non-admin screens and the Current theme are visually unchanged.
2. **DB migration on a shared database** → idempotent `IF NOT EXISTS`, existence-checked, run via the
   project's migration script; never hand-edit the DB. Verify by inspection, not by INSERTing.
3. **Coupling the YouTube client to the DB** → avoided via the injected `onQuota` callback; the client
   stays pure and its tests unchanged.
4. **Metering write failing an add** → `recordQuota` is fire-and-forget with a caught rejection.
5. **PT timezone correctness** → `Intl` with `America/Los_Angeles`, unit-tested at boundaries.
6. **Redirect loops** for current-theme sub-routes → redirect target `/admin` renders the Current
   tabbed page directly (no re-redirect).

## Out of scope (SP2)

- The non-admin glass gaps (Playlists artwork-tile grid, Search result tabs) — separate work.
- Historical quota charts; per-user quota; changing the cron schedule.
