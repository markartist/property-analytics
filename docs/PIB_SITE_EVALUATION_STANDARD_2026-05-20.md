# PIB Site Evaluation Standard

Status: Approved working standard
Date: 2026-05-20
Owner: WebOps / Property Analytics
Seed example: The Cape at Grand Harbor / `TX4GH`

## Purpose

`PIB Site Evaluation` is the approved synthesis format for presenting a property website and leasing-funnel evidence read inside the canonical PIB.

It is not a new PIB renderer, template, or sender. With explicit approval on 2026-05-20, it is the executive intro block for property-level PIB v2.2.0 reports when evaluation evidence is available. With explicit approval on 2026-07-01, the section standard was tightened to be factual, evidence-led, and non-prejudicial: the intro uses the approved PIB output plus Data Pond, DataForSEO, BI workbooks, availability, search, reputation, and operational context to show what the data supports, what it does not prove, and what follow-up checks are warranted. The detailed PIB sections remain below as supporting evidence.

## When To Use

Use this format when the user asks for:

- a full PIB plus evaluation on a property site or leasing funnel
- a deep site-performance read
- source-backed evidence behind property performance
- actionable site/search/paid/local/reputation follow-up checks tied to a PIB
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
9. Existing Captain/Watchlist outputs only as supporting prior analysis, not as a substitute for current evidence.

## Output Shape

The final user-facing evaluation should be concise, factual, and evidence-led. It should help executives and operators understand the source record without overstating causality. Recommended structure:

### What The Data Shows

One to three sentences summarizing the current evidence packet and the major observed signals. This is not a root-cause verdict unless the source data proves cause. Example pattern:

> This is an evidence read for the property, not a root-cause verdict. Current PIB, Data Pond, DataForSEO, GSC, availability, page-readiness, and reputation signals are placed side by side so the team can see what is supported and where follow-up is still needed.

### Observed Evidence

Numbered or row-based source-backed observations. Keep each item short, with the source evidence in the first or second sentence. Do not convert an observed metric into a cause unless the packet contains causal evidence.

Recommended lanes:

1. DataForSEO outside-in search market evidence: demand rows, ranked keywords, SERP/local/AI visibility where available.
2. Owned search mix: branded/address vs nonbrand GSC query behavior.
3. Leasing-funnel facts: guest cards, quotes, applications, visits, leases, and source rows where present.
4. Paid-media evidence quality: Google Ads API detail versus BI fallback evidence.
5. Floorplan availability and inventory context.
6. Mobile/site readiness: PSI, DataForSEO OnPage, and page-health evidence.
7. Reputation/local confidence: GBP/review themes and Reputation.com rows where available.

### Recommended Follow-Up Checks

Numbered checks that map directly to the observations. Each should be operationally executable and framed as verification when the current packet does not prove cause.

Recommended checks:

1. Verify Google Ads tracking/API detail before making spend, keyword-quality, device, or targeting claims.
2. Compare floorplan-level availability, specials, and landing-page copy before changing traffic strategy.
3. Use DataForSEO keyword demand, ranked keywords, and SERP evidence as candidate nonbrand SEO inputs, then validate against GSC owned-search clicks and property leasing priorities.
4. Check the mobile leasing path from search/ad landing to quote, tour, phone, and apply actions, using PSI and DataForSEO OnPage as technical evidence rather than assumed cause.
5. Review source-to-visit-to-quote/application movement by channel so the report can separate traffic availability, lead quality, follow-up, pricing, and inventory constraints.
6. Use review themes as operational context only where the data shows repeatable patterns.
7. Verify ready-unit/product readiness for the exact homes being advertised or emphasized.

## Style Rules

- Be executive-readable and direct.
- Do not bury the evidence read under long methodology.
- Use numbers only where sourced.
- Separate what is known from what is not known.
- Prefer "what this shows / what to check next" over raw tables.
- Avoid generic SEO or marketing advice that is not tied to property evidence.
- Avoid claiming a channel is failing solely because a KPI is low; explain the source and funnel step.
- Do not claim demand is weak, conversion is broken, paid search is mismanaged, or reputation is causing loss unless the evidence directly supports that statement.
- Treat DataForSEO as a required outside-in evidence lane for market demand, SERP visibility, OnPage readiness, local entity data, and AI visibility where rows exist.
- Use neutral language: "observed," "available evidence," "current packet," "follow-up check," and "source rows show."
- Avoid attack-stance wording such as "the problem is," "the property is failing," or "this explains why" unless supported by direct source evidence.

## Grand Harbor Precedent

For The Cape at Grand Harbor / `TX4GH`, the prior approved read found:

- Demand evidence existed and needed to be read alongside occupancy, exposure, and conversion evidence.
- Sessions, guest cards, and conversion intent were up or healthy.
- Occupancy/exposure and T30 closing were weak.
- Organic visibility was branded/address-heavy, with weak nonbrand capture.
- Google Ads spend existed in BI workbooks, but current Google Ads API keyword/click/device detail was missing from the PIB window.
- Floorplan pressure was concentrated in Chesapeake, Bristol, and Mystic.
- Mobile performance and form-start-to-submit behavior warranted conversion-path review.
- Reputation was usable but value/parking friction themes mattered for conversion confidence.

Future PIB Site Evaluations should reuse the source discipline, not the property-specific conclusions. The 2026-07-01 standard supersedes any wording that reads as a prejudicial verdict; future intros should present observed evidence and recommended follow-up checks unless the user explicitly requests a different artifact.
