#!/usr/bin/env bash
# CIRQO smoke test: checks that every main endpoint answers with the right shape.
#   ./smoke_test.sh                          test the live Render backend
#   ./smoke_test.sh http://localhost:8000    test a local backend
set -uo pipefail

BASE="${1:-https://frontdoor-api-hiel.onrender.com}"
BASE="${BASE%/}"
OWNER_KEY="fd_demo_owner_2026"
VIEWER_KEY="fd_demo_viewer_2026"
PASS=0
FAIL=0

# check NAME EXPECTED_STATUS REQUIRED_KEY curl-args...
check() {
  local name="$1" want="$2" key="$3"; shift 3
  local body status
  body="$(curl -s -m 90 -w $'\n%{http_code}' "$@")"
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [ "$status" = "$want" ] && printf '%s' "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if '$key' in d else 1)" 2>/dev/null; then
    echo "PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name (status $status, expected $want with key '$key')"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke testing $BASE (first call may take up to a minute if the server is waking up)"
check "health"              200 status        "$BASE/health"
check "shopper questions"   200 questions     "$BASE/api/v1/shopper/questions"
check "shopper recommend"   200 rankingNote   -X POST -H "Content-Type: application/json" \
  -d '{"answers":[{"questionId":"q_budget","optionId":"b_500"},{"questionId":"q_use","optionId":"u_school"}],"swipes":[{"optionId":"s_battery","liked":true},{"optionId":"s_light","liked":true},{"optionId":"s_screen","liked":false},{"optionId":"s_touch","liked":false}]}' \
  "$BASE/api/v1/shopper/recommend"
check "connector manifest"  200 tools         "$BASE/api/v1/connector/manifest"
check "connector query"     200 answerText    -X POST -H "Content-Type: application/json" \
  -d '{"question":"What is the best laptop under $500 for school?","assistantId":"ast_01"}' \
  "$BASE/api/v1/connector/query"
check "connector 422"       422 error         -X POST -H "Content-Type: application/json" -d '{"question":"x"}' "$BASE/api/v1/connector/query"
check "demo accounts"       200 accounts      "$BASE/api/v1/auth/demo-accounts"
check "arcton scope"        200 competitors   "$BASE/api/v1/visibility/summary?brandId=brand_002"
check "unknown brand 404"   404 error         "$BASE/api/v1/visibility/summary?brandId=brand_999"
check "onboard 422"         422 error         -X POST -H "Content-Type: application/json" -d '{"brandName":"X","ownerName":"Y","products":[]}' "$BASE/api/v1/brands/onboard"
check "products"            200 products      "$BASE/api/v1/products"
check "visibility summary"  200 visibilityRate "$BASE/api/v1/visibility/summary"
check "answers"             200 answers       "$BASE/api/v1/answers"
check "sources"             200 sources       "$BASE/api/v1/sources"
check "claims"              200 claims        "$BASE/api/v1/claims"
check "incidents"           200 incidents     "$BASE/api/v1/incidents"
check "owners"              200 owners        "$BASE/api/v1/owners"
check "audit"               200 entries       "$BASE/api/v1/audit"
check "trust metrics"       200 daily         "$BASE/api/v1/metrics/trust"
check "report"              200 impact        "$BASE/api/v1/report"
check "404 error shape"     404 error         "$BASE/api/v1/incidents/inc_does_not_exist"
check "client API no key"   401 error         "$BASE/api/v1/client/visibility"
check "client API owner"    200 incidents     -H "X-API-Key: $OWNER_KEY"  "$BASE/api/v1/client/incidents"
check "client API viewer"   403 error         -H "X-API-Key: $VIEWER_KEY" "$BASE/api/v1/client/incidents"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
