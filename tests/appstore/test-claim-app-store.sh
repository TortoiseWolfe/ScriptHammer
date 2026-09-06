#!/usr/bin/env bash
# Harness for scripts/claim-app-store.mjs.
#
# Runs the real tool against a stub App Store Connect (the ASC_API_BASE seam),
# with a throwaway key generated here. Never touches Apple, never reads the
# operator's key, ~2s. Same doctrine as tests/rebrand/test-rebrand.sh.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOL="$ROOT/scripts/claim-app-store.mjs"
STUB="$ROOT/tests/appstore/stub-asc.mjs"
PASS=0; FAIL=0
ok(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
no(){ echo "  ✗ $1"; echo "      $2"; FAIL=$((FAIL+1)); }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"; [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null' EXIT

# A throwaway P-256 key. Generated, never the operator's.
mkdir -p "$WORK/keys"
node -e "
const {generateKeyPairSync}=require('node:crypto');
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
require('node:fs').writeFileSync('$WORK/keys/AuthKey_TESTKEY123.p8',privateKey.export({type:'pkcs8',format:'pem'}));
"
export ASC_KEY_PATH="$WORK/keys/AuthKey_TESTKEY123.p8"
export ASC_KEY_ID=TESTKEY123
export ASC_ISSUER_ID=11111111-2222-3333-4444-555555555555

start_stub(){ # $1 = scenario
  SCENARIO="$1" node "$STUB" > "$WORK/stub.out" 2>&1 &
  STUB_PID=$!
  for _ in $(seq 1 50); do
    PORT=$(sed -n 's/^PORT=//p' "$WORK/stub.out" 2>/dev/null | head -1)
    [ -n "$PORT" ] && break
    sleep 0.1
  done
  export ASC_API_BASE="http://127.0.0.1:$PORT"
}
stop_stub(){ kill "$STUB_PID" 2>/dev/null; wait "$STUB_PID" 2>/dev/null; STUB_PID=""; }

run(){ # scenario, expected-exit, label, extra args...
  local sc="$1" want="$2" label="$3"; shift 3
  start_stub "$sc"
  ( cd "$WORK/proj" && node "$TOOL" "geoLARP" --bundle-id com.example.app --force "$@" ) >"$WORK/run.out" 2>&1
  local got=$?
  stop_stub
  if [ "$got" = "$want" ]; then ok "$label (exit $got)"; else no "$label" "expected $want, got $got: $(tail -3 "$WORK/run.out"|tr '\n' ' ')"; fi
}

mkfixture(){ rm -rf "$WORK/proj"; mkdir -p "$WORK/proj"
  echo '{"cli":{"appVersionSource":"remote"},"submit":{"production":{"ios":{"appleId":"leak@example.com"}}}}' > "$WORK/proj/eas.json"
  echo '{"expo":{"name":"Demo","ios":{"supportsTablet":false}}}' > "$WORK/proj/app.json"
}

echo "claim-app-store harness"
mkfixture; run fresh    4 "fresh: no record yet -> WAITING"        --json
mkfixture; run resume   0 "resume: record exists -> success"       --json
mkfixture; run taken    1 "name refused by Apple -> failure"       --json
mkfixture; run mismatch 1 "record bound to wrong bundle id"        --json

# The writers
mkfixture; start_stub resume
( cd "$WORK/proj" && node "$TOOL" "geoLARP" --bundle-id com.example.app --force --json ) >/dev/null 2>&1
stop_stub
grep -q '"ascAppId": "6800000001"' "$WORK/proj/eas.json" && ok "eas.json got ascAppId" || no "eas.json ascAppId" "$(cat "$WORK/proj/eas.json")"
grep -q '"appleTeamId": "TEAMID123"' "$WORK/proj/eas.json" && ok "eas.json got appleTeamId" || no "eas.json appleTeamId" "$(cat "$WORK/proj/eas.json")"
grep -q 'appleId' "$WORK/proj/eas.json" && no "appleId must never be written" "$(cat "$WORK/proj/eas.json")" || ok "appleId stripped, never written"
grep -q '"ITSAppUsesNonExemptEncryption": false' "$WORK/proj/app.json" && ok "app.json got the compliance flag" || no "compliance flag" "$(cat "$WORK/proj/app.json")"
grep -q '"bundleIdentifier": "com.example.app"' "$WORK/proj/app.json" && ok "app.json got bundleIdentifier" || no "bundleIdentifier" "$(cat "$WORK/proj/app.json")"

# --dry-run must not write
mkfixture; BEFORE=$(cat "$WORK/proj/eas.json"); start_stub resume
( cd "$WORK/proj" && node "$TOOL" "geoLARP" --bundle-id com.example.app --dry-run ) >/dev/null 2>&1
stop_stub
[ "$BEFORE" = "$(cat "$WORK/proj/eas.json")" ] && ok "--dry-run wrote nothing" || no "--dry-run wrote nothing" "file changed"

# Unsigned requests must be rejected: proves the stub can fail, and that we sign.
mkfixture; start_stub resume
OUT=$( cd "$WORK/proj" && ASC_KEY_PATH="" ASC_KEY_ID="" node -e "
fetch(process.env.ASC_API_BASE+'/v1/apps').then(r=>{console.log(r.status);process.exit(0)})
" 2>&1 )
stop_stub
[ "$OUT" = "401" ] && ok "stub rejects an unsigned request (negative control)" || no "negative control" "got $OUT"

echo ""
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
