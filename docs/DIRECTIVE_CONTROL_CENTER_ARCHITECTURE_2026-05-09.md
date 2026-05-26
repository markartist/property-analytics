# Directive Control Center Architecture

Date: 05/09/2026
Governing source: `docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md`

## Repository Findings

The repository already has the right platform pattern for a governed control surface:

- Config and governed source documents live under `config/` and `docs/`.
- API routes live under `apps/api/src/routes`.
- Runtime/domain services live under `apps/api/src/platform`.
- Database changes use additive D1 migrations under `apps/api/migrations`.
- Platform tests live under `apps/api/test/platform`.
- Admin UI surfaces live under `apps/web/src/app/admin`.
- Existing authorization uses `requireAuth` and `requireOfferingAction`.

The Directive Control Center belongs in the Data Pond / Captain runtime platform layer because directives are operational policy data used by Captains, Commodores, Fleet review, Expert Bench lanes, and Fleet Scribe publication controls. It does not belong inside PIB generation, Watchlist report generation, or ad hoc report templates.

## Placement

- Domain model and services: `apps/api/src/platform/directives`
- API surface: `apps/api/src/routes/directives.ts`
- Migration: `apps/api/migrations/0047_create_directive_control_center.sql`
- Admin UI entry: `apps/web/src/app/admin/directives/page.tsx`
- Documentation: `docs/DIRECTIVE_CONTROL_CENTER_*`

## Architectural Boundary

This feature is additive. It does not create a parallel reporting system and does not mutate locked PIB files. Report builders, Captain routines, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems should resolve directive behavior from approved directive versions instead of embedding mutable prompt text directly in report code.

## Operating Principle

Directives are policy data. They must be:

- structured
- versioned
- validated
- auditable
- testable
- deployable

Draft directives are simulation-only. Active runtime behavior must resolve through approved active directive versions.
