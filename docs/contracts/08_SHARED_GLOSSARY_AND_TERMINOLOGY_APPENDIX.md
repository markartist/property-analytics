# Spec Appendix A: Shared Glossary & Terminology

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Shared terminology normalization across Specs 01-07

## 1. Purpose

Define the normalized vocabulary used across the first seven platform contracts so implementation work can proceed without terminology drift.

This appendix is authoritative for naming and usage unless a later spec explicitly supersedes a term.

## 2. Scope Terms

### 2.1 `scope_type`

Normalized execution or object scope classifier.

Allowed values:

- `property`
- `cohort`
- `portfolio`
- `global`
- `system`

Usage:

- `property`
  - requires `property_id`
- `cohort`
  - requires `cohort_key`
- `portfolio`
  - requires `portfolio_scope_key`
- `global`
  - no property-specific boundary; used for cross-portfolio or broad platform outputs
- `system`
  - platform or integrity scope, usually for non-property operational state

### 2.2 `property_id`

Canonical property identifier used whenever scope includes one specific property.

### 2.3 `cohort_key`

Canonical identifier for a named set of properties such as:

- pilot cohort
- regional cohort
- template cohort

### 2.4 `portfolio_scope_key`

Canonical identifier for a portfolio-wide but named scope boundary when `scope_type = portfolio`.

### 2.5 Scope Discipline

Rules:

- scope must be explicit, never inferred
- only the scope fields appropriate to the `scope_type` should be populated
- `global` and `system` are not synonyms
  - `global` is broad operational/business scope
  - `system` is platform/integrity/runtime scope

## 3. State Vocabulary

### 3.1 `status`

Use `status` for mutable lifecycle or object-state progression.

Examples:

- mirror batch status
- agent contract status
- watch state status
- issue status
- memory pattern status

### 3.2 `posture`

Use `posture` for normalized interpretive or trust-oriented condition summaries.

Examples:

- domain trust posture
- freshness posture
- validation posture
- mirror posture
- active batch posture
- contract posture
- compatibility posture

### 3.3 `level`

Use `level` for maturity tier or long-horizon classification rather than operational status.

Examples:

- memory level:
  - `observed`
  - `candidate_pattern`
  - `validated_pattern`
  - `institutional`

### 3.4 State Vocabulary Rule

Implementations should not interchange:

- `status`
- `posture`
- `level`

even where a UI may choose to display them similarly.

## 4. Provenance Terms

### 4.1 `contract_bundle_id`

Canonical identifier for the exact logic bundle in force.

### 4.2 `execution_snapshot_id`

Canonical identifier for the frozen world-state seen by an execution.

### 4.3 `agent_contract_id`

Canonical identifier for the versioned authority contract governing an agent run.

### 4.4 `provenance_envelope`

Structured provenance metadata attached to an operationally meaningful object.

### 4.5 Provenance Rule

If an object is persisted and materially affects operations, reporting, or memory, it should be provenance-bound.

## 5. Authority Vocabulary

### 5.1 `agent`

A governed operator acting under an Agent Contract.

### 5.2 `deterministic platform`

The non-agent rule/engine layer responsible for:

- metrics
- findings
- trust rollups
- policy enforcement
- dedupe/cooldown enforcement
- other deterministic state transitions

### 5.3 `supervisor`

Authorized reviewer or higher-level operator with oversight authority across a cohort, domain, or operational queue.

### 5.4 `owner`

Accountable authority for confirmation, review, or stewardship within a domain or memory context.

This term is narrower than general human operator and often refers to:

- domain owner
- governance owner
- integrity owner

### 5.5 `authorized human operator`

Human actor permitted to perform controlled actions not broadly available to agents.

### 5.6 `admin / integrity operator`

Privileged role for inspecting, debugging, auditing, and maintaining platform integrity.

Default rule:

- admins may inspect broadly
- admins should not silently rewrite historical operational truth

## 6. Noise and Suppression Terms

### 6.1 `noise budget`

The policy-limited rate at which an agent may emit WatchStates, EscalationCandidates, or related outputs.

### 6.2 `suppressed`

Recorded but not actively emitted or operationalized due to:

- dedupe
- cooldown
- noise budget
- other explicit policy

### 6.3 `suppressed-not-dropped`

Required platform behavior in which suppressed objects remain persisted and auditable.

## 7. Memory Terms

### 7.1 `Memory Observation`

Lowest-level captured recurring signal candidate.

### 7.2 `Memory Pattern`

Aggregated memory object under evaluation or validation.

### 7.3 `consumption_class`

Operational use allowance for memory:

- `reference_only`
- `decision_support`
- `operational_default`

### 7.4 Memory Consumption Rule

Lower-level memory may not be consumed beyond its allowed `consumption_class`.

## 8. Recommended Cross-Spec Usage Rules

- Use `status` only for mutable object lifecycle state.
- Use `posture` only for trust/condition summaries.
- Use `level` only for maturity tiers.
- Always persist `scope_type` explicitly.
- Always bind `execution_snapshot_id`, `contract_bundle_id`, and `agent_contract_id` where the governing spec requires them.
- Treat `global` and `system` as distinct scope concepts.
