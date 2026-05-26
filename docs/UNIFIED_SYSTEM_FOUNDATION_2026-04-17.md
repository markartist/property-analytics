# Unified System Foundation

Status: Draft v1
Date: 2026-04-17
Owner: MarketingOps / Property Analytics
Scope: Foundation model for making the full Property Analytics platform capability-aware, security-aware, portable, and operationally coherent

## 1. Why This Exists

The repository already contains a real platform.

The current problem is not lack of systems. It is that the systems are only partially aware of:

- each other
- their canonical owners
- their trust boundaries
- their repo boundaries
- their operational role inside The Data Pond

This document defines the next foundational shape:

- one platform landscape
- one capability awareness model
- one security posture
- one migration path for moving valuable systems into governed Data Pond awareness

It is meant to work with, not replace:

- `/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md`

## 2. Foundation Thesis

The platform should behave like a single governed operating system made of multiple coordinated surfaces.

That means:

- `The Data Pond` is the canonical truth and operational control plane
- `Intelligence Office` is the interpretation and directive layer
- `Specs` is the structural truth layer
- `Site Content Creator`, `VACS`, `Watchtower`, `Dock`, `Fishing Hole`, `Pilot Tracker`, `EVS`, and report families are product surfaces on shared platform state
- legacy systems remain visible as reusable or migratable assets until deliberately retired

The platform should be:

- aware of its current capabilities
- aware of what is canonical versus legacy
- aware of trust and security boundaries
- aware of repo ownership boundaries
- aware of future integration targets

## 3. What “System Awareness” Means

System awareness is not a vague assistant concept. It means the repo has explicit, inspectable answers to these questions:

1. What systems exist?
2. What is each system for?
3. Which system is canonical for a concern?
4. Which repo path owns it?
5. Which host or surface exposes it?
6. Which trust boundary protects it?
7. Which inputs and outputs define it?
8. Which systems are legacy but still valuable?
9. Which systems are not yet visible in The Pond but should be?
10. Which workstream owns the next migration?

## 4. Canonical Foundation Layers

### 4.1 Truth Layer

Canonical owners:

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- `/Users/mark/Property_Analytics/Data_Collection/`
- `/Users/mark/Property_Analytics/apps/api/src/`

Responsibilities:

- normalized facts
- lineage
- freshness
- run state
- evidence
- audit records
- shared platform state

### 4.2 Interpretation Layer

Canonical owners:

- `/Users/mark/Property_Analytics/apps/web/src/app/intelligence-office/`
- `/Users/mark/Property_Analytics/apps/api/src/platform/memory/`
- `/Users/mark/Property_Analytics/data/Intelligence/`

Responsibilities:

- directives
- criteria
- approved claims
- operator guidance
- governed memory
- interpretation separate from canonical facts

### 4.3 Structural Layer

Canonical owner:

- sibling Specs system at `/Users/mark/VenterraDev/Specs`

Responsibilities:

- page archetypes
- section order
- structural contracts
- governed page expectations

### 4.4 Execution Layer

Primary systems:

- `Site Content Creator`
- `VACS`
- `EVS`
- report generation families

Responsibilities:

- drafts
- rewrites
- validations
- operator workflows
- outputs derived from shared truth

## 5. Unified Capability Awareness Model

The platform should maintain both:

- a human-readable narrative map
- a machine-readable landscape manifest

Human-readable sources:

- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md`
- this document

Machine-readable source:

- `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`

That manifest should become the concise inventory for:

- canonical systems
- product surfaces
- external sibling systems
- nested repos
- trust zones
- migration targets

## 6. Security and Zero Trust Standard

The platform security model should remain consistent everywhere it makes sense:

- `Keeper` is the canonical secret authority
- `Cloudflare Zero Trust` is the outer trust boundary
- app roles remain the business authorization layer
- service identity should move to Cloudflare Access service tokens instead of long-lived shared bearer patterns

Operational standard:

- human-facing app surfaces should default behind Cloudflare Access
- machine/service routes should prefer service-token identity plus origin validation
- direct-origin exposure should be treated as an exception
- shared tokens should be considered migration debt unless explicitly justified
- secrets should resolve Keeper-first, env-second, file-last

Target classing:

- `Public`: intentionally public artifacts only
- `Access-protected human`: app surfaces such as The Pond, Watchtower, Intelligence Office, Site Content, admin tools
- `Access-protected machine`: protected API/service routes for platform, VACS, EVS, automation
- `Local operator`: launchd, ingestion, local scripts, db maintenance, file-drop workflows

## 7. Portability and Compatibility Standard

The platform should be portable across local automation, app surfaces, and future deployment shapes.

That means:

- package-safe imports over brittle `sys.path` hacks
- canonical contracts over hidden script assumptions
- machine-readable manifests for capability discovery
- fewer one-off local-only runtime assumptions
- clear repo boundaries for nested Git histories
- shared helper modules where policy must stay consistent

Concrete expectations:

- local scripts should import safely without accidental execution
- high-value systems should be callable as modules or structured entrypoints
- policy logic should live in shared modules where multiple surfaces depend on it
- product surfaces should consume canonical APIs and contracts, not parallel ad hoc files

## 8. Repo Topology Standard

This repo is not one clean monolith. It currently contains:

- the main platform repo
- several nested Git repos
- legacy but still useful systems
- active workstreams that have not yet been split cleanly

Current nested Git repos observed in the workspace:

- `/Users/mark/Property_Analytics/.git`
- `/Users/mark/Property_Analytics/Portfolio_Monitoring/.git`
- `/Users/mark/Property_Analytics/Portfolio_Dashboard/.git`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/.git`
- `/Users/mark/Property_Analytics/Spotlight_Properties_Report/.git`
- `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/.git`

Foundation rule:

- nested repos must be treated as explicit boundary objects, not accidental subfolders
- canonical work should migrate toward `apps/api`, `apps/web`, `Data_Collection`, shared config, and governed docs unless there is a clear reason not to
- legacy systems should remain discoverable and referenceable until retired, but not silently keep canonical ownership

## 9. What The Pond Must Become Aware Of

The Pond should not only surface what is already polished in the app. It should become aware of the wider operating landscape.

Priority awareness gaps to close:

- specialized report families that still live as scripts
- pilot-control capabilities not yet surfaced as governed views
- EVS / BrowserStack operational state
- content operations capabilities beyond the current app pages
- legacy but operationally relevant monitoring/reporting tools
- repo and workstream ownership boundaries

This does not mean every system needs a UI immediately.

It means the platform should have governed visibility into:

- that the system exists
- what it owns
- what trust boundary it lives behind
- whether it is canonical, active, specialized, or legacy-reusable
- how it should eventually integrate or retire

## 10. Immediate Foundation Priorities

### Priority 1: Make capability awareness explicit

Use the new machine-readable manifest as the compact map of:

- systems
- surfaces
- trust zones
- repo boundaries
- migration candidates

### Priority 2: Keep Zero Trust consistent

Continue retiring shared-token assumptions in favor of:

- Cloudflare Access for humans
- service-token identity for machines
- Keeper-backed secret authority

### Priority 3: Clean repo boundaries without losing capability awareness

Do not “clean” by forgetting systems.

Instead:

- preserve legacy systems in the manifest/register
- clarify which are canonical
- clarify which are migration targets
- split workstreams and nested repos deliberately

### Priority 4: Bring off-Pond capabilities into governed visibility

The app should gradually gain a system-awareness/control-plane view over:

- reporting families
- pilot systems
- EVS
- specialty diagnostics
- legacy-but-important operational tools

## 11. Near-Term Implementation Standard

When adding new work, prefer:

1. extend the canonical system first
2. update the capability register and manifest
3. assign the trust zone and repo boundary
4. decide whether the capability should become visible in The Pond
5. define the migration or consolidation path if it remains outside the app

## 12. Foundation Outcome

The target outcome is not “one giant app.”

The target outcome is:

- one governed landscape
- one clear truth hierarchy
- one security model
- one capability-awareness model
- clean repo boundaries
- visible paths for migration, extension, and retirement

That is the foundation required before deeper fine-tuning of individual elements.
