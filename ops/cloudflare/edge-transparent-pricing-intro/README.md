# Edge Message Worker

Cloudflare Worker for governed Edge Message Toolkit messages. The current production promotion target is The Vine Kyle Parkway on `thevinekyle.com`.

## Scope

- Worker: `edge-message-worker`
- Domain: `thevinekyle.com`
- Current production route config:
  - `thevinekyle.com/*`
  - `www.thevinekyle.com/*`
- Homepage experience id: `edge_message_the_vine_transparent_pricing_homepage_v1`
- Apartments coach-mark experience id: `edge_message_the_vine_all_in_pricing_coachmark_v1`
- Property label: `The Vine Kyle Parkway`
- Governed property identity: `TX4EK` / `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`

## Current Status

The Worker has been promoted from the pilot proof into the production The Vine launch path. Fallback message configs are The Vine-specific and disabled by default. The live state comes from D1 active config versions written by the Edge Messages admin.

The production DNS records for `thevinekyle.com` and `www.thevinekyle.com` are Cloudflare proxied CNAMEs that still target Kinsta at `thevine.hosting.kinsta.cloud`; live headers confirm Kinsta O2O with `ki-edge-o2o: yes`.

The first production homepage message:

- Title: `Join the VIP List`
- Body: `Receive insider updates, leasing specials, and early access opportunities.`
- CTA: `Get in the Know!`
- CTA href: `/contact/#contact`
- Behavior: 2-second delayed intro, 600ms fade-in/fade-out, visible 7-second countdown/progress in official greys, auto-close timer, X/Escape dismiss, and production frequency capping
- CTA click telemetry: `dataLayer.push`, direct GA4 `gtag('event', 'edge_message_cta_click', ...)`, and Heap direct-or-queued tracking

Deployments must use the Keeper/KSM-backed Wrangler helper, not direct local credential files or ad hoc tokens.

Historical pilot notes below document how the original Apex proof was validated and hardened.

The 2026-05-28 Resi performance diagnosis added a draft optimization layer for the same pilot host. It is scoped to exact paths `/` and `/apartments/`, HTML responses only, and avoids admin/API/static asset routes. The goal is to improve LCP before source-template changes by making the homepage hero image discoverable earlier and by adding basic image-priority hints on the apartment listing page.

Performance layer behavior:

- Homepage `/`: adds DAM and Resi pixel preconnect hints, preloads `https://dam.getresi.co/18515/conversions/Home-Hero-full.jpg`, and rewrites the matching UIkit hero background `data-src` into an initial inline `background-image` marker.
- Apartments `/apartments/`: adds preconnect hints and assigns eager/high priority to the first four DAM images while marking the remaining DAM images lazy/low priority.
- Verification marker: eligible HTML responses append `Server-Timing: vtr_edge_perf;desc="applied"`.

This performance layer was deployed through the Keeper/KSM-backed Wrangler helper on 2026-05-28 as Worker version `4a7fa0ee-ab6a-407c-8427-694cf693f93e`, then disabled after a live GTMetrix score regression was observed. Rollback deploy version: `9fe6606e-c40e-4318-ada3-e2634c910cb9`. The Worker was then paused into pass-through mode for all edge messages, coach marks, and performance rewrites as version `caba5935-ec78-4e2f-bdee-23a099106cb4` so PSI can be baselined before adding one behavior back at a time. A header-only homepage hero preload test was deployed as `45b31461-f2b0-4059-9e1d-bac24dc1666b`, but 3-run PSI medians showed homepage mobile score `83 -> 80` and LCP `3826ms -> 4662ms`; it was rolled back to pass-through as version `542b75ca-3977-4130-a04a-6d731f70d255`. A Zaraz-only Cloudflare Configuration Rule test then disabled Zaraz on `pilot.venterradev.com` while leaving Cloudflare Web Analytics enabled; three-run PSI medians worsened on mobile (`83 -> 73` homepage, `57 -> 53` apartments), so the temporary rule was removed and Zaraz injection was verified restored. A Cloudflare Web Analytics / RUM-only test then disabled `static.cloudflareinsights.com/beacon.min.js` with Zaraz and Resi pixel still enabled; it reduced requests by `2` and bytes by roughly `12-16 KB`, but was mixed in PSI (`57 -> 71` apartments mobile, worse homepage and apartments desktop), so the temporary rule was removed and RUM was verified restored. An IE11-only script removal test deployed Worker version `4bd6d02d-8a67-4965-aeac-3b984afa4924` to remove only `ie-11.js`; it removed one request and modestly helped apartments mobile, but apartments desktop regressed, so Worker version `da567516-6085-4585-8da2-936c1168300b` restored `ie-11.js`. SightMap lazy-loading is the first kept performance win: Worker version `17944c96-a290-4853-962a-61762dd455e0` lazy-loads the `/apartments/` SightMap iframe and API on map interaction, with functional smoke passing and PSI medians improving apartments mobile score `57 -> 74` and desktop score `75 -> 99`. A homepage hero inline-background test deployed as `dade5885-9bbd-44f6-b067-d719be001c9f` avoided preload and removed UIkit `data-src` / `uk-img`, but worsened homepage mobile LCP `3826ms -> 6592ms`; Worker version `63ebf1cd-80b6-4525-940d-e9bdaf2d063c` rolled that hero rewrite back while keeping SightMap lazy-load live. A jQuery Migrate removal test deployed as Worker version `02fa421f-1759-465b-9c0b-6961ccbd768e` removed only `/wp-includes/js/jquery/jquery-migrate.min.js` from `/` and `/apartments/`; Playwright smoke passed, but PSI was mixed and apartments desktop regressed sharply versus SightMap-only (`99 -> 65`, TBT `60ms -> 1428ms`), so Worker version `ff0eee24-3bb5-4f4d-8210-16b3e40bdbec` restored jQuery Migrate while keeping SightMap lazy-load live. A script-cost profile on 2026-05-29 showed YOOtheme/UIkit as the largest actionable script CPU bucket, with the Resi pixel smaller but still measurable on apartments. A broad Resi pixel idle-load test version `e65ae339-9018-464b-94f6-6ab589928a59` was functionally safe but mixed in PSI, and a narrowed mobile-`/apartments/` test version `60e88ee1-e8fc-4d67-a2d8-b424992b0b5c` did not hold the mobile gain, so Worker version `1f0f3a89-15c4-4037-b8ed-34e2a192a5fc` restored the direct pixel script while keeping SightMap lazy-load live. Baseline and 2026-05-28/2026-05-29 test artifacts live under `/Users/mark/Property_Analytics/reports/resi_edge_performance/`.

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
