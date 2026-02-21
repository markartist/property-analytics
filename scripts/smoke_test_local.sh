#!/usr/bin/env bash
# smoke_test_local.sh
# Smoke test for POP Brief API running locally via `wrangler dev`.
# Prerequisites: wrangler dev running on port 8787 with local D1 + migrations applied.
# Idempotent: safe to run multiple times.

set -euo pipefail

BASE="http://localhost:8787"
PASS=0
FAIL=0

check() {
  local desc="$1" expected_status="$2" method="$3" url="$4"
  shift 4
  local body="${1:-}"

  if [ -n "$body" ]; then
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -b cookies.txt -c cookies.txt -d "$body")
  else
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -b cookies.txt -c cookies.txt)
  fi

  if [ "$RESPONSE" = "$expected_status" ]; then
    echo "  ✓ $desc (HTTP $RESPONSE)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc (expected $expected_status, got $RESPONSE)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== POP Brief Smoke Test ==="
echo "Target: $BASE"
echo ""

# Clean up cookie jar
rm -f cookies.txt

echo "--- Health ---"
check "Health check" 200 GET "$BASE/health"

echo ""
echo "--- Auth (unauthenticated) ---"
check "GET /v1/auth/me without auth → 401" 401 GET "$BASE/v1/auth/me"

echo ""
echo "--- Auth (login) ---"
# Note: This requires a user to exist in the local D1 database.
# If no user exists, expect 401 (invalid credentials).
check "POST /v1/auth/login with bad creds → 401" 401 POST "$BASE/v1/auth/login" \
  '{"email":"test@example.com","password":"wrong"}'

echo ""
echo "--- Communities (unauthenticated) ---"
check "GET /v1/communities without auth → 401" 401 GET "$BASE/v1/communities"

echo ""
echo "--- Metrics (unauthenticated) ---"
check "GET /v1/metrics without auth → 401" 401 GET "$BASE/v1/metrics"

echo ""
echo "--- Validation (Friday rule) ---"
# This should fail auth first (401), but if we had a session it would check Friday
check "Analysis without auth → 401" 401 GET "$BASE/v1/analysis?week_ending=2026-02-20"

echo ""
echo "--- 404 handling ---"
check "Unknown route → 404" 404 GET "$BASE/v1/nonexistent"

echo ""
echo "--- Error format ---"
BODY=$(curl -s -X GET "$BASE/v1/nonexistent")
if echo "$BODY" | grep -q '"error"'; then
  echo "  ✓ Error response has correct JSON format"
  PASS=$((PASS + 1))
else
  echo "  ✗ Error response missing expected JSON format"
  FAIL=$((FAIL + 1))
fi

# Cleanup
rm -f cookies.txt

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
