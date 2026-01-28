#!/bin/bash
#
# Weekly Portfolio Progress Report Runner
# Generates and emails weekly progress report
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================="
echo "Weekly Portfolio Progress Report"
echo "$(date)"
echo "========================================="
echo ""

# Generate report
echo "Generating weekly progress report..."
python3 "$SCRIPT_DIR/generate_weekly_progress_report.py"

if [ $? -ne 0 ]; then
    echo "❌ Report generation failed"
    exit 1
fi

echo ""
echo "Sending email..."
python3 "$SCRIPT_DIR/send_weekly_progress_report.py"

if [ $? -ne 0 ]; then
    echo "❌ Email send failed"
    exit 1
fi

echo ""
echo "✅ Weekly progress report completed successfully!"
