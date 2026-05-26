# Expert Reads Runtime Audit And Hardening

Date: 05/10/2026

## Scope

This audit covered the Expert Reads / Consulting Bench Runtime Controls layer only. No Expert Reads UI, real GPT provider, autonomous Bench behavior, Fleet Scribe publication tooling, PIB renderer, or reporting system was added.

Reviewed implementation areas:

- `/Users/mark/Property_Analytics/apps/api/src/platform/expert-reads`
- `/Users/mark/Property_Analytics/apps/api/src/routes/expert-reads.ts`
- `/Users/mark/Property_Analytics/apps/api/migrations/0049_create_expert_reads.sql`
- `/Users/mark/Property_Analytics/infra/migrations/0036_create_expert_reads.sql`
- `/Users/mark/Property_Analytics/apps/api/test/platform/expert-reads-runtime.test.ts`
- `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_ARCHITECTURE_2026-05-09.md`

## Audit Findings

### Critical

No unresolved critical risks remain in the hardened path. Expert Reads still cannot publish, mutate Data Pond, promote memory, bypass Fleet Scribe, or bypass Quartermaster.

### High

Finding: evidence packet lineage was validated through Captain Runtime validation, but Expert Reads did not independently replay the evidence hash before lane generation.

Resolution: added Expert Reads evidence compatibility validation. The runtime now replays the evidence hash, checks property lineage, requires canonical property evidence, and logs compatibility pass/warn/fail events before generation.

Finding: duplicate/retry handling could create repeated Expert Reads for the same request context.

Resolution: added deterministic `request_hash` with a unique index and replay-block audit event.

Finding: database constraints allowed a `publishable` state even though Expert Reads are not publication authorities.

Resolution: tightened Expert Read, finding, and recommendation publishability constraints to `internal_only`, `needs_verification`, and `blocked`.

### Medium

Finding: source Captain Runtime lineage was optional and not asserted when supplied.

Resolution: added source runtime and interaction lineage checks. Supplied source ids must exist and match the Expert Read property.

Finding: audit events did not carry hash lineage columns.

Resolution: added `evidence_hash`, `directive_hash`, and `read_hash` to Expert Read audit events and populated them on compatibility, payload, duplicate, validation, and finalization events.

Finding: structured output validation accepted several weak states.

Resolution: validation now rejects self-authorized publishable output, invalid freshness states, oversized summary/recommendation text, missing evidence references, missing proof metrics for nonblocked recommendations, blocked reads without blocked publishability, and blocked recommendations without a blocked reason.

### Low

Finding: lane-specific evidence gaps were initially treated as hard compatibility failures.

Resolution: adjusted them to governance warnings so the lane can still return a blocked/nonpublishable Expert Read with a clear reason. Hash, property, canonical evidence, and replay failures remain hard failures.

## Migration Review

`0049_create_expert_reads.sql` is the app/API migration and `0036_create_expert_reads.sql` is the infra mirror. Both are needed because this repo maintains app and infra migration tracks.

Hardening added:

- foreign keys from Expert Read requests to Captain Runtime sessions, interactions, and evidence packets
- `request_hash` plus unique index for replay safety
- audit hash columns and correlation index
- DB-level restriction against `publishable` Expert Read states
- immutable/no-delete triggers for requests, reads, findings, recommendations, and audit events

Rollback remains an operational migration process; the runtime itself does not delete historical Expert Read rows.

## Runtime Integrity

Expert Reads now require:

- active lane directive resolution through the Directive Resolver
- immutable Captain evidence packet input
- replayable evidence hash match
- property lineage match
- canonical property evidence
- request replay protection
- structured payload validation
- structured output validation
- immutable finalized persistence

## Security And Governance

Routes remain role-gated:

- `POST /v1/expert-reads` requires admin/editor.
- editor can use monitoring, lightweight, and standard modes only.
- admin is required for escalated, executive, and simulation modes.
- viewer is denied mutation access.

Property-scoped authorization is not independently implemented in this layer because the repo does not yet expose a single per-property authorization primitive for Expert Reads. The current route guard is role-based and the runtime enforces property/evidence lineage. This is the remaining integration item before broad tenant-style use.

## Simulation / Output Contract

No real GPT provider was added. The deterministic constrained adapter remains in place. Malformed output cannot persist as finalized Expert Reads.

## Tests Added

Added coverage for:

- tampered evidence hash lineage
- mismatched Captain Runtime lineage
- duplicate request replay protection
- DB prevention of publishable Expert Read states
- editor denial for executive runtime mode

Existing coverage remained for:

- Directive Resolver use
- source/evidence mismatch rejection
- lane-specific blocking
- immutability
- route authorization
- redacted API payloads

## Confirmation

- Expert Reads remain governed specialist contributions.
- Expert lanes are not autonomous agents.
- Fleet Scribe remains publication authority.
- Quartermaster remains blocking.
- Directive Resolver governs lane behavior.
- Evidence packets govern reasoning scope.
- Malformed Expert Reads fail safely.
- Finalized Expert Reads remain immutable.
- No PIB/reporting coupling was introduced.
- No parallel reporting system was created.
