# Service Operations Model

Status: Draft v1  
Date: 2026-04-18  
Owner: MarketingOps / Property Analytics  
Purpose: Canonical service-operations model for enterprise service ownership, runtime posture, release lanes, trust boundaries, and Watchtower visibility.

## 1. Why This Exists

The platform has moved beyond a single app and a single collection job.

We now operate a service landscape:

- local collection/runtime services
- web and API platform services
- governed workspace services
- machine and mixed-access execution lanes
- protected reporting engines

The enterprise problem is no longer only:

- is the data fresh

It is also:

- which service owns the outcome
- where it runs
- how it is promoted
- what trust boundary it sits behind
- what operators should use when it is under pressure

## 2. Canonical Source

Machine-readable source of truth:

- `/Users/mark/Property_Analytics/config/service_operations_manifest.json`

Current visualization surface:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`

Control-plane payload:

- `/Users/mark/Property_Analytics/apps/api/src/routes/pond.ts`

## 3. Current Service Families

The current enterprise service model recognizes these categories:

- `foundation`
  - shared truth and platform services
- `critical_operator`
  - services that keep the operator control loop coherent
- `governance`
  - interpretation and governed memory lanes
- `governed_workspace`
  - human execution surfaces with structured workflow
- `machine_lane`
  - API-first machine execution lanes
- `mixed_validation`
  - human request plus machine ingest/dispatch lanes
- `protected_reporting`
  - locked or specially governed reporting engines

## 4. Required Fields Per Service

Each service should define:

- `owner`
- `service_tier`
- `runtime`
- `deployment_target`
- `release_lane`
- `trust_boundary`
- `canonical_surface`
- `primary_runbook`
- `depends_on`
- `operational_focus`

This is the minimum metadata needed for enterprise operations.

## 5. Watchtower Expectations

Watchtower should be able to answer, for each service:

- what it is
- who owns it
- where it runs
- which release lane governs it
- which trust boundary it should follow
- what it is focused on
- whether it is currently stable, under watch, in action, or actively under shaping

That means Watchtower is no longer only a source-freshness dashboard.

It is becoming the operational command surface for:

- data/source posture
- trust posture
- remediation posture
- service posture
- release posture

## 6. Enterprise Rule

Every canonical service should eventually be:

- represented in the service-operations manifest
- represented in Watchtower
- assigned to a release lane
- attached to a primary runbook
- attached to a trust boundary
- visible as either stable, watch, active, or action-worthy

If a service matters operationally but is not represented here, the platform is still partially blind to itself.
