# Portfolio Resi Edge Stabilization SOP

Status: Draft setup standard
Date: 2026-07-09
Owner: MarketingOps / Property Analytics

## Purpose

This SOP governs the portfolio-wide performance stabilization layer for new Resi property sites. The system is designed to sit in front of individual Resi/YOOtheme sites with Cloudflare, reduce manual builder work, and keep the native site as the content source of record.

The operating goal is consistent high-90s desktop PSI and 90+ mobile PSI while preserving property content, CTAs, SEO, accessibility, and analytics continuity.

## Scope

Initial scope:

- 85 new Resi sites using the original Resi/YOOtheme property template.
- 5 Pilot sites already live or controlled for proof work.
- Champion's Green / `GA4CG` as the first original-template setup subject.

Out of scope for the first setup:

- Mutating WordPress builder content.
- Replacing the native CMS.
- Building a second marketing site.
- Changing locked PIB report generation, rendering, or delivery paths.

## System Split

### Individual Site Responsibilities

The site remains responsible for:

- Correct property facts and copy.
- Correct tour, apply, find-home, phone, social, and specials links.
- Correct hero and section imagery as source material.
- Correct legal/disclaimer/specials content.
- Accessibility and SEO source correctness.
- Content QA and final business approval.

The site team should not need to hand-tune every performance setting in YOOtheme for the portfolio rollout.

### Edge Responsibilities

Cloudflare owns repeatable performance controls:

- Anonymous full-page HTML cache with device-aware variants.
- Mobile first-viewport shell/topper when the native mobile render path is unstable.
- Native desktop guardrails for original-template sites.
- Edge-owned promo bar when the native promo/dropbar causes layout shift.
- DAM/source image replacement with optimized R2 assets.
- Mobile hero portrait crop delivery.
- Noncritical JavaScript deferral or idle loading.
- Known YOOtheme/UIkit layout shift guards.
- Analytics queue/replay for shell interactions.
- Playwright/PSI validation evidence.

## R2 Image Asset Strategy

R2 is the portfolio asset authority for optimized derivatives.

Source images remain in the site/DAM. The Data Pond or discovery job records source image URLs and their page/section roles. An optimizer generates derivatives and stores them in R2. The Worker rewrites source URLs to R2 asset URLs according to a property manifest.

### R2 Key Pattern

Use stable, property-scoped keys:

```text
resi-edge-assets/{propertyCode}/home/hero-mobile-750x1000.avif
resi-edge-assets/{propertyCode}/home/hero-mobile-750x1000.webp
resi-edge-assets/{propertyCode}/home/hero-desktop-1600.avif
resi-edge-assets/{propertyCode}/home/welcome-640.avif
resi-edge-assets/{propertyCode}/home/features-900.avif
resi-edge-assets/{propertyCode}/home/amenities-900.avif
```

Public delivery may use an asset hostname such as:

```text
https://assets.venterradev.com/resi-edge-assets/{propertyCode}/...
```

The exact hostname can be changed later without changing the manifest contract.

### Mobile Hero Crop Standard

Default hero crop strategy is center-out portrait crop.

Most Resi/Venterra hero subjects are centered, so the optimizer should:

1. Use the full source height where practical.
2. Crop equal width from left and right to the target portrait aspect ratio.
3. Resize to the target mobile dimensions.
4. Generate AVIF first and WebP fallback.
5. Escalate to review only when heuristic checks flag poor crop quality.

Default mobile hero target:

- `750 x 1000`
- aspect ratio `3:4`
- `loading=eager`
- `fetchpriority=high`
- explicit width and height in shell markup

Allowed override:

- focal point crop
- explicit crop box
- alternate target size when visual QA requires it

## Property Manifest Contract

Each property gets a generated manifest. The manifest is data, not code.

Required fields:

- canonical property code
- hostnames
- template class
- page routes in scope
- mobile and desktop mode
- R2 asset base
- hero source and derivatives
- image rewrite map
- promo ownership and content
- CTA URLs
- analytics mode
- validation requirements

Template class values:

- `resi-original-yootheme-v1`
- `pilot-overlay-yootheme-v1`
- future values must be added explicitly after audit

## Runtime Modes

### Mobile

Default for original-template portfolio rollout:

- `edge-shell`
- render stable promo/header/hero/CTA/reviews first
- use R2 mobile hero crop
- load native page continuation after interaction, scroll, load, or idle
- queue and replay analytics events

### Desktop

Default for original-template portfolio rollout:

- `native-with-guards`
- keep native desktop page
- use full-page cache
- edge-own promo if native promo creates CLS
- rewrite large images to R2 derivatives
- defer known noncritical scripts
- avoid full desktop static shell unless desktop cannot reach high 90s through lighter controls

## Champion's Green Pilot Procedure

1. Resolve property identity through the governed matrix by `GA4CG`.
2. Capture baseline:
   - mobile and desktop PSI
   - Playwright mobile and desktop screenshots
   - cache headers
   - hero/promo/image/CTA DOM inventory
   - layout shift sources
3. Generate dry-run R2 asset plan:
   - center-out mobile hero crop
   - desktop hero derivative if needed
   - welcome/features/amenities derivatives
   - shared benefits derivatives when they materially affect PSI
4. Create property manifest.
5. Run edge preview only:
   - no production traffic change
   - query-gated or preview-host gated
   - server timing markers required
6. Validate:
   - PSI mobile exact and fresh
   - PSI desktop exact and fresh
   - Playwright screenshots
   - CTA clicks
   - analytics queue/replay
   - SEO/accessibility sanity
7. Only after approval, promote the manifest to active.

## Success Criteria

Portfolio target:

- mobile PSI: `90+`
- desktop PSI: high `90s`
- CLS: under `0.05`
- LCP mobile: under `3.0s` target
- LCP desktop: under `1.5s` target
- no broken CTAs
- no duplicate pageviews
- no lost CTA/promo/menu/tour/apply analytics events
- no visual mismatch in the first viewport

## Rollback Requirements

Every active property must support:

- manifest disable
- mobile shell disable
- desktop guards disable
- image rewrite disable
- promo ownership disable
- cache version bump
- Cloudflare cache purge

The rollback path must not require WordPress changes.

## Evidence Packet

Each property setup must produce:

- baseline PSI JSON
- preview PSI JSON
- before/after screenshots
- manifest
- image inventory
- generated asset inventory
- CTA validation result
- analytics validation result
- promotion/rollback note

## Champion's Green Prototype Status - 2026-07-10

- R2 bucket `resi-edge-assets` was created for the portfolio asset lane.
- Champion's Green q64 image derivatives were generated locally and uploaded to remote Cloudflare R2 under `resi-edge-assets/GA4CG/` and `resi-edge-assets/shared/`.
- The correct Keeper notation for Wrangler R2 object work is `keeper://3eLgyrNIvR_N_Bl809aAcg/custom_field/Token Value`. The Keeper password field is the R2 S3 secret key and is not valid for Wrangler's Cloudflare API-token path.
- The Worker lives at `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/` and is routed to `championsgreen-ga.com/*`.
- The custom-domain route is query-gated: mobile `https://championsgreen-ga.com/?edge_preview=1` serves the edge shell; ungated traffic remains native Kinsta/Resi.
- Remote workers.dev preview remains available at `https://portfolio-resi-edge-prototype.mlaufhutte.workers.dev/`.
- The polished v8 deployment is Worker `1cd224d8-2e57-48b5-bdba-777e8f0763f0`, cache version `2026-07-10-mobile-shell-v8-award`.
- `/health` now includes template config validation and must return `config.ok: true` before any additional property is promoted to query-gated preview.
- Polished v8 evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-polished-v7/POLISHED_V8_READOUT.md`.
- Route deploy token is the main Cloudflare token resolved by `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`; the earlier prototype token does not have custom-domain route permissions.
