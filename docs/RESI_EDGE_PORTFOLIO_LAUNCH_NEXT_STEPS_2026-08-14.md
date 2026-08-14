# Resi Edge Portfolio Launch Next Steps

Status: Handoff for next project phase
Date: 08/14/2026
Owner: WebOps

## Current Package Baseline

The Resi Edge package is now a governed, reusable launch system. Future work should start from these sources, not from old per-property experiments:

- Contract: `ops/cloudflare/shared/resi-edge-package/contract.json`
- Runtime: `ops/cloudflare/shared/resi-edge-package/runtime.mjs`
- Canonical Worker: `ops/cloudflare/resi-edge-canonical-worker/worker.js`
- Runner: `scripts/run_resi_edge_upgrade.py`
- Static validator: `scripts/validate_resi_edge_package_static.mjs`
- Gate coverage validator: `scripts/check_resi_edge_gate_coverage.py`
- Release-control runbook: `docs/RESI_EDGE_RELEASE_CONTROL_RUNBOOK_2026-08-13.md`
- Property upgrade runbook: `docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md`
- Pilot register: `config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json`

## Non-Negotiable Behavior

- Mobile shell only. Desktop remains native passthrough/no topper.
- One shared runtime and one canonical Worker pattern. No property-specific Worker rebuilds.
- Property manifests are data only: identity, content, images, reviews, awards, specials, phone attribution, analytics IDs, and approved brand/font overrides.
- All analytics route through Zaraz: GA4, Heap/Contentsquare interaction-only, Ahrefs Web Analytics, Cloudflare analytics state, and Resi event bridge accounting.
- Compact shared consent widget only. No local consent forks.
- Source attribution codes such as `VWS` are internal only and must never render visibly to customers.
- WordPress control paths bypass edge optimization transparently.
- Failed gate means stop or rollback. Do not patch around a failed run.

## Current Pilot Learning

The last pilot upgrades proved the core model:

- Townestone proved the current promo-bar token and lease-up flexibility.
- Champions proved the standard stabilized package for a mature property after experimental history was discarded.
- Ventana proved the package can hit high mobile PSI while preserving native desktop.
- The Vine proved lease-up brand color/font flexibility, property tagline SVG behavior, and no-review concession handling.
- Calais exposed the WordPress control-path bypass requirement now folded into the package gate.

Older evidence packets may show `54/54` gates. Future packets must include the new `wordpress_control_path_bypass_proven` gate.

## Required Command Sequence

For any candidate property:

```bash
python3 scripts/validate_resi_edge_release_control.py
python3 scripts/check_resi_edge_gate_coverage.py
node scripts/validate_resi_edge_package_static.mjs --manifest config/portfolio_resi_edge_stabilization/PROPERTY.manifest.json
python3 scripts/run_resi_edge_upgrade.py --property-code CODE --domain DOMAIN --manifest config/portfolio_resi_edge_stabilization/PROPERTY.manifest.json --mode plan
python3 scripts/run_resi_edge_upgrade.py --property-code CODE --domain DOMAIN --manifest config/portfolio_resi_edge_stabilization/PROPERTY.manifest.json --mode stage
python3 scripts/run_resi_edge_upgrade.py --property-code CODE --domain DOMAIN --manifest config/portfolio_resi_edge_stabilization/PROPERTY.manifest.json --mode apply --require-live-proof
```

Do not skip `stage`. Do not run `apply` without `--require-live-proof`.

## Next Engineering Work

1. Re-run the active pilot cohort through the updated package when practical so each fresh packet includes `wordpress_control_path_bypass_proven`.
2. Promote the freshness system from isolated KV producer to governed runtime input only after adding stale-data fallback, D1 evidence history, alerting, and visual proof.
3. Add Data Pond readout fields for the new WordPress control-path gate, freshness age, current token, active evidence folder, and latest mobile PSI.
4. Convert remaining property manifests from pilot examples into a batch-ready manifest queue with identity, source URL, Ahrefs legacy project, GSC/Captain status, R2 asset plan, review source, award source, and special source.
5. Add a batch preflight that reports blockers without mutation across the next 20-property cohort.
6. Keep Cloudflare Web Analytics/RUM policy explicit per domain. RUM may be disabled where it hurts PSI; state must still be recorded.
7. Keep Ahrefs lookup-first. Use the legacy/project-code profile where it exists; do not create duplicate Ahrefs projects during rollout.
8. Keep WordPress admin/login proof in the live gate for every apply.

## Stop Conditions

Stop and discuss before live apply if any of these happen:

- Manifest identity does not resolve through the governed property identity matrix.
- Source page has stale property identity.
- Specials, reviews, awards, or phone attribution are unsourced or conflicting.
- Zaraz ownership is not confirmed.
- Ahrefs existing profile cannot be identified.
- R2 readback fails.
- Browser proof shows visual drift, missing content blocks, wrong SVG/tagline, wrong phone, visible internal attribution label, or desktop topper.
- `/wp-login.php`, `/wp-admin/`, or `/wp-json/` fails transparent bypass proof.
- PSI fails after the bounded retry policy.

## Rollout Plan

Stay capped at the pilot set until the updated gate is proven on fresh packets. Then roll out 20 properties every 2 weeks using the same run sequence and register updates.
