# Property Analytics System

## 🤖 FOR AI ASSISTANTS (ATLAS)

**⚠️ CRITICAL: Read this FIRST before any action in a new session**

📖 **Atlas Working Memory:** `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

This file contains:
- Current system state (what's working/broken)
- Complete architecture map
- Session log (recent changes)
- Critical issues
- Common commands
- Operational patterns

Also required before creating or extending systems:
- Capability register: `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- Full system audit: `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

**Session Start Protocol:**
1. Read `ATLAS_WORKING_MEMORY.md` completely (5 min)
2. Read `docs/CAPABILITY_REGISTER_2026-04-10.md`
3. Read `docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
4. Run `./atlas_session_start.sh` for quick health check
5. Check "Current System State" section
6. Review "Session Log" for recent changes
7. Note critical issues before starting work

**After EVERY significant action:**
- Update the session log in `ATLAS_WORKING_MEMORY.md`
- Update `docs/CAPABILITY_REGISTER_2026-04-10.md` when capability inventory, status, owner, or disposition changes
- Update `docs/FULL_SYSTEM_AUDIT_2026-04-10.md` when the narrative platform map materially changes
- Document what changed, what works, what's broken
- Verify with database queries, not assumptions
- Run `bash scripts/check_context_discipline.sh`

**Key Principle:** Verify first, assume never.

---

## System Purpose
Automated daily data collection and weekly reporting for Venterra's 91 property portfolio, tracking GA4 analytics, Google Search Console, SEMRush, and PageSpeed metrics.

## Secret Management

Default secret source is now Keeper Secrets Manager via the local `marketingops` profile.

Current Keeper-backed categories include:
- OpenAI
- PageSpeed / PSI
- GTmetrix
- SEMrush
- Cloudflare
- BrowserStack
- Google Ads
- GA4 service account
- GSC OAuth client and token

Canonical reference:
- `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`

Local files may still exist as compatibility fallbacks, but new setup should prefer Keeper-backed env vars and materialized temp files over long-lived credential files.

## Cloudflare Pilot Cache Work

For the five Resi pilot domains, Cloudflare cache observability and rollout tooling now exist in-repo.

Start here:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md`

Key implementation areas:

- Daily audit collector: `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- GraphQL analytics client: `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- Rollout tooling: `/Users/mark/Property_Analytics/ops/cloudflare/`

## Ops Watch And Cloudflare Mirror/Push

Ops Watch is the governed cross-system monitoring layer for Jira, Confluence, Microsoft 365, internal source packets, and Captain-facing operational signals.

Start here:

- `/Users/mark/Property_Analytics/docs/OPS_WATCH_RUNBOOK_2026-08-22.md`
- `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`
- `/Users/mark/Property_Analytics/docs/OPS_WATCH_CLOUDFLARE_OFFLOAD_PLAN_2026-08-22.md`
- `/Users/mark/Property_Analytics/docs/CAPTAIN_CLOUDFLARE_REFRESH_RUNBOOK_2026-08-24.md`
- `/Users/mark/Property_Analytics/docs/CAPTAIN_ROUTINE_SCHEDULER_RUNBOOK_2026-08-31.md`
- `/Users/mark/Property_Analytics/docs/CAPTAIN_TICKET_CARE_SOP_2026-09-04.md`
- `/Users/mark/Property_Analytics/docs/COMMODORE_BRIDGE_OPERATING_MODEL_2026-09-04.md`
- `/Users/mark/Property_Analytics/config/commodore_roster.json`

Live Cloudflare mirror/push ingest:

- Health: `https://ops-watch.venterrawebops.com/health`
- Worker: `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/`
- D1 tables: `ops_watch_ingest_runs`, `ops_watch_signals`, `ops_watch_action_queue`
- R2 prefix: `ops-watch/ingest/`

Credential source:

- Keeper record: `Ops Watch Ingest Shared Secret`
- Worker secret: `OPS_WATCH_INGEST_SHARED_SECRET`

Boundary: Cloudflare receives signed sanitized packets only. It does not crawl inward to intranet/private systems, and Captain-facing actions remain review-required. Captain Ticket Care and Commodore regional rollups are read-only by default; Jira comments, transitions, closures, Admiral escalations, and regional memory promotion still require explicit current-conversation approval. Commodore names and standing orders come from `config/commodore_roster.json`; do not hardcode alternate regional ownership downstream.

## Captain Cloudflare Refresh

The Captain refresh control plane moves recurring Captain Office Wall and persona/profile refresh into Cloudflare:

- Worker: `/Users/mark/Property_Analytics/ops/cloudflare/captain-refresh/`
- Health: `https://captain-refresh.venterrawebops.com/health`
- Status: `https://captain-refresh.venterrawebops.com/v1/captains/refresh/status`
- Schedule: every 30 minutes
- Worker version: `2920b8ec-8bf4-48d2-a208-ae687d327599`
- Git commit: `d19b96d`
- D1 tables: `captain_persona_profiles`, `captain_refresh_runs`, `captain_office_wall_snapshots`
- R2 prefix: `captains/`

The Worker creates missing Captain persona defaults, tracks the family-composition deadline, refreshes Office Wall snapshots from governed D1 state, and stores snapshot evidence in R2. It resolves the active Captain fleet by merging Awareness identities with active Captain support-agent properties; production readback currently resolves `94` active properties. It does not edit source systems or locked PIB files. Manual triggering requires a Keeper/KSM-backed `CAPTAIN_REFRESH_ADMIN_SECRET`; no local secret fallback is allowed.

## Captain Routine Scheduler

Captain support-agent routines run through the existing Cloudflare API Worker scheduled handler:

- Worker host: `pop-brief-api`
- Schedule: every `15` minutes, due-gated through D1
- Runbook: `/Users/mark/Property_Analytics/docs/CAPTAIN_ROUTINE_SCHEDULER_RUNBOOK_2026-08-31.md`
- Routine contract: `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json`
- D1 schedule table: `captain_routine_schedule`
- D1 run table: `captain_agent_runs`

The scheduler keeps the active Captain fleet current by syncing active `captain_support_agents`, leasing due rows, executing bounded batches through the existing Captain Runtime, and advancing daily or weekly lanes from completion state. It does not brute-force all `1,034` support agents on every wakeup and does not mutate Jira, Confluence, Microsoft 365, intranet systems, source tickets, Resi content, or locked PIB files.

## Unified Foundation

The platform now has an explicit foundation layer for capability awareness, security posture, repo boundaries, and migration planning.

Start here:

- `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md`
- `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md`
- `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md`
- `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
- `/Users/mark/Property_Analytics/config/platform_outcome_map.json`

Use these together with:

- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md`

Important repo note:

- this workspace contains multiple nested Git repositories
- treat nested repo boundaries as deliberate ownership boundaries during cleanup and migration work
- do not assume the top-level repo is the only Git history in play

## Critical Information

### Single Source of Truth
**Database:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- ALL collectors write here
- ALL reports read from here
- Never use JSON/CSV files as primary data source

### Property Registry
**File:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- 91 properties with GA4 IDs, GSC URLs, canonical names, aliases
- Used by: ALL collectors, ALL reports, PropertyRegistry class
- Never hardcode property lists

### Daily Automated Collection
**When:** 5:00 AM daily via launchd
**What:** Canonical daily collection and retry orchestration for GA4, GSC, GBP, Google Ads, PSI, GTMetrix, guest cards, BI workbooks, and related operational sources
**Script:** `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
**Launchd:** `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist`

Retry/recovery now has its own canonical loop:
**Script:** `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`

Legacy note:
- `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py` is now a legacy-reusable local path, not the canonical scheduled collection entrypoint

### Weekly Manual Report
**When:** User generates manually (typically Monday for Friday delivery)
**What:** Spotlight Properties report for 20-25 properties
**Script:** `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_from_db.py`
**Config:** `config/monthly_spotlight_properties_YYYY-MM.json` (one per month, reused weekly)
**Output:** `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`
**Behavior:** Auto-archives old reports to `archive/` subdirectory

## Architecture Overview

```
Data Flow:
1. Daily Collection (5 AM) → portfolio_analytics.db
   - GA4: ga4_daily_metrics + ga4_traffic_sources (14 days rolling)
   - GSC: gsc_daily_metrics (14 days rolling)
   - SEMRush: semrush_domain_metrics
   - PageSpeed: pagespeed_metrics

2. Insights Engine → insights table
   - Analyzes data daily
   - Generates warnings/errors for anomalies

3. Report Generator reads:
   - ga4_daily_metrics (T7/T30 engaged sessions)
   - ga4_traffic_sources (T7/T30 organic traffic)
   - insights (top 3 per property)
   - Outputs CSV to OneDrive
```

## Key Database Tables

### ga4_daily_metrics
- Primary: property_id + metric_date
- Contains: sessions, engaged_sessions, users, pageviews, bounce_rate
- Written by: collect_daily_data.py (daily)
- Read by: Spotlight report, Insights Engine

### ga4_traffic_sources
- Primary: property_id + metric_date + channel_group
- Contains: sessions, engaged_sessions by channel (Organic Search, Direct, Paid, etc.)
- Written by: collect_daily_data.py (daily)
- Read by: Spotlight report (for organic traffic metrics)
- **CRITICAL:** Without this data, organic columns in report are empty

### gsc_daily_metrics
- Primary: property_id + metric_date
- Contains: clicks, impressions, ctr, average_position
- Written by: collect_daily_data.py (daily)
- Read by: Insights Engine, reports

### insights
- Contains: AI-generated warnings/errors about anomalies
- Written by: Insights Engine (daily)
- Read by: Spotlight report (top 3 per property)
- Format: "{property_name}: {message}" → property name stripped in report

## Common Issues & Solutions

### Issue: "Organic traffic columns empty in report"
**Cause:** ga4_traffic_sources table missing data
**Check:** `sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db "SELECT COUNT(*) FROM ga4_traffic_sources"`
**Fix:** Prefer the canonical repair path first:
- rerun `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- then, if this is specifically a GA4 channel-user history gap, use `/Users/mark/Property_Analytics/Data_Collection/scripts/backfill_ga4_channel_new_users.py`
- use `Portfolio_Monitoring/backfill_traffic_sources.py` only as a legacy targeted repair tool when no canonical path exists yet

### Issue: "Report shows stale data"
**Cause:** Daily collection not running or reading wrong table
**Check:**
1. `launchctl list | grep venterra` (verify launchd jobs)
2. `sqlite3 portfolio_analytics.db "SELECT MAX(metric_date) FROM ga4_daily_metrics"`
**Fix:** Manually run the canonical collection lane:
- `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- if the issue is morning closure debt rather than a full missed run, use `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- treat `Portfolio_Monitoring/collect_daily_data.py` as legacy-reusable, not the default operational entrypoint

### Issue: "Property not in Spotlight report"
**Cause:** Not in monthly config
**Fix:**
1. Add to text file: `config/January_26_Spotlight_Properties.txt`
2. Regenerate: `python3 create_monthly_config.py config/January_26_Spotlight_Properties.txt 2026-01`

## Report Generation (Weekly Process)

1. Verify data freshness:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date) FROM ga4_daily_metrics"
```

2. Generate report:
```bash
cd /Users/mark/Property_Analytics/Spotlight_Properties_Report
python3 generate_weekly_spotlight_report_from_db.py \
  --config config/monthly_spotlight_properties_2026-01.json
```

3. Report outputs to: `/Users/mark/Library/CloudStorage/OneDrive-Personal/Website_Analytics_Reports/`

## Creating New Monthly Config

1. Create text file with property names (one per line): `config/January_26_Spotlight_Properties.txt`
2. Run: `python3 create_monthly_config.py config/January_26_Spotlight_Properties.txt 2026-01`
3. Output: `config/monthly_spotlight_properties_2026-01.json`
4. Use this config for ALL weekly reports that month

## Verification Commands

Check daily collection ran:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(*) as properties, MAX(metric_date) as latest FROM ga4_daily_metrics"
```

Check traffic sources exist:
```bash
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT COUNT(DISTINCT property_id) as properties, COUNT(DISTINCT metric_date) as days,
   MIN(metric_date) as earliest, MAX(metric_date) as latest FROM ga4_traffic_sources"
```

## Report Request System (New)

**Purpose:** Queue report generation tasks that Agent can execute in new sessions without context.

**Location:** `/Users/mark/Property_Analytics/REPORT_REQUESTS/`

**Usage:**
1. Create JSON request file in REPORT_REQUESTS/ directory
2. In new session, tell Agent: "Check for report requests" or "Process REPORT_REQUESTS"
3. Agent runs: `python3 process_report_requests.py`
4. Completed requests archived to `REPORT_REQUESTS/completed/`

**Documentation:** `REPORT_REQUESTS/README.md`

**Supported Reports:**
- Property Assessment (active sites) - `/Users/mark/Property_Analytics/generate_executive_assessment.py`
- Custom ad-hoc reports - Uses `utils/report_builder.py` framework
- PIB reports - Integration pending

**See also:** `PROPERTY_ASSESSMENT_REPORTS.md` for Property Assessment details

## Keeper Marketing Ops Credential Migration

This controlled one-time migration utility converts a local `.csv` or `.xlsx` credential spreadsheet into Keeper Commander JSON and, when explicitly confirmed, imports it into Keeper.

It is not a spreadsheet-to-Keeper sync. Do not put real passwords in prompts, comments, examples, issues, or logs.

Official Keeper references:

- [Commander JSON import](https://docs.keeper.io/en/keeperpam/commander-cli/command-reference/import-and-export-commands/json-import)
- [Commander import command](https://docs.keeper.io/en/keeperpam/commander-cli/command-reference/import-and-export-commands)
- [Commander sharing commands](https://docs.keeper.io/en/keeperpam/commander-cli/command-reference/sharing-commands)
- [Keeper Commander sample JSON files](https://github.com/Keeper-Security/Commander/tree/master/sample_data)

Keeper documents JSON imports with top-level `records` and `shared_folders` arrays. The shared-folder permission fields used here are the documented `can_edit`, `can_share`, `manage_users`, and `manage_records` fields.

Prerequisites:

1. Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Install Keeper Commander using Keeper's official instructions.

3. Authenticate Commander separately before running `--execute`. This utility does not accept, store, or request Keeper credentials.

```bash
keeper shell
```

Confirm you can access the vault and that the Keeper Team named `Marketing Ops` already exists.

Dry-run validation:

```bash
python keeper_marketing_ops_import.py --input credentials.xlsx --config config.yaml --dry-run
```

Legacy Venterra Marketing Logins workbook dry-run:

```bash
python keeper_marketing_ops_import.py \
  --input "/Users/mark/Downloads/Venterra Marketing Log ins.xlsx" \
  --venterra-marketing-logins-workbook \
  --allow-blank-passwords \
  --dry-run
```

The legacy workbook mode reads the known multi-sheet workbook layout instead of
only the active sheet. It maps the credential-bearing tabs, preserves source
sheet/row provenance as Keeper custom fields, and can include URL-only YouTube,
Facebook, and Yelp reference tabs when `--include-reference-records` is passed.
Use `--allow-blank-passwords` only for a complete legacy archive; rows with
missing source passwords are marked with a `Password Status` custom field.

Generate Keeper JSON:

```bash
python keeper_marketing_ops_import.py --input credentials.xlsx --config config.yaml --output keeper_import.json
```

The generated JSON contains plaintext credential data by design because Keeper Commander needs it for import. Treat it as highly sensitive, keep it local, and remove it after the migration.

Execute import:

```bash
python keeper_marketing_ops_import.py --input credentials.xlsx --config config.yaml --execute
```

Execute the legacy Venterra Marketing Logins import without a persistent output
file:

```bash
python keeper_marketing_ops_import.py \
  --input "/Users/mark/Downloads/Venterra Marketing Log ins.xlsx" \
  --venterra-marketing-logins-workbook \
  --allow-blank-passwords \
  --execute
```

Add `--include-reference-records` to also import URL-only reference records.

Execution only proceeds after validation passes, a safe dry-run summary is shown, and you type `IMPORT` at the confirmation prompt.

The utility runs:

```bash
keeper import --format=json <generated-json>
keeper import --format=json --users <generated-json>
```

The second command applies shared-folder user/team permissions from the JSON, per Keeper's Commander JSON import documentation. If your Commander version behaves differently, run `keeper help import` and execute those two steps manually from the generated JSON rather than guessing.

The import creates one shared folder, `Marketing Ops Shared Credentials`, and shares it with the Keeper Team `Marketing Ops`.

Default permissions are least privilege:

- Team can view/use imported records.
- Team cannot re-share records.
- Team cannot manage users.
- Team cannot manage records unless `manage_records: true` is set in config.
- Team cannot edit records unless `can_edit: true` is set in config.

The spreadsheet `folder` column is preserved as a `Source Folder` custom field. The tool does not create nested shared-folder structures because the Keeper JSON examples verify the shared-folder root shape, and this migration is intentionally conservative.

Supported input columns:

- `title` or `name`
- `username`, `login`, or `email`
- `password`
- `url` or `website`
- `notes`
- `folder`
- any other columns become Keeper custom fields

Required columns are `title`/`name` and `password`.

Post-migration cleanup checklist:

- Verify the `Marketing Ops` team can access the shared folder.
- Rotate high-risk shared passwords after import.
- Delete or securely archive the source spreadsheet.
- Remove generated Keeper JSON files.
- Confirm audit/reporting visibility in Keeper.

Tests:

```bash
python -m unittest discover -s tests
```

---

## Last Updated
2026-01-27 - Added Report Request System and Property Assessment framework (logo rendering issue resolved)
