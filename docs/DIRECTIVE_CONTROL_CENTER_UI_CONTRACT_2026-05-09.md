# Directive Control Center UI Contract

Date: 05/09/2026

## Purpose

The Directive Control Center UI is the governed surface for viewing, editing, validating, approving, activating, rolling back, simulating, and auditing operational directives. It must never be implemented as one large prompt textbox.

## Required Sections

Each directive profile is displayed in structured sections:

- Identity
- Purpose
- Decision Questions
- Sources
- Output Contract
- Behavior Settings
- Guardrails
- Do Not Allow
- Escalations
- Permissions
- Validation
- Version History
- Runtime Snapshots
- Simulation Results
- Audit History

## API Surface

Base route: `/v1/directives`

Read:

- `GET /profiles`
- `GET /profiles/:roleId/active`
- `GET /profiles/:roleId/versions`
- `GET /profiles/:roleId/draft`
- `GET /fixtures`
- `GET /audit?role_id=:roleId`

Governed edit:

- `POST /profiles/:roleId/drafts`
- `POST /profiles/:roleId/submit`
- `POST /change-requests/:requestId/approve`
- `POST /change-requests/:requestId/reject`
- `POST /profiles/:roleId/activate/:versionId`
- `POST /profiles/:roleId/retire`
- `POST /profiles/:roleId/rollback/:version`

Runtime and testing:

- `POST /validate/:roleId`
- `POST /resolve`
- `POST /simulate`

Seed:

- `POST /seed`

## Field Editing Rules

Editable form fields must be structured:

- text inputs for identity, owner, effective date, change reason
- repeatable list editors for decision questions, sources, guardrails, do-not-allow rules, evidence, escalation triggers, and report families
- boolean controls for publication permissions and external communication permissions
- numeric controls for confidence thresholds and freshness tolerances
- preview/compare panel for active vs draft

No critical behavior rule may be stored only in freeform prompt text.

## Workflow UX

The UI must expose the following actions only when the current user is authorized:

- create draft
- validate draft
- compare active vs draft
- submit for review
- approve
- reject
- activate approved version
- rollback to prior version
- view audit trail
- run simulation
- view runtime snapshots

Draft versions must be labeled as simulation-only. Active runtime use must show the active version and validation status.

## Current Implementation Note

The first UI page at `/admin/directives` provides the structured list/search/view surface for active directives. The backend route already exposes the full workflow contract above. The next UI iteration should add controlled form editors and action buttons over the same API rather than creating another directive-editing path.
