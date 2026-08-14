# Resi Edge Thread Reconciliation And Locked Requirements

Date: 08/09/2026
Status: Active reconciliation record
Owner: MarketingOps / Property Analytics

## Why This Exists

This record reconciles the Resi Edge optimization work after repeated drift on Calais and Champions Green. It exists so a cold operator cannot miss the subtle requirements that were learned across TowneStone, The Vine, Calais, Champions, Pilot, Zaraz, source attribution, `llms.txt`, SEO, and Data Pond/Captain work.

This document is not a new implementation variant. It is the lock around the package.

## 08/09/2026 Package Artifact Status

- Canonical package id: `resi-edge-canonical-upgrade-package`.
- Canonical package version: `2026-08-09.canonical-runtime-v1`.
- Shared runtime: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs`.
- Thin canonical adapter: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`.
- Current base manifest as of 08/10/2026: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`.
- Pilot manifest: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/pilot-ga4ax.manifest.json`.
- Static package validator: `/Users/mark/Property_Analytics/scripts/validate_resi_edge_package_static.mjs`.
- Gated runner: `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`.
- Deploy adapter: `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py`.

The package is now extracted and non-mutating preflight-ready for Pilot. It is not yet live-applied. The first apply attempt stopped before Cloudflare mutation because the new Wrangler config initially lacked `account_id`, causing a `/memberships` authentication failure. The config has been corrected, and dry-run/plan/static gates pass, but a second live apply requires Mark's explicit approval because the first gate failed.

## 08/10/2026 Current Truth Supersession

- Champions Green is the active full-functioning base reference by current user instruction.
- The active base is the fresh runbook-controlled manifest at `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`, not the old experimental Champions Worker and not the old legacy Champions manifest.
- The `BASE` command is `python3 scripts/run_resi_edge_upgrade.py --property-code BASE --domain championsgreen-ga.com --mode plan`.
- `BASE` must pass preflight but remain non-mutating. `apply_allowed:false` is expected for the base.
- TowneStone and The Vine remain reference/fixture properties for live behavior lessons and regression replay, not the active base.
- Pilot is not the active base unless separately named as an apply target.
- Calais remains failure/evidence input only unless explicitly named as a target.
- If any gate fails, the operator stops and discusses. There is no live workaround, no lookalike rebuild, no property-specific patch, and no continuing into fixes.

## 08/11/2026 Current Execution Gate

- The only allowed executor is `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`.
- Current selected target state: Ventana (`TX4VE`, `ventanaapts.com`) is preflight-ready but not live-upgraded.
- The latest Ventana live apply rolled back successfully after the final analytics proof used a synthetic query URL that returned `403`. The package rendering and platform gates before analytics passed in that run.
- The runner is corrected to use canonical-homepage analytics smoke with `--no-unique-query`. Do not reintroduce synthetic analytics query parameters unless a written WAF bypass is approved.
- The governed Zaraz analytics package upsert runs before Worker deploy. Failure blocks deployment.
- Manual Zaraz loader injection is forbidden. Cloudflare Zaraz auto-injection owns the loader.
- Required Heap mode is `interaction_only_queue_v6_input_only_cs_verify_home_204`, with no passive or late-passive Heap/Contentsquare network and only the same-origin `/?vtr_cs_verify_suppressed=1` 204 guard for Contentsquare verification.
- Next allowed live command after a green plan is `python3 scripts/run_resi_edge_upgrade.py --property-code TX4VE --domain ventanaapts.com --mode apply --require-live-proof`.
- If that command fails, rollback/evidence/stop is the whole response. Do not patch and rerun without Mark's approval.

## Non-Deviation Rules

- One canonical package identity. No named property-specific package variants.
- No desktop topper unless Mark explicitly approves a desktop shell lane in the current task.
- Desktop remains visually native by default, but desktop analytics still must be audited and governed.
- No manual Worker rewrite can be called the package.
- No WordPress, Cloudflare, Zaraz, Ahrefs, DNS, or route mutation happens before the reset card and gate plan are written.
- No local, workers.dev, preview, cached, or screenshot-only proof can substitute for live production proof when production readiness is claimed.
- No property can be called ready, done, exact, optimized, production-proven, approval-ready, or "same as TowneStone/Vine" until every required gate passes or has an explicit approved exception.
- If the runbook fails, the runbook/package failed. The operator does not improvise a workaround.

## Mandatory Sequence

1. Read current memory and governing docs.
2. Write the reset card.
3. Resolve governed property identity.
4. Audit live source page and originals.
5. Audit source data, phones, CTAs, specials, reviews, fonts, awards, colors, schema, meta/OG, `llms.txt`, sitemap, robots, GSC, Captain, Data Pond, DNS/SSL/cache, and analytics.
6. Build or validate using only the canonical package path.
7. Run the architecture equivalence gate.
8. Run browser proof before PSI.
9. Run analytics and consent proof.
10. Run PSI mobile and desktop.
11. Stop if anything fails.
12. Promote only after explicit approval and with rollback written.
13. Prove live production after cache purge.
14. Update evidence, Captain, Data Pond, memory, register, and audit.

## Mobile Shell Contract

The mobile homepage initial response must be a standalone edge-owned shell, not the full native WordPress/YOOtheme document with a topper injected above it.

Required first mobile sequence:

1. Feed-backed promo strip.
2. Mobile header using the proven chrome constants.
3. Full-height optimized hero.
4. Linked review row when sourced.
5. Official Live Better Live Easy visual with no added TM.
6. Native-sourced hero/subheadline text.
7. Primary CTA.
8. First native content block.
9. Required award or badge in the native mobile sequence when present.
10. Second native content block.
11. Lazy native continuation.
12. Consent notice or persistent preference entry point when required.

Required proven mobile chrome constants:

- Promo height: `60px`.
- Header height: `80px`.
- Side padding: `15px`.
- Logo text: `10px`, `700`, `16px` line height, `2px` letter spacing.
- Action gap: `20px`.
- Phone icon: `20px`.
- Tour pill: `20px` horizontal padding.
- Hamburger: `20px`, `2px` bars, centered at `31px`, `39px`, and `47px`.
- On a `390x844` viewport, hero starts after promo/header at `y=140` and fills the remaining viewport height, approximately `704px`.

Forbidden mobile initial document contents:

- Native YOOtheme stylesheet links or scripts.
- Native jQuery, jQuery Migrate, UIkit, YOOtheme, WordPress theme runtime, or Resi app scripts.
- DAM image URLs in initial visible payload.
- Native GTM, direct `gtag.js`, direct Heap/Contentsquare, direct Ahrefs, or direct Resi Pixel when Zaraz owns analytics.
- A full native WordPress body with an edge topper inserted above it.

## Visual Fidelity Requirements

- The shell must look like the approved property pattern, not a rough copy.
- Use the real property font system when first-party font assets exist and return `200`.
- Do not use generic fallback fonts as proof when exact fonts are available.
- Capture computed native font tokens for hero title, review row, content titles, body, buttons, and header.
- Lease-up and branded properties require property-scoped brand colors for promo, expanded promo panel, drawer, CTA, and overlay colors.
- The Vine brand-theme reference uses promo/drawer `#4E343F`, expanded promo surface `#F1EFEB`, text `#35343A`, and CTA `#792640`.
- Do not fix unscored PSI font warnings with font preloads if the change drops the primary score. Font-chain warnings are non-blocking unless a no-regression fix passes.

## Content Sequence Requirements

- First two content blocks are part of the package, not optional decoration.
- Do not ship a hero-only shell.
- The first two blocks must be taken from the native site/feed and preserve sequence, copy, CTAs, awards, and mobile hidden-media behavior.
- If the shell owns a native block, the lazy continuation must hide that duplicate block.
- Browser proof must scroll far enough to prove there is no duplicate visible Welcome/Features or equivalent first/second block pair.
- Calais lesson: Welcome copy, `See Available Homes`, Kingsley award, then the Features block was the required sequence; the welcome image was hidden on mobile because native mobile hid it.

## Specials Requirements

- The feed is the source of truth for specials, not the public Specials page unless the feed is unavailable and Mark approves the exception.
- Promo text must keep marketing framing and polished capitalization, for example `Up To ...` when the offer is a maximum.
- Do not display stale specials from screenshots, old Workers, or public-page fallback if the feed says otherwise.
- Promo details, panel text, availability CTA, and contact CTA must be sourced and verified.

## Reviews Requirements

- Hero review row is mobile-shell behavior from the reusable builder/template, not a one-off Worker hack.
- Desktop native pass-through must not receive an edge-added review row unless a desktop shell lane is explicitly approved.
- Prefer the live official Resi `property_rating` block when present; otherwise record the selected authoritative source and freshness.
- Review count, rating value, link destination, and visible text must match the selected source.
- Fractional stars must be proportional. A `4.3` rating is `86%` fill, not five full stars.
- JSON-LD `aggregateRating` must match the visible rating/count when present.

## Phone And Source Attribution Requirements

- Visible default phone must be the VWS attribution number from the Resi lead-source/tracking feed.
- Never display the actual office phone as a generated fallback.
- Incoming URL source strings such as `?id=<trackingId>` must resolve to the matching tracking/source row.
- Invalid or missing source IDs fall back to VWS, not to the office phone.
- Visible phone text, `tel:` link, schema phone, CTA analytics payload, and source-selection metadata must agree.
- Source lookup truth is generated from the Resi feed into the governed D1/read-model table. KV may only be a runtime cache of that table.

## Analytics And Consent Requirements

- Zaraz is the default owner for GA4, interaction-gated Heap/Contentsquare, Ahrefs Web Analytics, Resi event bridge/pixel ownership, and Cloudflare analytics/RUM posture.
- All metrics/analytics are included in this rule. It is not a mobile-only cleanup.
- Native WordPress GTM, `gtag.js`, Heap debug/bootstrap, direct Ahrefs, and duplicate Resi Pixel loaders must be removed in WordPress or surgically stripped at the edge, with visual proof that native rendering was not broken.
- Heap/Contentsquare must not load passively or late-passively in readiness proof. Interaction proof is separate.
- The known Contentsquare verify-installation 404 must be handled narrowly if it appears; broad sanitizers that break native continuation are forbidden.
- Ahrefs is lookup-first. Use the existing portfolio project/profile when present. Do not create duplicates without explicit approval.
- If two Ahrefs paths legitimately exist pre-launch, keep both until the launch URL transition decision is made, then update/delete by documented plan.
- Cloudflare Zaraz Consent Management is required unless Mark approves another CMP.
- Required consent purposes include Analytics & Performance and Marketing & Leasing Attribution.
- Every enabled Zaraz tool must be assigned to a purpose. Unassigned enabled tools are a stop condition.
- The approved visible CMP pattern is the compact Worker notice/pill and preferences panel when Cloudflare's native modal is hidden or unreliable, while Zaraz owns consent state and blocking.
- First-visit, preferences, accept, reject, and network-blocking browser proof are mandatory.

## SEO, AI, And Indexing Requirements

- `llms.txt` must return `200`, have one H1, and contain real markdown links with absolute live URLs.
- Do not use a plugin output that looks like markdown labels but is not parsed as links by the audit.
- Omit dead pages such as `/reviews/` when the route returns `404`.
- Meta, canonical, OG, Twitter, favicon/icon, sitemap, robots, and JSON-LD must be property-correct and live-domain correct.
- Stale identity such as `Apex West Midtown` or `TX054` is a blocker on public/indexable pages.
- Schema `url`, `@id`, name, address, phone, image, sameAs, and aggregateRating must be correct when present.
- GSC property and indexing state must be recorded, with indexing requests logged when submitted.

## Infrastructure Requirements

- Cloudflare/Kinsta/SSL/DNS must be audited before and after live changes.
- TowneStone lesson: do not point proxied Cloudflare DNS at prohibited Cloudflare-network origin IPs such as the old `141.193.213.21` record. Use the working Kinsta O2O hostname pattern and preserve ACME records when required.
- Cloudflare credentials must come through Keeper/KSM helpers.
- R2 upload is not complete until remote byte/SHA readback passes.
- Cache purge must be proven on the clean production URL, not only on a cache-busted URL.
- Desktop cannot pass from headers or markers. It needs rendered browser screenshot plus computed checks that native CSS loaded and the page is not raw blue-link HTML.

## Evidence Requirements

Every property run must produce:

- Reset card.
- Property manifest.
- Source audit.
- Baseline PSI/browser proof.
- Architecture proof.
- Browser visual screenshots for mobile, source-coded mobile, and desktop.
- Scroll-depth continuation proof.
- Console, failed request, and bad response proof.
- Font and image proof.
- Analytics ownership proof.
- Zaraz config and consent proof.
- GA4, Heap/Contentsquare, Ahrefs, Resi event bridge, and Cloudflare analytics proof or approved exceptions.
- Source-coded phone proof.
- `llms.txt` proof.
- Meta/OG/schema proof.
- GSC/indexing proof.
- R2 asset generation/upload/readback proof.
- Cache purge proof.
- Rollback plan.
- Captain/Data Pond evidence update.
- Final exact/fresh PSI mobile and desktop proof from the live production hostname when production is being judged.

## Current Execution Gate

08/11/2026 supersession: the older Pilot sequence below is historical unless Mark explicitly reselects Pilot. Use the current execution gate above.

Reference replay order:

1. Validate TowneStone as read-only reference.
2. Validate The Vine as read-only reference.
3. Apply to `pilot.venterradev.com`.
4. If Pilot passes, level-set TowneStone and The Vine through the same package path.
5. Only after that, consider additional properties.

If Pilot fails, stop and discuss. Do not continue.
