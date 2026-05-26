# ATLAS WORKING MEMORY
**Last Updated:** 2026-05-26 22:23 UTC
**Purpose:** Single source of truth for Atlas AI - read this FIRST in every session

---

## 🎯 READ THIS FIRST

**If you're starting a new session:**
1. Read this entire file (5 min)
2. Read `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
3. Read `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
4. Check "Current System State" for what's broken/working
5. Review "Session Log" for recent changes
6. Update this file after EVERY significant action

**Critical Paths:**
- Master DB: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Property Registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- New Collection System: `/Users/mark/Property_Analytics/Data_Collection/`
- Legacy (Broken): `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
- Pilot evidence session memory: `/Users/mark/Property_Analytics/SESSION_MEMORY_2026-04-08_PILOT_SITE_EVIDENCE_AND_HARMONIZATION.md`
- Capability register: `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- Full system audit: `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

---

## 📊 CURRENT SYSTEM STATE

### Secrets Management (Keeper KSM) ✅
- **Default posture:** Keeper Secrets Manager is now the preferred credential source for active automation
- **Local profile:** `marketingops` is initialized and active on this machine
- **Canonical mapping:** `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`
- **Fallback posture:** legacy files under `/Users/mark/Property_Analytics/credentials/`, `/Users/mark/Property_Analytics/config/`, and Spotlight config folders are fallback only unless a workflow has not yet been migrated

**Keeper-backed categories now in place:**
- BrowserStack username + access key
- Cloudflare API token
- OpenAI API key
- PageSpeed / PSI API key
- GTmetrix API key
- SEMrush API key
- Google Ads API config (materialized temp `google-ads.yaml`)
- GA4 service-account JSON (materialized temp file)
- GSC OAuth client JSON (materialized temp file)
- GSC OAuth token pickle (materialized temp file)

**Operator notes:**
- Do not store Keeper one-time bootstrap tokens in shared application folders
- Prefer one secret per Keeper record, or structured multi-field records where appropriate
- Worker/runtime app secrets may still be injected through platform-native mechanisms such as `wrangler secret put`, but Keeper is the intended source of truth
- Legacy setup docs now align with the Access service-token cutover path: `scripts/check_env.md`, `scripts/bootstrap_cloudflare.sh`, and `docs/KSM_ADOPTION_PLAN.md` all treat `*_ACCESS_CLIENT_ID` and `*_ACCESS_CLIENT_SECRET` as the preferred model and `*_SHARED_TOKEN` as transitional fallback only
- Phase 1 operational docs now match that same posture: `docs/D1_MIRROR_RUNBOOK.md` and `docs/PHASE1_PROPERTY_ADVOCATE_ENABLEMENT_PLAN.md` prefer `PLATFORM_ACCESS_CLIENT_ID` plus `PLATFORM_ACCESS_CLIENT_SECRET` and retain `PLATFORM_SHARED_TOKEN` only as a migration fallback
- Core Zero Trust planning docs now reflect the implemented posture rather than an open design question: `docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`, `docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`, and `docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md` treat Access service-token credentials as canonical and shared bearer tokens as retirement-path fallback only
- `scripts/zero_trust_worker_secret_cutover.sh` now includes `--audit` and `--print-retire` modes so operators can check current shell posture for Access credentials versus legacy shared tokens and print the cleanup commands before removing fallback secrets
- `scripts/zero_trust_worker_secret_cutover.sh` now resolves Access credential values from Keeper notation first and direct env vars second, so `--apply` can push Worker secrets without manually materializing raw client ids and secrets in the shell
- `apps/api/scripts/verify_phase1_platform_cutover.sh` now mirrors that same Keeper-first resolution order and prints the effective auth mode/source during verification, which makes post-deploy cutover validation match the actual production secret model
- `scripts/zero_trust_rollout_sequence.sh` now provides a single operator wrapper for audit-only, apply, deploy, and verify sequencing while delegating actual work to the canonical cutover and verification scripts
- D1 mirror launch paths are now hardened for launchd-safe Keeper usage: `apps/api/scripts/wrangler_auth.py` injects canonical fallback `KSM_PROFILE=marketingops` and the documented Cloudflare token notation when launchd does not export them, and the parent collection/retry/alert paths now pass that resolved env into `d1_mirror_sync.py`
- Keeper helpers now resolve the `ksm` binary explicitly from canonical macOS/Python paths instead of assuming an inherited shell PATH, which makes launchd and stripped runtime environments materially safer
- The live Google Ads collector at `Portfolio_Dashboard/scripts/collect_google_ads_data.py` now initializes from a Keeper-materialized temp config using the canonical `Google Ads API Config v2` UID by default, rather than depending on the legacy `Portfolio_Monitoring/google-ads.yaml` file being present
- Google Ads collection semantics are now less brittle for the manager-account reality: the collector distinguishes `success`, `no_activity`, `mapping_gap`, and `api_failure`, and the retry worker resolves `no_activity` properties as non-failures instead of endlessly re-queuing them
- Prelaunch/non-live communities are now suppressed from canonical GSC reporting by shared registry policy instead of only being filtered in alert presentation; this currently removes `The Vine Kyle Parkway` and `Sundara at Spring Cypress` from GSC collection, GSC URL inspection, and GSC retry debt while they remain `lifecycle: prelaunch` in the registry
- Google Ads bootstrap failures are now first-class operational states instead of raw collector exits: the collector raises a typed bootstrap exception, the daily collector records the run as `blocked` with a source-level retry item, and the retry worker preserves queued property work while reporting the Keeper/bootstrap block explicitly
- The morning retry worker now also supports true source-level Google Ads recovery when no same-day Ads run exists yet; it can execute a full Ads collection pass from the source-level retry item, resolve `no_activity` cases as non-failures, and write a real `data_collections` completion row instead of leaving `google_ads` stuck as `missing`
- Launchd collection/retry entrypoints now export a stable Keeper runtime envelope for Ads (`HOME`, `USER`, `LOGNAME`, `KSM_PROFILE=marketingops`, and the canonical `KSM_GOOGLE_ADS_CONFIG_UID`) so the Ads collector does not depend on implicit desktop-shell inheritance
- Source-level retry bookkeeping is now fixed for `unit_availability` and `d1_mirror` too: successful retry-worker actions create/complete same-day `data_collections` rows so closure and Watchtower do not keep those sources stuck in `missing/no_run_recorded` after they have already recovered
- Guest card harvest is active again by default (`GUEST_CARD_HARVEST_SUSPENDED=0` unless explicitly overridden); canonical guest card ingest resumed from the OneDrive drop on 2026-04-15 and advanced `guest_card_metrics` through `2026-04-15` for 91 properties
- Corporate SQL Server Data Warehouse access is now verified over AWS VPN through the Keeper/KSM-backed `Data Warehouse` credential and read-only `dw_reader` login; the source is represented in the Pond landscape as `data_warehouse_upstream` with trust boundary `corporate_vpn_sql_readonly`, documented in `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_POND_INTEGRATION_MAP_2026-05-26.md`, and paired with first-pass workbook artifact `/Users/mark/Property_Analytics/outputs/data_warehouse/Data_Warehouse_Map_2026-05-26.xlsx`
- Data Warehouse integration posture is validation-first: preserve and compare the existing daily guest-card CSV contract before replacing OneDrive/manual export dependencies with direct Data Collection extractors; the highest-confidence source lane is leasing funnel / guest cards, followed by Kingsley/reputation, marketing attribution, and pricing/availability
- The responsible harvest plan for moving Data Warehouse evidence into Captain routines and system surfaces now lives at `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_HARVEST_TO_CAPTAINS_PLAN_2026-05-26.md`; the plan requires source contracts, property identity resolution, PII minimization, validation gates, Pipeline Health Snapshots, Watchtower visibility, and Captain signal packs before recommendations use the new data
- Data Warehouse daily shadow harvest now has a Keeper-backed local routine at `/Users/mark/Property_Analytics/scripts/run_data_warehouse_daily_harvest.mjs`, runbook `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DAILY_SHADOW_HARVEST_RUNBOOK_2026-05-26.md`, and daily Codex local automation `data-warehouse-daily-shadow-harvest`; first clean packet is `/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/2026-05-26_20260526_152346` for completed window `2026-05-25` to `2026-05-26`, with 363 guest cards, 185 portal quotes, 89 online apps, 3 pipeline apps, 103 scheduled tour appointments, 18 business watch items, and 1 data-quality item for future-dated `dbo.dw_prospect_log_entry.created_dtt`
- Data Warehouse direct no-CSV guest-card supply now exists at `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs` with runbook `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DIRECT_GUEST_CARD_SUPPLY_2026-05-26.md`; default mode writes `guest_card_metrics_dw_direct` only, preserving canonical `guest_card_metrics`, while explicit `--apply-canonical --trusted-core-only` can later update stable core fields without overwriting advisory quote/pipeline/tour fields; first shadow run for `2026-05-26` wrote 92 rows, 363 trusted guest cards, 89 trusted online apps, and report `/Users/mark/Property_Analytics/outputs/data_warehouse/direct_supply/guest_card_metrics/2026-05-26_20260526_172120/direct_supply_report.json`
- Data Warehouse guest-card export reconciliation now has a Keeper-backed script at `/Users/mark/Property_Analytics/scripts/reconcile_data_warehouse_guest_card_exports.mjs` and result doc `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_GUEST_CARD_RECONCILIATION_2026-05-26.md`; latest 10-file proof packet is `/Users/mark/Property_Analytics/outputs/data_warehouse/reconciliation/guest_card_exports/20260526_171126`, with 2 exact-match files, 8 mismatches, 0 row deltas, 0 metadata deltas, 36 metric deltas, and 47 total absolute metric delta, concentrated in pipeline apps plus small quote/tour drift; keep DW leasing-funnel lane `degraded_advisory` until source-owner review or same-day repeated reconciliation explains the deltas
- Data Warehouse direct guest-card supply now has a shadow-only supplier at `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs` and runbook `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DIRECT_GUEST_CARD_SUPPLY_2026-05-26.md`; default mode writes only `guest_card_metrics_dw_direct`, while canonical `guest_card_metrics` updates require explicit `--apply-canonical --trusted-core-only` and preserve degraded advisory fields until quote, pipeline-app, and tour drift is explained
- The property identity governance gap is now closed for this lane: `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` resolves exact identifiers through `/Users/mark/Property_Analytics/config/property_identity_matrix.json`, `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh` validates the matrix and latest Data Warehouse harvest property codes, and the matrix now includes empirically observed Data Warehouse `property_cd` values `TX4CY` for Sundara at Spring Cypress and `TX4EK` for The Vine Kyle Parkway
- Captain Signal Flow is now defined in `/Users/mark/Property_Analytics/docs/CAPTAIN_SIGNAL_FLOW_2026-05-26.md` and `/Users/mark/Property_Analytics/config/captain_signal_flow_manifest.json`; `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_captain_advisory.mjs` converts the latest validated Data Warehouse harvest into Captain-facing Markdown/JSON/CSV packets under `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/`, with the first packet at `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/2026-05-26_20260526_154651` marked `degraded_advisory`; the daily automation now runs both the warehouse harvest and Captain advisory generation
- Governed config persistence is now explicit: `/Users/mark/Property_Analytics/docs/GOVERNED_CONFIG_PERSISTENCE_POLICY_2026-05-26.md` documents that `config/*` stays ignored by default, while `.gitignore` now allowlists non-secret governed JSON needed for Captain/Data Warehouse work: `config/property_identity_matrix.json`, `config/captain_active_routine_manifest.json`, and `config/captain_signal_flow_manifest.json`; sensitive local config such as API keys, OAuth tokens, credential YAML, generated config, and screenshots remains ignored
- The shared Guest_Card_Reports drop is also now caught up for pilot BI snapshots through `2026-04-15` via `pilot_control_cwv/scripts/ingest_bi_export_snapshot.py` for 2026-04-08, 2026-04-10, 2026-04-13, and 2026-04-15 workbooks
- BI workbook harvest is now part of the canonical morning collection path: `Data_Collection/utils/bi_manual_ingest.py` discovers `BI-Metrics-RunYYYYMMDD.xlsx` files in the shared Guest_Card_Reports drop, `daily_master_collection.py` ingests pending snapshots during the daily routine, and `retry_incomplete_collections.py` re-checks the drop later in the morning for late-arriving BI workbooks without creating a separate scheduler
- The same shared drop still has a lagging Measurement workbook: `Measurement_Dashboard_1.1.xlsx` currently only contains daily sheets through `4.11.26`, so `measurement_daily_metrics` is now freshest at `2026-04-11` and cannot advance further until that workbook itself is updated upstream
- After the guest card / BI catch-up on `2026-04-15`, the real D1 mirror succeeded again in `apps/api/scripts/generated/d1_mirror_report_20260415_143256.json`; local recency now includes `guest_card_metrics.run_date=2026-04-15`, and same-day closure evaluates `complete` with `queue_depth=0`
- Historical retry debt is now archived automatically by the retry worker: unresolved queue items for past dates are marked `exhausted` with reconciliation notes, so old days stop presenting as live queue debt
- Daily closure semantics are now split between live operations and historical governance: current-day closure can still be `open` / `blocked` / `complete`, while past dates now evaluate `archived` once outside the retry window, with unresolved source gaps preserved as informational context rather than pretending old debt is still an active live incident
- Closure output now also includes `advisory_sources` for non-core lanes such as BI, Measurement, PSI, GSC URL inspection, SEMrush, GBP, and Cloudflare cache audit so Watchtower/API consumers can see governance breadth without forcing every advisory source to block the daily summary lane
- Watchtower now renders that richer closure payload too: structured unresolved-source reasons, `archived` historical closure state, `blocked` live closure state, and an advisory-governance panel so the operator surface reflects broader governance posture instead of only the narrow core closure lane
- `apps/api/src/lib/service-auth.ts` is now type-safe around Cloudflare Access cert JWK `kid` handling, which clears the API-side TypeScript issue that was blocking cleaner release verification
- The current repo-noise situation now has a canonical branch split map in `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`: production promotion should come from `codex/release-reconcile`, while the remaining dirty-tree work is primarily pilot CWV/reporting, Intelligence Office / Site Content / Search Intelligence / VACS, Zero Trust / SSO docs/tooling, and EVS / BrowserStack follow-up streams
- The repo now also has an explicit foundation layer for system awareness and migration planning:
  - `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md`
  - `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
  These are meant to make the platform self-aware across canonical systems, trust zones, nested Git boundaries, and off-Pond capabilities that still need governed visibility
- The canonical launch role model is now documented in `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`: technical keys remain `viewer`, `editor`, and `admin`, while product-facing titles are `Observer`, `Curator`, and `Steward`
- The preferred workforce SSO model is now explicitly documented as Microsoft Entra ID -> Cloudflare Access -> Data Pond role mapping, with canonical cohort names `Data Pond Observers`, `Data Pond Curators`, and `Data Pond Stewards`
- The dedicated workforce identity setup doc is now `/Users/mark/Property_Analytics/docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md`, which defines the group model, Access app mapping, launch assignment guidance, and phased setup sequence for internal SSO
- `apps/api/src/lib/service-auth.ts` now supports origin-side validation of Cloudflare Access JWT assertions for machine routes using the team cert endpoint, so `platform`, `vacs`, and `evs` can authenticate through Access service-token apps after Cloudflare consumes the raw client id/secret at the edge
- `apps/api/src/routes/auth.ts` now bootstraps a first-party `pop_session` from a valid Cloudflare Access browser identity on `/v1/auth/me`, and the web app now uses a same-origin bridge at `apps/web/src/app/auth/access-bootstrap/route.ts` plus `apps/web/src/components/auth-provider.tsx` to forward Cloudflare Access headers server-side and capture that session before falling back to app-native login
- `apps/web/src/app/login/page.tsx` now uses that same app-host bootstrap bridge before rendering Magic Link/password UI, and the bridge returns more specific fallback states (`cloudflare_access_missing`, `cloudflare_access_api_unreachable`, `cloudflare_access_no_session`, `cloudflare_access_unavailable`) so Cloudflare-vs-app-session failures can be distinguished instead of silently landing on the generic Data Pond login page
- Browser bootstrap and API CORS now recognize both `app.venterradev.com` and `app.venterraliving.com`, so Cloudflare Access can hand users back to the hostname they actually entered instead of defaulting to the legacy app host or falling through to the native login screen
- Cloudflare Access browser identities can now be auto-provisioned into Data Pond as least-privilege app users during `/v1/auth/me` and `/v1/auth/access-bootstrap`, which lets Zero Trust act as the gatekeeper of record while preserving app-level role enforcement for `viewer` / `editor` / `admin`
- `apps/api/migrations/0023_seed_phase1_platform_control_plane.sql` is now the canonical idempotent bootstrap for Phase 1 control-plane rows (`mirror_domains`, `cb_phase1_v1`, `exec_policy_property_advocate`, `agent_prop_1`, and related governance seed data) after `0021_create_phase1_platform_tables.sql`

### Platform Security Boundary (Cloudflare Zero Trust + Keeper) ✅
- **Canonical architecture doc:** `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- **Access matrix doc:** `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- **Implementation checklist doc:** `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- **Keeper manifest doc:** `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
- **Operator runbook doc:** `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
- **Worker secret cutover doc:** `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- **Security model:** Keeper is the source of truth for secrets; Cloudflare Zero Trust is the outer trust boundary; app auth remains responsible for authorization and product roles
- **Primary user model:** internal users via SSO, external users via Cloudflare Access email OTP, automation via service tokens, admin/operator access strengthened with MFA and device posture over time
- **Current production-facing hosts:** `app.venterradev.com` (Pages) and `api.venterradev.com` (Workers)
- **Repo-observed hardening item:** the former Site Content debug-bypass path was retired on 2026-04-17 and should not be reintroduced into production auth flow
- **Current service-identity inputs in app layer:** `PLATFORM_SHARED_TOKEN` and `EVS_SHARED_TOKEN` remain transitional fallback concepts; VACS now uses Access service-token auth as its canonical route model

### Master Database ✅
**Location:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Size:** 166 MB  
**Last Updated:** 2026-01-28 21:59  
**Schema:** 60+ tables (Phases 1-4 complete)  
**Properties:** 92 in database, 91 in registry

### Data Freshness (AS OF 2026-01-28 22:51)
**GA4:**
- ✅ FRESH: 92/92 properties have Jan 27 data (collected at 21:59 today)
- Jan 27: 92 properties with fresh data
- **Status:** Collection working correctly

**GSC:**
- ✅ FRESH: 93 properties with data through Jan 25 (collected at 21:18 today)
- 3-day lag confirmed (latest available: Jan 25)
- **Status:** Collection working correctly

**Overall Status:** All data sources fresh and collecting properly

### Data Collection System
**Primary (NEW):** `/Users/mark/Property_Analytics/Data_Collection/`
- ✅ Structure unified and clean
- ⚠️ GSC collection partially working but unstable
- ✅ GA4 collection working well
- ⚠️ Scheduled job at 5:00 AM - status unknown for today
- ✅ Writing to master DB correctly

**Legacy (BROKEN):** `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- 🔴 `collect_daily_data.py` has module import errors
- 🔴 Not in use, not scheduled
- ℹ️ Should be deprecated

### Scheduled Jobs (launchd)
```
✅ com.venterra.portfolio.collection  - 5:00 AM (Data_Collection)
✅ com.venterra.portfolio.pulse       - 8:00 AM (Portfolio Pulse)
✅ com.venterra.daily.health          - 9:00 AM (Health Reports)
✅ com.venterra.weekly.progress       - 10:00 AM Mon (Progress)
⚠️ com.venterra.portfolio.psi         - Multiple runs (needs investigation)
🔴 com.venterra.semrush_weekly        - Exit 1
⏸️ com.venterra.registry_validation   - Disabled (duplicate alert source intentionally turned off)
🔴 com.venterra.psi_daily            - Exit 1
```

### Active Secret Resolution Pattern
- **Preferred:** Keeper notation or Keeper-backed file materialization
- **Secondary:** plain environment variable
- **Last resort:** repo-local or user-local credential file
- **Primary helpers:** `/Users/mark/Property_Analytics/utils/ksm.py`, `/Users/mark/Property_Analytics/utils/keeper_file_materializer.py`, `/Users/mark/Property_Analytics/utils/google_ads_ksm.py`, `/Users/mark/Property_Analytics/utils/config_manager.py`

---

## 🏗️ SYSTEM ARCHITECTURE

### Core Components

#### 1. Master Database (Single Source of Truth)
**Path:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Writers:**
- Data_Collection system (primary)
- Legacy collectors (deprecated, don't use)

**Readers:**
- Property Intelligence Brief (PIB)
- Portfolio Pulse
- Daily Health Reports
- Weekly Progress Reports
- Spotlight Properties Report
- All monitoring/alert systems

**Schema Phases:**
- Phase 1: Collection Monitoring ✅
- Phase 2: Single-Source Quality Validation ✅
- Phase 3: Cross-Source Correlation ✅
- Phase 4: Anomaly Detection (SOFT/INFO only) ✅

#### 2. Property Registry (Single Source of Truth)
**Path:** `/Users/mark/Property_Analytics/config/venterra_properties_official.json`  
**Properties:** 91 Venterra properties  
**Contains:** GA4 IDs, GSC URLs, names, aliases, site types

**Used By:** EVERYTHING - never hardcode property lists

#### 3. Data Collection System (Unified)
**Path:** `/Users/mark/Property_Analytics/Data_Collection/`

**Structure:**
```
Data_Collection/
├── db/                  # DatabaseManager (primary, use this)
├── collectors/          # Individual source collectors
├── orchestration/       # daily_master_collection.py (main script)
├── monitoring/          # Anomaly detection, alerts, health checks
├── utils/              # Shared utilities
└── logs/               # Collection logs
```

**Main Script:** `orchestration/daily_master_collection.py`
- Scheduled: 5:00 AM daily
- Collects: GA4, GSC, Google Ads, PSI, SEMRush, GBP
- Database: Hardcoded to master DB (line 66)

#### 4. Reporting Systems

**Property Intelligence Brief (PIB):**
- Path: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`
- Prior locked baseline: `v1.9.0` (locked official - 2026-01-31)
- Approved locked versioned successor: `v2.2.0` via `generate_property_intelligence_brief_v2_2_0.py`, `send_property_intelligence_brief_email_v2_2_0.py`, and `templates/executive_email_template_v2_2_0.py`
- New v2.2.0 capability: SightMap Signals panel for Resi properties, backed by `ga4_event_facts`
- Database: ✅ Master DB
- Email: Uses unified EmailSender
- Template: `templates/executive_email_template.py`
- Documentation:
  - `Property_Intelligence_Brief/docs/PIB_V1_9_STYLING_LOCKED.md`
  - `Property_Intelligence_Brief/docs/PIB_V2_2_0_LOCKED_STANDARD.md`

**Search Intelligence Report:**
- App path: `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx`
- API path: `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`
- Version: `v1.0.0`
- Scope: single-property keyword and competitor deep dive with optional email send
- Outputs: PIB-style HTML preview plus HTML/Markdown/JSON attachments
- Documentation: `/Users/mark/Property_Analytics/docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md`

**Portfolio Pulse:**
- Path: `/Users/mark/Property_Analytics/Portfolio_Monitoring/`
- Schedule: 8:00 AM daily
- Database: ✅ Master DB
- Delivery: Email + OneDrive

**Daily Health Reports:**
- Schedule: 9:00 AM daily

**Spotlight Properties Report:**
- Path: `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`
- Data source: ✅ Master DB
- Monthly property rotation: ✅ Repo-managed durable config
- Export naming: ✅ Repo-managed monthly import-name matrix
- Latest monthly setup completed: April 2026
- Latest successful report: `/Users/mark/Downloads/Spotlight_Properties_20260408_133019.csv`
- Database: ✅ Master DB

**Weekly Progress:**
- Schedule: 10:00 AM Mondays
- Database: ✅ Master DB

**Spotlight Properties Report (Weekly):**
- Path: `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`
- Schedule: Wednesdays at 12:00 PM (launchd: com.venterra.spotlight.weekly)
- Script: `generate_weekly_spotlight_report_from_db.py`
- Database: ✅ Master DB (reads only, no collection)
- Output: OneDrive

**Core Web Vitals Snapshot:**
- Scripts: `generate_cwv_snapshot.py`, `send_cwv_snapshot_email.py`
- Purpose: Portfolio-wide PageSpeed/CWV rankings
- Database: ✅ Master DB
- Output: HTML + Excel via email

**GSC Portfolio Snapshot:**
- Scripts: `generate_gsc_snapshot.py`, `send_gsc_snapshot_email.py`
- Purpose: Portfolio-wide GSC organic search performance (30 days)
- Database: ✅ Master DB
- Output: HTML + Excel via email
- Features: Ranked by clicks, actual property names from registry, trend indicators

#### 5. Monitoring & Alerts

**Data Freshness Test:**
- Script: `Portfolio_Monitoring/send_data_alerts.py`
- Database: ✅ Master DB
- Status: ✅ Working correctly
- Last Run: Identified 103 issues (2026-01-28)

**Anomaly Detection:**
- Path: `Data_Collection/monitoring/anomaly_detector.py`
- Database: ✅ Master DB via DatabaseManager
- Status: ✅ Implemented (SOFT/INFO classifications)

---

## 📋 DATA SOURCES

### Google Analytics 4 (GA4)
- **API:** Google Analytics Data API v1
- **Properties:** 90 unique (91 registry, 1 shared ID)
- **Expected Lag:** 1 day (yesterday's data)
- **Tables:** `ga4_daily_metrics`, `ga4_traffic_sources`, `ga4_device_metrics`
- **Collection:** ✅ Working well (76/92 properties)

### Google Search Console (GSC)
- **API:** GSC API v1
- **Properties:** 93 registered
- **Expected Lag:** 3 days (T-3, confirmed by API testing)
- **Tables:** `gsc_daily_metrics`, `gsc_queries`
- **Collection:** ✅ Working (93 properties, collected 2026-01-28 21:18)

### Google Ads
- **API:** Google Ads API v22
- **Manager Account:** 9089267423
- **Properties:** 57 mapped
- **Expected Lag:** 1 day
- **Tables:** `google_ads_campaigns`, `google_ads_keywords`
- **Collection:** Status unknown (not verified recently)

### PageSpeed Insights (PSI)
- **API:** PSI API v5
- **Properties:** 89-90
- **Expected Lag:** Real-time
- **Tables:** `pagespeed_metrics`
- **Collection:** ✅ Working (12 runs on 2026-01-28)

### SEMRush
- **API:** SEMRush API v3
- **Properties:** 90
- **Expected Lag:** 0-1 days
- **Tables:** `semrush_domain_metrics`, `semrush_keyword_rankings`
- **Collection:** Status unknown

### Google Business Profile (GBP)
- **API:** GBP API
- **Properties:** 22+ with reviews
- **Tables:** `gbp_reviews`, `review_sentiment`, `gbp_insights`
- **Collection:** Status unknown
- **Historical:** 22,509 reviews backfilled (2009-2026)

---

## 🚨 CRITICAL ISSUES (Priority Order)

### 1. GSC Collection Unstable (CRITICAL)
**Impact:** Only 3-5 properties collecting, 90 properties stale  
**Evidence:** Jan 25 data shows only 3 properties  
**Root Cause:** Collection hangs or fails during GSC processing  
**Owner:** Mark is debugging in parallel thread  
**Next Steps:** Wait for Mark's fix from other session

### 2. GA4 Collection Incomplete (HIGH)
**Impact:** 15 properties not collecting  
**Evidence:** 76/92 properties have recent data  
**Root Cause:** Unknown - need to check logs  
**Next Steps:** Review collection logs for those 15 properties

### 3. Multiple Scheduled Jobs Failing (MEDIUM)
**Failing Jobs:**
- com.venterra.semrush_weekly (exit 1)
- com.venterra.psi_daily (exit 1)

**Operational note:** `com.venterra.registry_validation` was later disabled intentionally to prevent duplicate validator emails once registry findings were folded into the consolidated alert.

**Next Steps:** Check logs for the remaining failing jobs

### 4. Legacy Collection System Broken (LOW)
**Impact:** Cannot use as fallback  
**Evidence:** ModuleNotFoundError in Portfolio_Monitoring  
**Action:** Deprecate or fix import paths

---

## ✅ VERIFIED WORKING

1. **Master Database:** All systems reference correct path
2. **Property Registry:** Unified, no hardcoded lists
3. **Email System:** `utils/email_sender.py` used by all
4. **Data_Collection Structure:** Clean imports, no conflicts
5. **DatabaseManager:** Primary version in Data_Collection working
6. **Reporting Systems:** All reading from master DB
7. **Alert Systems:** Freshness monitoring operational
8. **GA4 Collection:** 76/92 properties collecting successfully
9. **PSI Collection:** Running and logging properly

---

## 📝 SESSION LOG

### 2026-04-16 - Watchtower Phase 1: health contract stabilized for closure context
**Actions:**
- Stabilized the first core seam in the `platform-app` lane by aligning the Watchtower backend contract with the frontend closure model already in use.
- `apps/api/src/routes/health.ts` now returns a richer `daily_collection_status.closure` payload including:
  - structured `unresolved_sources`
  - structured `advisory_sources`
  - `queue_depth`
  - `next_retry_at`
  - `cutoff_at_local`
  - more meaningful closure-state reasoning (`open`, `complete`, `blocked`, `not_started`)
- This removes a real backend/frontend mismatch where Watchtower expected structured closure context but the API only returned a flat unresolved-source string list.
- Added targeted regression coverage so the closure payload shape is now protected as part of the Watchtower contract.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/health-status.test.ts`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

**Verification completed:**
- `npx tsx --test test/platform/health-status.test.ts` in `apps/api`
- `npm run typecheck` in `apps/api`
- `npm run build` in `apps/web`

### 2026-04-16 - Watchtower Phase 2: operator deck now uses closure context more directly
**Actions:**
- Tightened the Watchtower page so the stabilized closure contract now shows up in the actual operator-facing deck instead of sitting mostly unused behind the scenes.
- `apps/web/src/app/watchtower/page.tsx` now:
  - uses closure detail text in the top command rail
  - reflects blocked/open/complete state more clearly in the collection deck badge
  - surfaces advisory lane posture in the operations core
  - exposes operational cutoff, next retry timing, and queue depth directly in the Closure Context section
- This makes the page read more like a live operating surface for morning closure and retry posture rather than a generic status dashboard.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

**Verification completed:**
- `npm run build` in `apps/web`

### 2026-04-16 - Cloudflare bootstrap now scopes browser session cookies to the active frontend domain
**Actions:**
- Fixed a real cross-host bootstrap bug in the `platform-app` auth lane: browser sessions issued by `/v1/auth/access-bootstrap` were still hardcoded to `Domain=.venterradev.com`, which could break bootstrap when the active frontend host was `app.venterraliving.com`.
- `apps/api/src/routes/auth.ts` now derives the cookie domain from the resolved frontend origin so browser session cookies follow the active app host family:
  - `.venterradev.com`
  - `.venterraliving.com`
  - no forced domain in localhost/dev cases
- Strengthened regression coverage so the Cloudflare bootstrap test now asserts that the redirected `app.venterraliving.com` flow also gets a cookie scoped to `.venterraliving.com`.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/test/auth/cloudflare-bootstrap.test.ts`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

**Verification completed:**
- `npx tsx --test test/auth/cloudflare-bootstrap.test.ts` in `apps/api`
- `npm run typecheck` in `apps/api`

### 2026-04-16 - Frontend auth flow now clears stale signed-out browser state on successful session resolution
**Actions:**
- Tightened the browser-side half of the Cloudflare bootstrap loop so the app clears stale signed-out state once a valid Data Pond session is resolved again.
- Updated:
  - `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/verify/page.tsx`
- New behavior:
  - successful `/v1/auth/me` resolution now clears the `cloudflare_logged_out` browser flag
  - successful password login clears the stale signed-out flag before returning to the app
  - magic-link completion clears the stale signed-out flag before redirecting to API verification
- This reduces a subtle class of frontend auth inconsistencies where the browser could still behave like it was intentionally signed out even after the app had a valid session again.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/login/verify/page.tsx`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

**Verification completed:**
- `npm run build` in `apps/web`

### 2026-04-16 - Worktree cleanup and compartment map
**Actions:**
- Assessed the current dirty worktree as several overlapping live workstreams rather than one unresolved change set.
- Wrote an explicit compartment map so ongoing work can be finished intentionally by lane instead of staying mixed together:
  - platform / app rollout
  - data collection hardening
  - pilot / CWV reporting expansion
  - content operations / Intelligence / Site Content
- Tightened artifact hygiene in `.gitignore` so generated browser-capture screenshots with hyphenated names and packaged `*.tgz` artifacts stop resurfacing in normal worktree review.
- Added explicit lane manifests for the first two active workstreams we know are still in motion:
  - `platform-app`
  - `data-collection-hardening`
- Broke `platform-app` down one level further into practical finish order:
  - Watchtower / health contract
  - Cloudflare auth / bootstrap
  - EVS / Browserstack adjacent work
- This cleanup pass is organizational rather than a capability change: the goal is to preserve active work while reducing root-level noise and giving the repo a workable finish order.

**Created / Updated:**
- `/Users/mark/Property_Analytics/.gitignore`
- `/Users/mark/Property_Analytics/docs/WORKTREE_COMPARTMENT_MAP_2026-04-16.md`
- `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_MANIFEST_2026-04-16.md`
- `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_FINISH_ORDER_2026-04-16.md`
- `/Users/mark/Property_Analytics/docs/WORKTREE_DATA_COLLECTION_MANIFEST_2026-04-16.md`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

### 2026-04-16 - Site Content Creator Milestone 3: persisted rewrite workflow
**Actions:**
- Added the first persisted editorial execution layer to Site Content Creator so rewrite work now lives on the same governed section records as the crawl, Specs mapping, and assessment.
- `admin-site-content` now:
  - creates and maintains `site_content_section_rewrites`
  - keeps section mapping ids stable across syncs so rewrites remain attached after reloads
  - seeds one rewrite record per mapping with a default rewrite brief plus governed-input snapshot
  - exposes a canonical save route for section rewrite updates and approval state
- Site Content Creator now renders a section-level rewrite workspace directly under each mapped section with:
  - draft status (`not_started`, `drafted`, `in_review`, `approved`)
  - rewrite brief
  - proposed rewrite copy
  - refinement notes
  - governed-input context from the current Specs/assessment layer
- This shifts the product from diagnosis-only into a real editorial workflow where operators can draft, review, and approve replacement section copy without leaving the section workspace.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/apps/api/test/platform/site-content-mapping.test.ts`

**Verification completed:**
- `npx tsx --test test/platform/site-content-mapping.test.ts` in `apps/api`
- `npm run typecheck` in `apps/api`
- `npm run build` in `apps/web`

### 2026-04-16 - Site Content Creator Milestone 2: persisted section assessment
**Actions:**
- Added a persisted section assessment layer on top of Specs section mappings so each mapped live section now carries a structured diagnosis before rewrite work begins.
- `admin-site-content` now computes and stores `site_content_section_assessments` with:
  - overall status (`healthy`, `watch`, `needs-attention`)
  - structural score
  - messaging score
  - property-specificity score
  - search/local value score
  - CTA score
  - harmonization score
  - machine-readable flags and human-readable summary
- Site Content Creator now surfaces those section assessments directly in the mapping workspace, which upgrades the product from a structural inventory to a structural-diagnosis workspace.
- This sets up the next milestone cleanly: rewrite drafts can now be grounded in visible assessment output instead of raw crawl content alone.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/apps/api/test/platform/site-content-mapping.test.ts`

**Verification completed:**
- `npx tsx --test test/platform/site-content-mapping.test.ts` in `apps/api`
- `npm run typecheck` in `apps/api`
- `npm run build` in `apps/web`

### 2026-04-16 - Site Content Creator Milestone 1: persisted Specs section mapping
**Actions:**
- Added the first real section-structure layer to Site Content Creator so the workspace can compare extracted live sections against expected Specs sections instead of only listing raw crawl output.
- Extended the shared property-marketing Specs model with page-type section templates, expected section roles, order, and keyword/type hints.
- `admin-site-content` now computes and persists `site_content_section_mappings` for captured pages, including `matched`, `partial`, `missing-from-live`, and `extra-on-live` states with confidence and rationale.
- Site Content Creator now renders those mappings directly in the page workspace so operators can see:
  - which Specs sections were found
  - which expected sections are missing
  - which live sections do not confidently map to the governed structure
- This establishes the structural bridge needed for the next phase: section assessment and rewrite workflow.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/platform/shared/specs-property-marketing-v1.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/apps/api/test/platform/site-content-mapping.test.ts`

**Verification completed:**
- `npx tsx --test test/platform/site-content-mapping.test.ts` in `apps/api`
- `npm run typecheck` in `apps/api`
- `npm run build` in `apps/web`

### 2026-04-16 - Site Content Creator workspace hardening and property-resolution repair
**Actions:**
- Repaired a key Site Content Creator failure mode where the page treated crawl inventory, brief inputs, and governed memory as one all-or-nothing load.
- The Site Content Creator UI now keeps the core page inventory usable even when governed memory or brief-input side lanes fail to load.
- `admin-site-content` now uses the canonical resolved property id consistently after lookup, so page reads and crawl rewrites do not depend on the raw request key matching stored `property_id` exactly.
- Intelligence Office brief-input reads now resolve pilot properties by canonical id, property name, and normalized fallback forms instead of exact-id-only.
- Governed memory property lookup now falls back to `intelligence_pilot_properties` when a pilot property is not yet present in `communities`, which prevents Site Content Creator from breaking on mixed pilot/admin data states.
- Follow-up UI hardening removed an inconsistent mixed-state failure mode in Site Content Creator:
  - property detail state now resets when selection changes or detail loads fail
  - the inventory summary card now falls back to the selected inventory property name instead of rendering a blank property tile
  - the inventory empty state now distinguishes between "no crawl exists yet" and "summary exists but detailed page rows failed to load"

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
- `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/apps/api/test/platform/intelligence-memory.test.ts`

**Verification completed:**
- `npx tsx --test test/platform/intelligence-memory.test.ts` in `apps/api`
- `npx tsx --test test/platform/intelligence-brief-readiness.test.ts` in `apps/api`

### 2026-04-13 - Cloudflare Zero Trust security architecture baseline
**Actions:**
- Added the canonical Cloudflare Zero Trust security architecture document:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- Added the concrete hostname and route classification matrix:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- Added the concrete Cloudflare build checklist:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- Added the Cloudflare Zero Trust Keeper manifest:
  - `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
- Added the Cloudflare dashboard/operator runbook:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
- Established the canonical layered model:
  - Keeper = secret authority
  - Cloudflare Zero Trust = outer trust boundary
  - app auth = business authorization and product roles
- Documented the default user split:
  - internal users via SSO
  - external users via Cloudflare Access email OTP
  - automation via service tokens
- Registered the capability in:
  - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- Updated the repo-wide narrative in:
  - `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- Captured repo-observed hardening follow-up:
  - the former Site Content debug-bypass path was a production-trust review item and is now retired
- Captured current app-layer service identity inputs for follow-up:
  - `PLATFORM_SHARED_TOKEN`
  - `EVS_SHARED_TOKEN`

### 2026-04-13 - Repo-side Zero Trust hardening implementation
**Actions:**
- Added shared service-auth resolution in:
  - `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
- Platform, VACS, and EVS service routes now accept either:
  - legacy shared bearer tokens
  - or Cloudflare-style `CF-Access-Client-Id` + `CF-Access-Client-Secret` headers
- Added new worker env bindings for route-specific Access service credentials in:
  - `/Users/mark/Property_Analytics/apps/api/src/env.ts`
- Retired the temporary Site Content debug bypass from the production auth path:
  - removed the `x-debug-site-content` bypass logic from `apps/api/src/middleware/auth.ts`
  - removed the related `DEBUG_SITE_CONTENT_BYPASS_ENABLED` worker var from `apps/api/wrangler.toml`
- Updated local platform clients and cutover/sync scripts so they can use either:
  - `PLATFORM_SHARED_TOKEN`
  - or `PLATFORM_ACCESS_CLIENT_ID` + `PLATFORM_ACCESS_CLIENT_SECRET`
- Extended those local platform scripts to resolve credentials from Keeper-backed notation as well:
  - `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
  - `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION`
  - `KSM_PLATFORM_SHARED_TOKEN_NOTATION`

### 2026-04-13 - Zero Trust runtime cutover preparation
**Actions:**
- Added the Worker/local-job secret cutover runbook:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- Added the copy-ready Worker secret helper script:
  - `/Users/mark/Property_Analytics/scripts/zero_trust_worker_secret_cutover.sh`
- Updated Phase 1 runtime docs to prefer:
  - `PLATFORM_ACCESS_CLIENT_ID`
  - `PLATFORM_ACCESS_CLIENT_SECRET`
- Existing Phase 1 docs now explicitly treat `PLATFORM_SHARED_TOKEN` as transitional fallback rather than the preferred steady-state auth model.
- Added targeted platform tests proving:
  - legacy bearer auth still works
  - Cloudflare-style service-token headers now work

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/env.ts`
- `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/platform.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
- `/Users/mark/Property_Analytics/apps/api/wrangler.toml`
- `/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh`
- `/Users/mark/Property_Analytics/apps/api/test/helpers/platform-route-env.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/platform-routes.test.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/platform-phase1-client-smoke.test.ts`

**Verification completed:**
- `bash -n /Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh`
- `python3 -m py_compile /Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py /Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
- `npx tsx --test test/platform/platform-phase1-client-smoke.test.ts` in `apps/api`
- `npx tsx --test --test-name-pattern="Cloudflare Access service-token headers|mirror through execution snapshot" test/platform/platform-routes.test.ts` in `apps/api`

**Known unrelated verification gaps observed while checking:**
- `npm run typecheck` in `apps/api` currently fails in pre-existing `admin-intelligence` / `admin-site-content` typing paths unrelated to this auth hardening work
- `npm run test:platform` has existing unrelated failures outside the touched auth/service-token scope

### 2026-04-11 - Site Content Creator: Captain's Brief surfaced in property brief inputs
**Actions:**
- Site Content Creator now pulls Captain's Log entries for the selected property and displays them as the lead brief input.
- Brief Intelligence tab now foregrounds Captain assessment alongside governed guidance so operators can see the full brief lineage.
- Crawl now requires Captain's Log entries; missing assessments block the crawl with a clear warning.
- UI language now uses "Captain's Brief" for the property-owner assessment input.

### 2026-04-12 - Intelligence Office: Captain's Brief template and completeness guidance
**Actions:**
- Added a Captain's Brief template (structured payload) and completeness guidance in the Intelligence Office Captain's Log tab.
- Operators can insert the template, see required fields, and track completion before submitting the brief.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/components/intelligence-office-page.tsx`

### 2026-04-12 - Site Content Creator: Captain's Brief composed read-model
**Actions:**
- Added a composed Captain's Brief view that assembles memory, guidance, approved claims, evidence refs, and completeness status.
- The brief is explicitly presented as a read-model derived from Captain's Log and Intelligence Office inputs.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`

### 2026-04-13 - Intelligence Office: structured claims/evidence + brief readiness
**Actions:**
- Added Intelligence Office structured claims, evidence, and claim-evidence link tables and APIs.
- Added brief readiness computation (completeness score, status, missing components, migration candidates).
- Surfaced readiness and structured claims/evidence in Site Content Creator and Intelligence Office UIs.
- Added VACS context payload for structured claims/evidence.
- Enforced strict memory/guidance/evidence separation and optional Fleet/Ledger visibility in Site Content Creator.
- Added migration hints for legacy approved points and warnings for unlinked claims in Intelligence Office.

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/api/src/platform/intelligence/brief-completeness.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/components/intelligence-office-page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/packages/shared/src/intelligence-types.ts`

### 2026-04-14 - Captain's Brief migration flow + explicit VACS platform status
**Actions:**
- Added one-click migration actions in Intelligence Office so legacy `approved_points` can be promoted into structured claim objects with `source = migration`.
- Exposed the migration action in both the claim migration workspace and the Pilot Properties readiness panel so operators can close readiness gaps directly from the property view.
- Clarified the canonical Captain's Brief readiness model in the docs: readiness depends on Captain's Log presence, summary, priorities, structured claims, linked evidence, confidence, and recency.
- Clarified VACS platform status across the canonical docs:
  - VACS is a real platform system
  - the VACS API is live and protected at `api.venterradev.com/v1/vacs/*`
  - `vacs.venterradev.com` remains the intended canonical product surface in architecture
  - the repo does not yet verify a separate deployed VACS frontend host

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/components/intelligence-office-page.tsx`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md`
- `/Users/mark/Property_Analytics/packages/shared/src/intelligence-types.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/intelligence-brief-readiness.test.ts`

**Created / Updated:**
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`

### 2026-04-09 01:10 - Cloudflare Cache Audit + Phase 1 Full-Page Cache Rollout Design
**Actions:**
- Built a daily Cloudflare cache audit collector and integrated it into `daily_master_collection.py`
- Added Cloudflare GraphQL analytics support plus zone settings snapshots
- Added JSON, CSV, Markdown, and PIB-style HTML reporting for the cache audit
- Captured the first full baseline across the 5 Resi pilot domains
- Implemented homepage-only Phase 1 Cloudflare cache-rule rollout tooling
- Dry-run rendered the full ruleset payload for all 5 pilot zones

**Created / Updated:**
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- `/Users/mark/Property_Analytics/Data_Collection/reports/cloudflare_cache_daily_report.py`
- `/Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml`
- `/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml`
- `/Users/mark/Property_Analytics/ops/cloudflare/cache_rules_manager.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md`
- `/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache/README.md`

**Baseline Findings:**
- Portfolio status mix: `0 pass, 0 warn, 5 fail`
- Average Cloudflare cache-hit ratio: `47.20%`
- Average homepage warm TTFB: `59.3 ms` desktop, `63.5 ms` mobile
- Warm HIT coverage: `0.00%`
- All tested homepage variants returned second-request `CF-Cache-Status: DYNAMIC`

**Cloudflare Findings:**
- All 5 pilot zones are on the `Free Website` plan
- No custom `http_request_cache_settings` entrypoint existed before rollout work
- Desired `1800s` edge TTL is clamped to `7200s` in the Phase 1 payload because of the plan floor
- Read token in `/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt` works for analytics + dry-run inspection, but not live writes

**Validation:**
- Dry-run export written to `/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache/20260409T010139Z`
- Cache audit artifacts written to `/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08/`
- PIB guardrails passed

**Next Steps:**
1. Confirm Kinsta Edge Caching is off for the five pilot domains
2. Obtain a write-capable Cloudflare token with `Cache Settings Write`
3. Apply homepage-only Phase 1 rules
4. Purge Cloudflare
5. Re-run the cache audit and validate homepage second-request `HIT`

### 2026-01-28 22:51 - GSC Portfolio Snapshot Report Creation
**Actions:**
- Created new GSC Portfolio Snapshot report (modeled after CWV Snapshot)
- Built comprehensive report showing 30-day GSC performance for all properties
- Ranked by organic clicks (descending)
- Includes: clicks, impressions, CTR, average position with trend indicators
- Generates both HTML and Excel outputs
- Maps GSC URLs to actual property names from registry
- Created email sender script for automated delivery

**Debugging Session:**
- Initially showed 82 properties instead of 93
- User caught the error and insisted on verification
- Found that `HAVING clicks > 0` filter was incorrectly excluding 11 properties
- Removed filter - all 93 properties now included
- Fixed property names to show "San Palmilla" instead of URLs
- Verified data freshness: GSC collected today at 21:18 PM

**Created Files:**
- `/Users/mark/Property_Analytics/generate_gsc_snapshot.py`
- `/Users/mark/Property_Analytics/send_gsc_snapshot_email.py`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/Portfolio_GSC_Snapshot_2026-01-28.html`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/Portfolio_GSC_Snapshot_2026-01-28.xlsx`

**Report Features:**
- 93 properties with 30-day GSC metrics (Dec 29 - Jan 27)
- Total: 18,574 clicks, 655,153 impressions, 2.84% CTR
- Performance bands: 16 Excellent (CTR ≥5%), 23 Good (3-5%), 54 Needs Improvement (<3%)
- Trend indicators vs. previous 30 days
- Color-coded grades and metrics
- Excel with all data, color-coded, sortable

**Verifications:**
- ✅ All 93 properties included (including Sundara with no data yet)
- ✅ GSC data fresh (collected 2026-01-28 21:18, latest metric: Jan 25)
- ✅ Property names correctly mapped from registry
- ✅ Data accuracy confirmed for top 5 properties
- ✅ Report emailed successfully with Excel attachment
- ✅ 3-day GSC lag confirmed (latest available: Jan 25)

**Key Learnings:**
- Always verify property counts match expected totals
- Test SQL queries directly when Python results seem wrong
- GSC has 3-day lag (immutable API constraint)
- HAVING clauses can behave unexpectedly - verify results
- User's instinct to question data discrepancies was correct

**Outstanding:**
- None - report complete and verified

### 2026-01-28 22:24 - Spotlight Report Automation & Critical Fix Discovery
**Actions:**
- Discovered main collection job was NOT running at scheduled 5:00 AM time
- Root cause: XML escaping errors in launchd plist (&&, >>, 2>> not escaped)
- Fixed plist with proper XML entities (&amp;&amp;, &gt;&gt;, 2&gt;&gt;)
- Validated and reloaded main collection job successfully
- Removed old Spotlight collection cron job (Wednesdays at noon)
- Created NEW Spotlight weekly report launchd job (database-based, no collection)
- Loaded com.venterra.spotlight.weekly job

**What Was Wrong:**
- The main data collection at 5:00 AM hasn't been running for days
- XML syntax errors prevented launchd from loading the job properly
- GA4 data was being collected by something else (likely manual Spotlight runs)
- This explains why data_collections table showed last run on Jan 24

**What's Fixed:**
1. Main collection plist now has proper XML escaping
2. Job loads successfully with `launchctl load`
3. Will run tomorrow at 5:00 AM for the first time in days
4. Spotlight report now automated via launchd (not cron)
5. Spotlight reads from database, doesn't collect data

**Created Files:**
- `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.weekly.plist`
- `/tmp/crontab_backup_20260128_220135.txt`
- `/tmp/scheduled_jobs_summary.txt`

**Verifications:**
- ✅ Plist validates with plutil -lint
- ✅ Main collection job loaded (launchctl list shows it)
- ✅ Spotlight weekly job loaded and scheduled
- ✅ Old cron job removed from crontab
- ✅ GA4 data IS fresh (Jan 27 collected at 21:59 today)

**Critical Insight:**
- Data collection was happening somehow (GA4 fresh to Jan 27)
- But NOT via the scheduled Data_Collection job
- Likely from manual report runs that collect data directly
- Now unified: Data_Collection at 5 AM, reports read from DB

**Outstanding:**
- Verify 5:00 AM collection runs successfully tomorrow (2026-01-29)
- Check that logs populate correctly
- Verify Spotlight report runs next Wednesday (Feb 5)
- GSC data still 4 days old - will be fresh after tomorrow's run

### 2026-01-28 21:49 - Scheduled Jobs Cleanup & Logging Fix
**Actions:**
- Removed duplicate PSI collectors (com.venterra.psi_daily, com.venterra.portfolio.psi)
- Fixed main collector logging with Python unbuffered mode (-u flag)
- Added explicit log redirection to plist (>> append mode)
- Reloaded main collector job with new configuration
- Created comprehensive scheduled jobs audit document

**Verifications:**
- ✅ Duplicate PSI collectors unloaded and disabled
- ✅ No PSI jobs showing in launchctl list
- ✅ Main collector reloaded successfully (exit code 0)
- ✅ Log file writable and accepting appends
- ✅ Python -u flag added for unbuffered output
- ✅ 7/9 jobs now showing exit code 0 (was 7/11)

**What Changed:**
1. Disabled PSI collectors: `*.plist.disabled` (no longer running)
2. Updated main collector plist with:
   - Python -u (unbuffered output)
   - Explicit log redirection (>> for append)
   - Added Python bin to PATH
3. Backed up old plist before changes

**Created Files:**
- `/Users/mark/Property_Analytics/SCHEDULED_JOBS_AUDIT.md`
- `~/Library/LaunchAgents/com.venterra.portfolio.collection.plist.backup-20260128`

**Outstanding:**
- `com.venterra.registry_validation` was later disabled intentionally as part of alert consolidation
- `com.venterra.semrush_weekly` still needed separate follow-up
- Need to verify logs populate after next scheduled run (5:00 AM)
- Orphaned "in_progress" database records (low priority)

### 2026-01-28 21:18 - Atlas Memory System Integration
**Actions:**
- Created comprehensive Atlas memory system
- Integrated with Warp (.warp/context.md)
- Added git post-checkout hook for reminders
- Created atlas_session_start.sh helper script
- Updated main README with AI assistant section
- Initialized git repository
- Created first commit with memory system

**Created Files:**
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md` (master memory)
- `/Users/mark/Property_Analytics/.warp/context.md` (Warp integration)
- `/Users/mark/Property_Analytics/.git/hooks/post-checkout` (git hook)
- `/Users/mark/Property_Analytics/atlas_session_start.sh` (helper script)
- Updated `README.md` with AI section at top

**How It Works:**
1. Warp shows context file pointing to ATLAS_WORKING_MEMORY.md
2. Git checkout triggers reminder to read memory
3. Helper script provides quick health check
4. README has prominent AI section
5. Atlas updates session log after every action

**Verifications:**
- ✅ atlas_session_start.sh works correctly
- ✅ Shows database size (176M), latest data (2026-01-27)
- ✅ Detects critical issues in memory file
- ✅ Git repository initialized with first commit
- ✅ All files tracked and committed

**Outstanding:**
- None - integration complete

### 2026-01-28 21:06 - Data Collection Debug (with Mark)
**Actions:**
- Mark debugged Data_Collection system in parallel session
- GA4 collection now working for 76 properties (was 4-14)
- GSC still unstable but improved from 0 properties
- Verified all systems using master database

**Verifications:**
- ✅ Data_Collection writes to master DB
- ✅ DatabaseManager correctly resolves path
- ✅ Fresh data visible in ga4_daily_metrics
- ✅ Freshness test correctly identifies issues (103 down from 179)

**Outstanding:**
- GSC collection needs stabilization
- 15 GA4 properties not collecting
- Multiple scheduled jobs showing exit code 1

### 2026-01-28 20:55 - System Unification Verification
**Actions:**
- Created comprehensive verification document
- Audited all 119 references to master database
- Confirmed unified architecture across all components
- Documented system boundaries and integration points

**Created Files:**
- `/Users/mark/Property_Analytics/SYSTEM_UNIFICATION_VERIFICATION.md`

**Key Findings:**
- System 95% unified
- All major components using master DB
- Only critical issue is data collection stability

### 2026-01-28 20:38 - Data Freshness Test
**Actions:**
- Ran initial data freshness test
- Identified 179 issues (later reduced to 103)
- Discovered collection system issues

**Key Findings:**
- Database was 4 days stale (last full collection Jan 24)
- Portfolio_Monitoring collector broken
- Data_Collection system not completing runs

---

## 🎯 IMPORTANT PATTERNS TO REMEMBER

### 1. Always Check Master DB First
```bash
# Verify database exists
ls -lh /Users/mark/Property_Analytics/data/portfolio_analytics.db

# Check latest data
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT MAX(metric_date), COUNT(DISTINCT property_id) FROM ga4_daily_metrics"
```

### 2. Use Data_Collection DatabaseManager
```python
# CORRECT (use this)
from Data_Collection.db.database_manager import DatabaseManager

# WRONG (legacy, deprecated)
from Portfolio_Monitoring.src.db.database_manager import DatabaseManager
```

### 3. Read Documentation Before Changing
- Check `ATLAS_WORKING_MEMORY.md` (this file)
- Check relevant README in component directory
- Check phase completion docs for context
- Check `SYSTEM_UNIFICATION_VERIFICATION.md` for architecture

### 4. Update This File After Every Action
```markdown
### YYYY-MM-DD HH:MM - Brief Title
**Actions:** What did you do
**Verifications:** What did you confirm works
**Outstanding:** What's still broken
**Created Files:** Any new documentation
```

### 5. Test Before Assuming
- Don't trust exit codes alone (launchd shows 0 even when nothing runs)
- Check database for actual data
- Check logs for errors
- Run freshness test to verify

---

## 📚 KEY DOCUMENTATION

### Must-Read for Every Session
1. This file (`ATLAS_WORKING_MEMORY.md`)
2. `docs/CAPABILITY_REGISTER_2026-04-10.md` - Current capability ownership and disposition
3. `docs/FULL_SYSTEM_AUDIT_2026-04-10.md` - Repo-wide system inventory and overlaps
4. `SYSTEM_UNIFICATION_VERIFICATION.md` - Architecture verification
5. `README.md` - System overview

### Component-Specific
- **Data Collection:** `Data_Collection/README.md`, `DATA_COLLECTION_README.md`
- **PIB:** `Property_Intelligence_Brief/docs/PIB_V1_9_STYLING_LOCKED.md`
- **Portfolio Pulse:** `Portfolio_Monitoring/docs/PORTFOLIO_PULSE_CONTRACT.md`
- **Database:** `data/README.md`, `docs/DATABASE_SCHEMA_REFERENCE.md`

### Phase Documentation
- `Portfolio_Monitoring/PHASE_1_COMPLETE.md` - Collection monitoring
- `Portfolio_Monitoring/PHASE_2_COMPLETE.md` - Quality validation
- `Portfolio_Monitoring/PHASE_3_COMPLETE.md` - Cross-source correlation
- `Portfolio_Monitoring/PHASE_4_COMPLETE.md` - Anomaly detection

### System Architecture
- `SYSTEM_ARCHITECTURE_MEMORY.md` - Detailed architecture
- `CAPABILITIES_INVENTORY_2026-01-23.md` - Complete capabilities list
- `memory/PROJECT_STATE.md` - Production status tracking

---

## 🔧 COMMON COMMANDS

### Check System Health
```bash
# Data freshness test
cd /Users/mark/Property_Analytics/Portfolio_Monitoring
python3 send_data_alerts.py --test

# Check scheduled jobs
launchctl list | grep venterra

# Check latest collection
sqlite3 /Users/mark/Property_Analytics/data/portfolio_analytics.db \
  "SELECT metric_date, COUNT(*) FROM ga4_daily_metrics GROUP BY metric_date ORDER BY metric_date DESC LIMIT 7"
```

### Run Collections Manually
```bash
# Test mode (3 properties)
cd /Users/mark/Property_Analytics
python3 Data_Collection/orchestration/daily_master_collection.py --test

# Quick mode (GA4 + GSC only)
python3 Data_Collection/orchestration/daily_master_collection.py --quick

# Full collection
python3 Data_Collection/orchestration/daily_master_collection.py
```

### Check Logs
```bash
# New collection system
tail -100 /Users/mark/Property_Analytics/Data_Collection/logs/collection_stdout.log

# Legacy system
tail -100 /Users/mark/Property_Analytics/Portfolio_Monitoring/logs/collection_stdout.log

# PSI collection
tail -100 /Users/mark/Property_Analytics/logs/psi_daily_collection.log
```

---

## 🧠 ATLAS OPERATIONAL NOTES

### When Starting a New Session
1. ✅ Read this file completely
2. ✅ Read the capability register
3. ✅ Read the full system audit
4. ✅ Check "Current System State" section
5. ✅ Review "Session Log" for recent changes
6. ✅ Run data freshness test if needed
7. ✅ Don't assume anything - verify first

### When Making Changes
1. ✅ Read relevant documentation first
2. ✅ Understand what's currently working
3. ✅ Test changes in isolation
4. ✅ Verify with database queries
5. ✅ Update this file immediately after
6. ✅ Update the capability register when capability scope, ownership, status, or disposition changes
7. ✅ Update the full system audit when the system narrative or platform map materially changes
8. ✅ Run `bash scripts/check_context_discipline.sh`

### When Debugging Issues
1. ✅ Check "Critical Issues" section first
2. ✅ Review recent session log entries
3. ✅ Check database for actual state
4. ✅ Check logs for errors
5. ✅ Don't make assumptions about "operational" systems

### Red Flags (Stop and Ask)
- ❌ No data in database for recent dates
- ❌ Logs are empty when job shows exit 0
- ❌ Multiple scheduled jobs failing
- ❌ Import errors in Python scripts
- ❌ Can't find expected files/tables

### Success Patterns
- ✅ Fresh data in database tables
- ✅ Scheduled jobs with substantive logs
- ✅ Freshness test shows <10 issues
- ✅ All major reports generating successfully
- ✅ Clear documentation of what changed

---

## 🎯 PROJECT SCOPE & SCALE

**System Type:** Production-grade portfolio analytics platform  
**Organization:** Venterra Living (multifamily real estate)  
**Properties:** 91 active properties across multiple states  
**Data Volume:** ~500MB daily processing  
**Database Size:** 161 MB (growing)  
**API Calls:** ~2,000/day across 6 external services

**Key Stakeholders:**
- Mark Laufhutte (WebOps, System Owner)
- Marketing team (report consumers)
- SEO team (report consumers)
- Property managers (PIB recipients)

**Critical SLAs:**
- Daily data must be <24 hours stale
- Reports must generate by 9:00 AM
- Alerts sent within 30 min of collection failure
- Database must be accessible 24/7

---

## 🚀 NEXT PRIORITIES

### Immediate (This Week)
1. **Stabilize GSC collection** - Get all 90+ properties collecting
2. **Fix 15 missing GA4 properties** - Investigate why they're not collecting
3. **Investigate failed scheduled jobs** - Fix exit code 1 jobs
4. **Verify scheduled collection runs** - Confirm 5:00 AM job actually executes

### Short Term (Next 2 Weeks)
1. **Deprecate Portfolio_Monitoring collectors** - Document as legacy
2. **Clean up duplicate code** - Remove conflicting modules
3. **Add integration tests** - Verify end-to-end data flow
4. **Document Data_Collection as primary** - Update all READMEs

### Long Term (This Month)
1. **Implement collection retry logic** - Auto-recover from failures
2. **Add real-time monitoring** - Dashboard for collection status
3. **Automate property onboarding** - Self-service property addition
4. **Optimize API usage** - Reduce quota consumption

---

## 📞 CONTACT & SUPPORT

**System Owner:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com  
**Location:** Local development environment (macOS)  
**Repository:** Local Git only (contains credentials, not remote)

**Atlas AI:**
- Read this file at start of every session
- Update after every significant action
- Ask Mark when documentation is unclear
- Never assume - always verify first

---

**END OF ATLAS WORKING MEMORY**

**Remember:** This is YOUR memory. Keep it current. Use it religiously. It's the difference between being helpful and being lost.

---

## Session: January 29, 2026 - ThirtyLines Integration & Competitor Analysis

**Duration:** ~2 hours  
**Status:** Phase 1 Complete - Awaiting Competitor Excel Sheet  
**Session Memory:** `SESSION_MEMORY_THIRTYLINES_COMPETITOR_ANALYSIS_2026-01-29.md`

### Major Accomplishments

#### 1. ThirtyLines Unit Availability Collector - PRODUCTION READY
- **Built:** Complete data collector for unit availability across all properties
- **Database:** 4 new tables + 1 view for floorplan and availability tracking
- **Coverage:** 91/91 properties successfully mapped and collecting
- **Data:** 933 floorplans, 1,607 units available, 2,547 individual units tracked
- **Location:** `Data_Collection/collectors/thirtylines_collector.py`

**Key Achievement:** Full property mapping using fuzzy matching + manual fixes. All 91 ThirtyLines properties mapped to GA4 property IDs in `property_metadata` table.

#### 2. SEMRush Competitor Analysis - TESTED & VALIDATED
- **Built:** Standalone competitor analyzer with intelligent filtering
- **API:** Validated SEMRush `domain_organic_organic` endpoint works
- **Filtering:** Smart logic excludes Venterra domains, service providers, aggregators
- **Test Results:** Successfully identified real apartment competitors
- **Location:** `Data_Collection/collectors/test_competitor_analysis.py`

**Key Finding:** SEMRush cannot analyze competitors at URL/subfolder level. Requires manual competitor mapping for venterraliving.com subfolder properties (70+ properties).

#### 3. Documentation Created
- Executive summary (MD + DOCX)
- SMTP access request for IT (MD + DOCX)
- Comprehensive session memory document
- Updated Atlas working memory

### Technical Details

**Database Schema Added:**
```
property_floorplans (10 cols) - Floorplan specs
unit_availability (9 cols) - Daily snapshots
available_units (16 cols) - Individual unit tracking
floorplan_pricing_history (7 cols) - Price trends
v_latest_availability - View for current data
```

**Property Mapping:**
- Master table: `property_metadata` (91 properties)
- Added column: `thirtylines_id` for feed mapping
- Mapping method: Exact match (76) + fuzzy match (14) + manual fixes (CoHo, The Parker)

**SEMRush Competitor Analysis:**
- Independent domains: ✅ Can get property-specific competitors
- Subfolder properties: ❌ Only domain-level competitors (not useful)
- Solution: Manual Excel sheet with competitor mappings

**Filtering Logic:**
- Excludes: nicolawealth.com, venterra.com, venterraliving.com (Venterra-owned)
- Excludes: Service keywords (promove, integrity, management, realty)
- Excludes: Aggregators (apartments.com, zillow.com, etc.)
- Excludes: Mega-sites (>500K traffic)
- Includes: Apartment-related domains with 1K-100K traffic

**Test Results:**
- venterraliving.com: 19 valid competitors (top: advenirliving.com with 35K traffic)
- monteverdesatx.com: 15 valid competitors (top: monteverdeapts.net)

### Decisions Made

1. **Use `property_metadata` as master table** - Not the old 15-row `properties` table
2. **Manual competitor mapping required** - SEMRush can't do URL-level analysis
3. **Standalone testing first** - Validate before integrating into daily collection
4. **Smart filtering essential** - Too many false positives without it

### Next Steps (Blocked)

**Immediate - Awaiting Data:**
- User locating Excel sheet with competitor mappings
- Need to understand structure/format before building importer

**Phase 2 - After Excel Sheet:**
1. Import competitor mappings to database
2. Build competitor metrics collector (SEMRush)
3. Add competitive intelligence to PIB report

**Phase 3 - Integration:**
1. Integrate ThirtyLines into daily 5 AM collection
2. Add availability section to PIB
3. Add leasing velocity metrics

### Files Created

- `Data_Collection/collectors/thirtylines_collector.py` - Production collector
- `Data_Collection/collectors/test_competitor_analysis.py` - Standalone test script
- `EXECUTIVE_SUMMARY.md` + `.docx` - Platform overview
- `SMTP_Access_Request.md` + `.docx` - IT documentation
- `SESSION_MEMORY_THIRTYLINES_COMPETITOR_ANALYSIS_2026-01-29.md` - Full session details

### Key Context for Future

**The Goal:** Enhance PIB with unit availability + competitive intelligence

**Current State:**
- ThirtyLines: READY (fully operational, not yet scheduled)
- Competitor analysis: READY (tested, awaiting manual mappings)
- PIB integration: PENDING

**Important Notes:**
- Most properties (70+) are venterraliving.com subfolders - need manual competitor maps
- CoHo is Venterra property, not "CoHo Apartments"
- ThirtyLines feed has 91 properties vs 93 in registry (2 missing from feed)

**Blocker:** Waiting for user to locate competitor Excel sheet

---

## Session: January 31, 2026 - PIB v1.9.0 LOCKED OFFICIAL

**Duration:** ~2 hours  
**Status:** Complete - v1.9.0 Locked as Official Standard  
**Commit:** `5498769`

### Major Accomplishments

#### 1. Unit Type Classified KPI - REPLACED LOCAL DISCOVERY
- **Change:** Replaced Local Discovery KPI with Unit Type Classified
- **Purpose:** Shows percentage of Google Ads spend that is unit-classified
- **Display:** Large percentage with color-coded status (Critical/Poor/Fair/Good/Excellent)
- **Details:** Shows spend breakdown and number of unit types targeted
- **Thresholds:**
  - 🔴 Critical (<20%) - Red
  - 🟠 Poor (20-40%) - Orange
  - 🟡 Fair (40-60%) - Yellow
  - 🟢 Good (60-80%) - Light Green
  - 🟢 Excellent (≥80%) - Dark Green

**Impact:** Makes unit classification issues immediately visible to stakeholders

#### 2. Confidence & Data Integrity - ENHANCED WITH GRADIENTS
- **Added:** Creative emoji and gradient styling to all 4 subsections
- **Data Source Coverage:** Purple gradient (#667eea → #764ba2) with 📈 emoji
- **Data Freshness:** Teal-green gradient (#11998e → #38ef7d) with 🕐 emoji
- **Methodology & Limitations:** Pink-red gradient (#f093fb → #f5576c) with ⚠️ emoji
- **Data Quality Confidence:** Blue gradient (#4facfe → #00f2fe) with ✅ emoji
- **All collectors added:** GA4, GSC, CIR, PageSpeed, Google Ads, GBP Insights, Review Sentiment

**Impact:** Section now visually impressive with professional gradients and emojis

#### 3. Data Freshness Table - ALL 7 COLLECTORS
- **Added collectors:** PageSpeed, Google Ads, GBP Insights, Review Sentiment
- **Display:** Each with emoji, timestamp/date, and lag indicator
- **Format:** Clean table with color-coded lag status (green ✓, yellow ⚠️)
- **Coverage:** Complete transparency on all data source freshness

#### 4. Device Breakdown - FIXED CALCULATION
- **Issue:** Was showing 0.0% for all device types (Desktop/Mobile/Tablet)
- **Root Cause:** Template looking for non-existent `device_*_pct` fields
- **Solution:** Calculate percentages from `desktop_events`, `mobile_events`, `tablet_events`
- **Location:** Technical Appendix

**Impact:** Device breakdown now shows correct distribution

### Technical Details

**Files Modified:**
- `templates/executive_email_template.py` (Lines 106-220, 1300-1489)
- `docs/PIB_V1_9_STYLING_LOCKED.md` (Updated with all v1.9.0 features)

**Code Changes:**
1. Replaced `gbp_insights` reference with `google_ads` in KPI tile generation
2. Added 5-tier color-coded classification thresholds
3. Added gradient backgrounds to Confidence section (4 subsections)
4. Added emoji-specific data source indicators throughout
5. Added device percentage calculation logic (lines 1310-1324)
6. Extended Data Freshness table from 3 to 7 collectors

**Data Fields Used:**
- `google_ads.classified_pct` - Percentage classified
- `google_ads.classified_spend` - Dollar amount classified
- `google_ads.total_spend` - Total ad spend
- `google_ads.unit_type_breakdown` - Array of unit types
- `pagespeed.test_date` - PageSpeed test date
- `google_ads.window_end` - Ads data end date
- `gbp_insights.window_end` - GBP data end date

### Decisions Made

1. **Unit Type Classified > Local Discovery** - More actionable metric for paid media optimization
2. **5-tier color scheme** - Provides clear visual signal of classification health
3. **All 7 collectors in freshness** - Complete transparency, no data source hidden
4. **Gradient styling for Confidence** - Makes technical section visually appealing
5. **Device calc in template** - Avoids data pipeline changes, pure presentation fix

### Version Control

**Commit:** `5498769`
**Message:** "PIB v1.9.0 LOCKED: Unit Type Classified KPI, enhanced Confidence section, device breakdown fix"
**Branch:** main
**Co-Author:** Warp <agent@warp.dev>

### Documentation Updated

✅ `docs/PIB_V1_9_STYLING_LOCKED.md` - Complete v1.9.0 reference
✅ `ATLAS_WORKING_MEMORY.md` - This entry
✅ Git commit with detailed message

### Status

**PIB v1.9.0:** 🔒 LOCKED OFFICIAL STANDARD  
**Template:** `templates/executive_email_template.py`  
**Generator:** `generate_property_intelligence_brief.py`  
**Last Verified:** 2026-01-31 01:16 UTC

**Critical Rules:**
- NO changes to KPI tiles without approval
- NO changes to Confidence section gradients/emojis
- NO changes to section headers (no status pills)
- NO changes to Search Performance (full-width)
- NO changes to PageSpeed (side-by-side with colored emojis)

**Next PIB Work:** v2.0 development (separate template file)

---

## Session: February 24-25, 2026 - The Data Pond: Admin Auth, Email Delivery & Sidebar Redesign

**Duration:** ~4 hours
**Status:** Complete — Magic link auth working, sidebar redesigned
**Agent:** Oz (Warp)
**Commits:** `9002de4`, `e8b16ec`, `5e9d815`, `58cbeab`

### Context

The Data Pond is a resort-themed analytics dashboard deployed on Cloudflare:
- **API Worker:** `api.venterradev.com` (Hono on Cloudflare Workers)
- **Frontend:** `app.venterradev.com` (Next.js on Cloudflare Pages, project `property-analytics`)
- **Database:** D1 `pop-brief-db` (ID: `dad3e7d1-147b-438d-8cd0-2cbf537a87b2`)
- **Git Remote:** `origin` → `git@github.com:markartist/property-analytics.git`

### Major Accomplishments

#### 1. Data Freshness Fix (commit `9002de4`)
- Replaced D1 Friday-snapshot-based freshness display with actual source collection dates from canonical DB
- Created `data_freshness` table (migration 0017)
- Updated sync script, health endpoint, pond insights endpoint
- All 10 sources now show real dates (GA4, GSC, Google Ads, PageSpeed, SEMRush, GBP Reviews, etc.)

#### 2. Admin Section with Magic Link Auth (commit `e8b16ec`)
- **Migration 0018:** `magic_tokens` table, recreated `users`/`invites`/`sessions`/`audit_log` with expanded roles (`admin`/`editor`/`viewer`), nullable `password_hash`
- **D1 FK constraint lesson:** Must recreate child tables WITHOUT FK references before dropping/recreating parent tables; `PRAGMA defer_foreign_keys = ON` doesn't work in D1
- **API endpoints added:** `POST /auth/magic-link`, `GET /auth/verify`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/send-magic-link`, `DELETE /users/:id/sessions`, `GET /audit-log`
- **Frontend:** Admin console page with Users + Audit Log tabs, role-based sidebar filtering using `ROLE_LEVEL` hierarchy
- **Rate limiting:** `magicLinkLimiter` (3 per 15min per email)

#### 3. Login Page Redesign (commit `5e9d815`)
- Full pond-themed overhaul: gradient background (navy→teal→green), pond-scene.svg, animated ripple circles, glassmorphism card with backdrop-blur
- **Tailwind v4 fix:** `text-primary-foreground` CSS variable doesn't render in production; all buttons use explicit `text-white` with native `<button>` elements

#### 4. Resend Email Integration & Domain Verification
- Verified `app.venterradev.com` AND `venterradev.com` in Resend (DKIM + SPF green)
- Set `EMAIL_FROM` secret to `noreply@venterradev.com` (root domain for better deliverability)
- Set `RESEND_API_KEY` secret on Worker
- Added error logging to all `sendEmail()` calls in `auth.ts` and `admin.ts`
- **Tested:** Gmail delivery works. Corporate `venterraliving.com` blocks — needs IT whitelist or switch to AWS SES HTTP API
- Resend account email: `marklaufhutte@gmail.com`

#### 5. Sidebar Gradient (commit `58cbeab`)
- Navy→teal→green gradient background matching pond theme
- All text switched to white with opacity levels for hierarchy
- Active state: `bg-white/15`, hover: `bg-white/10`
- Borders: `border-white/15`

### Key Technical Details

**User in D1:** id `bac3e169226046bf8ec9`, email `mlaufhutte@venterraliving.com`, role `admin`

**Git remotes:**
- `origin` → `git@github.com:markartist/property-analytics.git` (correct — triggers Cloudflare Pages)

**Cloudflare deployment:**
- API: `npx wrangler deploy --config apps/api/wrangler.toml`
- Frontend: `git push origin main` triggers Cloudflare Pages build (project `property-analytics`, NOT `pop-brief-web`)

**AWS SES credentials (in email_config.json):**
- SMTP username (= Access Key ID): `AKIAYJAGT54HEDH7GXFV`
- SMTP password is derived, NOT the raw IAM Secret Access Key
- Cannot use for SES HTTP API without the actual IAM secret key
- Region: us-east-2

### Outstanding / Next Steps

1. **Corporate email delivery:** `venterraliving.com` blocks emails from `venterradev.com`. Options:
   - Whitelist `venterradev.com` in corporate mail admin
   - Switch to AWS SES HTTP API (needs IAM Secret Access Key, not just SMTP password)
   - Keep using Gmail for login
2. **ENABLE_EMAIL_SEND** is set to `"true"` in `wrangler.toml` and deployed
3. **Future:** Build out remaining admin features, add more reporting pages

---

## Session: April 10, 2026 - D1 Mirror and Collection Governance Integrity Repair

**Status:** In progress  
**Primary areas:** `/Users/mark/Property_Analytics/Data_Collection/`, `/Users/mark/Property_Analytics/apps/api/scripts/`

### What changed

- Added a shared Wrangler runtime/auth helper:
  - `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`
- Updated D1 sync scripts to resolve Cloudflare auth through Keeper-backed token lookup before falling back to local Wrangler login state:
  - `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/guest_cards_to_d1.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/pib_data_to_d1.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/marketing_data_to_d1.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/gsc_daily_to_d1.py`
- Hardened the canonical collector so support-script hooks no longer silently point at missing files:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- Added D1 mirror failure detection into the collection alert path:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`

### Why it matters

- The D1 mirror had been failing at Wrangler auth since 2026-03-31 because the non-interactive runtime was trying to refresh an expired local OAuth token.
- The new helper successfully gets the mirror past `wrangler_access` using the existing Keeper-backed Cloudflare token (`KSM_CLOUDFLARE_TOKEN_NOTATION`).
- Data integrity alerts now include `D1_MIRROR` as a first-class failure source instead of only surfacing mirror failure inside the morning report.
- The canonical collector now falls back to the legacy registry validator when the canonical validator script is missing, making the broken ownership split explicit instead of silent.

### Current known blocker after repair

- D1 auth is now working in dry-run mirror verification.
- The next failing gate is no longer auth; it is stale guest-card-derived Friday sync coverage:
  - `t7_metrics` / `t30_metrics` in D1 verify only through `2026-03-06`
  - local guest card source data still tops out at `2026-04-02`
- This means the mirror pipeline has moved from “auth broken” to “source freshness / sync coverage broken,” which is the correct next problem to solve.

### Verification performed

- `python3 -m py_compile` on all touched scripts passed
- `python3 apps/api/scripts/d1_mirror_sync.py --dry-run`
  - `wrangler_access` now passes
  - downstream sync scripts run
  - mirror now fails later at D1 freshness verification for `t7_metrics` / `t30_metrics`
- `python3 Data_Collection/monitoring/alert_sender.py --test`
  - now reports `D1_MIRROR` as a collection failure source

### Operational note

- This repair did not touch locked PIB generation/rendering files.

---

## Session: April 8-9, 2026 - Pilot Site Evidence, Harmonization, and Daily Evaluation

**Status:** Complete  
**Reference:** `/Users/mark/Property_Analytics/SESSION_MEMORY_2026-04-08_PILOT_SITE_EVIDENCE_AND_HARMONIZATION.md`

### What changed

- Repointed the 5 pilot properties to their live branded URLs and live `sc-domain:` GSC properties
- Promoted a shared live-site page contract (`known_page_paths`) into the registry and EVS config
- Updated site audit and GSC inspection targeting to use that shared contract instead of legacy fallback pages
- Built a daily pilot evaluation report and wired it into the pilot morning workflow
- Built a new daily Pond-backed homepage evidence collector using headless Chrome/CDP
- Proved that the LCP element on all 5 pilot homepages is the shared YOOtheme/UIkit hero background `DIV`
- Enriched the evidence rows with screenshots, headers, request counts, failed requests, blocking-resource summary, console errors, and BrowserStack classifications
- Generated and emailed a PIB-style pilot performance evidence brief without touching the locked PIB files

### Why it matters

- Pilot monitoring is now centered on the real live sites instead of the old `venterraliving.com/apartments/...` properties
- The Pond now stores daily, defensible browser evidence for homepage performance, not just summary scores
- The strongest proven performance conclusion is now consistent across the cohort:
  the shared homepage hero delivery pattern is the primary homepage performance bottleneck

### Operational artifacts

- Daily homepage evidence:
  - `pilot_control_cwv/reports/homepage_audit_evidence/pilot_homepage_audit_evidence_<date>.json`
- Daily evaluation:
  - `pilot_roundup/reports/daily_evaluation/pilot_daily_evaluation_<date>.json`
  - `pilot_roundup/reports/daily_evaluation/pilot_daily_evaluation_<date>.html`
- PIB-style pilot evidence brief:
  - `pilot_roundup/reports/pilot_performance_brief/Pilot_Performance_Evidence_Brief_2026-04-08.html`

### Guardrails

- No locked PIB files were modified
- `bash scripts/check_pib_guardrails.sh` passed

---

## Session: April 8, 2026 - Spotlight April Monthly Config Activation

**Status:** Complete  
**Primary area:** `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`

### What changed

- Ingested the April Spotlight property list from:
  - `/Users/mark/Downloads/April_Spotlight_Properties.txt`
- Ingested the approved import-system names from:
  - `/Users/mark/Downloads/community_names_for_import (1).csv`
- Created the durable April source list:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/April_2026_Spotlight_Properties.txt`
- Created the April monthly run config:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`
- Created the April import-name matrix:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_import_names_2026-04.csv`

### Spotlight resolution hardening added

- Removed the hardcoded March import-name default from:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_registry.py`
- Added Spotlight-safe alias handling in:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/src/utils/property_registry.py`
- Short monthly-list names now resolve without renaming canonical properties:
  - `Pointe` → `Pointe at Bentonville`
  - `Clearwater` → `Clearwater Heights`
- Added Spotlight fallback metadata for:
  - `Forest View`
  - `Phoenix`

### Outcome

- April report ran successfully with 23 active properties
- Successful output:
  - `/Users/mark/Downloads/Spotlight_Properties_20260408_133019.csv`
- Export names are now driven by the April repo config instead of relying on `~/Downloads`

### Important operating rule

- For future months, Atlas should treat this as the standard Spotlight pattern:
  1. Save the stakeholder list into `config/Month_YYYY_Spotlight_Properties.txt`
  2. Create `config/monthly_spotlight_properties_YYYY-MM.json`
  3. Create `config/monthly_import_names_YYYY-MM.csv`
  4. Run the report against the monthly JSON config
- Do not rename canonical properties just to satisfy import naming
- Use the monthly import-name matrix to control export names

---

## Session: April 10, 2026 - Guest Card Recovery and D1 Mirror Catch-Up

**Status:** Complete  
**Primary areas:** `/Users/mark/Property_Analytics/Data_Collection/`, `/Users/mark/Property_Analytics/apps/api/scripts/`

### What changed

- Verified the canonical guest card source folder after archived CSVs were restored:
  - `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports`
- Ran the canonical guest card ingest via:
  - `Data_Collection.collectors.guest_card_collector.GuestCardCollector.ingest_pending_files()`
- Imported 19 pending guest card CSVs with:
  - 19 files processed
  - 0 files failed
  - 1,731 rows upserted
- Advanced local guest card freshness from `2026-04-02` to `2026-04-10`
- Ran the real D1 mirror sync after the guest card catch-up:
  - `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
- Produced a successful mirror report:
  - `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260410_174713.json`

### Outcome

- Local guest card data is no longer stale
- The restored guest card files were archived back out of the source drop after ingest
- D1 mirror verification now passes end to end
- Mirror target Friday resolved to `2026-04-03`, and D1 freshness checks passed for:
  - `t7_metrics`
  - `t30_metrics`
  - `marketing_data`
  - `pib_ga4_metrics`

### Operating takeaway

- The guest card collector was healthy; the immediate issue was that the needed April CSVs were absent from the live source directory until they were restored
- Dry-run validation alone will continue to report stale D1 until the real mirror sync is executed
- Current recovery sequence for this incident:
  1. Restore missing guest card CSVs to the live OneDrive drop
  2. Run canonical guest card ingest
  3. Run the real D1 mirror sync
  4. Confirm the latest generated D1 mirror report is green

### Governance hardening added after recovery

- The alert/governance path at:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  can now attempt safe auto-remediation before sending its email summary
- New behavior:
  - if pending guest card CSVs exist in the live OneDrive drop **and** local guest card data is stale, it runs canonical guest card ingest
  - if guest card backlog was ingested or the latest D1 mirror report is failed, it runs the real D1 mirror sync
  - it then re-checks collection failures and freshness before generating the alert email
- This keeps the canonical monitoring path from remaining email-only for the common “restored guest card backlog + stale D1” failure mode

### GTMetrix pilot credit-conservation hardening

- The pilot GTMetrix workflow no longer needs to rerun the full 10-property cohort after partial misses
- Updated paths:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_control_gtmetrix.py`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/validate_pilot_control_gtmetrix.py`
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- New behavior:
  - the validator can emit machine-readable JSON with exact missing `property_id`s for a target date
  - the collector can run a targeted subset using `--property-ids`
  - the morning workflow now starts with a full cohort pass, then retries only the missing properties on later attempts
  - the morning workflow now uses `1` GTMetrix run per property and `0` automatic full-property retries by default
- Added daily credit ledger:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/gtmetrix_credit_guard.py`
  - state files live under:
    `/Users/mark/Property_Analytics/pilot_control_cwv/reports/gtmetrix_credit_guard/`
- Credit policy now enforced in the morning workflow:
  - daily budget = `50`
  - reserved credits = `10`
  - spendable working budget = `40`
  - each attempt is preflight-checked before the collector runs
  - each attempt records estimated spend after execution
  - the workflow sends a failure alert and stops before consuming the reserve
- GTMetrix error classification now differentiates:
  - `rate_limited` → do not retry same day; pause the queue
  - `credits_exhausted` → do not retry same day; stop to protect remaining budget
  - `timeout` / `connection` → retryable on the next targeted attempt
- The collector now emits queue-stop markers for same-day no-retry conditions and returns distinct exit codes so the morning workflow can stop retrying intelligently
- GTMetrix rate-limit telemetry is now persisted from live response headers when present:
  - source capture: `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py`
  - persisted snapshots: `/Users/mark/Property_Analytics/pilot_control_cwv/reports/gtmetrix_credit_guard/gtmetrix_rate_limit_<date>.jsonl`
- Captured fields include:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After`
  - response stage / status / URL
- Operational effect:
  - successful same-day results are preserved between attempts
  - partial GTMetrix misses no longer force re-spending credits on already-complete properties
  - the default morning retry shape now fits inside the 50-credit/day constraint much more safely for the 10-property cohort

### GA4 and Google Ads partial-recovery hardening

- The canonical daily collector at:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
  now retries only transiently failed GA4 properties instead of leaving all initial misses as final failures
- GA4 retry policy added:
  - classify common transient API/network failures such as `503`, `504`, broken pipe, connection reset, and timeout
  - preserve first-pass successes
  - retry only the transient miss set once after a short backoff
  - keep non-transient failures as failures without re-running the full GA4 set
- The legacy Google Ads collector at:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_google_ads_data.py`
  now supports targeted subset collection through `property_names`
- The canonical orchestrator now uses that subset support to:
  - collect Google Ads once for the full mapped set
  - retry only the failed property names once
  - preserve successful same-day properties between attempts
- This moves both GA4 and Google Ads closer to the same partial-success operating model already added to GTMetrix

### Alerting and operator-visibility cleanup

- The monitoring layer at:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  now resolves GSC property identity more accurately for mixed `sc-domain:*` and live URL cases
- Important fix:
  - pilot and other properties whose registry `gsc_url` is `sc-domain:*` but whose collected rows appear under `https://venterraliving.com/apartments/...`
    now map back to the correct property name using registry `full_url`, `domain`, and `url_slug`
- Example result:
  - GSC issues that previously appeared as repeated `venterraliving.com`
    now resolve to `Calais Midtown`, `Champions Green`, `The District Universal Boulevard`, `The Harrison`, and `Ventana`
- Collection failures are now tiered into:
  - `core`
  - `specialty`
- The console/email failure summaries now distinguish core pipeline breakage from specialty/sidecar failures such as GTMetrix and homepage audit evidence

### Watchtower integrity panel

- The Watchtower API/web surface now exposes a compact integrity summary for operators:
  - API: `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
  - types: `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - UI: `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- New Watchtower summary includes:
  - core failure source count
  - specialty failure source count
  - freshness warning source count
  - freshness stale source count
  - top issues list combining core collection failures and stale/missing source freshness
- This gives the web surface the same higher-signal operational picture now available in the alerting layer, without forcing operators to parse email or logs first

### Manual-morning freshness policy

- Added shared manual-feed freshness policy at:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- Current manual-morning source set includes:
  - guest cards / gift cards
  - BI / measurement-dashboard style manual feeds when those source keys are present
- Policy behavior:
  - before 8:00 AM America/Chicago on weekdays, expected latest date is the previous business day
  - on weekends, expected latest date is the previous business day
  - after 8:00 AM on weekdays, expected latest date advances to the current day for those manual feeds
- Canonical collector stale checks now use that policy for guest cards instead of a blunt calendar-age rule:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- Alert auto-remediation now uses the same policy before deciding guest-card backlog is truly stale:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- Morning Full report now uses expectation-aware freshness for guest cards:
  - `/Users/mark/Property_Analytics/generate_morning_full_report.py`
- Watchtower now mirrors the same expectation logic in D1-backed health responses and UI badges:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- Result:
  - manual human-delivered morning feeds no longer show up as falsely stale just because they have not landed yet at 5–7 AM or on weekends

### Summary email consolidation

- The canonical daily summary email is now the Morning Full Portfolio Report:
  - `/Users/mark/Property_Analytics/run_daily_health_report.sh`
  - `/Users/mark/Property_Analytics/send_morning_full_report.py`
- Legacy daily health email entrypoint now acts as a compatibility shim and routes to the canonical morning summary sender:
  - `/Users/mark/Property_Analytics/send_daily_health_report.py`
- Added duplicate-send protection for summary emails using:
  - `/Users/mark/Property_Analytics/utils/summary_email_guard.py`
- Current protection in place:
  - Morning Full summary skips if the same subject already has a successful delivery record for that date
  - Weekly Progress skips if the same subject already has a successful delivery record for that date
- Morning delivery acceptance checks now fail on duplicate successful morning-summary sends:
  - `/Users/mark/Property_Analytics/scripts/verify_morning_delivery.py`
- Operational intent:
  - one canonical daily summary email
  - one weekly summary email
  - incident alerts may still send separately when something is actually broken

### Specialty / pilot email behavior

- Pilot workflows still generate their specialty artifacts through:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_pilot_roundup_email.py`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_data_exports_email.py`
- Shared specialty-email policy helper:
  - `/Users/mark/Property_Analytics/utils/specialty_email_policy.py`
- Current live wrappers now export `PILOT_SUMMARY_EMAILS_ENABLED` with a default of `1`:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
- Operational note:
  - older memory and docs may still reference a default of `0`
  - the wrappers were changed back to `1` during April 11 recovery work so pilot summary emails resume by default unless explicitly suppressed
- Current inbox policy intent:
  - core summaries remain:
    - Morning Full (daily)
    - Weekly Progress (weekly)
  - specialty pilot informational emails are currently enabled by wrapper default
  - failure / incident alerts remain allowed

### Morning failure alert consolidation

- Morning failure alerting is now being consolidated around:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- Current central subject line:
  - `🔴 CRITICAL: Consolidated Morning Failure Alert (...)`
- Registry validation findings are now folded into that central alert from:
  - `registry_validation_failures`
- Direct registry validation emails are suppressed by default in:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/validate_registry_completeness.py`
- Standalone duplicate validator scheduler is disabled:
  - `/Users/mark/Library/LaunchAgents/com.venterra.registry_validation.plist`
- Pilot morning workflow also has its own failure mailer path:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
- Pilot wrapper now includes Bash 3.2-safe shell failure trapping:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- Important open gap:
  - duplicate registry validator emails were removed, but central portfolio alerting and pilot-specific failure alerting are not yet fully unified into one email path
- Handoff doc for future alerting threads:
  - `/Users/mark/Property_Analytics/docs/ALERT_EMAIL_HANDOFF_2026-04-11.md`

### Governed memory system

- Implemented a governed three-layer memory system inside the existing platform:
  - Captain's Log = property-scoped memory
  - Fleet Brief = cohort / regional memory
  - The Ledger = institutional memory
- Canonical persistence and promotion workflow now live in:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/intelligence-memory.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0022_create_governed_memory_tables.sql`
- Governance behavior enforced:
  - direct writes only create property-scoped Captain's Log entries
  - property entries may only become Fleet Brief candidates
  - Fleet Brief entries may only become Ledger candidates
  - Fleet Brief targeting is governed at the service layer from canonical property mapping; property-level promotion no longer mints arbitrary fleet scopes
  - promotions require explicit review, evidence lineage, and audit logging
  - duplicate target promotions reuse existing promoted entries instead of silently minting parallel truth
  - reused promoted entries now retain durable lineage links so active Fleet Brief and Ledger entries can show full upstream candidate lineage and supporting evidence without depending on the promotions log alone
  - consumer-facing memory reads now default to authoritative states only:
    - Captain's Log = `active`
    - Fleet Brief = `active`
    - The Ledger = `approved`
  - broader status reads require an explicit admin/debug path
- Intelligence Office now exposes governed memory views in the existing product surface:
  - `/Users/mark/Property_Analytics/apps/web/src/components/intelligence-office-page.tsx`
- Site Content Creator now keeps governed memory, guidance, and source evidence in distinct UI sections with memory-specific scope / status / confidence / provenance affordances:
  - `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- VACS property context now includes governed memory context so downstream content generation reads platform memory without writing truth:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
- Shared contract additions for future consumers live in:
  - `/Users/mark/Property_Analytics/packages/shared/src/memory-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/memory-schemas.ts`
- Verification completed for the new capability:
  - API typecheck passed
  - targeted governed-memory API tests passed
  - web production build passed

### Governed memory follow-up hardening

- Follow-up audit hardening closed four integration gaps:
  - VACS service context now fails closed when service auth is not configured instead of exposing governed memory on an unguarded machine route
  - shared governed-memory contracts no longer advertise arbitrary upward target keys and now include lineage-aware shape updates
  - Site Content Creator evidence-in-play now scopes to the selected property's linked active evidence rather than a generic office-wide evidence slice
  - architecture docs now explicitly describe governed memory as distinct from truth, guidance, and Captain's Brief read-model composition
- Key files updated:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/memory-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/memory-schemas.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
  - `/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md`
  - `/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md`

### Best-of-breed brief-input tightening

- Site Content Creator now reads property-scoped brief inputs from Intelligence Office instead of loading office-wide claims/evidence and filtering in the browser.
- New route:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
  - `GET /v1/admin/intelligence/properties/:propertyId/brief-inputs`
- VACS now has explicit contract coverage proving:
  - service auth is required
  - shared-token and Access-token modes both work
  - `pib`, `memory`, and `intelligence` remain distinct payload sections
  - governed memory in that payload only surfaces authoritative statuses
- Additional docs updated:
  - `/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md`
  - `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md`

### 2026-04-11 - Morning Alert Consolidation Handoff

- Added a dedicated alerting handoff doc:
  - `/Users/mark/Property_Analytics/docs/ALERT_EMAIL_HANDOFF_2026-04-11.md`
- Recorded the current alerting split:
  - central portfolio consolidated alert in `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - pilot-specific failure alert in `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
- Confirmed registry validator duplication reduction:
  - standalone LaunchAgent disabled
  - direct registry validation emails suppressed by default
  - latest registry findings now render inside the consolidated morning failure email
- Corrected repo memory drift:
  - pilot wrapper defaults currently use `PILOT_SUMMARY_EMAILS_ENABLED=1`, not `0`
- Remaining open gap:
  - registry duplicate alerts were removed, but portfolio and pilot failure paths are still not fully unified into one inbox item

### 2026-04-13 - Pilot morning false bootstrap alert + Node PATH repair

- Root issue 1:
  - pilot morning GT retry loop returned a controlled nonzero on an incomplete same-day attempt, but the global `ERR` trap still classified that as `Bootstrap / Shell`
- Root issue 2:
  - homepage evidence later failed under LaunchAgent because `node` was not on the wrapper `PATH`, even though Node was installed locally under:
    - `/Users/mark/.nvm/versions/node/v22.22.1/bin/node`
- Fixes applied:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
    - wrapper `PATH` now includes the Node binary directory
    - GT and PSI freshness loops are now invoked through `if ! ...; then exit 1; fi` guards so controlled loop returns do not trigger the bootstrap trap
    - downstream stages now send stage-accurate failure alerts instead of falling into the generic bootstrap path
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
    - removed `cgriffin@venterraliving.com`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_data_exports_email.py`
    - removed `cgriffin@venterraliving.com`
- April 13 recovery actions completed:
  - homepage audit evidence rerun succeeded
  - fresh dated CSVs regenerated for `2026-04-13`
  - roundup regenerated for `2026-04-13`
  - export email resent to Mark only
  - roundup email resent to Mark only
- Follow-up safeguard added:
  - the pilot morning wrapper now records same-day failure marker state in `~/Library/Logs/Venterra/pilot_morning_status/`
  - if an earlier pilot failure alert is followed by a later same-day successful completion, the workflow now sends a recovery email so the inbox reflects the final state
  - one-time manual recovery note was also sent for `2026-04-13`

### 2026-04-13 - Pilot roundup default now includes sister/control cohort

- Updated the default roundup generator:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- New default report shape:
  - first KPI row = pilot metrics
  - second KPI row = sister/control metrics
  - each pilot is grouped with its matched sister/control property in the main performance section
- Current rendered default artifact:
  - `/Users/mark/Property_Analytics/pilot_roundup/reports/Pilot_Performance_Roundup_2026-04-13.html`
- Supporting documentation updated:
  - `/Users/mark/Property_Analytics/pilot_roundup/README.md`
  - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- Operational intent:
  - this paired pilot+sister layout is now the default Pilot CWV roundup presentation, replacing the prior pilot-only version

### 2026-04-11 - Watchtower daily collection operations foundation

- Extended canonical collection tracking in:
  - `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
- New runtime support now exists for:
  - richer `data_collections` run semantics via `completed`, `partial`, and `blocked` inference instead of flattening all partial runs into `failed`
  - a canonical `collection_retry_queue` runtime table for retryable unresolved collection work
  - expanded `data_collections` columns used by operator surfaces:
    - `properties_total`
    - `properties_success`
    - `properties_skipped`
    - `notes`
- Watchtower now has a first operator-facing "Today's Collection" panel driven from:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- Current Watchtower operations view now exposes:
  - source-level run status for today's collection date
  - progress counts by source
  - retry attempt counts
  - rate-limit hit counts
  - start/completion timing
  - operator context from notes or latest error
- Important architectural note:
  - this is phase 1 of the live daily collection console
  - it currently reads from mirrored `data_collections`
  - the next phase should attach the real retry worker and queue-driven morning closure flow so Watchtower can show `waiting_on_manual_source`, `retrying`, and `blocked` with fuller fidelity
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/api`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/web`

### 2026-04-12 - Watchtower command-deck redesign

- Reworked `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` from a mostly conventional monitoring dashboard into a more display-centric command deck.
- The same canonical `HealthStatusResponse` payload is now presented through:
  - a large hero command surface with tower-state readouts and next-action guidance
  - four dial-style instruments for coverage, closure, freshness, and integrity pressure
  - a visual signal rail for source freshness state
  - a "Tower Heat" list for the most stressed source lanes
  - richer collection source pods with completion bars, retry/failure/open counts, and contextual notes
  - more atmospheric signal-wall cards, coverage matrix styling, table telemetry cards, and closure-context panels
- Watchtower now also has a more alive operator feel without backend changes:
  - client-side auto-refresh every 60 seconds
  - live local tower clock and last-sync readout
  - micro-sparklines for collection motion, freshness motion, and issue motion
  - a collection constellation view for source-lane quick scanning
- Watchtower now also has real historical telemetry from the API contract:
  - `telemetry.collection_history` exposes seven-day collection aggregates from canonical `data_collections`
  - `telemetry.source_coverage_history` exposes recent per-source coverage history from the real mirrored tables
  - `telemetry.source_timelines` exposes recent per-source run states and completion counts from canonical `data_collections`
  - the web surface now uses those for a "Seven-Day Recovery Tape" and "Source Coverage Drift" section
- Watchtower now also renders "Source Timeline Lanes" so operators can see each collector's recent state progression instead of only a single current snapshot.
- Source timeline lanes are now interactive:
  - selecting a source focuses the lane
  - Watchtower renders a source drill-in panel with current progress, open queue count, issue count, live notes, and recent retry signal for that selected source
  - retry-queue reading in the page now naturally collapses around the selected source context
- Source focus now propagates across the broader page:
  - tower heat
  - integrity issue list
  - source signal wall
  - source coverage drift section
- Watchtower can now behave like a single-source operations mode until the operator clears focus.
- Selected-source drill-ins now also include source-specific runbook hints:
  - owner / lane
  - first remediation step
  - escalation guidance
  - common failure patterns to watch for
- Selected-source drill-ins now also surface source-aware action chips such as:
  - `Retry subset`
  - `Check files`
  - `Inspect auth`
  - `Run mirror`
- These are guidance chips today, not wired execution buttons yet.
- Watchtower now also surfaces the live unresolved retry queue directly:
  - `telemetry.retry_queue` exposes current-day open retry items from `collection_retry_queue`
  - includes queue depth, counts by queue status, counts by retry disposition, and the current open items with next-attempt timing and error/notes context
  - the web surface now renders this as a "Retry Queue Board" inside the collection deck
- Watchtower retry board now has operator controls:
  - queue search
  - scope filters for all/core/manual/hard-blocked/retrying
  - a focus mode that floats the riskiest unresolved items to the top
- Watchtower now also has a top-of-page command rail:
  - `Act Now`
  - `Manual Wait`
  - `Hard Block`
  - `Closure Read`
- The rail is now queue-aware rather than count-only:
  - `Act Now` calls out due-now retry work or the next scheduled retry time
  - `Manual Wait` names the current manual dependency lane
  - `Hard Block` summarizes the leading blocker class such as auth, rate limit, transient API, or source delivery
- The intent is to make the first scan answer what needs intervention immediately before the operator drops into the deeper deck.
- Important implementation note:
  - the first redesign stayed on the existing API contract
  - the newer telemetry pass extends the canonical health contract rather than creating a new endpoint
  - the UI is more comprehensive without creating another parallel monitoring system
- Verification completed:
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/api`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/web`

### 2026-04-11 - Morning retry worker and summary closure gate

- Added shared closure-state logic in:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`
- The new helper evaluates:
  - whether the day is still `open`
  - whether all core sources are `complete`
  - whether the retry window has closed and the day should be treated as `blocked`
  - which core sources remain unresolved
- Added a canonical retry-worker foundation in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- Current worker behavior:
  - inspects the latest run for each core source
  - schedules source-level retry queue entries for missing/open work
  - updates collection run notes/status toward `retry_scheduled`
  - detects pending guest card drop files as a manual-dependency signal
  - returns machine-readable JSON for future launchd/automation integration
- Added DB helpers to support the workflow in:
  - `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
  - latest per-source run fetch
  - retry queue fetch
  - run-status updates with retry-attempt increments
- Morning summary delivery is now gated in:
  - `/Users/mark/Property_Analytics/send_morning_full_report.py`
- New behavior:
  - summary send is held while the daily collection closure state is still open
  - once the retry window closes, the summary can proceed with blocked/unresolved context instead of pretending the day is still active
- Central failure alert execution now also consults closure state in:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - if the day is still open, the failure email is held instead of firing prematurely
- Watchtower phase-1 collection panel now also exposes a visible day-open/day-closed badge from the mirrored run state.
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/db/database_manager.py /Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py /Users/mark/Property_Analytics/send_morning_full_report.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
  - `python3 /Users/mark/Property_Analytics/send_morning_full_report.py --dry-run`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/api`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/web`

### 2026-04-11 - Targeted retry execution for core sources

- Extended the canonical first-pass collector in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- New first-pass behavior:
  - GA4 property failures now emit property-level retry queue items
  - in-run GA4 transient recoveries now resolve those queue items immediately
  - Google Ads first-pass and targeted in-run retry failures now emit property-level retry queue items keyed by property name
  - GA4 and Google Ads runs now write richer completion metadata including:
    - `properties_total`
    - `properties_success`
    - `notes`
    - explicit `partial` vs `completed` status
- Extended retry-queue helpers in:
  - `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
  - source-filtered queue reads
  - queue resolution / exhaustion helpers
- Upgraded the retry worker in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- Current worker execution capability:
  - executes targeted GA4 property retries through canonical collector logic
  - executes targeted Google Ads property retries through the existing subset-capable Ads collector
  - retries guest card ingestion when files are present
  - retries ThirtyLines / unit availability ingestion
  - retries D1 mirror sync
  - updates collection run notes/status so Watchtower and summary gating reflect real retry activity
- Important current limitation:
  - GSC property-level retry execution is not implemented yet
  - live retry execution was not fired in-session to avoid mutating tonight's queue and triggering real external/API activity without an explicit operator run
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/db/database_manager.py /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py /Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py /Users/mark/Property_Analytics/send_morning_full_report.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/api`
  - `./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.json` in `apps/web`

### 2026-04-12 - Pilot morning bootstrap failure root fix

- Resolved the pilot morning hard-fail that occurred on 2026-04-12 after fresh GTMetrix + PSI succeeded and the workflow advanced to homepage audit evidence.
- Root cause:
  - `DatabaseManager` defaulted to the wrong DB path:
    - `/Users/mark/data/portfolio_analytics.db`
  - when that nonexistent DB was encountered, initialization then looked for a nonexistent schema path:
    - `/Users/mark/Property_Analytics/schema/portfolio_database_schema.sql`
  - the failure surfaced from:
    - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`
- Fixes applied:
  - `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
    - corrected canonical default DB root to `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
    - added schema-path fallback candidates, including the existing legacy schema in:
      - `/Users/mark/Property_Analytics/Portfolio_Monitoring/schema/portfolio_database_schema.sql`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`
    - now passes the canonical DB path explicitly instead of relying on defaults
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
    - pilot shell failure alerts now include `Stage: ...`
    - if the pipeline trap reports the tail `tee` command, the alert now rewrites that into stage-aware context instead of misleadingly blaming `tee`
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/db/database_manager.py /Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`
  - `bash -n /Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - `python3 /Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py --date 2026-04-12 --limit 1`
  - result: homepage evidence collected successfully and wrote:
    - `/Users/mark/Property_Analytics/pilot_control_cwv/reports/homepage_audit_evidence/pilot_homepage_audit_evidence_2026-04-12.json`

### 2026-04-12 - GSC retry execution and scheduled morning retry cadence

- Extended canonical GSC collection in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- New GSC behavior:
  - `data_collections` tracking now exists for the main GSC run
  - property-level retry queue items are written for GSC failures
  - transient GSC failures get one in-run retry before rolling forward into the queue
  - successful collections resolve any matching queued GSC retry items
- Extended retry-worker execution in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- The retry worker can now execute targeted retries for:
  - GA4
  - GSC
  - Google Ads
  - guest cards
  - unit availability
  - D1 mirror
- Added a scheduled retry-cycle wrapper in:
  - `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- Wrapper behavior:
  - runs the canonical retry worker
  - regenerates Morning Full from current DB state
  - attempts Morning Full delivery, which remains closure-gated by `send_morning_full_report.py`
  - uses a lock to prevent overlapping retry-cycle runs
- Added and activated LaunchAgent:
  - `/Users/mark/Library/LaunchAgents/com.venterra.portfolio.retry-cycle.plist`
- Current retry cadence:
  - every 30 minutes from 6:15 AM through 11:15 AM local time
- This means the morning system now has an actual recurring recovery loop behind the closure-state model instead of only manual or one-shot retry execution.
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
  - `bash -n /Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
  - `plutil -lint /Users/mark/Library/LaunchAgents/com.venterra.portfolio.retry-cycle.plist`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
  - LaunchAgent loaded and enabled via `launchctl`

### 2026-04-13 - PIB v2.2.0 SightMap panel and Resi event ingestion

- Extended the Resi GA4 intent-event allowlist in:
  - `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- New Resi events now explicitly collected into `ga4_event_facts`:
  - `sightmap_filters_change`
  - `sightmap_unit_matches_impression`
  - `sightmap_unit_list_impression`
  - `sightmap_unit_map_unit_click`
  - `sightmap_unit_list_change`
  - `sightmap_unit_details_outbound_click`
  - `sightmap_unit_list_unit_click`
  - `sightmap_unit_details_apply_click`
- Backfilled the last 30 days of Resi GA4 event facts for all 9 Resi properties using:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/scripts/collect_ga4_events.py`
- Added a versioned PIB successor path in:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/PIB_V2_2_0_RELEASE_DOCUMENTATION.md`
- New PIB v2.2.0 behavior:
  - computes grouped SightMap metrics for Resi properties from `ga4_event_facts`
  - renders a SightMap Signals panel inside Conversion & Sentiment
  - includes grouped counts, prior-period deltas, click rates per 100 sessions, and Resi portfolio benchmarks
- Verified against:
  - `The District Universal Boulevard`
  - generated output:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/reports/the-district-universal-boulevard/2026/2026-04-13__Property-Intelligence-Brief__the-district-universal-boulevard__2026-03-14_to_2026-04-12.html`
  - SightMap panel values confirmed in payload:
    - `unit_clicks: 378`
    - `conversion_clicks: 45`
- Verification completed:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py /Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py /Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
  - `python3 /Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py --property "The District Universal Boulevard" --outdir /Users/mark/Property_Analytics/Property_Intelligence_Brief/reports`

### 2026-04-13 - PIB v2.2.0 memorialized and locked

- Promoted the versioned PIB `v2.2.0` path from successor-in-development to an approved locked PIB standard
- Added explicit repo guardrails for:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py`
- Added locked-standard reference:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/docs/PIB_V2_2_0_LOCKED_STANDARD.md`
- Locked visual decisions now explicitly memorialized:
  - blue section headers for `SightMap Metrics`, `Ratings and Reviews`, and `Availability & Inventory`
  - neutral `Unit Type Classified` KPI styling with black number and no judgment label

### 2026-04-14 - Search Intelligence report added to Data Pond

- Added a new app-native versioned Search Intelligence report flow:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx`
  - `/Users/mark/Property_Analytics/docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md`
- Added Worker env binding contract for:
  - `SEMRUSH_API_KEY`
- New Data Pond workflow:
  - select a single property
  - optionally enter an email recipient
  - generate a PIB-style keyword intelligence brief
  - preview in-app
  - download HTML, Markdown, and JSON artifacts
  - send the report through the app email path with attachments
- Report inputs combine:
  - live SEMrush `domain_organic` pulls
  - local `semrush_keyword_rankings`
  - local `gsc_queries`
  - local `google_ads_keywords`
  - local competitor mappings from `property_competitors` and `competitors`
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-14 - Search Intelligence surfaced on analysis landing page and Keeper-backed Worker secret flow documented

- Added Search Intelligence to the main `/analysis` landing page module grid so the report family is discoverable alongside the other POP Brief builders.
- Updated Worker secret deployment docs and helper scripts so `SEMRUSH_API_KEY` is treated as a first-class app secret instead of an implicit requirement:
  - `/Users/mark/Property_Analytics/scripts/check_env.md`
  - `/Users/mark/Property_Analytics/scripts/bootstrap_cloudflare.sh`
  - `/Users/mark/Property_Analytics/scripts/zero_trust_worker_secret_cutover.sh`
  - `/Users/mark/Property_Analytics/docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md`
- Keeper-backed SEMrush notation now has an explicit canonical deployment path for the API Worker:
  - `KSM_PROFILE=marketingops`
  - `KSM_SEMRUSH_API_KEY_NOTATION=keeper://q1dizD20qVFSS1ZCYoRPEw/field/password`

### 2026-04-15 - Cloudflare Access handoff refined for static Pages frontend

- Confirmed `app.venterradev.com` is a static Cloudflare Pages deployment, so Data Pond cannot rely on a Next.js route handler in `apps/web` for Cloudflare bootstrap in production.
- Replaced the app-host bootstrap concept with an API-host bootstrap flow:
  - frontend redirects to `https://api.venterradev.com/v1/auth/access-bootstrap`
  - API Worker mints the normal `pop_session`
  - browser returns to the Data Pond app shell
- Cloudflare Access app split now distinguishes:
  - human/browser bootstrap: `Data Pond - API Auth Bootstrap`
  - machine-only service routes: `Data Pond - API Platform`, `Data Pond - API VACS`, `Data Pond - API EVS`
- Origin auth fallback was widened so browser bootstrap can succeed even when Cloudflare forwards `cf-access-authenticated-user-email` without a JWT assertion:
  - `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/test/auth/cloudflare-bootstrap.test.ts`
- Added a one-shot `cf_bootstrapped=1` loop guard in the Pages frontend so failed Cloudflare bootstrap attempts now fall back to explicit login error states instead of repeatedly redirecting between `/` and the API bootstrap path.

### 2026-04-15 - Cloudflare browser bootstrap stabilized with controlled retry and explicit signed-out state

- Confirmed the working Cloudflare Access app split for browser vs machine traffic is:
  - `Data Pond - API Auth Bootstrap` covering only `/v1/auth/access-bootstrap`
  - machine-only API apps remaining scoped to `/v1/platform/*`, `/v1/vacs/*`, and `/v1/evs/*`
- Added frontend retry hardening for the Cloudflare-to-Data-Pond handoff:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
- New browser behavior:
  - one controlled top-level retry through `/v1/auth/access-bootstrap` is allowed before surfacing the `cloudflare_access_api_unreachable` fallback
  - logout now lands on `/login?logged_out=1` so the signed-out experience stays stable instead of immediately re-triggering Cloudflare bootstrap
- `/login` now fully suppresses the session/bootstrap probe when `logged_out=1` is present, so logout can no longer immediately bounce the user back into the dashboard through an automatic `/v1/auth/me` check
  - bootstrap query cleanup now removes both `cf_bootstrapped` and the retry marker after a successful session resolution
- Verified locally:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
- Redeployed the static Pages frontend through the Keeper/KSM-backed Wrangler path:
  - latest preview: `https://b801f73e.property-analytics.pages.dev`

### 2026-04-16 - Cloudflare browser bootstrap now preserves the active app hostname

- Updated the API/browser handoff so Data Pond no longer assumes `app.venterradev.com` is the only human frontend origin:
  - `/Users/mark/Property_Analytics/apps/api/src/index.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `api.venterradev.com` now allows browser CORS from both `app.venterradev.com` and `app.venterraliving.com`
- `/v1/auth/access-bootstrap` now redirects back to the requesting frontend origin when the request arrived from a known app host, which keeps `app.venterraliving.com` from falling back to the old app host during Cloudflare Access session bootstrap
- Added regression coverage for the cross-host bootstrap redirect:
  - `/Users/mark/Property_Analytics/apps/api/test/auth/cloudflare-bootstrap.test.ts`
- Verified locally:
  - `npx tsx --test test/auth/cloudflare-bootstrap.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-16 - Zero Trust browser auth can now auto-provision least-privilege app users

- Updated the Data Pond auth bootstrap to let a successful Cloudflare Access browser identity become the app session source of truth instead of requiring a pre-seeded `users` row:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/env.ts`
  - `/Users/mark/Property_Analytics/apps/api/wrangler.toml`
- New runtime posture:
  - `CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED=true` allows Access-approved identities to be created automatically on first entry
  - default auto-provisioned role is `viewer`
  - explicit elevation can still be controlled with `CLOUDFLARE_ACCESS_ADMIN_EMAILS` and `CLOUDFLARE_ACCESS_EDITOR_EMAILS`
  - optional narrowing can be added with `CLOUDFLARE_ACCESS_ALLOWED_EMAILS` and `CLOUDFLARE_ACCESS_ALLOWED_DOMAINS`
- Tightened trust boundary after review: browser bootstrap now requires a real Cloudflare Access JWT or `CF_Authorization` cookie and no longer trusts a bare `cf-access-authenticated-user-email` header by itself
- Existing inactive users still fail closed; this did not create a bypass around app-level deactivation or role checks
- Added regression coverage for viewer/admin auto-provision from Cloudflare Access:
  - `/Users/mark/Property_Analytics/apps/api/test/auth/cloudflare-bootstrap.test.ts`
- Verified locally:
  - `npx tsx --test test/auth/cloudflare-bootstrap.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
- Frontend logout now clears the Data Pond session and then navigates to the Cloudflare Access logout URL, so the sign-out button no longer leaves the Zero Trust browser session alive and immediately re-authenticates the user
- Login bootstrap now also honors a browser-side Cloudflare signed-out marker, so `/login` stops auto-bootstrapping immediately after logout and instead shows an explicit "Continue with Cloudflare Access" choice before re-entering the Zero Trust flow
- The signed-out Data Pond login page now presents Cloudflare One as the primary branded Zero Trust entry path inside the existing Data Pond visual language, so the handoff feels like one product instead of a generic fallback screen

### 2026-04-16 - Platform-app core lane closed cleanly around Watchtower and browser auth

- Finished the outstanding `platform-app` core stabilization pass rather than leaving it as a partially organized lane
- Closed the remaining platform route contract bug in lifecycle noise-budget accounting:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/agent-runtime/repository.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/lifecycle/repository.ts`
- Noise-budget summary and daily suppression logic now evaluate against the lifecycle observation day (`last_observed_at`, with `created_at` fallback) instead of the row insertion timestamp, which keeps backdated or replayed lifecycle events aligned with the same operational day semantics used by the lifecycle engine
- Re-verified the platform-app core set cleanly:
  - `npx tsx --test test/auth/cloudflare-bootstrap.test.ts test/platform/health-status.test.ts test/platform/platform-routes.test.ts test/platform/platform-phase1-client-smoke.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
- Updated the platform-app compartment docs to reflect the new status:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_MANIFEST_2026-04-16.md`
  - `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_FINISH_ORDER_2026-04-16.md`
- Current posture:
  - `platform-app` core is coherent across Watchtower, platform routes, and Cloudflare auth/bootstrap
  - EVS / BrowserStack-adjacent work remains secondary and can be handled as a follow-on sub-lane instead of blocking the core platform-app finish state

### 2026-04-16 - EVS / BrowserStack lane separated cleanly from platform-app core

- Confirmed the remaining EVS-specific auth path is healthy:
  - `npx tsx --test test/platform/evs-auth.test.ts` in `/Users/mark/Property_Analytics/apps/api`
- Kept `platform-app` finished by moving EVS / BrowserStack out of the core lane definition and into its own compartment docs:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_MANIFEST_2026-04-16.md`
  - `/Users/mark/Property_Analytics/docs/WORKTREE_EVS_BROWSERSTACK_FINISH_ORDER_2026-04-16.md`
- Updated the platform lane docs so EVS is treated as a follow-on stream rather than implied unfinished platform-app work:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_MANIFEST_2026-04-16.md`
  - `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_FINISH_ORDER_2026-04-16.md`
- Updated the capability register EVS rows to reflect the current posture:
  - EVS auth and persistence shape are real
  - workflow dispatch remains a deliberate follow-on decision
  - BrowserStack operations should be worked in the EVS lane, not mixed into Watchtower/auth commits

### 2026-04-16 - Data alerting now respects canonical Google Ads and latest-run collection posture

- Started the `data-collection-hardening` finish pass by validating the canonical retry/closure runtime directly:
  - `python3 -m py_compile Data_Collection/db/database_manager.py Data_Collection/utils/daily_collection_closure.py Data_Collection/utils/source_freshness_policy.py Data_Collection/utils/bi_manual_ingest.py Data_Collection/orchestration/retry_incomplete_collections.py Data_Collection/orchestration/daily_master_collection.py Data_Collection/monitoring/alert_sender.py`
  - `python3 Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
  - `bash -n /Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- Tightened `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py` so the morning alert now matches the collection system’s actual semantics:
  - Google Ads freshness no longer treats `no_activity` properties as stale just because no campaign rows were written for them
  - Google Ads freshness now reads from the latest canonical `data_collections` run posture instead of raw per-property row presence
  - collection job failures now evaluate the latest run per source inside the lookback window instead of replaying older recovered failures
  - specialty-only failures now downgrade to warning posture in the subject line and console output instead of forcing a critical banner
- Verified the operator-facing result with:
  - `python3 Data_Collection/monitoring/alert_sender.py --test`
- The current test-mode alert is materially cleaner:
  - false-positive Google Ads freshness noise dropped away
  - recovered historical Google Ads failures no longer keep the morning alert in a false critical posture
  - a specialty-only BI report issue now presents as warning instead of critical
- Added the lane execution doc:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_DATA_COLLECTION_FINISH_ORDER_2026-04-16.md`

### 2026-04-16 - Specialty BI alert residue cleared from the morning failure surface

- Continued the `data-collection-hardening` pass by tracing the remaining specialty `BI_REPORT` alert back to stale run-state residue instead of live pending work
- Confirmed:
  - the latest `bi_report` row in `data_collections` was still `blocked` from an earlier workbook issue
  - current BI snapshot rows for `2026-04-16` are already present in `bi_raw_snapshot_values`
  - `get_pending_bi_workbooks()` now returns no pending files from the shared drop
- Tightened the BI path and alert interpretation:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/bi_manual_ingest.py`
    - unreadable workbook failures now get a clearer manual-action error message
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
    - BI partial/failed collection rows now preserve workbook-level error detail in `error_message`
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
    - BI retry queue items now retain the real workbook error text and classify it more specifically when present
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
    - stale `bi_report` failures are now suppressed from the morning failure alert when no BI workbooks remain pending in the drop
- Verified with:
  - `python3 -m py_compile Data_Collection/monitoring/alert_sender.py Data_Collection/utils/bi_manual_ingest.py Data_Collection/orchestration/daily_master_collection.py Data_Collection/orchestration/retry_incomplete_collections.py`
  - `python3 Data_Collection/monitoring/alert_sender.py --test`
- Current operator-facing result:
  - `No collection job failures detected`
  - the alert now focuses on the real remaining freshness issues (`GA4` and `GSC`) instead of stale BI / Ads failure residue

### 2026-04-16 - GA4/GSC freshness alerting collapsed to one real GSC lag

- Continued the `data-collection-hardening` pass by tracing the remaining GA4/GSC freshness items in the morning alert
- Tightened `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py` again:
  - GA4 freshness now suppresses prelaunch registry properties instead of flagging them as live missing-data debt
  - GSC freshness now aggregates to the property level using the latest date across known URL aliases instead of flagging stale `venterraliving.com/apartments/...` rows when the canonical `sc-domain:` property is fresher
- Verified with:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test`
- Current operator-facing result:
  - `No collection job failures detected`
  - morning alert now reports exactly one remaining freshness issue:
    - `GSC` missing for `San Palmilla` at `2026-04-12`
- Interpretation:
  - the earlier GA4 prelaunch issue was false-positive noise
  - the earlier GSC stale cluster was alias-mapping noise
  - the remaining `San Palmilla` item looks like real GSC lag and should be treated as actual collection debt unless later evidence shows another alias/registry mismatch

### 2026-04-16 - Remaining GSC issue traced to SQLite lock contention and stale source-state residue

- Continued the `data-collection-hardening` pass by drilling into the final remaining morning alert issue
- Found that the apparent `San Palmilla` freshness miss was only the tail symptom:
  - today’s `gsc` collection row is stuck `in_progress` with `0/0/0`
  - the only open GSC retry item is a synthetic source-level queue row
  - `Data_Collection/logs/collection_stderr.log` shows the real cause on 2026-04-16:
    - repeated `sqlite3.OperationalError: database is locked`
    - failure during `insert_gsc_daily_metrics(...)`
    - then another lock failure while trying to queue retry state
- Tightened `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`:
  - SQLite connections now use `timeout=60`
  - connections now apply `PRAGMA busy_timeout = 60000`
  - this should turn short write-lock collisions into waits instead of immediate collector failure
- Also improved the morning alert interpretation in `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`:
  - unresolved core-source closure state now surfaces as a source-level collection failure instead of a misleading per-property freshness miss
  - guest-card unresolved closure state is now suppressed when the manual file has actually been ingested and no pending guest-card CSVs remain
- Verified:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/db/database_manager.py /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py /Users/mark/Property_Analytics/Data_Collection/utils/bi_manual_ingest.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test`
- Current operator-facing result:
  - morning alert now reports one real core issue: `GSC` unresolved at the source level
  - no false-positive freshness issues remain
  - guest-card residue is no longer shown once the pending CSV has been ingested and the drop is clear

### 2026-04-16 - Canonical retry worker fully closed the day and restored all-clear alert posture

- Ran the live canonical retry worker again after the guest-card completion bookkeeping patch was present:
  - `python3 /Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py --json`
- Confirmed the worker behavior:
  - re-queued `guest_card` as a missing core source because no same-day `data_collections` row existed yet
  - immediately reconciled that source as `resolved_stale_source_marker`
  - wrote a real same-day `guest_card` completion row in `data_collections`
- Verified the current same-day collection posture in the DB:
  - `gsc` = `completed`
  - `bi_report` = `completed`
  - `guest_card` = `completed`
- Verified closure and alert outcomes:
  - `evaluate_daily_collection_closure(...)` now returns `state=complete`, `queue_depth=0`, and `summary_reason=all_core_sources_closed`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test` now reports:
    - `No collection job failures detected`
    - `All data sources are up-to-date`
    - subject `✅ Data Collection Status: All Clear`
- Interpretation:
  - the remaining `San Palmilla` GSC issue was recovered by the live retry worker
  - the remaining guest-card issue was purely same-day bookkeeping, not real freshness debt
  - the canonical data lane is now back to an honest all-clear posture for `2026-04-16`

### 2026-04-16 - Watchtower advisory governance now reflects cadence freshness instead of same-day-only runs

- Continued the `data-collection-hardening` pass by tightening the operator-facing advisory posture in Watchtower
- Found the contract mismatch:
  - `apps/api/src/routes/health.ts` was building `advisory_sources` only from same-day `data_collections` rows
  - `apps/web/src/app/watchtower/page.tsx` therefore rendered advisory lanes as effectively `same-day run` vs `No Run`
  - this misrepresented cadence-based advisory lanes such as `measurement_dashboard`, `psi`, and `gsc_url_inspection`
- Tightened the health contract:
  - advisory sources now include:
    - `latest_recorded_date`
    - `expected_latest_date`
    - `freshness_status`
  - advisory freshness uses the latest real underlying date where available:
    - `measurement_dashboard` → `measurement_daily_metrics.snapshot_date`
    - `psi` → `pagespeed_metrics.metric_date`
    - `gsc_url_inspection` → `gsc_url_inspection.inspection_date`
  - health route now safely tolerates missing optional advisory tables instead of failing test/partial environments
- Tightened the Watchtower UI:
  - advisory deck now summarizes how many lanes are `fresh` or `near cadence`
  - badges now show `Fresh`, `Near Cadence`, `Stale`, or `No Record` instead of implying that any lane without a same-day run is operationally absent
- Verified with:
  - `cd /Users/mark/Property_Analytics/apps/api && npx tsx --test test/platform/health-status.test.ts`
  - `cd /Users/mark/Property_Analytics/apps/web && npm run build`
- Interpretation:
  - core closure remains authoritative for same-day operations
  - advisory governance is now visually honest about slower/manual lanes instead of overstating missing-work posture

### 2026-04-16 - Advisory governance now has an explicit cadence policy map

- Continued the `data-collection-hardening` pass by replacing heuristic advisory interpretation with an explicit policy model in `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- Added a canonical advisory cadence map with source-level policy for:
  - `bi_manual`, `bi_metrics`, `bi_report` → `Same-day manual`
  - `measurement_dashboard` → `Weekly manual workbook`
  - `psi` → `Daily diagnostic`
  - `gsc_url_inspection`, `browserstack`, `evs`, `sightmap` → `Targeted manual audit`
  - `semrush`, `gbp_reviews`, `gbp_insights`, `cloudflare_cache_audit` → `Weekly automated`
- Tightened the Watchtower API contract again:
  - advisory sources now carry `cadence_key` and `cadence_label` in addition to the earlier freshness metadata
  - cadence-specific thresholds now drive freshness posture instead of treating every advisory lane as a same-day or next-day feed
- Tightened the Watchtower UI:
  - advisory section now renders compact cadence cards rather than flat badges
  - each card shows both freshness posture and lane cadence, which makes weekly/manual lanes legible without pretending they are broken
- Updated the health route regression test to lock the richer advisory payload shape
- Verified with:
  - `cd /Users/mark/Property_Analytics/apps/api && npx tsx --test test/platform/health-status.test.ts`
  - `cd /Users/mark/Property_Analytics/apps/web && npm run build`
- Interpretation:
  - advisory governance is now policy-driven instead of ad hoc
  - future advisory lanes can be added by declaring cadence explicitly rather than encoding special-case UI logic

### 2026-04-16 - Python closure and alerting now consume the same advisory cadence policy

- Continued the `data-collection-hardening` pass by moving the canonical advisory cadence model into `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- Added shared Python-side policy and helper coverage for:
  - advisory cadence declarations
  - cadence-aware freshness evaluation
  - latest-recorded-date lookup from source tables or `data_collections`
  - canonical advisory source status payloads
- Tightened `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`:
  - Python closure output now uses the shared advisory helper instead of a bare same-day-run check
  - advisory sources now carry the same richer shape the app side expects:
    - `latest_recorded_date`
    - `expected_latest_date`
    - `freshness_status`
    - `cadence_key`
    - `cadence_label`
- Tightened `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`:
  - alerting now uses the shared advisory freshness helper for `psi`
  - alerting now also applies the same canonical policy to `semrush`
- Verified with:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py /Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test`
- Current operational result:
  - no collection job failures
  - one advisory freshness issue now appears consistently under the unified policy:
    - `SEMrush` stale
- Interpretation:
  - Watchtower, Python closure, and alerting now share the same advisory cadence model
  - the remaining alert signal is now a policy-truth question, not a drift bug

### 2026-04-16 - SEMRush is now monitored against real source evidence instead of stale orchestration history

- Confirmed the user-facing requirement that `SEMrush` should stay monitored
- Found the monitoring seam:
  - unified advisory cadence policy was still falling back to stale `data_collections` history for `semrush`
  - real SEMRush evidence in `semrush_domain_metrics` was already fresh through `2026-04-15`
  - this made SEMRush look stale even though the underlying data was current
- Tightened both shared policy consumers to use the real evidence table:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
    - `semrush` now resolves latest recorded date from `semrush_domain_metrics.metric_date`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
    - Watchtower advisory policy now does the same on the app/API side
- Verified:
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test` now returns all clear again
  - Python closure now reports `semrush` as:
    - `freshness_status = fresh`
    - `latest_recorded_date = 2026-04-15`
    - `cadence_label = Weekly automated`
  - `cd /Users/mark/Property_Analytics/apps/api && npx tsx --test test/platform/health-status.test.ts`
  - `cd /Users/mark/Property_Analytics/apps/web && npm run build`
- Interpretation:
  - SEMRush remains actively monitored
  - monitoring now keys off actual SEMRush data freshness instead of an outdated orchestration row

### 2026-04-16 - GBP weekly advisory lanes now use evidence tables too

- Continued the evidence-table audit for weekly advisory monitoring
- Found the remaining posture:
  - `semrush` and `gbp_insights` both have fresh underlying evidence
  - `gbp_reviews` is genuinely stale on current stored review evidence
- Tightened policy sources:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
    - `gbp_reviews` now resolves freshness from `gbp_reviews.review_create_time`
    - `gbp_insights` now resolves freshness from `gbp_daily_insights.metric_date`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
    - Watchtower advisory policy now uses the same evidence-table mappings
- Verified:
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test` still returns all clear on collection failures / freshness
  - Python closure now reports:
    - `semrush` → `fresh`, latest `2026-04-15`
    - `gbp_insights` → `fresh`, latest `2026-04-12`
    - `gbp_reviews` → `stale`, latest `2026-02-20`
  - `cd /Users/mark/Property_Analytics/apps/api && npx tsx --test test/platform/health-status.test.ts`
  - `cd /Users/mark/Property_Analytics/apps/web && npm run build`
- Interpretation:
  - advisory weekly lanes are now monitored from real source evidence instead of stale collection rows
  - `gbp_reviews` is now the meaningful remaining stale lane in this advisory cluster

### 2026-04-16 - GBP reviews runtime repaired and morning alert path aligned

- Investigated the real reason `gbp_reviews` had gone stale despite valid GBP credentials, token refresh, and a populated property/location mapping file
- Found the orchestration bug in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
  - `initialize_collectors()` was attempting to import `gbp_collector` from a nonexistent local `src/collectors` path, which left `self.gbp_collector` unset even though the canonical collector was already imported at module scope
- Repaired the reviews/insights lane:
  - GBP collector initialization now uses the canonical imported `GoogleBusinessProfileCollector`
  - `collect_gbp_reviews()` now records canonical `data_collections` start/complete state, including blocked cases for missing collector or mapping file
  - `collect_gbp_insights()` now records canonical `data_collections` start/complete state for credential, token, mapping, and success paths as well
  - review batch inserts now pass `collection_id` through to the DB layer so collection provenance is preserved
- Ran a live GBP review backfill after the fix:
  - `93` mapped properties processed
  - `91` properties collected successfully
  - `2` properties legitimately returned no reviews
  - `0` properties failed
  - `data_collections` now records same-day completed row:
    - `collection_id=615`
    - `data_source=gbp_reviews`
    - `status=completed`
    - `collection_date=2026-04-16`
- Verified fresh posture after the live run:
  - `SELECT MAX(review_create_time) FROM gbp_reviews` now returns `2026-04-16T21:18:15.322304Z`
  - `evaluate_daily_collection_closure(...)` now reports `gbp_reviews` as:
    - `status=completed`
    - `latest_recorded_date=2026-04-16`
    - `freshness_status=fresh`
    - `cadence_label=Weekly automated`
- Also aligned email alerting with the shared advisory policy:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
    - now evaluates `gbp_reviews` and `gbp_insights` from the same shared freshness model already used by Watchtower and Python closure
- Verified:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test`
  - alert preview now returns `✅ Data Collection Status: All Clear`
- Interpretation:
  - GBP reviews are working again in the real collector path, not just in isolated API tests
  - review freshness, closure posture, and email monitoring are now aligned on the same source truth

### 2026-04-16 - GBP insights ledger reconciled with live collection

- Took the same live-recovery pass on the insights side so the whole GBP lane is coherent instead of only `gbp_reviews`
- Verified pre-run state:
  - `gbp_daily_insights` already had fresh enough weekly evidence (`MAX(metric_date)=2026-04-12`)
  - but `data_collections` bookkeeping for `gbp_insights` was still stale, with the newest run row from `2026-02-20`
- Ran the canonical collector live via:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
  - `PortfolioDataCollector.initialize_collectors()`
  - `PortfolioDataCollector.collect_gbp_insights()`
- Live result:
  - `93` mapped properties processed
  - `91` properties collected successfully
  - `2` legitimate skips with access-denied posture
  - `0` failures
  - same-day `data_collections` row now recorded:
    - `collection_id=616`
    - `data_source=gbp_insights`
    - `status=completed`
    - `collection_date=2026-04-16`
- Verified post-run posture:
  - `evaluate_daily_collection_closure(...)` now reports `gbp_insights` as:
    - `status=completed`
    - `run_recorded=True`
    - `latest_recorded_date=2026-04-14`
    - `freshness_status=fresh`
  - `python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test` remains `✅ Data Collection Status: All Clear`
- Additional note:
  - the GBP mapping file still contains two `Silverbrooke` entries for the same property id with different location ids:
    - `378679398 / 17891924351935738693`
    - `378679398 / 11708397129740175833`
  - one of those locations remains access-denied while the other succeeds; this is a mapping hygiene follow-up, not a collector runtime failure
- Interpretation:
  - the GBP lane is now operationally consistent across reviews, insights, closure, and morning alerting
  - the next cleanup in this area is mapping hygiene, not collection runtime repair

### 2026-04-16 - GBP mapping loader now honors manual overrides and suppresses duplicate property rows

- Continued the GBP cleanup by tracing why the live insights run was still touching duplicate property names even after the collector runtime was repaired
- Found the actual shape of the issue in:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/data/all_properties_gbp_matched.json`
  - the file contains duplicate `matched` rows for at least:
    - `416886840` / `Avasa Hammock Landing`
    - `378679398` / `Silverbrooke`
  - and also carries canonical top-level manual override entries for those property ids plus `Camber Ridge`
- Repaired the canonical collector path in:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
  - added a normalized GBP mapping loader that:
    - reads the `matched` array
    - reads top-level numeric property-id override entries
    - dedupes duplicate property ids
    - prefers mappings with existing stored review/insight evidence
    - then applies explicit manual overrides last
  - both `collect_gbp_reviews()` and `collect_gbp_insights()` now use that canonical loader instead of reading the raw `matched` array directly
- Verified the new loader:
  - reports `2` duplicate property ids suppressed
  - reports `3` manual overrides applied
  - resolves to `91` unique GBP property mappings
  - selects the intended canonical override rows for:
    - `Avasa Hammock Landing`
    - `Silverbrooke`
    - `Camber Ridge`
- Re-ran live GBP insights after the loader fix:
  - `Properties with GBP locations: 91`
  - no duplicate `Silverbrooke` processing
  - no second `Avasa Hammock Landing` attempt
  - result: `90` success, `1` expected access-denied skip, `0` failures
- Interpretation:
  - the collector path is now robust against the current mixed-shape GBP mapping file
  - the remaining cleanup is optional file normalization, not runtime correctness

### 2026-04-16 - GBP mapping file and generator normalized to the canonical 91-property shape

- Finished the GBP mapping hygiene pass by cleaning the source file itself:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/data/all_properties_gbp_matched.json`
- Before normalization the file had:
  - `matched_count = 93`
  - `unmatched_count = -2`
  - duplicate `matched` rows for `Avasa Hammock Landing` and `Silverbrooke`
  - a stale unmatched entry for `Camber Ridge` even though a top-level manual override already existed
- Normalized the live file so it now reflects the same truth the collector is using:
  - `matched_count = 91`
  - `unmatched_count = 0`
  - `91` unique `matched` rows
  - no duplicate property ids
  - manual canonical rows retained for:
    - `Avasa Hammock Landing`
    - `Silverbrooke`
    - `Camber Ridge`
- Also hardened the generator path in:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/match_all_properties_to_gbp.py`
  - the matcher now:
    - preserves top-level numeric manual overrides from an existing mapping file
    - dedupes duplicate property rows before save
    - filters stale unmatched rows when a manual override already covers the property
    - writes corrected matched/unmatched counts
- Verified:
  - the normalized file now reports `91` matched / `0` unmatched
  - no duplicate property ids remain in the `matched` array
  - `python3 -m py_compile /Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py /Users/mark/Property_Analytics/Portfolio_Monitoring/match_all_properties_to_gbp.py`
- Interpretation:
  - the GBP lane is now clean both operationally and at the source-file level
  - future reruns of the matcher are much less likely to reintroduce the same duplicate/manual-override drift

### 2026-04-16 - Legacy Portfolio_Monitoring GBP entry points aligned to the canonical mapping shape

- Continued local cleanup so older GBP entry points do not drift behind the repaired canonical `Data_Collection` flow
- Updated:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_gbp_insights.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/fix_review_property_ids.py`
- These legacy paths now:
  - normalize mixed mapping-file row shapes
  - honor top-level numeric manual overrides
  - suppress duplicate property ids before iterating GBP work
- Verified:
  - `backfill_gbp_insights.load_properties()` now resolves `91` properties with `0` duplicate property ids
  - `python3 -m py_compile` passes for the touched legacy scripts
- Note:
  - importing `collect_daily_data.py` directly as a module still exposes old `sys.path` / `src` assumptions in the legacy package layout
  - that is a legacy import-structure concern, not a GBP mapping correctness issue
- Interpretation:
  - the meaningful GBP local entry points are now aligned on the same canonical mapping truth
  - any remaining legacy cleanup here is package-structure hygiene rather than data-lane correctness

### 2026-04-16 - Legacy Portfolio_Monitoring imports stabilized for package-safe local use

- Finished the next best-practice cleanup step after the GBP mapping work: reducing brittle import behavior in the legacy `Portfolio_Monitoring` package
- Added package markers:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/__init__.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/src/__init__.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/src/monitoring/__init__.py`
- Reworked legacy imports so package-relative usage works first, with compatibility fallbacks only where needed:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/src/db/database_manager.py`
    - now prefers `.db_helper`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/src/monitoring/anomaly_detector.py`
    - now prefers `..db.database_manager`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
    - now prefers package imports from `Portfolio_Monitoring.src...`
    - now prefers package import from `Spotlight_Properties_Report.src.collectors.gsc_collector`
    - removed the old runtime GBP collector import hack that inserted `src/collectors` into `sys.path`
- Verified:
  - direct module import now works:
    - `from Portfolio_Monitoring.collect_daily_data import PortfolioDataCollector`
  - `_load_gbp_matched_properties()` still resolves `91` canonical GBP mappings from that imported module
  - `python3 -m py_compile` passes for the touched legacy package files
- Interpretation:
  - the remaining local `Portfolio_Monitoring` path is now much safer to inspect, import, and reuse
  - this was the main remaining local code-structure weakness around the GBP/data lane

### 2026-04-16 - High-value legacy Portfolio_Monitoring runners moved to package-safe imports

- Continued the local import cleanup across the highest-value legacy runners most likely to be used during manual ops and diagnostics
- Updated:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_reviews.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_all_reviews.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/check_credential_health.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/audit_ga4_properties.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/generate_insights.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/generate_daily_pulse.py`
- These scripts now prefer package-safe imports like:
  - `Portfolio_Monitoring.src...`
  - with legacy fallback only where still needed for older invocation styles
- Also corrected outdated legacy references that still pointed at nonexistent `src.database...` paths by aligning them to the real `src.db...` module tree
- Verified:
  - direct imports now work for representative runners:
    - `Portfolio_Monitoring.check_credential_health`
    - `Portfolio_Monitoring.generate_daily_pulse`
    - `Portfolio_Monitoring.collect_daily_reviews`
    - `Portfolio_Monitoring.backfill_all_reviews`
  - `python3 -m py_compile` passes for the touched runner set
- Interpretation:
  - the most operationally relevant legacy `Portfolio_Monitoring` scripts are now much less dependent on fragile ad hoc path setup
  - remaining cleanup in this area is breadth work, not a critical local-quality blocker

### 2026-04-16 - Legacy GSC/backfill scripts cleaned up for safe imports too

- Extended the same local import cleanup into the highest-value legacy GSC/backfill utilities:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_gsc.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_90_days.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_cendana_gsc.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_gsc_queries_cendana.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_south_shore_lakes.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/backfill_traffic_sources.py`
- Changes:
  - package-safe imports preferred for `Portfolio_Monitoring.src...` and `Spotlight_Properties_Report.src...`
  - legacy fallback kept only as a compatibility path
  - removed import-time execution from:
    - `backfill_gsc.py`
    - `backfill_cendana_gsc.py`
    by moving live work behind `main()` / `__main__`
- Verified:
  - direct import now works safely for the whole batch without unexpectedly kicking off live backfills
  - `python3 -m py_compile` passes for the touched GSC/backfill runner set
- Interpretation:
  - the remaining local legacy surface is getting steadily safer to inspect and reuse
  - this pass removed another meaningful “import can start real work” footgun from the repo

### 2026-04-17 - Review-analysis and GBP test scripts moved onto the package-safe path

- Continued the `Portfolio_Monitoring` breadth cleanup into the review-analysis side:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/analyze_reviews.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/batch_analyze_portfolio_reviews.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/test_gbp_connection.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/src/analyzers/__init__.py`
- Changes:
  - review-analysis scripts now prefer package-safe imports from:
    - `Portfolio_Monitoring.src.analyzers...`
    - `Portfolio_Monitoring.src.db...`
  - added the missing analyzers package marker so `src/analyzers` works as a real package
  - moved the interactive GBP connection test behind `main()` / `__main__` so import no longer triggers prompts or setup flow
- Verified:
  - direct import now works for:
    - `Portfolio_Monitoring.analyze_reviews`
    - `Portfolio_Monitoring.batch_analyze_portfolio_reviews`
    - `Portfolio_Monitoring.test_gbp_connection`
  - `python3 -m py_compile` passes for the touched review-analysis/test set
- Interpretation:
  - the main local review-analysis/debugging surface is now aligned with the safer package-first pattern
  - the remaining long tail is increasingly low-risk cleanup rather than active operational debt

### 2026-04-17 - Email/report/test long tail cleaned up for safer local imports

- Continued the final local breadth pass into the remaining email/report/test scripts that were still using older import patterns:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/send_data_alerts.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/send_insights_email.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/send_daily_pulse_email.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/test_gsc_queries.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/test_data_quality.py`
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/test_correlations.py`
- Changes:
  - package-safe imports now preferred for shared modules like:
    - `Data_Collection.utils.email_sender`
    - `Portfolio_Dashboard.utils.preflight`
    - `Portfolio_Monitoring.generate_daily_pulse`
    - `Portfolio_Monitoring.src.db.database_manager`
  - legacy fallback remains only as a compatibility path
  - `test_gsc_queries.py` now runs behind `main()` / `__main__`, so import no longer triggers live GSC API work
- Verified:
  - direct imports now work safely for the cleaned email/report/test set
  - `python3 -m py_compile` passes for the touched files
- Operational note:
  - `alert_sender.py --test` now reflects live day state rather than all-clear because the current collection day is still open with a `ga4` retry window; that is expected operational posture, not a regression from this cleanup
- Interpretation:
  - the main remaining `Portfolio_Monitoring` long tail is now mostly low-priority legacy/test debris rather than scripts we actively depend on during local work

### 2026-04-17 - Unified system foundation and machine-readable landscape manifest established

- Shifted from narrow lane cleanup into a foundation pass for the whole platform so the repo can describe itself more coherently
- Added:
  - `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md`
  - `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
- The new foundation model defines:
  - canonical truth, interpretation, structural, and execution layers
  - explicit capability-awareness expectations for the platform
  - a shared Zero Trust / Keeper / app-role posture
  - portability and compatibility standards
  - nested Git repositories as explicit repo-boundary objects rather than accidental subfolders
  - the requirement that The Pond become aware of specialized and legacy-but-important systems even before every one of them gets a first-class UI surface
- Updated supporting docs:
  - `/Users/mark/Property_Analytics/README.md`
    - now points at the unified foundation artifacts
    - now names `Data_Collection/orchestration/daily_master_collection.py` as the canonical scheduled collection entrypoint instead of the outdated legacy `Portfolio_Monitoring/collect_daily_data.py` path
  - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
    - now includes the unified foundation / landscape manifest as an active platform-governance capability
  - `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
    - now references the new foundation bridge between broad audit reality and practical migration/cleanup work
- Interpretation:
  - the repo now has a clearer shared foundation for capability discoverability, security posture, portability, and cleanup discipline
  - this should make future work on Watchtower, Intelligence Office, Site Content, VACS, EVS, and report-family migration more coherent instead of each lane inventing its own local worldview

### 2026-04-17 - The Pond now has a first-class control-plane surface for system awareness

- Turned the new foundation layer into a real product surface instead of leaving it as docs-only architecture
- Added `/v1/pond/landscape` in:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - the route imports `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` and returns:
    - canonical foundations
    - product surfaces
    - legacy/specialized systems
    - nested Git repo boundaries
    - trust zones
    - shared security posture
    - immediate priorities
- Added the web client contract in:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Added a new canonical Pond surface at:
  - `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx`
  - this page acts as a control-plane view over the landscape manifest with:
    - summary counts
    - shared Zero Trust / Keeper posture
    - canonical foundations
    - product surfaces
    - trust zones
    - legacy/specialized systems
    - nested repo boundaries
- Updated discoverability in:
  - `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx`
    - landing page now shows a Control Plane zone and a landscape-awareness summary card
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`
    - sidebar now includes `/system` as `Control Plane`
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
- Interpretation:
  - The Pond can now expose the broader platform landscape directly instead of relying on operators to reconstruct it from docs and repo memory alone
  - this is the first concrete product step toward a system that is aware of its own capabilities, trust boundaries, and migration targets

### 2026-04-17 - Watchtower now represents the wider platform landscape too

- Extended `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so Watchtower is no longer only a collection-health surface
- Watchtower now also loads `/v1/pond/landscape` through the shared client contract in `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Added a new landscape-aware layer inside Watchtower:
  - `Platform Constellation`
    - canonical foundations
    - product surfaces
    - legacy / specialized systems
  - `Boundary Radar`
    - trust zones
    - shared security posture
    - migration-debt chips
  - `Nested Repo Boundaries`
    - explicit Git ownership lines visible from the tower
- Interpretation:
  - Watchtower now represents more of “all the points” in the operating system, not just mirrored collection telemetry
  - this moves it closer to a true tower/control-room surface for platform awareness, security posture, migration pressure, and repo topology in addition to morning ops
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`

### 2026-04-17 - Watchtower landscape nodes now carry explicit posture and tower signals

- Upgraded the `/v1/pond/landscape` payload in `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - canonical foundations, product surfaces, and legacy/specialized systems now each emit:
    - `posture`
    - `signal`
- Current posture vocabulary:
  - `healthy`
  - `active_build`
  - `specialized_live`
  - `migration_debt`
  - `trust_hardening`
  - `external_governed`
  - `reference_only`
- Updated the shared client types in `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - platform constellation cards now show explicit posture badges
  - each node now carries a tower signal explaining why the tower is classifying it that way
  - added a posture rollup strip for:
    - healthy nodes
    - active build / hardening nodes
    - migration debt
- Interpretation:
  - Watchtower is now moving from “landscape inventory” toward “landscape state”
  - this is the first real step toward making the tower communicate what needs attention across the whole system, not just what exists
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`

### 2026-04-17 - Watchtower landscape layer now overlays live pressure on node posture

- Continued the Watchtower evolution so the system-landscape layer is not just declarative posture
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - landscape nodes now show `Live Pressure` sections with operator-facing notes
  - live badges now reflect real current state for key nodes:
    - `Data Pond` reacts to blocked closure/core-failure pressure
    - `Watchtower` reacts to open retry load / active source lanes
    - `VACS` / `EVS` stay under visible trust-hardening pressure tied to the current shared migration-debt posture
    - legacy systems keep explicit migration-debt pressure
    - PIB remains visibly protected/canonical rather than treated as generic legacy debt
- This is still only a partial live overlay, but it is now enough for the tower to distinguish:
  - what a system is supposed to be
  - what pressure that system is under right now
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower landscape nodes now include proof-backed evidence

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` again so each landscape node now emits:
  - `evidence.represented_in_pond`
  - `evidence.pond_surface_href`
  - `evidence.boundary_class`
  - `evidence.evidence_points`
- These evidence points are currently derived from:
  - actual app-path / route representation
  - trust-zone classification
  - known migration targets and repo boundaries from the manifest
- Updated shared client contracts in `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - platform constellation cards now expose:
    - in-Pond vs off-Pond evidence
    - boundary class
    - concrete evidence statements
    - route links when a Pond surface exists
- Interpretation:
  - Watchtower can now explain why it believes a node is healthy, under build pressure, or migration debt
  - this is a more inspectable and honest tower model than pure declarative status alone
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower evidence model now includes route and trust-mode checks

- Strengthened `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so landscape evidence now also emits:
  - `web_surface_live`
  - `api_surface_live`
  - `expected_zero_trust_mode`
- These checks are derived from the current canonical app/API route inventory rather than only narrative notes, so the tower can distinguish:
  - is there a live Pond page for this capability
  - is there a live API contract for this capability
  - should this capability be under human Access, machine Access, mixed Access, local-only handling, or external governed linkage
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - tower cards now display:
    - Web Surface: `Live` / `None`
    - API Surface: `Live` / `None`
    - Trust Mode
  - this makes the constellation layer more inspectable and closer to a real capability-control surface
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower now surfaces explicit representation and trust gaps

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so the landscape summary now includes:
  - `represented_in_pond_count`
  - `off_pond_count`
  - `machine_api_gap_count`
  - `human_surface_gap_count`
  - `trust_review_count`
- These are derived from the evidence model already attached to landscape nodes, so the tower now has a compact gap-oriented read instead of only per-card inspection.
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - added a gap strip inside the platform constellation section for:
    - In Pond
    - Off Pond
    - Machine API Gaps
    - Trust Review
- Interpretation:
  - Watchtower can now call out where platform representation is still incomplete instead of only showing posture and proof
  - this is a good bridge toward a future tower model where capability gaps can become explicit operational tasks
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower gap signals now carry canonical next moves

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so `/v1/pond/landscape` now returns a `gap_runbook` array in addition to raw gap counts.
- The runbook currently covers:
  - Pond representation gaps
  - machine/API contract gaps
  - human-surface gaps
  - trust-hardening review
  - nested repo boundary pressure
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - added a `Gap Runbook` section inside Platform Constellation
  - each gap card now shows:
    - current count
    - whether the lane is `Clear`, `Watch`, or `Action`
    - canonical next move text
    - direct route links back into the governed control-plane/tower surfaces
- Interpretation:
  - Watchtower is now beginning to act like a control tower instead of only a descriptive map
  - representation and trust debt are no longer just visible; they are translated into the next canonical platform move
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower nodes now carry their own exact next move

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so each landscape node's `evidence` now includes a node-specific `next_action` block with:
  - `state`
  - `title`
  - `detail`
  - `href`
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - each Platform Constellation card now renders a `Node Next Move` panel in addition to tower signal, live pressure, and evidence
  - this lets the tower say what to do with:
    - Site Content Creator specifically
    - VACS specifically
    - EVS specifically
    - PIB specifically
    - legacy migration lanes individually
- Interpretation:
  - Watchtower is becoming a true control-plane surface because category-level gap guidance now resolves into per-system operating guidance
  - the action model remains evidence-backed and attached to the same node contract instead of being split into another parallel layer
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower node guidance now reacts to live capability evidence

- Refined `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so node-level `next_action` guidance is no longer just policy-declared.
- The route now conditionally adjusts next moves based on evidence the tower already has:
  - whether the node is actually represented in The Pond
  - whether a governed web surface is live
  - whether a canonical API contract is live
  - whether the node is under `active_build`, `trust_hardening`, or `migration_debt`
- Current node-aware refinements include:
  - machine or mixed-access nodes without visible API contract are escalated as action items
  - represented human-facing nodes without web surface are escalated as action items
  - off-Pond active/governed nodes are explicitly called out as representation gaps
  - VACS, EVS, Site Content Creator, and PIB keep tailored guidance layered on top of that shared logic
- Interpretation:
  - the tower is now starting to behave like a real capability interpreter instead of a static annotated inventory
  - node guidance is evidence-backed from the same route inventory / trust model the tower already uses
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower now shows observed trust posture, not only expected trust mode

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so each landscape node now also carries:
  - `observed_zero_trust_posture`
  - `trust_alignment`
  - `trust_evidence_points`
- These are derived from actual route/auth patterns already present in the repo, not just the manifest's intended trust zone.
- Current examples:
  - Data Pond foundation reads as mixed session + service and still transitional because shared-token fallback remains in the platform layer
  - Intelligence Office, Watchtower, and Site Content read as aligned session-guarded human surfaces
  - VACS reads as service-token capable but transitional because shared-token fallback remains
  - EVS reads as mixed human + machine and under review because its observed route shape is broader than a pure machine lane
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - constellation cards now show:
    - expected Trust Mode
    - observed Trust posture
    - Trust Alignment
    - trust evidence statements
- Interpretation:
  - the tower can now compare intended Zero Trust posture against observed route/auth reality
  - this is a stronger control-plane step because trust review is now tied to concrete code-observed auth patterns instead of only architectural intent
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower now rolls trust alignment up to the summary layer

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so landscape summary now includes:
  - `trust_aligned_count`
  - `trust_transitional_count`
  - `trust_review_node_count`
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - Platform Constellation now includes a dedicated trust alignment strip:
    - Trust Aligned
    - Trust Transitional
    - Trust Review Nodes
- Interpretation:
  - the tower can now answer the high-level trust question at a glance instead of only exposing trust posture one card at a time
  - this makes expected-vs-observed Zero Trust posture part of the main operator summary rather than buried in node detail
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower now prioritizes trust work, not just counts it

- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - added a `Trust Priority Board` inside Platform Constellation
  - the board ranks the highest-pressure non-aligned nodes using current evidence such as:
    - `review` vs `transitional`
    - trust-hardening posture
    - migration-debt posture
    - missing expected machine API surface
    - missing expected human surface
    - debug-bypass review posture
    - mixed session/service complexity
- The trust strip now has an operator follow-through layer:
  - high-level aligned / transitional / review counts
  - a ranked set of the nodes that should be hardened first
- Updated:
  - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
  - `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- Interpretation:
  - Watchtower is now beginning to prioritize trust hardening work the way it already prioritizes collection and retry work
  - the tower is more actionable because platform trust debt is now ordered, not just visible
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower trust priorities now point to explicit remediation tracks

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so each node now carries a `remediation_track` with:
  - label
  - canonical doc path
  - route href when there is a relevant Pond surface
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - constellation cards now show remediation-track metadata directly
  - the Trust Priority Board now points each highlighted node at the exact cleanup/hardening track, not just the next action text
- Current examples:
  - Site Content trust review -> Zero Trust implementation checklist
  - VACS service-token hardening -> worker secret cutover track
  - EVS boundary cleanup -> EVS/BrowserStack finish-order doc
  - migration-boundary systems -> release split / boundary cleanup doc
- Interpretation:
  - the trust priority board is now tied to canonical remediation documents rather than just UI-local heuristics
  - this makes Watchtower materially closer to a real operator control plane because it can direct the next trust-hardening move into an owned track
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Remediation tracks now carry lifecycle status

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so every node remediation track now includes:
  - `status`: `open`, `active`, or `closed`
  - `status_detail`
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - constellation cards now show remediation-track lifecycle badges
  - trust-priority cards now show whether the linked hardening/cleanup track is open, in progress, or effectively closed
- Current behavior:
  - aligned lanes like PIB / Intelligence Office show closed tracks
  - transitional lanes like Data Pond core and VACS show active tracks
  - review lanes like Site Content, EVS, and repo-boundary migration systems show open tracks
- Interpretation:
  - Watchtower can now reflect not just which remediation track applies, but whether that track is still live work
  - this is the first step toward the tower auto-closing trust tracks from current evidence instead of relying on manual reclassification
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Remediation tracks now include explicit completion criteria

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so remediation tracks now also carry `completion_criteria`.
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - constellation cards now show the criteria underneath each remediation track
  - trust-priority cards also show the same criteria so `open` / `active` / `closed` is visibly backed by concrete conditions
- Current effect:
  - `closed` no longer only means “currently aligned”
  - it now points at a specific set of satisfied conditions the tower expects
  - `active` and `open` tracks show what still needs to be true before the track can close
- Interpretation:
  - Watchtower is becoming materially more rigorous as a control plane because remediation state is now explained by criteria, not just labels
  - this sets up the next phase where those criteria can become partially machine-evaluated instead of only descriptive
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower remediation criteria are now machine-evaluated

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so remediation-track criteria are now emitted as structured checks with:
  - `label`
  - `met`
  - `detail`
- Updated `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
  - constellation cards now show met/open badges for each remediation criterion
  - trust-priority cards now show the same machine-evaluated remediation state
  - both surfaces now show criteria-met counts so track progress is visible at a glance
- Current effect:
  - remediation status is no longer only narrative
  - the tower now shows which conditions are already satisfied versus which ones are still blocking trust or migration closure
  - trust guidance for Data Pond core, Site Content, VACS, EVS, PIB, and repo-boundary migration lanes is now visibly backed by current tower evidence
- Interpretation:
  - Watchtower is becoming a truer control plane because remediation closure can now be inspected condition-by-condition
  - this creates the foundation for future automatic track closure and stronger governance alerting without relying on manual memory alone
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower remediation lifecycle is now criteria-derived

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so remediation-track lifecycle status is now derived from machine-evaluated completion criteria instead of remaining separately hand-declared.
- Current behavior:
  - `closed` when all criteria are met
  - `active` when some criteria are met
  - `open` when no criteria are met
- The route now also expands `status_detail` with the live met-count summary so the control plane explains why a track is open, active, or closed from current evidence.
- Interpretation:
  - Watchtower is now materially closer to self-governing remediation logic because lifecycle state and closure criteria come from the same evidence model
  - this reduces drift between the declared hardening story and the actual platform posture the tower can see
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Trust priority ranking now uses unresolved remediation work

- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so the Trust Priority Board now ranks nodes using:
  - unmet remediation-criteria count
  - whether the remediation track is still fully open with no criteria met
  - missing expected web/API surfaces
  - trust-hardening and migration-debt posture
  - debug-bypass and mixed trust complexity
- Current effect:
  - the board is no longer mostly a posture heuristic
  - it now surfaces the nodes with the most unresolved remediation debt first
  - trust-priority notes now also state how many criteria remain open for the lane
- Interpretation:
  - Watchtower is becoming more operationally honest because ranking pressure now comes from actual unresolved closure work
  - this makes the tower better suited for hardening order and near-term execution planning
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Watchtower now rolls up shared closure blockers

- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so Platform Constellation now includes a `Closure Blockers` rollup.
- Current behavior:
  - aggregates unmet remediation criteria across all visible landscape nodes
  - ranks the most common open blocker conditions first
  - shows which nodes are currently carrying each blocker
- Current effect:
  - the tower can now answer not only “which node is most urgent” but also “which exact remediation condition is recurring across the platform”
  - this makes trust and migration cleanup easier to reason about as a systems problem instead of only a per-node problem
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Closure blockers now point to owning remediation tracks

- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so each blocker row now shows:
  - the primary remediation track most associated with that blocker
  - the governed route for that track when available
  - the owning remediation doc filename
- Current effect:
  - the tower can now move from shared blocker awareness into the exact cleanup track without extra interpretation
  - this makes the control-plane section feel more complete and reduces context-switching between blocker patterns and owning work
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Site Content trust lane hardened to governed human access

- Removed the Site Content debug-bypass path from:
  - `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/env.ts`
  - `/Users/mark/Property_Analytics/apps/api/wrangler.toml`
- Updated `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so Site Content now reads as:
  - `observed_zero_trust_posture = session_origin_guard`
  - `trust_alignment = aligned`
  - governed human-surface remediation rather than an open trust-review exception
- Updated Zero Trust docs so they record the bypass as retired instead of still pending review:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
- Current effect:
  - Site Content is no longer a special-case trust-review lane in the live code path
  - Watchtower can now treat it as a normal authenticated governed human surface
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - VACS now has a governed Pond toolbox bridge

- Added a first-class Pond bridge surface at `/Users/mark/Property_Analytics/apps/web/src/app/vacs/page.tsx`.
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx` so The Dock now includes a `VACS Bridge` card.
- Updated `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` so VACS is visible in the main Pond navigation.
- Updated `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` so the landscape now treats the VACS web bridge as the current governed surface, while `/v1/vacs/*` remains the machine contract.
- Updated `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so the control plane recognizes `/vacs` as a live Pond surface.
- Current effect:
  - VACS is now included in the Pond toolbox without pretending it is already a broad human-first application
  - the Pond has a governed bridge into VACS that makes the machine contract, trust posture, shared foundations, and next moves visible
  - Dock, sidebar, System, and Watchtower can now tell a more coherent story about where VACS lives
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - VACS machine boundary hardened to Access service-token only

- Removed VACS shared-token fallback from the canonical route path:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/env.ts`
  - `/Users/mark/Property_Analytics/apps/api/test/helpers/platform-route-env.ts`
  - `/Users/mark/Property_Analytics/apps/api/test/platform/vacs-auth.test.ts`
- Updated `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so Watchtower now reads VACS as:
  - `trust_alignment = aligned`
  - an aligned machine-access surface rather than a transitional hardening lane
- Updated Zero Trust docs so VACS is no longer described as still carrying shared-token fallback:
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- Current effect:
  - VACS now uses Access service-token auth as the canonical machine path
  - the Pond bridge and Watchtower posture now match the real route behavior
- Verified:
  - targeted VACS auth tests
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - EVS finished as a governed Pond bridge

- Finished the EVS Pond inclusion as one coherent slice:
  - `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`
- Tightened `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so Watchtower/control-plane now treat EVS as a settled governed mixed-access lane instead of an unresolved landing-zone question.
- Current effect:
  - EVS is now visible in the Pond toolbox and main navigation as a governed bridge
  - the platform explicitly treats EVS as an aligned mixed human-and-machine validation lane
  - Watchtower now pushes EVS toward workflow maturity inside that lane rather than re-deciding whether EVS belongs in the Pond
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - EVS lifecycle now records explicit orchestrator handoff

- Extended the EVS shared contract and route behavior so request lifecycle is more truthful before API-driven dispatch exists:
  - `/Users/mark/Property_Analytics/packages/shared/src/evs-schemas.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/evs-types.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/evs/repository.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
  - `/Users/mark/Property_Analytics/apps/api/test/platform/evs-lifecycle.test.ts`
- Added explicit `POST /v1/evs/requests/:requestId/handoff` support, derived request dispatch-state views, and execution-plan return on request detail.
- Current effect:
  - EVS can now distinguish `awaiting_handoff`, external handoff, active execution, and terminal result states
  - the lane no longer relies on vague queued-only state while orchestration remains external
- Verified:
  - `npx tsx --test test/platform/evs-lifecycle.test.ts test/platform/evs-auth.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`

### 2026-04-17 - EVS bridge is now a real operator workspace

- Extended the Pond EVS surface from posture-only bridge to a usable governed workspace:
  - `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Current effect:
  - operators can now load pilot EVS properties and request history from the Pond
  - the EVS bridge can create governed validation requests directly
  - the bridge can record explicit external orchestrator handoff per request
  - execution-plan preview now lives beside the request lifecycle board, so the lane is actionable without pretending dispatch is already internalized
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npx tsx --test test/platform/evs-lifecycle.test.ts test/platform/evs-auth.test.ts` in `/Users/mark/Property_Analytics/apps/api`

### 2026-04-17 - `/system` now shows the enterprise outcome map and consolidation plan

- Added machine-readable enterprise outcome governance at:
  - `/Users/mark/Property_Analytics/config/platform_outcome_map.json`
- Added companion strategy docs:
  - `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md`
  - `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md`
- Extended the control plane contract in:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Upgraded `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` into a browser-visible enterprise architecture surface with:
  - canonical outcomes
  - consolidate-now systems
  - accepted specializations
  - enterprise operating rules
- Current effect:
  - the platform’s anti-duplication model is now inspectable locally in the browser
  - consolidation planning now lives in the Pond control plane instead of only in docs
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`

### 2026-04-17 - Watchtower health route now degrades safely across partial ops schemas

- Hardened `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts` so Watchtower no longer fails the entire `/v1/health/status` response when optional operational tables or mirrored source tables are absent in a partially migrated environment.
- Added a regression in `/Users/mark/Property_Analytics/apps/api/test/platform/health-status.test.ts` covering the partial-schema case.
- Current effect:
  - Watchtower can still render with empty/default operational sections instead of showing a blanket load failure when production D1 or a mirror is missing non-core tables
  - this makes the health surface more portable across staggered schema rollout and preview/partial environments
- Verified:
  - `npx tsx --test test/platform/health-status.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh`
  - `bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh`

### 2026-04-17 - Specialty PIB-style SEO T30 proof brief added for selected properties

- Added `/Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py` as a specialty reporting sender that builds and optionally emails a PIB-style SEO proof brief for a selected property list without modifying the locked PIB renderer/template/sender files.
- Current proof scope covers requested-property alias normalization to canonical records, daily GSC T30 summaries, previous-T30 comparisons, same-date YoY comparisons when available, and proof-email artifact export to `/Users/mark/Property_Analytics/reports/seo_t30_property_brief/`.
- Explicit alias handling now maps:
  - `The Pointe at Bentonville` -> `The Pointe Bentonville`
  - `Elation` -> `Elation at Grandway West`
  - `Anatole - Daytona` -> `The Anatole`
- Current data caveat:
  - canonical GSC daily history starts on `2025-09-17`, so spring-2025 YoY for the current `2026-03-16` through `2026-04-14` T30 window is correctly rendered as unavailable rather than backfilled or inferred
- Verified:
  - `python3 /Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py --no-send`

### 2026-04-17 - Control Plane moved into admin toolbox posture and shared surface access map

- Added a shared web permission model at `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts` as the first explicit surface-access layer for Pond offerings.
- Updated `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` so Control Plane is no longer treated as a top-tier everyday navigation surface; it now sits under a `Toolbox` section and remains admin-only.
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` so Control Plane is removed from the home-page feature cards and awareness panel, which keeps the landing page focused on broad operator surfaces.
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` so non-admin users get an explicit access-restricted view instead of the full control-plane payload/UI.
- Current effect:
  - Control Plane is now visually downplayed and positioned as an admin/system-owner tool rather than a general audience landing-page feature
  - the repo now has a real shared place to start growing more granular offering-level permissions instead of relying on scattered per-page choices
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh`
  - `bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh`

### 2026-04-17 - App-facing branding now uses MarketingOps instead of WebOps

- Updated the visible app/product chrome so the active org label is now `MarketingOps` rather than `WebOps`:
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/layout.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/verify/page.tsx`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin.ts`
- Removed the redundant `Venterra WebOps` eyebrow above the main `/` Data Pond title so the landing page headline reads more cleanly.
- Current effect:
  - The Data Pond UI and auth email chrome now present a cleaner, more current `MarketingOps` identity
  - redundant brand-over-brand title treatment on the landing hero is removed
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh`
  - `bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh`

### 2026-04-17 - Home page and sidebar polished for clearer hierarchy

- Refined `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` into a more intentional front-door experience:
  - stronger hero hierarchy
  - explicit `Monitor / Browse / Ask` framing
  - more premium lane cards for Watchtower, Dock, and Fishing Hole
  - cleaner briefing shortcut treatment
- Refined `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` so:
  - top destinations read as the primary operating lanes
  - grouped sections below feel quieter and more curated
  - the navigation taxonomy is easier to scan without looking like one long report list
- Current effect:
  - the Pond front door now feels more like an intentional operator product than a page of links
  - the sidebar better distinguishes primary destinations from secondary/admin/workflow lanes
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Site Content Creator refined into a stronger Content Ops workspace

- Refined `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the Site Content surface feels more like a governed editorial workspace than a raw crawl utility:
  - added a stronger hero band with Content Ops framing and top-line posture metrics
  - upgraded crawl controls, tabs, summary cards, and inventory shells with clearer hierarchy and richer card treatment
  - added page-level mapping status chips so Specs posture is visible before drilling into section rows
  - promoted the section-mapping workspace, assessment, and rewrite panels into one clearer operating lane under each page
  - tightened the rewrite surface so governed inputs, draft status, rewrite brief, proposed copy, and save behavior read as one cohesive editorial block
- Current effect:
  - Site Content Creator is more visually aligned with the broader MarketingOps product language
  - the page now communicates the intended workflow more clearly: crawl -> map -> assess -> rewrite
  - structural and editorial signals are easier to scan without changing the governed logic underneath
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Site Content section rows refined into an editorial review board

- Tightened the section-level experience in `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so each mapping row now reads more like an editorial review board:
  - added a clearer three-part top band for expected Specs slot, live baseline, and mapping rationale
  - reframed the assessment block as an editorial diagnosis with stronger verdict language and cleaner score cards
  - reshaped the rewrite workspace into distinct control, draft, and reference zones so original copy and proposed copy are easier to compare
- Current effect:
  - individual section rows are easier to read, diagnose, and act on without feeling like stacked diagnostic widgets
  - the page now better supports editorial judgment, not just data display
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Site Content page navigation refined into a guided page board

- Refined the page-selection layer in `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the inventory no longer behaves like a flat gallery of captured pages:
  - added page-board posture summaries for rewrite priority, in-review pages, healthy pages, and Specs-gap pages
  - added page-board filters so editors can narrow the working set by operational need instead of only clicking through every page manually
  - added page-level posture badges and next-move guidance to each captured-page card
- Current effect:
  - page selection is now more editorially directed and easier to triage
  - the inventory layer better answers which pages need action first before section review begins
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-17 - Site Content interaction polish now keeps page context anchored

- Added another interaction-focused refinement to `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`:
  - each page now has a sticky context header while you work through mappings and rewrites
  - the raw extracted baseline sections are now collapsible on demand instead of always consuming vertical space
  - page-level mapping/rewrite posture stays visible while the editor works deeper in the page
- Current effect:
  - the workflow has less scroll fatigue and keeps the current page identity visible during longer editing sessions
  - raw baseline review is still available, but no longer overwhelms the governed mapping and rewrite lane by default
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Shared offering permissions foundation now drives nav and landing surfaces

- Replaced the early one-off web surface gating with a shared offering-access catalog in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`:
  - canonical offering ids, categories, audiences, visibility roles, and action roles
  - product-facing role titles (`Observer`, `Curator`, `Steward`) mapped from technical roles (`viewer`, `editor`, `admin`)
  - helpers for visible offerings, featured offerings, and offering-aware access checks
- Updated `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` and `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` to consume that shared model instead of carrying separate role rules.
- Current effect:
  - sidebar navigation and home-page featured lanes now derive from the same canonical offering matrix
  - the UI is better prepared for granular offering permissions and role-aware presentation without more duplicated access logic
  - product-facing role language is now visible in the app shell instead of exposing raw technical role names everywhere
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Offering permissions now distinguish visibility from action rights

- Extended the shared offering model in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts` so the Pond now has named action-level permissions (`view`, `draft`, `approve`, `administer`, `handoff`) in addition to page visibility.
- Added a parallel API-side capability-action helper in `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts` and wired named enforcement into:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/gbp-posts.ts`
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx` so the EVS workspace now shows permission-aware action states instead of only relying on eventual 403 responses:
  - request creation is disabled for users without EVS draft rights
  - orchestrator handoff is disabled for users without EVS handoff rights
  - the workspace explains the required product-facing role (`Observer`, `Curator`, `Steward`) when an action is unavailable
- Added regression coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/evs-lifecycle.test.ts` proving:
  - viewers cannot create EVS requests
  - viewers cannot record EVS handoff
- Current effect:
  - the Pond now has a real distinction between surface visibility and governed action rights
  - EVS and GBP Posts are using named capability-action checks instead of generic editor/admin route gates
  - the foundation is now ready for approval/administer splits on additional surfaces without another permission rewrite
- Verified:
  - `npx tsx --test test/platform/evs-lifecycle.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Steward surfaces now use the same offering permissions model end to end

- Carried the named offering-action structure through the steward-owned surfaces instead of leaving them on blanket admin gates.
- API-side route enforcement now uses `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts` for:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin.ts`
- Web-side restricted-access UX is now consistent through `/Users/mark/Property_Analytics/apps/web/src/components/shared/restricted-surface-card.tsx`, which is used by:
  - `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/site-content/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/admin/intelligence/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/admin/users/page.tsx`
- Site Content actions now also reflect named steward permissions inside the workspace itself:
  - crawl is tied to `siteContent:administer`
  - rewrite save is tied to `siteContent:draft`
- Added steward-route regression coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/offering-permissions.test.ts`.
- Current effect:
  - the Pond now has one coherent permissions structure from sidebar/home visibility through route authorization and restricted-state UX
  - steward-only surfaces explain access posture intentionally instead of silently disappearing or failing late
  - named action rights are now a durable platform capability rather than a one-off EVS refinement
- Verified:
  - `npx tsx --test test/platform/offering-permissions.test.ts test/platform/evs-lifecycle.test.ts` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Landing and Dock now present role-specific Pond experiences

- Refined the two primary entry surfaces so the Pond now feels intentionally different for Observers, Curators, and Stewards instead of only enforcing different permissions under the same presentation.
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx`:
  - role-specific hero eyebrow and summary
  - role-specific operator-flow panel copy
  - role-specific quick links in the hero
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx`:
  - cards now filter by the shared offering permissions model instead of showing the same catalog to everyone
  - Dock now carries role-specific intro framing
  - report/dashboard cards are separated from workflow/bridge cards to better match each role’s likely use
- Current effect:
  - Observers are oriented toward watching, browsing, and asking
  - Curators are oriented toward operational workflows after governed reporting context
  - Stewards keep the report lane but are clearly nudged toward stewardship and toolbox use when needed
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Watchtower and curator lanes now reflect role posture more intentionally

- Refined `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` with role-specific Watchtower posture framing so the tower reads differently for Observers, Curators, and Stewards without changing the core operational data.
- Tightened direct-entry UX for curator-only lanes:
  - `/Users/mark/Property_Analytics/apps/web/src/app/gbp-posts/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx`
- Current effect:
  - Watchtower now explains how each role should use the surface, not just what the surface contains
  - direct URLs into curator-only workspaces now show governed restricted-state UX for observers instead of falling through to backend failure patterns
  - GBP Posts and Search Intelligence now show action-level role posture more clearly inside the workspace itself
- Verified:
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Enterprise readiness program is now a first-class control-plane artifact

- Added the canonical machine-readable enterprise gap register at `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`.
- Added the durable program docs:
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_READINESS_AUDIT_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_GAP_REGISTER_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/NEXT_90_DAY_PLATFORM_PLAN_2026-04-18.md`
- Extended the Pond control plane:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx`
- Current effect:
  - `/system` now shows enterprise readiness summary, domain-by-domain maturity, priority workstreams, and the next-90-day sequence
  - the platform can now carry its own enterprise hardening program inside the product instead of leaving it trapped in disconnected planning notes
- Verified:
  - `npm run typecheck` in `/Users/mark/Property_Analytics/apps/api`
  - `npm run build` in `/Users/mark/Property_Analytics/apps/web`

### 2026-04-18 - Portfolio_Monitoring consolidation wave started by removing accidental ownership signals

- Updated `/Users/mark/Property_Analytics/Portfolio_Monitoring/README.md` so the directory now clearly declares itself `Legacy-Reusable` instead of reading like the default operational system.
- Added the explicit migration map at `/Users/mark/Property_Analytics/docs/PORTFOLIO_MONITORING_CONSOLIDATION_MAP_2026-04-18.md`.
- Updated `/Users/mark/Property_Analytics/README.md` so common issue/fix guidance points to canonical Data Collection entrypoints first instead of steering operators back to legacy Portfolio_Monitoring scripts.
- Tightened `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` notes for `portfolio_monitoring` and `portfolio_dashboard` so the control plane now says more plainly that Data Collection, Watchtower, Dock, and app-native surfaces own those default outcomes.
- Current effect:
  - the repo and control-plane narrative now reinforce the intended canonical owners
  - Portfolio_Monitoring remains visible and preserved, but it stops quietly presenting itself as the default collection and ops home

### 2026-04-18 - Portfolio_Dashboard consolidation wave started by removing accidental front-door signals

- Updated `/Users/mark/Property_Analytics/Portfolio_Dashboard/README.md` so the Streamlit dashboard now clearly declares itself `Legacy-Reusable` instead of reading like the default product shell.
- Added `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md` to define the migration path into Dock, Analysis, Watchtower, and the main app stack.
- Current effect:
  - Portfolio_Dashboard remains preserved as a reference and migration lane
  - Dock, Analysis, Watchtower, and app-native product surfaces are now reinforced as the canonical UI owners

### 2026-04-18 - Briefing family architecture is now formally defined

- Added `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md` to define the governed relationship between PIB, POP Brief, and Spotlight.
- Added `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md` to give the platform one fast map of major report families and their canonical owners.
- Updated:
  - `/Users/mark/Property_Analytics/POP_Brief/README.md`
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/README.md`
- Current effect:
  - PIB remains the protected canonical brief engine
  - POP Brief is now explicitly framed as the structured property-operations performance brief system within the same family
  - Spotlight is explicitly framed as a specialized rotating executive-attention report, not a competing canonical owner

### 2026-04-18 - Release governance is now a first-class platform standard

- Added the machine-readable release model at `/Users/mark/Property_Analytics/config/release_governance.json`.
- Extended the control plane:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx`
- Added the durable standards:
  - `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`
- Current effect:
  - `/system` now shows release governance, release gates, workstream lanes, and anti-patterns
  - the repo now has one explicit enterprise release language instead of a split between older release-shaping notes and current runtime reality

### 2026-04-18 - Service operations are now part of the Watchtower enterprise model

- Added the machine-readable service operations source at `/Users/mark/Property_Analytics/config/service_operations_manifest.json`.
- Added the durable model doc at `/Users/mark/Property_Analytics/docs/SERVICE_OPERATIONS_MODEL_2026-04-18.md`.
- Extended the control plane payload in:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- Extended Watchtower in:
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- Current effect:
  - Watchtower now shows a `Service Operations Board` with service ownership, runtime, deployment target, release lane, trust boundary, runbook, and live operating pressure
  - the platform can now reason about enterprise service posture, not only collection/source freshness and trust posture

### 2026-04-18 - Deployment provenance and environment drift are now visible in Watchtower

- Added the machine-readable provenance source at `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json`.
- Added the durable model doc at `/Users/mark/Property_Analytics/docs/DEPLOYMENT_PROVENANCE_MODEL_2026-04-18.md`.
- Extended:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- Current effect:
  - Watchtower now shows `Deployment Provenance & Drift`
  - the tower compares current web host, configured API base, observed API runtime host, and runtime Access policy against the canonical deployment model
  - real drift is now visible, and the old production-style `NEXT_PUBLIC_SITE_CONTENT_DEBUG=true` posture has been retired from `/Users/mark/Property_Analytics/apps/web/.env.production`

### 2026-04-18 - Release pedigree is now visible in Watchtower

- Added the machine-readable release pedigree source at `/Users/mark/Property_Analytics/config/release_provenance.json`.
- Added the durable model doc at `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_MODEL_2026-04-18.md`.
- Extended:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- Current effect:
  - Watchtower now shows `Release Pedigree`
  - the tower can now show the currently deployed slice, baseline commit, source branch, source mode, runtime identifiers, and explicit next moves toward clean release provenance
  - the current live posture is represented honestly as a `dirty_worktree_direct` transitional release, which is exactly the kind of truth the enterprise control plane should surface

### 2026-04-18 - Release provenance is now stampable from real git and deployment inputs

- Added the canonical local bridge script at `/Users/mark/Property_Analytics/scripts/update_release_provenance.py`.
- Added the operator runbook at `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_STAMPING_RUNBOOK_2026-04-18.md`.
- Current effect:
  - `/Users/mark/Property_Analytics/config/release_provenance.json` no longer needs to be hand-edited when the deployed Worker version or Pages runtime changes
  - the release pedigree now reflects the actual current live runtime identifiers for the API, web surface, and Watchtower control plane
  - this is still an operator-bridge step, but it is a materially better enterprise posture than stale or purely manual release records

### 2026-04-18 - Release reconcile snapshot is now generated from the actual dirty tree

- Added the canonical generator at `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py`.
- Added the model doc at `/Users/mark/Property_Analytics/docs/RELEASE_RECONCILE_SNAPSHOT_MODEL_2026-04-18.md`.
- Generated `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`.
- Current effect:
  - Watchtower can now show the current dirty-tree split by workstream lane
  - the first clean release-shaped slice is now explicit inside the control plane: `platform_app + data_collection_hardening`
  - the platform can quantify how much of the current tree is still non-primary release work instead of only describing the release problem narratively

### 2026-05-26 - Stabilization branch narrowed to release reconciliation tooling

- Created `/Users/mark/Property_Analytics` branch `codex/stabilization-foundation-2026-05-26` from `codex/release-reconcile`.
- Brought forward the May 25 release-reconcile snapshot classifier and preserved the runtime-state publishing bridge from the release branch.
- Pushed the broader organized checkpoint branch `codex/pilot-control-cwv-reporting` before narrowing the stabilization lane.
- Quarantined new local dirty work and generated artifacts in named stashes instead of mixing them into the stabilization branch.
- Attempted the broader data/platform cherry-pick lane and stopped when it proved too broad and conflicted with canonical daily collection/reporting paths; those initiatives should remain on the organized branch until reviewed as separate promotion slices.
- Current effect:
  - the stabilization branch is intentionally small and release-governance-focused
  - large data, platform, pilot, EVS, content, auth, and model-gateway initiatives remain preserved but are not promoted by default
  - the next release decision can be made from explicit lane inventory instead of a mixed dirty worktree

### 2026-05-26 - Initiative closeout ledger established

- Added `/Users/mark/Property_Analytics/docs/INITIATIVE_CLOSEOUT_LEDGER_2026-05-26.md` as the working closeout control document for the current initiative stack.
- The ledger ties the preserved `codex/pilot-control-cwv-reporting` work back to the clean stabilization branch and records each initiative's disposition, closeout test, and next action.
- Current effect:
  - future closeout work should use the ledger before opening broad branch or stash work
  - initiatives now have an explicit `Promote`, `Split`, `Park`, `Archive`, or `Delete/Ignore` decision path
  - stashes and generated artifacts are preserved but no longer treated as implicit active production work

### 2026-04-19 01:35 UTC - Release branch deployment is now blocked explicitly by Cloudflare auth health

- Added `/Users/mark/Property_Analytics/scripts/check_cloudflare_release_auth.py` as the canonical preflight for non-interactive Wrangler promotion.
- Copied `/Users/mark/Property_Analytics/utils/ksm.py` into the clean release branch worktree so release tooling can resolve Keeper secrets without depending on the dirty main workspace.
- Updated:
  - `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`
  - `/Users/mark/Property_Analytics/config/release_governance.json`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_GAP_REGISTER_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`
- Current effect:
  - the clean `codex/release-reconcile` branch is validated, committed, and pushed, but live promotion is honestly blocked because the Keeper-backed Cloudflare admin token currently fails verification with `401 Unauthorized`
  - release governance now treats Cloudflare admin token health as a first-class gate instead of letting Wrangler fail mid-promotion
  - the remaining blocker is no longer code or branch discipline; it is credential rotation/replacement for Cloudflare release operations

### 2026-04-19 03:10 UTC - Clean release promotion succeeded from codex/release-reconcile

- Verified that the Keeper-backed `Cloudflare API Token` is valid on the account-scoped Cloudflare token verify endpoint, even though the user-scoped Wrangler OAuth session had expired and the user-token verify endpoint still failed.
- Deployed the clean reconcile branch directly with explicit account-scoped auth context:
  - API from `/private/tmp/property_analytics_reconcile/apps/api`
  - Pages from `/private/tmp/property_analytics_reconcile/apps/web`
- Promoted live runtime identifiers:
  - Worker version `cf89ba18-bd69-4601-8854-eb8b937ab18c`
  - Pages runtime `ad8bbc7e`
  - Pages alias `https://codex-release-reconcile.property-analytics.pages.dev`
- Restamped:
  - `/Users/mark/Property_Analytics/config/release_provenance.json`
  - `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`
- Current effect:
  - the platform is now running from the clean `codex/release-reconcile` slice instead of only describing that branch as a future target
  - Watchtower can now show aligned live release pedigree for the reconciled branch and current runtime IDs
  - the remaining release-maturity work is now CI-issued provenance and ongoing reduction of follow-on lanes, not basic clean-branch promotion itself

### 2026-04-19 03:30 UTC - Release pedigree now carries a runtime observation overlay

- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so `release_provenance` now includes a `runtime_observation` block derived from the live request shape.
- The overlay now captures:
  - observed API origin/host
  - observed requesting web origin/host
  - inferred Pages runtime id when the current web host is a Pages runtime host
  - runtime alignment status and note
- Updated `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so `Release Pedigree` shows the live runtime overlay alongside the stamped manifest.
- Current effect:
  - Watchtower no longer relies purely on the bundled release-provenance JSON to describe the currently promoted web/API slice
  - the release pedigree remains stampable, but it is now cross-checked against the live runtime at request time
  - this reduces the “one deploy behind” problem while the platform still uses operator-bridge provenance instead of CI-issued provenance

### 2026-04-19 03:45 UTC - Release reconcile now ignores post-deploy provenance stamp noise

- Updated `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py` so runtime-stamped bridge artifacts are excluded from dirty-tree lane counting:
  - `/Users/mark/Property_Analytics/config/release_provenance.json`
  - `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`
- Updated `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_STAMPING_RUNBOOK_2026-04-18.md` to formalize that those files are operational bridge artifacts rather than meaningful feature drift.
- Current effect:
  - a clean promoted branch no longer reads as dirty just because release provenance was refreshed after deploy
  - release reconciliation is now closer to an enterprise-grade read of true workstream drift instead of operator-maintained stamp churn

### 2026-04-19 16:40 UTC - Site Content now routes story work through reusable themes

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` with a first-pass story-theme layer.
- Added reusable theme groupings for:
  - lifestyle
  - location
  - amenities
  - floor plans
  - trust
  - conversion
  - differentiation
- Current effect:
  - page-level claim routing now considers page-intent themes in addition to token overlap
  - page cards and page workspaces now expose theme chips alongside narrative focus claims
  - section rewrite workspaces now show theme-aware suggested focus rather than only raw claim text
  - rewrite brief guidance is becoming more portable and editorially legible

### 2026-04-20 08:25 UTC - Clean release branch auth bootstrap was restored for Cloudflare login

- Restored the current Cloudflare Access browser bootstrap path on the clean release branch after confirming the live error was caused by branch drift, not a Cloudflare edge failure.
- Synced the working auth implementation back into `/private/tmp/property_analytics_reconcile` for:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/app/login/login-client.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/auth-provider.tsx`
- Current effect:
  - `/v1/auth/access-bootstrap` exists again on the promoted branch
  - Cloudflare-authenticated browsers can bootstrap a first-party Data Pond session instead of falling into API `NOT_FOUND`
  - login/logout behavior is back on the intended Zero Trust path, including retry handling and explicit fallback messaging

### 2026-04-20 08:45 UTC - Site Content inventory API was restored on the clean release branch

- Investigated the live `Failed to load site content inventory` state and confirmed the web surface was healthy, but the branch was missing the Site Content admin API route stack.
- Restored the canonical Site Content API slice into `/private/tmp/property_analytics_reconcile`:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/index.ts` route mount
  - `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/shared/specs-property-marketing-v1.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/intelligence/brief-completeness.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts`
- Current effect:
  - `/v1/admin/site-content` exists again on the promoted branch
  - the Site Content Creator can load inventory data instead of failing immediately at the first API request
  - Specs bindings and brief-readiness posture are back behind the Site Content API instead of only existing in the main dirty repo

### 2026-04-19 16:20 UTC - Site Content claim routing is now page-aware and rewrite-guiding

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so unresolved governed claims are now routed more intentionally by page role and section role.
- Added:
  - page-level `Focus` claim chips in the page composition board
  - page-level narrative focus chips in the page workspace header
  - section-level `Suggested focus` blocks inside rewrite workspaces
  - role-aware rewrite-brief placeholders derived from the mapped Specs role plus the best-fit governed claim
- Current effect:
  - the storytelling layer is now more actionable at the exact page and section where rewrite work happens
  - rewrite guidance is becoming page-aware and role-aware rather than generic

### 2026-04-19 16:00 UTC - Site Content narrative gaps now point back to priority pages

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the narrative consistency layer is no longer only descriptive.
- Added a `Narrative priority pages` board that ranks the best pages to absorb unresolved story work based on:
  - homepage/story-anchor weight
  - missing expected structure
  - section assessment posture
  - rewrite-in-progress signals
  - unresolved governed claim coverage
  - property brief readiness
- Current effect:
  - the site story board now points operators toward where to work first instead of only showing which claims are weak
  - narrative consistency and page-level rewrite prioritization are now explicitly linked in the UI

### 2026-04-19 15:45 UTC - Site Content now flags cross-page narrative fragmentation

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` with a new `Narrative consistency board`.
- The board now compares governed property claims from Intelligence Office against captured page copy to estimate:
  - claims that are aligned across the site
  - claims that appear only partially
  - claims that are currently missing from the captured site narrative
- This is intentionally a first-pass derived read-model using existing claim and crawl data, not a new parallel backend system.
- Current effect:
  - Site Content can now call out where the property story is fragmented or under-supported across pages
  - the site-level storytelling layer is moving from generic posture into explicit cross-page narrative consistency review

### 2026-04-19 15:30 UTC - Site Content story board now consumes governed property signals

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so Site Content Creator now pulls:
  - property brief inputs from Intelligence Office
  - Captain's Log entries from governed memory
- The workspace now exposes those signals directly in the site story layer:
  - claim count
  - evidence count
  - brief-readiness posture and missing components
  - latest Captain entry as the lead property strategy signal
- Page composition posture now factors in property brief readiness and narrative-claim presence instead of relying only on section assessment output.
- Current effect:
  - Site Content is more clearly acting as the synthesis layer between structure, governed interpretation, and property strategy
  - storytelling review is now grounded in real property signals rather than only synthetic scoring from mapped sections

### 2026-04-19 15:05 UTC - Site Content Creator now operates as a page-and-story workspace, not just a crawl viewer

- Refined `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` into a fuller content-operations surface aligned to the new canonical model.
- The page now includes:
  - a site-level story board with harmonization and storytelling posture
  - a page composition board with per-page posture, next-move framing, and structural drift signals
  - richer page workspaces that foreground expected Specs slots, live baselines, assessment posture, and missing expected structure
  - an active rewrite workspace on each mapped section using the existing persisted rewrite API instead of leaving the page as a mostly read-only crawl view
- This brings the current promoted UI closer to the already-persisted data model:
  - Specs mapping
  - section assessment
  - rewrite workflow
- The product now reads much more like a governed content operating system and much less like a crawl report.

### 2026-04-19 14:35 UTC - Site Content canonical architecture aligned to Specs, EVS, Intelligence Office, and Property Captain

- Added the first explicit clean-branch architecture docs for Site Content and the wider content-operations system:
  - `/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md`
  - `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md`
- Locked the non-duplicative system split so future Site Content refinement does not recreate work already owned by adjacent systems:
  - Specs = intended structure and page/section contract
  - EVS / BrowserStack = observed rendered structure and experiential validation
  - Intelligence Office = governed interpretation, directives, claims, and evidence
  - Property Captain = property-specific strategic priorities and storytelling emphasis
  - Site Content Creator = live content capture, block/page/site evaluation, harmonization, and rewrite workflow
- Explicitly defined the next refinement direction for Site Content:
  - preserve block-level diagnosis
  - add page composition evaluation
  - add site-level harmonization and storytelling evaluation
  - consume shared structural and validation contracts instead of relying on duplicate local heuristics
- Updated the capability register and full system audit so the clean branch now points at one canonical content-operations model instead of scattered implied responsibilities.

### 2026-04-19 04:10 UTC - Release provenance is now moving to D1-backed runtime state

- Added migration `/Users/mark/Property_Analytics/apps/api/migrations/0022_create_runtime_release_state.sql`.
- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so `/v1/pond/landscape` prefers D1-backed `runtime_release_state` for `release_provenance` when present and falls back safely to bundled config otherwise.
- Extended `/Users/mark/Property_Analytics/scripts/update_release_provenance.py` so it can publish stamped release pedigree into D1 with `--publish-runtime-state`.
- Corrected `/Users/mark/Property_Analytics/scripts/check_cloudflare_release_auth.py` so Cloudflare release preflight now accepts both user-token and account-token verification success.
- Current effect:
  - the platform now has a real path away from bundled release-provenance artifacts toward runtime-issued state
  - account-scoped Keeper-backed Cloudflare tokens are now treated as valid by the release preflight, matching actual production promotion behavior

### 2026-04-19 04:25 UTC - Runtime release provenance is now live in D1

- Applied the new `runtime_release_state` table to the live D1 database via idempotent remote SQL after confirming the legacy migration history was not fully replay-safe in Wrangler.
- Published the current clean release pedigree into D1 under:
  - `state_key = release_provenance`
  - `source_mode = operator_bridge`
- Verified the current Cloudflare release preflight now returns:
  - `status = healthy`
  - `verification_mode = account_token`
- Current effect:
  - live Watchtower/API release pedigree can now resolve from runtime state in D1 instead of depending only on bundled config
  - release preflight now matches the actual Keeper-backed account-token path used for promotion
  - remaining enterprise cleanup is migration-history reconciliation for old app schema drift and eventual CI-issued provenance replacing the operator bridge

### 2026-04-19 05:05 UTC - Remote D1 migration ledger is reconciled back to the live schema

- Added `/Users/mark/Property_Analytics/scripts/reconcile_d1_migration_history.py` as the canonical one-time reconciliation tool for legacy D1 ledger drift.
- Added `/Users/mark/Property_Analytics/docs/D1_MIGRATION_LEDGER_RECONCILIATION_RUNBOOK_2026-04-19.md` as the operator runbook for this case.
- Verified via schema probes that the live `pop-brief-db` remote database already contained the effects of:
  - `0013_enrich_communities.sql`
  - `0014_create_pib_tables.sql`
  - `0015_create_fish_tables.sql`
  - `0016_create_ad_keyword_performance.sql`
  - `0017_create_data_freshness.sql`
  - `0018_magic_links_and_roles.sql`
  - `0021_create_phase1_platform_tables.sql`
  - `0022_create_runtime_release_state.sql`
- Applied ledger reconciliation to `d1_migrations` from the canonical Keeper-backed Cloudflare token path and verified `npx wrangler d1 migrations apply pop-brief-db --remote` now returns `No migrations to apply!`.
- Current effect:
  - remote schema truth and Wrangler migration ledger are aligned again
  - future D1 promotion can return to the normal declarative migration path
  - the release branch no longer carries unresolved legacy migration-history drift as an enterprise blocker

### 2026-04-19 05:40 UTC - Control-plane runtime state now covers deployment provenance and release reconcile boards

- Added shared runtime-state publisher `/Users/mark/Property_Analytics/scripts/runtime_state_bridge.py`.
- Extended `/Users/mark/Property_Analytics/scripts/update_release_provenance.py` so `--publish-runtime-state` now publishes both:
  - `release_provenance`
  - `deployment_provenance`
- Extended `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py` so it can publish:
  - `release_reconcile_snapshot`
- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so `/v1/pond/landscape` now prefers D1-backed runtime state for:
  - release provenance
  - deployment provenance
  - release reconcile snapshot
- Extended `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so the Deployment Provenance and Release Reconcile sections now show whether the current board is coming from bundled config or runtime D1 state.
- Verified live D1 rows now exist for:
  - `release_provenance`
  - `deployment_provenance`
  - `release_reconcile_snapshot`
- Current effect:
  - the service/deploy control plane depends less on bundled repo config and more on runtime-issued platform state
  - Watchtower can now distinguish runtime-backed versus bundled deployment/reconcile truth directly in the UI
- the remaining enterprise bridge work is to move more of this operator-issued runtime state toward CI-issued or service-native issuance over time

### 2026-04-20 10:05 UTC - Site Content moved toward a horizontal workbench model

- Refactored `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the active page now reads as a horizontal workbench instead of a fully expanded stacked audit view.
- Added page-level visual cues:
  - page preview tiles now use `spec_screenshot` when available
  - fallback page previews now render a compact structural mini-map from observed blocks
- Added a page workbench instruction band so operators can immediately understand the intended flow:
  - scan the page flow
  - open one block
  - close the story gap
- Replaced the “all sections open at once” pattern with:
  - a horizontal page-flow strip of section tiles
  - one active section drawer at a time
- Added stronger human-readable section cues:
  - location on page
  - media presence and side
  - Specs-fit state
  - rewrite state
- Current effect:
  - Site Content is materially easier to scan as a working surface
  - operators can identify where a block lives on the page and whether imagery exists before opening detailed rewrite controls
  - the product is moving from “analysis dump” toward a usable editorial workbench

### 2026-04-20 10:32 UTC - Site Content now has stronger visual orientation cues

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` again so the selected block drawer is more visually legible:
  - added an explicit page-position diagram showing where the active block sits in the page sequence
  - added a dedicated media tile with a simple visual glyph plus image-side / image-count explanation
- Current effect:
  - operators can orient themselves faster without parsing chips alone
  - the drawer now answers “where is this on the page?” and “does this section have imagery?” more directly

### 2026-04-20 10:48 UTC - Site Content page flow now reads more like a storyboard

- Extended `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` again so the page-flow tiles themselves are more visually meaningful:
  - added an `Active block` band above the page flow
  - replaced plain section tiles with wireframe-style structure previews for text, image-left, image-right, and gallery-heavy blocks
  - increased the active block contrast so the current editing target stands out immediately
- Current effect:
  - the page workbench now behaves more like a storyboard / page outline than a flat list of audit cards
  - operators can infer block shape before opening the drawer

### 2026-04-20 11:05 UTC - Site Content property switching no longer reboots the workbench

- Fixed `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the initial inventory bootstrap no longer re-runs whenever `selectedPropertyId` changes.
- Replaced the bootstrap dependency on live selection state with a ref-backed current selection read for the initial load path.
- Current effect:
  - switching properties now stays in the property-detail lane instead of retriggering the whole inventory bootstrap
  - the workbench should stop falling into redraw / reload loops when the operator selects a different property

### 2026-04-20 11:28 UTC - Site Content default view was simplified into an editorial-first workbench

- Refactored `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` again to reduce cognitive overload in the default operator path.
- Major default-view changes:
  - removed the large stack of story, contract, intelligence, and narrative analysis boards from the primary screen
  - reduced the top area to property selection, page count, brief readiness, and refresh controls
  - changed property load behavior so the first real page opens by default instead of falling back into an all-pages mode
  - simplified the page board so it reads as a page chooser, not a diagnostics wall
  - moved Specs and diagnostic detail in the section editor behind a collapsed `Show Specs and diagnostics` disclosure
- Current effect:
  - the default Site Content experience is now much closer to `choose property -> choose page -> edit block`
  - the editing surface is more progressive and editorially understandable

### 2026-04-20 12:07 UTC - Site Content block editing is now content-first instead of diagnostics-first

- Refactored `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` again after direct operator feedback that the current section view still felt like an internal analysis console.
- Main workbench changes:
  - removed repeated baseline/reference text dumps from the default editing path
  - reduced the selected-block header down to page position, media cue, and simple status
  - changed the main section workspace to a two-part editorial canvas:
    - `Current block copy`
    - `Rewrite this block`
  - moved Specs fit, rewrite state, mapping rationale, scores, and captured-baseline diagnostics behind secondary disclosures (`Show block details` and `Advanced diagnostics`)
  - removed the long copy excerpt from the page-flow tiles so they behave more like recognizable block selectors than audit cards
- Current effect:
  - Site Content now behaves much more like a human content workbench
  - operators can recognize the block, read the current copy, and rewrite it without being forced through dense system-language panels first

### 2026-04-20 13:46 UTC - Site Content no longer hard-fails when Intelligence Office guidance is unavailable

- Restored the missing clean-branch Intelligence Office admin API surface by adding:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/evs/pilot-properties.ts`
  - route mount in `/Users/mark/Property_Analytics/apps/api/src/index.ts`
- Also hardened `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so the workbench no longer fails its entire initial load when `getIntelligenceOffice()` is temporarily unavailable; inventory remains primary and governed guidance now degrades gracefully.
- Current effect:
  - Site Content can load its property/site workspace again on the clean promoted branch
  - a missing secondary guidance route no longer leaves the operator with an empty broken shell before content work begins

### 2026-04-20 14:02 UTC - Site Content preview cards now handle non-browser Specs assets correctly

- Fixed `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` so page preview cards and the page visual cue stop trying to render `figma:asset/...` Specs screenshot references as browser `<img>` URLs.
- The workbench now treats only real browser-loadable paths (`http`, `https`, or rooted asset paths) as preview images and falls back to the designed page-layout placeholder for Figma-only references.
- Current effect:
  - the page board no longer shows broken-image icons
  - content creators now see an intentional visual placeholder when a true screenshot is not available yet

### 2026-04-19 06:10 UTC - Service Operations Board now uses the same runtime-state bridge

- Extended `/Users/mark/Property_Analytics/scripts/update_release_provenance.py` so runtime publishing now also writes:
  - `runtime_release_state.state_key = service_operations`
- Extended `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` so `/v1/pond/landscape` prefers runtime D1 state for the Service Operations Board, matching the release and deployment boards.
- Extended `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` so Service Operations now labels whether it is rendering from runtime D1 state or bundled config.
- Extended `/Users/mark/Property_Analytics/apps/api/test/platform/pond-landscape-runtime-state.test.ts` to cover runtime-issued service operations state alongside the existing runtime provenance and reconcile coverage.
- Redeployed the live control plane after the runtime-state expansion:
  - Worker version `c4d33670-ebe4-4ef0-8f11-1f64ac891960`
  - Pages runtime `8d1d1846`
  - alias `https://codex-release-reconcile-nshu.property-analytics.pages.dev`
- Current effect:
  - Watchtower’s three main enterprise ops boards now share one consistent truth model: runtime D1 state first, bundled config second
  - the reconcile branch is in a cleaner handoff state for the next program phase because service, deployment, release pedigree, and reconcile posture are all aligned under the same runtime-state bridge
