#!/bin/bash
set -euo pipefail

echo "====================================================================="
echo "Spotlight PageSpeed Insights Performance Roundup - $(date)"
echo "====================================================================="
echo

cd /Users/mark/Property_Analytics

python3 pilot_roundup/scripts/send_spotlight_performance_roundup_email.py
