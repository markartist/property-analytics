# Implementation Decisions Batch 01

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Final normalization decisions to support schema design and build planning after Specs 01-07 and Appendices A-C

## 1. Purpose

Resolve the highest-value implementation ambiguities identified in the cross-spec review so schema and runtime work can begin on stable, enforceable foundations.

This document is decision-oriented, not a replacement for the formal contracts.

## 2. Decision 01: Scope Field Matrix

### 2.1 Authoritative Scope Fields

Canonical fields:

- `scope_type`
- `property_id`
- `cohort_key`
- `portfolio_scope_key`

Allowed `scope_type` values:

- `property`
- `cohort`
- `portfolio`
- `global`
- `system`

### 2.2 Required vs Null Rules

| scope_type | property_id | cohort_key | portfolio_scope_key |
| --- | --- | --- | --- |
| `property` | required | nullable | null unless explicitly allowed by object class |
| `cohort` | null | required | null |
| `portfolio` | null | null | required |
| `global` | null | null | null |
| `system` | null | null | null |

### 2.3 Allowed Combination Rules

- `property`
  - must include `property_id`
  - may include `cohort_key` only when the object class explicitly supports attached cohort context
  - may not include `portfolio_scope_key`
- `cohort`
  - must include `cohort_key`
  - must not include `property_id`
  - must not include `portfolio_scope_key`
- `portfolio`
  - must include `portfolio_scope_key`
  - must not include `property_id`
  - must not include `cohort_key`
- `global`
  - all three scope ids must be null
- `system`
  - all three scope ids must be null

### 2.4 Object-Class-Specific Constraints

- `execution_snapshots`
  - may use all scope types
  - `property` snapshots may include `cohort_key` as additional context
- `watch_states`, `escalation_candidates`, `issues`
  - may use `property`, `cohort`, `portfolio`, `global`
  - may not use `system`
- `memory_observations`, `memory_patterns`, `memory_pattern_evidence`
  - may use `property`, `cohort`, `portfolio`, `global`, `system`
  - `system` memory is reserved for platform/integrity patterns
- `pipeline_health_snapshots` and mirror-domain records
  - remain domain-centric and do not require these scope fields as primary keys

### 2.5 Enforcement Rule

Persisted objects must be rejected if their scope field combination does not match this matrix.

## 3. Decision 02: Freshness Threshold Invariants

### 3.1 Required Ordering

For every `pipeline_health_policies` record:

- `fresh_after_minutes < aging_after_minutes < stale_after_minutes < expire_after_minutes`

### 3.2 Validation Rules

Policy creation or update must fail if:

- any threshold is null where required
- any threshold is zero or negative
- any threshold ordering rule is violated

### 3.3 Failure Behavior

If a policy violates threshold ordering:

- reject policy write
- emit integrity or configuration error event
- preserve prior valid policy if one exists
- do not allow rollup computation to use an invalid policy

### 3.4 Runtime Safety Rule

If an invalid policy is somehow encountered at runtime:

- do not compute fresh/aging/stale/expired from the invalid policy
- mark the affected domain trust computation as configuration-blocked
- emit a high-severity system-state event

## 4. Decision 03: Execution Snapshot Read Consistency

### 4.1 Chosen Mechanism

Use a hybrid consistency model:

1. capture one `snapshot_time`
2. read current per-domain active pointers and current Pipeline Health Snapshot references
3. compute a deterministic `binding_input_hash`
4. re-read the current pointer/snapshot reference set immediately before persist
5. if the hash changed, abort and retry construction

### 4.2 Required Inputs for Hash

The `binding_input_hash` must include at minimum:

- ordered `domain_key`
- ordered `active_mirror_batch_id`
- ordered `pipeline_health_snapshot_id`
- `contract_bundle_id`
- `scope_type`
- scope ids
- `execution_intent`
- `snapshot_time`

### 4.3 Determinism Rule

An Execution Snapshot may persist only if:

- the pre-bind read set
- the pre-persist verification set

produce the same `binding_input_hash`.

### 4.4 No Mixed-Domain Reads Rule

If any required domain binding changes between read and persist:

- abandon the candidate snapshot
- do not partially persist
- restart construction from a new `snapshot_time`

### 4.5 Retry/Fail Behavior

- automatic retries allowed: `3`
- after 3 failed consistency attempts:
  - fail snapshot creation
  - emit auditable failure metadata
  - require caller to retry later or surface the failure

## 5. Decision 04: Dedupe Signature + Issue-Family Scope Rules

### 5.1 Deterministic Dedupe Signature Construction

All dedupe signatures must be deterministic hashes over normalized fields.

### 5.2 WatchState Signature

Hash input, in order:

- object class: `watch_state`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `portfolio_scope_key`
- normalized severity bucket
- normalized root-cause or reason code set

### 5.3 EscalationCandidate Signature

Hash input, in order:

- object class: `escalation_candidate`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `portfolio_scope_key`
- normalized severity bucket
- normalized candidate reason code set

### 5.4 Issue Signature

Hash input, in order:

- object class: `issue`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `portfolio_scope_key`
- normalized severity bucket

### 5.5 Issue-Family Registry Rule

Every valid `issue_family_key` must exist in an issue-family registry with:

- `issue_family_key`
- allowed `scope_type` values
- default promotion mode
- default dedupe window
- default cooldown window

### 5.6 Scope Validation Rule

Lifecycle object creation must fail if:

- the requested `issue_family_key` is not registered
- the requested `scope_type` is not allowed for that issue family

## 6. Decision 05: Memory Consumption Enforcement

### 6.1 Enforcement Points

`consumption_class` must be enforced at:

- agent runtime start
- recommendation generation
- artifact/report/export generation

### 6.2 Enforcement Rules

- `reference_only`
  - may be displayed or cited as context
  - may not drive automated prioritization, escalation, or defaults
- `decision_support`
  - may inform recommendations and prioritization
  - may not become automatic operational default behavior
- `operational_default`
  - may be used as approved shared operating knowledge

### 6.3 Failure Behavior

If a consumer attempts to use memory above its allowed `consumption_class`:

- block the action
- emit a policy violation event
- attach audit metadata to the consumer run or artifact request

### 6.4 Audit Requirements

Audit records must capture:

- consumer type
- consumer id
- `memory_pattern_id`
- attempted consumption class
- allowed consumption class
- decision taken: allowed or blocked

## 7. Decision 06: Institutional Memory Owner Rights Matrix

### 7.1 Rights Matrix

| Role | Promote to `institutional` | Demote | Retire | Override contradiction | Override decay |
| --- | --- | --- | --- | --- | --- |
| `supervisor` | yes, if designated owner for scope/domain | yes | yes | no | no |
| `domain_owner` | yes | yes | yes | yes, within domain | yes, within domain |
| `governance_owner` | yes | yes | yes | yes, for governance-scoped memory | yes, for governance-scoped memory |
| `integrity_owner` | no for business/domain memory; yes for system/integrity memory | yes for system/integrity memory | yes for system/integrity memory | yes, for system/integrity memory | yes, for system/integrity memory |

### 7.2 Owner Confirmation Rule

Promotion to `institutional` requires:

- policy threshold satisfaction
- explicit confirmation by an authorized owner from the matrix above

### 7.3 Override Discipline

Any contradiction or decay override must:

- identify the overriding owner
- record rationale
- create a lifecycle event
- preserve the contradicting or decaying evidence in history

### 7.4 No Silent Override Rule

Owner rights may not be exercised without a recorded lifecycle event and provenance-bound rationale.

## 8. Summary

These decisions resolve the highest-value normalization seams before schema and build planning:

- authoritative scope field combinations
- explicit freshness threshold invariants
- concrete Execution Snapshot consistency mechanism
- deterministic dedupe signature construction
- issue-family scope validation
- memory consumption enforcement points
- institutional memory owner rights
