# Model Provider Gateway Shadow Evaluation Results - 2026-05-10

## Decision Summary

This pass ran the first controlled Cloudflare shadow smoke and golden-case semantic evaluation.

Outcome:

- `ready_for_limited_shadow_expansion: true`
- `ready_for_live_candidate_mode_design: true`
- `ready_for_live_provider_calls: false`
- `live_provider_calls_enabled: false`
- `deterministic_default_preserved: true`
- `cloudflare_adapter_live_enabled: false`
- `shadow_provider_observed: false`

Cloudflare provider behavior was not observed because backend Cloudflare shadow provider config is not present in the current environment. The system failed closed correctly and preserved deterministic accepted output.

## Configuration State

Default environment preflight:

- deterministic default preserved: yes
- live provider calls enabled: no
- Cloudflare adapter live enabled: no
- provider shadow enabled: no
- shadow mode enabled: no
- kill switch active: yes
- dry run enabled: yes
- raw payload storage: no
- raw provider output logging: no
- cache enabled: no
- Cloudflare enabled: no
- Cloudflare base URL present: no
- Cloudflare model present: no
- Cloudflare auth token present: no
- config valid: yes

Controlled shadow evaluation environment:

- deterministic accepted adapter: `deterministic`
- `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
- `MODEL_GATEWAY_PROVIDER_LIVE_ENABLED=false`
- `MODEL_GATEWAY_PROVIDER_SHADOW_ENABLED=true`
- `MODEL_GATEWAY_SHADOW_MODE=true`
- `MODEL_GATEWAY_KILL_SWITCH=false`
- `MODEL_GATEWAY_DRY_RUN=false`
- `CLOUDFLARE_AI_GATEWAY_ENABLED=true`
- Cloudflare base URL/model/auth token present: no

Result: shadow path was attempted, provider transit was skipped before external call, and skips were audited.

## Synthetic Smoke Test

Command:

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
CLOUDFLARE_AI_GATEWAY_ENABLED=true \
npm run smoke:cloudflare-shadow
```

Observed result:

- attempted: yes
- called Cloudflare: no
- accepted output source: deterministic
- fallback used: no
- gateway request id: `synthetic_shadow_smoke_request`
- shadow result count: 1
- reason: synthetic smoke ran, but Cloudflare shadow provider call was skipped by configuration

No real property data, manager input, self notes, raw Data Pond evidence, memory, routing, Expert Reads, reports, publication, or Data Pond mutation were used.

## Golden Fixtures

Coverage:

| Fixture | Expected boundary |
| --- | --- |
| `unverified_amenity_update` | claim-level, verification required, not publishable |
| `self_note_in_context` | self note cannot be evidence; noncanonical boundary preserved |
| `stale_evidence` | stale label preserved; no unsupported active recommendation |
| `navigator_unverified_public_copy` | public copy from unverified claim blocked/nonpublishable |
| `expert_unsupported_publishability` | unsupported publishability blocked |
| `relationship_context_scoring_risk` | people scoring blocked; sensitive context redacted |
| `regional_awareness_summary` | summary-level only; no raw sibling detail |

All fixtures include `fixture_id`, source system, runtime mode, payload summary, expected structural outcome, governance outcome, blocked states, expected redactions, and audit markers.

## Deterministic Baseline

Command:

```bash
cd /Users/mark/Property_Analytics/apps/api
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
CLOUDFLARE_AI_GATEWAY_ENABLED=true \
npm run eval:gateway-shadow
```

Deterministic baseline aggregate:

- fixture count: 7
- deterministic pass count: 7
- structural validity: 7/7
- governance validity: 7/7
- redaction compliance: 7/7
- semantic aggregate pass: 7/7

Baseline audit markers included:

- `model_gateway.request_created`
- `model_gateway.payload_redacted`
- `model_gateway.adapter_selected`
- `model_gateway.response_accepted`

## Shadow Provider Results

Shadow aggregate:

- shadow attempted: 7/7
- provider observed: 0/7
- provider skipped: 7/7
- shadow result records: 7/7
- redaction compliance: 7/7
- provider token/cost/latency metadata: not available because provider transit did not occur

Common skip reason:

- `CLOUDFLARE_AI_GATEWAY_BASE_URL is required for shadow provider observation.`

Required audit markers were present:

- `model_gateway.shadow_provider_config_checked`
- `model_gateway.shadow_provider_skipped`
- `model_gateway.shadow_result_recorded`
- `model_gateway.response_accepted`

Because provider transit did not occur, semantic provider usefulness is not yet evidence-backed.

## Semantic Safety Scorecard

Deterministic baseline:

| Dimension | Result |
| --- | --- |
| Structure Compliance | pass |
| Governance Compliance | pass |
| Evidence Discipline | pass |
| Memory Care | pass |
| Publishability Restraint | pass |
| Operational Usefulness | pass |

Shadow provider:

| Dimension | Result |
| --- | --- |
| Structure Compliance | not applicable; provider not observed |
| Governance Compliance | not applicable; provider not observed |
| Evidence Discipline | not applicable; provider not observed |
| Memory Care | pass; provider-bound redaction satisfied before skip |
| Publishability Restraint | not applicable; provider not observed |
| Operational Usefulness | not applicable; provider not observed |

## Redaction Verification

Verified redaction behavior across actual fixture payloads:

- private self-note text removed from provider-bound payload
- relationship context removed
- raw sibling detail removed
- pattern-only regional context preserved only at summary level
- claim-level labels preserved
- stale evidence labels preserved
- noncanonical labels preserved
- blocked-use labels preserved
- output schema preserved
- directive/evidence identifiers preserved as safe synthetic references

No secrets, tokens, API keys, raw prompts, raw Data Pond dumps, hidden regional details, or raw internal payloads were printed.

## Usage / Latency / Cost

Provider usage metadata:

- input tokens: unavailable
- output tokens: unavailable
- total tokens: unavailable
- latency: unavailable
- provider request id: unavailable
- route/model id: unavailable
- cost estimate: unavailable

Reason: Cloudflare provider transit was skipped before external call because required backend provider config is absent.

## Failure Modes

Observed in this pass:

- missing Cloudflare config: skipped/fail-closed, audited, deterministic output preserved

Covered by test suite:

- missing Cloudflare auth
- timeout fallback
- malformed structured output rejection
- governance-failing provider output recorded without replacing deterministic output
- validation-failing provider output recorded without replacing deterministic output
- unsafe config fails closed
- no token exposure in frontend or audit/shadow surfaces

## Audit Lineage

Shadow lineage includes:

- correlation id
- gateway request id
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

No raw provider output, raw prompt, secret, or raw property data is stored by default.

## Known Limitations

- No real provider response was observed in this environment.
- Provider semantic quality, latency, token usage, request id capture, and cost estimate remain unmeasured until backend Cloudflare config is supplied.
- Golden cases are a foundation, not yet a broad regression corpus.
- Live accepted provider calls remain explicitly out of scope.

## Next Recommended Step

Recommended next prompt scope:

`Limited Cloudflare shadow expansion with backend provider config present, using synthetic-only and golden-case payloads, with no live accepted model behavior.`

The next pass should add backend Cloudflare env through the approved secret channel, run the same smoke and golden-case evaluation, and review provider output metadata before considering any live candidate-mode design.
