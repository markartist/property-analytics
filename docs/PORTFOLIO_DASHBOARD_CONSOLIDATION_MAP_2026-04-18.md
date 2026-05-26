# Portfolio Dashboard Consolidation Map

Status: Draft v1
Date: 2026-04-18
Owner: MarketingOps / Property Analytics

## Purpose

Define how `Portfolio_Dashboard` should be treated during enterprise consolidation.

This system contains useful portfolio-analysis and dashboard patterns, but it should no longer act like the default product shell.

## Enterprise Disposition

`Portfolio_Dashboard` is:

- `Legacy-Reusable`

It is not:

- the canonical navigation surface
- the canonical operational command deck
- the canonical home for new product UI

## Canonical Replacements

### Portfolio navigation and report discovery

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/src/app/dock/`

### Analysis and report surfaces

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/`

### Operational health and platform posture

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/`

### Main governed UI growth

Canonical owner now:

- `/Users/mark/Property_Analytics/apps/web/`
- `/Users/mark/Property_Analytics/apps/api/`

## What To Preserve

- dashboard interaction ideas worth absorbing into the Pond
- local rollup and analysis patterns
- useful contracts and data-shaping notes

## What To Stop Growing

- new default dashboard entry patterns
- new canonical portfolio operator surfaces
- new auth or permission assumptions outside the Pond

## Practical Next Moves

1. keep Dock as the governed navigation surface
2. absorb the best legacy dashboard patterns into app-native analysis pages
3. treat Streamlit dashboard work as reference or targeted migration work, not as a parallel canonical UI track
