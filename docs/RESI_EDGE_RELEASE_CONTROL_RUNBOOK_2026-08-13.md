# Resi Edge Release Control Runbook

Last updated: 08/14/2026

## Purpose

This runbook controls how the Resi Edge mobile topper, analytics package, consent widget, freshness layer, and performance gates move across pilot properties without drift.

The source of truth is the canonical package, not per-property improvisation:

- Runtime: `ops/cloudflare/shared/resi-edge-package/runtime.mjs`
- Worker shell: `ops/cloudflare/resi-edge-canonical-worker/worker.js`
- Manifest schema: `config/portfolio_resi_edge_stabilization/resi-edge-manifest.schema.json`
- Release tokens: `config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json`
- Pilot register: `config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json`

## Current Canary

Townestone at 359 is the active token v2 canary for the versioned promo-bar package.

- Token version: `2026-08-13.townestone-promo-bar-v2`
- Manifest: `config/portfolio_resi_edge_stabilization/townestoneat359-com-v2-canary.manifest.json`
- Evidence: `reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260813T213750Z`
- Gates: `54/54` passed
- Mobile PSI: 100
- Desktop PSI: 97, recorded as native passthrough only
- Health proof: `/__resi-edge/health` returns the active token version

Champions Green and Ventana have been promoted as live pilot proofs on the same token:

- Champions Green: `reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260813T220410Z`, `54/54` gates, mobile PSI 100, desktop native PSI 96.
- Ventana: `reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260813T221659Z`, `54/54` gates, mobile PSI 100, desktop native PSI 97.

Do not promote another property from the older Champions v1 evidence. New shared visual-token changes canary on Townestone first, then promote through `plan -> stage -> apply --require-live-proof`.

## Release Layers

1. Runtime layer

   Shared behavior lives in `runtime.mjs`. Do not fork this per property.

2. Worker layer

   The canonical worker loads the shared runtime and property manifest data. Do not rebuild a property-specific worker to fix a single site.

3. Token layer

   Shared visual and policy values live in `resi-edge-release-tokens.v1.json`. Bar height, default colors, consent version, mobile-only rules, and analytics rules are changed here first. The runtime must expose the active token through the response header, body attributes, and `/__resi-edge/health`; the deploy bundle must include `release-tokens.json` so live Workers cannot silently use stale defaults.

4. Manifest layer

   Manifests provide property data only: property identity, domains, images, specials, reviews, awards, bullets, analytics IDs, and approved brand overrides.

   Lease-up tagline flexibility stays in this data layer. Use `mobile_shell.hero.title_mode: property_tagline_svg` only with a same-origin generated SVG, explicit `title_svg_lines`, dimensions, display width, visual-safe `title_svg_max_width_vw`, source font URL, and `title_svg_viewbox_bleed` when script glyphs have negative or overhanging path extents. The schema currently caps property SVG max width at `90vw`; `92vw` is rejected as visually unsafe for script flourishes even when the bounding box mathematically matches the headline. Use optional `mobile_shell.hero.headline_lines` when approved mobile composition requires fixed line breaks; keep `mobile_shell.hero.headline` as the plain metadata/accessibility source.

5. Evidence layer

   The rollout register records what is actually proven live. A manifest file is not proof.

## Non-Deviation Gates

These gates are mandatory:

- No desktop topper.
- No property-specific worker rebuild.
- No continuing after a failed gate.
- No protected reference mutation without explicit approval.
- No live apply without a successful stage.
- No WordPress login/admin/API control path may pass through public-page shell, cleanup, analytics injection, cookie stripping, or cache rewriting. `/wp-login.php`, `/wp-admin/*`, `/wp-json/*`, and non-`GET`/`HEAD` requests require transparent origin pass-through proof.
- No WordPress GTM, Heap, Ahrefs, or direct analytics scripts when Zaraz owns analytics.
- No local consent widget forks.
- No promotion without live evidence.
- No browser-chosen hero headline wrapping where approved composition requires fixed lines.
- No visible internal phone/source attribution labels. Codes such as `VWS`, `AH`, `GOA`, or channel IDs remain in manifest data, source-phone proof, and evidence only; the customer drawer may show the routed phone number but must not render the source label.

Run:

```bash
python3 scripts/validate_resi_edge_release_control.py
node scripts/validate_resi_edge_package_static.mjs --manifest config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json
python3 scripts/check_resi_edge_gate_coverage.py
bash scripts/check_pib_guardrails.sh
bash scripts/check_context_discipline.sh
```

The static package validator invokes the release-control validator. The standalone release-control command remains useful for quick diagnosis, but a normal static package gate must now fail if the token/register contract is broken.

## Change Types

Data-only property update:

- Edit only that property manifest.
- Run static validation.
- Stage.
- Apply only after stage passes and operator confirms live action.

Shared visual update:

- Edit `resi-edge-release-tokens.v1.json`.
- Do not edit property manifests unless data is missing.
- Run release-control validation.
- Run canary stage and live proof on Champions.
- Promote only after canary evidence is added to the rollout register.

Runtime behavior update:

- Edit shared runtime only.
- Re-run static validation and gate coverage.
- Canary on Townestone.
- Record evidence before touching any other pilot property.

WordPress control-path update:

- Read `docs/RESI_EDGE_WORDPRESS_CONTROL_PATH_BYPASS_2026-08-14.md`.
- Keep the bypass before homepage shell routing, native continuation rendering, desktop native cleanup, analytics cleanup, `Set-Cookie` deletion, and cache rewrites.
- Preserve native redirects with `redirect: "manual"` and disable cache mutations with `cf: { cacheEverything: false, cacheTtl: 0 }`.
- Prove `/wp-login.php` returns `wordpress_test_cookie`, `/wp-admin/` preserves the native login redirect, and `/wp-json/` remains native JSON without edge markers.
- Future apply packets must include `wordpress_control_path_bypass_proven`; older evidence packets that predate 08/14/2026 do not prove this gate.

Asset pipeline update:

- Keep generation/upload in `scripts/generate_resi_edge_assets.py` and `scripts/upload_resi_edge_assets_to_r2.py`.
- Transient R2/Wrangler upload failures are retried inside the canonical uploader only. Do not bypass upload/readback gates, manually mark assets present, or continue to route work after a failed stage.
- Generated property tagline SVGs are part of the same R2 packet and must pass same-origin readback before live approval.
- Property tagline SVGs must not clip script flourishes. If path-backed text extends outside the nominal artboard, add manifest `title_svg_viewbox_bleed` and regenerate through `scripts/generate_resi_edge_assets.py`; do not reduce or reposition the tagline by hand.

Analytics or consent update:

- Update shared runtime/token contract.
- Keep Zaraz as owner for GA4, Heap, Ahrefs Web Analytics, and Cloudflare Web Analytics.
- Keep WordPress scripts removed or blocked.
- Re-test consent banner and preferences modal.
- Re-test analytics smoke before promotion.

Freshness update:

- Harvest specials/reviews/awards/content from the governed feed or Cloudflare Browser Rendering worker.
- Write only to the shared KV/data path.
- The topper consumes normalized data; it does not scrape live pages at request time.

## Promotion Sequence

1. Validate release-control files.
2. Validate the canary manifest.
3. Stage canary with no live mutation.
4. Apply canary only after stage passes.
5. Capture live browser proof, PSI proof, analytics proof, consent proof, and rollback proof.
6. Update the rollout register.
7. Promote to the next pilot property only if the canary passes.
8. Stop and discuss if any gate fails.

## Rollout Cadence

The pilot stays capped until the package is stable. Future portfolio rollout is 20 properties every 2 weeks.

Every batch starts with the current canary, then proceeds property-by-property using the same stage/apply/evidence gates.
