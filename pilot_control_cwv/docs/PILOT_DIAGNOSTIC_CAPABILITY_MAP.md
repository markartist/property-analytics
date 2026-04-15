# Pilot Diagnostic Capability Map

This document maps the existing Property Analytics systems to the pilot-property
diagnostic question:

> Why is Calais behaving more cleanly than District and Harrison, and are the
> weaker properties suffering from discoverability loss, attribution breakage,
> structural SEO changes, or some combination of the three?

The goal is to reuse the existing data stack instead of inventing a new one.

## Core Question Stack

We need to answer five distinct questions:

1. Are users actually discovering the sites in Google less often?
2. Are organic visits being misclassified after landing on the site?
3. Are technical performance differences large enough to explain the traffic pattern?
4. Are the critical user journeys operationally broken?
5. Are there structural template/crawl/index differences between Calais and the weaker sites?

## Existing Systems We Already Have

### 1. Google Search Console

Tables:
- `gsc_daily_metrics`
- `gsc_queries`
- `gsc_url_inspection`

What it answers:
- Are impressions/clicks down?
- Are average rankings worse?
- Are query patterns changing?
- Are URLs indexed, discoverable, and canonically stable?

Best use in this investigation:
- Compare Calais vs District vs Harrison on:
  - clicks
  - impressions
  - CTR
  - average position
  - query mix
  - URL inspection/indexation state

Interpretation:
- If GSC drops alongside organic-share drops, that supports a real discoverability/indexation issue.
- If GSC is stable but GA4/Heap organic drops, that points toward attribution/session-classification issues.

Important caveat:
- GSC has an inherent lag of roughly 3 days in this system.

### 2. GA4

Tables:
- `ga4_daily_metrics`
- `ga4_traffic_sources`
- `ga4_device_metrics`
- `ga4_event_facts`

What it answers:
- Are total users and new users moving?
- Is source mix shifting from Organic to Direct/Referral/Paid?
- Are device patterns changing?
- Are conversion-entry behaviors changing?

Best use in this investigation:
- Compare Calais vs District vs Harrison on:
  - new users
  - sessions
  - organic sessions
  - direct sessions
  - referral sessions
  - device mix
  - event volumes tied to conversion behaviors

Interpretation:
- Organic down + Direct/Referral up is a strong attribution warning.
- Organic down + total down + GSC down is a stronger discoverability warning.

### 3. PageSpeed / PSI / GTMetrix

Tables:
- `pagespeed_metrics`
- `pilot_control_psi_metrics`
- `gtmetrix_metrics`

What it answers:
- Are the weak sites substantially slower or less healthy than Calais?
- Are there CWV regressions large enough to act as a ranking headwind?

Best use in this investigation:
- Compare:
  - PSI performance score
  - LCP
  - CLS
  - TTFB
  - GTMetrix score

Interpretation:
- This is useful for quantifying background drag.
- It is not sufficient by itself to explain extreme and split-pattern organic volatility.

### 4. BrowserStack / EVS

Artifacts:
- `evs/reports/*.json`
- `pilot_roundup/reports/Pilot_Performance_Roundup_*.md`

What it answers:
- Do the critical journeys function in real browsers/devices?
- Are CTA handoffs present?
- Are there JS/runtime/network/image failures?

Best use in this investigation:
- Confirm operational health of:
  - homepage
  - apartments listing
  - unit detail
  - core CTA flow

Interpretation:
- BrowserStack can rule out obvious live-site breakage.
- It cannot, by itself, rule out SEO/indexation or attribution problems.

### 5. Comparator Crawl / Structural Audit

Artifacts:
- `pilot_control_cwv/scripts/run_calais_comparator_audit.py`
- `pilot_control_cwv/reports/calais_comparator_audit_2026-04-07.*`

What it answers:
- Are common page templates reachable?
- Do they self-canonicalize correctly?
- Are common sitemap/nav pages present?
- Are there differences in internal-link footprint, especially on apartments/floorplan pages?

Best use in this investigation:
- Compare Calais vs District vs Harrison on:
  - canonical tags
  - robots/meta
  - page-sitemap coverage
  - shared-nav page availability
  - apartments/floorplan link footprint
  - discovered unit-detail behavior

Current takeaway:
- Shared nav/sitemap pages are structurally similar.
- The most notable current structural difference is the apartments/floorplan layer.

### 6. PIB Logic and Existing Synthesis Work

Read-only sources:
- `Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `pilot_roundup/scripts/generate_pilot_roundup.py`

What they already know how to do:
- summarize GA4 trends
- summarize GSC trends
- summarize PageSpeed/PSI
- express freshness/lag
- identify source mix and primary traffic driver patterns

Use in this investigation:
- Reuse logic and query patterns as references
- Do not modify locked PIB files without explicit user approval

## What We Can Prove Right Now

### We can already prove

- The critical user journeys are operationally passing in BrowserStack/EVS for Calais, District, and Harrison.
- The top-level nav/page-sitemap structure is not obviously broken on District or Harrison.
- Calais, District, and Harrison all canonicalize correctly at the property-domain level.
- The apartments/floorplan layer is a more likely structural-difference zone than the common nav pages.
- We have enough GA4, GSC, PSI, GTMetrix, and crawl data to build a cross-source comparison.

### We cannot yet prove without deeper analysis

- Whether Calais has materially stronger GSC impressions/clicks/rank behavior than District/Harrison on equivalent dates.
- Whether District/Harrison organic declines are being reclassified into Direct/Referral in GA4.
- Whether rendered head tags, canonicals, or link modules differ on apartments/unit-detail templates after hydration.
- Whether URL inspection/indexation states differ materially by property.

## Best Diagnostic Sequence

### Phase 1. Discoverability Check

Use:
- `gsc_daily_metrics`
- `gsc_queries`
- `gsc_url_inspection`

Questions:
- Are clicks/impressions down for District/Harrison relative to Calais?
- Are rankings weaker?
- Do they have different indexed/discovered states?

If yes:
- Structural SEO/indexation becomes the lead hypothesis.

### Phase 2. Attribution Check

Use:
- `ga4_traffic_sources`
- `ga4_daily_metrics`
- BrowserStack navigation behavior

Questions:
- Are organic sessions/users down while Direct/Referral rises?
- Is Calais more stable in source mix than District/Harrison?

If yes:
- Attribution/session-classification becomes a leading parallel hypothesis.

### Phase 3. Performance Check

Use:
- `pilot_control_psi_metrics`
- `pagespeed_metrics`
- `gtmetrix_metrics`

Questions:
- Are District/Harrison materially worse than Calais?
- Are the differences large enough to explain the traffic divergence?

Expected result:
- likely a secondary headwind, not the sole cause.

### Phase 4. Structural Template Diff

Use:
- comparator crawl outputs
- BrowserStack rendered behavior

Questions:
- Does Calais have stronger apartments/floorplan linking?
- Are there canonical, robots, or rendered-content differences on those templates?

## Recommended Immediate Deliverables

1. Cross-source Calais/District/Harrison diagnostic matrix
   - GSC
   - GA4
   - PSI/GTMetrix
   - BrowserStack
   - structural crawl

2. Apartments/floorplan deep-diff
   - apartments listing
   - one real unit-detail page
   - rendered head/link/module comparison

3. Attribution sanity check
   - compare Organic vs Direct vs Referral shifts over the same dates

## Bottom Line

We already have enough infrastructure to answer most of the question without
building anything new:

- GSC tells us whether discoverability actually fell.
- GA4 tells us whether traffic attribution/source mix shifted.
- PSI/GTMetrix tell us whether performance is a background drag.
- BrowserStack tells us the journeys still work.
- The comparator audit tells us where structural template differences are most likely to matter.

The highest-value next deliverable is a single cross-source Calais vs District vs
Harrison findings matrix that combines those systems into one diagnostic view.
