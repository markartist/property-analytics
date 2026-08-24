# Captain Cloudflare Refresh Runbook

## Purpose

Move Captain system refresh as far into Cloudflare as practical while keeping source-system boundaries clear.

The first live slice is the `captain-refresh` Worker. It reads governed D1 state, creates or updates Captain persona/profile defaults, writes current Office Wall snapshots, and stores JSON evidence in R2.

## Current Production State

- Deployment date: `08/24/2026`
- Worker version: `6c0c4fa8-6ed9-47b6-a1c5-dd9072462742`
- Git commit: `d19b96d`
- Custom domain: `captain-refresh.venterrawebops.com`
- Cron schedule: every `30` minutes
- Remote D1 migration: applied to `pop-brief-db`
- Health: live and returning `ok: true`
- Status as of 08/24/2026 validation: no scheduled run had fired yet, so snapshot tables were present but empty.

## Production URLs

- Health: `https://captain-refresh.venterrawebops.com/health`
- Status: `https://captain-refresh.venterrawebops.com/v1/captains/refresh/status`
- Property wall: `https://captain-refresh.venterrawebops.com/v1/captains/<property>/wall`

## Schedule

Cloudflare Cron Trigger:

```text
*/30 * * * *
```

## Data Owned By This Lane

D1 tables:

- `captain_persona_profiles`
- `captain_refresh_runs`
- `captain_office_wall_snapshots`

R2 evidence:

- `captains/office-wall/<property>/<run_id>.json`
- `captains/refresh-runs/<run_id>.json`

## Captain Family Composition Policy

Existing Captains have family composition due by `09/07/2026`.

New Captains should be assigned a due date no later than `14` days after activation once activation-aware due-date automation is added.

Valid family composition statuses:

- `not_started`
- `drafted`
- `captain_selected`
- `asset_generated`
- `approved`

The family portrait is a fictional/persona asset. It must not imply real employee family facts.

## Refresh Boundary

Allowed:

- read governed D1 Captain/Awareness/Ops Watch state;
- create missing Captain persona profile defaults;
- update Captain persona status/deadline fields when the Captain-facing workflow submits approved changes;
- write current and historical Office Wall snapshots;
- write R2 evidence manifests.

Not allowed in this lane:

- edit Jira, Confluence, Microsoft 365, or source-system tickets;
- mutate locked PIB files;
- generate or send executive deliverables;
- treat self notes as publishable evidence;
- give Cloudflare inward access to intranet-only systems.

## Source Strategy

Use two source patterns:

1. Mirror/push for intranet and sensitive systems.
   Internal jobs push sanitized packets to Cloudflare. Cloudflare never reaches inward.

2. Direct Worker harvest only after explicit approval.
   Public/SaaS APIs such as Jira, Confluence, Microsoft Graph, Ahrefs, GA4, or Cloudflare APIs may later be called by Workers only if the needed credentials are represented in Keeper/KSM and set as Worker secrets through the Keeper-backed deployment path.

Manual refresh follows the same rule. `POST /v1/captains/refresh/run` is intentionally disabled until `CAPTAIN_REFRESH_ADMIN_SECRET` is represented in Keeper/KSM and set as a Worker secret. Do not add a local token, `.env`, checked-in secret, or direct environment fallback.

## Deployment

Apply D1 migration:

```bash
python3 - <<'PY'
import os
import subprocess
import sys
from pathlib import Path

repo = Path('/Users/mark/Property_Analytics')
sys.path.insert(0, str(repo))
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

env = build_runtime_env()
env['CLOUDFLARE_ACCOUNT_ID'] = '5a5a60afaad00085864fe6bab7eb2882'
cmd = npx_wrangler_prefix(env) + [
    'd1', 'execute', 'pop-brief-db',
    '--remote',
    '--file', 'apps/api/migrations/0066_create_captain_refresh_tables.sql',
]
subprocess.run(cmd, cwd=repo, env=env, check=True)
PY
```

Deploy Worker:

```bash
python3 - <<'PY'
import os
import subprocess
import sys
from pathlib import Path

repo = Path('/Users/mark/Property_Analytics')
sys.path.insert(0, str(repo))
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

env = build_runtime_env()
env['CLOUDFLARE_ACCOUNT_ID'] = '5a5a60afaad00085864fe6bab7eb2882'
cmd = npx_wrangler_prefix(env) + ['deploy', '--config', 'ops/cloudflare/captain-refresh/wrangler.toml']
subprocess.run(cmd, cwd=repo, env=env, check=True)
PY
```

## Validation

Deployed 08/24/2026 to Worker version `6c0c4fa8-6ed9-47b6-a1c5-dd9072462742`.

Validation on 08/24/2026:

- `GET /health` returned `ok: true`.
- `GET /v1/captains/refresh/status` returned `ok: true` with no latest run yet because the first scheduled Cron Trigger had not fired.
- `GET /v1/captains/AR4PB/wall` returned `snapshot_not_found` before the first scheduled run, which is expected for a newly created snapshot table.

Smoke:

```bash
curl -sS https://captain-refresh.venterrawebops.com/health
curl -sS https://captain-refresh.venterrawebops.com/v1/captains/refresh/status
```

D1 readback:

```sql
SELECT status, property_count, snapshot_count, persona_created_count, persona_due_count, started_at
FROM captain_refresh_runs
ORDER BY started_at DESC
LIMIT 5;

SELECT COUNT(*) AS current_snapshots
FROM captain_office_wall_snapshots
WHERE is_current = 1;
```

## Next Slices

- Wire Data Pond Captain's Office to read `captain_office_wall_snapshots`.
- Add Captain persona selection UI for family composition.
- Add asset-generation pipeline for Captain portrait and family portrait.
- Add direct Jira/Confluence/MS365 Worker harvest only after Keeper/KSM worker secrets and permission scope are approved.
