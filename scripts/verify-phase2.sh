#!/usr/bin/env bash
# Phase 2 verification. Runs against a local stub that speaks the YouTube Data
# API response shape (scripts/youtube-stub.mjs), so the route, the batching and
# the database are all exercised for real. The only thing NOT proven here is a
# live call to Google — see the build log.
set -uo pipefail

# Credentials come from .env.local so changing a password in one place does not
# silently break this suite. Shell env still wins if it is already set.
if [ -f .env.local ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|SEED_LISTENER_EMAIL|SEED_LISTENER_PASSWORD)
        value="${value%\"}"; value="${value#\"}"
        eval "current=\${$key:-}"
        [ -n "$current" ] || export "$key=$value"
        ;;
    esac
  done < .env.local
fi

BASE="${BASE:-http://127.0.0.1:3100}"
STUB="${STUB:-http://127.0.0.1:3199}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PW="${SEED_ADMIN_PASSWORD:-admin-password-1234}"
LISTENER_EMAIL="${SEED_LISTENER_EMAIL:-listener@example.com}"
LISTENER_PW="${SEED_LISTENER_PASSWORD:-listener-password-1234}"

JAR_A=$(mktemp); JAR_L=$(mktemp)
pass=0; fail=0
hr() { printf '\n\033[1m%s\033[0m\n' "$1"; }
expect() { if [ "$2" = "$3" ]; then printf '  PASS  %-54s %s\n' "$1" "$3"; pass=$((pass+1));
  else printf '  FAIL  %-54s expected %s, got %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi }

csrf() { curl -s -c "$1" -b "$1" "$BASE/api/session" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'; }
login() { local jar=$1 email=$2 pw=$3; local t; t=$(csrf "$jar")
  curl -s -o /dev/null -X POST -c "$jar" -b "$jar" -H 'Content-Type: application/json' \
    -H "x-csrf-token: $t" -d "{\"email\":\"$email\",\"password\":\"$pw\"}" "$BASE/api/auth/login"; }
# post <jar> <path> <json>  -> prints body
post() { local jar=$1 path=$2 body=$3; local t; t=$(csrf "$jar")
  curl -s -X POST -c "$jar" -b "$jar" -H 'Content-Type: application/json' \
    -H "x-csrf-token: $t" -d "$body" "$BASE$path"; }
poststatus() { local jar=$1 path=$2 body=$3; local t; t=$(csrf "$jar")
  curl -s -o /dev/null -w '%{http_code}' -X POST -c "$jar" -b "$jar" \
    -H 'Content-Type: application/json' -H "x-csrf-token: $t" -d "$body" "$BASE$path"; }

login "$JAR_A" "$ADMIN_EMAIL" "$ADMIN_PW"
login "$JAR_L" "$LISTENER_EMAIL" "$LISTENER_PW"
curl -s -o /dev/null "$STUB/__reset"

hr "1. Every URL form parses to the right id (through the real add route)"
declare -a FORMS=(
  "https://www.youtube.com/watch?v=FORMwatch01|FORMwatch01|canonical watch"
  "https://youtube.com/watch?v=FORMwatch02&list=PLxyz&t=42s|FORMwatch02|watch + list + timestamp"
  "https://youtu.be/FORMshort01|FORMshort01|youtu.be"
  "https://youtu.be/FORMshort02?t=30|FORMshort02|youtu.be + timestamp"
  "https://www.youtube.com/shorts/FORMshrts01|FORMshrts01|shorts"
  "https://www.youtube.com/embed/FORMembed01|FORMembed01|embed"
  "https://www.youtube.com/live/FORMlive001|FORMlive001|live"
  "https://music.youtube.com/watch?v=FORMmusic01|FORMmusic01|music.youtube"
  "https://m.youtube.com/watch?v=FORMmobil01|FORMmobil01|m.youtube"
  "https://www.youtube-nocookie.com/embed/FORMnocok01|FORMnocok01|nocookie embed"
  "FORMbare001|FORMbare001|bare id"
)
for entry in "${FORMS[@]}"; do
  IFS='|' read -r url want label <<< "$entry"
  got=$(post "$JAR_A" /api/admin/tracks "{\"urls\":[\"$url\"]}" \
        | python3 scripts/show.py first-outcome)
  printf '  %-28s %-46s -> %s\n' "$label" "$url" "$got"
  expect "parsed $label" "$want added" "$got"
done

hr "2. Bulk-add 20 URLs in one action — how many API calls did it cost?"
curl -s -o /dev/null "$STUB/__reset"
BULK=$(python3 -c '
import json
urls=[f"https://www.youtube.com/watch?v=BULK{str(i).zfill(7)}" for i in range(20)]
print(json.dumps({"urls":urls}))')
RES=$(post "$JAR_A" /api/admin/tracks "$BULK")
echo "$RES" | python3 scripts/show.py meta
STATS=$(curl -s "$STUB/__stats")
echo "  stub saw: $STATS"
expect "20 URLs added" 20 "$(echo "$RES" | python3 scripts/show.py meta-key added)"
expect "20 URLs cost 1 API call" 1 "$(echo "$STATS" | python3 -c 'import json,sys;print(json.load(sys.stdin)[chr(99)+"alls"])')"
expect "that call carried 20 ids" 20 "$(echo "$STATS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["batches"][0])')"

hr "3. Batching respects the 50-id ceiling — 120 URLs"
curl -s -o /dev/null "$STUB/__reset"
BIG=$(python3 -c '
import json
urls=[f"https://youtu.be/BIG{str(i).zfill(8)}" for i in range(120)]
print(json.dumps({"urls":urls}))')
post "$JAR_A" /api/admin/tracks "$BIG" | python3 scripts/show.py meta
STATS=$(curl -s "$STUB/__stats")
echo "  stub saw: $STATS"
expect "120 URLs cost 3 API calls" 3 "$(echo "$STATS" | python3 -c 'import json,sys;print(json.load(sys.stdin)[chr(99)+"alls"])')"
expect "batch sizes are 50,50,20" "[50, 50, 20]" "$(echo "$STATS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["batches"])')"

hr "4. Malformed and non-video inputs are rejected clearly, with no quota spent"
curl -s -o /dev/null "$STUB/__reset"
post "$JAR_A" /api/admin/tracks '{"urls":[
  "https://youtu.be/tooshort",
  "https://youtu.be/waaaaaytoolong",
  "https://vimeo.com/12345678",
  "https://www.youtube.com/playlist?list=PLabc",
  "https://www.youtube.com/@SomeChannel",
  "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"
]}' | python3 -c '
import json,sys
d=json.load(sys.stdin)
for r in d["data"]: print(f"  {r[\"status\"]:<10} {r[\"input\"][:52]:<54} {r.get(\"reason\",\"\")}")
print("  meta:",d["meta"])'
STATS=$(curl -s "$STUB/__stats")
expect "6 invalid inputs" 6 "$(post "$JAR_A" /api/admin/tracks '{"urls":["https://youtu.be/tooshort","https://youtu.be/waaaaaytoolong","https://vimeo.com/12345678","https://www.youtube.com/playlist?list=PLabc","https://www.youtube.com/@SomeChannel","https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"]}' | python3 scripts/show.py meta-key invalid)"
expect "invalid inputs spend 0 quota" 0 "$(echo "$STATS" | python3 -c 'import json,sys;print(json.load(sys.stdin)[chr(99)+"alls"])')"

hr "5. A duplicate is rejected, and costs no quota"
curl -s -o /dev/null "$STUB/__reset"
post "$JAR_A" /api/admin/tracks '{"urls":["https://www.youtube.com/watch?v=FORMwatch01"]}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("  ",d["data"][0]["status"],d["data"][0]["videoId"]);print("  meta:",d["meta"])'
expect "duplicate spends 0 quota" 0 "$(curl -s "$STUB/__stats" | python3 -c 'import json,sys;print(json.load(sys.stdin)["calls"])')"
echo "  --- and a repeat inside one paste is collapsed ---"
post "$JAR_A" /api/admin/tracks '{"text":"https://youtu.be/DUPEDUPE001 https://youtu.be/DUPEDUPE001 DUPEDUPE001"}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("  meta:",d["meta"])'

hr "6. Availability is derived, not assumed"
post "$JAR_A" /api/admin/tracks '{"urls":["MISSINGxxxx","NOEMBEDxxxx","BLOCKEDxxxx","AGEGATExxxx","ALLOWUSxxxx","LIVENOWxxxx","KIDSVIDxxxx"]}' \
  | python3 scripts/show.py outcome-ids
echo "  --- stored availability for those ids ---"
curl -s -b "$JAR_A" "$BASE/api/tracks?limit=100" | python3 scripts/show.py availability NOEMBEDxxxx BLOCKEDxxxx AGEGATExxxx ALLOWUSxxxx LIVENOWxxxx KIDSVIDxxxx

hr "7. Authorization on every write route"
expect "listener POST /api/admin/tracks -> 403" 403 "$(poststatus "$JAR_L" /api/admin/tracks '{"urls":["FORMwatch01"]}')"
expect "anonymous POST /api/admin/tracks -> 401" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/admin/tracks")"
expect "admin POST without CSRF -> 403" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -b "$JAR_A" -H 'Content-Type: application/json' \
      -d '{"urls":["FORMwatch01"]}' "$BASE/api/admin/tracks")"

hr "8. Inline edit touches only the owner's additive fields"
# Add a dedicated track for this section so the lookup is deterministic:
# /api/tracks is ordered by added_at DESC, so limit=1 is exactly this row.
post "$JAR_A" /api/admin/tracks '{"urls":["EDITMExxxxx"]}' > /dev/null
TID=$(curl -s -b "$JAR_A" "$BASE/api/tracks?limit=1" | python3 scripts/show.py id-for EDITMExxxxx)
if [ -z "$TID" ]; then printf '  FAIL  could not resolve the track id\n'; fail=$((fail+1)); fi
echo "  track id: ${TID:-<none>}"
T=$(csrf "$JAR_A")
curl -s -X PATCH -b "$JAR_A" -H 'Content-Type: application/json' -H "x-csrf-token: $T" \
  -d '{"sortArtist":"Aster Line","note":"good one"}' "$BASE/api/admin/tracks/$TID" \
  | python3 scripts/show.py data
T=$(csrf "$JAR_A")
expect "PATCH title is refused (metadata is unalterable)" 400 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -b "$JAR_A" -H 'Content-Type: application/json' \
      -H "x-csrf-token: $T" -d '{"title":"My Own Title"}' "$BASE/api/admin/tracks/$TID")"
T=$(csrf "$JAR_A")
expect "PATCH by a listener -> 403" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -b "$JAR_L" -H 'Content-Type: application/json' \
      -H "x-csrf-token: $(csrf "$JAR_L")" -d '{"note":"nope"}' "$BASE/api/admin/tracks/$TID")"

hr "9. Delete removes the row"
T=$(csrf "$JAR_A")
expect "DELETE track" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -b "$JAR_A" \
  -H "x-csrf-token: $T" "$BASE/api/admin/tracks/$TID")"
T=$(csrf "$JAR_A")
expect "DELETE again -> 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -b "$JAR_A" \
  -H "x-csrf-token: $T" "$BASE/api/admin/tracks/$TID")"
expect "DELETE with a non-uuid id -> 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -b "$JAR_A" \
  -H "x-csrf-token: $(csrf "$JAR_A")" "$BASE/api/admin/tracks/not-a-uuid")"

hr "10. Library reads are paginated"
curl -s -b "$JAR_A" "$BASE/api/tracks?limit=3&offset=0" | python3 scripts/show.py page
expect "limit=0 rejected" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" "$BASE/api/tracks?limit=0")"
expect "limit=9999 rejected" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR_A" "$BASE/api/tracks?limit=9999")"

hr "11. Refresh re-reads metadata, oldest first, batched"
curl -s -o /dev/null "$STUB/__reset"
post "$JAR_A" /api/admin/tracks/refresh '{"limit":60}' \
  | python3 scripts/show.py data
echo "  stub saw: $(curl -s "$STUB/__stats")"

rm -f "$JAR_A" "$JAR_L"
printf '\n\033[1m%s\033[0m\n' "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
