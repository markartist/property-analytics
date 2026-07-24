# Capability Register

## 07/23/2026 Resi Portfolio Edge v16 Mobile LCP Asset Tightening

- Published Champions Green gated topper v16 at `https://championsgreen-ga.com/?edge_preview=1`. Current Worker version is `e4ffb09c-9086-47ca-b8b1-f3ed61f506c0`; template/schema version is `2026-07-23.performance-topper-v16-q36-mobile-hero`; mode remains `performance-topper`; ungated production traffic remains native.
- The route now serves a bundled q36 mobile hero AVIF for `resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif`, keeping the existing URL/markup contract while reducing the live mobile hero from `162,936` bytes to `65,612` bytes. This restored the local high-score profile without changing visual structure.
- This is an explicit fallback for the current Cloudflare token limitation: Keeper-backed Wrangler deploy succeeds, but remote R2 object writes still return `403 Forbidden`. Future portfolio-scale asset replacement should use R2 once object-write permission is available; small critical bundled assets remain acceptable only as governed exceptions.
- Local Lighthouse proof after v16: mobile `98` performance, accessibility `100`, best practices `96`, SEO `69`, FCP `720ms`, LCP `2345ms`, TBT `21ms`, CLS `0.0006`, and desktop `100` performance with TBT `0ms`. Public PSI rerun was blocked by daily quota `429` on 07/23/2026.
- Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260723-v16-q36-mobile-hero/`. Validation passed: Worker syntax, Keeper-backed Wrangler dry-run/deploy, live health/header/asset proof, single-URL Cloudflare purge, Chromium mobile screenshot, PIB guardrails, and context discipline.
- Disposition: v16 supersedes v13 as the active Champions Green pilot baseline for the gated topper. Keep the performance-topper architecture and continue moving toward a reusable global template/data boundary.

## 07/23/2026 Portfolio Launch Proxy Beta Worker Proof

- Added a working Cloudflare beta Worker for the Portfolio Launch Proxy at `https://portfolio-launch-proxy-beta.mlaufhutte.workers.dev` and `https://venterraliving.io`; current Worker version is `e8894245-d94b-4c74-9160-00717d6e0b44`.
- The beta Worker is source-controlled in `/Users/mark/web-ops/projects/portfolio-launch-proxy/` through `src/beta-worker.mjs`, `src/worker-handler.mjs`, the Anatole at Norman manifest fixture, and `wrangler.beta.toml`. It uses Keeper-backed Wrangler auth for deploys and does not store account IDs, zone IDs, or secrets in Git.
- The live proof works directly on `venterraliving.io`; workers.dev can still use `x-vtr-preview-host: venterraliving.io` to emulate the beta host. The active generated manifest contains 80 beta-ready properties and 160 routes. For The Pointe at Bentonville, old path `/apartments/the-pointe-bentonville/` redirects to `/apartments/pointe-bentonville-ar/`, default baseline proof serves `venterraliving.com/apartments/the-pointe-bentonville/`, and candidate proof adds `x-vtr-preview-active-target: candidate_origin` to switch the same city/state route to `https://thepointebentonville.kinsta.cloud/`.
- Added a session-scoped beta switch endpoint at `/__vtr-routing-ops/switch`, used by the dashboard row buttons. It sets a per-property route-target cookie in the operator browser, then returns to the old `.io` URL so the operator sees the full old-to-new URL flow render either legacy baseline or candidate origin. This is not global activation; global activation still belongs behind authenticated Routing Ops state, approval, and audit logging.
- Added the programmatic Routing Ops control scaffold in `/Users/mark/web-ops/projects/portfolio-launch-proxy/`: `src/route-state.mjs`, `contracts/route-state.schema.json`, `contracts/routing-audit-event.schema.json`, `contracts/routing-control.d1.sql`, `tools/build_route_state.mjs`, `tools/switch_route_state.mjs`, and `docs/ROUTING_CONTROL_PLANE.md`. The generated route-state file `config/generated/portfolio-route-state.beta.json` represents 80 switchable properties, all currently active on `legacy_baseline`.
- The scaffold proves the future switch contract without a production mutation: route state can be switched programmatically, an audit event is produced, and the state can be applied to the immutable manifest so the same public URL resolves to either legacy baseline or candidate origin. D1 remains the recommended production authority and KV the optional edge cache.
- The Data Pond Routing Ops page now shows the programmatic control-plane status directly under `/routing-ops/portfolio-launch`: route-state contract ready, 80 legacy-active switchable rows, and D1/KV as the next activation gate. Pages deployment `https://2f8206ce.property-analytics.pages.dev/routing-ops/portfolio-launch` carries the update; browser smoke with mocked admin auth confirmed the protected page renders the control-plane strip and alphabetized rows.
- Diagnostic headers expose route action, route id, active target, target mode, future production URL, preview decision URL, origin URL, and origin host so Routing Ops can validate route behavior before promotion.
- Disposition: active beta proof capability. This is a real Cloudflare Worker deploy and `.io` beta custom-domain attachment; no GoDaddy forwarding, vanity redirect, or production `.com` route was changed.

## 07/22/2026 Routing Ops Portfolio Launch Command Center

- Added `Routing Ops` as a first-class admin category in the Pond navigation, with `Portfolio Launch` pointing to `/routing-ops/portfolio-launch`.
- Reworked the portfolio launch command center from an Experiment Lab card surface into a Routing Ops command list. Each of the 92 properties now renders as a collapsible drawer row with property, before path, after path, origin, and condition visible at rest; route, origin, status, SEO, approval, and rollback details live inside the expanded drawer.
- Added the delivery-switch model to Routing Ops: beta public URLs stay stable while route target can later toggle between `legacy_baseline` on the current `venterraliving.com` WordPress path and `candidate_origin` on the new platform origin. The current read-only command center shows 85 legacy-baseline rows and 80 fully switchable rows with both baseline and candidate target known.
- Imported `/Users/mark/Downloads/Portfolio-Staging-URLs.docx` into the WebOps launch-proxy framework as `config/generated/staging-origins.json`. Pastel links are ignored. The import found 84 staging origins, matched all 84 through the governed identity matrix, and found 0 duplicate origins / 0 duplicate property-code duplicates.
- Regenerated `portfolio-route-map` and `launch-readiness-matrix`. Current route readiness totals are 92 rows, 80 beta-ready rows, 5 awaiting staging origins, 4 source-path review rows, 3 identity review rows, and 0 production-approved rows. The remaining missing-origin rows are The District Universal Boulevard, Champions Green, The Harrison, Calais Midtown, and Ventana.
- Validation passed in WebOps with route tests and the foundation validator, and in the Pond app with `npm run build` plus browser smoke against `/routing-ops/portfolio-launch`. Published Cloudflare Pages preview `https://0911589f.property-analytics.pages.dev/routing-ops/portfolio-launch`; `https://app.venterradev.com/routing-ops/portfolio-launch` remains behind Cloudflare Access and returns `302` when unauthenticated. No Cloudflare, GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated.
- Disposition: active Routing Ops control-plane surface. The next capability step is adding controlled route publication/admin actions behind Keeper-backed Cloudflare token scopes and approval gates; Phase 1 remains read-only.

## 07/22/2026 Resi Portfolio Edge v13 Native Specials And Heap Gate

- Published Champions Green gated preview v13 at `https://championsgreen-ga.com/?edge_preview=1`. Current Worker version is `1581267b-d342-45d6-b5c9-8ec685c9dfd0`; template/schema version is `2026-07-22.performance-topper-v13-native-specials-heap-gate`; mode remains `performance-topper`; ungated production traffic remains native.
- The measured topper now resolves a runtime property overlay from the live/native homepage on cache refresh. The native page is the authority for promo enabled/disabled state, promo text/detail, desktop promo image, availability CTA, phone, tour, and apply values, with the existing property config as fallback.
- Live response headers now expose `x-resi-edge-runtime-property` and `x-resi-edge-promo-state` so the rendered contract is inspectable. Latest proof showed `native-fetch` and `enabled`, with the current Champions Green special preserved as `$1,000 off for a limited time!` and `/apartments/?has_specials=true`.
- The topper analytics recorder remains active for `page_view`, `find_your_home_click`, `schedule_tour_click`, `apply_now_click`, `promo_open`, `promo_cta_click`, and `menu_open`. Heap replay is now queued behind user interaction, pagehide, or a delayed 12-second idle fallback instead of an immediate polling loop. Zaraz remains the owner of tool injection and standard analytics routing.
- Boundary: Worker-side event replay is hardened, but strict prevention of Heap/Contentsquare script network before interaction/consent requires a Zaraz configuration decision. Do not claim the Worker alone controls Zaraz tool loading.
- Compact PageSpeed proof after v13: mobile exact/fresh `98/97`, desktop exact/fresh `100/100`, TBT `0ms`. Evidence lives under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260722-v13-native-specials-heap-gate/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v13-native-specials-heap-gate-20260722/`.
- Disposition: v13 supersedes v12 as the current Champions Green pilot baseline. The next portfolio step is moving the runtime property overlay from Champions Green-specific code into the reusable global template/config boundary.

## 07/21/2026 Spotlight Copy Change And Baseline Daily Report

- Added `/Users/mark/Property_Analytics/scripts/send_spotlight_copy_change_baseline_report.py` as a dedicated email sender for the four-property Spotlight content-refresh monitoring lane.
- Current mode as of 07/23/2026 is active daily distribution: the Codex app cron automation `daily-spotlight-copy-change-and-baseline-trends` runs at 7:00 AM local time, and the sender defaults to Mark Laufhutte, Andrew Foresi, and Alexandra Hopkins.
- The report compares a pre-launch window against the current post-change/baseline window, adds a broader portfolio-average benchmark row, renders pre/post average-per-day bars, and includes indexed GA4 Organic Search plus GSC click line charts with a dashed portfolio GA4 average trend line. GSC click lines stop at the latest available GSC date to avoid source-lag false drops.
- The email shell is hardened for Outlook and dark/light-mode previews: table-based layout, inline styles only, explicit white `bgcolor` / `background-color` values, high-contrast navy/black/bay text, and navy-bordered readout modules instead of low-contrast shaded callouts.
- Generated timestamp, measurement windows, source freshness, and source list appear only in the bottom `Report context` footer; the header should move directly into the metrics table and charts.
- Scope: The Whitney and The Harrison are marked `Changed` from the 07/07/2026 afternoon copy-change point; Cendana District West and The Retreat are marked `Baseline` until content is supplied, using the same anchor window for comparison.
- Sources: canonical local GA4 Organic Search rows, GSC daily metrics, and Spotlight content-refresh status. GA4 and GSC remain the source-of-record metrics; no DataForSEO or PIB renderer changes are made by this sender.
- Validation: Python compile passed, no-send generation succeeded, Outlook email safety validation passed, and the generated charts were visually checked.
- Disposition: use this for the approved daily Spotlight copy-change/baseline trend read. Keep it separate from the approved Copy Change Impact Brief decision-read family unless Mark explicitly asks to merge them.

## 07/21/2026 ILS Direct-Start And Apartment Search Behavior Report

- Added `ils_search_behavior` as a governed Ad Hoc Executive Report System report type in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`.
- Purpose: answer executive apartment-search behavior questions that sit between owned organic traffic and external ILS platform demand, especially Zillow/Apartments.com direct-start behavior versus Google/search discovery.
- Source coverage: Venterra first-party GA4 daily/channel tables, Venterra GSC query rows, Semrush June 2026 platform traffic-source estimates for Zillow and Apartments.com, Similarweb June 2026 organic-search traffic-source corroboration for Zillow and Apartments.com, and Zillow renter-search behavior references. GA4/GSC are authoritative for Venterra traffic; Semrush/Similarweb are modeled directional external benchmarks.
- Output contract is unchanged under `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/`: `request.json`, `report_spec.json`, `report.html`, `report.xlsx`, `validation.json`, `delivery.json`, and `sources_used.md`.
- First packet generated at `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/20260721_121426_apartment-search-behavior-and-ils-direct-start-intelligence-with-supporting-data/`, covering 07/21/2025 through 07/20/2026 for Venterra first-party data. Outlook validation passed; no email was sent.
- Current packet read: Semrush estimates Direct at 43.70% of Zillow visits and 41.13% of Apartments.com visits in June 2026. Similarweb/Semrush place platform search-driven demand in the roughly 35%-40% range. Venterra GA4 shows 1,242,578 Organic Search sessions / 37.4% and 906,721 Direct sessions / 27.3%. GSC query-market support covers 90 properties from 11/05/2025 through 07/18/2026, with 60,443 apartment/rental-intent query strings.
- Disposition: use this report type for ILS-vs-organic, renter search behavior, Zillow/Apartments.com direct-start, and apartment search ecosystem questions. Do not treat external modeled traffic shares as exact source-of-record numbers. The next material enhancement requires vendor/account exports from Zillow and Apartments.com for listing views, search-result impressions, leads, calls, emails, tours, placement, and spend by property.

## 07/21/2026 Executive Organic Growth Intelligence Ad Hoc Report

- Expanded the governed Ad Hoc Executive Report System `organic_search_share` report type into a comprehensive Organic Traffic Intelligence packet for portfolio organic search analysis.
- Canonical implementation remains `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, invoked through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py` and rendered/validated by `/Users/mark/Property_Analytics/utils/outlook_report_builder.py` plus Outlook safety validation. This replaces the need to use older standalone organic report scripts for new executive asks.
- Source coverage now includes GA4 daily metrics, GA4 channel-group traffic rows, GSC daily/query rows, GSC brand/non-brand and intent clustering, GA4 event-fact landing-page coverage checks, Google Ads keyword overlap, Ahrefs Site Audit / Domain Rating / GSC summaries, stored DataForSEO SERP/ranking rows, DataForSEO keyword demand, DataForSEO OnPage, DataForSEO AI visibility, and pilot/control configuration. GA4 remains authoritative for sessions and traffic share, GSC for owned Google organic clicks/impressions/queries, Ahrefs for advisory technical/authority overlays, and DataForSEO for advisory live SERP composition, keyword demand, local-pack context, and search gap diagnosis.
- Output contract is unchanged under `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/`: `request.json`, `report_spec.json`, `report.html`, `report.xlsx`, `validation.json`, `delivery.json`, and `sources_used.md`.
- Final executive packet generated for 07/21/2025 through 07/20/2026 at `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/20260721_105103_executive-organic-growth-intelligence-over-the-last-12-months-brand-versus-non-b/`, showing 1,248,372 Organic Search sessions, 37.0% of total GA4 sessions, 195,097 GSC clicks, 6,812,462 GSC impressions, 75.2% brand/property click share, 24.8% non-brand click share, 69.1% non-brand impression share, about 3,194 modeled incremental clicks from practical CTR lifts, latest stored DataForSEO rows dated 07/15/2026, and latest Ahrefs rows dated 07/20/2026. No email was sent.
- Follow-up correction packet generated and emailed at `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/20260721_105809_executive-organic-growth-intelligence-over-the-last-12-months-corrected-query-ow/`: GSC query tables now separate `Properties with impressions` from `Properties with clicks` and add dominant-property ownership columns so brand queries with incidental cross-property impressions are not misread as multi-property wins.
- Landing-page organic distribution is now explicitly represented as a collection gap when event facts lack channel/source/landing-page dimensions. Future enhancement should add a governed GA4 landing-page-by-sessionDefaultChannelGroup extraction so organic homepage capture can be separated from deeper page discovery.
- Disposition: use this report type for portfolio organic traffic/source/search-intelligence asks. Fresh DataForSEO expansion beyond stored rows should be scoped and approved because DataForSEO SERP/keyword coverage is currently partial and may consume paid credits.

## 07/20/2026 Portfolio Launch Proxy Foundation

- Added the Portfolio Launch Proxy as a governed WebOps capability for the Venterra portfolio platform migration from one WordPress instance with native subdirectory URLs to an edge-controlled route/redirect platform with public `/-city-state/` URL additions.
- Working lab project: `/Users/mark/Web_Operations/projects/portfolio-launch-proxy/`. Corporate Git mirror: `/Users/mark/web-ops/projects/portfolio-launch-proxy/` on branch `codex/portfolio-launch-proxy-foundation`.
- The planned architecture uses Cloudflare as the portable edge execution/control plane, D1 as route authority, KV as runtime route cache, Cloudflare Workers for path routing and beta testing, Bulk Redirects for exact vanity-domain/static redirects where appropriate, and Data Pond/property identity validation before route publication.
- The initial scaffold includes route-manifest schema, Champions Green / `GA4CG` beta route/proxy fixture for `venterraliving.io`, vendor SLA access model, Cloudflare portability notes, beta setup runbook, project state files, and validators. No Cloudflare or GoDaddy production mutations were made by this foundation step.
- The active pilot model is Anatole at Norman / `OK4AN`: mocked old beta URL `https://venterraliving.io/apartments/anatole-at-norman/`, beta city/state URL `https://venterraliving.io/apartments/anatole-norman-ok/`, future production URL `https://venterraliving.com/apartments/anatole-norman-ok/`, and temporary staging origin `https://anatoleatnorman.kinsta.cloud/`. The beta Worker should prove redirect-then-proxy behavior on `.io`; `.com` activation remains a future promotion step.
- The first local framework is executable: Location Hierarchy workbook import, generated URL inventory, route resolver, and route tests now run without Cloudflare mutation. Current import control totals are 92 URL rows, 89 identity matches, 3 review rows, and 0 duplicate URLs. The route test proves old `.io` path redirect, city/state `.io` proxy, query preservation, unknown-route miss, and future `.com` metadata retention.
- Portfolio route-map generation now outputs both JSON and CSV, separating rows ready for beta testing from rows awaiting staging origins or review. Current route-map totals are 92 rows, 1 ready beta row, 84 awaiting staging origins, 4 source-path review rows, 3 identity review rows, and 0 duplicate URLs.
- Launch readiness matrix generation now outputs both JSON and CSV from the portfolio route map. Current readiness totals are 92 rows, 1 pilot-ready local beta row, 84 blocked pending staging origin URLs, 4 blocked pending source-path review, 3 blocked pending identity review, 1 locally route-tested row, and 0 approved for production. This artifact is the operational handoff matrix for staging origins, canonical/robots/sitemap evidence, vanity-domain continuity monitoring, launch batch, approval, and rollback status. Vanity domains remain in place and are not migration blockers.
- The Pond now has a read-only Phase 1 Experiment Lab command center at `/experiments/portfolio-launch`, linked from `/experiments`. It renders all 92 launch-readiness rows as property command cards with before/after route, route target, command state, status, and condition visible; supporting route/status/SEO/origin facts sit in expandable drawers below each property rather than multi-column tables. It is deployed to Cloudflare Pages preview `https://224187ce.property-analytics.pages.dev/experiments/portfolio-launch`, with the operator route `https://app.venterradev.com/experiments/portfolio-launch` behind Cloudflare Access. It deliberately has no production mutation controls and does not mutate GoDaddy, Worker route, DNS, vanity redirect, or production launch routing state.
- On 07/22/2026, the active beta fixture and Pond surface were switched from Champions Green to Anatole at Norman / `OK4AN`, the first usable new-platform staging URL in `/Users/mark/Downloads/Portfolio-Staging-URLs.docx` after ignoring Pastel links. The current beta route model is old `.io` path `/apartments/anatole-at-norman/`, city/state `.io` path `/apartments/anatole-norman-ok/`, future production URL `https://venterraliving.com/apartments/anatole-norman-ok/`, and staging origin `https://anatoleatnorman.kinsta.cloud/`.
- Disposition: active planning/foundation capability. Treat route files/manifests as vendor-operable directional control, with Venterra retaining account, credential, deployment, and production promotion control.

## 07/20/2026 Ahrefs Data Pond Source

- Added Ahrefs as a governed Keeper-first advisory source for SEO, technical site health, domain authority, Ahrefs Web Analytics, and Ahrefs-hosted GSC Insights. The source contract is `/Users/mark/Property_Analytics/docs/AHREFS_SOURCE_CONTRACT_2026-07-20.md`.
- Canonical implementation now includes `/Users/mark/Property_Analytics/utils/ahrefs_auth.py`, `/Users/mark/Property_Analytics/Data_Collection/collectors/ahrefs_collector.py`, `/Users/mark/Property_Analytics/config/ahrefs.yaml`, and `/Users/mark/Property_Analytics/apps/api/migrations/0060_create_ahrefs_tables.sql`.
- Daily collection runs Ahrefs after ApartmentIQ and before Cloudflare collection. Default endpoints are limited to Ahrefs free endpoints: subscription usage, project roster, Site Audit projects, Web Analytics stats, GSC performance history, and public Domain Rating. Charged endpoints require explicit scope/cost approval and a contract addendum.
- Local Data Pond storage now covers `ahrefs_subscription_usage_snapshots`, `ahrefs_projects`, `ahrefs_site_audit_project_health`, `ahrefs_web_analytics_daily`, `ahrefs_gsc_daily_summary`, and `ahrefs_domain_rating_snapshots`.
- Property scoping uses the governed property identity resolver only. Ahrefs projects that do not resolve are stored as source rows without `property_id` instead of adding a local Ahrefs-specific map.
- Initial live KSM-backed collection for 07/19/2026 completed with 21 verified projects, 21 Site Audit health rows, 21 Web Analytics rows, 21 GSC summary rows, 20 distinct Domain Rating target rows, and Ahrefs usage still at 0 units after the run. The Domain Rating table stores one row per distinct target, so the duplicate `monteverdesatx.com/` projects share that snapshot row.
- Added guarded project administration through `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py`. The script plans from the property identity matrix, writes dry-run JSON under `/Users/mark/Property_Analytics/reports/ahrefs_admin/`, and requires `--apply --confirm CREATE_AHREFS_PROJECTS` before creating projects. Initial dry-run found 84 missing property prefix projects, with 11 existing Ahrefs projects not matching the current matrix target exactly.
- Follow-up admin preparation added reconciliation buckets to the project plan: exact-target name normalization, likely legacy standalone-domain projects that should receive canonical prefix projects, current standalone property projects awaiting future governed `website_url` moves, and review-only live projects. Latest dry-run after the first 5 creates found 79 missing canonical prefix projects, 10 name-normalization items, 6 likely legacy-domain candidates, 7 standalone property project rows including the Monteverde duplicate, and 5 review-only projects. Ahrefs public API documentation currently supports project creation and access updates, but not project-name or target URL/mode/protocol edits, so name/target unification is tracked as manual/UI reconciliation or future API work.
- Mark approved the remaining rollout on 07/20/2026. The admin script created all 79 remaining canonical prefix projects with zero failures; apply artifact `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_project_apply_20260720T195235Z.json`. Follow-up dry-run found 105 live Ahrefs projects, 93 of 93 identity-matrix property projects matched, and 0 missing. Discovery-only sync refreshed the local `ahrefs_projects` table to 105 rows with 93 distinct property ids; Ahrefs subscription usage still reported 0 API key units and 0 workspace units used.
- Manual Site Audit crawl kickoff was completed through the authenticated Ahrefs web UI after the public API proved read-only for crawl starts. Artifact `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_site_audit_manual_crawl_start_20260720T205336Z.json` records the UI batches. Final Ahrefs status reported 105 projects, 105 `Completed`, 105 crawl dates, and 0 no-crawl projects; the canonical collector's Site Audit table was refreshed for 2026-07-20 with 105 completed rows and 0 missing crawl dates. Usage still reported 0 API key units and 0 workspace units.
- Added guarded competitor administration through `/Users/mark/Property_Analytics/scripts/ahrefs_competitor_admin.py`, using Ahrefs `GET/POST /v3/management/project-competitors` and local `property_competitors` / `competitors` resolved through the governed property identity matrix. Mark approved the 07/20/2026 apply; 640 URL-backed competitors were added across 86 canonical property projects with zero failures. Apply artifact `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_apply_20260720T212939Z.json`; confirmation dry-run `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_plan_20260720T213015Z.json` reported 640 current Ahrefs competitors, 0 remaining additions, 0 Ahrefs read errors, and 0 unresolved competitor property links. Seven properties still need local competitor URLs before Ahrefs can receive them: Clearwater Heights, French Place, Monteverde, Sundara at Spring Cypress, The Vine Kyle Parkway, Town Station Lofts, and Villas Continental.
- Disposition: use Ahrefs as an advisory portfolio website intelligence source. It complements GA4, GSC, DataForSEO, GBP, PageSpeed, Cloudflare, and internal operating sources; it does not replace any authoritative source of record.

## 07/18/2026 Resi Portfolio Edge External LBLE Asset

- Published Champions Green gated preview v12 at `https://championsgreen-ga.com/?edge_preview=1`. Current Worker version is `db8e900a-8284-4a81-9bbc-9d07ba0b16d9`; template/schema version is `2026-07-18.performance-topper-measured-preview-v12-external-lble`; cache version is `2026-07-18-performance-topper-measured-preview-v12-external-lble`; mode remains `performance-topper`.
- The hero `Live Better. Live Easy.` mark now uses Mark's smaller plain SVG from `/Users/mark/Downloads/live-better-live-easy-x.svg` and is served externally at `/assets/resi-edge-assets/shared/lble.svg` by the Worker with immutable cache headers. This replaces the v11 inline data-URI fallback, reducing initial HTML weight while preserving the governed visual asset.
- Live proof confirms the external SVG response is `22,708` bytes, hash `a21657e7a6452c6c44ad8d9deb323d3754b0bd61dd42c0586974df3eb8ae5f6d`, viewBox `0 0 294.12 72.65`, and no script/event handlers. Playwright proof at `390px`, `740px`, and `1440px` confirms no inline data-SVG source and no horizontal overflow. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v12-external-lble-20260718/`.
- PageSpeed proof passed the WebOps gate: mobile exact/fresh `98/99`, desktop exact/fresh `100/100`, TBT `0ms`, CLS near zero. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260718-v12-external-lble/`.
- Disposition: v12 supersedes v11 as the current Champions Green measured topper. Keep externally served cacheable SVG as the default pattern for brand art; use inline SVG only for very small primitives.

## 07/17/2026 Resi Portfolio Edge Official LBLE SVG And Narrow Rating Scale

- Published Champions Green gated preview v11 at `https://championsgreen-ga.com/?edge_preview=1`. Current Worker version is `659e8210-84c7-43a9-b8fe-b91d26b5a981`; template/schema version is `2026-07-17.performance-topper-measured-preview-v11-official-lble-rating-scale`; cache version is `2026-07-17-performance-topper-measured-preview-v11-official-lble-rating-scale`.
- The official `Live Better. Live Easy.` SVG supplied by Mark is now bundled into the Worker as a text module and rendered as a data URI for the hero tagline. This bypasses the stale R2 object while preserving R2 for large optimized media. Remote R2 object upload still needs an approved token with R2 object write permission before the bucket copy can be updated directly.
- Updated the tagline sizing contract to the official SVG viewBox `374.75 / 92.57`, changed rendered dimensions to `375x93`, and added a `max-width: 767px` responsive band for the hero rating/tagline area so narrow tablet widths do not inherit oversized base stars/text.
- Live Playwright proof for `390px`, `740px`, and `1440px` confirms the decoded SVG hash matches the official source, the SVG uses the official viewBox, no horizontal overflow is introduced, and the narrow rating row scales to `22px` stars with `12px` rating text. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v11-official-lble-rating-scale-20260717/`.
- Disposition: v11 supersedes v10 as the current Champions Green measured topper. Keep this bundled-static-branding override pattern available for small governed brand assets when R2 object writes are blocked, but keep the main asset plane in R2.

## 07/17/2026 Pilot Zaraz CMP Resi Pixel Gate

- Verified `venterradev.com` Zaraz CMP is active at runtime on `pilot.venterradev.com`, with the Consent API present and the configured purposes `Analytics & Performance` and `Marketing & Leasing Attribution`.
- Updated `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` so the homepage Resi pixel is no longer a simple idle-load rewrite. The Worker removes the native `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` script, does not inject a Worker replacement loader, and leaves consent-governed loading to Zaraz.
- Corrected the previous mobile-only rewrite boundary so the direct Resi pixel is blocked on both desktop and mobile homepage requests.
- Deployed pilot Worker `edge-transparent-pricing-intro-beta` version `8601b070-f9cc-412c-b5fd-b620b7bb90a6` with `EDGE_HOME_HTML_CACHE_VERSION=2026-07-17-zaraz-cmp-resi-pixel-zaraz-owned-v1`.
- Live Playwright proof showed no pre-consent `js.getresi.co` request on desktop or mobile, no Worker idle loader, both consent purposes exposed as false on first load, and `vtr_edge_home_resi_pixel:native-blocked-zaraz` in server timing. After the Resi Pixel pageview action was saved in Zaraz, programmatic acceptance of both consent purposes loaded `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` through Zaraz with no Worker duplicate loader. Cloudflare Monitoring remains a separate Zaraz/dashboard policy decision.
- Disposition: CMP enforcement is wired for blocking the native direct Resi pixel and loading the Zaraz-owned Resi Pixel after consent. Production hardening should confirm the generic `Pageview` trigger is hostname-scoped to `pilot.venterradev.com` and run a visible-modal acceptance proof.
- Follow-up UX pass: added a Worker-injected passive bottom cookie notice with `Accept`, `Reject`, and `Manage` while keeping Zaraz `Show consent modal` disabled. Deployed Worker version `d724adc6-cf63-4d7a-a8cf-d5866f18b317` with `EDGE_HOME_HTML_CACHE_VERSION=2026-07-17-zaraz-cmp-passive-notice-v6` and `EDGE_ZARAZ_CONSENT_NOTICE_ENABLED=true`. Desktop/mobile proof showed the notice at the bottom, no pre-consent Resi pixel, `Accept` as the prominent primary action, and `Manage` as a text link. The direct Resi pixel is now removed from all pilot HTML pages except excluded admin/API/static paths, and the passive notice keeps a session-scoped pre-consent queue of lightweight page/CTA facts. Accepting consent flushes queued `vtr_preconsent_interaction` events through Zaraz and then loads Resi Pixel; rejecting consent clears the queue and does not load Resi Pixel. If a visitor leaves/closes without selecting a consent option, `pagehide` sends a minimal first-party unresolved-consent report to the Worker endpoint `/__vtr/zaraz-consent-unresolved`, which stores sanitized rows in D1 table `zaraz_consent_unresolved_reports`; same-site internal navigation is suppressed so the queue can carry forward.

## 07/16/2026 Public Steps To Freedom Guided App

- Added the first public guided app surface for `Steps to Freedom in Christ` at `/steps` in `apps/web`, intended as the code path for a future `steps.yournamehere.vip` public doorway and a reusable foundation for the logged-in Freedom app.
- The route bypasses the internal app shell through the public route allowlist and renders without sidebar/login chrome.
- Source governance: `apps/web/src/lib/freedom/steps-content.ts` holds a source-locked content model. The renderer is allowed to add navigation, checkboxes, custom entries, progress marks, export, and clear controls, but generated prayer text only substitutes participant entries into the document's own prayer patterns.
- Current interaction scope covers preparation, all seven steps, Step 3 person/hurt forgiveness rows, Step 6 bondage selections, Step 7 declaration, aftercare, daily prayer, and In Christ affirmations. Public state remains browser-session local with no server persistence in this pass.
- Published a separate public Cloudflare Pages project `steps-freedom` and attached `steps.yournamehere.vip`, because the existing internal app/custom route is intentionally protected by Cloudflare Access. The subdomain root redirects to `/steps`; direct validation returned `302` then `200`.
- Validation: `npm run build` in `apps/web` passed with `/steps` generated as a static route. Locked PIB paths were not modified.
- Follow-up: the public Steps app now offers individual section-level `Create prayer` actions, a created worksheet email action, and a final `Entire journey prayers` panel on the last step. The final panel compiles every selected/written prayer item in source order while preserving each as an individual prayer and supports local printing for both filled-in prayers and blank prayer worksheets with adjustable blank rows per template.
- Follow-up UX expansion: the public Steps app now supports Digital, Printable, and Facilitator session paths; optional privacy blur for sensitive entries; optional browser-local resume; grouped final journey review by step; print packs for filled prayers, blank worksheets, full packet, and aftercare/affirmations; and attribution to `yournamehere.vip`, Neil Anderson, and Freedom in Christ Ministries in the app, exports, emails, and printouts.
- Follow-up progressive disclosure correction: the public Steps app now opens with a three-page orientation that explains the experience, path choice, privacy/local-resume implications, and print-record handling before the participant enters the source text. In-session export/email/print/clear controls are collapsed under `Session tools`, path/privacy controls are collapsed under `Session options`, and each step begins with a short `What happens here` briefing before the exact source text. Mobile users now get a collapsed step list, compact current-step card, reduced header scale, and sticky bottom Previous/Next controls.
- Follow-up Step 7 correction: the `Sins and iniquities of my ancestors` field now has an explicit `Prepare declaration` action. Prepared entries are inserted only at the source declaration blank `(name those that have come to mind)` and are included in final journey email/export/filled-print output as a declaration item.
- Follow-up server-send email correction: Mark chose system-sent email instead of visitor-owned `mailto:` handoff, with no Pond/Data API association. The public Steps app now posts either the created worksheet or entire journey payload to same-site `/api/email`, owned by the standalone `steps-freedom-email` Cloudflare Worker. Boundary: no prayer-content persistence, no content logging, origin restriction to the Steps app, per-connection and per-recipient rate limits, and the same exact-prayer content model remains the source of rendered prayer/declaration text.
- Disposition: extend this same content model into the authenticated Freedom app for saved maintenance/progress rather than creating a separate content copy. Before public domain launch, complete an exact-text review against the authorized PDF and decide the publishing route for `steps.yournamehere.vip`.

## 07/16/2026 Resi Portfolio Edge Boxed Header And Head Metadata Pass

- Published Champions Green gated preview v7 at `https://championsgreen-ga.com/?edge_preview=1`. Current live Worker version: `7b0aa5fc-fe14-4750-9418-d5f7298ebc9f`; template/schema version `2026-07-16.performance-topper-measured-preview-v7`; cache version `2026-07-16-performance-topper-measured-preview-v7`; mode `performance-topper`.
- Corrected the desktop header rail to use the same measured content box as the body sections. Live Playwright proof shows the `1845px` header logo starts at `122.5px`, the menu/right actions end at `1722.5px`, and the first content grid is `x=122.5 width=1600`.
- Added governed topper head metadata: corrected title, description, canonical, preview noindex, explicit native favicon/apple icon links, OG/Twitter title and description, and JSON-LD for WebSite, LocalBusiness, ApartmentComplex, and Organization.
- Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v7-20260716/`. PageSpeed evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v7-head-header/`; mobile exact `99`, mobile fresh `98`, desktop exact/fresh `100/100`, TBT `0ms`.
- Disposition: v7 supersedes v6 as the current measured topper baseline. Continue polishing visual parity from v7 while preserving the lightweight topper path and using exact-native as the calibration lane.

## 07/16/2026 Resi Portfolio Edge Width And CTA Fidelity Pass

- Published Champions Green gated preview v6 at `https://championsgreen-ga.com/?edge_preview=1`. Current live Worker version: `4f423f8a-a456-4505-bf61-45f74434fe35`; template/schema version `2026-07-16.performance-topper-measured-preview-v6`; cache version `2026-07-16-performance-topper-measured-preview-v6`; mode `performance-topper`.
- Added native-measured main CTA behavior: `50px` height, `14px` Lato `900`, `46px` line height, `2px` white border, no shadow, white fill/navy text by default, transparent fill/white text on hover.
- Corrected desktop hero height and section flow. At `1440x1400`, the topper hero now matches native `x=0 y=126 width=1440 height=1274`; welcome starts at `y=1400`.
- Corrected responsive page widths. Standard desktop uses native `1360px` inner grid with `645px / 70px / 645px`; wide desktop uses native `1600px` inner grid with `765px / 70px / 765px`.
- Fixed reveal-animation horizontal overflow and kept the mobile welcome block closer to native by suppressing the welcome image on mobile.
- Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v6-20260716/`. PageSpeed evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v6-width-cta/`; mobile exact/fresh `99/99`, desktop exact/fresh `100/100`, TBT `0ms`.
- Disposition: v6 is the current measured topper state for visual/performance work. Keep exact-native as calibration, but continue polishing the data-driven topper rather than returning to full native payload.

## 07/16/2026 Resi Portfolio Edge Measured Performance Topper Restored

- Restored the Champions Green gated preview at `https://championsgreen-ga.com/?edge_preview=1` to the high-score measured performance topper after exact-native proved useful for visual calibration but too heavy for mobile PSI.
- Current live Worker version: `939e9c34-69f2-40ee-8d96-64fe45541e92`; template/schema version `2026-07-16.performance-topper-measured-preview-v3`; cache version `2026-07-16-performance-topper-measured-preview-v3`; mode `performance-topper`.
- The route uses optimized R2 assets, no initial native `/wp-content/` payload, lazy native continuation, and measured native drawer geometry from the Playwright geometry packet.
- Visual/menu evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v3-20260716/`.
- PageSpeed evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716205108-pagespeed/`; mobile exact `99` and `98`, mobile fresh `98` and `98`, desktop exact/fresh all `100`, TBT `0ms`, `10` requests.
- Disposition: exact-native remains the reference lane. Production-scale work should continue from the measured topper path and use Playwright geometry/screenshot comparison to close visual gaps without reintroducing full native payload.

## 07/16/2026 Resi Portfolio Edge Measured Native Geometry Contract

- Added a Playwright-backed native homepage geometry contract to the WebOps lab so the Resi Portfolio Edge topper can be calibrated from measured native render state instead of manual CSS approximation.
- New schema: `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/native-html/homepage-geometry.schema.json`.
- New tool and command: `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/measure_homepage_geometry.mjs`, exposed as `make measure-resi-edge`.
- Generated Champions Green geometry packet: `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-geometry.json`. Evidence/screenshots: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/homepage-geometry-20260716/`.
- The capture includes desktop/mobile closed, promo-open, and menu-open states. It records the exact native menu/promo/header/hero section geometry, typography, and live social links needed to close the mismatch Mark called out.
- Template generation now embeds the measured geometry into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/template-instances/GA4CG.desktop-template-instance.json` and `GA4CG.mobile-template-instance.json`; durable contract validation requires these geometry-backed template instances.
- Disposition: this is a lab capability and does not change the live Worker route by itself. The next runtime step is to consume the embedded measurements in the topper renderer while preserving the high-score architecture.

## 07/16/2026 Resi Portfolio Edge Exact-Native Performance Ceiling

- Published two surgical exact-native performance passes for the Champions Green gated preview at `https://championsgreen-ga.com/?edge_preview=1` after exact-native was restored for visual fidelity. Current live Worker version is `e71dc168-f7d6-4bd4-b22f-63858a3535e6`.
- The live template/schema version is `2026-07-16.exact-native-template-perf-v2`; cache version is `2026-07-16-exact-native-template-perf-v2`; mode remains `exact-native-homepage`.
- v1 kept native DOM/menu/header/hero behavior while adding hero preload/background discovery, duplicate stylesheet removal, preview-only third-party analytics blocking, and delayed loading for non-hero DAM media. Fresh PageSpeed moved exact-native from roughly mobile `58-59` to mobile `70`, desktop `98`.
- v2 reused the established R2 image optimization lane for mobile only: mobile user agents now receive `/assets/resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif` as the native hero background/data source, while desktop keeps the native DAM hero because desktop was already high-performing and visually lower-risk.
- v2 proof: mobile `78`, LCP `3527ms`, TBT `328.5ms`, total byte weight `576221`, `25` requests; desktop `95`, LCP `1074ms`, TBT `151ms`, total byte weight `1416973`, `26` requests. Evidence lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-perf-v2-20260716/`.
- Disposition: exact-native is useful as the visual calibration/reference lane and can be made less costly, but it is not the high-90 mobile delivery model. The high-score architecture remains the accurate topper/performance shell using native capture geometry, R2 assets, promo control, and lazy/native continuation. Do not continue reworking exact-native as if it can replace the topper unless Mark explicitly chooses that tradeoff.

## 07/16/2026 Resi Portfolio Edge Exact Native Template Publish

- Published the Champions Green gated preview at `https://championsgreen-ga.com/?edge_preview=1` as an exact-native homepage pass-through. Latest Worker version is `fc40f3cf-648b-4a1f-a6ef-7eb740a807f3`.
- The live template/schema version is `2026-07-16.exact-native-template-head-v2`; cache version is `2026-07-16-exact-native-template-head-v2`; mode is `exact-native-homepage`.
- This supersedes the active `performance-topper` delivery path for the gated preview because Mark required the entire template area to match the original live site using actual live HTML, not approximation. The Worker now fetches the clean native Resi/YOOtheme homepage and preserves native promo/header/hero/review/tagline/menu markup and CSS, adding only noindex/edge metadata markers.
- Cloudflare cache was purged for the preview homepage, root homepage, and `/favicon.ico` after deploy. Plain preview headers now report `x-resi-edge-mode: exact-native-homepage`, `x-resi-edge-template-version: 2026-07-16.exact-native-template-head-v2`, and `server-timing: vtr_exact_native_homepage;desc="native-dom"`.
- Head follow-up: the preview now normalizes the visible browser title plus `dc.title`, `og:title`, and `twitter:title` to `Champions Green Apartments in Alpharetta, GA`, serves `/favicon.ico` from the native PNG favicon, adds explicit icon/apple/shortcut icon links, and removes the native `index, follow` robots meta before adding the preview `noindex,nofollow`.
- Evidence: native source HTML and geometry capture in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/native-html-20260716-exact/`; live preview screenshots, menu screenshots, summary, and reviews link proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-20260716/`.
- Head evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-head-v2-20260716/summary.json`.
- Disposition: for this gated Champions Green review lane, exact visual parity is currently the governing requirement. Do not restore the hand-built topper unless Mark explicitly chooses the PageSpeed tradeoff again.

## 07/16/2026 Resi Portfolio Edge SVG Tagline Responsive Publish

- Published the Champions Green gated topper cleanup at `https://championsgreen-ga.com/?edge_preview=1`. Latest Worker version is `e883b995-957f-4b8e-b33f-e4e7c5beee6f`.
- The live template/schema version is `2026-07-16.performance-topper-v4-svg-tagline-responsive-reviews-link`; cache version is `2026-07-16-performance-topper-v4-svg-tagline-responsive-reviews-link`; mode remains `performance-topper`.
- The hero tagline now uses the existing `resi-edge-assets/shared/lble.svg` with a governed responsive wrapper: explicit `841.36 / 201.78` aspect ratio, clamp-based desktop/mobile widths, and `object-fit: contain`. This avoids font-dependent visual drift while retaining the accessible label and real text semantics elsewhere in the hero.
- Cleanup also right-anchored the off-canvas drawer and applied shell-level horizontal overflow protection so the responsive SVG/drawer combination does not create visible horizontal scrolling.
- Follow-up accessibility/navigation fix converted the hero rating row from a plain element to an anchor. Live proof shows `.vtr-shell-rating` has `href="/reviews/"` and clicking the star/review row navigates to `https://championsgreen-ga.com/reviews/`. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-reviews-link-20260716/summary.json`.
- Live proof: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-svg-tagline-responsive-20260716-clean-v2/summary.json`. Desktop measured the SVG at `691x166`; mobile measured `242x58`; both loaded complete with computed aspect ratio `841.36 / 201.78`.
- Compact PageSpeed proof: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716180818-pagespeed/PERFORMANCE_READOUT.md`; mobile exact `98`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, and TBT `0ms`.
- Disposition: keep the SVG tagline sizing contract in both the live prototype Worker and reusable WebOps runtime until the reusable runtime fully replaces the prototype source.

## 07/16/2026 Morning Full D1 Mirror Bounded Sync Repair

- Repaired the Morning Full Portfolio Report D1 mirror alert from the `07/16/2026 11:23 AM` send. The failure was not source freshness; it was D1 mirror sync reliability.
- Root cause: Wrangler `4.68.1` failed remote D1 file imports with `fetch failed` after Cloudflare accepted the import request, while Google Ads and GSC D1 sync scripts ignored orchestrator `--date` / `--weeks` arguments and pushed large historical imports on each retry.
- Updated `apps/api/scripts/google_ads_to_d1.py` and `apps/api/scripts/gsc_daily_to_d1.py` so D1 mirror orchestration arguments bound source rows by date/window instead of full history. This keeps routine retry payloads focused on the current mirror window.
- Upgraded `apps/api` to Wrangler `4.100.0` with matching `@cloudflare/workers-types` `4.20260611.1`, staying on the Worker Types v4 line while avoiding the observed Wrangler `4.68.1` D1 import failure.
- Verification: focused Google Ads repair loaded `07/15/2026` rows into D1 (`185` campaign rows and `1,693` keyword rows), then full mirror verification passed with `core_success=true` in `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260716_121859.json`.
- Disposition: keep extending the canonical D1 mirror scripts and Morning Full report path; do not create alternate D1 mirror/report status renderers.

## 07/15/2026 Property Intel Pack Product

- Productized the former Content Intelligence Pack lane as **Property Intel Pack**, the Content Ops companion to PIB, to be evolved by Mark and Alexandra Hopkins. Governing standard: `/Users/mark/Property_Analytics/docs/PROPERTY_INTEL_PACK_STANDARD_2026-07-15.md`.
- Added/retained `content_intelligence_pack` as the governed Ad Hoc Executive Report System report type in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`. The internal report type may remain for system continuity; future visible artifact language should use `Property Intel Pack`.
- The product is single-property and action-oriented for Content Ops. It resolves `--scope` through the canonical property identity matrix and renders through the existing Outlook-safe report builder, validator, workbook writer, packet archive, and universal sender path.
- Source coverage: fresh DataForSEO SERP rows (`dataforseo_property_keyword_rankings`, `dataforseo_serp_results`), DataForSEO keyword demand, OnPage, and AI visibility rows, official-page competitor market research observations, and GBP review sentiment themes.
- First production use on `07/15/2026`: Cendana District West and The Retreat received fresh SERP pulls and official-page competitor packets. Cendana was not found in the top 30 for the five tested Richmond/District West priority terms; The Retreat was found for four of six tested priority Richmond/Grand Mission/Grand Parkway terms.
- Presentation note from Mark after first send: the Content Intelligence Pack email was too wide in Outlook preview. Future iterations should keep the same evidence/workbook concept but use a narrower email-pane-friendly body: fewer KPI columns per row, compact question text, and table layouts that do not require horizontal scrolling/clipping.
- Disposition: use this report type when Alex/Content Ops needs a writing-action packet rather than a general analytics workup. Continue collecting SERP evidence through the Keeper-backed DataForSEO helper and competitor observations through the governed competitor market packet builder/ingest path.

## 07/15/2026 Content Manager Workup Ad Hoc Report

- Added `content_manager_workup` as a governed Ad Hoc Executive Report System report type in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, with CLI discoverability in `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`.
- The capability is single-property and property-identity governed. It resolves `--scope` through the canonical identity matrix, then builds an Outlook-safe report and workbook through the existing ad hoc orchestrator, renderer, validator, and universal email sender.
- Source coverage: GA4 daily metrics, GA4 channel rows, GA4 action events, GSC queries, DataForSEO keyword metrics, DataForSEO Labs ranked keywords, DataForSEO OnPage snapshots, DataForSEO business profiles, DataForSEO AI visibility probes, governed competitor sets, unit availability, guest-card DW direct rows, operating metrics, and PageSpeed metrics.
- First production use on `07/15/2026`: Cendana District West (`TX4CD`) and The Retreat (`TX4GM`) received fresh DataForSEO deep-trial packets and emailed Content Manager Workup reports for Mark/Alex. The canonical PIB v2.2.1 emails for both properties were also sent without modifying locked PIB files.
- Disposition: extend this existing report type for future content-manager deep workups instead of creating standalone HTML email scripts. Continue routing DataForSEO refreshes through Keeper-backed helpers and storing evidence in the Data Pond enrichment tables.

## 07/14/2026 Human-Facing Date Format Standard

- Added a repository-wide agent directive in `/Users/mark/Property_Analytics/AGENTS.md` requiring `MM/DD/YYYY` for all human-facing dates in reports, emails, decks, documents, spreadsheets, UI labels, narrative summaries, captions, and final user-facing messages unless explicitly overridden by Mark in the current task.
- ISO `YYYY-MM-DD` remains appropriate for machine-readable/internal artifacts: filenames, file paths, JSON contracts, API payloads, database values, logs, sortable IDs, specs, and validation metadata.
- Disposition: apply this as an executive-deliverable and UI/reporting standard across new and materially updated reader-facing output. Do not reinterpret internal artifact paths or IDs; translate nearby narrative date ranges for humans.

## 07/14/2026 Property-Scoped GA4 Web Traffic Trend And Copy-Impact Reports

- Extended the governed Ad Hoc Executive Report System `ga4_traffic_summary` capability in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` to support property-scoped report requests through the existing governed property identity resolver.
- `scope` can now resolve a property name, property code, or GA4 property id; the report keeps the existing Outlook-safe HTML/workbook/run-packet contract under `/Users/mark/Property_Analytics/reports/adhoc_executive/ga4_traffic_summary/`.
- The report now includes daily trend rows, computed engagement rate from engaged sessions when the daily engagement-rate column is absent, channel key-event totals, action-event summaries from `ga4_event_facts`, and GA4 Data API hourly extraction for afternoon copy-change splits.
- Copy/week-over-week subjects now trigger a focused impact mode that compares the prior week against the copy week and returns a Positive, Mixed, Negative, or Inconclusive verdict with channel drivers, action-event movement, hourly timing context, and daily context.
- Latest produced packets: The Whitney and The Harrison for `06/30/2026` through `07/13/2026`, treating `07/07/2026 12:00 PM` as the afternoon copy-change transition point. The impact read is Mixed for The Whitney and Negative for The Harrison. Both passed Outlook safety validation.
- Disposition: keep extending the governed ad hoc report engine and shared renderer for specialty web traffic reports; do not create one-off HTML email/report scripts for property traffic trend requests.

## 2026-07-13 WebOps Tabstack Web Intelligence

- Created the reusable WebOps toolbox capability `Tabstack Web Intelligence` in `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/`, with toolbox catalog entry `/Users/mark/Web_Operations/toolbox/tabstack-web-intelligence/README.md`.
- The capability uses Mozilla Tabstack for managed public-web extraction, markdown conversion, and schema-normalized JSON extraction. Current scripts are `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/scripts/lib/tabstack_client.mjs`, `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/scripts/run_tabstack_smoke.mjs`, and `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/scripts/run_concessions_monitor.mjs`.
- Credential posture is Keeper-first. Mark created Keeper record `Tabstack API Key`; the shared client resolves that record by title, supports `KSM_TABSTACK_API_KEY_NOTATION` as an override, and treats `TABSTACK_API_KEY` as a one-session fallback only.
- Smoke proof passed on `2026-07-13T195038400Z`; follow-up durable command proof on `2026-07-13T201306154Z` resolved the Keeper record by title without a notation env var. Latest sanitized evidence is `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/evidence/2026-07-13T201306154Z/summary.json`.
- First concessions demo passed on `2026-07-13T195513318Z` across five public Davenport / Champions Gate sources, normalizing concession language into a shared schema. Direct property sites were substantially faster than aggregator/listing pages. Evidence is `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/evidence/concessions-2026-07-13T195513318Z/summary.json`; readout is `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/CONCESSIONS_MONITOR_READOUT.md`.
- Disposition: keep and extend as advisory WebOps R&D/toolbox capability. Do not promote to production Data Collection, Captain reads, recurring automation, or executive-facing reporting until governed comp-set ownership, credit budget, cadence, QA threshold, and output/storage contracts are defined.

## 2026-07-16 Resi Portfolio Edge Topper Fidelity Pass

- Champions Green gated route remains the active topper model and is now deployed as Worker `3b0a2ac8-aa63-4f36-bf2f-d4fc4721c4bd`, template/schema version `2026-07-16.performance-topper-v4-fidelity-p-edge-fonts`, mode `performance-topper`, and cache version `2026-07-16-performance-topper-v4-fidelity-p-edge-fonts`.
- The latest fidelity pass uses native `Lato` and `Noto Serif` font faces through the edge asset path, keeps direct WordPress asset URLs out of the rendered topper shell, restores the native-style mobile drawer labels/socials/close behavior, and holds the PageSpeed gate at mobile `98/98` and desktop `100/100`.
- The desktop promo popdown was tightened against the exact-native reference: absolute overlay, `391px` height, no layout push, desktop promo image visible at `416x312`, mobile image hidden, and desktop headline no longer wraps. This preserves the global promo yes/no pattern while improving visual parity.
- Welcome and features media now use native-like reveal animation: welcome enters from the right, features enters from the left, both settle to `opacity:1` and `transform:none`, and reduced-motion users receive no animation.
- Evidence lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/topper-fidelity-pass-20260716-l2/`; performance proof lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v4-fidelity-l2-attempt2/`. PageSpeed passed at mobile exact `99`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, `6` requests, CLS `0`, and desktop TBT `0ms`.
- Validation passed through `/Users/mark/Web_Operations` `npm run validate`, `/Users/mark/Property_Analytics` `bash scripts/check_pib_guardrails.sh`, and `/Users/mark/Property_Analytics` `bash scripts/check_context_discipline.sh`.
- Disposition: continue using exact-native captures as the calibration reference, but keep the active gated route as the lightweight topper until full-native can preserve high scores.

## 2026-07-12 Resi Portfolio Edge Accurate Topper V4

- Champions Green gated route is now deployed as Worker `9c9104e2-05c8-4898-a853-d68ea021764e`, template version `2026-07-12.performance-topper-v4-native-geometry`, mode `performance-topper`, and cache version `2026-07-12-performance-topper-v4-native-geometry-f`.
- Follow-up continuation bottom-gap fix deployed Worker `640bff1e-ac5e-48ae-8691-65b89fc07892` with cache version `2026-07-12-performance-topper-v4-native-geometry-g`. The lazy native iframe now reports stable native body height instead of documentElement viewport height, and the loaded continuation wrapper no longer keeps bottom padding.
- Bottom-gap evidence lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/continuation-bottom-gap-20260712-g/`; parent section height, iframe height, inner body height, and footer bottom all match at `4655px`.
- Post-fix PageSpeed proof lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712-topper-v4-native-geometry-g/`: mobile exact `100`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, `6` requests, CLS `0`, TBT `0ms`.
- The route has returned to the intended topper architecture: the initial gated document is an edge-owned, lightweight topper with R2 hero assets, promo/header/hero/welcome/features, and lazy native continuation. It does not ship the native `/wp-content/` payload in the scoring path.
- The topper is calibrated from exact-native measurements instead of guessed layout. Desktop promo/header/hero/welcome/features bands align with native coordinates, welcome media matches native `645x500` placement, the Kingsley badge is back on the native left rail within a few pixels, mobile promo/header/hero geometry matches native, and the desktop promo overlay includes the promo image without pushing content.
- Final PageSpeed proof lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712-topper-v4-native-geometry-f/`: mobile exact `100`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, `6` requests, CLS `0`, mobile TBT `0ms`, desktop TBT `0-32ms`.
- Disposition: active gated preview path is the accurate topper. The exact-native pass remains the calibration reference and should not replace the topper unless a future optimization path can preserve high scores with full native DOM.

## 2026-07-12 Resi Portfolio Edge Exact Native Accuracy Baseline

- Champions Green gated route is now deployed as Worker `d1b1a82f-97c6-4d82-8ae8-b956155c94f0`, template version `2026-07-12.exact-native-homepage-v1`, mode `exact-native-homepage`, and cache version `2026-07-12-exact-native-homepage-v1`.
- Superseded the same day by the accurate topper v4 route above. Exact-native remains the visual calibration reference, not the active high-score delivery model.
- The gated homepage now uses the real native Resi/YOOtheme homepage DOM as the visual contract. It fetches the clean native homepage, strips the edge-only request posture, preserves the native header, promo, hero, welcome, apartment features, reviews, lower sections, and footer, and adds only edge headers/markers plus promo-state control.
- Desktop browser proof matches native geometry exactly: body height `7575`, hero top `126` height `1320`, welcome top `1446`, apartment features top `2186`, and Kingsley badge left `40` top `1977` size `64x64`. Mobile proof also matches native geometry exactly: body height `8097`, hero top `126` height `584`, welcome top `710`, apartment features top `1431`, and Kingsley badge left `15` top `1297` size `64x64`.
- Promo proof confirms the native desktop popdown overlays the page, includes the native desktop promo image, and does not push content; body-height shift and hero-top shift are both `0`. Evidence lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-20260712-v1/`.
- Compact PageSpeed measured the cost of exact native delivery: mobile exact `53`, mobile fresh `61`, desktop exact `82`, desktop fresh `97`, `48-50` requests, and `2.8-3.4 MB` transfer. Disposition: this is the accuracy baseline. The next capability step is exact-DOM optimization: reduce native script/asset cost while preserving native geometry and section structure.

## 2026-07-12 Resi Portfolio Edge Template Polish V3

- Champions Green gated route is now deployed as Worker `5f2189b7-cbe6-4452-8685-dc2518bf19bc`, template version `2026-07-12.performance-hybrid-shell-v3-template-polish`.
- The v3 polish fixed visual fidelity issues in the first reusable template proof: media rounding, Kingsley badge placement, native welcome-copy fallback drift, and desktop lazy/native continuation height growth.
- Evidence lives in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-polish-20260712/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712190211-pagespeed/`.
- Compact PageSpeed gate after polish passed at mobile exact `100`, mobile fresh `99`, desktop exact `100`, desktop fresh `100`, with TBT `0ms`, CLS `0`, and `6` requests.
- Disposition: continue visual parity review before corporate promotion; keep the gated v3 proof as the current live state while deciding iframe continuation versus section-level native extraction for the global template.

## 2026-07-10 WebOps Corporate Repository

- Established the corporate WebOps department repository at `/Users/mark/web-ops`, remote `git@github.com:venterra-realty/web-ops.git`, with initial scaffold commit `48fd3c9` pushed to `main`.
- The repo is the clean corporate promotion target for reviewed WebOps work: department charter, project index, Data Pond-readable registry, standards, platform lanes, GitHub review templates, and project dossiers.
- First project shell: `projects/resi-portfolio-edge/`, covering portfolio edge delivery, topper pages, Cloudflare/R2, performance optimization, and Data Pond contracts. Commit `11cae66` added the first draft promotion-test package: Worker source snapshot, reviewed Champions Green config example, draft image-generation utility, reviewed Wrangler example, architecture/Data Pond/performance/promotion docs, and validation checklists. Implementation artifacts should be promoted from the working repository only after review, validation, and documentation.
- A clean local Web Operations lab now exists at `/Users/mark/Web_Operations`. It is seeded from the reviewed corporate `resi-portfolio-edge` package and adds the lab operating model, lab index, promotion-packet workspace, evidence/intake/archive directories, a draft dev container scaffold, and `make validate`. Docker is not currently installed/on PATH, so container build proof remains pending.
- WebOps now has a required project memory and capability-awareness standard at `/Users/mark/Web_Operations/standards/memory-and-capabilities/`, plus a machine-readable lab capability index at `/Users/mark/Web_Operations/capability-index.json`. Active projects should maintain `memory/` dossiers with narrative, timeline, decisions, failed paths, open threads, terms, and capability links. Resi Portfolio Edge has the first memory dossier at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/memory/`.
- WebOps now also has a required project re-entry pack standard. The SOP/template live at `/Users/mark/Web_Operations/standards/memory-and-capabilities/PROJECT_REENTRY_PACK_SOP.md` and `PROJECT_REENTRY_PACK_TEMPLATE.md`. Active projects should maintain `START_HERE.md`, `CURRENT_STATE.json`, `LAST_SESSION.md`, `ONBOARDING_PATH.md`, `WORKING_COMMANDS.md`, and `SYSTEM_BOUNDARIES.md` at the project root. Resi Portfolio Edge is the first implementation, and lab validation now checks `CURRENT_STATE.json`.
- WebOps now also has a detailed session-record archive standard at `/Users/mark/Web_Operations/standards/memory-and-capabilities/SESSION_RECORDS_SOP.md` and `SESSION_RECORD_TEMPLATE.md`. Active projects should maintain `memory/sessions/` records for meaningful project turns. Resi Portfolio Edge now has detailed session records for the 2026-07-10 corporate Git route, repo scaffold, promotion test, lab creation, memory/re-entry standards, and session archive setup.
- WebOps now has a mandatory Daily Start / Daily Close SOP at `/Users/mark/Web_Operations/standards/memory-and-capabilities/DAILY_START_CLOSE_SOP.md`. Active project work must begin with the current re-entry pack, open threads, capability links, system boundaries, and working commands; work touching architecture, promotion, credentials, deployment, performance, monitoring, or reusable capabilities must also read the targeted governing docs. Meaningful sessions must close by updating project state, latest-session handoff, session records, and capability/governance records as needed.
- A selective intake process now governs movement from `Property_Analytics` to the WebOps lab. The first intake plan and candidate inventory live at `/Users/mark/Web_Operations/intake/from-property-analytics/`, and the Resi Portfolio Edge promotion queue lives at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/PROMOTION_QUEUE.md`. This process classifies candidates as promoted draft, lab candidate, reference-only, or stay-canonical-reference. Raw performance report trees, live deployment configs, KSM/credential material, property identity, and Data Pond machinery should not be moved wholesale.
- Resi Portfolio Edge now has its first externalized Data Pond-shaped property config packet at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/properties/GA4CG.edge-config.json`. The project-local validator `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/config/validate_edge_config.mjs` projects the packet into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/property-config.draft.js`, and the draft Worker imports that generated module. This is the lab pattern for templating future properties before corporate promotion.
- Resi Portfolio Edge now has a runtime split in the lab: `src/worker/worker.draft.js` is the composition entry, `src/worker/resi-edge-runtime.draft.js` owns reusable Worker behavior/rendering, and `src/worker/property-config.draft.js` remains generated from the property packet. `tests/runtime/worker-smoke.mjs` proves local health, manifest, mocked R2 passthrough, property-scoped cache keys, preview cache bypass, promo-off rendering, and required-field validation.
- Resi Portfolio Edge now has a durable HTML-capture template architecture accepted in `/Users/mark/Web_Operations/projects/resi-portfolio-edge/docs/adr/2026-07-11-durable-html-capture-template.md`. Native Resi HTML is the content plane, the feed/Data Pond packet is the control plane, R2/media manifests are the optimized asset plane, and the Worker runtime produces a render decision. New contracts live at `contracts/data-pond/edge-control-feed.schema.json`, `contracts/native-html/homepage-capture.schema.json`, and `contracts/runtime/render-decision.schema.json`; `tools/contracts/validate_durable_edge_contracts.mjs` is wired into `make validate`.
- The first native homepage extractor now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/capture_homepage.mjs`. It generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-capture.json` from the live Champions Green homepage, and `make validate` now checks both extractor syntax and generated capture contract compliance.
- The first render-decision generator now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/runtime/generate_render_decision.mjs`. It generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/decisions/GA4CG.render-decision.json` from the control feed and native capture; `make validate` now checks generator syntax and generated decision contract compliance.
- Resi Portfolio Edge now separates global templates from property-specific instances. Generic base templates live at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/templates/resi-original-yootheme-v1/desktop.template.json` and `/Users/mark/Web_Operations/projects/resi-portfolio-edge/templates/resi-original-yootheme-v1/mobile.template.json`; generated GA4CG bindings live at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/template-instances/`. Validation enforces that the base templates contain no property id, both variants exist, desktop promo includes the captured image, and mobile promo is content-only.
- Resi Portfolio Edge active runtime consumption is now wired in the lab. `/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/property-config.draft.js` exports `TEMPLATE_INSTANCES`, `worker.draft.js` passes them into the runtime, and `resi-edge-runtime.draft.js` renders the active gated hybrid shell from the selected desktop/mobile template instance for promo, header, hero, welcome, and features slots. Runtime smoke now verifies captured native rating/copy, desktop promo image rendering, mobile promo image suppression, promo-off behavior, and manifest exposure of both template instance ids. Disposition: extend this runtime-instance path and visually validate it before corporate promotion; do not reintroduce property-specific hardcoded shell copy as the source of truth.
- Resi Portfolio Edge now has local lab tooling for repeatable proof. `/Users/mark/Web_Operations/package.json` installs and exposes Wrangler, Playwright, Lighthouse, axe-core Playwright integration, and image/screenshot support libraries. `npm run tooling:check` verifies the toolchain; `npm run visual:resi-edge` runs `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/visual/check_hybrid_shell.mjs`, generating desktop/mobile screenshots and JSON evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/visual-2026-07-11-template-runtime/`. The current visual harness passes shell rendering, review-link, promo overlay no-push, desktop promo image, mobile content-only promo, image-loading, and shell accessibility checks. Disposition: use this as the required local visual proof path before performance checks and corporate promotion.
- Resi Portfolio Edge now has live gated PageSpeed proof, lazy/native continuation proof, and a lab PageSpeed gate. The Champions Green gated route at `https://championsgreen-ga.com/?edge_preview=1` is deployed as Worker `359080ad-7757-4964-bf49-4977a9ba9909`, mode `performance-hybrid-shell`, version `2026-07-11.performance-hybrid-shell-v2-lazy-native`. Evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260711-lazy-native-v2/` scored `100` on all mobile/desktop exact/fresh runs. Interaction proof under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-lazy-native-v2-screens/` shows the first document stays native-payload-free and the native continuation loads only after intent. `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/performance/run_pagespeed_checks.mjs` exposes the repeatable gate through `npm run pagespeed:resi-edge` and `make pagespeed-resi-edge`, with retry handling for transient PSI service errors. Disposition: performance and deferred native continuation are proven for the gated path; next package for review and decide iframe continuation versus section-level extraction before portfolio rollout.
- Disposition: use `Property_Analytics` as the workshop/source context and `web-ops` as the governed corporate shelf. Do not mirror loose work, personal content, secrets, raw exports, or scratch artifacts into the corporate repo.

## 2026-07-10 Champion's Green Hybrid Native-Rest Shell V2

- Corrected the Portfolio Resi Edge prototype back to the agreed hybrid architecture: edge owns only the promo/header/hero plus first two content blocks, while the real native Resi page continues below in the same document. Worker-only params are stripped before origin fetch to avoid the Resi firewall.
- Worker `portfolio-resi-edge-prototype` version `d85f1236-cbeb-4e2d-9040-0b28d5a4ddba` remains gated by `?edge_preview=1`; ungated traffic remains native. Mode is `hybrid-native-rest`; template version is `2026-07-10.hybrid-header-two-blocks-v2`.
- Promo is now an optional template module (`PROPERTY.promoEnabled`). When enabled, it matches the native popdown behavior: image + promo content in an overlay panel, no layout push, close/outside-click behavior, and no content shift.
- Disposition: this is the current architecture to refine into the reusable original-template system. Do not use the full-page cloned shell as the current state.

## 2026-07-10 Champion's Green Canonical Resi Layout Shell V3

- User visual review rejected the bare performance shell as too far from the real page. Champion's Green now uses a query-gated visual v3 shell that follows the actual Resi original-template section order: hero, welcome, apartment features, review, community amenities, benefits, neighborhood, care band, and final floor-plan CTA.
- Worker `portfolio-resi-edge-prototype` version `a6433f54-a0ac-4f3b-a9fe-7773800f35ea` remains gated behind `?edge_preview=1`; ungated traffic remains native Kinsta/Resi. Template version is `2026-07-10.all-device-shell-v3`; cache version is `2026-07-10-all-device-shell-v3-layout`.
- Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-visual-v3-final/VISUAL_V3_READOUT.md`. PSI smoke after the visual rebuild: desktop exact/fresh `100/100`; mobile exact/fresh `100/100`; TBT `0ms`; CLS `0.000`.
- Disposition: this is the canonical portfolio template direction for the original-template Resi sites. Keep layout fixed and swap property content/assets through the manifest; do not promote a generic speed-only shell.

## 2026-07-10 Champion's Green Pilot-Matched All-Device Edge Shell

- Pilot inspection confirmed the high-score lane is the static shell path (`EDGE_HOME_STATIC_SHELL_ENABLED=true`): edge-owned first viewport, native script/style payload removed from initial render, and native rest content loaded after scroll/interaction. Champion's Green now applies the same architecture to gated desktop and mobile homepage traffic.
- Worker `portfolio-resi-edge-prototype` version `61ec7685-76c8-431c-b373-2cae87e35d11` is routed to `championsgreen-ga.com/*`; activation remains gated by `?edge_preview=1`, and ungated traffic remains native Kinsta/Resi. Template version is `2026-07-10.all-device-shell-v1`; cache version is `2026-07-10-all-device-shell-v1`; `/health` reports `config.ok: true`.
- Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-pilot-shell-desktop-v1/PILOT_SHELL_READOUT.md`. Desktop PSI: 4/4 runs scored `100`, median LCP `622ms`, TBT `0ms`, CLS `0.000`, `6` requests. Mobile confirmation: exact `100`, fresh `100`, LCP `1877-1879ms`, TBT `0ms`, CLS `0.000`, `6` requests.
- Disposition: the portfolio template should use this all-device shell architecture with manifest-driven property facts/assets. The native desktop guard experiments are diagnostic history only, not the promotion path.

## 2026-07-10 Champion's Green Query-Gated Edge Shell Polished v8

- Champion's Green / `GA4CG` is now the first polished query-gated mobile shell candidate for the Portfolio Resi Edge Stabilization lane. Worker `portfolio-resi-edge-prototype` version `1cd224d8-2e57-48b5-bdba-777e8f0763f0` is routed to `championsgreen-ga.com/*`, but shell activation remains gated by `?edge_preview=1`; ungated traffic remains native Kinsta/Resi.
- The Worker now includes template config validation exposed through `/health`, with property-specific inputs isolated in `PROPERTY`, `ASSET_KEYS`, and `ANALYTICS` until external manifest loading is added. Polished v8 fixed missing CTA/badge fields, controlled Kingsley badge sizing, and verified required analytics queue events.
- Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-polished-v7/POLISHED_V8_READOUT.md`. Mobile PSI smoke: exact `99`, fresh `100`, LCP `1877ms`, TBT `0ms`, CLS `0.000`, `6` requests.
- Disposition: extend this lane into a manifest-driven portfolio template; require `/health config.ok`, visual QA, CTA checks, analytics queue proof, cache-version bump, and gated URL purge before adding the next property.

## 2026-07-09 Portfolio Resi Edge Stabilization Setup Note

- Added draft governed setup for a portfolio-wide Resi/YOOtheme edge stabilization system. SOP: `/Users/mark/Property_Analytics/docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md`. Champion's Green pilot manifest: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/champions-green-ga4cg.manifest.json`. Baseline packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-09/championsgreen-baseline/`.
- The setup uses Data Pond/property identity as source authority, R2 as optimized image asset storage, manifest-driven Cloudflare rewrites, default center-out mobile hero cropping, mobile edge shell/topper, native desktop with guardrails, edge-owned promo when needed, and analytics queue/replay requirements.
- Champion's Green was resolved through governed property identity as `GA4CG`; the live standalone hostname `championsgreen-ga.com` is captured as an edge hostname alias because the current matrix website URL still points to the legacy `venterraliving.com/apartments/champions-green/` path.
- Disposition: extend the existing Edge Experimentation / Edge Message Worker lineage into a governed portfolio stabilization lane; do not create per-property one-off Workers or require broad Resi builder/image-library edits.
- Prototype implementation added `/Users/mark/Property_Analytics/scripts/generate_resi_edge_assets.py`, `/Users/mark/Property_Analytics/scripts/upload_resi_edge_assets_to_r2.py`, and `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/`. Champion's Green optimized q64 assets are uploaded to remote R2 bucket `resi-edge-assets`; local Worker preview is validated at `http://127.0.0.1:8797/`, and remote workers.dev preview is deployed at `https://portfolio-resi-edge-prototype.mlaufhutte.workers.dev/` with no custom-domain route.

## 2026-07-08 Pilot Hero Viewport Stabilization Note

- `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now includes a mobile-only Pilot homepage hero viewport-height removal path controlled by `EDGE_HERO_VIEWPORT_HEIGHT_REMOVAL_ENABLED`. It removes the internal YOOtheme `uk-height-viewport="offset-top: true;"` wrapper attribute, marks the wrapper, and applies a stable mobile `min-height:718px` rule matching the previously successful diagnostic mock. `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml` enables the flag and sets `EDGE_HOME_HTML_CACHE_VERSION="2026-07-08-hero-viewport-removal-v2"`. Keeper-backed deploy published `edge-transparent-pricing-intro-beta` version `092e43d1-e5e8-4748-8507-13069f3d8490`. Live mobile verification showed warmed cache `HIT`, `uk-height-viewport=0`, Edge Message homepage injection still paused, and optimized hero/content/image trim markers preserved. PSI evidence: attribute-only v1 failed (`84/77/76`); corrected v2 had a cold-cache low run (`73`) followed by `91/91`, then warmed clean exact URL scored `94/94/94` with median LCP `2552ms`, TBT `0ms`, CLS `0.00712`, and `0` Heap/Contentsquare requests. Disposition: keep as a guarded Pilot stabilization proof while pursuing source-native YOOtheme cleanup; after cache-version bumps, warm the mobile edge cache before judging steady-state PSI.

## 2026-07-07 Pilot PSI Mock Variant Note

- `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now includes query-gated diagnostic-only homepage variants behind `psi_mock`, with separate Cloudflare HTML cache keys for normal and mock pages. This extends the existing Resi/Pilot performance diagnostic lane, not the production Experiment Lab. Current evidence and builder-facing recommendations are in `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/PSI_MOCK_VARIANTS_READOUT.md`.

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

2026-07-07 Pilot homepage Resi pixel idle stability POC: the Edge Message Worker gained a narrow Pilot-only mobile homepage Resi pixel idle-load flag, enabled in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml` as `EDGE_HOME_RESI_PIXEL_IDLE_ENABLED="true"` with `EDGE_HOME_RESI_PIXEL_IDLE_DELAY_MS="1750"`. Keeper-backed deploy published `edge-transparent-pricing-intro-beta` version `c14f350f-a310-4d42-9eb7-88c37e9ae4c3`. The proof keeps homepage Edge Message injection paused and leaves apartments coach-mark behavior unchanged. Live mobile HTML verified the idle loader plus the existing optimized state: hero `750`, content `900`, no `jquery-migrate`, and no homepage `filters.js`. Post-deploy PSI improved the fresh-query TBT branch versus the immediately prior retry, but clean exact URL remained low (`70/71/70`, median LCP `4964ms`, TBT `0ms`), so the durable stabilization lane remains native YOOtheme/source hero and UIkit simplification. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/HOMEPAGE_RESI_PIXEL_IDLE_STABILITY_READOUT.md`. Disposition: temporary TBT hygiene proof; do not treat it as the clean-URL stabilization fix.

2026-07-07 Pilot query-normalized edge HTML cache POC: the same Worker now has the anonymous homepage HTML cache enabled for Pilot with cache version `2026-07-07-query-normalized-v1`, deployed as `edge-transparent-pricing-intro-beta` version `19d82787-c011-4458-8a6a-579c6f6fa04f`. The homepage cache key varies by device variant and cache version, but not by marketing query strings, so `/`, `utm_*`, `gclid`, `fbclid`, and `msclkid` variants can share the same cached anonymous shell while on-page DNI/tracking still reads the browser URL after load. Preview/editor/search/admin-style params and logged-in/session cookies bypass cache. Verification showed mobile clean/query variants return `x-vtr-edge-html-cache: HIT` and `cf-cache-status: HIT`, with `?preview=true` bypassing; desktop clean/query also HIT after warmup. PSI document response dropped to `10-30ms` and query-string median scored `90`, while clean exact stayed low (`71/71/71`), proving the remaining PSI issue is not origin/cache response time. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/QUERY_NORMALIZED_EDGE_HTML_CACHE_POC.md`. Disposition: keep as the current production-shape cache proof for anonymous homepage delivery; continue isolating PSI exact-URL paint behavior separately.

2026-07-07 Pilot post-vendor speed/accessibility validation: after vendor-reported YOOtheme updates, the Pilot Worker added explicit `loading="eager"` to the accepted mobile homepage hero image and bumped the anonymous homepage cache version to `2026-07-07-hero-eager-v1`; Keeper-backed deploy published Worker version `0a719df4-43b2-4c38-b52c-e16fc7152005`. Live mobile markup now shows the `750` hero with eager loading, high fetch priority, dimensions, no homepage slideshow marker, no homepage `jquery-migrate`, and no homepage `filters.js`. Playwright mobile medians were excellent (`462ms` clean LCP/FCP, `422ms` query LCP/FCP), while PSI still showed a stubborn lab branch: clean exact scores `89/89/71`, fresh/query one successful `89` plus two Lighthouse `500`s. Vendor validation also found homepage social/map icon links still lack accessible names, even though `/reviews/` and `/contact/` pass, and `/apartments/` still contains one-image floor-plan card slideshow structures. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/POST_VENDOR_UPDATE_VALIDATION_READOUT.md`. Disposition: keep the edge proof active for measurement; builder-side next work is homepage aria labels, apartments card slideshow cleanup if in scope, and source-native above-fold UIkit simplification.

2026-07-02 Edge Message Toolkit pilot demo reinstatement: the original two-item pilot proof is live again on `pilot.venterradev.com` for demo purposes. The homepage popup runs on exact path `/` as `edge_transparent_pricing_intro_homepage_v1` with Apex West Midtown / `GA4AX` transparent-pricing copy, 7-second countdown, and always-show demo posture; the apartments helper tag runs on exact path `/apartments/` as `edge_message_all_in_pricing_coachmark_v1` anchored to `All-In Price & Details`. Route ownership is now explicit: `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml` deploys existing Worker `edge-transparent-pricing-intro-beta` to `pilot.venterradev.com/*`, while `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.toml` keeps `edge-message-worker` scoped to The Vine. Pilot Worker version `e446f570-e373-409f-a8fb-446c4866bf59` carries the reinstatement. Pages deployment `https://7e9eb13d.property-analytics.pages.dev` restores both pilot records to the Edge Messages admin alongside the two The Vine records. Disposition: keep pilot as a demo/proof route using the formalized Edge Message Worker, not as a separate popup system.

2026-07-02 Pilot Edge Message load pause for performance comparison: the formalized Edge Message Worker now supports runtime environment flags for script injection, defaulting on unless a Worker config opts out. The pilot route `edge-transparent-pricing-intro-beta` is temporarily deployed as version `0852f99a-d8fe-408c-a58f-8e49d4186b28` with `EDGE_MESSAGE_INJECTION_ENABLED="false"` and `EDGE_COACH_MARK_INJECTION_ENABLED="false"` in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml`; The Vine production Worker config remains default-on. Live curl verification showed `data-edge-message=0` on `https://pilot.venterradev.com/` and `/apartments/`, while the separate SightMap lazy-load performance layer remains active on `/apartments/`. Same-script local browser comparison lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-02/edge-message-paused/`; it showed reduced HTML/script weight and modest local LCP improvements, while quick keyed PSI post-pause runs were noisy and did not confirm an improvement over the earlier daily CSV score. Disposition: keep as temporary pilot measurement state; restore the two pilot env vars to default-on when demo messaging should resume.

2026-07-03 Pilot mobile hero source POC: the same Edge Message Worker now has a pilot-only, mobile-only homepage hero source rewrite controlled by `EDGE_HERO_MOBILE_IMAGE_ENABLED`, enabled in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml` while Edge Message and coach-mark injection remain paused. Pilot Worker version `a3b58beb-37d7-454d-94c0-457e40e24385` rewrites mobile `https://pilot.venterradev.com/` HTML so the Apex hero uses `https://pilot.venterradev.com/wp-content/uploads/2026/07/Apex-West-Midtown-Home-Hero-1200.webp 1200w` with `sizes="100vw"` and marker `Server-Timing: vtr_edge_hero_mobile;desc="mobile-source"`; desktop HTML is not rewritten. Benchmark, PSI, and GTMetrix artifacts live at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/hero-mobile-source/`, with executive readout `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_MOBILE_SOURCE_POC_READOUT.md`. The proof reduced local mobile transfer from `1,850,249` bytes to `552,310` bytes and keyed PSI byte weight from about `2.8 MB` to `1,489 KiB`, but PSI score was still `64`; a controlled Keeper-backed GTMetrix run scored `96` / structure `98` and did not show material regression versus the stored `2026-07-02` Pilot Master GTMetrix row. Next POC lane should target below-fold `Home-Amenities-full.jpg` and `Home-Features-full.jpg` requests. Disposition: keep as a temporary edge proof, not a permanent substitute for source/YOOtheme responsive image configuration.

2026-07-03 Pilot mobile image replacement POC v2: Mark supplied optimized homepage images and the Worker now has `EDGE_MOBILE_IMAGE_REPLACEMENTS_ENABLED` for mobile-only exact-source swaps on the pilot homepage, in addition to the mobile hero source rewrite. Pilot version `c6248fd6-a435-4091-a704-58e6aaee9886` swaps `Home-Welcome-full.jpg`, `Home-Features-full.jpg`, `Home-Amenities-full.jpg`, and `Venterra-Benefits_Pets-full.jpg` to the same-origin WebP replacements, with the final welcome asset `Home-Welcome-1200-1.webp` reduced to `208,414` bytes. Verification shows `vtr_edge_mobile_images` and four `data-edge-mobile-image` markers on mobile, with no desktop rewrite. The keyed PSI mobile score recovered to `84` with LCP `3,676ms`, total byte weight `892 KiB`, and `39` requests; GTMetrix stayed stable at score `96` / structure `98`, fully loaded `1,264ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_V2_READOUT.md`. Disposition: use as proof that source/YOOtheme should serve these responsive assets natively; keep the edge layer temporary for measurement.

2026-07-03 Pilot welcome 850 follow-up: the mobile welcome replacement now uses `Home-Welcome-850.webp` (`137,600` bytes), deployed as pilot Worker version `815a50dc-62f2-468b-8e45-3142902fdd88`. A repeated keyed PSI mobile run scored `88` with LCP `3,376ms` and byte weight `888 KiB` after one noisy low run and one Google `500`; GTMetrix scored `97` / structure `98`, fully loaded `1,143ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_850_READOUT.md`. Disposition: prefer the `850` welcome asset in the native YOOtheme/source implementation if visual QA passes.

2026-07-03 Pilot hero 750 follow-up: the mobile hero replacement now uses `Apex-West-Midtown-Home-Hero-750.webp` (`750 x 1001`, `99,668` bytes), deployed as pilot Worker version `2c664abf-ca30-4a6d-9521-b0771ae155a8` with the same welcome/features/amenities/pets image swaps. The best repeated keyed PSI mobile run scored `90` with LCP `3,076ms` and byte weight `827 KiB`; local homepage mobile transfer dropped to `578,608` bytes. GTMetrix cross-check was lower at score `92` / structure `98`, despite desktop path verification showing no mobile rewrite markers. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_750_WELCOME_850_READOUT.md`. Disposition: best PSI proof so far, but visually QA the `750` hero on high-density phones before recommending it as the durable YOOtheme asset; if it looks soft, use a `900-1000px` hero instead.

2026-07-03 Content image 750 rejection: tested `Home-Amenities-750.webp` and `Home-Features-750.webp` in Worker version `e780f935-c9fd-443e-9dbe-b5a8b9601920`; PSI byte weight fell to `697-705 KiB`, but mobile PSI scored only `60` and `69` with LCP above `5.3s`. The live Worker was restored to the prior best mix as version `9454ba45-4db7-4064-8a5a-6313ea007382`. Rejection note: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/CONTENT_750_REJECTION_NOTE.md`. Disposition: do not use the 750 content images unless a future visual/layout explanation changes the result; keep `Features-1200` and `Amenities-1200` in the current proof.

2026-07-03 Real demo-state image optimization proof: pilot Edge Message and coach-mark injection were re-enabled with the accepted mobile image mix (`Hero-750`, `Welcome-850`, `Features-1200`, `Amenities-1200`, `Pets-1200`) and deployed as Worker version `3025c872-a800-4d49-b4fa-1f127094913b`. Verification confirmed homepage popup, mobile image markers, apartments coach-mark, and SightMap lazy-load. The first PSI run was noisy at `67`, but the repeat scored `89` with LCP `3,076ms`, byte weight `845 KiB`, and `40` requests; GTMetrix scored `95` / structure `98`, fully loaded `1,972ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/DEMO_STATE_IMAGE_OPTIMIZED_READOUT.md`. Disposition: use this as the proof package for native YOOtheme/source implementation; keep edge rewrites temporary.

2026-07-03 Pilot homepage HTML cache POC: a narrow anonymous exact-homepage Worker HTML cache was added behind `EDGE_HOME_HTML_CACHE_ENABLED` and tested on `pilot.venterradev.com/`. It improved local median homepage TTFB (`186ms -> 107ms`) and local mobile LCP (`492ms -> 468ms`), but keyed PSI mobile stayed in the low lab band (`66`, `67`, `67`, LCP about `5.5s`) despite the hero remaining eager, discoverable, and `fetchpriority="high"`; GTMetrix scored `97` / structure `98`. The live pilot was rolled back to Worker version `963e1afb-3f91-4731-ae47-9f644fa44efd` with `EDGE_HOME_HTML_CACHE_ENABLED="false"` while keeping the accepted image mix and demo messaging enabled. Header proof after rollback shows Kinsta edge HTML cache already active (`ki-cache-type: Edge`, `ki-cf-cache-status: HIT`) and no custom `x-vtr-edge-html-cache` marker. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HOME_HTML_CACHE_POC_READOUT.md`. Disposition: do not keep custom Worker HTML caching as a PSI lever; focus on source/YOOtheme render behavior.

2026-07-03 Pilot font-display swap POC: the Edge Message Worker now has a pilot-only CSS rewrite controlled by `EDGE_FONT_DISPLAY_REWRITE_ENABLED`, enabled in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml` as Worker version `a985a17f-8f58-491a-89cb-e9fbfa5d6270`. The rewrite injects `font-display: swap` into theme `@font-face` blocks lacking font-display and returns `Server-Timing: vtr_edge_font_display;desc="swap"` on rewritten CSS. Live proof on the main theme CSS showed `39/39` font-face blocks rewritten. The homepage remained in the scroll-triggered popup plus optimized-image state (`Hero-750`, `Welcome-850`, `Features-900`, `Amenities-900`); fresh-query keyed PSI mobile scored `91`, `94`, and `91`, with median LCP `2.701s`, TBT `35ms`, byte weight about `756KB`, and `34` requests. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/FONT_DISPLAY_SWAP_READOUT.md`. Disposition: keep as a low-risk hygiene proof, but make the durable fix in YOOtheme/source CSS and then remove the edge rewrite.

2026-07-03 Pilot homepage asset trim POC: the Edge Message Worker now has a pilot-only homepage asset-trim rewrite controlled by `EDGE_HOMEPAGE_ASSET_TRIM_ENABLED` plus granular duplicate-CSS, filters-removal, and custom-JS-defer flags. It was deployed as Worker version `f2847b91-41d9-43d9-90b9-e302fc1f07fb`. The duplicate child-theme `custom.css` URLs were byte-identical (`240` bytes each, same SHA-256), so the POC removes `custom.css?ver=5.0.18`, removes homepage-only `/wp-content/plugins/resi-elements-v2/src/filters.js`, and defers `/wp-content/themes/resi-child-theme/js/custom.js`. Apartments are intentionally untouched and still carry `filters.js`, SightMap lazy-load, and the coach mark. Homepage local browser proof reduced blocking head scripts `7 -> 5`, resource count `33 -> 31`, and mobile LCP `612ms -> 572ms` with no sampled console errors or failed requests. Fresh-query keyed PSI mobile scored `92`, `89`, and `92`, with median score `92`, LCP `2.702s`, TBT `4.5ms`, and `32` requests. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HOMEPAGE_ASSET_TRIM_READOUT.md`. Disposition: keep live as a clean proof, but move the durable fix into WordPress/YOOtheme enqueue logic and then remove the edge rewrite.

2026-07-03 Pilot clean URL stabilization tests: mobile hero preload for the accepted `Apex-West-Midtown-Home-Hero-750.webp` was tested as Worker version `62485740-fa93-44d8-82a4-3ebab9652caf`; preload plus minimal mobile hero critical CSS was tested as Worker version `9d241b1f-fe1a-4ac1-854b-5b0fdedd702a`. Neither stabilized bare clean URL PSI. Preload-only clean runs split `95` and `70`; preload+critical-CSS clean runs split `69` and `96`, with the same `32` requests and about `753KB` byte weight. The live pilot was rolled back to the best proven state as Worker version `1d448321-3f74-4b74-9b94-8f11c8ace03f`, with `EDGE_HERO_MOBILE_PRELOAD_ENABLED="false"` and `EDGE_HERO_MOBILE_CRITICAL_CSS_ENABLED="false"` while keeping asset trim, font-display, hero/content image rewrites, and scroll-triggered messaging live. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_PRELOAD_CRITICAL_CSS_STABILIZATION_READOUT.md`. Disposition: do not keep edge preload/critical CSS as a stabilization fix; pursue source-native hero simplification if YOOtheme can render clean static initial HTML.

2026-07-03 Pilot homepage jQuery Migrate removal POC: the Edge Message Worker now has `EDGE_HOMEPAGE_JQUERY_MIGRATE_REMOVAL_ENABLED`, deployed as Worker version `7cf8e942-8a87-4437-a528-fd3c35fb2c41`. It removes only `/wp-includes/js/jquery/jquery-migrate.min.js` on the homepage while keeping jQuery itself and leaving apartments untouched. Live smoke confirmed homepage jQuery present / jQuery Migrate absent, while apartments retained jQuery Migrate, `filters.js`, SightMap lazy-load, and the coach mark. Local homepage mobile improved blocking head scripts `5 -> 4`, resource count `31 -> 30`, LCP `572ms -> 472ms`, DCL `637ms -> 535ms`, and load `884ms -> 663ms`; one mobile run had transient network `ERR_CONNECTION_CLOSED` resource failures but no JavaScript exception text, while other sampled runs were clean. PSI returned clean URL score `95` with LCP `2.477s`, TBT `17.5ms`, and `31` requests, plus fresh-query score `93` with LCP `2.551s`; one additional clean PSI call timed out at Google. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HOMEPAGE_JQUERY_MIGRATE_REMOVAL_READOUT.md`. Disposition: keep live as a guarded proof; source team should stop enqueueing jQuery Migrate on the homepage after confirming no homepage script depends on deprecated jQuery APIs.

2026-07-03 Pilot static hero POC: a query-gated mobile-only static hero proof was added at `https://pilot.venterradev.com/?static_hero_poc=1`, leaving the normal homepage unchanged. The Worker removes the first hero `uk-slideshow` initializer, forces the first slide into a static active layout, keeps the accepted `Apex-West-Midtown-Home-Hero-750.webp`, and marks responses with `vtr_edge_static_hero_poc`. Live browser proof was visually valid and locally faster in one sample (`872ms` normal LCP versus `348ms` POC LCP), but keyed PSI mobile rejected the edge rewrite: normal scored `89` / LCP `3,077ms`; POC scored `79` / LCP `3,676ms`, then `66` / LCP `5,671ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/static-hero-poc-live/STATIC_HERO_POC_LIVE_READOUT.md`. Disposition: static layering is possible, but do not promote the Worker-forced static rewrite as a PSI fix; ask YOOtheme for a native clean static hero if they pursue this.

2026-07-03 Pilot Edge Message mobile delay POC: after Mark removed the switcher/carousel sections, the Edge Message Worker gained env-gated mobile homepage timing controls `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS` and `EDGE_MESSAGE_MOBILE_AFTER_LOAD_IDLE_TIMEOUT_MS`. Tested `3500ms` and `6500ms` after-load variants through the Keeper/KSM-backed pilot Worker path while keeping accepted mobile image rewrites active. Local Chrome stayed healthy (`500-524ms` mobile LCP, hero `750.webp` remained LCP), but keyed PSI was unstable: `3500ms` produced one high `93` run and two low `70` runs, while `6500ms` produced only a low successful `70` after two Google Lighthouse `500`s. The pilot was restored to `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS="0"` as Worker version `da173432-dbd4-4b3c-837d-6f822a892bb4`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/EDGE_MESSAGE_MOBILE_DELAY_POC_READOUT.md`. Disposition: do not rely on timer-only popup delay as a PSI fix; next test should be interaction/scroll-gated mobile messaging, inline/lower-page messaging, or mobile-homepage suppression while retaining desktop and apartments coach-mark.

2026-07-03 Pilot no-script vs scroll-triggered mobile message POC: compared removing the homepage popup script entirely with a mobile scroll-triggered display. No homepage popup script produced local mobile LCP `492ms` and fresh-query keyed PSI `94` / LCP `2.401s`. Scroll-triggered mobile messaging produced local mobile LCP `520ms`, kept the popup overlay absent before scroll, and proved the popup appears after scroll to `700px`; fresh-query keyed PSI scored `92` / LCP `2.626s`. Clean exact-URL PSI repeated stale/low cached-looking `67-70` runs across both states, so fresh-query runs are the fair same-session comparison. The live pilot now uses scroll-gated mobile homepage messaging as Worker version `642f82c4-93b0-45a0-828f-cc66c1103d9c`, with `EDGE_MESSAGE_MOBILE_SCROLL_TRIGGER_ENABLED="true"`, threshold `360px`, and post-scroll delay `350ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/EDGE_MESSAGE_NO_SCRIPT_VS_SCROLL_TRIGGER_READOUT.md`. Disposition: keep scroll-triggered mobile as the demo compromise if homepage messaging must remain; suppress mobile homepage messaging entirely if maximum PSI is the only goal.

2026-07-03 Pilot content image 900 follow-up: swapped the mobile content replacements from `Home-Features-1200.webp` / `Home-Amenities-1200.webp` to Mark's `Home-Features-900.webp` and `Home-Amenities-900.webp` while keeping scroll-triggered mobile homepage messaging active. Worker version `b85da9be-e52b-4f9f-8e55-ec34f559f519` verified both `900` files present and both `1200` content files absent on mobile. Local mobile transfer dropped to about `544KB`, and fresh-query keyed PSI scored `91` and `93` with byte weight `755-764KB`, LCP about `2.7-2.8s`, and `34` requests. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/CONTENT_900_SCROLL_TRIGGER_READOUT.md`. Disposition: keep the `900` content images live; they reduce byte weight without repeating the earlier `750` content-image PSI regression.

2026-07-01 PIB conversion action portfolio averages, with 2026-07-02 review-card correction and v2.2.1 lock: under explicit user approval to adjust canonical PIB presentation, the Conversion Behavior Snapshot now benchmarks each visible action card against portfolio average event rate for the same report window. The canonical v2.2.0 PIB generator/template, generic locked PIB entrypoint, and v2.3.0/v2.3.1 companions were used to validate the approved behavior; Mark then approved the output on 2026-07-02 and asked to lock it as the new version. PIB v2.2.1 is now the approved Pond testing version, with versioned generator/template/sender files and `/Users/mark/Property_Analytics/scripts/process_pib_builder_generation_jobs.py` targeting v2.2.1. It computes/renders `Portfolio avg: X.X%` for Get a Quote, Schedule a Tour, Apply, Phone Calls, Directions, PDF Downloads, Form Starts, Form Submits, and Lease Magnet when the card has a real metric value. It also renders review windows with zero new reviews as `N/A` / `No new reviews in the report window` and includes latest all-time review date instead of displaying `0.00` average rating. After Whitney/Harrison exposed the old direct Office365 SMTP path, the locked v2.2.1 sender was approved to use the governed shared `utils.email_sender.EmailSender` transport, configured for AWS SES, while preserving the locked HTML body and `PIB Report - <Property Name>` display From name. Disposition: keep inside canonical PIB; future Pond Builder testing should use v2.2.1.

2026-07-01 ApartmentIQ pause and GBP review recovery: ApartmentIQ is paused pending approval of a full license. Active collection automations `apartmentiq-weekly-portfolio-dive`, `apartmentiq-daily-light-refresh`, and the stale one-off `apartmentiq-full-baseline-retry-today` were paused, and `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml` now has `enabled: false`; the daily master collector will intentionally skip the lane until re-enabled. Latest pre-pause ApartmentIQ account/comp-set data was `2026-06-21`, units/floorplans were `2026-06-05`, and the current stored API key returned `401 Unauthorized`, so the lane should not be restarted without confirming full-license access through Keeper. GBP reviews were restored after finding that the raw v4 review request path used a stale OAuth access token during long daily runs and then returned `[]` on `401`, causing false `No reviews found` / `source_limited` runs across all `91` mapped locations. `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` now refreshes OAuth before review requests, retries once on `401`, retries transient `429/5xx`, and raises non-200 responses. A canonical local review run plus targeted Clearwater Farm retry restored local `gbp_reviews` to `25,022` rows across `91` properties with latest `2026-07-01`; the full D1 mirror now matches the same row/property/latest counts in both `gbp_reviews` and `data_freshness`. Disposition: keep ApartmentIQ paused/advisory until license approval; extend the canonical GBP collector and D1 mirror path for reviews.

2026-07-01 Pond freshness / GBP review mirror correction: SEMRush is now deprecated from active Pond and Watchtower freshness rather than treated as a stale live source. Active filters live in `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`, `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`, and `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx`; `/Users/mark/Property_Analytics/apps/api/scripts/marketing_data_to_d1.py` stops writing SEMRush to `data_freshness` and deletes stale rows. GBP reviews now have a portfolio-wide D1 source mirror at `/Users/mark/Property_Analytics/apps/api/scripts/gbp_reviews_to_d1.py`, wired as a required core step in `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`. The 2026-07-01 backfill restored remote D1 to canonical local coverage (`24,493` review rows, `91` properties, latest `2026-06-02`) and removed the old mismatch where D1 had only one property's rows while freshness metadata advertised portfolio totals. GBP review collection bookkeeping now records all-skipped API returns as `source_limited`, and Watchtower/morning alerts recognize that status as a blocked source condition. Disposition: extend the canonical D1 mirror and Data Collection monitoring paths; keep historical SEMRush tables/scripts as reference until an explicit cleanup pass removes legacy dependencies.

2026-07-01 Ads/GSC source mirror hardening: the canonical collectors were healthy, but the report-serving D1 mirror was incomplete for Ads drill-down. `/Users/mark/Property_Analytics/apps/api/scripts/gsc_daily_to_d1.py` is now a required core mirror step, and `/Users/mark/Property_Analytics/apps/api/scripts/google_ads_to_d1.py` mirrors canonical `google_ads_campaigns` and `google_ads_keywords` source rows into D1 with Keeper/Wrangler auth, idempotent upserts, table/index creation, freshness updates, transient retry handling, and batch resume support. `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` runs GSC and Ads before PIB/marketing summaries. Live D1 verification after the 2026-07-01 backfill: `gsc_daily_metrics` has `25,729` report-grain rows across `93` communities through `2026-06-28`; `google_ads_campaigns` has `13,860` rows across `88` properties through `2026-06-30`; `google_ads_keywords` has `129,181` rows across `88` properties through `2026-06-30`. GSC freshness now uses grouped community/date report grain instead of raw duplicate local source rows. Disposition: extend the canonical D1 mirror path for report source data; do not add report-specific Ads/GSC side channels.

2026-07-01 Guest-card Data Warehouse direct source correction: guest-card freshness now follows `/Users/mark/Property_Analytics/data/portfolio_analytics.db::guest_card_metrics_dw_direct`, the Data Warehouse direct-supply table, instead of the retired CSV-drop `guest_card_metrics` lane when the DW table is populated. `/Users/mark/Property_Analytics/apps/api/scripts/guest_cards_to_d1.py`, `/Users/mark/Property_Analytics/apps/api/scripts/marketing_data_to_d1.py`, and `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` prefer the DW direct table with legacy fallback. Live verification after the correction: D1 `guest_cards` freshness is latest `2026-07-01`, `2,024` rows, `92` properties; the `2026-07-01` local DW direct slice has `539` guest cards and `170` online applications. `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs` now records completed `guest_card` collection bookkeeping and resolves same-day guest-card retry queue items. Disposition: extend Data Warehouse direct supply as the current guest-card source route; keep the CSV collector as legacy fallback only.

2026-07-01 PIB Site Evaluation factual stance approval: under explicit user approval to change the protected PIB wording lane, the property-level PIB Site Evaluation intro now reports an evidence read rather than an underperformance diagnosis. The v2.2.0 locked Outlook template and v2.3.0/v2.3.1 companion templates use `What The Data Shows`, `Observed Evidence`, and `Recommended Follow-Up Checks`; DataForSEO is a required outside-in evidence lane for keyword demand, ranked keywords, SERP/local visibility, OnPage readiness, and AI visibility where available; and the section separates observed source rows from follow-up checks when cause is not proven. The governing standard is `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`. Disposition: keep the canonical PIB family; do not reintroduce attack-stance/root-cause language unless source evidence directly proves it or the user explicitly asks for that framing.

2026-07-01 Power BI workbook intake: four fresh Power BI Excel exports from `/Users/mark/Downloads` were ingested through `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` into the canonical local DB. `Init Contact  Property  Mktg Src.xlsx` loaded `736` conversion-dashboard rows across `92` mapped properties for `2026-07-01`; `traffic-perf.xlsx` and `traffic-perf2.xlsx` loaded `554` source-performance rows across `92` mapped properties for `2026-07-01`; `Portfolio Box Score.xlsx` loaded `92` box-score rows across `92` mapped properties for `2026-07-01`; and the generic evidence archive preserved `1,512` source rows. The parser now skips source-performance hierarchy total rows that do not resolve to a property, preventing malformed Power BI total rows from entering property-scoped evidence while preserving raw generic rows. Disposition: extend the existing Marketing BI Excel ingestion path and property identity matrix mapping; do not add one-off BI spreadsheet parsers.

2026-07-01 Edge Message Toolkit production promotion for The Vine: the former pilot Edge Message proof is now promoted into a production launch lane for The Vine Kyle Parkway on `thevinekyle.com`, resolved through the governed identity matrix as `TX4EK` / community `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`. The production Worker fallback ids are `edge_message_the_vine_transparent_pricing_homepage_v1` and `edge_message_the_vine_all_in_pricing_coachmark_v1`, with disabled-by-default The Vine config and Cloudflare route config for `thevinekyle.com/*` and `www.thevinekyle.com/*` under Worker name `edge-message-worker`. The Worker deployed as version `9dc42d2b-bb7b-4232-9fbb-3e58029bfdef`, and remote D1 has active VIP-list config version `4`. The first homepage message is `Join the VIP List` with body `Receive insider updates, leasing specials, and early access opportunities.` and CTA `Get in the Know!` to `/contact/#contact`. The runtime uses a `2000ms` intro delay, `600ms` fade-in/fade-out, and `7000ms` on-screen countdown before auto-close; the CTA is centered in live browser validation, and countdown/progress use official greys Delta `#9B9B96` and Quill Gray `#D6D6D2`. CTA clicks emit `edge_message_cta_click` to `dataLayer`, direct GA4 `gtag`, and Heap direct-or-queued tracking. The admin/API control plane now separates D1 draft config saves from explicit Launch/Pause/Rollback actions, with launch forcing production frequency capping and pause/rollback writing `enabled:false` active configs. Production traffic now enters the Worker: `thevinekyle.com` and `www.thevinekyle.com` remain CNAMEs to `thevine.hosting.kinsta.cloud` but are Cloudflare proxied, and live headers confirm Kinsta O2O (`ki-edge-o2o: yes`). Disposition: extend the Edge Message Toolkit / Experiment Lab path and Worker config registry; do not create one-off WordPress snippets, standalone pop-up scripts, or a separate messaging admin.

2026-07-04 Pilot Zaraz Heap restore and delayed-load POC: `pilot.venterradev.com` had Zaraz loading but no real Heap library; `window.heap` was only an Edge Message fallback queue and no `cdn.us.heap-api.com/config/.../heap_config.js` request fired. Using the Keeper-backed `Cloudflare Zaraz Editor` record, the `venterradev.com` Zaraz config now includes a pilot-scoped custom HTML tool named `Heap Analytics - Pilot` (`HpPl`) with production Heap app id `286627304`, guarded to return unless `location.hostname === "pilot.venterradev.com"`. Existing GA4 and Ahrefs Zaraz tools were preserved. Mobile and desktop browser proof confirmed real Heap methods (`heap.track`, `heap.addEventProperties`) and requests to Heap/Contentsquare capture endpoints. After Mark confirmed Heap data arrival, the same Zaraz tool was updated to a delayed-load proof. The current live v3 arms a lightweight queue immediately but does not let queued `heap.track` calls wake the external library; Heap/Contentsquare fetch waits for first user intent, `window.load + 6000ms`, or hard `8000ms`. Browser proof confirmed passive queued calls wait for `load-plus-6000`, while interaction loads immediately. GTMetrix immediate Heap scored `90` / structure `98`, fully loaded `10.783s`, onload `1.310s`, FCP/LCP `0.679s`, TBT `87ms`; the first delayed Heap scored `92` / structure `98`, fully loaded `11.481s`, onload `0.966s`, FCP/LCP `0.515s`, TBT `80ms`. PSI v3 showed the clean exact URL can still fall to `70` with `0` Heap/Contentsquare requests, while a fresh query scored `91` with the same optimized HTML and also `0` Heap/Contentsquare requests; the remaining clean-URL low branch is first-party YOOtheme/UIkit paint timing, not Heap. Readouts: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-04/ZARAZ_HEAP_RESTORE_READOUT.md` and `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-04/HEAP_DELAY_POC_READOUT.md`. Disposition: keep v3 delayed Heap live long enough to confirm Heap pageview/session continuity; if undercounting appears, test a middle-ground fallback such as interaction plus `load + 4500ms` / hard `6000ms`, but do not use queued calls as a load trigger.

2026-07-01 Edge Messages admin production pass: `/experiments/edge-messages` now uses progressive disclosure for the Pond operator surface. Content and Preview remain visible, while Timing, Style, Targeting, and Publish controls collapse into focused cards; the header exposes `Save Draft`, `Reset`, `Force preview`, and `Open page`, and Publish carries Pause/Launch/Rollback controls behind the existing admin role gate. The scoped clean Pages deployment is `https://ca35a518.property-analytics.pages.dev`; `https://app.venterradev.com/experiments/edge-messages` remains protected by Cloudflare Access. Verification: clean static build passed, preview route returned `200`, custom route returned Access `302`, and the live API route returned protected `401 NO_SESSION`.

2026-06-29 PIB Builder saved-config and schedule control plane, corrected 2026-06-30 for canonical PIB artifacts and generation orchestration: the Pond now has a governed Builder backend for named PIB request contracts, editable scheduled-email metadata, canonical artifact delivery/display, and queued generation when a property artifact is missing. D1 tables live in `/Users/mark/Property_Analytics/apps/api/migrations/0056_create_pib_builder_schedules.sql`, `/Users/mark/Property_Analytics/infra/migrations/035_create_pib_builder_schedules.sql`, `/Users/mark/Property_Analytics/apps/api/migrations/0057_create_pib_generation_jobs.sql`, and `/Users/mark/Property_Analytics/infra/migrations/036_create_pib_generation_jobs.sql`; API ownership is `/Users/mark/Property_Analytics/apps/api/src/routes/pib-builder.ts` mounted at `/v1/pib-builder`; the UI surface is `/Users/mark/Property_Analytics/apps/web/src/app/analysis/pib/page.tsx`; the local generation worker is `/Users/mark/Property_Analytics/scripts/process_pib_builder_generation_jobs.py`; and the installed launchd agent is governed at `/Users/mark/Property_Analytics/ops/launchd/com.venterra.pib-builder-generation-worker.plist`. The Builder stores report names, scope/property, date window, governed section IDs, cadence, recipients, next/last run metadata, run history, and canonical generation jobs. Immediate/scheduled emails send the latest published canonical Outlook PIB HTML from R2 (`pib/reports/<property-slug>/`) through the existing Worker Resend adapter, and app display opens the same artifact through `/v1/pib-builder/artifacts/latest`. When no artifact exists, `Email Now` and `Open Report Now` queue a canonical generation job, show a generating state, poll completion, and then retry send/open against the generated artifact. The UI now uses progressive disclosure: property/date first, metric/report-area selection second, output choice third with no preselected action; only `Email Now` and `Open Report Now` are initial output choices, recipient entry appears only after Email Now, and save/name/schedule controls appear above the generated report preview after the report exists. The worker uses the existing Keeper/KSM-backed Wrangler helper, runs the locked approved v2.2.0 Python generator without modifying PIB templates/senders, uploads the generated HTML artifact to R2, and records the artifact key in D1; launchd runs up to `3` queued jobs every `60` seconds from Mark's desktop context. Disposition: extend this control plane and worker; do not create alternate PIB renderers/templates/senders in `apps/api` or `apps/web`.

2026-06-30 PIB Builder generated-artifact fallback: the generation worker now treats R2 as best-effort because the current Cloudflare token can read/write local Wrangler R2 but remote R2 object writes returned `403`. Generated Outlook HTML is chunked into D1 table `pib_report_generation_artifact_chunks` and the API reassembles those chunks when R2 does not contain the artifact. This keeps the Builder send/open path operational while preserving the approved PIB generator and avoiding alternate renderers/templates in the app layer. Primary paths: `/Users/mark/Property_Analytics/apps/api/migrations/0059_create_pib_generation_artifact_chunks.sql`, `/Users/mark/Property_Analytics/infra/migrations/038_create_pib_generation_artifact_chunks.sql`, `/Users/mark/Property_Analytics/apps/api/src/routes/pib-builder.ts`, and `/Users/mark/Property_Analytics/scripts/process_pib_builder_generation_jobs.py`. Disposition: keep as fallback until Keeper/Cloudflare R2 write permissions are expanded for the worker token.

2026-07-01 PIB Builder generation-progress hotfix: after Canton Mill Lofts generated canonical PIB HTML but stayed blocked in the Builder, the generated-artifact fallback query was corrected so chunked D1 artifacts are discoverable even when the deprecated single `artifact_html` field is empty. The Builder output step now displays a progress meter with queued, building, publishing, sending/opening, and complete states while on-demand canonical generation runs. API Worker version `68141e2c-2e16-48e7-914c-592cb429deb4` and Pages deployment `https://3397607c.property-analytics.pages.dev` initially carried the fix. Follow-up Pages deployment `https://5f2ae45f.property-analytics.pages.dev` merged the newer Edge Messages web state with the PIB progress fix and redirects `/pib` to `/analysis/pib`, so the legacy Build Context panel is no longer an active Builder entry point. Disposition: extend this orchestration path; do not move generation/rendering into the web/API app layer.

2026-07-01 July Spotlight roster and copy-impact pruning: the active monthly Spotlight master set now lives in `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-07.json`, with companion source/import files `July_2026_Spotlight_Properties.csv` and `monthly_import_names_2026-07.csv`. The July set is Cendana, Elation, Retreat, Canton Mill Lofts, Clearwater Heights, College View, Gateway North, Luminary, Silverbrooke, Baywood, Shadowbrooke, St Andrews, and Westover; Cendana, Elation, and Retreat carry `Critical` designation. The Pond Spotlight helper now reflects the July order and aliases. The Copy Change Impact Brief daily scope rule now follows the current Spotlight roster plus explicitly retained action exceptions, keeping old interventions in local history without carrying graduated non-Spotlight properties in the daily executive cards. Disposition: extend the governed monthly config path and copy-change monitoring source route; do not create one-off Spotlight or copy-report lists.

2026-06-25 Ad Hoc Executive Report System: the repository now has a preliminary canonical ad hoc executive report engine for Outlook-safe PIB-style specialty reports outside locked PIB families. The front door is `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`; orchestration lives in `/Users/mark/Property_Analytics/utils/adhoc_report_orchestrator.py`; the source registry and subject resolver live in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`; rendering is constrained to `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`; and Outlook safety enforcement lives in `/Users/mark/Property_Analytics/utils/outlook_email_validator.py` plus `/Users/mark/Property_Analytics/scripts/check_outlook_email_safety.py`. Each run writes a durable packet under `/Users/mark/Property_Analytics/reports/adhoc_executive/<report_type>/<run_id>/` containing request/spec/html/workbook/validation/delivery/source artifacts. Preliminary supported report types are `organic_search_share` and `ga4_traffic_summary`; future subjects should extend the source registry and shared renderer rather than add standalone report-specific HTML/email scripts. Delivery remains through `/Users/mark/Property_Analytics/utils/email_sender.py` with AWS SES by default. Disposition: extend as the CLI/operator backend first, then expose the same request/spec/render/send/archive packet in the Pond; do not create a separate Pond-only report generator.

2026-06-24 GoDaddy Domains API inventory lane, updated 2026-06-25 for live forwarding support: the repository now has a read-only GoDaddy registrar/DNS/forwarding source route extending Data Collection rather than a one-off export. Keeper/KSM auth lives in `/Users/mark/Property_Analytics/utils/godaddy_auth.py` and resolves the existing `GoDaddy API` Keeper record through the shared Python KSM helper, including the Keeper custom field `customer_id` for forwarding without printing raw credential or id values. The collector at `/Users/mark/Property_Analytics/Data_Collection/collectors/godaddy_collector.py` snapshots the portfolio with `GET /v1/domains`, per-domain `GET /v1/domains/{domain}`, per-domain DNS `GET /v1/domains/{domain}/records`, and forwarding `GET /v2/customers/{customerId}/domains/forwards/{fqdn}` after deriving the UUID-style customer id from the Keeper value through the GoDaddy Shoppers API when needed. Domain/DNS source JSON is preserved in canonical SQLite tables `godaddy_domain_snapshots` and `godaddy_dns_records`; forwarding source JSON is preserved in `godaddy_forwarding_snapshots`. The first live domain/DNS snapshot on 2026-06-24 completed as collection `2252` with `282` domains, `1,566` DNS records, `0` hard failures, `61` source-limited DNS states (`403` or `404`), and `6` governed property-identity matches. The first live forwarding snapshot on 2026-06-25 completed as collection `2282` with `282` domains, `0` failures/source-limited domains, `283` forwarding rows stored, and `149` active forwarding records (`148` `PERMANENT_REDIRECT`, `1` `TEMPORARY_REDIRECT`, plus `134` no-forwarding source states). Disposition: extend Data Collection / Data Pond for launch-domain inventory, forwarding inventory, and watch logic; require explicit approval before adding mutating registrar/DNS/forwarding operations.

2026-06-23 Keeper main-tree personal email cleanup: `/Users/mark/Property_Analytics/scripts/keeper_remove_email_records.py` provides a governed Commander-based cleanup utility for visible Keeper login/email fields matching personal domains, defaulting to `gmail.com` and `laufhutte.com`, while excluding `Marketing Ops Shared Credentials`. The tool prints sanitized candidate evidence only, requires typed `DELETE N` confirmation, and uses normal Commander remove behavior rather than permanent purge. The 2026-06-23 human-present run removed `180` matching records from the main vault tree. Commander persistent-login/device setup was attempted, but the local one-shot Commander path still triggered SSO/policy friction, so future bulk vault maintenance should be treated as human-present unless IT/Keeper admin enables Commander Service Mode or a more automation-friendly device policy. Disposition: keep this as a narrow governed cleanup utility; do not create alternate secret stores or print raw credential values.

2026-06-22 Marketing Ops shared credential migration: the existing one-time Keeper Commander utility `/Users/mark/Property_Analytics/keeper_marketing_ops_import.py` now supports the legacy multi-sheet `/Users/mark/Downloads/Venterra Marketing Log ins.xlsx` workbook through `--venterra-marketing-logins-workbook` rather than relying on the generic active-sheet parser. The mode maps known credential tabs, optionally includes URL-only reference tabs, preserves source sheet/row provenance as Keeper custom fields, and allows complete legacy archive imports with explicit `--allow-blank-passwords`. Dry-run readiness was clean with warnings only (`191` credential-style records, or `388` records including reference URLs). After local Keeper Commander SSO/device approval, the 191 credential-style records were imported into `Marketing Ops Shared Credentials` for team `Marketing Ops`; URL-only reference records were left out of the live import. KSM remains the read/runtime path and is not used to create this shared-folder import. Disposition: extend the existing governed Keeper migration utility; do not create plaintext local staging files or alternate non-Keeper credential stores.

2026-06-19 GTmetrix API Keeper-first hardening: the canonical GTmetrix API collector at `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` now resolves credentials through the shared Python Keeper/KSM helper first, using the governed MarketingOps GTmetrix notation default and honoring the legacy notation env var during migration. Direct `GTMETRIX_API_KEY` and the existing configured local key path remain only as transitional fallback routes. This keeps the existing API collector, pilot/control CWV workflow, rate-limit capture, credit guard, and DB persistence as the canonical path; GTmetrix MCP remains optional for operator/ad hoc AI-tool use rather than a replacement production source route. Disposition: extend the existing Data Collection GTmetrix API path and Keeper runtime; do not add a parallel MCP-backed collector unless a future approved workflow requires it.

2026-06-16 The Vine Kyle Parkway identity/lifecycle correction: Mark confirmed The Vine is live in a pre-lease stage and that `TX4EK` is the correct property code. The governed identity inputs now resolve The Vine as `TX4EK` / GA4 `505234023` / community `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e` / GSC `sc-domain:thevinekyle.com`, and the official registry no longer marks it `prelaunch`; it uses `lifecycle: live` with `operational_status: pre_lease` so GSC and URL Inspection reporting include the site while preserving the lease-up business context. The old Data Warehouse expected-gap exception for `TX4EK` was removed from `config/data_warehouse_property_code_resolution.json`; Sundara / `TX4CY` remains a governed pre-live gap. Follow-up confirmed The Vine's P&A page is `/apartments/`, and that path is now seeded in registry `known_page_paths` for future URL Inspection sampling; direct GSC inspection found `/apartments/` is currently unknown to Google. Disposition: extend the existing Property registry, Property identity matrix, and Data Collection GSC lanes rather than adding any one-off The Vine mapping.

2026-06-10 Venterra Clearwater UI standard: the platform now has a named premium glass design direction for Data Pond web surfaces. The governing draft is `/Users/mark/Property_Analytics/docs/VENTERRA_CLEARWATER_UI_STANDARD_2026-06-10.md`; shared opt-in implementation primitives live in `/Users/mark/Property_Analytics/apps/web/src/components/shared/clearwater-glass.tsx`, with global tokens/utilities in `/Users/mark/Property_Analytics/apps/web/src/app/globals.css` and named Venterra Tailwind colors in `/Users/mark/Property_Analytics/apps/web/tailwind.config.ts`. The first proof was applied to `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` for `/` and `/pond`, then deployed through the Keeper/KSM-backed Wrangler path from an isolated clean deploy worktree to Cloudflare Pages project `property-analytics` on branch `main`. Visual QA found the first deploy still read as opaque panels and a later correction overcompensated into neon/blue acrylic. The current tightened deployment is `https://69d8ebd1.property-analytics.pages.dev`: feature cards use smoked navy glass with moderate `blur(16px)`, lower border/highlight opacity, reduced background wash, and darker lens fill; repeated data tiles and the PIB shortcut use `clearwater-data-card` without `backdrop-filter`, so glass remains an accent instead of every surface. `https://app.venterradev.com/pond` remains Cloudflare Access-protected. Disposition: extend the existing `apps/web` design system and official Venterra brand color standard rather than creating route-specific glass styles or alternate report renderers.

2026-06-10 Watchtower Signal Deck signature experiment: `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx` now has a scoped command-deck visual treatment for the Watchtower operator lane, backed by Watchtower-specific utilities in `/Users/mark/Property_Analytics/apps/web/src/app/globals.css` (`watchtower-stage`, `watchtower-signal-shell`, `watchtower-panel`, `watchtower-rail-card`, `watchtower-horizon`, and `watchtower-signal-node`). The design uses official Venterra colors as signal light inside a darker smoked navy instrumentation surface, with thin bevel borders, subtle grid structure, and reduced-motion-safe sweep animation. It was locally rendered against sanitized mock health/landscape payloads, then deployed through the Keeper/KSM-backed Wrangler path from an isolated clean deploy worktree. Preview URL: `https://0bbe7ad5.property-analytics.pages.dev/watchtower`; `https://app.venterradev.com/watchtower` remains Cloudflare Access-protected. Disposition: continue extending the existing Watchtower surface and `apps/web` visual system; do not create a separate Watchtower app, design fork, or report renderer.

2026-06-10 Data Warehouse wrapper preflight correction: `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh` no longer treats the generic shell Keeper profile gate as the authoritative preflight for the warehouse lane. The wrapper now initializes its governed daily log first, runs `node scripts/check_data_warehouse_keeper_ready.mjs`, then runs the dedicated warehouse connectivity probe `/Users/mark/Property_Analytics/scripts/check_data_warehouse_connectivity.mjs` inside a bounded wait loop (`DW_WAIT_UNTIL_REACHABLE=1`, `DW_MAX_WAIT_SECONDS=14400`, `DW_POLL_SECONDS=300` by default). This means recurring automation validates the real notation-based credential path, classifies DNS/TCP failures as sanitized VPN/network availability issues, and waits for warehouse reachability instead of failing the whole day on the first transient miss. Verified live on 2026-06-10: Keeper/KSM readiness passed, warehouse DNS was still unavailable, and the wrapper now stopped at preflight with sanitized `ENOTFOUND` context rather than a false Keeper bootstrap failure or a harvest-step crash.

2026-06-12 Data Warehouse wrapper log durability correction: the same governed wrapper now also resolves a writable log directory before opening its daily stream, with priority order `~/Library/Logs/Venterra`, repo-local `/Users/mark/Property_Analytics/logs/automation`, then `/tmp/property_analytics_logs`. It also writes a PID file in the lock directory and separates three states that were previously conflated: live concurrent run, stale lock below threshold, and stale lock recovery. This removes the false-negative mode where a log-write failure or ambiguous lock creation could surface only as `Another run is already in progress`. Live verification on 2026-06-12 from the previously failing context completed the full seven-step governed workflow and produced fresh packets under `/Users/mark/Property_Analytics/outputs/data_warehouse/` and `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/` while preserving Keeper/KSM-only credential resolution and shadow-only guest-card supply posture.

2026-06-03 GBP Keeper addendum: the shared MarketingOps Keeper runtime helpers at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` and `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs` now export the already-documented GBP Keeper file UIDs (`KSM_GBP_CLIENT_SECRET_UID`, `KSM_GBP_TOKEN_UID`) in addition to the Data Warehouse, GA4, GSC, Cloudflare, BrowserStack, OpenAI, PageSpeed, GTMetrix, SEMRush, DataForSEO, ApartmentIQ, and Google Ads defaults. This aligns ad hoc shell/Node execution with the GBP Keeper posture previously wired into launchd on 2026-05-07. A targeted June Spotlight reputation refresh verified the path by pulling fresh Google reviews for The Maddox, The Retreat, Gateway North, and Canton Mill Lofts through the governed GBP collector with credential source class `Keeper/KSM`.

2026-06-04 Keeper shell-bootstrap hardening: the shared MarketingOps Keeper runtime helpers were tightened so recurring shell automations no longer trust ambient launch context for `HOME` / `USER` / `LOGNAME`. The shell helper now forces the stable local MarketingOps identity (`/Users/mark`, `mark`) before calling `ksm`, exposes `KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION`, and provides an explicit `pa_require_marketingops_keeper_ready` gate that the shared shell-wrapper cohort now calls before Python workflows start. The Node helper was aligned to the same stable runtime envelope. This closed a real failure mode where a bad inherited `HOME` caused ApartmentIQ Keeper lookups to fail with `The Keeper SDK client has not been loaded. The INI config might not be set.` ApartmentIQ default notation drift was also removed by aligning `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py` to the documented `ApartmentIQ API` Keeper record. Verification on 2026-06-04 included a forced bad-`HOME` repro that now resolves ApartmentIQ credentials, `node scripts/check_data_warehouse_keeper_ready.mjs` returning `OK`, and a live `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh` smoke that completed successfully and generated fresh 2026-06-04 ApartmentIQ summary artifacts.

2026-06-05 Python Keeper consolidation: the remaining repo-level credential fragility was that several functioning Python entrypoints still called `ksm` directly and therefore depended on shell-exported notation env vars or prior profile initialization even after the shared shell/Node bootstrap hardening. `/Users/mark/Property_Analytics/utils/ksm.py` now owns the governed Python Keeper runtime envelope and repair sequence: it forces stable MarketingOps identity/path, probes `marketingops`, retries `ksm profile active`, then falls back to `ksm profile init -p marketingops` using the existing bootstrap token files when needed before reading notation values. The Cloudflare and BrowserStack auth modules now resolve through that shared helper instead of bespoke subprocess code, and both have canonical default Keeper notations so stripped Python processes can still resolve credentials without wrapper-provided env exports. Shell helper `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` was also tightened so `PA_KEEPER_RUNTIME_READY` is set only after a real Keeper probe. Verification on 2026-06-05 passed from a deliberately bad/empty shell for ApartmentIQ, Cloudflare, BrowserStack, and DataForSEO credential reads, plus `node scripts/check_data_warehouse_keeper_ready.mjs`, `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh`, and `APARTMENTIQ_WEEKLY_MAX_COMP_SETS=1 ./run_apartmentiq_weekly_dive.sh`.

2026-06-01 June Spotlight update: the current monthly Spotlight set was refreshed from Mark's June workbook at `/Users/mark/Downloads/June Properties.xlsx`. Correction after workbook tab review: the authoritative June roster is the property-tab roster, not the shorter funnel-summary selection rows. The governed June files are `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/June_2026_Spotlight_Properties.csv`, `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_import_names_2026-06.csv`, and `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-06.json`. The active June set is Canton Mill Lofts, College View, Elation, Forest View, Gateway North, Grand Harbor, Lakeland, Luminary, Maddox, Retreat, and Town Station; College View, Forest View, and Gateway North carry `Critical` designation while the other eight remain `Spotlight`. The Spotlight Performance Roundup now loads the latest monthly Spotlight config instead of a hardcoded Spotlight 11 list, and the web helper at `/Users/mark/Property_Analytics/apps/web/src/lib/spotlight-properties.ts` reflects the corrected June tab order. `scripts/standup_captain_roster.py` stamps activation artifacts dynamically; the prior June Captain roster was remotely applied through the Keeper/KSM-backed Wrangler path for the shorter `8` property extraction / `88` support-agent rows and should be rerun from the corrected 11-property config before treating Captain roster scope as current.

2026-05-28 Resi pilot performance update: the existing Edge Experimentation / Edge Message Worker at `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` has a disabled performance layer for `pilot.venterradev.com` exact paths `/` and `/apartments/`. It targeted homepage LCP discovery by preloading the DAM hero and rewriting the UIkit `data-src` hero background into initial HTML, and it added DAM image priority/lazy hints on `/apartments/`. The diagnosis artifact is `/Users/mark/Property_Analytics/resi_archetype_site/docs/PERFORMANCE_FIRST_DIAGNOSIS_2026-05-28.md`; the first live deploy used the Keeper/KSM-backed Wrangler path and produced Worker version `4a7fa0ee-ab6a-407c-8427-694cf693f93e`, then was disabled after a live GTMetrix regression signal with rollback version `9fe6606e-c40e-4318-ada3-e2634c910cb9`. The Worker was paused into pass-through mode for edge messages, coach marks, and performance rewrites as version `caba5935-ec78-4e2f-bdee-23a099106cb4`; a header-only hero preload test version `45b31461-f2b0-4059-9e1d-bac24dc1666b` worsened 3-run PSI medians on homepage mobile and LCP, so it was rolled back to pass-through as version `542b75ca-3977-4130-a04a-6d731f70d255`. A Zaraz-only Cloudflare Configuration Rule test disabled Zaraz on the pilot host while leaving Cloudflare Web Analytics enabled; three-run PSI medians worsened on mobile, so the temporary rule was removed and Zaraz injection was verified restored. A Cloudflare Web Analytics / RUM-only Configuration Rule test removed `static.cloudflareinsights.com/beacon.min.js` while leaving Zaraz, GA4/Ahrefs, and Resi pixel enabled; it reduced requests and bytes but was mixed in PSI, improving apartments mobile while worsening homepage and apartments desktop, so the temporary rule was removed and RUM was verified restored. An IE11-only Worker test removed `/wp-content/plugins/resi-elements/assets/ie-11.js` from `/` and `/apartments/`; it removed one request and modestly improved apartments mobile while worsening apartments desktop, so it was rolled back and the rewrite is now disabled. The first kept performance win is SightMap lazy-loading on `/apartments/`: Worker version `17944c96-a290-4853-962a-61762dd455e0` delays the SightMap iframe and API until map interaction/viewport approach, passed functional smoke, and improved apartments mobile PSI `57 -> 74` and desktop PSI `75 -> 99`. A homepage hero inline-background test version `dade5885-9bbd-44f6-b067-d719be001c9f` removed UIkit `data-src` / `uk-img` without preload but worsened homepage mobile LCP `3826ms -> 6592ms`; Worker version `63ebf1cd-80b6-4525-940d-e9bdaf2d063c` rolled back the hero rewrite while keeping SightMap lazy-load live. A jQuery Migrate removal test version `02fa421f-1759-465b-9c0b-6961ccbd768e` removed only `/wp-includes/js/jquery/jquery-migrate.min.js` from `/` and `/apartments/`; Playwright smoke passed, but PSI was mixed and apartments desktop regressed versus SightMap-only (`99 -> 65`, TBT `60ms -> 1428ms`), so Worker version `ff0eee24-3bb5-4f4d-8210-16b3e40bdbec` restored jQuery Migrate while keeping SightMap lazy-load live. A 2026-05-29 script-cost profile showed YOOtheme/UIkit as the largest actionable script CPU bucket; broad and scoped Resi pixel idle-load tests (`e65ae339-9018-464b-94f6-6ab589928a59`, then `60e88ee1-e8fc-4d67-a2d8-b424992b0b5c`) were functionally safe but not clean PSI wins, so Worker version `1f0f3a89-15c4-4037-b8ed-34e2a192a5fc` restored the direct pixel script while keeping SightMap lazy-load live. Clean PSI baseline, preload comparison, Zaraz comparison, RUM comparison, IE11 comparison, SightMap comparison, hero inline-background comparison, jQuery Migrate comparison, script-cost profile, and Resi pixel idle-load comparison artifacts live under `/Users/mark/Property_Analytics/reports/resi_edge_performance/`.

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
| Canonical PIB property reporting | Reporting | Canonical | PIB | `/Users/mark/Property_Analytics/Property_Intelligence_Brief/`, `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`, `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`, `/Users/mark/Property_Analytics/config/pib_section_catalog.json` | Canonical DB, PIB pipeline inputs, DataForSEO context, BI spend/source/box-score rows, GSC query mix, availability, PageSpeed, review sentiment, governed ApartmentIQ advisory enrichment rows, and future stable section-id selections | PIB HTML, property views, email outputs, an approved locked versioned v2.2.1 Pond testing path with SightMap Signals, action-card portfolio averages, factual Site Evaluation stance, and corrected zero-review-window display; v2.2.0 remains historical/available; v2.3.0/v2.3.1 remain ApartmentIQ advisory companion paths while ApartmentIQ is paused pending license approval; PIB now has a seed section catalog for a future self-serve builder with selectable sections/presets over the canonical PIB family | PIB-style specialty outputs, legacy PIB variants, separate site-evaluation drafts, any future app-side alternate PIB renderer | Keep canonical PIB; do not create parallel evaluation renderers; future builder should use canonical PIB section ids/presets |
| PIB-family report shell and delivery discipline | Reporting / Delivery | Canonical Discipline | PIB + Report Family Owners | `/Users/mark/Property_Analytics/utils/pib_email_shell.py`, `/Users/mark/Property_Analytics/utils/email_sender.py`, locked PIB senders only when the task is canonical PIB, and each report family's documented sender/orchestrator | Rendered report HTML, companion attachments, configured recipients, delivery logs | PIB-style email outputs delivered through the established family path with shared shell/chrome, duplicate-send/logging policy where available, and attachments handled by extending the family sender rather than creating one-off wrappers | Ad hoc direct `EmailSender` calls, standalone send scripts, custom one-off SMTP wrappers | Extend the owning report-family sender first; direct utility use only inside a canonical sender/orchestrator or with explicit operator approval |
| Search Intelligence report builder | Reporting / Search | Active | Data Pond + apps/api | `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/page.tsx` plus `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts` and specialty search-report scripts under `/Users/mark/Property_Analytics/scripts/` | Communities, local search/ad warehouse tables, live SEMrush keyword pulls, competitor mappings, canonical GSC daily metrics, canonical GA4 organic traffic facts, targeted selected-property GSC backfill support, Keeper-backed Worker `SEMRUSH_API_KEY` | Single-property PIB-style keyword intelligence preview, selected-property PIB-style SEO proof briefs for rolling or explicit date windows, PIB-style daily copy-change impact briefs, HTML/Markdown/JSON/CSV artifacts, optional email delivery, and narrow canonical GSC historical repair for selected windows | Ad hoc search deep dives, local script-only keyword briefs | Extend |
| PIB web surfaces | Reporting / App | Canonical | Data Pond + PIB | `/Users/mark/Property_Analytics/apps/web/src/app/pib/` | API / canonical PIB data | Browser PIB views | Older script-only PIB consumption | Extend |
| Daily health reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py` | Canonical DB | Legacy health report artifact family; canonical scheduled summary delivery now routes through Morning Full instead of a separate overlapping email | Morning full report and some Pulse overlap | Consolidate Into Morning full report |
| Morning full report | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_morning_full_report.py`, `/Users/mark/Property_Analytics/send_morning_full_report.py`, `/Users/mark/Property_Analytics/run_daily_health_report.sh`, `/Users/mark/Property_Analytics/scripts/verify_morning_delivery.py` | Canonical DB, pilot/ops inputs, delivery logs, closure state | Canonical daily summary email/report with duplicate-send protection, closure-aware hold behavior, legacy daily-health routing consolidation, explicit execution-status artifacts so intentional send holds no longer trip the acceptance/failure path, and a distinct `advisory` closure posture when core sources are closed but manual/diagnostic tail work remains | Daily health and weekly progress family | Keep |
| Weekly progress reporting | Reporting | Active | Root reporting scripts | `/Users/mark/Property_Analytics/generate_weekly_progress_report.py` | Canonical DB | Weekly leadership-style output | Spotlight and Focus adjacent audience overlap | Keep |
| CWV snapshot reporting | Reporting / Performance | Specialized | Root reporting scripts | `/Users/mark/Property_Analytics/generate_cwv_snapshot.py` plus `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py` plus `/Users/mark/Property_Analytics/scripts/send_lease_up_vs_pilot_performance_brief.py` | PSI / performance metrics | Portfolio CWV rankings and email, selected-property mobile PSI / CWV T30 briefs with Excel attachment delivery, and a PIB-style lease-up-vs-pilot comparison brief with Excel raw-data companion, shorthand-to-canonical property mapping, explicit stale-date exceptions when a property's latest PSI lags the portfolio report date, and operator notes in `/Users/mark/Property_Analytics/reports/selected_cwv_t30/README.md` and `/Users/mark/Property_Analytics/reports/property_evaluation/lease_up_vs_pilot_pib/README.md` | Pilot CWV program | Keep |
| GSC snapshot reporting | Reporting / Search | Specialized | Reporting scripts | `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py` | Canonical GSC data | Portfolio GSC snapshot output | Spotlight GSC reporting | Keep |
| Executive / leadership / prelaunch assessments | Reporting / Specialty | Specialized | Root assessment scripts | `/Users/mark/Property_Analytics/generate_executive_assessment.py` | Canonical DB, selected analyses | Stakeholder summaries and assessments | Ad hoc PIB-style outputs | Keep |
| Spotlight PageSpeed Insights performance roundup | Reporting / Performance | Active | Pilot roundup + Spotlight | `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_spotlight_performance_roundup.py`, `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py`, `/Users/mark/Property_Analytics/run_spotlight_performance_roundup_daily.sh`, `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.performance.roundup.daily.plist` | Canonical DB PSI/New Users data, BrowserStack context, governed property identity matrix, Spotlight 11 property codes | Daily 7:00 AM local email for the current Spotlight 11 with PageSpeed Insights as the dominant score/trend, GTMetrix intentionally omitted, status chips removed, duplicate-send guard under `logs/email_delivery/spotlight_performance_roundup`, and delivery to Mark Laufhutte, Eric Longoria, Jared Dominguez, and David Crandall; Codex automation `daily-spotlight-pagespeed-insights-performance` is a watchdog rather than a second primary sender | Legacy pilot-performance framing for Spotlight 11, GTMetrix-led report view | Extend |
| Spotlight weekly reporting program | Reporting | Active | Spotlight | `/Users/mark/Property_Analytics/Spotlight_Properties_Report/generate_weekly_spotlight_report_from_db.py` | Canonical DB, monthly spotlight config | Weekly spotlight CSV and executive emails | Focus Report, older Spotlight generators | Extend |
| Spotlight archive of collectors and reports | Reporting / Historical | Legacy-Reusable | Spotlight | `/Users/mark/Property_Analytics/Spotlight_Properties_Report/Archive/` | Historical project inputs | Reusable patterns and reference logic | Newer canonical collection/report paths | Reference Only |
| Focus Report | Reporting / Executive | Specialized | Focus Report | `/Users/mark/Property_Analytics/focus_report/` | Canonical DB, curated focus list | Weekly focus dashboard email | Spotlight, Portfolio Pulse | Keep |
| Paid media workbook | Marketing / Paid Media | Specialized | Paid Media Workbook | `/Users/mark/Property_Analytics/paid_media_workbook/scripts/generate_paid_media_workbook.py` | Google Ads data, inventory context | Excel workbook for managers | Marketing app/API surfaces, dashboard ad scripts | Keep |
| Google Ads collection | Truth / Collection | Active | Legacy dashboard collector + canonical orchestration | `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_google_ads_data.py`, `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/analyze_google_ads_campaigns.py`, `/Users/mark/Property_Analytics/config/google_ads_campaign_property_mapping.json`, `/Users/mark/Property_Analytics/scripts/audit_google_ads_integrity.py` | Google Ads API through Keeper-materialized config, governed property identity matrix, campaign/ad-group/ad text, final URLs, tracking templates, property codes, company ids, aliases | Campaign and keyword facts with property-subset retry support from canonical orchestration; campaign/property mapping now refreshes through Keeper-backed live API analysis when stale or legacy, using multi-signal identity scoring instead of stale name-only campaign ids. 2026-06-03 proof mapped `202` active campaigns across `86` properties with `0` unmatched active campaigns and restored June local/brand campaign rows for Canton Mill Lofts and The Maddox. The new integrity audit persists local read models `google_ads_campaign_property_attribution` and `google_ads_conversion_health`, with Markdown/CSV/JSON evidence. Full June 3 proof collected `171` campaign rows across `86` properties and found `0` attribution gaps but broad active-spend zero-conversion risk, so remaining zero-conversion reads should be treated as conversion-tracking/attribution concerns, not absent ad activity. | Older paid media scripts and workbook consumers | Extend |
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
| Copy Change Monitoring | Site Governance / SEO / Content Measurement | Active | Data Pond + Site Content Creator + Copy Change Impact Brief | `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md`, `/Users/mark/Property_Analytics/docs/COPY_CHANGE_RECOVERY_LANE_2026-06-10.md`, `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`, `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py`, `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`, local SQLite tables `copy_change_waves`, `copy_change_interventions`, `copy_change_observations` | Governed property identity, permanent CMS/site copy changes, GSC aggregate metrics, GA4 Organic Search, GSC query rows, unit availability/specials, Google Ads data freshness, DataForSEO on-page evidence, future PSI/EVS evidence, Site Content section rewrites, Website Change Watch baselines/diffs, Captain consultation and handoff notes, Copy Change Recovery Lane execution packets | Wave-aware local intervention registry, seeded April 17 copy-change cohort, scalable property addition without code edits, local observation storage for aggregate GSC/GA4 and query-cohort evidence, report JSON generated locally while the email remains an executive quick read without mandatory raw-data attachments, v1.3 decision metadata for action/confidence/driver/recommendation/watch flags, required pre-change Captain consultation because the Captain should know the property best, required Captain/Navigator/Logkeeper handoff when a property is added to an active wave or tracked fields materially change, and the named Copy Change Recovery Lane for Act Now/worst-performer rank-focused rewrite, WordPress paste-board delivery, live verification, Pond registration, and test email proof | Hardcoded report property lists, ad hoc spreadsheet tracking, unregistered CMS edits, standalone SEO test tools, attaching raw evidence to executive email by default, unconsulted Captain before public copy changes, unalerted Captain memory drift after public copy changes, unregistered recovery copy rewrites | Extend Website Change Watch + Site Content Creator + Captain/Watchtower rather than creating a parallel report family |
| Content Office | Content Operations / Distribution | Active Planning | Content Office + GBP Posts through Data Pond | `/Users/mark/Property_Analytics/apps/web/src/app/content-office/page.tsx`, `/Users/mark/Property_Analytics/apps/web/src/app/gbp-posts/page.tsx`, `/Users/mark/Property_Analytics/apps/api/src/routes/gbp-posts.ts`, `/Users/mark/Property_Analytics/apps/api/migrations/0019_create_gbp_post_workflow.sql` | Captain Brief/runtime context, Data Pond facts, Site Content/Specs context, GBP workflow queue, live feed inputs, future channel policies | Governed channel operations workspace that treats GBP Posts as the first active lane and frames social drafts, email snippets, short video briefs, and community listening as draft/handoff lanes until integrations are proven; GBP Posts now stores active Captain runtime context in source snapshots, derives recommended local-post angles from watch/action pressure, can generate a `captain_directive` draft candidate before falling back to offer, availability, amenity, reputation, or performance angles, records manual posting proof/failure in the existing publication ledger, and exposes Suggested GBP Posts from Captain/Data Pond signals with one-click Draft Builder preparation; preserves the existing GBP source snapshot -> draft -> policy -> approval -> publication proof workflow rather than creating a parallel posting system | Ad hoc social posting ideas, disconnected content calendars, manual copy handoff outside source evidence | Extend GBP Posts first, then add channel lanes through the same approval/proof spine |
| Property Narrative Canon | Content Operations / Narrative Governance | Planning | VACS + Site Content Creator + Content Office | `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md` | Data Pond facts, DataForSEO search/environment evidence, future governed Ahrefs authority/content-gap evidence, Captain's Log and Brief, Intelligence Office directives, governed memory, Specs/site-section evidence, Website Change Watch baselines, GBP/social/email channel context | Durable property narrative source artifact covering positioning thesis, audience/intent map, proof point ledger, search/entity/AI visibility map, message hierarchy, live-site harmonization audit, content stream plan, and derivative artifact queue. Future site rewrites, VACS long-form drafts, GBP/social/email packages, FAQ/schema recommendations, Captain/Navigator content actions, and outlet publishing packages should cite and derive from the canon instead of inventing separate angles. | Venterra AI Content Suite plans, generic SEO audits, one-off blog prompts, disconnected channel drafts | Extend VACS/Site Content/Content Office; prove one property first before broad publishing automation |
| VACS content generation system | Content Operations | Planning | VACS | `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts` plus `/Users/mark/Property_Analytics/apps/web/src/app/vacs/page.tsx` | Property context, guidance, support signals, governed memory | Governed content artifacts with memory kept distinct from truth and directives, fail-closed service auth now aligned to Access service-token machine identity without VACS shared-token fallback, contract-tested payload separation, structured claims/evidence context, and a governed Pond bridge surface that exposes VACS posture, contract, shared foundations, and next moves without collapsing the API-first model into a fake full human workspace; standalone `vacs.venterradev.com` remains an architectural target | Venterra AI Content Suite plans | Extend |
| Content operations architecture and contracts | Governance / Planning | Planning | Docs + platform plans | `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md` | Architectural planning | Shared model and implementation direction | Venterra AI Content Suite | Keep |
| Specs integration model | Governance / Structural | Planning | External Specs + local docs | `/Users/mark/VenterraDev/Specs` | Governed page specs | Structural contracts, section maps, page/content/HTML standards, Captain Specs Memory inputs, and Navigator Dossier expectations for exact web/content recommendations | Site audit heuristics, DataForSEO OnPage checks, Site Content Creator | Extend |
| Generic site audit framework | Site Governance / Analysis | Specialized | scripts/site_audit | `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py` | Live page crawls | Site audit HTML/XLSX and checks | Site Content Creator, pilot harmonization | Consolidate Into Site Content Creator + Specs-aware work |
| Pilot site harmonization evidence | Site Governance / Pilot | Specialized | Pilot documentation + outputs | `/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md` | Live pilot pages and inspections | Harmonization evidence and gap framing | Generic site audit framework | Extend |
| Pilot vs control CWV program | Pilot Monitoring | Specialized | pilot_control_cwv | `/Users/mark/Property_Analytics/pilot_control_cwv/` plus `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh` and `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_master_stability_report.py` | PSI, GTMetrix, BI exports, guest cards, live Pilot Master HTML/edge-marker checks, Zaraz/Heap state | Daily pilot/control matrix, diagnostics, exports, email, stage-aware morning failure alerts, launchd-safe homepage-evidence execution with explicit Node path handling, per-property retry/backoff for transient homepage probe disconnects, a stage-level homepage-evidence remediation loop in the morning wrapper, duplicate-alert suppression for intentional stage exits so one pilot incident produces one truthful alert, a dedicated same-day twin GTMetrix collection/validation pass before exports, tracked GTMetrix history for the bottom main pilot reference row via a synthetic property id, and the default pilot roundup now including sister/control cohort, same-region twin-property tables, a twin KPI row, a separate bottom archetype reference block for `https://pilot.venterradev.com/`, and a single consolidated routine roundup email carrying roundup-aligned PSI + GT CSV exports with `pilot` / `sister` / `twin` / `main_pilot_reference` cohort labels instead of a separate daily export email. The stale `com.venterra.pilot.data_exports.daily` LaunchAgent was unloaded and archived on 2026-07-17 so the retired separate export email is no longer scheduled. The Pilot Master now also has an active daily stability brief automation, `daily-pilot-master-speed-stability-brief`, which emails clean-vs-fresh PSI medians/ranges, rolling history, latest GTMetrix evidence, live rewrite markers, Zaraz/Heap mode, change notes, and recommended next moves from artifacts under `pilot_control_cwv/reports/pilot_master_stability/`. | Portfolio-wide CWV snapshot | Extend |
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
| EVS experiential validation service | Validation / QA | Specialized | EVS + apps/api | `/Users/mark/Property_Analytics/evs/` plus `/Users/mark/Property_Analytics/apps/web/src/app/evs/page.tsx` and `/Users/mark/Property_Analytics/apps/web/src/app/evs/employee-photo-audit/page.tsx` | BrowserStack, pilot property profiles, API requests, governed property identity matrix | Staging-first validation requests and results; governed Pond workspace now supports request creation, lifecycle visibility, mixed human request + machine ingest posture, explicit external-orchestrator handoff, and a saved ad-hoc legacy employee-photo audit surface for `#meet-the-team` photo integrity | Ad hoc screenshot-based testing | Extend |
| BrowserStack orchestration and ops | Validation / QA | Specialized | EVS + ops/browserstack + Captain Engineer/Experience Watch | `/Users/mark/Property_Analytics/ops/browserstack/`, `/Users/mark/Property_Analytics/run_legacy_employee_photo_audit.sh`, `/Users/mark/Property_Analytics/evs/orchestration/run-legacy-employee-photo-audit.mjs` | BrowserStack credentials, profile definitions, Captain property context, Specs expectations, post-change validation needs, legacy property URLs from the governed identity matrix | Validation execution support; Captain Engineer/Experience Watch proof for mobile/desktop rendering, forms, CTAs, specials visibility, screenshots, post-change validation, and employee-photo silhouette/default-placeholder detection on legacy property team sections; should be surfaced to the Captain as current/stale/blocked lane status | Standalone screenshots and manual checks | Extend |
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

- `Copy Change Monitoring`
  - 2026-06-10 Recovery Lane update: the recurring Act Now / worst-performer rewrite workflow is now titled `Copy Change Recovery Lane` and documented at `/Users/mark/Property_Analytics/docs/COPY_CHANGE_RECOVERY_LANE_2026-06-10.md`; it requires Captain/DataForSEO/Data Pond research, WordPress-ready SEO/Hero/Romance paste targets, live verification, Data Pond registration, Captain handoff, and a filtered test Copy Change Impact Brief email.
  - 2026-06-09 reliability update: `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` now sends the approved v1.3 brief from latest readable canonical data when a background collector holds the SQLite write lock, and marks generated JSON with `write_limited` / `write_warnings` when optional copy-change registry or observation writes are skipped.
  - 2026-05-30 decision-read update: `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` now uses approved Copy Change Impact Brief template `v1.3`, adding Act Now / Promising / Watch / Too Early decision cards and per-property action, confidence, driver, recommendation, and watch-flag metadata while preserving the compact v1.2 KPI strip.
  - The v1.3 decision layer uses canonical/local evidence only: GSC/GA4, GSC query cohorts, unit availability/specials, Google Ads freshness, and DataForSEO on-page checks where available.
  - 2026-05-30 presentation update: `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` now uses approved Copy Change Impact Brief template `v1.2`, keeping detailed JSON/observation evidence while compressing the executive email into at-a-glance property pulse rows.
  - Property detail rows show status, post-change start/source depth, change summary, and a smaller compact metrics strip for Since Change, T7, T14, and T30.
  - The status pill sits below the change note and above the compact metrics strip; GSC/GA4 values stack on separate lines without pipes.
  - The visible email dedupes to one card per property, preferring the latest active intervention while preserving older interventions in local history.
  - Requested property filters resolve through the governed property identity matrix, so shorthand/alias labels match registered interventions.
  - Immature milestone periods no longer display partial counts or not-yet-live T-window numbers; milestone labels only appear when the shared post-change history is sufficient.

- `Resi Archetype local source project`
  - disposition: local diagnostic source snapshot / development workbench
  - owner: Resi platform diagnostics + Cloudflare pilot workstream
  - implementation:
    - `/Users/mark/Property_Analytics/resi_archetype_site`
  - current posture:
    - SFTP credentials resolve through Keeper record `Resi Archetype`
    - local nested git repo is seeded from the remote WordPress `wp-content` code that is directly relevant to Resi unit/floor-plan/filter/application diagnosis
    - live `wp-config.php`, uploads, backups, SQL exports, and database material are intentionally excluded
    - YOOtheme/YOO Essentials are treated as dependencies rather than fully vendored evidence until a specific reproduction requires them
    - a hard-coded GitHub updater token found in the downloaded companion plugin was redacted locally; live/source-side rotation into Keeper is required
  - boundary:
    - this is not a replacement for existing EVS, Cloudflare Edge Messages, or Resi performance diagnostic lanes; it is the local source workbench for investigating the vendor platform beneath those lanes

- `Legacy employee photo audit`
  - disposition: saved ad-hoc EVS / BrowserStack report lane
  - owner: EVS + BrowserStack orchestration + Site QA
  - implementation:
    - `/Users/mark/Property_Analytics/run_legacy_employee_photo_audit.sh`
    - `/Users/mark/Property_Analytics/evs/orchestration/run-legacy-employee-photo-audit.mjs`
    - `/Users/mark/Property_Analytics/evs/providers/browserstack/run-experiential-playwright.mjs`
    - `/Users/mark/Property_Analytics/apps/web/src/app/evs/employee-photo-audit/page.tsx`
    - `/Users/mark/Property_Analytics/apps/web/src/app/dock/page.tsx`
  - current posture:
    - reads active legacy property URLs from the governed property identity matrix and appends `#meet-the-team`
    - defaults to `venterraliving.com`, with an explicit `EVS_LEGACY_HOST_FILTER=all` path if non-Venterra legacy hosts should be included
    - target scopes are template-aware: legacy sites use `#meet-the-team`, Pilot Resi live sites use the homepage `Live Easy Perks > Meet Your Experience Leaders` switcher, and standalone Resi/contact sites use `/contact/` when that section exists
    - writes reusable audit artifacts under `/Users/mark/Property_Analytics/evs/reports/legacy-employee-photo-audit-*/`
    - primary executive review artifact is `employee-photo-missing.csv`, with property, employee name, role, issue type, image URL, and evidence text
    - BrowserStack credentials remain Keeper/KSM-backed through the wrapper

- `Data Warehouse direct replacement lane`
  - disposition: active governed daily workflow restored
  - owner: Data Pond / governed warehouse replacement track
  - implementation:
    - `/Users/mark/Property_Analytics/scripts/run_data_warehouse_daily_harvest.mjs`
    - `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`
    - `/Users/mark/Property_Analytics/scripts/supply_property_operating_metrics_from_data_warehouse.mjs`
    - `/Users/mark/Property_Analytics/scripts/supply_property_metadata_from_data_warehouse.mjs`
    - `/Users/mark/Property_Analytics/scripts/audit_manual_source_replacements.mjs`
    - `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_replacement_review.mjs`
    - `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_captain_advisory.mjs`
    - `/Users/mark/Property_Analytics/config/data_warehouse_property_code_resolution.json`
    - `/Users/mark/Property_Analytics/config/manual_source_replacement_manifest.json`
  - current posture:
    - the workflow had drifted out of the checkout and was restored on `2026-05-28` so the existing automation contract resolves again
    - Keeper/KSM remains the only credential path
    - recurring local execution now uses shared Keeper runtime bootstrap helpers at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` and `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs`, so the governed Node entrypoints no longer depend on an ambient interactive shell to make the `marketingops` Keeper profile usable
    - as of `2026-06-16`, the Data Warehouse lane is intentionally separate from the broader daily gather and is human-present because warehouse reachability depends on Mark's logged-in AWS VPN Client SSO session
    - the prior unattended Codex cron `data-warehouse-daily-shadow-harvest` is paused, and the active daily heartbeat `data-warehouse-harvest-check-in` asks Mark to confirm desktop presence and AWS VPN SSO readiness before the connect-run-disconnect wrapper sequence runs
    - guest-card supply remains shadow-only unless an operator explicitly requests canonical apply mode
    - operating metrics continue to allow governed exclusions for unresolved warehouse property codes instead of inventing downstream mappings
    - metadata supply remains exact-match and may apply non-destructive matrix annotations only when explicitly requested
    - captain outputs remain advisory and degrade trust when identity validation fails or when broad material data-quality failures appear
    - narrow warehouse outliers can remain visible as advisory quality notes without collapsing packet trust when the anomaly is isolated and empirically low-volume
  - verification:
    - full seven-step governed run succeeded on `2026-05-28`
    - after central runtime hardening, the same governed run also succeeded from a previously failing fresh shell context on `2026-06-03`
    - after AWS VPN SSO proof, the full governed run succeeded on `2026-06-16` with post-run VPN disconnect verified by sanitized warehouse DNS failure
    - latest artifact roots:
      - `/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/2026-06-16_20260616_123534/`
      - `/Users/mark/Property_Analytics/outputs/data_warehouse/replacement_reviews/20260616_123544/`
      - `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/2026-06-16_20260616_123544/`

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

- `Venterra WebOps Resources Hub`
  - disposition: active protected static resource hub
  - owner: WebOps / MarketingOps
  - live URLs:
    - `https://resources.venterradev.com/`
    - `https://resources.venterradev.com/cloudflare-routing-architecture/`
  - implementation:
    - `/Users/mark/Property_Analytics/output/venterradev-resources`
  - security boundary:
    - Cloudflare Access application `Venterra Resources`
    - protected route `resources.venterradev.com/*`
    - current identity provider: Cloudflare One email OTP
    - allowed email domains: `venterraliving.com`, `venterra.com`
  - future target:
    - convert the Access policy to Microsoft Entra SSO after Entra is added as a Cloudflare Access identity provider

- `Resi Portfolio Edge - Analytics-On Performance Topper`
  - disposition: active gated preview proof
  - owner: WebOps
  - live route: `https://championsgreen-ga.com/?edge_preview=1`
  - current Worker version: `c62969ca-6f6e-4e1e-88b8-ae897c2c32cd`
  - template/schema: `2026-07-16.performance-topper-measured-preview-v10-analytics`
  - implementation:
    - `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/worker.js`
    - `/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/resi-edge-runtime.draft.js`
  - current capability:
    - high-score measured topper first view using optimized R2 assets
    - exact-native evidence remains the visual calibration lane
    - governed head metadata, favicon links, preview noindex, and JSON-LD
    - duplicate-protected topper event recorder
    - `dataLayer`, `__vtrEdgeQueue`, and `__vtrTopperEvents`
    - Zaraz GA4 preview routing with native GA4 id `G-N9YHM93HRV`
    - preview-scoped delayed Heap app `286627304`, armed early but loaded only after interaction/load fallback
  - proof:
    - `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/analytics-restored-v8-20260716/`
    - `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716233832-pagespeed-attempt2/`
  - current analytics-on PSI:
    - mobile exact/fresh `98/98`
    - desktop exact/fresh `100/100`
    - TBT `0ms`
