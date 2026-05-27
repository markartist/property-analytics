#!/bin/bash
set -Eeuo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pilot_morning_daily_$(date +%Y-%m-%d).log"
RUN_DATE="$(date +%Y-%m-%d)"
DISPLAY_RUN_DATE="$(date +%m/%d/%Y)"
LOCK_DIR="$LOG_DIR/pilot_morning_daily.lock"
STATUS_DIR="$LOG_DIR/pilot_morning_status"
mkdir -p "$STATUS_DIR"
FAILURE_MARKER="$STATUS_DIR/pilot_morning_failure_${RUN_DATE}.env"
RECOVERY_MARKER="$STATUS_DIR/pilot_morning_recovery_${RUN_DATE}.sent"
FAILURE_ALERT_SENT=0
INTENTIONAL_FAILURE_EXIT=0
CURRENT_STAGE="Bootstrap"

MAX_GT_ATTEMPTS=4
GT_RETRY_DELAY_SECONDS=900
MAX_TWIN_GT_ATTEMPTS=2
TWIN_GT_RETRY_DELAY_SECONDS=300
MAX_PSI_ATTEMPTS=3
PSI_RETRY_DELAY_SECONDS=300
MAX_HOMEPAGE_ATTEMPTS=3
HOMEPAGE_RETRY_DELAY_SECONDS=180
GT_RUNS_PER_PROPERTY=1
GT_PROPERTY_RETRIES=0
GT_BATCH_SIZE=2
GT_BATCH_DELAY_SECONDS=180
GT_MAX_WAIT_SECONDS=240
GT_POLL_INTERVAL_SECONDS=5
TWIN_GT_RUNS_PER_PROPERTY=1
TWIN_GT_PROPERTY_RETRIES=0
TWIN_GT_BATCH_SIZE=2
TWIN_GT_BATCH_DELAY_SECONDS=120
TWIN_GT_MAX_WAIT_SECONDS=240
TWIN_GT_POLL_INTERVAL_SECONDS=5
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
  if [ "$FAILURE_ALERT_SENT" -eq 1 ] || [ "$INTENTIONAL_FAILURE_EXIT" -eq 1 ] || [ -f "$FAILURE_MARKER" ]; then
    return "$exit_code"
  fi
  if [[ "$reported_command" == "tee -a \"$LOG_FILE\"" ]] || [[ "$reported_command" == *'tee -a "$LOG_FILE"'* ]]; then
    reported_command="pipeline tail while executing stage: ${CURRENT_STAGE}"
  fi
  send_failure_alert \
    "Bootstrap / Shell" \
    "Pilot morning workflow aborted unexpectedly before completing scheduled stages for ${DISPLAY_RUN_DATE}.

Shell: ${BASH_VERSION}
Report date: ${DISPLAY_RUN_DATE}
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
        "GTMetrix credit guard blocked attempt ${gt_attempt} for ${DISPLAY_RUN_DATE}. Remaining spendable credits: ${remaining_credits}. Reserve preserved to avoid exhausting the 50/day budget."
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
        "GTMetrix collector paused same-day retries for ${DISPLAY_RUN_DATE} after hitting rate limits. Completed same-day properties were preserved, and remaining properties were deferred to avoid wasting credits."
      return 1
    fi
    if [ "$GT_EXIT" -eq 3 ]; then
      echo "GTMetrix collector stopped due to credit exhaustion."
      send_failure_alert \
        "GTMetrix" \
        "GTMetrix collector stopped same-day retries for ${DISPLAY_RUN_DATE} after detecting credit exhaustion. Completed same-day properties were preserved, and remaining properties were deferred to protect the daily budget."
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
    "GTMetrix could not produce a complete fresh cohort for ${DISPLAY_RUN_DATE} after ${MAX_GT_ATTEMPTS} attempts. Stale fallback exports were intentionally blocked."
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
    "PSI could not produce a complete fresh cohort for ${DISPLAY_RUN_DATE} after ${MAX_PSI_ATTEMPTS} attempts. Exports and roundup were intentionally blocked."
  return 1
}

run_twin_gtmetrix_until_fresh() {
  local twin_attempt=1
  local missing_ids=()
  local twin_validate_json=""
  local target_ids=()
  while [ "$twin_attempt" -le "$MAX_TWIN_GT_ATTEMPTS" ]; do
    twin_validate_json="$(python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_twin_gtmetrix.py" \
      --date "$RUN_DATE" \
      --json || true)"
    missing_ids=()
    while IFS= read -r property_id; do
      [ -n "$property_id" ] && missing_ids+=("$property_id")
    done < <(
      python3 - <<'PY' "$twin_validate_json"
import json
import sys

payload = json.loads(sys.argv[1])
for property_id in payload.get("missing_property_ids", []):
    print(property_id)
PY
    )

    if [ "${#missing_ids[@]}" -eq 0 ]; then
      echo "Twin GTMetrix validation complete for fresh same-day cohort."
      echo
      return 0
    fi

    target_ids=("${missing_ids[@]}")

    echo "[3/12] Collecting twin GTMetrix... attempt ${twin_attempt}/${MAX_TWIN_GT_ATTEMPTS}"
    echo "Missing twin properties: ${target_ids[*]}"
    set +e
    python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_twin_gtmetrix.py" \
      --date "$RUN_DATE" \
      --runs "$TWIN_GT_RUNS_PER_PROPERTY" \
      --batch-size "$TWIN_GT_BATCH_SIZE" \
      --batch-delay-seconds "$TWIN_GT_BATCH_DELAY_SECONDS" \
      --max-wait-seconds "$TWIN_GT_MAX_WAIT_SECONDS" \
      --poll-interval-seconds "$TWIN_GT_POLL_INTERVAL_SECONDS" \
      --property-retries "$TWIN_GT_PROPERTY_RETRIES" \
      --retry-delay-seconds 45 \
      --property-ids "${target_ids[@]}"
    TWIN_GT_EXIT=$?
    twin_validate_json="$(python3 "$ROOT/pilot_control_cwv/scripts/validate_pilot_twin_gtmetrix.py" \
      --date "$RUN_DATE" \
      --json || true)"
    TWIN_GT_VALIDATE_EXIT=$?
    set -e
    echo "Twin GTMetrix collection attempt ${twin_attempt} complete"
    echo

    if [ "$TWIN_GT_VALIDATE_EXIT" -eq 0 ]; then
      echo "Twin GTMetrix validation complete for fresh same-day cohort."
      echo
      return 0
    fi

    if [ "$TWIN_GT_EXIT" -eq 2 ] || [ "$TWIN_GT_EXIT" -eq 3 ]; then
      send_failure_alert \
        "Twin GTMetrix" \
        "Twin GTMetrix could not produce a complete fresh same-day cohort for ${DISPLAY_RUN_DATE} due to GTMetrix rate/credit limits. CSV attachments would otherwise contain blank twin GT values."
      return 1
    fi

    echo "Twin GTMetrix attempt ${twin_attempt} did not produce a complete fresh cohort for ${RUN_DATE}."
    if [ "$twin_attempt" -lt "$MAX_TWIN_GT_ATTEMPTS" ]; then
      echo "Retrying twin GTMetrix in ${TWIN_GT_RETRY_DELAY_SECONDS}s..."
      echo
      sleep "$TWIN_GT_RETRY_DELAY_SECONDS"
    fi
    twin_attempt=$((twin_attempt + 1))
  done

  send_failure_alert \
    "Twin GTMetrix" \
    "Twin GTMetrix could not produce a complete fresh cohort for ${DISPLAY_RUN_DATE} after ${MAX_TWIN_GT_ATTEMPTS} attempts. The consolidated roundup attachments are configured to include twin GT values, so export delivery was blocked."
  return 1
}

run_homepage_evidence_until_fresh() {
  local homepage_attempt=1
  while [ "$homepage_attempt" -le "$MAX_HOMEPAGE_ATTEMPTS" ]; do
    echo "[5/11] Collecting homepage audit evidence... attempt ${homepage_attempt}/${MAX_HOMEPAGE_ATTEMPTS}"
    set +e
    python3 "$ROOT/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py" \
      --date "$RUN_DATE" \
      --retries 2 \
      --retry-delay-seconds 15
    HOMEPAGE_EXIT=$?
    set -e

    if [ "$HOMEPAGE_EXIT" -eq 0 ]; then
      echo "Homepage audit evidence complete"
      echo
      return 0
    fi

    echo "Homepage audit evidence attempt ${homepage_attempt} did not complete successfully for ${RUN_DATE}."
    if [ "$homepage_attempt" -lt "$MAX_HOMEPAGE_ATTEMPTS" ]; then
      echo "Retrying homepage audit evidence in ${HOMEPAGE_RETRY_DELAY_SECONDS}s..."
      echo
      sleep "$HOMEPAGE_RETRY_DELAY_SECONDS"
    fi
    homepage_attempt=$((homepage_attempt + 1))
  done

  send_failure_alert \
    "Homepage audit evidence" \
    "Homepage audit evidence collection failed for ${DISPLAY_RUN_DATE} after ${MAX_HOMEPAGE_ATTEMPTS} remediation attempts. Fresh GTMetrix and PSI data were already collected, but downstream pilot artifacts were blocked until homepage evidence succeeds."
  return 1
}

{
  echo "====================================================================="
  echo "Pilot Morning Workflow - $(date)"
  echo "====================================================================="
  echo

  CURRENT_STAGE="GTMetrix freshness loop"
  if ! run_gtmetrix_until_fresh; then
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi

  CURRENT_STAGE="GTMetrix confirmed"
  echo "[2/11] Fresh GTMetrix confirmed."
  echo

  CURRENT_STAGE="Twin GTMetrix freshness loop"
  if ! run_twin_gtmetrix_until_fresh; then
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi

  CURRENT_STAGE="Twin GTMetrix confirmed"
  echo "[4/12] Fresh twin GTMetrix confirmed."
  echo

  CURRENT_STAGE="PSI freshness loop"
  if ! run_psi_until_fresh; then
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi

  CURRENT_STAGE="PSI confirmed"
  echo "[5/12] Fresh PSI confirmed."
  echo

  CURRENT_STAGE="Homepage audit evidence"
  if ! run_homepage_evidence_until_fresh; then
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi

  CURRENT_STAGE="GTMetrix export"
  echo "[7/12] Exporting GTMetrix daily scores..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/export_gtmetrix_daily_scores.py" \
    --date "$RUN_DATE" \
    --output-dir "/Users/mark/Downloads"; then
    send_failure_alert \
      "GTMetrix export" \
      "GTMetrix export failed for ${DISPLAY_RUN_DATE} after fresh same-day validation had already passed."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  echo "GTMetrix export complete"
  echo

  CURRENT_STAGE="PSI export"
  echo "[8/12] Exporting PSI day-over-day scores..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/export_psi_day_over_day_scores.py" \
    --output-dir "/Users/mark/Downloads"; then
    send_failure_alert \
      "PSI export" \
      "PSI export failed for ${DISPLAY_RUN_DATE} after fresh same-day validation had already passed."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  echo "PSI export complete"
  echo

  CURRENT_STAGE="Pilot data exports email"
  echo "[9/13] Sending pilot data export attachments..."
  if ! python3 "$ROOT/pilot_control_cwv/scripts/send_pilot_data_exports_email.py" \
    --date "$(date -j -f '%Y-%m-%d' "$RUN_DATE" '+%m/%d/%Y')"; then
    send_failure_alert \
      "Pilot data exports email" \
      "Pilot data export attachment email failed for ${DISPLAY_RUN_DATE} after GTMetrix and PSI CSV exports completed."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  echo "Pilot data export attachments complete"
  echo

  CURRENT_STAGE="Merged pilot evaluation"
  echo "[10/13] Generating merged pilot evaluation..."
  if ! python3 "$ROOT/pilot_roundup/scripts/generate_daily_pilot_evaluation.py"; then
    send_failure_alert \
      "Merged pilot evaluation" \
      "Merged pilot evaluation generation failed for ${DISPLAY_RUN_DATE}."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  echo "Pilot evaluation generation complete"
  echo

  CURRENT_STAGE="Pilot roundup generation"
  echo "[11/13] Generating pilot roundup..."
  if ! python3 "$ROOT/pilot_roundup/scripts/generate_pilot_roundup.py"; then
    send_failure_alert \
      "Pilot roundup generation" \
      "Pilot roundup generation failed for ${DISPLAY_RUN_DATE}."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  echo "Roundup generation complete"
  echo

  CURRENT_STAGE="Pilot roundup notification"
  echo "[12/13] Handling pilot roundup notification..."
  if ! python3 "$ROOT/pilot_roundup/scripts/send_pilot_roundup_email.py"; then
    send_failure_alert \
      "Pilot roundup notification" \
      "Pilot roundup notification failed for ${DISPLAY_RUN_DATE} after roundup generation completed."
    INTENTIONAL_FAILURE_EXIT=1
    exit 1
  fi
  if [[ "$PILOT_SUMMARY_EMAILS_ENABLED" == "1" ]]; then
    echo "Pilot roundup email complete"
  else
    echo "Pilot roundup email suppressed by policy; roundup artifact remains available on disk"
  fi
  echo

  CURRENT_STAGE="Completed"
  echo "[13/13] Pilot morning workflow complete."
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
