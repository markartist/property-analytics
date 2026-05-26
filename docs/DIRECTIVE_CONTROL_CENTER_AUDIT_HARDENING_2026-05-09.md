# Directive Control Center Audit And Hardening

Date: 05/09/2026

## Scope

This audit reviewed the Directive Control Center as governed policy infrastructure for Captain’s Office, Regional Desk / Commodore, Fleet Desk, Consulting Bench, Fleet Scribe Office, Quartermaster, and the Expert Bench lanes. The review was performed as a hardening pass only. It did not create a parallel reporting system, change PIB behavior, or begin Captain’s Office work.

## Repository Findings

The feature is correctly placed in the existing platform shape:

- Domain services live in `apps/api/src/platform/directives`.
- HTTP access is routed through `apps/api/src/routes/directives.ts`.
- D1 persistence lives in `apps/api/migrations/0047_create_directive_control_center.sql`.
- The infra migration mirror lives in `infra/migrations/0034_create_directive_control_center.sql`.
- The admin surface lives in `apps/web/src/app/admin/directives/page.tsx`.
- Capability registration uses the shared offering-permission model in `apps/api/src/lib/permissions.ts` and `apps/web/src/lib/permissions.ts`.
- Documentation lives in `docs/`.
- Tests live in `apps/api/test/platform/directive-control-center.test.ts`.

This is additive to Data Pond, Captain runtime, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.

## File Review Summary

### API Domain

- `apps/api/src/platform/directives/types.ts`
  - Purpose: typed contract for directive profiles, versions, validation, resolution, simulation, and workflow.
  - Correctness: supports structured directive policy fields, report-family applicability, runtime modes, and audit metadata.
  - Hardening: added request and correlation identifiers, version hash, and runtime snapshot hash fields.
  - Risk: future consumers must avoid bypassing these typed resolver outputs with local prompt logic.

- `apps/api/src/platform/directives/hashing.ts`
  - Purpose: canonical JSON and SHA-256 helpers for directive and runtime snapshot integrity.
  - Correctness: deterministic sorting avoids hash drift from object key order.
  - Risk: cryptographic integrity is local to persisted content; it is not a signing system.

- `apps/api/src/platform/directives/repository.ts`
  - Purpose: table bootstrap, row mapping, seed upsert, draft creation, and audit persistence.
  - Correctness: preserves profiles, versions, validation rows, simulation rows, runtime snapshots, approval events, and audit events.
  - Hardening: added directive hashes, snapshot hashes, one-open-draft and one-submitted-version indexes, immutable runtime snapshot triggers, immutable audit event triggers, and post-draft content immutability.
  - Risk: production must apply migrations before relying on the bootstrapped schema to avoid environment drift.

- `apps/api/src/platform/directives/validation.ts`
  - Purpose: machine-readable governance validation with warnings, blockers, and recommended fixes.
  - Correctness: validates required fields, sources, guardrails, permissions, freshness, confidence thresholds, report families, role id stability, and duplicate active versions.
  - Hardening: added explicit blocker coverage for conflicting publication permissions, external communication ambiguity, invalid freshness thresholds, invalid confidence ranges, invalid report-family ids, inactive runtime-active states, stale effective dates, and Quartermaster/Fleet Scribe control weakening.
  - Risk: validation is strict by design; future new report families must be registered explicitly.

- `apps/api/src/platform/directives/resolver.ts`
  - Purpose: runtime entry point for Captain, Commodore, Fleet, Bench, and Scribe processes.
  - Correctness: resolves only the active approved directive for normal runtime and writes runtime snapshots.
  - Hardening: blocks draft leakage outside simulation, blocks inactive profiles, enforces report-family applicability, hashes snapshots, and logs runtime use with request/correlation context.
  - Risk: downstream systems must call this resolver before policy-sensitive behavior. The resolver cannot protect consumers that do not use it.

- `apps/api/src/platform/directives/workflow.ts`
  - Purpose: governed state transitions for draft, submit, approve, activate, reject, retire, and rollback.
  - Correctness: change reasons and actor context are required for material transitions.
  - Hardening: approval requires submitted state, activation is batched and rechecked, rollback rejects unsafe targets, retirement requires a reason, and concurrent activation cannot produce duplicate active versions.
  - Risk: Cloudflare D1 transaction semantics are limited compared with a full RDBMS transaction manager; batching plus unique indexes are the current deterministic guard.

- `apps/api/src/platform/directives/simulation.ts`
  - Purpose: isolated pre-activation test harness.
  - Correctness: creates simulation results without activating or mutating runtime directives.
  - Hardening: simulation requires `runtime_mode = simulation`; fixtures now cover unauthorized external messaging, Navigator evidence gaps, Quartermaster conflicts, Fleet Scribe stale approval, rollback regression, and runtime-mode mismatch.
  - Risk: simulation quality depends on fixture depth and should grow with new directive families.

- `apps/api/src/platform/directives/seed.ts`
  - Purpose: seed current role directives from the governing Fleet Scribe and Bench standard.
  - Correctness: covers the current office and bench lanes as structured policy records.
  - Risk: seed data must stay synchronized with the governing document when directive policy changes.

### API Routes And Permissions

- `apps/api/src/routes/directives.ts`
  - Purpose: exposes list, detail, draft, submit, approve, activate, reject, retire, rollback, resolve, validate, and simulate operations.
  - Correctness: route operations call domain services rather than implementing policy inline.
  - Hardening: routes now use a dedicated `directiveControlCenter` permission surface instead of borrowing a broader offering. Simulation route only accepts simulation mode.
  - Risk: current authorization is role/offering based; finer-grained approver groups can be added later without changing the domain model.

- `apps/api/src/lib/permissions.ts`
  - Purpose: shared API offering authorization.
  - Correctness: adds `directiveControlCenter` as admin-only for view, draft, approve, administer, and rollback.
  - Risk: none found for current scope.

### Persistence

- `apps/api/migrations/0047_create_directive_control_center.sql`
  - Purpose: app D1 migration for directive control tables.
  - Correctness: creates profiles, versions, change requests, approval events, runtime snapshots, validation results, simulation results, and audit events.
  - Hardening: includes directive hashes, snapshot hashes, correlation/request ids, unique active/draft/submitted indexes, and immutability triggers.

- `infra/migrations/0034_create_directive_control_center.sql`
  - Purpose: infrastructure migration mirror for the same capability.
  - Correctness: both migration files are needed because this repo keeps app D1 migrations and infra mirrors in separate sequences.
  - Risk: migration numbering differs by sequence. This is intentional, but both files must stay mirrored.

### Web UI

- `apps/web/src/app/admin/directives/page.tsx`
  - Purpose: first admin surface for structured directive viewing, search, status visibility, validation visibility, audit/simulation links, and version context.
  - Correctness: no giant freeform prompt editor was introduced.
  - Hardening: access now uses `directiveControlCenter` permission.
  - Deferred: full structured edit/approval/rollback controls remain an API-backed UI contract item, not a hardening requirement.

- `apps/web/src/lib/permissions.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/components/shared/sidebar.tsx`
  - Purpose: expose Directive Control Center as a governed admin-only surface in navigation and landing affordances.
  - Correctness: no runtime/reporting coupling introduced.

### Tests And Scripts

- `apps/api/test/platform/directive-control-center.test.ts`
  - Purpose: enterprise safety coverage for validation, resolver, workflow, migrations, simulation, authorization, immutability, rollback, duplicate activation, and report-family applicability.
  - Correctness: tests now cover both happy path and governance failure path.

- `scripts/seed_directive_control_center.sh`
  - Purpose: operator seeding wrapper.
  - Correctness: additive; no reporting or PIB behavior is invoked.

## Migration Audit

Findings:

- `0047_create_directive_control_center.sql` and `0034_create_directive_control_center.sql` are both needed. They are not accidental duplicates; they belong to different migration sequences.
- Both migrations are idempotent through `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE TRIGGER IF NOT EXISTS`.
- Runtime snapshots are immutable through update/delete blocking triggers.
- Audit events are immutable through update/delete blocking triggers.
- Directive content cannot be changed after leaving draft state.
- At most one active, one draft, and one submitted version per profile are enforced by unique partial indexes.
- Approval/version uniqueness is enforced at the DB level for runtime-eligible active versions.
- Snapshot integrity is strengthened with a persisted `snapshot_hash`.
- Directive version integrity is strengthened with a persisted `directive_hash`.

Unresolved persistence concern:

- The repo uses additive forward migrations; no down migration/rollback SQL exists for this migration family. Operational rollback is handled by directive version rollback, not schema rollback.

## Versioning And Runtime Integrity

Hardening completed:

- Active versions cannot silently mutate because content fields are blocked after draft.
- Runtime snapshots cannot be updated or deleted.
- Audit events cannot be updated or deleted.
- Draft directives cannot resolve in normal runtime.
- Runtime resolver persists the exact active directive snapshot and validation result used for the request.
- Snapshot hashes support historical reconstruction and tamper detection.
- Rollback is deterministic and cannot target draft, submitted, rejected, or already-active versions.
- Activation is batched and guarded by DB uniqueness.

## Security And Governance

Hardening completed:

- Directive routes now use a dedicated admin-only `directiveControlCenter` offering.
- Mutation paths require authenticated admin authorization.
- Runtime resolve is not allowed to return drafts outside simulation.
- Simulation mode is explicit and isolated.
- External communication settings must be explicit and approval-bound.
- Fleet Scribe executive publication controls cannot be bypassed.
- Quartermaster stale-source controls remain blocking.

Assumption:

- This uses the existing platform role/offering authorization model. It does not yet implement named approver groups or two-person approval.

## Validation Engine

Additional validation now covers:

- Empty guardrails and required lists.
- Blank and duplicate list entries.
- Conflicting publication/external communication permissions.
- Invalid office types, statuses, report families, and role ids.
- Invalid runtime-active/inactive combinations.
- Stale/future effective dates and impossible lifecycle dates.
- Invalid freshness thresholds.
- Invalid confidence ranges and inverted publishability thresholds.
- Fleet Scribe control weakening.
- Quartermaster source gate weakening.
- Duplicate active role versions and duplicate role ownership.

## Simulation Harness

Simulation now verifies:

- Navigator content recommendation with weak local proof.
- Navigator recommendation without evidence.
- Quartermaster stale/conflicting source condition.
- Quartermaster source conflict.
- Fleet Scribe publication attempt with template variance or missing approval.
- Fleet Scribe publish attempt with stale approval.
- Unauthorized external communication attempt.
- Directive rollback regression.
- Runtime mode mismatch.

Simulation cannot activate directives or mutate active runtime state.

## Observability And Auditability

Audit hardening added:

- Request IDs and correlation IDs on audit events.
- Runtime snapshot hashes.
- Directive version hashes.
- Validation failure events.
- Runtime use events.
- Simulation run events.
- Activation/rollback/change lineage through approval events and audit events.

Remaining observability improvement:

- A dedicated admin audit-history view can be expanded from the stored audit events. The data is present; the UI is not yet full-fidelity.

## UI Contract Review

Current UI is safe for hardening state:

- Structured list/search/view exists.
- Validation state is visible.
- Version and status state are visible.
- The surface is admin-only.
- There is no giant freeform prompt editor.

Deferred UI items:

- Structured edit form.
- Active vs draft comparison.
- Approval and rejection buttons.
- Rollback action.
- Runtime snapshot drill-in.
- Audit event timeline.

These are already specified in the UI contract and should be built as a separate implementation chunk.

## Documentation Review

Documentation now consistently states:

- Directives are policy data, not loose prompts.
- Runtime behavior must resolve through approved directive versions.
- Draft directives are simulation-only.
- Runtime snapshots are authoritative for historical reconstruction.
- Fleet Scribe publication controls cannot be bypassed.
- Quartermaster source-integrity gates are blocking controls.
- Rollback is version rollback, not schema rollback.
- The system is additive and does not replace Data Pond, Captain runtime, Watchlist, Spotlight, PIB, Fleet Scribe, or approved artifact generation.

## Risk Matrix

### Critical

- None remaining after hardening.

### High

- Downstream runtime consumers could bypass the resolver if future work calls directive seed data directly. Mitigation: route all Captain, Bench, Fleet, and Scribe behavior through `resolveDirectiveForRuntime`.

### Medium

- Full UI workflow controls are specified but not yet implemented.
- Authorization is admin/offering based, not named approver-group based.
- Migration rollback is not provided as down SQL due to repo migration pattern.

### Low

- Simulation fixtures should expand as new directive families and report families mature.
- Hashes provide tamper evidence, not external cryptographic signing.

## Tests

Expanded coverage includes:

- Resolver active-version behavior.
- Runtime draft isolation.
- Report-family applicability.
- Runtime snapshot immutability.
- Migration hardening assertions.
- Workflow transitions.
- Unsafe rollback rejection.
- Duplicate open draft prevention.
- Concurrent activation prevention.
- Authorization blocking for unauthenticated and non-admin mutation.
- Validation edge cases.
- Simulation isolation and fixture outcomes.

Run:

```bash
cd /Users/mark/Property_Analytics/apps/api
npm run typecheck
node --test --import tsx test/platform/directive-control-center.test.ts

cd /Users/mark/Property_Analytics/apps/web
npm run build
```

## Final Confirmation

- Runtime integrity is preserved.
- Draft isolation is enforced.
- Versioning is immutable after draft.
- Runtime snapshots are immutable.
- Auditability is durable.
- No parallel reporting system was created.
- No locked PIB files were changed.
- Fleet Scribe authority remains intact.
- Quartermaster source integrity remains blocking.
- Directive Control Center remains additive to Data Pond, Captain runtime, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.
