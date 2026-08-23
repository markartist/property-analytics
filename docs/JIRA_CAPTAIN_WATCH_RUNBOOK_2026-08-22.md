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
