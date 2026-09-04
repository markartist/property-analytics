# Agent Readiness Monitor Runbook

Date: 08/27/2026  
Owner: MarketingOps / Property Analytics  
Status: Live scheduled monitor

## Purpose

The Agent Readiness monitor tracks how discoverable and usable Venterra and property sites are for AI agents. It uses Cloudflare's public Agent Readiness scanner, stores raw evidence in R2, and writes normalized current/history rows into the Pond D1 database.

This is useful as a progressive AEO readiness layer, especially for Markdown/LLM-readable summaries, robots/sitemap posture, Content Signals, and later agent-integration patterns.

## Live Assets

- Worker: `/Users/mark/Property_Analytics/ops/cloudflare/agent-readiness-monitor/`
- Production health: `https://agent-readiness.venterrawebops.com/health`
- Production status: `https://agent-readiness.venterrawebops.com/v1/agent-readiness/status`
- Production results: `https://agent-readiness.venterrawebops.com/v1/agent-readiness/results`
- D1 database: `pop-brief-db`
- R2 bucket: `pop-brief-uploads`
- Worker version: `9a42a512-ff3f-4656-a8f9-52d8d2e56eea`

## Schedule

The Worker Cron Trigger runs every six hours and scans due targets in small batches. Each active target defaults to a seven-day cadence.

Current live seed on 09/04/2026:

- `123` active targets
- `95` corporate property pages from governed identity sources
- `28` Resi vanity domains from active Resi Edge manifests
- Batch size: `8` targets per run

This means the first portfolio pass should finish progressively across roughly four days, then each target becomes due seven days after its latest scan.

## Storage Contract

D1 tables:

- `agent_readiness_targets`
- `agent_readiness_runs`
- `agent_readiness_results`
- `agent_readiness_check_results`

Current Pond state should read from `agent_readiness_results WHERE is_current = 1`.

R2 prefixes:

- `agent-readiness/raw/<target_id>/<run_id>.json`
- `agent-readiness/runs/<run_id>.json`

The normalized result keeps stable columns for current Cloudflare checks, including robots.txt, sitemap, Link headers, DNS-AID, Markdown negotiation, AI bot rules, Content Signals, Web Bot Auth, API catalog, OAuth discovery/protected resource, `auth.md`, MCP Server Card, A2A Agent Card, Agent Skills, WebMCP, and ARD. Raw scanner evidence stays in R2 for forward compatibility.

## Target Seeding

Use:

```bash
python3 scripts/seed_agent_readiness_targets.py
```

Apply to remote D1:

```bash
python3 scripts/seed_agent_readiness_targets.py --apply
```

The seed utility resolves properties through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and reads active Resi Edge manifests without changing those manifests.

## Deployment

Apply schema:

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

Deploy Worker:

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

## Manual Runs

`POST /v1/agent-readiness/run` is protected by `AGENT_READINESS_ADMIN_SECRET`. As of 08/27/2026, that secret is intentionally not configured, so the endpoint fails closed with `admin_secret_unconfigured`.

If manual runs are needed, add the secret to Keeper/KSM first and set the Worker secret through the Keeper-backed deployment flow. Do not place the value in a local `.env`, shell history, source code, ticket, or screenshot.

## Validation

Local checks:

```bash
node --check ops/cloudflare/agent-readiness-monitor/worker.js
python3 -m py_compile scripts/seed_agent_readiness_targets.py
sqlite3 :memory: < apps/api/migrations/0067_create_agent_readiness_tables.sql
```

Production smoke:

```bash
curl -sS https://agent-readiness.venterrawebops.com/health
curl -sS https://agent-readiness.venterrawebops.com/v1/agent-readiness/status
curl -sS 'https://agent-readiness.venterrawebops.com/v1/agent-readiness/targets?limit=5'
```

09/04/2026 activation smoke: health returned `ok: true`; status returned `123` active targets. Worker version `9a42a512-ff3f-4656-a8f9-52d8d2e56eea` fixes a success-result insert placeholder mismatch that caused prior rows to fail with `D1_ERROR: 44 values for 45 columns`. Manual run remains intentionally closed because no admin secret is configured, so post-fix proof is expected on the next six-hour scheduled scan.

## Boundary

This monitor is read-only toward Venterra and property websites. It does not edit DNS, robots.txt, WordPress/Kinsta, Resi Edge Workers, content, Cloudflare zone configuration, Jira, Confluence, Microsoft 365, or locked PIB files.

Future Markdown-summary work should be a separate approved implementation lane. This monitor will show whether those changes improve scanner posture once they ship.
