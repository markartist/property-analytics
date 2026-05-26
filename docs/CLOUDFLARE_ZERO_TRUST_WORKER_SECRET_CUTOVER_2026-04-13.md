# Cloudflare Zero Trust Worker Secret Cutover

Status: Draft v1
Date: 2026-04-13
Owner: MarketingOps / Property Analytics

## 1. Purpose

Define the concrete Worker secret and local-job cutover path for moving from legacy shared bearer tokens to Cloudflare Access service-token credentials.

This runbook is the deployment bridge between:

- Keeper records
- local job env variables
- Cloudflare Worker secrets
- runtime route auth

## 2. Target Secret Model

Preferred end state:

- `platform` uses `PLATFORM_ACCESS_CLIENT_ID` + `PLATFORM_ACCESS_CLIENT_SECRET`
- `vacs` uses `VACS_ACCESS_CLIENT_ID` + `VACS_ACCESS_CLIENT_SECRET`
- `evs` uses `EVS_ACCESS_CLIENT_ID` + `EVS_ACCESS_CLIENT_SECRET`

Legacy fallback still supported during migration:

- `PLATFORM_SHARED_TOKEN`
- `EVS_SHARED_TOKEN`

## 3. Keeper Source Of Truth

Create or confirm the following Keeper notation records:

- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION`

Legacy fallback notation if temporarily retained:

- `KSM_PLATFORM_SHARED_TOKEN_NOTATION`

Reference:

- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`

## 4. Worker Secret Names

Set these on the API Worker as Cloudflare secrets:

- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`
- `VACS_ACCESS_CLIENT_ID`
- `VACS_ACCESS_CLIENT_SECRET`
- `EVS_ACCESS_CLIENT_ID`
- `EVS_ACCESS_CLIENT_SECRET`

Existing Worker secrets that remain in use:

- `SESSION_SIGNING_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## 5. Local Job Environment Names

For local or scheduled Mac jobs, use:

- `PLATFORM_BASE_URL`
- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`

Legacy fallback only while needed:

- `PLATFORM_SHARED_TOKEN`

## 6. Cutover Sequence

### Phase 1: Provision secrets

1. Create Access service tokens in Cloudflare Zero Trust.
2. Store client id and client secret in Keeper.
3. Confirm Keeper notation env vars resolve correctly.

### Phase 2: Inject Worker secrets

For each Worker secret:

```bash
cd /Users/mark/Property_Analytics
bash scripts/zero_trust_worker_secret_cutover.sh --apply
```

The helper resolves values in this order:

1. Keeper notation env var such as `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
2. direct env var such as `PLATFORM_ACCESS_CLIENT_ID`

Then deploy:

```bash
cd /Users/mark/Property_Analytics/apps/api
npx wrangler deploy --config wrangler.toml
```

### Phase 3: Update local jobs

Set local-job env vars to prefer Access credentials:

- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`

Do not remove `PLATFORM_SHARED_TOKEN` until the new path is verified in production.

### Phase 4: Verify runtime

Run:

- `/Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh`
- `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py --dry-run`

Confirm:

- platform route access works with Access client credentials
- no fallback to shared token is required
- generated activity artifacts show the expected auth mode
- the verification script reports the expected credential source (`keeper:<profile>` or direct env var)

### Phase 5: Retire shared bearer tokens

After successful verification:

1. remove `PLATFORM_SHARED_TOKEN` from local job environments
2. remove `PLATFORM_SHARED_TOKEN` from Worker/runtime injection if no longer needed
3. repeat the same process later for `VACS_SHARED_TOKEN` and `EVS_SHARED_TOKEN`

## 7. Verification Checklist

- Keeper notation resolves Access client id/secret correctly
- Worker secrets are present
- Worker deploy succeeds
- platform route smoke check passes with Access client headers
- local D1 mirror path passes with Access client credentials
- no unexpected 401s occur on `/v1/platform/*`

## 8. Rollback

If Access client credentials fail unexpectedly:

1. keep Worker support for Access credentials in place
2. restore or preserve `PLATFORM_SHARED_TOKEN` in the local job environment
3. rerun the cutover verification using the legacy bearer path
4. inspect route logs and generated activity artifacts

Rollback is configuration-only unless a separate Cloudflare policy change also needs to be reverted.

Verification note:

- `verify_phase1_platform_cutover.sh` now resolves credentials in the same order as the rest of the cutover tooling:
  1. Keeper notation
  2. direct env var
  3. shared bearer fallback only if Access credentials are unavailable

## 9. Helper Script

Copy-ready helper:

- `/Users/mark/Property_Analytics/scripts/zero_trust_worker_secret_cutover.sh`
- `/Users/mark/Property_Analytics/scripts/zero_trust_rollout_sequence.sh`

Usage:

```bash
cd /Users/mark/Property_Analytics
bash scripts/zero_trust_worker_secret_cutover.sh
```

Audit current shell posture:

```bash
cd /Users/mark/Property_Analytics
bash scripts/zero_trust_worker_secret_cutover.sh --audit
```

The audit now reports whether each Access credential pair resolves from Keeper,
direct env vars, or is still missing.

Apply mode:

```bash
cd /Users/mark/Property_Analytics
export KSM_PROFILE="marketingops"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION="keeper://RECORD_UID/field/login"
export KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION="keeper://RECORD_UID/field/password"
bash scripts/zero_trust_worker_secret_cutover.sh --apply
```

Retirement command preview after production verification:

```bash
cd /Users/mark/Property_Analytics
bash scripts/zero_trust_worker_secret_cutover.sh --print-retire
```

Rollout wrapper:

```bash
cd /Users/mark/Property_Analytics
bash scripts/zero_trust_rollout_sequence.sh
```

Run the full mutation sequence:

```bash
cd /Users/mark/Property_Analytics
export PLATFORM_BASE_URL="https://api.venterradev.com"
bash scripts/zero_trust_rollout_sequence.sh --full
```

The wrapper always starts with the current cutover audit, then optionally:

1. applies Worker secrets
2. deploys the API Worker
3. runs platform cutover verification
