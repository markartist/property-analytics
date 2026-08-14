#!/bin/bash
#
# Morning Full Portfolio Report - Generate and Email
#
# Daily launchd wrapper. Generates the upgraded morning full report
# and sends it to recipients.

set -euo pipefail

cd "$(dirname "$0")"

# shellcheck source=/Users/mark/Property_Analytics/scripts/lib/python_runtime.sh
source "/Users/mark/Property_Analytics/scripts/lib/python_runtime.sh"
PYTHON_BIN="$(pa_select_python_runtime)"
# shellcheck source=/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh
source "/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh"
pa_load_marketingops_keeper_runtime
pa_require_marketingops_keeper_ready

LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily_health_report_$(date +%Y-%m-%d).log"

{
  echo "====================================================================="
  echo "Morning Full Portfolio Report - $(date)"
  echo "====================================================================="
  echo

  echo "[1/3] Generating morning full report..."
  "$PYTHON_BIN" generate_morning_full_report.py
  echo "Generation complete"
  echo

  echo "[2/3] Sending morning full report..."
  if [[ "${MORNING_REPORT_DRY_RUN:-0}" == "1" ]]; then
    "$PYTHON_BIN" send_morning_full_report.py --dry-run
  else
    "$PYTHON_BIN" send_morning_full_report.py
  fi
  echo "Email send complete"
  echo

  if [[ "${MORNING_REPORT_DRY_RUN:-0}" == "1" ]]; then
    echo "[3/3] Skipping acceptance check in dry-run mode"
  else
    echo "[3/3] Verifying delivery acceptance gates..."
    "$PYTHON_BIN" scripts/verify_morning_delivery.py
    echo "Acceptance checks passed"
  fi
  echo

  echo "Morning full report workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
