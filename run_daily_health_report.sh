#!/bin/bash
#
# Morning Full Portfolio Report - Generate and Email
#
# Daily launchd wrapper. Generates the upgraded morning full report
# and sends it to recipients.

set -euo pipefail

cd "$(dirname "$0")"

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
  python3 generate_morning_full_report.py
  echo "Generation complete"
  echo

  echo "[2/3] Sending morning full report..."
  if [[ "${MORNING_REPORT_DRY_RUN:-0}" == "1" ]]; then
    python3 send_morning_full_report.py --dry-run
  else
    python3 send_morning_full_report.py
  fi
  echo "Email send complete"
  echo

  if [[ "${MORNING_REPORT_DRY_RUN:-0}" == "1" ]]; then
    echo "[3/3] Skipping acceptance check in dry-run mode"
  else
    echo "[3/3] Verifying delivery acceptance gates..."
    python3 scripts/verify_morning_delivery.py
    echo "Acceptance checks passed"
  fi
  echo

  echo "Morning full report workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
