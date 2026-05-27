#!/bin/bash
set -Eeuo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
RUN_DATE="$(date +%Y-%m-%d)"
DISPLAY_DATE="$(python3 - <<'PY' "$RUN_DATE"
from datetime import datetime
import sys
print(datetime.strptime(sys.argv[1], "%Y-%m-%d").strftime("%m/%d/%Y"))
PY
)"
LOG_FILE="$LOG_DIR/pilot_data_exports_daily_${RUN_DATE}.log"
LOCK_DIR="$LOG_DIR/pilot_data_exports_daily.lock"
CURRENT_STAGE="Bootstrap"
FAILURE_ALERT_SENT=0

export PATH="/Users/mark/.nvm/versions/node/v22.22.1/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PILOT_SUMMARY_EMAILS_ENABLED=1

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date)] Pilot data export job is already running; skipping duplicate." | tee -a "$LOG_FILE"
  exit 0
fi

cleanup_lock() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}
trap cleanup_lock EXIT

send_failure_alert() {
  local stage="$1"
  local details="$2"
  FAILURE_ALERT_SENT=1
  set +e
  python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py" \
    --stage "Pilot Data Exports - ${stage}" \
    --date "$RUN_DATE" \
    --details "$details"
  set -e
}

handle_error() {
  local exit_code="$1"
  local line_no="$2"
  local command="$3"
  if [ "$FAILURE_ALERT_SENT" -eq 0 ]; then
    send_failure_alert \
      "$CURRENT_STAGE" \
      "Pilot data export automation failed for ${DISPLAY_DATE}.

Exit code: ${exit_code}
Line: ${line_no}
Command: ${command}
Log file: ${LOG_FILE}

Failure notifications for this automation are intentionally addressed only to mlaufhutte@venterraliving.com."
  fi
  exit "$exit_code"
}
trap 'handle_error $? ${LINENO} "$BASH_COMMAND"' ERR

{
  echo "====================================================================="
  echo "Pilot Data Exports Daily - $(date)"
  echo "====================================================================="
  echo

  CURRENT_STAGE="Primary GTMetrix collection"
  echo "[1/8] Collecting missing pilot/control GTMetrix rows for ${RUN_DATE}..."
  python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_control_gtmetrix.py" \
    --date "$RUN_DATE" \
    --runs 1 \
    --batch-size 2 \
    --batch-delay-seconds 180 \
    --max-wait-seconds 240 \
    --poll-interval-seconds 5 \
    --property-retries 0 \
    --retry-delay-seconds 45 \
    --missing-only-for-date
  echo

  CURRENT_STAGE="Primary GTMetrix validation"
  echo "[2/8] Validating pilot/control GTMetrix rows..."
  python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_control_gtmetrix.py" --date "$RUN_DATE"
  echo

  CURRENT_STAGE="Twin GTMetrix collection"
  echo "[3/8] Collecting missing twin/reference GTMetrix rows for ${RUN_DATE}..."
  python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_twin_gtmetrix.py" \
    --date "$RUN_DATE" \
    --runs 1 \
    --batch-size 2 \
    --batch-delay-seconds 120 \
    --max-wait-seconds 240 \
    --poll-interval-seconds 5 \
    --property-retries 0 \
    --retry-delay-seconds 45 \
    --missing-only-for-date
  echo

  CURRENT_STAGE="Twin GTMetrix validation"
  echo "[4/8] Validating twin/reference GTMetrix rows..."
  python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_twin_gtmetrix.py" --date "$RUN_DATE"
  echo

  CURRENT_STAGE="PSI collection"
  echo "[5/8] Collecting PSI rows for ${RUN_DATE}..."
  python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_control_psi.py" \
    --date "$RUN_DATE" \
    --strategies mobile
  echo

  CURRENT_STAGE="PSI validation"
  echo "[6/8] Validating PSI rows..."
  python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_control_psi.py" \
    --date "$RUN_DATE" \
    --strategies mobile
  echo

  CURRENT_STAGE="CSV export"
  echo "[7/8] Exporting dated CSV files..."
  python3 "$ROOT/pilot_control_cwv/scripts/export_gtmetrix_daily_scores.py" \
    --date "$RUN_DATE" \
    --output-dir "/Users/mark/Downloads"
  python3 "$ROOT/pilot_control_cwv/scripts/export_psi_day_over_day_scores.py" \
    --output-dir "/Users/mark/Downloads"
  test -f "/Users/mark/Downloads/GTMetrix_Daily_Scores_${RUN_DATE}.csv"
  test -f "/Users/mark/Downloads/PSI_Day_Over_Day_Scores_${RUN_DATE}.csv"
  echo

  CURRENT_STAGE="Success email"
  echo "[8/8] Sending Pilot Data Exports email to Mark and Chris..."
  python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_data_exports_email.py" \
    --date "$DISPLAY_DATE"
  echo

  CURRENT_STAGE="Completed"
  echo "Pilot data exports completed successfully at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
