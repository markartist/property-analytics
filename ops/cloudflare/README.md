# Cloudflare Admin Auth

This directory standardizes Cloudflare credential loading for local automation.

## Precedence

Credential resolution order is:

1. Keeper Secrets Manager notation
2. `CLOUDFLARE_API_TOKEN`
3. `CLOUDFLARE_API_TOKEN_FILE` as last resort

Keeper is the standard path.

## Standard Setup: Keeper

Initialize a Keeper profile once:

```bash
ksm profile init -p cloudflare-dns 'ONE_TIME_ACCESS_TOKEN'
```

Set a notation for the Cloudflare token field:

```bash
export KSM_PROFILE=cloudflare-dns
export KSM_CLOUDFLARE_TOKEN_NOTATION='keeper://RECORD_UID/field/password'
```

Verify:

```bash
python3 ops/cloudflare/verify_cloudflare_auth.py
```

## Fallback: Environment Variable

```bash
export CLOUDFLARE_API_TOKEN='...'
python3 ops/cloudflare/verify_cloudflare_auth.py
```

## Last Resort: Local File

```bash
export CLOUDFLARE_API_TOKEN_FILE='/absolute/path/to/token.txt'
python3 ops/cloudflare/verify_cloudflare_auth.py
```

The file may contain either:

- raw token text
- or a copied curl command that includes `Authorization: Bearer ...`

## Notes

- Do not commit live tokens
- Prefer zone-scoped user tokens
- Rotate any token that was shared in chat or stored in Downloads

## Pilot Full-Page Cache Tooling

Phase 1 homepage-only rollout assets live here:

- Config: `/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml`
- Rules manager: `/Users/mark/Property_Analytics/ops/cloudflare/cache_rules_manager.py`
- Dry-run/apply CLI: `/Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py`
- Purge helper: `/Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py`
- Rollout doc: `/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md`
