# Resi Edge Central Topper Runtime Plan

Prepared: 08/31/2026  
Status: Render-only central topology is live across the active Resi Edge property set; future property changes use fast per-property checks with representative full proof. Townestone has an approved per-manifest no-tour exception; The Vine keeps tours. The Cloudflare-first hero media refresh queue/consumer lane has passed an Anatole canary and is disabled after proof.

## Purpose

Centralize only the Resi Edge mobile topper renderer so future topper behavior changes can be proven once before promotion, while each property Worker keeps route, origin, desktop, native-continuation, and fallback ownership.

## Current State

The existing governed apply path builds a property-specific deploy bundle by copying:

- `ops/cloudflare/shared/resi-edge-package/runtime.mjs`
- `ops/cloudflare/shared/resi-consent-widget/widget.mjs`
- `config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json`
- the selected property manifest

This has been safe for rollout proof, but it means a shared topper improvement still requires a property Worker redeploy for every live site.

## Target State

Use one shared mobile topper renderer and traffic-owning property Workers:

- Central service Worker: `ops/cloudflare/resi-edge-topper-service/worker.js`
- Thin property Worker: `ops/cloudflare/resi-edge-thin-property-worker/worker.js`
- Central contract: `config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json`
- Config record builder: `scripts/build_resi_edge_topper_config_records.py`

The property Worker owns the live traffic boundary:

- target host check
- WordPress/admin/control-path bypass
- R2 asset serving
- same-origin native asset repair
- Contentsquare suppression path
- `llms.txt`
- desktop native pass-through
- native continuation
- emergency origin fallback if central rendering is unavailable
- central config key selection
- service-binding delegation only for mobile homepage shell rendering

The central service owns only invariant mobile topper rendering:

- mobile shell rendering
- consent integration
- Zaraz-owned analytics bridge
- promo record consumption
- hero freshness record awareness

08/31/2026 Townestone visibility update: the shared renderer now supports `mobile_shell.navigation.tour_enabled:false` to hide only rendered mobile header/drawer Tour CTAs for a named property whose tours are not available yet. The flag defaults to enabled, preserving Tour CTAs for tour-enabled lease-ups such as The Vine Kyle Parkway (`TX4EK`, `thevinekyle.com`). Townestone proof evidence is `/Users/mark/Property_Analytics/reports/resi_edge_performance/townestone-tour-hide-hotfix/20260831T221301Z/live-proof/central-topper-live-proof.json`.

The central service must not own:

- desktop pass-through
- native continuation
- WordPress/admin/control-path decisions
- arbitrary route fallback
- origin fetching for non-render traffic

## Data Contract

Every property receives one central config record:

```text
resi-edge-topper-config/<property-code>-<domain>/current.json
```

That record is built from the approved manifest and includes only tokenized property data:

- target identity and URLs
- routing metadata
- mobile shell content and nav
- phone attribution
- analytics identifiers and ownership
- consent version
- SEO facts
- promo record key
- hero freshness record key

Freshness records remain data records:

```text
resi-edge-promo/<property-code>-<domain>/current.json
resi-edge-hero-freshness/<property-code>-<domain>/current.json
```

Hero media freshness is checked every `15` minutes by the Cloudflare API Worker scheduled handler when `RESI_EDGE_HERO_FRESHNESS_SYNC_ENABLED=true`. That check writes freshness records and summaries only by default. It is media-state aware: accepted refresh baselines live at:

```text
resi-edge-media-state/<property-code>-<domain>/current.json
```

When no accepted media-state exists, freshness falls back to the manifest hero source. This lets approved Cloudflare refreshes become current without requiring a manifest rewrite.

The future refresh queue is:

```text
resi-edge-hero-media-refresh
```

Queue production is disabled by default with `RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED=false`. When Mark approves a named canary, a new `refresh_needed` transition may enqueue a `resi_edge_hero_media_refresh_queue.v1` message for the standalone consumer Worker at `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-hero-media-refresh-worker/`. The consumer starts in `disabled` mode, can be promoted to `canary` for an allowlisted property code/domain, and writes stable R2 hero assets, media-state, hero freshness, and run receipts only after native-source SHA verification and R2 readback pass.

09/01/2026 Anatole canary result: the Cloudflare Queue consumer path passed for Anatole at Norman (`OK4AN`, `anatoleatnorman.com`). The canary initially exposed a Cloudflare Images WebP budget edge case; the Worker now keeps the strict `80,000` byte cap while searching lower WebP qualities when needed. Accepted assets: AVIF `79,600` bytes and WebP `77,938` bytes. Media-state is accepted and freshness is current with baseline `media_state`. Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/hero-media-refresh-worker/anatoleatnorman-com/20260901T011706Z/anatole-hero-media-refresh-worker-canary-closeout.json`.

The runtime behavior is not rewritten when specials or hero source facts change.

## Safe Promotion

Do not hotload an unversioned fleet script.

The live default remains the existing bundled property Worker until Mark approves a central canary. The first canary should:

1. Build config records locally.
2. Upload only the named canary config record.
3. Deploy the central topper service.
4. Run a single named property through `--topper-mode centralized`.
5. Prove health, control-path bypass, mobile shell, desktop pass-through, consent, analytics, promo freshness, hero freshness, PSI, and rollback.

Only after that should the default migration path change from bundled to centralized.

## Non-Negotiables

- No desktop topper.
- No property-specific topper scripts.
- No property-specific runtime forks.
- No direct WordPress/GTM/GA4/Heap/Ahrefs/Resi analytics loaders.
- Zaraz remains the analytics delivery owner.
- Production Heap id remains `286627304`.
- Consent remains `compact_shell_pill_v29_2026_08_20`.
- Promo data comes from ThirtyLines `propertyBannerSpecial` edge records.
- Hero freshness is detected and reported; Cloudflare image asset regeneration remains disabled until a named queue/consumer canary is approved.
- Completed properties are not touched unless Mark names them.

## Validation Commands

Build local central config records:

```bash
python3 scripts/build_resi_edge_topper_config_records.py
```

Validate the canonical package and central contract:

```bash
node scripts/validate_resi_edge_package_static.mjs --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json
python3 scripts/validate_resi_edge_release_control.py
```

Validate a future centralized deploy bundle without live mutation:

```bash
python3 scripts/resi_edge_deploy_adapter.py \
  --validate-bundle \
  --topper-mode centralized \
  --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

## Current Boundary

Anatole at Norman (`OK4AN`, `anatoleatnorman.com`) passed the corrected render-only central canary on 08/31/2026. The canary used:

- Remote R2 config record: `resi-edge-topper-config/ok4an-anatoleatnorman-com/current.json`
- Central service Worker: `resi-edge-topper-service`
- Thin property Worker: `resi-edge-canonical-anatoleatnorman-com`
- Service binding: `RESI_EDGE_TOPPER`
- Asset/config binding: `RESI_EDGE_ASSETS`

The first central attempt failed visible-page proof after header/contract proof had passed and was emergency-restored. The corrected topology keeps the property Worker as traffic owner and makes the central service render-only. A later Anatole canary passed visible continuation proof and remains live on the central render-only topology.

Mark then clarified the next rollout target as the five pilot properties plus The Vine and Townestone only:

- Champions Green (`GA4CG`, `championsgreen-ga.com`)
- Ventana (`TX4VE`, `ventanaapts.com`)
- The Harrison (`GA4TH`, `theharrisonsandysprings.com`)
- The District Universal Boulevard (`FL4DU`, `thedistrictuniversal.com`)
- Calais Midtown (`TX4MI`, `calaismidtownapartments.com`)
- The Vine Kyle Parkway (`TX4EK`, `thevinekyle.com`)
- Townestone at 359 (`TX4FC`, `townestoneat359.com`)

The fast rollout passed for all seven on 08/31/2026 with evidence at `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-rollout/fast-first-five-plus-vine-townestone/20260831T215136Z/central-topper-fast-rollout-summary.json`.

The current boundary still excludes WordPress/Kinsta/DNS, forwarding, GA4 Admin, Zaraz tool config, Heap app config, Ahrefs, dashboard production, source content, and locked PIB file mutation.

09/01/2026 Cloudflare media refresh update: the queue and dead-letter queue now exist in Cloudflare, and the consumer Worker has been deployed/proven on Anatole, then returned to `RESI_EDGE_HERO_MEDIA_REFRESH_MODE=disabled`. API queue production remains disabled. Before the next live canary, name the exact property/action, deploy the consumer in `canary` for that property code/domain, enable only the approved producer path, and return the consumer to disabled after proof.

Future expansion remains property/action scoped. Do not infer another target from dashboard state or adjacent evidence. For migration waves, use per-property scope locks, static validation, hash-tied local central proof, R2 config upload, centralized property Worker apply, fast live mobile/desktop/control/health readback, and lock clear. Run full browser/continuation proof plus PSI only for representative shape classes or named risk cases.

## Canary Evidence

08/31/2026 Anatole header/contract proof initially passed:

- thin health
- central health
- mobile topper
- desktop central pass-through without desktop topper
- WordPress/admin bypass
- promo edge-record read
- Zaraz/GA4/Heap markers
- full mobile drawer attribution
- CTA/phone attribution
- PSI mobile exact `100`, mobile fresh `100`, desktop exact `100`, desktop fresh `99`

But the canary failed visual/user proof: broken native-continuation/native content became visible. Header-only proof is not sufficient for centralization.

08/31/2026 local recovery proof passed with no live mutation:

- `/Users/mark/Property_Analytics/scripts/validate_resi_edge_central_topper_local.mjs`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-local-proof/ok4an-anatoleatnorman-com/20260831T212330Z/central-topper-local-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-local-proof/ok4an-anatoleatnorman-com/latest-central-topper-local-proof.json`

This local proof does not authorize a live retry. It only proves the corrected local design and enables the deploy adapter to recognize a current hash-tied proof artifact.

Emergency restore evidence:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204133Z/emergency-route-remove/emergency-route-remove.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204223Z/cache-purge/cache-purge.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204343Z/visual-restore-proof/visual-restore-proof.json`

Evidence paths:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203254Z/live-proof/central-topper-canary-live-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203612Z/analytics-attribution-proof/analytics-attribution-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203334Z/psi/`
