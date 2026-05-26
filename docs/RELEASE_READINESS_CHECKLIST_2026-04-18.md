# Release Readiness Checklist

Status: Draft v1
Date: 2026-04-18
Owner: MarketingOps / Property Analytics

## Before Promotion

### Verification

- `apps/api` typecheck passes
- `apps/web` build passes
- `bash scripts/check_context_discipline.sh` passes
- `bash scripts/check_pib_guardrails.sh` passes

### Ownership

- canonical owner of the slice is named
- mixed unrelated workstreams are excluded
- legacy or specialized systems are not silently redefining the release scope

### Trust

- affected routes match expected Zero Trust posture
- affected offerings match intended action permissions
- no debug, fallback, or direct-origin regression is introduced

### Provenance

- branch/worktree source is documented
- deployment target is documented
- affected workstream lane(s) are documented

## After Promotion

- deployment URL or worker version is recorded
- relevant control-plane or memory docs are updated
- any remaining follow-up work is assigned to a named lane
