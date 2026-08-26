# Phase 0 — review agent findings, verbatim

Reproduced exactly as returned, including the finding I dispute (C2) and the one that
inherits an error of mine (C3's 180% figure). My adjudication, with verification
evidence, is in `phase-0-review-adjudication.md`.

The reviewer was a fresh subagent with no sight of the drafting conversation. It was
given the brief, the design-system spec, the document, and instructions to independently
re-fetch every cited source, recheck every calculation, verify the design-file claims
against the actual file, find omissions, and challenge the recommendations.

---

## CRITICAL

**C1 — §1.2 / §7 item 1: The "one number I could not verify" is printed on the page the document cites.**

The document says:

> "**The one number I could not verify from Vercel's own pages.** The brief states 1 GB storage and 10 GB transfer for Hobby Blob. **Neither figure appears on `/docs/plans/hobby` nor on `/docs/vercel-blob/usage-and-pricing`.**"

Both figures are in the "Managed Infrastructure pricing" table on `/docs/vercel-blob/usage-and-pricing`, in a column headed **"Hobby Included"**. Raw table cells as fetched today:

```
ROW: Resource | Hobby Included | Pro Included | On-demand Rates
ROW: Blob Storage Size        | 1GB/month    | | $0.023 per GB
ROW: Blob Simple Operations   | First 10,000 | | $0.400 per 1M
ROW: Blob Advanced Operations | First 2,000  | | $5.000 per 1M
ROW: Blob Data Transfer       | First 10 GB  | | $0.050 per GB
```

That table sits directly **above** the "Usage details" bullet list from which the document quotes four separate facts ("Cache HITs do not count as Simple Operations", "512 MB per blob", "`del()` operations are free", "Dashboard interactions count as operations"). It read past the table to quote the bullets under it.

Consequence: §7 item 1 — "**Highest priority — it is the project's binding constraint**" — is a manufactured blocker, and the reader is told to go check a dashboard for a number the cited doc states plainly.

**C2 — §1.2 / §7 item 1: the supporting claim about the worked example is false.**

> "the pricing page's worked example uses 5 GB / 100 GB included, which are Pro allocations, not Hobby."

There is no 5 GB or 100 GB anywhere in that example. `grep -nE '5 ?GB|100 ?GB'` over the page text returns one hit: "105 GB (30% cache MISSes of 350 GB)". The actual example is: "your storage averages 50 GB… 2.5 million [downloads]… for a total of 350 GB of data transfer", and the only "included" figure in it is "Edge Requests: 2.5M requests (all downloads) - 10M included = $0.00". The document invented the evidence for its own caveat.

**C3 — §1.2 / §1.5 / §9: two hard Blob free allowances are absent from the cost ledger entirely.**

`Blob Simple Operations: First 10,000` and `Blob Advanced Operations: First 2,000` per month are free allowances with the same 30-day-lockout failure mode as storage and transfer. The brief requires the ledger to cover "every service with a free allowance: expected usage, headroom, behaviour at the limit". The §1.2 table has no rows for them, §1.5's summary omits them, and §9 lists "Blob operations | 0 | 100%" without ever stating the denominator.

This is not academic — it inverts one of the document's own conclusions:

- §2.2 mitigation 4 says failing to cache the delegation token "would add a network hop **and an Advanced Operation** to every single track start." At the document's own §5 load (6 users × 20 plays/day × 30 = 3,600 plays/month), that is **3,600 Advanced Operations against 2,000 included = 180%**. Caching the delegation token is not a latency nicety; it is the difference between working and a 30-day Blob lockout. The document could not say this because it never established the 2,000 cap.
- Bulk-loading the library is 142 audio `put()`s plus, on the document's own §5 artwork plan (three WebP variants per track), up to 426 more = **568 Advanced Operations ≈ 28% of the monthly allowance in one upload session** — plus dashboard browsing, which the document itself notes counts.
- §1.2's "`del()` is free. So the reconciliation script costs nothing to run" is wrong by omission: finding orphans requires `list()`, which the same page classes as an Advanced Operation, and `/docs/vercel-blob/examples` shows the canonical batch-delete loop calling `list()` per page with `BlobServiceRateLimited` retry handling. The script has a cost; it just isn't in `del()`.

**C4 — the brief's "things that will go wrong" #2 and #3 are not addressed at all.**

- **iOS Safari (risk #2):** the brief says "enumerate what degrades, don't paper over it". The document mentions iOS Safari exactly twice, both times only as a codec argument ("AAC is its native format"; "Opus… iOS Safari support is the one thing I will not gamble on"). There is no enumeration of background-audio behaviour, Media Session support, autoplay gating, Add-to-Home-Screen-only install, standalone-mode navigation quirks, or the 7-day eviction of unused site data. Nothing.
- **Storage quota (risk #3):** `navigator.storage.persist()`, handling refusal, reading `estimate()` before downloading, and failing gracefully instead of leaving a half-written file that plays as silence. The document contains none of these terms and no discussion of any of it — despite §5 resting the entire transfer budget on offline downloads succeeding. If iOS evicts the cache, every download re-transfers; the document's 8%/48% transfer figures assume downloads happen once, forever, and never quantifies the eviction multiplier.

**C5 — the brief's risk #1 (Service Worker vs range requests) is discussed for the wrong component.**

The brief's stated hazard is a **Service Worker fetch handler** replaying audio from Cache Storage: it breaks seeking or returns 200 where the browser wanted 206, and Safari fails hard. §2.3 and §2.1-B instead discuss whether the *Blob CDN* honours `Range`, and whether a *route handler* would have to hand-roll 206. The Service Worker is never mentioned in connection with range requests anywhere in the document. The standard resolutions (don't intercept audio requests; serve offline audio from IndexedDB via `createObjectURL` rather than Cache Storage; or synthesise 206 + `Content-Range` in the SW) do not appear. For a grounding document whose §2 is otherwise its strongest section, this is the named risk left untouched.

---

## HIGH

**H1 — §2.3 / §7 item 2: Range support *is* documented; the document searched four Blob pages and missed the fifth.**

> "**Does the Blob CDN honour `Range` and return `206 Partial Content`?** Not stated on any of the four Blob pages I read."

`/docs/vercel-blob/examples` has a section titled **"Range requests"**:

> "Vercel Blob supports [range requests](https://developer.mozilla.org/docs/Web/HTTP/Range_requests) for partial downloads. This means you can download only a portion of a blob, here are examples:"
> `curl -r 0-3 https://…public.blob.vercel-storage.com/pi.txt` / `curl -r -5 …` / `curl -r 3-6 …`

Vercel also ships dedicated error pages `TOO_MANY_RANGES`, `RANGE_UNIT_NOT_SUPPORTED`, `RANGE_MISSING_UNIT` — further evidence of first-class Range handling. So "if that returns `200`, the architecture changes" is overstated fear.

The *sharp* residual unknown, which the document should have isolated and did not: the documented examples all use a **public** blob URL. Whether a **presigned private GET** honours `Range` — and whether the signature survives a ranged re-request — is undocumented, and that is the specific thing option C stakes the project on.

**H2 — §2 vs §5: presigned URLs break the caching the transfer budget depends on, and the document never notices.**

`presignUrl` serialises expiry as a **signed query parameter**:

> "`validUntil` … Serialized as the `vercel-blob-valid-until` query parameter and signed."

So re-signing the same track yields a **different URL**. Two unacknowledged consequences:

1. §5 claims "**Browser cache alone** (`cacheControlMaxAge` at the 1-month maximum) already de-duplicates repeat plays *within* a browser without any Service Worker. Free win." The browser HTTP cache keys on the full URL including query string. With a URL that rotates every 8 hours (§2.2 mitigation 1), that free win largely evaporates. The document recommends both and never reconciles them.
2. Whether the **CDN** cache key includes the signature is undocumented and unchecked. If it does, every re-signed URL is a cache MISS — one Simple Operation plus Fast Origin Transfer per track start — against the 10,000/month the document never budgeted (C3). If it does not, the document should say so and cite it. Either way this is the load-bearing unknown for option C and it is absent from §7.
3. Phase 5 consequence, also unstated: a Service Worker or download queue cannot use the presigned URL as a cache key at all. Cache keys must be normalised to the pathname, and the SW must strip/ignore the signature — a real design constraint created by the §2.1 recommendation and listed nowhere in §6's expensive-to-reverse items beyond the vague "Touches … Phase 5 SW and download queue".

**H3 — §4: the compute budget silently assumes the compute never autoscales, and Neon's own page says it can go to 8× that.**

> "100 CU-hours/month. Free compute has a 0.25 CU floor, so — per Neon's own gloss — that is **400 wall-clock hours** … at 0.25 CU = **75 CU-hours**."

Neon's plans page, the document's own source: **"Autoscaling … Free: Up to 2 CU (8 GB RAM)"**, and the billing formula it states is **"average compute size × hours running = CU-hours"**. 400 hours is the best case at minimum size, not the budget. If the compute ever autoscales — cold start, a `COUNT(*)` on an unindexed path, concurrent function instances — CU-hours burn proportionally faster, up to 8×. Both the naive (75%) and mitigated (25%) figures are floors presented as estimates. This is unflagged in §4 and unlisted in §6 and §7.

**H4 — §4 mitigation 2 is self-defeating and the arithmetic behind "2–3 wakeups" doesn't survive it.**

Scale-to-zero on Free fires after **5 min** idle and cannot be disabled (correctly stated). Mitigation 2 then proposes: "Buffer plays client-side, **flush on a 5-minute timer**". A flush every 5 minutes lands at or before the idle threshold on every cycle — during a 45-minute session it fires ~9 times and plausibly **prevents scale-to-zero for the entire session**, which is exactly offender #2's failure mode restated. The claimed reduction "turns ~12 wakeups per session into 2–3" does not follow from a 5-minute timer; it would follow from flushing only on `visibilitychange`/`pagehide`, or on a much longer interval.

**H5 — §4: the mitigated budget is arithmetically wrong, by ~31% at the top of the range.**

> "~2–3 wakeups per session × 6 users × 2 sessions × ~8 min effective ≈ **90–110 h/month ≈ 25 CU-hours ≈ 25%**."

Recomputing the stated formula:
- 2 wakeups: 2 × 6 × 2 × 8 = 192 min/day × 30 = 5,760 min = **96 h**
- 3 wakeups: 3 × 6 × 2 × 8 = 288 min/day × 30 = 8,640 min = **144 h**

Range is **96–144 h**, not 90–110. At 0.25 CU that is **24–36 CU-hours (24–36%)**, not "≈25%". Combined with H3 (autoscaling) and H4 (the 5-minute flush), the mitigated design is not demonstrated to be comfortable, and §1.5's "~25% with the mitigations" is the bottom of a range presented as the answer.

**H6 — §5: the "the design and the storage budget agree" argument does not hold; 142 tracks does not fit in 800 MB at 192 kbps.**

> "At 192 kbps VBR inside an 800 MB ceiling you get ~142 tracks. The design and the storage budget agree, which is a good sign that 800 MB is the right default ceiling rather than an arbitrary one."

Arithmetic (the document's own 4-min average, decimal MB):
- 142 × 5.76 MB = **818.0 MB** — already **2.3% over** the 800 MB ceiling *before artwork*.
- Plus the document's own 13.5 MB of artwork = **831.5 MB**, i.e. **4% over**.
- 800 MB ÷ 5.76 = **138.9 → 138 tracks**; net of artwork, (800 − 13.5) ÷ 5.76 = **136 tracks**.

The document writes "≈139 (142 with VBR undershoot)" and then "I have folded [artwork] into the 139-vs-142 figure above" — which is incoherent: adding 13.5 MB of artwork *reduces* capacity, it cannot raise 138.9 to 142. An unquantified "VBR undershoot" is doing the work of bridging a 4% shortfall, and the result is then used as evidence that 800 MB is principled rather than arbitrary. It isn't. "142" in the design is placeholder copy; the agreement is constructed.

Also in the same table: 1 GB ÷ 5.76 = 173.6 → **173**, not the stated 174. (128/160/256/320 rows all check out — see validated list.)

**H7 — §4 offender #1 / §6 item 2 / §8: the case for stateless cookies is asserted, never quantified, and it is the document's most consequential security downgrade.**

"DB-backed session validation on every request" is called "**the worst offender by a wide margin**" and "the single biggest driver of Neon compute", and on that basis the document makes an **[E] expensive-to-reverse** decision to drop revocable sessions. No per-request cost appears anywhere. The counter-argument is not engaged:

- A session read costs nothing extra on any request that already queries the DB (library list, playlist read, search, history write). Its marginal cost is confined to requests that would otherwise touch no DB at all — which, in an App Router app serving mostly cached/static shells, is the set you can also just not run middleware on.
- The hybrid the document doesn't consider: keep DB-backed sessions, revalidate on a cadence (e.g. once per N minutes per session, cached in the request-scoped or edge layer) rather than per request. That gets ~90% of the compute saving with bounded revocation lag.
- Its own proposed mitigation (`session_version` "read only on refresh") reintroduces a DB read on refresh — which, for a 12h cookie, is ~2 reads per user per day. That is a rounding error against the 100 CU-hour budget, which quietly concedes that the read was never the driver.

Additionally: with `role` in the cookie, this is not merely "revocation becomes lazy" — a demoted or compromised **admin** retains upload/delete/metadata-edit authority for the full cookie lifetime, on a system whose audio store has no backup (M6). The document flags the trade-off honestly and hands it to the owner, which is right; it understates its shape.

**H8 — the brief's headline guard — the server-side 800 MB ceiling in the upload authorisation path — is never located, and the upload mechanism is never chosen.**

Phase 0 picks the *read* access model in detail and leaves the *write* path undecided. The document never states which client-upload API it is choosing — classic `handleUpload` / `upload()` with `onBeforeGenerateToken`, or the presigned pair `handleUploadPresigned` / `uploadPresigned` — despite both being on the pages it cites and despite having chosen presigned URLs for GET. It never names `onBeforeGenerateToken` as where the running-total check lives, never mentions `maximumSizeInBytes` / `allowedContentTypes` (documented as "Embedded in the delegation payload so the API enforces it on every upload"), and never addresses the brief's actual requirement — that the ceiling "cannot be bypassed with the client token directly", i.e. that a single issued token must not permit N uploads that collectively breach the ceiling. This is the guard the brief puts first and Phase 0's chosen access model determines it.

**H9 — §1.1 omits Image Optimization, a free allowance the design will hit unless deliberately avoided.**

The Hobby included-usage table the document transcribes also contains **Image Transformations: First 5,000**, **Image Cache Reads: First 300,000**, **Image Cache Writes: First 100,000**. The document dropped all three rows. They matter: the default Next.js path for artwork is `next/image`, which meters against them, and 5,000 transformations is small once you have per-track artwork at three sizes across six users and cache churn. The client-side-resize decision (§6 item 9) happens to sidestep this, but the document justifies that decision purely on Active CPU and never notes that the Image Optimization meter exists or that `unoptimized`/raw `<img>` is therefore mandatory. A ledger required to cover "every service with a free allowance" cannot silently drop three rows.

---

## MEDIUM

**M1 — §7 item 6 is answerable from the page already cited.** "Neon counts history/WAL retention toward storage. I do not know the Free-plan retention window." The Neon plans page, under *Instant restore*: **"Free: No charge, 6-hour limit, capped at 1 GB of change history."** Six hours, capped at 1 GB, no charge. The item should be closed, not carried.

**M2 — §1.2 misattributes four facts to the wrong page.** "**Also from that page**" (i.e. `/docs/vercel-blob/usage-and-pricing`) introduces the `cacheControlMaxAge` / 1-month / 60s-minimum / robots.txt-indexing facts. None are on that page (`grep -ci 'cacheControlMaxAge|1 month'` → 0). They are on `/docs/vercel-blob/public-storage`. The facts themselves are right: "Both caches store blobs for up to 1 month **by default**… blobs may occasionally expire earlier" and "The minimum configurable value is 60 seconds". Note two nuances the document hardens past: 1 month is the **default**, not stated as a maximum (§5 calls it "the 1-month maximum"), and the docs warn blobs "may occasionally expire earlier" — so cache-based dedup is best-effort, which weakens §5's "free win" further.

**M3 — §1.3 misquotes Neon.** Presented as a quotation: *"sufficient to run a 0.25 CU compute for 400 hours/month"*. Actual text: **"enough to run a 0.25 CU compute in a project for 400 hours/month."** Same meaning; but the document's opening promise is that every figure is "quoted from a doc I fetched today", and this one is a paraphrase in quotation marks.

**M4 — the reconciliation script and the admin usage panel measure different things, and the ceiling depends on which.** The 800 MB guard can only be enforced against `SUM(tracks.byte_size)` in Postgres, while the meter Vercel actually locks you out on counts **every blob in the store, including orphans**. Those diverge precisely when the reconciliation script is needed. Phase 0 chose `SUM(byte_size)` implicitly (§4 offender 5) and never notes the divergence, never asks whether the panel should read Blob's own reported size (via `list()`, an Advanced Operation), and never sets a safety margin for it. With the ceiling at 80% of a 1 GB allowance, there is 200 MB of slack absorbing an unbounded orphan count.

**M5 — Hobby cron jobs run once per day, ±59 minutes, and nothing in the document accounts for it.** `/docs/cron-jobs/usage-and-pricing`: Hobby — "Minimum interval: **Once per day**", "Scheduling precision: **Per-hour (±59 min)**", and "Cron expressions that would run more frequently **will fail during deployment**." The brief demands a reconciliation script; §3 specifies `sessions(expires_at)` "for sweeping". Both imply scheduled work, both are capped at one daily run at an unpredictable hour, and each run wakes Neon (a compute offender §4 does not list). Not mentioned anywhere.

**M6 — no backup, and it isn't in the assumptions list.** `/docs/vercel-blob/examples`: "**While there's no native backup system for Vercel Blob**", followed by two roll-your-own patterns. Against the no-card constraint and a documented 30-day lockout, "the only copy of the library lives in one Blob store" is a material unstated assumption. §6 lists 16 assumptions and this is not among them; §7 does not carry it as a risk. (The owner presumably holds local masters — but that is precisely the assumption that should be written down, since §6 item 6 already notes that reversing the encoding decision means "800 MB of re-upload", which is only possible if masters exist.)

**M7 — §1.5's Blob transfer band is not derived from anything.** "Blob transfer | 4–8 GB of 10 GB … **40–80%**". §5's computed scenarios are: naive streaming 20.7 GB (207%), all six users downloading the entire library 4.8 GB (48%), realistic "well under 20%". Nothing in the document produces 8 GB / 80%, and the 4 GB floor matches no scenario either. The single figure the summary table flags as "the single biggest risk" is the one number with no arithmetic behind it.

**M8 — §3's artwork lives on two tables; §5 sizes it on one; the design has no artwork at all.** The schema puts `artwork_base_path` on both `albums` and `tracks` with no precedence rule. §5 then budgets "~95 KB/**track** of artwork … three WebP variants at 128/256/512 px" (142 × 95 KB = 13.5 MB ✓). If artwork is per-album (50 albums), it is 4.75 MB and ~190 blobs, not 13.5 MB and ~426 blobs — which changes the Advanced Operations count in C3. Separately, and worth knowing: the design export contains **zero `<img>` tags and zero `background-image` declarations**. Row artwork is a synthetic colour block with a coloured `<i>` inside (`width:40px;height:40px;…background:{{ r.bg }}` wrapping `<i style="…background:{{ r.mc }}">`). So "real per-track cover art exists, at three sizes" is an assumption the document introduces, sizes the budget against, and does not list in §6.

**M9 — §8 omits several decisions the document made.** §8 lists eight. Made elsewhere and absent: omitting `crossorigin` on `<audio>` (§2.4 — an explicit choice with an explicit rejected alternative, and the document itself calls setting it "actively harmful"); `validUntil = now + 8h`; `citext` for email; adding a `sessions` table at all under a stateless scheme (§3 lists it, §4 says it may not be needed — unresolved); `cacheControlMaxAge` at maximum; three WebP artwork variants at 128/256/512; a single Blob store rather than separate stores (the pricing page notes "Use separate stores to isolate projects, environments, or public and private content" and Hobby allows 100).

**M10 — §2.4's conclusion is stated more absolutely than it holds.** "playback has **no CORS dependency on the Blob origin at all**." True for the Phase 4 path (bare `<audio src>`, no `crossorigin`, no Web Audio — and the CSS-only EQ finding that supports it is confirmed). Not true once Phase 5 exists: if the Service Worker fetches or serves audio, or playback reads from IndexedDB bytes obtained by `fetch()`, the request is CORS-governed. The document splits playback from downloading correctly but then generalises across phases, which is how a Phase 2 verification gets scoped too narrowly.

**M11 — no mention of the Postgres connection model, which is a compute question.** §4 enumerates what holds the DB awake but never touches connection strategy: pooled endpoint vs direct, `@neondatabase/serverless` HTTP driver vs TCP, and the fact that each new connection from a cold function instance wakes the compute. For a serverless app on a 100 CU-hour budget where scale-to-zero cannot be disabled, this belongs in an answer to "anything in the design that would hold the database awake".

**M12 — Argon2id/bcrypt is a fixed requirement and is never costed against the 4 CPU-hr Active CPU meter.** The brief fixes the hashing choice; the document's ledger flags Active CPU as "4 CPU-hrs" and its tightest Vercel meter, then budgets only artwork resize against it. Password hashing is deliberately CPU-expensive by design and runs in a Function. At six users the total is trivially small — but that is a sentence the document should contain, along with the runtime note that native `argon2` bindings need a serverless-compatible build (`@node-rs/argon2`), since discovering that in Phase 1 is exactly the kind of surprise Phase 0 exists to remove. Relatedly, **CSRF is never mentioned once**, despite being a fixed requirement of the brief and despite interacting directly with the stateless-cookie recommendation (where the double-submit token lives).

**M13 — §1.5 "80% — but that is the intended ceiling, not an overrun" softens the STOP condition it is answering.** The per-phase rule is: if any meter passes 50%, stop and flag rather than continue. The design ceiling is 80% of an allowance the document simultaneously claims it could not verify (C1), with the remaining 200 MB absorbing artwork (13.5 MB), orphans (unbounded, M4), and the 4% by which the target library actually overshoots (H6). "Intended, not an overrun" is a reasonable position; presenting it without the residual-margin arithmetic is not.

---

## LOW

**L1 — §1.1 dangling cross-reference.** "Function Invocations … ~30k/mo (**see §4**)". §4 contains no invocation estimate. The 30k figure has no derivation anywhere.

**L2 — §1.3 contradicts §3 on static storage.** §1.3: "~10 MB + ~7 MB/yr growth (§3)". §3: "~0.6 MB static + ~7.7 MB/year". The 10 MB appears nowhere in §3.

**L3 — §3 year-ten figure.** 0.6 + (10 × 7.7) = 77.6 MB. Against 0.5 GB: 77.6/500 = **15.5%** (or 15.2% against 512 MB). Document says "~14%". Off by ~1.5 points.

**L4 — §5 mixes decimal and binary units.** Track sizes are computed in decimal MB ("decimal MB" is stated explicitly), then the transfer allowance is taken as 10,240 MB: "10,240 ÷ 5.76 = **1,777** track plays/month". Vercel bills GB decimal, so it is 10,000 ÷ 5.76 = **1,736**. Overstates the streaming budget by 2.4% (and the derived "~10 plays/day each" becomes ~9.6).

**L5 — §3 and §5 assume different play rates.** §3 sizes `play_history` at "6 users × **25** plays/day"; §5's transfer math uses "6 users × **20** plays/day". Neither is wrong, but the same document should use one number or say why not.

**L6 — §1.2 leads with the looser of two conflicting rate limits.** "Hobby operation rate limits: 1,200 Simple/min, **1,500** Advanced/min (the limits page says 1,500 …; the pricing page's table says 900 …)". Both readings are confirmed correct (see validated list), but the headline figure should be the conservative 900.

**L7 — the design export loads fonts from the Google CDN.** The only `crossorigin` in the file is `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` alongside a `fonts.googleapis.com/css2?family=Instrument…` stylesheet link. §1.4 asserts self-hosting with "zero third-party runtime request" as the plan, which is right per the brief — but the export as delivered does the opposite, and that conversion is a concrete Phase 2/3 task the document does not name.

**L8 — §6 doesn't list its own most load-bearing assumption.** "4-minute average track" underpins every figure in §5 and is carried only as §7 item 11 (unverifiable-without-you), not as an assumption in §6. Same for "6 users" and "20–25 plays/day", which drive §4 and §5 entirely.

**L9 — §10's greps are loose.** `grep -oE 'height:5[0-9]px'` also matches `height:54px` (it does — the 1a command returns 54px and 56px). The commands work and prove the claim, but a reader running them sees an extra value with no explanation.

---

## Spot-checks that came back clean

Verified against the live pages and the actual file, all correct as written:

**Vercel Hobby (`/docs/plans/hobby`, "Last updated June 16, 2026" — date matches):** Active CPU 4 CPU-hrs; Provisioned Memory 360 GB-hrs; Function Invocations first 1,000,000; Edge Requests "Up to 1,000,000"; Projects 200; Deployments/day 100; Function max duration 300s; Runtime Logs "1 hour of logs"; Build vCPUs 2 / memory 8 GB / disk 32 GB. The 30-day lockout quote is **verbatim**. The non-commercial quote is **verbatim**. "Enter your card details" is indeed step 5 of *Upgrading to Pro*, and nothing on the Hobby path asks for a card. The claim that the Hobby included-usage table lists no Blob rows is correct — the only Blob reference in the comparison table is a bare link (`Storage | Blob | Blob`, no values).

**Vercel Blob pricing:** the 30-day lockout / "will not pay for any additional usage" quote is **verbatim**. "Cache HITs do not count as Simple Operations" ✓. "Cache HITs do not incur Fast Origin Transfer charges" ✓. 512 MB cache limit per blob ✓. "`del()` operations are free" ✓. "Dashboard interactions count as operations… count as Advanced Operations" ✓. "Blob Data Transfer (BDT) is 3x more cost-efficient than Fast Data Transfer (FDT) on average" ✓. Client uploads incur no data transfer charge; server uploads incur Fast Data Transfer ✓. **And the 900-vs-1,500 contradiction is real**: `/docs/vercel-blob/usage-and-pricing` says Hobby Advanced 900/min (15/s); `/docs/limits` says "Vercel Blob Advanced Operations per minute for Hobby plan. **1500**". Simple Operations agree at 1,200/min on both.

**Private storage:** "We do not recommend serving files larger than 100 MB through private Blob stores unless traffic is low" — **verbatim**.

**Signed URLs:** `issueSignedToken` `validUntil` — "A timestamp in milliseconds since the epoch when the token expires. **Maximum 7 days from now. Defaults to 1 hour from now.**" — **verbatim**. `presignUrl` `validUntil` "Capped to the delegation's `validUntil`. Serialized as the `vercel-blob-valid-until` query parameter and signed" — **verbatim**. "Embed a private blob in a server-rendered page without proxying bytes through your function" — **verbatim**. The delegation-caching quote — "`issueSignedToken` calls the Blob control API, so cache the result and reuse it across requests until it's near expiry to avoid a network round-trip on every URL you sign" — **verbatim** (it is a code comment in the GET example). The 60-second overwrite-propagation quote — **verbatim**. §2.2's per-request signature-check reasoning is sound and the "in-flight response completes, next request fails" model is the right one.

**Public storage:** the search-engine indexing point is fair — "they can still be indexed by search engines under certain conditions" and you must upload your own `robots.txt` to prevent it.

**Neon (`/docs/introduction/plans`):** Free = 100 CU-hours/project/month, 0.5 GB storage/project, 100 projects, 10 branches/project, scale-to-zero after 5 min and cannot be disabled, 5 GB/month public network transfer — **all correct**. All three overage quotes are **verbatim** from the FAQ: compute suspended until next period, storage overage fails inserts/updates/deletes, "None of these limits delete your data." No credit-card statement appears on that page, exactly as the document says. 100 ÷ 0.25 = 400 h; 400/730 = 54.8% ≈ "about 55%" ✓. Naive budget arithmetic all checks: 6 × 2 × 50 = 600 min/day = 10 h/day = 300 h/mo = 75 CU-hours = 75% ✓. (Corroboration only, not primary: third-party sources do support Neon-via-Vercel-Marketplace being $0 with no card; the marketplace listing itself says "Plans starting at $0" and "Neon offers a generous Free Plan" without allowances — so §7 items 4 and 5 are fairly held open, though that listing was available to cite.)

**Client uploads:** the localhost limitation is real and quoted correctly — "the `onUploadCompleted` callback will not work as Vercel Blob cannot contact your localhost… we recommend you run your local application through a tunneling service like ngrok", configured via `VERCEL_BLOB_CALLBACK_URL`. (Unmentioned nuance: `callbackUrl` on `onBeforeGenerateToken` is a documented alternative.)

**Schema arithmetic (§3):** every row and total checks. 1.5 + 8 + 11 + 99 + 6 + 54 + 22 + 3 = 204.5 ≈ "~205 KB" ✓. Page floor 25 × 8 KB = 200 KB ✓. Total ~0.6 MB ✓. `play_history`: 150/day × 365 = 54,750 ✓; × 70 B ≈ 3.83 MB, doubled for index ≈ 7.7 MB ✓. Year-one 8.3/500 = 1.66% ≈ "~1.7%" ✓. All eight tables the brief named are present.

**Bitrate table (§5):** MB/track correct at every rate (128 → 3.84, 160 → 4.80, 192 → 5.76, 256 → 7.68, 320 → 9.60). Track counts correct at 128 (208/260), 160 (166/208), 256 (104/130), 320 (83/104). Only the 192 row is off by one in both columns (H6). Artwork total 142 × 95 KB = 13.5 MB ≈ "~13 MB", 1.7% of 800 MB ✓. Transfer scenarios: 20.7 GB ✓, 207% ✓, ~day 15 ✓, 800 MB = 8% ✓, 4.8 GB = 48% ✓. The `+faststart` / `moov` atom point is correct and well made, and MP3-with-Xing-header is a fairly characterised alternative.

**Design file — every claim confirmed, and the document's own commands reproduce it.** File is at `/Users/sotsys165/Downloads/Music library interface design/Music Player.dc.html`, 52,357 bytes, with `support.js` at 69,150 bytes. Five artboards, ids `1a 1b 1c 2a 2b` (file order is 2a, 2b, 1a, 1b, 1c).
- **1a row:** `display:flex;align-items:center;gap:12px;height:56px;padding:0 22px;…` wrapping `width:40px;height:40px` artwork — **exactly as claimed**.
- **2a row:** `…gap:12px;height:60px;padding:0 8px 0 22px;…` wrapping `width:42px;height:42px` — **exactly as claimed**, including the 8px-vs-22px right padding the document identifies as a third axis of the conflict. (One more it didn't note: 2a's mini-player padding is `0 8px 0 22px` vs 1a's `0 14px 0 22px`.)
- **1a mini-player** `height:62px` and `46px×46px` play button ✓. **Tab bar** `height:84px` with `height:56px` buttons ✓.
- **Rows visible:** `hint-placeholder-count` = 11 in 1a ✓, 8 in 1b ✓, 6 in 2b's tile grid ✓.
- **`"142 TRACKS · 9 OFFLINE"`** is present in 1a (offset 27267) ✓ — and also in 1b; 1c carries the variant `"142 · 9 OFFLINE"`.
- **EQ animation is CSS-only** ✓: `animation:eq1 .9s ease-in-out infinite`, `eq2 1.1s`, `eq3 .75s`, on `<i>` elements at `width:3px;background:#FFB000`. The whole file contains **zero** occurrences of `AudioContext`, `createAnalyser`, or "Web Audio", and its single `crossorigin` is the Google Fonts preconnect. The inference — no Web Audio, therefore no `crossorigin`, therefore no CORS dependency for bare playback — is sound as far as Phase 4 (see M10 for the Phase 5 caveat).
- **`sc-for` / `{{ }}` bindings** confirm it is a Claude Design canvas, not liftable markup ✓.
- **No repo** ✓: `git -C /Users/sotsys165 rev-parse --show-toplevel` → `fatal: not a git repository`.
- I ran §10's commands 2, 3 and 4 verbatim; all produce the claimed output.

**Bottom line:** §2 (access model, expiry semantics, the mid-track failure analysis) is genuinely good work and mostly holds up. §1 rests on a false central caveat and omits two hard Blob meters plus three Image meters. §4 and §5 reach roughly-defensible conclusions on arithmetic that is wrong in three places and rests on an unflagged 8× assumption. Two of the brief's four named failure modes — iOS Safari degradation and storage quota — do not appear in the document at all, and the third (Service Worker vs range) is answered about the wrong component.
