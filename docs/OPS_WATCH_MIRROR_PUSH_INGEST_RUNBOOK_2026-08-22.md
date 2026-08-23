# Ops Watch Mirror/Push Ingest Runbook

Date: 08/22/2026

## Purpose

This adds the Cloudflare-side receiving lane for Ops Watch mirror/push harvesting. Internal Venterra jobs read approved intranet/private systems, sanitize and reduce the data locally, then push only the approved facts to Cloudflare.

Cloudflare never reaches inward to the intranet.

## Production Endpoint

- Worker: `ops-watch-ingest`
- Host: `https://ops-watch.venterrawebops.com`
- Health: `GET /health`
- Ingest: `POST /v1/ops-watch/ingest`
- R2 evidence prefix: `ops-watch/ingest/<source>/<run_id>.json`
- D1 tables: `ops_watch_ingest_runs`, `ops_watch_signals`, `ops_watch_action_queue`

## Authentication

The first production authentication layer is HMAC request signing:

- Header `x-ops-watch-timestamp`: ISO timestamp within 10 minutes.
- Header `x-ops-watch-signature`: lowercase hex HMAC-SHA256 of `timestamp + "." + rawBody`.
- Worker secret: `OPS_WATCH_INGEST_SHARED_SECRET`.
- Keeper notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`.

The secret is generated and stored in Keeper/KSM first, then set in Cloudflare through the Keeper-backed deployment path. Do not store it in local files, `.env`, ticket comments, screenshots, or shell history.

If the Worker secret is missing or rotated incorrectly, the ingest endpoint fails closed with `ingest_secret_unconfigured`.

## Payload Shape

```json
{
  "source": "intranet_it_help",
  "source_label": "Internal IT Help mirror",
  "run_id": "intranet-it-help-20260822-0800",
  "generated_at": "2026-08-22T08:00:00-05:00",
  "producer": "internal-ops-watch-exporter",
  "schema_version": "ops-watch-ingest-v1",
  "records": [
    {
      "source_id": "BITS-116269",
      "source_url": "https://venterra.atlassian.net/browse/BITS-116269",
      "title": "Request Microsoft Entra app registration access for Ops Watch",
      "status": "Open",
      "owner": "Business IT Services",
      "updated_at": "2026-08-22T08:00:00-05:00",
      "property_refs": [],
      "severity": "high",
      "signal_type": "access_blocker",
      "summary": "Sanitized summary text.",
      "allowed_next_actions": ["follow_up"]
    }
  ]
}
```

Allowed source values at launch:

- `intranet_it_help`
- `intranet_ops`
- `jira_mirror`
- `sharepoint_mirror`
- `ms365_graph_mirror`

Allowed severity values:

- `info`
- `low`
- `medium`
- `high`
- `critical`

## Property Boundary

`property_refs` are source claims, not canonical property identity. Downstream Data Pond/Captain publishing must resolve those values through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and the governed identity matrix before Captain-facing records are published.

## Internal Job Contract

1. Run inside the Venterra network or approved private runtime.
2. Read only approved intranet/private sources.
3. Sanitize sensitive fields locally.
4. Produce one JSON packet per source/run.
5. Sign the raw packet body with the Keeper-backed shared secret.
6. Push to `https://ops-watch.venterrawebops.com/v1/ops-watch/ingest`.
7. Treat a non-2xx response as a failed export and retry with the same `run_id` after backoff.

## Local Sample Packet

```bash
python3 scripts/build_ops_watch_ingest_sample_packet.py \
  --output reports/ops_watch/sample-ingest-packet.json
```

The sample builder does not send requests and does not read secrets.

Push a packet with:

```bash
python3 scripts/push_ops_watch_ingest_packet.py \
  reports/ops_watch/sample-ingest-packet.json
```

## Deployment

Use the existing Keeper-backed Wrangler helper. Do not export Cloudflare tokens by hand.

```bash
python3 - <<'PY'
import os
import subprocess
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix

env = build_runtime_env()
subprocess.check_call(
    npx_wrangler_prefix(env) + [
        "deploy",
        "--config",
        "ops/cloudflare/ops-watch-ingest/wrangler.toml",
    ],
    env=env,
)
PY
```

## Corporate Publish Directive

Before publishing this lane to corporate Git:

1. Stage only the Ops Watch mirror/push ingest code, D1 migrations, Keeper/Cloudflare docs, and durable memory/register/audit updates for this workstream.
2. Do not stage local reports under `/Users/mark/Property_Analytics/reports/`; they are run evidence and are ignored by repo policy.
3. Do not stage raw secret values, local `.env` files, shell transcripts, screenshots containing secrets, or temporary credential material.
4. Do not stage nested repository changes from `Portfolio_Dashboard`, `Portfolio_Monitoring`, `Property_Intelligence_Brief`, `Spotlight_Properties_Report`, `apps/pilot-tracker-standalone`, or `resi_archetype_site` as part of this top-level publish.
5. Do not mutate or publish locked PIB behavior as part of this lane.
6. Run syntax and governance checks before commit:

   ```bash
   python3 -m py_compile scripts/build_ops_watch_ingest_sample_packet.py scripts/push_ops_watch_ingest_packet.py
   node --check ops/cloudflare/ops-watch-ingest/worker.js
   bash scripts/check_property_identity_governance.sh
   bash scripts/check_context_discipline.sh
   bash scripts/check_pib_guardrails.sh
   ```

7. Verify live health before commit:

   ```bash
   curl -sS https://ops-watch.venterrawebops.com/health
   ```

8. Commit with a message that names the Cloudflare ingest lane and does not imply intranet pull access or action execution.

## Open Follow-Up

Build the internal scheduled exporter that produces the same packet shape from approved intranet/private sources, then run it on the desired cadence. Rotate the shared secret by updating the Keeper record first, then re-setting the Worker secret from Keeper before switching internal exporters to the new value.

## 08/22/2026 Canary Proof

- Keeper record: `Ops Watch Ingest Shared Secret`.
- Active notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`.
- Worker secret `OPS_WATCH_INGEST_SHARED_SECRET` was set from Keeper.
- Canary packet: `/Users/mark/Property_Analytics/reports/ops_watch/ops-watch-ingest-canary-20260822-keeper.json`.
- Ingest result: `ok:true`, `accepted_count:1`, `rejected_count:0`.
- R2 key: `ops-watch/ingest/intranet_it_help/ops-watch-ingest-canary-20260822-keeper.json`.
- D1 signal: `ops_watch_signal_fc48d30ea203cabe190f0310b19ae872` for `BITS-116269`.
