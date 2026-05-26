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

### Executive-approved artifact rule

If a report, email, document, deck, spreadsheet, JSON contract, or other executive-facing artifact has already been approved for a workstream, the approved format is the governing capability contract. Future work must extend or correct that exact artifact rather than creating a nearby alternate, simplified version, or redesigned substitute. This applies especially to Watchlist / Spotlight / Captain companion reports where audience-specific formats have already been accepted.

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
| Property registry | Truth / Metadata | Canonical | Data Pond | `/Users/mark/Property_Analytics/config/venterra_properties_official.json`, `/Users/mark/Property_Analytics/Data_Collection/utils/property_regions_ingest.py`, `/Users/mark/Property_Analytics/docs/PROPERTY_REGIONS_SOURCE_CONTRACT_2026-05-04.md` | Property metadata, IDs, aliases, governed `regions.xlsx` property-region grouping source | Canonical mapping for collectors and reports, including official `encasa_region` assignments for `91` active workbook properties across `14` regions | Older registry/config variants and one-off property-region maps | Keep / Extend through governed source routes |
| Venterra brand color standard | Brand / Design Governance | Canonical | MarketingOps + Platform UI | `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`, `/Users/mark/Property_Analytics/AGENTS.md`, source PDF `/Users/mark/Downloads/New Branding Colors_Named 2.pdf` | Official brand guide colors | System-wide instruction that new or materially updated user-facing UI, reports, decks, documents, charts, generated assets, color controls, and swatches use only active palette colors: Venterra Navy `#15284B`, San Marino `#3D66B9`, Bay `#294782`, Indigo `#5A81CF`, Monte Carlo `#7DCAC2`, Pink `#E02472`, White Smoke `#F6F6F5`, Terra Cotta `#BD4830`, Quill Gray `#D6D6D2`, Blue Chill `#3B9189`, Delta `#9B9B96`, Black `#000000`, and White `#FFFFFF` unless explicitly specified otherwise. Galliano `#EAAB00` is discontinued and should not appear in active color palettes, swatch controls, or configurable defaults. | Ad hoc swatch sets, legacy gray/teal/gold app colors, one-off palette choices, discontinued Galliano defaults | Extend; bring touched visual elements and configurable color controls back to the active official palette without broad redesign unless requested |
| Property identity matrix | Truth / Metadata | Active | Data Pond + Captain's Log | `/Users/mark/Property_Analytics/config/property_identity_matrix.json`, `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`, `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`, `/Users/mark/Property_Analytics/scripts/enrich_property_locations.py`, `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`, `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`, `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh`, `/Users/mark/Property_Analytics/docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md` | Canonical DB `properties`, official registry, GBP location city source, Spotlight registry location source, remote D1 communities snapshot, app community seed, property codes, GA4 IDs, GSC URLs, community UUIDs, aliases, governed property-region workbook | Enforced cross-source identity resolution for source ingesters and Captain-facing reads; property code as visible id when available; full matrix community-id, city/state, and region coverage where source evidence exists; enforcement in Marketing BI conversion, Marketing BI packet, available-unit-interest, operating-metrics, DataForSEO, region grouping, and Captain source mirror paths; AGENTS discipline now requires the matrix for property-scoped ingestion/report/automation changes | Hardcoded property exceptions, per-report identity maps, and downstream one-off region maps | Extend |
| Unified data collection orchestration | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` | GA4, GSC, GBP, PSI, GTMetrix, guest cards, BI workbooks, official operating metrics, metadata, Cloudflare | Canonical DB writes, health status, audit artifacts, richer partial-run state tracking, shared closure-state evaluation, property-level retry queue writes for GA4/GSC/Google Ads, source-level retry handling for guest cards / BI workbooks / operating metrics / unit availability / D1, corrected canonical DB/schema default resolution for scripts that instantiate `DatabaseManager()` directly, a scheduled retry-cycle wrapper that keeps the morning recovery loop running through closure, Google Ads retry semantics that resolve `no activity` as non-failure while keeping true API/mapping gaps queued, source-level Google Ads recovery when the day has no Ads run record yet, source-level completion bookkeeping for unit availability / D1 so closure reflects successful retries honestly, upgraded PSI semantics so the collector grades same-day completion from actual stored portfolio coverage, supports targeted property retries, and resolves stale `partial` queue debt once mobile+desktop coverage is truly complete, plus clearer post-cutoff manual-dependency closure signaling and cleaner Cloudflare cache-audit advisory notes on successful runs | `Portfolio_Monitoring/collect_daily_data.py`, older Spotlight collectors | Extend |
| D1 mirror health classification | Truth / Mirror / Monitoring | Active | Data Collection + apps/api scripts | `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`, `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`, `/Users/mark/Property_Analytics/generate_morning_full_report.py`, `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py` | Local canonical DB, Wrangler/D1 mirror scripts, Morning Full, central alerting | D1 mirror audit reports that now distinguish `core_success` from advisory degradation so Captain-source sync flakes do not poison whole-mirror health by default; Wrangler subprocesses are now cleaned up on timeout; the Captain advisory sync now recreates drift-prone advisory tables like `available_unit_interest_metrics` before insert; and the Captain D1 source packet is now narrowed to the actual runtime read set instead of broad global BI mirrors, which restored full successful mirror completion on 2026-05-07 | Older all-or-nothing D1 mirror status interpretation | Extend |
| GA4 collection and backfills | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/` | GA4 API | Daily metrics, event facts, new-user history, transient-failure partial retry recovery, and Resi SightMap event ingestion/backfill coverage through the supplementary GA4 event collector | Legacy GA4 collection in `Portfolio_Monitoring/` and `Spotlight_Properties_Report/` | Extend |
| GSC collection and inspection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gsc_collector.py` plus `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` | GSC API | Search metrics, inspection artifacts, `data_collections` run tracking, property-level retry queue writes, targeted retry execution from the canonical retry worker, and registry-driven suppression of prelaunch/non-live communities from canonical reporting lanes | Legacy GSC scripts in `Portfolio_Monitoring/`, `Spotlight_Properties_Report/` | Extend |
| GBP collection | Truth / Collection | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` plus `/Users/mark/Property_Analytics/utils/config_manager.py` and `/Users/mark/Property_Analytics/utils/keeper_file_materializer.py` | GBP APIs, Keeper-backed OAuth client/token file materialization and token write-back when configured | GBP metrics and insights; canonical reviews/insights auth path now standardized on shared config getters so both lanes use the same governed credential source; live auth now prefers stable authorized-user JSON token storage, can deserialize legacy pickles only long enough to migrate them forward, reuses one shared credential object for reviews plus insights so the collector no longer blocks on `google.auth._regional_access_boundary_utils` runtime drift, and uploads refreshed token state back into Keeper for unattended KSM-backed runs | Old GBP collectors in legacy directories | Extend |
| Reputation.com vendor exports | Truth / Reputation | Active | Data Collection + Data Pond | `/Users/mark/Property_Analytics/Data_Collection/utils/reputation_com_ingest.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0040_create_reputation_com_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/027_create_reputation_com_tables.sql`, `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`, `/Users/mark/Property_Analytics/reports/reputation/generate_reputation_com_brief.py`, `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py` | Reputation.com XLSX exports from `/Users/mark/Downloads/Reputation`: Location Leaderboard, Reputation Score By Location, Score Time Series By Location, and Local Competition Leaderboard; GBP review, sentiment, summary, and insight tables for enrichment | Portfolio reputation score, current review volume/mix, average rating, response rate, score components, month-by-month score trend, local competitor score/rating comparison, source-file evidence, governed property/community identity mapping, a meeting-ready HTML/email brief with scorecard, row-level Risk Watchlist explanations, trend movers, local competition posture, and score-component diagnostics, plus Captain `reputationInsight` and weekly `reputation_watch` support-lane watch/actions enriched with GBP resident voice, low-star examples, reply coverage, sentiment themes, local profile actions, score decline, low response rate, negative review mix, component gaps, and local competitor exposure; initial 2026-05-04 local load wrote `89` location leaderboard rows, `52` component rows, `445` time-series rows, and `150` local-competition rows, then confirmed vendor aliases for Bella Ruscello, Camber Ridge, Canton Mill Lofts, The Pointe Bentonville, and Villas Continental through the matrix generation path so all property rows map cleanly | PIB Reviews & Reputation section | Extend Data Collection / Data Pond / Captain; Reputation.com is the score/comps layer and GBP is the resident-voice/local-presence layer |
| GBP review sentiment backfill | Truth / Reputation | Active | Data Collection + Data Pond | `/Users/mark/Property_Analytics/Data_Collection/utils/gbp_review_sentiment_backfill.py`, `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py` | Collected `gbp_reviews` rows resolved through the governed property identity matrix | Deterministic `gbp_review_sentiment` rows using star rating plus explicit keyword matches in source review text for themes/action flags; no LLM calls, no invented review facts, and zero analysis cost metadata. First closure run on 2026-05-06 populated `138` Avasa Hammock Landing / `FL4HL` sentiment rows under GA4 id `416886840`, closing the last critical source lane in the 11-property Spotlight readiness audit. | Reputation.com source route, GBP collection, Captain review voice section | Extend as the transparent fallback when raw GBP reviews exist but sentiment rows have not yet been generated |
| Competitor market research evidence ledger | Truth / Market Intelligence | Active Planning | Data Collection + Data Pond + Captain's Log | `/Users/mark/Property_Analytics/docs/COMPETITOR_MARKET_RESEARCH_SOURCE_CONTRACT_2026-05-05.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/competitor_market_research_ingest.py`, `/Users/mark/Property_Analytics/Data_Collection/utils/build_competitor_market_packets.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0043_create_competitor_market_research.sql`, `/Users/mark/Property_Analytics/infra/migrations/030_create_competitor_market_research.sql`, `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`, `/Users/mark/Property_Analytics/reports/captains_log/generate_competitor_market_slice.py`, `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py` | Sourced manual/live competitor research packets with property identity resolution; official competitor pages, public listing pages, internal unit-feed rent/special evidence for the subject property, DataForSEO/Reputation context, and future controlled ADC/package captures | Timestamped competitor market snapshots and row-level observations for rents, specials, availability, USPs, media/package indicators, reputation, and source gaps, each with source URL, captured date, and confidence label; first The Pointe Bentonville packet loaded `1` snapshot and `15` observations and generated a PIB-style competitor market slice; the 2026-05-05 Elation pass loaded `1` TX4EG snapshot with `13` observations and embedded the Competitive Market Read into the full Captain Brief; the 2026-05-06 Spotlight batch builder created and ingested dated official-page competitor packets for the 11 current Spotlight properties and preserves remaining blocked/missing evidence as source-gap rows; Captain Brief read models now expose `competitorMarketRead`, pull the subject property's current visible rents/specials from `unit_availability_units` while ignoring invalid nonpositive feed rents, answer pricing-vs-advertising / ad-copy / web-copy / package-status logic from source rows, add competitive-market diagnostic recommendations under visible value pressure, and gate unsupported ADC/package claims; the Captain UI now renders explanation-first `why` logic with superscript evidence markers tied to a bottom Data Integrity panel | Search Intelligence competitor keyword gaps, Reputation.com local competition, DataForSEO SERP/business evidence, AptIQ/ApartmentIQ advisory reports | Extend; this is the market-facts, decision-logic, and trust-display ledger for POP/Captain competitor slices and should preserve missing/conflicting source states rather than infer them |
| ApartmentIQ API source route | Truth / Market Intelligence | Active | Data Collection + Data Pond + Captain's Log | `/Users/mark/Property_Analytics/docs/APARTMENTIQ_API_SOURCE_CONTRACT_2026-05-22.md`, `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py`, `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml`, `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0055_create_apartmentiq_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/034_create_apartmentiq_tables.sql`, `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`, `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`, `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh`, `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh`, `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_enrichment_summary.py`, `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_full_dive.py` | ApartmentIQ Bearer-token API via Keeper record `ApartmentIQ API`; accounts, comp sets, market survey items, units, floorplans, and subject-property source IDs resolved through the governed identity matrix | Local Pond tables `apartmentiq_accounts`, `apartmentiq_comp_sets`, `apartmentiq_market_survey_items`, `apartmentiq_units`, `apartmentiq_floorplans`, and `apartmentiq_property_identity_links`; initial live exploration discovered `1` account, `285` comp sets, and sampled `3` comp sets into `28` survey rows, `1,480` unit rows, and `278` floorplan rows; Northbridge at Millenia Lake resolved as `FL4NB` and ApartmentIQ source id `99066651` is now carried through the matrix as `apartmentiq:99066651`; daily light and weekly dive runners plus recurring Codex automations are active, with daily light now targeting governed subject-linked comp sets only and capped at `5` by default, while weekly dive now runs a stale-first staggered pass capped at `60` comp sets by default; wrapper log/lock paths now fall back cleanly outside the primary launchd environment; full-dive exports now write Markdown plus CSVs for market rows, listed offers, fees/deposits, amenities, and unit-type metrics under `/Users/mark/Property_Analytics/reports/apartmentiq/<date>/full_dive/` | AptIQ watchlist summary PDFs, competitor market research evidence ledger, POP Brief grounding core, Captain market routines | Extend Data Collection / Data Pond; ApartmentIQ remains advisory market/comps evidence and must not replace internal operating, availability, guest-card, or BI source-of-record facts |
| GTMetrix collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` | GTMetrix API | Performance metrics with pilot subset-resume, daily credit ledger, classified retry/queue-stop behavior, and persisted live rate-limit header telemetry | Pilot GTMetrix collector, older Spotlight GTMetrix flows | Extend |
| Guest card collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/guest_card_collector.py` | Guest card source exports | Guest card facts, downstream analyses, resumed active ingest from the shared OneDrive drop, and archive-aware recovery of pending CSVs when files are restored to the live folder | Older correlation-only workflows | Extend |
| ThirtyLines collection | Truth / Collection | Active | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py` | ThirtyLines / availability feeds | Raw feed snapshots, floorplan availability, normalized unit-level pricing/specials snapshots, concession-message parsing, ingest QA counts | Ad hoc inventory analyses, stale legacy `available_units` consumers | Extend |
| Collection monitoring and anomaly detection | Ops / Integrity | Canonical | Data Collection | `/Users/mark/Property_Analytics/Data_Collection/monitoring/` | Collection runs, validation checks | Alerts, anomaly signals, failure context, safe auto-remediation for guest-card backlog and D1 mirror recovery, clearer core-vs-specialty failure / GSC identity reporting, source-aware manual-morning freshness expectations for guest cards / BI-style feeds, a consolidated morning failure alert that now inlines registry validation findings, the first queue-ready collection-state model for same-morning recovery workflows, reversible guest-card suspension controls, closure-state reporting that can now fully close same-day source-level recoveries for Google Ads, guest cards, unit availability, and D1, automatic archival of stale historical retry debt, advisory-source visibility for non-core governance lanes, an explicit cadence-aware advisory governance model for Watchtower instead of a same-day-run-only heuristic, a shared advisory cadence policy now consumed by Watchtower, Python closure, and morning alerting, aligned monitoring for GBP reviews / insights after repairing canonical collector initialization and `data_collections` bookkeeping, a canonical GBP mapping layer that now honors manual property overrides, suppresses duplicate property rows in live collection runs, normalizes the source mapping file / generator counts to the true 91-property portfolio shape, is mirrored into the main remaining local `Portfolio_Monitoring` GBP utilities to reduce legacy drift, now sits on a package-safe `Portfolio_Monitoring` import path instead of brittle `sys.path`-only legacy behavior, has the highest-value legacy runner scripts migrated to package-safe import patterns, no longer lets the cleaned legacy GSC backfill helpers kick off live work merely by being imported, now extends that same safer import/run discipline across the main review-analysis, email/report, and test/debug local scripts as well, keeps Watchtower `/v1/health/status` resilient when optional mirrored ops tables are absent so the control plane degrades gracefully across partial environments instead of failing closed, and now protects D1 health evaluation from same-day rerun noise by preferring a successful same-day mirror over a later failed auth-only rerun | Older alerting in `Portfolio_Monitoring/` and `utils/`; standalone registry validation mail path should stay suppressed/disabled | Extend |
| Keeper/KSM secret materialization | Ops / Platform | Canonical | Shared Utilities | `/Users/mark/Property_Analytics/utils/ksm.py`, `/Users/mark/Property_Analytics/utils/dataforseo_auth.py`, `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`, `/Users/mark/Property_Analytics/ops/cloudflare/cloudflare_auth.py` | Keeper records and documented KSM notation | Mandatory credential authority for credentials, API tokens, OAuth artifacts, service tokens, and deployment auth; runtime secrets and temp files; launchd-safe notation/profile injection for Cloudflare Wrangler auth; explicit `ksm` binary resolution for stripped environments; default-UID materialization support for Google Ads config; DataForSEO login/password resolution; sanitized verification without printing raw secrets; and typed bootstrap-failure surfacing so orchestrators can record blocked states instead of hard-aborting | Older direct credentials-file patterns, manual Wrangler browser auth, ad hoc `.env` secret paths | Extend by adding missing credentials to Keeper/KSM and the appropriate manifest instead of creating local workarounds |
| Captain source-table D1 mirror and runtime roster | Governance / Memory | Active | POP Brief + Captain's Log through The Pond | `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`, `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`, `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_expanded_support_roster_2026-04-29.sql` | Canonical source tables for a selected property, D1 community mapping, Keeper-backed Wrangler auth, Captain support-agent roster | Source-level remote D1 rows for Captain support agents, including Guest Cards, unit availability, GA4, compact GSC, Google Ads, PSI, GBP insights/reviews/sentiment, Reputation.com, Spotlight weekly field snapshots/action items, and official operating metrics for AR4PB when populated; deterministic inclusion in the daily D1 mirror sync path; expanded runtime roster with daily Source/Truth/Inventory/Funnel/Media/Navigator/Experience/Boatswain lanes and weekly Reputation/Logkeeper/Scribe lanes; Captain Brief read payloads now include `reputationInsight`; support-team status should identify which lanes are current, stale, blocked, or failing to produce action-ready intelligence | Report-table-only D1 mirror when Captain runtime needs source-level reads | Extend |
| Property operating metrics source route | Truth / Operations | Active | Data Pond + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md`, `/Users/mark/Property_Analytics/docs/contracts/property_operating_metrics_template_AR4PB.csv`, `/Users/mark/Property_Analytics/scripts/operating_metrics_brief_intake.py`, `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`, `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0028_create_property_operating_metrics.sql`, `/Users/mark/Property_Analytics/infra/migrations/015_create_property_operating_metrics.sql`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` | Lease/revenue/operating source-of-record file/feed once routed | Official occupancy, leased percentage, lease count, cancellations/denials, move-ins/move-outs, and booked concession dollars for Captain Brief and POP Brief read models; CSV/XLSX intake into local Pond plus optional remote D1 upsert; daily collection and same-morning retry discovery from the shared manual drop; drop-ready AR4PB template plus an operator wrapper that can create the dated drop file, validate, ingest, mirror, regenerate the Captain Brief, and email it; explicit blocked/manual dependency when no `AR4PB` operating metrics file is received | Public unit-feed concession visibility, vendor-inferred AptIQ operating values | Extend |
| Available unit interest metrics | Truth / BI Advisory | Active | Data Pond + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/AVAILABLE_UNIT_INTEREST_SOURCE_CONTRACT_2026-04-27.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/available_unit_interest_ingest.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0029_create_available_unit_interest_metrics.sql`, `/Users/mark/Property_Analytics/infra/migrations/016_create_available_unit_interest_metrics.sql` | Marketing BI `Available Units With Low Inquiries` / `Guest Cards Per Unit Type` export | Demand-versus-availability metrics by region/property, including available units, vacant/notice split, T7/T30 guest-card volume, guest cards per available unit, deltas, and quote volume; first AR4PB row loaded and mirrored for Benton | Raw guest-card facts, unit availability snapshots, official operating metrics | Extend |
| Marketing BI conversion diagnostics | Truth / BI Advisory | Active | Data Pond + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/MARKETING_BI_CONVERSION_SOURCE_CONTRACT_2026-04-28.md`, `/Users/mark/Property_Analytics/docs/MARKETING_BI_DAILY_PACKET_SOURCE_CONTRACT_2026-04-28.md`, `/Users/mark/Property_Analytics/docs/MARKETING_OPS_SUMMARY_SOURCE_CONTRACT_2026-05-04.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_conversion_ingest.py`, `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py`, `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_packet_ingest.py`, `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_ops_summary_ingest.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0031_create_marketing_bi_daily_packets.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0034_create_marketing_bi_conversion_summary.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0035_create_marketing_bi_excel_exports.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0036_create_marketing_bi_conversion_dashboard.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0037_create_marketing_bi_recovery_sources.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0038_create_marketing_bi_cost_per_conversion.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0041_create_marketing_ops_summary.sql`, `/Users/mark/Property_Analytics/infra/migrations/017_create_marketing_bi_conversion_sources.sql`, `/Users/mark/Property_Analytics/infra/migrations/018_create_marketing_bi_daily_packets.sql`, `/Users/mark/Property_Analytics/infra/migrations/021_create_marketing_bi_conversion_summary.sql`, `/Users/mark/Property_Analytics/infra/migrations/028_create_marketing_ops_summary.sql`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` | Marketing BI `Property CancelDenial by Mktg Source` PDF and native Excel exports, `Traffic Conversions T7D-T90D` PDF/native Excel exports, native Excel Portfolio Summary, native Excel property-month Ad Spend, top-source/top-reason Excel exports, daily portfolio packet / `Conversion_Dashboard` exports, `Portfolio Summary`, `Ad Spend`, `Conversion Performance Summary` packet exports, shared-drop conversion/source workbooks like `conversion-data.xlsx`, `converting-performance.xlsx`, and `marketing-performance.xlsx`, plus the promoted `Marketing Ops Summary.xlsx` workbook | Portfolio-aware traffic conversion rows from visible property-level export rows, mapped through guest-card property codes and official registry; complete portfolio cancel/denial diagnostics from native Excel exports with latest-XLSX preference for Captain reads; full-fidelity native Excel traffic conversions, property-month ad spend, portfolio-summary context, property/contact-type Conversion Dashboard rows, vacancy-day unit rows, lease-term rows, WOW spending, ad-spend performance by month, period leakage metrics, cost-per-conversion rows with invalid-value tracking, generic evidence rows for smaller BI exports, and preserved shared-drop performance/source workbooks for later promotion decisions; daily packet headers, searchable page text, Portfolio Summary property rows, structured portfolio-level paid/all conversion performance summary with cost-per-conversion and paid-channel spend metrics, and purpose-built Marketing Ops Summary rows for property performance, traffic, pricing, financial, and Kingsley signals; a Captain Brief `marketingInsight` read-model and `/analysis/captain` Marketing BI Read block; Marketing Ops Summary is loaded locally, mirrored to remote D1, and exposed in Captain Marketing Insight as opsSummary/opsRead; daily/drop collection remains a follow-up | Guest-card facts, traffic/source performance, official operating metrics, unit-level availability feed | Extend |
| DataForSEO SERP and enrichment source route | Truth / Search | Active | Data Pond + Search Intelligence + Captain's Log | `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/dataforseo_serp_ingest.py`, `/Users/mark/Property_Analytics/scripts/run_dataforseo_spotlight_deep_trial.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0032_create_dataforseo_serp_tables.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0033_create_dataforseo_enrichment_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/019_create_dataforseo_serp_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/020_create_dataforseo_enrichment_tables.sql`, `/Users/mark/Property_Analytics/utils/dataforseo_auth.py` | DataForSEO live SERP API, Keyword Data API, DataForSEO Labs API, OnPage API, Business Data API, Backlinks API trial, AI Optimization API including LLM Mentions trial, Keeper-backed DataForSEO credentials, city/state-enriched property identity matrix, Spotlight property config, Specs expectations for page/content/HTML interpretation | Live SERP run metadata, normalized result rows, property-keyword ranking read model, keyword demand/CPC/competition metrics, Labs ranked-keyword discovery, OnPage snapshots, Business profile facts, AI visibility probes, backlink summary/detail evidence, LLM Mentions evidence, cost/raw evidence paths; initial April Spotlight brand/local SERP loads and AR4PB deep trials completed on 2026-04-28 and 2026-04-29; 04/29 AR4PB focused packet cost approximately `$0.5245` and proved the future Captain Navigator Dossier shape; Navigator interpretation must reconcile Specs standard, live reality, external evidence, directive, and follow-up proof; as of 2026-05-07 this is also the governed successor for the ops-layer SEMRush advisory lane in alerting and Watchtower health | SEMrush rank snapshots, GSC performance data, Google Ads keyword facts, GBP history, Ranked-style SEO audit exports, Specs | Extend |
| Canonical PIB property reporting | Reporting | Canonical | PIB | `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`, `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`, `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`, `/Users/mark/Property_Analytics/config/pib_section_catalog.json` | Canonical DB, PIB pipeline inputs, DataForSEO context, BI spend/source/box-score rows, GSC query mix, availability, PageSpeed, review sentiment, governed ApartmentIQ advisory enrichment rows, and future stable section-id selections | PIB HTML, property views, email outputs, an approved locked versioned v2.2.0 PIB path with a Resi SightMap Signals panel sourced from `ga4_event_facts`, and a v2.3.0 versioned PIB path that adds an `ApartmentIQ Market Enrichment` section from local Pond ApartmentIQ tables while preserving ApartmentIQ as advisory-only context; property-level PIBs can render the approved `PIB Site Evaluation` intro when evidence exists, with detailed PIB sections serving as support below the executive diagnosis; PIB now has a seed section catalog for a future self-serve builder with selectable sections/presets over the canonical PIB family | PIB-style specialty outputs, legacy PIB variants, separate site-evaluation drafts, any future app-side alternate PIB renderer | Keep canonical PIB; do not create parallel evaluation renderers; future builder should use canonical PIB section ids/presets |
| PIB-family report shell and delivery discipline | Reporting / Delivery | Canonical Discipline | PIB + Report Family Owners | `/Users/mark/Property_Analytics/utils/pib_email_shell.py`, `/Users/mark/Property_Analytics/utils/email_sender.py`, locked PIB senders only when the task is canonical PIB, and each report family's documented sender/orchestrator | Rendered report HTML, companion attachments, configured recipients, delivery logs | PIB-style email outputs delivered through the established family path with shared shell/chrome, duplicate-send/logging policy where available, and attachments handled by extending the family sender rather than creating one-off wrappers | Ad hoc direct `EmailSender` calls, standalone send scripts, custom one-off SMTP wrappers | Extend the owning report-family sender first; direct utility use only inside a canonical sender/orchestrator or with explicit operator approval |
| Search Intelligence report builder | Reporting / Search | Active | Data Pond + apps/api | `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx` plus `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts` and specialty search-report scripts under `/Users/mark/Property_Analytics/scripts/` | Communities, local search/ad warehouse tables, live SEMrush keyword pulls, competitor mappings, canonical GSC daily metrics, canonical GA4 organic traffic facts, targeted selected-property GSC backfill support, Keeper-backed Worker `SEMRUSH_API_KEY` | Single-property PIB-style keyword intelligence preview, selected-property PIB-style SEO proof briefs for rolling or explicit date windows, PIB-style daily copy-change impact briefs, HTML/Markdown/JSON/CSV artifacts, optional email delivery, and narrow canonical GSC historical repair for selected windows | Ad hoc search deep dives, local script-only keyword briefs | Extend |
| PIB web surfaces | Reporting / App | Canonical | Data Pond + PIB | `/Users/mark/Property_Analytics/apps/web/src/app/pib/` | API / canonical PIB data | Browser PIB views | Older script-only PIB consumption | Extend |
| Daily health reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py` | Canonical DB | Legacy health report artifact family; canonical scheduled summary delivery now routes through Morning Full instead of a separate overlapping email | Morning full report and some Pulse overlap | Consolidate Into Morning full report |
| Morning full report | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_morning_full_report.py`, `/Users/mark/Property_Analytics/send_morning_full_report.py`, `/Users/mark/Property_Analytics/run_daily_health_report.sh`, `/Users/mark/Property_Analytics/scripts/verify_morning_delivery.py` | Canonical DB, pilot/ops inputs, delivery logs, closure state | Canonical daily summary email/report with duplicate-send protection, closure-aware hold behavior, legacy daily-health routing consolidation, explicit execution-status artifacts so intentional send holds no longer trip the acceptance/failure path, and a distinct `advisory` closure posture when core sources are closed but manual/diagnostic tail work remains | Daily health and weekly progress family | Keep |
| Weekly progress reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_weekly_progress_report.py` | Canonical DB | Weekly leadership-style output | Spotlight and Focus adjacent audience overlap | Keep |
| CWV snapshot reporting | Reporting / Performance | Specialized | Root reporting scripts | `/Users/mark/Property_Analytics/generate_cwv_snapshot.py` plus `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py` plus `/Users/mark/Property_Analytics/scripts/send_lease_up_vs_pilot_performance_brief.py` | PSI / performance metrics | Portfolio CWV rankings and email, selected-property mobile PSI / CWV T30 briefs with Excel attachment delivery, and a PIB-style lease-up-vs-pilot comparison brief with Excel raw-data companion, shorthand-to-canonical property mapping, explicit stale-date exceptions when a property's latest PSI lags the portfolio report date, and operator notes in `/Users/mark/Property_Analytics/reports/selected_cwv_t30/README.md` and `/Users/mark/Property_Analytics/reports/property_evaluation/lease_up_vs_pilot_pib/README.md` | Pilot CWV program | Keep |
| GSC snapshot reporting | Reporting / Search | Specialized | Reporting scripts | `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py` | Canonical GSC data | Portfolio GSC snapshot output | Spotlight GSC reporting | Keep |
| Executive / leadership / prelaunch assessments | Reporting / Specialty | Specialized | Root assessment scripts | `/Users/mark/Property_Analytics/generate_executive_assessment.py` | Canonical DB, selected analyses | Stakeholder summaries and assessments | Ad hoc PIB-style outputs | Keep |
| Spotlight PageSpeed Insights performance roundup | Reporting / Performance | Active | Pilot roundup + Spotlight | `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_spotlight_performance_roundup.py`, `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py`, `/Users/mark/Property_Analytics/run_spotlight_performance_roundup_daily.sh`, `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.performance.roundup.daily.plist` | Canonical DB PSI/New Users data, BrowserStack context, governed property identity matrix, Spotlight 11 property codes | Daily 7:00 AM local email for the current Spotlight 11 with PageSpeed Insights as the dominant score/trend, GTMetrix intentionally omitted, status chips removed, duplicate-send guard under `logs/email_delivery/spotlight_performance_roundup`, and delivery to Mark Laufhutte, Stephanie Bynum, Eric Longoria, and Jared Dominguez; Codex automation `daily-spotlight-pagespeed-insights-performance` is a watchdog rather than a second primary sender | Legacy pilot-performance framing for Spotlight 11, GTMetrix-led report view | Extend |
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
| Governed multi-layer memory system | Governance / Memory | Active | Intelligence Office + apps/api | `/Users/mark/Property_Analytics/apps/api/src/platform/memory/governed-memory.ts`, `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md` | Data Pond evidence, Intelligence Office directives, operator-authored memory entries, governed fleet mapping, audited promotions, Captain decisions/actions/outcomes/lessons | Captain's Log, Fleet Brief, The Ledger, Commodore memory, promotion records, durable entry lineage, authoritative-only consumer reads, fail-closed machine consumption for VACS, governed context for VACS / Site Content Creator, and a required directive-memory model where Captains preserve prior expectations, actions, results, and lessons before issuing new recovery guidance | Hidden prompt memory, ad hoc notes, parallel truth risk | Extend |
| Captain operating model | Governance / Memory | Planning | Intelligence Office + POP Brief | `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`, `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`, `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`, `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md`, `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md` | Data Pond facts, POP Brief grounding claims, Captain's Log entries, recurring source documents, human decisions, command-role ownership model, prior recommendations, actions, outcomes, and lessons | Property-scoped operating intelligence role model, source cadence expectations, watch loops, Admiral Read escalation format, Commodore communication loop, required recovery directive questions, a watchlist diagnostic standard that starts with recovery math and primary constraint, branches into funnel/floorplan/pricing/source/content/reputation/operations/people evidence, and requires every recommendation to include evidence, confidence, owner, due date, expected lift, proof check, and do-not-recommend gates, first The Pointe Bentonville Captain tasking focused on A1/B1 pressure, concession leakage, applicant follow-up, and source reconciliation, and a codified hierarchy for Fleet Commander, Chief of Staff, Admiral, Commodore, Captain, First Officer, Quartermaster, Navigator, Signals Officer, Engineer, Boatswain, and Logkeeper | Unstructured property notes, ad hoc report interpretation, generic AI summaries without accountability | Extend |
| Captain's Log and Brief report set | Reporting / Governance | Active | POP Brief + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`, `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md`, `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`, `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py`, `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py`, `/Users/mark/Property_Analytics/apps/api/migrations/0026_create_captain_support_agents.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0027_create_captain_runtime_tables.sql`, `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`, `/Users/mark/Property_Analytics/infra/migrations/013_create_captain_support_agents.sql`, `/Users/mark/Property_Analytics/infra/migrations/014_create_captain_runtime_tables.sql`, `/Users/mark/Property_Analytics/reports/captains_log/templates/captains_log_entry_template.md`, `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_log_2026-04-24.md`, `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_brief_email_2026-04-24.html`, `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_memory_seed_2026-04-24.sql`, `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_support_agents_2026-04-24.md` | Data Pond facts, Captain's Log memory, reconciled claims, action registers, decision registers, advisory source context, structured Marketing BI traffic/spend/cost rows, support-agent source lanes, scheduled Worker runs, remote D1 Captain runtime state, property identity matrix, Spotlight property set, Captain's Brief v1.2 display standard, POP Brief diagnostic recommendation standard, peer-family Marketing Ops evidence | Formal naming and artifact split where Captain's Log is durable property memory and Captain's Brief is the outbound email/read generated from the log plus current Pond facts; first Captain Benton / The Pointe entry is seeded into governed memory with evidence refs, source documents, grounded claims, reconciliations, reusable artifact block, six active support agents, live runtime tables/routes for agent runs/watch items/actions/brief runs, a first clean remote Captain Brief draft `captain_brief_AR4PB_20260425202040_b9ac1686`, a live API/app read model that shows source readiness, operating snapshot route status, unit-number aged inventory detail from the D1 unit feed, Marketing BI source/spend economics, designation doctrine for Spotlight/Critical command posture, peer-family help from stronger sibling properties, and a derived `diagnosticRead` with recovery math, primary constraint, confidence, recommended fixes, proof checks, and do-not-recommend gates; first local May watchlist diagnostic packet generated for 19 current spotlight/watchlist properties with all properties reading inventory/stale-unit constrained before demand and peer-family tactics included for reviewer calibration; plus local vNext generators for recovery and Spotlight briefs that emit browser and Outlook-safe artifacts from Pond facts, preserve analyst performance/notes areas, can include business-facing remote watch/action registers, support direct email delivery, render T7/T30 performance from structured BI/Pond rows instead of template constants, calculate portfolio averages and vs-portfolio comparisons for volume, conversion, closing-ratio, and guest-cards-per-available-door rows, place source references in a bottom `Sources Used` panel, filter internal source-route/support-tool rows from the visible responsibility register, remove owner columns and role-call labels from main Captain Brief email bodies while preserving action/proof expectations, use governed source-display aliases so `ADC`/`Apartments.com` can present together and `Drive By` can present as `Walk-In / Drive-By`, and keep those wording improvements in the reporting layer without mutating stored BI source truth | One-off Captain report drafts, ambiguous Captain's Log vs Brief naming, file-only memory, unscheduled manual-only reviews, dense spreadsheet-style report presentation | Extend |
| Cloudflare Zero Trust security architecture | Platform / Security | Active | Cloudflare + Platform Ops | `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md` plus `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md` | Cloudflare Access, Tunnel, WARP, Gateway, Keeper-backed secrets, app roles, service identity | Canonical access model, hostname/route classification, concrete configuration checklist, Keeper manifest, repo-side service-token-compatible route support, origin-side Cloudflare Access JWT validation for machine routes, verified live cutover for `platform` / `vacs` / `evs`, Cloudflare Access-to-Data Pond session bootstrap on `/v1/auth/me` for human browsers, browser-safe multi-origin handoff for both `app.venterradev.com` and `app.venterraliving.com`, least-privilege auto-provisioning of Access-approved browser identities into app roles, structured Cloudflare Access bootstrap telemetry, optional browser-app AUD enforcement via `CLOUDFLARE_ACCESS_AUD`, exact-origin cookie/redirect handling, distinct session failure codes for login triage, malformed-token fail-closed handling, D1-backed auth rate limiting for `/v1/auth/login` and `/v1/auth/magic-link`, and canonical remote D1 bootstrap via `0021_create_phase1_platform_tables.sql`, `0023_seed_phase1_platform_control_plane.sql`, and `0020_create_evs_tables.sql` | Ad hoc per-app auth decisions, standalone secret handling, direct-origin exposure risk | Extend |
| Unified system foundation and landscape manifest | Platform / Governance | Active | Docs + Platform | `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md` plus `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Capability register, full audit, platform catalog, repo topology, trust-boundary posture, nested repo map | Human-readable foundation model plus machine-readable inventory for canonical systems, product surfaces, trust zones, repo boundaries, and migration priorities so The Pond and adjacent work can become aware of the full landscape without losing legacy/system context | Worktree manifests, release split plan, scattered architecture docs | Extend |
| Canonical outcome map and consolidation plan | Platform / Governance | Active | Docs + Control Plane | `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md` plus `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md` and `/Users/mark/Property_Analytics/config/platform_outcome_map.json` | Outcome ownership, accepted specializations, consolidate-now targets, enterprise rules | Browser-visible enterprise architecture and anti-duplication model in `/system` plus canonical planning docs for consolidation | Informal outcome-by-folder planning | Extend |
| Shared offering permissions matrix | Platform / Authorization | Active | Data Pond web + API authorization layer | `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`, `/Users/mark/Property_Analytics/apps/web/src/components/shared/restricted-surface-card.tsx` | Technical app roles, canonical offerings, nav categories, audience definitions, named offering actions | Shared offering access catalog for nav visibility, featured surfaces, role-aware labels, named action rights (`view`, `draft`, `approve`, `administer`, `handoff`), steward-route enforcement, restricted-surface UX, role-aware landing/report presentation, and role-aware direct-entry posture for governed operator lanes | One-off page gating, generic route-level editor/admin checks, inconsistent admin-only surface behavior, one-size-fits-all landing/report UX, and abrupt direct-entry permission failures on curator/steward surfaces | Extend |
| Enterprise readiness audit and gap register | Platform / Governance | Active | Control Plane + docs | `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`, `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` | Capability register, full system audit, outcome map, control-plane architecture, current repo/workstream shape | Browser-visible readiness summary, domain-by-domain enterprise gaps, priority workstreams, and next-90-day sequencing for stabilization and consolidation | Ad hoc enterprise planning notes and disconnected roadmap conversations | Extend |
| Portfolio_Monitoring consolidation map | Platform / Consolidation | Active | Docs + control plane | `/Users/mark/Property_Analytics/docs/PORTFOLIO_MONITORING_CONSOLIDATION_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/Portfolio_Monitoring/README.md`, `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Legacy Portfolio_Monitoring scripts/docs, canonical owner model, enterprise readiness program | Explicit migration map from legacy monitoring ownership into Data Collection, Watchtower, and Dock; reduced accidental ownership signals in repo docs | Old self-contained Portfolio Monitoring narrative that reads like the default operator system | Extend |
| Portfolio_Dashboard consolidation map | Platform / Consolidation | Active | Docs + legacy dashboard surface | `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/Portfolio_Dashboard/README.md`, `/Users/mark/Property_Analytics/config/system_landscape_manifest.json` | Legacy Streamlit dashboard docs/UI, canonical navigation model, enterprise readiness program | Explicit migration map from legacy dashboard ownership into Dock, Analysis, Watchtower, and the main app shell; reduced accidental front-door signals in repo docs | Old dashboard narrative that reads like the default product shell | Extend |
| Briefing family architecture | Reporting / Governance | Active | PIB / POP Brief family through The Pond | `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md`, `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md`, `/Users/mark/Property_Analytics/POP_Brief/README.md`, `/Users/mark/Property_Analytics/Spotlight_Properties_Report/README.md` | Locked PIB posture, POP Brief architecture pack, Spotlight specialized reporting lane, canonical outcome map | Formal family relationship for PIB, POP Brief, and Spotlight; one enterprise-readable family model without mutating locked PIB generation or rendering, plus a Pond-operable POP Brief support lane where weekly metrics now import through TSV paste or CSV upload, uploaded sources are persisted to `POP_BRIEF_UPLOADS`, and backup requests can create server-side backup artifacts instead of relying only on browser-side CSV downloads | Loose briefing-family sprawl and adjacent peer-like report branding | Extend |
| POP Brief grounding core | Reporting / Governance | Planning | POP Brief + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`, `/Users/mark/Property_Analytics/apps/api/migrations/0024_create_property_brief_grounding_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/011_property_brief_grounding.sql`, `/Users/mark/Property_Analytics/packages/shared/src/grounding-types.ts`, `/Users/mark/Property_Analytics/packages/shared/src/grounding-schemas.ts`, `/Users/mark/Property_Analytics/Data_Collection/utils/spotlight_weekly_field_notes_ingest.py`, `/Users/mark/Property_Analytics/docs/SPOTLIGHT_WEEKLY_FIELD_NOTES_SOURCE_CONTRACT_2026-05-04.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/aptiq_watchlist_summary_ingest.py`, `/Users/mark/Property_Analytics/docs/APTIQ_WATCHLIST_SUMMARY_SOURCE_CONTRACT_2026-05-05.md` | Data Pond facts, AptIQ/ApartmentIQ-style recurring reports, live property-page snapshots, Captain's Log, operator notes, weekly Spotlight field notes/action plans | Source documents, normalized property claims, reconciliation records, reusable artifact blocks, explicit truth statuses, a source-authority model where Data Pond overrides vendor-inferred operational metrics before brief generation, additive human field intelligence for explaining metric movement and tracking recovery execution, and OCR-backed AptIQ watchlist summary storage for market/recovery hypotheses without overriding source-of-record data | Ad hoc property brief prose, unreconciled vendor report summaries, shadow PIB-style renderers, and ungoverned Spotlight note folders | Extend |
| Property Evaluation Brief standard | Reporting / Governance | Planning | POP Brief + Captain's Log through The Pond | `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md`, `/Users/mark/Property_Analytics/reports/property_evaluation/templates/property_evaluation_resolution_brief_template.md`, `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_property_evaluation_resolution_brief_2026-04-24.md` | Data Pond facts, source authority/freshness, vendor intelligence, Captain's Log, action/decision registers | Reusable property evaluation and resolution brief standard, required evidence domains, source authority ladder, source-authority publishing gate, PIB-family presentation rules, reusable Markdown template, and The Pointe pilot instance with Captain Benton; routing gaps are treated as composition work rather than uncertainty when the Pond source exists | One-off property report drafts and non-standard recommendation memos | Extend |
| Release governance standard | Platform / Operations | Active | Control Plane + docs | `/Users/mark/Property_Analytics/config/release_governance.json`, `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`, `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`, `/Users/mark/Property_Analytics/apps/web/src/app/system/page.tsx` | Release split plan, worktree compartment map, enterprise readiness program, current worktree/release reality | Browser-visible release governance model, release gates, workstream lane standards, anti-patterns, and release-readiness checklist | Ad hoc release judgment and mixed worktree promotion habits | Extend |
| Site Content Creator | Content Operations | Active | Site Content Creator | `/Users/mark/Property_Analytics/apps/web/src/app/site-content/` plus `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` | Site crawls, property-scoped Intelligence Office brief inputs, governed memory, and Specs-aware page/section expectations | Human-first content editing surface with property picker, single page chooser, one centered page canvas, recognizable stacked page sections, click-to-edit section workflow, CTA-aware block mocks, persisted Specs section mapping (`matched` / `partial` / `missing-from-live` / `extra-on-live`), persisted section assessment, persisted rewrite workflow (`not_started` / `drafted` / `in_review` / `approved`), progressive disclosure of diagnostics behind the selected-section editor, homepage switcher rendering that now uses explicit API-carried tab labels so the editor shows one shared title with three stacked states instead of a duplicated shared tab bar, and nested inline panels for the switcher’s off-canvas/drawer content so editors can see the full text they need to maintain | Generic site audit scripts and diagnostics-first editing UX | Extend |
| Website change watch / vendor SEO baseline | Site Governance / SEO / Monitoring | Active seed | Data Pond + Site Content Creator + EVS | `/Users/mark/Property_Analytics/config/website_change_watch_properties.json`, `/Users/mark/Property_Analytics/scripts/monitor_monteverde_website_watch.py`, `/Users/mark/Property_Analytics/docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md`, `/Users/mark/Property_Analytics/reports/website_change_watch/monteverde/` | Governed property identity, public sitemap/robots/live HTML, rendered page metadata, schema, headings, text blocks, links/CTAs, images/alt text, forms, headers, Data Pond GA4/GSC/PSI/GTMetrix/DataForSEO/GBP/Ads/unit availability/Cloudflare cache rows, and future WordPress/WP Engine backend audit evidence | Immutable public-site baseline snapshots, raw HTML archive, normalized field inventory, machine-readable diff events, and Markdown baseline reports for Monteverde external SEO vendor monitoring; current filled baseline is `20260513T165310Z`, with GTMetrix, GBP review summary, and Cloudflare synthetic cache evidence populated; intended portfolio-grade direction separates baseline, field-level diff, and delayed impact windows | Generic site audit, Site Content Creator current inventory, DataForSEO OnPage, Captain website routine, EVS post-change validation, Watchtower freshness/alert surfaces, Specs page-section contracts | Extend; integrate into Site Content Creator + Data Pond + Captain routines + EVS rather than creating a parallel SEO monitor or report family |
| Copy Change Monitoring | Site Governance / SEO / Content Measurement | Active | Data Pond + Site Content Creator + Copy Change Impact Brief | `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`, `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py`, `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`, local SQLite tables `copy_change_waves`, `copy_change_interventions`, `copy_change_observations` | Governed property identity, permanent CMS/site copy changes, GSC aggregate metrics, GA4 Organic Search, GSC query rows, future DataForSEO/PSI/EVS evidence, Site Content section rewrites, Website Change Watch baselines/diffs, Captain consultation and handoff notes | Wave-aware local intervention registry, seeded April 17 copy-change cohort, scalable property addition without code edits, local observation storage for aggregate GSC/GA4 and query-cohort evidence, report JSON generated locally while the email remains an executive quick read without mandatory raw-data attachments, required pre-change Captain consultation because the Captain should know the property best, and required Captain/Navigator/Logkeeper handoff when a property is added to an active wave or tracked fields materially change | Hardcoded report property lists, ad hoc spreadsheet tracking, unregistered CMS edits, standalone SEO test tools, attaching raw evidence to executive email by default, unconsulted Captain before public copy changes, unalerted Captain memory drift after public copy changes | Extend Website Change Watch + Site Content Creator + Captain/Watchtower rather than creating a parallel report family |
| Content Office | Content Operations / Distribution | Active Planning | Content Office + GBP Posts through Data Pond | `/Users/mark/Property_Analytics/apps/web/src/app/content-office/page.tsx`, `/Users/mark/Property_Analytics/apps/web/src/app/gbp-posts/page.tsx`, `/Users/mark/Property_Analytics/apps/api/src/routes/gbp-posts.ts`, `/Users/mark/Property_Analytics/apps/api/migrations/0019_create_gbp_post_workflow.sql` | Captain Brief/runtime context, Data Pond facts, Site Content/Specs context, GBP workflow queue, live feed inputs, future channel policies | Governed channel operations workspace that treats GBP Posts as the first active lane and frames social drafts, email snippets, short video briefs, and community listening as draft/handoff lanes until integrations are proven; GBP Posts now stores active Captain runtime context in source snapshots, derives recommended local-post angles from watch/action pressure, can generate a `captain_directive` draft candidate before falling back to offer, availability, amenity, reputation, or performance angles, records manual posting proof/failure in the existing publication ledger, and exposes Suggested GBP Posts from Captain/Data Pond signals with one-click Draft Builder preparation; preserves the existing GBP source snapshot -> draft -> policy -> approval -> publication proof workflow rather than creating a parallel posting system | Ad hoc social posting ideas, disconnected content calendars, manual copy handoff outside source evidence | Extend GBP Posts first, then add channel lanes through the same approval/proof spine |
| Property Narrative Canon | Content Operations / Narrative Governance | Planning | VACS + Site Content Creator + Content Office | `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md` | Data Pond facts, DataForSEO search/environment evidence, future governed Ahrefs authority/content-gap evidence, Captain's Log and Brief, Intelligence Office directives, governed memory, Specs/site-section evidence, Website Change Watch baselines, GBP/social/email channel context | Durable property narrative source artifact covering positioning thesis, audience/intent map, proof point ledger, search/entity/AI visibility map, message hierarchy, live-site harmonization audit, content stream plan, and derivative artifact queue. Future site rewrites, VACS long-form drafts, GBP/social/email packages, FAQ/schema recommendations, Captain/Navigator content actions, and outlet publishing packages should cite and derive from the canon instead of inventing separate angles. | Venterra AI Content Suite plans, generic SEO audits, one-off blog prompts, disconnected channel drafts | Extend VACS/Site Content/Content Office; prove one property first before broad publishing automation |
| VACS content generation system | Content Operations | Planning | VACS | `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts` plus `/Users/mark/Property_Analytics/apps/web/src/app/vacs/page.tsx` | Property context, guidance, support signals, governed memory | Governed content artifacts with memory kept distinct from truth and directives, fail-closed service auth now aligned to Access service-token machine identity without VACS shared-token fallback, contract-tested payload separation, structured claims/evidence context, and a governed Pond bridge surface that exposes VACS posture, contract, shared foundations, and next moves without collapsing the API-first model into a fake full human workspace; standalone `vacs.venterradev.com` remains an architectural target | Venterra AI Content Suite plans | Extend |
| Content operations architecture and contracts | Governance / Planning | Planning | Docs + platform plans | `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md` | Architectural planning | Shared model and implementation direction | Venterra AI Content Suite | Keep |
| Specs integration model | Governance / Structural | Planning | External Specs + local docs | `/Users/mark/VenterraDev/Specs` | Governed page specs | Structural contracts, section maps, page/content/HTML standards, Captain Specs Memory inputs, and Navigator Dossier expectations for exact web/content recommendations | Site audit heuristics, DataForSEO OnPage checks, Site Content Creator | Extend |
| Generic site audit framework | Site Governance / Analysis | Specialized | scripts/site_audit | `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py` | Live page crawls | Site audit HTML/XLSX and checks | Site Content Creator, pilot harmonization | Consolidate Into Site Content Creator + Specs-aware work |
| Pilot site harmonization evidence | Site Governance / Pilot | Specialized | Pilot documentation + outputs | `/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md` | Live pilot pages and inspections | Harmonization evidence and gap framing | Generic site audit framework | Extend |
| Pilot vs control CWV program | Pilot Monitoring | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/` plus `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh` | PSI, GTMetrix, BI exports, guest cards | Daily pilot/control matrix, diagnostics, exports, email, stage-aware morning failure alerts, launchd-safe homepage-evidence execution with explicit Node path handling, per-property retry/backoff for transient homepage probe disconnects, a stage-level homepage-evidence remediation loop in the morning wrapper, duplicate-alert suppression for intentional stage exits so one pilot incident produces one truthful alert, a dedicated same-day twin GTMetrix collection/validation pass before exports, tracked GTMetrix history for the bottom main pilot reference row via a synthetic property id, and the default pilot roundup now including sister/control cohort, same-region twin-property tables, a twin KPI row, a separate bottom archetype reference block for `https://pilot.venterradev.com/`, and a single consolidated routine roundup email carrying roundup-aligned PSI + GT CSV exports with `pilot` / `sister` / `twin` / `main_pilot_reference` cohort labels instead of a separate daily export email | Portfolio-wide CWV snapshot | Extend |
| Pilot roundup reporting | Pilot Monitoring | Specialized | pilot_roundup | `/Users/mark/Property_Analytics/pilot_roundup/` | Pilot KPI and QA signals plus matched sister/control cohort signals | Daily roundup HTML/Markdown artifacts with pilot-primary plus sister/control secondary KPI rows, paired pilot+sister performance cards, and scheduled pilot mailers controlled by `PILOT_SUMMARY_EMAILS_ENABLED`; routine delivery must remain aligned in both the wrapper defaults and the live LaunchAgent environment, because launchd-pinned env vars override shell defaults | Morning report and tracker surfaces | Keep |
| Pilot tracker in main web app | Pilot Monitoring / App | Active | apps/web | `/Users/mark/Property_Analytics/apps/web/src/app/tracker/` | Pilot KPI snapshots | Integrated tracker views | Standalone pilot tracker | Extend |
| Standalone pilot tracker site | Pilot Monitoring / App | Active | pilot-tracker-standalone | `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/` | Pilot KPI snapshots | Standalone tracker deployment | Main web tracker | Consolidate Into Main web tracker over time |
| Pilot diagnostic package generation | Pilot Monitoring / Diagnostics | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/generate_pilot_diagnostic_package.py` | Cross-source pilot evidence | Diagnostic package and email preview | Pilot roundup, tracker | Keep |
| BI export normalization and missing-metric audits | Pilot Monitoring / Data Quality | Specialized | pilot_control_cwv + Data Collection | `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/` plus `/Users/mark/Property_Analytics/Data_Collection/utils/bi_manual_ingest.py` | BI dashboard exports and versioned Measurement dashboard workbooks from the shared `Guest_Card_Reports` drop | Snapshot history, audits, normalized series, backfill/catch-up ingestion of archived BI run workbooks into `bi_normalized_metrics`, canonical daily/retry-loop harvest of pending BI workbooks from the live shared drop, and robust Measurement workbook version resolution into `measurement_daily_raw_values` / `measurement_daily_metrics` so the tracker uses the newest valid `Measurement_Dashboard*.xlsx` source instead of a hardcoded filename | Tracker packaging scripts | Keep |
| Service operations control plane | Platform Ops / Service Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/service_operations_manifest.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Service ownership metadata, release lanes, trust boundaries, live health/control-plane posture | Enterprise service board for ownership, runtime, deploy target, release lane, runbook, and live pressure across canonical services | Ad hoc service knowledge trapped in docs or operator memory | Extend |
| Deployment provenance and environment drift | Platform Ops / Release Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Expected environment map, runtime observation, configured API base, access runtime policy | Deployment provenance board, drift signals, environment classification, production debug-flag detection | Release notes and ad hoc operator memory | Extend |
| Release pedigree and promoted-slice visibility | Platform Ops / Release Governance | Canonical | Watchtower + Control Plane | `/Users/mark/Property_Analytics/config/release_provenance.json` plus `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` | Source branch, baseline commit, source mode, runtime identifiers, deployment URLs | Release pedigree board, promoted-slice visibility, explicit transitional-vs-clean release posture | Implicit operator memory about what was deployed | Extend |
| Release provenance stamping bridge | Platform Ops / Release Governance | Active | scripts/update_release_provenance.py | `/Users/mark/Property_Analytics/scripts/update_release_provenance.py` | Current git state plus deployed Worker/Pages identifiers | Refreshed `config/release_provenance.json` without hand-editing runtime IDs | Manual/stale release pedigree maintenance | Extend |
| Release reconcile snapshot | Platform Ops / Release Governance | Active | generate_release_reconcile_snapshot.py | `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py` plus `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json` | Current dirty-tree paths grouped by canonical workstream rules | Dirty-tree lane counts, first clean release-shaped slice, representative path inventory | Vague release-cleanup guidance and ad hoc branch-split reasoning | Extend |
| Cloudflare edge delivery analytics | Edge Delivery Intelligence / Collection | Active | Data Collection + Data Pond | `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`, `/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml`, `/Users/mark/Property_Analytics/docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md` | Cloudflare GraphQL Analytics API `httpRequestsAdaptiveGroups`, configured zones/hostnames, governed property identity resolver | Daily source facts in `cloudflare_edge_daily_metrics` for requests, bytes, cached/uncached estimates, cache hit ratio, cache-status breakdown, edge response status buckets, and feasible top paths; integrated into `Data_Collection/orchestration/daily_master_collection.py` as graceful advisory collection with live smoke test `/Users/mark/Property_Analytics/scripts/smoke_cloudflare_analytics.py` | Cloudflare cache audit synthetic diagnostics; GA4/Heap/GSC are complementary analytics sources and are not replaced | Extend Data Collection / Data Pond; rollups and insights later |
| Cloudflare cache audit | Performance / Platform Ops | Active | Data Collection + ops/cloudflare | `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py` | Cloudflare API + GraphQL | JSON, CSV, Markdown, HTML audit outputs; now includes The Delta Pearland / `thedeltapearland.com` as an APO case-study candidate with homepage and floor-plan synthetic coverage, including post-rule warm-HIT validation | None with same maturity | Extend |
| Cloudflare full-page cache rollout tooling | Performance / Platform Ops | Active | ops/cloudflare | `/Users/mark/Property_Analytics/ops/cloudflare/` | Cloudflare auth, pilot config, WP Engine cache posture | Cache rules changes, purge, verification, and Delta Pearland APO/readiness case-study baselining through `/Users/mark/Property_Analytics/ops/cloudflare/generate_delta_apo_case_study.py`; Delta Phase 1 homepage cache rule is applied live, and enabling WP Engine Edge Full Page Cache converted synthetic HTML probes from `DYNAMIC` to warm Cloudflare `HIT` with 100% warm HIT coverage | None with same maturity | Keep |
| Edge Experimentation System | Experience Optimization / Data Pond | Active Planning | Data Pond + Site Content Creator + EVS + Cloudflare Ops | `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md`, `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md`, `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md`, `/Users/mark/Property_Analytics/docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md`, `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md`, `/Users/mark/Property_Analytics/apps/api/migrations/0039_create_edge_experimentation_tables.sql`, `/Users/mark/Property_Analytics/infra/migrations/026_create_edge_experimentation_tables.sql`, `/Users/mark/Property_Analytics/packages/shared/src/experiment-schemas.ts`, `/Users/mark/Property_Analytics/apps/api/src/routes/experiments.ts`, `/Users/mark/Property_Analytics/apps/web/src/app/experiments/page.tsx`, `/Users/mark/Property_Analytics/apps/web/src/app/experiments/edge-messages/page.tsx`, `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js`, `/Users/mark/Property_Analytics/docs/EDGE_MESSAGE_TOOLKIT_2026-05-23.md` | Data Pond property identity, Specs/Site Content Creator component contracts, Cloudflare Worker execution telemetry, Zaraz/GA4/Heap experiment events, EVS preflight/post-launch proof, CWV and conversion guardrails | First non-mutating implementation slice exists: Data Pond stores experiment drafts, variants, component contracts, telemetry/guardrail/decision/learning tables; `/v1/experiments` lists and creates governed drafts, promotes matched/partial Site Content CTA targets and Specs-derived global/page targets into active experiment component contracts using `target_label`, records EVS preflight requests/checklists, and generates preview-only Worker dry-run configs; `/experiments` provides an admin-only Experiment Lab with a human-facing `What Can We Test?` environment grouped by Header, Mobile Menu, Pages, and Footer, expanding Specs-defined nav/header/footer/hero targets plus recognized Site Content CTA labels into separate testable items. A narrow beta Worker, `edge-transparent-pricing-intro-beta`, was re-enabled for Apex / `GA4AX` on `pilot.venterradev.com/apartments*` and `/apartment*` as version `dac90122-4bc7-4493-a1f9-573f2833a907` / config `2026-05-23-beta-3-clean-test-url` after rollback and hardening for the prior unit-loading concern, then disabled again as version `6181471a-a26c-4402-88c9-ef0ac927b269` and route bindings were removed while the pilot hero/title target was reviewed. The homepage modal is now live on the pilot homepage; current Worker version `3a19688f-51eb-445b-aae5-8e25969bd935` has a `POP_BRIEF_DB` binding and reads active D1 config from `edge_experiment_config_versions`, with hard-coded approved config as fallback. Cloudflare route is `pilot.venterradev.com/*`, with exact-path `/` homepage modal injection and exact-path `/apartments/` coach-mark injection. The homepage experience id is `edge_transparent_pricing_intro_homepage_v1` so the clean homepage URL displays without test parameters despite prior beta-test cookies/localStorage. Authentic-logo measured homepage impact is `+11,589` raw HTML bytes / `+5,223` gzip HTML bytes / `+4,208` browser document transfer bytes, with no external popup requests and effectively neutral measured load-time impact. Current source uses a non-blocking notice posture with no `aria-modal`, focus trap, autofocus, or outside-click interception, overlay click-through, and clean force/reset query handling via short-lived Worker-only cookies. Current modal layout is property name top-center, no top logo, large two-line `Say hello to clearer` / `monthly pricing` headline, centered body/disclaimer, `Closing in 7 seconds`, progress bar, and bottom Venterra/Velo mark; smoke confirmed no browser errors. Testing always-show mode remains active with `ignoreFrequencyCap: true` for both homepage modal and apartment coach mark. A second proof, `edge_message_all_in_pricing_coachmark_v1`, is live on exact path `/apartments/` as an anchored coach mark above the first visible `All-In Price & Details` button; browser proof retained `47` visible all-in buttons / `47` availability nodes. The capability is memorialized as the `Edge Message Toolkit`, with admin nav `Edge Messages`, first Pond admin surface `/experiments/edge-messages`, and future id pattern `edge_message_<initiative>_<surface>_vN`. The Edge Messages surface inventories the two live beta proofs and provides editable content/style/placement/delivery/timing/decoration/frequency controls with preview; launch/pause/rollback remain disabled until approval workflow, EVS preflight, and benchmark gates are wired, but the config publish/read path is now wired for this beta surface. The admin surface is live on Cloudflare Pages deployment `9aaf825f.property-analytics.pages.dev`, with operator route `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. Style controls include title, body, fine-print, and on-color text colors plus fixed official brand swatches alongside the free picker; swatches are restricted to the official Venterra palette plus black and white. Type size controls provide one-pixel steppers for property, title, body, fine-print, and countdown text. The coach-mark defaults now align to the live Worker style: `#3D66B9`, `#7DCAC2`, and 14px title/13px body text. Admin edits now use `Save & Publish`, which stores a local draft and posts the exact draft to `POST /v1/experiments/edge-messages/:messageId/live-config`; API Worker version `8f0af5e6-86ce-463e-9b27-aec8618ba4e7` validates and writes active Worker-ready rows to D1. Preview scenes are separated by message shape: modal previews use the homepage hero context without the apartment all-in button, and coach-mark previews use a dedicated apartments-list screenshot asset with the bubble aligned to the first visible `All-In Price & Details` button. Fresh-browser clean `https://pilot.venterradev.com/apartments/` still lacks the production-style hero/title with the Worker removed, while production `https://venterraliving.com/apartments/apex-west-midtown/` has the Apex hero/title and the matching pilot property slug returns `404`; apartment route hero/template remains out of scope until the intended pilot route/template is confirmed. Remote D1 has the table family. Broader live experimentation remains intentionally gated until EVS proof and dry-run review are complete | Standalone A/B tools, arbitrary client-side experimentation snippets, shadow CMS behavior, one-off property maps, and ungoverned selector-based changes | Extend Site Content Creator + EVS + Cloudflare/Data Collection rather than parallel-build |
| EVS experiential validation service | Validation / QA | Specialized | EVS + apps/api | `/Users/mark/Property_Analytics/evs/` plus `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx` | BrowserStack, pilot property profiles, API requests | Staging-first validation requests and results; governed Pond workspace now supports request creation, lifecycle visibility, mixed human request + machine ingest posture, and explicit external-orchestrator handoff while deeper workflow dispatch remains an explicit follow-on decision | Ad hoc screenshot-based testing | Extend |
| BrowserStack orchestration and ops | Validation / QA | Specialized | EVS + ops/browserstack + Captain Engineer/Experience Watch | `/Users/mark/Property_Analytics/ops/browserstack/` | BrowserStack credentials, profile definitions, Captain property context, Specs expectations, post-change validation needs | Validation execution support; Captain Engineer/Experience Watch proof for mobile/desktop rendering, forms, CTAs, specials visibility, screenshots, and post-change validation; should be surfaced to the Captain as current/stale/blocked lane status | Standalone screenshots and manual checks | Extend |
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
6. If the work produces or emails a report, what is the existing report-family shell/sender/orchestrator, and are we extending that instead of creating a one-off send path?

## 5. Recommended Next Documents

The next high-value documents to create from this register are:

- a report family map
- a system retirement / archive candidate list
- a platform roadmap grouped by canonical owner
- a branch split / release shaping map for large parallel workstreams, now started in `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`

## 6. Recent Capability Shaping Notes

- `PIB Site Evaluation`
  - disposition: approved intro standard inside canonical property-level PIB v2.2.0 when evaluation evidence is available
  - owner: PIB + Data Pond / DataForSEO evidence lanes
  - standard: `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`
  - implementation:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
  - current capability:
    - gathers property-code-resolved DataForSEO demand/ranked keyword/OnPage/business context, GSC branded-vs-nonbrand mix, and BI box score context into the PIB payload
    - renders a concise `Bottom Line`, `Main Reasons`, and `Action Focus` intro before KPI tiles so the rest of the PIB reads as supporting source detail
    - preserves explicit source distinction when Google Ads API detail is missing but BI spend/source-performance evidence exists
  - boundary:
    - no new PIB renderer, sender, or alternate report family was created
    - locked canonical PIB v2.2.0 files were changed only under explicit current-task user approval

- `PIB v2.3.0 ApartmentIQ Market Enrichment`
  - disposition: approved next canonical PIB version under explicit current-task user approval
  - owner: PIB + Data Pond / ApartmentIQ advisory market lane
  - implementation:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_0.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_0.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_0.py`
  - current capability:
    - resolves PIB properties through the governed property identity matrix before querying ApartmentIQ rows
    - renders a dedicated `ApartmentIQ Market Enrichment` section with advisory competitive pricing, exposure, market-visible leased estimate, listed offers, review rating, nearest complete peers, offer pressure, Unit-Type Offer Pressure table, fee/deposit examples, and amenity differentiators
    - intentionally excludes ApartmentIQ subject inventory/pricing/floorplan pulse from PIB because internal empirical Pond sources are authoritative for those facts
    - includes ApartmentIQ in PIB data coverage, freshness, and methodology with an explicit advisory-only boundary

- `PIB Section Catalog / Future Builder`
  - disposition: approved planning standard for self-serve PIB section selection
  - owner: PIB + The Pond, using canonical PIB generation/rendering boundaries
  - standard:
    - `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`
    - `/Users/mark/Property_Analytics/config/pib_section_catalog.json`
  - current capability:
    - defines stable section ids, always-on report identity/source/methodology elements, and starter presets for `Full PIB`, `Website / Funnel Review`, `Leasing / Inventory Review`, `Market Context`, and `Reputation / Local Presence`
    - memorializes `ApartmentIQ Market Enrichment` as section id `apartmentiq_market_enrichment`
    - memorializes `Search Market Visibility` as section id `dataforseo_search_visibility`
  - boundary:
    - this is a catalog/planning artifact only; it must not be used to justify a parallel PIB renderer, sender, or app-side report family

- `PIB v2.3.0 Search Market Visibility`
  - disposition: approved advisory DataForSEO section inside the next canonical PIB version
  - owner: PIB + Data Pond / DataForSEO Search Intelligence lane
  - implementation:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_0.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_0.py`
  - current capability:
    - resolves the PIB property to the governed marketing/property code and reads local DataForSEO SERP, keyword metrics, Labs ranked keywords, OnPage snapshots, Business Profile rows, and AI visibility probes
    - renders `Search Market Visibility` with Keyword Demand + Rank Check, Live SERP Visibility, SERP Pressure, DataForSEO Labs Ranked Keywords, OnPage Readiness, Local Entity Read, and AI Answer Visibility
    - Northbridge proof uses fresh 2026-05-22 DataForSEO rows
  - boundary:
    - DataForSEO is advisory outside-in search-market evidence; GSC, GA4, Google Ads, and Pond operating sources remain authoritative for their respective facts

- `PIB v2.3.1 Locked Standard`
  - disposition: locked canonical next version under explicit current-task user approval
  - owner: PIB + Data Pond advisory enrichment lanes
  - standard:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/docs/PIB_V2_3_1_LOCKED_STANDARD.md`
  - implementation:
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_1.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_1.py`
    - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_1.py`
  - current capability:
    - locks the approved ApartmentIQ Market Enrichment section
    - locks the approved DataForSEO Search Market Visibility section with full-width readable lower blocks and `AI Answer Visibility`
  - boundary:
    - future changes to v2.3.1 section presentation require explicit approval and standard updates
  - boundary:
    - no app-side or alternate PIB renderer was introduced
    - v2.2.0 remains intact
    - ApartmentIQ does not replace internal source-of-truth operating, availability, guest-card, BI, or GA4 facts

- `EVS Round 1 map-pin feed geo validation`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and use ThirtyLines feed truth instead of a separate property geo config
  - owner: EVS + BrowserStack orchestration + Data Pond source truth
  - implementation: `/Users/mark/Property_Analytics/scripts/export_evs_property_contact_truth.py`, `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`, `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`
  - latest addition:
    - the source-truth export now includes feed latitude/longitude
    - `portfolio_functionality_regression` receives feed-backed property truth
    - workbook row `141` compares rendered Location page/schema/map coordinates to feed lat/long and records coordinate evidence rather than skipping for missing config

- `EVS Round 1 line-requirement totality audit`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and keep the official workbook row contract as the governing checklist
  - owner: EVS + BrowserStack orchestration + Data Pond source truth + forms/lead-attribution QA lanes
  - implementation: `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`, `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`, `/Users/mark/Property_Analytics/evs/reports/round1-line-requirement-coverage-audit-20260520-v2.json`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_totality_audit_v20.mjs`
  - latest addition:
    - every Round 1 row tagged `Functionality` or `Data Integrity` has been audited for workbook status coverage across all `22` property tabs
    - the Carlyle Place gap created by its later batch inclusion is closed with portfolio and Apartments & Pricing evidence on desktop and iPhone
    - workbook v20 has no blank EVS-owned Functionality/Data Integrity statuses; remaining non-pass rows are either observed failures, inspected review items, or governed AH/EAI downstream-proof lanes
    - rows `175-178` are preserved as intentional synthetic lead / AH-EAI reconciliation checks rather than generic skipped automation
    - initial-round DNI phone attribution is now explicitly failed on workbook rows `8`, `61`, and `161` across all `22` property tabs, while row `165` remains a no-submit required-field validation pass
    - supplied workbooks are now governed as fill-only artifacts; non-native evidence is stored under local EVS evidence packages, with `/Users/mark/Property_Analytics/evs/orchestration/create-local-evidence-package.mjs` indexing supporting files by role/path/hash and batch runs automatically writing `local-evidence-package/evidence-manifest.json`
    - `/Users/mark/Property_Analytics/evs/orchestration/validate-workbook-fill-only.mjs` now verifies that a filled workbook changed only allowed cells; it caught the extra `EVS Findings Summary` tab in v22, after which v23 was rebuilt from the supplied workbook and passed validation with `0` violations
    - `/Users/mark/Property_Analytics/evs/orchestration/run-dni-phone-probe.mjs` now provides a no-submit DNI phone probe with screenshots enabled by default; smoke proof on `OK4AN` / `APL` failed correctly because runtime attribution selected the source phone but the visible/tel phone did not change, and the Round 1 one-source screenshot probe recorded `22` Fail / `0` Pass with `44` screenshot artifacts and no form submissions
    - `/Users/mark/Property_Analytics/evs/orchestration/build-round1-audit-support.mjs` now generates local root-cause summaries, evidence-completeness scoring, and a DNI screenshot contact sheet; focused npm presets exist for DNI, forms validation, sort order, SightMap, and availability retest lanes
    - workbook v25 is the current tightened fill-only turn-in artifact: `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx`; it passed fill-only validation with `0` violations and uses cleaner EVS status wording
    - row `79`/`80` verdicts now fail when displayed unit layout/pricing is not source-backed by Pond, row `85` now fails when changing floors does not update observed units, and row `102` uses a no-submit Prospect Portal DayPicker/lease-criteria proof before deciding whether expected unit context is observable
    - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520-v25/` now adds delivery summary, root-cause summary, evidence completeness, DNI review CSV, and DNI screenshot contact sheet for local team triage while the supplied workbook remains fill-only

- `EVS Round 1 specials-toggle applicability`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and use ThirtyLines feed truth to distinguish not-applicable checks from skipped automation
  - owner: EVS + BrowserStack orchestration + Data Pond source truth
  - implementation: `/Users/mark/Property_Analytics/scripts/export_evs_property_contact_truth.py`, `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_findings.mjs`
  - latest addition:
    - the source-truth export now includes feed `propertyBannerSpecial`
    - workbook row `4` returns `not_applicable` / `N/A` when no feed special exists and no Specials toggle candidate is visible
    - if a feed-backed special exists but no toggle is detected, the row remains testable and does not collapse into `N/A`
    - workbook v7 applied `N/A` to `20` Round 1 property tabs with blank feed specials while leaving `Avasa Grove West` testable because it has a populated feed special

- `EVS Round 1 data-integrity verdict scoping`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and keep data-integrity verdicts tied to their specific source-backed facts
  - owner: EVS + BrowserStack orchestration + Data Pond source truth
  - implementation: `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_data_integrity_scope.mjs`
  - latest addition:
    - rows `79` and `80` now pass when all displayed units are source-backed and layout/rent mismatches are zero, even if Pond has extra units not rendered
    - Pond-only units missing from the site are tracked under row `81` Availability rather than duplicating the same concern onto layout/pricing
    - displayed units missing from Pond still keep rows `79`/`80` in review because their layout/pricing cannot be source-validated
    - workbook v8 reflects the scoped verdicts: row `79` is `13` Pass / `8` Review, row `80` is `4` Pass / `17` Review, and row `81` remains the availability gate at `4` Pass / `17` Review
    - follow-up row `81` availability classification now hard-fails source-backed unit-set, rendered/structured count, or available-date mismatches because Pond/feed availability is available; workbook v14 records the prior evidence set as `17` Fail / `4` Pass

- `EVS Round 1 sort and floor filter failure classification`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and classify deterministic broken UI behavior as launch-blocking failure rather than review
  - owner: EVS + BrowserStack orchestration
  - implementation: `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_findings.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_sort_floor_failures.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_sort_floor_retest.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_sort_order_retest.mjs`
  - latest addition:
    - rows `83`, `84`, and `85` were initially promoted to failure from passive BrowserStack evidence, but user manual QA confirmed the List View sort, Grid View sort, and floor-change workflows work and are observable
    - workbook v12 now marks the 21 prior-evidence properties as `Manual QA PASS` for rows `83`, `84`, and `85`; Carlyle Place remains blank until it is included in a run/manual pass
    - the runner no longer emits a hard fail from passive/default sort or narrow floor-filter evidence; future hard failure requires active workflow proof
    - follow-up correction separated sort correctness from sort UI operability: rows `83` and `84` now hard-fail when rendered units do not follow size, move-in date, then price order; current retest `round1-sort-order-local-20260520T1258` records `20` Fail / `2` Pass and workbook v19 reflects that evidence, while row `85` floor-filter behavior remains separate

- `EVS Round 1 unit-specific Apply Now failure classification`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane and classify missing unit context in a unit-specific application handoff as failure
  - owner: EVS + BrowserStack orchestration
  - implementation: `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_findings.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_unit_specific_apply_failures.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_unit_specific_apply_retest.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_row102_apply_retest.mjs`
  - latest addition:
    - row `102` now checks the landed Pipeline/Prospect Portal page for the expected unit number/source unit identifier instead of relying only on whether the outbound href contains unit context
    - a missing unit context still fails after landed-page verification, but the previous URL-only evidence is treated as insufficient
    - workbook v11 moved the prior row `102` hard fails back to `Review` with a retest-required note until the improved runner collected landed-page proof
    - follow-up targeted retest `round1-row102-unit-apply-local-20260520T1135` checked desktop and iPhone-shaped unit detail Apply Now behavior for all Round 1 properties and passed `22/22`; workbook v17 records row `102` as `Pass` on all property tabs

- `EVS Round 1 form action checks`
  - disposition: preserve broad lead-attribution submission sweeps as paused while allowing controlled one-source form action confirmation and no-submit validation testing
  - owner: EVS + forms QA + lead-attribution QA
  - implementation: `/Users/mark/Property_Analytics/scripts/import_portfolio_qa_contract.py`, `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`, `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`, `/Users/mark/Property_Analytics/tmp/spreadsheet_update/update_round1_contact_form_validation.mjs`
  - latest addition:
    - row `165` Required Field Validation is now classified as `no_submit_validation_only` and ready for the `contact_form_checks` runner
    - row `164` Contact Form Submit remains `form_submission_required` with explicit governed synthetic-submit flags and downstream AH/EAI reconciliation
    - one-source attribution action smoke remains available through `lead_attribution_e2e`: generated `?id=<trackingId>` URL, expected feed phone evidence, recipient evidence where exposed, synthetic draft/submit, acknowledgement capture, and downstream confirmation fields
    - follow-up no-submit contact validation retest `round1-contact-validation-local-20260520T1245` passed row `165` for `22/22` Round 1 properties; workbook v18 records row `165` as `Pass` and row `164` as governed-submit pending `Review` instead of generic `Skipped`

- `EVS Round 1 media interaction coverage`
  - disposition: extend the existing EVS / BrowserStack portfolio QA lane rather than leaving browser-observable media interactions in a deferred media-only bucket
  - owner: EVS + BrowserStack orchestration
  - implementation: `/Users/mark/Property_Analytics/scripts/import_portfolio_qa_contract.py`, `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`, `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`
  - latest addition:
    - Round 1 workbook rows for Matterport/Virtual Tour, unit-detail photo modals, Features camera photos, and Amenities camera photos are now EVS-owned where the assertion is browser-observable functionality
    - the runner closes prior media overlays between checks, recognizes UIkit/lightbox/modal gallery surfaces, and records modal-image evidence
    - property-specific image correctness remains a human/media review item even when EVS proves image presence/rendering
    - row `155` review-date sort evidence now distinguishes source/DOM newest-first order from masonry visual card placement; workbook v15 clarifies the five existing review warnings as layout/read-order review items rather than source-sort failures

- `GSC core indexation warning`
  - disposition: extend canonical Data Collection monitoring rather than creating a parallel SEO alert or report family
  - owner: Data Collection / monitoring
  - implementation: `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
  - latest addition:
    - daily alerting now evaluates stored `gsc_url_inspection` results for true business-risk indexation issues: canonical property homepage/core URL not indexed, no sampled URL returning PASS for a reportable property, or explicit robots/noindex signals
    - benign Search Console exclusions such as redirects, alternate canonicals, specials pages, and other non-core URL states remain non-escalating
    - the consolidated morning alert preview includes a `Core Indexation Warnings` tile and renders a dedicated GSC Core Indexation Warnings section when risks exist
    - 2026-05-14 verification found `0` active core indexation warnings across the live/profile-backed portfolio

- `Portfolio functionality QA`
  - disposition: extend EVS / BrowserStack rather than creating a parallel QA system
  - owner: EVS + Engineer / Experience Watch, with explicit media/forms/lead-attribution owner lanes
  - latest addition:
    - `/Users/mark/Property_Analytics/scripts/import_portfolio_qa_contract.py` imports Functionality and Data Integrity rows from `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`
    - `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json` preserves the `45` official workbook checks (`43` Functionality and `2` Data Integrity) with row lineage, ownership, assertion type, truth sources, devices, side-effect policy, and automation status
    - `/Users/mark/Property_Analytics/scripts/import_round1_qa_batch.py` imports `/Users/mark/Downloads/Round 1 QA.docx`, reconciles against workbook tabs, resolves identities through the governed matrix, and writes `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`
    - `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json` defines the first pilot production batch, the `round_1_property_websites` batch, and the future URL-list input contract
    - `/Users/mark/Property_Analytics/evs/orchestration/build-portfolio-qa-plan.mjs` produces batch execution plans for pilot properties or future URL lists
    - `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs` executes arbitrary URL-list batches and writes per-target/profile/device evidence under `evs/reports/<run_id>/`
    - Round 1 Pond exports are now target-scoped for URL-list batches; first-property proof for Anatole (`OK4AN`) exports `11` Pond units and clears rows `79-81` on desktop and iPhone
    - mobile runtime classification now ignores cancelled third-party Matterport/SightMap/font media requests for EVS functionality classification, preserving those concerns for the media owner lane
    - reviews row `155` now parses rendered review date text and records DOM order versus visual card order; this catches desktop masonry layouts where source order is newest-first but direct visual scan order is not
    - `contact_form_checks` is now a separate guarded forms lane: default batches exclude it, `EVS_INCLUDE_FORMS=1` includes it, and `QA_INCLUDE_OWNERS=forms_qa EVS_RUN_PROFILES=contact_form_checks` reruns only form checks; actual submissions still require explicit synthetic-submit controls
    - shared EVS schemas, API profile metadata, web profile options, and persistence constraints now recognize `contact_form_checks`; migration `0053` seeds `contact_form_checks_v1` as a draft forms-only evaluation set separate from the default portfolio audit
    - `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs` now executes `portfolio_functionality_regression`, desktop `apartments_pricing_deep_journey`, and iPhone-first `apartments_pricing_mobile_journey`, with Pond availability source hooks, bounded per-check execution, and mobile row checkpointing
    - `/Users/mark/Property_Analytics/evs/orchestration/run-pilot-browserstack-smoke.mjs` now enforces a per-property BrowserStack timeout for durable batch behavior
    - `/Users/mark/Property_Analytics/scripts/export_evs_pond_availability.py` exports latest governed `unit_availability_units` rows from `/Users/mark/Property_Analytics/data/portfolio_analytics.db` after resolving Pilot properties through the property identity matrix
    - `/Users/mark/Property_Analytics/scripts/export_evs_property_contact_truth.py` exports governed ThirtyLines `officePhone`, `conciergePhone`, `pipelineURL`, and `tourURL` values for source-backed header/footer checks
    - `/Users/mark/Property_Analytics/evs/config/lead-attribution-e2e.json` and `/Users/mark/Property_Analytics/scripts/export_evs_lead_attribution_truth.py` define a separate dormant lead-attribution E2E lane that uses ThirtyLines `trackingCodes` to generate `?id=<trackingId>` advertiser URLs and verify tracking ID, phone swap, recipient email, synthetic form drafts, optional governed form submissions, browser validation state, and on-page acknowledgement evidence
    - `/Users/mark/Property_Analytics/apps/api/migrations/0053_create_evs_batch_result_tables.sql` adds reusable EVS evaluation sets, batches, targets, profile/device runs, source-truth snapshots, and row-level findings; the current workbook-backed evaluation set is seeded as `portfolio_functionality_qa_v1`
    - `/v1/evs/evaluation-sets`, `GET /v1/evs/batches`, `POST /v1/evs/batches`, and `/v1/evs/batches/:batchId` create and expose the durable records needed for future EVS result display
    - `/Users/mark/Property_Analytics/docs/PORTFOLIO_FUNCTIONALITY_QA_SYSTEM_2026-05-12.md` documents the system boundary and next build slices
  - operator significance:
    - the QA workbook is now a governed source contract rather than an ad hoc manual checklist
    - Round 1 is prepared as `22` Kinsta target URLs under `round_1_property_websites`; `Carlyle Place Apartments` is included through the governed confirmed-extra target file after user confirmation because it was present in the workbook but absent from the initial Word doc
    - Round 2 is prepared as `21` reachable Kinsta target URLs under `round_2_property_websites` from `/Users/mark/Downloads/Round 2 Portfolio Rollout.docx`; Pastel links are excluded from EVS execution, Monteverde remains pending because the source doc did not include a staging URL, and `Creekside Apartment Homes` was added as a governed alias for `Creekside`
    - EVS can store first-batch property URL lists under the same evaluation set, with source truth and findings queryable by property, check, status, profile, device, and workbook row
    - form checks are now runnable as a different run lane: required-field validation can run no-submit, while contact-form submission can be toggled on later and rerun independently when the form issue is resolved
    - lead-attribution testing is deliberately separate and dormant-by-default: generated advertiser URL and synthetic form-draft checks can run without submit, while actual submissions require explicit synthetic identity configuration and approval
    - the first Calais `TX4MIALIST` / `APL` governed submit proof now has a corrected audit trail: the 15:24Z attempt is marked blocked by missing `Number of Beds`, and the 15:29Z corrected attempt captured acknowledgement text and is pending downstream outlet confirmation
    - Calais `TX4MIAR` / `APR` was submitted as the next source with the updated `venterradev.com` sender-domain convention and captured acknowledgement text; the combined submission ledger is `/Users/mark/Property_Analytics/evs/reports/lead-attribution-calais-submission-ledger-20260513T104216.csv`
    - broad BrowserStack production pilot proof is green on desktop and iPhone; header/footer navigation is now source-backed against the feed; desktop and dedicated mobile deep proof now surfaces sort-order, similar-homes, unit-context, and source-backed availability findings
    - EVS-owned checks can bind to Pond availability today and future property geo config for deterministic pass/fail
    - image/media checks, contact-form tests, and AH/EAI lead-attribution proof remain visible but are not falsely treated as unattended EVS passes
    - launch batches should provide URL lists into this lane instead of adding one-off BrowserStack scripts

- `Captain active routine governance`
  - disposition: active Captain Runtime / Data Pond orchestration layer
  - owner: Captain Runtime + Data Pond + MarketingOps
  - latest addition:
    - `/Users/mark/Property_Analytics/docs/CAPTAIN_ACTIVE_ROUTINES_AND_SOURCE_VALIDATION_STANDARD_2026-05-09.md` defines the active Captain routine contract
    - `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json` lists required routines, cadences, roles, source lanes, freshness bands, and outputs
    - `/Users/mark/Property_Analytics/scripts/audit_captain_active_routines.py` audits local Data Pond source readiness for active Captain routines without creating a parallel report family
    - proof outputs were generated under `/Users/mark/Property_Analytics/reports/captains_log/routines/`
  - operator significance:
    - Captains now have a governed routine framework for watching source readiness, property memory, funnel leakage, inventory/product fit, channel efficiency, website/content/SEO posture, competitor pressure, reputation friction, experience validation, and action proof loops
    - local Data Pond source readiness is intentionally separated from remote D1 runtime readiness, which remains covered by `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`
    - approved report families remain locked; this layer improves the intelligence feeding them rather than replacing their format

- `Fleet Scribe + expert bench governance`
  - disposition: active report orchestration / decision-science governance layer
  - owner: Fleet Scribe Office + MarketingOps
  - latest addition:
    - `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_AND_EXPERT_BENCH_STANDARD_2026-05-09.md` defines the final publication chain and expert consultation model
    - `/Users/mark/Property_Analytics/config/fleet_scribe_expert_bench_manifest.json` defines the expert bench and single algorithm adjustment points
    - `/Users/mark/Property_Analytics/scripts/audit_fleet_scribe_expert_bench.py` audits expert-bench readiness from Captain routine source posture
    - `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md` now names the Fleet Scribe as official report/archive owner and adds the specialist expert roles
    - `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md` details the office structure and current directive settings for each bench specialty
  - operator significance:
    - final reports are produced by Fleet Scribe after Captain Read, Commodore Review, Fleet Review, and targeted expert-bench consultation
    - expert lanes isolate tuning points for source authority, leasing performance, revenue/pricing, media efficiency, SEO/content, competitor intelligence, product readiness, reputation, resident experience, technical validation, seasonality, unit-type fit, elasticity, operational capacity, proof/claims, and peer borrowing
    - approved report-family templates remain locked; the bench improves the governed inputs and recommendations without becoming a parallel artifact family

- `Property diagnostic JSON data layer`
  - disposition: active Data Pond read model / v1 VP data contract
  - owner: `Data_Collection` + Data Pond
  - latest addition:
    - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now produces a retrieval-first JSON object for a governed property identity
    - first output: `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json`
    - the v1 Elation object includes demand, funnel conversion, inventory/product, demand-vs-inventory matching, pricing/market position, marketing efficiency, reputation/product friction, website performance, derived flags, source references, and explicit missing-data fields
    - source lanes include Marketing BI Traffic Conversions, Marketing Ops Summary, GA4, unit availability, spend/cost workbooks, competitor market research, Reputation.com, GBP sentiment, and DataForSEO on-page snapshots
    - 2026-05-06 expansion added Marketing BI source/origin performance and T365 move-ins-by-source tables via `/Users/mark/Property_Analytics/apps/api/migrations/0045_create_marketing_bi_source_performance.sql`, `/Users/mark/Property_Analytics/infra/migrations/032_create_marketing_bi_source_performance.sql`, and `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py`
    - Elation now carries source/origin guest-card, visit, application, lease, C&D, and move-in rows from `perf-region.xlsx`, plus T365 actual move-ins by marketing/conversion source without storing resident names
    - `/Users/mark/Downloads/Month by Month Adv spend per property.xlsx` now populates `marketing_bi_monthly_ad_spend_source_rows`, closing source-level ad spend for Elation with month/source spend, monthly total, budget, and actual-vs-budget
    - 2026-05-06 gap-fill reports added Portfolio Box Score, T90 Service Delivery, and Abandoned application detail tables through `0046_create_marketing_bi_gap_fill_tables.sql` / `033_create_marketing_bi_gap_fill_tables.sql`; Elation now carries make-ready percentage and service-delivery posture while abandoned exports remain unattributed because the source export has no property column
  - operator significance:
    - this gives the VP request a testable agent input layer separate from Captain Brief presentation
    - missing fields are carried as structured data, not prose, so downstream testing can see exactly which source route is absent
    - this does not mutate locked PIB generation/rendering/sending files

- `Spotlight and pilot Captain activation`
  - disposition: active Captain's Log runtime expansion
  - paths:

- `Captain/Pond late-funnel terminology`
  - disposition: display-language standardization
  - note:
    - user-facing reporting now prefers `PQ` (`Price Quote`) over `RFP`
    - underlying Marketing BI source fields remain `rfp_*` for compatibility
    - `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`
    - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-04-29.sql`
    - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-04-29.json`
    - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
  - purpose:
    - activate property-scoped Captains for all current April Spotlight properties and the five documented pilot properties
    - seed governed Captain memory, identity bindings, and the 10-lane support-agent roster per property

- `Watchlist companion workbook v1.2`
  - disposition: active Watchlist evidence attachment standard
  - owner: `reports/captains_log` + Data Pond
  - latest addition:
    - `/Users/mark/Property_Analytics/docs/WATCHLIST_COMPANION_WORKBOOK_STANDARD_V1_2_2026-05-07.md` memorializes the companion workbook structure
    - Elation proof artifact: `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_v1_2_2026-05-07.xlsx`
    - v1.2 adds a `Demand_vs_Availability` workbook tab and promotes `T30 GC / Available Unit` plus `T7 GC / Available Unit` into the Summary sheet
    - `available_unit_interest_metrics` now preserves bedroom-level rows through the governed available-interest route with a `bedrooms` field
    - Captain Brief property-total reads now filter available-interest facts to `current_level = 'Property'`
  - operator significance:
    - the email remains the human Watchlist Decision Output
    - the workbook is the auditable data companion for analysts and reviewers
    - the companion workbook does not create a parallel PIB renderer or mutate locked PIB files

- `Watchlist shared repository`
  - disposition: active shared artifact repository
  - owner: `reports/captains_log` + Data Pond
  - latest addition:
    - shared path: `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data`
    - standard doc: `/Users/mark/Property_Analytics/docs/WATCHLIST_SHARED_REPOSITORY_STANDARD_2026-05-07.md`
    - repository guidance: `00_README/README_Watchlist_Data_Repository.md`
    - daily BI checklist: `00_README/Daily_BI_Export_Checklist.md`
  - operator significance:
    - this is the shared repository/publication layer for source drops, current reports, companion workbooks, JSON artifacts, source logs, and archive
    - Data Pond remains the system of record after ingestion
    - report-family emails should link to repository files where practical instead of attaching large artifacts

- `Multifamily SEO + Local Content Action Standard`
  - disposition: active additive content-action lane
  - owner: Data Pond + Site Content Creator + Watchlist/Captain reporting
  - latest addition:
    - `/Users/mark/Property_Analytics/docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md` memorializes the VP's industry-specific SEO/GEO/AEO/AIO rules as a governed system standard
    - `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py` now renders a compact `SEO + Local Content Action Pack` in Watchlist Decision Output v1.1
    - `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md` now includes the section as part of the required report shape
  - operator significance:
    - SEO/content recommendations must now connect to actual inventory pressure, funnel condition, offer/value posture, competitor pressure, and live page evidence
    - the lane produces exact copy/content actions without creating a separate SEO renderer or mutating locked PIB files

- `Watchlist Decision Output v1.1`
  - disposition: active Watchlist report-family renderer and email standard
  - canonical renderer: `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_decision_output.py`, `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py`
  - canonical sender: `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py`
  - standard: `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md`
  - v1.1 recoveries:
    - stale static examples are reference-only, not live report inputs
    - shared repository links render quietly at the bottom
    - `Recommendation Guardrails` replaces the prior off-putting section title
    - governed source display aliases are enforced for `Apartments.com / ADC` and `Walk-In / Drive-By`
    - user-facing `RFP` language is removed from Watchlist output
    - top recovery KPI language now uses `Net Leases Needed` rather than `Net Move-ins Needed`
    - make-ready / vacant-ready returns to the KPI block when available
    - the secondary evidence appendix now carries compact GA4 website-demand cards, GBP local-demand/action cards, and enhanced PSI/Core Web Vital trend rows using current T30 vs prior T30 or latest-vs-prior PSI movement
    - The Pointe v1.1 test was sent with no attachments through the Watchlist sender; message id `8207e82a-e630-4d3f-919b-441aa8699583@property-analytics.local`
    - keep the roster tied to the property identity matrix rather than one-off local property maps
  - current use:
    - remote D1 now has 28 active Captain properties and 280 active support agents
    - the deployed Worker can execute property-specific agent keys by suffix, preserving Benton while enabling non-Benton Captains
  - latest deployment:
    - Worker version `593c0b52-a019-4f55-9e3f-ed471d8f8427`
    - daily schedule `15 12 * * *`
    - weekly schedule `45 13 * * 1`
  - boundary:
    - Captain runtime reads mirrored evidence and writes watch/action/run state
    - paid DataForSEO, BrowserStack, and other heavy external pulls remain in Data Collection / EVS and should be mirrored into Captain evidence lanes

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
    - the shared T7/T30 operator surface now also inherits the same sticky header shell and upcoming-Friday plus Spotlight-property defaults used elsewhere in the POP Brief lane

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
- `PIB-style daily copy-change impact briefs`
  - disposition: specialized, active refinement
  - latest direction: quick-read SEO impact monitor prioritizing direct matched-window evidence in the email surface
  - current expectation:
    - top `Early Positive / Early Mixed / Early Softness` cards
    - per-property day-prior and since-change movement
    - data-rich `T7` and `T14` matched-window summaries

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
    - the POP Brief title block now carries the icon beside the title, stacks the selectors above `Navigate`, and uses the final operator-facing subtitle `Property Operations Performance Brief` with `by MarketingOps` on a lighter sub-line
    - the shared POP Brief header shell now also drives the Marketing and T7/T30 pages so the date/property selectors sit on one line and `Navigate` sits on the next line aligned right across the live POP Brief lane
    - the redundant POP Brief navigation card was then removed from the main `/analysis` page so the sticky header dropdown is the single movement control and the screen opens directly into the brief content
    - the shared POP Brief date picker now renders on an opaque elevated popover surface and closes immediately after a Friday is selected
    - the Communities page now leads with the active monthly Spotlight property block and shows the exhaustive community list below it, instead of leading with an add-community form
    - the Marketing page now shares that same header/default treatment while restoring the sectioned Base44 `marketing_data` editor as the primary surface; the Website & SEO CSV importer remains available as a collapsed bridge utility and the seven section blocks are now collapsed by default
    - the shared T7/T30 leasing metrics page now uses that same sticky header treatment, the same upcoming-Friday plus Spotlight-property defaults, and the same `Navigate` header control while removing the leftover top-row `Update` / `Clear Data` buttons
  - current posture:
    - visible POP Brief is now anchored on `weekly_metrics` + `marketing_weekly`
    - compatibility with Base44 Website & SEO CSV ingest is restored alongside the canonical workflow
    - the grounding-core and property-evaluation lane now treats unit-level pricing/specials in `unit_availability.available_units_json` as a Data Pond fact source for active concession visibility
    - property evaluation briefs now require a full Pond operating chain across GSC, GA4, PSI, Ads, GBP/reputation, guest cards, inventory, unit-level specials, concessions, and unit aging instead of only inventory/funnel synthesis
    - remaining parity work still includes onboarding model alignment

- `Data Pond landing + sidebar branding`
  - disposition: canonical, active
  - owner: `apps/web`
  - latest correction:
    - `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` and `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` are being carried forward together as one branded frontend slice instead of being partially separated across local state and `main`
    - the intended state includes the richer Data Pond landing hero plus the larger branded sidebar treatment with the `By MarketingOps` byline
  - operator significance:
    - branding and navigation recognition are part of product continuity for operators and should be promoted together with POP Brief header changes rather than as separate partial deploys

- `Editor POP Brief + EVS action boundary`
  - disposition: canonical, active
  - owner: `apps/web` + `apps/api`
  - latest correction:
    - the `editor` role is explicitly narrowed to The Pond plus the POP Brief lane for ordinary operator navigation, with EVS draft/handoff preserved as named validation actions for governed experiential requests
    - the web permission layer, API offering-action layer, sidebar rendering, and app-shell route boundary follow that same rule for ordinary navigation, while API EVS named actions now match the EVS lifecycle contract
    - the full left nav can still be shown for orientation, but non-POP editor destinations now render as locked/dead links instead of working routes
  - operator significance:
    - this makes the editor role a true POP Brief operator role rather than a cosmetic subset of the broader platform, while still allowing editors to initiate and hand off EVS validation when that validation is part of the governed work

- `Captain Brief performance-analysis bridge`
  - disposition: canonical, active refinement
  - owner: `reports/captains_log` + Captain Benton lane
  - latest correction:
    - the vNext Captain Brief generator now includes T7/T30 Performance Analysis tables, reported advertising spend, and marketing notes as an evidence layer
    - the layer is reconciled against Pond facts and Benton directives rather than treated as the final analysis
  - operator significance:
    - preserves the analyst team's current working view while adding richer source authority, unit-level reality, search/entity intelligence, and action ownership

- `DataForSEO Navigator evidence catch-up`
  - disposition: canonical, active source lane
  - owner: `Data_Collection` / Navigator, consumed by property Captains
  - latest correction:
    - the 28 activated Spotlight/pilot Captain properties were backfilled with 04/29/2026 DataForSEO evidence
    - broad SERP baseline loaded 56 requests, 60 ranking rows including existing same-day rows, and 1,517 SERP result rows
    - deep enrichment loaded keyword demand, Labs ranked keywords, OnPage snapshots, Business Profile/entity reads, backlink raw evidence, and AI visibility probes for all 28 properties
    - new mirror utility `/Users/mark/Property_Analytics/apps/api/scripts/dataforseo_captain_to_d1.py` pushes the DataForSEO evidence tables to remote D1 without rerunning the full Captain source sync
  - operator significance:
    - Navigator agents can now give Captains property-specific search, content, entity, backlink, and AI visibility evidence rather than relying on manually summarized website/SEO notes
    - paid API collection remains outside Captain cron; Captains use the mirrored evidence for watch/action ownership

- `Captain scheduled runtime bucket`
  - disposition: canonical, active
  - owner: `apps/api` Captain runtime
  - latest correction:
    - expanded Captain roster execution is now bucketed across the account's five available cron slots instead of attempting the full roster in one invocation
    - `runScheduledCaptains` selects support agents by deterministic property/agent hash bucket
    - deployed Worker version `8dd446ae-4e92-4b9d-afde-4e73121c61ce` carries four daily cron slots rotating through 16 daily buckets and one Monday weekly slot rotating through 4 weekly buckets
    - scheduled execution now awaits bucket completion directly rather than relying on a `waitUntil` handoff
  - operator significance:
    - the fleet can now run often enough to matter without crossing Cloudflare's per-invocation request ceiling
    - rapid manual route loops are not the long-term mechanism; scheduled buckets or a governed internal trigger should be used for fleet catch-up

- `Spotlight Captain Brief property-safe generation`
  - disposition: canonical, active refinement
  - owner: `reports/captains_log` + Spotlight Captains
  - latest correction:
    - `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py` now renders property-neutral Captain copy rather than carrying prototype Anatole/Daytona language into other properties
    - the generator resolves identity through the governed matrix and uses unit-feed fallback for exposure when the structured Available Units / Guest Cards per Unit Type row is missing
    - T7/T30 guest cards fall back to structured Traffic Conversions values when the available-unit interest row is absent
    - missing source notes now explicitly identify routing gaps instead of silently producing zeros
  - operator significance:
    - Avasa at 1604 / `TX416` can now be used as a first non-Pointe Captain Brief proof without misleading market language or fake exposure math
    - remaining blanks in the Avasa output are source-routing gaps to close, not report composition guesses

- `Captain Brief display standard v1.2`
  - disposition: canonical, active display baseline
  - owner: `reports/captains_log` + Captain's Log / POP Brief family
  - latest correction:
    - added `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md`
    - updated `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md` so v1.2 is the active outbound display baseline
    - established the readable Elation emergency scan as the first approved proof artifact
    - added locked PIB-style Captain header renderer `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`
    - switched active Captain generators to that renderer and added `/Users/mark/Property_Analytics/scripts/check_captains_brief_header_lock.sh`
  - operator significance:
    - future Captain reads should show data-heavy evidence through KPI tiles, grouped evidence blocks, short interpretation reads, and owner/action/proof directives
    - dense run-on evidence rows are no longer acceptable as the default display pattern for analyst or executive consumption
    - the Captain header should no longer drift into a text-only logo, oversized property name, or custom spacing because it is now centralized and checked

- `Marketing Operations / Flagship doctrine set`
  - disposition: canonical governance, active
  - owner: `docs` / MarketingOps / Property Analytics
  - latest correction:
    - added `/Users/mark/Property_Analytics/docs/MARKETING_OPERATIONS_CHARTER_2026-05-04.md`
    - added `/Users/mark/Property_Analytics/docs/FLAGSHIP_OPERATING_MODEL_2026-05-04.md`
    - added `/Users/mark/Property_Analytics/docs/CAPTAIN_DOCTRINE_2026-05-04.md`
    - added `/Users/mark/Property_Analytics/docs/CAPTAIN_READINESS_CHECKLIST_2026-05-04.md`
    - formalized the relationship between the department (`Marketing Operations`), the operating model (`The Flagship`), and the property-scoped command role (`Captain`)
    - standardized designation posture for `Critical`, `Spotlight`, and `Sale` plus the six-step Captain method and minimum readiness standard
  - operator significance:
    - the Captain system now has a department-level doctrine layer that explains how source governance, command cadence, role ownership, and follow-through should work together
    - future Captain activation, roster, reporting, and escalation work should extend these doctrine artifacts rather than inventing parallel role or readiness models

- `Portfolio Captain fleet activation`
  - disposition: canonical, active
  - owner: `scripts` + Captain runtime / MarketingOps
  - latest correction:
    - extended `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py` to support a governed `--portfolio` scope in addition to monthly Spotlight and documented pilot overlays
    - added `/Users/mark/Property_Analytics/docs/FLAGSHIP_COMMAND_TEMPLATES_2026-05-04.md` and `/Users/mark/Property_Analytics/docs/PORTFOLIO_CAPTAIN_ACTIVATION_STANDARD_2026-05-04.md` so Captain, Commodore, Admiral, and roster-activation behavior now have explicit command and standup doctrine
    - remote D1 roster now stands up the full governed portfolio: `93` active Captain properties, `1,023` active support-agent rows, `93` active Captain activation memory entries, `19` Spotlight overlays, and `5` pilot overlays
  - operator significance:
    - Captain coverage is no longer just a Spotlight/pilot slice; the governed portfolio now has baseline Captain activation with Spotlight and pilot overlays preserved on top
    - command templates and standup rules now exist as canonical references for future roster refreshes, designation changes, and command-read work

- `Captain readiness audit + Commodore fleet summary`
  - disposition: canonical, active
  - owner: `scripts` + `reports/captains_log` + Captain runtime
  - latest correction:
    - added `/Users/mark/Property_Analytics/scripts/captain_fleet_support.py` as the shared governed helper for fleet audit/report scripts
    - added `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py` to score activation, source freshness, and recent runtime posture across the active Captain fleet
    - added `/Users/mark/Property_Analytics/reports/captains_log/generate_portfolio_commodore_read.py` to produce a first portfolio-level Commodore Read from readiness and runtime pressure
    - added designation-aware `commandPosture` exposure in `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` so Captain status/read payloads now surface `designation`, `market`, `scopeTypes`, cadence mix, and derived intensity
  - operator significance:
    - the fleet now has an explicit control surface for distinguishing activation from readiness
    - Commodore-level portfolio review can now start from one governed readiness/risk summary rather than a manual scan of property-by-property runtime state

- `Designation-aware Captain cadence`
  - disposition: canonical, active refinement
  - owner: `apps/api` Captain runtime + `scripts` / MarketingOps
  - latest correction:
    - scheduled Captain execution now treats designation as an actual runtime control, not just metadata
    - in `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`, `Critical` properties now pull `reputation_watch` and `logkeeper` into the daily rhythm, and scheduled bucket ordering prioritizes `Critical` then `Sale`/`Spotlight` before baseline properties
    - added `/Users/mark/Property_Analytics/scripts/generate_captain_runtime_catchup_plan.py` plus 05/04/2026 catch-up artifacts under `/Users/mark/Property_Analytics/reports/captains_log/commodore/`
  - operator significance:
    - designations now have direct operational consequence in runtime cadence instead of existing only as reporting labels
    - the fleet now has a governed catch-up plan that separates source-fix properties from designation-priority properties and baseline portfolio cadence recovery

- `Captain catch-up execution runner`
  - disposition: canonical, active refinement
  - owner: `scripts` + Captain runtime / MarketingOps
  - latest correction:
    - added `/Users/mark/Property_Analytics/scripts/run_captain_runtime_catchup.py` to execute the latest governed catch-up plan against the Captain API route rather than relying on manual property-by-property runs
    - dry-run validation for the `focused_cadence` lane confirmed the runner is targeting the expected first five designated properties from the current catch-up plan
    - Captain runtime now applies a first designation-aware severity adjustment for `Critical` properties in source-freshness, source-authority, and inventory-feed related watch/action outputs
  - operator significance:
    - the Commodore catch-up plan can now become operational work instead of remaining a static planning artifact
    - `Critical` designation now affects not only cadence ordering but also the urgency level written into specific runtime watch/action outputs

- `Headless GBP guard for canonical collection`
  - disposition: canonical, active
  - owner: `Data_Collection`
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` now refuses to start browser OAuth during unattended runs when the stored GBP token is unreadable or unavailable
    - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` now initializes GBP reviews in headless mode by default and only allows interactive OAuth when `ALLOW_INTERACTIVE_GBP_AUTH=1`
    - this correction was triggered by a real outage on `2026-05-02`, where a broken GBP token import launched interactive OAuth inside launchd, hung the master collector, and blocked all later morning runs behind the collection lock
  - operator significance:
    - GBP auth problems can no longer freeze GA4/GSC/Ads/PSI freshness collection
    - unattended collection should degrade by skipping GBP review collection rather than deadlocking the entire morning pipeline

- `GSC freshness policy alignment`
  - disposition: canonical, active refinement
  - owner: `Data_Collection` + `apps/api` + report surfaces
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py` now models GSC as a three-day-lag source instead of a generic next-day source
    - `/Users/mark/Property_Analytics/generate_morning_full_report.py` now uses the shared freshness policy for core source rendering instead of a raw age heuristic for GSC
    - `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts` now applies the same GSC lag expectation so Watchtower and Morning Full stay consistent
  - operator significance:
    - normal Search Console lag no longer reads as a false warning or fake incident
    - report, API, and control-plane views now agree on when GSC is truly late

- `D1 mirror Captain sync transient retry hardening`
  - disposition: canonical, active refinement
  - owner: `apps/api` mirror tooling
  - latest correction:
    - `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` now retries the `captain_sources_to_d1.py` sub-step up to three times when Wrangler returns transient network-style failures
    - `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` now retries its own remote `wrangler d1 execute --file ...` call on transient `fetch failed` / connectivity / timeout / remote disconnect conditions
  - operator significance:
    - transient Cloudflare import flakes are less likely to poison the whole D1 mirror day
    - the mirror failure signal should now skew toward persistent D1 problems rather than one dropped Captain-source upload

- `Operating metrics retry-hook correction + closure helper hardening`
  - disposition: canonical, active refinement
  - owner: `Data_Collection`
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` now includes the missing `_queue_source_retry(...)` helper used by operating-metrics source-level retry scheduling
    - `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py` now accepts either DB paths or live sqlite connections, and coerces ISO date strings to `date` objects for direct script/audit use
  - operator significance:
    - operating-metrics source failures can now degrade into governed retry debt instead of crashing on a missing method
    - closure evaluation is safer to reuse across scripts, audits, and live operator checks
    - the retry worker now prioritizes missing core source recovery before long advisory retries, which is a better fit for morning closure operations

- `AptIQ Spotlight readiness and DataForSEO coverage audit`
  - disposition: active prep workflow
  - owner: `reports/captains_log` + Data Collection / Captain's Log
  - latest correction:
    - `/Users/mark/Property_Analytics/reports/captains_log/audit_spotlight_report_readiness.py` now audits the `11` AptIQ-backed Spotlight properties for core report facts plus advisory evidence lanes
    - DataForSEO readiness is now explicit across SERP runs, property keyword rankings, keyword metrics, labs ranked keywords, on-page snapshots, business profiles, and AI-visibility probes
    - initial DataForSEO coverage for the 2026-05-05 Spotlight batch was `7` of `11`; `TX4CO`, `FL4HL`, `KY4MP`, and `FL4RL` were then collected on `2026-05-06` through the governed DataForSEO SERP and deep-enrichment scripts
    - the current readiness audit now shows DataForSEO ready for all `11` properties; the 2026-05-06 remote D1 mirror added the four catch-up packets to the Captain evidence lane
  - operator significance:
    - tomorrow's Spotlight report prep can distinguish operating/funnel readiness from advisory search and website evidence readiness
    - DataForSEO is visible where it matters, without letting search evidence override source-of-record operating, unit, funnel, reputation, or pricing data

- `2026-05-06 BI workbook batch intake`
  - disposition: active Data Pond ingestion
  - owner: `Data_Collection` + Captain's Log
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` now normalizes browser download suffixes such as ` (1)` and ` (2)` for type detection while preserving the source file path in evidence
    - 2026-05-06 batch loaded purpose-built Marketing Ops, C&D, conversion dashboard, ad-spend, and vacancy-day rows, while preserving conversion detail, leasing detail, ticket, value proposition, Kingsley/NPS/renewal/rent-pricing, portfolio, available, and regional rollup workbooks in `marketing_bi_excel_export_rows`
    - `region.xlsx` was identified as a C&D regional rollup and deliberately not used to mutate property-region config
    - pilot PSI/GT CSVs were treated as generated exports because canonical 2026-05-06 pilot rows already existed in `pilot_control_psi_metrics` and `gtmetrix_metrics`
  - operator significance:
    - Captain/POP report inputs now have fresher 2026-05-06 C&D, conversion, ad-spend, vacancy, and Marketing Ops facts
    - noncanonical but useful BI files are retained as auditable evidence until a source contract promotes them

- `Captain Command Center`
  - disposition: active Data Pond UI slice
  - owner: `apps/api` Captain runtime + `apps/web` Captain page
  - latest correction:
    - added `GET /v1/captain/roster` for portfolio Captain roster visibility across designation, cadence, latest runs, open watch, open actions, and memory freshness
    - added `GET /v1/captain/properties/:propertyId/command-center` for property-scoped Captain inspection, including support agents, runs, memory, source/knowledge coverage, watch items, actions, and brief runs
    - extended `/analysis/captain` so the top of the page is now a Command Center, while the existing Captain Brief preview remains below it
  - operator significance:
    - operators can now inspect the Captain system itself instead of only reading generated Brief output
    - runtime, memory, source coverage, and follow-through become visible operating facts in the Data Pond
    - this remains orchestration/control-surface work and does not mutate locked canonical PIB generation/rendering behavior

- `Captain website content diagnosis and team-feedback compliance`
  - disposition: active Captain Brief diagnostic standard
  - owner: Captain's Log + Navigator / Site Content
  - latest correction:
    - `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_0_2026-05-06.md` now memorializes the accepted Watchlist Decision Output v1.0 format, including mandatory PIB-style header, visual scorecard, constraint resolution, channel budget efficiency, false-cut protection, action cards, T30/T90 outcomes, and bottom sources
    - first accepted Watchlist Decision Output artifact: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_watchlist_decision_output_example_2026-05-06.html`; accepted email message id `5c71a194-3c3c-45d1-b43a-b4a69646bf9d@property-analytics.local`
    - `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_VNEXT_REPORT_MEMO_2026-05-06.md` now memorializes the current Captain's Brief vNext report path, report discipline, input lanes, send command, Grand Harbor proof artifact, and PIB boundary
    - Captain/read-model channel economics now calculate per-source `cost per lease` and derived `cost per move-in` from BI cost-per-conversion plus source-performance rows, so the Grand Harbor proof artifact exposes source-level efficiency beyond guest-card/app economics
    - `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md` now requires website recommendations to choose a posture before prescribing copy: `Tighten`, `Split`, `Clarify`, `Expand`, or `Leave mostly alone`
    - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py` now uses page-snapshot title/meta/H1/word/link/image facts to generate a `Website Content Diagnosis`
    - the section gives exact title tag, meta description, H1, hero copy, offer copy, and child-page guidance while warning against adding more homepage copy when the issue is topic dilution
    - after stakeholder feedback, the visible Brief no longer includes a paid-search KPI card, standalone search-evidence section, or `Website / SEO` marketing note; search-related source evidence is bottom-source support only when it supports the content diagnosis
    - the 2026-05-06 Grand Harbor proof send used source-performance rows, source-level spend, and PSI/Core Web Vitals as conversion-health support, then emailed `/Users/mark/Property_Analytics/reports/captains_log/the_cape_at_grand_harbor/the_cape_at_grand_harbor_captains_brief_vnext_generated_2026-05-06_email_outlook.html`
    - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_11_source_audit_2026-05-06.md` is the corrected 11-property readiness audit using governed identity resolution across property code, GA4 id, and feed ids
    - the reusable local Captain Brief now includes a PIB-style secondary `Unit-Type Spend / Targeting` section beneath the primary marketing channel content, showing classified unit-type spend, generic spend, targeted unit-type count, clicks, conversions, and top keywords by unit type
    - current source preference for that section is local `ad_keyword_performance`, then remote D1 `ad_keyword_performance`, then the latest generated marketing mirror SQL batch as a governed report-generation fallback
    - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` and `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` now expose/render the same `Unit-Type Spend / Targeting` evidence in the Captain app so app and brief stay aligned
    - 2026-05-07 Spotlight preparation generated all 11 current Spotlight Captain's Brief vNext browser/email artifacts and corrected source-performance rendering so BI `origin` rows are used when `marketing_source` rows are absent, closing The Retreat at Lakeland's visible source-output hole without inventing data
  - operator significance:
    - website recommendations should now read like a diagnosis, not a generic copy suggestion
    - the machine can distinguish when to tighten, split, clarify, expand, or leave the page mostly alone before asking the team to edit content
    - the Captain Brief honors the team's preference to keep search out of the visible KPI/section structure

- `Weekly Marketing BI property source-performance feed`
  - disposition: active Data Pond ingestion
  - owner: `Data_Collection` + Captain's Log structured diagnostics
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` now recognizes `perf-by-source-*` workbooks as weekly property-level source-performance exports
    - Selection rows are resolved through the governed property identity matrix when the export supplies a property key through row context or filename context; Portfolio rows remain benchmark rows
    - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now prefers property-specific `perf-by-source-*` rows before older source-performance exports for diagnostic JSON
    - the 2026-05-06 batch loaded `19` files, `521` source-performance rows, `19` mapped Selection properties, and `0` unmapped Selection rows
  - operator significance:
    - weekly Captain/VP structured data can now consume guest cards, visits, first tours, applications, leases, C&Ds, move-ins, conversion ratios, and period deltas by source
    - property identity remains governed by the matrix instead of one-off report maps

- `Marketing Ops / Portfolio Box Score workbook refresh`
  - disposition: active Data Pond ingestion
  - owner: `Data_Collection` + Captain's Log structured diagnostics
  - latest correction:
    - `/Users/mark/Downloads/Marketing Ops Summary today.xlsx` loaded `91` mapped rows with source as-of `2026-05-06` and report date `2026-05-07`
    - `/Users/mark/Downloads/Portfolio Box Score today.xlsx` loaded `91` Portfolio Box Score rows with report date `2026-05-07`
    - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` now accepts dated/renamed Portfolio Box Score files via `portfolio box score*` filename recognition instead of only the exact canonical filename
  - operator significance:
    - same-day manual BI workbook drops can update Captain/Watchlist operating and product-readiness metrics without renaming files by hand
    - this refresh improves the report inputs but does not substitute for missing specialized available-interest or weekly Spotlight action-plan source files

- `Available unit interest / guest-card-per-unit workbook refresh`
  - disposition: active Data Pond ingestion
  - owner: `Data_Collection` + Captain's Log structured diagnostics
  - latest correction:
    - `/Users/mark/Downloads/guest-cards-per-unit.xlsx` loaded `107` available-unit-interest rows and `445` generic evidence rows with no ingest errors
    - the Marketing BI Excel ingester now accepts current/common filename variants for available-unit-interest exports, including `guest-cards-per-unit.xlsx`
    - this closed the `available_interest` advisory lane for all 11 current Spotlight properties and the Captain's Brief vNext artifacts were regenerated against the refreshed data
  - operator significance:
    - demand-versus-availability reads can now use full property-level guest-card-per-available-unit facts for the current Spotlight batch
    - remaining Spotlight advisory gaps are limited to human field-note/action files where no property-specific source document has been supplied

- `Pond-wide PSI / Core Web Vitals diagnostic read`
  - disposition: active Data Pond read model
  - owner: `Data_Collection` + Captain's Log structured diagnostics
  - latest correction:
    - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now reads the portfolio-wide `pagespeed_metrics` table first by GA4 property id, then falls back to pilot-only `pilot_control_psi_metrics`
    - Elation / `TX4EG` resolves to GA4 id `378381999`, where `pagespeed_metrics` has current PSI rows through `2026-05-06`
    - regenerated Elation JSON now includes mobile and desktop PSI/CWV values and no longer flags PSI as missing
  - operator significance:
    - structured diagnostics use the actual Pond-wide PSI data instead of only the older pilot/control PSI slice
    - PSI coverage should be evaluated against the portfolio table before any property is called uncovered

- `Abandoned application export status`
  - disposition: loaded but not property-attributable
  - owner: `Data_Collection` + Marketing BI source contract
  - latest correction:
    - `marketing_bi_abandoned_application_rows` contains `962` loaded rows dated `2026-05-06`, representing about `480` likely unique abandoned rows after duplicated export copies
    - the source workbook does not include property id, property name, region, or community key, so property-level abandoned counts are not published from this source
    - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now reports `source_loaded_no_property_key` instead of treating abandoned applications as an absent source
  - operator significance:
    - the data layer preserves the abandoned application facts without inventing property attribution
    - future exports need a property key before abandoned applications can become a property-scoped diagnostic metric

- `VP property retrieval JSON contract`
  - disposition: active specimen
  - owner: `Data_Collection` read models
  - latest correction:
    - `/Users/mark/Property_Analytics/docs/VP_PROPERTY_RETRIEVAL_JSON_CONTRACT_2026-05-06.md` now memorializes the VP JSON contract, canonical serializer, source rules, output shape, missing-data semantics, and production boundary
    - `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py` outputs the VP-requested one-object-per-property retrieval contract rather than the broader internal Captain diagnostic shape
    - the contract includes Demand Signals, Funnel Conversion, Inventory/Product, Demand vs Inventory Matching, Pricing/Market Position, Marketing Efficiency, Reputation/Product Friction, Website Performance, Derived Flags, and explicit missing data
    - current month is month-to-date through latest available source date, and `pd` is paid traffic
    - first specimen generated for Elation at `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`
    - after contract QA, the serializer now emits compact metric objects with no repeated null comparison scaffolding; unavailable required values use `available: false` plus `missing_data_path`, with the reason listed once in `missing_data`
    - the Elation specimen now has `0` JSON null values and includes computed GA4 conversion rate, available-unit T30/T90 averages, PSI T30/T90 averages, spend budget-vs-actual rollups, and cost-per-guest-card rollups
  - operator significance:
    - this is the file family intended for VP testing and later one-file-per-Spotlight-property production
    - it stays focused on retrieval and structure, not presentation or Captain report prose

- `Watchlist Decision Output v1.2`
  - disposition: active Watchlist report-family standard for new runs
  - owner: Captain's Log + Watchlist report family
  - standard: `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_2_2026-05-07.md`
  - canonical renderer: `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py`
  - latest correction:
    - versioned the email/report and site-manager Word companion together as v1.2
    - restored portfolio and regional comparisons
    - added T30/T90 direction and comparison reads for funnel metrics
    - added portfolio/regional channel-source comparison reads
    - restored guest-card-to-available-unit-type analysis from `available_unit_interest_metrics`
    - sharpened channel language so spend is not defended without downstream proof
    - section tables are now preceded by insight panels that interpret what the evidence means, likely causes, best next moves, and what to avoid
    - added `Damage / Friction Check` for negative reviews, attention reviews, service/ticket no-response risk, reopen/ticket posture, and make-ready/readiness trust blockers
    - corrected `Current Funnel Stress Test` so a zero broad traffic-volume gap is not presented as no gap; the section now distinguishes broad demand sufficiency from the real recovery gap around net exposure, floorplan fit, follow-up, offer clarity, and conversion blockers
    - expanded `Reputation / Product Friction` to follow the PIB reputation lane with GBP review/star/reply posture, sentiment breakdown, theme sentiment, critical review action items, Reputation.com score trend/components, and local reputation competition when available
    - corrected `Unit-Type Spend / Targeting` display so raw keyword arrays are never exposed; bedroom keywords are routed to bedroom lanes and General search terms show only active non-bedroom keywords in readable prose
    - report header dates, subject dates, and artifact filenames now use the actual run date instead of a hardcoded historical report date
  - operator significance:
    - v1.2 is the baseline for Stephanie/VP-facing Watchlist testing after the comparison and direct-read feedback
    - v1.1 artifacts remain historical proof only

- `Watchlist Decision Output v1.1`
  - disposition: active report-family output
  - owner: Captain's Log + Watchlist report family
  - latest correction:
    - `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py` now keeps the main email as the executive decision/evidence report while generating a separate site-manager `.docx` attachment from the same governed data
    - the main email suppresses `Constraint Resolution`, `Channel Decision Check`, and `Historical Cost Efficiency`
    - the site-manager Word attachment suppresses internal/technical blocks that do not belong in that audience version, including `Recommendation Packages`, `Current Funnel Stress Test`, `Unit-Type Spend / Targeting`, and `Website Technical Health`
    - `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py` now supports `.docx` attachments through the canonical sender
  - operator significance:
    - one report family now supports both the executive email and a site-manager action-plan attachment without creating a parallel sender or alternate PIB path
    - the user-facing language is plain-English and action-oriented, while technical backup stays in the email/report artifact set

- `Directive Control Center`
  - disposition: active governed policy-control capability
  - owner: Data Pond / Captain runtime / Fleet Scribe governance
  - governing source: `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md`
  - architecture note: `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_ARCHITECTURE_2026-05-09.md`
  - operating guide: `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_OPERATING_GUIDE_2026-05-09.md`
  - UI/API contract: `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_UI_CONTRACT_2026-05-09.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/directives`
    - `/Users/mark/Property_Analytics/apps/api/src/routes/directives.ts`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0047_create_directive_control_center.sql`
    - `/Users/mark/Property_Analytics/apps/web/src/app/admin/directives/page.tsx`
  - current capability:
    - structured directive profiles for Captain’s Office, Regional Desk / Commodore, Fleet Desk, Consulting Bench, Fleet Scribe Office, and all expert bench lanes
    - versioned persistence across profiles, versions, change requests, approval events, runtime snapshots, validation results, simulation results, and audit events
    - validation engine for required fields, source rules, output contracts, permissions, freshness, confidence, stable role ids, duplicate active versions, and draft runtime isolation
    - runtime resolver for monitoring, lightweight, standard, escalated, executive, and simulation modes
    - governed workflow for draft, submit, approve, activate, reject, retire, and rollback
    - simulation harness for weak-proof Navigator content, stale/conflicting Quartermaster sources, and Fleet Scribe publication/template guardrails
  - operator significance:
    - directives become auditable operational policy data instead of hidden or mutable prompt text
    - Captain, Bench, Fleet, and Fleet Scribe processes can resolve active rules consistently while testing draft changes safely
    - Fleet Scribe publication authority and Quartermaster source-integrity gates remain blocking controls
  - hardening status:
    - audit/hardening record: `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_AUDIT_HARDENING_2026-05-09.md`
    - directive versions and runtime snapshots are hash-stamped
    - runtime snapshots and audit events are immutable at the database layer
    - directive content is immutable after draft state
    - one open draft, one submitted version, and one active version per profile are enforced
    - route access uses the dedicated admin-only `directiveControlCenter` offering
    - simulation mode is explicitly isolated from runtime activation

- `Captain Runtime Orchestration Layer`
  - disposition: active governed runtime foundation
  - owner: Captain Runtime + Data Pond + Directive Control Center + Fleet Scribe governance
  - architecture: `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_ARCHITECTURE_2026-05-09.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/captain-runtime`
    - `/Users/mark/Property_Analytics/apps/api/src/routes/captain-runtime.ts`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0048_create_captain_runtime_orchestration.sql`
    - `/Users/mark/Property_Analytics/infra/migrations/0035_create_captain_runtime_orchestration.sql`
  - current capability:
    - property-scoped interaction intake
    - deterministic intent classification
    - property context assembly
    - directive-resolved runtime governance
    - immutable evidence packet generation
    - structured GPT runtime payload construction
    - structured response validation
    - candidate-memory routing instead of canonical memory mutation
    - Bench/Fleet Scribe routing decisions
    - runtime audit events with evidence/directive/payload/response lineage
  - operator significance:
    - Captains now have a governed interaction spine that keeps GPT constrained to reasoning while Data Pond, directives, evidence, memory lifecycle, and Fleet Scribe controls remain authoritative
    - this is not a consumer messaging surface and not a reporting system; it is the runtime layer that future Captain interfaces should call
  - hardening status:
    - audit/hardening record: `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_AUDIT_HARDENING_2026-05-09.md`
    - runtime sessions, interactions, evidence packets, reasoning requests, reasoning responses, and audit events are protected against historical mutation
    - evidence packet hashes are replayable and exclude volatile ids/timestamps
    - malformed structured reasoning fails before memory or routing side effects
    - candidate memory carries evidence lineage, expiration, conflict state, and duplicate detection support
    - runtime routes block editor escalation into escalated, executive, and simulation modes

- `Captain’s Office`
  - disposition: active governed operational workspace
  - owner: Captain Runtime + Data Pond + Directive Control Center
  - architecture: `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_ARCHITECTURE_2026-05-09.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/web/src/app/captains`
    - `/Users/mark/Property_Analytics/apps/api/src/routes/captain-runtime.ts`
    - `/Users/mark/Property_Analytics/apps/api/src/platform/captain-runtime/repository.ts`
  - current capability:
    - property-scoped Captain’s Office workspace
    - runtime interaction submission through `/v1/captain-runtime/interactions`
    - runtime history and lineage visibility
    - evidence/authority sidebar
    - watch item and alert visibility
    - candidate-memory visibility with noncanonical labeling
    - role-gated runtime reads
  - operator significance:
    - provides the governed working surface for Captains without building a consumer messaging interface
    - makes authority, confidence, publishability, evidence state, directive lineage, and candidate memory visible to operators
    - preserves Fleet Scribe and Quartermaster boundaries and does not create a report generator
  - Expert Reads visibility:
    - integration doc: `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_EXPERT_READS_INTEGRATION_2026-05-10.md`
    - route: `/captains/[propertyId]/expert-reads`
    - displays Consulting Bench lane output, confidence, freshness, publishability, blocked state, Quartermaster/governance warnings, findings, recommendations, and hash lineage
    - supports controlled Expert Read requests through the existing governed Expert Reads API

- `Expert Reads / Consulting Bench runtime controls`
  - disposition: active governed specialist-runtime capability
  - owner: Captain Runtime + Directive Control Center + Fleet Scribe governance
  - architecture: `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_ARCHITECTURE_2026-05-09.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/expert-reads`
    - `/Users/mark/Property_Analytics/apps/api/src/routes/expert-reads.ts`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0049_create_expert_reads.sql`
    - `/Users/mark/Property_Analytics/infra/migrations/0036_create_expert_reads.sql`
  - current capability:
    - structured Expert Read requests
    - directive-resolved Expert Lane Resolver
    - evidence-packet validation and hash lineage
    - lane contracts for Quartermaster, Navigator, Revenue Advisor, Signals Officer, Product Readiness Officer, Trust And Proof Advisor, and default contracts for the rest of the Consulting Bench
    - deterministic constrained Expert Read generation for now
    - structured validation for findings, recommendations, proof metrics, do-not-do rules, confidence, freshness, conflicts, escalation, and publishability
    - immutable finalized Expert Reads and immutable audit events
    - API routes under `/v1/expert-reads`
  - operator significance:
    - lets Consulting Bench lanes sharpen specific decision areas without becoming independent agents or report generators
    - preserves Captain ownership of property intelligence and Fleet Scribe ownership of publication
    - keeps Quartermaster source integrity and Directive Resolver policy controls in the runtime path
  - hardening status:
    - audit/hardening record: `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_AUDIT_HARDENING_2026-05-10.md`
    - evidence packet hashes are replayed before generation
    - source Captain Runtime lineage is asserted when supplied
    - duplicate request replay is blocked by deterministic request hash
    - finalized reads, findings, recommendations, requests, and audit events remain immutable
    - Expert Reads cannot self-authorize `publishable` states at validator or database-constraint level

- `Property Access Control`
  - disposition: active canonical property-scoped authorization foundation
  - owner: Data Pond / Captain Runtime / Captain’s Office / Expert Reads governance
  - architecture: `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_ARCHITECTURE_2026-05-10.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/access/property-access-control.ts`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0050_create_property_access_control.sql`
    - `/Users/mark/Property_Analytics/infra/migrations/0037_create_property_access_control.sql`
  - current capability:
    - central `PropertyAccessControl` primitive for property, region, portfolio, capability, runtime-mode, and Expert Read lane access decisions
    - grant table for explicit property/region/portfolio scopes
    - immutable audit table for denied and high-risk authorization decisions
    - fail-closed handling for missing actors, missing/unresolvable property scope, missing region scope, unsupported runtime modes, unsupported expert lanes, and missing capabilities
    - route enforcement for Captain Runtime interaction, Captain’s Office reads, runtime history, evidence lineage, memory candidates, and Expert Reads request/read endpoints
  - operator significance:
    - provides one reusable answer to whether an actor can perform an action on a property in a runtime context
    - prevents future Captain, Expert, Fleet, Scribe, and property-level surfaces from inventing local property authorization rules
    - preserves the distinction between access authorization and runtime governance; Directive Resolver, Quartermaster, Fleet Scribe, and Data Pond authority remain intact
  - hardening status:
    - audit/hardening record: `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_AUDIT_HARDENING_2026-05-10.md`
    - explicit `allow` / `deny` grant effects
    - deterministic precedence: property before region before portfolio; same-scope deny before allow
    - duplicate active grants blocked by canonical grant fingerprint
    - invalid actions, invalid runtime modes, invalid Expert Read lanes, revoked grants, and expired grants fail closed
    - Expert Read detail denials are masked as not found while preserving audit events

- `Awareness Network / Memory Stewardship`
  - disposition: active governed memory and awareness foundation
  - owner: Captain Runtime + Captain’s Office + PropertyAccessControl + Directive Control Center governance
  - charter: `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_CHARTER_2026-05-10.md`
  - architecture: `/Users/mark/Property_Analytics/docs/MEMORY_STEWARDSHIP_ARCHITECTURE_2026-05-10.md`
  - hardening record: `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_AUDIT_HARDENING_2026-05-10.md`
  - cross-system acceptance: `/Users/mark/Property_Analytics/docs/CROSS_SYSTEM_RUNTIME_ACCEPTANCE_AUDIT_2026-05-10.md`
  - workspace model:
    - Captain’s Office = human-facing operational workspace
    - Captain’s Quarters = Captain working memory / stewardship space
    - Captain’s Log = chronological continuity / archive layer
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/awareness`
    - `/Users/mark/Property_Analytics/apps/api/src/routes/awareness.ts`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0051_create_awareness_network.sql`
    - `/Users/mark/Property_Analytics/infra/migrations/0038_create_awareness_network.sql`
    - `/Users/mark/Property_Analytics/apps/web/src/app/captains/[propertyId]/quarters/page.tsx`
  - current capability:
    - bounded operational Agent Identity and Agent Charter records
    - memory taxonomy with lifecycle state, freshness, sensitivity, allowed uses, blocked uses, correction path, and Care Metadata
    - self notes as noncanonical working aids
    - commitment memory for open loops and follow-ups without blame language
    - Memory Posture service for active concerns, open questions, commitments, uncertainty, verification needs, care warnings, and do-not-recommend reminders
    - Regional Awareness summaries that share sibling-property patterns without raw private detail
    - Doctrine Candidate foundation that rejects one-anecdote doctrine
    - deterministic reflection routines that create suggestions only
    - Captain’s Quarters UI for Memory Posture, Self Notes, Open Commitments, Care Warnings, and Regional Awareness
    - persistence hardening with no-delete triggers for memory stewardship records and immutable correction/archive records
    - cross-system acceptance tests proving PropertyAccessControl -> Captain Runtime -> Directive Resolver -> Evidence Packet -> Captain’s Quarters -> Expert Reads -> Fleet Scribe boundary integration
  - operator significance:
    - gives Captains and future Commodores/Fleet roles durable, bounded awareness without turning memory into surveillance or canonical truth
    - keeps human input claim-level until governed and keeps self notes out of public copy/report evidence
  - boundaries:
    - no real GPT integration
    - no autonomous agents
    - no memory promotion workflow
    - no Data Pond mutation
    - no report publishing
    - no Quartermaster or Fleet Scribe bypass
    - no parallel reporting system

- `Model Provider Gateway`
  - disposition: active governed runtime foundation; provider live path disabled by default
  - owner: Captain Runtime / Expert Reads / platform governance stack
  - architecture: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_ARCHITECTURE_2026-05-10.md`
  - cloudflare adapter guide: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_ADAPTER_2026-05-10.md`
  - security/redaction guide: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SECURITY_AND_REDACTION_2026-05-10.md`
  - operating guide: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_OPERATING_GUIDE_2026-05-10.md`
  - hardening audit: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_AUDIT_HARDENING_2026-05-10.md`
  - shadow provider config: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_PROVIDER_CONFIG_2026-05-10.md`
  - Cloudflare shadow smoke test: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_SMOKE_TEST_2026-05-10.md`
  - golden-case evaluation: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_GOLDEN_CASE_EVALUATION_2026-05-10.md`
  - shadow evaluation results: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_EVALUATION_RESULTS_2026-05-10.md`
  - real shadow observation results: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_REAL_SHADOW_OBSERVATION_RESULTS_2026-05-10.md`
  - Cloudflare shadow backend setup: `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_CONFIG_SETUP_2026-05-10.md`
  - implementation:
    - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway`
    - `/Users/mark/Property_Analytics/apps/api/migrations/0052_create_model_provider_gateway.sql`
    - `/Users/mark/Property_Analytics/infra/migrations/0039_create_model_provider_gateway.sql`
    - `/Users/mark/Property_Analytics/apps/api/scripts/smoke_cloudflare_shadow_model_gateway.ts`
    - `/Users/mark/Property_Analytics/apps/api/scripts/run_model_gateway_shadow_evaluation.ts`
    - `/Users/mark/Property_Analytics/apps/api/scripts/check_cloudflare_shadow_config.ts`
  - current capability:
    - model gateway request / payload / response / audit event domain model
    - deterministic default adapter
    - noop fail-closed adapter
    - Cloudflare AI Gateway adapter scaffold with explicit live-call gating
    - shadow-mode compare-only path
    - payload minimization, redaction, and allowed-use filtering
    - structured response validation and governance post-check
    - internal token / cost / rate guardrail foundation
    - Captain Runtime and Expert Reads now integrated through the gateway abstraction
    - explicit shadow-only provider configuration flags separate from future live accepted provider flags
    - immutable shadow result records for validation/governance status, deviation summary, token/cost/latency metadata, provider request id, and safe provider errors
    - opt-in synthetic Cloudflare shadow smoke test using only synthetic data
    - golden-case evaluation fixtures for structural validity, governance validity, redaction compliance, and audit markers
    - deterministic semantic safety scorecard for structure compliance, governance compliance, evidence discipline, memory care, publishability restraint, and operational usefulness
    - backend-only Cloudflare shadow config checker that reports key presence, shadow eligibility, live-disable state, raw/cache safety, and frontend exposure absence without printing secret values
  - operator significance:
    - creates a replaceable provider-control layer without moving authority outside the platform
    - preserves deterministic runtime behavior while enabling shadow-mode evaluation and future controlled provider traffic
  - hardening status:
    - kill switch defaults on
    - live provider calls default off
    - Cloudflare adapter live path default off
    - deterministic accepted output remains default
    - raw payload storage default off
    - unsafe config fails closed
    - relationship/private/sensitive memory is redacted before provider transit
    - shadow mode cannot replace accepted output
    - provider shadow output cannot create memory, routing, reports, publication, Expert Reads, Captain Runtime side effects, or Data Pond mutations
    - Cloudflare shadow smoke tests are opt-in and do not run in normal CI by default
    - no Data Pond mutation path
    - no memory promotion path
    - no publication path
  - readiness:
    - `ready_for_shadow_provider_smoke_test: true`
    - `ready_for_semantic_shadow_evaluation: true`
    - `ready_for_live_provider_calls: false`
    - `live_provider_calls_enabled: false`
    - `deterministic_default_preserved: true`
    - `cloudflare_adapter_live_enabled: false`
    - `ready_for_limited_shadow_expansion: true`
    - `ready_for_live_candidate_mode_design: true`
    - `shadow_provider_observed: false` in the first smoke/evaluation pass because Cloudflare backend config is absent
    - real shadow observation remains blocked until approved backend Cloudflare base URL, auth token, and model or dynamic route name are supplied
    - config path is ready to run real shadow smoke/evaluation once approved backend Cloudflare values are supplied; live accepted provider calls remain disabled
