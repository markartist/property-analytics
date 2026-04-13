# Spec 07: Institutional Memory Promotion Model

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for promoting patterns into institutional memory, including evidence thresholds, contradiction handling, decay, reverification, ownership, provenance, and authority boundaries

## 1. Purpose

Define the canonical lifecycle by which repeated observations and validated patterns become shared operational memory.

This spec establishes:

- the allowed memory levels
- the evidence required to move between levels
- how repetition across runs, properties, and time is measured
- how contradictions and decay are handled
- how reverification works
- when owner confirmation is required
- how provenance must be preserved on memory objects
- who may propose, promote, demote, retire, and consume memory

The purpose of this contract is to ensure that the platform’s shared memory becomes durable, useful, and trustworthy without allowing anecdote, drift, or unverified repetition to become institutional truth.

## 2. Entities

### 2.1 Memory Observation

Lowest-level memory object representing a single observed pattern candidate derived from one or more runs or lifecycle objects.

A Memory Observation exists to:

- capture an interpretable recurring signal
- preserve provenance
- provide raw material for pattern promotion

### 2.2 Memory Pattern

Structured memory object representing a multi-observation pattern under evaluation or validation.

A Memory Pattern may exist at one of several promotion levels and may accumulate supporting and contradicting evidence.

### 2.3 Memory Level

Normalized classification of memory maturity.

Allowed values:

- `observed`
- `candidate_pattern`
- `validated_pattern`
- `institutional`

Meaning:

- `observed`
  - one or more observations exist, but evidence is not yet sufficient for pattern trust
- `candidate_pattern`
  - repeated evidence suggests a pattern may be real
- `validated_pattern`
  - the pattern is supported by sufficient repeated evidence and not materially contradicted
- `institutional`
  - the pattern is approved for shared operational consumption as durable knowledge

### 2.4 Evidence Event

Structured supporting or contradicting evidence attached to a Memory Pattern.

Examples:

- repeated issue-family occurrence
- repeated EVS failure mode
- repeated agent success or failure mode
- supervisor validation note
- contradiction from newer validated data

### 2.5 Memory Owner

The accountable person or system role responsible for confirming, reviewing, or retiring a memory pattern.

Examples:

- supervisor
- domain owner
- governance owner
- integrity owner

### 2.6 Reverification Window

The time window in which a Memory Pattern must be revalidated to remain at its current level.

### 2.7 Memory Consumption Class

The operational use level allowed for a Memory Pattern.

Allowed values:

- `reference_only`
- `decision_support`
- `operational_default`

Meaning:

- `reference_only`
  - may be shown or inspected but should not drive operational defaults
- `decision_support`
  - may inform prioritization, recommendations, or review
- `operational_default`
  - may be consumed by agents or products as approved shared knowledge

## 3. Required Fields

## 3.1 `memory_observations`

Required fields:

- `memory_observation_id`
- `memory_key`
- `domain_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `observation_summary`
- `evidence_type`
- `confidence`
- `source_type`
- `source_actor_id`
- `execution_snapshot_id`
- `contract_bundle_id`
- `created_at`

Optional fields:

- `agent_contract_id`
- `notes`
- `metadata_json`

## 3.2 `memory_patterns`

Required fields:

- `memory_pattern_id`
- `memory_key`
- `memory_level`
- `domain_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `pattern_summary`
- `supporting_evidence_count`
- `contradicting_evidence_count`
- `distinct_run_count`
- `distinct_property_count`
- `consumption_class`
- `status`
- `owner_type`
- `owner_id`
- `created_at`
- `updated_at`

Optional fields:

- `last_validated_at`
- `next_reverification_due_at`
- `retired_at`
- `notes`

## 3.3 `memory_pattern_evidence`

Required fields:

- `memory_pattern_evidence_id`
- `memory_pattern_id`
- `evidence_polarity`
- `evidence_type`
- `source_object_type`
- `source_object_id`
- `execution_snapshot_id`
- `contract_bundle_id`
- `event_time`
- `confidence`
- `summary`

Optional fields:

- `agent_contract_id`
- `notes`

Field notes:

- `evidence_polarity` must be either `supporting` or `contradicting`

## 3.4 `memory_promotion_policies`

Required fields:

- `memory_promotion_policy_id`
- `domain_key`
- `scope_type`
- `observed_to_candidate_min_support_count`
- `candidate_to_validated_min_support_count`
- `validated_to_institutional_min_support_count`
- `minimum_distinct_run_count`
- `minimum_distinct_property_count`
- `maximum_contradiction_ratio`
- `reverification_interval_days`
- `owner_confirmation_required_for_institutional`
- `updated_at`

Optional fields:

- `notes`

## 3.5 `memory_lifecycle_events`

Required fields:

- `memory_lifecycle_event_id`
- `memory_pattern_id`
- `event_type`
- `old_memory_level`
- `new_memory_level`
- `event_actor_type`
- `event_actor_id`
- `event_time`
- `contract_bundle_id`
- `message`

Optional fields:

- `execution_snapshot_id`
- `agent_contract_id`
- `metadata_json`

## 4. State Model

### 4.1 Memory Pattern Status

Allowed values:

- `active`
- `under_review`
- `decaying`
- `contradicted`
- `retired`

Meaning:

- `active`
  - pattern is currently valid at its assigned memory level
- `under_review`
  - pattern is being reviewed for promotion, demotion, contradiction, or retirement
- `decaying`
  - pattern is aging out or overdue for reverification
- `contradicted`
  - contradictory evidence has materially weakened trust
- `retired`
  - pattern is no longer approved for active use

### 4.2 Memory Level Progression

Normal progression:

- `observed -> candidate_pattern -> validated_pattern -> institutional`

Permitted downward movement:

- `institutional -> validated_pattern`
- `validated_pattern -> candidate_pattern`
- `candidate_pattern -> observed`

Direct retirement:

- any level -> `retired`

## 5. Invariants

### 5.1 Institutional Memory Requires Provenance

No memory object may exist without traceable supporting evidence and provenance.

### 5.2 Promotion Must Be Evidence-Based

Memory level promotion may not occur without satisfying the applicable promotion policy.

### 5.3 Contradictions Must Be Counted

Contradicting evidence must not be silently ignored.

### 5.4 Institutional Memory Requires Owner Confirmation

No pattern may become `institutional` unless owner confirmation is recorded where policy requires it.

### 5.5 Memory Must Be Reverifiable

Patterns at `validated_pattern` and `institutional` levels must have reverification timing.

### 5.6 Consumption Class Must Match Memory Level

Suggested invariant:

- `observed` -> `reference_only`
- `candidate_pattern` -> `reference_only` or `decision_support`
- `validated_pattern` -> `decision_support`
- `institutional` -> `operational_default`

### 5.7 Memory Must Not Become Folklore

No agent or product may treat an `observed` or `candidate_pattern` as an operational default.

### 5.8 Lifecycle Events Are Append-Only

Memory promotion, demotion, contradiction, decay, reverification, and retirement must be recorded as append-only lifecycle events.

## 6. Allowed Transitions

### 6.1 Memory Level

Allowed transitions:

- `observed -> candidate_pattern`
- `candidate_pattern -> validated_pattern`
- `validated_pattern -> institutional`
- `institutional -> validated_pattern`
- `validated_pattern -> candidate_pattern`
- `candidate_pattern -> observed`
- any level -> `retired`

### 6.2 Memory Pattern Status

Allowed transitions:

- `active -> under_review`
- `under_review -> active`
- `active -> decaying`
- `decaying -> active`
- `active -> contradicted`
- `contradicted -> under_review`
- `under_review -> retired`
- `decaying -> retired`
- `contradicted -> retired`

## 7. Promotion Rules

### 7.1 `observed -> candidate_pattern`

Promotion requires:

- at least the minimum supporting evidence count
- at least the minimum distinct run count
- no blocking contradiction threshold breach

### 7.2 `candidate_pattern -> validated_pattern`

Promotion requires:

- stronger supporting evidence threshold
- repeated support across runs
- policy-required property diversity where applicable
- contradiction ratio below threshold

### 7.3 `validated_pattern -> institutional`

Promotion requires:

- validated pattern evidence thresholds satisfied
- reverification current
- contradiction ratio below threshold
- required owner confirmation completed

### 7.4 Cross-Run and Cross-Property Repetition

Promotion policy may require:

- repeated evidence across separate runs
- repeated evidence across separate properties

This prevents one noisy property or one noisy run from becoming institutional memory.

### 7.5 Scope-Sensitive Promotion

Promotion thresholds may vary by scope.

Examples:

- property-specific memory may allow lower distinct-property counts
- portfolio-wide institutional memory should normally require evidence across multiple properties

## 8. Contradiction, Decay, and Reverification Rules

### 8.1 Contradiction Handling

When contradicting evidence arrives:

- increment contradiction counts
- evaluate contradiction ratio against policy
- move status to `contradicted` or `under_review` where appropriate

### 8.2 Decay

Memory patterns should decay when:

- no reinforcing evidence appears within the reverification window
- newer platform behavior materially diverges from the pattern

Decay should not silently delete the pattern. It should change status and require review.

### 8.3 Reverification

Patterns at `validated_pattern` and `institutional` levels must be reviewed on schedule.

Reverification may:

- preserve level and status
- demote the pattern
- move it to `decaying`
- retire it

### 8.4 Retirement

Retirement should occur when:

- contradiction overwhelms support
- the pattern is no longer operationally relevant
- the pattern is superseded by newer validated knowledge

Retired patterns remain auditable but may not be used as active memory.

## 9. Authority Boundaries

### 9.1 Agent Authority

Agents may:

- create Memory Observations
- propose supporting or contradicting evidence
- recommend promotion or review

Agents may not by default:

- promote directly to `institutional`
- override contradiction or reverification policy
- retire memory unilaterally

### 9.2 Deterministic Platform Authority

Deterministic platform logic may:

- count support and contradiction
- evaluate policy thresholds
- move patterns into `under_review`
- trigger decay or reverification status changes

### 9.3 Owner / Supervisor Authority

Owners or supervisors may:

- confirm promotion where required
- approve or deny institutionalization
- demote or retire patterns after review
- mark contradictions as resolved or material

### 9.4 Consumer Authority

Consumers may:

- read memory up to their authorized consumption class
- not silently elevate lower-level memory to operational default behavior

## 10. Provenance Requirements

### 10.1 Observation Provenance

Every Memory Observation must bind to:

- source object or source actor
- execution snapshot where applicable
- contract bundle

### 10.2 Pattern Evidence Provenance

Every supporting or contradicting evidence event must bind to:

- source object
- event time
- contract bundle
- execution snapshot where applicable

### 10.3 Promotion Provenance

Every promotion, demotion, contradiction, decay, reverification, or retirement action must create a lifecycle event with:

- actor
- prior and new level/status
- contract bundle
- rationale

## 11. Failure Modes

### 11.1 Promotion Without Sufficient Evidence

Required behavior:

- deny promotion
- log policy violation or review block

### 11.2 Contradiction Ignored

Required behavior:

- record contradiction
- trigger review if thresholds are crossed

### 11.3 Owner Confirmation Missing

If institutional promotion requires owner confirmation and none exists:

- block institutional promotion

### 11.4 Decay Not Processed

If reverification becomes overdue:

- pattern must move to `decaying` or `under_review`
- it may not silently remain trusted indefinitely

### 11.5 Unproven Memory Consumed as Default

If `observed` or `candidate_pattern` memory is used as `operational_default`:

- treat as policy violation
- log and review the consuming agent or product

## 12. Audit Requirements

The platform must retain auditable evidence for:

- every Memory Observation
- every Memory Pattern
- every supporting and contradicting evidence event
- every promotion, demotion, contradiction, reverification, and retirement lifecycle event
- every owner confirmation decision

Audit records must allow reconstruction of:

- what the pattern was
- why it was promoted or demoted
- what evidence supported it
- what contradicted it
- who approved or retired it

## 13. Consumption Requirements

### 13.1 `observed`

May be used only as:

- `reference_only`

### 13.2 `candidate_pattern`

May be used as:

- `reference_only`
- `decision_support`

### 13.3 `validated_pattern`

May normally be used as:

- `decision_support`

### 13.4 `institutional`

May be used as:

- `operational_default`

subject to consumer authorization and scope.

## 14. Administrative and Debug Access

Admins and integrity operators may inspect:

- memory observations
- memory patterns
- contradiction history
- promotion and retirement events
- owner confirmations

Administrative access must not silently rewrite memory history.

## 15. Open Questions

Deferred to later specs:

- whether some domains require domain-specific memory level names or subclasses
- exact owner type taxonomy for confirmation rights
- exact contradiction weighting formula across evidence classes

## 16. Summary

This contract establishes:

- staged memory levels from `observed` to `institutional`
- promotion gates tied to evidence, repetition, and contradiction thresholds
- reverification, decay, and retirement behavior
- owner confirmation for true institutionalization
- full provenance on observations, evidence, and promotion events
- clear authority boundaries on who may propose, promote, demote, retire, and consume shared memory
