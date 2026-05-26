# Edge Experimentation Source Contract

Date: 2026-05-02
Owner: Data Pond + Site Content Creator + EVS + Cloudflare Ops
Status: Draft source contract

## Purpose

Edge Experimentation is the governed source route for small, measurable property
website experience tests. It lets Data Pond define, approve, execute, observe,
stop, decide, and learn from site changes that are executed at the Cloudflare
edge.

This source contract exists to prevent the experimentation lane from becoming:

- a standalone A/B testing product.
- an ungoverned client-side testing snippet.
- a shadow CMS.
- an arbitrary selector editor.
- a parallel property identity map.

The contract pairs with:

- `/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md`

## Source Authority

Data Pond is authoritative for:

- experiment definition
- experiment lifecycle state
- property identity
- page and component identity
- approval and rollback decisions
- variant payload as approved
- exposure, decision, guardrail, and learning ledgers

Site Content Creator and Specs are authoritative for:

- eligible page types
- governed component ids
- component selectors
- allowed change types by component
- component drift and missing-component status

Cloudflare Workers are authoritative for:

- request-time eligibility evaluation
- edge assignment outcome
- assignment cookie persistence
- rewrite attempt status
- selector match/miss telemetry
- Worker error telemetry

Zaraz is authoritative for:

- routing normalized experiment events to configured analytics destinations
- GA4/Heap event forwarding status where available

GA4 is authoritative for:

- business KPI event arrival and reporting after collection succeeds
- existing MarketingOps conversion definitions
- source/session context inside GA4

Heap is advisory for:

- behavioral exploration
- session-level interaction investigation
- qualitative funnel clues

EVS is authoritative for:

- preflight rendering proof
- selector and component presence proof
- CTA clickability and link destination proof
- console/request health during validation
- post-launch desktop/mobile screenshots

Watchtower and Data Collection are authoritative for:

- source freshness
- telemetry ingestion health
- guardrail status
- operational closure state

## Non-Authority Boundaries

The Edge Experimentation source route must not override:

- official property identity.
- official operating metrics.
- official pricing, availability, concessions, or lease/application logic.
- locked PIB generation or rendering behavior.
- Specs component definitions.
- Site Content Creator approved copy states.

Experiments may test approved presentation changes. They do not become the
source of record for permanent content until a separate governed promotion
decision is made.

## Source Objects

### Experiment Definition

One canonical experiment record.

Required identity:

- `experiment_id`
- `name`
- `property_code`
- `community_id`
- `page_type`
- `page_path`
- `component_id`
- `component_contract_source`

Required governance:

- `status`
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

### Variant Definition

One row per variant.

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

### Assignment And Exposure

The assignment ledger exists to reconcile Cloudflare exposure telemetry against
analytics destination arrival. Store only hashed assignment/session ids.

Required fields:

- `experiment_id`
- `variant_key`
- `anonymous_assignment_id_hash`
- `property_code`
- `community_id`
- `first_seen_at`
- `last_seen_at`
- `exposure_count`
- `assignment_source`

### Event Ledger

The event ledger stores normalized events from Worker/Zaraz/GA4 reconciliation.

Core event names:

- `experiment_exposure`
- `experiment_click`
- `experiment_conversion`
- `experiment_selector_miss`
- `experiment_guardrail_event`
- `experiment_worker_error`

Required fields:

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

### Guardrail Snapshot

One row per evaluation window and variant.

Required fields:

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

### Decision Record

Required fields:

- `experiment_id`
- `decision`
- `decision_by`
- `decision_at`
- `rationale`
- `evidence_summary`
- `promoted_pattern_id`
- `rollback_reference`

Allowed decisions:

- `continue`
- `pause`
- `rollback`
- `stop_no_winner`
- `promote_variant`
- `promote_learning_only`
- `reject`
- `archive`

### Learning Record

Required fields:

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

## Property Identity Contract

Every experiment must resolve property identity through:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Required launch identity:

- `property_code`
- `community_id`
- `website_url` or governed host
- `page_path`
- `ga4_property_id` when GA4 measurement is required
- `gsc_url` when search/context evidence is attached

No experiment may store or depend on a local one-off property map.

## Component Contract

MVP experiments require a governed component contract with:

- `component_id`
- `page_type`
- `selector`
- `allowed_change_types`
- `required_accessibility_checks`
- `source`: `specs`, `site_content_creator`, or `approved_manual_contract`
- `last_verified_at`

Selectors must be stable enough for Cloudflare `HTMLRewriter`. When the source
component is missing, duplicated unexpectedly, or structurally different from the
contract, the experiment must fail preflight.

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
- `config_version`

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
- `config_version`

### `experiment_conversion`

Required properties:

- `experiment_id`
- `variant`
- `property_code`
- `community_id`
- `conversion_name`
- `conversion_source`
- `config_version`

Conversion linkage should reuse established GA4 event names wherever possible.

### `experiment_selector_miss`

Required properties:

- `experiment_id`
- `variant`
- `property_code`
- `community_id`
- `page_path`
- `component_id`
- `target_selector`
- `config_version`

### `experiment_worker_error`

Required properties:

- `experiment_id`
- `property_code`
- `community_id`
- `page_path`
- `error_code`
- `error_stage`
- `config_version`

## Lifecycle Contract

Allowed statuses:

- `draft`
- `pending_preflight`
- `preflight_failed`
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

Allowed MVP transitions:

| From | To | Required Evidence |
| --- | --- | --- |
| `draft` | `pending_preflight` | Property identity and component contract pass validation. |
| `pending_preflight` | `preflight_failed` | EVS or Worker dry-run failure. |
| `pending_preflight` | `ready_for_approval` | EVS preflight and Worker dry-run pass. |
| `ready_for_approval` | `approved` | Approver, guardrail policy, rollback owner. |
| `approved` | `scheduled` | Launch window and config version. |
| `scheduled` | `running` | Worker config active and first exposure observed. |
| `running` | `paused` | Manual pause or technical guardrail warning. |
| `running` | `rolled_back` | Technical guardrail breach or manual rollback decision. |
| `running` | `completed` | End date or minimum evidence reached. |
| `completed` | `promoted` | Decision record with evidence. |
| `completed` | `rejected` | Decision record with evidence. |
| Any inactive terminal status | `archived` | Archival decision. |

## Guardrail Contract

Default MVP thresholds:

- LCP p75 regression greater than 200 ms.
- INP p75 regression greater than 50 ms.
- CLS p75 regression greater than 0.03.
- conversion rate drop greater than 10 percent after minimum exposure is met.
- selector miss rate greater than 3 percent.
- Worker rewrite error rate greater than 1 percent.
- analytics event loss greater than 10 percent after expected delay.
- EVS post-launch validation failure.

Technical guardrail breaches may auto-pause to control. Business metric softness
requires a human decision unless a policy explicitly allows automatic rollback.

## Storage Contract

Local SQLite and remote D1 must carry matching logical schemas. D1 may omit local
debug-only indexes if required, but table and column names should remain
compatible with shared queries.

Initial table family:

- `edge_experiments`
- `edge_experiment_variants`
- `edge_experiment_assignments`
- `edge_experiment_events`
- `edge_experiment_guardrail_snapshots`
- `edge_experiment_decisions`
- `edge_experiment_learnings`
- `edge_experiment_component_contracts`
- `edge_experiment_config_versions`

## Collection And Mirror Contract

Data Collection owns ingestion and reconciliation of:

- Worker exposure telemetry.
- Worker selector miss/error telemetry.
- Zaraz/GA4 event arrival.
- Heap advisory event arrival where enabled.
- CWV guardrail snapshots.
- EVS validation evidence links.

The Worker should not parse analytics exports or calculate final business
decisions. It emits execution evidence. Data Pond evaluates and records decisions.

## Admin UI Contract

The first Data Pond admin UI must support:

- list experiments.
- create draft experiments from governed property and component choices.
- show readiness checklist.
- show EVS and Worker dry-run proof.
- approve, schedule, pause, rollback, complete, and decide.
- show source freshness and guardrail status.
- record decision and learning.

The first UI must not expose:

- arbitrary CSS selector editing for normal operators.
- freeform HTML injection.
- portfolio-wide launch without elevated approval.
- auto-promotion controls.

## Launch Gate

An experiment may launch only when:

- property identity resolves.
- page and component contract resolve.
- change type is allowed.
- variant payload validates.
- Worker dry-run passes.
- EVS preflight passes.
- Zaraz event mapping is present.
- GA4 primary metric is confirmed.
- guardrail policy is attached.
- rollback owner is assigned.
- approval record is written.

## Verification Commands

Before promoting implementation work:

```bash
bash scripts/check_property_identity_governance.sh
bash scripts/check_context_discipline.sh
bash scripts/check_pib_guardrails.sh
```

The PIB guardrail check is required because this capability is adjacent to
briefing and presentation systems, but it must not mutate locked PIB behavior.
