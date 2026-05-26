#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pilot_evaluation_daily_$(date +%Y-%m-%d).log"

export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

{
  echo "====================================================================="
  echo "Pilot Daily Evaluation - $(date)"
  echo "====================================================================="
  echo

  echo "[1/1] Generating merged daily pilot evaluation..."
  python3 "$ROOT/pilot_roundup/scripts/generate_daily_pilot_evaluation.py"
  echo "Pilot daily evaluation complete"
  echo

  echo "Pilot daily evaluation workflow completed at $(date)"
  echo "====================================================================="
} 2>&1 | tee -a "$LOG_FILE"

exit ${PIPESTATUS[0]}
