# Full System Audit

Status: Draft v1
Date: 2026-04-10
Owner: MarketingOps / Property Analytics
Scope: Repository-wide audit of capabilities, systems, workflows, and adjacent assets currently present in `/Users/mark/Property_Analytics`

07/23/2026 Resi Portfolio Edge v16 mobile LCP addendum: The Champions Green gated topper at `https://championsgreen-ga.com/?edge_preview=1` now runs Worker version `e4ffb09c-9086-47ca-b8b1-f3ed61f506c0` with template/schema `2026-07-23.performance-topper-v16-q36-mobile-hero`. The route remains query-gated and ungated production traffic remains native. The v16 change keeps the measured topper structure intact while serving a bundled q36 mobile hero AVIF for the existing `resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif` URL. This reduced the live mobile hero asset from the earlier R2 object size of `162,936` bytes to `65,612` bytes and brought local Lighthouse proof back to mobile `98` / desktop `100` with mobile FCP `720ms`, LCP `2345ms`, TBT `21ms`, CLS `0.0006`, and desktop TBT `0ms`. Public PSI could not be rerun because the PageSpeed API returned daily quota `429` on 07/23/2026. The bundled asset is a governed exception caused by the current Cloudflare token limitation: Keeper-backed Wrangler deploy succeeds, but remote R2 object writes still return `403 Forbidden`. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260723-v16-q36-mobile-hero/`.

07/23/2026 Portfolio Launch Proxy beta Worker proof addendum: The Portfolio Launch Proxy now has a working Cloudflare beta Worker at `https://portfolio-launch-proxy-beta.mlaufhutte.workers.dev` and `https://venterraliving.io`, version `e8894245-d94b-4c74-9160-00717d6e0b44`. The implementation is source-controlled in `/Users/mark/web-ops/projects/portfolio-launch-proxy/` and imports the generated portfolio beta manifest built from the launch readiness matrix. The manifest currently contains 80 beta-ready properties and 160 routes: old `.io` URL to new `.io` city/state URL, then city/state `.io` URL to active delivery target. Direct `venterraliving.io` requests exercise the real beta host; workers.dev preview requests can still send `x-vtr-preview-host: venterraliving.io` to emulate the beta host. Live proof covers The Pointe at Bentonville old-path redirect from `/apartments/the-pointe-bentonville/` to `/apartments/pointe-bentonville-ar/`, baseline proxy from the city/state path to the current `venterraliving.com/apartments/the-pointe-bentonville/` WordPress URL, and candidate proxy from the same city/state path to `https://thepointebentonville.kinsta.cloud/` when the route target is candidate. The Worker now also exposes the session-scoped beta switch endpoint `/__vtr-routing-ops/switch`, which sets a per-property route-target cookie for the operator browser and then returns to the old `.io` URL so the same old-to-new URL flow can render either legacy baseline or candidate origin. This is not global activation; global activation still belongs behind authenticated Routing Ops state, approval evidence, and audit logs. The Worker emits diagnostic headers for route action, route id, active target, target mode, future production URL, preview decision URL, origin URL, route-target source, and origin host. Boundary: this is a real Cloudflare beta Worker deploy and `.io` custom-domain attachment through Keeper-backed Wrangler auth, but no GoDaddy forwarding, vanity redirect, or production `venterraliving.com` route has been changed.

07/23/2026 Portfolio Launch Proxy programmatic route-state addendum: The WebOps source shelf now includes the first governed Routing Ops control-plane scaffold for programmatic switch and rollback. New contracts and tools live in `/Users/mark/web-ops/projects/portfolio-launch-proxy/`: `src/route-state.mjs`, `contracts/route-state.schema.json`, `contracts/routing-audit-event.schema.json`, `contracts/routing-control.d1.sql`, `tools/build_route_state.mjs`, `tools/switch_route_state.mjs`, and `docs/ROUTING_CONTROL_PLANE.md`. Generated beta state lives at `config/generated/portfolio-route-state.beta.json` and currently represents 80 properties, 80 switchable properties, 80 active `legacy_baseline` targets, and 0 active `candidate_origin` targets. Route tests prove that applying route state to the immutable manifest can switch The Pointe at Bentonville from the legacy WordPress baseline to the Kinsta candidate origin and back while preserving the same public `.io` URL contract. This remains local/source-controlled proof of the future production model: D1 should become the authoritative route-state and audit store, KV can cache active targets at the edge, and Cloudflare account state remains deploy output rather than system memory. No production route state, GoDaddy forwarding, vanity redirect, or `venterraliving.com` launch route was changed.

07/23/2026 Portfolio Launch Routing Ops Data Pond addendum: The Data Pond Routing Ops page at `/routing-ops/portfolio-launch` now surfaces the programmatic control-plane status alongside the live beta route behavior. The page shows the route-state contract as versioned/tested, 80 switchable rows active on legacy baseline, and D1/KV as the next authenticated mutation gate. The updated Pages preview is `https://2f8206ce.property-analytics.pages.dev/routing-ops/portfolio-launch`; unauthenticated access still falls into the normal Data Pond/Cloudflare Access login path, while protected-page smoke with mocked admin auth confirmed `Programmatic Control Plane`, `State file ready`, `D1/KV next`, and the alphabetized row order. No live global route-state mutation was added to the dashboard in this slice.

07/22/2026 Routing Ops portfolio launch command center addendum: The portfolio launch command center has moved from Experiment Lab to a first-class Routing Ops category at `/routing-ops/portfolio-launch`. The sidebar now exposes `Routing Ops` with `Portfolio Launch` as the admin-owned route-readiness surface. The screen now renders the 92-property migration as collapsible command rows: property identity, before path, after path, origin host, and condition are visible in the primary row, while route details, origin details, launch status, SEO gates, vanity-domain continuity, approval, rollback, and notes sit inside each drawer. The command center also models the improved delivery-switch concept: the public `.io` URL contract stays stable while a future route-target flag can switch between `legacy_baseline` on the current `venterraliving.com` WordPress source path and `candidate_origin` on the new platform origin. Current counts are 85 legacy-baseline rows and 80 fully switchable rows with both baseline and candidate target known. The old Experiment Lab link was removed. WebOps imported `/Users/mark/Downloads/Portfolio-Staging-URLs.docx` into `config/generated/staging-origins.json`, ignoring Pastel links; the import found 84 staging origins, all 84 matched to the governed property identity matrix, with 0 duplicate origins and 0 duplicate property-code duplicates. The regenerated route map/readiness matrix now reports 92 URL rows, 80 beta-ready rows, 5 awaiting staging origins, 4 source-path review rows, 3 identity review rows, 80 local route-test-ready rows, and 0 production-approved rows. The remaining missing-origin rows are The District Universal Boulevard, Champions Green, The Harrison, Calais Midtown, and Ventana. Validation passed for WebOps route tests/foundation validation, the Pond web build, and browser smoke against `/routing-ops/portfolio-launch` using an intercepted admin auth check. Published Cloudflare Pages preview `https://0911589f.property-analytics.pages.dev/routing-ops/portfolio-launch`; `https://app.venterradev.com/routing-ops/portfolio-launch` remains behind Cloudflare Access and returns `302` when unauthenticated. No Cloudflare, GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated.

07/22/2026 Resi Portfolio Edge v13 addendum: The Champions Green gated preview at `https://championsgreen-ga.com/?edge_preview=1` now runs Worker version `1581267b-d342-45d6-b5c9-8ec685c9dfd0` with template/schema `2026-07-22.performance-topper-v13-native-specials-heap-gate`. The route remains a query-gated measured performance topper, not a full native homepage payload, and ungated production traffic remains native. The v13 change tightens the contract by reading a runtime property overlay from the live/native homepage on cache refresh: promo enabled state, promo text/detail, desktop promo image, availability CTA, phone, tour, and apply values come from the native page when available, with the existing property constants as fallback. The route now exposes `x-resi-edge-runtime-property` and `x-resi-edge-promo-state` headers; latest live proof reported `native-fetch` and `enabled`. The current Champions Green special is preserved as `$1,000 off for a limited time!`, `*Select Homes – Limited Time Offer`, native DAM promo image, and `/apartments/?has_specials=true`. The analytics recorder remains active for pageview and required topper interactions, while Heap replay is now queued behind user interaction, pagehide, or a delayed 12-second idle gate rather than an immediate polling loop. Boundary: Zaraz still owns configured Heap/Contentsquare script loading; if the policy becomes no third-party analytics script network before interaction or consent, that must be enforced in Zaraz tool/consent configuration. Compact PSI proof after v13 passed with mobile exact/fresh `98/97`, desktop exact/fresh `100/100`, and TBT `0ms`. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260722-v13-native-specials-heap-gate/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v13-native-specials-heap-gate-20260722/`.

07/22/2026 Portfolio Launch Proxy readiness addendum: The governed WebOps portfolio launch project now includes a generated launch readiness matrix in both the working lab and corporate Git mirror. The builder is `tools/build_launch_readiness_matrix.mjs`; outputs are `config/generated/launch-readiness-matrix.json` and `.csv`. It derives from the portfolio route map and separates modeled URL routing from operational launch approval. Current readiness totals are 92 rows, 1 pilot-ready local beta row for Anatole at Norman / `OK4AN`, 84 rows blocked pending staging origin URLs, 4 rows blocked pending source-path review, 3 rows blocked pending identity review, 1 row marked `local_route_test_passed`, and 0 rows approved for production. The active modeled flow is `https://venterraliving.io/apartments/anatole-at-norman/` -> `https://venterraliving.io/apartments/anatole-norman-ok/` -> `https://anatoleatnorman.kinsta.cloud/`, with future production metadata `https://venterraliving.com/apartments/anatole-norman-ok/`. The matrix adds explicit fields for staging origin, origin host header, health check, origin auth, rewrite policy, SEO redirect status, canonical/robots/sitemap review, query policy, vanity-domain continuity monitoring, test status, launch batch, approval, and rollback posture. Mark clarified that vanity domains such as Camber, Monteverde, and The Vine stay in place and are not part of the migration move. No GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated.

07/22/2026 Portfolio Launch Proxy Pond dashboard addendum: The Data Pond Experiment Lab now includes a read-only Phase 1 portfolio launch command center at `/experiments/portfolio-launch`, linked from `/experiments` beside Edge Messages. The surface renders all 92 readiness rows as property command cards with before/after route, route target, command state, status, and condition visible; supporting route/status/SEO/origin facts sit in expandable drawers below each property rather than multi-column tables or side panels. It is intentionally a command/readiness view, not an action console: production approval remains `0`, and the page has no GoDaddy, Worker route, DNS, vanity redirect, or production route-publication mutation controls. `npm run build` passed, browser smoke confirmed 92 rendered property cards with the first drawer opening cleanly, and the current page deployment is Cloudflare Pages preview `https://224187ce.property-analytics.pages.dev/experiments/portfolio-launch`; the operator route is `https://app.venterradev.com/experiments/portfolio-launch` behind Cloudflare Access.

07/21/2026 Spotlight copy-change/baseline daily report addendum: A separate Spotlight daily email exists for the four-property content-refresh monitoring lane. The repeatable sender is `/Users/mark/Property_Analytics/scripts/send_spotlight_copy_change_baseline_report.py`. It reads local GA4 Organic Search and GSC daily metrics, treats The Whitney and The Harrison as changed from the 07/07/2026 afternoon copy-change point, treats Cendana District West and The Retreat as baseline-only pending content, and compares a pre-launch window against the current post-change/baseline window. The report includes a broader portfolio-average benchmark row, pre/post average-per-day bar charts, and indexed GA4 Organic Search plus GSC click line charts with a dashed portfolio GA4 average trend line so property movement can be read against broader portfolio pressure. GSC click lines stop at the latest available GSC date to avoid source-lag false drops. As of 07/23/2026, Mark approved live distribution; Codex app cron automation `daily-spotlight-copy-change-and-baseline-trends` is active again for 7:00 AM local time and sends to Mark Laufhutte, Andrew Foresi, and Alexandra Hopkins. A 07/23/2026 formatting hardening pass corrected the shell for Outlook and dark/light-mode previews by using explicit white `bgcolor` / `background-color` values and high-contrast navy/black/bay text; generated timestamp, measurement windows, source freshness, and source list now appear only in a bottom `Report context` footer. This workflow is separate from the approved Copy Change Impact Brief decision-read family and does not touch locked PIB files.

07/21/2026 ILS Direct-Start and Apartment Search Behavior addendum: The governed Ad Hoc Executive Report System now includes `ils_search_behavior` for executive questions about where renters search for apartments and how external ILS platform demand compares with Venterra-owned organic/direct traffic. Implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, is exposed by `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, renders through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`, and archives packets under `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/`. The first validated packet covers Venterra first-party data for 07/21/2025 through 07/20/2026 and lives at `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/20260721_121426_apartment-search-behavior-and-ils-direct-start-intelligence-with-supporting-data/`. It reports Semrush June 2026 modeled Direct estimates of 43.70% for Zillow and 41.13% for Apartments.com, with Semrush/Similarweb search-driven platform demand around 35%-40%. Venterra first-party GA4 in the same packet shows 1,242,578 Organic Search sessions / 37.4% and 906,721 Direct sessions / 27.3%; GSC support covers 90 properties from 11/05/2025 through 07/18/2026 and 60,443 apartment/rental-intent query strings. Boundary: GA4/GSC are Venterra source-of-record facts, while Semrush/Similarweb are directional modeled external benchmarks. Venterra's exact share of Zillow/Apartments.com platform-internal direct-start demand remains unknown until vendor/account exports provide listing-level impressions, listing views, leads, calls, emails, tour starts, placement, and spend by property.

07/21/2026 Executive Organic Growth Intelligence addendum: The governed Ad Hoc Executive Report System now has an expanded `organic_search_share` report type for comprehensive portfolio organic traffic analysis. The implementation remains in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, invoked by `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, rendered through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`, and archived under `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/` using the existing run-packet contract. The final executive packet covers 07/21/2025 through 07/20/2026 and lives at `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/20260721_105103_executive-organic-growth-intelligence-over-the-last-12-months-brand-versus-non-b/`. It reports 1,248,372 GA4 Organic Search sessions out of 3,375,339 total sessions, 37.0% organic traffic share, 787,716 organic new users, 61.8% organic engagement, 165,419 organic key events, 195,097 GSC clicks, and 6,812,462 GSC impressions. GSC coverage in the selected window spans 90 properties from 09/17/2025 through 07/18/2026. Directional GSC query classification now separates brand/property capture from non-brand discovery: brand/property capture is 89,402 clicks and 75.2% of classified clicks; non-brand discovery is 29,513 clicks and 24.8% of classified clicks but 69.1% of classified impressions with only 1.1% CTR. The forecast model identifies about 3,194 incremental clicks from practical CTR lift across top high-impression low-CTR queries. Stored DataForSEO rows are latest 07/15/2026 and appear as advisory SERP/ranking, keyword demand, OnPage, AI visibility, SERP-domain, and SERP-gap evidence; coverage is partial, with SERP checks covering 35 properties and keyword demand covering 43 properties. Ahrefs rows are latest 07/20/2026 and appear as advisory technical/authority overlays, with average Site Audit health 97.0 and average Domain Rating 37.8. The report explicitly flags organic landing-page distribution as a collection gap because the current stored GA4 event facts have blank source/channel/landing-page dimensions for the selected window. Boundary: GA4 remains source of record for sessions/share, GSC for owned Google organic search performance, DataForSEO for advisory external SERP context, and Ahrefs for advisory technical/authority context. No locked PIB generation/rendering/sending files were touched, no email was sent, and no new standalone organic renderer should be used for future executive organic-search asks.

07/20/2026 Portfolio Launch Proxy foundation addendum: A governed WebOps project scaffold now exists for the portfolio launch reverse-proxy migration. The working lab project is `/Users/mark/Web_Operations/projects/portfolio-launch-proxy/`; the corporate Git mirror is `/Users/mark/web-ops/projects/portfolio-launch-proxy/` on branch `codex/portfolio-launch-proxy-foundation`. The scaffold captures the intended Cloudflare architecture from the launch blueprint: D1 route authority, KV runtime cache, Worker path routing, exact vanity-domain/static redirects through Cloudflare redirect primitives where useful, Data Pond/property identity validation before publishing, and account-portable configuration with secrets kept out of Git. The active pilot fixture is now Anatole at Norman / `OK4AN`: mocked old beta URL `https://venterraliving.io/apartments/anatole-at-norman/`, beta city/state URL `https://venterraliving.io/apartments/anatole-norman-ok/`, future production URL `https://venterraliving.com/apartments/anatole-norman-ok/`, and temporary staging origin `https://anatoleatnorman.kinsta.cloud/`. This models the future Venterra subdirectory route while allowing beta proof against the first supplied new-platform staging URL. The first executable local framework now imports `/Users/mark/Downloads/Location Hierarchy_Resi.xlsx`, generates a URL inventory and portfolio route map, and tests route decisions without Cloudflare mutation. Current import control totals are 92 URL rows, 89 identity matches, 3 review rows, and 0 duplicate URLs. Current route-map totals are 92 rows, 1 ready beta row, 84 awaiting staging origins, 4 source-path review rows, and 3 identity review rows. The 07/22/2026 readiness matrix adds launch-gate status on top of route modeling: 1 pilot-ready local beta row, 84 blocked pending staging origin URLs, 4 blocked pending source-path review, 3 blocked pending identity review, 1 local route test passed, and 0 production approved. Route tests prove old `.io` path redirect, city/state `.io` proxy, query preservation, unknown-route miss, and future `.com` metadata retention. No GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated. This becomes the auditable source shelf for future route manifests, publisher code, runbooks, readiness evidence, and vendor SLA delegation rules.

07/20/2026 Ahrefs competitor-admin addendum: `/Users/mark/Property_Analytics/scripts/ahrefs_competitor_admin.py` now governs Ahrefs project competitor setup from local `property_competitors` / `competitors` rows resolved through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`. The script matches only canonical Ahrefs property projects, dry-runs current Ahrefs competitors through the free documented management endpoint, and requires `--apply --confirm ADD_AHREFS_COMPETITORS` before live additions. Mark approved the initial apply; 640 URL-backed competitors were added across 86 canonical property projects with zero failures. Apply artifact: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_apply_20260720T212939Z.json`. Confirmation plan: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_plan_20260720T213015Z.json`, reporting 640 current Ahrefs competitors, 0 remaining additions, 0 Ahrefs read errors, and 0 unresolved property-identity competitor links. Seven properties still require local competitor URL completion before Ahrefs can receive their comp sets: Clearwater Heights, French Place, Monteverde, Sundara at Spring Cypress, The Vine Kyle Parkway, Town Station Lofts, and Villas Continental.

07/20/2026 Ahrefs manual crawl-start addendum: Ahrefs Site Audit crawl starts were manually kicked off through the authenticated web UI after public API probes confirmed the documented Site Audit API is read-only for this action (`POST /site-audit/projects` returned 405 and likely crawl-start endpoint shapes returned 404). The run artifact is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_site_audit_manual_crawl_start_20260720T205336Z.json`. UI automation clicked `Run crawl` or verified `Starting` / existing history across the 105-project roster. Final Ahrefs API status reported 105 projects, 105 `Completed`, 105 crawl dates, and 0 no-crawl projects. A narrow canonical collector refresh updated `/Users/mark/Property_Analytics/data/portfolio_analytics.db` `ahrefs_site_audit_project_health` for 2026-07-20 to 105 completed rows with 0 missing crawl dates. Ahrefs usage remained at 0 API key units and 0 workspace units.

07/20/2026 Ahrefs rollout completion addendum: After Mark approved proceeding, `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py` created all 79 remaining canonical Ahrefs prefix projects with zero failures. The apply artifact is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_project_apply_20260720T195235Z.json`; the follow-up dry-run is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_project_plan_20260720T195246Z.json`. The live Ahrefs roster now has 105 projects, all 93 governed identity-matrix property projects match, and missing canonical projects are 0. Discovery-only collection refreshed local `ahrefs_projects` to 105 rows with 93 distinct property ids. Ahrefs usage remained at 0 API key units and 0 workspace units after the API-supported creation and free roster/subscription calls.

07/20/2026 Ahrefs admin-prep addendum: The Ahrefs project-admin path now separates API-supported bulk creation from reconciliation that Ahrefs does not currently document as editable through the public update endpoint. `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py` still plans missing projects from the governed property identity matrix and requires `--apply --confirm CREATE_AHREFS_PROJECTS` before live creation, but each dry-run now also reports exact-target name normalization needs, likely legacy standalone-domain projects that should receive canonical `venterraliving.com/apartments/...` prefix projects, standalone property projects that must wait for a governed identity-matrix `website_url` move before future prefix creation, and review-only live projects. The latest read-only plan after the first 5 creates found 79 missing canonical prefix projects, 10 name-normalization items, 6 likely legacy-domain candidates, 7 standalone property project rows including the Monteverde duplicate, and 5 review-only live projects. The documented Ahrefs project update endpoint supports access updates only, so project-name and target URL/mode/protocol unification is tracked as manual/UI reconciliation or future API support rather than an automated mutation.

07/20/2026 addendum: Ahrefs is now a governed Keeper-first advisory Data Pond source for portfolio SEO, technical site health, domain authority, Ahrefs Web Analytics, and Ahrefs-hosted GSC Insights. The source contract is `/Users/mark/Property_Analytics/docs/AHREFS_SOURCE_CONTRACT_2026-07-20.md`; implementation lives in `/Users/mark/Property_Analytics/utils/ahrefs_auth.py`, `/Users/mark/Property_Analytics/Data_Collection/collectors/ahrefs_collector.py`, `/Users/mark/Property_Analytics/config/ahrefs.yaml`, `/Users/mark/Property_Analytics/apps/api/migrations/0060_create_ahrefs_tables.sql`, and project-admin script `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py`. Daily collection now runs Ahrefs after ApartmentIQ and before Cloudflare collection using only endpoints Ahrefs documents as free: subscription usage, project roster, Site Audit projects, Web Analytics stats, GSC performance history, and public Domain Rating. The new local Data Pond tables are `ahrefs_subscription_usage_snapshots`, `ahrefs_projects`, `ahrefs_site_audit_project_health`, `ahrefs_web_analytics_daily`, `ahrefs_gsc_daily_summary`, and `ahrefs_domain_rating_snapshots`. Property matching resolves through the governed property identity matrix only; unresolved Ahrefs projects remain source rows without local one-off mappings. The first live KSM-backed collection for 07/19/2026 captured 21 verified Ahrefs projects, 21 Site Audit health rows, 21 Web Analytics rows, 21 GSC summary rows, 20 distinct Domain Rating target rows, and 1 subscription usage snapshot; the post-run Ahrefs usage check still reported 0 API units used. The initial guarded admin dry-run found 93 desired property projects, 9 exact target matches, 84 missing prefix projects, 1 duplicate existing target, and 11 existing Ahrefs projects not matching the current matrix target exactly. Ahrefs complements GA4, GSC, DataForSEO, GBP, PageSpeed, Cloudflare, and internal operating sources; it does not replace those authorities.

07/18/2026 addendum: Resi Portfolio Edge v12 restored the Champions Green gated topper to the WebOps PageSpeed gate after the v11 inline official SVG increased initial document weight and slowed mobile first paint. Worker `portfolio-resi-edge-prototype` version `db8e900a-8284-4a81-9bbc-9d07ba0b16d9` now reports template/schema version `2026-07-18.performance-topper-measured-preview-v12-external-lble` and cache version `2026-07-18-performance-topper-measured-preview-v12-external-lble`. The Worker package now contains Mark's smaller plain `Live Better. Live Easy.` SVG and serves it externally at `/assets/resi-edge-assets/shared/lble.svg` with immutable cache headers instead of embedding it as a `data:image/svg+xml` source. Live proof confirms the external SVG is `22,708` bytes, hash `a21657e7a6452c6c44ad8d9deb323d3754b0bd61dd42c0586974df3eb8ae5f6d`, viewBox `0 0 294.12 72.65`, no script/event handlers, and no horizontal overflow at `390px`, `740px`, or `1440px`. PageSpeed proof at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260718-v12-external-lble/` passed with mobile exact/fresh `98/99`, desktop exact/fresh `100/100`, TBT `0ms`, and near-zero CLS. The operating lesson is now explicit: large brand SVGs should be cacheable external assets in the topper, while SVGZ should be used only when the response path can guarantee the required gzip headers.

07/17/2026 addendum: Resi Portfolio Edge v11 corrected the Champions Green gated measured topper after the official `Live Better. Live Easy.` SVG was supplied. Worker `portfolio-resi-edge-prototype` version `659e8210-84c7-43a9-b8fe-b91d26b5a981` now reports template/schema version `2026-07-17.performance-topper-measured-preview-v11-official-lble-rating-scale` and cache version `2026-07-17-performance-topper-measured-preview-v11-official-lble-rating-scale`. The official SVG is bundled into the Worker as a text module and rendered as a data URI for the hero tagline because the governed remote R2 object write path returned `403 Forbidden`; large media remain R2-served. The hero tagline aspect ratio now uses the official `374.75 / 92.57` viewBox, and a `max-width: 767px` responsive band prevents narrow tablet widths from inheriting oversized base rating/star/tagline styling. Live Playwright proof at `390px`, `740px`, and `1440px` confirmed the decoded SVG hash matches Mark's official file, no horizontal overflow was introduced, and the narrow rating row uses `22px` stars with `12px` rating text. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v11-official-lble-rating-scale-20260717/`.

07/17/2026 addendum: The pilot Edge Message / Resi performance Worker now has its first Zaraz CMP-aware direct pixel gate. Runtime proof on `pilot.venterradev.com` confirmed `venterradev.com` Zaraz Consent Management is enabled and exposes `window.zaraz.consent`, with active choices for `Analytics & Performance` and `Marketing & Leasing Attribution` after Mark assigned the new Zaraz `Resi Pixel` custom HTML tool to Marketing/Leasing. The Worker `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now removes the native `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` homepage script and does not inject a Worker replacement loader; Zaraz is the owner for loading Resi Pixel after consent. This also fixes the prior mobile-only boundary so desktop homepage requests no longer bypass the Resi-pixel rewrite. The deployed pilot Worker version is `8601b070-f9cc-412c-b5fd-b620b7bb90a6`, with cache version `2026-07-17-zaraz-cmp-resi-pixel-zaraz-owned-v1`. Clean-browser desktop and mobile proof showed no pre-consent `js.getresi.co` request, no Worker idle loader, both purpose choices false on first load, and `vtr_edge_home_resi_pixel:native-blocked-zaraz` in server timing. After Mark saved the Zaraz `Resi Pixel` pageview action, programmatic acceptance of both consent purposes loaded `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` through Zaraz with no Worker duplicate. Remaining production-hardening work: confirm the generic `Pageview` trigger is hostname-scoped to `pilot.venterradev.com`, run a visible-modal acceptance proof, and decide whether Cloudflare Monitoring should remain operational/pre-consent or be treated as analytics consent.

07/17/2026 addendum: The pilot Zaraz CMP UX was softened from an intrusive modal into a Worker-injected passive bottom notice while keeping Zaraz `Show consent modal` disabled. Worker `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now appends a small `Accept` / `Reject` / `Manage` notice on normal `pilot.venterradev.com` HTML pages. `Accept` sets all active Zaraz consent purposes true, flushes Zaraz queued events, and flushes a new session-scoped pre-consent interaction queue of lightweight first-party page/CTA facts through `zaraz.track("vtr_preconsent_interaction", ...)`; `Reject` sets all active purposes false and clears that session queue; `Manage` calls `zaraz.showConsentModal()` for the detailed preference panel. The deployed pilot Worker version is `d724adc6-cf63-4d7a-a8cf-d5866f18b317`, with cache version `2026-07-17-zaraz-cmp-passive-notice-v6` and `EDGE_ZARAZ_CONSENT_NOTICE_ENABLED=true`. The latest presentation makes `Accept` the prominent Venterra Navy primary button, keeps `Reject` secondary, and renders `Manage` as a low-emphasis San Marino text link. The direct native Resi pixel is now removed from all pilot HTML pages except excluded admin/API/static paths. Live proof showed no `js.getresi.co` request before consent on the "land -> ignore consent -> click Find Your Home -> /apartments/" path; the home page view, CTA click, and apartments page view queued in `sessionStorage`; clicking `Accept` set both purposes true, flushed all queued `vtr_preconsent_interaction` records through Zaraz, cleared the queue, removed the notice, and then loaded Resi Pixel. The reject proof cleared the queue and did not load Resi Pixel. A new unresolved-consent close/leave report path sends a minimal first-party `pagehide` beacon only when no consent option has been selected; the Worker stores sanitized reports in D1 table `zaraz_consent_unresolved_reports`, suppressing same-site internal navigation so the queue carries forward. Live proof wrote a `pagehide` row with consent false, and an Accept-then-pagehide proof sent no unresolved report.

07/16/2026 addendum: A public guided `Steps to Freedom in Christ` app surface now exists at `/steps` in `apps/web`. This is the first implementation pass for the planned `steps.yournamehere.vip` doorway and the future logged-in Freedom app maintenance/progress lane. The app bypasses the internal app sidebar/login shell through the public route allowlist, uses a source-locked content model in `apps/web/src/lib/freedom/steps-content.ts`, and renders through `apps/web/src/components/freedom/steps-experience.tsx`. The implementation preserves the document sequence and prayer/declaration wording, adding only interaction around existing document prompts: checklists, custom entries, forgiveness rows, prayer-card substitution, completion marks, export, and clear controls. Public entries are browser-session local only unless the visitor explicitly enables browser-local resume; no server persistence or authenticated progress tracking was added in this pass. Follow-up export/email/print behavior now keeps the content boundary while allowing system-sent delivery: section-level `Create prayer` controls generate individual prayers, the created worksheet email action opens an in-app recipient form, and the last step has an `Entire journey prayers` panel that compiles every selected/written prayer item in source order while preserving each as an individual prayer. The final panel can send the entire journey through same-site `/api/email`, owned by the standalone `steps-freedom-email` Cloudflare Worker with no Pond/Data API association, and can still print filled-in prayers, blank prayer worksheets with adjustable blank rows per template, a full packet, or aftercare/affirmations. The email boundary is no prayer-content persistence, no content logging, origin restriction to the Steps app, and narrow per-connection/per-recipient rate limits. The app now also supports Digital, Printable, and Facilitator session paths, privacy blur for sensitive entries, grouped final journey review by step, and attribution to `yournamehere.vip`, Neil Anderson, and Freedom in Christ Ministries in the app, exports, emails, and printouts. The latest UX correction moves the public app to progressive disclosure: a three-page orientation explains the experience, path choice, privacy/local-resume implications, and print-record handling before source text appears; in-session export/email/print/clear controls are collapsed under `Session tools`, path/privacy controls are collapsed under `Session options`, and each step begins with a short `What happens here` briefing before the exact source text. Mobile users now get a collapsed step list, compact current-step card, reduced header scale, and sticky bottom Previous/Next controls. Step 7 now treats the `Sins and iniquities of my ancestors` field as an explicit source-blank substitution: `Prepare declaration` inserts the participant's entries only at `(name those that have come to mind)` and includes the prepared declaration in final journey email/export/filled-print output. `npm run build` in `apps/web` passed with `/steps` generated as a static route. The public route was published through a dedicated Cloudflare Pages project `steps-freedom` and attached to `steps.yournamehere.vip`; root redirects to `/steps` and validation returned `302` then `200`. Future work should reuse the same source model for the authenticated Freedom app rather than copying or rewriting the content.

07/16/2026 addendum: Resi Portfolio Edge v7 tightened the active Champions Green measured performance topper by bringing the desktop header onto the same boxed content rail as the measured body sections and restoring governed document head metadata in the lightweight route. Worker `portfolio-resi-edge-prototype` version `7b0aa5fc-fe14-4750-9418-d5f7298ebc9f` now reports template/schema version `2026-07-16.performance-topper-measured-preview-v7` and cache version `2026-07-16-performance-topper-measured-preview-v7`. The header now uses `max(40px, calc((100vw - 1600px)/2))`, so live Playwright proof at `1845px` shows the header logo on `x=122.5`, the menu/right actions ending at `1722.5`, and the first content grid at `x=122.5 width=1600`. The performance shell now emits the corrected title, description, canonical, preview noindex, native favicon/apple icon links, OG/Twitter fields, and JSON-LD blocks for WebSite, LocalBusiness, ApartmentComplex, and Organization. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v7-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v7-head-header/` and passed with mobile exact `99`, mobile fresh `98`, desktop exact/fresh `100/100`, and TBT `0ms`. v7 supersedes v6 as the current measured topper baseline.

07/16/2026 addendum: Resi Portfolio Edge v6 tightened the active Champions Green measured performance topper without reintroducing native WordPress/YOOtheme payload. Worker `portfolio-resi-edge-prototype` version `4f423f8a-a456-4505-bf61-45f74434fe35` now reports template/schema version `2026-07-16.performance-topper-measured-preview-v6` and cache version `2026-07-16-performance-topper-measured-preview-v6`. The pass corrected the main hero CTA to the native measured hover/default contract, fixed the desktop hero height so welcome starts at the native `y=1400`, corrected desktop/wide page widths (`1360px` inner grid at `1440px`, `1600px` inner grid at `1845px`), clipped reveal-animation overflow, and hid the mobile welcome image to better match native mobile. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v6-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v6-width-cta/` and passed with mobile exact/fresh `99/99`, desktop exact/fresh `100/100`, and TBT `0ms`. This reinforces the current architecture boundary: exact-native is the visual measurement lane; the lightweight measured topper is the production-performance lane.

07/16/2026 addendum: Resi Portfolio Edge restored the Champions Green gated preview to the measured performance topper after the exact-native performance ceiling was confirmed. Worker `portfolio-resi-edge-prototype` version `939e9c34-69f2-40ee-8d96-64fe45541e92` now reports mode `performance-topper`, template/schema version `2026-07-16.performance-topper-measured-preview-v3`, and cache version `2026-07-16-performance-topper-measured-preview-v3`. The route `https://championsgreen-ga.com/?edge_preview=1` again serves an edge-owned topper with optimized R2 assets, zero initial `/wp-content/` payload, and lazy native continuation. The mobile and desktop drawer were corrected against the Playwright native geometry packet: desktop panel `x=990 width=450`, mobile panel `x=120 width=270`, native nav font/weight, and measured social icon positions. Visual proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v3-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716205108-pagespeed/` and passed with mobile exact `99` and `98`, mobile fresh `98` and `98`, desktop exact/fresh all `100`, TBT `0ms`, and `10` requests. This confirms the governing architecture: exact-native is the reference lane, while measured topper is the high-score delivery lane.

07/16/2026 addendum: Resi Portfolio Edge now has a measured native homepage geometry contract in the WebOps lab. The new schema `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/native-html/homepage-geometry.schema.json` and Playwright tool `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/measure_homepage_geometry.mjs` capture the live gated exact-native reference into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-geometry.json`. The capture covers desktop and mobile closed, promo-open, and menu-open states, with evidence screenshots under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/homepage-geometry-20260716/`. It records the exact native shell measurements that had been drifting in the rebuilt topper, including right-side menu panel dimensions, menu typography, social link geometry, promo overlay state, and section rectangles. `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/runtime/generate_template_structure.mjs` now embeds this geometry into the property-specific desktop/mobile template instances, and durable contract validation requires generated geometry before template instances pass. Validation passed with `/Users/mark/Web_Operations` `make validate`. This is a lab architecture step, not a live route change; it gives the high-score topper path a measured source of truth before runtime CSS/rendering consumption.

07/16/2026 addendum: Resi Portfolio Edge exact-native performance work confirmed the current architecture boundary. After the visual-fidelity exact-native publish, two surgical passes were deployed on the Champions Green gated preview. Worker `portfolio-resi-edge-prototype` version `4edaf222-35a0-4519-9973-532397d4a790` introduced `2026-07-16.exact-native-template-perf-v1`, preserving native DOM/menu/header/hero behavior while adding early hero discovery, duplicate CSS removal, preview-only analytics blocking, and delayed non-hero DAM image loading. Fresh proof moved exact-native mobile from roughly `58-59` to `70` and desktop to `98`. Worker version `e71dc168-f7d6-4bd4-b22f-63858a3535e6` introduced `2026-07-16.exact-native-template-perf-v2`, reusing the prior R2 image optimization lane for mobile only by swapping the mobile native hero to `/assets/resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif` while keeping native DOM, promo, typography, and menu behavior. Fresh v2 proof measured mobile `78` with LCP `3527ms`, TBT `328.5ms`, `25` requests, and `576221` total byte weight; desktop measured `95` with LCP `1074ms`, TBT `151ms`, `26` requests, and `1416973` total byte weight. Evidence lives under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-perf-v1-20260716/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-perf-v2-20260716/`. Conclusion: exact-native is the visual calibration/reference lane, not the high-90 mobile delivery architecture. The production-worthy route remains the accurate topper/performance shell using native capture geometry, R2 assets, promo control, and lazy/native continuation; future agents should not rediscover exact-native payload limits before returning to the topper path.

07/16/2026 addendum: Resi Portfolio Edge pivoted the live query-gated Champions Green preview back to exact-native delivery after visual review showed remaining differences in the reconstructed topper, including the menu overlay and broader template area. Worker `portfolio-resi-edge-prototype` version `fc40f3cf-648b-4a1f-a6ef-7eb740a807f3` reports mode `exact-native-homepage`, template/schema version `2026-07-16.exact-native-template-head-v2`, and cache version `2026-07-16-exact-native-template-head-v2`. The gated route `https://championsgreen-ga.com/?edge_preview=1` now fetches the clean live native Resi/YOOtheme homepage and preserves the original promo, header, hero, reviews row, tagline, CTAs, menu overlay, and surrounding template HTML/CSS, adding only edge/noindex metadata. Cloudflare cache was purged for the preview homepage, root homepage, and `/favicon.ico` so the plain preview URL stopped returning the prior five-minute `performance-topper` response; plain preview headers now show `server-timing: vtr_exact_native_homepage;desc="native-dom"` and `x-resi-edge-mode: exact-native-homepage`. A follow-up head audit found that the native head was not being dropped, but the native title family was only `Champions Green`, `/favicon.ico` returned `404`, and the preview had conflicting `index, follow` plus `noindex,nofollow` robots tags. The edge now normalizes `<title>`, `dc.title`, `og:title`, and `twitter:title` to `Champions Green Apartments in Alpharetta, GA`, serves `/favicon.ico` from the native PNG favicon, adds explicit icon/apple/shortcut icon links, and leaves one preview `noindex,nofollow` robots tag. Native source HTML and geometry evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/native-html-20260716-exact/`; live preview screenshots, desktop/mobile menu screenshots, and reviews link proof live at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-20260716/`; head proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-head-v2-20260716/summary.json`. Direct browser automation against ungated native can trigger the Resi firewall, so this proof uses pulled native HTML plus the Worker-rendered exact-native preview. This supersedes the immediately prior high-score topper for the active review lane; future work should treat exact template parity as the current requirement unless Mark explicitly re-chooses the PageSpeed-optimized approximation.

07/16/2026 addendum: Resi Portfolio Edge published the SVG tagline responsive cleanup to the live query-gated Champions Green topper. Latest Worker `portfolio-resi-edge-prototype` version is `e883b995-957f-4b8e-b33f-e4e7c5beee6f`, reporting template/schema version `2026-07-16.performance-topper-v4-svg-tagline-responsive-reviews-link`, mode `performance-topper`, and cache version `2026-07-16-performance-topper-v4-svg-tagline-responsive-reviews-link`; ungated production traffic remains native. The hero tagline now renders through the existing `lble.svg` asset with an explicit `841.36 / 201.78` aspect-ratio wrapper, clamp-based responsive widths, and `object-fit: contain`, avoiding desktop/mobile font sizing drift. The same sizing contract was applied to the reusable WebOps runtime, and the live shell also received right-anchored drawer positioning plus document-level horizontal overflow protection. A follow-up navigation fix converted the hero star/review row to an actual reviews anchor. Live proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-svg-tagline-responsive-20260716-clean-v2/summary.json` measured the SVG at `691x166` on desktop and `242x58` on mobile, with complete image load and matching computed aspect ratio. Review-link proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-reviews-link-20260716/summary.json` shows `.vtr-shell-rating` is an `<a href="/reviews/">` and a browser click navigated to `https://championsgreen-ga.com/reviews/`. Compact PageSpeed proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716180818-pagespeed/PERFORMANCE_READOUT.md` passed at mobile exact `98`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, and TBT `0ms`. Validation passed through Worker syntax check, WebOps runtime smoke, WebOps visual harness, and PIB guardrails.

07/16/2026 addendum: Morning Full D1 mirror reliability was repaired after the `07/16/2026 11:23 AM` Morning Full Portfolio Report showed `D1 mirror verification failed`. Investigation found fresh local source data but a remote D1 mirror gap: Google Ads campaigns had reached `07/15/2026` in D1, while Google Ads keywords and D1 `data_freshness` were still at `07/14/2026`. The root cause was the combination of Wrangler `4.68.1` failing D1 remote file imports with `fetch failed` and large unbounded historical imports from `apps/api/scripts/google_ads_to_d1.py` and `apps/api/scripts/gsc_daily_to_d1.py`, which ignored the mirror orchestrator `--date` / `--weeks` bounds. The sync scripts now resolve those arguments into real lower-bound filters, and `apps/api` now uses Wrangler `4.100.0` with matching `@cloudflare/workers-types` `4.20260611.1`. A focused Google Ads repair loaded the missing `07/15/2026` keyword rows, then full D1 mirror verification passed at `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260716_121859.json` with `core_success=true`, `success=true`, and `mirror_status=success`. The regenerated Morning Full report at `/Users/mark/Property_Analytics/reports/daily_health/Morning_Full_Portfolio_Report_2026-07-16.html` now reports `HEALTHY` and D1 Mirror Status `PASS`. The Morning report renderer also now displays mirror JSON `name` / `ok` / `details` step fields instead of blank `N/A` rows.

07/16/2026 addendum: Resi Portfolio Edge received another live topper fidelity pass on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `3b0a2ac8-aa63-4f36-bf2f-d4fc4721c4bd` reports template/schema version `2026-07-16.performance-topper-v4-fidelity-p-edge-fonts` and cache version `2026-07-16-performance-topper-v4-fidelity-p-edge-fonts`; ungated production traffic remains native. The pass tightened the desktop promo overlay to the stored exact-native behavior: absolute popdown, `391px` height, desktop promo image present at `416x312`, mobile promo image hidden, no body/hero push, and a single-line desktop headline. It also restored native-like reveal motion for the welcome and features image blocks, with desktop welcome entering from the right, features entering from the left, mobile reveal support, and reduced-motion handling. A follow-up menu/type pass moved the topper from generic Arial/Georgia to native `Lato` and `Noto Serif` font faces through `/assets/resi-edge-assets/shared/fonts/...`, kept direct WordPress asset URLs out of the rendered shell, restored the native-style mobile drawer CTA labels, social icons, visible close control, and tighter drawer rail. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/topper-fidelity-pass-20260716-l2/`, with deep reveal proof in `deep-reveal-summary.json`, menu/type proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/menu-typography-20260716-p-edge-fonts/`, and PageSpeed proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v4-fidelity-p-edge-fonts/`. The PageSpeed gate passed at mobile exact `98`, mobile fresh `98`, desktop exact `100`, desktop fresh `100`, `10` requests, mobile CLS `0.0008`, desktop CLS `0.0003`, and TBT `0ms`. WebOps validation, PIB guardrails, and context discipline all passed. This continues the current architecture decision: exact-native remains the visual calibration source, while the lightweight topper remains the high-score gated delivery path.

07/15/2026 addendum: the governed Ad Hoc Executive Report System now includes **Property Intel Pack**, the set Content Ops companion product to PIB, governed by `/Users/mark/Property_Analytics/docs/PROPERTY_INTEL_PACK_STANDARD_2026-07-15.md` and evolved by Mark + Alexandra Hopkins. The internal report type is `content_intelligence_pack` for system continuity. The implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` and is exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, preserving the Outlook-safe renderer, workbook, validation, run-packet, and universal sender contract. It combines fresh DataForSEO SERP rows, DataForSEO keyword demand, DataForSEO OnPage, DataForSEO AI visibility, official-page competitor market research observations, and GBP review sentiment themes. First use was on `07/15/2026` for Cendana District West (`TX4CD`) and The Retreat (`TX4GM`). Cendana's fresh SERP pull found the target in `0/5` tested top-30 priority terms, while The Retreat was found in `4/6`. Official-page competitor market packets produced `24` Cendana observations and `21` The Retreat observations, which were ingested into `competitor_market_research_observations`. Final Content Intelligence Pack emails with workbook attachments were sent to Alexandra Hopkins and Dustin Crandall with Mark copied. Mark's presentation feedback after first send: the email body was too wide in Outlook preview; future Property Intel Pack iterations should retain the evidence/workbook lane but use a narrower email-pane-friendly body, fewer KPI columns per row, compact question text, and tables that avoid horizontal clipping.

07/15/2026 addendum: the governed Ad Hoc Executive Report System now includes a single-property `content_manager_workup` report type. The implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` and is exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`; it preserves the existing run packet, Outlook-safe renderer, validation, workbook, and universal sender contract. The workup resolves property scope through the canonical identity matrix and combines GA4 traffic/channel/action rows, GSC query language, DataForSEO keyword metrics, DataForSEO Labs ranked keywords, DataForSEO OnPage snapshots, DataForSEO business profiles, DataForSEO AI visibility probes, governed competitor sets, unit availability, guest-card DW direct rows, operating metrics, and PageSpeed metrics. First use was on `07/15/2026` for Cendana District West (`TX4CD`) and The Retreat (`TX4GM`), after fresh DataForSEO deep-trial pulls. Mark received the two Content Manager Workup emails with workbook attachments, and the two canonical PIB v2.2.1 emails covering `06/15/2026` through `07/14/2026`. Boundary preserved: locked PIB files were not modified, and no standalone custom report sender was introduced.

07/14/2026 addendum: the repository now has a mandatory human-facing date format standard in `/Users/mark/Property_Analytics/AGENTS.md`. Agents must render dates for human readers as `MM/DD/YYYY` across reports, emails, decks, documents, spreadsheets, UI labels, narrative summaries, captions, and final user-facing messages unless Mark explicitly requests a different display format in the current task. ISO `YYYY-MM-DD` remains reserved for filenames, file paths, JSON/API/database/log/spec/validation metadata, sortable IDs, and other machine-readable contracts. This is an executive-deliverable discipline update and should be applied across new or materially updated reader-facing outputs.

07/14/2026 addendum: the governed Ad Hoc Executive Report System now supports property-scoped GA4 web traffic trend and week-over-week copy-impact reports in the existing `ga4_traffic_summary` path. `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` resolves non-portfolio `scope` values through the governed property identity resolver, then renders the same Outlook-safe run packet through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py` and the existing validation/archive flow. The report now adds daily trend rows, computes engagement rate from `engaged_sessions / sessions` when the daily engagement-rate column is not materialized, includes channel key-event totals and action-event summaries from `ga4_event_facts`, and can call the GA4 Data API through the existing service-account path for hourly afternoon copy-change splits. Copy/week-over-week subjects now trigger an impact mode that compares the prior week against the copy week and returns a Positive, Mixed, Negative, or Inconclusive verdict with channel, action-quality, timing, and daily context. Latest packets were generated for The Whitney and The Harrison for `06/30/2026` through `07/13/2026`, treating `07/07/2026 12:00 PM` as the afternoon transition point; the impact read is Mixed for The Whitney and Negative for The Harrison. Both passed Outlook safety validation. Boundary preserved: this extends the canonical ad hoc report engine and does not touch locked PIB files or introduce standalone traffic-report scripts.

2026-07-13 addendum: WebOps now has a reusable `Tabstack Web Intelligence` toolbox capability in the Web Operations lab. The canonical package is `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/`, with a catalog entry at `/Users/mark/Web_Operations/toolbox/tabstack-web-intelligence/README.md`. The capability evaluates Mozilla Tabstack as a managed public-web extraction layer for advisory WebOps R&D tasks such as competitor concession checks, vendor/product research, and schema-normalized extraction from inconsistent public pages. Mark created Keeper record `Tabstack API Key`; the shared client `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/scripts/lib/tabstack_client.mjs` resolves that record by title, supports `KSM_TABSTACK_API_KEY_NOTATION`, and leaves direct `TABSTACK_API_KEY` as a one-session fallback only. KSM-backed smoke proof passed for markdown and JSON extraction, with the latest durable command proof on `2026-07-13T201306154Z` resolving the Keeper record by title without a notation env var. A five-source Davenport / Champions Gate concessions demo on `2026-07-13T195513318Z` passed with direct property pages returning faster than aggregator/listing pages. Evidence lives under `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/evidence/`, with readout `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/CONCESSIONS_MONITOR_READOUT.md`. Boundary: this is toolbox-ready for advisory R&D only; it is not a production Data Collection source, Captain read, property-scoped automation, recurring monitor, or executive-report input until governed comp-set ownership, budget, cadence, QA threshold, and output/storage contracts are approved.

2026-07-12 addendum: Resi Portfolio Edge was returned to the intended high-score topper architecture after the exact-native pass established the visual source of truth but dropped PageSpeed. Worker `portfolio-resi-edge-prototype` version `9c9104e2-05c8-4898-a853-d68ea021764e` reports mode `performance-topper`, template version `2026-07-12.performance-topper-v4-native-geometry`, and cache version `2026-07-12-performance-topper-v4-native-geometry-f`. The gated route `https://championsgreen-ga.com/?edge_preview=1` now serves an edge-owned topper with R2 hero assets, promo/header/hero/welcome/features, and lazy native continuation; it does not include native `/wp-content/` payload in the scoring path. The topper was calibrated from exact-native measurements instead of guessed layout: desktop promo/header/hero/welcome/features bands align with native coordinates, the welcome image is placed at native `645x500` geometry, the Kingsley badge is back on the native left rail within a few pixels, mobile promo/header/hero geometry matches native, and the promo overlay keeps its image without body or hero shift. Final PageSpeed evidence in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712-topper-v4-native-geometry-f/` scored mobile exact `100`, mobile fresh `100`, desktop exact `100`, and desktop fresh `100` with `6` requests, CLS `0`, mobile TBT `0ms`, and desktop TBT `0-32ms`. The exact-native route below remains a calibration baseline, not the active delivery model.

2026-07-12 addendum: Resi Portfolio Edge now has an exact-native accuracy baseline on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `d1b1a82f-97c6-4d82-8ae8-b956155c94f0` reports mode `exact-native-homepage`, template version `2026-07-12.exact-native-homepage-v1`, and cache version `2026-07-12-exact-native-homepage-v1`. The gated homepage now fetches the clean native Resi homepage and preserves the real YOOtheme DOM as the visual contract, adding only edge headers/markers and promo-state control. This supersedes the approximation shell for visual parity work. Desktop proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-20260712-v1/` shows native and edge body height `7575`, hero top `126` height `1320`, welcome top `1446`, apartment features top `2186`, and Kingsley badge left `40` top `1977` size `64x64`. Mobile proof shows native and edge body height `8097`, hero top `126` height `584`, welcome top `710`, apartment features top `1431`, and Kingsley badge left `15` top `1297` size `64x64`. Promo proof confirms the native desktop popdown overlays with the desktop promo image and creates no body-height or hero-top shift. Compact PageSpeed on the exact-native route scored mobile exact `53`, mobile fresh `61`, desktop exact `82`, and desktop fresh `97`, confirming the next phase must optimize the exact native DOM instead of restoring a hand-built imitation.

2026-07-12 addendum: Resi Portfolio Edge v3 template polish is live on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `5f2189b7-cbe6-4452-8685-dc2518bf19bc` reports template version `2026-07-12.performance-hybrid-shell-v3-template-polish`; ungated production traffic remains native. The polish corrected visual fidelity issues found after v2: media frames now show visible rounding, the Kingsley badge sits outside the welcome image frame, fallback welcome copy matches the native capture phrase `easy and connected`, and the lazy/native continuation iframe height guard prevents desktop from expanding into the prior large blank bottom band. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-polish-20260712/`, with compact PageSpeed proof at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712190211-pagespeed/`: mobile exact `100`, mobile fresh `99`, desktop exact `100`, desktop fresh `100`, TBT `0ms`, CLS `0`, and `6` requests. The next decision remains whether iframe-based native continuation is acceptable as the first global template pattern or whether section-level native extraction should precede portfolio rollout.

2026-07-10 addendum: the corporate WebOps department repository has been established at `/Users/mark/web-ops` with remote `git@github.com:venterra-realty/web-ops.git`. Initial scaffold commit `48fd3c9` was pushed to `main`, replacing starter content with a corporate-ready WebOps README, charter, project index, Data Pond-readable project registry, governance standards, GitHub review templates, platform lanes, and the first project dossier shell at `projects/resi-portfolio-edge/`. Follow-up commit `11cae66` added the first draft promotion-test package for Resi Portfolio Edge: Worker source snapshot, reviewed Champions Green config example, draft image-generation utility, reviewed Wrangler example, architecture/Data Pond/performance/promotion docs, and validation checklists. A separate clean local Web Operations lab now exists at `/Users/mark/Web_Operations`; it is seeded from the reviewed corporate package and adds local lab operating docs, promotion-packet workspace, evidence/intake/archive directories, a draft dev container scaffold, and `make validate`. The lab now also has required project-memory, project re-entry, detailed session-record, and capability-awareness standards under `/Users/mark/Web_Operations/standards/memory-and-capabilities/`, a machine-readable `capability-index.json`, and the first Resi Portfolio Edge memory dossier, re-entry pack, and detailed session archive under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/`. The re-entry pack requires `START_HERE.md`, `CURRENT_STATE.json`, `LAST_SESSION.md`, `ONBOARDING_PATH.md`, `WORKING_COMMANDS.md`, and `SYSTEM_BOUNDARIES.md`, and `make validate` checks the current-state JSON. The detailed session archive at `memory/sessions/` preserves project flow for major turns so future agents can understand not just the file state but why it exists. WebOps now also requires the Daily Start / Daily Close SOP at `/Users/mark/Web_Operations/standards/memory-and-capabilities/DAILY_START_CLOSE_SOP.md`, so active work begins with current project state, open threads, capability links, boundaries, working commands, and targeted governing docs when the lane calls for them. A selective intake process now governs movement from `Property_Analytics` to `Web_Operations`; the first intake plan/candidate inventory lives at `/Users/mark/Web_Operations/intake/from-property-analytics/`, and the Resi Portfolio Edge queue lives at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/PROMOTION_QUEUE.md`. Resi Portfolio Edge now has the first externalized Data Pond-shaped property packet at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/properties/GA4CG.edge-config.json`; the project validator projects it into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/property-config.draft.js`, and the Worker imports that generated module rather than owning inline Champions Green facts. The lab Worker has also been split into a composition entry, reusable draft runtime, and generated property config, with a local runtime smoke test for health, manifest, mocked R2 passthrough, property-scoped cache keys, preview cache bypass, promo-off rendering, and required-field validation. This establishes the working split: `Property_Analytics` is the historical workshop/source context, `Web_Operations` is the clean lab and containerization layer, and `web-ops` is the governed corporate shelf for reviewed, relevant, working WebOps content. Promotion into `web-ops` should be selective, documented, validated, and free of secrets, personal content, scratch artifacts, raw sensitive exports, raw evidence dumps, and live deploy credential/config details. WebOps department scope covers Captains, Data Pond, Edge, Cloudflare/R2, Content Operations, Performance Optimization, Monitoring, and Governance.

2026-07-11 addendum: Resi Portfolio Edge now has the durable HTML-capture template architecture accepted in the WebOps lab. The ADR at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/docs/adr/2026-07-11-durable-html-capture-template.md` defines native Resi HTML as the content plane, the feed/Data Pond packet as the control plane, R2/media manifests as the optimized asset plane, and the Worker runtime as the render-decision plane. The first contract set lives at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/data-pond/edge-control-feed.schema.json`, `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/native-html/homepage-capture.schema.json`, and `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/runtime/render-decision.schema.json`, with Champions Green examples and validation wired into `/Users/mark/Web_Operations` `make validate`. The first native homepage extractor now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/capture_homepage.mjs`; it generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-capture.json` from the live Champions Green homepage, and validation now checks the generated capture packet. The first render-decision generator now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/runtime/generate_render_decision.mjs`; it generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/decisions/GA4CG.render-decision.json`, and validation now checks the generated decision packet. Global desktop/mobile base templates now live under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/templates/resi-original-yootheme-v1/`, while property-specific GA4CG bindings live under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/template-instances/`. Validation enforces that global templates contain no property id and that desktop promo includes the image while mobile promo is content-only. The active gated hybrid Worker path now consumes the selected template instance for promo, header, hero, welcome, and features content, and runtime smoke verifies captured native rating/copy, desktop promo image rendering, mobile promo image hiding, promo-off behavior, and manifest exposure of both template instance ids. The WebOps lab now also has Wrangler, Playwright, Lighthouse, axe-core Playwright integration, and image/screenshot support installed through `/Users/mark/Web_Operations/package.json`. `npm run visual:resi-edge` runs `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/visual/check_hybrid_shell.mjs`, producing desktop/mobile screenshots and JSON evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/visual-2026-07-11-template-runtime/`; the current proof passes shell rendering, review-link, promo overlay no-push, desktop promo image, mobile content-only promo, image-loading, and shell accessibility checks. The live gated Champions Green path has now been rebuilt as `performance-hybrid-shell` and deployed with lazy/native continuation as Worker version `359080ad-7757-4964-bf49-4977a9ba9909`, with health reporting template/schema version `2026-07-11.performance-hybrid-shell-v2-lazy-native`. The initial gated document has no native iframe `src` and no `/wp-content/`; desktop and mobile interaction proof under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-lazy-native-v2-screens/` shows the native continuation loading only after intent. PageSpeed evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260711-lazy-native-v2/` scored `100` on mobile/desktop exact/fresh runs, and the WebOps lab now has `tools/performance/run_pagespeed_checks.mjs`, `npm run pagespeed:resi-edge`, and `make pagespeed-resi-edge` with retry handling for transient PSI service errors. The next implementation step is a reviewed promotion packet and a decision on iframe continuation versus section-level native extraction before portfolio rollout.

2026-07-10 addendum: Champion's Green was corrected back to the agreed hybrid native-rest architecture. Worker `portfolio-resi-edge-prototype` version `d85f1236-cbeb-4e2d-9040-0b28d5a4ddba` remains query-gated at `https://championsgreen-ga.com/?edge_preview=1`; ungated traffic remains native. The Worker now strips edge-only params before fetching origin, injects only the promo/header/hero/welcome/features shell, hides duplicated native top sections, and leaves real native reviews/amenities/benefits/neighborhood/footer in the same document. The promo module is optional via `PROPERTY.promoEnabled` and now behaves like the native popdown overlay with image/content and no layout push. This supersedes the full-page cloned shell as the active template direction.

2026-07-10 addendum: after visual review, the Champion's Green edge shell was rebuilt from a speed-only shell into the canonical Resi original-template layout shell. Worker `portfolio-resi-edge-prototype` version `a6433f54-a0ac-4f3b-a9fe-7773800f35ea` remains query-gated at `https://championsgreen-ga.com/?edge_preview=1`; ungated traffic remains native Kinsta/Resi. Template version `2026-07-10.all-device-shell-v3` follows the actual page order: promo/header, hero, welcome, apartment features, resident review, amenities, benefits, neighborhood, care band, and final floor-plan CTA. It fixes the LBLE SVG hero overlap, removes the native iframe rest-loader that exposed the Resi firewall block, and establishes the scalable model that original-template Resi sites share one layout while only property content/assets change through the manifest. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-visual-v3-final/VISUAL_V3_READOUT.md`; desktop and mobile exact/fresh PSI smoke all scored `100` with TBT `0ms` and CLS `0.000`.

2026-07-10 addendum: Pilot comparison confirmed the Portfolio Resi Edge high-score path is the static shell architecture, not a native desktop guard. Champion's Green / `GA4CG` now serves the Pilot-matched standalone shell for both desktop and mobile on the gated homepage only (`https://championsgreen-ga.com/?edge_preview=1`), while ungated traffic remains native Kinsta/Resi. Current Worker `portfolio-resi-edge-prototype` version `61ec7685-76c8-431c-b373-2cae87e35d11` uses template version `2026-07-10.all-device-shell-v1` and cache version `2026-07-10-all-device-shell-v1`; `/health` reports `config.ok: true`. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-pilot-shell-desktop-v1/PILOT_SHELL_READOUT.md`; desktop PSI scored `100` on 4/4 exact/fresh runs with median LCP `622ms`, TBT `0ms`, CLS `0.000`, and `6` requests, and mobile confirmation scored exact/fresh `100`. This all-device edge shell should be the manifest-driven portfolio template direction; the native desktop guard experiments should remain diagnostic history.

2026-07-10 addendum: Champion's Green / `GA4CG` now has the first polished query-gated mobile shell candidate for the Portfolio Resi Edge Stabilization lane. The Worker at `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/` is routed to `championsgreen-ga.com/*`, but activation remains gated by `?edge_preview=1`; ungated traffic remains native Kinsta/Resi. Polished v8 (`1cd224d8-2e57-48b5-bdba-777e8f0763f0`) adds `/health` template config validation, fixes missing CTA/badge fields and badge sizing, verifies the required analytics queue events, and keeps the route rollback to `EDGE_SHELL_ENABLED=false` plus redeploy. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-polished-v7/POLISHED_V8_READOUT.md`; mobile PSI smoke scored exact `99` and fresh `100` with LCP `1877ms`, TBT `0ms`, CLS `0.000`, and `6` requests. This should be extended into a manifest-driven portfolio template rather than copied as per-property one-off Worker code.

2026-07-09 addendum: a draft Portfolio Resi Edge Stabilization lane has been seeded for the 85 new original-template Resi sites plus the 5 Pilot sites. The SOP at `/Users/mark/Property_Analytics/docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md` defines Cloudflare/R2/Data Pond responsibilities: Data Pond and governed property identity supply property facts and source image inventory, R2 stores optimized derivatives, Cloudflare applies manifest-driven mobile shell/topper, image rewrites, promo ownership, cache separation, and script/layout guardrails, while individual Resi sites remain the content source of record. Champion's Green / `GA4CG` is the first original-template setup subject through `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/champions-green-ga4cg.manifest.json` and the baseline packet under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-09/championsgreen-baseline/`. Champion's Green q64 derivatives are uploaded to remote R2 bucket `resi-edge-assets`, and a preview-only Worker now exists at `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/`; local Wrangler preview renders the shell from R2 with no live route, and remote workers.dev preview is deployed at `https://portfolio-resi-edge-prototype.mlaufhutte.workers.dev/` with no custom-domain route. No live traffic changes were made in this setup pass.

2026-07-01 addendum: the active Pond/Watchtower freshness model now treats SEMRush as a sunset historical source, not a live stale source. GBP review source mirroring was repaired by adding a portfolio-wide D1 mirror script, wiring it into the daily mirror, and backfilling remote D1 to the canonical local `gbp_reviews` coverage (`24,493` rows across `91` properties, latest `2026-06-02`). Recent all-skipped GBP review collection runs now record `source_limited` rather than false `completed`, and Watchtower/alerting classify that state as blocked source pressure. Follow-up review recovery found the source-limited state was not a true no-review condition: the long daily run let the raw v4 review OAuth access token expire before the review phase, and `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` had been flattening `401 UNAUTHENTICATED` into empty results. The collector now refreshes before review requests, retries `401` and transient `429/5xx`, and raises non-200 responses. Canonical local and remote D1 review coverage now match at `25,022` rows across `91` properties with latest `2026-07-01`. ApartmentIQ was also paused pending full-license approval: its active automations are paused, `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml` is disabled, and the lane should remain advisory/skipped until licensed Keeper-backed access is confirmed. Ads and GSC report-source mirroring was also hardened: GSC daily rows and Google Ads campaign/keyword rows are now required D1 mirror steps ahead of PIB/marketing summaries. Live D1 verification after backfill shows `25,729` report-grain GSC rows across `93` communities through `2026-06-28`, `13,860` Ads campaign rows across `88` properties through `2026-06-30`, and `129,181` Ads keyword rows across `88` properties through `2026-06-30`. GSC freshness now reports the same grouped community/date grain the Pond can query, not raw duplicate source rows. Guest-card freshness was corrected to the current Data Warehouse direct table (`guest_card_metrics_dw_direct`) rather than the old CSV-drop table; live D1 now reports `guest_cards` latest `2026-07-01`, `2,024` rows, `92` properties, and future DW direct runs write completed `guest_card` collection bookkeeping. The canonical PIB Conversion Behavior Snapshot now extends its existing portfolio benchmark model from summary tiles into the individual action cards, showing `Portfolio avg: X.X%` for each real event-card metric while keeping rendering in the approved PIB template family. A 2026-07-02 PIB review-card correction also prevents zero-review report windows from rendering as `0.00` average rating; those windows now read as `N/A` with latest all-time review date. Mark approved this output and locked it as PIB v2.2.1 for Pond testing; the Builder generation worker now targets the v2.2.1 generator. The locked v2.2.1 sender now routes delivery through the governed shared AWS SES-backed `utils.email_sender.EmailSender` transport instead of direct Office365 SMTP, preserving the PIB HTML body and property-specific display From name.

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
- a production-oriented Cloudflare cache audit and rollout workflow, now using The Delta Pearland as an APO case study with a live homepage-only cache rule applied and evidence that WP Engine Edge Full Page Cache was the missing upstream control needed to move anonymous HTML from `DYNAMIC` to warm Cloudflare `HIT`
- a growing Data Pond / web app / API platform in `apps/api` and `apps/web`
- a new control-plane visibility layer in The Pond that can surface the broader system landscape instead of only polished end-user product pages
- a Watchtower layer that is starting to translate platform-awareness gaps into explicit canonical next moves instead of only showing descriptive inventory
- a Watchtower control-plane model where node-level surfaces can now carry their own operating guidance instead of only category-level warnings
- a Watchtower remediation model where trust and migration tracks now expose machine-evaluated met/open criteria instead of only descriptive status text
- a Watchtower health route that now degrades safely across partial mirrored schemas, so the control plane stays visible even when optional ops tables are not yet present in a given environment
- a Watchtower Signal Deck visual experiment that gives the operator lane a darker command-surface signature while staying inside the existing `apps/web` Watchtower page and official Venterra palette
- an Intelligence Office / Site Content Creator / VACS planning and early-product layer
- a Content Office workspace that now gives channel distribution work a governed home, with GBP Posts as the first active lane and social/email/video/community channels treated as draft/handoff lanes until integrations are proven
- a Property Narrative Canon strategy layer that repositions VACS as the narrative synthesis system above downstream site rewrites, long-form drafts, GBP/social/email derivatives, FAQ/schema recommendations, Captain/Navigator content actions, and future publishing packages
- a Site Content Creator lane that is now being actively reshaped from a diagnostics-first internal console into a human-first property/page/section editing workbench with a centered page canvas and details-on-demand
- a Site Content Creator lane that now also compensates for imperfect stored crawl sections by normalizing the first critical homepage content blocks directly from live HTML on read, which keeps the editor closer to the actual site structure while broader extraction cleanup continues
- a Site Content Creator lane that now treats the homepage benefits switcher as one screenshot-driven stacked editing surface with three exact variant states, uses explicit API-carried tab labels to preserve `Pet-Friendly Fun`, `High-Tech Living`, and `Live Easy Perks`, removes the duplicated shared tab bar from the visible scene, and expands the hidden pet/tech/perks detail content inline so editors can maintain the full section text without leaving the main canvas
- a full pilot monitoring program with KPI tracker, CWV comparison, exports, and daily roundups
- an EVS / BrowserStack experiential validation system with a governed Pond bridge and explicit mixed human-and-machine lane posture
- a planned Edge Experimentation System that would let Data Pond govern small site-experience tests, Cloudflare Workers execute approved edge rewrites, Zaraz route normalized events, EVS validate selector/rendering proof, and Watchtower monitor guardrails without introducing client-side A/B tooling or shadow CMS behavior
- multiple specialized reporting products: Spotlight, Focus Report, Weekly Progress, Daily Health, Morning Full Report, Paid Media Workbook, Resi diagnostics, site audits, and GSC/PSI snapshots
- a D1 mirror governance layer that now separates core mirror success from advisory mirror degradation, so Captain-source sync flakes can be treated as a narrower mirror warning instead of a blanket D1 failure when core mirrored facts are healthy, with timeout-safe Wrangler subprocess cleanup, advisory-table schema refresh for drift-prone Captain mirror slices, and a narrowed Captain D1 packet that mirrors only the runtime read set instead of oversized global BI payloads
- a search-intelligence governance posture where SEMRush is now in graceful sunset for the daily ops layer and DataForSEO is the active successor for Watchtower/alert freshness coverage, while older SEMRush specialty/history paths remain intact for compatibility until a later cleanup phase
- a Captain active routine governance layer that defines the required property routines for source readiness, property memory, funnel watch, inventory/product watch, channel efficiency, website/content/SEO, competitor watch, reputation/friction, experience validation, and action/proof tracking, with a local Data Pond routine audit that complements the existing remote D1 Captain readiness audit
- a Fleet Scribe and expert-bench governance layer that moves final report creation above individual Captains, using Captain Read, Commodore Review, Fleet Review, targeted expert consultation, and Fleet Scribe publication/archive control so recommendations can be tuned through single specialist adjustment points without mutating approved report formats
- a formal Fleet Scribe office/directive document at `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md` that details each office and current expert-bench directive setting for report publication, source authority, leasing performance, revenue, channels, SEO/content, market intelligence, product readiness, reputation, resident experience, technical validation, seasonality, unit-type fit, elasticity, operational capacity, proof, and peer borrowing
- a reporting-governance posture where Morning Full is the single routine daily summary and specialty pilot summaries are opt-in, so daily communication stays consolidated unless a true failure/recovery path needs its own message
- an executive-deliverable governance rule where an approved report, email, document, deck, spreadsheet, JSON contract, or companion artifact becomes a locked format for that workstream; subsequent work must correct data/source/content inside the approved format rather than substituting a redesigned or adjacent artifact unless Mark explicitly asks for the format change
- a closure/reporting posture where core-closed manual dependencies can now read as a specific advisory condition instead of a vague blocked state, targeted/manual specialty lanes without a scheduled run can surface as idle rather than missing, and successful Cloudflare cache audits now keep advisory findings in notes instead of overloading the failure field
- a now-explicit Cloudflare Zero Trust security architecture direction that pairs Cloudflare as the outer trust boundary with Keeper as the secret authority and app-level roles as the business authorization layer, with live service-token cutover now verified for `platform`, `vacs`, and `evs`, plus Data Pond session bootstrap from Cloudflare Access identity for human browsers, preserved browser handoff across both `app.venterradev.com` and `app.venterraliving.com`, least-privilege auto-provisioning so Zero Trust can act as the primary browser admission gate, and a hardened browser auth substrate that now emits structured Access verification telemetry, can enforce a specific browser-app AUD, distinguishes revoked/expired/unknown session failures, treats malformed magic-link tokens as invalid requests instead of 500s, and uses shared D1-backed auth rate limiting instead of per-isolate Worker memory

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

Operational note added on 2026-05-20:

- The approved `PIB Site Evaluation` standard now lives at `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`.
- Under explicit current-task approval, canonical PIB v2.2.0 now renders that evaluation as an intro block for property-level PIBs when supporting context exists, before the KPI tiles and detailed source sections.
- The intro gathers property-code-resolved DataForSEO keyword/ranking/OnPage/business context, GSC branded-vs-nonbrand query mix, BI box score, Google Ads BI fallback context, availability, PageSpeed, and review evidence into the PIB payload.
- Grand Harbor proof artifact: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/reports/the-cape-at-grand-harbor/2026/2026-05-20__Property-Intelligence-Brief__the-cape-at-grand-harbor__2026-04-20_to_2026-05-19.html`.
- Boundary preserved: this does not create a parallel PIB renderer, sender, app route, or separate report family; it keeps the actual PIB report as the artifact and makes supporting detail follow the executive diagnosis.

Operational note added on 2026-06-29:

- The PIB Builder gained a governed saved-config and schedule control plane inside `apps/api` and `apps/web`.
- D1 persistence now exists for named PIB configs, editable email schedules, and schedule run history through `pib_report_configs`, `pib_report_schedules`, and `pib_report_runs`.
- `/v1/pib-builder` owns the authenticated API contract; `/analysis/pib` is now a UI over that contract rather than browser-local draft storage.
- 2026-06-30 correction: the lightweight Data Pond handoff email was rejected as non-PIB and corrected. The Cloudflare Worker scheduled hook and manual Email Now now send the latest published canonical Outlook PIB HTML artifact from R2 (`pib/reports/<property-slug>/`) through the existing Resend adapter. Runs record `sent`, `failed`, or `blocked`, and missing artifacts block as `canonical_pib_artifact_missing`.
- `/v1/pib-builder/artifacts/latest` serves the same canonical HTML artifact for app display, and `/analysis/pib` opens that artifact for property reports rather than routing to the D1 dashboard-style `/pib/property` view.
- Remaining system gap: on-demand generation from the Pond click path is not fully connected because the approved PIB generator is Python and the live API is a Cloudflare Worker. Future work should add a canonical generation worker/orchestrator that runs the approved PIB report family, publishes the HTML artifact, then lets the Builder send/show that artifact.
- Boundary preserved: no locked PIB generation/rendering/sending files were mutated and no alternate PIB renderer/template/sender was introduced in the Pond apps.

Operational note added on 2026-07-01:

- The Edge Message Toolkit was promoted from the Apex/pilot proof toward a production The Vine Kyle Parkway launch on `thevinekyle.com`.
- The Vine identity was resolved through the governed matrix as `TX4EK` / `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`; the live homepage and `/apartments/` were inspected, and `/apartments/` exposes `All-In Price & Details` buttons suitable for the existing coach-mark pattern.
- The production homepage message is `Join the VIP List` with supporting copy `Receive insider updates, leasing specials, and early access opportunities.` and CTA `Get in the Know!` to `/contact/#contact`.
- The Edge Messages API/admin now separate draft saves from explicit Launch/Pause/Rollback active-config writes in D1. The Worker fallback config is The Vine-specific and disabled by default; launch is a D1 state change, pause/rollback write `enabled:false`, and launch forces production frequency capping.
- Runtime event handling now sends CTA click telemetry to `dataLayer`, direct GA4 `gtag`, and Heap direct-or-queued tracking, while preserving delayed fade-in, countdown/progress, and auto-close behavior.
- The Cloudflare Worker config now uses production Worker name `edge-message-worker` and The Vine route patterns. Keeper-backed deployment succeeded as Worker version `9dc42d2b-bb7b-4232-9fbb-3e58029bfdef`, and remote D1 has active VIP-list config version `4` with `2000ms` intro delay, `600ms` fade-in/fade-out, `7000ms` on-screen countdown, and the grey countdown/progress treatment. Production traffic now passes through the Worker after the `thevinekyle.com` and `www.thevinekyle.com` CNAME records were switched to proxied while preserving Kinsta origin target `thevine.hosting.kinsta.cloud`; live headers confirm Kinsta O2O (`ki-edge-o2o: yes`).
- 2026-07-02 demo note: the original Apex/pilot homepage popup and apartments helper tag were reinstated on `pilot.venterradev.com` through existing Worker `edge-transparent-pricing-intro-beta` version `e446f570-e373-409f-a8fb-446c4866bf59`. Route ownership is now split in source: `wrangler.pilot.toml` deploys `pilot.venterradev.com/*`, while `wrangler.toml` keeps `edge-message-worker` on The Vine. Cache-busted smoke confirmed `edge_transparent_pricing_intro_homepage_v1` on `/` and `edge_message_all_in_pricing_coachmark_v1` on `/apartments/`, with the existing `vtr_edge_sightmap` marker retained on apartments. The follow-up admin deployment `https://7e9eb13d.property-analytics.pages.dev` restores both pilot records as editable cards in `/experiments/edge-messages`.
- 2026-07-02 performance-check note: the pilot Edge Message script load was temporarily paused through Worker env vars in `wrangler.pilot.toml`, deployed as `edge-transparent-pricing-intro-beta` version `0852f99a-d8fe-408c-a58f-8e49d4186b28`. The Worker code now reads `EDGE_MESSAGE_INJECTION_ENABLED` and `EDGE_COACH_MARK_INJECTION_ENABLED` with default-on behavior, so The Vine remains unaffected. Live verification showed `data-edge-message=0` on pilot homepage and apartments while the separate `vtr_edge_sightmap` lazy-load layer stayed active. Local browser comparison reduced HTML weight and one resource/script per page, with modest LCP improvements; quick keyed PSI post-pause runs were noisy (`72`, `61`, `61`) versus the earlier `2026-07-02` daily CSV score of `73`, so no PSI improvement should be claimed from this quick sample.
- 2026-07-03 mobile timing note: after Mark removed two homepage sections, pausing the mobile homepage popup during initial render produced the strongest result (`92` PSI, LCP `2.701s`). A timer-only popup delay POC was then added behind `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS` and `EDGE_MESSAGE_MOBILE_AFTER_LOAD_IDLE_TIMEOUT_MS`. The `3500ms` after-load variant was locally clean but PSI-unstable (`93` once, `70` twice), and the `6500ms` variant did not validate (`70` after two Lighthouse `500`s). The pilot was restored to `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS="0"` in Worker version `da173432-dbd4-4b3c-837d-6f822a892bb4`. Timer-only delay should not be treated as the durable fix; next tests should use interaction/scroll-gated mobile messaging, inline/lower-page messaging, or mobile-homepage suppression while preserving desktop and apartments messaging.
- 2026-07-03 scroll-trigger note: the no-script vs scroll-triggered comparison found that removing the homepage popup script is fastest, but scroll-triggered mobile messaging is close enough to keep as a demo compromise. No homepage popup script scored fresh-query keyed PSI `94` / LCP `2.401s`; scroll-triggered mobile scored `92` / LCP `2.626s` and proved overlay `0` before scroll and visible after scroll to `700px`. Exact clean-URL PSI repeated stale/low cached-looking `67-70` runs across both states, so fresh-query runs are the fair same-session comparison. The live pilot now uses scroll-gated mobile homepage messaging in Worker version `642f82c4-93b0-45a0-828f-cc66c1103d9c`.
- 2026-07-07 stabilization note: the pilot homepage popup is now kept paused for performance testing while apartments coach-mark behavior remains separate. A narrow mobile homepage Resi pixel idle-load POC was added to the same Worker and enabled by `EDGE_HOME_RESI_PIXEL_IDLE_ENABLED="true"` / `EDGE_HOME_RESI_PIXEL_IDLE_DELAY_MS="1750"`, deployed through Keeper-backed Wrangler as `edge-transparent-pricing-intro-beta` version `c14f350f-a310-4d42-9eb7-88c37e9ae4c3`. The POC improved the fresh-query TBT branch versus the immediately prior retry, but did not stabilize the clean exact URL: clean scores remained `70/71/70` with median LCP `4964ms` and TBT `0ms`. Treat this as temporary TBT hygiene only; durable stabilization still belongs in native YOOtheme/source work, especially mobile hero simplification and reducing above-fold UIkit initialization.
- 2026-07-07 query-normalized cache note: Mark's intended Kinsta-as-warmer plus Cloudflare-as-global-cached-shell strategy was tested on Pilot. The Worker homepage HTML cache is enabled with `EDGE_HOME_HTML_CACHE_ENABLED="true"` and cache version `2026-07-07-query-normalized-v1`, deployed as Worker version `19d82787-c011-4458-8a6a-579c6f6fa04f`. Marketing query strings no longer fragment the anonymous homepage HTML cache key; DNI/tracking can still run after load from `location.search`. Preview/editor/search/admin params and logged-in/session cookies bypass cache. Verification showed mobile and desktop clean/query variants HIT the edge cache after warmup, while `?preview=true` bypassed. PSI root document response is fast (`10-30ms`), query-string median scored `90`, and clean exact still stayed low (`71/71/71`), so cache delivery is now behaving as designed but the exact-URL Lighthouse paint branch remains a separate issue.
- 2026-07-07 post-vendor validation note: after vendor-reported YOOtheme fixes, Pilot live mobile markup now has the accepted `Apex-West-Midtown-Home-Hero-750.webp` with explicit eager loading, high fetch priority, dimensions, and no homepage slideshow marker. The explicit eager attribute was added in the Edge Worker and deployed as version `0a719df4-43b2-4c38-b52c-e16fc7152005`, with the homepage HTML cache version bumped to `2026-07-07-hero-eager-v1`. Playwright mobile showed strong real-browser medians (`462ms` clean LCP/FCP and `422ms` query LCP/FCP), but PSI still had a lab variance branch: exact clean scores `89/89/71`, fresh/query one successful `89` plus two Google Lighthouse `500`s. Accessibility validation found `/reviews/` and `/contact/` social/map icon labels fixed, but homepage header/footer social/map icon copies still lack accessible names. Slideshow validation found `/apartments/` still contains one-image floor-plan card slideshow structures while homepage and the sampled content pages do not. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/POST_VENDOR_UPDATE_VALIDATION_READOUT.md`.
- 2026-07-07 PSI mock variant note: the Pilot Worker now has query-gated diagnostic variants behind `psi_mock` for homepage source-change simulation, with isolated Cloudflare HTML cache keys so mock HTML does not pollute the normal homepage cache. Worker version `73a91ac5-647f-4b12-b53f-949646937063` supports `no_dropbar`, `no_sticky_header`, `fixed_hero_height`, `no_welcome_scrollspy`, `static_review`, and `all`. Playwright cached mobile runs showed baseline median LCP `480ms`, core mock `532ms`, and all mock `568ms`; PSI mobile showed baseline median score/LCP `92` / `2627ms`, core mock `87` / `2401ms`, and all mock `75` / `4957ms`. Conclusion: remove the inactive homepage dropbar/promo first and retest; do not broadly disable all UIkit behavior or the review slider based on this sample. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/PSI_MOCK_VARIANTS_READOUT.md`.
- 2026-07-08 hero viewport-height stabilization note: after builder inspection showed the remaining YOOtheme `uk-height-viewport="offset-top: true;"` came from an internal hero panel wrapper rather than an exposed admin control, the successful diagnostic mock was promoted to a guarded mobile-only Pilot homepage Worker path. `EDGE_HERO_VIEWPORT_HEIGHT_REMOVAL_ENABLED="true"` removes the wrapper attribute, marks the panel, and injects a stable mobile `min-height:718px` rule; `EDGE_HOME_HTML_CACHE_VERSION` is now `2026-07-08-hero-viewport-removal-v2`. Keeper-backed deploy published `edge-transparent-pricing-intro-beta` version `092e43d1-e5e8-4748-8507-13069f3d8490`, keeping homepage Edge Messaging paused and apartments coach-mark behavior unchanged. Attribute-removal-only v1 did not stabilize PSI (`84/77/76`), but the corrected v2 warmed-cache packet scored `94/94/94` with median LCP `2552ms`, FCP `1969ms`, TBT `0ms`, CLS `0.00712`, `31` requests, and `0` Heap/Contentsquare requests. Treat this as a guarded Pilot stabilization proof and keep cache warmup as part of any post-deploy/cache-version PSI judgment.

- The July Spotlight property master roster was activated from Mark's screenshot through the governed monthly config path.
- The active July config lives at `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-07.json`, with companion source/import files `July_2026_Spotlight_Properties.csv` and `monthly_import_names_2026-07.csv`.
- The July set is Cendana, Elation, Retreat, Canton Mill Lofts, Clearwater Heights, College View, Gateway North, Luminary, Silverbrooke, Baywood, Shadowbrooke, St Andrews, and Westover. Cendana, Elation, and Retreat are marked `Critical`; the rest are `Spotlight`.
- Copy Change Impact Brief daily scope now follows the active Spotlight roster plus explicitly retained action exceptions, so historical copy interventions remain in storage without overcrowding the daily executive report.

Operational note added on 2026-06-01:

- The June Spotlight property list was refreshed from `/Users/mark/Downloads/June Properties.xlsx`; correction after workbook tab review: the authoritative June roster is the property-tab roster, not the shorter funnel-summary selection rows.
- The active June config lives at `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-06.json`, with companion source/import files `June_2026_Spotlight_Properties.csv` and `monthly_import_names_2026-06.csv`.
- The June set is Canton Mill Lofts, College View, Elation, Forest View, Gateway North, Grand Harbor, Lakeland, Luminary, Maddox, Retreat, and Town Station. College View, Forest View, and Gateway North are marked `Critical`; the rest are `Spotlight`.
- The Spotlight Performance Roundup now reads the latest monthly Spotlight config instead of a hardcoded Spotlight 11 list, keeping the approved PSI-first report shell while allowing monthly set rotation through the governed config path.
- The Pond Spotlight helper now reflects the corrected 11-property June tab order, and the legacy Spotlight registry falls back to the governed property identity matrix for GA4-backed properties that are absent from its older local registry.
- The prior June Captain roster activation was generated and applied remotely through the existing Keeper/KSM-backed Wrangler helper for the shorter `8` property extraction and `88` support-agent rows; rerun from the corrected 11-property config before treating Captain roster scope as current. `scripts/standup_captain_roster.py` now uses a dynamic activation timestamp instead of the stale May 4 value.

Operational note added on 2026-06-03:

- The repo now has a shared local Keeper runtime bootstrap for recurring automation at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh`, plus a matching Node self-bootstrap helper at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs`.
- The governed Data Warehouse Node entrypoints and readiness probe now use that helper to verify Keeper/KSM readiness and re-exec through the bootstrap shell when the parent process lacks the needed runtime envelope, instead of failing immediately on a fresh shell.
- 2026-06-10 follow-up: the governed outer wrapper `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh` now logs before preflight, uses `node scripts/check_data_warehouse_keeper_ready.mjs` as the authoritative Keeper gate for this lane, and adds a dedicated connectivity preflight `/Users/mark/Property_Analytics/scripts/check_data_warehouse_connectivity.mjs` inside a bounded wait loop. Recurring runs therefore record the actual notation-based warehouse readiness result, classify DNS/TCP failures as sanitized VPN/network issues, and wait for the warehouse host to become reachable instead of failing the full workflow immediately on the first transient miss.
- Existing recurring shell wrappers `run_daily_health_report.sh`, `run_collection_retry_cycle.sh`, `run_apartmentiq_daily_light.sh`, and `run_apartmentiq_weekly_dive.sh` were also moved onto the shared bootstrap helper so Keeper runtime assumptions stop drifting across wrappers.
- Verification from the previously failing fresh shell context on `2026-06-03` succeeded: `node scripts/check_data_warehouse_keeper_ready.mjs` returned `OK`, and the governed seven-step Data Warehouse workflow completed end-to-end with packet roots under `/Users/mark/Property_Analytics/outputs/data_warehouse/` and `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/`.

Operational note added on 2026-06-10:

- Venterra Clearwater was seeded as the named premium glass UI direction for Data Pond web surfaces, extending the official Venterra brand color standard instead of creating another ad hoc visual language.
- The governing standard is `/Users/mark/Property_Analytics/docs/VENTERRA_CLEARWATER_UI_STANDARD_2026-06-10.md`.
- Shared opt-in primitives and tokens now live in `/Users/mark/Property_Analytics/apps/web/src/components/shared/clearwater-glass.tsx`, `/Users/mark/Property_Analytics/apps/web/src/app/globals.css`, and `/Users/mark/Property_Analytics/apps/web/tailwind.config.ts`.
- The first proof surface is the shared Pond landing page at `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx`, covering both `/` and `/pond`.
- The proof was deployed through the Keeper/KSM-backed Wrangler path from an isolated clean deploy worktree to Cloudflare Pages project `property-analytics`, branch `main`; the corrected glass deployment is `https://9b1073ce.property-analytics.pages.dev`, with `https://app.venterradev.com/pond` still protected by Cloudflare Access.
- Visual correction note: the first live pass used the right structural system but read as opaque blue panels. The corrected pass reduced card opacity, strengthened `backdrop-filter` blur/saturation/contrast, added clearer bevel highlights, and made the underlying official-palette gradients more visible so the glass has an environment to refract.
- Second visual correction note: the current visible-glass deployment is `https://3c9626dd.property-analytics.pages.dev`. Zone cards now remove their own blue gradient fill, rely on `clearwater-lane-field` behind the cards for environmental color, use `clearwater-lens-card` near-transparent fill, and avoid the previous reduced-transparency path that could make Clearwater panels opaque.
- Restraint correction note: the current preferred deployment is now `https://29bddb6b.property-analytics.pages.dev`. The prior visible-glass pass overcorrected into neon/blue acrylic, so the fourth pass follows the Clay glassmorphism guidance more closely: moderate blur, selective glass surfaces, a dark contrast floor, and non-blur repeated data tiles.
- Tightening note: the current preferred deployment is now `https://69d8ebd1.property-analytics.pages.dev`. This pass keeps the restrained direction but lowers border/highlight intensity, reduces background wash, darkens the lens cards, and treats the PIB shortcut as a utility data card rather than another large glass banner.
- Watchtower Signal Deck note: `/watchtower` now carries a scoped experimental command-deck treatment using `watchtower-stage`, `watchtower-signal-shell`, `watchtower-panel`, `watchtower-rail-card`, `watchtower-horizon`, and `watchtower-signal-node` utilities in `/Users/mark/Property_Analytics/apps/web/src/app/globals.css`. The pass was locally rendered with sanitized mock health/landscape payloads, deployed through the Keeper/KSM-backed Wrangler path, and is live at `https://0bbe7ad5.property-analytics.pages.dev/watchtower`; the custom domain route remains Cloudflare Access-protected.
- Locked PIB generation/rendering paths were not touched; this is a platform UI system slice, not a PIB artifact-format change.

Operational note added on 2026-06-19:

- GTmetrix remains an API-backed Data Collection / pilot CWV source route rather than a production MCP-backed collector. The canonical collector at `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` now resolves its API key through the shared Python Keeper/KSM helper first, using the governed MarketingOps GTmetrix notation default and honoring the legacy GTmetrix notation env var during migration.
- Existing API behavior remains intact: report polling, rate-limit header capture, pilot/control retry handling, credit guarding, DB writes, and same-day freshness validation still live in the current collector and pilot workflow.
- Transitional fallback remains limited to the direct `GTMETRIX_API_KEY` env var and the existing configured local key path. No new local credential file, `.env`, checked-in secret, MCP dependency, or alternate GTmetrix runner was introduced.

Operational note added on 2026-06-30:

- The PIB Builder/Data Pond path has been reconciled back to the approved canonical PIB artifact family. Builder emails and app opens now use the latest published Outlook-safe PIB HTML artifact from R2 rather than a Data Pond summary email or dashboard substitute.
- The implementation is orchestration-only: locked PIB generator/template/sender files were not changed. The new D1 `pib_report_generation_jobs` table and `/v1/pib-builder/.../generation-jobs` endpoints queue property-level canonical generation when an artifact is missing.
- `/Users/mark/Property_Analytics/scripts/process_pib_builder_generation_jobs.py` is the worker bridge between the Pond and the approved Python generator. It resolves Cloudflare auth through the existing Keeper/KSM Wrangler helper, runs the v2.2.0 generator, uploads the generated HTML to `pib/reports/<property-slug>/`, and updates the job record for the Builder to send/open. The launchd agent `/Users/mark/Property_Analytics/ops/launchd/com.venterra.pib-builder-generation-worker.plist` is installed at `/Users/mark/Library/LaunchAgents/com.venterra.pib-builder-generation-worker.plist` and runs up to `3` queued jobs every `60` seconds.
- The Builder UI now follows a progressive request flow: property/date first, report-area metrics second, then output choice. Email/Open are the only initial output choices, neither is preselected, email recipients are revealed only after Email Now, and report naming/scheduling controls appear above the generated report preview after the report is produced.
- Generated artifacts now have a D1 chunk fallback. The worker writes generated HTML into `pib_report_generation_artifact_chunks` before marking a job succeeded, and the API reassembles those chunks if R2 lookup misses. This was added after remote R2 object writes returned `403` for the current Cloudflare token while the report had actually generated locally.
- The first live deployment of this reconciliation is API Worker `06349865-b134-4715-98e2-4df4fe9f3540` plus Pages deployment `https://53fc750d.property-analytics.pages.dev`.

Operational note added on 2026-07-01:

- The PIB Builder generated-artifact fallback was hotfixed after a live Canton Mill Lofts request generated approved PIB HTML into D1 chunks but stayed blocked in the UI. The API now discovers succeeded generation jobs with chunked artifacts even when `artifact_html` is empty.
- The Builder UI now shows a build progress meter across queued, building, publishing, sending/opening, and complete states for on-demand Email Now/Open Report Now actions.
- Live hotfix deployment: API Worker `68141e2c-2e16-48e7-914c-592cb429deb4` and Pages `https://3397607c.property-analytics.pages.dev`.
- Follow-up Pages deployment `https://5f2ae45f.property-analytics.pages.dev` merged the newer Edge Messages state with the PIB Builder progress fix and redirects `/pib` to `/analysis/pib` so the legacy Build Context panel no longer appears as the Builder entry point.
- Boundary preserved: no locked PIB generator/template/sender files were modified, and no alternate PIB renderer was added to the Pond apps.

Operational note added on 2026-06-22:

- The Marketing Ops shared credential import lane remains the existing Keeper Commander utility `/Users/mark/Property_Analytics/keeper_marketing_ops_import.py`; it now has a governed legacy workbook mode for `/Users/mark/Downloads/Venterra Marketing Log ins.xlsx` rather than a separate spreadsheet converter or local secret store.
- `--venterra-marketing-logins-workbook` reads the known multi-sheet workbook shape and preserves source sheet/row provenance as Keeper custom fields. `--include-reference-records` can include URL-only reference sheets, and `--allow-blank-passwords` is an explicit complete-archive choice for source rows missing passwords.
- Dry-run proof passed without printing or persisting raw secrets: `191` credential-style records were ready, or `388` records when reference URLs were included. After Mark completed Keeper Commander SSO/device approval locally, the 191 credential-style records were imported into `Marketing Ops Shared Credentials` for team `Marketing Ops`; URL-only reference rows were intentionally not included. KSM is present for runtime secret reads, but Keeper Commander remains the shared-folder record creation/import path.

Operational note added on 2026-06-23:

- A narrow Keeper main-tree cleanup utility now lives at `/Users/mark/Property_Analytics/scripts/keeper_remove_email_records.py` for removing visible login/email records matching personal domains (`gmail.com`, `laufhutte.com`) while excluding `Marketing Ops Shared Credentials`.
- The successful human-present cleanup removed `180` matching records from the user's main vault tree using normal Commander remove behavior, not permanent purge. The tool avoids raw password/secret output and requires typed `DELETE N` confirmation.
- Commander persistent-login/device setup was attempted, but one-shot Commander/API calls still hit SSO/runtime policy friction in this environment. Treat future vault mutation work as human-present unless Keeper admin enables Commander Service Mode or a policy-supported non-interactive maintenance path.

Operational note added on 2026-06-25:

- The preliminary Ad Hoc Executive Report System is now the governed path for Outlook-safe PIB-style specialty reports that do not belong to a locked PIB family. The CLI front door is `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`; orchestration is `/Users/mark/Property_Analytics/utils/adhoc_report_orchestrator.py`; source routing is `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`; rendering is `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`; validation is `/Users/mark/Property_Analytics/utils/outlook_email_validator.py` and `/Users/mark/Property_Analytics/scripts/check_outlook_email_safety.py`; and delivery continues through `/Users/mark/Property_Analytics/utils/email_sender.py`. Every run writes the future Pond handoff packet under `/Users/mark/Property_Analytics/reports/adhoc_executive/<report_type>/<run_id>/` with request, spec, HTML, workbook, validation, delivery, and source artifacts. Current report types are `organic_search_share` and `ga4_traffic_summary`. This should be extended into Pond as a UI over the same engine rather than rebuilt as a web-only generator.

Operational note added on 2026-06-16:

- The Vine Kyle Parkway was corrected from prelaunch/non-live to live pre-lease after Mark confirmed the live-site stage and property code `TX4EK`.
- Governed identity inputs now resolve The Vine through `TX4EK`, GA4 `505234023`, community id `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`, website `https://thevinekyle.com/`, and GSC `sc-domain:thevinekyle.com`.
- The official registry row now uses `lifecycle: live` and `operational_status: pre_lease`, which avoids the existing prelaunch suppression tokens while preserving the lease-up business context.
- The Vine's P&A page is `https://thevinekyle.com/apartments/`; this path is now seeded in registry `known_page_paths` so future GSC URL Inspection samples include the actual P&A page. Direct GSC inspection on 2026-06-16 returned `URL is unknown to Google` for `/apartments/`.
- `TX4EK` was removed from the Data Warehouse expected pre-live lifecycle gap list. This closes the earlier local identity gap for The Vine; Sundara / `TX4CY` remains the governed pre-live exception.
- Boundary preserved: this extends the existing property registry, property identity matrix, and canonical GSC collection/URL Inspection lanes. No PIB files, alternate renderers, or downstream one-off property maps were added.

Operational note added on 2026-06-04:

- The shared Keeper shell bootstrap was hardened after a real ApartmentIQ daily-light failure showed the prior helper was not actually making runtime identity stable; it only filled `HOME` / `USER` / `LOGNAME` when unset, so a bad inherited `HOME` still broke `ksm` profile resolution.
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` now forces `HOME=/Users/mark`, `USER=mark`, and `LOGNAME=mark`, exports `KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION` in addition to the ApartmentIQ API-key notation, and provides `pa_require_marketingops_keeper_ready` so recurring shell wrappers can fail at the Keeper boundary instead of cascading into downstream Python stack traces.
- The four wrappers already standardized on the shared shell bootstrap now call that readiness gate:
  - `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh`
  - `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh`
  - `/Users/mark/Property_Analytics/run_daily_health_report.sh`
  - `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs` was aligned to the same stable runtime envelope so the shared Node Keeper helper and the shared shell Keeper helper no longer disagree about base process identity.
- ApartmentIQ Keeper config drift was removed by aligning `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py` to the documented default `ApartmentIQ API` record notation (`keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password`) instead of a stale alternate default.
- Verification included a forced bad-`HOME` repro that now resolves ApartmentIQ credentials successfully, `node scripts/check_data_warehouse_keeper_ready.mjs` still returning `OK`, and a live smoke `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh` that completed on `2026-06-04` with `1` account, `1` sampled comp set, `11` market-survey rows written, and fresh ApartmentIQ summary artifacts under `/Users/mark/Property_Analytics/reports/apartmentiq/2026-06-04/`.

Operational note added on 2026-06-05:

- Keeper bootstrap reliability was pushed one layer deeper into the Python credential surface after another ApartmentIQ retry exposed that wrapper-level stabilization alone was not enough when a script resolved Keeper-backed credentials directly.
- `/Users/mark/Property_Analytics/utils/ksm.py` now centralizes the governed Python-side Keeper runtime: it forces the same MarketingOps identity/path envelope as the shell helper, probes the `marketingops` profile before notation reads, retries `ksm profile active`, and finally attempts `ksm profile init -p marketingops` from the existing local bootstrap token files before failing.
- `/Users/mark/Property_Analytics/ops/cloudflare/cloudflare_auth.py` and `/Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py` no longer maintain their own direct `ksm` subprocess logic; both now resolve through the shared `utils.ksm` helper and include canonical default Keeper notations so stripped Python processes do not depend on wrapper-exported notation env vars.
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` now exports `PA_KEEPER_RUNTIME_READY` only after a successful probe instead of assuming readiness immediately after attempted repair.
- Verification from intentionally bad fresh-shell state (`HOME=/tmp`, empty env except minimal PATH) succeeded for ApartmentIQ, Cloudflare, BrowserStack, and DataForSEO Python credential reads, and wrapper/runtime smoke still passed for `node scripts/check_data_warehouse_keeper_ready.mjs`, `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh`, and `APARTMENTIQ_WEEKLY_MAX_COMP_SETS=1 ./run_apartmentiq_weekly_dive.sh`.

Operational note added on 2026-05-28:

- A new nested local source workbench for Resi Archetype was seeded at `/Users/mark/Property_Analytics/resi_archetype_site` from Keeper-backed SFTP access. The remote account is SFTP-only; SSH command execution is disabled.
- Remote exploration confirmed a WordPress `/public` web root with `resi-child-theme`, YOOtheme, Resi custom plugins, Kinsta mu-plugins, uploads, and a separate `mysqleditor` directory.
- The local project intentionally excludes live `wp-config.php`, uploads, backups, SQL exports, and database material. The committed source snapshot focuses on Resi/YOO element code needed for unit, floor-plan, filter, fee, application, and related Cloudflare pilot diagnostics.
- A hard-coded GitHub updater token was found in the downloaded `resi-elements-venterra` plugin and redacted in the local workbench to read from `RESI_ELEMENTS_VENTERRA_GITHUB_TOKEN`; the live/source-side token should be rotated and represented in Keeper before any deployment workflow uses it.
- YOOtheme and YOO Essentials were inventoried but not fully mirrored because their vendor payloads are large over SFTP. Treat them as install/copy dependencies for specific reproductions rather than as primary evidence in this local git snapshot.
- A performance-first Resi diagnosis was added at `/Users/mark/Property_Analytics/resi_archetype_site/docs/PERFORMANCE_FIRST_DIAGNOSIS_2026-05-28.md` after the user supplied a homepage waterfall. The main finding is late LCP discovery: the homepage hero is delivered as a UIkit `data-src` background instead of an early image/preload, while `/apartments/` is dominated by a large `1.19 MB` first document and `94` DAM floor-plan images.
- The Cloudflare Worker at `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now contains a disabled edge performance layer for exact paths `/` and `/apartments/`: DAM/Resi preconnects, homepage hero preload, UIkit hero background discovery rewrite, apartment DAM image priority/lazy hints, and `Server-Timing: vtr_edge_perf` verification. The live 2026-05-28 deploy used the Keeper/KSM-backed Wrangler path and produced Worker version `4a7fa0ee-ab6a-407c-8427-694cf693f93e`, then was disabled after a live GTMetrix score regression signal with rollback version `9fe6606e-c40e-4318-ada3-e2634c910cb9`. The Worker was paused into pass-through mode for edge messages, coach marks, and performance rewrites as version `caba5935-ec78-4e2f-bdee-23a099106cb4`, then a header-only hero preload test version `45b31461-f2b0-4059-9e1d-bac24dc1666b` was tested and rolled back after worse homepage PSI/LCP medians. Current pass-through version is `542b75ca-3977-4130-a04a-6d731f70d255`. A Zaraz-only Cloudflare Configuration Rule experiment disabled Zaraz on `pilot.venterradev.com` while Cloudflare Web Analytics stayed enabled; three-run PSI medians worsened on mobile, so the temporary rule was removed and Zaraz was verified restored. A Cloudflare Web Analytics / RUM-only Configuration Rule experiment then removed `static.cloudflareinsights.com/beacon.min.js` while Zaraz, GA4/Ahrefs, and Resi pixel stayed enabled; it reduced requests and bytes but produced mixed PSI medians, so the temporary rule was removed and RUM was verified restored. An IE11-only Worker experiment removed `/wp-content/plugins/resi-elements/assets/ie-11.js` from `/` and `/apartments/`; it removed one request and modestly improved apartments mobile while worsening apartments desktop, so Worker version `da567516-6085-4585-8da2-936c1168300b` restored `ie-11.js` and the rewrite remains disabled. The first kept performance win is Worker version `17944c96-a290-4853-962a-61762dd455e0`, which lazy-loads the `/apartments/` SightMap iframe and API on map interaction/viewport approach; functional smoke passed and PSI medians improved apartments mobile `57 -> 74` and desktop `75 -> 99`. A homepage hero inline-background test version `dade5885-9bbd-44f6-b067-d719be001c9f` removed UIkit `data-src` / `uk-img` without preload but worsened homepage mobile LCP `3826ms -> 6592ms`; Worker version `63ebf1cd-80b6-4525-940d-e9bdaf2d063c` rolled back the hero rewrite while keeping SightMap lazy-load live. Artifacts are stored under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-05-28/`.
- 2026-07-03 update: after YOOtheme rendered the hero as a real `picture/img` but exposed `sizes="(max-aspect-ratio: 3840/2160) 178vh"`, mobile Lighthouse selected an oversized `3840w` WebP. The pilot Worker now has a temporary mobile-only homepage source rewrite, enabled only by `EDGE_HERO_MOBILE_IMAGE_ENABLED` in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml`, while pilot Edge Message and coach-mark injection remain paused. Worker version `a3b58beb-37d7-454d-94c0-457e40e24385` rewrites mobile hero HTML to the supplied `1200 x 1600` WebP with `sizes="100vw"` and `Server-Timing: vtr_edge_hero_mobile`; desktop remains unchanged. The POC reduced mobile transfer and PSI byte weight but only produced keyed PSI mobile score `64`; a controlled Keeper-backed GTMetrix cross-check scored `96` / structure `98` and did not show material regression versus the prior stored Pilot Master GTMetrix row. The next visible bottleneck is below-fold `Home-Amenities-full.jpg` and `Home-Features-full.jpg` downloads. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_MOBILE_SOURCE_POC_READOUT.md`.
- Follow-up 2026-07-03 update: after optimized same-origin replacements were supplied, the Worker added `EDGE_MOBILE_IMAGE_REPLACEMENTS_ENABLED` for mobile-only homepage swaps of welcome, features, amenities, and pets images. Version `c6248fd6-a435-4091-a704-58e6aaee9886` keeps Edge Message / coach-mark injection paused, keeps desktop unchanged, and serves the reworked `Home-Welcome-1200-1.webp` plus the optimized feature/amenity/pets WebPs on mobile. Keyed PSI mobile recovered to `84` with LCP `3,676ms` and byte weight `892 KiB`; GTMetrix remained stable at score `96` / structure `98`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_V2_READOUT.md`.
- Welcome 850 follow-up: Worker version `815a50dc-62f2-468b-8e45-3142902fdd88` swaps mobile `Home-Welcome-full.jpg` to `Home-Welcome-850.webp` (`137,600` bytes). The best repeat keyed PSI mobile sample scored `88` with LCP `3,376ms` and byte weight `888 KiB`, while GTMetrix scored `97` / structure `98`; one PSI run was a noisy low `67` and one Google repeat returned `500`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_850_READOUT.md`.
- Hero 750 follow-up: Worker version `2c664abf-ca30-4a6d-9521-b0771ae155a8` swaps mobile hero HTML to `Apex-West-Midtown-Home-Hero-750.webp` (`750 x 1001`, `99,668` bytes) while keeping the `850` welcome and other mobile image replacements. The best repeated keyed PSI mobile sample scored `90` with LCP `3,076ms` and byte weight `827 KiB`; GTMetrix cross-check scored `92` / structure `98`, so visual QA and possibly a `900-1000px` hero fallback remain prudent before source-side adoption. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_750_WELCOME_850_READOUT.md`.
- Content image 750 rejection: Worker version `e780f935-c9fd-443e-9dbe-b5a8b9601920` tested `Home-Amenities-750.webp` and `Home-Features-750.webp`; payload dropped but PSI worsened to `60` / `69`, so version `9454ba45-4db7-4064-8a5a-6313ea007382` restored the prior best image mix. Note: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/CONTENT_750_REJECTION_NOTE.md`.
- Real demo-state proof: Worker version `3025c872-a800-4d49-b4fa-1f127094913b` re-enabled pilot Edge Message and coach-mark injection while keeping the accepted image mix. Verification showed homepage popup and image markers plus apartments coach-mark/SightMap lazy-load; repeat PSI mobile scored `89` and GTMetrix scored `95` / structure `98`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/DEMO_STATE_IMAGE_OPTIMIZED_READOUT.md`.
- Homepage HTML cache POC: a narrow anonymous Worker HTML cache for exact `https://pilot.venterradev.com/` was tested behind `EDGE_HOME_HTML_CACHE_ENABLED`. It improved local TTFB (`186ms -> 107ms`) and local mobile LCP (`492ms -> 468ms`), but keyed PSI mobile stayed low across three runs (`66`, `67`, `67`, LCP about `5.5s`) even though raw PSI confirmed the accepted hero remained eager, initially discoverable, and `fetchpriority="high"`; GTMetrix scored `97` / structure `98`. The live pilot was rolled back to Worker version `963e1afb-3f91-4731-ae47-9f644fa44efd` with `EDGE_HOME_HTML_CACHE_ENABLED="false"` while preserving demo messaging and image replacements. Post-rollback headers show the custom cache marker absent and Kinsta edge HTML cache active (`ki-cache-type: Edge`, `ki-cf-cache-status: HIT`). Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HOME_HTML_CACHE_POC_READOUT.md`. Do not re-enable custom Worker HTML cache as a PSI fix without a new paint-timing proof.
- Static hero POC: a query-gated mobile-only proof at `https://pilot.venterradev.com/?static_hero_poc=1` removes the first hero slideshow initializer and forces the existing first slide into a static active overlay layout. The normal homepage remains unchanged. The POC proves static layering is visually possible, but keyed PSI mobile got worse: normal scored `89` / LCP `3,077ms`; POC scored `79` / LCP `3,676ms`, then `66` / LCP `5,671ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/static-hero-poc-live/STATIC_HERO_POC_LIVE_READOUT.md`. Do not keep/promote the Worker-forced static hero as a PSI fix; if pursued, it should be a native YOOtheme/source static hero, not override CSS on a former slideshow.

Operational note updated on 2026-05-23:

- Keeper/KSM credential handling is now a repo-level law, not a preference. `/Users/mark/Property_Analytics/AGENTS.md` requires agents to resolve credentials, API tokens, OAuth artifacts, service tokens, and deployment auth through Keeper/KSM helpers, notation env vars, or Keeper-backed file materialization before direct env vars, local credential files, browser login, or manual token paths. For Cloudflare/Wrangler work, `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py` is the governed deployment auth path so `CLOUDFLARE_API_TOKEN` is injected from Keeper. Missing credentials should be added to Keeper and documented in the appropriate manifest rather than worked around locally.
- Official Venterra brand colors are now a governed system-wide design boundary. The source PDF is `/Users/mark/Downloads/New Branding Colors_Named 2.pdf`, the internal standard is `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`, and `/Users/mark/Property_Analytics/AGENTS.md` now instructs future work to use only the active palette unless the user explicitly specifies otherwise. The active palette is Venterra Navy `#15284B`, San Marino `#3D66B9`, Bay `#294782`, Indigo `#5A81CF`, Monte Carlo `#7DCAC2`, Pink `#E02472`, White Smoke `#F6F6F5`, Terra Cotta `#BD4830`, Quill Gray `#D6D6D2`, Blue Chill `#3B9189`, Delta `#9B9B96`, Black `#000000`, and White `#FFFFFF`; Galliano `#EAAB00` is discontinued and should not appear in active color palettes or configurable defaults.
- A narrow edge-injected transparent-pricing intro beta was deployed on `pilot.venterradev.com/apartments*` and `pilot.venterradev.com/apartment*` through `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js`, rolled back after the apartment units experience appeared to stall, then re-enabled as a hardened non-blocking version on 2026-05-23.
- The Worker is `edge-transparent-pricing-intro-beta`; last original enabled version `9d08ec2c-18fa-43e4-b99d-7986eb32e0f6`, disabled version `3a04aee5-ea68-4c5f-9cd3-30eb7cf24a97`, non-blocking version `fae973c7-fd71-4fbf-8d0f-aa90d835001d`, clean-test-url version `dac90122-4bc7-4493-a1f9-573f2833a907`, disabled-after-hero-review version `6181471a-a26c-4402-88c9-ef0ac927b269`, homepage benchmark version `89b7ce6f-86fb-44a7-98f7-2b8bac2da5f4`, clean-homepage live version `b8807956-1921-4d0b-826e-2276ed2262aa`, title-line-break version `c73d901f-bb92-4a86-a102-2d5579b61251`, modal layout version `db8b4940-020e-4179-aa9a-aa4cab7f36a5`, official-color version `75477e9d-963e-400a-a3b5-73a610aa417b`, and current D1 live-config version `3a19688f-51eb-445b-aae5-8e25969bd935`. Live state is `enabled: true`; Cloudflare route is `pilot.venterradev.com/*`, with homepage modal injection on exact path `/` and apartment coach-mark injection on exact path `/apartments/`. The clean homepage URL displays without test parameters using experience id `edge_transparent_pricing_intro_homepage_v1`. The Worker now reads active D1 config through `POP_BRIEF_DB` and falls back to its embedded approved config only when D1 has no active row or is unavailable.
- The beta carried governed property identity `GA4AX` / `eed3da54-7b7a-4dae-984b-a203113fc2f3`, force/reset testing params, 24-hour cookie capping, localStorage fallback, fade in/out, corner X, countdown/progress, reduced-motion handling, and lightweight dataLayer events where available.
- Current source hardening keeps the concept as a non-blocking notice, removes `aria-modal`, focus trap, autofocus, and outside-click interception, lets pointer events pass through the overlay, and waits for unit/listing DOM readiness before display. Force/reset query params now redirect to a clean URL and use short-lived Worker-only cookies because leaving `edge_popup_force=1` in `location.search` caused the Resi unit UI to hide visible unit rows. Live smoke on 2026-05-23 showed forced apartment redirect to clean `/apartments/`, popup injection with `47` visible availability nodes / `47` visible unit rows retained during and after the popup, homepage/assets untouched, auto-close cleanup, and no browser page errors. Testing always-show mode is active, with `ignoreFrequencyCap: true` for both homepage modal and apartment coach mark. Current modal layout smoke confirmed property `Apex West Midtown`, title newline, countdown `Closing in 7 seconds`, no top-logo-before-title, bottom brand below progress, and `0` browser errors; apartment smoke still retained `47` all-in buttons / `47` availability nodes with `1` coach mark.
- Hero/title review on 2026-05-23 showed fresh-browser clean `https://pilot.venterradev.com/apartments/` still lacks the production-style hero/title with the Worker removed, while production `https://venterraliving.com/apartments/apex-west-midtown/` has the Apex hero/title and the matching pilot property slug returns `404`; do not re-enable until the intended pilot route/template is confirmed.
- Homepage benchmark on 2026-05-23 showed hero/title retained behind the popup, popup visible in `5/5` browser runs, `0` browser page errors, `+11,589` raw HTML bytes, `+5,223` gzip HTML bytes, `+4,208` browser document transfer bytes, and effectively neutral measured load-time impact. Artifacts live under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/`.
- Coach-mark proof on 2026-05-23 added `edge_message_all_in_pricing_coachmark_v1` on exact path `/apartments/`, anchored above the first visible `All-In Price & Details` button. Browser proof showed the coach mark visible, homepage modal absent on `/apartments/`, `47` visible availability nodes / `47` visible unit rows retained, and no page errors.
- The reusable capability is memorialized as the `Edge Message Toolkit` in `/Users/mark/Property_Analytics/docs/EDGE_MESSAGE_TOOLKIT_2026-05-23.md`; admin nav is `Edge Messages`.
- First Pond admin surface added at `/Users/mark/Property_Analytics/apps/web/src/app/experiments/edge-messages/page.tsx`, linked from Experiment Lab. It inventories the homepage modal and apartment coach-mark proofs and exposes editable content, style, placement, delivery, timing, decoration, frequency, preview, and guardrail controls. Launch/pause/rollback remain disabled until the approval workflow, EVS preflight, and benchmark gates are wired; the config publish/read path for this beta surface is now wired through D1.
- The admin surface was pushed live to Cloudflare Pages deployment `9aaf825f.property-analytics.pages.dev`; operator route is `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. It now includes text color controls, fixed active Venterra brand color swatches alongside the free picker, Type size one-pixel steppers for property/title/body/fine-print/countdown text, `Save & Publish` backed by `POST /v1/experiments/edge-messages/:messageId/live-config`, and separated preview scenes so homepage modal previews do not carry the apartment all-in button while coach-mark previews use a dedicated apartments-list screenshot with the bubble lowered so the pointer lands on the target button. The API Worker `pop-brief-api` version `8f0af5e6-86ce-463e-9b27-aec8618ba4e7` validates drafts and writes active rows to `edge_experiment_config_versions`; the Edge Worker reads those rows live through D1. Browser smoke confirmed a saved Accent Color survived reload and no relevant page errors occurred; the font-size and live-publish slices were verified by curl against the live bundle. The discontinued Galliano swatch/default was removed from the active admin palette, and oversized saved coach-mark title/body drafts are now clamped back into a sane range.
- The The Vine production admin pass was deployed to Cloudflare Pages `https://ca35a518.property-analytics.pages.dev`. The Pond surface now keeps Content and Preview visible, with Timing, Style, Targeting, and Publish controls behind collapsible cards for progressive disclosure. Draft save, reset, force preview, open page, pause, launch, and rollback are present with the existing role gate; the custom operator route remains `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. Smoke checks returned `200` for the Pages preview, Access `302` for the custom route, and protected `401 NO_SESSION` for the live API route.
- Measurement artifacts live under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/`, with authentic-logo last-enabled measured payload impact of `11,710` raw script bytes, `4,391` gzip script bytes, `11,726` forced-vs-capped raw HTML bytes, `4,198` forced-vs-capped local gzip bytes, and `4,224` live compressed-transfer bytes; no external popup asset/library requests were added.

- ApartmentIQ API is now a live Data Collection / Data Pond source route extending the existing AptIQ / ApartmentIQ advisory market-intelligence lane.
- Keeper-backed auth lives in `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py` using the `ApartmentIQ API` record; the connector is `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py`, with config at `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml`.
- Local/D1-ready tables are defined in `/Users/mark/Property_Analytics/apps/api/migrations/0055_create_apartmentiq_tables.sql` and `/Users/mark/Property_Analytics/infra/migrations/034_create_apartmentiq_tables.sql`.
- The live smoke pass discovered `1` account and `285` comp sets, then sampled `3` comp sets into `28` market survey rows, `1,480` unit rows, and `278` floorplan rows.
- Property identity governance was extended so stable ApartmentIQ subject-property IDs flow through `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json`; Northbridge at Millenia Lake / `FL4NB` now resolves from `apartmentiq:99066651`.
- Operating cadence is now established through `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh` for a daily portfolio market-survey refresh and `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh` for a weekly portfolio market-survey/unit/floorplan refresh. Summary artifacts are generated by `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_enrichment_summary.py` under `/Users/mark/Property_Analytics/reports/apartmentiq/`.
- Codex automations were created for the daily light refresh and Monday weekly dive. A temporary Friday 12:30 local retry automation was also created for the first full baseline because immediate 2026-05-22 full-run attempts hit extended ApartmentIQ 429 throttling after the exploratory pull.
- Standing authority remains unchanged: ApartmentIQ is advisory market/comps evidence only. Data Pond source-of-record facts govern internal operating, leasing, availability, guest-card, and BI claims.

Operational note added on 2026-05-22:

- Canonical PIB now has a v2.3.0 version path for ApartmentIQ advisory enrichment:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_0.py`
- The new `ApartmentIQ Market Enrichment` section renders only when a governed property identity match and local ApartmentIQ snapshot exist.
- The section shows advisory pricing, rent-per-square-foot, exposure, leased percent, listed offers, peer ratings, nearest complete peers, Offer Pressure, Unit-Type Offer Pressure, Fees / Deposits, and Amenity Differentiators; it is also represented in data coverage, freshness, and methodology.
- PIB now has a section-catalog planning standard for future self-serve generation with selectable section ids and presets:
  - `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`
  - `/Users/mark/Property_Analytics/config/pib_section_catalog.json`
- The catalog memorializes `ApartmentIQ Market Enrichment` as section id `apartmentiq_market_enrichment` and `Search Market Visibility` as section id `dataforseo_search_visibility`, defining the future PIB Builder direction without creating a parallel PIB renderer/template/sender.
- PIB v2.3.0 now also includes `Search Market Visibility`, a standalone DataForSEO section with advisory keyword-demand, live SERP, SERP pressure, Labs ranked keywords, OnPage readiness, local entity, and AI visibility evidence. Northbridge at Millenia Lake was refreshed with new DataForSEO rows on 2026-05-22 for the proof artifact.
- Under explicit 2026-05-22 approval, PIB v2.3.1 now locks the approved advisory enrichment presentation:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/docs/PIB_V2_3_1_LOCKED_STANDARD.md`
- v2.3.1 keeps DataForSEO OnPage and Local Entity information in full-width readable blocks and labels the AI section `AI Answer Visibility`.
- Northbridge at Millenia Lake proof artifact: `/Users/mark/Property_Analytics/reports/pib_v2_3_verification/northbridge-at-millenia-lake/2026/2026-05-22__Property-Intelligence-Brief__northbridge-at-millenia-lake__2026-04-22_to_2026-05-21.html`.
- Boundary preserved: no app-side alternate PIB renderer was created, v2.2.0 remains available unchanged, and ApartmentIQ remains advisory rather than source-of-truth.

Operational note added on 2026-05-25:

- The ApartmentIQ regular-harvest posture was tightened for reliability and coverage efficiency without changing its advisory authority boundary.
- `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh` now operates as a true touchup lane: governed subject-linked comp sets only, default `APARTMENTIQ_DAILY_MAX_COMP_SETS=5`.
- `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py` now prioritizes never-harvested and stalest comp sets first based on stored `collection_date` state, so repeated light runs rotate coverage across the portfolio instead of re-reading the same leading comp sets.
- `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh` now uses a staggered weekly cap of `60` comp sets by default instead of forcing a full portfolio sweep, while still allowing deeper override runs when needed.
- Both ApartmentIQ wrappers now fall back from `~/Library/Logs/Venterra` to repo or `/tmp` log directories when needed, reducing environment-specific launch failures while keeping the same collection/report family shape.
- Targeted 2026-05-25 smoke confirmed wrapper startup/logging works locally, while the current remaining bottleneck is upstream ApartmentIQ `429` throttling on the comp-set list endpoint rather than local orchestration overhead.

Operational note added on 2026-05-12:

- EVS / BrowserStack now has a governed portfolio functionality/data-integrity QA contract seeded from the official workbook `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`.
- The machine-readable contract lives at `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json` and preserves all `45` EVS-owned/deferred audit rows (`43` Functionality and `2` Data Integrity) with workbook row lineage, owner lane, assertion type, truth-source requirements, device scope, side-effect policy, and automation status.
- The first launch batch is `round_1_property_websites` in `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`, imported from `/Users/mark/Downloads/Round 1 QA.docx` into `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`; it currently covers `22` Kinsta property URLs after user-confirmed inclusion of `Carlyle Place Apartments` through `/Users/mark/Property_Analytics/evs/config/round-1-qa-confirmed-extra-targets.json`.
- The original executable pilot batch remains `pilot_production_functionality`, covering the five pilot production URLs and filtering to the EVS-owned checks.
- Media/image checks, contact-form checks, and AH/EAI lead-attribution proof remain in the contract as deferred owner lanes instead of being hidden or misreported as automated BrowserStack results.
- Future launch batches should pass URL lists into `/Users/mark/Property_Analytics/evs/orchestration/build-portfolio-qa-plan.mjs` rather than creating new one-off QA runners.
- Same-day follow-through added the BrowserStack `portfolio_functionality_regression`, desktop `apartments_pricing_deep_journey`, and dedicated iPhone `apartments_pricing_mobile_journey` runner paths. Broad pilot proof passed all five production pilot sites on desktop and iPhone; desktop and mobile deep proof completed all five pilot sites and currently separates real review items (unit sort-order warnings, Pipeline Apply Now unit-context review, Ventana similar-homes detection, and source-backed availability mismatches) from source-truth skips (review date availability).
- Header/footer navigation integrity is now source-backed by the latest ThirtyLines feed snapshot. The BrowserStack `header_navigation_integrity` profile validates logo/home, phone `tel:` links, Apply Now, Schedule Tour, primary nav destinations, footer parity, and mobile menu parity against governed feed phone and property-specific vendor URLs.
- BrowserStack orchestration now has per-property timeout controls, and the mobile journey uses bounded HTML snapshots plus per-row checkpoints so a slow remote iPhone session cannot block launch-batch execution indefinitely or erase partial evidence.
- Pond availability is now wired into the deep profile through `/Users/mark/Property_Analytics/scripts/export_evs_pond_availability.py`, using the governed property identity resolver and latest `unit_availability_units` rows from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`; Calais BrowserStack desktop matched `40` rendered units to `40` Pond units, while The Harrison strict BrowserStack proof correctly warns on `11` rendered units vs `57` Pond/structured units.
- EVS now has a durable evaluation-set persistence shape in `/Users/mark/Property_Analytics/apps/api/migrations/0053_create_evs_batch_result_tables.sql`: `portfolio_functionality_qa_v1` is seeded as the reusable workbook-backed evaluation set, while batches, targets, profile/device runs, source-truth snapshots, and row-level findings can store upcoming launch URL lists and support future result display.
- Generic batch execution is now prepared through `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`, which reads URL-list batches, runs target/profile/device combinations, switches iPhone Apartments & Pricing checks to the bounded mobile journey profile, and writes per-target evidence plus a summary under `evs/reports/<run_id>/`.
- Round 1 source-truth export now scopes Pond availability to the selected URL-list target instead of the legacy Pilot set. Anatole (`OK4AN`) first-property proof exports `11` Pond units and clears the prior rows `79-81` false warnings; mobile media-vendor cancelled requests are filtered out of EVS functionality classification while media remains a separate owner lane.
- Reviews sort row `155` now uses rendered review date text and records both DOM/source order and visual card order, so desktop masonry layouts can be flagged when the page is technically source-sorted but not directly visually sorted newest-first.
- Contact form checks are now separated into the guarded `contact_form_checks` run lane. Default batches remain no-submit; `EVS_INCLUDE_FORMS=1` includes form validation/submission rows, `QA_INCLUDE_OWNERS=forms_qa EVS_RUN_PROFILES=contact_form_checks` reruns only forms, and real submissions require explicit synthetic-submit controls before the runner will send a lead. The profile is registered in shared EVS schemas/API/UI metadata and seeded as separate draft evaluation set `contact_form_checks_v1` for future durable storage/display.
- Lead attribution now has a separate dormant EVS E2E structure in `/Users/mark/Property_Analytics/evs/config/lead-attribution-e2e.json` and `/Users/mark/Property_Analytics/scripts/export_evs_lead_attribution_truth.py`; it uses ThirtyLines `trackingCodes` to generate `?id=<trackingId>` advertiser URLs, verify tracking ID/phone/email behavior, fill synthetic form drafts, and optionally run governed form submissions with browser-validation and acknowledgement evidence. Calais `TX4MIALIST` / `APL` now has a corrected first-send audit row at `/Users/mark/Property_Analytics/evs/reports/calais-TX4MIALIST-corrected-submitted-audit-row-20260513T102927.csv`, with downstream outlet confirmation still pending.
- Same-day media-interaction follow-through reclassified browser-observable media rows into EVS instead of leaving them as generic skipped media QA: Matterport/Virtual Tour row `89`, unit-detail photo modal row `91`, Features camera row `114`, and Amenities camera row `124` now execute in BrowserStack; image correctness row `92` verifies image presence but remains a human/media review item for property-specific correctness. The runner now closes prior overlays between media checks and recognizes UIkit/lightbox/modal gallery evidence, with OK4AN proof stored under `/Users/mark/Property_Analytics/evs/reports/round1-media-interactions-smoke-OK4AN-v2-20260519T210658Z/summary.json`.
- Row `155` review-date sorting evidence now separates source/DOM newest-first order from masonry visual card placement; workbook v15 clarifies the five existing review warnings as visual read-order review items, not source-sort failures.
- Same-day map-pin follow-through wired Location / Map row `141` to the latest ThirtyLines feed latitude/longitude instead of a separate property geo config. `portfolio_functionality_regression` now receives feed-backed property truth, extracts rendered/schema/map coordinate candidates from `/location/`, compares them to feed lat/long, and records coordinate evidence. Full Round 1 proof passed `42/42` desktop+iPhone row `141` sessions under `/Users/mark/Property_Analytics/evs/reports/round1-map-pin-full-20260519T220728Z/summary.json`.
- Same-day specials-toggle follow-through added feed-backed applicability logic for Home / Specials Bar row `4`: the ThirtyLines `propertyBannerSpecial` value now determines whether a missing Specials toggle is truly `N/A` versus still testable. Workbook v7 marks `20` Round 1 property tabs as `N/A` where the feed has no special and leaves `Avasa Grove West` testable because its feed special is populated.
- Same-day data-integrity verdict follow-through scoped row `79` layouts and row `80` pricing to their field-specific Pond comparisons instead of duplicating every unit-set availability gap. Displayed values now pass when every displayed unit is source-backed and layout/rent mismatches are zero; Pond-only units missing from the rendered site stay on row `81` Availability. Follow-up classification now treats row `81` source-backed unit-set, rendered/structured count, or available-date mismatches as `Fail` because Pond/feed availability is available, with workbook v14 recording the prior evidence set as `17` Fail / `4` Pass.
- Same-day sort/floor functional follow-through initially promoted rows `83`, `84`, and `85` from high review warnings to failures when the observed behavior appeared deterministically broken. Follow-up user manual QA on 2026-05-20 confirmed UI operability, but later review clarified that rows `83` and `84` judge actual rendered order, not merely whether the sort UI can be exercised. Current retest `round1-sort-order-local-20260520T1258` records rows `83`/`84` as `20` Fail / `2` Pass for size, move-in date, then price ordering, and workbook v19 reflects that evidence; row `85` floor-filter behavior remains separate.
- Same-day unit-specific Apply Now follow-through initially promoted row `102` from review to failure when Unit Detail Page Apply Now opened only the property-level Pipeline application URL. Follow-up review on 2026-05-20 corrected that proof standard: the runner now opens the landed Pipeline/Prospect Portal page and checks for the expected unit number/source identifier before deciding pass/fail. Targeted retest `round1-row102-unit-apply-local-20260520T1135` checked desktop and iPhone-shaped unit detail Apply Now behavior for all Round 1 properties and passed `22/22`; workbook v17 records row `102` as `Pass` on all property tabs.
- 2026-05-20 form-lane follow-through split Contact row `164` and Validation row `165`: required-field validation is now explicitly no-submit validation and runnable under `contact_form_checks`, while actual contact form submit remains governed synthetic-submit work requiring explicit identity/run flags plus downstream AH/EAI reconciliation. Broad multi-source form attribution can remain paused while one-source action smoke runs through `lead_attribution_e2e`. Follow-up no-submit contact validation retest `round1-contact-validation-local-20260520T1245` passed row `165` for `22/22` Round 1 properties; workbook v18 records row `165` as `Pass` and row `164` as governed-submit pending `Review` instead of generic `Skipped`.
- 2026-05-20 line-requirement totality audit checked every Round 1 row tagged `Functionality` or `Data Integrity` against the workbook, EVS contract, current evidence, and source-backed lanes. The Carlyle Place late-addition blank gap is now closed through desktop/iPhone portfolio and Apartments & Pricing runs. Workbook v20 has no blank EVS-owned statuses across the `22` property tabs: `27` rows are fully inspected/applicability-resolved, `5` contain observed failures, `8` are inspected review-required, and `5` are governed synthetic-submit/downstream-proof pending instead of generic skipped automation.
- 2026-05-20 initial-round attribution decision now fails DNI/source phone replacement rows `8`, `61`, and `161` across all `22` property tabs, in addition to failed row `164` form submission attribution and failed rows `175-178` AH/EAI guest-card proof. Required-field validation row `165` remains a no-submit browser-validity pass.
- 2026-05-20 workbook/evidence governance now treats supplied QA workbooks as fill-only artifacts: no added tabs, columns, rows, screenshots, raw JSON, or non-native evidence objects. Detailed proof is stored locally under EVS reports through `create-local-evidence-package.mjs`, with manifests that record file role, path, size, modified time, and SHA-256 hash. Future batch runs automatically emit `local-evidence-package/evidence-manifest.json`; the current Round 1 v22 support package lives at `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520/evidence-manifest.json`.
- 2026-05-20 fill-only enforcement and DNI proof were tightened further: `validate-workbook-fill-only.mjs` detected that v22 had an extra `EVS Findings Summary` tab, so v23 was rebuilt from the supplied workbook with only `F:G` filled and passed validation with `0` violations. `run-dni-phone-probe.mjs` now runs a no-submit `?id=<trackingId>` source-phone probe with screenshots enabled by default; the OK4AN/APL smoke test correctly failed because runtime attribution selected the source phone while visible/tel numbers remained the default property number, and the Round 1 one-source screenshot probe recorded `22` Fail / `0` Pass with `44` screenshot artifacts and no form submission.
- 2026-05-20 local audit ergonomics now include root-cause summary, evidence-completeness scoring, and a DNI screenshot contact sheet generated by `build-round1-audit-support.mjs`. The current Round 1 support directory groups findings into DNI/attribution, sort order, availability, SightMap, Specials, and review-required buckets, and npm presets now exist for focused DNI, forms validation, sort-order, SightMap, and availability retests.
- 2026-05-20 tightened delivery pass produced workbook v25 at `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx` with fill-only validation passing `0` violations. Row `79`/`80` now fail when displayed unit layout/pricing is not source-backed by Pond, row `85` fails when floor changes do not alter observed units, and row `102` uses a no-submit Prospect Portal move-in-date/lease-criteria proof before deciding whether expected unit context is observable. The companion package at `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520-v25/` adds delivery, root-cause, evidence-completeness, DNI review, and DNI screenshot contact-sheet outputs without adding non-native objects to the supplied workbook.
- 2026-05-20 Round 2 launch-batch intake added `round_2_property_websites` to the same EVS batch model. `/Users/mark/Downloads/Round 2 Portfolio Rollout.docx` now imports to `/Users/mark/Property_Analytics/evs/config/round-2-qa-targets.json` with `21` identity-resolved Staging/Kinsta URLs; Pastel links are ignored for EVS execution, Monteverde remains URL-pending because the doc says to see Julie's email, and the governed identity matrix now includes `Creekside Apartment Homes` as an alias for `Creekside`. Preflight dry-run proof lives at `/Users/mark/Property_Analytics/evs/reports/round2-preflight-dry-run-20260520-v1/summary.json`, and the URL reachability check confirmed all `21` imported Staging URLs responded.

Operational note added on 2026-05-13:

- Monteverde / `monteverdesatx.com` now has an active Website Change Watch lane for external AI SEO vendor monitoring.
- The lane resolves property identity through `Data_Collection/utils/property_identity.py` and `config/property_identity_matrix.json`, then stores immutable public crawl baselines under `/Users/mark/Property_Analytics/reports/website_change_watch/monteverde/`.
- Filled baseline `20260513T165310Z` captured sitemap pages, raw HTML, rendered text blocks, metadata, canonicals, robots, links/CTAs, images/alt text, forms, JSON-LD, custom schema scripts, headers, and Data Pond metric context from GA4, GSC, PSI, GTMetrix, DataForSEO, GBP insights/reviews, Google Ads, availability rows, and Cloudflare synthetic cache checks.
- The same-session gap fill inserted a live GTMetrix row, derived GBP review summary from canonical `gbp_reviews`, and persisted Monteverde Cloudflare synthetic rows; the Cloudflare evidence is a live finding because sampled pages returned `CF-Cache-Status: DYNAMIC`.
- The strategic posture is now memorialized in `/Users/mark/Property_Analytics/docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md`: Monteverde is the seed pattern for a future portfolio-grade Website Change Watch capability that should integrate with Site Content Creator, Data Pond snapshot/diff persistence, Captain website routines, EVS post-change validation, Watchtower freshness/alerts, and Specs page-section contracts.
- This should keep baseline, diff, and delayed impact analysis as separate concepts and should ingest WordPress/WP Engine backend audit evidence when available rather than becoming a parallel generic SEO monitor or report family. Full backend accountability still requires WordPress/WP Engine revision or activity-log access.

Operational note added on 2026-05-18:

- Copy Change Monitoring is now a local Data Pond source route for permanent CMS/site copy, title, meta, FAQ, and CTA changes.
- The route is documented in `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md` and implemented through `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`.
- 2026-06-10 named recurring workflow: `Copy Change Recovery Lane` is documented in `/Users/mark/Property_Analytics/docs/COPY_CHANGE_RECOVERY_LANE_2026-06-10.md` for Act Now / worst-performing copy-change properties. It extends this source route with required Captain/DataForSEO/Data Pond research, WordPress-ready SEO/Hero/Romance paste targets, live public-HTML verification, structured new-content/confound artifacts, Data Pond registration, Captain/Logkeeper handoff, and a filtered test Copy Change Impact Brief email.
- Local SQLite tables `copy_change_waves`, `copy_change_interventions`, and `copy_change_observations` store wave definitions, property/page interventions, publish timestamps, first full post-change dates, changed fields, target queries, confounds, and normalized observation rows.
- `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` now reads active interventions from the registry, seeds the legacy April 17 copy-change cohort, writes local aggregate GSC/GA4 and GSC query-cohort observations, and keeps the email surface as a PIB-style executive quick read without attaching raw JSON by default.
- 2026-05-30 presentation tightening: the same canonical sender now uses approved Copy Change Impact Brief template `v1.2`, rendering property detail as at-a-glance pulse rows with the status pill below the change note and above a smaller compact metrics strip. GSC/GA4 values stack on separate lines without pipes, requested property filters resolve through the governed identity matrix, the visible email dedupes to one card per property using the latest active intervention, the email does not show partial counts for milestone periods that are not live yet, and detailed evidence remains in JSON and local observation rows.
- 2026-05-30 decision-read upgrade: the same sender now uses approved Copy Change Impact Brief template `v1.3`, preserving the compact v1.2 KPI strip while adding Act Now / Promising / Watch / Too Early decision cards, an Executive Read block, and per-property action, confidence, driver, recommendation, and watch/confound flags. The decision layer uses existing canonical/local evidence only: GSC/GA4 movement, GSC query cohorts, unit availability/specials, Google Ads data freshness, and DataForSEO on-page checks where available.
- `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py` lets operators add new properties and waves without editing report code.
- This capability should integrate with Site Content Creator for approved old/new copy, Website Change Watch for baseline/diff evidence, DataForSEO for SERP/ranking context, EVS for post-change rendering/CTA checks, and Captain/Watchtower for follow-through. It does not create a new PIB renderer and does not touch locked PIB files.
- 2026-05-20 SOP clarification: meaningful site changes now require Captain consultation before approval/publish because the property Captain should know the property best. Adding a property to an active copy-change wave, or materially changing tracked fields, also requires a Captain/Navigator/Logkeeper handoff so property memory captures the publish timestamp, first full post-change day, target queries, hypothesis, and proof sources. If Captain runtime/watch tables are unavailable locally, the handoff is written under `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/`.

Operational note added on 2026-05-13:

- Spotlight now has a daily PageSpeed Insights performance roundup for the current 11-property Spotlight set.
- The report lives in the existing pilot roundup reporting family rather than creating a new executive report family: `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_spotlight_performance_roundup.py` generates the HTML/Markdown artifacts and `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py` handles delivery.
- The approved presentation contract is PSI-first: `Spotlight Performance Roundup` with subtitle `PageSpeed Insights Performance`, dominant PSI performance score/trend, supporting New Users / core PSI-CWV / BrowserStack context, no GTMetrix section, and no status chips.
- The daily wrapper `/Users/mark/Property_Analytics/run_spotlight_performance_roundup_daily.sh` is loaded through `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.performance.roundup.daily.plist` at `7:00 AM` local time.
- The delivery audience is Mark Laufhutte, Eric Longoria, Jared Dominguez, and David Crandall, with duplicate-send protection persisted under `/Users/mark/Property_Analytics/logs/email_delivery/spotlight_performance_roundup`.
- The Spotlight 11 are resolved through `/Users/mark/Property_Analytics/config/property_identity_matrix.json` using property codes `TX416`, `FL4TA`, `GA4BL`, `TX4CO`, `KY4TG`, `FL4GW`, `FL4HL`, `KY4MP`, `TX4FV`, `TX4GM`, and `KY4SC`; no per-report one-off identity map should be added downstream.
- Codex automation `daily-spotlight-pagespeed-insights-performance` should be treated as a watchdog for the launchd schedule/delivery log, not as an independent primary sender.

Operational note added on 2026-07-04:

- Pilot Master speed stability now has a daily emailed brief for `https://pilot.venterradev.com/` through `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_master_stability_report.py`.
- The report is part of the existing Pilot Monitoring/CWV platform and not a new report family. It runs clean exact-URL PSI and fresh-query PSI samples, stores raw PSI payloads under `/Users/mark/Property_Analytics/pilot_control_cwv/reports/pilot_master_stability/YYYY-MM-DD/`, checks live mobile HTML markers for the current edge proof state, verifies Zaraz/Heap mode through Keeper-backed Cloudflare access, includes latest GTMetrix evidence when present, and emails rolling history, consistency, user/field-data, change, and next-action sections.
- Codex automation `daily-pilot-master-speed-stability-brief` is the active daily sender at `11:30 AM` America/Chicago. It should use Keeper/KSM credentials only and keep Edge Messaging paused unless Mark explicitly requests restoration.

Operational note added on 2026-05-14:

- The consolidated Data Collection alert lane now includes a GSC core indexation warning check sourced from daily `gsc_url_inspection` evidence.
- This check is intentionally narrower than Search Console's broad non-indexed page count. It escalates only business-risk conditions: canonical property homepage/core URL non-PASS, no sampled URL returning PASS for a reportable property, or explicit robots/noindex signals.
- Benign Search Console exclusions such as redirects, alternate canonicals, specials pages, and other non-core URL states remain stored as evidence but do not trigger the new warning.
- The alert preview includes a `Core Indexation Warnings` summary tile and renders a dedicated GSC Core Indexation Warnings section when risks exist. The 2026-05-14 verification found `0` active core indexation warnings across the live/profile-backed portfolio.

Operational note added on 2026-05-17:

- `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md` now defines the Property Narrative Canon as the core artifact for future Content Operations strategy.
- The canon is not a one-off content output. It is the durable property narrative source from which Site Content Creator recommendations, VACS long-form content, GBP/social/email packages, FAQ/schema updates, Captain/Navigator content actions, and future outlet publishing artifacts should derive.
- System ownership remains layered: Data Pond is factual authority, Captain's Log / Brief is operating intelligence, VACS is narrative synthesis, Site Content Creator is live-site expression and harmonization, and Content Office is channel distribution/proof.
- DataForSEO is the active search/environment source for new search, OnPage, business, AI visibility, and LLM mention evidence. Ahrefs is now a governed advisory source for technical SEO health, authority, Web Analytics, and GSC availability; charged backlink, competitor content-gap, keyword, Brand Radar, and topic evidence remain opt-in after scope/cost approval. SEMRush remains terminated for the active operating lane, with any remaining rows treated as legacy history only.
- The first implementation slice should prove one property canon, one live-site harmonization audit, one long-form VACS artifact, and one channel derivative package before broad publishing automation.

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
- now carries governed `encasa_region` assignments for the `91` active properties present in the 2026-05-04 `regions.xlsx` workbook via `/Users/mark/Property_Analytics/Data_Collection/utils/property_regions_ingest.py`

### 4.2.1 Property Identity Matrix

Canonical cross-source identity matrix:

- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Resolver and governance:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`
- `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`
- `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`
- `/Users/mark/Property_Analytics/docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md`

Observed role:

- resolves property code, GA4 property id, GSC URL, website URL, app community UUID, Encasa short name, GBP location id, company id, unit count, and aliases into one governed identity record
- uses the remote D1 community snapshot to complete app/D1 `community_id` coverage locally
- uses property code as the visible / Captain-facing property id when available
- removes hardcoded per-ingester property exceptions from Marketing BI conversion, daily packet, available-unit-interest, operating-metrics, and Captain source mirror ingestion
- is now backed by `scripts/check_property_identity_governance.sh`, which validates matrix health and required resolver usage
- now includes the governed property-region source route documented in `/Users/mark/Property_Analytics/docs/PROPERTY_REGIONS_SOURCE_CONTRACT_2026-05-04.md`, so Captain peer-family reads, regional benchmarks, and Commodore synthesis can use portfolio region groupings without downstream one-off maps

Audit judgment:

- this is now the required extension point for new source ingestion and Captain Brief source reads
- remaining maturity item is keeping the remote community snapshot refreshed whenever the app community dimension changes

### 4.3 Shared Utilities and Guardrails

High-value shared foundations:

- `utils/` for email, validation, config, KSM, reporting helpers
- `Data_Collection/db/database_manager.py`
- `Data_Collection/utils/data_quality_validator.py`
- Keeper/KSM documentation and secret mapping
- PIB guardrails in [AGENTS.md](/Users/mark/Property_Analytics/AGENTS.md)
- Report-family delivery discipline: PIB-family, Captain, Watchlist, Spotlight, and specialty brief emails should be sent through the established family shell/sender/orchestrator first. `utils/email_sender.py` is the shared low-level transport, not permission to create one-off report delivery wrappers when a canonical report family exists.
- 2026-05-07 Watchlist delivery separation: the active Watchlist Decision Output v1.1 path now keeps the executive email and site-manager Word attachment in the same canonical report family. The main email suppresses selected internal decision-check/cost-history blocks, while the generated Word attachment is a plain-English site-manager action plan that omits internal/technical sections and travels as an attachment through the canonical Watchlist sender.
- 2026-05-07 multifamily SEO/local-content standard: VP-supplied SEO/GEO/AEO/AIO guidance is now governed by `/Users/mark/Property_Analytics/docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md`. Watchlist Decision Output v1.1 now includes a compact `SEO + Local Content Action Pack` that ties website, GBP, social, metadata, FAQ, and shadow-page recommendations to actual inventory pressure, funnel condition, competitor/value evidence, and DataForSEO on-page snapshots instead of generic SEO advice.
- 2026-05-07 Watchlist Decision Output v1.2 comparison standard: the Watchlist report family is now versioned to v1.2 for new runs. The standard is memorialized in `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_2_2026-05-07.md` and requires T30/T90 direction, portfolio and regional funnel comparisons, channel/source portfolio and regional yield reads, restored guest-card-to-available-unit-type analysis, direct non-defensive spend language, and a version-matched site-manager Word companion.
- 2026-05-07 Watchlist v1.2 insight standard correction: section-level tables are now explicitly treated as evidence, not narrative. Major report sections must carry interpretation panels that explain what the data means, why it may be happening, what to do next, and what not to do. A `Damage / Friction Check` now surfaces negative reviews, attention reviews, service/ticket no-response risk, reopen/ticket posture, make-ready/readiness, and other trust blockers as conversion risk.
- 2026-05-07 Watchlist v1.2 funnel-gap correction: the `Current Funnel Stress Test` now separates broad traffic-volume sufficiency from the actual recovery gap, so a zero lead/visit/PQ gap does not hide net exposure, floorplan/product-fit, follow-up, offer clarity, pricing/concession, or readiness blockers.
- 2026-05-07 Watchlist v1.2 reputation expansion: `Reputation / Product Friction` now uses the richer PIB reputation evidence lane, including GBP review volume/star mix/reply capture, sentiment breakdown, theme sentiment, critical review action items, Reputation.com trend/components, and local reputation competition where available, with GBP evidence labeled separately from Reputation.com current-period rows.
- DataForSEO credentials now resolve through Keeper via `/Users/mark/Property_Analytics/utils/dataforseo_auth.py`, with verification at `/Users/mark/Property_Analytics/scripts/check_dataforseo_auth.py`
- Official operating metrics now have a drop-ready AR4PB source template and operator wrapper, so the Captain Brief evidence gate can be cleared by filling the source-of-record file rather than relying on inferred occupancy or concession values.
- 2026-05-06 GBP auth standardization: `/Users/mark/Property_Analytics/utils/config_manager.py` now owns the canonical GBP OAuth client/token paths via `get_gbp_credentials_path()` and `get_gbp_token_path()`, and `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` now uses those shared getters for both GBP reviews and GBP insights. Current live state still falls back to local files because `KSM_GBP_CLIENT_SECRET_UID` and `KSM_GBP_TOKEN_UID` are not yet populated, and the existing `gbp_token.pickle` is brittle because it serializes internal `google-auth` classes not present in the current scheduled runtime.
- 2026-05-07 GBP live repair: `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` now carries the single governed GBP auth loader, prefers JSON authorized-user token storage, and includes a one-time compatibility shim so legacy pickled tokens can be refreshed and migrated instead of breaking unattended collection. `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` insights collection now reuses the same collector credential object as reviews rather than separately opening the token file with `pickle.load(...)`. The live legacy token was successfully refreshed into `Portfolio_Monitoring/credentials/gbp_token.json`, and both GBP Reviews and Business Profile Performance API calls were proven against live matched locations. Remaining gap: Keeper UIDs for the GBP client secret/token still need to be populated for full KSM-only posture.
- 2026-05-06 Captain/report terminology cleanup: user-facing late-funnel wording now uses `PQ` (`Price Quote`) instead of `RFP`, while the underlying Marketing BI storage fields remain `rfp_*` for backward compatibility with existing ingests and queries.

## 5. Capability Inventory By Domain

### 5.1 Data Collection and Normalization

Primary canonical system:

- `Data_Collection/`

Current capabilities present:

- GA4 collection
- GSC collection
- GBP collection
- Reputation.com XLSX export ingestion for vendor reputation score, review mix, response rate, score components, time-series trend, and local competition evidence, resolved through the governed property identity matrix, stored in `reputation_com_*` Data Pond tables, and mirrored into Captain D1 source packets with GBP review/sentiment/summary/insight enrichment for Captain reputation reads
- GBP review sentiment backfill via `/Users/mark/Property_Analytics/Data_Collection/utils/gbp_review_sentiment_backfill.py`, which deterministically derives `gbp_review_sentiment` rows from collected GBP review ratings and explicit source-text keyword matches when raw GBP reviews exist but sentiment enrichment has not been generated. The utility resolves property identity through the governed matrix and does not use an LLM or invent review facts.
- Competitor market research ingestion for sourced public competitor rents, specials, availability, USPs, media/package indicators, reputation, and explicit source gaps in `competitor_market_research_snapshots` and `competitor_market_research_observations`, resolved through the governed property identity matrix and mirrored into Captain D1 source packets for POP Brief / Captain competitive slices; the 2026-05-06 Spotlight batch builder at `/Users/mark/Property_Analytics/Data_Collection/utils/build_competitor_market_packets.py` can generate dated official-page competitor packets from governed comp sets plus internal subject rent/special posture; Captain Brief read models now expose `competitorMarketRead`, pull the subject property's current visible rent/specials from internal `unit_availability_units`, ignore invalid nonpositive unit-feed rent placeholders, use the combined internal-plus-competitor evidence for pricing-vs-advertising / copy / package-status logic, keep unsupported ADC/package claims gated, render explanation-first source markers that tie Captain claims to a bottom Data Integrity panel, and now have an Elation/TX4EG proof pass where the Competitive Market Read is embedded into the full property-aware Captain Brief instead of sent only as a standalone competitor slice
- GTMetrix collection
- guest card collection
- Marketing BI daily packet PDF ingest for Captain's Log grounding, storing packet headers, searchable page text, and Portfolio Summary property rows for daily Captain context
- Marketing Ops Summary workbook ingestion for portfolio-level property performance, traffic, pricing, financial, and Kingsley advisory signals in `marketing_ops_summary_rows`, resolved through the governed property identity matrix and now mirrored into Captain D1 source packets with `opsSummary` / `opsRead` exposed in the Captain Marketing Insight payload
- Spotlight weekly field notes/action-plan ingestion for additive human operating evidence, storing weekly property snapshots and action item ledgers in `spotlight_weekly_field_snapshots` and `spotlight_weekly_action_items`, resolved through the governed property identity matrix and mirrored into Captain D1 source packets so Captains can explain metric movement, track recovery execution, and flag stale or underspecified actions without overriding source-of-record metrics
- Captain Brief read-model composition now includes Marketing BI and reputation advisory blocks: Marketing BI joins the daily packet with available-unit interest, traffic conversions, cancel/denial diagnostics, and the promoted Marketing Ops Summary source route, while the reputation block blends Reputation.com score/review-mix/component/trend/local-competitor posture with GBP resident voice, reply coverage, sentiment themes, and local profile actions; both preserve Data Pond authority for official operating and unit-level facts
- ThirtyLines collection
- Cloudflare edge delivery analytics collection through `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`, storing daily GraphQL source facts in `cloudflare_edge_daily_metrics` without replacing GA4, Heap, or GSC
- Cloudflare cache audit collection
- orchestration of daily master collection
- collection monitoring and alerting
- anomaly detection and credential monitoring
- backfills for GA4 new users and channel new users
- GSC URL inspection collection
- CWV history backfill

Most important entrypoints:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/collect_gsc_url_inspection.py`

Audit judgment:

- this is one of the clearest canonical cores in the repo
- it should remain the default collection layer unless there is a deliberate exception

### 5.2 Reporting and Operational Intelligence

Current reporting capability families include:

- Property Intelligence Brief
- Captain's Log and Captain's Brief, with a codified command hierarchy for Fleet Commander, Chief of Staff, Admiral, Commodore, Captain, First Officer, Quartermaster, Navigator, Signals Officer, Engineer, Boatswain, and Logkeeper, plus a memory/directive standard requiring Captains to remember prior expectations, actions, outcomes, and lessons before issuing new recovery guidance, a weekly Reputation Watch lane for Reputation.com score/response/review-mix/local-competition posture, Spotlight weekly field-note memory for human recovery execution context, and a reusable local vNext generator that composes a recovery-directive brief from Pond facts, structured Marketing BI traffic/spend/source rows, PSI/Core Web Vitals conversion-health rows, business-facing remote Captain watch/action state, and a bottom `Sources Used` panel instead of top source-status narrative. The current report path is memorialized in `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_VNEXT_REPORT_MEMO_2026-05-06.md`. The Watchlist Decision Output v1.1 standard is memorialized in `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md` as an additive Watchlist decision packet with mandatory PIB-style header, visual scorecard, channel budget efficiency, recommendation guardrails, action packages, T30/T90 outcomes, bottom sources, and quiet repository links. This reporting lane now also uses governed display aliases for awkward BI source taxonomy in user-facing outputs, including `ADC`/`Apartments.com` as `Apartments.com / ADC` and `Drive By` as `Walk-In / Drive-By`, while preserving the raw stored source values underneath.
- Captain/read-model marketing economics now also calculate per-channel `cost per lease` and derived `cost per move-in` where BI cost-per-conversion rows and source-performance rows can be reconciled, so source-efficiency reads can move beyond guest-card/app proxies without rewriting raw BI source truth.
- The reusable local Captain Brief now also carries a PIB-style secondary `Unit-Type Spend / Targeting` block beneath the main marketing channel content. It shows classified unit-type spend versus generic capture, targeted unit-type count, clicks, conversions, and top keywords by unit type, preferring local `ad_keyword_performance`, then remote D1 `ad_keyword_performance`, then the latest generated marketing mirror SQL batch as a controlled fallback when the local mirror is behind.
- The Captain app now reads and renders the same unit-type targeting block through `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` and `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`, keeping the web surface aligned with the generated Brief instead of introducing a separate paid-search targeting interpretation.
- Property diagnostic JSON data layer for downstream agents, including the internal diagnostic serializer at `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` and the VP-specific retrieval contract serializer at `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`. The internal diagnostic JSON produces one governed property object with clean numeric demand, funnel, inventory, pricing, marketing-efficiency, reputation, website-performance, comparison, flag, source, and missing-data fields. The VP serializer outputs the stricter one-object-per-property retrieval contract memorialized in `/Users/mark/Property_Analytics/docs/VP_PROPERTY_RETRIEVAL_JSON_CONTRACT_2026-05-06.md`. First artifacts include `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json` and `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`; both are Data Pond read models and do not create or alter PIB rendering behavior. The 2026-05-06 source-mix expansion adds Marketing BI source/origin performance, T365 move-ins by source without resident-name storage, source-level monthly advertising spend from the month-by-month spend workbook, Portfolio Box Score make-ready/box-score facts, and T90 service-delivery posture. The 2026-07-01 Power BI workbook intake loaded fresh conversion-dashboard, source-performance/origin, and Portfolio Box Score rows across `92` mapped properties into the same Marketing BI Excel ingestion path, with parser protection against unscoped hierarchy-total rows entering property-scoped evidence.
- Search Intelligence report builder
- specialty PIB-style SEO property proof briefs for rolling and explicit date windows
- PIB-style daily copy-change impact briefs
- those copy-change briefs are being actively tuned for operator readability; they currently emphasize direct same-property matched-window evidence in the email surface, while control-cohort comparison can remain a secondary analytical layer rather than a required front-and-center card
- Portfolio Pulse / daily monitoring
- Daily Health reports
- Morning Full portfolio report
- Weekly Progress reports
- Spotlight Properties report
- Focus Report
- CWV snapshot
- selected-property CWV T30 briefs
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
- `/Users/mark/Property_Analytics/scripts/backfill_selected_gsc_window.py`
- `/Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py`
- `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`
- `/Users/mark/Property_Analytics/scripts/generate_portfolio_psi_pib_report.py`
- `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py`
- `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`

Audit judgment:

- reporting is one of the strongest and most mature capability areas
- there are several separate report brands with overlapping data access and rendering patterns
- the daily summary lane is now intentionally consolidating around Morning Full as the canonical scheduled email, with legacy daily-health delivery routed into that single path and duplicate-send protection on summary subjects
- specialty pilot roundups and export notifications have had active policy churn; wrapper defaults must be verified in code before assuming whether pilot informational email is suppressed or enabled
- the retired separate `Pilot Data Exports` daily email must remain unscheduled; the stale 6:00 AM `com.venterra.pilot.data_exports.daily` LaunchAgent was unloaded and archived on 2026-07-17, leaving the consolidated pilot roundup as the active CSV delivery path

Monitoring note:

- `/watchtower` now serves as more than a freshness matrix
- it also functions as a compact operator-facing integrity surface for:
  - core vs specialty collection failure counts
  - freshness warning / stale source counts
  - top active integrity issues from canonical monitoring tables
  - source-aware freshness expectations for manual morning feeds such as guest cards, so weekend and pre-8 AM windows do not register as false stale conditions
- D1 health evaluation is now more operationally honest too: same-day summary/alert logic will no longer let a later failed rerun supersede an earlier successful mirror report, which prevents auth-only retry noise from presenting as a false D1 outage
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
- 2026-06-03 Google Ads mapping hardening: screenshots for Canton Mill Lofts and The Maddox exposed that the March campaign-property mapping had gone stale and missed active June local/brand campaigns. The runtime analyzer now materializes Google Ads config through Keeper and rebuilds `config/google_ads_campaign_property_mapping.json` from live API evidence using the governed property identity matrix, property company ids, property codes/tracking tokens, aliases, campaign/ad-group/ad text, final URLs, and tracking templates. The collector now refreshes stale or legacy mappings before collection. Same-day proof mapped `202` active campaigns across `86` properties with `0` unmatched active campaigns, then collected June 1-3 local/brand campaign and keyword rows for Canton Mill Lofts and The Maddox. Both properties still showed `0.0` Google Ads conversions, so future reads should separate ad-activity presence from conversion-tag/attribution health.
- Same-day follow-through added `/Users/mark/Property_Analytics/scripts/audit_google_ads_integrity.py`, which persists attribution and conversion-health read-model tables in the local Data Pond and writes evidence under `/Users/mark/Property_Analytics/reports/google_ads_integrity/`. A full June 3 portfolio collection with the refreshed mapping completed for all `86` mapped properties with `0` failures, writing `171` campaign rows, `$1,464.90` spend, `1,228` clicks, and only `2.0` conversions. Integrity audit artifact `/Users/mark/Property_Analytics/reports/google_ads_integrity/2026-06-03_111555/summary.md` reported `0` attribution gaps / unmatched active campaigns, plus `52` active zero-conversion campaigns and `102` lower-volume watch-zero-conversion campaigns. This confirms the immediate paid-media diagnostic lane should focus on conversion tracking / attribution health while preserving the now-hardened campaign-property detection.
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
  - pilot BI snapshot ingestion is now caught up through governed workbook harvest from that same shared directory, and Measurement ingestion now resolves the newest valid `Measurement_Dashboard*.xlsx` workbook version instead of a fixed `1.1` filename; the 2026-05-09 proof pass loaded `Measurement_Dashboard_1.3.xlsx` through `2026-05-07`
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
  - the homepage-audit collector is now also more resilient to transient site/probe disconnects: on 2026-04-20 a single Calais Midtown remote disconnect blocked the whole pilot morning despite fresh GTMetrix and PSI data, so the collector now retries retryable per-property probe failures before it marks the stage failed
  - the wrapper itself now owns a true homepage-evidence remediation loop and duplicate-alert suppression: if the stage still fails after collector-local retries, the morning workflow performs additional stage-level attempts before alerting, and intentional stage exits no longer trigger a second misleading `Bootstrap / Shell` alert from the Bash `ERR` trap

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
- approved `PIB Site Evaluation` intro in property-level v2.2.0 PIBs when DataForSEO / BI / GSC / availability / review support context exists; as of explicit 2026-07-01 approval, this intro is governed as a factual evidence read with `What The Data Shows`, `Observed Evidence`, and `Recommended Follow-Up Checks`, not an underperformance diagnosis unless the source packet proves cause
- approved versioned PIB v2.3.0 path with a dedicated ApartmentIQ advisory enrichment section sourced from governed ApartmentIQ Pond tables
- email sending
- portfolio launch metric watch
- ads intelligence brief
- validation utilities
- historical variant templates and versions
- large archive of rendered property outputs and payloads

Audit judgment:

- PIB is not just a report; it is a long-lived product family with strong institutional value
- the repo also contains many PIB-adjacent experiments and derivative renderings, so guardrails matter
- the executive intro wording is part of the approved artifact contract: future edits should preserve the non-prejudicial evidence stance and the required DataForSEO source lane rather than reverting to attack-stance/root-cause language

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
- Content Office
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
- web surfaces for `/content-office` and `/gbp-posts`
- API routes for `admin-intelligence`, `admin-site-content`, and `vacs`
- API routes and workflow tables for governed GBP source snapshots, policies, drafts, reviews, and publications
- `data/Intelligence/` as the document/evidence base

Capabilities present or partly present:

- governed directives
- approved claims and source-backed guidance
- structured claims + evidence registry with claim-evidence linking and brief readiness scoring
- migration tooling from legacy `approved_points` into structured claims
- content/search governance overlays
- governed content distribution coordination, starting with GBP Posts and extending later into social/email/video/community lanes through the same approval/proof pattern
- site copy inventory and rewrite workspace concepts
- property-aware content generation direction
- Captain assessment inputs surfaced as a first-class brief signal in Site Content Creator
- Site Content Creator is now moving from a diagnostics-first crawl console toward a page-mock editing workbench: property selection, a single page chooser instead of a page-board gallery, recognizable section canvases, CTA-aware mock blocks, and deferred Specs/assessment detail after section selection
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
- Content Office current-state reporting should remain grounded:
  - GBP Posts is the active working lane
  - GBP Posts now accepts Captain runtime context into its source snapshots and can create a Captain-led deterministic draft candidate when active watch/action guidance exists
  - GBP Posts now records manual posting proof and posting failures in `gbp_post_publications`, closing the first human-in-the-loop loop from Captain/Data Pond context to draft, approval, manual posting, and proof
  - Content Office and GBP Posts now expose Suggested GBP Posts from Captain/Data Pond signals, giving curators a proactive queue before draft generation instead of requiring a blank-form start
  - social, email, TikTok/Reels, Yelp, Reddit, and similar channels are roadmap/draft-handoff lanes, not active auto-publish integrations
  - future expansion should reuse the GBP pattern of source snapshot, policy, draft, review, publication proof, and performance learning instead of creating disconnected posting tools

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

- daily Cloudflare edge delivery analytics source-fact collection for configured zones/hostnames
- daily Cloudflare cache audit
- GraphQL analytics query support
- HTML/CSV/JSON/Markdown artifact generation
- full-page cache rollout tooling
- cache purge/auth utilities
- workday runbooks and rollout plan docs

Primary files:

- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
- `/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/`
- [CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md)
- [CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md)

Audit judgment:

- this is now an operational capability, not just an investigation

### 5.8.1 Edge Experimentation System

Planning artifact:

- [EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md)
- [EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md)
- [EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md)
- [EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md](/Users/mark/Property_Analytics/docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md)
- [EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md)

Planned role:

- Data Pond-governed control plane for small property-site experiments.
- Cloudflare Worker execution for approved edge rewrites.
- Zaraz event routing into GA4 and Heap.
- Data Pond exposure, decision, guardrail, and learning ledgers.
- EVS preflight and post-launch proof for selector health, rendering, CTA behavior, and device coverage.
- Watchtower visibility for active experiment health and rollback posture.
- First non-mutating implementation slice now exists and is deployed at `/experiments` and `/v1/experiments`, with migrations, shared schemas, admin-only draft creation, readiness gates, execution lock, and seeded homepage CTA component contracts. Experiment Lab now reads Specs plus Site Content as the human-facing eligibility source, groups opportunities by Header, Mobile Menu, Pages, and Footer, expands Specs-defined nav/header/footer/hero targets plus recognized Site Content CTA labels into separate testable items, filters by intent, orders page items by page order and captured live section order, includes a collapsible Planning Overview for the Experience Map and repeated journey patterns, renders each surface group as an accordion, and keeps card-level Location, Readiness, Ideas, and Workflow details behind accordions. It can promote matched/partial Site Content CTA targets through `POST /v1/experiments/component-contracts/site-content` and Specs-derived targets through `POST /v1/experiments/component-contracts/specs`, records preflight request/checklists through `POST /v1/experiments/:experimentId/preflight`, and generates preview-only Worker dry-run configs through `POST /v1/experiments/:experimentId/dry-run`. Remote D1 has the Edge Experimentation table family and the deployed API Worker version is `8337d640-6a3b-4d4c-9bf0-6b3ec0037b41`.

Audit judgment:

- this should extend Data Pond, Site Content Creator, EVS, Cloudflare Ops, and Data Collection rather than becoming a standalone A/B testing product
- implementation should begin with the source contract, schema, Experiment Lab operations UI, Worker dry-run, EVS proof, and a single-property homepage pilot before any visual experiment builder

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
- reusable evaluation-set, batch, source-truth, and row-level finding persistence
- separate dormant lead-attribution E2E profile for advertiser URL, phone-swap, recipient-email, and governed synthetic-form proof
- saved ad-hoc legacy employee-photo audit for `#meet-the-team` silhouette/default-placeholder detection
- weekly/manual/post-deploy trigger model
- staging-first execution pattern

Audit judgment:

- EVS is a real platform capability with a clear shape, even if full orchestration maturity is still in progress
- it belongs in planning alongside monitoring and reporting, not in a side note
- it now has a first-class governed Pond bridge, which is the right inclusion model while execution remains specialized
- request lifecycle maturity has improved: EVS can now persist request intent, expose execution plans, record external orchestrator handoff, and ingest normalized results without pretending API-dispatch is already live
- result persistence maturity has improved: EVS can now represent a reusable QA evaluation set separately from a specific launch batch, then store each target, run, assertion, source-truth artifact, owner lane, and evidence reference in queryable D1 tables
- lead attribution is separated from ordinary functionality QA, which keeps no-submit audits clean while still allowing a governed synthetic-lead proof path when the team approves submission policy
- the legacy employee-photo audit belongs inside EVS/BrowserStack rather than a parallel scraper because it depends on rendered staff sections, BrowserStack evidence, and governed property identity
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
- 2026-05-29 Resi live-fire edge diagnostics now include measured rejection of jQuery Migrate removal on `pilot.venterradev.com`: Worker version `02fa421f-1759-465b-9c0b-6961ccbd768e` removed only `/wp-includes/js/jquery/jquery-migrate.min.js` from `/` and `/apartments/`, Playwright smoke passed, but authenticated PSI medians regressed apartments desktop versus the kept SightMap lazy-load state (`99 -> 65`, TBT `60ms -> 1428ms`), so Worker version `ff0eee24-3bb5-4f4d-8210-16b3e40bdbec` restored jQuery Migrate while leaving SightMap lazy-load live.
- 2026-05-29 script-cost profiling and Resi pixel idle-load testing showed YOOtheme/UIkit as the largest actionable script CPU bucket. Broad and mobile-`/apartments/`-scoped Resi pixel idle-load tests were functionally safe but not clean PSI wins, so Worker version `1f0f3a89-15c4-4037-b8ed-34e2a192a5fc` restored the direct pixel script while preserving the kept SightMap lazy-load rewrite.

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
- Delta Pearland APO case-study baseline, using the existing Cloudflare audit and rollout tooling rather than a parallel optimization path
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

- The active Data Pond web and API layers now carry a shared offering-permissions foundation, with visibility and named action rights separated for canonical offerings. The web catalog lives in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, the API-side action enforcement lives in `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`, and EVS/GBP Posts/Content Office are the first lanes using named capability actions instead of only generic editor/admin route gates.
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
- the POP Brief Pond implementation is now more operationally real too:
  - weekly metrics import in `/Users/mark/Property_Analytics/apps/api/src/routes/metrics.ts` now accepts both pasted TSV and uploaded CSV/TSV against the documented contract instead of leaving the Pond UI on a scaffold/API mismatch
  - uploaded weekly-metric source files are now written to the `POP_BRIEF_UPLOADS` R2 bucket during import
  - `/Users/mark/Property_Analytics/apps/api/src/routes/exports.ts` can now create server-side backup artifacts and return the object key, which makes the backup lane more than a browser-only CSV fan-out
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
- that matters because the current platform is still between ad hoc operator-led deploys and fully issued CI provenance; this bridge reduces stale pedigree drift immediately while preserving the path toward true automation
- the platform now also has a generated release-reconcile snapshot:
  - `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py`
  - `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_RECONCILE_SNAPSHOT_MODEL_2026-04-18.md`
- that matters because the control plane can now quantify the dirty-tree split and show the first clean release-shaped slice directly, instead of treating release reconciliation as only a prose planning concern
- Site Content Creator has continued moving away from an audit-console presentation and toward a real content workbench:
  - page selection is being reduced to simple property/page controls
  - the selected page is being treated as a recognizable mocked page canvas
  - content editing is being centered on current copy vs new copy
  - specs, assessment, and governance detail are being pushed into secondary disclosure instead of the default scene
- this matters because the system’s success here depends on human editorial usability, not on surfacing every available metadata field to the operator

## Addendum: 2026-04-22 PSI Audit Correction

- The PSI / PageSpeed lane had been overstating health.
- Two distinct failure modes existed:
  - full missing dates when the master daily collector failed before reaching PSI
  - false `completed` PSI runs when the PSI collector only partially collected the portfolio
- Canonical corrections now in place:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py`
    - now derives `completed` / `partial` / `blocked` from actual portfolio coverage
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
    - now reads the real same-day PSI run status after the subprocess returns and queues same-day PSI follow-up when needed
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
    - now treats PSI as retry-eligible advisory source work for same-morning recovery
- Historical `data_collections` PSI rows with incomplete coverage were also reconciled from `completed` to `partial` so live reporting aligns with the corrected operating model.
- Historical backfill policy for PSI is now explicit:
  - missing historical PSI dates remain authoritative gaps unless we possess dated raw PSI snapshots or cached payloads for those dates
  - rerunning the live PSI collector with an old `--date` is not accepted as a backfill because it produces current PSI measurements mislabeled as historical data
  - the enterprise-safe control is prevention plus transparent gap reporting, not fabricated history

## Addendum: 2026-04-22 POP Brief Pond canonical analysis correction

- The POP Brief Pond lane had a real parity problem even after import and backup were restored:
  - the visible `/analysis` page was still composing the brief from `t7_metrics`, `t30_metrics`, and `marketing_data`
  - that meant the operator-facing POP Brief was not actually driven by the documented POP Brief v1 contract centered on `weekly_metrics`, `marketing_weekly`, and `GET /v1/analysis`
- Canonical correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes a typed `/v1/analysis` client
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now renders the Pond POP Brief from the canonical analysis payload instead of the sidecar models
  - the current visible brief now shows:
    - T7/T30 community vs portfolio comparisons from `weekly_metrics`
    - marketing weekly leads / CPL / spend / notes / mention inputs from `marketing_weekly`
    - canonical metric notes carried on the weekly metric rows
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/analysis-route.test.ts`

## Addendum: 2026-04-22 POP Brief marketing_weekly workflow correction

- The next major parity gap after the analysis correction was the marketing operator surface:
  - the backend already had canonical `marketing_weekly` and `scan-mentions` routes
  - the Pond UI was still editing the separate `marketing_data` model, which meant the canonical marketing workflow existed in code but not in the actual product surface
- Canonical correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes typed `marketing_weekly` and mention-scan helpers
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now edits the canonical `marketing_weekly` record for the selected community and Friday week
  - the same page can now execute the canonical mention scan and report processed / sent / suppressed results to the operator
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-route.test.ts`
- Residual POP Brief parity gaps still open after this correction:
  - communities management is still only partially surfaced in the Pond
  - the admin onboarding model still differs from the invite-based v1 POP Brief contract

## Addendum: 2026-04-22 Base44 Spotlight Website & SEO ingest compatibility restored

- Operator review surfaced an important parity distinction:
  - the real Base44 app accepts a Spotlight Website & SEO CSV export shape with columns like `property_name`, `property_url`, `date`, `t7_engaged_sessions_delta`, `website_notes`, and `seo_notes`
  - the Pond had retained the compatible API route but had lost the visible UI lane after the Marketing page was redirected toward canonical `marketing_weekly`
- Compatibility correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` again exposes a Base44-compatible bulk Website & SEO import panel
  - that panel parses the real Base44 CSV shape, normalizes dates such as `04/24/2026` to `2026-04-24`, previews rows, and submits to `/v1/marketing-data/import/website-seo`
- This does not eliminate the deeper model split between `marketing_data` and `marketing_weekly`, but it does restore an operator-visible ingest path that matches the currently live Base44 workflow for this file family.

## Addendum: 2026-04-22 Communities writable surface restored

- Another previously confirmed parity miss was the communities operator surface:
  - the API already supported create / patch / soft-delete
  - the Pond `/communities` page remained a read-only list
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` now provides create, edit, and soft-delete controls
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes the corresponding mutations
- Authentication remains an intentional deviation from the original app and stays on Cloudflare Zero Trust by operator direction.
- Residual major parity gap still open after this correction:
  - admin onboarding still differs from the original invite-based POP Brief contract

## Addendum: 2026-04-22 POP Brief landing navigation aligned to Base44 operator flow

- Operator screenshots showed one more important usability gap:
  - even after the main business workflows were repaired, the Pond `/analysis` page still did not expose the recognizable Base44 left-column workflow links from the main brief surface
  - that made the rebuilt app harder to navigate like the live product even when the underlying routes existed
- Navigation correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now renders a POP Brief navigation board with direct links to the mounted equivalents of the Base44 rail:
    - Communities
    - T7 Metrics
    - T30 Metrics
    - Marketing Data
    - Analysis
    - Backup & Export
  - the Base44-only slots `Call Notes` and `Profile` are also shown as explicit placeholders rather than being silently omitted
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now presents the operator surface as `Marketing Data`, which better matches the live app screenshots and makes the Base44-style Website & SEO import panel easier to locate
- This does not create new business logic, but it materially improves operator parity by making the Pond’s primary POP Brief entry screen behave more like the live navigation model.

## Addendum: 2026-04-22 PIB dashboard corrected as the real parity front door

- Operator feedback immediately exposed a follow-on mistake:
  - the first navigation correction was real, but it landed on `/analysis`
  - the actual front door the operator perceives as the PIB Brief page is `/pib`
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/pib/page.tsx` now contains the Base44-style workflow board directly on the PIB dashboard
  - the board exposes the mounted routes for Communities, T7 Metrics, T30 Metrics, Marketing Data, Analysis, and Backup & Export
  - it also keeps `Call Notes` and `Profile` visibly reserved as placeholders so the full rail is represented even before those routes are implemented
- This closes the “nothing changed” usability miss by putting the parity navigation on the screen the operator actually uses as the main PIB surface.

## Addendum: 2026-04-22 Website & SEO importer alias gap corrected

- Live operator testing of the restored Base44 Website & SEO CSV flow revealed one more parity issue:
  - the Pond importer accepted the correct file format
  - but it still depended on exact community-name matches, which caused valid Base44 shorthand labels like `1604`, `Oakleaf`, and `Whitney` to fail
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/marketing-data.ts` now resolves the import target using canonical names plus alternate lookup keys already present in the community record shape
  - it also includes explicit shorthand alias support for the known Base44 labels above
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-data-import.test.ts`

## Addendum: 2026-04-22 Marketing surface visual hierarchy corrected

- After the import parity work landed, operator testing revealed a separate usability failure:
  - the Marketing screen was technically functional
  - but the neutral, low-contrast UI made primary actions, editable fields, and passive informational panels hard to distinguish quickly
- Correction now in place:
  - shared button / input / textarea primitives have stronger visual affordances
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now uses section bands, stronger action bars, and clearer step framing so the import flow and save/scan actions stand out immediately
- This is a UX correction rather than a model or routing change, but it materially improves operator speed and reduces “what is clickable?” ambiguity on one of the highest-touch POP Brief screens.

## Addendum: 2026-04-22 POP Brief defaults aligned to the active Spotlight workflow

- Operator feedback surfaced a workflow mismatch on the main POP Brief landing surface:
  - the page opened with no date and no property selected
  - the property selector exposed the entire active community set instead of the current monthly Spotlight list the operator is actually working through
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now defaults to the upcoming Friday
  - the same page now scopes the selector to the active April 2026 Spotlight list and auto-selects the first Spotlight property in that ordered set
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/community-selector.tsx` can now receive a curated property list directly, which lets POP Brief preserve monthly Spotlight ordering instead of forcing a generic alphabetical sort
- This is still a workflow-default change rather than a functional-model change, but it materially reduces repeated operator setup clicks on the main POP Brief screen.

## Addendum: 2026-04-22 POP Brief header actions consolidated into navigation

- Operator review identified another source of page-top clutter:
  - the header mixed primary selectors with two one-off buttons that did not deserve equal visual weight on every visit
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now uses a sticky header/control bar
  - the old `Export PDF` and `Update` buttons were removed from that top row
  - a single `Navigate` dropdown now exposes the main POP Brief route family and adjacent workflow destinations instead
- This is a navigation/control-surface cleanup, not a reporting-model change, but it makes the page top feel more like a stable operator console and less like a row of unrelated buttons.

## Addendum: 2026-04-22 POP Brief duplicate navigation board removed

- The sticky header cleanup surfaced a second-order UX issue right away:
  - the header now owned navigation cleanly
  - but the page still repeated that same route family in a large `POP Brief Navigation` card immediately below it
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` no longer renders the duplicate navigation board under the sticky header
  - the `Navigate` dropdown in the sticky header is now the single primary movement control for the POP Brief lane
- This is still a workflow/UX correction rather than a business-logic change, but it matters because the page now opens directly into the selected property brief instead of spending the first full viewport on repeated navigation furniture.

## Addendum: 2026-04-22 POP Brief date picker interaction tightened

- After the header cleanup, operator feedback exposed one more control-surface issue:
  - the calendar popover looked translucent against the content underneath
  - and it remained open after the Friday selection was already made
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/week-date-picker.tsx` now uses a controlled popover state so the picker closes immediately after selection
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/popover.tsx` now supports controlled open state and marks the trigger explicitly for more reliable outside-click behavior
  - the date-picker popover now renders on an opaque elevated white surface instead of feeling visually merged with the page below
- This is a small but important operator polish fix because the POP Brief header is now the primary daily control surface, so even minor friction there gets repeated constantly.

## Addendum: 2026-04-22 Communities page reordered to Spotlight-first

- Operator workflow feedback clarified that community creation is no longer the normal starting task on the Communities surface.
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` no longer leads with an `Add Community` form
  - the page now opens with a `This Month's Spotlight Properties` section driven by the active monthly Spotlight set
  - the full governed inventory remains immediately below as `All Communities`, with edit/delete maintenance actions still available there
- This is a workflow and information-hierarchy correction rather than a model change, but it matters because the page now reflects how operators actually use the surface: review the active Spotlight set first, then drop into exhaustive maintenance only when necessary.

## Addendum: 2026-04-22 Marketing page brought into POP Brief header/default pattern

- Operator review identified that the Marketing surface was still lagging behind the main POP Brief lane in two ways:
  - it did not yet share the same upcoming-Friday and Spotlight-first defaults
  - the legacy Base44 CSV import still dominated the first screen even though it is becoming a transition-only bridge
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now defaults to the upcoming Friday and scopes the selector to the active Spotlight set, auto-selecting the first Spotlight property
  - the page now uses the same sticky header/control treatment as the rest of the POP Brief lane
  - the Base44 Website & SEO CSV import is now hidden behind a collapsed legacy-import accordion instead of staying open as the primary page surface
- This keeps the current compatibility import available, but it makes canonical weekly marketing editing the default operator workflow and visually demotes the legacy bridge path ahead of future direct Data Pond ingest.

## Addendum: 2026-04-22 Marketing page restored to the sectioned Base44 editor shape

- A second operator check surfaced an important correction:
  - the simplified weekly-marketing surface was cleaner
  - but it was no longer the actual live Base44 page shape for Marketing
- Repo evidence confirmed that the imported Base44 marketing model is still fundamentally the seven-section `marketing_data` editor, backed by the preserved section schema in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0012_create_marketing_data.sql`
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` has been restored to the sectioned Base44-style editor
  - the newer sticky header treatment and Spotlight/upcoming-Friday defaults remain in place
  - the Website & SEO CSV importer remains available, but now as a secondary collapsed bridge utility rather than the page’s primary face
- This is a parity correction, not a new feature: it realigns the visible Marketing screen with the live app’s actual structure while keeping the cleaner page-top workflow defaults.

## Addendum: 2026-04-22 T7/T30 metrics pages brought into the shared POP Brief operator shell

- Operator review identified that the T7 and T30 metrics pages were still lagging behind the rest of the POP Brief lane in daily-use ergonomics:
  - they still opened as standalone pages without the newer sticky control-bar treatment
  - they did not default directly into the active Spotlight/upcoming-Friday working context
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/components/metrics/leasing-metrics-page.tsx` now drives both `/t7-metrics` and `/t30-metrics` with the same sticky header treatment already adopted by POP Brief and Marketing
  - the shared page defaults to the upcoming Friday
  - the shared community selector is now scoped to the active monthly Spotlight list and auto-selects the first Spotlight property on open
  - the header now also uses the same `Navigate` control family and no longer carries the leftover page-specific `Update` / `Clear Data` buttons
- This is a workflow-default correction rather than a model change, but it matters because it makes the import/edit screens open in the same ready-to-work context as the other daily POP Brief surfaces.

## Addendum: 2026-04-22 Base44 parity governance now explicit

- The remediation pass has now reached the stage where the remaining risk is less “obvious missing surface” and more “unproven equivalence.”
- To avoid overstating completion, the repo now carries:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_BASE44_PARITY_LEDGER_2026-04-22.md`
- That ledger explicitly separates:
  - matched business surfaces
  - intentional auth/user-management deviations
  - surfaces that appear intact but still need end-to-end proof
- This matters because the remaining work is now increasingly audit and verification shaped rather than pure reconstruction.

## Addendum: 2026-04-22 T7/T30 leasing metrics parity confirmed

- A likely-looking parity concern in the T7/T30 metrics lane turned out to be inherited Base44 behavior rather than Pond drift.
- The concern was that the Pond appears to query/store `type='portfolio'` rows as if they belong to the selected community.
- Source review confirmed this is how the imported Base44 model works:
  - the T7/T30 migrations require `community_id` on every row
  - the guest-card mirror script explicitly computes portfolio averages once and then writes duplicated `portfolio` rows per community
- That means the Pond’s T7/T30 metrics surfaces should be treated as parity-matched unless operator testing finds a behavioral mismatch not visible in code review.

## Addendum: 2026-04-23 Data Pond branding and POP Brief shell reconciled

- Operator review surfaced a release-shape problem rather than a fresh design problem:
  - the richer Data Pond landing/sidebar branding existed in the active local frontend files
  - the newer POP Brief header work had only been promoted partially
  - the resulting live app could therefore present mixed generations of the product shell at once
- The current intended frontend slice is now explicit:
  - `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` carries the richer Data Pond landing hero and featured-surface treatment
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` carries the larger branded Data Pond sidebar with `By MarketingOps`
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/pop-brief-page-header.tsx` is the shared POP Brief shell used by Analysis, Marketing, and the shared T7/T30 page
  - that shell places the date and property selectors on one line and the `Navigate` control on a second right-aligned line
  - the Marketing section editor remains Base44-shaped, but its section blocks are now true accordions closed by default
- This matters because the current platform problem is not only feature parity; it is also making sure operators see one coherent shell and identity system instead of alternating between partial frontend states.

## Addendum: 2026-04-23 Editor role boundary tightened to POP Brief-only operations

- Operator direction clarified that the product-facing `editor` role should no longer act as a broad curator across the Data Pond.
- The current intended editor experience is now:
  - The Pond as the allowed front door
  - the POP Brief lane as the only active operational workspace
  - the rest of the platform visible in the sidebar for orientation but not available for actual navigation
- That boundary is now enforced in both the web and API permission layers rather than only by hiding links.
- This matters because a role model that only changes the sidebar but still leaves routes and write APIs reachable would not be a real operational permission model.

## Addendum: 2026-04-24 POP Brief grounding core foundation

- Operator direction shifted the POP Brief work from restored UI parity into a more durable property-brief / Captain's Log grounding problem.
- The repo now has an explicit grounding-core architecture:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`
- The architecture defines the source-authority hierarchy:
  - Data Pond is authoritative for internal operating facts
  - AptIQ/ApartmentIQ-style reports are advisory market/comps intelligence; Data Pond governs internal operating facts
  - live property-page snapshots are authoritative for public-page state at crawl time
  - Captain's Log stores governed memory and decisions rather than raw fact ownership
- The durable schema foundation now exists in both API and POP Brief D1 migration paths:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0024_create_property_brief_grounding_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/011_property_brief_grounding.sql`
- The shared contract layer now includes:
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-schemas.ts`
- This adds source documents, normalized claims, reconciliations, and artifact blocks as first-class concepts so future POP Brief outputs can render from reconciled claims instead of raw vendor prose.
- Importantly, this does not mutate locked PIB generation or rendering behavior; it strengthens the briefing-family substrate around POP Brief and Captain's Log.

## Addendum: 2026-04-24 Captain operating model and The Pointe pilot tasking

- The property-scoped Captain role is now explicit rather than implied by Captain's Log storage.
- The new operating model lives at:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
- The first pilot property tasking lives at:
  - `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md`
- The Captain is responsible for source seeking, ingestion expectations, claim reconciliation, Captain's Log updates, watch-item continuity, and Supervisor-ready escalation.
- The Pointe Captain's first tasking focuses on:
  - A1 and B1 inventory pressure
  - concession leakage
  - applicant follow-up and cancellation reason tracking
  - AptIQ claim reconciliation against Data Pond
  - floorplan-specific messaging and action readiness
- This formalizes the intended path from report output to operating intelligence: Data Pond facts and advisory reports feed the grounding core; the Captain maintains property memory and action posture; Supervisor updates become the eventual decision/escalation product.

## Addendum: 2026-04-24 Property Evaluation Brief source-of-truth standard

- The The Pointe Bentonville evaluation report is now being formalized into a reusable property evaluation and resolution brief standard.
- The source-of-truth standard lives at:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md`
- The reusable Markdown template lives at:
  - `/Users/mark/Property_Analytics/reports/property_evaluation/templates/property_evaluation_resolution_brief_template.md`
- The standard defines:
  - source authority ladder
  - required evidence domains
  - required sections
  - source authority posture
  - action register
  - decision register
  - Captain's Log payload
  - publishability gate
- This makes the property evaluation brief a governed output family rather than a one-off synthesis artifact.

## Addendum: 2026-04-24 Unit-level concession feed included in property brief truth model

- The property evaluation truth model now recognizes unit-level pricing/specials from the ThirtyLines availability payload as an internal Data Pond fact source.
- This matters for The Pointe Bentonville because the 2026-04-24 `unit_availability.available_units_json` payload confirms broad `$3,000 off` public specials visibility across the returned available-apartment units.
- The remaining control task is now narrower and more useful:
  - public unit-level offer visibility can be read from Data Pond
  - booked concession dollars on signed leases should be rendered from the Pond lease/revenue feed
- The Captain and Property Evaluation Brief should therefore distinguish `offer visible on unit feed` from `concession cost booked on lease` instead of collapsing both into a generic missing-data item.

## Addendum: 2026-04-24 ThirtyLines ingestion hardened for Captain-ready unit truth

- ThirtyLines collection no longer only preserves unit detail inside a floorplan JSON blob.
- The collector now persists:
  - full raw feed payloads and feed QA counts in `thirtylines_feed_snapshots`
  - existing floorplan-level availability summaries in `unit_availability`
  - normalized daily unit snapshots in `unit_availability_units`
- This gives the Captain and Property Evaluation Brief a queryable source for unit-level rent, available date, floorplan, unit id, public specials message, and parsed advertised concession amount.
- The important authority boundary remains:
  - `unit_availability_units.pricing_and_specials_message` = active public offer visibility
  - booked concession dollars on signed leases = Pond lease/revenue feed metric to render into the brief

## Addendum: 2026-04-24 Property Evaluation Brief expanded to the full Pond operating chain

- Property Evaluation / Captain briefs should not stop at AptIQ plus leasing funnel and inventory.
- The intended report model now pulls together the full Pond chain:
  - GSC for search visibility and query intent
  - GA4 for sessions, channel engagement, and high-intent actions
  - PSI / PageSpeed for mobile/desktop conversion friction
  - Google Ads for paid spend, keywords, clicks, and conversion tracking, with freshness flags
  - GBP insights, reviews, and sentiment for local trust and objection themes
  - guest-card metrics for actual leasing demand
  - ThirtyLines floorplan/unit snapshots for inventory, offer visibility, and unit aging
  - PMS/leasing/revenue truth for occupancy, leases, cancellations, and booked concession dollars where available
- This makes the Captain's role a true operating-intelligence role: connect visibility, traffic quality, experience, paid/local demand, leasing action, revenue protection, and physical inventory into one action plan.

## Addendum: 2026-04-24 Property Evaluation Brief source-authority posture

- Operator feedback clarified that property briefs must read as authoritative operating narratives rather than uncertain prose.
- The reusable Property Evaluation Brief standard now separates:
  - source-of-record facts
  - public-state facts
  - advisory market intelligence
  - routing gaps
  - unresolved source conflicts
- This distinction matters because a Pond value that is not yet surfaced into the report is a composition/routing issue, not a reason to ask operators to re-confirm reality.
- The Pointe report, PIB-style email artifact, and Captain tasking now frame occupancy, leased percentage, lease count, cancellations, and booked concession dollars as Pond source-of-record metrics to render into the Captain brief when the feed is available.
- The standing authority rule is unchanged but sharper: AptIQ advises; Data Pond governs.

## Addendum: 2026-04-24 The Pointe Google Ads activity verified

- A targeted live Google Ads API check for The Pointe Bentonville confirmed that the property is mapped to customer `9089267423`.
- The 2026-03-20 to 2026-04-23 check window returned one campaign-day record on 2026-03-20 and no campaign activity after that date.
- The campaign `1185 Pointe Bentonville MKT PPC` was paused on 2026-03-20.
- The Pointe report family should therefore treat Google Ads as paused/no-activity after 2026-03-20, not as merely stale local data.

## Addendum: 2026-04-24 The Pointe Captain identity and PIB presentation standard

- The Pointe Bentonville's property Captain identity is now `Captain Benton`.
- The Property Evaluation Brief standard now carries PIB-family presentation rules:
  - visible property ID uses the property code, such as `AR4PB`
  - user-facing dates use `MM/DD/YYYY`
  - email artifacts use the Venterra / PIB header and KPI card language
  - unit references use operator-facing building plus apartment numbers rather than feed system ids
  - the guest-card KPI label is `Guest Cards`
- This keeps the Captain brief from reading like a technical extract while preserving the Pond as the evidence authority.

## Addendum: 2026-04-24 Captain's Log and Captain's Brief report set

- The naming rule is now explicit:
  - `Captain's Log` is durable property memory, decisions, watch items, evidence references, and follow-up state.
  - `Captain's Brief` is the polished outbound read generated from the log plus current Pond facts.
- The standard lives at:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
- The reusable template lives at:
  - `/Users/mark/Property_Analytics/reports/captains_log/templates/captains_log_entry_template.md`
- The first The Pointe / Captain Benton set now lives at:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_log_2026-04-24.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_brief_email_2026-04-24.html`
- This creates a recurring report/email family around the Captain role without mutating locked PIB generation or rendering behavior.

## Addendum: 2026-04-24 Captain Benton shared memory and support agents

- The first Captain's Log concept entry is now represented as shared memory, not only a Markdown/email artifact.
- The local D1 memory substrate contains the The Pointe / Captain Benton seed:
  - governed memory entry `mem_ar4pb_captain_benton_20260424_001`
  - Captain identity binding `Captain Benton`
  - evidence references back to Captain Log, Property Evaluation Brief, Data Pond guest cards, unit feed, and Google Ads API recheck
  - property-brief source documents, grounded claims, reconciliations, and reusable `captain_log_update` artifact block
- A new `captain_support_agents` table defines property-scoped support agents that keep the Captain supplied with source truth.
- The first active support roster for The Pointe is:
  - Benton Source Scout
  - Benton Truth Reconciler
  - Benton Inventory Watch
  - Benton Funnel Watch
  - Benton Media Watch
  - Benton Supervisor Scribe
- The support agents are watchers and assemblers, not separate truth owners. Data Pond remains the governing internal source; AptIQ remains advisory.
- Remote D1 promotion was applied through the repo's Keeper-backed Wrangler runtime helper.
- Remote verification confirmed `Captain Benton` as the sole The Pointe Captain identity binding, six active `AR4PB` support agents, eight grounded property-brief claims, and five evidence refs for `mem_ar4pb_captain_benton_20260424_001`.

## Addendum: 2026-04-24 Captain runtime foundation

- The Captain's Log / Brief capability now has a Worker-side runtime foundation in the app API.
- New runtime tables:
  - `captain_agent_runs`
  - `captain_watch_items`
  - `captain_actions`
  - `captain_brief_runs`
- New API implementation paths:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
- New API route family:
  - `/v1/captain/properties/:propertyId/status`
  - `/v1/captain/properties/:propertyId/run`
  - `/v1/captain/properties/:propertyId/brief`
- The API Worker now has cron triggers configured for daily and weekly Captain execution, with the support-agent roster read from D1.
- The runtime keeps raw collection ownership in Data Collection while the Worker consumes mirrored D1/R2 facts and writes operating memory, watch items, actions, and brief readiness.
- The runtime schema was applied to remote `pop-brief-db`.
- Production API Worker deployment completed:
  - Worker: `pop-brief-api`
  - URL: `https://pop-brief-api.mlaufhutte.workers.dev`
  - Version ID: `1c2633b7-0dad-44c5-b14b-05dfb63b3014`
  - schedules: `15 12 * * *` and `45 13 * * 1`
- Post-deploy verification confirmed the public health endpoint and the remote Captain runtime tables.

## Addendum: 2026-04-25 Captain Benton remote D1 reconciliation

- The first scheduled Captain Benton run on 2026-04-25 proved the Worker schedule was active, but it also exposed that the remote D1 source mirror did not yet include the AR4PB source-level tables needed by the Captain runtime.
- A narrow Captain source mirror now exists at:
  - `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`
- Remote `pop-brief-db` was reconciled for The Pointe / `AR4PB` / `482958962` with Guest Cards, unit availability, GA4, compact GSC, Google Ads, PSI, and GBP source rows.
- The Captain runtime now handles the existing remote app-shaped `gsc_daily_metrics` table keyed by `community_id`, in addition to raw source-shaped GSC rows where those exist.
- Source Scout now treats a paused Google Ads campaign as `paused_no_current_activity` rather than a stale source-routing defect.
- The API Worker was redeployed through the Captain-runtime reconciliation as version `82eed1a9-3c68-459e-a491-b902dc9683ed`.
- Manual post-reconciliation run confirmed:
  - Source Scout succeeds with all expected sources present and no stale source warnings
  - Funnel Watch succeeds from Guest Card rows
  - Media Watch succeeds from GA4/GSC/Ads/PSI/GBP rows
  - Inventory Watch correctly remains warning because A1/B1 and 365+ day unit pressure is real operating content
  - Truth Reconciler correctly remains warning because one booked-concession claim is now a formal source conflict, not an unknown source-routing problem

## Addendum: 2026-04-25 first clean live Captain Brief run

- The stale watch/action rows created before the AR4PB source-table mirror was reconciled were closed in remote D1.
- The two prior `needs_review` claims were resolved into authoritative states:
  - Guest Card coverage is now `pond_verified`
  - booked concession dollars remain a formal `conflict` pending lease/revenue source routing
- A deployed Worker run of `benton_supervisor_scribe` succeeded as `captain_run_AR4PB_benton_supervisor_scribe_20260425202039_90a125a9`.
- The first clean live Captain Brief draft was created as `captain_brief_AR4PB_20260425202040_b9ac1686` for `2026-03-26` through `2026-04-25`.
- The current live brief posture now separates real operating pressure from resolved source-routing noise: A1/B1 aged inventory, four 365+ day units, and booked-concession source conflict remain open; missing Guest Card/unit-feed/source-freshness items do not.

## Addendum: 2026-04-25 Captain Brief read surface

- The Captain Brief now has a read model rather than only persisted rows.
- The API exposes `GET /v1/captain/properties/:propertyId/brief/latest`, which composes:
  - latest Captain Brief run
  - Captain identity and period
  - active watch/action state
  - resolved source-routing state
  - current source freshness/readiness
  - unit-level aged inventory detail from `unit_availability_units`
- The web app now has `/analysis/captain` as the first Captain Brief operating surface.
- The aged inventory read includes actual apartment numbers, floorplans, move-out dates, available dates, days unleased, rent, public specials text, and parsed advertised concession amount.
- Remote API verification confirmed the live route returns `Captain Benton`, clean source dates, 38 units at 30+ days, 33 at 60+ days, 25 at 90+ days, 17 at 180+ days, 4 at 365+ days, and actual aged unit numbers.
- `pop-brief-api` was redeployed as version `1aa6d6e7-7610-455d-9f6e-44b219532338`.

## Addendum: 2026-04-25 operating metrics source route

- The lease/revenue/booked-concession question was investigated against local Pond tables and the current BI/Measurement files in the shared `Guest_Card_Reports` drop.
- Current finding: the Pond has authoritative public concession visibility in the unit feed, but it does not yet have a populated source-of-record table for booked concession dollars on signed leases for AR4PB.
- Current BI workbooks `BI-Metrics-Run20260424.xlsx` and `BI-Metrics-Run20260423-NewFormat.xlsx` contain pilot conversion metrics, not The Pointe / AR4PB lease-revenue rows.
- A new source-of-record landing contract now exists:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md`
  - `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0028_create_property_operating_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/015_create_property_operating_metrics.sql`
- `property_operating_metrics` is designed to hold official occupancy, leased percentage, lease count, cancellations/denials, move-ins/move-outs, and booked concession dollars.
- The operating metrics importer now accepts CSV/XLSX/XLSM files, normalizes common operating-feed headers, writes local Pond rows, and can upsert those rows into remote D1.
- The Captain source-table mirror now includes `property_operating_metrics` when local rows exist, so official operating facts flow into Captain Brief reads without relying on AptIQ inferred values.
- Data Collection now has a wrapper at `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`, and the daily collector plus retry worker monitor the shared manual drop for operating-metrics files on the same cadence pattern as BI workbooks.
- Watchtower/advisory freshness recognizes `property_operating_metrics` as a same-day manual source backed by `property_operating_metrics.metric_date`.
- Missing official operating files are now escalated explicitly as `No official operating metrics file received for AR4PB.` with the recommended filename pattern `Property-Operating-Metrics-AR4PB-YYYYMMDD.csv`.
- The Captain Brief read model and `/analysis/captain` now expose an Operating Snapshot lane.
- Remote D1 migration was applied and `pop-brief-api` was redeployed as version `728fd38d-07fd-481f-a97a-acec4bb60ba8`.
- Live route verification confirms AR4PB currently reports `operatingSnapshot.status = missing_source` and points to `property_operating_metrics`, keeping the brief authoritative instead of conflating advertised concession eligibility with booked lease concession cost.

## Addendum: 2026-04-27 available unit interest BI source

- The Marketing BI `Available Units With Low Inquiries` / `Guest Cards Per Unit Type` export is now represented as an advisory BI source for Captain Brief work.
- Added:
  - `/Users/mark/Property_Analytics/docs/AVAILABLE_UNIT_INTEREST_SOURCE_CONTRACT_2026-04-27.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/available_unit_interest_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0029_create_available_unit_interest_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/016_create_available_unit_interest_metrics.sql`
- The current PDF export loaded 21 rows into `available_unit_interest_metrics`.
- The 2026-04-27 Pointe row maps to `AR4PB` and provides available units, vacant/notice split, T7/T30 guest-card volume per available unit, demand deltas, and prospect quote volume.
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors the AR4PB available-unit-interest row into remote D1 with Benton’s source packet.
- The adjacent Marketing BI lanes visible for future evaluation are T365D Move-ins with Mktg Source, Traffic Conversions, Property Cancel/Denial by Mktg Source, WOW Program Spending, SmartDesk 2.0, and Value Proposition Dashboard.

## Addendum: 2026-04-28 Marketing BI conversion diagnostics

- The Marketing BI `Property CancelDenial by Mktg Source` and `Traffic Conversions T7D-T90D` exports are now represented as advisory conversion diagnostics for Captain Brief work.
- Added:
  - `/Users/mark/Property_Analytics/docs/MARKETING_BI_CONVERSION_SOURCE_CONTRACT_2026-04-28.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_conversion_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/017_create_marketing_bi_conversion_sources.sql`
- The current cancel/denial PDF loaded 24 The Pointe rows into `marketing_cancel_denial_by_source`.
- The current traffic conversions PDF loaded one The Pointe row into `marketing_traffic_conversions`.
- The initial Benton read from these reports is that The Pointe has strong T30 guest-card YoY lift, while the Website and Google channels show important cancellation/denial friction, particularly `Abandoned` cancellations and `Failed Credit or Criminal` denials.
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors both marketing conversion tables into remote D1 with Benton’s source packet.

## Addendum: 2026-04-28 property identity matrix

- A governed property identity matrix now exists at `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
- The matrix is built from the local canonical `properties` table, the official registry, and the app community seed, then validated by `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`.
- It formalizes the working rule that property code is the visible / Captain-facing id where available, while GA4 id, GSC URL, app community UUID, website URL, Encasa short name, GBP location id, company id, unit count, and report aliases remain attached to the same identity record.
- The first enforcement landed in the Marketing BI conversion and daily packet ingesters through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Validation confirmed The Pointe now resolves through one source as `AR4PB` / GA4 `482958962` / community id `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`, and current Marketing BI dry runs map all visible property rows without local hardcoded Pointe exceptions.

## Addendum: 2026-04-28 property identity governance requirement

- `AGENTS.md` now has a Property Identity Discipline section requiring source ingestion, Captain reads, report inputs, and property-scoped automations to use the governed matrix.
- Added `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh` and its Python implementation to validate matrix health and required resolver usage.
- Expanded resolver usage to the Available Unit Interest parser, operating metrics importer/wrapper, and Captain source D1 mirror.
- `captain_sources_to_d1.py` now resolves `--property-key` into property code, GA4 id, and community id, which prevents the Captain mirror from carrying separate hardcoded ID defaults.
- `operating_metrics_to_d1.py` now resolves `--property-key` and matches rows against matrix aliases, allowing future operating files to use property code, name, short name, GA4 id, or other governed aliases.

## Addendum: 2026-04-28 property identity community coverage completed

- A remote D1 community snapshot now lives at `/Users/mark/Property_Analytics/config/generated/remote_communities_snapshot.json`, refreshed by `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`.
- The identity matrix builder now merges remote D1 communities before falling back to the older local generated community seed.
- One missing active community, `Retreat at Kedron Village` (`GA4KV`, GA4 `378387143`), was inserted into remote D1 as `b535df1b-ab66-53bc-9223-c748dd500acc`.
- Rebuilt matrix coverage is now 93 properties, 93 app/D1 community ids, and 91 property codes. The two no-code rows are prelaunch/non-standard communities without operating property codes in the local source table.
- The property identity governance check now fails if community-id coverage falls below the matrix property count.

## Addendum: 2026-04-28 DataForSEO Keeper credential setup

- A structured Keeper record now exists for `DataForSEO API Credentials` in the MarketingOps Keeper folder.
- Active notation mapping was added to `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`.
- New helper `/Users/mark/Property_Analytics/utils/dataforseo_auth.py` resolves login/password through Keeper-first notation with direct-env fallback.
- New verification script `/Users/mark/Property_Analytics/scripts/check_dataforseo_auth.py` confirms authentication without printing secrets.
- Live verification against `https://api.dataforseo.com/v3/appendix/user_data` returned DataForSEO status code `20000`.
- Security note: because the initial credential was shared via screenshot, rotate the DataForSEO API password after the first Collector path is wired and verified.

## Addendum: 2026-04-28 DataForSEO SERP source route

- DataForSEO now has a governed local source route for live SERP evidence rather than being treated as a one-off API experiment.
- Added:
  - `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/dataforseo_serp_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0032_create_dataforseo_serp_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/019_create_dataforseo_serp_tables.sql`
- Local storage now includes `dataforseo_serp_runs`, `dataforseo_serp_results`, and `dataforseo_property_keyword_rankings`.
- The initial April 2026 Spotlight run loaded 23 property brand SERPs from `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`.
- The first run stored 23 task rows, 574 normalized SERP result rows, target-found rankings for 17 of 23 Spotlight properties, and total DataForSEO cost of `$0.0805`.
- Current limitation: local April Spotlight property records do not yet contain dependable city/state values, so local-market keyword expansion should wait for identity/address enrichment rather than guessing.

## Addendum: 2026-04-28 property location enrichment

- The local `properties` table is now enriched to 93/93 city/state coverage.
- Added `/Users/mark/Property_Analytics/scripts/enrich_property_locations.py` as the repeatable backfill path.
- City values are sourced primarily from `/Users/mark/Property_Analytics/config/gbp_location_names.json` through the existing `gbp_location_id` join.
- State values are inferred through governed property-code prefixes, Encasa region, and Spotlight registry location where available.
- The property identity matrix builder now carries `city` and `state`, and `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` exposes those fields through `resolve_property_identity()`.
- DataForSEO keyword generation now has enough property context to create local-market terms without guessing.

## Addendum: 2026-04-28 DataForSEO deep enrichment trial

- A deeper AR4PB / The Pointe Bentonville trial was run against DataForSEO Keyword Data, DataForSEO Labs, OnPage, Business Data, and AI Optimization.
- Added:
  - `/Users/mark/Property_Analytics/scripts/run_dataforseo_spotlight_deep_trial.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0033_create_dataforseo_enrichment_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/020_create_dataforseo_enrichment_tables.sql`
- Added local/remote schema for `dataforseo_keyword_metrics`, `dataforseo_labs_ranked_keywords`, `dataforseo_onpage_page_snapshots`, `dataforseo_business_profiles`, and `dataforseo_ai_visibility_probes`.
- The trial proved that the Captain/Spotlight report can be enriched with keyword demand/CPC/competition, property-page ranked keywords, OnPage SEO/content checks, live Google business profile facts, and AI answer visibility.
- The Backlinks API returned subscription access denied, so backlink authority data requires a separate Backlinks subscription.
- Subsequent paid calls returned `40200 Payment Required`; the trial account balance is exhausted until refreshed.
- Trial report: `/Users/mark/Property_Analytics/reports/dataforseo/deep_trial/2026-04-28/AR4PB/dataforseo_deep_trial_report.md`.

## Addendum: 2026-04-29 DataForSEO Backlinks and LLM Mentions trial

- The DataForSEO account was funded and the Backlinks plus LLM Mentions trial subscriptions were activated for focused Captain fact-finding.
- A new AR4PB / The Pointe Bentonville test confirmed that DataForSEO can now support a Ranked-style Navigator Dossier inside the Captain's Log:
  - keyword demand and CPC
  - live SERP rankings
  - Labs ranked-keyword discovery
  - OnPage technical/content checks
  - Google Business Profile/entity facts
  - backlink summary and backlink/referring-domain detail
  - direct AI response probing
  - LLM Mentions search/top-domain testing
- The focused Pointe test after subscriptions were active cost approximately `$0.5245`, leaving a DataForSEO balance of `$49.039147`.
- Backlinks now return usable authority data for AR4PB: rank `37`, `61` backlinks, `55` referring domains, `53` referring main domains, and `0` broken backlinks.
- LLM Mentions returned valid paid responses, but the first AR4PB read shows The Pointe is mentionable in a direct recommendation prompt while not yet broadly present in generic Bentonville apartment AI-memory rows. That distinction is important for Captain reporting and content strategy.
- Fact-finding report: `/Users/mark/Property_Analytics/reports/dataforseo/fact_finding/2026-04-29/AR4PB/pointe_dataforseo_captain_fact_finding_2026-04-29.md`.

## Addendum: 2026-04-29 Captain Specs and Active Property-Life Awareness

- Captain doctrine now explicitly treats the Captain as an active property steward rather than a report narrator.
- The Captain's Log must preserve Specs Memory when a read touches website, content, HTML, metadata, schema, local entity, SEO, or AI visibility.
- Website/content/SEO/AI-visibility recommendations now require a grounding chain:
  - Specs standard
  - live reality
  - external evidence such as DataForSEO, GSC, GA4, GBP, PSI, or reviews
  - directive with exact page/content/HTML action
  - follow-up proof source
- Updated doctrine files:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`

## Addendum: 2026-04-29 Captain support-team accountability

- Captain doctrine now makes the Captain accountable for orchestration and quality control across the entire property intelligence team.
- Support agents remain lane specialists, but the Captain must know whether each lane is current, stale, blocked, or failing to produce action-ready intelligence.
- BrowserStack and EVS are now explicitly part of the Engineer / Experience Watch lane for proof of actual prospect/resident experience across devices, viewports, forms, CTAs, specials visibility, and post-change validation.
- Updated doctrine files:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`

## Addendum: 2026-04-29 Captain Benton scheduled runtime expansion

- The API Worker Captain runtime now has live support-agent handlers for:
  - `benton_navigator_watch`
  - `benton_experience_watch`
  - `benton_boatswain`
  - `benton_logkeeper`
- Remote D1 `captain_support_agents` for `AR4PB` now has 10 active agents.
- Daily lanes: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, Navigator Watch, Experience Watch, and Boatswain.
- Weekly lanes: Logkeeper and Supervisor Scribe.
- Deployed Worker version after the expansion and platform test cleanup: `6e8d43b2-2536-47c6-9e99-da2281bca66c`.
- API module shape now supports both deployed Worker execution (`fetch`/`scheduled`) and local Hono route tests (`request`), preventing Captain cron support from breaking platform route coverage.
- EVS API permissions now explicitly permit editors to draft requests and record handoffs while preserving viewer blocks, matching the EVS lifecycle contract.
- The Worker cron schedule remains `15 12 * * *` for daily lanes and `45 13 * * 1` for weekly lanes. Paid DataForSEO and BrowserStack work remains in governed collection/EVS lanes; the Captain Worker consumes mirrored evidence and raises watch/action state.
- Roster seed artifact:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_expanded_support_roster_2026-04-29.sql`

## Addendum: 2026-04-29 Captain Brief Performance Analysis bridge

- The local vNext Captain Brief generator now includes the familiar analyst Performance Analysis evidence layer:
  - T7 Performance
  - T30 Performance
  - reported advertising spend
  - marketing / website / SEO / current-special notes
- This layer is intentionally carried as reported performance context and then reconciled against Pond facts and Benton directives, so the new Captain's Brief can replace the current performance dashboard without stripping away the tables analysts already use.
- The 04/29/2026 The Pointe Bentonville artifact was regenerated and emailed to `mlaufhutte@venterraliving.com`; delivery message id `70bf720a-55ee-420a-a0e2-35ce058eb32b@property-analytics.local`.

## Addendum: 2026-04-29 Marketing BI packet and conversion summary structuring

- Additional Marketing BI full-packet exports from 04/29/2026 were consumed as governed packet evidence:
  - `/Users/mark/Downloads/Portfolio Summary.pdf`
  - `/Users/mark/Downloads/Ad Spend.pdf`
  - `/Users/mark/Downloads/conver perf summart`
- The daily packet evidence tables now preserve packet metadata, all page text, and Portfolio Summary property rows for the Captain source packet.
- `marketing_bi_packet_ingest.py` now also promotes the clean tabular `Conversion Performance Summary` page into `marketing_bi_conversion_performance_summary`.
- The new structured table captures portfolio monthly/total units, paid guest cards, paid visits, paid applications, paid leases, all guest cards, all visits, all applications, all leases, paid/all cost-per-conversion metrics, and portfolio spend split across total, Google, traditional, and social.
- Remote D1 now receives this table through `captain_sources_to_d1.py`; the 04/28/2026 sync loaded 5 structured conversion-summary rows.
- The `Ad Spend` page remains evidence-only until a tabular property/source spend export is available. Its PDF chart labels are useful for human context but are not reliable enough to auto-fill property spend in a Captain Brief.

## Addendum: 2026-04-29 Marketing BI cancel/denial native export

- The `Property CancelDenial by Mktg Source` lane now supports the native Power BI Excel export at `/Users/mark/Downloads/cancel.xlsx`.
- This materially improves the source posture: PDF exports remain available for spot checks, but Excel is the complete portfolio load and avoids visible-viewport truncation.
- The 2026-04-29 Excel load produced 4,750 detail rows across 91 resolved properties, with portfolio totals of 28,481 C&Ds, 39,284 applications, and 187,480 guest cards.
- Property identity resolution stayed governed through `Data_Collection/utils/property_identity.py`; no downstream property-map exception was introduced.
- Captain Brief cancel/denial reads now prefer the latest Excel source when both PDF and Excel sources exist for the same date, so duplicated or partial PDF rows do not distort the action read.

## Addendum: 2026-04-29 Marketing BI native Excel export expansion

- Seven additional native Excel exports were added to the Captain source model:
  - property-month ad spend
  - performance by source
  - top cancel/denial reasons
  - guest cards by source
  - traffic performance
  - portfolio summary
  - full Traffic Conversions
- New ingester: `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py`.
- New tables:
  - `marketing_bi_portfolio_summary`
  - `marketing_bi_ad_spend_property_month`
  - `marketing_bi_traffic_conversions_full`
  - `marketing_bi_excel_export_rows`
- The full Traffic Conversions Excel source materially closes prior report gaps because it includes visits, applications, RFP, closing ratios, unit count, and ATR averages by T7/T30/T60/T90 window.
- The smaller top-source/top-reason exports are preserved in a generic evidence table until their long-term report use warrants purpose-built tables.
- The Portfolio Summary export is advisory BI context only. Its reported `Apts` field can differ from the governed property identity/unit-count source and must not override official unit counts.

## Addendum: 2026-04-29 Marketing BI conversion dashboard native export

- The native Excel `conversion dashboard.xlsx` export is now promoted into `marketing_bi_conversion_dashboard_rows`.
- The table stores property-level conversion, comparison, delta, ATR average, and ATR delta by initial contact type.
- The 2026-04-29 load produced 728 rows across 91 properties and 8 contact types.
- This source closes another analyst-report gap by showing which initial-contact paths are generating or losing conversion volume, without relying on screenshot interpretation.

## Addendum: 2026-04-29 Marketing BI recovery-source native exports

- A larger native Excel recovery batch is now represented in the Captain source model.
- New tables preserve structured recovery evidence for vacancy-day unit rows, lease terms, WOW spending, ad spend plus guest-card/visit/lease performance by month, and portfolio period leakage metrics.
- This closes several Captain Brief question lanes: make-ready/vacancy aging risk, source spend vs output, lease leakage, lease-term strategy, and resident/program leakage signals.
- `Cost per Conversion by Ad Source.xlsx` and `Cost per Conversion - Trend.xlsx` currently contain invalid worksheet XML values (`NaN`) and require either clean re-export or a dedicated repair/parser path before they can be promoted safely.

## Addendum: 2026-04-29 Marketing BI cost-per-conversion malformed export handling

- Power BI cost-per-conversion exports can contain literal `NaN` / `Infinity` worksheet values that are invalid for standard XLSX readers.
- The Marketing BI Excel ingester now has a direct worksheet XML fallback for those files, preserving valid rows and treating non-computable values as nulls with an explicit `invalid_value_count`.

## Addendum: 2026-05-01 Shared-drop conversion workbooks promoted into the governed BI Excel lane

- The shared `Guest_Card_Reports` drop now contains additional conversion workbooks that belong in the same governed Marketing BI Excel path rather than a sidecar analyst workflow.
- `conversion-data.xlsx` is treated as a native alias of the earlier `conversion dashboard.xlsx` export and now lands in `marketing_bi_conversion_dashboard_rows`.
- `converting-performance.xlsx` and `marketing-performance.xlsx` are preserved in `marketing_bi_excel_export_rows` as full-fidelity portfolio evidence.
- This means the Data Pond now retains:
  - property/contact-type conversion rows from `conversion-data.xlsx`
  - property-level conversion rollups from `converting-performance.xlsx`
  - source/origin-sliced conversion performance from `marketing-performance.xlsx`
- These shared-drop files are now governed source artifacts even though only `conversion-data.xlsx` has been promoted into a purpose-built table so far.
- New table: `marketing_bi_cost_per_conversion_rows`.
- The 2026-04-29 load produced 1,092 rows across 91 properties and flagged 2,812 invalid/non-computable exported values.

## Addendum: 2026-04-29 Spotlight and pilot Captain activation

- Captain's Log runtime ownership has expanded from Benton-first to property-neutral Captain execution.
- `apps/api/src/platform/captain/runtime.ts` now resolves support agents by role suffix, so legacy `benton_*` keys and new property-specific keys such as `anatole_*`, `calais_*`, and `luma_*` execute the same support lanes.
- Pointe-specific fallback filters were removed from Captain source-read queries; Marketing BI / interest / traffic / cancel-denial reads now use governed property code and community id.
- New activation generator: `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`.
- Remote D1 now has governed activation memory and 10 support agents for each of 28 properties: the 23 active April Spotlight properties plus the five documented pilot properties.
- Verified remote roster state:
  - `280` active support agents
  - `28` active Captain properties
  - `224` daily lanes
  - `56` weekly lanes
  - `28` activation memory entries
- Deployment after runtime generalization: Worker version `593c0b52-a019-4f55-9e3f-ed471d8f8427`.
- The Captain cron schedule remains daily at `15 12 * * *` and weekly at `45 13 * * 1`; it should consume mirrored evidence and write watch/action/run state, while paid or heavy external pulls such as DataForSEO and BrowserStack remain in governed collection / EVS lanes.

## Addendum: 2026-04-29 DataForSEO Navigator evidence catch-up

- The activated Captain roster now has a same-day DataForSEO evidence packet in local Pond and remote D1.
- Broad SERP collection ran against all 28 activated Spotlight/pilot properties with two keywords per property. It produced 56 requests, 43 target matches, and an observed API cost of `$0.196`.
- Deep Navigator collection then ran for all 28 properties and succeeded for every property. The pass captured keyword demand, Labs ranked keywords, OnPage page-health snapshots, Google Business Profile/entity reads, backlink summary raw evidence, and AI visibility probes at an observed cost of `$4.086497`.
- A new narrow remote mirror was added at `/Users/mark/Property_Analytics/apps/api/scripts/dataforseo_captain_to_d1.py`. It applies the existing DataForSEO migrations and mirrors the DataForSEO evidence tables without rerunning the larger Captain source sync.
- Remote D1 now contains 04/29/2026 DataForSEO rows for all 28 activated Captain properties:
  - 60 SERP run rows
  - 1,517 SERP result rows
  - 60 normalized property keyword ranking rows
  - 83 keyword metric rows
  - 560 Labs ranked-keyword rows
  - 28 OnPage snapshot rows
  - 28 business profile rows
  - 31 AI visibility probe rows
- The first full-file import hit a Wrangler fetch failure after upload, and one large SERP-result chunk hit the same transient failure. The schema and row loads were completed with smaller idempotent chunk imports, then verified by remote counts.
- System boundary: DataForSEO remains a Data Collection / Navigator source. Captains should not spend API credits directly from cron; they should consume mirrored rows and generate watch items, action assignments, and Brief/Log directives.

## Addendum: 2026-04-30 Captain cron bucket correction

- The first post-catch-up attempt to run the expanded Captain roster through a single scheduled invocation exposed a real Worker-runtime limit: one invocation cannot safely execute the whole 28-property daily support-agent fleet.
- `runScheduledCaptains` now buckets active support agents deterministically by property id + agent key instead of running every eligible support agent in one call.
- Cloudflare's current account plan allows a maximum of five cron triggers, so the deployed schedule is:
  - `0 12 * * *`
  - `20 12 * * *`
  - `40 12 * * *`
  - `0 13 * * *`
  - `30 13 * * 1`
- The first four triggers rotate through 16 daily Captain buckets. The Monday trigger rotates through 4 weekly Captain buckets.
- The scheduled handler now awaits the bucket work directly instead of returning through `ctx.waitUntil`.
- Final deployed Worker version after the correction: `8dd446ae-4e92-4b9d-afde-4e73121c61ce`.
- Manual runtime proof after DataForSEO catch-up:
  - Captain Benton / `AR4PB` ran all support lanes and produced refreshed actions/watch items, including Specs-backed web/content tickets from DataForSEO OnPage/search evidence, BrowserStack/EVS validation action, source-authority action, aged-unit action, and Boatswain follow-through.
  - Captain Cane / `FL4CI` and Captain Botanic / `GA4BL` also proved property-neutral runtime execution.
  - Remote D1 verified 520 Captain agent runs across all 28 activated properties, 138 updated watch items across 27 properties, and 63 updated actions across 17 properties after `2026-04-30T01:17:00Z`.
- Rapid manual HTTP catch-up through browser-protected Worker routes can trip Cloudflare `1010` protection. Future fleet catch-up should use the bucketed schedule or a governed internal service trigger rather than rapid manual route loops.

## Addendum: 2026-04-30 Spotlight Captain Brief property-safe test

- The first non-Pointe Spotlight Captain Brief test ran for Avasa at 1604 / `TX416`.
- The Spotlight Captain Brief generator now avoids prototype-specific property and market language and composes generic Captain/Admiral, website/SEO, friction, and action-plan language from the governed property context.

## Addendum: 2026-05-01 Captain Brief display standard v1.2

- The Captain's Brief family now has an active display baseline named `v1.2`.
- Canonical display standard:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md`
- The standard is referenced from:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
- The first approved proof artifact is:
  - `/Users/mark/Property_Analytics/reports/captains_log/emergency/elation_at_grandway_west/elation_high_alert_seo_scan_2026-05-01_readable_email_outlook.html`
- The display standard exists because the data depth is now high enough that spreadsheet-style prose rows reduce comprehension. Captain artifacts should expose the same facts through at-a-glance KPI tiles, grouped evidence blocks, short `Read:` statements, and owner/action/proof directives.
- This is a Captain's Log / POP Brief-family presentation standard. It does not mutate locked PIB generation or rendering behavior.
- The Captain header is now locked through `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`, which mirrors PIB header scale and uses the real Venterra logo as a validated base64 image rather than a text-only fallback.
- Active Captain generators now call that shared renderer, and `/Users/mark/Property_Analytics/scripts/check_captains_brief_header_lock.sh` enforces that they do not reintroduce custom text-only `VENTERRA` headers or oversized title/property typography.
- When the BI Available Units / Guest Cards per Unit Type row is not present for the property, the generator uses the current unit feed as a labeled exposure fallback instead of treating missing BI as zero available units.
- Traffic Conversions now supplies fallback T7/T30 guest-card values when the available-unit interest source is absent.
- The Avasa test output demonstrates the intended audit posture: source gaps are stated explicitly, while available Pond evidence still produces a useful property-specific Captain read.

## Addendum: 2026-05-04 Marketing Operations / Flagship doctrine formalization

- The system now has an explicit department-level operating doctrine for the Captain program rather than relying only on individual feature docs and runtime behavior.
- New doctrine artifacts:
  - `/Users/mark/Property_Analytics/docs/MARKETING_OPERATIONS_CHARTER_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/FLAGSHIP_OPERATING_MODEL_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_DOCTRINE_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_READINESS_CHECKLIST_2026-05-04.md`
- These documents formalize three layers that were already emerging in the system:
  - `Marketing Operations` as the department
  - `The Flagship` as the operating model that links Pond facts, source lanes, Captain runtime, command reads, and memory
  - `Captain` as the named property-scoped intelligence owner accountable for directive quality and support-lane sufficiency
- The doctrine now explicitly defines:
  - a six-step operating method: Collect, Reconcile, Diagnose, Direct, Track, Learn
  - command posture implications for `Critical`, `Spotlight`, and `Sale` designations
  - a minimum readiness standard before a property should be treated as fully stood up under a Captain
- System significance:
  - future Captain activation, monthly designation refresh, support-lane staffing, and command-read work now has a canonical policy layer to extend
  - the platform should not treat roster presence alone as proof that a property has full Captain coverage; readiness requires governed identity, source posture, memory, action paths, and escalation paths

## Addendum: 2026-05-04 Portfolio Captain fleet activation

- The Captain system has now moved from a Spotlight/pilot-centered activation slice to a full governed portfolio roster with overlays.
- `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py` now supports a `--portfolio` scope that activates every governed property from the property-identity matrix while preserving:
  - current monthly Spotlight overlays with `designation` and `market`
  - the documented pilot overlay set
- New doctrine artifacts now frame the command surfaces and activation rules:
  - `/Users/mark/Property_Analytics/docs/FLAGSHIP_COMMAND_TEMPLATES_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_CAPTAIN_ACTIVATION_STANDARD_2026-05-04.md`
- Remote D1 state after the 2026-05-04 activation run:
  - `93` active Captain properties
  - `1,023` active support agents
  - `93` active Captain activation memory entries
  - `19` active Spotlight-overlay properties
  - `5` active pilot-overlay properties
- System significance:
  - baseline Captain coverage is now portfolio-wide rather than limited to the monthly designation roster
  - Spotlight and pilot status now behave as overlays on top of a standing fleet, which is closer to a real department operating model than a rotating one-off project roster

## Addendum: 2026-05-04 Captain readiness and Commodore fleet review layer

- The Captain system now has its first explicit fleet-readiness audit and portfolio command-read layer on top of the newly activated 93-property roster.
- New supporting artifacts:
  - `/Users/mark/Property_Analytics/scripts/captain_fleet_support.py`
  - `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_portfolio_commodore_read.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.md`
- The first readiness snapshot for the full fleet recorded:
  - `28` ready properties
  - `63` partial properties
  - `2` source-gap properties
  - `0` activation-gap properties
- The dominant immediate post-activation pattern is `no recent runtime` on `65` properties, which means the standup succeeded structurally but the operating cadence still needs to catch up across the newly activated baseline portfolio.
- Runtime significance:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now exposes designation-aware `commandPosture` metadata in Captain status and brief-read responses, so command surfaces can distinguish baseline, focused, and urgent posture without inventing a separate overlay model downstream.

## Addendum: 2026-05-04 Designation-aware runtime cadence and catch-up plan

- The first post-activation refinement moved designation from passive metadata into the runtime path itself.
- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now uses designation when selecting scheduled Captain work:
  - normal daily cadence remains intact
  - `Critical` properties now also receive daily `reputation_watch` and `logkeeper` execution rather than waiting only for weekly cadence
  - when a scheduled bucket contains mixed properties, row ordering now prioritizes `Critical` first, then `Sale` / `Spotlight`, then the baseline portfolio
- A new catch-up planning artifact now exists for the newly activated fleet:
  - `/Users/mark/Property_Analytics/scripts/generate_captain_runtime_catchup_plan.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.md`
- The first catch-up plan split the `65` no-recent-runtime properties into:
  - `2` source-fix-first properties
  - `8` focused-cadence `Spotlight` / `Sale` properties
  - `55` baseline-cadence properties
  - `0` missing-runtime `Critical` properties in this initial snapshot

## Addendum: 2026-05-04 Canonical morning collection lockout from GBP OAuth fallback

- A real portfolio data outage occurred beginning on `2026-05-02` when the canonical collector process launched at `05:00 AM CDT` and then hung before GA4/GSC collection began.
- The hung process held `/Users/mark/Property_Analytics/Data_Collection/logs/daily_master_collection.lock`, which caused all later scheduled collector runs on `2026-05-03` and `2026-05-04` to abort with `Another collection run is already active`.
- Root cause:
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` could not load the stored GBP token because the runtime was missing `google.auth._regional_access_boundary_utils`
  - the collector then fell back to `InstalledAppFlow.run_local_server()` interactive OAuth
  - that browser-auth fallback is not safe inside unattended launchd execution and blocked the whole portfolio collector before primary sources ran
- Canonical correction:
  - GBP collector now has an explicit headless mode that refuses interactive OAuth during unattended runs
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` uses that headless mode by default and only allows interactive auth when `ALLOW_INTERACTIVE_GBP_AUTH=1`
  - the intended enterprise behavior is fail-open for non-core GBP review auth, not full-pipeline deadlock
- Operational significance:
  - GA4, GSC, Google Ads, PSI, unit availability, and downstream retry recovery should keep moving even when GBP auth needs manual repair
  - a broken optional auth lane should never again hold the entire morning system hostage behind one live OAuth prompt

## Addendum: 2026-05-04 Catch-up execution path and first severity posture refinement

- The Captain fleet now has an executable catch-up path, not just a diagnostic backlog list.
- New runner:
  - `/Users/mark/Property_Analytics/scripts/run_captain_runtime_catchup.py`
- The runner consumes the latest generated catch-up plan and can execute lane-scoped batches through the governed Captain API surface.
- First validation was a dry-run over the `focused_cadence` lane, which correctly targeted the first five designated properties in sequence:
  - `FL4GW` Avasa Grove West
  - `FL4HL` Avasa Hammock Landing
  - `FL4VC` Villas Continental
  - `KY4MP` The Metropolitan
  - `TX4CO` College View
- Runtime refinement:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now applies a first designation-aware severity/priority escalation for `Critical` properties on selected source and inventory lane outputs
- System significance:
  - the fleet now has the beginning of a closed loop: readiness audit -> Commodore read -> catch-up plan -> governed catch-up execution
  - designation posture is beginning to influence both scheduling and output urgency, which is closer to the intended Flagship operating model

## Addendum: 2026-05-04 POP Brief diagnostic recommendation standard

- A 2026-05-04 stakeholder transcript from `/Users/mark/Downloads/Watchlist Organization - Plan - Mark's Agents.docx` clarified the expected POP Brief / Captain recovery shape for watchlist, spotlight, and critical properties.
- The team does not want a broad dashboard summary. They want an operating diagnosis that starts with recovery math, identifies the primary constraint, explains why the system recommends each action, and cites the exact supporting source.
- New standard:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md`
- The standard establishes a repeatable diagnostic order:
  - recovery math
  - funnel diagnosis
  - floorplan / unit exposure
  - pricing / concession fit
  - traffic and source mix
  - competitive visibility
  - website / content / media
  - reputation / resident experience
  - operations and people constraints
- It also establishes the recommendation contract for Captain/POP outputs:
  - constraint
  - action
  - owner
  - due date
  - expected lift
  - evidence
  - confidence
  - proof check
  - optional do-not-recommend gate
- System significance:
- POP Brief and Captain Brief work now has an explicit recovery-decision standard rather than relying on ad hoc analyst interpretation
- the grounding core should produce an internal Captain diagnostic and a concise property action plan from the same governed read model
- this does not mutate locked canonical PIB generation or rendering behavior
- First implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` derives `diagnosticRead` for latest Captain Brief reads and newly persisted Captain Brief payloads
  - the Captain Marketing BI read now includes `sourceSpendRead`, derived from Marketing BI cost-per-conversion rows and ad-spend performance rows, so source/spend recommendations can cite visible lease/application/guest-card economics
  - the diagnostic read now includes `designationDoctrine`, making Spotlight an accelerated recovery watch and Critical an escalated recovery command inside the Captain's behavior
  - the diagnostic read now includes `peerFamilyRead`, allowing lagging properties to learn from stronger same-region or portfolio sibling properties while preserving subject-property facts as governing evidence
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` renders the Diagnostic Plan with primary constraint, recovery math, designation doctrine, peer-family help, recommended fixes, proof checks, and do-not-recommend gates, plus source/spend economics inside the Marketing BI read
  - `/Users/mark/Property_Analytics/apps/api/test/platform/captain-brief-read.test.ts` verifies the derived read model against the AR4PB fixture, including source/spend and peer-family output
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py` generated the first May 2026 local watchlist diagnostic packet at `/Users/mark/Property_Analytics/reports/captains_log/watchlist_diagnostics/2026-05-04/`
- First packet result:
  - `19` active May spotlight/watchlist properties resolved through governed identity
  - `0` unresolved property identities
  - all `19` currently read as inventory or stale-unit constrained before demand, which is a material review finding for the team before any source-spend increase is recommended
  - peer-family sections are now included in the generated Markdown/JSON packet so reviewers can see which sibling property may offer a tactic to borrow

Operational note added on 2026-05-05:

- GSC freshness has now been normalized across the shared policy, Morning Full, and Watchtower/API surfaces so normal Search Console lag is not misreported as an active freshness incident.
- Canonical rule: `gsc` is expected through `today - 3 days`; a one-day miss beyond that is `warning`, and larger misses are `stale`.
- This closes a cross-surface reporting mismatch where Morning Full had still been using a raw age heuristic and could mark naturally current GSC data as `warning`.

Operational note added on 2026-05-05:

- D1 mirror reliability has been tightened specifically around the Captain-source sync lane.
- The `2026-05-05` mirror failures were not broad D1 auth failures; they were transient `fetch failed` errors during `captain_sources_to_d1.py` remote imports after earlier mirror steps had already succeeded.
- Both `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` and `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` now retry transient Wrangler/Cloudflare connectivity failures before surfacing a hard mirror failure.

Operational note added on 2026-05-06:

- The canonical collection system had a real source-retry orchestration bug in the operating-metrics lane:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` attempted to call `_queue_source_retry(...)` without implementing it on `PortfolioDataCollector`
  - this caused source-level operating-metrics failures to crash with an attribute error instead of recording governed retry intent
- The collector now implements `_queue_source_retry(...)` as the canonical source-level wrapper around property-queue mechanics.
- `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py` was also hardened for direct operator/script use so audits can pass sqlite connections and ISO date strings without type errors.
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` now runs core missing-source recovery (`unit_availability`, `d1_mirror`) ahead of PSI/property-operating-metrics advisory retries, so closure-critical lanes do not wait behind long PSI reruns.

Operational note added on 2026-05-05:

- The AptIQ-backed Spotlight readiness workflow now audits DataForSEO coverage explicitly instead of only checking operating and funnel sources.
- For the `11` Spotlight properties prepared from `/Users/mark/Downloads/watchlist`, DataForSEO search/on-page/business-profile evidence was initially present for `7` properties with latest rows dated `2026-04-29`.
- `TX4CO` College View, `FL4HL` Hammock Landing, `KY4MP` The Metropolitan, and `FL4RL` The Retreat at Lakeland were collected on `2026-05-06` through the governed DataForSEO SERP and deep-enrichment scripts, then mirrored to remote D1 for Captain evidence use.
- Current Spotlight readiness now shows DataForSEO ready for all `11` properties.
- DataForSEO remains an advisory evidence lane; it should not override source-of-record operating, funnel, unit, reputation, or pricing facts.

Operational note added on 2026-05-06:

- The Captain's Log now has its first Data Pond inspection UI rather than only report output.
- `/analysis/captain` has been extended with a Captain Command Center above the existing Brief preview.
- New API reads expose portfolio roster state and property command-center state from the existing Captain runtime tables:
  - `/v1/captain/roster`
  - `/v1/captain/properties/:propertyId/command-center`
- The Command Center surfaces designation posture, support-agent cadence, latest runs, memory entries, source/knowledge coverage, watch items, actions, and brief history.
- System boundary: this is a Captain runtime and Data Pond control surface. It does not create a parallel PIB renderer and does not alter locked PIB generation/rendering files.

Operational note added on 2026-05-06:

- The local vNext Captain Brief generator has been corrected to comply with the latest stakeholder report-evaluation feedback.
- Visible search framing has been removed from the Brief: no paid-search KPI card, no standalone search-evidence section, and no `Website / SEO` marketing note.
- Website recommendations remain as `Website Content Diagnosis`, focused on exact leasing-page copy, hierarchy, offer language, and page-structure guidance. Source evidence for page diagnostics stays in the bottom source panel rather than leading the report.
- The top KPI grid now emphasizes action-ready recovery facts: exposure, net move-ins needed, primary gap, T30/T90 closing ratio, guest cards needed, visible special, T30 guest cards, and floorplan action lane.
- The 11-property Spotlight readiness audit was also corrected to resolve source tables that store property facts by GA4/feed ids rather than only property code, using the governed identity matrix rather than local one-off maps.
- Avasa Hammock Landing then had `138` collected GBP reviews backfilled into deterministic review-sentiment rows under GA4/property id `416886840`, closing the last audited critical-lane gap. The 2026-05-06 readiness audit now shows all `11` AptIQ-backed Spotlight properties at `12/12` audited critical source lanes.

Operational note added on 2026-05-06:

- A new BI workbook batch from `/Users/mark/Downloads` was ingested into local Data Pond tables.
- Purpose-built routes loaded `91` Marketing Ops Summary rows, `4,762` C&D reason/source rows, `728` init-contact conversion dashboard rows, `364` ad-spend performance rows, `91` ad-spend property/month rows, and `6,108` vacancy-day unit rows.
- The generic Marketing BI Excel evidence ledger retained the larger noncanonical workbook family, including conversion detail, leasing detail, tickets, value proposition, Kingsley/NPS/renewal/rent-pricing, portfolio summary/demographics, available, conversion performance, and regional C&D rollups.
- `region.xlsx` was explicitly identified as a regional C&D rollup, not a governed property-region assignment source, so it was not used to update property configs.
- The Marketing BI Excel ingester now normalizes browser download suffixes such as ` (1)` and ` (2)` for source detection while still storing the real source file path for evidence.

Operational note added on 2026-05-06:

- The detailed weekly Marketing BI property source-performance workbooks are now a governed source-performance feed.
- `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` recognizes `perf-by-source-*` workbooks, keeps Portfolio rows as benchmark context, and resolves property Selection rows through the governed property identity matrix when row or filename context supplies a property key.
- The first weekly batch loaded `19` workbooks and `521` source-performance rows into `marketing_bi_source_performance_rows`.
- Coverage check for the batch:
  - `19` distinct weekly exports
  - `198` Selection rows
  - `323` Portfolio rows
  - `19` mapped Selection properties
  - `0` unmapped Selection rows
- `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now prefers property-specific `perf-by-source-*` rows over older source-performance exports, so structured diagnostic JSON can use the latest weekly source detail.
- Elation's regenerated diagnostic JSON now reads `perf-by-source-elation` for the source layer, with total-row facts of `677` guest cards, `122` visits, `62` applications, `16` leases, and `10` move-ins.
- System boundary: this is Data Pond ingestion and structured diagnostic grounding. It does not alter locked canonical PIB generation or rendering files.

Operational note added on 2026-05-06:

- The structured property diagnostic read model now uses the Pond-wide PSI table.
- The local Pond has `pagespeed_metrics` as the portfolio-wide PSI/CWV source (`16,896` rows, `93` property ids, latest `2026-05-06`) and `pilot_control_psi_metrics` as a pilot/control-specific source (`436` rows, `10` property ids, latest `2026-05-06`).
- Elation / `TX4EG` has PSI rows in `pagespeed_metrics` under GA4 id `378381999`, not in `pilot_control_psi_metrics`.
- `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now reads `pagespeed_metrics` first by GA4 id and falls back to `pilot_control_psi_metrics` only when needed.
- The regenerated Elation diagnostic JSON now includes `2026-05-06` PSI/CWV facts:
  - mobile PSI `61`, LCP `5.78`, CLS `0.054`, FID/interaction fallback `33`
  - desktop PSI `89`, LCP `1.28`, CLS `0.034`, FID/interaction fallback `20`
- The PSI missing flag is no longer present for Elation.

Operational note added on 2026-05-06:

- The abandoned application export is present in the Pond but is not property-attributable.
- `marketing_bi_abandoned_application_rows` contains `962` loaded rows dated `2026-05-06`, with roughly `480` likely unique rows after duplicated export copies.
- The source workbook exposes unit/floorplan/rent/date fields but no property id, property name, region, community id, or other reliable property key.
- The diagnostic read model now records abandoned applications as `source_loaded_no_property_key` with `publish_property_count: false` instead of calling the source missing or inventing property-level counts.
- Future Marketing BI abandoned-application exports should include a property key before the metric can be used as a property-scoped count in Captain/VP structured JSON.

Operational note added on 2026-05-06:

- A dedicated VP property retrieval JSON serializer now exists at `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`.
- This serializer is distinct from internal Captain diagnostic JSON and is shaped to the VP-requested contract: one object per property with Demand Signals, Funnel Conversion, Inventory/Product, Demand vs Inventory Matching, Pricing/Market Position, Marketing Efficiency, Reputation/Product Friction, Website Performance, Derived Flags, and explicit missing data.
- Contract assumptions from Mark:
  - current month means month-to-date through latest available source date
  - `pd` means paid traffic
  - the 11 Spotlight production run should create 11 separate JSON files
- The first Elation specimen was generated at `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`.
- System boundary: this is retrieval-layer data shaping only, not a PIB or Captain Brief renderer.
- Follow-up QA corrected the serializer away from repeated `null` comparison scaffolding. It now emits compact metric objects; required unavailable values use `available: false` plus a `missing_data_path`, and the source reason appears once in `missing_data`.
- The regenerated Elation specimen has `0` JSON null values and fills additional computable values from existing Pond rows: GA4 conversion rate from conversions/sessions, available-unit T30/T90 averages from unit snapshots, PSI T30/T90 averages from `pagespeed_metrics`, spend budget-vs-actual rollups, and cost-per-guest-card rollups.

Operational note added on 2026-05-07:

- The Watchlist companion workbook is now versioned as v1.2 in `/Users/mark/Property_Analytics/docs/WATCHLIST_COMPANION_WORKBOOK_STANDARD_V1_2_2026-05-07.md`.
- The Elation v1.2 proof workbook lives at `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_v1_2_2026-05-07.xlsx`.
- The workbook is the auditable Excel evidence attachment for Watchlist Decision Output emails; it is not a new PIB renderer and does not alter locked PIB generation/rendering/sending files.
- v1.2 adds `Demand_vs_Availability`, preserving property-total and bedroom-level Guest Cards per Available Unit evidence from the governed Marketing BI available-interest route.
- The available-interest schema now carries `bedrooms`, and the Marketing BI Excel ingester maps `Bedrooms` rows to the active parent property through the governed property identity matrix.
- Captain Brief property-total reads now filter to `current_level = 'Property'` so bedroom rows do not accidentally replace property KPI facts.
- The 11 current Spotlight Captain Brief vNext artifacts were regenerated after the available-interest correction.

Operational note added on 2026-05-07:

- A shared company Watchlist repository has been established at `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data`.
- The repository standard is documented at `/Users/mark/Property_Analytics/docs/WATCHLIST_SHARED_REPOSITORY_STANDARD_2026-05-07.md`.
- The shared directory is explicitly a repository/publication/exchange layer, not the post-ingestion system of record. Data Pond remains authoritative after source files are ingested and validated.
- The active folder structure includes source inboxes, current reports, companion files, JSON outputs, source logs/readiness receipts, and a year/month archive.
- Internal report emails should link to published repository files when practical instead of attaching large report artifacts.
### 2026-05-07 GBP Repair Closure

- GBP is now repaired at the governed auth path, not only by local workaround.
- The canonical collector and insights lane both use one shared auth object through `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py`.
- Keeper/KSM is now live for the GBP file-backed OAuth artifacts:
  - `KSM_GBP_CLIENT_SECRET_UID=W06j0C6nHmT25dyr7sVYTA`
  - `KSM_GBP_TOKEN_UID=yDAkWDdIFlYjvDbjVl6McQ`
- The config path now prefers Keeper token materialization when configured, and refreshed token state is uploaded back to Keeper so unattended runs stay governed instead of drifting back to local-only persistence.
- `Avasa Hammock Landing` was not an auth failure after that repair. It was a stale GBP location mapping problem. The matched mapping file now points to location id `8521091931329757992`, which succeeds for both reviews and Performance API calls.
- Live canonical result on 2026-05-07:
  - `gbp_reviews`: `91/91 completed`
  - `gbp_insights`: `91/91 completed`
### 2026-05-07 Morning Full Control-Flow Fix

- The canonical summary sender already knew how to hold Morning Full until closure was ready, but the post-run acceptance gate still treated “no email sent yet” as failure.
- `send_morning_full_report.py` now writes an explicit execution-status artifact for `held`, `dry_run`, `already_delivered`, `delivered`, and `report_missing`.
- `verify_morning_delivery.py` now consumes that artifact so intentional hold behavior passes cleanly while true send failures still fail the lane.
- Operational effect: `com.venterra.daily.health` should no longer surface false red runs when Morning Full is correctly deferred by closure policy.

### 2026-05-07 Closure Advisory State

- The shared closure engine now distinguishes a true blocked day from a post-core advisory tail.
- New closure posture:
  - `state=advisory`
  - `summary_reason=core_closed_with_advisory_open`
- This state is emitted when no core source lanes remain unresolved, but advisory/manual retry items still exist.
- Watchtower and Morning Full now read that as an amber governance state instead of a false red blockage.

### 2026-05-07 PSI Reconciliation Upgrade

- PSI no longer relies only on per-attempt success counts to decide whether the day is complete.
- The collector now grades same-day completion from actual stored `pagespeed_metrics` coverage across the expected portfolio set, which matters because repeated retries can cumulatively close the day even when the final single attempt still had some transient misses.
- Targeted PSI retries are now supported by GA4 property id, and the retry worker computes the true incomplete property set from stored same-day mobile/desktop coverage before deciding whether to rerun anything.
- If same-day coverage is already complete, the retry worker now reconciles the latest PSI run row to `completed` and resolves the queue instead of launching another portfolio-wide rerun.

### 2026-05-09 Directive Control Center

- The Captain / Commodore / Fleet / Expert Bench / Fleet Scribe operating model now has a governed Directive Control Center.
- Directives are modeled as operational policy data with structured fields, version history, validation, approval workflow, runtime snapshots, simulation results, and audit events.
- Runtime consumers should resolve behavior through approved active directive versions. Draft versions are allowed only in simulation mode.
- The control surface is additive to Data Pond and Captain runtime and does not create a parallel reporting system.
- Fleet Scribe publication authority and Quartermaster source-integrity gates remain blocking controls.
- Current implementation locations:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/directives`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/directives.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0047_create_directive_control_center.sql`
  - `/Users/mark/Property_Analytics/apps/web/src/app/admin/directives/page.tsx`
  - `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_ARCHITECTURE_2026-05-09.md`
  - `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_OPERATING_GUIDE_2026-05-09.md`

### 2026-05-09 Directive Control Center Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_AUDIT_HARDENING_2026-05-09.md`.
- Runtime integrity controls now include:
  - approved-active runtime resolution only
  - draft isolation except explicit simulation mode
  - immutable runtime snapshots
  - immutable audit events
  - post-draft directive content immutability
  - persisted directive and runtime snapshot hashes
  - request/correlation IDs for traceability
- Governance controls now include:
  - admin-only `directiveControlCenter` permission surface
  - DB-level uniqueness for active, draft, and submitted directive versions per profile
  - stricter validation of publication permissions, external communication permissions, source freshness, confidence thresholds, report-family applicability, and impossible lifecycle states
  - explicit blocking preservation for Fleet Scribe publication authority and Quartermaster source integrity
- Scope boundary remains unchanged:
  - no parallel report system
  - no Captain’s Office implementation in that pass
  - no locked PIB mutation

### 2026-05-09 Captain Runtime Orchestration Foundation

- The first governed Captain Runtime Orchestration Layer now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/captain-runtime`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_ARCHITECTURE_2026-05-09.md`.
- The runtime sits above Data Pond facts and below official report/artifact generation. It receives interactions, resolves property context, classifies intent, resolves active directives, builds immutable evidence packets, enforces governance, constructs structured reasoning payloads, validates responses, and routes memory/action/escalation candidates.
- Runtime persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0048_create_captain_runtime_orchestration.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0035_create_captain_runtime_orchestration.sql`
- The API surface is `/v1/captain-runtime/interactions`.
- Important boundary:
  - GPT is a constrained reasoning engine only
  - human inputs become claims/candidate memory, not canonical truth
  - runtime behavior resolves through the Directive Resolver
  - evidence packets preserve source/freshness/authority lineage
  - Fleet Scribe and Quartermaster controls remain blocking
  - no parallel reporting system or locked PIB mutation was introduced

### 2026-05-09 Captain Runtime Orchestration Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_AUDIT_HARDENING_2026-05-09.md`.
- Runtime integrity controls now include:
  - explicit Directive Resolver assertions for role id, active approval status, runtime snapshot id, and runtime snapshot hash
  - immutable/no-delete database protections for sessions, interactions, evidence packets, reasoning requests, reasoning responses, and audit events
  - runtime session idempotency keys for replay/duplicate submission protection
  - replayable evidence packet hashes that exclude volatile ids and timestamps
  - evidence validation before reasoning
  - payload validation before reasoning request persistence
  - structured response validation before side effects
  - side-effect validation before memory/routing persistence
- Governance/security controls now include:
  - editor runtime-mode limits to monitoring, lightweight, and standard
  - admin-only access to escalated, executive, and simulation runtime modes
  - candidate-memory evidence lineage, expiration, conflict state, and duplicate signatures
  - strict rejection of hallucinated structured response fields
- Scope boundary remains unchanged:
  - no Captain’s Office UI in that pass
  - no real GPT provider integration
  - no autonomous workflows
  - no parallel report system
  - no locked PIB mutation

### 2026-05-09 Captain’s Office Operational Workspace

- The governed Captain’s Office interface now exists as the operational workspace above Captain Runtime.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_ARCHITECTURE_2026-05-09.md`.
- Web implementation:
  - `/Users/mark/Property_Analytics/apps/web/src/app/captains`
- API additions under Captain Runtime:
  - `/v1/captain-runtime/properties/:propertyId/office`
  - `/v1/captain-runtime/properties/:propertyId/history`
  - `/v1/captain-runtime/properties/:propertyId/evidence`
  - `/v1/captain-runtime/properties/:propertyId/memory-candidates`
- Route/navigation integration:
  - `captainOffice` is now a governed briefing surface in the app permission registry and sidebar.
  - Static property routes are generated from the governed property identity matrix.
- Important boundary:
  - Captain’s Office consumes Captain Runtime; it does not recreate runtime logic.
  - It does not expose raw internal prompts or giant runtime payloads.
  - It does not mutate Data Pond facts, evidence packets, directives, runtime lineage, or governed memory.
  - It does not implement memory promotion.
  - It does not create a parallel reporting system or alter locked PIB behavior.

### 2026-05-09 Expert Reads / Consulting Bench Runtime Controls

- The first governed Expert Reads runtime foundation now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/expert-reads`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_ARCHITECTURE_2026-05-09.md`.
- Expert Reads are structured specialist contributions from Consulting Bench lanes. They are not autonomous agents, report authors, independent assistants, chatbot lanes, or report generators.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0049_create_expert_reads.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0036_create_expert_reads.sql`
- API surface:
  - `/v1/expert-reads`
  - `/v1/expert-reads/:expertReadId`
  - `/v1/expert-reads/properties/:propertyId`
  - `/v1/expert-reads/properties/:propertyId/:laneId`
- Important boundary:
  - Expert Reads resolve active directives through the Directive Resolver.
  - Expert Reads consume governed Captain evidence packets and preserve evidence/directive hash lineage.
  - Expert Reads cannot mutate Data Pond facts, promote memory, publish artifacts, bypass Fleet Scribe, or bypass Quartermaster.
  - The layer is additive to Captain Runtime, Captain’s Office, Directive Control Center, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.

### 2026-05-10 Expert Reads Runtime Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_AUDIT_HARDENING_2026-05-10.md`.
- Runtime integrity controls now include:
  - replayed Captain evidence packet hash validation
  - source Captain Runtime lineage assertions for supplied session/interaction ids
  - deterministic request replay protection
  - audit events carrying evidence, directive, and read hash lineage
  - database-level prevention of self-authorized `publishable` Expert Read states
  - stricter structured output validation before final persistence
- Scope boundary remains unchanged:
  - no Expert Reads UI
  - no real GPT provider integration
  - no autonomous Bench agents
  - no Fleet Scribe publication tooling
  - no parallel report system
  - no locked PIB mutation

### 2026-05-10 Captain’s Office Expert Reads Visibility

- Captain’s Office now exposes Expert Reads as governed Consulting Bench specialist contributions.
- Integration documentation is at `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_EXPERT_READS_INTEGRATION_2026-05-10.md`.
- The new web route is `/captains/[propertyId]/expert-reads`, generated from governed property identities.
- The UI lists Expert Reads, renders selected read detail, displays confidence/freshness/publishability/blocking state, exposes evidence/directive/read/request hash lineage, and allows controlled lane-specific Expert Read requests through `/v1/expert-reads`.
- The implementation remains a visibility and request layer only:
  - no new runtime
  - no autonomous expert agents
  - no report authoring system
  - no Fleet Scribe publication bypass
  - no Quartermaster bypass
  - no Data Pond mutation
  - no memory promotion

### 2026-05-10 Property Access Control Foundation

- Canonical property-scoped authorization now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/access/property-access-control.ts`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_ARCHITECTURE_2026-05-10.md`.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0050_create_property_access_control.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0037_create_property_access_control.sql`
- The access model supports property, region, portfolio, capability, runtime-mode, and Expert Read lane authorization.
- Captain Runtime, Captain’s Office read endpoints, runtime history, evidence lineage, memory candidates, and Expert Reads routes now resolve access through the shared primitive instead of scattered property checks.
- Denied and high-risk authorization decisions are written to immutable audit events.
- Important boundary:
  - this is not a parallel auth system
  - frontend checks are not the security boundary
  - authorization gates access before runtime governance
  - Directive Resolver, Quartermaster, Fleet Scribe, Data Pond, Captain Runtime, Expert Reads, and approved artifact generation controls remain authoritative
  - no real GPT, report publishing, memory promotion, or locked PIB behavior changed

### 2026-05-10 Property Access Control Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_AUDIT_HARDENING_2026-05-10.md`.
- Authorization integrity controls now include:
  - explicit `allow` / `deny` grant effects
  - deterministic grant precedence with property grants before region grants before portfolio grants
  - same-scope deny precedence over allow
  - duplicate active grant prevention
  - strict fail-closed handling for invalid actions, invalid runtime modes, invalid Expert Read lanes, missing property scope, missing region scope, revoked grants, and expired grants
  - Expert Read detail masking to avoid confirming restricted record existence to unauthorized users
  - immutable audit events with correlation id preservation
- Scope boundary remains unchanged:
  - no parallel auth system
  - no grant-management UI
  - no AI behavior
  - no report publishing behavior
  - no PIB/reporting coupling

### 2026-05-10 Awareness Network / Memory Stewardship Foundation

- The first governed Awareness Network and Memory Stewardship foundation now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/awareness`.
- The governing charter is documented at `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_CHARTER_2026-05-10.md`.
- Supporting architecture docs cover Memory Stewardship, Agent Identity/Charters, Memory Taxonomy/Care Metadata, Self Notes/Commitments, Regional Awareness, Memory Governance, and Captain’s Office integration.
- The 2026-05-10 hardening record is `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_AUDIT_HARDENING_2026-05-10.md`.
- The cross-system runtime acceptance record is `/Users/mark/Property_Analytics/docs/CROSS_SYSTEM_RUNTIME_ACCEPTANCE_AUDIT_2026-05-10.md`.
- Naming alignment:
  - Captain’s Office remains the human-facing operational workspace.
  - Captain’s Quarters is now the working memory/stewardship area for Memory Posture, Self Notes, Open Commitments, Care Warnings, Reflection Suggestions, and Regional Awareness summaries.
  - Captain’s Log is the chronological continuity/archive layer for runtime history, reflection events, correction trail, archived memory, superseded memory, and commitment status changes.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0051_create_awareness_network.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0038_create_awareness_network.sql`
- Persistence hardening now blocks deletion of memory items, self notes, commitments, audit events, corrections, and archives; blocks publication-eligible memory lifecycle state updates until a future governed workflow exists; and keeps correction/archive records immutable.
- API surface:
  - `/v1/awareness/agents/:agentId`
  - `/v1/awareness/properties/:propertyId/posture`
  - `/v1/awareness/properties/:propertyId/self-notes`
  - `/v1/awareness/properties/:propertyId/commitments`
  - `/v1/awareness/regions/:regionId/summary`
  - `/v1/awareness/properties/:propertyId/regional-awareness`
  - `/v1/awareness/reflection-runs`
  - `/v1/awareness/memory/:memoryId`
- Important boundary:
  - named agents are bounded operational stewards, not autonomous authorities or people
  - self notes are not canonical truth and cannot be public/report evidence
  - human-submitted memory remains claim-level until governed
  - memory can expire, archive, or be superseded
  - regional awareness is summary-level and access-controlled
  - PropertyAccessControl gates awareness access
  - Directive Control Center remains policy authority
  - Quartermaster remains blocking
  - Fleet Scribe remains publication authority
  - no real GPT integration, memory promotion, Data Pond mutation, report publishing, people scoring, or parallel reporting system was added

### 2026-05-10 Cross-System Runtime Acceptance Gate

- Added `/Users/mark/Property_Analytics/apps/api/test/platform/cross-system-runtime-acceptance.test.ts`.
- Verified the integrated stack:
  - Captain’s Office -> PropertyAccessControl -> Captain Runtime -> Directive Control Center -> immutable Evidence Packet -> Captain’s Quarters / Awareness Network -> Captain’s Log continuity -> Expert Reads -> Quartermaster/Fleet Scribe boundaries.
- Readiness decision in the acceptance record:
  - `ready_for_model_gateway: true`
  - real GPT remains explicitly not integrated
- The acceptance gate confirms the organism is safe enough for a separate Model Provider Gateway design prompt, while preserving all no-autonomy, no-publication, no-memory-promotion, no-Data-Pond-mutation, and no-PIB-coupling boundaries.

### 2026-05-11 Model Provider Gateway Foundation

- The platform now has an internal **Model Provider Gateway** beneath Captain Runtime and Expert Reads at `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway`.
- This layer is additive to:
  - Data Pond
  - PropertyAccessControl
  - Captain Runtime
  - Captain’s Office
  - Captain’s Quarters
  - Captain’s Log
  - Directive Control Center
  - Expert Reads
  - Quartermaster
  - Fleet Scribe
- It provides:
  - adapter abstraction
  - deterministic default accepted-output execution
  - noop fail-closed fallback
  - Cloudflare AI Gateway adapter as infrastructure enhancer
  - shadow-mode compare-only execution
  - payload minimization / redaction
  - structured response validation
  - governance post-check
  - immutable model-call audit lineage
  - internal call-rate / token / cost guardrail foundation
- Captain Runtime and Expert Reads now invoke the gateway abstraction instead of directly owning deterministic execution.
- Cloudflare is explicitly treated as an infrastructure enhancement layer, not as an authority or truth layer.
- Live model/provider calls remain disabled by default.
- No parallel reporting system was created and no PIB/reporting coupling was introduced.

### 2026-05-11 Model Provider Gateway Audit / Hardening Gate

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_AUDIT_HARDENING_2026-05-10.md`.
- Persistence paths are:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0052_create_model_provider_gateway.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0039_create_model_provider_gateway.sql`
- The infra migration was corrected from the sequence-inconsistent `034_create_model_provider_gateway.sql` to `0039_create_model_provider_gateway.sql`, matching the zero-padded infra sequence after Awareness Network `0038`.
- Hardening added:
  - unsafe gateway config validation with fail-closed behavior
  - raw payload / raw provider output / cache enablement blocking for this foundation
  - stronger relationship/private/sensitive memory redaction
  - pattern-only raw-detail removal
  - model output rejection for promoted memory candidates, self notes as evidence, relationship/people scoring, Quartermaster/Fleet Scribe bypass, report publication, Data Pond mutation, external communication, directive/authorization edits, and provider self-routing
  - source-specific validation/governance checks for shadow provider output while deterministic output remains accepted
- Readiness decision:
  - `ready_for_shadow_mode_provider_config: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
- Important boundary:
  - this is permission to configure controlled shadow-mode provider settings next, not permission to enable live accepted model behavior
  - no real GPT/model calls, autonomous behavior, memory promotion, report publishing, Cloudflare authority transfer, or PIB/reporting coupling was added

### 2026-05-11 Cloudflare Shadow-Mode Provider Configuration

- Added the controlled shadow-provider configuration pass for the internal Model Provider Gateway.
- New docs:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_PROVIDER_CONFIG_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_SMOKE_TEST_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_GOLDEN_CASE_EVALUATION_2026-05-10.md`
- New implementation:
  - explicit config separation for provider shadow enablement, provider live enablement, accepted output adapter, shadow provider adapter, kill switch state, and dry-run state
  - Cloudflare adapter support for shadow-only transit while `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
  - shadow-mode adapter metadata capture for provider/model/route, provider request id, token usage, cost estimate, latency, validation/governance status, and safe errors
  - immutable `model_gateway_shadow_results` persistence in app and infra migrations
  - backend-only synthetic smoke path at `/Users/mark/Property_Analytics/apps/api/scripts/smoke_cloudflare_shadow_model_gateway.ts`
  - golden-case evaluation foundation at `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/evaluation.ts`
- The shadow path is explicitly observation-only:
  - deterministic output remains accepted
  - provider output is validated and governance-checked
  - provider output is stored as shadow observability metadata only
  - provider output cannot create memory, routing, reports, publication, Expert Reads, Captain Runtime side effects, Data Pond changes, or PIB/reporting coupling
- Readiness decision:
  - `ready_for_shadow_provider_smoke_test: true`
  - `ready_for_semantic_shadow_evaluation: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`

### 2026-05-11 Cloudflare Shadow Smoke / Golden-Case Evaluation Pass

- Evaluation record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_EVALUATION_RESULTS_2026-05-10.md`
- Added metadata-only evaluation runner:
  - `/Users/mark/Property_Analytics/apps/api/scripts/run_model_gateway_shadow_evaluation.ts`
- First controlled smoke/evaluation findings:
  - deterministic accepted output remains preserved
  - live provider calls remain disabled
  - Cloudflare adapter live accepted behavior remains disabled
  - explicit shadow smoke used synthetic data only
  - provider call was skipped because Cloudflare backend base URL/model/token are absent
  - missing config was audited as a skip/fail-closed state
  - shadow result records were created without provider transit
  - all seven deterministic golden cases passed structure, governance, redaction, and semantic score checks
  - all seven shadow fixture attempts preserved deterministic accepted output and recorded skip lineage
- Semantic scoring now covers:
  - structure compliance
  - governance compliance
  - evidence discipline
  - memory care
  - publishability restraint
  - operational usefulness
- Updated readiness:
  - `ready_for_limited_shadow_expansion: true`
  - `ready_for_live_candidate_mode_design: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`
- Important limitation:
  - provider semantic quality, token usage, latency, cost estimate, and provider request id capture remain unmeasured until backend Cloudflare provider config is supplied through the approved secret path

### 2026-05-11 Real Cloudflare Shadow Observation Preflight

- Real shadow observation record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_REAL_SHADOW_OBSERVATION_RESULTS_2026-05-10.md`
- Preflight found no approved backend Cloudflare AI Gateway config in the current shell or checked backend config files.
- Missing required config:
  - `CLOUDFLARE_AI_GATEWAY_BASE_URL`
  - `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
  - `CLOUDFLARE_AI_GATEWAY_MODEL` or `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`
- Safe execution result:
  - synthetic smoke was attempted with explicit shadow-only flags
  - `calledCloudflare=false`
  - golden-case fixtures attempted shadow mode
  - provider transit skipped before external call
  - deterministic accepted output remained preserved
  - redaction compliance remained 7/7
  - no provider output was observed, trusted, accepted, stored raw, or used for side effects
- Updated readiness:
  - `ready_for_limited_shadow_expansion: false`
  - `ready_for_live_candidate_mode_design: false`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`

### 2026-05-11 Cloudflare AI Gateway Backend Shadow Config Setup

- Added the backend-only Cloudflare shadow configuration setup path for the internal Model Provider Gateway.
- New implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/cloudflare-shadow-config.ts`
  - `/Users/mark/Property_Analytics/apps/api/scripts/check_cloudflare_shadow_config.ts`
- New command:
  - `cd /Users/mark/Property_Analytics/apps/api && npm run model-gateway:check-cloudflare-shadow-config`
- New documentation:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_CONFIG_SETUP_2026-05-10.md`
- The config checker reports sanitized readiness fields only:
  - deterministic accepted output preserved
  - live provider calls disabled
  - Cloudflare live accepted behavior disabled
  - shadow provider flags present
  - backend Cloudflare key names present or missing
  - raw payload storage, raw provider logging, and cache disabled
  - frontend provider exposure absent
- Smoke output now surfaces a sanitized `skipReason`, making fail-closed missing-config paths clearer without printing secrets.
- Boundary decision remains unchanged:
  - this setup prepares approved backend shadow observation only
  - live accepted provider calls remain disabled
  - provider output remains unable to drive Captain Runtime, Expert Reads, memory, routing, reports, publication, Data Pond mutation, or PIB/reporting coupling

### 2026-06-12 Data Warehouse Wrapper Durability Correction

- The governed Data Warehouse daily wrapper at `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh` was further hardened so recurring automation no longer depends on `~/Library/Logs/Venterra` being writable in every execution context.
- The wrapper now resolves a writable log directory across the governed home path, repo-local automation logs, and `/tmp`, then writes a PID-backed lock directory so concurrent-run detection is explicit and stale-lock recovery is distinguishable from live overlap.
- This closes a real diagnostic gap observed on 2026-06-12 where a constrained run could fail before Keeper readiness or warehouse connectivity and still emit the misleading skip message `Another run is already in progress`.
- Same-day verification completed the full seven-step governed harvest through Keeper/KSM and the warehouse connection, producing fresh output packets for:
  - daily harvest `2026-06-12_20260612_164324`
  - guest-card direct supply `2026-06-12_20260612_164329`
  - property operating metrics `2026-06-11_20260612_164331`
  - property metadata `2026-06-12_20260612_164334`
  - manual-source replacement audit `20260612_164334`
  - replacement review `20260612_164334`
  - Captain advisory `2026-06-12_20260612_164334`
- Governed posture remained intact: guest-card direct supply stayed `shadow_only` with `0` canonical upserts, unresolved property code `TX4EK` remained visible rather than patched around, the four operating-metrics exclusions remained explicit (`FL4CA`, `FL4P9`, `TX4FP`, `TX4PW`), and the Captain advisory still reported `trust_posture: unavailable` pending historical export reconciliation.

### 2026-06-16 Data Warehouse Human-Present VPN Automation Boundary

- The Data Warehouse daily wrapper remains the canonical seven-step harvest/replacement/Captain advisory path, but its recurring automation boundary changed after live AWS VPN Client SSO proof.
- Mark's desktop session successfully connected `VenterraVPN`, completed the browser SSO handoff, verified warehouse TCP reachability, ran `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh`, disconnected the VPN, and then verified the warehouse endpoint was no longer reachable.
- The proof produced fresh governed packets:
  - daily harvest `2026-06-16_20260616_123534`
  - guest-card direct supply `2026-06-16_20260616_123538`
  - property operating metrics `2026-06-15_20260616_123541`
  - property metadata `2026-06-16_20260616_123544`
  - manual-source replacement audit `20260616_123544`
  - replacement review `20260616_123544`
  - Captain advisory `2026-06-16_20260616_123544`
- The prior unattended Codex cron automation `data-warehouse-daily-shadow-harvest` is paused so the warehouse lane no longer attempts unattended VPN/SSO operation.
- The active daily heartbeat `data-warehouse-harvest-check-in` now prompts Mark to confirm he is present in the logged-in desktop session and signed into AWS VPN SSO before Codex performs the connect-run-disconnect sequence.
- This keeps the Data Warehouse replacement lane separate from the larger daily collection/gather path while preserving Keeper/KSM-only credential resolution, the governed wrapper, shadow-only guest-card supply, and explicit degraded/advisory reporting for identity gaps or warehouse anomalies.

### 2026-06-24 GoDaddy Domains API Inventory Lane

- GoDaddy registrar/DNS inventory is now a read-only Data Collection source route for the platform launch domain workstream.
- Keeper/KSM auth is centralized in `/Users/mark/Property_Analytics/utils/godaddy_auth.py`, resolving the existing `GoDaddy API` Keeper record through the shared Python KSM helper without creating a local credential file or printing raw key/secret values.
- The collector lives at `/Users/mark/Property_Analytics/Data_Collection/collectors/godaddy_collector.py` and snapshots `GET /v1/domains`, `GET /v1/domains/{domain}`, and `GET /v1/domains/{domain}/records`.
- Canonical SQLite storage now includes `godaddy_domain_snapshots` and `godaddy_dns_records` through `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`; raw GoDaddy source JSON is preserved alongside normalized expiry/status/privacy/lock/renewal fields, DNS status, DNS type counts, and optional governed property identity matches.
- The first live snapshot on 2026-06-24 completed as data collection `2252`: `282` domains, `282` successes, `0` hard failures, `1,566` DNS records, and `6` governed property-identity matches.
- Source-limited DNS states are represented as source facts rather than collector failures: `221` domains returned DNS `200`, `11` returned DNS `403`, and `50` returned DNS `404` / no accessible GoDaddy zone file.
- Forwarding collection is now live. The existing `GoDaddy API` Keeper record includes custom field `customer_id`; `/Users/mark/Property_Analytics/utils/godaddy_auth.py` resolves it without printing raw values, and the collector derives the UUID-style customer id through the GoDaddy Shoppers API when the Keeper value is the numeric shopper/customer identifier.
- Forwarding storage now lives in `godaddy_forwarding_snapshots`. The first live forwarding snapshot on 2026-06-25 completed as data collection `2282`: `282` domains, `0` failures/source-limited domains, `283` forwarding rows stored, and `149` active forwarding records (`148` `PERMANENT_REDIRECT`, `1` `TEMPORARY_REDIRECT`, plus `134` no-forwarding source states).
- Mutating registrar/DNS/forwarding operations remain out of scope unless explicitly approved in a current task.

### 2026-07-13 WebOps Resources Hub And Cloudflare Access Boundary

- The static WebOps resources hub is live at `https://resources.venterradev.com/`, with the Cloudflare routing architecture explainer at `https://resources.venterradev.com/cloudflare-routing-architecture/`.
- Cloudflare Pages project `venterra-resources` serves the static artifact from `/Users/mark/Property_Analytics/output/venterradev-resources`.
- Cloudflare Access application `Venterra Resources` now protects `resources.venterradev.com/*`.
- Current interim identity posture uses the existing Cloudflare One email OTP identity provider and allows users with `venterraliving.com` or `venterra.com` email domains.
- Signed-out HTTP checks confirmed Cloudflare Access redirects for both the hub root and the direct architecture page.
- Target future posture is Microsoft Entra SSO for authenticated Venterra users once Entra is added to Cloudflare Access.

### 2026-07-16 Resi Portfolio Edge Analytics-On Topper Baseline

- Champions Green gated preview is now the analytics-on measured topper baseline: Worker `portfolio-resi-edge-prototype` version `c62969ca-6f6e-4e1e-88b8-ae897c2c32cd`, template/schema `2026-07-16.performance-topper-measured-preview-v10-analytics`.
- The delivery strategy remains split: exact-native is the visual calibration lane, while the measured topper is the high-score first-view architecture that avoids the native WordPress/YOOtheme payload.
- The active topper now restores the earlier event-recorder contract: duplicate-protected `page_view`, required CTA/promo/menu events, `dataLayer`, `__vtrEdgeQueue`, `__vtrTopperEvents`, and deferred Heap replay.
- Champions Green Zaraz was found to have auto-injection enabled but no tools. The zone now has preview-scoped Zaraz tools for GA4 (`G-N9YHM93HRV`) and delayed Heap (`286627304`), guarded to the gated preview so ungated production is not changed by the Heap tool.
- Browser proof confirms Zaraz presence and delayed Heap posture; PageSpeed proof with analytics on is mobile `98/98`, desktop `100/100`, TBT `0ms`.
