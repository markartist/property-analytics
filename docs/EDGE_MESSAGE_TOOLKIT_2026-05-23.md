# Edge Message Toolkit

Date: 2026-05-23
Status: Beta capability, proven on `pilot.venterradev.com` homepage
Current proof: `edge_transparent_pricing_intro_homepage_v1`
Current Worker: `edge-transparent-pricing-intro-beta`

## Purpose

The Edge Message Toolkit is a reusable Cloudflare Worker capability for launching lightweight, governed, page-level messages without changing WordPress, YOOtheme, RentPress, or page templates.

The first proof is the Venterra-branded transparent-pricing intro message on the pilot homepage.

## Why This Exists

Some site messages need to move faster than CMS/template releases, but still need guardrails:

- transparent pricing education
- temporary policy or fee explainers
- pilot announcements
- leasing funnel guidance
- localized property notices
- campaign-specific education
- controlled tests before committing to permanent page content

This capability gives Venterra a safe edge-controlled tool in the toolbox: deploy quickly, measure overhead, frequency-cap, rollback cleanly, and graduate successful messages into permanent site content later.

## Naming

Recommended capability name:

`Edge Message Toolkit`

Recommended admin surface name:

`Edge Messages`

Recommended individual experience naming pattern:

`edge_message_<initiative>_<surface>_vN`

Example:

`edge_message_transparent_pricing_homepage_v1`

Rationale: avoid naming the capability after a specific UI shape such as popup or modal. The system should eventually support modal, banner, toast, inline notice, and takeover variants. `Message` is broad enough while still being understandable to operators.

## Current Proven Pattern

Current live proof:

- Domain: `pilot.venterradev.com`
- Route: `pilot.venterradev.com/*`
- Injection scope: exact path `/`
- UI shape: centered non-blocking modal-style notice
- Brand: authentic Venterra Velo/wordmark at the bottom of the notice
- Color: `#15284B`
- Property: Apex West Midtown / `GA4AX`
- Dismissal: X, Escape, or auto-close
- Timing: fade in, 7-second countdown, progress bar, fade out
- Frequency cap: cookie plus localStorage fallback
- Test params: force/reset are converted into short-lived Worker-only cookies and redirected to a clean URL before page hydration
- External dependencies: none
- External popup requests: none
- Current live Worker version: `aac2168c-6f12-4a4c-937e-fbad8086b7c6`
- Current layout: property name top-center, large two-line `Say hello to clearer` / `monthly pricing` headline, centered body and disclaimer, countdown/progress, bottom Venterra mark, no top logo.

Current anchored coach-mark proof:

- Experience id: `edge_message_all_in_pricing_coachmark_v1`
- Domain: `pilot.venterradev.com`
- Route: `pilot.venterradev.com/*`
- Injection scope: exact path `/apartments/`
- UI shape: anchored coach mark
- Target: first visible `All-In Price & Details` button
- Trigger: target button enters the viewport
- Decoration: Venterra blue bubble, amber `!` badge, pulse animation, pointer arrow
- Dismissal: X or auto-close
- Frequency cap: separate coach-mark cookie plus localStorage fallback
- External requests: none
- Verification: `47` visible unit rows remained visible while the coach mark was shown
- Testing mode: frequency caps can be bypassed with `ignoreFrequencyCap: true` so messages reappear on every reload during review
- Current testing proof: the coach-mark payload includes `ignoreFrequencyCap`, so it still appears even when the browser already has `v_edge_msg_seen_edge_message_all_in_pricing_coachmark_v1` in localStorage

Benchmark summary from homepage beta:

- Raw HTML overhead: `+11,589 bytes`
- Gzip HTML overhead: `+5,223 bytes`
- Browser document transfer overhead: `+4,208 bytes`
- Measured load-time impact: effectively neutral in the benchmark sample
- Console/page errors: `0`

Artifacts:

- `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/HOMEPAGE_BENCHMARK_REPORT.md`
- `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/homepage-benchmark-summary.json`

## Design Principles

1. Edge-owned targeting, browser-light rendering.
2. No WordPress/YOOtheme/RentPress source edits for temporary messages.
3. No external JavaScript, image, or CSS dependency for beta messages.
4. Clean URL behavior; do not leave test/control params in `location.search`.
5. Explicit frequency cap and rollback path.
6. Property identity must use the governed identity matrix.
7. Every launch needs before/after performance measurement.
8. Every launch needs visual QA on the intended page template.
9. Messages should be temporary or educational; permanent guidance should graduate into site content.
10. Avoid true blocking modals unless legally or operationally required.

## Parameterization Model

Short-term configuration can live as a Worker config object. Long-term configuration should be stored and administered through the Platform / Experiment Lab.

Recommended config fields:

```json
{
  "id": "edge_message_transparent_pricing_homepage_v1",
  "enabled": true,
  "initiative": "transparent_pricing",
  "surface": "homepage",
  "shape": "modal_notice",
  "hostnames": ["pilot.venterradev.com"],
  "pathExact": ["/"],
  "pathIncludes": [],
  "pathExcludes": ["/wp-admin", "/wp-login.php", "/wp-json", "/xmlrpc.php"],
  "propertyCode": "GA4AX",
  "communityId": "eed3da54-7b7a-4dae-984b-a203113fc2f3",
  "propertyName": "Apex West Midtown",
  "title": "Say hello to clearer\nmonthly pricing",
  "body": "See base rent plus required monthly fees together, so your estimated monthly cost is easier to understand.",
  "disclaimer": "Required monthly fees exclude variable fees and optional services.",
  "brandColor": "#15284B",
  "showDelayMs": 800,
  "durationMs": 7000,
  "fadeMs": 360,
  "frequencyCapSeconds": 86400,
  "waitForUnitSelectors": false,
  "analyticsEnabled": true,
  "status": "active"
}
```

## Administration Model

Recommended admin home:

`Experiment Lab -> Edge Messages`

First admin surface:

`/experiments/edge-messages`

Current status:

- Live message styling now comes from the active D1 config written by the Edge Messages admin, with the approved Worker config retained as a safe fallback.
- The Pond surface now inventories the two live beta proofs and provides editable content, style, placement, delivery, timing, decoration, frequency, preview, and guardrail controls.
- Launch, pause, and rollback buttons are intentionally disabled until the approval workflow, EVS preflight, and benchmark gates are wired; the config publish/read path for this beta admin surface is now wired.
- The first admin surface is live on Cloudflare Pages deployment `9aaf825f.property-analytics.pages.dev`; operator URL is `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. Style controls now include title, body, fine-print, and on-color text colors plus fixed official brand swatches alongside the free color picker. The swatches are restricted to the official Venterra palette plus black and white from `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`. Type size controls now provide one-pixel increase/decrease steppers for property, title, body, fine-print, and countdown text, with the preview reading those draft font-size values. The preview mirrors the current modal layout with the property name at top, 7-second countdown, and bottom Venterra/Velo mark, scaled to fit cleanly inside the preview frame. Admin edits now use `Save & Publish`: the page persists the draft locally, posts the exact draft to `POST /v1/experiments/edge-messages/:messageId/live-config`, and the API writes an active Worker-ready row in `edge_experiment_config_versions`. Preview scenes are separated by message shape: modal/banner/toast/inline use the homepage hero context without the apartment all-in button, and the coach mark uses a dedicated apartments-list screenshot asset (`/edge-message-apartments-preview.png`) with the bubble lowered so the pointer lands on the first visible `All-In Price & Details` button. The font-size and live-publish slices were published through the Keeper/KSM-backed Wrangler path after direct Wrangler auth failed in non-interactive mode; curl smoke confirmed the live bundle contains the Type size controls and live publish UI. The live Worker version `3a19688f-51eb-445b-aae5-8e25969bd935` now reads active D1 config through its `POP_BRIEF_DB` binding and falls back to the hard-coded config only when D1 is unavailable or no active row exists. The API Worker version serving the publish endpoint is `8f0af5e6-86ce-463e-9b27-aec8618ba4e7`.

The admin experience should support:

- Create message
- Pick property or portfolio scope
- Resolve governed property identity
- Choose surface and route targeting
- Choose UI shape
- Edit title/body/disclaimer
- Preview on target URL
- Force/reset preview without leaving test params in the URL
- Set frequency cap
- Set start/end window
- Run preflight checks
- Run benchmark
- Launch
- Pause
- Roll back
- Archive learning

## UI Shapes To Support

Initial shapes:

- `modal_notice`: current centered educational modal-style notice
- `top_banner`: thin non-blocking page banner
- `bottom_toast`: small reminder or confirmation message
- `inline_callout`: edge-injected explanatory block near a known page anchor
- `anchored_coachmark`: small animated bubble pointing at a target element

The current transparent-pricing proof should remain `modal_notice`.
The current all-in pricing button proof should remain `anchored_coachmark`.

## Guardrails

Before launch:

- Confirm route and page template.
- Confirm target URL renders correctly without edge code.
- Confirm the message does not alter visible business-critical content.
- Confirm force/reset params clean themselves from the URL.
- Confirm non-target paths do not inject.
- Confirm assets do not inject.
- Benchmark before and after.
- Save screenshot evidence.

Rollback:

- Set `enabled: false` and redeploy, or
- Remove route binding, or
- Pause the message in the future admin surface.

## Recommended Evolution

Phase 1: Worker Config

- Keep the current Worker pattern.
- Parameterize the config object.
- Maintain manual deploy and benchmark discipline.

Phase 2: Config Registry

- Store message definitions as governed JSON.
- Add validation schema.
- Add preview generation.
- Keep deployment manual but config-driven.

Phase 3: Admin Console

- Add `Edge Messages` to Experiment Lab.
- Store messages in D1.
- Generate Worker-safe config from approved records.
- Add approval states: draft, preview, active, paused, archived.

Phase 4: Decision Loop

- Tie messages to analytics events, EVS checks, Core Web Vitals guardrails, and conversion signals.
- Promote successful temporary messages into permanent Site Content Creator workstreams.

## Recommended Canonical Names

Capability:

`Edge Message Toolkit`

Admin nav:

`Edge Messages`

Worker family:

`edge-message-worker`

Current proof experience:

`Transparent Pricing Homepage Intro`

Current proof id:

`edge_transparent_pricing_intro_homepage_v1`

Future canonical id:

`edge_message_transparent_pricing_homepage_v1`
