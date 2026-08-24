# Ops Watch Runbook

Date: 08/22/2026
Status: Initial governed monitoring layer
Owner: MarketingOps / Property Analytics

## Purpose

Ops Watch is the cross-system monitoring layer for property-facing operational signals. It turns Jira, Confluence, Microsoft 365, and local source packets into Captain-visible awareness without making source-system changes by default.

The initial implementation adds:

- `/Users/mark/Property_Analytics/config/ops_watch_sources.json`
- `/Users/mark/Property_Analytics/scripts/build_ops_watch_packet.py`
- `/Users/mark/Property_Analytics/scripts/build_confluence_ops_watch_packet.py`
- `/Users/mark/Property_Analytics/docs/OPS_WATCH_RUNBOOK_2026-08-22.md`
- `/Users/mark/Property_Analytics/utils/ms365_graph_auth.py`
- `/Users/mark/Property_Analytics/scripts/smoke_ms365_graph_oauth.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/`
- `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`

Jira and Confluence are the first active harvest sources through the existing Atlassian connector plus local packet builders. Microsoft 365 lanes are formally represented but blocked until Microsoft Graph credentials are added through Keeper/KSM.

The Cloudflare mirror/push receiving lane is live for sanitized internal exports. It does not crawl inward. Internal jobs must push approved facts outward.

## Source Contract

The source contract lives at:

- `/Users/mark/Property_Analytics/config/ops_watch_sources.json`

Current lanes:

- Jira assigned ticket queue: active connector harvest.
- Confluence operating docs: active connector harvest for ITSM/IAM/Microsoft 365/access process pages.
- Outlook mailbox watch: blocked pending Keeper/KSM Microsoft Graph auth.
- Teams channel and mention watch: blocked pending Keeper/KSM Microsoft Graph auth.
- SharePoint / OneDrive evidence watch: blocked pending Keeper/KSM Microsoft Graph auth.
- Captain Runtime publish: review-required write lane.
- Cloudflare mirror/push ingest: live receiving/storage lane for sanitized internal packets.

## Cloudflare Mirror/Push Ingest

The production receiving lane is:

- Health: `https://ops-watch.venterrawebops.com/health`
- Ingest: `POST https://ops-watch.venterrawebops.com/v1/ops-watch/ingest`
- Worker: `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/worker.js`
- Config: `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/wrangler.toml`
- Runbook: `/Users/mark/Property_Analytics/docs/OPS_WATCH_MIRROR_PUSH_INGEST_RUNBOOK_2026-08-22.md`

Storage:

- R2 evidence prefix: `ops-watch/ingest/<source>/<run_id>.json`
- D1 tables: `ops_watch_ingest_runs`, `ops_watch_signals`, `ops_watch_action_queue`
- D1 migration: `/Users/mark/Property_Analytics/apps/api/migrations/0065_create_ops_watch_ingest_tables.sql`

Credential and proof:

- Keeper record: `Ops Watch Ingest Shared Secret`
- Active notation: `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`
- Worker secret: `OPS_WATCH_INGEST_SHARED_SECRET`
- Live canary run: `ops-watch-ingest-canary-20260822-keeper`
- Canary D1 signal: `ops_watch_signal_fc48d30ea203cabe190f0310b19ae872`

Use this helper for signed pushes:

```bash
python3 scripts/push_ops_watch_ingest_packet.py <packet.json>
```

Boundary: Cloudflare still does not access Jira intranet, private Venterra systems, Outlook, Teams, SharePoint, or OneDrive directly through this lane. It receives sanitized pushed packets only.

## Microsoft 365 Credential Boundary

Microsoft 365 harvesting must use Keeper/KSM and Microsoft Graph. Do not create local OAuth token files, ad hoc `.env` secrets, browser-cookie scraping, or manual credential paths.

Expected Keeper notation env vars for the first Graph app path:

- `KSM_MS365_TENANT_ID_NOTATION`
- `KSM_MS365_CLIENT_ID_NOTATION`
- `KSM_MS365_CLIENT_SECRET_NOTATION`
- `KSM_MS365_MAILBOX_USER_NOTATION`

The local OAuth helper is:

- `/Users/mark/Property_Analytics/utils/ms365_graph_auth.py`

Smoke test without printing tokens or email content:

```bash
python3 scripts/smoke_ms365_graph_oauth.py --json
```

After `Mail.Read` and mailbox scoping are approved, smoke the configured mailbox:

```bash
python3 scripts/smoke_ms365_graph_oauth.py --check-mailbox --json
```

Recommended first permissions:

- Outlook: `Mail.Read` application permission
- Teams: `ChannelMessage.Read.All`, `Chat.Read`
- SharePoint / OneDrive: `Files.Read.All`, `Sites.Read.All`

Use the narrowest approved tenant/application policy available. The first harvest must be read-only.

## Packet Build

After source-specific packets exist, build the portfolio Ops Watch readout:

```bash
python3 scripts/build_ops_watch_packet.py
```

The script writes:

- `ops-watch-packet.json`
- `OPS_WATCH_READOUT.md`
- `ops-watch-source-readiness.csv`
- `ops-watch-source-signals.csv`
- `ops-watch-captain-records.csv`

Default output root:

- `/Users/mark/Property_Analytics/reports/ops_watch/`

## Pond Visibility Snapshot

After the portfolio packet is built, refresh the static Pond visibility snapshot:

```bash
python3 scripts/build_ops_watch_pond_snapshot.py --packet <ops-watch-packet.json>
```

Default output:

- `/Users/mark/Property_Analytics/apps/web/src/lib/ops-watch/generated-snapshot.ts`

Supporting type contract:

- `/Users/mark/Property_Analytics/apps/web/src/lib/ops-watch/types.ts`

The Pond landing page and Watchtower consume this generated snapshot. The visible app layer is read-only and should show source pressure, Captain property rows, source blockers, and assisted-action posture. It must not become a Jira writeback, Captain Runtime publish, Confluence edit, Microsoft 365 action, Cloudflare action, or D1 mutation surface.

08/24/2026 production note: the current Ops Watch Pond visibility deployment is Cloudflare Pages `https://5382cf5c.property-analytics.pages.dev`. The protected user route is `https://pond.venterrawebops.com/pond`; the Watchtower anchor is `https://pond.venterrawebops.com/watchtower#ops-watch`. If publishing from a scoped worktree, set the Cloudflare account explicitly when using the Keeper-backed Wrangler helper so Wrangler does not depend on the user memberships endpoint.

## Recurring Harvest Shape

The recurring Atlassian heartbeat should:

1. Use Atlassian Rovo/Jira JQL:

   ```jql
   assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC
   ```

2. Include fields:

   - `key`
   - `summary`
   - `description`
   - `status`
   - `priority`
   - `created`
   - `updated`
   - `customfield_10106`

3. Also use Atlassian Rovo/Confluence search for source pages about:

   - Entra
   - IAM / SSO
   - Microsoft 365
   - Outlook / Teams / SharePoint
   - Jira Service Management
   - app registrations
   - access processes

4. Run:

   ```bash
   python3 scripts/build_jira_captain_watch_packet.py --emit-sql
   python3 scripts/build_confluence_ops_watch_packet.py --input <confluence-source-json>
   python3 scripts/build_ops_watch_packet.py
   ```

5. Report the Markdown readout path and summary counts.

The recurring job must not mutate Jira, Confluence, Microsoft 365, D1, Captain Runtime, Cloudflare, or PIB.

For the mirror/push offload lane, the internal scheduled job should push signed sanitized packets to Cloudflare after local/private harvesting. That internal exporter may update D1/R2 only through the live ingest Worker, and it must not publish Captain actions without a reviewed publish step.

## Action Boundary

Allowed by default:

- Read source data through approved connectors or Keeper-backed APIs.
- Generate local JSON, Markdown, and CSV packets.
- Generate reviewed SQL for a later publish step.
- Flag unresolved property mappings.

Not allowed by default:

- Sending email.
- Moving, archiving, deleting, or marking email.
- Posting Teams messages or reactions.
- Editing Confluence pages or comments.
- Editing, commenting on, or transitioning Jira tickets.
- Executing Captain Runtime SQL/API writes.
- Touching locked PIB files.

## Captain Behavior

Every Captain-facing output should answer:

- Does my property have an open operational signal?
- Which source produced it?
- Is it Critical, stale, pending vendor, or blocked?
- What is the next move?
- Who owns the lane?
- What proof closes the watch?

## Checks

After editing this lane, run:

```bash
python3 -m py_compile scripts/build_ops_watch_packet.py scripts/build_jira_captain_watch_packet.py
python3 -m py_compile scripts/build_confluence_ops_watch_packet.py
python3 -m py_compile scripts/build_ops_watch_pond_snapshot.py
python3 -m py_compile scripts/build_ops_watch_ingest_sample_packet.py scripts/push_ops_watch_ingest_packet.py
npm --prefix apps/web run build
node --check ops/cloudflare/ops-watch-ingest/worker.js
bash scripts/check_property_identity_governance.sh
bash scripts/check_context_discipline.sh
bash scripts/check_pib_guardrails.sh
```
