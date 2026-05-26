# Venterra Edge Experimentation System Production Plan

Date: 2026-05-02
Owner: Data Pond + Site Content Creator + EVS + Cloudflare Ops
Status: Production plan / not yet implemented

Implementation note, 2026-05-02:

- The first non-mutating Data Pond slice now exists:
  - local and remote migration files for Edge Experimentation tables.
  - shared experiment schemas and types.
  - guarded API route at `/v1/experiments`.
  - admin-only Data Pond UI at `/experiments`.
  - seeded MVP component contracts for `property_homepage.hero_primary_cta` and `property_homepage.hero_secondary_cta`.
- Live Worker execution remains intentionally locked until dry-run and EVS proof are implemented.

## Purpose

The Venterra Edge Experimentation System is the governed way to run small,
measurable experience changes on Venterra property websites.

It is not a standalone A/B testing tool and it is not a general-purpose
personalization engine. It is a Data Pond-governed, Cloudflare-executed,
evidence-producing optimization lane that lets Venterra test tightly scoped site
changes without adding client-side payload, breaking Specs structure, or losing
the learning loop inside disconnected vendor dashboards.

The production posture is:

- Data Pond is the system of record for experiment definitions, approvals,
  status, assignments, exposures, decisions, and learnings.
- Cloudflare Workers execute approved changes at the edge.
- Zaraz routes normalized experiment events into analytics tools.
- GA4 is the primary business KPI measurement source for on-site outcomes.
- Heap is the behavioral exploration source when available.
- EVS validates selector health, rendering, CTA behavior, and post-launch proof.
- Site Content Creator and Specs define the governed components that can be
  changed.
- Captain / Navigator lanes may recommend experiments, but execution requires
  governed approval and platform guardrails.

## Source Concept

The seed concept came from:

- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Resources/Venterra Edge Experimentation System (data Pond Integration).docx`

This plan tailors that concept to the current Property Analytics architecture.
It should extend existing canonical systems rather than creating a parallel
experimentation app.

Companion implementation-planning artifacts:

- `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md`
- `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md`
- `/Users/mark/Property_Analytics/docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md`
- `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md`

## Guiding Principles

### 1. Governed Small Changes Only

Allowed in phase 1:

- text swap
- class swap
- CTA label change
- approved link change
- adjacent secondary CTA insertion
- small module show/hide only after selector and accessibility validation

Not allowed in phase 1:

- layout restructuring
- form logic changes
- checkout/application flow changes
- pricing or availability manipulation
- heavy JavaScript interactions
- client-side testing libraries
- complex personalization
- changes on pages without governed component mappings

### 2. Edge Execution, Pond Governance

Cloudflare can execute fast, but it must not become the source of product truth.
The Worker reads approved, versioned experiment config. It does not invent
experiments, make promotion decisions, or mutate business definitions.

### 3. Data Pond Holds the Ledger

GA4 and Heap are measurement destinations, not the complete record. Data Pond
must retain an exposure and decision ledger because analytics tools can be
delayed, sampled, blocked, filtered, or reconfigured.

### 4. Specs Before Selectors

Experiments target governed components, not arbitrary CSS. A target selector
must be traceable to a Specs section, Site Content Creator section mapping, or
approved component contract. Selector drift is treated as a safety signal, not a
minor logging detail.

### 5. Evidence Before Promotion

Manual promotion is required for MVP. Auto-promotion is a later capability and
must wait until exposure data, conversion readouts, CWV guardrails, EVS proof,
and rollback behavior are proven.

## Canonical Ownership

| Area | Owner | Responsibility |
| --- | --- | --- |
| Experiment definitions | Data Pond | Store canonical experiment, variant, targeting, status, approval, and decision records. |
| Property identity | Data Pond | Resolve property code, community id, URL, GA4 id, GSC URL, and aliases through the property identity matrix. |
| Component eligibility | Site Content Creator + Specs | Define which page sections/components can be tested and which change types are allowed. |
| Edge execution | Cloudflare Ops | Deploy Worker routes, KV/R2/config cache, HTML rewriting, assignment cookie logic, and exposure transport. |
| Analytics routing | Data Pond + Zaraz | Define normalized event names/properties and route to GA4/Heap without duplicating ad hoc pixels. |
| Validation | EVS + BrowserStack | Verify selector match, rendering, CTA behavior, console health, mobile/desktop screenshots, and post-launch proof. |
| Performance guardrails | Data Collection + Watchtower | Monitor CWV, selector miss rate, Worker errors, conversion softness, and rollback triggers. |
| Recommendations | Captain / Navigator / Signals Officer | Propose candidate tests using Data Pond evidence and memory, without bypassing approval gates. |
| Learnings | Data Pond memory + Captain Logkeeper | Store decisions, reusable patterns, non-results, and property/market-specific context. |

## Relationship To Existing Systems

This capability extends:

- Data Collection: for experiment telemetry ingestion, monitoring, closure, and
  Data Pond writes.
- Site Content Creator: for governed page/component selection and future
  operator drafting.
- Specs: for the component contract and allowed change types.
- EVS: for preflight and post-launch validation.
- Cloudflare cache/full-page work: for edge operational discipline and route
  configuration.
- Watchtower: for operational visibility, stale/missing signals, and rollback
  posture.
- Captain's Log: for recommended experiments, owner/action/proof directives,
  and learning promotion.

It must not become:

- an alternate Site Content Creator.
- a shadow CMS.
- an alternate PIB, POP Brief, or Captain Brief renderer.
- a client-side experimentation snippet.
- a place for one-off property maps or hardcoded identity bundles.

## Authority Model

Data Pond is authoritative for:

- experiment id
- property identity
- page identity
- component identity
- approved status
- variant definition
- assignment policy
- launch/stop/promotion decisions
- exposure ledger
- guardrail outcome
- learning record

Cloudflare Workers are authoritative for:

- edge assignment decision for a request
- assignment cookie persistence
- Worker execution status
- HTML rewrite attempt status
- selector match/miss telemetry
- Worker error telemetry

GA4 is authoritative for:

- on-site business KPI events after analytics collection succeeds
- source/session context inside GA4
- existing conversion definitions used by MarketingOps

Heap is advisory for:

- behavioral exploration
- session-level interaction patterns
- qualitative funnel clues

EVS is authoritative for:

- observed rendering proof across configured profiles
- CTA clickability and link destination proof
- console/request health during validation runs
- selector and component presence proof at test time

Data Collection / Watchtower are authoritative for:

- source freshness
- telemetry ingestion success
- guardrail status
- operational closure state

## Property Identity Requirements

Every experiment must resolve property identity through:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Experiment records should store both the visible property code and internal
community id when available. The Worker-facing payload may include host/path
targeting, but host/path must derive from the governed property identity record
or an approved site contract, not a local one-off map.

Before implementation or launch, run:

```bash
bash scripts/check_property_identity_governance.sh
```

## Production Architecture

### Layer 1: Data Pond Control Plane

Responsibilities:

- experiment creation and approval
- variant definitions
- property/page/component targeting
- status transitions
- launch and rollback records
- source freshness and guardrail visibility
- results and learnings
- API for Worker config export

Initial surfaces:

- API routes under `apps/api/src/routes/experiments.ts`
- web surface under `apps/web/src/app/experiments/`
- shared types under `packages/shared/src/experiment-*`
- migrations in both `apps/api/migrations/` and `infra/migrations/`

The first UI should be operationally modest:

- experiment list
- experiment detail
- launch readiness checklist
- approval/stop/rollback controls
- results and learning summary

The visual builder should wait until the data contract and safety model are
stable.

### Layer 2: Cloudflare Worker Execution

Responsibilities:

- read approved experiment config from a signed API endpoint or replicated KV/R2
- evaluate host/path/property/page targeting
- assign eligible visitors to control or variant
- persist assignment in a first-party cookie
- rewrite HTML using `HTMLRewriter`
- inject experiment metadata attributes
- emit exposure and execution telemetry
- fail open to control when config, selector, or rewrite safety is uncertain

Execution rule:

- No approved config means no experiment.
- No selector match means no rewrite and a selector-miss telemetry event.
- Any Worker error must fail to control and log telemetry.

### Layer 3: Zaraz Event Routing

Responsibilities:

- route normalized events to GA4 and Heap
- avoid duplicate hand-built tags
- preserve a stable event property schema

Core events:

- `experiment_exposure`
- `experiment_click`
- `experiment_conversion`
- `experiment_guardrail_event`
- `experiment_selector_miss`

### Layer 4: Measurement And Guardrails

Primary KPI examples:

- tour click rate
- floorplan click rate
- apply click rate
- guest-card start rate
- guest-card submit rate
- conversion event rate where GA4 already defines the event

Guardrails:

- LCP regression
- INP regression
- CLS regression
- conversion drop
- selector miss rate
- Worker error rate
- analytics event loss
- EVS validation failure
- accessibility regression for changed CTA/module

### Layer 5: Memory And Learning

Data Pond stores:

- decision record
- observed impact
- confidence level
- eligible reuse pattern
- property and market context
- source evidence links
- promotion/reversal notes

Captain Logkeeper can promote repeatable findings into Captain memory, Commodore
memory, or a future Ledger pattern only after the result has source evidence and
decision provenance.

## Proposed Data Model

### `edge_experiments`

One row per experiment.

Required fields:

- `experiment_id`
- `name`
- `status`
- `property_code`
- `community_id`
- `page_type`
- `page_path`
- `component_id`
- `component_contract_source`
- `change_type`
- `primary_metric`
- `guardrail_policy_id`
- `traffic_split_pct`
- `assignment_unit`
- `created_by`
- `approved_by`
- `created_at`
- `approved_at`
- `started_at`
- `ended_at`
- `decision`
- `decision_at`

Recommended statuses:

- `draft`
- `pending_preflight`
- `ready_for_approval`
- `approved`
- `scheduled`
- `running`
- `paused`
- `rolled_back`
- `completed`
- `promoted`
- `rejected`
- `archived`

### `edge_experiment_variants`

One row per experiment variant.

Required fields:

- `experiment_id`
- `variant_key`
- `allocation_pct`
- `action`
- `target_selector`
- `target_component_id`
- `payload_json`
- `html_safety_hash`
- `accessibility_notes`

Allowed MVP actions:

- `text_swap`
- `class_swap`
- `href_swap`
- `insert_adjacent`

### `edge_experiment_assignments`

Optional local ledger for assignment/exposure reconciliation.

Fields:

- `experiment_id`
- `variant_key`
- `anonymous_assignment_id_hash`
- `property_code`
- `community_id`
- `first_seen_at`
- `last_seen_at`
- `exposure_count`
- `assignment_source`

Hash assignment ids before storage. Do not store raw visitor identifiers.

### `edge_experiment_events`

Normalized event ledger.

Fields:

- `event_id`
- `event_name`
- `experiment_id`
- `variant_key`
- `property_code`
- `community_id`
- `page_type`
- `page_path`
- `component_id`
- `session_id_hash`
- `assignment_id_hash`
- `event_timestamp`
- `source`
- `metadata_json`

### `edge_experiment_guardrail_snapshots`

Guardrail evaluation rows.

Fields:

- `experiment_id`
- `snapshot_date`
- `variant_key`
- `lcp_p75_ms`
- `inp_p75_ms`
- `cls_p75`
- `conversion_rate`
- `selector_miss_rate`
- `worker_error_rate`
- `analytics_event_loss_rate`
- `guardrail_status`
- `recommended_action`
- `evidence_json`

### `edge_experiment_decisions`

Decision and audit record.

Fields:

- `experiment_id`
- `decision`
- `decision_by`
- `decision_at`
- `rationale`
- `evidence_summary`
- `promoted_pattern_id`
- `rollback_reference`

### `edge_experiment_learnings`

Reusable pattern memory.

Fields:

- `learning_id`
- `experiment_id`
- `scope`
- `pattern_type`
- `finding`
- `applicability`
- `confidence`
- `supporting_metrics_json`
- `source_evidence_json`
- `promoted_to_memory_at`

## Event Contract

### `experiment_exposure`

Required properties:

- `experiment_id`
- `variant`
- `property_code`
- `community_id`
- `page_type`
- `page_path`
- `component_id`
- `assignment_unit`
- `assignment_source`

### `experiment_click`

Required properties:

- `experiment_id`
- `variant`
- `property_code`
- `community_id`
- `page_type`
- `page_path`
- `component_id`
- `target_href`
- `click_text`

### `experiment_conversion`

Required properties:

- `experiment_id`
- `variant`
- `property_code`
- `community_id`
- `conversion_name`
- `conversion_source`

Conversion linkage should prefer existing GA4 event definitions when possible.
Do not invent competing conversion names for established MarketingOps KPIs.

## Guardrail Policy

MVP default rollback thresholds:

- LCP p75 regression greater than 200 ms against control or recent baseline.
- INP p75 regression greater than 50 ms against control or recent baseline.
- CLS p75 regression greater than 0.03 against control or recent baseline.
- conversion rate drop greater than 10 percent after minimum exposure is met.
- selector miss rate greater than 3 percent over a rolling window.
- Worker rewrite error rate greater than 1 percent.
- EVS post-launch validation failure.
- analytics event loss greater than 10 percent between Worker exposure telemetry
  and GA4/Zaraz arrival after expected delay.

Rollback posture:

- automatic pause is allowed for technical safety failures.
- business metric rollback should alert and recommend stop unless the threshold
  is severe and approved for automatic rollback by policy.
- all rollback actions must write a decision/audit record.

## Approval Model

MVP approval rules:

- Property-level experiment: Data Pond steward approval required.
- Portfolio-wide experiment: Data Pond steward plus MarketingOps leadership
  approval required.
- Any change touching forms, availability, pricing, lease/application paths, or
  legal/compliance copy is out of MVP scope.
- Any experiment without EVS preflight proof cannot launch.
- Any experiment without property identity resolution cannot launch.
- Any experiment without a governed component contract cannot launch.

## Security And Privacy

Rules:

- Use first-party assignment cookies with minimal data.
- Store hashed assignment/session ids in Data Pond.
- Do not store raw PII in experiment event tables.
- Do not expose internal experiment controls to public browsers.
- Worker config endpoint must be authenticated or replicated through a secured
  deployment path.
- Config payloads should be signed or versioned so the Worker can reject stale
  or malformed payloads.
- Respect consent and existing analytics governance for downstream routing.

## MVP Production Plan

### Phase 0: Contract And Design

Deliverables:

- approve this production plan
- create formal source contract
- create database migrations for local SQLite and remote D1
- define shared TypeScript schemas
- define permission model
- define first two eligible homepage component contracts
- define Zaraz event mapping
- define EVS preflight checklist

Exit criteria:

- schema reviewed
- event contract reviewed
- no property identity exceptions
- no arbitrary selector targeting
- rollback rules documented

### Phase 1: Read-Only Control Plane

Deliverables:

- API can list/create draft experiments
- API validates property identity and component contract
- web UI lists draft/approved/running experiments
- Watchtower can show experiment lane posture
- no Worker execution yet

Exit criteria:

- draft creation works for one pilot property
- invalid property/page/component combinations fail closed
- permission checks are in place

### Phase 2: Worker Preflight And Dry Run

Deliverables:

- Worker can fetch approved config in dry-run mode
- Worker can evaluate targeting without rewriting
- Worker can emit selector-match and dry-run telemetry
- EVS can run preflight validation against a target page
- Data Pond ingests dry-run telemetry

Exit criteria:

- no public page mutation
- selector match rate is visible
- Worker errors are visible
- EVS proof is attached to the experiment record

### Phase 3: Single-Property Live Pilot

Deliverables:

- launch one low-risk homepage CTA text or adjacent secondary CTA experiment
- 50/50 assignment with first-party cookie persistence
- exposure, click, and conversion events routed through Zaraz
- Worker telemetry stored in Data Pond
- guardrail snapshots visible
- manual pause/rollback available

Exit criteria:

- no CWV regression beyond threshold
- GA4/Zaraz event arrival reconciles with Worker exposure telemetry
- selector miss rate below threshold
- EVS post-launch proof passes
- decision record can be written

### Phase 4: Limited Multi-Property Pilot

Deliverables:

- expand to 3 to 5 properties with the same component contract
- compare property context and market differences
- store reusable learning candidates
- add Captain/Navigator recommendation intake as draft-only

Exit criteria:

- property identity and component targeting work across all pilot properties
- guardrail behavior remains stable
- results can be compared without manual spreadsheet work

### Phase 5: Production Lane

Deliverables:

- Experiment Lab becomes a governed Data Pond surface
- Site Content Creator can propose eligible tests from approved components
- Captain/Navigator recommendations can create drafts
- Watchtower monitors active experiment health
- results and learnings become queryable historical evidence

Exit criteria:

- production runbook exists
- rollback runbook tested
- permissions tested
- release workflow documented
- support ownership clear

### Phase 6: Later Capabilities

Only after MVP is stable:

- visual experiment builder
- auto-promotion recommendations
- pattern library reuse suggestions
- portfolio-wide deployment templates
- adaptive allocation
- deeper Heap behavioral readouts
- Captain learning promotion into Fleet/Commodore memory

## Launch Readiness Checklist

An experiment can launch only when all are true:

- property identity resolves through the matrix
- page URL derives from governed identity/site contract
- component is Specs/Site Content Creator governed
- change type is allowed
- variant payload passes validation
- Worker dry-run selector match passes
- EVS preflight passes desktop and mobile profiles
- Zaraz event mapping is present
- GA4 event names are confirmed
- guardrail policy is attached
- rollback owner is assigned
- approval record is written

## Operational Runbook

Daily while running:

- check active experiment count
- check Worker errors
- check selector miss rate
- check exposure/event reconciliation
- check CWV guardrails
- check conversion guardrails
- check EVS post-launch proof if changed content deployed

On technical guardrail breach:

1. pause experiment or fail traffic to control
2. write rollback event
3. capture Worker and EVS evidence
4. notify owner
5. record decision outcome

On business metric softness:

1. verify exposure volume and data freshness
2. compare control/variant and recent baseline
3. check traffic/source mix shifts
4. recommend continue, pause, or stop
5. write decision record

## Implementation Workstreams

### Workstream A: Data Contract

- formal source contract
- migrations
- shared schemas
- property identity checks
- event and guardrail validation

### Workstream B: API And Permissions

- CRUD for drafts
- status transition endpoints
- approval controls
- Worker config endpoint
- decision and learning endpoints
- offering permissions for view/draft/approve/administer

### Workstream C: Worker Execution

- config fetch/cache
- assignment cookie
- targeting evaluator
- HTMLRewriter actions
- exposure telemetry
- fail-open-to-control behavior
- signed/versioned config

### Workstream D: Analytics Routing

- Zaraz event configuration
- GA4 event property mapping
- Heap mapping where available
- reconciliation logic

### Workstream E: EVS And Watchtower

- preflight request template
- post-launch proof template
- screenshot/evidence attachment
- Watchtower active-lane health
- rollback alert posture

### Workstream F: Experiment Lab UI

- list
- detail
- readiness checklist
- approval/stop controls
- metrics summary
- decisions and learnings

## First Candidate Pilot

Recommended first test shape:

- scope: one property homepage
- component: governed hero CTA
- change type: adjacent secondary CTA or text swap
- primary metric: floorplan click rate or tour click rate
- traffic split: 50/50
- duration: 7 to 14 days, subject to traffic volume
- rollback: automatic pause for technical guardrails; manual decision for
  business metric softness

Avoid beginning with:

- property-wide portfolio deployment
- form-flow changes
- specials/concession claims
- pricing language
- page layout changes
- multi-variant tests

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Selector drift causes missed or partial rewrites | Specs/Site Content Creator component contracts, Worker selector-miss telemetry, EVS preflight, automatic pause threshold. |
| Analytics undercounts exposures | Data Pond Worker exposure ledger plus GA4/Zaraz reconciliation. |
| Experiment changes hurt CWV | Edge execution, no client library, CWV guardrail snapshots, EVS performance checks. |
| Operators launch too-broad changes | Permission model, allowed change registry, approval gates, no arbitrary selector builder in MVP. |
| Results are overinterpreted | minimum sample thresholds, control comparison, source freshness checks, decision confidence levels. |
| Cloudflare config diverges from Data Pond | signed/versioned config and Data Pond as source of truth. |
| Property identity fragments | required resolver usage and governance checks. |
| Learnings become anecdotal | structured decision and evidence records before pattern promotion. |

## Open Decisions

- Whether Worker config should be pulled directly from the API or replicated to
  KV/R2 during deployment.
- Which two homepage components become the first governed experiment targets.
- Whether assignment unit should be anonymous visitor, session, or device for
  MVP.
- Exact GA4 conversion events to treat as MVP primary metrics.
- Whether Heap is required for MVP or advisory-only from phase 4 onward.
- Which role names map to experiment `draft`, `approve`, and `administer`
  permissions in the Data Pond offering matrix.

## Recommended Next Build Order

1. Source contract and schema.
2. Shared schemas and validation.
3. Draft-only Data Pond API.
4. Read-only Experiment Lab surface.
5. Worker dry-run with selector telemetry.
6. EVS preflight attachment.
7. Single-property live pilot.
8. Guardrail and decision workflow.
9. Results and learning library.

The deliberate constraint is important: do not build the visual experiment
builder first. The first production value is not a slick UI for creating tests.
The first production value is a governed, observable, reversible execution lane.
