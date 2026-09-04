# Agent Readiness Monitor

This Worker runs the weekly Agent Readiness monitor for Pond-backed reporting.

- Worker: `agent-readiness-monitor`
- Custom domain: `agent-readiness.venterrawebops.com`
- Scanner source: Cloudflare's public Agent Readiness scanner at `https://isitagentready.com/api/scan`
- D1 database: `pop-brief-db`
- R2 bucket: `pop-brief-uploads`
- R2 prefixes: `agent-readiness/raw/` and `agent-readiness/runs/`

The Worker is read-only toward Venterra and property websites. It scans the target URLs, stores raw scanner evidence in R2, writes normalized current/history rows into D1, and advances each active target's `next_scan_after` by its cadence. It does not change DNS, robots.txt, Resi Edge Workers, WordPress, Jira, Confluence, Microsoft 365, or PIB files.

## Schedule

The Cron Trigger runs every six hours and processes due targets in small batches. Each active target has a default seven-day cadence, so the portfolio is scanned progressively instead of in one weekly blast.

## Endpoints

- `GET https://agent-readiness.venterrawebops.com/health`
- `GET https://agent-readiness.venterrawebops.com/v1/agent-readiness/status`
- `GET https://agent-readiness.venterrawebops.com/v1/agent-readiness/targets?limit=100`
- `GET https://agent-readiness.venterrawebops.com/v1/agent-readiness/results?limit=50`
- `POST https://agent-readiness.venterrawebops.com/v1/agent-readiness/run`

Manual runs require `AGENT_READINESS_ADMIN_SECRET`, set only through the Keeper-backed Wrangler path. If the secret is not configured, the manual endpoint fails closed with `admin_secret_unconfigured`.

## D1 Tables

- `agent_readiness_targets`
- `agent_readiness_runs`
- `agent_readiness_results`
- `agent_readiness_check_results`

`agent_readiness_results.is_current = 1` is the Pond-friendly current state. Raw scanner responses remain in R2 so the normalizer can be revised without losing evidence when Cloudflare adds checks.

## Deployment

Use the existing Keeper-backed Wrangler helper:

```bash
python3 - <<'PY'
import subprocess
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

env = build_runtime_env()
cmd = npx_wrangler_prefix(env) + [
    "deploy",
    "--config",
    "ops/cloudflare/agent-readiness-monitor/wrangler.toml",
]
raise SystemExit(subprocess.call(cmd, env=env))
PY
```

Apply the D1 migration first:

```bash
python3 - <<'PY'
import subprocess
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

env = build_runtime_env()
cmd = npx_wrangler_prefix(env) + [
    "d1",
    "execute",
    "pop-brief-db",
    "--remote",
    "--file",
    "apps/api/migrations/0067_create_agent_readiness_tables.sql",
]
raise SystemExit(subprocess.call(cmd, env=env))
PY
```

Seed governed vanity targets from active Resi Edge manifests:

```bash
python3 scripts/seed_agent_readiness_targets.py --apply
```
