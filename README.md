# Music Player

A private, ad-free music player over a YouTube-backed library. You paste a YouTube link,
the app pulls the title, channel and duration, and the track joins your library. You
organise it your way — playlists, favourites, your own sort orders — and play it back
through the embedded YouTube player.

The value is the organisation layer, not the playback. YouTube gives an unlimited catalogue
at zero storage cost; this gives a fast, dense, personal index over the slice you actually
listen to.

---

## Get it running — the 20-minute path

Four things need provisioning. Everything is free and **no payment method is required at
any step.** If something asks for a card, stop — you are on the wrong path.

### 1. A Postgres database (Neon, ~4 min)

1. Go to your Vercel project → **Storage** → **Create Database** → **Neon**.
   (Or sign up at neon.com directly; the app does not care which.)
2. Pick the **Free** plan. 0.5 GB storage, 100 compute-hours/month.
3. Copy the **pooled** connection string. It looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
   Use the *pooler* endpoint, not the direct one — the app opens a small pool per
   serverless instance and Neon's pooler is what makes that safe.

> **Free-plan facts worth knowing.** The compute suspends after 5 minutes idle and that
> cannot be disabled, so the first request after a quiet spell is slow. Exceeding the
> compute allowance suspends the database until the next period; exceeding storage makes
> writes fail. Neither deletes your data.

### 2. A YouTube Data API key (~3 min)

1. https://console.cloud.google.com → create a project.
2. **APIs & Services → Library** → search "YouTube Data API v3" → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials** → **API key**.
4. Restrict it: **API restrictions → YouTube Data API v3**. Worth doing — an unrestricted
   key that leaks can be used against any Google API you have enabled.

The key reads public data only, so it needs no OAuth consent screen and no billing account.
The daily quota is **10,000 units**, and this app spends **1 unit per 50 videos** — adding
a track costs 0.01% of a day's allowance. See `docs/phase-0-youtube-grounding.md` §1 for
the full ledger.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Then fill in:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | The Neon **pooled** connection string from step 1. |
| `SESSION_SECRET` | `openssl rand -base64 48`. Signs session and CSRF cookies. Rotating it signs everyone out. |
| `YOUTUBE_API_KEY` | From step 2. |
| `YOUTUBE_REGION` | Two-letter code for **where you watch** — region-blocking is evaluated per viewer, so a wrong value flags playable tracks as blocked. Default `IN`. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Your admin login. **Required in production** — the seed refuses to plant a default credential into a real database. |
| `SEED_LISTENER_EMAIL` / `SEED_LISTENER_PASSWORD` | A second, non-admin account. Optional, but it is what proves the role split works. |
| `CRON_SECRET` | `openssl rand -hex 32`. Guards the daily link-health job so it is not an open quota-burning URL. |

### 4. Migrate, seed, run

```bash
npm install
npm run migrate     # applies db/migrations in order; safe to re-run
npm run seed        # creates your accounts; never overwrites an existing one
npm run dev         # http://localhost:3000
```

Sign in at `/sign-in` with the admin credentials, then add tracks (below).

### 5. Deploy

```bash
npx vercel            # link the project
npx vercel env add DATABASE_URL production
npx vercel env add SESSION_SECRET production
npx vercel env add YOUTUBE_API_KEY production
npx vercel env add YOUTUBE_REGION production
npx vercel env add CRON_SECRET production
npx vercel --prod
```

Then run the migration against production once:

```bash
DATABASE_URL="<your production Neon URL>" npm run migrate
NODE_ENV=production SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... \
  DATABASE_URL="<your production Neon URL>" npm run seed
```

`vercel.json` registers the daily link-health cron. **Vercel Hobby allows one cron run per
day at an unpredictable hour (±59 min)**, and a more frequent schedule fails at deploy time.

---

## Adding tracks

There is no UI for bulk adding yet. Use the API — it accepts every YouTube URL form, and
one call covers up to 50 videos:

```bash
# Get a CSRF token and a session cookie
curl -s -c jar http://localhost:3000/api/session

TOKEN=$(curl -s -b jar -c jar http://localhost:3000/api/session \
  | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')

curl -s -b jar -c jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H "x-csrf-token: $TOKEN" \
  -d '{"email":"you@example.com","password":"..."}'

# Paste as many links as you like, any format, newline or comma separated
TOKEN=$(curl -s -b jar -c jar http://localhost:3000/api/session \
  | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -s -b jar -X POST http://localhost:3000/api/admin/tracks \
  -H 'Content-Type: application/json' -H "x-csrf-token: $TOKEN" \
  -d '{"text":"https://youtu.be/dQw4w9WgXcQ https://www.youtube.com/watch?v=9bZkp7q19f0"}'
```

The response reports each input as `added`, `duplicate`, `invalid` (with a reason) or
`not-found`, plus `quotaUnitsSpent`. Invalid inputs and duplicates cost **zero** quota —
they are rejected before the API is called.

Accepted forms: `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`, `/v/`,
`music.youtube.com`, `m.youtube.com`, `youtube-nocookie.com`, a bare 11-character ID, and
any of those with `list=`, `t=`, `si=` or other extra parameters.

---

## What this app deliberately cannot do

These are YouTube API policy constraints, not missing features. Do not add workarounds.

- **No background or lock-screen playback.** Playback stops when you leave the app. There
  is no Media Session trickery, no Service Worker keeping a stream alive, no wake lock.
  This is the largest functional cost of the approach.
- **No audio-only extraction, no downloads, no offline listening.** The Service Worker
  caches the app shell and your metadata so you can *browse* offline. It never touches
  media.
- **The player cannot be hidden or shrunk.** The embed is 200×200 minimum and visible while
  playing, because that is the documented requirement.
- **Ads appear** on monetised videos and are not blocked.
- **Your own fields are additive.** `sortArtist` and `note` exist for sorting and search;
  they never replace YouTube's title, channel or thumbnail, which must be displayed
  unaltered.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm run migrate` | Applies `db/migrations/*.sql` in order. Idempotent, and refuses to run if an already-applied file has been edited. |
| `npm run seed` | Creates accounts and a few seed tracks. Never overwrites an existing user. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests: URL parsing, quota batching, availability derivation. |
| `npm run e2e` | Browser tests in real Chrome: playback, navigation survival, queue auto-advance. |
| `./scripts/verify-phase1.sh` | 38 auth/security checks against a running server. |
| `./scripts/verify-phase2.sh` | 29 library/metadata checks (needs the stub, below). |

### Verifying without a live API key

`scripts/youtube-stub.mjs` speaks the real `videos.list` response shape and counts calls, so
the routes, the batching and the database can be exercised end to end:

```bash
node scripts/youtube-stub.mjs &
YOUTUBE_API_BASE=http://127.0.0.1:3199/youtube/v3 YOUTUBE_API_KEY=stub-key npm run dev &
./scripts/verify-phase2.sh
```

Leave `YOUTUBE_API_BASE` unset everywhere else. It exists only for this.

---

## Keyboard

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` `→` | Seek ∓5 seconds |
| `n` / `p` | Next / previous |

Shortcuts are suppressed while typing in a field.

---

## Architecture, briefly

- **One Next.js App Router app** on Vercel: player, admin surface and API.
- **The YouTube player is mounted in the `(app)` layout, not in a page.** Next preserves
  layouts across client-side navigation, so the iframe is never remounted and audio
  continues when you change tabs. Moving it into a page would stop playback on every
  navigation — this is the single most fragile thing in the app and it is covered by
  `e2e/playback.spec.ts`.
- **Auth is hand-rolled.** Argon2id password hashing, a stateless HMAC-signed session
  cookie (httpOnly, Secure in production, SameSite=Lax) so the hot path does no database
  read, revalidated against the database once per page load via `/api/session` so
  revocation works. CSRF is a signed double-submit token plus an Origin check, on every
  mutating route including login.
- **Metadata is cached in Postgres and never re-fetched on a render.** The API is called on
  add, on an explicit refresh, and by the daily sweep. Nowhere else.
- **No object storage anywhere.** Nothing in this project stores media.

Full reasoning, the cost ledger and every decision with its rejected alternative are in
`docs/build-log.md`; the grounding work is in `docs/phase-0-youtube-grounding.md`.

## Known gaps

- **Not tested on a real Android device.** Queue auto-advance is verified in desktop Chrome,
  which is a different autoplay-gesture regime.
- **The YouTube branding mark is a text link**, not the official logo. The stricter reading
  of the branding guidelines wants the logo, which conflicts with the design system's
  single-accent rule. Unresolved.
- **The 30-day refresh obligation is met by the cron**, so the cron must stay enabled.
- **Desktop 1280px** has styles but is unverified at that width.
- **No admin UI** for adding tracks — use the API as above.
