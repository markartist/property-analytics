# Watchlist Decision Output Standard v1.1

Date: 2026-05-07
Owner: Captain's Log / Data Pond / Watchlist Reporting
Status: Active
Supersedes: `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_0_2026-05-06.md`

## Purpose

The Watchlist Decision Output is the human executive decision layer for Watchlist properties. It uses Data Pond facts and the VP retrieval JSON, but it is not the VP JSON itself and it is not a replacement for PIB, POP Brief, Captain Brief, or Captain memory.

## Canonical Renderer

Use:

`/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_decision_output.py`

Do not send stale static examples as live reports. Static examples may remain as historical references only.

## Canonical Sender

Use:

`/Users/mark/Property_Analytics/reports/captains_log/send_watchlist_decision_output_email.py`

For shared-repository delivery, send with `--no-html-attachment` and place links quietly at the bottom of the email.

## Required Visual / Language Rules

- Mandatory PIB-style header from `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`.
- Header version line should display centered as `v1.1` with a smaller italic `by MarketingOps` line underneath.
- All human-facing dates must display as `MM/DD/YYYY` with no timestamps. Month-only source periods should be displayed as the first day of that month, for example `01/01/2026`.
- No top-loaded repository-link table.
- Repository links belong in a compact bottom utility after `Sources Used`, and email links must be actual SharePoint/OneDrive web URLs. Do not use `file://` links in outbound email.
- Sources stay at the bottom unless a source note prevents a wrong action.
- Do not use `False-Cut Protection`; use `Recommendation Guardrails`.
- Do not use user-facing `RFP`; use `PQ` where late-funnel terminology is needed.
- Do not show `Owner` lines, owner columns, or role-call labels in the human-facing report.
- Display `ADC` / `Apartments.com` as `Apartments.com / ADC`.
- Display `Drive By` as `Walk-In / Drive-By`.
- Do not add a standalone search KPI or search agenda. Website/technical evidence is allowed only as conversion and content-clarity evidence.
- Do not present raw data dumps. Use tiles, score bars, compact tables, decision pills, and action packages.

## Required Sections

1. PIB-style header
2. Executive Diagnosis
3. KPI tiles, including exposure, make-ready / vacant-ready posture, net leases needed, and spend posture when available
4. Scorecard
5. Constraint Resolution
6. Funnel Snapshot
7. Inventory Pressure
8. Product Readiness / Make-Ready
9. Channel Budget Efficiency
10. Channel Decision Check / Recommendation Guardrails
11. Competitive Market Read
12. SEO + Local Content Action Pack
13. Recommendation Packages
14. Current Funnel Stress Test
15. Secondary Evidence Appendix
16. Source Output
17. Current Spend + Output Efficiency
18. Historical Cost Efficiency
19. Unit-Type Spend / Targeting
20. Website Technical Health
21. GSC / Organic Demand
22. Top Organic Queries
23. Non-Branded Opportunity
24. DataForSEO Rank Check
25. On-Page Structure Check
26. Reputation / Product Friction
27. Review Themes
28. Reputation Score Trend or Components
29. Resident Friction Examples
30. Sources Used
31. Quiet repository file links, when using repository delivery

## SEO + Local Content Action Pack

This section is governed by `/Users/mark/Property_Analytics/docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md`.

Rules:

- It must tie website, GBP, social, FAQ, metadata, and shadow-page recommendations to the property's actual leasing condition.
- It must audit the property data and page evidence separately, then synthesize a practical copy/content action.
- It must not give generic SEO advice, keyword stuffing, invented local facts, invented employer/distance claims, or unsupported specials.
- It should be compact in the main email and execution-ready in the site-manager/content artifact.

## Scorecard Lanes

The full report scorecard should not be compressed below these lanes unless the source data is genuinely unavailable:

1. Demand
2. Conversion
3. Inventory / Product
4. Pricing / Market
5. Marketing Efficiency
6. Website / Technical
7. Reputation
8. Competitive / Market

Operations can be added as a ninth lane when service, make-ready, or ticket data is present enough to score separately.

## Channel Table Rule

Channel decision tables show demand channels only.

Exclude:

- agency fees
- management fees
- support costs
- zero-spend sources unless the row is needed to explain a decision

Support costs may remain in source files or companion workbooks, but they should not be presented as channels to protect, tighten, scale, or cut.

## First v1.1 Test

Generated artifact:

`/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/ar4pb_watchlist_decision_output_v1_1_2026-05-07.html`

Published artifact:

`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data/05_Current_Reports/Watchlist/The Pointe Bentonville/2026-05-07/The_Pointe_Bentonville_Watchlist_Decision_Output_v1_1_2026-05-07.html`

Email send proof:

- Subject: `The Pointe Bentonville - Watchlist Decision Output v1.1 Test`
- Message ID: `8207e82a-e630-4d3f-919b-441aa8699583@property-analytics.local`
- Attachments: none

Restored full-condition proof from the 2026-05-06 9:06 PM Elation report:

- Artifact: `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_decision_output_v1_1_2026-05-06.html`
- Original full-condition send: `348861ca-fa94-4abb-a3e8-0b38a7cd25b1@property-analytics.local`
- 2026-05-07 restored send with support fees removed from channel decisions: `bee9648a-873b-4669-8bdc-bf775e77e06f@property-analytics.local`

## Boundary

This is a Watchlist report-family renderer/sender standard. It does not mutate locked PIB files and must not create a parallel PIB system.
