# Model Provider Gateway — Cloudflare AI Gateway Adapter — 2026-05-10

## Role

The **Cloudflare AI Gateway Adapter** is the first provider-control adapter beneath the internal Model Provider Gateway.

It may help with:

- provider routing
- authenticated gateway control
- rate limiting
- budget visibility
- fallback routing
- observability
- token / latency / request id capture

It must not decide:

- property access
- directive behavior
- evidence authority
- memory promotion
- report publication
- Quartermaster blocking
- Fleet Scribe publication authority

## Current State

- adapter file: `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/adapters/cloudflare-ai-gateway.ts`
- disabled by default
- live provider calls disabled by default
- shadow provider calls require explicit `MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true`
- live accepted provider calls require a separate future approval path and remain disabled in this phase
- safe normalization of common OpenAI-compatible responses
- safe fallback on:
  - missing config
  - disabled live calls
  - HTTP error
  - timeout
  - non-JSON / non-structured output

## Supported Configuration

- `CLOUDFLARE_AI_GATEWAY_ENABLED=false`
- `CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID`
- `CLOUDFLARE_AI_GATEWAY_ID`
- `CLOUDFLARE_AI_GATEWAY_BASE_URL`
- `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_ROUTE_NAME`
- `CLOUDFLARE_AI_GATEWAY_REQUIRE_AUTH=true`
- `CLOUDFLARE_AI_GATEWAY_USE_DYNAMIC_ROUTE=false`
- `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`
- `CLOUDFLARE_AI_GATEWAY_MODEL`
- `CLOUDFLARE_AI_GATEWAY_PROVIDER`
- `CLOUDFLARE_AI_GATEWAY_TIMEOUT_MS`
- `CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED=false`

## Setup Assumptions

The adapter currently assumes an OpenAI-compatible request shape with:

- `model`
- `messages`
- `response_format`
- `metadata`

If Cloudflare route shape differs in production, update adapter normalization and request assembly without changing gateway authority rules.

## Kill Switch

For the current shadow-provider configuration phase, accepted runtime output remains deterministic and `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`.

Shadow provider observation requires:

- `MODEL_GATEWAY_ENABLED=true`
- `MODEL_GATEWAY_SHADOW_MODE=true`
- `MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true`
- `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
- `MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false`
- `MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic`
- `MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER=cloudflare_ai_gateway`
- `MODEL_GATEWAY_KILL_SWITCH=false`
- `MODEL_GATEWAY_DRY_RUN=false`
- `CLOUDFLARE_AI_GATEWAY_ENABLED=true`
- valid backend-only Cloudflare base URL, model, and auth token if auth is required

Future live accepted provider settings are not approved by this pass. They require a separate gate that explicitly reviews live-call flags, kill switch posture, dry-run posture, Cloudflare configuration, budgets, audit lineage, and rollback procedure.

Otherwise the runtime fails closed to deterministic or noop behavior.

## Production Guidance

- keep live provider calls disabled by default
- use shadow mode first
- do not expose Cloudflare token to frontend
- do not log raw prompt/payload by default
- do not rely on Cloudflare guardrails or DLP to replace internal validators or governance post-check
