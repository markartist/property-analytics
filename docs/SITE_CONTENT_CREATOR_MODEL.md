# Site Content Creator Model

Status: Draft v1  
Date: 2026-04-09  
Owner: MarketingOps / Property Analytics  
Scope: Specs-aware site content evaluation, harmonization, and rewrite system for pilot property websites

## 1. Purpose

Define the intended product shape for `Site Content Creator`.

This system should become the primary governed workspace for:

- understanding live property-site content
- mapping that content to governed page and section structure
- evaluating page- and site-level messaging quality
- generating and refining improved short-form SEO/site copy
- harmonizing story, proof, and CTA across the property site

This is not just a crawler.

## 2. Product Thesis

`Site Content Creator` should be the best-in-class system for evaluating and improving property website copy because it combines:

- `Data Pond` truth
- governed memory from `Captain's Log`, optional `Fleet Brief`, and optional `The Ledger`
- `Intelligence Office` directives
- `Specs` archetype and section structure
- live site copy
- Property Advocate guidance

The system should answer:

- what this section is
- what this section is supposed to do
- what the site currently says
- whether that message is effective and aligned
- how the section should be improved

## 3. Core Product Definition

`Site Content Creator` is the governed site copy evaluation and rewrite workspace inside `Content Operations`.

It should own:

- crawl and baseline capture
- page and section inventory
- Specs-bound section identification
- section evaluation
- site harmonization review
- proposed replacement copy
- refine / approve workflows

## 4. Foundational Inputs

### 4.1 Data Pond

Provides:

- property facts
- metrics
- evidence
- source lineage
- operational and performance context

### 4.2 Intelligence Office

Provides:

- directives
- editorial criteria
- approved claims
- structured claim-evidence relationships
- source documents
- operator instructions
- property-specific guidance

### 4.2a Governed Memory

Provides:

- property-scoped `Captain's Log` memory as the primary memory lane
- optional cohort context from `Fleet Brief`
- optional institutional context from `The Ledger`
- durable lineage and evidence-backed promotion history

Guardrail:

- memory must remain visibly distinct from guidance and source evidence
- `Captain's Brief` is a composed read-model, not a new source of truth
- brief completeness/readiness should be visible before downstream execution proceeds

### 4.3 Specs

Provides:

- page archetype
- governed section identity
- block/component structure
- visual placement patterns
- expected layout modes
- expected section roles
- screenshot/proof context

### 4.4 Live Site Crawl

Provides:

- current page URLs
- historic/original copy
- existing CTA text
- existing bullet lists
- image presence
- link presence

## 5. Core Records

The system should maintain these records for each pilot property.

### 5.1 Property Site Record

Contains:

- property identity
- revised URL
- archetype assignment
- active directives
- advocate instructions
- Captain's Brief readiness state
- missing brief components

### 5.2 Page Record

Contains:

- page URL
- page path
- page type
- page title
- meta description
- Specs archetype page mapping
- current evaluation status

### 5.3 Section Record

Contains:

- Specs section id
- section role
- layout mode
- eyebrow
- title
- subtitle
- original copy
- bullets
- image presence
- link presence
- proposed copy
- refine history
- approval status

### 5.4 Harmonization Record

Contains:

- site-wide narrative summary
- repeated claims
- missing proof areas
- CTA sequence issues
- weak local differentiation
- recommended story emphasis

### 5.5 Brief Readiness Record

Contains:

- completeness score
- completeness status
- missing components
- migration candidates from legacy approved points
- last qualified update timestamp

## 6. Specs-Aware Section Understanding

This is the most important upgrade.

The system should stop thinking only in terms of “blocks found in HTML.”

Instead, each section should be understood as:

- a governed section from Specs
- with an expected role
- an expected layout
- an expected relationship to adjacent sections

For example:

- homepage hero
- apartment features proof section
- community amenities value section
- neighborhood/context section
- CTA / next-step section

This gives the system structural understanding, not just extracted text.

## 6.1 Input Discipline

`Site Content Creator` should present three distinct input lanes:

- truth and evidence from `Data Pond`
- governed memory from `Captain's Log`, `Fleet Brief`, and `The Ledger`
- guidance from `Intelligence Office`

These lanes should collaborate, but they should not be collapsed into one undifferentiated context surface.

## 7. Evaluation Model

Each section should be evaluated across multiple dimensions.

### 7.1 Structural Match

- does the live section align to the expected Specs section
- does the layout match the archetype intent
- is the role of the section clear

### 7.2 Messaging Quality

- is the copy clear
- is the section scannable
- is the section too generic
- does the section sound human and useful

### 7.3 Property Specificity

- does it sound like this property
- does it use approved proof points
- does it reflect real differentiators

### 7.4 Local / Search Value

- does it contain local relevance where needed
- does it provide information gain over generic multifamily copy
- does it help search and AI systems understand the property better

### 7.5 CTA and Conversion Support

- is the CTA posture right for the page and section
- does the section move the user naturally to the next step

### 7.6 Harmonization Fit

- does the section complement the rest of the page
- does the page complement the rest of the site
- does this section repeat messaging better handled elsewhere

## 8. Site Harmonization Layer

`Site Content Creator` should not stop at single-section rewrites.

It should also evaluate the site as a whole:

- what story is the site telling about the property
- where pages repeat each other
- where page roles are blurred
- where proof is missing
- where local context is underused
- where CTA progression is fragmented

This should become one of the system’s defining strengths.

## 9. User Experience Model

The primary workflow should be:

1. Select property
2. Select page
3. See page inventory and Specs binding
4. Review section cards with original copy and current evaluation
5. Open section-level brief intelligence
6. Generate proposed replacement copy
7. Refine with Property Advocate / Alex instruction
8. Accept or reject
9. Review site harmonization impact

## 10. Visual Representation Goals

The page representation should mirror the real site more closely than a crawl dump.

That means:

- respect left/right image placement
- show eyebrow/title/subtitle structure
- show bullets when present
- reflect section composition more like the live page
- use Specs layout expectations where available

The visual representation does not need to be pixel-perfect.

It does need to be:

- structurally recognizable
- useful for evaluation
- good enough for rewrite decision-making

## 11. Refinement Model

Section-level refinement should match the best parts of the VACS pattern:

- original copy
- proposed copy
- what improved
- why it improved
- accept / reject
- operator notes

Alex should be able to add instructions at:

- property level
- page level
- section level

These instructions should remain visible and attributable.

## 12. Immediate Build Priorities

### Priority 1: Specs Binding

Map crawled pages and sections to Specs structures:

- page template
- section identity
- role
- layout mode

### Priority 2: Section Evaluation

Add explicit section scoring/review dimensions:

- structure
- messaging
- property specificity
- local relevance
- CTA quality
- harmonization fit

### Priority 3: Proposed Copy Workflow

Add:

- proposed replacement copy
- original vs proposed view
- refine controls
- approval state

### Priority 4: Harmonization View

Add site-level analysis:

- repetition
- missing proof
- weak differentiation
- weak CTA progression

### Priority 5: Advocate Console Integration

Surface Alex/advocate instructions directly in the section workflow.

## 13. Success Standard

`Site Content Creator` is successful when it can:

- understand the property site structurally through Specs
- show current copy in a recognizable and trustworthy way
- evaluate whether the copy is effective
- recommend better copy using governed guidance
- help the team harmonize the full site narrative

## 14. Closing View

This system should become more than a section crawler.

It should become:

- the governed evaluation system for property websites
- the rewrite workspace for live site content
- the harmonization engine for property storytelling across the full site

That is the version of `Site Content Creator` that is worth building.
