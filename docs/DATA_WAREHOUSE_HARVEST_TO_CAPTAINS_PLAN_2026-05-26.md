# Data Warehouse Harvest To Captains Plan

Status: Proposed implementation plan
Date: 2026-05-26
Owner: Data Collection / Data Pond / Captain Runtime
Related source map: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_POND_INTEGRATION_MAP_2026-05-26.md`
Current shadow runbook: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DAILY_SHADOW_HARVEST_RUNBOOK_2026-05-26.md`
Captain signal flow: `/Users/mark/Property_Analytics/docs/CAPTAIN_SIGNAL_FLOW_2026-05-26.md`

## Purpose

Responsibly harvest the newly reachable corporate Data Warehouse into The Pond so Property Captains and system surfaces can use it as governed, validated evidence rather than raw SQL access or manual workbook folklore.

The plan is validation-first:

1. prove source contracts against existing exports and workbooks
2. harvest only the minimum useful fields
3. normalize through property identity and Data Collection
4. publish health/trust posture before Captain consumption
5. expose Captain-ready signals, not raw personally identifiable leasing records

## Operating Principles

- Keeper/KSM remains the credential source of truth for Data Warehouse access.
- `dw_reader` stays read-only; no write, temp-table-dependent production jobs, or privileged metadata assumptions.
- Use `dw_read` views before raw `dbo` tables unless the approved source query requires a `dbo` object.
- Harvest date-windowed deltas; avoid broad scans of large warehouse tables.
- Resolve every property through `Data_Collection/utils/property_identity.py` and `config/property_identity_matrix.json`.
- Store lineage: source object, query version, run time, data-through date, row counts, and validation status.
- Captains get aggregates, trends, exceptions, and source links. They do not get raw prospect PII by default.
- Captain memory may interpret warehouse facts, but it must not override current source-of-record facts.

## Source Domains And Captain Uses

| Domain | Initial Harvest | Captain Routine | Captain-Ready Output |
| --- | --- | --- | --- |
| Property reference | active property roster, aliases, status, reporting flags, region/address fields | Source Readiness / Property Memory | identity reconciliation warnings, active roster changes, missing property mappings |
| Leasing funnel | guest cards, contact type mix, portal quotes, online apps, pipeline apps, IPT/SGT appointments | Funnel Watch | property T1/T7/T30/T90 funnel movement, source leakage, quote/app/tour conversion watch items |
| Marketing attribution | source codes, descriptions, active flags, vendor/site mapping | Channel Efficiency Watch | source output by property, unmapped source warnings, paid/vendor attribution candidates |
| Resident voice | Kingsley survey responses, question metadata, scales, verbatims where approved | Reputation And Friction Watch | resident voice themes, trust blockers, response trend posture, survey freshness |
| Pricing / availability / lease ops | lease expiry, pricing sheet, available/vacant/product candidates | Inventory And Product Watch | exposure pressure, floorplan/product mismatch, pricing-definition watch items |
| Service operations | service requests and performance views | Reputation And Friction Watch / Action And Proof Loop | service friction signals, completion posture, recurring experience blockers |

## Phase 0: Source Contract Lock

Goal: turn current access into documented contracts before harvesting more data.

Deliverables:

- Store source contracts for:
  - daily guest-card CSV
  - Kingsley/reputation workbook candidate
  - BI/Measurement workbook candidate
- For each contract define:
  - source objects
  - grain
  - property key
  - date key
  - selected fields
  - excluded sensitive fields
  - filters
  - expected output schema
  - known workbook/export comparison target
- Add a Data Warehouse source registry entry under Data Collection config once implementation begins.

Exit gate:

- The daily guest-card SQL contract is documented and can regenerate at least five historical daily files that reconcile to current exports by property and metric total.

## Phase 1: Guest-Card Lane To Canonical Collection

Goal: replace the fragile manual/PAD export dependency without changing downstream meaning.

Current shadow routine:

- `/Users/mark/Property_Analytics/scripts/run_data_warehouse_daily_harvest.mjs` runs a Keeper/KSM-backed, read-only, aggregate-only harvest for the completed prior day.
- The routine writes timestamped packets under `/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/`.
- Codex local automation `data-warehouse-daily-shadow-harvest` is active as a daily morning run, dependent on VPN and Keeper/KSM availability.
- First clean packet: `/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/2026-05-26_20260526_152346`.
- First clean packet totals for completed window `2026-05-25` to `2026-05-26`: 363 guest cards, 185 portal quotes, 89 online apps, 3 pipeline apps, 62 IPT appointments, 41 SGT appointments, 18 business watch items, and 1 data-quality item.
- The data-quality item flags future-dated `dbo.dw_prospect_log_entry.created_dtt`; this must remain visible as source-health evidence before promotion.
- The current Captain-facing advisory generator is `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_captain_advisory.mjs`; it produces machine-readable and Markdown packets under `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/`.
- The current reconciliation gate is `/Users/mark/Property_Analytics/scripts/reconcile_data_warehouse_guest_card_exports.mjs`; latest proof-set result is documented at `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_GUEST_CARD_RECONCILIATION_2026-05-26.md` and keeps the lane advisory because 8 of 10 recent historical files had small metric deltas.
- The direct no-CSV supply path is `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`; it writes `guest_card_metrics_dw_direct` by default and can update canonical `guest_card_metrics` only with explicit `--apply-canonical --trusted-core-only`.

Implementation:

1. Build a Keeper-backed Data Warehouse client helper for local collection runtime.
2. Implement a `DataWarehouseGuestCardExtractor` that can produce the current CSV schema exactly.
3. Run it in shadow mode:
   - write generated files to a validation folder
   - compare against existing OneDrive exports
   - record metric deltas by `run_date`, `property_cd`, and column
4. After reconciliation, choose promotion path:
   - safe first promotion: generate the same CSV into the existing OneDrive drop
   - mature promotion: write directly into `guest_card_metrics` with the same validation checks
5. Keep the existing CSV collector until direct ingest has proven stable.

Captain outputs:

- `guest_cards`
- `quotes`
- `online_apps`
- `pipeline_apps`
- `tour_appointments`
- `init_contact_mix`
- period-over-period funnel deltas

Exit gate:

- Watchtower shows guest-card source health from a Data Warehouse-backed run, and Captains can consume the funnel lane with `trusted` or explicitly `stale/degraded` posture.

## Phase 2: Pipeline Health And Source Readiness

Goal: make warehouse-derived lanes safe for system and agent use.

Implementation:

- Create pipeline health domain keys for:
  - `dw_property_reference`
  - `dw_leasing_funnel`
  - `dw_marketing_attribution`
  - `dw_resident_voice`
  - `dw_pricing_availability`
  - `dw_service_operations`
- For each domain, emit system-state events for:
  - extraction started/succeeded/failed
  - validation succeeded/failed
  - contract mismatch
  - stale data detected
  - property identity mismatch
- Compute Pipeline Health Snapshots before any Captain run uses the data.
- Make Captain routines read the latest health snapshot and block/degrade when trust posture is below policy.

Exit gate:

- Captains can answer: "Which source lanes are fresh, stale, missing, or blocked for this property today?"

## Phase 3: Captain Signal Packs

Goal: convert warehouse facts into Captain-ready property signals.

Create a property-scoped signal pack for each active property:

- `source_readiness`
  - latest data-through date per DW domain
  - missing/stale lanes
  - identity mismatches
- `funnel_watch`
  - T1/T7/T30/T90 guest cards, quotes, apps, tours
  - prior-period deltas
  - property-vs-portfolio benchmark
  - source/contact mix shifts
- `channel_efficiency_watch`
  - source/vendor contribution where mapping is validated
  - unmapped marketing source alerts
- `reputation_friction_watch`
  - Kingsley response recency
  - low-score / recurring-theme signals
  - service-friction overlays where approved
- `inventory_product_watch`
  - lease expiry/product pressure
  - pricing/availability candidate signals marked advisory until definitions are approved
- `action_proof_loop`
  - after-action watch: did the targeted signal move after an action was completed?

Storage pattern:

- Store normalized facts separately from Captain interpretations.
- Store generated Captain signal packs with lineage to source batch IDs and health snapshot IDs.
- Store Captain recommendations in Captain memory/logs only after signal packs pass minimum trust posture.

Exit gate:

- A Captain Read can cite the exact signal pack and pipeline health snapshot used for each recommendation.

## Phase 4: Resident Voice And Reputation Expansion

Goal: bring Kingsley and service-friction evidence into reputation routines responsibly.

Implementation:

1. Reconcile Kingsley response counts and latest dates against known workbooks/feeds.
2. Define approved question groupings and sentiment/theme extraction boundaries.
3. Decide how verbatims are handled:
   - aggregate-only by default
   - short excerpts only when allowed and needed
   - no broad raw comment exposure in Captain summaries
4. Cross-check against GBP/Reputation.com lanes without merging sources into one false "truth."

Exit gate:

- Captains can distinguish public review reputation, Kingsley resident voice, and service friction as separate evidence lanes.

## Phase 5: Pricing, Availability, And Service Ops

Goal: add high-value operational context after metric owners approve definitions.

Implementation:

- Start with lease expiry and pricing-sheet views, not giant raw pricing/fact tables.
- Identify metric owners for:
  - effective pricing posture
  - available/vacant inventory
  - make-ready/service blockers
  - lease expiry pressure
- Build advisory-only signal packs first.
- Promote to trusted Captain signals only after definitions reconcile to existing approved reporting.

Exit gate:

- Inventory/Product Watch can state whether product pressure is data-backed, advisory, or blocked by definition gaps.

## Validation Framework

Every harvested domain needs these checks:

- row count by extraction date
- active property coverage
- unmapped property count
- duplicate key count
- min/max source date
- comparison to known export/workbook when available
- null/blank rate for required fields
- contract version match
- PII exclusion check
- query runtime and timeout record

Validation statuses:

- `validated`: safe for Captain/system use
- `validation_pending`: stored but not used by Captains
- `validation_failed`: blocked from Captain recommendations
- `advisory`: visible but not authoritative

## Data Minimization And Sensitive Fields

Default exclude:

- prospect names
- emails
- phone numbers
- raw notes
- applicant/resident names
- unit-level identifiers unless a specific approved use requires them
- raw verbatims unless approved for a resident voice lane

Default include:

- property code
- canonical property identity
- dates
- aggregate counts
- source/contact categories
- approved status/category fields
- derived trends and deltas
- source lineage and health posture

## System Surfaces

Watchtower:

- show Data Warehouse upstream status
- show source freshness by DW domain
- show validation failures and property identity mismatches
- show whether a domain is trusted, stale, degraded, or unavailable

System / Pond landscape:

- keep `data_warehouse_upstream` represented as an external governed source
- keep trust boundary `corporate_vpn_sql_readonly`
- link to source contracts and validation results

Captain surfaces:

- show only Captain-ready signal packs
- display stale/degraded badges when source health is below trust threshold
- cite source snapshot/batch IDs in recommendations

## First 30 Days

Week 1:

- finalize guest-card source contract
- build shadow exporter
- compare five historical files
- document reconciliation deltas

Week 2:

- add canonical Data Collection extractor behind a feature flag
- emit validation artifacts and source health for guest-card lane
- wire Watchtower source visibility

Week 3:

- create initial Captain funnel signal pack
- bind signal pack to Pipeline Health Snapshot
- test on 5-10 properties with known recent activity

Week 4:

- begin Kingsley/reputation source contract
- produce first resident voice reconciliation report
- define what remains advisory vs trusted

## Open Decisions

- Should the first production step generate CSVs into OneDrive, or write directly to `guest_card_metrics` after shadow validation?
- Who signs off on Kingsley/verbatim handling and service-request sensitive-field boundaries?
- Which metric owner approves pricing/availability definitions?
- Should Data Warehouse extraction run on Mark's local runtime, a teammate PC, or a controlled internal server once stable?
- What minimum trust posture should each Captain routine require for each DW domain?

## Definition Of Done

The harvest is responsible when:

- source contracts are documented
- credentials are Keeper-backed
- property identity is governed
- sensitive fields are excluded by default
- validation gates run before publication
- Pipeline Health Snapshots represent domain trust
- Watchtower exposes failures and freshness
- Captain outputs cite lineage and trust posture
- manual exports are retired only after reconciliation proves replacement quality
