# Resi Edge Portfolio Migration And Optimization System

Status: Governing system record; execution is controlled by the 08/09/2026 reconciliation record
Date: 08/06/2026
Owner: MarketingOps / Property Analytics

Primary step-by-step operator runbook: `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md`. Use that runbook for property execution; this document remains the governing system record.

## 08/09/2026 Thread Reconciliation Correction

Read `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md` before acting on this system record.

Current execution truth:

- TowneStone and The Vine are read-only reference fixtures.
- Calais and Champions are failure/lesson sources unless Mark explicitly re-approves a bounded test.
- The first apply target is the actual Pilot test property, `pilot.venterradev.com`.
- There are no fast paths and no package variants.
- A failed gate stops the run. Do not continue into a workaround, lookalike rebuild, live patch, or property-specific implementation.
- No desktop topper is allowed unless Mark explicitly approves a desktop shell lane in the current task.
- No readiness language is allowed until the full package gate set passes or each omission has an explicit approved exception.

## 08/07/2026 Operating Correction

## 08/08/2026 Consent Management Correction

Consent management is a required legal/compliance gate for the Resi analytics package. Cloudflare Zaraz Consent Management is the approved owner unless Mark explicitly approves another CMP before implementation. The Pilot pattern is the reference: Cloudflare Zaraz CMP owns consent state and tool blocking, while the Worker may provide a compact branded cookie notice/pill and preferences panel through the Zaraz Consent API.

Every property package must now prove consent before final analytics, PSI, or production approval:

- Zaraz Consent Management is enabled on the zone.
- The configured purposes include at minimum an analytics/performance purpose and a marketing/leasing/attribution purpose.
- Every enabled Zaraz analytics or attribution tool is assigned to a configured consent purpose. Cloudflare documents that new Zaraz tools skip consent by default when no purpose is assigned, so unassigned enabled tools are a stop condition.
- GA4, Ahrefs, and Cloudflare Web Analytics/RUM posture is recorded under analytics/performance; Heap/Contentsquare, Resi Pixel, and leasing event attribution are recorded under marketing/leasing/attribution unless legal/compliance approves a different mapping.
- If the native Cloudflare modal is hidden or unreliable, the approved Worker/UX entry point must be proven live: first-visit notice visible, `Preferences` opens a purpose-backed preferences panel, `Accept` grants active purposes and flushes queued Zaraz events, rejection/preferences do not load purpose-bound tools without consent, and a persistent preference entry point remains available where required.
- Google Consent Mode v2 posture must be recorded for Google tools, including the default denied/granted behavior selected in Zaraz or page code.

Read-only config proof is produced with `/Users/mark/Property_Analytics/scripts/audit_zaraz_consent_package.py`. Browser proof still must test actual first-visit UX and network behavior; API config proof alone is not enough.

Heap/Contentsquare must be interaction-gated by default for Resi performance packages. The old passive fallback pattern (`load + 6000ms` or hard `8000ms`) is no longer acceptable for PSI/readiness evidence unless Mark approves a property-specific exception. Required passive proof is a long browser window that is frozen before any scroll or click and shows zero Heap/Contentsquare requests and zero analytics responses `>=400`.

Desktop/native pass-through still needs analytics ownership. Keeping desktop visually native does not mean passing native WordPress GTM/gtag/Heap through untouched. If Zaraz owns analytics, native duplicate analytics must be removed in WordPress or surgically stripped at the edge with live visual proof.

Lease-up and property-specific brand colors are part of visual parity. The topper must support a documented `brandTheme` or equivalent property configuration for promo strip, expanded promo panel, CTA, drawer, and hero overlay colors. The default Venterra palette is the fallback, not proof that a lease-up brand is correct. Required evidence must compare the topper colors to the live/native property brand with computed colors and screenshots.

Hero review proof belongs in the reusable builder, not in one-off property Workers. The mobile shell may render the sourced star/review row only when the builder template behavior enables it; desktop remains native and must not receive an edge-added review row unless Mark approves a desktop shell lane. The visible values and link must come from the selected authoritative source, preferably the live official Resi `property_rating` block when present. The builder must not add a TM mark to the Live Better Live Easy visual.

Hero typography and review-star rendering are measured fidelity requirements. The shell must carry captured native computed text-style tokens for hero title and review text when available; do not force a generic font over a property's actual font system. Fractional ratings must render as proportional star fills tied to the numeric score, so `4.3` renders as `86%` fill rather than five solid stars.

## 08/07/2026 Architecture Correction

Calais proved a forbidden drift path: injecting a mobile topper into the full native WordPress document can look close enough in screenshots while reintroducing native WordPress/YOOtheme CSS, jQuery, UIkit, Resi scripts, and DAM images into the initial mobile document. That is not the proven TowneStone/Vine high-score architecture.

The approved 90+ mobile package is the TowneStone/Vine standalone mobile shell: edge-owned promo/header/hero first view, optimized same-origin/R2 hero, tiny initial document, lazy native continuation, desktop native pass-through unless a separate desktop lane is approved, Zaraz-owned analytics, and live proof. An integrated native mobile transform is forbidden for performance-package approval unless Mark explicitly approves it as a named exception before implementation.

Calais was corrected on 08/07/2026 by rebuilding the live mobile route as the standalone shell. The accepted promotion sequence was: reset card, workers.dev production-branch proof, clean and source-coded architecture validator passes, browser proof for first view/lazy continuation/source phone/desktop native, live deploy, repeated live source-query probes, live browser proof, and live PSI. The live result scored mobile `100` and desktop `98`; this is the reference recovery path for failed properties.

Calais v16 added the live review-rating correction after the builder rule was locked. The public mobile route now renders the sourced `/reviews/` hero row `(4) 258 Reviews` with `--rating-percent:80%`; this is correct for Calais' current `4.0`. The reusable fractional-star rule is rating divided by five, so a future `4.3` must render as `86%`.

## Purpose

This system governs migration and optimization of Resi/YOOtheme property websites through Cloudflare, Zaraz, R2, Workers, PSI, Playwright, and Captain evidence.

The goal is a repeatable, auditable, highly reliable process. No property is considered ready because of judgment alone. Every advance requires evidence, an explicit gate state, and a rollback path.

## Non-Negotiable Principles

1. Evidence beats intuition.
2. Current records must be read before acting.
3. Property identity is resolved before implementation.
4. Analytics ownership is settled before final performance acceptance.
5. Preview is not production.
6. R2 assets are verified by remote readback, not only upload success.
7. Desktop and mobile are separate lanes with separate acceptance.
8. Captain state must match reality.
9. Every exception is documented as an approved exception.
10. Production changes require explicit approval.
11. Zaraz-first analytics is the default portfolio rule. GA4, Heap/Contentsquare, Ahrefs, Resi event bridging, and equivalent first-view analytics tooling belong in Cloudflare Zaraz unless an approved exception is recorded before scoring or promotion.
12. Proven architecture outranks operator judgment. A property must match the TowneStone/Vine shell contract before it can be called a 90+ mobile optimization package.
13. Consent management is a required package gate. No purpose-bound analytics or leasing-attribution tool may be considered launch-ready until Zaraz CMP purposes, tool assignments, first-visit UX, accept/reject/preferences behavior, and network blocking proof are recorded.

## Mandatory Reset Card

Before any property-specific planning, implementation, deploy, route attachment, dashboard update, or ready/blocked statement, the operator must write a short reset card in the work log or user-facing update.

Required fields:

- `Property`: governed property name, property code, and live hostname.
- `Goal`: the current goal only, such as mobile topper production, native analytics cleanup, or desktop optimization.
- `Approved pattern`: the prior approved property pattern being reused.
- `Mobile lane`: exactly what mobile traffic should receive.
- `Desktop lane`: exactly what desktop traffic should receive.
- `Analytics ownership`: Zaraz-owned tools, native scripts to remove/defer, and approved exceptions.
- `Whole-property fix ledger`: current state of identity, meta/OG, schema URLs, `llms.txt`, sitemap/robots, phone, CTAs, nav links, favicon/icons, GSC/indexing, cache, Captain, and Data Pond evidence.
- `Live change scope`: the exact live host/path/route/config that may change.
- `Required proof`: screenshots, stylesheet/computed-style proof, console/network proof, analytics proof, PSI proof, CTA proof, and rollback proof required for this task.
- `Stop conditions`: conditions that halt work before promotion or before saying ready.

Pass criteria:

- The reset card matches the current records and the user's latest instruction.
- Any deviation from TowneStone/Vine/Champions precedent is explicitly named and approved before implementation.

Stop conditions:

- The reset card is missing.
- The reset card says desktop is native but implementation uses a desktop topper.
- The reset card says analytics are Zaraz-owned while native GTM/gtag/Heap remains without an approved exception.
- The reset card cannot identify the approved pattern being reused.

## Approved Pattern Matrix

Use this matrix before choosing an implementation path.

| Pattern | When Allowed | Required Boundary |
| --- | --- | --- |
| Mobile topper with lazy native continuation | Approved mobile performance lane for TowneStone/Vine-style Resi sites | Mobile homepage only unless explicitly expanded |
| Desktop native pass-through | Default desktop behavior when no desktop shell has been approved | Must be labeled native, not optimized desktop |
| Desktop shell/topper | Only with explicit current approval | Requires separate desktop visual, CTA, analytics, and PSI acceptance |
| Native analytics cleanup | Allowed only through surgical element-level cleanup or WordPress removal | Must preserve native CSS, YOOtheme, fonts, CTAs, forms, and visual identity |
| Zaraz analytics package | Default analytics owner for GA4, interaction-gated Heap/Contentsquare, Ahrefs, Resi bridge, and Cloudflare analytics evidence | Native duplicate scripts must be removed/deferred or documented as approved exceptions |
| Zaraz consent management package | Required consent owner for Resi analytics/leasing tools unless an approved alternate CMP exists | Purposes and tool assignments must be configured before tool activation is accepted |
| Integrated native mobile transform | Forbidden for 90+ mobile optimization packages unless Mark explicitly approves the exception before implementation | Failed Calais path; reintroduces native WordPress/YOOtheme/jQuery/UIkit/DAM payload into the initial mobile document |

No property package may borrow part of a pattern while ignoring its boundary. If the high-score lane is mobile-only, desktop cannot be claimed as complete just because it still renders. If desktop must reach 90+, it needs its own approved desktop optimization lane.

## Proven Mobile Shell Contract

This contract is mandatory for any property that is being compared to TowneStone or The Vine, or any property whose mobile target is 90+.

Required architecture:

- Mobile homepage initial response is a standalone edge-owned shell, not the full native WordPress document with a topper injected into it.
- The first viewport contains only the approved promo/header/hero, current property identity, accurate feed-backed special text, correct source-attributed phone, correct Tour/Apply/Find links, and event bridge hooks.
- If the native first viewport includes a review/rating module, the edge shell must include a sourced, linked review summary with the same rating value, review count, display formatting, and destination unless Mark approves omission. The source can be GBP, Reputation.com, or the live official Resi `property_rating` block, but the chosen source and freshness must be recorded.
- Review summary rendering is mobile-shell scoped by default. Desktop native pass-through must not receive a duplicate edge-added review row unless a separate desktop shell lane is approved.
- Fractional review ratings must render as fractional star fills, with the fill percentage derived from the rating divided by five.
- Hero title and review typography must use captured native computed styles when available, including family, size, weight, line height, letter spacing, and text transform.
- Do not add a TM mark to the LBLE visual in the shell.
- The LCP asset is an optimized same-origin or R2-owned asset with explicit dimensions, eager loading, and high fetch priority.
- Native lower-page content is a lazy continuation, iframe, or equivalent deferred path that is not loaded in the initial mobile document and is noindexed where it is separately addressable.
- Desktop remains native unless a separate desktop optimization lane has current approval.
- Analytics are Zaraz-owned unless an approved exception exists.
- Lease-up/property color theme is configured and proven against the native brand.

Forbidden initial mobile document contents:

- Native YOOtheme stylesheet links or scripts.
- Native jQuery, jQuery Migrate, UIkit, YOOtheme, WordPress theme runtime, or Resi app scripts.
- DAM image URLs discovered in the initial mobile HTML, except inside inert JSON evidence explicitly excluded by the architecture validator.
- Native GTM, direct `gtag.js`, direct Heap/Contentsquare, or direct Ahrefs loaders when Zaraz owns analytics.
- A full native WordPress `<body>` with the topper inserted above it.

Required machine proof before PSI or readiness claims:

- `architecture/mobile-shell-proof.json` produced by `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs`.
- `pass: true`.
- `initial_html_bytes <= 40000`.
- `stylesheet_link_count == 0`.
- `script_tag_count <= 8`.
- `native_runtime_blockers == 0`.
- `native_dam_image_count == 0`.
- `direct_native_analytics_blockers == 0`.
- `desktop_topper_absent == true`, unless a desktop shell exception is approved.
- `lcp_asset_owner` is `edge_or_r2` in browser proof.
- `continuation_initially_lazy == true` and `continuation_loads_after_scroll_or_interaction == true` in browser proof.

Stop conditions:

- The architecture proof is missing.
- The mobile proof resembles the Calais integrated-native failure shape: large initial HTML, stylesheet links, native runtime scripts, or DAM images in the initial document.
- A visual defect is found and the proposed fix changes the architecture rather than fixing the shell.
- The operator says the property is "like TowneStone/Vine" without the machine proof above.

## Whole-Property Launch Ledger

Performance work is not complete unless the full launch hygiene ledger is also current. Each property package must record the status of these items before approval:

- Identity: governed property name, property code, community id, GA4 property/measurement id, hostname, and address.
- Stale identity scan: no wrong property names, old property codes, Kinsta/staging URLs, or hard-coded neighbor values such as the earlier Apex/TX054 issue.
- Meta and OG: title, description, canonical, Open Graph URL/title/description/image, Twitter card where present, and favicon/icon references.
- Schema: ApartmentComplex/LocalBusiness identity, URL, address, phone, image, sameAs, and no staging/source URLs unless explicitly intended.
- `llms.txt`: valid Markdown, H1 present, absolute markdown links present, no dead links, no plugin-rendered plain-text link labels that fail the agent audit.
- Sitemap and robots: sitemap reachable, important public pages indexable, preview/native-continuation utility routes noindexed where needed.
- Phone and CTAs: phone number, tour URL, apply URL, apartments URL, specials URL, contact URL, and drawer/header/footer links verified live.
- Reviews: visible hero/topper review stars, rating value, review count, and review link verified against the selected authoritative source; JSON-LD `aggregateRating` must match the visible values when present.
- Review rendering: fractional rating visual proof captured, such as `4.3` -> `86%` star fill, and the review/title typography verified against captured native computed styles.
- Source-coded phone/routing: incoming URL strings or source parameters that trigger feed lookup, dynamic phone replacement, tracking id changes, source attribution, or lead recipient changes tested separately from the default URL.
- Source lookup location: for Resi sites, inspect the local WordPress source and rendered `window.resiPixelConfig`. The local WP build source is currently under `/Users/mark/Property_Analytics/resi_archetype_site/wordpress/public/wp-content/plugins/resi-elements/`.
- Source lookup contract: the Resi feed is the source of truth. The local WP plugin confirms the same contract: `inc/services/ResiImporter.php` imports `WebsiteHelper::apiUrl() . "/property/{$propertyKey}/lead-sources"` into WordPress option `ri_lead_sources_{$propertyKey}`; `inc/services/repositories/PropertyRepository.php` reads that option; `inc/helpers/PropertyHelper.php` exposes it; `inc/helpers/ResiPixelHelper.php` emits `propertyId`, `externalSourceField`, `fallbackPhone`, `storage`, `debug`, and `leadSources` into `window.resiPixelConfig` before loading `https://js.getresi.co/pixel/latest/resi-pixel.iife.js`.
- Governed table rule: build our own normalized D1/read-model table from the same Resi lead-source feed, including `property_key`, `external_source_field`, VWS default attribution phone/email, source code, external source key, source phone/email, source name, feed fetched timestamp, raw source hash, and active/error state. This table is generated from the feed, not manually maintained. The visible default phone must come from the VWS tracking row; the actual office phone must not be used as a display fallback. Missing or blank VWS attribution is a warning/fix condition, not permission to show the office phone.
- Governed source lookup implementation: build with `/Users/mark/Property_Analytics/scripts/build_resi_source_lookup_table.py`, publish to remote D1 with `/Users/mark/Property_Analytics/apps/api/scripts/resi_source_lookup_to_d1.py`, and resolve in Workers with `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-source-attribution.js`. The repeatable test is `/Users/mark/Property_Analytics/scripts/test_resi_source_attribution.mjs`; the runbook is `/Users/mark/Property_Analytics/docs/RESI_SOURCE_ATTRIBUTION_LOOKUP_RUNBOOK_2026-08-06.md`.
- Rendered source proof: after cache clear, inspect `window.resiPixelConfig.externalSourceField`, `fallbackPhone`, and `leadSources` for source codes, phones, emails, and external source keys. Source-coded URL tests must prove the selected source phone/email and fallback behavior.
- Consent management: Zaraz CMP enabled, purposes configured, enabled tools assigned to purposes, first-visit notice/pill/modal proof, preferences path proof, accept/reject proof, Google Consent Mode posture, and no purpose-bound tool firing before consent where blocking is required.
- Analytics: Zaraz GA4, interaction-gated Heap/Contentsquare, Ahrefs, Resi event bridge, Cloudflare analytics/RUM state, CTA event continuity, and no native duplicate GTM/gtag/Heap unless approved.
- Assets: optimized hero/media derivatives, R2 upload/readback proof, favicon/icon state, and no broken first-party fonts/images.
- Visual and accessibility: mobile and desktop screenshots, computed style sanity, property brand/color parity proof, no horizontal overflow, no unstyled native render, accessibility warnings recorded.
- Performance: official or governed PSI mobile/desktop proof, with exact and fresh URL runs where available.
- Search/indexing: GSC property state, sitemap submission/indexing requests where applicable, and launch notes for crawled/indexed gaps.
- DNS, SSL, and hosting: authoritative DNS shape, proxied/unproxied state, Kinsta O2O or origin pattern, ACME validation records, Universal SSL/certificate state, and prohibited-origin checks such as the TowneStone Error 1000 lesson.
- WordPress/admin fields: Resi Custom Scripts, Tracking Attributes, phone fields, property metadata fields, hard-coded body attributes, plugin-generated metadata, and cache-cleared readback after admin changes.
- Operations: Captain action/watch state, Data Pond row, rollback plan, cache purge proof, live smoke evidence, and final promotion decision.

If one of these ledger items is out of scope for a task, it must be marked `approved_exception` or `deferred_with_owner`; silence is not an acceptable state.

## Master Property Package Checklist

Use this checklist for every property in the 80+ portfolio rollout.

### 1. Reset And Records

- Mandatory reset card written.
- Working memory, capability register, full audit, migration system, and SOP read.
- Prior property-specific records searched by hostname, property code, property name, GA4 id, GSC property, and known vanity paths.
- Comparable-property lessons identified, especially TowneStone, The Vine, Champions Green, and Calais.
- Current user instruction reconciled against prior records.

### 2. Governed Identity

- Property identity resolved through the governed identity matrix.
- Property code, community id, property name, market, address, phone, hostname, Venterra URL, GA4 property, GA4 measurement id, GSC property, and Resi CTAs recorded.
- Similar-code/name collision warnings documented.
- No hand-built identity map or guessed property code used.

### 3. Source Website Audit

- Live URL, final URL, redirects, status, and Cloudflare/Kinsta/cache headers captured.
- DNS, SSL, and hosting topology captured, including apex and `www` record shape, CNAME/A targets, proxy state, Kinsta O2O headers when relevant, ACME validation records, Universal SSL/cert pack state, and prohibited Cloudflare-origin targets.
- Homepage and core pages checked: apartments, features, amenities, gallery, neighborhood/location, specials, contact, reviews when available.
- Title, meta description, canonical, OG, Twitter card, favicon/icons, schema, robots, sitemap, and `llms.txt` captured.
- Stale identity scan completed for wrong property names, old codes, source-domain URLs, Kinsta/staging URLs, hard-coded Apex/TX054-style values, wrong phone numbers, and old GTM ids.
- WordPress/admin field audit completed where access exists: Custom Scripts, Tracking Attributes, phone/contact fields, Resi property settings, body data attributes, and plugin-generated metadata.
- Dynamic source-URL behavior audited where available: source code/id parameters, feed lookup result, rendered phone swap, tracking id observability, lead recipient/routing observability, and fallback behavior when the source code is missing or invalid.
- Local WP source contract checked where available: `ResiImporter::importLeadSources()`, `PropertyRepository::getLeadSources()`, `PropertyHelper::getLeadSources()`, `ResiPixelHelper::getConfig()`, and `ResiPixelHelper::enqueueResiPixel()` match the rendered live config.
- If edge-owned content needs source-aware phone/lead routing, read from the governed feed-derived D1 table and optionally publish a KV edge cache from that table. KV must be a deploy/runtime cache only; the auditable table and raw feed snapshot own the truth. Rendered WP/live parity must be proven before production.
- Core links and CTA destinations checked live.

### 4. Search And Indexing

- GSC property identified and active.
- Sitemap reachable and submitted/known where applicable.
- Indexability checked for production pages.
- Preview, native-continuation, health, and utility routes noindexed where appropriate.
- Indexing requests or crawl follow-ups logged when needed.

### 5. `llms.txt`

- `/llms.txt` returns `200`.
- File is Markdown, has one H1, has real markdown links, and uses absolute live-domain URLs.
- Links are live and do not include dead pages such as unavailable reviews routes.
- Plugin output is corrected at the edge or in WordPress if it renders plain-text labels instead of links.

### 6. Meta, OG, Schema, And Icons

- Canonical URL uses the live production hostname.
- OG URL/image/title/description are property-correct.
- JSON-LD uses live production URLs, correct phone, correct address, correct image, and correct property identity.
- No Kinsta, staging, legacy, or neighbor-property URLs remain in public schema.
- Favicon, SVG icon, Apple touch icon, and browser tab branding are present and property-correct.

### 7. Analytics Ownership

- Native WordPress/custom-script inventory captured before changes.
- Zaraz config readback captured.
- Zaraz Consent Management audit captured with `scripts/audit_zaraz_consent_package.py`.
- CMP purposes documented, including analytics/performance and marketing/leasing/attribution.
- Every enabled Zaraz tool is assigned to a configured purpose; unassigned enabled tools are a stop condition.
- Live consent UX proof captured: first-visit notice, preferences panel or approved modal, accept, reject/preferences, persistent preference path, and purpose-bound network behavior.
- Google Consent Mode v2 state recorded for GA4/Google tools.
- GA4, interaction-gated Heap/Contentsquare, Ahrefs, Resi event bridge, and Cloudflare analytics/RUM ownership settled.
- Ahrefs project/profile lookup completed before any setup. Use the existing portfolio Ahrefs project/profile when present; do not create a new Ahrefs project/profile unless the lookup proves none exists and the user approves creation.
- Native GTM, `gtag.js`, Heap bootstrap/debug, Ahrefs direct loaders, and duplicate analytics scripts removed/deferred or documented as approved exceptions.
- GA4 realtime, Heap continuity, Ahrefs request/tool proof, Cloudflare analytics state, source-coded phone/lead attribution, and CTA events verified.
- No duplicate pageview or duplicate conversion risk remains.

### 8. Assets And Media

- Source hero/media inventory captured.
- Optimized derivatives generated with approved crop and compression choices.
- R2 keys follow the portfolio pattern.
- R2 upload proof and remote byte/SHA readback proof captured.
- First-party fonts/images/icons have no live 404s.

### 9. Implementation Lane

- Approved pattern selected from the pattern matrix.
- Mobile lane and desktop lane documented separately.
- Mobile topper uses approved TowneStone/Vine-style first-view pattern when applicable.
- Desktop remains native unless a separately approved desktop optimization lane exists.
- Native analytics cleanup is element-level/surgical and never strips CSS, YOOtheme, forms, or required scripts.
- Worker route ownership and existing Workers are preserved where possible.

### 10. Architecture Proof

- Mobile shell contract validator run against the exact judged URL.
- Output stored at `architecture/mobile-shell-proof.json`.
- Initial mobile HTML stays within the proven TowneStone/Vine budget.
- No native runtime, DAM image, or direct native analytics blockers appear in the initial mobile document.
- Browser proof confirms the LCP asset is edge/R2-owned and native continuation is lazy.
- Desktop proof confirms no mobile topper leakage unless approved.

### 11. Preview Proof

- Preview/query-gated URL created before production behavior changes.
- Health/config marker proves the correct property and mode.
- Mobile and desktop Playwright screenshots captured.
- Console errors, failed requests, bad HTTP responses, stylesheet count, loaded stylesheets, computed fonts/styles, overflow, and first-view appearance checked.
- CTA clicks and analytics events tested.
- PSI mobile and desktop exact/fresh runs captured when available.

### 12. Production Promotion

- Explicit user approval captured for the exact live change.
- Rollback plan written before promotion.
- Route/config/cache changes documented.
- Live browser proof captured after promotion on the production hostname.
- Live mobile and desktop behavior match the approved lanes.
- Cache purges completed and recorded.

### 13. Post-Launch Evidence

- Live visual screenshots attached.
- Live console/network/style proof attached.
- Live analytics smoke attached.
- Live CTA smoke attached.
- Live PSI proof attached or documented if API quota blocks it.
- GSC/indexing state updated.
- Cloudflare analytics readback captured after traffic exists.

### 14. Operations And Accountability

- Captain watch/action state updated to match real evidence.
- Data Pond row updated with usable status: what is live, what was done, what is running, what is blocked, and proof links.
- Package readout updated.
- Memory/register/audit updated for meaningful workflow changes.
- No property is marked approval-ready until every required gate is `passed` or `approved_exception`.

## Required Package Structure

Each property package must live under:

```text
reports/resi_edge_performance/MM-DD-YYYY/{property-code-or-slug}/
```

Required artifacts:

- `PACKAGE_READOUT.md` copied from `/Users/mark/Property_Analytics/docs/RESI_EDGE_PACKAGE_READOUT_TEMPLATE_2026-08-07.md`
- `property-manifest.json`
- `baseline/psi-summary.json`
- `baseline/browser-summary.json`
- `analytics/analytics-ownership-audit.json`
- `analytics/zaraz-config-summary.json` or `analytics/analytics-exception.md`
- `analytics/browser-analytics-smoke.json`
- `analytics/ga4-realtime-proof.json`
- `analytics/heap-continuity-proof.json`
- `analytics/ahrefs-web-analytics-proof.json` or `analytics/ahrefs-exception.md`
- `analytics/cloudflare-edge-analytics-proof.json`
- `analytics/cloudflare-web-analytics-state.json` or `analytics/cloudflare-web-analytics-exception.md`
- `architecture/mobile-shell-proof.json`
- `architecture/browser-continuation-proof.json`
- `assets/generated-assets.json`
- `assets/r2-upload-summary.json`
- `assets/r2-readback-summary.json`
- `preview/browser-summary.json`
- `preview/psi-summary.json`
- `cta-analytics-smoke.json`
- `rollback-plan.md`
- `captain-update.sql`
- `promotion-decision.md`

If an artifact is intentionally absent, the package must include an explicit reason and owner approval.

## Gate States

Every gate uses exactly one state:

- `not_started`
- `in_progress`
- `passed`
- `blocked`
- `approved_exception`

No other wording counts as a gate state.

## Stage 0: Record Intake

Required actions:

- Read `ATLAS_WORKING_MEMORY.md`.
- Read `docs/CAPABILITY_REGISTER_2026-04-10.md`.
- Read `docs/FULL_SYSTEM_AUDIT_2026-04-10.md`.
- Read this system document.
- Read `docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md`.
- Search for the property code, GA4 id, hostname, and property name across records.

Pass criteria:

- Prior work, known blockers, and comparable property lessons are summarized in `PACKAGE_READOUT.md`.

Stop conditions:

- Conflicting identity values without a documented resolution.
- Prior blocker that affects this property and has not been closed or consciously accepted.

## Stage 1: Property Identity

Required source:

- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Required evidence:

- canonical property code
- community id
- GA4 property id
- GA4 measurement id when available
- GSC property
- live hostname
- governed Venterra URL
- phone
- address
- CTAs
- specials
- source image URLs

Pass criteria:

- Manifest contains the governed property identity.
- Wrong-neighbor warnings are written when a similar code/name exists.

Stop conditions:

- Property code cannot be resolved through the governed identity matrix.
- GA4/GSC/hostname mapping is ambiguous.

## Stage 2: Source Page Audit

Required checks:

- HTTP status and final URL.
- Title, meta description, canonical, OG, favicon.
- Schema identity and URLs.
- `llms.txt`, sitemap, robots, noindex state.
- Phone and CTA destinations.
- Stale property names/codes.
- WordPress custom script inventory where available.

Required evidence:

- rendered HTML facts
- stale identity scan
- schema scan
- link/CTA status

Pass criteria:

- No stale identity values on indexable public pages.
- Broken core links are either fixed or recorded as blockers.

Stop conditions:

- Stale property identity in rendered public HTML.
- Incorrect phone or core CTAs.
- Indexability mismatch on production pages.

## Stage 3: Analytics Ownership Gate

This stage happens before final PSI acceptance. The default outcome is Zaraz ownership, not a site-local script stack.

Required checks:

- Rendered live and preview HTML scan for:
  - `googletagmanager`
  - `GTM-`
  - `gtag/js`
  - GTM noscript
  - Heap bootstrap/debug snippets
  - Contentsquare direct loaders
  - Ahrefs direct loaders
  - Resi pixel direct loaders
  - duplicate GA4 measurement paths
  - `/cdn-cgi/zaraz`

Preferred ownership:

- Cloudflare Zaraz owns:
  - GA4
  - interaction-gated Heap/Contentsquare
  - Ahrefs Web Analytics when the property is in the Ahrefs package
  - Resi event bridge
- Cloudflare Analytics proof is captured as a package artifact:
  - edge analytics readback through the Cloudflare GraphQL collector after production traffic exists
  - Cloudflare Web Analytics or RUM state, if enabled for the zone

Required evidence:

- `analytics/analytics-ownership-audit.json`
- sanitized Zaraz config summary before/after when changed
- WordPress custom scripts before/after when changed
- cache clear proof when scripts are removed
- browser smoke proving:
  - Zaraz present
  - GTM absent
  - no duplicate pageviews
  - GA4 realtime
  - Heap continuity
  - Ahrefs request/tool proof, or an approved Ahrefs exception
  - CTA events
- Cloudflare analytics proof:
  - edge analytics collector readback when the domain is live on Cloudflare
  - Cloudflare Web Analytics/RUM enabled state, or an approved exception

Pass criteria:

- Zaraz owns site analytics, Cloudflare analytics evidence is attached, and Ahrefs is either active through Zaraz or explicitly excepted.

Stop conditions:

- Native GTM/gtag/Heap remains without an approved exception.
- Duplicate pageviews are possible.
- GA4 realtime or CTA event continuity is unproven.
- Ahrefs is expected but not installed/proven.
- Existing Ahrefs portfolio profile/project has not been checked, or duplicate Ahrefs projects/profiles exist without a documented keep/delete decision.
- Cloudflare analytics readback/state is missing after production traffic exists.

## Stage 4: Baseline Measurement

Required measurements:

- PSI mobile exact URL.
- PSI mobile fresh URL.
- PSI desktop exact URL.
- PSI desktop fresh URL.
- Playwright mobile screenshot and metrics.
- Playwright desktop screenshot and metrics.
- Network request inventory.
- Console and failed request inventory.

Pass criteria:

- Baseline is complete and saved before optimization.

Stop conditions:

- PSI API unavailable and no approved alternate measurement path.
- Browser proof cannot load the site cleanly.

## Stage 4A: Architecture Equivalence Gate

This stage happens after baseline, before PSI comparison, before preview promotion, and before any statement that a property is using the TowneStone/Vine package.

Required checks:

- Run `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs` against the exact mobile URL being judged.
- Compare the output to the TowneStone/Vine shell contract, not to a subjective screenshot.
- Capture browser proof that the native continuation is lazy at first paint and loads only after scroll or interaction.
- Capture desktop proof that no mobile topper is present unless a desktop shell lane was explicitly approved.

Required evidence:

- `architecture/mobile-shell-proof.json`
- `architecture/browser-continuation-proof.json`
- desktop screenshot or browser JSON proving native pass-through

Pass criteria:

- `mobile-shell-proof.json` has `pass: true`.
- Browser proof shows optimized edge/R2 LCP asset, no first-view native continuation load, and continuation load after scroll or interaction.
- Desktop proof matches the declared desktop lane.

Stop conditions:

- Initial mobile HTML contains native stylesheet links, native runtime scripts, or DAM image URLs.
- Initial mobile HTML is materially larger than the proven TowneStone/Vine shell budget.
- The implementation uses an integrated native mobile transform without Mark's explicit approved exception.
- The proposed fix for a visual defect changes the approved architecture instead of repairing the shell.

## Stage 5: Asset Pipeline

Required actions:

- Generate optimized derivatives from audited source images.
- Use center-out mobile hero crop by default.
- Use R2 key pattern:

```text
resi-edge-assets/{propertyCode}/home/...
resi-edge-assets/shared/...
```

Required evidence:

- `generated-assets.json`
- crop review image
- R2 dry-run output
- R2 upload summary
- R2 remote readback summary with byte and SHA match

Pass criteria:

- Remote R2 readback matches sampled local assets.

Stop conditions:

- R2 write fails.
- Remote readback fails.
- Visual crop is materially wrong.

## Stage 6: Worker Preview

Required rules:

- No production route change.
- No DNS change.
- Preview URL or query gate only.
- Health endpoint or config marker must prove property identity and mode.
- Preview responses must carry preview-safe index controls where applicable.

Required evidence:

- Worker source path
- Worker version id
- preview URL
- config/health output
- response markers

Pass criteria:

- Preview returns the expected property and mode.
- Production traffic remains unchanged.

Stop conditions:

- Preview depends on live production mutation.
- Wrong property identity appears.
- Production route is accidentally attached.

## Stage 7: Preview Validation

Required checks:

- Mobile PSI exact/fresh.
- Desktop PSI exact/fresh.
- Governed benchmark runner must use property-specific targets rather than editing hard-coded defaults, for example:
  `node scripts/collect_resi_edge_benchmark.mjs --phase {phase} --out-dir reports/resi_edge_performance/MM-DD-YYYY/{property-slug} --runs 1 --curl-runs 1 --wait-ms 1500 --psi --target '{key}|{label}|{url}'`
- Playwright mobile and desktop screenshots.
- Console errors.
- Failed requests.
- First-party font/image/script failures.
- CTA clicks.
- Analytics events.
- SEO/accessibility sanity.
- No stale identity.
- No mobile overflow.

Pass criteria:

- Mobile and desktop each pass their declared lane criteria.
- If desktop remains native, native-guard acceptance must be explicitly documented and must not be represented as optimized desktop.

Stop conditions:

- Any broken CTA.
- Any stale identity.
- Any duplicate pageview risk.
- Desktop performance described as optimized when it is only native pass-through.

## Stage 8: Captain And Governance

Required actions:

- Update Captain action/watch item.
- Update package readout.
- Update manifest gate states.
- Update memory/register/audit for significant workflow changes.

Pass criteria:

- Captain state matches the real gate state.
- No package says `passed` while a prerequisite is unresolved.

Stop conditions:

- Captain state is more optimistic than the evidence.

## Stage 9: Promotion Decision

Required evidence:

- all prior gates `passed` or `approved_exception`
- rollback plan
- explicit approval
- promotion command or dashboard action documented before execution

Pass criteria:

- Production route behavior changes only after explicit approval.

Stop conditions:

- Any gate is `blocked`, `in_progress`, or `not_started`.
- Approval is ambiguous.

## Stage 10: Post-Launch Monitoring

Required checks:

- live mobile PSI
- live desktop PSI
- browser smoke
- Zaraz/GA4/Heap/Ahrefs/CTA proof
- Cloudflare edge analytics readback and Cloudflare Web Analytics/RUM state
- GSC/indexability sanity
- rollback readiness

Pass criteria:

- Live behavior matches approved preview.

Stop conditions:

- Production error, broken CTA, duplicate tracking, stale identity, or material PSI regression.

## Portfolio Best Practices Locked From Recent Work

- TowneStone showed that analytics migration to Zaraz must include WordPress script cleanup, cache purge, Worker stale-script stripping if caches keep old snippets, and GA4 realtime proof.
- Vine showed that production topper work must preserve existing Worker route ownership, avoid competing Workers, and include console/font proof after deployment.
- Champions showed that mobile topper performance can reach high scores when the page is edge-owned, assets are optimized, analytics is preview-scoped, and R2 assets are verified.
- Calais showed that a technically successful mobile preview is not a complete package when analytics ownership is unresolved. The process now treats analytics ownership as an early gate.
- 08/06/2026 analytics package correction: all pilot and portfolio Resi edge packages are Zaraz-first by default and must include GA4, interaction-gated Heap/Contentsquare, Ahrefs, Resi event bridge, Cloudflare edge analytics, and Cloudflare Web Analytics/RUM state as first-class evidence or approved exceptions.
- 08/07/2026 Heap passive fallback correction: default Resi readiness proof must show zero passive and zero late-passive Heap/Contentsquare network requests. Loading Heap after passive timers is no longer a pass condition; interaction proof is separate.

## Prohibited Shortcuts

- Calling a package ready because mobile PSI is high.
- Treating `workers.dev` proof as equivalent to production-domain Zaraz proof.
- Treating R2 upload success as R2 verification without remote byte/SHA readback.
- Treating desktop native pass-through as optimized desktop.
- Leaving WordPress GTM/gtag/Heap in place while claiming Zaraz-owned analytics.
- Omitting Ahrefs or Cloudflare analytics proof from the package because GA4/Heap already passed.
- Updating Captain to `complete` or `passed` before all gate evidence exists.
