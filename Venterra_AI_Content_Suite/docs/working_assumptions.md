# Working Assumptions (Prep Phase)

These assumptions enable preparation work now and can be revised once requirements are finalized.

## A1. Platform
Assume Cloudflare-native first:
- Workers for APIs/orchestration
- D1 for structured metadata/state
- R2 for artifacts and logs
- AI Gateway for model routing/controls
- Queues/Workflows for async generation paths
- Vectorize optional for retrieval augmentation

## A2. Runtime Pattern
Assume stage-oriented orchestration:
- `Context -> Draft -> SEO Logic -> Refinement -> Evaluation`

## A3. Source of Truth
Assume Data Pond as primary internal source; external data is additive and policy-gated.

## A4. Channel Model
Assume channel adapters are isolated modules:
- Email adapter
- Social adapter
- Web/collateral adapter

## A5. Governance
Assume all outputs require auditable lineage:
- input snapshot references
- prompt/version references
- generation/evaluation metadata

## A6. Quality
Assume a two-layer quality approach:
- deterministic rule checks
- model-based editorial refinement

## A7. Safety
Assume policy/brand/SEO constraints are enforced by explicit guardrails, not implicit prompting.
