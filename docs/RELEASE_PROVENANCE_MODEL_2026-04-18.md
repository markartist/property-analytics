# Release Provenance Model

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics  
Purpose: Canonical model for release pedigree, promoted-slice visibility, and runtime identifier tracking until CI-native provenance is available.

## 1. Why This Exists

Deployment provenance tells us:

- where a surface is pointed
- whether hosts and runtime policy drift

Release provenance tells us:

- what slice actually shipped
- what branch or workstream produced it
- what clean baseline it descended from
- whether it came from a clean release path or a direct worktree deploy
- which runtime identifiers correspond to the current live slice

Enterprise operations need both.

## 2. Canonical Source

Machine-readable source:

- `/Users/mark/Property_Analytics/config/release_provenance.json`

Current operator-facing surface:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`

Control-plane payload:

- `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`

## 3. Current Model

The current release provenance record includes:

- source branch
- baseline commit SHA, timestamp, and subject
- source mode
- release lane
- canonical release path
- provenance status
- provenance note
- deployment records by service with:
  - target
  - deployed date
  - runtime identifier
  - public URL

## 4. Current Limitation

This is still an operator-maintained release pedigree model.

That is useful and much better than implicit memory, but it is not the end state.

The target end state is:

- CI or release automation generates release provenance
- deploys are tied to clean commit-based release slices
- Worker and Pages deployments can be traced automatically
- Watchtower consumes issued provenance instead of manually maintained release records

## 5. Enterprise Rule

Until CI-native provenance exists:

- every materially promoted slice should update this record
- dirty-worktree direct deploys must be called out explicitly
- Watchtower should show the truth, not the idealized path

That honesty is part of enterprise maturity.
