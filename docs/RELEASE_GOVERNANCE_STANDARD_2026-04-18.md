# Release Governance Standard

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics

## Purpose

Define the enterprise-grade standard for promoting the platform safely.

## Core Rule

Production promotion must come from a coherent release-shaped path, not from a mixed dirty worktree.

Current canonical release base:

- `codex/release-reconcile`

## Release Principles

1. Promote from coherent slices only.
2. Separate active workstreams before promotion.
3. Treat trust posture and permission posture as release requirements, not afterthoughts.
4. Do not allow pilot, specialized, or legacy lanes to ride silently inside a canonical production promotion.

## Release Gates

### 1. Verification gate

Required:

- app and API verification pass
- context discipline check passes
- PIB guardrail check passes

### 2. Ownership gate

Required:

- the changed slice has a named canonical owner
- unrelated outcome ownership is not mixed into the release accidentally
- follow-up work is explicitly separated

### 3. Trust gate

Required:

- expected trust posture is preserved for affected routes and surfaces
- offering/action permissions align with intended business authorization
- no unjustified fallback or boundary regression is introduced

### 4. Provenance gate

Required:

- branch/worktree source is identified
- deployment target is identified
- the changed workstream families are named

## Anti-Patterns

- releasing directly from a giant mixed worktree
- bundling pilot work silently into core production promotion
- shipping boundary changes without trust verification
- letting legacy systems define canonical release scope

## Workstream Rule

All major work should remain attributable to an explicit lane, such as:

- platform / app
- data collection hardening
- content operations
- zero trust / SSO
- EVS / BrowserStack
- pilot reporting

## Relationship To Other Docs

Use this standard with:

- `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`
- `/Users/mark/Property_Analytics/docs/WORKTREE_COMPARTMENT_MAP_2026-04-16.md`
- `/Users/mark/Property_Analytics/docs/ENTERPRISE_READINESS_AUDIT_2026-04-18.md`
- `/Users/mark/Property_Analytics/config/release_governance.json`

