# PIB Site Evaluation Standard

Status: Approved working standard
Date: 2026-05-20
Owner: MarketingOps / Property Analytics
Seed example: The Cape at Grand Harbor / `TX4GH`

## Purpose

`PIB Site Evaluation` is the approved synthesis format for evaluating an underperforming property website or leasing funnel inside the canonical PIB.

It is not a new PIB renderer, template, or sender. With explicit approval on 2026-05-20, it is the executive intro block for property-level PIB v2.2.0 reports when evaluation evidence is available. The intro uses the approved PIB output plus Data Pond, DataForSEO, BI workbooks, availability, search, reputation, and operational context to explain why performance is low and what actions should follow, while the detailed PIB sections remain below as supporting evidence.

## When To Use

Use this format when the user asks for:

- a full PIB plus evaluation on an underperforming site
- a deep site-performance read
- reasons for low property performance
- actionable site/search/paid/local/reputation recommendations tied to a PIB
- a DataForSEO-informed property evaluation

## Non-Negotiable Boundaries

- Generate or reuse the canonical PIB first when the request is PIB-scoped.
- Do not create a parallel PIB renderer, alternate PIB template, or one-off PIB report family.
- Preserve the approved PIB artifact. The evaluation is an intro synthesis inside the canonical PIB, not a replacement report family.
- Resolve property identity through `Data_Collection/utils/property_identity.py` and `config/property_identity_matrix.json`.
- If Google Ads API rows are missing but BI spend/conversion rows exist, state that distinction plainly.
- Do not infer detailed paid keyword, click, device, campaign, or unit-type targeting quality unless current Google Ads API detail exists.
- Use DataForSEO as source evidence for market demand, SERP visibility, OnPage signals, Google Business Profile/business data, and AI visibility where available.

## Required Source Stack

Minimum source sequence:

1. Property identity matrix: property code, GA4 id, GSC URL, website URL, region, community id.
2. Canonical PIB payload and HTML.
3. Data Pond property diagnostic or VP retrieval JSON where available.
4. BI source performance, cost-per-conversion, monthly ad spend, box score, and operating/readiness rows.
5. Unit availability and floorplan pressure.
6. GSC query mix, especially branded vs nonbrand split.
7. DataForSEO keyword demand, ranked keywords, OnPage, business profile, and AI visibility packet.
8. GBP/Reputation.com/review sentiment and recent low-star context.
9. Existing Captain/Watchlist outputs only as supporting prior diagnosis, not as a substitute for current evidence.

## Output Shape

The final user-facing evaluation should be concise, decisive, and evidence-led. Recommended structure:

### Bottom Line

One to three sentences naming the core diagnosis. Example pattern:

> This is not a pure demand problem. Demand is present or improving; the issue is conversion yield, exposed inventory, and message-fit.

### Main Reasons

Numbered, source-backed reasons. Keep each item short, with the evidence in the first or second sentence.

Recommended lanes:

1. Demand vs occupancy/exposure mismatch.
2. Funnel leakage after interest.
3. Organic search mix: branded/address vs nonbrand.
4. Paid-media evidence quality: API detail vs BI fallback.
5. Floorplan-specific availability pressure.
6. Mobile/site conversion friction.
7. Reputation/product friction that affects conversion confidence.

### Actionable Moves

Numbered actions that map directly to the reasons. Each should be operationally executable.

Recommended actions:

1. Paid search account-level audit/backfill if API detail is stale or missing.
2. Shift paid, website, GBP, social, and leasing follow-up to exposed floorplans.
3. Build nonbrand SEO around obtainable long-tail intent from DataForSEO.
4. Audit mobile leasing path from ad/search click to floorplan, tour, quote, application, and form submit.
5. Run daily source-to-visit-to-PQ follow-up until the gap shrinks.
6. Use reputation strengths defensively and address repeated friction themes.
7. Verify ready-unit/product readiness for the exact homes being advertised.

## Style Rules

- Be executive-readable and direct.
- Do not bury the diagnosis under long methodology.
- Use numbers only where sourced.
- Separate what is known from what is not known.
- Prefer "this means / do this next" over raw tables.
- Avoid generic SEO or marketing advice that is not tied to property evidence.
- Avoid claiming a channel is failing solely because a KPI is low; explain the source and funnel step.

## Grand Harbor Precedent

For The Cape at Grand Harbor / `TX4GH`, the approved read was:

- Not a pure demand problem.
- Sessions, guest cards, and conversion intent were up or healthy.
- Occupancy/exposure and T30 closing were weak.
- Organic visibility was branded/address-heavy, with weak nonbrand capture.
- Google Ads spend existed in BI workbooks, but current Google Ads API keyword/click/device detail was missing from the PIB window.
- Floorplan pressure was concentrated in Chesapeake, Bristol, and Mystic.
- Mobile performance and form-start-to-submit behavior warranted conversion-path review.
- Reputation was usable but value/parking friction themes mattered for conversion confidence.

Future PIB Site Evaluations should reuse this reasoning style and section discipline unless the user explicitly requests a different artifact.
