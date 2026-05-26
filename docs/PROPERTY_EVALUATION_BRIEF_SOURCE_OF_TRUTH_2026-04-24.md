# Property Evaluation Brief Source Of Truth Standard

Status: Draft v1
Date: 2026-04-24
Owner: MarketingOps / Property Analytics
Scope: Grounded property evaluation and resolution briefs produced through POP Brief / Captain's Log

## Purpose

This standard defines what must be true before a property evaluation brief can be treated as operating-grade.

The brief is not a recap of vendor reports. It is the source-of-truth operating read for a property, built from authoritative Pond evidence, explicitly labeled advisory intelligence, and accountable resolutions.

## Core Rule

No important brief claim should appear without one of these:

- authoritative Data Pond evidence
- clearly labeled advisory-source evidence
- human-approved operator context
- an explicit unresolved conflict marker

## Source Authority Ladder

| Rank | Source | Use |
| ---: | --- | --- |
| 1 | Data Pond / internal source of record | Official internal operating truth |
| 2 | Canonical property registry | identity, URL, unit count, mappings |
| 3 | Live property page / live public source | public-state truth at crawl time |
| 4 | Captain's Log / approved operator notes | decisions, constraints, memory, local context |
| 5 | AptIQ / ApartmentIQ / other market reports | advisory market and competitive intelligence |
| 6 | AI-generated synthesis | draft interpretation only; never source truth |

When sources disagree, preserve the disagreement and publish the authoritative value separately.

## Required Evidence Domains

Every full property evaluation brief should attempt to include these domains.

| Domain | Required? | Primary Source | Notes |
| --- | --- | --- | --- |
| Property identity | yes | registry / Data Pond | name, id, URL, region, unit count |
| Occupancy / leased / exposure | yes | internal source of record | must not rely on vendor inference when internal exists |
| Leasing funnel | yes | guest cards / leasing system | guest cards, visits, tours, apps, leases, cancellations, move-ins |
| Availability | yes | `unit_availability` or internal availability source | current, 30-day, 60-day, future by floorplan |
| Floorplan structure | yes | `property_floorplans` | beds, baths, sq ft, rent bands |
| Unit aging | preferred | unit-level availability / pricing source | 45/60/90+ day action thresholds |
| Concession deployment | preferred | unit-level availability / pricing / specials source plus lease/revenue feed | active unit eligibility by floorplan and unit age; booked concession dollars from source-of-record lease/revenue data |
| Website/search | preferred | GA4, GSC, SEO sources | demand quality and content opportunity |
| Reputation | preferred | GBP / review sources | source-specific rating/counts |
| Paid media | preferred where mapped | Google Ads / marketing spend sources | CPL, spend, conversion quality |
| Site experience | preferred | PSI / Core Web Vitals / page audit sources | mobile/desktop conversion friction |
| Digital action path | preferred | GA4 events / source attribution | quote, tour, apply, phone, form-start, form-submit behavior |
| Market/comps | preferred | AptIQ / market reports | advisory unless live-confirmed |
| Human strategy/context | yes when relevant | Captain's Log / operator notes | pricing calls, projects, constraints, approvals |

## Required Brief Sections

1. Supervisor Read
2. Source Authority And Freshness
3. Truth Snapshot
4. Source Reconciliation
5. Market And Competitive Intelligence
6. Property Diagnosis
7. Full Pond Operating Chain
8. Floorplan Watch
9. Concession And Revenue Protection
10. Lead Quality And Conversion
11. Marketing / Content / Search Moves
12. Reputation And Resident Experience
13. Resolution Plan
14. Decision Register
15. Action Register
16. Captain's Log Entry
17. Evidence Appendix

## Presentation Standard

Property Evaluation / Captain briefs should follow the PIB-family presentation model:

- use the Venterra header treatment and KPI card visual language for email artifacts
- display the report title as `Property Intelligence Brief`
- display the property code as the visible `Property ID` such as `AR4PB`
- use named property Captain identity where assigned, such as `Captain Benton`
- format user-facing dates as `MM/DD/YYYY`
- use operator-facing unit references, such as building plus apartment number, instead of feed system unit ids
- label the guest-card KPI as `Guest Cards`, not `Latest Guest Cards`

## Source Authority Standard

Each brief should carry a source authority posture.

| Posture | Meaning |
| --- | --- |
| Source-of-record | Data Pond or internal operating system governs the number or fact |
| Public-state | live property page, unit feed, or public source governs visible market state |
| Advisory | AptIQ, ApartmentIQ, comps, or market reports inform strategy but do not govern internal truth |
| Routing gap | the fact exists in the operating ecosystem but is not yet surfaced into the brief artifact |
| Unresolved conflict | two sources disagree and no governing source has been identified |

The brief should not use weak confirmation language for facts already present in Data Pond. It should distinguish source-of-record facts, advisory observations, routing gaps, and unresolved conflicts. A routing gap is a composition task, not an uncertainty statement.

## Action Register Standard

Every action must include:

- action
- reason
- owner
- due date or review date
- success metric
- evidence needed to close
- status

Statuses:

- `proposed`
- `approved`
- `in_progress`
- `blocked`
- `complete`
- `rejected`

## Decision Register Standard

Every decision request must include:

- decision needed
- why now
- options
- recommended option
- risk of no decision
- owner
- decision due date

## Captain's Log Standard

The Captain's Log entry should be short enough to persist as memory but structured enough to drive downstream work.

Required payload fields:

- property id
- reporting date
- current posture
- active watch items
- source authority
- decisions made
- decisions needed
- next review date
- evidence references

## Publishing Gate

A brief is publishable when:

- internal facts are separated from advisory source claims
- source conflicts are visible
- recommendations are tied to evidence
- action and decision registers are populated
- Captain's Log entry is ready
- any unresolved high-impact routing gap or source conflict is called out in the Supervisor Read

## The Pointe Pilot Gap List

The Pointe Bentonville pilot brief should become stronger as these facts are added:

1. routed Pond snapshot for occupancy, leased percentage, exposure, lease count, cancellation count
2. unit-level aging and unit-specific concession eligibility
3. booked concession dollars by signed lease
4. app-to-lease by lead source
5. current Google rating/review source separated from Venterra page review aggregate
6. approved concession reset decision
7. owner and due date assignments for A1/B1 actions
