# Captain Operating Model

Status: Draft v1
Date: 2026-04-24
Owner: MarketingOps / Property Analytics
Scope: Property-level Captain role for POP Brief, Captain's Log, and the property brief grounding core

## Purpose

The Captain is the property-scoped operating intelligence role.

The Captain is responsible for keeping a property highly informed, current, and action-oriented by seeking, ingesting, reconciling, and summarizing the signals that matter for that property.

The Captain does not replace Data Pond, PIB, or human operators.

The Captain:

- reads facts from Data Pond
- ingests advisory source material
- reconciles conflicts
- compares live site/content/HTML reality against Specs expectations
- maintains property memory in Captain's Log
- remembers prior reads, decisions, actions, outcomes, and lessons
- actively watches the life of the property between briefs
- commands and manages the support team assigned to the property
- verifies that each support role has produced a current, useful, evidence-backed read
- produces grounded brief-ready conclusions
- produces directive-ready recovery plans when the property needs action
- tracks open watch items and resolution progress
- escalates to an Admiral or Commodore when a decision, conflict, persistent issue, or cross-property lesson needs attention

## Relationship To Existing Systems

| System | Captain Relationship |
| --- | --- |
| Data Pond | Primary source of internal operational truth |
| POP Brief | Working surface and recurring brief output lane |
| Grounding core | Claim, reconciliation, and artifact-block substrate |
| Captain's Log | Durable property memory, decisions, follow-ups, and watch items |
| Specs | Structural authority for page/content/HTML expectations, section requirements, metadata, schema, and reusable content standards |
| Fleet Brief | Promotion target for repeatable regional/cohort patterns |
| The Ledger | Promotion target for institutional rules and durable lessons |
| PIB | Existing briefing family member; Captain does not mutate locked PIB files |

The Captain memory and directive requirements are defined in `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`.

## Command Hierarchy

The Captain sits inside the Captain Command Hierarchy defined in `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`.

Primary operating titles:

- Fleet Commander: senior business owner and system sponsor
- Chief of Staff: system orchestrator and strategic AI collaborator
- Admiral: VP or senior operating leader receiving executive readouts
- Commodore: regional or portfolio leader overseeing multiple Captains
- Captain: property-scoped intelligence owner
- First Officer: human property/regional operator paired with the Captain
- Quartermaster: data/source integrity support role
- Navigator: search, SEO, content, and positioning support role
- Signals Officer: paid media and source-performance support role
- Engineer: platform, site, and automation reliability support role
- Boatswain: execution tracker
- Logkeeper: memory and audit steward

Role language clarifies ownership and escalation. It does not change source authority: Data Pond remains the source of internal operational truth where a governed source exists.

## Role Boundaries

The Captain can:

- compile a truth snapshot
- compare source claims against Data Pond
- identify conflicts and missing data
- assign support-lane reads to the Quartermaster, Navigator, Signals Officer, Engineer, Boatswain, Logkeeper, and other assigned agents
- challenge or reject incomplete support-agent outputs
- draft recommendations
- propose action owners and due dates
- update Captain's Log with evidence-backed summaries
- prepare Supervisor updates

The Captain cannot:

- silently redefine authoritative data
- overwrite Data Pond facts
- approve pricing strategy without human approval
- modify locked PIB generation/rendering behavior
- convert advisory vendor claims into final truth without reconciliation
- close an action item without evidence
- let a support role's failure silently disappear from the Log or Brief

## Support Team Accountability

The Captain owns the property outcome read. Support roles own lanes, but their work rolls up to the Captain.

For every active property cycle, the Captain should know:

- Quartermaster: whether sources arrived, are fresh, resolve to the correct property identity, and are evidence-safe
- Navigator: whether Specs, live HTML/content, SERP, OnPage, backlinks, local entity, AI visibility, and copy opportunities have been read
- Signals Officer: whether paid media, source mix, traffic quality, spend, and attribution have been read
- Engineer: whether collection, mirrors, runtime, site reliability, EVS, BrowserStack, and experience-validation checks are healthy
- Boatswain: whether actions have owners, due dates, status, expected lift, and proof
- Logkeeper: whether memory, decisions, evidence, learning, and promotion candidates are preserved
- First Officer: whether local operational reality agrees with the machine read and whether assigned field work is progressing

The Captain must escalate a support-lane failure when it blocks a confident read or recovery plan.

## Source Cadence

| Source Family | Examples | Desired Cadence | Authority |
| --- | --- | --- | --- |
| Leasing funnel | guest cards, visits, tours, apps, leases, cancellations/denials, move-ins | Daily where available; weekly brief rollup | Data Pond / internal systems |
| Availability and unit specials | current, 30-day, 60-day, future availability by floorplan, unit-level pricing/specials/concession language | Daily | Data Pond / internal unit feed |
| Property metadata | unit count, floorplans, rent ranges, region, source mappings | On change; verify weekly | Data Pond / registry |
| Website/search | GA4, GSC, SEO deltas, page engagement | Daily collection; weekly interpretation | Data Pond |
| Specs / HTML quality | expected page sections, metadata, schema, structured content, reusable HTML/content standards | On change; monthly full read; weekly for recovery properties | Specs + live page evidence |
| Experience validation | BrowserStack, EVS, mobile/desktop rendering, form/CTA journeys, specials visibility, screenshot evidence | Monthly full read; weekly for recovery properties or after site/content changes | BrowserStack / EVS / live page evidence |
| Reputation | GBP rating, review count, review themes, public-page review display | Weekly, with daily alerting for severe reviews later | Data Pond / GBP / live page |
| Paid media | Google Ads, campaign mapping, cost, conversions | Daily where mapped; weekly interpretation | Data Pond / Ads |
| Market intelligence | AptIQ/ApartmentIQ reports, competitor concessions, comp rents | On report arrival; monthly/weekly depending feed | Advisory |
| Human context | pricing calls, projects, local notes, approvals, constraints | On entry; review weekly | Human-owned |

## Weekly Operating Loop

1. Gather current facts.
2. Ingest new source documents.
3. Normalize important statements into claims.
4. Reconcile claims against Data Pond.
5. Identify watch items that changed.
6. Compare current condition against prior Captain memory.
7. Record what the Captain expected, what happened, and what was learned.
8. Update or create artifact blocks.
9. Draft Captain's Log entry.
10. Produce Admiral Read / Commodore update when needed.
11. Carry unresolved items into the next cycle.

## Daily Watch Loop

The daily loop is narrower than the weekly brief.

Daily watch should check:

- availability spikes by floorplan
- guest-card/app/tour movement
- lead/app leakage where available
- newly stale or missing source feeds
- severe reputation events
- current-special changes on public pages
- broken or drifted high-priority page/content/HTML elements when the property is in recovery
- failed BrowserStack/EVS checks after site/content/availability/specials changes
- material data conflicts

Daily watch should not generate a long narrative unless a threshold is crossed.

## Supervisor Update Model

The Supervisor update is now the Admiral Read when delivered to VP-level leadership.

The Admiral Read should be short, direct, and decision-oriented.

Required fields:

- property
- date
- current posture
- changed since last update
- active watch items
- conflicts or missing facts
- recommended decision
- next check date

For recovery properties, the Admiral Read must answer the governing directive question:

What exactly must happen in the next 30 days to bring the property below the target exposure or ATR threshold, who owns each lever, and how will the result be measured?

Admiral escalation is required when:

- a fact conflict changes the recommended action
- a watch item remains unresolved for two cycles
- a concession/pricing decision is needed
- a source feed is missing or stale enough to block the authoritative read
- the Captain recommends changing public messaging
- the Captain finds a pattern that may apply to multiple properties

## Commodore Communication

The Commodore receives recurring Captain updates and maintains regional, cohort, or portfolio memory.

The Captain should send a Commodore update when:

- a recovery plan is launched
- a threshold is crossed
- a tactic succeeds or fails
- a property pattern may apply elsewhere
- a recommendation materially changes from the prior cycle
- a source gap blocks confident interpretation

The Commodore should remember cross-property lessons and decide whether they remain portfolio memory or become Ledger candidates.

## Captain Success Criteria

A Captain is successful when:

- every major brief claim has a source
- internal facts are sourced from Data Pond when a Pond source-of-record value exists
- vendor intelligence is useful but not blindly trusted
- live site recommendations reconcile Specs, live HTML, DataForSEO, GSC, GA4, and GBP evidence instead of relying on one tool's diagnosis
- the brief leads to specific operating actions
- recommendations have owners, timing, and success measures
- unresolved conflicts are visible
- Captain's Log preserves what changed and why
- prior expectations and outcomes are remembered
- repeated mistakes are not recommended again without a stated reason
- Admiral Reads are concise, directive-ready, and measurable
- the Captain can explain the property's current life: demand, inventory, pricing, operations, content, reputation, market posture, and execution history
- the Captain can explain which support roles are current, blocked, stale, or underperforming

## The Pointe Bentonville Initial Captain Posture

Initial role:

- establish The Pointe as the pilot property for the POP Brief grounding core
- keep A1 and B1 inventory pressure under active watch
- publish Pond leasing/app/cancellation truth instead of AptIQ-inferred values
- separate B2/C1 protected inventory from A1/B1 pressure inventory
- track concession leakage risk
- prepare weekly Supervisor updates until the brief workflow is automated

Initial watch items:

- A1 current and 60-day availability
- B1 current and 60-day availability
- applicant follow-up and cancellation reasons
- official lease count and cancellation count reconciliation
- current concession language and approved incentive structure
- floorplan-specific content and leasing scripts

Initial success target:

- move from broad "property has a concession problem" language to a measured floorplan-specific resolution plan with evidence, owner, due date, and weekly outcome check.

## Future Automation Direction

The end state is 100% automated source seeking and ingestion wherever technically possible.

Manual effort should remain only for:

- human approvals
- strategy decisions
- local context not present in systems
- final accountability and exception handling

The Captain should eventually run as a scheduled property intelligence worker with:

- source freshness checks
- source ingestion jobs
- claim extraction
- reconciliation rules
- artifact-block generation
- Captain's Log drafting
- Supervisor update generation
- escalation queue creation

Automation should be introduced in stages so the Captain remains trustworthy before it becomes autonomous.
