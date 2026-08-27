#!/usr/bin/env bash
# Starts everything needed to run the app locally, and stops it all cleanly on
# Ctrl-C. One command, no leftover background processes.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
STUB_PORT="${STUB_PORT:-3199}"
PATH="/usr/local/opt/postgresql@16/bin:$PATH"

say() { printf '\033[1m%s\033[0m\n' "$1"; }
die() { printf '\033[31m%s\033[0m\n' "$1"; exit 1; }

[ -f .env.local ] || die "No .env.local. Run: cp .env.example .env.local  (then fill it in)"

# --- Postgres ---------------------------------------------------------------
DB_URL=$(grep '^DATABASE_URL' .env.local | sed 's/^[^=]*=//; s/^"//; s/"$//')
[ -n "$DB_URL" ] || die "DATABASE_URL is not set in .env.local"
if ! psql "$DB_URL" -tAc 'select 1' >/dev/null 2>&1; then
  die "Cannot reach the database.
  Local Postgres:  brew services start postgresql@16
  Then:            createdb music_player_dev"
fi
say "postgres        reachable"

# --- Migrations -------------------------------------------------------------
npm run migrate --silent >/dev/null 2>&1 || die "Migration failed. Run 'npm run migrate' to see why."
TRACKS=$(psql "$DB_URL" -tAc 'select count(*) from tracks' 2>/dev/null | tr -d ' ')
say "migrations      up to date ($TRACKS tracks)"
if [ "$TRACKS" = "0" ]; then
  npm run seed --silent 2>&1 | sed 's/^/  /'
fi

# --- Clean up whatever we start --------------------------------------------
PIDS=()
cleanup() {
  printf '\n\033[1mstopping…\033[0m\n'
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# --- YouTube: real key if present, otherwise the local stub -----------------
KEY=$(grep '^YOUTUBE_API_KEY' .env.local | sed 's/^[^=]*=//; s/^"//; s/"$//')
if [ -n "$KEY" ]; then
  say "youtube         LIVE api key found — real metadata"
  unset YOUTUBE_API_BASE
else
  node scripts/youtube-stub.mjs >/tmp/mp-stub.log 2>&1 &
  PIDS+=($!)
  sleep 1
  say "youtube         no key set — using the local stub on :$STUB_PORT"
  say "                (playback is still real; only metadata is stubbed)"
  export YOUTUBE_API_BASE="http://127.0.0.1:$STUB_PORT/youtube/v3"
  export YOUTUBE_API_KEY="stub-key"
fi

# --- The app ----------------------------------------------------------------
npx next dev -p "$PORT" >/tmp/mp-dev.log 2>&1 &
PIDS+=($!)

for i in $(seq 1 45); do
  curl -sf -o /dev/null "http://localhost:$PORT/api/session" && break
  [ "$i" = 45 ] && { tail -20 /tmp/mp-dev.log; die "The app did not start."; }
  sleep 1
done

ADMIN_EMAIL=$(grep '^SEED_ADMIN_EMAIL' .env.local | sed 's/^[^=]*=//; s/^"//; s/"$//')
printf '\n'
say "  ready  ->  http://localhost:$PORT"
printf '  sign in: %s\n' "${ADMIN_EMAIL:-admin@example.com / admin-password-1234}"
printf '  logs:    tail -f /tmp/mp-dev.log\n'
printf '  stop:    Ctrl-C\n\n'

wait
