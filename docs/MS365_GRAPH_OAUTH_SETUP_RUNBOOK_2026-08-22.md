# Microsoft 365 Graph OAuth Setup Runbook

Date: 08/22/2026
Status: Setup scaffold ready, credentials not yet present in Keeper
Owner: MarketingOps / Property Analytics

## Purpose

This runbook sets up Microsoft Graph OAuth for Ops Watch so Outlook, Teams, SharePoint, and OneDrive can be harvested read-only without local credential files.

Local helpers:

- `/Users/mark/Property_Analytics/utils/ms365_graph_auth.py`
- `/Users/mark/Property_Analytics/scripts/smoke_ms365_graph_oauth.py`

## OAuth Shape

Use Microsoft identity platform OAuth 2.0 client credentials for unattended scheduled harvesting. The token request uses:

- Tenant-specific v2 token endpoint
- `grant_type=client_credentials`
- Microsoft Graph `.default` scope

Docs basis:

- Microsoft identity platform client credentials flow: `https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow`
- Microsoft identity platform `.default` scope guidance: `https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc`
- Microsoft Graph permissions reference: `https://learn.microsoft.com/en-us/graph/permissions-reference`

## Entra App Registration

Create or request a single-tenant Entra app registration, suggested name:

- `Property Analytics Ops Watch`

Record values to Keeper only:

- Tenant ID
- Application/client ID
- Client secret value
- Mailbox user principal name to harvest first

Do not paste these values into local files, shell history, repo files, or chat.

## Initial Permissions

Start with the narrow Outlook lane:

- Microsoft Graph application permission: `Mail.Read`

Recommended mailbox boundary:

- Restrict the app to the approved mailbox using Microsoft/Exchange application access policy or the narrowest tenant-approved equivalent.

Do not grant send/write permissions for v1.

Later lanes, only after approval:

- Teams: `ChannelMessage.Read.All`, `Chat.Read`
- SharePoint / OneDrive: `Files.Read.All`, `Sites.Read.All`

## Keeper Contract

Populate the Keeper records and expose notation env vars:

- `KSM_MS365_TENANT_ID_NOTATION`
- `KSM_MS365_CLIENT_ID_NOTATION`
- `KSM_MS365_CLIENT_SECRET_NOTATION`
- `KSM_MS365_MAILBOX_USER_NOTATION`

Example shape only:

```bash
export KSM_MS365_TENANT_ID_NOTATION='keeper://<record_uid>/custom_field/tenant_id'
export KSM_MS365_CLIENT_ID_NOTATION='keeper://<record_uid>/custom_field/client_id'
export KSM_MS365_CLIENT_SECRET_NOTATION='keeper://<record_uid>/field/password'
export KSM_MS365_MAILBOX_USER_NOTATION='keeper://<record_uid>/field/login'
```

## Smoke Test

Token-only smoke:

```bash
python3 scripts/smoke_ms365_graph_oauth.py --json
```

Mailbox read smoke:

```bash
python3 scripts/smoke_ms365_graph_oauth.py --check-mailbox --json
```

The smoke test must not print access tokens or message content. The mailbox check only reports sanitized folder counts.

## Promotion Criteria

The Microsoft 365 Ops Watch lanes can move from `blocked_pending_keeper_graph_auth` after:

- Keeper notation env vars are configured.
- Token-only smoke passes.
- Mailbox smoke passes for the approved mailbox.
- Mailbox scoping is confirmed by IT/Admin.
- Mark approves the first read-only Outlook harvest query/folder set.

## Boundary

Allowed:

- Acquire short-lived Graph tokens through Keeper-backed app credentials.
- Read approved mailbox/folder metadata and messages for local Ops Watch classification after approval.
- Generate local non-mutating packets.

Not allowed:

- Local OAuth token files.
- Ad hoc `.env` secrets.
- Browser session scraping.
- Sending email.
- Moving, archiving, deleting, flagging, or marking email.
- Reading unapproved mailboxes/channels/sites.
- Teams posts/reactions.
- SharePoint/OneDrive edits or sharing changes.
