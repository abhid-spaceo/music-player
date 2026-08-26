# Build log

Append-only. Newest entry at the bottom.

---

## Phase 0 — Grounding · 2026-08-26

Full deliverable: [`docs/phase-0-grounding.md`](./phase-0-grounding.md) (§1–§11).
This entry is the per-phase output summary the brief requires.

### 1. File-by-file summary

No application code was written. Phase 0 is a written deliverable.

| File | Change | Why |
|---|---|---|
| `docs/phase-0-grounding.md` | new | The Phase 0 deliverable: cost ledger, Blob access model, schema + sizing, Neon compute budget, bitrate, assumptions, unverified items. |
| `docs/build-log.md` | new | This log. Required by the brief's per-phase output item 7. |
| `design/Music_Player_dc.html` | new (copy) | The Claude Design canvas. Copied from `~/Downloads/Music library interface design/Music Player.dc.html`; original left in place. SHA-256 verified identical. Renamed to the filename the brief refers to. |
| `design/support.js` | new (copy) | Canvas runtime, same source. |

No `git init` yet — that belongs to Phase 1 with the Next.js scaffold.

### 2. Decisions made that were not specified

Full table with rejected alternatives in §8; the addendum in §11 records what the
three answers settled. Summary:

| Decision | Alternative rejected |
|---|---|
| Private Blob store + presigned GET (**confirmed by owner**) | Public unguessable URLs (unrevocable, indexable); proxy through a Function (doubles transfer cost, burns the 4 CPU-hr Active CPU meter, makes `206` our bug to write). |
| 192 kbps AAC-LC, `ffmpeg -movflags +faststart` | 128k (208 tracks, audibly worse); 320k (83 tracks, inaudibly better); MP3 (no faststart concern, worse per bit); Opus (best per bit, iOS Safari risk not worth taking). |
| Stateless signed session cookie | DB-backed sessions — instant revocation, but the largest single driver of Neon compute. **Still open for the Phase 1 plan.** |
| UUIDv7 primary keys, exposed in URLs | bigint serial (enumerable); UUIDv4 (no creation ordering, worse index locality). |
| Client-side artwork resize before upload | `sharp` in a route handler — simpler, but pushes bytes and CPU through the thing we are keeping audio out of. |
| Batched `play_history` writes | Write-per-play — exact, but converts listening time directly into Neon compute time. |
| Blobs never overwritten (`addRandomSuffix: true`) | Overwrite in place — fewer orphans, but hits the documented 60s cache-propagation window. |
| Seed one admin **and one listener** in Phase 1 | Admin only — but the brief's own Phase 1 check (listener on an admin route → 403) needs a second account. |

### 3. Cost line

Phase 0 provisioned nothing, deployed nothing, and touched no account.
**Added to every metered resource: zero. Headroom on every meter: 100%.**

Projected figures at the confirmed scale of **1 user** (§11):

| Meter | Projected | Over 50%? |
|---|---|---|
| Blob storage | 78% of 1 GB — the intended 800 MB code ceiling, not an overrun | by design |
| Blob transfer | 35% at 20 plays/day; 69% at 40 plays/day | no under normal use |
| Neon compute | 12.5% moderate; 31% heavy; **61% at 8 h/day listening** | only in the heaviest pattern |
| Neon storage | ~0.4% at year one | no |
| Vercel Active CPU / invocations / Edge Requests | <10% | no |

No meter is over 50% today. The one that can cross it is **Neon compute under heavy daily
listening**, and the four mitigations in §4 keep it near 25%. Flagged, not deferred.

### 4. What could not be verified

Full table in §7. The three that matter:

1. **Hobby Blob included storage/transfer (1 GB / 10 GB) is not stated on Vercel's own
   Hobby page or Blob pricing page.** Third-party 2026 sources corroborate it. This is the
   project's binding constraint and it is unconfirmed — settle it from the dashboard.
2. **Whether Blob honours `Range` and returns `206` + `Content-Range` is undocumented** on
   all four Blob pages read. Near-certain, but it is the brief's risk #1, so it must be the
   first thing tested after the first upload in Phase 2 — before any player code exists.
3. **CORS headers on the Blob origin are undocumented.** Not needed for playback (the
   design's EQ bars are CSS keyframes, so no Web Audio, so no `crossorigin`), but required
   for the Phase 5 download queue's `fetch()`. Needs both a `curl -I` and a real
   cross-origin browser `fetch()` — headers alone do not prove the browser path.

Process items: `onUploadCompleted` does not fire on `localhost` (needs ngrok +
`VERCEL_BLOB_CALLBACK_URL`, or a preview deployment); Vercel retains runtime logs for
**1 hour** on Hobby, so Phase 2's "audio never passed through a route handler" evidence
must be captured inside that window; and the `loop-engineering` skill the brief asks for
**is not installed** on this machine (`coverage-analysis` is).

### 5. Commands to see it working

```bash
# The deliverable
open /Users/sotsys165/Projects/music-player/docs/phase-0-grounding.md

# The design canvas, rendered
open /Users/sotsys165/Projects/music-player/design/Music_Player_dc.html

# Confirm 1a = 56px rows / 40px artwork, 2a = 60px / 42px
F=/Users/sotsys165/Projects/music-player/design/Music_Player_dc.html
awk '/id="1a"/,/id="1b"/' "$F" | grep -oE 'height:5[0-9]px|width:40px;height:40px' | sort -u
awk '/id="2a"/,/id="2b"/' "$F" | grep -oE 'height:6[0-9]px|width:42px;height:42px' | sort -u

# Confirm the amber EQ bars are CSS-only (hence no Web Audio, hence no crossorigin)
grep -o 'animation:eq[0-9][^;"]*' "$F" | sort -u

# Confirm the design copy is byte-identical to the Downloads original
shasum -a 256 "/Users/sotsys165/Downloads/Music library interface design/Music Player.dc.html" \
              /Users/sotsys165/Projects/music-player/design/Music_Player_dc.html

# The one figure to confirm in your own dashboard
open https://vercel.com/account/usage
```

Nothing to typecheck or lint — no code exists yet.

### 6. Review agent findings

_Pending — a fresh reviewer with no sight of the drafting conversation was dispatched to
verify the document's quoted facts against the source pages, recheck the arithmetic in
§3–§5, confirm the claims made about the design file, and challenge the recommendations.
Findings will be appended here verbatim, including anything disagreed with._

---

## Phase 0 — Review addendum · 2026-08-26

Appended rather than editing §6 above, per append-never-overwrite.

- **Reviewer findings, verbatim:** [`phase-0-review-findings.md`](./phase-0-review-findings.md)
  — 5 CRITICAL, 9 HIGH, 13 MEDIUM, 9 LOW, plus its clean spot-checks. Reproduced in full,
  including the finding I dispute.
- **My adjudication, with verification evidence:** [`phase-0-review-adjudication.md`](./phase-0-review-adjudication.md)

### Outcome

**C1 upheld — I was wrong.** The Hobby Blob allowances (1 GB storage, First 10 GB
transfer, First 10,000 simple ops, First 2,000 advanced ops) *are* published in a
"Managed Infrastructure pricing" table with a "Hobby Included" column on the page I
cited. I read that page through a markdown conversion in which the entire table collapses
to a single cell reading `Regional`. Verified against the rendered HTML. §7 item 1 is
closed; no dashboard check needed.

**C2 rejected — the reviewer's evidence does not exist.** It claimed the worked example
contains no "5 GB"/"100 GB" and that I "invented the evidence". Lines 125 and 128 of the
page's own markdown read `50 GB total - 5 GB included` and `350 GB - 100 GB included`.
My statement was accurate.

**C3 accepted, and it is the review's most valuable finding.** Two hard free allowances
were missing from the ledger. Also: my own §2.2 claim that an uncached delegation token
costs "an Advanced Operation" per track start was an unverified inference and is wrong —
`issueSignedToken` is not in the documented put/copy/list set. The reviewer's 180% figure
inherits my error. Both struck.

**Everything else accepted**, notably: H8 (the brief's headline storage-ceiling guard is
never located, and the upload API was never chosen), H2 (presigned URLs rotate, so the
browser-cache dedup I claimed as a "free win" largely evaporates), H1 (range support *is*
documented on a fifth Blob page I never opened; the real unknown is whether a *presigned*
ranged GET works), H6 (142 tracks do not fit in 800 MB — it is 138, and I bent the number
to manufacture agreement with placeholder copy in the design), H5/H3/L3/L4 (arithmetic),
C4/C5 (iOS Safari and storage quota absent; range risk aimed at the wrong component), and
M8 (the design contains no artwork at all, so per-track cover art was my invention).

### Status

**Phase 0 is NOT approved-ready.** Corrections must be folded into
`phase-0-grounding.md` before Phase 1 planning, because three of them bear directly on
Phase 1/2 decisions: H8 (where the ceiling is enforced), H1/H2 (whether a presigned
ranged GET works at all), and C3 (operation ceilings).

No code was written. All meters remain at 0%.
---

## Phase 0 — carried defects · 2026-08-26

Owner elected to proceed to the Phase 3 plan rather than revise `phase-0-grounding.md`
first. The accepted review findings are therefore **carried as known defects** against
that document. `phase-0-grounding.md` is left as originally written — the corrections
below override it wherever they conflict. Nothing here is fixed in the source doc yet.

### Corrections that override phase-0-grounding.md

| Ref | Defect carried | Correct value / position |
|---|---|---|
| C1 | §1.2, §7.1 call the Hobby Blob allowances unverifiable | **Verified and published.** Storage 1 GB/mo · Transfer first 10 GB · Simple ops first 10,000 · Advanced ops first 2,000. §7 item 1 closed. |
| C3 | Ledger omits Blob operation allowances | Add **Simple 10,000/mo** and **Advanced 2,000/mo**, same 30-day lockout. Library upload once = 142–568 advanced ops = **7–28%**. Dashboard browsing also counts. |
| C3b | §2.2 claims an uncached delegation token costs an Advanced Operation per track start | **Struck — my error.** `issueSignedToken` is not in the documented `put`/`copy`/`list` set. Caching it remains correct on latency grounds only. |
| H9 | Ledger omits Image Optimization meters | Add **Transformations 5,000 · Cache Reads 300,000 · Cache Writes 100,000**. Consequence: artwork must use raw `<img>` or `unoptimized`, never default `next/image`. |
| H6 | §5 claims 142 tracks fit in 800 MB at 192 kbps, and uses that to justify the ceiling | **138 tracks** (136 net of artwork). 142 × 5.76 MB = 818 MB. The "design agrees with the budget" argument is **withdrawn** — 142 is placeholder copy. 1 GB row is 173, not 174. |
| H2 | §5 claims browser cache alone de-duplicates repeat plays — "free win" | **Largely false** under 8-hour presigned URLs: `vercel-blob-valid-until` is a signed query param and the HTTP cache keys on the full URL. Whether the CDN cache key includes the signature is **open**. |
| H1 | §2.3, §7.2 treat Blob range support as undocumented | **Documented** on `/docs/vercel-blob/examples` ("Vercel Blob supports range requests"). Real open question is narrower: does a **presigned private** ranged GET honour `Range`, and does the signature survive a ranged re-request? |
| H8 | The brief's headline storage-ceiling guard is never located; upload API never chosen | **Owed decision.** Must name `handleUpload`/`onBeforeGenerateToken` vs `handleUploadPresigned`/`getSignedToken`, use `maximumSizeInBytes`, and ensure one token cannot authorise N uploads that collectively breach the ceiling. Deferred to the Phase 2 plan. |
| H3 | §4 assumes the Neon compute never autoscales | Neon Free autoscales **up to 2 CU**; CU-hours = average size × hours. The 400-hour figure is a floor, so 75% / 25% are floors too. |
| H4 | §4 mitigation 2 proposes a 5-minute play-history flush | **Self-defeating** — lands at/before the 5-min scale-to-zero threshold every cycle. Flush on `visibilitychange`/`pagehide` and a much longer interval. |
| H5 | §4 mitigated budget stated as 90–110 h ≈ 25% | **96–144 h = 24–36 CU-hours.** Bottom of range was published as the answer. |
| C4 | iOS Safari degradation and storage-quota handling absent | Owed before Phase 5: `navigator.storage.persist()` + refusal, `estimate()` before download, no half-written files, and the eviction multiplier that undoes the transfer saving. |
| C5 | Risk #1 analysed for the Blob CDN and route handlers, not the Service Worker | The named hazard is an **SW fetch handler** replaying audio from Cache Storage. Resolutions to weigh in Phase 5: don't intercept audio; serve offline audio from IndexedDB via `createObjectURL`; or synthesise 206 + `Content-Range`. |
| M8 | Per-track cover art at three WebP sizes was invented | The design export has **zero `<img>` tags and zero `background-image`** — row artwork is a synthetic colour block with a coloured `<i>`. **Directly affects the Phase 3 plan.** |
| M6 | No backup assumption unlisted | *"There's no native backup system for Vercel Blob."* Local masters are assumed to exist; §6 item 6's "800 MB of re-upload" depends on it. |
| M12 | CSRF never mentioned; Argon2id never costed against Active CPU | Both fixed requirements. Note `@node-rs/argon2` for a serverless-compatible build. |
| M5 | Hobby cron is once/day ±59 min; faster expressions fail at deploy | Affects the reconciliation script and session sweeping. Each run wakes Neon. |
| M4 | Ceiling measured as `SUM(tracks.byte_size)`; Vercel meters every blob incl. orphans | The two diverge exactly when reconciliation is needed. Needs a safety margin. |
| M11 | Connection model absent from "what holds the DB awake" | Pooled vs direct, `@neondatabase/serverless` HTTP vs TCP, cold-instance connections. |
| M1 | §7.6 carried as unknown | Closed: Neon Free instant restore is *"6-hour limit, capped at 1 GB of change history."* |
| M2, M3, M7, M13, L1–L9 | Citation, quoting, derivation and unit defects | See adjudication. Notably: 1 month is the cache **default** not maximum; §1.5's "4–8 GB / 40–80%" transfer band is derived from nothing; decimal/binary mixed (1,736 plays, not 1,777); year-ten Neon storage 15.5%, not 14%. |

### Rejected

**C2** — the reviewer claimed the pricing page's worked example contains no "5 GB"/"100 GB"
and that the evidence was invented. Lines 125 and 128 of that page read
`50 GB total - 5 GB included` and `350 GB - 100 GB included`. The original statement was
accurate. No change.

### Carried into the Phase 3 plan

Only **M8** bears on Phase 3 directly: there is no real cover art in the design, so
artwork rendering in Phase 3 must reproduce the synthetic colour-field-plus-mark treatment
rather than assume image assets. H8, C4, C5, H1 and H2 are Phase 2 and Phase 5 debts and
are recorded as such.

No code written. All meters remain at 0%.
---

# ARCHITECTURE PIVOT · 2026-08-26

The brief changed product. Everything above this line grounded a **self-hosted audio player
using Vercel Blob**. The project is now a **YouTube-backed player**: the library is video IDs
plus my own metadata, playback runs through the YouTube IFrame Player API, and there is no
object storage, no downloads and no offline mode anywhere in the design.

Entries above are retained as history. They are not guidance. Where they conflict with
anything below, they are wrong.

---

## Phase 0 — Grounding (YouTube) · 2026-08-26

Full deliverable: [`docs/phase-0-youtube-grounding.md`](./phase-0-youtube-grounding.md).

### 1. File-by-file

No application code written. Phase 0 is a written deliverable.

| File | Change | Why |
|---|---|---|
| `docs/phase-0-youtube-grounding.md` | new | The Phase 0 deliverable: quota ledger, metadata fields, link-rot detection, schema + sizing, Neon compute budget, assumptions. |
| `docs/build-log.md` | appended | This entry. |
| `design/Music_Player_dc.html`, `design/support.js` | unchanged | Same canvas; the design system did not move with the pivot. |

**Carried forward from the previous build (uncommitted, `git rev-list --count HEAD` = 0):**
`styles/tokens.css`, `styles/base.css`, `app/layout.tsx` (self-hosted fonts verified),
`components/chrome/{ScreenHeader,Sidebar,TabBar,AppShell}`,
`components/library/{ColumnHeader,FilterChips,TrackRow,LibraryScreen}`,
`components/primitives/{Icons,Buttons}`, `lib/format.ts`, and the whole `tests/` harness.

**Voided by the pivot:** `components/chrome/MiniPlayer.*` (62px cannot hold a 200×200 embed),
`components/primitives/DlPill.*` (no offline), `components/primitives/Artwork.*` +
`lib/artwork.ts` (synthetic artwork replaced by real thumbnails),
`components/primitives/EqOverlay.*`, `lib/library/fixtures.ts`.

### 2. Decisions not specified

Full table with rejected alternatives in §8. Headlines: thumbnails served direct from
`i.ytimg.com` via plain `<img>` rather than `next/image`; availability swept daily with
descriptive metadata refreshed in the same call; `duration_sec int` parsed from ISO 8601 on
ingest; availability as an enum + timestamp rather than a check-log table; batched
`play_history` flushed on `visibilitychange`/`pagehide` and explicitly **not** on a 5-minute
timer; no `albums`/`artists` tables; UUIDv7 keys. Stateless signed session cookies are
recommended but left open for the Phase 1 plan.

### 3. Quota and cost line

Phase 0 provisioned nothing and enabled no API. **Zero units consumed. Every free tier at
100% headroom.**

Two corrections to the brief's framing, both in the project's favour except one:

- **The quota is not a flat 10,000 units.** It is *"100 `search.list` calls, 100
  `videos.insert` calls, and 10,000 units per day combined for all other endpoints."*
  `videos.list` costs 1 unit and takes up to 50 IDs, so our bucket allows **~500,000 video
  lookups/day**. Bulk-adding 20 URLs costs **1 call, 1 unit**.
- **`search.list` is capped at 100 *calls*/day** — the lowest ceiling in the project by two
  orders of magnitude. We never call it, because search is over our own rows. Standing
  constraint: adding in-app YouTube search would impose a 100/day ceiling on a core feature.
- **New trap:** thumbnails are remote images, and `next/image` meters against **5,000 Image
  Transformations/month** on Hobby. Serving them straight from `i.ytimg.com` keeps all three
  Image meters at zero and keeps the thumbnail unaltered as the policies require.

| Meter | Projected | >50%? |
|---|---|---|
| YouTube Data API units | <5% on any realistic day | no |
| Vercel Fast Data Transfer | <1% — confirmed, not assumed | no |
| Vercel Image Transformations | 0%, and must stay there | no |
| Neon storage | ~0.4% at 2,000 tracks | no |
| **Neon compute** | 16% light / 46% heavy / **76% very heavy** | **only at very heavy use — flagged** |

Neon compute is the meter to design against, and it is *harder* here than in the previous
architecture: there is no offline mode by policy, so every minute of listening is a minute of
being online, and a music player's sessions are long by nature.

### 4. Compliance and review agents

The brief runs the **compliance agent before Phases 3 and 4** and in the final review, so it
has not run yet. Phase 0 does surface one question squarely in its territory, recorded in
§6.4 and repeated here because it is schema-deep:

> The brief promises *"inline edit of my own fields"* and also forbids altering the player's
> metadata — *"Title and thumbnail must be visible and unaltered."* I am proceeding on the
> conservative reading: **my fields are additive, never substitutes.** The row displays
> `snippet.title` and `snippet.channelTitle`; my `sort_artist` and `note` exist for sorting,
> grouping and search. Product cost: no renaming a badly-titled video in the list.

**Review agent: dispatched, findings pending.** A fresh subagent with no sight of the
drafting conversation is auditing the document against the sources. Findings will be appended
verbatim, including anything disagreed with.

### 5. Could not verify

Full table in §7. The three that matter: the **50-ID limit** on `videos.list` is not on the
reference page (JS-rendered) and rests on secondary sources; whether a **deleted and a
private video are distinguishable** is unconfirmed and §3's link-rot design hangs on it; and
that an **API key alone needs no billing account** is corroborated only secondarily, since
Google's own getting-started page is silent. All three are settled by Phase 1/2 verification
the brief already requires.

Also: Vercel retains runtime logs for **1 hour** on Hobby; Hobby cron runs **once per day
±59 min** and faster expressions fail at deploy; and the **`loop-engineering` skill the brief
asks for is not installed** on this machine (`coverage-analysis` is).

### 6. Commands

See §10 of the deliverable.

---

## Phase 1 — Foundation and auth · 2026-08-26

### 1. File-by-file

| File | Change | Why |
|---|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs` | new/rewritten | Next 16.3.3 + React 19.2.8, strict TS, `noUncheckedIndexedAccess`. ESLint rewritten to use `eslint-config-next`'s **native flat configs** — the `FlatCompat` bridge crashes on ESLint 9.39 with a circular-JSON error. |
| `db/migrations/001_init.sql` | new | All 8 tables, idempotent (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`). `youtube_id varchar(11)` with a `CHECK (~ '^[A-Za-z0-9_-]{11}$')` and a UNIQUE key, so malformed and duplicate IDs are rejected by the database, not by application code. |
| `scripts/migrate.ts` | new | Applies migrations in filename order, one transaction each, tracked in `schema_migrations`. Re-runs are no-ops. |
| `scripts/seed.ts` | new | One admin, one listener (needed to prove the 403 path), five tracks. |
| `lib/db/client.ts` | new | Single `pg` Pool, `max: 3`, TLS on for anything that is not localhost. Only parameterised queries — there is no string-concatenation path into SQL. |
| `lib/auth/password.ts` | new | Argon2id via `@node-rs/argon2` (prebuilt binaries for Vercel's runtime; the plain `argon2` package does not reliably provide them). OWASP profile: 19 MiB, t=2, p=1. `verifyPassword` returns false on a malformed hash rather than throwing. |
| `lib/auth/session.ts` | new | Stateless HMAC-SHA256 signed cookie. No DB read on the hot path. |
| `lib/auth/csrf.ts` | new | Signed double-submit token **plus** an Origin/Host assertion. Both required. |
| `lib/auth/rate-limit.ts` | new | 5 failures per email+IP per 15 min → 429; 10 cumulative account failures → 30-minute lock. |
| `lib/auth/guard.ts` | new | `requireUser` / `requireRole` / `requireAdmin`, reading the signed cookie. |
| `lib/api/respond.ts` | new | One `{ok, data, meta}` / `{ok, error}` envelope; maps error types to status codes so no stack trace can reach a client. |
| `app/api/session/route.ts` | new | The only pre-auth endpoint. Returns the current user and mints the CSRF cookie. |
| `app/api/auth/login`, `logout`, `app/api/admin/users`, `app/api/tracks` | new | Login (rate-limited, CSRF), logout, admin-only user creation and listing, paginated library read. |
| `scripts/verify-phase1.sh` | new | The 17-check curl suite below. |
| `components/chrome/AppShell.tsx` | rewritten | The deleted mini-player reference removed. Carries a comment recording that Phase 3 must mount the player **above** the router. |
| `components/chrome/TabBar.tsx`, `components/primitives/Icons.tsx` | edited | Fourth destination Downloads → **Queue**, with a new queue glyph. The old download-arrow icon was wrong semantics. |
| deleted | `MiniPlayer.*`, `DlPill.*`, `Artwork.*`, `EqOverlay.*`, `lib/artwork.ts`, `lib/library/*`, `components/library/*`, `components/player/*`, `playwright.config.ts`, `tests/*` | Voided by the pivot. Playwright config and tests are rebuilt in Phase 3 against the real screens. |

### 2. Decisions I made that were not specified

| Decision | Alternative rejected |
|---|---|
| **Stateless signed session cookie** carrying `uid`/`role`/`sv`/`exp`, 12h TTL, with `session_version` read only on refresh | DB-backed sessions — instant revocation, but a per-request session read is the single largest driver of Neon awake-time (phase-0 §5). The hybrid bounds revocation lag to the 12h TTL. Phase 0 flagged this as yours; you waived the gate, so I took the recommendation. |
| `pg` over Neon's **pooled** endpoint | `@neondatabase/serverless` HTTP driver — fewer wakeups on Neon, but does not work against a local Postgres, so nothing could be verified locally. |
| CSRF on **login** too, not just post-auth mutations | Exempting login — conventional, but the brief says every mutating route, and login mutates (it creates a session). Cost: a client must GET `/api/session` first. |
| Origin/Host check **in addition to** the double-submit token | Either alone. Both are cheap and they fail independently. |
| Generic `401 Invalid credentials` for both unknown-email and wrong-password, with the same DB work either way | A distinct "no such user" — friendlier, but turns the route into an account enumerator. |
| Rate limit keyed on **email+IP**, plus a separate per-account lock | IP only (punishes shared NATs); email only (lets one attacker lock any account out). |
| `423 Locked` for a locked account, distinct from 401 | Folding it into 401 — hides from the real owner why they cannot get in. |
| `login_attempts` as a table, pruned at 7 days | An in-memory counter — resets on every cold start, which on serverless is constantly. |
| `DEFERRABLE` unique constraint on `playlist_tracks(playlist_id, position)` | A plain unique constraint — trips mid-transaction during a Phase 5 reorder. |
| Explicit `algorithm` option dropped from the Argon2 call | Naming `Algorithm.Argon2id` drags an ambient const enum into an `isolatedModules` build. Verified empirically that the default hash prefix is `$argon2id$` rather than trusting the docs. |
| Seed metadata left as placeholder with `metadata_fetched_at = NULL` | Inventing authoritative-looking metadata. Phase 2's refresh overwrites it; the video IDs are real so Phase 4 has something that plays. |

### 3. Quota and cost line

**YouTube Data API units consumed by Phase 1: 0.** No API key is configured; nothing calls YouTube yet.

| Meter | Consumed | Remaining |
|---|---|---|
| YouTube Data API units | 0 | 10,000/day |
| YouTube `search.list` calls | 0 | 100/day |
| Neon storage | 0 (local Postgres) | 0.5 GB |
| Neon compute | 0 (local Postgres) | 100 CU-hrs |
| Vercel — everything | 0 (nothing deployed) | 100% |

Nothing above 50%. **Nothing has been provisioned or deployed** — see §5.

### 5. What could not be verified, and what it would take

1. **Neon itself.** Everything ran against local PostgreSQL 16.11 on 127.0.0.1. The migration is plain SQL with `citext` and `pgcrypto`, both available on Neon, so it should apply unchanged — but *should* is not *did*. **Needs: you to provision Neon via the Vercel marketplace and set `DATABASE_URL`,** then `npm run migrate && npm run seed`. This also settles whether Neon Free asks for a card.
2. **Vercel deployment.** Nothing is deployed; I cannot log in to your Vercel account. The app builds clean for production (`next build` exit 0) and uses no Node APIs unavailable on Vercel's runtime. **Needs: your `vercel` login.**
3. **`@node-rs/argon2` on Vercel's actual runtime.** It ships prebuilt binaries and is the standard choice for this reason, but I verified it only on darwin-x64. **Needs: one deployed login.**
4. **The `Secure` cookie flag under real HTTPS.** Shown present on a production build over HTTP (§4 below); a real deployment is what proves the browser honours it.

### 6. Commands to see it working

```bash
cd /Users/sotsys165/Projects/music-player
cp .env.example .env.local        # then set DATABASE_URL and SESSION_SECRET
npm run migrate                   # applies db/migrations in order, idempotent
npm run seed                      # prints the two seeded logins
npx tsc --noEmit && npx eslint .  # both exit 0
npx next dev -p 3100 &
BASE=http://127.0.0.1:3100 ./scripts/verify-phase1.sh
```

### 4. Verification — real output

`npx tsc --noEmit` → exit 0. `npx eslint .` → exit 0. `npx next build` → exit 0.

`./scripts/verify-phase1.sh` → **17 passed, 0 failed**:

```
1.  GET  /api/session                                 200   (mints mp_csrf)
2.  POST /api/auth/login   no CSRF header             403   {"error":"CSRF token missing"}
3.  POST /api/auth/login   wrong password             401
4.  POST /api/auth/login   admin                      200
5.  GET  /api/tracks       anonymous                  401
6.  GET  /api/tracks       admin                      200   meta {limit:2, total:5, unavailable:0}
7.  GET  /api/admin/users  admin                      200
8.  POST /api/auth/login   listener                   200
    GET  /api/tracks       listener                   200
    GET  /api/admin/users  listener                   403   {"error":"Requires admin role"}
9.  POST /api/admin/users  admin creates              201
    POST /api/admin/users  duplicate                  409
    POST /api/admin/users  listener                   403
10. login x7 (same email+IP)      401,401,401,401,401,429,429
11. POST /api/auth/logout                             200   mp_session=; Max-Age=0
    GET  /api/tracks after logout                     401
12. GET  /api/admin/users  forged cookie              401   (HMAC holds)
```

Production-build `Set-Cookie`, captured from `next start`:

```
mp_session=…; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=lax
mp_csrf=…;   Path=/; Max-Age=43200; Secure;           SameSite=lax
```

`mp_csrf` is deliberately not `HttpOnly` — the client must read it to echo it into the
`x-csrf-token` header. It is signed, so it cannot be forged by an attacker who can set
cookies but does not hold `SESSION_SECRET`. Neither token is ever written to localStorage.

### 7. Review agent

Dispatched; findings to be appended verbatim.

---

## Phase 2 — Library and metadata · 2026-08-26

### 1. File-by-file

| File | Change | Why |
|---|---|---|
| `lib/youtube/parse-url.ts` | new | Extracts a video id from every URL form. Rejects host lookalikes (`youtube.com.evil.test`), playlist and channel URLs, and any id that is not 11 chars of `[A-Za-z0-9_-]`. Returns a typed failure reason, not a boolean. |
| `lib/youtube/api.ts` | new | `videos.list` client. Batches at **50 ids per call**, collapses duplicates before spending anything, and **never retries** — every request costs quota even when invalid. Quota exhaustion throws `YouTubeQuotaError` so it can never surface as an empty result. Returns `callCount`, which *is* the unit count. |
| `lib/youtube/config.ts` | new | `YOUTUBE_REGION` (region-blocking is evaluated per viewer) and `YOUTUBE_API_KEY`. |
| `app/api/admin/tracks/route.ts` | new | Add / bulk-add. Parses, dedupes within the request, checks existing rows **before** the API call so duplicates cost no quota, then batch-fetches and inserts. Returns a per-input outcome plus `quotaUnitsSpent`. |
| `app/api/admin/tracks/[id]/route.ts` | new | `PATCH` edits **only** `sortArtist` and `note`; `DELETE` removes the row. There is deliberately no route that can overwrite YouTube's title, channel, duration or thumbnail. |
| `app/api/admin/tracks/refresh/route.ts` | new | Deliberate refresh, oldest-`availability_checked_at` first, batched. Missing videos are flagged `unavailable`, never deleted — a video can come back, and dropping the row would take the owner's playlists with it. |
| `db/migrations/002_policy_fields.sql` | new | `made_for_kids`, `age_restricted`, `live_broadcast_content`, `region_allowed`, and `age_restricted` added to the availability enum. All from the same `part=` call, so zero extra quota. |
| `tests/parse-url.test.ts`, `tests/youtube-api.test.ts` | new | 64 tests. 24 accepted URL forms, 18 rejections, batching, dedupe, availability derivation, quota failure, no-retry. |
| `scripts/youtube-stub.mjs` | new | Speaks the real `videos.list` response shape and counts calls, so batching is proven through the route, not only in a unit test. |
| `scripts/verify-phase2.sh`, `scripts/show.py` | new | The 29-check suite below. |

### 2. Decisions not specified

| Decision | Alternative rejected |
|---|---|
| Duplicate check runs **before** the API call | Relying on the UNIQUE constraint alone — correct, but pays quota for a row we already have. |
| `not-found` (absent from `items`) is one state, not "deleted" vs "private" | Inventing the distinction. The IFrame API's own error 100 covers "removed **or** private", so YouTube does not distinguish them anywhere we can see. |
| Age restriction outranks `embeddable: false` in the availability derivation | Checking `embeddable` first. At playback both are `onError` 101/150, so ingest is the only chance to label age restriction correctly. |
| Missing videos are flagged, never deleted | Deleting — tidier, but destroys playlist membership for a video that may return. |
| `YOUTUBE_API_BASE` env seam | Hard-coding googleapis.com. The seam is what lets the route, batching and DB be verified end-to-end without a live key. Unset in every real environment. |
| Bulk input accepts a pasted blob split on whitespace, not only a JSON array | Array only — worse for the actual use case ("paste many URLs"). |

### 3. Quota and cost line

**Live YouTube units consumed: 0** — no API key is configured; all runs went to the local stub.

Measured cost, from the stub's own call counter:

| Action | API calls | Units | % of 10,000/day |
|---|---|---|---|
| Add 1 URL | 1 | 1 | 0.01% |
| **Add 20 URLs in one action** | **1** | **1** | **0.01%** |
| Add 120 URLs | 3 (50/50/20) | 3 | 0.03% |
| 6 malformed inputs | **0** | **0** | 0% |
| Add a duplicate | **0** | **0** | 0% |
| Refresh 60 tracks | 2 (50/10) | 2 | 0.02% |

`search.list` calls: **0 of 100**. Neon/Vercel: nothing deployed.

### 4. Verification — real output

`npx tsc --noEmit` 0 · `npx eslint .` 0 · `npm test` **64 passed, 0 failed** ·
`./scripts/verify-phase2.sh` **29 passed, 0 failed**.

All 11 URL forms parsed to the right id through the real add route: canonical watch,
watch+list+timestamp, `youtu.be`, `youtu.be`+t, shorts, embed, live, music.youtube,
m.youtube, nocookie embed, bare id.

Availability derived and stored correctly, from the stub's fixtures:

```
NOEMBEDxxxx -> not_embeddable      (status.embeddable = false)
BLOCKEDxxxx -> region_blocked      (regionRestriction.blocked contains IN)
ALLOWUSxxxx -> region_blocked      (regionRestriction.allowed omits IN)
AGEGATExxxx -> age_restricted      (contentRating.ytRating = ytAgeRestricted)
LIVENOWxxxx -> ok                  (liveBroadcastContent = live, duration P0D -> 0s)
KIDSVIDxxxx -> ok                  (madeForKids = true; playable, needs tracking off)
MISSINGxxxx -> not-found           (absent from items)
```

### 5. Could not verify

1. **A live call to Google.** Everything ran against the stub. **Needs: a `YOUTUBE_API_KEY` in `.env.local`, then `npm run migrate && npm run seed` and re-run `verify-phase2.sh` with `YOUTUBE_API_BASE` unset.** That single run also settles whether an API key alone works without a billing account.
2. **The 50-id hard limit.** Asserted from secondary sources; no Google page states a maximum, and the Discovery document declares `id` as repeated with no `maximum`. The stub enforces 50 so our batching is proven, but Google's actual over-length behaviour (reported as HTTP 400 `invalidFilters`, *not* silent truncation) is unconfirmed. Silent truncation would be the dangerous case, because absence-from-`items` is how we detect removed videos.
3. **Whether deleted and private are truly indistinguishable.** Needs one live call with a known-deleted and a known-private id in the same batch.
4. **Neon and Vercel** — still local Postgres, still not deployed.

---

## Review agent findings and disposition · 2026-08-26

Two fresh reviewers ran with no sight of the implementation conversation. Both found real
defects. Dispositions below; verbatim finding text is preserved in the session transcript
and the substance of every finding is reproduced here, including the ones I dispute.

### Phase 0 grounding review — 5 CRITICAL, 9 HIGH, 15 MEDIUM, 8 LOW

**C1 — ACCEPTED, and it breaks the core row design.** The 40×40 row thumbnail sits inside
the 56px row that starts playback. I verified the rule myself, verbatim from
https://developers.google.com/youtube/terms/required-minimum-functionality:

> "Any YouTube thumbnail that initiates a playback must be at least 120 pixels wide and 70
> pixels tall."

Also confirmed on that page: *"Embedded players must have a viewport that is at least 200px
by 200px"*, *"An API Client must not initiate an automatic playback until the player is
visible and more than half of the player is visible on the page or screen"*, and *"A page or
screen must not have more than one YouTube player that automatically plays content
simultaneously."* Phase 0 labelled the thumbnail size a **cheap** decision. It is the row
geometry of the entire library screen. **Resolution carried into Phase 3 below.**

**C2 — ACCEPTED.** Phase 0 made four "the policies require" claims and cited no policy
document at all. Its Sources list had six URLs, none of them a terms, policy, RMF, branding
or IFrame page. That single omission is the root cause of C1 and H1–H5.

**C3–C5, H1–H9 — all ACCEPTED.** The ones with code consequences, now fixed:

| Finding | Fixed by |
|---|---|
| H3 — `status.madeForKids` lookup is mandatory ("must turn off tracking") | `made_for_kids` column + captured at ingest |
| H6 — age-restricted content (`contentRating.ytRating`) missing entirely | `age_restricted` column, new `age_restricted` availability state, checked **first** in the derivation |
| H7 — `duration` returns `P0D` for live/upcoming, so "durations never change" is false | `live_broadcast_content` column; parser verified against `P0D`, `PT0S`, `P1DT2H3M4S`, `P2D` |
| H9 — schema could store `regionRestriction.blocked[]` but not `allowed[]` | `region_allowed` column; the allow-list-omits-us case now derives correctly |
| M1 — the quota reset time **is** documented on a page Phase 0 cited: *"Daily quotas reset at midnight Pacific Time (PT)."* | Closed; it was carried as unverified in error |
| M5 — Image Transformations are billed per **cache miss**, not per view, so Phase 0's "a 2,000-track library browsed a few times would burn through that" was wrong | Decision unchanged (direct `i.ytimg.com`, now enforced by CSP `img-src`), reasoning corrected |
| M9 — btree on `lower(title)` serves prefix only; substring search needs `pg_trgm` | Carried to Phase 5 |

**Still owed, carried forward, not silently dropped:**

- **H1 — the 30-day data-refresh obligation.** Quoted: *"API Clients may temporarily store
  limited amounts of Non-Authorized Data … but not longer than 30 calendar days … after 30
  calendar days, the API Client must either delete or refresh the stored data."* This makes
  the refresh sweep a **compliance requirement**, not an optimisation, and it is in direct
  tension with the brief's "never re-fetch what has not changed". The sweep is a Phase 6
  deliverable, so **between Phase 2 and Phase 6 the app is out of compliance by design.**
  Migration 002 added `tracks_metadata_fetched_idx` so "which rows are near 30 days" is
  cheap. **The cron itself is Phase 6.**
- **H2 — a disclosure is required next to my own fields.** Quoted: *"To the extent your API
  Clients display any information, data or metrics not based on API Data alongside API Data,
  your API Clients must include a clear and prominent disclosure there that such
  information, data and metrics are not from YouTube and are part of your own product."* So
  "additive, never substitutes" was the right instinct but incomplete. Also: clause (ii)
  prohibits *derived* metrics, which kills two of the three candidates Phase 0 floated for
  the header's second figure — total duration and channel count are both derived from API
  Data. **Unavailable count is the only survivor.** Phase 3 design problem.
- **H4 — YouTube attribution/branding is required** on any page displaying YouTube content,
  and the mark is red, which collides head-on with "amber is the only colour". Phase 3.
- **H5 — auto-advance needs the player more than half visible.** Constrains Phase 4's queue,
  not just Phase 3's layout.

**Rejected: none.** Two corrections to the reviewer rather than disputes: M11 noted
`session_version` was missing from Phase 0's §4 schema — true of the document, but the
column shipped in migration 001. L5 is right that `git rev-list --count HEAD` errors with
zero commits; the "0" I reported came from a shell fallback, so the claim was true and the
documented command was wrong.

### Phase 1 auth review — 1 CRITICAL, 4 HIGH, 13 MEDIUM, 7 LOW

Every finding below was **accepted and fixed**, and each now has a verification check.

| # | Defect | Fix |
|---|---|---|
| **C1** | `seed.ts` used `ON CONFLICT DO UPDATE SET password_hash`, so every run **reset the admin password to a value hard-coded in the repo** — and build-log §5 told the owner to run exactly that against production | `DO NOTHING`; production requires `SEED_*` env vars or the script refuses; password no longer printed; imports `hashPassword` instead of duplicating the Argon2 profile |
| **H2** | Revocation did not exist. `session_version` was **write-only** — nothing ever read it, and no route could bump it. A demoted admin kept admin rights for 12h and could mint themselves a fresh admin account | `/api/session` now revalidates `sv`, role and existence against the DB once per page load (not per request), clears the cookie on mismatch, and re-issues on a role change. New `PATCH/DELETE /api/admin/users/[id]` can change role or force sign-out-everywhere, bumping `session_version` |
| **H3** | `failed_login_count` never reset, so every failure past 10 **re-armed a fresh 30-minute lock forever** — one request per 30 min from any IP kept the only admin account locked out permanently | Counter resets once a lock expires; `423` is now returned **only** when the password is correct, so the status code is no longer an account-existence oracle |
| **H4** | An unknown email skipped Argon2 entirely — **~25 ms vs ~0 ms**, a timing account-enumeration oracle far above network jitter | `burnPasswordWork()` verifies against a fixed dummy hash on the not-found path |
| **H5** | A **correct** password did not clear the failure window, so five typos locked the owner out for 15 minutes with the right password in hand — and made the verify script self-poisoning after 5 runs | `clearFailures()` on success; the suite also cleans up after itself now |
| M6 | Rotating `SESSION_SECRET` was a permanent lockout: `/api/session` re-minted the CSRF token only when **absent**, so every browser kept a stale token that failed `assertCsrf` — including on login | Re-mints when absent **or** unverifiable |
| M7 | Session and CSRF HMACs shared a key, an algorithm and a wire format, so each verified the other's tokens — a forgery oracle waiting for the first helper that signs user input | Domain-separated labels `mp.session.v1|` / `mp.csrf.v1|` |
| M11 | `DEFERRABLE INITIALLY IMMEDIATE` still trips on a row-by-row reorder (reviewer verified against PG 16), and `lib/db/client.ts` had no transaction helper, so Phase 5 had no safe way to defer | Migration 003 → `INITIALLY DEFERRED`; added `withTransaction()` |
| M13 | `ORDER BY added_at DESC` with no tiebreaker — every row of a bulk add shares `added_at`, so paging could show a track twice and skip another. Plus a full-table aggregate on **every** page | `ORDER BY added_at DESC, id DESC` + matching index; counts only at `offset = 0` |
| M15 | No HSTS, no CSP, no `nosniff`, no `Referrer-Policy`; authenticated JSON was cacheable | All four added in `next.config.ts`, plus `frame-ancestors 'none'` and `frame-src` for the YouTube player only; `Cache-Control: private, no-store` on every API response |
| M16 | `pruneLoginAttempts` was dead code — nothing called it, so the table grew unbounded | `maybePruneLoginAttempts()`, called opportunistically (~2%) from login, failures swallowed |
| M17 | Check-then-insert race on user creation surfaced as a 500 | Single `INSERT … ON CONFLICT DO NOTHING RETURNING`, 409 when empty |
| M18 | No migration checksum, so editing an applied migration diverged local from production silently | SHA-256 recorded per file; a changed file now hard-fails |
| M10, M14, L19–L25 | IP trust, weak verification checks, lenient base64 comparison, `verify()` options ignored, missing FK indexes, no connection/statement timeouts, `?limit=` empty-string, missing `note` in the SELECT, no `Retry-After` | All addressed except the IP-trust hardening (M10), which needs to know Vercel's actual header behaviour — **carried, flagged** |
| **M12** | Phase 0 committed to UUIDv7 as an `[E]` decision; the migration shipped `gen_random_uuid()`, which is **v4** | **Reversal recorded here rather than silently kept.** PG 16 has no built-in `uuidv7()`. v4 costs random B-tree insert locality, which is mildly against the Neon-compute argument; at a few thousand rows it does not matter. Revisit if the library grows an order of magnitude. |

### Verification after the fixes

`./scripts/verify-phase1.sh` → **37 passed, 0 failed** (was 17 checks; the reviewer showed
several proved less than their label). New checks assert cookie flags rather than printing
them, a mismatched `Origin`, a CSRF token borrowed from another session, a stripped
signature, a correctly-signed-but-expired cookie, **revocation actually revoking**,
migration re-runnability, all five security headers, and that the suite leaves no rows
behind.

`./scripts/verify-phase2.sh` → **29 passed, 0 failed** after the changes. `npm test` → 64.

