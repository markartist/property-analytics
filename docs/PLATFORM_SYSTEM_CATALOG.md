# Platform System Catalog

Status: Draft v1
Date: 2026-04-09
Owner: MarketingOps / Property Analytics
Scope: Canonical capability catalog for the interconnected Venterra property operations platform

## 1. Purpose

Document the major systems, domains, and product surfaces that now make up the Venterra operating platform.

This catalog is meant to answer:

- what exists
- what each system is for
- what inputs it consumes
- what outputs it produces
- which system is the source of truth for a given concern
- where the next integration priorities should go

This is not a code inventory. It is a platform capability map.

## 2. Platform Thesis

The Venterra platform is not one application. It is a coordinated operating system for:

- property truth
- standards and structure
- content governance
- content execution
- monitoring and evaluation
- operational reporting

The intended system shape is:

- `The Data Pond` is the canonical source of truth
- `Intelligence Office` is the interpretation and directive layer
- `Specs` is the structural and archetype truth layer
- `Site Content Creator` is the section-level execution workspace
- `PIB`, `Watchtower`, `Dock`, `Fishing Hole`, `Pilot Tracker`, and `VACS` are consumers or operators on top of those layers

## 3. Source-of-Truth Hierarchy

### 3.1 Data Truth

Canonical system:

- `The Data Pond`

Owns:

- normalized property data
- metrics
- evidence
- lineage
- freshness
- run metadata
- shared platform state

### 3.2 Interpretation Truth

Canonical system:

- `Intelligence Office`

Owns:

- directives
- criteria
- source documents
- approved claims
- property guidance
- operator instructions
- content governance overlays

### 3.3 Structural Truth

Canonical system:

- `Specs` (external but governed sibling system)

Owns:

- page archetypes
- section order
- block and component structure
- layout expectations
- visual position references
- governed page contracts

### 3.4 Execution Truth

Primary systems:

- `Site Content Creator`
- `VACS`

Own:

- generated draft candidates
- section rewrites
- editorial refinement flows
- human review decisions

These systems should never redefine truth that belongs to Data Pond, Intelligence Office, or Specs.

## 4. Major Systems

### 4.1 The Data Pond

Role:

- canonical property operations platform backbone

Primary responsibilities:

- ingest and normalize source data
- store platform facts
- expose governed APIs
- host product surfaces on shared platform state

Primary inputs:

- GA4
- GSC
- GBP
- PSI
- GTmetrix
- guest cards
- cloudflare audit data
- property metadata

Primary outputs:

- platform APIs
- dashboard surfaces
- shared property context
- downstream product data

Current maturity:

- live production backbone

### 4.2 Intelligence Office

Role:

- editorial and search-governance interpretation layer

Primary responsibilities:

- hold visible directives
- preserve source documents
- store approved claims and open questions
- capture Alex/operator instructions
- expose governed guidance to content systems

Primary inputs:

- Data Pond signals
- guidance documents in `data/Intelligence/`
- operator instructions

Primary outputs:

- property guidance
- content rules
- source-backed brief context
- advocate prompt inputs

Current maturity:

- live API
- live web area
- early pilot operations surface

### 4.3 Specs

Location:

- sibling repository at `/Users/mark/VenterraDev/Specs`

Role:

- governed archetype and page-structure system

Primary responsibilities:

- define page-level governed specs
- compile TXT contracts into validated structures
- extract and audit live page structure
- store visual position references and page screenshots

Primary inputs:

- governed TXT specs
- live page extraction
- page screenshots
- position overrides

Primary outputs:

- compiled specs
- structural contracts
- section maps
- visual proof

Current maturity:

- live independent system
- strong structural governance asset

Strategic note:

Specs should be treated as the structural skeleton for site content understanding, not as a disconnected tool.

### 4.4 Site Content Creator

Role:

- site copy inventory and section-level rewrite workspace

Primary responsibilities:

- crawl property pages
- capture current copy as baseline
- map page sections
- show brief guidance alongside source content
- support proposed copy and section-level refinement

Primary inputs:

- property URLs
- Captain's Log memory and Captain's Brief read-model inputs
- Intelligence Office directives
- property-scoped approved claims and linked evidence
- live site crawl results
- eventually Specs structural contracts

Primary outputs:

- page inventory
- section baselines
- rewrite workspace context with distinct memory / guidance / evidence lanes
- harmonization analysis inputs

Current maturity:

- live pilot surface
- crawl/inventory working
- rewrite workflow still early
- Captain's Brief readiness is now a first-class gating signal, with structured claims/evidence and migration from legacy approved points feeding the composed brief view

Relationship note:

Site Content Creator should be treated as one execution workspace within the broader `Content Operations` domain, sharing foundation layers with `VACS` while remaining distinct in operator workflow.

Reference:

- `docs/SITE_CONTENT_CREATOR_MODEL.md`

### 4.5 Property Intelligence Brief (PIB)

Role:

- canonical property intelligence reporting product

Primary responsibilities:

- deliver standardized property intelligence views
- assemble operational performance and trend reporting

Primary inputs:

- Data Pond metrics
- canonical PIB pipeline

Primary outputs:

- PIB dashboards
- PIB property detail views
- PIB exports and email outputs

Current maturity:

- governed canonical production system

Guardrail:

- canonical PIB generation/rendering remains locked and must not be bypassed or silently replaced

### 4.6 Watchtower

Role:

- health and monitoring surface

Primary responsibilities:

- system health visibility
- data freshness/status
- operational condition summaries

Primary inputs:

- Data Pond freshness and health signals

Primary outputs:

- monitoring views
- operational health awareness

Current maturity:

- live product surface

### 4.7 The Dock

Role:

- operational handoff and quick-entry surface

Primary responsibilities:

- quick access to major reports and data products
- preview operational product state

Primary inputs:

- Data Pond product summaries

Primary outputs:

- launch and handoff paths for operators

Current maturity:

- live product surface

### 4.8 The Fishing Hole

Role:

- governed conversational analytics assistant

Primary responsibilities:

- answer operator questions from Data Pond-backed truth
- provide guided access to analytics and product surfaces

Primary inputs:

- Data Pond APIs and governed prompt policy

Primary outputs:

- conversational answers
- guided links to platform surfaces

Current maturity:

- live product surface

### 4.9 Pilot Tracker

Role:

- pilot program tracking and KPI visibility

Primary responsibilities:

- follow pilot cohorts
- show pilot KPI state
- support pilot execution and review

Primary inputs:

- pilot KPI exports
- Data Pond pilot data

Primary outputs:

- pilot monitoring dashboards

Current maturity:

- active pilot surface

### 4.10 VACS

Role:

- governed narrative synthesis, content generation, and refinement system

Primary responsibilities:

- Property Narrative Canon generation and refresh
- content briefs
- blog generation
- refinement and humanization
- media/link support
- property-aware content operations

Primary inputs:

- Data Pond property context
- governed memory context from Captain's Log, Fleet Brief, and The Ledger
- Intelligence Office rules and guidance
- Property Narrative Canon source contract
- DataForSEO search, OnPage, business, and AI visibility evidence
- future Ahrefs authority, backlink, and content-gap evidence after governed onboarding
- support/advocate signals

Primary outputs:

- Property Narrative Canon artifacts
- governed blog drafts
- property-aware content artifacts
- channel derivative briefs for Content Office

Current maturity:

- 08/27/2026 supersession: Mark redirected VACS from a standalone/bridge product surface into the in-Pond AI Content Suite. Treat `/site-content` as the active operator workspace for VACS-capable live page editing; `/vacs` is compatibility access to that same Pond editor, not a separate place to work. Old Content Office is legacy for this lane.
- live governed API surface
- strongest current path: one strong Property Narrative Canon for one property, then one long-form artifact and one channel derivative package from that canon
- `vacs.venterradev.com` is superseded as an operator destination for this lane; the current repo-verified implementation is the protected API route family at `api.venterradev.com/v1/vacs/*` plus the in-Pond AI Content Suite at `/site-content`

Superseded relationship note:

VACS should not be promoted as a distinct operator workspace for the Pond content lane. Its drafting capability belongs inside AI Content Suite over mapped live Site Content records, sharing Data Pond, Intelligence Office, Specs, and Captain context instead of duplicating them.

The Property Narrative Canon v1 is now the governing core artifact for VACS strategy. It is the durable narrative layer from which Site Content Creator recommendations, VACS drafts, Content Office channel packages, and future publishing artifacts should be derived. See `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md`.

## 5. Capability Matrix

| Capability | Canonical Owner | Primary Consumers |
| --- | --- | --- |
| Property facts and metrics | Data Pond | PIB, Watchtower, Fishing Hole, VACS, Site Content Creator |
| Editorial/search directives | Intelligence Office | Site Content Creator, VACS, future content systems |
| Page archetype and section structure | Specs | Site Content Creator, future harmonization engine, content generation |
| Standard property intelligence reporting | PIB | operators, supervisors, downstream review |
| Site copy inventory and rewrite workflow | Site Content Creator | content team, advocates, Alex |
| Long-form property content generation | VACS | content team, advocates |
| Operational health visibility | Watchtower | operators |
| Pilot-specific KPI visibility | Pilot Tracker | pilot operators |
| Conversational analytics access | Fishing Hole | operators, analysts |

## 6. Current Integration Pattern

The intended integration pattern is:

1. `Data Pond` supplies property and portfolio truth
2. `Intelligence Office` interprets that truth into content and search guidance
3. `Captain's Log`, `Fleet Brief`, and `The Ledger` preserve governed memory without redefining truth
4. The `Property Narrative Canon` organizes those facts, memory, search signals, and directives into one durable property narrative contract
5. `Specs` defines how the site is structurally organized
6. `Site Content Creator` uses truth, memory, guidance, Specs, and the canon in separate lanes to inventory and rewrite section-level site content
7. `VACS` uses the same governed inputs and canon to generate longer-form property content without flattening them into one context blob
8. `Content Office` derives channel packages from the canon and preserves approval/publication proof
9. `PIB`, `Watchtower`, `Dock`, `Fishing Hole`, and `Pilot Tracker` consume the same shared platform state for reporting and operations

## 7. Current Gaps

### 7.1 Specs Is Not Yet Fully Connected

Specs is currently understood conceptually, but not yet fully wired into Site Content Creator as the primary structural contract source.

Consequence:

- crawl heuristics still guess too much
- section role understanding is weaker than it should be

### 7.2 Intelligence Office Is Early

The Office exists, but it needs broader adoption as the visible directive layer behind:

- site content
- VACS content
- future harmonization outputs

### 7.3 Site-Level Harmonization Is Not Yet First-Class

We can inventory sections and pages, but we do not yet have a full site harmonization engine that evaluates:

- repetition
- story fragmentation
- weak local proof
- page-to-page narrative complementarity

### 7.4 VACS and Site Content Creator Need Shared Governance Inputs

They are moving in the right direction, but they still need tighter convergence around:

- property guidance
- evidence
- approved claims
- section/story strategy

## 8. Integration Priorities

### Priority 1: Specs ↔ Site Content Creator

Make Specs the structural source for:

- archetype selection
- section identity
- section role
- layout pattern
- expected media placement

This is the key step that upgrades Site Content Creator from a crawl/inventory tool into a governed site evaluation system.

### Priority 2: Intelligence Office ↔ Site Content Creator

Make every section review show:

- rules in effect
- criteria
- approved claims
- source documents
- operator instructions

### Priority 3: Intelligence Office ↔ VACS

Ensure VACS blog/content generation visibly uses:

- approved property guidance
- source-backed instructions
- operator directives

### Priority 3.5: Content Operations Shared Contracts

Formalize the shared foundation between `VACS` and `Site Content Creator`:

- shared property context
- shared intelligence brief
- shared approved claims
- shared advocate instructions
- shared refinement/provenance model

Reference:

- `docs/CONTENT_OPERATIONS_MODEL.md`

### Priority 4: Harmonization Engine

Add site-wide analysis that can evaluate:

- repeated messages across pages
- missing proof
- weak local differentiation
- weak CTA progression
- mismatch between archetype structure and current copy

## 9. Immediate Operational Recommendation

For the current pilot phase:

1. Keep `Data Pond` as the sole factual source of truth
2. Treat `Intelligence Office` as the governed guidance layer
3. Treat `Specs` as the structural truth layer
4. Use `Site Content Creator` as the first site-level execution workspace
5. Keep `VACS` focused on one strong content output per property before expanding breadth

## 10. Naming Guidance

Use these names consistently:

- `The Data Pond` — platform/system-of-record
- `Intelligence Office` — interpretation/governance layer
- `Specs` — structural/archetype governance system
- `Site Content Creator` — section-level site rewrite workspace
- `PIB` — canonical property intelligence reporting product
- `Watchtower` — health/monitoring surface
- `The Dock` — operational launch surface
- `The Fishing Hole` — conversational analytics assistant
- `Pilot Tracker` — pilot KPI and monitoring surface
- `VACS` — governed content generation system

## 11. Closing View

The platform should be understood as one coordinated property operating system.

It is not:

- a dashboard plus side tools
- a content tool plus reporting tools
- a collection of disconnected pilots

It is:

- a shared truth system
- a governed interpretation layer
- a structural archetype system
- a content execution layer
- a monitoring and reporting layer

The next phase should focus on making those relationships explicit, durable, and reusable.
