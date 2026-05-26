# Watchlist Decision Output Standard v1.2

Date: 05/07/2026

## Purpose

Watchlist Decision Output v1.2 is the current human-facing Watchlist report standard for Spotlight/Critical property reads. It keeps the v1.1 decision/report structure and adds the comparison and unit-type demand evidence Stephanie requested.

## Version Lock

- Email/report header displays centered `v1.2` with smaller italic `by MarketingOps`.
- Companion Word report displays `Site Manager Companion | v1.2 by MarketingOps`.
- Local artifact filenames use `_v1_2_`.
- Artifact filenames, email subject dates, and visible report header dates must use the actual run date.
- v1.2 supersedes v1.1 for new Watchlist test and production runs, while older v1.1 artifacts remain historical proof only.

## Required Additions Over v1.1

1. Restore portfolio and regional comparisons.
2. Show T30 and T90 direction for funnel metrics.
3. Add portfolio and regional analysis for funnel and channel-related metrics.
4. Restore guest-card-to-available-unit-type analysis.
5. Use direct language for marketing/channel reads. Do not defend spend or channel performance where downstream output does not support it.
6. Add section-level insight blocks. Tables are evidence; each section must explain what the evidence likely means, what may be causing it, the best next action, and what not to do where relevant.
7. Include a damage/friction lens covering negative reviews, service/ticket response risk, reopen/ticket pressure where available, product readiness, and other trust blockers that can suppress conversion.
8. The Current Funnel Stress Test must separate broad traffic-volume math from the real recovery gap. If current T30 volume already exceeds the broad activity needed, say that plainly and show the actual gap as net exposure, floorplan/product fit, follow-up, offer clarity, pricing/concession fit, or service/readiness blockers.
9. Reputation / Product Friction must follow the richer PIB reputation lane, not a thin rating table. Include GBP review volume, star mix, reply capture, sentiment score/breakdown, theme sentiment, critical review action items, Reputation.com score trend, score components, and local reputation competition when available. Clearly label GBP all-time/review-level evidence separately from Reputation.com current-period evidence.
10. Unit-Type Spend / Targeting must be human-readable. Never render raw JSON/Python keyword arrays. Bedroom keywords belong under the matching unit-type lane, not under General search terms. General search terms must exclude inactive keywords and bedroom-specific keywords.

## Funnel Comparison Rules

Required rows:

- Guest Cards
- Visits
- Applications
- Price Quotes
- Visit / Guest Card
- Application / Guest Card where available
- PQ / Guest Card where available
- PQ / Visit
- Guest Cards / Available Unit

Each comparison row should show:

- Property T30 value
- T30 direction
- Property T90 value where available
- Portfolio average
- Regional average
- Plain-English read

## Channel Comparison Rules

Channel/source sections must compare property yield to portfolio and region where the data exists. Activity alone is not success.

Required channel reads:

- Property GC / visits / leases / move-ins
- Property visit yield and lease yield
- Portfolio visit yield and lease yield
- Regional visit yield and lease yield
- Direct read explaining whether the source is earning more budget, needs tighter follow-up, or needs floorplan/message correction

## Unit-Type Demand Rules

Guest-card-to-available-unit-type analysis is required when available-interest rows are present.

Required fields:

- Unit type / bedroom count
- Available units
- T30 guest cards
- T30 guest cards per available unit
- T30 direction
- T30 price quotes
- Price quote direction
- Plain-English read

This section answers whether demand is matching the actual available product. Total guest-card volume is not enough if the exposed floorplans are not receiving qualified demand.

## Companion Word Report

The site-manager companion Word report is versioned with the email/report and must use the same governed data. v1.2 companion requirements:

- Full Venterra logo header
- Sans-serif body type
- `v1.2 by MarketingOps` version line
- T30 and T90 trend cards with arrows/color
- Portfolio and regional comparison section
- Guest-card-to-available-unit-type section
- Direct channel/output reads
- “What Could Be Hurting Us” damage/friction section using reviews, tickets/service delivery, and make-ready/readiness signals
- Render-and-verify before delivery

## Current Proof

- Local HTML: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/ar4pb_watchlist_decision_output_v1_2_2026-05-07.html`
- Local DOCX: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/ar4pb_site_manager_action_plan_v1_2_2026-05-07.docx`
- Render QA folder: `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/docx_render_check_v1_2`
