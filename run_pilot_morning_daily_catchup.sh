#!/bin/bash
set -euo pipefail

ROOT="/Users/mark/Property_Analytics"
LOG_DIR="$HOME/Library/Logs/Venterra"
TODAY="$(date +%Y-%m-%d)"
CURRENT_HOUR="$(date +%H)"
LOG_FILE="$LOG_DIR/pilot_morning_daily_${TODAY}.log"
COMPLETION_MARKER="Pilot morning workflow completed"

mkdir -p "$LOG_DIR"

# Only catch up after the scheduled 4am window unless explicitly forced.
if [ "${FORCE_PILOT_MORNING_RUN:-0}" != "1" ] && [ "$CURRENT_HOUR" -lt 4 ]; then
  echo "[$(date)] Skipping pilot morning catch-up: before 4am window."
  exit 0
fi

# Avoid duplicate sends if today's workflow already completed successfully.
if [ -f "$LOG_FILE" ] && grep -q "$COMPLETION_MARKER" "$LOG_FILE"; then
  echo "[$(date)] Skipping pilot morning catch-up: today's workflow already completed."
  exit 0
fi

exec /bin/bash "$ROOT/run_pilot_morning_daily.sh"
