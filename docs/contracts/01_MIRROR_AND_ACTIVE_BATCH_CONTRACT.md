# Spec 01: Mirror & Active Batch Contract

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Contract for validated local-to-cloud mirroring, domain-level activation, and safe agent/product reads

## 1. Purpose

Define the canonical contract for moving validated local data from the integrity root on the local Mac into Cloudflare D1 without exposing partial, stale, or unverified state to agents, products, or downstream systems.

This contract exists to ensure:

- local integrity remains the source of trust
- D1 acts only as a validated mirror
- mirroring is idempotent and resumable
- domain datasets can advance independently
- no partial mirror becomes visible to operational reads
- every visible batch is attributable, reconcilable, and auditable

## 2. Entities

### 2.1 Mirror Domain

Logical data family that advances independently.

Examples:

- `ga4`
- `gsc`
- `psi`
- `gtmetrix`
- `evs`
- `gbp`
- `guest_cards`
- `availability`
- `reviews`

### 2.2 Local Validation Batch

Certified output of the local integrity pipeline for one domain.

This batch is created locally after:

- collection
- normalization
- validation
- reconciliation against local expectations

It is the only unit eligible for mirroring to Cloudflare.

### 2.3 Mirror Batch

Cloud-visible representation of one validated Local Validation Batch for one domain.

A Mirror Batch exists in D1 and tracks:

- identity
- source lineage
- contract versions
- reconciliation state
- activation state

### 2.4 Mirror Batch Table Slice

Metadata describing one mirrored table or logical slice within a Mirror Batch.

Used to reconcile:

- row counts
- checksums
- logical coverage
- error state

### 2.5 Active Batch Pointer

Per-domain pointer to the currently visible Mirror Batch.

Agents and product reads must resolve domain truth through the Active Batch Pointer or views derived from it.

### 2.6 Mirror Intake Request

Signed or otherwise authenticated request from the local integrity root to the Cloudflare-mediated mirror intake endpoint.

It contains:

- batch manifest
- domain payloads or payload references
- contract bundle identifiers
- integrity metadata

### 2.7 Activation Event

Auditable state transition in which a reconciled Mirror Batch becomes the active visible batch for its domain.

## 3. Required Fields

## 3.1 `mirror_domains`

Required fields:

- `domain_key`
- `display_name`
- `owner_team`
- `enabled`
- `created_at`
- `updated_at`

## 3.2 `mirror_batches`

Required fields:

- `mirror_batch_id`
- `domain_key`
- `source_validation_batch_id`
- `source_snapshot_id`
- `schema_bundle_version`
- `validator_bundle_version`
- `mirror_bundle_version`
- `payload_contract_version`
- `batch_date_start`
- `batch_date_end`
- `row_count_total_expected`
- `row_count_total_received`
- `checksum_manifest`
- `status`
- `created_at`
- `mirroring_started_at`
- `mirroring_completed_at`
- `reconciled_at`
- `activated_at`
- `failed_at`
- `failure_code`
- `failure_message`

Optional fields:

- `notes`
- `source_host`
- `operator_id`

## 3.3 `mirror_batch_slices`

Required fields:

- `mirror_batch_slice_id`
- `mirror_batch_id`
- `domain_key`
- `target_table`
- `slice_key`
- `row_count_expected`
- `row_count_received`
- `slice_checksum_expected`
- `slice_checksum_received`
- `status`
- `created_at`
- `completed_at`
- `failed_at`
- `failure_code`
- `failure_message`

## 3.4 `active_batch_pointers`

Required fields:

- `domain_key`
- `active_mirror_batch_id`
- `activated_at`
- `previous_mirror_batch_id`
- `updated_at`

## 3.5 `mirror_activation_events`

Required fields:

- `activation_event_id`
- `domain_key`
- `mirror_batch_id`
- `previous_mirror_batch_id`
- `activation_reason`
- `activated_by`
- `created_at`

## 3.6 Mirrored Fact Rows

Every mirrored fact row must carry:

- `mirror_batch_id`
- `domain_key`
- `source_validation_batch_id`
- `schema_bundle_version`
- `payload_contract_version`
- domain-specific natural key fields
- domain-specific metric/fact fields

Mirrored fact rows must not be considered operationally visible unless their `mirror_batch_id` is active for that domain.

## 4. State Model

### 4.1 Mirror Batch State Model

Allowed states:

- `prepared`
- `mirroring`
- `mirrored`
- `reconciling`
- `reconciled`
- `active`
- `superseded`
- `failed`
- `quarantined`

State meanings:

- `prepared`
  - accepted by Cloudflare intake but not yet written
- `mirroring`
  - payload is being written to D1
- `mirrored`
  - write completed, reconciliation not yet started
- `reconciling`
  - row counts and checksums are being verified
- `reconciled`
  - batch passed reconciliation and is eligible for activation
- `active`
  - currently visible operational batch for the domain
- `superseded`
  - previously active batch replaced by a newer batch
- `failed`
  - batch failed intake, write, or reconciliation
- `quarantined`
  - batch written but blocked from activation due to integrity concerns requiring intervention

### 4.2 Mirror Batch Slice State Model

Allowed states:

- `pending`
- `writing`
- `written`
- `reconciled`
- `failed`
- `quarantined`

### 4.3 Active Pointer State Model

The pointer itself is not stateful beyond its current value. It must always reference exactly one `active` Mirror Batch per domain when a domain is enabled and initialized.

## 5. Invariants

The following must always hold:

### 5.1 Local Integrity First

No mirror batch may be created unless it references a successfully validated local batch.

### 5.2 Domain Isolation

Mirror activation is domain-specific.

A failure in one domain must not block activation of a different domain.

### 5.3 Single Active Batch Per Domain

At most one Mirror Batch per domain may be in `active` state at a time.

### 5.4 Active Reads Only

Agents and products must not read mirrored fact tables directly unless they are filtered to the active batch for that domain.

### 5.5 No Partial Visibility

A batch may not become visible to operational reads until:

- all required slices are written
- reconciliation passes
- active pointer is atomically updated

### 5.6 Idempotent Mirror Writes

Re-sending the same `mirror_batch_id` must not create duplicate logical facts.

Writes must be idempotent by:

- `mirror_batch_id`
- target table
- slice key
- natural key within the domain

### 5.7 Reproducible Provenance

Every active mirrored fact must be attributable to:

- source validation batch
- source snapshot
- schema bundle version
- validator bundle version
- mirror bundle version
- payload contract version

### 5.8 Activation Requires Reconciliation

Only a `reconciled` batch may become `active`.

### 5.9 Supersession Is Explicit

When a new batch becomes active, the prior active batch must transition to `superseded`.

### 5.10 No Silent Repair

Any post-write mutation to mirrored data must occur through:

- a new mirror batch
- or an explicit repair/quarantine workflow

Never through untracked direct edits.

## 6. Allowed Transitions

### 6.1 Mirror Batch

Allowed transitions:

- `prepared -> mirroring`
- `mirroring -> mirrored`
- `mirrored -> reconciling`
- `reconciling -> reconciled`
- `reconciled -> active`
- `active -> superseded`
- `prepared -> failed`
- `mirroring -> failed`
- `mirrored -> failed`
- `reconciling -> failed`
- `mirrored -> quarantined`
- `reconciling -> quarantined`
- `quarantined -> failed`
- `quarantined -> reconciled`

Disallowed transitions:

- `prepared -> active`
- `mirroring -> active`
- `mirrored -> active`
- `failed -> active`
- `superseded -> active`

### 6.2 Mirror Batch Slices

Allowed transitions:

- `pending -> writing`
- `writing -> written`
- `written -> reconciled`
- `pending -> failed`
- `writing -> failed`
- `written -> failed`
- `written -> quarantined`
- `quarantined -> reconciled`
- `quarantined -> failed`

## 7. Activation Model

### 7.1 Domain-Level Activation

Activation must occur independently per domain.

Example:

- `psi` may activate a new batch even if `evs` has no new successful batch
- `gtmetrix` may remain on an older active batch while `ga4` advances

### 7.2 Atomic Activation

Activation must be atomic for a single domain:

1. validate target batch is `reconciled`
2. set previous active batch to `superseded`
3. update active pointer to new batch
4. mark new batch `active`
5. write activation event

If any step fails, the prior active pointer must remain unchanged.

### 7.3 Cross-Domain Consistency

Cross-domain consistency is not enforced at activation time.

It is enforced at runtime interpretation time through `Execution Snapshot` binding.

This allows independent domain advancement without forcing synchronized domain activation.

## 8. Failure Modes

### 8.1 Intake Failure

Examples:

- malformed manifest
- invalid contract version
- failed authentication
- missing required batch metadata

Required behavior:

- reject batch
- record failure
- do not write payload
- do not create active visibility

### 8.2 Write Failure

Examples:

- partial table write
- D1 connectivity failure
- constraint violation

Required behavior:

- mark affected slices `failed`
- mark batch `failed`
- preserve prior active pointer
- allow resumable rerun via same or replacement batch

### 8.3 Reconciliation Failure

Examples:

- row count mismatch
- checksum mismatch
- missing required slice

Required behavior:

- mark batch `failed` or `quarantined`
- preserve prior active pointer
- emit integrity event for operational visibility

### 8.4 Activation Failure

Examples:

- pointer update failure
- concurrent activation race

Required behavior:

- fail activation atomically
- preserve prior active state
- emit activation failure event

### 8.5 Contract Mismatch

Examples:

- unsupported schema bundle
- unsupported payload contract
- mirror logic/version mismatch

Required behavior:

- reject mirror intake
- record failure metadata
- do not write batch

### 8.6 Quarantine Case

Used when:

- data may be materially useful for investigation
- but cannot be trusted for operational visibility

Required behavior:

- batch remains non-active
- batch is available only to administrative/debug workflows

## 9. Audit Requirements

The system must record auditable evidence for:

- every intake request
- every batch created
- every slice write
- every reconciliation result
- every failure
- every activation
- every supersession

Audit records must include:

- actor or service identity
- timestamp
- domain
- batch id
- version bundle references
- failure codes where applicable

### 9.1 Required Audit Artifacts

- intake manifest
- reconciliation summary
- activation event record
- row count and checksum evidence
- failure diagnostics

### 9.2 Audit Retention Principle

Superseded or failed batches must remain auditable even after they are no longer operationally visible.

## 10. Read Model Requirements

Operational reads must be served through:

- active-batch filtered SQL views
- or API queries that resolve through `active_batch_pointers`

Direct reads against base mirrored fact tables are prohibited for:

- agents
- product surfaces
- standard reporting paths

### 10.1 Required Active Views

For each mirrored fact domain, an active view or equivalent API read model must exist.

Example pattern:

- `active_ga4_daily_metrics`
- `active_psi_metrics`
- `active_gtmetrix_metrics`
- `active_evs_findings`

## 11. Mirror Intake Boundary

The mirror service must be mediated through Cloudflare.

Near-term model:

- local Mac prepares validated mirror payload
- Cloudflare intake endpoint receives it
- Cloudflare validates manifest, versions, and authorization
- Cloudflare writes to D1 and manages activation state

The local Mac must not be treated as a direct uncontrolled writer to operational D1 state.

## 12. Implementation Notes

This contract does not mandate exact physical table names beyond the logical entities above, but implementation must preserve:

- domain-level activation
- active pointer gating
- strict provenance
- idempotent writes
- atomic activation

## 13. Open Questions

Questions deferred to later specs:

- whether signature verification is required on mirror manifests
- whether per-slice payloads are embedded or referenced
- exact retry semantics for failed mirror batches
- retention policy for superseded mirrored fact rows

## 14. Summary

This contract establishes that:

- local validation is the integrity root
- D1 is a validated mirror, not an ingestion surface
- activation happens per domain
- only reconciled data can become active
- active visibility is controlled by domain pointers
- cross-domain consistency is handled later through execution snapshots
- all mirrored truth is attributable, auditable, and safe for agent consumption only after activation
