#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
API_DIR="$ROOT/apps/api"
CUTOVER_SCRIPT="$ROOT/scripts/zero_trust_worker_secret_cutover.sh"
VERIFY_SCRIPT="$API_DIR/scripts/verify_phase1_platform_cutover.sh"

RUN_APPLY="false"
RUN_DEPLOY="false"
RUN_VERIFY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      RUN_APPLY="true"
      ;;
    --deploy)
      RUN_DEPLOY="true"
      ;;
    --verify)
      RUN_VERIFY="true"
      ;;
    --full)
      RUN_APPLY="true"
      RUN_DEPLOY="true"
      RUN_VERIFY="true"
      ;;
    *)
      echo "Usage: bash scripts/zero_trust_rollout_sequence.sh [--apply] [--deploy] [--verify] [--full]" >&2
      exit 1
      ;;
  esac
  shift
done

required_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

print_header() {
  local label="$1"
  echo
  echo "=== $label ==="
}

required_cmd bash

print_header "Zero Trust Audit"
bash "$CUTOVER_SCRIPT" --audit

if [[ "$RUN_APPLY" != "true" && "$RUN_DEPLOY" != "true" && "$RUN_VERIFY" != "true" ]]; then
  echo
  echo "No mutation flags requested."
  echo "Next options:"
  echo "- add --apply to push Worker secrets from Keeper/env"
  echo "- add --deploy to deploy the API Worker after apply"
  echo "- add --verify to run the platform cutover verification"
  echo "- use --full to run apply, deploy, and verify in sequence"
  exit 0
fi

if [[ "$RUN_APPLY" == "true" ]]; then
  print_header "Apply Worker Secrets"
  required_cmd npx
  bash "$CUTOVER_SCRIPT" --apply
fi

if [[ "$RUN_DEPLOY" == "true" ]]; then
  print_header "Deploy API Worker"
  required_cmd npx
  (
    cd "$API_DIR"
    npx wrangler deploy --config wrangler.toml
  )
fi

if [[ "$RUN_VERIFY" == "true" ]]; then
  print_header "Verify Platform Cutover"
  if [[ -z "${PLATFORM_BASE_URL:-}" ]]; then
    echo "ERROR: PLATFORM_BASE_URL must be set before running verification" >&2
    exit 1
  fi
  bash "$VERIFY_SCRIPT"
fi

echo
echo "Zero Trust rollout sequence complete."
