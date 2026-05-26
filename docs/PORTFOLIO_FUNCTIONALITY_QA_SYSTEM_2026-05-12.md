# Portfolio Functionality QA System

Date: 2026-05-12
Owner: EVS / BrowserStack + Experience Watch
Status: Governed Round 1 implementation ready for first batch execution

## Purpose

Create a durable, reusable QA/audit system for Venterra property sites that use the same template family as the pilot sites.

The system started with the five pilot production URLs and now accepts official launch-batch URL lists without changing the QA checklist contract.

## Canonical Inputs

- Official checklist workbook: `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`
- Round 1 URL source doc: `/Users/mark/Downloads/Round 1 QA.docx`
- Machine contract: `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json`
- Batch definitions: `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`
- Round 1 target list: `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`
- Pilot property URLs: `/Users/mark/Property_Analytics/evs/config/pilot-properties.json`
- Pond availability export: `/Users/mark/Property_Analytics/scripts/export_evs_pond_availability.py`
- BrowserStack runner lane: `/Users/mark/Property_Analytics/evs/`

## Ownership Model

Checklist rows where `Element == Functionality` or `Element == Data Integrity` are imported into the machine contract.

The contract preserves every Functionality and Data Integrity row but separates execution ownership:

- `evs`: browser-observable functionality, routing, CTAs, no-submit vendor handoffs, availability/pricing/unit-data-vs-Pond checks, map coordinate checks, unit continuity, filters, sorting, carousel behavior, and map/floor behavior
- `media_qa`: image/photo/virtual-tour correctness and media-owned visual checks
- `forms_qa`: contact form submission and required-field validation
- `lead_attribution_qa`: AH/EAI guest-card proof that requires governed synthetic-lead identity, submission rules, and downstream verification

The unattended EVS batch executes only `evs` checks. Deferred owner lanes stay visible in the contract so they are not forgotten or silently treated as passing.

## Current Round 1 Batch

Batch id: `round_1_property_websites`

Source files:

- `/Users/mark/Downloads/Round 1 QA.docx`
- `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`

Prepared artifacts:

- `/Users/mark/Property_Analytics/scripts/import_round1_qa_batch.py`
- `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`
- `/Users/mark/Property_Analytics/evs/reports/round-1-qa-batch-import.json`
- `/Users/mark/Property_Analytics/evs/reports/round-1-qa-plan.json`
- `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`

Current Round 1 target count: `22`.

The official workbook has `22` property tabs. `Carlyle Place Apartments` was absent from the initial Round 1 Word doc but has since been user-confirmed as a governed extra target at `https://carlyleplaceapartments.kinsta.cloud/`, resolving to `TX4CP` through the property identity matrix.

Current contract summary:

- `45` total imported rows
- `43` Functionality rows
- `2` Data Integrity rows
- `34` EVS-executable checks
  - `16` broad `portfolio_functionality_regression` checks
  - `18` deeper `apartments_pricing_deep_journey` checks, including pricing/unit-layout Data Integrity rows
- `5` media QA checks deferred
- `2` forms QA checks guarded behind the forms toggle
- `4` lead-attribution QA checks deferred pending governed synthetic-lead workflow

Run the prepared Round 1 batch:

```bash
QA_BATCH_ID=round_1_property_websites \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Useful first-pass limiter:

```bash
QA_BATCH_ID=round_1_property_websites \
EVS_RUN_PROFILES=portfolio_functionality_regression \
EVS_RUN_DEVICE_PROFILES=desktop_chrome \
EVS_TARGET_IDS=OK4AN \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Form checks are a separate run lane because one check creates a real form submission. The default Round 1 run excludes them. Include them with:

```bash
QA_BATCH_ID=round_1_property_websites \
EVS_INCLUDE_FORMS=1 \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Rerun only the form checks:

```bash
QA_BATCH_ID=round_1_property_websites \
QA_INCLUDE_OWNERS=forms_qa \
EVS_RUN_PROFILES=contact_form_checks \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Run only no-submit form validation:

```bash
QA_BATCH_ID=round_1_property_websites \
QA_INCLUDE_OWNERS=forms_qa \
EVS_RUN_PROFILES=contact_form_checks \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

Run governed form submissions only after approval/team readiness:

```bash
QA_BATCH_ID=round_1_property_websites \
QA_INCLUDE_OWNERS=forms_qa \
EVS_RUN_PROFILES=contact_form_checks \
EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1 \
EVS_SYNTHETIC_EMAIL_DOMAIN=venterradev.com \
EVS_SYNTHETIC_RUN_LABEL=round1-form-submit-YYYYMMDD \
node evs/orchestration/run-portfolio-qa-batch.mjs
```

## Current Pilot Batch

Batch id: `pilot_production_functionality`

Targets:

- Champion's Green: `https://championsgreen-ga.com/`
- The District Universal: `https://thedistrictuniversal.com/`
- The Harrison: `https://theharrisonsandysprings.com/`
- Ventana: `https://ventanaapts.com/`
- Calais Midtown: `https://calaismidtownapartments.com/`

Devices:

- `desktop_chrome`
- `iphone_safari`

Current plan summary:

- `43` total functionality rows in the original pilot seed
- `32` EVS-executable checks in the original pilot seed
  - `16` broad `portfolio_functionality_regression` checks
  - `16` deeper `apartments_pricing_deep_journey` checks
- `5` media QA checks deferred
- `2` forms QA checks deferred
- `4` lead-attribution QA checks deferred pending governed synthetic-lead workflow

## Initial Pilot Run Result

The first executable profile, `portfolio_functionality_regression`, now runs against the pilot production batch.

Latest same-day BrowserStack result:

- `desktop_chrome`: all five pilot sites classified `pass`
- `iphone_safari`: all five pilot sites classified `pass`
- functional warnings: `0`
- functional failures: `0`
- expected skips:
  - specials-bar functionality when no specials toggle is present
  - map-pin coordinate validation until property latitude/longitude config is available
- known artifact caveat:
  - iPhone screenshot capture can still produce BrowserStack artifact warnings; these are not counted as functional failures

## Apartments & Pricing Deep Profile Result

The second EVS profile, `apartments_pricing_deep_journey`, now has runner mappings for the EVS-owned deeper checks:

- filters: bedrooms, move-in date, budget, Floor, and Features
- rendered availability structure, with a Pond export/config hook for source comparison
- unit list/grid sort-order inspection
- floor metadata / floor-filter behavior
- unit-detail continuity from list click to detail page
- SightMap unit locate configuration
- Renting Made Simple content exposure
- Get Approved, All-In Pricing, Apply Now, and Schedule a Tour handoffs
- Other Similar Homes carousel/surface detection
- reviews newest-first validation when review date elements are exposed

Desktop BrowserStack pilot result:

- `desktop_chrome`: all five pilot sites executed through BrowserStack without runner failure
- `champions-green`: needs review for list/grid sort-order warnings; stricter Pond comparison shows `37` rendered units vs `38` Pond units
- `the-district-universal`: needs review for list/grid sort-order warnings; Pond availability matched `19` rendered units
- `the-harrison`: needs review for list/grid sort-order warnings and availability mismatch; BrowserStack strict proof shows `11` rendered units vs `57` Pond/structured units
- `ventana`: needs review for list/grid sort-order warnings and missing Other Similar Homes detection; Pond availability matched `32` rendered units
- `calais-midtown`: needs review for list/grid sort-order warnings; Pond availability matched `40` rendered units

Expected deep-profile skips:

- review sort-order pass/fail until review date elements/source dates are exposed

Mobile deep-profile result:

- `apartments_pricing_mobile_journey` is now the dedicated iPhone deep path. It reuses the same governed workbook rows as the Apartments & Pricing deep profile but uses bounded mobile HTML snapshots instead of fragile desktop-style locator interaction.
- Final production Pilot run: `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-apartments_pricing_mobile_journey-production-iphone_safari.json`, generated `2026-05-12T22:08:02.698Z`.
- Batch health: all `5` Pilot properties exited `0`, no property timed out, and artifact capture produced no warnings.
- Contract-backed mobile result: `57` pass, `18` warn, `5` skipped across the five Pilot sites.
- Recurring mobile findings:
  - list/grid sort-order warnings on all five Pilot sites
  - Apply Now opens the property-level Pipeline application URL, but the automated evidence does not show unit context on row `qa_102`
  - review sort remains skipped because only one valid machine-readable review datetime is exposed
- Property-specific mobile findings:
  - Champions Green: availability warning, `37` mobile rendered units vs `38` Pond units
  - The Harrison: availability warning, `12` mobile rendered units vs `57` Pond units
  - Ventana: Other Similar Homes surface not detected in the bounded mobile unit-detail snapshot
- Mobile passes include filters, floor/features controls, floor metadata, unit-detail continuity, SightMap unit locate config, Renting Made Simple content, All-In Pricing quote handoff, Schedule a Tour handoff, JavaScript stability, network stability, and image integrity where applicable.

## Execution Plan Builder

Generate the current pilot plan:

```bash
node evs/orchestration/build-portfolio-qa-plan.mjs
```

Generate a plan from a future URL list:

```bash
QA_TARGET_URLS_FILE=/path/to/launch-batch.json \
node evs/orchestration/build-portfolio-qa-plan.mjs
```

URL-list rows require `target_url` and may include `property_id`, `property_name`, `property_code`, `environment`, and `metadata`.

## Source Truth Rules

Some checks are not purely DOM-based and must bind to governed source truth:

- Availability display checks compare rendered unit availability against Pond availability. The pilot runner now auto-generates the Pond export from `/Users/mark/Property_Analytics/data/portfolio_analytics.db` unless `POND_AVAILABILITY_UNITS_JSON_PATH` is supplied explicitly.
- Map-pin checks compare the rendered map/location against configured property latitude/longitude.
- Review sort checks require rendered or source review dates.
- Lead-attribution checks require governed synthetic-lead identity and AH/EAI proof.

When source truth is missing, the correct result is not `fail`; it is a blocked/source-truth status. This keeps site regressions separate from data/config gaps.

## Workbook Fill-Only And Local Evidence Rule

The supplied QA workbook is an audit-facing checklist, not the evidence repository.

Workbook updates are fill-only:

- use the existing property tabs
- use the existing rows and columns
- fill only the existing status and notes cells
- do not add workbook tabs, columns, hidden sheets, screenshots, raw JSON, HTML snapshots, or other non-native evidence objects

Anything that does not naturally belong in the supplied report is stored locally under EVS reports, with the workbook carrying only a concise status/note. Local evidence can include BrowserStack payloads, source-truth exports, screenshots, rendered workbook checks, no-submit form-validation details, DNI/source-phone evidence, submitted URL strings, synthetic identity ledgers, and downstream AH/EAI reconciliation artifacts.

Evidence package utility:

```bash
EVS_EVIDENCE_PACKAGE_ID=round1-initial-fill-only-evidence-YYYYMMDD \
EVS_EVIDENCE_WORKBOOKS=/path/to/filled-workbook.xlsx \
EVS_EVIDENCE_REPORTS=/path/to/audit.json,/path/to/coverage.md \
EVS_EVIDENCE_RUN_DIRS=/path/to/evs/run-a,/path/to/evs/run-b \
node evs/orchestration/create-local-evidence-package.mjs
```

The package writes:

- `evidence-manifest.json`: file inventory, roles, absolute/repo-relative paths, sizes, mtimes, and SHA-256 hashes
- `README.md`: human-readable policy and package summary

The batch runner now writes a local evidence manifest automatically unless `EVS_DISABLE_EVIDENCE_MANIFEST=1` is set. The manifest sits inside the run directory at `local-evidence-package/`.

Current Round 1 v22 package:

- `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520/evidence-manifest.json`
- `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520/README.md`

Fill-only validation:

```bash
EVS_FILL_ONLY_UPDATED_WORKBOOK=/path/to/filled-workbook.xlsx \
npm --prefix evs run qa:validate-fill-only
```

This compares the supplied workbook against the filled workbook and fails if tabs/sheet order change or any scanned cell outside the allowed fill columns changes. The default allowed columns are `F,G`.

Current fill-only repaired workbook and validation:

- `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v23_fill_only.xlsx`
- `/Users/mark/Property_Analytics/evs/reports/round1-v23-fill-only-validation-20260520.json`
- `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520-v3/evidence-manifest.json`

## No-Submit DNI Phone Probe

The DNI phone probe verifies source-phone replacement without submitting any forms.

It exports feed-backed `trackingCodes`, generates `?id=<trackingId>` URLs, loads home/contact pages, captures expected source phone, visible phone numbers, `tel:` links, selected runtime attribution source, loaded URLs, and optional screenshots. The pass condition is intentionally strict: the expected source phone must appear in visible text or `tel:` links. Runtime attribution selection alone is evidence, not a pass, because the user-facing phone number did not change.

Run a focused probe:

```bash
QA_BATCH_ID=round_1_property_websites \
EVS_DNI_TARGET_IDS=OK4AN \
EVS_DNI_MAX_SCENARIOS_PER_PROPERTY=1 \
npm --prefix evs run qa:dni-phone-probe
```

Useful controls:

- `EVS_DNI_TARGET_IDS`: comma-separated property ids/codes
- `EVS_DNI_SOURCE_FILTER`: comma-separated marketing source codes, such as `GOO-VL,ZIL-VL,APL`
- `EVS_DNI_MAX_SCENARIOS_PER_PROPERTY`: source scenarios per property
- screenshots are captured by default for human-readable proof
- `EVS_DNI_SCREENSHOTS=0`: disable screenshot capture
- `EVS_DNI_DRY_RUN=1`: generate scenario list without browser inspection

Smoke proof:

- `/Users/mark/Property_Analytics/evs/reports/dni-phone-probe-smoke-OK4AN-20260520-v2/summary.json`
- result: `1` Fail, because the expected source phone was selected in runtime config but the displayed/tel phone stayed on the default property number

Round 1 one-source proof with screenshots:

- `/Users/mark/Property_Analytics/evs/reports/dni-phone-probe-round1-one-source-screenshots-20260520/summary.json`
- result: `22` Fail / `0` Pass
- screenshots: `44`
- side-effect policy: `no_submit`

## Local Audit Support Reports

Round 1 local audit-support files make the findings easier to review without changing the supplied workbook.

Generate support files:

```bash
EVS_AUDIT_SUPPORT_DIR=/Users/mark/Property_Analytics/evs/reports/round1-audit-support-YYYYMMDD \
npm --prefix evs run qa:audit-support
```

Current outputs:

- root-cause summary JSON: `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/root-cause-summary.json`
- root-cause summary CSV: `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/root-cause-summary.csv`
- evidence completeness JSON: `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/evidence-completeness.json`
- evidence completeness CSV: `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/evidence-completeness.csv`
- DNI screenshot contact sheet: `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520/dni-screenshot-contact-sheet.html`

Current root-cause groups:

- DNI / Attribution Failure: `176` fail cells across rows `8`, `61`, `161`, `164`, `175`, `176`, `177`, and `178`
- Unit Sort Order: `40` fail cells across rows `83` and `84`
- Availability Mismatch: `17` fail cells on row `81`
- SightMap Unit Zoom: `7` fail cells on row `90`
- Specials Toggle: `1` fail cell on row `4`
- Inspected Review Required: `55` review cells across rows `79`, `80`, `85`, `89`, `92`, `99`, `124`, and `155`

Focused retest presets:

```bash
npm --prefix evs run qa:dni-phone-probe
npm --prefix evs run qa:forms-validation
npm --prefix evs run qa:sort-order
npm --prefix evs run qa:sightmap
npm --prefix evs run qa:availability
```

The sort, SightMap, and availability presets run the Apartments & Pricing deep journey because those rows share the same unit-detail/availability traversal. Keep `EVS_TARGET_IDS`, `EVS_RUN_DEVICE_PROFILES`, and related filters available when a narrow property subset is desired.

## EVS Evaluation-Set Persistence

The portfolio QA contract is now represented as a reusable EVS evaluation set, not only as one BrowserStack report file.

Database migration:

- `/Users/mark/Property_Analytics/apps/api/migrations/0053_create_evs_batch_result_tables.sql`

Durable tables:

- `evs_evaluation_sets`: reusable QA/evaluation definitions, seeded with `portfolio_functionality_qa_v1`
- `evs_batches`: a specific URL/property list execution for an evaluation set
- `evs_batch_targets`: one target URL/property per batch, with identity status and metadata
- `evs_batch_runs`: one profile/device/provider execution per target
- `evs_findings`: one row per assertion outcome, preserving check id, owner lane, status, severity, source workbook/sheet/row, classification, metadata, and evidence refs
- `evs_source_truth_snapshots`: the Pond/feed/config artifacts used by a batch

Display/API additions:

- `GET /v1/evs/evaluation-sets`
- `GET /v1/evs/batches`
- `POST /v1/evs/batches`
- `GET /v1/evs/batches/:batchId`

`POST /v1/evs/batches` accepts a named URL target list and can attach it to `portfolio_functionality_qa_v1` via `evaluation_set_key`, giving tomorrow's launch list a durable EVS record before BrowserStack execution begins.

When a normalized EVS result is ingested with `trigger_metadata.evs_batch_run_id`, EVS now persists both the existing result blob and queryable row-level findings for batch reporting.

## Next Build Slice

1. Add property geo fields to the governed config path before enabling map-pin pass/fail automation.
2. Decide whether Pipeline Apply Now is expected to carry explicit unit context for row `qa_102`; if yes, treat the current property-level application URLs as site findings.
3. Define the synthetic lead policy before enabling `lead_attribution_e2e`.

This extends EVS/BrowserStack. It does not create a parallel QA system and does not touch canonical PIB files.

## Separate Lead Attribution E2E Lane

`lead_attribution_e2e` is now wired as a separate dormant EVS test structure, independent from the no-submit functionality/navigation profiles.

New paths:

- `/Users/mark/Property_Analytics/evs/config/lead-attribution-e2e.json`
- `/Users/mark/Property_Analytics/scripts/export_evs_lead_attribution_truth.py`

Source truth:

- latest ThirtyLines feed snapshot in `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- `trackingCodes[].trackingId`
- `trackingCodes[].marketingSourceCd`
- `trackingCodes[].phoneNumber`
- `trackingCodes[].email`

Default no-submit checks:

- generate advertiser URLs from the feed tracking ID, defaulting to `?id=<trackingId>`
- load the generated advertiser URL
- verify the tracking ID is observable in URL/page state
- verify the expected tracking phone swaps into visible text or `tel:` links
- verify the expected recipient email when the current template exposes it pre-submit
- fill a synthetic form draft with EVS-controlled name, email, phone, and message values
- skip actual submit unless `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`

Governed submit controls:

- `EVS_ENABLE_SYNTHETIC_FORM_SUBMIT=1`
- `EVS_SYNTHETIC_EMAIL_DOMAIN`
- `EVS_SYNTHETIC_RUN_LABEL`
- optional `EVS_SYNTHETIC_PROPERTY_LABEL`, `EVS_SYNTHETIC_CTA_LABEL`, `EVS_SYNTHETIC_FIRST_NAME`, `EVS_SYNTHETIC_LAST_NAME`, `EVS_SYNTHETIC_EMAIL`, and `EVS_SYNTHETIC_PHONE`

Default synthetic identity convention:

- first name: `Venterra`
- last/full name token: `<Property><CTA>-<Source>`, for example `ApexForm-Aptlist`
- email: `<property><cta>-<source>@venterradev.com`, for example `apexform-aptlist@venterradev.com`

Local dry proof:

- Calais Midtown, one tracking scenario, desktop local runner
- source truth exported `13` feed tracking codes
- selected `TX4MIALIST` / `APL`
- advertiser URL loaded
- tracking ID observable
- expected phone swap warned with evidence: feed expected `(844) 422-2513`, while visible/tel evidence showed `(713) 520-8300`
- expected recipient email was observable in page HTML, with actual observed-email evidence captured
- synthetic form draft accepted name/email/phone/message fields
- submit remained skipped by policy

## Header/Footer Navigation Integrity

`header_navigation_integrity` is now a source-backed BrowserStack profile for template-critical navigation and conversion affordances.

Source truth:

- `/Users/mark/Property_Analytics/scripts/export_evs_property_contact_truth.py`
- latest `thirtylines_feed_snapshots.raw_payload_json`
- governed property identity resolution through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`

Checks:

- header logo/home link resolves to the same-origin home URL
- header phone exposes a `tel:` link matching the governed feed phone
- header Schedule Tour points to the property-specific feed `tourURL`
- header Apply Now points to the property-specific feed `pipelineURL`
- header primary nav exposes Apartments, Features, Amenities, Gallery, Neighborhood, and Contact
- footer phone exposes a `tel:` link matching the governed feed phone
- footer Apply Now points to the property-specific feed `pipelineURL`
- footer primary nav exposes Apartments, Features, Amenities, Gallery, and Neighborhood
- mobile menu parity exposes phone, Apply Now, and Schedule Tour

Pilot proof:

- desktop report: `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-header_navigation_integrity-production-desktop_chrome.json`, generated `2026-05-12T22:21:15.529Z`
- iPhone report: `/Users/mark/Property_Analytics/evs/reports/browserstack-pilot-header_navigation_integrity-production-iphone_safari.json`, generated `2026-05-12T22:24:20.966Z`
- all `5` Pilot properties exited `0` on both devices with no property timeouts
- desktop: `40` pass, `5` warn, `5` skipped across header/footer navigation checks
- iPhone: `45` pass, `5` warn, `5` skipped across header/footer navigation checks
- template policy: footer home/brand link is not required and is reported as skipped/not applicable when absent
- recurring skip: footer Schedule Tour is not required on the current template because Schedule Tour is verified in header/mobile menu
