# Spec 05: EscalationCandidate / Issue Lifecycle

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for the lifecycle of WatchState, EscalationCandidate, and Issue objects, including promotion, review, dedupe, cooldown, resolution, and auditability

## 1. Purpose

Define the canonical lifecycle for operational concern objects in the platform.

This spec establishes:

- the distinct roles of `WatchState`, `EscalationCandidate`, and `Issue`
- how operational posture advances from monitoring to formal issue state
- which actors may create, promote, review, resolve, or close lifecycle objects
- how dedupe and cooldown rules constrain noise
- how auto-promote, review-required, and hold behaviors work
- how resolution and monitor-tail states are represented
- how all lifecycle objects bind back to Execution Snapshots, agent contracts, and contract bundles

The purpose of this contract is to create a trusted operational pathway from signal to action without allowing uncontrolled issue creation, duplicate noise, or loss of provenance.

## 2. Entities

### 2.1 WatchState

Operational early-warning object representing a concern that does not yet qualify as a formal issue.

A WatchState exists to:

- track meaningful degradation or risk
- preserve visibility on emerging concerns
- support monitoring over time
- avoid premature issue creation

### 2.2 EscalationCandidate

Structured proposal that a concern may require formal issue treatment.

An EscalationCandidate exists to:

- gather evidence
- classify severity and confidence
- present promotion posture
- support controlled promotion to `Issue`

### 2.3 Issue

Authoritative operational problem record recognized by the platform as needing managed resolution.

An Issue exists to:

- assign accountable ownership
- track lifecycle and resolution
- support escalation and supervisor oversight
- preserve operational history

### 2.4 Promotion Mode

Normalized classification of how an EscalationCandidate may become an Issue.

Allowed values:

- `auto`
- `review_required`
- `hold`

Meaning:

- `auto`
  - candidate may be promoted deterministically without human review when rules are satisfied
- `review_required`
  - candidate requires supervisor or authorized reviewer promotion
- `hold`
  - candidate must remain unpromoted pending more evidence, time, or changed conditions

### 2.5 Issue Family

Normalized grouping key for materially similar concerns used for dedupe, cooldown, and suppression.

Examples:

- `performance_regression_homepage`
- `evs_cta_failure`
- `stale_data_ga4`
- `contract_mismatch_platform`

### 2.6 Resolution State

Normalized closure state for resolved or monitored concerns.

Allowed values:

- `resolved`
- `closed`
- `false_positive`
- `suppressed`
- `monitor_tail`

### 2.7 Lifecycle Actor

The actor responsible for creating or changing lifecycle state.

Examples:

- agent
- deterministic platform rule
- supervisor
- authorized human operator
- system job

## 3. Required Fields

## 3.1 `watch_states`

Required fields:

- `watch_state_id`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `severity`
- `confidence`
- `watch_reason`
- `status`
- `source_type`
- `source_actor_id`
- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`
- `first_observed_at`
- `last_observed_at`
- `created_at`
- `updated_at`

Optional fields:

- `notes`
- `expires_at`
- `cooldown_until`
- `related_issue_id`
- `dedupe_key`

## 3.2 `escalation_candidates`

Required fields:

- `escalation_candidate_id`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `severity`
- `confidence`
- `promotion_mode`
- `candidate_reason`
- `status`
- `source_type`
- `source_actor_id`
- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`
- `first_observed_at`
- `last_observed_at`
- `created_at`
- `updated_at`

Optional fields:

- `notes`
- `review_required_by`
- `reviewed_by`
- `reviewed_at`
- `hold_until`
- `cooldown_until`
- `related_watch_state_id`
- `related_issue_id`
- `dedupe_key`

## 3.3 `issues`

Required fields:

- `issue_id`
- `issue_family_key`
- `scope_type`
- `property_id`
- `cohort_key`
- `severity`
- `priority`
- `status`
- `opened_reason`
- `opened_by_type`
- `opened_by_id`
- `promotion_source_type`
- `promotion_source_id`
- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`
- `opened_at`
- `updated_at`

Optional fields:

- `assigned_owner_type`
- `assigned_owner_id`
- `resolution_summary`
- `resolved_at`
- `closed_at`
- `monitor_tail_until`
- `dedupe_key`
- `notes`

## 3.4 `issue_lifecycle_events`

Required fields:

- `issue_lifecycle_event_id`
- `object_type`
- `object_id`
- `event_type`
- `event_actor_type`
- `event_actor_id`
- `event_time`
- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`
- `message`

Optional fields:

- `old_status`
- `new_status`
- `metadata_json`

## 3.5 `issue_lifecycle_policies`

Required fields:

- `issue_lifecycle_policy_id`
- `issue_family_key`
- `default_promotion_mode`
- `auto_promote_allowed`
- `review_required_allowed`
- `hold_allowed`
- `dedupe_window_minutes`
- `cooldown_minutes`
- `monitor_tail_minutes`
- `updated_at`

Optional fields:

- `severity_override_rules_json`
- `notes`

## 4. State Model

### 4.1 WatchState Status

Allowed values:

- `open`
- `suppressed`
- `expired`
- `promoted`
- `closed`

Meaning:

- `open`
  - active watch requiring monitoring
- `suppressed`
  - retained but not actively emitted because of noise or dedupe control
- `expired`
  - watch aged out without escalation
- `promoted`
  - watch contributed to a candidate or issue
- `closed`
  - manually or deterministically closed

### 4.2 EscalationCandidate Status

Allowed values:

- `open`
- `under_review`
- `held`
- `promoted`
- `rejected`
- `suppressed`
- `closed`

Meaning:

- `open`
  - candidate exists and is eligible for normal evaluation
- `under_review`
  - candidate is awaiting supervisor or authorized human decision
- `held`
  - candidate intentionally paused pending more evidence or time
- `promoted`
  - candidate has become an Issue
- `rejected`
  - candidate was reviewed and declined for issue promotion
- `suppressed`
  - candidate retained but not actively emitted due to noise or dedupe controls
- `closed`
  - candidate closed without promotion

### 4.3 Issue Status

Allowed values:

- `open`
- `acknowledged`
- `in_progress`
- `blocked`
- `resolved`
- `monitor_tail`
- `closed`
- `false_positive`

Meaning:

- `open`
  - issue exists but may not yet be owner-acknowledged
- `acknowledged`
  - issue has been accepted for handling
- `in_progress`
  - active work is underway
- `blocked`
  - issue cannot currently advance
- `resolved`
  - issue condition is believed fixed
- `monitor_tail`
  - issue resolved but remains under observation for relapse
- `closed`
  - fully complete and no longer monitored
- `false_positive`
  - issue was determined not to represent a real problem

## 5. Invariants

### 5.1 WatchState, EscalationCandidate, and Issue Are Distinct Objects

These objects must not be conflated.

They may reference one another, but they do not substitute for one another.

### 5.2 Agents Default to WatchState and EscalationCandidate, Not Issue

Agents may create `WatchState` and `EscalationCandidate` under contract, but may not directly create authoritative `Issue` records by default.

### 5.3 Every Lifecycle Object Must Bind to Execution and Contract Context

Every WatchState, EscalationCandidate, and Issue must bind to:

- `execution_snapshot_id`
- `contract_bundle_id`

If created by an agent, it must also bind to:

- `agent_contract_id`

### 5.4 Issue Creation Requires a Promotion Path

Every Issue must identify its promotion source as:

- an EscalationCandidate
- a deterministic platform rule
- an authorized human/manual entry path

### 5.5 Dedupe Must Be Enforced Within Issue Family

Multiple lifecycle objects with materially identical `issue_family_key`, scope, and dedupe signature may not be emitted as independent active objects within the configured dedupe window.

### 5.6 Suppressed Objects Must Remain Auditable

Suppressed WatchStates and EscalationCandidates must never be silently dropped.

### 5.7 Resolved Issues May Enter Monitor Tail Before Closure

A resolved Issue may remain active in `monitor_tail` before final closure.

### 5.8 Promotion Mode Must Be Explicit on Candidates

Every EscalationCandidate must declare one `promotion_mode`.

### 5.9 Lifecycle Events Are Append-Only

`issue_lifecycle_events` must be append-only and must not be rewritten to alter history.

## 6. Allowed Transitions

### 6.1 WatchState Status

Allowed transitions:

- `open -> suppressed`
- `open -> expired`
- `open -> promoted`
- `open -> closed`
- `suppressed -> open`
- `suppressed -> expired`
- `suppressed -> closed`

### 6.2 EscalationCandidate Status

Allowed transitions:

- `open -> under_review`
- `open -> held`
- `open -> promoted`
- `open -> rejected`
- `open -> suppressed`
- `open -> closed`
- `under_review -> promoted`
- `under_review -> rejected`
- `under_review -> held`
- `held -> open`
- `held -> under_review`
- `held -> promoted`
- `suppressed -> open`
- `suppressed -> closed`
- `rejected -> closed`

### 6.3 Issue Status

Allowed transitions:

- `open -> acknowledged`
- `open -> in_progress`
- `open -> blocked`
- `open -> false_positive`
- `acknowledged -> in_progress`
- `acknowledged -> blocked`
- `acknowledged -> false_positive`
- `in_progress -> blocked`
- `in_progress -> resolved`
- `blocked -> in_progress`
- `blocked -> resolved`
- `resolved -> monitor_tail`
- `resolved -> closed`
- `monitor_tail -> closed`
- `monitor_tail -> open`

## 7. Promotion and Lifecycle Rules

### 7.1 WatchState Creation Rules

WatchState is the default early-warning lifecycle object.

It should be created when:

- a meaningful concern exists
- evidence is not yet sufficient for formal issue posture
- monitoring or accumulation of evidence is appropriate

### 7.2 EscalationCandidate Creation Rules

EscalationCandidate should be created when:

- evidence suggests an issue may be warranted
- severity or persistence exceeds ordinary watch posture
- supervisory review or deterministic promotion logic may soon be appropriate

### 7.3 Promotion Modes

#### 7.3.1 `auto`

Use when:

- policy explicitly permits auto-promotion
- evidence is sufficient
- dedupe/cooldown rules do not block promotion

#### 7.3.2 `review_required`

Use when:

- the concern has operational significance
- human or supervisor judgment is required
- evidence is meaningful but not fully self-authorizing

#### 7.3.3 `hold`

Use when:

- more time or evidence is needed
- duplicate risk is high
- promotion would be premature

### 7.4 Auto-Promotion Rules

An EscalationCandidate may auto-promote only if:

- `promotion_mode = auto`
- lifecycle policy permits auto-promotion for its issue family
- no active dedupe conflict exists
- no cooldown block exists
- required authority boundary is satisfied

### 7.5 Review-Required Promotion Rules

An EscalationCandidate requiring review may only promote when an authorized supervisor or human reviewer performs the promotion.

### 7.6 Hold Behavior

Held candidates:

- remain visible for audit
- may return to `open`
- may move to `under_review`
- may promote later if conditions change

### 7.7 Direct System Issue Creation

The deterministic platform may create an Issue directly only where:

- explicit lifecycle policy allows it
- the issue class is deterministic and high-confidence
- provenance remains fully bound to execution and bundle context

This path must be exceptional, explicit, and auditable.

## 8. Dedupe and Cooldown Rules

### 8.1 Dedupe Rules

Dedupe must consider at minimum:

- `issue_family_key`
- scope identity
- dedupe signature
- active time window

If a materially equivalent object already exists in-window:

- the new object must be merged, suppressed, or linked
- not emitted as a wholly separate active concern

### 8.2 Cooldown Rules

Cooldown applies after:

- promotion
- rejection
- closure
- suppression

Within cooldown:

- repeated candidates for the same issue family should normally suppress or link to the prior lifecycle object
- escalation may still occur if severity or evidence materially increases

### 8.3 Suppressed-Not-Dropped Behavior

Suppressed lifecycle objects must:

- be stored
- reference the suppressing reason
- remain available for supervisor or audit review

## 9. Authority Boundaries

### 9.1 Agent Authority

Agents may:

- create WatchStates
- create EscalationCandidates
- update their own open WatchStates or EscalationCandidates where allowed
- recommend promotion or closure

Agents may not by default:

- create Issues directly
- close Issues
- resolve Issues
- override dedupe or cooldown policy

### 9.2 Supervisor Authority

Supervisors or authorized reviewers may:

- review EscalationCandidates
- promote review-required candidates
- reject candidates
- reopen held or suppressed candidates
- acknowledge or reprioritize Issues

### 9.3 Deterministic Platform Authority

Deterministic platform logic may:

- enforce dedupe
- enforce cooldown
- auto-promote where explicit policy allows
- suppress objects under noise policy
- generate lifecycle events

### 9.4 Human Operator Authority

Authorized human operators may:

- manually open Issues where platform policy allows
- resolve or close Issues
- mark false positives
- assign owners
- reopen Issues in monitor-tail relapse cases

## 10. Resolution and Closure Rules

### 10.1 Issue Resolution

An Issue may become `resolved` when:

- the underlying condition is believed corrected
- sufficient evidence exists to support the resolution

### 10.2 Monitor Tail

After resolution, an Issue may enter `monitor_tail` for a defined observation window.

During monitor tail:

- relapse may reopen the Issue
- no new duplicate issue should normally be emitted for the same family and scope

### 10.3 Closure

An Issue may become `closed` when:

- monitor tail completed without relapse
- or policy allows direct close after resolution

### 10.4 False Positive

An Issue may become `false_positive` only through authorized review.

This state must remain auditable and should inform later agent evaluation.

## 11. Failure Modes

### 11.1 Unauthorized Direct Issue Creation

Examples:

- agent attempts to open an Issue directly without explicit authorization

Required behavior:

- deny creation
- log policy violation

### 11.2 Duplicate Emission

Examples:

- repeated candidate emitted inside dedupe window

Required behavior:

- suppress, merge, or link according to policy
- retain audit record

### 11.3 Cooldown Violation

Examples:

- repeat escalation candidate emitted during cooldown with no material evidence change

Required behavior:

- suppress or hold according to policy
- record cooldown reason

### 11.4 Promotion Without Provenance

Examples:

- Issue created with no source candidate, no execution snapshot, or no contract bundle

Required behavior:

- reject promotion

### 11.5 Orphaned Lifecycle Objects

Examples:

- WatchState or EscalationCandidate references missing parent context

Required behavior:

- reject creation
- emit integrity event if corruption is detected later

### 11.6 Improper Closure

Examples:

- Issue closed with no resolution basis
- Issue moved from open directly to closed where policy forbids it

Required behavior:

- reject transition
- log policy violation

## 12. Audit Requirements

The platform must retain auditable evidence for:

- every WatchState
- every EscalationCandidate
- every Issue
- every lifecycle transition
- every promotion, rejection, suppression, and closure
- all dedupe and cooldown enforcement actions

Audit records must allow reconstruction of:

- why the object was created
- who or what created it
- what evidence and execution context supported it
- how it advanced or was blocked
- why it resolved, closed, or relapsed

### 12.1 Required Audit Artifacts

- WatchState record
- EscalationCandidate record
- Issue record
- Issue lifecycle event records
- dedupe and suppression records
- cooldown enforcement records
- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`

## 13. Operational Requirements

### 13.1 Provenance Binding

All lifecycle objects must bind back to:

- the Execution Snapshot that provided the world-state
- the contract bundle that governed the run
- the agent contract if agent-created

### 13.2 Noise Budget Integration

Noise-budget enforcement must apply to:

- WatchState creation
- EscalationCandidate creation
- repeated lifecycle emissions in the same issue family

### 13.3 Evaluation Integration

Later agent evaluation must be able to use lifecycle outcomes such as:

- rejected candidates
- false-positive issues
- repeated suppressed duplicates
- successful early watch detection before issue promotion

## 14. Administrative and Debug Access

Admins and integrity operators may inspect:

- lifecycle objects
- transitions
- suppressed objects
- dedupe and cooldown decisions
- promotion decisions

Administrative access must not silently rewrite lifecycle history.

## 15. Open Questions

Deferred to later specs:

- exact owner-assignment workflow for Issues
- exact review UI/queue behavior for review-required candidates
- whether monitor-tail duration is globally standardized or issue-family-specific

## 16. Summary

This contract establishes:

- WatchState, EscalationCandidate, and Issue as distinct operational lifecycle objects
- controlled promotion paths with `auto`, `review_required`, and `hold`
- explicit authority boundaries among agent, supervisor, deterministic logic, and humans
- dedupe and cooldown as first-class controls
- resolution, closure, and monitor-tail semantics
- full provenance back to Execution Snapshots, agent contracts, and contract bundles
