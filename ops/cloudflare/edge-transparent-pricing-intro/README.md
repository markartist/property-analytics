# Edge Transparent Pricing Intro Beta

Cloudflare Worker beta for the `pilot.venterradev.com` transparent-pricing intro modal.

## Scope

- Worker: `edge-transparent-pricing-intro-beta`
- Domain: `pilot.venterradev.com`
- Current beta route:
  - `pilot.venterradev.com/*`
- Experience id: `edge_transparent_pricing_intro_v1`
- Property label: `Apex West Midtown`
- Governed property identity: `GA4AX` / `eed3da54-7b7a-4dae-984b-a203113fc2f3`

## Current Status

The beta is live on the pilot homepage for controlled testing.

The first enabled pass appeared to make the apartment units experience stall for a visitor. The `2026-05-23-beta-2-nonblocking` version used a safer non-blocking posture and was re-enabled on the same narrow route scope for controlled live testing.

The visible unit-list failure was then traced to the test query parameter itself: `?edge_popup_force=1` caused the Resi unit UI to hide visible unit rows even when the Worker route was removed. The current `2026-05-23-beta-3-clean-test-url` version converts force/reset query params into short-lived Worker-only cookies and redirects to the clean URL before the page app hydrates.

After that fix, the pilot `/apartments/` route was found to load directly into the filter/unit-list experience without the production-style hero/title even when the Worker was disabled and routes were removed. The apartment route remains out of scope until the intended pilot route/template is confirmed.

The current testing version is `2026-05-23-beta-7-testing-always-show`, deployed as Worker version `5f743543-aa56-4a10-972f-f43565b03c91`.

- Cloudflare route: `pilot.venterradev.com/*`
- Injection scope: exact path `/` only
- Reason for broad route: exact root route did not fire reliably with query-string test URLs
- Clean URL behavior: `https://pilot.venterradev.com/` shows the popup without test parameters for visitors who have not seen the current homepage experience id
- Testing behavior: frequency caps are temporarily bypassed for both the homepage modal and apartment coach mark, so both can reappear on every reload during review
- Homepage benchmark: `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/HOMEPAGE_BENCHMARK_REPORT.md`

## Behavior

- Injects a small inline bootstrap script at the end of `<body>` on eligible HTML responses.
- Waits for DOM readiness and browser idle, then fades in the notice. Unit/listing DOM waiting is disabled for the homepage version.
- Shows the authentic inline Venterra horizontal logo SVG, the property name once, countdown text, and a progress bar.
- Dismisses by corner X, Escape, or automatic timeout.
- Fades out and removes injected DOM nodes after dismissal.
- Sets `v_edge_msg_seen=edge_transparent_pricing_intro_v1` for 24 hours after dismissal.
- Uses `localStorage` as a secondary guardrail.
- Does not trap focus, autofocus the close button, mark itself as `aria-modal`, or intercept page clicks outside the notice card.

## Test Parameters

- Force display: `?edge_popup_force=1`
- Reset cap: `?edge_popup_reset=1`

These parameters should disappear from the browser URL after the Worker redirects. If they remain in `location.search`, do not trust the unit-list test.

## Rollback

Any of these rolls the beta back without WordPress/YOOtheme/RentPress changes:

- Disable the Worker route in Cloudflare.
- Remove the route binding.
- Set `enabled: false` in `worker.js` and redeploy.

## Benchmark Artifacts

Measurement artifacts are stored under:

`/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/`
`/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/`
