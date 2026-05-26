#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
cd "$ROOT"

export HOME="/Users/mark"
export USER="mark"
export LOGNAME="mark"
export KSM_PROFILE="${KSM_PROFILE:-marketingops}"
export PYTHONUNBUFFERED=1

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
LOG_FILE="$LOG_DIR/apartmentiq_weekly_dive_$(date +%Y-%m-%d).log"
LOCK_DIR="$LOG_DIR/apartmentiq_weekly_dive.lock"
MAX_COMP_SETS="${APARTMENTIQ_WEEKLY_MAX_COMP_SETS:-60}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ApartmentIQ weekly dive already running; skipping $(date)." | tee -a "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

{
  echo "====================================================================="
  echo "ApartmentIQ Weekly Dive - $(date)"
  echo "Log directory: $LOG_DIR"
  echo "Weekly staggered comp-set cap: $MAX_COMP_SETS"
  echo "====================================================================="
  python3 -u "$ROOT/Data_Collection/collectors/apartmentiq_collector.py" --max-comp-sets "$MAX_COMP_SETS" --include-units --include-floorplans
  python3 "$ROOT/scripts/build_property_identity_matrix.py"
  python3 "$ROOT/scripts/generate_apartmentiq_enrichment_summary.py"
  echo "ApartmentIQ Weekly Dive complete at $(date)"
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
