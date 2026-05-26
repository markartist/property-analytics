# Directive Control Center Operating Guide

Date: 05/09/2026
Source of truth: `docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md`

## What This Controls

The Directive Control Center governs the operational directives for:

- Captain’s Office
- Regional Desk / Commodore
- Fleet Desk
- Consulting Bench
- Fleet Scribe Office
- Quartermaster
- Leasing Performance Advisor
- Revenue Advisor
- Signals Officer
- Navigator
- Market Scout
- Product Readiness Officer
- Reputation Officer
- Resident Experience Officer
- Engineer
- Seasonality And Demand Timing Advisor
- Unit-Type Fit Advisor
- Market Elasticity Advisor
- Operational Capacity Advisor
- Trust And Proof Advisor
- Peer Borrowing Advisor

Directives are policy data, not loose prompts. They define what each office or bench lane is allowed to decide, what evidence must be present, when to escalate, and whether a claim can be published.

## Directive Profile Schema

Each directive profile includes:

- identity: `role_id`, `role_name`, `office_type`, `plain_role`, `owner`
- purpose: `purpose`, `decision_questions`, `current_directive_setting`
- sources: `primary_sources`, `advisory_sources`, `required_evidence`
- output contract: `output_contract`, `report_family_applicability`
- controls: `hard_guardrails`, `do_not_allow_rules`, `confidence_thresholds`, `freshness_tolerance`, `escalation_triggers`
- permissions: `publication_permissions`, `external_communication_permissions`
- lifecycle: `active_status`, `version`, `effective_date`, `retired_date`, `change_reason`, `approval_status`, `approved_by`, `approved_at`

## Approval Workflow

Directive states:

- `draft`
- `submitted_for_review`
- `approved`
- `active`
- `rejected`
- `retired`
- `rolled_back`

Rules:

- Every edit creates a draft version.
- Every edit requires a change reason.
- Only approved directives can become active.
- Draft directives are simulation-only.
- Rollback restores a prior version while preserving history.

High-risk changes are flagged when they lower confidence thresholds, loosen freshness rules, relax publication controls, expand external communication permissions, remove do-not-allow rules, change Fleet Scribe publication controls, or change Quartermaster source integrity gates.

## Runtime Resolver

Runtime processes call the resolver with:

- `role_id`
- `property_id`, when applicable
- `report_family`, when applicable
- `runtime_mode`
- `as_of_date`

Runtime modes:

- `monitoring`
- `lightweight`
- `standard`
- `escalated`
- `executive`
- `simulation`

The resolver returns the active directive profile, active version, applicable guardrails, required sources, confidence thresholds, freshness policy, escalation rules, publication permissions, and validation status. Runtime snapshots preserve exactly which directive rules were active when a Captain, Bench lane, or Fleet Scribe output was generated.

## Validation

The validation engine checks:

- required fields are present
- source rules are explicit
- output contract exists
- publication permissions are explicit
- external communication permissions are explicit
- freshness policy is explicit
- confidence thresholds are explicit
- `role_id` values are stable
- only one active directive version exists per profile
- draft directives are not used outside simulation mode

Fleet Scribe publication rules cannot be bypassed. Quartermaster source integrity gates are blocking controls, not advisory text.

## Simulation Harness

Simulation tests directive changes before activation. Inputs include role, draft version, sample property case, sample source freshness state, sample evidence packet, report family, and runtime mode.

Simulation outputs:

- whether validation would pass
- whether publication would be blocked
- whether escalation would be required
- which guardrails fired
- which sources are required
- which claims are publishable
- what changed versus the current active directive

Included sample scenarios:

1. Navigator content recommendation with weak local proof.
2. Quartermaster stale/conflicting source condition.
3. Fleet Scribe publication attempt with template variance or missing approval.

## Audit Events

Audit events are recorded for directive creation, edit, submission, validation, approval, activation, rejection, retirement, rollback, runtime use, simulation run, and validation failure.

Each audit event captures:

- event id
- event type
- role id
- directive version
- actor
- timestamp
- reason
- before snapshot
- after snapshot
- runtime context, when applicable

## Rollback Procedure

1. Select the role in the Directive Control Center.
2. Review version history and audit events.
3. Choose a prior version.
4. Provide a rollback reason.
5. Activate the prior version through the rollback workflow.
6. Confirm runtime resolver returns the restored active version.

## Impact on Captain, Bench, Fleet, and Scribe Behavior

Captain, Commodore, Fleet, Expert Bench, and Fleet Scribe processes should resolve behavior through approved active directive versions. Draft directives may be used only for simulation. External communication permissions must remain explicit. Source freshness and confidence rules must remain required. Fleet Scribe publication controls remain the final publication guardrail for executive-facing artifacts.
