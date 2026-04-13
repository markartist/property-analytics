# Spec 02: Pipeline Health + System State Model

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for representing source freshness, validation status, mirror status, activation state, and effective trust posture for agents and product surfaces

## 1. Purpose

Define the canonical read model for operational trust across the platform.

This spec establishes:

- how raw system-state events are captured
- how those events are summarized into current health
- how agents and product surfaces determine whether a domain is trustworthy
- how stale, degraded, failed, and mismatched states are represented

The purpose of this contract is to prevent agents or reports from mistaking:

- missing data for healthy data
- stale data for current data
- failed mirrors for domain inactivity
- contract mismatches for legitimate platform state

## 2. Entities

### 2.1 System State Event

Immutable event describing a meaningful state change or failure in the platform pipeline.

System State Events are append-only and auditable.

Examples:

- `collection_succeeded`
- `collection_failed`
- `validation_succeeded`
- `validation_failed`
- `mirror_started`
- `mirror_failed`
- `batch_reconciled`
- `batch_activated`
- `contract_mismatch`
- `stale_data_detected`
- `domain_unavailable`

### 2.2 Pipeline Health Snapshot

Materialized current-state summary for one domain, representing the latest effective operational trust posture.

This is the primary object agents and product surfaces should read.

### 2.3 Domain Trust Posture

Normalized classification of how safe it is to use a domain operationally.

Allowed values:

- `trusted`
- `stale`
- `degraded`
- `unavailable`

### 2.4 Freshness Posture

Normalized classification of data recency.

Allowed values:

- `fresh`
- `aging`
- `stale`
- `expired`
- `unknown`

### 2.5 Validation Posture

Normalized classification of local integrity state.

Allowed values:

- `validated`
- `validation_pending`
- `validation_failed`
- `validation_blocked`
- `unknown`

### 2.6 Mirror Posture

Normalized classification of cloud mirror state.

Allowed values:

- `active`
- `lagging`
- `mirroring`
- `mirror_failed`
- `reconciliation_failed`
- `activation_blocked`
- `unknown`

### 2.7 Active Batch Posture

Normalized classification of current active-batch visibility for the domain.

Allowed values:

- `current`
- `lagging`
- `missing`
- `blocked`
- `unknown`

### 2.8 Contract Posture

Normalized classification of runtime contract compatibility.

Allowed values:

- `matched`
- `mismatch`
- `unsupported`
- `unknown`

## 3. Required Fields

## 3.1 `system_state_events`

Required fields:

- `system_state_event_id`
- `domain_key`
- `event_type`
- `event_status`
- `severity`
- `event_time`
- `source_component`
- `source_host`
- `source_validation_batch_id`
- `mirror_batch_id`
- `active_mirror_batch_id`
- `schema_bundle_version`
- `validator_bundle_version`
- `mirror_bundle_version`
- `contract_bundle_id`
- `message`
- `metadata_json`

Optional fields:

- `property_scope`
- `cohort_scope`
- `failure_code`
- `failure_message`
- `related_event_id`

## 3.2 `pipeline_health_snapshots`

Required fields:

- `pipeline_health_snapshot_id`
- `domain_key`
- `snapshot_time`
- `latest_collection_event_id`
- `latest_validation_event_id`
- `latest_mirror_event_id`
- `latest_activation_event_id`
- `latest_contract_event_id`
- `latest_local_run_at`
- `latest_successful_local_run_at`
- `latest_validated_batch_id`
- `latest_validated_data_through`
- `latest_mirror_attempt_at`
- `latest_mirror_batch_id`
- `active_mirror_batch_id`
- `latest_active_batch_activated_at`
- `active_data_through`
- `freshness_posture`
- `validation_posture`
- `mirror_posture`
- `active_batch_posture`
- `contract_posture`
- `domain_trust_posture`
- `warning_count`
- `error_count`
- `blocking_count`
- `status_summary`
- `effective_state_reason_codes`
- `created_at`

Optional fields:

- `latest_failure_code`
- `latest_failure_message`
- `notes`

## 3.3 `pipeline_health_policies`

Required fields:

- `domain_key`
- `fresh_after_minutes`
- `aging_after_minutes`
- `stale_after_minutes`
- `expire_after_minutes`
- `mirror_lag_tolerance_minutes`
- `validation_required`
- `mirror_required`
- `contract_match_required`
- `updated_at`

This policy controls how raw timestamps and failures roll up into posture.

## 4. State Model

### 4.1 System State Event

System State Events are immutable. They do not transition after creation.

They represent:

- observations
- failures
- completions
- state changes

### 4.2 Pipeline Health Snapshot

Pipeline Health Snapshots are replaceable current-state summaries.

They are recomputed when relevant system-state events arrive.

A snapshot does not transition in place. A newer snapshot supersedes the older one.

### 4.3 Domain Trust Posture

Allowed values and meaning:

- `trusted`
  - domain is suitable for operational use
- `stale`
  - latest active state is usable with caution but no longer current
- `degraded`
  - domain has non-blocking but operationally meaningful problems
- `unavailable`
  - domain must not be relied on for operational truth

## 5. Invariants

### 5.1 Snapshot Is Derived, Not Hand-Edited

Pipeline Health Snapshots must be generated from events and policy, not manually edited as an operational shortcut.

### 5.2 Agents Read Snapshot, Not Raw Guesswork

Agents must not infer trust posture independently when a Pipeline Health Snapshot is available.

### 5.3 One Current Snapshot Per Domain

At most one latest effective Pipeline Health Snapshot per domain may be designated current at any time.

### 5.4 Trust Posture Must Reflect Blocking Failures

If a domain has:

- validation failure
- missing required active batch
- unreconciled mirror failure
- contract mismatch where matching is required

then `domain_trust_posture` may not be `trusted`.

### 5.5 Freshness Alone Is Not Sufficient

Fresh data cannot be considered trusted if validation, mirroring, or contract posture are invalid.

### 5.6 Active Batch Awareness Is Required

Pipeline Health must include the current active batch context for the domain, not just the latest attempted batch.

### 5.7 Active Batch Visibility Must Be Explicit

If there is no active batch for a domain that requires one, `active_batch_posture` may not be `current`.

### 5.8 Blocking Active Batch Conditions Must Surface

If a reconciled batch exists but cannot be activated, the snapshot must reflect `active_batch_posture = blocked` or an equivalent blocking posture and may not imply healthy visibility.

### 5.9 Domain Health Is Domain-Specific

Health must be computed independently per domain.

Cross-domain operational trust is handled later through Execution Snapshots.

## 6. Allowed Transitions

This spec governs posture transitions rather than mutable entities.

### 6.1 Domain Trust Posture

Allowed posture changes:

- `trusted -> stale`
- `trusted -> degraded`
- `trusted -> unavailable`
- `stale -> trusted`
- `stale -> degraded`
- `stale -> unavailable`
- `degraded -> trusted`
- `degraded -> stale`
- `degraded -> unavailable`
- `unavailable -> degraded`
- `unavailable -> trusted`

### 6.2 Freshness Posture

Allowed changes:

- `fresh -> aging`
- `aging -> stale`
- `stale -> expired`
- any posture -> `fresh` upon newer trusted validated state
- any posture -> `unknown` if policy or timestamps are missing

### 6.3 Mirror Posture

Allowed changes:

- `unknown -> mirroring`
- `mirroring -> active`
- `mirroring -> mirror_failed`
- `mirroring -> reconciliation_failed`
- `active -> lagging`
- `lagging -> active`
- `mirror_failed -> active`
- `mirror_failed -> activation_blocked`
- `reconciliation_failed -> active`
- `activation_blocked -> active`

### 6.4 Validation Posture

Allowed changes:

- `unknown -> validation_pending`
- `validation_pending -> validated`
- `validation_pending -> validation_failed`
- `validation_failed -> validation_pending`
- `validation_failed -> validated`
- `validated -> validation_blocked`
- `validation_blocked -> validated`

### 6.5 Active Batch Posture

Allowed changes:

- `unknown -> missing`
- `unknown -> current`
- `current -> lagging`
- `lagging -> current`
- `missing -> current`
- `current -> blocked`
- `blocked -> current`
- `lagging -> blocked`
- `blocked -> missing`

### 6.6 Contract Posture

Allowed changes:

- `unknown -> matched`
- `unknown -> mismatch`
- `matched -> mismatch`
- `mismatch -> matched`
- `mismatch -> unsupported`
- `unsupported -> matched`

## 7. Rollup Rules

Pipeline Health Snapshots must be computed by deterministic policy from System State Events.

### 7.1 Freshness Rollup

Freshness must be computed using:

- `active_data_through`
- current clock
- domain freshness policy thresholds

Suggested rollup:

- within `fresh_after_minutes` -> `fresh`
- beyond fresh threshold but within aging threshold -> `aging`
- beyond aging threshold but within stale threshold -> `stale`
- beyond expire threshold -> `expired`

### 7.2 Validation Rollup

Validation posture must be based on the latest relevant validation event for the domain.

Examples:

- latest event = validation success -> `validated`
- latest event = validation failure -> `validation_failed`
- validation expected but no successful batch exists -> `validation_pending` or `unknown`

### 7.3 Mirror Rollup

Mirror posture must consider:

- latest mirror attempt
- latest reconciled batch
- active batch pointer
- lag between validated batch and active batch

Examples:

- active batch exists and is current -> `active`
- active batch exists but lags latest validated batch beyond threshold -> `lagging`
- latest mirror failed and no newer success exists -> `mirror_failed`
- batch written but reconciliation failed -> `reconciliation_failed`
- batch reconciled but not activatable -> `activation_blocked`

### 7.4 Contract Rollup

Contract posture must consider:

- latest contract validation event
- whether required contract bundle versions are supported
- whether runtime bundle matches accepted platform bundle

### 7.5 Active Batch Rollup

Active batch posture must consider:

- whether an active batch pointer exists
- whether the active pointed batch is reconciled and valid
- whether the active batch materially lags the latest validated batch
- whether activation is blocked despite a newer eligible batch

Examples:

- active pointer exists and points to a valid current batch -> `current`
- active pointer exists but lags latest validated state beyond policy -> `lagging`
- no active batch exists where one is required -> `missing`
- activation failed or is blocked pending intervention -> `blocked`

### 7.6 Domain Trust Rollup

Suggested deterministic precedence:

1. if required validation failed -> `unavailable`
2. if required contract mismatch/unsupported -> `unavailable`
3. if required active batch is missing or blocked with no usable fallback -> `unavailable`
4. if active data expired -> `unavailable`
5. if active data stale but otherwise valid -> `stale`
6. if mirror lag or other non-blocking platform impairment exists -> `degraded`
7. else -> `trusted`

## 8. Failure Modes

### 8.1 Collection Failure

Examples:

- source unavailable
- collector crash
- auth failure

Required behavior:

- emit System State Event
- update Pipeline Health Snapshot
- if prior active mirrored data still exists, trust posture may degrade or become stale rather than immediately unavailable, depending on policy

### 8.2 Validation Failure

Examples:

- row mismatch
- missing required source data
- integrity checks fail

Required behavior:

- emit `validation_failed`
- block progression to trusted local state
- prevent new mirror eligibility
- roll trust to `degraded` or `unavailable` per policy

### 8.3 Mirror Failure

Examples:

- intake rejection
- write failure
- reconciliation failure

Required behavior:

- emit mirror event with failure metadata
- preserve current active batch if one exists
- mark domain `degraded` or `unavailable` according to fallback state

### 8.4 Activation Failure

Examples:

- reconciled batch cannot become active
- active pointer update blocked

Required behavior:

- emit activation failure event
- preserve prior active state
- mark mirror posture `activation_blocked`
- mark active batch posture `blocked` if no valid new active state can be established

### 8.5 Contract Mismatch

Examples:

- unsupported schema bundle
- stale agent/runtime contract
- mirror bundle mismatch

Required behavior:

- emit contract event
- roll contract posture accordingly
- trust posture may become `unavailable` if matching is required

### 8.6 Silent Staleness

Examples:

- no failure event but no fresh data arrives

Required behavior:

- freshness rollup alone must degrade posture over time
- stale state must never appear healthy by omission

## 9. Audit Requirements

The platform must retain auditable evidence for:

- every System State Event
- every generated Pipeline Health Snapshot
- every policy version used in rollup
- every blocking or degraded posture transition

Audit records must allow reconstruction of:

- what happened
- when it happened
- which versions and policies were applied
- why the trust posture changed

### 9.1 Required Audit Artifacts

- raw event record
- snapshot record
- policy version reference
- rollup explanation or explanation metadata
- associated batch ids and bundle ids

## 10. Read Model Requirements

### 10.1 Agent Read Requirements

All agents must be able to read Pipeline Health Snapshot data for every domain they depend on.

At minimum, agents need:

- domain key
- trust posture
- freshness posture
- validation posture
- mirror posture
- active batch posture
- contract posture
- latest active batch id
- latest validated batch id
- active data through
- latest failure summary

### 10.2 Product Read Requirements

Products should read Pipeline Health Snapshots to:

- display trust/freshness banners
- suppress misleading values
- warn users when data is degraded or stale

### 10.3 Use in Execution Snapshot

Pipeline Health Snapshots are inputs to Execution Snapshots.

Execution Snapshots must bind to a specific `pipeline_health_snapshot_id` set or equivalent point-in-time reference.

## 11. Administrative and Debug Access

Raw System State Events may be read by:

- admins
- debug workflows
- integrity operators

Operational products and agents should not need to parse raw events directly for normal execution.

## 12. Open Questions

Deferred to later specs:

- exact policy storage format
- whether per-domain health rollups are materialized synchronously or asynchronously
- whether multi-domain pipeline health bundles are stored as separate objects in addition to per-domain snapshots

## 13. Summary

This contract establishes:

- raw system state is captured as immutable events
- operational trust is represented through deterministic Pipeline Health Snapshots
- freshness, validation, mirror, and contract posture are separate dimensions
- domain trust posture is a derived operational state
- agents and products consume snapshots, not guesswork
- stale or failed domains cannot silently masquerade as healthy
