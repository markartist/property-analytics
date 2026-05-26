# Experiment Lab Admin UI Spec

Date: 2026-05-02
Owner: Data Pond web + Data Pond API
Status: Draft UI specification

## Purpose

Experiment Lab is the governed Data Pond admin surface for Edge
Experimentation. It gives operators enough control to draft, validate, approve,
launch, pause, rollback, complete, and learn from small site experiments without
creating an unrestricted visual builder.

The first UI is an operations console, not a design playground.

## Route

Proposed route:

- `/experiments`

Future optional detail route:

- `/experiments/[experimentId]`

The route should appear in the Data Pond app shell only for users with
experiment visibility rights.

## Offering Permissions

Suggested offering key:

- `experiments`

Suggested actions:

- `view`
- `draft`
- `approve`
- `schedule`
- `pause`
- `rollback`
- `decide`
- `administer`

Recommended initial mapping:

| Role | Rights |
| --- | --- |
| viewer | none or `view` only if leadership wants visibility |
| editor | `view`, `draft` |
| admin/steward | all actions |

Portfolio-wide launch approval should require elevated steward/admin rights
even if a user can approve property-level experiments.

## Navigation Placement

Recommended app-shell group:

- Operations or Intelligence

Nearby surfaces:

- Site Content Creator
- EVS
- Watchtower
- Captain / Search Intelligence

Experiment Lab should not be placed under PIB or report-family navigation.

## Screen 1: Experiment List

Purpose:

- show active and draft experiment posture at a glance.

Controls:

- property filter
- status filter
- page type filter
- guardrail status filter
- create draft button

Columns/cards:

- experiment name
- property
- page/component
- status
- primary metric
- traffic split
- guardrail status
- EVS proof status
- current decision state
- last updated

Primary actions:

- view detail
- create draft
- pause active experiment if permitted
- rollback active experiment if permitted

Empty state:

- "No experiments yet. Create a governed draft from an approved property and
  component."

Do not include:

- arbitrary selector entry in the list view.
- launch button without opening detail/readiness.

## Screen 2: Create Draft

Purpose:

- create a governed experiment draft from known property, page, and component
  choices.

Required fields:

- experiment name
- property
- page type
- page path
- component
- change type
- primary metric
- traffic split
- hypothesis
- rollback owner

Variant fields:

- variant label
- action
- governed target component
- payload fields based on action

Payload examples:

- `text_swap`: new text
- `class_swap`: approved class token
- `href_swap`: approved href
- `insert_adjacent`: tag, text, href, class token, insertion position

Validation behavior:

- property must resolve through the identity matrix.
- page/component must resolve through component contract.
- change type must be allowed for the component.
- href must pass safe path/domain validation.
- freeform HTML is blocked.
- arbitrary CSS selector field is hidden from normal operators.

Draft save result:

- status becomes `draft`.
- UI shows next action: `Run preflight`.

## Screen 3: Experiment Detail

Purpose:

- one complete operating view for a single experiment.

Sections:

- summary
- readiness checklist
- variant definition
- preflight proof
- active telemetry
- guardrails
- event reconciliation
- decisions
- learnings
- audit history

Summary fields:

- status
- property
- page
- component
- change type
- primary metric
- traffic split
- assignment unit
- current config version
- owner
- rollback owner

## Readiness Checklist

Checklist items:

- property identity resolved
- component contract resolved
- change type allowed
- variant payload valid
- Worker dry-run selector match passed
- EVS preflight passed
- Zaraz event mapping present
- GA4 metric confirmed
- guardrail policy attached
- rollback owner assigned
- approval recorded

Each item should show:

- status: `pass`, `warning`, `fail`, `not_run`
- timestamp
- evidence link or brief note

The launch/schedule action is disabled until required items pass.

## Preflight Panel

Displays:

- Worker dry-run status
- selector match count
- selector miss count
- config version
- EVS request id
- EVS desktop screenshot status
- EVS mobile screenshot status
- CTA click result
- console/request health summary

Actions:

- run Worker dry-run
- create EVS preflight request
- mark external EVS handoff
- attach proof if permitted

## Active Telemetry Panel

Displays while running:

- total exposures
- control exposures
- variant exposures
- exposure/event reconciliation
- click rate by variant
- primary conversion metric by variant
- last exposure timestamp
- Worker error rate
- selector miss rate

Tone rules:

- healthy: neutral/green
- watch: amber
- breach: red
- unknown/stale: gray with explicit source note

## Guardrails Panel

Displays:

- LCP p75 delta
- INP p75 delta
- CLS p75 delta
- conversion softness
- selector miss rate
- Worker error rate
- analytics event loss
- EVS post-launch status

Actions:

- pause
- rollback
- acknowledge watch state
- record mitigation note

## Decision Panel

Available after completion or rollback:

- continue
- stop no winner
- promote variant
- promote learning only
- reject
- archive

Required fields:

- decision
- rationale
- evidence summary
- confidence
- applicable scope

Promotion behavior:

- a promoted variant does not automatically change the CMS or Specs.
- a promoted learning creates a reusable learning record.
- content/site permanence must flow through Site Content Creator or the
  appropriate governed deployment path.

## Learning Panel

Fields:

- finding
- pattern type
- applicability
- confidence
- source evidence
- promoted to memory status

Pattern types:

- CTA label
- CTA placement
- CTA visual treatment
- promo text
- module presence
- link destination
- market/property-specific signal

## Status Actions

Allowed actions by status:

| Status | Actions |
| --- | --- |
| `draft` | edit, run preflight, archive |
| `pending_preflight` | view proof, cancel preflight |
| `preflight_failed` | revise draft, rerun preflight, archive |
| `ready_for_approval` | approve, reject, revise |
| `approved` | schedule, revoke approval |
| `scheduled` | unschedule, launch when window opens |
| `running` | pause, rollback, complete |
| `paused` | resume, rollback, complete |
| `rolled_back` | record decision, archive |
| `completed` | record decision |
| `promoted` | create learning, archive |
| `rejected` | archive |
| `archived` | view only |

## Error States

Important errors:

- property identity could not resolve
- component contract missing
- component selector missing in dry-run
- change type not allowed
- payload invalid
- EVS preflight failed
- GA4 metric not mapped
- Worker config stale
- permission denied
- experiment locked by terminal status

Errors should explain the next fix, not merely say "failed."

## UX Constraints

Do:

- keep Experiment Lab dense, operational, and scan-friendly.
- show exact source notes for missing/stale evidence.
- use status badges, compact metric tiles, and clear action buttons.
- require detail-page review before launch.
- keep admin/steward actions visibly distinct.

Do not:

- build a landing page.
- hide governance behind decorative cards.
- put UI cards inside other cards.
- use marketing-style hero sections.
- expose freeform HTML.
- expose normal-operator arbitrary selectors.
- allow launch from draft without preflight.

## MVP Acceptance Criteria

- A user with draft rights can create a draft from governed property/component
  choices.
- A user without approval rights cannot approve or launch.
- The detail page shows readiness as pass/warning/fail/not-run.
- Schedule/launch is blocked until required gates pass.
- Pause and rollback are available to permitted users while running.
- Decision recording is required before promoting a result.
- Terminal states are view-only except archive/learning actions.

## Future Builder Boundary

A future visual builder may sit on top of Site Content Creator, but only after:

- component contracts are stable.
- Worker dry-run is proven.
- EVS proof is routine.
- event reconciliation is reliable.
- rollback has been tested.

Until then, Experiment Lab should remain a governed operational console.
