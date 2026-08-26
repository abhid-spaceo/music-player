# Phase 0 — review adjudication

A fresh reviewer with no sight of the drafting conversation audited
`phase-0-grounding.md`. Its full findings are reproduced verbatim in
`phase-0-review-findings.md`. This file records which findings I verified,
which I accepted, and which I dispute — with evidence for each.

## Verified myself, before responding

### C1 — UPHELD. The reviewer is right and I was wrong.

The Hobby Blob allowances *are* on the page I cited. I fetched the rendered HTML
directly:

```
$ grep -oiE "hobby included|1GB/month|First 10 GB|First 10,?000|First 2,?000" blobprice.html | sort | uniq -c
   2 1GB/month
   2 First 10 GB
   2 First 10,000
   2 First 2,000
   1 Hobby Included

$ grep -oE "Blob Storage Size.{0,120}" blobprice.html
Blob Storage Size</a></p></div></div></td><td role="cell" ...>1GB/month</td>
```

There is a **"Managed Infrastructure pricing"** table with a **"Hobby Included"**
column on `/docs/vercel-blob/usage-and-pricing`, and it states:

| Resource | Hobby Included |
|---|---|
| Blob Storage Size | **1GB/month** |
| Blob Data Transfer | **First 10 GB** |
| Blob Simple Operations | **First 10,000** |
| Blob Advanced Operations | **First 2,000** |

**Why I missed it, which matters for how I work from here:** I read that page through
a markdown conversion, in which the whole table collapses to a two-column
`| Resource | Price |` with the literal cell value `Regional` — a placeholder where
the rendered page draws a region-aware table. Confirmed:

```
$ curl -sL "https://vercel.com/docs/vercel-blob/usage-and-pricing.md" | sed -n '60,65p'
| [Blob Simple Operations](...) | Regional |
| [Blob Advanced Operations](...) | Regional |
| [Blob Data Transfer](...) | Regional |
```

So the figures were never in the text I was looking at. That is an explanation, not an
excuse: a cell reading `Regional` is a visible signal that a table has been flattened,
and I should have gone to the rendered page instead of concluding the number did not
exist. **Correction adopted:** §7 item 1 is closed, not carried. The brief's 1 GB /
10 GB are confirmed from Vercel's own documentation, and the dashboard check I asked for
is unnecessary.

### C2 — REJECTED. The reviewer's evidence does not exist.

The reviewer says: *"There is no 5 GB or 100 GB anywhere in that example…
`grep -nE '5 ?GB|100 ?GB'` over the page text returns one hit"* and concludes *"The
document invented the evidence for its own caveat."*

It did not. From the raw markdown of the same page:

```
$ grep -inE "included" blobprice.md | grep -iE "GB|Operations|requests"
125:- **Storage**: 50 GB total - 5 GB included = 45 GB extra at $0.023/GB = $1.04
126:- **Simple Operations**: 750K - 100K included = 650K extra at $0.40/1M = $0.26
127:- **Advanced Operations**: 336K - 10K included = 326K extra at $5.00/1M = $1.63
128:- **Data Transfer** (iad1): 350 GB - 100 GB included = 250 GB extra at $0.05/GB = $12.50
```

`5 GB included` on line 125 and `100 GB included` on line 128, verbatim. My §1.2
sentence — "the pricing page's worked example uses 5 GB / 100 GB included" — was
accurate. The reviewer's grep failed to find text that is plainly there, and it then
escalated that failure into an accusation of fabricated evidence. **Finding rejected.**

The one thing C2 does establish, indirectly: those figures are the **Pro** included
amounts (100K simple / 10K advanced), which makes the Hobby figures in C1 — 10,000 and
2,000 — a coherent 10×/5× step down, and corroborates C1.

## Accepted in full

### C3 — ACCEPTED, and it is the most valuable finding in the review.

Two hard free allowances were missing from my ledger entirely: **Blob Simple Operations
(10,000/month)** and **Blob Advanced Operations (2,000/month)**, both carrying the same
30-day lockout as storage and transfer. The brief required the ledger to cover *every*
service with a free allowance. §1.2 had no rows for them, §1.5 omitted them, and §9
reported "Blob operations | 0 | 100%" without ever naming the denominator. That is a
straightforward failure to answer the question asked.

Recomputed at the confirmed scale of **1 user**:

| Activity | Advanced Ops | % of 2,000 |
|---|---|---|
| Uploading 142 tracks (`put()` each) | 142 | 7% |
| + 3 artwork variants per track, *if per-track art exists* (see M8) | +426 | +21% |
| + 3 variants per album (50 albums) instead | +150 | +8% |
| Reconciliation `list()`, paginated | ~1–2 | <1% |
| Dashboard browsing | unmetered by me, counts | ? |

So a full library load is **15–30% of the monthly Advanced allowance in one session** —
comfortable, but it means you cannot re-upload the library twice in a month and browse
the store freely in the dashboard. That is a real operational constraint I should have
surfaced.

Simple Operations at 1 user: ~600 plays/month, worst case every play a cache MISS
(see H2) = 600 = **6% of 10,000**. Not tight.

**One part of C3 I must correct in the reviewer's favour *and* against it.** The
reviewer computes "3,600 Advanced Operations against 2,000 included = 180%" for
uncached delegation tokens, citing my own §2.2 line that failing to cache "would add a
network hop **and an Advanced Operation** to every single track start."

That parenthetical was **my unverified inference, and it is wrong.** The docs define
Advanced Operations as `put()`, `copy()`, or `list()`. `issueSignedToken` is documented
as calling "the Blob control API" and is **not** in that list. So the 180% figure
inherits an error I introduced. Caching the delegation token remains correct advice on
latency grounds; it is not the difference between working and a lockout. **Both my §2.2
claim and the reviewer's escalation of it are struck.**

### C4 — ACCEPTED in substance, with a scope note.

iOS Safari degradation and storage-quota handling (`navigator.storage.persist()`,
`estimate()`, refusal handling, no half-written files) appear nowhere in the document.
The reviewer is factually right.

Scope note, not a defence: the brief places these under "The four things that will
actually go wrong… Research them properly **before the relevant phase**", and pairs the
research-agent instruction with Phases 2, 4 and 5 — not Phase 0. So enumerating iOS
behaviour was not a Phase 0 deliverable.

But the reviewer's real point lands and I accept it: **§5's transfer budget rests
entirely on downloads persisting, and iOS evicts unused site data.** I quantified the
saving from downloading once and never quantified the eviction multiplier that could
undo it. That is a hole in an answer Phase 0 *did* owe.

### C5, H1 — ACCEPTED. My framing of the range-request risk was aimed at the wrong target.

H1 first, because it changes C5: **range support is documented**, on
`/docs/vercel-blob/examples`, a fifth Blob page I never opened —
*"Vercel Blob supports range requests for partial downloads"*, with `curl -r` examples.
Vercel also ships `TOO_MANY_RANGES` / `RANGE_UNIT_NOT_SUPPORTED` error pages. So §2.3's
"if that returns `200`, the architecture changes" was overstated, and §7 item 2 was
carried as unknown when it is answered.

The reviewer's sharpening is better than my original framing and I adopt it: the
documented examples all use a **public** URL. **Whether a presigned private GET honours
`Range`, and whether the signature survives a ranged re-request, is undocumented** —
and that is precisely what the chosen access model stakes the project on.

C5: correct. The brief's risk #1 is a **Service Worker** fetch handler replaying audio
from Cache Storage and returning 200 where the browser wanted 206. I discussed the Blob
CDN and a hypothetical route handler, and never once connected the Service Worker to
range requests. The standard resolutions — don't intercept audio; serve offline audio
from IndexedDB via `createObjectURL` rather than Cache Storage; or synthesise 206 +
`Content-Range` in the SW — are absent.

### H2 — ACCEPTED, and it invalidates a claim in §5.

`presignUrl` serialises expiry as a signed `vercel-blob-valid-until` query parameter, so
re-signing yields a **different URL**. The browser HTTP cache keys on the full URL
including query string. My §5 claim that browser caching alone "de-duplicates repeat
plays within a browser… Free win" is therefore **largely false** under my own §2.2
recommendation of 8-hour URLs. I recommended both and never reconciled them. Struck.

Corollary I also accept: whether the **CDN** cache key includes the signature is
undocumented, and if it does, every re-signed URL is a cache MISS — one Simple
Operation plus Fast Origin Transfer per track start. Added to the open-questions list as
the load-bearing unknown for the chosen model.

### H3, H4, H5, H6, L3, L4 — ACCEPTED. Arithmetic errors.

- **H6 is the one that stings**, because it was motivated reasoning. 142 × 5.76 MB =
  **818 MB**, already over the 800 MB ceiling before artwork; with my own 13.5 MB of
  artwork, 831.5 MB. The correct figures are **138 tracks**, or **136 net of artwork**.
  I then wrote that artwork was "folded into the 139-vs-142 figure", which is incoherent
  — adding artwork *reduces* capacity. And I used the resulting fake agreement with the
  design's "142 TRACKS" placeholder as evidence that 800 MB was "principled rather than
  arbitrary". It is not evidence of anything. The whole §5 flourish is withdrawn.
  Also: 1 GB ÷ 5.76 = 173.6 → **173**, not 174.
- **H5.** My mitigated range was wrong. 2×6×2×8 = 192 min/day → **96 h/month**;
  3× → **144 h/month**. I wrote "90–110 h ≈ 25 CU-hours". Correct is **96–144 h =
  24–36 CU-hours**. I published the bottom of a range as the answer.
- **H4.** Sharp catch. A 5-minute flush timer lands at or before the 5-minute
  scale-to-zero threshold on every cycle, so it plausibly prevents scale-to-zero for an
  entire session — which is offender #2 restated, not mitigated. Flush on
  `visibilitychange`/`pagehide` and a much longer interval instead.
- **H3.** Neon Free autoscales **up to 2 CU**, and CU-hours bill as average compute size
  × hours. My 400-hour figure is therefore a best case at the 0.25 CU floor, and both
  the 75% and 25% figures are floors presented as estimates. Unflagged. Accepted.
- **L4.** I computed track sizes in decimal MB then divided a binary 10,240 MB
  allowance. Vercel bills decimal, so it is 10,000 ÷ 5.76 = **1,736** plays, not 1,777.
- **L3.** Year ten: 0.6 + 77 = 77.6 MB → **15.5%** of 0.5 GB, not "~14%".

### H8 — ACCEPTED, and this is the second-most important finding.

The brief's **headline guard** — the storage ceiling enforced server-side in the upload
authorisation path so it "cannot be bypassed by using the client token directly" — is
never located in my document. I chose the *read* model in detail and left the *write*
path undecided: never named `handleUpload`/`onBeforeGenerateToken` versus
`handleUploadPresigned`/`getSignedToken`, never named `maximumSizeInBytes` or
`allowedContentTypes` as the enforcement primitives, and never addressed the actual
threat — that one issued token must not permit N uploads that collectively breach the
ceiling. Phase 0 owed an answer here and did not give one.

### H7, H9, M1–M13, L1–L9 — ACCEPTED.

Notable among them:

- **M8.** The design export contains **zero `<img>` tags and zero `background-image`
  declarations** — row artwork is a synthetic colour block with a coloured `<i>` inside.
  So "real per-track cover art at three WebP sizes" is an assumption I invented, sized a
  budget against, and never listed. It also changes C3's operation count materially.
- **M6.** *"While there's no native backup system for Vercel Blob"* — so "the only copy
  of the library lives in one Blob store" is a material unstated assumption, against a
  no-card constraint and a documented 30-day lockout.
- **M12.** CSRF is a fixed requirement of the brief and **is not mentioned once** in my
  document, despite interacting directly with the stateless-cookie recommendation. And
  Argon2id is deliberately CPU-expensive, runs in a Function, and was never costed
  against the 4 CPU-hr Active CPU meter (trivial at this scale — but that is a sentence
  the document should contain, along with the `@node-rs/argon2` serverless-build note).
- **M5.** Hobby cron is **once per day, ±59 min**, and more frequent expressions *fail
  at deploy time*. Both the reconciliation script and session sweeping imply scheduled
  work. Unmentioned.
- **M11.** Connection model (pooled vs direct, `@neondatabase/serverless` HTTP vs TCP)
  belongs in "anything that would hold the database awake" and is absent.
- **M1.** Answerable from the page I cited: Neon Free instant restore is
  *"6-hour limit, capped at 1 GB of change history"*. §7 item 6 closed.
- **M2.** I attributed four facts to the pricing page that are on the public-storage
  page. Facts right, citation wrong. And 1 month is the **default**, not the "maximum" I
  called it, with docs warning blobs *"may occasionally expire earlier"* — weakening the
  cache-dedup claim H2 already struck.
- **M3.** I put quotation marks around a paraphrase of Neon's 400-hour gloss.
- **M7.** §1.5's "Blob transfer 4–8 GB / 40–80%" is derived from nothing. No scenario in
  §5 produces it. The number the summary flagged as "the single biggest risk" was the
  one with no arithmetic behind it.
- **M13.** Presenting 80% of the storage allowance as "intended, not an overrun" without
  the residual-margin arithmetic softens the brief's own STOP-at-50% rule.

## Net assessment

The review is largely correct and found two classes of failure I would not have caught
alone: **omitted meters** (Blob operations, Image Optimization) and **motivated
arithmetic** (H6 especially, where I bent a number to manufacture agreement with a
placeholder in the design). Its §2 verdict is fair — the access-model and URL-expiry
analysis holds up — and its bottom line is one I accept.

One finding (C2) is false and was stated as an accusation of invented evidence; I have
shown the text it says does not exist. One (C3's 180%) inherits an error of mine rather
than finding one. Everything else stands.

**Phase 0 is not approved-ready in its current form.** The corrections above must be
folded into `phase-0-grounding.md` before Phase 1 planning begins, because three of them
— H8 (where the ceiling is enforced), H2/H1 (whether a presigned ranged GET works at
all), and C3 (operation ceilings) — bear directly on decisions Phase 1 and 2 will make.
