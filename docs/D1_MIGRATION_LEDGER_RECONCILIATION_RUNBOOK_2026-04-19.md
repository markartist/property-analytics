# D1 Migration Ledger Reconciliation Runbook

Date: 2026-04-19  
Owner: MarketingOps / Data Pond Platform  
Status: Active operational runbook

## Purpose

This runbook exists for one specific enterprise cleanup case:

- the remote D1 schema already contains the effects of older migrations
- but Wrangler still reports those migrations as pending because `d1_migrations` is incomplete

This can happen when older schema changes were applied outside the current Wrangler-led migration history.

## Canonical Tool

Use:

- `/Users/mark/Property_Analytics/scripts/reconcile_d1_migration_history.py`

The script is intentionally conservative:

- it does not replay old DDL
- it only reconciles ledger rows for known migrations
- it only inserts missing `d1_migrations` rows when schema probes prove that the migration effects already exist

## Current Legacy-Reconcile Set

The script currently covers:

- `0013_enrich_communities.sql`
- `0014_create_pib_tables.sql`
- `0015_create_fish_tables.sql`
- `0016_create_ad_keyword_performance.sql`
- `0017_create_data_freshness.sql`
- `0018_magic_links_and_roles.sql`
- `0021_create_phase1_platform_tables.sql`
- `0022_create_runtime_release_state.sql`

These were the known legacy-drift migrations in the live `pop-brief-db` environment as of 2026-04-19.

## Authentication Model

The tool uses the same Keeper-backed Cloudflare release auth path as the enterprise release bridge:

- `KSM_CLOUDFLARE_TOKEN_NOTATION`
- default notation:
  - `keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password`

It also requires:

- `CLOUDFLARE_ACCOUNT_ID`

The default account id is already baked into the script for the current production account.

## Safe Operator Sequence

### 1. Dry run first

```bash
python3 /Users/mark/Property_Analytics/scripts/reconcile_d1_migration_history.py --json
```

Review:

- `eligible_to_insert`
- `blocked`
- `failed_after_apply`

The dry run is safe. It only inspects:

- remote table inventory
- relevant remote column inventory
- current `d1_migrations` rows

### 2. Apply only if all targets are eligible or intentionally understood

```bash
python3 /Users/mark/Property_Analytics/scripts/reconcile_d1_migration_history.py --apply --json
```

Expected success shape:

- `status = healthy`
- `failed_after_apply = []`

### 3. Verify Wrangler sees a clean migration state

```bash
npx wrangler d1 migrations apply pop-brief-db --remote
```

Expected result:

- `No migrations to apply`

## What This Runbook Does Not Do

It does **not**:

- apply missing schema changes
- rewrite historical migration files
- mark arbitrary migrations as complete without schema evidence
- replace the normal declarative Wrangler migration path for new migrations

This is a one-time or rare reconciliation tool for legacy drift, not a new default migration strategy.

## Enterprise Rule

After reconciliation:

- new schema work should go back to normal `apps/api/migrations/*.sql`
- remote promotion should rely on Wrangler’s normal migration apply flow
- this runbook should only be used when ledger drift is proven and schema already exists

## 2026-04-19 Live Outcome

On 2026-04-19, the script successfully reconciled the live `pop-brief-db` ledger so Wrangler no longer reported the legacy schema migrations above as pending.

That restored the intended enterprise posture:

- schema truth and migration ledger are aligned again
- the release branch can promote from a declarative baseline
- Watchtower release/runtime state no longer depends on unresolved migration-history drift
