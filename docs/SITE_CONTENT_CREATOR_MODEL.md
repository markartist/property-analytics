# Site Content Creator Model

## Purpose

Site Content Creator is the governed content operating workspace for a property site.

Its job is not to rediscover every structural truth from scratch. Its job is to assemble three already-distinct truths into one editorial system:

- intended structure from Specs
- observed rendered structure from EVS / BrowserStack
- actual content evidence from live site capture

From that combined view, Site Content Creator should support:

- block-level diagnosis
- page-level composition review
- site-level harmonization and storytelling review
- governed rewrite workflow

## Canonical Role In The Platform

Site Content Creator owns:

- live site content capture
- normalized page and section inventory
- block, page, and site content representation
- content assessment and rewrite workflow
- site-wide harmonization posture

Site Content Creator does **not** own:

- the source-of-truth page contract
- browser-rendered structural validation
- interpretation-only editorial governance
- property-specific strategic prioritization in isolation

Those responsibilities belong to adjacent systems and should be consumed rather than duplicated.

## Shared System Contract

### Specs

Specs is the structural contract.

Specs should define:

- expected page types
- expected section roles
- expected section order
- required narrative components
- page-purpose expectations

### EVS / BrowserStack

EVS and BrowserStack are the observed rendered-experience layer.

They should define:

- what rendered on the live page
- whether the page is reachable and structurally intact
- whether key navigational and conversion elements are present
- whether the intended journey is actually exposed to a user

### Intelligence Office

Intelligence Office is the governed interpretation layer.

It should define:

- directives
- approved claims
- evidence-backed guidance
- source-backed editorial rules
- narrative and search-quality reasoning

### Property Captain

Property Captain is the property-specific strategic lens.

It should define:

- market posture
- audience emphasis
- priorities
- differentiation focus
- site-level storytelling priorities for that property

### Site Content Creator

Site Content Creator is the operating layer where those inputs meet live content evidence.

It should answer:

- what the site currently says
- how well each block serves its intended role
- whether each page is compositionally coherent
- whether the whole site tells one harmonized story
- what should be rewritten first

## Evaluation Layers

### 1. Block-Level Evaluation

Each content block should be evaluated against:

- intended section role from Specs
- observed live structure from crawl plus EVS evidence where relevant
- governed guidance from Intelligence Office
- property-specific priorities from Property Captain

Block-level dimensions should include:

- structural fit
- messaging clarity
- property specificity
- search / local relevance
- CTA support
- harmonization
- narrative contribution

### 2. Page-Level Evaluation

Each page should be evaluated as a composed unit.

Page-level dimensions should include:

- page purpose clarity
- section sequencing
- trust and proof coverage
- differentiation strength
- CTA integrity
- internal coherence
- narrative completeness

### 3. Site-Level Evaluation

The site should be evaluated as a narrative system rather than a list of pages.

Site-level dimensions should include:

- cross-page voice consistency
- claims consistency
- amenity / lifestyle / neighborhood harmony
- conversion-path consistency
- differentiation continuity
- audience fit
- overall storytelling strength

## Harmonization vs Storytelling

These are related but not identical.

### Harmonization

Harmonization asks:

- are the pages and blocks aligned with one another?
- is the voice consistent?
- do claims agree across the site?
- is the structure coherent with Specs expectations?

### Storytelling

Storytelling asks:

- is the property identity compelling?
- does the site create a clear emotional and strategic arc?
- does the content feel distinctive rather than generic?
- does the site persuade the intended audience?

Site Content Creator should preserve both views separately.

## Canonical Data Shapes

### Site Snapshot

The captured representation of the site at crawl time:

- property
- pages
- sections
- raw extracted copy
- crawl timestamps

### Content Block Registry

The normalized set of content units:

- page id
- section id
- observed section type
- mapped Specs role
- confidence
- assessment state
- rewrite state

### Page Composition View

The page-level rollup:

- page purpose
- expected structure
- observed structure
- block posture
- page assessment
- next move

### Site Story View

The site-level rollup:

- narrative themes
- repeated claims
- inconsistencies
- harmonization posture
- storytelling posture
- priority actions

## Canonical Workflow

1. Capture live pages and sections
2. Normalize into content blocks and page composition
3. Map to Specs expectations
4. Overlay EVS / BrowserStack observed-structure evidence
5. Overlay Intelligence Office directives and approved claims
6. Overlay Property Captain priorities and strategic posture
7. Evaluate at block, page, and site levels
8. Produce governed rewrite and harmonization actions

## Anti-Duplication Rule

Site Content Creator must not:

- recreate Specs as an ad hoc section schema
- recreate BrowserStack as a rendered-journey validator
- recreate Intelligence Office as an undocumented interpretation layer
- recreate Property Captain as a separate strategy system

It should consume and synthesize those systems into one governed content workspace.

## Current Platform Direction

The current platform already has the first three Site Content milestones in place:

- persisted Specs section mapping
- persisted section assessment
- persisted rewrite workflow

The next refinement phase should move upward from section-only workflow into explicit:

- page composition evaluation
- site-level harmonization review
- storytelling review
- shared contract consumption from Specs and EVS rather than local heuristics alone
