# Portfolio Captain Activation Standard

Status: Draft v1
Date: 05/04/2026
Owner: MarketingOps / Property Analytics
Scope: Rules for standing up and refreshing Captain coverage across the governed portfolio, including pilot properties and monthly designated properties

## Purpose

Captain activation should be durable, governed, and repeatable.

This standard defines how the portfolio roster is assembled, how Spotlight and pilot overlays are preserved, and what it means to stand up the full fleet rather than a temporary subset.

## Active Scope Layers

The Captain roster can carry multiple overlapping scope labels.

| Scope Type | Meaning |
| --- | --- |
| `portfolio` | property is part of the governed active portfolio and should have baseline Captain coverage |
| `spotlight` | property is part of the current monthly designated Spotlight set |
| `pilot` | property is part of the documented pilot set and should preserve pilot-operating continuity |

A property may carry more than one scope label, such as `portfolio,spotlight` or `portfolio,pilot`.

## Designation Layer

Designation is separate from scope type.

Current governed designation values include:

- `Critical`
- `Spotlight`
- `Sale`

Designation changes command posture, cadence pressure, and escalation sensitivity. It should come from the current monthly Spotlight config when present.

## Activation Source Order

Captain standup should use these governed sources in order.

1. governed property identity matrix
2. current monthly Spotlight config for designation and market overlays
3. documented pilot property list
4. current Captain activation/memory tables in remote D1

No local one-off property map should be introduced for activation.

## Standup Rules

### Portfolio Baseline

- every governed portfolio property receives baseline Captain activation through the identity matrix
- baseline portfolio activation uses the `portfolio` scope label
- baseline activation should not overwrite stronger monthly designation values when they exist

### Monthly Spotlight Overlay

- current monthly Spotlight properties overlay the baseline roster
- Spotlight overlays carry current `designation` and `market`
- Spotlight overlays add the `spotlight` scope label rather than replacing portfolio membership

### Pilot Overlay

- documented pilot properties preserve the `pilot` scope label
- pilot membership should survive monthly Spotlight refreshes
- pilot properties may also be spotlight properties at the same time

## Captain Support-Lane Minimum

A stood-up Captain should include the governed support-lane set:

- Source Scout
- Truth Reconciler
- Inventory Watch
- Funnel Watch
- Media Watch
- Reputation Watch
- Navigator Watch
- Experience Watch
- Boatswain
- Logkeeper
- Supervisor Scribe

## Activation Outputs

Every standup run should produce:

- a local SQL activation artifact
- a local JSON manifest
- a remote D1 apply when requested
- activation memory rows
- support-agent rows
- retirement or supersession of stale prior activation rows where appropriate

## Retirement Rule

Captain activation should retire stale portfolio or Spotlight coverage that is no longer in scope, while preserving valid active pilot overlays when they remain in the documented pilot set.

## Verification Standard

A standup run is not complete until we verify:

- property count in the manifest
- support-agent count in the manifest
- remote D1 rows applied successfully
- designation and market overlays are present where expected
- pilot properties remain active
- no property identity exceptions were introduced outside the governed matrix

## Outcome Standard

A mature portfolio roster means the organization can treat Captain coverage as an operating system, not a manually curated special project.
