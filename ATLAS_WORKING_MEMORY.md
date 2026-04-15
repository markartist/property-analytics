# ATLAS WORKING MEMORY
**Last Updated:** 2026-04-14 20:10 UTC  
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
- Guest card harvest is now temporarily suspended by default via `GUEST_CARD_HARVEST_SUSPENDED=1`; the collector records the source as intentionally paused, the retry worker resolves guest-card queue items as suspended, closure logic excludes the source from unresolved core work, and Morning Full shows the lane as paused instead of stale
- `apps/api/src/lib/service-auth.ts` is now type-safe around Cloudflare Access cert JWK `kid` handling, which clears the API-side TypeScript issue that was blocking cleaner release verification
- Follow-up branch note: `/private/tmp/property_analytics_pilot_split` on `codex/pilot-cwv-roundup` is now the isolated pilot CWV / tracker / roundup worktree, intended to carry pilot-specific wrappers, tracker surfaces, diagnostic/report scripts, and pilot ops docs without re-contaminating the production release candidate
- The canonical launch role model is now documented in `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`: technical keys remain `viewer`, `editor`, and `admin`, while product-facing titles are `Observer`, `Curator`, and `Steward`
- The preferred workforce SSO model is now explicitly documented as Microsoft Entra ID -> Cloudflare Access -> Data Pond role mapping, with canonical cohort names `Data Pond Observers`, `Data Pond Curators`, and `Data Pond Stewards`
- The dedicated workforce identity setup doc is now `/Users/mark/Property_Analytics/docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md`, which defines the group model, Access app mapping, launch assignment guidance, and phased setup sequence for internal SSO
- `apps/api/src/lib/service-auth.ts` now supports origin-side validation of Cloudflare Access JWT assertions for machine routes using the team cert endpoint, so `platform`, `vacs`, and `evs` can authenticate through Access service-token apps after Cloudflare consumes the raw client id/secret at the edge
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
- **Repo-observed hardening item:** `DEBUG_SITE_CONTENT_IPS` and the `x-debug-site-content` bypass path should be treated as controlled-development-only and reviewed before broader production exposure
- **Current service-identity inputs in app layer:** `PLATFORM_SHARED_TOKEN`, `VACS_SHARED_TOKEN`, and `EVS_SHARED_TOKEN` exist today and should be reconciled with the Keeper + Cloudflare service-token model

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
  - `DEBUG_SITE_CONTENT_IPS` and `x-debug-site-content` bypass logic should be treated as controlled-development-only and reviewed before broader production exposure
- Captured current app-layer service identity inputs for follow-up:
  - `PLATFORM_SHARED_TOKEN`
  - `VACS_SHARED_TOKEN`
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
- Tightened the temporary site-content debug bypass:
  - bypass now requires explicit `DEBUG_SITE_CONTENT_BYPASS_ENABLED=true`
  - production `wrangler.toml` now defaults that flag to `"false"`
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
