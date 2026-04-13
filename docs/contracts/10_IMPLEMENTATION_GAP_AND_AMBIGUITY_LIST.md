# Spec Appendix C: Implementation Gap & Ambiguity List

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Implementation-relevant cleanup notes identified during cross-spec review of Specs 01-07

## 1. Purpose

Capture the remaining seams, ambiguities, and implementation follow-ups that do not block the current contract spine but should be resolved before or during build planning.

## 2. High-Value Clarifications

### 2.1 Scope Normalization Beyond Execution Snapshot

Current state:

- `portfolio_scope_key` is explicit in Spec 03
- lifecycle and memory specs currently center on:
  - `scope_type`
  - `property_id`
  - `cohort_key`

Gap:

- clarify whether `portfolio` scope becomes first-class in lifecycle and memory objects
- clarify exact allowed field population rules for `global` vs `system`

Recommendation:

- publish one scope-field matrix for all persisted objects before schema implementation

### 2.2 Freshness Threshold Ordering

Current state:

- Spec 02 defines:
  - `fresh_after_minutes`
  - `aging_after_minutes`
  - `stale_after_minutes`
  - `expire_after_minutes`

Gap:

- ordering is implied, not explicitly constrained

Recommendation:

- enforce invariant:
  - `fresh_after_minutes < aging_after_minutes < stale_after_minutes < expire_after_minutes`

### 2.3 Read Consistency Boundary During Snapshot Construction

Current state:

- Spec 03 requires deterministic binding and restart/fail on mismatch

Gap:

- exact transactional or read-consistency mechanism is not yet specified

Recommendation:

- decide whether snapshot construction requires:
  - one transaction
  - version-checked repeatable reads
  - or active-pointer hash validation before persist

## 3. Provenance and Contract Gaps

### 3.1 Pipeline Health Provenance Envelope Mapping

Current state:

- Spec 06 expects all operationally meaningful objects to be provenance-bound
- Spec 02 references contract bundle fields indirectly but does not yet define a full provenance envelope pattern for Pipeline Health Snapshot

Recommendation:

- make Pipeline Health Snapshot provenance explicit during schema work:
  - bound event set or rollup basis
  - contract bundle or rule pack reference
  - upstream active batch context

### 3.2 Artifact Extension Pattern

Current state:

- Spec 06 allows generic provenance envelopes

Gap:

- artifact/report/export classes may want extra fields such as:
  - artifact template version
  - delivery target
  - artifact generation intent

Recommendation:

- define a lightweight artifact provenance extension pattern later without weakening the generic provenance contract

### 3.3 Local Validation Bundle Binding

Current state:

- user already flagged this as a future choice

Gap:

- whether local validation always binds a full Contract Bundle or only pre-resolution component versions

Recommendation:

- decide before implementing mirror producer metadata, because it affects local batch manifests

## 4. Authority and Lifecycle Gaps

### 4.1 Evaluation-Based Degradation / Suspension Path

Current state:

- Spec 04 allows evaluation-based degradation or suspension in principle

Gap:

- no formal review/intervention workflow yet

Recommendation:

- add a later control spec for:
  - who may degrade/suspend
  - review SLAs
  - reinstatement conditions

### 4.2 Issue Family Scope Validity

Current state:

- Spec 05 defines `issue_family_key`

Gap:

- no normalization yet for which issue families are legal at which scope shapes

Recommendation:

- define issue-family registry with allowed scope shapes before implementation of lifecycle validation

### 4.3 Dedupe Signature Standardization

Current state:

- dedupe keys/signatures are referenced but not standardized

Gap:

- risk of inconsistent dedupe behavior across implementations

Recommendation:

- publish one deterministic dedupe signature contract for:
  - WatchState
  - EscalationCandidate
  - Issue

## 5. Noise and Suppression Seam

### 5.1 Spec 04 vs Spec 05 Responsibility Split

Current state:

- Spec 04 owns agent noise budgets
- Spec 05 owns lifecycle-level dedupe and cooldown

This is the right split.

Clarification to preserve:

- Spec 04 answers:
  - how much an agent may emit
- Spec 05 answers:
  - whether a lifecycle object should exist, merge, suppress, or cooldown

Recommendation:

- implementation should enforce both, in this order:
  1. lifecycle dedupe/cooldown logic
  2. agent noise-budget logic on net emitted output

## 6. Memory Consumption and Authority Gaps

### 6.1 Memory Consumption Enforcement

Current state:

- Spec 07 clearly distinguishes:
  - `reference_only`
  - `decision_support`
  - `operational_default`

Gap:

- no runtime enforcement point is yet named for consumer misuse

Recommendation:

- enforce memory consumption class at:
  - agent runtime start
  - recommendation generation
  - artifact generation

### 6.2 Owner Taxonomy for Memory

Current state:

- Spec 07 allows owner types such as:
  - supervisor
  - domain owner
  - governance owner
  - integrity owner

Gap:

- exact owner taxonomy and rights matrix is not yet formalized

Recommendation:

- create a compact owner-rights appendix before implementing institutional promotion workflows

## 7. Non-Blocking Normalization Notes

### 7.1 `global` vs `system`

This distinction is present but should be preserved carefully:

- `global`
  - broad operational/business scope
- `system`
  - platform/integrity/runtime scope

### 7.2 `status` vs `posture` vs `level`

The separation is sound and should remain strict in schemas, APIs, and UI labels.

### 7.3 Snapshot Reuse

Current contracts intentionally keep reuse conservative.

Recommendation:

- if reuse is introduced later, require explicit reuse policy and audit tag

## 8. Summary

The contract spine is implementation-ready.

The highest-value follow-ups before heavy build work are:

1. publish a scope-field matrix
2. standardize freshness threshold ordering
3. define snapshot read-consistency mechanics
4. standardize dedupe signatures and issue-family scope rules
5. formalize enforcement points for memory consumption and evaluation-based agent control
