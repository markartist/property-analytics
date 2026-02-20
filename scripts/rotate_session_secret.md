# Rotate SESSION_SIGNING_SECRET

## Purpose
Rotate the `SESSION_SIGNING_SECRET` used by the POP Brief API Worker.
This secret is stored as a Cloudflare Worker secret (not in code or `wrangler.toml`).

## Steps

1. **Generate a new secret** (locally, never log or echo the value):
   ```bash
   NEW_SECRET=$(openssl rand -base64 48)
   ```

2. **Set the new secret on the Worker**:
   ```bash
   echo "$NEW_SECRET" | wrangler secret put SESSION_SIGNING_SECRET
   ```
   This immediately replaces the old secret.

3. **Existing sessions**: Sessions use SHA-256 hashed tokens stored in D1.
   `SESSION_SIGNING_SECRET` is currently reserved for future HMAC signing.
   No existing sessions are invalidated by rotation today.
   If HMAC-based session validation is added later, you must:
   - Support dual-read (old + new) during a grace period, OR
   - Accept that all active sessions will be invalidated on rotation.

4. **Verify**: Hit the `/health` endpoint to confirm the Worker redeployed:
   ```bash
   curl https://api.venterradev.com/health
   ```

5. **Confirm login works**: Test `/v1/auth/login` with valid credentials.

## Schedule
- Rotate at least every 90 days.
- Rotate immediately if a secret may have been exposed.

## Do NOT
- Store the secret in `.env`, code, or git.
- Echo or log the secret value in CI/CD or shell history.
- Share the secret over Slack or email.
