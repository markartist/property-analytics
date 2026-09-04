# Resi Edge Master Runtime Sync Run Packet

Prepared: 08/25/2026
Run target: 08/26/2026 morning

## Purpose

Synchronize the already-live Resi Edge properties that are still serving the prior runtime onto the current canonical runtime baseline:

- Current master runtime: `2026-08-26.ga4-datalayer-bootstrap-v1`
- Current consent contract: `compact_shell_pill_v29_2026_08_20`
- Current Heap production app id: `286627304`
- Current release token: `2026-08-13.townestone-promo-bar-v2`

This is a runtime sync, not a redesign, not a desktop topper change, and not a property-specific Worker rebuild. The 08/26/2026 baseline includes the canonical byte-margin correction and dashboard retry discipline from The District Universal Boulevard plus the canonical GA4 dataLayer bootstrap correction proven on Carlyle Place.

## Current Read-Only Probe

Mobile HTML readback on 08/25/2026 showed:

- Anatole at Norman is already on `2026-08-25.explicit-ga4-pageview-v1`.
- Calais Midtown, Champions Green, The District Universal Boulevard, The Harrison, The Vine Kyle Parkway, Townestone at 359, and Ventana are still on `2026-08-20.shell-payload-optimizer-v1`.
- Those seven properties already show current consent `compact_shell_pill_v29_2026_08_20` and Heap production id `286627304`.
- Carlyle Place is not yet running the Resi Edge topper/runtime; it remains the next new-property candidate after the sync path is clear.

## 08/26/2026 Runtime Baseline Update

The shared runtime was advanced to `2026-08-26.mobile-shell-byte-margin-v1` after The District Universal Boulevard stage correctly stopped on `deploy_bundle_closure_verified` at `40,144 / 40,000` forecast bytes. The canonical fix lowered mobile shell forecast size without changing visible behavior, drawer inventory, consent behavior, analytics ownership, or desktop pass-through.

The current shared runtime is now `2026-08-26.ga4-datalayer-bootstrap-v1` after Carlyle Place proved that the package cannot rely on WordPress/Resi Elements native header residue for GA4 bootstrap proof. The Worker now supplies the non-network manifest GA4 dataLayer handoff when it is absent, while Zaraz remains the delivery owner. The runner also force-republishes canonical Zaraz analytics setup and accepts `republished` readback so no-diff configs cannot leave stale live bootstrap behavior.

Known post-fix forecast margins:

| Property | Domain | Forecast Bytes | Margin |
|---|---|---:|---:|
| The District Universal Boulevard | `thedistrictuniversal.com` | `39,761` | `239` |
| The Harrison | `theharrisonsandysprings.com` | `39,286` | `714` |
| The Vine Kyle Parkway | `thevinekyle.com` | `39,171` | `829` |
| Townestone at 359 | `townestoneat359.com` | `38,961` | `1,039` |
| Ventana | `ventanaapts.com` | `37,637` | `2,363` |
| Calais Midtown | `calaismidtownapartments.com` | `39,210` | `790` |
| Champions Green | `championsgreen-ga.com` | `39,205` | `795` |

District final apply evidence: `reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260826T152815Z`, `57/57` gates, PSI mobile `100`, desktop `91`, runtime health `2026-08-26.mobile-shell-byte-margin-v1`, dashboard deployment `https://58cca9e2.resi-edge-launch.pages.dev`.

Carlyle final apply evidence: `reports/resi_edge_performance/08-09-2026/carlyleplacesa-com/apply-20260826T171204Z`, live proof passed, PSI mobile `100`, desktop `93`, runtime health `2026-08-26.ga4-datalayer-bootstrap-v1`, dashboard deployment `https://52fdbc05.resi-edge-launch.pages.dev`.

## Sync Queue

| Order | Property | Code | Domain | Manifest |
|---:|---|---|---|---|
| 1 | Calais Midtown | `TX4MI` | `calaismidtownapartments.com` | `config/portfolio_resi_edge_stabilization/calaismidtownapartments-com.manifest.json` |
| 2 | Champions Green | `GA4CG` | `championsgreen-ga.com` | `config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json` |
| 3 | The District Universal Boulevard | `FL4DU` | `thedistrictuniversal.com` | `config/portfolio_resi_edge_stabilization/thedistrictuniversal-com.manifest.json` |
| 4 | The Harrison | `GA4TH` | `theharrisonsandysprings.com` | `config/portfolio_resi_edge_stabilization/theharrisonsandysprings-com.manifest.json` |
| 5 | The Vine Kyle Parkway | `TX4EK` | `thevinekyle.com` | `config/portfolio_resi_edge_stabilization/thevinekyle-com.manifest.json` |
| 6 | Townestone at 359 | `TX4FC` | `townestoneat359.com` | `config/portfolio_resi_edge_stabilization/townestoneat359-com.manifest.json` |
| 7 | Ventana | `TX4VE` | `ventanaapts.com` | `config/portfolio_resi_edge_stabilization/ventanaapts-com.manifest.json` |

## Before Any Live Action

Run and confirm all are green:

```bash
python3 scripts/validate_resi_edge_release_control.py
python3 scripts/check_resi_edge_gate_coverage.py
node scripts/validate_resi_edge_package_static.mjs --manifest config/portfolio_resi_edge_stabilization/calaismidtownapartments-com.manifest.json
python3 scripts/audit_resi_edge_rollout_batch.py --out reports/resi_edge_performance/process-audit-batch-20260826T-runtime-sync-preflight
bash scripts/check_pib_guardrails.sh
bash scripts/check_context_discipline.sh
bash scripts/check_property_identity_governance.sh
git diff --check
```

Do not proceed if any check fails.

## Per-Property Sequence

For each property in the queue:

1. Run `plan`.
2. Confirm `batch_inventory_audit_passed` and `process_scenario_audit_passed`.
3. Run `stage`.
4. Confirm staged setup gates are green and `apply_allowed:true`.
5. Run `apply --require-live-proof` only after the stage packet is green.
6. Confirm live package version reads `2026-08-26.ga4-datalayer-bootstrap-v1`.
7. Confirm WordPress/admin/control bypass, mobile shell, full drawer nav, Heap/Zaraz/GA4, consent, R2/cache, PSI, and dashboard finalization evidence.
8. Stop before the next property if any gate fails or dashboard finalization fails.

## Runtime Readback Probe

After each apply, the live mobile source must show:

- `data-vtr-edge-topper="canonical"`
- `data-vtr-package="2026-08-26.ga4-datalayer-bootstrap-v1"`
- `data-vtr-release-token="2026-08-13.townestone-promo-bar-v2"`
- `data-vtr-zaraz-consent-version="compact_shell_pill_v29_2026_08_20"`
- Heap id `286627304`

## Stop Conditions

Stop immediately and preserve evidence when:

- A plan, stage, static, process scenario, or batch inventory gate fails.
- A live proof gate fails.
- The package changes desktop behavior beyond native pass-through.
- A WordPress/admin/control path receives the public-page shell, optimization, analytics injection, cookie stripping, or cache rewrite.
- A property-specific runtime/Worker fork is required to make the run pass.
- The dashboard cannot be refreshed and published after a successful apply.

## Out Of Scope

- No desktop topper.
- No WordPress/Kinsta source mutation.
- No DNS or forwarding mutation.
- No new analytics owner.
- No direct WordPress GA4, Heap, Ahrefs, GTM, or Resi pixel loader.
- No manifest-data redesign unless a validator blocks and the fix is source-backed.
- No Carlyle live apply until the seven-property runtime sync path is complete or Mark explicitly changes the order.

## Morning Status Goal

At the end of the sync run, all optimized/live Resi Edge properties should report the current runtime:

- Anatole at Norman
- Calais Midtown
- Champions Green
- The District Universal Boulevard
- The Harrison
- The Vine Kyle Parkway
- Townestone at 359
- Ventana
- Carlyle Place

Carlyle Place is already proven on `2026-08-26.ga4-datalayer-bootstrap-v1`; use it as current evidence, not as a separate implementation source.
