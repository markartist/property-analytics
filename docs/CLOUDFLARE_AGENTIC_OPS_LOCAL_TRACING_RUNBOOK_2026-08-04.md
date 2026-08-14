# Cloudflare Agentic Ops Local Tracing Runbook

Date: 08/04/2026
Owner: WebOps / Data Pond / Agent Runtime
Status: v1 operator runbook

## Purpose

Cloudflare's current Agents Week local tracing release makes `wrangler dev` and the Cloudflare Vite plugin expose local OpenTelemetry traces, correlated logs, and local binding state through Local Explorer. This gives coding agents and operators a structured debugging path before deployment.

Use this runbook when debugging:

- `/Users/mark/Property_Analytics/apps/api`
- Worker experiments under `/Users/mark/Property_Analytics/ops/cloudflare/`
- D1/KV/R2 binding failures
- Cloudflare Access bootstrap/session issues
- cron/scheduled handlers
- model-gateway or Captain runtime routes that run inside the Worker API

## Guardrails

- Keeper/KSM remains the credential authority. Do not create ad hoc credential files.
- Local tracing is for diagnosis only; it is not approval to deploy.
- Do not paste raw secrets, JWTs, session cookies, Access service tokens, model prompts with confidential content, or raw provider payloads into tickets, docs, or chat.
- Keep PIB locked files untouched unless Mark explicitly approves the specific PIB mutation in the current task.
- When debugging property-scoped behavior, resolve identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.

## Setup

The API app already uses Wrangler in:

`/Users/mark/Property_Analytics/apps/api/package.json`

Current command:

```bash
cd /Users/mark/Property_Analytics/apps/api
npm run dev
```

Wrangler should be kept current enough to include Local Explorer tracing. Update only through normal dependency review:

```bash
cd /Users/mark/Property_Analytics/apps/api
npm install --save-dev wrangler@latest
```

After `wrangler dev` starts, Local Explorer is available on the local Worker origin:

```text
/cdn-cgi/explorer
/cdn-cgi/explorer/api
```

Cloudflare's agent hint may also advertise:

```text
POST /cdn-cgi/explorer/api/local/observability/query
```

Use that endpoint to query traces and correlated logs. Prefer targeted SQL-style trace queries over adding temporary logging.

## Debug Loop

1. Start the local Worker with `npm run dev`.
2. Reproduce the failing request locally.
3. Open Local Explorer or query the Local Explorer API.
4. Identify whether the failure is in:
   - handler lifecycle
   - outbound fetch
   - D1 query or migration state
   - R2/KV binding access
   - Durable Object / Workflow / Queue interaction
   - application validation or auth
5. Apply the smallest local fix.
6. Re-run the request.
7. Query traces again to verify the failing span is gone.
8. Run the repo guardrails relevant to the touched surface.

## First Targets

### API Worker

Use for:

- Cloudflare Access bootstrap diagnostics
- Watchtower `/status`
- Captain runtime route behavior
- Model Provider Gateway shadow checks
- D1 schema drift

Recommended verification after changes:

```bash
cd /Users/mark/Property_Analytics/apps/api
npm run typecheck
npm run test:platform
```

### Cloudflare Worker Experiments

Use for:

- `townestone-native-optimizer`
- `portfolio-resi-edge-prototype`
- `edge-transparent-pricing-intro`
- `cendana-native-optimizer`

Recommended verification:

```bash
node --check /Users/mark/Property_Analytics/ops/cloudflare/townestone-native-optimizer/worker.js
bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh
```

For live deploys, continue using Keeper-backed Wrangler helpers such as:

`/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`

## What To Capture

Capture:

- request path and method
- trace id or local request id
- failing span name
- sanitized error class
- D1 table/migration involved
- binding name involved
- fix summary
- verification command and result

Do not capture:

- auth token values
- cookies
- raw Access JWTs
- secret notation values beyond non-sensitive record labels
- raw private prompts or raw model outputs

## Watchtower Tie-In

Local tracing findings should feed operational follow-up through existing channels:

- `data_collections` when the issue is a source run failure
- Watchtower source freshness when the issue affects freshness
- Captain watch items when property-scoped routines are affected
- Cloudflare Billable Usage when the issue is cost/usage drift

Do not create a parallel incident tracker for local traces unless the existing Watchtower/Captain/Data Pond surfaces cannot represent the issue.
