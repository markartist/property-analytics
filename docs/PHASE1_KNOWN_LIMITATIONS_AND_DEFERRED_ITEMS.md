# Phase 1 Known Limitations And Deferred Items

## Purpose
Record what is intentionally deferred so production enablement does not drift into redesign.

## Intentionally Deferred
- richer operator UI for Phase 1 route activity and suppression pressure
- full `Issue` promotion workflow
- supervisor workflow and review tooling
- institutional memory promotion workflows
- advanced observability surfaces beyond:
  - route logs
  - request ids
  - activity JSON artifacts
  - noise-budget summary endpoint
- broader multi-agent orchestration
- non-MVP domain onboarding beyond `ga4` and `psi`

## Operational Meaning
- Phase 1 is governed and operationally usable.
- Phase 1 is not yet a full operator console.
- Route/activity artifacts remain the primary inspection surface during early rollout.

## Rollout Constraint
Do not treat these deferred items as blockers for controlled Phase 1 enablement unless they directly prevent:
- governed HTTP routing
- mirror/reconcile/activate success
- pipeline health generation
- execution snapshot creation
- governed property advocate execution
