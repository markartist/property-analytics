# Property Access Control Audit And Hardening

Date: 05/10/2026

## Scope

This audit reviewed the canonical property-scoped authorization foundation used by:

- Captain Runtime
- Captain’s Office
- Expert Reads
- runtime history
- evidence lineage
- memory candidate access
- future Fleet/Scribe property workflows

PropertyAccessControl remains an entry gate. It does not replace Directive Resolver governance, Quartermaster source integrity, Fleet Scribe publication authority, or Data Pond source authority.

## Implementation Review

### `/apps/api/src/platform/access/property-access-control.ts`

Purpose:

- Central authorization primitive for property, region, portfolio, capability, runtime-mode, and Expert Read lane access.

Audit result:

- Correct architectural placement under `platform/access`.
- Additive to existing auth and governance systems.
- Route integrations call the shared primitive instead of local property checks.
- Hardening added for unknown actions, unsupported runtime modes, unsupported Expert Read lanes, explicit deny grants, deterministic grant precedence, duplicate active grant prevention, and stale/revoked grant rejection.

### Migrations

Files:

- `/Users/mark/Property_Analytics/apps/api/migrations/0050_create_property_access_control.sql`
- `/Users/mark/Property_Analytics/infra/migrations/0037_create_property_access_control.sql`

Audit result:

- Idempotent table/index/trigger creation.
- Grant table now includes `grant_effect` and `grant_fingerprint`.
- Scope consistency is enforced with table checks.
- Duplicate active grants are blocked with a unique active-grant fingerprint index.
- Audit events are immutable and cannot be deleted.
- No unsafe cascades were introduced.

### Route Integrations

Files:

- `/Users/mark/Property_Analytics/apps/api/src/routes/captain-runtime.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/expert-reads.ts`

Audit result:

- Captain Runtime interaction requests require `interact_captain`.
- Captain’s Office state requires `operate_captain_office`.
- Runtime history requires `view_runtime_history`.
- Evidence lineage requires `view_evidence_lineage`.
- Memory candidates require `view_memory_candidates`.
- Expert Read requests require `request_expert_read`.
- Expert Read lists and detail reads require `view_expert_read`.
- Expert Read detail denials are masked as not found to reduce property/read inference while still writing audit denials.

## Fail-Closed Findings

Verified denial for:

- missing actor
- malformed actor
- missing property id
- unresolved property id
- missing region scope
- invalid action
- invalid runtime mode
- invalid Expert Read lane
- unsupported runtime mode
- unsupported Expert Read lane
- missing capability
- missing property grant
- revoked grant
- expired grant

## Grant Precedence Model

Deterministic order:

1. Validate actor/action/runtime/lane/scope.
2. Remove inactive and expired grants.
3. Match grants by scope, capability, runtime mode, and lane.
4. Sort by specificity:
   - property
   - region
   - portfolio
5. Within the same specificity, `deny` wins over `allow`.

Operational effects:

- property allow overrides broader region deny
- region deny overrides portfolio allow
- same-scope deny overrides same-scope allow
- runtime-mode denial takes precedence over lane allowance

## Property Leakage Review

Risk reviewed:

- Unauthorized users probing Expert Read ids could infer whether a record exists if existing unauthorized records returned 403 while nonexistent records returned 404.

Hardening:

- Expert Read detail access now masks unauthorized existing records as `EXPERT_READ_NOT_FOUND`.
- The denial is still audited by PropertyAccessControl.

Route list endpoints already require property authorization before returning property-scoped lists.

## Auditability Review

Audit events capture:

- actor id
- actor role
- property id
- community id
- region
- action
- scope
- runtime mode
- lane
- decision
- reason
- high-risk flag
- correlation id
- timestamp

Hardening:

- audit event rows are immutable
- audit event rows cannot be deleted
- masked denials are still audited
- correlation ids are preserved when supplied

## Risk Matrix

### Critical

- None remaining after hardening.

### High

- Production grant provisioning must be operationalized before non-admin users can use property-scoped surfaces broadly.

### Medium

- The grant-management surface is intentionally deferred; manual/seeded grants are the current path.
- If migration `0050` had already been deployed before this hardening pass, a follow-up migration would be required. In this workstream, the migration is still part of the active implementation set.

### Low

- Grant fingerprint is stored as a canonical JSON string rather than a shortened hash to avoid runtime dependency on Node-only crypto in Worker contexts.

## Tests Added / Expanded

Test file:

- `/Users/mark/Property_Analytics/apps/api/test/platform/property-access-control.test.ts`

Coverage includes:

- property allow
- property deny
- region allow
- portfolio allow
- admin allow
- malformed actor fail-closed
- missing property fail-closed
- invalid action fail-closed
- invalid runtime mode fail-closed
- unauthorized runtime mode
- invalid lane fail-closed
- unauthorized expert lane
- unauthorized evidence access
- unauthorized history access
- Captain Runtime interaction denial
- Captain’s Office read denial
- Expert Read request denial
- grant precedence
- duplicate active grant prevention
- revoked grant rejection
- expired grant rejection
- Expert Read detail leakage masking
- audit event immutability
- correlation id preservation

## Boundary Confirmation

This hardening pass did not:

- create a parallel auth system
- weaken fail-closed behavior
- rely on frontend checks
- bypass Captain Runtime governance
- bypass Directive Resolver
- bypass Fleet Scribe authority
- bypass Quartermaster
- add GPT or AI behavior
- add report tooling
- add PIB/reporting coupling
- create grant-management UI

PropertyAccessControl remains additive to Data Pond, Captain Runtime, Captain’s Office, Directive Control Center, Expert Reads, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.
