# Schema & Build Kickoff Package

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Implementation-oriented kickoff package for schema design and first-phase platform build work

## 1. Purpose

Translate the approved contract set, appendices, and implementation decisions into a practical build handoff for schema design and initial platform implementation.

This document does not redefine the architecture.

It organizes the work into:

- schema design domains
- real dependency order
- first-phase MVP boundaries
- implementation risk notes

## 2. Source of Truth

This kickoff package is derived from:

- Specs 01-07
- Appendix A: Shared Glossary & Terminology
- Appendix B: Cross-Spec Entity Map
- Appendix C: Implementation Gap & Ambiguity List
- Implementation Decisions Batch 01

## 3. Schema Design Plan

## 3.1 Domain A: Mirror / Activation

Purpose:

- mirror validated local data into D1
- preserve lineage
- enforce domain-level activation
- prevent partial operational visibility

Core tables/entities:

- `mirror_domains`
- `mirror_batches`
- `mirror_batch_slices`
- `active_batch_pointers`
- `mirror_activation_events`

Likely primary keys:

- `mirror_domains.domain_key`
- `mirror_batches.mirror_batch_id`
- `mirror_batch_slices.mirror_batch_slice_id`
- `active_batch_pointers.domain_key`
- `mirror_activation_events.activation_event_id`

Likely foreign keys:

- `mirror_batches.domain_key -> mirror_domains.domain_key`
- `mirror_batch_slices.mirror_batch_id -> mirror_batches.mirror_batch_id`
- `mirror_batch_slices.domain_key -> mirror_domains.domain_key`
- `active_batch_pointers.domain_key -> mirror_domains.domain_key`
- `active_batch_pointers.active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `mirror_activation_events.domain_key -> mirror_domains.domain_key`
- `mirror_activation_events.mirror_batch_id -> mirror_batches.mirror_batch_id`

Ordering dependency:

- foundational
- should be introduced first

Build note:

- this domain is required before any trustworthy cloud-side domain read model exists

## 3.2 Domain B: Pipeline Health / System State

Purpose:

- capture raw system-state events
- produce deterministic trust/read summaries per domain

Core tables/entities:

- `system_state_events`
- `pipeline_health_policies`
- `pipeline_health_snapshots`

Likely primary keys:

- `system_state_events.system_state_event_id`
- `pipeline_health_policies.domain_key`
- `pipeline_health_snapshots.pipeline_health_snapshot_id`

Likely foreign keys:

- `system_state_events.domain_key -> mirror_domains.domain_key`
- `system_state_events.mirror_batch_id -> mirror_batches.mirror_batch_id`
- `system_state_events.active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `pipeline_health_snapshots.domain_key -> mirror_domains.domain_key`
- `pipeline_health_snapshots.latest_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `pipeline_health_snapshots.active_mirror_batch_id -> mirror_batches.mirror_batch_id`

Ordering dependency:

- depends on Domain A for batch and active-pointer context
- should be introduced immediately after Mirror / Activation

Build note:

- snapshots may initially be materialized by a simple deterministic builder job
- no need for full async/event architecture in first phase

## 3.3 Domain C: Contract Bundle / Provenance

Purpose:

- define logic trust
- enforce compatibility
- attach provenance envelopes

Core tables/entities:

- `contract_bundles`
- `contract_bundle_components`
- `contract_bundle_resolution_policies`
- `contract_compatibility_events`
- `provenance_envelopes`

Likely primary keys:

- `contract_bundles.contract_bundle_id`
- `contract_bundle_components.contract_bundle_component_id`
- `contract_bundle_resolution_policies.resolution_policy_id`
- `contract_compatibility_events.contract_compatibility_event_id`
- `provenance_envelopes.provenance_envelope_id`

Likely foreign keys:

- `contract_bundle_components.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `provenance_envelopes.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `contract_compatibility_events.requested_contract_bundle_id -> contract_bundles.contract_bundle_id`
- `contract_compatibility_events.resolved_contract_bundle_id -> contract_bundles.contract_bundle_id`

Ordering dependency:

- foundational for runtime trust
- should be introduced early, before Execution Snapshot and agent runtime

Build note:

- provenance envelope infrastructure can start generic and expand later
- first phase should at least cover:
  - mirror batches
  - pipeline health snapshots
  - execution snapshots

## 3.4 Domain D: Execution Snapshot

Purpose:

- freeze runtime world-state
- bind exact active batches, health snapshots, and contract bundle

Core tables/entities:

- `execution_snapshots`
- `execution_snapshot_domain_bindings`
- `execution_snapshot_policies`

Likely primary keys:

- `execution_snapshots.execution_snapshot_id`
- `execution_snapshot_domain_bindings.execution_snapshot_domain_binding_id`
- `execution_snapshot_policies.execution_snapshot_policy_id`

Likely foreign keys:

- `execution_snapshots.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `execution_snapshot_domain_bindings.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `execution_snapshot_domain_bindings.active_mirror_batch_id -> mirror_batches.mirror_batch_id`
- `execution_snapshot_domain_bindings.pipeline_health_snapshot_id -> pipeline_health_snapshots.pipeline_health_snapshot_id`

Ordering dependency:

- depends on:
  - Domain A
  - Domain B
  - Domain C

Build note:

- this is the runtime trust anchor
- should be introduced before agent work and before artifact generation

## 3.5 Domain E: Agent Governance

Purpose:

- define agent identity, authority, scope, and evaluation context

Core tables/entities:

- `agent_contracts`
- `agent_identities`
- `agent_noise_budget_policies`
- `agent_evaluation_profiles`
- `agent_runtime_bindings`

Likely primary keys:

- `agent_contracts.agent_contract_id`
- `agent_identities.agent_id`
- `agent_noise_budget_policies.noise_budget_policy_id`
- `agent_evaluation_profiles.evaluation_profile_id`
- `agent_runtime_bindings.agent_runtime_binding_id`

Likely foreign keys:

- `agent_contracts.noise_budget_policy_id -> agent_noise_budget_policies.noise_budget_policy_id`
- `agent_contracts.evaluation_profile_id -> agent_evaluation_profiles.evaluation_profile_id`
- `agent_contracts.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `agent_identities.agent_contract_id -> agent_contracts.agent_contract_id`
- `agent_runtime_bindings.agent_id -> agent_identities.agent_id`
- `agent_runtime_bindings.agent_contract_id -> agent_contracts.agent_contract_id`
- `agent_runtime_bindings.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `agent_runtime_bindings.contract_bundle_id -> contract_bundles.contract_bundle_id`

Ordering dependency:

- depends on:
  - Domain C
  - Domain D

Build note:

- can be built before real agent orchestration exists
- first phase can support contract validation and runtime binding records even with limited agent execution

## 3.6 Domain F: Lifecycle

Purpose:

- manage operational concern progression from watch to candidate to issue

Core tables/entities:

- `watch_states`
- `escalation_candidates`
- `issues`
- `issue_lifecycle_events`
- `issue_lifecycle_policies`
- issue-family registry table
  - recommended addition for Implementation Decisions Batch 01

Likely primary keys:

- `watch_states.watch_state_id`
- `escalation_candidates.escalation_candidate_id`
- `issues.issue_id`
- `issue_lifecycle_events.issue_lifecycle_event_id`
- `issue_lifecycle_policies.issue_lifecycle_policy_id`
- `issue_family_registry.issue_family_key`

Likely foreign keys:

- `watch_states.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `watch_states.agent_contract_id -> agent_contracts.agent_contract_id`
- `watch_states.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `escalation_candidates.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `escalation_candidates.agent_contract_id -> agent_contracts.agent_contract_id`
- `escalation_candidates.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `issues.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `issues.agent_contract_id -> agent_contracts.agent_contract_id`
- `issues.contract_bundle_id -> contract_bundles.contract_bundle_id`
- lifecycle objects should reference `issue_family_registry.issue_family_key`

Ordering dependency:

- depends on:
  - Domain C
  - Domain D
  - Domain E

Build note:

- first phase should implement WatchState + EscalationCandidate before full Issue workflow
- Issue resolution workflow can be lighter initially

## 3.7 Domain G: Institutional Memory

Purpose:

- promote repeated validated patterns into governed shared memory

Core tables/entities:

- `memory_observations`
- `memory_patterns`
- `memory_pattern_evidence`
- `memory_promotion_policies`
- `memory_lifecycle_events`

Likely primary keys:

- `memory_observations.memory_observation_id`
- `memory_patterns.memory_pattern_id`
- `memory_pattern_evidence.memory_pattern_evidence_id`
- `memory_promotion_policies.memory_promotion_policy_id`
- `memory_lifecycle_events.memory_lifecycle_event_id`

Likely foreign keys:

- `memory_observations.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `memory_observations.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `memory_observations.agent_contract_id -> agent_contracts.agent_contract_id`
- `memory_patterns.owner_id` should reference a later owner directory or polymorphic owner model
- `memory_pattern_evidence.memory_pattern_id -> memory_patterns.memory_pattern_id`
- `memory_pattern_evidence.execution_snapshot_id -> execution_snapshots.execution_snapshot_id`
- `memory_pattern_evidence.contract_bundle_id -> contract_bundles.contract_bundle_id`
- `memory_pattern_evidence.agent_contract_id -> agent_contracts.agent_contract_id`
- `memory_lifecycle_events.memory_pattern_id -> memory_patterns.memory_pattern_id`
- `memory_lifecycle_events.contract_bundle_id -> contract_bundles.contract_bundle_id`

Ordering dependency:

- depends on:
  - Domain C
  - Domain D
  - Domain E
  - optionally Domain F for strong evidence sources

Build note:

- should come later than first-phase runtime trust and lifecycle foundations

## 4. Recommended Build Order

## 4.1 Phase 1A: Foundational Runtime Trust

Build first:

1. Domain A: Mirror / Activation
2. Domain C: Contract Bundle / Provenance
3. Domain B: Pipeline Health / System State

Reason:

- these establish validated mirrored visibility
- active-batch gating
- logic trust
- deterministic domain health

MVP boundary:

- enough to mirror validated batches
- activate per-domain batches safely
- compute and persist Pipeline Health Snapshots
- attach minimal provenance to mirrored state

## 4.2 Phase 1B: Frozen Execution Context

Build next:

4. Domain D: Execution Snapshot

Reason:

- this is the dependency bridge from platform truth to any governed runtime
- must exist before real agent execution, report trust, or issue promotion

MVP boundary:

- snapshot creation
- domain binding persistence
- consistency-hash validation
- blocked/rejected snapshot behavior

## 4.3 Phase 1C: Agent Governance Skeleton

Build next:

5. Domain E: Agent Governance

Reason:

- allows governed agent execution without yet requiring a full operations system

MVP boundary:

- agent contracts
- agent identities
- noise budget policies
- evaluation profiles
- runtime bindings

Stub allowed:

- sophisticated evaluation scoring
- automated degradation/suspension workflow

## 4.4 Phase 1D: Lifecycle MVP

Build next:

6. Domain F: Lifecycle

Reason:

- this is the first real operational surface
- depends on frozen execution context and agent governance

MVP boundary:

- issue-family registry
- WatchState
- EscalationCandidate
- dedupe/cooldown enforcement
- lifecycle events

Can wait slightly:

- full Issue assignment and rich resolution workflow
- deep monitor-tail automation

## 4.5 Phase 1E: Institutional Memory

Build later:

7. Domain G: Institutional Memory

Reason:

- shared memory is valuable, but only after the platform is producing trustworthy repeated observations

MVP boundary:

- Memory Observation
- Memory Pattern
- supporting/contradicting evidence

Can wait:

- full institutional promotion workflow
- advanced contradiction weighting
- cross-domain memory consumption controls beyond basic enforcement

## 5. Stub vs Wait Guidance

## 5.1 Good First-Phase Stubs

Safe to stub in first build:

- advanced artifact provenance extensions
- agent evaluation scoring formulas
- institutional owner taxonomy beyond minimal rights model
- complex monitor-tail reopen automation
- reuse optimization for Execution Snapshots

## 5.2 Should Not Be Stubbed

Do not stub these:

- active batch pointer enforcement
- Pipeline Health Snapshot trust rollup
- Execution Snapshot exact bindings
- contract bundle resolution and compatibility enforcement
- provenance envelope requirement on major runtime objects
- scope field validation
- dedupe/cooldown baseline enforcement

## 5.3 Should Wait Until Foundations Are Proven

Wait until earlier runtime foundations are proven before fully implementing:

- broad agent orchestration
- automated direct issue promotion by deterministic platform paths
- institutional memory as operational default
- complex supervisor workflows
- portfolio-scale operational dashboards over unstable lifecycle primitives

## 6. Implementation Risk Notes

## 6.1 Scope Handling Risk

Main risk:

- inconsistent interpretation of `scope_type` and the three scope ids across object classes

Why it matters:

- leads to broken dedupe
- broken authority checks
- ambiguous ownership

Mitigation:

- implement the scope matrix from Implementation Decisions Batch 01 as a shared validator
- do not duplicate scope validation logic in multiple services

## 6.2 Execution Snapshot Consistency Risk

Main risk:

- mixed-domain reads causing non-reproducible or partially stale snapshot bindings

Why it matters:

- undermines runtime trust anchor

Mitigation:

- implement the agreed hybrid hash-verify model exactly
- treat consistency failure as a restart condition, not a soft warning

## 6.3 Dedupe Behavior Risk

Main risk:

- inconsistent dedupe signature generation or missing issue-family registry rules

Why it matters:

- alert spam
- issue fragmentation
- false operational volume

Mitigation:

- centralize dedupe signature generation
- build issue-family registry with scope validation before lifecycle emission is enabled broadly

## 6.4 Provenance Coverage Risk

Main risk:

- some object classes persist before provenance envelope rules are uniformly enforced

Why it matters:

- breaks audit reconstruction
- weakens trust in outputs

Mitigation:

- require provenance envelope creation in the persistence layer for all Phase 1A-1D objects
- reject writes when provenance requirements are unmet

## 6.5 Policy Enforcement Risk

Main risk:

- policy exists in tables but is inconsistently applied at runtime boundaries

Why it matters:

- creates hidden logic and drift between contracts and execution

Mitigation:

- enforce policy at explicit runtime gates:
  - mirror intake
  - snapshot creation
  - agent runtime start
  - lifecycle creation/promotion

## 6.6 Memory Consumption Control Risk

Main risk:

- lower-level memory influences operational behavior beyond its allowed `consumption_class`

Why it matters:

- turns weak memory into pseudo-truth

Mitigation:

- gate consumption at:
  - agent runtime start
  - recommendation generation
  - artifact generation
- do not implement institutional default consumption until memory enforcement is working

## 7. First-Phase MVP Boundary

Recommended first-phase MVP includes:

- domain mirroring and activation
- deterministic pipeline health
- contract bundle resolution and basic provenance
- Execution Snapshot creation
- agent contract registry and runtime binding
- WatchState and EscalationCandidate lifecycle with dedupe/cooldown

Recommended first-phase MVP excludes or keeps deliberately thin:

- rich Issue workflow and assignment UX
- advanced agent evaluation controls
- institutional memory promotion beyond basic storage
- sophisticated artifact-specific provenance extensions

## 8. Practical Handoff Summary

If implementation starts now, the cleanest dependency order is:

1. Mirror / Activation
2. Contract Bundle / Provenance
3. Pipeline Health / System State
4. Execution Snapshot
5. Agent Governance
6. Lifecycle MVP
7. Institutional Memory

This order reflects runtime truth dependencies rather than document order and gives the platform a safe, testable spine before higher-level operational behavior expands.
