#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="/Users/mark/Library/Logs/Venterra"

mkdir -p "$LOG_DIR"
cd "$ROOT"

export PATH="/Users/mark/.nvm/versions/node/v22.22.1/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_OPTIONS="${NODE_OPTIONS:-}"
export BROWSERSTACK_CREDENTIALS_FILE="${BROWSERSTACK_CREDENTIALS_FILE:-/Users/mark/Downloads/BrowserStack_Credentials.txt}"

eval "$(
  BROWSERSTACK_AUTH_OUTPUT=exports \
  python3 "$ROOT/ops/browserstack/browserstack_auth.py"
)"

echo "[$(date)] BrowserStack auth source: ${BROWSERSTACK_AUTH_SOURCE}"

run_suite() {
  local profile="$1"
  local environment="$2"
  local device="$3"

  echo "[$(date)] Running profile=${profile} environment=${environment} device=${device}"
  EVS_PROFILE="$profile" \
  EVS_ENVIRONMENT="$environment" \
  BROWSERSTACK_DEVICE_PROFILE="$device" \
  node "$ROOT/evs/orchestration/run-pilot-browserstack-smoke.mjs"
}

run_suite "connectivity_smoke" "production" "desktop_chrome"
run_suite "connectivity_smoke" "production" "iphone_safari"
run_suite "critical_cta_smoke" "production" "desktop_chrome"
run_suite "critical_cta_smoke" "production" "iphone_safari"

echo "[$(date)] BrowserStack daily run complete."
