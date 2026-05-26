#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8787}"

curl \
  --fail \
  --silent \
  --show-error \
  --request POST \
  --cookie "${POP_SESSION_COOKIE:-}" \
  "${API_BASE_URL%/}/v1/directives/seed"

echo
