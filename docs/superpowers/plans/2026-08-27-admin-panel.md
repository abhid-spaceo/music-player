# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **COMMIT GATE:** Every `Commit` step below is **blocked** until the owner says the literal word "commit" for that specific change. Do the work, run the checks, then stop at the commit step and ask.

**Goal:** Give the owner a browser screen at `/admin` to paste YouTube links into the library and to manage the tracks already in it — replacing the curl-and-`sed` workflow documented in `README.md:101`.

**Architecture:** One route, `/admin`, holding two panels behind an in-page tab toggle (ADD / LIBRARY) rather than two routes — this keeps the primary nav at five items instead of six. Every panel is a thin client over API routes that **already exist and are already tested**; no new endpoint and no database migration is introduced. The nav link is role-gated by threading the role the shell already fetches down into `Sidebar` and `TabBar`.

**Tech Stack:** Next.js App Router (client components), TypeScript, CSS Modules, `lib/api/client.ts` (`useApi` / `apiSend`), Playwright against real Chrome, `node:test` for units.

**Out of scope (decided 2026-08-27):** the users tab (owner uses `npm run seed` / `npm run set-password`), and any public "station" playlist — the app has exactly one user, so every playlist is already theirs and an `is_public` column would buy nothing.

---

## Grounding checks run before this plan was finalised (2026-08-27)

Verified against the machine, not assumed:

| Prerequisite | State |
|---|---|
| Node / npm / Next | v20.20.0 / 10.8.2 / ^16.3.3, `node_modules` installed |
| Postgres | reachable, migrations applied, 5 tracks, 0 playlists |
| Accounts | 1 admin **and** 1 listener — the role test in Task 1 needs both |
| `.env.local` | `DATABASE_URL`, `SESSION_SECRET`, `YOUTUBE_API_KEY`, `SEED_ADMIN_*`, `SEED_LISTENER_*` all set |
| Playwright | 1.62.1, real Chrome present (`channel: 'chrome'`) |

**Corrections applied after grounding — do not re-introduce:**

1. **There is no `--line` token.** Control borders use `var(--outline)`; row separators use `var(--rule)`; inset row lines use `var(--divider)`. `styles/tokens.css:24-27`.
2. **The palette has exactly one colour.** `--signal: #ffb000`, commented *"The ONLY colour."* (`styles/tokens.css:14`). Status is carried by the **text label**, never by hue — no green/red/amber badges. This also keeps the results readable without colour vision.
3. **`AVAILABILITY_LABEL` already exists** (`lib/library/types.ts:52`) with owner-facing wording — "Removed or made private", "Age-restricted — YouTube only". Reuse it; do not uppercase the raw enum.
4. **`ScreenHeader` already has a `below` slot** for a chip row under the meta line (`components/chrome/ScreenHeader.tsx:8`). The tab strip goes there, not in a sibling div.
5. **`playlists` is empty**, so the Task 6 negative path "delete a track that sits in a playlist" must create a playlist first.

---

## Existing API surface this plan consumes

No task in this plan may add or alter a route. These are the contracts, read from source:

| Route | Contract | Source |
|---|---|---|
| `POST /api/admin/tracks` | Body `{urls?: string[], text?: string}`. Returns `201`, `data` = `Outcome[]`, `meta` = `{added, duplicate, invalid, notFound, apiCalls, quotaUnitsSpent}` | `app/api/admin/tracks/route.ts:29` |
| `PATCH /api/admin/tracks/[id]` | Body `{sortArtist?, note?}` only. Returns updated row | `app/api/admin/tracks/[id]/route.ts:22` |
| `DELETE /api/admin/tracks/[id]` | Removes the row; playlist entries and favourites cascade | `app/api/admin/tracks/[id]/route.ts:55` |
| `POST /api/admin/tracks/refresh` | Body `{limit?: number}` default 50. Returns `{refreshed, markedUnavailable}` | `app/api/admin/tracks/refresh/route.ts:16` |
| `GET /api/tracks?limit=&q=` | Already returns `sort_artist`, `note`, `availability` — no admin-only list route is needed | `app/api/tracks/route.ts:41` |

`Outcome` is a discriminated union on `status`:

```ts
type Outcome =
  | { input: string; status: 'added'; videoId: string; title: string }
  | { input: string; status: 'duplicate'; videoId: string }
  | { input: string; status: 'invalid'; reason: string }
  | { input: string; status: 'not-found'; videoId: string };
```

### Known limitation, NOT fixed by this plan

`PATCH` writes `SET sort_artist = COALESCE($2, sort_artist)` (`app/api/admin/tracks/[id]/route.ts:40`). Because `COALESCE` ignores `null`, **sending an empty value cannot clear an existing note or sort-artist** — it silently keeps the old text. The Task 4 UI therefore only *sets* values. Raise this with the owner as a separate decision; do not change the route inside this plan.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `app/(app)/admin/page.tsx` | Route entry. Thin, matching `app/(app)/playlists/page.tsx` |
| `components/admin/AdminScreen.tsx` | Owns which tab is showing. Renders `ScreenHeader` + one panel |
| `components/admin/AddTracksPanel.tsx` | Paste box, submit, per-link outcome list |
| `components/admin/TrackAdminPanel.tsx` | Track table: search, availability marker, edit, delete, refresh |
| `components/admin/AdminScreen.module.css` | Styles for all three of the above |
| `e2e/admin.spec.ts` | Playwright coverage for the whole screen |

**Modify**

| File | Change |
|---|---|
| `components/primitives/Icons.tsx` | Add `AdminIcon`, matching the existing stroke pattern |
| `components/chrome/TabBar.tsx` | Add the admin entry to `DESTINATIONS` with an `adminOnly` flag; filter |
| `components/chrome/Sidebar.tsx` | Accept `role`, apply the same filter |
| `components/chrome/AppShell.tsx` | Keep the role from the session call it already makes; pass it down |

`DESTINATIONS` is exported from `TabBar.tsx` and imported by `Sidebar.tsx` — it is the single source of nav truth for both mobile and desktop. That is why the role has to reach both.

---

## Task 1: Role-gated `/admin` route and nav link

**Files:**
- Create: `app/(app)/admin/page.tsx`, `components/admin/AdminScreen.tsx`, `components/admin/AdminScreen.module.css`
- Modify: `components/primitives/Icons.tsx`, `components/chrome/TabBar.tsx:14-19`, `components/chrome/Sidebar.tsx:8`, `components/chrome/AppShell.tsx:22-40`
- Test: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `e2e/admin.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-1234';
const LISTENER_EMAIL = process.env.SEED_LISTENER_EMAIL ?? 'listener@example.com';
const LISTENER_PASSWORD = process.env.SEED_LISTENER_PASSWORD ?? 'listener-password-1234';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel('EMAIL').fill(email);
  await page.getByLabel('PASSWORD').fill(password);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.waitForURL('**/library');
}

test('admin: the nav link is visible to an admin and reaches the screen', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const link = page.getByRole('link', { name: 'ADMIN' }).first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'ADD LINKS' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TRACKS' })).toBeVisible();
});

test('admin: a listener never sees the nav link', async ({ page }) => {
  await signIn(page, LISTENER_EMAIL, LISTENER_PASSWORD);
  await expect(page.getByRole('link', { name: 'ADMIN' })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/admin.spec.ts --reporter=list`
Expected: FAIL — `getByRole('link', { name: 'ADMIN' })` resolves to 0 elements.

- [ ] **Step 3: Add the icon**

Append to `components/primitives/Icons.tsx`, following the `stroke` spread and `strokeWidth={1.7}` used by the other tab icons:

```tsx
export const AdminIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <path d="M12 3l7 3.5v5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5v-5z" />
    <path d="M12 9v5" />
    <path d="M9.5 11.5h5" />
  </svg>
);
```

- [ ] **Step 4: Add the destination and filter it by role**

In `components/chrome/TabBar.tsx`, extend the import, the const, and the component. Replace lines 6-40 with:

```tsx
import {
  QueueIcon,
  LibraryIcon,
  PlaylistsIcon,
  SearchIcon,
  AdminIcon,
} from '@/components/primitives/Icons';
import styles from './TabBar.module.css';

export type Role = 'admin' | 'listener';

export const DESTINATIONS = [
  { href: '/library',   label: 'LIBRARY',   Icon: LibraryIcon,   adminOnly: false },
  { href: '/search',    label: 'SEARCH',    Icon: SearchIcon,    adminOnly: false },
  { href: '/playlists', label: 'PLAYLISTS', Icon: PlaylistsIcon, adminOnly: false },
  { href: '/queue',     label: 'QUEUE',     Icon: QueueIcon,     adminOnly: false },
  { href: '/admin',     label: 'ADMIN',     Icon: AdminIcon,     adminOnly: true  },
] as const;

/** Hides admin-only entries. The server still enforces the role; this is only chrome. */
export function visibleDestinations(role: Role | null) {
  return DESTINATIONS.filter((d) => !d.adminOnly || role === 'admin');
}

export function TabBar({ role }: { role: Role | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Primary">
      {visibleDestinations(role).map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={styles.tab}
            aria-current={current ? 'page' : undefined}
          >
            <Icon />
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Apply the same filter in the sidebar**

In `components/chrome/Sidebar.tsx`, replace the import of `DESTINATIONS` and the signature:

```tsx
import { visibleDestinations, type Role } from './TabBar';
import styles from './Sidebar.module.css';

export function Sidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      {visibleDestinations(role).map(({ href, label, Icon }) => {
```

The rest of the component body is unchanged.

- [ ] **Step 6: Keep the role in the shell and pass it down**

In `components/chrome/AppShell.tsx`, add one state value beside the existing `checked`, set it in the session callback that already runs, and pass it to both navs:

```tsx
  const [checked, setChecked] = useState(false);
  const [role, setRole] = useState<'admin' | 'listener' | null>(null);

  // One session check per shell mount. This is also the call that revalidates
  // the cookie against the database, so a revoked session lands here.
  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((s) => {
        if (cancelled) return;
        if (!s.user) router.replace('/sign-in');
        else {
          setRole(s.user.role);
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace('/sign-in');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
```

and in the returned markup:

```tsx
      <Sidebar role={role} />
      <div className={styles.main}>{checked ? children : null}</div>
      <PlayerPanel />
      <TabBar role={role} />
```

Nothing else in `AppShell` moves. `PlayerProvider` and `PlayerPanel` are untouched, so playback across navigation is unaffected.

- [ ] **Step 7: Create the screen shell**

`components/admin/AdminScreen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ScreenHeader } from '@/components/chrome/ScreenHeader';
import { AddTracksPanel } from './AddTracksPanel';
import { TrackAdminPanel } from './TrackAdminPanel';
import styles from './AdminScreen.module.css';

type Tab = 'add' | 'tracks';

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('add');

  return (
    <>
      <ScreenHeader
        title="Admin"
        meta={tab === 'add' ? 'ADD LINKS' : 'TRACKS'}
        below={
          <div className={styles.tabs} role="tablist" aria-label="Admin sections">
            <button
          type="button"
          role="tab"
          aria-selected={tab === 'add'}
          className={styles.tab}
          onClick={() => setTab('add')}
        >
          ADD LINKS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tracks'}
          className={styles.tab}
          onClick={() => setTab('tracks')}
        >
              TRACKS
            </button>
          </div>
        }
      />
      {tab === 'add' ? <AddTracksPanel /> : <TrackAdminPanel />}
    </>
  );
}
```

`app/(app)/admin/page.tsx`, matching `app/(app)/playlists/page.tsx`:

```tsx
import { AdminScreen } from '@/components/admin/AdminScreen';

export default function AdminPage() {
  return <AdminScreen />;
}
```

`components/admin/AdminScreen.module.css`:

```css
.tabs {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}
.tab {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: transparent;
  color: var(--dim);
  font: var(--t-meta);
  letter-spacing: var(--ls-meta);
  cursor: pointer;
}
.tab[aria-selected='true'] {
  color: var(--bone);
  border-color: var(--bone);
}
```

- [ ] **Step 8: Create the two panels as stubs so the route compiles**

`components/admin/AddTracksPanel.tsx`:

```tsx
'use client';

export function AddTracksPanel() {
  return null;
}
```

`components/admin/TrackAdminPanel.tsx`:

```tsx
'use client';

export function TrackAdminPanel() {
  return null;
}
```

These are filled in by Tasks 2-5. They exist now only so Task 1 can be verified on its own.

- [ ] **Step 9: Run the checks**

```bash
npm run typecheck && npm run lint
npx playwright test e2e/admin.spec.ts --reporter=list
```

Expected: `tsc` 0 errors, `eslint` 0 errors, both admin tests PASS.

- [ ] **Step 10: Confirm nothing else regressed**

```bash
npx playwright test --reporter=list
```

Expected: the pre-existing specs (`organisation`, `playback`, `queue`) still pass. `TabBar` and `Sidebar` changed signature, so a compile error here would show as every spec failing.

- [ ] **Step 11: Commit** *(BLOCKED — ask the owner first)*

```bash
git add app/\(app\)/admin components/admin components/chrome/TabBar.tsx \
        components/chrome/Sidebar.tsx components/chrome/AppShell.tsx \
        components/primitives/Icons.tsx e2e/admin.spec.ts
git commit -m "feat: role-gated /admin route and nav entry"
```

---

## Task 2: Paste YouTube links to add tracks

**Files:**
- Modify: `components/admin/AddTracksPanel.tsx`, `components/admin/AdminScreen.module.css`
- Test: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `e2e/admin.spec.ts`:

```ts
test('admin: pasting links reports one outcome per link', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');

  // A valid new id, a duplicate of the seeded track, and something that is not a link.
  const fresh = `ADDTEST${String(Date.now()).slice(-4)}`;
  await page.getByLabel('YouTube links').fill(
    [`https://youtu.be/${fresh}`, 'https://youtu.be/dQw4w9WgXcQ', 'not-a-link'].join('\n'),
  );
  await page.getByRole('button', { name: 'ADD LINKS' }).click();

  const results = page.getByRole('list', { name: 'Results' });
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results.getByText('DUPLICATE')).toBeVisible();
  await expect(results.getByText('INVALID')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('quota');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/admin.spec.ts -g "pasting links" --reporter=list`
Expected: FAIL — no element labelled `YouTube links`.

- [ ] **Step 3: Implement the panel**

Replace `components/admin/AddTracksPanel.tsx` entirely:

```tsx
'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/api/client';
import styles from './AdminScreen.module.css';

type Outcome =
  | { input: string; status: 'added'; videoId: string; title: string }
  | { input: string; status: 'duplicate'; videoId: string }
  | { input: string; status: 'invalid'; reason: string }
  | { input: string; status: 'not-found'; videoId: string };

/** Wording the owner reads, keyed off the union's discriminant. */
const LABEL: Record<Outcome['status'], string> = {
  added: 'ADDED',
  duplicate: 'DUPLICATE',
  invalid: 'INVALID',
  'not-found': 'NOT FOUND',
};

function detail(o: Outcome): string {
  if (o.status === 'added') return o.title;
  if (o.status === 'invalid') return o.reason;
  if (o.status === 'duplicate') return 'Already in the library';
  return 'Deleted or private on YouTube';
}

export function AddTracksPanel() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      // apiSend unwraps `data`; the counts live in `meta`, so this one call
      // goes through fetch directly to keep both halves of the envelope.
      const res = await fetch('/api/admin/tracks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': await csrf(),
        },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json()) as
        | { ok: true; data: Outcome[]; meta: Record<string, number> }
        | { ok: false; error: string };
      if (!body.ok) throw new Error(body.error);
      setOutcomes(body.data);
      setSummary(
        `${body.meta.added} added · ${body.meta.duplicate} duplicate · ` +
          `${body.meta.invalid} invalid · ${body.meta.notFound} not found · ` +
          `${body.meta.quotaUnitsSpent} quota units spent`,
      );
      setText('');
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="links">
          YouTube links
        </label>
        <textarea
          id="links"
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={50_000}
          placeholder={'https://youtu.be/…\nhttps://www.youtube.com/watch?v=…'}
        />
        <p className={styles.hint}>
          One per line or comma separated. watch, youtu.be, shorts, embed, live, Music and
          bare ids all work. Duplicates and invalid links cost no YouTube quota.
        </p>
        <button type="submit" className={styles.primary} disabled={busy || !text.trim()}>
          {busy ? 'ADDING…' : 'ADD LINKS'}
        </button>
      </form>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}
      {summary ? (
        <p className={styles.summary} role="status">
          {summary}
        </p>
      ) : null}
      {outcomes ? (
        <ul className={styles.results} aria-label="Results">
          {outcomes.map((o, i) => (
            <li key={`${o.input}-${i}`} className={styles.result}>
              <span className={`${styles.badge} ${styles[o.status.replace('-', '')]}`}>
                {LABEL[o.status]}
              </span>
              <span className={`${styles.resultInput} truncate`}>{o.input}</span>
              <span className={`${styles.resultDetail} truncate`}>{detail(o)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The client caches the token after the first /api/session call. */
async function csrf(): Promise<string> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  const body = (await res.json()) as { data?: { csrfToken?: string } };
  return body.data?.csrfToken ?? '';
}
```

- [ ] **Step 4: Add the styles**

Append to `components/admin/AdminScreen.module.css`:

```css
.panel { padding: 0 16px; }
.label {
  display: block;
  margin-bottom: 6px;
  font: var(--t-meta);
  letter-spacing: var(--ls-meta);
  color: var(--dim);
}
.textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--outline);
  border-radius: 10px;
  background: transparent;
  color: var(--bone);
  font: var(--t-row-artist);
  resize: vertical;
}
.hint { margin: 8px 0 12px; font: var(--t-meta); color: var(--dim); }
.primary {
  width: 100%;
  padding: 11px;
  border: 1px solid var(--bone);
  border-radius: 999px;
  background: transparent;
  color: var(--bone);
  font: var(--t-meta);
  letter-spacing: var(--ls-meta);
  cursor: pointer;
}
.primary:disabled { opacity: 0.4; cursor: default; }
.problem { margin: 12px 0; font: var(--t-meta); color: var(--signal); }
.summary { margin: 12px 0; font: var(--t-meta); color: var(--dim); }
.results { list-style: none; margin: 0; padding: 0; }
.result {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 4px 10px;
  padding: 9px 0;
  border-top: 1px solid var(--rule);
}
.badge { font: var(--t-meta); letter-spacing: var(--ls-meta); }
.added { color: var(--bone); }
.duplicate { color: var(--dim); }
.invalid { color: var(--signal); }
.notfound { color: var(--signal); }
.resultInput { font: var(--t-row-artist); color: var(--bone); }
.resultDetail { grid-column: 2; font: var(--t-meta); color: var(--dim); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test e2e/admin.spec.ts -g "pasting links" --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit** *(BLOCKED — ask the owner first)*

```bash
git add components/admin/AddTracksPanel.tsx components/admin/AdminScreen.module.css e2e/admin.spec.ts
git commit -m "feat: paste YouTube links from the admin screen"
```

---

## Task 3: The track table

**Files:**
- Modify: `components/admin/TrackAdminPanel.tsx`, `components/admin/AdminScreen.module.css`
- Test: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `e2e/admin.spec.ts`:

```ts
test('admin: the track table lists and filters the library', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();

  const rows = page.getByRole('list', { name: 'Tracks' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const before = await rows.count();
  expect(before).toBeGreaterThan(1);

  await page.getByLabel('Search tracks').fill('Never Gonna');
  await expect(rows).toHaveCount(1, { timeout: 15_000 });
  await expect(rows.first()).toContainText('Never Gonna Give You Up');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/admin.spec.ts -g "track table" --reporter=list`
Expected: FAIL — no list named `Tracks`.

- [ ] **Step 3: Implement the table**

Replace `components/admin/TrackAdminPanel.tsx` entirely:

```tsx
'use client';

import { useState } from 'react';
import { useApi } from '@/lib/api/client';
import { useDebouncedSearch } from '@/lib/api/use-debounced-search';
import { formatDuration } from '@/lib/format';
import { AVAILABILITY_LABEL, type Availability } from '@/lib/library/types';
import styles from './AdminScreen.module.css';

export type AdminTrack = {
  id: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  duration_sec: number;
  sort_artist: string | null;
  note: string | null;
  availability: Availability;
};

export function TrackAdminPanel() {
  const [term, setTerm] = useState('');
  const path = term.trim()
    ? `/api/tracks?limit=200&q=${encodeURIComponent(term.trim())}`
    : '/api/tracks?limit=200';
  const { data, error, loading } = useApi<AdminTrack[]>(path);
  const tracks = data ?? [];

  return (
    <div className={styles.panel}>
      <label className={styles.label} htmlFor="track-search">
        Search tracks
      </label>
      <input
        id="track-search"
        className={styles.search}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Title, channel or artist"
      />

      <ul className={styles.tracks} aria-label="Tracks">
        {error ? (
          <li className={styles.state} role="status">
            Could not load tracks — {error}
          </li>
        ) : tracks.length === 0 && !loading ? (
          <li className={styles.state}>No tracks match.</li>
        ) : (
          tracks.map((t) => (
            <li key={t.id} className={styles.trackRow}>
              <div className={styles.trackMain}>
                <span className={`${styles.trackTitle} truncate`}>{t.title}</span>
                <span className={`${styles.trackMeta} truncate`}>
                  {t.sort_artist ?? t.channel_title} · {formatDuration(t.duration_sec)}
                  {AVAILABILITY_LABEL[t.availability] ? ` · ${AVAILABILITY_LABEL[t.availability]}` : ''}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
```

Note: `useDebouncedSearch` is imported by the existing search screens; if the import is unused after this task, delete the import line rather than leaving it — the debounce is added only if Step 5 shows the un-debounced input is too chatty.

- [ ] **Step 4: Add the styles**

Append to `components/admin/AdminScreen.module.css`:

```css
.search {
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: transparent;
  color: var(--bone);
  font: var(--t-row-artist);
}
.tracks { list-style: none; margin: 0; padding: 0; }
.trackRow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--rule);
}
.trackMain { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.trackTitle { font: var(--t-row-title); color: var(--bone); }
.trackMeta { margin-top: 2px; font: var(--t-meta); color: var(--dim); }
.state { padding: 16px 0; font: var(--t-meta); color: var(--dim); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test e2e/admin.spec.ts -g "track table" --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit** *(BLOCKED — ask the owner first)*

```bash
git add components/admin/TrackAdminPanel.tsx components/admin/AdminScreen.module.css e2e/admin.spec.ts
git commit -m "feat: admin track table with search"
```

---

## Task 4: Edit sort-artist and note, and delete a track

**Files:**
- Modify: `components/admin/TrackAdminPanel.tsx`, `components/admin/AdminScreen.module.css`
- Test: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `e2e/admin.spec.ts`:

```ts
test('admin: editing a sort artist persists across a reload', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByLabel('Search tracks').fill('Never Gonna');

  const row = page.getByRole('list', { name: 'Tracks' }).getByRole('listitem').first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const value = `Astley ${String(Date.now()).slice(-5)}`;
  await row.getByRole('button', { name: /^Edit / }).click();
  await page.getByLabel('Sort artist').fill(value);
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(row).toContainText(value, { timeout: 15_000 });

  await page.reload();
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByLabel('Search tracks').fill('Never Gonna');
  await expect(
    page.getByRole('list', { name: 'Tracks' }).getByRole('listitem').first(),
  ).toContainText(value, { timeout: 15_000 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/admin.spec.ts -g "editing a sort artist" --reporter=list`
Expected: FAIL — no `Edit …` button.

- [ ] **Step 3: Add edit and delete to the panel**

In `components/admin/TrackAdminPanel.tsx`, add `apiSend` and `refetch` to the imports and destructuring, add the editing state, and extend each row. The full replacement for the component body:

```tsx
export function TrackAdminPanel() {
  const [term, setTerm] = useState('');
  const path = term.trim()
    ? `/api/tracks?limit=200&q=${encodeURIComponent(term.trim())}`
    : '/api/tracks?limit=200';
  const { data, error, loading, refetch } = useApi<AdminTrack[]>(path);
  const [editing, setEditing] = useState<string | null>(null);
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const tracks = data ?? [];

  function open(t: AdminTrack) {
    setEditing(t.id);
    setArtist(t.sort_artist ?? '');
    setNote(t.note ?? '');
    setProblem(null);
  }

  async function save(id: string) {
    try {
      // Empty strings are omitted, not sent as null: the route's COALESCE
      // would ignore null anyway, so sending it would look like a silent
      // failure to clear. Clearing is not supported — see the plan header.
      const payload: { sortArtist?: string; note?: string } = {};
      if (artist.trim()) payload.sortArtist = artist.trim();
      if (note.trim()) payload.note = note.trim();
      if (Object.keys(payload).length === 0) {
        setProblem('Nothing to save. Clearing a value is not supported yet.');
        return;
      }
      await apiSend(`/api/admin/tracks/${id}`, 'PATCH', payload);
      setEditing(null);
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function remove(t: AdminTrack) {
    if (!window.confirm(`Delete "${t.title}"? It will also leave every playlist.`)) return;
    try {
      await apiSend(`/api/admin/tracks/${t.id}`, 'DELETE');
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <div className={styles.panel}>
      <label className={styles.label} htmlFor="track-search">
        Search tracks
      </label>
      <input
        id="track-search"
        className={styles.search}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Title, channel or artist"
      />

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}

      <ul className={styles.tracks} aria-label="Tracks">
        {error ? (
          <li className={styles.state} role="status">
            Could not load tracks — {error}
          </li>
        ) : tracks.length === 0 && !loading ? (
          <li className={styles.state}>No tracks match.</li>
        ) : (
          tracks.map((t) => (
            <li key={t.id} className={styles.trackRow}>
              <div className={styles.trackMain}>
                <span className={`${styles.trackTitle} truncate`}>{t.title}</span>
                <span className={`${styles.trackMeta} truncate`}>
                  {t.sort_artist ?? t.channel_title} · {formatDuration(t.duration_sec)}
                  {AVAILABILITY_LABEL[t.availability] ? ` · ${AVAILABILITY_LABEL[t.availability]}` : ''}
                </span>

                {editing === t.id ? (
                  <div className={styles.editor}>
                    <label className={styles.label} htmlFor={`artist-${t.id}`}>
                      Sort artist
                    </label>
                    <input
                      id={`artist-${t.id}`}
                      className={styles.search}
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      maxLength={200}
                    />
                    <label className={styles.label} htmlFor={`note-${t.id}`}>
                      Note
                    </label>
                    <input
                      id={`note-${t.id}`}
                      className={styles.search}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                    />
                    <div className={styles.editorActions}>
                      <button type="button" className={styles.primary} onClick={() => save(t.id)}>
                        SAVE
                      </button>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => setEditing(null)}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className={styles.rowButton}
                onClick={() => open(t)}
                aria-label={`Edit ${t.title}`}
              >
                EDIT
              </button>
              <button
                type="button"
                className={styles.rowButton}
                onClick={() => remove(t)}
                aria-label={`Delete ${t.title}`}
              >
                DELETE
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
```

Update the import line at the top of the file to:

```tsx
import { apiSend, useApi } from '@/lib/api/client';
```

- [ ] **Step 4: Add the styles**

Append to `components/admin/AdminScreen.module.css`:

```css
.editor { margin-top: 10px; }
.editorActions { display: flex; gap: 8px; }
.rowButton {
  flex: none;
  padding: 6px 10px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: transparent;
  color: var(--dim);
  font: var(--t-meta);
  letter-spacing: var(--ls-meta);
  cursor: pointer;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test e2e/admin.spec.ts -g "editing a sort artist" --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit** *(BLOCKED — ask the owner first)*

```bash
git add components/admin/TrackAdminPanel.tsx components/admin/AdminScreen.module.css e2e/admin.spec.ts
git commit -m "feat: edit and delete tracks from the admin screen"
```

---

## Task 5: Check for dead links on demand

**Files:**
- Modify: `components/admin/TrackAdminPanel.tsx`, `components/admin/AdminScreen.module.css`
- Test: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `e2e/admin.spec.ts`:

```ts
test('admin: the dead-link check reports how many it re-checked', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'TRACKS' }).click();
  await page.getByRole('button', { name: 'CHECK FOR DEAD LINKS' }).click();
  await expect(page.getByRole('status')).toContainText('re-checked', { timeout: 30_000 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/admin.spec.ts -g "dead-link check" --reporter=list`
Expected: FAIL — no such button.

- [ ] **Step 3: Add the button**

In `components/admin/TrackAdminPanel.tsx`, add two state values beside the existing ones:

```tsx
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
```

the handler:

```tsx
  async function checkDeadLinks() {
    if (checking) return;
    setChecking(true);
    setProblem(null);
    try {
      const res = await apiSend<{ refreshed: number; markedUnavailable: string[] }>(
        '/api/admin/tracks/refresh',
        'POST',
        { limit: 50 },
      );
      setCheckResult(
        `${res.refreshed} re-checked · ${res.markedUnavailable.length} now unavailable`,
      );
      refetch();
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : 'Could not check');
    } finally {
      setChecking(false);
    }
  }
```

and the control, directly under the search input in the returned markup:

```tsx
      <div className={styles.checkRow}>
        <button
          type="button"
          className={styles.rowButton}
          onClick={checkDeadLinks}
          disabled={checking}
        >
          {checking ? 'CHECKING…' : 'CHECK FOR DEAD LINKS'}
        </button>
        {checkResult ? (
          <span className={styles.summary} role="status">
            {checkResult}
          </span>
        ) : null}
      </div>
```

- [ ] **Step 4: Add the style**

Append to `components/admin/AdminScreen.module.css`:

```css
.checkRow { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test e2e/admin.spec.ts -g "dead-link check" --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit** *(BLOCKED — ask the owner first)*

```bash
git add components/admin/TrackAdminPanel.tsx components/admin/AdminScreen.module.css e2e/admin.spec.ts
git commit -m "feat: on-demand dead-link check in the admin screen"
```

---

## Task 6: Full QA pass and documentation

**Files:**
- Modify: `README.md:101-131`, `docs/build-log.md`

- [ ] **Step 1: Run every automated check**

```bash
npm run typecheck
npm run lint
npm test
npx next build
./scripts/verify-phase1.sh
./scripts/verify-phase2.sh
npx playwright test --reporter=list
```

Expected: `tsc` 0, `eslint` 0, units pass, build ok, both verify scripts pass, every Playwright spec passes with 0 console errors.

- [ ] **Step 2: Negative paths — do these by hand in the browser, minimum three**

1. **Wrong role.** Sign in as the listener. `/admin` must not appear in the nav, and typing the URL directly must render the screen with API calls returning 403 rather than data.
2. **Nothing but rubbish.** Paste three lines of nonsense. Expect three `INVALID` rows, `0 quota units spent`, and no new library rows.
3. **Empty and oversized input.** An empty box must leave the button disabled. Paste 600 links; the route caps `urls` at 500 — confirm the error is shown, not swallowed.
4. **Delete a track that is inside a playlist.** Confirm it disappears from the playlist too and the playlist screen does not error.
5. **Quota exhausted.** With the stub, force a 429 and confirm the message surfaces in `role="alert"`.

- [ ] **Step 3: Update the README**

Replace the "Adding tracks" section's opening at `README.md:101-104`. The curl block stays as the scripted alternative, but it is no longer the only way:

```markdown
## Adding tracks

Sign in as the admin and open **ADMIN → ADD LINKS**. Paste as many YouTube links as you
like, one per line or comma separated. Each one comes back marked `ADDED`, `DUPLICATE`,
`INVALID` or `NOT FOUND`, with the YouTube quota the batch cost.

The same thing scripted, for bulk imports from a file:
```

- [ ] **Step 4: Update the build log**

In `docs/build-log.md`, the known-gaps line at `:841` currently reads "No admin UI for adding tracks — the API works and the README documents it." Replace it with a dated entry recording that the admin screen now covers adding, editing, deleting and the dead-link check, and that **user management is still API-only by choice** since the app has one user.

- [ ] **Step 5: Commit** *(BLOCKED — ask the owner first)*

```bash
git add README.md docs/build-log.md
git commit -m "docs: admin screen replaces the curl workflow for adding tracks"
```

---

## Self-review

**Spec coverage** — "Add songs + library, skip users": Task 2 covers adding; Tasks 3-5 cover the library (list, search, edit, delete, dead-link check); no user-management task exists, matching the decision. The station-playlist question is recorded as out of scope with the reason.

**Placeholder scan** — every code step carries complete code; every run step carries an exact command and expected result. The one deliberate stub (Task 1 Step 8) is stated as a stub and is replaced by Tasks 2 and 3.

**Type consistency** — `AdminTrack` is defined once in Task 3 and reused in Tasks 4 and 5. `Outcome` matches the route's union field-for-field. `Role` is exported from `TabBar.tsx` and imported by `Sidebar.tsx`. `visibleDestinations` has one definition and two call sites. `apiSend` is imported in Task 4, which is the first task that calls it.

**Known risk carried forward** — `PATCH … COALESCE` cannot clear a field. Task 4 handles it with an explicit message instead of pretending the save worked. The route fix is deliberately not in this plan.
