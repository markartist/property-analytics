# Watchlist Decision Output Standard v1.0

Date: 2026-05-06
Owner: Captain's Log / Data Pond / Watchlist Reporting
Status: Superseded by `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md`

## Purpose

The Watchlist Decision Output is an executive-facing decision packet for Watchlist properties. It is additive to the Data Pond and Captain toolbox. It does not replace the Data Pond, Captain memory, Spotlight notes, POP/Captain Briefs, or the VP retrieval JSON contract.

Its purpose is to turn governed Pond facts into a clear Watchlist read:

- what the primary constraint is
- what secondary constraints matter
- which signals support or conflict with the diagnosis
- how budget and channel performance should be handled
- which actions should be taken in the next T30 / T90 windows
- how confident the system is

## v1.0 Proof Artifact

First accepted visual example:

`/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_watchlist_decision_output_example_2026-05-06.html`

First accepted email send:

- Subject: `The Pointe Bentonville - Watchlist Decision Output`
- Message ID: `5c71a194-3c3c-45d1-b43a-b4a69646bf9d@property-analytics.local`

## Current Companion Workbook

The current companion workbook standard is v1.2:

`/Users/mark/Property_Analytics/docs/WATCHLIST_COMPANION_WORKBOOK_STANDARD_V1_2_2026-05-07.md`

The workbook is the attached evidence layer for deeper review. The email remains the human decision output.

## Mandatory Email Header

All emailed Watchlist Decision Outputs must use the PIB-style Venterra header via:

`/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`

The header is mandatory. Do not send a Watchlist decision email without it.

## Email Delivery Path

Watchlist Decision Output emails must be sent through the report-family sender:

`/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py`

This sender validates the Watchlist artifact, attaches the HTML artifact and any companion files, writes the Watchlist delivery log, and uses the shared low-level email transport from a governed report-family path. Do not create property-specific one-off send scripts for Watchlist delivery.

## Required Sections

The v1.0 output must include:

1. PIB-style header
2. Executive Diagnosis
3. Primary Constraint
4. Confidence
5. KPI / pressure tiles
6. Scorecard
7. Constraint Resolution
8. Funnel Snapshot
9. Channel Budget Efficiency
10. Recommendation Guardrails
11. Recommended Actions
12. Expected Outcomes, split T30 and T90
13. Final Recommendation
14. Sources Used at the bottom

## Visual Standard

The output should be designed for humans scanning under executive pressure.

Use:

- tiles for headline facts
- score bars for normalized dimensions
- decision pills for channel actions
- short bullets for constraint resolution
- action cards with owner, why, expected effect, and proof expected
- bottom source table

Avoid:

- long paragraphs of dense numeric data
- raw data dumps
- generic recommendation language
- unbranded email output
- top-loaded source-readiness narratives
- unsupported or invented claims

## Decision Content Standard

The report should show:

- primary constraint
- secondary constraints
- score dimensions such as Demand, Conversion, Inventory/Product, Pricing/Market, Marketing Efficiency, Operations, Digital/Website, Reputation, and Market
- why the primary constraint won
- why other plausible constraints did not win
- channel budget posture: scale, hold, tighten, investigate, reduce, or protect/improve
- recommendation guardrails when channel performance may be suppressed by digital, product, reputation, pricing, or inventory mismatch
- T30 and T90 expected directional outcomes
- source-backed confidence

## Data Rules

- Use Data Pond facts where available.
- Resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Do not invent values.
- If a required source is unavailable, either omit that metric from the visual or mark it plainly in the bottom Sources Used / notes area.
- Keep source explanations at the bottom unless they are necessary to prevent a wrong business action.
- Spend should use the spend workbook route when available.
- PSI/Core Web Vitals should use `pagespeed_metrics` for portfolio-wide website health.
- Search evidence may support website content diagnosis, but it should not become a visible search agenda unless explicitly requested.

## Boundary

This is a Watchlist reporting standard, not a replacement for:

- VP property retrieval JSON
- Captain Brief vNext
- canonical PIB
- POP Brief
- Data Pond source routes

Locked canonical PIB generator/template/sender files must not be modified to support this standard without explicit user approval in the current task.
