#!/bin/bash
#
# Daily collection retry cycle wrapper.
# Runs the canonical morning retry worker, regenerates the morning report,
# and attempts summary send once the closure gate allows it.
#

set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
cd "$ROOT"

# shellcheck source=/Users/mark/Property_Analytics/scripts/lib/python_runtime.sh
source "$ROOT/scripts/lib/python_runtime.sh"
PYTHON_BIN="$(pa_select_python_runtime)"
# shellcheck source=/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh
source "$ROOT/scripts/lib/keeper_runtime.sh"
pa_load_marketingops_keeper_runtime
pa_require_marketingops_keeper_ready

LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/collection_retry_cycle_$(date +%Y-%m-%d).log"
LOCK_DIR="$LOG_DIR/collection_retry_cycle.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  {
    echo "====================================================================="
    echo "Collection Retry Cycle - $(date)"
    echo "====================================================================="
    echo "Another retry cycle is already running; skipping this invocation."
    echo "====================================================================="
  } 2>&1 | tee -a "$LOG_FILE"
  exit 0
fi

cleanup_lock() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}

trap cleanup_lock EXIT

{
  echo "====================================================================="
  echo "Collection Retry Cycle - $(date)"
  echo "====================================================================="
  echo

  echo "[1/3] Running canonical retry worker..."
  "$PYTHON_BIN" "$ROOT/Data_Collection/orchestration/retry_incomplete_collections.py"
  echo "Retry worker complete"
  echo

  echo "[2/3] Regenerating morning full report from current DB state..."
  "$PYTHON_BIN" "$ROOT/generate_morning_full_report.py"
  echo "Morning full report generation complete"
  echo

  echo "[3/3] Attempting morning full report delivery if closure gates allow..."
  "$PYTHON_BIN" "$ROOT/send_morning_full_report.py"
  echo "Morning full report send step complete"
  echo

  echo "Collection retry cycle completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
