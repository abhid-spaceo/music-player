# Glass SP1 — Foundation + Theme Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Glass design foundation (fonts, full token sheet, radius scale, art-bloom wiring) and the theme-branch architecture, proven on two reference screens (Now Playing = bloom half, Admin add-links = flat half), with the Current look fully intact behind the toggle.

**Architecture:** The server already resolves the theme from the `mp_theme` cookie and sets `<html data-theme>`. We add a client `ThemeProvider` so client components can read the theme and branch structure (`theme==='glass' ? <GlassX/> : <X/>`). The Admin page (a server component) branches by reading the cookie directly. The account-menu toggle already writes the cookie + flips `dataset.theme` + calls `router.refresh()`, so switching is a soft reload. New Glass components live beside the Current ones; Current code is untouched so no other screen can regress.

**Tech Stack:** Next.js (App Router, server + client components), React, CSS Modules, `@fontsource` self-hosted fonts, Vitest (unit), Playwright (E2E).

---

## File structure

**Create:**
- `lib/theme/ThemeProvider.tsx` — client context + `useTheme()`, seeded from the server value.
- `lib/theme/getServerTheme.ts` — tiny server helper reading `mp_theme` via `next/headers`.
- `components/player/GlassNowPlaying.tsx` + `.module.css` — Glass Now Playing.
- `components/admin/GlassAdminScreen.tsx` + `.module.css` — Glass Admin shell (sidebar rail + main).
- `components/admin/glass/QuotaWidget.tsx` — bottom-of-rail quota meter (SP1: static value).
- `components/admin/glass/AddLinksResults.tsx` — detected-counter + last-batch results table.

**Modify:**
- `styles/tokens.css` — rewrite the `[data-theme="glass"]` block to the full token sheet + radius scale.
- `app/layout.tsx` — add Manrope / Instrument Serif / JetBrains Mono imports; wrap `{children}` in `ThemeProvider`.
- `components/chrome/AppShell.tsx` — branch `NowPlaying` vs `GlassNowPlaying` on `useTheme()`.
- `app/(app)/admin/page.tsx` — branch `AdminScreen` vs `GlassAdminScreen` on `getServerTheme()`.
- `tests/theme.test.ts` — extend with provider seed / normalize coverage.
- `tests/e2e/glass.spec.ts` (create) — Playwright dual-theme render + toggle.

Design source of truth for exact structure/values: `~/Downloads/Product naming and design decisions_files/Personal FM Directions.dc.html` — sections **A1/A6** (Now Playing) and **3e** (Admin add-links), and **A4** (token sheet).

---

## Task 1: Install the three Glass fonts

**Files:** `package.json` (via npm), `app/layout.tsx`

- [ ] **Step 1: Install self-hosted font packages**

Run: `npm i @fontsource-variable/manrope @fontsource/instrument-serif @fontsource/jetbrains-mono`
Expected: three packages added; `node_modules/@fontsource-variable/manrope` etc. exist.

- [ ] **Step 2: Import the faces in the root layout**

In `app/layout.tsx`, below the existing font imports (after line 9), add:

```ts
import '@fontsource-variable/manrope'; // UI — variable 400–700
import '@fontsource/instrument-serif/400.css'; // display/marketing voice
import '@fontsource/jetbrains-mono/400.css'; // numerals + labels
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
```

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build 2>&1 | tail -5` (or `npx tsc --noEmit` if faster)
Expected: no module-not-found for the new fonts.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/layout.tsx
git commit -m "feat(glass): self-host Manrope, Instrument Serif, JetBrains Mono"
```

---

## Task 2: Server theme helper

**Files:** Create `lib/theme/getServerTheme.ts`

- [ ] **Step 1: Write the helper**

```ts
import { cookies } from 'next/headers';
import { THEME_COOKIE, normalizeTheme, type ThemeName } from './theme';

/** Resolve the active theme on the server from the cookie. Missing → default. */
export async function getServerTheme(): Promise<ThemeName> {
  const store = await cookies();
  return normalizeTheme(store.get(THEME_COOKIE)?.value);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/theme/getServerTheme.ts
git commit -m "feat(glass): add getServerTheme cookie helper"
```

---

## Task 3: Client ThemeProvider + useTheme

**Files:** Create `lib/theme/ThemeProvider.tsx`; Test `tests/theme.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/theme.test.ts`)

```ts
import { normalizeTheme } from '@/lib/theme/theme';

describe('theme seed', () => {
  it('coerces an unknown seed to the default (glass)', () => {
    expect(normalizeTheme('bogus')).toBe('glass');
  });
  it('preserves an explicit current seed', () => {
    expect(normalizeTheme('current')).toBe('current');
  });
});
```

- [ ] **Step 2: Run it (should pass — guards the seed contract the provider relies on)**

Run: `npm test -- theme`
Expected: PASS (this locks the contract; provider itself is a thin client wrapper tested via E2E).

- [ ] **Step 3: Write the provider**

```tsx
'use client';

import { createContext, useContext } from 'react';
import { type ThemeName } from './theme';

const ThemeContext = createContext<ThemeName>('glass');

/** Seeded once from the server-resolved theme; stable for the render (the toggle
 * does a router.refresh, which re-seeds from the cookie). */
export function ThemeProvider({ theme, children }: { theme: ThemeName; children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeName {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Wire it into the root layout**

In `app/layout.tsx`: import `ThemeProvider`, and change the body to seed it with the already-resolved `theme`:

```tsx
<body>
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
</body>
```

- [ ] **Step 5: Type-check + test**

Run: `npx tsc --noEmit && npm test -- theme`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/theme/ThemeProvider.tsx app/layout.tsx tests/theme.test.ts
git commit -m "feat(glass): client ThemeProvider + useTheme, seeded from server"
```

---

## Task 4: Rewrite the Glass token sheet

**Files:** Modify `styles/tokens.css` (the `[data-theme="glass"]` block, lines 97–132)

- [ ] **Step 1: Replace the glass block** with the full A4 token sheet. Keep the SAME override token names the app already reads, and ADD the new glass-only tokens. Values transcribed from the design token sheet:

```css
[data-theme='glass'] {
  /* Substrate */
  --base: #0d0b14;        /* --bg-deep */
  --bg-void: #08070c;
  --bg-deep: #0d0b14;

  /* Glass surfaces (fill + blur). Never nest two glass levels directly. */
  --glass-1: rgba(255, 255, 255, 0.07);
  --glass-2: rgba(255, 255, 255, 0.1);
  --glass-3: rgba(255, 255, 255, 0.16);
  --raised: var(--glass-2);
  --panel-blur-1: 24px;
  --panel-blur-2: 28px;
  --panel-blur-3: 26px;
  --glass-blur: 18px;     /* fixed chrome */

  /* Text / ink */
  --bone: #f6f4ff;        /* --ink */
  --ink: #f6f4ff;
  --dim: rgba(246, 244, 255, 0.72);   /* --ink-2 */
  --dimmer: rgba(246, 244, 255, 0.62); /* --ink-3 — on glass only, never on bloom */

  /* Borders — 1px, inset-lit */
  --edge-1: rgba(255, 255, 255, 0.12);
  --edge-2: rgba(255, 255, 255, 0.16);
  --edge-hi: rgba(255, 255, 255, 0.22);
  --divider: var(--edge-1);
  --hairline: var(--edge-1);
  --rule: rgba(255, 255, 255, 0.14);
  --outline: var(--edge-2);

  /* Accent — art-derived, with fallback pair */
  --accent: #c4b5fd;
  --accent-2: #ff8fc3;
  --signal: var(--accent-2);
  --playing-wash: rgba(255, 143, 195, 0.12);
  --track: rgba(255, 255, 255, 0.12);
  --scrim: rgba(5, 4, 10, 0.62);

  /* Shadows + bloom */
  --lift-1: 0 14px 34px rgba(0, 0, 0, 0.4);
  --lift-2: 0 24px 60px rgba(0, 0, 0, 0.5);
  --lift-3: 0 34px 80px rgba(0, 0, 0, 0.55);
  --ambient-blur: 60px;
  --ambient-grad: radial-gradient(70% 55% at 50% -6%, rgba(138, 92, 255, 0.45), transparent 60%),
    radial-gradient(90% 60% at 100% 105%, rgba(255, 79, 163, 0.28), transparent 65%);

  /* Radius scale (replaces the wrong single 10px) */
  --r-9: 9px;
  --r-14: 14px;
  --r-20: 20px;
  --r-26: 26px;
  --r-pill: 999px;
  --radius: var(--r-14); /* default for controls that read --radius */

  /* Type — Manrope UI, JetBrains Mono numerals/labels, Instrument Serif display */
  --sans: 'Manrope Variable', 'Manrope', ui-sans-serif, system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --serif: 'Instrument Serif', Georgia, serif;
  --t-screen-title: 700 27px/1.1 var(--sans);
  --t-row-title: 600 13.5px/1.25 var(--sans);
  --t-row-artist: 400 12px/1.3 var(--sans);

  /* Primary play/pause gradient */
  --play-bg: linear-gradient(148deg, #8a5cff 0%, #ff4fa3 54%, #ffb86b 100%);
  --play-fg: #1a0b2e;
}
```

- [ ] **Step 2: Add inert defaults in `:root`** so Current is unaffected by any new token a glass component reads. In the `:root` theming-support block (near line 81), add:

```css
  --bg-deep: var(--base);
  --glass-1: var(--raised);
  --glass-2: var(--raised);
  --glass-3: var(--raised);
  --edge-1: var(--hairline);
  --edge-2: var(--outline);
  --edge-hi: var(--outline);
  --accent: var(--signal);
  --accent-2: var(--signal);
  --serif: var(--sans);
  --lift-1: none;
  --lift-2: none;
  --lift-3: none;
  --panel-blur-1: 0px;
  --panel-blur-2: 0px;
  --panel-blur-3: 0px;
  --r-9: var(--radius);
  --r-14: var(--radius);
  --r-20: var(--radius);
  --r-26: var(--radius);
  --r-pill: var(--radius);
```

- [ ] **Step 3: Verify both themes still build and the existing screens are unchanged in Current**

Run: `npm run dev` and load `/library` with `mp_theme=current` — visually identical to before.
Expected: no change to Current; Glass now uses the real radius scale + Manrope.

- [ ] **Step 4: Commit**

```bash
git add styles/tokens.css
git commit -m "feat(glass): full token sheet + radius scale; inert :root defaults"
```

---

## Task 5: Glass Now Playing (bloom half)

**Files:** Create `components/player/GlassNowPlaying.tsx` + `.module.css`; Modify `components/chrome/AppShell.tsx`

- [ ] **Step 1: Author `GlassNowPlaying.tsx`** — same behavior/hooks as `NowPlaying.tsx` (reuse `usePlayer`, the hash-history close, stats fetch, drag reorder), but the design's A1/A6 structure: a fixed bloom layer reading `--art-glow`/`--ambient-grad`, artwork + transport in floating `--glass-2` panels (`--edge-2`, `--lift-2`, `--r-26` art / `--r-14` controls), title in Manrope 700, "PLAYING FROM" label in JetBrains Mono 10/700, mono times, plain-alpha up-next rows (no per-row blur). Wire `useArtGlow(current)` to set `--art-glow` on the overlay root. Reuse `SeekBar`, `FavouriteButton`, `AddToPlaylistMenu`, `Icons` unchanged.

  Copy the logic from `NowPlaying.tsx` verbatim (do not re-derive it); only the returned JSX + `styles` differ. Keep the file < 200 lines; if the bloom layer grows, extract `GlassBloom.tsx`.

- [ ] **Step 2: Branch in `AppShell.tsx`**

Replace the `<NowPlaying />` usage (line ~66) with a theme branch. At the top: `import { useTheme } from '@/lib/theme/ThemeProvider';` and `import { GlassNowPlaying } from '@/components/player/GlassNowPlaying';`. Inside the component: `const theme = useTheme();` then render `{theme === 'glass' ? <GlassNowPlaying /> : <NowPlaying />}`.

- [ ] **Step 3: Browser-verify both themes**

Run: `npm run dev`; with `mp_theme=glass` open a track → expand Now Playing → confirm bloom tints from art, panels are frosted/rounded, type is Manrope. Switch to `current` → the original overlay renders. No console errors; player keeps playing across the expand/collapse.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/player/GlassNowPlaying.tsx components/player/GlassNowPlaying.module.css components/chrome/AppShell.tsx
git commit -m "feat(glass): Glass Now Playing with art bloom; branch in AppShell"
```

---

## Task 6: Glass Admin add-links (flat half)

**Files:** Create `components/admin/GlassAdminScreen.tsx` + `.module.css`, `components/admin/glass/QuotaWidget.tsx`, `components/admin/glass/AddLinksResults.tsx`; Modify `app/(app)/admin/page.tsx`

- [ ] **Step 1: Author the results + quota subparts.**

`AddLinksResults.tsx` renders the detected-links counter ("N LINKS DETECTED · EST. M QUOTA UNITS") and the last-batch table (STATUS / TITLE / CHANNEL / LENGTH) with ADDED / DUPLICATE / INVALID pills, driven by props shaped from the existing add-tracks response (reuse the result type `AddTracksPanel` already consumes — import it, do not redefine). `QuotaWidget.tsx` renders the "YOUTUBE QUOTA n/10,000 · Resets 00:00 PT" card; SP1 passes a static `used`/`limit` with a `// SP2: wire real quota` note.

- [ ] **Step 2: Author `GlassAdminScreen.tsx`** — the 3e layout on flat `--bg-deep`, no bloom: left rail with "Personal FM" branding + Browse/Library/Admin + an ADMIN sub-nav (Add links active; Tracks / Playlist import / Users / Link health rendered but inert with `aria-disabled` + a `title="SP2"`), `QuotaWidget` pinned bottom; main column with title + description, `ADMIN · {email}` pill (reuse the session email fetch pattern from `AccountMenu`), the glass paste field, and `AddLinksResults`. Reuse `AddTracksPanel`'s existing submit/parse logic — import and render it inside the glass frame rather than duplicating the fetch, OR lift its handler; keep the network call single-sourced.

- [ ] **Step 3: Branch in the admin page** (`app/(app)/admin/page.tsx`)

```tsx
import { AdminScreen } from '@/components/admin/AdminScreen';
import { GlassAdminScreen } from '@/components/admin/GlassAdminScreen';
import { getServerTheme } from '@/lib/theme/getServerTheme';

export default async function AdminPage() {
  const theme = await getServerTheme();
  return theme === 'glass' ? <GlassAdminScreen /> : <AdminScreen />;
}
```

- [ ] **Step 4: Browser-verify both themes**

Run: `npm run dev`; with `mp_theme=glass` open `/admin` → matches Image #6 (rail + sub-nav + quota + glass paste + results table). Paste one real link, add it, confirm a real ADDED/DUPLICATE row appears. Switch to `current` → the original tabbed Admin renders. No console errors.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "components/admin/GlassAdminScreen.tsx" "components/admin/GlassAdminScreen.module.css" components/admin/glass "app/(app)/admin/page.tsx"
git commit -m "feat(glass): Glass Admin add-links (rail, quota, results table)"
```

---

## Task 7: E2E — dual-theme render + toggle

**Files:** Create `tests/e2e/glass.spec.ts`

- [ ] **Step 1: Write the Playwright spec** (deterministic: seed the cookie, assert layout markers, no fixed sleeps)

```ts
import { test, expect } from '@playwright/test';

for (const theme of ['glass', 'current'] as const) {
  test(`Now Playing + Admin render in ${theme} with no console errors`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await context.addCookies([{ name: 'mp_theme', value: theme, url: 'http://localhost:3000' }]);
    await page.goto('/admin');
    await expect(page.getByText('Add links', { exact: false })).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
}

test('toggling Design flips data-theme and persists across reload', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitemradio', { name: 'Current' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'current');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'current');
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/glass.spec.ts`
Expected: PASS (may require the dev server / webServer config already in `playwright.config`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/glass.spec.ts
git commit -m "test(glass): dual-theme render + toggle persistence E2E"
```

---

## Task 8: Verification sweep

- [ ] **Step 1:** `npx tsc --noEmit` → PASS.
- [ ] **Step 2:** `npm run lint` (or the repo's lint script) on changed files → clean.
- [ ] **Step 3:** `npm test` → all unit tests pass.
- [ ] **Step 4:** Manual browser gate (both themes): Now Playing bloom re-tints on track change; Admin matches Image #6 and a real add produces a real results row; toggle flips layout with the player still alive; Current theme unchanged on Library/Browse/Search/Playlists/Queue (spot-check the shared screens for regressions from the `:root` additions).
- [ ] **Step 5:** Final commit if any fixes: `git commit -m "fix(glass): verification-sweep fixes"`.

---

## Self-review notes

- **Spec coverage:** fonts (T1), theme architecture (T2–T3), token sheet + radius scale (T4), Now Playing bloom half (T5), Admin flat half incl. results table + quota shell (T6), tests (T7), a11y/regression/verify (T8). SP1/SP2 boundary honored: quota + other sub-nav pages are stubbed in T6.
- **Placeholders:** none — the only intentional stub (static quota) is called out in both spec and T6 with an `SP2` marker.
- **Type consistency:** `useTheme()`/`ThemeProvider`/`getServerTheme()` return `ThemeName` from `lib/theme/theme.ts`; the results table reuses `AddTracksPanel`'s existing result type rather than a new shape.
