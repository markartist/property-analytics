# Spotlight Weekly Field Notes Source Contract

Date: 2026-05-04

Owner: Data Pond + Captain's Log

Source folder:

- `/Users/mark/Downloads/spotlight`

Canonical ingest path:

- `/Users/mark/Property_Analytics/Data_Collection/utils/spotlight_weekly_field_notes_ingest.py`

Canonical tables:

- `spotlight_weekly_field_snapshots`
- `spotlight_weekly_action_items`

Migrations:

- `/Users/mark/Property_Analytics/apps/api/migrations/0042_create_spotlight_weekly_field_notes.sql`
- `/Users/mark/Property_Analytics/infra/migrations/029_create_spotlight_weekly_field_notes.sql`

## Purpose

Spotlight Weekly Field Notes are additive human-sourced operating evidence. They do not replace source-of-record metrics, Marketing Ops Summary, operating metrics, guest cards, unit availability, reputation data, or locked PIB generation.

Their job is to explain what the numbers mean and whether recovery work is actually being executed.

## Source Shape

The current weekly packet may include:

- Excel action-plan workbooks with occupancy goal path and action item tables
- Word notes with leasing activity, renewals, notices, outreach, and narrative explanation
- Text exports of the same weekly narrative

The ingester groups those files by governed property identity and report date.

## Current Load

Initial 2026-05-04 load:

- `14` source files seen
- `6` property snapshots upserted
- `74` action items upserted
- `0` unmapped files

Mapped properties:

- Botanic Luxury
- Forest View
- Steeplechase
- The Pointe Bentonville
- The Reserves of Thomas Glen
- The Retreat

## Snapshot Fields

The snapshot table stores the weekly property read:

- report date and week ending when present
- governed property id, community id, and region
- occupancy, 30-day trend, 60-day trend, adjusted 60-day trend when present
- tours, new leads, applications, pending applications, approvals, cancels/denials, renewals, notices, social posts
- recovery goal from the workbook
- narrative summary and retained source narrative text
- source file list, raw metrics JSON, quality flags, and evidence JSON

## Action Item Fields

The action table stores every field action:

- action item
- action area
- assigned owner
- deadline
- completion status
- notes
- derived action category
- open/closed flag
- quality flags
- source file and row evidence

Derived action categories are advisory only. They currently classify actions into retention, lead management, promotion, pricing, product, people, or general.

## Quality Flags

The ingester preserves source imperfections as quality flags instead of silently correcting them. Examples:

- missing owner
- missing deadline
- missing status
- past-due open action
- vague action
- invalid blank future trend values in the Excel template

These flags should help Captains ask better follow-up questions. They are not a criticism of the onsite team; they show where the weekly packet needs sharper operational specificity.

## Captain Use

Captain and POP recovery reads should use this source to:

- explain why a metric moved
- distinguish traffic problems from conversion, fallout, retention, staffing, product, or competitive-pressure problems
- identify repeated blockers across weeks
- check whether prior recommendations were actually executed
- escalate vague, stale, ownerless, or overdue action items
- capture peer-family tactics that are working in the field

Captain should not use this source to override official metrics. If the field note conflicts with a governed source-of-record value, the Captain should preserve both and call out the reconciliation gap.

## D1 Mirror

`apps/api/scripts/captain_sources_to_d1.py` now includes the two Spotlight weekly field-note tables for property-scoped Captain source syncs.
