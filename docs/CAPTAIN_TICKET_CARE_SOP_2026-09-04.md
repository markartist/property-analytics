# Captain Ticket Care SOP

Date: 09/04/2026
Status: Active operating pattern
Owner: MarketingOps / Property Analytics

## Purpose

Captain Ticket Care is the governed operating layer that turns Jira tickets into property-specific responsibility. Jira remains the source of the work order. Ops Watch harvests and classifies the ticket posture. Captain's Office shows the property-level Ticket Wall so a Captain can raise flags, name blockers, identify proof requirements, and champion follow-through.

## Source Path

1. Jira is harvested through the approved Atlassian connector and the Jira Captain Watch packet builder.
2. Ops Watch combines Jira, Confluence, source readiness, and Captain records into a portfolio packet.
3. `scripts/build_ops_watch_pond_snapshot.py` generates the typed Pond snapshot.
4. Captain's Office reads `OPS_WATCH_SNAPSHOT.ticketCare` and renders the Ticket Wall for the selected property.
5. Commodore's Bridge reads `OPS_WATCH_SNAPSHOT.commodoreBridge` and rolls property queues into governed regional patterns and escalation candidates.

Default snapshot command:

```bash
python3 scripts/build_ops_watch_pond_snapshot.py --packet <ops-watch-packet.json>
```

## Ticket Wall Contract

Each ticket-care record should answer:

- What ticket is active for this property?
- Is it Critical, stale, pending vendor, customer-waiting, proof-needed, employee-photo-related, or routing-sensitive?
- Who owns the blocker?
- What evidence is required before closure?
- What is the next best action?
- What should the Captain keep visible until the property concern clears?

Each property queue should answer:

- How many tickets are active?
- How many are stale, pending vendor, proof-needed, or customer-waiting?
- What is the top Captain flag?
- What is the next best action for this property?

## Flags

- `critical`: Jira priority or severity is Critical.
- `pending_vendor`: Jira status or ticket language shows vendor ownership.
- `stale_14_day`: Ticket has aged 14 or more days.
- `vendor_idle`: Ticket is vendor-owned and has aged at least 7 days.
- `customer_waiting`: Ticket status or language suggests a requester response is owed.
- `proof_needed`: Ticket concerns a visible website, photo, banner, gallery, image, or phone-number proof path.
- `employee_photo`: Ticket concerns employee photos, headshots, or contact-section people images.
- `routing_check`: Ticket may belong in pricing, specials, concessions, floor-plan-specials, or another non-WebOps lane.
- `monitor`: No special flag matched, but the ticket remains visible.

## Operating Rules

- Do not create a parallel ticket tracker.
- Do not mutate Jira from the Ticket Wall without explicit current-conversation approval.
- Do not execute generated SQL from the harvest or snapshot lane.
- Do not treat Captain flags as source-system truth; they are stewardship signals over source truth.
- Use the governed property identity matrix for property resolution.
- Keep unresolved property identity visible rather than inventing mappings.
- For visual proof closeout, follow the existing Jira proof-image SOP: reply to customer with the image only, then close with the completion message in the workflow transition comment.

## Captain Behavior

The Captain should care about the ticket until one of these is true:

- The customer has the needed answer.
- The vendor or owning lane has supplied an ETA or blocker.
- The live property surface has proof of completion.
- The ticket has been properly routed out of WebOps.
- Mark has approved the exact Jira mutation and it has been completed.

## Commodore Handoff

The Commodore layer starts after Captain ticket care has enough structure to compare properties. Commodores should look for:

- repeated ticket types across a region or cohort
- stale owner/vendor blockers
- customer response debt
- proof-needed media/content closeout patterns
- regional nuances that should be shared with other Captains

The governed Commodore model is `/Users/mark/Property_Analytics/docs/COMMODORE_BRIDGE_OPERATING_MODEL_2026-09-04.md`.

## Pond UX

Captain's Office now has a `Ticket wall` workspace. It is intentionally separate from general Watch Items so Alex can distinguish source-system ticket stewardship from internal Captain alerts. The wall uses progressive disclosure:

- First row: ticket counts and status pressure.
- Captain read: one plain-language next action.
- Action discipline: approval and proof-closeout rules.
- Pattern cards: portfolio-scale ticket themes when they affect the property.
- Ticket cards: compact details with optional evidence/flags expansion.

## Boundary

This SOP and current implementation are read-only classification and display by default. Jira comments, transitions, ticket closure, Captain Runtime writes, Cloudflare writes, Microsoft 365 actions, Confluence edits, and locked PIB changes remain separate approval-bound actions.
