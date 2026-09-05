# Design spec — Theme toggle (Current ⇄ Glass)

**Date:** 2026-09-05
**Status:** Approved design, ready for implementation plan
**Author:** brainstormed with the developer

## Summary

Add a per-user design toggle that lets each user switch the whole app between the
existing **Current** look (flat, true-black, single amber accent) and a new
**Glass** look (frosted panels, deep purple substrate, gradient accents, and an
ambient glow derived from the current track's album art). Both designs ship
permanently. Glass is the default for new users.

The app is already fully token-driven — every screen reads its colors, radius,
spacing, and fonts from named CSS custom properties in `styles/tokens.css`. That
makes a theme swap mostly a matter of overriding those tokens, plus a thin,
hand-written "glass-only" CSS layer for the effects that are not expressible as a
token swap (backdrop blur, gradient fills, the ambient glow, the radius scale).

## Decisions (locked)

| Question | Decision |
|---|---|
| Purpose | **Permanent user setting** — both designs ship; each user picks and it's remembered. |
| Glass fidelity | **Full glass + art-derived glow** — frosted blur, gradients, and a background glow whose color is extracted from the current track's artwork. |
| Coverage | **Whole app at once** — every screen supports both themes from day one. |
| Persistence | **Cookie, per browser** — no DB change, no new endpoint. Choice does not follow to other devices. |
| Default (new user) | **Glass** — Current becomes the opt-out. |
| Toggle location | **Account menu** — a "Design: Glass / Current" control above Sign out. |

## Source material

- Finalized values: `Personal FM Glass Spec.dc.html` (from the design zip).
- Screens: playlist detail, search (empty + results), Now Playing (desktop),
  mini-player, Admin add-links.
- Glass token values pulled from the spec:
  - **Substrate:** `#08070C`, `#0D0B14`, `#14121C`, `#1A0B2E` (deep purple-black).
  - **Glass surface alphas:** `rgba(255,255,255, .07 / .10 / .12 / .16 / .22)`
    and lavender-tinted `rgba(246,244,255, …)`.
  - **Accents (gradient):** `linear-gradient(120deg,#6D3BFF,#FF3D8B)` and a
    3-stop `linear-gradient(148deg,#8A5CFF 0%,#FF4FA3 54%,#FFB86B 100%)`.
  - **Text:** `#F6F4FF` / `#E8E6EE` / `#C9C6D4`; dim = `rgba(246,244,255,.72/.62)`.
  - **Radius scale:** 2 / 6 / 22px (vs Current's single `--radius: 2px`).
  - **Blur:** 52–70px ambient; 18px chrome.
- Two hard rules from the spec, carried into the design:
  1. *"backdrop-filter on a scrolling list loses a frame budget on mid-range
     Android. Keep blur to fixed chrome — bar, sidebar, sheet — give scrolling
     rows plain alpha fills."*
  2. *"Never nest one glass level directly inside another — the alphas compound."*

## Architecture

### 1. How the theme is applied (no-flash mechanism)

- `app/layout.tsx` is a **server component** rendering `<html>`. It reads a
  `theme` cookie via `next/headers`. Missing cookie → `glass` (default).
- It sets `<html data-theme="glass|current">` (and keeps `color-scheme: dark`).
- Because the attribute is decided on the server, the correct theme paints on the
  first frame — **no flash, no blocking inline script.**

### 2. Token structure (`styles/tokens.css`)

- `:root` (today's values) stays **exactly as is** = the "current" theme.
- Add a `[data-theme="glass"] { … }` block overriding the *same* token names
  (`--base`, `--raised`, `--bone`, `--dim`, `--signal`, `--divider`, `--hairline`,
  `--outline`, `--track`, `--scrim`, `--playing-wash`, …) with glass spec values.
- Add **new** tokens used only by glass, defaulting to inert values in `:root`
  so the current theme is unaffected:
  - `--glass-blur: 0px` → glass: `18px` (chrome), plus a separate `--ambient-blur: 60px`.
  - `--ambient-glow: transparent` → glass: preset gradient / art-derived color.
  - `--r-2 / --r-6 / --r-22` radius scale → current maps all to `2px`;
    glass uses the real scale.

> **Caveat (honest):** the single-`--radius`→scale change and gradient *fills*
> (artwork placeholders, the play button) cannot come purely from token
> overrides. A handful of components need small guarded CSS additions — the
> "thin glass-only layer" enumerated below.

### 3. The toggle (in `AccountMenu`)

- Add a "Design" control above Sign out: two options **Glass / Current**,
  `role="menuitemradio"` + `aria-checked`, the active one marked.
- On select:
  1. Write the `theme` cookie (1-year, `SameSite=Lax`, path `/`) via
     `document.cookie` — no new API endpoint.
  2. Set `document.documentElement.dataset.theme` immediately → the whole app
     re-skins **instantly, no reload**.
  3. Call `router.refresh()` so any server-rendered output agrees with the cookie
     (avoids hydration mismatch on the next navigation).
- Existing outside-tap / Escape close behavior already covers the menu.

### 4. Art-derived color glow (glass only)

- New hook `lib/theme/useArtGlow.ts` watches the current track (from
  `PlayerProvider`). On change, it loads `thumbnailUrl` into an offscreen
  `<img crossorigin="anonymous">` → small canvas → samples a dominant/average
  color → sets CSS var `--art-glow` on the shell container.
- The ambient glow layer (a blurred gradient behind Now Playing, the player
  panel, and the playlist header) reads `--art-glow`.
- **In the current theme `--art-glow` is unused**, so the hook is effectively a
  no-op there (it only sets a variable nothing consumes).
- **Fallbacks (the point of this piece):**
  - No `thumbnailUrl` → preset gradient.
  - CORS / "tainted canvas" read failure on `i.ytimg.com` → preset gradient.
  - Any extraction error → preset gradient.
  - So a missing/blocked image degrades to a nice static glow, never a broken screen.
- **Perf & motion:** extraction runs once per track change (not per frame); glow
  color transitions inherit the global `prefers-reduced-motion` handling in
  `base.css`.

## The glass-only CSS layer (attribute-guarded)

Everything not listed here re-skins automatically from the token override. These
surfaces need hand-written `[data-theme="glass"] …` additions (grounded in a grep
of the current CSS; exact lines pinned during implementation):

**Fixed chrome → backdrop-blur (safe per the Android rule):**
- `components/chrome/AppShell.module.css` — hosts the ambient glow layer
- `components/chrome/Sidebar.module.css`, `TabBar.module.css`, `ScreenHeader.module.css`
- `components/player/PlayerPanel.module.css`, `NowPlaying.module.css`,
  `AddToPlaylistMenu.module.css`, `components/chrome/AccountMenu.module.css`

**Radius scale (all currently use `var(--radius)`):**
- `PlaylistsScreen`, `FilterChips`, `SearchScreen`, `Buttons`, `Sidebar`,
  `PlayerPanel` module CSS; `app/sign-in/page.module.css`; the two `error.tsx`.

**Gradient fills (cannot be a token swap):**
- Artwork placeholders (colorful tiles) and the primary Play / play-pause button
  gradient — in `TrackRow`, `PlayerPanel.tsx`, `NowPlaying.tsx`.

**Scrolling rows stay plain alpha (no blur)** — per the spec, to keep lists
smooth on Android.

## Risks & mitigations

1. **Tainted-canvas / CORS** on `i.ytimg.com` → preset-gradient fallback.
2. **SSR/client attribute agreement** — server sets from cookie; client toggle
   keeps it in sync + `router.refresh()`; avoids hydration mismatch.
3. **Glass nesting** — blur only on the listed fixed chrome; never stack two
   blurred layers (spec rule).
4. **Contrast** — verify glass text tokens on glass surfaces meet WCAG AA; the
   spec flags a few borderline pairs. Check the pairings actually used.
5. **Radius over-reach** — overriding a single `--radius` to 22px would round
   controls that should stay tight; hence the explicit 2/6/22 scale reviewed
   per component.

## Testing

- **Unit:** color-extraction fallback logic (deterministic, no network) — asserts
  preset gradient on null/oversized/failed inputs.
- **E2E (Playwright):** toggle in account menu → `data-theme` flips → cookie set
  → survives reload → both themes render Browse, Search, Playlist detail, Now
  Playing, and Admin without console errors.
- **Not covered:** pixel-perfect visual regression against the mockups, and
  real-device Android frame-budget profiling (spec-guided, but not automated
  here).

## Out of scope (YAGNI)

- Storing the choice in the database / cross-device sync (explicitly deferred:
  cookie-per-browser was chosen).
- A dedicated Settings page (toggle lives in the account menu only).
- A third theme, or auto-following OS light/dark.
- Marketing-website redesign (this spec is the web app only).
