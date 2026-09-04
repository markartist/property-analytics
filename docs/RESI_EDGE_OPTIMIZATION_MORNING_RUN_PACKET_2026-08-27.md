# Resi Edge Optimization Morning Run Packet

Prepared: 08/26/2026
Run target: 08/27/2026 morning

## Current State

The first 20-property launch is live, redirects are active, analytics hygiene is clean, and the protected dashboard at `https://launch.venterrawebops.com/resi-edge/launch` is live.

Optimized proof is complete for `10/20` properties:

- Anatole at Norman (`OK4AN`, `anatoleatnorman.com`)
- Axial Buckhead (`GA4AB`, `axialbuckhead.com`)
- Balmoral Village (`GA4BV`, `balmoralvillageapts.com`)
- Boulevard at Lakeside (`OK4BL`, `blvdatlakeside.com`)
- Canton Mill Lofts (`GA4CM`, `livecantonmill.com`)
- Carlyle Place (`TX4CP`, `carlyleplacesa.com`)
- Creekside (`OK4CS`, `creeksideapt.com`)
- Forest View (`TX4FV`, `liveatforestviewapts.com`)
- Links at Windsor Parke (`FL4WP`, `linksatwindsorparke.com`)
- Luma Headwaters (`FL4LH`, `lumaheadwaters.com`)

Most recent autonomous pair:

- Links at Windsor Parke apply packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/linksatwindsorparke-com/apply-20260827T003526Z/`, `57/57` gates, PSI mobile `100`, desktop `98`, apply elapsed `447.439` seconds.
- Luma Headwaters apply packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/lumaheadwaters-com/apply-20260827T004426Z/`, `57/57` gates, PSI mobile `98`, desktop `91`, apply elapsed `452.242` seconds.

## Next Queue

Continue alphabetically through pending optimization properties. Next candidates:

1. Park on Wurzbach (`TX4WZ`, `parkonwurzbach.com`)
2. Retreat at Kedron Village (`GA4KV`, `retreatatkedronvillage.com`)

Do one property at a time unless Mark explicitly approves a multi-property autonomous run.

## Fixed Invariants

- The runner is scope-locked. Before any `plan`, `stage`, or `apply`, set `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json` with `/Users/mark/Property_Analytics/scripts/set_resi_edge_scope_lock.py` for only the property/domain/mode Mark explicitly names in the current instruction. Clear it after that approved target is complete.
- No desktop topper.
- No property-specific Worker or runtime fork.
- No WordPress, Kinsta, DNS, forwarding, admin, or control-path mutation.
- No WordPress/admin/control-path caching or optimization.
- No direct WordPress-owned GA4, GTM, Heap, Ahrefs, Contentsquare, or Resi pixel loader.
- Analytics delivery remains Zaraz-owned.
- Production Heap id is `286627304`.
- Full drawer nav has 10 links unless source evidence proves otherwise.
- Consent uses `compact_shell_pill_v29_2026_08_20`.
- Fonts use same-origin Resi theme font paths.
- Promo bars are included only when the live source proves an active homepage promo.
- Dashboard finalization is part of successful apply closeout.

## Morning Sequence

For each property:

1. Read the active manifest if present.
2. If no active manifest exists, promote from live source evidence and current Phase 2 draft data only.
3. Confirm property identity through the governed matrix.
4. Confirm GA4 measurement, Heap id, Ahrefs project, source-coded phone, full nav, reviews, awards, SEO/meta, and promo posture.
5. Run static validation.
6. Run `plan`.
7. Run `stage`.
8. Run `apply --require-live-proof` only when stage passes and `apply_allowed:true`.
9. Confirm the final packet is `57/57` with no failed, blocked, or not-run gates.
10. Confirm dashboard finalization published and `https://launch.venterrawebops.com/resi-edge/launch` returns HTTP `200`.

## Do Not Repeat

- Do not inspect, audit, repair, rerun, or mutate completed properties unless Mark names that exact target. Discovered adjacent evidence is not scope.
- Do not rerun a completed successful property apply just to refresh the dashboard.
- Do not create fallback analytics or property-specific event paths.
- Do not reinterpret GA4 `session_start` as package-owned proof. It is diagnostic only.
- Do not trust draft manifests without promotion validation.
- Do not assume promo bars are absent or present without live source evidence.
- Do not treat a dashboard-only Pages upload issue as a property failure.

## Stop Conditions

Stop immediately and preserve evidence if:

- Any required plan, stage, or apply gate fails.
- The package would require a property-specific fork.
- Live proof shows desktop topper behavior.
- WordPress/admin/control paths are intercepted by the public mobile shell.
- Analytics proof shows direct native loaders or wrong Heap id.
- PSI fails the active gate after bounded stabilization.
- Dashboard finalization cannot publish after retry.

## Closeout Checks

After each successful property:

```bash
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://launch.venterrawebops.com/resi-edge/launch
bash scripts/check_context_discipline.sh
bash scripts/check_pib_guardrails.sh
bash scripts/check_property_identity_governance.sh
git diff --check
```
