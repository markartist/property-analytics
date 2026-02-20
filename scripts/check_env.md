# POP Brief API — Required Environment Variables

## D1 Database (Binding)
- **POP_BRIEF_DB**: D1 database binding. Configured in `wrangler.toml`, not an env var.

## R2 Storage (Binding)
- **POP_BRIEF_UPLOADS**: R2 bucket binding. Configured in `wrangler.toml`, not an env var.

## Secrets (set via `wrangler secret put`)
- **RESEND_API_KEY**: API key for Resend email provider. Required if `ENABLE_EMAIL_SEND=true`.
- **EMAIL_FROM**: Sender address for outbound emails (e.g. `noreply@venterradev.com`). Required if `ENABLE_EMAIL_SEND=true`.
- **SESSION_SIGNING_SECRET**: Reserved for future HMAC session signing. Set it now; rotate every 90 days.

## Vars (set in `wrangler.toml` or `wrangler secret put`)
- **ENABLE_EMAIL_SEND**: `"true"` or `"false"`. **Default: `"false"`**. Controls whether the API actually sends emails via Resend. Always leave `false` in dev/staging.

## Safe Defaults
| Variable | Default | Notes |
|---|---|---|
| ENABLE_EMAIL_SEND | `"false"` | Must be explicitly set to `"true"` to send real emails |
| SESSION_SIGNING_SECRET | (none) | Must be set before deploy |
| RESEND_API_KEY | (none) | Only needed when email is enabled |
| EMAIL_FROM | (none) | Only needed when email is enabled |

## Verification
After deploying, confirm environment is correct:
```bash
# Health check
curl https://api.venterradev.com/health

# Should return { "status": "ok", "version": "1.0.0" }
```

If login returns 500, check that `POP_BRIEF_DB` binding is configured and migrations are applied.
If email send returns errors, check `RESEND_API_KEY` and `EMAIL_FROM` are set.
