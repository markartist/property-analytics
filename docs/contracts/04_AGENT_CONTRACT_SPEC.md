# Spec 04: Agent Contract Spec

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for defining agent identity, authority, permitted scope, read/write boundaries, escalation permissions, noise discipline, and evaluation requirements

## 1. Purpose

Define the canonical contract that governs how agents operate inside the platform.

This spec establishes:

- how agents are identified and classified
- which scope shapes each agent type may operate within
- which domains each agent requires or may optionally use
- which minimum trust postures are acceptable for different execution intents
- what each agent may read
- what each agent may write
- what each agent is prohibited from doing
- how each agent may escalate, recommend, or defer action
- how noise budgets and discipline are enforced
- how agent quality is evaluated and audited

The purpose of this contract is to ensure that agents act as accountable stewards of a domain without becoming uncontrolled sources of truth, noise, or unauthorized change.

## 2. Entities

### 2.1 Agent Contract

Versioned definition of an agent’s mission, authority, and safety boundaries.

An Agent Contract governs:

- identity
- role
- scope permissions
- required domains
- optional domains
- health posture requirements
- read permissions
- write permissions
- prohibited actions
- escalation permissions
- noise budget rules
- evaluation requirements

### 2.2 Agent Type

Normalized classification of the agent’s primary operating role.

Initial examples:

- `property_advocate`
- `supervisor`
- `data_integrity`
- `performance`
- `experience`
- `governance`
- `traffic_search`
- `conversion_leasing`
- `reporting`
- `pattern_recognition`

### 2.3 Agent Identity

Stable identity for a specific agent instance or logical agent.

Examples:

- one Property Advocate for one property
- one Supervisor agent for a cohort
- one Data Integrity agent for the full platform

### 2.4 Agent Scope Shape

Normalized declaration of the scope shapes an agent type is allowed to operate within.

Allowed scope shapes:

- `property`
- `cohort`
- `portfolio`
- `global`
- `system`

This spec defines which of these are permitted for each agent type.

### 2.5 Agent Domain Dependency

Required or optional domain dependency for a contract.

Examples:

- required:
  - `psi`
  - `gtmetrix`
  - `evs`
- optional:
  - `gsc`
  - `gbp`
  - `reviews`

### 2.6 Minimum Trust Policy

Per-domain policy defining the minimum acceptable `Pipeline Health Snapshot` posture for an agent to use a domain in a given intent.

### 2.7 Agent Permission Set

Structured declaration of allowed reads, allowed writes, escalation permissions, and prohibited actions.

### 2.8 Noise Budget Policy

Structured limit model defining how much watch/escalation noise an agent may generate in a time window.

### 2.9 Agent Evaluation Profile

Structured definition of how the platform measures agent quality over time.

### 2.10 Agent Runtime Binding

Reference binding between an agent execution and:

- `execution_snapshot_id`
- `agent_contract_id`
- `contract_bundle_id`

This ensures the run can be audited against the exact contract in force.

## 3. Required Fields

## 3.1 `agent_contracts`

Required fields:

- `agent_contract_id`
- `agent_type`
- `contract_name`
- `contract_version`
- `status`
- `mission_statement`
- `success_criteria`
- `allowed_scope_shapes_json`
- `required_domains_json`
- `optional_domains_json`
- `minimum_trust_policy_json`
- `allowed_reads_json`
- `allowed_writes_json`
- `prohibited_actions_json`
- `escalation_permissions_json`
- `noise_budget_policy_id`
- `evaluation_profile_id`
- `contract_bundle_id`
- `effective_from`
- `created_at`
- `updated_at`

Optional fields:

- `effective_to`
- `notes`
- `owner_team`

## 3.2 `agent_identities`

Required fields:

- `agent_id`
- `agent_type`
- `agent_name`
- `agent_contract_id`
- `status`
- `default_scope_type`
- `default_property_id`
- `default_cohort_key`
- `created_at`
- `updated_at`

Optional fields:

- `supervisor_agent_id`
- `notes`

## 3.3 `agent_noise_budget_policies`

Required fields:

- `noise_budget_policy_id`
- `policy_name`
- `max_watch_states_per_day`
- `max_escalation_candidates_per_day`
- `max_escalation_candidates_per_issue_family_per_day`
- `cooldown_minutes_per_issue_family`
- `suppression_behavior`
- `updated_at`

Optional fields:

- `max_recommendations_per_day`
- `notes`

## 3.4 `agent_evaluation_profiles`

Required fields:

- `evaluation_profile_id`
- `profile_name`
- `measure_false_positive_rate`
- `measure_missed_issue_rate`
- `measure_timeliness`
- `measure_acceptance_rate`
- `measure_noise_suppression_rate`
- `updated_at`

Optional fields:

- `notes`

## 3.5 `agent_runtime_bindings`

Required fields:

- `agent_runtime_binding_id`
- `agent_id`
- `agent_contract_id`
- `execution_snapshot_id`
- `contract_bundle_id`
- `trigger_type`
- `scope_type`
- `property_id`
- `cohort_key`
- `created_at`

Optional fields:

- `notes`

## 4. State Model

### 4.1 Agent Contract Status

Allowed values:

- `draft`
- `active`
- `suspended`
- `retired`

Meaning:

- `draft`
  - defined but not yet executable
- `active`
  - may be bound to agent runs
- `suspended`
  - temporarily blocked from execution
- `retired`
  - not eligible for new runs but retained for audit

### 4.2 Agent Identity Status

Allowed values:

- `active`
- `paused`
- `degraded`
- `suspended`
- `retired`

Meaning:

- `active`
  - may execute normally
- `paused`
  - intentionally not running
- `degraded`
  - execution allowed with caution or increased supervision
- `suspended`
  - execution blocked
- `retired`
  - no longer in use

### 4.3 Noise Suppression Behavior

Allowed values:

- `suppress_and_log`
- `suppress_and_review`
- `block_and_escalate`

Meaning:

- `suppress_and_log`
  - excess output is recorded but not operationalized
- `suppress_and_review`
  - excess output is recorded and surfaced for supervisor review
- `block_and_escalate`
  - excess output blocks further emission and alerts a supervisor or integrity owner

## 5. Invariants

### 5.1 Agents May Only Run Under an Active Contract

No agent may execute unless its bound Agent Contract is `active`.

### 5.2 Agent Type and Contract Type Must Match

An `agent_identity.agent_type` must match its `agent_contract.agent_type`.

### 5.3 Scope Must Be Explicitly Allowed

An agent may only run in a scope shape listed in `allowed_scope_shapes_json`.

### 5.4 Required Domains Must Be Declared

Every agent contract must explicitly declare the domains it requires.

### 5.5 Minimum Trust Policy Must Exist for Required Domains

Every required domain must have a minimum acceptable trust policy in the contract.

### 5.6 Agents May Not Write Canonical Facts

Agents may not create, update, or delete canonical fact records, mirrored fact tables, active batch pointers, or Pipeline Health Snapshots.

### 5.7 Agents May Not Promote Their Own Findings Directly to Issues

Unless explicitly allowed by a later lifecycle contract, agents may create:

- `WatchState`
- `EscalationCandidate`
- recommendations
- posture updates

but may not directly create authoritative `Issue` records as a default behavior.

### 5.8 Prohibited Actions Override Allowed Writes

If an action appears in both allowed and prohibited sets, the prohibited rule wins.

### 5.9 Every Agent Run Must Bind to an Execution Snapshot

No agent may resolve active data dynamically outside an `ExecutionSnapshot`.

### 5.10 Noise Budgets Must Be Enforced

An active agent contract must bind exactly one `Noise Budget Policy`.

### 5.11 Evaluation Must Be Auditable

Every active agent contract must bind exactly one `Agent Evaluation Profile`.

## 6. Allowed Transitions

### 6.1 Agent Contract Status

Allowed transitions:

- `draft -> active`
- `active -> suspended`
- `active -> retired`
- `suspended -> active`
- `suspended -> retired`

### 6.2 Agent Identity Status

Allowed transitions:

- `active -> paused`
- `active -> degraded`
- `active -> suspended`
- `paused -> active`
- `degraded -> active`
- `degraded -> suspended`
- `suspended -> active`
- `suspended -> retired`

### 6.3 Contract Rebinding

An agent identity may be rebound from one contract version to another only if:

- the new contract is `active`
- the new contract matches the agent type
- the rebinding is auditable

Past runs must continue to point to the historical contract they used.

## 7. Contract Rules

Agent Contracts must be interpreted deterministically by the platform.

### 7.1 Scope Permission Rules

The platform must validate that an execution scope matches the agent contract.

Illustrative expectations:

- `property_advocate`
  - may operate in `property`
  - may optionally read cohort context if explicitly allowed later
- `supervisor`
  - may operate in `cohort`, `portfolio`, or `global`
- `data_integrity`
  - may operate in `system`, `portfolio`, or `global`
- `reporting`
  - may operate in `property`, `cohort`, `portfolio`, or `global` according to report product

The exact allowed scope shapes are governed by the contract record, not inferred from type names alone.

### 7.2 Required vs Optional Domain Rules

Required domains:

- must be present in the Execution Snapshot
- must meet minimum trust posture
- may block execution if unavailable or below required posture

Optional domains:

- may be excluded or degraded under policy
- may not be silently treated as healthy if unavailable

### 7.3 Minimum Trust Policy Rules

The contract must define minimum acceptable posture for each required domain.

Examples:

- a reporting agent may allow `stale` for `reviews`
- a Property Advocate may require `trusted` or `degraded` for `evs`
- a performance agent may require at least `stale` for `psi` but not `unavailable`

### 7.4 Allowed Read Rules

Allowed reads must be explicit and may include:

- Execution Snapshots
- Pipeline Health Snapshots
- mirrored fact domains
- approved institutional memory
- open findings
- open WatchStates
- open EscalationCandidates
- open Issues where appropriate

Agents must not read unauthorized data domains or hidden admin-only objects.

### 7.5 Allowed Write Rules

Allowed writes must be explicit and may include:

- recommendations
- WatchStates
- EscalationCandidates
- narrative summaries
- property posture assessments
- memory candidates
- supervisor notifications

The contract must explicitly list writeable object classes.

### 7.6 Prohibited Action Rules

Prohibited actions must be explicit and may include:

- modifying canonical facts
- changing standards or governance rules
- mutating active batch pointers
- mutating Pipeline Health Snapshots
- promoting to Issue without authorization
- deleting audit artifacts
- suppressing blocking failures without authorized override

### 7.7 Escalation Permission Rules

The contract must define whether an agent may:

- create `WatchState`
- create `EscalationCandidate`
- recommend supervisor review
- request human approval
- trigger automated notification

Escalation permissions are not implied by write permissions.

### 7.8 Noise Budget Rules

Every agent contract must bind a noise budget policy.

When a budget limit is exceeded:

- emission must be suppressed, reviewed, or blocked according to `suppression_behavior`
- excess output must be logged
- suppressed output must remain auditable

The platform must prefer suppressed-not-dropped behavior.

### 7.9 Evaluation Rules

The platform must evaluate agents against the bound evaluation profile.

Evaluation inputs may include:

- false positive rate
- missed issue rate
- time to detect
- acceptance rate of recommendations
- suppression frequency
- supervisor override rate

## 8. Failure Modes

### 8.1 Unauthorized Scope

Examples:

- Property Advocate attempts portfolio-wide execution
- Supervisor agent attempts system-only maintenance scope without authorization

Required behavior:

- reject execution
- log policy violation

### 8.2 Missing Required Domain

Examples:

- required domain absent from Execution Snapshot
- required domain bound below minimum trust policy

Required behavior:

- block or reject execution according to contract and snapshot policy

### 8.3 Unauthorized Write Attempt

Examples:

- agent attempts to mutate canonical fact table
- agent attempts to create Issue directly without authorization

Required behavior:

- deny write
- log policy violation
- optionally degrade or suspend the agent if repeated

### 8.4 Noise Budget Overrun

Examples:

- too many WatchStates in a day
- repeated EscalationCandidates for the same issue family

Required behavior:

- apply contract suppression behavior
- log all suppressed outputs
- expose overrun for supervisor or integrity review

### 8.5 Contract Mismatch

Examples:

- agent identity bound to inactive contract
- runtime bundle differs from contract bundle

Required behavior:

- reject execution
- emit auditable failure

### 8.6 Evaluation Degradation

Examples:

- persistent false positives
- repeated missed critical issues
- repeated supervisor overrides

Required behavior:

- record evaluation deficiency
- optionally move agent identity to `degraded` or `suspended`
- require contract or policy review

## 9. Audit Requirements

The platform must retain auditable evidence for:

- every agent contract version
- every agent identity binding
- every execution-to-contract binding
- every denied read or write
- every suppressed emission under noise budget
- every evaluation result used to assess the agent

Audit records must allow reconstruction of:

- which contract governed a run
- what the agent was allowed to do
- what the agent actually did
- whether the agent exceeded authority or noise limits
- how the agent has performed over time

### 9.1 Required Audit Artifacts

- Agent Contract record
- Agent Identity record
- Agent Runtime Binding record
- permission denial records
- noise suppression records
- evaluation records
- contract bundle id reference

## 10. Operational Requirements

### 10.1 Required Read Scope

Every agent contract must include required access to:

- its bound `ExecutionSnapshot`
- relevant `PipelineHealthSnapshot` state through that snapshot
- execution scope metadata
- open findings and posture objects relevant to its mission

Agents that depend on operational trust must also be able to read:

- freshness state
- validation state
- mirror state
- active batch posture
- contract posture

### 10.2 Required Context Awareness

Every agent must be able to know:

- what property/cohort/system it is responsible for
- why it is running
- what domains are trustworthy
- what domains are degraded, stale, or unavailable

### 10.3 Separation of Deterministic vs Agent Responsibility

Deterministic platform logic owns:

- metrics
- findings
- policy evaluation
- trust postures
- batch state

Agents own:

- interpretation
- prioritization
- operational posture
- recommendation
- escalation proposal

## 11. Administrative and Debug Access

Admins and integrity operators may inspect:

- agent contracts
- denied actions
- noise suppression logs
- evaluation outcomes

Administrative access must not allow retroactive mutation of historical agent runs or contracts except through formal versioning and status transitions.

## 12. Open Questions

Deferred to later specs:

- exact metric formulas for evaluation scoring
- exact mapping of escalation permissions into Issue lifecycle transitions
- whether some trusted system agents may receive narrowly-scoped direct issue-promotion rights in later phases

## 13. Summary

This contract establishes:

- agents as governed operators, not free actors
- explicit identity, role, scope, and domain requirements
- explicit allowed reads, writes, and prohibited actions
- minimum trust requirements by intent
- explicit escalation permissions
- enforced noise discipline
- auditable runtime binding to Execution Snapshots and contract bundles
- evaluation as a first-class control surface for agent quality
