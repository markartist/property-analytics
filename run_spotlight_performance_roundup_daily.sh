#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/spotlight_performance_roundup_daily_$(date +%Y-%m-%d).log"

export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

{
  echo "====================================================================="
  echo "Spotlight PageSpeed Insights Performance Roundup - $(date)"
  echo "====================================================================="
  echo

  echo "[1/1] Generating and emailing Spotlight PageSpeed Insights Performance..."
  python3 "$ROOT/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py"
  echo "Spotlight PageSpeed Insights Performance workflow complete"
  echo

  echo "Workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
