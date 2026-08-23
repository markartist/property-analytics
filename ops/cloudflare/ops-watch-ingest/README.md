# Ops Watch Ingest Worker

Dedicated Cloudflare Worker for the mirror/push model.

Internal Venterra jobs push sanitized operational signals outward to:

```text
POST https://ops-watch.venterrawebops.com/v1/ops-watch/ingest
```

Cloudflare does not connect back into the intranet. The Worker stores the signed source packet under the existing R2 bucket prefix `ops-watch/ingest/` and normalizes accepted records into D1 tables.

Current production state:

- Health: `https://ops-watch.venterrawebops.com/health`
- D1 tables: `ops_watch_ingest_runs`, `ops_watch_signals`, `ops_watch_action_queue`
- R2 evidence prefix: `ops-watch/ingest/<source>/<run_id>.json`
- Keeper record: `Ops Watch Ingest Shared Secret`
- Active notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`
- Worker secret: `OPS_WATCH_INGEST_SHARED_SECRET`
- Canary run id: `ops-watch-ingest-canary-20260822-keeper`

Required request headers:

- `x-ops-watch-timestamp`: ISO timestamp within 10 minutes of receipt.
- `x-ops-watch-signature`: lowercase hex HMAC-SHA256 of `timestamp + "." + rawBody`.

The shared secret must live in Keeper/KSM. Do not place it in this folder, `.env`, shell history, screenshots, or ticket comments.

Use `/Users/mark/Property_Analytics/scripts/push_ops_watch_ingest_packet.py` for signed pushes. It resolves the signing secret through Keeper and adds the required service headers.

Primary runbook:

- `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`
