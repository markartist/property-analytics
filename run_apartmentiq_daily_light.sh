#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
cd "$ROOT"

# shellcheck source=/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh
source "$ROOT/scripts/lib/keeper_runtime.sh"
pa_load_marketingops_keeper_runtime
pa_require_marketingops_keeper_ready
export PYTHONUNBUFFERED=1
export APARTMENTIQ_MAX_RETRIES="${APARTMENTIQ_MAX_RETRIES:-1}"
export APARTMENTIQ_RETRY_AFTER_FALLBACK_SECONDS="${APARTMENTIQ_RETRY_AFTER_FALLBACK_SECONDS:-15}"
export APARTMENTIQ_RATE_LIMIT_SLEEP_SECONDS="${APARTMENTIQ_RATE_LIMIT_SLEEP_SECONDS:-2}"

resolve_log_dir() {
  local candidate
  for candidate in \
    "$HOME/Library/Logs/Venterra" \
    "$ROOT/logs/automation" \
    "/tmp/property_analytics_logs"
  do
    if mkdir -p "$candidate" 2>/dev/null && touch "$candidate/.apartmentiq_write_test" 2>/dev/null; then
      rm -f "$candidate/.apartmentiq_write_test"
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

LOG_DIR="$(resolve_log_dir)"
LOG_FILE="$LOG_DIR/apartmentiq_daily_light_$(date +%Y-%m-%d).log"
LOCK_DIR="$LOG_DIR/apartmentiq_daily_light.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
MAX_COMP_SETS="${APARTMENTIQ_DAILY_MAX_COMP_SETS:-5}"
STALE_LOCK_SECONDS="${APARTMENTIQ_DAILY_STALE_LOCK_SECONDS:-21600}"

lock_age_seconds() {
  local lock_path="$1"
  local modified_at now
  modified_at="$(stat -f %m "$lock_path" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  echo $((now - modified_at))
}

lock_is_active() {
  if [ -f "$LOCK_PID_FILE" ]; then
    local existing_pid
    existing_pid="$(tr -d '[:space:]' < "$LOCK_PID_FILE" 2>/dev/null || true)"
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
      return 0
    fi
  fi

  return 1
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if lock_is_active; then
    echo "ApartmentIQ daily light already running; skipping $(date)." | tee -a "$LOG_FILE"
    exit 0
  fi

  if [ "$(lock_age_seconds "$LOCK_DIR")" -lt "$STALE_LOCK_SECONDS" ]; then
    echo "ApartmentIQ daily light lock present without a live pid and below stale threshold; skipping $(date)." | tee -a "$LOG_FILE"
    exit 0
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  echo "Recovered stale ApartmentIQ daily light lock at $(date)." | tee -a "$LOG_FILE"
fi

printf '%s\n' "$$" > "$LOCK_PID_FILE"
trap 'rm -f "$LOCK_PID_FILE"; rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

{
  echo "====================================================================="
  echo "ApartmentIQ Daily Light - $(date)"
  echo "Log directory: $LOG_DIR"
  echo "Daily subject-linked comp-set cap: $MAX_COMP_SETS"
  echo "====================================================================="
  python3 -u "$ROOT/Data_Collection/collectors/apartmentiq_collector.py" --subject-comp-sets-only --max-comp-sets "$MAX_COMP_SETS"
  python3 "$ROOT/scripts/generate_apartmentiq_enrichment_summary.py"
  echo "ApartmentIQ Daily Light complete at $(date)"
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
