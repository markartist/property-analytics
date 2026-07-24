# Content Operations Model

Status: Draft v1
Date: 2026-04-09
Owner: MarketingOps / Property Analytics
Scope: Relationship model between VACS and Site Content Creator within the governed platform

## 1. Purpose

Define how `VACS` and `Site Content Creator` should work together.

This document makes one central decision explicit:

- `VACS` and `Site Content Creator` should not be merged into one muddy product
- they should instead be separate execution workspaces on top of one shared content operations foundation

## 2. Core Decision

### 2.1 Not Separate Platforms

`VACS` and `Site Content Creator` should not behave like unrelated systems with duplicate logic, private truth, or incompatible guidance layers.

They should share:

- Data Pond truth
- governed memory hierarchy
- Intelligence Office directives
- Specs structure
- Property Advocate guidance
- refinement and provenance patterns

### 2.2 Not One Monolithic Tool

They should also not be collapsed into one single UI or one single workflow.

Why:

- site content work is page- and section-constrained
- long-form content work is editorial and narrative
- the operator goals differ even when they use the same guidance layer

## 3. Product Shape

The recommended domain model is:

- `Content Operations`
  - `Property Intel Pack`
  - `Site Content Creator`
  - `VACS`

This keeps the foundation unified while preserving two focused execution experiences. `Property Intel Pack` is the research/action product that feeds those execution experiences; it is not a third editor or content production workspace.

### 3.1 Property Intel Pack

`Property Intel Pack` is the set Content Ops companion to PIB. PIB answers how the property is performing. Property Intel Pack answers what Alex and Content Ops should write, adjust, test, or investigate next.

Primary responsibilities:

- package DataForSEO, SERP, competitor, review-language, OnPage, AI visibility, and Data Pond evidence into an action brief
- translate evidence into page, section, FAQ, local-search, and positioning assignments
- preserve the workbook as the deep evidence file while keeping the email body narrow and Outlook-friendly
- serve as the governed handoff into Site Content Creator and VACS

Governing standard:

- `/Users/mark/Property_Analytics/docs/PROPERTY_INTEL_PACK_STANDARD_2026-07-15.md`

## 4. Shared Foundation

The following capabilities should be shared by both products.

### 4.0 Property Narrative Canon

Shared role:

- governed core narrative artifact

Shared responsibilities:

- property positioning thesis
- audience and intent map
- proof point ledger
- search/entity/AI visibility map
- message hierarchy across site, blog, GBP, social, email, FAQ/schema, and future outlets
- harmonization audit against the live content ecosystem
- derivative artifact queue with approval and proof requirements

The canon is the source artifact from which VACS long-form work, Site Content Creator section recommendations, and Content Office channel packages should be derived. It does not replace Data Pond facts, Captain memory, Intelligence Office directives, or Specs. It organizes those inputs into one property narrative contract.

Canonical v1 reference:

- `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md`

### 4.1 Data Pond

Shared role:

- canonical factual source

Shared responsibilities:

- property facts
- metrics
- evidence
- run metadata
- lineage
- property context

### 4.2 Intelligence Office

Shared role:

- governed interpretation layer

Shared responsibilities:

- directives
- criteria
- approved claims
- open questions
- source documents
- operator instructions
- property-specific guidance

### 4.2a Governed Memory

Shared role:

- governed reusable memory layer

Shared responsibilities:

- `Captain's Log` for property memory
- `Fleet Brief` for cohort / regional synthesis
- `The Ledger` for approved institutional reuse
- explicit promotion workflow
- evidence-backed lineage and explainability

### 4.3 Specs

Shared role:

- structural truth layer

Shared responsibilities:

- page archetypes
- section roles
- layout expectations
- block/component identities
- visual proof

### 4.4 Property Advocate Layer

Shared role:

- property-aware judgment layer

Shared responsibilities:

- story emphasis
- property-specific priorities
- rule interpretation
- open issue framing
- instruction capture from Alex and other operators

### 4.5 Refinement Model

Shared role:

- governed improvement workflow

Shared responsibilities:

- original vs proposed comparison
- explicit explanation of what improved
- accept/reject behavior
- provenance and approval tracking

### 4.6 Audit and Provenance

Shared role:

- traceability and governance

Shared responsibilities:

- which inputs were used
- which rules were active
- who changed what
- what output was accepted

## 5. Site Content Creator Scope

`Site Content Creator` should own work where the unit of change is:

- site
- page
- section

Primary responsibilities:

- crawl and inventory live property pages
- preserve original copy as baseline
- align content to Specs section structure
- show page- and section-level brief intelligence
- generate proposed replacement copy
- support section-level refine / approve
- evaluate site-wide message harmonization

Best-fit use cases:

- improve homepage hero copy
- rewrite amenities sections
- strengthen neighborhood messaging
- align CTA progression across the site
- reduce repetition across multiple pages

## 6. VACS Scope

`VACS` should own work where the unit of change is:

- article
- campaign draft
- long-form editorial asset

Primary responsibilities:

- property-aware blog generation
- candidate strategy selection
- long-form drafting
- refinement and humanization
- channel-oriented content adaptation
- editorial support informed by property intelligence

Best-fit use cases:

- produce one strong blog for a property
- generate multiple strategic content angles
- refine a long-form draft
- adapt a story for another channel

Current-state note:

- `VACS` is a real platform system today
- the current repo-verified implementation is the protected API surface at `api.venterradev.com/v1/vacs/*`
- `vacs.venterradev.com` remains the intended canonical standalone product surface in architecture
- current-state reporting should not assume a separate deployed VACS frontend host unless deployment evidence is available

## 7. What Must Feel Unified

Even though they remain separate workspaces, they should feel like one operating system.

Users should see the same:

- property context
- governed memory context
- directives
- source documents
- approved claims
- advocate guidance
- refinement language
- audit/provenance model

The user experience should feel like:

- one content operating system

not:

- two unrelated tools
- one flattened blob where truth, guidance, and memory lose their identity

## 8. Workflow Boundary

### Use Site Content Creator when:

- the goal is to improve the live site
- the work is section-based
- the output must align with a page archetype
- the task depends on page sequence and neighboring sections

### Use VACS when:

- the goal is long-form or editorial content
- the work is narrative or campaign-like
- the output is not tied to one exact site section
- the task benefits from broader content strategy variation

## 9. Shared Contract Recommendations

The following contracts should be shared between both systems:

- property context contract
- intelligence brief contract
- approved claims contract
- source artifact contract
- property advocate instruction contract
- link/media suggestion contract
- refinement result contract
- approval/provenance contract

This prevents duplicate logic while allowing different UI/workflow surfaces.

Additional discipline:

- both systems should consume the same Captain's Brief composition rules
- Captain's Brief readiness should be explicit and inspectable
- structured claims and linked evidence should be preferred over legacy free-text approved points
- migration from legacy approved points should be visible and operator-controlled, not hidden inside downstream prompt assembly

## 10. Integration Priorities

### Priority 1

Connect `Specs` to `Site Content Creator` as the structural backbone for:

- page identity
- section identity
- layout mode
- expected role of each section

### Priority 2

Make `Intelligence Office` the visible guidance layer for both:

- site section rewrites
- VACS content generation

### Priority 3

Unify Property Advocate inputs so Alex’s instructions can influence both systems in a visible, attributable way.

### Priority 4

Unify refinement patterns so both products share:

- original vs proposed
- what improved
- accept / reject
- review provenance

## 11. Recommended Product Language

Use the following structure in platform language:

- `Content Operations`
  - `Site Content Creator`
  - `VACS`

Avoid language that suggests:

- these are separate platforms
- one is a backup for the other
- either one owns private truth

## 12. Closing Position

The right answer is not:

- merge VACS and Site Content Creator into one tool

The right answer is:

- unify the foundation
- preserve distinct execution workspaces
- make them operate as one coherent content system

That gives Venterra:

- one set of facts
- one set of directives
- one structural model
- two focused creation workflows

which is much stronger than either fragmentation or premature consolidation.
