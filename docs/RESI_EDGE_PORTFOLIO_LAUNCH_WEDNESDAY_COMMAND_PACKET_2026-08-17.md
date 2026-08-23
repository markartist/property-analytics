# Resi Edge Portfolio Launch Wednesday Command Packet

Status: Planning and non-mutating preparation
Prepared: 08/17/2026
Target launch gate: 08/19/2026
Audience: Protected Data Pond executive/operator audience

## Purpose

This packet turns the Phase 2 portfolio launch posture into a Wednesday command board. It is a proof and approval surface, not a deployment surface.

The first 20-site cohort should proceed only after every current-contract gate has fresh evidence and the explicit launch approval is given. Until then, no property DNS, property Cloudflare route/Worker, WordPress, Zaraz, cache, R2, GSC/Captain/Data Pond evidence mutation, Ahrefs, GA4, or property live-domain mutation is authorized from the dashboard or this packet.

## Current Position

- Cohort size: `20` properties.
- Launch cadence: `20` sites every `2` weeks after the first cohort is proven and read out.
- Dashboard host: `https://launch.venterrawebops.com/`.
- Dashboard access posture: protected only; no public version.
- Dashboard build posture: Phase 0 static `apps/web` prototype using mocked/static launch snapshot data.
- API posture: no launch API routes yet.
- Deploy posture: dashboard host is live on Cloudflare Pages project `resi-edge-launch`; no Resi Edge property deployment, property DNS cutover, WordPress/admin path mutation, Zaraz, Ahrefs, GA4, R2, cache, or property live-domain mutation is authorized by this packet.

## Dashboard Access Plan

The launch dashboard uses Data Pond magic-link login as the primary access path for the `launch.venterrawebops.com` deployment.

- Allowed email domains: `venterraliving.com` and `venterra.com`.
- API env plan: `MAGIC_LINK_ALLOWED_DOMAINS=venterraliving.com,venterra.com`, `MAGIC_LINK_AUTO_PROVISION_ENABLED=true`, `MAGIC_LINK_AUTO_PROVISION_PATH_PREFIXES=/resi-edge/launch`, and `MAGIC_LINK_DEFAULT_ROLE=viewer`.
- Web env plan: `NEXT_PUBLIC_AUTH_PRIMARY=magic` for the launch host.
- Allowed company-domain users are auto-provisioned only as `viewer` and only for the allowed launch dashboard path.
- Non-company domains and non-launch auto-provision attempts receive the same generic response but do not get a user record or magic token.
- The Resi Edge launch dashboard is viewer-visible and read-only; decision/admin actions remain admin-gated.
- In magic-primary launch-host mode, sidebar/navigation and protected path access are limited to `/resi-edge/launch`, not the broader viewer-level Pond surfaces.
- Existing Cloudflare Access remains the default auth posture unless the launch environment explicitly selects magic-link primary auth.
- No anonymous public dashboard access is planned.

08/17/2026 deployment note: after explicit approval, `apps/web` was deployed as static Cloudflare Pages output, `launch.venterrawebops.com` was attached as an active custom hostname, and root plus `/resi-edge/launch` now route unauthenticated users to `/login?next=%2Fresi-edge%2Flaunch`. API support version: `pop-brief-api` `cb84a31a-0193-4363-bfeb-9bfeef8a65dc`.

08/17/2026 same-origin session fix: after magic-link verification briefly flashed the dashboard and returned to login, added Worker route `launch.venterrawebops.com/v1/* -> pop-brief-api` and redeployed the launch build with `NEXT_PUBLIC_API_BASE_URL=https://launch.venterrawebops.com`. Final fixed Pages deployment URL: `https://57beb60b.resi-edge-launch.pages.dev`.

## Completed Setup Evidence

| Lane | Current status | Evidence |
| --- | --- | --- |
| Cloudflare vanity authority | Complete for dashboard planning | Phase 2 preflight packet `phase-2-preflight-20260815T171327Z` |
| Ahrefs vanity projects | Complete, `20/20` vanity projects found | `phase2-ahrefs-vanity-projects-20260815T234731Z` |
| Ahrefs legacy handling | Legacy folder proven; `18` legacy projects remain after capacity purge | `ahrefs-legacy-project-purge-20260815T234731Z` |
| GA4 default URI setup | Complete, `20/20` current and `0` blocked | `phase2-ga4-default-uri-20260817T185637Z` |
| Analytics profile readback | Complete for current setup posture | `phase-2-analytics-profile-plan-20260817T185845Z` |
| Wednesday readiness queue | Current board generated; `20` needs evidence, `0` blocked | `phase2-wednesday-readiness-20260817T204109Z` |
| Dashboard prototype | Built locally in protected Data Pond shell | `/resi-edge/launch` static route |

## Current Readiness Board

The current non-mutating queue lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/wednesday-readiness/phase2-wednesday-readiness-20260817T204109Z/`.

Summary:

- Total properties: `20`.
- Ready: `0`.
- Ready for approval gate: `0`.
- Needs evidence: `20`.
- Blocked: `0`.
- Setup coverage: Cloudflare zone, Kinsta staging probe, Ahrefs vanity project, GA4 default URI, draft manifest, and source-phone lookup are each `20/20`.
- Open pre-approval gates: source manifest closeout (`20`), GSC/Captain/Data Pond (`20`), rollback snapshot (`20`).

## Open Wednesday Gates

| Gate | Owner | Required proof |
| --- | --- | --- |
| Source manifest closeout | WebOps | Current staging source audit, content facts, specials, awards, reviews, hero/media assets, source-coded phone evidence |
| GSC evidence | WebOps | URL Inspection evidence and indexing status per property |
| Captain/Data Pond handoff | WebOps | Property-scoped evidence attachment and batch readout references |
| WordPress/admin bypass | WebOps | Native admin/control path proof: no shell, no cleanup, no analytics injection, no cookie stripping, no edge cache |
| Zaraz and consent | WebOps | Zaraz-owned analytics proof, consent assignment, and browser evidence |
| R2 assets | WebOps | Same-origin asset readback and immutable metadata proof |
| Mobile shell proof | WebOps | Mobile visual proof, source phone proof, and no desktop topper regression |
| PSI | WebOps | Mobile and desktop PSI evidence under the current contract |
| Rollback | WebOps | DNS/route/current-state snapshot and rollback plan before apply |
| Batch readout | WebOps | Current-contract readout with no missing required gates |

## Wednesday Operating Sequence

1. Refresh static preflight board from the latest reports.
2. Review all open source manifest rows and classify each as ready, blocked, or needs decision.
3. Attach GSC/Captain/Data Pond evidence for every property that remains in the candidate cohort.
4. Generate the current-contract batch readout.
5. After explicit DNS approval, perform the Cloudflare vanity DNS/forwarding switch in the approved cohort order.
6. Resi/Blue Team then sets each vanity hostname as the primary/live WordPress/Kinsta domain and updates related public/canonical/source URL settings.
7. WebOps validates that root and `www` hold the vanity hostname with `200` or the expected root/`www` canonical redirect, rather than redirecting to `*.kinsta.cloud`.
8. If any gate fails, stop and preserve the evidence packet.
9. If all gates pass, present the approval decision with rollback and stop conditions visible.
10. Perform no forwarding/canonical public launch completion unless explicit approval is given in the active launch task.

08/19/2026 canary sequencing note: `anatoleatnorman.com` proved the expected two-step dependency. WebOps pointed the vanity DNS and removed old Cloudflare forwarding; Kinsta accepted the vanity host, but WordPress redirected it to `https://anatoleatnorman.kinsta.cloud/` because the staging hostname was still primary. This is not a `noindex/nofollow` issue and not a DNS/Kinsta reachability failure. It means the batch run must pair WebOps DNS switch with Resi/Blue Team primary-domain assignment before WebOps marks a property live-ready.

08/19/2026 post-primary/QA note: after Resi/Blue Team primary-domain assignment, full root/`www` readback passed for all `20` vanity domains. Follow-up read-only vanity QA packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_120423_vanity_qa/` reports `19/20` green, `1/20` yellow, and `0` red: root `200`, vanity host hold, vanity canonical, page indexability, robots.txt general-search indexability, and mobile smoke are all `20/20`. The only open automated issue is Axial Buckhead's title placeholder `[*PROPERTY NAME*]`. Dashboard deployment `https://da33fc4c.resi-edge-launch.pages.dev` now shows `Vanity QA 19/20` while keeping public move/legacy redirect completion separate.

## Stop Conditions

Stop immediately if any of these occur:

- Any current-contract validator fails.
- Any source, GSC, Captain, Data Pond, R2, PSI, consent, Zaraz, or rollback proof is missing.
- A WordPress admin/control path shows shell routing, analytics injection, cleanup behavior, non-native JSON, changed login/admin redirect behavior, missing `wordpress_test_cookie`, or cache hit behavior.
- Any property requires a property-specific Worker rebuild.
- Analytics is not Zaraz-owned.
- Source phone attribution is wrong or internal labels render to customers.
- A live proof fails after approval.
- Rollback proof is missing or ambiguous.

## Dashboard Phase 0 Scope

The Phase 0 dashboard is allowed to:

- Show a protected executive/operator launch status view inside the Data Pond shell.
- Present redacted readiness, blocker, evidence freshness, timeline, and command-board data.
- Use static mocked snapshot data until a governed read-only Hono API is approved.

The Phase 0 dashboard is not allowed to:

- Deploy, publish, mutate, cache purge, write to providers, or update live domains.
- Become a second source of truth.
- Create launch controls, apply buttons, or mutation paths.
- Bypass the Resi Edge release control runner, gates, or runbooks.
