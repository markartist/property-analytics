# Spec Appendix B: Cross-Spec Entity Map

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Cross-spec entity map for Specs 01-07

## 1. Purpose

Provide an implementation-oriented map of the major entities introduced across the first seven platform contracts and how they relate to one another.

## 2. Core Backbone

### 2.1 Integrity and Mirroring

- Spec 01:
  - `mirror_domains`
  - `mirror_batches`
  - `mirror_batch_slices`
  - `active_batch_pointers`
  - `mirror_activation_events`

### 2.2 Trust and Health

- Spec 02:
  - `system_state_events`
  - `pipeline_health_snapshots`
  - `pipeline_health_policies`

### 2.3 Frozen Runtime Context

- Spec 03:
  - `execution_snapshots`
  - `execution_snapshot_domain_bindings`
  - `execution_snapshot_policies`

### 2.4 Agent Governance

- Spec 04:
  - `agent_contracts`
  - `agent_identities`
  - `agent_noise_budget_policies`
  - `agent_evaluation_profiles`
  - `agent_runtime_bindings`

### 2.5 Operational Lifecycle

- Spec 05:
  - `watch_states`
  - `escalation_candidates`
  - `issues`
  - `issue_lifecycle_events`
  - `issue_lifecycle_policies`

### 2.6 Logic Trust and Provenance

- Spec 06:
  - `contract_bundles`
  - `contract_bundle_components`
  - `contract_bundle_resolution_policies`
  - `provenance_envelopes`
  - `contract_compatibility_events`

### 2.7 Shared Memory

- Spec 07:
  - `memory_observations`
  - `memory_patterns`
  - `memory_pattern_evidence`
  - `memory_promotion_policies`
  - `memory_lifecycle_events`

## 3. Dependency Map

### 3.1 Mirror Batch -> Pipeline Health Snapshot

`pipeline_health_snapshots` depend on:

- current `active_batch_pointers`
- `mirror_batches`
- `system_state_events`

### 3.2 Pipeline Health Snapshot -> Execution Snapshot

`execution_snapshots` depend on:

- current `pipeline_health_snapshots`
- current per-domain active batch pointers
- execution snapshot policy
- resolved contract bundle

### 3.3 Execution Snapshot -> Agent Runtime Binding

`agent_runtime_bindings` depend on:

- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`

### 3.4 Execution Snapshot + Agent Contract -> Lifecycle Objects

`watch_states` and `escalation_candidates` should normally depend on:

- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`

### 3.5 EscalationCandidate -> Issue

`issues` may depend on:

- `escalation_candidate_id`
- or deterministic platform rule path
- or authorized manual entry path

All issue creation still binds to:

- `execution_snapshot_id`
- `contract_bundle_id`
- `agent_contract_id` where applicable

### 3.6 Lifecycle Objects -> Memory

`memory_observations` and `memory_pattern_evidence` may derive from:

- agent runs
- WatchStates
- EscalationCandidates
- Issues
- EVS or other domain-specific observations

## 4. Provenance Coverage Map

The following object classes should map cleanly to Spec 06 provenance expectations:

| Object class | execution_snapshot_id | contract_bundle_id | agent_contract_id | upstream refs expected |
| --- | --- | --- | --- | --- |
| Mirror Batch | optional/nullable | required | null | local validation batch |
| Pipeline Health Snapshot | optional/nullable | recommended/required at implementation | null | system state events, active batch context |
| Execution Snapshot | nullable to self, not as dependency | required | null | pipeline health snapshots, active batch ids |
| Agent run / runtime binding | required | required | required | execution snapshot, agent identity |
| WatchState | required | required | required if agent-created | execution snapshot, source actor |
| EscalationCandidate | required | required | required if agent-created | watch state or direct source refs |
| Issue | required | required | required if agent-created | escalation candidate or deterministic rule path |
| Memory Observation | required where applicable | required | optional | source object refs |
| Memory Pattern Evidence | required where applicable | required | optional | source object refs |
| Artifact / report / export | required | required | optional | execution snapshot, upstream objects |

## 5. Scope Map

| Spec area | Primary scope handling |
| --- | --- |
| Mirror & batch | domain-centric, not property-centric |
| Pipeline health | domain-centric |
| Execution snapshot | explicit `scope_type`, `property_id`, `cohort_key`, `portfolio_scope_key` |
| Agent contract | allowed scope shapes per agent type |
| Lifecycle | scope-aware via `scope_type`, `property_id`, `cohort_key` |
| Memory | scope-aware via `scope_type`, `property_id`, `cohort_key` |

Implementation note:

- `portfolio_scope_key` appears explicitly in Spec 03 and is not yet propagated to lifecycle or memory specs; that is acceptable for v1 but should be revisited if portfolio-scoped issues or memory become first-class.

## 6. Authority Map

| Actor | Typical responsibilities |
| --- | --- |
| Agent | interpretation, prioritization, operational posture, recommendation |
| Deterministic platform | metrics, findings, rollups, dedupe, cooldown, compatibility enforcement |
| Supervisor | review, promotion, rejection, escalation oversight |
| Owner | confirmation, approval, retirement, stewardship in governed contexts |
| Authorized human operator | manual intervention where policy allows |
| Admin / integrity operator | inspect, debug, audit, maintain integrity |

## 7. Key Cross-Spec Rules

- Execution Snapshot is the runtime trust anchor for agent runs, reports, and artifacts.
- Contract Bundle is the logic trust anchor for all operationally meaningful outputs.
- Pipeline Health Snapshot is the trust/read model; agents should not infer trust ad hoc when it is available.
- Agents default to creating WatchStates and EscalationCandidates, not Issues.
- Suppressed objects remain persisted and auditable.
- Lower-level memory may not be treated as operational default.
