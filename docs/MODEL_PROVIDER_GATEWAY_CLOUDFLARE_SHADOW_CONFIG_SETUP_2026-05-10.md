# Model Provider Gateway Cloudflare Shadow Config Setup

Date: 2026-05-10

## Purpose

This guide defines the backend-only configuration path for observing Cloudflare AI Gateway provider output in shadow mode through the internal Model Provider Gateway.

Cloudflare is infrastructure only. The internal Model Provider Gateway remains the application authority boundary for payload minimization, redaction, structured output validation, governance post-checks, audit lineage, and deterministic accepted output.

## Non-Negotiable Runtime State

- Accepted output remains deterministic.
- Provider output is shadow-only.
- Live accepted provider calls remain disabled.
- Provider output cannot create memory, routing, Expert Reads, reports, publication, or Data Pond mutation.
- Raw prompts and raw provider output are not stored by default.
- Secrets are backend-only and must not be committed, logged, printed, or exposed to frontend code.
- PropertyAccessControl, Directive Control Center, Evidence Packets, Awareness Network, Quartermaster, Fleet Scribe, and PIB/reporting guardrails remain authoritative.

## Backend Environment Placeholders

Use an approved backend secret channel for real values. Do not place these values in frontend env files.

```bash
CLOUDFLARE_AI_GATEWAY_ENABLED=true
CLOUDFLARE_AI_GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/openai
CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN=<backend_secret_only>
CLOUDFLARE_AI_GATEWAY_MODEL=<provider_model_or_dynamic_route>
# Or:
# CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME=<dynamic_route_name>

MODEL_GATEWAY_ENABLED=true
MODEL_GATEWAY_SHADOW_MODE=true
MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true
MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false
MODEL_GATEWAY_ALLOW_LIVE_CALLS=false
MODEL_GATEWAY_DEFAULT_ADAPTER=deterministic
MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic
MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER=cloudflare_ai_gateway
MODEL_GATEWAY_KILL_SWITCH=false
MODEL_GATEWAY_DRY_RUN=false
MODEL_GATEWAY_STORE_RAW_PAYLOAD=false
MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT=false
MODEL_GATEWAY_CACHE_ENABLED=false
CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED=false
```

Optional backend-only keys:

```bash
CLOUDFLARE_AI_GATEWAY_PROVIDER=<provider_name>
CLOUDFLARE_AI_GATEWAY_ROUTE_NAME=<route_name>
CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME=<dynamic_route_name>
CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS=10000
```

## Safe Config Check

Run from `apps/api`:

```bash
npm run model-gateway:check-cloudflare-shadow-config
```

Strict mode exits nonzero unless shadow provider observation is eligible and frontend exposure is absent:

```bash
MODEL_GATEWAY_CONFIG_CHECK_STRICT=true npm run model-gateway:check-cloudflare-shadow-config
```

The command reports key presence and safe booleans only. It does not print secret values.

## Synthetic Smoke

Run from `apps/api` only after backend config has been provided:

```bash
RUN_CLOUDFLARE_SHADOW_SMOKE=true npm run smoke:cloudflare-shadow
```

The smoke path uses synthetic data, preserves deterministic accepted output, records shadow audit metadata only, and never creates memory, routing, reports, Expert Reads, or Data Pond changes.

Expected missing-config result:

- `attempted: true`
- `calledCloudflare: false`
- `acceptedOutputSource: deterministic`
- `skipReason` names missing or unsafe configuration by key only

Expected successful-shadow result:

- `attempted: true`
- `calledCloudflare: true`
- `acceptedOutputSource: deterministic`
- `shadowResultCount` is greater than zero

## Golden-Case Evaluation

Run from `apps/api`:

```bash
npm run eval:gateway-shadow
```

The evaluation suite always runs deterministic baseline checks. It attempts provider shadow observation only when backend config and shadow flags make that path eligible.

## Rollback / Disable

Any one of these disables provider transit:

```bash
MODEL_GATEWAY_KILL_SWITCH=true
MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=false
CLOUDFLARE_AI_GATEWAY_ENABLED=false
MODEL_GATEWAY_SHADOW_MODE=false
```

Accepted live provider behavior still requires separate future approval and must remain disabled:

```bash
MODEL_GATEWAY_ALLOW_LIVE_CALLS=false
MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false
MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic
```

## Readiness Boundary

This setup can make the repo ready to observe Cloudflare/model behavior in shadow mode after approved backend secrets are supplied. It does not make the system ready for live accepted provider calls.
