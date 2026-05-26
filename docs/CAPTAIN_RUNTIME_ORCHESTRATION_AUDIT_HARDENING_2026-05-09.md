# Captain Runtime Orchestration Audit And Hardening

Date: 05/09/2026

## Executive Finding

The Captain Runtime Orchestration foundation is correctly placed as an additive API/domain layer under `apps/api/src/platform/captain-runtime` with route access through `apps/api/src/routes/captain-runtime.ts`. It does not create a parallel reporting system, does not touch locked PIB generators, and keeps Fleet Scribe and Quartermaster as governance boundaries.

The hardening pass found several production-readiness gaps in the first foundation: incomplete migration parity, insufficient historical-row immutability, route-level runtime-mode escalation risk, replay/idempotency gaps, permissive structured-response validation, non-replayable evidence hashes, and limited side-effect validation. Those have been corrected in the runtime layer, migrations, tests, and documentation.

## File-Level Audit Summary

| File | Purpose | Audit Result | Hardening Action |
| --- | --- | --- | --- |
| `apps/api/src/platform/captain-runtime/types.ts` | Runtime domain contracts for sessions, interactions, evidence, reasoning, memory candidates, routing, and audit events. | Correct domain placement. Memory candidate lifecycle needed stronger lineage and expiration fields. | Added evidence hash lineage, expiration, conflict state, and idempotency input support. |
| `apps/api/src/platform/captain-runtime/classifier.ts` | Deterministic intake intent classifier. | Correct as first-pass deterministic classifier; intentionally not GPT-driven. | No change. |
| `apps/api/src/platform/captain-runtime/context.ts` | Property-scoped context assembler. | Correct placement; avoids broad prompt flooding by limiting rows. | No code change in this pass; broader Data Pond fact packs remain deferred. |
| `apps/api/src/platform/captain-runtime/evidence.ts` | Governed evidence packet builder. | Evidence lineage existed, but hash included volatile generation details. | Made hashes replayable by excluding volatile ids/timestamps; added packet validation. |
| `apps/api/src/platform/captain-runtime/governance.ts` | Runtime authority and publishability enforcement. | Correctly blocks canonical mutation and labels human input as claims. | No direct change; new tests exercise governance boundaries through response and side-effect validation. |
| `apps/api/src/platform/captain-runtime/payload.ts` | Structured GPT runtime payload builder. | Correctly dynamic, not a giant static prompt. Needed validation controls. | Added payload validation, size cap, allowed/blocked conflict detection, and duplicate-rule warnings. |
| `apps/api/src/platform/captain-runtime/response.ts` | Deterministic reasoning adapter and response validation. | Reasoning is safely stubbed, but response validation was too permissive. | Added strict structured-output key validation, size limits, array checks, and side-effect validation. |
| `apps/api/src/platform/captain-runtime/repository.ts` | Runtime persistence and audit table bootstrap. | Correct local fallback pattern. Needed immutability and idempotency protections. | Added immutable/no-delete triggers, duplicate idempotency index, memory duplicate signature, and memory lineage fields. |
| `apps/api/src/platform/captain-runtime/orchestrator.ts` | End-to-end runtime intake pipeline. | Correctly resolves directives before evidence/reasoning. Needed explicit resolver assertions and fail-safe validation gates. | Added directive snapshot assertions, evidence validation, payload validation, side-effect validation, and audit events on failures. |
| `apps/api/src/routes/captain-runtime.ts` | API route for runtime interactions. | Correct route placement and auth baseline. Editors could request executive/simulation modes. | Added runtime-mode authorization and idempotency key input. |
| `apps/api/migrations/0048_create_captain_runtime_orchestration.sql` | App D1 migration. | Correct numbering after Directive Control Center 0047. Needed more immutable-history triggers. | Added session/interaction immutable triggers and idempotency fields/index. |
| `infra/migrations/0035_create_captain_runtime_orchestration.sql` | Infra migration mirror. | Correct pairing with app migration, but lagged behind app schema. | Brought into parity with app migration fields, indexes, and triggers. |
| `apps/api/test/platform/captain-runtime-orchestration.test.ts` | Runtime integration and safety tests. | Happy path existed. Needed adversarial and governance tests. | Expanded to 12 tests covering immutability, idempotency, route authorization, payload validation, evidence replayability, and malformed responses. |
| `docs/CAPTAIN_RUNTIME_ORCHESTRATION_ARCHITECTURE_2026-05-09.md` | Runtime architecture record. | Correct baseline documentation. Needed hardening/failure-mode details. | Added sequence diagram, memory lifecycle diagram, replayability, failure behavior, and mode permission notes. |

## Migration / Persistence Audit

The app migration is `0048_create_captain_runtime_orchestration.sql`, immediately after Directive Control Center migration `0047`. The infra migration is `0035_create_captain_runtime_orchestration.sql`, paired with infra Directive Control Center migration `0034`.

Findings and fixes:

- Both migrations are needed because the repo maintains app and infra migration tracks.
- App migration order is correct.
- Infra migration order is correct.
- Both migrations now include `correlation_id` and `idempotency_key` on `captain_runtime_sessions`.
- Both migrations now include a unique idempotency index for retry protection.
- Both migrations now include memory candidate expiration, conflict state, source evidence hash, and duplicate signature fields.
- Both migrations now protect sessions, interactions, evidence packets, reasoning requests, reasoning responses, and audit events from historical mutation where lifecycle updates are not expected.
- No cascading delete can erase runtime history through normal parent deletion because parent/child runtime lineage tables are protected by no-delete triggers.

Deferred: formal down migrations are not part of the current repo pattern.

## Directive Resolver Enforcement

Every runtime interaction calls `resolveRuntimeDirective` before session persistence, evidence generation, payload construction, or reasoning. The orchestrator now asserts that:

- the resolved role matches the classified intent role;
- the directive profile is `active`;
- the resolver produced a runtime snapshot id;
- the resolver produced a runtime snapshot hash.

This prevents silent fallback to a generic policy and prevents draft/non-snapshot directives from entering runtime.

## Evidence Packet Hardening

Evidence packets are immutable and now replayable. The hash is based on property id, directive snapshot id, included sources, freshness state, and stable evidence content. Volatile evidence row ids and generation timestamps are excluded.

Validation now blocks packets that lack:

- property id;
- directive snapshot id;
- evidence hash;
- canonical property evidence;
- human input captured as a claim-class evidence item.

## Governance Engine Audit

Governance remains deterministic and directive-resolved. The runtime continues to block:

- canonical fact mutation by GPT;
- direct database writes by GPT;
- unapproved external messaging;
- executive publication without Fleet Scribe;
- publishable claims without verification.

Stale/conflicting evidence remains capable of blocking publishability depending on the active directive freshness policy. Human input remains claim-level.

## GPT Payload Builder Audit

The payload builder remains structured and dynamic. It does not store a giant prompt blob as policy. It now validates:

- directive snapshot id/hash;
- evidence packet hash;
- output permission conflicts;
- runtime payload size;
- duplicate publishability instructions;
- excessive memory rows.

## Structured Response Validation Audit

Malformed reasoning fails safely. The runtime now rejects:

- prose-only responses;
- missing required structured sections;
- extra hallucinated structured fields;
- invalid publishability states;
- confidence values outside 0 to 1;
- oversized conversational response or reasoning summary;
- non-array memory, routing, escalation, follow-up, or conflict sections.

Side effects are separately validated before memory/routing persistence. New memory candidates must begin as candidates, require verification, contain the current evidence hash, and carry a valid expiration. Routing decisions must use an allowed lane and include a reason.

## Memory Routing Audit

Candidate memory cannot mutate canonical truth. It now carries:

- source interaction id;
- evidence hash lineage;
- expiration;
- conflict state;
- duplicate signature;
- verification-required status;
- candidate promotion state.

Promotion into governed memory remains deferred to a separate governed workflow.

## Authorization / Security Audit

The route requires authentication and either admin or editor role. Additional mode safety now applies:

- admin may use monitoring, lightweight, standard, escalated, executive, and simulation;
- editor may use monitoring, lightweight, and standard only;
- viewers remain blocked from mutation.

Deferred: named capability permissions for escalated/executive/simulation modes should replace broad admin role checks when the security offering matrix is extended.

## Concurrency / Replay / Failure Audit

Idempotency support now prevents duplicate sessions for repeated submissions with the same user and idempotency key. Validation gates fail before downstream side effects:

- evidence validation fails before evidence insert or reasoning;
- payload validation fails before reasoning request insert;
- response validation fails before memory/routing;
- side-effect validation fails before memory/routing.

## Observability / Auditability Audit

The runtime logs:

- interaction received;
- evidence validation failure;
- payload validation failure;
- GPT payload generated;
- response validation failure;
- side-effect validation failure;
- reasoning response accepted.

Audit rows include actor, interaction id, request id, correlation id, evidence hash, directive hash, and response hash where applicable. Audit events are immutable.

## Risk Matrix

### Critical

None remaining after hardening.

### High

- Real GPT provider integration is not yet implemented. Any future provider must use the structured payload and response validator without bypassing side-effect gates.
- Named capability permissions are still deferred for escalated/executive/simulation runtime modes.

### Medium

- Context assembly currently uses a narrow first-pass Data Pond fact set. Broader source-family context should be added through governed evidence classes, not prompt dumping.
- Candidate memory promotion workflow is intentionally absent and must be implemented as a separate governed workflow.

### Low

- Formal down migrations are not present because the repo migration pattern is additive.
- Runtime session `ended_at` is immutable in this foundation because no lifecycle close operation exists yet.

## Tests Added / Expanded

The runtime test file now covers:

- full runtime lineage;
- human input as candidate memory;
- evidence and audit immutability;
- session, interaction, request, and response immutability;
- unauthenticated and viewer route blocks;
- editor executive-mode block;
- duplicate idempotency key rejection;
- malformed structured response rejection;
- hallucinated structured field rejection;
- invalid side-effect rejection;
- replayable evidence packet hashes;
- incomplete evidence packet validation;
- conflicting allowed/blocked output validation;
- migration trigger coverage.

Run:

```bash
cd /Users/mark/Property_Analytics/apps/api
npm run typecheck
node --test --import tsx test/platform/captain-runtime-orchestration.test.ts
```

## Boundary Confirmation

- Directive enforcement cannot be bypassed by the runtime path.
- Runtime lineage is durable.
- Evidence packets are immutable.
- Malformed reasoning fails safely.
- Candidate memory cannot mutate canonical truth.
- Fleet Scribe authority remains intact.
- Quartermaster source integrity remains blocking.
- No PIB/reporting coupling was introduced.
- No parallel reporting system was created.
- The runtime remains additive to Data Pond, Captain runtime, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.
