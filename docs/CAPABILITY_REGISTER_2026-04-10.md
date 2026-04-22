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
| Unified data collection orchestration | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` | GA4, GSC, GBP, PSI, GTMetrix, guest cards, BI workbooks, metadata, Cloudflare | Canonical DB writes, health status, audit artifacts, richer partial-run state tracking, shared closure-state evaluation, property-level retry queue writes for GA4/GSC/Google Ads, source-level retry handling for guest cards / BI workbooks / unit availability / D1, corrected canonical DB/schema default resolution for scripts that instantiate `DatabaseManager()` directly, a scheduled retry-cycle wrapper that keeps the morning recovery loop running through closure, Google Ads retry semantics that resolve `no activity` as non-failure while keeping true API/mapping gaps queued, source-level Google Ads recovery when the day has no Ads run record yet, source-level completion bookkeeping for unit availability / D1 so closure reflects successful retries honestly, and corrected PSI completion accounting so desktop-only rows no longer count as full CWV/mobile success in `data_collections` | `Portfolio_Monitoring/collect_daily_data.py`, older Spotlight collectors | Extend |
| GA4 collection and backfills | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/` | GA4 API | Daily metrics, event facts, new-user history, transient-failure partial retry recovery, and Resi SightMap event ingestion/backfill coverage through the supplementary GA4 event collector | Legacy GA4 collection in `Portfolio_Monitoring/` and `Spotlight_Properties_Report/` | Extend |
| GSC collection and inspection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gsc_collector.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` | GSC API | Search metrics, inspection artifacts, `data_collections` run tracking, property-level retry queue writes, targeted retry execution from the canonical retry worker, and registry-driven suppression of prelaunch/non-live communities from canonical reporting lanes | Legacy GSC scripts in `Portfolio_Monitoring/`, `Spotlight_Properties_Report/` | Extend |
| GBP collection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` | GBP APIs | GBP metrics and insights | Old GBP collectors in legacy directories | Extend |
| GTMetrix collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` | GTMetrix API | Performance metrics with pilot subset-resume, daily credit ledger, classified retry/queue-stop behavior, and persisted live rate-limit header telemetry | Pilot GTMetrix collector, older Spotlight GTMetrix flows | Extend |
| Guest card collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/guest_card_collector.py` | Guest card source exports | Guest card facts, downstream analyses, resumed active ingest from the shared OneDrive drop, and archive-aware recovery of pending CSVs when files are restored to the live folder | Older correlation-only workflows | Extend |
| ThirtyLines collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py` | ThirtyLines / availability feeds | Inventory / availability facts | Ad hoc inventory analyses | Extend |
| Collection monitoring and anomaly detection | Ops / Integrity | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/monitoring/` | Collection runs, validation checks | Alerts, anomaly signals, failure context, safe auto-remediation for guest-card backlog and D1 mirror recovery, clearer core-vs-specialty failure / GSC identity reporting, source-aware manual-morning freshness expectations for guest cards / BI-style feeds, a consolidated morning failure alert that now inlines registry validation findings, the first queue-ready collection-state model for same-morning recovery workflows, reversible guest-card suspension controls, closure-state reporting that can now fully close same-day source-level recoveries for Google Ads, guest cards, unit availability, and D1, automatic archival of stale historical retry debt, advisory-source visibility for non-core governance lanes, an explicit cadence-aware advisory governance model for Watchtower instead of a same-day-run-only heuristic, a shared advisory cadence policy now consumed by Watchtower, Python closure, and morning alerting, aligned monitoring for GBP reviews / insights after repairing canonical collector initialization and `data_collections` bookkeeping, a canonical GBP mapping layer that now honors manual property overrides, suppresses duplicate property rows in live collection runs, normalizes the source mapping file / generator counts to the true 91-property portfolio shape, is mirrored into the main remaining local `Portfolio_Monitoring` GBP utilities to reduce legacy drift, now sits on a package-safe `Portfolio_Monitoring` import path instead of brittle `sys.path`-only legacy behavior, has the highest-value legacy runner scripts migrated to package-safe import patterns, no longer lets the cleaned legacy GSC backfill helpers kick off live work merely by being imported, now extends that same safer import/run discipline across the main review-analysis, email/report, and test/debug local scripts as well, keeps Watchtower `/v1/health/status` resilient when optional mirrored ops tables are absent so the control plane degrades gracefully across partial environments instead of failing closed, and now protects D1 health evaluation from same-day rerun noise by preferring a successful same-day mirror over a later failed auth-only rerun | Older alerting in `Portfolio_Monitoring/` and `utils/`; standalone registry validation mail path should stay suppressed/disabled | Extend |
| Keeper/KSM secret materialization | Ops / Platform | Active | Shared Utilities | `/Users/mark/Property_Analytics/utils/ksm.py` | Keeper records | Runtime secrets and temp files, launchd-safe fallback notation/profile injection for Cloudflare Wrangler auth, explicit `ksm` binary resolution for stripped environments, default-UID materialization support for Google Ads config, and typed bootstrap-failure surfacing so orchestrators can record blocked states instead of hard-aborting | Older direct credentials-file patterns | Extend |
| Canonical PIB property reporting | Reporting | Canonical | PIB | `/Users/mark/Property_Analytics/Property_Intelligence_Brief/` | Canonical DB, PIB pipeline inputs | PIB HTML, property views, email outputs, and an approved locked versioned v2.2.0 PIB path with a Resi SightMap Signals panel sourced from `ga4_event_facts` | PIB-style specialty outputs, legacy PIB variants | Keep |
| Search Intelligence report builder | Reporting / Search | Active | Data Pond + apps/api | `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx` plus `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts` and specialty search-report scripts under `/Users/mark/Property_Analytics/scripts/` | Communities, local search/ad warehouse tables, live SEMrush keyword pulls, competitor mappings, canonical GSC daily metrics, canonical GA4 organic traffic facts, targeted selected-property GSC backfill support, Keeper-backed Worker `SEMRUSH_API_KEY` | Single-property PIB-style keyword intelligence preview, selected-property PIB-style SEO proof briefs for rolling or explicit date windows, PIB-style daily copy-change impact briefs, HTML/Markdown/JSON/CSV artifacts, optional email delivery, and narrow canonical GSC historical repair for selected windows | Ad hoc search deep dives, local script-only keyword briefs | Extend |
| PIB web surfaces | Reporting / App | Canonical | Data Pond + PIB | `/Users/mark/Property_Analytics/apps/web/src/app/pib/` | API / canonical PIB data | Browser PIB views | Older script-only PIB consumption | Extend |
| Daily health reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py` | Canonical DB | Legacy health report artifact family; canonical scheduled summary delivery now routes through Morning Full instead of a separate overlapping email | Morning full report and some Pulse overlap | Consolidate Into Morning full report |
| Morning full report | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_morning_full_report.py` | Canonical DB, pilot/ops inputs | Canonical daily summary email/report with duplicate-send protection and legacy daily-health routing consolidation | Daily health and weekly progress family | Keep |
| Weekly progress reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_weekly_progress_report.py` | Canonical DB | Weekly leadership-style output | Spotlight and Focus adjacent audience overlap | Keep |
| CWV snapshot reporting | Reporting / Performance | Specialized | Root reporting scripts | `/Users/mark/Property_Analytics/generate_cwv_snapshot.py` plus `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py` | PSI / performance metrics | Portfolio CWV rankings and email, plus selected-property mobile PSI / CWV T30 briefs with Excel attachment delivery, shorthand-to-canonical property mapping, explicit stale-date exceptions when a property's latest PSI lags the portfolio report date, and a simplified default layout documented in `/Users/mark/Property_Analytics/reports/selected_cwv_t30/README.md` | Pilot CWV program | Keep |
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
| Data Pond web product platform | Platform | Canonical | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/` | Governed APIs, static/public data, and the landscape manifest surfaced through `/v1/pond/landscape` | Product surfaces for reporting and operations, now including a first-class `/system` control-plane view for canonical foundations, trust zones, nested repo boundaries, and migration targets, plus a shared surface-access model so high-sensitivity offerings can be positioned as toolbox/admin surfaces instead of universal home-page features | Streamlit dashboard, standalone tracker | Extend |
| Audit log and admin controls | Platform / Governance | Active | apps/api + apps/web | `/Users/mark/Property_Analytics/apps/api/src/lib/audit.ts` | Sensitive admin actions | Audit trail and admin views | Older unmanaged admin scripts | Extend |
| Fishing Hole conversational analytics | Platform / Analytics Assistant | Active | Data Pond | `/Users/mark/Property_Analytics/apps/api/src/routes/fish.ts` | Governed data APIs and prompt policy | Conversational answers and guided links | Older GPT assistant/dashboard experiments | Extend |
| Watchtower health surface | Platform / Monitoring | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Data freshness, status signals, integrity summary from canonical monitoring tables, mirrored `data_collections` run state, day-open/day-closed collection closure hints, seven-day collection aggregates, recent per-source coverage history from real mirrored tables, recent per-source run timelines from canonical `data_collections`, current-day unresolved retry-queue items from `collection_retry_queue`, structured closure/advisory-source payloads from the health route, and the machine-readable landscape manifest from `/v1/pond/landscape` with explicit node postures, signals, evidence points, derived representation-gap counts, a canonical gap runbook, node-specific next-action guidance, condition-aware refinement based on route presence / Pond representation / expected trust mode, observed trust posture evidence derived from live auth/route contracts, summary-level trust alignment counts, ranked trust-priority heuristics now weighted by unresolved remediation work, a cross-platform closure-blocker rollup, blocker-to-track ownership mapping, explicit remediation-track metadata, criteria-derived remediation lifecycle state, and machine-evaluated remediation criteria | Monitoring surface with manual-feed-aware freshness badges, expected-latest-date context, a command rail for immediate operator action with queue-aware directives, a "Today's Collection" operator panel, and a display-centric command-deck presentation with hero readouts, dial gauges, signal rails, hot-source emphasis, closure guidance, richer source pods, live auto-refresh, tower clock/last-sync readouts, a seven-day recovery tape, source-coverage drift telemetry, interactive source timeline lanes with drill-in panels, full-page source focus propagation, source-specific runbook hints, source-aware action chips, a live retry-queue board with operator search/filter/focus controls, advisory-governance visibility for non-core lanes, a broader platform constellation / trust-zone / nested-repo view, posture-aware system signals such as healthy, active build, migration debt, trust hardening, and governed external linkage, concrete proof points like Pond representation, boundary class, surface evidence, route presence, expected Zero Trust mode, observed trust posture, and trust-alignment state, plus explicit gap reads and canonical next moves for off-Pond capabilities, machine API gaps, human-surface gaps, trust-review load, nested repo pressure, exact per-node operating guidance inside the constellation cards, condition-aware escalation when a node is missing the web/API surface or trust alignment it is expected to have, a top-level trust strip showing aligned vs transitional vs review posture across the landscape, a trust-priority board that now orders the most important hardening targets by unmet remediation criteria and stalled closure pressure, a closure-blockers board that shows the most common unmet remediation conditions across the landscape and points back to the main owning track, direct remediation tracks pointing to the owning cleanup/hardening docs, lifecycle state that now derives from live per-criterion evidence, and per-criterion met/open evidence so track closure is inspectable rather than only described | Legacy alert scripts and Portfolio Pulse | Extend |
| Dock operational launch surface | Platform / Operations | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx` | Product summaries and links | Handoff / launch surface | No strong duplicate | Keep |
| Intelligence Office | Governance / Content | Planning | Intelligence Office | `/Users/mark/Property_Analytics/apps/web/src/app/intelligence-office/` | Data Pond signals, guidance docs, operator instructions | Directives, structured claims + evidence registry, source-backed guidance, brief readiness, and legacy approved-point migration into governed claims | Content docs spread across repo | Extend |
| Governed multi-layer memory system | Governance / Memory | Active | Intelligence Office + apps/api | `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts` | Data Pond evidence, Intelligence Office directives, operator-authored memory entries, governed fleet mapping, audited promotions | Captain's Log, Fleet Brief, The Ledger, promotion records, durable entry lineage, authoritative-only consumer reads, fail-closed machine consumption for VACS, governed context for VACS / Site Content Creator | Hidden prompt memory, ad hoc notes, parallel truth risk | Extend |
| Cloudflare Zero Trust security architecture | Platform / Security | Active | Cloudflare + Platform Ops | `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md` | Cloudflare Access, Tunnel, WARP, Gateway, Keeper-backed secrets, app roles, service identity | Canonical access model, hostname/route classification, concrete configuration checklist, Keeper manifest, repo-side service-token-compatible route support, origin-side Cloudflare Access JWT validation for machine routes, verified live cutover for `platform` / `vacs` / `evs`, Cloudflare Access-to-Data Pond session bootstrap on `/v1/auth/me` for human browsers, browser-safe multi-origin handoff for both `app.venterradev.com` and `app.venterraliving.com`, least-privilege auto-provisioning of Access-approved browser identities into app roles, and canonical remote D1 bootstrap via `0021_create_phase1_platform_tables.sql`, `0023_seed_phase1_platform_control_plane.sql`, and `0020_create_evs_tables.sql` | Ad hoc per-app auth decisions, standalone secret handling, direct-origin exposure risk | Extend |
| Unified system foundation and landscape manifest | Platform / Governance | Active | Docs + Platform | `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md` plus `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Capability register, full audit, platform catalog, repo topology, trust-boundary posture, nested repo map | Human-readable foundation model plus machine-readable inventory for canonical systems, product surfaces, trust zones, repo boundaries, and migration priorities so The Pond and adjacent work can become aware of the full landscape without losing legacy/system context | Worktree manifests, release split plan, scattered architecture docs | Extend |
| Canonical outcome map and consolidation plan | Platform / Governance | Active | Docs + Control Plane | `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md` plus `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md` and `/Users/mark/Property_Analytics/config/platform_outcome_map.json` | Outcome ownership, accepted specializations, consolidate-now targets, enterprise rules | Browser-visible enterprise architecture and anti-duplication model in `/system` plus canonical planning docs for consolidation | Informal outcome-by-folder planning | Extend |
| Shared offering permissions matrix | Platform / Authorization | Active | Data Pond web + API authorization layer | `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`, `/Users/mark/Property_Analytics/apps/web/src/components/shared/restricted-surface-card.tsx` | Technical app roles, canonical offerings, nav categories, audience definitions, named offering actions | Shared offering access catalog for nav visibility, featured surfaces, role-aware labels, named action rights (`view`, `draft`, `approve`, `administer`, `handoff`), steward-route enforcement, restricted-surface UX, role-aware landing/report presentation, and role-aware direct-entry posture for governed operator lanes | One-off page gating, generic route-level editor/admin checks, inconsistent admin-only surface behavior, one-size-fits-all landing/report UX, and abrupt direct-entry permission failures on curator/steward surfaces | Extend |
| Enterprise readiness audit and gap register | Platform / Governance | Active | Control Plane + docs | `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`, `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` | Capability register, full system audit, outcome map, control-plane architecture, current repo/workstream shape | Browser-visible readiness summary, domain-by-domain enterprise gaps, priority workstreams, and next-90-day sequencing for stabilization and consolidation | Ad hoc enterprise planning notes and disconnected roadmap conversations | Extend |
| Portfolio_Monitoring consolidation map | Platform / Consolidation | Active | Docs + control plane | `/Users/mark/Property_Analytics/docs/PORTFOLIO_MONITORING_CONSOLIDATION_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/Portfolio_Monitoring/README.md`, `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Legacy Portfolio_Monitoring scripts/docs, canonical owner model, enterprise readiness program | Explicit migration map from legacy monitoring ownership into Data Collection, Watchtower, and Dock; reduced accidental ownership signals in repo docs | Old self-contained Portfolio Monitoring narrative that reads like the default operator system | Extend |
| Portfolio_Dashboard consolidation map | Platform / Consolidation | Active | Docs + legacy dashboard surface | `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/Portfolio_Dashboard/README.md`, `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Legacy Streamlit dashboard docs/UI, canonical navigation model, enterprise readiness program | Explicit migration map from legacy dashboard ownership into Dock, Analysis, Watchtower, and the main app shell; reduced accidental front-door signals in repo docs | Old dashboard narrative that reads like the default product shell | Extend |
| Briefing family architecture | Reporting / Governance | Active | PIB / POP Brief family through The Pond | `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md`, `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/POP_Brief/README.md`, `/Users/mark/Property_Analytics/Spotlight_Properties_Report/README.md` | Locked PIB posture, POP Brief architecture pack, Spotlight specialized reporting lane, canonical outcome map | Formal family relationship for PIB, POP Brief, and Spotlight; one enterprise-readable family model without mutating locked PIB generation or rendering, plus a Pond-operable POP Brief support lane where weekly metrics now import through TSV paste or CSV upload, uploaded sources are persisted to `POP_BRIEF_UPLOADS`, and backup requests can create server-side backup artifacts instead of relying only on browser-side CSV downloads | Loose briefing-family sprawl and adjacent peer-like report branding | Extend |
| Release governance standard | Platform / Operations | Active | Control Plane + docs | `/Users/mark/Property_Analytics/config/release_governance.json`, `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`, `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`, `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` | Release split plan, worktree compartment map, enterprise readiness program, current worktree/release reality | Browser-visible release governance model, release gates, workstream lane standards, anti-patterns, and release-readiness checklist | Ad hoc release judgment and mixed worktree promotion habits | Extend |
| Site Content Creator | Content Operations | Active | Site Content Creator | `/Users/mark/Property_Analytics/apps/web/src/app/site-content/` plus `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` | Site crawls, property-scoped Intelligence Office brief inputs, governed memory, and Specs-aware page/section expectations | Human-first content editing surface with property picker, single page chooser, one centered page canvas, recognizable stacked page sections, click-to-edit section workflow, CTA-aware block mocks, persisted Specs section mapping (`matched` / `partial` / `missing-from-live` / `extra-on-live`), persisted section assessment, persisted rewrite workflow (`not_started` / `drafted` / `in_review` / `approved`), progressive disclosure of diagnostics behind the selected-section editor, homepage switcher rendering that now uses explicit API-carried tab labels so the editor shows one shared title with three stacked states instead of a duplicated shared tab bar, and nested inline panels for the switcher’s off-canvas/drawer content so editors can see the full text they need to maintain | Generic site audit scripts and diagnostics-first editing UX | Extend |
| VACS content generation system | Content Operations | Planning | VACS | `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts` plus `/Users/mark/Property_Analytics/apps/web/src/app/vacs/page.tsx` | Property context, guidance, support signals, governed memory | Governed content artifacts with memory kept distinct from truth and directives, fail-closed service auth now aligned to Access service-token machine identity without VACS shared-token fallback, contract-tested payload separation, structured claims/evidence context, and a governed Pond bridge surface that exposes VACS posture, contract, shared foundations, and next moves without collapsing the API-first model into a fake full human workspace; standalone `vacs.venterradev.com` remains an architectural target | Venterra AI Content Suite plans | Extend |
| Content operations architecture and contracts | Governance / Planning | Planning | Docs + platform plans | `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md` | Architectural planning | Shared model and implementation direction | Venterra AI Content Suite | Keep |
| Specs integration model | Governance / Structural | Planning | External Specs + local docs | `/Users/mark/VenterraDev/Specs` | Governed page specs | Structural contracts and section maps | Site audit heuristics | Extend |
| Generic site audit framework | Site Governance / Analysis | Specialized | scripts/site_audit | `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py` | Live page crawls | Site audit HTML/XLSX and checks | Site Content Creator, pilot harmonization | Consolidate Into Site Content Creator + Specs-aware work |
| Pilot site harmonization evidence | Site Governance / Pilot | Specialized | Pilot documentation + outputs | `/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md` | Live pilot pages and inspections | Harmonization evidence and gap framing | Generic site audit framework | Extend |
| Pilot vs control CWV program | Pilot Monitoring | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/` plus `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh` | PSI, GTMetrix, BI exports, guest cards | Daily pilot/control matrix, diagnostics, exports, email, stage-aware morning failure alerts, launchd-safe homepage-evidence execution with explicit Node path handling, per-property retry/backoff for transient homepage probe disconnects, a stage-level homepage-evidence remediation loop in the morning wrapper, and duplicate-alert suppression for intentional stage exits so one pilot incident produces one truthful alert | Portfolio-wide CWV snapshot | Extend |
| Pilot roundup reporting | Pilot Monitoring | Specialized | pilot_roundup | `/Users/mark/Property_Analytics/pilot_roundup/` | Pilot KPI and QA signals plus matched sister/control cohort signals | Daily roundup HTML/Markdown artifacts with pilot-primary plus sister/control secondary KPI rows, paired pilot+sister performance cards, and scheduled pilot mailers controlled by `PILOT_SUMMARY_EMAILS_ENABLED`; pilot failure handling is not yet fully unified with the central morning failure alert | Morning report and tracker surfaces | Keep |
| Pilot tracker in main web app | Pilot Monitoring / App | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/tracker/` | Pilot KPI snapshots | Integrated tracker views | Standalone pilot tracker | Extend |
| Standalone pilot tracker site | Pilot Monitoring / App | Active | pilot-tracker-standalone | `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/` | Pilot KPI snapshots | Standalone tracker deployment | Main web tracker | Consolidate Into Main web tracker over time |
| Pilot diagnostic package generation | Pilot Monitoring / Diagnostics | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/generate_pilot_diagnostic_package.py` | Cross-source pilot evidence | Diagnostic package and email preview | Pilot roundup, tracker | Keep |
| BI export normalization and missing-metric audits | Pilot Monitoring / Data Quality | Specialized | pilot_control_cwv + Data Collection | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/` plus `/Users/mark/Property_Analytics/Data_Collection/utils/bi_manual_ingest.py` | BI dashboard exports from the shared `Guest_Card_Reports` drop | Snapshot history, audits, normalized series, backfill/catch-up ingestion of archived BI run workbooks into `bi_normalized_metrics`, and canonical daily/retry-loop harvest of pending BI workbooks from the live shared drop | Tracker packaging scripts | Keep |
| Service operations control plane | Platform Ops / Service Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/service_operations_manifest.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Service ownership metadata, release lanes, trust boundaries, live health/control-plane posture | Enterprise service board for ownership, runtime, deploy target, release lane, runbook, and live pressure across canonical services | Ad hoc service knowledge trapped in docs or operator memory | Extend |
| Deployment provenance and environment drift | Platform Ops / Release Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Expected environment map, runtime observation, configured API base, access runtime policy | Deployment provenance board, drift signals, environment classification, production debug-flag detection | Release notes and ad hoc operator memory | Extend |
| Release pedigree and promoted-slice visibility | Platform Ops / Release Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/release_provenance.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Source branch, baseline commit, source mode, runtime identifiers, deployment URLs | Release pedigree board, promoted-slice visibility, explicit transitional-vs-clean release posture | Implicit operator memory about what was deployed | Extend |
| Release provenance stamping bridge | Platform Ops / Release Governance | Active | scripts/update_release_provenance.py | `/Users/mark/Property_Analytics/scripts/update_release_provenance.py` | Current git state plus deployed Worker/Pages identifiers | Refreshed `config/release_provenance.json` without hand-editing runtime IDs | Manual/stale release pedigree maintenance | Extend |
| Release reconcile snapshot | Platform Ops / Release Governance | Active | generate_release_reconcile_snapshot.py | `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py` plus `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json` | Current dirty-tree paths grouped by canonical workstream rules | Dirty-tree lane counts, first clean release-shaped slice, representative path inventory | Vague release-cleanup guidance and ad hoc branch-split reasoning | Extend |
| Cloudflare cache audit | Performance / Platform Ops | Active | Data Collection + ops/cloudflare | `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py` | Cloudflare API + GraphQL | JSON, CSV, Markdown, HTML audit outputs | None with same maturity | Extend |
| Cloudflare full-page cache rollout tooling | Performance / Platform Ops | Active | ops/cloudflare | `/Users/mark/Property_Analytics/ops/cloudflare/` | Cloudflare auth and pilot config | Cache rules changes, purge, verification | None with same maturity | Keep |
| EVS experiential validation service | Validation / QA | Specialized | EVS + apps/api | `/Users/mark/Property_Analytics/evs/` plus `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx` | BrowserStack, pilot property profiles, API requests | Staging-first validation requests and results; governed Pond workspace now supports request creation, lifecycle visibility, mixed human request + machine ingest posture, and explicit external-orchestrator handoff while deeper workflow dispatch remains an explicit follow-on decision | Ad hoc screenshot-based testing | Extend |
| BrowserStack orchestration and ops | Validation / QA | Specialized | EVS + ops/browserstack | `/Users/mark/Property_Analytics/ops/browserstack/` | BrowserStack credentials, profile definitions | Validation execution support; should be worked as an EVS-specific lane rather than bundled into core platform-app finishing | Standalone screenshots and manual checks | Extend |
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
- a branch split / release shaping map for large parallel workstreams, now started in `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`

## 6. Recent Capability Shaping Notes

- `POP Brief Base44 parity ledger`
  - disposition: active working governance artifact
  - path: `/Users/mark/Property_Analytics/docs/POP_BRIEF_BASE44_PARITY_LEDGER_2026-04-22.md`
  - purpose:
    - define which surfaces are `matched`
    - define accepted auth/user-management deviations
    - prevent “mostly working” from being mistaken for parity completion
  - current use:
    - drives remaining non-auth parity proof work after major writable-surface remediation
  - latest refinement:
    - T7/T30 leasing metrics are now treated as parity-matched after confirming the Base44 model intentionally stores duplicated per-community portfolio rows

- `Site Content Creator`
  - disposition: canonical, active refinement
  - latest direction: human-first editing surface
  - current expectation:
    - property dropdown
    - page dropdown
    - one page mock at a time
    - click a section
    - edit current copy vs new copy
  - latest correction:
    - homepage section rendering now normalizes the first intro block and apartment-features block from live HTML so the editor uses the real title/subtitle/CTA hierarchy and one-image split layout instead of blindly trusting flawed extracted section rows
    - tabbed/switcher homepage content now normalizes from the live HTML as three explicit variant states (`Pet-Friendly Fun`, `High-Tech Living`, `Live Easy Perks`) and renders as a screenshot-driven stacked switcher instead of a generic interpreted block group
  - anti-pattern explicitly being removed:
    - page-card/gallery selection walls
    - dashboard-style active-block framing
    - status/specs/rationale/assessment in the primary editing scene

- `PSI / PageSpeed daily collection`
  - disposition: canonical, active
  - owner: `Data_Collection` + `Portfolio_Dashboard/scripts/collect_daily_psi.py`
  - latest correction:
    - PSI no longer hardcodes `data_collections.status='completed'` for incomplete runs
    - the morning system now treats PSI as retry-eligible same-day source work, even though it remains advisory rather than closure-blocking
    - historical PSI rows with incomplete coverage were reconciled from `completed` to `partial`
    - historical PSI gaps are intentionally not backfilled from live reruns unless dated raw PSI snapshots exist, because the current collector stamps live API results with the supplied `--date`
  - operator significance:
    - missing PSI dates should now reflect upstream master-run interruption truthfully
    - partial PSI days should no longer masquerade as clean success

- `POP Brief`
  - disposition: canonical, active remediation toward live parity
  - owner: `apps/api` + `apps/web`
  - latest correction:
    - the Pond import lane now supports documented TSV paste and CSV/TSV upload against `weekly_metrics`
    - the Pond backup lane now writes server-side artifacts to `POP_BRIEF_UPLOADS`
    - the Pond `/analysis` page now consumes the canonical `/v1/analysis` route instead of assembling the visible brief from sidecar `t7_metrics`, `t30_metrics`, and `marketing_data` models
    - the Pond `/marketing` page now edits canonical `marketing_weekly` records and can execute the canonical mention-scan workflow instead of using the sidecar `marketing_data` model
    - the Pond `/marketing` page once again exposes the Base44-compatible Spotlight Website & SEO CSV import lane through the retained `/v1/marketing-data/import/website-seo` route
    - the Pond `/communities` page now exposes create / update / delete operations against the governed communities API instead of remaining read-only
    - the Pond `/analysis` page now also exposes the Base44 left-rail navigation family as an in-page navigation board so operators can reach Communities, T7, T30, Marketing Data, Analysis, and Backup & Export from the main brief surface
    - the Pond `/pib` dashboard now also exposes that same Base44 workflow family so the visible PIB front door matches the operator’s actual landing surface
    - the Base44 Website & SEO importer now resolves the known shorthand property labels `1604`, `Oakleaf`, and `Whitney` instead of requiring exact canonical community names
    - the Marketing operator surface now has explicit visual hierarchy for upload, import, edit, save, and mention-scan actions instead of relying on near-monochrome neutral controls
    - the main POP Brief page now defaults to the upcoming Friday and scopes the property selector to the active monthly Spotlight property list, auto-selecting the first Spotlight property on open
    - the main POP Brief header now uses a sticky control bar with a single navigation dropdown in place of the prior one-off `Export PDF` and `Update` buttons
  - current posture:
    - visible POP Brief is now anchored on `weekly_metrics` + `marketing_weekly`
    - compatibility with Base44 Website & SEO CSV ingest is restored alongside the canonical workflow
    - remaining parity work still includes onboarding model alignment
