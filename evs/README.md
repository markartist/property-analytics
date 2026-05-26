# Experience Validation Service (EVS)

EVS is a shared platform service for staging-first experiential validation.

## MVP shape

- Consumer: Property Advocate
- Persistence: D1-backed request and result history
- Execution target: staging URLs only
- Properties: five pilot properties
- Profiles:
  - `broad_experiential_homepage`
  - `critical_cta_smoke`
  - `header_navigation_integrity`
- Devices:
  - `iphone_safari`
  - `android_chrome`
  - `desktop_chrome`
- Triggers:
  - manual
  - post-deploy
  - weekly scheduled

## Repo structure

- `apps/api/src/evs`
  - API-facing request intake, normalization, provider abstraction, and persistence helpers
- `apps/api/src/routes/evs.ts`
  - EVS HTTP endpoints
- `apps/api/migrations/0020_create_evs_tables.sql`
  - D1 persistence for properties, requests, and results
- `apps/api/migrations/0053_create_evs_batch_result_tables.sql`
  - D1 persistence for reusable EVS evaluation sets, launch batches, batch targets, per-profile/device runs, source-truth snapshots, and row-level findings
- `evs/config`
  - staging pilot property registry
- `evs/config/browserstack-site-patterns.json`
  - shared and property-level BrowserStack selector patterns
- `evs/docs/BROWSERSTACK_STABILIZATION_PLAN.md`
  - roadmap for hardening the pilot suite into a portfolio-grade testing system
- `evs/providers/browserstack`
  - experiential runner script
- `evs/orchestration`
  - GitHub Actions matrix helpers
- `evs/config/portfolio-functionality-qa-contract.json`
  - machine-readable portfolio functionality QA contract imported from the approved QA workbook
- `evs/config/portfolio-qa-batches.json`
  - governed batch definitions, starting with the pilot production functionality QA batch
- `evs/config/lead-attribution-e2e.json`
  - separate dormant EVS structure for feed-backed advertiser URL, phone-swap, recipient-email, and governed synthetic-form attribution checks
- `scripts/import_portfolio_qa_contract.py`
  - workbook importer that preserves source row lineage and separates EVS, media, forms, and lead-attribution ownership
- `scripts/export_evs_lead_attribution_truth.py`
  - feed exporter for ThirtyLines `trackingCodes`, generated advertiser URLs, expected tracking phone numbers, and expected form-recipient emails
- `evs/samples`
  - sample request and normalized result payloads

## API endpoints

- `GET /v1/evs/properties`
- `GET /v1/evs/evaluation-sets`
- `GET /v1/evs/batches`
- `POST /v1/evs/batches`
- `GET /v1/evs/batches/:batchId`
- `GET /v1/evs/requests`
- `POST /v1/evs/requests`
- `GET /v1/evs/requests/:requestId`
- `POST /v1/evs/requests/:requestId/handoff`
- `POST /v1/evs/ingest/:requestId`
- `GET /v1/evs/adapters/property-advocate/:propertyId`

## Workflow notes

- GitHub Actions is the orchestrator.
- BrowserStack is the execution provider.
- EVS persists requests immediately and can ingest workflow results later.
- EVS also has an evaluation-set persistence shape for reusable QA contracts and per-batch findings.
- EVS can now record explicit external-orchestrator handoff separately from result ingest, which keeps request lifecycle state honest even before API-driven dispatch is enabled.
- MVP is wired for staging URLs only.
- BrowserStack secrets are expected as `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`.
- Optional result-ingest secret is `EVS_SHARED_TOKEN`.

## Current constraint

Workflow dispatch from the API is not enabled yet because repo credentials and dispatch tokens are still pending. The API now supports the honest interim lifecycle:

- persist request
- return execution plan
- record external orchestrator handoff
- ingest normalized results later

That keeps request state truthful without forcing dispatch logic into the API before the orchestration decision is settled.

## Portfolio functionality QA

The portfolio QA lane extends EVS from smoke checks into a contract-driven functionality audit for property sites that use the same template family as the pilot sites.

Generate the pilot production plan:

```bash
npm run qa:plan
```

The first pilot executable batch is `pilot_production_functionality`, sourced from active pilot properties and filtered to EVS-owned functionality checks.

The official Round 1 batch is `round_1_property_websites`, sourced from `/Users/mark/Downloads/Round 1 QA.docx` and written to `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`. It currently contains `21` Kinsta property URLs and is filtered to the `34` EVS-owned Functionality/Data Integrity checks from the official workbook.

Generate the Round 1 plan:

```bash
QA_BATCH_ID=round_1_property_websites node evs/orchestration/build-portfolio-qa-plan.mjs
```

Run the prepared Round 1 batch:

```bash
QA_BATCH_ID=round_1_property_websites node evs/orchestration/run-portfolio-qa-batch.mjs
```

Useful first-pass limiter:

```bash
QA_BATCH_ID=round_1_property_websites \
EVS_RUN_PROFILES=portfolio_functionality_regression \
EVS_RUN_DEVICE_PROFILES=desktop_chrome \
EVS_TARGET_IDS=OK4AN \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Forms are a separate guarded lane. The default batch excludes them. To include the non-submit validation check and keep the submit check disabled/skipped:

```bash
QA_BATCH_ID=round_1_property_websites \
EVS_INCLUDE_FORMS=1 \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

To rerun only form checks:

```bash
QA_BATCH_ID=round_1_property_websites \
QA_INCLUDE_OWNERS=forms_qa \
EVS_RUN_PROFILES=contact_form_checks \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Actual form submissions require explicit approval controls:

```bash
QA_BATCH_ID=round_1_property_websites \
QA_INCLUDE_OWNERS=forms_qa \
EVS_RUN_PROFILES=contact_form_checks \
EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1 \
EVS_SYNTHETIC_EMAIL_DOMAIN=venterradev.com \
EVS_SYNTHETIC_RUN_LABEL=round1-form-submit-YYYYMMDD \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Implemented portfolio profiles:

- `portfolio_functionality_regression`: broad route/toggle/CTA/browser-functionality checks; passed the five production pilot sites on `desktop_chrome` and `iphone_safari`.
- `header_navigation_integrity`: source-backed header/footer audit for logo/home, phone/tel, primary nav destinations, Apply Now, Schedule Tour, footer parity, and mobile menu parity. Phone and vendor URLs come from the latest governed ThirtyLines feed snapshot.
- `apartments_pricing_deep_journey`: desktop-oriented deep checks for Apartments & Pricing filters, availability structure, sort order, unit-detail continuity, SightMap configuration, and unit-specific handoffs.
- `apartments_pricing_mobile_journey`: iPhone-first deep checks using bounded mobile HTML snapshots for Apartments & Pricing filters, Pond-backed availability, sort-order inspection, unit-detail continuity, SightMap config, Renting Made Simple content, similar-homes detection, and unit-specific quote/app/tour handoffs.
- `contact_form_checks`: guarded form-validation and form-submit lane. Required-field validation can run without side effects; actual submission is skipped unless `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1` plus synthetic identity controls are set.

Useful runtime controls:

- `POND_AVAILABILITY_UNITS_JSON_PATH`: optional governed unit availability export for rendered-vs-Pond comparison.
- `PROPERTY_CONTACT_TRUTH_JSON_PATH`: optional governed property contact export for header/footer phone, Apply, and Schedule Tour validation.
- `BROWSERSTACK_PROPERTY_TIMEOUT_MS`: per-property orchestration timeout, defaulting to six minutes.
- `BROWSERSTACK_CHECK_TIMEOUT_MS`: per-check runner timeout for deep profile checks.
- `BROWSERSTACK_MOBILE_CHECK_TIMEOUT_MS`: per-check timeout for the dedicated mobile journey profile.
- `BROWSERSTACK_SCREENSHOT_TIMEOUT_MS`: artifact capture timeout; iPhone runs use at least 20 seconds.

For pilot/deep runs, the orchestrator auto-generates the Pond availability export from `/Users/mark/Property_Analytics/data/portfolio_analytics.db` by calling:

```bash
python3 scripts/export_evs_pond_availability.py
```

Set `EVS_DISABLE_POND_AVAILABILITY_EXPORT=1` to disable that behavior or provide `POND_AVAILABILITY_UNITS_JSON_PATH` to use a prebuilt governed export.

## Lead attribution E2E

`lead_attribution_e2e` is intentionally separate from the non-submit functionality profiles.

Source truth:

- `scripts/export_evs_lead_attribution_truth.py`
- latest `thirtylines_feed_snapshots.raw_payload_json`
- `trackingCodes[].trackingId`
- `trackingCodes[].marketingSourceCd`
- `trackingCodes[].phoneNumber`
- `trackingCodes[].email`

Default behavior is no-submit:

- generates advertiser URLs with `EVS_ATTRIBUTION_QUERY_PARAM`, default `id`
- loads the generated home/contact URLs
- verifies the tracking ID is observable in URL/page state
- verifies the expected feed tracking phone is visible or exposed as `tel:`
- verifies the expected recipient email when the template exposes it before submit
- fills a synthetic form draft with controlled test identity fields
- skips actual submit unless `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`

Each lead-attribution finding stores expected-vs-actual evidence in metadata, including the loaded URL, tracking ID location, observed `tel:` links, phone-like visible text, observed email addresses, matching recipient emails, and synthetic form-field fill results.

Synthetic submit requires an approved test identity policy plus `EVS_SYNTHETIC_EMAIL_DOMAIN` and `EVS_SYNTHETIC_RUN_LABEL`. Downstream AH/EAI/email reconciliation remains a separate proof step.

Default synthetic identity convention:

- first name: `Venterra`
- last/full name token: `<Property><CTA>-<Source>`, for example `ApexForm-Aptlist`
- email: `<property><cta>-<source>@yopmail.com`, for example `apexform-aptlist@yopmail.com`

Overrides are available through `EVS_SYNTHETIC_PROPERTY_LABEL`, `EVS_SYNTHETIC_CTA_LABEL`, `EVS_SYNTHETIC_FIRST_NAME`, `EVS_SYNTHETIC_LAST_NAME`, `EVS_SYNTHETIC_EMAIL`, `EVS_SYNTHETIC_EMAIL_DOMAIN`, and `EVS_SYNTHETIC_PHONE`.
