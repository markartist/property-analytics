# Captain Reconciliation Plan

Date: 2026-05-06
Owner: MarketingOps / Property Analytics
Scope: reconcile the Captain app/runtime lineage so Captain web surfaces and Captain briefs can promote cleanly to `main`

## Why This Plan Exists

The Elation `Unit-Type Spend / Targeting` enhancement is valid, but it sits on top of Captain runtime/app files that are not present on current `main`.

That means:

- the feature itself is not the problem
- the branch lineage is the problem
- a safe promotion requires a `Captain foundation` step before the `Captain enrichment` step

This plan separates those two layers.

## Non-Negotiable Boundaries

- Do not modify locked PIB generator/template/sender files.
- Reuse PIB data lanes when appropriate, but keep Captain implementation in the Captain/report/runtime family.
- Preserve property identity governance through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.

## Recommended Promotion Order

1. `PR 1: Captain foundation to main`
2. `PR 2: Captain marketing enrichment to main`

This is the cleanest way to avoid bundling unrelated repo noise while still getting the Elation work live.

---

## PR 1: Captain Foundation To Main

Goal:

- land the Captain runtime/API/web foundation on `main`
- make `/v1/captain` and `/analysis/captain` first-class platform surfaces
- establish the data contract that later enrichments can safely extend

### Required Files

API / runtime:

- `/Users/mark/Property_Analytics/apps/api/migrations/0026_create_captain_support_agents.sql`
- `/Users/mark/Property_Analytics/apps/api/migrations/0027_create_captain_runtime_tables.sql`
- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
- `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
- `/Users/mark/Property_Analytics/apps/api/src/index.ts`

Web / client:

- `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`

Navigation / discoverability:

- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx`

### Optional But Helpful

- any focused tests that already exist specifically for Captain runtime or routes
- targeted runtime/route docs if needed for operator onboarding

### What PR 1 Should Exclude

- the Elation `Unit-Type Spend / Targeting` block
- Captain brief generator changes for PIB-style unit-type targeting
- unrelated Watchtower, EVS, VACS, pilot, or site-content work

### Acceptance Criteria For PR 1

- `/v1/captain/roster` responds
- `/v1/captain/properties/:propertyId/brief/latest` responds
- `/analysis/captain` loads through the Captain API path
- Captain route wiring is present in API and discoverable in web navigation
- migrations `0026` and `0027` are included or their equivalent tables are otherwise guaranteed

---

## PR 2: Captain Marketing Enrichment

Goal:

- add the PIB-style secondary marketing evidence layer on top of the Captain foundation
- keep the enhancement narrow and obviously additive

### Required Files

Captain brief/report family:

- `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`

Captain app/runtime enrichment:

- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`

Docs / memory:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

### What PR 2 Adds

- `Unit-Type Spend / Targeting` support section in the reusable Captain brief
- matching `unitTypeTargeting` payload in Captain runtime
- matching Captain web rendering for the same evidence lane
- source preference:
  - local `ad_keyword_performance`
  - remote D1 `ad_keyword_performance`
  - latest generated marketing mirror SQL batch as controlled fallback

### What PR 2 Should Exclude

- new Captain routing or navigation concepts
- unrelated Captain report experiments
- broad PIB or POP Brief changes
- generated report artifacts unless explicitly needed for review proof

### Acceptance Criteria For PR 2

- Elation (`TX4EG`) shows a populated `Unit-Type Spend / Targeting` block in the generated Captain brief
- the Captain app shows the same unit-type targeting evidence
- no locked PIB files are touched
- docs/memory reflect the new governed secondary section

---

## Overlapping Files And How To Handle Them

Two files participate in both PRs:

- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
- `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`

Best practice:

- in `PR 1`, land the baseline Captain runtime/page without the Elation unit-type targeting additions
- in `PR 2`, submit a follow-up patch on those same files that only adds the `unitTypeTargeting` read/render logic

This should be handled as a commit split, not a file split.

---

## Data Prerequisites

For the enrichment to be useful, the following lane must remain healthy:

- `ad_keyword_performance`

Current intent:

- PIB remains a source pattern for unit-type ad targeting
- Captain consumes the same evidence shape without mutating PIB renderers

If local Captain/DB mirrors lag:

- remote D1 is the preferred fallback
- generated marketing mirror SQL is an acceptable controlled fallback for brief generation only

---

## Recommended Execution Pattern

1. Create a clean branch from `main` for `PR 1`.
2. Bring over only the Captain foundation files.
3. Verify API/web build + route wiring.
4. Merge `PR 1`.
5. Create a second clean branch from updated `main` for `PR 2`.
6. Bring over only the marketing enrichment patch and the related docs.
7. Verify Elation in both generated brief and Captain app.
8. Merge `PR 2`.

---

## Summary

The reconciliation problem is not that Captain is too broad. It is that `main` is missing the Captain base.

So the correct plan is:

- first promote Captain as a platform surface
- then promote the Elation/PIB-style marketing evidence enrichment

That gives us:

- cleaner review
- lower risk
- clearer rollback
- no accidental bundling of unrelated workspace work
