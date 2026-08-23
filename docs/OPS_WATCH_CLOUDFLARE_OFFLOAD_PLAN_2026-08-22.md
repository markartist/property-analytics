# Ops Watch Cloudflare Offload Plan

Date: 08/22/2026
Owner: MarketingOps / Property Analytics
Status: architecture plan with mirror/push ingest implemented

## Direction

Move recurring harvest work out of local Codex wakeups where practical and into Cloudflare-managed execution:

- Cloudflare Workers Cron Triggers for scheduled orchestration
- Cloudflare Queues for fan-out and retry
- Durable Objects for per-source or per-property leases/state
- D1 for normalized watch state and run ledgers
- R2 for immutable raw source snapshots and evidence packets
- Cloudflare Access service auth for protected internal APIs

Local Codex remains useful for analysis, report drafting, approval review, and one-off exploration. Cloudflare should own predictable polling, retry, state tracking, and packet publication.

## Current Implementation

The first offload lane is live using the mirror/push model:

- Worker: `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/worker.js`
- Host: `https://ops-watch.venterrawebops.com`
- Ingest: `POST /v1/ops-watch/ingest`
- Health: `GET /health`
- Runbook: `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`
- D1 migration: `/Users/mark/Property_Analytics/apps/api/migrations/0065_create_ops_watch_ingest_tables.sql`
- R2 prefix: `ops-watch/ingest/<source>/<run_id>.json`

This first live lane receives signed sanitized packets pushed from inside Venterra/private contexts. It does not let Cloudflare reach inward.

Proof:

- Keeper record `Ops Watch Ingest Shared Secret` created.
- Worker secret `OPS_WATCH_INGEST_SHARED_SECRET` set from Keeper.
- Live canary `ops-watch-ingest-canary-20260822-keeper` accepted `1` record.
- D1 readback found accepted run and signal `ops_watch_signal_fc48d30ea203cabe190f0310b19ae872`.
- R2 readback found `ops-watch/ingest/intranet_it_help/ops-watch-ingest-canary-20260822-keeper.json`.

## Best-Practice Split

Cloudflare should own:

- Scheduled Jira/Confluence/MS365 harvest kickoff
- Per-source rate limiting and retry envelopes
- Normalized source snapshots in R2
- Run metadata and freshness status in D1
- Dedupe, staleness detection, and severity scoring
- Publishing reviewed read models for Data Pond/Captain visibility
- Watchtower health status for harvest lanes

Codex should own:

- Ad hoc investigation
- Schema evolution and source parser changes
- Human-reviewed action summaries
- Ticket/comment/send actions that require explicit approval
- Executive or nonstandard report composition

## Proposed Worker Topology

1. `ops-watch-scheduler`
   - Cron-triggered Worker.
   - Creates a run id and enqueues source jobs.
   - Does not call external systems directly except for lightweight health checks.

2. `ops-watch-harvester`
   - Queue consumer.
   - Pulls one source/scope at a time.
   - Writes raw snapshots to R2 and source run rows to D1.
   - Uses Keeper-backed deployment secrets or Cloudflare secret bindings only after Keeper/KSM record mapping is documented.

3. `ops-watch-normalizer`
   - Converts raw Jira/Confluence/MS365 payloads into common watch signals.
   - Resolves property identity through the governed identity matrix contract.
   - Writes normalized rows to D1.

4. `ops-watch-publisher`
   - Builds the read model used by Data Pond and Captain Watch.
   - No outbound Jira comments, transitions, email sends, or Teams messages without a reviewed action queue.

5. `ops-watch-action-gateway`
   - Future phase.
   - Executes approved actions such as Jira comments, assignee updates, Outlook sends, or Teams posts.
   - Requires explicit approval state, audit rows, idempotency keys, and least-privilege OAuth scopes.

## Data Storage Contract

- R2:
  - Raw source payloads
  - Sanitized evidence packets
  - Human-readable run readouts
- D1:
  - `ops_watch_ingest_runs`
  - `ops_watch_signals`
  - `ops_watch_action_queue`
  - future read/publish layer may also populate `captain_watch_items` and `captain_actions` after review.
- Data Pond API:
  - Read-only status and details first
  - Mutating action endpoints only after explicit approval workflow exists

## Source Priorities

1. Jira assigned/open tickets and IT help queue visibility.
2. Confluence ITSM/IAM/process pages.
3. Microsoft Graph Outlook read-only mailbox watch.
4. Teams channel read-only watch.
5. SharePoint/OneDrive document freshness and ownership watch.
6. Reviewed send/comment/action gateway.

## Guardrails

- Keeper/KSM remains the credential source of truth.
- Do not store raw OAuth secrets in local files, D1 rows, R2 objects, or checked-in config.
- Keep first phase read-only.
- Preserve raw source snapshots for replay.
- Every external action needs an idempotency key and audit row.
- Property-scoped signals must resolve through the governed property identity matrix.
- Human-facing reports use `MM/DD/YYYY` date format.

## Recommended First Build

The first build is complete as a mirror/push Worker that receives sanitized packets. The next build should be the internal scheduled exporter that runs from the private/Venterra side:

1. Internal scheduler reads approved intranet/private systems.
2. Internal exporter reduces and sanitizes facts locally.
3. Exporter signs the raw JSON packet with the Keeper-backed shared secret.
4. Exporter pushes to `https://ops-watch.venterrawebops.com/v1/ops-watch/ingest`.
5. Worker stores the packet in R2 and normalized rows in D1.
6. Data Pond/Captain read models consume D1 after property identity review and publish approval.

This gives us operational durability without prematurely giving the system write authority.
