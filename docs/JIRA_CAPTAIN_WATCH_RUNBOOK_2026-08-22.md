# Jira Captain Watch Runbook

Date: 08/22/2026
Status: Initial governed bridge
Owner: MarketingOps / Property Analytics

## Purpose

Jira Captain Watch connects property-scoped Jira tickets to the Captain operating model. Jira remains the source of the work order; Captain Runtime receives property awareness, next-move guidance, owner lane, and proof expectations.

The first implementation is the non-mutating packet builder:

- `/Users/mark/Property_Analytics/scripts/build_jira_captain_watch_packet.py`

It consumes Jira issue search output, resolves properties through the governed property identity matrix, and emits Captain-ready:

- `jira-captain-watch-packet.json`
- `JIRA_CAPTAIN_WATCH_READOUT.md`
- `jira-captain-watch-rows.csv`
- optional reviewed SQL upserts for `captain_watch_items` and `captain_actions`

## Governance

- Do not create a parallel ticket tracker.
- Do not use local one-off property maps.
- Resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Treat Jira as the external work-order source.
- Treat Captain records as property awareness, next-move routing, and proof management.
- Default to non-mutating packet generation.
- Apply SQL upserts only after review and explicit approval.
- Do not comment on, transition, or edit Jira tickets from this lane unless the user approves exact automation rules.

## Jira Query Shape

Use Atlassian Rovo/Jira JQL for the active assigned queue:

```jql
assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC
```

Required fields:

- `key`
- `summary`
- `description`
- `status`
- `priority`
- `created`
- `updated`
- `customfield_10106`

`customfield_10106` is the observed Marketing Jira property field. It returns values like `Belterra - 1102` or `Links at Windsor - 1111`. The builder strips the trailing numeric suffix and resolves the property through the governed identity matrix.

## Captain Mapping

Primary property resolution:

1. Jira property custom field, default `customfield_10106`.
2. Explicit property mentions in summary or description.
3. Unresolved row if neither path resolves.

The text-mention path intentionally allows one Jira ticket to appear for more than one Captain. For example, a ticket about a phone number not working for both Village Walk and Links at Windsor Parke should become a watch item for both property Captains.

## Classification

The builder maps common Jira ticket language into Captain categories:

- `website_specials_pricing`: specials, concessions, banners, quotes, floor plans, rent, bedroom offers
- `website_media`: photos, pictures, gallery, images
- `website_nap_identity`: phone, address, wrong property info, Rate Us, Venterra Listens
- `local_entity_gbp`: Google, GPS, drop pin, map
- `vendor_followup`: generic pending vendor follow-up
- `jira_followup`: fallback clarification/ownership lane

## Pricing And Specials Routing Resource

Use this known resource for tickets asking for pricing, concession, special, or floor-plan-specific special modifications that are not website-owned hero banner work:

- Venterra Pricing Link: `https://venterra.atlassian.net/servicedesk/customer/portal/4/create/128`

Marketing/WebOps handles the main website hero banner lane only. If a ticket asks for system specials, pricing, concessions, or specials scoped to specific floor plans, reply politely and professionally that the request needs to be submitted through the Venterra Pricing Link because Marketing/WebOps can only handle the hero banner portion.

Default response shape:

```text
Hi <First Name>,

Thanks for sending this over. Our team can help with main website hero banner updates, but pricing, concession, and floor-plan-specific special changes need to be submitted through the Venterra Pricing Link so the correct pricing team can review and process them:

https://venterra.atlassian.net/servicedesk/customer/portal/4/create/128

Thanks, and have a great day!
```

## Assisted Jira Handling With Final Approval

The agent may surface Jira tickets that look safe for low-friction handling, but Jira mutation remains approval-gated. The default flow is:

1. Inspect the ticket, reporter, status, current comments, and available workflow transitions.
2. Classify the likely handling path using the routing rules in this runbook.
3. Draft the exact public comment and proposed status transition.
4. Ask for final approval before posting, transitioning, closing, or otherwise mutating Jira.
5. After approval, apply the comment/status change and read back the final ticket state.

### Proof Screenshot Closeout SOP

For tickets where the requester needs visual proof before closure, keep proof delivery and closeout copy separate.

Required sequence after approval:

1. Capture and verify the live proof image first.
2. In Jira `Reply to customer`, post only the screenshot/proof image. Do not add completion text in this reply.
3. Confirm the image is visible on the ticket before closing.
4. Use the workflow close/Done transition.
5. Put the customer-facing completion text only in the transition/closure comment field:

```text
Hello, <First Name>! This is now complete.

Thanks, and have a great day!
```

6. Read back the final ticket status and customer-visible activity.

Do not paste the screenshot into a text-bearing reply and then also close with a comment; Jira can duplicate or split rich-editor text around the media block. If the workflow does not expose a closure comment field through the available tool or UI, stop for Mark rather than substituting a second public completion reply.

Good assisted-handling candidates:

- Reporter confirms the requested item is complete and asks to close the ticket.
- Vendor ticket has already been entered and the Jira ticket should move to `Pending Vendor`.
- The request is pricing, concession, system-special, or floor-plan-special work that should be redirected to the Venterra Pricing Link.
- The request is a local entity or map-pin update that needs a clear vendor-entered status update.
- The request is a main hero banner update that stays within Marketing/WebOps scope.

Do not auto-handle without a new approval in the current conversation when:

- The ticket requires live website, Resi, Cloudflare, Google Business Profile, pricing-system, or source-system mutation.
- The ticket changes approved public offer language, legal/pricing terms, floor-plan eligibility, or concession scope.
- The right owner, property, system, or status is ambiguous.
- The comment would contradict the reporter, an approver, or a visible source-system state.

Default ticket-comment style:

- Open with the reporter's first name.
- Keep the response concise, professional, and specific.
- Use the Venterra Pricing Link only when routing pricing/specials requests out of Marketing/WebOps scope.
- End every customer-facing ticket comment with `Thanks, and have a great day!`

## Captain Ticket Care

Captain Ticket Care is the in-Pond stewardship layer over Jira Captain Watch. The canonical SOP is:

- `/Users/mark/Property_Analytics/docs/CAPTAIN_TICKET_CARE_SOP_2026-09-04.md`

The Ticket Wall in Captain's Office consumes `OPS_WATCH_SNAPSHOT.ticketCare`, not a separate tracker. It classifies active Jira Captain records into property queues, flags Critical/stale/pending-vendor/customer-waiting/proof-needed/routing-check work, and gives each Captain one next-best action to keep visible for the property.

Default boundaries:

- Jira remains the source of the work order.
- Ops Watch and Captain Ticket Care are read-only unless Mark approves a specific mutation in the current conversation.
- Captain flags are stewardship signals, not replacement truth for Jira.
- Visual proof closeout still follows the proof-image SOP in this runbook.

Each record carries:

- Captain watch key
- Captain action key
- severity
- status
- owner role
- next move
- Jira evidence payload

## Non-Mutating Packet Build

Save the Jira search output as JSON or pipe it through stdin:

```bash
python3 scripts/build_jira_captain_watch_packet.py \
  --input /path/to/jira-search-output.json
```

To emit SQL for a reviewed publish step:

```bash
python3 scripts/build_jira_captain_watch_packet.py \
  --input /path/to/jira-search-output.json \
  --emit-sql
```

The SQL is not executed by the builder.

## Publish Path

The governed publish target is the existing Captain Runtime model:

- `captain_watch_items`
- `captain_actions`

Use generated SQL only after review. Remote D1 publish, Jira mutation, and recurring automation setup are separate approval steps.

08/24/2026 production note: the reviewed packet `/Users/mark/Property_Analytics/reports/captains_log/jira_ticket_watch/jira-captain-watch-20260824-0819/captain-watch-upserts.sql` was applied to remote Captain Runtime. It created/updated `14` Jira watch items and `14` Jira actions across `12` property Captains. Jira remained read-only. During the same current-state pass, duplicate legacy The Vine Captain identity `505234023` was retired/superseded in favor of governed `TX4EK` without deleting lineage rows.

## Desired Captain Behavior

Every Captain should be able to answer:

- Does my property have active Jira tickets?
- Which tickets are Critical or stale?
- What is the current Jira status?
- What is the next move?
- Who owns the lane?
- What proof closes the watch?

## Checks

After editing this lane, run:

```bash
bash scripts/check_property_identity_governance.sh
bash scripts/check_context_discipline.sh
bash scripts/check_pib_guardrails.sh
```
