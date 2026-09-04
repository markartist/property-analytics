# Resi Edge Canonical Upgrade Package

This folder defines the non-deviation contract for the Resi performance and migration package.

Active reconciliation source: `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`.

The package has one identity: `resi-edge-canonical-upgrade-package`.

08/31/2026 centralization update: the approved next architecture is a central topper service plus thin property Workers, governed by `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-central-topper-runtime.v1.json` and documented in `/Users/mark/Property_Analytics/docs/RESI_EDGE_CENTRAL_TOPPER_RUNTIME_PLAN_2026-08-31.md`. The current live default remains the bundled property Worker until Mark approves a named central canary. The central path exists to eliminate repeated per-property topper script updates; it is not permission to hotload an unversioned fleet script or mutate completed properties.

Rules:

- TowneStone and The Vine are read-only reference fixtures.
- A property run either passes every gate or stops.
- A failed gate is discussed before any further action.
- No live workaround, one-off Worker patch, desktop topper, or property-specific variant is allowed.
- Pilot (`pilot.venterradev.com`) is the first apply target before any production property.
- Production properties are not modified by hand.
- Property-specific topper scripts are not allowed.
- Freshness changes are data record updates, not runtime forks.

The required executable entry point is not built yet. Until it exists and passes reference replay, this package is gated and must not be used for live mutation.

Planned interface:

```bash
python3 scripts/run_resi_edge_upgrade.py --property-code TX4FC --domain townestoneat359.com --mode validate-reference
python3 scripts/run_resi_edge_upgrade.py --property-code TX4EK --domain thevinekyle.com --mode validate-reference
python3 scripts/run_resi_edge_upgrade.py --property-code PILOT --domain pilot.venterradev.com --mode plan
```

If any command fails, stop and review the evidence packet before continuing. Do not patch a live site by hand to make a failed run appear successful.
