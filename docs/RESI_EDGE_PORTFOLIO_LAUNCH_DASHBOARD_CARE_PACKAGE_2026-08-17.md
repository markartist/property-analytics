# Resi Edge Portfolio Launch Dashboard Care Package

Status: Future-agent handoff / context package
Date: 08/17/2026
Audience: Codex picking this work back up

## Start Here

This thread started as curiosity about Hono. The key realization: Hono is already in the repo. `apps/api` is a Hono Worker API today, and `apps/web` is the governed UI surface. The right move is not to introduce Hono, but to use the existing Hono pattern for a read-only launch-status API that feeds a polished portfolio launch dashboard.

The vibe Mark is asking for: a real dashboard that can carry a "dog-and-pony show" moment without becoming a fake marketing page or an unsafe control plane. It should feel sharp, credible, fast, and executive-ready, while still giving operators drilldown detail when needed.

Think: proof surface, not deploy surface.

## Must-Read Files

Before building anything, read these:

- `/Users/mark/Property_Analytics/AGENTS.md`
- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_LAUNCH_PHASE_2_PREP_2026-08-14.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_LAUNCH_DASHBOARD_HONO_PROPOSAL_2026-08-17.md`
- `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_RELEASE_CONTROL_RUNBOOK_2026-08-13.md`
- `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md`
- `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`

If the work starts touching model brainstorming, also read:

- `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_ARCHITECTURE_2026-05-10.md`
- `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SECURITY_AND_REDACTION_2026-05-10.md`

## Current Architectural Facts

- `apps/api/package.json` already includes `hono`.
- `apps/api/src/index.ts` already creates `const app = new Hono` and mounts route groups under `/v1`.
- `apps/web` is a Next.js app and is the canonical place for new governed UI.
- The old `Portfolio_Dashboard` is legacy-reusable only.
- The Resi Edge canonical Worker/package is not the place to experiment.
- The dashboard should consume snapshots produced by governed scripts.
- Public or showpiece mode must be explicitly redacted.

## Best First Build Shape

Build in this order:

1. Static UI prototype in `apps/web`
2. Snapshot schema and local mock data
3. Non-mutating snapshot builder script
4. Hono read-only API route
5. Connected dashboard
6. Redacted showpiece mode

Do not begin with a live API if the data contract is not shaped yet. The dashboard story and snapshot schema are the spine.

## Likely Files To Add Later

Possible frontend files:

- `/Users/mark/Property_Analytics/apps/web/src/app/resi-edge/launch/page.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/app/resi-edge/launch/launch-dashboard-client.tsx`
- `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/types.ts`
- `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/mock-data.ts`

Possible API files:

- `/Users/mark/Property_Analytics/apps/api/src/routes/resi-edge-launch.ts`
- `/Users/mark/Property_Analytics/apps/api/test/routes/resi-edge-launch.test.ts`

Possible script files:

- `/Users/mark/Property_Analytics/scripts/build_resi_edge_launch_dashboard_snapshot.py`

Possible output lane:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard/`

## Data Sources To Respect

Use existing evidence. Do not re-invent source truth.

Important current packets and lanes:

- `reports/resi_edge_performance/cohort-readouts/`
- `reports/resi_edge_performance/phase2-preflight/`
- `reports/resi_edge_performance/phase2-manifest-prep/`
- `reports/resi_edge_performance/phase2-analytics-profile-plan/`
- `reports/ahrefs_admin/phase2_vanity_projects/`
- `reports/ahrefs_admin/legacy_folder/`
- `reports/ahrefs_admin/legacy_project_purge/`
- `reports/ga4_admin/phase2_default_uri/`

The dashboard should display:

- cohort readiness
- property readiness
- launch timeline
- current blockers
- proof packet availability
- stale/missing evidence
- vanity/staging URL status
- GA4/Ahrefs/GSC/Captain/Data Pond readiness
- stage/live proof status

## Guardrails

Do not touch locked PIB files.

Do not modify canonical PIB generation, rendering, or sending behavior.

Do not modify the canonical Resi Edge Worker/runtime/package without explicit current-task approval.

Do not create mutation endpoints.

Do not add deployment buttons.

Do not add one-off property maps. Resolve property identity through the governed identity matrix and helper path.

Do not create local credential files or `.env` secret paths. Keeper/KSM is the source of truth.

Do not expose raw secrets, raw provider payloads, raw Ahrefs keys, provider tokens, Access secrets, or internal credential state.

Human-facing dates must be `MM/DD/YYYY`.

JSON, filenames, logs, and IDs may keep ISO dates.

Use only official Venterra colors:

- `#15284B`
- `#3D66B9`
- `#294782`
- `#5A81CF`
- `#7DCAC2`
- `#E02472`
- `#F6F6F5`
- `#BD4830`
- `#D6D6D2`
- `#3B9189`
- `#9B9B96`
- `#000000`
- `#FFFFFF`

Do not use discontinued Galliano `#EAAB00`.

## Product Feeling

Mark wants this to be useful and presentable. Make it feel like an operational command view that just happens to be beautiful.

Good qualities:

- composed
- confident
- quick to scan
- rich without being noisy
- source-grounded
- credible in front of leadership
- obvious where launch stands
- easy to drill into proof

Avoid:

- a generic SaaS landing page
- huge empty hero sections
- fake excitement
- decorative gradients as the main design idea
- in-app explanatory copy
- cards inside cards
- status text that hides what is actually blocked
- UI that implies the dashboard can deploy or approve changes

## Suggested UI Sections

Dashboard top band:

- phase name
- launch date
- readiness count
- blockers count
- latest snapshot timestamp
- confidence/staleness indicator

Main body:

- readiness by phase/cohort
- property status grid
- blocker board
- launch timeline
- evidence freshness strip
- property drilldown drawer or detail panel

Showpiece mode:

- simplified portfolio progress
- crisp timeline
- selected success metrics
- redacted blockers
- latest proof posture
- no internal paths

Operator mode:

- full gate groups
- source packet references
- evidence age
- property identity details
- next required action

## Technical Preferences

Frontend:

- Next.js inside `apps/web`.
- Use existing app conventions.
- Use lucide-react icons for visual controls.
- Keep controls compact and predictable.
- Verify with Playwright screenshots if implementing UI.

API:

- Hono route group in `apps/api`.
- Zod or local TypeScript types for response contracts.
- Explicit redaction transform.
- Explicit staleness metadata.
- Clear cache headers.
- Auth-gate operator endpoints.

Data:

- Prefer generated snapshot JSON over live ad hoc reads.
- Use R2 only if deployment/runtime access needs it.
- Use D1 only if historical querying becomes necessary.
- Keep local report packets as the audit trail.

## The One-Sentence Design Principle

The launch dashboard should make the governed evidence legible, impressive, and safe to share, without becoming a second brain or a second steering wheel.

## Helpful First Prompt To Continue

"Read `docs/RESI_EDGE_PORTFOLIO_LAUNCH_DASHBOARD_HONO_PROPOSAL_2026-08-17.md` and `docs/RESI_EDGE_PORTFOLIO_LAUNCH_DASHBOARD_CARE_PACKAGE_2026-08-17.md`, then build Phase 0: a static `/resi-edge/launch` prototype in `apps/web` using mocked snapshot data and the Venterra palette. Do not add API routes or mutation behavior yet."

