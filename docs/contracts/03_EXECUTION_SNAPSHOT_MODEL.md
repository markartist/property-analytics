# Spec 03: Execution Snapshot Model

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for the frozen world-state bound to an agent run, report run, or other operational execution

## 1. Purpose

Define the canonical object that freezes the effective operational world-state for a single execution context.

This spec establishes:

- how an agent run or report run binds to a specific point-in-time platform state
- how per-domain active batch pointers are resolved into immutable domain bindings
- how pipeline health references are locked for execution
- how contract bundle versions are bound to execution
- how scope, trigger source, and execution intent are recorded
- how reproducibility and auditability are guaranteed

The purpose of this contract is to ensure that any execution can later answer:

- what world-state did it see
- which domains and active batches did it rely on
- which pipeline health state did it trust
- which contract bundle governed its behavior
- what trigger and scope caused it to run

## 2. Entities

### 2.1 Execution Snapshot

Immutable object representing the frozen world-state visible to one execution.

An Execution Snapshot is created before an agent, report, or product workflow begins interpretation.

It binds:

- per-domain active batch ids
- per-domain Pipeline Health Snapshot references
- contract bundle id
- scope
- trigger metadata
- creation time

### 2.2 Execution Snapshot Domain Binding

Immutable record describing how one domain is bound inside an Execution Snapshot.

It captures:

- the domain key
- the active mirror batch id selected for that execution
- the Pipeline Health Snapshot id selected for that execution
- the domain trust posture seen at snapshot time
- the data-through date/time exposed by that binding

### 2.3 Execution Trigger

Normalized description of why the snapshot was created.

Examples:

- scheduled automation
- manual operator run
- supervisor rerun
- event-driven trigger
- report generation
- agent escalation review

### 2.4 Execution Scope

Normalized declaration of what the execution is about.

Allowed scope types:

- `property`
- `cohort`
- `portfolio`
- `global`
- `system`

An Execution Snapshot may contain:

- one `property_id`
- one `cohort_key`
- both, if a property belongs to a named cohort and both are relevant
- neither, for broader platform/system executions

### 2.5 Execution Intent

Normalized declaration of what the execution is trying to do.

Examples:

- `agent_analysis`
- `report_generation`
- `export_generation`
- `supervisor_review`
- `issue_review`
- `system_audit`
- `backfill_validation`

### 2.6 Bound Contract Bundle

The exact contract/rules bundle used by the execution.

This is a reference to the versioned bundle defined in the later Contract Bundle & Provenance spec.

### 2.7 Execution Consumer

The actor or subsystem that will use the Execution Snapshot.

Examples:

- Property Advocate agent
- Supervisor agent
- report generator
- spreadsheet export process
- operational dashboard request

## 3. Required Fields

## 3.1 `execution_snapshots`

Required fields:

- `execution_snapshot_id`
- `snapshot_time`
- `execution_intent`
- `execution_consumer_type`
- `execution_consumer_id`
- `trigger_type`
- `trigger_source`
- `trigger_reference_id`
- `scope_type`
- `property_id`
- `cohort_key`
- `portfolio_scope_key`
- `contract_bundle_id`
- `pipeline_health_snapshot_set_hash`
- `domain_binding_count`
- `created_by`
- `created_at`

Optional fields:

- `notes`
- `operator_id`
- `requested_by`

Field notes:

- `property_id`, `cohort_key`, and `portfolio_scope_key` are nullable, but at least one scope field appropriate to the `scope_type` must be present
- `pipeline_health_snapshot_set_hash` is the stable fingerprint of the bound per-domain health references

## 3.2 `execution_snapshot_domain_bindings`

Required fields:

- `execution_snapshot_domain_binding_id`
- `execution_snapshot_id`
- `domain_key`
- `active_mirror_batch_id`
- `pipeline_health_snapshot_id`
- `domain_trust_posture`
- `freshness_posture`
- `validation_posture`
- `mirror_posture`
- `active_batch_posture`
- `contract_posture`
- `active_data_through`
- `binding_status`
- `bound_at`

Optional fields:

- `notes`
- `latest_validated_batch_id`
- `effective_state_reason_codes`

Field notes:

- `binding_status` allows the snapshot to explicitly record whether a domain was usable, degraded, excluded, or unavailable at bind time

## 3.3 `execution_snapshot_policies`

Required fields:

- `execution_snapshot_policy_id`
- `execution_intent`
- `required_domains_json`
- `optional_domains_json`
- `allow_stale_domains`
- `allow_degraded_domains`
- `allow_unavailable_domains`
- `fail_on_contract_mismatch`
- `updated_at`

This policy determines which domain states are acceptable when constructing a snapshot for a given execution intent.

## 4. State Model

### 4.1 Execution Snapshot

Execution Snapshots are immutable after creation.

They do not transition in place.

They may be referenced by:

- one or more agent runs
- one or more report or export runs
- one or more audit records

### 4.2 Execution Snapshot Domain Binding

Execution Snapshot Domain Bindings are immutable after creation.

They represent the resolved domain state as seen by the snapshot and do not change if later active pointers or Pipeline Health Snapshots advance.

### 4.3 Binding Status

Allowed values:

- `usable`
- `degraded`
- `stale`
- `excluded`
- `unavailable`

Meaning:

- `usable`
  - domain was accepted for execution without restriction
- `degraded`
  - domain was accepted but had non-blocking impairment
- `stale`
  - domain was accepted under stale-data allowance
- `excluded`
  - domain exists but was intentionally omitted under policy or scope
- `unavailable`
  - domain could not be used for this execution

## 5. Invariants

### 5.1 One Snapshot, One World-State

An Execution Snapshot must represent one frozen world-state at one creation time.

### 5.2 Immutable After Creation

Execution Snapshots and their domain bindings must never be mutated after creation.

If world-state changes, a new Execution Snapshot must be created.

### 5.3 Domain Bindings Must Resolve to Current Inputs at Snapshot Time

Each bound domain must resolve to:

- one specific active mirror batch id
- one specific Pipeline Health Snapshot id

valid at snapshot creation time.

### 5.4 Snapshot Must Not Guess Missing Domains

If a required domain cannot be resolved, the snapshot may not silently fabricate or omit that binding.

It must either:

- fail creation
- or bind the domain explicitly as `unavailable`, according to policy

### 5.5 Contract Bundle Binding Is Mandatory

Every Execution Snapshot must bind exactly one `contract_bundle_id`.

### 5.6 Snapshot Fingerprint Must Be Stable

The combination of:

- `contract_bundle_id`
- ordered domain bindings
- ordered Pipeline Health Snapshot ids
- scope
- trigger metadata

must produce a stable reproducibility fingerprint for the snapshot.

### 5.7 Snapshot Is the Only Valid Reproducibility Anchor

Agent runs, report runs, and export runs must reference an Execution Snapshot rather than rebuilding world-state ad hoc.

### 5.8 Scope Must Be Explicit

Every Execution Snapshot must declare its scope and may not rely on implicit property or cohort context.

### 5.9 Domain-Level Truth Remains Domain-Level

Execution Snapshots do not replace domain-level activation or Pipeline Health.

They freeze references to those systems for one execution.

## 6. Allowed Transitions

This spec governs immutable records, so transitions apply only to creation outcomes rather than in-place state changes.

### 6.1 Execution Snapshot Creation Outcome

Allowed outcomes:

- `requested -> created`
- `requested -> rejected`
- `requested -> blocked`

Meaning:

- `created`
  - snapshot was successfully constructed and persisted
- `rejected`
  - snapshot request violated contract or policy and was not created
- `blocked`
  - snapshot could not be created because required bound domains were unavailable or invalid

### 6.2 Domain Binding Acceptance Outcome

Allowed outcomes per domain:

- `candidate -> usable`
- `candidate -> degraded`
- `candidate -> stale`
- `candidate -> excluded`
- `candidate -> unavailable`

These are not mutable post-creation states; they are construction results recorded on the binding.

## 7. Construction Rules

Execution Snapshots must be constructed deterministically.

### 7.1 Snapshot Time

`snapshot_time` must be captured once at the beginning of construction and used consistently across domain resolution.

### 7.2 Domain Resolution

For each candidate domain:

1. resolve the current active batch pointer for the domain
2. resolve the current Pipeline Health Snapshot for the domain
3. evaluate the domain against execution policy
4. bind the domain as `usable`, `degraded`, `stale`, `excluded`, or `unavailable`

### 7.3 Required vs Optional Domains

Execution policies must distinguish:

- required domains
- optional domains

Required domains that are `unavailable` must either:

- block snapshot creation
- or create a snapshot marked blocked/rejected according to caller policy

Optional domains may be:

- omitted as `excluded`
- or included as `degraded` or `stale`

### 7.4 Pipeline Health Binding Method

Execution Snapshot construction must bind exact `pipeline_health_snapshot_id` values, not just current posture labels.

### 7.5 Active Batch Binding Method

Execution Snapshot construction must bind exact `active_mirror_batch_id` values per domain, not just the latest domain pointer at read time.

### 7.6 Contract Bundle Binding Method

Execution Snapshot construction must bind the exact `contract_bundle_id` resolved for the execution.

The bundle must be acceptable for the execution consumer and trigger context.

### 7.7 Reproducibility Fingerprint

The platform must compute a deterministic fingerprint from:

- snapshot scope
- contract bundle id
- ordered domain keys
- ordered active mirror batch ids
- ordered Pipeline Health Snapshot ids
- execution intent
- trigger type and trigger reference

## 8. Failure Modes

### 8.1 Missing Required Domain

Examples:

- required domain has no active batch
- required domain has no current Pipeline Health Snapshot
- required domain is explicitly unavailable

Required behavior:

- snapshot creation must fail or block according to policy
- failure reason must identify the missing or unavailable domain

### 8.2 Contract Bundle Unavailable or Unsupported

Examples:

- requested contract bundle does not exist
- execution consumer is not allowed to use requested bundle
- runtime bundle is unsupported

Required behavior:

- reject snapshot creation
- emit auditable failure metadata

### 8.3 Pipeline Health Mismatch

Examples:

- health snapshot references active batch A, but domain pointer now resolves to batch B during construction
- domain resolution occurs across non-atomic reads producing inconsistent bindings

Required behavior:

- snapshot creation must restart or fail
- no partially inconsistent snapshot may be persisted

### 8.4 Scope Ambiguity

Examples:

- `scope_type = property` but no `property_id`
- multiple incompatible scope fields supplied

Required behavior:

- reject snapshot creation

### 8.5 Policy Violation

Examples:

- intent does not allow stale domains but required domain is stale
- intent requires contract match but contract posture is mismatch

Required behavior:

- block or reject snapshot creation according to execution policy

### 8.6 Partial Binding Persistence

Examples:

- some domain bindings written before failure

Required behavior:

- snapshot creation must be atomic
- no visible Execution Snapshot may exist with incomplete domain bindings

## 9. Audit Requirements

The platform must retain auditable evidence for:

- every Execution Snapshot created
- every domain binding included
- every blocked or rejected snapshot request
- the exact contract bundle bound
- the exact Pipeline Health Snapshot ids and active batch ids used

Audit records must allow reconstruction of:

- why the snapshot was created
- who or what requested it
- what scope it covered
- which domains were bound and with what status
- what exact frozen world-state downstream consumers saw

### 9.1 Required Audit Artifacts

- Execution Snapshot record
- Execution Snapshot Domain Binding records
- snapshot creation policy reference
- creation failure record for rejected/blocked requests
- reproducibility fingerprint
- contract bundle id
- trigger metadata

## 10. Consumer Requirements

### 10.1 Agent Run Requirements

Every agent run must reference exactly one `execution_snapshot_id`.

Agents must not resolve active batches or Pipeline Health dynamically after the snapshot is bound.

### 10.2 Report and Export Requirements

Every report run and export run must reference exactly one `execution_snapshot_id`.

If multiple outputs are generated from the same frozen world-state, they should share the same Execution Snapshot where appropriate.

### 10.3 Product Read Requirements

Operational product surfaces may display current domain health directly, but any persisted interpretation, recommendation, issue promotion, or artifact generation must anchor to an Execution Snapshot.

## 11. Administrative and Debug Access

Admins and integrity operators may inspect:

- snapshot construction attempts
- rejected or blocked snapshot requests
- binding details
- reproducibility fingerprints

Debug access must not mutate existing snapshots.

## 12. Open Questions

Deferred to later specs:

- exact hashing algorithm for reproducibility fingerprints
- whether snapshot creation is synchronous or queued per execution intent
- whether one execution may intentionally reuse a prior snapshot under explicit policy

## 13. Summary

This contract establishes:

- Execution Snapshot as the canonical frozen world-state for an execution
- exact per-domain bindings to active batches and Pipeline Health Snapshots
- exact contract bundle binding
- explicit scope and trigger metadata
- deterministic construction and reproducibility
- atomic persistence and auditability
- a single trusted anchor for agent runs, reports, and exports
