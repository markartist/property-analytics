# Resi Edge Optimization Operator Handoff Package

Prepared: 08/27/2026  
Audience: another Codex instance or operator executing one Resi Edge property optimization  
Purpose: optimize a named live vanity property through the governed Resi Edge package without drift

## Read This First

This document is the operating packet for a single-property Resi Edge optimization run. It is not approval to optimize any property. It explains how to execute only the property/action Mark explicitly names in the current task.

Before any tool action, read:

1. `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
2. `/Users/mark/Property_Analytics/AGENTS.md`
3. `/Users/mark/Property_Analytics/docs/RESI_EDGE_RELEASE_CONTROL_RUNBOOK_2026-08-13.md`
4. `/Users/mark/Property_Analytics/docs/RESI_EDGE_OPTIMIZATION_MORNING_RUN_PACKET_2026-08-27.md`
5. This handoff package

After reading, state this boundary before acting:

> I will act only on the explicitly named property/action, use the governed Resi Edge runner, avoid completed-site audits or repairs, and stop on any real failed gate.

If the user has not named the exact property and action, stop. Do not infer the next property from the dashboard, memory, route state, or any discovered evidence.

## Absolute Authority Rules

The current user instruction is the only source of authority to act.

Supporting documents, report packets, dashboard state, Cloudflare state, and discovered evidence are context only. They do not authorize:

- looking backward at completed sites
- repairing completed sites
- rerunning successful properties
- changing another property
- changing the canonical runtime
- changing analytics behavior
- changing dashboard structure
- deploying a Worker
- touching WordPress, Kinsta, DNS, forwarding, or admin/control paths

Discovery is not scope. If something adjacent appears wrong, record the observation in the final report only if it directly affects the named property. Do not act on it.

## Current Package Components

Canonical runtime and Worker:

- Runtime: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs`
- Worker shell: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`
- Contract: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/contract.json`
- Central topper runtime plan: `/Users/mark/Property_Analytics/docs/RESI_EDGE_CENTRAL_TOPPER_RUNTIME_PLAN_2026-08-31.md`
- Central topper contract: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json`
- Central topper config builder: `/Users/mark/Property_Analytics/scripts/build_resi_edge_topper_config_records.py`
- Central topper service Worker: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-topper-service/worker.js`
- Central local proof harness: `/Users/mark/Property_Analytics/scripts/validate_resi_edge_central_topper_local.mjs`
- Traffic-owner property Worker for the central-renderer topology: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-thin-property-worker/worker.js`
- Release tokens: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json`
- Manifest schema: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-manifest.schema.json`
- Pilot/register evidence: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json`

Canonical runner and support tools:

- Main runner: `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`
- Scope lock helper: `/Users/mark/Property_Analytics/scripts/set_resi_edge_scope_lock.py`
- Active scope lock: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json`
- Pre-apply gate bundle: `/Users/mark/Property_Analytics/scripts/run_resi_edge_preapply_gates.py`
- Deploy adapter: `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py`
- Static package validator: `/Users/mark/Property_Analytics/scripts/validate_resi_edge_package_static.mjs`
- Release-control validator: `/Users/mark/Property_Analytics/scripts/validate_resi_edge_release_control.py`
- Gate coverage checker: `/Users/mark/Property_Analytics/scripts/check_resi_edge_gate_coverage.py`
- Process scenario audit: `/Users/mark/Property_Analytics/scripts/audit_resi_edge_rollout_process.py`
- Batch inventory audit: `/Users/mark/Property_Analytics/scripts/audit_resi_edge_rollout_batch.py`
- One-step hero refresh: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_refresh.py`
- Asset generator: `/Users/mark/Property_Analytics/scripts/generate_resi_edge_assets.py`
- R2 uploader: `/Users/mark/Property_Analytics/scripts/upload_resi_edge_assets_to_r2.py`
- Generated hero acceptance: `/Users/mark/Property_Analytics/scripts/accept_resi_edge_generated_hero_assets.py`
- Zaraz analytics package: `/Users/mark/Property_Analytics/scripts/apply_resi_zaraz_analytics_package.py`
- Zaraz consent package: `/Users/mark/Property_Analytics/scripts/apply_zaraz_consent_package.py`
- Live analytics smoke: `/Users/mark/Property_Analytics/scripts/smoke_live_analytics.py`
- PSI runner: `/Users/mark/Property_Analytics/scripts/run_resi_edge_prototype_psi.py`
- Dashboard snapshot builder: `/Users/mark/Property_Analytics/scripts/build_resi_edge_launch_dashboard_snapshot.py`
- Cloudflare promo sync routine: `/Users/mark/Property_Analytics/apps/api/src/platform/resi-edge/promo-record-sync.ts`
- Manual promo sync fallback: `/Users/mark/Property_Analytics/scripts/sync_resi_edge_promo_records.py`
- Cloudflare hero freshness routine: `/Users/mark/Property_Analytics/apps/api/src/platform/resi-edge/hero-freshness-sync.ts`
- Manual hero freshness sync trigger: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_freshness_sync_now.py`
- Cloudflare hero media refresh queue: `resi-edge-hero-media-refresh`
- Cloudflare hero media refresh consumer Worker: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-hero-media-refresh-worker/worker.mjs`
- Cloudflare hero media refresh canary runner: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_media_refresh_canary.py`

Dashboard:

- Dashboard source snapshot: `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/generated-snapshot.ts`
- Dashboard UI: `/Users/mark/Property_Analytics/apps/web/src/app/resi-edge/launch/launch-dashboard-client.tsx`
- Protected dashboard host: `https://launch.venterrawebops.com/resi-edge/launch`

Credential rule:

- Use Keeper/KSM-backed helpers only.
- Do not create local credential files.
- Do not paste or print secrets.
- Cloudflare/Wrangler credentials must resolve through `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`.

## Fixed Invariants

Every optimized property must receive the same package behavior. Only approved manifest data may vary.

Non-negotiables:

- No desktop topper.
- No property-specific Worker or runtime fork.
- No WordPress, Kinsta, DNS, forwarding, admin, or control-path mutation.
- No WordPress/admin/control-path caching or optimization.
- No direct native GTM, GA4, Heap, Ahrefs, Contentsquare, or Resi pixel loader.
- Analytics delivery remains Zaraz-owned.
- Production Heap id is `286627304`.
- GA4 proof is package-owned `page_view` plus Zaraz transport plus the manifest measurement id.
- GA4 `session_start` is diagnostic only and must not block rollout.
- Consent uses `compact_shell_pill_v29_2026_08_20`.
- Consent pill must keep the cookie icon, subdued `Preferences`, and visible `Accept`.
- Full drawer nav has 10 links unless source evidence proves otherwise.
- Drawer links must carry differentiated `data-vtr-action`, `data-vtr-surface`, `data-vtr-element`, and `data-vtr-destination`.
- Topper phone, tour, apply, and nav actions must preserve source-equivalent attribution values.
- Tour CTAs may be hidden only when Mark approves the exact property/action and that property's manifest explicitly sets `mobile_shell.navigation.tour_enabled:false`; preserve the stored `tour_url` for future re-enable. Do not infer this from lease-up status: Townestone (`TX4FC`) currently hides Tour because tours are unavailable, while The Vine (`TX4EK`) is also a lease-up and keeps Tour CTAs.
- Fonts must use same-origin Resi theme paths such as `/wp-content/themes/resi-child-theme/fonts/*.woff2`.
- Promo bars are included only when live source proof or Data Pond `propertyBannerSpecial` proves an active homepage promo.
- Current promo text comes from the edge promo record generated every `15` minutes from ThirtyLines `propertyBannerSpecial`; manifest promo text is fallback only and cannot satisfy final live proof.
- Hero media freshness is checked every `15` minutes by the Cloudflare API Worker scheduled handler when `RESI_EDGE_HERO_FRESHNESS_SYNC_ENABLED=true`, and it can be kicked immediately through the protected platform route `POST /v1/platform/resi-edge/hero-freshness/sync`. The routine compares accepted media-state records first, then manifest fallback. Manifest fallback must preserve the original baseline source hash across runs so same-URL byte changes become `refresh_needed`. Source image metadata must hash original image bytes with an image Accept header that does not advertise WebP/AVIF; native homepage HTML probes remain separate. Treat `refresh_needed` as a governed work signal only; it does not authorize regeneration, storage, queue sends, or live mutation by itself.
- The current production hero media refresh path is the proven generated-asset lane, normally entered through one command: `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_refresh.py --property-code CODE --domain example.com --apply`. The wrapper requires an exact property code/domain, resolves one matching active manifest, runs the working generation/upload/config/acceptance sequence, kicks the hero freshness monitor immediately, and saves closeout evidence under `/Users/mark/Property_Analytics/reports/resi_edge_performance/hero-refresh-one-step/<domain>/<run-id>/`. Use `--skip-monitor-sync` only when deliberately leaving the dashboard-facing monitor summary for the scheduled safety-net cron.
- The underlying steps remain explicit and inspectable: generate the named property's packet with `/Users/mark/Property_Analytics/scripts/generate_resi_edge_assets.py`, upload stable R2 assets with `/Users/mark/Property_Analytics/scripts/upload_resi_edge_assets_to_r2.py --apply`, refresh the named central config record with `/Users/mark/Property_Analytics/scripts/build_resi_edge_topper_config_records.py --manifest ... --upload`, then accept the generated packet with `/Users/mark/Property_Analytics/scripts/accept_resi_edge_generated_hero_assets.py --upload --readback`. The acceptance step verifies the live native hero source/source hash before writing `resi-edge-media-state/<property-code>-<domain>/current.json` and `resi-edge-hero-freshness/<property-code>-<domain>/current.json`.
- The Cloudflare hero media refresh producer remains disabled unless `RESI_EDGE_HERO_MEDIA_QUEUE_ENABLED=true` is intentionally set after Mark approves a named diagnostic scope. After the Axial miss, the Queue/Images consumer is not the default production refresh lane; diagnose Queue delivery and Worker mode activation before another property canary.
- If Mark explicitly approves a named queue canary, use `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_media_refresh_canary.py`. Run it without `--apply` first to generate a local source-hash/message packet; add `--apply` only after Mark has named the exact property/action. A canary may update only stable R2 hero asset keys, media-state, hero freshness, and run receipts. It must not mutate property Workers, routes, DNS, WordPress/Kinsta, source content, analytics, dashboard production, or locked PIB files.
- The hero media refresh Worker stages candidate assets under `resi-edge-media-refresh/_candidates/` and verifies candidate readback before stable asset promotion. Invalid messages and deterministic budget failures must write non-retryable failure receipts instead of retrying indefinitely.
- The next candidate topology is central render-only topper service plus traffic-owning property Workers. Until Mark approves a named central canary, the production default remains the existing bundled property Worker path.
- In the central topology, property-specific config/freshness records may vary; mobile topper behavior, consent, analytics markup, routing rules, and proof behavior must remain invariant. The central service must not own desktop, native continuation, WordPress/admin/control-path decisions, arbitrary route fallback, or origin fetching for non-render traffic.
- Centralized live apply is mechanically blocked unless `/Users/mark/Property_Analytics/scripts/validate_resi_edge_central_topper_local.mjs` has produced a passing current proof artifact whose manifest/runtime/central-service/property-Worker hashes match the selected target.
- For central renderer migration waves, do not run the full Anatole browser/continuation/PSI proof on every property. Use per-property scope locks, static validation, hash-tied local central proof, remote config record upload, centralized property Worker apply, fast live mobile/desktop/control/health readback, and lock clear. Reserve full browser/continuation proof plus PSI for representative shape classes or named risk cases.
- Drawer proof must check the selected manifest's full navigation count, with a minimum floor of `10`; do not hard-code Anatole's prior `10`-link count for properties whose approved manifest carries `11` links such as Champions, The Vine, or Townestone.
- Dashboard finalization is part of a successful apply closeout.
- Do not continue to another property after a failed gate.

## Scope Lock Requirement

The runner is closed by default. The active lock file is intentionally inactive until a current instruction names the target.

Before `plan`, `stage`, or `apply`, set the lock for only the approved property:

```bash
python3 scripts/set_resi_edge_scope_lock.py \
  --property-code CODE \
  --domain example.com \
  --modes plan stage apply \
  --reason "Mark approved CODE example.com for this optimization run."
```

For a one-mode approval, limit the mode:

```bash
python3 scripts/set_resi_edge_scope_lock.py \
  --property-code CODE \
  --domain example.com \
  --modes apply \
  --reason "Mark approved live apply for CODE example.com."
```

After the approved target is complete, clear the lock:

```bash
python3 scripts/set_resi_edge_scope_lock.py --clear --reason "Approved target complete."
```

The runner and deploy adapter write `scope-lock-validation.json` into evidence. If the lock is missing, inactive, expired, or names another property, the run must block before mutation.

## One-Command Pre-Apply Gate Bundle

Before live apply on a named target, generate the consolidated local readiness packet:

```bash
python3 scripts/run_resi_edge_preapply_gates.py \
  --property-code CODE \
  --domain example.com
```

This command is evidence-only. It resolves the exact active manifest, runs static package validation, gate coverage, named-property process scenario audit, batch inventory audit in inventory mode, central-topper local proof refresh, desktop-native visual gate refresh, deploy-bundle dry run, and read-only active scope-lock status.

It does not create the scope lock. If the lock is missing, inactive, expired, or pointed at another property/mode, the packet must remain blocked even when every local proof is green.

## Target Input Template

Fill this out before commands:

```text
Property name:
Property code:
Live vanity domain:
Manifest path:
Approved action:
Approved modes:
Approval source:
Promo posture:
Expected GA4 measurement id:
Expected Heap id:
Expected Ahrefs project id:
Known live special:
Known source phone:
```

Never substitute another property because it appears next alphabetically. If the named target and local queue disagree, the named target wins or the operator stops for clarification.

## Pre-Command Local Checks

These are local repository checks only. They do not inspect live completed sites.

Confirm the named manifest exists:

```bash
ls -l config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

Read only the named manifest:

```bash
jq '{target, analytics, mobile_shell: .mobile_shell, routing, rollback}' \
  config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

Confirm the manifest matches the named property:

```bash
jq -r '[.target.property_code, .target.property_name, .target.domain] | @tsv' \
  config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

Expected result:

- property code equals the approved code
- domain equals the approved domain
- property name is the intended property

If any value differs, stop. Do not fix the wrong manifest unless Mark explicitly approves that data correction.

## Static Validation

Run static validation for the named manifest:

```bash
node scripts/validate_resi_edge_package_static.mjs \
  --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

Static validation must pass before plan, stage, or apply.

If it fails:

1. Stop.
2. Preserve the output.
3. Report the failing validator and file path.
4. Do not patch the package or manifest unless Mark approves the exact correction.

## Draft-Only Manifest Promotion Checklist

Some remaining first-20 properties still start from Phase 2 draft manifests rather than active production manifests. A draft manifest is not runnable until it has been promoted with current live evidence for the named target only.

For a draft-only target, do this before `plan`:

- Copy/promote only the named target draft into `config/portfolio_resi_edge_stabilization/`.
- Capture and save a target-only live source harvest under that target's evidence folder.
- Replace every `required_before_apply`, draft notice, and draft-stage field.
- Set consent to `compact_shell_pill_v29_2026_08_20`.
- Keep production Heap id `286627304`; do not tolerate old/dev Heap ids in current source.
- Set GA4 status to Zaraz-owned current vanity and use the target's real measurement id and stream name.
- Set Ahrefs to the existing vanity project id when Web Analytics data-key evidence is present.
- Use first-party Resi font paths in schema form: `/wp-content/themes/resi-child-theme/fonts/*.woff2`.
- Store review `rating` as a number and review `count` as an integer, not strings.
- Use the canonical absent-promo source marker only when current live source proves no active homepage promo is rendered.
- Use file paths, not prose, for GSC/Captain/Data Pond evidence fields.

Then run static validation. If `plan` catches a manifest schema defect before mutation, treat that as a draft-promotion miss, correct only the named target manifest, rerun `plan`, and add the lesson here. Do not alter runtime, inspect completed sites, or start another property.

## Plan Mode

Set the scope lock first, then run plan:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode plan
```

Plan mode is allowed to gather preflight evidence for the named property. It must not mutate live Worker routes, DNS, forwarding, WordPress, Kinsta, R2, cache, Ahrefs, GA4, or dashboard state.

Plan must show:

- manifest loaded
- manifest schema valid
- identity resolved
- source page audited
- static package validation passed
- process scenario audit passed
- batch inventory audit passed
- consent classified correctly
- `apply_allowed` decision available after stage, not invented during plan

Plan failure rule:

- If a required plan gate fails, stop.
- Do not run stage.
- Do not repair another property.
- Do not change the canonical package.

## Stage Mode

Run stage only after plan is clean:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode stage
```

Stage may perform governed setup required for the named property, including asset/R2 preparation and Zaraz package setup, but it must not perform the final live Worker route apply.

Stage must prove:

- asset generation/upload passed
- R2 readback path is ready
- Zaraz analytics package applied/read back
- Zaraz consent package applied/read back
- deploy bundle validation passed
- mobile shell byte forecast is below `40,000`
- consent geometry is valid
- process scenario audit passed
- batch inventory audit passed
- `apply_allowed:true`

Stage failure rule:

- If stage fails, stop.
- Preserve the stage evidence path.
- Do not continue to apply.
- Do not trim content, remove nav, remove consent, or create a property-specific workaround unless Mark approves the exact correction.

## Live Apply Mode

Run apply only after stage passes and the current instruction approves live apply:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode apply \
  --require-live-proof
```

Live apply is the only step that may deploy the named property Worker route. It must use the canonical runner and deploy adapter.

Required proof includes:

- route interception probe
- live Worker deploy
- package health
- WordPress/admin/control-path bypass
- no desktop topper
- desktop native pass-through
- fresh desktop native visual gate artifact
- mobile shell proof
- browser visual/event proof
- source phone proof
- SEO/schema proof
- GA4/Zaraz proof
- Heap production id proof
- Ahrefs proof
- R2 asset readback
- cache purge
- Cloudflare analytics state record
- PSI mobile/desktop gate
- evidence packet
- dashboard finalization

Successful apply must show:

- `pass:true`
- `blocked:false`
- all required gates passed
- no failed gates
- no blocked gates

Direct deploy-adapter apply also requires the local desktop-native visual gate:

```bash
node scripts/validate_resi_edge_desktop_native_visual_gate.mjs \
  --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json
```

The latest artifact must be passing and hash-matched to the current manifest/runtime/Worker sources. It must prove `x-vtr-desktop-mode:native-passthrough`, no mobile shell on desktop, `0` direct `https://dam.getresi.co/` URLs after rendering, same-origin DAM proxy responses with `x-vtr-native-asset-repair: dam-proxy`, and visible native hero/media paint in Playwright.
- no not-run gates
- dashboard finalization passed
- final `apply-readout.json` written
- `phase-timings.json` written

If a live package gate fails:

1. Stop immediately.
2. Preserve the evidence path.
3. Do not continue to another property.
4. Do not invent a workaround.
5. Report the exact failed gate and rollback posture.

## Dashboard Finalization

Dashboard finalization is part of apply closeout. A successful apply is not done until the dashboard is current.

The runner refreshes:

- `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/generated-snapshot.ts`

Then it builds and publishes the launch dashboard with:

- `NEXT_PUBLIC_API_BASE_URL=https://launch.venterrawebops.com`
- `NEXT_PUBLIC_AUTH_PRIMARY=magic`
- Cloudflare Pages project `resi-edge-launch`

If all package gates pass but dashboard publish fails:

- Do not rerun the property apply.
- Treat it as dashboard-only finalization failure.
- Preserve `dashboard/dashboard-finalization.json`.
- Use the dashboard finalization retry path only.
- Do not roll back the optimized property unless a package gate failed.
- Retry only the Cloudflare Pages publish from the already-built `apps/web/out` using the Keeper-backed Wrangler helper.
- Write recovery evidence in the same apply packet, for example `dashboard/dashboard-finalization-recovery.json`, and verify `https://launch.venterrawebops.com/resi-edge/launch` returns HTTP `200`.
- Report the property as package-proof passed with dashboard publish recovered, not as a clean no-incident apply.

## PSI Rules

Current gate expectations:

- Mobile PSI target: `98+`
- Desktop PSI target: `90+`

The evidence packet preserves conservative gate results. The executive dashboard may display the highest successful captured sample for a simple visible number, but that display rule does not weaken the gate.

If PSI fails after bounded stabilization:

- Stop.
- Preserve PSI JSON and screenshots.
- Do not lower the threshold.
- Do not claim success.
- Do not continue to the next property.

## Analytics Rules

GA4:

- Use the manifest measurement id.
- Package-owned proof is `page_view`.
- Zaraz must own delivery.
- Do not use `session_start` as a blocker.
- Do not add direct `gtag.js`.
- Do not add GTM.

Heap:

- Production id must be `286627304`.
- Native direct Heap loaders must not be present.
- Heap/Contentsquare proof is interaction-gated.
- Passive smoke should not wake Heap/Contentsquare network calls.
- Preserve Heap environment variables as environment context only, not as direct native loaders.

Ahrefs:

- Use the manifest Ahrefs vanity project id.
- Do not create or change Ahrefs projects during property optimization unless Mark explicitly approves that separate action.

Zaraz:

- Retire superseded managed Resi Edge tools only for the named zone.
- Preserve unrelated/manual tools.
- Force-republish is part of the canonical package path.

## WordPress/Admin/Control Path Rules

Public mobile optimization must not affect WordPress control paths.

Required transparent/bypass paths:

- `/wp-login.php`
- `/wp-admin/*`
- `/wp-json/*`
- XML-RPC and cron/comment endpoints as covered by the runbook
- non-`GET`/`HEAD` requests

Acceptable proof:

- native WordPress behavior passes through, or
- intentional uncached security `401`/`403` with no Resi Edge shell/topper/cleanup markers and no `x-vtr` headers

If a control path is intercepted by the shell, stop.

## Mobile Shell Contract

Mobile shell must include:

- canonical edge marker
- release token marker
- package runtime marker
- property hero/media
- real property headline/subheadline
- review proof when available
- full drawer nav
- source-coded phone
- tour/apply/home CTA links
- consent pill and preferences modal
- analytics/data attributes

The shell must not:

- create horizontal overflow
- hide nav items
- remove source-equivalent link attribution
- clip hero title art
- remove the cookie icon
- make consent buttons inaccessible
- render desktop topper behavior
- duplicate native content blocks as visible shell content

## Promo Rule

Do not assume promo state.

Before setting promo data for a property:

- Check only the named property’s live source/evidence.
- Generate or verify the named property’s edge promo record from the latest Data Pond `propertyBannerSpecial` feed value.
- Prefer the Cloudflare scheduled routine evidence in R2; use the local sync script only as a manual/emergency fallback.
- Include a promo bar only when the live source or `propertyBannerSpecial` proves an active homepage promo.
- If Resi’s promo app is not rendering, record the posture as watch/follow-up, not as permission to invent a banner.
- Do not pass final proof on manifest fallback, stale edge promo records, missing edge promo headers, or a mismatch between `x-vtr-promo-present` and the rendered topper.

## Report Format After Each Property

Use this concise closeout:

```text
Property:
Domain:
Action:
Result:
Evidence:
Gates:
PSI:
Dashboard:
Elapsed:
Rollback:
Next:
```

Example:

```text
Property: Example Property (CODE)
Domain: example.com
Action: apply --require-live-proof
Result: passed
Evidence: /Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/example-com/apply-YYYYMMDDTHHMMSSZ/
Gates: 57/57 passed, 0 failed, 0 blocked, 0 not-run
PSI: mobile 100, desktop 96
Dashboard: finalized and published
Elapsed: 7m 18s
Rollback: not needed
Next: awaiting Mark’s next named target
```

Do not include long internal explanations unless Mark asks for them.

## Failure Report Format

Use this when anything fails:

```text
Property:
Domain:
Failed step:
Failed gate:
Evidence:
Mutation status:
Rollback status:
Stopped:
Needed decision:
```

Example:

```text
Property: Example Property (CODE)
Domain: example.com
Failed step: stage
Failed gate: deploy_bundle_closure_verified
Evidence: /Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/example-com/stage-YYYYMMDDTHHMMSSZ/
Mutation status: no live Worker route deployed
Rollback status: not needed
Stopped: yes
Needed decision: approve exact package/data correction or leave blocked
```

## Do Not Do This

These are known failure patterns:

- Do not run a route audit across completed optimized sites when asked to optimize the next site.
- Do not repair prior sites while working forward.
- Do not rerun a successful apply to refresh only the dashboard.
- Do not change the canonical runtime because one property looks different.
- Do not use old Champions, Calais, or pilot experiments as implementation sources.
- Do not remove nav items to make a layout pass.
- Do not alter desktop.
- Do not accept desktop-native media proof from headers alone.
- Do not treat a transient dashboard upload failure as a property package failure.
- Do not treat Resi-side promo rendering gaps as permission to create a promo.
- Do not treat GA4 automatic events as package proof.
- Do not continue after a real gate failure.

## Correct Handling Of Common Issues

Dashboard-only publish failure:

- Stop before the next property.
- Retry dashboard finalization only.
- Do not rerun property apply.
- If snapshot refresh and web build already passed, retry only `wrangler pages deploy out --project-name resi-edge-launch --branch main --commit-dirty=true` from `/Users/mark/Property_Analytics/apps/web` with `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`.
- Save the retry result beside the failed dashboard finalization and verify the custom host.

Stage asset too large:

- Stop.
- Correct the canonical asset generator only if the issue is a package-wide generator defect and Mark approves.
- Do not hand-compress or remove content for one property.

Consent geometry failure:

- Stop.
- Correct shared consent/token geometry only with approval.
- Do not create a local consent fork.

Missing GA4 bootstrap residue:

- The canonical package already supplies the non-network dataLayer handoff from the manifest measurement id.
- Do not add direct GA4 scripts.

Desktop score lower than expected:

- Confirm the desktop gate threshold and evidence.
- Do not optimize desktop through the topper.
- Do not change desktop behavior unless Mark explicitly opens that separate workstream.

Promo not rendering:

- Treat as Resi-side follow-up unless live source proves a property-owned promo should be represented.
- Do not invent or force a promo bar.

## Handoff Checklist

Before starting:

- Read memory and run packet.
- Confirm Mark named the exact property/action.
- Set the scope lock for the exact property/domain/mode.
- Read only the named property manifest.
- Run static validation.

During execution:

- Plan.
- Stage.
- Apply only after stage is green and live apply is approved.
- Stop on any real failed gate.
- Do not inspect or fix any other property.

After success:

- Confirm final evidence path.
- Confirm gate count.
- Confirm PSI.
- Confirm dashboard finalization.
- Clear the scope lock.
- Report concise closeout.

After failure:

- Preserve evidence.
- Clear the scope lock only after recording the failure state.
- Report exact failed gate and needed decision.
- Do not proceed to another property.

## Minimal Command Template

Replace `CODE`, `example.com`, and `example-com` only with the approved target.

```bash
python3 scripts/set_resi_edge_scope_lock.py \
  --property-code CODE \
  --domain example.com \
  --modes plan stage apply \
  --reason "Mark approved CODE example.com for this optimization run."

node scripts/validate_resi_edge_package_static.mjs \
  --manifest config/portfolio_resi_edge_stabilization/example-com.manifest.json

python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode plan

python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode stage

python3 scripts/run_resi_edge_upgrade.py \
  --property-code CODE \
  --domain example.com \
  --mode apply \
  --require-live-proof

python3 scripts/set_resi_edge_scope_lock.py --clear --reason "Approved target complete."
```

Only run the full template when Mark has approved the full sequence. If Mark approves only stage, set the lock for `stage` only and stop after stage.

## Final Reminder

This package exists because the proven Resi Edge system works when it stays narrow.

The operator’s job is not to be clever. The job is to execute the named property through the fixed package, preserve evidence, update the dashboard through the runner, and stop.
