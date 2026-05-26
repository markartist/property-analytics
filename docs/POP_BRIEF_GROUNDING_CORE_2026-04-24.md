# POP Brief Grounding Core

Status: Draft v1
Date: 2026-04-24
Owner: MarketingOps / Property Analytics
Scope: POP Brief / Captain's Log grounding layer for property-level operational intelligence

## Purpose

The POP Brief grounding core is the governed layer between raw source material and final property artifacts.

It exists so recurring vendor reports, Data Pond facts, live property-page context, Captain's Log memory, and PIB-family intelligence can produce one reliable property truth substrate before any brief, playbook, memo, content recommendation, or leadership artifact is generated.

This does not change locked PIB generation or rendering behavior.

Companion standards:

- `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md`
- `/Users/mark/Property_Analytics/reports/property_evaluation/templates/property_evaluation_resolution_brief_template.md`
- `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md`

## Governing Principle

Data Pond facts are authoritative for internal operational truth.

External reports are intelligence sources. They can introduce useful market context, competitor framing, leasing language, and recommendations, but their inferred property metrics do not govern operating truth when Data Pond has the source-of-record value.

## Source Roles

| Source | Role | Authority |
| --- | --- | --- |
| Data Pond | Occupancy, leased rate, guest cards, applications, tours, move-ins, move-outs, delinquency, availability, floorplan inventory, unit-level pricing/specials, GA4/GSC/GBP, marketing records | Authoritative for internal facts |
| ApartmentIQ / AptIQ reports | Market/comps context, concession observations, competitor positioning, floorplan comparison, leasing scripts, strategy suggestions | Advisory; Data Pond governs internal facts |
| Live property page / unit feed | Public copy, visible pricing, availability, amenities, claims, review display, current unit-level concession language | Authoritative for public-page state at crawl time |
| Captain's Log | Durable property memory, decisions, watch items, follow-up commitments, human-approved context | Authoritative for governed memory, not raw facts |
| PIB infrastructure | Existing property intelligence patterns, evidence discipline, artifact family expectations | Artifact and interpretation layer |

## Core Objects

### Source Document

A captured source document or source snapshot.

Examples:

- AptIQ operational performance report
- AptIQ leasing associate playbook
- AptIQ market / AI strategy report
- live property-page crawl
- Data Pond fact extract for a week/window
- human-authored operator note

### Claim

A normalized statement extracted from a source.

Claims should be small enough to reconcile. For example:

- "The Pointe is 90.0% leased."
- "The Pointe has 61 available units."
- "The $3,000 concession is materially above comp average."
- "B1 two-bedroom inventory is the most urgent floorplan pressure."
- "Leasing team should use a 48-hour follow-up protocol for applicants."

### Reconciliation

The comparison between a claim and an authoritative or preferred source.

Expected statuses:

- `vendor_only`: useful but not yet verified
- `pond_verified`: source claim matches Data Pond or another authoritative source
- `pond_overridden`: source claim conflicts with Data Pond and Data Pond wins
- `conflict`: more than one source disagrees and needs review
- `needs_review`: incomplete source lineage or unclear interpretation
- `rejected`: not safe to use

### Artifact Block

A brief-ready chunk assembled from reconciled claims.

Artifact blocks should be reusable across:

- POP Brief
- Captain's Log update
- leasing playbook
- executive property brief
- marketing/content brief
- concession strategy memo
- future PIB-family outputs

## Claim Model

Each claim should carry:

- `property_id`
- `community_id` where available
- `source_document_id`
- `claim_type`
- `subject`
- `statement`
- `metric_code` if metric-backed
- `metric_window`
- `source_value`
- `normalized_value`
- `unit`
- `authority`
- `truth_status`
- `source_authority`
- `priority`
- `evidence`
- `recommended_action`
- `owner_role`
- `due_date`
- `status`

## Reconciliation Rules

1. If AptIQ states occupancy, leased rate, guest cards, applications, tour counts, cancellations, availability, or floorplan inventory, publish the Data Pond source-of-record value when it exists.
2. If Data Pond and AptIQ differ, preserve the AptIQ claim as source evidence but mark the publishable claim as `pond_overridden`.
3. If AptIQ provides competitor concessions, competitor rents, competitor occupancy, or strategic positioning, preserve as `vendor_only` unless another trusted market source is available.
4. If the live property page contradicts the source report on public facts such as address, review display, active concession language, visible pricing, or availability, mark the conflict explicitly.
5. Human decisions, approvals, and follow-up commitments belong in Captain's Log, linked back to the underlying claims and reconciliations.
6. Generated artifacts may only use claims with `pond_verified`, `pond_overridden`, `vendor_only`, or explicitly approved `needs_review` status.

## The Pointe Bentonville Pilot Notes

Property:

- Registry name: The Pointe Bentonville
- Canonical URL: `https://venterraliving.com/apartments/the-pointe-bentonville/`
- Data Pond property id: `482958962`
- Encasa short name: `Pointe`
- Property code observed in guest card facts: `AR4PB`
- Unit count: 452

Initial observations from the April 2026 documents:

- AptIQ consistently frames the central issue as demand existing but conversion economics being too expensive.
- The strongest recurring recommendations are targeted concessions, applicant follow-up, floorplan-level inventory review, and better messaging around unusually large floorplans.
- AptIQ report versions disagree on some T30 figures, including applications and leases, so report-to-report consistency must be checked before publishing.
- The live property page uses `72713`, while at least one report uses `72712`; this should be a source conflict until a canonical address source is confirmed.
- The live page displays "Out of 784 Reviews," while AptIQ uses a Google rating / review count shape; those should not be blended without labeling the source.
- Data Pond guest-card facts and unit availability are already available for this property and should be used as the factual base.

## Recommended Product Shape

The final POP Brief should not be a single static report. It should be a composed read model with these sections:

1. Truth Snapshot
2. Market Pressure
3. Operational Diagnosis
4. Revenue / Concession Risk
5. Floorplan Watch
6. Leasing Team Moves
7. Marketing / Content Moves
8. Captain's Log Decisions
9. Open Conflicts and Review Items

The grounding core should produce this read model first, then render artifacts from it.

For watchlist, spotlight, and critical-property recovery work, this read model must follow the diagnostic recommendation standard:

- begin with recovery math and the primary constraint
- diagnose the funnel before moving upstream
- branch into floorplan, pricing, source/spend, website/content, reputation, operations, and people constraints only when evidence supports that branch
- require every recommendation to carry evidence, confidence, owner, due date, expected lift, and proof check
- produce an internal diagnostic plus a concise property action plan from the same governed read model

## Captain Role

The Captain is the property-scoped operator of the grounding core.

The Captain is responsible for keeping the property's source set current, reconciling claims against Data Pond, maintaining Captain's Log memory, and preparing Supervisor-ready updates when decisions or persistent issues require attention.

Canonical role model:

- `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`

Pilot tasking:

- `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md`

## Implementation Path

Phase 1:

- Add durable tables for source documents, claims, reconciliations, and artifact blocks.
- Add shared schemas and types so API, UI, and ingestion scripts agree on status and claim shape.
- Document the source authority hierarchy.

Phase 2:

- Build a local/importer path for recurring AptIQ DOCX reports.
- Extract normalized claims with source line/document references.
- Reconcile claims against Data Pond facts for the same property and window.

Phase 3:

- Surface a grounding review panel inside the POP Brief lane.
- Allow approved claims and decisions to write Captain's Log entries.
- Generate reusable artifact blocks from reconciled claims.

Phase 4:

- Use the same grounding layer to produce final executive, leasing, marketing, and content artifacts.
