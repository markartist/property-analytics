#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
DOWNLOADS_DIR="/Users/mark/Downloads"
RUN_DATE="${RUN_DATE:-$(date +%Y-%m-%d)}"
REPORT_DATE="$(date -j -f "%Y-%m-%d" "$RUN_DATE" "+%m-%d-%Y")"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pilot_data_exports_daily_${RUN_DATE}.log"

PILOT_SUMMARY_EMAILS_ENABLED="${PILOT_SUMMARY_EMAILS_ENABLED:-1}"
PILOT_EXPORT_WAIT_UNTIL_FRESH="${PILOT_EXPORT_WAIT_UNTIL_FRESH:-1}"
PILOT_EXPORT_MAX_WAIT_SECONDS="${PILOT_EXPORT_MAX_WAIT_SECONDS:-14400}"
PILOT_EXPORT_POLL_SECONDS="${PILOT_EXPORT_POLL_SECONDS:-300}"
export PATH="/Users/mark/.nvm/versions/node/v22.22.1/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PILOT_SUMMARY_EMAILS_ENABLED

PSI_PATH="$DOWNLOADS_DIR/PSI_Day_Over_Day_Scores_${RUN_DATE}.csv"
GT_PATH="$DOWNLOADS_DIR/GTMetrix_Daily_Scores_${RUN_DATE}.csv"

run_exports_once() {
  local gt_exit=0
  local psi_exit=0

  echo "[1/3] Exporting GTMetrix daily scores for ${RUN_DATE}..."
  set +e
  python3 "$ROOT/pilot_control_cwv/scripts/export_gtmetrix_daily_scores.py" \
    --date "$RUN_DATE" \
    --output-dir "$DOWNLOADS_DIR"
  gt_exit=$?
  set -e
  if [ "$gt_exit" -eq 0 ]; then
    echo "GTMetrix export complete"
  else
    echo "GTMetrix export not ready yet for ${RUN_DATE} (exit ${gt_exit})."
  fi
  echo

  echo "[2/3] Exporting PSI day-over-day scores..."
  set +e
  python3 "$ROOT/pilot_control_cwv/scripts/export_psi_day_over_day_scores.py" \
    --output-dir "$DOWNLOADS_DIR"
  psi_exit=$?
  set -e
  if [ "$psi_exit" -eq 0 ]; then
    echo "PSI export complete"
  else
    echo "PSI export not ready yet for ${RUN_DATE} (exit ${psi_exit})."
  fi
  echo

  if [ "$gt_exit" -eq 0 ] && [ "$psi_exit" -eq 0 ] && [ -f "$PSI_PATH" ] && [ -f "$GT_PATH" ]; then
    return 0
  fi

  echo "Fresh dated export validation failed for ${RUN_DATE}."
  echo "Expected PSI: $PSI_PATH"
  echo "Expected GTMetrix: $GT_PATH"
  return 1
}

{
  echo "====================================================================="
  echo "Pilot Data Exports - $(date)"
  echo "====================================================================="
  echo

  start_epoch="$(date +%s)"
  until run_exports_once; do
    if [ "$PILOT_EXPORT_WAIT_UNTIL_FRESH" != "1" ]; then
      exit 1
    fi

    now_epoch="$(date +%s)"
    elapsed_seconds=$((now_epoch - start_epoch))
    if [ "$elapsed_seconds" -ge "$PILOT_EXPORT_MAX_WAIT_SECONDS" ]; then
      echo "Fresh exports did not become available within ${PILOT_EXPORT_MAX_WAIT_SECONDS}s; failing without sending stale attachments."
      exit 1
    fi

    echo "Fresh exports are not ready; waiting ${PILOT_EXPORT_POLL_SECONDS}s before retrying."
    sleep "$PILOT_EXPORT_POLL_SECONDS"
    echo
  done

  echo "[3/3] Sending pilot data export email..."
  python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_data_exports_email.py" \
    --date "$REPORT_DATE"
  echo "Pilot data export email step complete"
  echo

  echo "Pilot data exports workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
