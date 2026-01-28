# Venterra Living Focus Report

**Executive Status Board for Curated Focus Properties**

---

## Purpose

Focus Report is a **weekly executive dashboard** for a curated set of Focus properties. It answers one question:

> "How are our Focus properties performing right now, and which ones require attention?"

This report provides **situational awareness** at a glance — not alerts, not deep diagnostics. It is designed to be **safe to forward to leadership** without additional context or explanation.

**Current Focus Set:** 23 properties (expanded from 5 on 2026-01-21)

---

## Quick Start

### Generate Report
```bash
cd /Users/mark/Property_Analytics/focus_report/scripts
python3 generate_focus_report.py
```

### Send Report via Email
```bash
python3 send_focus_report_email.py
```

### View Archived Reports
```bash
open ../reports/focus_report/
```

---

## What Makes Focus Report Different

### vs Portfolio Pulse
- **Focus Report:** Curated list (23 properties), status-driven, always shows all properties
- **Portfolio Pulse:** All 91 properties, movers-driven, shows top/bottom performers only

### vs Property Deep Dive
- **Focus Report:** Multi-property overview, fixed 4-KPI strip, weekly cadence
- **Property Deep Dive:** Single-property analysis, comprehensive metrics, on-demand

### vs Spotlight Properties Report
- **Focus Report:** Live data, deterministic status/insights, HTML email
- **Spotlight:** Monthly snapshots, manual selection, CSV export to OneDrive

---

## Report Contents

Every Focus Report includes:

### For Each Property:
1. **Status Badge:** 🔴 Red / 🟡 Yellow / 🟢 Green (deterministic rules)
2. **KPI Strip (Fixed Order):**
   - Sessions (WoW %)
   - Organic Clicks (WoW %)
   - CTR (WoW Δ)
   - Avg Position (WoW Δ)
3. **Insight Line:** One-sentence summary (max 80 chars)
4. **Watch Flag (Optional):** Appears only when triggered (e.g. "CTR erosion")

### Properties Are Ordered:
1. Red properties first
2. Yellow properties second
3. Green properties last
4. Alphabetical within each status tier

---

## Configuration

### Update Focus List

Edit `config/focus_properties.yml`:

```yaml
focus_properties:
  - Botanic Luxury
  - Camber Ridge
  - CoHo
  - The Villages at Oakleaf
  # ... (23 properties total)
  - [Add new property here]
```

Property names must match the canonical names in `/Users/mark/Property_Analytics/config/venterra_properties_official.json`.

**No code changes required** — just edit the YAML file and regenerate.

---

## Data Sources

### Google Analytics 4 (GA4)
- **Metric:** Sessions
- **Lag:** 1 day (yesterday's data)
- **Window:** Last 7 complete days vs prior 7 days

### Google Search Console (GSC)
- **Metrics:** Organic Clicks, CTR, Average Position
- **Lag:** 3 days (T-3 to T-10 vs T-10 to T-17)
- **Window:** 7-day rolling periods

### Canonical Database
- **Location:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Tables:** `ga4_daily_metrics`, `gsc_daily_metrics`, `insights`

All data is pulled from the same canonical database used by Portfolio Pulse and Dashboard systems.

---

## Status Rules (Deterministic)

### 🔴 Red (Requires Attention)
Triggered by **any** of:
- Sessions declined ≥15% WoW AND <100 absolute
- Organic Clicks declined ≥20% WoW
- CTR declined ≥1.0pp WoW AND clicks >50
- Position worsened ≥3.0 positions WoW

### 🟡 Yellow (Monitor)
Triggered by **any** of (and no Red triggers):
- Sessions declined 10-14.9% WoW
- Organic Clicks declined 10-19.9% WoW
- CTR declined 0.5-0.99pp WoW
- Position worsened 1.5-2.9 positions WoW
- Mixed signals: one metric +15%, another -10%

### 🟢 Green (Performing Well)
Default when no Red or Yellow triggers

---

## Insight Rules (Deterministic)

One insight line per property, selected in priority order:

1. **Acceleration:** Sessions OR Clicks +20% WoW → "Strong growth momentum this week"
2. **Divergence:** Sessions/Clicks moved opposite directions by ≥10% → "Traffic divergence: ..."
3. **Concentration:** CTR +0.5pp OR Position improved 1.5+ → "Search visibility strengthening"
4. **Stable:** Default → "Steady performance, no significant changes"

---

## Watch Flags (Optional)

Flags appear **only when triggered**, in priority order:

1. **"CTR erosion"** → CTR declined ≥0.5pp WoW
2. **"Ranking slip with volume"** → Position worsened ≥1.5 AND impressions +10%
3. **"Demand softness"** → Sessions AND Clicks both declined ≥10% WoW

Max 1 flag per property.

---

## Output & Archiving

### HTML Report
- Outlook-compatible inline CSS
- Dark mode support
- Mobile responsive
- Print-friendly

### JSON Payload
- Complete debug metadata
- All KPI raw values and deltas
- Status/insight triggering rules
- Data window definitions

### Archive Location
```
reports/focus_report/
├── 2026-01-20/       # Initial release (5 properties)
│   ├── focus_report.html
│   └── focus_report.json
├── 2026-01-21/       # Expanded to 23 properties
│   ├── focus_report.html
│   └── focus_report.json
...
```

Archives are **never overwritten** and retained indefinitely.

---

## Email Configuration

Email settings use the **same environment variables** as Portfolio Pulse:

```bash
export REPORT_SENDER_EMAIL="mlaufhutte@venterraliving.com"
export REPORT_RECIPIENT_EMAIL="mlaufhutte@venterraliving.com"
export REPORT_PASSWORD_FILE="/Users/mark/Property_Analytics/credentials/email_password.txt"
```

Add these to `~/.zshrc` if not already configured.

---

## Common Tasks

### Test Report Generation (No Email)
```bash
cd scripts
python3 generate_focus_report.py
```

### Send Email from Existing Report
```bash
python3 send_focus_report_email.py --report-html ../reports/focus_report/2026-01-20/focus_report.html
```

### View Latest Report in Browser
```bash
open $(ls -t ../reports/focus_report/*/focus_report.html | head -1)
```

### Check JSON Payload
```bash
cat $(ls -t ../reports/focus_report/*/focus_report.json | head -1) | jq .
```

---

## Scheduling (Optional)

To automate weekly execution (e.g., every Monday at 8 AM), create a launchd plist similar to Portfolio Pulse's schedule. Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.venterra.focus.report</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/python3</string>
        <string>/Users/mark/Property_Analytics/focus_report/scripts/send_focus_report_email.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/mark/Property_Analytics/focus_report/logs/focus_report.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/mark/Property_Analytics/focus_report/logs/focus_report.log</string>
</dict>
</plist>
```

Save to `~/Library/LaunchAgents/` and load with `launchctl load ...`.

---

## Contract & Governance

**Contract Version:** 0.1  
**Contract Location:** `docs/FOCUS_REPORT_CONTRACT.md`

The contract defines:
- Scope and exclusions
- KPI definitions and order
- Status/insight/flag rules (deterministic)
- Data sources and lag policies
- HTML output requirements
- Archive requirements

**All logic changes require contract updates.**

---

## Troubleshooting

### No Data for Focus Property
**Cause:** Property name doesn't match registry or has no GA4/GSC data  
**Fix:** Verify name in `config/focus_properties.yml` matches canonical registry

### Email Not Sending
**Cause:** Missing credentials or environment variables  
**Fix:** Verify `REPORT_PASSWORD_FILE` exists and `REPORT_SENDER_EMAIL` is set

### Zero Sessions/Clicks
**Cause:** Data collection may not have run recently  
**Fix:** Check Portfolio Pulse collection status or run manually:
```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 collect_daily_data.py
```

### Wrong Date Window
**Cause:** System uses fixed 1-day (GA4) / 3-day (GSC) lag  
**Fix:** This is by design per contract — not configurable

---

## File Structure

```
focus_report/
├── config/
│   └── focus_properties.yml          # Curated Focus list
├── docs/
│   └── FOCUS_REPORT_CONTRACT.md      # System contract v0.1
├── scripts/
│   ├── generate_focus_report.py      # Report generator
│   └── send_focus_report_email.py    # Email sender
├── reports/
│   └── focus_report/
│       └── YYYY-MM-DD/               # Dated archives
│           ├── focus_report.html
│           └── focus_report.json
└── README.md                         # This file
```

---

## Dependencies

- Python 3.8+
- `pyyaml` (for config parsing)
- `sqlite3` (built-in)
- Shared modules:
  - `Portfolio_Monitoring/src/db/db_helper.py`
  - `Portfolio_Dashboard/utils/preflight.py`

Install PyYAML if needed:
```bash
pip3 install pyyaml
```

---

## Support

**Maintained By:** Mark Laufhutte (WebOps)  
**Email:** mlaufhutte@venterraliving.com  
**Last Updated:** January 21, 2026

**For Issues:**
1. Check `reports/focus_report/` for generated output
2. Verify Focus properties list matches registry
3. Confirm email credentials and environment variables
4. Review contract for expected behavior

---

## Version History

**v0.1.1 (2026-01-21):**
- Expanded Focus property set from 5 to 23 properties
- Configuration-only update (no code changes)
- All properties successfully resolved via registry
- Status distribution: 9 Red, 4 Yellow, 10 Green
- Watch flags triggered: CTR erosion (3), Demand softness (2)
- Contract v0.1 remains fully valid

**v0.1 (2026-01-20):**
- Initial release
- Four-KPI strip (Sessions, Clicks, CTR, Position)
- Three-tier status system (Red/Yellow/Green)
- Deterministic insights and watch flags
- Weekly cadence default
- Outlook-safe HTML + JSON payload
- Dated archive structure
