# ATLAS WORKING MEMORY
**Last Updated:** 2026-05-24 01:55 CDT
**Purpose:** Single source of truth for Atlas AI - read this FIRST in every session

---

### 2026-05-23 - Keeper / KSM Credential Law
- `/Users/mark/Property_Analytics/AGENTS.md` now makes Keeper Secrets Manager the mandatory source of truth for credentials, API tokens, OAuth artifacts, service tokens, and deployment auth.
- Required posture: resolve credentials through existing KSM helpers, notation env vars, or Keeper-backed file materialization before trying direct env vars, local credential files, browser login, or manual token paths.
- Cloudflare/Wrangler work must use the governed Keeper-backed runtime path, especially `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`, so `CLOUDFLARE_API_TOKEN` is injected from Keeper rather than relying on Wrangler browser auth.
- Raw secrets must never be printed, logged, persisted, or summarized; verification should report only source class, presence, success/failure, and sanitized errors.
- If a needed credential is not represented in Keeper/KSM, stop and ask for it to be added to Keeper and documented in the appropriate manifest instead of inventing a local workaround.

### 2026-05-25 - ApartmentIQ Regular Harvest Efficiency / Reliability
- Tightened the ApartmentIQ collection path so regular harvesting rotates across stale comp sets instead of repeatedly re-reading the same leading slice.
- `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py` now prioritizes never-harvested or oldest-harvested comp sets first, using per-table latest `collection_date` state for market survey, units, and floorplans.
- The collector also now supports `--subject-comp-sets-only`, resolving daily touchups against governed subject-linked comp sets from `apartmentiq_property_identity_links`.
- `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh` now uses a true light-touch posture: subject-linked comp sets only, default `APARTMENTIQ_DAILY_MAX_COMP_SETS=5`.
- `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh` now uses a staggered weekly posture with default `APARTMENTIQ_WEEKLY_MAX_COMP_SETS=60` instead of forcing a full `--max-comp-sets -1` sweep.
- Both ApartmentIQ wrappers now resolve log/lock directories with fallback order `~/Library/Logs/Venterra` -> repo `logs/automation` -> `/tmp/property_analytics_logs`, so the automation is less brittle outside the primary launchd environment.
- Targeted smoke result on 2026-05-25: local wrapper startup/logging succeeded, but the live ApartmentIQ API still returned a `429` on `GET /accounts/9900124/comp_sets`, confirming the remaining throughput constraint is vendor throttling rather than local wrapper failure.

### 2026-05-24 - Edge Messages Font-Size / Live Publish Alignment
- Root cause of the admin/live mismatch: Edge Messages admin Save previously persisted only to browser `localStorage`; the live site still read hard-coded Cloudflare Worker config.
- Fixed publish path: the Edge Messages admin now uses `Save & Publish` and posts the exact draft to `POST /v1/experiments/edge-messages/:messageId/live-config`. The API validates the draft, upserts the message as an `edge_experiments` record, retires prior active rows in `edge_experiment_config_versions`, and writes the new Worker-ready config as the active D1 version.
- Fixed live read path: Worker `edge-transparent-pricing-intro-beta` now has a `POP_BRIEF_DB` D1 binding and reads active config from `edge_experiment_config_versions` for `edge_transparent_pricing_intro_homepage_v1` and `edge_message_all_in_pricing_coachmark_v1`, falling back to the hard-coded config only when D1 is unavailable or no active row exists.
- Deployed through the Keeper/KSM-backed Wrangler helper only. Current deployed versions: API Worker `pop-brief-api` version `8f0af5e6-86ce-463e-9b27-aec8618ba4e7`, Edge Worker `edge-transparent-pricing-intro-beta` version `3a19688f-51eb-445b-aae5-8e25969bd935`, and Pages admin `9aaf825f.property-analytics.pages.dev` / `https://9aaf825f.property-analytics.pages.dev`.
- Verification: `apps/api` typecheck passed, `apps/web` build passed, `node --check` passed for the Edge Worker, curl smoke confirmed the Pages bundle contains `Save & Publish`, `Publishing live`, `Published live`, and the live-config endpoint, and unauthenticated API publish returned `401` as expected.
- Current live `/apartments/` fallback still matches the corrected compact coach-mark values until the next authenticated admin publish seeds D1: brand `#3D66B9`, accent `#7DCAC2`, icon text `#294782`, surface text `#FFFFFF`, title `14px`, body `13px`, max width `460px`, rounded `24px`.
- Follow-on productionization gap: launch/pause/rollback, approval workflow, EVS preflight, and benchmark gates remain intentionally disabled; the config publish/read path itself is now wired for this beta admin surface.

### 2026-05-23 - Venterra Brand Color Standard
- Official color source added from `/Users/mark/Downloads/New Branding Colors_Named 2.pdf`:
  - `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`
- System-wide rule added to `/Users/mark/Property_Analytics/AGENTS.md`: new or materially updated user-facing UI, reports, decks, documents, charts, generated assets, color controls, and swatches should use only the official Venterra palette unless the user explicitly specifies otherwise in the current task.
- Official active palette: Venterra Navy `#15284B`, San Marino `#3D66B9`, Bay `#294782`, Indigo `#5A81CF`, Monte Carlo `#7DCAC2`, Pink `#E02472`, White Smoke `#F6F6F5`, Terra Cotta `#BD4830`, Quill Gray `#D6D6D2`, Blue Chill `#3B9189`, Delta `#9B9B96`, Black `#000000`, White `#FFFFFF`. Galliano `#EAAB00` is discontinued and must not appear in active swatch palettes or configurable color defaults.
- Edge Messages admin swatches now use only that active palette. Adjustable defaults were normalized away from discontinued Galliano: brand `#15284B`, accent `#7DCAC2`, title `#000000`, body `#294782`, fine print `#9B9B96`, on-color text `#FFFFFF`.
- Prior note superseded: live Worker accent had previously been normalized from legacy gold to Galliano in version `75477e9d-963e-400a-a3b5-73a610aa417b`, but Galliano is now discontinued and active palettes/defaults should use current palette colors instead.
- Latest Edge Messages admin Pages deployment is `9aaf825f.property-analytics.pages.dev` / `https://9aaf825f.property-analytics.pages.dev`. It was published through the Keeper/KSM-backed Wrangler path after direct Wrangler auth failed in non-interactive mode. Curl smoke confirmed `/experiments/edge-messages` returns `200` and the live bundle contains the Type size controls, `propertyNameFontSize`, `titleFontSize`, `bodyFontSize`, `disclaimerFontSize`, `countdownFontSize`, increase/decrease font-size steppers, and the `Save & Publish` live-config call; the coach-mark default now carries `#3D66B9`, `#7DCAC2`, 14px title/13px body sizing, and a local saved-draft clamp that prevents oversized coach-mark title/body values from rehydrating indefinitely.
- Cloudflare Pages publish note: Wrangler asset upload repeatedly failed with `UND_ERR_SOCKET` / `write EPIPE` while using default 40 MB buckets and concurrency 3. The successful 2026-05-24 deploy used `npx wrangler@4.94.0` through `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py` with the local npx cache throttled to 4 MB buckets, 250 files per bucket, and upload concurrency 1.
- Coach-mark frequency-cap bypass fix deployed as Worker version `aac2168c-6f12-4a4c-937e-fbad8086b7c6`: the coach-mark browser payload now includes `ignoreFrequencyCap`, so testing-always-show mode works even when localStorage already contains `v_edge_msg_seen_edge_message_all_in_pricing_coachmark_v1`. Curl smoke confirmed `"ignoreFrequencyCap":true`; Playwright smoke with the localStorage marker pre-set still rendered `1` visible coach mark, `141` all-in buttons, and `0` browser errors.

### 2026-05-23 - Edge Transparent Pricing Intro Beta Homepage Test
- Stood up, rolled back, hardened, and re-enabled the beta edge-injected transparent-pricing intro modal on `pilot.venterradev.com` through a dedicated Cloudflare Worker:
  - `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js`
  - `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.toml`
  - `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/README.md`
  - `/Users/mark/Property_Analytics/docs/EDGE_MESSAGE_TOOLKIT_2026-05-23.md`
- Worker name/versions:
  - `edge-transparent-pricing-intro-beta`
  - last enabled version `9d08ec2c-18fa-43e4-b99d-7986eb32e0f6`
  - disabled version `3a04aee5-ea68-4c5f-9cd3-30eb7cf24a97`
  - non-blocking live version `fae973c7-fd71-4fbf-8d0f-aa90d835001d`
  - clean-test-url live version `dac90122-4bc7-4493-a1f9-573f2833a907`
  - disabled-after-hero-review version `6181471a-a26c-4402-88c9-ef0ac927b269`
  - homepage benchmark version `89b7ce6f-86fb-44a7-98f7-2b8bac2da5f4`
  - clean-homepage live version `b8807956-1921-4d0b-826e-2276ed2262aa`
  - current title-line-break version `c73d901f-bb92-4a86-a102-2d5579b61251`
  - current coach-mark version `89cd14da-619d-48e9-8679-d97fdc37e81a`
  - current testing always-show version `5f743543-aa56-4a10-972f-f43565b03c91`
  - current modal layout version `db8b4940-020e-4179-aa9a-aa4cab7f36a5`
  - current official-color version `75477e9d-963e-400a-a3b5-73a610aa417b`
- Current Cloudflare route is `pilot.venterradev.com/*`; Worker injection is exact-path `/` for the homepage modal and exact-path `/apartments/` for the anchored all-in pricing coach mark.
- Apex property identity is carried in the payload as governed identity `GA4AX` / `eed3da54-7b7a-4dae-984b-a203113fc2f3`; no local property map was introduced.
- Rollback reason: the first enabled pass appeared to arrest or delay the apartment units experience for a visitor. The `2026-05-23-beta-2-nonblocking` version was live with `enabled: true` after hardening, then a visible-units failure was traced to the test query parameter itself.
- Last enabled UX: Venterra-branded centered modal, `#15284B`, Apex West Midtown property name shown once at the top, large two-line headline `Say hello to clearer` / `monthly pricing`, centered body copy, required-fees disclaimer, corner X, 7-second countdown/progress, authentic Venterra Velo/wordmark at the bottom, fade in/out, Escape close, reduced-motion handling, dataLayer events where available, 24-hour cookie cap, localStorage fallback, `edge_popup_force=1`, and `edge_popup_reset=1`.
- Current source hardening: non-blocking notice posture, no `aria-modal`, no focus trap/autofocus, overlay `pointer-events:none`, unit/listing DOM readiness check before display, X/Escape/auto close only.
- Beta-3 query handling: `edge_popup_force=1` and `edge_popup_reset=1` now 302 to a clean URL and use short-lived Worker-only cookies, because leaving those params in `location.search` causes the Resi unit UI to hide visible unit rows even when the Worker route is removed.
- Live smoke verification on 2026-05-23: forced apartment URL redirects to clean `/apartments/`, popup injects, homepage does not inject, Resi app JS does not inject, browser-level check rendered the popup with `role="region"`, no `aria-modal`, overlay `pointer-events:none`, card `pointer-events:auto`, auto-close removal, `47` visible availability nodes / `47` visible unit rows during and after the popup, no page errors, and only an existing SightMap warning.
- Hero/title review: after beta-3, the Worker was disabled and route bindings removed again. Fresh-browser clean `https://pilot.venterradev.com/apartments/` still loads directly into filters/unit rows with no visible large hero/title and `0` popup markers, while production `https://venterraliving.com/apartments/apex-west-midtown/` has the production Apex hero/title and `https://pilot.venterradev.com/apartments/apex-west-midtown/` returns `404`. Do not re-enable until the intended pilot route/template is confirmed.
- Homepage test: beta-4 moved the experiment to `https://pilot.venterradev.com/`, disabled unit-selector waiting for the homepage, and benchmarked before/after under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/`. Homepage hero/title remained visible behind the popup; browser runs had `0` console/page errors and popup visible in `5/5` post-deploy runs.
- Clean homepage live behavior: beta-5 bumped the experience id to `edge_transparent_pricing_intro_homepage_v1` so prior test cookies/localStorage do not suppress clean URL display. `https://pilot.venterradev.com/` now shows the popup without query parameters; `/apartments/` still has `0` popup markers.
- Title polish: popup title now renders as `Say hello to clearer` line break `monthly pricing` using `white-space: pre-line`; browser check confirmed the newline text and visible popup.
- Capability memorialized as the `Edge Message Toolkit`; recommended admin nav name is `Edge Messages`, with future experience ids following `edge_message_<initiative>_<surface>_vN`.
- Coach-mark proof: added `edge_message_all_in_pricing_coachmark_v1` on exact path `/apartments/`, anchored to the first visible `All-In Price & Details` button. It uses a Venterra-blue bubble, amber `!` badge with pulse animation, pointer arrow, X close, auto-close, and separate coach-mark frequency cap. Browser proof showed coach mark visible, homepage modal absent on `/apartments/`, and `47` visible availability nodes / `47` visible unit rows retained.
- Testing always-show mode: both homepage modal and apartment coach mark have `ignoreFrequencyCap: true`, so they reappear on every reload during review. Browser reload proof showed modal visible on two consecutive homepage loads and coach mark visible on two consecutive `/apartments/` loads, with `47` visible unit rows retained.
- Modal layout polish: Worker version `db8b4940-020e-4179-aa9a-aa4cab7f36a5` changed the homepage popup to the supplied format: property name top-center, no top logo, larger centered two-line title/body/disclaimer, `Closing in 7 seconds`, progress bar, and bottom Venterra/Velo mark. Current live Worker version `3a19688f-51eb-445b-aae5-8e25969bd935` preserves that layout, reads active D1 config when published from the admin, and falls back to active palette colors plus compact 14px title/13px body sizing for the coach mark. Smoke confirmed property `Apex West Midtown`, title newline, countdown `Closing in 7 seconds`, no top-logo-before-title, bottom brand below progress, and `0` browser errors. Apartment smoke still showed All-In button availability retained and `1` coach mark.
- Admin surface slice: added `/Users/mark/Property_Analytics/apps/web/src/app/experiments/edge-messages/page.tsx` and linked it from `/Users/mark/Property_Analytics/apps/web/src/app/experiments/page.tsx`. The Pond surface is `Experiment Lab -> Edge Messages`, inventories the two live beta proofs, exposes editable content/style/placement/delivery/timing/decoration/frequency controls with modal and coach-mark preview, and now publishes active Worker config through D1. Launch/pause/rollback remain disabled until the approval workflow, EVS preflight, and benchmark gates are wired.
- Live admin deploy: built `apps/web` successfully and deployed the static export to Cloudflare Pages project `property-analytics`. Latest production deployment is `9aaf825f.property-analytics.pages.dev` / `https://9aaf825f.property-analytics.pages.dev`. Operator URL is `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. Browser smoke on the prior deployment URL, with auth mocked, rendered `Edge Messages`, text color controls, official brand color swatches, both live proof cards, the updated 7-second modal preview, and no relevant page errors. The modal preview is scaled inside the preview frame so the bottom Venterra/Velo mark fits; bounds smoke showed the card fully within the preview viewport with a positive bottom gap. The admin surface now has `Save & Publish`: it persists the draft locally, calls the API live-config endpoint, and writes an active D1 config version read by the Worker. Preview scenes are separated: modal/banner/toast/inline use the homepage hero context without the all-in price button, and the coach-mark preview uses `/edge-message-apartments-preview.png`, a separate apartments-list screenshot asset, with the bubble lowered so the pointer lands on the first visible `All-In Price & Details` button. Save/reload smoke persisted `#E02472` for Accent Color and then reset the draft. The final font-size-increment slice adds Type size steppers for property, title, body, fine print, and countdown text; build succeeded under Node 22, Pages deploy succeeded through Keeper/KSM-backed Wrangler, and curl smoke confirmed the new bundle contains the font-size controls and live publish UI. The compact coach-mark pass clamps saved coach-mark title/body drafts to 26px max and aligns live/default sizing to title 14px and body 13px.
- Benchmark/verification artifacts:
  - `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/EDGE_TRANSPARENT_PRICING_INTRO_BETA_REPORT.md`
  - `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/benchmark-summary-v2.json`
  - desktop/mobile final screenshots under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/after/`
- Final measured payload impact:
  - injected script raw size `11,710` bytes
  - injected script gzip size `4,391` bytes
  - forced-vs-capped HTML raw delta `11,726` bytes
  - forced-vs-capped HTML local gzip delta `4,198` bytes
  - live compressed-transfer HTML delta `4,224` bytes
  - no external popup asset/library requests
- Homepage beta-4 measured impact:
  - raw HTML delta `+11,589` bytes
  - gzip HTML delta `+5,223` bytes
  - browser document transfer delta `+4,208` bytes
  - median browser load-event delta `-315ms` in the measured sample, interpreted as run-to-run variance rather than a speed improvement
  - no external popup asset/library requests
- Boundary preserved: no WordPress, YOOtheme, RentPress, or locked PIB files were changed; apps/api changes are limited to the Edge Messages live-config endpoint and apps/web changes are limited to the Edge Messages admin surface.

### 2026-05-22 - PIB Section Catalog / Future Builder Standard
- Memorialized PIB as a sectioned report family with stable section ids for future self-serve report generation:
  - `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`
  - `/Users/mark/Property_Analytics/config/pib_section_catalog.json`
- `ApartmentIQ Market Enrichment` is now cataloged as section id `apartmentiq_market_enrichment`, with approved sub-sections: advisory banner, market-visible KPI tiles, Offer Pressure, Unit-Type Offer Pressure table, Fees / Deposits, Amenity Differentiators, and nearest complete ApartmentIQ peers.
- `Search Market Visibility` is now cataloged as section id `dataforseo_search_visibility`, with approved sub-sections: advisory banner, search-market KPI tiles, Keyword Demand + Rank Check, Live SERP Visibility, SERP Pressure, DataForSEO Labs Ranked Keywords, OnPage Readiness, Local Entity Read, and AI Answer Visibility.
- Future PIB Builder direction: let users choose stable section ids or presets such as `Full PIB`, `Website / Funnel Review`, `Leasing / Inventory Review`, `Market Context`, and `Reputation / Local Presence`.
- Boundary preserved: section selection is a render-time contract over the canonical PIB family, not a new app-side PIB renderer/template/sender; locked PIB versions still require explicit current-task approval before mutation.

### 2026-05-22 - PIB v2.3.1 Locked Standard
- Promoted the approved v2.3.0 working path into locked PIB v2.3.1:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/docs/PIB_V2_3_1_LOCKED_STANDARD.md`
- v2.3.1 locks the approved `ApartmentIQ Market Enrichment` section and the new `Search Market Visibility` / DataForSEO section.
- DataForSEO presentation is locked as full-width readable blocks, including `OnPage Summary`, `OnPage Watch Items`, `Local Entity / Peer Suggestions`, and `AI Answer Visibility`.
- Boundary preserved: DataForSEO remains advisory outside-in search-market evidence and does not replace GSC, GA4, Google Ads, or operating source-of-truth data.

### 2026-05-22 - PIB v2.3.0 Search Market Visibility / DataForSEO Section
- Added a standalone `Search Market Visibility` section to PIB v2.3.0, sourced from local Pond DataForSEO rows.
- The section is advisory outside-in search evidence and renders only when DataForSEO rows exist for the governed property identity.
- Northbridge at Millenia Lake / `FL4NB` was refreshed with new DataForSEO data on 2026-05-22:
  - SERP pull: `8` keyword requests, `3` target-found rows, `$0.04` cost
  - deep enrichment: `12` keyword-demand rows, `20` Labs ranked-keyword rows, `1` OnPage snapshot, `1` Business Profile row, `1` AI visibility probe, `$0.126436` cost
- Proof artifact regenerated:
  - `/Users/mark/Property_Analytics/reports/pib_v2_3_verification/northbridge-at-millenia-lake/2026/2026-05-22__Property-Intelligence-Brief__northbridge-at-millenia-lake__2026-04-22_to_2026-05-21.html`
- Boundary preserved: DataForSEO does not replace GSC owned-search metrics, GA4 on-site behavior, Google Ads paid facts, or operating outcomes.

### 2026-05-22 - PIB v2.3.0 ApartmentIQ Advisory Enrichment
- Added the next canonical PIB version as v2.3.0, preserving the v2.2.0 path and adding ApartmentIQ only in the versioned PIB family.
- New files:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_0.py`
- The `ApartmentIQ Market Enrichment` section is advisory only and renders competitive asking rent, rent per square foot, exposure, market-visible leased estimate, review rating, listed offers, nearest complete peers, offer pressure, Unit-Type Offer Pressure, fee/deposit examples, and amenity differentiators from local Pond tables.
- Subject-property ApartmentIQ inventory/pricing rows and floorplan pulse are intentionally excluded from PIB because internal empirical Pond sources are authoritative for those facts.
- The generator resolves PIB properties through the governed property identity matrix before reading ApartmentIQ rows; Northbridge at Millenia Lake / `FL4NB` / ApartmentIQ source id `99066651` rendered successfully.
- Verification artifact:
  - `/Users/mark/Property_Analytics/reports/pib_v2_3_verification/northbridge-at-millenia-lake/2026/2026-05-22__Property-Intelligence-Brief__northbridge-at-millenia-lake__2026-04-22_to_2026-05-21.html`
- Boundary preserved:
  - no app-side alternate PIB renderer was created
  - v2.2.0 remains available unchanged
  - ApartmentIQ does not override Pond/internal source-of-truth operating, availability, guest-card, BI, or GA4 facts

### 2026-05-22 - ApartmentIQ Full-Dive Export
- Added `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_full_dive.py` to export detailed ApartmentIQ current-snapshot artifacts from local Pond rows.
- Current artifact package:
  - `/Users/mark/Property_Analytics/reports/apartmentiq/2026-05-22/full_dive/apartmentiq_full_dive_2026-05-22.md`
  - companion CSVs for market survey rows, listed offers, fees/deposits, amenities, and unit-type metrics
- Current local snapshot coverage is `28` market survey rows across `3` comp sets, with `20` complete peer rows, `15` listed-offer rows, `240` fee rows, `2,660` amenity rows, and `111` unit-type rows.
- Boundary preserved:
  - full-dive data is advisory vendor market intelligence
  - the export is separate from PIB and does not alter official operating/source-of-truth claims

### 2026-05-22 - ApartmentIQ API Connector Activated ✅
- Added a live ApartmentIQ API source route as an extension of the existing AptIQ / ApartmentIQ advisory market-intelligence lane, without changing PIB renderers/templates/senders.
- Keeper auth:
  - record: `ApartmentIQ API`
  - default notation: `keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password`
  - override env: `KSM_APARTMENTIQ_API_KEY_NOTATION`
- Implemented:
  - connector: `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py`
  - config: `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml`
  - auth helper: `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py`
  - local/D1-ready schema: `/Users/mark/Property_Analytics/apps/api/migrations/0055_create_apartmentiq_tables.sql` and `/Users/mark/Property_Analytics/infra/migrations/034_create_apartmentiq_tables.sql`
  - source contract: `/Users/mark/Property_Analytics/docs/APARTMENTIQ_API_SOURCE_CONTRACT_2026-05-22.md`
  - daily collection hook in `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- Pond tables:
  - `apartmentiq_accounts`
  - `apartmentiq_comp_sets`
  - `apartmentiq_market_survey_items`
  - `apartmentiq_units`
  - `apartmentiq_floorplans`
  - `apartmentiq_property_identity_links`
- Live exploration succeeded against `https://data.apartmentiq.io/apartmentiq/api/v1`:
  - `1` account discovered: account id `9900124`
  - `285` competitive sets discovered/upserted
  - exploratory 3-comp-set sample wrote `28` market survey rows, `1,480` unit rows, and `278` floorplan rows
  - Northbridge at Millenia Lake resolved through the governed property identity matrix as `FL4NB`; ApartmentIQ property id `99066651` is now captured in the matrix as a prefixed source id (`apartmentiq:99066651`)
- Guardrails:
  - ApartmentIQ remains advisory market/comps evidence only; Data Pond source-of-record facts govern Venterra operating, leasing, availability, guest-card, and BI claims.
  - Default scheduled posture collects account/comp-set/market-survey facts with `max_comp_sets_per_run: 20`; unit and floorplan collection are implemented but disabled by default until volume/cadence are confirmed.
- Follow-up operating cadence:
  - daily light runner: `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh`
  - weekly dive runner: `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh`
  - recurring Codex automations created: `apartmentiq-daily-light-refresh` (daily 06:35 local) and `apartmentiq-weekly-portfolio-dive` (Monday 07:15 local)
  - temporary same-day retry automation created for the initial full baseline after ApartmentIQ returned extended 429s during immediate full-run attempts: `apartmentiq-full-baseline-retry-today` (Friday 12:30 local); delete/pause after successful baseline because the ongoing Monday weekly dive is active
  - Captain alert note: `/Users/mark/Property_Analytics/reports/captains_log/source_alerts/apartmentiq_api_source_activation_2026-05-22.md`
  - enrichment summary generator: `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_enrichment_summary.py`, writing artifacts under `/Users/mark/Property_Analytics/reports/apartmentiq/`
  - rate-limit posture tightened to `8.0` seconds between requests plus `330` second 429 sleeps for the heavy units/floorplans pass

---

### 2026-05-21 - The Reserves of Thomas Glen Copy Change Activated ✅
- The Reserves of Thomas Glen / `KY4TG` has been added to active Copy Change Monitoring after the Shepherdsville KY / I-65 copy, title, meta, and OG package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_21_thomas_glen`
  - page: `https://venterraliving.com/apartments/reserves-of-thomas-glen/`
  - publish timestamp: `2026-05-21T13:48:26-05:00`
  - first full post-change day: `2026-05-22`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`, `open_graph`
  - target queries include apartments in Shepherdsville KY, Shepherdsville KY apartments, Shepherdsville apartments, apartments for rent in Shepherdsville KY, apartments near I-65 Shepherdsville KY, apartments near Louisville KY, apartments with pool in Shepherdsville KY, apartments with garage in Shepherdsville KY, pet-friendly apartments Shepherdsville, and The Reserves of Thomas Glen.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/reserves_of_thomas_glen/2026-05-21/reserves_of_thomas_glen_structured_copy_2026-05-21.json`
  - `/Users/mark/Property_Analytics/reports/site_content/reserves_of_thomas_glen/2026-05-21/reserves_of_thomas_glen_replacement_copy_proposal_2026-05-21.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/reserves_of_thomas_glen/2026-05-21/reserves_of_thomas_glen_post_publish_confounds_2026-05-21.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/ky4tg_site_change_captain_consultation_2026-05-21.md`
- Live title/meta/newer OG/Twitter tags and both replacement copy sections verified. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags. Offer watch: OG image alt references `All-In-Price: No Gimmicks - Just Great Pricing`; validate positioning/offer status before reading social-preview performance. Paid-media watch: detailed Google Ads rows show Shepherdsville and near-me apartment traffic, so separate paid keyword fit from organic copy impact.

---

### 2026-05-21 - Steeplechase Copy Change Activated ✅
- Steeplechase / `KY4SC` has been added to active Copy Change Monitoring after the Lexington KY / Hamburg / I-75 copy, title, meta, and OG package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_21_steeplechase`
  - page: `https://venterraliving.com/apartments/steeplechase/`
  - publish timestamp: `2026-05-21T13:04:36-05:00`
  - first full post-change day: `2026-05-22`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`, `open_graph`
  - target queries include Lexington KY apartments, apartments in Lexington KY, Lexington apartments, apartments for rent in Lexington KY, apartments near Hamburg Lexington KY, Hamburg Pavilion apartments Lexington KY, apartments close to I-75 Lexington KY, pet-friendly apartments Lexington KY, and branded Steeplechase terms.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/steeplechase/2026-05-21/steeplechase_structured_copy_2026-05-21.json`
  - `/Users/mark/Property_Analytics/reports/site_content/steeplechase/2026-05-21/steeplechase_replacement_copy_proposal_2026-05-21.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/steeplechase/2026-05-21/steeplechase_post_publish_confounds_2026-05-21.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/ky4sc_site_change_captain_consultation_2026-05-21.md`
- Live title/meta/newer OG/Twitter tags and both replacement copy sections verified. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags. Offer watch: OG image alt references `up to $250 off select Steeplechase homes`; validate offer status before reading social-preview performance. Paid-media watch: detailed Google Ads rows show pet-friendly and broad apartment traffic, so separate paid keyword fit from organic copy impact.

---

### 2026-05-21 - Avasa at 1604 Copy Change Activated ✅
- Avasa at 1604 / `TX416` has been added to active Copy Change Monitoring after the San Antonio / Loop 1604 copy, title, meta, and OG package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_21_avasa_1604`
  - page: `https://venterraliving.com/apartments/avasa-at-1604/`
  - publish timestamp: `2026-05-21T12:28:05-05:00`
  - first full post-change day: `2026-05-22`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`, `open_graph`
  - target queries include San Antonio apartments near Loop 1604, apartments near Loop 1604 San Antonio, apartments near Rolling Oaks Mall, apartments near Randolph AFB, pet-friendly apartments San Antonio TX, smart-home apartments San Antonio TX, and branded Avasa at 1604 terms.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_at_1604/2026-05-21/avasa_at_1604_structured_copy_2026-05-21.json`
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_at_1604/2026-05-21/avasa_at_1604_replacement_copy_proposal_2026-05-21.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/avasa_at_1604/2026-05-21/avasa_at_1604_post_publish_confounds_2026-05-21.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/tx416_site_change_captain_consultation_2026-05-21.md`
- Live title/meta/newer OG/Twitter tags and both replacement copy sections verified. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags. Offer watch: OG image alt references `Up to One Month Free`; validate offer status before reading social-preview performance. Paid-media watch: detailed Google Ads rows show recent clicks with 0 recorded conversions and `townhomes for rent` click volume, so separate paid traffic fit from organic copy impact.

---

### 2026-05-21 - The Retreat Copy Change Activated ✅
- The Retreat / `TX4GM` has been added to active Copy Change Monitoring after the Richmond TX / Grand Mission copy, title, meta, and OG package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_21_retreat`
  - page: `https://venterraliving.com/apartments/the-retreat/`
  - publish timestamp: `2026-05-21T11:00:51-05:00`
  - first full post-change day: `2026-05-22`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`, `open_graph`
  - target queries include apartments in Richmond TX, Richmond TX apartments, apartments for rent in Richmond TX, pet-friendly apartments Richmond TX, Grand Parkway, Grand Mission, Sugar Land, and branded The Retreat Richmond TX terms.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/the_retreat/2026-05-21/the_retreat_structured_copy_2026-05-21.json`
  - `/Users/mark/Property_Analytics/reports/site_content/the_retreat/2026-05-21/the_retreat_replacement_copy_proposal_2026-05-21.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/the_retreat/2026-05-21/the_retreat_post_publish_confounds_2026-05-21.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/tx4gm_site_change_captain_consultation_2026-05-21.md`
- Live title/meta/newer OG/Twitter tags verified. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags. Offer watch: OG image alt references `Now offering up to one month free`; validate offer status before reading social-preview performance.

---

### 2026-05-21 - Avasa Hammock Landing Copy Change Activated ✅
- Avasa Hammock Landing / `FL4HL` has been added to active Copy Change Monitoring after the West Melbourne / Hammock Landing copy, title, meta, and OG package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_21_hammock_landing`
  - page: `https://venterraliving.com/apartments/avasa-hammock-landing/`
  - publish timestamp: `2026-05-21T10:30:02-05:00`
  - first full post-change day: `2026-05-22`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`, `open_graph`
  - target queries include West Melbourne apartments, apartments in West Melbourne FL, apartments near Hammock Landing, apartments near Melbourne FL, Palm Bay, Florida Tech, pet-friendly, and branded Avasa Hammock Landing terms.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_hammock_landing/2026-05-21/avasa_hammock_landing_structured_copy_2026-05-21.json`
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_hammock_landing/2026-05-21/avasa_hammock_landing_replacement_copy_proposal_2026-05-21.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/avasa_hammock_landing/2026-05-21/avasa_hammock_landing_post_publish_confounds_2026-05-21.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/fl4hl_site_change_captain_consultation_2026-05-21.md`
- Live title/meta/newer OG/Twitter tags verified. Current 8-week special validates the OG image alt. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags.

---

### 2026-05-20 - EVS Round 2 Batch Prepared ✅
- Ingested `/Users/mark/Downloads/Round 2 Portfolio Rollout.docx` into the existing EVS portfolio QA lane.
- Generated Round 2 target config:
  - `/Users/mark/Property_Analytics/evs/config/round-2-qa-targets.json`
  - import report: `/Users/mark/Property_Analytics/evs/reports/round-2-qa-batch-import.json`
  - `21` Staging/Kinsta targets imported; all `21` resolved through the governed property identity matrix.
  - Pastel links in the doc are intentionally excluded from EVS testing.
  - Monteverde is listed in the doc but has no Staging URL there (`Please see Julie's email!`), so it remains pending until a target URL is supplied.
- Added `round_2_property_websites` to `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`.
- Added governed source alias `Creekside Apartment Homes` for `Creekside` via `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py` and rebuilt `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
- Preflight proof:
  - plan/dry-run report: `/Users/mark/Property_Analytics/evs/reports/round2-preflight-dry-run-20260520-v1/summary.json`
  - URL reachability report: `/Users/mark/Property_Analytics/evs/reports/round-2-url-reachability-preflight.json`
  - dry-run produced `84` runner slots (`21` targets x `2` effective profiles x `2` devices), and all `21` Staging URLs returned reachable HTTP responses.
- This extends the same EVS / BrowserStack portfolio functionality QA system used for Round 1; no parallel QA system was created.

---

### 2026-05-20 - Avasa Spring Branch Copy Change Activated ✅
- Avasa Spring Branch / `TX4BM` has been added to active Copy Change Monitoring after the Spring Branch Houston copy/title/meta package was published.
- Monitoring setup:
  - wave: `copy_wave_2026_05_20_spring_branch`
  - page: `https://venterraliving.com/apartments/avasa-spring-branch/`
  - publish timestamp: `2026-05-20T20:36:02-05:00`
  - first full post-change day: `2026-05-21`
  - tracked fields: `title`, `meta`, `upper_copy`, `neighborhood`
  - target queries include Spring Branch Houston, CityCentre, Memorial City, pet-friendly, I-10, Beltway 8, and branded Avasa Spring Branch terms.
- Current-copy archive and replacement package:
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_spring_branch/2026-05-20/avasa_spring_branch_structured_copy_2026-05-20.json`
  - `/Users/mark/Property_Analytics/reports/site_content/avasa_spring_branch/2026-05-20/avasa_spring_branch_replacement_copy_proposal_2026-05-20.json`
  - confound/verification note: `/Users/mark/Property_Analytics/reports/site_content/avasa_spring_branch/2026-05-20/avasa_spring_branch_post_publish_confounds_2026-05-20.json`
- Captain handoff:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/tx4bm_site_change_captain_consultation_2026-05-20.md`
- Live title/meta verified. Follow-up technical watch: older first Open Graph title/description tags still appear ahead of corrected OG/Twitter tags.

---

### 2026-05-20 - EVS Round 1 Tightened Delivery Package ✅
- Rebuilt the official Round 1 workbook as a fill-only turn-in artifact:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx`
  - mirror: `/Users/mark/Property_Analytics/outputs/round1_qa_sheet_update_20260520/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx`
  - fill-only validation: `/Users/mark/Property_Analytics/evs/reports/round1-v25-fill-only-validation-20260520.json`
  - validation passed with `0` violations; only existing `F:G` status/note cells changed.
- Tightened workbook status normalization and wording:
  - rows `79` and `80` now fail when rendered unit layout/pricing includes displayed units not source-backed by Pond or mismatched layout/rent evidence.
  - row `85` now fails when floor-filter controls exist but changing floors does not alter the observed unit set.
  - row `102` remains fail where Apply Now opens a Prospect Portal path without observable expected unit context after the no-submit portal proof.
  - row notes now use cleaner `EVS PASS` / `EVS FAIL` / `EVS REVIEW` / `EVS N/A` / `EVS SKIPPED` language.
- Tightened BrowserStack runner proof paths:
  - floor-filter checks attempt both Playwright select and DOM-dispatch evidence and report decisive pass/fail.
  - mobile floor-filter checks now use bounded interaction evidence rather than passive HTML only.
  - Pipeline application handoff proof can advance through the read-only DayPicker move-in date step and one no-submit lease-criteria step before deciding whether unit context is observable.
  - targeted OK4AN desktop/mobile proof is stored under `/Users/mark/Property_Analytics/evs/reports/round1-tightening-OK4AN-20260520-v1/` and `/Users/mark/Property_Analytics/evs/reports/round1-tightening-OK4AN-mobile-20260520-v3/`.
- Rebuilt local companion evidence package:
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520-v25/summary.json`
  - includes `delivery-summary.csv`, `root-cause-summary.csv`, `evidence-completeness.csv`, `dni-review.csv`, and `dni-screenshot-contact-sheet.html`.
  - DNI screenshot package uses the full Round 1 no-submit probe: `22` fail scenarios, `44` screenshots.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane and keeps the official workbook fill-only.

---

### 2026-05-20 - Site Change Captain Consultation SOP Added ✅
- Clarified the site-change / Copy Change Monitoring SOP so Captain consultation is required before meaningful site changes are approved, because the property Captain should know the property best.
- Captain handoff is also required when a property is added to an active copy-change wave or tracked fields materially change.
- Updated:
  - `/Users/mark/Property_Analytics/docs/SITE_CHANGE_CAPTAIN_HANDOFF_STANDARD_2026-05-20.md`
  - `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md`
  - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- SOP behavior:
  - Captain should be consulted before meaningful copy, metadata, CTA, routing, offer, reputation, floorplan, neighborhood, or conversion-path changes are finalized.
  - Captain/Navigator/Logkeeper must then be told which property/page changed, publish timestamp, first full post-change day, changed fields, target queries, hypothesis, memory note, and proof sources.
  - If Captain runtime/watch tables are available, create/update the watch/action item there.
  - If they are not available locally, write a handoff note under `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/`.
- Grand Harbor / `TX4GH` handoff created:
  - `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/tx4gh_copy_change_captain_handoff_2026-05-20.md`

---

### 2026-05-20 - PIB Site Evaluation Standard Memorialized ✅
- Memorialized the approved `PIB Site Evaluation` style/content standard:
  - `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`
  - report-family map reference: `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md`
- Embedded the approved `PIB Site Evaluation` as the intro to the canonical v2.2.0 PIB report when supporting evaluation evidence is available:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
  - generated Grand Harbor proof artifact: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/reports/the-cape-at-grand-harbor/2026/2026-05-20__Property-Intelligence-Brief__the-cape-at-grand-harbor__2026-04-20_to_2026-05-19.html`
- Standard purpose:
  - executive synthesis at the top of the canonical PIB for an underperforming site/property
  - uses canonical PIB payload/HTML plus Data Pond, DataForSEO, BI spend/conversion, source performance, box score, unit availability, GSC query mix, reviews/reputation, and existing Captain/Watchlist context
  - explains low performance through evidence-led reasons and action-ready recommendations
- Approved output shape:
  - Bottom Line
  - Main Reasons
  - Actionable Moves
  - source distinctions for known vs unknown evidence
- Grand Harbor / `TX4GH` is the seed precedent:
  - demand was not the core issue; conversion yield, exposed inventory, nonbrand visibility, mobile path, and message-fit were the action lanes
  - Google Ads had BI spend/cost evidence but lacked current Google Ads API keyword/click/device detail in the PIB window
- This standard does not create a new PIB renderer/template/sender and does not replace the locked canonical PIB artifact. With explicit approval, it is now the canonical PIB intro when the evidence context exists, so detailed PIB sections serve as supporting data below the diagnosis.

---

### 2026-05-20 - EVS Round 1 Audit Support Reports ✅
- Added local Round 1 audit-support generator:
  - `/Users/mark/Property_Analytics/evs/orchestration/build-round1-audit-support.mjs`
  - npm alias: `npm --prefix evs run qa:audit-support`
- Generated local support package:
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/summary.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/root-cause-summary.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/root-cause-summary.csv`
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/evidence-completeness.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/evidence-completeness.csv`
  - `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/dni-screenshot-contact-sheet.html`
- Root-cause grouping now summarizes:
  - DNI / Attribution Failure: `176` fail cells across rows `8`, `61`, `161`, `164`, and `175-178`
  - Unit Sort Order: `40` fail cells across rows `83-84`
  - Availability Mismatch: `17` fail cells on row `81`
  - SightMap Unit Zoom: `7` fail cells on row `90`
  - Specials Toggle: `1` fail cell on row `4`
  - Inspected Review Required: `55` review cells
- Added focused npm presets:
  - `qa:dni-phone-probe`
  - `qa:forms-validation`
  - `qa:sort-order`
  - `qa:sightmap`
  - `qa:availability`
- Updated local evidence package:
  - `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520-v5/evidence-manifest.json`
  - indexes `77` files including the support reports and `44` screenshot artifacts
- This remains local EVS evidence/report support only; the supplied workbook remains fill-only.

---

### 2026-05-20 - EVS DNI Probe + Fill-Only Validator ✅
- Added a no-submit DNI/source-phone probe:
  - `/Users/mark/Property_Analytics/evs/orchestration/run-dni-phone-probe.mjs`
  - npm alias: `npm --prefix evs run qa:dni-phone-probe`
  - exports feed-backed `trackingCodes`, generates `?id=<trackingId>` home/contact URLs, captures expected phone, visible phones, `tel:` links, runtime selected source, loaded URLs, and optional screenshots
  - strict verdict: visible text or `tel:` must show the expected source phone; runtime-selected source phone alone is evidence but not a pass
- Smoke proof:
  - `/Users/mark/Property_Analytics/evs/reports/dni-phone-probe-smoke-OK4AN-20260520-v2/summary.json`
  - `OK4AN` / `APL` failed correctly: runtime selected `(844) 993-2751`, but visible/tel phone stayed `(405) 321-5800`
- Round 1 no-submit one-source proof:
  - `/Users/mark/Property_Analytics/evs/reports/dni-phone-probe-round1-one-source-screenshots-20260520/summary.json`
  - `22` scenarios failed / `0` passed; this supports the initial-round workbook-wide DNI failure decision without submitting forms
  - screenshots captured: `44` local PNGs, two per property/source scenario
- Added workbook fill-only validator:
  - `/Users/mark/Property_Analytics/evs/orchestration/validate-workbook-fill-only.mjs`
  - npm alias: `npm --prefix evs run qa:validate-fill-only`
  - compares the supplied workbook to the filled workbook and fails on changed sheet structure or non-allowed cell changes
- The validator caught an existing violation in v22: an extra `EVS Findings Summary` tab.
- Rebuilt the workbook from the original supplied sheet and copied only the filled `F:G` cells:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v23_fill_only.xlsx`
  - `/Users/mark/Property_Analytics/evs/reports/round1-v23-fill-only-validation-20260520.json`
  - validation passed with `0` violations.
- Updated the local evidence package:
  - `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520-v4/evidence-manifest.json`
  - indexes `71` files including `44` screenshot artifacts
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-20 - EVS Fill-Only Workbook + Local Evidence Package ✅
- Locked the Round 1 workbook handling rule: supplied QA workbooks are fill-only, with no added tabs, columns, rows, screenshots, raw JSON, HTML snapshots, or non-native evidence objects.
- Added local evidence packaging utility:
  - `/Users/mark/Property_Analytics/evs/orchestration/create-local-evidence-package.mjs`
  - indexes local evidence files with role, path, size, modified time, and SHA-256 hash
  - can optionally copy files into the package with `EVS_EVIDENCE_COPY_FILES=1`
- Updated batch runner:
  - `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`
  - writes `local-evidence-package/evidence-manifest.json` for each batch run unless `EVS_DISABLE_EVIDENCE_MANIFEST=1`
- Current Round 1 v22 local proof package:
  - `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520/evidence-manifest.json`
  - indexes the v22 workbook mirror, DNI phone failure audit, line coverage audit, no-submit form-validation proof, Carlyle late-addition evidence, sort-order proof, unit Apply proof, and review-sort proof
- Updated `/Users/mark/Property_Analytics/docs/PORTFOLIO_FUNCTIONALITY_QA_SYSTEM_2026-05-12.md` with the fill-only/local-evidence operating rule.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-20 - EVS DNI Phone Failure Marked For Initial Round ✅
- Updated the Round 1 workbook after user direction that initial-round form/attribution checks should fail where DNI phone-number replacement is not working and form attribution is not trusted.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v22.xlsx`
  - rows `8`, `61`, and `161` now fail across all `22` property tabs with DNI/source phone replacement notes
  - row `164` remains failed across all `22` tabs for form submission attribution
  - rows `175-178` remain failed across all `22` tabs for AH/EAI guest-card proof
  - row `165` remains `Pass` because required-field validation is a no-submit browser-validity check
- Audit artifact:
  - `/Users/mark/Property_Analytics/evs/reports/round1-dni-phone-fail-audit-20260520.json`
- This is an initial-round launch QA decision over the workbook evidence: base phone display may still render structurally, but source-specific DNI phone replacement is not accepted as passing.

---

### 2026-05-20 - EVS Line Requirement Totality Audit ✅
- Audited every Round 1 workbook row tagged `Functionality` or `Data Integrity` against the EVS contract, current workbook state, and latest BrowserStack/local evidence.
- Closed the main totality gap: `Carlyle Place Apartments` had been added after earlier batch evidence and still had blank EVS-owned rows.
- New Carlyle evidence:
  - `/Users/mark/Property_Analytics/evs/reports/round1-carlyle-totality-20260520/portfolio-desktop.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-carlyle-totality-20260520/portfolio-iphone.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-carlyle-totality-20260520/apartments-desktop.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-carlyle-totality-20260520/apartments-iphone.json`
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v20.xlsx`
  - no blank EVS-owned Functionality/Data Integrity statuses remain across the `22` Round 1 tabs
  - row `4` now distinguishes `N/A` no-special properties from the one specials-applicable finding (`Avasa Grove West`)
  - rows `175-178` are explicitly governed AH/EAI proof pending, not generic skipped rows
- Coverage audit:
  - `/Users/mark/Property_Analytics/evs/reports/round1-line-requirement-coverage-audit-20260520-v2.json`
  - `/Users/mark/Property_Analytics/evs/reports/round1-line-requirement-coverage-audit-20260520-v2.md`
  - `45` EVS-owned rows audited: `27` fully inspected/applicability-resolved, `5` inspected with failures, `8` inspected review-required, `5` governed downstream-proof pending.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-20 - EVS Sort Order Retest Correction ✅
- Corrected the prior over-broad manual QA override for Round 1 rows `83` and `84`.
- The correct acceptance rule is the spreadsheet assertion itself: rendered unit rows must follow size, then move-in date, then price order. Operable sort UI alone is not enough to pass these rows.
- The BrowserStack runner now hard-fails rows `83` and `84` when rendered unit rows do not follow the required combined ordering.
- Targeted current-state retest:
  - `/Users/mark/Property_Analytics/evs/reports/round1-sort-order-local-20260520T1258/summary.json`
  - rows `83`/`84` current result: `20` Fail / `2` Pass
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v19.xlsx`
  - rows `83` and `84` now reflect the current sort-order evidence.
  - row `85` floor-filter behavior remains separate and is not changed by this sort-order correction.

---

### 2026-05-20 - EVS Contact Form Validation Checked ✅
- Corrected stale Round 1 workbook skips for Contact form rows after confirming the agreed split:
  - row `165` Required Field Validation is a safe no-submit validation check and should be tested
  - row `164` Contact Form Submit remains a governed synthetic-submit lane because it sends real downstream leads
- Targeted local no-submit proof checked desktop and iPhone-shaped contact pages for all Round 1 properties:
  - `/Users/mark/Property_Analytics/evs/reports/round1-contact-validation-local-20260520T1245/summary.json`
  - row `165` passed `22/22`
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v18.xlsx`
  - row `165` now shows `Pass` on all `22` property tabs
  - row `164` is now `Review` with a governed-submit pending note instead of a generic skip
- Actual row `164` submit testing requires an intentional run with `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`, `EVS_SYNTHETIC_EMAIL_DOMAIN`, and `EVS_SYNTHETIC_RUN_LABEL`, followed by AH/EAI reconciliation.

---

### 2026-05-20 - EVS Unit-Specific Apply Retest Completed ✅
- Completed the Round 1 row `102` Unit Detail Page Apply Now retest after the prior workbook held a stale `Retest required` placeholder.
- Targeted local EVS proof checked desktop and iPhone-shaped pages for each Round 1 property:
  - navigate Apartments & Pricing
  - open an observed unit detail page
  - inspect Apply Now destination
  - pass when the destination carried unit-specific context such as Resi `unit_id`, or equivalent landed-page unit evidence
- Result:
  - `/Users/mark/Property_Analytics/evs/reports/round1-row102-unit-apply-local-20260520T1135/summary.json`
  - row `102` passed `22/22` Round 1 properties
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v17.xlsx`
  - row `102` now shows `Pass` on all `22` property tabs with unit-specific Apply Now evidence.

---

### 2026-05-20 - EVS Reviews Masonry Sort Note Clarification ✅
- Clarified Round 1 row `155` Reviews sort evidence so masonry layout warnings do not imply the underlying review feed/source order is broken.
- Desktop review sort evidence now distinguishes:
  - source/DOM order newest-first
  - visual masonry card reading order not strictly newest-first
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v15.xlsx`
  - Existing row `155` review notes for `5` property tabs now state that source/DOM order is newest-first, but masonry visual card placement is not strictly newest-first in direct reading order.
- This remains `Review`, not `Fail`, unless source/DOM order itself is not newest-first.

---

### 2026-05-20 - EVS Availability Source-Backed Failure Classification ✅
- Tightened Round 1 row `81` Availability classification now that Pond/feed availability is present for the batch.
- BrowserStack row `81` now returns `Fail` when source-backed availability comparison finds unit-set, rendered/structured count, or available-date mismatches.
- Missing/unloadable Pond evidence still remains `Skipped`/`Review`; the hard-fail path is only for cases where source truth exists and rendered availability does not match it.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v14.xlsx`
  - Existing row `81` Pond-backed availability findings are now `17` Fail / `4` Pass for the prior 21-property evidence set.
  - Carlyle Place remains blank for this row until included in the next BrowserStack run.
- This keeps rows `79` and `80` scoped to displayed layout/pricing correctness while row `81` owns availability completeness and date fidelity.

---

### 2026-05-20 - EVS Sort / Floor Manual QA Override ✅
- Corrected the Round 1 rows `83`, `84`, and `85` workbook state after user manual QA confirmed the List View sort, Grid View sort, and floor-change behavior work and are observable.
- The prior EVS hard failures were based on insufficient automation:
  - sort rows checked passive/default rendered order rather than actively exercising the UI sort workflow
  - floor row used a narrow automation path rather than the manually confirmed UI workflow
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v12.xlsx`
  - Existing rows `83`, `84`, and `85` are now `Pass` with `Manual QA PASS` notes for the 21 properties in the prior evidence set.
  - Carlyle Place remains blank for those rows until included in the next BrowserStack/manual QA pass.
- Runner classification was softened back to warning for passive sort/floor evidence so EVS does not emit hard failures until it actively exercises the same UI workflow.

---

### 2026-05-20 - EVS Form Checks Split: Validation vs Governed Submit ✅
- Clarified the Round 1 form-testing boundary while broad multi-source form attribution remains paused for vendor-side confirmation.
- Row `165` Required Field Validation is now a no-submit check:
  - owner `forms_qa`
  - runner profile `contact_form_checks`
  - side-effect policy `no_submit_validation_only`
  - automation status `ready_for_runner_mapping`
- Row `164` Contact Form Submit remains a governed synthetic-submit check:
  - owner `forms_qa`
  - runner profile `contact_form_checks`
  - side-effect policy `form_submission_required`
  - requires explicit submit flags, synthetic identity, and downstream AH/EAI reconciliation for final routing proof.
- The existing `lead_attribution_e2e` lane can still run a narrow one-source action smoke: generated `?id=<trackingId>` URL, expected source phone visibility, recipient evidence where exposed, synthetic form draft/submit, acknowledgement capture, and downstream confirmation fields.
- This preserves the pause on broad source sweeps while allowing controlled action confirmation for one source/property.

---

### 2026-05-20 - EVS Unit-Specific Apply Landing-Page Verification Fix ✅
- Corrected the row `102` Unit Detail Page Apply Now logic after review showed the prior failure classification was based only on the outbound Pipeline URL.
- The BrowserStack runner now opens the Pipeline/Prospect Portal destination and checks the landed page for the expected unit number/source unit identifier before deciding pass/fail.
- The older v10 workbook evidence is now considered insufficient for row `102` because it did not inspect the landed Portal page.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v11.xlsx`
  - Existing row `102` hard fails were moved back to `Review` with a retest-required note until the improved runner collects landed-page proof.
  - Carlyle Place remains blank for this row until it is included in the next BrowserStack run.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Unit-Specific Apply Failure Classification ✅
- Tightened Round 1 EVS Apartments & Pricing row `102` so a Unit Detail Page Apply Now handoff must carry unit context when the checklist asks for a unit-specific app.
- Desktop and mobile runner paths now return `Fail` when the Apply Now destination is only property-level, such as `/createPipelineApplication/<propertyCode>`, or when no application handoff is found.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260519_v10.xlsx`
  - Existing Round 1 evidence now marks row `102` as `Fail` for all `21` properties that were in the prior BrowserStack run.
  - Carlyle Place is blank for this row until it is included in the next BrowserStack run because it was added after the existing evidence set.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - Round 1 Carlyle Place Target Confirmed ✅
- Confirmed Carlyle Place Apartments as part of the Round 1 Kinsta QA target set.
- Added governed extra target config:
  - `/Users/mark/Property_Analytics/evs/config/round-1-qa-confirmed-extra-targets.json`
- Updated `/Users/mark/Property_Analytics/scripts/import_round1_qa_batch.py` so confirmed workbook-but-not-docx targets are merged durably during future imports.
- Regenerated `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json` and `/Users/mark/Property_Analytics/evs/reports/round-1-qa-batch-import.json`.
- Carlyle target:
  - property code `TX4CP`
  - workbook tab `Carlyle Place Apartments`
  - Kinsta target URL `https://carlyleplaceapartments.kinsta.cloud/`
  - canonical website URL `https://venterraliving.com/apartments/carlyle-place-apartments/`
- Round 1 now has `22` targets and no workbook/doc reconciliation warnings.

---

### 2026-05-19 - EVS Sort / Floor Functional Fail Classification ✅
- Tightened Round 1 EVS Apartments & Pricing functional classification so deterministic broken behavior is marked as `Fail`, not `Review`.
- Rows `83` and `84` now fail when rendered unit rows do not follow the required combined sort order: size, then move-in date, then price.
- Row `85` now fails when the floor filter exists but changing it does not update the observed available-unit set, cannot be exercised, or lacks usable floor metadata.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260519_v9.xlsx`
  - Round 1 rows `83` and `84` are now `19` Fail / `2` Pass.
  - Round 1 row `85` is now `21` Fail.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Data Integrity Verdict Scoping ✅
- Tightened Round 1 EVS Apartments & Pricing verdict scoping so unit-set completeness does not incorrectly contaminate pricing/layout rows when all displayed units are source-backed and the field-specific mismatches are zero.
- Rows `79` and `80` now judge displayed unit layouts/pricing against Pond records; Pond-only units missing from the rendered site remain tracked under row `81` Availability.
- Displayed units missing from Pond still keep rows `79`/`80` in review because those rendered values cannot be source-validated.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260519_v8.xlsx`
  - Round 1 row `79` is now `13` Pass / `8` Review.
  - Round 1 row `80` is now `4` Pass / `17` Review.
  - Round 1 row `81` remains the availability completeness gate at `4` Pass / `17` Review.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Specials Toggle N/A Classification ✅
- Tightened Round 1 EVS specials-bar functionality classification so a missing Specials toggle is not reported as a generic skip when the latest ThirtyLines feed has no `propertyBannerSpecial` for the property.
- The property contact/source-truth exporter now carries feed `propertyBannerSpecial` alongside contact, vendor URL, and geo truth.
- BrowserStack row `4` now returns `not_applicable` when no feed special exists and no specials toggle candidate is visible; if the feed has a special but no toggle is found, the row remains a testable skipped/warning candidate for review.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260519_v7.xlsx`
  - `20` Round 1 property tabs with blank feed specials were updated to `N/A` for the Specials Bar toggle row.
  - `Avasa Grove West` was intentionally left testable because its feed `propertyBannerSpecial` is populated.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Round 1 Map Pin Feed Geo Fix ✅
- Fixed Round 1 EVS map-pin validation so the Location / Map row uses latitude/longitude from the latest ThirtyLines feed instead of requiring a separate property geo config file.
- The property contact/source-truth exporter now carries feed `latitude` and `longitude` alongside phone/vendor URL truth.
- The generic batch runner now supplies that feed-backed source truth to `portfolio_functionality_regression`, not only `header_navigation_integrity`.
- BrowserStack row `141` now navigates to `/location/`, extracts rendered/schema/map coordinate candidates, compares them to feed lat/long with a 0.25 mile tolerance, and records expected/rendered coordinate evidence.
- Full Round 1 proof after the fix:
  - `/Users/mark/Property_Analytics/evs/reports/round1-map-pin-full-20260519T220728Z/summary.json`
  - row `141` passed `42/42` desktop+iPhone property sessions with feed/rendered coordinate evidence.
- Workbook follow-up:
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260519_v6.xlsx`
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Round 1 Media Interaction Rows Reclassified ✅
- Tightened the Round 1 EVS / BrowserStack workbook contract so browser-observable media functionality is no longer over-deferred as generic media QA:
  - Unit Detail Page row `89` now exercises the Virtual Tour / Matterport handoff.
  - Unit Detail Page row `91` now exercises unit-detail photo/gallery modal behavior.
  - Unit Detail Page row `92` now verifies rendered image presence but remains a human/media review item for property-specific image correctness.
  - Features row `114` and Amenities row `124` now exercise camera/photo triggers and verify gallery/modal evidence.
- The importer now classifies camera icon, photo modal, virtual tour, Matterport, and browser-observable image-render checks as EVS-owned where the assertion is functional; pure “is this the correct property photo?” judgment remains a review lane.
- The BrowserStack runner now closes prior media overlays between checks, recognizes UIkit/lightbox/modal gallery surfaces, and records modal image evidence so sequential Matterport/photo checks do not create false warnings.
- Focused OK4AN proof after the fix:
  - `/Users/mark/Property_Analytics/evs/reports/round1-media-interactions-smoke-OK4AN-v2-20260519T210658Z/summary.json`
  - desktop and iPhone passed Matterport row `89`, photo/gallery row `91`, Features camera row `114`, and Amenities camera row `124`.
  - row `92` warns by design because EVS can prove images render but property-specific image correctness still needs human/media confirmation.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

---

### 2026-05-19 - EVS Round 1 QA Harness Tightening ✅
- Tightened the Round 1 EVS / BrowserStack QA harness after the first full property batch:
  - `export_evs_property_contact_truth.py` now resolves URL-list property ids/codes through the governed property identity matrix, so Round 1 header/footer checks receive feed-backed ThirtyLines contact truth instead of falling back to structural checks.
  - Header/footer path matching now treats `http` and `https` on the same host as the same site for internal nav validation, fixing the Cobblestone at Eagle Harbor false warning caused by the `http://` batch URL resolving to `https://` site links.
  - Reviews carousel validation now uses a 4.5 second dwell, observes actual active slide/transform/control state, and can fall back to next-control interaction instead of only comparing parent text/class.
  - JavaScript runtime classification now ignores non-actionable browser/vendor noise such as ResizeObserver loop notifications and YouTube fullscreen permission-policy warnings, while preserving actionable errors.
  - BrowserStack-only WebGL creation failures and aborted third-party media/vendor requests are now classified as ignored runtime/network noise; explicit SightMap/Matterport checks remain responsible for vendor functionality.
  - Pond availability findings now include compact unit-level mismatch evidence for rendered-vs-feed unit/rent/date/sqft differences and use row-specific verdict wording for unit layouts, pricing, and availability.
  - Apartments sort checks now evaluate combined size -> move-in date -> price order and emit the first inversion instead of requiring every independent ordering to be true at once.
  - Floor-filter checks now preserve select options, selected method, target floor, before/after unit counts, and changed-unit evidence for spreadsheet/export review.
  - Unit-detail SightMap checks now try the rendered Apartment/Unit Location control before deciding whether the SightMap iframe or unit-specific locate call is absent.
  - Other Similar Homes detection is less brittle on unit-detail/mobile snapshots and recognizes broader same-site apartment/floorplan labels and links.
- Cobblestone proof after the harness tightening:
  - desktop and iPhone `header_navigation_integrity` both pass for header logo/home, header nav, footer nav, phone, Apply Now, and Schedule Tour.
  - desktop and iPhone `portfolio_functionality_regression` both pass the Reviews carousel check.
- Focused deep-journey proof after the final tightening:
  - `/Users/mark/Property_Analytics/evs/reports/round1-tight-floor-proof-20260519T183244Z/summary.json`
  - CoHo: 19 pass / 3 warn; remaining warnings are unit sort order and floor select options (`Any` only despite inferred unit floors).
  - Camber Ridge: 15 pass / 7 warn; remaining warnings are Pond date/unit-set evidence, unit sort order, floor filter not changing visible units after selecting `2nd Floor`, and missing Apartment Location/SightMap control on the tested unit detail.
- This extends the existing EVS / BrowserStack portfolio functionality QA lane. It does not touch locked PIB files or create a parallel QA system.

### 2026-05-19 - EVS Critical QA Summary / Severity Gate ✅
- Tightened EVS severity policy so high-severity missing core functionality cannot hide as a generic warning:
  - Missing SightMap surface/control now fails row `90`.
  - SightMap runtime/vendor API errors such as `SightMap IFrame API: Unit with Unit Number ... was not found` are mapped back to row `90` as high-severity failures with the original error preserved in evidence.
  - Missing high-severity application, schedule-tour, price-quote, or unit-detail handoffs are promoted from warning to failure when the core target/control is absent.
  - Header logo/home, header phone, header Schedule Tour, header Apply Now, header primary nav, footer primary nav, and mobile menu parity are now high-severity header/footer failures when required evidence is absent.
- Batch orchestration now writes a separate blocker-first export next to every full summary:
  - `critical-summary.json`
  - `critical-summary.csv`
  - fields include `site_ready`, `needs_review`, `critical_fail_count`, `fail_count`, `high_warn_count`, top blockers, workbook row, profile, device, message, and compact evidence.
- Proof artifacts:
  - Two-property proof: `/Users/mark/Property_Analytics/evs/reports/round1-critical-summary-proof-v2-20260519T184939Z/critical-summary.csv`
  - CoHo SightMap runtime mapping proof: `/Users/mark/Property_Analytics/evs/reports/round1-critical-summary-sightmap-map-proof-20260519T185135Z/critical-summary.json`
- This extends the existing EVS / BrowserStack portfolio functionality QA lane and is intended to make launch batches auditable and blocker-first. It does not touch locked PIB files or create a parallel QA system.

### 2026-05-18 - Copy Change Monitoring wired into Data Pond ✅
- Added **Copy Change Monitoring** as the governed local route for permanent website copy/title/meta/FAQ/CTA changes.
- New source contract:
  - `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md`
- New local utility and operator entrypoint:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`
  - `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py`
- Updated `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` so the Copy Change Impact Brief now:
  - reads active copy-change waves/interventions from local registry tables instead of relying on the hardcoded property list
  - seeds the existing April 17, 2026 cohort into `copy_wave_2026_04_17`
  - supports multiple waves and property additions without code edits
  - writes normalized local observations into `copy_change_observations`
  - stores aggregate GSC, GA4 Organic Search, and GSC query-cohort evidence locally
  - keeps the executive email as a concise quick read and no longer attaches raw JSON unless `--attach-json` is explicitly passed
- Local SQLite tables now created/used in `/Users/mark/Property_Analytics/data/portfolio_analytics.db`:
  - `copy_change_waves`
  - `copy_change_interventions`
  - `copy_change_observations`
- The seeded April cohort currently has six interventions: Fairways at South Shore, Townhomes at Lake Park, The Pointe Bentonville, Elation at Grandway West, The Anatole, and Forest View.
- This extends Site Content Creator, Website Change Watch, DataForSEO/Search Intelligence, EVS, Captain/Watchtower, and the existing Copy Change Impact Brief. It does not touch locked PIB files and does not create a new PIB renderer/report family.

### 2026-05-17 - Property Narrative Canon Strategy Established ✅
- Added the **Property Narrative Canon v1** as the governing core artifact for future VACS / Site Content Creator / Content Office strategy.
- New canonical doc:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md`
- Strategic posture:
  - VACS should evolve from a narrow AI content generator into the narrative synthesis layer for Content Operations.
  - The canon is the durable property narrative source from which site rewrites, VACS long-form drafts, GBP posts, social drafts, email snippets, FAQ/schema recommendations, blog/editorial briefs, Captain/Navigator content recommendations, and future publishing packages are derived.
  - Data Pond remains factual authority; Captain's Log / Brief remains operating intelligence; VACS owns narrative synthesis; Site Content Creator owns live-site expression and harmonization; Content Office owns channel distribution and proof.
  - DataForSEO is the active search/environment evidence source for SERP, keyword, OnPage, Business, AI visibility, and LLM mentions where available.
  - Ahrefs is a future governed source for backlink, authority, competitor content-gap, and topic evidence after onboarding.
  - SEMRush is terminated for the active operating lane; legacy SEMRush history can remain as historical evidence, but new content/search strategy should not revive SEMRush-dependent logic.
- The first recommended implementation slice is one property, one canon, one live-site harmonization audit, one VACS long-form artifact, and one channel derivative package before broad publishing automation.
- This extends Content Operations / VACS / Site Content Creator / Content Office / Captain Navigator. It does not touch locked PIB files and does not create a separate SEO report family.

### 2026-05-14 - GSC Core Indexation Warning Added ✅
- Added a true business-risk warning layer for Google Search Console URL Inspection inside `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`.
- The alert system now checks daily `gsc_url_inspection` evidence for:
  - canonical property homepage/core URL returning non-PASS
  - all sampled URLs for a reportable property returning non-PASS
  - explicit robots/noindex signals on inspected URLs
- The warning intentionally does **not** escalate benign Search Console exclusions such as redirects, alternate canonicals, specials pages, and other non-core URL states.
- Current 2026-05-14 verification:
  - GSC URL Inspection had `0` core indexation warnings against the live/profile-backed portfolio
  - the full alert preview now includes a `Core Indexation Warnings` summary tile
  - synthetic critical warning rendering was verified
- This extends the canonical Data Collection / monitoring alert lane. It does not touch locked PIB files and does not create a separate SEO report family.

### 2026-05-14 - Cloudflare Edge Delivery Analytics Collector Added ✅
- Added Cloudflare as an additive **Edge Delivery Intelligence** source in the canonical daily collection routine.
- New canonical paths:
  - `/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml`
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
  - `/Users/mark/Property_Analytics/scripts/smoke_cloudflare_analytics.py`
  - `/Users/mark/Property_Analytics/docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0054_create_cloudflare_edge_daily_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0040_create_cloudflare_edge_daily_metrics.sql`
- Canonical DB table: `cloudflare_edge_daily_metrics` in `/Users/mark/Property_Analytics/data/portfolio_analytics.db`.
- v1 uses Cloudflare GraphQL Analytics API `httpRequestsAdaptiveGroups` with `requestSource: "eyeball"` and configured zones/hostnames.
- Stored facts include date, zone, hostname, path where feasible, requests, bytes, cached/uncached estimates, cache hit ratio, cache-status JSON, and edge status buckets with emphasis on 4xx/5xx.
- Rows upsert on `metric_date, zone_id, hostname, path`; `path='__all__'` is the hostname/day aggregate row.
- Daily orchestration now invokes Cloudflare edge analytics after the existing Cloudflare cache audit. Missing credentials or Cloudflare API failures are graceful advisory conditions and do not fail GA4, GSC, Portfolio Pulse, Insights Engine, or D1 mirror behavior.
- Explicit source boundary: Cloudflare is edge-delivery/cache infrastructure intelligence only; it does not replace GA4, Heap, or GSC and does not change Portfolio Pulse email content.
- This extends Data Collection / Data Pond and the existing Cloudflare cache-audit neighborhood. It does not touch locked PIB files and does not create a dashboard or speculative insight layer.

### 2026-05-13 - Round 1 Property Website QA Batch Prepared ✅
- Official Round 1 inputs:
  - `/Users/mark/Downloads/Round 1 QA.docx`
  - `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`
- Added reusable importer `/Users/mark/Property_Analytics/scripts/import_round1_qa_batch.py`.
  - Reads the Word doc URL list.
  - Reconciles property names against the official workbook tabs.
  - Resolves identities through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
  - Writes `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`.
  - Writes audit import report `/Users/mark/Property_Analytics/evs/reports/round-1-qa-batch-import.json`.
- Round 1 target count is `22`; all doc-listed properties plus the user-confirmed Carlyle Place extra target resolve through the governed identity matrix and map to workbook tabs.
- The original workbook/doc reconciliation warning for `Carlyle Place Apartments` is cleared by `/Users/mark/Property_Analytics/evs/config/round-1-qa-confirmed-extra-targets.json`.
- Updated `/Users/mark/Property_Analytics/scripts/import_portfolio_qa_contract.py` and regenerated `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json` from the official workbook.
  - Contract now imports `45` rows: `43` Functionality and `2` Data Integrity.
  - Owner split: `34` EVS, `5` media QA, `2` forms QA, `4` lead-attribution QA.
  - EVS executable profiles: `16` `portfolio_functionality_regression` checks and `18` `apartments_pricing_deep_journey` checks.
  - Data Integrity rows map into the Apartments & Pricing deep/mobile source-backed Pond comparison path.
- Added Round 1 batch definition `round_1_property_websites` in `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`.
- Added generic batch runner `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`.
  - It reads the batch plan, loops target/profile/device combinations, stores per-target evidence under `evs/reports/<run_id>/`, and uses the mobile deep profile automatically for iPhone Apartments & Pricing checks.
- Forms are now wired as a separate guarded lane instead of staying purely deferred:
  - importer maps rows `164` and `165` to `contact_form_checks` under owner `forms_qa`
  - default Round 1 runs still exclude forms
  - `EVS_INCLUDE_FORMS=1` includes form checks alongside the normal batch
  - `QA_INCLUDE_OWNERS=forms_qa EVS_RUN_PROFILES=contact_form_checks` reruns only forms
  - actual submissions remain skipped unless `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`, `EVS_SYNTHETIC_EMAIL_DOMAIN`, and `EVS_SYNTHETIC_RUN_LABEL` are set
  - shared EVS schema, API profile registry, web profile picker, and EVS persistence constraints now recognize `contact_form_checks`; migration `0053` seeds it as separate draft evaluation set `contact_form_checks_v1`
  - no-submit smoke proof for Anatole (`OK4AN`) wrote `/Users/mark/Property_Analytics/evs/reports/round1-form-profile-smoke-OK4AN.json`; required-field validation passed and form submission correctly skipped while disabled
- Generated first run plan `/Users/mark/Property_Analytics/evs/reports/round-1-qa-plan.json`.
- Anatole first-property proof follow-up:
  - fixed Round 1 Pond availability export so URL-list targets export property-specific Pond truth by governed property id instead of reusing the old five-property Pilot export
  - `OK4AN` Pond export now returns `11` units and rows `79-81` pass on desktop and iPhone
  - tightened mobile runtime classification so cancelled Matterport/SightMap/font media requests do not contaminate EVS functionality findings while media remains a separate owner lane
  - remaining Anatole review items after fix: rows `83-84` sort order warn on desktop/mobile, row `102` mobile Apply Now lacks unit context, and row `155` review sort remains skipped until machine-readable review dates are exposed
  - row `155` was then tightened to parse rendered review date text (`MM DD, YYYY`) instead of requiring `<time datetime>`; Anatole desktop now warns because DOM order is newest-first but visual masonry card order is not direct newest-first, while iPhone direct card order passes
- First full run command:
  - `QA_BATCH_ID=round_1_property_websites node evs/orchestration/run-portfolio-qa-batch.mjs`
- Useful first-pass smoke command:
  - `QA_BATCH_ID=round_1_property_websites EVS_RUN_PROFILES=portfolio_functionality_regression EVS_RUN_DEVICE_PROFILES=desktop_chrome EVS_TARGET_IDS=OK4AN node evs/orchestration/run-portfolio-qa-batch.mjs`

### 2026-05-13 - Monteverde Website Change Watch Baseline ✅
- Canonical name: **Monteverde Website Change Watch**.
- Prior/adjacent references such as “Monteverde Monitoring,” “Monteverde SEO monitor,” “vendor SEO baseline,” or “Monteverde watch” should consolidate into **Monteverde Website Change Watch**.
- Monteverde / `https://monteverdesatx.com/` now has an active website change-watch lane for external AI SEO vendor monitoring.
- The watch now also monitors the new blog subdomain: `https://blog.monteverdesatx.com/`.
- Governed property identity:
  - property code `TX4MV`
  - GA4 `488649687`
  - GSC `sc-domain:monteverdesatx.com`
  - community id `e62033cc-7695-480f-b247-e6a0018746e1`
- New canonical paths:
  - `/Users/mark/Property_Analytics/config/website_change_watch_properties.json`
  - `/Users/mark/Property_Analytics/scripts/monitor_monteverde_website_watch.py`
  - `/Users/mark/Property_Analytics/docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md`
  - `/Users/mark/Property_Analytics/reports/website_change_watch/monteverde/20260513T165310Z/baseline_report.md`
- The initial clean baseline captured `9` sitemap pages, all HTTP `200`, `869` rendered text blocks, `4,668` visible words, `593` links, `195` CTA-like links, `212` images/alt text records, `9` JSON-LD blocks, and `18` custom schema-bearing scripts.
- Baseline Data Pond reads were included for GA4, GSC, PSI, GTMetrix, DataForSEO OnPage/SERP/Labs/Business, GBP insights/reviews, Google Ads, unit availability, and Cloudflare synthetic cache checks.
- Same-session gap fill:
  - GTMetrix live row inserted for `2026-05-13`: score `84`, structure `86`, fully loaded `4618 ms`, FCP `486 ms`, TTI `950 ms`, `31` requests, `4.93 MB`
  - GBP review summary derived from canonical `gbp_reviews`: `16` reviews, average rating `4.625`, `0` new reviews in the last 30 days
  - Cloudflare synthetic checks persisted for homepage, floor plans, amenities, and contact on desktop/mobile clean/query variants; all sampled rows returned `CF-Cache-Status: DYNAMIC`, so this is now a cache finding rather than a missing-data gap
- Strategic memorialization:
  - The Monteverde watch is the seed pattern for a future portfolio-grade Website Change Watch capability, not a standalone SEO tool.
  - Future integration should fold into Site Content Creator, Data Pond snapshot/diff tables, Captain Website/SEO/Content routines, EVS post-change validation, Watchtower freshness/alert surfaces, and Specs page-section contracts.
  - Keep baseline, diff, and impact windows separate: original state before vendor work, field-level change trail during work, and delayed GA4/GSC/PSI/GTMetrix/DataForSEO/GBP/conversion impact after enough lag has elapsed.
  - Backend accountability should be added through WordPress/WP Engine revision/activity-log evidence when access is available, feeding the same lane rather than a parallel monitor.
- This extends Site Content Creator / Data Pond / Captain website routine / EVS direction. It does not touch canonical PIB files and does not create an alternate PIB/report renderer.

### 2026-05-13 - Daily Spotlight PageSpeed Insights Performance Roundup Scheduled ✅
- Canonical name: **Spotlight PageSpeed Insights Performance Roundup**.
- This is the approved PSI-first replacement for the prior `Pilot Performance View For Spotlight 11` framing.
- Report contract:
  - title: `Spotlight Performance Roundup`
  - subtitle: `PageSpeed Insights Performance`
  - PageSpeed Insights performance is the dominant displayed score and trend
  - New Users, core PSI/CWV fields, and BrowserStack remain supporting context
  - GTMetrix is intentionally omitted from the Spotlight 11 view
  - prior status chips/badges are removed
- New canonical paths:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_spotlight_performance_roundup.py`
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py`
  - `/Users/mark/Property_Analytics/run_spotlight_performance_roundup_daily.sh`
  - `/Users/mark/Property_Analytics/pilot_roundup/reports/spotlight/`
  - `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.performance.roundup.daily.plist`
- Daily delivery:
  - launchd job `com.venterra.spotlight.performance.roundup.daily` runs at `7:00 AM` local time
  - email recipients: `mlaufhutte@venterraliving.com`, `sbynum@venterraliving.com`, `elongoria@venterraliving.com`, `jadomingue@venterraliving.com`
  - subject format: `Spotlight PageSpeed Insights Performance - MM-DD-YYYY`
  - duplicate-send protection uses delivery logs under `/Users/mark/Property_Analytics/logs/email_delivery/spotlight_performance_roundup`
  - Codex automation `daily-spotlight-pagespeed-insights-performance` should act as a post-send watchdog, not as a second primary sender
- Governed Spotlight 11 property set:
  - `TX416`, `FL4TA`, `GA4BL`, `TX4CO`, `KY4TG`, `FL4GW`, `FL4HL`, `KY4MP`, `TX4FV`, `TX4GM`, `KY4SC`
- Property identity is resolved through `/Users/mark/Property_Analytics/config/property_identity_matrix.json`; do not add one-off Spotlight property maps for this report family.
- This extends the pilot roundup reporting family for the current Spotlight 11 daily performance lane. It does not touch canonical PIB files and does not create an alternate PIB renderer.

### 2026-05-12 - Portfolio Functionality QA Contract Seeded In EVS ✅
- The BrowserStack / EVS lane now has the first durable portfolio functionality QA contract for property sites that match the pilot template family.
- Source workbook:
  - `/Users/mark/Downloads/Revised QA_Portfolio.xlsx`
- New contract/import paths:
  - `/Users/mark/Property_Analytics/scripts/import_portfolio_qa_contract.py`
  - `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`
  - `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`
  - `/Users/mark/Property_Analytics/evs/orchestration/build-portfolio-qa-plan.mjs`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_FUNCTIONALITY_QA_SYSTEM_2026-05-12.md`
- EVS persistence now has an evaluation-set/result-storage shape for this lane:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0053_create_evs_batch_result_tables.sql`
  - `evs_evaluation_sets` seeds `portfolio_functionality_qa_v1`
  - `evs_batches`, `evs_batch_targets`, `evs_batch_runs`, `evs_findings`, and `evs_source_truth_snapshots` store future launch-batch URL lists, per-site/profile/device execution, source-truth artifacts, and row-level assertion findings
  - `/v1/evs/evaluation-sets`, `GET /v1/evs/batches`, `POST /v1/evs/batches`, and `/v1/evs/batches/:batchId` expose and create the durable records for future EVS display work
- The imported contract preserves all `43` workbook rows where `Element == Functionality` and keeps row-level lineage back to `Website QA Checklist`.
- Ownership split:
  - `32` EVS-owned checks for browser-observable routing, CTAs, availability comparison, map coordinate validation, unit-detail continuity, filters, sorting, and no-submit vendor handoffs
  - `5` media QA checks deferred to media/image ownership
  - `2` form QA checks deferred to form ownership
  - `4` lead-attribution checks deferred until governed synthetic-lead + AH/EAI proof workflow exists
- Initial executable batch is `pilot_production_functionality`, covering:
  - `https://championsgreen-ga.com/`
  - `https://thedistrictuniversal.com/`
  - `https://theharrisonsandysprings.com/`
  - `https://ventanaapts.com/`
  - `https://calaismidtownapartments.com/`
- Future launch batches should use the URL-list input path in the plan builder instead of creating new one-off BrowserStack scripts.
- This extends EVS/BrowserStack. It does not touch canonical PIB files or create a parallel QA renderer/report family.
- Same-day implementation follow-through:
  - `portfolio_functionality_regression` was added to the BrowserStack runner and shared EVS profile/schema/UI metadata
  - EVS-owned checks now split into `16` broad portfolio functionality checks and `16` `apartments_pricing_deep_journey` checks
  - BrowserStack production pilot run passed on `desktop_chrome` for all five pilot sites with no functional warnings/failures
  - BrowserStack production pilot run passed on `iphone_safari` for all five pilot sites with no functional warnings/failures
  - expected skips remain for specials-bar functionality when no specials toggle is present and for map-pin coordinate validation until lat/long config is added
  - iPhone runs still show the known BrowserStack screenshot artifact-capture warning, but functional QA classification is `pass`
  - `apartments_pricing_deep_journey` now maps the desktop EVS-owned deeper checks: filters, rendered availability structure, sort-order inspection, floor metadata/filter behavior, unit-detail continuity, SightMap unit locate config, Renting Made Simple content, unit-specific quote/apply/schedule handoffs, similar-homes surface detection, and review-date sort validation when source dates are exposed
  - BrowserStack production desktop deep pilot completed for all five pilot sites. Current findings: recurring list/grid sort-order warnings on the observed unit rows; Ventana additionally needs review for missing Other Similar Homes detection; source-backed availability warnings surface where rendered units do not match Pond; review sort remains skipped until valid machine-readable review dates are exposed
  - Champions Green desktop deep rerun is clean after filtering media-owned embedded model noise (`Model not found (404)`) out of EVS functional classification
  - `apartments_pricing_mobile_journey` is now the dedicated iPhone deep path for Apartments & Pricing. It reuses the governed workbook rows from the deep profile, but uses bounded mobile HTML snapshots and per-row checkpoints instead of fragile desktop-style locator interaction.
  - Final BrowserStack production Pilot mobile run generated `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-apartments_pricing_mobile_journey-production-iphone_safari.json` at `2026-05-12T22:08:02.698Z`; all `5` Pilot properties exited `0`, none timed out, and artifact capture produced no warnings. Contract-backed result: `57` pass, `18` warn, `5` skipped.
  - Current mobile findings: recurring list/grid sort-order warnings; row `qa_102` Apply Now opens property-level Pipeline application URLs without explicit unit context; review sort is skipped because only one valid machine-readable review datetime is exposed; Champions Green warns on `37` rendered vs `38` Pond units; The Harrison warns on `12` rendered vs `57` Pond units; Ventana does not expose Other Similar Homes in the bounded mobile unit-detail snapshot.
  - `header_navigation_integrity` is now a source-backed header/footer profile. It validates header logo/home, header/footer phone `tel:` links against ThirtyLines `officePhone`/`conciergePhone`, property-specific Apply Now against feed `pipelineURL`, Schedule Tour against feed `tourURL`, primary nav destinations, footer parity, and mobile menu parity.
  - Header/footer Pilot proof: desktop `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-header_navigation_integrity-production-desktop_chrome.json` at `2026-05-12T22:21:15.529Z` and iPhone `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-header_navigation_integrity-production-iphone_safari.json` at `2026-05-12T22:24:20.966Z`; all `5` Pilot properties exited `0` on both devices with no timeouts. Header phone/logo/apply/schedule/nav and footer phone/apply/nav passed everywhere. Template policy: footer home/brand link is not required and absent footer home links are reported as skipped/not applicable. Recurring skip: footer Schedule Tour is not required on this template because header/mobile menu owns that CTA.
  - `run-pilot-browserstack-smoke.mjs` now has `BROWSERSTACK_PROPERTY_TIMEOUT_MS`, and the deep runner has `BROWSERSTACK_CHECK_TIMEOUT_MS`, preventing a slow BrowserStack mobile session from blocking a launch batch indefinitely
  - `lead_attribution_e2e` is now wired as a separate dormant EVS test structure for feed-backed advertiser URL checks, phone-swap verification, recipient-email verification, and governed synthetic form drafts:
    - `/Users/mark/Property_Analytics/evs/config/lead-attribution-e2e.json`
    - `/Users/mark/Property_Analytics/scripts/export_evs_lead_attribution_truth.py`
    - source truth comes from ThirtyLines `trackingCodes[].trackingId`, `marketingSourceCd`, `phoneNumber`, and `email`
    - generated advertiser URLs default to `?id=<trackingId>` and can be adjusted with `EVS_ATTRIBUTION_QUERY_PARAM`
    - default behavior is no-submit; actual form submit requires `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`, `EVS_SYNTHETIC_EMAIL_DOMAIN`, and `EVS_SYNTHETIC_RUN_LABEL`
    - synthetic identity now follows the team convention: first name `Venterra`, last/full name token `<Property><CTA>-<Source>` such as `ApexForm-Aptlist`, and email `<property><cta>-<source>@venterradev.com` such as `apexform-aptlist@venterradev.com`
    - local Calais proof selected `TX4MIALIST` / `APL` and passed advertiser URL load, tracking ID observability, phone swap, recipient-email observability, and synthetic form draft against `https://calaismidtownapartments.com/?id=TX4MIALIST`
    - the first governed submit attempt at `2026-05-13T15:24Z` was corrected to `blocked_browser_validation_not_submitted` after screenshot review showed the required `Number of Beds` field was missing
    - the corrected governed submit at `2026-05-13T15:29Z` filled `Number of Beds` and max rent, captured the acknowledgement text (`Your request has been submitted...`), and wrote the audit row `/Users/mark/Property_Analytics/evs/reports/calais-TX4MIALIST-corrected-submitted-audit-row-20260513T102927.csv`
    - operator then changed the synthetic sender domain from `yopmail.com` to `venterradev.com`; the runner default, lead-attribution config, and QA docs now use `<property><cta>-<source>@venterradev.com`
    - next-source Calais submit used `TX4MIAR` / `APR` with `calaismidtownform-aptratings@venterradev.com`, routed to `venterra_calaismidtown_apartmentratings_vl@leads.anyonehome.com`, captured on-page acknowledgement, and wrote `/Users/mark/Property_Analytics/evs/reports/calais-TX4MIAR-submitted-audit-row-20260513T104216.csv`
    - combined Calais submission ledger for downstream Anyone Home confirmation: `/Users/mark/Property_Analytics/evs/reports/lead-attribution-calais-submission-ledger-20260513T104216.csv`
    - the BrowserStack runner now fills property-specific required contact fields and only treats a synthetic submit as clean when browser validation is absent or an on-page acknowledgement is detected
    - migration `0053` seeds this as draft evaluation set `lead_attribution_e2e_v1`, separate from `portfolio_functionality_qa_v1`
  - Pond availability is now wired into the deep profile through `/Users/mark/Property_Analytics/scripts/export_evs_pond_availability.py`, which resolves Pilot identities through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and exports latest `unit_availability_units` rows from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
  - The BrowserStack pilot orchestrator auto-generates this export for `apartments_pricing_deep_journey` and `apartments_pricing_mobile_journey` unless `POND_AVAILABILITY_UNITS_JSON_PATH` is provided or `EVS_DISABLE_POND_AVAILABILITY_EXPORT=1`
  - Source-backed availability proof: strict BrowserStack desktop full Pilot rerun generated `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-apartments_pricing_deep_journey-production-desktop_chrome.json` at `2026-05-12T21:23:17.312Z`; District, Ventana, and Calais match Pond availability exactly; Champions warns with `37` rendered units vs `38` Pond units; The Harrison warns with `11` rendered units vs `57` Pond/structured units

### 2026-05-11 - Delta Pearland APO Case Study Post-Rule Checkpoint ✅
- The Delta Pearland / `thedeltapearland.com` is now configured as the active APO optimization case study domain in:
  - `/Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml`
  - `/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml`
  - `/Users/mark/Property_Analytics/ops/cloudflare/generate_delta_apo_case_study.py`
- Cloudflare token visibility is materially improved for the Delta zone: zone/settings/ruleset reads, cache purge, and cache-rules writes are available; older firewall endpoints still return limited visibility.
- APO is enabled and the WordPress plugin connection is visible in Cloudflare settings (`cf=true`, `wordpress=true`, `wp_plugin=true`) for `thedeltapearland.com` and `www.thedeltapearland.com`.
- Applied the controlled Phase 1 homepage-only cache ruleset:
  - ruleset id `9334c6925c4b464e9a21f85f000317f5`
  - apply artifact `/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache/20260511T191015Z/thedeltapearland.com.applied.json`
  - rules bypass admin/API/auth/session traffic and cache anonymous homepage HTML with edge TTL override `7200`
- Post-apply purge and retest did not produce edge HTML HIT behavior:
  - latest cache audit reports warm HIT coverage `0.00%`
  - homepage and `/floor-plans/` still return `cf-cache-status: DYNAMIC`
  - responses continue to show `vary: Accept-Encoding,Cookie`, WP Engine `x-cacheable: SHORT`, and Cloudflare/WP cookies on HTML
- Working conclusion: this is no longer a basic APO enablement or ruleset-permission problem. The next optimization lane is origin/cacheability behavior, especially `Vary: Cookie`, anonymous cookie emission, WP Engine cache headers, and whether security/performance features like Browser Integrity / bot cookies are affecting edge HTML cache eligibility.
- Current case-study artifacts:
  - `/Users/mark/Property_Analytics/reports/cloudflare_apo_case_study/delta_pearland/2026-05-11/delta_apo_case_study_baseline_2026-05-11.md`
  - `/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-05-11/cloudflare_cache_audit_2026-05-11.md`

### 2026-05-11 - Delta Cache Blocker Isolation Tests
- Ran controlled Cloudflare-side cache blocker tests for The Delta Pearland after APO and the Phase 1 homepage cache rule were live.
- Negative tests:
  - `browser_check` off did not produce edge HIT; setting was restored to `on`
  - a temporary `http_response_cache_settings` rule with `strip_set_cookie: true` did not remove the observed `__cf_bm` cookie from delivered homepage responses and did not produce edge HIT; the response ruleset was deleted
  - temporarily adding `origin_cache_control: false` to the homepage cache rule did not produce edge HIT; the request cache ruleset was restored to the original Phase 1 payload
  - legacy Page Rule `cache_everything` / `edge_cache_ttl` / `explicit_cache_control=off` could not be tested because the Page Rules endpoint rejects the current account-owned token with code `1011`
  - Cloudflare Trace could not be used because the account request-tracer endpoint returned authentication error `10000`
- Final live state after cleanup:
  - `browser_check=on`
  - no `http_response_cache_settings` entrypoint exists
  - request cache ruleset `9334c6925c4b464e9a21f85f000317f5` remains the two-rule Phase 1 homepage cache ruleset
  - homepage still returns `cf-cache-status: DYNAMIC`
- Experiment log:
  - `/Users/mark/Property_Analytics/reports/cloudflare_apo_case_study/delta_pearland/2026-05-11/delta_cache_experiment_log_2026-05-11.md`
- Working conclusion: the next useful investigation is upstream/WP Engine or a Cloudflare security/bot feature not exposed through the current token, because `__cf_bm`, `Vary: Cookie`, and `x-cacheable: SHORT` persist through the tested Cloudflare cache controls.

### 2026-05-11 - Delta WP Engine Edge Full Page Cache Breakthrough ✅
- WP Engine portal showed `Edge Full Page Cache (primary domain only)` was `Off` for the Delta production environment.
- Confirmed the Cloudflare DNS origin targets `141.193.213.10` / `141.193.213.11` are WP Engine-owned (`WPENG`) and still return `server: cloudflare`, meaning the Venterra Cloudflare zone is fronting WP Engine's own Cloudflare-backed edge layer.
- Enabled WP Engine Edge Full Page Cache from the WP Engine portal and cleared all WP Engine caches.
- Purged Cloudflare cache for:
  - `https://thedeltapearland.com/`
  - `https://www.thedeltapearland.com/`
  - `https://thedeltapearland.com/floor-plans/`
- Post-enable probe:
  - root moved `MISS -> HIT`
  - `/floor-plans/` moved `MISS -> HIT`
  - `www` root stayed `HIT`
- Formal cache audit after the change:
  - synthetic status `pass`
  - warm HIT coverage `100.00%`
  - homepage warm desktop TTFB `60.2 ms`
  - homepage warm mobile TTFB `46.0 ms`
- The audit's top-level domain status still reads `fail` only because Cloudflare GraphQL analytics access returns a path/access error; live synthetic cache behavior is now passing.
- Current evidence:
  - `/Users/mark/Property_Analytics/outputs/cloudflare_apo_case_study/delta_pearland/20260511T_wpengine_efpc_post_enable_probe.json`
  - `/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-05-11/cloudflare_cache_audit_2026-05-11.md`
  - `/Users/mark/Property_Analytics/reports/cloudflare_apo_case_study/delta_pearland/2026-05-11/delta_cache_experiment_log_2026-05-11.md`
- Remaining caveats to preserve for the case study:
  - `__cf_bm`, `Vary: Cookie`, and WP Engine `x-cacheable: SHORT` still appear on responses, but no longer prevent warm Cloudflare HIT in the current configuration
  - Cloudflare Trace beta still fails with `hostname does not belong to your account` despite valid zone/DNS/proxy evidence
  - Live PSI remains noisy and should be rerun after caches stabilize for at least one normal traffic window
- Stabilized recheck later on 2026-05-11:
  - direct root probes returned `HIT` on all 10 requests with `Age` increasing from `289` to `295`
  - direct `/floor-plans/` probes returned `HIT` on all 10 requests with `Age` increasing from `257` to `262`
  - formal cache audit kept synthetic status `pass`, warm HIT coverage `100.00%`, desktop homepage warm TTFB `38.77 ms`, and mobile homepage warm TTFB `52.23 ms`
  - fresh PSI showed desktop score `61` with TTFB `10 ms`, LCP `2.86s`, TBT `328.4 ms`; mobile score `35` with TTFB `12 ms`, LCP `13.36s`, TBT `1005.5 ms`
  - interpretation: edge/server delivery gain is confirmed, desktop Lighthouse moved materially, and mobile remains mostly a render/LCP/third-party problem rather than a server-response problem

### Pilot Morning 2026-05-10 Roundup Failure / False Bootstrap Alert Fix ✅
- On 2026-05-10, the pilot morning data collection substantially completed, but the daily CWV email did not send.
- Actual root cause:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
  - the `Main Pilot Reference` GTMetrix display path called an undefined helper `trend_color(...)`
  - the same line also exposed an f-string rendering issue once patched
- Corrected live behavior:
  - `trend_color(...)` was replaced with the existing delta/value helpers:
    - `delta_color(...)`
    - `fmt_delta(...)`
  - the GT delta HTML is now prebuilt before the card f-string so the renderer does not trip on nested escaping
- Alerting issue fixed at the same time:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - the global `ERR` trap now suppresses the false fallback `Bootstrap / Shell` alert when a stage-specific pilot failure has already written the on-disk failure marker
  - this matters because the piped workflow body runs in a subshell, so in-memory shell variables alone were not a sufficient duplicate-alert guard
- Recovery outcome:
  - `Pilot Performance Roundup - 05-10-2026` was regenerated and sent successfully
  - `RESOLVED: Pilot Morning Workflow Recovered - 2026-05-10` was sent to Mark only

### Pilot Morning 2026-05-11 Send Suppression Root Cause ✅
- On 2026-05-11, the pilot morning workflow completed successfully and generated fresh GTMetrix, PSI, homepage evidence, exports, and the roundup artifact, but the email still did not send.
- Root cause:
  - the live LaunchAgents were still explicitly pinning `PILOT_SUMMARY_EMAILS_ENABLED=0`
  - affected files:
    - `/Users/mark/Library/LaunchAgents/com.venterra.pilot.morning.daily.plist`
    - `/Users/mark/Library/LaunchAgents/com.venterra.pilot.roundup.daily.plist`
  - this overrode the wrapper defaults in:
    - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
    - `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
- Corrected live posture:
  - both LaunchAgents now pin `PILOT_SUMMARY_EMAILS_ENABLED=1`
  - launchd must be reloaded after plist edits so the corrected environment takes effect
- Impact:
  - the May 11 missed roundup was recoverable without recollecting data because the full artifact already existed on disk

### Executive-Approved Output Lock ✅
- When Mark says a report, email, document, deck, spreadsheet, JSON contract, or other executive-facing artifact has been approved, the artifact format is locked for that workstream.
- Agents must reuse the exact approved template, structure, section order, labels, terminology, audience boundary, delivery channel, and attachment/link strategy unless Mark explicitly asks to change one of those elements.
- Requested corrections after approval are data/source/content alignment tasks first. They are not permission to redesign, simplify, rename, reframe, or substitute a different report family.
- Companion Community Manager / Site Manager deliverables must stay in their approved companion format. Do not replace them with a different reduced report just because it seems adjacent or cleaner.
- Before sending anything after an executive format has been approved, reconcile against the approved artifact and stop if the output differs materially.
- Creativity remains welcome only after the approved deliverable contract is satisfied and only inside the lane Mark requested.

### 2026-05-08 Spotlight / Watchlist Data Authority Incident
- A Forest View data mismatch exposed that the VP-approved Spotlight companion brief and the Watchlist/Captain report path were using different source paths.
- VP-approved Spotlight companion data authority for the current correction pass:
  - T30 funnel: `/Users/mark/Downloads/Funnel Metrics .xlsx`
  - T90 funnel: `/Users/mark/Downloads/Funnel T90.xlsx`
  - Forest View source performance: `/Users/mark/Downloads/Source Perfromance.xlsx`
  - Forest View availability/unit mix: `/Users/mark/Downloads/Availability.xlsx`
  - service delivery: `/Users/mark/Downloads/T90 Service Delivery (1).xlsx`
  - abandoned apps: process context only unless property attribution exists
- Do not use `/Users/mark/Downloads/T30 Funnel Metrics By Prop.xlsx` for approved Spotlight companion reporting unless BI confirms it is exported as a full-funnel, unfiltered T30 property file. The observed file was filtered to Website / Dependent Event Volume and produced wrong Forest View values.
- Current recovery instruction: preserve the exact approved companion report format that was sent today; correct data alignment only.

### Pilot Twin Mapping Update ✅
- The Calais Midtown twin mapping was updated on 2026-05-08:
  - removed `The Delta Pearland`
  - replaced with `Coles Crossing`
- Canonical source updated:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/config/pilot_control_cwv_config.json`
- Because the pilot roundup and CSV exports now read the twin cohort from the shared pilot config, the change automatically propagates to:
  - pilot roundup HTML/MD
  - `PSI_Day_Over_Day_Scores_latest.csv`
  - `GTMetrix_Daily_Scores_latest.csv`
- Current observed state after regeneration:
  - PSI row for `Coles Crossing` is present
  - GT row for `Coles Crossing` is present but blank, because there is not yet a same-day canonical GTMetrix row for that property in `gtmetrix_metrics`

### Pilot CWV Daily Email Default Restored ✅
- On 2026-05-09, the pilot morning workflow completed successfully but the final roundup email was suppressed by policy.
- Root cause:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
  - had drifted to `PILOT_SUMMARY_EMAILS_ENABLED=${PILOT_SUMMARY_EMAILS_ENABLED:-0}`
- Corrected live default:
  - both wrappers now default to `1`
  - specialty/pilot summary mail remains suppressible only when explicitly overridden in the environment
- Impact:
  - daily Pilot Performance Roundup routine send should resume automatically on future scheduled runs

### Main Pilot Reference Is Now Tracked For GTMetrix ✅
- The bottom `Main Pilot Reference` row is no longer a PSI-only special case for GT.
- Canonical change:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/config/pilot_control_cwv_config.json`
    - `main_pilot_reference.property_id = "main_pilot_reference"`
- Daily GT collection now treats the main reference as part of the tracked non-pilot GT cohort:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_twin_gtmetrix.py`
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/validate_pilot_twin_gtmetrix.py`
- GT export now reads historical GT data for the main reference row instead of leaving it blank:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/export_gtmetrix_daily_scores.py`
- Roundup bottom reference card now shows GTMetrix alongside PSI when a stored GT row exists:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- First live stored main-reference GT row:
  - metric date `2026-05-09`
  - `Today GTMetrix = 99.0`

### Pilot KPI Measurement Workbook Version Resolution ✅
- The Pilot KPI / tracker Measurement ingestion no longer hardcodes `Measurement_Dashboard_1.1.xlsx`.
- Canonical parser:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/measurement_dashboard_parser.py`
- Current behavior:
  - discovers `Measurement_Dashboard*.xlsx` files in the shared `Guest_Card_Reports` drop
  - selects the highest version / newest workbook unless `MEASUREMENT_DASHBOARD_PATH` explicitly overrides it
  - stores one active Measurement workbook family in `measurement_daily_raw_values` / `measurement_daily_metrics` so older workbook versions do not duplicate rows
  - corrects an obvious adjacent-year tab typo in context, e.g. `5.6.25` in the 2026 daily run sequence is ingested as `2026-05-06`
- Current live proof after regeneration:
  - source file: `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Measurement_Dashboard_1.3.xlsx`
  - latest Measurement date: `2026-05-07`
  - tracker JSON source metadata now points at `Measurement_Dashboard_1.3.xlsx`

### SEMRush Sunset / DataForSEO Successor ✅
- SEMRush is now in governed sunset mode across the daily ops layer.
- Canonical policy path:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- Operational effect:
  - Morning collection no longer treats SEMRush as an active lane when `SEMRUSH_DEPRECATED` is left at its default enabled posture.
  - Alerting no longer raises freshness or collection-failure pressure for SEMRush.
  - Watchtower / health now uses `dataforseo` as the active weekly automated search-intelligence advisory source instead of SEMRush.
- Replacement evidence source:
  - `/Users/mark/Property_Analytics/data/portfolio_analytics.db:dataforseo_serp_runs`
  - latest live DataForSEO run date at cutover check: `2026-05-06`
- Important boundary:
  - historical SEMRush tables and specialty/search-intelligence code paths remain in place for compatibility and historical reference.
  - this is a graceful ops deprecation, not a destructive schema purge.

### Advisory / Manual Control-Plane Cleanup ✅
- The daily closure model now distinguishes a general advisory tail from a pure manual-dependency tail.
- Shared closure output can now emit:
  - `summary_reason=core_closed_with_manual_dependency_open`
  - instead of the more generic `core_closed_with_advisory_open`
- Current live example on `2026-05-07`:
  - core sources are closed
  - Morning Full is sendable
  - only `property_operating_metrics` remains open as a manual dependency
- Targeted/manual specialty lanes with no scheduled run now surface as idle/on-demand instead of false missing pressure:
  - `browserstack`
  - `evs`
  - `sightmap`
- Duplicate BI advisory aliases were removed from the closure/watchtower view so `bi_report` is the canonical manual BI lane instead of showing parallel `bi_manual` / `bi_metrics` noise.
- Manual dependency retry rows now use `status=manual_wait` instead of looking like ordinary automated retry debt when no source file exists yet.
- Live proof:
  - `collection_retry_queue.queue_id=2205` for `property_operating_metrics` on `2026-05-07` now sits in `manual_wait`, which is the correct posture because no fresh AR4PB file is present to ingest.

### Cloudflare Cache Audit Semantics ✅
- The Cloudflare cache audit still records real advisory findings, but it no longer overloads `error_message` on successful runs.
- Canonical behavior now:
  - `status=completed`
  - `error_message` only when the collector actually fails
  - advisory cache issues summarized in `notes`
- Fresh live proof:
  - `/Users/mark/Property_Analytics/data/portfolio_analytics.db` row `collection_id=1051` for `cloudflare_cache_audit` on `2026-05-07`
  - notes now read `Cloudflare cache audit completed with 5 advisory finding(s)...`

### Delta Pearland APO Case Study Prep ✅
- The Delta Pearland is now included in the governed Cloudflare cache audit and full-page cache rollout manifests:
  - `/Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml`
  - `/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml`
- Identity discipline:
  - governed property code `TX4DP`
  - current Cloudflare/Data Collection key `441503068`
  - domain `thedeltapearland.com`
- New repeatable case-study generator:
  - `/Users/mark/Property_Analytics/ops/cloudflare/generate_delta_apo_case_study.py`
- Baseline artifact:
  - `/Users/mark/Property_Analytics/reports/cloudflare_apo_case_study/delta_pearland/2026-05-11/delta_apo_case_study_baseline_2026-05-11.md`
- Initial findings:
  - Cloudflare is active, but homepage and floor-plan HTML remain `CF-Cache-Status: DYNAMIC`
  - warm HIT coverage is `0.0%`
  - live PSI baseline on 2026-05-11 was mobile `29`, desktop `42`
  - current read token resolves the zone but lacks analytics/settings/ruleset permissions needed for full Cloudflare governance
- APO enablement should isolate caching first. Do not combine first enablement with edge HTML rewrites or experimentation changes.

## 🎯 READ THIS FIRST

**If you're starting a new session:**
1. Read this entire file (5 min)
2. Read `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
3. Read `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
4. Check "Current System State" for what's broken/working
5. Review "Session Log" for recent changes
6. Update this file after EVERY significant action

**Before every build, report, email send, or new script:**
1. Check the capability register for an existing canonical owner/path.
2. Extend or orchestrate the existing capability unless the user explicitly approves a new path.
3. For PIB-family, Captain, Watchlist, Spotlight, and specialty brief emails, use the existing report-family shell/sender path documented for that report family; do not create one-off send wrappers or bypass the canonical delivery path for convenience.
4. If the right path is unclear, stop and identify the nearest existing capability before building.

**Critical Paths:**
- Master DB: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Property Registry: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- New Collection System: `/Users/mark/Property_Analytics/Data_Collection/`
- Legacy (Broken): `/Users/mark/Property_Analytics/Portfolio_Monitoring/collect_daily_data.py`
- Pilot evidence session memory: `/Users/mark/Property_Analytics/SESSION_MEMORY_2026-04-08_PILOT_SITE_EVIDENCE_AND_HARMONIZATION.md`
- Capability register: `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- Full system audit: `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

### Captain Active Routine Governance ✅
- Captain work is now governed as an active operating system rather than a report-only lane.
- New standard:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_ACTIVE_ROUTINES_AND_SOURCE_VALIDATION_STANDARD_2026-05-09.md`
- New routine manifest:
  - `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json`
- New local Data Pond audit:
  - `/Users/mark/Property_Analytics/scripts/audit_captain_active_routines.py`
- Purpose:
  - define the required Captain routines for source readiness, property memory, funnel watch, inventory/product watch, channel efficiency, website/content/SEO, competitor watch, reputation/friction, experience validation, and action/proof tracking
  - check whether each Captain has the current source lanes required to watch, research, validate, and brief the property
  - keep local Data Pond source readiness separate from remote D1 runtime readiness, which remains covered by `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`
- Current proof outputs:
  - `/Users/mark/Property_Analytics/reports/captains_log/routines/forest_view_active_routine_audit_2026-05-09.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/routines/captain_active_routine_audit_2026-05-09.json`
- Boundary:
  - this is an orchestration/readiness layer feeding existing Captain / Watchlist / Spotlight / PIB-family outputs
  - it does not create a new report family and does not permit mutating approved executive formats

### Fleet Scribe + Expert Bench Governance ✅
- Official report creation is now modeled as a Fleet Scribe Office, not as a property Captain acting alone.
- New standard:
  - `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_AND_EXPERT_BENCH_STANDARD_2026-05-09.md`
- New expert-bench manifest:
  - `/Users/mark/Property_Analytics/config/fleet_scribe_expert_bench_manifest.json`
- New audit:
  - `/Users/mark/Property_Analytics/scripts/audit_fleet_scribe_expert_bench.py`
- Captain hierarchy update:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md` now includes Fleet Scribe artifact ownership and added expert consulting roles.
- Publication chain:
  - Captain Read -> Commodore Review -> Fleet Review -> Expert Bench Consultation -> Fleet Scribe Official Publication
- Expert lanes / single adjustment points now include Quartermaster, Leasing Performance Advisor, Revenue Advisor, Signals Officer, Navigator, Market Scout, Product Readiness Officer, Reputation Officer, Resident Experience Officer, Engineer, Seasonality/Demand Timing Advisor, Unit-Type Fit Advisor, Market Elasticity Advisor, Operational Capacity Advisor, Trust and Proof Advisor, and Peer Borrowing Advisor.
- Current proof outputs:
  - `/Users/mark/Property_Analytics/reports/fleet_scribe/expert_bench/forest_view_expert_bench_audit_2026-05-09.json`
  - `/Users/mark/Property_Analytics/reports/fleet_scribe/expert_bench/fleet_scribe_expert_bench_audit_2026-05-09.json`
- Boundary:
  - the Fleet Scribe preserves approved report templates and delivery discipline
  - expert consultation tunes narrow decision algorithms and does not create competing reports
- Structure/directive reference:
  - `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md`
  - details the Captain, Commodore, Fleet, Consulting Bench, and Fleet Scribe offices plus current directive settings for each expert lane.

### GBP KSM Standardization ✅
- The canonical GBP credential path is now standardized through `/Users/mark/Property_Analytics/utils/config_manager.py` instead of hardcoded local `Portfolio_Monitoring/credentials` reads.
- New governed config getters:
  - `/Users/mark/Property_Analytics/utils/config_manager.py:get_gbp_credentials_path()`
  - `/Users/mark/Property_Analytics/utils/config_manager.py:get_gbp_token_path()`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` now uses those getters for both GBP reviews and GBP insights so the two lanes cannot drift onto different auth artifacts.
- `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` test mode now also resolves through the canonical GBP config getters.
- Important current state on 2026-05-06:
  - `KSM_PROFILE=marketingops` is set
  - `KSM_GBP_CLIENT_SECRET_UID` is not set
  - `KSM_GBP_TOKEN_UID` is not set
  - so the live machine still falls back to the legacy local GBP files
- Root GBP failure remains the legacy token artifact itself: `gbp_token.pickle` contains serialized references to `google.auth._regional_access_boundary_utils.*`, but the current scheduled Python environment (`google-auth 2.38.0`) does not expose that internal module. Standardizing the Keeper path removes local-file drift; the next true recovery step is to regenerate the GBP token in the same governed runtime and store that artifact in Keeper.
- 2026-05-07 live repair:
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` now uses one governed auth loader for both reviews and insights, prefers stable authorized-user JSON token storage, and includes a one-time compatibility shim so legacy GBP pickles can be deserialized, refreshed, and migrated forward instead of blocking the morning run.
  - `/Users/mark/Property_Analytics/utils/config_manager.py:get_gbp_token_path()` now prefers `Portfolio_Monitoring/credentials/gbp_token.json` when present, falling back to the old pickle only for migration/bootstrap.
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` insights collection now reuses `self.gbp_collector.creds` instead of opening the token file separately with raw `pickle.load(...)`, removing the auth split that caused reviews and insights to drift.
  - Live proof on 2026-05-07:
    - the legacy pickle successfully refreshed into `/Users/mark/Property_Analytics/Portfolio_Monitoring/credentials/gbp_token.json`
    - GBP reviews API calls succeeded against live matched properties
    - GBP Business Profile Performance API calls succeeded with the same shared credentials
  - Remaining governance gap:
    - `KSM_GBP_CLIENT_SECRET_UID` and `KSM_GBP_TOKEN_UID` are still unset, so the machine is operational again but not yet fully KSM-only for GBP. The next credential-hardening step is to store the client secret and the new JSON token in Keeper and populate those UIDs.

### PQ Terminology Standardization ✅
- User-facing Captain / diagnostic reporting language now uses `PQ` (`Price Quote`) instead of `RFP`.
- Important boundary:
  - the underlying Marketing BI storage fields remain `rfp_t7`, `rfp_t30`, etc. for compatibility with existing ingests and queries
  - only the display/read-model wording changed
- Updated user-facing/reporting paths:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`
  - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py`
  - related Captain display/docs

### Marketing Source Display Alias Governance ✅
- User-facing Captain/watchlist reporting now treats certain BI source labels as governed display aliases rather than raw workbook taxonomy.
- Current active display aliases:
  - `ADC` / `Apartments.com` -> `Apartments.com / ADC`
  - `Drive By` -> `Walk-In / Drive-By`
- Important boundary:
  - underlying stored source values in BI-ingested tables are unchanged
  - this is a reporting/readability standard, not a source-truth rewrite or historical source merge
- Updated active reporting paths:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py`

### Multifamily SEO + Local Content Action Standard ✅
- VP-supplied SEO/GEO/AEO/AIO guidance from `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Resources/MULTIFAMILY SEO.docx` is now memorialized as `/Users/mark/Property_Analytics/docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md`.
- Policy:
  - this is an additive Data Pond / Site Content Creator / Captain reporting lane, not a parallel SEO report system
  - every website, GBP, social, FAQ, metadata, or shadow-page recommendation must tie to the property's actual leasing condition and current page evidence
  - do not invent local facts, employers, distances, specials, competitor claims, or rankings
  - audit property data and page evidence separately, then synthesize exact copy/content actions
- Watchlist Decision Output v1.1 now includes a compact `SEO + Local Content Action Pack` after the Competitive Market Read and before Recommendation Packages, using DataForSEO on-page snapshots, inventory pressure, subject rent/special posture, and competitor evidence.
- The site-manager Word attachment now includes a plain-English website copy and local content checklist derived from the same governed evidence.

### Channel Economics By Source ✅
- Captain/read-model marketing economics now expose per-channel `cost per lease` and derived `cost per move-in` where the BI source lanes support it.
- Calculation standard:
  - use `marketing_bi_cost_per_conversion_rows` as the official lease/application/guest-card cost lane
  - use `marketing_bi_source_performance_rows` for per-source lease and move-in counts
  - derive `cost per move-in` only where channel economics and move-in counts are both present
- Canonical implementation paths:
  - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py`
  - `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py`

### Unit-Type Spend / Targeting Support Section ✅
- The reusable local Captain Brief now carries a PIB-style secondary `Unit-Type Spend / Targeting` section below the primary marketing channel content.
- Purpose:
  - show how much paid search spend is explicitly classified to unit-type intent versus generic capture
  - preserve the Captain Brief as the executive read while adding deeper ad-structure evidence underneath
- Current governed implementation path:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`
- Source policy:
  - prefer `ad_keyword_performance` when present locally
  - fall back to remote D1 `ad_keyword_performance` through the Keeper-backed Wrangler helper
  - if the local mirror is behind or remote D1 is temporarily unavailable, use the latest generated marketing mirror SQL batch as a controlled fallback for report generation
- Important boundary:
  - no locked PIB renderers/templates were changed
  - this reuses the PIB data lane concept in the Captain report family without creating a parallel PIB system
- 2026-05-06 app parity pass:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now exposes the same unit-type targeting block in `sourceSpendRead.unitTypeTargeting`
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` now renders the same section in the Captain app
  - the Captain app and the generated Captain Brief now share the same evidence lane instead of diverging on paid-search unit-type targeting

### Captain Reconciliation Plan ✅
- The current reconciliation truth is now documented in `/Users/mark/Property_Analytics/docs/CAPTAIN_RECONCILIATION_PLAN_2026-05-06.md`.
- Key conclusion:
  - the Elation `Unit-Type Spend / Targeting` enhancement is valid
  - the real blocker is branch lineage because current `main` does not yet contain the Captain runtime/app foundation
- Governed promotion order:
  1. `PR 1: Captain foundation to main`
  2. `PR 2: Captain marketing enrichment to main`
- Required foundation files include:
  - Captain API/runtime: route, runtime, index wiring, and migrations `0026` / `0027`
  - Captain web/client: `apps/web/src/lib/api.ts`, `apps/web/src/app/analysis/captain/page.tsx`, and the discoverability hooks in analysis/sidebar
- Required enrichment files include:
  - `reports/captains_log/generate_captains_brief_vnext.py`
  - follow-up patching of Captain runtime/page for `unitTypeTargeting`
  - docs/memory updates

### D1 Mirror Core vs Advisory Classification ✅
- The D1 mirror contract now distinguishes `core_success` from overall advisory degradation.
- Canonical implementation paths:
  - `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
  - `/Users/mark/Property_Analytics/generate_morning_full_report.py`
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- Policy:
  - `guest_cards_to_d1.py`, `pib_data_to_d1.py`, and `marketing_data_to_d1.py` are core mirror sync steps
  - `captain_sources_to_d1.py` is advisory for the global D1 mirror health signal
  - Morning Full and central alerts should only raise `D1 mirror verification failed` when `core_success` is false
  - if Captain-source sync fails but core mirror work succeeds, the mirror should surface as degraded/watch rather than full alert
- 2026-05-07 live validation note:
  - repeated mirror reports were failing at `captain_sources_to_d1.py` with Wrangler `fetch failed`
  - subprocess handling is now hardened in both `d1_mirror_sync.py` and `captain_sources_to_d1.py` so Wrangler runs are placed in their own process groups and are cleaned up on timeout instead of lingering
  - `captain_sources_to_d1.py` now recreates `available_unit_interest_metrics` before insert, eliminating the remote schema-drift failure on the missing `bedrooms` column
  - the deeper root cause was an oversized Captain advisory payload: the mirror was pushing broad global BI tables the live Captain runtime did not actually query, inflating the source packet to ~391 MB / 235,680 insert statements
  - the Captain D1 contract is now narrowed to the actual runtime read set, dropping the payload to 2,021 insert statements in one small batch and adding the previously-needed `marketing_bi_source_performance_rows` lane
  - a fresh full mirror run succeeded at `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260507_121437.json` with `success=true`, `core_success=true`, and `mirror_status=success`
  - Morning Full regenerated cleanly and now shows `Overall Status: HEALTHY | All critical systems are fresh and passing checks`

---

## 📊 CURRENT SYSTEM STATE

### Property Diagnostic JSON Data Layer ✅
- Added the first retrieval-first property diagnostic JSON read model for the VP data-layer ask:
  - `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py`
  - first generated artifact: `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json`
- The first property is Elation at Grandway West / `TX4EG`, resolved through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and the governed identity matrix.
- The JSON is one property object with clean numeric fields, current-month / T30 / T90 windows where source data supports them, portfolio comparisons where available, market comparisons where the competitor ledger supports them, derived issue flags, source references, and explicit `missing_data` entries.
- Included source lanes: Marketing BI Traffic Conversions, Marketing Ops Summary, GA4 daily/channel metrics, unit availability feed, ad-spend/cost workbooks, competitor market research, Reputation.com, GBP review sentiment, and DataForSEO on-page snapshots.
- Boundaries: this is a Data Collection / Data Pond read model for downstream agents. It does not mutate locked canonical PIB generation/rendering/sending files and does not create a parallel PIB renderer.
- 2026-05-06 source-mix expansion: Marketing BI source/origin performance and T365 move-in source routes were added through `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` and migrations `0045` / `032`. The Elation JSON now includes source/origin performance from `perf-region.xlsx` and actual move-ins by marketing/conversion source from `t365.xlsx`; resident names from T365 are intentionally not stored.
- 2026-05-06 source-spend closure: `/Users/mark/Downloads/Month by Month Adv spend per property.xlsx` is now ingested as `marketing_bi_monthly_ad_spend_source_rows`, adding month/source spend, total, budget, and actual-vs-budget for each property. Elation now carries `20` source-spend rows across January-May 2026, including May ADC `$2,000`, Google Ads `$1,707.44`, Forthea Fees `$273.1904`, Zillow `$0`, monthly total `$3,980.6304`, and budget `$3,000`.
- 2026-05-06 gap-fill expansion: added Portfolio Box Score, T90 Service Delivery, and Abandoned application detail tables through migration `0046` / infra `033`. Elation now carries Portfolio Box Score make-ready percentage (`85.714286`), ready-available count (`42`), and T90 service delivery posture (`1` no-response, `1` unresolved 48h+, first response `14`, total resolution `96`). Abandoned exports have no property column, so they are stored without property attribution and do not yet satisfy the Elation property-level abandoned-app requirement.

### Pilot Roundup Email Consolidation ✅
- The default pilot CWV summary delivery is now a single consolidated routine email:
  - subject: `Pilot Performance Roundup - MM-DD-YYYY`
  - HTML body: pilot roundup
  - attachments:
    - `PSI_Day_Over_Day_Scores_latest.csv`
    - `GTMetrix_Daily_Scores_latest.csv`
- The roundup mailer no longer attaches the markdown artifact.
- The daily pilot morning workflow no longer sends the separate `Pilot Data Exports` routine email; the CSVs are attached to the roundup instead.
- The attached CSVs now mirror the roundup cohort structure with explicit `Group` labels for:
  - `pilot`
  - `sister`
  - `twin`
  - `main_pilot_reference`
- PSI CSV now includes pilots, sisters, twins, and the bottom main pilot reference row.
- GT CSV now includes pilots, sisters, twins, and the bottom main pilot reference row; twin GT cells may remain blank where no canonical GTMetrix history exists for that twin property.
- As of 2026-05-04, the daily pilot morning workflow now includes a dedicated same-day twin GTMetrix collection/validation loop before exports, so the twin GT rows in the consolidated roundup attachments should populate automatically on future runs instead of requiring manual backfill.
- Canonical paths:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_pilot_roundup_email.py`
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - `/Users/mark/Property_Analytics/pilot_roundup/README.md`

### Single Daily Summary Policy ✅
- The canonical routine daily email is now the Morning Full Portfolio Report only:
  - `/Users/mark/Property_Analytics/run_daily_health_report.sh`
  - `/Users/mark/Property_Analytics/send_morning_full_report.py`
- Specialty/pilot routine summaries are now opt-in instead of opt-out:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
  - `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
  - `/Users/mark/Property_Analytics/utils/specialty_email_policy.py`
- Live launch agents now explicitly pin `PILOT_SUMMARY_EMAILS_ENABLED=0` for:
  - `/Users/mark/Library/LaunchAgents/com.venterra.pilot.morning.daily.plist`
  - `/Users/mark/Library/LaunchAgents/com.venterra.pilot.roundup.daily.plist`
- Operational intent:
  - one routine daily email unless there is a true failure/recovery condition
  - specialty artifacts still generate on disk
  - specialty or pilot summary mail can be re-enabled intentionally with `PILOT_SUMMARY_EMAILS_ENABLED=1`

### POP Brief Diagnostic Recommendation Standard ✅
- Added the governed diagnostic standard for watchlist/spotlight/critical POP Brief and Captain recovery work:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md`
- Source input was the 2026-05-04 team transcript:
  - `/Users/mark/Downloads/Watchlist Organization - Plan - Mark's Agents.docx`
- The standard turns the team feedback into a repeatable Captain decision tree:
  - start with recovery math and the primary constraint
  - diagnose the funnel before upstream causes
  - branch into floorplan/unit exposure, pricing/concession, source/spend, competitive visibility, website/content/media, reputation/resident experience, and operations/people constraints
  - require every recommendation to include evidence, confidence, owner, due date, expected lift, proof check, and optional do-not-recommend gate
  - produce both an internal Captain diagnostic and a concise property action plan from the same governed read model
- Linked the standard from `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md` and `/Users/mark/Property_Analytics/docs/CAPTAIN_DOCTRINE_2026-05-04.md`.
- First runtime implementation is now wired:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` derives `diagnosticRead` for latest Captain Brief responses and persisted Captain Brief payloads
  - `marketingInsight` now carries `sourceSpendRead` from Marketing BI cost-per-conversion and ad-spend performance rows, including best visible lease/application/guest-card source economics and spend posture
  - `diagnosticRead` now carries `designationDoctrine`, so Spotlight means accelerated recovery watch and Critical means escalated recovery command inside the Captain read model
  - `diagnosticRead` now carries `peerFamilyRead`, selecting stronger same-region or portfolio peers from Marketing Ops Summary rows and proposing borrowable peer tactics with proof checks
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` exposes the `diagnosticRead` contract to the web app
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` renders a `Diagnostic Plan` section with primary constraint, recovery math, designation doctrine, peer-family help, recommended fixes, proof checks, and do-not-recommend gates, plus source/spend economics inside the Marketing BI read
  - `/Users/mark/Property_Analytics/apps/api/test/platform/captain-brief-read.test.ts` verifies derived inventory constraint, 10% exposure recovery math, guest-card requirement, source/spend read, peer-family read, and recommendation gates
- Added the first local watchlist diagnostic draft generator:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py`
- First May 2026 draft packet generated from the current monthly spotlight config:
  - `/Users/mark/Property_Analytics/reports/captains_log/watchlist_diagnostics/2026-05-04/watchlist_diagnostic_drafts_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/watchlist_diagnostics/2026-05-04/watchlist_diagnostic_drafts_2026-05-04.md`
- First-pass pattern: all `19` active May spotlight/watchlist properties read as inventory or stale-unit constrained before demand, with source/spend economics and peer-family tactics included as advisory context rather than the primary fix.
- This is a Captain/POP read-model implementation and doctrine update. It does not mutate locked canonical PIB generation/rendering behavior.

### Property Region Governance ✅
- Promoted the 2026-05-04 `regions.xlsx` workbook into a governed property-region source route:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/property_regions_ingest.py`
  - `/Users/mark/Property_Analytics/docs/PROPERTY_REGIONS_SOURCE_CONTRACT_2026-05-04.md`
- The ingester reads the workbook `Region` / `Property` columns, skips regional `Total` rows, and resolves every property label through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Initial load from `/Users/mark/Downloads/regions.xlsx` resolved `91` active property rows, `14` regions, and `0` unmapped property labels.
- Local `properties.encasa_region` was already aligned for those `91` rows; the official registry now carries `encasa_region` for the same `91` active workbook properties, and `config/property_identity_matrix.json` was rebuilt from the canonical sources.
- Current workbook regions: Arkansas, Atlanta GA, Austin TX, Dallas TX, Florida, Houston TX, Kansas City, Kentucky, Killeen, Nashville TN, Oklahoma, Raleigh NC, San Antonio TX, and Savannah GA.
- `Sundara at Spring Cypress` and `The Vine Kyle Parkway` were not present in the workbook and remain without official-registry/local-DB `encasa_region`; the identity matrix still carries region context where existing community/source evidence provides it.
- Captain peer-family reads, regional benchmarks, and Commodore/regional synthesis should use this governed region path rather than local one-off property-region maps.

### Spotlight Weekly Field Notes Source Route ✅
- Promoted the 2026-05-04 Spotlight weekly notes/action-plan folder into an additive governed Data Pond source route:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/spotlight_weekly_field_notes_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0042_create_spotlight_weekly_field_notes.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/029_create_spotlight_weekly_field_notes.sql`
  - `/Users/mark/Property_Analytics/docs/SPOTLIGHT_WEEKLY_FIELD_NOTES_SOURCE_CONTRACT_2026-05-04.md`
- Source folder:
  - `/Users/mark/Downloads/spotlight`
- The source is explicitly additive human field intelligence. It does not replace official metrics, Marketing Ops Summary, guest cards, unit availability, reputation, or locked PIB generation.
- Initial local load completed on 2026-05-04:
  - `14` source files seen
  - `6` property snapshots upserted into `spotlight_weekly_field_snapshots`
  - `74` action items upserted into `spotlight_weekly_action_items`
  - `0` unmapped files
- Mapped weekly packets: Botanic Luxury, Forest View, Steeplechase, The Pointe Bentonville, The Reserves of Thomas Glen, and The Retreat.
- 2026-05-05 Grand Harbor note intake: `/Users/mark/Downloads/spotlight/The Cape at Grand Harbor.docx` now ingests as The Cape at Grand Harbor / `TX4GH` through the governed property identity matrix. The parser now skips Word temp lock files (`~$*.docx`) and captures daily-note fields such as occupancy, leased %, 60-day trend, goal this week, applications, reservation fees, tours, social ads, outreach visits, work orders, move-ins, NTV, renewals, and vacant-ready/unready counts into `spotlight_weekly_field_snapshots.metrics_json`. Local Pond load wrote the `2026-05-05` TX4GH snapshot; the remote Captain source sync packet included `1` Spotlight snapshot for TX4GH but the Wrangler remote D1 upload ended with a network `fetch failed`, so that remote sync is retryable.
- The ingester groups Excel action plans plus Word/TXT narrative notes by governed property identity and report date. It stores occupancy/trend/leasing activity, recovery goals, source narratives, action owner/deadline/status/notes, derived action category, and quality flags for vague, missing, or past-due actions.
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors the Spotlight weekly snapshot and action-item tables for property-scoped Captain source syncs.
- Intended Captain use: explain metric movement, verify recovery execution, remember repeated blockers, escalate ownerless/stale actions, and preserve source-reconciliation gaps without overriding source-of-record data.

### Competitor Market Research Evidence Ledger ✅
- Added the first governed competitor market research source route for POP Brief / Captain competitive slices:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/competitor_market_research_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0043_create_competitor_market_research.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/030_create_competitor_market_research.sql`
  - `/Users/mark/Property_Analytics/docs/COMPETITOR_MARKET_RESEARCH_SOURCE_CONTRACT_2026-05-05.md`
- The route stores timestamped sourced observations for competitor rents, specials, availability, USPs, media/package indicators, reputation, and explicit source gaps in:
  - `competitor_market_research_snapshots`
  - `competitor_market_research_observations`
- First manual research packet:
  - `/Users/mark/Property_Analytics/Data_Collection/manual_sources/competitor_market_research/the_pointe_bentonville_2026-05-05.json`
- Initial load for The Pointe Bentonville / `AR4PB` completed with `1` snapshot, `15` sourced observations, and `0` unmapped packets.
- The first PIB-style competitor slice artifact was generated at:
  - `/Users/mark/Property_Analytics/reports/captains_log/competitor_market_slices/2026-05-05/ar4pb_competitor_market_slice_2026-05-05.html`
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors the competitor market research tables for property-scoped Captain source packets. AR4PB dry run includes `1` snapshot and `15` observations.
- Current report logic: competitor intelligence is advisory and must carry source URL, captured date, and confidence (`confirmed`, `directional`, `conflict`, `missing`). ADC / Apartments.com package status remains a source gap unless captured through a controlled package source or verified login/API path.
- 2026-05-06 Spotlight competitor batch run: added `/Users/mark/Property_Analytics/Data_Collection/utils/build_competitor_market_packets.py` to build dated official-page competitor packets from governed `property_competitors` comp sets plus the subject property's internal `unit_availability_units` rent/special posture. Built and ingested 2026-05-06 packets for the 11 current Spotlight properties: Botanic Luxury, Avasa Hammock Landing, Steeplechase, The Anatole, Avasa at 1604, College View, Forest View, The Reserves of Thomas Glen, The Retreat at Lakeland, The Retreat, and The Metropolitan. Also loaded the Grand Harbor packet and corrected eight comp-set URL gaps before rebuilding. Remaining source gaps are preserved as `source_gap` rows rather than inferred claims.
- Follow-up Captain runtime wiring completed:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now derives `competitorMarketRead` for Captain Brief reads and persisted brief payloads.
  - The read model answers pricing-vs-advertising, ad-copy, web-copy, and package-status questions from sourced competitor observations and keeps ADC/package status gated when missing.
  - Correction after report QA: Captain competitor reads now pull the subject property's own current visible rent range and visible specials directly from `unit_availability_units` using the latest GA4/unit-feed snapshot, so the Captain Brief does not depend on manually entered subject rows for our own rent/special posture.
  - 2026-05-05 Elation test pass: added `/Users/mark/Property_Analytics/Data_Collection/manual_sources/competitor_market_research/elation_grandway_west_2026-05-05.json`, loaded `1` TX4EG snapshot with `13` observations, and generated a full property-aware Captain Brief at `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_at_grandway_west_captains_brief_vnext_generated_2026-05-05_email_outlook.html`. The reusable vNext generator now avoids Benton/The Pointe hardcoding, embeds a Competitive Market Read inside the full Brief, ignores invalid nonpositive unit-feed rents, and requires a controlled ADC/package source before package-positioning claims are made.
  - 2026-05-05 Elation comp-set cleanup: removed The Grand Parkway Senior Apartments from the Elation operating comp table because it is a senior community, and replaced the prior Luxe at Katy conflict row with the current Luxe official-site special: lowest prices available for a limited time plus app/admin fee credits at move-in. `Data_Collection/utils/competitor_market_research_ingest.py` now replaces a packet's observation set on re-ingest so removed competitors do not linger as stale rows.
  - 2026-05-05 USP display pass: the Elation Captain Brief now renders captured USP evidence as a `USP Direction` block inside the Competitive Market Read instead of dumping the full amenities string into a table cell. The block separates convenience, location, and pet/lifestyle differentiators and includes an exact copy angle for web/ad/leasing-script use.
  - 2026-05-05 team-action intelligence pass: the local vNext Captain Brief now renders a `Team Action Intelligence` section near the top of the Brief. It uses Spotlight action-plan rows when available; otherwise it derives team work from reliable Brief facts such as aged unit/floorplan pressure, cancellation/denial drivers, competitor specials/value pressure, and search/local USP opportunities. Each row names the action, owner lane, metric tied to the action, why it matters, and proof expected.
  - 2026-05-05 competitive USP gap pass: the Elation Captain Brief now adds `Visible Advantage Gaps` under `USP Direction`, showing what Elation can press against the captured comp read: the connected-living bundle, up-to-3-pets positioning, and I-10/Grand Parkway framing. The section explicitly distinguishes visible gaps in captured evidence from absolute claims that a competitor lacks a feature.
  - 2026-05-05 team-action wording refinement: replaced stale/180+ unit tasking in the Team Action Intelligence and 30-Day Recovery Plan with a floorplan exposure huddle. Aged inventory remains available as supporting context in Inventory/Operations, but the team-facing action is now focused on A2/A1 offer, tour path, follow-up message, and ownership.
  - 2026-05-05 website-copy opportunity pass: the Elation Captain Brief now includes a `Website Copy Opportunity` section after the competitive USP read. It evaluates the hero/first-viewport message, primary value copy, and offer/special copy against the current USP, search, and comp read, then gives exact replacement copy and priority. The section emphasizes sharper value-defense copy rather than adding more generic page text.
  - 2026-05-05 responsibility-register display cleanup: removed the visible `Captain Responsibility Register` from the outbound Captain Brief because the Captain is creating the Brief, not reading its own internal watch/action register. Runtime data remains available for orchestration behind the scenes; the visible Brief now moves directly from Admiral Read into Team Action Intelligence.
  - 2026-05-05 channel-activation pass: the Elation Captain Brief now includes `GBP And Social Activation` after the website copy opportunity section. It provides channel-ready GBP post copy, social feed copy, and floorplan-specific push copy, with audience, CTA, and proof expected so the team can turn the recovery read into visible local demand and trackable follow-up.
  - The Captain-facing summary now prioritizes decision logic rather than a competitor spreadsheet: our visible rent/specials, lower-rent comp pressure, confirmed competitor specials, pricing/advertising/copy/package decision posture, and source gaps.
  - Trust-display pass: `competitorMarketRead` now includes explicit `why` explanations and `evidenceReferences` (`CM-1` through `CM-4`). The Captain UI renders superscript source markers beside claims and a bottom `Data Integrity` panel that describes source, date, confidence, and interpretation limits.
  - 2026-05-05 Captain Brief display-discipline pass: the local vNext email artifact no longer opens with source/status gating or internal data-route narrative. Captain-facing sections now lead with business facts and recommendations, source references move to a bottom `Sources Used` table, internal source-routing/runtime rows are filtered from the responsibility register, and visible wording avoids failure/partial/missing-style language while preserving the underlying data unchanged.
  - 2026-05-05 performance-table fix: the local vNext Captain Brief now fills portfolio averages and vs-portfolio comparisons for T7/T30 volume rows, closing ratio, and guest cards per available door. Volume benchmarks use same-report-date portfolio property averages from `marketing_bi_traffic_conversions_full`; conversion benchmarks use portfolio weighted rates; guest cards per available door is calculated as guest cards divided by available units for the property and by the same rule across properties with current availability.
  - 2026-05-05 performance-trend fix: T7/T30 conversion-rate trend rows now calculate from the same current/prior-year numerator and denominator pairs in `marketing_bi_traffic_conversions_full` (for example visits divided by guest cards this year vs visits divided by guest cards prior year). Guest cards per available door remains labeled `current only` when the current Brief has current available units but no prior-year available-unit denominator.
  - `diagnosticRead` now carries `competitorMarketRead`, adds competitive-market recommendations when visible value pressure is present, and adds a do-not-recommend gate against unsupported ADC/package claims.
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` now renders a `Competitive Market Read` section with source-backed counts, visible rent pressure, confirmed specials, Stephanie-answer logic, and source gaps.
  - `/Users/mark/Property_Analytics/apps/api/test/platform/captain-brief-read.test.ts` verifies competitor source readiness, visible value pressure, package gating, and the competitive-market diagnostic recommendation.

### Loose Code Workstream Organization ✅
- Added an explicit organization layer for the large dirty/untracked workspace so active work can be split by capability instead of promoted as one oversized branch.
- Working docs:
  - `/Users/mark/Property_Analytics/docs/LOOSE_CODE_WORKSTREAM_ORGANIZATION_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/LOOSE_CODE_PATHSPEC_MANIFEST_2026-05-04.json`
- Current inventory at the time of organization: `117` tracked modified files and `360` untracked files visible to Git. No locked canonical PIB generator/template/sender files were touched.
- The current branch name `codex/pilot-control-cwv-reporting` does not describe the whole loose workspace. The split plan groups work into property identity governance, data collection closure, Marketing BI / Marketing Ops source routes, Reputation.com, Captain runtime/briefs, platform auth/control plane, EVS/BrowserStack, Edge Experimentation, content/site/VACS/intelligence, pilot CWV/tracker/roundup, and generated artifacts/logs.
- The recommended first promotion order is property identity governance -> Marketing BI / Marketing Ops source routes -> Captain runtime and brief family, because later Captain reads depend on the governed source routes.

### Marketing Ops Summary Source Route ✅
- Promoted the 2026-05-04 `Marketing Ops Summary.xlsx` workbook from ad hoc spreadsheet evidence into a governed Data Pond source route:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_ops_summary_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0041_create_marketing_ops_summary.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/028_create_marketing_ops_summary.sql`
  - `/Users/mark/Property_Analytics/docs/MARKETING_OPS_SUMMARY_SOURCE_CONTRACT_2026-05-04.md`
- The source is a single wide property-level workbook with grouped sections for Property Performance, Traffic, Pricing, Financial, and Kingsley Data. The ingester preserves those groups as purpose-built columns instead of using the generic Excel evidence ledger.
- Initial local load into `/Users/mark/Property_Analytics/data/portfolio_analytics.db` completed on 2026-05-04:
  - `91` property rows upserted into `marketing_ops_summary_rows`
  - `91` rows resolved through the governed property identity matrix
  - source-as-of date `2026-05-03`
  - portfolio totals: `27,074` units, weighted occupancy `90.5%`, T30 leads `13,633` (+`8.4%` YoY), T7 leads `3,306` (+`14.8%` YoY), T30 visits `3,875` (+`11.8%` YoY), T7 leases `325` (+`7.3%` YoY)
- Follow-up Captain integration completed on 2026-05-04:
  - `apps/api/scripts/captain_sources_to_d1.py` now mirrors `marketing_ops_summary_rows`
  - `apps/api/src/platform/captain/runtime.ts` now includes `marketingOpsSummary` in source readiness and adds `opsSummary` / `opsRead` to the Captain Marketing Insight payload
  - Remote D1 `pop-brief-db` was updated with the new table and `91` Marketing Ops Summary rows after a narrow table-only import. Verification returned `91` rows, `91` mapped, source-as-of `2026-05-03`, and T30 leads `13,633`.
  - The full Captain source sync dry-run includes `marketing_ops_summary_rows: 91`; the first full remote import hit a Wrangler fetch failure after large SQL upload, so the successful remote write used a narrower Marketing Ops Summary-only import.
- This source is advisory Marketing BI / Captain evidence and does not override official operating metrics, raw guest-card facts, unit-level availability, or booked financial source-of-record feeds.

### Reputation.com Source Route ✅
- Added the first Data Pond ingestion path for Reputation.com XLSX exports:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/reputation_com_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0040_create_reputation_com_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/027_create_reputation_com_tables.sql`
- The ingester reads the current `/Users/mark/Downloads/Reputation` workbook family: Location Leaderboard, Reputation Score By Location, Score Time Series By Location, and Local Competition Leaderboard.
- Rows resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and preserve unmapped vendor labels as source mapping gaps instead of using one-off downstream maps.
- Initial 2026-05-04 local load completed into `/Users/mark/Property_Analytics/data/portfolio_analytics.db`: `89` location leaderboard rows, `52` score component rows, `445` score time-series rows, and `150` local competition rows.
- 05/04/2026 identity cleanup: confirmed and promoted Reputation.com vendor labels into the governed matrix generation path:
  - `Bella Rucello` -> Bella Ruscello / `TX4RU`
  - `Camber Ridge at Cross Creek Ranch` -> Camber Ridge / `TX4CB`
  - `Canton Mills Loft` -> Canton Mill Lofts / `GA4CM`
  - `Point At Bentonville` -> The Pointe Bentonville / `AR4PB`
  - `Villas Continentals` -> Villas Continental / `FL4VC`
- After regenerating `config/property_identity_matrix.json` and rerunning the Reputation.com ingest, all `89` leaderboard locations, all `445` time-series rows, and all `150` local-competition rows map to governed properties. The only unmapped score-component rows are the vendor benchmark rows `Best In Class` and `Industry Average`.
- Added the first meeting-ready Reputation.com reporting artifact generator:
  - `/Users/mark/Property_Analytics/reports/reputation/generate_reputation_com_brief.py`
- The first generated brief/email for the 2026-05-04 meeting prep lives at:
  - `/Users/mark/Property_Analytics/reports/reputation/2026-05-04/reputation_com_portfolio_brief_2026-05-04.html`
- The brief was sent to `mlaufhutte@venterraliving.com` on 2026-05-04 at 08:58 CDT with message id `0f26984e-5451-4e9b-ab94-bfb77759621d@property-analytics.local`.
- 09:08 CDT correction: regenerated and resent the same brief using the canonical PIB email header structure and logo helper from `Property_Intelligence_Brief/templates/executive_template.py` without mutating locked PIB files. Corrected message id: `7d5ffdc3-b37e-4bb7-a6f0-3b027358abba@property-analytics.local`.
- 09:12 CDT correction: regenerated and resent after replacing all Reputation brief KPI cards with the centered PIB-style email tile pattern. Latest corrected message id: `ed36165a-c05c-4df2-80e8-45543f5189dd@property-analytics.local`.
- The source is additive to GBP reviews/reputation evidence and does not change canonical PIB generation/rendering behavior.

### Content Office + GBP Publishing Lane ✅
- Added the first Content Office workspace in The Pond:
  - `/Users/mark/Property_Analytics/apps/web/src/app/content-office/page.tsx`
- Content Office is the new governed umbrella for channel-ready content operations. It does not replace GBP Posts; it surfaces GBP Posts as the first active lane and frames future channels as draft/handoff lanes until integrations are proven.
- The first version summarizes the existing GBP Posts queue, highlights review/approval pressure, links directly into `/gbp-posts`, and names the crawl-stage expansion lanes:
  - GBP Posts: active governed workflow
  - Social Drafts: future Facebook/Instagram handoff lane
  - Email Snippets: future leasing/campaign copy lane
  - Short Video: future TikTok/Reels brief lane
  - Community Listening: future Yelp/Reddit/local conversation signal lane
- Access vocabulary now includes `contentOffice` in the shared web/API offering permissions model. GBP Posts and Content Office are aligned to curator/steward access, with policy administration remaining steward/admin-gated.
- This is intentionally orchestration-first: no alternate PIB renderer, no duplicate GBP draft system, no fake integrations for Meta/Yelp/TikTok/Reddit, and no publishing bypass around the existing GBP approval workflow.
- Follow-up implementation slice: GBP Posts is now Captain-aware. The existing GBP context builder can include active Captain runtime context in `gbp_post_source_snapshots`, including property code, latest Captain Brief run timestamp, open watch/action counts, top watch items, top actions, derived recommended angles, and a primary directive.
- The Draft Builder now defaults to `Use Captain Context`, stores that context in the same source snapshot as PIB/marketing/live inputs/policy, and adds a `captain_directive` deterministic draft candidate when active Captain context exists.
- Draft Detail now renders a human-facing Captain Context panel before the raw JSON blocks, so curators can see why a Captain-led local post was proposed without digging through the payload.
- This remains source-snapshot/draft/approval oriented; it does not auto-publish or bypass GBP policy.
- Publication proof slice: GBP Posts now uses the existing `gbp_post_publications` table for manual proof. Approved drafts can be marked `posted manually` or `posting failed`; the route stores proof URL/name, notes, request/response evidence JSON, created/updated actors, and updates the draft status to `published` or `failed`.
- GBP Draft Detail now has a Posting Proof panel with proof history and manual proof controls. Content Office now counts published proof and failed proof follow-up pressure. Direct Google API posting remains a future plug-in to the same publication ledger, not a separate workflow.
- Suggested Posts slice: `/v1/gbp-posts/suggestions` now derives GBP opportunities from Captain watch/action context plus Data Pond/PIB/local visibility context. Suggestions carry property, angle, priority, reason, source evidence, recommended channel, and a draft seed.
- Content Office now shows portfolio-level `Suggested GBP Posts`. GBP Posts now shows property-specific suggestions with `Prepare Draft`, which fills the Draft Builder source label/notes and keeps Captain context enabled. This turns Content Office from a passive dashboard into the first proactive channel-work queue while preserving the existing draft/approval/proof workflow.

### Edge Experimentation System Production Plan ✅
- Added the Data Pond-native production plan for the Venterra Edge Experimentation System:
  - `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md`
- Added the first companion implementation-planning artifacts:
  - `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md`
  - `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md`
  - `/Users/mark/Property_Analytics/docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md`
  - `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md`
- The plan treats experimentation as a governed capability, not a standalone A/B testing product:
  - Data Pond owns experiment definitions, approvals, exposure/decision/learning ledgers, and source authority.
  - Cloudflare Workers execute approved edge rewrites and fail open to control.
  - Zaraz routes normalized experiment events to GA4/Heap.
  - EVS validates selector health, rendering, CTA behavior, and post-launch proof.
  - Site Content Creator and Specs define eligible components and allowed change types.
  - Watchtower/Data Collection monitor guardrails, source freshness, and rollback posture.
  - Captain/Navigator lanes may recommend draft experiments but cannot bypass approval gates.
- MVP scope is intentionally narrow: one property homepage, governed hero/CTA component, text/class/href swap or adjacent secondary CTA, manual promotion, and hard guardrails for CWV, selector miss rate, Worker errors, conversion softness, and EVS failure.
- The first admin UI should be an operational Experiment Lab with draft creation, readiness checklist, EVS/Worker proof, approval, schedule, pause/rollback, decision, and learning flows; the freeform visual builder is explicitly deferred.
- First implementation slice is now in place:
  - migrations: `/Users/mark/Property_Analytics/apps/api/migrations/0039_create_edge_experimentation_tables.sql` and `/Users/mark/Property_Analytics/infra/migrations/026_create_edge_experimentation_tables.sql`
  - shared contracts: `/Users/mark/Property_Analytics/packages/shared/src/experiment-schemas.ts` and `/Users/mark/Property_Analytics/packages/shared/src/experiment-types.ts`
  - API route: `/Users/mark/Property_Analytics/apps/api/src/routes/experiments.ts`, mounted at `/v1/experiments`
  - Data Pond page: `/Users/mark/Property_Analytics/apps/web/src/app/experiments/page.tsx`
  - nav/permission integration: `experiments` offering is admin-only for now
- Local D1 migrations were applied successfully; the Edge Experimentation table family exists locally and has `2` seeded component contracts.
- Verification passed for API/shared typecheck and web production build. `next lint` remains unusable in this app until ESLint is configured because it opens Next's interactive setup prompt.
- Live deployment on 2026-05-02:
  - Remote D1 experiment tables were applied directly through Keeper-backed Wrangler `d1 execute` because the remote Wrangler migration ledger attempted to replay older migrations and failed at existing governed-memory identity rows before reaching `0039`.
  - Remote D1 verification shows the Edge Experimentation table family exists and `edge_experiment_component_contracts` has `2` seeded contracts.
  - API Worker deployed through Keeper-backed Wrangler. Version ID: `36b79480-ee7c-49b1-90d4-bfb657c9df57`.
  - Static Pages deployment published from `apps/web/out` to project `property-analytics`, branch `main`. Preview URL: `https://56c01385.property-analytics.pages.dev`.
  - Smoke checks: `https://api.venterradev.com/v1/experiments` returns authenticated `401 NO_SESSION`, `https://56c01385.property-analytics.pages.dev/experiments` returns `200`, and `https://app.venterradev.com/experiments` is protected by Cloudflare Access `302`.
  - Live edge/site mutation remains locked; this deployment exposes the admin/draft Experiment Lab only.
- 05/02/2026 UI refinement:
  - Experiment Lab now shows an upfront `Eligible Items From Site Content` inventory before draft creation.
  - The list first reads Site Content for the selected property and derives candidate sections from matched/partial section mappings, assessments, CTA/link signals, and page scope. The promoted experiment-contract list remains below it as the current execution safety rail.
  - This keeps Site Content as the owner of property/page/section eligibility instead of letting Experiment Lab become a parallel component catalog.
  - Follow-up correction: the eligible-items panel was simplified into a human-facing `What Can We Test?` view with plain cards, human labels, readiness states, and suggested test ideas. Technical component contracts are now reduced to a small `Ready For Draft Creation` support list.
  - Completion pass: each eligible Site Content item now has a `Prepare Test` action. The API route `POST /v1/experiments/component-contracts/site-content` promotes a matched/partial Site Content section into an active experiment component contract, keeps a Site Content source reference, and returns a suggested draft name, hypothesis, metric, page, component, change type, and variant defaults. The UI then pre-fills the draft form.
  - API Worker redeployed with Site Content promotion route. Version ID: `5512b16d-9a11-4298-a123-b7aa7744a7e8`.
  - Static Pages redeployed from `apps/web/out` to project `property-analytics`, branch `main`. Latest preview URL: `https://c950669d.property-analytics.pages.dev`.
- 05/02/2026 proof-layer slice:
  - Experiment Lab now has `Run Preflight` and `Generate Dry Run` actions on draft detail.
  - `POST /v1/experiments/:experimentId/preflight` records an EVS preflight request/proof checklist in `edge_experiment_guardrail_snapshots` and moves drafts into `pending_preflight` without launching anything.
  - `POST /v1/experiments/:experimentId/dry-run` writes a non-mutating Worker dry-run config into `edge_experiment_config_versions` with `config_status='dry_run'`; it is explicitly preview-only and fail-open-to-control.
  - The UI now shows a human launch checklist (`Page found`, `Component found`, `Change is safe`, `Mobile proof`, `Desktop proof`, `Metrics ready`, `Rollback ready`) plus preflight/dry-run status. Live launch remains locked until external EVS proof and dry-run review are complete.
  - API Worker redeployed with proof-layer routes. Version ID: `60f33f69-3e9c-4bfd-a2ce-66e83031d0d9`.
  - Static Pages redeployed from `apps/web/out` to project `property-analytics`, branch `main`. Latest preview URL: `https://b5a987a9.property-analytics.pages.dev`.
- 05/02/2026 CTA visibility correction:
  - Experiment Lab was already consulting Site Content, but it was presenting section-level candidates and the support list still began with the two seeded hero CTA contracts, which could make the system look like it only knew about two homepage CTAs.
  - The `What Can We Test?` inventory now expands recognized Site Content CTA labels into their own testable items, counts testable items separately from CTA signals, and no longer caps the visible candidate list at eight items.
  - The promotion API now accepts a `target_label`, so multiple CTAs in the same Site Content section produce distinct component contracts instead of collapsing into one section-level target.
  - API Worker redeployed with CTA-specific promotion support. Version ID: `0138ccc0-f406-448d-b546-2d1726125bd2`.
  - Follow-up correction: the Lab now loads Site Content inventory alongside the general communities table, resolves property identity across Site Content slugs/names and Data Pond community names/URLs, defaults to the current Champions Green Site Content pilot when available, labels properties with captured Site Content in the property picker, and offers captured Site Content properties as switch buttons when the selected community has no linked inventory.
  - Visual locator pass: each eligible CTA card now carries a compact page-location mini-map built from Site Content section order, highlighting the section that contains the CTA and labeling its upper/middle/lower page position.
  - Ordering correction: the eligible CTA list now sorts by Site Content page order, then captured live section order, then CTA order within the section so cards read in the same top-to-bottom sequence as the page.
  - Specs orchestration pass: Experiment Lab now blends Specs-defined global surfaces with Site Content evidence. Header, Mobile Menu, Pages, and Footer render as separate human-facing groups. Specs-derived targets include header phone/apply/tour/menu, mobile menu apartment/tour/apply links, homepage hero `Find Your Home`, and footer apply/message actions.
  - Specs-derived selections can now be promoted through `POST /v1/experiments/component-contracts/specs`, creating active contracts with `source='specs_contract'` and `specs://...` selectors. Live launch still requires EVS/live selector proof before execution.
  - API Worker redeployed with Specs promotion support. Version ID: `8337d640-6a3b-4d4c-9bf0-6b3ec0037b41`.
  - Experience environment pass: the Lab now adds intent filters, a clickable Experience Map, repeated journey pattern grouping, readiness chips (`Specs expected`, `Seen live`, `Selector ready`, `EVS proof`, `Draft safe`), per-target experiment ideas, Target Proof guidance, and a visible `Identify -> Verify -> Draft -> Preflight -> Decide` workflow on each target card.
  - Density correction: the heavy per-target card sections (`Location`, `Readiness`, `Ideas`, and `Workflow`) are now collapsed into accordions by default, keeping the target cards scan-friendly while preserving the deeper proof and idea detail on demand.
  - Follow-up density correction: the full target surface groups (`Header`, `Mobile Menu`, `Pages`, and `Footer`) now render as section-level accordions with counts, example labels, and intent chips; the Experience Map / repeated journey panel also sits behind a `Planning Overview` accordion. This keeps the first viewport human-scannable instead of showing every eligible target card at once.
  - Static Pages redeployed from `apps/web/out` to project `property-analytics`, branch `main`. Latest preview URL: `https://e772c14c.property-analytics.pages.dev`.
- The capability register and full system audit now include this as a Planning capability that should extend Site Content Creator + EVS + Cloudflare/Data Collection rather than parallel-building a shadow experimentation surface.

### Captain Command Hierarchy ✅
- The Captain system now has a codified role hierarchy for ownership, escalation, support agents, and memory stewardship.
- Canonical doctrine: `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`
- Primary mapping:
  - Fleet Commander: Mark / system sponsor
  - Chief of Staff: Codex / strategic system collaborator
  - Admiral: VP or senior operating leader receiving Captain readouts
  - Commodore: regional or portfolio leader
  - Captain: property-scoped intelligence owner, e.g. Captain Benton for The Pointe Bentonville
  - First Officer: human property/regional execution partner
  - Quartermaster: source arrival, freshness, identity, and evidence quality
  - Navigator: search, SEO, content, local entity, and USP intelligence
  - Signals Officer: paid media, source, traffic, and attribution performance
  - Engineer: platform, site, collection, and automation reliability
  - Boatswain: action tracking and follow-through
  - Logkeeper: durable memory, audit history, and promotion lineage
- The Captain's Brief should render the VP-facing top section as `Admiral Read` when the audience understands the model; otherwise `Executive Read` or `VP Read` is acceptable. Data Pond source authority remains unchanged.

### Captain Memory And Directive Standard ✅
- The Captain system now treats memory as an operating responsibility, not a hidden prompt convenience.
- Canonical standard: `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`
- Required Captain memory layers:
  - Truth Memory: current and historical governed facts
  - Decision Memory: what was decided, by whom, when, and why
  - Action Memory: work, owner, due date, expected lift, and proof
  - Pattern Memory: repeated source, floorplan, operational, or market behavior
  - Learning Memory: what the Captain expected and whether reality confirmed it
  - Specs Memory: structural expectations and drift between Specs and live site/content/HTML reality
  - Doctrine Candidate Memory: property lessons that may merit Commodore/Fleet/Ledger promotion
- The Captain is explicitly responsible for active property-life awareness, not only report assembly. The Captain must notice, remember, challenge, direct, and follow through across demand, inventory, pricing, operations, content, reputation, market posture, execution history, and source health.
- The Captain is accountable for support-team orchestration. Quartermaster, Navigator, Signals Officer, Engineer, Boatswain, Logkeeper, Experience Watch, and the First Officer may own specialist lanes, but the Captain must know whether each lane is current, stale, blocked, or failing to produce action-ready intelligence.
- BrowserStack and EVS belong to the Engineer / Experience Watch lane and provide proof of the actual prospect/resident experience across devices, viewports, forms, CTAs, specials visibility, and post-change validation.
- Website/content/SEO/AI-visibility reads must use the grounding chain: Specs standard -> live reality -> external evidence -> directive -> follow-up proof.
- Recovery-property Captain Briefs must answer the VP directive questions: what changed in the last 30 days, how many move-ins/exposure reductions are needed, what traffic/source mix is required, whether pricing/concession/spend/operations should move first, source performance and spend shifts, urgent website/copy changes, USPs, image/review posture, make-ready/hold-time/process constraints, effective-rent differentiation, and a 30-day plan with owners and measurement.
- Commodore memory receives recurring Captain updates and stores cross-property patterns, tactics that worked or failed, Captains needing attention, and Ledger promotion candidates.
- Memory remains subordinate to Data Pond truth; when memory conflicts with current source-of-record facts, the Captain must reconcile rather than repeat stale memory.

### Captain Brief vNext Generator + Ads Heartbeat ✅
- Added the first reusable local vNext Captain Brief generator:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`
- The generator resolves property identity through `Data_Collection/utils/property_identity.py`, reads current Pond facts, computes the recovery math, and emits both browser-preview and Outlook-safe email HTML.
- The generator now carries the familiar Performance Analysis evidence layer expected by current analyst users:
  - T7 Performance table
  - T30 Performance table
  - reported advertising spend card
  - marketing notes for inventory, website/SEO, and current specials
- The Performance Analysis layer is explicitly labeled as reported performance context and reconciled against Pond authority, so it can preserve the team's current working view while Benton still owns exposure math, unit-level facts, source freshness, and the 30-day directive.
- The generator now treats Google Ads as a heartbeat/read-model problem rather than simply a metric-date problem:
  - last collection check
  - last campaign activity
  - current posture
  - campaign status
- 04/30/2026 update, refined 05/05/2026: the vNext generator can pull remote Captain runtime state through the Keeper-backed Wrangler helper and include business-facing open watch items and open actions in the generated Brief. Internal source-route and support-tool rows are filtered from the Captain-facing responsibility register so the artifact stays focused on operating ownership.
- The generator now supports `--send` and `--recipient` for Outlook-safe email delivery through the shared `utils.email_sender.EmailSender` path.
- 04/30/2026 trust upgrade: the vNext generator no longer hardcodes the T7/T30 performance table or advertising-spend values. It now prefers `marketing_bi_traffic_conversions_full` for guest cards, visits, applications, RFP/lease proxy, closing ratio, and YoY trends; `available_unit_interest_metrics` for guest-cards-per-available-door and exposure; `marketing_bi_ad_spend_performance_month` for latest structured spend/monthly volume; and `marketing_bi_cost_per_conversion_rows` for source cost-per-conversion context. When current-month channel spend is not structured, the Brief states that limitation explicitly instead of carrying inferred channel dollars.
- 04/30/2026 source-trust work, refined 05/05/2026: the vNext generator keeps source accounting in the generator/read model, but no longer renders a top source/status gate in the Captain-facing email. The email now places a descriptive `Sources Used` panel at the bottom and avoids internal data-route vocabulary in the main read.
- 04/30/2026 operating-truth route check: the canonical `property_operating_metrics` schema now exists locally and remotely, but AR4PB has `0` rows in both places. Tested available candidate files (`Multifamily Occupancy Risk and Lease Ranking - with Actionability Details.xlsx` and `BI-Metrics-Run20260430.xlsx`); they are analytical / guest-card conversion sources, not the official operating metrics feed. Benton now has a critical open D1 action `route_official_operating_metrics` assigned to `Quartermaster / Data Pond`, due `2026-05-01`, with the required fields listed in evidence JSON.
- 04/30/2026 operating-truth intake contract: added a drop-ready AR4PB template at `/Users/mark/Property_Analytics/docs/contracts/property_operating_metrics_template_AR4PB.csv` and operator helper `/Users/mark/Property_Analytics/scripts/operating_metrics_brief_intake.py`. The helper can copy a dated template into the monitored OneDrive drop, validate a filled CSV/XLSX through the canonical ingester, optionally write local Pond + remote D1 rows, and regenerate/send the Captain Brief. A blank dated template was copied to `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Property-Operating-Metrics-AR4PB-20260430.csv`.
- The Pointe generated run for 04/29/2026 produced:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_brief_vnext_generated_2026-04-29.html`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_brief_vnext_generated_2026-04-29_email_outlook.html`
- Current Ads heartbeat for AR4PB: `posture=paused_no_current_activity`, `last_check=2026-04-29`, `last_activity=2026-03-20`, `campaign_status=PAUSED`. Brief copy should say checked/no current activity, not stale Ads data.
- The 04/29/2026 Pointe email version was sent to `mlaufhutte@venterraliving.com` with message id `70bf720a-55ee-420a-a0e2-35ce058eb32b@property-analytics.local`.
- The 04/30/2026 Pointe run produced:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_brief_vnext_generated_2026-04-30.html`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_brief_vnext_generated_2026-04-30_email_outlook.html`
  - email sent to `mlaufhutte@venterraliving.com` with message id `9065cdfa-0a0c-409e-bd5c-f10f5abaec24@property-analytics.local`
- The 04/30/2026 Pointe run included remote Captain runtime evidence: `8` open/watch items, `5` open actions, and `10` recent support-lane runs. Ads heartbeat for that run: `posture=paused_no_current_activity`, `last_check=2026-04-30`, `last_activity=2026-03-20`, `campaign_status=PAUSED`.
- 05/01/2026 display standard upgrade: Captain's Brief `v1.2` is now the active human-readability baseline for data-heavy Captain reports, emergency scans, Spotlight Captain reads, and recovery-directive emails. The standard is documented at `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md` and referenced by `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`.
- The first approved `v1.2` proof is the readable Elation at Grandway West emergency scan: `/Users/mark/Property_Analytics/reports/captains_log/emergency/elation_at_grandway_west/elation_high_alert_seo_scan_2026-05-01_readable_email_outlook.html`, sent with message id `05bf3670-e81a-4892-b391-4c5956b71e0a@property-analytics.local`.
- Captain's Brief `v1.2` requires at-a-glance KPI tiles, grouped evidence blocks, short `Read:` interpretation statements, explicit missing-source notes, and owner/action/proof directives. It rejects long comma-separated evidence cells and dense row-based data dumping as the default report presentation.
- 05/01/2026 header lock: Captain's Brief `v1.2` now has a locked PIB-style header renderer at `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`. It uses the real Venterra logo from `/Users/mark/Property_Analytics/Portfolio_Dashboard/assets/venterra_logo.png` as a validated base64 PNG data URI, with PIB-scale typography: logo `15px`, report title `14px`, property name `28px`, subtitle/version `11px`, metadata `13px`.
- Active Captain generators now use the locked header renderer rather than hand-built text-only `VENTERRA` headers: `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py` and `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py`.
- Header guardrail: `/Users/mark/Property_Analytics/scripts/check_captains_brief_header_lock.sh` fails if active Captain generators stop using `render_captain_header` or reintroduce old text-only/oversized header styling.

### Captain Benton Scheduled Runtime Expansion ✅
- The deployed Cloudflare Worker now includes live runtime handlers for the expanded Captain support lanes:
  - `benton_navigator_watch`
  - `benton_experience_watch`
  - `benton_boatswain`
  - `benton_logkeeper`
- Remote D1 `captain_support_agents` for `AR4PB` now has 10 active agents:
  - Daily: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, Navigator Watch, Experience Watch, Boatswain
  - Weekly: Logkeeper, Supervisor Scribe
- Deployed Worker version after runtime expansion and platform test cleanup: `6e8d43b2-2536-47c6-9e99-da2281bca66c`.
- Test harness compatibility note: the API default export is a Cloudflare Worker module, but it also exposes `request` bound to the Hono app so existing platform route tests can call `app.request(...)` without replacing the deployed `fetch`/`scheduled` shape.
- EVS permission note: the API offering-action model now allows editors to use the EVS draft and handoff actions, matching the explicit `evs:{draft,handoff}=editor` requirement while viewers remain blocked.
- Active cron schedule remains:
  - `15 12 * * *`: daily support lanes
  - `45 13 * * 1`: daily plus weekly support lanes
- The Captain Worker consumes mirrored D1/R2 evidence and writes watch/action/run state. Paid DataForSEO, BrowserStack, and other external collection still belongs in Data Collection / EVS; the Captain runtime should not spend paid API credits from cron.
- Seed artifact for the expanded roster:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_expanded_support_roster_2026-04-29.sql`

### Spotlight And Pilot Captain Activation ✅
- The Captain runtime is no longer Benton-only. `apps/api/src/platform/captain/runtime.ts` now resolves support-agent jobs by role suffix, so property-specific keys such as `anatole_source_scout`, `calais_navigator_watch`, and legacy `benton_source_scout` all execute the same governed support lanes.
- Removed remaining Pointe-specific fallback filters from Captain source-read queries; Captain runtime now reads Marketing BI, available-unit interest, traffic conversion, and cancel/denial rows by governed property code/community id.
- Remote D1 now has active Captain activation memory and support rosters for 28 properties: 23 April Spotlight properties plus the five pilot properties.
- Remote D1 verification on 2026-04-29 shows:
  - `280` active `captain_support_agents`
  - `28` active Captain properties
  - `224` daily lanes
  - `56` weekly lanes
  - `28` `captain_activation` governed memory entries
- Activation generator:
  - `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`
- Activation artifacts:
  - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-04-29.sql`
  - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-04-29.json`
  - chunked seed-only SQL under `/Users/mark/Property_Analytics/reports/captains_log/activation/chunks_seed_only/`
- Deployed Worker version after generic Captain runtime activation: `593c0b52-a019-4f55-9e3f-ed471d8f8427`.
- Active cron remains `15 12 * * *` for daily lanes and `45 13 * * 1` for daily plus weekly lanes. The Captain Worker consumes mirrored evidence and writes watch/action/run state; paid DataForSEO, BrowserStack, and heavy collection still belong in Data Collection / EVS and should be mirrored into the Captain runtime.

### Captain's Log / Marketing BI Daily Packet ✅
- The Marketing BI daily portfolio packet is now a governed Captain source route rather than an ad hoc PDF read.
- Source contract: `/Users/mark/Property_Analytics/docs/MARKETING_BI_DAILY_PACKET_SOURCE_CONTRACT_2026-04-28.md`
- Parser / ingester: `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_packet_ingest.py`
- Local schema: `/Users/mark/Property_Analytics/apps/api/migrations/0031_create_marketing_bi_daily_packets.sql`
- Remote D1 schema: `/Users/mark/Property_Analytics/infra/migrations/018_create_marketing_bi_daily_packets.sql`
- Daily collection: `Data_Collection/orchestration/daily_master_collection.py` now runs `marketing_bi_packet` after the existing BI workbook ingest and before operating metrics.
- D1 bridge: `apps/api/scripts/captain_sources_to_d1.py` mirrors latest packet headers, packet pages, and selected-property summary rows for Captain runtime use.
- Captain Brief read-model integration: `apps/api/src/platform/captain/runtime.ts` now returns `marketingInsight`, combining the daily packet, available-unit interest, traffic conversions, and cancel/denial rows into a grounded Captain narrative and metrics block. `/analysis/captain` renders this as `Marketing BI Read` between Source Readiness and Operating Snapshot.
- Portfolio enrichment correction on 2026-04-28: `Data_Collection/utils/marketing_bi_conversion_ingest.py` now parses every visible property-level row from the Marketing BI `Traffic Conversions T7D-T90D` export instead of only The Pointe. It maps rows through guest-card property codes plus the official registry, preserves unmapped rows, and loaded 12 visible property rows from `/Users/mark/Downloads/Traffic Conversions T7D-T90D-04-28.pdf`. `apps/api/scripts/captain_sources_to_d1.py` now mirrors recent Marketing BI advisory rows portfolio-wide rather than only AR4PB, so future Captains can read the shared source without a bespoke mirror.
- Initial load from `/Users/mark/Downloads/Conversion_Dashboard.pdf` stored one 31-page packet with report date `2026-04-27`, selected period `2026-01-28` to `2026-04-27`, 31 page rows, and 37 Portfolio Summary property rows. The Pointe row is mapped to `AR4PB`, community id `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`, 452 apartments, acquired `2025-04-15`, built `2021`.
- 04/29/2026 portfolio refresh:
  - `/Users/mark/Downloads/Traffic Conversions.pdf` ingested into `marketing_traffic_conversions` with 12 visible property rows for report date `2026-04-29`.
  - `/Users/mark/Downloads/GUest Cards per unit.pdf` ingested into `available_unit_interest_metrics` with 21 rows for report date `2026-04-29`, including property rows for Pointe, West 46th, Anatole, Creekside, Lakeside, and Parker.
  - The Pointe 04/29/2026 read now shows 44 T7 guest cards, 176 T30 guest cards, +131.6% T30 YoY in Traffic Conversions, and 54 available units / 11.9% available / 176 T30 guest cards / +24.8% T30 delta in Guest Cards Per Unit Type.
  - Remote D1 Captain source mirror was refreshed after ingest. Remote verification shows 12 `marketing_traffic_conversions` rows and 21 `available_unit_interest_metrics` rows for `2026-04-29`.
  - `/Users/mark/Downloads/Perf by Prop Only.pdf` and `/Users/mark/Downloads/Conversion Trends.pdf` were ingested as full Marketing BI packets with report date `2026-04-28`, adding 2 packet rows, 62 page rows, and 74 property-summary rows locally, then mirrored to remote D1.
  - Those packets contain useful pages for the Captain Brief gap list, including `Traffic Performance by Property`, `Advertising Spend`, `Conversion Performance Summary`, `GCards Trends`, and `Property GC per AU`, but these pages are currently stored as evidence text/page rows rather than fully structured performance-analysis metrics.
- Authority posture: this packet supplies marketing/source/conversion/inventory-pressure context; Data Pond and official feeds remain authoritative for occupancy, leased %, lease count, cancellations/denials when official files exist, unit-level availability, concessions, and stale-unit aging.

### DataForSEO SERP Source Route ✅
- DataForSEO is now wired as a governed live-SERP evidence source for Spotlight, Captain's Log, and Search Intelligence.
- Source contract: `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`
- Collector: `/Users/mark/Property_Analytics/Data_Collection/utils/dataforseo_serp_ingest.py`
- Local schema: `/Users/mark/Property_Analytics/apps/api/migrations/0032_create_dataforseo_serp_tables.sql`
- Remote D1 schema: `/Users/mark/Property_Analytics/infra/migrations/019_create_dataforseo_serp_tables.sql`
- Tables: `dataforseo_serp_runs`, `dataforseo_serp_results`, and `dataforseo_property_keyword_rankings`.
- Enrichment tables added: `dataforseo_keyword_metrics`, `dataforseo_labs_ranked_keywords`, `dataforseo_onpage_page_snapshots`, `dataforseo_business_profiles`, and `dataforseo_ai_visibility_probes`.
- Initial April Spotlight load on 2026-04-28 used active `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`, loaded 23 property brand SERPs, stored 574 normalized result rows, found the target domain/path for 17 of 23 properties, and cost `$0.0805`.
- Location enrichment is now available for DataForSEO keyword generation. The collector can produce local-market keyword candidates such as `apartments in Bentonville AR`, `Bentonville apartments`, `luxury apartments Bentonville AR`, and `pet friendly apartments Bentonville AR` through the property identity resolver.
- Deep trial runner: `/Users/mark/Property_Analytics/scripts/run_dataforseo_spotlight_deep_trial.py`. The runner now supports property-scoped keyword fallback, explicit keyword additions, and a custom AI prompt so it can test Captain questions without borrowing another property's keyword universe.
- The 04/29/2026 AR4PB focused fact-finding run proved Keyword Data, DataForSEO Labs, OnPage, Business Data, Backlinks, direct AI response probes, and LLM Mentions as useful Captain/Spotlight enrichment lanes. Backlinks and LLM Mentions trial subscriptions are active and callable.
- Backlinks for AR4PB returned page rank `37`, `61` backlinks, `55` referring domains, and `0` broken backlinks. Backlink detail pulls returned notable sources including `pointebentonville.com`, `talkbusiness.net`, and `arkansas.primereviewz.com`.
- LLM Mentions for AR4PB returned valid responses but a meaningful distinction: direct ChatGPT response probing mentioned The Pointe for Walmart Home Office apartment recommendations, while LLM Mentions did not show The Pointe embedded in broader generic Bentonville apartment topic memory.
- Focused Pointe spend after the Backlinks and LLM Mentions trials were active was approximately `$0.5245`; remaining DataForSEO balance after the run was `$49.039147`.
- Deep trial report: `/Users/mark/Property_Analytics/reports/dataforseo/deep_trial/2026-04-28/AR4PB/dataforseo_deep_trial_report.md`.
- 04/29/2026 fact-finding report: `/Users/mark/Property_Analytics/reports/dataforseo/fact_finding/2026-04-29/AR4PB/pointe_dataforseo_captain_fact_finding_2026-04-29.md`.

### Property Identity Matrix ✅
- Canonical matrix: `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
- Builder: `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`
- Remote community snapshot refresh: `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`
- Validator: `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`
- Resolver: `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- Governance doc: `/Users/mark/Property_Analytics/docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md`
- Policy: property code is the visible / Captain-facing property id when available; GA4, GSC URL, app `community_id`, website URL, Encasa short name, GBP location id, company id, unit count, and aliases resolve through the matrix.
- Current matrix coverage: 93 properties, 91 with property codes, 93 with app/D1 community ids, 93 with city/state, and no validator errors.
- Location enrichment on 2026-04-28 backfilled the local `properties` table to 93/93 city/state coverage using GBP location city plus property-code / Encasa-region / Spotlight-registry state evidence. The identity matrix now carries `city` and `state`, and `resolve_property_identity()` exposes those fields.
- First enforcement points: `Data_Collection/utils/marketing_bi_conversion_ingest.py` and `Data_Collection/utils/marketing_bi_packet_ingest.py` now resolve property identity through the matrix instead of hardcoded The Pointe exceptions.
- Expanded enforcement points: `Data_Collection/utils/available_unit_interest_ingest.py`, `Data_Collection/utils/operating_metrics_ingest.py`, `apps/api/scripts/operating_metrics_to_d1.py`, and `apps/api/scripts/captain_sources_to_d1.py` also resolve through the matrix.
- Governance check: `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh` validates the matrix, requires full community-id coverage, and verifies required resolver usage. `AGENTS.md` now requires property-scoped ingestion, Captain reads, report inputs, and automations to use the matrix rather than local property maps or hardcoded ID bundles.
- The Pointe currently resolves as `AR4PB` / GA4 `482958962` / GSC URL `https://venterraliving.com/apartments/the-pointe-bentonville/` / Captain community id `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`.

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
- DataForSEO API credentials
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
- DataForSEO credentials are now stored in Keeper under `DataForSEO API Credentials`; helper path `/Users/mark/Property_Analytics/utils/dataforseo_auth.py`, verification path `/Users/mark/Property_Analytics/scripts/check_dataforseo_auth.py`, and active notation mapping in `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`. Live auth verification returned DataForSEO status code `20000`.
- Guest card harvest is active again by default (`GUEST_CARD_HARVEST_SUSPENDED=0` unless explicitly overridden); canonical guest card ingest resumed from the OneDrive drop on 2026-04-15 and advanced `guest_card_metrics` through `2026-04-15` for 91 properties
- The shared Guest_Card_Reports drop is also now caught up for pilot BI snapshots through `2026-04-15` via `pilot_control_cwv/scripts/ingest_bi_export_snapshot.py` for 2026-04-08, 2026-04-10, 2026-04-13, and 2026-04-15 workbooks
- BI workbook harvest is now part of the canonical morning collection path: `Data_Collection/utils/bi_manual_ingest.py` discovers `BI-Metrics-RunYYYYMMDD.xlsx` files in the shared Guest_Card_Reports drop, `daily_master_collection.py` ingests pending snapshots during the daily routine, and `retry_incomplete_collections.py` re-checks the drop later in the morning for late-arriving BI workbooks without creating a separate scheduler
- The same shared drop still has a lagging Measurement workbook: `Measurement_Dashboard_1.1.xlsx` currently only contains daily sheets through `4.11.26`, so `measurement_daily_metrics` is now freshest at `2026-04-11` and cannot advance further until that workbook itself is updated upstream
- After the guest card / BI catch-up on `2026-04-15`, the real D1 mirror succeeded again in `apps/api/scripts/generated/d1_mirror_report_20260415_143256.json`; local recency now includes `guest_card_metrics.run_date=2026-04-15`, and same-day closure evaluates `complete` with `queue_depth=0`
- Historical retry debt is now archived automatically by the retry worker: unresolved queue items for past dates are marked `exhausted` with reconciliation notes, so old days stop presenting as live queue debt
- Daily closure semantics are now split between live operations and historical governance: current-day closure can still be `open` / `blocked` / `complete`, while past dates now evaluate `archived` once outside the retry window, with unresolved source gaps preserved as informational context rather than pretending old debt is still an active live incident
- Closure output now also includes `advisory_sources` for non-core lanes such as BI, Measurement, PSI, GSC URL inspection, SEMrush, GBP, and Cloudflare cache audit so Watchtower/API consumers can see governance breadth without forcing every advisory source to block the daily summary lane
- Watchtower now renders that richer closure payload too: structured unresolved-source reasons, `archived` historical closure state, `blocked` live closure state, and an advisory-governance panel so the operator surface reflects broader governance posture instead of only the narrow core closure lane
- Pilot morning CWV recovery note for 2026-04-20: the pilot workflow failed at the `Homepage audit evidence` stage after GTMetrix and PSI had already completed because a single-property Chrome LCP probe for Calais Midtown hit a transient remote disconnect; same-day reruns of homepage evidence, GTMetrix/PSI exports, merged evaluation, and pilot roundup all succeeded, recovery mail was sent, and `pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py` now retries per-property transient probe failures before treating the whole stage as failed
- D1 mirror incident note for 2026-04-20: the real mirror succeeded at `06:29 CDT`, but a later same-day rerun failed at `07:37 CDT` on Wrangler refresh-token auth (`Failed to fetch auth token: 400 Bad Request`); `generate_morning_full_report.py` and `Data_Collection/monitoring/alert_sender.py` now prefer a successful same-day mirror report over a later failed rerun, and `run_daily_health_report.sh` now exports the same Keeper/Cloudflare runtime envelope as the collection stack so summary/report workflows do not depend on stripped launchd defaults
- The pilot morning wrapper at `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh` now also has a true stage-level remediation loop for homepage audit evidence (`MAX_HOMEPAGE_ATTEMPTS=3`) and an explicit intentional-failure guard so deliberate stage failures no longer cascade into a second misleading `Bootstrap / Shell` alert from the Bash `ERR` trap
- Site Content homepage rendering is now partially normalized from the live page HTML on read for the first two key homepage content sections, so the editor can show the real `Welcome to <Property>` intro block and `Apartment Features` / `Stylish Living Spaces` block with the correct title hierarchy, CTA labels, one-image split layout, and quieter content-first presentation even when the stored extracted section rows are still imperfect
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
- Zero Trust browser auth hardening on 2026-04-23 tightened the shared login substrate without widening scope into PIB or unrelated product lanes: browser bootstrap now logs structured Cloudflare Access verification failures, rejects invalid JWTs even when an email header is present, optionally enforces a configured Access AUD via `CLOUDFLARE_ACCESS_AUD`, uses exact frontend-origin parsing for redirect/cookie behavior, returns distinct session failure codes (`NO_SESSION`, `SESSION_UNKNOWN`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `USER_INACTIVE`), treats malformed magic-link tokens as `invalid_token` instead of 500s, and moved `/v1/auth/login` plus `/v1/auth/magic-link` off the per-isolate in-memory limiter onto a D1-backed shared limiter table
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

## Session: May 4, 2026 - May Spotlight Captain Activation

**Status:** Complete
**Primary areas:** `/Users/mark/Property_Analytics/Spotlight_Properties_Report/`, `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`

### What changed

- Built the May Spotlight source list as a structured monthly file with:
  - `property_name`
  - `market`
  - `designation`
- Created:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/May_2026_Spotlight_Properties.csv`
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_import_names_2026-05.csv`
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-05.json`
- `create_monthly_config.py` now supports structured CSV input and writes `source_name`, `market`, and `designation` into the monthly Spotlight config.

### Property identity / Spotlight resolution updates

- Added Spotlight-safe resolution so May shorthand names map without changing canonical names:
  - `Grove West` → `Avasa Grove West`
  - `Metropolitan` → `The Metropolitan`
  - `College View` → `College View Apartments`
  - `Hammock Landing` → `Avasa Hammock Landing`
  - `Riverbend` → `Riverbend`
  - `South Shore` → `South Shore Lakes`
  - `Fairways` → `Fairways at South Shore`
- Kept the prior shorthand support for:
  - `Pointe` → `Pointe at Bentonville`
  - `Thomas Glen` → `The Reserves of Thomas Glen`
  - `Elation` → `Elation at Grandway West`

### Captain activation changes

- `scripts/standup_captain_roster.py` no longer hardcodes the April monthly config; it now resolves the newest monthly Spotlight config automatically.
- Captain activation payloads and manifests now include:
  - `designation`
  - `market`
  - `source_label`
- The activation script now supersedes older Spotlight activation memory for the same property and retires removed Spotlight support lanes so prior months do not continue to run as active Spotlight Captains.

### Artifacts and runtime outcome

- Generated roster artifacts:
  - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-05-04.sql`
  - `/Users/mark/Property_Analytics/reports/captains_log/activation/captain_activation_roster_2026-05-04.json`
- Remote D1 May Spotlight Captain activation was applied in chunked mode for all 19 May Spotlight properties.
- May Spotlight roster size:
  - `19` properties
  - `209` active support-lane rows seeded/updated for the May run

### Important operating rule

- Future monthly Spotlight Captain activation should follow this order:
  1. Build the structured monthly Spotlight file with `property_name`, `market`, and `designation`
  2. Generate the monthly Spotlight config and import-name matrix
  3. Run `scripts/standup_captain_roster.py --spotlight --apply-remote`
  4. Do not add one-off downstream property maps when the identity matrix or Spotlight resolver can own the mapping

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

### 2026-05-04 - Pilot roundup default now includes twin cohort and bottom archetype reference

- Extended the default roundup generator:
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- New default report shape now adds:
  - third KPI row = twin-property metrics
  - compact same-region twin tables under each pilot + sister grouping
  - bottom `Main Pilot Reference` section for the separate archetype site
- Twin mappings now baked into the default roundup:
  - District -> Gateway North / The Villages at Oakleaf / Luma Headwaters
  - Champions Green -> Tree Park / The Maddox / Villas at Newnan Crossing
  - The Harrison -> Tree Park / Apex West Midtown / Tuscany at Lindbergh
  - Calais Midtown -> The Delta Pearland / Fairways at South Shore / Highpark
  - Ventana -> Avasa at 1604 / Park on Wurzbach / Westover Oaks
- The separate bottom reference currently uses a live PSI read from:
  - `https://pilot.venterradev.com/`
- The originally provided host `https://pilot.venterrradev.com/` did not resolve locally, so the report now records that fallback note directly in the rendered reference section.
- Supporting documentation updated:
  - `/Users/mark/Property_Analytics/pilot_roundup/README.md`

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

### 2026-04-21 - SEO proof brief now supports explicit custom date windows

- Extended `/Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py` so the specialty PIB-style SEO brief can accept `--start-date` and `--end-date` instead of only a rolling latest-30-day window.
- The sender now:

### 2026-04-22 - Selected-property CWV T30 report added

- Added `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py` as a specialty CWV sender for curated property lists without touching locked PIB files.
- The report uses canonical `pagespeed_metrics` mobile PSI data, computes current versus T30 averages for PSI, LCP, CLS, and TBT, and writes artifacts to `/Users/mark/Property_Analytics/reports/selected_cwv_t30/`.
- Current report behavior is explicit about two important constraints:
  - GTMetrix is excluded because canonical GT coverage only exists for the 10-property pilot cohort.
  - Per-property stale latest-date exceptions are called out when a selected community has no same-day PSI row even though the portfolio has a newer report date.
- Built-in shorthand normalization currently supports aliases such as:
  - `Apex` -> `Apex West Midtown`
  - `Retreat` -> `The Retreat`
  - `Northbridge` -> `Northbridge at Millenia Lake`
  - `Spring Branch` -> `Avasa Spring Branch`
  - `Townhomes` -> `Townhomes at Lake Park`
  - `Oakleaf` -> `The Villages at Oakleaf`
  - `Baywood` -> `Preserve at Baywood`
- Verified:
  - `python3 -m py_compile /Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py`
  - `python3 /Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py`
- The report was then simplified by request and this is now the remembered default layout:
  - KPI row only shows `Current Avg PSI`, `T30 Avg PSI`, and `Avg Current LCP`
  - property list keeps only `Current PSI`, `T30 PSI`, `Current vs T30`, `Current LCP`, `T30 LCP`, and `LCP vs T30`
  - removed extra KPI cards, removed `CLS`, removed `TBT`, removed `Coverage Days`, removed `requested as ...` helper text, and removed the section status chip
- Reusable operator notes now live in `/Users/mark/Property_Analytics/reports/selected_cwv_t30/README.md`

### 2026-04-27 - Lease-up vs pilot PIB-style performance brief added

- Added `/Users/mark/Property_Analytics/scripts/send_lease_up_vs_pilot_performance_brief.py` as a specialty PIB-style sender for comparing a curated lease-up set against the current pilot-property performance benchmark without touching locked PIB renderer/template/sender files.
- The workflow packages:
  - PIB-style HTML email via `/Users/mark/Property_Analytics/utils/pib_email_shell.py`
  - Excel companion workbook with summary, current lease-up PSI/GT runs, raw pilot benchmark rows, derived pilot averages, historical T30 context, and raw 30-day PSI/GA4/GSC tabs where canonical data exists
- Default current execution uses the same-day captured lease-up comparison set so delivery is not blocked by GTMetrix queue latency; `--live` remains available for fresh reruns.
- Operator notes now live in `/Users/mark/Property_Analytics/reports/property_evaluation/lease_up_vs_pilot_pib/README.md`

### 2026-04-27 - Pilot CWV recipient split clarified

- Routine pilot CWV summary deliveries now include both:
  - `mlaufhutte@venterraliving.com`
  - `cgriffin@venterraliving.com`
- This applies only to:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_data_exports_email.py`
  - `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_pilot_roundup_email.py`
- Pilot failure/recovery/alert traffic remains Mark-only and should never add Chris unless explicitly requested.

### 2026-04-22 - PSI collection accounting corrected for mobile CWV truth

- Root cause found for recent selected-property CWV coverage gaps: `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py` was marking a property as a successful PSI collection when either `mobile` or `desktop` wrote, while downstream CWV reporting depends on `mobile` specifically.
- This produced overstated `data_collections` PSI success counts and allowed desktop-only days to look complete even when the mobile PSI history had holes.
- Fixed behavior:
  - collection success now requires `mobile_success`
  - desktop-only outcomes are recorded as partial failures with explicit notes
  - collection summaries now expose `desktop-only` and `mobile-only` partial counts
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/collection_monitor.py` now supports explicit per-property outcome overrides so partial/failed PSI writes are not silently recorded as success
- Concrete examples from `2026-04-22` before the fix:
  - `Cendana District West` had only `desktop`
  - `Villa Lago` had only `desktop`
  - `Calais Midtown` had only `desktop`
- Verified:
  - `python3 -m py_compile /Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py /Users/mark/Property_Analytics/Data_Collection/monitoring/collection_monitor.py`
  - compares the requested window against the immediately preceding matched-length window
  - caps the effective end date to the latest available canonical GSC date when the user asks for a range through a later calendar date
  - renders unavailable YoY windows as `N/A` instead of misleading zero-valued baselines
- Current operational example:
  - requested window `2026-04-15` through `2026-04-21`
  - effective canonical GSC window `2026-04-15` through `2026-04-18`
  - latest canonical GSC date available on this machine: `2026-04-18`
- Verified:
  - `python3 /Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py --start-date 2026-04-15 --end-date 2026-04-21 --no-send`

### 2026-04-21 - Canonical selected-property GSC historical backfill runner added

- Added `/Users/mark/Property_Analytics/scripts/backfill_selected_gsc_window.py` as a narrow, canonical GSC backfill path for targeted historical recovery without relying on the legacy `Portfolio_Monitoring` backfill scripts.
- The runner:
  - loads the canonical five-property SEO proof set by default
  - resolves requested names to canonical registry records
  - queries GSC using the registry `gsc_url`
  - writes through `Data_Collection.db.database_manager.DatabaseManager.insert_gsc_daily_metrics(...)`
  - supports `--dry-run` before any write
- Applied historical backfill for `2025-04-15` through `2025-04-21`:
  - `Townhomes at Lake Park`: 7 returned rows
  - `The Pointe Bentonville`: 2 returned rows
  - `Fairways at South Shore`: 0 returned rows
  - `Elation at Grandway West`: 0 returned rows
  - `The Anatole`: 0 returned rows
- Current interpretation:
  - the YoY gap was partially recoverable from live GSC history for 2 of the 5 requested properties
  - no alternate historical URL in current accessible GSC properties produced April 2025 rows for the remaining 3 properties during this repair pass
- Verified:
  - `python3 /Users/mark/Property_Analytics/scripts/backfill_selected_gsc_window.py --start-date 2025-04-15 --end-date 2025-04-21 --dry-run`
  - `python3 /Users/mark/Property_Analytics/scripts/backfill_selected_gsc_window.py --start-date 2025-04-15 --end-date 2025-04-21`
  - `python3 /Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py --start-date 2026-04-15 --end-date 2026-04-21`

### 2026-04-21 - Daily PIB-style copy change impact brief added for April 17 intervention tracking

- Added `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` as a specialty PIB-style daily quick-read report for the five April 17, 2026 copy-change properties.
- The brief is intentionally not a YoY report. Instead it tracks:
  - first full post-change `GSC` window vs matched pre window
  - first full post-change `GA4 Organic Search` window vs matched pre window
  - per-property quick-read status (`Early Positive`, `Early Mixed`, `Early Softness`)
  - concise evidence bullets explaining what moved and how to read it
- Current comparison design:
  - excludes `2026-04-17` because the copy changes happened in the afternoon
  - `GSC` currently compares `2026-04-18` vs `2026-04-16` because canonical GSC freshness is only through `2026-04-18`
  - `GA4 Organic Search` currently compares `2026-04-18` through `2026-04-20` vs `2026-04-14` through `2026-04-16`
- Current purpose:
  - daily stakeholder quick read
  - understandable directional evidence instead of a data dump
  - designed to mature as more post-change days accumulate
- Verified:
  - `python3 /Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py --no-send`

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

### 2026-04-20 - Site Content Creator shifted from audit console toward visual editing workbench

- Refactored `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` away from the repeated mapping/assessment/rewrite stack that front-loaded machine-readable diagnostics.
- The default Site Content flow is now closer to the actual content job:
  - choose a property
  - choose a page
  - view a page-like canvas of recognizable sections
  - select one section
  - rewrite that section
- Added a page canvas that uses live section order plus Specs section identity to render recognizable page mocks:
  - hero bands
  - split text/image sections
  - gallery-style blocks
  - reviews/testimonial treatments
  - CTA bands and visible button treatments
- CTA buttons/links are now surfaced directly in the page mock and current-copy panel instead of being buried in scoring or metadata.
- Specs inputs now drive the visible editing model more directly through expected section labels, roles, and CTA-oriented section identity, while detailed rationale and assessment stay behind `Show Specs and diagnostics`.
- The live read model now also carries section-level image URLs for key normalized homepage blocks, so the canvas can render the actual section imagery instead of generic placeholders when the source HTML exposes a definitive image.
- Multi-state homepage switchers are now being rendered as one parent content section with stacked variant panels instead of separate unrelated blocks, which keeps tabbed/live-variant content editable as one recognizable unit for content authors.
- This is a deliberate UX correction:
  - Site Content should read like a content-editing workbench for humans
  - not like a system audit console that leaks every available machine detail into the primary scene

### 2026-04-20 - Site Content page selection simplified to a single page chooser

- Simplified `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` again after live operator review showed the page-card gallery was still noisy and unclear.
- Replaced the page-board card wall with a single page dropdown so the editor path is now:
  - choose property
  - choose page
  - recognize the page mock
  - click a section
  - edit only that section
- Removed a layer of page-level posture chrome from the default scene:
  - no page gallery cards
  - no page-level rewrite counters or Specs-gap badges in the selection step
  - quieter selected-page header before the page mock begins
- Simplified the page mock and selected-section frame so the primary surface now emphasizes:
  - section position on page
  - recognizable section treatment
  - current copy
  - new copy
- Site Content is still not at the final desired fidelity, but it is now materially closer to a human page editor and further away from a monitoring dashboard.

### 2026-04-21 - Site Content default scene simplified again toward a human editing surface

- Continued simplifying `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` after live user review made it clear the surface was still too machine-oriented.
- The primary screen is now intentionally just:
  - property selector
  - page selector
  - refresh snapshot action
  - a single centered page canvas
  - one selected-block editor
- Removed the last major top-level platform chrome from the default scene:
  - no Inventory / Brief Intelligence tabs
  - no hero metric cards
  - no page-card gallery wall
  - no current-crawl stats in the main editing view
- Kept governed brief context available, but moved it behind a collapsed `Show governed inputs` panel so content editors can ignore it unless they need it.
- The page canvas itself is now the primary object:
  - page reference screenshot shown when a browser-renderable Specs screenshot exists
  - page sections rendered as stacked, page-like mocks instead of compact diagnostics cards
  - section selection now answers “where am I on the page” more directly through visual order and simpler location language
- The section editor remains intentionally sparse:
  - current copy
  - new copy
  - save rewrite
  - additional status/specs/assessment behind `Show content details`

### 2026-04-21 - Site Content page board removed and section editor flattened further

- Continued the same human-first correction in `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`.
- Removed the remaining old page-board / page-gallery render path from the Site Content scene so page selection is controlled only by the dropdown selector instead of a large secondary page wall.
- Flattened the selected-page scene so the content editor no longer leads with workflow or system framing:
  - removed the old page-summary slab
  - removed the old editing-flow slab
  - removed active-block dashboard framing
  - kept the page mock and selected section as the primary objects
- Simplified the selected-section editor again so the main scene is:
  - current copy
  - new copy
  - save rewrite
- Moved the remaining status / rewrite brief / guidance / specs / rationale / assessment material behind `Show content details` so content editors are not forced to read system metadata before editing copy.
- This is still not the final desired fidelity, but it is a direct correction toward a recognizable content workbench instead of a content-plus-diagnostics console.

### 2026-04-21 - Site Content main scene flattened again after live review

- Continued simplifying `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx` after more live user review showed the page mock still carried too much tool framing.
- Removed the visible page-header slab above the selected page mock so the scene now leads with the page itself instead of app chrome.
- Removed the visible rewrite-status selector from the primary editor and moved it back into `Show content details`.
- The main editing scene is now more strictly:
  - page mock
  - selected section title
  - current copy
  - new copy
  - save rewrite

### 2026-04-21 - Site Content default scene reduced to selectors plus page

- Simplified the Site Content root scene again in `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`.
- Removed the large marketing-style hero from the default editing surface.
- Moved both:
  - refresh depth
  - governed inputs / Captain brief context
  into `Advanced controls` so content editors do not need to scan that information before they can choose a page and start editing.
- The default scene is now closer to:
  - property selector
  - page selector
  - refresh snapshot
  - page mock
  - selected section editor

### 2026-04-21 - Homepage benefits switcher now corrected from live contract

- Tightened homepage Site Content accuracy in:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
  - `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- The `Get the Most From Where You Live` switcher is no longer treated as a generic interpreted block group.
- The API now normalizes the three homepage switcher variants from the live homepage HTML:
  - `Pet-Friendly Fun`
  - `High-Tech Living`
  - `Live Easy Perks`
- Each variant now carries exact live title/body/bullet/CTA data where applicable, and the web canvas renders them against the screenshot-driven stacked-tab composition instead of a guessed gallery-style abstraction.
- Placeholder imagery remains in use for the canvas so content editors can recognize the layout without the editor depending on live images.
- The switcher renderer now also takes its tab identity from the API response instead of guessing from body copy, and the shared switcher chrome has been reduced to one title only; the editor no longer shows a second shared tab row beneath that title, and switcher variants are selected from the full mapping set so stacked states are not dropped just because of mapping visibility.
- The homepage benefits switcher now also carries nested off-canvas / drawer content in the API response, so Site Content can render each tab as a full editing surface: main panel plus inline detail panels for pet-policy depth, the high-tech day narrative, and the live-easy perks accordion content.

### 2026-04-21 - Copy Change Impact Brief tightened to true PIB quick-read shape

- Refined `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` after operator feedback.
- Removed top-of-email explanatory copy and section-header framing that made the brief feel like a report dump instead of a PIB quick read.
- The specialty brief now opens with only three neutral outline KPI cards:
  - `Early Positive`
  - `Early Mixed`
  - `Early Softness`
- Property sections now remain focused on day-prior directional trend rows with arrows, color, and stat, which is the intended lightweight daily read for monitoring April 17 copy-change impact.
- The same specialty brief now also includes a compact comparison-depth strip inside each property card so operators can see:
  - current cumulative post-change depth by source
  - matched pre-window directional change since the copy update
  - `T7`, `T14`, and `T30` readiness as `Live` or `Pending`
- This keeps the PIB quick-read format while avoiding false precision before enough post-change history exists.

### 2026-04-27 - Copy Change Impact Brief now uses matched unchanged control cohorts

- Extended `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` so the daily copy-impact brief no longer compares only against each property’s own history.
- Each target property now gets a matched unchanged Venterra control cohort chosen from canonical data using:
  - pre-change GA4 Organic sessions
  - pre-change GSC impressions
  - unit-count similarity
  - and same-state / property-type / site-type preference when metadata exists
- The brief now surfaces:
  - a `Vs Controls` chip inside each property card
  - the exact matched control-property names used for that property
  - bottom notes that explain the audience selection method
- This turns the brief from pure directional self-comparison into a more defensible early impact read that can partially separate copy effects from normal portfolio noise.

### 2026-04-28 - Copy Change Impact Brief window bug fixed for GSC post-change depth

- Fixed a window-construction bug in `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` where the GSC post-change end date was incorrectly pinned to `POST_START`.
- Before the fix, the brief always showed `GSC D1`, which forced `T7` to remain `Pending` even after enough post-change history existed.
- After the fix, the brief uses the true latest available canonical GSC date, so readiness panels now correctly show `T7 Live` once shared post-change depth reaches seven days.

### 2026-04-28 - Copy Change Impact Brief property set expanded to six

- Added `Forest View` to the default property list in `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`.
- Updated the daily heartbeat automation prompt so scheduled runs now include `Forest View` too.
- Fixed the bottom brief summary so counts scale with the current property total instead of assuming a hardcoded five-property set.

### 2026-05-02 - Copy Change Impact Brief simplified and T7/T14 made data-rich

- Removed the matched-control cohort section from the rendered daily copy-impact brief at operator request.
- `Vs Controls` and the per-property matched-control footer line are no longer shown in the email.
- Reworked `T7` and `T14` cards to show actual matched-window performance summaries instead of simple readiness labels:
  - `T7` now shows a real 7-day post-change vs matched pre-change read when enough data exists
  - `T14` now shows the fullest available matched-window summary, including partial-depth reads when fewer than 14 shared post-change days exist
- This keeps the brief denser on direct evidence and removes the extra comparison layer that was not wanted in the email surface.

### 2026-04-22 - PSI collector missing-day and false-success behavior corrected

- Investigated operator report that PSI/PageSpeed was missing full dates while still appearing successful.
- Root cause was two-part:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py` always wrote `data_collections.status='completed'` even when properties were incomplete.
  - PSI only runs after GA4, GSC, GSC URL inspection, and Google Ads in `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`, so if the master collector dies earlier, PSI never runs and no same-day PSI record exists.
- Canonical fix now in place:
  - PSI run status is now derived honestly:
    - `completed` only when all properties have both mobile and desktop data
    - `partial` when only part of the portfolio is complete
    - `blocked` when the run starts but cannot collect any complete property set
  - the master collector now reads back the actual PSI run row instead of reducing the subprocess to a binary success/fail guess
  - same-day PSI source retries are now part of `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- Historical reconciliation also applied to live `data_collections`:
  - prior PSI rows with `status='completed'` and non-zero failures were corrected to `partial`
  - this keeps past operator reporting from continuing to lie after the code fix
- Historical PSI backfill policy is now explicit:
  - missing `pagespeed_metrics.metric_date` rows are real gaps unless dated raw PSI snapshots exist
  - rerunning `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py --date <old-day>` is not a valid historical backfill because the PSI API returns current results and the script stamps them with the supplied date
  - enterprise-safe response is to preserve the gap, document it, and prevent recurrence through same-morning retries rather than fabricate historical PSI history

### 2026-04-22 - POP Brief Pond import and backup paths restored to working state

- Repaired the POP Brief weekly-metrics import flow inside The Pond without touching locked PIB generation/rendering files.
- `/Users/mark/Property_Analytics/apps/api/src/routes/metrics.ts` now supports the documented POP Brief contract again:
  - `POST /v1/metrics/import/paste` accepts pasted TSV text and resolves `community_external_key` to active communities
  - `POST /v1/metrics/import/upload` accepts uploaded CSV/TSV files, stores the source artifact in `POP_BRIEF_UPLOADS`, and executes the same replace-import pipeline with `import_runs` tracking
  - numeric coercion now normalizes percent-style values like `95%` to decimal storage for weekly metrics fields
- `/Users/mark/Property_Analytics/apps/web/src/app/metrics-import/page.tsx` is no longer the broken scaffold that posted `{ tsv }` into a `{ rows }`-only API shape; it now offers a Pond-native TSV paste and CSV upload workflow against the repaired backend contract.
- `/Users/mark/Property_Analytics/apps/api/src/routes/exports.ts` now creates real backup artifacts in `POP_BRIEF_UPLOADS` and returns the object key, and `/Users/mark/Property_Analytics/apps/web/src/app/backup/page.tsx` now reports that artifact key after export.
- Added focused regression coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/metrics-import-and-backup.test.ts` for:
  - TSV paste import
  - CSV upload import + R2 artifact write
  - backup artifact creation
- Verification completed:
  - `npm run test:platform` in `apps/api`
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - POP Brief analysis page realigned to canonical analysis contract

- Corrected the highest-value POP Brief parity drift in The Pond without touching locked PIB generation/rendering files.
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` no longer assembles the visible POP Brief out of `t7_metrics`, `t30_metrics`, and `marketing_data`.
- The page now fetches `/v1/analysis` through `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`, which anchors the operator-facing brief on the documented canonical POP Brief model:
  - `weekly_metrics` for T7/T30 community + portfolio metrics
  - `marketing_weekly` for weekly marketing context
- The Pond POP Brief surface now renders:
  - canonical T7 and T30 comparison tables
  - overview KPI cards based on `weekly_metrics`
  - `marketing_weekly` leads / CPL / spend / notes / mention inputs
  - canonical metric notes from the weekly metrics records
- Added route coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/analysis-route.test.ts` so the API contract now has regression protection for the web surface that depends on it.
- Verification completed:
  - `npm run test:platform` in `apps/api`
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - POP Brief marketing workflow moved onto canonical marketing_weekly model

- Corrected the next major POP Brief parity gap in The Pond by replacing the old `marketing_data` editing surface with a first-class `marketing_weekly` workflow.
- `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now operates directly on the canonical POP Brief contract:
  - loads `GET /v1/marketing`
  - saves via `PATCH /v1/marketing/:id`
  - triggers `POST /v1/marketing/scan-mentions`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes typed helpers for:
  - `getMarketingWeekly`
  - `upsertMarketingWeekly`
  - `scanMarketingMentions`
- The Pond marketing page now supports:
  - canonical leads / CPL / ad spend editing
  - canonical `mentions_json` editing from a human-friendly line-based input
  - canonical `notes_text` editing
  - mention scan execution and visible processed / sent / duplicate-suppressed results
- Added regression coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-route.test.ts` for:
  - marketing record upsert against `marketing_weekly`
  - deduped mention-scan notification creation
- Verification completed:
  - `npm run test:platform` in `apps/api`
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - Base44 Spotlight Website & SEO CSV ingest restored in the Pond

- Investigated operator parity question using the real Base44 export `/Users/mark/Downloads/Spotlight_Properties_20260422_113046.csv`.
- Confirmed the file is not a `weekly_metrics` import; it is the Base44 Spotlight / Website & SEO CSV shape that targets the legacy `marketing_data` Website & SEO fields.
- The API already retained the legacy compatibility route at `/v1/marketing-data/import/website-seo`, but the Pond UI no longer exposed it after the marketing page was moved onto canonical `marketing_weekly`.
- Restored the Base44-compatible ingest lane in `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx`:
  - accepts the exact Base44 Spotlight Website & SEO CSV shape
  - parses client-side CSV with quoted-cell support
  - normalizes `MM/DD/YYYY` dates like `04/24/2026` to `2026-04-24`
  - previews parsed rows before import
  - posts the parsed payload to the legacy `/v1/marketing-data/import/website-seo` route
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now also exposes the full Website & SEO import result shape including row errors.
- This means the Pond now once again accepts the same Spotlight Website & SEO CSV family the Base44 app is currently processing, while preserving the newer canonical `marketing_weekly` workflow beside it.
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - Communities management parity restored in the Pond UI

- Closed the communities-management parity gap without touching authentication behavior, which remains intentionally aligned to Cloudflare Zero Trust rather than the original app.
- `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` is no longer a read-only list; it now provides:
  - create community
  - edit community
  - soft-delete community
- The page is wired to the already-existing governed API routes in `/Users/mark/Property_Analytics/apps/api/src/routes/communities.ts`.
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes:
  - `createCommunity`
  - `patchCommunity`
  - `deleteCommunity`
- This removes one of the clearest previously confirmed Base44 parity misses on the writable surfaces side.
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - Base44 parity ledger established

- Added `/Users/mark/Property_Analytics/docs/POP_BRIEF_BASE44_PARITY_LEDGER_2026-04-22.md` as the working source of truth for Base44 parity status.
- The ledger now separates:
  - `matched`
  - `intentionally_different`
  - `needs_verification`
  - `open_gap`
- Current accepted deviations are explicit:
  - authentication on Cloudflare Zero Trust
  - home-grown user provisioning / admin model
- Current closed business-surface parity fixes are also explicit:
  - weekly metrics import
  - backup artifacts
  - canonical analysis contract
  - marketing weekly + mention scan UI
  - Base44 Website & SEO CSV ingest lane
  - communities management UI
- Remaining proof work is now narrowed primarily to:
  - PIB output parity only if operator wants that audited under guardrails

### 2026-04-22 - T7/T30 leasing metrics promoted to matched parity status

- Verified that the T7/T30 leasing metrics lane is not carrying the feared portfolio/community drift.
- The apparent oddity in the Pond UI and router behavior is actually inherited Base44 behavior:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0010_create_t7_metrics.sql`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0011_create_t30_metrics.sql`
  both define `community_id` as required even when `type='portfolio'`
  - `/Users/mark/Property_Analytics/apps/api/scripts/guest_cards_to_d1.py` explicitly creates one duplicated portfolio row per community for both T7 and T30
- That means the Pond’s T7/T30 pages are aligned with the imported Base44 storage/query pattern rather than drifting away from it.
- Updated the parity ledger to promote:
  - T7 metrics workflow → `matched`
  - T30 metrics workflow → `matched`
- Search Intelligence was also reclassified as an intentional Pond adjunct rather than a required Base44 POP Brief parity surface.

### 2026-04-22 - POP Brief landing page now exposes the Base44 navigation set

- Tightened POP Brief operator parity by making the main Pond `/analysis` page expose the same core navigation family visible in the Base44 left rail.
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now includes a dedicated POP Brief navigation board with direct links for:
  - Communities
  - T7 Metrics
  - T30 Metrics
  - Marketing Data
  - Analysis
  - Backup & Export
- The same board also keeps the Base44 slots visible for:
  - Call Notes
  - Profile
  while leaving them as explicit placeholders until real routes are mounted.
- `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` was also renamed back to the Base44-style `Marketing Data` heading so the Website & SEO import lane is easier to find from operator screenshots and muscle memory.
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - Base44 navigation corrected onto the actual PIB dashboard

- Operator validation showed the previous navigation fix landed on the wrong front door.
- The real main PIB Brief screen in the Pond is `/Users/mark/Property_Analytics/apps/web/src/app/pib/page.tsx`, not `/analysis`.
- Corrected that parity miss by adding the Base44-style workflow board directly to `/pib`, with visible entries for:
  - Communities
  - T7 Metrics
  - T30 Metrics
  - Marketing Data
  - Analysis
  - Backup & Export
  - Call Notes placeholder
  - Profile placeholder
- This means the core left-rail workflow from Base44 is now visible from the actual PIB dashboard the operator lands on, not only from the analysis workspace.
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run build` in `apps/web`

### 2026-04-22 - Website & SEO importer now resolves Base44 shorthand community names

- Operator validation on the live-style Spotlight Website & SEO CSV surfaced one remaining parity gap:
  - the Pond importer accepted the file shape, but still failed exact-name matching for shorthand Base44 community labels like `1604`, `Oakleaf`, and `Whitney`
- Corrected `/Users/mark/Property_Analytics/apps/api/src/routes/marketing-data.ts` so the Website & SEO import route now resolves communities by:
  - canonical `name`
  - `external_key`
  - `encasa_short_name`
  - explicit Base44 shorthand aliases for:
    - `Avasa at 1604` ↔ `1604`
    - `The Villages at Oakleaf` ↔ `Oakleaf`
    - `The Whitney` ↔ `Whitney`
- Added regression coverage in `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-data-import.test.ts`.
- Verification completed:
  - `npm run test:platform -- marketing-data-import.test.ts marketing-route.test.ts` in `apps/api`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - Marketing operator UI hierarchy strengthened

- Operator feedback surfaced a UX problem on the restored Marketing surface:
  - actions, buttons, inputs, and informational panels were all reading at the same visual weight
  - the page felt monochrome and low-signal even though the workflow itself was functioning
- Corrected the UI hierarchy in:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/button.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/input.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/textarea.tsx`
- Key visual changes:
  - stronger primary / secondary / outline button contrast with shadow and hover lift
  - clearer field affordances for inputs and textareas
  - section framing for import, collaboration, narrative, and final workflow actions
  - step-based emphasis so upload/import and save/scan read as distinct operator actions
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - POP Brief opens on upcoming Friday with Spotlight-scoped property defaults

- Reduced operator friction on the main POP Brief surface without changing the underlying business workflows.
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now:
  - defaults the date picker to the upcoming Friday
  - restricts the property dropdown to the active April 2026 Spotlight list
  - auto-selects the first Spotlight property when the page opens
- The Spotlight property order now comes from:
  - `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`
- `/Users/mark/Property_Analytics/apps/web/src/components/shared/community-selector.tsx` now also accepts a caller-supplied community list so the POP Brief page can preserve the Spotlight order instead of resorting the full portfolio alphabetically.
- Added `/Users/mark/Property_Analytics/apps/web/src/lib/spotlight-properties.ts` to centralize:
  - upcoming-Friday calculation
  - Spotlight list ordering
  - Spotlight alias matching for community resolution
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - POP Brief header simplified into sticky controls plus navigation menu

- Continued the operator-friction cleanup on the main POP Brief page without altering the report logic itself.
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now:
  - uses a sticky top control bar
  - removes the old `Export PDF` and `Update` buttons from the main header
  - replaces them with a single `Navigate` dropdown that exposes POP Brief routes and adjacent workflow entry points
- This keeps the date/property controls dominant while still making movement across the POP Brief lane accessible from the header.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - POP Brief duplicate navigation board removed after sticky-header rollout

- Operator review confirmed the next UX issue immediately after the sticky header shipped:
  - the page still repeated navigation a second time through the large `POP Brief Navigation` card below the header
  - that made the top of the screen feel redundant and delayed the operator from getting straight into the selected property brief
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now removes that duplicate navigation board entirely.
- The sticky header `Navigate` dropdown remains the single primary movement control for the POP Brief lane, so the page now opens directly into the selected property content.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - POP Brief date picker popover made opaque and self-closing

- Operator review surfaced two finishing issues on the sticky header controls:
  - the calendar popover was visually translucent against the brief content below
  - the picker stayed open after selecting a Friday, which made the interaction feel clunky
- Corrected the shared UI behavior in:
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/week-date-picker.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/popover.tsx`
- The date picker now:
  - renders on an opaque white elevated surface
  - closes immediately after a valid Friday selection
  - uses a more reliable trigger marker for outside-click handling
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - Communities page reordered around Spotlight-first review

- Operator workflow feedback clarified that the Communities page should no longer lead with property creation.
- `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` now:
  - removes the `Add Community` section entirely from the page
  - introduces a `This Month's Spotlight Properties` block first, using the same ordered monthly Spotlight set already used by POP Brief
  - keeps the exhaustive governed portfolio list below as `All Communities`
  - preserves edit/delete actions on the exhaustive list so maintenance is still available without making creation the default workflow
- This keeps the page aligned to actual operator behavior: review the current Spotlight set first, then manage the full list only when needed.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - Marketing page aligned to POP Brief header defaults and legacy import tucked away

- Continued the POP Brief workflow cleanup by bringing the Marketing page into the same header/default pattern as the main brief.
- `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now:
  - defaults to the upcoming Friday
  - scopes the property selector to the active monthly Spotlight list and auto-selects the first Spotlight property
  - uses a sticky header/control bar so the key date/property controls stay consistent with POP Brief
  - moves the Base44 Website & SEO CSV importer behind a collapsed legacy-import accordion instead of letting it dominate the opening screen
- This preserves the current import capability while making canonical weekly marketing editing the primary workflow and treating CSV import as a secondary bridge until direct Data Pond ingest replaces it.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - Marketing page corrected back to the sectioned Base44 editor under the newer header treatment

- Follow-up operator review clarified that the simplified weekly-marketing page had drifted too far from the actual live Base44 workflow.
- The live app’s real core marketing surface is the sectioned `marketing_data` editor built around:
  - Advertising
  - Property Performance
  - Guest Cards per Door
  - Website & SEO
  - Marketing Projects
  - Reputation & Social
  - Pricing Strategy
- Corrected `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` so it now:
  - restores that sectioned Base44-style editor shape
  - keeps the newer sticky header treatment
  - keeps the upcoming-Friday default and Spotlight-scoped community default
  - keeps the legacy Website & SEO CSV import available as a collapsed bridge utility
- This brings the page back toward the live Base44 operator model while preserving the newer workflow defaults and cleaner page-top behavior.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-22 - T7 and T30 metrics pages aligned to the shared POP Brief header/default pattern

- Continued the operator-flow cleanup by applying the same verified defaults to the shared leasing metrics surface used by both `/t7-metrics` and `/t30-metrics`.
- `/Users/mark/Property_Analytics/apps/web/src/components/metrics/leasing-metrics-page.tsx` now:
  - uses the same sticky header/control-bar treatment already adopted by POP Brief and Marketing
  - defaults the week selector to the upcoming Friday
  - scopes the community selector to the active monthly Spotlight list
  - auto-selects the first Spotlight property when the page opens without an active selection
  - exposes the same `Navigate` header control used elsewhere in POP Brief and removes the leftover top-row `Update` / `Clear Data` buttons
- This does not change the import/edit capabilities themselves; it removes repeated setup clicks so T7/T30 screens open in the same operator context as the rest of the POP Brief lane.
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-23 - POP Brief title block refined to the final operator-facing copy/layout

- Applied the requested finishing pass to the main POP Brief header in `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx`.
- The title block now:
  - includes the POP Brief icon directly beside the title
  - stacks the date and property selectors above the `Navigate` control
  - uses the operator-facing subtitle `Property Operations Performance Brief`
  - places `by MarketingOps` on its own smaller, lighter line underneath
- This is a presentation refinement rather than a workflow change, but it matters because the POP Brief page header is now the primary identity anchor for the restored Base44-style lane.
- Verification completed:
  - `npm run build` in `apps/web`

### 2026-04-23 - Data Pond branding and POP Brief header state reconciled into one current frontend slice

- Operator review surfaced that the live app was showing a mixed frontend state:
  - the richer Data Pond landing/sidebar branding existed in the local frontend files
  - only part of the newer POP Brief header work had actually been promoted to `main`
- Reconciliation work is now complete in the local frontend slice:
  - `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` retains the richer Data Pond landing hero and featured-surface treatment
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` retains the larger branded Data Pond sidebar treatment with `By MarketingOps`
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/pop-brief-page-header.tsx` is now the shared POP Brief header shell for Analysis, Marketing, and T7/T30
  - the shared header now places the date and property selectors on one line, with `Navigate` on the next line aligned right
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` keeps the Base44 sectioned marketing editor, but each section is now a true accordion closed by default
- Verification completed:
  - `npm run build` in `apps/web`

### 2026-04-23 - Editor role narrowed to The Pond plus the POP Brief lane

- Operator direction clarified that the `editor` role should behave as a tightly-scoped POP Brief operator rather than as a broad multi-surface curator.
- The current boundary is now:
  - `editor` can access The Pond home page
  - `editor` can access the POP Brief lane (`/analysis`, `/communities`, `/t7-metrics`, `/t30-metrics`, `/marketing`, `/backup`)
  - `editor` cannot access the rest of the platform offerings
- This now exists in both permission layers:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`
- The sidebar still renders the full left navigation for orientation, but inaccessible editor destinations now appear as locked/dead links through `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`.
- The web shell now enforces the same path-level boundary and shows a governed restricted-state card for out-of-scope routes instead of silently allowing editors into non-POP surfaces:
  - `/Users/mark/Property_Analytics/apps/web/src/components/app-shell.tsx`
- Verification completed:
  - `npm run build` in `apps/web`
  - `npm run typecheck` in `apps/api`

### 2026-04-24 - POP Brief grounding core foundation added

- Operator direction shifted POP Brief from UI parity toward a highly accurate property-brief / Captain's Log grounding substrate.
- Added `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md` to define the source authority hierarchy, claim model, reconciliation statuses, artifact-block model, and The Pointe Bentonville pilot observations.
- Added durable D1 schema foundations without touching locked PIB generation/rendering files:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0024_create_property_brief_grounding_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/011_property_brief_grounding.sql`
- Added shared contracts for source documents, claims, reconciliations, and artifact blocks:
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-schemas.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/index.ts`
- Updated POP Brief docs so the grounding core is now part of the governed POP Brief architecture:
  - `/Users/mark/Property_Analytics/POP_Brief/README.md`
  - `/Users/mark/Property_Analytics/POP_Brief/05_Data_Model.md`
  - `/Users/mark/Property_Analytics/POP_Brief/06_API_Contract.md`
- Grounding rule now explicit: Data Pond remains authoritative for internal operational facts; AptIQ/ApartmentIQ-style reports are advisory market/comps intelligence.
- Verification completed:
  - `npm run typecheck` in `packages/shared`
  - SQLite migration smoke test for `0024_create_property_brief_grounding_tables.sql`
  - `bash scripts/check_pib_guardrails.sh`

### 2026-04-24 - Captain operating model and The Pointe pilot tasking created

- Operator direction clarified that the Captain should become responsible for seeking, ingesting, reconciling, and summarizing property data on cadence, with eventual Supervisor updates.
- Added `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md` as the canonical role model for the property-scoped Captain.
- Added `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md` as the first pilot tasking for The Pointe Bentonville Captain.
- Updated `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md` to reference the Captain role and pilot tasking.
- Updated `/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md` so the Intelligence Office relationship to the Captain is explicit:
  - Data Pond remains canonical fact truth
  - Captain owns property-scoped operating intelligence and memory
  - Captain's Log captures durable decisions, watch items, and evidence-backed summaries
  - Supervisor updates are the eventual decision/escalation path
- The Pointe Captain's initial watch scope is A1/B1 inventory pressure, applicant follow-up, concession leakage, lease/cancellation reconciliation, reputation-source separation, and floorplan-specific content/action readiness.

### 2026-04-24 - Property Evaluation Brief source-of-truth standard and reusable template added

- Operator direction confirmed the The Pointe report should become a solid source of truth and reusable template for future briefs.
- Added `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md` to define the publishing standard:
  - source authority ladder
  - required evidence domains
  - required brief sections
  - source authority posture
  - action register requirements
  - decision register requirements
  - Captain's Log payload standard
  - publishing gate
- Added `/Users/mark/Property_Analytics/reports/property_evaluation/templates/property_evaluation_resolution_brief_template.md` as the reusable Markdown template for future property evaluation and resolution briefs.
- Updated `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md` to point to the new source-of-truth standard and reusable template.
- Updated `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_property_evaluation_resolution_brief_2026-04-24.md` so it is explicitly tied to the template standard.

### 2026-04-24 - The Pointe unit-level concession feed confirmed

- Operator clarified that concession visibility exists in the unit-level feed.
- Verified Data Pond stores the full ThirtyLines floorplan payload in `unit_availability.available_units_json`; The Pointe's 2026-04-24 payload includes `pricingAndSpecialsMessage` on returned available-apartment units.
- The Pointe's current public unit-level specials language is now treated as confirmed from Data Pond rather than missing:
  - `Up to $3000.00 off first full month's rent on select units`
  - 36 current returned units and 23 future-dated returned units carried the message in the parsed 2026-04-24 payload.
- Updated the grounding core, Captain operating model, property evaluation standard, The Pointe Markdown brief, and The Pointe PIB-style email artifact so the remaining concession routing task is booked concession dollars from the Pond lease/revenue feed, not whether the active offer is visible.

### 2026-04-24 - ThirtyLines feed ingestion hardened to raw plus unit-level snapshots

- Tightened `/Users/mark/Property_Analytics/Data_Collection/collectors/thirtylines_collector.py` so ThirtyLines ingest now writes three layers:
  - raw full-feed snapshots in `thirtylines_feed_snapshots`
  - existing floorplan summaries in `unit_availability`
  - normalized unit-level rows in `unit_availability_units`
- Added D1/local migration files:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0025_thirtylines_unit_feed_snapshots.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/012_thirtylines_unit_feed_snapshots.sql`
- Added `/Users/mark/Property_Analytics/docs/THIRTYLINES_FEED_INGESTION_2026-04-24.md` as the ingestion contract.
- The first hardened run on 2026-04-24 wrote 92 feed properties seen, 91 mapped, 905 mapped floorplans, 2,858 normalized unit snapshots, and 2,074 units with specials language.
- The Captain can now query unit-level public concession visibility directly from `unit_availability_units`; booked concession dollars on signed leases should be rendered from the Pond lease/revenue feed.

### 2026-04-24 - Property Evaluation Brief expanded to full Pond operating chain

- Operator clarified that Property Evaluation / Captain briefs must consider all relevant Pond perspectives, not only AptIQ, guest cards, inventory, and concessions.
- Updated The Pointe Bentonville report to add a holistic operating chain:
  - GSC query visibility
  - GA4 sessions, channel engagement, and high-intent events
  - PSI / PageSpeed mobile and desktop experience
  - Google Ads spend/keyword read with freshness warning
  - GBP profile actions, reviews, and sentiment themes
  - guest-card funnel
  - unit availability, unit specials, and aged-unit validation
- Updated `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md` so The Pointe Captain now watches the full Pond chain weekly.
- Updated `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md` so the reusable standard requires a Full Pond Operating Chain and includes site experience plus digital action path as preferred evidence domains.

### 2026-04-24 - Property Evaluation Brief tone corrected to source-authoritative posture

- Operator clarified that the The Pointe brief must read as an authoritative operating narrative, not as uncertain prose asking teams to re-prove data already present in the Pond.
- Updated the property evaluation standard to replace generic confidence posture with source authority posture:
  - source-of-record
  - public-state
  - advisory
  - routing gap
  - unresolved conflict
- Updated The Pointe Markdown report, PIB-style email artifact, and Captain tasking so occupancy, leased percentage, lease count, cancellation count, and booked concession dollars are described as Pond operating values to render into the Captain brief, not as facts to manually confirm when the Pond source exists.
- Reinforced the core rule: AptIQ advises; Data Pond governs; routing gaps are composition work, not uncertainty statements.

### 2026-04-24 - The Pointe Google Ads state verified as inactive, not stale

- Ran a targeted live Google Ads API check for The Pointe Bentonville (`property_id=482958962`, customer `9089267423`) on 2026-04-24.
- The 2026-03-20 to 2026-04-23 check window returned one campaign-day record on 2026-03-20 and no campaign activity after that date.
- The campaign `1185 Pointe Bentonville MKT PPC` was paused on 2026-03-20.
- Updated The Pointe report, email artifact, and Captain tasking so paid media posture reads as paused/no-activity after 2026-03-20 rather than stale data.

### 2026-04-24 - The Pointe Captain named and PIB-family presentation rules tightened

- Assigned the The Pointe Bentonville property Captain identity as `Captain Benton`.
- Updated The Pointe report, email artifact, and Captain tasking so the visible property ID is the property code `AR4PB` rather than the internal numeric source id.
- Updated user-facing report dates to `MM/DD/YYYY`.
- Updated the email header toward the PIB-family visual treatment and changed the guest-card KPI label to `Guest Cards`.
- Added presentation rules to the Property Evaluation Brief source-of-truth standard so future Captain briefs use PIB-style headers, property-code IDs, named Captain identity, operator-facing unit references, and `MM/DD/YYYY` dates.

### 2026-04-24 - Captain's Log and Captain's Brief report set formalized

- Operator direction confirmed the property operating artifact should be memorialized as a recurring report/email set.
- Naming rule is now explicit:
  - `Captain's Log` = durable property memory, decisions, watch items, evidence references, and follow-up state
  - `Captain's Brief` = polished outbound read generated from the log plus current Pond facts
- Added `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md` as the naming and publishing standard.
- Added `/Users/mark/Property_Analytics/reports/captains_log/templates/captains_log_entry_template.md` as the reusable log-entry template.
- Created the first The Pointe / Captain Benton set:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_log_2026-04-24.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_brief_email_2026-04-24.html`
- This set is orchestration-only around the locked PIB family: it reuses PIB-style discipline but does not mutate canonical PIB generators or templates.

### 2026-04-24 - Captain Benton shared memory and support agents stood up

- Promoted the first The Pointe / Captain Benton entry from file-only report artifacts into the local shared D1 memory substrate.
- Added Captain support-agent schema:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0026_create_captain_support_agents.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/013_create_captain_support_agents.sql`
- Added shared type/schema support for `CaptainSupportAgent` in:
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-schemas.ts`
- Added The Pointe seed and support-agent roster:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_memory_seed_2026-04-24.sql`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_support_agents_2026-04-24.md`
- Local D1 now contains:
  - one governed memory entry: `mem_ar4pb_captain_benton_20260424_001`
  - Captain identity binding: `Captain Benton`
  - five evidence references
  - five source documents
  - eight grounded property-brief claims
  - four claim reconciliations
  - one reusable `captain_log_update` artifact block
  - six active support agents: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, and Supervisor Scribe
- Remote D1 promotion was applied through the repo's Keeper-backed Wrangler runtime helper.
- Remote verification confirmed:
  - Captain identity binding now resolves cleanly to `Captain Benton`
  - six active support agents exist for `AR4PB`
  - eight property-brief claims exist for `AR4PB`
  - five evidence refs exist for `mem_ar4pb_captain_benton_20260424_001`

### 2026-04-24 - Captain runtime foundation added to the app Worker

- Added live Captain runtime persistence:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0027_create_captain_runtime_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/014_create_captain_runtime_tables.sql`
- Added Worker runtime/orchestration code:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
- Added `/v1/captain` routes for:
  - Captain property status
  - manual support-agent runs
  - Captain Brief / Supervisor Read run creation
- Added API Worker cron triggers in `/Users/mark/Property_Analytics/apps/api/wrangler.toml` for daily and weekly Captain runtime execution.
- Applied the runtime migration to local D1 and remote `pop-brief-db`.
- Verification completed:
  - `npm run typecheck` in `apps/api`
  - `npm run typecheck` in `packages/shared`
  - `npx wrangler deploy --dry-run --outdir /tmp/pop-brief-api-captain-dry-run`
- Production API Worker deploy completed through the Keeper-backed Wrangler runtime helper.
- Cloudflare deploy output:
  - Worker: `pop-brief-api`
  - URL: `https://pop-brief-api.mlaufhutte.workers.dev`
  - Version ID: `1c2633b7-0dad-44c5-b14b-05dfb63b3014`
  - Schedules: `15 12 * * *` and `45 13 * * 1`
- Post-deploy verification confirmed:
  - public `/health` returns `{"status":"ok","version":"1.0.0"}`
  - remote `pop-brief-db` contains `captain_agent_runs`, `captain_watch_items`, `captain_actions`, and `captain_brief_runs`

### 2026-04-25 - Remote D1 reconciled for Captain Benton source reads

- Captain Benton's first scheduled run proved the Worker was active but remote D1 lacked the source-level rows his agents read directly.
- Added `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` as a narrow Captain source-table mirror for selected properties.
- Reconciled `AR4PB` / `482958962` source rows into remote `pop-brief-db`:
  - `guest_card_metrics`: 406 rows, latest `2026-04-24`
  - `unit_availability_units`: 114 rows, latest `2026-04-25`
  - `ga4_daily_metrics`: 61 rows, latest `2026-04-24`
  - compact remote `gsc_daily_metrics`: 218 rows for The Pointe community, latest `2026-04-22`
  - `google_ads_campaigns`: 12 rows, latest `2026-03-20`
  - `pagespeed_metrics`: 95 rows, latest `2026-04-25`
  - `gbp_daily_insights`: 49 rows, latest `2026-04-23`
- Updated Captain runtime GSC reads so Benton can handle both raw source-shaped GSC rows and the existing remote app-shaped `gsc_daily_metrics` table keyed by `community_id`.
- Updated Source Scout so a paused Google Ads campaign is treated as `paused_no_current_activity`, not a stale source-routing failure.
- Redeployed `pop-brief-api`; current Captain-runtime version ID is `82eed1a9-3c68-459e-a491-b902dc9683ed`.
- Manual API verification after reconciliation:
  - `benton_funnel_watch`: success
  - `benton_media_watch`: success
  - `benton_source_scout`: success with no missing or stale sources
  - `benton_inventory_watch`: warning because real A1/B1/365+ day unit pressure exists
  - `benton_truth_reconciler`: warning because one grounded claim remains a formal source conflict around booked concession dollars

### 2026-04-25 - First clean live Captain Brief run created

- Resolved stale remote D1 watch/action rows from the pre-reconciliation Captain run:
  - `watch_AR4PB_source_freshness`
  - `watch_AR4PB_unit_feed_missing`
  - `watch_AR4PB_guest_cards_missing`
  - `action_AR4PB_resolve_source_routing`
- Reclassified the two prior `needs_review` Captain claims:
  - Guest Card coverage is now `pond_verified`
  - booked concession dollars remain a formal `conflict` until the lease/revenue source-of-record is routed into the Captain lane
- Re-ran `benton_supervisor_scribe` through the deployed Worker:
  - run id `captain_run_AR4PB_benton_supervisor_scribe_20260425202039_90a125a9`
  - status `success`
  - open watch items now reflect real operating content: A1 pressure, B1 pressure, 365+ day units, and the booked-concession source conflict
- Created the first clean live Captain Brief run:
  - id `captain_brief_AR4PB_20260425202040_b9ac1686`
  - property `AR4PB`
  - period `2026-03-26` to `2026-04-25`
  - status `draft`
  - source authority: Data Pond governs internal facts; vendor reports advise
- This confirms Captain Benton is live as a Worker-backed operating-intelligence role, with source mirror, memory, support-agent runs, durable watch/actions, and brief-run persistence all active in remote D1.

### 2026-04-25 - Captain Brief read model and app surface added

- Added a first-class live Captain Brief read endpoint:
  - `GET /v1/captain/properties/:propertyId/brief/latest`
  - implementation: `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
  - route: `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
- Added the app read surface:
  - `/analysis/captain`
  - implementation: `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`
- The read model now composes the persisted Captain Brief run with current D1 truth:
  - Captain identity
  - period and source authority
  - active watch items and actions
  - resolved source-routing items
  - latest source dates
  - actual aged inventory buckets
  - unit-number aged inventory detail with floorplan, rent, move-out date, available date, days unleased, public specials text, and parsed concession amount
- Live API verification against remote `pop-brief-api` confirmed:
  - brief id `captain_brief_AR4PB_20260425202040_b9ac1686`
  - source dates: Guest Cards `2026-04-24`, unit feed `2026-04-25`, GA4 `2026-04-24`, GSC `2026-04-22`, Ads `2026-03-20` with `paused_no_current_activity`, PSI `2026-04-25`, GBP `2026-04-23`
  - aged buckets: 38 at 30+ days, 33 at 60+ days, 25 at 90+ days, 17 at 180+ days, 4 at 365+ days
  - first aged units include 303, 302, 101, 105, and 202
- Deployed `pop-brief-api`; current version ID is `1aa6d6e7-7610-455d-9f6e-44b219532338`.

### 2026-04-25 - Operating metrics source route added for booked concessions

- Investigated the available local sources for official lease/revenue/booked-concession truth.
- Findings:
  - local canonical DB has public concession eligibility in `unit_availability_units`
  - local canonical DB does not currently have a lease/revenue/booked-concession source table for AR4PB
  - `BI-Metrics-Run20260424.xlsx` and `BI-Metrics-Run20260423-NewFormat.xlsx` are pilot metric exports and do not include The Pointe / AR4PB rows
  - `Measurement_Dashboard_1.1.xlsx` has pilot measurement sheets, not The Pointe operating lease/revenue facts
- Added the source-of-record landing contract:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0028_create_property_operating_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/015_create_property_operating_metrics.sql`
- `property_operating_metrics` is intended to hold official occupancy, leased percentage, lease count, cancellations/denials, move-ins/move-outs, and booked concession dollars from the true operating source feed.
- Updated the Captain Brief read model and `/analysis/captain` to include an Operating Snapshot lane.
- Applied the remote D1 migration and redeployed `pop-brief-api`; current version ID is `728fd38d-07fd-481f-a97a-acec4bb60ba8`.
- Live route verification confirms AR4PB now reports:
  - `operatingSnapshot.status = missing_source`
  - `sourceNeeded = property_operating_metrics`
  - message: official occupancy, leased percentage, lease count, cancellations, and booked concession dollars are not yet routed into the Pond operating metrics table
- This keeps the Captain Brief authoritative: public offer visibility remains Pond-verified from the unit feed, while booked concession dollars remain unresolved until the lease/revenue source populates `property_operating_metrics`.

### 2026-04-26 - Operating metrics intake lane added

- Added `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py` as the controlled intake path for official operating metrics.
- The importer accepts CSV/XLSX/XLSM source files, normalizes common header variants, and writes `property_operating_metrics` locally with optional remote D1 upsert.
- Supported facts include occupancy, leased percentage, occupied/leased/available/total units, lease count, cancellations, denials, move-ins, move-outs, booked concession dollars, and booked concession lease count.
- Updated `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` so `property_operating_metrics` is included in the Captain source-table mirror whenever local rows exist.
- Verification confirmed the importer parses percentage/date/money fields correctly and the current Captain mirror still reports `property_operating_metrics: 0` for AR4PB until the true operating source file is provided.

### 2026-04-27 - Operating metrics cadence wired into daily collection

- Added `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py` as the Data Collection wrapper for official operating-metrics drop discovery and pending-file ingest.
- The morning collector now runs `property_operating_metrics` after BI workbook ingest and before ThirtyLines availability, using the same `data_collections` bookkeeping pattern as the manual BI lane.
- The retry worker now detects late-arriving operating-metrics files, queues a source-level `property_operating_metrics` retry, and ingests pending files during same-morning retry cycles.
- Watchtower/advisory freshness now recognizes `property_operating_metrics` as a same-day manual source backed by `property_operating_metrics.metric_date`.
- Verification confirmed no current operating-metrics files are present in the shared drop, temp-file ingest writes normalized rows correctly, and dry-run retry output shows a single canonical `property_operating_metrics` advisory lane.

### 2026-04-27 - Operating metrics source contract and missing-file escalation

- Added the official operating metrics source contract:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md`
- Contract highlights:
  - monitored drop: shared `Guest_Card_Reports`
  - recommended filename: `Property-Operating-Metrics-AR4PB-YYYYMMDD.csv`
  - required columns: `Property Code`, `Report Date`, `Occupancy`, `Leased %`, `Total Units`, `Leases`, `Cancellations`, and `Booked Concession Dollars`
  - `Report Date` maps to `property_operating_metrics.metric_date`
- Data Collection now records a blocked manual dependency when no operating metrics file is received:
  - `No official operating metrics file received for AR4PB.`
- The retry worker preserves that missing-file condition instead of resolving it as harmless no-pending-file state.
- This makes the official operating lane hard to starve: Benton should not substitute AptIQ-estimated operating values when the source-of-record file is missing.

### 2026-04-27 - Available Unit Interest BI report processed

- Processed `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Available Units With Low Inquiries.pdf`.
- Added source contract:
  - `/Users/mark/Property_Analytics/docs/AVAILABLE_UNIT_INTEREST_SOURCE_CONTRACT_2026-04-27.md`
- Added landing schema:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0029_create_available_unit_interest_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/016_create_available_unit_interest_metrics.sql`
- Added parser/ingest helper:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/available_unit_interest_ingest.py`
- Local ingest loaded 21 report rows into `available_unit_interest_metrics`; the 2026-04-27 The Pointe row maps to `AR4PB`.
- The Pointe values from the report: 452 unit count, 55 available units, 37 vacant available, 18 notice available, 12.2% available, 40 T7 guest cards, 0.7 T7 guest cards per available unit, -14.9% T7 guest-card delta, 166 T30 guest cards, 3.0 T30 guest cards per available unit, +15.3% T30 guest-card delta, 96 T7 prospect quotes, +4.3% T7 quote delta, 316 T30 prospect quotes, and +5.7% T30 quote delta.
- Updated `apps/api/scripts/captain_sources_to_d1.py` so the AR4PB available-unit-interest row is mirrored into remote D1 with the rest of Benton’s source packet.
- Remote Captain source sync completed and reported `available_unit_interest_metrics: 1`.
- The Marketing BI screenshot also surfaced adjacent future source lanes: T365D Move-ins with Mktg Source, Traffic Conversions, Property Cancel/Denial by Mktg Source, WOW Program Spending, SmartDesk 2.0, and Value Proposition Dashboard.

### 2026-04-28 - Marketing BI conversion PDFs processed

- Processed:
  - `/Users/mark/Downloads/Property CancelDenial by Mktg Source.pdf`
  - `/Users/mark/Downloads/Traffic Conversions T7D-T90D.pdf`
- Added source contract:
  - `/Users/mark/Property_Analytics/docs/MARKETING_BI_CONVERSION_SOURCE_CONTRACT_2026-04-28.md`
- Added landing schema:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/017_create_marketing_bi_conversion_sources.sql`
- Added parser/ingest helper:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_conversion_ingest.py`
- Local ingest loaded 24 The Pointe rows into `marketing_cancel_denial_by_source` and 1 The Pointe summary row into `marketing_traffic_conversions`.
- The cancel/denial report shows Website source summary at 2 C&Ds, 82 applications, and 61 guest cards; Google Ads source summary at 1 C&D, 4 applications, and 4 guest cards.
- Reason-level rows show cancellation concentration in `Abandoned` and denial concentration in `Failed Credit or Criminal`, especially Website and Google.
- Traffic conversions show Pointe at 100.0% assigned for T7D/T30D, 40 T7D guest cards versus 37 PY (+8.1%), 166 T30D guest cards versus 71 PY (+133.8%), and 307 T60D guest cards versus 71 PY.
- Updated `apps/api/scripts/captain_sources_to_d1.py` so both marketing conversion tables mirror into remote D1 for Benton.
- Remote Captain source sync completed and reported `marketing_cancel_denial_by_source: 24` and `marketing_traffic_conversions: 1`.

### 2026-04-28 - Property identity matrix foundation added

- Added the governed property identity matrix:
  - `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
  - `/Users/mark/Property_Analytics/docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md`
  - `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`
  - `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- The matrix is built from `data/portfolio_analytics.db:properties`, `config/venterra_properties_official.json`, and `apps/api/scripts/generated/04_insert_communities.sql`.
- Current coverage: 93 properties, 91 property codes, 55 local app community ids, and validator status clean.
- Marketing BI conversion and daily packet ingesters now use the shared resolver, so The Pointe and future properties map through one governed identity source instead of hardcoded per-ingester exceptions.
- Validation confirmed current Marketing BI conversion dry run maps all 12 visible Traffic Conversion rows and all 25 current cancel/denial rows, with The Pointe resolving to `AR4PB` plus `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`.

### 2026-04-28 - Property identity matrix made required for source work

- Updated `/Users/mark/Property_Analytics/AGENTS.md` with Property Identity Discipline:
  - source ingestion, Captain reads, report inputs, and property-scoped automations must resolve via `Data_Collection/utils/property_identity.py`
  - new source identifiers must be added to the matrix generation path instead of handled as downstream exceptions
  - `bash scripts/check_property_identity_governance.sh` is required for property-identity-impacting work
- Added governance check:
  - `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.py`
  - `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh`
- Expanded resolver usage to:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/available_unit_interest_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`
- `captain_sources_to_d1.py` now accepts `--property-key` and resolves property code, GA4 id, and community id from the matrix by default.
- `operating_metrics_to_d1.py` now accepts `--property-key` and matches operating-source rows against matrix aliases rather than a single hardcoded property-name/code pair.
- Validation confirmed Available Unit Interest maps visible property rows through the matrix, including `Pointe -> AR4PB`, `West 46th -> TN4WS`, `Anatole -> FL4TA`, `Creekside -> OK4CS`, `Lakeside -> OK4BL`, and `Parker -> OK4TP`.

### 2026-04-28 - Property identity community lane completed

- Pulled remote D1 `communities` into `/Users/mark/Property_Analytics/config/generated/remote_communities_snapshot.json`.
- Added `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py` so the snapshot can be refreshed through the Keeper-backed Wrangler runtime.
- Updated `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py` to merge the remote community snapshot before falling back to the older local generated seed.
- Found one active coded property missing from remote D1 communities: `Retreat at Kedron Village` (`GA4KV`, GA4 `378387143`).
- Seeded that community into remote D1 with community id `b535df1b-ab66-53bc-9223-c748dd500acc`, then refreshed the snapshot and rebuilt the matrix.
- Current matrix now covers 93 properties with 93 app/D1 `community_id` values and 91 property codes. The two properties without property codes are prelaunch/non-standard communities without operating property codes in the local `properties` table.
- Updated identity governance to fail if community-id coverage falls below matrix property count.

### 2026-04-29 - Marketing BI packet exports consumed and conversion summary structured

- Processed three additional 04/29/2026 Marketing BI full-packet exports:
  - `/Users/mark/Downloads/Portfolio Summary.pdf`
  - `/Users/mark/Downloads/Ad Spend.pdf`
  - `/Users/mark/Downloads/conver perf summart`
- Loaded the packet headers, searchable page text, and Portfolio Summary property rows into the governed Marketing BI packet evidence tables.
- Local packet evidence now includes 9 packet rows, 265 page rows, and 333 property-summary rows; The Pointe row resolves through the identity matrix as `Pointe -> AR4PB -> 5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`.
- Added structured portfolio-level `marketing_bi_conversion_performance_summary` storage for the Conversion Performance Summary page:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0034_create_marketing_bi_conversion_summary.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/021_create_marketing_bi_conversion_summary.sql`
- Extended `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_packet_ingest.py` to parse the clean tabular Conversion Performance Summary rows into paid/all conversion counts, cost per conversion metrics, and portfolio paid-channel spend.
- The 04/28/2026 structured total row currently shows 27,073 average units, 5,035 paid guest cards, 1,234 paid visits, 482 paid applications, 304 paid leases, 39,581 all guest cards, 9,629 all visits, 4,184 all applications, 2,393 all leases, $1,698 paid cost per lease, $216 all cost per lease, $516,214 total ad spend, $385,135 Google spend, $127,587 traditional spend, $3,492 social spend, and $19.07 ad spend per door.
- Added the new structured table to `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`; remote D1 sync completed with `marketing_bi_conversion_performance_summary: 5`.
- The `Ad Spend` packet page is retained as evidence only for now because the PDF export preserves region spend as chart labels rather than a reliable property-level or region-level table. Do not use that chart to auto-fill property spend without a tabular export.

### 2026-04-29 - Spotlight Captain Brief prototype generated

- Added `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py` as a Captain-lane prototype for running the Captain Brief pattern against any resolved Spotlight property.
- The generator resolves identity through the governed property identity matrix and renders a PIB-family / Outlook-safe email artifact without mutating locked PIB files.
- The first non-Pointe Spotlight test was The Anatole / `FL4TA`.
- Evidence used for The Anatole:
  - 04/29/2026 Available Units / Low Inquiries row: 230 units, 14 available, 6.1% exposure, 32 T7 guest cards, 145 T30 guest cards, 95 T7 quotes, 654 T30 quotes
  - 04/29/2026 unit feed: 28 returned units across A3, A2, A1, and B1; 13 units at 180+ day indicators; unit-level special text says `Up to 1 month's rent free on select units`
  - GSC rows through 04/28/2026 showing strong brand clicks and weaker generic Daytona Beach positions
  - Google Ads rows through 04/20/2026 showing 117,712 impressions, 4,879 clicks, $6,476 spend, and 307 recorded conversions, with latest campaign status observed as `PAUSED`
  - DataForSEO SERP rows showing brand visibility for `The Anatole` and a missing generic `apartments in Daytona Beach FL` target in the current run
- Missing source notes rendered directly in the report:
  - no property-level structured Traffic Conversions row for The Anatole in the current export
  - no property-level structured cancel/denial row for The Anatole in the current export
  - no DataForSEO OnPage snapshot for The Anatole yet
  - no DataForSEO Business Profile / review snapshot for The Anatole yet
  - no routed source-backed social posting cadence for The Anatole
  - no tabular property-level BI ad-spend note/package-status row
- Generated artifacts:
  - `/Users/mark/Property_Analytics/reports/captains_log/spotlight/the_anatole/the_anatole_spotlight_captains_brief_2026-04-29.html`
  - `/Users/mark/Property_Analytics/reports/captains_log/spotlight/the_anatole/the_anatole_spotlight_captains_brief_2026-04-29_email_outlook.html`
- Email sent to `mlaufhutte@venterraliving.com` with message id `52afe833-3da8-4085-89fb-c33a02981052@property-analytics.local`.
- Follow-up enrichment on 04/29/2026 ran DataForSEO deep trial for The Anatole and cost `$0.144092`.
- New Anatole enrichment now available:
  - OnPage status 200; title `Apartments in Daytona Beach FL Near Volusia Mall | Anatole`; meta description length 209; word count 2,070; flagged checks include high loading/waiting time, render-blocking resources, duplicate meta tags, missing image alt/title, and low content rate
  - Google Business Profile / Business Data: claimed profile, 4.2 rating, 428 reviews/votes, 57 photos, address `1690 Dunn Ave, Daytona Beach, FL 32114`
  - Keyword demand: `apartments in Daytona Beach FL` and `Daytona Beach apartments` each show 8,100 monthly search volume with roughly $2.71 CPC and high competition
  - Labs ranked keywords show strong branded/local visibility, including several Anatole Daytona terms at rank 1
  - Backlinks summary: page rank 34, 48 backlinks, 39 referring domains, 0 broken backlinks
  - AI visibility probe mentioned The Anatole among Daytona Beach apartment options
- The Spotlight Captain Brief generator was revised so the Performance Analysis area no longer repeats `Not available`; it renders compact source-backed rows and moves true gaps to Missing Source Notes.
- Revised Anatole email sent to `mlaufhutte@venterraliving.com` with message id `56ee30b6-b59e-49cd-bc9c-a141e16c03c9@property-analytics.local`.

### 2026-04-29 - Marketing BI cancel/denial native Excel export added

- Confirmed `/Users/mark/Downloads/cancel.xlsx` is the native Power BI export for `Property CancelDenial by Mktg Source`.
- The workbook has one `Export` sheet with columns: `Region`, `Property`, `Cnc Den Type`, `Cnc Den Reason`, `Mktg Src Desc`, `C&Ds`, `Apps`, and `GCards`.
- Added Excel parsing to `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_conversion_ingest.py`; PDF parsing remains available, but Excel is now preferred for complete portfolio cancel/denial loads.
- Loaded the 2026-04-29 export locally:
  - 4,750 detail rows
  - 91 resolved properties
  - 28,481 C&Ds
  - 39,284 applications
  - 187,480 guest cards
- Identity governance confirmed all workbook property names resolve through `config/property_identity_matrix.json`; no local one-off map was added.
- The Pointe / `AR4PB` now has 25 Excel rows, 58 C&Ds, 143 applications, and 720 guest cards from this source.
- Anatole Daytona / `FL4TA` now has 60 Excel rows, 377 C&Ds, 476 applications, and 3,068 guest cards from this source.
- Updated the Spotlight Captain Brief generator so cancel/denial reads prefer the latest `.xlsx` source when both PDF and Excel files exist for the same date, preventing viewport-PDF duplicates from contaminating the read.

### 2026-04-29 - Additional Marketing BI native Excel exports loaded

- Processed seven additional native Excel Marketing BI exports from `/Users/mark/Downloads`:
  - `Ad Spend Total and Ad Spend Δ by Calendar Period (bins).xlsx`
  - `perf by src.xlsx`
  - `cancel-deny-reasons.xlsx`
  - `gift cards by source.xlsx`
  - `traffic performance.xlsx`
  - `Portfolio Summary.xlsx`
  - `Traffic Conversions.xlsx`
- Added `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py`.
- Added local/remote migrations:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0035_create_marketing_bi_excel_exports.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/022_create_marketing_bi_excel_exports.sql`
- Local load results:
  - `marketing_bi_portfolio_summary`: 91 property rows
  - `marketing_bi_ad_spend_property_month`: 182 property-month rows for February/March 2026, total spend `$516,214`
  - `marketing_bi_traffic_conversions_full`: 91 property-total rows plus responsible-agent slices where supplied
  - `marketing_bi_excel_export_rows`: 491 generic evidence rows across the smaller exports
- All named property rows in the structured Excel tables resolved through the property identity matrix; no local one-off mappings were introduced.
- The Pointe / `AR4PB` now has a full traffic-conversions Excel row showing T7 guest cards 44, T30 guest cards 176, T30 visits 48, T30 apps 36, T30 RFP 26, T30 closing ratio about 39.7%, and T30 ATR about 14.5%.
- The Pointe ad spend rows now show February 2026 spend `$3,737` and March 2026 spend `$3,438`, with March down about 8.0% from the prior month.
- Important boundary: the Portfolio Summary export's reported `Apts` field is advisory BI context and did not match the governed unit count for The Pointe; do not use that field as official unit count in Captain/PIB output.
- The Spotlight Captain Brief generator now reads full-fidelity Traffic Conversions Excel rows for visits/apps/RFP instead of displaying those performance cells as missing.

### 2026-04-29 - Marketing BI Conversion Dashboard native Excel export loaded

- Added `/Users/mark/Downloads/conversion dashboard.xlsx` to the Marketing BI Excel ingest path.
- Added local/remote migrations:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0036_create_marketing_bi_conversion_dashboard.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/023_create_marketing_bi_conversion_dashboard.sql`
- New table: `marketing_bi_conversion_dashboard_rows`.
- The 2026-04-29 local load produced 728 property/contact-type rows across 91 properties and 8 contact types.
- The Pointe / `AR4PB` now has conversion dashboard evidence by contact type:
  - Phone: 104 conversions, +42.5% vs comparison
  - Price Quote: 103 conversions, +312.0%
  - Schedule A Tour: 70 conversions, +250.0%
  - Email: 65 conversions, -23.5%
  - Chat: 45 conversions
  - Visit: 38 conversions, +123.5%
  - Apply Online: 9 conversions, +50.0%
  - Text: 5 conversions, +66.7%
- `conv per data.xlsx` is a native version of the portfolio conversion-period summary and is currently preserved in `marketing_bi_excel_export_rows`; the existing structured conversion performance summary remains the promoted period-level table.
- `converdsion by source.xlsx` appears to duplicate the earlier guest-card/source top-ten export and is retained as source evidence but should not be double-counted in Captain reads.

### 2026-05-01 - Shared-drop conversion workbooks ingested into governed Marketing BI Excel lane

- Extended `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` to recognize shared-drop conversion workbook filenames in addition to the earlier Downloads-based analyst exports.
- `conversion-data.xlsx` is now treated as a native alias of `conversion dashboard.xlsx` and is promoted into `marketing_bi_conversion_dashboard_rows`.
- `converting-performance.xlsx` and `marketing-performance.xlsx` are now preserved in `marketing_bi_excel_export_rows` as governed portfolio evidence for later promotion decisions.
- 2026-05-01 load from `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/` produced:
  - `728` structured rows in `marketing_bi_conversion_dashboard_rows` from `conversion-data.xlsx`
  - `737` generic ledger rows from `conversion-data.xlsx`
  - `107` generic ledger rows from `converting-performance.xlsx`
  - `475` generic ledger rows from `marketing-performance.xlsx`
- Property identity governance remained intact; no local property map or downstream exception was introduced.

### 2026-04-29 - Marketing BI recovery-source Excel exports loaded

- Processed the large recovery batch of native Excel BI exports covering guest-card timing, WOW spending, ad spend performance, lease terms, unfulfilled leases, skips/evictions, 30-day guarantee, paid source summaries, available units, vacancy-day unit rows, and source-share charts.
- Added local/remote migrations:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0037_create_marketing_bi_recovery_sources.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/024_create_marketing_bi_recovery_sources.sql`
- Added structured tables:
  - `marketing_bi_vacancy_days_units`: 5,087 rows; 89 properties
  - `marketing_bi_lease_term_rows`: 1,212 rows; 91 properties
  - `marketing_bi_wow_spending`: 90 rows; 90 properties
  - `marketing_bi_ad_spend_performance_month`: 364 rows; 91 properties
  - `marketing_bi_period_leakage_metrics`: 12 month rows covering unfulfilled leases, skips/evictions, and 30-day Live-It Love-It guarantee
- The Pointe / `AR4PB` ad spend performance now has:
  - January 2026: 6 guest cards, 3 visits, 0 leases, no spend shown
  - February 2026: 125 guest cards, 44 visits, 13 leases, `$3,737` spend
  - March 2026: 149 guest cards, 48 visits, 14 leases, `$3,438` spend
  - April 2026: 159 guest cards, 38 visits, 18 leases, no spend shown in the export
- The Pointe current vacancy-day evidence now includes unit-level rows such as unit `02-202` / A1 at 88 current vacancy days, `11-208` / C1 at 87, and `11-302` / B1 at 86.
- The Pointe WOW spending row shows `$220.81` spent, `$6,893.04` budgeted, and roughly 96.8% remaining.
- `Cost per Conversion by Ad Source.xlsx` and `Cost per Conversion - Trend.xlsx` contain invalid `NaN` / `Infinity` worksheet XML and cannot be read by `openpyxl`, but the ingester now falls back to direct worksheet XML parsing and treats those invalid values as nulls with an `invalid_value_count`.
- Added local/remote migrations:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0038_create_marketing_bi_cost_per_conversion.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/025_create_marketing_bi_cost_per_conversion.sql`
- New table: `marketing_bi_cost_per_conversion_rows`.
- The 2026-04-29 cost-per-conversion load produced 1,092 rows across 91 properties and flagged 2,812 invalid/non-computable exported values.
- The Pointe / `AR4PB` now has both all-period and monthly cost-per-conversion evidence, including all-period Apartments.com at roughly `$70.89` per guest card / `$95.70` per visit / `$273.43` per app / `$319.00` per lease, and all-period Google Ads at roughly `$218.22` per guest card / `$627.38` per visit / `$1,003.80` per app / `$2,509.50` per lease.

### 2026-04-29 - DataForSEO Navigator catch-up for activated Captains

- Ran governed DataForSEO catch-up for the 28 activated Spotlight/pilot Captain properties from `reports/captains_log/activation/captain_activation_roster_2026-04-29.json`.
- Broad SERP baseline:
  - 56 SERP requests
  - 43 target matches
  - observed cost `$0.196`
- Deep Navigator enrichment:
  - 28 of 28 properties succeeded
  - observed cost `$4.086497`
  - wrote per-property raw evidence and markdown reports under `reports/dataforseo/deep_trial/2026-04-29/`
  - captured keyword demand, Labs ranked keywords, OnPage page snapshots, Google Business profile/entity reads, backlink summaries in raw evidence, and AI visibility probes.
- Added D1 mirror utility:
  - `/Users/mark/Property_Analytics/apps/api/scripts/dataforseo_captain_to_d1.py`
  - mirrors only the DataForSEO Captain evidence tables rather than rerunning the full Captain source-table sync.
- Remote D1 verification for `2026-04-29`:
  - `dataforseo_serp_runs`: 60 rows / 28 properties
  - `dataforseo_serp_results`: 1,517 rows / 28 properties
  - `dataforseo_property_keyword_rankings`: 60 rows / 28 properties
  - `dataforseo_keyword_metrics`: 83 rows / 28 properties
  - `dataforseo_labs_ranked_keywords`: 560 rows / 28 properties
  - `dataforseo_onpage_page_snapshots`: 28 rows / 28 properties
  - `dataforseo_business_profiles`: 28 rows / 28 properties
  - `dataforseo_ai_visibility_probes`: 31 rows / 28 properties
- Import note: one full-file D1 import and one large SERP-results chunk hit transient Wrangler fetch failures. Schema was applied separately and row imports were completed through smaller idempotent chunks.
- Operational boundary: DataForSEO remains a Navigator/Data Collection lane. Captains consume the mirrored rows and turn them into watch items, actions, and Brief/Log judgment; Captain cron should not perform the paid external pulls directly.

### 2026-04-30 - Captain runtime catch-up and cron bucket correction

- Triggered the Captain scheduled handler after the 28-property evidence catch-up.
- Finding: a single scheduled invocation attempted too much work for the expanded roster and hit Cloudflare's per-invocation request ceiling.
- Patched `apps/api/src/platform/captain/runtime.ts` so `runScheduledCaptains` deterministically buckets active support agents instead of running the entire roster in one invocation.
- Patched `apps/api/wrangler.toml` to stay within the account's five-cron limit:
  - daily Captain buckets at `12:00`, `12:20`, `12:40`, and `13:00` UTC
  - weekly Captain bucket at `13:30` UTC Monday
- Final deployed Worker version `8dd446ae-4e92-4b9d-afde-4e73121c61ce`.
- Scheduler correction detail:
  - four daily cron slots now rotate through 16 deterministic daily agent buckets, which keeps each invocation around a safe slice of the roster
  - the Monday weekly cron rotates through 4 weekly buckets
  - the scheduled handler now awaits the bucket work directly instead of returning through `ctx.waitUntil`
- Manual runtime proof:
  - Benton / `AR4PB` ran all 10 support lanes from the new evidence and created/refreshed Navigator, experience validation, source-authority, inventory, and Boatswain follow-through actions.
  - Cane Island / `FL4CI` and Botanic Luxury / `GA4BL` also proved deployed/manual Captain execution, with source-routing and Navigator/site-content actions raised where source lanes are not yet fully mirrored.
  - Remote D1 now shows 520 Captain agent runs across all 28 activated properties, 138 updated watch items across 27 properties, and 63 updated actions across 17 properties since `2026-04-30T01:17:00Z`.
- Manual catch-up caveat: rapid manual API attempts tripped Cloudflare `1010` protection after several requests. The production fix is the bucketed cron schedule; manual fleet-wide catch-up should use scheduled buckets or an authenticated internal service trigger rather than a rapid loop of browser-protected HTTP calls.

### 2026-04-30 - Captain Avasa 1604 Spotlight Brief test

- Tested the first non-Pointe Spotlight Captain Brief path for Avasa at 1604 / `TX416`.
- Identity resolution confirmed through the governed matrix:
  - property code `TX416`
  - community id `e5a393b1-9bc0-4b99-b936-92ce80725dd0`
  - GA4 property id `426692912`
  - GSC URL `https://venterraliving.com/apartments/avasa-at-1604/`
  - unit count `424`
- Remote Captain runtime already shows Avasa active in D1 with recent agent runs, watch items, and actions.
- Fixed `/Users/mark/Property_Analytics/reports/captains_log/generate_spotlight_captains_brief.py` so the Spotlight Captain Brief generator no longer carries prototype Anatole/Daytona copy into other properties.
- The generator now:
  - uses unit-feed fallback for exposure when the structured BI Available Units / Guest Cards per Unit Type row is missing
  - uses property-neutral Admiral Read, Website / SEO Direction, Captain Read, and action-plan language
  - falls back to structured Traffic Conversions values for T7/T30 guest cards when the available-unit interest source is absent
  - records the missing available-unit interest row as an explicit source note rather than silently showing zero exposure
- Avasa 04/30/2026 output:
  - `/Users/mark/Property_Analytics/reports/captains_log/spotlight/avasa_at_1604/avasa_at_1604_spotlight_captains_brief_2026-04-30.html`
  - `/Users/mark/Property_Analytics/reports/captains_log/spotlight/avasa_at_1604/avasa_at_1604_spotlight_captains_brief_2026-04-30_email_outlook.html`
  - email sent to `mlaufhutte@venterraliving.com` with message id `9c52ec46-e4d6-4241-b685-11cec8d2035f@property-analytics.local`
- Avasa current test facts:
  - unit feed fallback: 60 available units / 14.2% exposure / 18 net-unit target gap to get below 10%
  - Traffic Conversions: 54 T7 guest cards and 234 T30 guest cards, 74 T30 visits, 27 T30 applications, 18 T30 RFP
  - unit-feed aging: 17 units at 180+ days and 33 units at 90+ days
  - DataForSEO evidence present as of 04/29/2026 for SERP, keyword metrics, Labs, OnPage, Business Profile, and AI visibility
- Remaining Avasa source gaps are real routing gaps, not generator guesses:
  - no `TX416` row in `available_unit_interest_metrics`
  - no property-level BI ad package/note route
  - no structured social cadence route
  - loss/cancel-denial coverage depends on the latest exported BI rows available for that property

### 2026-05-04 - Reputation.com routed into Captain reads

- Extended the Captain source-table D1 mirror so Reputation.com leaderboard, component, time-series, and local-competition tables are included with other Captain source rows for a resolved property identity.
- Added a Captain runtime `reputationInsight` read model from the governed `reputation_com_*` tables:
  - latest Reputation.com score, rating, response rate, review volume, and review mix
  - January-to-current and month-over-month score trend
  - score component diagnostics for listing completeness, review response, recency, sentiment, quality, volume, spread, search impressions, and social score
  - local competitor average/best score posture and gap calculation
- Added a weekly `reputation_watch` Captain support lane to the roster generator. It raises watch/actions for low score, material score decline, low response rate, elevated negative review mix, component gaps, and local competitor reputation exposure.
- Source Scout now treats Reputation.com as an expected advisory source with a 35-day freshness window, matching the export cadence rather than forcing same-week freshness.
- Verification on `AR4PB` dry run showed local Captain source SQL includes Reputation.com rows: `1` leaderboard row, `1` component row, `5` score trend rows, and `0` local competition rows for The Pointe Bentonville.
- Follow-up enrichment: the Captain source mirror now includes recent `gbp_reviews`, `gbp_review_sentiment`, and `gbp_reviews_summary` rows alongside `gbp_daily_insights`, so `reputationInsight` can blend the Reputation.com score layer with GBP resident voice, reply coverage, low-star examples, sentiment themes, and local profile action visibility.
- VP feedback on the Reputation.com brief was incorporated: the Risk Watchlist now includes a `Why It Made The List` column that names row-level trigger facts such as score under 780, response under 70%, rating under 4.00, and elevated negative review mix.

### 2026-05-04 - Marketing Operations / Flagship doctrine formalized

- Added formal doctrine artifacts in `/Users/mark/Property_Analytics/docs/`:
  - `MARKETING_OPERATIONS_CHARTER_2026-05-04.md`
  - `FLAGSHIP_OPERATING_MODEL_2026-05-04.md`
  - `CAPTAIN_DOCTRINE_2026-05-04.md`
  - `CAPTAIN_READINESS_CHECKLIST_2026-05-04.md`
- These documents formalize the operating relationship between:
  - `Marketing Operations` as the department
  - `The Flagship` as the command/operating model
  - `Captain` as the named property-scoped intelligence owner
- The doctrine standardizes:
  - department mission and authority boundaries
  - the six-step Captain method: Collect, Reconcile, Diagnose, Direct, Track, Learn
  - designation posture for `Critical`, `Spotlight`, and `Sale` properties
  - the minimum readiness standard required before a Captain is treated as fully stood up
- This is a doctrine and operating-model formalization layer. It does not replace existing Captain hierarchy or memory standards; it extends them into department-level operating guidance for MarketingOps / the Flagship.

### 2026-05-04 - Portfolio Captain fleet stood up under Flagship doctrine

- Extended `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py` so Captain activation can now stand up the full governed portfolio through a `--portfolio` scope, while preserving monthly Spotlight overlays and the documented pilot set.
- Added doctrine/operating artifacts:
  - `/Users/mark/Property_Analytics/docs/FLAGSHIP_COMMAND_TEMPLATES_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_CAPTAIN_ACTIVATION_STANDARD_2026-05-04.md`
- New activation model:
  - baseline `portfolio` scope from the governed identity matrix
  - `spotlight` overlay from the current monthly Spotlight config, including `designation` and `market`
  - `pilot` overlay preserved for the five documented pilot properties
- Ran portfolio standup with remote apply on `2026-05-04` and verified remote D1 state:
  - `93` active Captain properties
  - `1,023` active support-agent rows
  - `93` active Captain activation memory entries
  - `19` properties carrying the current May Spotlight overlay
  - `5` properties carrying the pilot overlay
- Verification sample in remote D1:
  - `AR4PB` now shows `portfolio,spotlight` with designation `Critical` and market `Arkansas`
  - `TX4FA` now shows `portfolio,spotlight` with designation `Sale` and market `Houston`
  - `TX4VE` now shows `portfolio,pilot`

### 2026-05-04 - Captain readiness audit and Commodore fleet summary added

- Added shared fleet helper `/Users/mark/Property_Analytics/scripts/captain_fleet_support.py` for Captain audit/report scripts that need governed identity, latest activation manifests, and remote D1 queries.
- Added readiness audit script `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`.
- Audit outputs generated:
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.md`
- 05/04/2026 readiness snapshot:
  - `28` ready
  - `63` partial
  - `2` source-gap
  - no activation-gap properties
- Added first portfolio Commodore generator `/Users/mark/Property_Analytics/reports/captains_log/generate_portfolio_commodore_read.py`.
- Commodore outputs generated:
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.md`
- Added designation-aware runtime posture exposure in `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`:
  - `getCaptainStatus` now returns `commandPosture`
  - Captain brief-run payloads now carry `commandPosture`
  - latest Captain read responses now surface `designation`, `market`, `scopeTypes`, cadence mix, and derived intensity (`baseline`, `focused`, `urgent`)
- Current dominant fleet pattern after standup: `no recent runtime` on `65` properties, which is expected immediately after portfolio-wide activation and is now visible as the first operating pressure for Commodore review.

### 2026-05-04 - Morning portfolio collection lockout caused by headless GBP OAuth fallback

- Investigated portfolio freshness alert showing:
  - GA4 critical at `2026-04-30`
  - GSC critical at `2026-04-28`
  - Google Ads / guest cards stale
  - unit availability / PageSpeed warning at `2026-05-01`
- Root cause was a real hung collector process, not just stale reporting:
  - PID `31364` started on `2026-05-02 05:00 AM CDT`
  - it held `/Users/mark/Property_Analytics/Data_Collection/logs/daily_master_collection.lock`
  - all later scheduled collector runs on `2026-05-03` and `2026-05-04` failed immediately with `Another collection run is already active`
- Why it hung:
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` could not unpickle the saved GBP OAuth token because the runtime was missing `google.auth._regional_access_boundary_utils`
  - the collector then fell back to `InstalledAppFlow.run_local_server()` interactive OAuth during unattended launchd execution
  - that browser-auth prompt blocked the master collector before GA4/GSC/Ads/PSI collection began
  - the retry worker hit the same initialization path and was also unable to remediate the day
- Canonical fix now in place:
  - GBP collector now supports `allow_interactive_auth=False` for unattended runs
  - master collection initialization passes headless mode by default and skips GBP collector initialization instead of launching interactive OAuth
  - interactive OAuth remains opt-in only via `ALLOW_INTERACTIVE_GBP_AUTH=1`
- Operational recovery:
  - terminated the hung May 2 collector process
  - confirmed a new manual canonical collection run now proceeds past GBP initialization and into GA4 collection instead of freezing

### 2026-05-04 - Designation-aware Captain cadence and catch-up planning

- Extended `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` scheduled execution logic so designation now changes runtime behavior directly:
  - daily scheduled selection still includes normal daily agents
  - `Critical` properties now also pull `reputation_watch` and `logkeeper` into the daily cadence instead of waiting only for the weekly bucket
  - scheduled bucket ordering now prioritizes `Critical`, then `Sale`/`Spotlight`, then baseline properties when rows share a bucket
- Added `/Users/mark/Property_Analytics/scripts/generate_captain_runtime_catchup_plan.py`.
- Catch-up outputs generated:
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.md`
- Current catch-up split from the readiness audit:
  - `2` properties need source fixes before runtime catch-up
  - `8` designated `Spotlight` / `Sale` properties need focused cadence catch-up
  - `55` remaining baseline properties need normal cadence catch-up
  - `0` currently missing-runtime `Critical` properties in this first snapshot

### 2026-05-04 - Governed Captain catch-up runner and designation-aware severity

- Added `/Users/mark/Property_Analytics/scripts/run_captain_runtime_catchup.py` so the catch-up plan can be executed as a governed batch against `/v1/captain/properties/:propertyId/run` and optional brief creation, instead of staying as a passive report only.
- The runner consumes the latest generated catch-up plan and supports lane-scoped execution such as `fix_sources_first`, `focused_cadence`, and `baseline_cadence`.
- Dry-run proof on 05/04/2026 against the `focused_cadence` lane surfaced the first five targeted properties correctly: `FL4GW`, `FL4HL`, `FL4VC`, `KY4MP`, and `TX4CO`.
- Extended `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` with a light designation-aware severity layer:
  - `Critical` properties now elevate medium/high source-authority and source-freshness watch severity upward one step
  - `Critical` properties now elevate matching action priority upward one step
- This keeps designation effects grounded in actual operating outputs without rewriting the broader lane logic yet.

### 2026-05-05 - Captain Brief marketing channel presentation pass

- Refined the local vNext Captain Brief Marketing Channel Performance section in `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`.
- The section now presents application/cancellation drivers as a ranked source-and-reason table, paid-search activity as compact heartbeat metrics, and a single spend-direction takeaway that explains why the team should fix channel leakage before adding broad traffic spend.
- First user-feedback correction pass now moves the Elation Captain Brief toward T30/T90 action readiness: the stat/performance read removes prior-year variance emphasis, removes average-vacancy-time from the top KPI row, adds T30/T90 funnel and closing-ratio reads, rewrites recovery math around the net exposure target and current funnel, reframes paid search as health/action rather than existence, adds source URLs to competitor rows, and upgrades the 30-day plan to floorplan-specific ad/copy/follow-up execution.
- This is presentation/orchestration work for the local Captain Brief artifact and does not mutate locked canonical PIB generation/rendering behavior.

### 2026-05-05 - AptIQ watchlist summary source route added

- Added a governed local source route for AptIQ / ApartmentIQ-style watchlist summary PDFs:
  - `/Users/mark/Property_Analytics/Data_Collection/utils/aptiq_watchlist_summary_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0044_create_aptiq_watchlist_summaries.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/031_create_aptiq_watchlist_summaries.sql`
  - `/Users/mark/Property_Analytics/docs/APTIQ_WATCHLIST_SUMMARY_SOURCE_CONTRACT_2026-05-05.md`
- The route stores summary-level and page-level evidence in:
  - `aptiq_watchlist_summaries`
  - `aptiq_watchlist_summary_pages`
- The ingester resolves property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`, uses the filename label as the identity anchor to avoid OCR title truncation, and OCRs scanned PDFs with `pdftoppm` + `tesseract` when embedded text is absent.
- Initial local load from `/Users/mark/Downloads/watchlist` ingested `11` AptIQ watchlist PDFs, `102` pages, `0` unmapped files, and used OCR for `7` scanned PDFs. Mapped properties: Avasa at 1604 (`TX416`), Botanic (`GA4BL`), College View (`TX4CO`), Forest View (`TX4FV`), Avasa Hammock Landing (`FL4HL`), Steeplechase (`KY4SC`), The Anatole (`FL4TA`), The Metropolitan (`KY4MP`), The Reserves of Thomas Glen (`KY4TG`), The Retreat (`TX4GM`), and The Retreat at Lakeland (`FL4RL`).
- `apps/api/scripts/captain_sources_to_d1.py` now includes these AptIQ summary tables for property-scoped Captain source packets when matching rows exist.
- This is advisory market/recovery evidence. It does not override Data Pond source-of-record operating metrics, unit availability, guest cards, or Marketing BI funnel facts.
- Added a focused tomorrow-prep readiness audit for the `11` AptIQ-backed Spotlight properties:
  - `/Users/mark/Property_Analytics/reports/captains_log/audit_spotlight_report_readiness.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_report_readiness_2026-05-05.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_report_readiness_2026-05-05.md`
- Readiness result: all `11` properties are report-draft ready on core sources: AptIQ, Marketing Ops Summary, T30/T90 traffic conversions, guest cards, unit availability, cancellation/denial, ad-spend month, GBP reviews, and Reputation.com. Advisory gaps remain for detailed competitor-market packets across the batch, Spotlight field/action notes for some properties, and available-unit-interest rows for many properties. Official operating metrics are audited but not yet treated as blocking for this Spotlight report batch because Marketing Ops + source tables can support draft recovery reads.
- 2026-05-05 DataForSEO readiness addendum: the Spotlight readiness audit now checks DataForSEO search/on-page/business-profile/keyword/AI-visibility evidence explicitly. Initial coverage was `7` of `11` AptIQ-backed Spotlight properties with DataForSEO rows dated `2026-04-29`; `TX4CO` College View, `FL4HL` Hammock Landing, `KY4MP` The Metropolitan, and `FL4RL` The Retreat at Lakeland needed collection before non-branded rank, website-copy, business-profile, and AI/search-market recommendations could be fully source-backed. Follow-up catch-up completed on `2026-05-06`: SERP collection wrote `12` runs at `$0.042` and deep enrichment wrote on-page, business-profile, keyword-demand, Labs, backlink summary, and AI-visibility rows for all four properties. Remote D1 DataForSEO mirror then wrote `12` SERP runs, `306` SERP results, `12` property keyword ranking rows, `12` keyword metric rows, `66` Labs ranked-keyword rows, `4` on-page snapshots, `4` business-profile rows, and `4` AI-visibility probes. The Spotlight readiness audit now shows DataForSEO ready for all `11` properties. DataForSEO remains advisory evidence and does not replace operating, funnel, unit, reputation, or pricing facts.

### 2026-05-05 - GSC freshness policy alignment

- Corrected GSC freshness handling so natural Search Console lag is treated as fresh instead of noisy warning state when data is current for that source's normal delay window.
- `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py` now treats `gsc` as expected through `today - 3 days`.
- `/Users/mark/Property_Analytics/generate_morning_full_report.py` now uses the shared freshness policy for core source rows instead of the old raw-age-only heuristic, while still escalating true stale critical-source states to report `critical`.
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts` now mirrors the same `gsc` expected-lag rule so Watchtower/API freshness agrees with Morning Full.
- Verified on `2026-05-05`: `gsc` latest `2026-05-02` now evaluates `fresh`, not `warning`.

### 2026-05-05 - D1 mirror Captain sync transient retry hardening

- Investigated Morning Full `D1 mirror verification failed` on `2026-05-05`.
- Root cause was not Wrangler auth or the core mirror steps. The failing sub-step was `captain_sources_to_d1.py`, which hit transient Cloudflare/Wrangler `fetch failed` errors during remote D1 import.
- `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` now retries `captain_sources_to_d1.py` up to three times when stderr/stdout indicate transient connectivity failure (`fetch failed`, connectivity issue, remote disconnect, reset, timeout).
- `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` now also retries its own remote Wrangler import up to three times on the same transient failure class instead of exiting immediately on the first dropped fetch.
- Intent: a brief Cloudflare import flake in the Captain-source mirror should self-heal before the full D1 mirror is marked failed.

### 2026-05-06 - Operating metrics retry hook and closure helper hardening

- Fixed a real orchestration bug in `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`.
- `collect_operating_metrics_data()` was calling `self._queue_source_retry(...)`, but the collector class only implemented `_queue_property_retry(...)`, which caused the live failure:
  - `'PortfolioDataCollector' object has no attribute '_queue_source_retry'`
- Added `_queue_source_retry(...)` as the governed source-level wrapper over `_queue_property_retry(...)`, using the canonical source-level retry property id marker.
- Hardened `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py` so direct operational use is less brittle:
  - `evaluate_daily_collection_closure(...)` now accepts either a DB path or an existing `sqlite3.Connection`
  - `target_date` now accepts ISO date strings as well as `date` objects
- Verified direct-use closure evaluation on `2026-05-06` and `2026-05-05` now returns structured closure state instead of throwing type/table errors during audit use.
- Reordered `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` so same-morning retries now prioritize missing core source lanes (`unit_availability`, `d1_mirror`) before long-running advisory retries (`psi`, `property_operating_metrics`).
- Intent: when the day is open because core sources never wrote a run row, the retry worker should clear those first instead of spending 10+ minutes inside PSI before it even touches closure-critical sources.

### 2026-05-06 - Captain Command Center UI slice

- Added the first Data Pond Captain Command Center slice on the existing Captain page:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
- New API reads:
  - `GET /v1/captain/roster`
  - `GET /v1/captain/properties/:propertyId/command-center`
- The UI now shows a portfolio Captain roster, command posture, support-agent counts, latest runs, memory entries, source/knowledge coverage, active watch items, and open actions above the existing Captain Brief preview.
- This is intentionally a Captain inspection/control surface, not a replacement report renderer. The Brief remains what the Captain says; the Command Center is how operators inspect the Captain's runtime, memory, source coverage, and follow-through.
- Verified:
  - API `npm run typecheck`
  - web `npm run build`
  - `bash scripts/check_property_identity_governance.sh`
  - `bash scripts/check_pib_guardrails.sh`
  - `bash scripts/check_context_discipline.sh`
- Local dev servers started for review:
  - API: `http://localhost:8788`
  - Web: `http://localhost:3000`
- Follow-up display correction after Elation QA: the legacy Brief `Source Readiness` block was using outdated/too-narrow source mappings for traffic conversions, GBP, PSI, and DataForSEO visibility. `apps/api/src/platform/captain/runtime.ts` now reads T30/T90 funnel from `marketing_bi_traffic_conversions_full`, falls back from GBP insights to GBP reviews, falls back from PageSpeed to pilot PSI where available, and includes DataForSEO ranking/on-page/business-profile dates in both source scout and Brief source readiness. `/analysis/captain` now has labels for those DataForSEO and Marketing Ops rows. This corrects UI under-reporting without changing the underlying data.

### 2026-05-06 - Captain Brief team-feedback compliance pass

- Removed the search agenda from the visible local vNext Captain Brief generator after direct team feedback:
  - no `Paid Search Health` KPI card
  - no standalone search-evidence section
  - no `Website / SEO` marketing note
  - no audience-facing `Website And Search Clarity Diagnosis` label
- The top KPI grid now uses action-ready recovery facts instead: exposure, net move-ins needed, primary gap, T30 closing ratio, T90 closing ratio, guest cards needed, visible special, current T30 guest cards, and the action lane.
- The website section remains, but is now `Website Content Diagnosis`: it uses page-structure evidence only to recommend exact title/meta/H1/hero/offer copy and page-structure changes. DataForSEO stays as bottom-source support when used, not as a visible search KPI or search agenda.
- Regenerated the Elation Captain Brief proof artifact after the correction:
  - `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_at_grandway_west_captains_brief_vnext_generated_2026-05-06_email_outlook.html`
- Added a corrected 11-property readiness audit that resolves mixed property-code / GA4 / feed-id source keys through governed identity:
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_11_source_audit_2026-05-06.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_11_source_audit_2026-05-06.json`
- Current result: `10` of `11` AptIQ-backed Spotlight properties have all audited critical lanes loaded. Avasa Hammock Landing has raw GBP reviews but no derived review-sentiment rows yet. Advisory lanes remain incomplete across the batch where no available-unit-interest, Spotlight field/action, or competitor-market packet exists.
- This is local Captain Brief/report-prep orchestration work and does not mutate locked canonical PIB generation/rendering behavior.
- Follow-up readiness closure for Avasa Hammock Landing: added `/Users/mark/Property_Analytics/Data_Collection/utils/gbp_review_sentiment_backfill.py`, a deterministic GBP review sentiment backfill utility that resolves property identity through the governed matrix and classifies sentiment/themes from collected GBP review star ratings and source review text. It does not call an LLM or invent review facts. Running it for `FL4HL` populated `138` review-sentiment rows under GA4/property id `416886840` from collected GBP reviews. The corrected 11-property audit now shows all `11` AptIQ-backed Spotlight properties at `12/12` audited critical source lanes.

### 2026-05-06 - New BI Data Intake Batch

- Ingested the 2026-05-06 workbook batch from `/Users/mark/Downloads` into local Data Pond source routes and evidence ledgers.
- Purpose-built loads:
  - `Marketing Ops Summary (2).xlsx`: `91` mapped rows into `marketing_ops_summary_rows`, source-as-of `2026-05-05`
  - `cdreason.xlsx`: `4,762` rows into `marketing_cancel_denial_by_source`
  - `Init Contact  Property  Mktg Src (1).xlsx`: `728` rows into `marketing_bi_conversion_dashboard_rows`; `(2)` was an identical browser download copy and remains preserved in generic evidence
  - `Ad Spend Total, GCards, Visits, Leases and Ad Spend Δ by Calendar Period (bins) (1).xlsx`: `364` rows into `marketing_bi_ad_spend_performance_month`
  - `Ad Spend Total and Ad Spend Δ by Region (1).xlsx`: `91` rows into `marketing_bi_ad_spend_property_month`
  - `VacDays*` workbooks: `6,108` rows into `marketing_bi_vacancy_days_units`
- Generic BI evidence ledger:
  - `88,785` rows from the main workbook batch plus `15` rows from `region.xlsx` were preserved in `marketing_bi_excel_export_rows`, including conversion detail, leasing detail, ticket category/DoW, value proposition, Kingsley/NPS/renewal/rent-pricing, portfolio summary/demographic, available, and regional C&D rollups.
- `region.xlsx` was confirmed to be a regional C&D rollup (`Region`, `C&Ds`, `Apps`, `GCards`), not a property-region assignment source; property configs were not mutated from that file.
- `PSI_Day_Over_Day_Scores_2026-05-06.csv` and `GTMetrix_Daily_Scores_2026-05-06.csv` were recognized as generated export artifacts from canonical pilot tables. Local DB already had `10` mobile PSI rows and `23` GTMetrix rows dated `2026-05-06`.
- `Data_Collection/utils/marketing_bi_excel_export_ingest.py` now normalizes browser download suffixes like ` (1)` / ` (2)` for source-type detection while preserving the real source file path in stored evidence.
- Intake report:
  - `/Users/mark/Property_Analytics/reports/data_intake/data_intake_report_2026-05-06.md`
- Refreshed Spotlight readiness after intake:
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/spotlight_report_readiness_2026-05-06.md`
  - result: `11` of `11` ready, `0` source-work blockers

### 2026-05-06 - Website content diagnosis pattern wired

- Added Stephanie-style website content logic to the Captain Brief standard and local vNext generator.
- Updated `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md` so website recommendations must choose a posture before prescribing copy:
  - `Tighten`
  - `Split`
  - `Clarify`
  - `Expand`
  - `Leave mostly alone`
- Updated `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`:
  - pulls DataForSEO OnPage title, meta description, H1 JSON, word count, internal/external link counts, and image count
  - replaces the lighter `Website Copy Opportunity` section with `Website Content Diagnosis`
  - outputs current on-page signals, why the page needs the selected posture, exact title/meta/H1/hero/special copy changes, and a child-page rule
  - explicitly warns against solving a diluted one-page property site by adding more homepage copy
- Generated a fresh Hammock Landing test artifact with the new section:
  - `/Users/mark/Property_Analytics/reports/captains_log/avasa_hammock_landing/avasa_hammock_landing_captains_brief_vnext_generated_2026-05-06_email_outlook.html`

### 2026-05-06 - Weekly property source-performance intake

- Ingested `19` detailed `perf-by-source-*.xlsx` Marketing BI workbooks from `/Users/mark/Downloads` into the local Data Pond.
- `Data_Collection/utils/marketing_bi_excel_export_ingest.py` now treats `perf-by-source-*` files as the weekly source-performance feed and resolves Selection rows through the governed property identity matrix when a property key is present in the filename or row context.
- Loaded `521` rows into `marketing_bi_source_performance_rows`:
  - `198` property Selection rows
  - `323` Portfolio benchmark rows
  - `19` mapped Selection properties
  - `0` unmapped Selection rows in this batch
- `Data_Collection/read_models/property_diagnostic_json.py` now prefers property-specific weekly `perf-by-source-*` exports before older source-performance exports when building structured diagnostic JSON.
- Regenerated Elation's diagnostic JSON at `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json`; the source layer now reads from `perf-by-source-elation` with `677` guest cards, `122` visits, `62` applications, `16` leases, and `10` move-ins in the latest total row.
- This work does not mutate locked canonical PIB generation/rendering behavior.

### 2026-05-06 - Pond-wide PSI read-model correction

- Confirmed the local Pond has two PSI layers:
  - `pagespeed_metrics`: portfolio-wide PSI/CWV table with `16,896` rows across `93` property ids through `2026-05-06`
  - `pilot_control_psi_metrics`: pilot/control-specific PSI table with `436` rows across `10` property ids through `2026-05-06`
- Elation PSI exists in `pagespeed_metrics` under GA4 property id `378381999`, not in the pilot/control table.
- Corrected `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` so website health reads `pagespeed_metrics` first by GA4 id and falls back to `pilot_control_psi_metrics`.
- Regenerated `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json`; Elation now shows latest PSI rows from `2026-05-06`:
  - mobile performance `61`, LCP `5.78`, CLS `0.054`, FID/interaction fallback `33`
  - desktop performance `89`, LCP `1.28`, CLS `0.034`, FID/interaction fallback `20`
- The JSON no longer flags `website_performance.psi_scores` as missing for Elation.

### 2026-05-06 - Abandoned application attribution status

- Confirmed `marketing_bi_abandoned_application_rows` contains the abandoned application export:
  - `962` loaded rows dated `2026-05-06`
  - approximately `480` likely unique rows after accounting for duplicated browser-export copies
  - `0` distinct property ids because the export has no property id/name/region/community key
- Updated `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` so structured JSON no longer marks abandoned applications as simply missing when the export is loaded.
- The JSON now reports `property_attribution_status: source_loaded_no_property_key`, loaded-row counts, latest report date, and `publish_property_count: false`.
- Elation's regenerated specimen JSON includes the abandoned-applications source note and no longer lists abandoned applications in `missing_data`.

### 2026-05-06 - VP property retrieval JSON contract

- Added `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py` as the dedicated serializer for the VP-requested retrieval contract.
- Memorialized the contract at `/Users/mark/Property_Analytics/docs/VP_PROPERTY_RETRIEVAL_JSON_CONTRACT_2026-05-06.md`.
- This is separate from the internal Captain diagnostic JSON and outputs the requested one-object-per-property structure:
  - Demand Signals
  - Funnel Conversion
  - Inventory / Product
  - Demand vs Inventory Matching
  - Pricing / Market Position
  - Marketing Efficiency
  - Reputation / Product Friction
  - Website Performance
  - Derived boolean flags
  - Explicit missing data
- Current month is month-to-date through latest available source date.
- `pd` is treated as paid traffic in GA4 channel grouping.
- Generated the Elation specimen file:
  - `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`
- Later Spotlight production should generate 11 separate files, one object per property.
- Revision after contract QA: the VP serializer now emits compact metric objects instead of repeated `null` comparison fields. Required unavailable values are represented as `available: false` with a `missing_data_path`, and the reason appears once in `missing_data`.
- The Elation specimen now has `0` JSON null values and fills additional computable values from the Pond, including GA4 conversion rate, available-unit T30/T90 averages, PSI T30/T90 averages, spend budget-vs-actual rollups, and cost-per-guest-card rollups.

### 2026-05-06 - Captain's Brief vNext report memorialized

- Memorialized the current Captain's Brief vNext report path at `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_VNEXT_REPORT_MEMO_2026-05-06.md`.
- Canonical local report generator remains `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`.
- The generator resolves property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`, reads Data Pond facts, renders browser and Outlook-safe HTML, and can send through the shared email sender.
- Current visible-report discipline:
  - no paid-search KPI card
  - no standalone Search Evidence section
  - no top source-readiness / missing-source narrative
  - sources stay at the bottom
  - recommendations include the why, owner lane, expected effect, and proof expected
  - website content diagnosis chooses a posture before prescribing copy
  - PSI/Core Web Vitals appear as conversion-health support, not as a search agenda
- Grand Harbor proof artifact:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_cape_at_grand_harbor/the_cape_at_grand_harbor_captains_brief_vnext_generated_2026-05-06_email_outlook.html`
- Grand Harbor email proof:
  - `a735e31a-9d33-43f9-8406-195de76d487b@property-analytics.local`
- Boundary: this is Captain's Log report work. It does not mutate locked canonical PIB generator/template/sender files.

### 2026-05-06 - Watchlist Decision Output standard v1.0

- Memorialized the accepted Watchlist Decision Output format as v1.0:
  - `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_0_2026-05-06.md`
- This is an additive Watchlist reporting standard fed by Data Pond facts; it does not replace the VP retrieval JSON, Captain Brief vNext, POP Brief, canonical PIB, or source routes.
- Mandatory emailed output requirement:
  - use the PIB-style Venterra header from `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`
- Required v1.0 sections:
  - Executive Diagnosis
  - Primary Constraint
  - Confidence
  - KPI / pressure tiles
  - Scorecard with visual score bars
  - Constraint Resolution
  - Funnel Snapshot
  - Channel Budget Efficiency
  - False-Cut Protection
  - Recommended Actions
  - T30 / T90 Expected Outcomes
  - Final Recommendation
  - bottom Sources Used
- First accepted visual artifact:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_watchlist_decision_output_example_2026-05-06.html`
- First accepted email send:
  - subject `The Pointe Bentonville - Watchlist Decision Output`
  - message id `5c71a194-3c3c-45d1-b43a-b4a69646bf9d@property-analytics.local`
- Visual discipline: tiles, score bars, decision pills, short bullets, action cards, and bottom source table. Avoid long dense paragraphs, unbranded emails, raw dumps, and unsupported claims.

### 2026-05-06 - Capability-first build and delivery discipline tightened

- Operator correction: future work must not bypass an existing canonical capability or report-family delivery path just because a direct utility can do the job.
- Updated the top-level required reading block in this memory file so every build, report, email send, and new script must first check the capability register and use the existing owner/path where one exists.
- Specific report/email rule:
  - PIB-family, Captain, Watchlist, Spotlight, and specialty brief emails must use the existing documented report-family shell/sender path for that family.
  - Direct `utils.email_sender.EmailSender` use is allowed only inside the canonical report-family sender or with explicit operator approval.
  - Do not create one-off send wrappers for report delivery when an established sender/orchestrator exists or should be extended.
- The Elation Watchlist companion workbook send was delivered successfully, but it exposed this discipline gap because the direct shared email utility was used instead of first extending/using the universal PIB-style delivery path for the Watchlist family.
- Follow-up correction: added the governed Watchlist Decision Output sender at `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py` and documented it in `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_0_2026-05-06.md`. Future Watchlist emails must use that sender, including companion workbook attachments.
- Corrected and resent the Elation Watchlist Decision Output with `Competitive Market Read` promoted into the main decision flow and Elation's subject rent populated from the internal unit feed (`$1,270-$2,065`). Corrected send proof: `348861ca-fa94-4abb-a3e8-0b38a7cd25b1@property-analytics.local`.

### 2026-05-07 - Spotlight 11 report preparation completed

- Re-ran governed readiness for the 11 current Spotlight properties and generated Captain's Brief vNext browser/email artifacts for all 11:
  - TX416 Avasa at 1604
  - GA4BL Botanic Luxury
  - TX4CO College View
  - TX4FV Forest View
  - FL4HL Avasa Hammock Landing
  - KY4SC Steeplechase
  - FL4TA The Anatole
  - KY4MP The Metropolitan
  - KY4TG The Reserves of Thomas Glen
  - TX4GM The Retreat
  - FL4RL The Retreat at Lakeland
- Loaded the latest `/Users/mark/Downloads/available units.xlsx` workbook into `available_unit_interest_metrics`; that file contains Pointe-level rows plus region rows, so it does not close property-level available-interest rows for the full Spotlight 11.
- Re-ran the weekly Spotlight field-note/action ingest against `/Users/mark/Downloads/spotlight`; mapped field packets remain present for Botanic, Forest View, Steeplechase, Pointe, Thomas Glen, The Retreat, and Grand Harbor. No weekly field-note/action source files are present for Avasa 1604, College View, Hammock Landing, The Anatole, The Metropolitan, or Retreat at Lakeland.
- Confirmed the Brief generator already derives property-level exposure/availability from Marketing Ops and unit availability when the specialized available-interest export is missing, so the reports can draft without inventing floorplan-level guest-card-per-available-unit facts.
- Corrected `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py` so source-performance sections prefer `marketing_source` rows but fall back to `origin` rows when that is the only BI source-performance shape available. This specifically closed the visible source-performance hole for The Retreat at Lakeland.

### 2026-05-07 - Same-day Marketing Ops and Portfolio Box Score refresh

- Ingested `/Users/mark/Downloads/Marketing Ops Summary today.xlsx` through the governed Marketing Ops Summary source route:
  - `91` rows found
  - `91` rows upserted
  - `91` mapped properties
  - source as-of date `2026-05-06`
  - report date `2026-05-07`
- Ingested `/Users/mark/Downloads/Portfolio Box Score today.xlsx` through the governed Marketing BI Excel source route:
  - `91` Portfolio Box Score rows upserted
  - report date `2026-05-07`
- Updated `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` so Portfolio Box Score routing accepts dated/renamed workbooks whose normalized filename starts with `portfolio box score`, instead of requiring the exact filename `Portfolio Box Score.xlsx`.
- Re-ran the 11 current Spotlight Captain's Brief vNext artifacts after the refresh so the drafts use the latest operating snapshot and product-readiness metrics.
- This refresh improved the operating/product-readiness data used by the reports, but it did not close the remaining advisory lanes for specialized `available_interest` exports or weekly Spotlight notes/actions where property-specific source files have not been provided.

### 2026-05-07 - Full guest-card-per-unit export loaded

- Ingested `/Users/mark/Downloads/guest-cards-per-unit.xlsx` through the governed Marketing BI Excel available-unit-interest route:
  - `107` available-unit-interest rows upserted
  - `445` generic evidence rows stored
  - `0` ingest errors
- Updated `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` so available-unit-interest routing accepts the current and common filename variants:
  - `available units.xlsx`
  - `guest-cards-per-unit.xlsx`
  - `guest cards per unit.xlsx`
  - `guest cards per unit type.xlsx`
  - `guset cards per unit type.xlsx`
- The new export closed the `available_interest` advisory lane for all 11 current Spotlight properties.
- Re-ran the 11 current Spotlight Captain's Brief vNext artifacts so they use the full guest-card-per-unit data.
- Remaining advisory gaps after this load are only weekly Spotlight human field notes/actions for properties whose specific weekly note/action files have not been provided.

### 2026-05-07 - Watchlist companion workbook v1.2 current standard

- Versioned the Watchlist companion workbook standard as `/Users/mark/Property_Analytics/docs/WATCHLIST_COMPANION_WORKBOOK_STANDARD_V1_2_2026-05-07.md`.
- Generated the current Elation v1.2 companion workbook:
  - `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_v1_2_2026-05-07.xlsx`
  - data export `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_data_2026-05-07.json`
- v1.2 adds `Demand_vs_Availability`, promotes `T30 GC / Available Unit` and `T7 GC / Available Unit` into the Summary tab, and preserves bedroom-level available-interest rows under the governed property identity.
- Added `bedrooms` to the available-unit-interest schema and corrected the Marketing BI Excel ingester so `Bedrooms` rows inherit the active parent property identity instead of becoming unscoped rows.
- Corrected Captain Brief available-interest reads to filter `current_level = 'Property'` where property-total metrics are required, preventing bedroom rows from being selected as the latest property KPI.
- Re-ran the 11 current Spotlight Captain Brief vNext artifacts after this correction.

### 2026-05-07 - Watchlist shared repository established

- Created the shared company Watchlist repository at `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data`.
- Documented the standard at `/Users/mark/Property_Analytics/docs/WATCHLIST_SHARED_REPOSITORY_STANDARD_2026-05-07.md`.
- Created repository guidance files:
  - `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/00_README/README_Watchlist_Data_Repository.md`
  - `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/00_README/Daily_BI_Export_Checklist.md`
- Active boundary: this shared directory is a repository/publication/exchange layer only. Data Pond remains the governed system of record after ingestion.
- Future internal Watchlist/Captain/Spotlight emails should link to published files in this repository when practical instead of attaching large report artifacts.

### 2026-05-07 - Watchlist Decision Output v1.1 recovered and canonicalized

- Promoted the Watchlist Decision Output from stale static examples into a reusable canonical renderer:
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_decision_output.py`
- Documented the v1.1 standard:
  - `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md`
- v1.1 hard rules:
  - do not send stale static Watchlist examples as live reports
  - use `Recommendation Guardrails`, not `False-Cut Protection`
  - use governed source labels such as `Apartments.com / ADC` and `Walk-In / Drive-By`
  - avoid user-facing `RFP`
  - keep repository links as a quiet bottom utility, not a dominant top block
  - send shared-repository tests with no attachments through the Watchlist report-family sender
- Generated and published The Pointe v1.1 Watchlist Decision Output:
  - local: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/ar4pb_watchlist_decision_output_v1_1_2026-05-07.html`
  - repository: `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/05_Current_Reports/Watchlist/The Pointe Bentonville/2026-05-07/The_Pointe_Bentonville_Watchlist_Decision_Output_v1_1_2026-05-07.html`
- Sent the v1.1 test through `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py` with `--no-html-attachment`; send proof `8207e82a-e630-4d3f-919b-441aa8699583@property-analytics.local`.
- Correction after operator review: the actual accepted 2026-05-06 9:06 PM final was the full Elation report, not the compressed Pointe test shape. The active v1.1 standard now preserves the full section architecture from `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_decision_output_v1_1_2026-05-06.html`, including Constraint Resolution, Inventory Pressure, Product Readiness / Make-Ready, Channel Decision Check, Competitive Market Read, Recommendation Packages, Current Funnel Stress Test, and the full Secondary Evidence Appendix.
- Support/agency fee rows must be excluded from visible channel decision tables. `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/build_elation_watchlist_decision_output_v1_1.py` now filters those rows from `Channel Budget Efficiency` and `Current Spend + Output Efficiency`.
- Restored full-condition Elation send proof: `bee9648a-873b-4669-8bdc-bf775e77e06f@property-analytics.local`.
- Published the Elation v1.1 support package into the shared `Watchlist_Data` repository and resent through the canonical Watchlist sender with bottom inline links only and no attachments. The linked package includes the HTML report, a Word copy of the email content, the v1.2 Excel companion workbook, and the enhanced VP JSON data layer. Send proof: `81d6518b-f8a6-45ad-8b24-1ce51635d028@property-analytics.local`.
- 2026-05-07 display corrections: Watchlist human-facing dates must render as `MM/DD/YYYY` with no timestamps; owner lines/role-call labels are removed from the report body; the v1.1 header line is centered as `v1.1` with smaller italic `by MarketingOps`; the Executive Diagnosis panel is compact; outbound repository links must be SharePoint/OneDrive web URLs, never `file://` local sync paths.
- 2026-05-07 Captain Brief vNext correction: `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py` now removes owner columns and visible role-call labels from the main email body, keeps action/proof language, and relies on `MM/DD/YYYY` dates only. Full Critical Captain Brief emails were regenerated and sent for Elation at Grandway West, The Cape at Grand Harbor, and The Pointe Bentonville.
- 2026-05-07 correction after operator rejection: the requested three Critical emails must use Watchlist Decision Output v1.1, not Captain Brief vNext. Added `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py` to generate the accepted v1.1 structure for the three Critical properties: Elation at Grandway West, The Cape at Grand Harbor, and The Pointe Bentonville. The batch validates required sections (`Scorecard`, `Constraint Resolution`, `Product Readiness / Make-Ready`, `Channel Decision Check`, `Recommendation Packages`, `Secondary Evidence Appendix`, etc.) and sends through `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py` with no attachments. Corrected send proofs: Elation `1cb5f809-21cc-4600-84ba-ef07f458128d@property-analytics.local`; Cape `db928da0-afbf-4ff1-89b1-04d4a9af68a8@property-analytics.local`; Pointe `9adf38e3-38a2-442c-bace-616b69d7b477@property-analytics.local`.
- 2026-05-07 immediate correction: the Critical Watchlist builder initially mapped make-ready to `marketing_ops_summary_rows`, but the correct source is `marketing_bi_portfolio_box_score_rows`. Fixed the builder so top Make-Ready and Product Readiness values come from Portfolio Box Score. Resent corrected emails with make-ready populated: Elation `13538a9d-cef1-4a62-bf1f-93b4cb3eb604@property-analytics.local`; Cape `0d3706ab-095d-4789-b297-e7c63bd877bd@property-analytics.local`; Pointe `052a3df0-ee2d-4f67-bdd1-50e9385c15fa@property-analytics.local`.
- 2026-05-07 Spotlight example: generalized the Watchlist Decision Output v1.1 builder to accept an arbitrary `--property` / `--captain` pair after validating the 3 Critical path. Generated and sent the first Spotlight example for Avasa at 1604 with required v1.1 sections, make-ready populated, no owner-role clutter, no bad dates, and no attachments. Send proof: `f7c876fd-8d98-40d0-a6d9-7a996cb1092a@property-analytics.local`.
- 2026-05-07 Avasa competitor display correction: Avasa's competitor packet contains subject rent plus competitor specials/USP snippets, but no competitor rent values. The Watchlist v1.1 builder now separates subject visible rent from competitor evidence and suppresses the competitor rent column when competitor rents were not captured, instead showing a clear `Competitor rent status` note. Resent Avasa example after correction: `7cb4fb72-c7c1-477e-b011-c47c0ff5ac68@property-analytics.local`.
### 2026-05-07 - GBP is now genuinely Keeper-backed, and Hammock was a mapping drift issue

- Closed the last GBP auth/governance gap instead of only stabilizing around it.
- What changed in code:
  - `/Users/mark/Property_Analytics/utils/config_manager.py`
    - `Config.get_gbp_token_path()` now prefers Keeper materialization when `KSM_GBP_TOKEN_UID` is present, with local JSON only as true fallback.
  - `/Users/mark/Property_Analytics/utils/keeper_file_materializer.py`
    - added `upload_keeper_file(...)` so refreshed file-backed OAuth artifacts can be pushed back into Keeper.
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py`
    - GBP still normalizes tokens into stable authorized-user JSON, but now also uploads refreshed token state back to Keeper when the GBP token UID is configured.
- Live Keeper wiring now exists in the scheduled launchd runtime:
  - `KSM_GBP_CLIENT_SECRET_UID=W06j0C6nHmT25dyr7sVYTA`
  - `KSM_GBP_TOKEN_UID=yDAkWDdIFlYjvDbjVl6McQ`
  - applied to:
    - `/Users/mark/Library/LaunchAgents/com.venterra.portfolio.collection.plist`
    - `/Users/mark/Library/LaunchAgents/com.venterra.portfolio.retry-cycle.plist`
- Keeper-backed proof:
  - direct config resolution now materializes both GBP client secret and GBP token from Keeper temp files when those env vars are present
  - direct collector init succeeded headlessly, logged `Uploaded refreshed GBP OAuth token to Keeper`, and initialized the GBP Performance API service cleanly
- Hammock root cause:
  - `Avasa Hammock Landing` was not failing because of bad OAuth anymore
  - it was mapped to a stale GBP location id (`9439661870997370401`) that returned `403 PERMISSION_DENIED` on the Performance API
  - corrected governed mapping in `/Users/mark/Property_Analytics/Portfolio_Monitoring/data/all_properties_gbp_matched.json` to `8521091931329757992`
  - direct API verification then succeeded for both reviews and performance data
- Canonical live result after reruns:
  - `gbp_reviews` latest row: `collection_id=1050`, `completed`, `91 total / 91 success / 0 skipped / 0 failed`
  - `gbp_insights` latest row: `collection_id=1049`, `completed`, `91 total / 91 success / 0 skipped / 0 failed`
- Net effect:
  - GBP is no longer merely “working because local files happen to exist”
  - it is now on the governed KSM path for unattended runs, with refreshed token state pushed back into Keeper and Hammock fixed at the mapping layer
### 2026-05-07 - Morning Full acceptance now treats intentional hold as healthy control flow

- Closed a recurring false-failure path in the canonical daily summary wrapper.
- Root issue:
  - `/Users/mark/Property_Analytics/send_morning_full_report.py` correctly returned `0` when Morning Full was intentionally held because closure was still open
  - but `/Users/mark/Property_Analytics/scripts/verify_morning_delivery.py` still assumed that missing same-run delivery evidence was an error
  - result: `com.venterra.daily.health` exited `1` even when the system was doing the right thing
- Fix:
  - `send_morning_full_report.py` now writes a small status artifact to `/Users/mark/Property_Analytics/logs/morning_full_status/`
  - statuses include:
    - `held`
    - `dry_run`
    - `already_delivered`
    - `delivered`
    - `report_missing`
  - `verify_morning_delivery.py` now reads that status file and passes when delivery was intentionally deferred by closure policy
- Net effect:
  - the daily summary lane no longer treats “correctly held until later” as operational failure
  - Morning Full still enforces true delivery evidence when a send was expected

### 2026-05-07 - Closure now distinguishes core-ready from advisory tail

- Tightened the shared closure model in `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`.
- Before this change, once the retry cutoff passed, any remaining queue item forced `state=blocked`, even if all core sources were already closed and only advisory/manual work remained.
- New posture:
  - `state=advisory`
  - `summary_reason=core_closed_with_advisory_open`
- This is used when:
  - there are no unresolved core source lanes
  - but advisory/manual retry items still remain in the queue
- Operational effect:
  - Morning Full can read as sendable with advisory tail instead of falsely blocked
  - Watchtower now renders that middle state explicitly instead of collapsing it into red pressure
- On 2026-05-07 this changed the day from:
  - `blocked`
  - to `advisory`
  - because only `psi` and `property_operating_metrics` remained after core closure

### 2026-05-07 - PSI now reconciles from actual stored coverage instead of per-attempt noise

- Closed the biggest remaining false-pressure lane in same-day retries.
- Root issue:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py` was grading each run from that run's in-memory attempt stats
  - repeated whole-portfolio retries could leave the latest `data_collections` row marked `partial` even when the database already had complete same-day mobile+desktop coverage across the whole portfolio
  - the retry worker kept re-running all 93 properties because it only trusted the latest run row
- Fixes:
  - `collect_daily_psi.py` now:
    - writes `collection_id` into `pagespeed_metrics`
    - can target a subset via repeatable `--property-id`
    - computes final run status from actual stored same-day coverage in `pagespeed_metrics`, not only attempt-local counters
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` now:
    - detects the truly incomplete PSI property set from stored same-day mobile/desktop coverage
    - targets only those properties on retry
    - immediately resolves the PSI queue and reconciles the latest PSI run row to `completed` when stored same-day coverage is already whole
- Live result on 2026-05-07:
  - latest PSI run `collection_id=1046` now reads:
    - `status=completed`
    - `93 total / 93 success / 0 failed`
    - notes: `PSI run reconciled to completed after confirming same-day mobile and desktop coverage in stored data.`
  - queue item `2204` for PSI is now `resolved`
- Net effect:
  - PSI no longer overstates incompleteness after cumulative retries have already closed the day
  - future retries can focus on the actual laggards instead of brute-force rerunning the full portfolio

### 2026-05-07 - Watchlist v1.1 adds GA4, GBP, and enhanced PSI trend evidence

- Updated the active Watchlist Decision Output renderer:
  - `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py`
- Boundary:
  - this is Watchlist report-family work only
  - no locked canonical PIB generator/template/sender files were touched
- New secondary evidence blocks:
  - `GA4 Website Demand`
    - T30 sessions, users, conversions, bounce rate
    - current T30 vs prior T30 trend indicators
    - channel rows for sessions/conversions by GA4 channel group
  - `GBP Local Demand`
    - profile views, website clicks, calls, directions
    - total actions, total queries, action rate, discovery rate
    - current T30 vs prior T30 trend indicators
  - enhanced `Website Technical Health`
    - latest mobile/desktop PSI, LCP, CLS, FID/INP proxy, Speed Index
    - latest-vs-prior PSI trend indicators
    - threshold-based conversion-risk watch list
- Visual standard:
  - compact evidence cards and tables
  - trend arrows and color logic
  - all displayed dates remain `MM/DD/YYYY`
- Verification:
  - generated Avasa proof artifact without sending:
    - `/Users/mark/Property_Analytics/reports/captains_log/avasa_at_1604/tx416_watchlist_decision_output_v1_1_2026-05-07.html`
  - `python3 -m py_compile reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py` passed
  - `bash scripts/check_pib_guardrails.sh` passed
  - `bash scripts/check_context_discipline.sh` passed

### 2026-05-07 - Watchlist recovery KPI wording changed to Net Leases

- Updated the active Watchlist Decision Output renderer:
  - `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py`
- User-facing change:
  - top KPI tile now reads `Net Leases Needed`
  - funnel stress row now reads `PQ / Net Leases`
  - supporting line now says net leases require the calculated visits/guest cards at current closing
- Boundary:
  - math is unchanged; this remains the exposure-under-10% recovery gap expressed in lease/PQ terms for action clarity
  - no locked PIB files were touched

### 2026-05-07 - Watchlist email / site-manager attachment separation

- Updated the active Watchlist Decision Output report family:
  - `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py`
- Main email cleanup:
  - removed `Constraint Resolution`
  - removed `Channel Decision Check`
  - removed `Historical Cost Efficiency`
  - kept the remaining executive/secondary evidence email structure
- Site-manager Word attachment:
  - generated as a separate `.docx` from the same governed source data
  - excludes the internal/technical blocks the user named: `Constraint Resolution`, `Channel Decision Check`, `Recommendation Packages`, `Current Funnel Stress Test`, `Unit-Type Spend / Targeting`, and `Website Technical Health`
  - keeps practical operating content: plain-English read, work-first list, funnel trend, inventory pressure, channel budget, competitive market, source output, current spend/output, website/local demand, reputation/product friction, and expected improvement
- Delivery:
  - canonical Watchlist sender now supports `.docx` MIME attachments
  - test sent for The Pointe Bentonville with HTML report, site-manager Word doc, companion workbook, and VP JSON attached
- Boundary:
  - no locked PIB files were touched
  - no one-off email sender was created

### 2026-05-07 - Watchlist Decision Output v1.2 comparison standard

- Versioned the active Watchlist Decision Output family as v1.2:
  - standard doc: `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_2_2026-05-07.md`
  - renderer remains `/Users/mark/Property_Analytics/reports/captains_log/build_critical_watchlist_decision_outputs_v1_1.py` but emits `_v1_2_` artifacts through `REPORT_VERSION`
- v1.2 requirements added from Stephanie feedback:
  - restore portfolio and regional comparisons
  - show T30 and T90 direction
  - add portfolio/regional analysis for funnel and channel/source sections
  - restore guest-card-to-available-unit-type analysis from `available_unit_interest_metrics`
  - use direct channel language; no defensive marketing framing where downstream output does not support spend
- v1.2 insight correction:
  - every major section must include an interpretation panel that explains what the evidence likely means, why it may be happening, what to do next, and what to avoid
  - tables are supporting evidence, not the report narrative
  - added `Damage / Friction Check` to surface conversion-damaging factors from negative reviews, attention reviews, service/ticket rows, no-response aging, reopen/ticket posture, make-ready/readiness, and other trust blockers
- v1.2 funnel-gap correction:
  - `Current Funnel Stress Test` now distinguishes broad traffic-volume sufficiency from the actual recovery gap
  - if current T30 demand already exceeds broad needs, the report says there is no broad traffic gap and points to net exposure, floorplan/product fit, follow-up, offer clarity, pricing/concession fit, and service/readiness blockers instead of showing misleading zero-gap rows
- v1.2 reputation expansion:
  - `Reputation / Product Friction` now follows the richer PIB reputation lane instead of a thin rating table
  - the report pulls GBP review volume, star mix, reply capture, sentiment score/breakdown, theme sentiment, critical review action items, Reputation.com score trend/components, and local reputation competition where available
  - labels now separate GBP all-time/review-level evidence from Reputation.com current-period evidence to avoid confusing response/review-count reads
- v1.2 unit-type targeting readability correction:
  - `Unit-Type Spend / Targeting` no longer renders raw keyword JSON/Python arrays
  - bedroom search terms are classified under matching bedroom lanes (`1 BR`, `2 BR`, etc.)
  - General search terms exclude inactive and bedroom-specific keywords and render plain search phrases with readable spend/click/conversion context
- v1.2 run-date correction:
  - Watchlist Decision Output artifact filenames, visible report header dates, and email subject dates now use the actual run date
  - this prevents fresh runs from carrying a stale hardcoded report date
- The site-manager companion Word report is also versioned as v1.2 and render-checked:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/ar4pb_site_manager_action_plan_v1_2_2026-05-07.docx`
  - render QA: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/docx_render_check_v1_2`
- Boundary:
  - Watchlist report-family change only
  - no locked PIB files were touched

### 2026-05-09 - Directive Control Center added

- Added an enterprise Directive Control Center as governed policy infrastructure for the Captain / Commodore / Fleet / Expert Bench / Fleet Scribe operating model.
- Governing source: `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md`.
- Placement follows the existing platform pattern:
  - domain services: `/Users/mark/Property_Analytics/apps/api/src/platform/directives`
  - API route: `/Users/mark/Property_Analytics/apps/api/src/routes/directives.ts`
  - D1 migration: `/Users/mark/Property_Analytics/apps/api/migrations/0047_create_directive_control_center.sql`
  - admin surface: `/Users/mark/Property_Analytics/apps/web/src/app/admin/directives/page.tsx`
- The model treats directives as structured policy data, not loose prompt text. Profiles include identity, purpose, decision questions, sources, output contract, guardrails, do-not-allow rules, evidence requirements, confidence thresholds, freshness policy, escalation triggers, publication permissions, external communication permissions, report-family applicability, owner, version, effective date, approval status, and approval metadata.
- Runtime behavior resolves through approved active directive versions. Draft directives are simulation-only.
- Workflow states now include `draft`, `submitted_for_review`, `approved`, `active`, `rejected`, `retired`, and `rolled_back`.
- Audit tables and service integration capture directive creation, editing, validation, approval, activation, rejection, retirement, rollback, runtime use, simulation runs, and validation failures.
- The UI/API contract is documented at `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_UI_CONTRACT_2026-05-09.md`; the first `/admin/directives` page provides structured list/search/view, with workflow actions exposed through the governed API.
- Simulation fixtures cover:
  - Navigator content recommendation with weak local proof
  - Quartermaster stale/conflicting source condition
  - Fleet Scribe publication attempt with template variance or missing approval
- Boundary:
  - additive to Data Pond, Captain runtime, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems
  - no locked PIB generation/rendering/sending files were changed

### 2026-05-09 - Directive Control Center audit/hardening pass

- Completed an enterprise audit and hardening pass for the Directive Control Center.
- Audit record: `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_AUDIT_HARDENING_2026-05-09.md`.
- Hardening added:
  - directive version hashes and runtime snapshot hashes
  - immutable runtime snapshot and audit event triggers
  - post-draft directive content immutability
  - one-open-draft, one-submitted, and one-active-version DB constraints per profile
  - dedicated `directiveControlCenter` permission surface
  - stricter validation for permissions, freshness, confidence, report families, active-state safety, Fleet Scribe controls, and Quartermaster source gates
  - simulation isolation and expanded governance failure fixtures
  - request/correlation identifiers for audit and runtime usage tracing
- Verification:
  - API typecheck passed
  - Directive Control Center platform tests passed
  - web build passed
- Boundary:
  - hardening only; no Captain’s Office implementation was started in that pass
  - no parallel reporting system created
  - no locked PIB files touched

### 2026-05-09 - Captain Runtime Orchestration foundation

- Added the first governed Captain Runtime Orchestration Layer.
- Architecture doc: `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_ARCHITECTURE_2026-05-09.md`.
- Implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain-runtime`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/captain-runtime.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0048_create_captain_runtime_orchestration.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0035_create_captain_runtime_orchestration.sql`
- Runtime behavior:
  - receives property-scoped interactions
  - classifies intent
  - resolves property context
  - resolves active directives through the Directive Resolver
  - builds immutable evidence packets
  - enforces governance before reasoning
  - builds structured runtime payloads
  - validates structured reasoning output
  - stores memory candidates instead of mutating canonical memory
  - routes interactions to Captain / Bench / Fleet Scribe lanes
  - preserves audit events, evidence hashes, directive lineage, payload hashes, and response hashes
- Boundary:
  - GPT is treated as a constrained reasoning engine, not truth, memory, workflow, governance, or policy
  - no locked PIB files touched
  - no parallel reporting system created
  - Fleet Scribe and Quartermaster boundaries remain blocking controls

### 2026-05-09 - Captain Runtime Orchestration audit/hardening pass

- Completed the enterprise hardening pass for the Captain Runtime Orchestration foundation.
- Audit record: `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_AUDIT_HARDENING_2026-05-09.md`.
- Hardening added:
  - runtime session idempotency keys and correlation lineage
  - immutable/no-delete protections for sessions, interactions, evidence packets, reasoning requests, reasoning responses, and audit events
  - replayable evidence packet hashes that exclude volatile ids/timestamps
  - evidence packet validation before reasoning
  - payload validation for directive/evidence hashes, output conflicts, and size controls
  - strict structured-response validation for required sections, forbidden hallucinated fields, enums, confidence, and response size
  - side-effect validation before memory/routing persistence
  - candidate-memory expiration, conflict state, source evidence hash, and duplicate signature
  - route-level runtime-mode authorization so editors cannot force escalated, executive, or simulation mode
- Verification:
  - API typecheck passed
  - Captain Runtime Orchestration tests passed
- Boundary:
  - hardening only; no Captain’s Office UI or real GPT provider added in that pass
  - no locked PIB files touched
  - no parallel reporting system created

### 2026-05-09 - Captain’s Office operational workspace

- Added the first governed Captain’s Office operational workspace.
- Official naming:
  - interface: `Captain’s Office`
  - runtime intelligence actor: `Captain`
  - orchestration layer: `Captain Runtime`
  - policy/governance layer: `Directive Control Center`
- Architecture doc: `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_ARCHITECTURE_2026-05-09.md`.
- Web routes:
  - `/captains`
  - `/captains/[propertyId]`
  - `/captains/[propertyId]/history`
  - `/captains/[propertyId]/watchlist`
  - `/captains/[propertyId]/memory-candidates`
- API read routes added under `/v1/captain-runtime`:
  - `/properties/:propertyId/office`
  - `/properties/:propertyId/history`
  - `/properties/:propertyId/evidence`
  - `/properties/:propertyId/memory-candidates`
- Boundary:
  - UI consumes Captain Runtime; it does not recreate runtime logic
  - no direct GPT access
  - no Data Pond mutation
  - no memory promotion workflow
  - no raw internal prompt/payload exposure
  - no locked PIB files touched
  - no parallel reporting system created

### 2026-05-09 - Expert Reads / Consulting Bench runtime controls

- Added the first governed Expert Reads runtime foundation for Consulting Bench lanes.
- Architecture doc: `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_ARCHITECTURE_2026-05-09.md`.
- Implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/expert-reads`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/expert-reads.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0049_create_expert_reads.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0036_create_expert_reads.sql`
- Expert Reads are structured specialist contributions, not autonomous agents, independent assistants, report authors, chatbot lanes, or report generators.
- Runtime behavior:
  - resolves active lane directives through the Directive Resolver
  - consumes immutable Captain evidence packets by id
  - enforces lane-specific governance for Quartermaster, Navigator, Revenue Advisor, Signals Officer, Product Readiness Officer, Trust And Proof Advisor, and the other Consulting Bench lanes
  - persists Expert Read requests, final reads, findings, recommendations, and audit events with evidence/directive hash lineage
  - keeps draft/incomplete/blocked reads out of Fleet Scribe publishable input posture
- Boundary:
  - no Data Pond mutation
  - no memory promotion
  - no direct GPT provider integration
  - no Fleet Scribe bypass
  - no Quartermaster bypass
  - no locked PIB files touched
  - no parallel reporting system created

### 2026-05-10 - Expert Reads / Consulting Bench audit/hardening pass

- Completed the enterprise hardening pass for the Expert Reads runtime layer.
- Audit record: `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_AUDIT_HARDENING_2026-05-10.md`.
- Hardening added:
  - Expert Reads evidence compatibility validation with replayed Captain evidence packet hashes
  - source Captain Runtime session/interaction lineage assertions when source ids are supplied
  - deterministic `request_hash` replay protection and duplicate-request audit events
  - database-level prevention of self-authorized `publishable` Expert Read states
  - audit hash lineage columns for evidence, directive, and read hashes
  - stronger structured output validation for evidence refs, proof metrics, freshness, blocked states, and output size
- Boundary:
  - no Expert Reads UI, real GPT provider, autonomous Bench agents, Fleet Scribe publication tooling, locked PIB edits, or parallel reporting system added

### 2026-05-10 - Captain’s Office Expert Reads visibility

- Added governed Expert Reads visibility and request workflow inside Captain’s Office.
- Integration doc: `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_EXPERT_READS_INTEGRATION_2026-05-10.md`.
- Web route:
  - `/captains/[propertyId]/expert-reads`
- UI behavior:
  - lists property Expert Reads from existing `/v1/expert-reads/properties/:propertyId`
  - renders detail inside the static-compatible route instead of adding an unbounded dynamic Expert Read id route
  - shows lane, confidence, freshness, publishability, escalation, blocked states, findings, recommendations, do-not-do guidance, conflicts, and evidence/directive/read/request hash lineage
  - allows controlled lane-specific Expert Read requests through existing `/v1/expert-reads`
- Boundary:
  - Captain’s Office consumes Expert Reads APIs only
  - no new runtime, no autonomous expert agents, no report authoring system, no Data Pond mutation, no memory promotion, no Fleet Scribe bypass, no Quartermaster bypass

### 2026-05-10 - Property Access Control foundation

- Added canonical property-scoped authorization for Captain’s Office, Captain Runtime, Expert Reads, and future Fleet/Scribe property workflows.
- Architecture doc: `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_ARCHITECTURE_2026-05-10.md`.
- Implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/access/property-access-control.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0050_create_property_access_control.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0037_create_property_access_control.sql`
- Current capability:
  - central `PropertyAccessControl` service for property, region, portfolio, capability, runtime-mode, and Expert Read lane authorization
  - explicit grant persistence in `property_access_grants`
  - immutable audit trail in `property_access_audit_events`
  - fail-closed behavior for missing actors, missing/unresolvable property scope, unsupported runtime modes, unsupported expert lanes, and missing capabilities
  - route enforcement on Captain Runtime interactions, Captain’s Office reads, runtime history, evidence lineage, memory candidates, and Expert Reads request/read endpoints
- Boundary:
  - no parallel auth system
  - no UI-only enforcement
  - no real GPT integration
  - no AI/runtime/report behavior changed
  - no locked PIB files touched

### 2026-05-10 - Property Access Control audit/hardening pass

- Completed enterprise hardening for the canonical property-scoped authorization layer.
- Audit record: `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_AUDIT_HARDENING_2026-05-10.md`.
- Hardening added:
  - explicit `allow` / `deny` grant effects
  - deterministic grant precedence: property before region before portfolio, and same-scope deny before allow
  - duplicate active grant prevention through canonical grant fingerprints
  - strict denial for unknown authorization actions, invalid runtime modes, and invalid Expert Read lanes
  - scope consistency constraints for property, region, and portfolio grants
  - revoked and expired grants excluded from access decisions
  - Expert Read detail denials masked as not found to reduce record inference while still auditing the denial
- Boundary remains unchanged:
  - no grant-management UI
  - no AI/runtime/report behavior changed
  - no PIB/reporting coupling

### 2026-05-10 - Awareness Network / Memory Stewardship foundation

- Added the first governed Awareness Network and Memory Stewardship foundation.
- Charter and architecture docs:
  - `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_CHARTER_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MEMORY_STEWARDSHIP_ARCHITECTURE_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/AGENT_IDENTITY_AND_CHARTER_MODEL_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MEMORY_TAXONOMY_AND_CARE_METADATA_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/AGENT_SELF_NOTES_AND_COMMITMENTS_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/REGIONAL_AWARENESS_MODEL_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MEMORY_GOVERNANCE_AND_CARE_RULES_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_OFFICE_AWARENESS_INTEGRATION_2026-05-10.md`
- Implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/awareness`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/awareness.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0051_create_awareness_network.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0038_create_awareness_network.sql`
- Current capability:
  - bounded Agent Identity and Agent Charter models
  - MemoryItem taxonomy with lifecycle state, allowed/blocked uses, sensitivity, visibility, correction path, freshness, and Care Metadata
  - governed self notes and commitment memory
  - Memory Posture service for what a Captain knows, owes, doubts, should verify, and should not recommend without more evidence
  - summary-level Regional Awareness and Doctrine Candidate foundation
  - Memory Stewardship governance checks through PropertyAccessControl and care rules
  - deterministic reflection routines that produce suggestions only
  - minimal Captain’s Office visibility for Memory Posture, self notes, commitments, regional summary, and care warnings
- 2026-05-10 hardening / naming alignment:
  - `Captain’s Office` remains the human-facing operational workspace
  - `Captain’s Quarters` is the Captain working memory / stewardship space
  - `Captain’s Log` is chronological continuity / archive / lineage
  - added `/Users/mark/Property_Analytics/docs/CAPTAINS_QUARTERS_MODEL_2026-05-10.md`
  - added `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_MODEL_2026-05-10.md`
  - added `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_AUDIT_HARDENING_2026-05-10.md`
  - added `/Users/mark/Property_Analytics/apps/web/src/app/captains/[propertyId]/quarters/page.tsx`
  - hardening added: Captain charter forbidden-authority validation, memory publication-state blocks, care-metadata use checks, correction/expiration/supersession helpers, no-delete/immutability persistence triggers, neutral commitment wording checks, and reflection archive/supersession suggestions
- Boundary:
  - no real GPT integration
  - no autonomous agents
  - no Data Pond mutation
  - no memory promotion to canonical truth
  - no report publishing
  - no surveillance or people scoring
  - no Quartermaster, Fleet Scribe, Directive Control Center, or PropertyAccessControl bypass

### 2026-05-10 - Cross-System Runtime Acceptance Audit ✅

- Completed the final governed-runtime foundation gate before any future Model Provider Gateway work.
- Acceptance doc:
  - `/Users/mark/Property_Analytics/docs/CROSS_SYSTEM_RUNTIME_ACCEPTANCE_AUDIT_2026-05-10.md`
- Cross-system acceptance tests:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/cross-system-runtime-acceptance.test.ts`
- Verified integrated chain:
  - Captain’s Office
  - PropertyAccessControl
  - Captain Runtime
  - Directive Control Center
  - immutable Evidence Packet
  - Captain’s Quarters / Awareness Network
  - Captain’s Log continuity
  - Expert Reads
  - Quartermaster / Fleet Scribe boundaries
- Current readiness decision:
  - `ready_for_model_gateway: true`
  - this is permission to design the Model Provider Gateway next, not to connect real GPT yet
- Confirmed boundaries:
  - no real GPT provider integration
  - no autonomous behavior
  - no report publishing
  - no memory promotion workflow
  - no Data Pond mutation from memory/runtime/Expert Reads
  - no PIB/reporting coupling
  - no Fleet Scribe or Quartermaster bypass
  - no self notes as evidence
  - no Expert Reads as reports
  - no raw regional/private memory exposure in the tested summary surface

### 2026-05-11 - Model Provider Gateway foundation

- Added the governed **Model Provider Gateway** foundation under:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway`
- Core modules now exist for:
  - domain types
  - config and kill switch
  - payload minimization / redaction
  - structured response validation
  - governance post-check
  - immutable audit lineage
  - adapters:
    - deterministic
    - noop
    - Cloudflare AI Gateway
    - shadow mode
- Captain Runtime and Expert Reads now call the gateway abstraction while preserving deterministic accepted behavior by default.
- Live provider calls remain disabled by default.
- Cloudflare AI Gateway is implemented as an infrastructure adapter only, not as an authority layer.
- Added gateway docs:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_ARCHITECTURE_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_ADAPTER_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SECURITY_AND_REDACTION_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_MODE_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_OPERATING_GUIDE_2026-05-10.md`
- Added persistence foundation:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0052_create_model_provider_gateway.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0039_create_model_provider_gateway.sql`
- 2026-05-11 hardening audit:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_AUDIT_HARDENING_2026-05-10.md`
  - corrected the infra migration filename from the sequence-inconsistent `034_create_model_provider_gateway.sql` to `0039_create_model_provider_gateway.sql`
  - aligned the infra migration with the app migration's checks, indexes, foreign keys, and immutable/no-delete audit protections
  - added unsafe-config validation so ambiguous booleans, invalid adapters/source systems/runtime modes, raw payload storage, raw provider logging, cache enablement, and unauthenticated Cloudflare posture fail closed
  - hardened redaction for relationship context, private/restricted memory, sensitive context, and raw details in pattern-only summaries
  - hardened validators/governance checks against promoted memory candidates, self notes as evidence, relationship/people scoring, Quartermaster/Fleet Scribe bypass, external communication, directive/authorization edits, and provider self-routing
  - shadow-mode provider output now receives source-specific validation/governance checks without replacing deterministic accepted output
- Current readiness decision:
  - `ready_for_shadow_mode_provider_config: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
- Boundaries preserved:
  - no Data Pond mutation
  - no memory promotion
  - no report publication
  - no PropertyAccessControl bypass
  - no Directive Control Center bypass
  - no Quartermaster bypass
  - no Fleet Scribe bypass
  - no PIB/reporting coupling

### 2026-05-11 - Cloudflare shadow-mode provider configuration

- Added controlled Cloudflare shadow-provider configuration for the Model Provider Gateway.
- New implementation paths:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/evaluation.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/smoke.ts`
  - `/Users/mark/Property_Analytics/apps/api/scripts/smoke_cloudflare_shadow_model_gateway.ts`
- New docs:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_PROVIDER_CONFIG_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_SMOKE_TEST_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_GOLDEN_CASE_EVALUATION_2026-05-10.md`
- Configuration model now distinguishes:
  - `provider_shadow_enabled`
  - `provider_live_enabled`
  - `accepted_output_adapter`
  - `shadow_provider_adapter`
  - `kill_switch_active`
  - `dry_run_enabled`
- Shadow provider calls require explicit shadow mode, explicit provider-shadow enablement, Cloudflare enablement, kill switch off, dry run off, and live accepted calls still disabled.
- Deterministic output remains accepted behavior.
- Cloudflare output is validated, governance-checked, compared, and stored only as shadow observability metadata.
- Added immutable `model_gateway_shadow_results` persistence for shadow hashes, validation/governance status, deviation summary, token/cost/latency metadata, provider request id, and safe error fields.
- Added opt-in synthetic smoke test command:
  - `cd /Users/mark/Property_Analytics/apps/api && npm run smoke:cloudflare-shadow`
  - real provider attempt requires `RUN_CLOUDFLARE_SHADOW_SMOKE=true` plus explicit shadow configuration
- Added golden-case evaluation fixtures for unverified claims, self notes, stale evidence, unsupported public copy/publishability, relationship judgment risk, and regional summary redaction.
- Current readiness decision:
  - `ready_for_shadow_provider_smoke_test: true`
  - `ready_for_semantic_shadow_evaluation: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
- Preserved boundaries:
  - no live accepted model behavior
  - no Cloudflare authority transfer
  - no provider-driven Captain Runtime or Expert Reads behavior
  - no provider-driven memory, routing, report, publication, Data Pond, or PIB/reporting side effects

### 2026-05-11 - Cloudflare shadow smoke and semantic evaluation pass

- Ran the first controlled Cloudflare shadow smoke and golden-case semantic evaluation pass.
- Evaluation record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_EVALUATION_RESULTS_2026-05-10.md`
- Added metadata-only evaluation runner:
  - `/Users/mark/Property_Analytics/apps/api/scripts/run_model_gateway_shadow_evaluation.ts`
  - command: `cd /Users/mark/Property_Analytics/apps/api && npm run eval:gateway-shadow`
- Added deterministic semantic safety scoring across:
  - structure compliance
  - governance compliance
  - evidence discipline
  - memory care
  - publishability restraint
  - operational usefulness
- First controlled result:
  - synthetic smoke attempted with explicit shadow flags
  - Cloudflare provider transit skipped because backend Cloudflare base URL/model/token are absent
  - deterministic accepted output remained unchanged
  - one smoke shadow result was recorded
  - seven golden-case deterministic baselines passed
  - seven golden-case shadow attempts were skipped/fail-closed with audit lineage
- Current readiness decision:
  - `ready_for_limited_shadow_expansion: true`
  - `ready_for_live_candidate_mode_design: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`
- Important limitation:
  - no real Cloudflare/provider output was observed yet; provider semantic quality, latency, token usage, request id capture, and cost estimate remain unmeasured until backend Cloudflare provider config is supplied through the approved secret path
- Boundaries preserved:
  - provider output remains shadow-only
  - no live accepted model behavior
  - no memory/routing/report/publication/Data Pond side effects
  - no frontend provider access
  - no raw prompts or secrets printed
  - no PIB/reporting coupling

### 2026-05-11 - Real Cloudflare shadow observation preflight

- Attempted the **Cloudflare Shadow Provider Configuration + Real Shadow Observation** pass.
- Real provider transit did not occur because approved backend Cloudflare AI Gateway config is absent in the current shell and checked backend config files.
- New results record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_REAL_SHADOW_OBSERVATION_RESULTS_2026-05-10.md`
- Missing required config for real shadow provider transit:
  - `CLOUDFLARE_AI_GATEWAY_BASE_URL`
  - `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
  - `CLOUDFLARE_AI_GATEWAY_MODEL` or `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`
- Safe run results:
  - synthetic smoke attempted
  - `calledCloudflare=false`
  - deterministic accepted output preserved
  - one smoke shadow result recorded
  - seven golden-case deterministic baselines passed
  - seven golden-case shadow attempts skipped/fail-closed before provider transit
  - redaction compliance remained 7/7
- Readiness decision:
  - `ready_for_limited_shadow_expansion: false`
  - `ready_for_live_candidate_mode_design: false`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`
  - `synthetic_smoke_called_cloudflare: false`
  - `golden_fixtures_called_cloudflare: false`
- Boundary preserved:
  - no real provider output was observed or trusted

### 2026-05-11 - Cloudflare AI Gateway backend shadow config path

- Prepared the backend-only Cloudflare AI Gateway shadow configuration path for the internal Model Provider Gateway.
- Added safe config checker implementation and command:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/cloudflare-shadow-config.ts`
  - `/Users/mark/Property_Analytics/apps/api/scripts/check_cloudflare_shadow_config.ts`
  - `cd /Users/mark/Property_Analytics/apps/api && npm run model-gateway:check-cloudflare-shadow-config`
- The checker reports only key presence and safe booleans; it does not print, log, persist, or expose secret values.
- It verifies:
  - deterministic accepted output remains configured
  - live provider calls remain disabled
  - Cloudflare live accepted behavior remains disabled
  - shadow provider eligibility requires explicit shadow flags, kill switch off, dry run off, Cloudflare enabled, backend base URL, backend auth token, model or dynamic route, raw payload storage off, raw provider logging off, and cache off
  - frontend exposure is absent for Cloudflare provider keys
- Added setup documentation:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_CONFIG_SETUP_2026-05-10.md`
- Smoke output now includes a sanitized `skipReason` so missing-config and opt-in skips are explicit without exposing secrets.
- Current expected readiness if backend Cloudflare values are absent:
  - `cloudflare_config_path_ready: true`
  - `cloudflare_backend_config_present: false`
  - `shadow_provider_observed: false`
  - `ready_to_run_real_shadow_when_secrets_provided: true`
  - `ready_for_live_provider_calls: false`
  - no raw prompts/secrets printed or persisted
  - no memory/routing/report/publication/Data Pond/PIB side effects
