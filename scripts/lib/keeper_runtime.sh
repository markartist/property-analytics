#!/bin/bash

# Shared non-secret Keeper/KSM runtime defaults for recurring local automation.

PA_MARKETINGOPS_HOME="/Users/mark"
PA_MARKETINGOPS_USER="mark"

PA_KEEPER_DEFAULT_BOOTSTRAP_FILES=(
  "/Users/mark/KSM_Credentials_v2.txt"
  "/Users/mark/KSM_Credentials.txt"
)

pa_prepend_path_once() {
  local segment="$1"
  case ":${PATH:-}:" in
    *":$segment:"*) ;;
    *) export PATH="$segment${PATH:+:${PATH}}" ;;
  esac
}

pa_find_ksm_binary() {
  local segment
  for segment in \
    "/Library/Frameworks/Python.framework/Versions/3.12/bin" \
    "/opt/homebrew/bin" \
    "/usr/local/bin" \
    "/usr/bin" \
    "/bin" \
    "/usr/sbin" \
    "/sbin"
  do
    if [ -x "$segment/ksm" ]; then
      printf '%s\n' "$segment/ksm"
      return 0
    fi
  done
  command -v ksm
}

pa_resolve_keeper_bootstrap_file() {
  if [ -n "${KSM_BOOTSTRAP_TOKEN_FILE:-}" ] && [ -f "${KSM_BOOTSTRAP_TOKEN_FILE}" ]; then
    printf '%s\n' "${KSM_BOOTSTRAP_TOKEN_FILE}"
    return 0
  fi

  local candidate
  for candidate in "${PA_KEEPER_DEFAULT_BOOTSTRAP_FILES[@]}"; do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

pa_ensure_marketingops_keeper_profile() {
  local ksm_bin profile bootstrap_file bootstrap_token
  profile="${KSM_PROFILE:-marketingops}"
  ksm_bin="$(pa_find_ksm_binary 2>/dev/null)" || return 0

  if "$ksm_bin" -p "$profile" secret list --json >/dev/null 2>&1; then
    return 0
  fi

  "$ksm_bin" profile active "$profile" >/dev/null 2>&1 || true
  if "$ksm_bin" -p "$profile" secret list --json >/dev/null 2>&1; then
    return 0
  fi

  bootstrap_file="$(pa_resolve_keeper_bootstrap_file 2>/dev/null)" || return 0
  bootstrap_token="$(tr -d '\r\n' < "$bootstrap_file")"
  bootstrap_token="${bootstrap_token#\"}"
  bootstrap_token="${bootstrap_token%\"}"
  bootstrap_token="${bootstrap_token#\'}"
  bootstrap_token="${bootstrap_token%\'}"
  [ -n "$bootstrap_token" ] || return 0

  "$ksm_bin" profile init -p "$profile" -t "$bootstrap_token" >/dev/null 2>&1 || true
}

pa_keeper_profile_ready() {
  local ksm_bin profile
  profile="${1:-${KSM_PROFILE:-marketingops}}"
  ksm_bin="$(pa_find_ksm_binary 2>/dev/null)" || return 1
  "$ksm_bin" -p "$profile" secret list --json >/dev/null 2>&1
}

pa_load_marketingops_keeper_runtime() {
  export HOME="$PA_MARKETINGOPS_HOME"
  export USER="$PA_MARKETINGOPS_USER"
  export LOGNAME="$PA_MARKETINGOPS_USER"

  pa_prepend_path_once "/Library/Frameworks/Python.framework/Versions/3.12/bin"
  pa_prepend_path_once "/opt/homebrew/bin"
  pa_prepend_path_once "/usr/local/bin"
  pa_prepend_path_once "/usr/bin"
  pa_prepend_path_once "/bin"
  pa_prepend_path_once "/usr/sbin"
  pa_prepend_path_once "/sbin"

  export KSM_PROFILE="${KSM_PROFILE:-marketingops}"
  export KSM_CLOUDFLARE_TOKEN_NOTATION="${KSM_CLOUDFLARE_TOKEN_NOTATION:-keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password}"
  export KSM_BROWSERSTACK_USERNAME_NOTATION="${KSM_BROWSERSTACK_USERNAME_NOTATION:-keeper://y6GUrHJgXsSxybHruXcVWg/field/login}"
  export KSM_BROWSERSTACK_ACCESS_KEY_NOTATION="${KSM_BROWSERSTACK_ACCESS_KEY_NOTATION:-keeper://y6GUrHJgXsSxybHruXcVWg/field/password}"
  export KSM_OPENAI_API_KEY_NOTATION="${KSM_OPENAI_API_KEY_NOTATION:-keeper://fsL4Qd2Q_9CPadtyeBr7-Q/field/password}"
  export KSM_PAGESPEED_API_KEY_NOTATION="${KSM_PAGESPEED_API_KEY_NOTATION:-keeper://XTQySA3sVMlwouNIWGCcCg/field/password}"
  export KSM_GTMETRIX_API_KEY_NOTATION="${KSM_GTMETRIX_API_KEY_NOTATION:-keeper://lkluImtpQHpBWcldViKfiQ/field/password}"
  export KSM_SEMRUSH_API_KEY_NOTATION="${KSM_SEMRUSH_API_KEY_NOTATION:-keeper://q1dizD20qVFSS1ZCYoRPEw/field/password}"
  export KSM_AHREFS_API_KEY_NOTATION="${KSM_AHREFS_API_KEY_NOTATION:-keeper://xbIaayyCqMfrzVFjRei5hA/field/password}"
  export KSM_DATAFORSEO_LOGIN_NOTATION="${KSM_DATAFORSEO_LOGIN_NOTATION:-keeper://8xxZUZB5ISyM1BhBrnaI2w/field/login}"
  export KSM_DATAFORSEO_PASSWORD_NOTATION="${KSM_DATAFORSEO_PASSWORD_NOTATION:-keeper://8xxZUZB5ISyM1BhBrnaI2w/field/password}"
  export KSM_APARTMENTIQ_API_KEY_NOTATION="${KSM_APARTMENTIQ_API_KEY_NOTATION:-keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password}"
  export KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION="${KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION:-keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/login}"
  export KSM_GOOGLE_ADS_CONFIG_UID="${KSM_GOOGLE_ADS_CONFIG_UID:-ulYC1ol6Wg_5U2xvpM6sUw}"
  export KSM_GA4_SERVICE_ACCOUNT_UID="${KSM_GA4_SERVICE_ACCOUNT_UID:-mVZqo2oVSqfS6YDvBDer8g}"
  export KSM_GSC_CLIENT_SECRET_UID="${KSM_GSC_CLIENT_SECRET_UID:-7c95fCoXGYsrrsCA7aCtsg}"
  export KSM_GSC_TOKEN_UID="${KSM_GSC_TOKEN_UID:-0dqRbzl2KvQFSBU5CdXOVQ}"
  export KSM_GBP_CLIENT_SECRET_UID="${KSM_GBP_CLIENT_SECRET_UID:-W06j0C6nHmT25dyr7sVYTA}"
  export KSM_GBP_TOKEN_UID="${KSM_GBP_TOKEN_UID:-yDAkWDdIFlYjvDbjVl6McQ}"
  export KSM_DATA_WAREHOUSE_PASSWORD_NOTATION="${KSM_DATA_WAREHOUSE_PASSWORD_NOTATION:-keeper://zPbXWJ9emVxSKwrUhsRdXQ/field/password}"
  pa_ensure_marketingops_keeper_profile
  if pa_keeper_profile_ready "${KSM_PROFILE:-marketingops}"; then
    export PA_KEEPER_RUNTIME_READY="1"
  else
    unset PA_KEEPER_RUNTIME_READY
  fi
}

pa_require_marketingops_keeper_ready() {
  local ksm_bin profile
  profile="${KSM_PROFILE:-marketingops}"
  ksm_bin="$(pa_find_ksm_binary 2>/dev/null)" || {
    echo "Keeper CLI is not available on the canonical local paths." >&2
    return 1
  }

  pa_ensure_marketingops_keeper_profile

  if "$ksm_bin" -p "$profile" secret list --json >/dev/null 2>&1; then
    export PA_KEEPER_RUNTIME_READY="1"
    return 0
  fi

  echo "Keeper profile '$profile' is not ready after bootstrap. Check local Keeper CLI initialization." >&2
  return 1
}
