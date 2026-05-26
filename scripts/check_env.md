# POP Brief API — Required Environment Variables

## D1 Database (Binding)
- **POP_BRIEF_DB**: D1 database binding. Configured in `wrangler.toml`, not an env var.

## R2 Storage (Binding)
- **POP_BRIEF_UPLOADS**: R2 bucket binding. Configured in `wrangler.toml`, not an env var.

## Secrets (set via `wrangler secret put`)
- **RESEND_API_KEY**: API key for Resend email provider. Required if `ENABLE_EMAIL_SEND=true`.
- **EMAIL_FROM**: Sender address for outbound emails (e.g. `noreply@venterradev.com`). Required if `ENABLE_EMAIL_SEND=true`.
- **SESSION_SIGNING_SECRET**: Reserved for future HMAC session signing. Set it now; rotate every 90 days.
- **SEMRUSH_API_KEY**: Required for the Search Intelligence report route and any live SEMrush keyword-gap pulls executed by the Worker.
- **PLATFORM_ACCESS_CLIENT_ID**: Cloudflare Access service-token client id for `platform` service routes. Preferred steady-state auth for platform automation.
- **PLATFORM_ACCESS_CLIENT_SECRET**: Cloudflare Access service-token client secret for `platform` service routes.
- **VACS_ACCESS_CLIENT_ID**: Cloudflare Access service-token client id for `vacs` service routes.
- **VACS_ACCESS_CLIENT_SECRET**: Cloudflare Access service-token client secret for `vacs` service routes.
- **EVS_ACCESS_CLIENT_ID**: Cloudflare Access service-token client id for `evs` service routes.
- **EVS_ACCESS_CLIENT_SECRET**: Cloudflare Access service-token client secret for `evs` service routes.

## Transitional Legacy Fallback
- **PLATFORM_SHARED_TOKEN**: Transitional fallback bearer token for `platform` automation only while the Access credential path is being verified.
- **VACS_SHARED_TOKEN**: Transitional fallback bearer token for `vacs` automation only while the Access credential path is being verified.
- **EVS_SHARED_TOKEN**: Transitional fallback bearer token for `evs` automation only while the Access credential path is being verified.

## Vars (set in `wrangler.toml` or `wrangler secret put`)
- **ENABLE_EMAIL_SEND**: `"true"` or `"false"`. **Default: `"false"`**. Controls whether the API actually sends emails via Resend. Always leave `false` in dev/staging.

## Safe Defaults
| Variable | Default | Notes |
|---|---|---|
| ENABLE_EMAIL_SEND | `"false"` | Must be explicitly set to `"true"` to send real emails |
| SESSION_SIGNING_SECRET | (none) | Must be set before deploy |
| RESEND_API_KEY | (none) | Only needed when email is enabled |
| EMAIL_FROM | (none) | Only needed when email is enabled |
| SEMRUSH_API_KEY | (none) | Required for `/v1/search-intelligence/report` and live SEMrush enrichment |
| PLATFORM_ACCESS_CLIENT_ID | (none) | Required for steady-state `platform` service-token auth |
| PLATFORM_ACCESS_CLIENT_SECRET | (none) | Required for steady-state `platform` service-token auth |
| VACS_ACCESS_CLIENT_ID | (none) | Required for steady-state `vacs` service-token auth |
| VACS_ACCESS_CLIENT_SECRET | (none) | Required for steady-state `vacs` service-token auth |
| EVS_ACCESS_CLIENT_ID | (none) | Required for steady-state `evs` service-token auth |
| EVS_ACCESS_CLIENT_SECRET | (none) | Required for steady-state `evs` service-token auth |
| PLATFORM_SHARED_TOKEN | (none) | Transitional fallback only; retire after Access verification |
| VACS_SHARED_TOKEN | (none) | Transitional fallback only; retire after Access verification |
| EVS_SHARED_TOKEN | (none) | Transitional fallback only; retire after Access verification |

## Recommended Secret Source
Use Keeper as the source of truth for these values and inject them into the Worker with `wrangler secret put` at deploy time.

For `SEMRUSH_API_KEY`, the canonical Keeper notation in this repo is:

```bash
export KSM_PROFILE="marketingops"
export KSM_SEMRUSH_API_KEY_NOTATION="keeper://q1dizD20qVFSS1ZCYoRPEw/field/password"
```

Reference:
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`

## Verification
After deploying, confirm environment is correct:
```bash
# Health check
curl https://api.venterradev.com/health

# Should return { "status": "ok", "version": "1.0.0" }
```

If login returns 500, check that `POP_BRIEF_DB` binding is configured and migrations are applied.
If email send returns errors, check `RESEND_API_KEY` and `EMAIL_FROM` are set.
If Search Intelligence returns a config error, check that `SEMRUSH_API_KEY` is present in the Worker secrets.
If service routes return 401, check the relevant `*_ACCESS_CLIENT_ID` and `*_ACCESS_CLIENT_SECRET` secrets are present first, then fall back to the transitional shared token only if the cutover is not complete.
