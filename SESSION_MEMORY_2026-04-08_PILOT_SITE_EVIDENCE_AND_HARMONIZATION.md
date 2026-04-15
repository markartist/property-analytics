# Session Memory — 2026-04-08 — Pilot Site Evidence, Harmonization, and Daily Evaluation

## Summary

This session established a pilot-specific technical audit and evidence pipeline for the 5 live pilot properties:

- Champion's Green — `https://championsgreen-ga.com/`
- The District Universal — `https://thedistrictuniversal.com/`
- The Harrison — `https://theharrisonsandysprings.com/`
- Ventana — `https://ventanaapts.com/`
- Calais Midtown — `https://calaismidtownapartments.com/`

The work moved the pilot stack from partial, legacy-biased monitoring to a harmonized live-site model backed by stored browser evidence in the Pond.

## What Was Accomplished

### 1. Pilot config harmonization

The pilot property configuration was corrected to use the live branded domains and the correct Search Console property type.

Key updates:
- `config/venterra_properties_official.json`
- `evs/config/pilot-properties.json`
- `apps/api/src/evs/pilot-properties.ts`
- `packages/shared/src/evs-schemas.ts`

Changes made:
- `full_url` set to live branded domain
- `gsc_url` set to `sc-domain:...` for the live GSC property
- `site_type: "resi"` added for pilot properties
- `known_page_paths` added for the shared live nav contract:
  - `/`
  - `/apartments/`
  - `/features/`
  - `/amenities/`
  - `/gallery/`
  - `/neighborhood/`
  - `/faqs/`
  - `/reviews/`
  - `/contact/`
  - `/specials`
  - `/about/`

### 2. Legacy fallback removal in key consumers

The pilot monitoring system was updated so it no longer relies on the old `home + gallery + reviews` assumption for these live pilot properties.

Key updates:
- `scripts/site_audit/crawler.py`
- `Data_Collection/orchestration/daily_master_collection.py`

Behavior after update:
- prefer `known_page_paths`
- then use sitemap discovery for `resi`
- only fall back to legacy paths if richer contract data is unavailable

### 3. Pilot URL reachability and indexing audit

Confirmed:
- all 55 harmonized pilot URLs returned HTTP `200`
- all live domains have recent GSC clicks and impressions
- GSC search metrics work on the live `sc-domain:` properties

Generated / verified artifacts:
- `outputs/pilot_live_http_check_full_2026-04-08.json`
- `outputs/pilot_live_gsc_url_inspection_2026-04-08.json`

Important indexing findings:
- District, Champions Green, Harrison, Calais Midtown: `9/11` indexed
  - `/apartments/` unknown to Google
  - `/specials` unknown to Google
- Ventana: `9/11` indexed
  - `/amenities/` unknown to Google
  - `/specials` crawled but currently not indexed

### 4. Daily pilot evaluation system

Built and wired a unified daily pilot evaluator:

Files:
- `pilot_roundup/scripts/generate_daily_pilot_evaluation.py`
- `run_pilot_evaluation_daily.sh`
- `run_pilot_morning_daily.sh`

Outputs:
- `pilot_roundup/reports/daily_evaluation/pilot_daily_evaluation_<date>.json`
- `pilot_roundup/reports/daily_evaluation/pilot_daily_evaluation_<date>.html`

Merged feeds:
- live HTTP checks
- GSC URL inspection
- GSC search metrics
- GA4 new users
- dedicated pilot PSI
- GTMetrix
- BrowserStack critical CTA summary
- feed freshness metadata

### 5. Proven homepage LCP evidence

Tested fresh PSI API payloads and verified:
- PSI does **not** reliably provide `largest-contentful-paint-element` for these sites
- GTMetrix in the current pipeline does **not** store LCP element detail

Built a Chrome/CDP-based collector to capture the actual browser-reported LCP node instead.

File:
- `pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`

DB table:
- `pilot_homepage_audit_evidence`

Generated artifact:
- `pilot_control_cwv/reports/homepage_audit_evidence/pilot_homepage_audit_evidence_2026-04-08.json`

Definitive finding:
- on all 5 pilot homepages, the LCP element is the YOOtheme/UIkit hero background `DIV`
- the timed asset is the `dam.getresi.co/...Home-Hero_WEB-full.jpg` hero image

This materially strengthened the case that the shared hero delivery pattern is the main homepage performance bottleneck.

### 6. Daily browser evidence enriched in the Pond

The homepage evidence collector was expanded beyond basic LCP capture.

Stored daily per property:
- browser LCP element details
- local screenshot from the headless browser run
- main document headers/status
- LCP asset headers/status
- request count
- failed request count
- transferred bytes
- blocking-resource summary
- console errors
- raw browser probe payload
- BrowserStack device classifications
- BrowserStack screenshot path when available

Key schema and plumbing:
- `Data_Collection/db/database_manager.py`
- `pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`
- `run_pilot_morning_daily.sh`
- `pilot_roundup/scripts/generate_daily_pilot_evaluation.py`

### 7. BrowserStack evidence linked into the same daily record

BrowserStack report summaries were joined into the homepage evidence rows using live URL matching.

Joined evidence includes:
- desktop classification
- iPhone classification
- screenshot path when present in report evidence or runner logs

As of 2026-04-08:
- Calais Midtown: desktop `runner_failure`, iPhone `pass`
- Champions Green: desktop `pass`, iPhone `runner_failure`
- The District Universal Boulevard: desktop `pass`, iPhone `runner_failure`
- The Harrison: desktop `runner_failure`, iPhone `runner_failure`
- Ventana: desktop `pass`, iPhone `runner_failure`

### 8. PIB-style pilot evidence brief and email delivery

Created a guardrail-safe PIB-style operational brief that does **not** modify the locked PIB files.

File:
- `pilot_roundup/scripts/send_pilot_performance_brief_email.py`

Outputs:
- `pilot_roundup/reports/pilot_performance_brief/Pilot_Performance_Evidence_Brief_2026-04-08.html`
- `pilot_roundup/reports/pilot_performance_brief/Pilot_Performance_Evidence_Brief_2026-04-08.json`

Email delivery:
- sent successfully to `mlaufhutte@venterraliving.com`
- subject: `PIB-Style Pilot Performance Evidence Brief - 04-08-2026`

## Important Conclusions Established

### What can now be said definitively

1. All 5 pilot live sites are reachable on their harmonized live page set.
2. All 5 are receiving live GSC visibility.
3. The browser-reported LCP element on all 5 pilot homepages is the shared hero background section.
4. The core performance issue is not broad uptime failure or missing content.
5. The most credible first performance target is the shared YOOtheme hero delivery pattern.
6. A shared platform/theme pattern is also visible in the repeated `resi-elements/assets/app.js` pre-LCP load and repeated SightMap console error.

### What remains true

- This evidence is strong enough to identify the target and justify a feature request.
- It does not yet fully decompose the exact proportion of delay attributable to server response, CSS, JS, or image priority.
- The next depth tier, if needed later, would be HAR-style timing or full Lighthouse traces.

## Files Added or Changed (Primary)

### Config / schema / orchestration
- `config/venterra_properties_official.json`
- `evs/config/pilot-properties.json`
- `apps/api/src/evs/pilot-properties.ts`
- `packages/shared/src/evs-schemas.ts`
- `scripts/site_audit/crawler.py`
- `Data_Collection/orchestration/daily_master_collection.py`
- `Data_Collection/db/database_manager.py`

### Daily pilot reporting
- `pilot_roundup/scripts/generate_daily_pilot_evaluation.py`
- `run_pilot_evaluation_daily.sh`
- `run_pilot_morning_daily.sh`
- `pilot_roundup/scripts/send_pilot_performance_brief_email.py`

### Evidence collection
- `pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`

### Documentation
- `docs/PILOT_SITE_CONTRACT_HARMONIZATION.md`
- `docs/PILOT_CWV_ACTION_MATRIX_2026-04-08.md`

## Guardrails

- No locked PIB files were modified.
- `bash scripts/check_pib_guardrails.sh` passed after the work.

## Recommended Next Steps

1. Use the new evidence brief as the basis for a shared homepage hero feature request.
2. Consider adding HAR-style request timing if deeper blocking-cause analysis becomes necessary.
3. Improve BrowserStack runner stability on the failing device/profile combinations.
4. Refresh the pilot site-audit feed daily so the daily evaluation no longer depends on stale site-audit data.
