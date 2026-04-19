# Release Provenance Stamping Runbook

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics  
Purpose: Define the canonical local process for stamping release pedigree until CI-native provenance is available.

## Canonical Script

- `/Users/mark/Property_Analytics/scripts/update_release_provenance.py`

## What It Does

The script updates:

- `/Users/mark/Property_Analytics/config/release_provenance.json`

Using:

- current git branch
- current HEAD commit
- current dirty/clean posture
- release lane
- deployed Worker version
- deployed Pages runtime identifier
- public runtime URLs

## Current Use

This is the correct bridge step for enterprise hardening right now because it reduces:

- stale operator-maintained release records
- hand-edited baseline commit drift
- runtime identifier drift between docs and live deployment

## Current Limitation

This is still local/operator stamping, not CI-issued provenance.

That means:

- it is better than hand-editing
- it is not the final enterprise target

The final target is:

- deploy pipeline emits release provenance automatically
- Watchtower consumes issued provenance artifacts directly

## Operational Hygiene Rule

The current runtime-stamped files:

- `/Users/mark/Property_Analytics/config/release_provenance.json`
- `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`

are operational bridge artifacts.

That means:

- they may be refreshed after deployment to reflect current runtime identifiers
- they should not be treated as meaningful feature drift in release-reconcile hygiene
- release reconciliation tools should ignore them when calculating whether the branch is otherwise clean

Practical effect:

- a successfully promoted clean branch should not look dirty only because provenance was restamped afterward
