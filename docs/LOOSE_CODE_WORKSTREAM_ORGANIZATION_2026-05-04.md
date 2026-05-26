# Loose Code Workstream Organization

Date: 2026-05-04
Current branch: `codex/pilot-control-cwv-reporting`
Purpose: organize the active dirty/untracked workspace into reviewable workstreams without discarding work in progress.

## Current State

The worktree is not random clutter. It is a stacked workspace containing several active capability slices.

Observed inventory:

- `117` tracked files modified
- `360` untracked files visible to Git
- No locked canonical PIB generator/template/sender files are currently touched

Important caution:

- The current branch name says `pilot-control-cwv-reporting`, but the loose code spans far beyond pilot reporting. Do not promote this whole branch as a single release.
- Treat this as a staging workshop that needs branch/commit splitting by capability lane.

## Recommended Workstream Lanes

### 1. Property Identity + Source Governance Foundation

Purpose:

- Governed identity resolution and source-route discipline.

Representative paths:

- `Data_Collection/utils/property_identity.py`
- `config/property_identity_matrix.json`
- `config/generated/remote_communities_snapshot.json`
- `scripts/build_property_identity_matrix.py`
- `scripts/check_property_identity_governance.py`
- `scripts/check_property_identity_governance.sh`
- `scripts/check_property_identity_matrix.py`
- `scripts/enrich_property_locations.py`
- `scripts/refresh_remote_communities_snapshot.py`
- `docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md`

Promotion order:

- This should be one of the first branches because many later source routes depend on it.

Required checks:

- `bash scripts/check_property_identity_governance.sh`
- `bash scripts/check_context_discipline.sh`

### 2. Data Collection Reliability + Watchtower Closure

Purpose:

- Collection freshness, retry closure, source freshness policy, and collector hardening.

Representative paths:

- `Data_Collection/collectors/*`
- `Data_Collection/db/database_manager.py`
- `Data_Collection/monitoring/*`
- `Data_Collection/orchestration/daily_master_collection.py`
- `Data_Collection/orchestration/retry_incomplete_collections.py`
- `Data_Collection/utils/daily_collection_closure.py`
- `Data_Collection/utils/source_freshness_policy.py`
- `run_collection_retry_cycle.sh`
- `DATA_COLLECTION_README.md`

Promotion order:

- After property identity; before source-specific ingestion routes where possible.

Required checks:

- collection closure smoke where available
- `bash scripts/check_context_discipline.sh`

### 3. Marketing BI + Marketing Ops Source Routes

Purpose:

- Promote Marketing BI and Marketing Ops workbooks into Data Pond source tables and Captain advisory reads.

Representative paths:

- `Data_Collection/utils/marketing_bi_conversion_ingest.py`
- `Data_Collection/utils/marketing_bi_excel_export_ingest.py`
- `Data_Collection/utils/marketing_bi_packet_ingest.py`
- `Data_Collection/utils/marketing_ops_summary_ingest.py`
- `apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql`
- `apps/api/migrations/0031_create_marketing_bi_daily_packets.sql`
- `apps/api/migrations/0034_create_marketing_bi_conversion_summary.sql`
- `apps/api/migrations/0035_create_marketing_bi_excel_exports.sql`
- `apps/api/migrations/0036_create_marketing_bi_conversion_dashboard.sql`
- `apps/api/migrations/0037_create_marketing_bi_recovery_sources.sql`
- `apps/api/migrations/0038_create_marketing_bi_cost_per_conversion.sql`
- `apps/api/migrations/0041_create_marketing_ops_summary.sql`
- paired `infra/migrations/017` through `028`
- `docs/MARKETING_BI_CONVERSION_SOURCE_CONTRACT_2026-04-28.md`
- `docs/MARKETING_BI_DAILY_PACKET_SOURCE_CONTRACT_2026-04-28.md`
- `docs/MARKETING_OPS_SUMMARY_SOURCE_CONTRACT_2026-05-04.md`

Promotion order:

- After property identity. Can be split into smaller commits by source family:
  - cancel/denial + traffic conversions
  - daily packet + conversion summary
  - native Excel exports
  - Marketing Ops Summary

Required checks:

- source-specific dry runs
- `bash scripts/check_property_identity_governance.sh`
- `bash scripts/check_context_discipline.sh`

### 4. Reputation.com Source Route

Purpose:

- Reputation.com Data Pond tables, identity mapping, and Captain reputation evidence.

Representative paths:

- `Data_Collection/utils/reputation_com_ingest.py`
- `apps/api/migrations/0040_create_reputation_com_tables.sql`
- `infra/migrations/027_create_reputation_com_tables.sql`
- `reports/reputation/generate_reputation_com_brief.py`

Promotion order:

- After property identity.

Required checks:

- Reputation.com ingest dry run / local load summary
- `bash scripts/check_property_identity_governance.sh`
- `bash scripts/check_pib_guardrails.sh`

### 5. Captain Runtime + Captain Brief Family

Purpose:

- Captain support-agent runtime, Captain Brief read payloads, source mirrors, activation standards, and display/header standards.

Representative paths:

- `apps/api/src/platform/captain/`
- `apps/api/src/routes/captain.ts`
- `apps/api/scripts/captain_sources_to_d1.py`
- `apps/api/scripts/dataforseo_captain_to_d1.py`
- `scripts/standup_captain_roster.py`
- `scripts/audit_captain_readiness.py`
- `scripts/captain_fleet_support.py`
- `scripts/generate_captain_runtime_catchup_plan.py`
- `scripts/run_captain_runtime_catchup.py`
- `reports/captains_log/*`
- `docs/CAPTAIN_*`
- `docs/CAPTAINS_*`
- `docs/PORTFOLIO_CAPTAIN_ACTIVATION_STANDARD_2026-05-04.md`

Promotion order:

- After source foundations that Captain reads depend on.
- Keep Captain runtime separate from Captain report artifact outputs.

Required checks:

- `npm run typecheck` in `apps/api`
- focused Captain route/runtime tests
- `bash scripts/check_captains_brief_header_lock.sh` if Captain report generators are included
- `bash scripts/check_pib_guardrails.sh`

### 6. Platform App/Auth/Control Plane

Purpose:

- Zero Trust, auth/session, API/web app shell, permissions, control plane, D1 mirror, and Watchtower platform surfaces.

Representative paths:

- `apps/api/src/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/lib/*`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/platform.ts`
- `apps/api/src/routes/pond.ts`
- `apps/api/scripts/d1_mirror_sync.py`
- `apps/api/scripts/wrangler_auth.py`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/auth-provider.tsx`
- `apps/web/src/components/shared/*`
- `apps/web/src/lib/*`
- `.github/workflows/context-discipline.yml`
- `.nvmrc`

Promotion order:

- This is likely multiple branches:
  - Zero Trust/auth substrate
  - app shell/navigation/permissions
  - Watchtower/control-plane health
  - D1 mirror/release tooling

Required checks:

- `npm run typecheck` in `apps/api`
- web build/typecheck where available
- relevant platform tests
- context and PIB guardrails

### 7. EVS + BrowserStack

Purpose:

- Experiential validation service, BrowserStack profiles, request lifecycle, and proof artifacts.

Representative paths:

- `apps/api/src/evs/`
- `apps/api/src/routes/evs.ts`
- `apps/api/test/platform/evs-*.test.ts`
- `apps/web/src/app/evs/`
- `packages/shared/src/evs-*`
- `evs/`
- `ops/browserstack/`
- `.github/workflows/evs-browserstack-experiential.yml`
- `run_pilot_browserstack_daily.sh`
- `docs/WORKTREE_EVS_BROWSERSTACK_*`

Promotion order:

- Can move independently after platform auth contracts are stable.

Required checks:

- EVS lifecycle/auth tests
- BrowserStack dry run when credentials are available

### 8. Edge Experimentation

Purpose:

- Governed experiment lab, component contracts, dry-run/preflight path, and non-mutating edge experiment data model.

Representative paths:

- `apps/api/src/routes/experiments.ts`
- `apps/api/migrations/0039_create_edge_experimentation_tables.sql`
- `infra/migrations/026_create_edge_experimentation_tables.sql`
- `apps/web/src/app/experiments/`
- `packages/shared/src/experiment-*`
- `docs/EDGE_EXPERIMENTATION_*`
- `docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md`

Promotion order:

- Separate from Content Office/Site Content even though it consults those concepts.

Required checks:

- API typecheck
- web build
- no live mutation without explicit launch approval

### 9. Content Office + GBP Posts + Site Content + VACS + Intelligence

Purpose:

- Governed content operations, GBP post workflow, Site Content Creator, VACS planning/API, and search/intelligence surfaces.

Representative paths:

- `apps/web/src/app/content-office/`
- `apps/web/src/app/gbp-posts/`
- `apps/web/src/app/site-content/`
- `apps/web/src/app/vacs/`
- `apps/web/src/app/intelligence-office/`
- `apps/api/src/routes/gbp-posts.ts`
- `apps/api/src/routes/vacs.ts`
- `apps/api/src/routes/search-intelligence.ts`
- `apps/api/src/routes/intelligence-memory.ts`
- `Venterra_AI_Content_Suite/`
- `docs/INTELLIGENCE_OFFICE_MODEL.md`
- `docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md`

Promotion order:

- Split by workflow:
  - GBP Posts / Content Office
  - Site Content Creator
  - VACS
  - Search Intelligence

Required checks:

- API typecheck
- web build
- relevant route tests

### 10. Pilot CWV / Tracker / Roundup

Purpose:

- Pilot/control CWV reporting, pilot tracker surfaces, GTMetrix/PSI collection, BI normalization, and roundup emails.

Representative paths:

- `pilot_control_cwv/`
- `pilot_roundup/`
- `apps/pilot-tracker-standalone/`
- `apps/web/src/app/tracker/`
- `apps/web/src/components/tracker/`
- `run_pilot_*`
- `docs/PILOT_*`
- `SESSION_MEMORY_2026-04-08_PILOT_SITE_EVIDENCE_AND_HARMONIZATION.md`

Promotion order:

- This is the branch name’s natural home. It should be isolated from the other lanes before release.

Required checks:

- pilot report generation smoke
- web tracker build/typecheck
- relevant GTMetrix/PSI dry run

### 11. Generated Artifacts, Reports, Logs, and Local Outputs

Purpose:

- Evidence outputs and local run artifacts. Most should not be committed unless they are intentional proof artifacts or report deliverables.

Examples:

- `apps/api/scripts/generated/*.sql`
- `Data_Collection/logs/*`
- `logs/*`
- `reports/*/*.html`
- `reports/*/*.json`
- `pilot_control_cwv/reports/*`
- `pilot_roundup/reports/*`
- `evs/reports/*`
- root screenshots like `*-desktop_chrome.png`
- `*.pyc`, `__pycache__/`, `*.tsbuildinfo`
- local DB files

Recommended handling:

- Keep proof artifacts only when they are referenced by docs or required as deliverables.
- Add/adjust `.gitignore` for repeat local build products after confirming no intentionally tracked artifact pattern depends on them.
- Do not stage local credentials, token pickles, temporary Wrangler SQL uploads, or local DBs.

## Suggested Branch Split Order

1. `codex/property-identity-governance`
2. `codex/data-collection-closure`
3. `codex/marketing-bi-source-routes`
4. `codex/reputation-com-source-route`
5. `codex/captain-runtime-and-briefs`
6. `codex/platform-auth-control-plane`
7. `codex/evs-browserstack`
8. `codex/edge-experimentation`
9. `codex/content-office-site-content-vacs`
10. `codex/pilot-cwv-tracker-roundup`
11. `codex/docs-governance-index`

## Immediate Next Step

Create a machine-readable path manifest for the lanes above, then stage one lane at a time with pathspec files. Start with the smallest dependency root:

1. Property Identity + Source Governance Foundation
2. Marketing BI + Marketing Ops Source Routes
3. Captain Runtime + Captain Brief Family

This order lets the source truth land before the Captain read models that depend on it.

## Guardrails

- Do not mutate locked PIB files without explicit approval.
- Do not add new one-off property maps; use the governed identity matrix.
- Do not stage credentials, token pickles, local DBs, temporary SQL uploads, pycache, or generated browser screenshots unless explicitly required as proof artifacts.
- Run `bash scripts/check_pib_guardrails.sh` before any branch/commit handoff.
