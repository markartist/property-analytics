# Phase 1 Enforcement Checklist

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Build-control checklist for Phase 1 services

## 1. Purpose

Use this checklist during implementation and code review to ensure no Phase 1 service ships without required trust, policy, provenance, and failure controls.

This is a checklist document, not a narrative spec.

## 2. Contract Bundle Resolver

### Required inputs

- requested bundle id or alias
- runtime context type
- bundle resolution policy
- current bundle/component state

### Required validations

- requested bundle exists or alias resolves deterministically
- bundle status is allowed for the context
- required components are present
- source-control references are present

### Required enforcement checks

- exact-match policy honored where required
- blocked/retired bundles rejected
- unknown components rejected when policy requires
- requested vs resolved bundle recorded when different

### Required provenance actions

- emit `contract_compatibility_event`
- persist requested and resolved bundle ids
- persist compatibility posture

### Required failure/block behavior

- block runtime on `blocked` or `unsupported`
- block runtime on required exact-match mismatch
- return explicit failure metadata, not silent fallback

### Must never do

- silently substitute incompatible bundles
- allow runtime to proceed on unknown bundle state
- resolve bundles using service-specific ad hoc logic

## 3. Mirror Intake Service

### Required inputs

- validated local batch manifest
- domain key
- mirror payload or payload reference
- integrity metadata
- resolved/validated contract bundle context

### Required validations

- local batch is marked validated
- domain key is known
- batch id is idempotent and well formed
- row counts/checksums are present where required
- mirror contract compatibility passes

### Required enforcement checks

- reject unvalidated local data
- reject duplicate conflicting mirror batch ids
- reject payloads with mismatched bundle/contract context
- write only batch/slice state, never active state

### Required provenance actions

- persist `mirror_batches`
- persist `mirror_batch_slices`
- attach contract bundle context
- preserve source validation batch ids

### Required failure/block behavior

- fail intake on validation or compatibility failure
- mark batch failed or reject before write completion
- never expose partial mirrored payload as active

### Must never do

- activate a batch
- compute Pipeline Health
- bypass compatibility enforcement
- ingest raw collection output directly

## 4. Activation Service

### Required inputs

- reconciled mirror batch
- reconciliation results
- current active pointer state

### Required validations

- batch is in reconciled/eligible state
- domain matches active pointer domain
- one and only one prior active pointer state is resolved

### Required enforcement checks

- atomic pointer update only
- prior active batch remains visible until replacement succeeds
- only one active batch per domain after commit

### Required provenance actions

- persist `mirror_activation_events`
- update batch status to `active` / `superseded`
- preserve previous active batch reference

### Required failure/block behavior

- block activation if reconciliation failed
- preserve prior active pointer on any failure
- emit activation failure metadata

### Must never do

- activate unreconciled batches
- partially update active pointers
- infer cross-domain consistency

## 5. Pipeline Health Builder

### Required inputs

- `system_state_events`
- `mirror_batches`
- `active_batch_pointers`
- `pipeline_health_policies`
- contract compatibility outcomes where applicable

### Required validations

- freshness policy thresholds are valid and ordered
- referenced active batch exists when required
- required policy rows exist for the domain

### Required enforcement checks

- compute snapshots deterministically
- use active batch context, not latest attempted batch only
- never yield `trusted` when required validation/mirror/contract state is missing or blocked
- keep posture dimensions separate:
  - freshness
  - validation
  - mirror
  - active batch
  - contract

### Required provenance actions

- persist `pipeline_health_snapshots`
- persist rollup explanation metadata or equivalent reason codes
- attach bundle/rule context as required by provenance model

### Required failure/block behavior

- block invalid policy usage
- degrade or mark unavailable instead of silently healthy
- emit configuration/system-state failure when policy is invalid

### Must never do

- let agents infer trust when a snapshot exists
- mutate active pointers
- create lifecycle objects directly

## 6. Execution Snapshot Builder

### Required inputs

- execution intent
- scope fields
- trigger metadata
- required/optional domain policy
- current active pointers
- current Pipeline Health Snapshots
- resolved contract bundle

### Required validations

- scope field combination matches scope matrix
- required domains exist
- required domains meet minimum posture rules
- contract bundle is compatible for snapshot creation

### Required enforcement checks

- capture one `snapshot_time`
- compute deterministic binding input hash
- verify read set again before persist
- fail/retry on changed binding input hash
- persist only exact `active_mirror_batch_id` and exact `pipeline_health_snapshot_id`

### Required provenance actions

- persist `execution_snapshots`
- persist `execution_snapshot_domain_bindings`
- bind exact `contract_bundle_id`
- persist snapshot fingerprint/hash

### Required failure/block behavior

- retry up to configured limit on consistency mismatch
- reject or block snapshot creation if required domains are unavailable
- never partially persist domain bindings

### Must never do

- infer missing domains
- persist mixed-domain reads
- let downstream runtime resolve active batches dynamically

## 7. Agent Runtime Gateway

### Required inputs

- `agent_identity`
- `agent_contract`
- `execution_snapshot_id`
- resolved contract bundle
- noise budget policy
- evaluation profile

### Required validations

- agent contract is active
- agent identity matches contract type
- scope is allowed by contract
- required domains and minimum trust rules are satisfied by the bound Execution Snapshot

### Required enforcement checks

- require exactly one `execution_snapshot_id`
- require exactly one `contract_bundle_id`
- enforce allowed reads and writes
- enforce prohibited actions
- enforce memory consumption class if memory is consulted

### Required provenance actions

- persist `agent_runtime_bindings`
- bind:
  - `execution_snapshot_id`
  - `agent_contract_id`
  - `contract_bundle_id`

### Required failure/block behavior

- deny execution on contract mismatch
- deny execution on unauthorized scope
- deny execution on missing required trusted domains
- emit permission/policy violation events

### Must never do

- run without Execution Snapshot
- resolve batches or health dynamically outside snapshot
- let agents write canonical fact state

## 8. Lifecycle Engine

### Required inputs

- agent output or deterministic platform signal
- issue-family registry
- lifecycle policy
- dedupe/cooldown state
- provenance context:
  - `execution_snapshot_id`
  - `contract_bundle_id`
  - `agent_contract_id` where applicable

### Required validations

- issue family exists in registry
- issue family allows requested `scope_type`
- scope fields satisfy scope matrix
- required provenance context is present

### Required enforcement checks

- compute dedupe signature centrally
- enforce dedupe window
- enforce cooldown window
- enforce suppressed-not-dropped behavior
- agents default to WatchState and EscalationCandidate only

### Required provenance actions

- persist `watch_states` and/or `escalation_candidates`
- persist `issue_lifecycle_events`
- bind exact execution and contract context
- persist suppression/dedupe reason where applicable

### Required failure/block behavior

- reject invalid issue family/scope combinations
- suppress/merge/link dedupe conflicts
- block unauthorized direct issue creation
- log cooldown violations and suppression outcomes

### Must never do

- accept caller-supplied dedupe signatures as authoritative
- silently drop suppressed objects
- create Issues by default in Phase 1

## 9. Shared Validators / Modules That Must Be Centralized

- scope field validator
- contract bundle resolver
- provenance envelope builder/attacher
- dedupe signature generator
- issue-family registry validator
- freshness threshold validator
- execution snapshot binding hash calculator
- memory consumption class checker

## 10. Tests Required Before a Service Is Safe

### Contract Bundle Resolver

- resolves deterministically for same inputs
- blocks blocked/unsupported bundles
- records requested vs resolved bundle correctly

### Mirror Intake Service

- rejects unvalidated batches
- rejects incompatible bundles
- supports idempotent replay without duplicate corruption
- never creates active visibility

### Activation Service

- atomic active pointer switch
- preserves prior active pointer on failure
- prevents multiple active batches per domain

### Pipeline Health Builder

- computes correct posture precedence
- rejects invalid freshness policy ordering
- reflects blocked/missing active batch honestly

### Execution Snapshot Builder

- exact bindings persisted
- consistency hash detects changed read set
- partial snapshot persistence impossible
- retries and fails correctly

### Agent Runtime Gateway

- blocks unauthorized scope
- blocks inactive/mismatched contracts
- blocks missing required trusted domains
- records runtime binding on success

### Lifecycle Engine

- dedupe signature is deterministic
- cooldown suppresses repeated emissions correctly
- suppressed objects remain persisted
- invalid issue-family scope is rejected

## 11. Common Implementation Mistakes to Avoid

- re-encoding scope rules in multiple services
- letting services resolve bundles independently
- attaching provenance after persistence instead of during persistence
- reading “latest” state during agent execution instead of using Execution Snapshot bindings
- treating suppressed as dropped
- allowing caller-provided dedupe signatures to drive lifecycle logic
- collapsing posture/status/level into one generic status field
- allowing policy tables to exist without runtime enforcement
- building lifecycle output before Execution Snapshot and Agent Runtime Gateway are trustworthy

## 12. Shipping Rule

No Phase 1 service should be considered shippable until:

- required validations exist
- required enforcement checks exist
- required provenance actions exist
- required failure/block behavior exists
- “must never do” conditions are covered by tests or code-level guards
