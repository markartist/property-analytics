# Spec 06: Contract Bundle & Provenance Model

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for bundle composition, bundle resolution, provenance envelopes, compatibility enforcement, and audit reconstruction across the platform

## 1. Purpose

Define the canonical contract for versioned platform logic and the provenance model that binds operational objects back to the exact logic and inputs that produced them.

This spec establishes:

- what a Contract Bundle is composed of
- how Contract Bundles are resolved for execution
- how compatibility and mismatch behavior are enforced
- what provenance envelope must exist on batches, snapshots, agent runs, lifecycle objects, and artifacts
- where runtime enforcement occurs
- how the platform guarantees full audit reconstruction

The purpose of this contract is to prevent hidden logic, untraceable outputs, silent drift, and unverifiable operational state.

## 2. Entities

### 2.1 Contract Bundle

Versioned, named collection of platform contracts and logic references resolved together for one operational context.

A Contract Bundle is the unit of runtime logic trust.

It binds the versions of:

- schemas
- rules
- agent contracts
- mirror payload logic
- evaluation rules
- lifecycle policies

### 2.2 Contract Bundle Component

One versioned component included in a Contract Bundle.

Examples:

- schema contract version
- mirror contract version
- pipeline health policy version
- execution snapshot contract version
- agent contract version
- lifecycle policy version

### 2.3 Contract Bundle Resolution

The deterministic process by which the platform selects one Contract Bundle for a given execution, mirror, or artifact generation context.

### 2.4 Provenance Envelope

Structured metadata attached to an object describing:

- what created it
- under which bundle
- from which upstream objects
- when it was created
- what versions and snapshots were in force

### 2.5 Compatibility Posture

Normalized classification of whether a runtime context is allowed to operate under the requested or observed bundle composition.

Allowed values:

- `compatible`
- `mismatch`
- `unsupported`
- `blocked`

### 2.6 Enforcement Point

The place in the platform where bundle compatibility is checked and enforced.

Examples:

- local validation pipeline
- Cloudflare mirror intake
- D1 activation gate
- Execution Snapshot creation
- agent runtime start
- issue promotion
- report/export generation

### 2.7 Provenance-Bound Object

Any object that must carry a provenance envelope.

Initial required classes:

- Local Validation Batch
- Mirror Batch
- Pipeline Health Snapshot
- Execution Snapshot
- agent run
- WatchState
- EscalationCandidate
- Issue
- report artifact
- export artifact

## 3. Required Fields

## 3.1 `contract_bundles`

Required fields:

- `contract_bundle_id`
- `bundle_name`
- `bundle_version`
- `status`
- `schema_bundle_version`
- `mirror_contract_version`
- `pipeline_health_contract_version`
- `execution_snapshot_contract_version`
- `agent_contract_set_version`
- `lifecycle_contract_version`
- `evaluation_contract_version`
- `rule_pack_version`
- `source_control_ref`
- `created_at`
- `updated_at`

Optional fields:

- `notes`
- `effective_from`
- `effective_to`

## 3.2 `contract_bundle_components`

Required fields:

- `contract_bundle_component_id`
- `contract_bundle_id`
- `component_type`
- `component_name`
- `component_version`
- `source_control_ref`
- `created_at`

Optional fields:

- `component_hash`
- `notes`

## 3.3 `contract_bundle_resolution_policies`

Required fields:

- `resolution_policy_id`
- `context_type`
- `allowed_bundle_statuses_json`
- `require_exact_match`
- `allow_forward_compatible_components`
- `allow_backward_compatible_components`
- `block_on_unknown_component`
- `updated_at`

Optional fields:

- `notes`

Context examples:

- `mirror_intake`
- `snapshot_creation`
- `agent_runtime`
- `lifecycle_promotion`
- `artifact_generation`

## 3.4 `provenance_envelopes`

Required fields:

- `provenance_envelope_id`
- `object_type`
- `object_id`
- `contract_bundle_id`
- `source_batch_ids_json`
- `execution_snapshot_id`
- `agent_contract_id`
- `agent_id`
- `pipeline_health_snapshot_ids_json`
- `upstream_object_refs_json`
- `created_by_type`
- `created_by_id`
- `created_at`

Optional fields:

- `metadata_json`
- `artifact_uri`

Field notes:

- nullable fields remain required as columns even where not all object classes use them
- object classes that do not involve agents must still record null agent fields explicitly

## 3.5 `contract_compatibility_events`

Required fields:

- `contract_compatibility_event_id`
- `context_type`
- `context_object_type`
- `context_object_id`
- `requested_contract_bundle_id`
- `resolved_contract_bundle_id`
- `compatibility_posture`
- `event_time`
- `message`

Optional fields:

- `failure_code`
- `failure_message`
- `metadata_json`

## 4. State Model

### 4.1 Contract Bundle Status

Allowed values:

- `draft`
- `active`
- `deprecated`
- `retired`
- `blocked`

Meaning:

- `draft`
  - defined but not eligible for operational runtime
- `active`
  - approved for operational use
- `deprecated`
  - still usable in controlled contexts but should not be preferred
- `retired`
  - retained for history but not eligible for new runs
- `blocked`
  - not permitted for runtime use

### 4.2 Compatibility Posture

Allowed values:

- `compatible`
- `mismatch`
- `unsupported`
- `blocked`

Meaning:

- `compatible`
  - requested and resolved logic is acceptable for runtime
- `mismatch`
  - bundle or component mismatch exists
- `unsupported`
  - requested composition is not supported by policy
- `blocked`
  - runtime must not proceed

### 4.3 Provenance Envelope

Provenance Envelopes are immutable after creation.

If an object changes by versioned replacement, the replacement object must receive a new provenance envelope.

## 5. Invariants

### 5.1 Every Operationally Meaningful Object Must Be Provenance-Bound

Any Provenance-Bound Object must have exactly one provenance envelope.

### 5.2 Every Execution Must Bind Exactly One Contract Bundle

Mirror operations, Execution Snapshots, agent runs, lifecycle promotions, and artifact generation must each resolve exactly one Contract Bundle.

### 5.3 Contract Bundles Are Versioned, Not Edited In Place

Changes to bundle composition require a new bundle version.

### 5.4 Runtime Must Not Operate on Unknown Logic

If required contract components are unknown, missing, or blocked, the runtime may not proceed.

### 5.5 Provenance Must Preserve Upstream Traceability

Each provenance envelope must allow reconstruction of the upstream objects and batch/snapshot context that contributed to the object.

### 5.6 Compatibility Enforcement Must Occur Before Write

Any object that would persist operational state must pass compatibility enforcement before creation or promotion.

### 5.7 Historical Audit Must Survive Bundle Retirement

Retiring a bundle may not break the ability to interpret historical provenance.

### 5.8 Bundle Identity Must Be Stable

`contract_bundle_id` and `bundle_version` must uniquely identify one immutable bundle composition.

## 6. Allowed Transitions

### 6.1 Contract Bundle Status

Allowed transitions:

- `draft -> active`
- `active -> deprecated`
- `active -> blocked`
- `deprecated -> blocked`
- `deprecated -> retired`
- `blocked -> retired`

### 6.2 Compatibility Outcome

Allowed outcomes for a resolution attempt:

- `requested -> compatible`
- `requested -> mismatch`
- `requested -> unsupported`
- `requested -> blocked`

These are evaluation results, not mutable stored state transitions on a bundle.

## 7. Bundle Composition Rules

### 7.1 Contract Bundle Composition

At minimum, a Contract Bundle must include references to:

- schema versions
- mirror contract version
- Pipeline Health contract version
- Execution Snapshot contract version
- Agent Contract set version
- lifecycle contract version
- evaluation contract version
- deterministic rule pack version

### 7.2 Source Control Binding

Every Contract Bundle and every component must bind back to source control references in GitHub.

### 7.3 Bundle Completeness

A bundle may not become `active` unless all required component references are present.

### 7.4 Bundle Reuse Rules

The platform may reuse an existing active bundle only if the exact required composition is unchanged.

## 8. Bundle Resolution Rules

### 8.1 Resolution Must Be Deterministic

Bundle resolution must produce the same result when given the same:

- context type
- requested bundle or bundle family
- policy set
- runtime compatibility inputs

### 8.2 Requested vs Resolved Bundle

The platform must record both:

- the requested bundle
- the resolved bundle

when they differ or when a family alias resolves to a concrete bundle.

### 8.3 Context-Specific Resolution

Resolution policy may vary by context type.

Examples:

- mirror intake may require stricter exact-match behavior
- artifact generation may allow controlled use of a deprecated but still compatible bundle for reruns

### 8.4 Mismatch Behavior

If required components differ from policy:

- emit a compatibility event
- mark posture `mismatch`, `unsupported`, or `blocked`
- enforce context-specific runtime behavior

### 8.5 Blocking Behavior

Runtime must block when:

- bundle status is `blocked` or `retired`
- required components are missing
- policy requires exact match and mismatch is present
- context requires compatibility and posture is not `compatible`

## 9. Provenance Envelope Rules

### 9.1 Envelope Requirements by Object Class

At minimum:

- batches must record source batch lineage and bundle id
- Execution Snapshots must record bundle id and bound snapshot/batch references
- agent runs must record bundle id, agent contract, and Execution Snapshot
- lifecycle objects must record bundle id, Execution Snapshot, and source actor
- artifacts must record bundle id, Execution Snapshot, and upstream object refs

### 9.2 Upstream Object References

`upstream_object_refs_json` must allow tracing to the immediate upstream objects that materially contributed to the object.

Examples:

- report artifact -> execution snapshot, report run, metric inputs
- Issue -> escalation candidate or deterministic rule event
- EscalationCandidate -> watch state, agent run, execution snapshot

### 9.3 Nullability Discipline

If an object class does not use a field, the provenance envelope must still retain the field with explicit null rather than omitting provenance structure.

### 9.4 Envelope Immutability

Once attached, a provenance envelope must not be edited except through a formally versioned replacement object.

## 10. Runtime Enforcement Points

### 10.1 Local Validation Pipeline

Must bind the producing batch to:

- schema version
- validator version
- contract bundle reference where applicable

### 10.2 Cloudflare Mirror Intake

Must verify:

- incoming mirror contract compatibility
- accepted bundle status
- payload eligibility under policy

### 10.3 D1 Activation Gate

Must ensure that activation only occurs for batches associated with compatible bundle and mirror contract context.

### 10.4 Execution Snapshot Creation

Must resolve and bind exactly one Contract Bundle before persisting the snapshot.

### 10.5 Agent Runtime Start

Must verify:

- agent contract version is compatible with resolved bundle
- requested execution snapshot and bundle are aligned

### 10.6 Lifecycle Promotion

Must verify:

- candidate/issue promotion occurs under compatible lifecycle and agent contract context

### 10.7 Artifact Generation

Must bind report/export artifacts to:

- resolved bundle
- Execution Snapshot
- upstream object refs

## 11. Failure Modes

### 11.1 Unknown Bundle

Examples:

- runtime requests bundle id not found in platform state

Required behavior:

- block runtime
- emit compatibility event

### 11.2 Component Drift

Examples:

- agent contract version and bundle’s agent contract set version disagree
- local validator emits a payload using a mirror contract version not allowed by the resolved bundle

Required behavior:

- mark mismatch or blocked
- deny runtime where policy requires exact match

### 11.3 Missing Provenance Envelope

Examples:

- artifact generated without envelope
- EscalationCandidate persisted without execution or bundle binding

Required behavior:

- reject persistence
- emit integrity failure event if detected after write

### 11.4 Historical Reconstruction Failure

Examples:

- source control refs missing for retired bundle
- provenance envelope points to missing upstream refs without retention policy

Required behavior:

- emit audit integrity violation
- treat as serious platform defect

### 11.5 Unauthorized Compatibility Override

Examples:

- runtime proceeds despite blocked bundle
- manual bypass of compatibility enforcement

Required behavior:

- deny or flag operation
- emit high-severity audit event

## 12. Audit Requirements

The platform must retain auditable evidence for:

- every Contract Bundle
- every bundle component
- every compatibility resolution event
- every provenance envelope
- every blocked runtime due to bundle incompatibility

Audit records must allow reconstruction of:

- what logic bundle was in force
- what components composed it
- which source-control version defined it
- which objects were produced under it
- where compatibility mismatches or blocks occurred

### 12.1 Required Audit Artifacts

- Contract Bundle record
- Contract Bundle Component records
- compatibility event records
- provenance envelopes
- source-control references

## 13. Reconstruction Guarantees

The platform must be able to reconstruct for any persisted operational object:

- the exact Contract Bundle used
- the exact component versions included
- the upstream Execution Snapshot or batches used
- the source actor or subsystem that created the object
- the source-control references for the logic in force

This guarantee must hold even if:

- newer bundles exist
- the original bundle is deprecated or retired
- the object is reviewed long after creation

## 14. Administrative and Debug Access

Admins and integrity operators may inspect:

- bundle resolution paths
- compatibility events
- provenance envelopes
- source-control bindings

Administrative access must not silently rewrite bundle history or provenance.

## 15. Open Questions

Deferred to later specs:

- exact manifest format for bundle component hashes
- whether artifact classes need additional provenance fields beyond the generic envelope
- whether some low-risk contexts may allow controlled forward-compatible bundle reuse

## 16. Summary

This contract establishes:

- Contract Bundle as the unit of runtime logic trust
- deterministic bundle composition and resolution
- explicit compatibility and mismatch behavior
- provenance envelopes on all operationally meaningful objects
- runtime enforcement before operational writes
- durable audit reconstruction across batches, snapshots, agent runs, lifecycle objects, and artifacts
