# Resi Edge Release Control Runbook

Last updated: 09/02/2026

## Purpose

This runbook controls how the Resi Edge mobile topper, analytics package, consent widget, freshness layer, and performance gates move across pilot properties without drift.

The source of truth is the canonical package, not per-property improvisation:

- Runtime: `ops/cloudflare/shared/resi-edge-package/runtime.mjs`
- Worker shell: `ops/cloudflare/resi-edge-canonical-worker/worker.js`
- Manifest schema: `config/portfolio_resi_edge_stabilization/resi-edge-manifest.schema.json`
- Release tokens: `config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json`
- Pilot register: `config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json`

## Current Canary

Townestone at 359 was the original token v2 canary for the versioned promo-bar package.

- Token version: `2026-08-13.townestone-promo-bar-v2`
- Manifest: `config/portfolio_resi_edge_stabilization/townestoneat359-com.manifest.json`
- Evidence: `reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260813T213750Z`
- Gates: `54/54` passed
- Mobile PSI: 100
- Desktop PSI: 97, native passthrough proof
- Health proof: `/__resi-edge/health` returns the active token version

Champions Green and Ventana have been promoted as live pilot proofs on the same token:

- Champions Green: `reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260813T220410Z`, `54/54` gates, mobile PSI 100, desktop native PSI 96.
- Ventana: `reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260813T221659Z`, `54/54` gates, mobile PSI 100, desktop native PSI 97.

08/25/2026 current package baseline: Anatole at Norman proved runtime `2026-08-25.explicit-ga4-pageview-v1` with explicit Zaraz-owned GA4 `page_view`, production Heap id `286627304`, normalized consent, no direct/native GTM, all `55/55` package gates passed, mobile PSI stability `100`, desktop native PSI stability `98`, and live dashboard optimized proof. Evidence: `reports/resi_edge_performance/08-09-2026/anatoleatnorman-com/apply-20260825T154926Z`.

Do not promote another property from the older Champions v1 evidence. New shared visual-token changes canary on the governed current package path first, then promote through `plan -> stage -> apply --require-live-proof`.

08/26/2026 morning run packet: before starting the next new property, level-set the seven already-live optimized properties that still serve `2026-08-20.shell-payload-optimizer-v1` to the current runtime `2026-08-25.explicit-ga4-pageview-v1`. Use `/Users/mark/Property_Analytics/docs/RESI_EDGE_MASTER_RUNTIME_SYNC_RUN_PACKET_2026-08-26.md`. This is a runtime sync only. It does not authorize redesign, desktop topper work, property-specific Worker forks, WordPress/Kinsta mutation, DNS/forwarding mutation, or bypassing any live proof gate.

08/26/2026 analytics proof correction: the canonical GA4/Zaraz proof is the shared package-owned `page_view` event emitted into `dataLayer`, Zaraz transport, and the expected GA4 measurement ID in the Zaraz bootstrap. GA4 `session_start` is an automatically collected reporting signal and may be recorded as diagnostic evidence, but it is not a Resi Edge package-owned proof and must not block rollout.

08/26/2026 current package baseline: The shared runtime is now `2026-08-26.mobile-shell-byte-margin-v1`. The District Universal Boulevard exposed a legitimate stage-time byte-forecast stop at `40,144 / 40,000`; the canonical runtime was tightened without changing visible behavior, drawer inventory, consent behavior, analytics ownership, or desktop pass-through. District final apply packet `reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260826T152815Z` passed `57/57` gates, live health readback, PSI mobile `100`, desktop `91`, and launch dashboard publication.

08/26/2026 current package baseline update: the shared runtime is now `2026-08-26.ga4-datalayer-bootstrap-v1`. Carlyle Place proved the next canonical correction: the package may not depend on native WordPress/Resi Elements `dataLayer` residue for GA4/Zaraz bootstrap proof. The Worker supplies the non-network GA4 dataLayer handoff from the manifest measurement id when missing, while Zaraz remains the analytics delivery owner and direct WordPress analytics loaders remain stripped. The runner force-republishes Zaraz analytics setup and accepts canonical `republished` readback. Active manifests must use same-origin Resi theme font paths; follow-up batch audit passed `9/9` after active manifests with older absolute font URLs were normalized. Carlyle apply packet `reports/resi_edge_performance/08-09-2026/carlyleplacesa-com/apply-20260826T171204Z` passed live proof with GA4/Zaraz, Heap `286627304`, control-path bypass, PSI mobile `100`, desktop `93`, and dashboard finalization.

08/26/2026 Axial Buckhead apply: Axial Buckhead (`GA4AB`, `axialbuckhead.com`) was promoted into the active production manifest set using only Phase 2 source/evidence data and the current canonical runtime. Do not use the old `pilot-ga4ax.manifest.json` as an implementation source. Axial apply packet `reports/resi_edge_performance/08-09-2026/axialbuckhead-com/apply-20260826T184200Z` passed `57/57` gates with runtime `2026-08-26.ga4-datalayer-bootstrap-v1`, GA4/Zaraz proof, Heap `286627304`, full drawer/event attributes, WordPress/control bypass, PSI mobile `100`, desktop `90`, 79 evidence files, and dashboard finalization published to `https://9b64aa4b.resi-edge-launch.pages.dev`.

08/26/2026 dashboard finalization sequencing correction: the runner now writes an interim successful `apply-readout.json` after all package gates pass and before dashboard finalization starts, then rewrites the final readout after dashboard finalization completes. This lets the dashboard snapshot builder include the property that just passed in the same apply run, without rerunning completed property processes. Axial dashboard-only correction published `https://0d34c344.resi-edge-launch.pages.dev` with Axial represented as optimized proof complete.

Dashboard-only recovery rule: if all property package gates pass and only launch dashboard finalization fails, recover with the dashboard finalization/publish retry path and preserve attempt evidence. Do not rerun the full property apply for a dashboard-only Cloudflare Pages transient.

08/26/2026 dashboard PSI display rule: optimized proof rows show one executive PSI number per strategy by selecting the highest successful captured sample from the property proof packet and any stability rechecks. This is a dashboard presentation rule only; package gates and evidence readouts still retain conservative minimum scores for proof and rollback posture. Dashboard-only refresh/publish produced `https://82b78962.resi-edge-launch.pages.dev` after retrying a Cloudflare Pages upload transport `EPIPE` with the current Wrangler release.

08/31/2026 promo freshness rule: active topper specials must come from the latest ThirtyLines `propertyBannerSpecial` value materialized into the edge promo record `resi-edge-promo/<property-code>-<domain>/current.json` in `RESI_EDGE_ASSETS`. Manifest promo fields are resilience fallback only and may not satisfy final live proof. The Cloudflare API Worker scheduled routine refreshes the edge records every `15` minutes and writes R2 run receipts. The local sync path `/Users/mark/Property_Analytics/scripts/sync_resi_edge_promo_records.py` is the manual/emergency fallback; it is evidence-only unless Mark approves `--upload`.

09/01/2026 hero media refresh rule: active hero freshness still checks every `15` minutes, but accepted Cloudflare refreshes now write media-state records at `resi-edge-media-state/<property-code>-<domain>/current.json`. Freshness checks compare media-state first, then manifest fallback. Queue production is disabled by default with `RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED=false`; the consumer Worker at `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-hero-media-refresh-worker/worker.mjs` must deploy disabled first, then process a named `canary` allowlist before any future `auto` promotion.

09/01/2026 same-URL hero source hash correction: hero source hashing must request original image bytes, not negotiated WebP/AVIF variants. The monitor and local collector use `Accept: image/jpeg,image/png,image/*,*/*;q=0.8` for source image metadata, while native homepage HTML probes may still request normal HTML. Manifest-baseline freshness records must preserve the baseline source hash across runs and compare future same-URL bytes against it. Accepted media-state remains the strongest baseline once present.

09/01/2026 desktop consent compact rule: the live desktop consent pill is intentionally compact on native passthrough pages to match the legacy visual footprint. The shared runtime owns the desktop-width size override; do not fork the widget per property. The approved live target dimensions are approximately `474x54` at a `1366x768` desktop viewport, with `15px` copy, `40px` buttons, visible cookie icon, visible `Preferences` and `Accept`, no old Reject button, and no mobile shell on desktop. Mobile compact mode and Zaraz consent behavior remain unchanged. Fleet proof: `/Users/mark/Property_Analytics/reports/resi_edge_performance/desktop-consent-compact/20260901T204100Z/live-compact-proof/live-compact-proof-summary.json`.

09/01/2026 desktop native DAM asset resilience rule: desktop remains native passthrough in layout and content, but safe `https://dam.getresi.co/...` native image/SVG URLs are rewritten to `/__resi-edge/native-dam-asset?src=...` so visitor browsers load them from the property domain. The property Worker fetches the DAM asset server-side and caches it with `x-vtr-native-asset-repair: dam-proxy`. Desktop proof must verify actual hero/media paint, `x-vtr-desktop-mode:native-passthrough`, `0` direct DAM URLs in rendered HTML, same-origin proxy URLs present, and `0` failed/bad DAM proxy responses. This rule was added after Balmoral exposed visitor-browser `ERR_NAME_NOT_RESOLVED` for DAM assets. Fleet proof: `/Users/mark/Property_Analytics/reports/resi_edge_performance/native-dam-proxy-hotfix/20260901T212100Z/live-fleet-proof/native-dam-proxy-live-fleet-proof.json`.

09/02/2026 desktop native visual release gate: `/Users/mark/Property_Analytics/scripts/validate_resi_edge_desktop_native_visual_gate.mjs` is now the local proof for desktop-native/DAM-proxy safety. It renders the current runtime against a native desktop fixture with DAM hero/media URLs, verifies `native-passthrough`, requires `0` direct DAM URLs after runtime cleanup, exercises `/__resi-edge/native-dam-asset?src=...`, and uses Playwright to prove the native hero/media actually paints. `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py --apply` now refuses to deploy until the named property's latest desktop gate artifact is passing and hash-matched to the current manifest, shared runtime, thin property Worker, and canonical Worker. Fresh artifacts exist for all `27` live property manifests under `/Users/mark/Property_Analytics/reports/resi_edge_performance/desktop-native-visual-gate/`.

09/02/2026 pre-apply gate bundle: `/Users/mark/Property_Analytics/scripts/run_resi_edge_preapply_gates.py --property-code CODE --domain example.com` is the one-command local readiness packet before live apply. It resolves the exact active manifest and runs static package validation, gate coverage, named-property process scenario audit, batch inventory audit in inventory mode, central-topper local proof refresh, desktop-native visual gate refresh, deploy-bundle dry run, and read-only scope-lock status. The wrapper writes `/Users/mark/Property_Analytics/reports/resi_edge_performance/preapply-gates/<domain>/<run-id>/preapply-gates.json`. It never creates a scope lock or mutates Cloudflare/R2; missing or mismatched scope lock is reported as a blocker because live apply remains explicit.

09/01/2026 Anatole hero media refresh canary: the queue/consumer lane passed for Anatole at Norman (`OK4AN`, `anatoleatnorman.com`) after the Worker learned to keep the `80,000` byte budget while searching lower WebP qualities for Cloudflare Images output. The consumer was returned to `disabled` after proof, and API queue production remains disabled. Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/hero-media-refresh-worker/anatoleatnorman-com/20260901T011706Z/anatole-hero-media-refresh-worker-canary-closeout.json`.

09/01/2026 hero media refresh process hardening: future named canaries should use `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_media_refresh_canary.py`. Its default mode is dry-run evidence only: governed identity resolution, matching manifest validation, source fetch/hash, and exact queue message preview. Live canary mode requires explicit `--apply` after Mark names the target; it performs queue create/keep, disabled deploy, canary deploy, queue/DLQ purge, one HTTP Queue message, deterministic R2 receipt polling, media-state/freshness/same-origin readback, and final disabled deploy. The Worker now stages candidates under `resi-edge-media-refresh/_candidates/`, promotes to stable asset keys only after candidate readback, and writes non-retryable receipts for invalid messages or deterministic budget failures instead of retrying forever.

09/01/2026 Axial hero media refresh canary stop: Axial Buckhead (`GA4AB`, `axialbuckhead.com`) dry-run passed, but live canary did not produce an accepted refresh. One attempt consumed as `skipped` while the Worker was effectively `disabled`; a later generated-config retry timed out without any run receipt, media-state, or candidate assets. Final disabled deploy succeeded as Worker version `49dfd44d-7f83-44d5-b44e-34f048423947`, and queue/DLQ cleanup purge passed. Diagnose Queue delivery and Worker mode activation before another property canary.

09/01/2026 Axial generated-asset refresh closeout: Mark directed returning to the proven method after the queue lane failed. Axial Buckhead (`GA4AB`, `axialbuckhead.com`) was refreshed through the generated-asset lane only: `generate_resi_edge_assets.py`, `upload_resi_edge_assets_to_r2.py --apply`, `build_resi_edge_topper_config_records.py --upload`, and new `/Users/mark/Property_Analytics/scripts/accept_resi_edge_generated_hero_assets.py --upload`. R2 readback now shows media-state `accepted` and freshness `current` / `recommended_action:none`; live same-origin readback matches AVIF `76,035` bytes SHA-256 `03c95603be913c3e177f843ff3b9d74d6df346d1b0c3159d26d922fd416b8ba0` and WebP `77,936` bytes SHA-256 `767400ba00e30ee43b371b3dd8349373f51f1b89dc83572e98c44505a334a89c`. Production default for hero refresh is the generated-asset acceptance lane. The Queue/Images consumer is diagnostic-only until Queue delivery and Worker mode activation are fixed.

09/01/2026 one-step hero refresh orchestrator: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_refresh.py` is now the normal operator entry point for a named production hero media refresh. Dry-run is default and writes local evidence without R2 mutation. `--apply` runs the proven sequence end to end: generate assets, upload stable R2 asset objects, upload the named central config record, accept media-state/freshness, manually kick the production hero freshness monitor, and require saved R2 plus same-origin hash readback. The command requires exact `--property-code` and `--domain` and refuses manifest mismatch. Use `--skip-monitor-sync` only when deliberately leaving the dashboard-facing monitor summary for the scheduled safety-net cron.

09/01/2026 manual hero freshness sync: `pop-brief-api` exposes protected `POST /v1/platform/resi-edge/hero-freshness/sync`, which runs the same freshness routine as the scheduled handler on demand. The operator wrapper `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_freshness_sync_now.py` resolves platform auth through Keeper/KSM, calls production, prints sanitized counts, and writes evidence under `/Users/mark/Property_Analytics/reports/resi_edge_performance/hero-freshness-manual-sync/<run-id>/`. Production proof run `20260901T190413Z` advanced `_latest-summary.json` immediately with `27/27` current and `0` refresh needed; cron remains the passive safety net.

## Release Layers

1. Runtime layer

   Shared behavior lives in `runtime.mjs`. Do not fork this per property.

2. Worker layer

   The canonical worker loads the shared runtime and property manifest data. Do not rebuild a property-specific worker to fix a single site.

3. Token layer

   Shared visual and policy values live in `resi-edge-release-tokens.v1.json`. Bar height, default colors, consent version, mobile-only rules, and analytics rules are changed here first. The runtime must expose the active token through the response header, body attributes, and `/__resi-edge/health`; the deploy bundle must include `release-tokens.json` so live Workers cannot silently use stale defaults.

4. Manifest layer

   Manifests provide property data only: property identity, domains, images, specials, reviews, awards, bullets, analytics IDs, and approved brand overrides.

   Promo copy must not be treated as a permanent manifest constant once the Data Pond feed exposes `propertyBannerSpecial`. The manifest may carry fallback CTA/link shape, but current special text is governed by the edge promo record generated from the latest feed snapshot.

   Lease-up tagline flexibility stays in this data layer. Use `mobile_shell.hero.title_mode: property_tagline_svg` only with a same-origin generated SVG, explicit `title_svg_lines`, dimensions, display width, visual-safe `title_svg_max_width_vw`, source font URL, and `title_svg_viewbox_bleed` when script glyphs have negative or overhanging path extents. The schema currently caps property SVG max width at `90vw`; `92vw` is rejected as visually unsafe for script flourishes even when the bounding box mathematically matches the headline. Use optional `mobile_shell.hero.headline_lines` when approved mobile composition requires fixed line breaks; keep `mobile_shell.hero.headline` as the plain metadata/accessibility source.

5. Evidence layer

   The rollout register records what is actually proven live. A manifest file is not proof.

6. Launch dashboard finalization layer

   A successful optimization apply is not complete until the launch dashboard is current. After all package gates pass, the runner refreshes `apps/web/src/lib/resi-edge-launch/generated-snapshot.ts`, builds the static launch web app with `NEXT_PUBLIC_API_BASE_URL=https://launch.venterrawebops.com` and `NEXT_PUBLIC_AUTH_PRIMARY=magic`, publishes Cloudflare Pages project `resi-edge-launch` through the Keeper-backed Wrangler helper by default, and writes `dashboard/dashboard-finalization.json` in the apply evidence packet.

   If dashboard finalization fails, stop before the next property and preserve the evidence. Do not roll back the live optimized property unless a package gate failed; dashboard publish failure is a finalization blocker, not a package rollback trigger. Use the runner's dashboard finalization retry evidence for exact transient Cloudflare Pages upload failures; do not rerun a full live apply only to refresh the dashboard. Use `--skip-dashboard-publish` only when Mark explicitly wants a non-publishing finalization rehearsal.

   For executive PSI display, optimized rows show the highest successful captured PSI score per strategy. Do not use that display rule to weaken the package gate; the gate ledger remains conservative and continues to preserve minimum proof values.

7. Promo freshness layer

   The Cloudflare API Worker refreshes active Resi Edge promo records every `15` minutes from the live ThirtyLines feed and writes both current property records and R2 summary receipts. Before final live proof on a package version that includes edge promo records, verify the named property record from `propertyBannerSpecial`. Live mobile shell proof must expose `x-vtr-promo-state`, `x-vtr-promo-source`, `x-vtr-promo-key`, and `x-vtr-promo-present`; manifest fallback, stale records, or DOM/header mismatch stop the run.

8. Hero media freshness layer

   The Cloudflare API Worker checks active Resi Edge hero media every `15` minutes when `RESI_EDGE_HERO_FRESHNESS_SYNC_ENABLED=true`, using native cache-busted homepage reads and `data-page-section="hero"` / `data-src` extraction. It writes R2 receipts under `resi-edge-hero-freshness/` and summary receipts. The same routine can be kicked immediately through `POST /v1/platform/resi-edge/hero-freshness/sync`; operators should use `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_freshness_sync_now.py` instead of waiting for cron after an approved hero refresh.

   The freshness comparison reads accepted media-state first at `resi-edge-media-state/<property-code>-<domain>/current.json`, then falls back to the manifest hero source. This makes an approved Cloudflare refresh the current baseline without forcing a manifest edit. When falling back to the manifest baseline, preserve the original manifest-baseline source hash across runs and compare future same-URL bytes against it; do not refresh the baseline hash merely because the URL stayed the same.

   Source image metadata must hash original image bytes, not a negotiated browser format. Use an image metadata request that prefers `image/jpeg,image/png,image/*,*/*;q=0.8` and does not advertise WebP/AVIF. The Vine proved why this matters: the same DAM conversion URL can return original JPEG bytes to generation and negotiated WebP bytes to monitor probes unless the Accept header is controlled.

   The production monitor must keep both the per-property record and dashboard-facing summary current. The Cloudflare API Worker scans active manifests with bounded concurrency, writes per-property freshness records, then writes `resi-edge-hero-freshness/_latest-summary.json` before the archived run receipt at `resi-edge-hero-freshness/_runs/<run-id>.json`. A successful monitor repair proof requires `_latest-summary.json` and the matching archived run to show the same current run id/counts.

   `refresh_needed` is a governed work signal; it does not authorize automatic image regeneration, config upload, Worker mutation, or route changes. The current production refresh lane is one command: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_refresh.py --property-code CODE --domain example.com --apply`. The wrapper generates the named property's packet, uploads stable R2 assets, refreshes the named central config record, accepts the generated packet with media-state/freshness upload and saved readback proof, then manually kicks the monitor summary so closeout does not wait for cron. Acceptance verifies the live native hero source/source hash before writing media-state and freshness records.

   The underlying commands remain available for diagnosis: `/Users/mark/Property_Analytics/scripts/generate_resi_edge_assets.py`, `/Users/mark/Property_Analytics/scripts/upload_resi_edge_assets_to_r2.py --apply`, `/Users/mark/Property_Analytics/scripts/build_resi_edge_topper_config_records.py --manifest ... --upload`, and `/Users/mark/Property_Analytics/scripts/accept_resi_edge_generated_hero_assets.py --upload --readback`.

   Queue production requires `RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED=true` and the `RESI_EDGE_HERO_MEDIA_REFRESH_QUEUE` binding. The consumer Worker starts with `RESI_EDGE_HERO_MEDIA_REFRESH_MODE=disabled`, may process only an approved property code/domain in `canary`, and may enter `auto` only after later explicit approval. The Queue/Images consumer is diagnostic-only after the Axial canary miss; do not use it as the default production refresh lane until Queue delivery and Worker mode activation are proven.

   Deploy `pop-brief-api` through `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py` so Cloudflare auth resolves through Keeper/KSM. Use `wrangler deploy --minify` for this API Worker until the bundle/deploy path is reduced; on 09/01/2026 repeated non-minified uploads failed with Cloudflare upload socket closes, while minified deploys succeeded and preserved behavior.

   Before a live canary, run `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_media_refresh_canary.py --property-code CODE --domain example.com` without `--apply` and inspect the local message/source hash packet. Add `--apply` only for the named target Mark approved. A canary may write stable R2 hero asset keys, media-state, hero freshness, and run receipts only, and must return the consumer to disabled.

9. Phase timing layer

   Every apply run writes `phase-timings.json` incrementally and includes `phase_timings` in the apply readout. The timing packet is required post-mortem evidence for each property and must show start/end/duration/status for preflight/static gates, reference replay, stage setup, route probe, live deploy, package health, WordPress/admin bypass, cache purge, R2 readback, live shell, browser acceptance, source/SEO/analytics proof, Cloudflare analytics, PSI, evidence packet, and launch dashboard finalization. Command evidence should also include command-level duration fields.

10. Promoted-manifest drift guard

   Active manifests must pass the runner's promoted-manifest drift guard before plan, stage, or apply. The guard blocks draft-only fields, stale consent versions, missing or generic GA4 stream names, non-configured/non-Zaraz GA4 status wording, non-production Heap app ids, incomplete drawer navigation, placeholder/script nav URLs, non-canonical leasing URLs, unverified/non-numeric Ahrefs vanity project ids, and rollback fields that do not explicitly preserve the no-WordPress-mutation boundary. This guard is protected by static validation and is not optional.

10. Process scenario audit layer

   The runner must pass `process_scenario_audit_passed` after static package validation and before any stage/apply path can continue. `/Users/mark/Property_Analytics/scripts/audit_resi_edge_rollout_process.py` is read-only: it imports the canonical runner validator, clones the target manifest in memory, injects known bad states, and fails unless those states are blocked by the existing guardrails. This prevents stale manifest, consent, GA4, Heap, nav, leasing URL, Ahrefs, rollback, desktop-topper, property-variant, phone-source, content-block, and asset drift from becoming a live-run discovery.

11. Batch inventory audit layer

   The runner must pass `batch_inventory_audit_passed` before any stage/apply path can continue. `/Users/mark/Property_Analytics/scripts/audit_resi_edge_rollout_batch.py` is read-only and rejects duplicate active production domain manifests, duplicate active production property-code manifests, filenames that do not match `target.domain`, release-token canary manifest references that no longer point at an active production manifest, and rollout-register references that point outside the active production manifest set. Dev pilot entries are excluded from production inventory checks by explicit domain/path rule only.

12. Explicit scope-lock layer

   Resi Edge `plan`, `stage`, and `apply` are closed by default. Before any property action, `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json` must be `ACTIVE`, unexpired, and must name the exact `property_code`, `domain`, and mode Mark approved in the current instruction. Create or clear the lock with `/Users/mark/Property_Analytics/scripts/set_resi_edge_scope_lock.py`. The runner and direct deploy adapter both refuse progression without the matching lock. This prevents discovered adjacent state from becoming unauthorized scope.

13. Desktop native visual gate layer

   Before direct deploy-adapter `apply`, run `/Users/mark/Property_Analytics/scripts/validate_resi_edge_desktop_native_visual_gate.mjs --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json`. The proof writes `latest-desktop-native-visual-gate.json` under `/Users/mark/Property_Analytics/reports/resi_edge_performance/desktop-native-visual-gate/<property-code>-<domain>/`.

   The deploy adapter compares that artifact to the current manifest, shared runtime, thin property Worker, and canonical Worker hashes. A missing, failed, or stale artifact blocks before route cleanup or Worker deploy. The gate must prove desktop native pass-through, no mobile shell on desktop, no direct browser-resolved DAM URLs, same-origin DAM proxy responses with `x-vtr-native-asset-repair: dam-proxy`, and visible hero/media paint in Playwright.

14. Pre-apply gate bundle layer

   Use this command before live apply on a named target:

   ```bash
   python3 scripts/run_resi_edge_preapply_gates.py \
     --property-code CODE \
     --domain example.com
   ```

   The command is local/evidence-only. It refreshes the central-topper and desktop-native visual local proofs, runs inventory/process/static/gate-coverage checks, performs the deploy-bundle dry run, and records read-only scope-lock status. A fully green packet means the operator can proceed to the governed apply step only if Mark has explicitly approved live apply and the lock already names the exact property/domain/mode.

## Non-Deviation Gates

These gates are mandatory:

- No desktop topper.
- No property-specific worker rebuild.
- No continuing after a failed gate.
- No protected reference mutation without explicit approval.
- No live apply without a successful stage.
- No WordPress login/admin/API control path may pass through public-page shell, cleanup, analytics injection, cookie stripping, or cache rewriting. `/wp-login.php`, `/wp-admin/*`, `/wp-json/*`, and non-`GET`/`HEAD` requests require transparent origin pass-through proof, or an intentional uncached Cloudflare/Resi Website Management Firewall `401`/`403` with no Resi Edge markers.
- No WordPress GTM, Heap, Ahrefs, or direct analytics scripts when Zaraz owns analytics.
- No local consent widget forks.
- No desktop consent enlargement without a canary and live compact-dimension proof; preserve the shared compact pill unless Mark explicitly approves a new visual size.
- No desktop-native media proof by headers alone; verify the native hero/media actually paints and that DAM asset references are same-origin proxied with no failed/bad proxy responses. Direct deploy-adapter `apply` must have a fresh hash-matched `desktop_native_visual_gate`.
- No live apply unless deploy-bundle validation passes both the conservative mobile shell byte forecast and the local compact consent geometry proof. The proof must render the generated bundle and confirm the cookie icon, `Preferences`, and `Accept` stay visible, in-viewport, and hit-testable on mobile widths.
- No final live proof may pass on manifest promo fallback. Current promo state must come from the named property's edge promo record, generated from Data Pond `propertyBannerSpecial`, unless the edge record explicitly proves no active promo.
- No promotion without live evidence.
- No promotion to the next property until launch dashboard finalization has refreshed, built, published, and written evidence.
- No stage/apply when `process_scenario_audit_passed` is missing, blocked, or failed.
- No stage/apply when `batch_inventory_audit_passed` is missing, blocked, or failed.
- No optimization readout is complete without `phase-timings.json` and `phase_timings` in the final or failed apply readout.
- No plan, stage, or apply may run from an active manifest that fails the promoted-manifest drift guard.
- No browser-chosen hero headline wrapping where approved composition requires fixed lines.
- No visible internal phone/source attribution labels. Codes such as `VWS`, `AH`, `GOA`, or channel IDs remain in manifest data, source-phone proof, and evidence only; the customer drawer may show the routed phone number but must not render the source label.
- No analytics-proof reinterpretation at rollout time. `ga4_zaraz_proof_passed` validates the invariant package mechanism: package-owned `page_view`, Zaraz transport, and the manifest GA4 measurement ID in the Zaraz bootstrap. Do not require GA4 automatic events such as `session_start` as live apply blockers.
- No Resi Edge plan, stage, apply, or direct deploy-adapter apply may run outside the active explicit scope lock. Do not inspect, audit, repair, rerun, or mutate completed properties unless Mark names that exact target.

Run:

```bash
python3 scripts/validate_resi_edge_release_control.py
node scripts/validate_resi_edge_package_static.mjs --manifest config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json
node scripts/validate_resi_edge_desktop_native_visual_gate.mjs --manifest config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json
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
- Re-run the batch inventory audit and process scenario audit before any property stage/apply.
- Prove the generated deploy bundle forecasts mobile initial HTML below the `40,000` byte gate before live apply. The governed runner writes this as `mobile_shell_byte_forecast` inside deploy-bundle validation; do not rely on manual manifest trimming as the scale fix.
- Canary on Townestone.
- Record evidence before touching any other pilot property.
- Existing live properties do not update automatically when `runtime.mjs` changes. Each property must be redeployed through the governed runner and live-read back with the expected `data-vtr-package` value.

WordPress control-path update:

- Read `docs/RESI_EDGE_WORDPRESS_CONTROL_PATH_BYPASS_2026-08-14.md`.
- Keep the bypass before homepage shell routing, native continuation rendering, desktop native cleanup, analytics cleanup, `Set-Cookie` deletion, and cache rewrites.
- Preserve native redirects with `redirect: "manual"` and disable cache mutations with `cf: { cacheEverything: false, cacheTtl: 0 }`.
- Prove `/wp-login.php` returns `wordpress_test_cookie`, `/wp-admin/` preserves the native login redirect, and `/wp-json/` remains native JSON without edge markers. If the control path is intentionally security-blocked before WordPress is exposed, prove an uncached `401`/`403` with no `x-vtr` headers and no Resi Edge shell/topper/cleanup markers.
- Future apply packets must include `wordpress_control_path_bypass_proven`; older evidence packets that predate 08/14/2026 do not prove this gate.

Asset pipeline update:

- Keep generation/upload in `scripts/generate_resi_edge_assets.py` and `scripts/upload_resi_edge_assets_to_r2.py`.
- Transient R2/Wrangler upload failures are retried inside the canonical uploader only. Do not bypass upload/readback gates, manually mark assets present, or continue to route work after a failed stage.
- Generated property tagline SVGs are part of the same R2 packet and must pass same-origin readback before live approval.
- Property tagline SVGs must not clip script flourishes. If path-backed text extends outside the nominal artboard, add manifest `title_svg_viewbox_bleed` and regenerate through `scripts/generate_resi_edge_assets.py`; do not reduce or reposition the tagline by hand.

Analytics or consent update:

- Update shared runtime/token contract.
- Keep Zaraz as owner for GA4, Heap, Ahrefs Web Analytics, and Cloudflare Web Analytics.
- Before analytics smoke, retire superseded managed Resi Edge Zaraz tools for the same zone. Preserve unrelated/manual tools, but do not allow older managed GA4, Heap, Resi bridge, or Ahrefs Web Analytics snippets to coexist with the current manifest-owned tool IDs; older Heap loaders can shadow the current interaction-only proof marker.
- Standalone native Heap environment/debug flags such as `window.HEAP_JS_DEBUG = true;` are allowed as environment preservation only. Do not classify them as direct native analytics loaders unless paired with a real native loader/config path such as GTM, `gtag/js`, `heap.load`, Contentsquare, Ahrefs Web Analytics, or Resi pixel scripts.
- Keep WordPress scripts removed or blocked.
- Re-test consent banner and preferences modal.
- Re-test analytics smoke before promotion.

Existing Worker rollback update:

- If the manifest routes through an existing Worker script, failed-gate recovery must not delete that script. The runner must read the generated `wrangler.toml` worker name, preserve evidence, and mark automatic delete rollback unsafe unless an explicit deployment rollback path has been approved.
- Per-domain canonical Workers may still use delete/readback rollback when they were created solely for that package target.
- Any failed gate still stops the rollout. Do not proceed to the next property just because the failed property appears visually healthy.

Freshness update:

- Harvest specials/reviews/awards/content from the governed feed or Cloudflare Browser Rendering worker.
- Write only to the shared KV/data path.
- The topper consumes normalized data; it does not scrape live pages at request time.
- Hero media refresh follows the Cloudflare queue/consumer lane only after named approval. The stale record is the trigger for a queued work item, not permission to mutate assets by itself.

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
