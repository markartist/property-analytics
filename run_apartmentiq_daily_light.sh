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
LOG_FILE="$LOG_DIR/apartmentiq_daily_light_$(date +%Y-%m-%d).log"
LOCK_DIR="$LOG_DIR/apartmentiq_daily_light.lock"
MAX_COMP_SETS="${APARTMENTIQ_DAILY_MAX_COMP_SETS:-5}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ApartmentIQ daily light already running; skipping $(date)." | tee -a "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

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
