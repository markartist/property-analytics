# Data Pond Role Model

Status: Draft v1
Date: 2026-04-14
Owner: MarketingOps / Property Analytics
Depends on:

- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_SECURITY_ARCHITECTURE_2026-04-13.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_ZERO_TRUST_ACCESS_MATRIX_2026-04-13.md`

## 1. Purpose

Define the canonical starting role model for Data Pond in a way that is:

- simple enough to launch now
- themed enough to feel native to the product
- stable enough to extend later without breaking policy, code, or onboarding

This document defines:

- canonical role keys
- product-facing role titles
- role intent
- access boundaries
- initial route and action expectations
- future expansion guidance

## 2. Role System Design Principle

Keep the technical authorization keys plain and durable.

Use themed titles in the product experience.

Canonical keys:

- `viewer`
- `editor`
- `admin`

Display titles:

- `viewer` -> `Observer`
- `editor` -> `Curator`
- `admin` -> `Steward`

This separation is intentional.

It lets the app, database, and policies stay operationally clear while the user
experience can remain branded and human.

## 3. Role Vision

The Data Pond role system should feel like an ecosystem, not a generic admin
panel.

The intended progression is:

- `Observer` watches and understands
- `Curator` shapes and refines
- `Steward` governs and protects

That ladder matches the platform direction:

- broad read access for understanding
- narrower governed write access for active work
- tightly limited operational and governance authority

## 4. Canonical Role Definitions

### 4.1 Observer

Canonical key:

- `viewer`

Display title:

- `Observer`

Purpose:

- read, review, monitor, and understand the system

Expected audience:

- most internal users
- almost all external users at launch
- stakeholders who need visibility without workflow control

Allowed capabilities:

- view Data Pond landing surfaces
- view PIB and reporting surfaces
- view metrics, intelligence outputs, and approved property data
- view dashboards and analytical workspaces that do not expose privileged controls

Not allowed:

- editing governed content
- approving or rejecting governed artifacts
- triggering imports, exports, or operational workflows
- changing settings or permissions
- using privileged admin/operator surfaces

### 4.2 Curator

Canonical key:

- `editor`

Display title:

- `Curator`

Purpose:

- create, refine, and advance governed work without owning core system control

Expected audience:

- internal editorial users
- internal analysts with governed write responsibilities
- carefully selected internal operators with limited workflow scope
- rare external collaborators, only by explicit approval

Allowed capabilities:

- everything an `Observer` can do
- create and edit governed content artifacts
- work in editorial and intelligence workspaces
- update records and drafts within approved scope
- run low-risk governed workflow actions
- submit or prepare work for downstream approval/review

Not allowed:

- platform-wide user management
- secret management
- access-policy management
- destructive system operations
- unrestricted imports/exports
- top-level admin/operator controls

### 4.3 Steward

Canonical key:

- `admin`

Display title:

- `Steward`

Purpose:

- govern the platform, protect the boundary, and operate the system

Expected audience:

- a very small internal group only

Allowed capabilities:

- everything a `Curator` can do
- access admin and operator surfaces
- manage privileged workflows
- manage users and governed approvals inside the app
- run imports/exports and operational actions
- access higher-risk monitoring and intervention surfaces

Required security posture:

- internal user only
- SSO required
- MFA required
- managed-device posture targeted as the next step

Not appropriate for:

- general users
- normal external users
- broad departmental assignment

## 5. Initial Access Matrix

This matrix describes the intended launch posture.

| Surface / Capability Area | Observer | Curator | Steward | Notes |
| --- | --- | --- | --- | --- |
| Main app shell on `app.venterradev.com` | yes | yes | yes | primary human entry |
| PIB and general reporting views | yes | yes | yes | default read lane |
| General analytics and property intelligence views | yes | yes | yes | read-first surfaces |
| Dock and day-to-day app navigation | yes | yes | yes | normal authenticated lane |
| Governed content workspaces | no | yes | yes | editorial/governed write lane |
| Intelligence Office workspaces | no | yes | yes | curated guidance and directives |
| Site Content workspaces | no | yes | yes | governed content operations |
| Watchtower | no by default | no by default | yes | operator-only at launch |
| Imports and bulk operational tools | no | limited later if needed | yes | keep tight initially |
| Exports and backup surfaces | no | no by default | yes | privileged data movement |
| Admin console and permission controls | no | no | yes | top-level governance only |
| Machine/service routes | no | no | no | service identity only, not human roles |

## 6. Internal vs External User Policy

### 6.1 Internal users

Internal users may hold:

- `Observer`
- `Curator`
- `Steward`

Default assignment:

- most internal users should begin as `Observer`

### 6.2 External users

External users should default to:

- `Observer`

External `Curator` assignment should require explicit approval and a very clear
business reason.

External `Steward` assignment should be treated as out of bounds for the normal
platform model.

## 7. Cloudflare Mapping Guidance

Cloudflare Access should not replace the app role model.

Recommended pattern:

- Cloudflare policy decides whether a user may enter a surface
- the app decides whether the user is `viewer`, `editor`, or `admin`
- the UI renders the themed title `Observer`, `Curator`, or `Steward`

Recommended Access-aligned cohorts:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

Recommended Microsoft Entra group names:

- `Data Pond Observers`
- `Data Pond Curators`
- `Data Pond Stewards`

These can exist as Cloudflare groups, IdP groups, or documentation labels, but
the canonical business authorization keys should remain:

- `viewer`
- `editor`
- `admin`

## 8. Microsoft Entra SSO Mapping

For internal users, the preferred workforce identity path is:

1. Microsoft Entra ID authenticates the workforce identity
2. Cloudflare Access evaluates the user and group context
3. Data Pond maps the authenticated identity to the canonical app role

Recommended starting group-to-role mapping:

| Microsoft Entra Group | Cloudflare Access Cohort | App Role Key | Product Title |
| --- | --- | --- | --- |
| `Data Pond Observers` | `Data Pond Observers` | `viewer` | `Observer` |
| `Data Pond Curators` | `Data Pond Curators` | `editor` | `Curator` |
| `Data Pond Stewards` | `Data Pond Stewards` | `admin` | `Steward` |

Recommended operating rule:

- every internal user should land in exactly one primary Data Pond role group at launch

That keeps access legible and avoids ambiguous privilege stacking during the
first rollout.

## 9. Initial Group Policy Guidance

### 9.1 Data Pond Observers

Use for:

- internal users who need read access only
- leadership viewers
- non-operator stakeholders

### 9.2 Data Pond Curators

Use for:

- internal editorial users
- governed content contributors
- intelligence and structured write users

### 9.3 Data Pond Stewards

Use for:

- platform operators
- governance owners
- tightly scoped administrators

This group should remain intentionally small.

## 10. Product Copy Guidance

Use the themed titles in:

- product badges
- invite copy
- user-facing permissions UI
- onboarding docs
- internal screenshots and demos

Use the canonical keys in:

- code
- database records
- API payloads
- migrations
- authorization checks
- tests

## 11. Launch Guidance

For the initial launch:

- do not create more than these three roles
- keep `Observer` broad for read access
- keep `Curator` broad enough to be useful, but not powerful enough to become pseudo-admin
- keep `Steward` very small and tightly protected

This is the right balance for starting small without painting the platform into
a corner.

## 12. Future Expansion Path

The expected future evolution is to split `Curator` once the product needs more
precision.

Likely future descendants of `Curator`:

- analyst-oriented read/write role
- content-focused editorial role
- operator role for limited operational actions

Possible future themed titles could be introduced later, but not before the
current three-role model is under real use.

The current model should stay:

- small
- legible
- governed

## 13. Canonical Recommendation

Adopt this as the official launch role model:

- `viewer` -> `Observer`
- `editor` -> `Curator`
- `admin` -> `Steward`

This should be the naming and permission language used across:

- Data Pond product UX
- Cloudflare Zero Trust planning
- internal onboarding
- app authorization mapping
- future access reviews
