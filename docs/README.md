# Property Analytics Documentation

**System Owner:** Mark Laufhutte
**Portfolio:** Venterra Living (91 properties)
**Database:** SQLite (`data/portfolio_analytics.db`)
**Last Updated:** 2026-04-09

---

## Quick Start

> Keeper Secrets Manager is now the preferred credential source for active
> automation in this repo. For the canonical mapping, use
> `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`.
> Treat local files under `credentials/` and similar folders as fallback-only
> unless a workflow has not yet been migrated.

### Essential References
1. **[DATABASE_SCHEMA_REFERENCE.md](DATABASE_SCHEMA_REFERENCE.md)** - Database schema, table structures, join patterns, common pitfalls
2. **[RESI_COMPARISON_ANALYSIS.md](RESI_COMPARISON_ANALYSIS.md)** - Resi vs Portfolio comparative analysis project documentation
3. **[CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md)** - Pilot Cloudflare HTML cache rollout plan and operational checklist
4. **[CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md](CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md)** - Day-of memory for the initial baseline and rollout implementation
5. **[PLATFORM_SYSTEM_CATALOG.md](PLATFORM_SYSTEM_CATALOG.md)** - Canonical catalog of major systems, their roles, source-of-truth ownership, and integration priorities
6. **[PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md)** - Unified architecture narrative across Data Pond, Intelligence Office, Specs, VACS, and pilot operations surfaces
7. **[INTELLIGENCE_OFFICE_MODEL.md](INTELLIGENCE_OFFICE_MODEL.md)** - Governance model for directives, source documents, approved claims, and operator instructions
8. **[CONTENT_OPERATIONS_MODEL.md](CONTENT_OPERATIONS_MODEL.md)** - Shared-foundation / separate-workspace model for VACS and Site Content Creator
9. **[SITE_CONTENT_CREATOR_MODEL.md](SITE_CONTENT_CREATOR_MODEL.md)** - Specs-aware evaluation, harmonization, and rewrite model for property website copy
10. **[PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md](PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md)** - Governing content strategy artifact for property narrative, site harmonization, VACS drafts, channel derivatives, and AI-readable content trails
11. **[OPS_WATCH_RUNBOOK_2026-08-22.md](OPS_WATCH_RUNBOOK_2026-08-22.md)** - Governed Jira/Confluence/Microsoft 365/Captain monitoring layer and action boundary
12. **[OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md](OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md)** - Live Cloudflare mirror/push ingest lane for sanitized internal Ops Watch exports

### Critical Knowledge
Before working with this system, **READ THESE FIRST:**

#### Database Schema Gotchas
- **GSC tables** use `ga4_property_id` for joins, NOT `property_id` (property_id contains URLs)
- **GA4 conversions column** is always 0 - use `ga4_event_facts` table with proper event mappings
- **Resi properties** use different conversion events than Portfolio properties
- **GSC data** has 3-day API lag - always exclude last 3 days in queries

See [DATABASE_SCHEMA_REFERENCE.md](DATABASE_SCHEMA_REFERENCE.md) for complete details.

---

## System Architecture

### Data Collection
**Master Script:** `Data_Collection/orchestration/daily_master_collection.py`
**Schedule:** Daily at 5:00 AM via launchd
**Configuration:** `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist`

**Collection Phases:**
1. GA4 daily metrics (91 properties)
2. GA4 event facts (conversion tracking)
3. Google Search Console (daily + device + queries)
4. PageSpeed Insights (mobile + desktop, all 5 Lighthouse categories)
5. Google Business Profile (metrics + insights + reviews)
6. Property metadata updates
7. Data validation & completeness checks
8. Email status report
9. Cloudflare cache audit for the Resi pilot domains

### Database
**Location:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
**Type:** SQLite 3
**Schema:** See [DATABASE_SCHEMA_REFERENCE.md](DATABASE_SCHEMA_REFERENCE.md)

**Core Tables:**
- `ga4_daily_metrics` - GA4 session/user metrics
- `ga4_event_facts` - Individual event tracking (for conversions)
- `gsc_daily_metrics` - Search Console data
- `pagespeed_metrics` - PageSpeed Insights (mobile/desktop)
- `gbp_daily_metrics` / `gbp_daily_insights` - Google Business Profile
- `property_metadata` - Property information

### Property Registry
**File:** `config/venterra_properties_official.json`
**Contains:** 91-property portfolio with GA4 IDs, domains, unit counts, metros

---

## Reporting Systems

### 1. Property Intelligence Brief (PIB)
**Purpose:** Daily operational dashboard for individual properties
**Script:** `Property_Intelligence_Brief/send_property_intelligence_brief_email.py`
**Frequency:** Daily automated delivery
**Content:** GA4, GSC, PSI, GBP metrics with 7/30-day trends

### 2. Resi vs Portfolio Comparative Analysis
**Purpose:** Ad hoc matched-pairs performance comparison
**Script:** `resi_phase2_CORRECTED.py`
**Documentation:** [RESI_COMPARISON_ANALYSIS.md](RESI_COMPARISON_ANALYSIS.md)
**Key Features:**
- Matches 3 operational Resi properties to Portfolio peers
- 5 category evaluation (Demand, Engagement, Conversion, Performance, Trust)
- HTML report + CSV data export
- **CRITICAL:** Uses proper event mappings for Resi vs Portfolio CIR calculations

### 3. Weekly Progress Reports
**Purpose:** Portfolio-wide performance tracking
**Script:** `generate_weekly_progress_report.py`
**Frequency:** Weekly

### 4. Data Collection Health Reports
**Purpose:** Monitor collection system status
**Script:** `Data_Collection/orchestration/daily_master_collection.py`
**Frequency:** Daily (sent with collection completion)
**Content:** Success/failure status for all 91 properties across 5 data sources

### 5. Cloudflare Cache Audit
**Purpose:** Measure whether Cloudflare is serving warm full-page HTML cache for the Resi pilot domains
**Script:** `Data_Collection/collectors/cloudflare_cache_audit.py`
**Frequency:** Daily via `daily_master_collection.py`
**Artifacts:** JSON + CSV + Markdown + PIB-style HTML in `reports/cloudflare_cache_audit/`

### 6. Ops Watch
**Purpose:** Monitor Jira, Confluence, Microsoft 365, internal source packets, and Captain-facing operational signals without source-system mutation by default
**Local runbook:** `docs/OPS_WATCH_RUNBOOK_2026-08-22.md`
**Cloudflare ingest runbook:** `docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`
**Live ingest health:** `https://ops-watch.venterrawebops.com/health`
**Storage:** D1 tables `ops_watch_ingest_runs`, `ops_watch_signals`, `ops_watch_action_queue`; R2 prefix `ops-watch/ingest/`
**Credential source:** Keeper record `Ops Watch Ingest Shared Secret`

---

## Critical Configuration

### Email System
**Utility:** `utils/email_sender.py`
**Config:** `credentials/email_config.json`
**Provider:** Gmail SMTP (smtp.gmail.com:587)
**Default Recipient:** mlaufhutte@venterraliving.com

**Usage:**
```python
from utils.email_sender import EmailSender

sender = EmailSender()
sender.send_email(
    subject="Report Title",
    html_body="<h1>Content</h1>",
    recipients=["recipient@example.com"],
    attachments=[("filename.csv", csv_bytes, "text/csv")]
)
```

### Resi Properties Configuration
**Domains:**
- cendanalife.com (424416990)
- camberridgeapartments.com (445473253)
- thedeltapearland.com (441503068)
- monteverdesatx.com (488649687 - pre-opening)

**Conversion Events:**
```python
# Resi properties
RESI_CONVERSION_EVENTS = [
    'resi_price_quote',
    'resi_application_start',
    'resi_apt_tour_click'
]

# Portfolio properties
PORTFOLIO_CONVERSION_EVENTS = [
    'pricequote_click',
    'applyonline_click',
    'scheduletour_click'
]
```

**DO NOT use `form_submit` for Portfolio CIR** - captures all forms, not just conversions.

---

## Common Workflows

### Running Resi Comparison Report
```bash
cd /Users/mark/Property_Analytics
python3 resi_phase2_CORRECTED.py

# Outputs:
# - reports/resi_comparison/resi_vs_portfolio_CORRECTED_FINAL_YYYY-MM-DD.html
# - reports/resi_comparison/resi_vs_portfolio_data_YYYY-MM-DD.csv
```

### Manual Data Collection
```bash
cd /Users/mark/Property_Analytics/Data_Collection/orchestration
python3 daily_master_collection.py
```

### Database Queries
```python
import sqlite3

conn = sqlite3.connect('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
cursor = conn.cursor()

# Example: Get last 15 days of GA4 data
cursor.execute('''
    SELECT property_id, metric_date, sessions, engaged_sessions
    FROM ga4_daily_metrics
    WHERE property_id = ?
      AND metric_date >= date('now', '-15 days')
    ORDER BY metric_date DESC
''', ('424416990',))

results = cursor.fetchall()
conn.close()
```

**REMEMBER:** Use `ga4_property_id` when joining to GSC tables!

---

## Key Learnings & Pitfalls

### Conversion Rate Calculation (CRITICAL!)
**WRONG:**
```python
# Using conversions column (always 0)
cir = (conversions / sessions) * 100
```

**CORRECT:**
```python
# Count events from ga4_event_facts
if is_resi:
    events = "('resi_price_quote', 'resi_application_start', 'resi_apt_tour_click')"
else:
    events = "('pricequote_click', 'applyonline_click', 'scheduletour_click')"

cursor.execute(f"SELECT COUNT(*) FROM ga4_event_facts WHERE property_id = ? AND event_name IN {events}", (pid,))
conversions = cursor.fetchone()[0]
cir = (conversions / sessions) * 100
```

### GSC Queries (CRITICAL!)
**WRONG:**
```sql
SELECT * FROM gsc_daily_metrics WHERE property_id = '424416990'  -- FAILS!
```

**CORRECT:**
```sql
SELECT * FROM gsc_daily_metrics WHERE ga4_property_id = '424416990'  -- Works
```

### Date Range Handling
- **GA4/PSI/GBP:** Use `date('now', '-N days')` directly
- **GSC:** Add `AND metric_date <= date('now', '-3 days')` for 3-day lag

### Data Coverage Validation
Always check coverage before generating conclusions:
```sql
SELECT COUNT(DISTINCT metric_date) as days_with_data
FROM ga4_daily_metrics
WHERE property_id = ? AND metric_date >= date('now', '-15 days')
```

Expected: ≥85% for GA4, ≥80% for PSI/GBP

---

## Troubleshooting

### Data Collection Failures
1. Check launchd status: `launchctl list | grep venterra`
2. View logs: `tail -f Data_Collection/logs/collection_YYYY-MM-DD.log`
3. Validate credentials in `credentials/` directory
4. Re-run manually: `python3 Data_Collection/orchestration/daily_master_collection.py`

### Database Issues
1. **Schema changes:** Regenerate queries using DATABASE_SCHEMA_REFERENCE.md
2. **Missing data:** Check data_completeness tables for gaps
3. **Wrong results:** Validate you're using correct ID columns (property_id vs ga4_property_id)

### Email Delivery Failures
1. Check config: `cat credentials/email_config.json`
2. Verify Gmail app password is current
3. Test utility: `python3 utils/email_sender.py --subject "Test" --body "Test" --recipients "your@email.com"`

---

## File Structure

```
/Users/mark/Property_Analytics/
├── data/
│   └── portfolio_analytics.db          # Main database
├── config/
│   └── venterra_properties_official.json  # Property registry
├── credentials/
│   ├── email_config.json               # Email settings
│   └── [API credentials]               # GA4, GSC, GBP keys
├── docs/
│   ├── README.md                       # This file
│   ├── DATABASE_SCHEMA_REFERENCE.md    # Schema documentation
│   └── RESI_COMPARISON_ANALYSIS.md     # Resi project docs
├── Data_Collection/
│   └── orchestration/
│       └── daily_master_collection.py  # Master collector
├── Property_Intelligence_Brief/
│   └── send_property_intelligence_brief_email.py  # PIB generator
├── utils/
│   ├── email_sender.py                 # Email utility
│   └── [other utilities]
├── reports/
│   └── resi_comparison/                # Resi analysis outputs
└── resi_phase2_CORRECTED.py           # Resi comparison script
```

---

## Support & Maintenance

### Regular Tasks
- **Daily:** Automated data collection (5:00 AM)
- **Weekly:** Review collection health reports for failures
- **Monthly:** Validate database growth and archive old data if needed

### Updates & Changes
1. **Document in version history** at bottom of relevant doc file
2. **Update this README** if changing system architecture
3. **Notify stakeholders** of breaking changes

### Contact
**System Owner:** Mark Laufhutte (mlaufhutte@venterraliving.com)

---

## Version History

- **2026-01-27:** Initial documentation created
  - Master README established
  - DATABASE_SCHEMA_REFERENCE.md created with critical ID normalization issues
  - RESI_COMPARISON_ANALYSIS.md documenting completed project
  - Fixed 3-day data collection outage (Jan 25-27)
  - Completed Resi vs Portfolio analysis with corrected CIR calculations
