# Captain's Brief vNext Report Memo

Date: 2026-05-06
Owner: Captain's Log / Data Pond
Status: Active local generator

## Purpose

Captain's Brief vNext is the current local Captain recovery report generator. It turns Data Pond facts into an action-ready email brief for Spotlight / Critical / watchlist properties.

It is a report presentation layer, not the VP JSON retrieval layer and not canonical PIB.

## Canonical Script

Primary generator:

`/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`

Example preview command:

```bash
python3 reports/captains_log/generate_captains_brief_vnext.py --property-key TX4GH --captain "Grand Harbor" --date 2026-05-06
```

Example email command:

```bash
python3 reports/captains_log/generate_captains_brief_vnext.py --property-key TX4GH --captain "Grand Harbor" --date 2026-05-06 --send
```

Generated output path pattern:

`/Users/mark/Property_Analytics/reports/captains_log/<property_slug>/<property_slug>_captains_brief_vnext_generated_<date>.html`

Outlook-safe email path pattern:

`/Users/mark/Property_Analytics/reports/captains_log/<property_slug>/<property_slug>_captains_brief_vnext_generated_<date>_email_outlook.html`

Grand Harbor proof artifact:

`/Users/mark/Property_Analytics/reports/captains_log/the_cape_at_grand_harbor/the_cape_at_grand_harbor_captains_brief_vnext_generated_2026-05-06_email_outlook.html`

Grand Harbor send proof:

`a735e31a-9d33-43f9-8406-195de76d487b@property-analytics.local`

## Current Report Standard

The visible report should lead with business facts and action-ready diagnosis, not source-route status.

The current structure includes:

- action-ready KPI grid
- Admiral Read
- Team Action Intelligence
- Recovery Math
- T30 / T90 Performance Analysis
- Marketing Channel Performance and Spend Direction
- Pricing and Concession Directive
- Competitive Market Read
- USP Direction
- Website Content Diagnosis
- Website Technical Health
- GBP and Social Activation
- Resident Voice and Review Actions
- Readiness, Media, and Hold-Time Checks
- Inventory and Operations
- 30-Day Recovery Plan
- bottom Sources Used panel

## Stakeholder Compliance Rules

- Do not show a paid-search KPI card.
- Do not include a standalone Search Evidence section.
- Do not lead with data-source readiness or missing-source narrative.
- Do not use alarming source failure language in the visible report.
- Put source references at the bottom.
- Explain the why behind recommendations.
- Make the gap clear: visits, guest cards, applications, PQ, move-ins, inventory, pricing, product readiness, or technical conversion friction.
- T30 and T90 are preferred over YoY for the main report body.
- Average days vacant is not a primary action focus until the definition is trusted; use readiness/floorplan exposure instead.
- Website recommendations should diagnose posture before prescribing copy: Tighten, Split, Clarify, Expand, or Leave mostly alone.
- Search data can support page/content diagnosis only as bottom-source evidence; it should not become a visible report agenda.

## Data Inputs Currently Used

- governed property identity matrix
- Marketing BI traffic conversions
- Marketing BI weekly source performance
- Marketing BI monthly spend by source
- Marketing Ops Summary
- C&D / cancellation-denial rows
- unit availability and visible specials
- competitor market research observations
- DataForSEO on-page snapshots
- GA4 engagement rows
- portfolio-wide PSI / Core Web Vitals from `pagespeed_metrics`
- Reputation.com and GBP review/sentiment rows
- Spotlight weekly notes/action items when available
- remote Captain runtime watch/action state when available

## Boundary

This generator intentionally lives in `reports/captains_log`. It must not mutate locked canonical PIB generator/template/sender files. If a future task asks to change canonical PIB behavior, stop and get explicit approval first.
