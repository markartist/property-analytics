# Platform Consolidation Plan

Status: Draft v1
Date: 2026-04-17
Owner: MarketingOps / Property Analytics
Scope: Enterprise-grade roadmap for stabilizing, securing, and integrating the full web platform into The Pond

## 1. Objective

Make the platform:

- stable
- recognized
- integrated into The Pond
- Zero-Trust-insistent
- highly portable
- resistant to duplicate ownership

## 2. North Star

The Data Pond should function as the governed operating environment for the web platform.

It should unify:

- truth
- operational health
- report and tool navigation
- briefing families
- content operations
- validation lanes
- system awareness

## 3. Phase Model

### Phase 1: Outcome Governance

Deliverables:

- Canonical outcome map
- explicit acceptable specializations
- explicit consolidate-now systems

Goal:

- stop duplicate ownership before more feature growth

### Phase 2: Control-Plane Awareness

Deliverables:

- landscape manifest
- `/system`
- Watchtower representation and trust posture

Goal:

- make the platform aware of itself

### Phase 3: Canonical Surface Consolidation

Priority moves:

1. move Portfolio Monitoring ownership into Data Collection + Watchtower
2. move Portfolio Dashboard outcome ownership into Dock + Pond product surfaces
3. formally organize the PIB / POP Brief / Spotlight family

Goal:

- no parallel canonical surface for the same outcome

### Phase 4: Security Completion

Required posture:

- Keeper first
- Cloudflare Zero Trust everywhere it makes sense
- app roles as business authorization
- service-token identity for machine lanes
- no unjustified direct-origin assumptions

Goal:

- one default trust model across the platform

### Phase 5: Portability and Repo Discipline

Required posture:

- package-safe imports
- canonical APIs over hidden file assumptions
- explicit nested-repo boundary treatment
- no accidental canonicals living in legacy subrepos

Goal:

- fewer local-only dependencies, more reusable governed contracts

## 4. Immediate Consolidation Targets

### 4.1 Portfolio_Monitoring

Target:

- Data Collection + Watchtower

Actions:

- continue migrating operational visibility and collection assumptions into canonical health and collection lanes
- preserve reusable utilities, but not ownership

### 4.2 Portfolio_Dashboard

Target:

- Dock + Analysis + other Pond-native product surfaces

Actions:

- inventory which dashboard outcomes are still uniquely valuable
- migrate those patterns into the main app
- stop treating the old dashboard as a default operator entry point

### 4.3 Brief-Family Organization

Target:

- PIB / POP Brief family through The Pond

Actions:

- define briefing architecture by audience and purpose
- protect the locked PIB generator
- keep imported Spotlight/POP-related material discoverable but subordinate to one report-family model

## 5. Security Non-Negotiables

- Keeper is the canonical secret authority
- Cloudflare Zero Trust is the outer trust boundary
- app roles remain the business authorization layer
- shared bearer tokens are migration debt unless explicitly justified
- direct-origin exposure is an exception, not the norm

## 6. Done Definition

The platform is “stable enough” when:

- every major outcome has one canonical owner
- every canonical owner is represented in the Pond or explicitly governed as external
- Watchtower can explain trust posture and remediation for the whole landscape
- legacy/specialized systems no longer silently own canonical outcomes
- users can navigate the important platform capabilities from the Pond without hidden tribal knowledge
