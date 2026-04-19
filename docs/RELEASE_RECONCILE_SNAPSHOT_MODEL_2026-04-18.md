# Release Reconcile Snapshot Model

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics  
Purpose: Canonical dirty-tree reconciliation snapshot for defining the first clean release-shaped slice.

## Canonical Sources

Generated snapshot:

- `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`

Generator:

- `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py`

Operator-facing surface:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`

## Why This Exists

Release pedigree tells us what shipped.

Release reconcile tells us what still needs to be separated before we can ship cleanly.

This model is the bridge between:

- release governance standard
- release pedigree
- actual mixed worktree reality

## Current Intent

The current snapshot groups open changes by canonical lane:

- platform_app
- data_collection_hardening
- content_operations
- zero_trust_sso
- evs_browserstack
- pilot_reporting
- docs_and_memory
- risky_local
- unclassified

It also declares the first recommended clean slice:

- `platform_app + data_collection_hardening`

with:

- included lanes
- excluded lanes
- current dirty-tree counts
- representative path examples

## Enterprise Value

This turns release cleanup from a vague instruction into an explicit control-plane object:

- how large the mixed tree is
- how much belongs in the primary release slice
- what still needs to be split away

That makes the next release-hardening step measurable instead of rhetorical.
