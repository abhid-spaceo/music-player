# Phase 0 — Grounding

Date: 2026-08-26. No code written. No service provisioned. All meters at 0%.

Every figure below is either (a) quoted from a doc I fetched today, with the URL, or
(b) arithmetic I show, or (c) explicitly flagged as unverified. Nothing is from memory.

---

## 0. Two things wrong with the brief's preconditions

**There is no repo.** The brief says "copy `Music_Player_dc.html` and `support.js` into
`design/` at the repo root". `git -C /Users/sotsys165 rev-parse --show-toplevel` →
`fatal: not a git repository`. No project directory exists anywhere under the home dir.
So `docs/build-log.md` has nowhere to live yet. **Blocking — I need the path.**

**The design export is elsewhere, under a different name.** Actual location:

```
/Users/sotsys165/Downloads/Music library interface design/
├── Music Player.dc.html   52,357 bytes   (brief calls it Music_Player_dc.html)
├── support.js             69,150 bytes
└── .thumbnail
```

I read the real file rather than assume. What it actually contains — 5 artboards
across 2 turns, confirmed by grepping the ids and labels:

| id | Label from the file |
|----|---------------------|
| 1a | Timetable. 56px rows, hairline rules, mono figures right-aligned. 11 rows visible. |
| 1b | ECM. 72px rows, 52px artwork, no rules — space does the separating. 8 rows visible. |
| 1c | Index. Type only — artwork reserved for the player. Alphabetical sections, A–Z rail. |
| 2a | Conventions layer. Header search, play-all + shuffle, overflow menus, 60px rows, downloaded pill. |
| 2b | Recent-items grid above the list — six tiles. |

Verified against the markup, not the labels:

- **1a rows are `height:56px; padding:0 22px; gap:12px`, artwork `40px×40px`** — matches
  the brief's spec exactly.
- **2a rows are `height:60px; padding:0 8px 0 22px`, artwork `42px×42px`** — the conflict
  the brief flags is real, and it is two values not one: row height *and* artwork size
  *and* right padding (8px vs 22px, to make room for the overflow button).
- Mini-player body in 1a: `height:62px`, play/pause button `46px×46px`. Matches.
- Tab bar buttons: `height:56px` inside the 84px bar. Matches.
- The canvas uses `{{ }}` bindings and `<sc-for list="{{ rows }}">` — it is a Claude
  Design canvas, not plain HTML. Values are extractable but the markup is not liftable
  as-is.

**One useful thing I found by reading rather than assuming:** the amber EQ bars over the
playing row's artwork are pure CSS keyframes — `animation:eq1 .9s ease-in-out infinite`,
three `<i>` elements at `width:3px; background:#FFB000`. They are **not** driven by real
audio analysis. That matters more than it looks: it means we never need the Web Audio
API, which means we never need `crossorigin` on the `<audio>` element, which means
playback has **no CORS dependency on the Blob origin at all**. See §2.4.

---

## 1. Cost ledger

### 1.1 Vercel Hobby — platform

Source: https://vercel.com/docs/plans/hobby (page's own `last_updated: 2026-06-16`)

| Resource | Hobby included | What we expect to use | Headroom |
|---|---|---|---|
| Function Invocations | First 1,000,000 | ~30k/mo (see §4) | ~97% |
| Active CPU | **4 CPU-hrs** | ~1 CPU-hr if artwork resize is server-side; ~0.1 if client-side | 75–97% |
| Provisioned Memory | 360 GB-hrs | small | large |
| Edge Requests | Up to 1,000,000 | ~150k/mo incl. range requests | ~85% |
| Projects | 200 | 1 | — |
| Deployments per day | 100 | maybe 20 on a heavy build day | fine |
| Function max duration | 300s | we need seconds, not minutes | fine |
| **Runtime Logs retention** | **1 hour** | — | **see §7** |
| Build vCPU / memory / disk | 2 / 8 GB / 32 GB | fine for Next.js | fine |

**Behaviour at the limit**, quoted verbatim: *"As the Hobby plan is a free tier there are
no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you
will have to wait until 30 days have passed before you can use the feature again."*

**Card required?** No. The card step appears only in the upgrade-to-Pro flow ("Enter your
card details" is step 5 of *Upgrading to Pro*). Nothing on Hobby asks for one.

**Non-commercial clause**, verbatim: *"As stated in the fair use guidelines, the Hobby
plan restricts users to non-commercial, personal use only."* A private ad-free player for
you and a handful of friends, not sold and not monetised, sits inside that. If money ever
touches it — even donations — the plan is wrong.

### 1.2 Vercel Blob

Source: https://vercel.com/docs/vercel-blob/usage-and-pricing (`last_updated: 2026-06-16`)

**Behaviour at the limit**, quoted verbatim: *"Vercel will send you emails as you are
nearing your usage limits. You **will not pay for any additional usage**. However, you
will not be able to access Vercel Blob if limits are exceeded. In this scenario, you will
have to wait until 30 days have passed before using Blob storage again."*

That confirms the brief's premise precisely: the failure mode is **the app going dark for
30 days**, not an invoice. Blob going dark means every track 403s while the app itself
still loads — which is exactly why the offline story in Phase 5 is a resilience feature,
not just a cost feature.

> ⚠ **The one number I could not verify from Vercel's own pages.** The brief states
> 1 GB storage and 10 GB transfer for Hobby Blob. **Neither figure appears on
> `/docs/plans/hobby` nor on `/docs/vercel-blob/usage-and-pricing`.** The Hobby
> included-usage table on the plans page simply does not list Blob rows, and the pricing
> page's worked example uses 5 GB / 100 GB included, which are Pro allocations, not Hobby.
> Third-party 2026 pricing write-ups do corroborate 1 GB / 10 GB. I am **proceeding on
> 1 GB / 10 GB** because that is what you specified and it is the conservative reading,
> but treat it as unconfirmed until you open the dashboard. It is the single most
> load-bearing number in the project, so §7 asks you to check it.

Also from that page, and relevant to us:

- Cache HITs do **not** count as Simple Operations and do **not** incur Fast Origin Transfer.
- Blobs are cached (CDN + browser) **up to 1 month by default**; configurable via
  `cacheControlMaxAge`, minimum 60s. Our tracks never change → set this to the max.
- Cache limit is **512 MB per blob**. Our tracks are ~5 MB. Never a factor.
- `del()` is **free**. So the reconciliation script costs nothing to run.
- **Dashboard browsing counts as Advanced Operations.** Poking at the store in the UI
  spends the same meter as the app. Worth knowing before you go clicking around.
- Hobby operation rate limits: 1,200 Simple/min, 1,500 Advanced/min (the limits page says
  1,500 for Hobby; the pricing page's table says 900 — **the two Vercel pages disagree**;
  either way it is orders of magnitude above what we will do).
- Client uploads incur **no** data-transfer charge. Server uploads incur Fast Data
  Transfer. This alone justifies the brief's "uploads bypass route handlers" rule on cost
  grounds as well as body-size grounds.

### 1.3 Neon Postgres (Free plan, via Vercel Marketplace)

Source: https://neon.com/docs/introduction/plans

| Resource | Free plan | Ours |
|---|---|---|
| Storage | **0.5 GB per project** | ~10 MB + ~7 MB/yr growth (§3) → **~2%** |
| Compute | **100 CU-hours per project per month** — "sufficient to run a 0.25 CU compute for 400 hours/month" | **~60% on a naive design (§4) — this is the tight meter** |
| Projects | 100 | 1 |
| Branches | 10 per project | 1–2 |
| Scale to zero | after 5 min inactivity, **cannot be disabled** | shapes everything (§4) |
| Public network transfer | **5 GB/month** | metadata JSON only, ~50 MB |

**Behaviour at the limit**, quoted: *"when you run out of CU-hours or public network
transfer, your compute is suspended until the next billing period or until you upgrade"*;
storage overage causes *"operations that increase storage (inserts, updates, and deletes)
to fail until you free space or upgrade"*; and *"None of these limits delete your data."*

So: exceeding Neon compute = the whole app 500s on every DB read, but data survives.
Exceeding Neon storage = reads work, writes fail. Different failure shapes, both worth
designing an error state for (the brief already asks for an error state in Phase 3).

**Card required?** Neon's docs say the Free plan needs no credit card and the search
corroborates "with no credit card required". I did not see this stated in the fetched
plans page itself, so: **low-confidence yes-it's-free, unverified on card.** Provisioning
through the Vercel Marketplace in Phase 1 will settle it in about ten seconds, and if it
asks for a card, that is a stop-and-tell-you moment per the brief.

> ⚠ Unverified: whether the **Vercel Marketplace** Neon plan carries identical allowances
> to Neon's own Free plan. The brief's 0.5 GB / 100 compute-hours matches Neon's own Free
> plan exactly, so I believe they are the same integration, but I have not confirmed the
> marketplace listing.

> ⚠ Unverified: Neon counts **history/WAL retention** toward storage. I do not know the
> Free-plan retention window, so my 0.5 GB headroom figure may be optimistic by some
> constant. Given we are at ~2% of the allowance, even a 10× error leaves us fine.

### 1.4 Fonts

Instrument Sans + IBM Plex Mono, self-hosted per the brief. Google Fonts is only a build-
time download. Zero recurring meter, zero third-party runtime request, and it removes the
one external origin the app would otherwise depend on. Free.

### 1.5 Ledger summary — is any meter over 50%?

| Meter | Projected | Over 50%? |
|---|---|---|
| Blob storage | 800 MB of 1 GB *by design ceiling* | **80% — but that is the intended ceiling, not an overrun** |
| Blob transfer | 4–8 GB of 10 GB, **entirely dependent on the caching strategy** | **40–80% — the single biggest risk** |
| Neon storage | ~2% | no |
| **Neon compute** | **~60% naive, ~25% with the mitigations in §4** | **yes on the naive design — flagged** |
| Vercel Active CPU | 3–25% | no |
| Edge Requests | ~15% | no |
| Function invocations | ~3% | no |

Two meters need decisions made **now**, not later: **Blob transfer** (settled by the
Phase 5 caching strategy, but constrained by the Phase 2 access model) and **Neon
compute** (settled by the Phase 1 session design). Both are cheap to get right today and
expensive to retrofit.

---

## 2. The Blob access model

### 2.1 The three options, and what each actually costs

I found a third model the brief does not mention, and it is the right one.

**A — Public store, unguessable URLs** (`access: 'public'`, `addRandomSuffix: true`).
URL form: `https://<store-id>.public.blob.vercel-storage.com/<pathname>`. Permanent, never
expires. Browser fetches direct from the CDN, so range requests and seeking are the
browser's native behaviour and we write no code for them.
Cost: Blob Data Transfer + Fast Origin Transfer on cache miss. Cheapest option — the docs
say BDT is *"3x more cost-efficient than Fast Data Transfer on average"*.
Security: obscurity only. The docs are blunt that these URLs *"can still be indexed by
search engines"* if ever linked, and by default Blob serves no `robots.txt`. For a private
library, one leaked URL is permanently public with no revocation.

**B — Private store, proxied through a route handler.** Bytes flow store → Function →
browser. **Rejected.** It contradicts the brief's whole posture, and concretely:
- We pay twice — Blob Data Transfer *and* Fast Data Transfer, plus Fast Origin Transfer on
  both hops.
- Every second of audio streamed burns **Active CPU**, and Hobby gives only **4 CPU-hrs**.
- We would have to implement `Range` → `206` + `Content-Range` by hand in the handler.
  Getting that subtly wrong is the exact failure the brief names as risk #1.
- The docs themselves say *"We do not recommend serving files larger than 100 MB through
  private Blob stores unless traffic is low"* — we are under that, but the direction of the
  advice is clear.

**C — Private store + presigned GET URLs.** Source:
https://vercel.com/docs/vercel-blob/vercel-signed-urls
Server authenticates the session, calls `issueSignedToken({ operations: ['get'] })` then
`presignUrl(token, { operation: 'get', pathname, access: 'private' })`, and hands the
resulting URL to the client. The **CDN verifies the signature** — quoting the docs, this
lets you *"embed a private blob in a server-rendered page without proxying bytes through
your function."* So bytes go store → browser directly, billed at the cheap BDT rate,
native range/seek preserved, and access is genuinely authenticated rather than obscured.

**Recommendation: C.** It is the only option that gets real auth *and* keeps audio bytes
out of Functions *and* keeps seeking as the browser's problem rather than ours.

### 2.2 What happens to a URL mid-track — the honest answer

This is the question that matters, and the answer is a genuine hazard.

Documented facts: `issueSignedToken`'s `validUntil` is *"a timestamp in milliseconds since
the epoch when the token expires. **Maximum 7 days from now. Defaults to 1 hour from
now.**"* A per-URL `validUntil` on `presignUrl` is *"capped to the delegation's
validUntil"* and travels as the signed `vercel-blob-valid-until` query parameter.

Now the part the docs do not spell out but which follows from how `<audio>` works. A
single track is **not one HTTP request**. The element issues:
1. an opening request (often `Range: bytes=0-` or a small probe),
2. further range requests as the buffer drains,
3. a fresh range request on **every seek**,
4. a fresh request if the browser drops the connection and resumes.

The signature is checked **per request**. So:

- A response already in flight when the URL expires **completes normally**.
- Any *subsequent* request **fails**. The browser surfaces that as a stall or an `error`
  event, and the `<audio>` element has no concept of re-signing its own `src`.
- Concrete failure: sign a URL for 5 minutes, and a 6-minute track dies on the seek the
  listener makes at minute five. Worse, it can die on a *buffer refill* with no user
  action at all — which reads as "the app randomly stops".

Mitigations, to be built in Phase 4 and tested:
1. **Sign generously.** `validUntil = now + 8h`, well inside the 7-day max. A signed URL
   should outlive any plausible single listening session by a wide margin.
2. **Never swap `src` mid-track.** Acquire the URL when the track is queued, not while it
   plays.
3. **Build the recovery path explicitly.** On `error`/`stalled`, remember `currentTime`,
   request a fresh presigned URL, reassign `src`, seek back, resume. This is testable and
   must be tested — it is not a theoretical edge case, it is what happens to anyone who
   leaves a tab open overnight.
4. **Cache the delegation token server-side.** The docs say `issueSignedToken` *"calls the
   Blob control API, so cache the result and reuse it across requests until it's near
   expiry to avoid a network round-trip on every URL you sign."* Skipping this would add a
   network hop and an Advanced Operation to every single track start.

One more documented wrinkle: presigned GETs are served through the CDN cache and *"when
you overwrite a blob at the same pathname, the changes may take up to 60 seconds to
propagate"*. We will use `addRandomSuffix: true` and never overwrite, so this never bites
us — but it is why "never overwrite, always new pathname" should be a rule from Phase 2.

### 2.3 What I could not verify about Blob, and it matters

**Does the Blob CDN honour `Range` and return `206 Partial Content`?** Not stated on any
of the four Blob pages I read. It is near-certain that it does — every media CDN does, and
seeking in `<audio>` from an ordinary URL would be broken otherwise — but "near-certain"
is not verified, and the brief's risk #1 is exactly this. The Phase 2 verification the
brief already demands (`curl -H "Range: bytes=0-1023"` → expect `206` +
`Content-Range: bytes 0-1023/<size>`) is the first real gate of the project. **If that
returns `200`, the architecture changes**, so it should be the very first thing tested
after the first upload lands — before any player code is written.

**What CORS headers does the Blob origin return?** Also not stated. See §2.4 for why the
answer is needed for Phase 5 but not for Phase 4.

### 2.4 Cross-origin audio — Phase 2, as the brief demands

The brief is right that this belongs in Phase 2, and the answer splits in two:

- **Playback does not need CORS.** An `<audio>` element loading a cross-origin URL
  *without* the `crossorigin` attribute is an ordinary no-CORS media load; it works, and
  seeking works. We only need `crossorigin="anonymous"` if we read the samples — Web Audio
  API or canvas. And per §0, **we don't**: the design's EQ animation is CSS keyframes.
  So the safe default is to **omit `crossorigin` entirely**. Setting it unnecessarily is
  actively harmful — it turns the load into a CORS-checked request that *fails* if the
  origin does not send `Access-Control-Allow-Origin`.
- **The Phase 5 download queue does need CORS.** Downloading a track for offline use means
  `fetch()`ing the blob URL from our origin and writing the bytes to IndexedDB. That is a
  CORS-governed request. If the Blob origin does not send a permissive
  `Access-Control-Allow-Origin`, `fetch` fails and the offline feature — the project's
  main transfer control — does not work in its intended form.

So the Phase 2 verification must capture **both**: response headers on a plain `curl -I`
(looking for `access-control-allow-origin`, `accept-ranges`, `etag`, `cache-control`,
`content-type`) *and* a real cross-origin `fetch()` from a browser page on a different
origin. Header inspection alone will not prove the browser path.

---

## 3. Schema, sized against 0.5 GB

Eight tables from the brief, plus `sessions` (needed by the cookie auth) and
`schema_migrations`. Postgres, `citext` for email, UUIDv7 primary keys.

```
users            id, email(uniq), password_hash, role('admin'|'listener'),
                 display_name, created_at, last_login_at, failed_login_count,
                 locked_until
artists          id, name, sort_name, created_at
albums           id, artist_id→artists, title, sort_title, year,
                 artwork_base_path, created_at
tracks           id, album_id→albums NULL, artist_id→artists, title,
                 track_no, disc_no, duration_ms, blob_pathname(uniq),
                 byte_size, content_type, bitrate_kbps, sample_rate,
                 artwork_base_path, created_at, updated_at, uploaded_by→users
playlists        id, owner_id→users, name, description, created_at, updated_at
playlist_tracks  playlist_id→playlists, track_id→tracks, position,
                 added_at   PK(playlist_id, track_id)   UNIQUE(playlist_id, position)
favourites       user_id→users, track_id→tracks, created_at   PK(user_id, track_id)
play_history     id, user_id→users, track_id→tracks, played_at,
                 ms_played, completed bool, source
sessions         id, user_id→users, expires_at, created_at,
                 user_agent_hash, revoked_at        (see §4 — may not be needed)
```

Indexes that matter: `tracks(album_id)`, `tracks(artist_id)`,
`tracks(lower(title))` for search, `playlist_tracks(playlist_id, position)`,
`play_history(user_id, played_at DESC)`, `sessions(expires_at)` for sweeping.

### Sizing

Row-count assumptions: 142 tracks (the figure the design's own header uses), ~50 albums,
~70 artists, 6 users, 30 playlists averaging 30 entries, 400 favourites.

| Table | Rows | ~bytes/row incl. 23-byte header | Total |
|---|---|---|---|
| users | 6 | 250 | 1.5 KB |
| artists | 70 | 120 | 8 KB |
| albums | 50 | 220 | 11 KB |
| tracks | 142 | 700 | 99 KB |
| playlists | 30 | 200 | 6 KB |
| playlist_tracks | 900 | 60 | 54 KB |
| favourites | 400 | 55 | 22 KB |
| sessions | ~20 live | 150 | 3 KB |
| **subtotal** | | | **~205 KB** |
| indexes (~1× data) | | | ~205 KB |
| per-table page floor, 10 tables + ~15 indexes | | 8 KB each | ~200 KB |
| **static total** | | | **~0.6 MB** |

`play_history` is the only table that grows without bound. 6 users × 25 plays/day = 150
rows/day = **54,750 rows/year**, at ~70 bytes + a comparable index → **~7.7 MB/year**.

**Verdict: ~0.6 MB static + ~7.7 MB/year. Against 0.5 GB that is ~1.7% at year one and
~14% at year ten.** Neon storage is a non-issue and needs no pruning policy. If you ever
want one anyway, `play_history` older than 2 years is the only candidate.

The real lesson from this table: **Neon's constraint is compute, not storage** — which is
the opposite of Blob, where the constraint is storage and transfer. Worth internalising,
because it means the temptation to "just add a table" is nearly free while the temptation
to "just add a query" is not.

---

## 4. Neon compute budget, and what in the design holds the database awake

100 CU-hours/month. Free compute has a 0.25 CU floor, so — per Neon's own gloss —
that is **400 wall-clock hours of an awake database**. A month is ~730 hours. **The
database can be awake about 55% of the month, and no more.**

Scale-to-zero fires after 5 minutes idle and **cannot be disabled**. So every burst of
activity costs *its own duration plus a 5-minute tail*. Short, scattered sessions are
disproportionately expensive: ten 1-minute visits spread through a day cost ~60 minutes of
awake time, not 10.

### What in this design holds it awake — ranked by damage

1. **DB-backed session validation on every request.** The worst offender by a wide
   margin, and the easiest to walk into. If every page load and every API call reads a
   `sessions` row, then *every* interaction wakes the compute. This alone could put us
   over.
2. **`play_history` written at every track start.** A 45-minute listening session becomes
   45 minutes of continuously-woken compute — one write every ~4 minutes, each resetting
   the 5-minute idle timer. This is the design feature that most directly converts
   listening time into compute time.
3. **A query library's default refetching.** React Query defaults
   `refetchOnWindowFocus: true`. Every tab-back wakes the DB. Any `refetchInterval`
   anywhere is a standing alarm clock. The brief asks for "server state through a query
   library with real cache invalidation" in Phase 3 — the invalidation policy is therefore
   a *cost* decision, not only a correctness one.
4. **Search-as-you-type against Postgres.** Phase 6. Even debounced, an eight-character
   query is several round trips, and it happens during otherwise-idle browsing.
5. **The admin usage panel.** `SUM(byte_size)` on every admin page load. Cheap per call,
   but it wakes a sleeping compute, which is the expensive part.
6. **The library screen's `"142 TRACKS · 9 OFFLINE"` header.** The track count is a
   `COUNT(*)`, and it is on the first screen of the app. Every cold app open wakes the DB
   before the user has done anything.

### The naive budget

6 users × two 45-minute sessions/day, poorly overlapped:
`6 × 2 × (45 + 5) min = 600 min/day = 10 h/day = 300 h/month`
→ at 0.25 CU = **75 CU-hours = 75% of the allowance.** Over the brief's 50% line, and
close enough to 100% that a busy month goes dark.

### The mitigated budget

1. **Stateless signed session cookies** — HMAC-signed, carrying `user_id`, `role` and
   `exp`, verified with a secret and no DB read. Removes offender #1 entirely.
   *Trade-off you should know about:* revocation becomes lazy. Demoting an admin or
   kicking a user does not take effect until their cookie expires, unless we add a
   revocation check — which reintroduces the DB read. Mitigation is a short cookie
   lifetime (e.g. 12h) plus a `session_version` integer on the user that is only read on
   refresh, not on every request. **This is a real security-vs-cost trade-off and it is
   yours to make, not mine — I will put it in the Phase 1 plan as an explicit choice.**
2. **Batch `play_history`.** Buffer plays client-side, flush on a 5-minute timer, on
   `visibilitychange`, and on `pagehide`. Turns ~12 wakeups per session into 2–3.
3. **`refetchOnWindowFocus: false`, no polling anywhere**, long `staleTime` on library
   data (the library changes only when *you* upload something).
4. **Offline-first reads.** A listener playing from IndexedDB touches neither Blob nor
   Neon. Phase 5's downloads protect the *compute* meter as well as the transfer meter —
   which the brief did not anticipate, and which strengthens the case for building it.
5. **Cache the track count.** Denormalise into a tiny `library_stats` row, or serve it
   from the same cached payload as the first page of tracks.

Mitigated: ~2–3 wakeups per session × 6 users × 2 sessions × ~8 min effective
≈ **90–110 h/month ≈ 25 CU-hours ≈ 25%.** Comfortably inside the allowance.

**This is the most important finding in Phase 0.** The tightest meter in the project is
not the one the brief is organised around. Blob storage is bounded by a code ceiling we
control; Blob transfer is bounded by a caching strategy we control. Neon compute is
bounded by *how the app talks to its database on every request* — and that is decided in
Phase 1, four phases before anything would reveal the problem.

---

## 5. Bitrate and the resulting track count

### Recommendation: AAC-LC in MP4/M4A, 192 kbps VBR, with `-movflags +faststart`.

Arithmetic, at a 4-minute (240s) average track, decimal MB:

| Bitrate | MB/track | Tracks in 800 MB | Tracks in 1 GB |
|---|---|---|---|
| 128 kbps | 3.84 | 208 | 260 |
| 160 kbps | 4.80 | 166 | 208 |
| **192 kbps** | **5.76** | **≈139 (142 with VBR undershoot)** | **174** |
| 256 kbps | 7.68 | 104 | 130 |
| 320 kbps | 9.60 | 83 | 104 |

Add ~95 KB/track of artwork (three WebP variants at 128/256/512 px), ~13 MB across the
library — under 2% of the ceiling, and I have folded it into the 139-vs-142 figure above.

**Why 192 kbps AAC:**

- It lands almost exactly on the library size the design already assumes. The 1a artboard
  header reads `"142 TRACKS · 9 OFFLINE"`. At 192 kbps VBR inside an 800 MB ceiling you get
  ~142 tracks. The design and the storage budget agree, which is a good sign that 800 MB is
  the right default ceiling rather than an arbitrary one.
- AAC-LC at 192 kbps is transparent-to-near-transparent for most listeners, and beats MP3
  at the same rate. 256 and 320 buy little audible quality and cost a third of the library.
- iOS Safari is a hard requirement here and AAC is its native format. No codec risk.

**The detail that will bite if ignored:** an M4A file keeps its index in the `moov` atom,
and if that atom sits at the *end* of the file, the browser must fetch the tail (or the
whole file) before it can seek — which quietly defeats range requests and makes seeking
feel broken. **`ffmpeg -movflags +faststart` moves it to the front.** Every file must be
encoded that way, and it should be asserted on ingest in Phase 2, not assumed.

If you would rather not depend on that, MP3 at 192 kbps with a proper Xing/LAME VBR header
seeks reliably without a faststart step, at slightly worse quality-per-bit. I would still
pick AAC; flagging the alternative because reversing this after upload means re-encoding
and re-uploading the entire library.

### Transfer arithmetic — why the offline story is the whole ballgame

At 5.76 MB/track against 10 GB/month:

- **Streaming everything, nothing cached:** 10,240 ÷ 5.76 = **1,777 track plays/month
  total**, across all users. Six users → ~296 plays each → **~10 plays/day each.** One
  enthusiastic weekend blows a hole in it.
- **Realistic naive load:** 6 users × 20 plays/day × 30 days × 5.76 MB = **20.7 GB.**
  **207% of the allowance — the app goes dark around day 15.** This is not a hypothetical;
  it is what "just stream it" produces at this library size.
- **With offline-first:** the entire 142-track library downloaded once is 800 MB = **8% of
  the monthly transfer.** All six users downloading everything = 4.8 GB = **48%** — and
  after that, plays are free. Realistically each user wants a slice, not the whole library,
  so the true figure is well under 20%.
- **Browser cache alone** (`cacheControlMaxAge` at the 1-month maximum) already
  de-duplicates repeat plays *within* a browser without any Service Worker. Free win, must
  be set at upload time in Phase 2.

So: **a track downloaded once and played fifty times costs one transfer instead of fifty —
that is a 50× reduction on repeat listening, and it is the difference between ~207% and
~20% of the allowance.** I will report the actual measured figure in Phase 5 as the brief
requires, but the direction is not in doubt, and it means the Phase 5 caching design is
the load-bearing cost control of the project — not an optional nicety.

---

## 6. Assumptions I am making that you did not state

Marked **[E]** expensive to reverse after Phase 3, **[C]** cheap.

### Expensive — decide these before Phase 1 ships

1. **[E] Blob access model = private store + presigned GET URLs (§2.1 option C).**
   Alternative rejected: public unguessable URLs (simpler and cheaper, but unrevocable and
   indexable). Touches Phase 2 upload, Phase 4 `src` acquisition, Phase 5 SW and download
   queue. **In the questions below.**
2. **[E] Sessions are stateless signed cookies, not DB rows.** Driven by §4. Costs lazy
   revocation. Touches every route in the app.
3. **[E] One shared library, single-tenant.** No per-user libraries, no `owner_id` on
   `tracks`. Reversing means a migration plus an authorisation rule on every read.
4. **[E] Track is the atomic unit; `album` and `artist` are optional metadata.** A track
   with no album is valid and browsable. The alternative (album-first) reshapes the schema
   and the browse screens.
5. **[E] UUIDv7 primary keys, exposed in URLs.** Sortable by creation, no enumeration.
   Reversing means rewriting every URL and every IndexedDB key.
6. **[E] One encoding per track — 192 kbps AAC. No transcoding, no multi-bitrate.**
   Reversing means re-encoding and re-uploading everything, and 800 MB of re-upload.
7. **[E] `addRandomSuffix: true`, blobs are never overwritten.** Edits create a new blob
   and delete the old. Sidesteps the documented 60-second cache-propagation window.
8. **[E] No email service, therefore no self-service password reset.** "Accounts are
   created by me" implies you also reset passwords by hand. Fine at six users; a real hole
   if the group grows. Adding email later means a new provider and a new meter.
9. **[E] Artwork is resized client-side in the browser before upload**, not server-side.
   Keeps image bytes out of Functions and off the Active CPU meter (only 4 CPU-hrs), and
   is consistent with the brief's "uploads bypass route handlers" rule. Alternative
   rejected: `sharp` in a route handler — simpler to reason about, but pushes both bytes
   and CPU through the thing we are trying to keep audio out of.
10. **[E] The offline metadata store in IndexedDB mirrors the API's track shape.**
    Phase 5's offline browsing and Phase 6's offline search both read it. Its shape is
    decided in Phase 5 but constrained by the API shape chosen in Phase 2.

### Cheap

11. **[C]** Row treatment stays 1a; switching to 1b/1c is a row-component swap.
12. **[C]** Filter chips are `ALL / ALBUMS / ARTISTS / DOWNLOADED` until you say otherwise.
13. **[C]** English only, no i18n. Durations as `M:SS`, `H:MM:SS` past an hour.
14. **[C]** `play_history.played_at` stored UTC, rendered in the browser's zone.
15. **[C]** `listener` can create playlists and favourites but cannot delete tracks.
16. **[C]** Library sort defaults to recently-added; the design does not say.

### One coupling worth raising now

**The library header shows an offline count before offline exists.** The 1a artboard's
header reads `"142 TRACKS · 9 OFFLINE"`, but downloads are not built until Phase 5, and
Phase 3 requires every screen rendered with all states. So in Phase 3 that figure is
either hard-zero, or the IndexedDB-backed offline store must be stubbed early. It also
means the library screen cannot render its header from server data alone — it needs local
device state at first paint, in every phase from 3 onward. I will propose the resolution
in the Phase 3 plan rather than silently picking one.

---

## 7. What I could not verify, and what would settle it

| # | Unverified | What would settle it |
|---|---|---|
| 1 | **Hobby Blob included storage/transfer = 1 GB / 10 GB.** Not on Vercel's Hobby page or Blob pricing page. | Open the Vercel dashboard → Usage, and paste the Blob rows with their allowances. **Highest priority — it is the project's binding constraint.** |
| 2 | **Blob honours `Range` and returns `206` + `Content-Range`.** Not documented on any Blob page. | Phase 2: `curl -I` and `curl -r 0-1023 -D -` against a real uploaded track. First gate after the first upload. |
| 3 | **CORS headers on the Blob origin.** Not documented. | Same `curl -I` for `access-control-allow-origin`, plus a real cross-origin `fetch()` from a browser page — headers alone don't prove the browser path. |
| 4 | Neon Marketplace allowances == Neon's own Free plan. | Provision in Phase 1 and read the plan page. |
| 5 | Neon Free needs no card. | Same moment. If it asks for one, I stop and tell you. |
| 6 | Neon history/WAL retention counted toward the 0.5 GB. | Neon dashboard after a week of real data. Low stakes — we are at ~2%. |
| 7 | Vercel's two pages disagree on Hobby Blob Advanced Operations (900/min vs 1,500/min). | Irrelevant at our scale; noting it so neither figure gets quoted as gospel later. |
| 8 | **`onUploadCompleted` does not fire on `localhost`** — documented, and it means the Phase 2 happy path cannot be fully exercised locally. Docs prescribe a tunnel: `VERCEL_BLOB_CALLBACK_URL=https://<id>.ngrok-free.app`. | Phase 2 needs either ngrok or a preview deployment. **Tell me which you'd rather** — it changes the Phase 2 verification commands. |
| 9 | **Vercel runtime logs retain only 1 hour on Hobby.** The brief's Phase 2 check "confirm from function logs that audio bytes never passed through a route handler" must be read **within the hour** of the upload. | Plan the Phase 2 verification as one continuous session, or capture the evidence some other way (response headers + the absence of a body-reading handler in the diff). |
| 10 | The `loop-engineering` skill the brief asks me to wrap verification in **is not installed** on this machine. `coverage-analysis` is. | Point me at it, or accept that I use `coverage-analysis` plus an explicit iterate-until-green loop that I write out in each plan. |
| 11 | Real average track duration and count for *your* library. All my arithmetic assumes 4 minutes. | Your answer; a jazz or classical library at 8–12 minutes/track halves the track count. |

---

## 8. Decisions I made that you did not specify

| Decision | Alternative rejected, and why |
|---|---|
| Private Blob store + presigned GET | Public unguessable URLs — simpler, cheaper, no expiry handling, but unrevocable and indexable. Proxy-through-Function — real auth, but doubles transfer cost, burns the 4 CPU-hr Active CPU meter, and makes `206` our bug to write. |
| 192 kbps AAC-LC, `+faststart` | 128k (208 tracks, audibly worse); 320k (83 tracks, inaudibly better); MP3 (no faststart worry, worse per bit); Opus (best per bit, but iOS Safari support is the one thing I will not gamble on here). |
| Stateless signed session cookie | DB-backed sessions — instant revocation, but §4 shows it is the single biggest driver of Neon compute. |
| UUIDv7 keys | bigint serial (enumerable in URLs); UUIDv4 (no creation ordering, worse index locality). |
| Client-side artwork resize | `sharp` in a route handler — simpler, but pushes bytes and CPU through Functions. |
| Batched `play_history` | Write-per-play — simpler and exact, but converts listening time directly into compute time. |
| `library_stats` denormalised counter | `COUNT(*)` on every library load — wakes a sleeping DB on every cold open. |
| Blobs never overwritten | Overwrite in place — fewer orphans, but hits the documented 60s cache-propagation window. |

---

## 9. Cost line for Phase 0

Nothing provisioned, nothing deployed, no account touched, no code written.

| Meter | Added by Phase 0 | Remaining headroom |
|---|---|---|
| Blob storage | 0 | 100% |
| Blob transfer | 0 | 100% |
| Blob operations | 0 | 100% |
| Neon storage | 0 | 100% |
| Neon compute | 0 | 100% |
| Vercel Active CPU / invocations / edge requests | 0 | 100% |

No meter above 50%. **Projected** meters that will need watching are in §1.5, and two of
them (Blob transfer, Neon compute) are decided by choices made in Phases 1–2 rather than
by anything Phase 0 did.

---

## 10. Commands to see this for yourself

```bash
# 1. Open the design canvas as rendered (this is the real filename — note the spaces)
open "/Users/sotsys165/Downloads/Music library interface design/Music Player.dc.html"

# 2. Confirm 1a is 56px rows / 40px artwork, and 2a is 60px / 42px
F="/Users/sotsys165/Downloads/Music library interface design/Music Player.dc.html"
awk '/id="1a"/,/id="1b"/' "$F" | grep -oE 'height:5[0-9]px|width:40px;height:40px' | sort -u
awk '/id="2a"/,/id="2b"/' "$F" | grep -oE 'height:6[0-9]px|width:42px;height:42px' | sort -u

# 3. Confirm the EQ bars are CSS-only (no Web Audio, hence no crossorigin needed)
grep -o 'animation:eq[0-9][^;"]*' "$F" | sort -u

# 4. Confirm there is no repo yet
git -C /Users/sotsys165 rev-parse --show-toplevel   # expect: fatal: not a git repository

# 5. The pages every number above came from
open https://vercel.com/docs/plans/hobby
open https://vercel.com/docs/vercel-blob/usage-and-pricing
open https://vercel.com/docs/vercel-blob/vercel-signed-urls
open https://vercel.com/docs/vercel-blob/client-upload
open https://neon.com/docs/introduction/plans

# 6. The one number to check in your own dashboard (see §7 item 1)
open https://vercel.com/account/usage
```

There is nothing to typecheck or lint — no code exists.

## Sources

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits
- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/docs/vercel-blob/public-storage
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/vercel-blob/vercel-signed-urls
- https://vercel.com/docs/vercel-blob/client-upload
- https://neon.com/docs/introduction/plans
- https://neon.com/pricing

---

## 11. Addendum — the three answers, and the revised ledger

Answered after the document above was written:

- **Repo:** `/Users/sotsys165/Projects/music-player`
- **Users: 1 (just you)** — I had assumed 6
- **Blob access: private store + presigned GET** — recommendation accepted

### The user count changes the conclusion, and it is worth saying plainly

Recomputing every figure at one user instead of six:

| Meter | 6 users (as written above) | **1 user** | Note |
|---|---|---|---|
| Blob storage | 78% of 1 GB | **78%** | unchanged — a code ceiling, not a usage figure |
| Blob transfer, naive streaming | 207% — dark ~day 15 | **35%** (20 plays/day) | 1 × 20 × 30 × 5.76 MB = 3.46 GB |
| Blob transfer, heavy streaming | — | **69%** (40 plays/day) | 6.9 GB |
| Blob transfer, whole library downloaded once | 48% | **8%** | 800 MB |
| Neon compute, moderate (2×45 min/day) | 75% | **12.5%** | 1×2×50 min/day = 50 h/mo ÷ 0.25 CU |
| Neon compute, heavy (4 h/day) | — | **31%** | 123 h/mo |
| Neon compute, very heavy (8 h/day) | — | **61%** | 243 h/mo — still the one that can bite |
| Neon storage | 1.7% yr 1 | **~0.4% yr 1** | play_history ≈ 1.3 MB/yr at 25 plays/day |

**The honest consequence: at one user, only Blob storage is tight — and it is tight by
design, not by overrun. Nothing else comes near 50% under normal use.**

Two corrections to premises this forces, which I would rather state than bury:

1. **The brief's claim that "offline downloads are a transfer control" is largely no longer
   true at this scale.** At six users, streaming everything was 207% of the transfer
   allowance and offline was the difference between working and dark. At one user, naive
   streaming is ~35% and the ceiling is never threatened. **Offline is now primarily a
   feature — listening on a plane or the Underground — rather than a cost control.** It is
   still worth building exactly as specified, and I will still report the measured transfer
   delta in Phase 5 as required. But the justification has changed, and the Phase 5 design
   should not contort itself to save transfer that is not at risk. That matters concretely:
   it removes any temptation to have the Service Worker intercept audio for cost reasons,
   which is precisely the thing the brief's risk #1 warns against.
2. **The Neon compute mitigations drop from "required" to "recommended" — with one
   exception.** Stateless signed cookies, batched `play_history` and disabled
   `refetchOnWindowFocus` are no longer load-bearing at 12.5%. But at 8 hours of listening
   a day the figure is 61%, over the brief's line, and heavy daily listening is a
   *plausible* pattern for a personal music player rather than an extreme one. So I still
   recommend all four mitigations — they cost nothing to adopt now and they are the
   difference between 61% and ~25% in the one usage pattern that actually threatens the
   meter. The session-model trade-off in §4 remains yours to decide in the Phase 1 plan.

### One consequence of "1 user" for Phase 1

The brief specifies two roles and requires a Phase 1 verification that *"a listener
session on an admin route returns 403"*. That check needs a second account regardless of
how many humans exist. So Phase 1 seeds **one admin (you) plus one listener account used
for verification** — the role separation gets built and tested as specified even though
only one person uses the app.

### Blob access model — confirmed, and the Phase 5 cost of it

Private store + presigned GET is settled. Recording the debt it creates, so Phase 5 does
not discover it:

- The **download queue** must `fetch()` a presigned URL and write bytes to IndexedDB. That
  is a CORS-governed request against the Blob origin, and §2.3 item 3 is still unverified.
- A presigned URL carries a signed `vercel-blob-valid-until` query parameter, so **the URL
  is not a stable cache key.** Anything that caches by URL — the Service Worker's Cache
  Storage included — will treat the same track signed twice as two entries. This is a
  second, independent reason for the Service Worker not to touch audio at all, and for the
  offline copy to live in IndexedDB keyed by track id rather than by URL.
- The mid-track re-signing recovery path in §2.2 must exist before Phase 5, because a
  download interrupted and resumed hours later hits exactly the same expiry wall.
