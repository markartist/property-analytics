# Edge Message Toolkit

Date: 2026-05-23
Status: Live production promotion; first production target is `thevinekyle.com`
Current production message: `edge_message_the_vine_transparent_pricing_homepage_v1`
Current Worker family: `edge-message-worker`

## Purpose

The Edge Message Toolkit is a reusable Cloudflare Worker capability for launching lightweight, governed, page-level messages without changing WordPress, YOOtheme, RentPress, or page templates.

The first proof was the Venterra-branded transparent-pricing intro message on the pilot homepage. The first production promotion is the The Vine Kyle Parkway VIP-list message on `thevinekyle.com`.

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
- Current pilot demo Worker version: `e446f570-e373-409f-a8fb-446c4866bf59`
- Current layout: property name top-center, large two-line `Say hello to clearer` / `monthly pricing` headline, centered body and disclaimer, countdown/progress, bottom Venterra mark, no top logo.
- 2026-07-02 demo reinstatement: the original pilot homepage popup and `/apartments/` helper tag are live again through existing Worker name `edge-transparent-pricing-intro-beta`. The shared Worker code now has pilot-specific fallback configs plus The Vine production configs. Route configs are split so `wrangler.pilot.toml` owns `pilot.venterradev.com/*`, while `wrangler.toml` keeps `edge-message-worker` scoped to The Vine. Smoke confirmed the pilot homepage contains `edge_transparent_pricing_intro_homepage_v1`; the pilot apartments route contains `edge_message_all_in_pricing_coachmark_v1` and retains `vtr_edge_sightmap`.

Current production promotion:

- Domain: `thevinekyle.com`
- Route config: `thevinekyle.com/*` and `www.thevinekyle.com/*`
- Injection scope: exact path `/`
- UI shape: centered non-blocking modal-style notice
- Property: The Vine Kyle Parkway / `TX4EK`
- Community id: `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`
- Experience id: `edge_message_the_vine_transparent_pricing_homepage_v1`
- Title: `Join the VIP List`
- Body: `Receive insider updates, leasing specials, and early access opportunities.`
- CTA: `Get in the Know!` linking to `/contact/#contact`
- Behavior: 2-second delayed intro, 600ms fade-in/fade-out, 7-second countdown/progress timer in official greys, X/Escape dismiss, auto-close, cookie/localStorage cap
- Production frequency posture: frequency capped; `ignoreFrequencyCap` is forced off on launch
- Analytics: CTA clicks emit `edge_message_cta_click` through `dataLayer.push`, direct GA4 `gtag('event', ...)`, and Heap direct-or-queued tracking
- Fallback Worker config: disabled by default; D1 active config is required to launch
- Current cutover state: Worker version `9dc42d2b-bb7b-4232-9fbb-3e58029bfdef` is deployed, D1 has active config version `4`, and live traffic enters the Worker through Cloudflare-proxied CNAMEs to Kinsta (`thevine.hosting.kinsta.cloud`). Live response headers confirm Kinsta O2O with `ki-edge-o2o: yes`.

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
  "showDelayMs": 2000,
  "durationMs": 7000,
  "fadeMs": 600,
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

- Live message styling now comes from the active D1 config written by the Edge Messages admin, with a disabled Worker fallback retained as a safe baseline.
- The Pond surface now inventories the The Vine production message and the all-in pricing coach-mark pattern, and provides editable content, CTA, style, placement, delivery, timing, decoration, frequency, preview, and guardrail controls.
- Draft saves and production actions are separated. `Save Draft` writes a D1 `draft` config version. `Launch`, `Pause`, and `Rollback` write explicit Worker-readable active config versions.
- The current production admin pass is deployed at `https://ca35a518.property-analytics.pages.dev`; operator URL remains `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. The page uses progressive disclosure: Content and Preview are visible by default, while Timing, Style, Targeting, and Publish are collapsible. Header actions include `Save Draft`, `Reset`, `Force preview`, and `Open page`; Publish carries Pause/Launch/Rollback behind the existing admin role gate. Smoke checks confirmed `200` on the preview route, Access `302` on the custom route, and protected `401 NO_SESSION` on the live API route.
- Admin inventory correction: Pages deployment `https://7e9eb13d.property-analytics.pages.dev` restores the two pilot demo messages as editable records in `/experiments/edge-messages`, alongside the two The Vine production records. The deployed bundle includes `edge_transparent_pricing_intro_homepage_v1`, `edge_message_all_in_pricing_coachmark_v1`, `edge_message_the_vine_transparent_pricing_homepage_v1`, and `edge_message_the_vine_all_in_pricing_coachmark_v1`.
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
