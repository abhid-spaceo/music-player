# Track Enrichment (Album Art · Lyrics · Genre Suggestions) — Design

**Date:** 2026-09-05
**Status:** Approved (design); pending spec review → implementation plan
**Audience of the product:** a family/household player (mixed ages, incl. kids) with a
Hindi/Bollywood/Ghazal/Qawwali/Devotional catalog, backed by YouTube.

---

## 1. Goal

Enrich each track with three externally-sourced extras, all driven by one shared
"clean up the title into `(artist, song)`" layer:

1. **Album/artist art** on the Now Playing screen (square cover art instead of a
   letterboxed YouTube thumbnail; real singer name instead of the uploading channel).
2. **Lyrics / sing-along** panel on Now Playing (the emotional payoff for a family:
   bhajans, ghazals, Bollywood).
3. **Genre/mood suggestions** for the curator inside the admin tag picker (turns
   hand-tagging ~300 songs into confirming a handful of guesses).

## 2. Why one feature, not three

All three depend on the same hard problem: turning a messy YouTube `title`
(`"Lata Mangeshkar - Lag Jaa Gale | Old Hindi Song"`) plus a `channelTitle` that is
often a label (`T-Series`) into a clean `(artist, title)` lookup key. We pay for that
matching once and fan it out to three thin consumers. Fixing one wrong key repairs the
art, the lyrics, and the genre suggestion together.

## 3. Data sources (free, from the public-apis "Music" list)

| Need | Source | Key? | Notes |
|---|---|---|---|
| Album/artist art | **iTunes Search API** (primary), MusicBrainz Cover Art Archive (fallback) | No | iTunes art coverage for Bollywood film soundtracks is good. |
| Lyrics (plain text) | **lyrics.ovh** | No | Thin Hindi coverage — expect partial hit rate. Plain text, not timed. |
| Genre/mood tags | **MusicBrainz** (and/or Last.fm) tags | MB no / Last.fm yes | Mapped to our fixed taxonomy; unmapped tags dropped. |

**Coverage reality:** these APIs are English/Western-centric. Famous playback singers
(Lata, Kishore, Rafi) resolve well; newer/regional tracks often miss. Partial coverage
is expected and is a first-class design constraint (see §7).

## 4. Match source — Hybrid (auto-parse + admin can correct)

The system makes a best guess automatically; the guess and what each service matched are
shown in the existing track editor; the admin only touches the ones that look wrong.
Same "machine proposes, human confirms" pattern as the moods/genres plan.

- **Auto-parse only** was rejected: wrong guesses would be invisible and unfixable —
  the worst outcome for a kid audience.
- **Manual-only** was rejected: hand-typing artist/title for every track is the exact
  drudgery this feature exists to remove.

Effort stays proportional to risk via a **confidence score** (§6): confident parses are
used silently; only low-confidence tracks are flagged for a human glance.

## 5. Architecture & data

One server-side enrichment layer, three consumers. Runs at **add-track time** and on an
explicit admin **"Enrich / re-fetch"** action — never on every Now Playing open. Results
are cached in Postgres so playback is instant, consistent for every household member, and
gentle on rate-limited free APIs.

```
YouTube title  ──▶  [ parse ] ──▶ (artist, title, confidence)
                                        │
                                        ▼
                          [ enrichment resolver ]  ── calls once, caches:
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                          ▼
        iTunes art URL          lyrics availability        genre suggestions
        (+ MusicBrainz          (lyrics.ovh, fetched       (MB/Last.fm tags →
         fallback)               lazily on first view)      mapped to OUR taxonomy)
```

**Stored (additive; mirror `db/migrations/001_init.sql` — existence-checked, idempotent).**
On the track or a sibling `track_enrichment` row:

- `parsed_artist`, `parsed_title`, `match_confidence` (`high` | `low`)
- `art_url` — hotlinked from iTunes/MB (store the **URL**, not the image)
- `lyrics_status` — `unknown` | `found` | `none`
- `lyrics_text` — cached lazily on first view
- `suggested_tag_ids` — genre/mood suggestions **pending confirm**, kept separate from
  the real `track_tags` so a suggestion never auto-applies

**Two safety choices:**
- Album art is **hotlinked**; on a miss we fall back to today's YouTube thumbnail — the
  art slot is never empty.
- Genre suggestions **never auto-tag**; they sit in a "suggested" bucket the curator
  accepts one chip at a time. The custom taxonomy stays under human control.

## 6. The title parser (reliability core)

A small **pure, unit-testable** function (same style as `lib/player/seek.ts`,
`lib/player/queue.ts`), applied in order:

1. **Strip noise** — bracketed junk via a fixed list: `(Official Video)`, `[HD]`,
   `| Full Song`, `4K`, `Lyrical`, `Audio`, etc.
2. **Split on separator** — `-`, `–`, or `|`: left = artist, right = song.
3. **No separator** — whole cleaned string is the title; artist empty.
4. **Confidence:**
   - `high` — clean split and artist is not a known-label word
     (`T-Series`, `Saregama`, `Shemaroo`, `Records`, `VEVO`, …).
   - `low` — no separator, or artist is a label, or title is mostly emoji/numbers.
5. `high` → used silently. `low` → flagged in admin for a quick human glance.

## 7. On-screen surfaces

### A. Album/artist art (Now Playing)
Swap the square album art into the existing art block in `components/player/NowPlaying.tsx`
(today it renders `current.thumbnailUrl`). Artist line shows the resolved singer instead of
`sortArtist ?? channelTitle`. **Miss:** fall back to `thumbnailUrl` — zero regression.

### B. Lyrics / sing-along (Now Playing)
New collapsible panel **below** the transport controls (scroll down to reveal) so it never
pushes the play button off a phone screen. Large, high-contrast, roomy lines; **no** faux
timed-karaoke (lyrics.ovh is plain text). Fetched lazily on first open of a song's lyrics,
then cached. **Miss (`lyrics_status = none`):** the panel/affordance is **not shown at
all** — no dead "Lyrics" button that opens nothing.

### C. Genre/mood suggestions (Admin)
Inside the mood/genre picker the moods/genres plan adds to
`components/admin/TrackAdminPanel.tsx`: a **"Suggested"** chip row above the manual chips —
tap to accept (moves into real `track_tags`), ignore to leave as a suggestion. Suggestions
are pre-mapped to our fixed taxonomy; unmapped tags are dropped, never invented.
**Miss:** no "Suggested" row; the planned manual picker is untouched.

## 8. Cross-cutting miss/empty rule

**A missing piece never produces a broken control — it removes the control or falls back.**

| Situation | Listener sees | Curator sees |
|---|---|---|
| No album art | Today's YouTube thumbnail | "no art — using thumbnail" |
| Lyrics = none | No lyrics affordance | "No lyrics found" |
| Lyrics = unknown | Panel offered; fetch on first open | — |
| No genre suggestions | No "Suggested" row | Manual picker only |
| Low match confidence | Nothing different (safe fallbacks) | Row flagged "check match", parsed guess editable |

## 9. Legal / privacy

Album art is hotlinked (standard). Lyrics text is copyrighted; caching it is acceptable for
this **private, authenticated** family player (everything is behind `requireUser`). Lyrics
must not be exposed publicly or unauthenticated.

## 10. Test plan

- **Unit (`node:test`):** the title parser (clean split, label detection, noise stripping,
  no-separator, confidence scoring); the MB-tag → taxonomy mapper (known map, unknown dropped).
- **Integration:** the enrichment resolver with **stubbed** API responses (inject a
  `fetchImpl`, as `lib/youtube/api.ts` already does) — hit / miss / timeout for art, lyrics,
  genres. No live third-party calls → deterministic.
- **E2E (Playwright):** admin enriches a track → art + suggested chips appear; accept a chip
  → becomes a real tag; open Now Playing → square art shows; a known-no-lyrics song → **no**
  lyrics affordance appears (proves the graceful miss).

**Deliberately NOT covered:**
- Real third-party API accuracy/coverage (we stub them; we test our handling, not iTunes's
  catalog).
- Actual Hindi-lyrics hit rate in production (only real usage reveals it; expect partial).
- Non-Latin (Devanagari) parser edge cases beyond a couple of representative examples.
- Rate-limit behaviour under heavy concurrent enrichment (single-admin scale assumed).

## 11. Repo notes for implementation

- Customized Next.js — read `node_modules/next/dist/docs/` before app code (repo `AGENTS.md`).
- Migrations: existence-checked and idempotent, matching `db/migrations/001_init.sql`.
- Response/auth: `lib/api/respond.ts` (`ok`/`fail`/`handleError`), `requireUser`/`requireAdmin`,
  `assertCsrf`. Injectable `fetchImpl` for testability, as in `lib/youtube/api.ts`.
- Depends on the moods/genres taxonomy (`tags` / `track_tags`) from
  `docs/superpowers/plans/2026-09-04-moods-and-genres.md` for surface C.
