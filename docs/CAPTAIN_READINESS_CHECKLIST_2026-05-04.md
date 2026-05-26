# Captain Readiness Checklist

Status: Draft v1
Date: 05/04/2026
Owner: MarketingOps / Property Analytics
Scope: Minimum conditions required for a Captain to be considered stood up and fit for active command duty

## Purpose

A property should not be treated as actively covered just because it appears in a roster.

A Captain is only truly stood up when the role has the governed identity, lane coverage, memory, and operating paths required to produce reliable property directives.

## Readiness Standard

A Captain is ready only when every required area below is present or an explicit exception has been recorded.

## 1. Identity Governance

The property must have:

- governed identity resolution through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- a current row in `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
- resolved property code, community id, and known source identifiers needed for active lanes
- no local one-off mapping introduced for the Captain or one report family

Ready when:

- identity resolves cleanly for the property's active source set

## 2. Command Posture

The property must have:

- an active monthly designation such as `Critical`, `Spotlight`, or `Sale`
- a clear market label where command grouping needs it
- a current activation record in the Captain system

Ready when:

- the property's command posture is explicit and current

## 3. Captain Assignment

The property must have:

- an active Captain record
- active support-lane assignments appropriate to the property's command posture
- a known cadence for daily and weekly lane execution where applicable

Ready when:

- the roster shows active Captain ownership and expected support coverage

## 4. Source Readiness

The property must have:

- expected source families identified
- source freshness posture known for each expected lane
- mirror or runtime-access path working for governed sources
- missing, stale, or blocked lanes visible rather than hidden

Ready when:

- the Captain can tell which evidence is trustworthy and which is degraded

## 5. Memory Baseline

The property must have:

- activation memory
- current property memory entry or log foundation
- ability to preserve decisions, actions, and lessons over time
- a path for promoting doctrine-candidate lessons upward

Ready when:

- the property is not starting from zero each cycle

## 6. Action And Escalation Paths

The property must have:

- a way to write watch items
- a way to write or track actions
- owner/date/proof structure for directives
- an escalation path to Commodore and Admiral layers when needed

Ready when:

- the Captain can turn a read into accountable follow-through

## 7. Reporting Path

The property must have:

- a valid output path for Captain-facing artifacts
- a governed format for decision-ready reads
- the ability to expose source gaps and confidence posture in the output

Ready when:

- the Captain can publish a useful read without inventing unsupported certainty

## 8. Quality Controls

The property must have:

- property identity governance checks available
- context-discipline checks for system-shape work
- PIB guardrail compliance when adjacent report families are touched
- any property-specific exceptions documented instead of buried in code

Ready when:

- the property can be operated without bypassing the platform's governance model

## Ready / Not Ready Test

A Captain is ready if the answer to all of these is yes.

- Can we resolve property identity through the governed matrix?
- Do we know the property's designation and command posture?
- Is there an active Captain and support roster?
- Do we know which sources are current, stale, missing, or blocked?
- Can the Captain preserve memory and carry lessons forward?
- Can the Captain produce watch items and actions with owners and proof?
- Can the property be escalated through the command chain when needed?

If any answer is no, the Captain should be treated as partially stood up rather than fully active.

## Operator Rule

Roster presence is not the same thing as readiness.

Readiness means the system can support a real property command function rather than the appearance of one.
