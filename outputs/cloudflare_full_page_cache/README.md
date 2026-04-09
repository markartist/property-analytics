# Cloudflare Full-Page Cache Dry Runs

This directory stores rendered Cloudflare cache-rules plans and applied-state snapshots for the Resi pilot full-page cache rollout.

## Purpose

Use these exports to preserve exactly what the rollout tooling intended to create or update in Cloudflare at a given moment.

## Current Contents

### `20260409T010139Z`

Dry-run export for the Phase 1 homepage-only ruleset render across:

- `championsgreen-ga.com`
- `thedistrictuniversal.com`
- `theharrisonsandysprings.com`
- `ventanaapts.com`
- `calaismidtownapartments.com`

Each `*.json` file includes:

- resolved zone ID
- current cache-settings entrypoint state
- rendered rules payload
- effective TTL notes

## How To Regenerate

```bash
export CLOUDFLARE_API_TOKEN_FILE=/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt
python3 /Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py \
  --config /Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml
```

## Notes

- The current available token is read-only, so the stored outputs are dry-run plans, not live applied state.
- Once a write-capable token is available, the same script can generate `.applied.json` snapshots after successful updates.
