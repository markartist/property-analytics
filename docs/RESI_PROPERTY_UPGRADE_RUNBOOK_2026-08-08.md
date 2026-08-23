# Resi Property Upgrade Runbook

Status: Locked execution runbook; execution is governed by `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`, `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/contract.json`, and `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`
Date: 08/08/2026
Execution lock updated: 08/11/2026
Owner: MarketingOps / Property Analytics

Use this runbook only inside the no-deviation package lock. It exists to prevent drift. Do not improvise a new pattern, partial shell, desktop topper, or property-specific lookalike.

08/11/2026 execution lock: this is not an operator-choice checklist. A property upgrade is executed only by `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`. The current protected base is the fresh Champions Green manifest at `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`. TowneStone, The Vine, Calais, Champions, District, and Ventana records are evidence sources, not permission to copy old Workers or invent a variant. If any gate fails, rollback/evidence/stop is the entire response until Mark approves the next action.

08/11/2026 strict-reference correction: reference replay and apply-mode reference replay use the same no-bypass analytics contract. Do not use `--allow-desktop-direct-analytics`, do not add an equivalent flag, and do not call TowneStone/The Vine fully reference-green while desktop direct analytics remain. Current strict blockers are direct desktop Resi Pixel on TowneStone, plus desktop `HEAP_JS_DEBUG` and direct Resi Pixel on The Vine.

08/11/2026 shared standards correction: the package is now organized as shared standards plus property manifests. Shared behavior belongs in `/Users/mark/Property_Analytics/ops/cloudflare/shared/`; property runs may reference or declare a standard version, but they may not copy, fork, or locally revise behavior. The active standards registry is `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-standards/registry.json`. The first extracted universal standard is the finalized compact Zaraz consent widget at `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/contract.json` and `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/widget.mjs`.

08/12/2026 universal template correction: the mobile shell structure is identical across properties. The only allowed per-property changes are content/data/assets/links/source-phone lookup/review values/special presence and copy/brand color tokens. Structural differences are not allowed. The Live Better Live Easy title must use the official same-origin SVG visual from the package; `mobile_shell.hero.title_text = "Live Better. Live Easy."` is the accessible label only. `hero-title-text`, property font substitution for the tagline, `title_asset`, `title_asset_text`, `title_render_mode`, edge-added TM marks, changed hero stack order, changed first-two-panel order, changed CTA structure, desktop toppers, and property-specific Worker branches are all stop conditions.

08/12/2026 Vine golden-source reset: the active visual/source baseline is the working The Vine Kyle Parkway mobile topper, not a generated canonical lookalike and not any Champions experiment. Read `/Users/mark/Property_Analytics/docs/RESI_EDGE_VINE_GOLDEN_TEMPLATE_LOCK_2026-08-12.md` before any Resi Edge work. The Vine is the only golden replay reference. TowneStone, Champions, Calais, District, Ventana, Pilot, and every other property are normalization targets unless Mark explicitly promotes a new golden source. Do not deploy a generated package over The Vine or any protected reference through a level-set/reference mode. That mode is forbidden.

No freestyle clause: if the fixed package cannot pass on a target, the package or manifest is incomplete. The operator must not continue by writing a property-specific workaround, desktop shell, lookalike topper, manual Zaraz loader, alternate Worker, or "small fix" during the property run.

## Operating Promise

A property is not complete because it looks close, has a good PSI run, or works locally. It is complete only when the exact live production URL passes every required gate and the evidence packet is saved.

The target package is:

- Mobile homepage: proven standalone edge shell with lazy native continuation.
- Desktop: native pass-through by default, with surgical analytics cleanup and no edge shell unless separately approved.
- Performance: mobile reference parity, currently `98+`, and desktop `90+` PageSpeed Insights on the live production URL. The `90+` mobile floor is not enough to call the package equivalent to the proven examples.
- Analytics: Zaraz-owned GA4, Heap/Contentsquare, Ahrefs Web Analytics, Resi attribution bridge, Cloudflare Analytics/RUM posture.
- Consent: Cloudflare Zaraz CMP with purpose assignments, visible Worker preference UI when needed, and live accept/reject network proof.
- Consent UI standard: use the shared `compact_shell_pill_v29_2026_08_20` contract only. The pill text is `This website uses cookies`, pill buttons are `Preferences` and `Accept`, pill-level `Reject` is forbidden, `Preferences` must open `zaraz.showConsentModal()`, and the Cloudflare preferences modal must prove as a bounded centered desktop panel rather than a full-width slab. The compact pill must follow the Resi Edge mobile shell marker, keep the cookie icon visible, and render `Preferences` as the subdued secondary action.
- SEO and AI: meta, OG, canonical, schema URLs, `llms.txt`, sitemap/robots, GSC/indexing, stale identity cleanup.
- Attribution: visible phone numbers come from the Resi source lookup, defaulting to VWS, never the raw office phone.
- Evidence: browser screenshots, console/network logs, source-coded URL proof, architecture proof, PSI proof, analytics proof, cache purge proof, rollback marker.

Current execution boundary:

- Use The Vine as the protected golden mobile visual/source reference.
- Do not mutate protected references during package extraction or validation.
- Do not reuse prior Champions implementation code, historical Workers, generated lookalikes, or old legacy manifests as package source.
- Do not touch live Cloudflare routes, WordPress, Zaraz, Ahrefs, DNS, GSC, Captain, or Data Pond until the reset card and green plan exist for the explicitly selected target.
- The package remains gated until the shared runtime, manifest schema, validator suite, Zaraz applier, asset builder/uploader, and live evidence runner pass every required gate on the selected production hostname.

## Stop Rules

Stop before deployment or readiness language if any of these are true:

- No reset card has been written for the property.
- The live URL was not checked after the change.
- The mobile shell omits the approved first two content blocks.
- The shell is a reduced hero-only rescue.
- The shell uses stale specials, wrong capitalization, wrong brand colors, wrong fonts, wrong phone, wrong CTAs, wrong review count, or wrong rating source.
- The shell adds a TM mark to the Live Better Live Easy art.
- The shell renders Live Better Live Easy as text or through a property-specific title asset instead of the official same-origin SVG visual owned by the package.
- The hero review row, title mark, headline, or CTA are out of sequence, missing, resized outside the template bounds, or overlapping.
- The initial mobile shell eagerly loads welcome/features/content-block images instead of only the optimized hero image.
- The optimized mobile hero AVIF exceeds `80 KB`, or either first-two content-block AVIF exceeds `55 KB`.
- R2 readback does not prove same-origin R2 serving, expected content type, immutable cache, and the package R2 marker.
- The first two shell-owned blocks repeat again in the lazy continuation.
- Desktop receives an edge-added topper or review row without explicit approval.
- Desktop receives generated edge assets, a desktop shell, a desktop hero replacement, or desktop visual rewriting without explicit approval.
- Native GTM, direct `gtag.js`, direct Heap/Contentsquare, direct Ahrefs, or direct Resi Pixel remains while the record says Zaraz owns analytics.
- A reference replay or target run passes by permitting desktop direct analytics while the contract says all metrics are Zaraz-owned.
- Zaraz tools are enabled without consent-purpose assignment.
- The consent pill or preferences modal comes from a copied/local Worker fork instead of `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/widget.mjs`.
- A manual Zaraz loader is injected. Cloudflare Zaraz auto-injection owns the loader.
- An Ahrefs project/profile would be created before checking for an existing portfolio project.
- PSI is used before architecture/browser/network proof.
- Mobile PSI returns a measured score below reference parity. Do not call that timing, and do not keep modifying live.
- Any claim uses workers.dev, local preview, or cached proof as a substitute for the live production hostname.

## Phase 0: Reset Card

Write this before touching code, Cloudflare, WordPress, Zaraz, Ahrefs, GSC, Captain, or Data Pond.

```text
Property:
- Name:
- Property code:
- Domain:
- Governed identity source:

Goal:
- Current task:
- Target score:
- Target live URL:

Approved pattern:
- Mobile:
- Desktop:
- Analytics:
- Consent:

Source of truth:
- Specials:
- Phone and source-coded IDs:
- Reviews:
- Fonts:
- Brand colors:
- Content blocks:
- Awards/badges:

Live change scope:
- Worker:
- Routes:
- WordPress/admin changes:
- Zaraz changes:
- Ahrefs/GSC changes:
- Cache purge:

Required proof:
- Architecture:
- Mobile browser:
- Desktop browser:
- Source-coded URL:
- Analytics passive:
- Analytics interaction:
- Consent accept/reject:
- PSI mobile/desktop:
- SEO/AI:
- Captain/Data Pond:
- Rollback:

Stop conditions:
-
```

Pass condition: the reset card matches the user's latest instruction and the current records.

## Phase 1: Property Identity And Source Data

Resolve identity before implementation.

Required checks:

- Resolve property through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Confirm property code against `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
- Confirm live domain and any vanity domain routing state.
- Confirm Resi feed identity and source lookup records.
- Confirm VWS default phone.
- Confirm representative source-coded URL IDs and expected source phone overrides.
- Confirm official specials from the feed, not from the public specials page unless the feed is unavailable and the exception is approved.
- Confirm review source, count, rating, and review link. Prefer the live official Resi `property_rating` block when present.
- Confirm brand colors from native computed styles.
- Confirm exact font assets from the property site and whether they return `200`.
- Confirm first two content blocks, sequence, copy, images, awards, and mobile hidden-media behavior against the native page.

Stop if VWS is missing, the specials source is unknown, review source is stale, or the property identity cannot be resolved.

## Enhancement Ledger That Must Be Accounted For

This ledger exists to prevent the package from losing improvements made during separate attempts.

| Source | Keep In Package | Do Not Carry Forward |
| --- | --- | --- |
| TowneStone | Mobile-only standalone shell, Kinsta/Cloudflare DNS and SSL hygiene, GTM-to-Zaraz cleanup, GA4/Heap/Ahrefs/Resi bridge through Zaraz, phone number and Tracking Attributes cleanup, `llms.txt`, GSC/indexing, meta/OG/schema/stale identity audit, production cache proof. | Cloudflare DNS mistakes such as proxied prohibited IP targets. |
| The Vine | Lease-up brand-theme slots, property promo/drawer colors, real property fonts, no fake review row when absent, live mobile 100-reference behavior, desktop-native proof. | Assuming Venterra navy is the correct promo color for every property. |
| Calais | Standalone shell correction after integrated drift, full-height hero, first two shell-owned panels, continuation dedupe, feed-backed special copy and capitalization, sourced linked reviews with fractional stars, no TM mark, exact fonts, award/badge sequence, source-coded phone proof, Heap/Contentsquare verify guard. | Integrated native topper, hero-only rescue shell, font preload experiment that lowered PSI, public Specials-page scraping, one-off Worker patches. |
| Champions | Failure lessons, raw desktop HTML proof gate, compact consent pill pattern, protected fresh base manifest, no reuse of old experiments. | Old Champions prototype Workers, desktop topper, desktop shell, desktop asset generation, readiness claims from partial gates. |
| District/Ventana | Route-interception probe, package-health probe, no-query analytics smoke for WAF-sensitive domains, v6 Heap interaction-only package, rollback/evidence stop behavior, PSI no-score retry only when Lighthouse returns no score. | Synthetic query analytics proof without WAF bypass, continuing after route/package/analytics/PSI failure. |

## Phase 2: Live Baseline

Capture baseline before changing production.

Required baseline evidence:

- Live clean URL HTTP status, headers, and current Worker marker.
- Live mobile screenshot.
- Live desktop screenshot.
- Live mobile console/network summary.
- Live source-coded URL screenshot and phone proof.
- Native script inventory: GTM, gtag, Heap/Contentsquare, Ahrefs, Resi Pixel, Cloudflare/Zaraz.
- Native stylesheet/font sanity.
- Current PSI mobile and desktop.
- Current `llms.txt`, meta, OG, canonical, schema URLs, robots, sitemap.
- Current Ahrefs project/profile status.
- Current GSC property and indexing status.
- Current Captain/Data Pond status.

Suggested evidence folder:

```text
/Users/mark/Property_Analytics/reports/resi_edge_performance/MM-DD-YYYY/{property-slug}/baseline/
```

## Phase 3: Build The Proven Package

### Mobile Shell

The mobile shell must match the reconciled TowneStone/Vine reference contract:

- Edge-owned first view.
- Promo strip from feed special.
- Property branded promo color, not a generic default when native branding differs.
- Header with property name, call link, tour CTA, menu.
- Full-height hero: promo + nav + hero should fill the mobile viewport.
- Optimized same-origin or R2-owned LCP image with explicit dimensions, eager loading, and high fetch priority.
- The mobile hero is the only eager first-view image; welcome/features/content-block images use the canonical deferred loader.
- The generated mobile hero AVIF must be `80 KB` or less, and each first-two content-block AVIF must be `55 KB` or less.
- Linked review row when present: rating, count, link, and fractional stars from the authoritative review source.
- Live Better Live Easy art without a TM mark.
- Hero title typography from captured native computed styles.
- CTA typography, spacing, and button styling matched to the approved property pattern.
- First content block copied from the native content source.
- Second content block copied from the native content source.
- Award/badge included in the correct mobile sequence.
- Lazy native continuation after the shell-owned blocks.
- Continuation dedupe: native `hero`, `welcome`, and `apartment_features` or equivalent shell-owned sections must not appear again.

Do not ship a hero-only shell.

### Desktop Lane

Default desktop lane:

- Native desktop rendering remains visually native.
- No mobile topper.
- No edge-added review row.
- No generated desktop hero/image assets.
- No desktop shell, all-device shell, or desktop visual rewrite.
- Native analytics duplicates are removed or stripped surgically when Zaraz owns analytics.
- Desktop score must still be measured and recorded honestly as native pass-through unless a desktop shell is approved.

### Source Attribution

Use the governed source lookup:

- Build/read model: `/Users/mark/Property_Analytics/scripts/build_resi_source_lookup_table.py`.
- D1 publish: `/Users/mark/Property_Analytics/apps/api/scripts/resi_source_lookup_to_d1.py`.
- Worker resolver: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-source-attribution.js`.
- Test: `/Users/mark/Property_Analytics/scripts/test_resi_source_attribution.mjs`.

Rules:

- Clean URL displays VWS attribution phone.
- Source-coded URL displays the matching source phone.
- Do not display `officePhone` as a fallback.
- Phone must be correct everywhere visible, including header, drawer, hero CTA, sticky elements, schema, analytics payloads, and Resi bridge payloads when applicable.

### WordPress control path bypass

Reference incident record: `docs/RESI_EDGE_WORDPRESS_CONTROL_PATH_BYPASS_2026-08-14.md`.

Public marketing pages may use edge-owned shell rendering, native HTML cleanup, cookie stripping, asset rewriting, and analytics cleanup when the selected package requires it.

WordPress control paths must never use those optimization paths. They must pass through to the native origin transparently with no edge HTML rewrite, no analytics injection, no cache, no `Set-Cookie` stripping, and no Worker-followed redirect rewriting.

08/18/2026 protected-control clarification: when Cloudflare or the Resi Website Management Firewall intentionally returns an uncached `401`/`403` on WordPress control paths, that is acceptable proof only if the response has no Resi Edge markers, no `x-vtr` headers, and no cache hit behavior. The accepted security block is not permission to run shell rendering, cleanup, analytics, or caching on admin/API paths.

Required transparent paths:

- `/wp-login.php`
- `/wp-admin` and `/wp-admin/*`
- `/wp-json` and `/wp-json/*`
- `/xmlrpc.php`
- `/wp-cron.php`
- `/wp-comments-post.php`

Required method rule:

- Any non-`GET`/`HEAD` request must use transparent origin pass-through unless a current-task exception is explicitly approved and proved.

Required proof:

- Origin `/wp-login.php` sends `wordpress_test_cookie`, or the vanity control path is intentionally blocked by Cloudflare/Resi Website Management Firewall before WordPress is exposed.
- Public vanity `/wp-login.php` either sends `wordpress_test_cookie` or returns the approved uncached protected-control `401`/`403`.
- Public `/wp-login.php` does not include edge shell/topper/HTML-cleaner markers.
- Public `/wp-admin/` preserves the native WordPress redirect behavior instead of returning a cleaned `200` page, or returns the approved uncached protected-control `401`/`403`.
- Public control-path responses are `no-store` or native-equivalent and do not create Cloudflare cache hits.
- Public `/wp-json/` remains native JSON or returns the approved uncached protected-control `401`/`403`; it must contain no edge shell/topper/cleanup markers.
- The governed runner records this as `wordpress_control_path_bypass_proven` during live apply. If it fails after deploy, the package must roll back and stop.

### Analytics

Zaraz is the default owner. Required tools:

- GA4.
- Heap/Contentsquare, interaction-gated.
- Ahrefs Web Analytics.
- Resi attribution/event bridge.
- Cloudflare analytics/RUM posture.

Required cleanup:

- Remove in WordPress or strip at the edge: native GTM, direct `gtag.js`, direct Heap/Contentsquare, direct Ahrefs, direct Resi Pixel.
- Do not let native duplicate analytics leak on desktop pass-through.
- Current production Heap app id is `286627304`. Resi-provided native reference script calls `heap.load("286627304")` and fetches `https://cdn.us.heap-api.com/config/286627304/heap_config.js`; use this as the production-id reference for auditing, not as permission to paste a direct native Heap loader into Resi Edge packages.
- Any observed native Heap app id other than `286627304` is a cleanup finding unless Mark approves a current-task exception.
- Use Heap mode `interaction_only_queue_v6_input_only_cs_verify_home_204`.
- Use same-origin Contentsquare verify suppression at `/?vtr_cs_verify_suppressed=1` returning `204`.
- Do not inject a manual Zaraz loader. Cloudflare Zaraz auto-injection is the only loader path.
- Run live analytics smoke on the canonical homepage with no unique query unless an approved WAF bypass exists.
- Passive lab proof must show zero Heap/Contentsquare network before user intent.
- Interaction proof is separate and must not be used to explain away passive PSI failures.

### Consent

Cloudflare Zaraz CMP is required unless an approved alternate CMP exists.

The consent implementation is a shared standard. Use `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/contract.json` as the contract and `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/widget.mjs` as the only Worker-rendered pill. Do not paste a local consent script into a property Worker or manifest.

Current required visible pill:

- Version: `compact_shell_pill_v29_2026_08_20`.
- Visible text: `This website uses cookies`.
- Visible buttons: `Preferences`, `Accept`.
- Forbidden pill button: `Reject`.
- Preferences route: `zaraz.showConsentModal()`.
- Reject/management route: inside the Cloudflare/Zaraz preferences modal.

Required purposes:

- Analytics and Performance.
- Marketing and Leasing Attribution.

Required proof:

- Zaraz CMP enabled.
- Every enabled tool assigned to a purpose.
- First-visit consent UI visible.
- Preferences panel works.
- Reject leaves purpose-bound tools blocked.
- Accept grants purposes and sends queued events.
- No hidden/native Cloudflare modal breaks the page.

Run:

```bash
python3 scripts/audit_zaraz_consent_package.py --domain {domain}
```

### SEO And AI

Required checks:

- `llms.txt` exists, renders resolved links, includes at least one H1, and contains crawlable links.
- Meta title and description match the property.
- OG title, description, URL, and image match the property.
- Canonical URL is correct.
- Schema `url`, `@id`, `name`, `address`, `telephone`, `image`, `sameAs`, and `aggregateRating` are correct when present.
- No stale Apex West Midtown, `TX054`, or other wrong identity remains.
- Sitemap and robots are accessible.
- GSC property is present and indexing request/status is recorded.

## Phase 4: Pre-Deploy Gates

Run the governed plan command first. Plan is non-mutating and informational; it must not be treated as live-apply permission.

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code {CODE} \
  --domain {domain} \
  --mode plan
```

Pass conditions:

- Reset card is written.
- Governed identity resolves.
- Manifest/schema passes.
- Source page audit passes.
- VWS/source attribution, feed-backed special policy, reviews/fractional-stars, brand theme, real fonts, first two content blocks, awards, optimized asset manifest, Ahrefs existing project, Heap guard, GSC, Captain/Data Pond, static package validation, and rollback plan all pass.
- `stage_allowed` is true for the selected non-base target.
- `apply_allowed` remains false until staged setup proof passes.

Run the governed stage command before live apply:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code {CODE} \
  --domain {domain} \
  --mode stage
```

Stage is allowed to prepare non-route setup only:

- Generate, budget-check, and upload the mobile-owned asset package through the canonical generator/uploader. This includes hero AVIF/WebP and the first two shell-owned content-block AVIF/WebP assets. It does not generate desktop assets.
- Apply or confirm the governed Zaraz analytics package: GA4, Heap interaction-only mode, Ahrefs existing project tooling, and Resi event bridge from the manifest.
- Apply or confirm the governed Zaraz consent package before the consent audit. Consent is not audit-only; newly prepared domains must have Cloudflare Zaraz CMP enabled and enabled tools assigned to configured purposes before any route probe or Worker deploy.
- Re-audit Zaraz consent after setup.
- Build the exact deploy bundle that `apply` will use and run Wrangler dry-run against it. The bundle must include every shared runtime dependency, including `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/widget.mjs`, and must pass the `deploy_bundle_closure_verified` gate before any route probe is allowed.
- Capture The Vine reference replay as evidence before setup, but do not let a stale live reference page override the current shared package contract. The blocking gates are static package validation, generated bundle closure, and the selected target's live production proof. Do not run TowneStone, Champions, Calais, District, Ventana, Pilot, or any other non-Vine property as a stage blocker; those are normalization targets, not references.

If stage fails, stop. Do not route probe, deploy, generate desktop assets, manually upload fixes, or retry with altered behavior.

Only a green stage readout may return `apply_allowed:true`.

The only live apply command shape is:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code {CODE} \
  --domain {domain} \
  --mode apply \
  --require-live-proof
```

## Phase 5: Deploy And Purge

Deploy through Keeper-backed Cloudflare helpers. Do not create ad hoc credential paths.

Before full package deploy, the runner must prove route interception with the isolated probe gate:

- Deploy a temporary Worker only on `domain/__resi-edge-route-test*`.
- Confirm the test route returns the probe marker.
- Confirm the homepage is not intercepted by the probe.
- Delete the temporary Worker.
- Confirm the probe marker is gone after cleanup.
- Stop before full deploy if any probe or cleanup step fails.

Required deploy evidence:

- Route-interception probe summary.
- Worker version ID.
- Marker string.
- Routes attached.
- Package health endpoint proof at `/__resi-edge/health` after deploy propagation.
- Cache purge response.
- Clean live URL returns the new marker.
- Source-coded URL returns the new marker.
- Desktop live URL preserves native lane.
- Desktop live URL is visually styled in a browser and does not render as default/raw blue-link HTML.

If any live URL serves stale HTML after deploy, purge again and prove the clean URL. Do not call the deploy complete while stale content is visible.

Stop and roll back before browser acceptance if `/__resi-edge/health` does not return the canonical package id, target manifest domain, and target manifest property after the timed propagation window.

## Phase 6: Live Acceptance Proof

All proof must use the production hostname.

Required browser proof:

- Mobile clean URL screenshot.
- Mobile source-coded URL screenshot.
- Desktop screenshot.
- No horizontal overflow.
- Full-height mobile hero geometry.
- Promo/header/hero/content sequence proof.
- First two blocks present exactly once.
- Award/badge present in the correct sequence.
- Reviews row accurate and linked.
- Font requests return `200` or approved fallback is documented.
- Console errors reviewed.
- Failed requests reviewed.
- Native continuation lazy before scroll and loaded after scroll.
- Continuation dedupe proof.

Required analytics and consent proof:

- Passive network smoke passes.
- Interaction smoke passes when required.
- Ahrefs present through Zaraz and tied to the existing correct project/profile.
- GA4 tool present through Zaraz.
- Heap/Contentsquare does not load passively.
- Resi bridge/pixel behavior is accounted for.
- CMP audit passes.
- Browser accept/reject proof passes.

Required PSI proof:

- Mobile live production URL: 90+.
- Mobile live production URL: reference parity against the proven package, currently `98+` unless Mark approves a lower exception.
- Desktop live production URL: 90+.
- Save JSON and summary.
- A Lighthouse `500` or no-score result may use the runner's bounded no-score retry path. A measured score below target is not timing; it is a failed gate.
- If Google PSI no-scores an exact sample but a fresh/live mobile sample scores at or above the current parity target, preserve the no-score evidence as provider noise and let the scored fresh/live sample carry the gate.
- If PSI reports an unscored warning, do not fix it if the fix drops the primary score below target. Record it as known non-blocking unless a no-regression fix passes.

## Phase 7: Readout And Control Surface

Record a readout using `/Users/mark/Property_Analytics/docs/RESI_EDGE_PACKAGE_READOUT_TEMPLATE_2026-08-07.md`.

Update:

- Captain state.
- Data Pond Routing Ops property card.
- Evidence card paths.
- Gate state: live, done, running, blocked, approval-ready.
- Rollback marker and previous Worker version.
- Any approved exceptions.

Run repository guardrails:

```bash
python3 scripts/check_resi_edge_gate_coverage.py
bash scripts/check_pib_guardrails.sh
bash scripts/check_context_discipline.sh
```

## Reconciled Execution Order

No property has a fast path.

Current order:

1. Read memory, capability register, full audit, this runbook, reconciliation record, package contract, and the selected target manifest.
2. Run protected `BASE` plan only to confirm the canonical package still validates without mutation.
3. Capture The Vine reference replay as historical/golden evidence, then enforce the current shared package contract and the selected target's live proof. Treat TowneStone and all other properties as targets to normalize to the governed package unless Mark explicitly promotes a new golden source.
4. Select exactly one non-base target by current user instruction.
5. Write the reset card and run the target plan.
6. If the plan is green, run the target stage command and prove assets plus Zaraz setup before live route work.
7. If stage is green, run the single apply command with `--require-live-proof`.
8. If any gate fails, rely on runner rollback/evidence and stop. Do not patch, retry, or improvise.
9. If every gate passes, write the readout and update Captain/Data Pond/control-surface evidence.

Historical Champions and Calais records remain valuable as lesson evidence. The fresh Champions manifest is the protected base reference, not a mutable target and not a source of old implementation code.

## Completion Definition

A property is approval-ready only when this sentence is true:

The live production property has the current mobile shell package, native desktop lane, Zaraz analytics, Zaraz consent, source-attributed phone, SEO/AI cleanup, accurate source data, no visual drift, no duplicate analytics, 90+ mobile PSI, 90+ desktop PSI, and saved evidence for every gate.
