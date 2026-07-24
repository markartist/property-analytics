# ApartmentIQ Trial Evaluation Plan

Date: 2026-05-28
Owner: Data Collection / Data Pond / Captain's Log
Status: Active trial-use plan

## Purpose

This plan defines how to spend the current ApartmentIQ trial-call allowance responsibly while building a credible licensing case.

The goal is not broad collection for its own sake. The goal is to prove:

1. which ApartmentIQ data is uniquely useful,
2. which internal decisions it can improve,
3. how often those decisions need refreshes,
4. what collection cadence is sustainable under a licensed posture.

ApartmentIQ remains advisory market/comps intelligence. Data Pond and official operating sources remain authoritative for internal operating truth.

## Current Starting Point

Verified as of 2026-05-28:

- auth works with Keeper record `ApartmentIQ Token`
- one ApartmentIQ account is visible: `Venterra`
- current account comp-set inventory discovered: `286`
- current governed subject mappings in Pond: `1`
- current governed subject property:
  - `FL4NB` / `Northbridge at Millenia Lake`
  - ApartmentIQ property id `99066651`
  - current mapped comp set `11867349`
- current stored baseline:
  - `285` comp sets
  - `28` market-survey rows
  - `1,480` unit rows
  - `278` floorplan rows

## What We Have Confirmed About The API

Low-cost live probing indicates the practical call model is:

- `GET /accounts`: `1` call
- `GET /accounts/{account_id}/comp_sets`: `1` call
- `GET /comp_sets/{comp_set_id}/market_survey`: `1` call
- `GET /comp_sets/{comp_set_id}/units`: `1` call
- `GET /comp_sets/{comp_set_id}/floor_plans`: `1` call

The API responses tested so far do not expose quota-remaining or reset-time headers, so call budgeting must be done locally.

Useful budgeting formulas:

- daily light, live comp-set list, market only for `N` comp sets: `2 + N`
- daily light, cached comp-set list, market only for `N` comp sets: `1 + N`
- full deep sample, market + units + floor plans for `N` comp sets: `2 + 3N`

## Evaluation Questions

The trial should answer these questions:

1. Does ApartmentIQ surface market pressure that our current internal stack does not already show clearly?
2. Does unit-level and floorplan-level detail materially improve recommendations over market-survey-only reads?
3. Which signals are stable and decision-grade enough for recurring weekly use?
4. Which signals are interesting but too noisy or too expensive to justify licensed refreshes?
5. What portfolio operating motions could be improved by recurring ApartmentIQ reads?

## High-Value Signals To Evaluate

These are the highest-value data families confirmed in the current payloads:

- property-level market pricing and net effective rent
- concessions and offer posture
- exposure / leased / available signals
- review posture and amenity comparisons
- unit-level days on market
- unit-level rent change history
- unit-level availability and lease status
- floorplan- and bed/bath-level pricing structure
- TruComp differentials

## Licensing Case We Need To Build

A credible license case should be framed around recurring business decisions, not curiosity.

The strongest likely use cases are:

- weekly subject-vs-market pricing posture for watchlist and Captain reads
- concession pressure detection by comp set and by unit type
- exposure / available-unit pressure monitoring
- aged-unit and stale-inventory risk identification
- floorplan-specific strategy support instead of property-wide concession generalization
- external market evidence to validate or challenge internal hypotheses before action packages are issued

Weak licensing arguments to avoid:

- generic market research
- collecting every available endpoint because it exists
- using ApartmentIQ as a substitute for internal leasing truth
- broad daily deep pulls without a defined decision consumer

## Trial Strategy

The trial should proceed in three phases.

### Phase 1: Anchor Property Proof

Objective:

- prove that one governed subject property can produce a useful recurring market read

Scope:

- property: `FL4NB` / `Northbridge at Millenia Lake`
- use market survey first
- sample units and floorplans only where they change the interpretation

Questions:

- does subject-vs-comp pricing identify a real rent or concession gap?
- does exposure suggest current availability pressure?
- do unit-level days-on-market or rent-change fields sharpen the recommendation?

Budget:

- market-only refresh at one comp set: `3` calls live or `2` calls with cached comp-set list
- full deep refresh at one comp set: `5` calls live or `4` calls with cached comp-set list

Success criteria:

- produce one decision-ready property read that is better than a plain internal operating summary
- identify at least one recommendation ApartmentIQ materially sharpened

### Phase 2: Small Cohort Expansion

Objective:

- test whether value generalizes beyond one property

Scope:

- add `4-9` more governed subject mappings before broadening cadence
- market survey only by default
- deep pulls only for exception properties with unclear pricing or availability posture

Questions:

- are the same ApartmentIQ signals useful across multiple submarkets?
- which properties benefit most from deep endpoint pulls?
- can we cluster properties by refresh need rather than treat the portfolio uniformly?

Budget target:

- keep this phase under `60-90` total calls

Success criteria:

- identify a repeatable “market-only default” pattern
- identify the narrow conditions that justify unit/floorplan deep pulls

### Phase 3: Recurring Watch Pilot

Objective:

- define the licensed operating cadence we would actually want

Scope:

- one small weekly watchlist
- daily light only if a real user of the daily output exists

Questions:

- what is the minimum recurring cadence that still preserves value?
- what should be weekly, and what should only be run on demand?
- what annual or monthly call envelope would a licensed version require?

Success criteria:

- documented call budget by cadence
- documented output consumers
- documented examples where ApartmentIQ changed a recommendation or accelerated action

## Recommended Call Discipline

Until reset timing and quota telemetry are clearer:

- keep daily light at market survey only
- prefer cached comp-set list where possible
- use unit and floorplan endpoints only for targeted deep dives
- avoid full-portfolio deep scans during the trial
- reserve explicit headroom for retries and exploratory verification

Recommended provisional budget:

- `25-35%` of remaining calls for anchor-property and schema learning
- `40-50%` for small-cohort market-survey comparisons
- `15-25%` for targeted deep endpoint pulls
- `10-15%` held in reserve for retests, vendor debugging, and proof artifacts

## Outputs We Should Produce

The trial should create artifacts that support a license conversation.

Required outputs:

- one anchor-property decision memo
- one small-cohort comparison memo
- one endpoint-cost and cadence memo
- one license recommendation memo with call-budget estimate and concrete use cases

Optional outputs:

- portfolio watchlist mockup using ApartmentIQ advisory fields
- recurring Captain addendum showing how ApartmentIQ changes a brief

## Immediate Next Steps

1. Keep `FL4NB` as the anchor property for the first proof read.
2. Add a small governed subject-mapping cohort before any broad recurring run.
3. Run market-survey-only comparisons first.
4. Use unit and floorplan pulls only where market-survey-level reads are insufficient.
5. Log local estimated call spend for every ApartmentIQ run so the trial remains auditable.

## Decision Standard

We should recommend licensing ApartmentIQ only if the trial shows all of the following:

- the data changes or materially sharpens real operating recommendations
- the useful signals recur often enough to justify a standing cadence
- the required cadence has a sustainable call budget
- the output can be integrated into existing Captain and market-intelligence workflows without creating parallel truth systems
