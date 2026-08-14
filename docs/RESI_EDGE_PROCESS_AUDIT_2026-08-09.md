# Resi Edge Process Audit

Date: 08/09/2026
Status: Active audit of package process coverage
Scope: canonical package docs, Pilot manifest, runner, static validator, deploy adapter, and shared runtime

## 08/10/2026 Champions Base Supersession

Mark selected Champions Green (`GA4CG`, `championsgreen-ga.com`) as the full-functioning canonical base reference. This supersedes the earlier Vine/Pilot base path. The old Champions prototype Worker and old `champions-green-ga4cg.manifest.json` are historical evidence only and must not be reused as implementation source.

Current base facts:

- Base manifest: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`
- Base plan: `python3 scripts/run_resi_edge_upgrade.py --property-code BASE --domain championsgreen-ga.com --mode plan`
- Base plan status: preflight passes, `apply_allowed: false`, because Champions is a protected base reference and no separate target is selected.
- Static package validation: passes against the shared runtime, thin canonical Worker, and fresh Champions manifest.
- Concession smoke: passes for no active special, no sourced reviews, and no sourced awards. In those cases the package omits promo/review/aggregateRating/award output rather than rendering placeholders.
- No live mutation was made during this supersession.

This supersedes any lower text that treats Pilot or The Vine as the active base path. The remaining audit concern is whether the Champions-based package can apply to a separately selected target with every live proof gate wired and without improvisation.

## 08/11/2026 Enforcement Follow-Up

The current executable process has been tightened again after Ventana surfaced a final analytics-proof issue:

- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` now runs the governed Zaraz analytics package upsert before Worker deploy. If GA4/Heap/Ahrefs/Resi bridge setup fails, no Worker deploy is attempted.
- `/Users/mark/Property_Analytics/scripts/apply_resi_zaraz_analytics_package.py` now represents the current analytics contract: preserve existing tools, upsert GA4, Heap `interaction_only_queue_v6_input_only_cs_verify_home_204`, Ahrefs existing-project tooling, and Resi event bridge, with redacted before/after evidence.
- `/Users/mark/Property_Analytics/scripts/smoke_live_analytics.py` now uses a browser-like desktop user agent, records navigation status/final URL/document evidence, accepts multiple GA4 stream names, and supports canonical-homepage smoke through `--no-unique-query`.
- The runner now calls analytics smoke with `--no-unique-query` because District and Ventana showed that unusual synthetic query strings can trigger the Resi Website Management Firewall and produce false analytics failures.
- Manual Zaraz loader injection is forbidden. Cloudflare Zaraz auto-injection is the loader contract; a manual loader broke the mobile script-count gate during Ventana testing.
- Ventana remains not live-upgraded. The latest apply rolled back successfully after analytics proof failure. Before that final gate, the package had passed route/package health, cache/R2, mobile shell, desktop native/no-topper, source-coded phone, continuation, consent browser proof, SEO/AI, stale identity, and direct WordPress analytics stripping.
- Later same-day correction: Ventana's controlled retry passed all gates through analytics and failed only when mobile PSI returned Lighthouse `500`/no-score twice while desktop PSI scored `98/97`; rollback succeeded. The runner now distinguishes PSI no-score from a measured below-90 failure and will wait/retry the affected strategy only for no-score responses.

Current audit conclusion: the next target run is ready to be attempted through the runner, but it is not allowed to self-heal or continue after failure. A failed gate means rollback/evidence/stop.

## 08/11/2026 Parity And Asset-Budget Hardening

A second same-day audit found that the runner still allowed the wrong success shape: it could enforce the broad package gates while missing the exact high-score network profile proven by TowneStone, The Vine, and the corrected Calais package.

New executable controls:

- `asset_budget_manifest_present` is a preflight gate. The manifest must declare same-origin optimized AVIF paths for the mobile hero and first two content blocks, plus official source image URLs for those blocks.
- `asset_generation_upload_passed` is an apply gate before route probe or Worker deploy. The runner calls the canonical generator and R2 uploader; a failed build/upload blocks without touching the route.
- R2 readback now enforces role-specific byte budgets, image content type, immutable cache headers, and the package-owned R2 marker.
- Mobile shell validation now rejects eager `src` attributes for shell-owned content-block images and requires the canonical deferred image loader.
- Static package validation now checks that the runtime keeps deferred shell images and that the runner/generator/uploader retain the asset-budget and mobile parity machinery.
- PSI mobile now uses a reference-parity target of `98+`. Desktop remains `90+` unless Mark raises that floor. Measured below-target scores fail; retries are only for missing/no-score PSI service failures.

Current audit conclusion after this hardening: the process is much closer to the non-deviable package Mark asked for, but no future property should be called ready until the updated runner is executed and its evidence packet proves every new and existing gate on the live hostname.

## Verdict

The written process is comprehensive, but the executable process is not yet comprehensive enough to prevent another partial-package claim.

The shared runtime now contains the core shell functionality, and the Pilot preflight gates are clean. However, the current runner can still mark an apply run as passed after deployment plus a narrow HTML shell validator. That is not the same as the full package contract.

No further property should be called fully upgraded, exact, production-proven, or ready until the automated runner enforces the same gate list that the runbook and contract require.

## Findings

### P0 - Apply Can Pass Without The Full Contract

Contract requires 42 gates in `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/contract.json`, including source-fed specials, source-coded phone proof, real fonts, awards, native continuation dedupe, `llms.txt`, meta/OG/schema, GSC, Zaraz browser proof, Ahrefs lookup, Cloudflare analytics, R2 readback, cache purge, PSI, Captain/Data Pond, and rollback evidence.

The runner currently sets final apply success from `live_shell["pass"]` only. It does not require PSI, browser screenshots, consent browser behavior, Ahrefs readback, Zaraz network proof, cache purge/readback, R2 readback, Captain/Data Pond update, GSC/indexing record, or rollback readback.

Evidence:

- `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/contract.json` lines 30-72 list the full required gates.
- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` lines 425-447 sets `pass` from only `live_shell["pass"]`.

Required correction: `apply` must produce a per-gate ledger and fail unless every contract gate is `pass` or has an approved exception.

### P0 - `--require-live-proof` Is Parsed But Not Enforced

The CLI accepts `--require-live-proof`, but the runner does not branch on it or fail when it is absent. That makes the most important safety word decorative.

Evidence:

- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` line 455 parses `--require-live-proof`.
- No later code checks `args.require_live_proof`.

Required correction: `apply` should refuse to run without `--require-live-proof`, and proof mode should require the full live proof suite after deployment.

### P1 - Manifest Schema Is Too Shallow And Not Actually Used As JSON Schema

The schema only requires top-level objects and a few nested keys. It does not enforce the detailed runbook fields such as `gsc_property`, `ahrefs_existing_project_id`, `heap_app_id`, `font_assets`, `award_assets`, `captain_id`, `captain_evidence_path`, full source authority metadata, or proof artifact requirements. The runner also does not run a JSON Schema validator; it uses a manual `required_paths` list.

Evidence:

- `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-manifest.schema.json` lines 6-72.
- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` lines 57-162.
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_COLD_AGENT_NON_DEVIABLE_RUNBOOK_2026-08-08.md` lines 243-276 names required fields that are not enforced in the Pilot schema/runner.

Required correction: replace the shallow schema with a strict nested schema and validate it in the runner before any deploy.

### P1 - Real Font Proof Is Not Covered

The runtime can render manifest-provided `mobile_shell.fonts`, `body_font`, `title_font`, and `heading_font`, but the Pilot manifest does not define those fields and the validator does not prove that real first-party fonts return `200` or are used by computed styles.

Evidence:

- `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` lines 101-108 reads `mobile_shell.fonts`.
- `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` lines 253-255 defaults fonts when manifest values are absent.
- `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/pilot-ga4ax.manifest.json` has no font fields.

Required correction: manifest must include real font assets/tokens, and browser proof must capture computed fonts for header, promo, hero headline, review row, content headings, body, and buttons.

### P1 - Visual Proof Is Still Mostly HTML Inventory

The mobile shell validator checks HTTP, initial HTML weight, stylesheet/script counts, shell marker, native runtime blockers, DAM image references, direct analytics patterns, and desktop shell absence. It does not render screenshots, verify full-height hero geometry, compare hamburger/tour/button/font sizes, click/open promo/drawer/consent, scroll to continuation, or prove no duplicate first two content blocks.

Evidence:

- `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs` lines 78-179 inventory and evaluate raw HTML only.
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md` lines 66-90 require exact visual/mobile sequence.

Required correction: add Playwright proof as a mandatory runner gate before PSI.

### P1 - Platform Gates Exist But Are Not Wired Into The Runner

Useful platform audit scripts exist for Zaraz, Ahrefs, PSI, source lookup, R2 assets, cache purge, and Captain readiness, but the runner does not call them during `plan` or `apply`. Some were run manually for Pilot, which is not enough for a repeatable outside-agent process.

Evidence:

- `/Users/mark/Property_Analytics/scripts/audit_zaraz_consent_package.py` exists and performs a Keeper-backed Zaraz audit.
- `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py` exists and performs lookup-first Ahrefs project review.
- `/Users/mark/Property_Analytics/scripts/run_resi_edge_prototype_psi.py` exists for PSI.
- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` lines 340-447 do not call those gates.

Required correction: runner must orchestrate these existing tools and record their output in a single gate ledger.

### P1 - Deploy Adapter Deploys But Does Not Prove Post-Deploy Operations

The deploy adapter performs static validation and `wrangler deploy`. It does not preserve or read back the previous route, purge cache, verify route assignment/version, perform rollback-readiness proof, or run health endpoint readback.

Evidence:

- `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py` lines 92-125 deploy with Wrangler and write the deploy readout.
- `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/pilot-ga4ax.manifest.json` lines 212-215 records rollback strategy, but the runner does not execute rollback readback.

Required correction: deploy gate must include pre-deploy route snapshot, deploy version readback, health endpoint check, cache purge, clean URL proof, and rollback-readback artifact.

### P2 - Runtime Has Core Features, But Some Are Generic Defaults

Present and good:

- Fractional stars: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` lines 96-99.
- `llms.txt` with H1 and links: lines 137-180.
- Source-coded phone lookup and VWS fallback: lines 45-62.
- Theme colors: lines 118-134.
- Standalone mobile shell with promo/header/hero/reviews/content blocks/continuation: lines 246-314.
- Direct analytics stripping: lines 332-338.
- Identity/phone normalization: lines 341-346.
- Native continuation dedupe selectors: lines 349-356.
- Desktop native passthrough with consent pill: lines 400-416.

Remaining risk:

- The runtime default fonts to `Poppins` when manifest fonts are absent.
- Continuation dedupe selectors are currently fixed to `welcome` and `apartment_features`; future properties with different section identifiers need manifest-declared shell-owned section selectors.
- Meta/OG output is minimal; OG/Twitter image/title/description are not yet rendered by the mobile shell.

Required correction: make generic defaults explicit stop conditions where exact property tokens are required.

## Coverage Matrix

| Area | Written Contract | Runtime/Manifest Present | Runner Enforced | Status |
|---|---:|---:|---:|---|
| One canonical package | Yes | Yes | Partial | Mostly covered |
| No desktop topper | Yes | Yes | HTML-only | Needs browser proof |
| Mobile standalone shell | Yes | Yes | HTML-only | Partial |
| Exact visual geometry | Yes | Mostly | No | Gap |
| First two content blocks | Yes | Yes | Presence only | Partial |
| Awards/badges | Yes | No Pilot field | No | Gap |
| Real fonts | Yes | Runtime hook only | No | Gap |
| Fractional reviews | Yes | Yes | No browser proof | Partial |
| Source-coded phones | Yes | Yes | No live source-ID proof | Partial |
| Feed-backed specials | Yes | Manifest text only | No feed proof | Gap |
| Zaraz analytics | Yes | Manifest metadata | Manual only | Gap |
| Zaraz consent | Yes | Runtime pill + manifest | Config manual only, no browser gate | Gap |
| Ahrefs lookup-first | Yes | Manifest metadata | Manual only | Gap |
| Cloudflare analytics/RUM | Yes | Manifest metadata | No | Gap |
| `llms.txt` | Yes | Runtime route | No link validator in runner | Partial |
| Meta/OG/schema | Yes | Minimal schema/meta | No OG/schema scanner | Gap |
| GSC/indexing | Yes | No Pilot field | No | Gap |
| R2 asset readback | Yes | No runner step | No | Gap |
| Cache purge proof | Yes | No runner step | No | Gap |
| PSI 90+/90+ | Yes | Tool exists | No | Gap |
| Captain/Data Pond | Yes | No Pilot field | No | Gap |
| Evidence packet | Yes | Partial readouts | No full ledger | Gap |
| Stop-on-failure | Yes | Yes for current subset | Not for full gate set | Partial |

## Required Next Work Before Another Live Apply Claim

1. Add a strict nested manifest schema and run real schema validation.
2. Build a `resi_edge_gate_ledger` inside `run_resi_edge_upgrade.py` that maps every contract gate to `pass`, `fail`, `blocked`, or `approved_exception`.
3. Wire existing platform tools into the runner: Zaraz audit, Ahrefs lookup, PSI, R2 readback, cache purge, source attribution, Captain/Data Pond, and SEO scanners.
4. Add mandatory Playwright proof for mobile, source-coded mobile, desktop native, consent accept/reject/preferences, drawer/promo behavior, continuation scroll/dedupe, computed fonts, and screenshot capture.
5. Make `--require-live-proof` mandatory for apply.
6. Treat the current Pilot state as `preflight-ready only`, not complete.

## 08/09/2026 Enforcement Follow-Up

The runner has now been tightened for the first failure class from this audit:

- `run_resi_edge_upgrade.py` has a `resi_edge_gate_ledger_v1`.
- Plan mode separates preflight blockers from apply-only proof gates.
- Apply mode requires `--require-live-proof`.
- Static package validation is a separate preflight gate and cannot satisfy live browser gates.
- The manifest schema now requires GA4 measurement id, GSC property, first-party font declarations, awards declaration, review freshness, GA4/Heap/Ahrefs ownership details, SEO meta/OG values, and Captain evidence.
- The contract now includes `static_package_validation_passed`.

Current read-only proof:

```bash
python3 scripts/run_resi_edge_upgrade.py \
  --property-code PILOT \
  --domain pilot.venterradev.com \
  --mode plan
```

Result: exit code `2`, `apply_allowed: false`.

Current preflight blocker:

- `manifest_schema_valid`

Current unresolved Pilot facts:

- GA4 measurement id
- GSC property
- first-party font assets and body/heading font tokens
- awards/badge source declaration
- review `last_verified`
- Heap app id
- SEO meta title, meta description, and OG image
- Captain id and evidence path

Current apply-only proof gates still pending automation/live evidence:

- live mobile shell/browser proof
- source-coded phone proof
- desktop native render proof
- continuation dedupe and continuation content proof
- `llms.txt`
- meta/OG/schema/stale identity scan
- GSC/indexing record
- Zaraz browser consent proof
- GA4/Heap/Ahrefs/network analytics proof
- Cloudflare analytics state
- Resi event bridge proof
- R2 readback
- cache purge/readback
- PSI mobile and desktop 90+
- Captain/Data Pond update
- evidence packet completion

The package is safer because it now blocks incomplete work. It is not yet a fully automatic rollout until the remaining apply-only proof gates are wired into the runner.
