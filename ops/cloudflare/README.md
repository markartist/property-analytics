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

## Ops Watch Mirror/Push Ingest

The Ops Watch mirror/push receiving lane is live as a dedicated Cloudflare Worker:

- Worker folder: `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/`
- Production health: `https://ops-watch.venterrawebops.com/health`
- Production ingest: `POST https://ops-watch.venterrawebops.com/v1/ops-watch/ingest`
- Runbook: `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`

Credential boundary:

- Keeper record: `Ops Watch Ingest Shared Secret`
- Active notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`
- Worker secret: `OPS_WATCH_INGEST_SHARED_SECRET`

Do not put the shared secret in local files, `.env`, shell history, tickets, screenshots, or source code. The Worker accepts only HMAC-signed sanitized packets and does not reach into intranet systems.

## Captain Refresh Worker

The Captain refresh control plane is a dedicated Cloudflare Worker for scheduled Captain Office Wall and persona/profile refresh:

- Worker folder: `/Users/mark/Property_Analytics/ops/cloudflare/captain-refresh/`
- Production health: `https://captain-refresh.venterrawebops.com/health`
- Production status: `https://captain-refresh.venterrawebops.com/v1/captains/refresh/status`
- Worker version: `6c0c4fa8-6ed9-47b6-a1c5-dd9072462742`
- Git commit: `d19b96d`
- Runbook: `/Users/mark/Property_Analytics/docs/CAPTAIN_CLOUDFLARE_REFRESH_RUNBOOK_2026-08-24.md`

The Worker runs every 30 minutes, reads governed D1 Captain/Awareness/Ops Watch state, creates missing Captain persona profile defaults, writes current Office Wall snapshots to D1, and stores JSON snapshot evidence in R2. It does not edit Jira, Confluence, Microsoft 365, source tickets, locked PIB files, or inward intranet systems. Manual refresh is disabled until `CAPTAIN_REFRESH_ADMIN_SECRET` is set through Keeper/KSM.
