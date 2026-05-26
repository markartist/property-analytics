# Release Split Plan

Status: Working plan
Date: 2026-04-14
Owner: MarketingOps / Property Analytics
Purpose: Turn the current dirty working tree into a safe production release path plus coherent follow-up branches

## 1. Executive Summary

The current dirty tree on `codex/pilot-control-cwv-reporting` is not random noise.

It is mostly four coherent workstreams stacked together:

1. a verified production-worthy operations slice already re-homed to `codex/release-reconcile`
2. a large pilot CWV / pilot reporting expansion
3. an Intelligence Office / Site Content / Search Intelligence / VACS expansion
4. a Zero Trust / SSO / KSM documentation and rollout-tooling expansion

There is also a smaller EVS / BrowserStack stream and a layer of doc drift on files that exist in both the dirty tree and the clean reconcile branch.

## 2. Current Safe Promotion Base

Canonical promotion base:

- Branch: `codex/release-reconcile`
- Worktree: `/private/tmp/property_analytics_reconcile`
- Draft PR: [PR #2](https://github.com/markartist/property-analytics/pull/2)

This branch is the correct source for the next production promotion, not the dirty working branch.

Verified on the clean branch:

- `apps/web` TypeScript
- `apps/api` TypeScript
- Python compile for the touched collection/auth/report scripts
- `scripts/check_context_discipline.sh`
- `scripts/check_pib_guardrails.sh`

## 3. Branch Split Recommendation

### A. Production PR

Use `codex/release-reconcile` as the production candidate.

Keep in the production candidate:

- Watchtower operations deck
- canonical collection retry / closure work
- guest-card suspension
- Google Ads `no_activity` semantics
- KSM-safe D1 auth path
- Morning Full / alerting closure logic
- service-auth API type fix
- repo guardrail and context docs needed to support those changes

Representative files already carried in the clean branch:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`
- `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/generate_morning_full_report.py`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`

### B. Follow-Up Branch: `codex/pilot-cwv-roundup`

This should own the pilot reporting and pilot operations expansion that is still only in the dirty tree.

Primary file families:

- `/Users/mark/Property_Analytics/pilot_control_cwv/`
- `/Users/mark/Property_Analytics/pilot_roundup/`
- `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- `/Users/mark/Property_Analytics/run_pilot_morning_daily_catchup.sh`
- `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
- `/Users/mark/Property_Analytics/run_pilot_gtmetrix_daily.sh`
- `/Users/mark/Property_Analytics/run_pilot_evaluation_daily.sh`
- `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- `/Users/mark/Property_Analytics/ops/gtmetrix/`
- `/Users/mark/Property_Analytics/ops/pilot_roundup/`
- `/Users/mark/Property_Analytics/apps/web/src/app/tracker/`
- `/Users/mark/Property_Analytics/apps/web/src/components/tracker/`
- `/Users/mark/Property_Analytics/apps/web/src/lib/pilot-kpi.ts`

Representative dirty-only files in this stream:

- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_control_gtmetrix.py`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/collect_pilot_homepage_audit_evidence.py`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/gtmetrix_credit_guard.py`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_data_exports_email.py`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
- `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_daily_pilot_evaluation.py`
- `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_pilot_roundup_email.py`

### C. Follow-Up Branch: `codex/intelligence-site-content`

This should own the Intelligence Office / Site Content / Search Intelligence / VACS stream.

Primary file families:

- `/Users/mark/Property_Analytics/apps/api/src/platform/intelligence/`
- `/Users/mark/Property_Analytics/apps/api/src/platform/memory/`
- `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/intelligence-memory.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-intelligence.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/admin-site-content.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/vacs.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/search-intelligence/`
- `/Users/mark/Property_Analytics/apps/web/src/app/intelligence-office/`
- `/Users/mark/Property_Analytics/apps/web/src/app/site-content/`
- `/Users/mark/Property_Analytics/apps/web/src/app/admin/intelligence/`
- `/Users/mark/Property_Analytics/apps/web/src/components/intelligence-office-page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/components/site-content-creator-page.tsx`
- `/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md`
- `/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md`
- `/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md`
- `/Users/mark/Property_Analytics/docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md`

### D. Follow-Up Branch: `codex/zero-trust-sso`

This should own security-boundary docs, Keeper rollout docs, and rollout tooling that should not be bundled with the production Watchtower/collection release.

Primary file families:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_IMPLEMENTATION_CHECKLIST_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_OPERATOR_RUNBOOK_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_WORKER_SECRET_CUTOVER_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_ADOPTION_PLAN.md`
- `/Users/mark/Property_Analytics/docs/KSM_CLOUDFLARE_ZERO_TRUST_RECORD_MANIFEST_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`
- `/Users/mark/Property_Analytics/docs/DATA_POND_ROLE_MODEL_2026-04-14.md`
- `/Users/mark/Property_Analytics/docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md`
- `/Users/mark/Property_Analytics/scripts/zero_trust_rollout_sequence.sh`
- `/Users/mark/Property_Analytics/scripts/zero_trust_worker_secret_cutover.sh`

### E. Follow-Up Branch: `codex/evs-browserstack`

This should own the experiential validation and BrowserStack stream.

Primary file families:

- `/Users/mark/Property_Analytics/evs/`
- `/Users/mark/Property_Analytics/apps/api/src/evs/`
- `/Users/mark/Property_Analytics/apps/api/src/routes/evs.ts`
- `/Users/mark/Property_Analytics/apps/api/test/platform/evs-auth.test.ts`
- `/Users/mark/Property_Analytics/ops/browserstack/`
- `/Users/mark/Property_Analytics/run_pilot_browserstack_daily.sh`
- `/Users/mark/Property_Analytics/.github/workflows/evs-browserstack-experiential.yml`

## 4. Dirty-Tree Classes

### Class 1: Already Re-Homed Cleanly

These are in the dirty tree but match the release-reconcile branch and should not block production shaping:

- `/Users/mark/Property_Analytics/.gitignore`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py`
- `/Users/mark/Property_Analytics/apps/api/src/lib/service-auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/watchtower/page.tsx`
- `/Users/mark/Property_Analytics/generate_morning_full_report.py`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

### Class 2: Shared Paths Still Drifting

These exist in both the dirty tree and the reconcile branch but differ, so they need explicit human review before any additional promotion:

- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/pib/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/gsc/page.tsx`
- `/Users/mark/Property_Analytics/apps/api/src/index.ts`
- `/Users/mark/Property_Analytics/apps/api/src/middleware/auth.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/platform.ts`
- `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py`
- `/Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh`
- `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/gsc_collector.py`
- `/Users/mark/Property_Analytics/scripts/check_context_discipline.sh`
- `/Users/mark/Property_Analytics/AGENTS.md`

These are not junk, but they should not be blindly layered onto the production candidate.

### Class 3: Local or Risky-to-Commit Files

These should be reviewed with extra caution and should not be automatically included in any branch split:

- `/Users/mark/Property_Analytics/apps/web/.env.production`
- `/Users/mark/Property_Analytics/.nvmrc`
- `/Users/mark/Property_Analytics/Project_Memory.md`
- `/Users/mark/Property_Analytics/memory/MEMORY_INDEX.md`
- `/Users/mark/Property_Analytics/memory/PROJECT_STATE.md`

## 5. Practical Next Sequence

1. Keep production promotion work anchored to `codex/release-reconcile`.
2. Open a narrower follow-up PR from `codex/release-reconcile` to `main` if production risk needs to be reduced further before shipping.
3. Create the pilot branch next, because it is the largest volume of dirty-only work.
4. Create the Intelligence / Site Content branch after that.
5. Create the Zero Trust / SSO branch after that.
6. Treat EVS as its own isolated branch rather than letting it ride inside platform or pilot work.

## 6. Working Conclusion

The repo is not suffering from meaningless clutter.

It is carrying:

- one release-ready operational slice
- one large pilot product/reporting slice
- one intelligence/content slice
- one security architecture slice
- one EVS slice

That means the right response is branch separation and review discipline, not more generic cleanup.
