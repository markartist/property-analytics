# Resi Edge Central Topper Handoff Packet

Prepared: 08/31/2026  
Audience: a fresh Codex instance continuing this work  
Purpose: centralize the Resi Edge topper safely without repeating the failed Anatole canary

## Read This First

This packet is context and instruction only. It is not approval to deploy, upload, route, purge, mutate, or test other live properties.

Before any tool action, read these files in full:

1. `/Users/mark/Property_Analytics/AGENTS.md`
2. `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
3. `/Users/mark/Property_Analytics/docs/RESI_EDGE_CENTRAL_TOPPER_RUNTIME_PLAN_2026-08-31.md`
4. `/Users/mark/Property_Analytics/docs/RESI_EDGE_OPTIMIZATION_OPERATOR_HANDOFF_PACKAGE_2026-08-27.md`
5. This packet

After reading, state this boundary before acting:

> I will work on the Resi Edge central topper recovery only. I will not touch live routes, live Workers, R2 records, DNS, WordPress/Kinsta, dashboard production, analytics admin, Ahrefs, or any property other than Anatole unless Mark explicitly approves that exact action in the current task.

## Current State

The existing bundled Resi Edge property Worker path is the proven production model.

The central topper model was prepared on 08/31/2026 with:

- Central contract: `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json`
- Config-record builder: `/Users/mark/Property_Analytics/scripts/build_resi_edge_topper_config_records.py`
- Central service Worker: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-topper-service/worker.js`
- Thin property Worker: `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-thin-property-worker/worker.js`
- Deploy adapter support: `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py --topper-mode centralized`

Anatole at Norman (`OK4AN`, `anatoleatnorman.com`) was attempted as the first live central canary.

The canary failed visual/user proof.

Emergency recovery has already been completed:

- The Cloudflare Worker route `anatoleatnorman.com/*` was removed.
- Anatole Cloudflare cache was purged.
- Native Kinsta/Resi rendering was visually verified on desktop and mobile.
- Scope lock was cleared.

Do not re-enable Anatole's Worker route or retry centralization without explicit Mark approval.

## Incident Summary

What worked:

- Anatole config record generation worked after fixing the builder to include Wrangler `--remote`.
- Remote R2 config upload worked for `resi-edge-topper-config/ok4an-anatoleatnorman-com/current.json`.
- Central service deploy worked.
- Thin Worker deploy worked.
- Header/health checks passed.
- PSI was green during the canary.

What failed:

- The actual rendered page broke.
- Mark saw unstyled native markup, duplicated/raw nav/content, and broken page presentation.
- Header-level proof did not catch it.

Root cause:

The first central design centralized too much. The thin property Worker delegated all target traffic to the central service, and the central service became a full traffic handler:

- mobile topper rendering
- desktop pass-through
- native continuation
- non-target fallback
- special paths

That was not equivalent to the proven bundled Worker behavior in the browser. The central service should not own full traffic/origin behavior.

Correct lesson:

Centralize shared topper rendering, not property route/origin behavior.

## Non-Negotiables

Do not:

- Deploy anything live.
- Add or restore the Anatole Worker route.
- Upload R2 config/freshness records.
- Purge cache.
- Touch DNS.
- Touch WordPress or Kinsta.
- Touch GA4 Admin, Zaraz tools, Heap app config, Ahrefs, or Resi admin.
- Inspect, repair, rerun, or mutate any other property.
- Treat a health/header proof as success.
- Create property-specific runtime variants.
- Add desktop topper behavior.
- Add fallback analytics.
- Change the canonical bundled production path.

Do:

- Work locally first.
- Keep Anatole as the only test fixture unless Mark names another property.
- Preserve the proven bundled Worker as the reference.
- Add equivalence and visual-proof gates before any future live attempt.
- Use Keeper/KSM-backed Cloudflare helpers if a future approved action needs Cloudflare.
- Record failures honestly.

## Corrected Architecture

The next design should split responsibility like this.

### Property Worker Owns Traffic

The property Worker must own:

- target-host checks
- WordPress/admin/control-path bypass
- asset serving from R2
- desktop native pass-through
- native continuation
- route safety
- emergency fallback behavior

The property Worker must be able to serve a safe response if the central renderer is unavailable.

### Central Service Owns Rendering Only

The central service should own only:

- mobile topper HTML generation
- shared consent shell
- shared analytics bridge markup
- shared nav rendering
- shared promo-record consumption
- shared hero/config token consumption

It should not become the general request handler for desktop, admin/control paths, native continuation, or arbitrary page traffic.

The central service should expose a narrow endpoint such as:

```text
/__resi-edge/render/mobile-shell
```

or an equivalent service-binding request that clearly means:

> Given this property config record and original request context, return the mobile shell HTML and headers.

The property Worker should decide whether that rendered HTML is used.

## Required Local Work Before Any Live Canary

### 1. Build An Offline Equivalence Harness

Create a local test/harness that compares the proven bundled path against the proposed central-renderer path for Anatole.

It must compare:

- response status
- response headers relevant to Resi Edge
- mobile shell HTML structure
- body classes and core attributes
- consent markup
- analytics markers
- Heap production id `286627304`
- GA4 measurement id `G-K2Z8KHE00Z`
- absence of old Heap id `676880719`
- drawer nav labels and count
- `data-vtr-action`
- `data-vtr-surface`
- `data-vtr-element`
- `data-vtr-destination`
- phone/tour/apply/availability links
- promo edge-record behavior
- native continuation loader behavior

The equivalence harness must fail if the central path produces different visible structure from the bundled path unless the difference is explicitly intended and approved.

### 2. Add Browser Visual Proof Before Live

Add Playwright proof for both the bundled reference and the central-renderer candidate.

At minimum:

- mobile viewport screenshot
- desktop viewport screenshot
- CSS-loaded assertion
- no raw/unstyled native nav assertion
- no duplicated raw menu assertion
- no visible broken image icons in the first viewport
- no edge mobile shell on desktop
- mobile hero/header/topper renders as expected
- drawer opens and shows full nav
- consent pill renders bounded and usable

Header checks are not enough.

### 3. Add Regression Coverage For The Failure

The new test should fail if:

- central service handles desktop full-page traffic
- central service handles native continuation full-page traffic
- thin Worker delegates all target requests blindly
- mobile rendered proof passes while visible content is unstyled/raw
- `HEAP_JS_DEBUG=false` is misclassified as dev leakage
- `mobile_menu_open` is misclassified as missing `menu_open`

### 4. Keep Deployment Disabled Until Proof Passes

The deploy adapter should refuse `--topper-mode centralized --apply` unless central visual/equivalence proof exists for the selected manifest.

Do not add a new approval bureaucracy. Add a simple mechanical guard:

- central mode apply requires a current local proof artifact for that manifest and central runtime hash
- if the proof is missing or stale, refuse

## Anatomy Of The Failed Code Path

Inspect these files:

- `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-thin-property-worker/worker.js`
- `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-topper-service/worker.js`
- `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs`

The specific design flaw to look for:

- thin Worker delegates to `env.RESI_EDGE_TOPPER.fetch(...)` for broad target traffic
- central service then decides mobile/desktop/native handling

That should be narrowed.

The central service should not be the equivalent of `resi-edge-canonical-worker/worker.js`. It should be a renderer used by the property Worker.

## Evidence Paths

Failed canary and initial proof:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203254Z/live-proof/central-topper-canary-live-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203612Z/analytics-attribution-proof/analytics-attribution-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T203334Z/psi/`

Emergency restore:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204133Z/emergency-route-remove/emergency-route-remove.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204223Z/cache-purge/cache-purge.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204343Z/visual-restore-proof/visual-restore-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204343Z/visual-restore-proof/desktop.png`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/central-topper-canary/anatoleatnorman-com/20260831T204343Z/visual-restore-proof/mobile.png`

## Suggested Implementation Path

Step 1: Read and map current behavior.

- Read the canonical Worker and runtime.
- Read the central service and thin Worker.
- Identify exactly which behavior belongs in property Worker versus central renderer.

Step 2: Refactor locally only.

- Make the central service a render-only service.
- Keep desktop/native/admin/origin logic in the property Worker.
- Do not change the bundled production path.

Step 3: Add local proof.

- Build local central config record for Anatole.
- Run syntax/static validation.
- Run bundled-vs-central equivalence.
- Run Playwright visual proof.

Step 4: Harden apply guard.

- Make centralized apply require a fresh proof artifact tied to:
  - manifest path/hash
  - central service file hash
  - thin Worker file hash
  - runtime file hash
  - property code/domain

Step 5: Stop and report.

Do not request or perform live retry until Mark reviews the local proof.

## Future Live Retry Requirements

A future live Anatole retry needs explicit Mark approval in the current task.

Before retry:

- proof artifact exists and passes
- scope lock is set to Anatole only
- rollback path is route removal, not another experimental redeploy
- browser visual proof runs immediately after deploy
- if visual proof fails, remove the route immediately

Do not continue to any other property after Anatole.

## Reporting Template

Use concise reporting:

```text
Target: Anatole only.
Live mutations: none / or exact mutation.
Local proof: pass/fail.
Equivalence: pass/fail.
Visual proof: pass/fail.
Central service role: render-only / not yet render-only.
Thin Worker role: traffic owner / not yet traffic owner.
Blocked by: exact issue.
Next approval needed: exact next action.
```

## Tone And Operating Reminder

Mark is rightly frustrated by repeated drift and preventable misses. Do not reassure vaguely. Demonstrate control by keeping scope small, proof visible, and language precise.

The goal is not to be clever. The goal is to make the central topper boring, equivalent, and safe.
