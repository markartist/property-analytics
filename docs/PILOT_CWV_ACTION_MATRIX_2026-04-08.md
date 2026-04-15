# Pilot CWV Action Matrix

Date: 2026-04-08
Scope: 5 pilot live sites
Inputs:
- Dedicated pilot PSI mobile metrics from `pilot_control_psi_metrics`
- GTmetrix daily metrics from `gtmetrix_metrics`
- Daily pilot evaluator outputs

## Executive Read

The pilot cohort has a shared mobile performance problem, not five unrelated problems.

Primary pattern:
- PSI mobile scores are low: 56 to 66
- LCP is the dominant issue on 4 of 5 sites: 10.17s to 10.82s
- Ventana is different: LCP is still high at 3.75s, but its bigger issue is JavaScript and main-thread work
- Shared CSS and shared third-party JS appear repeatedly across the cohort
- Payload is heavy on every homepage: 2.5MB to 3.1MB and about 50 requests

Operational conclusion:
- The highest-value work is a shared platform CWV pass on homepage rendering, script loading, and theme assets
- After that, do a short property-specific cleanup pass for hero/media differences and any property-specific third-party tools

## Current Diagnostic Snapshot

| Property | PSI Mobile | LCP | TTFB | TBT | Page Weight | Requests | Main Thread | Biggest JS Waste |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Calais Midtown | 60 | 10.17s | 5.0s | 58.5ms | 2.74MB | 52 | 1794ms | `gtag.js` 428KB |
| Champions Green | 56 | 10.23s | 5.0s | 396ms | 2.74MB | 50 | 2450ms | `Contentsquare` 305KB |
| District Universal | 59 | 10.19s | 7.0s | 104ms | 2.50MB | 51 | 1891ms | `gtag.js` 293KB |
| The Harrison | 56 | 10.82s | 14.0s | 204ms | 2.86MB | 51 | 1813ms | `gtag.js` 423KB |
| Ventana | 66 | 3.75s | 13.0s | 687.5ms | 3.10MB | 52 | 3393ms | `gtag.js` 409KB |

Shared CSS waste:
- All 5 sites show about 31KB to 36KB of unused CSS from the shared `theme.1.css`

## Prioritized Action Matrix

| Priority | Workstream | Action | Why It Matters | Applies To | Owner | Est. Impact |
|---|---|---|---|---|---|---|
| P0 | Homepage Rendering | Replace homepage hero carousel/video-first paint with a single static first-paint hero on mobile | LCP is the dominant failure on 4 sites | Platform-wide pattern, then site QA per property | Resi platform + frontend | Very High |
| P0 | Images | Identify the true LCP asset and preload it; do not lazy-load it; serve mobile-sized WebP/AVIF variants | Largest direct lever on LCP | All 5 pilots | Frontend + CMS/content | Very High |
| P0 | Third-Party JS | Delay nonessential analytics/session replay until consent, idle, or post-interaction | Repeated high wasted JS across cohort | All 5, especially Champions and Harrison | Analytics engineering + frontend | High |
| P0 | Theme Assets | Split critical vs noncritical CSS; inline critical homepage CSS and defer the rest | Shared unused CSS across all pilots | Shared resi theme | Frontend/platform | High |
| P1 | Server/Origin | Investigate homepage backend and caching path; reduce TTFB | Harrison and Ventana have especially high TTFB | Harrison, Ventana, District | Hosting/platform | High |
| P1 | JS Execution | Reduce main-thread work by deferring homepage widgets and below-the-fold modules | Ventana and Champions are paying the highest JS execution cost | All 5, especially Ventana | Frontend/platform | High |
| P1 | Payload Budget | Cut homepage byte weight under 2MB as first milestone | All pilots are too heavy | All 5 | Frontend + content | Medium-High |
| P1 | Tag Governance | Audit GTM container contents; remove duplicate, legacy, or low-value tags | `gtag.js` waste and likely over-tagging | 4 of 5 directly, likely all | Analytics engineering | Medium-High |
| P2 | CSS Hygiene | Remove dead theme selectors and page-wide CSS that does not belong on homepage | Shared waste is measurable but smaller than JS/LCP | Shared theme | Frontend/platform | Medium |
| P2 | Page Composition | Move below-the-fold amenities, reviews, maps, and heavy embeds out of first render path | Reduces requests and CPU on initial load | All 5 | Frontend + content | Medium |

## Platform-Wide Action Plan

### 1. Homepage Hero Strategy

Objective:
- Get the first meaningful above-the-fold paint under control

Actions:
- On mobile, render one static hero image first
- Remove autoplay video or multi-slide hero from initial load
- Use explicit width and height on hero image
- Preload the actual LCP image
- Exclude the LCP image from lazy loading
- Serve a much smaller mobile asset than desktop

Success target:
- LCP under 3.0s on all pilots

### 2. Third-Party Script Governance

Objective:
- Cut wasted JS and main-thread execution

Actions:
- Audit all GTM tags firing on homepage
- Delay nonessential analytics until idle or consent
- Delay session replay tools
- Delay chat, maps, heatmaps, A/B tools, and noncritical remarketing pixels
- Load only the minimum pageview stack on first paint

Success target:
- Reduce wasted JS by 150KB to 250KB on each pilot

### 3. Shared Theme Optimization

Objective:
- Turn one optimization pass into a win for every pilot

Actions:
- Extract homepage critical CSS
- Defer the remainder of `theme.1.css`
- Remove dead selectors from shared theme
- Audit shared JS bundles and homepage modules
- Defer below-the-fold components

Success target:
- Reduce CSS waste by 20KB+
- Reduce main-thread work materially across the cohort

### 4. Homepage Payload Budget

Objective:
- Stop shipping 2.5MB to 3.1MB homepages to mobile users

Actions:
- Set homepage budget: target under 2MB first, then under 1.5MB
- Compress hero and decorative imagery
- Remove unnecessary homepage assets
- Reduce request fanout from optional modules

Success target:
- Homepage page weight under 2MB
- Request count below 40 to 45 where feasible

## Property-Specific Actions

### Calais Midtown

Primary issue:
- Severe LCP despite low TBT

Interpretation:
- This looks more like render path / hero / asset loading than a JavaScript-execution-only problem

Actions:
- Audit hero image delivery and preload behavior
- Confirm no slider/video or delayed CSS is blocking above-the-fold render
- Reduce `gtag.js` first-load cost if possible

### Champions Green

Primary issue:
- Severe LCP plus meaningful JS execution cost

Interpretation:
- This site likely needs both hero optimization and third-party trimming

Actions:
- Delay `Contentsquare`
- Audit homepage modules initializing before interaction
- Optimize mobile hero and above-the-fold image delivery

### The District Universal Boulevard

Primary issue:
- Severe LCP with moderate JS overhead

Interpretation:
- Similar to Calais: likely dominated by render path and asset delivery

Actions:
- Audit hero/LCP element
- Reduce homepage payload
- Trim GTM first-load work

### The Harrison

Primary issue:
- Worst LCP in the cohort and worst TTFB

Interpretation:
- This is likely a combined origin/render problem

Actions:
- Investigate cache behavior and origin response
- Audit homepage hero delivery
- Trim GTM/analytics startup

### Ventana

Primary issue:
- Better LCP than peers, but still failing; very high TBT and main-thread work

Interpretation:
- Ventana is the clearest JS-execution problem in the cohort

Actions:
- Audit all homepage JavaScript modules and third-party tags
- Defer noncritical scripts aggressively
- Simplify homepage components that initialize on first render
- Reduce payload and request chain length

## Recommended Execution Sequence

### Phase 1: Shared Platform Pass

Do once across the resi theme/platform:
- hero rendering rules for mobile
- LCP image preload rules
- third-party tag gating/delay strategy
- critical CSS extraction
- homepage payload budget

Expected result:
- biggest cohort-wide gain with the least duplicated work

### Phase 2: Pilot Homepage Cleanup

Do per pilot:
- optimize hero assets
- remove property-specific heavy media
- confirm third-party stack differences
- validate homepage-only regressions

Expected result:
- close the remaining site-specific gap after shared fixes land

### Phase 3: Re-Measure and Tighten

After Phase 1 and Phase 2:
- rerun daily evaluator
- compare PSI, LCP, TBT, and payload
- track which fixes moved the numbers and which did not

## Suggested Owners

| Area | Recommended Owner |
|---|---|
| Shared theme CSS/JS optimization | Resi platform/frontend |
| GTM and analytics script governance | Analytics engineering / marketing ops |
| Hero image production and media compression | Content/CMS + frontend |
| TTFB/caching investigation | Hosting/platform |
| Pilot verification and regression testing | Property analytics + QA |

## Success Metrics

First milestone:
- all pilots above PSI 75 mobile
- LCP under 4.0s on all pilots

Target state:
- all pilots above PSI 85 mobile
- LCP under 2.5s
- TBT under 200ms
- homepage payload under 2MB

## Immediate Next Steps

1. Open a shared resi-theme CWV task for hero rendering, CSS splitting, and script deferral.
2. Open a GTM/analytics audit task for the pilot homepage tag stack.
3. Open a pilot-specific media cleanup task for the 5 homepage heroes.
4. Use the daily evaluator to measure improvement after each release wave.
