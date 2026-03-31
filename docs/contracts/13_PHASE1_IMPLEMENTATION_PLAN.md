# Phase 1 Implementation Plan

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Practical Phase 1 build plan derived from Specs 01-07, Appendices A-C, Implementation Decisions Batch 01, and the Schema & Build Kickoff Package

## 1. Purpose

Translate the approved contract set into a practical Phase 1 implementation plan that an engineer or delivery agent can use to begin safe platform build work immediately.

This document is implementation-focused.

It does not redesign the system.

## 2. Phase 1 Objective

Phase 1 should prove that the platform can:

- accept validated local data safely
- mirror it into D1 without partial operational visibility
- activate domain truth atomically
- compute deterministic trust/read state
- freeze runtime world-state for execution
- run a governed agent against that frozen state
- emit bounded lifecycle objects with provenance and dedupe discipline

Phase 1 does not need to deliver the full multi-agent or institutional-memory system.

## 3. Core Services Definition

## 3.1 Mirror Intake Service

Responsibility:

- receive validated mirror payloads from the local Mac
- verify mirror contract compatibility
- persist Mirror Batch metadata and mirrored payload slices
- reject invalid or incomplete intake requests

Inputs:

- validated local batch manifest
- mirrored payload or payload reference
- domain key
- requested contract bundle or component version context
- integrity metadata such as row counts/checksums

Outputs:

- `mirror_batches`
- `mirror_batch_slices`
- `contract_compatibility_events`
- intake success/failure result

Key invariants:

- never ingests unvalidated raw collection output
- never marks a batch active
- never exposes partial mirrored payload as operational truth
- must preserve idempotent batch identity

Must NOT do:

- compute Pipeline Health
- create Execution Snapshots
- allow agents to read in-progress payloads
- bypass compatibility enforcement

## 3.2 Activation Service

Responsibility:

- reconcile completed mirror batches
- update `active_batch_pointers` atomically
- supersede prior active batches
- emit activation events

Inputs:

- reconciled mirror batch
- reconciliation results
- current active pointer state

Outputs:

- `active_batch_pointers`
- `mirror_activation_events`
- batch status transition to `active` / `superseded`

Key invariants:

- one active batch per domain
- activation is atomic
- prior active state remains visible until replacement is fully eligible
- no partial or failed batch becomes active

Must NOT do:

- modify mirrored fact rows outside activation context
- infer cross-domain consistency
- let products or agents read unreconciled batches as active

## 3.3 Pipeline Health Builder

Responsibility:

- consume system-state events and current domain state
- compute deterministic `PipelineHealthSnapshot` per domain
- summarize trust posture for operational consumers

Inputs:

- `system_state_events`
- `mirror_batches`
- `active_batch_pointers`
- `pipeline_health_policies`
- contract compatibility outcomes where relevant

Outputs:

- `pipeline_health_snapshots`
- health rollup explanation metadata

Key invariants:

- snapshots are deterministic and derived
- health reflects current active batch context, not just latest attempt
- invalid policy or missing required state cannot silently yield `trusted`

Must NOT do:

- create lifecycle objects
- let agents infer trust ad hoc when a snapshot is available
- mutate mirror state or active pointers

## 3.4 Execution Snapshot Builder

Responsibility:

- create immutable `ExecutionSnapshot` objects
- bind exact per-domain active batch ids and Pipeline Health Snapshot ids
- enforce consistency before persist

Inputs:

- current active pointers
- current Pipeline Health Snapshots
- resolved contract bundle
- execution intent, scope, and trigger metadata
- execution snapshot policy

Outputs:

- `execution_snapshots`
- `execution_snapshot_domain_bindings`
- blocked/rejected snapshot attempts

Key invariants:

- one frozen world-state per snapshot
- exact `active_mirror_batch_id` bindings
- exact `pipeline_health_snapshot_id` bindings
- hash-verified consistency before persist

Must NOT do:

- allow mixed-domain reads to persist
- let callers continue on stale in-memory bindings after mismatch
- infer missing required domains

## 3.5 Agent Runtime Gateway

Responsibility:

- start governed agent executions
- verify agent contract, scope, and trust requirements
- bind agent execution to one Execution Snapshot and one Contract Bundle
- deny unauthorized reads/writes

Inputs:

- `agent_identities`
- `agent_contracts`
- `agent_noise_budget_policies`
- `agent_evaluation_profiles`
- `execution_snapshot_id`
- resolved contract bundle

Outputs:

- `agent_runtime_bindings`
- allowed/denied execution result
- permission and policy violation events

Key invariants:

- no agent runs without an Execution Snapshot
- no agent runs outside allowed scope
- no agent runs under an inactive or mismatched contract

Must NOT do:

- compute trust posture itself
- resolve batches dynamically outside the snapshot
- let agents write canonical fact state

## 3.6 Lifecycle Engine

Responsibility:

- create and manage `WatchState` and `EscalationCandidate`
- enforce issue-family scope rules
- enforce dedupe and cooldown
- attach required provenance and runtime context

Inputs:

- agent outputs
- deterministic platform findings where applicable
- `issue_lifecycle_policies`
- issue-family registry
- noise-budget outcomes from Agent Runtime Gateway or companion enforcement

Outputs:

- `watch_states`
- `escalation_candidates`
- `issue_lifecycle_events`
- suppression / dedupe / cooldown records

Key invariants:

- agents default to WatchState and EscalationCandidate, not Issue
- dedupe is deterministic
- suppressed objects are recorded, not dropped

Must NOT do:

- create Issues by default in Phase 1
- bypass scope validation
- persist lifecycle objects without required provenance context

## 3.7 Contract Bundle Resolver

Responsibility:

- resolve the active Contract Bundle for runtime contexts
- enforce bundle compatibility rules
- emit compatibility outcomes

Inputs:

- `contract_bundles`
- `contract_bundle_components`
- `contract_bundle_resolution_policies`
- runtime context type
- requested bundle id or alias, where applicable

Outputs:

- resolved `contract_bundle_id`
- `contract_compatibility_events`
- allowed / blocked resolution result

Key invariants:

- resolution is deterministic
- blocked or unsupported bundles do not proceed
- requested vs resolved bundle is always auditable

Must NOT do:

- silently substitute incompatible bundles
- let runtime continue on unknown bundle state

## 4. Data Flow (End-to-End)

## 4.1 Local Collection and Validation

Where it happens:

- local Mac only

Flow:

1. local collectors gather source data
2. local normalization produces validated local domain output
3. local validation certifies the batch

Validation happens here:

- collection integrity
- normalization integrity
- local batch eligibility

Failure behavior:

- stop before mirror
- emit local/system-state failure event for later mirrored visibility if appropriate

## 4.2 Mirror Intake

Where it happens:

- Cloudflare-mediated intake into D1

Flow:

4. local validated batch is sent to Mirror Intake Service
5. Contract Bundle Resolver verifies mirror compatibility
6. Mirror Intake persists `mirror_batches` and `mirror_batch_slices`

Policy enforced here:

- mirror compatibility
- intake eligibility
- domain and batch idempotency

Provenance attached here:

- mirror batch lineage
- contract bundle context

Failure behavior:

- stop before activation
- persist failure metadata and compatibility event

## 4.3 Activation

Where it happens:

- Cloudflare/D1 operational layer

Flow:

7. Activation Service reconciles the mirrored batch
8. if reconciliation passes, active pointer updates atomically
9. activation event is recorded

Policy enforced here:

- active-batch gating
- atomic visibility

Provenance attached here:

- activation event linkage to mirror batch and bundle context

Failure behavior:

- preserve prior active batch
- stop progression of the new batch to operational visibility

## 4.4 Pipeline Health

Where it happens:

- Cloudflare operational layer

Flow:

10. Pipeline Health Builder reads:
   - system-state events
   - active pointers
   - mirror state
   - policies
11. creates or updates `pipeline_health_snapshots`

Policy enforced here:

- trust posture rollup
- freshness ordering
- required validation/mirror/contract checks

Provenance attached here:

- snapshot provenance or rollup context references

Failure behavior:

- domain becomes stale/degraded/unavailable rather than silently healthy

## 4.5 Execution Snapshot

Where it happens:

- Cloudflare operational layer

Flow:

12. Execution Snapshot Builder resolves:
   - active batch per domain
   - Pipeline Health Snapshot per domain
   - Contract Bundle
13. builder hash-validates the binding set
14. builder persists immutable Execution Snapshot and domain bindings

Policy enforced here:

- scope validation
- required vs optional domain rules
- consistency enforcement

Provenance attached here:

- exact contract bundle binding
- exact bound domain refs

Failure behavior:

- blocked/rejected snapshot
- no downstream agent or artifact execution

## 4.6 Agent Run

Where it happens:

- Cloudflare operational shell

Flow:

15. Agent Runtime Gateway verifies:
   - agent identity
   - contract status
   - scope permission
   - minimum trust posture requirements
16. gateway persists `agent_runtime_bindings`
17. agent executes against frozen Execution Snapshot

Policy enforced here:

- scope permission
- agent authority
- noise-budget availability
- required trust posture by domain

Provenance attached here:

- execution snapshot id
- contract bundle id
- agent contract id

Failure behavior:

- deny execution before the agent does operational work

## 4.7 Lifecycle Emission

Where it happens:

- Cloudflare operational shell

Flow:

18. agent output is submitted to Lifecycle Engine
19. Lifecycle Engine validates:
   - issue family
   - allowed scope
   - dedupe signature
   - cooldown state
   - provenance requirements
20. engine persists:
   - WatchState
   - EscalationCandidate
   - lifecycle events

Policy enforced here:

- issue-family registry
- dedupe/cooldown
- suppressed-not-dropped behavior

Provenance attached here:

- execution snapshot id
- contract bundle id
- agent contract id

Failure behavior:

- suppress, reject, or block according to rule class

## 5. First Build Slice (MVP Implementation Cut)

## 5.1 Included

Domains:

- `ga4`
- `psi`

Services:

- Mirror Intake Service
- Activation Service
- Pipeline Health Builder
- Execution Snapshot Builder
- Contract Bundle Resolver
- Agent Runtime Gateway
- Lifecycle Engine

Runtime objects:

- mirror batches and active pointers
- Pipeline Health Snapshots
- Execution Snapshots
- one agent type:
  - `property_advocate`
- WatchState
- EscalationCandidate

Scope:

- property scope only

## 5.2 Explicitly Excluded

- full Issue workflow
- multi-agent orchestration
- supervisor workflow UI
- institutional memory promotion
- portfolio-wide and global lifecycle handling
- artifact/report-specific provenance extensions

## 5.3 Stubbed

- agent evaluation scoring details
- advanced suspension/degradation workflow for agents
- monitor-tail issue handling
- artifact generation beyond minimal proof path
- optional domain support beyond a small initial list

## 5.4 Why This Slice

This is the smallest slice that proves:

- hybrid local-to-cloud integrity path works
- D1 active-batch visibility works
- trust/read state works
- frozen runtime binding works
- governed agent execution works
- bounded operational output works

## 6. Hard Enforcement Points

## 6.1 Scope Validation

Must enforce at:

- Execution Snapshot Builder
- Agent Runtime Gateway
- Lifecycle Engine

## 6.2 Provenance Attachment

Must enforce at:

- Mirror Intake Service
- Pipeline Health Builder
- Execution Snapshot Builder
- Agent Runtime Gateway
- Lifecycle Engine
- any artifact/report generation introduced in Phase 1

## 6.3 Contract Bundle Binding

Must enforce at:

- Mirror Intake Service
- Execution Snapshot Builder
- Agent Runtime Gateway
- Lifecycle Engine when persisting agent-created objects

## 6.4 Execution Snapshot Requirement

Must enforce at:

- Agent Runtime Gateway
- Lifecycle Engine for agent-created outputs
- artifact/report generation when introduced

## 6.5 Dedupe / Cooldown

Must enforce at:

- Lifecycle Engine before object persistence

## 6.6 Memory Consumption Class

Phase 1 expectation:

- no institutional-memory-driven behavior in MVP

If any memory consumption is introduced early, enforce at:

- Agent Runtime Gateway
- recommendation generation layer
- artifact/report generation layer

## 7. Failure Handling Strategy

## 7.1 Mirror Failure

Behavior:

- fail intake or mark mirror batch failed
- do not activate
- preserve prior active batch

Log:

- mirror failure event
- compatibility event if applicable

Surface:

- Pipeline Health should later show degraded or stale fallback

## 7.2 Activation Failure

Behavior:

- block activation
- preserve existing active pointer

Log:

- activation failure event

Surface:

- `active_batch_posture = blocked` or equivalent degraded state

## 7.3 Snapshot Inconsistency

Behavior:

- retry up to 3 times
- then fail snapshot creation

Log:

- blocked/rejected snapshot attempt
- consistency mismatch metadata

Surface:

- caller gets blocked result
- no downstream agent run

## 7.4 Contract Mismatch

Behavior:

- block runtime at the enforcement point

Log:

- compatibility event

Surface:

- explicit blocked result to caller/service

## 7.5 Dedupe Conflict

Behavior:

- suppress, merge, or link
- do not emit duplicate active lifecycle object

Log:

- suppression/dedupe event

Surface:

- auditable suppressed object or linked object record

## 7.6 Policy Violations

Examples:

- invalid scope
- unauthorized write
- missing provenance

Behavior:

- reject write or execution

Log:

- policy violation event

Surface:

- blocked result to caller

## 8. Build Risks (Execution-Level)

## 8.1 Scope Drift

Risk:

- different services interpret scope matrix differently

Mitigation:

- implement one shared scope validator library/service contract
- do not re-encode scope rules in each service separately

## 8.2 Snapshot Inconsistency Bugs

Risk:

- mixed-domain reads create invalid frozen world-state

Mitigation:

- implement the hash-verify model first
- add deterministic integration tests that mutate active pointers during snapshot construction

## 8.3 Dedupe Fragmentation

Risk:

- different callers compute different signatures for the same concern

Mitigation:

- centralize dedupe signature generation in Lifecycle Engine
- do not allow caller-provided dedupe hashes as authoritative

## 8.4 Missing Provenance Paths

Risk:

- some persisted objects are created before provenance is attached

Mitigation:

- make provenance attachment part of persistence, not an afterthought job
- reject writes that lack required provenance context

## 8.5 Policy Enforcement Gaps

Risk:

- contracts exist in tables but are not enforced uniformly

Mitigation:

- implement enforcement only at hard runtime gates
- log denied actions as first-class events
- test each gate independently

## 8.6 Bundle Resolution Drift

Risk:

- different services resolve different bundles for the same context

Mitigation:

- one Contract Bundle Resolver service/module only
- no local service-specific resolution logic

## 9. Practical Phase 1 Build Sequence

1. Implement Contract Bundle Resolver
2. Implement Mirror Intake Service
3. Implement Activation Service
4. Implement Pipeline Health Builder
5. Implement Execution Snapshot Builder
6. Implement Agent Governance schema + Agent Runtime Gateway
7. Implement Lifecycle Engine for WatchState + EscalationCandidate
8. Add end-to-end integration tests across the full path

Reason for this order:

- bundle resolution is needed at almost every other runtime gate
- mirror and activation create trustworthy domain state
- pipeline health and execution snapshot create runtime trust
- only then should governed agents and lifecycle emission be enabled

## 10. Phase 1 Success Criteria

Phase 1 should be considered successful when:

- a validated local GA4 or PSI batch can be mirrored safely
- the domain can be activated atomically
- Pipeline Health Snapshot reflects current truth
- an Execution Snapshot can be created deterministically
- a Property Advocate agent can run under contract against that snapshot
- the agent can emit a WatchState or EscalationCandidate with valid provenance
- dedupe/cooldown and policy enforcement work at runtime boundaries

## 11. Summary

Phase 1 should build the minimum safe operating spine:

- trusted mirrored state
- deterministic trust/read model
- frozen execution context
- governed agent entry
- bounded lifecycle output

That is the smallest implementation cut that proves the platform works end-to-end without skipping integrity, provenance, or policy enforcement.
