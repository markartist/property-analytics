# Resi Edge Hero Media Refresh Worker

This Worker is the Cloudflare-native consumer for Resi Edge hero media refreshes.

## Role

- Consume `resi_edge_hero_media_refresh_queue.v1` messages from the `resi-edge-hero-media-refresh` queue.
- Transform the detected native hero source with Cloudflare Images into the stable mobile hero AVIF/WebP keys.
- Store accepted media state at `resi-edge-media-state/<property-code>-<domain>/current.json`.
- Update the matching hero freshness record to `current` after R2 write/readback succeeds.
- Write per-run evidence under `resi-edge-media-refresh/_runs/`.
- Stage candidate assets under `resi-edge-media-refresh/_candidates/` and prove candidate readback before promoting bytes to the stable production hero keys.

## Safety Model

The Worker is safe by default. `RESI_EDGE_HERO_MEDIA_REFRESH_MODE` must be set to `canary` or `auto` before queue messages can refresh assets.

- `disabled`: acknowledge/skips messages and writes skipped evidence.
- `canary`: refresh only if `RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST` contains the property code or domain.
- `auto`: refresh any valid queued active Resi Edge hero message.

The Worker does not mutate property Workers, routes, DNS, WordPress/Kinsta, source content, analytics admin, dashboard production, or locked PIB files.

09/01/2026 Anatole canary: `OK4AN` / `anatoleatnorman.com` passed after the WebP budget search was tightened for Cloudflare Images output. The canary wrote AVIF `79,600` bytes and WebP `77,938` bytes, accepted media-state, and freshness `current`; the deployed Worker was then returned to `disabled`.

09/01/2026 process hardening: deterministic run ids now produce predictable R2 receipt keys, invalid messages and deterministic budget failures write non-retryable failure receipts instead of cycling through queue retries, and successful refreshes use candidate staging/readback before stable asset promotion.

09/01/2026 Axial stop: `GA4AB` / `axialbuckhead.com` dry-run passed, but live canary did not produce an accepted media-state. The runner now handles Cloudflare's `already taken` queue-create wording and writes evidence-local Wrangler configs for disabled/canary mode, but the final generated-config retry still timed out without a receipt. Do not mark Axial refreshed through this lane; diagnose Worker/Queue delivery before another property canary.

## Cloudflare Resources

- Worker: `resi-edge-hero-media-refresh`
- Queue: `resi-edge-hero-media-refresh`
- Dead-letter queue: `resi-edge-hero-media-refresh-dlq`
- R2 binding: `RESI_EDGE_ASSETS` -> `resi-edge-assets`
- Images binding: `IMAGES`

Create the queues before deployment:

```bash
npx wrangler queues create resi-edge-hero-media-refresh
npx wrangler queues create resi-edge-hero-media-refresh-dlq
```

Deploy only through the Keeper-backed Wrangler environment helper used by this repository.

## Canary Runner

Use `/Users/mark/Property_Analytics/scripts/run_resi_edge_hero_media_refresh_canary.py` for future named canaries.

Default mode is a local dry run:

```bash
python3 scripts/run_resi_edge_hero_media_refresh_canary.py \
  --property-code OK4AN \
  --domain anatoleatnorman.com
```

Dry run resolves identity through the governed matrix, loads only the matching manifest, fetches the manifest hero source, hashes it, and writes the exact queue message preview under `/Users/mark/Property_Analytics/reports/resi_edge_performance/hero-media-refresh-worker/`.

Live mode requires explicit `--apply` after Mark names the target. The runner creates/keeps the queues, deploys the consumer disabled, deploys a one-property canary allowlist, purges queue residue, posts one HTTP Queue message using the Keeper-resolved Cloudflare token, polls deterministic R2 receipts, reads media-state/freshness/readback evidence, and returns the consumer to `disabled`.
