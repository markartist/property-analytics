# Property Operations Platform Architecture

Status: Draft v1  
Date: 2026-03-30  
Owner: MarketingOps / Property Analytics  
Scope: Platform-level architecture for Data Pond, Property Advocate agents, pilot monitoring, governance, and content/experience products

## 1. Purpose

Define a unified operating architecture for Venterra's property intelligence, monitoring, governance, and content systems.

This document treats the following as parts of one coordinated platform:

- `app.venterradev.com`
- `pilot.venterradev.com`
- `vacs.venterradev.com`
- `specs.venterradev.com`

The goal is to move from isolated tools and reports toward a verifiable, agent-assisted property operations system.

## 2. Core Principles

### 2.1 Data Pond Is the Source of Truth

`app.venterradev.com` and the Data Pond are the authoritative system of record for:

- normalized metrics
- source lineage
- run metadata
- findings
- issues
- evidence
- agent memory/state
- standards evaluation results

No product surface or agent should own private canonical truth.

### 2.2 Data Integrity Is Job 1

Every meaningful metric or finding must be:

- source-attributed
- timestamped
- reproducible
- auditable
- validated before operational use

Facts, interpretations, and recommendations must be stored separately.

### 2.3 Agents Are Operators, Not Oracles

Agents should:

- read verified platform truth
- synthesize findings
- classify issues
- recommend actions
- escalate intelligently

Agents should not:

- silently invent facts
- overwrite canonical source data
- exceed scoped authority
- bypass standards or policy boundaries

### 2.4 Shared Memory, Structured Safety

The system should support many focused agents with controlled shared memory.

Memory should be:

- structured
- source-attributed
- bounded by role
- auditable
- separated into canonical facts, working hypotheses, and institutional patterns

### 2.5 Products Are Views on Shared Platform State

Reports, dashboards, spreadsheets, and content products should be outputs of the same platform state, not parallel systems with duplicate logic.

## 3. Platform Surfaces

### 3.1 `app.venterradev.com`

Role: platform backbone / Data Pond

Responsibilities:

- ingest and normalize source-system data
- persist runs, metrics, findings, issues, artifacts, and agent state
- expose canonical APIs
- evaluate freshness, integrity, and standards status
- store shared memory and audit trails

This is the operational core of the system.

### 3.2 `specs.venterradev.com`

Role: governance and standards layer

Responsibilities:

- define property/site standards
- define acceptable behaviors and required configurations
- define evaluation rules and severity logic
- define policy and compliance boundaries
- version standards and rule changes

This is the system that defines what "good" means.

### 3.3 `pilot.venterradev.com`

Role: pilot monitoring and reporting product

Responsibilities:

- pilot dashboard
- pilot spreadsheet-fill outputs
- pilot email reports
- pilot command center
- pilot-specific issue/risk view

This is the first operational product surface on top of Data Pond.

### 3.4 `vacs.venterradev.com`

Role: Venterra AI Content System

Responsibilities:

- property-aware content generation
- channel-specific adaptation
- refinement and evaluation
- content/experience support informed by property intelligence

This is where Property Advocates can use deep property context to improve messaging and content outcomes.

## 4. Major System Domains

### 4.1 Truth Domain

Backed by Data Pond.

Includes:

- source records
- normalized metric records
- lineage
- data freshness
- validation status
- evidence references

### 4.2 Governance Domain

Backed by specs.

Includes:

- standards
- rules
- expected patterns
- exceptions
- severity definitions
- approval policies

### 4.3 Inspection Domain

Detects whether a property is healthy, usable, and compliant.

Includes:

- BrowserStack / EVS
- site audit
- PSI / PageSpeed
- GTMetrix
- structural checks
- network/runtime checks

### 4.4 Behavior Domain

Measures demand and business response.

Includes:

- GA4
- GSC
- Google Ads
- GBP
- guest cards
- reviews/sentiment
- availability / inventory

### 4.5 Operations Domain

Turns facts and findings into action.

Includes:

- issues
- tasks
- escalations
- Property Advocate briefs
- supervisor rollups
- reports and alerts

## 5. Agent System

## 5.1 Agent Philosophy

The platform should use many focused agents with specialized responsibility, rather than a single general-purpose agent.

Each agent should have:

- a clear mission
- scoped authority
- bounded write capabilities
- access to relevant memory
- defined escalation paths

### 5.2 Primary Agent Roles

#### Property Advocate Agent

One per property.

Responsibilities:

- understand the property's current state
- synthesize multi-source signals
- monitor open issues
- recommend next actions
- generate daily property briefs
- escalate when thresholds are crossed

This is the central operating agent for a property.

#### Supervisor Agent

One per cohort, region, or team.

Responsibilities:

- oversee multiple Property Advocates
- detect recurring patterns across properties
- prioritize escalations
- identify systemic issues
- produce supervisor summaries

#### Data Integrity Agent

Responsibilities:

- monitor source freshness and completeness
- detect silent data loss
- validate collection runs
- gate downstream usage when data is incomplete or suspect

#### Performance Agent

Responsibilities:

- interpret PSI/CWV
- interpret GTMetrix
- detect regressions and sustained deterioration
- recommend performance-focused actions

#### Experience Agent

Responsibilities:

- own EVS / BrowserStack interpretation
- monitor critical journeys
- detect usability regressions
- distinguish site issues from tool flake

#### Governance Agent

Responsibilities:

- evaluate properties against specs
- detect standards drift
- classify policy violations
- attach findings to rule versions

#### Traffic/Search Agent

Responsibilities:

- interpret GA4, GSC, Ads, GBP
- identify traffic and visibility changes
- detect channel-specific deterioration or opportunity

#### Conversion/Leasing Agent

Responsibilities:

- monitor guest cards
- monitor availability pressure
- interpret lead and funnel movement
- connect demand signals to operational context

#### Reporting Agent

Responsibilities:

- assemble outputs for humans
- spreadsheet exports
- daily email reports
- executive rollups

#### Pattern Recognition Agent

Responsibilities:

- mine cross-property trends
- identify recurring failure modes
- update institutional memory with evidence-backed patterns

### 5.3 Agent Contracts

Every agent should have a formal contract with:

- mission
- scope
- source systems
- memory access rules
- allowed writes
- blocked writes
- escalation requirements
- output types
- confidence expectations

## 6. Memory Model

### 6.1 Canonical Memory

Stored in Data Pond.

Includes:

- verified facts
- metrics
- findings
- standards evaluations
- issues
- run history
- evidence

Canonical memory is authoritative.

### 6.2 Working Memory

Temporary, task-scoped state for active analysis.

Includes:

- hypotheses
- in-progress synthesis
- pending decisions
- temporary notes

Working memory must not silently become canonical fact.

### 6.3 Institutional Memory

Shared learned patterns with provenance.

Includes:

- known failure modes
- site archetype patterns
- vendor/platform quirks
- successful remediation patterns
- issue heuristics

Every institutional memory item should include:

- source
- confidence
- timestamp
- owner
- last verification date

## 7. Canonical Entity Model

The platform should normalize around these entities:

- `Property`
- `PropertyProfile`
- `PropertyAdvocate`
- `Supervisor`
- `SourceRun`
- `MetricRecord`
- `Finding`
- `Standard`
- `RuleEvaluation`
- `Issue`
- `Task`
- `Escalation`
- `Artifact`
- `Report`
- `AgentMemoryRecord`

## 8. Source Systems

### 8.1 Existing and Near-Term Sources

- GA4
- GSC
- Google Ads
- GBP insights
- GBP reviews / sentiment
- PageSpeed / PSI
- GTMetrix
- BrowserStack / EVS
- guest cards
- availability / inventory
- insights engine
- competitor snapshots / SEMRush
- site audit outputs

### 8.2 Required Source Treatment

Each source should publish:

- collection run metadata
- freshness timestamp
- integrity status
- normalized records
- source lineage
- confidence/quality gating where applicable

## 9. Findings, Issues, and Actions

### 9.1 Separation of Concerns

The system must distinguish:

- `fact`
  - something observed or collected
- `finding`
  - interpretation of a fact or group of facts
- `issue`
  - an operationally meaningful problem to track
- `recommendation`
  - an agent-proposed action
- `action`
  - a task accepted or executed by a human or automated system

### 9.2 Example

- Fact:
  - GTMetrix dropped from 96 to 90
- Finding:
  - 3-day downward trend in performance score
- Issue:
  - sustained performance regression on pilot property
- Recommendation:
  - monitor 24h and compare with PSI; escalate if trend persists
- Action:
  - supervisor assigns performance follow-up

## 10. Product Outputs

### 10.1 Pilot Outputs

- pilot dashboard
- pilot spreadsheet-fill exports
- pilot daily email roundup
- pilot detailed report

### 10.2 Operations Outputs

- Property Advocate daily brief
- supervisor oversight rollup
- issue queues
- risk/watch lists
- alert notifications

### 10.3 Governance Outputs

- standards adherence reports
- compliance audits
- exception tracking

### 10.4 Content Outputs

- property-aware content briefs
- channel-ready content packages
- content evaluation scorecards

## 11. Security and Zero Trust

Cloudflare Zero Trust should be used as the access-control and trust boundary layer.

### 11.1 Human Access

Use Zero Trust to control access for:

- operators
- supervisors
- admins
- governance owners
- content reviewers

### 11.2 Agent Access

Agents should use scoped service identity and policy-based access.

Agents should only have access to:

- the properties/cohorts they are assigned to
- the source systems they are permitted to read
- the object types they are permitted to write

### 11.3 Security Fences

Required controls:

- least-privilege service identity
- environment scoping
- write restrictions by entity type
- full audit logs for agent actions
- approval gates for destructive or externally visible actions

## 12. Role of EVS

EVS is the platform's experiential inspection engine.

Its role is to answer:

- is the site usable on real devices?
- are critical journeys intact?
- is there evidence of regression?
- is this a site issue, selector issue, or infrastructure flake?

EVS should evolve into a canonical inspection service inside the broader platform, not remain a standalone pilot utility.

## 13. Role of VACS

VACS is not separate from the platform vision.

It should become a product surface that uses:

- Data Pond context
- standards/spec context
- property history
- performance and experience signals

to support property-aware content and experience optimization.

This is where Property Advocates can apply rich property understanding to content and messaging outcomes.

## 14. Role of the Pilot Surface

`pilot.venterradev.com` should be the first mature product surface for this platform model.

It should provide:

- cohort health view
- property-level detail
- issue and risk state
- daily trends
- report/email/export functions
- launch and pilot-specific context

It should be built as a product on top of shared platform contracts, not as a separate data island.

## 15. Rollout Strategy

### Phase 1

Unify the architecture and contracts.

Deliverables:

- canonical architecture spec
- entity model
- source inventory
- agent role definitions
- issue/finding model

### Phase 2

Operationalize pilot monitoring on shared contracts.

Deliverables:

- pilot dashboard
- pilot report/email/export system
- EVS integration
- GTMetrix / PSI / GA4 integration

### Phase 3

Introduce Property Advocate operating workflows.

Deliverables:

- property briefs
- issue queues
- supervisor view
- controlled shared memory

### Phase 4

Extend to governance and content.

Deliverables:

- specs evaluation integration
- VACS context integration
- standards-driven recommendations

### Phase 5

Portfolio expansion.

Deliverables:

- broader property cohort onboarding
- tiered inspection depth
- scalable supervisor and issue workflows

## 16. Immediate Next Specs Needed

The following documents should follow this one:

- Data Pond canonical entity and storage model
- agent contract specification
- memory model specification
- issue and escalation lifecycle specification
- Zero Trust access model
- pilot product IA/spec
- VACS integration contract
- governance/spec rule integration contract

## 17. Summary

The platform should be treated as a unified property operations system:

- `app.venterradev.com` is the truth backbone
- `specs.venterradev.com` defines what good looks like
- `pilot.venterradev.com` operationalizes pilot monitoring and reporting
- `vacs.venterradev.com` operationalizes property-aware content and experience adaptation

Property Advocates are the central operating agents in this model.

They should be:

- highly informed
- narrowly authorized
- supported by shared, structured memory
- governed by explicit standards
- connected to a verifiable, auditable truth layer

That is the architecture that best supports both near-term pilot needs and long-term portfolio operations.
