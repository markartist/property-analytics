# Phase 1 Schema, Service, Bootstrap, and Test Plan

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Code-level implementation planning artifact for Phase 1 schema and services

## 1. Purpose

Provide the concrete Phase 1 handoff from approved contracts into:

- first-pass D1/SQLite schema
- first-pass service interfaces
- centralized shared-module signatures
- bootstrapping plan
- minimal end-to-end test plan

Primary implementation artifacts created with this plan:

- D1 migration draft:
  - [0021_create_phase1_platform_tables.sql](/Users/mark/Property_Analytics/apps/api/migrations/0021_create_phase1_platform_tables.sql)
- TypeScript service and module interfaces:
  - [phase1-interfaces.ts](/Users/mark/Property_Analytics/apps/api/src/platform/phase1-interfaces.ts)

## 2. Database Schema (D1 / SQLite)

## 2.1 Core Mirror / Activation Tables

### `mirror_domains`

Purpose:

- authoritative domain registry for Phase 1 mirrorable domains

Columns:

- `domain_key TEXT PRIMARY KEY`
- `display_name TEXT NOT NULL`
- `owner_team TEXT NOT NULL`
- `enabled INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Required indexes:

- primary key only

Constraints notes:

- `enabled` constrained to `0/1`

### `mirror_batches`

Purpose:

- one mirrored validated batch per domain per local validation batch

Columns:

- `mirror_batch_id TEXT PRIMARY KEY`
- `domain_key TEXT NOT NULL`
- `source_validation_batch_id TEXT NOT NULL`
- `source_snapshot_id TEXT NOT NULL`
- `schema_bundle_version TEXT NOT NULL`
- `validator_bundle_version TEXT NOT NULL`
- `mirror_bundle_version TEXT NOT NULL`
- `payload_contract_version TEXT NOT NULL`
- `contract_bundle_id TEXT`
- `batch_date_start TEXT NOT NULL`
- `batch_date_end TEXT NOT NULL`
- `row_count_total_expected INTEGER NOT NULL`
- `row_count_total_received INTEGER NOT NULL`
- `checksum_manifest TEXT NOT NULL`
- `status TEXT NOT NULL`
- `notes TEXT`
- `source_host TEXT`
- `operator_id TEXT`
- `created_at TEXT NOT NULL`
- `mirroring_started_at TEXT`
- `mirroring_completed_at TEXT`
- `reconciled_at TEXT`
- `activated_at TEXT`
- `failed_at TEXT`
- `failure_code TEXT`
- `failure_message TEXT`

Foreign keys:

- `domain_key -> mirror_domains.domain_key`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- unique `(domain_key, source_validation_batch_id)`
- index on `(domain_key, status, created_at DESC)`

Constraints notes:

- status check matches Spec 01 state model
- unique domain/source validation batch supports idempotent replay

### `mirror_batch_slices`

Purpose:

- track slice-level write and reconciliation status within a mirror batch

Columns:

- `mirror_batch_slice_id TEXT PRIMARY KEY`
- `mirror_batch_id TEXT NOT NULL`
- `domain_key TEXT NOT NULL`
- `target_table TEXT NOT NULL`
- `slice_key TEXT NOT NULL`
- `row_count_expected INTEGER NOT NULL`
- `row_count_received INTEGER NOT NULL`
- `slice_checksum_expected TEXT NOT NULL`
- `slice_checksum_received TEXT`
- `status TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `completed_at TEXT`
- `failed_at TEXT`
- `failure_code TEXT`
- `failure_message TEXT`

Foreign keys:

- `mirror_batch_id -> mirror_batches.mirror_batch_id`
- `domain_key -> mirror_domains.domain_key`

Required indexes:

- unique `(mirror_batch_id, target_table, slice_key)`
- index on `(mirror_batch_id, status)`

Constraints notes:

- status check matches Spec 01 slice state model

### `active_batch_pointers`

Purpose:

- one active batch per domain

Columns:

- `domain_key TEXT PRIMARY KEY`
- `active_mirror_batch_id TEXT NOT NULL`
- `activated_at TEXT NOT NULL`
- `previous_mirror_batch_id TEXT`
- `updated_at TEXT NOT NULL`

Foreign keys:

- `domain_key -> mirror_domains.domain_key`
- `active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `previous_mirror_batch_id -> mirror_batches.mirror_batch_id`

Required indexes:

- primary key only

Constraints notes:

- one row per domain enforces one current active pointer

### `mirror_activation_events`

Purpose:

- auditable activation history

Columns:

- `activation_event_id TEXT PRIMARY KEY`
- `domain_key TEXT NOT NULL`
- `mirror_batch_id TEXT NOT NULL`
- `previous_mirror_batch_id TEXT`
- `activation_reason TEXT NOT NULL`
- `activated_by TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Foreign keys:

- `domain_key -> mirror_domains.domain_key`
- `mirror_batch_id -> mirror_batches.mirror_batch_id`
- `previous_mirror_batch_id -> mirror_batches.mirror_batch_id`

Required indexes:

- `(domain_key, created_at DESC)`

## 2.2 Pipeline Health / System State Tables

### `system_state_events`

Purpose:

- immutable raw operational events

Columns:

- `system_state_event_id TEXT PRIMARY KEY`
- `domain_key TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `event_status TEXT NOT NULL`
- `severity TEXT NOT NULL`
- `event_time TEXT NOT NULL`
- `source_component TEXT NOT NULL`
- `source_host TEXT NOT NULL`
- `source_validation_batch_id TEXT`
- `mirror_batch_id TEXT`
- `active_mirror_batch_id TEXT`
- `schema_bundle_version TEXT`
- `validator_bundle_version TEXT`
- `mirror_bundle_version TEXT`
- `contract_bundle_id TEXT`
- `message TEXT NOT NULL`
- `metadata_json TEXT NOT NULL`
- `property_scope TEXT`
- `cohort_scope TEXT`
- `failure_code TEXT`
- `failure_message TEXT`
- `related_event_id TEXT`

Foreign keys:

- `domain_key -> mirror_domains.domain_key`
- `mirror_batch_id -> mirror_batches.mirror_batch_id`
- `active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`
- `related_event_id -> system_state_events.system_state_event_id`

Required indexes:

- `(domain_key, event_time DESC)`
- `(event_type, event_status, event_time DESC)`

Constraints notes:

- severity uses normalized check constraint

### `pipeline_health_policies`

Purpose:

- deterministic domain health rollup policy

Columns:

- `domain_key TEXT PRIMARY KEY`
- `fresh_after_minutes INTEGER NOT NULL`
- `aging_after_minutes INTEGER NOT NULL`
- `stale_after_minutes INTEGER NOT NULL`
- `expire_after_minutes INTEGER NOT NULL`
- `mirror_lag_tolerance_minutes INTEGER NOT NULL`
- `validation_required INTEGER NOT NULL`
- `mirror_required INTEGER NOT NULL`
- `contract_match_required INTEGER NOT NULL`
- `updated_at TEXT NOT NULL`

Foreign keys:

- `domain_key -> mirror_domains.domain_key`

Required indexes:

- primary key only

Constraints notes:

- explicit threshold ordering checks:
  - `fresh < aging < stale < expire`

### `pipeline_health_snapshots`

Purpose:

- deterministic current trust/read model per domain

Columns:

- `pipeline_health_snapshot_id TEXT PRIMARY KEY`
- `domain_key TEXT NOT NULL`
- `snapshot_time TEXT NOT NULL`
- `latest_collection_event_id TEXT`
- `latest_validation_event_id TEXT`
- `latest_mirror_event_id TEXT`
- `latest_activation_event_id TEXT`
- `latest_contract_event_id TEXT`
- `latest_local_run_at TEXT`
- `latest_successful_local_run_at TEXT`
- `latest_validated_batch_id TEXT`
- `latest_validated_data_through TEXT`
- `latest_mirror_attempt_at TEXT`
- `latest_mirror_batch_id TEXT`
- `active_mirror_batch_id TEXT`
- `latest_active_batch_activated_at TEXT`
- `active_data_through TEXT`
- `freshness_posture TEXT NOT NULL`
- `validation_posture TEXT NOT NULL`
- `mirror_posture TEXT NOT NULL`
- `active_batch_posture TEXT NOT NULL`
- `contract_posture TEXT NOT NULL`
- `domain_trust_posture TEXT NOT NULL`
- `warning_count INTEGER NOT NULL`
- `error_count INTEGER NOT NULL`
- `blocking_count INTEGER NOT NULL`
- `status_summary TEXT NOT NULL`
- `effective_state_reason_codes TEXT NOT NULL`
- `latest_failure_code TEXT`
- `latest_failure_message TEXT`
- `notes TEXT`
- `is_current INTEGER NOT NULL`
- `contract_bundle_id TEXT`
- `created_at TEXT NOT NULL`

Foreign keys:

- event ids -> `system_state_events.system_state_event_id`
- batch ids -> `mirror_batches.mirror_batch_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- `(domain_key, snapshot_time DESC)`
- unique partial current index on `(domain_key) WHERE is_current = 1`

Constraints notes:

- explicit posture checks
- supports history plus one current snapshot per domain

## 2.3 Execution Snapshot Tables

### `execution_snapshot_policies`

Purpose:

- policy for required/optional domains and stale/degraded allowances by intent

Columns:

- `execution_snapshot_policy_id TEXT PRIMARY KEY`
- `execution_intent TEXT NOT NULL`
- `required_domains_json TEXT NOT NULL`
- `optional_domains_json TEXT NOT NULL`
- `allow_stale_domains INTEGER NOT NULL`
- `allow_degraded_domains INTEGER NOT NULL`
- `allow_unavailable_domains INTEGER NOT NULL`
- `fail_on_contract_mismatch INTEGER NOT NULL`
- `updated_at TEXT NOT NULL`

### `execution_snapshots`

Purpose:

- immutable frozen world-state for one execution

Columns:

- `execution_snapshot_id TEXT PRIMARY KEY`
- `snapshot_time TEXT NOT NULL`
- `execution_intent TEXT NOT NULL`
- `execution_consumer_type TEXT NOT NULL`
- `execution_consumer_id TEXT NOT NULL`
- `trigger_type TEXT NOT NULL`
- `trigger_source TEXT NOT NULL`
- `trigger_reference_id TEXT`
- `scope_type TEXT NOT NULL`
- `property_id TEXT`
- `cohort_key TEXT`
- `portfolio_scope_key TEXT`
- `contract_bundle_id TEXT NOT NULL`
- `pipeline_health_snapshot_set_hash TEXT NOT NULL`
- `binding_input_hash TEXT NOT NULL`
- `domain_binding_count INTEGER NOT NULL`
- `created_by TEXT NOT NULL`
- `notes TEXT`
- `operator_id TEXT`
- `requested_by TEXT`
- `created_at TEXT NOT NULL`

Foreign keys:

- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- `(scope_type, created_at DESC)`
- `(contract_bundle_id, created_at DESC)`

Constraints notes:

- explicit scope matrix check
- property scope allows optional `cohort_key`

### `execution_snapshot_domain_bindings`

Purpose:

- exact per-domain bindings for one execution snapshot

Columns:

- `execution_snapshot_domain_binding_id TEXT PRIMARY KEY`
- `execution_snapshot_id TEXT NOT NULL`
- `domain_key TEXT NOT NULL`
- `active_mirror_batch_id TEXT NOT NULL`
- `pipeline_health_snapshot_id TEXT NOT NULL`
- `domain_trust_posture TEXT NOT NULL`
- `freshness_posture TEXT NOT NULL`
- `validation_posture TEXT NOT NULL`
- `mirror_posture TEXT NOT NULL`
- `active_batch_posture TEXT NOT NULL`
- `contract_posture TEXT NOT NULL`
- `active_data_through TEXT`
- `binding_status TEXT NOT NULL`
- `notes TEXT`
- `latest_validated_batch_id TEXT`
- `effective_state_reason_codes TEXT`
- `bound_at TEXT NOT NULL`

Foreign keys:

- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `domain_key -> mirror_domains.domain_key`
- `active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `pipeline_health_snapshot_id -> pipeline_health_snapshots.pipeline_health_snapshot_id`

Required indexes:

- unique `(execution_snapshot_id, domain_key)`
- index on `(execution_snapshot_id)`

## 2.4 Contract Bundle / Provenance Tables

### `contract_bundles`

Purpose:

- unit of runtime logic trust

Columns:

- `contract_bundle_id TEXT PRIMARY KEY`
- `bundle_name TEXT NOT NULL`
- `bundle_version TEXT NOT NULL`
- `status TEXT NOT NULL`
- `schema_bundle_version TEXT NOT NULL`
- `mirror_contract_version TEXT NOT NULL`
- `pipeline_health_contract_version TEXT NOT NULL`
- `execution_snapshot_contract_version TEXT NOT NULL`
- `agent_contract_set_version TEXT NOT NULL`
- `lifecycle_contract_version TEXT NOT NULL`
- `evaluation_contract_version TEXT NOT NULL`
- `rule_pack_version TEXT NOT NULL`
- `source_control_ref TEXT NOT NULL`
- `notes TEXT`
- `effective_from TEXT`
- `effective_to TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Required indexes:

- unique `(bundle_name, bundle_version)`

### `contract_bundle_components`

Purpose:

- component-level composition of a bundle

Columns:

- `contract_bundle_component_id TEXT PRIMARY KEY`
- `contract_bundle_id TEXT NOT NULL`
- `component_type TEXT NOT NULL`
- `component_name TEXT NOT NULL`
- `component_version TEXT NOT NULL`
- `source_control_ref TEXT NOT NULL`
- `component_hash TEXT`
- `notes TEXT`
- `created_at TEXT NOT NULL`

Foreign keys:

- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- unique `(contract_bundle_id, component_type, component_name)`

### `contract_bundle_resolution_policies`

Purpose:

- context-specific bundle compatibility enforcement

Columns:

- `resolution_policy_id TEXT PRIMARY KEY`
- `context_type TEXT NOT NULL`
- `allowed_bundle_statuses_json TEXT NOT NULL`
- `require_exact_match INTEGER NOT NULL`
- `allow_forward_compatible_components INTEGER NOT NULL`
- `allow_backward_compatible_components INTEGER NOT NULL`
- `block_on_unknown_component INTEGER NOT NULL`
- `notes TEXT`
- `updated_at TEXT NOT NULL`

### `contract_compatibility_events`

Purpose:

- auditable compatibility outcomes

Columns:

- `contract_compatibility_event_id TEXT PRIMARY KEY`
- `context_type TEXT NOT NULL`
- `context_object_type TEXT NOT NULL`
- `context_object_id TEXT NOT NULL`
- `requested_contract_bundle_id TEXT`
- `resolved_contract_bundle_id TEXT`
- `compatibility_posture TEXT NOT NULL`
- `event_time TEXT NOT NULL`
- `message TEXT NOT NULL`
- `failure_code TEXT`
- `failure_message TEXT`
- `metadata_json TEXT`

Foreign keys:

- requested/resolved bundle ids -> `contract_bundles.contract_bundle_id`

Required indexes:

- `(context_type, event_time DESC)`

### `provenance_envelopes`

Purpose:

- generic provenance binding for operationally meaningful objects

Columns:

- `provenance_envelope_id TEXT PRIMARY KEY`
- `object_type TEXT NOT NULL`
- `object_id TEXT NOT NULL`
- `contract_bundle_id TEXT NOT NULL`
- `source_batch_ids_json TEXT NOT NULL`
- `execution_snapshot_id TEXT`
- `agent_contract_id TEXT`
- `agent_id TEXT`
- `pipeline_health_snapshot_ids_json TEXT NOT NULL`
- `upstream_object_refs_json TEXT NOT NULL`
- `created_by_type TEXT NOT NULL`
- `created_by_id TEXT NOT NULL`
- `metadata_json TEXT`
- `artifact_uri TEXT`
- `created_at TEXT NOT NULL`

Foreign keys:

- `contract_bundle_id -> contract_bundles.contract_bundle_id`
- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `agent_contract_id -> agent_contracts.agent_contract_id`
- `agent_id -> agent_identities.agent_id`

Required indexes:

- unique `(object_type, object_id)`

## 2.5 Agent Governance Tables

### `agent_noise_budget_policies`

Columns:

- `noise_budget_policy_id TEXT PRIMARY KEY`
- `policy_name TEXT NOT NULL`
- `max_watch_states_per_day INTEGER NOT NULL`
- `max_escalation_candidates_per_day INTEGER NOT NULL`
- `max_escalation_candidates_per_issue_family_per_day INTEGER NOT NULL`
- `cooldown_minutes_per_issue_family INTEGER NOT NULL`
- `suppression_behavior TEXT NOT NULL`
- `max_recommendations_per_day INTEGER`
- `notes TEXT`
- `updated_at TEXT NOT NULL`

### `agent_evaluation_profiles`

Columns:

- `evaluation_profile_id TEXT PRIMARY KEY`
- `profile_name TEXT NOT NULL`
- boolean measure flags
- `notes TEXT`
- `updated_at TEXT NOT NULL`

### `agent_contracts`

Purpose:

- agent role, authority, and trust contract

Columns:

- `agent_contract_id TEXT PRIMARY KEY`
- `agent_type TEXT NOT NULL`
- `contract_name TEXT NOT NULL`
- `contract_version TEXT NOT NULL`
- `status TEXT NOT NULL`
- `mission_statement TEXT NOT NULL`
- `success_criteria TEXT NOT NULL`
- `allowed_scope_shapes_json TEXT NOT NULL`
- `required_domains_json TEXT NOT NULL`
- `optional_domains_json TEXT NOT NULL`
- `minimum_trust_policy_json TEXT NOT NULL`
- `allowed_reads_json TEXT NOT NULL`
- `allowed_writes_json TEXT NOT NULL`
- `prohibited_actions_json TEXT NOT NULL`
- `escalation_permissions_json TEXT NOT NULL`
- `noise_budget_policy_id TEXT NOT NULL`
- `evaluation_profile_id TEXT NOT NULL`
- `contract_bundle_id TEXT NOT NULL`
- `effective_from TEXT NOT NULL`
- `effective_to TEXT`
- `notes TEXT`
- `owner_team TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Foreign keys:

- `noise_budget_policy_id -> agent_noise_budget_policies.noise_budget_policy_id`
- `evaluation_profile_id -> agent_evaluation_profiles.evaluation_profile_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- `(agent_type, status, effective_from DESC)`
- unique `(agent_type, contract_name, contract_version)`

### `agent_identities`

Purpose:

- concrete or logical agent instances

Columns:

- `agent_id TEXT PRIMARY KEY`
- `agent_type TEXT NOT NULL`
- `agent_name TEXT NOT NULL`
- `agent_contract_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `default_scope_type TEXT NOT NULL`
- `default_property_id TEXT`
- `default_cohort_key TEXT`
- `default_portfolio_scope_key TEXT`
- `supervisor_agent_id TEXT`
- `notes TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Foreign keys:

- `agent_contract_id -> agent_contracts.agent_contract_id`
- `supervisor_agent_id -> agent_identities.agent_id`

Required indexes:

- unique `agent_name`

### `agent_runtime_bindings`

Purpose:

- one governed runtime bind per agent/execution snapshot pair

Columns:

- `agent_runtime_binding_id TEXT PRIMARY KEY`
- `agent_id TEXT NOT NULL`
- `agent_contract_id TEXT NOT NULL`
- `execution_snapshot_id TEXT NOT NULL`
- `contract_bundle_id TEXT NOT NULL`
- `trigger_type TEXT NOT NULL`
- `scope_type TEXT NOT NULL`
- `property_id TEXT`
- `cohort_key TEXT`
- `portfolio_scope_key TEXT`
- `notes TEXT`
- `created_at TEXT NOT NULL`

Foreign keys:

- `agent_id -> agent_identities.agent_id`
- `agent_contract_id -> agent_contracts.agent_contract_id`
- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- unique `(agent_id, execution_snapshot_id)`
- `(agent_id, created_at DESC)`
- `(execution_snapshot_id)`

Constraints notes:

- explicit scope matrix check

## 2.6 Lifecycle Tables (Phase 1 MVP)

### `issue_family_registry`

Purpose:

- authoritative allowed issue families and allowed scope types

Columns:

- `issue_family_key TEXT PRIMARY KEY`
- `allowed_scope_types_json TEXT NOT NULL`
- `default_promotion_mode TEXT NOT NULL`
- `default_dedupe_window_minutes INTEGER NOT NULL`
- `default_cooldown_window_minutes INTEGER NOT NULL`
- `active INTEGER NOT NULL`
- `notes TEXT`
- `updated_at TEXT NOT NULL`

### `issue_lifecycle_policies`

Purpose:

- lifecycle rule pack per issue family

Columns:

- `issue_lifecycle_policy_id TEXT PRIMARY KEY`
- `issue_family_key TEXT NOT NULL`
- `default_promotion_mode TEXT NOT NULL`
- `auto_promote_allowed INTEGER NOT NULL`
- `review_required_allowed INTEGER NOT NULL`
- `hold_allowed INTEGER NOT NULL`
- `dedupe_window_minutes INTEGER NOT NULL`
- `cooldown_minutes INTEGER NOT NULL`
- `monitor_tail_minutes INTEGER NOT NULL`
- `severity_override_rules_json TEXT`
- `notes TEXT`
- `updated_at TEXT NOT NULL`

Foreign keys:

- `issue_family_key -> issue_family_registry.issue_family_key`

### `watch_states`

Purpose:

- early-warning lifecycle object

Columns:

- `watch_state_id TEXT PRIMARY KEY`
- `issue_family_key TEXT NOT NULL`
- `scope_type TEXT NOT NULL`
- `property_id TEXT`
- `cohort_key TEXT`
- `portfolio_scope_key TEXT`
- `severity TEXT NOT NULL`
- `confidence REAL NOT NULL`
- `watch_reason TEXT NOT NULL`
- `status TEXT NOT NULL`
- `source_type TEXT NOT NULL`
- `source_actor_id TEXT NOT NULL`
- `execution_snapshot_id TEXT NOT NULL`
- `agent_contract_id TEXT`
- `contract_bundle_id TEXT NOT NULL`
- `first_observed_at TEXT NOT NULL`
- `last_observed_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `notes TEXT`
- `expires_at TEXT`
- `cooldown_until TEXT`
- `dedupe_key TEXT NOT NULL`

Foreign keys:

- `issue_family_key -> issue_family_registry.issue_family_key`
- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `agent_contract_id -> agent_contracts.agent_contract_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- `(scope_type, status, created_at DESC)`
- `(issue_family_key, dedupe_key, status)`

Constraints notes:

- explicit scope matrix check for `property/cohort/portfolio/global`

### `escalation_candidates`

Purpose:

- pre-issue promotion object

Columns:

- `escalation_candidate_id TEXT PRIMARY KEY`
- `issue_family_key TEXT NOT NULL`
- `scope_type TEXT NOT NULL`
- `property_id TEXT`
- `cohort_key TEXT`
- `portfolio_scope_key TEXT`
- `severity TEXT NOT NULL`
- `confidence REAL NOT NULL`
- `promotion_mode TEXT NOT NULL`
- `candidate_reason TEXT NOT NULL`
- `status TEXT NOT NULL`
- `source_type TEXT NOT NULL`
- `source_actor_id TEXT NOT NULL`
- `execution_snapshot_id TEXT NOT NULL`
- `agent_contract_id TEXT`
- `contract_bundle_id TEXT NOT NULL`
- `first_observed_at TEXT NOT NULL`
- `last_observed_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `notes TEXT`
- `review_required_by TEXT`
- `reviewed_by TEXT`
- `reviewed_at TEXT`
- `hold_until TEXT`
- `cooldown_until TEXT`
- `related_watch_state_id TEXT`
- `dedupe_key TEXT NOT NULL`

Foreign keys:

- `issue_family_key -> issue_family_registry.issue_family_key`
- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `agent_contract_id -> agent_contracts.agent_contract_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`
- `related_watch_state_id -> watch_states.watch_state_id`

Required indexes:

- `(scope_type, status, created_at DESC)`
- `(issue_family_key, dedupe_key, status)`

### `issue_lifecycle_events`

Purpose:

- append-only lifecycle audit trail

Columns:

- `issue_lifecycle_event_id TEXT PRIMARY KEY`
- `object_type TEXT NOT NULL`
- `object_id TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `event_actor_type TEXT NOT NULL`
- `event_actor_id TEXT NOT NULL`
- `event_time TEXT NOT NULL`
- `execution_snapshot_id TEXT`
- `agent_contract_id TEXT`
- `contract_bundle_id TEXT NOT NULL`
- `message TEXT NOT NULL`
- `old_status TEXT`
- `new_status TEXT`
- `metadata_json TEXT`

Foreign keys:

- `execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `agent_contract_id -> agent_contracts.agent_contract_id`
- `contract_bundle_id -> contract_bundles.contract_bundle_id`

Required indexes:

- `(object_type, object_id, event_time DESC)`

## 3. Service Interfaces (First Pass)

Canonical implementation signatures are defined in:

- [phase1-interfaces.ts](/Users/mark/Property_Analytics/apps/api/src/platform/phase1-interfaces.ts)

### 3.1 Mirror Intake Service

Signature:

```ts
interface MirrorIntakeService {
  ingest(input: MirrorIntakeInput): Promise<MirrorIntakeOutput>;
}
```

Blocking conditions:

- unvalidated local batch
- unknown domain
- contract mismatch
- conflicting idempotent replay

### 3.2 Activation Service

Signature:

```ts
interface ActivationService {
  activate(input: ActivationInput): Promise<ActivationOutput>;
}
```

Blocking conditions:

- batch not reconciled
- domain mismatch
- atomic pointer update failure

### 3.3 Pipeline Health Builder

Signature:

```ts
interface PipelineHealthBuilder {
  build(input: PipelineHealthBuildInput): Promise<PipelineHealthBuildOutput>;
}
```

Blocking conditions:

- invalid policy ordering
- missing required mirror/active context

### 3.4 Execution Snapshot Builder

Signature:

```ts
interface ExecutionSnapshotBuilder {
  create(input: ExecutionSnapshotBuildInput): Promise<ExecutionSnapshotBuildOutput>;
}
```

Blocking conditions:

- invalid scope matrix combination
- missing required domain
- below-minimum trust posture
- consistency hash mismatch beyond retry limit

### 3.5 Contract Bundle Resolver

Signature:

```ts
interface ContractBundleResolver {
  resolve(input: ResolveContractBundleInput): Promise<ResolveContractBundleOutput>;
}
```

Blocking conditions:

- blocked or retired bundle
- unsupported composition
- exact-match policy failure

### 3.6 Agent Runtime Gateway

Signature:

```ts
interface AgentRuntimeGateway {
  start(input: AgentRuntimeStartInput): Promise<AgentRuntimeStartOutput>;
}
```

Blocking conditions:

- inactive contract
- unauthorized scope
- snapshot missing required trusted domains
- contract mismatch

### 3.7 Lifecycle Engine

Signature:

```ts
interface LifecycleEngine {
  emit(input: LifecycleEmissionInput): Promise<LifecycleEmissionOutput>;
}
```

Blocking conditions:

- invalid issue family
- invalid scope for issue family
- provenance missing
- unauthorized direct issue creation

## 4. Shared Modules (Must Be Centralized)

Canonical signatures are defined in:

- [phase1-interfaces.ts](/Users/mark/Property_Analytics/apps/api/src/platform/phase1-interfaces.ts)

### 4.1 Scope Validator

```ts
interface ScopeValidator {
  validate(input: ScopeFields, opts?: { allowPropertyCohortContext?: boolean }): ScopeValidationResult;
}
```

Called from:

- Execution Snapshot Builder
- Agent Runtime Gateway
- Lifecycle Engine

### 4.2 Dedupe Signature Generator

```ts
interface DedupeSignatureGenerator {
  generate(input: DedupeSignatureInput): string;
}
```

Called from:

- Lifecycle Engine only

### 4.3 Provenance Builder

```ts
interface ProvenanceBuilder {
  build(input: ProvenanceEnvelopeInput): Promise<ProvenanceEnvelopeOutput>;
}
```

Called from:

- Mirror Intake Service
- Pipeline Health Builder
- Execution Snapshot Builder
- Agent Runtime Gateway
- Lifecycle Engine

### 4.4 Execution Snapshot Hash Calculator

```ts
interface ExecutionSnapshotHashCalculator {
  calculate(input: ExecutionSnapshotHashInput): string;
}
```

Called from:

- Execution Snapshot Builder

### 4.5 Memory Consumption Checker

```ts
interface MemoryConsumptionChecker {
  check(input: MemoryConsumptionCheckInput): MemoryConsumptionCheckOutput;
}
```

Called from:

- Agent Runtime Gateway
- recommendation generation
- artifact/report generation

Phase 1 status:

- stubbed but must exist in central location

### 4.6 Issue-Family Registry Validator

```ts
interface IssueFamilyRegistryValidator {
  validate(input: IssueFamilyScopeValidationInput): Promise<IssueFamilyScopeValidationOutput>;
}
```

Called from:

- Lifecycle Engine

## 5. Phase 1 Migration / Bootstrapping Plan

## 5.1 Initial Contract Bundles

Seed:

- one active Phase 1 bundle:
  - `platform_phase1_v1`

Bundle components should reference:

- schema bundle version
- mirror contract version
- pipeline health contract version
- execution snapshot contract version
- agent contract set version
- lifecycle contract version
- evaluation contract version
- rule pack version

## 5.2 Initial Policies

Seed:

- `pipeline_health_policies`
  - for `ga4`
  - for `psi`
- `contract_bundle_resolution_policies`
  - `mirror_intake`
  - `snapshot_creation`
  - `agent_runtime`
  - `lifecycle_promotion`
- `execution_snapshot_policies`
  - one for `agent_analysis`
- `agent_noise_budget_policies`
  - conservative default for property advocate
- `agent_evaluation_profiles`
  - minimal default profile
- `issue_lifecycle_policies`
  - for initial issue families

## 5.3 Issue-Family Registry

Seed initial issue families for Phase 1 MVP, such as:

- `psi_regression`
  - allowed scopes: `property`, `cohort`
- `ga4_data_stale`
  - allowed scopes: `property`, `cohort`, `portfolio`
- `snapshot_blocked`
  - allowed scopes: `system`

Note:

- If Phase 1 lifecycle is property-only for agent output, keep property advocate issue families property-scoped initially

## 5.4 Seed Agent

Seed:

- one `property_advocate` agent contract
- one `property_advocate` agent identity for MVP property testing

Minimum trust policy should require:

- `psi`
  - at least `stale`
- `ga4`
  - at least `stale`

Allowed scope shapes:

- `property`

Allowed writes:

- WatchState
- EscalationCandidate

## 6. Minimal End-to-End Test Plan

### 6.1 Mirror -> Activation

Test:

- ingest one validated `psi` batch
- reconcile and activate it
- assert one active pointer exists for `psi`
- assert prior pointer preserved on failed second activation

### 6.2 Pipeline Health

Test:

- build health snapshot after successful mirror/activation
- assert:
  - `active_batch_posture = current`
  - expected trust posture
- inject failure state
- assert posture degrades appropriately

### 6.3 Execution Snapshot Determinism

Test:

- create one snapshot for property scope with `ga4` + `psi`
- assert exact bound `active_mirror_batch_id`s
- mutate one active pointer during a second snapshot build
- assert retry/fail behavior

### 6.4 Agent Run Gating

Test:

- run `property_advocate` against a valid snapshot
- assert runtime binding persisted
- run with invalid scope or missing required trusted domain
- assert blocked result and no runtime binding

### 6.5 Lifecycle Emission with Dedupe

Test:

- emit first WatchState
- emit equivalent second WatchState inside dedupe window
- assert second is suppressed/merged/linked, not active duplicate
- emit EscalationCandidate inside cooldown violation
- assert suppression with audit trail

## 7. Practical Coding Note

Recommended immediate coding sequence:

1. implement migration `0021_create_phase1_platform_tables.sql`
2. scaffold central shared modules from `phase1-interfaces.ts`
3. implement Contract Bundle Resolver first
4. implement mirror + activation path
5. implement Pipeline Health Builder
6. implement Execution Snapshot Builder
7. implement Agent Runtime Gateway
8. implement Lifecycle Engine
9. wire MVP tests end to end

## 8. Summary

This package translates the contract spine into a direct coding handoff:

- D1 schema draft exists
- service interfaces are defined
- shared module boundaries are explicit
- bootstrap data needs are identified
- minimal end-to-end tests are defined

An engineer or Atlas should be able to start schema and service implementation from these artifacts with minimal interpretation.
