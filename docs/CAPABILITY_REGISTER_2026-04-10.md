# Capability Register

Status: Draft v1  
Date: 2026-04-10  
Owner: MarketingOps / Property Analytics  
Purpose: Working planning register derived from the full system audit

## 1. How To Use This Register

This register is the planning companion to:

- [FULL_SYSTEM_AUDIT_2026-04-10.md](/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md)
- [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md)

Use it before new work to answer:

- do we already have this capability
- who should own it
- what is the canonical place to extend it
- what nearby systems should be consolidated instead of rebuilt

### Status meanings

- `Canonical` = default platform owner and preferred implementation path
- `Active` = in use and materially valuable, but not necessarily the universal default
- `Specialized` = active for a narrower audience, workflow, or pilot
- `Legacy-Reusable` = not the preferred build path, but still contains valuable logic or patterns
- `Planning` = real capability direction exists, but implementation is partial or mostly architectural/spec work

### Disposition meanings

- `Keep` = preserve and continue using as-is or with routine maintenance
- `Extend` = use this as the base for future work
- `Consolidate Into` = stop growing this in parallel and merge future work into the named canonical system
- `Reference Only` = retain as a knowledge source but do not treat as an active build target

## 2. Register

| Capability | Domain | Status | Canonical Owner | Primary Path | Key Inputs | Key Outputs | Related / Duplicate Systems | Planning Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Master property truth database | Truth / Data | Canonical | Data Pond | `/Users/mark/Property_Analytics/data/portfolio_analytics.db` | All normalized source data | Shared facts, history, report inputs, app data | Legacy local DB assumptions in older systems | Keep |
| Property registry | Truth / Metadata | Canonical | Data Pond | `/Users/mark/Property_Analytics/config/venterra_properties_official.json` | Property metadata, IDs, aliases | Canonical mapping for collectors and reports | Older registry/config variants | Keep |
| Unified data collection orchestration | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` | GA4, GSC, GBP, PSI, GTMetrix, guest cards, metadata, Cloudflare | Canonical DB writes, health status, audit artifacts, richer partial-run state tracking, shared closure-state evaluation, property-level retry queue writes for GA4/GSC/Google Ads, a canonical retry worker that can execute targeted GA4/GSC/Google Ads retries plus guest card, unit-availability, and D1 follow-up actions, corrected canonical DB/schema default resolution for scripts that instantiate `DatabaseManager()` directly, a scheduled retry-cycle wrapper that keeps the morning recovery loop running through closure, and Google Ads retry semantics that now resolve `no activity` as non-failure while keeping true API/mapping gaps queued | `Portfolio_Monitoring/collect_daily_data.py`, older Spotlight collectors | Extend |
| GA4 collection and backfills | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/` | GA4 API | Daily metrics, event facts, new-user history, transient-failure partial retry recovery, and Resi SightMap event ingestion/backfill coverage through the supplementary GA4 event collector | Legacy GA4 collection in `Portfolio_Monitoring/` and `Spotlight_Properties_Report/` | Extend |
| GSC collection and inspection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gsc_collector.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` | GSC API | Search metrics, inspection artifacts, `data_collections` run tracking, property-level retry queue writes, and targeted retry execution from the canonical retry worker | Legacy GSC scripts in `Portfolio_Monitoring/`, `Spotlight_Properties_Report/` | Extend |
| GBP collection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` | GBP APIs | GBP metrics and insights | Old GBP collectors in legacy directories | Extend |
| GTMetrix collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` | GTMetrix API | Performance metrics with pilot subset-resume, daily credit ledger, classified retry/queue-stop behavior, and persisted live rate-limit header telemetry | Pilot GTMetrix collector, older Spotlight GTMetrix flows | Extend |
| Guest card collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/guest_card_collector.py` | Guest card source exports | Guest card facts, downstream analyses | Older correlation-only workflows | Extend |
| ThirtyLines collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py` | ThirtyLines / availability feeds | Inventory / availability facts | Ad hoc inventory analyses | Extend |
| Collection monitoring and anomaly detection | Ops / Integrity | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/monitoring/` | Collection runs, validation checks | Alerts, anomaly signals, failure context, safe auto-remediation for guest-card backlog and D1 mirror recovery, clearer core-vs-specialty failure / GSC identity reporting, source-aware manual-morning freshness expectations for guest cards / BI-style feeds, a consolidated morning failure alert that now inlines registry validation findings, the first queue-ready collection-state model for same-morning recovery workflows, and a temporary guest-card suspension mode that marks the source as intentionally paused instead of leaving it as unresolved manual debt | Older alerting in `Portfolio_Monitoring/` and `utils/`; standalone registry validation mail path should stay suppressed/disabled | Extend |
| Keeper/KSM secret materialization | Ops / Platform | Active | Shared Utilities | `/Users/mark/Property_Analytics/utils/ksm.py` | Keeper records | Runtime secrets and temp files, launchd-safe fallback notation/profile injection for Cloudflare Wrangler auth, explicit `ksm` binary resolution for stripped environments, and default-UID materialization support for Google Ads config | Older direct credentials-file patterns | Extend |
| Canonical PIB property reporting | Reporting | Canonical | PIB | `/Users/mark/Property_Analytics/Property_Intelligence_Brief/` | Canonical DB, PIB pipeline inputs | PIB HTML, property views, email outputs, and an approved locked versioned v2.2.0 PIB path with a Resi SightMap Signals panel sourced from `ga4_event_facts` | PIB-style specialty outputs, legacy PIB variants | Keep |
| Search Intelligence report builder | Reporting / Search | Active | Data Pond + apps/api | `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx` plus `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts` | Communities, local search/ad warehouse tables, live SEMrush keyword pulls, competitor mappings, Keeper-backed Worker `SEMRUSH_API_KEY` | Single-property PIB-style keyword intelligence preview, HTML/Markdown/JSON artifacts, optional email delivery, main analysis-surface discoverability | Ad hoc search deep dives, local script-only keyword briefs | Extend |
| PIB web surfaces | Reporting / App | Canonical | Data Pond + PIB | `/Users/mark/Property_Analytics/apps/web/src/app/pib/` | API / canonical PIB data | Browser PIB views | Older script-only PIB consumption | Extend |
| Daily health reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py` | Canonical DB | Legacy health report artifact family; canonical scheduled summary delivery now routes through Morning Full instead of a separate overlapping email | Morning full report and some Pulse overlap | Consolidate Into Morning full report |
| Morning full report | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_morning_full_report.py` | Canonical DB, pilot/ops inputs | Canonical daily summary email/report with duplicate-send protection and legacy daily-health routing consolidation | Daily health and weekly progress family | Keep |
| Weekly progress reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_weekly_progress_report.py` | Canonical DB | Weekly leadership-style output | Spotlight and Focus adjacent audience overlap | Keep |
| CWV snapshot reporting | Reporting / Performance | Specialized | Root reporting scripts | `/Users/mark/Property_Analytics/generate_cwv_snapshot.py` | PSI / performance metrics | Portfolio CWV rankings and email | Pilot CWV program | Keep |
| GSC snapshot reporting | Reporting / Search | Specialized | Reporting scripts | `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py` | Canonical GSC data | Portfolio GSC snapshot output | Spotlight GSC reporting | Keep |
| Executive / leadership / prelaunch assessments | Reporting / Specialty | Specialized | Root assessment scripts | `/Users/mark/Property_Analytics/generate_executive_assessment.py` | Canonical DB, selected analyses | Stakeholder summaries and assessments | Ad hoc PIB-style outputs | Keep |
| Spotlight weekly reporting program | Reporting | Active | Spotlight | `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_from_db.py` | Canonical DB, monthly spotlight config | Weekly spotlight CSV and executive emails | Focus Report, older Spotlight generators | Extend |
| Spotlight archive of collectors and reports | Reporting / Historical | Legacy-Reusable | Spotlight | `/Users/mark/Property_Analytics/Spotlight_Properties_Report/Archive/` | Historical project inputs | Reusable patterns and reference logic | Newer canonical collection/report paths | Reference Only |
| Focus Report | Reporting / Executive | Specialized | Focus Report | `/Users/mark/Property_Analytics/focus_report/` | Canonical DB, curated focus list | Weekly focus dashboard email | Spotlight, Portfolio Pulse | Keep |
| Paid media workbook | Marketing / Paid Media | Specialized | Paid Media Workbook | `/Users/mark/Property_Analytics/paid_media_workbook/scripts/generate_paid_media_workbook.py` | Google Ads data, inventory context | Excel workbook for managers | Marketing app/API surfaces, dashboard ad scripts | Keep |
| Google Ads collection | Truth / Collection | Active | Legacy dashboard collector + canonical orchestration | `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_google_ads_data.py` | Google Ads API + deterministic campaign/property mapping | Campaign and keyword facts with property-subset retry support from canonical orchestration | Older paid media scripts and workbook consumers | Extend |
| Paid media app/API surfaces | Marketing / Paid Media | Active | Data Pond | `/Users/mark/Property_Analytics/apps/api/src/routes/marketing-data.ts` | Marketing imports and manual metrics | App surfaces and APIs | Workbook, dashboard scripts | Extend |
| Portfolio Pulse | Monitoring / Reporting | Legacy-Reusable | Portfolio Monitoring | `/Users/mark/Property_Analytics/Portfolio_Monitoring/generate_daily_pulse.py` | Canonical DB / historical monitoring data | Daily pulse email | Daily health, Focus Report, Spotlight | Consolidate Into Daily health + Focus + Data Collection |
| Legacy portfolio monitoring collectors | Monitoring / Collection | Legacy-Reusable | Portfolio Monitoring | `/Users/mark/Property_Analytics/Portfolio_Monitoring/` | Legacy direct source collection | Historical DB writes and monitoring scripts | Data_Collection | Consolidate Into Data Collection |
| Streamlit portfolio dashboard | Dashboard | Legacy-Reusable | Portfolio Dashboard | `/Users/mark/Property_Analytics/Portfolio_Dashboard/` | Portfolio DB and helper scripts | Interactive local dashboard | `apps/web` product surfaces | Consolidate Into apps/web |
| Google Ads exploration and CIR validation scripts | Marketing / Analysis | Legacy-Reusable | Portfolio Dashboard | `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/` | Ads exports, DB data | Diagnostics, validation, analysis artifacts | Paid media workbook, marketing API routes | Reference Only |
| Data Pond API platform | Platform | Canonical | apps/api | `/Users/mark/Property_Analytics/apps/api/src/` | Canonical DB mirror / D1 / shared contracts | Governed APIs and persistence | Legacy script-only interfaces | Extend |
| Data Pond web product platform | Platform | Canonical | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/` | Governed APIs and static/public data | Product surfaces for reporting and operations | Streamlit dashboard, standalone tracker | Extend |
| Audit log and admin controls | Platform / Governance | Active | apps/api + apps/web | `/Users/mark/Property_Analytics/apps/api/src/lib/audit.ts` | Sensitive admin actions | Audit trail and admin views | Older unmanaged admin scripts | Extend |
| Fishing Hole conversational analytics | Platform / Analytics Assistant | Active | Data Pond | `/Users/mark/Property_Analytics/apps/api/src/routes/fish.ts` | Governed data APIs and prompt policy | Conversational answers and guided links | Older GPT assistant/dashboard experiments | Extend |
| Watchtower health surface | Platform / Monitoring | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Data freshness, status signals, integrity summary from canonical monitoring tables, mirrored `data_collections` run state, day-open/day-closed collection closure hints, seven-day collection aggregates, recent per-source coverage history from real mirrored tables, recent per-source run timelines from canonical `data_collections`, and current-day unresolved retry-queue items from `collection_retry_queue` | Monitoring surface with manual-feed-aware freshness badges, expected-latest-date context, a command rail for immediate operator action with queue-aware directives, a "Today's Collection" operator panel, and a display-centric command-deck presentation with hero readouts, dial gauges, signal rails, hot-source emphasis, closure guidance, richer source pods, live auto-refresh, tower clock/last-sync readouts, a seven-day recovery tape, source-coverage drift telemetry, interactive source timeline lanes with drill-in panels, full-page source focus propagation, source-specific runbook hints, source-aware action chips, and a live retry-queue board with operator search/filter/focus controls | Legacy alert scripts and Portfolio Pulse | Extend |
| Dock operational launch surface | Platform / Operations | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx` | Product summaries and links | Handoff / launch surface | No strong duplicate | Keep |
| Intelligence Office | Governance / Content | Planning | Intelligence Office | `/Users/mark/Property_Analytics/apps/web/src/app/intelligence-office/` | Data Pond signals, guidance docs, operator instructions | Directives, structured claims + evidence registry, source-backed guidance, brief readiness | Content docs spread across repo | Extend |
| Governed multi-layer memory system | Governance / Memory | Active | Intelligence Office + apps/api | `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts` | Data Pond evidence, Intelligence Office directives, operator-authored memory entries, governed fleet mapping, audited promotions | Captain's Log, Fleet Brief, The Ledger, promotion records, durable entry lineage, authoritative-only consumer reads, fail-closed machine consumption for VACS, governed context for VACS / Site Content Creator | Hidden prompt memory, ad hoc notes, parallel truth risk | Extend |
| Cloudflare Zero Trust security architecture | Platform / Security | Active | Cloudflare + Platform Ops | `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md` | Cloudflare Access, Tunnel, WARP, Gateway, Keeper-backed secrets, app roles, service identity | Canonical access model, hostname/route classification, concrete configuration checklist, Keeper manifest, repo-side service-token-compatible route support, origin-side Cloudflare Access JWT validation for machine routes, verified live cutover for `platform` / `vacs` / `evs`, and canonical remote D1 bootstrap via `0021_create_phase1_platform_tables.sql`, `0023_seed_phase1_platform_control_plane.sql`, and `0020_create_evs_tables.sql` | Ad hoc per-app auth decisions, standalone secret handling, direct-origin exposure risk | Extend |
| Site Content Creator | Content Operations | Planning | Site Content Creator | `/Users/mark/Property_Analytics/apps/web/src/app/site-content/` | Site crawls, property-scoped Intelligence Office brief inputs, governed memory, future Specs data | Section inventory, rewrite workspace, separated memory / guidance / evidence presentation, Captain assessment surfaced as brief input | Generic site audit scripts | Extend |
| VACS content generation system | Content Operations | Planning | VACS | `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts` | Property context, guidance, support signals, governed memory | Governed content artifacts with memory kept distinct from truth and directives, fail-closed service auth, and contract-tested payload separation | Venterra AI Content Suite plans | Extend |
| Content operations architecture and contracts | Governance / Planning | Planning | Docs + platform plans | `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md` | Architectural planning | Shared model and implementation direction | Venterra AI Content Suite | Keep |
| Specs integration model | Governance / Structural | Planning | External Specs + local docs | `/Users/mark/VenterraDev/Specs` | Governed page specs | Structural contracts and section maps | Site audit heuristics | Extend |
| Generic site audit framework | Site Governance / Analysis | Specialized | scripts/site_audit | `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py` | Live page crawls | Site audit HTML/XLSX and checks | Site Content Creator, pilot harmonization | Consolidate Into Site Content Creator + Specs-aware work |
| Pilot site harmonization evidence | Site Governance / Pilot | Specialized | Pilot documentation + outputs | `/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md` | Live pilot pages and inspections | Harmonization evidence and gap framing | Generic site audit framework | Extend |
| Pilot vs control CWV program | Pilot Monitoring | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/` plus `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh` | PSI, GTMetrix, BI exports, guest cards | Daily pilot/control matrix, diagnostics, exports, email, stage-aware morning failure alerts, and launchd-safe homepage-evidence execution with explicit Node path handling | Portfolio-wide CWV snapshot | Extend |
| Pilot roundup reporting | Pilot Monitoring | Specialized | pilot_roundup | `/Users/mark/Property_Analytics/pilot_roundup/` | Pilot KPI and QA signals plus matched sister/control cohort signals | Daily roundup HTML/Markdown artifacts with pilot-primary plus sister/control secondary KPI rows, paired pilot+sister performance cards, and scheduled pilot mailers controlled by `PILOT_SUMMARY_EMAILS_ENABLED`; pilot failure handling is not yet fully unified with the central morning failure alert | Morning report and tracker surfaces | Keep |
| Pilot tracker in main web app | Pilot Monitoring / App | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/tracker/` | Pilot KPI snapshots | Integrated tracker views | Standalone pilot tracker | Extend |
| Standalone pilot tracker site | Pilot Monitoring / App | Active | pilot-tracker-standalone | `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/` | Pilot KPI snapshots | Standalone tracker deployment | Main web tracker | Consolidate Into Main web tracker over time |
| Pilot diagnostic package generation | Pilot Monitoring / Diagnostics | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/generate_pilot_diagnostic_package.py` | Cross-source pilot evidence | Diagnostic package and email preview | Pilot roundup, tracker | Keep |
| BI export normalization and missing-metric audits | Pilot Monitoring / Data Quality | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/` | BI dashboard exports | Snapshot history, audits, normalized series | Tracker packaging scripts | Keep |
| Cloudflare cache audit | Performance / Platform Ops | Active | Data Collection + ops/cloudflare | `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py` | Cloudflare API + GraphQL | JSON, CSV, Markdown, HTML audit outputs | None with same maturity | Extend |
| Cloudflare full-page cache rollout tooling | Performance / Platform Ops | Active | ops/cloudflare | `/Users/mark/Property_Analytics/ops/cloudflare/` | Cloudflare auth and pilot config | Cache rules changes, purge, verification | None with same maturity | Keep |
| EVS experiential validation service | Validation / QA | Specialized | EVS + apps/api | `/Users/mark/Property_Analytics/evs/` | BrowserStack, pilot property profiles, API requests | Staging-first validation requests and results | Ad hoc screenshot-based testing | Extend |
| BrowserStack orchestration and ops | Validation / QA | Specialized | EVS + ops/browserstack | `/Users/mark/Property_Analytics/ops/browserstack/` | BrowserStack credentials, profile definitions | Validation execution support | Standalone screenshots and manual checks | Extend |
| Resi comparison engine | Specialty Diagnostics | Specialized | Root resi scripts | `/Users/mark/Property_Analytics/resi_phase2_CORRECTED.py` | Canonical DB, matched-pair logic | Comparative HTML and analysis outputs | Resi diagnostic briefs | Keep |
| Resi performance diagnostic briefs | Specialty Diagnostics | Specialized | `resi_performance_diagnostic` | `/Users/mark/Property_Analytics/resi_performance_diagnostic/scripts/generate_resi_diagnostic_brief.py` | Resi performance signals | Diagnostic brief outputs | Resi comparison engine | Keep |
| Resi legacy experience comparison | Specialty Diagnostics | Legacy-Reusable | `resi_vs_legacy_*` | `/Users/mark/Property_Analytics/resi_vs_legacy_experience/` | Comparative research inputs | Exploratory reports | Resi comparison engine | Reference Only |
| Ad hoc analytics report pattern library | Specialty Analysis | Legacy-Reusable | AdHoc + reports/adhoc | `/Users/mark/Property_Analytics/AdHoc_Reports/` | Varied one-off data pulls | Specialty reports and reusable analysis patterns | Specialty reporting scripts | Keep |
| Venterra AI Content Suite planning workspace | Content / Planning | Planning | VACS planning | `/Users/mark/Property_Analytics/Venterra_AI_Content_Suite/` | Stakeholder inputs, specs, decisions | Future content system definition | VACS route + content operations docs | Consolidate Into Content operations planning stack |

## 3. Immediate Consolidation Priorities

### Priority 1

Consolidate collection ownership around:

- `Data_Collection/`

Treat these as secondary/reference for new collection work:

- `Portfolio_Monitoring/`
- legacy `Spotlight_Properties_Report` collectors

### Priority 2

Consolidate modern product surfaces around:

- `apps/api`
- `apps/web`

Treat these as legacy UI/reference paths:

- `Portfolio_Dashboard/`
- `apps/pilot-tracker-standalone/` over time

### Priority 3

Consolidate site evaluation and rewrite direction around:

- Intelligence Office
- Site Content Creator
- Specs-connected structure

Fold in rather than parallel-build:

- generic site audit scripts
- harmonization heuristics that live only in docs or pilot notes

### Priority 4

Consolidate report-family discoverability across:

- PIB
- Daily Health / Morning Full / Weekly Progress
- Spotlight
- Focus Report
- pilot roundups and specialty brief families

This likely needs a separate “report family map” so stakeholders can quickly see what each report is for.

## 4. Before-We-Build Checklist

Before starting any new capability, answer:

1. Is there already a row in this register for it or something close to it?
2. If yes, should we extend that system instead of starting a parallel one?
3. If not, which domain should own it?
4. What canonical inputs should it use?
5. What existing reports, scripts, or routes can be reused?

## 5. Recommended Next Documents

The next high-value documents to create from this register are:

- a report family map
- a system retirement / archive candidate list
- a platform roadmap grouped by canonical owner
- a branch split / release shaping map for large parallel workstreams, with the pilot CWV / tracker / roundup stream now isolated on `codex/pilot-cwv-roundup`
