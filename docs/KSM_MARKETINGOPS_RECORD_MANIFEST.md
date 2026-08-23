# MarketingOps Keeper Record Manifest

## Purpose

This file defines the first Keeper records and folder structure to create for the `MarketingOps` KSM application used by `Property_Analytics`.

The goal is to give the local `marketingops` profile access to the highest-value secrets first, then expand from there.

## Recommended Keeper Folder

Create a shared folder in Keeper named:

- `Property Analytics / MarketingOps`

Then grant the `MarketingOps` application access to that folder.

If Keeper prefers a flatter naming convention in your vault, this is also fine:

- `Property Analytics - MarketingOps`

## Initial Records To Create

Best practice:

- prefer one secret per record
- prefer standard record fields over file attachments
- use file attachments only as a temporary bridge while bootstrapping
- never store Keeper one-time bootstrap tokens in the shared app folder

### 1. BrowserStack Username

Suggested record title:

- `BrowserStack Username`

Suggested usage in repo:

- BrowserStack automation
- EVS BrowserStack smoke runs

Related env var / notation target:

- `KSM_BROWSERSTACK_USERNAME_NOTATION`

### 2. BrowserStack Access Key

Suggested record title:

- `BrowserStack Access Key`

Suggested usage in repo:

- BrowserStack automation
- EVS BrowserStack smoke runs

Related env var / notation target:

- `KSM_BROWSERSTACK_ACCESS_KEY_NOTATION`

### 3. Cloudflare API Token

Suggested record title:

- `Cloudflare API Token`

Suggested usage in repo:

- Cloudflare DNS automation
- Cloudflare ops scripts

Related env var / notation target:

- `KSM_CLOUDFLARE_TOKEN_NOTATION`

### 3a. Cloudflare Billing Token

Suggested record title:

- `Cloudflare Billing Token`

Suggested usage in repo:

- Cloudflare Billable Usage collector
- Watchtower Cloudflare FinOps diagnostic freshness

Related env var / notation target:

- `KSM_CLOUDFLARE_BILLING_TOKEN_NOTATION`
- Active helper notation: `keeper://LttlGLhno7Ddd-GYZPWFTw/field/password`

Required minimum scope:

- Cloudflare account `5a5a60afaad00085864fe6bab7eb2882`
- `Billing Read`

### 4. SEMrush API Key

Suggested record title:

- `SEMrush API Key`

Suggested usage in repo:

- daily collection orchestration
- historical SEMrush collectors

Related env var / notation target:

- `KSM_SEMRUSH_API_KEY_NOTATION`

### 5. GoDaddy DNS Token

Suggested record title:

- `GoDaddy DNS Token`

Suggested usage in repo:

- Domain Ops GoDaddy v3 nameserver cutover
- GoDaddy domain-management mutations after explicit approval

Related env var / notation target:

- `KSM_GODADDY_PAT_NOTATION`
- Default helper notation: `keeper://LNDz2zPtN7y_P_mFpRRPug/field/password`

Required minimum scope:

- `domains.domain:read`
- `domains.nameserver:update`

### 6. GTmetrix API Key

Suggested record title:

- `GTmetrix API Key`

Suggested usage in repo:

- daily collection orchestration
- GTmetrix monitoring scripts

Related env var / notation target:

- `KSM_GTMETRIX_API_KEY_NOTATION`

## Second-Wave Records

Add these after the first five are working:

- `Resend API Key`
- `Email From Address`
- `Session Signing Secret`
- `OpenAI API Key`
- `Platform Shared Token`
- `EVS Shared Token`
- `VACS Shared Token`
- `PageSpeed API Key`
- `Resi Server API Token`

### Ops Watch Ingest Shared Secret

Suggested record title:

- `Ops Watch Ingest Shared Secret`

Suggested usage in repo:

- internal Ops Watch mirror/push exporter signing
- Cloudflare Worker secret `OPS_WATCH_INGEST_SHARED_SECRET`

Related env var / notation target:

- `KSM_OPS_WATCH_INGEST_SHARED_SECRET_NOTATION`
- Active helper notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`

Storage requirements:

- Generate as a high-entropy random shared secret.
- Store only in Keeper/KSM and the Cloudflare Worker secret store.
- Do not place the value in local files, `.env`, ticket comments, screenshots, or shell history.

## Suggested Record Organization

If you want cleaner grouping inside Keeper, use subfolders or naming prefixes like:

- `BrowserStack / Username`
- `BrowserStack / Access Key`
- `Cloudflare / API Token`
- `Analytics / SEMrush API Key`
- `Analytics / GTmetrix API Key`

## Repo Mapping Notes

These repo paths already expect Keeper-first behavior or are ready for it:

- `/Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/cloudflare_auth.py`
- `/Users/mark/Property_Analytics/utils/ksm.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

## Temporary Bridge Pattern

If a secret is currently stored as a file attachment record, Keeper notation can still read the file contents.

Pattern:

- `keeper://RECORD_UID/file/FILENAME`

This is useful for bootstrapping, but the preferred end state is still one structured record per secret.

Examples of preferred end-state records:

- `GTmetrix API Key` stored as a normal record field
- `OpenAI API Key` stored as a normal record field
- `BrowserStack Credentials` stored as a structured record with username and password-style fields

Avoid keeping these in the shared app folder:

- one-time KSM access tokens
- local bootstrap files
- ad hoc export files copied from your machine

## Current Observed State

As of April 9, 2026:

- the local KSM profile `marketingops` is active
- the shared folder `MarketingOps` is attached to the `MarketingOps` application
- the Keeper bootstrap token record was removed from the shared folder
- structured records now exist for:
  - `GTmetrix API Key`
  - `SEMrush API Key`
  - `Cloudflare API Token`
  - `BrowserStack Credentials`
  - `OpenAI API Key`
  - `PageSpeed API Key`
  - `Google Ads API Config v2`
  - `DataForSEO API Credentials`
  - `ApartmentIQ API`
  - `aHrefs API Key`
- Keeper file records now exist for:
  - `GA4 Service Account JSON`
  - `GSC OAuth Client JSON`
  - `GSC OAuth Token Pickle`

Recommended next cleanup:

- create structured replacement records for any remaining secrets such as OpenAI
- migrate local shell or automation config to structured notation env vars

## Active Notation Mapping

Current Keeper notation targets:

- `KSM_GTMETRIX_API_KEY_NOTATION=keeper://lkluImtpQHpBWcldViKfiQ/field/password`
- `KSM_SEMRUSH_API_KEY_NOTATION=keeper://q1dizD20qVFSS1ZCYoRPEw/field/password`
- `KSM_CLOUDFLARE_TOKEN_NOTATION=keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password`
- `KSM_CLOUDFLARE_BILLING_TOKEN_NOTATION=keeper://LttlGLhno7Ddd-GYZPWFTw/field/password`
- `KSM_BROWSERSTACK_USERNAME_NOTATION=keeper://y6GUrHJgXsSxybHruXcVWg/field/login`
- `KSM_BROWSERSTACK_ACCESS_KEY_NOTATION=keeper://y6GUrHJgXsSxybHruXcVWg/field/password`
- `KSM_OPENAI_API_KEY_NOTATION=keeper://fsL4Qd2Q_9CPadtyeBr7-Q/field/password`
- `KSM_PAGESPEED_API_KEY_NOTATION=keeper://XTQySA3sVMlwouNIWGCcCg/field/password`
- `KSM_RESI_API_TOKEN_NOTATION=keeper://2tuAKQVuBYqp0PCipUQUyw/field/password`
- `KSM_DATAFORSEO_LOGIN_NOTATION=keeper://8xxZUZB5ISyM1BhBrnaI2w/field/login`
- `KSM_DATAFORSEO_PASSWORD_NOTATION=keeper://8xxZUZB5ISyM1BhBrnaI2w/field/password`
- `KSM_APARTMENTIQ_API_KEY_NOTATION=keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password`
- `KSM_AHREFS_API_KEY_NOTATION=keeper://xbIaayyCqMfrzVFjRei5hA/field/password`

Pending Microsoft 365 / Ops Watch notation targets:

- `KSM_MS365_TENANT_ID_NOTATION`
- `KSM_MS365_CLIENT_ID_NOTATION`
- `KSM_MS365_CLIENT_SECRET_NOTATION`
- `KSM_MS365_MAILBOX_USER_NOTATION`

These are intentionally listed without Keeper UIDs until Microsoft Graph access is approved and represented in Keeper/KSM. Ops Watch must not create local OAuth token files, ad hoc `.env` secrets, or browser-session fallbacks for Outlook, Teams, SharePoint, or OneDrive harvesting.

The local helpers that consume these notation env vars are:

- `/Users/mark/Property_Analytics/utils/ms365_graph_auth.py`
- `/Users/mark/Property_Analytics/scripts/smoke_ms365_graph_oauth.py`

As of 08/22/2026, a sanitized Keeper title/folder scan found no existing Microsoft 365 / Graph / Outlook / Teams / SharePoint record mapped for this lane.


File-backed Keeper UIDs:

- `KSM_GOOGLE_ADS_CONFIG_UID=ulYC1ol6Wg_5U2xvpM6sUw`
- `KSM_GA4_SERVICE_ACCOUNT_UID=mVZqo2oVSqfS6YDvBDer8g`
- `KSM_GSC_CLIENT_SECRET_UID=7c95fCoXGYsrrsCA7aCtsg`
- `KSM_GSC_TOKEN_UID=0dqRbzl2KvQFSBU5CdXOVQ`

GBP file-backed Keeper UIDs:

- `KSM_GBP_CLIENT_SECRET_UID=W06j0C6nHmT25dyr7sVYTA`
- `KSM_GBP_TOKEN_UID=yDAkWDdIFlYjvDbjVl6McQ`

As of 2026-05-07, the canonical GBP collection path now supports and is wired for these
env vars through:

- `/Users/mark/Property_Analytics/utils/config_manager.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

The active stabilized token artifact is now:

- `/Users/mark/Property_Analytics/Portfolio_Monitoring/credentials/gbp_token.json`

Follow-up closure on 2026-05-07:

- the scheduled runtime now prefers the Keeper token record when `KSM_GBP_TOKEN_UID` is set
- refreshed GBP OAuth token state is uploaded back into that Keeper record after successful headless auth/refresh
- this closes the loop so GBP no longer depends on a lucky local token cache for unattended runs

Legacy local migration/fallback artifacts still present on disk:

- `/Users/mark/Property_Analytics/Portfolio_Monitoring/credentials/client_secret_gbp.json`
- `/Users/mark/Property_Analytics/Portfolio_Monitoring/credentials/gbp_token.pickle`

Suggested local profile:

- `KSM_PROFILE=marketingops`

## After Records Are Added

Once the records are shared to the `MarketingOps` application:

1. Confirm the `marketingops` KSM profile can see the records
2. Capture the Keeper notation strings for each secret
3. Export the notation env vars locally
4. Test one repo path at a time

## Verification Sequence

Recommended first verification order:

1. Cloudflare token lookup
2. BrowserStack credential lookup
3. SEMrush key lookup in the daily collection flow
4. GTmetrix key lookup in the daily collection flow

## Notes

- Do not store live secret values in this file
- This is a manifest only, not a secret store
- The Keeper application currently needs records or a shared folder attached before the local profile can fetch anything
