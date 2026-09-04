# Moods & Genres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins tag songs with a fixed set of moods and genres, and let listeners browse/filter by them (a Browse screen + Library filters).

**Architecture:** New `tags` + `track_tags` tables via a re-runnable migration seeded with a curated taxonomy. Admin assigns tags per track (replace-the-set endpoint). Reads extend the existing tracks query with `mood`/`genre` filters and attach `moods[]`/`genres[]` to each track. A new Browse screen lists tag chips; Library filter chips gain mood/genre.

**Tech Stack:** Next.js 16, TypeScript, `pg`, `node:test`, Playwright.

**Repo note:** Customized Next.js — read `node_modules/next/dist/docs/` before app code (repo `AGENTS.md`). Migrations must use existence checks (`IF NOT EXISTS`) and be idempotent — match `db/migrations/001_init.sql`. Response/auth: `lib/api/respond.ts`, `requireAdmin`, `assertCsrf`.

**Depends on:** nothing in the Now Playing plan. Can ship independently.

---

### Task 1: Migration — tags + track_tags + seed

**Files:**
- Create: `db/migrations/005_moods_genres.sql`

- [ ] **Step 1: Write the migration (idempotent, existence-checked)**

```sql
-- db/migrations/005_moods_genres.sql
-- Moods & Genres: a fixed, admin-curated taxonomy and a track<->tag link table.

CREATE TABLE IF NOT EXISTS tags (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mood', 'genre')),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  slug text NOT NULL,
  UNIQUE (kind, slug)
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX IF NOT EXISTS track_tags_tag_idx ON track_tags (tag_id);

-- Seed the starter taxonomy. ON CONFLICT keeps re-runs a no-op.
INSERT INTO tags (kind, name, slug) VALUES
  ('mood','Romantic','romantic'),
  ('mood','Sad','sad'),
  ('mood','Happy','happy'),
  ('mood','Party','party'),
  ('mood','Devotional','devotional'),
  ('mood','Retro','retro'),
  ('genre','Bollywood','bollywood'),
  ('genre','Ghazal','ghazal'),
  ('genre','Qawwali','qawwali'),
  ('genre','Classical','classical'),
  ('genre','Pop','pop'),
  ('genre','Rock','rock')
ON CONFLICT (kind, slug) DO NOTHING;
```

- [ ] **Step 2: Apply to the dev DB and verify**

Run: `npm run migrate`
Then verify: `npm run migrate` a second time reports 0 newly applied (idempotent).
Expected: `tags` has 12 rows, `track_tags` exists, second run is a no-op.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/005_moods_genres.sql
git commit -m "feat(db): moods & genres tags + track_tags migration"
```

---

### Task 2: Types + tag row mapper

**Files:**
- Modify: `lib/library/types.ts`
- Create: `lib/library/tags.ts`
- Test: `tests/tags-map.test.ts`

- [ ] **Step 1: Write the failing test for grouping tag rows into a track**

```ts
// tests/tags-map.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupTags } from '../lib/library/tags';

test('groups tag rows by kind into name arrays', () => {
  const rows = [
    { kind: 'mood', name: 'Romantic' },
    { kind: 'genre', name: 'Bollywood' },
    { kind: 'mood', name: 'Retro' },
  ] as const;
  assert.deepEqual(groupTags(rows), { moods: ['Romantic', 'Retro'], genres: ['Bollywood'] });
});
test('empty rows yield empty arrays', () => {
  assert.deepEqual(groupTags([]), { moods: [], genres: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
// lib/library/tags.ts
export type TagRow = { kind: 'mood' | 'genre'; name: string };

export function groupTags(rows: readonly TagRow[]): { moods: string[]; genres: string[] } {
  const moods: string[] = [];
  const genres: string[] = [];
  for (const r of rows) (r.kind === 'mood' ? moods : genres).push(r.name);
  return { moods, genres };
}
```

Then extend `lib/library/types.ts`: add to `Track` (additive) `moods: string[];` and `genres: string[];`; in `toTrack` default them from `row.moods ?? []` / `row.genres ?? []`; add `moods?: string[]; genres?: string[];` to `ApiTrackRow`.

- [ ] **Step 4: Run tests**

Run: `npm test` — PASS. `npm run typecheck` — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/library/tags.ts lib/library/types.ts tests/tags-map.test.ts
git commit -m "feat(library): track moods/genres types + tag grouping"
```

---

### Task 3: Read APIs — list tags, filter tracks by tag

**Files:**
- Create: `app/api/tags/route.ts`
- Modify: the existing tracks list query/route (find it: `grep -rn "FROM tracks" app/api lib/library`) — add optional `mood`/`genre` filter + attach tags.

- [ ] **Step 1: List tags endpoint**

```ts
// app/api/tags/route.ts
import { handleError, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/auth/guard';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    await requireUser();
    const rows = await query<{ id: string; kind: string; name: string; slug: string }>(
      'SELECT id, kind, name, slug FROM tags ORDER BY kind, name',
    );
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}
```

- [ ] **Step 2: Extend the tracks query to filter by tag and return tags**

Locate the function that builds the library track list (from Step's grep). Add optional `mood?: string` / `genre?: string` (slugs) params. When present, constrain with:

```sql
-- add to WHERE when a mood/genre slug is provided (parameterised):
AND t.id IN (
  SELECT tt.track_id FROM track_tags tt
  JOIN tags g ON g.id = tt.tag_id
  WHERE g.kind = $K AND g.slug = $V
)
```

And attach each track's tags. Simplest additive approach: after fetching the page of tracks, run one grouped query for their ids:

```ts
const tagRows = ids.length ? await query<{ track_id: string; kind: 'mood'|'genre'; name: string }>(
  `SELECT tt.track_id, g.kind, g.name
     FROM track_tags tt JOIN tags g ON g.id = tt.tag_id
    WHERE tt.track_id = ANY($1::uuid[])
    ORDER BY g.kind, g.name`, [ids]) : [];
// then, per track id, groupTags(rowsForThatId) -> moods/genres
```

Wire the route handler to read `mood`/`genre` from the query string and pass them through.

- [ ] **Step 3: Verify locally**

Run: `npm run dev`; `GET /api/tags` returns 12 tags; `GET /api/tracks?genre=bollywood` returns only Bollywood-tagged tracks (empty until Task 4 assigns any); tracks include `moods`/`genres` arrays.

- [ ] **Step 4: Commit**

```bash
git add app/api/tags/route.ts <the modified tracks route/query file>
git commit -m "feat(api): list tags and filter tracks by mood/genre"
```

---

### Task 4: Admin tag assignment (endpoint + UI)

**Files:**
- Create: `app/api/admin/tracks/[id]/tags/route.ts`
- Modify: `components/admin/TrackAdminPanel.tsx` (add a mood/genre picker per track)

- [ ] **Step 1: Replace-the-set endpoint (admin + CSRF)**

```ts
// app/api/admin/tracks/[id]/tags/route.ts
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api/respond';
import { requireAdmin } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/auth/csrf';
import { query, withTransaction } from '@/lib/db/client';

const Body = z.object({ tagIds: z.array(z.string().uuid()).max(50) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    await assertCsrf(request);
    const { id } = await params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('Provide tagIds (array of uuids)', 400);

    await withTransaction(async (q) => {
      await q('DELETE FROM track_tags WHERE track_id = $1', [id]);
      for (const tagId of parsed.data.tagIds) {
        await q(
          `INSERT INTO track_tags (track_id, tag_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [id, tagId],
        );
      }
    });
    return ok({ trackId: id, tagIds: parsed.data.tagIds });
  } catch (err) {
    return handleError(err);
  }
}
```

> Uses the existing `withTransaction` from `lib/db/client.ts`. `params` is a Promise in this Next version — match the `[id]` route pattern already in `app/api/admin/tracks/[id]/route.ts`.

- [ ] **Step 2: Admin UI — a mood/genre multiselect per track**

In `components/admin/TrackAdminPanel.tsx`, follow the existing row/edit pattern. Load tags once (`GET /api/tags`), render two chip groups (moods, genres) per track's edit affordance, toggle to build a `tagIds` set, and `PUT /api/admin/tracks/{id}/tags` with the existing CSRF header helper used elsewhere in that panel. Show a saved indicator.

- [ ] **Step 3: Verify**

Run: `npm run dev` as admin; tag "Chhukar Mere Mann Ko" as Romantic + Bollywood; reload; the chips persist; `GET /api/tracks?mood=romantic` now returns it.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/tracks/\[id\]/tags/route.ts components/admin/TrackAdminPanel.tsx
git commit -m "feat(admin): assign moods/genres to tracks"
```

---

### Task 5: Browse screen

**Files:**
- Create: `app/(app)/browse/page.tsx`
- Create: `components/library/BrowseScreen.tsx` + `.module.css`
- Modify: nav (`components/chrome/Sidebar.tsx` and `components/chrome/TabBar.tsx`) — add a "Browse" entry.

- [ ] **Step 1: Browse screen — chips that filter into a playable list**

`BrowseScreen` (client): `GET /api/tags`, render Mood chips and Genre chips. Selecting a chip fetches `GET /api/tracks?mood=<slug>` (or `genre=`), shows the resulting tracks using the existing `TrackRow` component, and a "Play all" that calls `playQueue(tracks)` from `usePlayer()`. Reuse `LibraryScreen`/`TrackRow` patterns; do not build a new row component.

- [ ] **Step 2: Route + nav**

`app/(app)/browse/page.tsx` renders `<BrowseScreen />` (mirror `app/(app)/library/page.tsx`). Add a "Browse" link to `Sidebar` and `TabBar` next to Library/Search, matching their existing item markup and active-state logic.

- [ ] **Step 3: Verify**

Run: `npm run dev`; open Browse; tap "Romantic" → tagged songs appear; "Play all" starts a queue; the mini bar + Now Playing work with it.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/browse/page.tsx components/library/BrowseScreen.tsx components/library/BrowseScreen.module.css components/chrome/Sidebar.tsx components/chrome/TabBar.tsx
git commit -m "feat(browse): mood/genre browse screen + nav"
```

---

### Task 6: Library filter chips — mood/genre

**Files:**
- Modify: `components/library/FilterChips.tsx` (+ its module.css if needed)
- Modify: `components/library/LibraryScreen.tsx` (pass the selected mood/genre into the track fetch)

- [ ] **Step 1: Add mood/genre to the filter chips**

Extend `FilterChips` to also render mood + genre options (from `GET /api/tags`), tracked as selected slugs. When one is active, `LibraryScreen` includes `mood=`/`genre=` in its tracks request (the API already supports it from Task 3). Keep existing filters (recent/A–Z/etc.) working — additive only.

- [ ] **Step 2: Verify**

Run: `npm run dev`; in Library pick genre "Bollywood" → list narrows to Bollywood-tagged tracks; clearing restores the full list; existing sort chips still work.

- [ ] **Step 3: Commit**

```bash
git add components/library/FilterChips.tsx components/library/LibraryScreen.tsx
git commit -m "feat(library): filter by mood and genre"
```

---

### Task 7: Playwright coverage

**Files:**
- Create: `e2e/moods-genres.spec.ts`

- [ ] **Step 1: E2E — admin tags a song, listener browses to it** (reuse the sign-in helper from sibling specs)

```ts
// e2e/moods-genres.spec.ts
import { test, expect } from '@playwright/test';

test('admin tags a track and it appears under Browse', async ({ page }) => {
  // sign in as admin (existing helper), open admin, tag a known track Romantic+Bollywood, save.
  // then open /browse, click the "Romantic" chip, expect the tagged track to be listed.
  await page.goto('/browse');
  await page.getByRole('button', { name: 'Romantic' }).click();
  await expect(page.getByText('Chhu Kar Mere Manko', { exact: false })).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `npm run e2e -- moods-genres`
Expected: PASS (fill in the admin-tagging steps from Task 4's UI selectors).

- [ ] **Step 3: Commit**

```bash
git add e2e/moods-genres.spec.ts
git commit -m "test(e2e): moods/genres tag + browse"
```

---

## Self-Review

- **Spec coverage:** taxonomy+schema→Task1; types→Task2; list/filter APIs→Task3; admin assign→Task4; Browse screen→Task5; Library filters→Task6; tests→Task7. All Part-2 spec items covered.
- **Type consistency:** `groupTags`/`TagRow` (Task2) reused in Task3; `moods`/`genres` on `Track` (Task2) consumed by Browse/Library (Task5/6); `PUT …/tags` body `{tagIds}` (Task4) matches the admin UI call.
- **Placeholder scan:** the "find the tracks query" instruction (Task3) is a concrete grep, not a TBD; UI steps point at named existing components to mirror.

## Migration safety
- Additive only (new tables), existence-checked, seed uses `ON CONFLICT DO NOTHING` → safe to run against the live Neon DB and safe to re-run.
