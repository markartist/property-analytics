# Layout Governance Compliance Execution Backlog

**Project:** Layout Governance Compliance Platform  
**Date:** 2026-02-18  
**Source Charter:** `docs/LAYOUT_GOVERNANCE_COMPLIANCE_PROJECT_CHARTER.md`  
**Planning Horizon:** Phase 1 MVP (2-4 weeks)

---

## Delivery Model
- **Method:** 4 sprints (1 week each)
- **Prioritization:** P0 (must for MVP), P1 (important), P2 (post-MVP)
- **Definition of Done (global):**
  - Code merged to `main`
  - Unit/integration tests pass in CI
  - Documentation updated
  - Demoable in staging

---

## Epic E1: Governance Spec Foundation (P0)
**Outcome:** Canonical, validated spec model for pages/components.

### Story E1-S1: Define canonical schema package (P0)
- **Description:** Implement TypeScript schema definitions for metadata, sections, blocks, subsections, overlays, enums, and contract metadata.
- **Acceptance Criteria:**
  - JSON schema validates all 11 pages + 2 components
  - Schema versioning field required and enforced
  - Invalid references (section/block/subsection) are rejected with actionable errors

### Story E1-S2: Build validation engine parity rules (P0)
- **Description:** Implement governance checks (required fields, lineage, references, naming, coordinate bounds, duplicate IDs).
- **Acceptance Criteria:**
  - Validation output includes severity (`critical`, `warning`, `info`)
  - Minimum 12 governance rules implemented
  - Validation report emitted as JSON and readable text summary

### Story E1-S3: Spec repository structure and loaders (P0)
- **Description:** Standardize file locations for page/component specs and implement loader utilities.
- **Acceptance Criteria:**
  - `layouts/pages/*.json` and `layouts/components/*.json` load via single API
  - Corrupt or missing file handling returns deterministic errors
  - Loader supports filtering by active pages

---

## Epic E2: Governance App Shell (P0)
**Outcome:** Independently hosted app outside Figma with core navigation and inspection.

### Story E2-S1: Next.js app bootstrap and design system setup (P0)
- **Description:** Scaffold app with TypeScript, Tailwind, shadcn/ui, lint/typecheck/build pipelines.
- **Acceptance Criteria:**
  - App deploys to staging URL
  - CI enforces lint + typecheck + build on PRs
  - Shared layout and base theme implemented

### Story E2-S2: Page/component registry UI (P0)
- **Description:** Build list/detail navigation for archetypes, pages, and global components.
- **Acceptance Criteria:**
  - User can select any active page/component
  - Metadata panel displays version, template, schema, generated timestamp
  - Broken or missing specs show clear error state

### Story E2-S3: Layer inspector (sections/blocks/subsections) (P1)
- **Description:** Implement visual inspector panel for hierarchy and element metadata.
- **Acceptance Criteria:**
  - Hierarchical tree supports expand/collapse
  - Selecting an element shows all governance fields and relationships
  - Links to parent/child entities resolve correctly

---

## Epic E3: Export Parity and Contract Integrity (P0)
**Outcome:** Deterministic exports with integrity metadata.

### Story E3-S1: JSON export parity (P0)
- **Description:** Export page/component specs in canonical JSON with contract metadata.
- **Acceptance Criteria:**
  - Export output deterministic for identical input
  - Includes schema/layout version, timestamp, and contract ID
  - JSON download works in UI and CLI path

### Story E3-S2: CSV export adapters (P1)
- **Description:** Implement Resi/G5-compatible CSV transformations.
- **Acceptance Criteria:**
  - Column set matches approved templates
  - High-priority actions are retained and labeled
  - Export validation checks for empty required columns

### Story E3-S3: Contract hash stamping (P1)
- **Description:** Generate SHA-256 hash for exports and embed in manifest.
- **Acceptance Criteria:**
  - Hash reproducible for same payload
  - Manifest records contract ID + hash + export format version
  - Hash verification utility passes on generated files

---

## Epic E4: Nightly Compliance Audit Pipeline (P0)
**Outcome:** Automated nightly drift detection for governed pages.

### Story E4-S1: Playwright crawler job (P0)
- **Description:** Build crawler that captures rendered DOM for governed URLs and breakpoints.
- **Acceptance Criteria:**
  - Crawl completes for all in-scope pages nightly
  - Retry logic for transient failures (minimum 2 retries)
  - Saved artifacts include raw HTML snapshot + metadata

### Story E4-S2: DOM extractor for governance attributes (P0)
- **Description:** Extract `data-*` governance fields, click targets, structural order, and optional coordinate proxies.
- **Acceptance Criteria:**
  - Extractor outputs structured JSON per page
  - Missing critical attributes explicitly flagged
  - Supports desktop and mobile profiles

### Story E4-S3: Diff engine and compliance scoring (P0)
- **Description:** Compare live extraction vs governed spec and calculate compliance score.
- **Acceptance Criteria:**
  - Detects missing, extra, mismatched, and ordering violations
  - Score formula documented and deterministic
  - Findings include severity and remediation hint

### Story E4-S4: Nightly scheduler + artifact retention (P0)
- **Description:** Run pipeline on nightly schedule and retain trendable outputs.
- **Acceptance Criteria:**
  - Nightly run scheduled in production environment
  - Last 30 days of reports retained minimum
  - Failed runs trigger alert with failure reason

---

## Epic E5: Reporting and Notification (P0)
**Outcome:** Actionable compliance outputs for governance operations.

### Story E5-S1: Compliance report schema (P0)
- **Description:** Define machine-readable format for summaries and findings.
- **Acceptance Criteria:**
  - Report includes run metadata, page scores, issue counts by severity
  - Per-finding payload includes page, entity ID, rule ID, expected vs actual
  - Schema version field included

### Story E5-S2: Human summary renderer (P0)
- **Description:** Generate concise daily summary with top regressions and trend context.
- **Acceptance Criteria:**
  - Summary highlights critical issues first
  - Includes per-page score table
  - Includes run timestamp and data freshness

### Story E5-S3: Notification integration (P1)
- **Description:** Deliver report summary to email/Slack/Teams channels.
- **Acceptance Criteria:**
  - Channel config supports at least one required destination (email)
  - Notifications include link to full report artifact
  - Delivery failures logged and retried

---

## Epic E6: Ops, Security, and Reliability (P1)
**Outcome:** Stable production operations for governance pipeline.

### Story E6-S1: Environment and secret management (P1)
- **Description:** Define env vars and secret handling for app and audit jobs.
- **Acceptance Criteria:**
  - No secrets committed to repository
  - Staging/prod env parity documented
  - Startup checks fail fast on missing required secrets

### Story E6-S2: Observability and run diagnostics (P1)
- **Description:** Add logging, run IDs, and job-level metrics.
- **Acceptance Criteria:**
  - Every nightly run has unique run ID
  - Error logs include rule/page context
  - Metrics include success rate and average run duration

### Story E6-S3: CI quality gates (P1)
- **Description:** Add tests and quality gates for schema, diff engine, and exports.
- **Acceptance Criteria:**
  - Unit tests for validators and scoring
  - Integration test for one full crawl-to-report path
  - CI blocks merges on failing tests

---

## Epic E7: AI-Assisted Mapping and Editing (Phase 2, P2)
**Outcome:** Human-approved AI acceleration for authoring and edits.

### Story E7-S1: AI mapping proposal endpoint (P2)
- **Description:** Generate draft mappings from screenshot/frame inputs.
- **Acceptance Criteria:**
  - AI output constrained to schema-valid JSON
  - Confidence and unresolved fields explicitly surfaced
  - No automatic publish path

### Story E7-S2: AI patch proposal endpoint (P2)
- **Description:** Convert natural language edit requests to spec patches.
- **Acceptance Criteria:**
  - Patch includes before/after diff preview
  - Validation runs prior to save
  - User approval required for commit

### Story E7-S3: Governance approval gate (P2)
- **Description:** Enforce `proposal -> validate -> approve -> publish`.
- **Acceptance Criteria:**
  - Approval event recorded with actor and timestamp
  - Rejected proposals remain auditable
  - Published changes trigger contract restamp

---

## Cross-Epic Dependencies
1. E1 must complete before E3 and E4 can be finalized.
2. E2-S1 must complete before any UI-based story acceptance.
3. E4 depends on URL registry and active-page metadata from E1/E2.
4. E5 depends on outputs from E4-S3.

---

## MVP Sprint Cut (Recommended)
### Sprint 1 (Foundation)
- E1-S1, E1-S2, E1-S3, E2-S1

### Sprint 2 (Registry + Export)
- E2-S2, E3-S1, E3-S2

### Sprint 3 (Audit Engine)
- E4-S1, E4-S2, E4-S3

### Sprint 4 (Operationalization)
- E4-S4, E5-S1, E5-S2, E5-S3, E6-S3

Deferred to post-MVP:
- E2-S3, E3-S3, E6-S1, E6-S2, all E7 stories

---

## Ticket Template (Copy/Paste)
**Title:** `[Epic-Story] Short actionable title`  
**Priority:** `P0 | P1 | P2`  
**Description:** One paragraph describing business and technical intent.  
**Acceptance Criteria:**
- Criterion 1
- Criterion 2
- Criterion 3
**Dependencies:** List required prerequisite stories.  
**Definition of Done:** Tests pass, docs updated, demo completed.

---

## Initial Implementation Tickets (First 10)
1. E1-S1: Canonical schema package
2. E1-S2: Governance rule engine
3. E1-S3: Spec loader + file conventions
4. E2-S1: Next.js app scaffold + CI baseline
5. E2-S2: Registry UI for pages/components
6. E3-S1: Deterministic JSON export
7. E4-S1: Nightly Playwright crawl job
8. E4-S2: DOM governance extractor
9. E4-S3: Diff + compliance scoring engine
10. E5-S1: Compliance report schema
