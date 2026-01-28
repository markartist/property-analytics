#!/bin/bash
#
# Daily Portfolio Health Report - Generate and Email
# ===================================================
#
# Automated wrapper for daily 9 AM execution via launchd.
# Generates report and sends via email to Mark.
#
# Usage: Called automatically by launchd
#        Can also be run manually for testing
#
# Author: Mark Laufhutte / Atlas
# Date: 2026-01-27
#

set -e  # Exit on error

# Change to script directory
cd "$(dirname "$0")"

# Log file
LOG_DIR="$HOME/Library/Logs/Venterra"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily_health_report_$(date +%Y-%m-%d).log"

echo "=====================================================================" | tee -a "$LOG_FILE"
echo "Daily Portfolio Health Report - $(date)" | tee -a "$LOG_FILE"
echo "=====================================================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Generate report
echo "🔄 Generating report..." | tee -a "$LOG_FILE"
if python3 generate_daily_portfolio_health.py 2>&1 | tee -a "$LOG_FILE"; then
    echo "✅ Report generated successfully" | tee -a "$LOG_FILE"
else
    echo "❌ Report generation failed" | tee -a "$LOG_FILE"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"

# Send email
echo "📧 Sending email..." | tee -a "$LOG_FILE"
if python3 send_daily_health_report.py 2>&1 | tee -a "$LOG_FILE"; then
    echo "✅ Email sent successfully" | tee -a "$LOG_FILE"
else
    echo "❌ Email send failed" | tee -a "$LOG_FILE"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"
echo "✅ Daily health report completed at $(date)" | tee -a "$LOG_FILE"
echo "=====================================================================" | tee -a "$LOG_FILE"

exit 0
