# Portfolio Resi Edge Stabilization SOP

Status: Historical foundation; current execution is controlled by `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`
Date: 2026-07-09
Owner: MarketingOps / Property Analytics

Active companion system:

- `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_MIGRATION_SYSTEM_2026-08-06.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_CASE_STUDY_2026-08-06.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`

When this SOP and newer Resi Edge records differ, use the 08/09/2026 reconciliation record. Do not use this historical SOP to justify Champions as a prototype or first apply target.

08/11/2026 execution lock: current live execution is controlled by `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` and the current memory entry in `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`. The runner is the process. A property is not live-upgraded unless that runner completes `apply --require-live-proof` with every required gate passing or a written approved exception. If a live proof gate fails, the only acceptable action is rollback if mutation occurred, evidence writeout, and stop for discussion.

08/10/2026 supersession: Champions Green is now the current full-functioning base reference only through the fresh runbook-controlled manifest `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`. The historical Champion's Green prototype section below remains non-authoritative and must not be copied, promoted, or used as proof of the package.

## Purpose

This SOP governs the portfolio-wide performance stabilization layer for new Resi property sites. The system is designed to sit in front of individual Resi/YOOtheme sites with Cloudflare, reduce manual builder work, and keep the native site as the content source of record.

The operating goal is consistent high-90s desktop PSI and 90+ mobile PSI while preserving property content, CTAs, SEO, accessibility, and analytics continuity.

## Scope

Historical initial scope:

- 85 new Resi sites using the original Resi/YOOtheme property template.
- 5 Pilot sites already live or controlled for proof work.
- `pilot.venterradev.com` as the earlier first apply target after TowneStone/The Vine reference replay. This is superseded by the current 08/10/2026 Champions-base control unless Mark separately selects Pilot as an apply target.

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

### Analytics Ownership Gate

Before a property can be judged as optimized or promoted beyond preview, analytics ownership must be audited explicitly.

08/06/2026 portfolio rule: analytics is Zaraz-first from this point forward. GA4, delayed Heap/Contentsquare, Ahrefs Web Analytics, and Resi event forwarding should be configured in Cloudflare Zaraz by default. Cloudflare analytics must also be captured in the migration evidence package through edge analytics readback and Cloudflare Web Analytics/RUM enabled-state proof when applicable.

Required checks:

1. Inspect rendered live and preview HTML for native `googletagmanager`, `gtag/js`, GTM noscript, Heap debug/bootstrap snippets, duplicate GA4 loaders, Resi pixel loaders, and other first-view analytics scripts.
2. Decide the analytics owner for the property:
   - Required launch pattern unless excepted: Cloudflare Zaraz owns GA4, delayed Heap/Contentsquare, Ahrefs when applicable, and the Resi event bridge.
   - Any exception must be written in the package readout before PSI comparison is treated as meaningful.
3. If Zaraz is the owner, migrate the tools and event bridge before final PSI scoring:
   - configure GA4, Heap, Ahrefs if applicable, and Resi event forwarding in Zaraz
   - remove equivalent GTM/gtag/Heap snippets from WordPress custom scripts
   - flush Kinsta and Cloudflare caches
   - verify no GTM network traces, no duplicate pageviews, successful Zaraz posts, GA4 realtime, Heap continuity, Ahrefs request/tool proof, and CTA events
   - attach Cloudflare edge analytics readback and Cloudflare Web Analytics/RUM state proof once the domain is live on Cloudflare
4. Record the result as a first-class package requirement, not as a late promotion note.

Performance comparisons are not final when native analytics ownership is unresolved, because direct WordPress/GTM analytics can dominate desktop TBT and JavaScript weight.

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

The `edge-shell` mode means a standalone mobile shell. It does not mean a topper injected into the full native WordPress document. Integrated native mobile transforms are not approved for the 90+ mobile package unless Mark explicitly approves that exception before implementation.

### Desktop

Default for original-template portfolio rollout:

- `native-with-guards`
- keep native desktop page
- use full-page cache
- edge-own promo if native promo creates CLS
- rewrite large images to R2 derivatives
- defer known noncritical scripts
- avoid full desktop static shell unless desktop cannot reach high 90s through lighter controls

## Locked Resi Edge Package Procedure

This ordered procedure is mandatory for every new property package. Do not reorder it unless Mark explicitly approves an exception in the package readout.

### 08/11/2026 Non-Deviable Automation Sequence

Use this current sequence for any selected target. Lower historical sections are retained as background and may not be used to bypass this sequence.

1. Resolve governed identity and load the property manifest.
   - Identity must resolve through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
   - The manifest must pass `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-manifest.schema.json`.
   - No local one-off property map, hardcoded property bundle, or inferred identity is allowed.
2. Prove plan mode before staged setup.
   - Command: `python3 scripts/run_resi_edge_upgrade.py --property-code PROPERTY_CODE --domain DOMAIN --mode plan`
   - Plan must report `stage_allowed:true` for the selected target.
   - Plan must report `apply_allowed:false`; live apply is not allowed until stage passes.
   - Protected base references must remain non-mutating and report `apply_allowed:false`.
3. Prove staged setup before route probe or Worker deploy.
   - Command: `python3 scripts/run_resi_edge_upgrade.py --property-code PROPERTY_CODE --domain DOMAIN --mode stage`
   - Stage owns canonical asset generation/upload, governed Zaraz analytics package setup, and generated deploy-bundle closure proof.
   - Do not run the Zaraz package applier as a detached one-off when the staged runner is available.
   - The exact deploy bundle that `apply` will use must pass Wrangler dry-run and include every shared runtime dependency, including the shared consent widget. Missing bundle imports are a stage failure, not an apply-time discovery.
   - Required tools: GA4, Heap, Ahrefs existing project, and Resi event bridge when present in the manifest.
   - Required Heap mode: `interaction_only_queue_v6_input_only_cs_verify_home_204`.
   - The Contentsquare verify suppression path is only `/?vtr_cs_verify_suppressed=1` returning same-origin `204`.
   - Do not inject a manual Zaraz loader. Cloudflare Zaraz auto-injection owns the loader.
4. Audit Zaraz consent and tool purposes.
   - Cloudflare Zaraz CMP must be enabled or explicitly excepted.
   - Required purposes are `Analytics & Performance` and `Marketing & Leasing Attribution`.
   - Enabled Zaraz tools without purpose assignment are a stop condition.
5. Validate source facts before deploy.
   - Specials come from the feed, not from the public Specials page unless Mark approves an exception.
   - Default visible phone is VWS attribution, never office-phone fallback.
   - Incoming URL source ids resolve through the governed source lookup table/read model.
   - Reviews, review link, count, rating, fractional stars, and schema aggregateRating must match the selected authoritative source. If no sourced reviews exist, omit the row and aggregateRating.
   - First-party fonts, brand colors, first two content blocks, awards/badges, CTAs, meta/OG/schema, `llms.txt`, favicon/icons, GSC, Captain, Data Pond, R2 assets, and rollback plan must be explicit.
6. Run the route-interception probe.
   - The temporary route is only `DOMAIN/__resi-edge-route-test*`.
   - It must prove Worker interception on the test route, prove the homepage is untouched, delete the temporary Worker/route, and prove cleanup.
   - Failure stops before full package deploy.
7. Deploy the canonical package only.
   - Use the thin adapter in `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`.
   - Shared runtime is `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs`.
   - Property Workers must not contain custom shell HTML, CSS, analytics snippets, consent UI, phone logic, `llms.txt`, or review rendering.
8. Prove package health and purge/read back.
   - `/__resi-edge/health` must return the canonical package id and target property facts.
   - Cloudflare cache purge must be proven on clean production URLs.
   - R2 same-origin asset readback must pass.
9. Prove live browser behavior before PSI.
   - Mobile initial response is the standalone edge shell: promo if active, header, full-height hero, sourced review row when present, Live Better Live Easy visual without added TM, native-sourced title/subtitle, primary CTA, first content block, required award/badge when present, second content block, lazy native continuation, and approved consent entry point.
   - Desktop remains native passthrough with no mobile shell/topper. Desktop proof requires rendered screenshot and raw/unstyled blue-link failure detection.
   - Lazy continuation must not duplicate shell-owned blocks.
   - Browser proof must cover source-coded phone, menu/promo/CTA basics, consent first-visit/preferences/accept/reject, console failures, and bad responses.
10. Prove SEO, AI, and analytics.
    - `llms.txt` must return `200`, contain one H1, and include real markdown links with absolute live URLs.
    - Meta, canonical, OG, Twitter, icons, sitemap/robots posture, JSON-LD, and stale identity scans must pass.
    - Analytics smoke uses the canonical homepage URL. Do not add synthetic query parameters such as `?pa_live_analytics_smoke=...` unless the domain has an approved WAF bypass.
    - GA4 realtime must accept the manifest stream name and `Website` fallback. Heap/Contentsquare must not load passively and must load only after consent-qualified interaction. Ahrefs must use the existing project/profile declared in the manifest.
11. Prove Cloudflare analytics and PSI.
    - Cloudflare analytics/RUM state must be captured.
    - PageSpeed Insights mobile and desktop must both be `90+` on the live production hostname.
    - PSI is not a substitute for browser proof and must run after browser proof.
    - PSI `500`/no-score is a transient proof condition, not a measured performance failure. The runner may wait and retry the affected strategy only when no score is returned. A real score below `90` is not retried and remains a hard failure.
12. Close the evidence packet.
    - The final packet must include reset card, manifest, plan readout, platform apply/readback, browser proof, screenshots, analytics proof, consent proof, SEO proof, source attribution proof, R2/cache proof, PSI, rollback plan, and Captain/Data Pond readout.
    - If any required gate fails, the packet is a failed packet. The operator stops and reports. No alternate implementation, lookalike Worker, property-specific patch, or second attempt is allowed without Mark's approval.

### Historical Procedure

1. Resolve property identity through the governed matrix.
   - canonical property code
   - community id
   - GA4 property id and measurement id
   - GSC property
   - live hostname and governed Venterra URL
   - phone, address, CTAs, specials, and source imagery
2. Run identity and source-page audit.
   - rendered title/meta/OG/schema
   - stale property names/codes
   - canonical and sitemap URLs
   - phone and CTA destinations
   - live page status and redirects
3. Run analytics ownership gate.
   - inspect live and preview HTML for GTM, `gtag/js`, Heap/Contentsquare, Resi pixel, Ahrefs, and duplicate pageview paths
   - required pattern unless excepted is Zaraz-owned GA4, delayed Heap/Contentsquare, Ahrefs when applicable, and Resi event bridge
   - if native WordPress/GTM analytics remain, do not treat final desktop performance as accepted
   - if Zaraz owns analytics, remove equivalent WordPress scripts, flush caches, and prove Zaraz posts, GA4 realtime, Heap continuity, Ahrefs proof, Cloudflare analytics proof, and CTA events
4. Capture baseline:
   - mobile and desktop PSI
   - Playwright mobile and desktop screenshots
   - cache headers
   - hero/promo/image/CTA DOM inventory
   - layout shift sources
5. Run the architecture equivalence gate before optimization scoring.
   - command: `node scripts/validate_resi_mobile_shell_contract.mjs --url {url} --label "{property}" --property-code {code} --out reports/resi_edge_performance/MM-DD-YYYY/{property}/architecture/mobile-shell-proof.json`
   - proven contract: mobile initial HTML `<=40000` bytes, `0` stylesheet links, `<=8` script tags, `0` native runtime blockers, `0` native DAM images, `0` direct native analytics blockers, and no desktop topper unless approved
   - TowneStone and The Vine pass this contract; Calais integrated native transform fails it and is not the forward pattern
   - if this gate fails, stop and fix the shell architecture before PSI, Captain updates, or production readiness claims
6. Generate dry-run R2 asset plan:
   - center-out mobile hero crop
   - desktop hero derivative if needed
   - welcome/features/amenities derivatives
   - shared benefits derivatives when they materially affect PSI
7. Generate and upload optimized assets.
   - dry-run upload first
   - remote R2 upload second
   - verify sampled remote bytes/SHA against local derivatives
   - if R2 upload fails, record blocker and do not mark assets complete
8. Create property manifest and package readout.
   - every gate must have an explicit status: complete, pending, blocked, or approved exception
   - generic "analytics proof pending" is not sufficient when analytics ownership is unresolved
9. Run edge preview only:
   - no production traffic change
   - query-gated or preview-host gated
   - server timing markers required
10. Validate:
   - PSI mobile exact and fresh
   - PSI desktop exact and fresh
   - Playwright screenshots
   - CTA clicks
   - analytics ownership, queue/replay, and no duplicate pageviews
   - SEO/accessibility sanity
11. Update Captain state and governed memory.
    - Captain action status must match the real gate state
    - known exceptions and process corrections must be written into memory/register/audit docs
12. Only after explicit approval, promote the manifest to active.

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
- analytics ownership is Zaraz-first, Ahrefs and Cloudflare analytics evidence are attached, or approved exceptions are documented before final PSI acceptance
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

## Historical Champion's Green Prototype Status - 2026-07-10

08/09/2026 reconciliation: this section is historical only. It must not be used as authority to reapply, copy, promote, or treat Champions Green as the canonical package prototype.

08/10/2026 clarification: the current Champions base is a fresh manifest-driven base under `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`. Nothing in this historical prototype section is an implementation source for the current package.

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
