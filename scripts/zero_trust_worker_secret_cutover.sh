#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
API_DIR="$ROOT/apps/api"

MODE="print"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
elif [[ "${1:-}" == "--audit" ]]; then
  MODE="audit"
elif [[ "${1:-}" == "--print-retire" ]]; then
  MODE="print-retire"
fi

required_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $1" >&2
    exit 1
  fi
}

clean_value() {
  local raw="$1"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  printf '%s' "$raw"
}

read_keeper_notation() {
  local notation="$1"
  local description="$2"
  local profile="${KSM_PROFILE:-default}"

  required_cmd ksm
  local value
  if ! value="$(ksm -p "$profile" secret notation "$notation" 2>/tmp/zero_trust_ksm_err.$$)"; then
    local err
    err="$(cat /tmp/zero_trust_ksm_err.$$)"
    rm -f /tmp/zero_trust_ksm_err.$$
    echo "ERROR: Keeper lookup failed for $description. profile=$profile notation=$notation stderr=$err" >&2
    exit 1
  fi
  rm -f /tmp/zero_trust_ksm_err.$$
  clean_value "$value"
}

resolve_secret_value() {
  local direct_var="$1"
  local notation_var="$2"
  local description="$3"
  local direct_value="${!direct_var:-}"
  local notation="${!notation_var:-}"

  if [[ -n "$notation" ]]; then
    read_keeper_notation "$notation" "$description"
    return 0
  fi

  if [[ -n "$direct_value" ]]; then
    clean_value "$direct_value"
    return 0
  fi

  return 1
}

resolve_source_label() {
  local direct_var="$1"
  local notation_var="$2"
  if [[ -n "${!notation_var:-}" ]]; then
    printf 'keeper:%s' "${KSM_PROFILE:-default}"
    return 0
  fi
  if [[ -n "${!direct_var:-}" ]]; then
    printf 'env:%s' "$direct_var"
    return 0
  fi
  printf 'unset'
}

print_exports() {
  cat <<'EOF'
# Preferred local-job exports for platform route auth
export PLATFORM_BASE_URL="https://api.venterradev.com"
export PLATFORM_ACCESS_CLIENT_ID="..."
export PLATFORM_ACCESS_CLIENT_SECRET="..."

# Transitional fallback only if still needed
export PLATFORM_SHARED_TOKEN="..."

# Optional VACS / EVS local exports when those clients are wired
export VACS_ACCESS_CLIENT_ID="..."
export VACS_ACCESS_CLIENT_SECRET="..."
export EVS_ACCESS_CLIENT_ID="..."
export EVS_ACCESS_CLIENT_SECRET="..."
EOF
}

print_keeper_exports() {
  cat <<'EOF'
# Keeper-backed notation exports
export KSM_PROFILE="marketingops"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_SEMRUSH_API_KEY_NOTATION="keeper://q1dizD20qVFSS1ZCYoRPEw/field/password"
EOF
}

put_secret() {
  local name="$1"
  local notation_var="${2:-KSM_CLOUDFLARE_${name}_NOTATION}"
  local value
  if ! value="$(resolve_secret_value "$name" "$notation_var" "$name")"; then
    value=""
  fi
  if [[ -z "$value" ]]; then
    echo "SKIP: $name is not set directly and $notation_var is not configured"
    return 0
  fi
  printf '%s' "$value" | npx wrangler secret put "$name" --config "$API_DIR/wrangler.toml"
}

status_line() {
  local label="$1"
  local state="$2"
  local detail="$3"
  printf '%-34s %-10s %s\n' "$label" "$state" "$detail"
}

audit_pair() {
  local prefix="$1"
  local id_var="${prefix}_ACCESS_CLIENT_ID"
  local secret_var="${prefix}_ACCESS_CLIENT_SECRET"
  local shared_var="${prefix}_SHARED_TOKEN"
  local id_notation_var="KSM_CLOUDFLARE_${prefix}_ACCESS_CLIENT_ID_NOTATION"
  local secret_notation_var="KSM_CLOUDFLARE_${prefix}_ACCESS_CLIENT_SECRET_NOTATION"
  local id_value=""
  local secret_value=""
  local shared_value="${!shared_var:-}"
  local id_source
  local secret_source

  if id_value="$(resolve_secret_value "$id_var" "$id_notation_var" "$id_var" 2>/dev/null)"; then
    :
  else
    id_value=""
  fi

  if secret_value="$(resolve_secret_value "$secret_var" "$secret_notation_var" "$secret_var" 2>/dev/null)"; then
    :
  else
    secret_value=""
  fi

  id_source="$(resolve_source_label "$id_var" "$id_notation_var")"
  secret_source="$(resolve_source_label "$secret_var" "$secret_notation_var")"

  if [[ -n "$id_value" && -n "$secret_value" ]]; then
    status_line "$prefix Access credentials" "OK" "client id=$id_source secret=$secret_source"
  elif [[ -n "$id_value" || -n "$secret_value" ]]; then
    status_line "$prefix Access credentials" "WARN" "only one side resolves ($id_source / $secret_source)"
  else
    status_line "$prefix Access credentials" "MISSING" "set $id_var/$secret_var or Keeper notation vars"
  fi

  if [[ -n "$shared_value" ]]; then
    status_line "$prefix shared token" "LEGACY" "$shared_var is still set"
  else
    status_line "$prefix shared token" "CLEAR" "$shared_var is not set"
  fi
}

print_retire_commands() {
  cat <<'EOF'
# Local shell cleanup
unset PLATFORM_SHARED_TOKEN
unset VACS_SHARED_TOKEN
unset EVS_SHARED_TOKEN

# Recommended follow-up: remove any legacy Keeper notation exports you no longer need
unset KSM_PLATFORM_SHARED_TOKEN_NOTATION

# Worker secret cleanup after production verification
cd /Users/mark/Property_Analytics/apps/api
npx wrangler secret delete PLATFORM_SHARED_TOKEN --config wrangler.toml
npx wrangler secret delete VACS_SHARED_TOKEN --config wrangler.toml
npx wrangler secret delete EVS_SHARED_TOKEN --config wrangler.toml
EOF
}

if [[ "$MODE" == "print" ]]; then
  echo "=== Zero Trust Worker Secret Cutover ==="
  echo
  echo "1. Export local-job values:"
  print_exports
  echo
  echo "2. Or export Keeper notation values:"
  print_keeper_exports
  echo
  echo "3. Apply Worker secrets when ready:"
  cat <<'EOF'
cd /Users/mark/Property_Analytics
export KSM_PROFILE="marketingops"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_SEMRUSH_API_KEY_NOTATION="keeper://q1dizD20qVFSS1ZCYoRPEw/field/password"
bash scripts/zero_trust_worker_secret_cutover.sh --apply
EOF
  echo
  echo "4. Deploy the API Worker:"
  echo "cd /Users/mark/Property_Analytics/apps/api && npx wrangler deploy --config wrangler.toml"
  exit 0
fi

if [[ "$MODE" == "audit" ]]; then
  echo "=== Zero Trust Cutover Audit ==="
  echo
  audit_pair PLATFORM
  audit_pair VACS
  audit_pair EVS
  echo
  if [[ -n "${KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION:-}" || -n "${KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION:-}" ]]; then
    status_line "Platform Keeper notation" "SET" "platform Access notation env vars are present"
  else
    status_line "Platform Keeper notation" "INFO" "platform Access notation env vars are not set in this shell"
  fi
  if [[ -n "${KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION:-}" || -n "${KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION:-}" ]]; then
    status_line "VACS Keeper notation" "SET" "vacs Access notation env vars are present"
  else
    status_line "VACS Keeper notation" "INFO" "vacs Access notation env vars are not set in this shell"
  fi
  if [[ -n "${KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION:-}" || -n "${KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION:-}" ]]; then
    status_line "EVS Keeper notation" "SET" "evs Access notation env vars are present"
  else
    status_line "EVS Keeper notation" "INFO" "evs Access notation env vars are not set in this shell"
  fi
  echo
  echo "Next actions:"
  echo "- If any Access credentials are MISSING, create/store them in Keeper and export them before deployment."
  echo "- If any shared token is marked LEGACY, keep it only until production verification is complete."
  echo "- When all three route families are verified on Access credentials, run:"
  echo "  bash scripts/zero_trust_worker_secret_cutover.sh --print-retire"
  exit 0
fi

if [[ "$MODE" == "print-retire" ]]; then
  echo "=== Shared Token Retirement Commands ==="
  echo
  print_retire_commands
  exit 0
fi

required_cmd npx

cd "$ROOT"

put_secret PLATFORM_ACCESS_CLIENT_ID
put_secret PLATFORM_ACCESS_CLIENT_SECRET
put_secret VACS_ACCESS_CLIENT_ID
put_secret VACS_ACCESS_CLIENT_SECRET
put_secret EVS_ACCESS_CLIENT_ID
put_secret EVS_ACCESS_CLIENT_SECRET
put_secret SEMRUSH_API_KEY KSM_SEMRUSH_API_KEY_NOTATION

echo
echo "Zero Trust Worker secret cutover complete."
echo "Next step: deploy with:"
echo "cd $API_DIR && npx wrangler deploy --config wrangler.toml"
