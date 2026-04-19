# Enterprise Gap Register

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics

## Purpose

Track the remaining gaps between the current platform and an enterprise-grade operating system.

## Gap Domains

### 1. Outcome ownership consolidation

Severity: Critical  
Primary owner: MarketingOps Architecture

Gaps:

- `Portfolio_Monitoring` still overlaps canonical operational ownership
- `Portfolio_Dashboard` still overlaps canonical navigation and portfolio-insight ownership
- PIB / POP Brief / Spotlight still need one formal report-family architecture

Done when:

- one canonical owner exists for each major outcome
- overlapping legacy systems are either specialized, reference-only, or clearly migrating

### 2. Release and repo discipline

Severity: Critical  
Primary owner: Platform Operations

Gaps:

- promotions still depend too much on mixed worktree state
- workstreams are not yet separated cleanly enough for enterprise promotion discipline
- the current Keeper-backed Cloudflare admin token is invalid for non-interactive Wrangler promotion, which blocks clean release deployment even when the release branch itself is ready

Done when:

- clean release path exists and is used
- release slices are coherent and traceable
- platform promotion no longer depends on dirty multi-stream state
- release credentials are healthy and verified before deployment begins

### 3. Security completion

Severity: High  
Primary owner: Platform Security

Gaps:

- remaining transitional and review trust nodes still exist
- action-level permissions are strong in major lanes but not uniformly complete

Done when:

- major governed lanes are aligned to the expected trust model
- named offering permissions are consistently enforced in UI and API

### 4. Service-level operational maturity

Severity: High  
Primary owner: Platform Operations + Watchtower

Gaps:

- service and release health are less visible than source and collection health
- deployment provenance and environment drift are not yet first-class operational signals

Done when:

- Watchtower can show release and service posture, not just source posture
- owned runbooks exist for enterprise-critical services

## Canonical Source

The machine-readable source of truth for this register is:

- `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`
