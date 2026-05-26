# Captain's Log And Captain's Brief Standard

Status: Active v1.2 display baseline
Date: 04/24/2026
Owner: MarketingOps / Property Analytics
Scope: Property-scoped operating memory and outbound Captain readouts

## Naming Decision

Use both names, with distinct jobs:

| Name | Job | Persistence | Audience |
| --- | --- | --- | --- |
| Captain's Log | durable property memory, decisions, watch items, evidence references, and follow-up state | persisted and updated over time | Captain, POP Brief, Intelligence Office, downstream systems |
| Captain's Brief | polished outbound read generated from the log plus current Pond facts | report/email artifact for a reporting cycle | Supervisor, property leadership, operators |

The Captain's Log is the grounding record. The Captain's Brief is the readable artifact.

The memory and directive rules for Captain learning, recovery questions, Commodore communication, and Ledger promotion are defined in `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`.

The current outbound display baseline is Captain's Brief v1.2, defined in `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md`.

## Command Language

The standard role language is defined in `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`.

Working role map:

| Role | Report/System Meaning |
| --- | --- |
| Fleet Commander | system sponsor / operating doctrine owner |
| Chief of Staff | orchestration and strategic system collaborator |
| Admiral | VP or senior executive recipient |
| Commodore | regional or portfolio leader |
| Captain | property-scoped intelligence owner |
| First Officer | human operator paired with the Captain |
| Quartermaster | source arrival, freshness, identity, and evidence quality |
| Navigator | search, SEO, content, local entity, and USP intelligence |
| Signals Officer | paid media, channel, source, and traffic performance |
| Engineer | platform, site, collection, and automation reliability |
| Boatswain | action tracking and follow-through |
| Logkeeper | durable memory, audit history, and promotion lineage |

Use `Captain` visibly in product/report language. Use `Admiral Read` when the recipient understands the model; otherwise use `Executive Read` or `VP Read`.

## Persistence Rule

Captain's Log entries are shared memory, not only files. Each material entry should be persisted as:

- a `governed_memory_entries` property-scoped record
- `governed_memory_evidence_refs` tied to the entry
- a `governed_memory_identity_bindings` record for the named Captain
- `property_brief_source_documents` for recurring source inputs
- `property_brief_claims` and `property_brief_reconciliations` for durable report logic
- `property_brief_artifact_blocks` for reusable Brief sections
- `captain_support_agents` for the source watchers assigned to that Captain

The Markdown and email files are publishing artifacts. The database records are the operating memory.

## Relationship To PIB

Captain's Log and Captain's Brief belong to the POP Brief / property operating-intelligence family. They should reuse PIB-family presentation discipline where useful, but they do not mutate locked PIB generation or rendering files.

Required presentation rules:

- property-facing ID uses the property code, such as `AR4PB`
- user-facing dates use `MM/DD/YYYY`
- email headers use Outlook-safe tables and real image assets when logos are needed
- unit references use building plus apartment number, not feed-only system IDs
- source authority is stated plainly: Data Pond governs internal facts; vendor reports advise
- data-heavy report sections use the v1.2 display standard: KPI tiles, grouped evidence blocks, short reads, and owner/action/proof directives instead of long run-on evidence rows

## Captain's Log Entry Requirements

Each log entry should include:

- property
- property code
- Captain identity
- reporting date
- coverage window
- current posture
- changed since last read
- prior expectation or prior recommendation
- outcome since prior recommendation
- lesson learned
- memory classification: truth, decision, action, pattern, learning, or doctrine candidate
- Specs posture when the entry touches website, content, HTML, metadata, schema, or local entity presentation
- active watch items
- decisions made
- decisions needed
- action register
- source authority posture
- support-team status: current, blocked, stale, or escalation needed by lane
- evidence references
- next review date

## Captain's Brief Requirements

Each brief should include:

- PIB-style header
- Admiral Read / Executive Read
- Truth Snapshot
- What Changed
- Recovery Math when exposure/ATR recovery is the objective
- Directive Questions when the property needs action
- Source Reconciliation
- Watch Items
- Source Performance and Spend Direction
- Pricing, Concession, and Effective-Rent Recommendation
- Website, Specs, Search, Local Entity, AI Visibility, and USP Recommendations
- Reviews, Images, and Reputation Read
- Operations Constraint Read: make-readies, hold times, people/process
- Support Team Status and Blockers when any lane is stale, blocked, or incomplete
- Action Register
- Decision Register
- 30-Day Recovery Plan when applicable
- Captain's Log excerpt
- Appendix / evidence references

## Captain's Brief v1.2 Display Standard

Version `v1.2` is the active human-readability standard for Captain's Brief email/report artifacts.

The first approved proof is the Elation at Grandway West emergency scan:

- `/Users/mark/Property_Analytics/reports/captains_log/emergency/elation_at_grandway_west/elation_high_alert_seo_scan_2026-05-01_readable_email_outlook.html`

The v1.2 standard requires:

- at-a-glance KPI tiles before detailed evidence
- source-specific evidence blocks with 2 to 4 data points per block
- short `Read:` interpretation statements
- directive tables that separate action, owner, and proof
- explicit missing-source notes instead of repeated `Not available` rows
- Outlook-safe table markup for email versions
- the locked PIB-style header from `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`

The standard rejects long comma-separated evidence cells, paragraph-like data rows, and dense spreadsheet reads as the default presentation for analysts or executives.

The header is part of the lock. Active Captain generators must not hand-build alternate Venterra text/logo/header styles; `scripts/check_captains_brief_header_lock.sh` enforces this rule.

## The Pointe Pilot Naming

The first report/email set is:

- Captain's Log: The Pointe Bentonville / Captain Benton / 04/24/2026
- Captain's Brief: Captain Benton Brief / The Pointe Bentonville / 04/24/2026

## Automation Path

Eventually:

1. Data Pond source feeds update on cadence.
2. Support agents verify source arrivals, freshness, and routing gaps.
3. The Captain ingests source docs and source facts.
4. Claims are reconciled against source authority.
5. Captain's Log is updated with durable memory.
6. Captain's Brief is generated from the log plus current facts.
7. Supervisor receives only the decision-ready read.

## Support Agent Model

Each property Captain can have support agents assigned by source lane or operating responsibility. The first standard roster is:

- Source Scout: source arrival and freshness
- Truth Reconciler: source authority and claim conflict handling
- Inventory Watch: floorplans, unit aging, specials, concessions
- Funnel Watch: guest cards, applications, tours, leases, cancellations, follow-up
- Media Watch: GA4, GSC, Ads, GBP, PSI, and property-page experience
- Navigator Watch: Specs, live HTML/content, SERP, OnPage, backlinks, local entity, AI visibility, and exact copy/action recommendations
- Experience Watch: BrowserStack, EVS, mobile/desktop rendering, forms, CTAs, specials visibility, and post-change validation
- Supervisor Scribe: Captain's Brief assembly from current memory and action state

Support agents raise facts and exceptions into the Captain's Log. They do not become separate truth owners.

The Captain owns support-agent accountability. If a support agent does not report, reports stale facts, or produces a read that cannot support action, the Captain must either re-task the agent, escalate the gap, or mark the Brief as blocked for that lane.

## Live Runtime Model

The live Worker runtime adds four operating tables:

- `captain_agent_runs`: every manual, scheduled, or brief-triggered support-agent run
- `captain_watch_items`: durable property watch state created or refreshed by support agents
- `captain_actions`: owner, due date, priority, and status for Captain-generated actions
- `captain_brief_runs`: draft/readiness records for Captain Brief and Supervisor Read assembly

The app Worker exposes `/v1/captain` routes for status, manual agent runs, and brief-run creation. Cron triggers are configured in the API Worker and should run the active support-agent roster from D1. The initial runtime deliberately keeps raw collection in the existing Data Collection stack; the Worker consumes mirrored D1/R2 facts and writes memory, watch items, actions, and brief readiness.

The Captain source-table mirror is now part of the daily D1 mirror path for Captain-read source rows. The first clean live Captain Brief draft is `captain_brief_AR4PB_20260425202040_b9ac1686` for The Pointe Bentonville / Captain Benton, covering `2026-03-26` through `2026-04-25`.

As of 04/29/2026, Captain Benton's live scheduled roster has been expanded in remote D1 and deployed Worker runtime:

- Daily: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, Navigator Watch, Experience Watch, and Boatswain
- Weekly: Logkeeper and Supervisor Scribe

The Worker cron remains `15 12 * * *` for daily support lanes and `45 13 * * 1` for weekly lanes. Paid external collection stays in Data Collection; the Captain Worker consumes mirrored evidence and raises watch items/actions.

The live read model is `GET /v1/captain/properties/:propertyId/brief/latest`, with `/analysis/captain` as the first app surface. This read model is the core source for future Captain Brief email and Supervisor Read generation: it already includes current source readiness, active watch/actions, resolved source-routing rows, and unit-number aged inventory detail from the D1 unit feed.

The official operating snapshot contract is `property_operating_metrics`. Until a lease/revenue source populates that table, the Captain Brief must continue to distinguish public unit-feed concession visibility from booked concession dollars on signed leases.

Official operating metrics now enter through `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`. That importer is the controlled interim lane for CSV/XLSX/XLSM operating source files and can write both the local Pond database and remote D1. Data Collection also has `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`, so the morning collector and retry worker can discover and ingest operating files from the shared manual drop on cadence. The daily Captain source mirror includes `property_operating_metrics` whenever rows exist, so Benton can report official occupancy, leased percentage, lease/cancel counts, and booked concession dollars without using vendor-inferred AptIQ values as internal truth.

The file contract is `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md`. If the source file is absent, the canonical escalation is `No official operating metrics file received for AR4PB.` The recommended filename is `Property-Operating-Metrics-AR4PB-YYYYMMDD.csv`.

## vNext Recovery Brief Generator

The first reusable local generator for the recovery-directive brief shape is:

- `/Users/mark/Property_Analytics/reports/captains_log/generate_captains_brief_vnext.py`

It resolves property identity through the governed matrix, reads current Pond facts, computes an Ads heartbeat, and emits:

- browser preview HTML
- Outlook-safe email HTML

The vNext Brief must preserve the familiar analyst Performance Analysis layer when it is available:

- T7 Performance
- T30 Performance
- reported advertising spend
- marketing notes / website notes / SEO notes / specials notes / social or review notes when present

This layer is an evidence floor, not the final answer. The Captain must reconcile it against Pond facts, source freshness, official operating metrics, unit-level inventory, concession visibility, search/entity evidence, and action ownership. The reader should recognize the prior dashboard shape while receiving a stronger directive.

The Ads heartbeat must separate:

- last collection check
- last campaign activity
- current posture
- campaign status

This prevents a paused/no-current-activity Ads posture from being misread as stale data.
