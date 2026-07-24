#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="/Users/mark/Library/Logs/Venterra"

mkdir -p "$LOG_DIR"
cd "$ROOT"

export PATH="/Users/mark/.nvm/versions/node/v22.22.1/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_OPTIONS="${NODE_OPTIONS:-}"
export BROWSERSTACK_DEVICE_PROFILE="${BROWSERSTACK_DEVICE_PROFILE:-desktop_chrome}"
export EVS_LEGACY_HOST_FILTER="${EVS_LEGACY_HOST_FILTER:-venterraliving.com}"
export EVS_EMPLOYEE_PHOTO_SCOPE="${EVS_EMPLOYEE_PHOTO_SCOPE:-legacy}"

eval "$(
  BROWSERSTACK_AUTH_OUTPUT=exports \
  python3 "$ROOT/ops/browserstack/browserstack_auth.py"
)"

echo "[$(date)] BrowserStack auth source: ${BROWSERSTACK_AUTH_SOURCE}"
echo "[$(date)] Running employee photo audit device=${BROWSERSTACK_DEVICE_PROFILE} scope=${EVS_EMPLOYEE_PHOTO_SCOPE} host_filter=${EVS_LEGACY_HOST_FILTER}"

node "$ROOT/evs/orchestration/run-legacy-employee-photo-audit.mjs"

echo "[$(date)] Employee photo audit complete."
