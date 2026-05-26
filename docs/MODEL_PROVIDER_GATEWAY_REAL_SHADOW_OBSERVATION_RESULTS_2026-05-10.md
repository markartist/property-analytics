# Model Provider Gateway Real Shadow Observation Results - 2026-05-10

## Decision Summary

This pass prepared the system for real Cloudflare shadow provider observation and attempted the approved backend-only synthetic smoke and golden-case evaluation path.

Real Cloudflare provider transit did **not** occur because required backend Cloudflare AI Gateway configuration is absent from the current environment and backend config files.

The system behaved correctly:

- deterministic accepted output remained preserved
- live accepted provider behavior remained disabled
- Cloudflare live accepted behavior remained disabled
- provider output remained shadow-only
- missing provider config skipped external transit before a provider call
- shadow audit lineage and shadow result records were created
- no raw prompts, provider output, secrets, memory, routing, reports, publication, or Data Pond mutation occurred

Readiness:

- `ready_for_limited_shadow_expansion: false`
- `ready_for_live_candidate_mode_design: false`
- `ready_for_live_provider_calls: false`
- `live_provider_calls_enabled: false`
- `deterministic_default_preserved: true`
- `cloudflare_adapter_live_enabled: false`
- `shadow_provider_observed: false`
- `synthetic_smoke_called_cloudflare: false`
- `golden_fixtures_called_cloudflare: false`

## Configuration Preflight

Current shell environment presence check:

| Key | Present |
| --- | --- |
| `CLOUDFLARE_AI_GATEWAY_ENABLED` | no |
| `CLOUDFLARE_AI_GATEWAY_BASE_URL` | no |
| `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN` | no |
| `CLOUDFLARE_AI_GATEWAY_MODEL` | no |
| `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME` | no |
| `MODEL_GATEWAY_ENABLED` | no |
| `MODEL_GATEWAY_SHADOW_MODE` | no |
| `MODEL_GATEWAY_ALLOW_LIVE_CALLS` | no |
| `MODEL_GATEWAY_DEFAULT_ADAPTER` | no |
| `MODEL_GATEWAY_DRY_RUN` | no |
| `MODEL_GATEWAY_STORE_RAW_PAYLOAD` | no |
| `MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT` | no |
| `MODEL_GATEWAY_CACHE_ENABLED` | no |

Backend config file presence check:

- `apps/api/wrangler.toml` exists
- no `MODEL_GATEWAY_*` or `CLOUDFLARE_AI_GATEWAY_*` keys are present in the checked backend config files

Controlled shadow run flags supplied at command time:

- `MODEL_GATEWAY_ENABLED=true`
- `MODEL_GATEWAY_SHADOW_MODE=true`
- `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
- `MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true`
- `MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false`
- `MODEL_GATEWAY_DEFAULT_ADAPTER=deterministic`
- `MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic`
- `MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER=cloudflare_ai_gateway`
- `MODEL_GATEWAY_KILL_SWITCH=false`
- `MODEL_GATEWAY_DRY_RUN=false`
- `MODEL_GATEWAY_STORE_RAW_PAYLOAD=false`
- `MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT=false`
- `MODEL_GATEWAY_CACHE_ENABLED=false`
- `CLOUDFLARE_AI_GATEWAY_ENABLED=true`
- `CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED=false`

Missing required non-secret/config keys for real provider transit:

- `CLOUDFLARE_AI_GATEWAY_BASE_URL`
- `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_MODEL` or `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`

## Secret Handling Preflight

Verified posture:

- Cloudflare auth token is backend-only by design
- no token was present in the shell or checked backend config files
- no token value was printed
- no provider request body was printed
- smoke/evaluation output printed sanitized metadata only
- raw payload storage remained disabled
- raw provider output logging remained disabled
- frontend code did not expose Cloudflare auth token names or values in the model-gateway tests
- adapter error normalization and audit tests cover token redaction

## Synthetic Real Shadow Smoke Test

Command shape:

```bash
cd /Users/mark/Property_Analytics/apps/api
RUN_CLOUDFLARE_SHADOW_SMOKE=true \
MODEL_GATEWAY_ENABLED=true \
MODEL_GATEWAY_ALLOW_LIVE_CALLS=false \
MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true \
MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false \
MODEL_GATEWAY_DEFAULT_ADAPTER=deterministic \
MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic \
MODEL_GATEWAY_SHADOW_PROVIDER_ADAPTER=cloudflare_ai_gateway \
MODEL_GATEWAY_KILL_SWITCH=false \
MODEL_GATEWAY_SHADOW_MODE=true \
MODEL_GATEWAY_DRY_RUN=false \
MODEL_GATEWAY_STORE_RAW_PAYLOAD=false \
MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT=false \
MODEL_GATEWAY_CACHE_ENABLED=false \
CLOUDFLARE_AI_GATEWAY_ENABLED=true \
CLOUDFLARE_AI_GATEWAY_CACHE_ENABLED=false \
npm run smoke:cloudflare-shadow
```

Result:

- attempted: true
- called Cloudflare: false
- accepted output source: deterministic
- fallback used: false
- shadow result count: 1
- skip reason: Cloudflare shadow provider call was skipped by configuration
- no runtime side effects

Synthetic data only was used:

- synthetic property id
- synthetic directive hash
- synthetic evidence hash
- synthetic claim-level payload

## Golden-Case Fixture Readiness

Fixture coverage remained complete:

| Fixture | Boundary |
| --- | --- |
| `unverified_amenity_update` | claim-level, verification required, not publishable |
| `self_note_in_context` | self note cannot be evidence; noncanonical boundary preserved |
| `stale_evidence` | stale label preserved; no unsupported active recommendation |
| `navigator_unverified_public_copy` | unverified public copy blocked/nonpublishable |
| `expert_unsupported_publishability` | unsupported publishability blocked |
| `relationship_context_scoring_risk` | people scoring blocked; sensitive context redacted |
| `regional_awareness_summary` | summary-level only; no raw sibling detail |

Each fixture includes fixture id, source system, runtime mode, payload summary, expected structural/governance outcome, blocked states, expected redactions, and audit markers.

## Deterministic Baseline

Golden-case evaluation aggregate:

- fixture count: 7
- deterministic pass count: 7
- structural validity: 7/7
- governance validity: 7/7
- redaction compliance: 7/7
- semantic baseline pass: 7/7

Baseline audit markers:

- `model_gateway.request_created`
- `model_gateway.payload_redacted`
- `model_gateway.adapter_selected`
- `model_gateway.response_accepted`

## Real Cloudflare Shadow Fixture Evaluation

Real provider transit did not run.

Shadow fixture aggregate:

- shadow attempted: 7/7
- provider observed: 0/7
- provider skipped: 7/7
- shadow result records: 7/7
- redaction compliance: 7/7

Common skip reason:

- `CLOUDFLARE_AI_GATEWAY_BASE_URL is required for shadow provider observation.`

The gateway did not proceed to provider transit because required backend config is absent.

## Semantic Safety Scorecard

Deterministic baseline:

| Category | Result |
| --- | --- |
| Structure Compliance | pass |
| Governance Compliance | pass |
| Evidence Discipline | pass |
| Memory Care | pass |
| Publishability Restraint | pass |
| Operational Usefulness | pass |

Real provider output:

| Category | Result |
| --- | --- |
| Structure Compliance | not applicable; provider not observed |
| Governance Compliance | not applicable; provider not observed |
| Evidence Discipline | not applicable; provider not observed |
| Memory Care | pass before skip; redaction satisfied |
| Publishability Restraint | not applicable; provider not observed |
| Operational Usefulness | not applicable; provider not observed |

## Real Provider Payload Redaction Verification

Provider-bound payloads were built and redacted before the provider eligibility check.

Verified:

- private self-note text removed
- relationship context removed
- raw sibling detail removed
- pattern-only regional context preserved at summary level only
- claim-level labels preserved
- stale evidence labels preserved
- noncanonical labels preserved
- blocked-use labels preserved
- safe synthetic directive/evidence references preserved
- no raw Data Pond dump
- no real property data
- no secrets/tokens/API keys
- no raw prompt or provider output printed

## Usage / Latency / Cost

Provider metadata:

- input tokens: unavailable
- output tokens: unavailable
- total tokens: unavailable
- latency: unavailable
- provider status: skipped before transit
- provider request id: unavailable
- route/model id: unavailable
- cost estimate: unavailable

No billing or latency inference is made because no external provider call occurred.

## Provider Failure Modes

Observed directly:

- missing config: skipped/fail-closed; deterministic output preserved; audit lineage recorded

Covered by the model-provider-gateway test suite:

- missing auth fails closed
- timeout safe fallback
- malformed output rejected
- provider error normalized safely
- governance-failing provider output recorded without replacing deterministic output
- validation-failing provider output recorded without replacing deterministic output
- unsafe config fails closed
- secrets not exposed in frontend/audit/shadow surfaces

## Shadow Audit Lineage

Observed lineage for smoke and fixtures included:

- correlation id
- gateway request id
- fixture/source runtime id
- source system
- synthetic property id
- directive hash
- evidence hash
- payload hash
- redacted payload hash
- adapter id
- provider adapter identity
- validation/governance status where applicable
- safe skip reason
- timestamped audit events

Events observed:

- `model_gateway.shadow_provider_config_checked`
- `model_gateway.shadow_provider_skipped`
- `model_gateway.shadow_result_recorded`
- `model_gateway.response_accepted`

Events not observed because provider transit did not occur:

- `model_gateway.shadow_provider_call_started`
- `model_gateway.shadow_provider_call_completed`
- `model_gateway.shadow_provider_call_failed`
- `model_gateway.shadow_provider_timeout`
- `model_gateway.shadow_provider_validation_failed`
- `model_gateway.shadow_provider_governance_failed`

## Known Limitations

- No real Cloudflare/model response was observed.
- Provider structural validity, governance behavior, semantic quality, latency, token usage, provider request id capture, and cost estimate remain unmeasured.
- Real shadow expansion now depends on approved backend Cloudflare AI Gateway configuration.

## Required Before Real Shadow Observation

Provide backend-only configuration through the approved secret/config channel:

- `CLOUDFLARE_AI_GATEWAY_BASE_URL`
- `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_MODEL` or `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`

Keep:

- `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
- `MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false`
- `MODEL_GATEWAY_ACCEPTED_OUTPUT_ADAPTER=deterministic`
- `MODEL_GATEWAY_STORE_RAW_PAYLOAD=false`
- `MODEL_GATEWAY_LOG_RAW_PROVIDER_OUTPUT=false`
- `MODEL_GATEWAY_CACHE_ENABLED=false`

## Next Recommended Step

Recommended next prompt scope:

`Supply approved backend Cloudflare AI Gateway shadow config and rerun synthetic smoke + golden-case real shadow observation, with deterministic accepted output preserved and live accepted provider behavior still disabled.`
