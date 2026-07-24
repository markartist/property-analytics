#!/bin/bash
#
# Governed Data Warehouse daily shadow-harvest wrapper.
# Boots Keeper/KSM once at the outer boundary, then runs the canonical
# seven-step workflow in order with shared logging.
#

set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
cd "$ROOT"

DAYS_BACK="${DW_DAYS_BACK:-1}"
LOG_HOME="/Users/mark"
resolve_log_dir() {
  local candidate
  for candidate in \
    "$LOG_HOME/Library/Logs/Venterra" \
    "$ROOT/logs/automation" \
    "/tmp/property_analytics_logs"
  do
    if mkdir -p "$candidate" 2>/dev/null && touch "$candidate/.dw_write_test" 2>/dev/null; then
      rm -f "$candidate/.dw_write_test"
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

LOG_DIR="$(resolve_log_dir)"
LOG_FILE="$LOG_DIR/data_warehouse_daily_shadow_harvest_$(date +%Y-%m-%d).log"
LOCK_DIR="$LOG_DIR/data_warehouse_daily_shadow_harvest.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
DW_WAIT_UNTIL_REACHABLE="${DW_WAIT_UNTIL_REACHABLE:-1}"
DW_MAX_WAIT_SECONDS="${DW_MAX_WAIT_SECONDS:-14400}"
DW_POLL_SECONDS="${DW_POLL_SECONDS:-300}"
DW_CONNECT_TIMEOUT_MS="${DW_CONNECT_TIMEOUT_MS:-8000}"
DW_SERVER="${DW_SERVER:-sqlreport.ocs-vr.onecornerstone.com}"
DW_PORT="${DW_PORT:-1433}"
STALE_LOCK_SECONDS="${DW_STALE_LOCK_SECONDS:-21600}"

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
    {
      echo "====================================================================="
      echo "Data Warehouse Daily Shadow Harvest - $(date)"
      echo "====================================================================="
      echo "Another run is already in progress; skipping this invocation."
      echo "Lock directory: $LOCK_DIR"
      echo "====================================================================="
    } 2>&1 | tee -a "$LOG_FILE"
    exit 0
  fi

  if [ "$(lock_age_seconds "$LOCK_DIR")" -lt "$STALE_LOCK_SECONDS" ]; then
    {
      echo "====================================================================="
      echo "Data Warehouse Daily Shadow Harvest - $(date)"
      echo "====================================================================="
      echo "Lock directory exists without a live pid and is below the stale threshold; skipping this invocation."
      echo "Lock directory: $LOCK_DIR"
      echo "Stale threshold seconds: $STALE_LOCK_SECONDS"
      echo "====================================================================="
    } 2>&1 | tee -a "$LOG_FILE"
    exit 0
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  echo "Recovered stale Data Warehouse shadow harvest lock at $(date)." | tee -a "$LOG_FILE"
fi

printf '%s\n' "$$" > "$LOCK_PID_FILE"

cleanup_lock() {
  rm -f "$LOCK_PID_FILE"
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}

trap cleanup_lock EXIT

run_step() {
  local label="$1"
  shift
  echo "[$label] $*"
  "$@"
  echo
}

run_connectivity_preflight_once() {
  local status=0

  echo "[preflight] node scripts/check_data_warehouse_keeper_ready.mjs"
  set +e
  node scripts/check_data_warehouse_keeper_ready.mjs
  status=$?
  set -e
  echo

  if [ "$status" -ne 0 ]; then
    return "$status"
  fi

  echo "[preflight] node scripts/check_data_warehouse_connectivity.mjs --server $DW_SERVER --port $DW_PORT --timeout-ms $DW_CONNECT_TIMEOUT_MS"
  set +e
  node scripts/check_data_warehouse_connectivity.mjs \
    --server "$DW_SERVER" \
    --port "$DW_PORT" \
    --timeout-ms "$DW_CONNECT_TIMEOUT_MS"
  status=$?
  set -e
  echo

  return "$status"
}

{
  echo "====================================================================="
  echo "Data Warehouse Daily Shadow Harvest - $(date)"
  echo "====================================================================="
  echo "Repository: $ROOT"
  echo "Log directory: $LOG_DIR"
  echo "Days back: $DAYS_BACK"
  echo "Warehouse server: $DW_SERVER:$DW_PORT"
  echo

  # shellcheck source=/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh
  source "$ROOT/scripts/lib/keeper_runtime.sh"
  pa_load_marketingops_keeper_runtime

  start_epoch="$(date +%s)"
  until run_connectivity_preflight_once; do
    if [ "$DW_WAIT_UNTIL_REACHABLE" != "1" ]; then
      exit 1
    fi

    now_epoch="$(date +%s)"
    elapsed_seconds=$((now_epoch - start_epoch))
    if [ "$elapsed_seconds" -ge "$DW_MAX_WAIT_SECONDS" ]; then
      echo "Data Warehouse connectivity did not become reachable within ${DW_MAX_WAIT_SECONDS}s; failing with the latest sanitized preflight context."
      exit 1
    fi

    echo "Data Warehouse connectivity is not ready; waiting ${DW_POLL_SECONDS}s before retrying."
    sleep "$DW_POLL_SECONDS"
    echo
  done

  run_step "1/7" node scripts/run_data_warehouse_daily_harvest.mjs --days-back "$DAYS_BACK"
  run_step "2/7" node scripts/supply_guest_card_metrics_from_data_warehouse.mjs --days-back "$DAYS_BACK"
  run_step "3/7" node scripts/supply_property_operating_metrics_from_data_warehouse.mjs
  run_step "4/7" node scripts/supply_property_metadata_from_data_warehouse.mjs --apply-matrix-annotations
  run_step "5/7" node scripts/audit_manual_source_replacements.mjs
  run_step "6/7" node scripts/generate_data_warehouse_replacement_review.mjs
  run_step "7/7" node scripts/generate_data_warehouse_captain_advisory.mjs

  echo "Data Warehouse daily shadow harvest completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
