# Captain Routine Scheduler Runbook

Status: v1.0
Date: 08/31/2026
Owner: MarketingOps / Data Pond / Captain Runtime

## Purpose

Keep every active Captain support-agent routine current without brute-forcing the fleet.

The scheduler turns the active `captain_support_agents` roster into an explicit due queue in D1, leases bounded batches on Cloudflare Cron, executes the existing Captain Runtime support-agent logic, records `captain_agent_runs`, and advances the next due time.

## Production Shape

- Runtime owner: `apps/api/src/platform/captain/runtime.ts`
- Worker host: `pop-brief-api`
- Cron schedule: every `15` minutes
- Current deployed Worker version: `30a8911d-93c1-432f-a74f-13ac42ffcfb8`
- Routine contract: `config/captain_active_routine_manifest.json`
- D1 migration: `apps/api/migrations/0068_create_captain_routine_schedule.sql`
- Infra mirror: `infra/migrations/045_create_captain_routine_schedule.sql`
- Schedule table: `captain_routine_schedule`
- Run table: `captain_agent_runs`

## Cadence Contract

Every active property Captain should have:

- `8` daily lanes: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, Navigator Watch, Experience Watch, and Boatswain.
- `3` weekly lanes: Reputation Watch, Logkeeper, and Supervisor Scribe.

The schedule table is seeded from live D1 `captain_support_agents`. It is not a parallel roster.

## Efficiency Rules

- Cron wakes every `15` minutes, but only due rows run.
- Due rows are leased before execution to avoid duplicate work.
- Expired leases are released automatically.
- Normal batch size is bounded at `50` per routine wakeup; the Monday weekly catch-up window may lease up to `75`.
- Failed rows retry after `2` hours.
- Skipped rows retry after `12` hours.
- Successful and warning rows advance by cadence.
- Priority favors Critical/Spotlight/Sale designations and operational lanes such as Source Scout, Boatswain, Inventory, and Funnel.

## Boundary

Allowed:

- read governed D1 source tables;
- execute existing Captain Runtime support-agent logic;
- write `captain_agent_runs`;
- upsert Captain watch items and actions through the existing runtime;
- update `captain_routine_schedule`.

Not allowed:

- mutate Jira, Confluence, Microsoft 365, source tickets, or intranet systems;
- mutate locked PIB files;
- create local credential files;
- bypass Keeper/KSM for Cloudflare deployment.

## Validation

Targeted test:

```bash
npx tsx --test test/platform/captain-routine-scheduler.test.ts
```

Typecheck:

```bash
npm --prefix apps/api run typecheck
```

Remote status checks:

```sql
SELECT status, COUNT(*) AS count
FROM captain_routine_schedule
GROUP BY status;

SELECT cadence, COUNT(*) AS due_count
FROM captain_routine_schedule
WHERE status = 'active'
  AND next_run_at <= datetime('now')
GROUP BY cadence;

SELECT run_type, run_status, COUNT(*) AS count, MAX(started_at) AS latest_started
FROM captain_agent_runs
WHERE started_at >= datetime('now', '-24 hours')
GROUP BY run_type, run_status;
```

## Relationship To Captain Refresh

`captain-refresh` remains the Office Wall/persona snapshot lane. This scheduler is the routine execution lane. The two should stay separate:

- routine scheduler updates run/watch/action state;
- Captain refresh snapshots the resulting state for the Office Wall and R2 evidence.
