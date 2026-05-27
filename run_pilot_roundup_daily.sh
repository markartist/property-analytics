#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pilot_roundup_daily_$(date +%Y-%m-%d).log"
PILOT_SUMMARY_EMAILS_ENABLED="${PILOT_SUMMARY_EMAILS_ENABLED:-1}"

export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PILOT_SUMMARY_EMAILS_ENABLED

{
  echo "====================================================================="
  echo "Pilot Performance Roundup - $(date)"
  echo "====================================================================="
  echo

  echo "[1/2] Generating pilot roundup..."
  python3 "$ROOT/pilot_roundup/scripts/generate_pilot_roundup.py"
  echo "Generation complete"
  echo

  echo "[2/2] Handling pilot roundup notification..."
  python3 "$ROOT/pilot_roundup/scripts/send_pilot_roundup_email.py"
  if [[ "$PILOT_SUMMARY_EMAILS_ENABLED" == "1" ]]; then
    echo "Pilot roundup email complete"
  else
    echo "Pilot roundup email suppressed by policy; roundup artifact remains available on disk"
  fi
  echo

  echo "Pilot roundup workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
