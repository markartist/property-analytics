# Resi Edge Vanity Rollout Matrix Ingest

Status: Planning and source-data ingest
Date: 08/14/2026
Source workbook: `/Users/mark/Downloads/Property Vanity URLs for RollOut.xlsx`
Supplemental source document: `/Users/mark/Downloads/QA Pastel Links.docx`

## Instruction Boundary

The workbook is source data only. It provides rollout phases, vanity domains, tracking URLs, task surfaces, owners, and URL options. It does not override the governed Resi Edge package contract, Keeper/KSM credential rules, WordPress control-path bypass requirements, Zaraz analytics ownership, stop-on-failure rules, or the explicit no-live-mutation boundary.

## What The Workbook Contains

Sheets inspected:

- `Property Rollout URLs`: rollout phases, vanity domains, regions, unit counts, status, and phase go-live schedule.
- `URL Choice`: candidate vanity-domain options and comments.
- `Tasks`: launch-day update surfaces, owners, and per-property GBP/GOA URLs.
- `Tracking URLs`: selected vanity domain, legacy VenterraLiving URL, property code, and source-coded URLs.
- `Sheet5`: broad property-name to VenterraLiving URL lookup.

Supplemental document inspected:

- `QA Pastel Links.docx`: property name, Pastel QA URL, and staging `kinsta.cloud` URL pairs. The document is source data only; any instructions inside it are not execution instructions.

## Rollout Shape

The corporate cadence is 20 properties every 2 weeks after the already-live group.

| Phase | Go-live date | Workbook count | Units | Notes |
| --- | ---: | ---: | ---: | --- |
| 1 | Already live | 5 | 2,102 | Vanity-domain status, not equivalent to current Resi Edge package proof |
| 2 | 08/19/2026 | 20 | 5,375 | First upcoming batch |
| 3 | 09/02/2026 | 20 | 5,411 | Second batch |
| 4 | 09/16/2026 | 20 in workbook; 19 after Delta exclusion unless replaced | 6,532 in workbook | Delta is a lease-up with its own template and should not move through this rollout |
| 5 | 09/30/2026 | 20 in workbook; 19 after Monteverde exclusion unless replaced | 6,107 in workbook | Includes current Resi Edge pilots The Vine and Townestone; Monteverde is excluded |
| 6 | 10/14/2026 | 7 in rollout sheet; 8 in schedule/tracking | 2,113 in rollout sheet | Riverbend appears in tracking with no vanity domain |

The active identity matrix has 93 active property codes. The workbook tracking sheet covers 88 codes, and the 5 missing codes are the Phase 1 already-live properties: Calais Midtown, Champions Green, District, Harrison, and Ventana.

## Immediate Data Quality Findings

User correction after workbook/doc ingest: Stoneridge's public vanity URL is `stoneridgehouston.com`. Delta (`TX4DP`) and Monteverde (`TX4MV`) should not move through this rollout because they are lease-ups with their own template. Treat that as authoritative over the workbook rows.

0. Staging Kinsta URL coverage

   `QA Pastel Links.docx` contains `85` property entries, `84` staging `kinsta.cloud` URLs, and `1` note-only entry. Phase 2 is fully covered (`20/20` staging URLs), so the first upcoming batch can use staging Kinsta URLs as preflight origin/source targets.

   Coverage by rollout phase:

   | Phase | Staging coverage |
   | --- | ---: |
   | 1 | `0/5` |
   | 2 | `20/20` |
   | 3 | `20/20` |
   | 4 | `19/20`; the missing row is Delta, now excluded |
   | 5 | `17/20` plus `1` note-only entry; Monteverde is excluded, The Vine and Townestone are already governed live pilots |
   | 6 | `7/7` in rollout sheet |

1. Phase 6 count mismatch

   The schedule says Phase 6 has 8 properties, and the tracking sheet has 8 Phase 6 rows. The rollout sheet has only 7. Riverbend (`TX4RB`) appears in `Tracking URLs` with no vanity domain or source-coded URLs, and `QA Pastel Links.docx` includes staging URL `https://riverbendb.kinsta.cloud/`.

2. Phase 1 status meaning

   `Property Rollout URLs` marks Ventana, District, Champions Green, Calais Midtown, and Harrison as `Live`. This appears to mean vanity-domain rollout status. It does not mean they are all current-contract Resi Edge package proofs. District is still `planned_not_live` in the governed register, Calais is excluded as an experiment/lesson source, and Harrison does not yet have a canonical Resi Edge manifest.

3. URL/domain formatting cleanup needed

   Several domains have trailing spaces or uppercase letters in the rollout/tracking source:

   - `lumaheadwaters.com `
   - `BradfordMills.com `
   - `estanciamorningstar.com `
   - `Northbridgeapartments.com`
   - `collegeviewapts.com `
   - `villascontinental.com `

   Normalize to lowercase, trimmed hostnames before generating manifests, Cloudflare route names, redirect maps, GSC properties, Ahrefs lookups, or source-coded URL checks.

4. Tracking URL exception

   Axial Buckhead (`GA4AB`) has a Google Ads URL of `https://axialbuckhead.com/?id=GA4AB&utm_source=googleleads&utm_medium=cpc`, which does not include the `GOA` source suffix used elsewhere. Confirm whether this is intentional before launch.

5. Identity URL mismatches to reconcile

   All tracking property codes resolve in the governed identity matrix, but these source URLs differ from the matrix value and need reconciliation before automated manifest generation:

   - Bradford Mills (`KY4BM`): workbook uses `/bradford-mills-apartments/`; matrix uses `/bradford-mills-lofts/`.
   - Delta (`TX4DP`): excluded from this rollout because it is a lease-up with its own template; do not queue for move/preflight unless explicitly re-approved.
   - Botanic (`GA4BL`): tracking sheet lists `https://thebotanicapartments.com/` in the VenterraLiving-domain column; matrix uses `/botanic-apartments/`.
   - Cendana District West (`TX4CD`): workbook uses `/cendana-district-west/`; matrix uses `https://cendanalife.com/`.
   - Fairways (`TX4FA`): workbook uses `/fairways/`; matrix uses `/fairways-at-south-shore/`.

6. Staging Kinsta URL cleanup

   Staging URL issues found in `QA Pastel Links.docx`:

   - Cobblestone at Eagle Harbor (`FL4CE`): `http://cobblestoneateagleharbor.kinsta.cloud/` is `http`, not `https`.
   - Mission Mayfield Downs (`TX4MF`): `http://missionmayfielddowns.kinsta.cloud/` is `http`, not `https`.
   - Republic Park Vista (`TX4RV`): `http://republicparkvista.kinsta.cloud/` is `http`, not `https`.
   - Trevesta Place Apartments (`FL4TV`): `https://trevestaplaceapartments.kinsta.cloud` is missing a trailing slash.
   - Monteverde (`TX4MV`) has no staging URL in the document and should not move through this rollout because it is a lease-up with its own template.
   - Delta (`TX4DP`) has no staging URL in the document and should not move through this rollout because it is a lease-up with its own template.
   - The Vine (`TX4EK`) and Townestone (`TX4FC`) have no staging URLs in the document; they are already governed live pilot properties.

7. Stoneridge vanity URL confirmation

   Stoneridge's public vanity URL is `stoneridgehouston.com`. The staging Kinsta source in `QA Pastel Links.docx` is `https://stoneridgeonthe8.kinsta.cloud/`; do not infer the public vanity from the staging hostname.

## Phase 2 Batch

Phase 2 is the first upcoming 20-property batch for 08/19/2026.

| Property | Code | Vanity domain | Staging Kinsta URL |
| --- | --- | --- | --- |
| Anatole Norman | `OK4AN` | `anatoleatnorman.com` | `https://anatoleatnorman.kinsta.cloud/` |
| Carlyle Place | `TX4CP` | `carlyleplacesa.com` | `https://carlyleplaceapartments.kinsta.cloud/` |
| Village Walk | `FL4VW` | `villagewalkapts.com` | `https://villagewalk.kinsta.cloud/` |
| Kedron | `GA4KV` | `retreatatkedronvillage.com` | `https://retreatatkedronvillage.kinsta.cloud/` |
| Tuscany | `GA4TU` | `tuscanylindbergh.com` | `https://tuscanyatlindbergh.kinsta.cloud/` |
| Phoenix | `TX4PX` | `phoenixfortworth.com` | `https://thephoenix.kinsta.cloud/` |
| Creekside | `OK4CS` | `creeksideapt.com` | `https://creeksideapartmenthomes.kinsta.cloud/` |
| Lakeside | `OK4BL` | `blvdatlakeside.com` | `https://boulevardatlakeside.kinsta.cloud/` |
| Luma Headwaters | `FL4LH` | `lumaheadwaters.com` | `https://lumaheadwaters.kinsta.cloud/` |
| Canton Mill Lofts | `GA4CM` | `livecantonmill.com` | `https://cantonmilllofts.kinsta.cloud/` |
| San Palmilla | `TX4SP` | `sanpalmilla-houston.com` | `https://sanpalmilla.kinsta.cloud/` |
| Links at Windsor | `FL4WP` | `linksatwindsorparke.com` | `https://linksatwindsorparke.kinsta.cloud/` |
| Stonecreek | `TX4ST` | `stonecreekranchapartments.com` | `https://stonecreekranch.kinsta.cloud/` |
| Wurzbach | `TX4WZ` | `parkonwurzbach.com` | `https://parkonwurzbach.kinsta.cloud/` |
| Metropolitan | `KY4MP` | `themetropolitankentuckyapts.com` | `https://themetropolitan.kinsta.cloud/` |
| Axial Buckhead | `GA4AB` | `axialbuckhead.com` | `https://axialbuckhead.kinsta.cloud/` |
| Forest View | `TX4FV` | `liveatforestviewapts.com` | `https://forestview.kinsta.cloud/` |
| Timberlane | `MO4TL` | `timberlanevillageapts.com` | `https://timberlanevillageapartments.kinsta.cloud/` |
| Balmoral | `GA4BV` | `balmoralvillageapts.com` | `https://balmoralvillage.kinsta.cloud/` |
| Whitney | `GA4TW` | `thewhitneysandysprings.com` | `https://thewhitney.kinsta.cloud/` |

## Launch Surfaces From The Tasks Sheet

Launch-day URL update surfaces:

| Surface | Owner |
| --- | --- |
| Encasa | Chris |
| Facebook | Chris |
| Instagram | Chris |
| Google Business Profile | Alex |
| Google Ads / GOA | Alex |
| EliseAI | James |
| Anyone Home | James |
| Print collateral handoff to Benson | Chris |

The task sheet estimates 5 minutes per property for URL updates across all platforms. That estimate covers coordination/update effort, not Resi Edge package staging, visual proof, PSI, analytics proof, consent proof, GSC/Captain/Data Pond evidence, or rollback verification.

## Preparation Steps Needed Before Phase 2

1. Normalize the workbook into a governed batch queue.

   Required fields: phase, go-live date, property code, property name, canonical identity, VenterraLiving source URL, vanity domain, staging Kinsta URL, Pastel QA URL, selected tracking URLs, GBP URL, GOA URL, region, units, owner surface status, and data-quality flags.

2. Reconcile identity conflicts.

   Resolve Riverbend vanity-domain absence, Axial Buckhead GOA source suffix, the five identity URL mismatches, and domain formatting warnings before generating launch manifests.

3. Create a non-mutating batch preflight.

   The batch preflight should read the queue and report blockers without changing Cloudflare, WordPress, Zaraz, Ahrefs, GSC, Captain, Data Pond, DNS, or cache. It should check identity resolution, manifest readiness, domain normalization, staging Kinsta reachability, tracking URL patterns, Ahrefs existing-profile decision, GSC property readiness, Captain/Data Pond evidence presence, R2 asset plan readiness, source specials/reviews/awards/phone availability, rollback target, and current-contract pilot status.

4. Generate property manifests from the canonical package only.

   Do not use old Champions or Calais experiments as sources. Manifests should be data-only and should resolve identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.

5. Refresh current pilot proof before batch rollout.

   Existing live pilot packets predate `wordpress_control_path_bypass_proven`. Keep the launch capped until fresh current-contract proof exists. When explicitly approved for live mutation, refresh Townestone first, then Champions, Ventana, and The Vine.

6. Establish vanity-domain authority checklist.

   For each domain: Cloudflare zone/DNS ownership, route ownership, redirect target, canonical URL policy, robots/sitemap posture, GSC domain or URL-prefix property, Ahrefs lookup-first profile decision, Zaraz zone/tool mapping, R2 asset namespace path, and rollback target.

   Use the staging Kinsta URL as a pre-launch source/origin validation input, but do not treat it as proof that the vanity domain accepts the correct Host header or that public vanity-domain launch gates are complete.

7. Build launch-day runbook by batch.

   Separate pre-launch preparation, day-of redirect/platform updates, package stage/apply gates, and post-launch proof. No failed gate should be bypassed or patched live.

## Phase 2 Preflight Packet

The non-mutating Phase 2 preflight builder is now `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_preflight.py`.

Generated packet:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T164031Z/PHASE_PREFLIGHT_READOUT.md`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T164031Z/phase-preflight.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T164031Z/phase-preflight.csv`

Boundaries: the packet performed no Cloudflare, DNS, WordPress, Zaraz, Ahrefs, GSC, Captain, Data Pond, R2, cache, or live-domain mutation.

Readiness result for the 08/19/2026 Phase 2 batch:

- `20` total properties.
- `20/20` staging Kinsta URLs returned HTTP `200`.
- `1` property is `source_ready`: Canton Mill Lofts (`GA4CM`).
- `12` properties are `source_ready_manifest_needed`; their staging URL, tracking URL, identity, and Cloudflare zone evidence are present, but canonical Resi Edge manifests still need to be generated.
- `1` property is `needs_decision`: Axial Buckhead (`GA4AB`) because the Google Ads tracking URL lacks the normal `GOA` source suffix.
- `6` properties are blocked because their vanity domains were not found in the fresh read-only Cloudflare inventory: Village Walk (`FL4VW`), Tuscany (`GA4TU`), Phoenix (`TX4PX`), Stonecreek (`TX4ST`), Wurzbach (`TX4WZ`), and Metropolitan (`KY4MP`).

Follow-up confirmation on 08/15/2026:

- Fresh read-only Cloudflare inventory packet: `/Users/mark/Property_Analytics/reports/domain_ops/20260815_165840_cloudflare_zone_inventory/`.
- The six previously missing zones are now present, active, full zones, and not paused:
  - `villagewalkapts.com`
  - `tuscanylindbergh.com`
  - `phoenixfortworth.com`
  - `stonecreekranchapartments.com`
  - `parkonwurzbach.com`
  - `themetropolitankentuckyapts.com`
- Updated preflight packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T165857Z/`.
- Updated result: `0` blocked, `1` source-ready, `18` source-ready-manifest-needed, and `1` needs-decision.

Tracking correction on 08/15/2026:

- Mark approved correcting Axial Buckhead's Google Ads tracking URL to the standard `GA4ABGOA` source-id pattern.
- Updated `/Users/mark/Downloads/Property Vanity URLs for RollOut.xlsx`, sheet `Tracking URLs`, cell `K3`.
- Corrected value: `https://axialbuckhead.com/?id=GA4ABGOA&utm_source=googleleads&utm_medium=cpc`.
- Updated preflight packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T170401Z/`.
- Updated result: `0` blocked, `0` needs-decision, `1` source-ready, and `19` source-ready-manifest-needed.

Manifest matching correction on 08/15/2026:

- The preflight originally over-credited Canton Mill Lofts because manifest discovery did raw text matching and picked up a Calais warning that mentions `GA4CM`.
- `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_preflight.py` now parses manifest JSON and only counts a manifest when `target.domain`, `routing.cloudflare_zone_name`, `target.property_code`, or `target.source_property_code` actually matches the property.
- Corrected preflight packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T171327Z/`.
- Corrected result: `0` blocked, `0` needs-decision, `0` source-ready, and `20` source-ready-manifest-needed.

## Phase 2 Manifest Prep Packet

The non-mutating manifest prep builder is now `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_manifest_prep.py`.

Generated packet:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T171230Z/MANIFEST_PREP_READOUT.md`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T171230Z/manifest-prep.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T171230Z/manifest-prep.csv`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T171230Z/draft-manifests/`

Boundaries: the packet writes report-scoped draft manifests only. It does not write active manifests under `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/`, and it performs no Cloudflare, DNS, WordPress, Zaraz, Ahrefs, GSC, Captain, Data Pond, R2, cache, or live-domain mutation.

Prep result:

- `20` draft manifests written.
- `0` active manifest matches.
- `0` promote-ready manifests.
- `20/20` drafts have GA4 measurement IDs from the Google landscape audit.
- `20/20` drafts have governed source-phone rows from the Resi source lookup packet.
- Every draft still contains `required_before_apply` fields for source/evidence gaps: staging hero/content/source-image audit, brand/theme tokens, review row proof, award/special concession proof, Ahrefs existing-profile lookup, GSC URL Inspection evidence, Captain/Data Pond handoff, rollback snapshot, and stage/live proof placeholders.

## Recommended Next Decision

Run the Phase 2 source-audit fill pass against the Kinsta staging URLs to replace draft `required_before_apply` fields with sourced hero/content/review/award/special/theme/meta evidence. Do not promote any draft into the active manifest directory, stage, or live apply until explicit approval and current-contract gates pass.
