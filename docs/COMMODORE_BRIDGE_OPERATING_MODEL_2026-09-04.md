# Commodore Bridge Operating Model

Date: 09/04/2026
Status: Active read-only Pond layer
Owner: MarketingOps / Property Analytics

## 09/04/2026 Activation Update

The regional Commodores now have a governed roster at `config/commodore_roster.json`.

The roster defines:

- Commodore persona name
- region assignment
- call sign
- activation status
- orders status
- review cadence
- standing orders
- optional future human owner

The first active roster stands up `16` Commodores, one per governed region currently visible in `config/property_identity_matrix.json`. These are system persona names, not human regional manager assignments. Actual people can be added later through the `humanOwner` field without changing the Bridge contract.

## Purpose

The Commodore is the regional operating layer above property Captains. Captains own property truth, local action posture, ticket care, and evidence. Commodores own regional pattern validation, shared lessons, outlier detection, and escalation packaging.

The Commodore's Bridge is the Pond surface for that work. It gives regional managers a compact regional read without turning them into super-Captains or exposing every raw property detail at once.

## Source Path

1. Jira, Confluence, and source-readiness packets flow through Ops Watch.
2. `scripts/build_ops_watch_pond_snapshot.py` enriches the generated Pond snapshot with `ticketCare` and `commodoreBridge`.
3. Region assignment comes from `config/property_identity_matrix.json`, using governed region fields instead of local one-off maps.
4. Commodore names, activation state, and standing orders come from `config/commodore_roster.json`.
5. `/commodores` renders the read-only regional rollup from `OPS_WATCH_SNAPSHOT.commodoreBridge`.

Default snapshot command:

```bash
python3 scripts/build_ops_watch_pond_snapshot.py --packet <ops-watch-packet.json>
```

## Bridge Contract

The Bridge should answer:

- Which Commodores are active and which regions they own?
- Which regions have active property ticket pressure?
- Which properties need Commodore attention first?
- Which patterns are repeating across properties or regions?
- Which items are candidates for Commodore review or Admiral escalation?
- Which quiet regions have no mapped ticket pressure in the current packet?

The Bridge should not show a long vertical dump of every record. It should present:

- compact regional cards
- horizontal shared-pattern cards
- escalation candidate cards
- drill links into the responsible Captain office
- progressive standing-order details rather than always-open instruction blocks

## Escalation Rules

Escalation candidates are advisory until a human approves the action.

- Customer response owed: immediate Captain/Commodore attention; may become an Admiral Read candidate.
- Stale `14+` day tickets: Commodore escalation candidate by owner and blocker.
- Critical ticket cluster: Commodore Review candidate.
- Repeated vendor pressure: Commodore Watch candidate.
- Repeated proof-needed media/content items: Fleet Scribe/Captain SOP reinforcement candidate.

## Active Commodore Roster

| Region | Commodore | Call Sign |
| --- | --- | --- |
| Arkansas | Commodore Ozark | Ozark |
| Atlanta, GA | Commodore Peachtree | Peachtree |
| Austin, TX | Commodore Hill Country | Hill Country |
| Cypress, TX | Commodore Cypress | Cypress |
| Dallas, TX | Commodore Trinity | Trinity |
| Florida | Commodore Gulf | Gulf |
| Houston, TX | Commodore Bayou | Bayou |
| Kansas City | Commodore Heartland | Heartland |
| Kentucky | Commodore Bluegrass | Bluegrass |
| Killeen | Commodore Crossroads | Crossroads |
| Kyle, TX | Commodore Plum Creek | Plum Creek |
| Nashville, TN | Commodore Cumberland | Cumberland |
| Oklahoma | Commodore Redbud | Redbud |
| Raleigh, NC | Commodore Oak | Oak |
| San Antonio, TX | Commodore Alamo | Alamo |
| Savannah, GA | Commodore Marsh | Marsh |

## Standing Orders

Every active Commodore carries these initial orders:

1. Review regional Captain ticket pressure after each Ops Watch packet.
2. Identify shared patterns, stalled ownership, proof gaps, and source-readiness blockers across assigned properties.
3. Route property-specific follow-up back through the owning Captain before escalating.
4. Package cross-property lessons for Fleet Scribe, Admiral Read, or Ledger review only when evidence supports promotion.
5. Do not mutate Jira, Confluence, Microsoft 365, Resi content, Cloudflare, Captain Runtime, or Data Pond truth without explicit approval.

## Boundaries

- Do not mutate Jira, Confluence, Microsoft 365, D1/R2, Captain Runtime, Cloudflare, source tickets, Resi content, or locked PIB files from the Bridge.
- Do not create a parallel regional property map.
- Do not create hidden Commodore ownership outside `config/commodore_roster.json` or the governed identity matrix.
- Do not let Commodore notes become Data Pond truth without evidence and normal promotion.
- Do not bypass the Captain. Regional signals must drill back to the owning property Captain.

## Next Growth Path

The first implementation is read-only and Ops Watch-backed. The natural next increments are:

- add source-readiness and Captain routine-health signals into the same regional rollup
- add regional memory and Ledger candidate review
- add approval-gated Admiral Read drafting
- offload scheduled regional rollup generation to Cloudflare D1/R2 after the read model is stable
