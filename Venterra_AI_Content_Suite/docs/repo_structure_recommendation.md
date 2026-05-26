# Cloudflare-Native Repository Structure (Recommended)

This is a preparation recommendation, not a locked final layout.

## Option: Module-First Monorepo Slice

```text
Venterra_AI_Content_Suite/
  apps/
    content-api-worker/                # ingress API (brief intake, status, outputs)
    content-orchestrator-worker/       # stage orchestration + workflow control
    content-evaluator-worker/          # scoring/evaluation endpoints
  packages/
    context-builder/                   # Data Pond + external normalization layer
    channel-adapters/                  # email/social/web formatters
    seo-logic/                         # SEO heuristics + directional rules
    refinement/                        # tone/clarity/humanization layer
    policy-guardrails/                 # compliance/brand rule checks
    prompt-contracts/                  # templates + versioned prompt contracts
    schemas/                           # zod/json schema contracts
    telemetry/                         # run events + audit payload helpers
  infra/
    migrations/                        # D1 migrations for suite-owned tables
    wrangler/                          # wrangler config fragments
  contracts/
    templates/                         # data contract templates
  docs/
  roadmap/
```

## Why This Shape
- Modular boundaries map directly to the architect’s stage model.
- Keeps orchestration independent from channel rendering logic.
- Makes auditing and versioning explicit.
- Supports phased implementation without large refactors.

## Ownership Boundaries (Draft)
- `context-builder`: data normalization contracts
- `channel-adapters`: output shape + channel best practices
- `seo-logic`: optimization rules and priorities (Annis input)
- `refinement`: readability/tone quality controls
- `policy-guardrails`: business/legal/brand constraints
