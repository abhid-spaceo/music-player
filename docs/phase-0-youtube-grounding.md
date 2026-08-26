# Phase 0 — Grounding (YouTube-backed architecture)

Date: 2026-08-26. No code written. Nothing provisioned. All meters at 0%.

Every figure is quoted from a doc fetched today with its URL, or is arithmetic shown in
full, or is flagged as unverified. Supersedes `docs/phase-0-grounding.md`, which grounded a
different product (self-hosted audio in Vercel Blob).

---

## 0. The pivot: what is void, and what survives

The repo already contains work built against the previous brief — a Vercel Blob file-hosting
player. **Nothing is committed** (`git rev-list --count HEAD` → 0, everything untracked), so
discarding is free. For the record, so nothing is silently reused that should not be:

**Void — built on assumptions this brief removes**

| File | Why |
|---|---|
| `components/chrome/MiniPlayer.*` | A 62px mini-player cannot hold a 200×200 embed. Explicitly ruled out. |
| `components/primitives/DlPill.*` | No offline, so no downloaded state. |
| `components/primitives/Artwork.*`, `lib/artwork.ts` | Synthetic colour-field artwork is replaced by real YouTube thumbnails. |
| `components/primitives/EqOverlay.*` | The playing marker is now the 2px amber left bar the brief specifies. |
| `lib/library/fixtures.ts` | Invented tracks; needs real 11-character video IDs. |
| `docs/phase-0-grounding.md` and its two review files | Blob-era ledger. Kept as history, not as guidance. |

**Survives unchanged — the design system did not move**

`styles/tokens.css` and `styles/base.css` (token values are identical; only `--raised`'s
comment changes from "mini-player" to "player surface") · `app/layout.tsx` with the
self-hosted `@fontsource-variable/instrument-sans/wght.css` +
`@fontsource/ibm-plex-mono` 400/500 · `components/chrome/{ScreenHeader,Sidebar,TabBar,AppShell}`
(TabBar's fourth destination changes Downloads → Queue) ·
`components/library/{ColumnHeader,FilterChips,TrackRow,LibraryScreen}` ·
`components/primitives/{Icons,Buttons}` · `lib/format.ts` · the whole Playwright harness in
`tests/` · and the computed contrast table below, because the tokens are the same.

Also unchanged: `design/Music_Player_dc.html` and `design/support.js` are already in place at
the repo root, SHA-256 verified against the export. Same canvas, same artboards.

---

## 1. Cost ledger

### 1.1 YouTube Data API v3 — the only meter that matters

Sources: https://developers.google.com/youtube/v3/getting-started ·
https://developers.google.com/youtube/v3/determine_quota_cost

**Your brief's framing needs one correction.** The quota is not a flat 10,000 units. Quoted
verbatim:

> "Projects that enable the YouTube Data API have a default quota allocation of 100
> `search.list` calls, 100 `videos.insert` calls, and **10,000 units per day combined for all
> other endpoints**."

So there are three separate buckets, and two of them are brutally small:

| Bucket | Default daily allowance | Do we use it? |
|---|---|---|
| `search.list` | **100 calls** | **No** — see §1.2 |
| `videos.insert` | 100 calls | No — we never upload |
| Everything else, incl. `videos.list` | **10,000 units** | Yes, this is our bucket |

`videos.list` costs **1 unit per call**, and accepts **up to 50 IDs per call** (the 50 limit
is not on the reference page I could fetch — see §7 — but is consistently reported and is the
long-standing hard limit; a 51-ID request fails outright).

**Therefore: 10,000 units/day ÷ 1 unit per call × 50 IDs = up to 500,000 video metadata
lookups per day.** Against a personal library this is not a constraint in any realistic
scenario. Concretely:

| Action | Calls | Units | % of 10,000 |
|---|---|---|---|
| Add one track | 1 | 1 | 0.01% |
| **Bulk-add 20 URLs in one action** | **1** | **1** | **0.01%** |
| Bulk-add 500 URLs | 10 | 10 | 0.1% |
| Daily link-health sweep, 2,000-track library | 40 | 40 | 0.4% |
| Daily link-health sweep, 20,000-track library | 400 | 400 | 4% |

One rule worth building around, quoted: *"Every API request, even if invalid, will cost at
least one quota point."* So a retry loop on a malformed request burns quota just as fast as
a successful one. Failures must not retry blindly.

**Your risk #3 is real but is entirely a batching bug, not a ceiling problem.** One call per
video on a 500-URL import is 500 units — still only 5% of the allowance. The way this
actually breaks is a retry loop or a per-page-render fetch, both of which your brief already
forbids. I will enforce "never call the API on a render" in code, not just in review.

**Does it need a billing account or a card?** **No.** There is no monetary charge per
request, no billing meter, and no card required — an API key alone is sufficient for
`videos.list`, which reads public data only. Note this is corroborated from secondary
sources; Google's own getting-started page is silent on billing (§7).

**Behaviour at the limit:** requests fail with a quota error until the daily reset. Google's
docs do not state the reset time or timezone on the page I read; it is widely reported as
midnight Pacific. Flagged as unverified (§7) — it matters only for choosing when the
link-health cron runs.

**Requesting more:** quoted — *"If you reach the quota limit, you can request additional
quota by completing the Quota extension request form for YouTube API Services."* Whether that
requires anything paid is not stated. Irrelevant at our scale; noted for completeness.

### 1.2 The one hard wall, and why we never touch it

`search.list` is capped at **100 calls per day** — not 100 units, 100 calls. That is the
lowest ceiling in the entire project by two orders of magnitude.

We never call it. Your Phase 5 specifies *"search across my own metadata"*, which is a
Postgres query over rows we already hold. **This is worth stating as a standing constraint:
the moment anyone wants "search YouTube from inside the app", the project acquires a
100-request/day ceiling on its most-used feature.** That is a product decision, not an
engineering one, and it should be made deliberately rather than discovered.

### 1.3 Vercel Hobby

Source: https://developers.google.com/... no — https://vercel.com/docs/plans/hobby
(page's own `last_updated: 2026-06-16`), verified earlier this session.

| Resource | Hobby included | Our use | Headroom |
|---|---|---|---|
| Function Invocations | First 1,000,000 | ~20k/mo | ~98% |
| Active CPU | **4 CPU-hrs** | ~0.5 CPU-hr (Argon2 + JSON) | ~88% |
| Provisioned Memory | 360 GB-hrs | small | large |
| Edge Requests | Up to 1,000,000 | ~100k/mo | ~90% |
| Fast Data Transfer | 100 GB | **a few MB per session** | >99% |
| Deployments/day | 100 | fine | — |
| Runtime Logs | **1 hour retention** | — | see §7 |
| Image Transformations | **First 5,000** | **must stay 0** | see below |
| Image Cache Reads / Writes | 300,000 / 100,000 | 0 | — |

**Your brief asks me to confirm rather than assume that transfer is no longer a concern. It
is confirmed, and by a wide margin.** With YouTube serving every byte of media, what leaves
our origin is HTML, JS, CSS and small JSON payloads — single-digit MB per session against a
100 GB allowance. Transfer has gone from the binding constraint of the previous architecture
to a rounding error.

**One new trap this architecture introduces.** Thumbnails are remote images, and the default
Next.js path for a remote image is `next/image`, which meters against **5,000 Image
Transformations/month** on Hobby. A 2,000-track library browsed a few times would burn
through that. The fix is to serve thumbnails **directly from `i.ytimg.com` with a plain
`<img>`**, square-cropped with `object-fit: cover` — which costs us nothing, keeps
YouTube's thumbnail unaltered as the policies require, and keeps all three Image meters at
zero. This is a decision, not an optimisation, and it is in §8.

**Behaviour at the limit**, quoted: *"if you exceed your usage limits on the Hobby plan, you
will have to wait until 30 days have passed before you can use the feature again."* No
invoice. **Card required?** No — the card step appears only in the upgrade-to-Pro flow.
**Non-commercial**, quoted: *"the Hobby plan restricts users to non-commercial, personal use
only."* A private player for one person qualifies.

### 1.4 Neon Postgres (Free plan)

Source: https://neon.com/docs/introduction/plans, verified earlier this session.

| Resource | Free plan | Our use |
|---|---|---|
| Storage | **0.5 GB per project** | ~2 MB at 2,000 tracks (§4) → **0.4%** |
| Compute | **100 CU-hours/project/month** | **the meter that matters (§5)** |
| Scale to zero | after 5 min idle, **cannot be disabled** | shapes everything |
| Autoscaling | **up to 2 CU** on Free | makes the 400-hour figure a floor |
| Public network transfer | 5 GB/month | metadata JSON only |
| Instant restore | 6-hour limit, capped at 1 GB of change history | fine |

**Behaviour at the limit**, quoted: *"when you run out of CU-hours or public network transfer,
your compute is suspended until the next billing period or until you upgrade"*; storage
overage causes *"operations that increase storage (inserts, updates, and deletes) to fail"*;
and *"None of these limits delete your data."*

**Card required?** Neon's Free plan needs none. Provisioning through the Vercel Marketplace
in Phase 1 settles it in seconds; if it asks for a card, that is a stop-and-tell-you moment.

**Your brief's claim that storage is no longer a constraint is correct, and §4 shows the
arithmetic: a 20,000-track library is ~16 MB, about 3% of the allowance.**

### 1.5 Fonts

Self-hosted from npm (`@fontsource-variable/instrument-sans`, `@fontsource/ibm-plex-mono`),
already installed and verified. Zero recurring meter, zero runtime third-party request. Free.

### 1.6 Ledger summary — is any meter over 50%?

| Meter | Projected | Over 50%? |
|---|---|---|
| YouTube Data API units | <5% on any realistic day | no |
| YouTube `search.list` calls | 0 of 100 — by design | no |
| Vercel Fast Data Transfer | <1% | no |
| Vercel Active CPU | ~12% | no |
| Vercel Image Transformations | **0%, and must stay there** | no |
| Neon storage | ~0.4% | no |
| **Neon compute** | **16% light / 46% heavy / 76% very heavy (§5)** | **only under very heavy use — flagged** |

Nothing is over 50% today. The single meter that can cross it is **Neon compute**, and
unlike the previous architecture there is now **no offline mode to fall back on** — every
listening session is online by definition. That makes §5 more important here than it was
before, not less.

---

## 2. Metadata: fields, batching, caching, refresh

Source: https://developers.google.com/youtube/v3/docs/videos

One call — `videos.list` with `part=snippet,contentDetails,status` — returns everything we
need, and costs 1 unit regardless of how many parts are requested (the cost table is
per-method).

| What we need | Exact field path | Notes |
|---|---|---|
| Title | `snippet.title` | max 100 chars. Must be displayed unaltered (§6.4). |
| Channel name | `snippet.channelTitle` | |
| Channel id | `snippet.channelId` | for grouping by channel |
| Duration | `contentDetails.duration` | **ISO 8601**, e.g. `PT15M33S`. Parse to seconds on ingest. |
| Thumbnail | `snippet.thumbnails.{default,medium,high,standard,maxres}` | `default` 120×90 · `medium` 320×180 · `high` 480×360 · `standard` 640×480 · `maxres` 1280×720. Each has `url`, `width`, `height`. |
| Embeddable | `status.embeddable` | boolean |
| Privacy | `status.privacyStatus` | `private` · `public` · `unlisted` |
| Upload state | `status.uploadStatus` | `deleted` · `failed` · `processed` · `rejected` · `uploaded` |
| Region limits | `contentDetails.regionRestriction.allowed[]` / `.blocked[]` | lists of region codes |

**Thumbnail choice.** The design crops to a 40×40 square. `medium` (320×180) centre-cropped
with `object-fit: cover` is the right source — `default` at 120×90 is too small for the
1280px layout and a 2× display. We store the URL the API returns rather than constructing
one, so a future YouTube URL-scheme change does not silently 404 the whole library.

**Caching strategy.** Metadata is written to Postgres once on add and never re-fetched on
read. Every screen renders from our own rows. The API is called in exactly three places:

1. **Add a track** — one batched `videos.list` per ≤50 IDs.
2. **Deliberate refresh** — an explicit admin action on a selection.
3. **The link-health sweep** — the Phase 6 cron.

Nowhere else, and never during a page render. `metadata_fetched_at` on each row records
when, so staleness is measurable rather than assumed.

**How stale is acceptable.** Titles and channel names change rarely; durations never change
for a given video. The thing that genuinely decays is *availability*. So the refresh policy
splits:

- **Availability** — swept daily by the cron, oldest `availability_checked_at` first, in
  50-ID batches. On a 2,000-track library that is 40 units/day and the whole library is
  re-checked every day.
- **Descriptive metadata** (title, channel, thumbnail) — refreshed opportunistically in the
  same call, since the sweep already returns `snippet`. No separate schedule needed, and no
  extra quota: one call gets both.

That is the whole strategy, and it costs under half a percent of the daily allowance.

**Cron constraint:** Vercel Hobby cron runs **once per day, ±59 minutes**, and expressions
that would run more often **fail at deploy time**. So the sweep is one daily pass at an
unpredictable hour — which is fine for availability, and is why the batch is sized to cover
the entire library in a single run rather than paginating across runs.

---

## 3. Link rot: how each failure is actually detected

Your risk #2 says the API reports these differently, and it does — they arrive by three
different mechanisms, which is why they need three different code paths:

| Failure | Detection | Confidence |
|---|---|---|
| **Removed / deleted** | The ID is **absent from the `items` array** — `videos.list` returns fewer items than IDs requested, with no error. Detected by diffing requested IDs against returned IDs. | high, **needs Phase 2 verification** (§7) |
| **Private** | Same: absent from `items`. A third party's private video is not returned at all. So *removed* and *private* may be indistinguishable via this endpoint. | medium, **needs verification** |
| **Embedding disabled** | Explicit: `status.embeddable === false`. The video is returned normally. | high — documented field |
| **Region-blocked** | Explicit: `contentDetails.regionRestriction.blocked[]` contains our region, or `.allowed[]` omits it. | high — documented field |
| **Rejected / failed processing** | `status.uploadStatus` is `rejected` or `failed`. | high — documented enum |

**The important consequence:** two of the five are detected by *absence*, and absence may not
distinguish "deleted" from "made private". If Phase 2 confirms that, the honest UI has a
single `unavailable` state for both rather than inventing a distinction the API cannot
support. Your design brief already asks for one 16px `--dim` marker, so this fits — but the
*copy* behind it must not claim more than we know.

The IFrame player reports failures separately at playback time via its `onError` event, with
its own numeric codes. That is Phase 4's research job, and the two sources must agree on
what the user is told.

---

## 4. Schema, sized against 0.5 GB

Six tables from your brief, plus `sessions` (which §5 may eliminate) and
`schema_migrations`. Note there is no `albums` or `artists` table — channel is a field on the
track, not an entity, because YouTube has no album concept.

```
users            id, email(uniq citext), password_hash, role('admin'|'listener'),
                 display_name, created_at, last_login_at,
                 failed_login_count, locked_until

tracks           id, youtube_id char(11) UNIQUE NOT NULL,
                 title, channel_title, channel_id,
                 duration_sec int, thumbnail_url,
                 -- my own additive fields (NOT replacements — see §6.4)
                 sort_artist, note, 
                 availability ('ok'|'unavailable'|'not_embeddable'|'region_blocked'),
                 embeddable bool, privacy_status, upload_status,
                 region_blocked text[],
                 metadata_fetched_at, availability_checked_at,
                 added_at, added_by -> users

playlists        id, owner_id -> users, name, description, created_at, updated_at
playlist_tracks  playlist_id, track_id, position, added_at
                 PK(playlist_id, track_id)  UNIQUE(playlist_id, position)
favourites       user_id, track_id, created_at   PK(user_id, track_id)
play_history     id, user_id, track_id, played_at, ms_played, completed, source
sessions         id, user_id, expires_at, created_at, revoked_at
```

Indexes: `tracks(youtube_id)` unique · `tracks(channel_id)` ·
`tracks(availability_checked_at)` for the sweep's oldest-first ordering ·
`tracks(lower(title))` and `tracks(lower(sort_artist))` for local search ·
`playlist_tracks(playlist_id, position)` · `play_history(user_id, played_at DESC)`.

### Sizing

`tracks` is the widest row: an 11-char id, a ≤100-char title, a channel name, a thumbnail
URL (~50 chars), plus small scalars and the 23-byte row header ≈ **~450 bytes**, and roughly
the same again in indexes.

| Library size | `tracks` data + indexes | % of 0.5 GB |
|---|---|---|
| 200 tracks | ~180 KB | 0.04% |
| 2,000 tracks | ~1.8 MB | 0.4% |
| 20,000 tracks | ~18 MB | 3.6% |

Everything else is negligible: users ~1.5 KB, playlists and `playlist_tracks` well under
100 KB at any plausible size, favourites likewise, plus ~200 KB of per-table page floor.

`play_history` is the only unbounded table. One user at 30 plays/day = ~11,000 rows/year at
~70 bytes plus a comparable index ≈ **~1.5 MB/year**.

**Verdict: your claim is confirmed. At 2,000 tracks the whole database is under 4 MB, about
0.8% of the allowance, growing ~1.5 MB/year. Neon storage is not a constraint and needs no
pruning policy.** The constraint is compute, which the next section is about.

---

## 5. Neon compute budget, and what holds the database awake

100 CU-hours/month at the 0.25 CU floor = **400 wall-clock hours of an awake database**
against a ~730-hour month, so it can be awake about **55% of the month at most**. Two caveats
that make 400 a ceiling rather than an estimate: Free **autoscales up to 2 CU**, and
CU-hours bill as average compute size × hours — so anything that makes the compute scale up
burns the allowance proportionally faster. Scale-to-zero fires after 5 minutes idle and
**cannot be disabled**, so every burst of activity costs its own duration plus a 5-minute
tail.

### Why this is a bigger deal than in the previous architecture

The Blob-based design had an escape hatch: a listener playing downloaded tracks touched
neither storage nor database. **This architecture has no offline mode by policy, so every
minute of listening is a minute of being online.** A music player's sessions are long by
nature. That combination is exactly what a 400-hour ceiling punishes.

### What holds it awake, ranked

1. **DB-backed session validation on every request.** If every page load and API call reads
   a `sessions` row, every interaction wakes the compute. Worst offender, and the easiest to
   walk into.
2. **`play_history` written per track start.** A 2-hour listening session writes every ~4
   minutes, each write resetting the 5-minute idle timer — so the compute stays awake for the
   entire session. This is the design feature that most directly converts listening time
   into compute time.
3. **IFrame player state changes.** The player emits `onStateChange` frequently. Persisting
   or logging on each one turns one session into hundreds of wakeups.
4. **A query library's default refetching.** React Query defaults
   `refetchOnWindowFocus: true`; every tab-back wakes the DB. Any `refetchInterval` is a
   standing alarm clock.
5. **Local search-as-you-type.** Phase 5. Debounced or not, it fires during otherwise-idle
   browsing.
6. **The library header's count figure** — a `COUNT(*)` on the first screen of the app, so
   every cold open wakes the DB before the user does anything.
7. **The daily link-health cron.** One guaranteed wakeup per day. Trivial in itself; worth
   knowing it exists.

### Budget

| Listening pattern | Awake h/day | h/month | CU-hours | % of 100 |
|---|---|---|---|---|
| Light — 2 h/day | 2.1 | 63 | 15.8 | **16%** |
| Heavy — 6 h/day | 6.1 | 183 | 45.8 | **46%** |
| Very heavy — 10 h/day | 10.1 | 303 | 75.8 | **76%** |

All three assume the 0.25 CU floor; autoscaling pushes them up.

### Mitigations, and one that looked obvious and is wrong

1. **Stateless signed session cookies** — HMAC-signed, carrying `user_id`, `role`, `exp`,
   verified with a secret and no DB read. Removes offender #1 outright. Cost: revocation
   becomes lazy — demoting an admin does not take effect until the cookie expires. Mitigated
   by a short lifetime plus a `session_version` checked only on refresh. **This is a real
   security-vs-cost trade-off and it is yours to decide in the Phase 1 plan, not mine.**
2. **Batch `play_history`** — buffer client-side and flush on `visibilitychange` and
   `pagehide`. **Not on a 5-minute timer:** a 5-minute flush lands at or before the
   scale-to-zero threshold on every cycle and so keeps the compute awake for the whole
   session, which is offender #2 restated rather than fixed.
3. **Never persist raw player state changes.** Derive one "played" record per track at the
   end, client-side.
4. `refetchOnWindowFocus: false`, no polling, long `staleTime` on library data — the library
   changes only when I add something.
5. **Denormalise the header count** into a tiny stats row rather than `COUNT(*)` on cold open.

With 1, 2, 3 and 4 in place, the heavy case drops from ~46% to roughly 15–20%.

---

## 6. Assumptions I am making that you did not state

**[E]** expensive to reverse after Phase 3 · **[C]** cheap.

### Expensive

1. **[E] The player instance lives above the router, in the root layout, rendered exactly
   once and never keyed or conditionally mounted.** Your risk #1. Every screen reads and
   controls it through context. Reversing means rebuilding the layout, which is why it is
   settled in Phase 3 and not deferred.
2. **[E] Sessions are stateless signed cookies, not DB rows** (§5). Costs lazy revocation.
   Touches every route. Open for your Phase 1 decision.
3. **[E] `youtube_id char(11)` is the natural key with a UNIQUE constraint.** Duplicate
   rejection is a constraint violation, not an application check. Reversing means a
   migration plus rewriting the add path.
4. **[E] `my` fields are *additive*, never replacements** (see 6.4 below — this one is a
   compliance question, not a preference).
5. **[E] Duration stored as `duration_sec int`, parsed from ISO 8601 on ingest.** Storing the
   raw `PT15M33S` string instead would push parsing into every read.
6. **[E] Availability is an enum column on `tracks`, plus a timestamp** — not an append-only
   check-log table. Simpler, and the sweep only ever needs the latest verdict. Reversing to
   get history means a new table and a backfill.
7. **[E] No YouTube search inside the app, ever** (§1.2). Keeps the 100-call/day
   `search.list` ceiling permanently irrelevant.
8. **[E] Thumbnails are served straight from `i.ytimg.com` via a plain `<img>`**, never
   `next/image` (§1.3). Keeps three Image Optimization meters at zero and keeps YouTube's
   thumbnail unaltered.
9. **[E] Single shared library, single-tenant.** No `owner_id` on `tracks`.
10. **[E] UUIDv7 primary keys, exposed in URLs.** Sortable by creation, not enumerable.

### 6.4 The assumption that needs your attention

Your brief says *"I organise it my way"* and Phase 2 promises *"inline edit of my own
fields"* — and it also says, in the constraints I must not route around, **"Do not modify the
player or its metadata. Title and thumbnail must be visible and unaltered."**

Those pull against each other. My reading: **I may add my own fields alongside YouTube's, but
I may not substitute mine for YouTube's in the UI.** So `sort_artist` and `note` exist for
sorting, grouping and searching, and the row still displays `snippet.title` and
`snippet.channelTitle` as the title/subtitle, with the real thumbnail.

That is the conservative reading and I am proceeding on it. It has a visible product cost:
you cannot rename "OFFICIAL VIDEO 4K REMASTER (HD)" to "Blue in Green" in the list. If you
wanted renaming, this is the assumption to challenge now — it is schema-and-UI deep, and it
is exactly what the compliance agent should adjudicate before Phase 3.

### Cheap

11. **[C]** Row treatment stays 1a; the filter chips stay the canvas's `RECENT / A–Z /
    ARTIST / OFFLINE` minus OFFLINE, with a replacement to be proposed later.
12. **[C]** The header's second figure — your brief defers this to the Phase 2 plan, so I am
    not choosing it here. Candidates worth costing then: unavailable count, total duration,
    channel count.
13. **[C]** `medium` (320×180) is the thumbnail size we store and crop.
14. **[C]** English only. Durations `M:SS`, `H:MM:SS` past an hour.
15. **[C]** `play_history.played_at` stored UTC, rendered in the browser's zone.
16. **[C]** `listener` may create playlists and favourites but not add or delete tracks.

---

## 7. What I could not verify, and what would settle it

| # | Unverified | What settles it |
|---|---|---|
| 1 | **The 50-ID limit on `videos.list`.** Not on the reference page I could fetch (it is JS-rendered and the fetch returned no `id` parameter detail). Consistently reported and long-standing. | Phase 2: send 50 IDs, then 51, and show both responses. The 51 case should fail outright. |
| 2 | **Whether a deleted vs a private video are distinguishable.** Both are expected to be simply absent from `items`, but I have not confirmed either, and §3 hangs on it. | Phase 2: request a known-deleted ID and a known-private ID in one batch and paste the raw JSON. |
| 3 | **That an API key alone needs no billing account.** Google's getting-started page is silent; my sources are secondary. | Phase 1: create the Cloud project and enable the API. If it demands a card, that is a stop-and-tell-you moment. |
| 4 | **The quota reset time and timezone.** Not stated on the page I read; widely reported as midnight Pacific. | Only matters for scheduling the cron; observable after one day of real use. |
| 5 | Whether requesting more `part` values changes the quota cost. The cost table is per-method and says 1 unit for `videos.list`; the page does not address parts explicitly. | Phase 2: compare quota consumption for `part=snippet` vs `part=snippet,contentDetails,status`. |
| 6 | Neon Marketplace allowances == Neon's own Free plan, and that Free needs no card. | Phase 1 provisioning. |
| 7 | **Vercel retains runtime logs for 1 hour on Hobby**, which constrains any "prove it from the logs" verification to a single continuous session. | Known, not a blocker — plan the verification accordingly. |
| 8 | **The `loop-engineering` skill your brief asks me to wrap verification in is not installed** on this machine. `coverage-analysis` is. | Point me at it, or I use `coverage-analysis` plus an explicit iterate-until-green loop written into each plan. |
| 9 | IFrame Player API behaviour on mobile — autoplay gating, whether `playVideo()` after a user-initiated first play survives a queue advance, and the `onError` code taxonomy. | Your brief already assigns this to the Phase 4 research agent and a real Android device. Not a Phase 0 answer. |

---

## 8. Decisions I made that you did not specify

| Decision | Alternative rejected |
|---|---|
| Thumbnails direct from `i.ytimg.com` via plain `<img>` + `object-fit: cover` | `next/image` — idiomatic, but meters against 5,000 Image Transformations/month and would re-encode a thumbnail the policies require to be unaltered. |
| Store the API-returned thumbnail URL | Construct `i.ytimg.com/vi/<id>/mqdefault.jpg` — fewer bytes, but silently 404s the whole library if the scheme ever changes. |
| Availability swept daily, descriptive metadata refreshed in the same call | Separate schedules — twice the quota and twice the cron, for no benefit, especially since Hobby allows only one daily cron anyway. |
| `duration_sec int`, parsed on ingest | Store raw ISO 8601 and parse on read. |
| Availability as an enum + timestamp on `tracks` | An append-only availability-check table — keeps history, but nothing in the brief needs it. |
| Stateless signed session cookie | DB-backed sessions — instant revocation, but the largest single driver of Neon compute (§5). **Still open for Phase 1.** |
| Batch `play_history`, flush on `visibilitychange`/`pagehide` | Write-per-play — exact, but converts listening time directly into compute time. Explicitly *not* a 5-minute timer. |
| Never persist raw `onStateChange` events | Logging them — useful for debugging, but hundreds of DB wakeups per session. |
| UUIDv7 keys | bigint serial (enumerable); UUIDv4 (no creation ordering, worse index locality). |
| No `albums`/`artists` tables | Modelling channel as an entity — YouTube has no album concept and a channel is one string. |

---

## 9. Quota and cost line for Phase 0

Nothing provisioned, no account created, no API enabled, no code written.

| Meter | Added by Phase 0 | Remaining |
|---|---|---|
| YouTube Data API units | **0** | 10,000/day |
| YouTube `search.list` calls | 0 | 100/day |
| Vercel — all meters | 0 | 100% |
| Neon storage / compute | 0 | 100% |

No meter above 50%. The one that can cross it is Neon compute under very heavy listening
(§5), and it is decided by choices made in Phase 1 — four phases before anything would
reveal the problem.

---

## 10. Commands to see this for yourself

```bash
# The design canvas, rendered (unchanged by the pivot)
open /Users/sotsys165/Projects/music-player/design/Music_Player_dc.html

# Confirm nothing is committed, so discarding the previous build costs nothing
git -C /Users/sotsys165/Projects/music-player rev-list --count HEAD   # expect: 0

# The quota structure — note the three separate buckets
open https://developers.google.com/youtube/v3/getting-started
open https://developers.google.com/youtube/v3/determine_quota_cost

# The exact metadata field paths in §2
open https://developers.google.com/youtube/v3/docs/videos

# The two free tiers
open https://vercel.com/docs/plans/hobby
open https://neon.com/docs/introduction/plans
```

Nothing to typecheck or lint that belongs to this architecture yet.

## Sources

- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/v3/determine_quota_cost
- https://developers.google.com/youtube/v3/docs/videos
- https://developers.google.com/youtube/v3/docs/videos/list
- https://vercel.com/docs/plans/hobby
- https://neon.com/docs/introduction/plans
