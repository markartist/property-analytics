# Full System Audit

Status: Draft v1  
Date: 2026-04-10  
Owner: MarketingOps / Property Analytics  
Scope: Repository-wide audit of capabilities, systems, workflows, and adjacent assets currently present in `/Users/mark/Property_Analytics`

## 1. Why This Audit Exists

This audit is meant to answer a practical planning question:

- what do we already have
- what is active vs legacy vs speculative
- where we have duplicated effort
- which systems are canonical
- which assets are easy to forget because they live outside the main platform narrative

This document is intentionally broader than [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md).

That catalog maps the intended platform shape.

This audit maps the actual repository reality.

## 2. Audit Method

This review used:

- repo structure review across top-level directories
- READMEs and operating docs in major subsystems
- app/API route inventory in `apps/api` and `apps/web`
- script inventory across Python and shell entrypoints
- architecture memory in [ATLAS_WORKING_MEMORY.md](/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md)
- current capability docs such as [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md), [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md), [INTELLIGENCE_OFFICE_MODEL.md](/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md), and [SITE_CONTENT_CREATOR_MODEL.md](/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md)

Important note:

- this is a capability and system audit, not a line-by-line code review
- presence in the repo does not automatically mean production maturity
- several directories contain multiple generations of similar workflows

## 3. Executive Summary

The repository contains much more than one reporting stack.

At minimum, the current codebase holds:

- a canonical data platform centered on `data/portfolio_analytics.db`
- a unified data collection system in `Data_Collection/`
- a locked canonical PIB system
- legacy but still informative daily monitoring and portfolio dashboard systems
- a production-oriented Cloudflare cache audit and rollout workflow
- a growing Data Pond / web app / API platform in `apps/api` and `apps/web`
- a new control-plane visibility layer in The Pond that can surface the broader system landscape instead of only polished end-user product pages
- a Watchtower layer that is starting to translate platform-awareness gaps into explicit canonical next moves instead of only showing descriptive inventory
- a Watchtower control-plane model where node-level surfaces can now carry their own operating guidance instead of only category-level warnings
- a Watchtower remediation model where trust and migration tracks now expose machine-evaluated met/open criteria instead of only descriptive status text
- a Watchtower health route that now degrades safely across partial mirrored schemas, so the control plane stays visible even when optional ops tables are not yet present in a given environment
- an Intelligence Office / Site Content Creator / VACS planning and early-product layer
- a full pilot monitoring program with KPI tracker, CWV comparison, exports, and daily roundups
- an EVS / BrowserStack experiential validation system with a governed Pond bridge and explicit mixed human-and-machine lane posture
- multiple specialized reporting products: Spotlight, Focus Report, Weekly Progress, Daily Health, Morning Full Report, Paid Media Workbook, Resi diagnostics, site audits, and GSC/PSI snapshots
- a now-explicit Cloudflare Zero Trust security architecture direction that pairs Cloudflare as the outer trust boundary with Keeper as the secret authority and app-level roles as the business authorization layer, with live service-token cutover now verified for `platform`, `vacs`, and `evs`, plus Data Pond session bootstrap from Cloudflare Access identity for human browsers, preserved browser handoff across both `app.venterradev.com` and `app.venterraliving.com`, and least-privilege auto-provisioning so Zero Trust can act as the primary browser admission gate

The most important planning truth is this:

- we do not have a lack of capabilities
- we have a capability discoverability, consolidation, and canonical-ownership problem

Foundation note added on 2026-04-17:

- the new repo-level bridge between architectural intent and actual cleanup/migration work now lives in `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md`
- the machine-readable companion inventory is `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
- together they define the working model for canonical systems, trust zones, nested repo boundaries, and the capabilities that still need governed visibility inside The Pond
- the enterprise anti-duplication layer now also lives in:
  - `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md`
  - `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md`
  - `/Users/mark/Property_Analytics/config/platform_outcome_map.json`
- `/system` now surfaces that outcome architecture directly in the browser so consolidation planning is visible inside the platform itself, not only in docs
- `/system` is now intentionally being repositioned as an admin/toolbox lane rather than a featured general-audience landing-page surface, which is also the first concrete step toward offering-level permissions across the Pond
- the web app now also has a shared offering-permissions foundation in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, which centralizes role-aware surface visibility, featured-lane selection, audience labeling, and future offering/action-level permission expansion instead of scattering those rules across individual pages

Operational note added on 2026-04-14:

- the current dirty worktree is best understood as several coherent workstreams stacked together rather than random churn
- the branch split and release-shaping map now lives in `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`
- production promotion should come from the clean `codex/release-reconcile` path, while pilot CWV, Intelligence Office / Site Content, Zero Trust / SSO, and EVS work should be separated into follow-up branches

## 4. Canonical Foundations

### 4.1 Master Database

Canonical data store:

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

Observed role:

- shared source of truth for collectors
- shared read model for reporting products
- base layer for newer Data Pond / app platform work

Known consumers called out across repo/docs:

- PIB
- Spotlight
- Daily Health
- Weekly Progress
- Focus Report
- CWV snapshot and portfolio health reports
- pilot monitoring exports and roundups
- app/API ingestion and mirror workflows

### 4.2 Property Registry

Canonical registry:

- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

Observed role:

- canonical property metadata and ID mapping
- shared dependency for collectors, reports, matching, and app views

### 4.3 Shared Utilities and Guardrails

High-value shared foundations:

- `utils/` for email, validation, config, KSM, reporting helpers
- `Data_Collection/db/database_manager.py`
- `Data_Collection/utils/data_quality_validator.py`
- Keeper/KSM documentation and secret mapping
- PIB guardrails in [AGENTS.md](/Users/mark/Property_Analytics/AGENTS.md)

## 5. Capability Inventory By Domain

### 5.1 Data Collection and Normalization

Primary canonical system:

- `Data_Collection/`

Current capabilities present:

- GA4 collection
- GSC collection
- GBP collection
- GTMetrix collection
- guest card collection
- ThirtyLines collection
- Cloudflare cache audit collection
- orchestration of daily master collection
- collection monitoring and alerting
- anomaly detection and credential monitoring
- backfills for GA4 new users and channel new users
- GSC URL inspection collection
- CWV history backfill

Most important entrypoints:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/collect_gsc_url_inspection.py`

Audit judgment:

- this is one of the clearest canonical cores in the repo
- it should remain the default collection layer unless there is a deliberate exception

### 5.2 Reporting and Operational Intelligence

Current reporting capability families include:

- Property Intelligence Brief
- Search Intelligence report builder
- specialty PIB-style SEO T30 property proof briefs
- Portfolio Pulse / daily monitoring
- Daily Health reports
- Morning Full portfolio report
- Weekly Progress reports
- Spotlight Properties report
- Focus Report
- CWV snapshot
- GSC snapshot
- property assessments and executive/leadership/prelaunch assessments
- PIB-style and roundup outputs for specialized use cases

Representative scripts:

- `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py`
- `/Users/mark/Property_Analytics/generate_morning_full_report.py`
- `/Users/mark/Property_Analytics/generate_weekly_progress_report.py`
- `/Users/mark/Property_Analytics/send_daily_health_report.py`
- `/Users/mark/Property_Analytics/send_morning_full_report.py`
- `/Users/mark/Property_Analytics/send_weekly_progress_report.py`
- `/Users/mark/Property_Analytics/focus_report/scripts/generate_focus_report.py`
- `/Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py`
- `/Users/mark/Property_Analytics/scripts/generate_portfolio_psi_pib_report.py`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py`
- `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`

Audit judgment:

- reporting is one of the strongest and most mature capability areas
- there are several separate report brands with overlapping data access and rendering patterns
- the daily summary lane is now intentionally consolidating around Morning Full as the canonical scheduled email, with legacy daily-health delivery routed into that single path and duplicate-send protection on summary subjects
- specialty pilot roundups and export notifications have had active policy churn; wrapper defaults must be verified in code before assuming whether pilot informational email is suppressed or enabled

Monitoring note:

- `/watchtower` now serves as more than a freshness matrix
- it also functions as a compact operator-facing integrity surface for:
  - core vs specialty collection failure counts
  - freshness warning / stale source counts
  - top active integrity issues from canonical monitoring tables
  - source-aware freshness expectations for manual morning feeds such as guest cards, so weekend and pre-8 AM windows do not register as false stale conditions
- morning failure alerting is also consolidating around:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- registry validation findings now belong inside that central failure email instead of generating their own separate standalone validator alert
- the legacy standalone registry validation LaunchAgent should remain disabled unless there is an explicit reason to restore a separate mail path
- Keeper migration on the live operations stack is now tighter than the earlier draft implied:
  - the D1 mirror path is no longer dependent on shell-exported `KSM_*` vars alone, because the Wrangler helper now injects the canonical Cloudflare token notation/profile defaults for launchd execution
  - parent collection/retry/alert orchestrators now pass that hardened runtime env into `d1_mirror_sync.py`
  - the live Google Ads collector now materializes its API config from Keeper by default instead of depending on the legacy checked-out `google-ads.yaml` path
- Google Ads collection also now better matches the actual account operating model:
  - zero-row daily results are treated as `no activity` rather than automatic failure
  - only mapping gaps and true API failures stay in the retry queue
  - this matters because the current manager-account setup does not reliably produce daily rows for every mapped property, even when attribution is otherwise correct
- Google Ads collection now also degrades more honestly when Keeper/bootstrap is the problem:
  - the collector raises a typed bootstrap failure instead of exiting the whole runtime blindly
  - canonical collection/retry orchestration can record the run as blocked and keep source-level retry intent visible
- the morning retry loop now closes a major orchestration gap for Google Ads:
  - a source-level `google_ads` retry item can trigger a full Ads collection pass when no same-day Ads run record exists yet
  - that prevents the system from leaving Google Ads in a permanent `missing/no_run_recorded` state after the first pass fails to create a run
- launchd collection and retry wrappers now explicitly export the Keeper home/profile context needed for Google Ads collection instead of relying on ambient shell state
- the same closure/bookkeeping problem is now fixed for other source-level retries too:
  - successful `unit_availability` and `d1_mirror` retry actions write/close same-day collection rows
  - closure and Watchtower can now move those sources out of `missing` once the retry worker actually recovers them
- prelaunch/non-live registry entries now affect the canonical collection path rather than only alert rendering:
  - GSC collection, GSC URL inspection, and GSC retry handling suppress those communities while they remain marked `lifecycle: prelaunch`
  - this removes false operational debt for not-yet-launched sites such as `The Vine Kyle Parkway` and `Sundara at Spring Cypress`
- Guest cards are currently in an explicit temporary suspension posture rather than an accidental stale/manual-dependency posture:
  - this posture was reversed on 2026-04-15
  - canonical guest card ingest is active again and advanced local guest-card freshness to 2026-04-15
  - the OneDrive drop remains the shared landing zone for both guest card CSVs and pilot BI / Measurement workbooks
  - pilot BI snapshot ingestion is now caught up through 2026-04-15 from that same shared directory, but the Measurement workbook itself still lags upstream and only exposes daily sheets through 4.11.26
  - the post-ingest real D1 mirror also succeeded again on 2026-04-15, and same-day closure now evaluates `complete` with no open retry debt after guest card, Ads, unit availability, and D1 bookkeeping are written honestly into `data_collections`
  - BI harvest is no longer manual-only: the canonical morning collector now ingests pending `BI-Metrics-RunYYYYMMDD.xlsx` files from the shared drop, and the retry cycle re-checks for late-arriving BI workbooks later in the morning using the same shared helper logic
- `/watchtower` has now started growing into a live daily collection console as well:
  - the API returns a `daily_collection_status` block derived from canonical `data_collections`
  - the web surface shows a "Today's Collection" panel with source-level status, progress counts, retries, rate-limit hits, timing, and current operator context
  - the web surface is now intentionally display-centric rather than table-first:
    - hero tower-state readouts
    - dial gauges for coverage, closure, freshness, and integrity pressure
    - a visual source signal rail and hot-source emphasis
    - richer collection source pods and closure-context panels
    - live auto-refresh, a tower clock / last-sync display, and small motion charts that make the operator surface feel active rather than static
    - a seven-day recovery tape and source-coverage drift section backed by actual history returned from the canonical health route
    - a live retry-queue board backed by unresolved items from `collection_retry_queue`, so the UI can show exactly what work is still in circulation
    - operator controls on that queue board for search, scope filtering, and a focus mode that promotes the riskiest open work
    - a command rail at the top of the page that compresses immediate action, manual waits, hard blocks, and closure state into one fast-read strip, now with queue-aware directives instead of raw counts alone
    - source timeline lanes that show recent per-collector run states and completion percentages across the collection window
    - interactive drill-in behavior on those lanes so operators can select a source and immediately inspect current progress, queue load, live notes, and recent retry signal
    - source-focus propagation so selecting a lane can reorient tower heat, issue surfaces, freshness cards, coverage drift, and queue interpretation around that source
    - source-specific runbook hints in the drill-in panel so Watchtower can suggest likely remediation and escalation paths for GA4, GSC, Google Ads, guest cards, unit availability, and D1 mirror
    - source-aware action chips in the drill-in panel that translate those runbook hints into concise suggested next moves
  - the web surface also exposes whether the day appears open or closed from the mirrored operational state
  - the retry queue and closure-state worker now exist as the primary morning control-loop foundation
  - targeted retry execution is now live for GA4, GSC, and Google Ads, while source-level follow-up exists for guest cards, unit availability, and D1 mirror
  - the retry cycle is now actually scheduled on the machine through a dedicated LaunchAgent and wrapper, rather than existing only as an on-demand worker
  - historical retry debt is no longer left open indefinitely: the retry worker now archives unresolved past-date queue items as exhausted reconciliation debt, which keeps old days from masquerading as active live incidents
  - closure semantics now distinguish current-day operational states from past-date governance states: historical dates outside the retry window evaluate as `archived`, and closure payloads now include advisory-source status for non-core lanes such as BI, Measurement, PSI, GSC URL inspection, SEMrush, GBP, and Cloudflare cache audit
  - Watchtower now consumes that richer closure structure directly: unresolved sources are shown with reason labels rather than flattened strings, closure badges distinguish `archived` and `blocked`, and a dedicated advisory-governance panel exposes non-core lane coverage without pretending those lanes are part of the narrow morning hard-stop contract
  - the newer platform-constellation layer is also becoming actionable rather than purely descriptive:
    - it can now show explicit representation/trust gap counts
    - and it carries a canonical gap runbook for off-Pond capabilities, machine/API gaps, human-surface gaps, trust-hardening review, and nested repo pressure
    - it now also attaches a node-specific next move to each landscape card, which makes the tower more like an actual control plane than a static catalog
    - that node guidance is now partially evidence-driven from live route/trust/representation signals rather than remaining a purely declarative annotation layer
    - it now distinguishes expected trust mode from observed trust posture, which lets the tower show where auth reality still lags the intended Zero Trust model
    - and that trust comparison now rolls up into aligned / transitional / review summary counts so the control plane can answer platform trust posture at a glance
    - the tower now also prioritizes trust work by ranking the most important review/transitional nodes instead of leaving trust debt as an unprioritized list
    - that ranking is now driven by unmet remediation criteria and stalled closure, not only broad posture tags
    - the tower can now also roll up recurring closure blockers across the platform, which makes shared trust/migration debt visible as a systems pattern rather than only as isolated node cards
    - those shared blocker rows now point back to the primary owning remediation track, so the control plane can route from recurring pattern to governed cleanup path directly
    - those priority nodes now point to explicit remediation tracks, which ties the control-plane signal back to the actual cleanup/hardening documents we expect the team to follow
    - remediation tracks now also carry lifecycle state, and that lifecycle is now derived from the same machine-evaluated criteria the tower shows on each node
    - remediation state is now backed by explicit completion criteria, which makes the control plane more rigorous than a simple label-and-link model
    - those remediation criteria are now machine-evaluated from current node evidence, so the tower can show what is already satisfied versus what still blocks closure
- pilot morning wrapper hardening also matters operationally:
  - the workflow can now survive the previously observed homepage-audit bootstrap path because canonical DB defaults were corrected and the homepage audit collector now passes the canonical DB path explicitly
  - pilot bootstrap failure alerts now identify the active stage more truthfully instead of making the pipeline tail `tee` command look like the root cause

### 5.3 Canonical PIB

Canonical PIB area:

- `Property_Intelligence_Brief/`

Locked canonical files:

- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py`

Capabilities present around PIB:

- canonical property intelligence generation
- approved locked versioned PIB v2.2.0 with SightMap metrics for Resi properties
- email sending
- portfolio launch metric watch
- ads intelligence brief
- validation utilities
- historical variant templates and versions
- large archive of rendered property outputs and payloads

Audit judgment:

- PIB is not just a report; it is a long-lived product family with strong institutional value
- the repo also contains many PIB-adjacent experiments and derivative renderings, so guardrails matter

### 5.4 Legacy Monitoring and Dashboard Systems

Legacy but still capability-rich systems:

- `Portfolio_Monitoring/`
- `Portfolio_Dashboard/`

Capabilities still visible here:

- daily collection wrappers and scheduled jobs
- portfolio pulse email generation
- older alerting, anomaly, and review workflows
- GA4/GSC/GBP exploration and audits
- Streamlit dashboard with portfolio overview, property deep dive, comparison, trends, insights, and settings
- Google Ads exploration and CIR validation work

Audit judgment:

- these directories contain real, still-useful logic and institutional knowledge
- they also contain legacy duplication that should not be mistaken for the preferred modern path

Planning note:

- treat them as capability archives plus selective reusable utilities, not as the default place to build new canonical systems

### 5.5 Data Pond / App Platform

Modern app platform areas:

- `apps/api`
- `apps/web`
- `packages/shared`

Observed API capability surfaces:

- auth and admin
- PIB routes
- metrics and marketing data
- GSC and exports
- communities
- GBP posts
- Fishing Hole conversational analytics
- EVS endpoints
- platform phase 1 routes
- VACS route

Additional governed memory capability now present in the app platform:

- a governed multi-layer memory service embedded in `apps/api` and surfaced through the existing Intelligence Office UI in `apps/web`
- explicit property-to-fleet-to-ledger promotion workflow with governed fleet targeting, durable entry lineage, audit logging, and identity bindings
- consumer-facing reads now default to authoritative states only, with broader status access limited to explicit admin/debug paths
- consumption hooks for downstream governed tools such as VACS and Site Content Creator so execution systems can read memory without redefining truth, with VACS now treated as a fail-closed service-auth surface, contract tests proving payload separation, and Site Content Creator using property-scoped brief inputs while presenting memory separately from guidance and source evidence
- analysis and pond routes
- audit logging and role-aware access control

Observed web product surfaces:

- `/pib`
- `/pib/property`
- `/watchtower`
- `/dock`
- `/fish`
- `/analysis`
- `/analysis/pib`
- `/analysis/gsc`
- `/gsc`
- `/marketing`
- `/communities`
- `/gbp-posts`
- `/intelligence-office`
- `/site-content`
- `/tracker/*`
- `/admin/intelligence`
- `/admin/users`
- login and verification flows

Audit judgment:

- this is now a major capability area, not an experiment
- the repo contains a real transition from script-first reporting toward a governed product platform

### 5.6 Intelligence Office / Content Operations / Site Governance

Current capability cluster spans:

- Intelligence Office
- Site Content Creator
- VACS
- Specs integration planning
- content governance docs and contracts

Evidence in repo:

- [INTELLIGENCE_OFFICE_MODEL.md](/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md)
- [SITE_CONTENT_CREATOR_MODEL.md](/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md)
- [CONTENT_OPERATIONS_MODEL.md](/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md)
- [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md)
- web surfaces for `/intelligence-office` and `/site-content`
- API routes for `admin-intelligence`, `admin-site-content`, and `vacs`
- `data/Intelligence/` as the document/evidence base

Capabilities present or partly present:

- governed directives
- approved claims and source-backed guidance
- structured claims + evidence registry with claim-evidence linking and brief readiness scoring
- migration tooling from legacy `approved_points` into structured claims
- content/search governance overlays
- site copy inventory and rewrite workspace concepts
- property-aware content generation direction
- Captain assessment inputs surfaced as a first-class brief signal in Site Content Creator
- future shared contracts between content systems

Audit judgment:

- this is strategically important and easy to under-credit because some of it is still documentation- or route-level
- this area should be treated as a real capability program with partial implementation, not as “just docs”
- VACS current-state reporting should be explicit rather than aspirational:
  - VACS is a real platform system
  - the VACS API is implemented and protected under Cloudflare Zero Trust
  - The Pond now includes a governed `/vacs` bridge surface so VACS is discoverable in the toolbox without pretending the API-first lane is already a full human-first app
  - the canonical VACS route now expects Access service-token auth without VACS shared-token fallback, so its machine boundary is materially cleaner than earlier transitional drafts
  - the architecture defines `vacs.venterradev.com` as the intended standalone product surface
  - the repository does not yet prove that separate frontend host is deployed

### 5.7 Pilot Monitoring and CWV Program

Large pilot capability area:

- `pilot_control_cwv/`
- `pilot_roundup/`
- `apps/pilot-tracker-standalone/`
- `apps/web/src/app/tracker/*`

Capabilities present:

- pilot vs control PSI collection
- pilot vs control GTMetrix collection
- pilot/control CWV report generation and emailing
- pilot KPI tracker data packaging and visualization
- dashboard snapshot export
- BI snapshot ingestion and normalization
- missing metric audits
- homepage evidence collection
- diagnostic package generation
- diagnostic email previews
- comparator audits
- daily roundup generation
- standalone pilot tracker site
- mirrored tracker inside main web app

Representative entrypoints:

- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/run_pilot_control_cwv_daily.py`
- `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/README.md`

Audit judgment:

- this is a major sub-platform in its own right
- it includes data collection, exports, dashboards, diagnostics, and communication layers
- it is one of the easiest places to forget how much has already been built

### 5.8 Cloudflare Cache Observability and Rollout

Current capabilities present:

- daily Cloudflare cache audit
- GraphQL analytics query support
- HTML/CSV/JSON/Markdown artifact generation
- full-page cache rollout tooling
- cache purge/auth utilities
- workday runbooks and rollout plan docs

Primary files:

- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/`
- [CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md)
- [CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md)

Audit judgment:

- this is now an operational capability, not just an investigation

### 5.9 Experience Validation Service (EVS)

Current EVS system areas:

- `evs/`
- `apps/api/src/evs/`
- `apps/api/src/routes/evs.ts`
- `packages/shared/src/evs-*`
- `.github/workflows/evs-browserstack-experiential.yml`
- `ops/browserstack/`

Capabilities present:

- pilot property registry for experiential testing
- BrowserStack-backed validation model
- profile-based test definitions
- API request intake and persistence design
- result normalization
- weekly/manual/post-deploy trigger model
- staging-first execution pattern

Audit judgment:

- EVS is a real platform capability with a clear shape, even if full orchestration maturity is still in progress
- it belongs in planning alongside monitoring and reporting, not in a side note
- it now has a first-class governed Pond bridge, which is the right inclusion model while execution remains specialized
- request lifecycle maturity has improved: EVS can now persist request intent, expose execution plans, record external orchestrator handoff, and ingest normalized results without pretending API-dispatch is already live
- the Pond EVS surface is now a real operator workspace rather than a static posture page: operators can launch governed requests, review lifecycle state, and record external orchestration handoff inside the main platform

### 5.10 Spotlight Properties Program

Area:

- `Spotlight_Properties_Report/`

Capabilities present:

- weekly spotlight reporting from canonical DB
- monthly property rotation config
- executive summary emailing
- property registry-safe name resolution
- GSC and SEMrush specialty reporting
- single-property reports
- GBP access and exploration tooling
- large archive of prior collector and export patterns

Audit judgment:

- Spotlight is both an active product and a deep archive of reusable analytics/reporting logic

### 5.11 Focus Report

Area:

- `focus_report/`

Capabilities present:

- curated executive status board for focus properties
- deterministic red/yellow/green property statusing
- weekly HTML email workflow
- hotlist email support
- comparison/showcase generator

Audit judgment:

- compact but distinct reporting product
- useful because it solves a different audience problem than Spotlight or Portfolio Pulse

### 5.12 Paid Media and Marketing Operations

Capabilities present across repo:

- paid media workbook generation
- Google Ads ingestion and D1 migration support
- campaign analysis scripts
- asset editor and URL lookup generation
- ad color update and migration planning docs
- marketing and leasing metrics app surfaces

Primary areas:

- `paid_media_workbook/`
- `Portfolio_Dashboard/scripts/collect_google_ads_data.py`
- `apps/api/src/routes/marketing*.ts`
- `apps/web/src/app/marketing/`
- `apps/web/src/components/metrics/`

Audit judgment:

- paid media capability is meaningful and easy to overlook because it is spread across workbook, dashboard, API, and planning docs

### 5.13 Resi / Comparative Analysis / Diagnostics

Capabilities present:

- Resi vs portfolio comparison engine
- resi performance diagnostics
- legacy experience comparisons
- exploratory briefs and matched-pair analysis

Primary areas:

- `resi_phase2_CORRECTED.py`
- `generate_resi_comparison_report.py`
- `resi_performance_diagnostic/`
- `resi_vs_legacy_comparison/`
- `resi_vs_legacy_experience/`

Audit judgment:

- this is a strong analytical specialty area even if it is not part of the main app narrative

### 5.14 Site Audit and Harmonization

Capabilities present:

- generic portfolio site audit generation
- site crawler and checks framework
- pilot site harmonization and evidence docs
- GSC inspection exports
- section/page inventory direction

Primary areas:

- `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py`
- `/Users/mark/Property_Analytics/scripts/site_audit/`
- [PILOT_SITE_CONTRACT_HARMONIZATION.md](/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md)
- `/Users/mark/Property_Analytics/outputs/pilot_live_gsc_url_inspection_2026-04-08.json`

Audit judgment:

- this capability sits between reporting, governance, and content operations
- it should likely be grouped formally under Site Content Creator / Specs-connected work

### 5.15 Ad Hoc and Specialty Analyses

Examples present in repo:

- quiet building discovery and deep dive
- listing consistency tests
- guest card correlation outputs
- GSC month-over-month and weekly organic new users exports
- SEM/SEO T60 audits
- portfolio PSI PIB-style reports
- executive and leadership assessments

Primary areas:

- `AdHoc_Reports/`
- `reports/adhoc/`
- `scripts/audit_sem_seo_t60.py`
- `scripts/generate_gsc_mom_pib_report.py`
- `scripts/generate_pilot_organic_new_users_wow_report.py`

Audit judgment:

- these are not noise
- they are evidence of reusable analysis patterns and stakeholder-specific product ideas

### 5.16 Spec-Only or Planning-Only Programs

Important areas that are present but not yet full production systems:

- `Venterra_AI_Content_Suite/`
- major portions of the contract bundle docs under `docs/contracts/`
- some phase-1 platform architecture and enablement work

Audit judgment:

- these still matter because they encode intended future capabilities and already capture design work we do not want to redo

## 6. Status Model

### 6.1 Clearly Active / Canonical

- master DB + registry
- `Data_Collection/`
- canonical PIB pipeline
- Spotlight DB-based workflow
- major report generators at repo root
- Cloudflare cache audit
- main app/API platform in `apps/api` and `apps/web`

### 6.2 Active but Specialized

- pilot CWV / KPI / roundup systems
- EVS / BrowserStack validation
- Focus Report
- paid media workbook
- Resi comparison and diagnostics
- site audit workflows

### 6.3 Legacy but Valuable

- `Portfolio_Monitoring/`
- `Portfolio_Dashboard/`
- older collectors inside `Spotlight_Properties_Report/Archive/`
- PIB historical variants and templates

### 6.4 Spec / Planning / Early Product

- `Venterra_AI_Content_Suite/`
- some content operations and phase-1 contract systems
- some Intelligence Office / Site Content / VACS work where documentation maturity currently exceeds implementation maturity

## 7. Where We Are Duplicated or Fragmented

The repo shows repeated capability families in multiple generations.

Most obvious overlap zones:

- data collection logic across `Data_Collection/`, `Portfolio_Monitoring/`, and older Spotlight code
- reporting and email rendering patterns across PIB, health reports, snapshots, roundups, and specialty audits
- pilot tracker logic duplicated between `apps/web` and `apps/pilot-tracker-standalone`
- app-platform narrative split between older script/report systems and newer Data Pond/API/web surfaces
- content/governance concepts described in several docs but only partly unified in product code
- paid media logic spread across workbook, dashboard scripts, and app routes

This is likely why capabilities get forgotten and then rebuilt.

## 8. What We Definitely Do Not Want To Forget

High-value capabilities that are easy to undercount:

- Cloudflare cache observability and rollout tooling
- EVS / BrowserStack experiential validation
- pilot KPI tracker and diagnostic package generation
- site audit / harmonization groundwork
- Intelligence Office and Site Content Creator foundation work
- paid media workbook and Google Ads utilities
- Resi comparison and diagnostic frameworks
- Focus Report as a distinct executive reporting product
- Spotlight archive as a reusable analytics pattern library

## 9. Planning Recommendations

### Recommendation 1: Adopt a Canonical Capability Register

Create one maintained register with columns like:

- capability name
- canonical owner
- status
- primary path
- entrypoint
- data inputs
- outputs
- duplicate/related systems
- keep / consolidate / retire recommendation

This audit can be the seed document for that register.

### Recommendation 2: Separate “Active Canonical” From “Legacy Reusable”

Do not flatten everything into one bucket.

We should explicitly label:

- canonical
- active specialized
- legacy but reusable
- archived / reference only
- planning only

### Recommendation 3: Consolidate Around Domains, Not Historical Directories

Suggested planning buckets:

- Truth and Collection
- Reporting and Communications
- App Platform and Data Pond
- Content Operations and Governance
- Pilot Monitoring
- Experience Validation
- Marketing / Paid Media
- Specialty Diagnostics

### Recommendation 4: Build a “Before We Build” Checklist

For future work, require one quick check:

- does this already exist in some form
- is there a canonical owner already
- is there a reusable report, collector, route, or artifact pattern
- are we extending a real system or starting a parallel one

## 10. Best Current Companion Docs

Use this audit together with:

- [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md)
- [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md)
- [CAPABILITIES_INVENTORY_2026-01-23.md](/Users/mark/Property_Analytics/CAPABILITIES_INVENTORY_2026-01-23.md)
- [ATLAS_WORKING_MEMORY.md](/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md)
- [docs/README.md](/Users/mark/Property_Analytics/docs/README.md)

## 11. Bottom Line

The repo already contains a substantial operating platform.

The real opportunity is not inventing more from scratch.

The opportunity is:

- remembering what exists
- naming canonical owners
- consolidating overlaps
- promoting hidden strengths into the main system model

That should be the planning lens for the next phase.

Additional current-state note:

- The active Data Pond web and API layers now carry a shared offering-permissions foundation, with visibility and named action rights separated for canonical offerings. The web catalog lives in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, the API-side action enforcement lives in `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`, and EVS/GBP Posts are the first lanes using named capability actions instead of only generic editor/admin route gates.
- That permissions model now also governs the steward-owned surfaces end to end: Site Content, Intelligence Office, Admin, and Control Plane use the same offering vocabulary for page visibility, route enforcement, and restricted-surface UX instead of a mix of hidden navigation, blanket admin middleware, and late 403 responses.
- The landing and Dock surfaces are now beginning to express that same model visually, so role differences are not only enforced in the background; Observers, Curators, and Stewards now get different framing and recommended motion through the Pond’s primary entry surfaces.
- Watchtower and the curator-heavy operator lanes are now moving in the same direction, with role-specific posture framing and direct-entry restricted states replacing the previous pattern of “hidden in nav but abrupt if opened directly.”
- the control plane now also carries an explicit enterprise-readiness layer sourced from:
  - `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_READINESS_AUDIT_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_GAP_REGISTER_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/NEXT_90_DAY_PLATFORM_PLAN_2026-04-18.md`
- `/system` can now show:
  - enterprise readiness summary
  - maturity by domain
  - named priority workstreams
  - next-90-day sequence
- that matters because the platform is now self-aware not only about inventory, trust posture, and migration debt, but also about the remaining enterprise-hardening program itself
- the first active consolidation wave has now also begun in the repo narrative itself:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/README.md` now declares the directory `Legacy-Reusable`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_MONITORING_CONSOLIDATION_MAP_2026-04-18.md` defines the migration path from Portfolio_Monitoring into Data Collection, Watchtower, and Dock
  - `/Users/mark/Property_Analytics/README.md` now points issue remediation toward canonical Data Collection entrypoints before falling back to legacy Portfolio_Monitoring repair tools
- that is an important enterprise step because it reduces accidental ownership in the repo’s own operator guidance, not just in planning docs
- the same consolidation treatment now also applies to `Portfolio_Dashboard`:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/README.md` now declares it `Legacy-Reusable`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md` defines the migration path into Dock, Analysis, Watchtower, and the main app shell
- that matters because the enterprise problem is not only duplicate logic; it is also duplicate entry surfaces and duplicate product ownership signals
- the briefing family is now also formally organized:
  - `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md`
- the governed enterprise posture is now:
  - PIB = protected canonical brief engine
  - POP Brief = structured operations performance brief system
  - Spotlight = specialized rotating executive-attention report
- that matters because the repo no longer has to infer the relationship between these systems from scattered context; the family model is now explicit and compatible with PIB guardrails
- release discipline is now also being normalized into the control plane:
  - `/Users/mark/Property_Analytics/config/release_governance.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`
- `/system` now carries:
  - canonical release path
  - release gates
  - workstream release lanes
  - release anti-patterns
- that matters because enterprise maturity here depends as much on promotion discipline as on system design
- Watchtower now also carries a formal service-operations layer sourced from:
  - `/Users/mark/Property_Analytics/config/service_operations_manifest.json`
  - `/Users/mark/Property_Analytics/docs/SERVICE_OPERATIONS_MODEL_2026-04-18.md`
- that layer makes service ownership, runtime, deployment target, release lane, trust boundary, runbook, and live operating pressure visible inside the platform instead of leaving them split across docs and operator memory
- Watchtower now also carries a deployment provenance and drift layer sourced from:
  - `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json`
  - `/Users/mark/Property_Analytics/docs/DEPLOYMENT_PROVENANCE_MODEL_2026-04-18.md`
- that layer compares:
  - current browser host
  - configured API base
  - observed API runtime host
  - current Access runtime policy
  against the canonical environment model so release and environment drift become visible in the control plane
- Watchtower now also carries a release pedigree layer sourced from:
  - `/Users/mark/Property_Analytics/config/release_provenance.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_MODEL_2026-04-18.md`
- that layer makes the deployed slice itself visible:
  - source branch
  - baseline commit
  - source mode
  - runtime identifiers
  - deploy URLs
- that matters because enterprise release maturity depends not only on “what should be deployed” but on “what actually is deployed and how it got there”
- the release pedigree model now also has a canonical operator bridge:
  - `/Users/mark/Property_Analytics/scripts/update_release_provenance.py`
  - `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_STAMPING_RUNBOOK_2026-04-18.md`
- the clean-branch release path is now no longer theoretical:
  - `codex/release-reconcile` has been promoted live to Cloudflare Workers + Pages
  - current live release pedigree should now resolve to Worker version `cf89ba18-bd69-4601-8854-eb8b937ab18c` and Pages runtime `ad8bbc7e`
- that matters because the enterprise release model is now proven in operation, not only documented in planning artifacts
- release pedigree is now also partially runtime-managed:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts` overlays the stamped release manifest with the currently observed API host, requesting web host, and inferred Pages runtime id
  - `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` presents that runtime observation in the Release Pedigree board
- that matters because the control plane is now less dependent on a bundled static provenance file and can cross-check the live promoted surface against the stamped release record at request time
- runtime release provenance now also has a persistence bridge in D1:
  - migration `0022_create_runtime_release_state.sql`
  - `scripts/update_release_provenance.py --publish-runtime-state`
- that matters because Watchtower can now be moved toward runtime-issued release state instead of depending only on repo-bundled config artifacts
- the current live bridge is now active:
  - `runtime_release_state.state_key = release_provenance` has been published in the live D1 environment
  - `/v1/pond/landscape` prefers that runtime state when present
- that matters because live release pedigree is now beginning to move from repo-state truth to platform-state truth
- the runtime control-plane bridge now also covers:
  - `runtime_release_state.state_key = deployment_provenance`
  - `runtime_release_state.state_key = release_reconcile_snapshot`
  - `/v1/pond/landscape` now prefers those runtime rows when present instead of defaulting immediately to bundled config
  - Watchtower now labels whether the deployment and reconcile boards are coming from bundled config or runtime D1 state
- that matters because the enterprise control plane is moving away from repo-bundled operational truth and toward platform-issued runtime truth, even before full CI-native provenance exists
- D1 migration-history drift on the live `pop-brief-db` environment is now explicitly governed instead of being an operator-only known issue:
  - `/Users/mark/Property_Analytics/scripts/reconcile_d1_migration_history.py` probes remote schema before reconciling missing `d1_migrations` rows
  - `/Users/mark/Property_Analytics/docs/D1_MIGRATION_LEDGER_RECONCILIATION_RUNBOOK_2026-04-19.md` defines the safe dry-run/apply/verify path
  - the live ledger has been reconciled so Wrangler no longer reports the already-present 0013/0014/0015/0016/0017/0018/0021/0022 schema migrations as pending
- that matters because the platform can now return to a normal declarative Wrangler migration posture instead of carrying unresolved remote-schema drift as a hidden release exception
- release reconciliation also now ignores post-deploy provenance bridge artifacts when reading branch cleanliness:
  - `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py` excludes `config/release_provenance.json` and `config/release_reconcile_snapshot.json` from dirty-tree lane counts
- that matters because a successfully promoted clean branch should not immediately look dirty only because the operator bridge restamped deployment pedigree after release
- that matters because the current platform is still between ad hoc operator-led deploys and fully issued CI provenance; this bridge reduces stale pedigree drift immediately while preserving the path toward true automation
- the platform now also has a generated release-reconcile snapshot:
  - `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py`
  - `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_RECONCILE_SNAPSHOT_MODEL_2026-04-18.md`
- that matters because the control plane can now quantify the dirty-tree split and show the first clean release-shaped slice directly, instead of treating release reconciliation as only a prose planning concern
- release promotion now also has a canonical auth-health preflight:
  - `/Users/mark/Property_Analytics/scripts/check_cloudflare_release_auth.py`
- that matters because the current Keeper-backed Cloudflare admin token has drifted into an invalid state, and the platform now treats that as an explicit release blocker instead of only discovering it mid-Wrangler deploy
