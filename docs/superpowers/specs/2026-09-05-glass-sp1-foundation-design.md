# Design spec — Glass SP1: foundation + theme architecture

**Date:** 2026-09-05
**Status:** Approved design, ready for implementation plan
**Author:** brainstormed with the developer
**Supersedes the approach in:** `2026-09-05-design-theme-toggle-design.md` (that spec's
"token swap + thin CSS layer, whole app at once" approach produced a recolor, not the
design — see *Why the first attempt missed* below).

## Context — why this is SP1, not the whole thing

The finalized Glass design (`Personal FM Directions.dc.html`) is **not a recolor of the
current app**. It changes three things a token swap cannot touch:

1. **Type system** — Manrope for UI, Instrument Serif for marketing/display, JetBrains
   Mono for numerals + 10px labels only. The current app uses IBM Plex Mono for
   *everything*, which is a large part of why it reads as a tool, not the design.
2. **Structure** — floating frosted panels over an art-sampled *bloom*, with a real
   radius scale (9·14·20·26·99). The current app is flat, full-bleed rows at 2px.
   Panels need container markup; they cannot come from a token value.
3. **Information architecture** — some screens (Admin especially) are a different page
   entirely (sidebar branding + ADMIN sub-nav + quota meter + results table).

Because "keep the toggle" + "full mockup, features included" is far too large for one
spec, the work is decomposed into sub-projects (SP1–SP6). **This spec is SP1 only:** the
shared foundation and the theme architecture, proven on two reference screens. The other
screens and the *real* admin features are SP2–SP6.

### Why the first attempt missed (root cause, for the record)

The previous change overrode token *values* in `[data-theme="glass"]` (deep-purple
surfaces, pink accent, a single `--radius: 10px`, blur tokens). A value override keeps
the existing DOM and the mono-caps type, so the result was "the same app, but purple with
rounder corners." No floating panels, no Manrope, no new Admin layout could result from
it. SP1 fixes this by building **glass component variants**, not just tokens.

## Decisions (locked in brainstorming)

| Question | Decision |
|---|---|
| Toggle vs replace | **Keep the toggle.** Current and Glass both ship; each screen gets a Glass layout that coexists with the Current one. |
| Feature scope (overall) | **Full mockup, features included** — but delivered across SP1–SP6. SP1 is foundation + 2 reference screens only. |
| SP1 reference screens | **Both** Now Playing (proves the bloom/art half) **and** Admin add-links (proves the flat, no-bloom data-surface half). |
| Toggle behavior | **Quick reload on switch** — the toggle writes the cookie and calls `router.refresh()`; the server re-renders the other layout. No dual-DOM, no duplicate players. |
| Default (new user) | **Glass** — unchanged from the existing `DEFAULT_THEME`. |

## Architecture

### How a screen chooses its look

The mechanism already half-exists and is *simpler* than the old plan because we accept a
soft refresh on switch:

- `app/layout.tsx` (server component) already reads the `mp_theme` cookie via
  `next/headers` and sets `<html data-theme="current|glass">`. Missing cookie → `glass`.
  This stays.
- **New:** `layout.tsx` wraps the tree in a small **client `ThemeProvider`** seeded with
  the server-resolved `theme`, exposing `useTheme(): ThemeName`. Client components
  (Now Playing, the player) read the theme without prop-drilling.
- Each SP1 screen **branches once** on the theme to render the correct variant:
  `theme === 'glass' ? <GlassNowPlaying/> : <NowPlaying/>`. One layout is in the DOM at a
  time — no hidden twin, no duplicate `<audio>`/YouTube iframe.
- The **toggle** (`AccountMenu`) writes the cookie via `serializeThemeCookie` (already
  exists) and calls `router.refresh()`. The server re-renders with the other structure.
  It also sets `document.documentElement.dataset.theme` immediately so the token-level
  colours flip before the refresh round-trip completes (avoids a visible mismatch frame).

Because the structure is decided from the cookie on the server, the correct layout paints
on first load with no flash and no hydration mismatch.

### Foundation — fonts

Self-hosted via `@fontsource`, matching the existing pattern in `layout.tsx`:

- **Manrope** (variable, weights 400–700) — UI.
- **Instrument Serif** (400) — display/marketing voice (used on Now Playing's "PLAYING
  FROM" flourish in SP1; broader marketing use lands in SP5).
- **JetBrains Mono** (400/500/600) — numerals + 10px labels only.

The Current theme keeps Instrument Sans + IBM Plex Mono untouched. New font faces are only
*referenced* by `[data-theme="glass"]` type tokens, so loading them cannot affect Current.

### Foundation — tokens (`styles/tokens.css`)

`:root` (Current) stays exactly as is. The `[data-theme="glass"]` block is rewritten to
the design's token sheet (values transcribed from the A4 token sheet):

- **Substrate:** `--bg-void #08070C`, `--bg-deep #0D0B14` (map onto `--base` and a new
  `--bg-deep` used by flat surfaces like Admin).
- **Glass surfaces:** `--glass-1` rgba(255,255,255,.07) blur 24, `--glass-2` .10 blur 28,
  `--glass-3` .16 blur 26. **Never nest one glass level directly inside another** (alphas
  compound — design rule).
- **Borders (1px, inset-lit):** `--edge-1` .12, `--edge-2` .16, `--edge-hi` .22.
- **Text:** `--ink #F6F4FF`, `--ink-2` 72%, `--ink-3` 62%. Rule: `--ink-3` is allowed on
  glass, never directly on the bloom.
- **Accents (art-derived, with fallback):** `--accent #C4B5FD`, `--accent-2 #FF8FC3`.
- **Shadows/blur:** `--lift-1 0 14px 34px/40%`, `--lift-2 0 24px 60px/50%`,
  `--lift-3 0 34px 80px/55%`, `--bloom blur(52–70px)@50–62%`, panel blur 18/24/28.
- **Radius scale (replaces the wrong single 10px):** `--r-9 9`, `--r-14 14`, `--r-20 20`,
  `--r-26 26`, `--r-pill 999`. Current maps the ones it uses to its existing 2px so Current
  is unchanged.
- **Spacing:** 4pt base (4·8·12·16·24·34·52); gutter 24 mobile / 52 desktop; tap 44 min.
- **Type tokens:** glass overrides `--t-*` to Manrope for titles/body and JetBrains Mono
  for `--t-meta/-column-label/-duration/-status/-tab`; `--sans`/`--mono` gain glass values.

### Foundation — the bloom + art colour

Reuse the existing `lib/theme/extractColor.ts` + `useArtGlow.ts` (already built and unit
-tested for the fallback path). SP1 wires the extracted `--art-glow` / accents into the
Glass Now Playing bloom layer and the glass accents. Fallback chain is unchanged:
no thumbnail / CORS taint / any error → `#C4B5FD / #FF8FC3` preset. Bloom colour crossfades
420ms on track change; everything respects `prefers-reduced-motion` (drops to opacity).

## Reference screen 1 — Now Playing (glass), the bloom half

New `GlassNowPlaying` component (Current `NowPlaying` untouched). Desktop-first (the
viewport the app is tested on), with the mobile stack following the design's A1.

- A fixed **bloom layer** behind the content, tinted from `--art-glow`.
- Artwork and transport in **floating frosted panels** (`--glass-2`, `--edge-2`, `--lift-2`,
  `--r-26` on artwork, `--r-14` on controls).
- Title in Manrope 700 (-.02em), a small "PLAYING FROM" label in JetBrains Mono 10/700,
  times always mono. Up-next list uses plain-alpha rows (no per-row blur — Android rule).
- Reuses the existing `PlayerProvider` state; no player logic changes.

## Reference screen 2 — Admin add-links (glass), the flat half

New `GlassAdminScreen` (or a glass branch inside `AdminScreen`) rendering the design's 3e
add-links layout. Current `AdminScreen` untouched.

- **Flat `--bg-deep`, no bloom** (design rule: a data surface, not a listening one).
- Left rail: "Personal FM" branding + Browse/Library/Admin, then an **ADMIN sub-nav**
  (Add links / Tracks / Playlist import / Users / Link health) and a **YouTube quota**
  widget at the bottom. Glass appears only on the paste field and the result pills.
- Main: "Add links" title + description, `ADMIN · <email>` pill, the paste field
  (glass), a **detected-links counter** ("N LINKS DETECTED · EST. M QUOTA UNITS"),
  Clear + "Add to library" (gradient) buttons, then the **last-batch results table**
  (STATUS / TITLE / CHANNEL / LENGTH) with ADDED / DUPLICATE / INVALID pills.
- **SP1 boundary — what is real vs stubbed here:**
  - *Real:* the paste field, detected-links counter, add flow, and the results table are
    wired to the **existing** add-tracks endpoint, which already returns added / duplicate
    / invalid outcomes.
  - *Stubbed (made real in SP2):* the quota meter shows a static value with a clear
    "SP2" note in code; the sub-nav items other than Add links render but are inert
    (no navigation / pages yet). Tracks / Users / Link health / Playlist import as full
    glass pages, and true quota accounting, are **SP2**.

## Components & files (isolation-first)

New (Glass-only; Current code untouched, so other screens cannot regress):

- `lib/theme/ThemeProvider.tsx` — client context + `useTheme()`.
- `components/player/GlassNowPlaying.tsx` (+ `.module.css`).
- `components/admin/GlassAdminScreen.tsx` (+ `.module.css`) and any small glass subparts
  (sidebar rail, quota widget, results table) kept as their own <150-line files.

Modified:

- `styles/tokens.css` — rewrite the `[data-theme="glass"]` block to the full token sheet
  + radius scale (revert the wrong single `--radius: 10px`).
- `app/layout.tsx` — add the 3 font imports; wrap children in `ThemeProvider`.
- `components/chrome/AccountMenu.tsx` — toggle calls `router.refresh()` (+ immediate
  `dataset.theme`).
- The Now Playing and Admin route/screen entry points — add the one-line theme branch.

## Testing

- **Unit:** `normalizeTheme` / `serializeThemeCookie` (extend existing `tests/theme.test.ts`);
  `extractColor` fallback (already covered). Deterministic, no network.
- **E2E (Playwright):** with `mp_theme=glass` and `=current`, both Now Playing and Admin
  render without console errors; toggling in the account menu flips `data-theme`, sets the
  cookie, survives a reload, and re-renders the other layout.
- **Browser verify (manual gate — this repo has no CI):** load Now Playing and Admin in
  both themes; play a track and confirm the bloom re-tints; add a real link and confirm the
  results table; flip the toggle and confirm the layout changes with no stuck player.

**Not covered by SP1:** pixel-perfect visual regression against the mockups; real-device
Android frame-budget profiling; the other 8 screens (SP3–SP6); making the quota meter,
Users, Link health, Playlist import, and Tracks pages real (SP2).

## Risks & mitigations

1. **Tainted-canvas / CORS** on `i.ytimg.com` → preset-gradient fallback (already built).
2. **SSR/client theme agreement** — server sets from cookie; toggle keeps cookie + dataset
   in sync + `router.refresh()`; avoids hydration mismatch.
3. **Glass nesting** — blur only on fixed panels; never stack two blurred layers.
4. **Contrast** — verify the glass text tokens on glass surfaces meet WCAG AA for the
   pairings SP1 actually uses (`--ink-3` on glass only, never on bloom).
5. **Font weight/flash** — self-hosted `@fontsource`, so no runtime fetch; Current fonts
   unaffected because only glass type tokens reference the new faces.
6. **Scope creep into SP2** — the SP1 boundary above is explicit; stubbed items stay stubbed.

## Out of scope (YAGNI for SP1)

- SP3–SP6 screens; SP2 admin features made real; DB persistence of the theme choice
  (cookie-per-browser stands); a third theme or OS light/dark following.
