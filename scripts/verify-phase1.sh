#!/usr/bin/env bash
# Phase 1 verification. Every check prints the real status code and, where the
# brief asks for it, the real Set-Cookie header. No check is softened to pass.
set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3100}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PW="${SEED_ADMIN_PASSWORD:-admin-password-1234}"
LISTENER_EMAIL="${SEED_LISTENER_EMAIL:-listener@example.com}"
LISTENER_PW="${SEED_LISTENER_PASSWORD:-listener-password-1234}"

JAR_A=$(mktemp); JAR_L=$(mktemp); JAR_X=$(mktemp)
pass=0; fail=0

hr() { printf '\n\033[1m%s\033[0m\n' "$1"; }
# expect <label> <expected-status> <actual-status>
expect() {
  if [ "$2" = "$3" ]; then printf '  PASS  %-52s %s\n' "$1" "$3"; pass=$((pass+1));
  else printf '  FAIL  %-52s expected %s, got %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# Mint a CSRF token into a jar and echo it.
csrf() { # $1 = jar
  curl -s -c "$1" -b "$1" "$BASE/api/session" \
    | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

hr "1. GET /api/session — mints the CSRF cookie"
RAW=$(curl -s -D - -c "$JAR_A" -o /dev/null "$BASE/api/session")
echo "$RAW" | grep -iE '^HTTP/|^set-cookie:' | sed 's/^/  /'
expect "GET /api/session" 200 "$(echo "$RAW" | awk '/^HTTP/{print $2; exit}')"

hr "2. Login WITHOUT a CSRF token must be rejected"
CODE=$(status -X POST -c "$JAR_X" -b "$JAR_X" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}" "$BASE/api/auth/login")
expect "POST /api/auth/login (no CSRF header)" 403 "$CODE"
curl -s -X POST -c "$JAR_X" -b "$JAR_X" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}" "$BASE/api/auth/login" | sed 's/^/  body: /'

hr "3. Login with a CSRF token but the WRONG password"
T=$(csrf "$JAR_X")
CODE=$(status -X POST -c "$JAR_X" -b "$JAR_X" -H 'Content-Type: application/json' \
  -H "x-csrf-token: $T" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"wrong-password\"}" \
  "$BASE/api/auth/login")
expect "POST /api/auth/login (bad password)" 401 "$CODE"

hr "4. Admin login — full Set-Cookie flags"
T=$(csrf "$JAR_A")
RAW=$(curl -s -D - -c "$JAR_A" -b "$JAR_A" -o /dev/null -X POST \
  -H 'Content-Type: application/json' -H "x-csrf-token: $T" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}" "$BASE/api/auth/login")
echo "$RAW" | grep -iE '^HTTP/|^set-cookie:' | sed 's/^/  /'
expect "POST /api/auth/login (admin)" 200 "$(echo "$RAW" | awk '/^HTTP/{print $2; exit}')"

hr "5. Protected route without a session"
expect "GET /api/tracks (anonymous)" 401 "$(status "$BASE/api/tracks")"

hr "6. Protected route with the admin session"
expect "GET /api/tracks (admin)" 200 "$(status -b "$JAR_A" "$BASE/api/tracks")"
curl -s -b "$JAR_A" "$BASE/api/tracks?limit=2" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  meta:",d["meta"]); [print("  -",t["youtube_id"],t["title"]) for t in d["data"]]'

hr "7. Admin-only route with the ADMIN session"
expect "GET /api/admin/users (admin)" 200 "$(status -b "$JAR_A" "$BASE/api/admin/users")"

hr "8. Listener login, then the same admin route"
T=$(csrf "$JAR_L")
CODE=$(status -X POST -c "$JAR_L" -b "$JAR_L" -H 'Content-Type: application/json' \
  -H "x-csrf-token: $T" -d "{\"email\":\"$LISTENER_EMAIL\",\"password\":\"$LISTENER_PW\"}" \
  "$BASE/api/auth/login")
expect "POST /api/auth/login (listener)" 200 "$CODE"
expect "GET /api/tracks (listener)" 200 "$(status -b "$JAR_L" "$BASE/api/tracks")"
expect "GET /api/admin/users (listener) -> 403" 403 "$(status -b "$JAR_L" "$BASE/api/admin/users")"
curl -s -b "$JAR_L" "$BASE/api/admin/users" | sed 's/^/  body: /'

hr "9. Create a user as admin (there is no public sign-up)"
T=$(csrf "$JAR_A")
NEW="verify-$$@example.com"
CODE=$(status -X POST -b "$JAR_A" -c "$JAR_A" -H 'Content-Type: application/json' \
  -H "x-csrf-token: $T" \
  -d "{\"email\":\"$NEW\",\"password\":\"a-long-enough-password\",\"displayName\":\"Verify\"}" \
  "$BASE/api/admin/users")
expect "POST /api/admin/users (admin creates)" 201 "$CODE"
T=$(csrf "$JAR_A")
CODE=$(status -X POST -b "$JAR_A" -c "$JAR_A" -H 'Content-Type: application/json' \
  -H "x-csrf-token: $T" \
  -d "{\"email\":\"$NEW\",\"password\":\"a-long-enough-password\",\"displayName\":\"Verify\"}" \
  "$BASE/api/admin/users")
expect "POST /api/admin/users (duplicate) -> 409" 409 "$CODE"
T=$(csrf "$JAR_L")
CODE=$(status -X POST -b "$JAR_L" -c "$JAR_L" -H 'Content-Type: application/json' \
  -H "x-csrf-token: $T" \
  -d "{\"email\":\"nope-$$@example.com\",\"password\":\"a-long-enough-password\",\"displayName\":\"X\"}" \
  "$BASE/api/admin/users")
expect "POST /api/admin/users (listener) -> 403" 403 "$CODE"

hr "10. Rate limiting — 5 failures in 15 min for one email+IP, then 429"
RL="ratelimit-$$@example.com"
for i in 1 2 3 4 5 6 7; do
  T=$(csrf "$JAR_X")
  CODE=$(status -X POST -c "$JAR_X" -b "$JAR_X" -H 'Content-Type: application/json' \
    -H "x-csrf-token: $T" -d "{\"email\":\"$RL\",\"password\":\"wrong\"}" \
    "$BASE/api/auth/login")
  printf '  attempt %d -> %s\n' "$i" "$CODE"
  [ "$i" = 7 ] && expect "7th attempt is rate-limited" 429 "$CODE"
done

hr "11. Logout clears the session cookie"
T=$(csrf "$JAR_A")
RAW=$(curl -s -D - -b "$JAR_A" -c "$JAR_A" -o /dev/null -X POST -H "x-csrf-token: $T" \
  "$BASE/api/auth/logout")
echo "$RAW" | grep -iE '^HTTP/|^set-cookie: mp_session' | sed 's/^/  /'
expect "POST /api/auth/logout" 200 "$(echo "$RAW" | awk '/^HTTP/{print $2; exit}')"
expect "GET /api/tracks after logout" 401 "$(status -b "$JAR_A" "$BASE/api/tracks")"

hr "12. A forged session cookie is rejected (HMAC holds)"
FORGED=$(python3 -c "
import base64,json,time
p=base64.urlsafe_b64encode(json.dumps({'uid':'00000000-0000-0000-0000-000000000000','role':'admin','sv':1,'exp':int(time.time())+3600}).encode()).rstrip(b'=').decode()
print(p+'.'+base64.urlsafe_b64encode(b'x'*32).rstrip(b'=').decode())")
expect "GET /api/admin/users (forged cookie) -> 401" 401 \
  "$(status -H "Cookie: mp_session=$FORGED" "$BASE/api/admin/users")"

hr "13. Cookie flags are ASSERTED, not just printed"
T=$(csrf "$JAR_A")
RAW=$(curl -s -D - -c "$JAR_A" -b "$JAR_A" -o /dev/null -X POST \
  -H 'Content-Type: application/json' -H "x-csrf-token: $T" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}" "$BASE/api/auth/login")
SC=$(echo "$RAW" | grep -i '^set-cookie: mp_session' | head -1)
case "$SC" in *HttpOnly*) expect "mp_session is HttpOnly" yes yes;; *) expect "mp_session is HttpOnly" yes no;; esac
case "$SC" in *SameSite=lax*|*SameSite=Lax*) expect "mp_session is SameSite=Lax" yes yes;; *) expect "mp_session is SameSite=Lax" yes no;; esac
case "$SC" in *Path=/*) expect "mp_session has Path=/" yes yes;; *) expect "mp_session has Path=/" yes no;; esac
CS=$(echo "$RAW" | grep -ic '^set-cookie: mp_csrf.*httponly' || true)
expect "mp_csrf is NOT HttpOnly (client must echo it)" 0 "$CS"

hr "14. CSRF: mismatched Origin, and a token from another session"
expect "POST with a foreign Origin -> 403" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -b "$JAR_A" \
      -H 'Content-Type: application/json' -H "x-csrf-token: $(csrf "$JAR_A")" \
      -H 'Origin: https://evil.test' -d '{}' "$BASE/api/auth/logout")"
FOREIGN=$(csrf "$JAR_L")
expect "POST with another session's CSRF token -> 403" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -b "$JAR_A" \
      -H 'Content-Type: application/json' -H "x-csrf-token: $FOREIGN" -d '{}' \
      "$BASE/api/auth/logout")"

hr "15. Session cookie tampering"
GOOD=$(grep mp_session "$JAR_A" | awk '{print $NF}')
BODY=${GOOD%.*}
expect "stripped signature -> 401" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: mp_session=$BODY." "$BASE/api/tracks")"
expect "no dot at all -> 401" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: mp_session=$BODY" "$BASE/api/tracks")"
EXPIRED=$(python3 -c "
import base64,json,hmac,hashlib,os,sys
p=base64.urlsafe_b64encode(json.dumps({'uid':'00000000-0000-0000-0000-000000000000','role':'admin','sv':1,'exp':1}).encode()).rstrip(b'=').decode()
print(p+'.'+base64.urlsafe_b64encode(hmac.new(os.environ['SS'].encode(),(b'mp.session.v1|'+p.encode()),hashlib.sha256).digest()).rstrip(b'=').decode())" 2>/dev/null)
if [ -n "$EXPIRED" ]; then
  expect "correctly signed but expired -> 401" 401 \
    "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: mp_session=$EXPIRED" "$BASE/api/tracks")"
fi

hr "16. Revocation actually revokes (session_version)"
UID_L=$(curl -s -b "$JAR_A" "$BASE/api/admin/users" \
  | python3 -c "import json,sys;print(next(u['id'] for u in json.load(sys.stdin)['data'] if u['role']=='listener'))")
echo "  listener id: $UID_L"
expect "listener session valid before revocation" 200 "$(status -b "$JAR_L" "$BASE/api/tracks")"
T=$(csrf "$JAR_A")
expect "admin forces sign-out-everywhere" 200 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -b "$JAR_A" -H 'Content-Type: application/json' \
      -H "x-csrf-token: $T" -d '{"signOutEverywhere":true}' "$BASE/api/admin/users/$UID_L")"
LU=$(curl -s -c "$JAR_L" -b "$JAR_L" "$BASE/api/session" | sed -n 's/.*"user":\(null\).*/\1/p')
expect "listener session is dropped on next /api/session" null "${LU:-notnull}"
expect "listener cookie no longer works" 401 "$(status -b "$JAR_L" "$BASE/api/tracks")"

hr "17. Migrations are re-runnable and checksummed"
OUT=$(npm run migrate 2>&1 | tail -2)
echo "$OUT" | sed 's/^/  /'
case "$OUT" in *"0 applied"*) expect "re-running migrate applies nothing" yes yes;; *) expect "re-running migrate applies nothing" yes no;; esac

hr "18. Security headers are present"
H=$(curl -s -D - -o /dev/null "$BASE/api/session")
for want in "strict-transport-security" "content-security-policy" "x-content-type-options" "referrer-policy"; do
  echo "$H" | grep -qi "^$want:" && expect "header $want" yes yes || expect "header $want" yes no
done
echo "$H" | grep -qi "^cache-control: private, no-store" && expect "authenticated JSON is no-store" yes yes || expect "authenticated JSON is no-store" yes no

hr "19. Cleanup — the suite leaves no rows behind"
for uid in $(curl -s -b "$JAR_A" "$BASE/api/admin/users" \
  | python3 -c "import json,sys;[print(u['id']) for u in json.load(sys.stdin)['data'] if u['email'].startswith('verify-')]"); do
  curl -s -o /dev/null -X DELETE -b "$JAR_A" -H "x-csrf-token: $(csrf "$JAR_A")" "$BASE/api/admin/users/$uid"
done
LEFT=$(curl -s -b "$JAR_A" "$BASE/api/admin/users" \
  | python3 -c "import json,sys;print(sum(1 for u in json.load(sys.stdin)['data'] if u['email'].startswith('verify-')))")
expect "no verify-* users remain" 0 "$LEFT"

rm -f "$JAR_A" "$JAR_L" "$JAR_X"
printf '\n\033[1m%s\033[0m\n' "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
