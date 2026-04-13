# BrowserStack Stabilization Plan

This document defines the path from pilot-only BrowserStack smoke runs to a portfolio-grade testing system.

## Current State

- Pilot coverage exists for:
  - `desktop_chrome`
  - `iphone_safari`
- Active profile:
  - `critical_cta_smoke`
- The suite currently validates:
  - homepage load
  - apartments reachability
  - unit-detail reachability
  - navigation availability
  - CTA presence
  - interior-page reachability
  - conversion handoff presence
  - JavaScript runtime stability

## Known Gaps

- Mobile flakiness is still elevated on BrowserStack iOS.
- Site-pattern selectors were previously hard-coded in the runner.
- Screenshot capture noise could inflate warning counts.
- Result handling has not clearly separated:
  - real site regressions
  - selector drift
  - BrowserStack infrastructure flake

## Phase 1: Pilot Stabilization

- Increase mobile connect timeout.
- Make mobile-menu, CTA, interior-page, and conversion selectors configurable.
- Ignore `artifact_capture` warnings when deciding overall functional status.
- For iPhone nav on UIkit-based pilot sites, allow a supported structural pass when BrowserStack
  WebKit cannot reliably expose the open-state transition but the mobile menu control and its
  off-canvas target are clearly present in markup.
- Record navigation `proof_level` as:
  - `interactive`
  - `structural`
- Add run classifications:
  - `pass`
  - `selector_review`
  - `needs_review`
  - `journey_failure`
  - `site_regression`
  - `infra_flake`
  - `runner_failure`

## Phase 2: Template-Aware Config

- Keep shared defaults for templated sites.
- Add property overrides only when needed.
- Store selectors in repo config, not inlined code.
- Treat templated pilot sites as the baseline pattern for future portfolio rollout.

## Phase 3: Portfolio-Grade Coverage

- Add `android_chrome`.
- Add desktop Safari or Edge as needed.
- Add image-integrity and failed-request checks so the suite catches non-layout regressions too.
- Add profile separation:
  - `connectivity_smoke`
  - `critical_cta_smoke`
  - `navigation_integrity`
  - `conversion_handoff`
- Add daily smoke and scheduled deeper journey runs.

## Phase 4: Operational Readiness

- Daily summary should distinguish:
  - site issue
  - test issue
  - infrastructure flake
- Add rerun-on-flake rules for:
  - connect timeouts
  - socket idle errors
  - BrowserStack session startup failures
- Only escalate when failures survive retry or map to clear site regressions.

## Success Criteria

- Desktop runs are consistently trustworthy.
- iPhone warnings are mostly meaningful, not incidental.
- BrowserStack result summaries are usable for daily ops.
- The same framework can be extended from pilots to portfolio cohorts without rewriting the runner.
