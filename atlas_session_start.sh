#!/bin/bash
# Atlas Session Start Helper
# Run this at the start of any new session to get oriented

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              🤖 ATLAS SESSION START - QUICK CHECK              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Show memory file location
echo "📖 STEP 1: Read Atlas Memory"
echo "   Location: /Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md"
echo "   Capability Register: /Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md"
echo "   Full System Audit: /Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md"
echo ""

# Quick system check
echo "📊 STEP 2: Quick System Health Check"
echo ""

# Check database
if [ -f "/Users/mark/Property_Analytics/data/portfolio_analytics.db" ]; then
    DB_SIZE=$(du -h /Users/mark/Property_Analytics/data/portfolio_analytics.db | cut -f1)
    echo "   ✅ Database: $DB_SIZE"

    # Get latest data date
    LATEST=$(sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
        "SELECT MAX(metric_date) FROM ga4_daily_metrics" 2>/dev/null)
    if [ -n "$LATEST" ]; then
        echo "   ✅ Latest GA4 data: $LATEST"
    else
        echo "   ⚠️  Could not read latest data date"
    fi
else
    echo "   🔴 Database not found!"
fi

echo ""

# Check scheduled jobs
echo "   Scheduled Jobs Status:"
JOBS=$(launchctl list | grep venterra | wc -l | tr -d ' ')
echo "   ✅ Found $JOBS Venterra jobs in launchd"

echo ""

# Check for critical issues marker
if grep -q "CRITICAL" /Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md 2>/dev/null; then
    echo "⚠️  STEP 3: Critical issues detected in memory file!"
    echo "   Read the 'CRITICAL ISSUES' section before proceeding"
else
    echo "✅ STEP 3: No critical issues flagged in memory"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Next: Read memory + capability register + full system audit"
echo "═══════════════════════════════════════════════════════════════"
echo ""
