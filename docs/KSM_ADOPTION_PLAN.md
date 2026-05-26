# Keeper Secrets Manager Adoption Plan

## Purpose

This document defines a practical Keeper Secrets Manager (KSM) adoption path for the `Property_Analytics` repository.

Goals:

- Make KSM the standard source of secrets for local automation, CI/CD, and infrastructure workflows
- Reduce dependence on repo-local credential files under `credentials/` and other ad hoc locations
- Preserve working systems by migrating in phases with explicit fallbacks

## Current State Summary

The repo currently has a mixed secrets model:

- Good: Keeper-first resolution already exists for BrowserStack and Cloudflare ops flows
- Mixed: Cloudflare Worker apps use platform-managed secrets via `wrangler secret put`
- Legacy: many Python workflows still rely on local credential files under `credentials/` or other config folders

## Existing Keeper-Ready Patterns

These flows already prefer Keeper over local files:

- BrowserStack auth helper: `/Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py`
- BrowserStack docs: `/Users/mark/Property_Analytics/ops/browserstack/README.md`
- Cloudflare auth helper: `/Users/mark/Property_Analytics/ops/cloudflare/cloudflare_auth.py`
- Cloudflare docs: `/Users/mark/Property_Analytics/ops/cloudflare/README.md`

Current KSM env conventions already in use:

- `KSM_PROFILE`
- `KSM_BROWSERSTACK_USERNAME_NOTATION`
- `KSM_BROWSERSTACK_ACCESS_KEY_NOTATION`
- `KSM_CLOUDFLARE_TOKEN_NOTATION`

## Highest-Value Secret Surfaces In This Repo

### Tier 1: Already operationally sensitive and easy to standardize

- BrowserStack credentials
- Cloudflare API token
- Cloudflare Worker secrets:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `SESSION_SIGNING_SECRET`
  - `OPENAI_API_KEY`
  - `PLATFORM_ACCESS_CLIENT_ID`
  - `PLATFORM_ACCESS_CLIENT_SECRET`
  - `VACS_ACCESS_CLIENT_ID`
  - `VACS_ACCESS_CLIENT_SECRET`
  - `EVS_ACCESS_CLIENT_ID`
  - `EVS_ACCESS_CLIENT_SECRET`
  - transitional fallback only:
    - `PLATFORM_SHARED_TOKEN`
    - `VACS_SHARED_TOKEN`
    - `EVS_SHARED_TOKEN`

### Tier 2: Legacy file-based secrets that should move next

- Email config file: `/Users/mark/Property_Analytics/credentials/email_config.json`
- GA4 service account JSON
- Google Search Console OAuth client and token files
- Google Ads config YAML
- SEMrush API key file
- GTMetrix API key file
- PageSpeed API key file
- Microsoft or Gmail app-password files

### Tier 3: Documentation and memory files that still normalize file-based secrets

- `/Users/mark/Property_Analytics/README_old.md`
- `/Users/mark/Property_Analytics/DATA_COLLECTION_README.md`
- `/Users/mark/Property_Analytics/docs/EMAIL_SENDER_GUIDE.md`
- `/Users/mark/Property_Analytics/utils/config_manager.py`
- various project memory files referencing `credentials/`

## Recommended KSM App Model

Use separate KSM applications by blast radius, not one global app.

Recommended initial apps:

- `pa-browserstack-qa`
- `pa-cloudflare-dns`
- `pa-cloudflare-workers-prod`
- `pa-data-collection-prod`
- `pa-data-collection-dev`

Optional later split if needed:

- `pa-evs-prod`
- `pa-pop-brief-prod`
- `pa-shared-ci`

Rationale:

- BrowserStack and Cloudflare already have distinct operational scopes
- Worker deployment secrets should not share the same app as local analyst scripts
- Data collection credentials have a very different access model than deployment secrets

## Naming Standard

### KSM profiles

Use stable local profile names that match app purpose:

- `browserstack-qa`
- `cloudflare-dns`
- `cloudflare-workers-prod`
- `data-collection-prod`
- `data-collection-dev`

### Environment variables

Use these rules:

- Keep `KSM_PROFILE` for the active profile selector
- Use `KSM_<SERVICE>_<SECRET>_NOTATION` for notation variables
- Keep legacy non-KSM env vars only as temporary fallback during migration

Examples:

- `KSM_BROWSERSTACK_USERNAME_NOTATION`
- `KSM_BROWSERSTACK_ACCESS_KEY_NOTATION`
- `KSM_CLOUDFLARE_TOKEN_NOTATION`
- `KSM_RESEND_API_KEY_NOTATION`
- `KSM_EMAIL_FROM_NOTATION`
- `KSM_SESSION_SIGNING_SECRET_NOTATION`
- `KSM_OPENAI_API_KEY_NOTATION`
- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_VACS_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_ID_NOTATION`
- `KSM_CLOUDFLARE_EVS_ACCESS_CLIENT_SECRET_NOTATION`
- `KSM_PLATFORM_SHARED_TOKEN_NOTATION`

## Standard Resolution Order

For local scripts and Python tools, standardize on:

1. Keeper notation via `ksm secret notation`
2. Plain environment variable fallback
3. Local file fallback only where migration is not yet complete

For CI/CD and Terraform-style workflows:

1. `KEEPER_CREDENTIAL` supplied by the runner or secret store
2. KSM application access to the required records
3. Platform-native secret injection only at final deployment boundary

Important distinction:

- Local scripts should keep using repo helper functions or auth adapters
- Terraform or CI integrations should use Keeper-native credential injection, not shell out to `ksm` inside Terraform plans

## Repo-Specific Migration Targets

### 1. BrowserStack

Target state:

- Keep current helper as-is
- Remove dependence on `/Users/mark/Downloads/BrowserStack_Credentials.txt` in normal operation
- Install KSM profile on the machine or agent running daily BrowserStack jobs

Notes:

- `run_pilot_browserstack_daily.sh` still exports `BROWSERSTACK_CREDENTIALS_FILE` as a fallback
- This is acceptable temporarily, but Keeper should become the normal path

### 2. Cloudflare DNS automation

Target state:

- Keep current helper as-is
- Make `KSM_CLOUDFLARE_TOKEN_NOTATION` the documented default everywhere
- Reserve `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_API_TOKEN_FILE` for break-glass use

### 3. Cloudflare Worker secrets

Current code references these env bindings in `/Users/mark/Property_Analytics/apps/api/src/env.ts`:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SESSION_SIGNING_SECRET`
- `OPENAI_API_KEY`
- `PLATFORM_ACCESS_CLIENT_ID`
- `PLATFORM_ACCESS_CLIENT_SECRET`
- `VACS_ACCESS_CLIENT_ID`
- `VACS_ACCESS_CLIENT_SECRET`
- `EVS_ACCESS_CLIENT_ID`
- `EVS_ACCESS_CLIENT_SECRET`
- transitional fallback only:
  - `PLATFORM_SHARED_TOKEN`
  - `VACS_SHARED_TOKEN`
  - `EVS_SHARED_TOKEN`

Target state:

- Source these values from KSM during deployment
- Continue setting them into Worker-managed secrets at deploy time
- Do not attempt runtime `ksm` lookups from the deployed Worker
- Prefer Cloudflare Access service-token credentials as the steady-state machine identity model for `platform`, `vacs`, and `evs`
- Retain shared bearer tokens only as temporary fallback during the cutover window

Recommended deployment pattern:

1. CI runner authenticates to KSM
2. CI fetches secrets from Keeper
3. CI writes them to Cloudflare Worker secrets via `wrangler secret put`

Reference:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`

### 4. Python data collection and analytics scripts

These are the biggest legacy area and should be migrated behind a shared helper.

Primary legacy sources:

- `credentials/email_config.json`
- `credentials/ga4_service_account.json`
- `credentials/gsc_credentials.json`
- `credentials/google-ads.yaml`
- `credentials/semrush_api_key.txt`
- `credentials/gtmetrix_api_key.txt`
- `Spotlight_Properties_Report/config/pagespeed_api_key.txt`

Recommended target:

- Introduce a single `utils/ksm.py` or similar helper for secret resolution
- Update `utils/config_manager.py` and related callers to prefer KSM before reading files
- Keep file paths temporarily for compatibility until each workflow is verified

### 5. Documentation cleanup

Once migration begins, update docs to stop recommending new credential files as the default setup path.

Priority docs to update:

- `/Users/mark/Property_Analytics/docs/EMAIL_SENDER_GUIDE.md`
- `/Users/mark/Property_Analytics/DATA_COLLECTION_README.md`
- `/Users/mark/Property_Analytics/README_old.md`
- `/Users/mark/Property_Analytics/utils/README.md`

## Implementation Plan

### Phase 1: Standardize operating model

- Approve KSM app boundaries
- Create the initial KSM applications
- Share the right records to each app
- Generate machine or CI credentials for each app
- Record profile names and notation env vars in repo docs

Success criteria:

- BrowserStack and Cloudflare use KSM by default
- Team has a documented naming convention

### Phase 2: Add a shared KSM helper for Python

- Add a small reusable helper for:
  - notation lookup
  - value cleanup
  - env fallback
  - optional file fallback
- Start with non-PIB codepaths only
- Use this helper in older analytics and reporting workflows

Success criteria:

- At least one legacy file-backed workflow can run with KSM and no local credential file

### Phase 3: Deploy-time secret sync for Workers

- Add a deployment script or CI job that:
  - authenticates to Keeper
  - reads required values
  - updates Worker secrets

Success criteria:

- Worker deployments do not depend on copying secrets by hand

### Phase 4: Reduce file fallback surface

- Remove file defaults from docs
- Convert break-glass secrets to explicit exceptions
- Archive or retire obsolete local credential files where safe

Success criteria:

- New setup no longer requires populating `credentials/` for common workflows

## Suggested Initial Secret Map

### `pa-browserstack-qa`

- BrowserStack username
- BrowserStack access key

### `pa-cloudflare-dns`

- Cloudflare DNS API token

### `pa-cloudflare-workers-prod`

- Resend API key
- From address
- Session signing secret
- OpenAI API key for Worker features
- VACS shared token
- EVS shared token
- Platform shared token

### `pa-data-collection-prod`

- GA4 service account JSON or equivalent credential material
- GSC OAuth client secret
- GSC refresh token or token material, if feasible
- Google Ads developer credentials
- SEMrush API key
- GTMetrix API key
- PageSpeed API key
- SMTP or app-password credentials where still needed

## Risks And Constraints

- Some Google OAuth flows are stateful and may not map cleanly to a simple secret-string migration
- Service-account JSON can live in KSM, but some libraries expect a file path, so a temporary materialization step may still be needed
- Worker secrets still need to exist in Cloudflare after retrieval from KSM; Keeper should be the source of truth, not the direct runtime dependency
- Legacy docs currently normalize keeping secrets in local files; this will keep reintroducing drift until updated

## Immediate Next Steps

1. Create the five initial KSM applications listed above
2. Move BrowserStack and Cloudflare records into the corresponding apps
3. Decide which Worker secrets belong in `pa-cloudflare-workers-prod`
4. Add a shared Python KSM helper and migrate one legacy workflow as the pilot
5. Update setup docs so new work stops defaulting to `credentials/`

## Reference Sources

- Keeper Secrets Manager overview: [docs.keeper.io](https://docs.keeper.io/en/keeperpam/secrets-manager/overview)
- Keeper Terraform integration: [docs.keeper.io](https://docs.keeper.io/en/keeperpam/secrets-manager/integrations/terraform)
- Keeper product overview: [keepersecurity.com](https://www.keepersecurity.com/secrets-manager.html?sbrc=1aBzkQVzh3Mw99Q-RnVv-XA%3D%3D%24aRFaOI4OmI-O1Uy1RhGO9g%3D%3D)
