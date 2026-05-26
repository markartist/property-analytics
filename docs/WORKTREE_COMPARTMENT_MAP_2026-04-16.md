# Worktree Compartment Map

Date: 2026-04-16
Purpose: Cleanly separate active in-progress workstreams in the current repo state so they can be finished intentionally instead of remaining mixed in one dirty worktree.

## Current Reality

The current worktree is not one dangling task. It is several live workstreams collapsed into one branch/worktree:

1. Platform / app rollout
2. Data Collection hardening
3. Pilot / CWV reporting expansion
4. Content operations / Intelligence Office / Site Content

There are also loose generated artifacts mixed into the root and app tree that should not compete with active source work.

## Active Workstreams

### 1. Platform / App Rollout

Primary signals:

- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/platform.ts`
- `apps/api/src/index.ts`
- `apps/web/src/app/watchtower/page.tsx`
- `apps/web/src/components/auth-provider.tsx`
- `apps/web/src/app/login/`
- `apps/web/src/lib/api.ts`
- Cloudflare / Wrangler / bootstrap docs and scripts

Interpretation:

- This is the main product-platform and Zero Trust rollout lane.
- It appears to include Watchtower work, browser bootstrap/auth hardening, and platform-facing API route growth.

Recommended compartment:

- Treat as one `platform-app` workstream unless we later split `watchtower` from `auth-bootstrap`.
- Working manifest:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_PLATFORM_APP_MANIFEST_2026-04-16.md`

### 2. Data Collection Hardening

Primary signals:

- `Data_Collection/orchestration/daily_master_collection.py`
- `Data_Collection/monitoring/alert_sender.py`
- `Data_Collection/db/database_manager.py`
- `Data_Collection/collectors/guest_card_collector.py`
- `Data_Collection/collectors/gsc_collector.py`
- `Data_Collection/orchestration/retry_incomplete_collections.py`
- `Data_Collection/utils/daily_collection_closure.py`
- `Data_Collection/utils/source_freshness_policy.py`

Interpretation:

- This is a coherent collection-ops lane around retry behavior, closure state, and freshness-aware alerting.

Recommended compartment:

- Keep as one `data-collection-hardening` workstream.
- Working manifest:
  - `/Users/mark/Property_Analytics/docs/WORKTREE_DATA_COLLECTION_MANIFEST_2026-04-16.md`

### 3. Pilot / CWV Reporting Expansion

Primary signals:

- `pilot_control_cwv/scripts/generate_pilot_control_cwv_report.py`
- `pilot_control_cwv/scripts/collect_pilot_control_psi.py`
- large `pilot_control_cwv/docs/` additions
- `ops/pilot_roundup/`
- `pilot_roundup/`

Interpretation:

- This is a pilot analytics/reporting lane with both real reporting work and a lot of prototype/supporting material.

Recommended compartment:

- Split mentally into:
  - `pilot-reporting-core`
  - `pilot-prototypes-and-artifacts`

### 4. Content Operations / Intelligence

Primary signals:

- `apps/api/src/routes/admin-site-content.ts`
- `apps/web/src/components/site-content-creator-page.tsx`
- `apps/api/src/platform/intelligence/`
- `apps/api/src/platform/shared/specs-property-marketing-v1.ts`
- `apps/web/src/app/intelligence-office/`
- `apps/api/src/routes/vacs.ts`
- `apps/api/src/routes/intelligence-memory.ts`

Interpretation:

- This is the governed content operations lane.
- It includes Intelligence Office, governed memory, Site Content Creator, and VACS-adjacent routing.

Recommended compartment:

- Keep as one `content-operations` workstream until Site Content and VACS need to split more formally.

## Loose Artifact Cleanup

These are not core source tasks and should stay out of the way:

- root screenshot captures such as `*-desktop_chrome.png` and `*-iphone_safari.png`
- packaged plugin tarballs such as `*.tgz`
- stray empty files such as `2026-04-15`

Cleanup stance:

- preserve useful evidence by moving captures into ignored output locations
- ignore packaged tarballs instead of letting them clutter worktree review
- remove empty stray files

## Suggested Working Order

1. Finish and commit `content-operations`
2. Finish and commit `platform-app`
3. Finish and commit `data-collection-hardening`
4. Review `pilot-reporting-core`
5. Archive or discard `pilot-prototypes-and-artifacts`

## Operating Rule Going Forward

When a new turn touches one of these lanes:

- stage only files from that lane
- avoid mixing cleanup/docs from other lanes into the same commit
- keep generated artifacts in ignored output locations, not the repo root
