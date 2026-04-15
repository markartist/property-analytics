#!/bin/bash
set -Eeuo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pilot_morning_daily_$(date +%Y-%m-%d).log"
RUN_DATE="$(date +%Y-%m-%d)"
LOCK_DIR="$LOG_DIR/pilot_morning_daily.lock"
STATUS_DIR="$LOG_DIR/pilot_morning_status"
mkdir -p "$STATUS_DIR"
FAILURE_MARKER="$STATUS_DIR/pilot_morning_failure_${RUN_DATE}.env"
RECOVERY_MARKER="$STATUS_DIR/pilot_morning_recovery_${RUN_DATE}.sent"
FAILURE_ALERT_SENT=0
CURRENT_STAGE="Bootstrap"

MAX_GT_ATTEMPTS=4
GT_RETRY_DELAY_SECONDS=900
MAX_PSI_ATTEMPTS=3
PSI_RETRY_DELAY_SECONDS=300
GT_RUNS_PER_PROPERTY=1
GT_PROPERTY_RETRIES=0
GT_BATCH_SIZE=2
GT_BATCH_DELAY_SECONDS=180
GT_MAX_WAIT_SECONDS=240
GT_POLL_INTERVAL_SECONDS=5
GT_DAILY_BUDGET=50
GT_RESERVE_CREDITS=10
PILOT_SUMMARY_EMAILS_ENABLED="${PILOT_SUMMARY_EMAILS_ENABLED:-1}"

export PATH="/Users/mark/.nvm/versions/node/v22.22.1/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PILOT_SUMMARY_EMAILS_ENABLED

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  {
    echo "====================================================================="
    echo "Pilot Morning Workflow - $(date)"
    echo "====================================================================="
    echo
    echo "Another pilot morning workflow instance is already running."
    echo "Skipping this invocation to avoid overlapping same-day collections."
    echo "====================================================================="
  } 2>&1 | tee -a "$LOG_FILE"
  exit 0
fi

cleanup_lock() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}

trap cleanup_lock EXIT

send_failure_alert() {
  local stage="$1"
  local details="$2"
  local recent_errors=""
  FAILURE_ALERT_SENT=1
  recent_errors="$(grep -E "Too Many Requests|Insufficient API credits|GTMetrix test .* timed out|Remote end closed connection" "$LOG_FILE" | tail -n 8 || true)"
  if [ -n "$recent_errors" ]; then
    details="${details}

Recent collector errors:
${recent_errors}"
  fi
  python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py" \
    --stage "$stage" \
    --date "$RUN_DATE" \
    --details "$details"
  cat > "$FAILURE_MARKER" <<EOF
FAILED_STAGE=$(printf '%q' "$stage")
FAILED_AT=$(date '+%Y-%m-%d %H:%M:%S %Z')
EOF
  rm -f "$RECOVERY_MARKER"
}

send_recovery_notice_if_needed() {
  if [ ! -f "$FAILURE_MARKER" ] || [ -f "$RECOVERY_MARKER" ]; then
    return 0
  fi

  # shellcheck disable=SC1090
  source "$FAILURE_MARKER"
  python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_collection_recovery_email.py" \
    --date "$RUN_DATE" \
    --failed-stage "${FAILED_STAGE:-Unknown}" \
    --completed-at "$(date '+%Y-%m-%d %H:%M:%S %Z')" \
    --details "The pilot morning workflow completed successfully after an earlier same-day failure alert.\n\nEarlier failure timestamp: ${FAILED_AT:-unknown}\nFinal stage: Completed\nLog file: ${LOG_FILE}"
  touch "$RECOVERY_MARKER"
}

handle_unexpected_error() {
  local exit_code="$1"
  local line_no="$2"
  local command="$3"
  local reported_command="$command"
  if [ "$FAILURE_ALERT_SENT" -eq 1 ]; then
    return "$exit_code"
  fi
  if [[ "$reported_command" == "tee -a \"$LOG_FILE\"" ]] || [[ "$reported_command" == *'tee -a "$LOG_FILE"'* ]]; then
    reported_command="pipeline tail while executing stage: ${CURRENT_STAGE}"
  fi
  send_failure_alert \
    "Bootstrap / Shell" \
    "Pilot morning workflow aborted unexpectedly before completing scheduled stages for ${RUN_DATE}.

Shell: ${BASH_VERSION}
Exit code: ${exit_code}
Stage: ${CURRENT_STAGE}
Line: ${line_no}
Command: ${reported_command}

This usually indicates a shell-compatibility or orchestration failure rather than a data-source retry exhaustion."
  return "$exit_code"
}

trap 'handle_unexpected_error $? ${LINENO} "$BASH_COMMAND"' ERR

run_gtmetrix_until_fresh() {
  local gt_attempt=1
  local missing_ids=()
  local gt_validate_json=""
  local collector_args=()
  local target_ids=()
  local plan_json=""
  local remaining_credits=""
  while [ "$gt_attempt" -le "$MAX_GT_ATTEMPTS" ]; do
    gt_validate_json="$(python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_control_gtmetrix.py" \
      --date "$RUN_DATE" \
      --json || true)"
    missing_ids=()
    while IFS= read -r property_id; do
      [ -n "$property_id" ] && missing_ids+=("$property_id")
    done < <(
      python3 - <<'PY' "$gt_validate_json"
import json
import sys

payload = json.loads(sys.argv[1])
for property_id in payload.get("missing_property_ids", []):
    print(property_id)
PY
    )
    if [ "${#missing_ids[@]}" -gt 0 ]; then
      target_ids=("${missing_ids[@]}")
    else
      target_ids=()
    fi

    if [ "${#target_ids[@]}" -eq 0 ]; then
      echo "GTMetrix validation complete for fresh same-day cohort."
      echo
      return 0
    fi

    set +e
    plan_json="$(python3 "$ROOT/pilot_control_cwv/scripts/gtmetrix_credit_guard.py" \
      --date "$RUN_DATE" \
      --daily-budget "$GT_DAILY_BUDGET" \
      --reserve-credits "$GT_RESERVE_CREDITS" \
      plan \
      --property-ids "${target_ids[@]}" \
      --runs "$GT_RUNS_PER_PROPERTY" \
      --property-retries "$GT_PROPERTY_RETRIES")"
    GT_PLAN_EXIT=$?
    set -e
    remaining_credits="$(python3 - <<'PY' "$plan_json"
import json
import sys
print(json.loads(sys.argv[1]).get("remaining_spendable_credits", ""))
PY
    )"

    if [ "$GT_PLAN_EXIT" -ne 0 ]; then
      echo "GTMetrix credit guard blocked attempt ${gt_attempt}."
      echo "Remaining spendable credits: ${remaining_credits}"
      send_failure_alert \
        "GTMetrix" \
        "GTMetrix credit guard blocked attempt ${gt_attempt} for ${RUN_DATE}. Remaining spendable credits: ${remaining_credits}. Reserve preserved to avoid exhausting the 50/day budget."
      return 1
    fi

    echo "[1/11] Collecting GTMetrix... attempt ${gt_attempt}/${MAX_GT_ATTEMPTS}"
    echo "Estimated remaining spendable credits before attempt: ${remaining_credits}"
    if [ "${#missing_ids[@]}" -gt 0 ]; then
      echo "Resuming only missing GTMetrix properties: ${target_ids[*]}"
    else
      echo "Starting full GTMetrix cohort pass."
    fi
    collector_args=(
      --date "$RUN_DATE"
      --runs "$GT_RUNS_PER_PROPERTY"
      --batch-size "$GT_BATCH_SIZE"
      --batch-delay-seconds "$GT_BATCH_DELAY_SECONDS"
      --max-wait-seconds "$GT_MAX_WAIT_SECONDS"
      --poll-interval-seconds "$GT_POLL_INTERVAL_SECONDS"
      --property-retries "$GT_PROPERTY_RETRIES"
      --retry-delay-seconds 45
    )
    if [ "${#missing_ids[@]}" -gt 0 ]; then
      collector_args+=(--property-ids "${target_ids[@]}")
    fi
    set +e
    python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_control_gtmetrix.py" "${collector_args[@]}"
    GT_EXIT=$?
    python3 "$ROOT/pilot_control_cwv/scripts/gtmetrix_credit_guard.py" \
      --date "$RUN_DATE" \
      --daily-budget "$GT_DAILY_BUDGET" \
      --reserve-credits "$GT_RESERVE_CREDITS" \
      record \
      --attempt "$gt_attempt" \
      --label "pilot_morning_gtmetrix" \
      --property-ids "${target_ids[@]}" \
      --runs "$GT_RUNS_PER_PROPERTY" \
      --property-retries "$GT_PROPERTY_RETRIES" \
      --status "collector_exit_${GT_EXIT}" >/dev/null
    if [ "$GT_EXIT" -eq 2 ]; then
      echo "GTMetrix collector paused the queue due to rate limiting."
      send_failure_alert \
        "GTMetrix" \
        "GTMetrix collector paused same-day retries for ${RUN_DATE} after hitting rate limits. Completed same-day properties were preserved, and remaining properties were deferred to avoid wasting credits."
      return 1
    fi
    if [ "$GT_EXIT" -eq 3 ]; then
      echo "GTMetrix collector stopped due to credit exhaustion."
      send_failure_alert \
        "GTMetrix" \
        "GTMetrix collector stopped same-day retries for ${RUN_DATE} after detecting credit exhaustion. Completed same-day properties were preserved, and remaining properties were deferred to protect the daily budget."
      return 1
    fi
    gt_validate_json="$(python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_control_gtmetrix.py" \
      --date "$RUN_DATE" \
      --json)"
    GT_VALIDATE_EXIT=$?
    set -e
    echo "GTMetrix collection attempt ${gt_attempt} complete"
    echo

    if [ "$GT_VALIDATE_EXIT" -eq 0 ]; then
      echo "GTMetrix validation complete for fresh same-day cohort."
      echo
      return 0
    fi

    echo "GTMetrix attempt ${gt_attempt} did not produce a complete fresh cohort for ${RUN_DATE}."
    missing_ids=()
    while IFS= read -r property_id; do
      [ -n "$property_id" ] && missing_ids+=("$property_id")
    done < <(
      python3 - <<'PY' "$gt_validate_json"
import json
import sys

payload = json.loads(sys.argv[1])
for property_id in payload.get("missing_property_ids", []):
    print(property_id)
PY
    )
    if [ "${#missing_ids[@]}" -eq 0 ]; then
      echo "Validator reported incompleteness but did not return missing property IDs."
    else
      echo "Remaining missing GTMetrix properties: ${missing_ids[*]}"
    fi
    if [ "$gt_attempt" -lt "$MAX_GT_ATTEMPTS" ]; then
      echo "Retrying GTMetrix in ${GT_RETRY_DELAY_SECONDS}s..."
      echo
      sleep "$GT_RETRY_DELAY_SECONDS"
    fi
    gt_attempt=$((gt_attempt + 1))
  done

  send_failure_alert \
    "GTMetrix" \
    "GTMetrix could not produce a complete fresh cohort for ${RUN_DATE} after ${MAX_GT_ATTEMPTS} attempts. Stale fallback exports were intentionally blocked."
  return 1
}

run_psi_until_fresh() {
  local psi_attempt=1
  while [ "$psi_attempt" -le "$MAX_PSI_ATTEMPTS" ]; do
    echo "[3/11] Collecting dedicated pilot PSI... attempt ${psi_attempt}/${MAX_PSI_ATTEMPTS}"
    set +e
    python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_control_psi.py" \
      --date "$RUN_DATE" \
      --strategies mobile
    PSI_EXIT=$?
    python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_control_psi.py" \
      --date "$RUN_DATE" \
      --strategies mobile
    PSI_VALIDATE_EXIT=$?
    set -e
    echo "Pilot PSI collection attempt ${psi_attempt} complete"
    echo

    if [ "$PSI_VALIDATE_EXIT" -eq 0 ]; then
      echo "Pilot PSI validation complete for fresh same-day cohort."
      echo
      return 0
    fi

    echo "PSI attempt ${psi_attempt} did not produce a complete fresh cohort for ${RUN_DATE}."
    if [ "$psi_attempt" -lt "$MAX_PSI_ATTEMPTS" ]; then
      echo "Retrying PSI in ${PSI_RETRY_DELAY_SECONDS}s..."
      echo
      sleep "$PSI_RETRY_DELAY_SECONDS"
    fi
    psi_attempt=$((psi_attempt + 1))
  done

  send_failure_alert \
    "PSI" \
    "PSI could not produce a complete fresh cohort for ${RUN_DATE} after ${MAX_PSI_ATTEMPTS} attempts. Exports and roundup were intentionally blocked."
  return 1
}

{
  echo "====================================================================="
  echo "Pilot Morning Workflow - $(date)"
  echo "====================================================================="
  echo

  CURRENT_STAGE="GTMetrix freshness loop"
  if ! run_gtmetrix_until_fresh; then
    exit 1
  fi

  CURRENT_STAGE="GTMetrix confirmed"
  echo "[2/11] Fresh GTMetrix confirmed."
  echo

  CURRENT_STAGE="PSI freshness loop"
  if ! run_psi_until_fresh; then
    exit 1
  fi

  CURRENT_STAGE="PSI confirmed"
  echo "[4/11] Fresh PSI confirmed."
  echo

  CURRENT_STAGE="Homepage audit evidence"
  echo "[5/11] Collecting homepage audit evidence..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py" \
    --date "$RUN_DATE"; then
    send_failure_alert \
      "Homepage audit evidence" \
      "Homepage audit evidence collection failed for ${RUN_DATE}. Fresh GTMetrix and PSI data were already collected, but downstream pilot artifacts were blocked until homepage evidence succeeds."
    exit 1
  fi
  echo "Homepage audit evidence complete"
  echo

  CURRENT_STAGE="GTMetrix export"
  echo "[6/11] Exporting GTMetrix daily scores..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/export_gtmetrix_daily_scores.py" \
    --date "$RUN_DATE" \
    --output-dir "/Users/mark/Downloads"; then
    send_failure_alert \
      "GTMetrix export" \
      "GTMetrix export failed for ${RUN_DATE} after fresh same-day validation had already passed."
    exit 1
  fi
  echo "GTMetrix export complete"
  echo

  CURRENT_STAGE="PSI export"
  echo "[7/11] Exporting PSI day-over-day scores..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/export_psi_day_over_day_scores.py" \
    --output-dir "/Users/mark/Downloads"; then
    send_failure_alert \
      "PSI export" \
      "PSI export failed for ${RUN_DATE} after fresh same-day validation had already passed."
    exit 1
  fi
  echo "PSI export complete"
  echo

  CURRENT_STAGE="Pilot CSV export notification"
  echo "[8/11] Handling pilot CSV exports notification..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_data_exports_email.py"; then
    send_failure_alert \
      "Pilot CSV export notification" \
      "Pilot CSV export notification failed for ${RUN_DATE} after exports were generated."
    exit 1
  fi
  if [[ "$PILOT_SUMMARY_EMAILS_ENABLED" == "1" ]]; then
    echo "CSV export email complete"
  else
    echo "CSV export email suppressed by policy; files remain available on disk"
  fi
  echo

  CURRENT_STAGE="Merged pilot evaluation"
  echo "[9/11] Generating merged pilot evaluation..."
  if ! python3 "$ROOT/pilot_roundup/scripts/generate_daily_pilot_evaluation.py"; then
    send_failure_alert \
      "Merged pilot evaluation" \
      "Merged pilot evaluation generation failed for ${RUN_DATE}."
    exit 1
  fi
  echo "Pilot evaluation generation complete"
  echo

  CURRENT_STAGE="Pilot roundup generation"
  echo "[10/11] Generating pilot roundup..."
  if ! python3 "$ROOT/pilot_roundup/scripts/generate_pilot_roundup.py"; then
    send_failure_alert \
      "Pilot roundup generation" \
      "Pilot roundup generation failed for ${RUN_DATE}."
    exit 1
  fi
  echo "Roundup generation complete"
  echo

  CURRENT_STAGE="Pilot roundup notification"
  echo "[11/11] Handling pilot roundup notification..."
  if ! python3 "$ROOT/pilot_roundup/scripts/send_pilot_roundup_email.py"; then
    send_failure_alert \
      "Pilot roundup notification" \
      "Pilot roundup notification failed for ${RUN_DATE} after roundup generation completed."
    exit 1
  fi
  if [[ "$PILOT_SUMMARY_EMAILS_ENABLED" == "1" ]]; then
    echo "Pilot roundup email complete"
  else
    echo "Pilot roundup email suppressed by policy; roundup artifact remains available on disk"
  fi
  echo

  CURRENT_STAGE="Completed"
  echo "Pilot morning workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

PIPE_EXIT=${PIPESTATUS[0]}
if [ "$PIPE_EXIT" -eq 0 ]; then
  send_recovery_notice_if_needed
fi

exit "$PIPE_EXIT"
