# Full System Audit

Status: Draft v1
Date: 2026-04-10
Owner: MarketingOps / Property Analytics
Scope: Repository-wide audit of capabilities, systems, workflows, and adjacent assets currently present in `/Users/mark/Property_Analytics`

08/22/2026 Ops Watch mirror/push Cloudflare ingest addendum: added and deployed the dedicated Cloudflare receiving lane for sanitized internal/intranet Ops Watch exports. The Worker lives at `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/worker.js`, is configured by `/Users/mark/Property_Analytics/ops/cloudflare/ops-watch-ingest/wrangler.toml`, and is live at `https://ops-watch.venterrawebops.com`. Its ingest endpoint is `POST /v1/ops-watch/ingest`; its health endpoint returns `200` at `/health`. Applied remote D1 migration `/Users/mark/Property_Analytics/apps/api/migrations/0065_create_ops_watch_ingest_tables.sql`, mirrored in `/Users/mark/Property_Analytics/infra/migrations/042_create_ops_watch_ingest_tables.sql`, adding `ops_watch_ingest_runs`, `ops_watch_signals`, and `ops_watch_action_queue`. The Worker stores signed sanitized packets in R2 under `ops-watch/ingest/<source>/<run_id>.json`, normalizes accepted records into D1, and keeps repeated pushes idempotent through stable source/signal identity. Authentication is HMAC-SHA256 using `x-ops-watch-timestamp` and `x-ops-watch-signature` with Worker secret `OPS_WATCH_INGEST_SHARED_SECRET`; Keeper/KSM record `Ops Watch Ingest Shared Secret` now holds the source value at notation `keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password`, and the Worker secret was set from Keeper without creating a local secret file or direct-env secret path. Deployed Worker version `1f5e4ff5-a7fd-43c0-9a25-77bf72c413ba` through the Keeper-backed Wrangler helper. Health smoke passed, unsigned ingest fails closed, and live signed canary `ops-watch-ingest-canary-20260822-keeper` returned `ok:true`, wrote R2 key `ops-watch/ingest/intranet_it_help/ops-watch-ingest-canary-20260822-keeper.json`, and produced accepted D1 run/signal readback. Documentation outlets were reconciled after proof: root README, docs index, Cloudflare ops README, Worker README, Ops Watch runbook, Cloudflare offload plan, mirror/push ingest runbook, Keeper manifest, working memory, and capability register now point to the same live endpoint, storage contract, credential path, proof, and boundary. This lane does not give Cloudflare inward intranet access, does not create the internal exporter yet, does not publish Captain records, and does not execute actions.

08/22/2026 Data Pond venterrawebops migration and Cloudflare offload addendum: prepared and initially deployed the protected Data Pond app for migration to the corporate `venterrawebops.com` domain family. The target shape is web at `https://pond.venterrawebops.com` and API at `https://api.venterrawebops.com`, while existing `app.venterradev.com`, `app.venterraliving.com`, and `launch.venterrawebops.com` remain accepted during migration. Updated `/Users/mark/Property_Analytics/apps/api/src/lib/frontend-origin.ts` and `/Users/mark/Property_Analytics/apps/api/src/index.ts` so the new hosts are accepted origins and receive `.venterrawebops.com` session cookies, updated `/Users/mark/Property_Analytics/apps/web/.env.production` to target `https://api.venterrawebops.com` with Cloudflare primary auth, and added `/Users/mark/Property_Analytics/apps/api/test/auth/cloudflare-bootstrap.test.ts` coverage for the new Cloudflare Access bootstrap/cookie boundary. Created Cloudflare Access apps for the new main app, API bootstrap, admin, and protected API path surfaces. Main app and API bootstrap allow `venterraliving.com` and `venterra.com` email domains; admin/protected API path apps mirror Mark-only access. Deployed API Worker `pop-brief-api` version `d533ebfc-a599-4920-b50a-3e3de572bfea` with both `api.venterradev.com` and `api.venterrawebops.com` custom domains. Deployed web Pages project `property-analytics` to `https://4dec4d06.property-analytics.pages.dev` and attached `pond.venterrawebops.com` through proxied CNAME plus Pages custom domain registration. Smoke passed for both API `/health` endpoints and Cloudflare Access `302` protection on the new web root and API bootstrap route. Added `/Users/mark/Property_Analytics/docs/DATA_POND_VENTERRAWEBOPS_MIGRATION_RUNBOOK_2026-08-22.md` for Cloudflare DNS/Access/deploy/smoke steps. Added `/Users/mark/Property_Analytics/docs/OPS_WATCH_CLOUDFLARE_OFFLOAD_PLAN_2026-08-22.md` to define the recommended Cloudflare Workers Cron Trigger, Queue, Durable Object, D1, and R2 architecture for moving recurring read-only harvest/retry/state work out of local Codex wakeups. Browser Entra login, app-session creation, and first-time viewer auto-provision on the new host remain open validation.

08/22/2026 Ops Watch monitoring layer addendum: added `/Users/mark/Property_Analytics/config/ops_watch_sources.json`, `/Users/mark/Property_Analytics/scripts/build_ops_watch_packet.py`, `/Users/mark/Property_Analytics/scripts/build_confluence_ops_watch_packet.py`, and `/Users/mark/Property_Analytics/docs/OPS_WATCH_RUNBOOK_2026-08-22.md` as the governed cross-system monitoring layer for property-facing operational signals. Ops Watch treats Jira, Confluence, Microsoft 365, and Captain Runtime as source lanes feeding local read-only packets before any publish/action step. Jira is an active harvest lane through the existing Atlassian Rovo connector and Jira Captain Watch builder; Confluence is now an active source-signal lane for ITSM/IAM/Microsoft 365/access-process pages; Outlook, Teams, and SharePoint/OneDrive are formally represented as Microsoft Graph lanes blocked pending Keeper/KSM notation setup; Captain Runtime publish remains review-required. Added `/Users/mark/Property_Analytics/utils/ms365_graph_auth.py`, `/Users/mark/Property_Analytics/scripts/smoke_ms365_graph_oauth.py`, and `/Users/mark/Property_Analytics/docs/MS365_GRAPH_OAUTH_SETUP_RUNBOOK_2026-08-22.md` as the Keeper-first Microsoft Graph OAuth scaffold for client-credentials token acquisition and sanitized smoke testing. The helper resolves tenant id, client id, client secret, and mailbox user only through Keeper notation env vars, does not create local token files, and currently fails closed because `KSM_MS365_TENANT_ID_NOTATION` is not set; a sanitized Keeper title/folder scan found no existing Microsoft 365 / Graph / Outlook / Teams / SharePoint record mapped for this lane. First Confluence packet `/Users/mark/Property_Analytics/reports/ops_watch/confluence_ops_watch/confluence-ops-watch-20260822-current/` reviewed `10` Confluence source pages and produced `10` source signals, including `6` high identity/access signals and `0` property-linked Captain records. Current combined Atlassian packet `/Users/mark/Property_Analytics/reports/ops_watch/ops-watch-20260822-atlassian-current/` reports `2` active harvest sources and includes `14` current Captain records across `12` properties from the Jira packet, with `13` critical records, `5` pending-vendor records, `5` stale `14+` day records, and `0` unresolved property records. No Jira, Confluence, Microsoft 365, D1, Captain Runtime, Cloudflare, or locked PIB mutation was performed.

08/22/2026 Jira Captain Watch bridge addendum: added `/Users/mark/Property_Analytics/scripts/build_jira_captain_watch_packet.py` and `/Users/mark/Property_Analytics/docs/JIRA_CAPTAIN_WATCH_RUNBOOK_2026-08-22.md` as the governed non-mutating path from Jira issue search output into Captain property awareness. The builder treats Jira as the external work-order source and Captain Runtime as the property awareness/action/proof surface. It uses Jira property field `customfield_10106` first, resolves all property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`, and optionally adds summary/description property mentions so one Jira issue can inform multiple Captains. Artifacts are JSON, Markdown, CSV, and optional reviewed SQL upserts for the existing `captain_watch_items` and `captain_actions` tables. First local packet `/Users/mark/Property_Analytics/reports/captains_log/jira_ticket_watch/jira-captain-watch-20260822-current/` reviewed `12` active Jira issues assigned to Mark and produced `14` Captain records across `12` properties with `0` unresolved property records. No Jira comments, Jira edits, Jira transitions, D1 publish, Captain Runtime mutation, Cloudflare deploy, recurring automation, or locked PIB changes were performed.

08/22/2026 Resi partner feedback addendum: Grady/Resi replied positively to the API findings and clarified that the Resi API is still beta but available for continued exploration. The response confirms the current architectural split used by the Resi Content Bridge: V2 is the management/content layer, while website cache clearing remains a V1 API capability and is not yet available in V2. Resi also strengthened the media boundary: Venterra should not update media through the API for now because media assets sync from Venterra feeds and Resi is still defining how API activity should interact with external syncing rules. Incremental/change-detection support is in development; webhooks/event callbacks and activity logging are on the roadmap, likely paired with general Resi app activity logging. Until those features mature, Data Pond inventory snapshots and `pond_content_change_requests` remain Venterra's local audit/change ledger. Next partner collaboration should focus on cache semantics, stable public-delivery ids, incremental sync, nested content-block update semantics, media/feed sync behavior, activity logging, and safe next canary object types.

08/22/2026 Resi Content Bridge agent-primer addendum: added `/Users/mark/Property_Analytics/docs/RESI_CONTENT_BRIDGE_AGENT_PRIMER_2026-08-22.md` as durable future-agent context for the expected heavy Data Pond integration. The primer packages the Resi V2/V1 API split, Keeper/KSM credential discipline, Data Pond table model, known inventory/proof run IDs, field editability classes, bridge commands and confirm phrases, The Vine proof chain, Grady/Resi partner feedback, future Pond UI/Captain/group/supervisor/VACS/Site Content operating model, object-type caution, API-vs-website proof layers, stop rules, required checks, and communication nuance. The runbook `/Users/mark/Property_Analytics/docs/RESI_CONTENT_BRIDGE_RUNBOOK_2026-08-21.md` and integration doc `/Users/mark/Property_Analytics/docs/RESI_CONTENT_INVENTORY_DATA_POND_INTEGRATION_2026-08-20.md` now point agents to the primer before extending the bridge or building Pond-facing edit workflows.

08/22/2026 Resi Edge optimization prep readiness addendum: extended `/Users/mark/Property_Analytics/scripts/build_resi_edge_optimization_prep_readiness.py` as the canonical read-only prep packet builder for the first `20` live vanity-domain optimization candidates. The builder now joins Phase 2 draft manifests, active manifests, manifest-prep source gaps, Ahrefs vanity project readback, live root analytics signals, GET-based expected-page checks, expanded vanity QA, and PSI progression across legacy, Kinsta staging, and live vanity stages. Latest packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/optimization-prep/optimization-prep-20260822T200317Z/` reports expected page shape clean for `20/20`, Ahrefs Web Analytics data-key presence for `20/20`, vanity QA green for `19/20`, active manifest/static pass for `1/20`, old Heap `676880719` still present for `20/20`, expected Heap `286627304` present for `19/20`, and `HEAP_JS_DEBUG=true` present for `20/20`. This was evidence preparation only: no DNS, forwarding, WordPress/Kinsta, Resi API, Cloudflare Worker, Zaraz, GA4, Ahrefs, R2, cache, or locked PIB mutation was performed.

08/21/2026 Resi Heap production-id guard addendum: Mark provided the Resi production Heap native reference snippet, which uses app id `286627304` and loads `https://cdn.us.heap-api.com/config/286627304/heap_config.js`. Existing Resi Edge manifests and analytics smoke defaults already use `286627304`, so the snippet is now treated as audit/source evidence for the correct production Heap id, not as authorization to paste a direct native Heap loader into Resi Edge packages. `/Users/mark/Property_Analytics/scripts/smoke_live_analytics.py` now extracts observed Heap app ids from script and network evidence and fails when any observed id differs from the expected `--heap-app-id` value, default `286627304`. `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md` records that any native Heap id other than `286627304` is a cleanup finding unless Mark approves a current-task exception. Zaraz remains the analytics owner for Resi Edge, and Heap/Contentsquare remains interaction-gated with passive proof requiring zero Heap/Contentsquare network before user intent.

08/21/2026 Resi Edge launch dashboard expanded vanity-page QA addendum: Mark correctly caught that the first 08/21/2026 vanity QA packet `/Users/mark/Property_Analytics/reports/domain_ops/20260821_091852_vanity_qa/` was too narrow because it checked the legacy redirect-import shape (`root`, `/reviews/`, `/gallery/`) rather than the actual new Resi site page surface. The collector at `/Users/mark/Property_Analytics/scripts/domain_ops/build_resi_edge_vanity_qa.py` now discovers same-domain homepage/core navigation links and checks each core vanity page for `200`, vanity-host hold, vanity canonical, title, and indexability. Anatole canary evidence `/Users/mark/Property_Analytics/reports/domain_ops/20260821_143825_anatole_full_vanity_qa/ANATOLE_FULL_CANARY_READOUT.md` passed `12/12` discovered core pages. Current expanded full-batch evidence `/Users/mark/Property_Analytics/reports/domain_ops/20260821_143906_vanity_qa/` reports `19` green, `1` yellow, `0` red; root routing, vanity hold, vanity canonical, page indexability, robots general-search indexability, mobile smoke, and legacy redirects are green for `20/20`; `251` core vanity pages were checked, with `250` clean and `1` yellow. The single automated open item is Axial Buckhead `/contact/`, which returns `200` but emits `follow, noindex` and no canonical. `/Users/mark/Property_Analytics/scripts/build_resi_edge_launch_dashboard_snapshot.py` and the governed `apps/web` dashboard now carry core-page QA counts. Dashboard-only Cloudflare Pages deployment `https://75056d4e.resi-edge-launch.pages.dev` is live behind `https://launch.venterrawebops.com/`; live mocked-auth proof confirmed `VANITY QA 19/20`, `CORE PAGES 250/251`, `RED ISSUES 0`, and the updated current-truth statement. Superseding test-run checklist evidence lives at `/Users/mark/Property_Analytics/reports/domain_ops/20260821_143906_vanity_qa/NEXT_TEST_RUN_PACKET.md`; live proof screenshot is `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-expanded-qa-live-20260821.png`. This was dashboard/evidence work only: no property DNS, forwarding, WordPress/Kinsta, GA4, Ahrefs, Zaraz, R2, cache, property Worker, or locked PIB mutation was performed.

08/21/2026 Resi Edge common topper/full-nav contract addendum: Mark approved the common topper direction as one governed canonical template fed by property-specific manifest tokens. Planning doc `/Users/mark/Property_Analytics/docs/RESI_EDGE_COMMON_TOPPER_TEMPLATE_PLAN_2026-08-21.md` enumerates common-owned shell behavior and token-owned property data across identity, routing, layout, theme, fonts, promo, hero, reviews, navigation, content blocks, phone/source attribution, analytics, SEO, evidence, and rollback. This addendum supersedes the 08/20/2026 five-link payload optimizer note: the drawer limiter hid valid manifest navigation and is no longer allowed. `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` now renders the full `mobile_shell.navigation.links[]` manifest list in order, while `/Users/mark/Property_Analytics/scripts/validate_resi_edge_package_static.mjs` forbids `DEFAULT_DRAWER_LINK_LIMIT`, drawer priority slicing, and slice-based nav reduction. The mobile shell uses compact-only consent injection so the visible cookie icon and bounded `Preferences`/`Accept` pill remain while District stays under the byte gate. `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` browser-proves manifest/rendered drawer label parity and per-link Heap/Zaraz attributes. District (`FL4DU`, `thedistrictuniversal.com`) clean stage `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/stage-20260821T135211Z/` passed with `apply_allowed:true`, byte forecast `39,399`, and `11` drawer links rendered; final apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260821T135707Z/` passed `55/55` gates with no rollback, mobile PSI `100`, desktop native passthrough PSI `84`, WordPress control-path bypass, consent/browser proof, Zaraz/GA4/Heap proof, full drawer proof, R2/cache/SEO/source-phone proof, and `70` evidence files.

08/20/2026 Resi Edge District desktop pass-through recovery addendum: The District Universal Boulevard (`FL4DU`, `thedistrictuniversal.com`) is now current on the governed Resi Edge package after the previous browser-acceptance rollback exposed a shared desktop pass-through firewall edge case. Direct desktop browsing returned native HTML and stylesheets, but Worker-origin desktop pass-through used raw `fetch(request)` and triggered the Resi firewall `403`. The canonical runtime `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` now sends desktop native pass-through through `buildOriginRequest(request, { forceHomepage: false })` with browser-like navigation headers and Cloudflare cache overrides disabled; native continuation still forces the homepage by default, and no desktop topper was introduced. Static validation now fails if this normalized desktop pass-through contract is removed. District stage `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/stage-20260821T012705Z/` passed with `apply_allowed:true`; final apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260821T012755Z/` passed `55/55` gates with no rollback, mobile PSI `100`, desktop native passthrough PSI `97`, WordPress control-path bypass, Zaraz/GA4/Heap proof, consent proof, R2/cache/SEO/source-phone proof, and `70` evidence files.

08/21/2026 Resi Content Bridge addendum: the governed Resi live content apply lane is now named **Resi Content Bridge**. The command surface is `/Users/mark/Property_Analytics/scripts/resi_content_bridge.py`; the runbook is `/Users/mark/Property_Analytics/docs/RESI_CONTENT_BRIDGE_RUNBOOK_2026-08-21.md`. The bridge extends the 08/20/2026 Resi content inventory/Data Pond foundation instead of creating a second system: it resolves property identity through the governed matrix, uses latest Resi V2 property snapshots, checks property-object links from `resi_content_property_links`, records local `pond_content_change_requests` rows, applies minimal Resi V2 `PATCH` payloads only with the exact `APPLY_RESI_CONTENT_CHANGE` confirmation phrase, reads back V2 immediately, can request V1 property cache clear only with `CLEAR_RESI_CONTENT_CACHE`, and verifies V1 public delivery. Supported initial commands are `show-faq`, `read-v2-faq`, `apply-faq-answer`, `clear-property-cache`, and `verify-public-faq`. The first validated proof is The Vine Kyle Parkway (`TX4EK`) FAQ `Can I tour The Vine?`, Resi FAQ id `019ebdff-c18d-7195-80cc-e1e61b42e2df`, Resi property id `019e6750-98ae-732d-9ef2-f4839506787c`, change request `resi_faq_hard_hat_tx4ek_3d1e27857b7e`: Mark approved the Hard Hat Tours answer update, V2 patch/readback and V1 public delivery verification succeeded, Resi cache clear returned `202 Accepted`, and Mark confirmed browser-visible public-site rendering. The bridge does not mutate Resi host/admin, WordPress/Kinsta, Cloudflare, DNS, Resi Edge Workers, D1/KV, or PIB.

08/20/2026 Resi content inventory Data Pond foundation addendum: added a governed read-only Resi content inventory lane so Resi can be treated as an external live CMS/source system feeding the Data Pond content layer rather than a separate content workspace. New schema lives in `/Users/mark/Property_Analytics/apps/api/migrations/0064_create_resi_content_inventory_tables.sql` and `/Users/mark/Property_Analytics/infra/migrations/041_create_resi_content_inventory_tables.sql`, covering inventory runs, content objects, property impact links, field facts, changeability rules, cross-system bindings, and future change requests. New collector `/Users/mark/Property_Analytics/Data_Collection/collectors/resi_v2_content_inventory_collector.py` uses Keeper-backed Resi auth, GET-only collection, endpoint filters, media skipping, progress logging, and a property-link resolution pass through documented `property_id` filters. Resolved proof run `resi_content_3fb41752b3aa` used source property snapshot `resi_v2_bdf1c63ebece`, made `795` read-only GET requests, and captured `52,472` non-media content objects plus `140,673` field facts for account `Venterra`; media was intentionally skipped. The model binds Resi objects to Content Office, Site Content, VACS, and Captain/Navigator through `pond_content_system_bindings`, while proposed future edits must land in `pond_content_change_requests` before any explicit apply/readback path exists. Documentation lives at `/Users/mark/Property_Analytics/docs/RESI_CONTENT_INVENTORY_DATA_POND_INTEGRATION_2026-08-20.md`. No Resi writes, host/admin changes, Cloudflare/D1/KV publish, production Data Pond deploy, or PIB changes were performed.

08/20/2026 TowneStone inventory reinstatement addendum: Mark clarified that Townestone at 359 (`TX4FC`, `townestoneat359.com`) is no longer the protected example/reference and should fold back into live Resi Edge inventory. The active manifest `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/townestoneat359-com.manifest.json` now uses a live inventory mutation policy, current consent widget `compact_shell_pill_v29_2026_08_20`, fresh GSC inventory record `/Users/mark/Property_Analytics/reports/gsc_indexing/townestone/2026-08-20/townestone_gsc_indexing_evidence_2026-08-20.json`, and fresh Captain/Data Pond handoff `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/tx4fc_resi_edge_inventory_captain_handoff_2026-08-20.json`. Stage packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/townestoneat359-com/stage-20260821T000103Z/` passed with `apply_allowed:true`; final apply packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260821T000224Z/` passed `55/55` gates with no rollback, mobile PSI `100`, desktop native passthrough PSI `97`, WordPress control-path bypass, Zaraz/GA4/Heap proof, R2/cache/SEO/source-phone proof, and `70` evidence files.

08/20/2026 Resi Edge consent v29 responsive geometry addendum: District recovery exposed that the prior shell payload optimizer's inline JS minifier was too aggressive: it removed spaces inside CSS descendant selectors embedded in the shared consent script, so the compact consent root fit the viewport but its child icon/button compact styles did not apply. The canonical runtime now uses safer inline JS minification that preserves selector/string semantics, and the shared consent widget is versioned as `compact_shell_pill_v29_2026_08_20`. The v29 pill keeps the cookie icon visible, uses a subdued `Preferences` action, and bounds compact action widths so `Preferences` and `Accept` remain in-viewport and hit-testable. Added `/Users/mark/Property_Analytics/scripts/validate_resi_consent_widget_geometry.mjs` and wired it into `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` deploy-bundle validation after byte forecasting. Non-live v29 bundle preflight passed for Champions, Ventana, Harrison, District, Calais, Vine, and TowneStone, including byte forecast and local consent geometry proof. Superseding update: District later passed final live apply after source access recovered and desktop pass-through was normalized; the v29 consent guard remains active.

08/20/2026 Resi Edge shell payload optimizer addendum: the canonical Resi Edge runtime now identifies as `2026-08-20.shell-payload-optimizer-v1` and folds the Harrison/Champions byte-limit lesson into the shared package instead of per-manifest trims. `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` compacts same-origin manifest URLs to relative shell links, limits mobile drawer rendering to the governed five essential links, and minifies safe tag-boundary whitespace before response. External leasing/tour/apply URLs remain absolute. Added `/Users/mark/Property_Analytics/scripts/forecast_resi_edge_mobile_shell_bytes.mjs` and wired it into `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` deploy-bundle validation so stage/apply packets forecast generated mobile shell bytes and block before live apply when forecast bytes exceed `40,000`. Static validation now enforces URL compaction, drawer payload limiting, shell minification, and byte-forecast wiring. Harrison stage packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/stage-20260820T201306Z/` passed with runtime `2026-08-20.shell-payload-optimizer-v1`, forecast `37,425` initial HTML bytes, `5` drawer links, and no live route change. Verification passed across the seven current rollout manifests, runner compile, gate coverage, PIB guardrails, context discipline, and property identity governance.

08/20/2026 Resi V2 API read-only source lookup addendum: Mark confirmed the Resi API invitation and pointed to the public docs. The V2 management API uses `https://v2.getresi.com/api/v2` with a Bearer token, while V1 remains the public delivery layer. The local Keeper record `Resi Server API Token` was verified through `keeper://2tuAKQVuBYqp0PCipUQUyw/field/password` without exposing secret material. Added `/Users/mark/Property_Analytics/utils/resi_auth.py` for Keeper-backed token resolution and `/Users/mark/Property_Analytics/Data_Collection/collectors/resi_v2_collector.py` for read-only paging of `/me`, `/properties`, and `/lead-sources`. Added raw local snapshot schema in `/Users/mark/Property_Analytics/apps/api/migrations/0063_create_resi_v2_api_snapshots.sql` and `/Users/mark/Property_Analytics/infra/migrations/040_create_resi_v2_api_snapshots.sql`. The governed source lookup builder at `/Users/mark/Property_Analytics/scripts/build_resi_source_lookup_table.py` now supports `--source resi-v2` and `--use-latest-snapshot` while preserving the legacy ThirtyLines default path. Local V2 proof on 08/20/2026 produced snapshot `resi_v2_bdf1c63ebece` for account `Venterra`, with `98` properties and `1,168` lead sources; final lookup run `resi_source_lookup_f6d22473bea2` generated `1,142` de-duplicated source rows across `93` properties. Existing resolver tests passed against the new KV artifact, D1 publish passed in dry-run mode only, PIB guardrails passed, and property identity governance passed. No Resi API writes, Resi host/admin changes, D1/KV publish, Cloudflare/Worker/DNS/deploy/cache mutation, or locked PIB changes were performed.

08/20/2026 Resi Edge dashboard performance progression addendum: after the first `20` vanity domains were officially moved and legacy redirects were confirmed, the protected launch dashboard was updated to show a visual per-property speed story from Legacy starting point to Kinsta staging to Live Vanity current site to Optimized future target. `/Users/mark/Property_Analytics/apps/web/src/app/resi-edge/launch/launch-dashboard-client.tsx` now renders the four-stage progression with mobile and desktop PSI scores directly beneath each stage link; live vanity scores are captured from the post-move benchmark, and optimized scores are shown only as future targets (`90+` mobile, `95+` desktop). `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/generated-snapshot.ts` and `/Users/mark/Property_Analytics/scripts/build_resi_edge_launch_dashboard_snapshot.py` no longer describe final vanity PSI as `held_until_switch`; status is `captured`. Dashboard-only Cloudflare Pages deployment `https://771de74d.resi-edge-launch.pages.dev` was published behind `https://launch.venterrawebops.com/` using the Keeper-backed Wrangler path. Verification passed with launch-host production build, PIB guardrails, context discipline, Playwright live proof screenshot `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-performance-journey-live-scores-custom-host-20260820.png`, and clean custom-host Magic Link proof. No property DNS, forwarding, Worker, WordPress/admin path, Zaraz, GA4, Ahrefs, R2, cache rule, or live property domain mutation was performed by this dashboard pass.

08/19/2026 Resi Edge vanity QA collector addendum: added `/Users/mark/Property_Analytics/scripts/domain_ops/build_resi_edge_vanity_qa.py` as a reusable read-only QA collector for the first `20` launch vanity domains. It consumes the governed launch snapshot and writes a packet with root/www routing, vanity canonical, page robots, robots.txt general-search posture, sitemap, metadata, CTA/tel signals, placeholder text, Kinsta leakage, and Playwright mobile smoke screenshots. Final packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_120423_vanity_qa/` reports `19/20` green, `1/20` yellow, `0` red, with root `200`, vanity hold, vanity canonical, page indexability, robots general-search indexability, and mobile smoke all `20/20`. The only open automated issue is Axial Buckhead's title placeholder. A parser lesson was captured: Cloudflare-managed robots sections can block AI/training crawlers with `Disallow: /` while still allowing search indexing through the `User-agent: *` group, so QA must scope robots decisions by crawler group. The protected launch dashboard was updated to show `Vanity QA 19/20` without claiming public move/legacy redirect completion; dashboard-only Pages deployment is `https://da33fc4c.resi-edge-launch.pages.dev`. No property DNS, forwarding, Worker, WordPress, Zaraz, GA4, Ahrefs, R2, or cache mutation was performed by this QA/dashboard pass.

08/18/2026 Resi Edge mobile shell Heap attribution guard addendum: Mark identified a portfolio-launch analytics gap where mobile menu/topper links were visually correct but not carrying differentiated Heap-ready attributes, and Heap environment variables needed to be preserved in the header. The shared Resi Edge runtime at `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` now identifies as `2026-08-18.heap-env-tracked-shell-v3` and emits stable `data-vtr-track`, `data-vtr-action`, `data-vtr-surface`, `data-vtr-element`, `data-vtr-destination`, `data-vtr-label`, source-code, and phone attribution metadata across promo, header, drawer, drawer navigation, hero, review, and content-block CTA elements. Drawer nav links use stable slug/index identifiers so mobile links are distinguishable in Heap/Zaraz event payloads. A canonical `data-vtr-heap-environment` header script now preserves/supplies `window.__vtrHeapEnvironment`, `HEAP_APP_ID`, `HEAP_ENVIRONMENT`, `HEAP_MODE`, and `HEAP_JS_DEBUG` on the mobile shell, desktop native passthrough, and native continuation while direct WordPress `heap.load(...)` blocks remain stripped so Cloudflare Zaraz remains the analytics owner. The runner/browser proof at `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` now validates Heap environment preservation, required tracked shell elements, complete per-element attributes, unique element IDs, and actual drawer open/close event payloads before the event bridge gate can pass; static package validation fails if those guards are removed. Verification passed for runtime syntax, runner compilation, static package validation across governed pilot manifests, gate coverage, and a non-mutating District plan. No live domain, Worker route, WordPress/admin/control path, Zaraz, Ahrefs, GA4, R2, or cache mutation was performed for this hardening pass.

08/18/2026 Resi Edge Ventana v4 stopped apply addendum: The v3 Heap attribution implementation was immediately superseded by `2026-08-18.heap-env-lean-tracking-v4` after Ventana live proof showed the separate Heap environment script and redundant tracking attributes pushed the mobile shell over contract limits. The shared runtime now folds Heap environment preservation into the existing package-owned analytics header script, trims `data-vtr-label` and `data-vtr-href`, and keeps differentiated action/surface/element/destination attributes for Heap/Zaraz event payloads. The mobile-shell validator allows only this package-owned passive Heap environment marker while continuing to block direct `heap.load`, GTM, native Contentsquare loaders, and direct WordPress analytics. Local Ventana render measured `37,117` initial HTML bytes and `7` scripts with Heap environment present and no direct analytics loader. The source audit now reads `target.governed_reference_url` without following redirects so legacy Venterra-to-vanity movement is captured before the vanity host is live. Ventana plan `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/plan-20260818T224607Z/` and stage `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/stage-20260818T224619Z/` passed, but apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260818T224846Z/` stopped before Worker deploy or route probe because the governed Zaraz analytics package call hit Cloudflare API `RemoteDisconnected`. The Zaraz analytics helper now retries `http.client.RemoteDisconnected` and `ConnectionResetError`. Mark then directed retrying the failed step: targeted retry `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/zaraz-retry-20260818T2324/zaraz-analytics-package-apply.json` passed unchanged, proving the prior API error transient. The next governed apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T004833Z/` deployed the package and passed mobile shell, route/package, control-path, consent, event bridge, R2/cache setup, then stopped at browser acceptance because desktop native proof returned `403` with zero stylesheets from the current vanity/origin protection state. The runner rolled back Worker `resi-edge-canonical-ventanaapts-com`, and readback confirms the Worker does not exist. Ventana is not live from this v4 run.

08/18/2026 Resi Edge Ventana v4 final apply addendum: After the Resi/Kinsta firewall allowlist was corrected for public GET requests, Ventana final v4 apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T010413Z/` passed `55/55` gates with no rollback. Live health reports `runtime_version: 2026-08-18.heap-env-lean-tracking-v4`, release token `2026-08-13.townestone-promo-bar-v2`, manifest `Ventana`, and `desktop_topper_allowed:false`. The proof includes route/package health, WordPress/admin/API control-path bypass, mobile shell contract, desktop native/no-topper, consent browser proof, GA4/Zaraz proof, Heap/Contentsquare interaction-only proof, Ahrefs proof, Cloudflare analytics state, R2/cache/SEO/source-phone proof, mobile PSI `100`, desktop native PSI `93`, Captain/Data Pond record, rollback plan, and evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T010413Z/evidence-packet.json` with `68` files. Post-apply GET probes passed for desktop Chrome, mobile Safari, and Googlebot-style requests with no firewall text and `x-vtr-resi-edge-package: 2026-08-18.heap-env-lean-tracking-v4`; a desktop `HEAD /` probe still returned the Resi firewall `403`, so the vendor firewall ticket should remain open for HEAD-method cleanup.

08/18/2026 Resi Edge consent v28 addendum: Mark selected the smaller consent pill shape for mobile shell views and asked for the cookie icon to remain visible with a subdued `Preferences` label. The shared consent widget contract is now `compact_shell_pill_v28_2026_08_18`: compact rendering follows the Resi Edge mobile-shell marker instead of only a narrow viewport breakpoint, uses a small visible cookie icon, keeps `Preferences` as the secondary action, and preserves the Zaraz-owned `Preferences -> zaraz.showConsentModal()` route. Static validation now fails if the compact shell marker/attribute behavior or icon requirement is removed. The first Ventana v28 apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T013311Z/` correctly rolled back because mobile initial HTML bytes exceeded the `40,000` budget (`40,449`). The widget was then optimized by replacing duplicated shell CSS with a compact pill data attribute and smaller inline SVG, recovering `844` source bytes. Final Ventana v28 apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T014351Z/` passed `55/55` gates with no rollback, mobile PSI `100`, desktop native PSI recorded `85`, and evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260819T014351Z/evidence-packet.json` with `68` files.

08/19/2026 Portfolio launch Kinsta DNS prep addendum: added a governed read-only DNS prep path for the first 20-property vanity-domain launch group. `/Users/mark/Property_Analytics/scripts/domain_ops/build_kinsta_dns_switch_prep.py` consumes the Resi/Kinsta CNAME CSV, resolves Cloudflare through Keeper, snapshots each zone's current DNS and SSL posture, and writes delete/add/review queues without mutation. Prep packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_141920_kinsta_dns_switch_prep/` found all `20` zones present/active, SSL mode `full`, Universal SSL not disabled, `46` planned website-record conflicts at apex/www, `40` missing proxied Kinsta CNAMEs, and `4` apex MX preserve/review rows on The Phoenix and Stonecreek Ranch. `/Users/mark/Property_Analytics/scripts/domain_ops/apply_kinsta_dns_switch.py` was added as the guarded execution path; it defaults to dry-run and requires explicit `--apply`. Dry-run packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_142149_kinsta_dns_switch_apply/` confirmed the exact planned delete/add counts with `mutations_performed:false`. This keeps DNS replacement packetized and avoids open-ended record cleanup before attribution and legacy forwarding.

08/18/2026 Resi Edge District live proof and preflight hardening addendum: The District Universal Boulevard (`FL4DU`, `thedistrictuniversal.com`) final apply packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260818T220039Z/` passed `55/55` gates with no rollback. Final proof includes mobile PSI `100`, desktop PSI `95`, canonical package health, no desktop topper, visual-viewport-safe Zaraz consent proof, WordPress/admin/control-path bypass, GA4/Zaraz realtime stream proof, Heap/Contentsquare interaction-only proof, Ahrefs proof, R2/cache/SEO/source-phone proof, Cloudflare analytics state, Captain/Data Pond record, rollback plan, and `68` evidence files. The failed prior District apply showed GA4 events were present under actual stream label `The District Universal Blvd`; the package now requires `analytics.ga4.expected_stream_name` in live-capable manifests, and existing pilot/canary manifests were backfilled from successful realtime evidence. The shared consent widget now fits mobile placement to `window.visualViewport`, and static validation blocks removal of that guard. These are shared package/process corrections, not property-specific Worker rebuilds.

08/18/2026 Resi Edge Harrison consent/control-path correction addendum: The Harrison (`GA4TH`, `theharrisonsandysprings.com`) exposed a package automation gap before the 08/19/2026 launch workflow. The Resi Edge contract already required `zaraz_consent_ready`, but `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` applied Zaraz analytics and then audited consent without first applying the governed consent package. The runner now calls `/Users/mark/Property_Analytics/scripts/apply_zaraz_consent_package.py --apply` during stage setup, records `zaraz_consent_package` evidence, and then runs the audit. Corrected stage evidence `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/stage-20260818T195206Z/` passed with `apply_allowed:true`. The follow-on live apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/apply-20260818T195246Z/` stopped at `wordpress_control_path_bypass_proven` and rolled back. Route/package health passed, but `/wp-login.php` proof captured no `wordpress_test_cookie`; rollback deleted Worker `resi-edge-canonical-theharrisonsandysprings-com`, and post-rollback read-only checks showed native `/__resi-edge/health` returned `404` and `/wp-login.php` again set the WordPress test cookie. The canonical Worker now makes protected WordPress/admin/API/control-path requests with only `redirect:"manual"` and no Cloudflare `cacheEverything`/`cacheTtl` override, and the static package validator fails if those cache overrides reappear in the transparent control-path helper. A second Harrison apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/apply-20260818T200101Z/` proved the corrected WordPress control-path bypass and all pre-PSI live gates, then rolled back at PSI because Google PSI no-scored exact mobile samples while fresh mobile samples scored `100` and desktop scored `96`. The runner now keeps scored live samples below target as blocking but does not fail solely because of a provider no-score exact sample when fresh/live mobile evidence meets the `98` parity target; provider no-score samples remain recorded in the retry log. Final Harrison apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/apply-20260818T201647Z/` passed `55/55` gates with no rollback, mobile PSI `100`, desktop PSI `91`, WordPress control-path proof, consent browser proof, analytics proof, R2/cache/SEO/source phone proof, and evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/theharrisonsandysprings-com/apply-20260818T201647Z/evidence-packet.json`. These are shared package corrections, not property-specific Worker rebuilds.

08/18/2026 The Vine Hard Hat Tours live correction addendum: The Vine Kyle Parkway (`TX4EK`, `thevinekyle.com`) was updated through the governed Resi Edge `stage -> apply --require-live-proof` path for the current Hard Hat Tours promo and Tour CTA. The final evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260818T170815Z/evidence-packet.json` passed `55/55` gates with no rollback, mobile PSI `99`, desktop PSI `99`, live shell proof, Zaraz-owned analytics proof, R2/cache proof, source-phone proof, SEO proof, and direct live readback of the full `https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4EK` URL for both the promo drawer `Schedule a Tour` CTA and header `Tour` button. The shared canonical runtime now preserves absolute external CTA URLs and identifies as `2026-08-18.external-absolute-cta-v1`; this was not a property-specific Worker rebuild. The WordPress control-path gate/runbooks were also clarified: native WordPress responses still pass, and an intentional uncached Cloudflare/Resi Website Management Firewall `401`/`403` passes only when no Resi Edge markers, no `x-vtr` headers, and no cache-hit behavior are present.

08/17/2026 Resi Edge launch dashboard Phase 0 addendum: added a static, read-only Resi Edge portfolio launch dashboard prototype in the governed `apps/web` surface at `/Users/mark/Property_Analytics/apps/web/src/app/resi-edge/launch/`, backed by typed mock snapshot data in `/Users/mark/Property_Analytics/apps/web/src/lib/resi-edge-launch/`. The dashboard is a proof surface, not a deploy/control surface: it has Executive and Operator modes for the Phase 2 `20`-property launch room, shows readiness, timeline, blockers, gate/source categories, evidence freshness, and next action, and uses the official Venterra palette. The protected host is now live at `https://launch.venterrawebops.com/`; there is no anonymous public version, and unauthenticated users are routed to magic-link login for `/resi-edge/launch`. `/resi-edge/launch` is configured as a protected Data Pond route with the normal app sidebar after authentication and is registered as a `Resi Edge Launch` sidebar surface under Routing Ops, so the Wednesday reveal can showcase the Pond framework while unrelated surfaces remain audience-scoped. Kinsta staging URLs are not included in the client bundle; staging is represented only as a high-level readiness gate. Hono remains future scope for a read-only snapshot service and no launch API routes were added. Verification passed with `npm run build` in `/Users/mark/Property_Analytics/apps/web`; Playwright screenshots live at `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-desktop-executive.png`, `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-desktop-operator.png`, and `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-mobile-executive.png`.

08/17/2026 Resi Edge Wednesday command-layer addendum: the Phase 0 dashboard was polished into a protected Wednesday command surface without adding API routes or mutation behavior. The typed mock snapshot now carries the Wednesday objective, protected audience statement, approval posture, command items, and stop rules; the first viewport frames the launch as an approval gate, not a launch button. Added the paired command packet `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_LAUNCH_WEDNESDAY_COMMAND_PACKET_2026-08-17.md`, which records completed setup evidence, open Wednesday gates, operating sequence, dashboard Phase 0 scope, and stop conditions for the 08/19/2026 launch room. It explicitly does not authorize deploys, DNS, Cloudflare, Worker, WordPress, Zaraz, cache, R2, Ahrefs, GA4, GSC/Captain/Data Pond, or live-domain mutation. Fresh visual proof after the command-layer polish lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-command-executive-desktop.png`, `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-command-operator-desktop.png`, and `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase0-dashboard-command-executive-mobile.png`.

08/17/2026 Resi Edge Wednesday readiness queue addendum: added `/Users/mark/Property_Analytics/scripts/build_resi_edge_wednesday_readiness_queue.py` as the local, non-mutating launch-room board builder. It reads the latest Phase 2 preflight, manifest prep, analytics profile, Ahrefs vanity project, Ahrefs legacy purge, and GA4 default URI evidence packets and writes JSON/CSV/Markdown under `/Users/mark/Property_Analytics/reports/resi_edge_performance/wednesday-readiness/`. First packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/wednesday-readiness/phase2-wednesday-readiness-20260817T204109Z/` reports `20` total properties, `0` ready, `0` ready for approval gate, `20` needs evidence, and `0` blocked. Setup coverage is `20/20` across Cloudflare active zone, Kinsta staging probe, Ahrefs vanity project, GA4 default URI, draft manifest, and source-phone lookup. Remaining pre-approval gates are source manifest closeout (`20`), GSC/Captain/Data Pond (`20`), and rollback snapshot (`20`). No external provider calls or mutations are performed by this builder.

08/17/2026 Resi Edge launch-host deployment addendum: after Mark explicitly approved making the dashboard live, deployed the static `apps/web` build to Cloudflare Pages project `resi-edge-launch`, attached custom hostname `launch.venterrawebops.com`, and added the proxied CNAME `launch.venterrawebops.com -> resi-edge-launch.pages.dev`. Final Pages deployment URL is `https://f03ead74.resi-edge-launch.pages.dev`. API Worker `pop-brief-api` was deployed at version `cb84a31a-0193-4363-bfeb-9bfeef8a65dc` only to support launch-host CORS, cookie-domain handling, and magic-link auto-provision path scoping. Live proof on 08/17/2026 confirmed Cloudflare custom domain status `active`, HTTP-to-HTTPS redirect, `/resi-edge/launch` `200`, launch-origin CORS preflight to `/v1/auth/magic-link` `204`, and Playwright entry checks showing `/` plus `/resi-edge/launch` land on `https://launch.venterrawebops.com/login?next=%2Fresi-edge%2Flaunch` with `MAGIC LINK PROTECTED`, `Company email required for access.`, and `Send Magic Link`. Evidence note: `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-host-deployment/launch-host-deployment-20260817T230925Z/summary.md`. This did not touch Resi Edge property Workers, WordPress/admin paths, Zaraz, Ahrefs, GA4, R2 assets, cache, property DNS, or property live-domain cutovers.

08/17/2026 Resi Edge launch magic-link session fix addendum: Mark reported that the email magic link flashed the dashboard and then returned to login, consistent with a cross-site session cookie handoff from `api.venterradev.com` back to `launch.venterrawebops.com`. The launch host now has Cloudflare Worker route `launch.venterrawebops.com/v1/* -> pop-brief-api`, and the static launch Pages build was redeployed with `NEXT_PUBLIC_API_BASE_URL=https://launch.venterrawebops.com`. Final fixed Pages deployment is `https://57beb60b.resi-edge-launch.pages.dev`. Browser proof showed root, `/resi-edge/launch`, and direct login auth checks calling only `https://launch.venterrawebops.com/v1/auth/me`, with no `api.venterradev.com` or Cloudflare Access bootstrap calls. This keeps launch-room auth same-origin and does not alter property launch systems.

08/17/2026 Resi Edge launch dashboard executive cleanup addendum: after Mark rejected the overloaded dashboard, the live launch surface was simplified into a one-column property move monitor with per-property drawers. The visible executive screen now shows only red/yellow/green status, original and new URL links, domain status, routing status, indexing conditions, analytics history, and launch prep. Internal package/topper/proof/gate/Worker/R2/Zaraz/GSC/Captain/static-prototype language is hidden from the dashboard UI, and launch-room sidebar production notes are suppressed. Final cleaned Pages deployment is `https://6ff5beb8.resi-edge-launch.pages.dev`. Visual proof screenshots live at `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-clean-v3-closed.png`, `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-clean-v3-drawer.png`, and `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-clean-v3-live-drawer.png`.

08/17/2026 Phase 2 GA4 credential refresh addendum: after Mark updated the Google API token/credential path, the governed Phase 2 GA4 setup/readiness lane was refreshed without mutation. Analytics profile packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260817T174839Z/` reports `20/20` GA4 profiles programmatic-patch-ready, `0` GA4 blockers, `20/20` Ahrefs vanity projects present, and `18` remaining legacy Ahrefs projects. GA4 default URI packet `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T174757Z/` read all `20` live streams and reports `20` planned `web_stream_data.default_uri` patches from Venterra apartment URLs to vanity domains, with `0` blocked and `0` already current. OK4AN canary dry-run packet `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T174905Z/` reports one planned patch and no blocker. A non-mutating edit-scope sanity check initialized the Keeper-backed GA4 service account with `analytics.edit` scope and read OK4AN stream `properties/383878732/dataStreams/5413338486`; this did not prove update permission. Initial OK4AN apply evidence `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T181257Z/` stopped with GA4 `PermissionDenied`, message `403 The caller does not have permission`, and no change. After Mark granted top-level GA4 Admin access to `venterra-query@venterra-property-analytics.iam.gserviceaccount.com`, dry-run `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T182543Z/` reported one OK4AN patch with `0` blockers. Mark approved the OK4AN apply canary; evidence `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T182603Z/` reports `patch_proven:true`, changing stream `properties/383878732/dataStreams/5413338486` from `https://venterraliving.com/apartments/anatole-at-norman/` to `https://anatoleatnorman.com/`. Post-check `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T182742Z/` confirmed OK4AN already current, and full dry-run `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T182756Z/` reported `1` already current, `19` planned patches, and `0` blocked. Mark then approved the remaining bulk apply. Fresh dry-run `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T185452Z/` confirmed `1` already current, `19` planned, and `0` blocked; apply evidence `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T185510Z/` patched the remaining `19` streams with every result `patch_proven:true`; final read-only post-check `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260817T185637Z/` reports `20` already current, `0` planned, `0` blocked, and no non-current rows. Refreshed analytics profile packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260817T185845Z/` now reports `20/20` GA4 no-change-needed/current, `20/20` Ahrefs vanity projects found, and `18` remaining legacy Ahrefs projects. Phase 2 GA4 default URI setup is complete; the lane changed only existing GA4 web stream `web_stream_data.default_uri` values and did not create/delete streams, alter events/conversions, touch Ahrefs/Zaraz/WordPress/Cloudflare/DNS, purge cache, or deploy Workers.

08/15/2026 Ahrefs legacy folder housekeeping addendum: the Phase 2 analytics policy now has a governed Ahrefs organization lane. `/Users/mark/Property_Analytics/scripts/build_ahrefs_legacy_folder_plan.py` reads the latest Phase 2 analytics profile plan, refreshes the Ahrefs roster through Keeper-backed credentials, and writes redacted JSON/Markdown/CSV evidence for moving retained Venterra-path source projects into a manually-created Legacy folder. Initial dry-run packet `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T180425Z/` found all `20` Phase 2 legacy Ahrefs projects, with `0` blockers and `20` waiting on Mark's Ahrefs Legacy folder ID. After Mark created the folder, dry-run packet `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T200829Z/` parsed folder ID `32616` and planned all `20` legacy moves with `0` blockers and `0` mutations; canary dry run `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T200839Z/` planned only Anatole at Norman (`10125566`) with `0` blockers and `0` mutations. Mark then approved the one-project canary apply: evidence `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T201848Z/` moved Anatole at Norman (`10125566`) to folder `32616` with HTTP `200` and readback `move_proven:true`. Mark then approved the bulk move: evidence `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T205455Z/` moved the remaining `19` legacy projects into folder `32616`, every apply result read back `move_proven:true`, and no failures were recorded. Final full dry-run readback `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T205630Z/` reports `20` already in Legacy, `0` planned moves, and `0` blockers. This preserves the rollout distinction between new/current vanity-domain Ahrefs projects and retained legacy Venterra-path projects for historical queries.

08/15/2026 Phase 2 Ahrefs vanity project creation addendum: added `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_ahrefs_vanity_project_plan.py` so Phase 2 vanity project creation is scoped to the launch cohort rather than the whole identity matrix. The script reads the Phase 2 analytics profile packet, refreshes Ahrefs through Keeper-backed credentials, supports `--only-property-code` canaries, masks raw Ahrefs Web Analytics data keys, requires `--apply --confirm CREATE_PHASE2_AHREFS_VANITY_PROJECTS`, and stops on the first failed create/readback. Dry-run packet `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233416Z/` planned `20` vanity project creates with `0` blockers. Canary apply `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233429Z/` created Anatole at Norman (`OK4AN`) vanity project `10240452`, with `create_proven:true`. Bulk apply `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233545Z/` created `17` more vanity projects, then stopped on Balmoral Village (`GA4BV`) with Ahrefs HTTP `403`, response `Projects limit reached`; The Whitney (`GA4TW`) was not attempted. Final read-only packet `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233835Z/` reports `18` existing vanity projects, `2` planned creates (`GA4BV`, `GA4TW`), and `0` duplicate blockers. Do not continue Ahrefs vanity creation until the project-limit decision is resolved.

08/15/2026 Ahrefs capacity test and Phase 2 vanity completion addendum: after Mark clarified that legacy projects should be purged to clear project capacity, added `/Users/mark/Property_Analytics/scripts/build_ahrefs_legacy_project_purge_plan.py`. It scopes deletion to projects currently in the configured Legacy folder, uses Ahrefs `DELETE /v3/management/projects` with `project_ids`, masks raw Ahrefs Web Analytics data keys, requires `--apply --confirm PURGE_AHREFS_LEGACY_PROJECTS`, and proves deletion by absence from readback. Capacity test dry run `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_project_purge/ahrefs-legacy-project-purge-20260815T234611Z/` targeted only Legacy-folder projects `10125566` and `10125770`; apply evidence `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_project_purge/ahrefs-legacy-project-purge-20260815T234619Z/` deleted both with HTTP `200` and `delete_proven:true`. Remaining-create evidence `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T234658Z/` then created Balmoral Village (`GA4BV`) vanity project `10240483` and The Whitney (`GA4TW`) vanity project `10240484`, both with `create_proven:true`. Final readback `/Users/mark/Property_Analytics/reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T234731Z/` reports `20/20` Phase 2 vanity projects present, `0` planned creates, and `0` blockers. Legacy purge readback `/Users/mark/Property_Analytics/reports/ahrefs_admin/legacy_project_purge/ahrefs-legacy-project-purge-20260815T234731Z/` reports `18` Legacy-folder projects still available to purge. Live roster count after the capacity test is `123` total projects, `18` in Legacy folder `32616`, and `20/20` Phase 2 vanity projects present.

08/15/2026 Phase 2 GA4 default URI dry-run addendum: refreshed the Phase 2 analytics profile plan after Ahrefs capacity cleanup. Packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260816T000844Z/` reports `20/20` Ahrefs vanity projects found, `0` new Ahrefs projects planned, `18` remaining legacy source projects, and `20/20` GA4 web streams patch-ready. Added `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_ga4_default_uri_plan.py`, which reads the Phase 2 analytics packet, refreshes live GA4 stream state through Keeper-backed GA4 Admin read scope, supports `--only-property-code` canaries, and applies only with `--apply --confirm PATCH_PHASE2_GA4_DEFAULT_URIS`. Full dry-run packet `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T001028Z/` reports `20` planned web-stream default URI patches, `0` already-current, and `0` blockers. Canary dry run `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T001029Z/` scopes to OK4AN only with `1` planned patch and `0` blockers. Mark approved the OK4AN canary apply; evidence `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T003544Z/` stopped with GA4 `PermissionDenied`, message `403 The caller does not have permission`, `patch_proven:false`, and no after-state. Read-only refresh `/Users/mark/Property_Analytics/reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T003710Z/` confirms OK4AN remains unchanged and planned. Do not continue GA4 patching until the service account has edit permission or an approved alternate Keeper-backed GA4 Admin credential is added.

08/15/2026 Calais public noindex header mitigation addendum: Calais Midtown public subpages were confirmed to receive `x-robots-tag: noindex, nofollow, nosnippet, noarchive` from the upstream WordPress/Kinsta response while the HTML meta robots tag remained indexable. This is an upstream SEO/header defect, not an edge-authored noindex. The Calais Worker now applies a temporary public-page mitigation in `/Users/mark/Property_Analytics/ops/cloudflare/calais-resi-edge-candidate/worker.js`: `passThroughNativeCleanHtml()` strips the upstream `x-robots-tag` only for public indexable HTML and adds `x-vtr-calais-origin-robots-stripped: 1` as proof. Preview, native continuation, WordPress login/admin/API/control paths, and non-`GET`/`HEAD` requests are unchanged and keep their intended noindex/control behavior. Deployed marker is `2026-08-15.calais-mobile-shell-v28-strip-origin-noindex`, Worker version `a9ced6ec-681f-4379-b2ff-8fcfdd506883`. The source fix remains WordPress/Kinsta removal of the bad header.

08/14/2026 Resi Edge phase 2 launch prep addendum: added the non-mutating preparation record `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_LAUNCH_PHASE_2_PREP_2026-08-14.md` for the next portfolio launch phase. The plan formalizes Worker/cache policy by path class: internal edge routes may stay Worker-owned, WordPress/admin/control paths and non-`GET`/`HEAD` requests must transparently bypass public optimization with no cache mutation, mobile homepage remains no-store shell, desktop remains native/no-topper passthrough, and native continuation remains private/no-store. The cohort readout builder at `/Users/mark/Property_Analytics/scripts/build_resi_edge_cohort_readout.py` now compares existing evidence ledgers to the current contract before marking rows ready. A non-mutating readout at `/Users/mark/Property_Analytics/reports/resi_edge_performance/cohort-readouts/resi-edge-cohort-readout-20260814T234845Z.md` reports `0` ready and `4` needing attention because existing live pilot packets predate `wordpress_control_path_bypass_proven`. This is a batch-readiness guard, not a live failure claim. The rollout stays capped at the pilot set until Mark approves fresh current-contract proof, starting with Townestone canary refresh, then Champions, Ventana, and The Vine before District or any 20-property batch.

08/14/2026 Resi Edge WordPress control-path bypass addendum: Calais Midtown exposed a required architectural boundary for all Resi Edge Workers in front of WordPress. Public marketing pages may use edge shell rendering, cleanup, analytics ownership, cookie stripping, and cache policy changes; WordPress control paths must not. The local incident record is `/Users/mark/Property_Analytics/docs/RESI_EDGE_WORDPRESS_CONTROL_PATH_BYPASS_2026-08-14.md`. The canonical Worker at `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js` now preserves transparent origin behavior for `/wp-login.php`, `/wp-admin`, `/wp-admin/*`, `/wp-json`, `/wp-json/*`, `/xmlrpc.php`, `/wp-cron.php`, `/wp-comments-post.php`, and non-`GET`/`HEAD` requests with `redirect: "manual"` and no cache mutation. The package contract now includes `wordpress_control_path_bypass_proven`; the governed runner proves the WordPress test cookie, native admin redirect, and native REST JSON response after deploy and rolls back if the proof fails. Static package validation and gate coverage also enforce the implementation, so future package changes cannot silently reintroduce the Calais admin/login failure.

08/14/2026 Vine lease-up safe-width SVG cap addendum: the Vine one-line lease-up tagline was corrected after visual review showed the `92vw` SVG cap was mathematically aligned to the headline but visually unsafe for script flourishes. The controlling live proof is now `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T200433Z/`, which passed `54/54` gates with no rollback, mobile PSI `100`, desktop native/no-topper PSI evidence `97`, and browser geometry showing the property tagline SVG at `343.1875px` wide within a `390px` viewport. The Vine manifest now uses `mobile_shell.hero.title_svg_max_width_vw: 88`, the shared runtime exposes `--hero-title-max-width`, the runner's hero-title contract accounts for the cap, and the manifest schema rejects property SVG max-width values above `90vw`. This is a shared package/template safeguard only; no property-specific Worker fork, desktop topper, desktop visual mutation, or manual workaround was introduced.

08/14/2026 Vine lease-up SVG/headline correction addendum: the earlier Vine promotion packet was superseded by `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T165403Z/` after visual review required tighter lease-up tagline/headline composition. The corrected live run passed `54/54` gates with no rollback, mobile PSI `100`, desktop native/no-topper PSI evidence `98`, compact consent v27, Zaraz-owned analytics, R2/cache proof, SEO/AI proof, and browser first-view proof. The canonical manifest schema/runtime now support optional `mobile_shell.hero.headline_lines` so line breaks are data-driven while `headline` remains the metadata/accessibility source. The property tagline SVG geometry gate now accounts for the shared runtime's `84vw` mobile CSS cap, and the R2 uploader retries transient Wrangler/R2 upload failures inside the canonical helper.

08/14/2026 The Vine current-token promotion addendum: The Vine Kyle Parkway (`TX4EK`, `thevinekyle.com`) was promoted into the current Resi Edge v2 live cohort with release token `2026-08-13.townestone-promo-bar-v2`. Final evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T155218Z/`; authoritative `apply-readout.json` passed `54/54` contract gates with no failed required gates and no rollback. The Vine proves the package flexibility path for lease-ups: brand color `#4E343F`, native first-party font data, sourced award/content blocks, no invented review row, compact finalized consent, Zaraz-owned analytics, source-coded VWS phone attribution, `llms.txt`, meta/OG/schema, Cloudflare analytics state, R2 readback, and desktop native/no-topper. PSI evidence recorded a successful mobile fresh `100` and desktop native fresh `98` for evidence only. The run also hardened the shared canonical Worker with a same-origin native font repair for malformed Vine Gotham URLs missing `/fonts/`, eliminating native 404 console noise without creating a property fork or desktop topper. The cohort readout at `/Users/mark/Property_Analytics/reports/resi_edge_performance/cohort-readouts/resi-edge-cohort-readout-20260814T160230Z.md` and `.json` now reports Townestone, Champions, Ventana, and The Vine as four ready properties with zero needing attention.

08/14/2026 Resi Edge cohort evidence/readout hardening addendum: added a non-mutating cohort readout builder at `/Users/mark/Property_Analytics/scripts/build_resi_edge_cohort_readout.py` so promoted Resi Edge properties can be evaluated from existing evidence without manually opening raw packets. The first readout lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/cohort-readouts/resi-edge-cohort-readout-20260814T145809Z.md` and `.json`; it marks Townestone at 359, Champions Green, and Ventana ready with mobile PSI `100`, full-height hero proof, Zaraz package status `unchanged`, and no blocking watch items. The rollout register was synced to the final full-height proof folders from 08/13/2026 local time: Townestone `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260814T000535Z/`, Champions `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260814T010126Z/`, and Ventana `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260814T010840Z/`. The readout treats Townestone's older `evidence_packet_written` packet self-index artifact as a watch item while deferring pass/fail authority to the corrected `apply-readout.json` ledger. The governed Zaraz analytics applier now retries transient Cloudflare Zaraz API and Ahrefs roster read failures with bounded backoff, reducing timeout noise without changing runtime behavior or creating an alternate deployment path.

08/13/2026 Resi Edge tokenized rollout supersession: Townestone at 359 (`TX4FC`, `townestoneat359.com`) is now the active canary for release token `2026-08-13.townestone-promo-bar-v2`, superseding older Champions v1 canary language for future promotions. Townestone live evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260813T213750Z/`. Champions Green and Ventana were promoted to the same token through the governed `plan -> stage -> apply --require-live-proof` path, with final evidence at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260813T220410Z/` and `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260813T221659Z/`. All three current v2 proofs passed `54/54` gates; mobile PSI is `100` on all three; desktop remains native passthrough/no-topper and was recorded for evidence only at Townestone `97`, Champions `96`, and Ventana `97`. The shared runtime now consumes the central release-token file and exposes the active token in live package health; the deploy adapter bundles `release-tokens.json` into the exact Worker artifact; the static/release validators enforce token/register/bundle closure so future shared promo-bar changes cannot drift by property.

08/13/2026 Ventana timed pilot addendum: Ventana (`TX4VE`, `ventanaapts.com`) completed the first timed pilot run after the Resi Edge release-control layer was added. The run followed the governed sequence with no package edits during execution: release-control/static/gate validation, non-mutating plan, stage, and live apply with `--require-live-proof`. Final evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260813T204745Z/`; authoritative `apply-readout.json` reports `54/54` gates passed, no failed/blocked/not-run gates, no rollback, and `64` evidence files. The run proved canonical package health at immediate/30s/90s, mobile shell contract, official shared LBLE SVG title art, desktop native/no-topper, compact finalized consent v27, Zaraz analytics package unchanged/green, GA4/Zaraz and Heap/Contentsquare interaction-only proof, Ahrefs existing project, Cloudflare analytics state, source-coded phone, R2 readback, cache purge, `llms.txt`, meta/OG/schema/icons, stale identity scan, and Captain/Data Pond evidence. PSI proof recorded mobile minimum `99.0` against parity target `98`, and desktop native passthrough `96.0` as evidence only. Timing baseline: about `10.6` minutes total from validation start to final readout, about `33` seconds for stage, and about `7` minutes for live apply. The rollout register now marks Ventana as `live_pilot_passed` on token version `2026-08-13.champions-canary-v1`.

08/13/2026 Resi Edge release-control addendum: added a governed release-control layer so the Resi Edge package can be managed as updateable software across the pilot instead of reinterpreted property by property. The new token file at `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-release-tokens.v1.json` centralizes shared visual and policy defaults, including mobile-only topper rules, promo/header/hero tokens, compact finalized consent v27, Zaraz analytics ownership, Cloudflare RUM handling, mobile PSI and desktop native-passthrough targets, and non-deviation rules. The pilot rollout register at `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json` records property-level truth: status, manifest, token version, current evidence, PSI proof, desktop and mobile state, analytics, consent, freshness, Ahrefs, rollback, and next action. It explicitly marks Champions Green as the only current `live_canary_passed` property on token version `2026-08-13.champions-canary-v1`; Ventana, The Vine, TowneStone, District, and Pilot remain unpromoted until current live evidence proves the active tokenized package. Validation is executable through `/Users/mark/Property_Analytics/scripts/validate_resi_edge_release_control.py`, and `/Users/mark/Property_Analytics/scripts/validate_resi_edge_package_static.mjs` now invokes that validator so the normal static package gate cannot pass when release control is broken. The operator procedure is documented in `/Users/mark/Property_Analytics/docs/RESI_EDGE_RELEASE_CONTROL_RUNBOOK_2026-08-13.md`. Initial validation passed with the release-control validator, Champions static package validation, and Resi Edge gate coverage.

08/13/2026 Champions Green live Resi Edge package proof addendum: Champions Green (`GA4CG`, `championsgreen-ga.com`) has passed the canonical Resi Edge package as a live, evidence-backed prototype target through the governed `plan -> stage -> apply --require-live-proof` runner. Final evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260813T194138Z/`; authoritative `apply-readout.json` reports `54/54` gates passed, no blocked/failed/not-run gates, no rollback, and `64` evidence files. The run proved mobile shell contract, desktop topper absence/native render, official shared LBLE SVG title art, sourced fractional reviews, sourced Kingsley award, first two content blocks with bullets, compact finalized consent widget v27, Zaraz-owned GA4/Heap/Ahrefs/Resi event bridge, Cloudflare analytics state, source-coded phone proof, R2 asset readback, cache purge, `llms.txt`, meta/OG/schema/icons, stale identity scan, and Captain/Data Pond evidence. PSI proof recorded mobile minimum `100.0` against parity target `98`, and desktop native passthrough minimum `97.0` as evidence only. A shared package polish was added: optional `mobile_shell.promo.bar_label` renders the collapsed promo bar label while the drawer preserves full feed-backed `promo.title` and `promo.body`, preventing long concessions from wrapping/clipping in the 60px topper bar without mutating feed copy.

08/13/2026 Resi topper freshness harvester addendum: a production-isolated Cloudflare Browser Rendering service now harvests current public mobile topper facts for the initial three live Resi targets without changing any live property topper runtime. Worker `resi-topper-freshness` is deployed at `https://resi-topper-freshness.mlaufhutte.workers.dev` with cron `17 */4 * * *`, Browser binding, and production KV namespace `RESI_TOPPER_FACTS` (`5d831fc3faff4831826be0cb62a98bb5`). Local proof tooling lives at `/Users/mark/Property_Analytics/scripts/harvest_resi_topper_facts.py`; production Worker files live under `/Users/mark/Property_Analytics/ops/cloudflare/resi-topper-freshness-worker/`. Production readback on 08/13/2026 confirmed KV payloads for TowneStone (`TX4FC` promo/phone), The Vine (`TX4EK` promo/phone), and Ventana (`TX4VE` reviews/award/phone). This is not yet the live topper data source: no existing property Worker was modified, and the shared Resi topper runtime still needs a separate gated KV-consumption change with stale fallback and visual proof. Remaining hardening before portfolio scale includes registry-driven targets, D1 history/evidence, protected manual endpoints, feed-versus-page conflict checks, lazy continuation content handling, and freshness alerting.

08/12/2026 Resi Edge Vine golden reset addendum: Mark rejected the generated canonical/lookalike path after it failed to reproduce the working The Vine Kyle Parkway mobile topper. The active standard is now protected-reference extraction, not generated-reference mutation: Vine is the golden visual/source baseline; the universal package must copy Vine's structure and populate data only; The Vine, TowneStone, and other protected references may be validated or captured but not overwritten by the package runner. Ventana visual review restored the active hero-title contract to the official shared LBLE SVG visual. `mobile_shell.hero.title_text = "Live Better. Live Easy."` is an accessible label only; the runtime renders `.hero-title-art` as a same-origin image from `/assets/resi-edge-assets/shared/lble.svg`, with no edge-added TM, no `hero-title-text`, no property font substitution for the tagline, no `title_asset`, no `title_asset_text`, and no `title_render_mode`. The runner no longer exposes `level-set-reference`; the deploy adapter blocks protected reference bundles; active v1 manifests, schema, runtime, shell validator, static validator, and gate-coverage check are being realigned to the official shared LBLE SVG contract while preserving the newer data-driven innovations: sourced reviews and fractional stars when present, feed-backed specials, sourced awards, compact Zaraz consent, all analytics in Zaraz, VWS/source-coded phone attribution, `llms.txt`, SEO/meta/schema checks, and mobile-only assets.

08/12/2026 Resi Edge staged-readiness and hero-title supersession addendum: Ventana exposed that the runner's process shape was still incomplete. A green `plan` could report live apply permission before the canonical asset package had been generated, budget-checked, uploaded, and before Zaraz analytics setup was proven as a named gate. The runner now has a distinct `stage` mode between `plan` and `apply`: `plan` is non-mutating and can only report `stage_allowed`, `stage` proves reference replay, mobile-only asset generation/upload, governed Zaraz analytics package setup, Zaraz consent audit, and generated deploy-bundle closure without touching the production Worker route, and `apply --require-live-proof` reruns those same staged gates before route probe or Worker deploy. The canonical contract now includes `zaraz_analytics_package_applied` and `deploy_bundle_closure_verified`, the asset generator now enforces the mobile hero WebP `80,000` byte budget that the runner already enforced, and the runbook/SOP/gate-coverage check now require `plan -> stage -> apply`. The deploy adapter now builds the live deploy bundle and dry-run validation bundle through the same function, copies the shared consent widget into the bundle, rewrites the runtime import to the bundled path, and blocks route work if Wrangler dry-run fails. The R2 uploader stale `--force` flag was removed and is now validator-blocked. This closes the false-readiness failure pattern: predictable setup and bundle gates must be proved before live route work, and a failed stage must stop without manual compression, detached Zaraz setup, route probing, deploy retries, or retry-with-fixes. Same-day correction: desktop PSI is no longer a blocking package gate because desktop is native passthrough and the approved package does not optimize desktop presentation. The contract now records desktop PSI as `psi_desktop_recorded_live` while desktop visual safety remains enforced by native/no-topper browser gates; mobile PSI reference parity remains blocking at `98`. The earlier Ventana apply `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260812T171900Z/` is superseded as invalid package approval after Mark's screenshot exposed a missed hero visual failure: the package still allowed `title_render_mode:"text"`, so Live Better Live Easy could render as oversized text and collide with the review row instead of using the official shared SVG. Ventana has been rolled back; `resi-edge-canonical-ventanaapts-com` is deleted and readback confirmed Cloudflare code `10007`. The package now hard-locks the same-origin official `/assets/resi-edge-assets/shared/lble.svg` as the only hero title visual, keeps `title_text` only as the required accessible label, forbids text-rendered title output and render variants in schema/runner/static validators, uploads the SVG through the governed R2 asset path and validates same-origin readback, and adds Playwright hero-stack geometry proof for review row, SVG title art, headline, and CTA order/no-overlap. Non-live validation passed for Pilot, Champions, District, Vine, and Ventana manifests plus a Ventana generated deploy-bundle dry-run.

08/11/2026 Resi Edge shared standards addendum: the Resi Edge package now has a shared standards layer at `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-standards/registry.json`. Property manifests consume these standards; property-specific Workers or local copies are not approved implementation surfaces. The finalized compact Zaraz consent widget is the first extracted universal standard, with contract `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/contract.json` and runtime `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-consent-widget/widget.mjs`, version `compact_finalized_pill_v27_2026_08_12`. Runtime, manifest schema, static validator, shell validator, gate coverage, browser proof, and the Zaraz consent applier now enforce this single consent contract. Stale consent variants fail if they lack the version marker, use the old large copy, expose inline `Reject` on the pill, or handle `Preferences` without `zaraz.showConsentModal()`. The same standard now constrains the Cloudflare Zaraz preferences modal to a bounded centered desktop panel and inset mobile panel; full-width modal slabs are a failed visual proof. Calais exposed why local forks are forbidden: its Zaraz config was current but its Worker still rendered an older consent bar, so the Worker was corrected to import the shared widget and redeployed before being called fixed. This is the model for the next standards to extract: Zaraz analytics, SEO/AI, Ahrefs lookup-first, mobile shell composition, reviews, feed-backed specials, and brand/font tokens.

08/11/2026 Resi Edge finalized execution protocol addendum: the Resi Edge upgrade process is now treated as a single fail-closed automation surface, not a manual sequence or property-specific Worker practice. `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` is the only allowed executor for `plan`, `validate-reference`, and `apply --require-live-proof`. The operator runbook `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md` has been tightened to match this truth: fresh Champions manifest is protected base, old Pilot-first language is superseded, desktop asset generation and desktop visual rewriting are forbidden unless explicitly approved, and every enhancement learned from TowneStone, The Vine, Calais, Champions, District, and Ventana is mandatory scope. `/Users/mark/Property_Analytics/scripts/check_resi_edge_gate_coverage.py` now verifies that every required contract gate is represented in the runner and fails on drift in live-proof enforcement, mobile PSI parity, Heap v6 interaction-only mode, desktop asset drift, and hidden analytics bypass terms. The runner's `static_package_validation_passed` gate now invokes that coverage check, so normal plan/apply runs cannot skip it. Current strict reference status: TowneStone and The Vine are not fully reference-green under the all-metrics-through-Zaraz contract because desktop direct analytics remain on the live references: TowneStone has direct Resi Pixel on desktop, and The Vine has desktop `HEAP_JS_DEBUG` plus direct Resi Pixel. Current selected target state: Ventana (`TX4VE`, `ventanaapts.com`) is preflight-ready but not live-upgraded; the last apply rolled back successfully after analytics proof failed on a synthetic query URL blocked with `403`, while prior live gates proved route/package health, cache/R2, mobile shell, desktop native/no-topper, source-coded phone, continuation content, consent browser proof, `llms.txt`, meta/OG/schema/icons, stale identity cleanup, and direct WordPress analytics stripping. The runner now applies the governed Zaraz analytics package before Worker deploy and uses canonical-homepage analytics smoke with `--no-unique-query`. Current analytics contract: GA4, Heap `interaction_only_queue_v6_input_only_cs_verify_home_204`, Ahrefs existing-project tooling, and Resi event bridge are Zaraz-owned; direct WordPress/GTM/gtag/Heap/Ahrefs/Resi loaders are removed or edge-stripped across mobile and desktop; manual Zaraz loader injection is forbidden because Cloudflare auto-injection owns the loader. A same-day controlled Ventana attempt then passed 47 gates and rolled back only because mobile PSI returned Lighthouse `500`/no-score while desktop PSI scored `98/97`; the runner now treats PSI no-score as a bounded wait-and-retry condition, while measured scores below `90` remain hard failures. If any required gate fails, the system must rollback when needed, write the failed evidence packet, and stop for Mark review. No alternate Worker, lookalike, property-specific variant, or retry-with-fixes is permitted without explicit approval.

08/10/2026 Resi Edge full evidence runner hardening addendum: `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` has been hardened from a partially automated deploy path into a fail-closed Resi Edge evidence runner. Real target `apply` now requires preflight proof before live mutation and then stops/rolls back at the first missing or failed live gate. The runner now records cache purge proof, same-origin R2 asset readback, Playwright mobile shell and desktop native/no-topper acceptance, native continuation dedupe, consent browser proof, `llms.txt`, meta/OG/schema/icons, stale identity scans, Zaraz/GA4/Heap/Ahrefs live analytics smoke, Cloudflare analytics state, PSI mobile and desktop 90+ gates, and a final evidence packet. GSC indexing and fresh Captain/Data Pond update records are now required preflight gates for real targets; protected `BASE` plans remain non-mutating and may mark those gates not applicable. Verification on 08/10/2026: Python compile passed, the protected Champions `BASE` plan passed with `apply_allowed:false`, and District (`FL4DU`, `thedistrictuniversal.com`) plan stopped before mutation on exactly two blockers, `gsc_indexing_recorded` and `captain_data_pond_updated`. District is therefore not ready for live apply until those records exist; no live route change was made during this hardening pass.

08/10/2026 Cloudflare Kitesurf Browser Run option addendum: Cloudflare Kitesurf has been recorded as a candidate probe engine inside the existing Cloudflare/site-governance toolbox, not as a new implemented subsystem. Current Cloudflare documentation positions Kitesurf as a beta, stateless Browser Run engine selected with `browser=kitesurf` on Quick Actions or CDP endpoints. The useful fit for this repository is low-cost public-page triage: screenshots, rendered HTML/Markdown, links, accessibility trees, website-change-watch snapshots, EVS-style source/content checks, and lightweight Resi Edge route/marker/content probes before heavier browser proof. It must not replace Chromium/Playwright for final Resi Edge acceptance, visual/style proof, authenticated Cloudflare Access workflows, persistent sessions, video/WebGL, bot-challenge-sensitive flows, or any production-readiness gate requiring browser-fidelity evidence. If implemented later, Browser Run account id/token resolution must follow Keeper/KSM and existing Cloudflare auth helper patterns; no new local credential path is approved by this note.

08/10/2026 Resi Edge route and package-health gate addendum: The canonical Resi Edge contract now includes `cloudflare_route_interception_probe_passed` and `cloudflare_package_health_probe_passed`, and `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` enforces them around the full package deploy. The route gate deploys a temporary Worker on `domain/__resi-edge-route-test*`, verifies the marker on the test route, verifies the homepage is not intercepted, deletes the temporary Worker, and verifies cleanup. The package-health gate then requires `/__resi-edge/health` to return the canonical package id and target manifest domain/property after full deploy before browser shell proof can run. District (`FL4DU`, `thedistrictuniversal.com`) proved the route gate during apply run `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thedistrictuniversal-com/apply-20260810T175733Z/`, then failed live shell proof after the full package deploy because the live homepage still returned native WordPress/Kinsta payload with the shell marker missing. Cleanup using the generated deploy config deleted `resi-edge-canonical-thedistrictuniversal-com`; post-cleanup smoke confirmed native homepage, no Resi Edge marker, and 404 responses on package health and route-test paths. This establishes that District's zone can intercept a Worker route, but the canonical full-package deploy/live-proof mismatch remains unresolved and must be diagnosed before any retry.

08/10/2026 Resi Edge Champions-base supersession addendum: Mark selected Champions Green (`GA4CG`, `championsgreen-ga.com`) as the full-functioning canonical base reference for the repeatable Resi Edge optimization package. The active base is the fresh runbook-controlled manifest `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`, not the old experimental Champions Worker and not the old legacy Champions manifest. The package controls now point `BASE` to Champions, the canonical Worker adapter imports the Champions manifest, the static validator expects that manifest, and the deploy adapter blocks base mutation. The shared runtime now also supports approved concessions for newer properties with no active feed-backed special, no sourced reviews, or no sourced awards by omitting those outputs rather than inventing placeholders. Proof on 08/10/2026: static package validation passed, `python3 scripts/run_resi_edge_upgrade.py --property-code BASE --domain championsgreen-ga.com --mode plan` passed preflight with `apply_allowed:false`, py_compile/node checks passed, and mature plus no-special/no-review/no-award shell smokes passed. No live mutation was made. Any lower Pilot/Vine/old-Champions base language is superseded by this entry.

08/10/2026 Resi Edge Vine-base supersession addendum: Mark superseded the Pilot-base path and selected The Vine Kyle Parkway (`TX4EK`, `thevinekyle.com`) as the canonical live base reference. `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/thevinekyle-com.manifest.json` now captures the governed Vine identity, brand colors, first-party Montserrat/MS Madi fonts, feed-backed special, real first two content blocks, Kingsley award evidence, VWS/default and source-coded phone lookup, GA4/Heap/Ahrefs/Zaraz ownership, SEO/GSC facts, Captain evidence, and existing live proof pointers. `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` now supports the proven Vine text-title/font path and explicit no-review-row base state without inventing reviews; fractional stars remain required when a sourced review row exists. The contract now names The Vine as `canonical_base`, with `first_apply_target` set to `not_selected`. The runner's `BASE` plan passes preflight against The Vine but returns `apply_allowed: false`, and live Vine reference replay passes. No live mutation was made; future apply requires a separately named target.

08/09/2026 Resi Edge fail-closed runner addendum: `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` now includes a contract-level `resi_edge_gate_ledger_v1`, explicit preflight gates, apply-only pending gates, strict manifest schema validation, and mandatory `--require-live-proof` for apply. `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/contract.json` now names `static_package_validation_passed` as a required gate, but static validation no longer satisfies live proof gates. The current read-only Pilot plan returns `apply_allowed: false` and exit code `2`, with `manifest_schema_valid` as the only preflight blocker and 26 apply-only gates pending live evidence. This supersedes earlier language that called Pilot plan apply-allowed after static/Wrangler checks. No live mutation was made during this tightening pass.

08/09/2026 Resi Edge canonical package artifact addendum: The Resi Edge package now has a real shared artifact instead of a copied property Worker: `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs`, package id `resi-edge-canonical-upgrade-package`, version `2026-08-09.canonical-runtime-v1`. Pilot uses the thin adapter `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js`, Wrangler config `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/wrangler.pilot.toml`, and manifest `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/pilot-ga4ax.manifest.json`. Static validation, Pilot plan mode, and Wrangler dry-run now pass after correcting the new Wrangler config to include the existing Cloudflare account id. `venterradev.com` Zaraz audit passes with GA4, Heap, Ahrefs, and Resi Pixel assigned to consent purposes, and Ahrefs lookup found the existing verified `pilot.venterradev.com/` project. The first governed Pilot apply attempt failed before mutation because the new config initially omitted `account_id`, producing Wrangler `/memberships` authentication code `9106`; no second live apply was attempted under the stop-on-failure rule. Evidence is at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/pilot-venterradev-com/apply-20260809T225550Z/apply-failed-readout.json`.

08/09/2026 Resi Edge process audit addendum: `/Users/mark/Property_Analytics/docs/RESI_EDGE_PROCESS_AUDIT_2026-08-09.md` found that the written Resi Edge contract is comprehensive, but the executable runner still enforces only a subset. The current `apply` path can pass after deploy plus narrow HTML shell validation, while the contract requires source-fed specials, source-coded phone proof, real fonts, awards, continuation dedupe, `llms.txt`, meta/OG/schema, GSC, Zaraz browser proof, Ahrefs lookup, Cloudflare analytics, R2 readback, cache purge, PSI, Captain/Data Pond, rollback, and full evidence ledger. The package should remain labeled preflight-ready only until the runner enforces every required gate or records explicit approved exceptions.

08/09/2026 Resi Edge reconciliation addendum, superseded in part by the 08/10/2026 Champions-base entry above: `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md` became the active thread-reconciliation record for the Resi Edge package. It superseded stale execution language that treated Champions Green as the first fast-path prototype or implied multiple property-specific package variants. At that time, TowneStone and The Vine were read-only reference fixtures, Calais and Champions were failure/lesson sources unless Mark explicitly re-approved them, and `pilot.venterradev.com` was the first apply target after TowneStone/Vine reference replay. Current truth is the 08/10/2026 Champions-base entry above: fresh Champions manifest as protected base, no selected apply target. No future Resi property may be called ready, exact, approved, optimized, complete, or "same as TowneStone/Vine" until one canonical package artifact, manifest schema, validator suite, and evidence packet pass every gate or carry explicit approved exceptions. If a gate fails, the operator stops and discusses; no live workaround or lookalike rebuild is allowed.

08/09/2026 Resi Edge runner addendum: `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` now provides the required gated runner interface for `plan`, `validate-reference`, and `apply`. It writes reset cards, resolves governed identity, runs the mobile shell contract validator, and produces evidence readouts. It does not yet allow live apply because the canonical deploy adapter and Pilot manifest are still missing. Same-day proof passed reference validation for TowneStone and The Vine, and Pilot plan failed with no mutation because `manifest_loaded`, `canonical_deploy_adapter_present`, and `mobile_shell_contract_passed` remain unresolved. This is the correct stop condition under the no-deviation rule.

08/08/2026 corrective Resi package boundary addendum: The earlier Champions Green "full package prototype" claim is invalid and superseded. Champions was a property-specific rebuild and must not be treated as the scalable Resi package model. The active reference audit is `/Users/mark/Property_Analytics/docs/RESI_EDGE_TOWNESTONE_VINE_CANONICAL_AUDIT_2026-08-08.md`: TowneStone is the stronger operations/analytics/identity reference, The Vine is the stronger brand-theme/visual-shell reference, and neither is itself a reusable package artifact. The active cold-agent execution contract is `/Users/mark/Property_Analytics/docs/RESI_EDGE_COLD_AGENT_NON_DEVIABLE_RUNBOOK_2026-08-08.md`. Mark clarified the execution sequence: package extraction, TowneStone/Vine reference replay, first apply to the actual Pilot test property `pilot.venterradev.com`, then live level-set of TowneStone and The Vine through the same package path. Forward rule: no future property may be described as "same as TowneStone/Vine", ready, complete, exact, approved, or production proven until a shared property-agnostic package artifact, manifest schema, validator suite, and live evidence packet pass on the production hostname with no unapproved exceptions.

08/08/2026 Resi Edge accountability reset addendum: `/Users/mark/Property_Analytics/docs/RESI_EDGE_ACCOUNTABILITY_AND_FULL_PACKAGE_RESET_2026-08-08.md` is now the active corrective record for Resi property upgrade work. It was added after Champions Green exposed a partial-package drift failure: mobile shell proof, desktop native pass-through, and PSI proof were treated too close to package completion while required elements such as Zaraz analytics ownership, consent proof, Ahrefs lookup-first posture, Cloudflare Analytics/RUM evidence, source-coded phone attribution, SEO/AI cleanup, `llms.txt`, schema/meta/OG, Captain/Data Pond state, and full live evidence were not held together as one package. This supersedes any readiness language for Champions or future properties that is based on a reduced mobile-only contract. Forward rule: no Resi property may be called upgraded, ready, approved, complete, exact, or "same as TowneStone/Vine" unless the full package gate set passes on the live production hostname or every omission is recorded as an explicit approved exception in the property readout.

08/08/2026 Champions Green v26 correction addendum: The Champions Green v25 live upgrade record is superseded because the desktop browser proof was invalid: the saved desktop screenshot showed raw/unstyled native HTML while the proof summary still marked desktop as passed. Worker `portfolio-resi-edge-prototype` is now corrected live at marker `2026-08-08.performance-topper-v26-desktop-native-css-repair-compact-consent`, Worker version `2b3cc4e0-77cf-4491-9973-d72348743134`. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-08-2026/champions/live-production-v26/`. v26 keeps the standalone mobile shell, removes the desktop guard/promo rewrite lane, repairs missing native desktop CSS when Kinsta/native cached HTML omits the required Resi/YOOtheme stylesheets, and swaps the consent notice to the compact finalized pill. New forward gate: desktop cannot pass from headers or native-mode markers alone; it must include a rendered screenshot plus computed checks proving native CSS loaded and the page is not default/raw blue-link HTML. Full package approval remains blocked on Ahrefs vanity-domain setup.

08/08/2026 Champions Green origin reset addendum: Champions Green was reset live to transparent origin pass-through after procedure drift. Worker `portfolio-resi-edge-prototype` now carries marker `2026-08-08.origin-passthrough-reset`, Worker version `b79ce468-b0d1-4094-a3af-d9c4c1c9df67`, and returns the origin response directly in the live execution path. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-08-2026/champions/origin-reset/`. Live proof confirms no `x-resi-edge-*` headers, no Worker shell/topper/consent/CSS-repair markers, origin stylesheets present, and native desktop/mobile screenshots captured. Reset PSI baseline is mobile `58` and desktop `99`, proving desktop should be preserved while the mobile lane is optimized through the runbook.

08/08/2026 Resi property upgrade runbook addendum, superseded in part by 08/09/2026 reconciliation and 08/10/2026 Champions-base control: `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md` is the step-by-step operator runbook for moving a Resi property to the current package, but it must be read through `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`. The runbook consolidates TowneStone, The Vine, Calais, and Champions lessons into gates for reset card, governed identity, source lookup, live baseline, standalone mobile shell, native desktop lane, Zaraz analytics, Zaraz consent, SEO/AI cleanup, Ahrefs lookup-first setup, deployment, cache purge, live browser proof, PSI proof, Captain/Data Pond evidence, and rollback. Its old statement that Champions Green was not the fast-path candidate and `pilot.venterradev.com` was first apply target is superseded by the 08/10/2026 Champions-base control: fresh Champions manifest as protected base, no selected apply target.

08/08/2026 Live Resi CMP rollout addendum: The Cloudflare Zaraz Consent Management package is now live and proven across TowneStone, The Vine, Calais Midtown, and Champions Green. Final config audit passed all 4 domains at `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/live_resi_after_cmp_rollout_zaraz_consent_audit.json`. Final browser proof passed all 4 domains at `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/live_resi_cmp_browser_proof_20260808_all_four.json`, covering first-visit pill, preferences panel, both required purposes, accept/reject behavior, no native Cloudflare modal overlay, and zero GA/Heap/Ahrefs/Resi/Contentsquare leakage before consent or after reject. The live Worker versions were The Vine `e055f15b-fbce-46a3-aeca-c52c708d7c56`, Calais `9b0e7fb2-1a36-4429-b31d-1ae426aa5c79`, Champions `2ea44df5-986d-4205-9079-f31bac5abe11`, and TowneStone marker `2026-08-08.mobile-topper-production-cmp-v22`. Champions required a native-clean pass-through because ungated native production carried direct WordPress GTM/gtag/Heap/Resi Pixel; the Worker now strips those loaders and injects the CMP pill while preserving native rendering. Forward pattern: Zaraz owns consent state and tool blocking; the Worker pill can own the visible UI and preferences controls when Cloudflare's native modal is hidden or unreliable.

08/08/2026 Resi Zaraz consent management addendum: Consent management is now a required gate in the Resi launch and optimization package. Cloudflare Zaraz Consent Management is the approved CMP owner unless Mark explicitly approves another CMP before implementation. The Pilot implementation remains the reference pattern: Cloudflare Zaraz owns consent state and purpose-based tool blocking, while the Worker may provide a compact branded notice and preferences panel using the Zaraz Consent API. New read-only audit tool `/Users/mark/Property_Analytics/scripts/audit_zaraz_consent_package.py` uses the Keeper-backed `Cloudflare Zaraz Editor` credential to inspect CMP enablement, configured purposes, enabled Zaraz tools, and tool-purpose assignment without printing secrets. The governed migration system and package readout template now require CMP enablement, analytics/performance and marketing/leasing/attribution purposes, enabled-tool assignments, first-visit UX proof, preferences proof, accept/reject network proof, Google Consent Mode posture, and purpose-bound network blocking before analytics or production readiness can pass. Baseline audit on 08/08/2026 stored `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/20260808_150516_zaraz_consent_audit.json`: `venterradev.com` passed; `championsgreen-ga.com`, `townestoneat359.com`, `thevinekyle.com`, and `calaismidtownapartments.com` failed because CMP is not enabled and enabled tools are not assigned to configured consent purposes. This supersedes any earlier analytics package language that treated Zaraz tool presence alone as sufficient.

08/07/2026 Calais font dependency experiment addendum: The PSI `Network dependency tree` font warning was tested on live Calais. v20-v24 variants proved that explicit shell font preloads remove the raw Lighthouse font-chain audit, but repeated PSI runs dropped mobile performance into the mid-90s, making that direct fix unacceptable for the current high-score package. Worker `calais-resi-edge-candidate` now carries marker `2026-08-07.calais-mobile-shell-preview-v25-high-score-restore`, Worker version `c1186d9e-9b24-429d-ac12-5928868b8aef`. v25 preserves the approved mobile shell, review row, Kingsley award sequence, and iframe continuation dedupe while removing font preloads and retaining only the hero image preload. Live proof after Cloudflare purge passed architecture, passive Zaraz/Ahrefs smoke, and PSI mobile `100` / desktop-native `98`. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v25-high-score-restore/`. The font-chain insight is a known non-blocking warning until a no-regression solution such as subsetting or route-specific CSS is built and proven.

08/07/2026 Calais continuation dedupe correction addendum: The Calais v18 award/sequence correction still had a lazy-native-continuation defect because the iframe repeated the same two shell-owned content panels after the shell rendered them. Worker `calais-resi-edge-candidate` now carries marker `2026-08-07.calais-mobile-shell-preview-v19-continuation-dedupe`, Worker version `8abcd52e-4f9d-49f5-91eb-d7962e75a995`. The mobile shell owns promo/header/hero/welcome/features, and the native iframe suppresses native `hero`, `welcome`, and `apartment_features`, so the visible continuation starts at `reviews_carousel` and then amenities. Cloudflare homepage and continuation URLs were purged before acceptance. Live proof passed clean production mobile marker v19, iframe CSS proof, browser scroll proof with one visible shell welcome and one visible shell features block, hidden duplicate iframe welcome/features, visible iframe reviews/amenities, no horizontal overflow, architecture validator, passive Zaraz/Ahrefs smoke, and PSI mobile `100` / desktop-native `99`. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v19-continuation-dedupe/`. This addendum supersedes any v18 readiness statement without a scrolled iframe dedupe proof.

08/07/2026 Calais award sequence correction addendum: The Calais v17 full-package record was incomplete because the mobile welcome block still missed the Kingsley Excellence award and showed the welcome media where native mobile hides it. Worker `calais-resi-edge-candidate` now carries marker `2026-08-07.calais-mobile-shell-preview-v18-award-sequence`, Worker version `d497aa35-972f-4832-af70-8e0ecc536b75`. The live mobile welcome sequence is now copy, `See Available Homes`, same-origin Kingsley award SVG, hidden welcome media on mobile, then the `Apartment Features / Stylish Living Spaces` block. Stale Cloudflare mobile HTML was purged before acceptance; clean production mobile then returned the v18 marker/body. Live proof passed browser sequence checks, no horizontal overflow, same-origin award asset proof, architecture validator, passive Zaraz/Ahrefs analytics smoke, and PSI mobile `100` / desktop-native `98`. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v18-award-sequence/`. This addendum supersedes any v17 statement that Calais was complete without award/sequence proof; future property packages require content-block sequence proof, award/badge proof, mobile hidden-media parity, and production cache-purge proof after marker changes.

08/07/2026 Calais full-package correction addendum: Calais Midtown has been rebuilt again as the full approved mobile package after Mark identified that the v16 correction had dropped the first two content blocks. Worker `calais-resi-edge-candidate` now carries marker `2026-08-07.calais-mobile-shell-preview-v17-full-package`, Worker version `14fc2208-739b-44b7-abf0-b69102657c8f`. The live mobile homepage sequence is now promo/header, full-height optimized hero, sourced linked review row `(4) 258 Reviews` with `80%` star fill, official LBLE art, `Welcome to Calais Midtown`, `Apartment Features / Stylish Living Spaces`, and then lazy native continuation. The two lower blocks use current native Calais copy and optimized bundled AVIFs; typography is backed by the live Calais Lato and Noto Serif font files. Live browser proof passed for clean mobile and `?id=TX4MIGOA` source-coded phone attribution, no horizontal overflow, continuation idle-until-scroll behavior, desktop native preservation, and visual screenshots. The architecture validator passed, passive Zaraz/Ahrefs analytics smoke passed, and PSI scored mobile `100` / desktop-native `91`. Evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v17-full-package/`. This addendum supersedes any statement that Calais' reduced v16 hero-only shell is portfolio-equivalent; future properties must include the full content sequence, review proof, exact font proof, source-coded phone proof, analytics proof, architecture proof, browser screenshots, and PSI evidence.

08/07/2026 Resi builder mobile review proof addendum: The reusable WebOps Resi builder now treats hero review proof as an explicit mobile-shell behavior. Mobile `resi-original-yootheme-v1` template instances render the sourced linked review row from captured native `property_rating` value/count/link; desktop template instances suppress edge-added review rows so desktop remains native unless separately approved. The runtime does not add a TM mark to the LBLE visual. Generated template instances and Worker config were refreshed, and runtime smoke, visual proof, and full `make validate` passed on 08/07/2026. This is the forward contract for Calais and future properties; review values must be sourced and freshness recorded before promotion.

08/07/2026 Calais standalone-shell correction addendum: The Calais architecture failure has been corrected in production using the proven TowneStone/Vine standalone mobile shell. Worker `calais-resi-edge-candidate` version `438d0195-9149-4547-a7e9-bac9a82597b0` now serves mobile root traffic as `production-standalone-shell` with marker `2026-08-07.calais-mobile-shell-preview-v15`; desktop remains native pass-through with surgical analytics cleanup. Live machine proof passed for the clean root and `?id=TX4MIGOA`: initial mobile document under the shell contract, `0` stylesheet links, no native runtime blockers, no native DAM URLs, full-height hero geometry, no horizontal overflow, lazy native continuation loaded only after scroll, full-width continuation iframe, GOA phone/schema/analytics attribution, and desktop-native preservation. Live PSI on 08/07/2026 scored mobile `100` and desktop `98`. Evidence is under `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/architecture/`, `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v15-1-browser/`, and `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v15-1-psi/`. This supersedes the integrated Calais posture for scale.

08/07/2026 Resi mobile shell architecture correction addendum: Calais Midtown exposed a second, more serious process failure after the analytics correction: the integrated native-page mobile topper can look visually close while failing the proven TowneStone/Vine architecture. Live architecture validation on 08/07/2026 passed `https://townestoneat359.com/` and `https://thevinekyle.com/`, but failed `https://calaismidtownapartments.com/` because the initial mobile document was about `200KB`, contained `5` stylesheet links, `31` script tags, native WordPress/YOOtheme/jQuery/UIkit/Resi runtime blockers, and DAM image references. The new required validator is `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs`, and each package must store its output at `architecture/mobile-shell-proof.json`. The locked forward rule is that 90+ Resi mobile optimization packages use the standalone TowneStone/Vine shell: edge-owned promo/header/hero first view, optimized same-origin/R2 LCP asset, lazy native continuation, desktop native pass-through unless separately approved, Zaraz-owned analytics, source-attributed phone, feed-backed specials, and brand-theme parity proof. Integrated native mobile transforms are forbidden for portfolio scaling unless Mark explicitly approves an exception before implementation. Calais is therefore active as a live correction but not approved as the portfolio high-score package until rebuilt under this contract.

08/07/2026 Calais Heap verify guard and source-attribution addendum: Calais Midtown now has a live correction for the remaining post-interaction Heap/Contentsquare verification issue. The Calais Zaraz Heap tool `HCal` used historical mode `interaction-only-queue-v5-cs-verify-home-204`, now superseded by the 08/11/2026 v6 package contract, so passive lab windows stay clean and the vendor-only Contentsquare project `289716` install-check URL is redirected to a same-origin Worker `204` at `/?vtr_cs_verify_suppressed=1`. Worker `calais-resi-edge-candidate` version `d1a357d6-2551-47ce-90f6-3e586acb8b5f` carries marker `2026-08-07.calais-mobile-topper-integrated-v14-source-attribution`. The same pass also corrected the edge-owned mobile topper phone path to respect the governed Resi source lookup: clean URLs use VWS `(346) 414-0841`, while `?id=TX4MIGOA` uses GOA `(346) 639-3361`, and topper analytics includes tracking/source fields. Evidence under `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/calais_20260807_cs_verify_guard/` confirms passive smoke, interaction smoke, mobile visual/source-coded phone proof, desktop-native preservation, and zero analytics `>=400` responses.

08/07/2026 Vine mobile topper brand-theme addendum: The Resi mobile topper system now supports property-scoped brand-theme slots for lease-up/property color parity. This was added after live review showed The Vine Kyle Parkway's native promo bar uses a maroon/plum brand color while the shared mobile topper default used Venterra navy. The active `edge-message-worker` for `thevinekyle.com/*` and `www.thevinekyle.com/*` now carries marker `2026-08-07.the-vine-mobile-topper-v4-brand-theme`, Worker version `a3992518-c953-4f7a-b6f1-5fe1d2fb5d0e`, and a Vine `brandTheme` using the measured native promo color `#4E343F`, native promo surface `#F1EFEB`, text `#35343A`, and primary CTA `#792640`. Live production proof under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-07/thevine-brand-theme-v4/` confirmed the mobile promo strip, expanded promo panel, drawer, phone link, no-overflow state, full-height hero geometry, and desktop-native preservation. This updates the portfolio rule: every lease-up/property topper needs documented color parity against the live/native property brand, not only performance proof.

08/07/2026 Resi Zaraz Heap passive fallback correction addendum: The Resi analytics package now treats interaction-gated Heap/Contentsquare as the default readiness pattern, not passive delayed Heap. A long passive browser proof showed the old `load + 6000ms` / hard `8000ms` Zaraz Heap fallback could wake Contentsquare late and produce the `tcvsapi.contentsquare.com` verify-installation `404` that PageSpeed reports as a browser console error. Using the governed Keeper-backed `Cloudflare Zaraz Editor` credential, TowneStone (`HTnE`), The Vine (`HVnE`), and Calais (`HCal`) were updated to historical mode `interaction-only-queue-v2`, now superseded by the 08/11/2026 v6 package contract: Heap methods queue immediately, but external Heap/Contentsquare does not load during passive or late-passive lab windows. The repeatable live smoke script at `/Users/mark/Property_Analytics/scripts/smoke_live_analytics.py` was updated so default acceptance requires Zaraz present, Ahrefs present when required, zero passive Heap/Contentsquare requests, zero late-passive Heap/Contentsquare requests, and zero analytics responses `>=400`; interaction Heap proof is now optional and separate. Calais also had a desktop/native gap: desktop pass-through still carried native WordPress GTM/gtag/Heap while mobile integrated topper traffic was clean. Worker `calais-resi-edge-candidate` version `711801bc-8338-4b40-b763-2620366a55aa`, marker `2026-08-07.calais-mobile-topper-integrated-v12`, now applies the same surgical analytics/identity cleanup to native HTML pass-through while preserving native desktop rendering. Production smoke passed for `https://townestoneat359.com/`, `https://thevinekyle.com/`, and `https://calaismidtownapartments.com/`; evidence is under `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/heap_interaction_only_20260807/`.

08/07/2026 Calais integrated production restore addendum: Calais Midtown (`TX4MI`) has been restored to an active mobile production topper only after rebuilding it as an integrated native-page transform. Worker `calais-resi-edge-candidate` now uses marker `2026-08-07.calais-mobile-topper-integrated-v12`, fetches the non-recursive Kinsta native origin, injects the approved mobile promo/header/hero into the real WordPress document, hides only duplicate native promo/header/hero elements, and preserves native `.tm-page/#tm-main` content below. The accepted mobile hero gate is full-height relative to the viewport: `60px` promo + `80px` nav + `calc(100svh - 140px)` hero; live iPhone 12 proof measured hero top `140`, bottom `844`, height `704`, and `heroBottomDelta: 0`. Clean root and source-ID query proof are now both mandatory: `https://calaismidtownapartments.com/` and `https://calaismidtownapartments.com/?id=TX4MIGOA` both passed with one integrated topper, correct `Up to 2 Weeks Free` offer, feed detail text, native content present after scroll, hidden duplicate native promo/hero, no visible skip link, no standalone iframe continuation, and document `scrollHeight: 8155`. Restore evidence is stored at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-07/calais-integrated-v11/`; final v12 analytics/desktop cleanup evidence is under `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/heap_interaction_only_20260807/`. At the time of restore, the remaining known defect was a tag-layer `tcvsapi.contentsquare.com` verify-installation 404; the 08/07/2026 Zaraz Heap passive fallback correction above supersedes that as a passive-lab defect. The later 08/07/2026 architecture correction supersedes the integrated-transform posture for portfolio scaling: visual continuation proof is necessary, but architecture proof and analytics proof are also mandatory before a property can be treated as TowneStone/Vine-equivalent.

08/06/2026 Resi edge reset-card and launch-ledger addendum: The Resi migration/optimization lane now requires a mandatory reset card before any property-specific planning, implementation, deployment, route mutation, dashboard update, or readiness claim. The reset card must state the governed property identity, current goal, approved pattern, mobile lane, desktop lane, analytics ownership, whole-property fix ledger, live change scope, required proof, and stop conditions. The operating system also now includes an approved pattern matrix: TowneStone/Vine-style toppers are mobile-homepage only by default, desktop remains native unless explicitly approved as a separate desktop lane, desktop native pass-through cannot be represented as optimized desktop, native analytics cleanup must be surgical and visually proven, and Zaraz-first analytics is the default. A whole-property launch ledger is also required so performance work cannot outrun `llms.txt`, schema URLs, meta/OG/canonical, stale identity cleanup, phone/CTA/nav verification, favicon/icons, sitemap/robots, GSC/indexing, cache purge proof, Ahrefs project/profile lookup, Captain state, Data Pond evidence, rollback, and live smoke proof. Ahrefs setup is lookup-first: use the existing portfolio profile/project when present, and treat duplicate or unverified Ahrefs project creation as a stop condition. The source-coded phone/routing gate is now source-backed: the local WP build at `/Users/mark/Property_Analytics/resi_archetype_site/wordpress/public/wp-content/plugins/resi-elements/` imports `/property/{propertyKey}/lead-sources` into `ri_lead_sources_{propertyKey}`, reads it through `PropertyRepository` / `PropertyHelper`, and emits it through `ResiPixelHelper` as `window.resiPixelConfig`; this confirms the Resi lead-source feed is the authority. The portfolio now has a remote D1 normalized source lookup table from the latest ThirtyLines snapshot via `/Users/mark/Property_Analytics/scripts/build_resi_source_lookup_table.py` and `/Users/mark/Property_Analytics/apps/api/scripts/resi_source_lookup_to_d1.py`; VWS is the default attribution phone/email row, source-coded URL IDs use their matching `trackingId`, and office phone must not be used as a display fallback. Missing VWS attribution is a warning/fix condition. Remote D1 readback for run `resi_source_lookup_0995b04ee0a8` confirmed `1,154` rows, `94` properties, and `0` non-VWS default phone sources. Shared Worker resolver/tests and runbook now live at `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-source-attribution.js`, `/Users/mark/Property_Analytics/scripts/test_resi_source_attribution.mjs`, and `/Users/mark/Property_Analytics/docs/RESI_SOURCE_ATTRIBUTION_LOOKUP_RUNBOOK_2026-08-06.md`. KV/Worker behavior must still be proven against live rendered output before production.

08/06/2026 Zaraz-first Resi analytics package addendum: The Resi migration/optimization operating system now treats analytics as Zaraz-first by default across the pilot and portfolio lanes. From this point forward, a property package cannot be considered final or production-ready with only a generic analytics note: it must include GA4, interaction-gated Heap/Contentsquare, Ahrefs Web Analytics, Resi event bridge/CTA continuity, Cloudflare edge analytics readback, and Cloudflare Web Analytics/RUM state proof, or documented approved exceptions before PSI acceptance or promotion. This correction was made after Calais proved the visual/performance preview path but exposed that unresolved analytics ownership could still block safe production readiness. Ahrefs project readback on 08/06/2026 confirmed verified Web Analytics projects for TowneStone, The Vine, and Calais; The Vine's missing Ahrefs Zaraz tool was added live. The 08/07/2026 passive fallback correction supersedes the earlier delayed-Heap posture and proves TowneStone, The Vine, and Calais can pass long passive browser smoke with Zaraz/Ahrefs present and no passive Heap/Contentsquare requests. The new correction is stricter: analytics proof is necessary but never sufficient without live visual browser proof.

08/06/2026 Data Pond Resi migration accountability addendum: The existing `/routing-ops/portfolio-launch` command center now includes a Resi Migration Accountability operations board for the portfolio migration/optimization operating system. It displays the pilot cohort TowneStone (`TX4FC`), The Vine (`TX4EK`), Champions Green (`GA4CG`), and Calais Midtown (`TX4MI`) against the explicit 90+ mobile / 90+ desktop target. After Mark's readability review, the first view now prioritizes usable operating state over score/stat density: approval state, "What is up?", live in production, running now, blocked, approval ready, and per-property Live / Done / Next rows. Captain ownership, gate chips, and evidence cards remain available inside expanded rows. The panel is intentionally conservative: TowneStone and The Vine are shown as production mobile-topper lanes but still need fresh official desktop/mobile target proof where applicable; Champions is shown as below target on current native production despite historical high-score prototype lineage; Calais is now shown as native-restored and blocked after rollback. Approval-ready remains `0`. Current implementation is static evidence-backed UI data, not yet a D1-backed live feed.

08/06/2026 Resi edge migration system addendum: The Resi website migration/optimization lane now has a locked forward operating system at `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_MIGRATION_SYSTEM_2026-08-06.md` and a supporting case study at `/Users/mark/Property_Analytics/docs/RESI_EDGE_CASE_STUDY_2026-08-06.md`. This was created after Calais proved the mobile topper/R2 preview path but exposed an analytics-ownership process miss. Future property packages must use explicit gate states, required artifacts, stop conditions, property identity resolution, source-page audit, early analytics ownership/Zaraz gate, baseline PSI/browser evidence, R2 upload plus remote byte/SHA readback, preview-only Worker validation, CTA/analytics smoke, Captain state alignment, rollback plan, and explicit production approval. Desktop native pass-through must be labeled as native guard acceptance or not in scope, never as optimized desktop.

08/06/2026 Champions Green / Calais Resi edge pilot package addendum: The Resi edge optimization lane now has a two-property package using Champions Green / `GA4CG` as the prototype lineage and Calais Midtown / `TX4MI` as the clean replication test. The packet lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/champions-calais-package/` and includes fresh keyed PSI baselines, live HTML/header captures, Calais browser proof, a package manifest, and Captain seed SQL. Fresh live baselines on 08/06/2026 measured Champions Green native mobile `56` exact / `79` fresh and desktop `70` exact / `70` fresh; Calais measured mobile `53` exact / `58` fresh and desktop `73` exact / `69` fresh. Calais redirects from the governed Venterra URL to `https://calaismidtownapartments.com/`. A Calais candidate manifest was added at `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/calais-midtown-tx4mi.manifest.json`, using governed property identity `TX4MI`, community id `4607fc30-325a-4f4f-9499-70ffe40ebdf0`, GA4 `378381499`, phone `(346) 414-0841`, schema address `3210 Louisiana St., Houston, TX 77006`, Calais hero/DAM source images, planned R2 keys, and query-gated promotion requirements. The manifest explicitly prevents the `GA4CM`/Calais mistake because `GA4CM` is Canton Mill Lofts. Browser proof found no `Apex West Midtown` or `TX054` contamination on Calais; the recurring live QA issue is a Contentsquare verify-installation 404. Captain Champions and Captain Calais were roused through Keeper-backed remote D1: watch key `resi_edge_optimization_package_pilot` is monitoring for both `GA4CG` and `TX4MI`, and high-priority actions are in progress for Champions validation and Calais candidate build, both due 08/07/2026. No DNS, Cloudflare route, production Worker behavior, or WordPress content was changed.

08/06/2026 Calais candidate preview validation addendum: The Calais Midtown Resi edge candidate moved from package plan to workers.dev validation without a mobile-topper production route. Preview `https://calais-resi-edge-candidate.mlaufhutte.workers.dev/?edge_preview=1` is Worker version `c1d43eb8-a906-4d1f-aed9-666fbbfbad1a` from `/Users/mark/Property_Analytics/ops/cloudflare/calais-resi-edge-candidate/`. Mobile browser proof passed with marker `performance-topper`, exact Calais identity, no `Apex West Midtown`, no `TX054`, no `GA4CG`, zero console errors, zero failed requests, and zero HTTP errors. Keyed PSI measured mobile `100` exact / `99` fresh, LCP `1.73s` / `2.10s`, TBT `0ms`, CLS `0.001`, and 9 requests. Desktop remains native with guards and is not the mobile-topper promotion target. Local AVIF/WebP derivatives were generated under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/champions-calais-package/calais-assets-q64/`; after Mark expanded the `MarketingOps Release Deploy` Cloudflare token permissions, remote R2 apply uploaded 16 of 16 planned objects to `resi-edge-assets`, and sampled remote downloads matched local bytes/SHA for the mobile hero, welcome, amenities, and shared benefits assets. Calais exposed a process correction: analytics ownership must be audited before final performance acceptance. A later attempted live native cleanup Worker route proved another stop condition by breaking the rendered site CSS; the routes were deleted and native Calais was restored. Captain Calais remains `in_progress` with preview/R2 evidence, but production is blocked until rebuilt behind preview and proven with visual, analytics, CTA, PSI, and rollback gates.

08/06/2026 The Vine mobile topper production addendum: The approved mobile topper/shell architecture has now been applied to The Vine Kyle Parkway through the existing Cloudflare Worker `edge-message-worker`, preserving the `thevinekyle.com/*` and `www.thevinekyle.com/*` route ownership already in place. Final Worker version `6eea6974-afec-455c-9b65-f63c5889bc60` carries marker `2026-08-06.the-vine-mobile-topper-v3`. Mobile homepage traffic receives an edge-owned promo/header/hero first view with optimized same-origin WebP/JPG hero assets, exact Vine identity and offer copy, `index,follow` metadata, and a lazy native continuation iframe; desktop traffic remains native WordPress/YOOtheme. The native continuation remains `noindex,nofollow`, hides duplicate native promo/header/hero elements, strips WordPress `HEAP_JS_DEBUG`, and normalizes the old alternate `(512) 800-7701` phone to the live `(737) 357-8867` number. Live proof on 08/06/2026 confirmed the v3 marker on mobile root, WebP hero request, no GTM, no Heap debug, no old phone, no horizontal overflow, correct drawer links and Resi tour/apply URLs, loaded native continuation after scroll, and no topper marker on desktop. Follow-up v3 corrected invalid guessed Poppins/Merriweather/nevis font URLs to valid Vine Montserrat/MS Madi font assets; browser proof found zero console errors, zero failed requests, and zero HTTP errors. Local Chrome first-load proof measured FCP `168ms`, LCP `168ms`, CLS `0`, approximate TBT `0ms`, and `11` requests with continuation idle before scroll. PSI API remained rate-limited with HTTP `429`; Mark should use the PageSpeed UI for the official post-change score. Evidence lives under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/`.

08/06/2026 The Vine benchmark and linked llms.txt addendum: A fresh Vine benchmark packet was captured under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-benchmark/`. Mark's live PageSpeed Insights read on 08/06/2026 showed mobile performance `72`, accessibility `92`, best practices `96`, SEO `100`, and Agentic Browsing `1/3`; local Chrome benchmark measured mobile FCP about `1.10s`, LCP about `1.24s`, CLS `0`, `39` requests, no horizontal overflow, no GTM, Zaraz present, and no wrong TowneStone/Apex identity. PSI API calls from the local project returned `429` quota exhaustion. Vine's meta, OG, and schema are clean relative to TowneStone's earlier defects: canonical and schema URLs use `https://thevinekyle.com/`, no Kinsta schema URLs were found, and rendered head/schema content does not contain `Apex West Midtown`, `TX054`, or TowneStone. Current hygiene follow-ups are the WordPress `window.HEAP_JS_DEBUG = true` output, inline Edge Message `gtag(...)` bridge calls, and the heavy `/apartments/` payload. The same `llms.txt` rendering issue as TowneStone was fixed at the existing `edge-message-worker` rather than via a competing Worker: version `356826ec-6ab6-4f31-a726-92e0b7fa9857` adds explicit `thevinekyle.com/llms.txt` and `www.thevinekyle.com/llms.txt` routes. Live `/llms.txt` now carries marker `2026-08-06.the-vine-linked-llms-v1`, has an H1, has 10 absolute markdown links, omits `/reviews/` while that page is 404, and shows `Last updated: 08/06/2026`.

08/06/2026 TowneStone mobile topper production addendum: The approved TowneStone mobile-only topper has been promoted from query-gated preview to production on Cloudflare Worker `townestone-native-optimizer`, route `townestoneat359.com/*`, marker `2026-08-06.mobile-topper-production-v19`, Worker version `c01646b6-c97c-4dea-a2db-aee1e7e9ec03`. Mobile homepage traffic now receives the edge-owned promo/header/hero topper with optimized same-origin hero asset delivery, `index,follow` metadata, topper CTA/event bridge, and lazy native continuation. Desktop traffic remains on the native WordPress/YOOtheme optimizer path, including when the old `edge_mobile_topper=1` preview flag is present. The native continuation route remains hidden from indexing with `X-Robots-Tag: noindex, nofollow`. Live verification on 08/06/2026 confirmed the mobile production header `x-vtr-mobile-topper-production: 1`, no horizontal overflow, correct phone `tel:+13466231550`, no old phone, no GTM, Zaraz present and firing, same-origin hero asset loaded, lazy native continuation loaded after scroll, and desktop remained native. Follow-up marker `2026-08-06.mobile-topper-production-llms-v20` serves `/llms.txt` from the edge as linked markdown because the WordPress plugin rendered the approved template with plain-text labels and triggered the PageSpeed Agent Accessibility warning that the file did not contain links. The edge file omits `/reviews/` while that route is a 404 and includes absolute markdown links for live core pages, search, and sitemap. Follow-up marker `2026-08-06.mobile-topper-production-nav-v21`, Worker version `34d8253a-6cba-4ce9-aba4-ca3949dbce17`, corrected the mobile drawer to remove dead `/about-venterra/` and `/smarthub/` links and point the former `/location/` item to live `/neighborhood/`; post-deploy verification confirmed every drawer navigation target returns 200. Evidence lives under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v19/`.

08/05/2026 TowneStone Zaraz GA4 and Resi event migration addendum: TowneStone analytics ownership has moved from WordPress-side GTM to Cloudflare Zaraz. Using the governed Keeper-backed `Cloudflare Zaraz Editor` credential, the active `townestoneat359.com` Zaraz config now preserves existing Ahrefs (`AHTS`) and delayed Heap (`HTnE`) tools and adds managed GA4 (`GA4T`) on measurement id `G-J582E0V5T5` plus a hostname-scoped Resi Event Bridge (`RBTn`) with marker `2026-08-05.zaraz-ga4-resi-bridge-v1`. The bridge forwards the former GTM Resi/click behavior through `zaraz.track()` for form success, application start, residence view, residence PDF download, phone, email, social, directions, 3D tour, price quote, apartment tour, widget opened, popup clicked, and incentive clicked events. WordPress Resi Custom Scripts were cleaned through the native admin form: Header Scripts now keep Typekit and the Resi embed while removing `window.HEAP_JS_DEBUG`, `GTM-PXD58MGM`, `googletagmanager`, and the stale inline `click_to_call___30_lines` `gtag` event; Body Scripts no longer contain the GTM noscript iframe; Footer Scripts and Resi Pixel Script remain unchanged/empty. Exact Kinsta HIT pages initially continued serving stale markup after successful purge signals, so Worker `townestone-native-optimizer` version `8052ed8f-1d89-4ddd-a56f-05dbbf1305a3` / marker `2026-08-05.zaraz-ga4-no-gtm-v16` now strips legacy GTM/debug/inline-gtag snippets from all HTML pages while preserving homepage-only image/performance rewrites. Public `/` and `/apartments/` verification found no GTM/debug/inline-gtag traces, with Typekit and the Resi embed preserved. Browser proof confirmed Zaraz, Ahrefs, delayed Heap, the Resi bridge, successful `/cdn-cgi/zaraz/t` posts, and zero GTM DOM/network traces. GA4 realtime for property `507293675` / stream `Website` showed pageview/session events plus migrated `resi_application_start` and `resi_phone_click`. Evidence and rollback artifacts are under `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/townestone_20260805_gtm_to_zaraz/`.

08/05/2026 Cendana native optimizer addendum: A no-topper Cendana native optimizer preview exists at `/Users/mark/Property_Analytics/ops/cloudflare/cendana-native-optimizer/` on `https://edge-preview.cendanalife.com/?edge_native_preview=1`; current marker is `2026-08-05.cendana-native-uikit-guard-v8`. It preserves the native Resi v1 / WordPress / YOOtheme page while adding same-origin optimized hero derivatives, early hero preload, delayed GTM bootstrap, first-party script defer, guarded inline UIkit icon registration, Resi runtime delay, WordPress emoji probe removal, and public HTTPS metadata correction. Current evidence lives under `/Users/mark/Property_Analytics/reports/site_audits/cendana/2026-08-05/`: local Lighthouse on 08/05/2026 measured live mobile `39` / desktop `72` and preview v8 mobile `46` / desktop `77`; preview v8 reduced mobile LCP from `7.66s` to `3.45s`, mobile transfer from `2.34 MB` to `624 KB`, and desktop TBT from `568ms` to `243ms`, but CLS remains above target in preview and needs native font/layout stabilization before live use. Guarded Worker custom-domain attempts and a separate proxied CNAME plus Worker route test showed that Worker assets can serve on `cendanalife.com`, but homepage origin fetch returns Cloudflare Error 1000 when pointed at the Cloudflare-backed WP Engine origin; Cloudflare API returns `1024` for `orange_to_orange` enablement on this zone. Mark's WP Engine admin access later exposed `cendana.wpengine.com` as a usable non-Cloudflare environment origin when tested directly with `Host: cendanalife.com`, but live Worker route testing triggered the Resi Website Management Firewall with `403 Blocked because of Malicious Activities`. The Worker sends `Host: cendanalife.com`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and trusted `CF-Connecting-IP` into `X-Forwarded-For`, `X-Real-IP`, and `True-Client-IP` for WP Engine origin requests. Public DNS remains DNS-only WP Engine service. Do not retry Cendana apex attachment or proxied route activation until WP Engine clears the firewall block, allowlists Cloudflare's published proxy ranges, and confirms real-client header interpretation.

08/04/2026 Cloudflare Agentic Ops addendum: The Cloudflare agentic-capability review has been turned into a governed local foundation rather than a parallel agent platform. `/Users/mark/Property_Analytics/docs/CLOUDFLARE_AGENTIC_OPS_LOCAL_TRACING_RUNBOOK_2026-08-04.md` documents the intended use of Cloudflare Local Explorer / local OpenTelemetry traces from `wrangler dev` for `apps/api` and `ops/cloudflare/*` Worker debugging, with Keeper, PIB, property identity, and redaction rules preserved. `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_billable_usage_collector.py` adds a read-only Cloudflare Billable Usage collector backed by `/Users/mark/Property_Analytics/config/cloudflare_billable_usage.yaml` and `/Users/mark/Property_Analytics/apps/api/migrations/0061_create_cloudflare_billable_usage_tables.sql`; `/Users/mark/Property_Analytics/apps/api/scripts/cloudflare_billable_usage_to_d1.py` mirrors those local source facts into remote D1 as an advisory D1 mirror step. It stores account/product/zone cost facts in `cloudflare_billable_usage_daily` and collection summaries in `cloudflare_billable_usage_collections`, using the dedicated Keeper record `Cloudflare Billing Token` through `KSM_CLOUDFLARE_BILLING_TOKEN_NOTATION` for account `5a5a60afaad00085864fe6bab7eb2882`, while leaving the broader Cloudflare ops token unchanged. Daily master collection now runs this as an advisory source after Cloudflare Edge Analytics, and Watchtower health includes it as a daily diagnostic advisory source. Live proof on 08/04/2026 collected and mirrored 156 current-billing-period rows to D1. The lane performs no Cloudflare mutations, no Worker deploys, no DNS edits, no cache purges, and no wallet/payment actions.

08/04/2026 TowneStone and The Vine active-rotation addendum: TowneStone has been promoted into the governed active property path rather than handled as a local exception. It now resolves through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json` as `TX4FC`, GA4 `507293675`, GSC `sc-domain:townestoneat359.com`, website `https://townestoneat359.com/`, community id `d41b32d1-9476-4936-9248-cd418f8c86be`, Richmond, TX, 28 units, lifecycle `live`, and operational status `pre_lease`. The official registry, generated community seed, remote community snapshot, and local property metadata now carry the same identity. The Vine was checked through the same lane and corrected remotely where the runtime `communities` row still carried the stale launch-era GA4-as-code / `whatscomingtokyle.com` values; D1 now reports `TX4EK` and `https://thevinekyle.com/` with GA4 `505234023`, GSC `sc-domain:thevinekyle.com`, and community id `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`. Targeted Captain activation SQL was applied only for `TX4FC` and `TX4EK` through Keeper-backed Wrangler auth. Verification shows one active `captain_activation` memory entry and 11 active `captain_support_agents` for each property: Captain Townestone and Captain Vine. Fresh GSC / URL Inspection / PSI evidence lives at `/Users/mark/Property_Analytics/reports/gsc_townestone_vine/20260803_audit/`; the 07/03/2026-08/01/2026 GSC window shows TowneStone with 216 clicks, 691 impressions, 31.26% CTR, and 4.4 average position, and The Vine with 203 clicks, 1,095 impressions, 18.54% CTR, and 14.0 average position. The Vine sampled URL Inspection was 6 of 6 indexed, while TowneStone had only the homepage indexed among sampled core URLs. TowneStone desktop PSI is strong, but mobile performance is constrained by LCP; the live site also still exposes stale `Apex West Midtown` / `TX054` body metadata, which should be treated as a site-template metadata bug rather than identity truth.

07/31/2026 TowneStone mobile-only topper preview addendum: The gated mobile-only topper experiment is live on `https://townestoneat359.com/?edge_mobile_topper=1` through Worker `townestone-native-optimizer`, version `2850dfac-08b3-4acb-a2aa-12bf2f50f2f1`, marker `2026-07-31.mobile-topper-preview-v15-approved-continuation`. The gate requires both the query parameter and a mobile user agent; normal mobile traffic and desktop traffic remain on the native WordPress/YOOtheme optimizer path. This proves the topper/shell lane can coexist with the native optimizer while limiting blast radius. v15 restores the approved Portfolio Resi Edge architecture: edge-owned mobile promo/header/hero first view, followed by a lazy, versioned native continuation iframe. The continuation route fetches the real native homepage, hides only duplicated native promo/header/hero elements, and begins visible content at the native Welcome section. This supersedes the rejected full-page lower-section reconstruction and keeps downstream property content native. v15 keeps the measured first-view parity work from v14: 60px promo bar, 80px header, 704px hero, native mobile Tour typography, right-side 270px drawer, native drawer font family/weight/spacing, native Tour/Apply drawer labels, social icons, and overlay promo dropdown. The topper uses optimized same-origin hero assets, a real prioritized mobile hero image for LCP, JSON-LD, preview `noindex,nofollow`, head metadata/favicons, and the topper event bridge into `dataLayer` and Zaraz. Live Playwright proof confirmed no horizontal overflow, mobile+flag topper gating, native route preservation for mobile no-flag and desktop flagged traffic, lazy native continuation load, hidden native promo/header/hero duplicates, visible native Welcome continuation, Zaraz present, Ahrefs present, and Heap present through the Zaraz path. Final local Lighthouse proof measured mobile performance/accessibility/best-practices/SEO of `100/100/100/69`; SEO is expected to be low while the preview remains `noindex,nofollow`. Key metrics: FCP `0.9s`, LCP `1.4s`, TBT `0ms`, CLS `0`, Speed Index `0.9s`, and root document `50ms`. Evidence lives under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-31/townestone-mobile-topper-v15-approved-continuation/`.

07/31/2026 TowneStone native optimizer addendum: A no-topper Cloudflare Worker optimization lane is now live for `townestoneat359.com/*` at Worker version `739ceb14-da63-48ac-af93-61ba3d781950`, marker `2026-07-31.native-image-delayed-analytics-v7`. This is intentionally separate from the Resi Portfolio Edge topper/shell path: it preserves the native WordPress/YOOtheme page and uses Cloudflare only for surgical homepage improvements. The Worker swaps the native heavy hero, feature, and amenity image URLs to same-origin optimized assets, places the hero preload at the top of the document head, removes the WordPress emoji probe, removes first-view hero scrollspy animation, and delays native GTM, Resi incentive widget, and direct Resi pixel loaders while keeping Zaraz active. Live browser proof confirms Zaraz/Ahrefs early tracking, delayed Heap, delayed native GTM/Resi loaders, optimized image requests, no original heavy hero/feature/amenity DAM image requests, no horizontal overflow, and intact native scroll-rendered sections. Evidence lives under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-31/townestone-native-optimizer/`. Final local Lighthouse proof after targeted homepage cache purge measured mobile `85/95/100/100` and desktop `97/95/100/100` for performance/accessibility/best-practices/SEO. This lane is useful for near-term live-site improvement without topper activation, but the mobile score ceiling remains materially lower than the managed topper/shell model.

07/31/2026 TowneStone live DNS correction addendum: `townestoneat359.com` hit Cloudflare Error 1000 because the preserved live apex target `141.193.213.21` is a Cloudflare-network/prohibited origin when used from this zone. After confirming the site family via `townestone.kinsta.cloud` and matching the working Champions Green/The Vine Kinsta O2O pattern, the final live DNS shape is proxied CNAME `townestoneat359.com -> townestone.hosting.kinsta.cloud` and proxied CNAME `www.townestoneat359.com -> townestone.hosting.kinsta.cloud`, with the Kinsta ACME `_acme-challenge` records retained. Universal SSL is enabled with an active Google universal certificate pack for `townestoneat359.com` / `*.townestoneat359.com`. Repeated live checks returned apex `HTTP/2 200`, `www` `HTTP/2 301` to apex, `ki-edge-o2o: yes`, and `ki-cf-cache-status: BYPASS`. The old `141.193.213.21` target should not be restored for TowneStone. Same-day Zaraz follow-up enabled TowneStone-scoped delayed Heap and Ahrefs Web Analytics custom HTML tools through the governed Zaraz Editor credential; combined live smoke verified Zaraz present, Ahrefs requests firing, Heap idle-gated, and Heap/Contentsquare loading after delay. Local config artifacts are redacted/summary-only.

07/30/2026 Domain Ops post-unlock 66-domain cutover addendum: After Mark confirmed GoDaddy unlock emails, fresh readback `/Users/mark/Property_Analytics/reports/domain_ops/20260730_231408_godaddy_unlock_readback/` found 66 `ACTIVE` domains with no lock/transfer/expiration/hold blocker and 25 still blocked by cancelled/ownership/lock/hold states. Selected Cloudflare cleanliness audit `/Users/mark/Property_Analytics/reports/domain_ops/20260730_231801_selected_cloudflare_cleanliness_audit/` verified all 66 staged zones were present and had zero MX/SPF/DMARC/email-routing flags under the no-email policy. The first nameserver retry at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_231820_66_clear_nameserver_cutover/` replayed stale failed GoDaddy operations because the apply script reused deterministic idempotency keys from the pre-unlock attempt, so `/Users/mark/Property_Analytics/scripts/domain_ops/apply_cloudflare_zone_import.py` now scopes GoDaddy nameserver idempotency keys by run id. Fresh-key cutover `/Users/mark/Property_Analytics/reports/domain_ops/20260730_232120_66_clear_nameserver_cutover_retry/` completed 66 of 66 nameserver operations with 0 failures. GoDaddy readback `/Users/mark/Property_Analytics/reports/domain_ops/20260730_233838_66_cutover_readback/` confirmed all 66 registrar records now use Cloudflare nameservers, and public resolver readback `/Users/mark/Property_Analytics/reports/domain_ops/20260730_234014_66_public_ns_readback/` confirmed both 1.1.1.1 and 8.8.8.8 return Cloudflare nameservers for all 66. Immediate Cloudflare status readback `/Users/mark/Property_Analytics/reports/domain_ops/20260730_234240_66_cloudflare_status_readback/` showed 50 active and 16 pending zones. No registrar transfers, city/state redirect targets, GoDaddy forwarding/lock settings, or credential material were changed.

07/30/2026 Domain Ops Cloudflare zone folder tagging addendum: Mark requested human-facing organization rather than machine-style labels. Cloudflare Resource Tagging was applied to all 185 visible zones using a `Folder` tag with values `Live Active Domains`, `Vanity Domains`, `Lease-Up / Coming Soon`, `Corporate / Platform`, and `Retired / Defensive`. Plan evidence `/Users/mark/Property_Analytics/reports/domain_ops/20260730_235608_cloudflare_zone_folder_plan/` classified 7 live active domains, 129 vanity domains, 9 lease-up/coming-soon domains, 8 corporate/platform domains, and 32 retired/defensive domains; live active exceptions include true live Resi sites such as Delta, Cendana, Monteverde, Camber Ridge, The Vine, Champions Green, and TowneStone. Apply evidence `/Users/mark/Property_Analytics/reports/domain_ops/20260730_235635_cloudflare_zone_folder_apply/` tagged 185 of 185 zones with 0 failures, and readback `/Users/mark/Property_Analytics/reports/domain_ops/20260730_235941_cloudflare_zone_folder_readback/` verified 185 of 185 tags with no mismatches. DNS records, nameservers, redirects, registrar settings, and credentials were not changed by this organization pass.

07/30/2026 Domain Ops all-domain Cloudflare staging expansion addendum: Mark clarified that every GoDaddy domain should be represented in Cloudflare, even when nameserver pointing/delegation cannot yet happen. The domain migration lane now includes `/Users/mark/Property_Analytics/scripts/domain_ops/plan_cloudflare_all_domain_staging.py`, which produces apply-compatible plans for the full 284-domain GoDaddy snapshot. Redirect-only domains use Cloudflare-native redirect activation DNS and managed Redirect Rules with source path/query passthrough and no city/state suffixes; non-redirect domains preserve readable source DNS as DNS-only Cloudflare records. The apply layer now supports all-domain DNS payloads and selector-based phases. A safe delegated pass prepared and delegated 37 not-yet-in-Cloudflare domains with evidence at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_173818_cloudflare_apply/`, `/Users/mark/Property_Analytics/reports/domain_ops/20260730_174208_cloudflare_apply/`, and `/Users/mark/Property_Analytics/reports/domain_ops/20260730_175346_godaddy_nameserver_readback/`; registrar readback confirmed all 37 use `bailey.ns.cloudflare.com` and `rick.ns.cloudflare.com`. A broader staging-only pass at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_175501_cloudflare_apply/` added/prepared 86 more domains in Cloudflare without changing GoDaddy nameservers, then stopped on Cloudflare pending-zone/rate throttles and one invalid GoDaddy MX source record. Fresh inventory `/Users/mark/Property_Analytics/reports/domain_ops/20260730_180637_cloudflare_zone_inventory/` shows 182 Cloudflare zones total, 87 active, 93 pending, and 0 paused; refreshed readiness `/Users/mark/Property_Analytics/reports/domain_ops/20260730_180646_cloudflare_dns_migration_readiness/` shows 179 of 284 GoDaddy snapshot domains now visible in Cloudflare. Current remainder plan `/Users/mark/Property_Analytics/reports/domain_ops/20260730_180654_cloudflare_all_domain_staging_plan/` leaves 105 domains not yet visible in Cloudflare, primarily because of GoDaddy transfer protection and Cloudflare throttling. No registrar transfers, city/state redirects, GoDaddy forwarding changes, lock changes, or credential disclosures were performed.

07/30/2026 Domain Ops no-email and post-lock retry addendum: Mark confirmed these domains are not used for email, so the all-domain staging policy now drops MX/SPF/DMARC and GoDaddy mail aliases instead of preserving them. The regenerated no-email plan `/Users/mark/Property_Analytics/reports/domain_ops/20260730_182607_cloudflare_all_domain_staging_plan/` reduced preserved DNS records from 438 to 150. Reapplying Cloudflare prep to the 93 pending domains at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_182619_cloudflare_apply/` succeeded for all selected rows with 130 existing DNS records, 93 managed redirect rules, and 0 DNS conflicts. After Mark disabled GoDaddy domain locks, nameserver retry `/Users/mark/Property_Analytics/reports/domain_ops/20260730_182923_cloudflare_apply/` completed `cendanalife.com` and `venterradevelopment.ca`, but 91 domains still failed. Fresh inventory `/Users/mark/Property_Analytics/reports/domain_ops/20260730_183958_cloudflare_zone_inventory/` shows 182 zones total, 89 active, and 91 pending. Current GoDaddy readback for the failed set at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_184256_godaddy_failed_nameserver_detail/` shows the remaining blocker is not just UI Domain Lock: 66 of 91 still have `transferProtected=true`, 24 still have `locked=true`, 41 have `expirationProtected=true`, 15 are `CANCELLED`, 10 are `UPDATED_OWNERSHIP`, and one has `holdRegistrar=true`. No registrar transfers, city/state redirects, GoDaddy forwarding changes, or credential disclosures were performed.

07/30/2026 Domain Ops DNS cleanup addendum: A Cloudflare DNS cleanliness audit at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_202143_cloudflare_dns_cleanliness_audit/` found 183 leftover email/GoDaddy-mail records across 37 zones that had been staged before the no-email policy was finalized. Cleanup `/Users/mark/Property_Analytics/reports/domain_ops/20260730_202726_cloudflare_dns_cleanup/` deleted 161 ordinary DNS records. The remaining Cloudflare Email Routing-managed records required feature-level cleanup, so `/Users/mark/Property_Analytics/reports/domain_ops/20260730_203014_cloudflare_email_routing_disable/` disabled Email Routing DNS on `thevineatkyleparkway.com`, `thevinekyle.com`, and `venterradev.com` using Cloudflare's documented `DELETE /zones/{zone_id}/email/routing/dns` endpoint. Final audit `/Users/mark/Property_Analytics/reports/domain_ops/20260730_203212_cloudflare_dns_cleanliness_audit/` leaves 10 `cf-bounce` Email Routing records on the two Vine zones; focused retry `/Users/mark/Property_Analytics/reports/domain_ops/20260730_203316_cloudflare_dns_cleanup_retry/` confirmed regular DNS deletion is still blocked, so remaining cleanup needs Email Routing Rules permission or dashboard removal. Redirect and non-email DNS records were left intact.

07/30/2026 Domain Ops Vine vanity spelling repair addendum: `thevineatkyleparkway.com` with "at" and `thevinekyleparkway.com` without "at" are separate portfolio domains. The with-"at" Cloudflare zone was repaired at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_204458_thevinekyleparkway_redirect_repair/` with clean proxied redirect activation DNS and 301 Redirect Rules to `https://thevinekyle.com` preserving source path and query strings. The no-"at" sibling, which was producing the WP Engine/Cloudflare 526 path, was added to Cloudflare at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_205923_thevinekyleparkway_no_at_redirect_repair/` and delegated through GoDaddy with completed operation evidence at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_210018_thevinekyleparkway_no_at_nameserver_cutover_retry/`. Registry and 1.1.1.1 nameserver readback now show `ed.ns.cloudflare.com` / `riya.ns.cloudflare.com`; Cloudflare activation was still pending immediately afterward even after activation check `/Users/mark/Property_Analytics/reports/domain_ops/20260730_210117_thevinekyleparkway_activation_check/`.

07/30/2026 Domain Ops Vine-related variant follow-up addendum: Mark approved moving `thevinekylepkwy.com` and `whatscomingtokyle.com` into the same Cloudflare vanity redirect pattern. Apply evidence at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_213846_vine_related_redirect_repair/` shows both zones created, clean proxied apex/`www` activation DNS installed, 301 Redirect Rules to `https://thevinekyle.com` installed with source path/query passthrough, and GoDaddy nameserver operations completed. Public DNS now shows both domains on `ed.ns.cloudflare.com` / `riya.ns.cloudflare.com`, both Cloudflare zones are active, and HTTPS apex/`www` first-hop smoke tests return 301 to `https://thevinekyle.com/floorplans?utm=codex-test`.

07/30/2026 Domain Ops moveable redirect-only batch expansion addendum: Mark approved moving every currently moveable redirect-only vanity domain and assessing afterward. The active move plan was `/Users/mark/Property_Analytics/reports/domain_ops/20260730_162537_cloudflare_import_plan/`, containing 30 non-transfer-protected redirect-only domains with current live targets, no city/state suffixes, and standardized Cloudflare redirect-only DNS/Redirect Rules. Cloudflare prep first attempted all 30 at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_165440_cloudflare_apply/`: 22 succeeded with 44 activation records and 44 managed redirect rules, while 8 were deferred by Cloudflare's zone-add limit until some prepared zones activated. The 22 prepared domains were delegated at GoDaddy and verified by readback; after Cloudflare capacity cleared, the remaining 8 were prepared at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_170409_cloudflare_apply/` with 16 activation records and 16 managed redirect rules, then delegated one by one through GoDaddy v3 with terminal `COMPLETED` operations. GoDaddy readback confirmed all 30 batch domains now use `bailey.ns.cloudflare.com` and `rick.ns.cloudflare.com`. Fresh Cloudflare inventory at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_171243_cloudflare_zone_inventory/` reports 58 total zones, 51 active, 5 pending, and 0 paused. Post-move assessment at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_171230_batch30_move_assessment/` reports 30 moved domains, 29 all green, 118 of 120 latest considered first-hop probes successful, all HTTP redirect probes passing, and only `thomasglenapts.com` still awaiting HTTPS/Universal SSL warm-up at the time of assessment. No city/state targets, registrar transfers, GoDaddy forwarding/locks, or credential material were changed.

07/30/2026 Domain Ops benchmark/cutover addendum: The GoDaddy-to-Cloudflare vanity-domain lane now includes repeatable before/after validation through `/Users/mark/Property_Analytics/scripts/domain_ops/benchmark_cloudflare_redirect_move.py`. The tool records apex/`www`, HTTP/HTTPS, first-hop target URL, path passthrough, query-string preservation, Cloudflare edge headers, DNS answers, timing, and before/after comparison artifacts. A first attempted five-domain sample (`avasaat1604apartments.com`, `bella-apartmentlife.com`, `belterraapts.com`, `botanicapts.com`, `bradfordmills.com`) proved an important registrar blocker: Cloudflare prep succeeded, but GoDaddy v3 nameserver operations failed with sanitized reason `Nameserver change is not allowed for the domain`; all five had `transfer_protected=1` and remain on DomainControl nameservers. The apply script now treats terminal GoDaddy operation failures as failed domains, and the readiness builder now moves `transfer_protected=1` domains to manual review for nameserver cutover. The updated readiness packet at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_162525_cloudflare_dns_migration_readiness/` shows 161 transfer-protected domains and narrows automatic redirect-only candidates to 30; the updated plan at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_162537_cloudflare_import_plan/` contains 30 redirect-only domains, 60 activation DNS records, and 60 redirect rules. A second eligible five-domain batch (`citrusrunapts.com`, `elationatgrandwaywest.com`, `falconsquareapts.com`, `liveatkeystone.com`, `pointebentonville.com`) was successfully prepared in Cloudflare and delegated at GoDaddy. The pre-move benchmark at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_161951_cloudflare_redirect_benchmark_before/` showed 0 of 20 probes fully preserving planned target/path/query and 0 HTTPS successes; the post-move packet at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_162948_cloudflare_redirect_benchmark_after/` includes direct first-hop smoke proof that 20 of 20 apex/`www` HTTP/HTTPS probes return Cloudflare `301` redirects to the planned modernized destination with `/floorplans` and query strings preserved. No city/state suffixes, registrar transfers, GoDaddy forwarding, GoDaddy locks, or credential material were changed.

07/30/2026 Domain Ops Cloudflare DNS migration readiness addendum: The GoDaddy-to-Cloudflare domain-management workstream now has a governed read-only readiness lane for moving DNS authority and operational supervision to Cloudflare before any later registrar transfer. New scripts live under `/Users/mark/Property_Analytics/scripts/domain_ops/`: `collect_cloudflare_zone_inventory.py` lists visible Cloudflare zones through the existing Keeper-backed Cloudflare token helper, and `build_cloudflare_migration_readiness.py` joins that Cloudflare inventory/local config evidence with the existing GoDaddy domain/DNS/forwarding snapshots. The first Cloudflare inventory packet at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_145647_cloudflare_zone_inventory/` found 17 visible zones, 15 active, 0 pending, and 0 paused. The first joined readiness packet at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_145913_cloudflare_dns_migration_readiness/` used the 07/15/2026 GoDaddy snapshot and assessed 284 domains, including 221 readable GoDaddy DNS zones, 149 domains with forwarding, 66 with email-related records, 14 already present in Cloudflare account/local inventory, and 3 Cloudflare zones outside the GoDaddy snapshot (`laufhutte.com`, `venterrawebops.com`, `yournamehere.vip`). Readiness output is 162 `ready`, 36 `ready_with_care`, and 86 `manual_review`. The dry-run layer, `plan_cloudflare_zone_import.py`, now produces the current Batch 1 redirect-only import plan at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_152654_cloudflare_import_plan/`: 96 redirect-only domains, 189 Cloudflare proxied placeholder activation DNS records, 189 dynamic Redirect Rules candidates, 0 preserved source DNS records, and 577 skipped source records with reasons under the standardized redirect-only DNS policy. Redirect policy modernizes `http://` targets to `https://`, passes the source path through to the configured destination base URL, and preserves query strings; 40 redirect rules were modernized at the rule level. Consistency validation found 0 activation/CNAME conflicts, 0 activation hosts missing redirect rules, 0 static target URLs, 0 remaining `http://` targets, and 0 rules missing query-string preservation. No Cloudflare zones were created, no DNS records were written, no GoDaddy nameservers/forwarding/locks were changed, no registrar transfer was started, and no auth codes or secrets were printed.

07/30/2026 Domain Ops one-domain Cloudflare prep/delegation addendum: The guarded live apply layer now exists at `/Users/mark/Property_Analytics/scripts/domain_ops/apply_cloudflare_zone_import.py`. It applies the approved redirect-only plan with `target_strategy=current_live` and `city_state_targets_applied=false`, so current live destinations remain in force while future city/state URL changes can be regenerated portfolio-wide later. Pilot Cloudflare prep was applied for `anatoleatnorman.com` only, with evidence at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_154843_cloudflare_apply/`: the pending Cloudflare zone was created, nameservers assigned as `bailey.ns.cloudflare.com` and `rick.ns.cloudflare.com`, 2 proxied activation `A` records to `192.0.2.1` were created, and 2 Domain Ops-managed Single Redirect rules were installed. Repeat apply at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_154922_cloudflare_apply/` found the 2 DNS records already present and did not duplicate them. The scoped GoDaddy v3 PAT is now represented in Keeper as the password field of the `GoDaddy DNS Token` record and is the default notation in `/Users/mark/Property_Analytics/utils/godaddy_auth.py`. Pilot GoDaddy delegation was then completed for `anatoleatnorman.com`, with evidence at `/Users/mark/Property_Analytics/reports/domain_ops/20260730_155749_cloudflare_apply/`: GoDaddy operation `DOMAIN_UPDATE_NAME_SERVERS` completed, and GoDaddy API/public NS read-back now shows `bailey.ns.cloudflare.com` and `rick.ns.cloudflare.com`. Forced-edge smoke proved both apex and `www` redirect to `https://venterraliving.com/apartments/anatole-at-norman/floorplans?utm=codex-test`, preserving source path and query string. No GoDaddy forwarding, lock, registrar transfer, auth-code, or city/state target mutation was performed.

07/29/2026 The Vine Zaraz GA4/Heap restore addendum: The Vine Kyle Parkway is live at `https://thevinekyle.com/` and remains governed as `TX4EK` / GA4 `505234023` / GSC `sc-domain:thevinekyle.com` / community id `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`. Live inspection found GA4/GTM absent and Heap only queued, so the stale-GA4/current-GSC condition was traced to live analytics loading. Google Analytics Admin resolved the GA4 web stream Measurement ID as `G-5PFVF8Y3NT`. Using the Keeper-backed `Cloudflare Zaraz Editor` record, the `thevinekyle.com` Cloudflare zone (`54bc4176f4524526a3c9ec3fb459b85a`) now has realtime Zaraz with `autoInjectScript`, `dataLayer`, and `historyChange` enabled; tools are managed GA4 `GA4V` on `G-5PFVF8Y3NT` and The Vine-scoped delayed Heap `HVnE` on production Heap app `286627304`. Live browser proof on `/` and `/apartments/` confirmed `/cdn-cgi/zaraz`, passive queued Heap, and real Heap/Contentsquare after `load + 6000ms`; GA4 realtime for property `505234023` showed `page_view`, `session_start`, `first_visit`, `edge_message_view`, and `edge_message_dismiss` on stream `Website`. Added `/Users/mark/Property_Analytics/scripts/smoke_live_analytics.py` as a repeatable live smoke for Zaraz, delayed Heap, and GA4 realtime; the first The Vine run passed with output at `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/thevinekyle_20260729/live_analytics_smoke.json`. Evidence and Cloudflare config backups live under `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/thevinekyle_20260729/`. No locked PIB generation, rendering, or sending files were modified.

07/28/2026 Morning collection alert hardening addendum: The Morning Full / collection retry / consolidated alert workflow now has a shared local Python runtime selector at `/Users/mark/Property_Analytics/scripts/lib/python_runtime.sh`. The main morning wrappers, `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh` and `/Users/mark/Property_Analytics/run_daily_health_report.sh`, use the selected Python 3.12 runtime instead of ambient `/usr/bin/python3`, avoiding missing-dependency failures after path or launchd environment changes. Source-level retry closure now has a generic reconciliation utility in `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`; the retry worker, Morning Full sender, and alert sender call it so a completed same-day source run clears stale `__source__` queue markers before closure or email decisions. The alert sender now separates manual dependency waits from true failed jobs in counts/subjects and writes structured snapshot JSON under `/Users/mark/Property_Analytics/logs/monitoring_alert_snapshots/` for post-alert diagnosis. The 07/29/2026 final review also hardened adjacent recovery paths: shared immediate collector alerts now use the canonical `EmailSender` API, and standalone Ahrefs CLI runs now write `data_collections` completion records so successful manual recovery supersedes older partial Ahrefs state. The Vine follow-up confirmed the governed live identity is `TX4EK` / `https://thevinekyle.com/` / GA4 `505234023` / GSC `sc-domain:thevinekyle.com`; freshness monitoring now ignores unknown historical GSC domains such as `whatscomingtokyle.com`, while a current-GSC/stale-GA4 condition is surfaced as a cross-source GA4 tracking/property-wiring diagnostic. No locked PIB generation, rendering, or sending files were modified.

07/23/2026 Resi Portfolio Edge v16 mobile LCP addendum: The Champions Green gated topper at `https://championsgreen-ga.com/?edge_preview=1` now runs Worker version `e4ffb09c-9086-47ca-b8b1-f3ed61f506c0` with template/schema `2026-07-23.performance-topper-v16-q36-mobile-hero`. The route remains query-gated and ungated production traffic remains native. The v16 change keeps the measured topper structure intact while serving a bundled q36 mobile hero AVIF for the existing `resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif` URL. This reduced the live mobile hero asset from the earlier R2 object size of `162,936` bytes to `65,612` bytes and brought local Lighthouse proof back to mobile `98` / desktop `100` with mobile FCP `720ms`, LCP `2345ms`, TBT `21ms`, CLS `0.0006`, and desktop TBT `0ms`. Public PSI could not be rerun because the PageSpeed API returned daily quota `429` on 07/23/2026. The bundled asset is a governed exception caused by the current Cloudflare token limitation: Keeper-backed Wrangler deploy succeeds, but remote R2 object writes still return `403 Forbidden`. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260723-v16-q36-mobile-hero/`.

07/23/2026 Portfolio Launch Proxy beta Worker proof addendum: The Portfolio Launch Proxy now has a working Cloudflare beta Worker at `https://portfolio-launch-proxy-beta.mlaufhutte.workers.dev` and `https://venterraliving.io`, version `e8894245-d94b-4c74-9160-00717d6e0b44`. The implementation is source-controlled in `/Users/mark/web-ops/projects/portfolio-launch-proxy/` and imports the generated portfolio beta manifest built from the launch readiness matrix. The manifest currently contains 80 beta-ready properties and 160 routes: old `.io` URL to new `.io` city/state URL, then city/state `.io` URL to active delivery target. Direct `venterraliving.io` requests exercise the real beta host; workers.dev preview requests can still send `x-vtr-preview-host: venterraliving.io` to emulate the beta host. Live proof covers The Pointe at Bentonville old-path redirect from `/apartments/the-pointe-bentonville/` to `/apartments/pointe-bentonville-ar/`, baseline proxy from the city/state path to the current `venterraliving.com/apartments/the-pointe-bentonville/` WordPress URL, and candidate proxy from the same city/state path to `https://thepointebentonville.kinsta.cloud/` when the route target is candidate. The Worker now also exposes the session-scoped beta switch endpoint `/__vtr-routing-ops/switch`, which sets a per-property route-target cookie for the operator browser and then returns to the old `.io` URL so the same old-to-new URL flow can render either legacy baseline or candidate origin. This is not global activation; global activation still belongs behind authenticated Routing Ops state, approval evidence, and audit logs. The Worker emits diagnostic headers for route action, route id, active target, target mode, future production URL, preview decision URL, origin URL, route-target source, and origin host. Boundary: this is a real Cloudflare beta Worker deploy and `.io` custom-domain attachment through Keeper-backed Wrangler auth, but no GoDaddy forwarding, vanity redirect, or production `venterraliving.com` route has been changed.

07/23/2026 Portfolio Launch Proxy programmatic route-state addendum: The WebOps source shelf now includes the first governed Routing Ops control-plane scaffold for programmatic switch and rollback. New contracts and tools live in `/Users/mark/web-ops/projects/portfolio-launch-proxy/`: `src/route-state.mjs`, `contracts/route-state.schema.json`, `contracts/routing-audit-event.schema.json`, `contracts/routing-control.d1.sql`, `tools/build_route_state.mjs`, `tools/switch_route_state.mjs`, and `docs/ROUTING_CONTROL_PLANE.md`. Generated beta state lives at `config/generated/portfolio-route-state.beta.json` and currently represents 80 properties, 80 switchable properties, 80 active `legacy_baseline` targets, and 0 active `candidate_origin` targets. Route tests prove that applying route state to the immutable manifest can switch The Pointe at Bentonville from the legacy WordPress baseline to the Kinsta candidate origin and back while preserving the same public `.io` URL contract. This remains local/source-controlled proof of the future production model: D1 should become the authoritative route-state and audit store, KV can cache active targets at the edge, and Cloudflare account state remains deploy output rather than system memory. No production route state, GoDaddy forwarding, vanity redirect, or `venterraliving.com` launch route was changed.

07/23/2026 Portfolio Launch Routing Ops Data Pond addendum: The Data Pond Routing Ops page at `/routing-ops/portfolio-launch` now surfaces the programmatic control-plane status alongside the live beta route behavior. The page shows the route-state contract as versioned/tested, 80 switchable rows active on legacy baseline, and D1/KV as the next authenticated mutation gate. The updated Pages preview is `https://2f8206ce.property-analytics.pages.dev/routing-ops/portfolio-launch`; unauthenticated access still falls into the normal Data Pond/Cloudflare Access login path, while protected-page smoke with mocked admin auth confirmed `Programmatic Control Plane`, `State file ready`, `D1/KV next`, and the alphabetized row order. No live global route-state mutation was added to the dashboard in this slice.

07/22/2026 Routing Ops portfolio launch command center addendum: The portfolio launch command center has moved from Experiment Lab to a first-class Routing Ops category at `/routing-ops/portfolio-launch`. The sidebar now exposes `Routing Ops` with `Portfolio Launch` as the admin-owned route-readiness surface. The screen now renders the 92-property migration as collapsible command rows: property identity, before path, after path, origin host, and condition are visible in the primary row, while route details, origin details, launch status, SEO gates, vanity-domain continuity, approval, rollback, and notes sit inside each drawer. The command center also models the improved delivery-switch concept: the public `.io` URL contract stays stable while a future route-target flag can switch between `legacy_baseline` on the current `venterraliving.com` WordPress source path and `candidate_origin` on the new platform origin. Current counts are 85 legacy-baseline rows and 80 fully switchable rows with both baseline and candidate target known. The old Experiment Lab link was removed. WebOps imported `/Users/mark/Downloads/Portfolio-Staging-URLs.docx` into `config/generated/staging-origins.json`, ignoring Pastel links; the import found 84 staging origins, all 84 matched to the governed property identity matrix, with 0 duplicate origins and 0 duplicate property-code duplicates. The regenerated route map/readiness matrix now reports 92 URL rows, 80 beta-ready rows, 5 awaiting staging origins, 4 source-path review rows, 3 identity review rows, 80 local route-test-ready rows, and 0 production-approved rows. The remaining missing-origin rows are The District Universal Boulevard, Champions Green, The Harrison, Calais Midtown, and Ventana. Validation passed for WebOps route tests/foundation validation, the Pond web build, and browser smoke against `/routing-ops/portfolio-launch` using an intercepted admin auth check. Published Cloudflare Pages preview `https://0911589f.property-analytics.pages.dev/routing-ops/portfolio-launch`; `https://app.venterradev.com/routing-ops/portfolio-launch` remains behind Cloudflare Access and returns `302` when unauthenticated. No Cloudflare, GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated.

07/22/2026 Resi Portfolio Edge v13 addendum: The Champions Green gated preview at `https://championsgreen-ga.com/?edge_preview=1` now runs Worker version `1581267b-d342-45d6-b5c9-8ec685c9dfd0` with template/schema `2026-07-22.performance-topper-v13-native-specials-heap-gate`. The route remains a query-gated measured performance topper, not a full native homepage payload, and ungated production traffic remains native. The v13 change tightens the contract by reading a runtime property overlay from the live/native homepage on cache refresh: promo enabled state, promo text/detail, desktop promo image, availability CTA, phone, tour, and apply values come from the native page when available, with the existing property constants as fallback. The route now exposes `x-resi-edge-runtime-property` and `x-resi-edge-promo-state` headers; latest live proof reported `native-fetch` and `enabled`. The current Champions Green special is preserved as `$1,000 off for a limited time!`, `*Select Homes – Limited Time Offer`, native DAM promo image, and `/apartments/?has_specials=true`. The analytics recorder remains active for pageview and required topper interactions, while Heap replay is now queued behind user interaction, pagehide, or a delayed 12-second idle gate rather than an immediate polling loop. Boundary: Zaraz still owns configured Heap/Contentsquare script loading; if the policy becomes no third-party analytics script network before interaction or consent, that must be enforced in Zaraz tool/consent configuration. Compact PSI proof after v13 passed with mobile exact/fresh `98/97`, desktop exact/fresh `100/100`, and TBT `0ms`. Evidence: `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260722-v13-native-specials-heap-gate/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v13-native-specials-heap-gate-20260722/`.

07/22/2026 Portfolio Launch Proxy readiness addendum: The governed WebOps portfolio launch project now includes a generated launch readiness matrix in both the working lab and corporate Git mirror. The builder is `tools/build_launch_readiness_matrix.mjs`; outputs are `config/generated/launch-readiness-matrix.json` and `.csv`. It derives from the portfolio route map and separates modeled URL routing from operational launch approval. Current readiness totals are 92 rows, 1 pilot-ready local beta row for Anatole at Norman / `OK4AN`, 84 rows blocked pending staging origin URLs, 4 rows blocked pending source-path review, 3 rows blocked pending identity review, 1 row marked `local_route_test_passed`, and 0 rows approved for production. The active modeled flow is `https://venterraliving.io/apartments/anatole-at-norman/` -> `https://venterraliving.io/apartments/anatole-norman-ok/` -> `https://anatoleatnorman.kinsta.cloud/`, with future production metadata `https://venterraliving.com/apartments/anatole-norman-ok/`. The matrix adds explicit fields for staging origin, origin host header, health check, origin auth, rewrite policy, SEO redirect status, canonical/robots/sitemap review, query policy, vanity-domain continuity monitoring, test status, launch batch, approval, and rollback posture. Mark clarified that vanity domains such as Camber, Monteverde, and The Vine stay in place and are not part of the migration move. No GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated.

07/22/2026 Portfolio Launch Proxy Pond dashboard addendum: The Data Pond Experiment Lab now includes a read-only Phase 1 portfolio launch command center at `/experiments/portfolio-launch`, linked from `/experiments` beside Edge Messages. The surface renders all 92 readiness rows as property command cards with before/after route, route target, command state, status, and condition visible; supporting route/status/SEO/origin facts sit in expandable drawers below each property rather than multi-column tables or side panels. It is intentionally a command/readiness view, not an action console: production approval remains `0`, and the page has no GoDaddy, Worker route, DNS, vanity redirect, or production route-publication mutation controls. `npm run build` passed, browser smoke confirmed 92 rendered property cards with the first drawer opening cleanly, and the current page deployment is Cloudflare Pages preview `https://224187ce.property-analytics.pages.dev/experiments/portfolio-launch`; the operator route is `https://app.venterradev.com/experiments/portfolio-launch` behind Cloudflare Access.

07/21/2026 Spotlight copy-change/baseline daily report addendum: A separate Spotlight daily email exists for the four-property content-refresh monitoring lane. The repeatable sender is `/Users/mark/Property_Analytics/scripts/send_spotlight_copy_change_baseline_report.py`. It reads local GA4 Organic Search and GSC daily metrics, treats The Whitney and The Harrison as changed from the 07/07/2026 afternoon copy-change point, treats Cendana District West and The Retreat as baseline-only pending content, and compares a pre-launch window against the current post-change/baseline window. The report includes a broader portfolio-average benchmark row, pre/post average-per-day bar charts, and indexed GA4 Organic Search plus GSC click line charts with a dashed portfolio GA4 average trend line so property movement can be read against broader portfolio pressure. GSC click lines stop at the latest available GSC date to avoid source-lag false drops. As of 07/23/2026, Mark approved live distribution; Codex app cron automation `daily-spotlight-copy-change-and-baseline-trends` is active again for 7:00 AM local time and sends to Mark Laufhutte, Andrew Foresi, and Alexandra Hopkins. A 07/23/2026 formatting hardening pass corrected the shell for Outlook and dark/light-mode previews by using explicit white `bgcolor` / `background-color` values and high-contrast navy/black/bay text; generated timestamp, measurement windows, source freshness, and source list now appear only in a bottom `Report context` footer. This workflow is separate from the approved Copy Change Impact Brief decision-read family and does not touch locked PIB files.

07/21/2026 ILS Direct-Start and Apartment Search Behavior addendum: The governed Ad Hoc Executive Report System now includes `ils_search_behavior` for executive questions about where renters search for apartments and how external ILS platform demand compares with Venterra-owned organic/direct traffic. Implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, is exposed by `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, renders through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`, and archives packets under `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/`. The first validated packet covers Venterra first-party data for 07/21/2025 through 07/20/2026 and lives at `/Users/mark/Property_Analytics/reports/adhoc_executive/ils_search_behavior/20260721_121426_apartment-search-behavior-and-ils-direct-start-intelligence-with-supporting-data/`. It reports Semrush June 2026 modeled Direct estimates of 43.70% for Zillow and 41.13% for Apartments.com, with Semrush/Similarweb search-driven platform demand around 35%-40%. Venterra first-party GA4 in the same packet shows 1,242,578 Organic Search sessions / 37.4% and 906,721 Direct sessions / 27.3%; GSC support covers 90 properties from 11/05/2025 through 07/18/2026 and 60,443 apartment/rental-intent query strings. Boundary: GA4/GSC are Venterra source-of-record facts, while Semrush/Similarweb are directional modeled external benchmarks. Venterra's exact share of Zillow/Apartments.com platform-internal direct-start demand remains unknown until vendor/account exports provide listing-level impressions, listing views, leads, calls, emails, tour starts, placement, and spend by property.

07/21/2026 Executive Organic Growth Intelligence addendum: The governed Ad Hoc Executive Report System now has an expanded `organic_search_share` report type for comprehensive portfolio organic traffic analysis. The implementation remains in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`, invoked by `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, rendered through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`, and archived under `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/` using the existing run-packet contract. The final executive packet covers 07/21/2025 through 07/20/2026 and lives at `/Users/mark/Property_Analytics/reports/adhoc_executive/organic_search_share/20260721_105103_executive-organic-growth-intelligence-over-the-last-12-months-brand-versus-non-b/`. It reports 1,248,372 GA4 Organic Search sessions out of 3,375,339 total sessions, 37.0% organic traffic share, 787,716 organic new users, 61.8% organic engagement, 165,419 organic key events, 195,097 GSC clicks, and 6,812,462 GSC impressions. GSC coverage in the selected window spans 90 properties from 09/17/2025 through 07/18/2026. Directional GSC query classification now separates brand/property capture from non-brand discovery: brand/property capture is 89,402 clicks and 75.2% of classified clicks; non-brand discovery is 29,513 clicks and 24.8% of classified clicks but 69.1% of classified impressions with only 1.1% CTR. The forecast model identifies about 3,194 incremental clicks from practical CTR lift across top high-impression low-CTR queries. Stored DataForSEO rows are latest 07/15/2026 and appear as advisory SERP/ranking, keyword demand, OnPage, AI visibility, SERP-domain, and SERP-gap evidence; coverage is partial, with SERP checks covering 35 properties and keyword demand covering 43 properties. Ahrefs rows are latest 07/20/2026 and appear as advisory technical/authority overlays, with average Site Audit health 97.0 and average Domain Rating 37.8. The report explicitly flags organic landing-page distribution as a collection gap because the current stored GA4 event facts have blank source/channel/landing-page dimensions for the selected window. Boundary: GA4 remains source of record for sessions/share, GSC for owned Google organic search performance, DataForSEO for advisory external SERP context, and Ahrefs for advisory technical/authority context. No locked PIB generation/rendering/sending files were touched, no email was sent, and no new standalone organic renderer should be used for future executive organic-search asks.

07/20/2026 Portfolio Launch Proxy foundation addendum: A governed WebOps project scaffold now exists for the portfolio launch reverse-proxy migration. The working lab project is `/Users/mark/Web_Operations/projects/portfolio-launch-proxy/`; the corporate Git mirror is `/Users/mark/web-ops/projects/portfolio-launch-proxy/` on branch `codex/portfolio-launch-proxy-foundation`. The scaffold captures the intended Cloudflare architecture from the launch blueprint: D1 route authority, KV runtime cache, Worker path routing, exact vanity-domain/static redirects through Cloudflare redirect primitives where useful, Data Pond/property identity validation before publishing, and account-portable configuration with secrets kept out of Git. The active pilot fixture is now Anatole at Norman / `OK4AN`: mocked old beta URL `https://venterraliving.io/apartments/anatole-at-norman/`, beta city/state URL `https://venterraliving.io/apartments/anatole-norman-ok/`, future production URL `https://venterraliving.com/apartments/anatole-norman-ok/`, and temporary staging origin `https://anatoleatnorman.kinsta.cloud/`. This models the future Venterra subdirectory route while allowing beta proof against the first supplied new-platform staging URL. The first executable local framework now imports `/Users/mark/Downloads/Location Hierarchy_Resi.xlsx`, generates a URL inventory and portfolio route map, and tests route decisions without Cloudflare mutation. Current import control totals are 92 URL rows, 89 identity matches, 3 review rows, and 0 duplicate URLs. Current route-map totals are 92 rows, 1 ready beta row, 84 awaiting staging origins, 4 source-path review rows, and 3 identity review rows. The 07/22/2026 readiness matrix adds launch-gate status on top of route modeling: 1 pilot-ready local beta row, 84 blocked pending staging origin URLs, 4 blocked pending source-path review, 3 blocked pending identity review, 1 local route test passed, and 0 production approved. Route tests prove old `.io` path redirect, city/state `.io` proxy, query preservation, unknown-route miss, and future `.com` metadata retention. No GoDaddy, DNS, Worker route, vanity redirect, or production launch routing state was mutated. This becomes the auditable source shelf for future route manifests, publisher code, runbooks, readiness evidence, and vendor SLA delegation rules.

07/20/2026 Ahrefs competitor-admin addendum: `/Users/mark/Property_Analytics/scripts/ahrefs_competitor_admin.py` now governs Ahrefs project competitor setup from local `property_competitors` / `competitors` rows resolved through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`. The script matches only canonical Ahrefs property projects, dry-runs current Ahrefs competitors through the free documented management endpoint, and requires `--apply --confirm ADD_AHREFS_COMPETITORS` before live additions. Mark approved the initial apply; 640 URL-backed competitors were added across 86 canonical property projects with zero failures. Apply artifact: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_apply_20260720T212939Z.json`. Confirmation plan: `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_competitor_plan_20260720T213015Z.json`, reporting 640 current Ahrefs competitors, 0 remaining additions, 0 Ahrefs read errors, and 0 unresolved property-identity competitor links. Seven properties still require local competitor URL completion before Ahrefs can receive their comp sets: Clearwater Heights, French Place, Monteverde, Sundara at Spring Cypress, The Vine Kyle Parkway, Town Station Lofts, and Villas Continental.

07/20/2026 Ahrefs manual crawl-start addendum: Ahrefs Site Audit crawl starts were manually kicked off through the authenticated web UI after public API probes confirmed the documented Site Audit API is read-only for this action (`POST /site-audit/projects` returned 405 and likely crawl-start endpoint shapes returned 404). The run artifact is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_site_audit_manual_crawl_start_20260720T205336Z.json`. UI automation clicked `Run crawl` or verified `Starting` / existing history across the 105-project roster. Final Ahrefs API status reported 105 projects, 105 `Completed`, 105 crawl dates, and 0 no-crawl projects. A narrow canonical collector refresh updated `/Users/mark/Property_Analytics/data/portfolio_analytics.db` `ahrefs_site_audit_project_health` for 2026-07-20 to 105 completed rows with 0 missing crawl dates. Ahrefs usage remained at 0 API key units and 0 workspace units.

07/20/2026 Ahrefs rollout completion addendum: After Mark approved proceeding, `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py` created all 79 remaining canonical Ahrefs prefix projects with zero failures. The apply artifact is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_project_apply_20260720T195235Z.json`; the follow-up dry-run is `/Users/mark/Property_Analytics/reports/ahrefs_admin/ahrefs_project_plan_20260720T195246Z.json`. The live Ahrefs roster now has 105 projects, all 93 governed identity-matrix property projects match, and missing canonical projects are 0. Discovery-only collection refreshed local `ahrefs_projects` to 105 rows with 93 distinct property ids. Ahrefs usage remained at 0 API key units and 0 workspace units after the API-supported creation and free roster/subscription calls.

07/20/2026 Ahrefs admin-prep addendum: The Ahrefs project-admin path now separates API-supported bulk creation from reconciliation that Ahrefs does not currently document as editable through the public update endpoint. `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py` still plans missing projects from the governed property identity matrix and requires `--apply --confirm CREATE_AHREFS_PROJECTS` before live creation, but each dry-run now also reports exact-target name normalization needs, likely legacy standalone-domain projects that should receive canonical `venterraliving.com/apartments/...` prefix projects, standalone property projects that must wait for a governed identity-matrix `website_url` move before future prefix creation, and review-only live projects. The latest read-only plan after the first 5 creates found 79 missing canonical prefix projects, 10 name-normalization items, 6 likely legacy-domain candidates, 7 standalone property project rows including the Monteverde duplicate, and 5 review-only live projects. The documented Ahrefs project update endpoint supports access updates only, so project-name and target URL/mode/protocol unification is tracked as manual/UI reconciliation or future API support rather than an automated mutation.

07/20/2026 addendum: Ahrefs is now a governed Keeper-first advisory Data Pond source for portfolio SEO, technical site health, domain authority, Ahrefs Web Analytics, and Ahrefs-hosted GSC Insights. The source contract is `/Users/mark/Property_Analytics/docs/AHREFS_SOURCE_CONTRACT_2026-07-20.md`; implementation lives in `/Users/mark/Property_Analytics/utils/ahrefs_auth.py`, `/Users/mark/Property_Analytics/Data_Collection/collectors/ahrefs_collector.py`, `/Users/mark/Property_Analytics/config/ahrefs.yaml`, `/Users/mark/Property_Analytics/apps/api/migrations/0060_create_ahrefs_tables.sql`, and project-admin script `/Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py`. Daily collection now runs Ahrefs after ApartmentIQ and before Cloudflare collection using only endpoints Ahrefs documents as free: subscription usage, project roster, Site Audit projects, Web Analytics stats, GSC performance history, and public Domain Rating. The new local Data Pond tables are `ahrefs_subscription_usage_snapshots`, `ahrefs_projects`, `ahrefs_site_audit_project_health`, `ahrefs_web_analytics_daily`, `ahrefs_gsc_daily_summary`, and `ahrefs_domain_rating_snapshots`. Property matching resolves through the governed property identity matrix only; unresolved Ahrefs projects remain source rows without local one-off mappings. The first live KSM-backed collection for 07/19/2026 captured 21 verified Ahrefs projects, 21 Site Audit health rows, 21 Web Analytics rows, 21 GSC summary rows, 20 distinct Domain Rating target rows, and 1 subscription usage snapshot; the post-run Ahrefs usage check still reported 0 API units used. The initial guarded admin dry-run found 93 desired property projects, 9 exact target matches, 84 missing prefix projects, 1 duplicate existing target, and 11 existing Ahrefs projects not matching the current matrix target exactly. Ahrefs complements GA4, GSC, DataForSEO, GBP, PageSpeed, Cloudflare, and internal operating sources; it does not replace those authorities.

07/18/2026 addendum: Resi Portfolio Edge v12 restored the Champions Green gated topper to the WebOps PageSpeed gate after the v11 inline official SVG increased initial document weight and slowed mobile first paint. Worker `portfolio-resi-edge-prototype` version `db8e900a-8284-4a81-9bbc-9d07ba0b16d9` now reports template/schema version `2026-07-18.performance-topper-measured-preview-v12-external-lble` and cache version `2026-07-18-performance-topper-measured-preview-v12-external-lble`. The Worker package now contains Mark's smaller plain `Live Better. Live Easy.` SVG and serves it externally at `/assets/resi-edge-assets/shared/lble.svg` with immutable cache headers instead of embedding it as a `data:image/svg+xml` source. Live proof confirms the external SVG is `22,708` bytes, hash `a21657e7a6452c6c44ad8d9deb323d3754b0bd61dd42c0586974df3eb8ae5f6d`, viewBox `0 0 294.12 72.65`, no script/event handlers, and no horizontal overflow at `390px`, `740px`, or `1440px`. PageSpeed proof at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260718-v12-external-lble/` passed with mobile exact/fresh `98/99`, desktop exact/fresh `100/100`, TBT `0ms`, and near-zero CLS. The operating lesson is now explicit: large brand SVGs should be cacheable external assets in the topper, while SVGZ should be used only when the response path can guarantee the required gzip headers.

07/17/2026 addendum: Resi Portfolio Edge v11 corrected the Champions Green gated measured topper after the official `Live Better. Live Easy.` SVG was supplied. Worker `portfolio-resi-edge-prototype` version `659e8210-84c7-43a9-b8fe-b91d26b5a981` now reports template/schema version `2026-07-17.performance-topper-measured-preview-v11-official-lble-rating-scale` and cache version `2026-07-17-performance-topper-measured-preview-v11-official-lble-rating-scale`. The official SVG is bundled into the Worker as a text module and rendered as a data URI for the hero tagline because the governed remote R2 object write path returned `403 Forbidden`; large media remain R2-served. The hero tagline aspect ratio now uses the official `374.75 / 92.57` viewBox, and a `max-width: 767px` responsive band prevents narrow tablet widths from inheriting oversized base rating/star/tagline styling. Live Playwright proof at `390px`, `740px`, and `1440px` confirmed the decoded SVG hash matches Mark's official file, no horizontal overflow was introduced, and the narrow rating row uses `22px` stars with `12px` rating text. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-v11-official-lble-rating-scale-20260717/`.

07/17/2026 addendum: The pilot Edge Message / Resi performance Worker now has its first Zaraz CMP-aware direct pixel gate. Runtime proof on `pilot.venterradev.com` confirmed `venterradev.com` Zaraz Consent Management is enabled and exposes `window.zaraz.consent`, with active choices for `Analytics & Performance` and `Marketing & Leasing Attribution` after Mark assigned the new Zaraz `Resi Pixel` custom HTML tool to Marketing/Leasing. The Worker `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now removes the native `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` homepage script and does not inject a Worker replacement loader; Zaraz is the owner for loading Resi Pixel after consent. This also fixes the prior mobile-only boundary so desktop homepage requests no longer bypass the Resi-pixel rewrite. The deployed pilot Worker version is `8601b070-f9cc-412c-b5fd-b620b7bb90a6`, with cache version `2026-07-17-zaraz-cmp-resi-pixel-zaraz-owned-v1`. Clean-browser desktop and mobile proof showed no pre-consent `js.getresi.co` request, no Worker idle loader, both purpose choices false on first load, and `vtr_edge_home_resi_pixel:native-blocked-zaraz` in server timing. After Mark saved the Zaraz `Resi Pixel` pageview action, programmatic acceptance of both consent purposes loaded `https://js.getresi.co/pixel/latest/resi-pixel.iife.js` through Zaraz with no Worker duplicate. Remaining production-hardening work: confirm the generic `Pageview` trigger is hostname-scoped to `pilot.venterradev.com`, run a visible-modal acceptance proof, and decide whether Cloudflare Monitoring should remain operational/pre-consent or be treated as analytics consent.

07/17/2026 addendum: The pilot Zaraz CMP UX was softened from an intrusive modal into a Worker-injected passive bottom notice while keeping Zaraz `Show consent modal` disabled. Worker `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now appends a small `Accept` / `Reject` / `Manage` notice on normal `pilot.venterradev.com` HTML pages. `Accept` sets all active Zaraz consent purposes true, flushes Zaraz queued events, and flushes a new session-scoped pre-consent interaction queue of lightweight first-party page/CTA facts through `zaraz.track("vtr_preconsent_interaction", ...)`; `Reject` sets all active purposes false and clears that session queue; `Manage` calls `zaraz.showConsentModal()` for the detailed preference panel. The deployed pilot Worker version is `d724adc6-cf63-4d7a-a8cf-d5866f18b317`, with cache version `2026-07-17-zaraz-cmp-passive-notice-v6` and `EDGE_ZARAZ_CONSENT_NOTICE_ENABLED=true`. The latest presentation makes `Accept` the prominent Venterra Navy primary button, keeps `Reject` secondary, and renders `Manage` as a low-emphasis San Marino text link. The direct native Resi pixel is now removed from all pilot HTML pages except excluded admin/API/static paths. Live proof showed no `js.getresi.co` request before consent on the "land -> ignore consent -> click Find Your Home -> /apartments/" path; the home page view, CTA click, and apartments page view queued in `sessionStorage`; clicking `Accept` set both purposes true, flushed all queued `vtr_preconsent_interaction` records through Zaraz, cleared the queue, removed the notice, and then loaded Resi Pixel. The reject proof cleared the queue and did not load Resi Pixel. A new unresolved-consent close/leave report path sends a minimal first-party `pagehide` beacon only when no consent option has been selected; the Worker stores sanitized reports in D1 table `zaraz_consent_unresolved_reports`, suppressing same-site internal navigation so the queue carries forward. Live proof wrote a `pagehide` row with consent false, and an Accept-then-pagehide proof sent no unresolved report.

07/16/2026 addendum: A public guided `Steps to Freedom in Christ` app surface now exists at `/steps` in `apps/web`. This is the first implementation pass for the planned `steps.yournamehere.vip` doorway and the future logged-in Freedom app maintenance/progress lane. The app bypasses the internal app sidebar/login shell through the public route allowlist, uses a source-locked content model in `apps/web/src/lib/freedom/steps-content.ts`, and renders through `apps/web/src/components/freedom/steps-experience.tsx`. The implementation preserves the document sequence and prayer/declaration wording, adding only interaction around existing document prompts: checklists, custom entries, forgiveness rows, prayer-card substitution, completion marks, export, and clear controls. Public entries are browser-session local only unless the visitor explicitly enables browser-local resume; no server persistence or authenticated progress tracking was added in this pass. Follow-up export/email/print behavior now keeps the content boundary while allowing system-sent delivery: section-level `Create prayer` controls generate individual prayers, the created worksheet email action opens an in-app recipient form, and the last step has an `Entire journey prayers` panel that compiles every selected/written prayer item in source order while preserving each as an individual prayer. The final panel can send the entire journey through same-site `/api/email`, owned by the standalone `steps-freedom-email` Cloudflare Worker with no Pond/Data API association, and can still print filled-in prayers, blank prayer worksheets with adjustable blank rows per template, a full packet, or aftercare/affirmations. The email boundary is no prayer-content persistence, no content logging, origin restriction to the Steps app, and narrow per-connection/per-recipient rate limits. The app now also supports Digital, Printable, and Facilitator session paths, privacy blur for sensitive entries, grouped final journey review by step, and attribution to `yournamehere.vip`, Neil Anderson, and Freedom in Christ Ministries in the app, exports, emails, and printouts. The latest UX correction moves the public app to progressive disclosure: a three-page orientation explains the experience, path choice, privacy/local-resume implications, and print-record handling before source text appears; in-session export/email/print/clear controls are collapsed under `Session tools`, path/privacy controls are collapsed under `Session options`, and each step begins with a short `What happens here` briefing before the exact source text. Mobile users now get a collapsed step list, compact current-step card, reduced header scale, and sticky bottom Previous/Next controls. Step 7 now treats the `Sins and iniquities of my ancestors` field as an explicit source-blank substitution: `Prepare declaration` inserts the participant's entries only at `(name those that have come to mind)` and includes the prepared declaration in final journey email/export/filled-print output. `npm run build` in `apps/web` passed with `/steps` generated as a static route. The public route was published through a dedicated Cloudflare Pages project `steps-freedom` and attached to `steps.yournamehere.vip`; root redirects to `/steps` and validation returned `302` then `200`. Future work should reuse the same source model for the authenticated Freedom app rather than copying or rewriting the content.

07/16/2026 addendum: Resi Portfolio Edge v7 tightened the active Champions Green measured performance topper by bringing the desktop header onto the same boxed content rail as the measured body sections and restoring governed document head metadata in the lightweight route. Worker `portfolio-resi-edge-prototype` version `7b0aa5fc-fe14-4750-9418-d5f7298ebc9f` now reports template/schema version `2026-07-16.performance-topper-measured-preview-v7` and cache version `2026-07-16-performance-topper-measured-preview-v7`. The header now uses `max(40px, calc((100vw - 1600px)/2))`, so live Playwright proof at `1845px` shows the header logo on `x=122.5`, the menu/right actions ending at `1722.5`, and the first content grid at `x=122.5 width=1600`. The performance shell now emits the corrected title, description, canonical, preview noindex, native favicon/apple icon links, OG/Twitter fields, and JSON-LD blocks for WebSite, LocalBusiness, ApartmentComplex, and Organization. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v7-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v7-head-header/` and passed with mobile exact `99`, mobile fresh `98`, desktop exact/fresh `100/100`, and TBT `0ms`. v7 supersedes v6 as the current measured topper baseline.

07/16/2026 addendum: Resi Portfolio Edge v6 tightened the active Champions Green measured performance topper without reintroducing native WordPress/YOOtheme payload. Worker `portfolio-resi-edge-prototype` version `4f423f8a-a456-4505-bf61-45f74434fe35` now reports template/schema version `2026-07-16.performance-topper-measured-preview-v6` and cache version `2026-07-16-performance-topper-measured-preview-v6`. The pass corrected the main hero CTA to the native measured hover/default contract, fixed the desktop hero height so welcome starts at the native `y=1400`, corrected desktop/wide page widths (`1360px` inner grid at `1440px`, `1600px` inner grid at `1845px`), clipped reveal-animation overflow, and hid the mobile welcome image to better match native mobile. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v6-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v6-width-cta/` and passed with mobile exact/fresh `99/99`, desktop exact/fresh `100/100`, and TBT `0ms`. This reinforces the current architecture boundary: exact-native is the visual measurement lane; the lightweight measured topper is the production-performance lane.

07/16/2026 addendum: Resi Portfolio Edge restored the Champions Green gated preview to the measured performance topper after the exact-native performance ceiling was confirmed. Worker `portfolio-resi-edge-prototype` version `939e9c34-69f2-40ee-8d96-64fe45541e92` now reports mode `performance-topper`, template/schema version `2026-07-16.performance-topper-measured-preview-v3`, and cache version `2026-07-16-performance-topper-measured-preview-v3`. The route `https://championsgreen-ga.com/?edge_preview=1` again serves an edge-owned topper with optimized R2 assets, zero initial `/wp-content/` payload, and lazy native continuation. The mobile and desktop drawer were corrected against the Playwright native geometry packet: desktop panel `x=990 width=450`, mobile panel `x=120 width=270`, native nav font/weight, and measured social icon positions. Visual proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-measured-topper-v3-20260716/`. PageSpeed proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716205108-pagespeed/` and passed with mobile exact `99` and `98`, mobile fresh `98` and `98`, desktop exact/fresh all `100`, TBT `0ms`, and `10` requests. This confirms the governing architecture: exact-native is the reference lane, while measured topper is the high-score delivery lane.

07/16/2026 addendum: Resi Portfolio Edge now has a measured native homepage geometry contract in the WebOps lab. The new schema `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/native-html/homepage-geometry.schema.json` and Playwright tool `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/measure_homepage_geometry.mjs` capture the live gated exact-native reference into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-geometry.json`. The capture covers desktop and mobile closed, promo-open, and menu-open states, with evidence screenshots under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/homepage-geometry-20260716/`. It records the exact native shell measurements that had been drifting in the rebuilt topper, including right-side menu panel dimensions, menu typography, social link geometry, promo overlay state, and section rectangles. `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/runtime/generate_template_structure.mjs` now embeds this geometry into the property-specific desktop/mobile template instances, and durable contract validation requires generated geometry before template instances pass. Validation passed with `/Users/mark/Web_Operations` `make validate`. This is a lab architecture step, not a live route change; it gives the high-score topper path a measured source of truth before runtime CSS/rendering consumption.

07/16/2026 addendum: Resi Portfolio Edge exact-native performance work confirmed the current architecture boundary. After the visual-fidelity exact-native publish, two surgical passes were deployed on the Champions Green gated preview. Worker `portfolio-resi-edge-prototype` version `4edaf222-35a0-4519-9973-532397d4a790` introduced `2026-07-16.exact-native-template-perf-v1`, preserving native DOM/menu/header/hero behavior while adding early hero discovery, duplicate CSS removal, preview-only analytics blocking, and delayed non-hero DAM image loading. Fresh proof moved exact-native mobile from roughly `58-59` to `70` and desktop to `98`. Worker version `e71dc168-f7d6-4bd4-b22f-63858a3535e6` introduced `2026-07-16.exact-native-template-perf-v2`, reusing the prior R2 image optimization lane for mobile only by swapping the mobile native hero to `/assets/resi-edge-assets/GA4CG/home/hero-mobile-750x1000.avif` while keeping native DOM, promo, typography, and menu behavior. Fresh v2 proof measured mobile `78` with LCP `3527ms`, TBT `328.5ms`, `25` requests, and `576221` total byte weight; desktop measured `95` with LCP `1074ms`, TBT `151ms`, `26` requests, and `1416973` total byte weight. Evidence lives under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-perf-v1-20260716/` and `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-perf-v2-20260716/`. Conclusion: exact-native is the visual calibration/reference lane, not the high-90 mobile delivery architecture. The production-worthy route remains the accurate topper/performance shell using native capture geometry, R2 assets, promo control, and lazy/native continuation; future agents should not rediscover exact-native payload limits before returning to the topper path.

07/16/2026 addendum: Resi Portfolio Edge pivoted the live query-gated Champions Green preview back to exact-native delivery after visual review showed remaining differences in the reconstructed topper, including the menu overlay and broader template area. Worker `portfolio-resi-edge-prototype` version `fc40f3cf-648b-4a1f-a6ef-7eb740a807f3` reports mode `exact-native-homepage`, template/schema version `2026-07-16.exact-native-template-head-v2`, and cache version `2026-07-16-exact-native-template-head-v2`. The gated route `https://championsgreen-ga.com/?edge_preview=1` now fetches the clean live native Resi/YOOtheme homepage and preserves the original promo, header, hero, reviews row, tagline, CTAs, menu overlay, and surrounding template HTML/CSS, adding only edge/noindex metadata. Cloudflare cache was purged for the preview homepage, root homepage, and `/favicon.ico` so the plain preview URL stopped returning the prior five-minute `performance-topper` response; plain preview headers now show `server-timing: vtr_exact_native_homepage;desc="native-dom"` and `x-resi-edge-mode: exact-native-homepage`. A follow-up head audit found that the native head was not being dropped, but the native title family was only `Champions Green`, `/favicon.ico` returned `404`, and the preview had conflicting `index, follow` plus `noindex,nofollow` robots tags. The edge now normalizes `<title>`, `dc.title`, `og:title`, and `twitter:title` to `Champions Green Apartments in Alpharetta, GA`, serves `/favicon.ico` from the native PNG favicon, adds explicit icon/apple/shortcut icon links, and leaves one preview `noindex,nofollow` robots tag. Native source HTML and geometry evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/native-html-20260716-exact/`; live preview screenshots, desktop/mobile menu screenshots, and reviews link proof live at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-20260716/`; head proof lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-template-head-v2-20260716/summary.json`. Direct browser automation against ungated native can trigger the Resi firewall, so this proof uses pulled native HTML plus the Worker-rendered exact-native preview. This supersedes the immediately prior high-score topper for the active review lane; future work should treat exact template parity as the current requirement unless Mark explicitly re-chooses the PageSpeed-optimized approximation.

07/16/2026 addendum: Resi Portfolio Edge published the SVG tagline responsive cleanup to the live query-gated Champions Green topper. Latest Worker `portfolio-resi-edge-prototype` version is `e883b995-957f-4b8e-b33f-e4e7c5beee6f`, reporting template/schema version `2026-07-16.performance-topper-v4-svg-tagline-responsive-reviews-link`, mode `performance-topper`, and cache version `2026-07-16-performance-topper-v4-svg-tagline-responsive-reviews-link`; ungated production traffic remains native. The hero tagline now renders through the existing `lble.svg` asset with an explicit `841.36 / 201.78` aspect-ratio wrapper, clamp-based responsive widths, and `object-fit: contain`, avoiding desktop/mobile font sizing drift. The same sizing contract was applied to the reusable WebOps runtime, and the live shell also received right-anchored drawer positioning plus document-level horizontal overflow protection. A follow-up navigation fix converted the hero star/review row to an actual reviews anchor. Live proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-svg-tagline-responsive-20260716-clean-v2/summary.json` measured the SVG at `691x166` on desktop and `242x58` on mobile, with complete image load and matching computed aspect ratio. Review-link proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-reviews-link-20260716/summary.json` shows `.vtr-shell-rating` is an `<a href="/reviews/">` and a browser click navigated to `https://championsgreen-ga.com/reviews/`. Compact PageSpeed proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716180818-pagespeed/PERFORMANCE_READOUT.md` passed at mobile exact `98`, mobile fresh `100`, desktop exact `100`, desktop fresh `100`, and TBT `0ms`. Validation passed through Worker syntax check, WebOps runtime smoke, WebOps visual harness, and PIB guardrails.

07/16/2026 addendum: Morning Full D1 mirror reliability was repaired after the `07/16/2026 11:23 AM` Morning Full Portfolio Report showed `D1 mirror verification failed`. Investigation found fresh local source data but a remote D1 mirror gap: Google Ads campaigns had reached `07/15/2026` in D1, while Google Ads keywords and D1 `data_freshness` were still at `07/14/2026`. The root cause was the combination of Wrangler `4.68.1` failing D1 remote file imports with `fetch failed` and large unbounded historical imports from `apps/api/scripts/google_ads_to_d1.py` and `apps/api/scripts/gsc_daily_to_d1.py`, which ignored the mirror orchestrator `--date` / `--weeks` bounds. The sync scripts now resolve those arguments into real lower-bound filters, and `apps/api` now uses Wrangler `4.100.0` with matching `@cloudflare/workers-types` `4.20260611.1`. A focused Google Ads repair loaded the missing `07/15/2026` keyword rows, then full D1 mirror verification passed at `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_20260716_121859.json` with `core_success=true`, `success=true`, and `mirror_status=success`. The regenerated Morning Full report at `/Users/mark/Property_Analytics/reports/daily_health/Morning_Full_Portfolio_Report_2026-07-16.html` now reports `HEALTHY` and D1 Mirror Status `PASS`. The Morning report renderer also now displays mirror JSON `name` / `ok` / `details` step fields instead of blank `N/A` rows.

07/16/2026 addendum: Resi Portfolio Edge received another live topper fidelity pass on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `3b0a2ac8-aa63-4f36-bf2f-d4fc4721c4bd` reports template/schema version `2026-07-16.performance-topper-v4-fidelity-p-edge-fonts` and cache version `2026-07-16-performance-topper-v4-fidelity-p-edge-fonts`; ungated production traffic remains native. The pass tightened the desktop promo overlay to the stored exact-native behavior: absolute popdown, `391px` height, desktop promo image present at `416x312`, mobile promo image hidden, no body/hero push, and a single-line desktop headline. It also restored native-like reveal motion for the welcome and features image blocks, with desktop welcome entering from the right, features entering from the left, mobile reveal support, and reduced-motion handling. A follow-up menu/type pass moved the topper from generic Arial/Georgia to native `Lato` and `Noto Serif` font faces through `/assets/resi-edge-assets/shared/fonts/...`, kept direct WordPress asset URLs out of the rendered shell, restored the native-style mobile drawer CTA labels, social icons, visible close control, and tighter drawer rail. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/topper-fidelity-pass-20260716-l2/`, with deep reveal proof in `deep-reveal-summary.json`, menu/type proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/menu-typography-20260716-p-edge-fonts/`, and PageSpeed proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260716-topper-v4-fidelity-p-edge-fonts/`. The PageSpeed gate passed at mobile exact `98`, mobile fresh `98`, desktop exact `100`, desktop fresh `100`, `10` requests, mobile CLS `0.0008`, desktop CLS `0.0003`, and TBT `0ms`. WebOps validation, PIB guardrails, and context discipline all passed. This continues the current architecture decision: exact-native remains the visual calibration source, while the lightweight topper remains the high-score gated delivery path.

07/15/2026 addendum: the governed Ad Hoc Executive Report System now includes **Property Intel Pack**, the set Content Ops companion product to PIB, governed by `/Users/mark/Property_Analytics/docs/PROPERTY_INTEL_PACK_STANDARD_2026-07-15.md` and evolved by Mark + Alexandra Hopkins. The internal report type is `content_intelligence_pack` for system continuity. The implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` and is exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`, preserving the Outlook-safe renderer, workbook, validation, run-packet, and universal sender contract. It combines fresh DataForSEO SERP rows, DataForSEO keyword demand, DataForSEO OnPage, DataForSEO AI visibility, official-page competitor market research observations, and GBP review sentiment themes. First use was on `07/15/2026` for Cendana District West (`TX4CD`) and The Retreat (`TX4GM`). Cendana's fresh SERP pull found the target in `0/5` tested top-30 priority terms, while The Retreat was found in `4/6`. Official-page competitor market packets produced `24` Cendana observations and `21` The Retreat observations, which were ingested into `competitor_market_research_observations`. Final Content Intelligence Pack emails with workbook attachments were sent to Alexandra Hopkins and Dustin Crandall with Mark copied. Mark's presentation feedback after first send: the email body was too wide in Outlook preview; future Property Intel Pack iterations should retain the evidence/workbook lane but use a narrower email-pane-friendly body, fewer KPI columns per row, compact question text, and tables that avoid horizontal clipping.

07/15/2026 addendum: the governed Ad Hoc Executive Report System now includes a single-property `content_manager_workup` report type. The implementation lives in `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` and is exposed through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`; it preserves the existing run packet, Outlook-safe renderer, validation, workbook, and universal sender contract. The workup resolves property scope through the canonical identity matrix and combines GA4 traffic/channel/action rows, GSC query language, DataForSEO keyword metrics, DataForSEO Labs ranked keywords, DataForSEO OnPage snapshots, DataForSEO business profiles, DataForSEO AI visibility probes, governed competitor sets, unit availability, guest-card DW direct rows, operating metrics, and PageSpeed metrics. First use was on `07/15/2026` for Cendana District West (`TX4CD`) and The Retreat (`TX4GM`), after fresh DataForSEO deep-trial pulls. Mark received the two Content Manager Workup emails with workbook attachments, and the two canonical PIB v2.2.1 emails covering `06/15/2026` through `07/14/2026`. Boundary preserved: locked PIB files were not modified, and no standalone custom report sender was introduced.

07/14/2026 addendum: the repository now has a mandatory human-facing date format standard in `/Users/mark/Property_Analytics/AGENTS.md`. Agents must render dates for human readers as `MM/DD/YYYY` across reports, emails, decks, documents, spreadsheets, UI labels, narrative summaries, captions, and final user-facing messages unless Mark explicitly requests a different display format in the current task. ISO `YYYY-MM-DD` remains reserved for filenames, file paths, JSON/API/database/log/spec/validation metadata, sortable IDs, and other machine-readable contracts. This is an executive-deliverable discipline update and should be applied across new or materially updated reader-facing outputs.

07/14/2026 addendum: the governed Ad Hoc Executive Report System now supports property-scoped GA4 web traffic trend and week-over-week copy-impact reports in the existing `ga4_traffic_summary` path. `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py` resolves non-portfolio `scope` values through the governed property identity resolver, then renders the same Outlook-safe run packet through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py` and the existing validation/archive flow. The report now adds daily trend rows, computes engagement rate from `engaged_sessions / sessions` when the daily engagement-rate column is not materialized, includes channel key-event totals and action-event summaries from `ga4_event_facts`, and can call the GA4 Data API through the existing service-account path for hourly afternoon copy-change splits. Copy/week-over-week subjects now trigger an impact mode that compares the prior week against the copy week and returns a Positive, Mixed, Negative, or Inconclusive verdict with channel, action-quality, timing, and daily context. Latest packets were generated for The Whitney and The Harrison for `06/30/2026` through `07/13/2026`, treating `07/07/2026 12:00 PM` as the afternoon transition point; the impact read is Mixed for The Whitney and Negative for The Harrison. Both passed Outlook safety validation. Boundary preserved: this extends the canonical ad hoc report engine and does not touch locked PIB files or introduce standalone traffic-report scripts.

2026-07-13 addendum: WebOps now has a reusable `Tabstack Web Intelligence` toolbox capability in the Web Operations lab. The canonical package is `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/`, with a catalog entry at `/Users/mark/Web_Operations/toolbox/tabstack-web-intelligence/README.md`. The capability evaluates Mozilla Tabstack as a managed public-web extraction layer for advisory WebOps R&D tasks such as competitor concession checks, vendor/product research, and schema-normalized extraction from inconsistent public pages. Mark created Keeper record `Tabstack API Key`; the shared client `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/scripts/lib/tabstack_client.mjs` resolves that record by title, supports `KSM_TABSTACK_API_KEY_NOTATION`, and leaves direct `TABSTACK_API_KEY` as a one-session fallback only. KSM-backed smoke proof passed for markdown and JSON extraction, with the latest durable command proof on `2026-07-13T201306154Z` resolving the Keeper record by title without a notation env var. A five-source Davenport / Champions Gate concessions demo on `2026-07-13T195513318Z` passed with direct property pages returning faster than aggregator/listing pages. Evidence lives under `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/evidence/`, with readout `/Users/mark/Web_Operations/projects/research-and-development/tabstack-pilot/CONCESSIONS_MONITOR_READOUT.md`. Boundary: this is toolbox-ready for advisory R&D only; it is not a production Data Collection source, Captain read, property-scoped automation, recurring monitor, or executive-report input until governed comp-set ownership, budget, cadence, QA threshold, and output/storage contracts are approved.

2026-07-12 addendum: Resi Portfolio Edge was returned to the intended high-score topper architecture after the exact-native pass established the visual source of truth but dropped PageSpeed. Worker `portfolio-resi-edge-prototype` version `9c9104e2-05c8-4898-a853-d68ea021764e` reports mode `performance-topper`, template version `2026-07-12.performance-topper-v4-native-geometry`, and cache version `2026-07-12-performance-topper-v4-native-geometry-f`. The gated route `https://championsgreen-ga.com/?edge_preview=1` now serves an edge-owned topper with R2 hero assets, promo/header/hero/welcome/features, and lazy native continuation; it does not include native `/wp-content/` payload in the scoring path. The topper was calibrated from exact-native measurements instead of guessed layout: desktop promo/header/hero/welcome/features bands align with native coordinates, the welcome image is placed at native `645x500` geometry, the Kingsley badge is back on the native left rail within a few pixels, mobile promo/header/hero geometry matches native, and the promo overlay keeps its image without body or hero shift. Final PageSpeed evidence in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712-topper-v4-native-geometry-f/` scored mobile exact `100`, mobile fresh `100`, desktop exact `100`, and desktop fresh `100` with `6` requests, CLS `0`, mobile TBT `0ms`, and desktop TBT `0-32ms`. The exact-native route below remains a calibration baseline, not the active delivery model.

2026-07-12 addendum: Resi Portfolio Edge now has an exact-native accuracy baseline on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `d1b1a82f-97c6-4d82-8ae8-b956155c94f0` reports mode `exact-native-homepage`, template version `2026-07-12.exact-native-homepage-v1`, and cache version `2026-07-12-exact-native-homepage-v1`. The gated homepage now fetches the clean native Resi homepage and preserves the real YOOtheme DOM as the visual contract, adding only edge headers/markers and promo-state control. This supersedes the approximation shell for visual parity work. Desktop proof in `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/exact-native-20260712-v1/` shows native and edge body height `7575`, hero top `126` height `1320`, welcome top `1446`, apartment features top `2186`, and Kingsley badge left `40` top `1977` size `64x64`. Mobile proof shows native and edge body height `8097`, hero top `126` height `584`, welcome top `710`, apartment features top `1431`, and Kingsley badge left `15` top `1297` size `64x64`. Promo proof confirms the native desktop popdown overlays with the desktop promo image and creates no body-height or hero-top shift. Compact PageSpeed on the exact-native route scored mobile exact `53`, mobile fresh `61`, desktop exact `82`, and desktop fresh `97`, confirming the next phase must optimize the exact native DOM instead of restoring a hand-built imitation.

2026-07-12 addendum: Resi Portfolio Edge v3 template polish is live on the query-gated Champions Green route. Worker `portfolio-resi-edge-prototype` version `5f2189b7-cbe6-4452-8685-dc2518bf19bc` reports template version `2026-07-12.performance-hybrid-shell-v3-template-polish`; ungated production traffic remains native. The polish corrected visual fidelity issues found after v2: media frames now show visible rounding, the Kingsley badge sits outside the welcome image frame, fallback welcome copy matches the native capture phrase `easy and connected`, and the lazy/native continuation iframe height guard prevents desktop from expanding into the prior large blank bottom band. Evidence lives at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-polish-20260712/`, with compact PageSpeed proof at `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260712190211-pagespeed/`: mobile exact `100`, mobile fresh `99`, desktop exact `100`, desktop fresh `100`, TBT `0ms`, CLS `0`, and `6` requests. The next decision remains whether iframe-based native continuation is acceptable as the first global template pattern or whether section-level native extraction should precede portfolio rollout.

2026-07-10 addendum: the corporate WebOps department repository has been established at `/Users/mark/web-ops` with remote `git@github.com:venterra-realty/web-ops.git`. Initial scaffold commit `48fd3c9` was pushed to `main`, replacing starter content with a corporate-ready WebOps README, charter, project index, Data Pond-readable project registry, governance standards, GitHub review templates, platform lanes, and the first project dossier shell at `projects/resi-portfolio-edge/`. Follow-up commit `11cae66` added the first draft promotion-test package for Resi Portfolio Edge: Worker source snapshot, reviewed Champions Green config example, draft image-generation utility, reviewed Wrangler example, architecture/Data Pond/performance/promotion docs, and validation checklists. A separate clean local Web Operations lab now exists at `/Users/mark/Web_Operations`; it is seeded from the reviewed corporate package and adds local lab operating docs, promotion-packet workspace, evidence/intake/archive directories, a draft dev container scaffold, and `make validate`. The lab now also has required project-memory, project re-entry, detailed session-record, and capability-awareness standards under `/Users/mark/Web_Operations/standards/memory-and-capabilities/`, a machine-readable `capability-index.json`, and the first Resi Portfolio Edge memory dossier, re-entry pack, and detailed session archive under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/`. The re-entry pack requires `START_HERE.md`, `CURRENT_STATE.json`, `LAST_SESSION.md`, `ONBOARDING_PATH.md`, `WORKING_COMMANDS.md`, and `SYSTEM_BOUNDARIES.md`, and `make validate` checks the current-state JSON. The detailed session archive at `memory/sessions/` preserves project flow for major turns so future agents can understand not just the file state but why it exists. WebOps now also requires the Daily Start / Daily Close SOP at `/Users/mark/Web_Operations/standards/memory-and-capabilities/DAILY_START_CLOSE_SOP.md`, so active work begins with current project state, open threads, capability links, boundaries, working commands, and targeted governing docs when the lane calls for them. A selective intake process now governs movement from `Property_Analytics` to `Web_Operations`; the first intake plan/candidate inventory lives at `/Users/mark/Web_Operations/intake/from-property-analytics/`, and the Resi Portfolio Edge queue lives at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/PROMOTION_QUEUE.md`. Resi Portfolio Edge now has the first externalized Data Pond-shaped property packet at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/properties/GA4CG.edge-config.json`; the project validator projects it into `/Users/mark/Web_Operations/projects/resi-portfolio-edge/src/worker/property-config.draft.js`, and the Worker imports that generated module rather than owning inline Champions Green facts. The lab Worker has also been split into a composition entry, reusable draft runtime, and generated property config, with a local runtime smoke test for health, manifest, mocked R2 passthrough, property-scoped cache keys, preview cache bypass, promo-off rendering, and required-field validation. This establishes the working split: `Property_Analytics` is the historical workshop/source context, `Web_Operations` is the clean lab and containerization layer, and `web-ops` is the governed corporate shelf for reviewed, relevant, working WebOps content. Promotion into `web-ops` should be selective, documented, validated, and free of secrets, personal content, scratch artifacts, raw sensitive exports, raw evidence dumps, and live deploy credential/config details. WebOps department scope covers Captains, Data Pond, Edge, Cloudflare/R2, Content Operations, Performance Optimization, Monitoring, and Governance.

2026-07-11 addendum: Resi Portfolio Edge now has the durable HTML-capture template architecture accepted in the WebOps lab. The ADR at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/docs/adr/2026-07-11-durable-html-capture-template.md` defines native Resi HTML as the content plane, the feed/Data Pond packet as the control plane, R2/media manifests as the optimized asset plane, and the Worker runtime as the render-decision plane. The first contract set lives at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/data-pond/edge-control-feed.schema.json`, `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/native-html/homepage-capture.schema.json`, and `/Users/mark/Web_Operations/projects/resi-portfolio-edge/contracts/runtime/render-decision.schema.json`, with Champions Green examples and validation wired into `/Users/mark/Web_Operations` `make validate`. The first native homepage extractor now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/native-html/capture_homepage.mjs`; it generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/captures/GA4CG.homepage-capture.json` from the live Champions Green homepage, and validation now checks the generated capture packet. The first render-decision generator now exists at `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/runtime/generate_render_decision.mjs`; it generated `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/decisions/GA4CG.render-decision.json`, and validation now checks the generated decision packet. Global desktop/mobile base templates now live under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/templates/resi-original-yootheme-v1/`, while property-specific GA4CG bindings live under `/Users/mark/Web_Operations/projects/resi-portfolio-edge/config/template-instances/`. Validation enforces that global templates contain no property id and that desktop promo includes the image while mobile promo is content-only. The active gated hybrid Worker path now consumes the selected template instance for promo, header, hero, welcome, and features content, and runtime smoke verifies captured native rating/copy, desktop promo image rendering, mobile promo image hiding, promo-off behavior, and manifest exposure of both template instance ids. The WebOps lab now also has Wrangler, Playwright, Lighthouse, axe-core Playwright integration, and image/screenshot support installed through `/Users/mark/Web_Operations/package.json`. `npm run visual:resi-edge` runs `/Users/mark/Web_Operations/projects/resi-portfolio-edge/tools/visual/check_hybrid_shell.mjs`, producing desktop/mobile screenshots and JSON evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/visual-2026-07-11-template-runtime/`; the current proof passes shell rendering, review-link, promo overlay no-push, desktop promo image, mobile content-only promo, image-loading, and shell accessibility checks. The live gated Champions Green path has now been rebuilt as `performance-hybrid-shell` and deployed with lazy/native continuation as Worker version `359080ad-7757-4964-bf49-4977a9ba9909`, with health reporting template/schema version `2026-07-11.performance-hybrid-shell-v2-lazy-native`. The initial gated document has no native iframe `src` and no `/wp-content/`; desktop and mobile interaction proof under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/live-lazy-native-v2-screens/` shows the native continuation loading only after intent. PageSpeed evidence under `/Users/mark/Web_Operations/evidence/resi-portfolio-edge/performance-20260711-lazy-native-v2/` scored `100` on mobile/desktop exact/fresh runs, and the WebOps lab now has `tools/performance/run_pagespeed_checks.mjs`, `npm run pagespeed:resi-edge`, and `make pagespeed-resi-edge` with retry handling for transient PSI service errors. The next implementation step is a reviewed promotion packet and a decision on iframe continuation versus section-level native extraction before portfolio rollout.

08/09/2026 supersession for the historical 07/09-07/10 Champions notes below: these entries are preserved as development history only. They must not be used as current execution authority, package proof, or permission to reuse Champions implementation code. Current execution is governed by the 08/09/2026 Resi Edge reconciliation record.

2026-07-10 addendum: Champion's Green was corrected back to the agreed hybrid native-rest architecture. Worker `portfolio-resi-edge-prototype` version `d85f1236-cbeb-4e2d-9040-0b28d5a4ddba` remains query-gated at `https://championsgreen-ga.com/?edge_preview=1`; ungated traffic remains native. The Worker now strips edge-only params before fetching origin, injects only the promo/header/hero/welcome/features shell, hides duplicated native top sections, and leaves real native reviews/amenities/benefits/neighborhood/footer in the same document. The promo module is optional via `PROPERTY.promoEnabled` and now behaves like the native popdown overlay with image/content and no layout push. This supersedes the full-page cloned shell as the active template direction.

2026-07-10 addendum: after visual review, the Champion's Green edge shell was rebuilt from a speed-only shell into the canonical Resi original-template layout shell. Worker `portfolio-resi-edge-prototype` version `a6433f54-a0ac-4f3b-a9fe-7773800f35ea` remains query-gated at `https://championsgreen-ga.com/?edge_preview=1`; ungated traffic remains native Kinsta/Resi. Template version `2026-07-10.all-device-shell-v3` follows the actual page order: promo/header, hero, welcome, apartment features, resident review, amenities, benefits, neighborhood, care band, and final floor-plan CTA. It fixes the LBLE SVG hero overlap, removes the native iframe rest-loader that exposed the Resi firewall block, and establishes the scalable model that original-template Resi sites share one layout while only property content/assets change through the manifest. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-visual-v3-final/VISUAL_V3_READOUT.md`; desktop and mobile exact/fresh PSI smoke all scored `100` with TBT `0ms` and CLS `0.000`.

2026-07-10 addendum: Pilot comparison confirmed the Portfolio Resi Edge high-score path is the static shell architecture, not a native desktop guard. Champion's Green / `GA4CG` now serves the Pilot-matched standalone shell for both desktop and mobile on the gated homepage only (`https://championsgreen-ga.com/?edge_preview=1`), while ungated traffic remains native Kinsta/Resi. Current Worker `portfolio-resi-edge-prototype` version `61ec7685-76c8-431c-b373-2cae87e35d11` uses template version `2026-07-10.all-device-shell-v1` and cache version `2026-07-10-all-device-shell-v1`; `/health` reports `config.ok: true`. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-pilot-shell-desktop-v1/PILOT_SHELL_READOUT.md`; desktop PSI scored `100` on 4/4 exact/fresh runs with median LCP `622ms`, TBT `0ms`, CLS `0.000`, and `6` requests, and mobile confirmation scored exact/fresh `100`. This all-device edge shell should be the manifest-driven portfolio template direction; the native desktop guard experiments should remain diagnostic history.

2026-07-10 addendum: Champion's Green / `GA4CG` now has the first polished query-gated mobile shell candidate for the Portfolio Resi Edge Stabilization lane. The Worker at `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/` is routed to `championsgreen-ga.com/*`, but activation remains gated by `?edge_preview=1`; ungated traffic remains native Kinsta/Resi. Polished v8 (`1cd224d8-2e57-48b5-bdba-777e8f0763f0`) adds `/health` template config validation, fixes missing CTA/badge fields and badge sizing, verifies the required analytics queue events, and keeps the route rollback to `EDGE_SHELL_ENABLED=false` plus redeploy. Evidence lives at `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-10/championsgreen-polished-v7/POLISHED_V8_READOUT.md`; mobile PSI smoke scored exact `99` and fresh `100` with LCP `1877ms`, TBT `0ms`, CLS `0.000`, and `6` requests. This should be extended into a manifest-driven portfolio template rather than copied as per-property one-off Worker code.

2026-07-09 addendum, now historical only: a draft Portfolio Resi Edge Stabilization lane was seeded for the 85 new original-template Resi sites plus the 5 Pilot sites. The SOP at `/Users/mark/Property_Analytics/docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md` defines Cloudflare/R2/Data Pond responsibilities: Data Pond and governed property identity supply property facts and source image inventory, R2 stores optimized derivatives, Cloudflare applies manifest-driven mobile shell/topper, image rewrites, promo ownership, cache separation, and script/layout guardrails, while individual Resi sites remain the content source of record. Champion's Green / `GA4CG` was the first historical original-template setup subject through `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/champions-green-ga4cg.manifest.json` and the baseline packet under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-09/championsgreen-baseline/`. This is not current execution authority; the 08/10/2026 Champions-base control uses the fresh `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json` manifest as protected base and has no selected apply target. Champion's Green q64 derivatives were uploaded to remote R2 bucket `resi-edge-assets`, and a preview-only Worker was created at `/Users/mark/Property_Analytics/ops/cloudflare/portfolio-resi-edge-prototype/`; local Wrangler preview rendered the shell from R2 with no live route, and remote workers.dev preview was deployed at `https://portfolio-resi-edge-prototype.mlaufhutte.workers.dev/` with no custom-domain route. No live traffic changes were made in this setup pass.

2026-07-01 addendum: the active Pond/Watchtower freshness model now treats SEMRush as a sunset historical source, not a live stale source. GBP review source mirroring was repaired by adding a portfolio-wide D1 mirror script, wiring it into the daily mirror, and backfilling remote D1 to the canonical local `gbp_reviews` coverage (`24,493` rows across `91` properties, latest `2026-06-02`). Recent all-skipped GBP review collection runs now record `source_limited` rather than false `completed`, and Watchtower/alerting classify that state as blocked source pressure. Follow-up review recovery found the source-limited state was not a true no-review condition: the long daily run let the raw v4 review OAuth access token expire before the review phase, and `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` had been flattening `401 UNAUTHENTICATED` into empty results. The collector now refreshes before review requests, retries `401` and transient `429/5xx`, and raises non-200 responses. Canonical local and remote D1 review coverage now match at `25,022` rows across `91` properties with latest `2026-07-01`. ApartmentIQ was also paused pending full-license approval: its active automations are paused, `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml` is disabled, and the lane should remain advisory/skipped until licensed Keeper-backed access is confirmed. Ads and GSC report-source mirroring was also hardened: GSC daily rows and Google Ads campaign/keyword rows are now required D1 mirror steps ahead of PIB/marketing summaries. Live D1 verification after backfill shows `25,729` report-grain GSC rows across `93` communities through `2026-06-28`, `13,860` Ads campaign rows across `88` properties through `2026-06-30`, and `129,181` Ads keyword rows across `88` properties through `2026-06-30`. GSC freshness now reports the same grouped community/date grain the Pond can query, not raw duplicate source rows. Guest-card freshness was corrected to the current Data Warehouse direct table (`guest_card_metrics_dw_direct`) rather than the old CSV-drop table; live D1 now reports `guest_cards` latest `2026-07-01`, `2,024` rows, `92` properties, and future DW direct runs write completed `guest_card` collection bookkeeping. The canonical PIB Conversion Behavior Snapshot now extends its existing portfolio benchmark model from summary tiles into the individual action cards, showing `Portfolio avg: X.X%` for each real event-card metric while keeping rendering in the approved PIB template family. A 2026-07-02 PIB review-card correction also prevents zero-review report windows from rendering as `0.00` average rating; those windows now read as `N/A` with latest all-time review date. Mark approved this output and locked it as PIB v2.2.1 for Pond testing; the Builder generation worker now targets the v2.2.1 generator. The locked v2.2.1 sender now routes delivery through the governed shared AWS SES-backed `utils.email_sender.EmailSender` transport instead of direct Office365 SMTP, preserving the PIB HTML body and property-specific display From name.

## 1. Why This Audit Exists

This audit is meant to answer a practical planning question:

- what do we already have
- what is active vs legacy vs speculative
- where we have duplicated effort
- which systems are canonical
- which assets are easy to forget because they live outside the main platform narrative

This document is intentionally broader than [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md).

That catalog maps the intended platform shape.

This audit maps the actual repository reality.

## 2. Audit Method

This review used:

- repo structure review across top-level directories
- READMEs and operating docs in major subsystems
- app/API route inventory in `apps/api` and `apps/web`
- script inventory across Python and shell entrypoints
- architecture memory in [ATLAS_WORKING_MEMORY.md](/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md)
- current capability docs such as [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md), [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md), [INTELLIGENCE_OFFICE_MODEL.md](/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md), and [SITE_CONTENT_CREATOR_MODEL.md](/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md)

Important note:

- this is a capability and system audit, not a line-by-line code review
- presence in the repo does not automatically mean production maturity
- several directories contain multiple generations of similar workflows

## 3. Executive Summary

The repository contains much more than one reporting stack.

At minimum, the current codebase holds:

- a canonical data platform centered on `data/portfolio_analytics.db`
- a unified data collection system in `Data_Collection/`
- a locked canonical PIB system
- legacy but still informative daily monitoring and portfolio dashboard systems
- a production-oriented Cloudflare cache audit and rollout workflow, now using The Delta Pearland as an APO case study with a live homepage-only cache rule applied and evidence that WP Engine Edge Full Page Cache was the missing upstream control needed to move anonymous HTML from `DYNAMIC` to warm Cloudflare `HIT`
- a growing Data Pond / web app / API platform in `apps/api` and `apps/web`
- a new control-plane visibility layer in The Pond that can surface the broader system landscape instead of only polished end-user product pages
- a Watchtower layer that is starting to translate platform-awareness gaps into explicit canonical next moves instead of only showing descriptive inventory
- a Watchtower control-plane model where node-level surfaces can now carry their own operating guidance instead of only category-level warnings
- a Watchtower remediation model where trust and migration tracks now expose machine-evaluated met/open criteria instead of only descriptive status text
- a Watchtower health route that now degrades safely across partial mirrored schemas, so the control plane stays visible even when optional ops tables are not yet present in a given environment
- a Watchtower Signal Deck visual experiment that gives the operator lane a darker command-surface signature while staying inside the existing `apps/web` Watchtower page and official Venterra palette
- an Intelligence Office / Site Content Creator / VACS planning and early-product layer
- a Content Office workspace that now gives channel distribution work a governed home, with GBP Posts as the first active lane and social/email/video/community channels treated as draft/handoff lanes until integrations are proven
- a Property Narrative Canon strategy layer that repositions VACS as the narrative synthesis system above downstream site rewrites, long-form drafts, GBP/social/email derivatives, FAQ/schema recommendations, Captain/Navigator content actions, and future publishing packages
- a Site Content Creator lane that is now being actively reshaped from a diagnostics-first internal console into a human-first property/page/section editing workbench with a centered page canvas and details-on-demand
- a Site Content Creator lane that now also compensates for imperfect stored crawl sections by normalizing the first critical homepage content blocks directly from live HTML on read, which keeps the editor closer to the actual site structure while broader extraction cleanup continues
- a Site Content Creator lane that now treats the homepage benefits switcher as one screenshot-driven stacked editing surface with three exact variant states, uses explicit API-carried tab labels to preserve `Pet-Friendly Fun`, `High-Tech Living`, and `Live Easy Perks`, removes the duplicated shared tab bar from the visible scene, and expands the hidden pet/tech/perks detail content inline so editors can maintain the full section text without leaving the main canvas
- a full pilot monitoring program with KPI tracker, CWV comparison, exports, and daily roundups
- an EVS / BrowserStack experiential validation system with a governed Pond bridge and explicit mixed human-and-machine lane posture
- a planned Edge Experimentation System that would let Data Pond govern small site-experience tests, Cloudflare Workers execute approved edge rewrites, Zaraz route normalized events, EVS validate selector/rendering proof, and Watchtower monitor guardrails without introducing client-side A/B tooling or shadow CMS behavior
- multiple specialized reporting products: Spotlight, Focus Report, Weekly Progress, Daily Health, Morning Full Report, Paid Media Workbook, Resi diagnostics, site audits, and GSC/PSI snapshots
- a D1 mirror governance layer that now separates core mirror success from advisory mirror degradation, so Captain-source sync flakes can be treated as a narrower mirror warning instead of a blanket D1 failure when core mirrored facts are healthy, with timeout-safe Wrangler subprocess cleanup, advisory-table schema refresh for drift-prone Captain mirror slices, and a narrowed Captain D1 packet that mirrors only the runtime read set instead of oversized global BI payloads
- a search-intelligence governance posture where SEMRush is now in graceful sunset for the daily ops layer and DataForSEO is the active successor for Watchtower/alert freshness coverage, while older SEMRush specialty/history paths remain intact for compatibility until a later cleanup phase
- a Captain active routine governance layer that defines the required property routines for source readiness, property memory, funnel watch, inventory/product watch, channel efficiency, website/content/SEO, competitor watch, reputation/friction, experience validation, and action/proof tracking, with a local Data Pond routine audit that complements the existing remote D1 Captain readiness audit
- a Fleet Scribe and expert-bench governance layer that moves final report creation above individual Captains, using Captain Read, Commodore Review, Fleet Review, targeted expert consultation, and Fleet Scribe publication/archive control so recommendations can be tuned through single specialist adjustment points without mutating approved report formats
- a formal Fleet Scribe office/directive document at `/Users/mark/Property_Analytics/docs/FLEET_SCRIBE_OFFICE_STRUCTURE_AND_BENCH_DIRECTIVES_2026-05-09.md` that details each office and current expert-bench directive setting for report publication, source authority, leasing performance, revenue, channels, SEO/content, market intelligence, product readiness, reputation, resident experience, technical validation, seasonality, unit-type fit, elasticity, operational capacity, proof, and peer borrowing
- a reporting-governance posture where Morning Full is the single routine daily summary and specialty pilot summaries are opt-in, so daily communication stays consolidated unless a true failure/recovery path needs its own message
- an executive-deliverable governance rule where an approved report, email, document, deck, spreadsheet, JSON contract, or companion artifact becomes a locked format for that workstream; subsequent work must correct data/source/content inside the approved format rather than substituting a redesigned or adjacent artifact unless Mark explicitly asks for the format change
- a closure/reporting posture where core-closed manual dependencies can now read as a specific advisory condition instead of a vague blocked state, targeted/manual specialty lanes without a scheduled run can surface as idle rather than missing, and successful Cloudflare cache audits now keep advisory findings in notes instead of overloading the failure field
- a now-explicit Cloudflare Zero Trust security architecture direction that pairs Cloudflare as the outer trust boundary with Keeper as the secret authority and app-level roles as the business authorization layer, with live service-token cutover now verified for `platform`, `vacs`, and `evs`, plus Data Pond session bootstrap from Cloudflare Access identity for human browsers, preserved browser handoff across both `app.venterradev.com` and `app.venterraliving.com`, least-privilege auto-provisioning so Zero Trust can act as the primary browser admission gate, and a hardened browser auth substrate that now emits structured Access verification telemetry, can enforce a specific browser-app AUD, distinguishes revoked/expired/unknown session failures, treats malformed magic-link tokens as invalid requests instead of 500s, and uses shared D1-backed auth rate limiting instead of per-isolate Worker memory

The most important planning truth is this:

- we do not have a lack of capabilities
- we have a capability discoverability, consolidation, and canonical-ownership problem

Foundation note added on 2026-04-17:

- the new repo-level bridge between architectural intent and actual cleanup/migration work now lives in `/Users/mark/Property_Analytics/docs/UNIFIED_SYSTEM_FOUNDATION_2026-04-17.md`
- the machine-readable companion inventory is `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
- together they define the working model for canonical systems, trust zones, nested repo boundaries, and the capabilities that still need governed visibility inside The Pond
- the enterprise anti-duplication layer now also lives in:
  - `/Users/mark/Property_Analytics/docs/CANONICAL_OUTCOME_MAP_2026-04-17.md`
  - `/Users/mark/Property_Analytics/docs/PLATFORM_CONSOLIDATION_PLAN_2026-04-17.md`
  - `/Users/mark/Property_Analytics/config/platform_outcome_map.json`
- `/system` now surfaces that outcome architecture directly in the browser so consolidation planning is visible inside the platform itself, not only in docs
- `/system` is now intentionally being repositioned as an admin/toolbox lane rather than a featured general-audience landing-page surface, which is also the first concrete step toward offering-level permissions across the Pond
- the web app now also has a shared offering-permissions foundation in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, which centralizes role-aware surface visibility, featured-lane selection, audience labeling, and future offering/action-level permission expansion instead of scattering those rules across individual pages

Operational note added on 2026-05-20:

- The approved `PIB Site Evaluation` standard now lives at `/Users/mark/Property_Analytics/docs/PIB_SITE_EVALUATION_STANDARD_2026-05-20.md`.
- Under explicit current-task approval, canonical PIB v2.2.0 now renders that evaluation as an intro block for property-level PIBs when supporting context exists, before the KPI tiles and detailed source sections.
- The intro gathers property-code-resolved DataForSEO keyword/ranking/OnPage/business context, GSC branded-vs-nonbrand query mix, BI box score, Google Ads BI fallback context, availability, PageSpeed, and review evidence into the PIB payload.
- Grand Harbor proof artifact: `/Users/mark/Property_Analytics/Property_Intelligence_Brief/reports/the-cape-at-grand-harbor/2026/2026-05-20__Property-Intelligence-Brief__the-cape-at-grand-harbor__2026-04-20_to_2026-05-19.html`.
- Boundary preserved: this does not create a parallel PIB renderer, sender, app route, or separate report family; it keeps the actual PIB report as the artifact and makes supporting detail follow the executive diagnosis.

Operational note added on 2026-06-29:

- The PIB Builder gained a governed saved-config and schedule control plane inside `apps/api` and `apps/web`.
- D1 persistence now exists for named PIB configs, editable email schedules, and schedule run history through `pib_report_configs`, `pib_report_schedules`, and `pib_report_runs`.
- `/v1/pib-builder` owns the authenticated API contract; `/analysis/pib` is now a UI over that contract rather than browser-local draft storage.
- 2026-06-30 correction: the lightweight Data Pond handoff email was rejected as non-PIB and corrected. The Cloudflare Worker scheduled hook and manual Email Now now send the latest published canonical Outlook PIB HTML artifact from R2 (`pib/reports/<property-slug>/`) through the existing Resend adapter. Runs record `sent`, `failed`, or `blocked`, and missing artifacts block as `canonical_pib_artifact_missing`.
- `/v1/pib-builder/artifacts/latest` serves the same canonical HTML artifact for app display, and `/analysis/pib` opens that artifact for property reports rather than routing to the D1 dashboard-style `/pib/property` view.
- Remaining system gap: on-demand generation from the Pond click path is not fully connected because the approved PIB generator is Python and the live API is a Cloudflare Worker. Future work should add a canonical generation worker/orchestrator that runs the approved PIB report family, publishes the HTML artifact, then lets the Builder send/show that artifact.
- Boundary preserved: no locked PIB generation/rendering/sending files were mutated and no alternate PIB renderer/template/sender was introduced in the Pond apps.

Operational note added on 2026-07-01:

- The Edge Message Toolkit was promoted from the Apex/pilot proof toward a production The Vine Kyle Parkway launch on `thevinekyle.com`.
- The Vine identity was resolved through the governed matrix as `TX4EK` / `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`; the live homepage and `/apartments/` were inspected, and `/apartments/` exposes `All-In Price & Details` buttons suitable for the existing coach-mark pattern.
- The production homepage message is `Join the VIP List` with supporting copy `Receive insider updates, leasing specials, and early access opportunities.` and CTA `Get in the Know!` to `/contact/#contact`.
- The Edge Messages API/admin now separate draft saves from explicit Launch/Pause/Rollback active-config writes in D1. The Worker fallback config is The Vine-specific and disabled by default; launch is a D1 state change, pause/rollback write `enabled:false`, and launch forces production frequency capping.
- Runtime event handling now sends CTA click telemetry to `dataLayer`, direct GA4 `gtag`, and Heap direct-or-queued tracking, while preserving delayed fade-in, countdown/progress, and auto-close behavior.
- The Cloudflare Worker config now uses production Worker name `edge-message-worker` and The Vine route patterns. Keeper-backed deployment succeeded as Worker version `9dc42d2b-bb7b-4232-9fbb-3e58029bfdef`, and remote D1 has active VIP-list config version `4` with `2000ms` intro delay, `600ms` fade-in/fade-out, `7000ms` on-screen countdown, and the grey countdown/progress treatment. Production traffic now passes through the Worker after the `thevinekyle.com` and `www.thevinekyle.com` CNAME records were switched to proxied while preserving Kinsta origin target `thevine.hosting.kinsta.cloud`; live headers confirm Kinsta O2O (`ki-edge-o2o: yes`).
- 2026-07-02 demo note: the original Apex/pilot homepage popup and apartments helper tag were reinstated on `pilot.venterradev.com` through existing Worker `edge-transparent-pricing-intro-beta` version `e446f570-e373-409f-a8fb-446c4866bf59`. Route ownership is now split in source: `wrangler.pilot.toml` deploys `pilot.venterradev.com/*`, while `wrangler.toml` keeps `edge-message-worker` on The Vine. Cache-busted smoke confirmed `edge_transparent_pricing_intro_homepage_v1` on `/` and `edge_message_all_in_pricing_coachmark_v1` on `/apartments/`, with the existing `vtr_edge_sightmap` marker retained on apartments. The follow-up admin deployment `https://7e9eb13d.property-analytics.pages.dev` restores both pilot records as editable cards in `/experiments/edge-messages`.
- 2026-07-02 performance-check note: the pilot Edge Message script load was temporarily paused through Worker env vars in `wrangler.pilot.toml`, deployed as `edge-transparent-pricing-intro-beta` version `0852f99a-d8fe-408c-a58f-8e49d4186b28`. The Worker code now reads `EDGE_MESSAGE_INJECTION_ENABLED` and `EDGE_COACH_MARK_INJECTION_ENABLED` with default-on behavior, so The Vine remains unaffected. Live verification showed `data-edge-message=0` on pilot homepage and apartments while the separate `vtr_edge_sightmap` lazy-load layer stayed active. Local browser comparison reduced HTML weight and one resource/script per page, with modest LCP improvements; quick keyed PSI post-pause runs were noisy (`72`, `61`, `61`) versus the earlier `2026-07-02` daily CSV score of `73`, so no PSI improvement should be claimed from this quick sample.
- 2026-07-03 mobile timing note: after Mark removed two homepage sections, pausing the mobile homepage popup during initial render produced the strongest result (`92` PSI, LCP `2.701s`). A timer-only popup delay POC was then added behind `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS` and `EDGE_MESSAGE_MOBILE_AFTER_LOAD_IDLE_TIMEOUT_MS`. The `3500ms` after-load variant was locally clean but PSI-unstable (`93` once, `70` twice), and the `6500ms` variant did not validate (`70` after two Lighthouse `500`s). The pilot was restored to `EDGE_MESSAGE_MOBILE_AFTER_LOAD_DELAY_MS="0"` in Worker version `da173432-dbd4-4b3c-837d-6f822a892bb4`. Timer-only delay should not be treated as the durable fix; next tests should use interaction/scroll-gated mobile messaging, inline/lower-page messaging, or mobile-homepage suppression while preserving desktop and apartments messaging.
- 2026-07-03 scroll-trigger note: the no-script vs scroll-triggered comparison found that removing the homepage popup script is fastest, but scroll-triggered mobile messaging is close enough to keep as a demo compromise. No homepage popup script scored fresh-query keyed PSI `94` / LCP `2.401s`; scroll-triggered mobile scored `92` / LCP `2.626s` and proved overlay `0` before scroll and visible after scroll to `700px`. Exact clean-URL PSI repeated stale/low cached-looking `67-70` runs across both states, so fresh-query runs are the fair same-session comparison. The live pilot now uses scroll-gated mobile homepage messaging in Worker version `642f82c4-93b0-45a0-828f-cc66c1103d9c`.
- 2026-07-07 stabilization note: the pilot homepage popup is now kept paused for performance testing while apartments coach-mark behavior remains separate. A narrow mobile homepage Resi pixel idle-load POC was added to the same Worker and enabled by `EDGE_HOME_RESI_PIXEL_IDLE_ENABLED="true"` / `EDGE_HOME_RESI_PIXEL_IDLE_DELAY_MS="1750"`, deployed through Keeper-backed Wrangler as `edge-transparent-pricing-intro-beta` version `c14f350f-a310-4d42-9eb7-88c37e9ae4c3`. The POC improved the fresh-query TBT branch versus the immediately prior retry, but did not stabilize the clean exact URL: clean scores remained `70/71/70` with median LCP `4964ms` and TBT `0ms`. Treat this as temporary TBT hygiene only; durable stabilization still belongs in native YOOtheme/source work, especially mobile hero simplification and reducing above-fold UIkit initialization.
- 2026-07-07 query-normalized cache note: Mark's intended Kinsta-as-warmer plus Cloudflare-as-global-cached-shell strategy was tested on Pilot. The Worker homepage HTML cache is enabled with `EDGE_HOME_HTML_CACHE_ENABLED="true"` and cache version `2026-07-07-query-normalized-v1`, deployed as Worker version `19d82787-c011-4458-8a6a-579c6f6fa04f`. Marketing query strings no longer fragment the anonymous homepage HTML cache key; DNI/tracking can still run after load from `location.search`. Preview/editor/search/admin params and logged-in/session cookies bypass cache. Verification showed mobile and desktop clean/query variants HIT the edge cache after warmup, while `?preview=true` bypassed. PSI root document response is fast (`10-30ms`), query-string median scored `90`, and clean exact still stayed low (`71/71/71`), so cache delivery is now behaving as designed but the exact-URL Lighthouse paint branch remains a separate issue.
- 2026-07-07 post-vendor validation note: after vendor-reported YOOtheme fixes, Pilot live mobile markup now has the accepted `Apex-West-Midtown-Home-Hero-750.webp` with explicit eager loading, high fetch priority, dimensions, and no homepage slideshow marker. The explicit eager attribute was added in the Edge Worker and deployed as version `0a719df4-43b2-4c38-b52c-e16fc7152005`, with the homepage HTML cache version bumped to `2026-07-07-hero-eager-v1`. Playwright mobile showed strong real-browser medians (`462ms` clean LCP/FCP and `422ms` query LCP/FCP), but PSI still had a lab variance branch: exact clean scores `89/89/71`, fresh/query one successful `89` plus two Google Lighthouse `500`s. Accessibility validation found `/reviews/` and `/contact/` social/map icon labels fixed, but homepage header/footer social/map icon copies still lack accessible names. Slideshow validation found `/apartments/` still contains one-image floor-plan card slideshow structures while homepage and the sampled content pages do not. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/POST_VENDOR_UPDATE_VALIDATION_READOUT.md`.
- 2026-07-07 PSI mock variant note: the Pilot Worker now has query-gated diagnostic variants behind `psi_mock` for homepage source-change simulation, with isolated Cloudflare HTML cache keys so mock HTML does not pollute the normal homepage cache. Worker version `73a91ac5-647f-4b12-b53f-949646937063` supports `no_dropbar`, `no_sticky_header`, `fixed_hero_height`, `no_welcome_scrollspy`, `static_review`, and `all`. Playwright cached mobile runs showed baseline median LCP `480ms`, core mock `532ms`, and all mock `568ms`; PSI mobile showed baseline median score/LCP `92` / `2627ms`, core mock `87` / `2401ms`, and all mock `75` / `4957ms`. Conclusion: remove the inactive homepage dropbar/promo first and retest; do not broadly disable all UIkit behavior or the review slider based on this sample. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-07/PSI_MOCK_VARIANTS_READOUT.md`.
- 2026-07-08 hero viewport-height stabilization note: after builder inspection showed the remaining YOOtheme `uk-height-viewport="offset-top: true;"` came from an internal hero panel wrapper rather than an exposed admin control, the successful diagnostic mock was promoted to a guarded mobile-only Pilot homepage Worker path. `EDGE_HERO_VIEWPORT_HEIGHT_REMOVAL_ENABLED="true"` removes the wrapper attribute, marks the panel, and injects a stable mobile `min-height:718px` rule; `EDGE_HOME_HTML_CACHE_VERSION` is now `2026-07-08-hero-viewport-removal-v2`. Keeper-backed deploy published `edge-transparent-pricing-intro-beta` version `092e43d1-e5e8-4748-8507-13069f3d8490`, keeping homepage Edge Messaging paused and apartments coach-mark behavior unchanged. Attribute-removal-only v1 did not stabilize PSI (`84/77/76`), but the corrected v2 warmed-cache packet scored `94/94/94` with median LCP `2552ms`, FCP `1969ms`, TBT `0ms`, CLS `0.00712`, `31` requests, and `0` Heap/Contentsquare requests. Treat this as a guarded Pilot stabilization proof and keep cache warmup as part of any post-deploy/cache-version PSI judgment.

- The July Spotlight property master roster was activated from Mark's screenshot through the governed monthly config path.
- The active July config lives at `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-07.json`, with companion source/import files `July_2026_Spotlight_Properties.csv` and `monthly_import_names_2026-07.csv`.
- The July set is Cendana, Elation, Retreat, Canton Mill Lofts, Clearwater Heights, College View, Gateway North, Luminary, Silverbrooke, Baywood, Shadowbrooke, St Andrews, and Westover. Cendana, Elation, and Retreat are marked `Critical`; the rest are `Spotlight`.
- Copy Change Impact Brief daily scope now follows the active Spotlight roster plus explicitly retained action exceptions, so historical copy interventions remain in storage without overcrowding the daily executive report.

Operational note added on 2026-06-01:

- The June Spotlight property list was refreshed from `/Users/mark/Downloads/June Properties.xlsx`; correction after workbook tab review: the authoritative June roster is the property-tab roster, not the shorter funnel-summary selection rows.
- The active June config lives at `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-06.json`, with companion source/import files `June_2026_Spotlight_Properties.csv` and `monthly_import_names_2026-06.csv`.
- The June set is Canton Mill Lofts, College View, Elation, Forest View, Gateway North, Grand Harbor, Lakeland, Luminary, Maddox, Retreat, and Town Station. College View, Forest View, and Gateway North are marked `Critical`; the rest are `Spotlight`.
- The Spotlight Performance Roundup now reads the latest monthly Spotlight config instead of a hardcoded Spotlight 11 list, keeping the approved PSI-first report shell while allowing monthly set rotation through the governed config path.
- The Pond Spotlight helper now reflects the corrected 11-property June tab order, and the legacy Spotlight registry falls back to the governed property identity matrix for GA4-backed properties that are absent from its older local registry.
- The prior June Captain roster activation was generated and applied remotely through the existing Keeper/KSM-backed Wrangler helper for the shorter `8` property extraction and `88` support-agent rows; rerun from the corrected 11-property config before treating Captain roster scope as current. `scripts/standup_captain_roster.py` now uses a dynamic activation timestamp instead of the stale May 4 value.

Operational note added on 2026-06-03:

- The repo now has a shared local Keeper runtime bootstrap for recurring automation at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh`, plus a matching Node self-bootstrap helper at `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs`.
- The governed Data Warehouse Node entrypoints and readiness probe now use that helper to verify Keeper/KSM readiness and re-exec through the bootstrap shell when the parent process lacks the needed runtime envelope, instead of failing immediately on a fresh shell.
- 2026-06-10 follow-up: the governed outer wrapper `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh` now logs before preflight, uses `node scripts/check_data_warehouse_keeper_ready.mjs` as the authoritative Keeper gate for this lane, and adds a dedicated connectivity preflight `/Users/mark/Property_Analytics/scripts/check_data_warehouse_connectivity.mjs` inside a bounded wait loop. Recurring runs therefore record the actual notation-based warehouse readiness result, classify DNS/TCP failures as sanitized VPN/network issues, and wait for the warehouse host to become reachable instead of failing the full workflow immediately on the first transient miss.
- Existing recurring shell wrappers `run_daily_health_report.sh`, `run_collection_retry_cycle.sh`, `run_apartmentiq_daily_light.sh`, and `run_apartmentiq_weekly_dive.sh` were also moved onto the shared bootstrap helper so Keeper runtime assumptions stop drifting across wrappers.
- Verification from the previously failing fresh shell context on `2026-06-03` succeeded: `node scripts/check_data_warehouse_keeper_ready.mjs` returned `OK`, and the governed seven-step Data Warehouse workflow completed end-to-end with packet roots under `/Users/mark/Property_Analytics/outputs/data_warehouse/` and `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/`.

Operational note added on 2026-06-10:

- Venterra Clearwater was seeded as the named premium glass UI direction for Data Pond web surfaces, extending the official Venterra brand color standard instead of creating another ad hoc visual language.
- The governing standard is `/Users/mark/Property_Analytics/docs/VENTERRA_CLEARWATER_UI_STANDARD_2026-06-10.md`.
- Shared opt-in primitives and tokens now live in `/Users/mark/Property_Analytics/apps/web/src/components/shared/clearwater-glass.tsx`, `/Users/mark/Property_Analytics/apps/web/src/app/globals.css`, and `/Users/mark/Property_Analytics/apps/web/tailwind.config.ts`.
- The first proof surface is the shared Pond landing page at `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx`, covering both `/` and `/pond`.
- The proof was deployed through the Keeper/KSM-backed Wrangler path from an isolated clean deploy worktree to Cloudflare Pages project `property-analytics`, branch `main`; the corrected glass deployment is `https://9b1073ce.property-analytics.pages.dev`, with `https://app.venterradev.com/pond` still protected by Cloudflare Access.
- Visual correction note: the first live pass used the right structural system but read as opaque blue panels. The corrected pass reduced card opacity, strengthened `backdrop-filter` blur/saturation/contrast, added clearer bevel highlights, and made the underlying official-palette gradients more visible so the glass has an environment to refract.
- Second visual correction note: the current visible-glass deployment is `https://3c9626dd.property-analytics.pages.dev`. Zone cards now remove their own blue gradient fill, rely on `clearwater-lane-field` behind the cards for environmental color, use `clearwater-lens-card` near-transparent fill, and avoid the previous reduced-transparency path that could make Clearwater panels opaque.
- Restraint correction note: the current preferred deployment is now `https://29bddb6b.property-analytics.pages.dev`. The prior visible-glass pass overcorrected into neon/blue acrylic, so the fourth pass follows the Clay glassmorphism guidance more closely: moderate blur, selective glass surfaces, a dark contrast floor, and non-blur repeated data tiles.
- Tightening note: the current preferred deployment is now `https://69d8ebd1.property-analytics.pages.dev`. This pass keeps the restrained direction but lowers border/highlight intensity, reduces background wash, darkens the lens cards, and treats the PIB shortcut as a utility data card rather than another large glass banner.
- Watchtower Signal Deck note: `/watchtower` now carries a scoped experimental command-deck treatment using `watchtower-stage`, `watchtower-signal-shell`, `watchtower-panel`, `watchtower-rail-card`, `watchtower-horizon`, and `watchtower-signal-node` utilities in `/Users/mark/Property_Analytics/apps/web/src/app/globals.css`. The pass was locally rendered with sanitized mock health/landscape payloads, deployed through the Keeper/KSM-backed Wrangler path, and is live at `https://0bbe7ad5.property-analytics.pages.dev/watchtower`; the custom domain route remains Cloudflare Access-protected.
- Locked PIB generation/rendering paths were not touched; this is a platform UI system slice, not a PIB artifact-format change.

Operational note added on 2026-06-19:

- GTmetrix remains an API-backed Data Collection / pilot CWV source route rather than a production MCP-backed collector. The canonical collector at `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py` now resolves its API key through the shared Python Keeper/KSM helper first, using the governed MarketingOps GTmetrix notation default and honoring the legacy GTmetrix notation env var during migration.
- Existing API behavior remains intact: report polling, rate-limit header capture, pilot/control retry handling, credit guarding, DB writes, and same-day freshness validation still live in the current collector and pilot workflow.
- Transitional fallback remains limited to the direct `GTMETRIX_API_KEY` env var and the existing configured local key path. No new local credential file, `.env`, checked-in secret, MCP dependency, or alternate GTmetrix runner was introduced.

Operational note added on 2026-06-30:

- The PIB Builder/Data Pond path has been reconciled back to the approved canonical PIB artifact family. Builder emails and app opens now use the latest published Outlook-safe PIB HTML artifact from R2 rather than a Data Pond summary email or dashboard substitute.
- The implementation is orchestration-only: locked PIB generator/template/sender files were not changed. The new D1 `pib_report_generation_jobs` table and `/v1/pib-builder/.../generation-jobs` endpoints queue property-level canonical generation when an artifact is missing.
- `/Users/mark/Property_Analytics/scripts/process_pib_builder_generation_jobs.py` is the worker bridge between the Pond and the approved Python generator. It resolves Cloudflare auth through the existing Keeper/KSM Wrangler helper, runs the v2.2.0 generator, uploads the generated HTML to `pib/reports/<property-slug>/`, and updates the job record for the Builder to send/open. The launchd agent `/Users/mark/Property_Analytics/ops/launchd/com.venterra.pib-builder-generation-worker.plist` is installed at `/Users/mark/Library/LaunchAgents/com.venterra.pib-builder-generation-worker.plist` and runs up to `3` queued jobs every `60` seconds.
- The Builder UI now follows a progressive request flow: property/date first, report-area metrics second, then output choice. Email/Open are the only initial output choices, neither is preselected, email recipients are revealed only after Email Now, and report naming/scheduling controls appear above the generated report preview after the report is produced.
- Generated artifacts now have a D1 chunk fallback. The worker writes generated HTML into `pib_report_generation_artifact_chunks` before marking a job succeeded, and the API reassembles those chunks if R2 lookup misses. This was added after remote R2 object writes returned `403` for the current Cloudflare token while the report had actually generated locally.
- The first live deployment of this reconciliation is API Worker `06349865-b134-4715-98e2-4df4fe9f3540` plus Pages deployment `https://53fc750d.property-analytics.pages.dev`.

Operational note added on 2026-07-01:

- The PIB Builder generated-artifact fallback was hotfixed after a live Canton Mill Lofts request generated approved PIB HTML into D1 chunks but stayed blocked in the UI. The API now discovers succeeded generation jobs with chunked artifacts even when `artifact_html` is empty.
- The Builder UI now shows a build progress meter across queued, building, publishing, sending/opening, and complete states for on-demand Email Now/Open Report Now actions.
- Live hotfix deployment: API Worker `68141e2c-2e16-48e7-914c-592cb429deb4` and Pages `https://3397607c.property-analytics.pages.dev`.
- Follow-up Pages deployment `https://5f2ae45f.property-analytics.pages.dev` merged the newer Edge Messages state with the PIB Builder progress fix and redirects `/pib` to `/analysis/pib` so the legacy Build Context panel no longer appears as the Builder entry point.
- Boundary preserved: no locked PIB generator/template/sender files were modified, and no alternate PIB renderer was added to the Pond apps.

Operational note added on 2026-06-22:

- The Marketing Ops shared credential import lane remains the existing Keeper Commander utility `/Users/mark/Property_Analytics/keeper_marketing_ops_import.py`; it now has a governed legacy workbook mode for `/Users/mark/Downloads/Venterra Marketing Log ins.xlsx` rather than a separate spreadsheet converter or local secret store.
- `--venterra-marketing-logins-workbook` reads the known multi-sheet workbook shape and preserves source sheet/row provenance as Keeper custom fields. `--include-reference-records` can include URL-only reference sheets, and `--allow-blank-passwords` is an explicit complete-archive choice for source rows missing passwords.
- Dry-run proof passed without printing or persisting raw secrets: `191` credential-style records were ready, or `388` records when reference URLs were included. After Mark completed Keeper Commander SSO/device approval locally, the 191 credential-style records were imported into `Marketing Ops Shared Credentials` for team `Marketing Ops`; URL-only reference rows were intentionally not included. KSM is present for runtime secret reads, but Keeper Commander remains the shared-folder record creation/import path.

Operational note added on 2026-06-23:

- A narrow Keeper main-tree cleanup utility now lives at `/Users/mark/Property_Analytics/scripts/keeper_remove_email_records.py` for removing visible login/email records matching personal domains (`gmail.com`, `laufhutte.com`) while excluding `Marketing Ops Shared Credentials`.
- The successful human-present cleanup removed `180` matching records from the user's main vault tree using normal Commander remove behavior, not permanent purge. The tool avoids raw password/secret output and requires typed `DELETE N` confirmation.
- Commander persistent-login/device setup was attempted, but one-shot Commander/API calls still hit SSO/runtime policy friction in this environment. Treat future vault mutation work as human-present unless Keeper admin enables Commander Service Mode or a policy-supported non-interactive maintenance path.

Operational note added on 2026-06-25:

- The preliminary Ad Hoc Executive Report System is now the governed path for Outlook-safe PIB-style specialty reports that do not belong to a locked PIB family. The CLI front door is `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py`; orchestration is `/Users/mark/Property_Analytics/utils/adhoc_report_orchestrator.py`; source routing is `/Users/mark/Property_Analytics/utils/adhoc_report_sources.py`; rendering is `/Users/mark/Property_Analytics/utils/outlook_report_builder.py`; validation is `/Users/mark/Property_Analytics/utils/outlook_email_validator.py` and `/Users/mark/Property_Analytics/scripts/check_outlook_email_safety.py`; and delivery continues through `/Users/mark/Property_Analytics/utils/email_sender.py`. Every run writes the future Pond handoff packet under `/Users/mark/Property_Analytics/reports/adhoc_executive/<report_type>/<run_id>/` with request, spec, HTML, workbook, validation, delivery, and source artifacts. Current report types are `organic_search_share` and `ga4_traffic_summary`. This should be extended into Pond as a UI over the same engine rather than rebuilt as a web-only generator.

Operational note added on 2026-06-16:

- The Vine Kyle Parkway was corrected from prelaunch/non-live to live pre-lease after Mark confirmed the live-site stage and property code `TX4EK`.
- Governed identity inputs now resolve The Vine through `TX4EK`, GA4 `505234023`, community id `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`, website `https://thevinekyle.com/`, and GSC `sc-domain:thevinekyle.com`.
- The official registry row now uses `lifecycle: live` and `operational_status: pre_lease`, which avoids the existing prelaunch suppression tokens while preserving the lease-up business context.
- The Vine's P&A page is `https://thevinekyle.com/apartments/`; this path is now seeded in registry `known_page_paths` so future GSC URL Inspection samples include the actual P&A page. Direct GSC inspection on 2026-06-16 returned `URL is unknown to Google` for `/apartments/`.
- `TX4EK` was removed from the Data Warehouse expected pre-live lifecycle gap list. This closes the earlier local identity gap for The Vine; Sundara / `TX4CY` remains the governed pre-live exception.
- Boundary preserved: this extends the existing property registry, property identity matrix, and canonical GSC collection/URL Inspection lanes. No PIB files, alternate renderers, or downstream one-off property maps were added.

Operational note added on 2026-06-04:

- The shared Keeper shell bootstrap was hardened after a real ApartmentIQ daily-light failure showed the prior helper was not actually making runtime identity stable; it only filled `HOME` / `USER` / `LOGNAME` when unset, so a bad inherited `HOME` still broke `ksm` profile resolution.
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` now forces `HOME=/Users/mark`, `USER=mark`, and `LOGNAME=mark`, exports `KSM_APARTMENTIQ_ACCOUNT_ID_NOTATION` in addition to the ApartmentIQ API-key notation, and provides `pa_require_marketingops_keeper_ready` so recurring shell wrappers can fail at the Keeper boundary instead of cascading into downstream Python stack traces.
- The four wrappers already standardized on the shared shell bootstrap now call that readiness gate:
  - `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh`
  - `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh`
  - `/Users/mark/Property_Analytics/run_daily_health_report.sh`
  - `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.mjs` was aligned to the same stable runtime envelope so the shared Node Keeper helper and the shared shell Keeper helper no longer disagree about base process identity.
- ApartmentIQ Keeper config drift was removed by aligning `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py` to the documented default `ApartmentIQ API` record notation (`keeper://aRP2hTUWhLTCAn-ye7GJ_w/field/password`) instead of a stale alternate default.
- Verification included a forced bad-`HOME` repro that now resolves ApartmentIQ credentials successfully, `node scripts/check_data_warehouse_keeper_ready.mjs` still returning `OK`, and a live smoke `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh` that completed on `2026-06-04` with `1` account, `1` sampled comp set, `11` market-survey rows written, and fresh ApartmentIQ summary artifacts under `/Users/mark/Property_Analytics/reports/apartmentiq/2026-06-04/`.

Operational note added on 2026-06-05:

- Keeper bootstrap reliability was pushed one layer deeper into the Python credential surface after another ApartmentIQ retry exposed that wrapper-level stabilization alone was not enough when a script resolved Keeper-backed credentials directly.
- `/Users/mark/Property_Analytics/utils/ksm.py` now centralizes the governed Python-side Keeper runtime: it forces the same MarketingOps identity/path envelope as the shell helper, probes the `marketingops` profile before notation reads, retries `ksm profile active`, and finally attempts `ksm profile init -p marketingops` from the existing local bootstrap token files before failing.
- `/Users/mark/Property_Analytics/ops/cloudflare/cloudflare_auth.py` and `/Users/mark/Property_Analytics/ops/browserstack/browserstack_auth.py` no longer maintain their own direct `ksm` subprocess logic; both now resolve through the shared `utils.ksm` helper and include canonical default Keeper notations so stripped Python processes do not depend on wrapper-exported notation env vars.
- `/Users/mark/Property_Analytics/scripts/lib/keeper_runtime.sh` now exports `PA_KEEPER_RUNTIME_READY` only after a successful probe instead of assuming readiness immediately after attempted repair.
- Verification from intentionally bad fresh-shell state (`HOME=/tmp`, empty env except minimal PATH) succeeded for ApartmentIQ, Cloudflare, BrowserStack, and DataForSEO Python credential reads, and wrapper/runtime smoke still passed for `node scripts/check_data_warehouse_keeper_ready.mjs`, `APARTMENTIQ_DAILY_MAX_COMP_SETS=1 ./run_apartmentiq_daily_light.sh`, and `APARTMENTIQ_WEEKLY_MAX_COMP_SETS=1 ./run_apartmentiq_weekly_dive.sh`.

Operational note added on 2026-05-28:

- A new nested local source workbench for Resi Archetype was seeded at `/Users/mark/Property_Analytics/resi_archetype_site` from Keeper-backed SFTP access. The remote account is SFTP-only; SSH command execution is disabled.
- Remote exploration confirmed a WordPress `/public` web root with `resi-child-theme`, YOOtheme, Resi custom plugins, Kinsta mu-plugins, uploads, and a separate `mysqleditor` directory.
- The local project intentionally excludes live `wp-config.php`, uploads, backups, SQL exports, and database material. The committed source snapshot focuses on Resi/YOO element code needed for unit, floor-plan, filter, fee, application, and related Cloudflare pilot diagnostics.
- A hard-coded GitHub updater token was found in the downloaded `resi-elements-venterra` plugin and redacted in the local workbench to read from `RESI_ELEMENTS_VENTERRA_GITHUB_TOKEN`; the live/source-side token should be rotated and represented in Keeper before any deployment workflow uses it.
- YOOtheme and YOO Essentials were inventoried but not fully mirrored because their vendor payloads are large over SFTP. Treat them as install/copy dependencies for specific reproductions rather than as primary evidence in this local git snapshot.
- A performance-first Resi diagnosis was added at `/Users/mark/Property_Analytics/resi_archetype_site/docs/PERFORMANCE_FIRST_DIAGNOSIS_2026-05-28.md` after the user supplied a homepage waterfall. The main finding is late LCP discovery: the homepage hero is delivered as a UIkit `data-src` background instead of an early image/preload, while `/apartments/` is dominated by a large `1.19 MB` first document and `94` DAM floor-plan images.
- The Cloudflare Worker at `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js` now contains a disabled edge performance layer for exact paths `/` and `/apartments/`: DAM/Resi preconnects, homepage hero preload, UIkit hero background discovery rewrite, apartment DAM image priority/lazy hints, and `Server-Timing: vtr_edge_perf` verification. The live 2026-05-28 deploy used the Keeper/KSM-backed Wrangler path and produced Worker version `4a7fa0ee-ab6a-407c-8427-694cf693f93e`, then was disabled after a live GTMetrix score regression signal with rollback version `9fe6606e-c40e-4318-ada3-e2634c910cb9`. The Worker was paused into pass-through mode for edge messages, coach marks, and performance rewrites as version `caba5935-ec78-4e2f-bdee-23a099106cb4`, then a header-only hero preload test version `45b31461-f2b0-4059-9e1d-bac24dc1666b` was tested and rolled back after worse homepage PSI/LCP medians. Current pass-through version is `542b75ca-3977-4130-a04a-6d731f70d255`. A Zaraz-only Cloudflare Configuration Rule experiment disabled Zaraz on `pilot.venterradev.com` while Cloudflare Web Analytics stayed enabled; three-run PSI medians worsened on mobile, so the temporary rule was removed and Zaraz was verified restored. A Cloudflare Web Analytics / RUM-only Configuration Rule experiment then removed `static.cloudflareinsights.com/beacon.min.js` while Zaraz, GA4/Ahrefs, and Resi pixel stayed enabled; it reduced requests and bytes but produced mixed PSI medians, so the temporary rule was removed and RUM was verified restored. An IE11-only Worker experiment removed `/wp-content/plugins/resi-elements/assets/ie-11.js` from `/` and `/apartments/`; it removed one request and modestly improved apartments mobile while worsening apartments desktop, so Worker version `da567516-6085-4585-8da2-936c1168300b` restored `ie-11.js` and the rewrite remains disabled. The first kept performance win is Worker version `17944c96-a290-4853-962a-61762dd455e0`, which lazy-loads the `/apartments/` SightMap iframe and API on map interaction/viewport approach; functional smoke passed and PSI medians improved apartments mobile `57 -> 74` and desktop `75 -> 99`. A homepage hero inline-background test version `dade5885-9bbd-44f6-b067-d719be001c9f` removed UIkit `data-src` / `uk-img` without preload but worsened homepage mobile LCP `3826ms -> 6592ms`; Worker version `63ebf1cd-80b6-4525-940d-e9bdaf2d063c` rolled back the hero rewrite while keeping SightMap lazy-load live. Artifacts are stored under `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-05-28/`.
- 2026-07-03 update: after YOOtheme rendered the hero as a real `picture/img` but exposed `sizes="(max-aspect-ratio: 3840/2160) 178vh"`, mobile Lighthouse selected an oversized `3840w` WebP. The pilot Worker now has a temporary mobile-only homepage source rewrite, enabled only by `EDGE_HERO_MOBILE_IMAGE_ENABLED` in `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/wrangler.pilot.toml`, while pilot Edge Message and coach-mark injection remain paused. Worker version `a3b58beb-37d7-454d-94c0-457e40e24385` rewrites mobile hero HTML to the supplied `1200 x 1600` WebP with `sizes="100vw"` and `Server-Timing: vtr_edge_hero_mobile`; desktop remains unchanged. The POC reduced mobile transfer and PSI byte weight but only produced keyed PSI mobile score `64`; a controlled Keeper-backed GTMetrix cross-check scored `96` / structure `98` and did not show material regression versus the prior stored Pilot Master GTMetrix row. The next visible bottleneck is below-fold `Home-Amenities-full.jpg` and `Home-Features-full.jpg` downloads. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_MOBILE_SOURCE_POC_READOUT.md`.
- Follow-up 2026-07-03 update: after optimized same-origin replacements were supplied, the Worker added `EDGE_MOBILE_IMAGE_REPLACEMENTS_ENABLED` for mobile-only homepage swaps of welcome, features, amenities, and pets images. Version `c6248fd6-a435-4091-a704-58e6aaee9886` keeps Edge Message / coach-mark injection paused, keeps desktop unchanged, and serves the reworked `Home-Welcome-1200-1.webp` plus the optimized feature/amenity/pets WebPs on mobile. Keyed PSI mobile recovered to `84` with LCP `3,676ms` and byte weight `892 KiB`; GTMetrix remained stable at score `96` / structure `98`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_V2_READOUT.md`.
- Welcome 850 follow-up: Worker version `815a50dc-62f2-468b-8e45-3142902fdd88` swaps mobile `Home-Welcome-full.jpg` to `Home-Welcome-850.webp` (`137,600` bytes). The best repeat keyed PSI mobile sample scored `88` with LCP `3,376ms` and byte weight `888 KiB`, while GTMetrix scored `97` / structure `98`; one PSI run was a noisy low `67` and one Google repeat returned `500`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/MOBILE_IMAGE_REPLACEMENTS_850_READOUT.md`.
- Hero 750 follow-up: Worker version `2c664abf-ca30-4a6d-9521-b0771ae155a8` swaps mobile hero HTML to `Apex-West-Midtown-Home-Hero-750.webp` (`750 x 1001`, `99,668` bytes) while keeping the `850` welcome and other mobile image replacements. The best repeated keyed PSI mobile sample scored `90` with LCP `3,076ms` and byte weight `827 KiB`; GTMetrix cross-check scored `92` / structure `98`, so visual QA and possibly a `900-1000px` hero fallback remain prudent before source-side adoption. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HERO_750_WELCOME_850_READOUT.md`.
- Content image 750 rejection: Worker version `e780f935-c9fd-443e-9dbe-b5a8b9601920` tested `Home-Amenities-750.webp` and `Home-Features-750.webp`; payload dropped but PSI worsened to `60` / `69`, so version `9454ba45-4db7-4064-8a5a-6313ea007382` restored the prior best image mix. Note: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/CONTENT_750_REJECTION_NOTE.md`.
- Real demo-state proof: Worker version `3025c872-a800-4d49-b4fa-1f127094913b` re-enabled pilot Edge Message and coach-mark injection while keeping the accepted image mix. Verification showed homepage popup and image markers plus apartments coach-mark/SightMap lazy-load; repeat PSI mobile scored `89` and GTMetrix scored `95` / structure `98`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/DEMO_STATE_IMAGE_OPTIMIZED_READOUT.md`.
- Homepage HTML cache POC: a narrow anonymous Worker HTML cache for exact `https://pilot.venterradev.com/` was tested behind `EDGE_HOME_HTML_CACHE_ENABLED`. It improved local TTFB (`186ms -> 107ms`) and local mobile LCP (`492ms -> 468ms`), but keyed PSI mobile stayed low across three runs (`66`, `67`, `67`, LCP about `5.5s`) even though raw PSI confirmed the accepted hero remained eager, initially discoverable, and `fetchpriority="high"`; GTMetrix scored `97` / structure `98`. The live pilot was rolled back to Worker version `963e1afb-3f91-4731-ae47-9f644fa44efd` with `EDGE_HOME_HTML_CACHE_ENABLED="false"` while preserving demo messaging and image replacements. Post-rollback headers show the custom cache marker absent and Kinsta edge HTML cache active (`ki-cache-type: Edge`, `ki-cf-cache-status: HIT`). Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/HOME_HTML_CACHE_POC_READOUT.md`. Do not re-enable custom Worker HTML cache as a PSI fix without a new paint-timing proof.
- Static hero POC: a query-gated mobile-only proof at `https://pilot.venterradev.com/?static_hero_poc=1` removes the first hero slideshow initializer and forces the existing first slide into a static active overlay layout. The normal homepage remains unchanged. The POC proves static layering is visually possible, but keyed PSI mobile got worse: normal scored `89` / LCP `3,077ms`; POC scored `79` / LCP `3,676ms`, then `66` / LCP `5,671ms`. Readout: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-07-03/static-hero-poc-live/STATIC_HERO_POC_LIVE_READOUT.md`. Do not keep/promote the Worker-forced static hero as a PSI fix; if pursued, it should be a native YOOtheme/source static hero, not override CSS on a former slideshow.

Operational note updated on 2026-05-23:

- Keeper/KSM credential handling is now a repo-level law, not a preference. `/Users/mark/Property_Analytics/AGENTS.md` requires agents to resolve credentials, API tokens, OAuth artifacts, service tokens, and deployment auth through Keeper/KSM helpers, notation env vars, or Keeper-backed file materialization before direct env vars, local credential files, browser login, or manual token paths. For Cloudflare/Wrangler work, `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py` is the governed deployment auth path so `CLOUDFLARE_API_TOKEN` is injected from Keeper. Missing credentials should be added to Keeper and documented in the appropriate manifest rather than worked around locally.
- Official Venterra brand colors are now a governed system-wide design boundary. The source PDF is `/Users/mark/Downloads/New Branding Colors_Named 2.pdf`, the internal standard is `/Users/mark/Property_Analytics/docs/VENTERRA_BRAND_COLOR_STANDARD_2026-05-23.md`, and `/Users/mark/Property_Analytics/AGENTS.md` now instructs future work to use only the active palette unless the user explicitly specifies otherwise. The active palette is Venterra Navy `#15284B`, San Marino `#3D66B9`, Bay `#294782`, Indigo `#5A81CF`, Monte Carlo `#7DCAC2`, Pink `#E02472`, White Smoke `#F6F6F5`, Terra Cotta `#BD4830`, Quill Gray `#D6D6D2`, Blue Chill `#3B9189`, Delta `#9B9B96`, Black `#000000`, and White `#FFFFFF`; Galliano `#EAAB00` is discontinued and should not appear in active color palettes or configurable defaults.
- A narrow edge-injected transparent-pricing intro beta was deployed on `pilot.venterradev.com/apartments*` and `pilot.venterradev.com/apartment*` through `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js`, rolled back after the apartment units experience appeared to stall, then re-enabled as a hardened non-blocking version on 2026-05-23.
- The Worker is `edge-transparent-pricing-intro-beta`; last original enabled version `9d08ec2c-18fa-43e4-b99d-7986eb32e0f6`, disabled version `3a04aee5-ea68-4c5f-9cd3-30eb7cf24a97`, non-blocking version `fae973c7-fd71-4fbf-8d0f-aa90d835001d`, clean-test-url version `dac90122-4bc7-4493-a1f9-573f2833a907`, disabled-after-hero-review version `6181471a-a26c-4402-88c9-ef0ac927b269`, homepage benchmark version `89b7ce6f-86fb-44a7-98f7-2b8bac2da5f4`, clean-homepage live version `b8807956-1921-4d0b-826e-2276ed2262aa`, title-line-break version `c73d901f-bb92-4a86-a102-2d5579b61251`, modal layout version `db8b4940-020e-4179-aa9a-aa4cab7f36a5`, official-color version `75477e9d-963e-400a-a3b5-73a610aa417b`, and current D1 live-config version `3a19688f-51eb-445b-aae5-8e25969bd935`. Live state is `enabled: true`; Cloudflare route is `pilot.venterradev.com/*`, with homepage modal injection on exact path `/` and apartment coach-mark injection on exact path `/apartments/`. The clean homepage URL displays without test parameters using experience id `edge_transparent_pricing_intro_homepage_v1`. The Worker now reads active D1 config through `POP_BRIEF_DB` and falls back to its embedded approved config only when D1 has no active row or is unavailable.
- The beta carried governed property identity `GA4AX` / `eed3da54-7b7a-4dae-984b-a203113fc2f3`, force/reset testing params, 24-hour cookie capping, localStorage fallback, fade in/out, corner X, countdown/progress, reduced-motion handling, and lightweight dataLayer events where available.
- Current source hardening keeps the concept as a non-blocking notice, removes `aria-modal`, focus trap, autofocus, and outside-click interception, lets pointer events pass through the overlay, and waits for unit/listing DOM readiness before display. Force/reset query params now redirect to a clean URL and use short-lived Worker-only cookies because leaving `edge_popup_force=1` in `location.search` caused the Resi unit UI to hide visible unit rows. Live smoke on 2026-05-23 showed forced apartment redirect to clean `/apartments/`, popup injection with `47` visible availability nodes / `47` visible unit rows retained during and after the popup, homepage/assets untouched, auto-close cleanup, and no browser page errors. Testing always-show mode is active, with `ignoreFrequencyCap: true` for both homepage modal and apartment coach mark. Current modal layout smoke confirmed property `Apex West Midtown`, title newline, countdown `Closing in 7 seconds`, no top-logo-before-title, bottom brand below progress, and `0` browser errors; apartment smoke still retained `47` all-in buttons / `47` availability nodes with `1` coach mark.
- Hero/title review on 2026-05-23 showed fresh-browser clean `https://pilot.venterradev.com/apartments/` still lacks the production-style hero/title with the Worker removed, while production `https://venterraliving.com/apartments/apex-west-midtown/` has the Apex hero/title and the matching pilot property slug returns `404`; do not re-enable until the intended pilot route/template is confirmed.
- Homepage benchmark on 2026-05-23 showed hero/title retained behind the popup, popup visible in `5/5` browser runs, `0` browser page errors, `+11,589` raw HTML bytes, `+5,223` gzip HTML bytes, `+4,208` browser document transfer bytes, and effectively neutral measured load-time impact. Artifacts live under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-23/homepage/`.
- Coach-mark proof on 2026-05-23 added `edge_message_all_in_pricing_coachmark_v1` on exact path `/apartments/`, anchored above the first visible `All-In Price & Details` button. Browser proof showed the coach mark visible, homepage modal absent on `/apartments/`, `47` visible availability nodes / `47` visible unit rows retained, and no page errors.
- The reusable capability is memorialized as the `Edge Message Toolkit` in `/Users/mark/Property_Analytics/docs/EDGE_MESSAGE_TOOLKIT_2026-05-23.md`; admin nav is `Edge Messages`.
- First Pond admin surface added at `/Users/mark/Property_Analytics/apps/web/src/app/experiments/edge-messages/page.tsx`, linked from Experiment Lab. It inventories the homepage modal and apartment coach-mark proofs and exposes editable content, style, placement, delivery, timing, decoration, frequency, preview, and guardrail controls. Launch/pause/rollback remain disabled until the approval workflow, EVS preflight, and benchmark gates are wired; the config publish/read path for this beta surface is now wired through D1.
- The admin surface was pushed live to Cloudflare Pages deployment `9aaf825f.property-analytics.pages.dev`; operator route is `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. It now includes text color controls, fixed active Venterra brand color swatches alongside the free picker, Type size one-pixel steppers for property/title/body/fine-print/countdown text, `Save & Publish` backed by `POST /v1/experiments/edge-messages/:messageId/live-config`, and separated preview scenes so homepage modal previews do not carry the apartment all-in button while coach-mark previews use a dedicated apartments-list screenshot with the bubble lowered so the pointer lands on the target button. The API Worker `pop-brief-api` version `8f0af5e6-86ce-463e-9b27-aec8618ba4e7` validates drafts and writes active rows to `edge_experiment_config_versions`; the Edge Worker reads those rows live through D1. Browser smoke confirmed a saved Accent Color survived reload and no relevant page errors occurred; the font-size and live-publish slices were verified by curl against the live bundle. The discontinued Galliano swatch/default was removed from the active admin palette, and oversized saved coach-mark title/body drafts are now clamped back into a sane range.
- The The Vine production admin pass was deployed to Cloudflare Pages `https://ca35a518.property-analytics.pages.dev`. The Pond surface now keeps Content and Preview visible, with Timing, Style, Targeting, and Publish controls behind collapsible cards for progressive disclosure. Draft save, reset, force preview, open page, pause, launch, and rollback are present with the existing role gate; the custom operator route remains `https://app.venterradev.com/experiments/edge-messages` behind Cloudflare Access. Smoke checks returned `200` for the Pages preview, Access `302` for the custom route, and protected `401 NO_SESSION` for the live API route.
- Measurement artifacts live under `/Users/mark/Property_Analytics/reports/edge_popup_beta/2026-05-22/`, with authentic-logo last-enabled measured payload impact of `11,710` raw script bytes, `4,391` gzip script bytes, `11,726` forced-vs-capped raw HTML bytes, `4,198` forced-vs-capped local gzip bytes, and `4,224` live compressed-transfer bytes; no external popup asset/library requests were added.

- ApartmentIQ API is now a live Data Collection / Data Pond source route extending the existing AptIQ / ApartmentIQ advisory market-intelligence lane.
- Keeper-backed auth lives in `/Users/mark/Property_Analytics/utils/apartmentiq_auth.py` using the `ApartmentIQ API` record; the connector is `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py`, with config at `/Users/mark/Property_Analytics/Data_Collection/config/apartmentiq.yaml`.
- Local/D1-ready tables are defined in `/Users/mark/Property_Analytics/apps/api/migrations/0055_create_apartmentiq_tables.sql` and `/Users/mark/Property_Analytics/infra/migrations/034_create_apartmentiq_tables.sql`.
- The live smoke pass discovered `1` account and `285` comp sets, then sampled `3` comp sets into `28` market survey rows, `1,480` unit rows, and `278` floorplan rows.
- Property identity governance was extended so stable ApartmentIQ subject-property IDs flow through `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json`; Northbridge at Millenia Lake / `FL4NB` now resolves from `apartmentiq:99066651`.
- Operating cadence is now established through `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh` for a daily portfolio market-survey refresh and `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh` for a weekly portfolio market-survey/unit/floorplan refresh. Summary artifacts are generated by `/Users/mark/Property_Analytics/scripts/generate_apartmentiq_enrichment_summary.py` under `/Users/mark/Property_Analytics/reports/apartmentiq/`.
- Codex automations were created for the daily light refresh and Monday weekly dive. A temporary Friday 12:30 local retry automation was also created for the first full baseline because immediate 2026-05-22 full-run attempts hit extended ApartmentIQ 429 throttling after the exploratory pull.
- Standing authority remains unchanged: ApartmentIQ is advisory market/comps evidence only. Data Pond source-of-record facts govern internal operating, leasing, availability, guest-card, and BI claims.

Operational note added on 2026-05-22:

- Canonical PIB now has a v2.3.0 version path for ApartmentIQ advisory enrichment:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_0.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_0.py`
- The new `ApartmentIQ Market Enrichment` section renders only when a governed property identity match and local ApartmentIQ snapshot exist.
- The section shows advisory pricing, rent-per-square-foot, exposure, leased percent, listed offers, peer ratings, nearest complete peers, Offer Pressure, Unit-Type Offer Pressure, Fees / Deposits, and Amenity Differentiators; it is also represented in data coverage, freshness, and methodology.
- PIB now has a section-catalog planning standard for future self-serve generation with selectable section ids and presets:
  - `/Users/mark/Property_Analytics/docs/PIB_SECTION_CATALOG_AND_BUILDER_STANDARD_2026-05-22.md`
  - `/Users/mark/Property_Analytics/config/pib_section_catalog.json`
- The catalog memorializes `ApartmentIQ Market Enrichment` as section id `apartmentiq_market_enrichment` and `Search Market Visibility` as section id `dataforseo_search_visibility`, defining the future PIB Builder direction without creating a parallel PIB renderer/template/sender.
- PIB v2.3.0 now also includes `Search Market Visibility`, a standalone DataForSEO section with advisory keyword-demand, live SERP, SERP pressure, Labs ranked keywords, OnPage readiness, local entity, and AI visibility evidence. Northbridge at Millenia Lake was refreshed with new DataForSEO rows on 2026-05-22 for the proof artifact.
- Under explicit 2026-05-22 approval, PIB v2.3.1 now locks the approved advisory enrichment presentation:
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_3_1.py`
  - `/Users/mark/Property_Analytics/Property_Intelligence_Brief/docs/PIB_V2_3_1_LOCKED_STANDARD.md`
- v2.3.1 keeps DataForSEO OnPage and Local Entity information in full-width readable blocks and labels the AI section `AI Answer Visibility`.
- Northbridge at Millenia Lake proof artifact: `/Users/mark/Property_Analytics/reports/pib_v2_3_verification/northbridge-at-millenia-lake/2026/2026-05-22__Property-Intelligence-Brief__northbridge-at-millenia-lake__2026-04-22_to_2026-05-21.html`.
- Boundary preserved: no app-side alternate PIB renderer was created, v2.2.0 remains available unchanged, and ApartmentIQ remains advisory rather than source-of-truth.

Operational note added on 2026-05-25:

- The ApartmentIQ regular-harvest posture was tightened for reliability and coverage efficiency without changing its advisory authority boundary.
- `/Users/mark/Property_Analytics/run_apartmentiq_daily_light.sh` now operates as a true touchup lane: governed subject-linked comp sets only, default `APARTMENTIQ_DAILY_MAX_COMP_SETS=5`.
- `/Users/mark/Property_Analytics/Data_Collection/collectors/apartmentiq_collector.py` now prioritizes never-harvested and stalest comp sets first based on stored `collection_date` state, so repeated light runs rotate coverage across the portfolio instead of re-reading the same leading comp sets.
- `/Users/mark/Property_Analytics/run_apartmentiq_weekly_dive.sh` now uses a staggered weekly cap of `60` comp sets by default instead of forcing a full portfolio sweep, while still allowing deeper override runs when needed.
- Both ApartmentIQ wrappers now fall back from `~/Library/Logs/Venterra` to repo or `/tmp` log directories when needed, reducing environment-specific launch failures while keeping the same collection/report family shape.
- Targeted 2026-05-25 smoke confirmed wrapper startup/logging works locally, while the current remaining bottleneck is upstream ApartmentIQ `429` throttling on the comp-set list endpoint rather than local orchestration overhead.

Operational note added on 2026-05-12:

- EVS / BrowserStack now has a governed portfolio functionality/data-integrity QA contract seeded from the official workbook `/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx`.
- The machine-readable contract lives at `/Users/mark/Property_Analytics/evs/config/portfolio-functionality-qa-contract.json` and preserves all `45` EVS-owned/deferred audit rows (`43` Functionality and `2` Data Integrity) with workbook row lineage, owner lane, assertion type, truth-source requirements, device scope, side-effect policy, and automation status.
- The first launch batch is `round_1_property_websites` in `/Users/mark/Property_Analytics/evs/config/portfolio-qa-batches.json`, imported from `/Users/mark/Downloads/Round 1 QA.docx` into `/Users/mark/Property_Analytics/evs/config/round-1-qa-targets.json`; it currently covers `22` Kinsta property URLs after user-confirmed inclusion of `Carlyle Place Apartments` through `/Users/mark/Property_Analytics/evs/config/round-1-qa-confirmed-extra-targets.json`.
- The original executable pilot batch remains `pilot_production_functionality`, covering the five pilot production URLs and filtering to the EVS-owned checks.
- Media/image checks, contact-form checks, and AH/EAI lead-attribution proof remain in the contract as deferred owner lanes instead of being hidden or misreported as automated BrowserStack results.
- Future launch batches should pass URL lists into `/Users/mark/Property_Analytics/evs/orchestration/build-portfolio-qa-plan.mjs` rather than creating new one-off QA runners.
- Same-day follow-through added the BrowserStack `portfolio_functionality_regression`, desktop `apartments_pricing_deep_journey`, and dedicated iPhone `apartments_pricing_mobile_journey` runner paths. Broad pilot proof passed all five production pilot sites on desktop and iPhone; desktop and mobile deep proof completed all five pilot sites and currently separates real review items (unit sort-order warnings, Pipeline Apply Now unit-context review, Ventana similar-homes detection, and source-backed availability mismatches) from source-truth skips (review date availability).
- Header/footer navigation integrity is now source-backed by the latest ThirtyLines feed snapshot. The BrowserStack `header_navigation_integrity` profile validates logo/home, phone `tel:` links, Apply Now, Schedule Tour, primary nav destinations, footer parity, and mobile menu parity against governed feed phone and property-specific vendor URLs.
- BrowserStack orchestration now has per-property timeout controls, and the mobile journey uses bounded HTML snapshots plus per-row checkpoints so a slow remote iPhone session cannot block launch-batch execution indefinitely or erase partial evidence.
- Pond availability is now wired into the deep profile through `/Users/mark/Property_Analytics/scripts/export_evs_pond_availability.py`, using the governed property identity resolver and latest `unit_availability_units` rows from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`; Calais BrowserStack desktop matched `40` rendered units to `40` Pond units, while The Harrison strict BrowserStack proof correctly warns on `11` rendered units vs `57` Pond/structured units.
- EVS now has a durable evaluation-set persistence shape in `/Users/mark/Property_Analytics/apps/api/migrations/0053_create_evs_batch_result_tables.sql`: `portfolio_functionality_qa_v1` is seeded as the reusable workbook-backed evaluation set, while batches, targets, profile/device runs, source-truth snapshots, and row-level findings can store upcoming launch URL lists and support future result display.
- Generic batch execution is now prepared through `/Users/mark/Property_Analytics/evs/orchestration/run-portfolio-qa-batch.mjs`, which reads URL-list batches, runs target/profile/device combinations, switches iPhone Apartments & Pricing checks to the bounded mobile journey profile, and writes per-target evidence plus a summary under `evs/reports/<run_id>/`.
- Round 1 source-truth export now scopes Pond availability to the selected URL-list target instead of the legacy Pilot set. Anatole (`OK4AN`) first-property proof exports `11` Pond units and clears the prior rows `79-81` false warnings; mobile media-vendor cancelled requests are filtered out of EVS functionality classification while media remains a separate owner lane.
- Reviews sort row `155` now uses rendered review date text and records both DOM/source order and visual card order, so desktop masonry layouts can be flagged when the page is technically source-sorted but not directly visually sorted newest-first.
- Contact form checks are now separated into the guarded `contact_form_checks` run lane. Default batches remain no-submit; `EVS_INCLUDE_FORMS=1` includes form validation/submission rows, `QA_INCLUDE_OWNERS=forms_qa EVS_RUN_PROFILES=contact_form_checks` reruns only forms, and real submissions require explicit synthetic-submit controls before the runner will send a lead. The profile is registered in shared EVS schemas/API/UI metadata and seeded as separate draft evaluation set `contact_form_checks_v1` for future durable storage/display.
- Lead attribution now has a separate dormant EVS E2E structure in `/Users/mark/Property_Analytics/evs/config/lead-attribution-e2e.json` and `/Users/mark/Property_Analytics/scripts/export_evs_lead_attribution_truth.py`; it uses ThirtyLines `trackingCodes` to generate `?id=<trackingId>` advertiser URLs, verify tracking ID/phone/email behavior, fill synthetic form drafts, and optionally run governed form submissions with browser-validation and acknowledgement evidence. Calais `TX4MIALIST` / `APL` now has a corrected first-send audit row at `/Users/mark/Property_Analytics/evs/reports/calais-TX4MIALIST-corrected-submitted-audit-row-20260513T102927.csv`, with downstream outlet confirmation still pending.
- Same-day media-interaction follow-through reclassified browser-observable media rows into EVS instead of leaving them as generic skipped media QA: Matterport/Virtual Tour row `89`, unit-detail photo modal row `91`, Features camera row `114`, and Amenities camera row `124` now execute in BrowserStack; image correctness row `92` verifies image presence but remains a human/media review item for property-specific correctness. The runner now closes prior overlays between media checks and recognizes UIkit/lightbox/modal gallery evidence, with OK4AN proof stored under `/Users/mark/Property_Analytics/evs/reports/round1-media-interactions-smoke-OK4AN-v2-20260519T210658Z/summary.json`.
- Row `155` review-date sorting evidence now separates source/DOM newest-first order from masonry visual card placement; workbook v15 clarifies the five existing review warnings as visual read-order review items, not source-sort failures.
- Same-day map-pin follow-through wired Location / Map row `141` to the latest ThirtyLines feed latitude/longitude instead of a separate property geo config. `portfolio_functionality_regression` now receives feed-backed property truth, extracts rendered/schema/map coordinate candidates from `/location/`, compares them to feed lat/long, and records coordinate evidence. Full Round 1 proof passed `42/42` desktop+iPhone row `141` sessions under `/Users/mark/Property_Analytics/evs/reports/round1-map-pin-full-20260519T220728Z/summary.json`.
- Same-day specials-toggle follow-through added feed-backed applicability logic for Home / Specials Bar row `4`: the ThirtyLines `propertyBannerSpecial` value now determines whether a missing Specials toggle is truly `N/A` versus still testable. Workbook v7 marks `20` Round 1 property tabs as `N/A` where the feed has no special and leaves `Avasa Grove West` testable because its feed special is populated.
- Same-day data-integrity verdict follow-through scoped row `79` layouts and row `80` pricing to their field-specific Pond comparisons instead of duplicating every unit-set availability gap. Displayed values now pass when every displayed unit is source-backed and layout/rent mismatches are zero; Pond-only units missing from the rendered site stay on row `81` Availability. Follow-up classification now treats row `81` source-backed unit-set, rendered/structured count, or available-date mismatches as `Fail` because Pond/feed availability is available, with workbook v14 recording the prior evidence set as `17` Fail / `4` Pass.
- Same-day sort/floor functional follow-through initially promoted rows `83`, `84`, and `85` from high review warnings to failures when the observed behavior appeared deterministically broken. Follow-up user manual QA on 2026-05-20 confirmed UI operability, but later review clarified that rows `83` and `84` judge actual rendered order, not merely whether the sort UI can be exercised. Current retest `round1-sort-order-local-20260520T1258` records rows `83`/`84` as `20` Fail / `2` Pass for size, move-in date, then price ordering, and workbook v19 reflects that evidence; row `85` floor-filter behavior remains separate.
- Same-day unit-specific Apply Now follow-through initially promoted row `102` from review to failure when Unit Detail Page Apply Now opened only the property-level Pipeline application URL. Follow-up review on 2026-05-20 corrected that proof standard: the runner now opens the landed Pipeline/Prospect Portal page and checks for the expected unit number/source identifier before deciding pass/fail. Targeted retest `round1-row102-unit-apply-local-20260520T1135` checked desktop and iPhone-shaped unit detail Apply Now behavior for all Round 1 properties and passed `22/22`; workbook v17 records row `102` as `Pass` on all property tabs.
- 2026-05-20 form-lane follow-through split Contact row `164` and Validation row `165`: required-field validation is now explicitly no-submit validation and runnable under `contact_form_checks`, while actual contact form submit remains governed synthetic-submit work requiring explicit identity/run flags plus downstream AH/EAI reconciliation. Broad multi-source form attribution can remain paused while one-source action smoke runs through `lead_attribution_e2e`. Follow-up no-submit contact validation retest `round1-contact-validation-local-20260520T1245` passed row `165` for `22/22` Round 1 properties; workbook v18 records row `165` as `Pass` and row `164` as governed-submit pending `Review` instead of generic `Skipped`.
- 2026-05-20 line-requirement totality audit checked every Round 1 row tagged `Functionality` or `Data Integrity` against the workbook, EVS contract, current evidence, and source-backed lanes. The Carlyle Place late-addition blank gap is now closed through desktop/iPhone portfolio and Apartments & Pricing runs. Workbook v20 has no blank EVS-owned statuses across the `22` property tabs: `27` rows are fully inspected/applicability-resolved, `5` contain observed failures, `8` are inspected review-required, and `5` are governed synthetic-submit/downstream-proof pending instead of generic skipped automation.
- 2026-05-20 initial-round attribution decision now fails DNI/source phone replacement rows `8`, `61`, and `161` across all `22` property tabs, in addition to failed row `164` form submission attribution and failed rows `175-178` AH/EAI guest-card proof. Required-field validation row `165` remains a no-submit browser-validity pass.
- 2026-05-20 workbook/evidence governance now treats supplied QA workbooks as fill-only artifacts: no added tabs, columns, rows, screenshots, raw JSON, or non-native evidence objects. Detailed proof is stored locally under EVS reports through `create-local-evidence-package.mjs`, with manifests that record file role, path, size, modified time, and SHA-256 hash. Future batch runs automatically emit `local-evidence-package/evidence-manifest.json`; the current Round 1 v22 support package lives at `/Users/mark/Property_Analytics/evs/reports/round1-initial-fill-only-evidence-20260520/evidence-manifest.json`.
- 2026-05-20 fill-only enforcement and DNI proof were tightened further: `validate-workbook-fill-only.mjs` detected that v22 had an extra `EVS Findings Summary` tab, so v23 was rebuilt from the supplied workbook with only `F:G` filled and passed validation with `0` violations. `run-dni-phone-probe.mjs` now runs a no-submit `?id=<trackingId>` source-phone probe with screenshots enabled by default; the OK4AN/APL smoke test correctly failed because runtime attribution selected the source phone while visible/tel numbers remained the default property number, and the Round 1 one-source screenshot probe recorded `22` Fail / `0` Pass with `44` screenshot artifacts and no form submission.
- 2026-05-20 local audit ergonomics now include root-cause summary, evidence-completeness scoring, and a DNI screenshot contact sheet generated by `build-round1-audit-support.mjs`. The current Round 1 support directory groups findings into DNI/attribution, sort order, availability, SightMap, Specials, and review-required buckets, and npm presets now exist for focused DNI, forms validation, sort-order, SightMap, and availability retests.
- 2026-05-20 tightened delivery pass produced workbook v25 at `/Users/mark/Downloads/_QA_Round 1_Property_Websites_EVS_Updated_20260520_v25_tightened_fill_only.xlsx` with fill-only validation passing `0` violations. Row `79`/`80` now fail when displayed unit layout/pricing is not source-backed by Pond, row `85` fails when floor changes do not alter observed units, and row `102` uses a no-submit Prospect Portal move-in-date/lease-criteria proof before deciding whether expected unit context is observable. The companion package at `/Users/mark/Property_Analytics/evs/reports/round1-audit-support-20260520-v25/` adds delivery, root-cause, evidence-completeness, DNI review, and DNI screenshot contact-sheet outputs without adding non-native objects to the supplied workbook.
- 2026-05-20 Round 2 launch-batch intake added `round_2_property_websites` to the same EVS batch model. `/Users/mark/Downloads/Round 2 Portfolio Rollout.docx` now imports to `/Users/mark/Property_Analytics/evs/config/round-2-qa-targets.json` with `21` identity-resolved Staging/Kinsta URLs; Pastel links are ignored for EVS execution, Monteverde remains URL-pending because the doc says to see Julie's email, and the governed identity matrix now includes `Creekside Apartment Homes` as an alias for `Creekside`. Preflight dry-run proof lives at `/Users/mark/Property_Analytics/evs/reports/round2-preflight-dry-run-20260520-v1/summary.json`, and the URL reachability check confirmed all `21` imported Staging URLs responded.

Operational note added on 2026-05-13:

- Monteverde / `monteverdesatx.com` now has an active Website Change Watch lane for external AI SEO vendor monitoring.
- The lane resolves property identity through `Data_Collection/utils/property_identity.py` and `config/property_identity_matrix.json`, then stores immutable public crawl baselines under `/Users/mark/Property_Analytics/reports/website_change_watch/monteverde/`.
- Filled baseline `20260513T165310Z` captured sitemap pages, raw HTML, rendered text blocks, metadata, canonicals, robots, links/CTAs, images/alt text, forms, JSON-LD, custom schema scripts, headers, and Data Pond metric context from GA4, GSC, PSI, GTMetrix, DataForSEO, GBP insights/reviews, Google Ads, availability rows, and Cloudflare synthetic cache checks.
- The same-session gap fill inserted a live GTMetrix row, derived GBP review summary from canonical `gbp_reviews`, and persisted Monteverde Cloudflare synthetic rows; the Cloudflare evidence is a live finding because sampled pages returned `CF-Cache-Status: DYNAMIC`.
- The strategic posture is now memorialized in `/Users/mark/Property_Analytics/docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md`: Monteverde is the seed pattern for a future portfolio-grade Website Change Watch capability that should integrate with Site Content Creator, Data Pond snapshot/diff persistence, Captain website routines, EVS post-change validation, Watchtower freshness/alerts, and Specs page-section contracts.
- This should keep baseline, diff, and delayed impact analysis as separate concepts and should ingest WordPress/WP Engine backend audit evidence when available rather than becoming a parallel generic SEO monitor or report family. Full backend accountability still requires WordPress/WP Engine revision or activity-log access.

Operational note added on 2026-05-18:

- Copy Change Monitoring is now a local Data Pond source route for permanent CMS/site copy, title, meta, FAQ, and CTA changes.
- The route is documented in `/Users/mark/Property_Analytics/docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md` and implemented through `/Users/mark/Property_Analytics/Data_Collection/utils/copy_change_monitoring.py`.
- 2026-06-10 named recurring workflow: `Copy Change Recovery Lane` is documented in `/Users/mark/Property_Analytics/docs/COPY_CHANGE_RECOVERY_LANE_2026-06-10.md` for Act Now / worst-performing copy-change properties. It extends this source route with required Captain/DataForSEO/Data Pond research, WordPress-ready SEO/Hero/Romance paste targets, live public-HTML verification, structured new-content/confound artifacts, Data Pond registration, Captain/Logkeeper handoff, and a filtered test Copy Change Impact Brief email.
- Local SQLite tables `copy_change_waves`, `copy_change_interventions`, and `copy_change_observations` store wave definitions, property/page interventions, publish timestamps, first full post-change dates, changed fields, target queries, confounds, and normalized observation rows.
- `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py` now reads active interventions from the registry, seeds the legacy April 17 copy-change cohort, writes local aggregate GSC/GA4 and GSC query-cohort observations, and keeps the email surface as a PIB-style executive quick read without attaching raw JSON by default.
- 2026-05-30 presentation tightening: the same canonical sender now uses approved Copy Change Impact Brief template `v1.2`, rendering property detail as at-a-glance pulse rows with the status pill below the change note and above a smaller compact metrics strip. GSC/GA4 values stack on separate lines without pipes, requested property filters resolve through the governed identity matrix, the visible email dedupes to one card per property using the latest active intervention, the email does not show partial counts for milestone periods that are not live yet, and detailed evidence remains in JSON and local observation rows.
- 2026-05-30 decision-read upgrade: the same sender now uses approved Copy Change Impact Brief template `v1.3`, preserving the compact v1.2 KPI strip while adding Act Now / Promising / Watch / Too Early decision cards, an Executive Read block, and per-property action, confidence, driver, recommendation, and watch/confound flags. The decision layer uses existing canonical/local evidence only: GSC/GA4 movement, GSC query cohorts, unit availability/specials, Google Ads data freshness, and DataForSEO on-page checks where available.
- `/Users/mark/Property_Analytics/scripts/register_copy_change_intervention.py` lets operators add new properties and waves without editing report code.
- This capability should integrate with Site Content Creator for approved old/new copy, Website Change Watch for baseline/diff evidence, DataForSEO for SERP/ranking context, EVS for post-change rendering/CTA checks, and Captain/Watchtower for follow-through. It does not create a new PIB renderer and does not touch locked PIB files.
- 2026-05-20 SOP clarification: meaningful site changes now require Captain consultation before approval/publish because the property Captain should know the property best. Adding a property to an active copy-change wave, or materially changing tracked fields, also requires a Captain/Navigator/Logkeeper handoff so property memory captures the publish timestamp, first full post-change day, target queries, hypothesis, and proof sources. If Captain runtime/watch tables are unavailable locally, the handoff is written under `/Users/mark/Property_Analytics/reports/captains_log/copy_change_alerts/`.

Operational note added on 2026-05-13:

- Spotlight now has a daily PageSpeed Insights performance roundup for the current 11-property Spotlight set.
- The report lives in the existing pilot roundup reporting family rather than creating a new executive report family: `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_spotlight_performance_roundup.py` generates the HTML/Markdown artifacts and `/Users/mark/Property_Analytics/pilot_roundup/scripts/send_spotlight_performance_roundup_email.py` handles delivery.
- The approved presentation contract is PSI-first: `Spotlight Performance Roundup` with subtitle `PageSpeed Insights Performance`, dominant PSI performance score/trend, supporting New Users / core PSI-CWV / BrowserStack context, no GTMetrix section, and no status chips.
- The daily wrapper `/Users/mark/Property_Analytics/run_spotlight_performance_roundup_daily.sh` is loaded through `/Users/mark/Library/LaunchAgents/com.venterra.spotlight.performance.roundup.daily.plist` at `7:00 AM` local time.
- The delivery audience is Mark Laufhutte, Eric Longoria, and David Crandall, with duplicate-send protection persisted under `/Users/mark/Property_Analytics/logs/email_delivery/spotlight_performance_roundup`.
- The Spotlight 11 are resolved through `/Users/mark/Property_Analytics/config/property_identity_matrix.json` using property codes `TX416`, `FL4TA`, `GA4BL`, `TX4CO`, `KY4TG`, `FL4GW`, `FL4HL`, `KY4MP`, `TX4FV`, `TX4GM`, and `KY4SC`; no per-report one-off identity map should be added downstream.
- Codex automation `daily-spotlight-pagespeed-insights-performance` should be treated as a watchdog for the launchd schedule/delivery log, not as an independent primary sender.

Operational note added on 2026-07-04:

- Pilot Master speed stability now has a daily emailed brief for `https://pilot.venterradev.com/` through `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_master_stability_report.py`.
- The report is part of the existing Pilot Monitoring/CWV platform and not a new report family. It runs clean exact-URL PSI and fresh-query PSI samples, stores raw PSI payloads under `/Users/mark/Property_Analytics/pilot_control_cwv/reports/pilot_master_stability/YYYY-MM-DD/`, checks live mobile HTML markers for the current edge proof state, verifies Zaraz/Heap mode through Keeper-backed Cloudflare access, includes latest GTMetrix evidence when present, and emails rolling history, consistency, user/field-data, change, and next-action sections.
- Codex automation `daily-pilot-master-speed-stability-brief` is the active daily sender at `11:30 AM` America/Chicago. It should use Keeper/KSM credentials only and keep Edge Messaging paused unless Mark explicitly requests restoration.

Operational note added on 2026-05-14:

- The consolidated Data Collection alert lane now includes a GSC core indexation warning check sourced from daily `gsc_url_inspection` evidence.
- This check is intentionally narrower than Search Console's broad non-indexed page count. It escalates only business-risk conditions: canonical property homepage/core URL non-PASS, no sampled URL returning PASS for a reportable property, or explicit robots/noindex signals.
- Benign Search Console exclusions such as redirects, alternate canonicals, specials pages, and other non-core URL states remain stored as evidence but do not trigger the new warning.
- The alert preview includes a `Core Indexation Warnings` summary tile and renders a dedicated GSC Core Indexation Warnings section when risks exist. The 2026-05-14 verification found `0` active core indexation warnings across the live/profile-backed portfolio.

Operational note added on 2026-05-17:

- `/Users/mark/Property_Analytics/docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md` now defines the Property Narrative Canon as the core artifact for future Content Operations strategy.
- The canon is not a one-off content output. It is the durable property narrative source from which Site Content Creator recommendations, VACS long-form content, GBP/social/email packages, FAQ/schema updates, Captain/Navigator content actions, and future outlet publishing artifacts should derive.
- System ownership remains layered: Data Pond is factual authority, Captain's Log / Brief is operating intelligence, VACS is narrative synthesis, Site Content Creator is live-site expression and harmonization, and Content Office is channel distribution/proof.
- DataForSEO is the active search/environment source for new search, OnPage, business, AI visibility, and LLM mention evidence. Ahrefs is now a governed advisory source for technical SEO health, authority, Web Analytics, and GSC availability; charged backlink, competitor content-gap, keyword, Brand Radar, and topic evidence remain opt-in after scope/cost approval. SEMRush remains terminated for the active operating lane, with any remaining rows treated as legacy history only.
- The first implementation slice should prove one property canon, one live-site harmonization audit, one long-form VACS artifact, and one channel derivative package before broad publishing automation.

Operational note added on 2026-04-14:

- the current dirty worktree is best understood as several coherent workstreams stacked together rather than random churn
- the branch split and release-shaping map now lives in `/Users/mark/Property_Analytics/docs/RELEASE_SPLIT_PLAN_2026-04-14.md`
- production promotion should come from the clean `codex/release-reconcile` path, while pilot CWV, Intelligence Office / Site Content, Zero Trust / SSO, and EVS work should be separated into follow-up branches

## 4. Canonical Foundations

### 4.1 Master Database

Canonical data store:

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

Observed role:

- shared source of truth for collectors
- shared read model for reporting products
- base layer for newer Data Pond / app platform work

Known consumers called out across repo/docs:

- PIB
- Spotlight
- Daily Health
- Weekly Progress
- Focus Report
- CWV snapshot and portfolio health reports
- pilot monitoring exports and roundups
- app/API ingestion and mirror workflows

### 4.2 Property Registry

Canonical registry:

- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

Observed role:

- canonical property metadata and ID mapping
- shared dependency for collectors, reports, matching, and app views
- now carries governed `encasa_region` assignments for the `91` active properties present in the 2026-05-04 `regions.xlsx` workbook via `/Users/mark/Property_Analytics/Data_Collection/utils/property_regions_ingest.py`

### 4.2.1 Property Identity Matrix

Canonical cross-source identity matrix:

- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Resolver and governance:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
- `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`
- `/Users/mark/Property_Analytics/scripts/build_property_identity_matrix.py`
- `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`
- `/Users/mark/Property_Analytics/docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md`

Observed role:

- resolves property code, GA4 property id, GSC URL, website URL, app community UUID, Encasa short name, GBP location id, company id, unit count, and aliases into one governed identity record
- uses the remote D1 community snapshot to complete app/D1 `community_id` coverage locally
- uses property code as the visible / Captain-facing property id when available
- removes hardcoded per-ingester property exceptions from Marketing BI conversion, daily packet, available-unit-interest, operating-metrics, and Captain source mirror ingestion
- is now backed by `scripts/check_property_identity_governance.sh`, which validates matrix health and required resolver usage
- now includes the governed property-region source route documented in `/Users/mark/Property_Analytics/docs/PROPERTY_REGIONS_SOURCE_CONTRACT_2026-05-04.md`, so Captain peer-family reads, regional benchmarks, and Commodore synthesis can use portfolio region groupings without downstream one-off maps

Audit judgment:

- this is now the required extension point for new source ingestion and Captain Brief source reads
- remaining maturity item is keeping the remote community snapshot refreshed whenever the app community dimension changes

### 4.3 Shared Utilities and Guardrails

High-value shared foundations:

- `utils/` for email, validation, config, KSM, reporting helpers
- `Data_Collection/db/database_manager.py`
- `Data_Collection/utils/data_quality_validator.py`
- Keeper/KSM documentation and secret mapping
- PIB guardrails in [AGENTS.md](/Users/mark/Property_Analytics/AGENTS.md)
- Report-family delivery discipline: PIB-family, Captain, Watchlist, Spotlight, and specialty brief emails should be sent through the established family shell/sender/orchestrator first. `utils/email_sender.py` is the shared low-level transport, not permission to create one-off report delivery wrappers when a canonical report family exists.
- 2026-05-07 Watchlist delivery separation: the active Watchlist Decision Output v1.1 path now keeps the executive email and site-manager Word attachment in the same canonical report family. The main email suppresses selected internal decision-check/cost-history blocks, while the generated Word attachment is a plain-English site-manager action plan that omits internal/technical sections and travels as an attachment through the canonical Watchlist sender.
- 2026-05-07 multifamily SEO/local-content standard: VP-supplied SEO/GEO/AEO/AIO guidance is now governed by `/Users/mark/Property_Analytics/docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md`. Watchlist Decision Output v1.1 now includes a compact `SEO + Local Content Action Pack` that ties website, GBP, social, metadata, FAQ, and shadow-page recommendations to actual inventory pressure, funnel condition, competitor/value evidence, and DataForSEO on-page snapshots instead of generic SEO advice.
- 2026-05-07 Watchlist Decision Output v1.2 comparison standard: the Watchlist report family is now versioned to v1.2 for new runs. The standard is memorialized in `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_2_2026-05-07.md` and requires T30/T90 direction, portfolio and regional funnel comparisons, channel/source portfolio and regional yield reads, restored guest-card-to-available-unit-type analysis, direct non-defensive spend language, and a version-matched site-manager Word companion.
- 2026-05-07 Watchlist v1.2 insight standard correction: section-level tables are now explicitly treated as evidence, not narrative. Major report sections must carry interpretation panels that explain what the data means, why it may be happening, what to do next, and what not to do. A `Damage / Friction Check` now surfaces negative reviews, attention reviews, service/ticket no-response risk, reopen/ticket posture, make-ready/readiness, and other trust blockers as conversion risk.
- 2026-05-07 Watchlist v1.2 funnel-gap correction: the `Current Funnel Stress Test` now separates broad traffic-volume sufficiency from the actual recovery gap, so a zero lead/visit/PQ gap does not hide net exposure, floorplan/product-fit, follow-up, offer clarity, pricing/concession, or readiness blockers.
- 2026-05-07 Watchlist v1.2 reputation expansion: `Reputation / Product Friction` now uses the richer PIB reputation evidence lane, including GBP review volume/star mix/reply capture, sentiment breakdown, theme sentiment, critical review action items, Reputation.com trend/components, and local reputation competition where available, with GBP evidence labeled separately from Reputation.com current-period rows.
- DataForSEO credentials now resolve through Keeper via `/Users/mark/Property_Analytics/utils/dataforseo_auth.py`, with verification at `/Users/mark/Property_Analytics/scripts/check_dataforseo_auth.py`
- Official operating metrics now have a drop-ready AR4PB source template and operator wrapper, so the Captain Brief evidence gate can be cleared by filling the source-of-record file rather than relying on inferred occupancy or concession values.
- 2026-05-06 GBP auth standardization: `/Users/mark/Property_Analytics/utils/config_manager.py` now owns the canonical GBP OAuth client/token paths via `get_gbp_credentials_path()` and `get_gbp_token_path()`, and `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` now uses those shared getters for both GBP reviews and GBP insights. Current live state still falls back to local files because `KSM_GBP_CLIENT_SECRET_UID` and `KSM_GBP_TOKEN_UID` are not yet populated, and the existing `gbp_token.pickle` is brittle because it serializes internal `google-auth` classes not present in the current scheduled runtime.
- 2026-05-07 GBP live repair: `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` now carries the single governed GBP auth loader, prefers JSON authorized-user token storage, and includes a one-time compatibility shim so legacy pickled tokens can be refreshed and migrated instead of breaking unattended collection. `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` insights collection now reuses the same collector credential object as reviews rather than separately opening the token file with `pickle.load(...)`. The live legacy token was successfully refreshed into `Portfolio_Monitoring/credentials/gbp_token.json`, and both GBP Reviews and Business Profile Performance API calls were proven against live matched locations. Remaining gap: Keeper UIDs for the GBP client secret/token still need to be populated for full KSM-only posture.
- 2026-05-06 Captain/report terminology cleanup: user-facing late-funnel wording now uses `PQ` (`Price Quote`) instead of `RFP`, while the underlying Marketing BI storage fields remain `rfp_*` for backward compatibility with existing ingests and queries.

## 5. Capability Inventory By Domain

### 5.1 Data Collection and Normalization

Primary canonical system:

- `Data_Collection/`

Current capabilities present:

- GA4 collection
- GSC collection
- GBP collection
- Reputation.com XLSX export ingestion for vendor reputation score, review mix, response rate, score components, time-series trend, and local competition evidence, resolved through the governed property identity matrix, stored in `reputation_com_*` Data Pond tables, and mirrored into Captain D1 source packets with GBP review/sentiment/summary/insight enrichment for Captain reputation reads
- GBP review sentiment backfill via `/Users/mark/Property_Analytics/Data_Collection/utils/gbp_review_sentiment_backfill.py`, which deterministically derives `gbp_review_sentiment` rows from collected GBP review ratings and explicit source-text keyword matches when raw GBP reviews exist but sentiment enrichment has not been generated. The utility resolves property identity through the governed matrix and does not use an LLM or invent review facts.
- Competitor market research ingestion for sourced public competitor rents, specials, availability, USPs, media/package indicators, reputation, and explicit source gaps in `competitor_market_research_snapshots` and `competitor_market_research_observations`, resolved through the governed property identity matrix and mirrored into Captain D1 source packets for POP Brief / Captain competitive slices; the 2026-05-06 Spotlight batch builder at `/Users/mark/Property_Analytics/Data_Collection/utils/build_competitor_market_packets.py` can generate dated official-page competitor packets from governed comp sets plus internal subject rent/special posture; Captain Brief read models now expose `competitorMarketRead`, pull the subject property's current visible rent/specials from internal `unit_availability_units`, ignore invalid nonpositive unit-feed rent placeholders, use the combined internal-plus-competitor evidence for pricing-vs-advertising / copy / package-status logic, keep unsupported ADC/package claims gated, render explanation-first source markers that tie Captain claims to a bottom Data Integrity panel, and now have an Elation/TX4EG proof pass where the Competitive Market Read is embedded into the full property-aware Captain Brief instead of sent only as a standalone competitor slice
- GTMetrix collection
- guest card collection
- Marketing BI daily packet PDF ingest for Captain's Log grounding, storing packet headers, searchable page text, and Portfolio Summary property rows for daily Captain context
- Marketing Ops Summary workbook ingestion for portfolio-level property performance, traffic, pricing, financial, and Kingsley advisory signals in `marketing_ops_summary_rows`, resolved through the governed property identity matrix and now mirrored into Captain D1 source packets with `opsSummary` / `opsRead` exposed in the Captain Marketing Insight payload
- Spotlight weekly field notes/action-plan ingestion for additive human operating evidence, storing weekly property snapshots and action item ledgers in `spotlight_weekly_field_snapshots` and `spotlight_weekly_action_items`, resolved through the governed property identity matrix and mirrored into Captain D1 source packets so Captains can explain metric movement, track recovery execution, and flag stale or underspecified actions without overriding source-of-record metrics
- Captain Brief read-model composition now includes Marketing BI and reputation advisory blocks: Marketing BI joins the daily packet with available-unit interest, traffic conversions, cancel/denial diagnostics, and the promoted Marketing Ops Summary source route, while the reputation block blends Reputation.com score/review-mix/component/trend/local-competitor posture with GBP resident voice, reply coverage, sentiment themes, and local profile actions; both preserve Data Pond authority for official operating and unit-level facts
- ThirtyLines collection
- Cloudflare edge delivery analytics collection through `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`, storing daily GraphQL source facts in `cloudflare_edge_daily_metrics` without replacing GA4, Heap, or GSC
- Cloudflare cache audit collection
- orchestration of daily master collection
- collection monitoring and alerting
- anomaly detection and credential monitoring
- backfills for GA4 new users and channel new users
- GSC URL inspection collection
- CWV history backfill

Most important entrypoints:

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/collect_gsc_url_inspection.py`

Audit judgment:

- this is one of the clearest canonical cores in the repo
- it should remain the default collection layer unless there is a deliberate exception

### 5.2 Reporting and Operational Intelligence

Current reporting capability families include:

- Property Intelligence Brief
- Captain's Log and Captain's Brief, with a codified command hierarchy for Fleet Commander, Chief of Staff, Admiral, Commodore, Captain, First Officer, Quartermaster, Navigator, Signals Officer, Engineer, Boatswain, and Logkeeper, plus a memory/directive standard requiring Captains to remember prior expectations, actions, outcomes, and lessons before issuing new recovery guidance, a weekly Reputation Watch lane for Reputation.com score/response/review-mix/local-competition posture, Spotlight weekly field-note memory for human recovery execution context, and a reusable local vNext generator that composes a recovery-directive brief from Pond facts, structured Marketing BI traffic/spend/source rows, PSI/Core Web Vitals conversion-health rows, business-facing remote Captain watch/action state, and a bottom `Sources Used` panel instead of top source-status narrative. The current report path is memorialized in `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_VNEXT_REPORT_MEMO_2026-05-06.md`. The Watchlist Decision Output v1.1 standard is memorialized in `/Users/mark/Property_Analytics/docs/WATCHLIST_DECISION_OUTPUT_STANDARD_V1_1_2026-05-07.md` as an additive Watchlist decision packet with mandatory PIB-style header, visual scorecard, channel budget efficiency, recommendation guardrails, action packages, T30/T90 outcomes, bottom sources, and quiet repository links. This reporting lane now also uses governed display aliases for awkward BI source taxonomy in user-facing outputs, including `ADC`/`Apartments.com` as `Apartments.com / ADC` and `Drive By` as `Walk-In / Drive-By`, while preserving the raw stored source values underneath.
- Captain/read-model marketing economics now also calculate per-channel `cost per lease` and derived `cost per move-in` where BI cost-per-conversion rows and source-performance rows can be reconciled, so source-efficiency reads can move beyond guest-card/app proxies without rewriting raw BI source truth.
- The reusable local Captain Brief now also carries a PIB-style secondary `Unit-Type Spend / Targeting` block beneath the main marketing channel content. It shows classified unit-type spend versus generic capture, targeted unit-type count, clicks, conversions, and top keywords by unit type, preferring local `ad_keyword_performance`, then remote D1 `ad_keyword_performance`, then the latest generated marketing mirror SQL batch as a controlled fallback when the local mirror is behind.
- The Captain app now reads and renders the same unit-type targeting block through `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` and `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx`, keeping the web surface aligned with the generated Brief instead of introducing a separate paid-search targeting interpretation.
- Property diagnostic JSON data layer for downstream agents, including the internal diagnostic serializer at `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` and the VP-specific retrieval contract serializer at `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`. The internal diagnostic JSON produces one governed property object with clean numeric demand, funnel, inventory, pricing, marketing-efficiency, reputation, website-performance, comparison, flag, source, and missing-data fields. The VP serializer outputs the stricter one-object-per-property retrieval contract memorialized in `/Users/mark/Property_Analytics/docs/VP_PROPERTY_RETRIEVAL_JSON_CONTRACT_2026-05-06.md`. First artifacts include `/Users/mark/Property_Analytics/reports/property_diagnostics/tx4eg_property_diagnostic_2026-05-06.json` and `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`; both are Data Pond read models and do not create or alter PIB rendering behavior. The 2026-05-06 source-mix expansion adds Marketing BI source/origin performance, T365 move-ins by source without resident-name storage, source-level monthly advertising spend from the month-by-month spend workbook, Portfolio Box Score make-ready/box-score facts, and T90 service-delivery posture. The 2026-07-01 Power BI workbook intake loaded fresh conversion-dashboard, source-performance/origin, and Portfolio Box Score rows across `92` mapped properties into the same Marketing BI Excel ingestion path, with parser protection against unscoped hierarchy-total rows entering property-scoped evidence.
- Search Intelligence report builder
- specialty PIB-style SEO property proof briefs for rolling and explicit date windows
- PIB-style daily copy-change impact briefs
- those copy-change briefs are being actively tuned for operator readability; they currently emphasize direct same-property matched-window evidence in the email surface, while control-cohort comparison can remain a secondary analytical layer rather than a required front-and-center card
- Portfolio Pulse / daily monitoring
- Daily Health reports
- Morning Full portfolio report
- Weekly Progress reports
- Spotlight Properties report
- Focus Report
- CWV snapshot
- selected-property CWV T30 briefs
- GSC snapshot
- property assessments and executive/leadership/prelaunch assessments
- PIB-style and roundup outputs for specialized use cases

Representative scripts:

- `/Users/mark/Property_Analytics/generate_daily_portfolio_health.py`
- `/Users/mark/Property_Analytics/generate_morning_full_report.py`
- `/Users/mark/Property_Analytics/generate_weekly_progress_report.py`
- `/Users/mark/Property_Analytics/send_daily_health_report.py`
- `/Users/mark/Property_Analytics/send_morning_full_report.py`
- `/Users/mark/Property_Analytics/send_weekly_progress_report.py`
- `/Users/mark/Property_Analytics/focus_report/scripts/generate_focus_report.py`
- `/Users/mark/Property_Analytics/scripts/backfill_selected_gsc_window.py`
- `/Users/mark/Property_Analytics/scripts/send_seo_t30_property_brief.py`
- `/Users/mark/Property_Analytics/scripts/send_copy_change_impact_brief.py`
- `/Users/mark/Property_Analytics/scripts/generate_portfolio_psi_pib_report.py`
- `/Users/mark/Property_Analytics/scripts/send_selected_cwv_t30_report.py`
- `/Users/mark/Property_Analytics/reports/gsc_snapshot/generate_portfolio_gsc_snapshot.py`
- `/Users/mark/Property_Analytics/apps/api/src/routes/search-intelligence.ts`

Audit judgment:

- reporting is one of the strongest and most mature capability areas
- there are several separate report brands with overlapping data access and rendering patterns
- the daily summary lane is now intentionally consolidating around Morning Full as the canonical scheduled email, with legacy daily-health delivery routed into that single path and duplicate-send protection on summary subjects
- specialty pilot roundups and export notifications have had active policy churn; wrapper defaults must be verified in code before assuming whether pilot informational email is suppressed or enabled
- the retired separate `Pilot Data Exports` daily email must remain unscheduled; the stale 6:00 AM `com.venterra.pilot.data_exports.daily` LaunchAgent was unloaded and archived on 2026-07-17, leaving the consolidated pilot roundup as the active CSV delivery path

Monitoring note:

- `/watchtower` now serves as more than a freshness matrix
- it also functions as a compact operator-facing integrity surface for:
  - core vs specialty collection failure counts
  - freshness warning / stale source counts
  - top active integrity issues from canonical monitoring tables
  - source-aware freshness expectations for manual morning feeds such as guest cards, so weekend and pre-8 AM windows do not register as false stale conditions
- D1 health evaluation is now more operationally honest too: same-day summary/alert logic will no longer let a later failed rerun supersede an earlier successful mirror report, which prevents auth-only retry noise from presenting as a false D1 outage
- morning failure alerting is also consolidating around:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- registry validation findings now belong inside that central failure email instead of generating their own separate standalone validator alert
- the legacy standalone registry validation LaunchAgent should remain disabled unless there is an explicit reason to restore a separate mail path
- Keeper migration on the live operations stack is now tighter than the earlier draft implied:
  - the D1 mirror path is no longer dependent on shell-exported `KSM_*` vars alone, because the Wrangler helper now injects the canonical Cloudflare token notation/profile defaults for launchd execution
  - parent collection/retry/alert orchestrators now pass that hardened runtime env into `d1_mirror_sync.py`
  - the live Google Ads collector now materializes its API config from Keeper by default instead of depending on the legacy checked-out `google-ads.yaml` path
- Google Ads collection also now better matches the actual account operating model:
  - zero-row daily results are treated as `no activity` rather than automatic failure
  - only mapping gaps and true API failures stay in the retry queue
  - this matters because the current manager-account setup does not reliably produce daily rows for every mapped property, even when attribution is otherwise correct
- 2026-06-03 Google Ads mapping hardening: screenshots for Canton Mill Lofts and The Maddox exposed that the March campaign-property mapping had gone stale and missed active June local/brand campaigns. The runtime analyzer now materializes Google Ads config through Keeper and rebuilds `config/google_ads_campaign_property_mapping.json` from live API evidence using the governed property identity matrix, property company ids, property codes/tracking tokens, aliases, campaign/ad-group/ad text, final URLs, and tracking templates. The collector now refreshes stale or legacy mappings before collection. Same-day proof mapped `202` active campaigns across `86` properties with `0` unmatched active campaigns, then collected June 1-3 local/brand campaign and keyword rows for Canton Mill Lofts and The Maddox. Both properties still showed `0.0` Google Ads conversions, so future reads should separate ad-activity presence from conversion-tag/attribution health.
- Same-day follow-through added `/Users/mark/Property_Analytics/scripts/audit_google_ads_integrity.py`, which persists attribution and conversion-health read-model tables in the local Data Pond and writes evidence under `/Users/mark/Property_Analytics/reports/google_ads_integrity/`. A full June 3 portfolio collection with the refreshed mapping completed for all `86` mapped properties with `0` failures, writing `171` campaign rows, `$1,464.90` spend, `1,228` clicks, and only `2.0` conversions. Integrity audit artifact `/Users/mark/Property_Analytics/reports/google_ads_integrity/2026-06-03_111555/summary.md` reported `0` attribution gaps / unmatched active campaigns, plus `52` active zero-conversion campaigns and `102` lower-volume watch-zero-conversion campaigns. This confirms the immediate paid-media diagnostic lane should focus on conversion tracking / attribution health while preserving the now-hardened campaign-property detection.
- Google Ads collection now also degrades more honestly when Keeper/bootstrap is the problem:
  - the collector raises a typed bootstrap failure instead of exiting the whole runtime blindly
  - canonical collection/retry orchestration can record the run as blocked and keep source-level retry intent visible
- the morning retry loop now closes a major orchestration gap for Google Ads:
  - a source-level `google_ads` retry item can trigger a full Ads collection pass when no same-day Ads run record exists yet
  - that prevents the system from leaving Google Ads in a permanent `missing/no_run_recorded` state after the first pass fails to create a run
- launchd collection and retry wrappers now explicitly export the Keeper home/profile context needed for Google Ads collection instead of relying on ambient shell state
- the same closure/bookkeeping problem is now fixed for other source-level retries too:
  - successful `unit_availability` and `d1_mirror` retry actions write/close same-day collection rows
  - closure and Watchtower can now move those sources out of `missing` once the retry worker actually recovers them
- prelaunch/non-live registry entries now affect the canonical collection path rather than only alert rendering:
  - GSC collection, GSC URL inspection, and GSC retry handling suppress those communities while they remain marked `lifecycle: prelaunch`
  - this removes false operational debt for not-yet-launched sites such as `The Vine Kyle Parkway` and `Sundara at Spring Cypress`
- Guest cards are currently in an explicit temporary suspension posture rather than an accidental stale/manual-dependency posture:
  - this posture was reversed on 2026-04-15
  - canonical guest card ingest is active again and advanced local guest-card freshness to 2026-04-15
  - the OneDrive drop remains the shared landing zone for both guest card CSVs and pilot BI / Measurement workbooks
  - pilot BI snapshot ingestion is now caught up through governed workbook harvest from that same shared directory, and Measurement ingestion now resolves the newest valid `Measurement_Dashboard*.xlsx` workbook version instead of a fixed `1.1` filename; the 2026-05-09 proof pass loaded `Measurement_Dashboard_1.3.xlsx` through `2026-05-07`
  - the post-ingest real D1 mirror also succeeded again on 2026-04-15, and same-day closure now evaluates `complete` with no open retry debt after guest card, Ads, unit availability, and D1 bookkeeping are written honestly into `data_collections`
  - BI harvest is no longer manual-only: the canonical morning collector now ingests pending `BI-Metrics-RunYYYYMMDD.xlsx` files from the shared drop, and the retry cycle re-checks for late-arriving BI workbooks later in the morning using the same shared helper logic
- `/watchtower` has now started growing into a live daily collection console as well:
  - the API returns a `daily_collection_status` block derived from canonical `data_collections`
  - the web surface shows a "Today's Collection" panel with source-level status, progress counts, retries, rate-limit hits, timing, and current operator context
  - the web surface is now intentionally display-centric rather than table-first:
    - hero tower-state readouts
    - dial gauges for coverage, closure, freshness, and integrity pressure
    - a visual source signal rail and hot-source emphasis
    - richer collection source pods and closure-context panels
    - live auto-refresh, a tower clock / last-sync display, and small motion charts that make the operator surface feel active rather than static
    - a seven-day recovery tape and source-coverage drift section backed by actual history returned from the canonical health route
    - a live retry-queue board backed by unresolved items from `collection_retry_queue`, so the UI can show exactly what work is still in circulation
    - operator controls on that queue board for search, scope filtering, and a focus mode that promotes the riskiest open work
    - a command rail at the top of the page that compresses immediate action, manual waits, hard blocks, and closure state into one fast-read strip, now with queue-aware directives instead of raw counts alone
    - source timeline lanes that show recent per-collector run states and completion percentages across the collection window
    - interactive drill-in behavior on those lanes so operators can select a source and immediately inspect current progress, queue load, live notes, and recent retry signal
    - source-focus propagation so selecting a lane can reorient tower heat, issue surfaces, freshness cards, coverage drift, and queue interpretation around that source
    - source-specific runbook hints in the drill-in panel so Watchtower can suggest likely remediation and escalation paths for GA4, GSC, Google Ads, guest cards, unit availability, and D1 mirror
    - source-aware action chips in the drill-in panel that translate those runbook hints into concise suggested next moves
  - the web surface also exposes whether the day appears open or closed from the mirrored operational state
  - the retry queue and closure-state worker now exist as the primary morning control-loop foundation
  - targeted retry execution is now live for GA4, GSC, and Google Ads, while source-level follow-up exists for guest cards, unit availability, and D1 mirror
  - the retry cycle is now actually scheduled on the machine through a dedicated LaunchAgent and wrapper, rather than existing only as an on-demand worker
  - historical retry debt is no longer left open indefinitely: the retry worker now archives unresolved past-date queue items as exhausted reconciliation debt, which keeps old days from masquerading as active live incidents
  - closure semantics now distinguish current-day operational states from past-date governance states: historical dates outside the retry window evaluate as `archived`, and closure payloads now include advisory-source status for non-core lanes such as BI, Measurement, PSI, GSC URL inspection, SEMrush, GBP, and Cloudflare cache audit
  - Watchtower now consumes that richer closure structure directly: unresolved sources are shown with reason labels rather than flattened strings, closure badges distinguish `archived` and `blocked`, and a dedicated advisory-governance panel exposes non-core lane coverage without pretending those lanes are part of the narrow morning hard-stop contract
  - the newer platform-constellation layer is also becoming actionable rather than purely descriptive:
    - it can now show explicit representation/trust gap counts
    - and it carries a canonical gap runbook for off-Pond capabilities, machine/API gaps, human-surface gaps, trust-hardening review, and nested repo pressure
    - it now also attaches a node-specific next move to each landscape card, which makes the tower more like an actual control plane than a static catalog
    - that node guidance is now partially evidence-driven from live route/trust/representation signals rather than remaining a purely declarative annotation layer
    - it now distinguishes expected trust mode from observed trust posture, which lets the tower show where auth reality still lags the intended Zero Trust model
    - and that trust comparison now rolls up into aligned / transitional / review summary counts so the control plane can answer platform trust posture at a glance
    - the tower now also prioritizes trust work by ranking the most important review/transitional nodes instead of leaving trust debt as an unprioritized list
    - that ranking is now driven by unmet remediation criteria and stalled closure, not only broad posture tags
    - the tower can now also roll up recurring closure blockers across the platform, which makes shared trust/migration debt visible as a systems pattern rather than only as isolated node cards
    - those shared blocker rows now point back to the primary owning remediation track, so the control plane can route from recurring pattern to governed cleanup path directly
    - those priority nodes now point to explicit remediation tracks, which ties the control-plane signal back to the actual cleanup/hardening documents we expect the team to follow
    - remediation tracks now also carry lifecycle state, and that lifecycle is now derived from the same machine-evaluated criteria the tower shows on each node
    - remediation state is now backed by explicit completion criteria, which makes the control plane more rigorous than a simple label-and-link model
    - those remediation criteria are now machine-evaluated from current node evidence, so the tower can show what is already satisfied versus what still blocks closure
- pilot morning wrapper hardening also matters operationally:
  - the workflow can now survive the previously observed homepage-audit bootstrap path because canonical DB defaults were corrected and the homepage audit collector now passes the canonical DB path explicitly
  - pilot bootstrap failure alerts now identify the active stage more truthfully instead of making the pipeline tail `tee` command look like the root cause
  - the homepage-audit collector is now also more resilient to transient site/probe disconnects: on 2026-04-20 a single Calais Midtown remote disconnect blocked the whole pilot morning despite fresh GTMetrix and PSI data, so the collector now retries retryable per-property probe failures before it marks the stage failed
  - the wrapper itself now owns a true homepage-evidence remediation loop and duplicate-alert suppression: if the stage still fails after collector-local retries, the morning workflow performs additional stage-level attempts before alerting, and intentional stage exits no longer trigger a second misleading `Bootstrap / Shell` alert from the Bash `ERR` trap

### 5.3 Canonical PIB

Canonical PIB area:

- `Property_Intelligence_Brief/`

Locked canonical files:

- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
- `/Users/mark/Property_Analytics/Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py`

Capabilities present around PIB:

- canonical property intelligence generation
- approved locked versioned PIB v2.2.0 with SightMap metrics for Resi properties
- approved `PIB Site Evaluation` intro in property-level v2.2.0 PIBs when DataForSEO / BI / GSC / availability / review support context exists; as of explicit 2026-07-01 approval, this intro is governed as a factual evidence read with `What The Data Shows`, `Observed Evidence`, and `Recommended Follow-Up Checks`, not an underperformance diagnosis unless the source packet proves cause
- approved versioned PIB v2.3.0 path with a dedicated ApartmentIQ advisory enrichment section sourced from governed ApartmentIQ Pond tables
- email sending
- portfolio launch metric watch
- ads intelligence brief
- validation utilities
- historical variant templates and versions
- large archive of rendered property outputs and payloads

Audit judgment:

- PIB is not just a report; it is a long-lived product family with strong institutional value
- the repo also contains many PIB-adjacent experiments and derivative renderings, so guardrails matter
- the executive intro wording is part of the approved artifact contract: future edits should preserve the non-prejudicial evidence stance and the required DataForSEO source lane rather than reverting to attack-stance/root-cause language

### 5.4 Legacy Monitoring and Dashboard Systems

Legacy but still capability-rich systems:

- `Portfolio_Monitoring/`
- `Portfolio_Dashboard/`

Capabilities still visible here:

- daily collection wrappers and scheduled jobs
- portfolio pulse email generation
- older alerting, anomaly, and review workflows
- GA4/GSC/GBP exploration and audits
- Streamlit dashboard with portfolio overview, property deep dive, comparison, trends, insights, and settings
- Google Ads exploration and CIR validation work

Audit judgment:

- these directories contain real, still-useful logic and institutional knowledge
- they also contain legacy duplication that should not be mistaken for the preferred modern path

Planning note:

- treat them as capability archives plus selective reusable utilities, not as the default place to build new canonical systems

### 5.5 Data Pond / App Platform

Modern app platform areas:

- `apps/api`
- `apps/web`
- `packages/shared`

Observed API capability surfaces:

- auth and admin
- PIB routes
- metrics and marketing data
- GSC and exports
- communities
- GBP posts
- Fishing Hole conversational analytics
- EVS endpoints
- platform phase 1 routes
- VACS route

Additional governed memory capability now present in the app platform:

- a governed multi-layer memory service embedded in `apps/api` and surfaced through the existing Intelligence Office UI in `apps/web`
- explicit property-to-fleet-to-ledger promotion workflow with governed fleet targeting, durable entry lineage, audit logging, and identity bindings
- consumer-facing reads now default to authoritative states only, with broader status access limited to explicit admin/debug paths
- consumption hooks for downstream governed tools such as VACS and Site Content Creator so execution systems can read memory without redefining truth, with VACS now treated as a fail-closed service-auth surface, contract tests proving payload separation, and Site Content Creator using property-scoped brief inputs while presenting memory separately from guidance and source evidence
- analysis and pond routes
- audit logging and role-aware access control

Observed web product surfaces:

- `/pib`
- `/pib/property`
- `/watchtower`
- `/dock`
- `/fish`
- `/analysis`
- `/analysis/pib`
- `/analysis/gsc`
- `/gsc`
- `/marketing`
- `/communities`
- `/gbp-posts`
- `/intelligence-office`
- `/site-content`
- `/tracker/*`
- `/admin/intelligence`
- `/admin/users`
- login and verification flows

Audit judgment:

- this is now a major capability area, not an experiment
- the repo contains a real transition from script-first reporting toward a governed product platform

### 5.6 Intelligence Office / Content Operations / Site Governance

Current capability cluster spans:

- Intelligence Office
- Content Office
- Site Content Creator
- VACS
- Specs integration planning
- content governance docs and contracts

Evidence in repo:

- [INTELLIGENCE_OFFICE_MODEL.md](/Users/mark/Property_Analytics/docs/INTELLIGENCE_OFFICE_MODEL.md)
- [SITE_CONTENT_CREATOR_MODEL.md](/Users/mark/Property_Analytics/docs/SITE_CONTENT_CREATOR_MODEL.md)
- [CONTENT_OPERATIONS_MODEL.md](/Users/mark/Property_Analytics/docs/CONTENT_OPERATIONS_MODEL.md)
- [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md)
- web surfaces for `/intelligence-office` and `/site-content`
- web surfaces for `/content-office` and `/gbp-posts`
- API routes for `admin-intelligence`, `admin-site-content`, and `vacs`
- API routes and workflow tables for governed GBP source snapshots, policies, drafts, reviews, and publications
- `data/Intelligence/` as the document/evidence base

Capabilities present or partly present:

- governed directives
- approved claims and source-backed guidance
- structured claims + evidence registry with claim-evidence linking and brief readiness scoring
- migration tooling from legacy `approved_points` into structured claims
- content/search governance overlays
- governed content distribution coordination, starting with GBP Posts and extending later into social/email/video/community lanes through the same approval/proof pattern
- site copy inventory and rewrite workspace concepts
- property-aware content generation direction
- Captain assessment inputs surfaced as a first-class brief signal in Site Content Creator
- Site Content Creator is now moving from a diagnostics-first crawl console toward a page-mock editing workbench: property selection, a single page chooser instead of a page-board gallery, recognizable section canvases, CTA-aware mock blocks, and deferred Specs/assessment detail after section selection
- future shared contracts between content systems

Audit judgment:

- this is strategically important and easy to under-credit because some of it is still documentation- or route-level
- this area should be treated as a real capability program with partial implementation, not as “just docs”
- VACS current-state reporting should be explicit rather than aspirational:
  - VACS is a real platform system
  - the VACS API is implemented and protected under Cloudflare Zero Trust
  - The Pond now includes a governed `/vacs` bridge surface so VACS is discoverable in the toolbox without pretending the API-first lane is already a full human-first app
  - the canonical VACS route now expects Access service-token auth without VACS shared-token fallback, so its machine boundary is materially cleaner than earlier transitional drafts
  - the architecture defines `vacs.venterradev.com` as the intended standalone product surface
  - the repository does not yet prove that separate frontend host is deployed
- Content Office current-state reporting should remain grounded:
  - GBP Posts is the active working lane
  - GBP Posts now accepts Captain runtime context into its source snapshots and can create a Captain-led deterministic draft candidate when active watch/action guidance exists
  - GBP Posts now records manual posting proof and posting failures in `gbp_post_publications`, closing the first human-in-the-loop loop from Captain/Data Pond context to draft, approval, manual posting, and proof
  - Content Office and GBP Posts now expose Suggested GBP Posts from Captain/Data Pond signals, giving curators a proactive queue before draft generation instead of requiring a blank-form start
  - social, email, TikTok/Reels, Yelp, Reddit, and similar channels are roadmap/draft-handoff lanes, not active auto-publish integrations
  - future expansion should reuse the GBP pattern of source snapshot, policy, draft, review, publication proof, and performance learning instead of creating disconnected posting tools

### 5.7 Pilot Monitoring and CWV Program

Large pilot capability area:

- `pilot_control_cwv/`
- `pilot_roundup/`
- `apps/pilot-tracker-standalone/`
- `apps/web/src/app/tracker/*`

Capabilities present:

- pilot vs control PSI collection
- pilot vs control GTMetrix collection
- pilot/control CWV report generation and emailing
- pilot KPI tracker data packaging and visualization
- dashboard snapshot export
- BI snapshot ingestion and normalization
- missing metric audits
- homepage evidence collection
- diagnostic package generation
- diagnostic email previews
- comparator audits
- daily roundup generation
- standalone pilot tracker site
- mirrored tracker inside main web app

Representative entrypoints:

- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/run_pilot_control_cwv_daily.py`
- `/Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py`
- `/Users/mark/Property_Analytics/apps/pilot-tracker-standalone/README.md`

Audit judgment:

- this is a major sub-platform in its own right
- it includes data collection, exports, dashboards, diagnostics, and communication layers
- it is one of the easiest places to forget how much has already been built

### 5.8 Cloudflare Cache Observability and Rollout

Current capabilities present:

- daily Cloudflare edge delivery analytics source-fact collection for configured zones/hostnames
- daily Cloudflare cache audit
- GraphQL analytics query support
- HTML/CSV/JSON/Markdown artifact generation
- full-page cache rollout tooling
- cache purge/auth utilities
- workday runbooks and rollout plan docs

Primary files:

- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
- `/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py`
- `/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py`
- `/Users/mark/Property_Analytics/ops/cloudflare/`
- [CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md)
- [CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md)

Audit judgment:

- this is now an operational capability, not just an investigation

### 5.8.1 Edge Experimentation System

Planning artifact:

- [EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02.md)
- [EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SOURCE_CONTRACT_2026-05-02.md)
- [EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_SCHEMA_PLAN_2026-05-02.md)
- [EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md](/Users/mark/Property_Analytics/docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md)
- [EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md](/Users/mark/Property_Analytics/docs/EDGE_EXPERIMENTATION_WORKER_DRY_RUN_CONTRACT_2026-05-02.md)

Planned role:

- Data Pond-governed control plane for small property-site experiments.
- Cloudflare Worker execution for approved edge rewrites.
- Zaraz event routing into GA4 and Heap.
- Data Pond exposure, decision, guardrail, and learning ledgers.
- EVS preflight and post-launch proof for selector health, rendering, CTA behavior, and device coverage.
- Watchtower visibility for active experiment health and rollback posture.
- First non-mutating implementation slice now exists and is deployed at `/experiments` and `/v1/experiments`, with migrations, shared schemas, admin-only draft creation, readiness gates, execution lock, and seeded homepage CTA component contracts. Experiment Lab now reads Specs plus Site Content as the human-facing eligibility source, groups opportunities by Header, Mobile Menu, Pages, and Footer, expands Specs-defined nav/header/footer/hero targets plus recognized Site Content CTA labels into separate testable items, filters by intent, orders page items by page order and captured live section order, includes a collapsible Planning Overview for the Experience Map and repeated journey patterns, renders each surface group as an accordion, and keeps card-level Location, Readiness, Ideas, and Workflow details behind accordions. It can promote matched/partial Site Content CTA targets through `POST /v1/experiments/component-contracts/site-content` and Specs-derived targets through `POST /v1/experiments/component-contracts/specs`, records preflight request/checklists through `POST /v1/experiments/:experimentId/preflight`, and generates preview-only Worker dry-run configs through `POST /v1/experiments/:experimentId/dry-run`. Remote D1 has the Edge Experimentation table family and the deployed API Worker version is `8337d640-6a3b-4d4c-9bf0-6b3ec0037b41`.

Audit judgment:

- this should extend Data Pond, Site Content Creator, EVS, Cloudflare Ops, and Data Collection rather than becoming a standalone A/B testing product
- implementation should begin with the source contract, schema, Experiment Lab operations UI, Worker dry-run, EVS proof, and a single-property homepage pilot before any visual experiment builder

### 5.9 Experience Validation Service (EVS)

Current EVS system areas:

- `evs/`
- `apps/api/src/evs/`
- `apps/api/src/routes/evs.ts`
- `packages/shared/src/evs-*`
- `.github/workflows/evs-browserstack-experiential.yml`
- `ops/browserstack/`

Capabilities present:

- pilot property registry for experiential testing
- BrowserStack-backed validation model
- profile-based test definitions
- API request intake and persistence design
- result normalization
- reusable evaluation-set, batch, source-truth, and row-level finding persistence
- separate dormant lead-attribution E2E profile for advertiser URL, phone-swap, recipient-email, and governed synthetic-form proof
- saved ad-hoc legacy employee-photo audit for `#meet-the-team` silhouette/default-placeholder detection
- weekly/manual/post-deploy trigger model
- staging-first execution pattern

Audit judgment:

- EVS is a real platform capability with a clear shape, even if full orchestration maturity is still in progress
- it belongs in planning alongside monitoring and reporting, not in a side note
- it now has a first-class governed Pond bridge, which is the right inclusion model while execution remains specialized
- request lifecycle maturity has improved: EVS can now persist request intent, expose execution plans, record external orchestrator handoff, and ingest normalized results without pretending API-dispatch is already live
- result persistence maturity has improved: EVS can now represent a reusable QA evaluation set separately from a specific launch batch, then store each target, run, assertion, source-truth artifact, owner lane, and evidence reference in queryable D1 tables
- lead attribution is separated from ordinary functionality QA, which keeps no-submit audits clean while still allowing a governed synthetic-lead proof path when the team approves submission policy
- the legacy employee-photo audit belongs inside EVS/BrowserStack rather than a parallel scraper because it depends on rendered staff sections, BrowserStack evidence, and governed property identity
- the Pond EVS surface is now a real operator workspace rather than a static posture page: operators can launch governed requests, review lifecycle state, and record external orchestration handoff inside the main platform

### 5.10 Spotlight Properties Program

Area:

- `Spotlight_Properties_Report/`

Capabilities present:

- weekly spotlight reporting from canonical DB
- monthly property rotation config
- executive summary emailing
- property registry-safe name resolution
- GSC and SEMrush specialty reporting
- single-property reports
- GBP access and exploration tooling
- large archive of prior collector and export patterns

Audit judgment:

- Spotlight is both an active product and a deep archive of reusable analytics/reporting logic

### 5.11 Focus Report

Area:

- `focus_report/`

Capabilities present:

- curated executive status board for focus properties
- deterministic red/yellow/green property statusing
- weekly HTML email workflow
- hotlist email support
- comparison/showcase generator

Audit judgment:

- compact but distinct reporting product
- useful because it solves a different audience problem than Spotlight or Portfolio Pulse

### 5.12 Paid Media and Marketing Operations

Capabilities present across repo:

- paid media workbook generation
- Google Ads ingestion and D1 migration support
- campaign analysis scripts
- asset editor and URL lookup generation
- ad color update and migration planning docs
- marketing and leasing metrics app surfaces

Primary areas:

- `paid_media_workbook/`
- `Portfolio_Dashboard/scripts/collect_google_ads_data.py`
- `apps/api/src/routes/marketing*.ts`
- `apps/web/src/app/marketing/`
- `apps/web/src/components/metrics/`

Audit judgment:

- paid media capability is meaningful and easy to overlook because it is spread across workbook, dashboard, API, and planning docs

### 5.13 Resi / Comparative Analysis / Diagnostics

Capabilities present:

- Resi vs portfolio comparison engine
- resi performance diagnostics
- legacy experience comparisons
- exploratory briefs and matched-pair analysis

Primary areas:

- `resi_phase2_CORRECTED.py`
- `generate_resi_comparison_report.py`
- `resi_performance_diagnostic/`
- `resi_vs_legacy_comparison/`
- `resi_vs_legacy_experience/`

Audit judgment:

- this is a strong analytical specialty area even if it is not part of the main app narrative
- 2026-05-29 Resi live-fire edge diagnostics now include measured rejection of jQuery Migrate removal on `pilot.venterradev.com`: Worker version `02fa421f-1759-465b-9c0b-6961ccbd768e` removed only `/wp-includes/js/jquery/jquery-migrate.min.js` from `/` and `/apartments/`, Playwright smoke passed, but authenticated PSI medians regressed apartments desktop versus the kept SightMap lazy-load state (`99 -> 65`, TBT `60ms -> 1428ms`), so Worker version `ff0eee24-3bb5-4f4d-8210-16b3e40bdbec` restored jQuery Migrate while leaving SightMap lazy-load live.
- 2026-05-29 script-cost profiling and Resi pixel idle-load testing showed YOOtheme/UIkit as the largest actionable script CPU bucket. Broad and mobile-`/apartments/`-scoped Resi pixel idle-load tests were functionally safe but not clean PSI wins, so Worker version `1f0f3a89-15c4-4037-b8ed-34e2a192a5fc` restored the direct pixel script while preserving the kept SightMap lazy-load rewrite.

### 5.14 Site Audit and Harmonization

Capabilities present:

- generic portfolio site audit generation
- site crawler and checks framework
- pilot site harmonization and evidence docs
- GSC inspection exports
- section/page inventory direction

Primary areas:

- `/Users/mark/Property_Analytics/scripts/generate_portfolio_site_audit.py`
- `/Users/mark/Property_Analytics/scripts/site_audit/`
- [PILOT_SITE_CONTRACT_HARMONIZATION.md](/Users/mark/Property_Analytics/docs/PILOT_SITE_CONTRACT_HARMONIZATION.md)
- `/Users/mark/Property_Analytics/outputs/pilot_live_gsc_url_inspection_2026-04-08.json`

Audit judgment:

- this capability sits between reporting, governance, and content operations
- it should likely be grouped formally under Site Content Creator / Specs-connected work

### 5.15 Ad Hoc and Specialty Analyses

Examples present in repo:

- quiet building discovery and deep dive
- listing consistency tests
- guest card correlation outputs
- GSC month-over-month and weekly organic new users exports
- SEM/SEO T60 audits
- portfolio PSI PIB-style reports
- executive and leadership assessments

Primary areas:

- `AdHoc_Reports/`
- `reports/adhoc/`
- `scripts/audit_sem_seo_t60.py`
- `scripts/generate_gsc_mom_pib_report.py`
- `scripts/generate_pilot_organic_new_users_wow_report.py`

Audit judgment:

- these are not noise
- they are evidence of reusable analysis patterns and stakeholder-specific product ideas

### 5.16 Spec-Only or Planning-Only Programs

Important areas that are present but not yet full production systems:

- `Venterra_AI_Content_Suite/`
- major portions of the contract bundle docs under `docs/contracts/`
- some phase-1 platform architecture and enablement work

Audit judgment:

- these still matter because they encode intended future capabilities and already capture design work we do not want to redo

## 6. Status Model

### 6.1 Clearly Active / Canonical

- master DB + registry
- `Data_Collection/`
- canonical PIB pipeline
- Spotlight DB-based workflow
- major report generators at repo root
- Cloudflare cache audit
- main app/API platform in `apps/api` and `apps/web`

### 6.2 Active but Specialized

- pilot CWV / KPI / roundup systems
- EVS / BrowserStack validation
- Focus Report
- paid media workbook
- Resi comparison and diagnostics
- site audit workflows

### 6.3 Legacy but Valuable

- `Portfolio_Monitoring/`
- `Portfolio_Dashboard/`
- older collectors inside `Spotlight_Properties_Report/Archive/`
- PIB historical variants and templates

### 6.4 Spec / Planning / Early Product

- `Venterra_AI_Content_Suite/`
- some content operations and phase-1 contract systems
- some Intelligence Office / Site Content / VACS work where documentation maturity currently exceeds implementation maturity

## 7. Where We Are Duplicated or Fragmented

The repo shows repeated capability families in multiple generations.

Most obvious overlap zones:

- data collection logic across `Data_Collection/`, `Portfolio_Monitoring/`, and older Spotlight code
- reporting and email rendering patterns across PIB, health reports, snapshots, roundups, and specialty audits
- pilot tracker logic duplicated between `apps/web` and `apps/pilot-tracker-standalone`
- app-platform narrative split between older script/report systems and newer Data Pond/API/web surfaces
- content/governance concepts described in several docs but only partly unified in product code
- paid media logic spread across workbook, dashboard scripts, and app routes

This is likely why capabilities get forgotten and then rebuilt.

## 8. What We Definitely Do Not Want To Forget

High-value capabilities that are easy to undercount:

- Cloudflare cache observability and rollout tooling
- Delta Pearland APO case-study baseline, using the existing Cloudflare audit and rollout tooling rather than a parallel optimization path
- EVS / BrowserStack experiential validation
- pilot KPI tracker and diagnostic package generation
- site audit / harmonization groundwork
- Intelligence Office and Site Content Creator foundation work
- paid media workbook and Google Ads utilities
- Resi comparison and diagnostic frameworks
- Focus Report as a distinct executive reporting product
- Spotlight archive as a reusable analytics pattern library

## 9. Planning Recommendations

### Recommendation 1: Adopt a Canonical Capability Register

Create one maintained register with columns like:

- capability name
- canonical owner
- status
- primary path
- entrypoint
- data inputs
- outputs
- duplicate/related systems
- keep / consolidate / retire recommendation

This audit can be the seed document for that register.

### Recommendation 2: Separate “Active Canonical” From “Legacy Reusable”

Do not flatten everything into one bucket.

We should explicitly label:

- canonical
- active specialized
- legacy but reusable
- archived / reference only
- planning only

### Recommendation 3: Consolidate Around Domains, Not Historical Directories

Suggested planning buckets:

- Truth and Collection
- Reporting and Communications
- App Platform and Data Pond
- Content Operations and Governance
- Pilot Monitoring
- Experience Validation
- Marketing / Paid Media
- Specialty Diagnostics

### Recommendation 4: Build a “Before We Build” Checklist

For future work, require one quick check:

- does this already exist in some form
- is there a canonical owner already
- is there a reusable report, collector, route, or artifact pattern
- are we extending a real system or starting a parallel one

## 10. Best Current Companion Docs

Use this audit together with:

- [PLATFORM_SYSTEM_CATALOG.md](/Users/mark/Property_Analytics/docs/PLATFORM_SYSTEM_CATALOG.md)
- [PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md](/Users/mark/Property_Analytics/docs/PROPERTY_OPERATIONS_PLATFORM_ARCHITECTURE.md)
- [CAPABILITIES_INVENTORY_2026-01-23.md](/Users/mark/Property_Analytics/CAPABILITIES_INVENTORY_2026-01-23.md)
- [ATLAS_WORKING_MEMORY.md](/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md)
- [docs/README.md](/Users/mark/Property_Analytics/docs/README.md)

## 11. Bottom Line

The repo already contains a substantial operating platform.

The real opportunity is not inventing more from scratch.

The opportunity is:

- remembering what exists
- naming canonical owners
- consolidating overlaps
- promoting hidden strengths into the main system model

That should be the planning lens for the next phase.

Additional current-state note:

- The active Data Pond web and API layers now carry a shared offering-permissions foundation, with visibility and named action rights separated for canonical offerings. The web catalog lives in `/Users/mark/Property_Analytics/apps/web/src/lib/permissions.ts`, the API-side action enforcement lives in `/Users/mark/Property_Analytics/apps/api/src/lib/permissions.ts`, and EVS/GBP Posts/Content Office are the first lanes using named capability actions instead of only generic editor/admin route gates.
- That permissions model now also governs the steward-owned surfaces end to end: Site Content, Intelligence Office, Admin, and Control Plane use the same offering vocabulary for page visibility, route enforcement, and restricted-surface UX instead of a mix of hidden navigation, blanket admin middleware, and late 403 responses.
- The landing and Dock surfaces are now beginning to express that same model visually, so role differences are not only enforced in the background; Observers, Curators, and Stewards now get different framing and recommended motion through the Pond’s primary entry surfaces.
- Watchtower and the curator-heavy operator lanes are now moving in the same direction, with role-specific posture framing and direct-entry restricted states replacing the previous pattern of “hidden in nav but abrupt if opened directly.”
- the control plane now also carries an explicit enterprise-readiness layer sourced from:
  - `/Users/mark/Property_Analytics/config/enterprise_gap_register.json`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_READINESS_AUDIT_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/ENTERPRISE_GAP_REGISTER_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/NEXT_90_DAY_PLATFORM_PLAN_2026-04-18.md`
- `/system` can now show:
  - enterprise readiness summary
  - maturity by domain
  - named priority workstreams
  - next-90-day sequence
- that matters because the platform is now self-aware not only about inventory, trust posture, and migration debt, but also about the remaining enterprise-hardening program itself
- the first active consolidation wave has now also begun in the repo narrative itself:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/README.md` now declares the directory `Legacy-Reusable`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_MONITORING_CONSOLIDATION_MAP_2026-04-18.md` defines the migration path from Portfolio_Monitoring into Data Collection, Watchtower, and Dock
  - `/Users/mark/Property_Analytics/README.md` now points issue remediation toward canonical Data Collection entrypoints before falling back to legacy Portfolio_Monitoring repair tools
- that is an important enterprise step because it reduces accidental ownership in the repo’s own operator guidance, not just in planning docs
- the same consolidation treatment now also applies to `Portfolio_Dashboard`:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/README.md` now declares it `Legacy-Reusable`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_DASHBOARD_CONSOLIDATION_MAP_2026-04-18.md` defines the migration path into Dock, Analysis, Watchtower, and the main app shell
- that matters because the enterprise problem is not only duplicate logic; it is also duplicate entry surfaces and duplicate product ownership signals
- the briefing family is now also formally organized:
  - `/Users/mark/Property_Analytics/docs/BRIEFING_FAMILY_ARCHITECTURE_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/REPORT_FAMILY_MAP_2026-04-18.md`
- the governed enterprise posture is now:
  - PIB = protected canonical brief engine
  - POP Brief = structured operations performance brief system
  - Spotlight = specialized rotating executive-attention report
- that matters because the repo no longer has to infer the relationship between these systems from scattered context; the family model is now explicit and compatible with PIB guardrails
- the POP Brief Pond implementation is now more operationally real too:
  - weekly metrics import in `/Users/mark/Property_Analytics/apps/api/src/routes/metrics.ts` now accepts both pasted TSV and uploaded CSV/TSV against the documented contract instead of leaving the Pond UI on a scaffold/API mismatch
  - uploaded weekly-metric source files are now written to the `POP_BRIEF_UPLOADS` R2 bucket during import
  - `/Users/mark/Property_Analytics/apps/api/src/routes/exports.ts` can now create server-side backup artifacts and return the object key, which makes the backup lane more than a browser-only CSV fan-out
- release discipline is now also being normalized into the control plane:
  - `/Users/mark/Property_Analytics/config/release_governance.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_GOVERNANCE_STANDARD_2026-04-18.md`
  - `/Users/mark/Property_Analytics/docs/RELEASE_READINESS_CHECKLIST_2026-04-18.md`
- `/system` now carries:
  - canonical release path
  - release gates
  - workstream release lanes
  - release anti-patterns
- that matters because enterprise maturity here depends as much on promotion discipline as on system design
- Watchtower now also carries a formal service-operations layer sourced from:
  - `/Users/mark/Property_Analytics/config/service_operations_manifest.json`
  - `/Users/mark/Property_Analytics/docs/SERVICE_OPERATIONS_MODEL_2026-04-18.md`
- that layer makes service ownership, runtime, deployment target, release lane, trust boundary, runbook, and live operating pressure visible inside the platform instead of leaving them split across docs and operator memory
- Watchtower now also carries a deployment provenance and drift layer sourced from:
  - `/Users/mark/Property_Analytics/config/deployment_provenance_manifest.json`
  - `/Users/mark/Property_Analytics/docs/DEPLOYMENT_PROVENANCE_MODEL_2026-04-18.md`
- that layer compares:
  - current browser host
  - configured API base
  - observed API runtime host
  - current Access runtime policy
  against the canonical environment model so release and environment drift become visible in the control plane
- Watchtower now also carries a release pedigree layer sourced from:
  - `/Users/mark/Property_Analytics/config/release_provenance.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_MODEL_2026-04-18.md`
- that layer makes the deployed slice itself visible:
  - source branch
  - baseline commit
  - source mode
  - runtime identifiers
  - deploy URLs
- that matters because enterprise release maturity depends not only on “what should be deployed” but on “what actually is deployed and how it got there”
- the release pedigree model now also has a canonical operator bridge:
  - `/Users/mark/Property_Analytics/scripts/update_release_provenance.py`
  - `/Users/mark/Property_Analytics/docs/RELEASE_PROVENANCE_STAMPING_RUNBOOK_2026-04-18.md`
- that matters because the current platform is still between ad hoc operator-led deploys and fully issued CI provenance; this bridge reduces stale pedigree drift immediately while preserving the path toward true automation
- the platform now also has a generated release-reconcile snapshot:
  - `/Users/mark/Property_Analytics/scripts/generate_release_reconcile_snapshot.py`
  - `/Users/mark/Property_Analytics/config/release_reconcile_snapshot.json`
  - `/Users/mark/Property_Analytics/docs/RELEASE_RECONCILE_SNAPSHOT_MODEL_2026-04-18.md`
- that matters because the control plane can now quantify the dirty-tree split and show the first clean release-shaped slice directly, instead of treating release reconciliation as only a prose planning concern
- Site Content Creator has continued moving away from an audit-console presentation and toward a real content workbench:
  - page selection is being reduced to simple property/page controls
  - the selected page is being treated as a recognizable mocked page canvas
  - content editing is being centered on current copy vs new copy
  - specs, assessment, and governance detail are being pushed into secondary disclosure instead of the default scene
- this matters because the system’s success here depends on human editorial usability, not on surfacing every available metadata field to the operator

## Addendum: 2026-04-22 PSI Audit Correction

- The PSI / PageSpeed lane had been overstating health.
- Two distinct failure modes existed:
  - full missing dates when the master daily collector failed before reaching PSI
  - false `completed` PSI runs when the PSI collector only partially collected the portfolio
- Canonical corrections now in place:
  - `/Users/mark/Property_Analytics/Portfolio_Dashboard/scripts/collect_daily_psi.py`
    - now derives `completed` / `partial` / `blocked` from actual portfolio coverage
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
    - now reads the real same-day PSI run status after the subprocess returns and queues same-day PSI follow-up when needed
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
    - now treats PSI as retry-eligible advisory source work for same-morning recovery
- Historical `data_collections` PSI rows with incomplete coverage were also reconciled from `completed` to `partial` so live reporting aligns with the corrected operating model.
- Historical backfill policy for PSI is now explicit:
  - missing historical PSI dates remain authoritative gaps unless we possess dated raw PSI snapshots or cached payloads for those dates
  - rerunning the live PSI collector with an old `--date` is not accepted as a backfill because it produces current PSI measurements mislabeled as historical data
  - the enterprise-safe control is prevention plus transparent gap reporting, not fabricated history

## Addendum: 2026-04-22 POP Brief Pond canonical analysis correction

- The POP Brief Pond lane had a real parity problem even after import and backup were restored:
  - the visible `/analysis` page was still composing the brief from `t7_metrics`, `t30_metrics`, and `marketing_data`
  - that meant the operator-facing POP Brief was not actually driven by the documented POP Brief v1 contract centered on `weekly_metrics`, `marketing_weekly`, and `GET /v1/analysis`
- Canonical correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes a typed `/v1/analysis` client
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now renders the Pond POP Brief from the canonical analysis payload instead of the sidecar models
  - the current visible brief now shows:
    - T7/T30 community vs portfolio comparisons from `weekly_metrics`
    - marketing weekly leads / CPL / spend / notes / mention inputs from `marketing_weekly`
    - canonical metric notes carried on the weekly metric rows
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/analysis-route.test.ts`

## Addendum: 2026-04-22 POP Brief marketing_weekly workflow correction

- The next major parity gap after the analysis correction was the marketing operator surface:
  - the backend already had canonical `marketing_weekly` and `scan-mentions` routes
  - the Pond UI was still editing the separate `marketing_data` model, which meant the canonical marketing workflow existed in code but not in the actual product surface
- Canonical correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes typed `marketing_weekly` and mention-scan helpers
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now edits the canonical `marketing_weekly` record for the selected community and Friday week
  - the same page can now execute the canonical mention scan and report processed / sent / suppressed results to the operator
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-route.test.ts`
- Residual POP Brief parity gaps still open after this correction:
  - communities management is still only partially surfaced in the Pond
  - the admin onboarding model still differs from the invite-based v1 POP Brief contract

## Addendum: 2026-04-22 Base44 Spotlight Website & SEO ingest compatibility restored

- Operator review surfaced an important parity distinction:
  - the real Base44 app accepts a Spotlight Website & SEO CSV export shape with columns like `property_name`, `property_url`, `date`, `t7_engaged_sessions_delta`, `website_notes`, and `seo_notes`
  - the Pond had retained the compatible API route but had lost the visible UI lane after the Marketing page was redirected toward canonical `marketing_weekly`
- Compatibility correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` again exposes a Base44-compatible bulk Website & SEO import panel
  - that panel parses the real Base44 CSV shape, normalizes dates such as `04/24/2026` to `2026-04-24`, previews rows, and submits to `/v1/marketing-data/import/website-seo`
- This does not eliminate the deeper model split between `marketing_data` and `marketing_weekly`, but it does restore an operator-visible ingest path that matches the currently live Base44 workflow for this file family.

## Addendum: 2026-04-22 Communities writable surface restored

- Another previously confirmed parity miss was the communities operator surface:
  - the API already supported create / patch / soft-delete
  - the Pond `/communities` page remained a read-only list
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` now provides create, edit, and soft-delete controls
  - `/Users/mark/Property_Analytics/apps/web/src/lib/api.ts` now exposes the corresponding mutations
- Authentication remains an intentional deviation from the original app and stays on Cloudflare Zero Trust by operator direction.
- Residual major parity gap still open after this correction:
  - admin onboarding still differs from the original invite-based POP Brief contract

## Addendum: 2026-04-22 POP Brief landing navigation aligned to Base44 operator flow

- Operator screenshots showed one more important usability gap:
  - even after the main business workflows were repaired, the Pond `/analysis` page still did not expose the recognizable Base44 left-column workflow links from the main brief surface
  - that made the rebuilt app harder to navigate like the live product even when the underlying routes existed
- Navigation correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now renders a POP Brief navigation board with direct links to the mounted equivalents of the Base44 rail:
    - Communities
    - T7 Metrics
    - T30 Metrics
    - Marketing Data
    - Analysis
    - Backup & Export
  - the Base44-only slots `Call Notes` and `Profile` are also shown as explicit placeholders rather than being silently omitted
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now presents the operator surface as `Marketing Data`, which better matches the live app screenshots and makes the Base44-style Website & SEO import panel easier to locate
- This does not create new business logic, but it materially improves operator parity by making the Pond’s primary POP Brief entry screen behave more like the live navigation model.

## Addendum: 2026-04-22 PIB dashboard corrected as the real parity front door

- Operator feedback immediately exposed a follow-on mistake:
  - the first navigation correction was real, but it landed on `/analysis`
  - the actual front door the operator perceives as the PIB Brief page is `/pib`
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/pib/page.tsx` now contains the Base44-style workflow board directly on the PIB dashboard
  - the board exposes the mounted routes for Communities, T7 Metrics, T30 Metrics, Marketing Data, Analysis, and Backup & Export
  - it also keeps `Call Notes` and `Profile` visibly reserved as placeholders so the full rail is represented even before those routes are implemented
- This closes the “nothing changed” usability miss by putting the parity navigation on the screen the operator actually uses as the main PIB surface.

## Addendum: 2026-04-22 Website & SEO importer alias gap corrected

- Live operator testing of the restored Base44 Website & SEO CSV flow revealed one more parity issue:
  - the Pond importer accepted the correct file format
  - but it still depended on exact community-name matches, which caused valid Base44 shorthand labels like `1604`, `Oakleaf`, and `Whitney` to fail
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/api/src/routes/marketing-data.ts` now resolves the import target using canonical names plus alternate lookup keys already present in the community record shape
  - it also includes explicit shorthand alias support for the known Base44 labels above
- Regression protection now exists in:
  - `/Users/mark/Property_Analytics/apps/api/test/platform/marketing-data-import.test.ts`

## Addendum: 2026-04-22 Marketing surface visual hierarchy corrected

- After the import parity work landed, operator testing revealed a separate usability failure:
  - the Marketing screen was technically functional
  - but the neutral, low-contrast UI made primary actions, editable fields, and passive informational panels hard to distinguish quickly
- Correction now in place:
  - shared button / input / textarea primitives have stronger visual affordances
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now uses section bands, stronger action bars, and clearer step framing so the import flow and save/scan actions stand out immediately
- This is a UX correction rather than a model or routing change, but it materially improves operator speed and reduces “what is clickable?” ambiguity on one of the highest-touch POP Brief screens.

## Addendum: 2026-04-22 POP Brief defaults aligned to the active Spotlight workflow

- Operator feedback surfaced a workflow mismatch on the main POP Brief landing surface:
  - the page opened with no date and no property selected
  - the property selector exposed the entire active community set instead of the current monthly Spotlight list the operator is actually working through
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now defaults to the upcoming Friday
  - the same page now scopes the selector to the active April 2026 Spotlight list and auto-selects the first Spotlight property in that ordered set
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/community-selector.tsx` can now receive a curated property list directly, which lets POP Brief preserve monthly Spotlight ordering instead of forcing a generic alphabetical sort
- This is still a workflow-default change rather than a functional-model change, but it materially reduces repeated operator setup clicks on the main POP Brief screen.

## Addendum: 2026-04-22 POP Brief header actions consolidated into navigation

- Operator review identified another source of page-top clutter:
  - the header mixed primary selectors with two one-off buttons that did not deserve equal visual weight on every visit
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` now uses a sticky header/control bar
  - the old `Export PDF` and `Update` buttons were removed from that top row
  - a single `Navigate` dropdown now exposes the main POP Brief route family and adjacent workflow destinations instead
- This is a navigation/control-surface cleanup, not a reporting-model change, but it makes the page top feel more like a stable operator console and less like a row of unrelated buttons.

## Addendum: 2026-04-22 POP Brief duplicate navigation board removed

- The sticky header cleanup surfaced a second-order UX issue right away:
  - the header now owned navigation cleanly
  - but the page still repeated that same route family in a large `POP Brief Navigation` card immediately below it
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/page.tsx` no longer renders the duplicate navigation board under the sticky header
  - the `Navigate` dropdown in the sticky header is now the single primary movement control for the POP Brief lane
- This is still a workflow/UX correction rather than a business-logic change, but it matters because the page now opens directly into the selected property brief instead of spending the first full viewport on repeated navigation furniture.

## Addendum: 2026-04-22 POP Brief date picker interaction tightened

- After the header cleanup, operator feedback exposed one more control-surface issue:
  - the calendar popover looked translucent against the content underneath
  - and it remained open after the Friday selection was already made
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/week-date-picker.tsx` now uses a controlled popover state so the picker closes immediately after selection
  - `/Users/mark/Property_Analytics/apps/web/src/components/ui/popover.tsx` now supports controlled open state and marks the trigger explicitly for more reliable outside-click behavior
  - the date-picker popover now renders on an opaque elevated white surface instead of feeling visually merged with the page below
- This is a small but important operator polish fix because the POP Brief header is now the primary daily control surface, so even minor friction there gets repeated constantly.

## Addendum: 2026-04-22 Communities page reordered to Spotlight-first

- Operator workflow feedback clarified that community creation is no longer the normal starting task on the Communities surface.
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/communities/page.tsx` no longer leads with an `Add Community` form
  - the page now opens with a `This Month's Spotlight Properties` section driven by the active monthly Spotlight set
  - the full governed inventory remains immediately below as `All Communities`, with edit/delete maintenance actions still available there
- This is a workflow and information-hierarchy correction rather than a model change, but it matters because the page now reflects how operators actually use the surface: review the active Spotlight set first, then drop into exhaustive maintenance only when necessary.

## Addendum: 2026-04-22 Marketing page brought into POP Brief header/default pattern

- Operator review identified that the Marketing surface was still lagging behind the main POP Brief lane in two ways:
  - it did not yet share the same upcoming-Friday and Spotlight-first defaults
  - the legacy Base44 CSV import still dominated the first screen even though it is becoming a transition-only bridge
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` now defaults to the upcoming Friday and scopes the selector to the active Spotlight set, auto-selecting the first Spotlight property
  - the page now uses the same sticky header/control treatment as the rest of the POP Brief lane
  - the Base44 Website & SEO CSV import is now hidden behind a collapsed legacy-import accordion instead of staying open as the primary page surface
- This keeps the current compatibility import available, but it makes canonical weekly marketing editing the default operator workflow and visually demotes the legacy bridge path ahead of future direct Data Pond ingest.

## Addendum: 2026-04-22 Marketing page restored to the sectioned Base44 editor shape

- A second operator check surfaced an important correction:
  - the simplified weekly-marketing surface was cleaner
  - but it was no longer the actual live Base44 page shape for Marketing
- Repo evidence confirmed that the imported Base44 marketing model is still fundamentally the seven-section `marketing_data` editor, backed by the preserved section schema in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0012_create_marketing_data.sql`
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/app/marketing/page.tsx` has been restored to the sectioned Base44-style editor
  - the newer sticky header treatment and Spotlight/upcoming-Friday defaults remain in place
  - the Website & SEO CSV importer remains available, but now as a secondary collapsed bridge utility rather than the page’s primary face
- This is a parity correction, not a new feature: it realigns the visible Marketing screen with the live app’s actual structure while keeping the cleaner page-top workflow defaults.

## Addendum: 2026-04-22 T7/T30 metrics pages brought into the shared POP Brief operator shell

- Operator review identified that the T7 and T30 metrics pages were still lagging behind the rest of the POP Brief lane in daily-use ergonomics:
  - they still opened as standalone pages without the newer sticky control-bar treatment
  - they did not default directly into the active Spotlight/upcoming-Friday working context
- Correction now in place:
  - `/Users/mark/Property_Analytics/apps/web/src/components/metrics/leasing-metrics-page.tsx` now drives both `/t7-metrics` and `/t30-metrics` with the same sticky header treatment already adopted by POP Brief and Marketing
  - the shared page defaults to the upcoming Friday
  - the shared community selector is now scoped to the active monthly Spotlight list and auto-selects the first Spotlight property on open
  - the header now also uses the same `Navigate` control family and no longer carries the leftover page-specific `Update` / `Clear Data` buttons
- This is a workflow-default correction rather than a model change, but it matters because it makes the import/edit screens open in the same ready-to-work context as the other daily POP Brief surfaces.

## Addendum: 2026-04-22 Base44 parity governance now explicit

- The remediation pass has now reached the stage where the remaining risk is less “obvious missing surface” and more “unproven equivalence.”
- To avoid overstating completion, the repo now carries:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_BASE44_PARITY_LEDGER_2026-04-22.md`
- That ledger explicitly separates:
  - matched business surfaces
  - intentional auth/user-management deviations
  - surfaces that appear intact but still need end-to-end proof
- This matters because the remaining work is now increasingly audit and verification shaped rather than pure reconstruction.

## Addendum: 2026-04-22 T7/T30 leasing metrics parity confirmed

- A likely-looking parity concern in the T7/T30 metrics lane turned out to be inherited Base44 behavior rather than Pond drift.
- The concern was that the Pond appears to query/store `type='portfolio'` rows as if they belong to the selected community.
- Source review confirmed this is how the imported Base44 model works:
  - the T7/T30 migrations require `community_id` on every row
  - the guest-card mirror script explicitly computes portfolio averages once and then writes duplicated `portfolio` rows per community
- That means the Pond’s T7/T30 metrics surfaces should be treated as parity-matched unless operator testing finds a behavioral mismatch not visible in code review.

## Addendum: 2026-04-23 Data Pond branding and POP Brief shell reconciled

- Operator review surfaced a release-shape problem rather than a fresh design problem:
  - the richer Data Pond landing/sidebar branding existed in the active local frontend files
  - the newer POP Brief header work had only been promoted partially
  - the resulting live app could therefore present mixed generations of the product shell at once
- The current intended frontend slice is now explicit:
  - `/Users/mark/Property_Analytics/apps/web/src/app/page.tsx` carries the richer Data Pond landing hero and featured-surface treatment
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/sidebar.tsx` carries the larger branded Data Pond sidebar with `By MarketingOps`
  - `/Users/mark/Property_Analytics/apps/web/src/components/shared/pop-brief-page-header.tsx` is the shared POP Brief shell used by Analysis, Marketing, and the shared T7/T30 page
  - that shell places the date and property selectors on one line and the `Navigate` control on a second right-aligned line
  - the Marketing section editor remains Base44-shaped, but its section blocks are now true accordions closed by default
- This matters because the current platform problem is not only feature parity; it is also making sure operators see one coherent shell and identity system instead of alternating between partial frontend states.

## Addendum: 2026-04-23 Editor role boundary tightened to POP Brief-only operations

- Operator direction clarified that the product-facing `editor` role should no longer act as a broad curator across the Data Pond.
- The current intended editor experience is now:
  - The Pond as the allowed front door
  - the POP Brief lane as the only active operational workspace
  - the rest of the platform visible in the sidebar for orientation but not available for actual navigation
- That boundary is now enforced in both the web and API permission layers rather than only by hiding links.
- This matters because a role model that only changes the sidebar but still leaves routes and write APIs reachable would not be a real operational permission model.

## Addendum: 2026-04-24 POP Brief grounding core foundation

- Operator direction shifted the POP Brief work from restored UI parity into a more durable property-brief / Captain's Log grounding problem.
- The repo now has an explicit grounding-core architecture:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_GROUNDING_CORE_2026-04-24.md`
- The architecture defines the source-authority hierarchy:
  - Data Pond is authoritative for internal operating facts
  - AptIQ/ApartmentIQ-style reports are advisory market/comps intelligence; Data Pond governs internal operating facts
  - live property-page snapshots are authoritative for public-page state at crawl time
  - Captain's Log stores governed memory and decisions rather than raw fact ownership
- The durable schema foundation now exists in both API and POP Brief D1 migration paths:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0024_create_property_brief_grounding_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/011_property_brief_grounding.sql`
- The shared contract layer now includes:
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-types.ts`
  - `/Users/mark/Property_Analytics/packages/shared/src/grounding-schemas.ts`
- This adds source documents, normalized claims, reconciliations, and artifact blocks as first-class concepts so future POP Brief outputs can render from reconciled claims instead of raw vendor prose.
- Importantly, this does not mutate locked PIB generation or rendering behavior; it strengthens the briefing-family substrate around POP Brief and Captain's Log.

## Addendum: 2026-04-24 Captain operating model and The Pointe pilot tasking

- The property-scoped Captain role is now explicit rather than implied by Captain's Log storage.
- The new operating model lives at:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
- The first pilot property tasking lives at:
  - `/Users/mark/Property_Analytics/reports/property_evaluation/the_pointe_bentonville_captain_tasking_2026-04-24.md`
- The Captain is responsible for source seeking, ingestion expectations, claim reconciliation, Captain's Log updates, watch-item continuity, and Supervisor-ready escalation.
- The Pointe Captain's first tasking focuses on:
  - A1 and B1 inventory pressure
  - concession leakage
  - applicant follow-up and cancellation reason tracking
  - AptIQ claim reconciliation against Data Pond
  - floorplan-specific messaging and action readiness
- This formalizes the intended path from report output to operating intelligence: Data Pond facts and advisory reports feed the grounding core; the Captain maintains property memory and action posture; Supervisor updates become the eventual decision/escalation product.

## Addendum: 2026-04-24 Property Evaluation Brief source-of-truth standard

- The The Pointe Bentonville evaluation report is now being formalized into a reusable property evaluation and resolution brief standard.
- The source-of-truth standard lives at:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_EVALUATION_BRIEF_SOURCE_OF_TRUTH_2026-04-24.md`
- The reusable Markdown template lives at:
  - `/Users/mark/Property_Analytics/reports/property_evaluation/templates/property_evaluation_resolution_brief_template.md`
- The standard defines:
  - source authority ladder
  - required evidence domains
  - required sections
  - source authority posture
  - action register
  - decision register
  - Captain's Log payload
  - publishability gate
- This makes the property evaluation brief a governed output family rather than a one-off synthesis artifact.

## Addendum: 2026-04-24 Unit-level concession feed included in property brief truth model

- The property evaluation truth model now recognizes unit-level pricing/specials from the ThirtyLines availability payload as an internal Data Pond fact source.
- This matters for The Pointe Bentonville because the 2026-04-24 `unit_availability.available_units_json` payload confirms broad `$3,000 off` public specials visibility across the returned available-apartment units.
- The remaining control task is now narrower and more useful:
  - public unit-level offer visibility can be read from Data Pond
  - booked concession dollars on signed leases should be rendered from the Pond lease/revenue feed
- The Captain and Property Evaluation Brief should therefore distinguish `offer visible on unit feed` from `concession cost booked on lease` instead of collapsing both into a generic missing-data item.

## Addendum: 2026-04-24 ThirtyLines ingestion hardened for Captain-ready unit truth

- ThirtyLines collection no longer only preserves unit detail inside a floorplan JSON blob.
- The collector now persists:
  - full raw feed payloads and feed QA counts in `thirtylines_feed_snapshots`
  - existing floorplan-level availability summaries in `unit_availability`
  - normalized daily unit snapshots in `unit_availability_units`
- This gives the Captain and Property Evaluation Brief a queryable source for unit-level rent, available date, floorplan, unit id, public specials message, and parsed advertised concession amount.
- The important authority boundary remains:
  - `unit_availability_units.pricing_and_specials_message` = active public offer visibility
  - booked concession dollars on signed leases = Pond lease/revenue feed metric to render into the brief

## Addendum: 2026-04-24 Property Evaluation Brief expanded to the full Pond operating chain

- Property Evaluation / Captain briefs should not stop at AptIQ plus leasing funnel and inventory.
- The intended report model now pulls together the full Pond chain:
  - GSC for search visibility and query intent
  - GA4 for sessions, channel engagement, and high-intent actions
  - PSI / PageSpeed for mobile/desktop conversion friction
  - Google Ads for paid spend, keywords, clicks, and conversion tracking, with freshness flags
  - GBP insights, reviews, and sentiment for local trust and objection themes
  - guest-card metrics for actual leasing demand
  - ThirtyLines floorplan/unit snapshots for inventory, offer visibility, and unit aging
  - PMS/leasing/revenue truth for occupancy, leases, cancellations, and booked concession dollars where available
- This makes the Captain's role a true operating-intelligence role: connect visibility, traffic quality, experience, paid/local demand, leasing action, revenue protection, and physical inventory into one action plan.

## Addendum: 2026-04-24 Property Evaluation Brief source-authority posture

- Operator feedback clarified that property briefs must read as authoritative operating narratives rather than uncertain prose.
- The reusable Property Evaluation Brief standard now separates:
  - source-of-record facts
  - public-state facts
  - advisory market intelligence
  - routing gaps
  - unresolved source conflicts
- This distinction matters because a Pond value that is not yet surfaced into the report is a composition/routing issue, not a reason to ask operators to re-confirm reality.
- The Pointe report, PIB-style email artifact, and Captain tasking now frame occupancy, leased percentage, lease count, cancellations, and booked concession dollars as Pond source-of-record metrics to render into the Captain brief when the feed is available.
- The standing authority rule is unchanged but sharper: AptIQ advises; Data Pond governs.

## Addendum: 2026-04-24 The Pointe Google Ads activity verified

- A targeted live Google Ads API check for The Pointe Bentonville confirmed that the property is mapped to customer `9089267423`.
- The 2026-03-20 to 2026-04-23 check window returned one campaign-day record on 2026-03-20 and no campaign activity after that date.
- The campaign `1185 Pointe Bentonville MKT PPC` was paused on 2026-03-20.
- The Pointe report family should therefore treat Google Ads as paused/no-activity after 2026-03-20, not as merely stale local data.

## Addendum: 2026-04-24 The Pointe Captain identity and PIB presentation standard

- The Pointe Bentonville's property Captain identity is now `Captain Benton`.
- The Property Evaluation Brief standard now carries PIB-family presentation rules:
  - visible property ID uses the property code, such as `AR4PB`
  - user-facing dates use `MM/DD/YYYY`
  - email artifacts use the Venterra / PIB header and KPI card language
  - unit references use operator-facing building plus apartment numbers rather than feed system ids
  - the guest-card KPI label is `Guest Cards`
- This keeps the Captain brief from reading like a technical extract while preserving the Pond as the evidence authority.

## Addendum: 2026-04-24 Captain's Log and Captain's Brief report set

- The naming rule is now explicit:
  - `Captain's Log` is durable property memory, decisions, watch items, evidence references, and follow-up state.
  - `Captain's Brief` is the polished outbound read generated from the log plus current Pond facts.
- The standard lives at:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
- The reusable template lives at:
  - `/Users/mark/Property_Analytics/reports/captains_log/templates/captains_log_entry_template.md`
- The first The Pointe / Captain Benton set now lives at:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captains_log_2026-04-24.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_captain_brief_email_2026-04-24.html`
- This creates a recurring report/email family around the Captain role without mutating locked PIB generation or rendering behavior.

## Addendum: 2026-04-24 Captain Benton shared memory and support agents

- The first Captain's Log concept entry is now represented as shared memory, not only a Markdown/email artifact.
- The local D1 memory substrate contains the The Pointe / Captain Benton seed:
  - governed memory entry `mem_ar4pb_captain_benton_20260424_001`
  - Captain identity binding `Captain Benton`
  - evidence references back to Captain Log, Property Evaluation Brief, Data Pond guest cards, unit feed, and Google Ads API recheck
  - property-brief source documents, grounded claims, reconciliations, and reusable `captain_log_update` artifact block
- A new `captain_support_agents` table defines property-scoped support agents that keep the Captain supplied with source truth.
- The first active support roster for The Pointe is:
  - Benton Source Scout
  - Benton Truth Reconciler
  - Benton Inventory Watch
  - Benton Funnel Watch
  - Benton Media Watch
  - Benton Supervisor Scribe
- The support agents are watchers and assemblers, not separate truth owners. Data Pond remains the governing internal source; AptIQ remains advisory.
- Remote D1 promotion was applied through the repo's Keeper-backed Wrangler runtime helper.
- Remote verification confirmed `Captain Benton` as the sole The Pointe Captain identity binding, six active `AR4PB` support agents, eight grounded property-brief claims, and five evidence refs for `mem_ar4pb_captain_benton_20260424_001`.

## Addendum: 2026-04-24 Captain runtime foundation

- The Captain's Log / Brief capability now has a Worker-side runtime foundation in the app API.
- New runtime tables:
  - `captain_agent_runs`
  - `captain_watch_items`
  - `captain_actions`
  - `captain_brief_runs`
- New API implementation paths:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/captain.ts`
- New API route family:
  - `/v1/captain/properties/:propertyId/status`
  - `/v1/captain/properties/:propertyId/run`
  - `/v1/captain/properties/:propertyId/brief`
- The API Worker now has cron triggers configured for daily and weekly Captain execution, with the support-agent roster read from D1.
- The runtime keeps raw collection ownership in Data Collection while the Worker consumes mirrored D1/R2 facts and writes operating memory, watch items, actions, and brief readiness.
- The runtime schema was applied to remote `pop-brief-db`.
- Production API Worker deployment completed:
  - Worker: `pop-brief-api`
  - URL: `https://pop-brief-api.mlaufhutte.workers.dev`
  - Version ID: `1c2633b7-0dad-44c5-b14b-05dfb63b3014`
  - schedules: `15 12 * * *` and `45 13 * * 1`
- Post-deploy verification confirmed the public health endpoint and the remote Captain runtime tables.

## Addendum: 2026-04-25 Captain Benton remote D1 reconciliation

- The first scheduled Captain Benton run on 2026-04-25 proved the Worker schedule was active, but it also exposed that the remote D1 source mirror did not yet include the AR4PB source-level tables needed by the Captain runtime.
- A narrow Captain source mirror now exists at:
  - `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py`
- Remote `pop-brief-db` was reconciled for The Pointe / `AR4PB` / `482958962` with Guest Cards, unit availability, GA4, compact GSC, Google Ads, PSI, and GBP source rows.
- The Captain runtime now handles the existing remote app-shaped `gsc_daily_metrics` table keyed by `community_id`, in addition to raw source-shaped GSC rows where those exist.
- Source Scout now treats a paused Google Ads campaign as `paused_no_current_activity` rather than a stale source-routing defect.
- The API Worker was redeployed through the Captain-runtime reconciliation as version `82eed1a9-3c68-459e-a491-b902dc9683ed`.
- Manual post-reconciliation run confirmed:
  - Source Scout succeeds with all expected sources present and no stale source warnings
  - Funnel Watch succeeds from Guest Card rows
  - Media Watch succeeds from GA4/GSC/Ads/PSI/GBP rows
  - Inventory Watch correctly remains warning because A1/B1 and 365+ day unit pressure is real operating content
  - Truth Reconciler correctly remains warning because one booked-concession claim is now a formal source conflict, not an unknown source-routing problem

## Addendum: 2026-04-25 first clean live Captain Brief run

- The stale watch/action rows created before the AR4PB source-table mirror was reconciled were closed in remote D1.
- The two prior `needs_review` claims were resolved into authoritative states:
  - Guest Card coverage is now `pond_verified`
  - booked concession dollars remain a formal `conflict` pending lease/revenue source routing
- A deployed Worker run of `benton_supervisor_scribe` succeeded as `captain_run_AR4PB_benton_supervisor_scribe_20260425202039_90a125a9`.
- The first clean live Captain Brief draft was created as `captain_brief_AR4PB_20260425202040_b9ac1686` for `2026-03-26` through `2026-04-25`.
- The current live brief posture now separates real operating pressure from resolved source-routing noise: A1/B1 aged inventory, four 365+ day units, and booked-concession source conflict remain open; missing Guest Card/unit-feed/source-freshness items do not.

## Addendum: 2026-04-25 Captain Brief read surface

- The Captain Brief now has a read model rather than only persisted rows.
- The API exposes `GET /v1/captain/properties/:propertyId/brief/latest`, which composes:
  - latest Captain Brief run
  - Captain identity and period
  - active watch/action state
  - resolved source-routing state
  - current source freshness/readiness
  - unit-level aged inventory detail from `unit_availability_units`
- The web app now has `/analysis/captain` as the first Captain Brief operating surface.
- The aged inventory read includes actual apartment numbers, floorplans, move-out dates, available dates, days unleased, rent, public specials text, and parsed advertised concession amount.
- Remote API verification confirmed the live route returns `Captain Benton`, clean source dates, 38 units at 30+ days, 33 at 60+ days, 25 at 90+ days, 17 at 180+ days, 4 at 365+ days, and actual aged unit numbers.
- `pop-brief-api` was redeployed as version `1aa6d6e7-7610-455d-9f6e-44b219532338`.

## Addendum: 2026-04-25 operating metrics source route

- The lease/revenue/booked-concession question was investigated against local Pond tables and the current BI/Measurement files in the shared `Guest_Card_Reports` drop.
- Current finding: the Pond has authoritative public concession visibility in the unit feed, but it does not yet have a populated source-of-record table for booked concession dollars on signed leases for AR4PB.
- Current BI workbooks `BI-Metrics-Run20260424.xlsx` and `BI-Metrics-Run20260423-NewFormat.xlsx` contain pilot conversion metrics, not The Pointe / AR4PB lease-revenue rows.
- A new source-of-record landing contract now exists:
  - `/Users/mark/Property_Analytics/docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md`
  - `/Users/mark/Property_Analytics/apps/api/scripts/operating_metrics_to_d1.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0028_create_property_operating_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/015_create_property_operating_metrics.sql`
- `property_operating_metrics` is designed to hold official occupancy, leased percentage, lease count, cancellations/denials, move-ins/move-outs, and booked concession dollars.
- The operating metrics importer now accepts CSV/XLSX/XLSM files, normalizes common operating-feed headers, writes local Pond rows, and can upsert those rows into remote D1.
- The Captain source-table mirror now includes `property_operating_metrics` when local rows exist, so official operating facts flow into Captain Brief reads without relying on AptIQ inferred values.
- Data Collection now has a wrapper at `/Users/mark/Property_Analytics/Data_Collection/utils/operating_metrics_ingest.py`, and the daily collector plus retry worker monitor the shared manual drop for operating-metrics files on the same cadence pattern as BI workbooks.
- Watchtower/advisory freshness recognizes `property_operating_metrics` as a same-day manual source backed by `property_operating_metrics.metric_date`.
- Missing official operating files are now escalated explicitly as `No official operating metrics file received for AR4PB.` with the recommended filename pattern `Property-Operating-Metrics-AR4PB-YYYYMMDD.csv`.
- The Captain Brief read model and `/analysis/captain` now expose an Operating Snapshot lane.
- Remote D1 migration was applied and `pop-brief-api` was redeployed as version `728fd38d-07fd-481f-a97a-acec4bb60ba8`.
- Live route verification confirms AR4PB currently reports `operatingSnapshot.status = missing_source` and points to `property_operating_metrics`, keeping the brief authoritative instead of conflating advertised concession eligibility with booked lease concession cost.

## Addendum: 2026-04-27 available unit interest BI source

- The Marketing BI `Available Units With Low Inquiries` / `Guest Cards Per Unit Type` export is now represented as an advisory BI source for Captain Brief work.
- Added:
  - `/Users/mark/Property_Analytics/docs/AVAILABLE_UNIT_INTEREST_SOURCE_CONTRACT_2026-04-27.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/available_unit_interest_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0029_create_available_unit_interest_metrics.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/016_create_available_unit_interest_metrics.sql`
- The current PDF export loaded 21 rows into `available_unit_interest_metrics`.
- The 2026-04-27 Pointe row maps to `AR4PB` and provides available units, vacant/notice split, T7/T30 guest-card volume per available unit, demand deltas, and prospect quote volume.
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors the AR4PB available-unit-interest row into remote D1 with Benton’s source packet.
- The adjacent Marketing BI lanes visible for future evaluation are T365D Move-ins with Mktg Source, Traffic Conversions, Property Cancel/Denial by Mktg Source, WOW Program Spending, SmartDesk 2.0, and Value Proposition Dashboard.

## Addendum: 2026-04-28 Marketing BI conversion diagnostics

- The Marketing BI `Property CancelDenial by Mktg Source` and `Traffic Conversions T7D-T90D` exports are now represented as advisory conversion diagnostics for Captain Brief work.
- Added:
  - `/Users/mark/Property_Analytics/docs/MARKETING_BI_CONVERSION_SOURCE_CONTRACT_2026-04-28.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_conversion_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/017_create_marketing_bi_conversion_sources.sql`
- The current cancel/denial PDF loaded 24 The Pointe rows into `marketing_cancel_denial_by_source`.
- The current traffic conversions PDF loaded one The Pointe row into `marketing_traffic_conversions`.
- The initial Benton read from these reports is that The Pointe has strong T30 guest-card YoY lift, while the Website and Google channels show important cancellation/denial friction, particularly `Abandoned` cancellations and `Failed Credit or Criminal` denials.
- `apps/api/scripts/captain_sources_to_d1.py` now mirrors both marketing conversion tables into remote D1 with Benton’s source packet.

## Addendum: 2026-04-28 property identity matrix

- A governed property identity matrix now exists at `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
- The matrix is built from the local canonical `properties` table, the official registry, and the app community seed, then validated by `/Users/mark/Property_Analytics/scripts/check_property_identity_matrix.py`.
- It formalizes the working rule that property code is the visible / Captain-facing id where available, while GA4 id, GSC URL, app community UUID, website URL, Encasa short name, GBP location id, company id, unit count, and report aliases remain attached to the same identity record.
- The first enforcement landed in the Marketing BI conversion and daily packet ingesters through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Validation confirmed The Pointe now resolves through one source as `AR4PB` / GA4 `482958962` / community id `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`, and current Marketing BI dry runs map all visible property rows without local hardcoded Pointe exceptions.

## Addendum: 2026-04-28 property identity governance requirement

- `AGENTS.md` now has a Property Identity Discipline section requiring source ingestion, Captain reads, report inputs, and property-scoped automations to use the governed matrix.
- Added `/Users/mark/Property_Analytics/scripts/check_property_identity_governance.sh` and its Python implementation to validate matrix health and required resolver usage.
- Expanded resolver usage to the Available Unit Interest parser, operating metrics importer/wrapper, and Captain source D1 mirror.
- `captain_sources_to_d1.py` now resolves `--property-key` into property code, GA4 id, and community id, which prevents the Captain mirror from carrying separate hardcoded ID defaults.
- `operating_metrics_to_d1.py` now resolves `--property-key` and matches rows against matrix aliases, allowing future operating files to use property code, name, short name, GA4 id, or other governed aliases.

## Addendum: 2026-04-28 property identity community coverage completed

- A remote D1 community snapshot now lives at `/Users/mark/Property_Analytics/config/generated/remote_communities_snapshot.json`, refreshed by `/Users/mark/Property_Analytics/scripts/refresh_remote_communities_snapshot.py`.
- The identity matrix builder now merges remote D1 communities before falling back to the older local generated community seed.
- One missing active community, `Retreat at Kedron Village` (`GA4KV`, GA4 `378387143`), was inserted into remote D1 as `b535df1b-ab66-53bc-9223-c748dd500acc`.
- Rebuilt matrix coverage is now 93 properties, 93 app/D1 community ids, and 91 property codes. The two no-code rows are prelaunch/non-standard communities without operating property codes in the local source table.
- The property identity governance check now fails if community-id coverage falls below the matrix property count.

## Addendum: 2026-04-28 DataForSEO Keeper credential setup

- A structured Keeper record now exists for `DataForSEO API Credentials` in the MarketingOps Keeper folder.
- Active notation mapping was added to `/Users/mark/Property_Analytics/docs/KSM_MARKETINGOPS_RECORD_MANIFEST.md`.
- New helper `/Users/mark/Property_Analytics/utils/dataforseo_auth.py` resolves login/password through Keeper-first notation with direct-env fallback.
- New verification script `/Users/mark/Property_Analytics/scripts/check_dataforseo_auth.py` confirms authentication without printing secrets.
- Live verification against `https://api.dataforseo.com/v3/appendix/user_data` returned DataForSEO status code `20000`.
- Security note: because the initial credential was shared via screenshot, rotate the DataForSEO API password after the first Collector path is wired and verified.

## Addendum: 2026-04-28 DataForSEO SERP source route

- DataForSEO now has a governed local source route for live SERP evidence rather than being treated as a one-off API experiment.
- Added:
  - `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`
  - `/Users/mark/Property_Analytics/Data_Collection/utils/dataforseo_serp_ingest.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0032_create_dataforseo_serp_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/019_create_dataforseo_serp_tables.sql`
- Local storage now includes `dataforseo_serp_runs`, `dataforseo_serp_results`, and `dataforseo_property_keyword_rankings`.
- The initial April 2026 Spotlight run loaded 23 property brand SERPs from `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/monthly_spotlight_properties_2026-04.json`.
- The first run stored 23 task rows, 574 normalized SERP result rows, target-found rankings for 17 of 23 Spotlight properties, and total DataForSEO cost of `$0.0805`.
- Current limitation: local April Spotlight property records do not yet contain dependable city/state values, so local-market keyword expansion should wait for identity/address enrichment rather than guessing.

## Addendum: 2026-04-28 property location enrichment

- The local `properties` table is now enriched to 93/93 city/state coverage.
- Added `/Users/mark/Property_Analytics/scripts/enrich_property_locations.py` as the repeatable backfill path.
- City values are sourced primarily from `/Users/mark/Property_Analytics/config/gbp_location_names.json` through the existing `gbp_location_id` join.
- State values are inferred through governed property-code prefixes, Encasa region, and Spotlight registry location where available.
- The property identity matrix builder now carries `city` and `state`, and `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` exposes those fields through `resolve_property_identity()`.
- DataForSEO keyword generation now has enough property context to create local-market terms without guessing.

## Addendum: 2026-04-28 DataForSEO deep enrichment trial

- A deeper AR4PB / The Pointe Bentonville trial was run against DataForSEO Keyword Data, DataForSEO Labs, OnPage, Business Data, and AI Optimization.
- Added:
  - `/Users/mark/Property_Analytics/scripts/run_dataforseo_spotlight_deep_trial.py`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0033_create_dataforseo_enrichment_tables.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/020_create_dataforseo_enrichment_tables.sql`
- Added local/remote schema for `dataforseo_keyword_metrics`, `dataforseo_labs_ranked_keywords`, `dataforseo_onpage_page_snapshots`, `dataforseo_business_profiles`, and `dataforseo_ai_visibility_probes`.
- The trial proved that the Captain/Spotlight report can be enriched with keyword demand/CPC/competition, property-page ranked keywords, OnPage SEO/content checks, live Google business profile facts, and AI answer visibility.
- The Backlinks API returned subscription access denied, so backlink authority data requires a separate Backlinks subscription.
- Subsequent paid calls returned `40200 Payment Required`; the trial account balance is exhausted until refreshed.
- Trial report: `/Users/mark/Property_Analytics/reports/dataforseo/deep_trial/2026-04-28/AR4PB/dataforseo_deep_trial_report.md`.

## Addendum: 2026-04-29 DataForSEO Backlinks and LLM Mentions trial

- The DataForSEO account was funded and the Backlinks plus LLM Mentions trial subscriptions were activated for focused Captain fact-finding.
- A new AR4PB / The Pointe Bentonville test confirmed that DataForSEO can now support a Ranked-style Navigator Dossier inside the Captain's Log:
  - keyword demand and CPC
  - live SERP rankings
  - Labs ranked-keyword discovery
  - OnPage technical/content checks
  - Google Business Profile/entity facts
  - backlink summary and backlink/referring-domain detail
  - direct AI response probing
  - LLM Mentions search/top-domain testing
- The focused Pointe test after subscriptions were active cost approximately `$0.5245`, leaving a DataForSEO balance of `$49.039147`.
- Backlinks now return usable authority data for AR4PB: rank `37`, `61` backlinks, `55` referring domains, `53` referring main domains, and `0` broken backlinks.
- LLM Mentions returned valid paid responses, but the first AR4PB read shows The Pointe is mentionable in a direct recommendation prompt while not yet broadly present in generic Bentonville apartment AI-memory rows. That distinction is important for Captain reporting and content strategy.
- Fact-finding report: `/Users/mark/Property_Analytics/reports/dataforseo/fact_finding/2026-04-29/AR4PB/pointe_dataforseo_captain_fact_finding_2026-04-29.md`.

## Addendum: 2026-04-29 Captain Specs and Active Property-Life Awareness

- Captain doctrine now explicitly treats the Captain as an active property steward rather than a report narrator.
- The Captain's Log must preserve Specs Memory when a read touches website, content, HTML, metadata, schema, local entity, SEO, or AI visibility.
- Website/content/SEO/AI-visibility recommendations now require a grounding chain:
  - Specs standard
  - live reality
  - external evidence such as DataForSEO, GSC, GA4, GBP, PSI, or reviews
  - directive with exact page/content/HTML action
  - follow-up proof source
- Updated doctrine files:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md`

## Addendum: 2026-04-29 Captain support-team accountability

- Captain doctrine now makes the Captain accountable for orchestration and quality control across the entire property intelligence team.
- Support agents remain lane specialists, but the Captain must know whether each lane is current, stale, blocked, or failing to produce action-ready intelligence.
- BrowserStack and EVS are now explicitly part of the Engineer / Experience Watch lane for proof of actual prospect/resident experience across devices, viewports, forms, CTAs, specials visibility, and post-change validation.
- Updated doctrine files:
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_COMMAND_HIERARCHY_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_OPERATING_MODEL_2026-04-24.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_MEMORY_AND_DIRECTIVE_STANDARD_2026-04-28.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`

## Addendum: 2026-04-29 Captain Benton scheduled runtime expansion

- The API Worker Captain runtime now has live support-agent handlers for:
  - `benton_navigator_watch`
  - `benton_experience_watch`
  - `benton_boatswain`
  - `benton_logkeeper`
- Remote D1 `captain_support_agents` for `AR4PB` now has 10 active agents.
- Daily lanes: Source Scout, Truth Reconciler, Inventory Watch, Funnel Watch, Media Watch, Navigator Watch, Experience Watch, and Boatswain.
- Weekly lanes: Logkeeper and Supervisor Scribe.
- Deployed Worker version after the expansion and platform test cleanup: `6e8d43b2-2536-47c6-9e99-da2281bca66c`.
- API module shape now supports both deployed Worker execution (`fetch`/`scheduled`) and local Hono route tests (`request`), preventing Captain cron support from breaking platform route coverage.
- EVS API permissions now explicitly permit editors to draft requests and record handoffs while preserving viewer blocks, matching the EVS lifecycle contract.
- The Worker cron schedule remains `15 12 * * *` for daily lanes and `45 13 * * 1` for weekly lanes. Paid DataForSEO and BrowserStack work remains in governed collection/EVS lanes; the Captain Worker consumes mirrored evidence and raises watch/action state.
- Roster seed artifact:
  - `/Users/mark/Property_Analytics/reports/captains_log/the_pointe_bentonville/the_pointe_bentonville_expanded_support_roster_2026-04-29.sql`

## Addendum: 2026-04-29 Captain Brief Performance Analysis bridge

- The local vNext Captain Brief generator now includes the familiar analyst Performance Analysis evidence layer:
  - T7 Performance
  - T30 Performance
  - reported advertising spend
  - marketing / website / SEO / current-special notes
- This layer is intentionally carried as reported performance context and then reconciled against Pond facts and Benton directives, so the new Captain's Brief can replace the current performance dashboard without stripping away the tables analysts already use.
- The 04/29/2026 The Pointe Bentonville artifact was regenerated and emailed to `mlaufhutte@venterraliving.com`; delivery message id `70bf720a-55ee-420a-a0e2-35ce058eb32b@property-analytics.local`.

## Addendum: 2026-04-29 Marketing BI packet and conversion summary structuring

- Additional Marketing BI full-packet exports from 04/29/2026 were consumed as governed packet evidence:
  - `/Users/mark/Downloads/Portfolio Summary.pdf`
  - `/Users/mark/Downloads/Ad Spend.pdf`
  - `/Users/mark/Downloads/conver perf summart`
- The daily packet evidence tables now preserve packet metadata, all page text, and Portfolio Summary property rows for the Captain source packet.
- `marketing_bi_packet_ingest.py` now also promotes the clean tabular `Conversion Performance Summary` page into `marketing_bi_conversion_performance_summary`.
- The new structured table captures portfolio monthly/total units, paid guest cards, paid visits, paid applications, paid leases, all guest cards, all visits, all applications, all leases, paid/all cost-per-conversion metrics, and portfolio spend split across total, Google, traditional, and social.
- Remote D1 now receives this table through `captain_sources_to_d1.py`; the 04/28/2026 sync loaded 5 structured conversion-summary rows.
- The `Ad Spend` page remains evidence-only until a tabular property/source spend export is available. Its PDF chart labels are useful for human context but are not reliable enough to auto-fill property spend in a Captain Brief.

## Addendum: 2026-04-29 Marketing BI cancel/denial native export

- The `Property CancelDenial by Mktg Source` lane now supports the native Power BI Excel export at `/Users/mark/Downloads/cancel.xlsx`.
- This materially improves the source posture: PDF exports remain available for spot checks, but Excel is the complete portfolio load and avoids visible-viewport truncation.
- The 2026-04-29 Excel load produced 4,750 detail rows across 91 resolved properties, with portfolio totals of 28,481 C&Ds, 39,284 applications, and 187,480 guest cards.
- Property identity resolution stayed governed through `Data_Collection/utils/property_identity.py`; no downstream property-map exception was introduced.
- Captain Brief cancel/denial reads now prefer the latest Excel source when both PDF and Excel sources exist for the same date, so duplicated or partial PDF rows do not distort the action read.

## Addendum: 2026-04-29 Marketing BI native Excel export expansion

- Seven additional native Excel exports were added to the Captain source model:
  - property-month ad spend
  - performance by source
  - top cancel/denial reasons
  - guest cards by source
  - traffic performance
  - portfolio summary
  - full Traffic Conversions
- New ingester: `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py`.
- New tables:
  - `marketing_bi_portfolio_summary`
  - `marketing_bi_ad_spend_property_month`
  - `marketing_bi_traffic_conversions_full`
  - `marketing_bi_excel_export_rows`
- The full Traffic Conversions Excel source materially closes prior report gaps because it includes visits, applications, RFP, closing ratios, unit count, and ATR averages by T7/T30/T60/T90 window.
- The smaller top-source/top-reason exports are preserved in a generic evidence table until their long-term report use warrants purpose-built tables.
- The Portfolio Summary export is advisory BI context only. Its reported `Apts` field can differ from the governed property identity/unit-count source and must not override official unit counts.

## Addendum: 2026-04-29 Marketing BI conversion dashboard native export

- The native Excel `conversion dashboard.xlsx` export is now promoted into `marketing_bi_conversion_dashboard_rows`.
- The table stores property-level conversion, comparison, delta, ATR average, and ATR delta by initial contact type.
- The 2026-04-29 load produced 728 rows across 91 properties and 8 contact types.
- This source closes another analyst-report gap by showing which initial-contact paths are generating or losing conversion volume, without relying on screenshot interpretation.

## Addendum: 2026-04-29 Marketing BI recovery-source native exports

- A larger native Excel recovery batch is now represented in the Captain source model.
- New tables preserve structured recovery evidence for vacancy-day unit rows, lease terms, WOW spending, ad spend plus guest-card/visit/lease performance by month, and portfolio period leakage metrics.
- This closes several Captain Brief question lanes: make-ready/vacancy aging risk, source spend vs output, lease leakage, lease-term strategy, and resident/program leakage signals.
- `Cost per Conversion by Ad Source.xlsx` and `Cost per Conversion - Trend.xlsx` currently contain invalid worksheet XML values (`NaN`) and require either clean re-export or a dedicated repair/parser path before they can be promoted safely.

## Addendum: 2026-04-29 Marketing BI cost-per-conversion malformed export handling

- Power BI cost-per-conversion exports can contain literal `NaN` / `Infinity` worksheet values that are invalid for standard XLSX readers.
- The Marketing BI Excel ingester now has a direct worksheet XML fallback for those files, preserving valid rows and treating non-computable values as nulls with an explicit `invalid_value_count`.

## Addendum: 2026-05-01 Shared-drop conversion workbooks promoted into the governed BI Excel lane

- The shared `Guest_Card_Reports` drop now contains additional conversion workbooks that belong in the same governed Marketing BI Excel path rather than a sidecar analyst workflow.
- `conversion-data.xlsx` is treated as a native alias of the earlier `conversion dashboard.xlsx` export and now lands in `marketing_bi_conversion_dashboard_rows`.
- `converting-performance.xlsx` and `marketing-performance.xlsx` are preserved in `marketing_bi_excel_export_rows` as full-fidelity portfolio evidence.
- This means the Data Pond now retains:
  - property/contact-type conversion rows from `conversion-data.xlsx`
  - property-level conversion rollups from `converting-performance.xlsx`
  - source/origin-sliced conversion performance from `marketing-performance.xlsx`
- These shared-drop files are now governed source artifacts even though only `conversion-data.xlsx` has been promoted into a purpose-built table so far.
- New table: `marketing_bi_cost_per_conversion_rows`.
- The 2026-04-29 load produced 1,092 rows across 91 properties and flagged 2,812 invalid/non-computable exported values.

## Addendum: 2026-04-29 Spotlight and pilot Captain activation

- Captain's Log runtime ownership has expanded from Benton-first to property-neutral Captain execution.
- `apps/api/src/platform/captain/runtime.ts` now resolves support agents by role suffix, so legacy `benton_*` keys and new property-specific keys such as `anatole_*`, `calais_*`, and `luma_*` execute the same support lanes.
- Pointe-specific fallback filters were removed from Captain source-read queries; Marketing BI / interest / traffic / cancel-denial reads now use governed property code and community id.
- New activation generator: `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py`.
- Remote D1 now has governed activation memory and 10 support agents for each of 28 properties: the 23 active April Spotlight properties plus the five documented pilot properties.
- Verified remote roster state:
  - `280` active support agents
  - `28` active Captain properties
  - `224` daily lanes
  - `56` weekly lanes
  - `28` activation memory entries
- Deployment after runtime generalization: Worker version `593c0b52-a019-4f55-9e3f-ed471d8f8427`.
- The Captain cron schedule remains daily at `15 12 * * *` and weekly at `45 13 * * 1`; it should consume mirrored evidence and write watch/action/run state, while paid or heavy external pulls such as DataForSEO and BrowserStack remain in governed collection / EVS lanes.

## Addendum: 2026-04-29 DataForSEO Navigator evidence catch-up

- The activated Captain roster now has a same-day DataForSEO evidence packet in local Pond and remote D1.
- Broad SERP collection ran against all 28 activated Spotlight/pilot properties with two keywords per property. It produced 56 requests, 43 target matches, and an observed API cost of `$0.196`.
- Deep Navigator collection then ran for all 28 properties and succeeded for every property. The pass captured keyword demand, Labs ranked keywords, OnPage page-health snapshots, Google Business Profile/entity reads, backlink summary raw evidence, and AI visibility probes at an observed cost of `$4.086497`.
- A new narrow remote mirror was added at `/Users/mark/Property_Analytics/apps/api/scripts/dataforseo_captain_to_d1.py`. It applies the existing DataForSEO migrations and mirrors the DataForSEO evidence tables without rerunning the larger Captain source sync.
- Remote D1 now contains 04/29/2026 DataForSEO rows for all 28 activated Captain properties:
  - 60 SERP run rows
  - 1,517 SERP result rows
  - 60 normalized property keyword ranking rows
  - 83 keyword metric rows
  - 560 Labs ranked-keyword rows
  - 28 OnPage snapshot rows
  - 28 business profile rows
  - 31 AI visibility probe rows
- The first full-file import hit a Wrangler fetch failure after upload, and one large SERP-result chunk hit the same transient failure. The schema and row loads were completed with smaller idempotent chunk imports, then verified by remote counts.
- System boundary: DataForSEO remains a Data Collection / Navigator source. Captains should not spend API credits directly from cron; they should consume mirrored rows and generate watch items, action assignments, and Brief/Log directives.

## Addendum: 2026-04-30 Captain cron bucket correction

- The first post-catch-up attempt to run the expanded Captain roster through a single scheduled invocation exposed a real Worker-runtime limit: one invocation cannot safely execute the whole 28-property daily support-agent fleet.
- `runScheduledCaptains` now buckets active support agents deterministically by property id + agent key instead of running every eligible support agent in one call.
- Cloudflare's current account plan allows a maximum of five cron triggers, so the deployed schedule is:
  - `0 12 * * *`
  - `20 12 * * *`
  - `40 12 * * *`
  - `0 13 * * *`
  - `30 13 * * 1`
- The first four triggers rotate through 16 daily Captain buckets. The Monday trigger rotates through 4 weekly Captain buckets.
- The scheduled handler now awaits the bucket work directly instead of returning through `ctx.waitUntil`.
- Final deployed Worker version after the correction: `8dd446ae-4e92-4b9d-afde-4e73121c61ce`.
- Manual runtime proof after DataForSEO catch-up:
  - Captain Benton / `AR4PB` ran all support lanes and produced refreshed actions/watch items, including Specs-backed web/content tickets from DataForSEO OnPage/search evidence, BrowserStack/EVS validation action, source-authority action, aged-unit action, and Boatswain follow-through.
  - Captain Cane / `FL4CI` and Captain Botanic / `GA4BL` also proved property-neutral runtime execution.
  - Remote D1 verified 520 Captain agent runs across all 28 activated properties, 138 updated watch items across 27 properties, and 63 updated actions across 17 properties after `2026-04-30T01:17:00Z`.
- Rapid manual HTTP catch-up through browser-protected Worker routes can trip Cloudflare `1010` protection. Future fleet catch-up should use the bucketed schedule or a governed internal service trigger rather than rapid manual route loops.

## Addendum: 2026-04-30 Spotlight Captain Brief property-safe test

- The first non-Pointe Spotlight Captain Brief test ran for Avasa at 1604 / `TX416`.
- The Spotlight Captain Brief generator now avoids prototype-specific property and market language and composes generic Captain/Admiral, website/SEO, friction, and action-plan language from the governed property context.

## Addendum: 2026-05-01 Captain Brief display standard v1.2

- The Captain's Brief family now has an active display baseline named `v1.2`.
- Canonical display standard:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_BRIEF_DISPLAY_STANDARD_V1_2_2026-05-01.md`
- The standard is referenced from:
  - `/Users/mark/Property_Analytics/docs/CAPTAINS_LOG_AND_BRIEF_STANDARD_2026-04-24.md`
- The first approved proof artifact is:
  - `/Users/mark/Property_Analytics/reports/captains_log/emergency/elation_at_grandway_west/elation_high_alert_seo_scan_2026-05-01_readable_email_outlook.html`
- The display standard exists because the data depth is now high enough that spreadsheet-style prose rows reduce comprehension. Captain artifacts should expose the same facts through at-a-glance KPI tiles, grouped evidence blocks, short `Read:` statements, and owner/action/proof directives.
- This is a Captain's Log / POP Brief-family presentation standard. It does not mutate locked PIB generation or rendering behavior.
- The Captain header is now locked through `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`, which mirrors PIB header scale and uses the real Venterra logo as a validated base64 image rather than a text-only fallback.
- Active Captain generators now call that shared renderer, and `/Users/mark/Property_Analytics/scripts/check_captains_brief_header_lock.sh` enforces that they do not reintroduce custom text-only `VENTERRA` headers or oversized title/property typography.
- When the BI Available Units / Guest Cards per Unit Type row is not present for the property, the generator uses the current unit feed as a labeled exposure fallback instead of treating missing BI as zero available units.
- Traffic Conversions now supplies fallback T7/T30 guest-card values when the available-unit interest source is absent.
- The Avasa test output demonstrates the intended audit posture: source gaps are stated explicitly, while available Pond evidence still produces a useful property-specific Captain read.

## Addendum: 2026-05-04 Marketing Operations / Flagship doctrine formalization

- The system now has an explicit department-level operating doctrine for the Captain program rather than relying only on individual feature docs and runtime behavior.
- New doctrine artifacts:
  - `/Users/mark/Property_Analytics/docs/MARKETING_OPERATIONS_CHARTER_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/FLAGSHIP_OPERATING_MODEL_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_DOCTRINE_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/CAPTAIN_READINESS_CHECKLIST_2026-05-04.md`
- These documents formalize three layers that were already emerging in the system:
  - `Marketing Operations` as the department
  - `The Flagship` as the operating model that links Pond facts, source lanes, Captain runtime, command reads, and memory
  - `Captain` as the named property-scoped intelligence owner accountable for directive quality and support-lane sufficiency
- The doctrine now explicitly defines:
  - a six-step operating method: Collect, Reconcile, Diagnose, Direct, Track, Learn
  - command posture implications for `Critical`, `Spotlight`, and `Sale` designations
  - a minimum readiness standard before a property should be treated as fully stood up under a Captain
- System significance:
  - future Captain activation, monthly designation refresh, support-lane staffing, and command-read work now has a canonical policy layer to extend
  - the platform should not treat roster presence alone as proof that a property has full Captain coverage; readiness requires governed identity, source posture, memory, action paths, and escalation paths

## Addendum: 2026-05-04 Portfolio Captain fleet activation

- The Captain system has now moved from a Spotlight/pilot-centered activation slice to a full governed portfolio roster with overlays.
- `/Users/mark/Property_Analytics/scripts/standup_captain_roster.py` now supports a `--portfolio` scope that activates every governed property from the property-identity matrix while preserving:
  - current monthly Spotlight overlays with `designation` and `market`
  - the documented pilot overlay set
- New doctrine artifacts now frame the command surfaces and activation rules:
  - `/Users/mark/Property_Analytics/docs/FLAGSHIP_COMMAND_TEMPLATES_2026-05-04.md`
  - `/Users/mark/Property_Analytics/docs/PORTFOLIO_CAPTAIN_ACTIVATION_STANDARD_2026-05-04.md`
- Remote D1 state after the 2026-05-04 activation run:
  - `93` active Captain properties
  - `1,023` active support agents
  - `93` active Captain activation memory entries
  - `19` active Spotlight-overlay properties
  - `5` active pilot-overlay properties
- System significance:
  - baseline Captain coverage is now portfolio-wide rather than limited to the monthly designation roster
  - Spotlight and pilot status now behave as overlays on top of a standing fleet, which is closer to a real department operating model than a rotating one-off project roster

## Addendum: 2026-05-04 Captain readiness and Commodore fleet review layer

- The Captain system now has its first explicit fleet-readiness audit and portfolio command-read layer on top of the newly activated 93-property roster.
- New supporting artifacts:
  - `/Users/mark/Property_Analytics/scripts/captain_fleet_support.py`
  - `/Users/mark/Property_Analytics/scripts/audit_captain_readiness.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_portfolio_commodore_read.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/readiness/captain_readiness_audit_2026-05-04.md`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/portfolio_commodore_read_2026-05-04.md`
- The first readiness snapshot for the full fleet recorded:
  - `28` ready properties
  - `63` partial properties
  - `2` source-gap properties
  - `0` activation-gap properties
- The dominant immediate post-activation pattern is `no recent runtime` on `65` properties, which means the standup succeeded structurally but the operating cadence still needs to catch up across the newly activated baseline portfolio.
- Runtime significance:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now exposes designation-aware `commandPosture` metadata in Captain status and brief-read responses, so command surfaces can distinguish baseline, focused, and urgent posture without inventing a separate overlay model downstream.

## Addendum: 2026-05-04 Designation-aware runtime cadence and catch-up plan

- The first post-activation refinement moved designation from passive metadata into the runtime path itself.
- `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now uses designation when selecting scheduled Captain work:
  - normal daily cadence remains intact
  - `Critical` properties now also receive daily `reputation_watch` and `logkeeper` execution rather than waiting only for weekly cadence
  - when a scheduled bucket contains mixed properties, row ordering now prioritizes `Critical` first, then `Sale` / `Spotlight`, then the baseline portfolio
- A new catch-up planning artifact now exists for the newly activated fleet:
  - `/Users/mark/Property_Analytics/scripts/generate_captain_runtime_catchup_plan.py`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.json`
  - `/Users/mark/Property_Analytics/reports/captains_log/commodore/captain_runtime_catchup_plan_2026-05-04.md`
- The first catch-up plan split the `65` no-recent-runtime properties into:
  - `2` source-fix-first properties
  - `8` focused-cadence `Spotlight` / `Sale` properties
  - `55` baseline-cadence properties
  - `0` missing-runtime `Critical` properties in this initial snapshot

## Addendum: 2026-05-04 Canonical morning collection lockout from GBP OAuth fallback

- A real portfolio data outage occurred beginning on `2026-05-02` when the canonical collector process launched at `05:00 AM CDT` and then hung before GA4/GSC collection began.
- The hung process held `/Users/mark/Property_Analytics/Data_Collection/logs/daily_master_collection.lock`, which caused all later scheduled collector runs on `2026-05-03` and `2026-05-04` to abort with `Another collection run is already active`.
- Root cause:
  - `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py` could not load the stored GBP token because the runtime was missing `google.auth._regional_access_boundary_utils`
  - the collector then fell back to `InstalledAppFlow.run_local_server()` interactive OAuth
  - that browser-auth fallback is not safe inside unattended launchd execution and blocked the whole portfolio collector before primary sources ran
- Canonical correction:
  - GBP collector now has an explicit headless mode that refuses interactive OAuth during unattended runs
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` uses that headless mode by default and only allows interactive auth when `ALLOW_INTERACTIVE_GBP_AUTH=1`
  - the intended enterprise behavior is fail-open for non-core GBP review auth, not full-pipeline deadlock
- Operational significance:
  - GA4, GSC, Google Ads, PSI, unit availability, and downstream retry recovery should keep moving even when GBP auth needs manual repair
  - a broken optional auth lane should never again hold the entire morning system hostage behind one live OAuth prompt

## Addendum: 2026-05-04 Catch-up execution path and first severity posture refinement

- The Captain fleet now has an executable catch-up path, not just a diagnostic backlog list.
- New runner:
  - `/Users/mark/Property_Analytics/scripts/run_captain_runtime_catchup.py`
- The runner consumes the latest generated catch-up plan and can execute lane-scoped batches through the governed Captain API surface.
- First validation was a dry-run over the `focused_cadence` lane, which correctly targeted the first five designated properties in sequence:
  - `FL4GW` Avasa Grove West
  - `FL4HL` Avasa Hammock Landing
  - `FL4VC` Villas Continental
  - `KY4MP` The Metropolitan
  - `TX4CO` College View
- Runtime refinement:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` now applies a first designation-aware severity/priority escalation for `Critical` properties on selected source and inventory lane outputs
- System significance:
  - the fleet now has the beginning of a closed loop: readiness audit -> Commodore read -> catch-up plan -> governed catch-up execution
  - designation posture is beginning to influence both scheduling and output urgency, which is closer to the intended Flagship operating model

## Addendum: 2026-05-04 POP Brief diagnostic recommendation standard

- A 2026-05-04 stakeholder transcript from `/Users/mark/Downloads/Watchlist Organization - Plan - Mark's Agents.docx` clarified the expected POP Brief / Captain recovery shape for watchlist, spotlight, and critical properties.
- The team does not want a broad dashboard summary. They want an operating diagnosis that starts with recovery math, identifies the primary constraint, explains why the system recommends each action, and cites the exact supporting source.
- New standard:
  - `/Users/mark/Property_Analytics/docs/POP_BRIEF_DIAGNOSTIC_RECOMMENDATION_STANDARD_2026-05-04.md`
- The standard establishes a repeatable diagnostic order:
  - recovery math
  - funnel diagnosis
  - floorplan / unit exposure
  - pricing / concession fit
  - traffic and source mix
  - competitive visibility
  - website / content / media
  - reputation / resident experience
  - operations and people constraints
- It also establishes the recommendation contract for Captain/POP outputs:
  - constraint
  - action
  - owner
  - due date
  - expected lift
  - evidence
  - confidence
  - proof check
  - optional do-not-recommend gate
- System significance:
- POP Brief and Captain Brief work now has an explicit recovery-decision standard rather than relying on ad hoc analyst interpretation
- the grounding core should produce an internal Captain diagnostic and a concise property action plan from the same governed read model
- this does not mutate locked canonical PIB generation or rendering behavior
- First implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/captain/runtime.ts` derives `diagnosticRead` for latest Captain Brief reads and newly persisted Captain Brief payloads
  - the Captain Marketing BI read now includes `sourceSpendRead`, derived from Marketing BI cost-per-conversion rows and ad-spend performance rows, so source/spend recommendations can cite visible lease/application/guest-card economics
  - the diagnostic read now includes `designationDoctrine`, making Spotlight an accelerated recovery watch and Critical an escalated recovery command inside the Captain's behavior
  - the diagnostic read now includes `peerFamilyRead`, allowing lagging properties to learn from stronger same-region or portfolio sibling properties while preserving subject-property facts as governing evidence
  - `/Users/mark/Property_Analytics/apps/web/src/app/analysis/captain/page.tsx` renders the Diagnostic Plan with primary constraint, recovery math, designation doctrine, peer-family help, recommended fixes, proof checks, and do-not-recommend gates, plus source/spend economics inside the Marketing BI read
  - `/Users/mark/Property_Analytics/apps/api/test/platform/captain-brief-read.test.ts` verifies the derived read model against the AR4PB fixture, including source/spend and peer-family output
  - `/Users/mark/Property_Analytics/reports/captains_log/generate_watchlist_diagnostic_drafts.py` generated the first May 2026 local watchlist diagnostic packet at `/Users/mark/Property_Analytics/reports/captains_log/watchlist_diagnostics/2026-05-04/`
- First packet result:
  - `19` active May spotlight/watchlist properties resolved through governed identity
  - `0` unresolved property identities
  - all `19` currently read as inventory or stale-unit constrained before demand, which is a material review finding for the team before any source-spend increase is recommended
  - peer-family sections are now included in the generated Markdown/JSON packet so reviewers can see which sibling property may offer a tactic to borrow

Operational note added on 2026-05-05:

- GSC freshness has now been normalized across the shared policy, Morning Full, and Watchtower/API surfaces so normal Search Console lag is not misreported as an active freshness incident.
- Canonical rule: `gsc` is expected through `today - 3 days`; a one-day miss beyond that is `warning`, and larger misses are `stale`.
- This closes a cross-surface reporting mismatch where Morning Full had still been using a raw age heuristic and could mark naturally current GSC data as `warning`.

Operational note added on 2026-05-05:

- D1 mirror reliability has been tightened specifically around the Captain-source sync lane.
- The `2026-05-05` mirror failures were not broad D1 auth failures; they were transient `fetch failed` errors during `captain_sources_to_d1.py` remote imports after earlier mirror steps had already succeeded.
- Both `/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py` and `/Users/mark/Property_Analytics/apps/api/scripts/captain_sources_to_d1.py` now retry transient Wrangler/Cloudflare connectivity failures before surfacing a hard mirror failure.

Operational note added on 2026-05-06:

- The canonical collection system had a real source-retry orchestration bug in the operating-metrics lane:
  - `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py` attempted to call `_queue_source_retry(...)` without implementing it on `PortfolioDataCollector`
  - this caused source-level operating-metrics failures to crash with an attribute error instead of recording governed retry intent
- The collector now implements `_queue_source_retry(...)` as the canonical source-level wrapper around property-queue mechanics.
- `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py` was also hardened for direct operator/script use so audits can pass sqlite connections and ISO date strings without type errors.
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py` now runs core missing-source recovery (`unit_availability`, `d1_mirror`) ahead of PSI/property-operating-metrics advisory retries, so closure-critical lanes do not wait behind long PSI reruns.

Operational note added on 2026-05-05:

- The AptIQ-backed Spotlight readiness workflow now audits DataForSEO coverage explicitly instead of only checking operating and funnel sources.
- For the `11` Spotlight properties prepared from `/Users/mark/Downloads/watchlist`, DataForSEO search/on-page/business-profile evidence was initially present for `7` properties with latest rows dated `2026-04-29`.
- `TX4CO` College View, `FL4HL` Hammock Landing, `KY4MP` The Metropolitan, and `FL4RL` The Retreat at Lakeland were collected on `2026-05-06` through the governed DataForSEO SERP and deep-enrichment scripts, then mirrored to remote D1 for Captain evidence use.
- Current Spotlight readiness now shows DataForSEO ready for all `11` properties.
- DataForSEO remains an advisory evidence lane; it should not override source-of-record operating, funnel, unit, reputation, or pricing facts.

Operational note added on 2026-05-06:

- The Captain's Log now has its first Data Pond inspection UI rather than only report output.
- `/analysis/captain` has been extended with a Captain Command Center above the existing Brief preview.
- New API reads expose portfolio roster state and property command-center state from the existing Captain runtime tables:
  - `/v1/captain/roster`
  - `/v1/captain/properties/:propertyId/command-center`
- The Command Center surfaces designation posture, support-agent cadence, latest runs, memory entries, source/knowledge coverage, watch items, actions, and brief history.
- System boundary: this is a Captain runtime and Data Pond control surface. It does not create a parallel PIB renderer and does not alter locked PIB generation/rendering files.

Operational note added on 2026-05-06:

- The local vNext Captain Brief generator has been corrected to comply with the latest stakeholder report-evaluation feedback.
- Visible search framing has been removed from the Brief: no paid-search KPI card, no standalone search-evidence section, and no `Website / SEO` marketing note.
- Website recommendations remain as `Website Content Diagnosis`, focused on exact leasing-page copy, hierarchy, offer language, and page-structure guidance. Source evidence for page diagnostics stays in the bottom source panel rather than leading the report.
- The top KPI grid now emphasizes action-ready recovery facts: exposure, net move-ins needed, primary gap, T30/T90 closing ratio, guest cards needed, visible special, T30 guest cards, and floorplan action lane.
- The 11-property Spotlight readiness audit was also corrected to resolve source tables that store property facts by GA4/feed ids rather than only property code, using the governed identity matrix rather than local one-off maps.
- Avasa Hammock Landing then had `138` collected GBP reviews backfilled into deterministic review-sentiment rows under GA4/property id `416886840`, closing the last audited critical-lane gap. The 2026-05-06 readiness audit now shows all `11` AptIQ-backed Spotlight properties at `12/12` audited critical source lanes.

Operational note added on 2026-05-06:

- A new BI workbook batch from `/Users/mark/Downloads` was ingested into local Data Pond tables.
- Purpose-built routes loaded `91` Marketing Ops Summary rows, `4,762` C&D reason/source rows, `728` init-contact conversion dashboard rows, `364` ad-spend performance rows, `91` ad-spend property/month rows, and `6,108` vacancy-day unit rows.
- The generic Marketing BI Excel evidence ledger retained the larger noncanonical workbook family, including conversion detail, leasing detail, tickets, value proposition, Kingsley/NPS/renewal/rent-pricing, portfolio summary/demographics, available, conversion performance, and regional C&D rollups.
- `region.xlsx` was explicitly identified as a regional C&D rollup, not a governed property-region assignment source, so it was not used to update property configs.
- The Marketing BI Excel ingester now normalizes browser download suffixes such as ` (1)` and ` (2)` for source detection while still storing the real source file path for evidence.

Operational note added on 2026-05-06:

- The detailed weekly Marketing BI property source-performance workbooks are now a governed source-performance feed.
- `/Users/mark/Property_Analytics/Data_Collection/utils/marketing_bi_excel_export_ingest.py` recognizes `perf-by-source-*` workbooks, keeps Portfolio rows as benchmark context, and resolves property Selection rows through the governed property identity matrix when row or filename context supplies a property key.
- The first weekly batch loaded `19` workbooks and `521` source-performance rows into `marketing_bi_source_performance_rows`.
- Coverage check for the batch:
  - `19` distinct weekly exports
  - `198` Selection rows
  - `323` Portfolio rows
  - `19` mapped Selection properties
  - `0` unmapped Selection rows
- `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now prefers property-specific `perf-by-source-*` rows over older source-performance exports, so structured diagnostic JSON can use the latest weekly source detail.
- Elation's regenerated diagnostic JSON now reads `perf-by-source-elation` for the source layer, with total-row facts of `677` guest cards, `122` visits, `62` applications, `16` leases, and `10` move-ins.
- System boundary: this is Data Pond ingestion and structured diagnostic grounding. It does not alter locked canonical PIB generation or rendering files.

Operational note added on 2026-05-06:

- The structured property diagnostic read model now uses the Pond-wide PSI table.
- The local Pond has `pagespeed_metrics` as the portfolio-wide PSI/CWV source (`16,896` rows, `93` property ids, latest `2026-05-06`) and `pilot_control_psi_metrics` as a pilot/control-specific source (`436` rows, `10` property ids, latest `2026-05-06`).
- Elation / `TX4EG` has PSI rows in `pagespeed_metrics` under GA4 id `378381999`, not in `pilot_control_psi_metrics`.
- `/Users/mark/Property_Analytics/Data_Collection/read_models/property_diagnostic_json.py` now reads `pagespeed_metrics` first by GA4 id and falls back to `pilot_control_psi_metrics` only when needed.
- The regenerated Elation diagnostic JSON now includes `2026-05-06` PSI/CWV facts:
  - mobile PSI `61`, LCP `5.78`, CLS `0.054`, FID/interaction fallback `33`
  - desktop PSI `89`, LCP `1.28`, CLS `0.034`, FID/interaction fallback `20`
- The PSI missing flag is no longer present for Elation.

Operational note added on 2026-05-06:

- The abandoned application export is present in the Pond but is not property-attributable.
- `marketing_bi_abandoned_application_rows` contains `962` loaded rows dated `2026-05-06`, with roughly `480` likely unique rows after duplicated export copies.
- The source workbook exposes unit/floorplan/rent/date fields but no property id, property name, region, community id, or other reliable property key.
- The diagnostic read model now records abandoned applications as `source_loaded_no_property_key` with `publish_property_count: false` instead of calling the source missing or inventing property-level counts.
- Future Marketing BI abandoned-application exports should include a property key before the metric can be used as a property-scoped count in Captain/VP structured JSON.

Operational note added on 2026-05-06:

- A dedicated VP property retrieval JSON serializer now exists at `/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`.
- This serializer is distinct from internal Captain diagnostic JSON and is shaped to the VP-requested contract: one object per property with Demand Signals, Funnel Conversion, Inventory/Product, Demand vs Inventory Matching, Pricing/Market Position, Marketing Efficiency, Reputation/Product Friction, Website Performance, Derived Flags, and explicit missing data.
- Contract assumptions from Mark:
  - current month means month-to-date through latest available source date
  - `pd` means paid traffic
  - the 11 Spotlight production run should create 11 separate JSON files
- The first Elation specimen was generated at `/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`.
- System boundary: this is retrieval-layer data shaping only, not a PIB or Captain Brief renderer.
- Follow-up QA corrected the serializer away from repeated `null` comparison scaffolding. It now emits compact metric objects; required unavailable values use `available: false` plus a `missing_data_path`, and the source reason appears once in `missing_data`.
- The regenerated Elation specimen has `0` JSON null values and fills additional computable values from existing Pond rows: GA4 conversion rate from conversions/sessions, available-unit T30/T90 averages from unit snapshots, PSI T30/T90 averages from `pagespeed_metrics`, spend budget-vs-actual rollups, and cost-per-guest-card rollups.

Operational note added on 2026-05-07:

- The Watchlist companion workbook is now versioned as v1.2 in `/Users/mark/Property_Analytics/docs/WATCHLIST_COMPANION_WORKBOOK_STANDARD_V1_2_2026-05-07.md`.
- The Elation v1.2 proof workbook lives at `/Users/mark/Property_Analytics/reports/captains_log/elation_at_grandway_west/elation_watchlist_companion_v1_2_2026-05-07.xlsx`.
- The workbook is the auditable Excel evidence attachment for Watchlist Decision Output emails; it is not a new PIB renderer and does not alter locked PIB generation/rendering/sending files.
- v1.2 adds `Demand_vs_Availability`, preserving property-total and bedroom-level Guest Cards per Available Unit evidence from the governed Marketing BI available-interest route.
- The available-interest schema now carries `bedrooms`, and the Marketing BI Excel ingester maps `Bedrooms` rows to the active parent property through the governed property identity matrix.
- Captain Brief property-total reads now filter to `current_level = 'Property'` so bedroom rows do not accidentally replace property KPI facts.
- The 11 current Spotlight Captain Brief vNext artifacts were regenerated after the available-interest correction.

Operational note added on 2026-05-07:

- A shared company Watchlist repository has been established at `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Watchlist_Data`.
- The repository standard is documented at `/Users/mark/Property_Analytics/docs/WATCHLIST_SHARED_REPOSITORY_STANDARD_2026-05-07.md`.
- The shared directory is explicitly a repository/publication/exchange layer, not the post-ingestion system of record. Data Pond remains authoritative after source files are ingested and validated.
- The active folder structure includes source inboxes, current reports, companion files, JSON outputs, source logs/readiness receipts, and a year/month archive.
- Internal report emails should link to published repository files when practical instead of attaching large report artifacts.
### 2026-05-07 GBP Repair Closure

- GBP is now repaired at the governed auth path, not only by local workaround.
- The canonical collector and insights lane both use one shared auth object through `/Users/mark/Property_Analytics/Data_Collection/collectors/gbp_collector.py`.
- Keeper/KSM is now live for the GBP file-backed OAuth artifacts:
  - `KSM_GBP_CLIENT_SECRET_UID=W06j0C6nHmT25dyr7sVYTA`
  - `KSM_GBP_TOKEN_UID=yDAkWDdIFlYjvDbjVl6McQ`
- The config path now prefers Keeper token materialization when configured, and refreshed token state is uploaded back to Keeper so unattended runs stay governed instead of drifting back to local-only persistence.
- `Avasa Hammock Landing` was not an auth failure after that repair. It was a stale GBP location mapping problem. The matched mapping file now points to location id `8521091931329757992`, which succeeds for both reviews and Performance API calls.
- Live canonical result on 2026-05-07:
  - `gbp_reviews`: `91/91 completed`
  - `gbp_insights`: `91/91 completed`
### 2026-05-07 Morning Full Control-Flow Fix

- The canonical summary sender already knew how to hold Morning Full until closure was ready, but the post-run acceptance gate still treated “no email sent yet” as failure.
- `send_morning_full_report.py` now writes an explicit execution-status artifact for `held`, `dry_run`, `already_delivered`, `delivered`, and `report_missing`.
- `verify_morning_delivery.py` now consumes that artifact so intentional hold behavior passes cleanly while true send failures still fail the lane.
- Operational effect: `com.venterra.daily.health` should no longer surface false red runs when Morning Full is correctly deferred by closure policy.

### 2026-05-07 Closure Advisory State

- The shared closure engine now distinguishes a true blocked day from a post-core advisory tail.
- New closure posture:
  - `state=advisory`
  - `summary_reason=core_closed_with_advisory_open`
- This state is emitted when no core source lanes remain unresolved, but advisory/manual retry items still exist.
- Watchtower and Morning Full now read that as an amber governance state instead of a false red blockage.

### 2026-05-07 PSI Reconciliation Upgrade

- PSI no longer relies only on per-attempt success counts to decide whether the day is complete.
- The collector now grades same-day completion from actual stored `pagespeed_metrics` coverage across the expected portfolio set, which matters because repeated retries can cumulatively close the day even when the final single attempt still had some transient misses.
- Targeted PSI retries are now supported by GA4 property id, and the retry worker computes the true incomplete property set from stored same-day mobile/desktop coverage before deciding whether to rerun anything.
- If same-day coverage is already complete, the retry worker now reconciles the latest PSI run row to `completed` and resolves the queue instead of launching another portfolio-wide rerun.

### 2026-05-09 Directive Control Center

- The Captain / Commodore / Fleet / Expert Bench / Fleet Scribe operating model now has a governed Directive Control Center.
- Directives are modeled as operational policy data with structured fields, version history, validation, approval workflow, runtime snapshots, simulation results, and audit events.
- Runtime consumers should resolve behavior through approved active directive versions. Draft versions are allowed only in simulation mode.
- The control surface is additive to Data Pond and Captain runtime and does not create a parallel reporting system.
- Fleet Scribe publication authority and Quartermaster source-integrity gates remain blocking controls.
- Current implementation locations:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/directives`
  - `/Users/mark/Property_Analytics/apps/api/src/routes/directives.ts`
  - `/Users/mark/Property_Analytics/apps/api/migrations/0047_create_directive_control_center.sql`
  - `/Users/mark/Property_Analytics/apps/web/src/app/admin/directives/page.tsx`
  - `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_ARCHITECTURE_2026-05-09.md`
  - `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_OPERATING_GUIDE_2026-05-09.md`

### 2026-05-09 Directive Control Center Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/DIRECTIVE_CONTROL_CENTER_AUDIT_HARDENING_2026-05-09.md`.
- Runtime integrity controls now include:
  - approved-active runtime resolution only
  - draft isolation except explicit simulation mode
  - immutable runtime snapshots
  - immutable audit events
  - post-draft directive content immutability
  - persisted directive and runtime snapshot hashes
  - request/correlation IDs for traceability
- Governance controls now include:
  - admin-only `directiveControlCenter` permission surface
  - DB-level uniqueness for active, draft, and submitted directive versions per profile
  - stricter validation of publication permissions, external communication permissions, source freshness, confidence thresholds, report-family applicability, and impossible lifecycle states
  - explicit blocking preservation for Fleet Scribe publication authority and Quartermaster source integrity
- Scope boundary remains unchanged:
  - no parallel report system
  - no Captain’s Office implementation in that pass
  - no locked PIB mutation

### 2026-05-09 Captain Runtime Orchestration Foundation

- The first governed Captain Runtime Orchestration Layer now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/captain-runtime`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_ARCHITECTURE_2026-05-09.md`.
- The runtime sits above Data Pond facts and below official report/artifact generation. It receives interactions, resolves property context, classifies intent, resolves active directives, builds immutable evidence packets, enforces governance, constructs structured reasoning payloads, validates responses, and routes memory/action/escalation candidates.
- Runtime persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0048_create_captain_runtime_orchestration.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0035_create_captain_runtime_orchestration.sql`
- The API surface is `/v1/captain-runtime/interactions`.
- Important boundary:
  - GPT is a constrained reasoning engine only
  - human inputs become claims/candidate memory, not canonical truth
  - runtime behavior resolves through the Directive Resolver
  - evidence packets preserve source/freshness/authority lineage
  - Fleet Scribe and Quartermaster controls remain blocking
  - no parallel reporting system or locked PIB mutation was introduced

### 2026-05-09 Captain Runtime Orchestration Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_RUNTIME_ORCHESTRATION_AUDIT_HARDENING_2026-05-09.md`.
- Runtime integrity controls now include:
  - explicit Directive Resolver assertions for role id, active approval status, runtime snapshot id, and runtime snapshot hash
  - immutable/no-delete database protections for sessions, interactions, evidence packets, reasoning requests, reasoning responses, and audit events
  - runtime session idempotency keys for replay/duplicate submission protection
  - replayable evidence packet hashes that exclude volatile ids and timestamps
  - evidence validation before reasoning
  - payload validation before reasoning request persistence
  - structured response validation before side effects
  - side-effect validation before memory/routing persistence
- Governance/security controls now include:
  - editor runtime-mode limits to monitoring, lightweight, and standard
  - admin-only access to escalated, executive, and simulation runtime modes
  - candidate-memory evidence lineage, expiration, conflict state, and duplicate signatures
  - strict rejection of hallucinated structured response fields
- Scope boundary remains unchanged:
  - no Captain’s Office UI in that pass
  - no real GPT provider integration
  - no autonomous workflows
  - no parallel report system
  - no locked PIB mutation

### 2026-05-09 Captain’s Office Operational Workspace

- The governed Captain’s Office interface now exists as the operational workspace above Captain Runtime.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_ARCHITECTURE_2026-05-09.md`.
- Web implementation:
  - `/Users/mark/Property_Analytics/apps/web/src/app/captains`
- API additions under Captain Runtime:
  - `/v1/captain-runtime/properties/:propertyId/office`
  - `/v1/captain-runtime/properties/:propertyId/history`
  - `/v1/captain-runtime/properties/:propertyId/evidence`
  - `/v1/captain-runtime/properties/:propertyId/memory-candidates`
- Route/navigation integration:
  - `captainOffice` is now a governed briefing surface in the app permission registry and sidebar.
  - Static property routes are generated from the governed property identity matrix.
- Important boundary:
  - Captain’s Office consumes Captain Runtime; it does not recreate runtime logic.
  - It does not expose raw internal prompts or giant runtime payloads.
  - It does not mutate Data Pond facts, evidence packets, directives, runtime lineage, or governed memory.
  - It does not implement memory promotion.
  - It does not create a parallel reporting system or alter locked PIB behavior.

### 2026-05-09 Expert Reads / Consulting Bench Runtime Controls

- The first governed Expert Reads runtime foundation now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/expert-reads`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_ARCHITECTURE_2026-05-09.md`.
- Expert Reads are structured specialist contributions from Consulting Bench lanes. They are not autonomous agents, report authors, independent assistants, chatbot lanes, or report generators.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0049_create_expert_reads.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0036_create_expert_reads.sql`
- API surface:
  - `/v1/expert-reads`
  - `/v1/expert-reads/:expertReadId`
  - `/v1/expert-reads/properties/:propertyId`
  - `/v1/expert-reads/properties/:propertyId/:laneId`
- Important boundary:
  - Expert Reads resolve active directives through the Directive Resolver.
  - Expert Reads consume governed Captain evidence packets and preserve evidence/directive hash lineage.
  - Expert Reads cannot mutate Data Pond facts, promote memory, publish artifacts, bypass Fleet Scribe, or bypass Quartermaster.
  - The layer is additive to Captain Runtime, Captain’s Office, Directive Control Center, Watchlist, Spotlight, PIB, Fleet Scribe, and approved artifact generation systems.

### 2026-05-10 Expert Reads Runtime Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/EXPERT_READS_RUNTIME_AUDIT_HARDENING_2026-05-10.md`.
- Runtime integrity controls now include:
  - replayed Captain evidence packet hash validation
  - source Captain Runtime lineage assertions for supplied session/interaction ids
  - deterministic request replay protection
  - audit events carrying evidence, directive, and read hash lineage
  - database-level prevention of self-authorized `publishable` Expert Read states
  - stricter structured output validation before final persistence
- Scope boundary remains unchanged:
  - no Expert Reads UI
  - no real GPT provider integration
  - no autonomous Bench agents
  - no Fleet Scribe publication tooling
  - no parallel report system
  - no locked PIB mutation

### 2026-05-10 Captain’s Office Expert Reads Visibility

- Captain’s Office now exposes Expert Reads as governed Consulting Bench specialist contributions.
- Integration documentation is at `/Users/mark/Property_Analytics/docs/CAPTAIN_OFFICE_EXPERT_READS_INTEGRATION_2026-05-10.md`.
- The new web route is `/captains/[propertyId]/expert-reads`, generated from governed property identities.
- The UI lists Expert Reads, renders selected read detail, displays confidence/freshness/publishability/blocking state, exposes evidence/directive/read/request hash lineage, and allows controlled lane-specific Expert Read requests through `/v1/expert-reads`.
- The implementation remains a visibility and request layer only:
  - no new runtime
  - no autonomous expert agents
  - no report authoring system
  - no Fleet Scribe publication bypass
  - no Quartermaster bypass
  - no Data Pond mutation
  - no memory promotion

### 2026-05-10 Property Access Control Foundation

- Canonical property-scoped authorization now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/access/property-access-control.ts`.
- Architecture is documented at `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_ARCHITECTURE_2026-05-10.md`.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0050_create_property_access_control.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0037_create_property_access_control.sql`
- The access model supports property, region, portfolio, capability, runtime-mode, and Expert Read lane authorization.
- Captain Runtime, Captain’s Office read endpoints, runtime history, evidence lineage, memory candidates, and Expert Reads routes now resolve access through the shared primitive instead of scattered property checks.
- Denied and high-risk authorization decisions are written to immutable audit events.
- Important boundary:
  - this is not a parallel auth system
  - frontend checks are not the security boundary
  - authorization gates access before runtime governance
  - Directive Resolver, Quartermaster, Fleet Scribe, Data Pond, Captain Runtime, Expert Reads, and approved artifact generation controls remain authoritative
  - no real GPT, report publishing, memory promotion, or locked PIB behavior changed

### 2026-05-10 Property Access Control Hardening

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/PROPERTY_ACCESS_CONTROL_AUDIT_HARDENING_2026-05-10.md`.
- Authorization integrity controls now include:
  - explicit `allow` / `deny` grant effects
  - deterministic grant precedence with property grants before region grants before portfolio grants
  - same-scope deny precedence over allow
  - duplicate active grant prevention
  - strict fail-closed handling for invalid actions, invalid runtime modes, invalid Expert Read lanes, missing property scope, missing region scope, revoked grants, and expired grants
  - Expert Read detail masking to avoid confirming restricted record existence to unauthorized users
  - immutable audit events with correlation id preservation
- Scope boundary remains unchanged:
  - no parallel auth system
  - no grant-management UI
  - no AI behavior
  - no report publishing behavior
  - no PIB/reporting coupling

### 2026-05-10 Awareness Network / Memory Stewardship Foundation

- The first governed Awareness Network and Memory Stewardship foundation now exists at `/Users/mark/Property_Analytics/apps/api/src/platform/awareness`.
- The governing charter is documented at `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_CHARTER_2026-05-10.md`.
- Supporting architecture docs cover Memory Stewardship, Agent Identity/Charters, Memory Taxonomy/Care Metadata, Self Notes/Commitments, Regional Awareness, Memory Governance, and Captain’s Office integration.
- The 2026-05-10 hardening record is `/Users/mark/Property_Analytics/docs/AWARENESS_NETWORK_AUDIT_HARDENING_2026-05-10.md`.
- The cross-system runtime acceptance record is `/Users/mark/Property_Analytics/docs/CROSS_SYSTEM_RUNTIME_ACCEPTANCE_AUDIT_2026-05-10.md`.
- Naming alignment:
  - Captain’s Office remains the human-facing operational workspace.
  - Captain’s Quarters is now the working memory/stewardship area for Memory Posture, Self Notes, Open Commitments, Care Warnings, Reflection Suggestions, and Regional Awareness summaries.
  - Captain’s Log is the chronological continuity/archive layer for runtime history, reflection events, correction trail, archived memory, superseded memory, and commitment status changes.
- Persistence is in:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0051_create_awareness_network.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0038_create_awareness_network.sql`
- Persistence hardening now blocks deletion of memory items, self notes, commitments, audit events, corrections, and archives; blocks publication-eligible memory lifecycle state updates until a future governed workflow exists; and keeps correction/archive records immutable.
- API surface:
  - `/v1/awareness/agents/:agentId`
  - `/v1/awareness/properties/:propertyId/posture`
  - `/v1/awareness/properties/:propertyId/self-notes`
  - `/v1/awareness/properties/:propertyId/commitments`
  - `/v1/awareness/regions/:regionId/summary`
  - `/v1/awareness/properties/:propertyId/regional-awareness`
  - `/v1/awareness/reflection-runs`
  - `/v1/awareness/memory/:memoryId`
- Important boundary:
  - named agents are bounded operational stewards, not autonomous authorities or people
  - self notes are not canonical truth and cannot be public/report evidence
  - human-submitted memory remains claim-level until governed
  - memory can expire, archive, or be superseded
  - regional awareness is summary-level and access-controlled
  - PropertyAccessControl gates awareness access
  - Directive Control Center remains policy authority
  - Quartermaster remains blocking
  - Fleet Scribe remains publication authority
  - no real GPT integration, memory promotion, Data Pond mutation, report publishing, people scoring, or parallel reporting system was added

### 2026-05-10 Cross-System Runtime Acceptance Gate

- Added `/Users/mark/Property_Analytics/apps/api/test/platform/cross-system-runtime-acceptance.test.ts`.
- Verified the integrated stack:
  - Captain’s Office -> PropertyAccessControl -> Captain Runtime -> Directive Control Center -> immutable Evidence Packet -> Captain’s Quarters / Awareness Network -> Captain’s Log continuity -> Expert Reads -> Quartermaster/Fleet Scribe boundaries.
- Readiness decision in the acceptance record:
  - `ready_for_model_gateway: true`
  - real GPT remains explicitly not integrated
- The acceptance gate confirms the organism is safe enough for a separate Model Provider Gateway design prompt, while preserving all no-autonomy, no-publication, no-memory-promotion, no-Data-Pond-mutation, and no-PIB-coupling boundaries.

### 2026-05-11 Model Provider Gateway Foundation

- The platform now has an internal **Model Provider Gateway** beneath Captain Runtime and Expert Reads at `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway`.
- This layer is additive to:
  - Data Pond
  - PropertyAccessControl
  - Captain Runtime
  - Captain’s Office
  - Captain’s Quarters
  - Captain’s Log
  - Directive Control Center
  - Expert Reads
  - Quartermaster
  - Fleet Scribe
- It provides:
  - adapter abstraction
  - deterministic default accepted-output execution
  - noop fail-closed fallback
  - Cloudflare AI Gateway adapter as infrastructure enhancer
  - shadow-mode compare-only execution
  - payload minimization / redaction
  - structured response validation
  - governance post-check
  - immutable model-call audit lineage
  - internal call-rate / token / cost guardrail foundation
- Captain Runtime and Expert Reads now invoke the gateway abstraction instead of directly owning deterministic execution.
- Cloudflare is explicitly treated as an infrastructure enhancement layer, not as an authority or truth layer.
- Live model/provider calls remain disabled by default.
- No parallel reporting system was created and no PIB/reporting coupling was introduced.

### 2026-05-11 Model Provider Gateway Audit / Hardening Gate

- Enterprise hardening audit is documented at `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_AUDIT_HARDENING_2026-05-10.md`.
- Persistence paths are:
  - `/Users/mark/Property_Analytics/apps/api/migrations/0052_create_model_provider_gateway.sql`
  - `/Users/mark/Property_Analytics/infra/migrations/0039_create_model_provider_gateway.sql`
- The infra migration was corrected from the sequence-inconsistent `034_create_model_provider_gateway.sql` to `0039_create_model_provider_gateway.sql`, matching the zero-padded infra sequence after Awareness Network `0038`.
- Hardening added:
  - unsafe gateway config validation with fail-closed behavior
  - raw payload / raw provider output / cache enablement blocking for this foundation
  - stronger relationship/private/sensitive memory redaction
  - pattern-only raw-detail removal
  - model output rejection for promoted memory candidates, self notes as evidence, relationship/people scoring, Quartermaster/Fleet Scribe bypass, report publication, Data Pond mutation, external communication, directive/authorization edits, and provider self-routing
  - source-specific validation/governance checks for shadow provider output while deterministic output remains accepted
- Readiness decision:
  - `ready_for_shadow_mode_provider_config: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
- Important boundary:
  - this is permission to configure controlled shadow-mode provider settings next, not permission to enable live accepted model behavior
  - no real GPT/model calls, autonomous behavior, memory promotion, report publishing, Cloudflare authority transfer, or PIB/reporting coupling was added

### 2026-05-11 Cloudflare Shadow-Mode Provider Configuration

- Added the controlled shadow-provider configuration pass for the internal Model Provider Gateway.
- New docs:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_PROVIDER_CONFIG_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_SMOKE_TEST_2026-05-10.md`
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_GOLDEN_CASE_EVALUATION_2026-05-10.md`
- New implementation:
  - explicit config separation for provider shadow enablement, provider live enablement, accepted output adapter, shadow provider adapter, kill switch state, and dry-run state
  - Cloudflare adapter support for shadow-only transit while `MODEL_GATEWAY_ALLOW_LIVE_CALLS=false`
  - shadow-mode adapter metadata capture for provider/model/route, provider request id, token usage, cost estimate, latency, validation/governance status, and safe errors
  - immutable `model_gateway_shadow_results` persistence in app and infra migrations
  - backend-only synthetic smoke path at `/Users/mark/Property_Analytics/apps/api/scripts/smoke_cloudflare_shadow_model_gateway.ts`
  - golden-case evaluation foundation at `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/evaluation.ts`
- The shadow path is explicitly observation-only:
  - deterministic output remains accepted
  - provider output is validated and governance-checked
  - provider output is stored as shadow observability metadata only
  - provider output cannot create memory, routing, reports, publication, Expert Reads, Captain Runtime side effects, Data Pond changes, or PIB/reporting coupling
- Readiness decision:
  - `ready_for_shadow_provider_smoke_test: true`
  - `ready_for_semantic_shadow_evaluation: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`

### 2026-05-11 Cloudflare Shadow Smoke / Golden-Case Evaluation Pass

- Evaluation record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_SHADOW_EVALUATION_RESULTS_2026-05-10.md`
- Added metadata-only evaluation runner:
  - `/Users/mark/Property_Analytics/apps/api/scripts/run_model_gateway_shadow_evaluation.ts`
- First controlled smoke/evaluation findings:
  - deterministic accepted output remains preserved
  - live provider calls remain disabled
  - Cloudflare adapter live accepted behavior remains disabled
  - explicit shadow smoke used synthetic data only
  - provider call was skipped because Cloudflare backend base URL/model/token are absent
  - missing config was audited as a skip/fail-closed state
  - shadow result records were created without provider transit
  - all seven deterministic golden cases passed structure, governance, redaction, and semantic score checks
  - all seven shadow fixture attempts preserved deterministic accepted output and recorded skip lineage
- Semantic scoring now covers:
  - structure compliance
  - governance compliance
  - evidence discipline
  - memory care
  - publishability restraint
  - operational usefulness
- Updated readiness:
  - `ready_for_limited_shadow_expansion: true`
  - `ready_for_live_candidate_mode_design: true`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`
- Important limitation:
  - provider semantic quality, token usage, latency, cost estimate, and provider request id capture remain unmeasured until backend Cloudflare provider config is supplied through the approved secret path

### 2026-05-11 Real Cloudflare Shadow Observation Preflight

- Real shadow observation record:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_REAL_SHADOW_OBSERVATION_RESULTS_2026-05-10.md`
- Preflight found no approved backend Cloudflare AI Gateway config in the current shell or checked backend config files.
- Missing required config:
  - `CLOUDFLARE_AI_GATEWAY_BASE_URL`
  - `CLOUDFLARE_AI_GATEWAY_AUTH_TOKEN`
  - `CLOUDFLARE_AI_GATEWAY_MODEL` or `CLOUDFLARE_AI_GATEWAY_DYNAMIC_ROUTE_NAME`
- Safe execution result:
  - synthetic smoke was attempted with explicit shadow-only flags
  - `calledCloudflare=false`
  - golden-case fixtures attempted shadow mode
  - provider transit skipped before external call
  - deterministic accepted output remained preserved
  - redaction compliance remained 7/7
  - no provider output was observed, trusted, accepted, stored raw, or used for side effects
- Updated readiness:
  - `ready_for_limited_shadow_expansion: false`
  - `ready_for_live_candidate_mode_design: false`
  - `ready_for_live_provider_calls: false`
  - `live_provider_calls_enabled: false`
  - `deterministic_default_preserved: true`
  - `cloudflare_adapter_live_enabled: false`
  - `shadow_provider_observed: false`

### 2026-05-11 Cloudflare AI Gateway Backend Shadow Config Setup

- Added the backend-only Cloudflare shadow configuration setup path for the internal Model Provider Gateway.
- New implementation:
  - `/Users/mark/Property_Analytics/apps/api/src/platform/model-gateway/cloudflare-shadow-config.ts`
  - `/Users/mark/Property_Analytics/apps/api/scripts/check_cloudflare_shadow_config.ts`
- New command:
  - `cd /Users/mark/Property_Analytics/apps/api && npm run model-gateway:check-cloudflare-shadow-config`
- New documentation:
  - `/Users/mark/Property_Analytics/docs/MODEL_PROVIDER_GATEWAY_CLOUDFLARE_SHADOW_CONFIG_SETUP_2026-05-10.md`
- The config checker reports sanitized readiness fields only:
  - deterministic accepted output preserved
  - live provider calls disabled
  - Cloudflare live accepted behavior disabled
  - shadow provider flags present
  - backend Cloudflare key names present or missing
  - raw payload storage, raw provider logging, and cache disabled
  - frontend provider exposure absent
- Smoke output now surfaces a sanitized `skipReason`, making fail-closed missing-config paths clearer without printing secrets.
- Boundary decision remains unchanged:
  - this setup prepares approved backend shadow observation only
  - live accepted provider calls remain disabled
  - provider output remains unable to drive Captain Runtime, Expert Reads, memory, routing, reports, publication, Data Pond mutation, or PIB/reporting coupling

### 2026-06-12 Data Warehouse Wrapper Durability Correction

- The governed Data Warehouse daily wrapper at `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh` was further hardened so recurring automation no longer depends on `~/Library/Logs/Venterra` being writable in every execution context.
- The wrapper now resolves a writable log directory across the governed home path, repo-local automation logs, and `/tmp`, then writes a PID-backed lock directory so concurrent-run detection is explicit and stale-lock recovery is distinguishable from live overlap.
- This closes a real diagnostic gap observed on 2026-06-12 where a constrained run could fail before Keeper readiness or warehouse connectivity and still emit the misleading skip message `Another run is already in progress`.
- Same-day verification completed the full seven-step governed harvest through Keeper/KSM and the warehouse connection, producing fresh output packets for:
  - daily harvest `2026-06-12_20260612_164324`
  - guest-card direct supply `2026-06-12_20260612_164329`
  - property operating metrics `2026-06-11_20260612_164331`
  - property metadata `2026-06-12_20260612_164334`
  - manual-source replacement audit `20260612_164334`
  - replacement review `20260612_164334`
  - Captain advisory `2026-06-12_20260612_164334`
- Governed posture remained intact: guest-card direct supply stayed `shadow_only` with `0` canonical upserts, unresolved property code `TX4EK` remained visible rather than patched around, the four operating-metrics exclusions remained explicit (`FL4CA`, `FL4P9`, `TX4FP`, `TX4PW`), and the Captain advisory still reported `trust_posture: unavailable` pending historical export reconciliation.

### 2026-06-16 Data Warehouse Human-Present VPN Automation Boundary

- The Data Warehouse daily wrapper remains the canonical seven-step harvest/replacement/Captain advisory path, but its recurring automation boundary changed after live AWS VPN Client SSO proof.
- Mark's desktop session successfully connected `VenterraVPN`, completed the browser SSO handoff, verified warehouse TCP reachability, ran `/Users/mark/Property_Analytics/run_data_warehouse_daily_shadow_harvest.sh`, disconnected the VPN, and then verified the warehouse endpoint was no longer reachable.
- The proof produced fresh governed packets:
  - daily harvest `2026-06-16_20260616_123534`
  - guest-card direct supply `2026-06-16_20260616_123538`
  - property operating metrics `2026-06-15_20260616_123541`
  - property metadata `2026-06-16_20260616_123544`
  - manual-source replacement audit `20260616_123544`
  - replacement review `20260616_123544`
  - Captain advisory `2026-06-16_20260616_123544`
- The prior unattended Codex cron automation `data-warehouse-daily-shadow-harvest` is paused so the warehouse lane no longer attempts unattended VPN/SSO operation.
- The active daily heartbeat `data-warehouse-harvest-check-in` now prompts Mark to confirm he is present in the logged-in desktop session and signed into AWS VPN SSO before Codex performs the connect-run-disconnect sequence.
- This keeps the Data Warehouse replacement lane separate from the larger daily collection/gather path while preserving Keeper/KSM-only credential resolution, the governed wrapper, shadow-only guest-card supply, and explicit degraded/advisory reporting for identity gaps or warehouse anomalies.

### 2026-06-24 GoDaddy Domains API Inventory Lane

- GoDaddy registrar/DNS inventory is now a read-only Data Collection source route for the platform launch domain workstream.
- Keeper/KSM auth is centralized in `/Users/mark/Property_Analytics/utils/godaddy_auth.py`, resolving the existing `GoDaddy API` Keeper record through the shared Python KSM helper without creating a local credential file or printing raw key/secret values.
- The collector lives at `/Users/mark/Property_Analytics/Data_Collection/collectors/godaddy_collector.py` and snapshots `GET /v1/domains`, `GET /v1/domains/{domain}`, and `GET /v1/domains/{domain}/records`.
- Canonical SQLite storage now includes `godaddy_domain_snapshots` and `godaddy_dns_records` through `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`; raw GoDaddy source JSON is preserved alongside normalized expiry/status/privacy/lock/renewal fields, DNS status, DNS type counts, and optional governed property identity matches.
- The first live snapshot on 2026-06-24 completed as data collection `2252`: `282` domains, `282` successes, `0` hard failures, `1,566` DNS records, and `6` governed property-identity matches.
- Source-limited DNS states are represented as source facts rather than collector failures: `221` domains returned DNS `200`, `11` returned DNS `403`, and `50` returned DNS `404` / no accessible GoDaddy zone file.
- Forwarding collection is now live. The existing `GoDaddy API` Keeper record includes custom field `customer_id`; `/Users/mark/Property_Analytics/utils/godaddy_auth.py` resolves it without printing raw values, and the collector derives the UUID-style customer id through the GoDaddy Shoppers API when the Keeper value is the numeric shopper/customer identifier.
- Forwarding storage now lives in `godaddy_forwarding_snapshots`. The first live forwarding snapshot on 2026-06-25 completed as data collection `2282`: `282` domains, `0` failures/source-limited domains, `283` forwarding rows stored, and `149` active forwarding records (`148` `PERMANENT_REDIRECT`, `1` `TEMPORARY_REDIRECT`, plus `134` no-forwarding source states).
- Mutating registrar/DNS/forwarding operations remain out of scope unless explicitly approved in a current task.

### 2026-07-13 WebOps Resources Hub And Cloudflare Access Boundary

- The static WebOps resources hub is live at `https://resources.venterradev.com/`, with the Cloudflare routing architecture explainer at `https://resources.venterradev.com/cloudflare-routing-architecture/`.
- Cloudflare Pages project `venterra-resources` serves the static artifact from `/Users/mark/Property_Analytics/output/venterradev-resources`.
- Cloudflare Access application `Venterra Resources` now protects `resources.venterradev.com/*`.
- Current interim identity posture uses the existing Cloudflare One email OTP identity provider and allows users with `venterraliving.com` or `venterra.com` email domains.
- Signed-out HTTP checks confirmed Cloudflare Access redirects for both the hub root and the direct architecture page.
- Target future posture is Microsoft Entra SSO for authenticated Venterra users once Entra is added to Cloudflare Access.

### 2026-07-16 Resi Portfolio Edge Analytics-On Topper Baseline

- Champions Green gated preview is now the analytics-on measured topper baseline: Worker `portfolio-resi-edge-prototype` version `c62969ca-6f6e-4e1e-88b8-ae897c2c32cd`, template/schema `2026-07-16.performance-topper-measured-preview-v10-analytics`.
- The delivery strategy remains split: exact-native is the visual calibration lane, while the measured topper is the high-score first-view architecture that avoids the native WordPress/YOOtheme payload.
- The active topper now restores the earlier event-recorder contract: duplicate-protected `page_view`, required CTA/promo/menu events, `dataLayer`, `__vtrEdgeQueue`, `__vtrTopperEvents`, and deferred Heap replay.
- Champions Green Zaraz was found to have auto-injection enabled but no tools. The zone now has preview-scoped Zaraz tools for GA4 (`G-N9YHM93HRV`) and delayed Heap (`286627304`), guarded to the gated preview so ungated production is not changed by the Heap tool.
- Browser proof confirms Zaraz presence and delayed Heap posture; PageSpeed proof with analytics on is mobile `98/98`, desktop `100/100`, TBT `0ms`.

### 2026-08-06 Calais Mobile Topper Production Correction

- Live Calais Midtown production verification found two launch-blocking issues in the mobile topper lane: a stale hard-coded special and an unapproved native continuation iframe path that could expose raw WordPress chrome or blank content after the hero.
- The active production Worker is now `calais-resi-edge-candidate` marker `2026-08-06.calais-mobile-topper-production-v7`, deployed through Keeper-backed Wrangler auth and followed by a Cloudflare homepage cache purge.
- The current mobile topper offer is `2 weeks free`; prior stale values `Up to 6 Weeks Free + No Admin Fee!` and `Up to 1 month free` were removed from the served mobile topper shell.
- Production mobile topper responses now use `cache-control: no-store` during launch stabilization.
- The native continuation mount was removed from the served production shell. The future portfolio pattern must either prove a rendered continuation with live browser evidence after scroll or use a different section-level extraction approach.
- Required gate reinforced for the portfolio process: every live Worker release must include public URL curl evidence, live browser screenshot evidence, stale-text checks, raw skip-link checks, and a rendered after-scroll check when continuation is present.
- Follow-up production rollback disabled the Calais mobile topper entirely because a hero-only mobile shell is not an acceptable production state. `EDGE_PRODUCTION_MOBILE_TOPPER_ENABLED=false` now restores full native mobile behavior while preserving preview for repair.
- Query-string/source-ID verification is now a release gate. `https://calaismidtownapartments.com/?id=TX4MIGOA&restore_verify=1` returned native content with no `x-vtr-calais-topper` header, no partial shell, native nav/main content present, and a full mobile document height.
- 2026-08-07 builder correction: mobile hero review proof is now a reusable template behavior, and desktop remains native unless separately approved. Template instances carry captured native hero title/review typography tokens, the runtime does not add a TM mark to the LBLE visual, and fractional ratings render as proportional star fills (`4.3` -> `86%`) instead of five solid stars. WebOps runtime smoke, visual harness, and `make validate` passed after the correction.
- 2026-08-07 Calais v16 live follow-up: deployed `calais-resi-edge-candidate` version `fb3d8ac0-72f7-4752-b147-df1d62153286` with marker `2026-08-07.calais-mobile-shell-preview-v16-review-rating`. Live mobile proof shows the sourced `/reviews/` hero row `(4) 258 Reviews`, schema aggregate rating `4`, proportional `--rating-percent:80%`, no horizontal overflow, no console errors, no failed requests, desktop native CSS preserved with no edge review row, and a passing live mobile-shell architecture validator. Governed benchmark/PSI after the live change scored mobile `98` and desktop `97`, with mobile TBT `0ms`. Evidence: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v16-review-rating/browser-proof.json`, `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v16-review-rating/mobile-shell-proof.json`, and `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/calais/live-production-v16-review-rating/benchmark/summary.md`.

### 08/09/2026 Resi Edge Gated Package Control, Superseded In Part 08/10/2026

- The Resi Edge migration/optimization workstream now has an explicit package runner, manifest schema, Pilot manifest, and deploy-adapter hard gate. This closes the process gap where prior work could be described as the package while omitting analytics, consent, source phone attribution, review/source proof, SEO/AI files, rollback, or evidence.
- The package runner is `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`; the deploy boundary is `/Users/mark/Property_Analytics/scripts/resi_edge_deploy_adapter.py`.
- Current 08/10/2026 state is intentionally blocked for live apply. Champions Green validates as protected base through the fresh manifest `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/championsgreen-ga-com.manifest.json`; the deploy adapter returns `supports_live_apply=false` because no separate apply target has been explicitly selected.
- This is the enforced operating model going forward: `plan` may gather baseline evidence and report missing gates; `apply` cannot mutate a live route, Worker, cache, WordPress, Zaraz, Ahrefs, or Captain state unless every gate passes. Failed gates stop the run for discussion rather than triggering alternate implementations.
- Current source hierarchy for the package was corrected on 08/12/2026: The Vine is the only golden mobile topper reference. TowneStone, Champions, Calais, District, Ventana, Pilot, and all other properties are normalization targets unless Mark explicitly promotes a new golden source. Pilot is not selected unless Mark names it as an apply target again; Calais remains failure/evidence input unless explicitly selected as a target.
- 08/10/2026 Ventana target preflight added `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/ventanaapts-com.manifest.json` and proved the desired package shape without live mutation. The plan resolved `TX4VE`, passed schema/static/source/identity/feed/review/font/content/phone/Ahrefs gates, and blocked apply on exactly three preflight gaps: Zaraz consent not configured, no fresh GSC indexing/status evidence file declared, and no fresh Captain/Data Pond handoff declared. Zaraz consent and analytics actions were dry-run only.
- 08/10/2026 Ventana blocker completion applied the approved Zaraz Consent configuration for `ventanaapts.com`, verified the post-apply audit, collected fresh GSC URL Inspection evidence for the homepage, and wrote a fresh Captain/Data Pond handoff. The updated Ventana plan now has no preflight failures and reports `apply_allowed:true`; however, live apply-only gates remain unrun, so this is still not a production Resi Edge deployment.
- 08/11/2026 Ventana live apply reached the production mutation path and demonstrated the rollback contract. The canonical package deployed and route/package health proved, but the first run rolled back after the mobile-shell validator flagged the package-owned Contentsquare verification suppression script as a native analytics blocker. The validator was corrected narrowly to allow only the signed same-origin guard and reference replay still passed for TowneStone and The Vine. A second apply passed the shell/browser/desktop/SEO/phone/content/consent/R2/cache gates, then rolled back at the analytics proof gate. The remaining blockers are package-level, not Ventana visual shell issues: GA4 realtime stream expectation must be property-aware (`Ventana` was observed instead of the hard-coded `Website`), Heap/Contentsquare must not wake during passive smoke, and Ahrefs must be observed by browser smoke after the existing-project `AHVE` Zaraz tool is applied. Ventana is currently rolled back to native WordPress; the Resi Edge Worker does not exist on the account after rollback.
- 08/12/2026 follow-up corrected the orchestration flaw that treated TowneStone as a second blocking reference even though it was not normalized to the Vine contract. The runner now replays The Vine only and then normalizes the selected target. Ventana was applied live through the governed runner and passed 54/54 gates with mobile PSI `98`, desktop native PSI `95`, compact consent proof, Zaraz analytics proof, no desktop topper, and final evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260813T014406Z/evidence-packet.json`.
- 08/13/2026 Townestone at 359 proved the lease-up tagline extension without changing the mobile shell structure. The package now has two governed hero title modes: default shared LBLE SVG and explicit property tagline SVG. Lease-up SVGs are generated as same-origin path assets during the asset stage, uploaded through R2, rendered in the existing `.hero-title-art` slot, and checked by manifest-derived browser geometry gates. The first visual proof caught clipping that the JSON gates had allowed; the runner was tightened before final acceptance.
- 08/13/2026 follow-up corrected the shared mobile hero height contract after visual proof showed fixed-height drift. The runtime now uses viewport-derived hero height below promo/header instead of a hard-coded `704px`; static validation blocks fixed-height regression; browser acceptance measures live promo/header/hero geometry and fails if the first mobile viewport is not fully occupied by the hero. Final Townestone canary apply passed live gates with mobile PSI `100`, desktop native PSI `96`, and evidence packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/townestoneat359-com/apply-20260814T000535Z/evidence-packet.json`.
- 08/13/2026 full-height runtime promotion completed on the active live targets Townestone, Champions Green, and Ventana through the same governed package path. Champions evidence packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/championsgreen-ga-com/apply-20260814T010126Z/evidence-packet.json`; Ventana evidence packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/ventanaapts-com/apply-20260814T010840Z/evidence-packet.json`. Both passed 54/54 gates with no rollback and mobile PSI `100`; full-height browser geometry measured `topDelta: 0` and `bottomDelta: 0` on all three targets. The Vine was not mutated because it remains the protected golden reference unless Mark explicitly approves level-setting that reference.
- 08/14/2026 The Vine Kyle Parkway was explicitly level-set after Mark approved using it as a lease-up target. The package retained the canonical Worker/runtime and changed only manifest data to render the lease-up tagline as one same-origin property SVG line, `Live Better. Live Easy.`, in the existing `.hero-title-art` slot. The live apply passed 54/54 gates with no rollback, mobile PSI `100`, desktop native PSI `96`, compact consent proof, analytics proof, full-height first viewport, and no desktop mobile-shell marker. Evidence packet: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T173240Z/evidence-packet.json`.
- 08/14/2026 The Vine follow-up hardened two visual/data boundaries exposed by live review. First, path-backed lease-up tagline SVGs now support manifest `title_svg_viewbox_bleed` so script flourishes cannot disappear at the artboard edge; this fixed the Vine one-line `Live Better. Live Easy.` SVG without hand-positioning. Second, internal source-phone attribution labels such as `VWS` are forbidden in customer-facing drawer UI; the shared runtime removed the visible source label and the mobile-shell validator now fails `.drawer-source` or visible internal attribution labels. Current proof: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T210324Z/evidence-packet.json`, with targeted drawer proof `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260814T210324Z/browser-proof/mobile-drawer-open-no-vws.json`.
- 08/14/2026 Calais Midtown exposed a required WordPress control-path boundary for the edge package. Public-page optimization may strip cookies and clean native HTML, but `/wp-login.php`, `/wp-admin`, `/wp-json`, XML-RPC, cron/comment endpoints, and non-`GET`/`HEAD` requests must transparently pass to origin. The Calais legacy Worker was corrected to preserve WordPress `Set-Cookie` and redirect behavior, and the canonical Resi Edge Worker plus launch runbook now make this a required rollout proof.
- 08/15/2026 the portfolio launch prep lane gained a non-mutating Phase 2 preflight queue builder at `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_preflight.py`. It reads the vanity rollout workbook, QA Pastel/Kinsta staging document, governed property identity matrix, current Resi Edge contract, manifest inventory, and read-only Keeper-backed Cloudflare zone inventory, then writes JSON/CSV/Markdown readiness packets without changing Cloudflare, DNS, WordPress, Zaraz, Ahrefs, GSC, Captain, Data Pond, R2, cache, or live domains. The first packet for the 08/19/2026 Phase 2 batch is `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T164031Z/`: `20` properties, `20/20` Kinsta staging URLs HTTP `200`, `1` `source_ready`, `12` `source_ready_manifest_needed`, `1` `needs_decision`, and `6` blocked by missing Cloudflare zone evidence.
- 08/15/2026 Phase 2 preflight manifest discovery was corrected after raw text matching over-credited Canton Mill Lofts from an unrelated Calais warning that mentions `GA4CM`. The preflight now parses active manifest JSON and only counts target/routing/property-code matches. Corrected packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T171327Z/` reports `0` blocked, `0` needs-decision, `0` source-ready, and `20` source-ready-manifest-needed.
- 08/15/2026 the launch prep lane gained `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_manifest_prep.py`, which writes report-scoped draft manifests only. Packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T171230Z/` wrote `20` drafts using governed identity, rollout/Kinsta staging rows, GA4 landscape measurement IDs, source-phone lookup rows, Cloudflare zone inventory, and the current contract. All drafts still contain `required_before_apply` fields for source/evidence gaps and are not promote-ready. No active manifest directory, Cloudflare, DNS, WordPress, Zaraz, Ahrefs, GSC, Captain, Data Pond, R2, cache, or live-domain mutation was performed.
- 08/15/2026 the launch prep lane gained `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_analytics_profile_plan.py`, a non-mutating GA4/Ahrefs migration capability planner. Packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260815T173508Z/` confirmed all `20` Phase 2 GA4 web streams can be patched programmatically to the vanity URLs after explicit approval, and all `20` matching Ahrefs source projects exist with Web Analytics data-key presence. Ahrefs existing-project target URL retargeting remains a decision/manual-or-approved-new-project lane because the public update-project endpoint does not document target URL mutation. No GA4, Ahrefs, Zaraz, Cloudflare, DNS, WordPress, R2, GSC, Captain, Data Pond, cache, or live-domain mutation was performed.
- 08/15/2026 added `/Users/mark/Property_Analytics/scripts/ahrefs_project_target_update.py` and ran a guarded one-project Ahrefs target-update canary after Mark asked to try the UI-visible URL update path. Zang Triangle (`project_id: 10125850`) dry-run proposed moving from `venterraliving.com/apartments/zang-triangle/`, `https`, `prefix` to `zangtriangle.com/`, `both`, `subdomains`. The approved apply returned HTTP `200`, but Ahrefs response and readback remained unchanged, so `target_update_proven:false`. Evidence is preserved at `/Users/mark/Property_Analytics/reports/ahrefs_admin/target_updates/ahrefs-target-update-10125850-20260815T174150Z/ahrefs_target_update_evidence.json`; no alternate payload attempts should continue without a fresh decision.
- 08/15/2026 analytics profile planning policy was updated after Mark confirmed GA4/Heap preserve historical analytics and the pilots already have new Ahrefs profiles. The launch path now plans to patch existing GA4 web-stream default URIs to vanity URLs after approval, create/reuse Ahrefs vanity-domain projects for launch/current authority, and retain old Venterra-path Ahrefs projects as legacy history. Current non-mutating packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260815T175542Z/` reports `20/20` GA4 patch-ready, `20/20` Ahrefs vanity projects planned, `20/20` legacy source projects found, and `0` needs-decision/blockers. Manifest prep rerun `/Users/mark/Property_Analytics/reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T175534Z/` updates the draft profile policy. No provider or live-domain mutation was performed.

### 08/17/2026 Resi Edge Launch Dashboard Company Magic-Link Boundary

- The Phase 0 Resi Edge launch dashboard remains a proof/readout surface inside the governed Data Pond UI, live at `https://launch.venterrawebops.com/`.
- The security posture is company-only magic link. The launch environment sets `NEXT_PUBLIC_AUTH_PRIMARY=magic`, while the API enforces `MAGIC_LINK_ALLOWED_DOMAINS=venterraliving.com,venterra.com`, `MAGIC_LINK_AUTO_PROVISION_ENABLED=true`, `MAGIC_LINK_AUTO_PROVISION_PATH_PREFIXES=/resi-edge/launch`, and `MAGIC_LINK_DEFAULT_ROLE=viewer`.
- Allowed company-domain users can be auto-provisioned as viewers only for read-only launch proof access. In magic-primary launch-host mode, sidebar/navigation and protected path access are limited to `/resi-edge/launch`, so broad company access does not expose the general viewer-level Pond, Watchtower, Dock, Fishing Hole, or Pilot Tracker surfaces. Non-company domains and non-launch auto-provision attempts receive a generic non-enumerating response but no user and no magic token.
- The `resiEdgeLaunch` surface is now viewer-visible; decision and administer actions remain admin-only. This keeps the dashboard useful for a broad internal audience without exposing deploy, launch, provider, DNS, Cloudflare, Worker, WordPress, Zaraz, GA4, Ahrefs, R2, cache, or live-domain mutation paths.
- Validation on 08/17/2026: the web production build passed, API typecheck passed after adding conservative fallback Pond manifest JSONs for the previously missing imports, targeted auth hardening tests passed `8/8`, and Playwright proved `/` plus `/resi-edge/launch` land on magic-link login without Cloudflare Access bootstrap.
### 08/18/2026 Resi Edge Wednesday Preapproval Evidence Lane

- The Wednesday launch approval process now has a non-mutating evidence packet builder at `/Users/mark/Property_Analytics/scripts/build_resi_edge_wednesday_preapproval_packets.py`.
- Packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/wednesday-preapproval/wednesday-preapproval-20260818T172525Z/` synthesizes the 20-property source/property review queue, Data Pond GSC visibility baseline, rollback/recovery snapshot, and Wednesday approval packet without changing any live domain, provider, Worker, cache, or analytics state.
- Current preapproval finding: Google visibility is credibly captured for current Venterra URLs (`20/20` baseline rows and `20/20` current URL Inspection pass/indexed posture), while source/property final signoff remains open for `20/20` and new vanity domains have no prelaunch GSC history/inspection rows yet.
- The performance baseline queue now has a governed runner at `/Users/mark/Property_Analytics/scripts/run_resi_edge_performance_baseline_queue.py`, reading the existing 80-measurement queue and writing one results packet.
- First PSI baseline attempt `/Users/mark/Property_Analytics/reports/resi_edge_performance/performance-baselines/performance-baseline-20260818T172533Z/` stopped correctly at measurement `2/80` because Google PSI/Lighthouse returned HTTP `500` for Anatole at Norman current Venterra page desktop. The stop packet and raw failed response are preserved; do not continue the PSI baseline without Mark's review/approval.
- Mark clarified that final vanity PSI belongs after switch because the vanity domains currently redirect to the legacy experience. The baseline queue builder now defaults to pre-switch legacy Venterra URL plus staging Kinsta URL only (`80` measurements), and final vanity URL PSI requires explicit `--include-final-vanity` for a post-switch/full queue.
- Corrected pre-switch PSI capture `/Users/mark/Property_Analytics/reports/resi_edge_performance/performance-baselines/performance-baseline-20260818T174349Z/` stopped at measurement `1/80` after three PSI attempts for Anatole at Norman legacy mobile returned Lighthouse HTTP `500`; direct page header check returned HTTP `200`, so the stop is a PSI/Lighthouse capture failure rather than a page availability failure.
- Mark's PageSpeed UI proof showed the URL could complete; a one-item Keeper-backed API canary reproduced OK4AN legacy mobile score `63`. The full corrected pre-switch PSI run then completed at `/Users/mark/Property_Analytics/reports/resi_edge_performance/performance-baselines/performance-baseline-20260818T175339Z/` with `80/80` successful measurements and no failures.
- The launch dashboard snapshot generated at `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-snapshot/launch-dashboard-snapshot-20260818T183143Z/` includes per-property initial PSI cards for legacy Venterra URL, staging Kinsta URL, and final vanity URL. Final vanity is intentionally marked held until switch.
- The dashboard drawer was then simplified into a single movement/performance row: legacy Venterra URL with mobile/desktop score, live Kinsta staging URL with mobile/desktop score, and vanity domain marked `Dead Until Live`. This keeps the executive view focused on the actual launch progression rather than separate technical cards.

### 08/19/2026 Portfolio Kinsta DNS Switch Prep Lane

- The 20-property Kinsta DNS switch now has a guarded Cloudflare preparation lane at `/Users/mark/Property_Analytics/scripts/domain_ops/build_kinsta_dns_switch_prep.py` and `/Users/mark/Property_Analytics/scripts/domain_ops/apply_kinsta_dns_switch.py`.
- The prep builder ingests `/Users/mark/Downloads/venterra-kinsta-cname-records.csv` as source data, validates `@` and `www` Kinsta CNAME targets, resolves Cloudflare credentials through Keeper-backed helpers, and snapshots zone/DNS/SSL/forwarding posture without mutation.
- Updated prep packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_142621_kinsta_dns_switch_prep/` reports all `20` zones active, SSL mode `full`, Universal SSL not disabled, `50` planned DNS deletes, `40` planned Kinsta CNAME adds, and `0` preserve/review records after Mark confirmed no email is needed on these vanity domains.
- The same packet found `20` active Cloudflare dynamic redirect rules across `10` vanity domains. These rules currently forward apex/www vanity traffic back to legacy Venterra pages and must be removed or disabled as part of the switch; otherwise Kinsta CNAMEs can be correct while visitors still land on the legacy URLs.
- The apply runner defaults to dry-run and requires explicit `--apply` before any Cloudflare mutation. Forwarding cleanup is separately guarded by `--delete-forwarding-rules`, and only reviewed dynamic redirect rules from the packet are eligible.
- Dry-run packet `/Users/mark/Property_Analytics/reports/domain_ops/20260819_143000_kinsta_dns_switch_apply/` confirmed the combined launch plan: remove `20` reviewed forwarding rules, delete `50` reviewed DNS conflicts, add `40` proxied Kinsta CNAMEs, keep Universal SSL engaged, then QA apex/www before downstream attribution and legacy forwarding work.

### 08/19/2026 Portfolio Indexing Viability Lane

- The launch prep process now has a non-mutating indexing viability packet builder at `/Users/mark/Property_Analytics/scripts/build_resi_edge_indexing_viability.py`.
- The builder checks current legacy URLs and Kinsta staging URLs from the latest Phase 2 preflight packet, holds final vanity URLs until switch by default, and records canonical, meta robots, `X-Robots-Tag`, nofollow, robots.txt, HTTP status, and title evidence.
- Packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/indexing-viability/20260819_144122_indexing_viability/` found current legacy URLs indexable/pass for `20/20` and robots.txt not blocking Googlebot/all agents.
- The same packet found Kinsta staging URLs HTTP `200` but `20/20` returned `X-Robots-Tag: noindex, nofollow, nosnippet, noarchive`. This is likely intentional prelaunch protection, but it must be removed or disabled before/at go-live and proven on the final vanity URLs after DNS/forwarding switch.
- Dashboard/status language should treat indexing as yellow/open until the final vanity domains prove index/follow posture and expected canonical behavior after launch.

### 08/19/2026 Launch Dashboard Progression Revision

- The protected launch dashboard UI at `/resi-edge/launch` now presents the 20-property launch as a progressive readiness board rather than a dense metric dump. The first viewport shows command KPIs, Kinsta benchmark averages, and the actual launch flow: Domain Control, Staging Reachable, Old Forwarding, Indexing Release, DNS Switch, and Live Verification.
- Per-property drawers now start with the same progression model, including whether old vanity forwarding must be removed for that property, whether indexing release is still waiting on Resi, and whether DNS/live QA are still post-approval/post-switch.
- The dashboard still has no deploy, DNS, Cloudflare, WordPress, Zaraz, Ahrefs, GA4, R2, cache, Kinsta, or live-domain mutation controls. It remains a read-only proof/status surface.
- Validation on 08/19/2026: `/Users/mark/Property_Analytics/apps/web` production build passed; Playwright local render proof with mocked viewer auth confirmed the new top progression, benchmark readiness, and `20` per-property progression panels. Screenshots are `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-progress-local-auth-v2.png` and `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-progress-local-drawer-v2.png`.
- After Mark approved the dashboard refresh, the static dashboard-only build was deployed to Cloudflare Pages project `resi-edge-launch` as `https://47097bc2.resi-edge-launch.pages.dev` behind `https://launch.venterrawebops.com/`, using same-origin launch auth configuration.
- Live validation on `https://launch.venterrawebops.com/resi-edge/launch` passed with mocked viewer auth: the hosted page contains `Launch Progression`, `Benchmark Readiness`, `Work Ahead`, and `20` `Property Progression` rows, and no longer contains the stale `Open Items` label. Screenshot: `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-progress-live-20260819.png`.
- The refresh was dashboard-only: no property DNS, forwarding, Worker, WordPress/admin path, Zaraz, GA4, Ahrefs, R2, cache, Kinsta, or property live-domain mutation was performed.
- The `anatoleatnorman.com` canary changed the launch sequence model from a single DNS proof to a paired handoff: WebOps points vanity DNS/removes forwarding, Resi/Blue Team sets the vanity hostname as primary in Kinsta/WordPress and updates related public/canonical/source URLs, then WebOps validates that root and `www` hold the vanity hostname. The observed vanity-to-`*.kinsta.cloud` `301` is the expected pre-primary state, not an indexing or Kinsta reachability failure.
- Follow-up dashboard deployment `https://31a6dd3b.resi-edge-launch.pages.dev` now shows Anatole as `DNS Pointed, Handoff Pending`, portfolio `DNS Pointed` as `1/20`, and primary-domain handoff pending. Live proof screenshot: `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-anatole-31a6dd3b-live-20260819.png`.
- The full remaining `19`-domain DNS/forwarding run then completed in `/Users/mark/Property_Analytics/reports/domain_ops/20260819_160112_kinsta_dns_switch_apply/` with `38` Kinsta CNAME adds, `48` conflicting DNS deletes, and `18` forwarding-rule deletes. Full readback checked root and `www` for all `20` domains and classified `40/40` host checks as `primary_domain_pending`, with no edge/origin error, SSL failure, or `403` review classifications.
- Dashboard deployment `https://25236727.resi-edge-launch.pages.dev` now shows the live launch room as `20/20` DNS pointed with `20` primary-domain handoffs open and every property in `DNS Pointed, Handoff Pending` state. Live proof screenshot: `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-full-dns-25236727-live-20260819.png`.
- Post-primary readback `/Users/mark/Property_Analytics/reports/domain_ops/20260819_162654_post_primary_readback/` confirmed the cohort moved out of handoff state: all `40/40` root/`www` host checks hold vanity domains, all `20/20` root pages report vanity canonicals, and all `20/20` root pages report `index, follow`. The only open root-readback issue is Axial's title placeholder `[*PROPERTY NAME*]`.
- Dashboard deployment `https://39bf5b7d.resi-edge-launch.pages.dev` now shows `19` properties as `Live Vanity Verified` and Axial as `Live, Content Fix Open`. Live proof screenshot: `/Users/mark/Property_Analytics/reports/resi_edge_performance/launch-dashboard-post-primary-39bf5b7d-live-20260819.png`.

### 08/19/2026 Launch Dashboard Magic-Link Host Stabilization

- `launch.venterrawebops.com` now runs the launch room as a magic-link-only host. Runtime client auth, path permissions, and API base resolution explicitly recognize the launch hostname.
- The static web bundle no longer needs to send launch users through `api.venterradev.com` or Cloudflare Access bootstrap. On the launch host, API calls resolve to same-origin `/v1`, allowing the API Worker to issue `pop_session` under `.venterrawebops.com`.
- Dashboard-only deployment `https://986be4cf.resi-edge-launch.pages.dev` published this fix. Live checks confirmed `/login` and `/resi-edge/launch` return HTTP `200`, `/v1/auth/me` on the launch domain reaches the API Worker and returns expected `401`, and a clean browser shows the Magic Link form without a Cloudflare Access redirect.

### 08/19/2026 Axial Title Fix Dashboard Closeout

- Axial Buckhead live readback confirmed the corrected title `Axial Buckhead`, apex HTTP `200`, vanity canonical, `index, follow`, no `X-Robots-Tag`, no `[*PROPERTY NAME*]` placeholder, and clean `www` to apex redirect.
- Dashboard-only deployment `https://401e5517.resi-edge-launch.pages.dev` updated the launch room to show `20 green, 0 yellow, 0 red` and `0 content fixes`. Browser proof with mocked viewer auth confirmed the stale `19 green, 1 yellow` and Axial-placeholder language is absent from the live dashboard.

### 08/19/2026 Legacy Redirect Import Dashboard Closeout

- Mark confirmed legacy redirects are active for the first 20-property launch: base, `/reviews/`, and `/gallery/` for each property, `60` redirects total.
- Dashboard-only deployment `https://a37c12dd.resi-edge-launch.pages.dev` updated the protected launch room to show `Public Moves 20/20`, `Redirects active`, and `60 redirects active`. Browser proof confirmed stale `Redirects held` language is absent on the updated deployment and cache-busted custom host.

### 08/20/2026 Calais Current-Package Pilot Closeout And Zaraz Cleanup Guard

- Calais Midtown (`TX4MI`, `calaismidtownapartments.com`) is now live on the canonical Resi Edge package. Final apply packet `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/calaismidtownapartments-com/apply-20260820T190514Z/` passed `55/55` required gates with no rollback, mobile PSI `100`, desktop native passthrough PSI recorded at `81`, GA4/Zaraz smoke, Heap/Contentsquare interaction-only proof, Ahrefs proof, WordPress control-path bypass, consent proof, R2/cache/SEO/source-phone proof, and Captain/Data Pond evidence.
- The final blocker was caused by superseded managed Calais Zaraz tools (`GA4C`, `HCal`, `RBCa`) still present on the zone beside the current Calais Midtown tools. The page loaded Heap after interaction, but the older Heap delay marker surfaced first and made the smoke proof report `loaded:false`.
- `/Users/mark/Property_Analytics/scripts/apply_resi_zaraz_analytics_package.py` now preserves unrelated/manual Zaraz tools while retiring superseded managed Resi Edge GA4, Heap, Resi bridge, and Ahrefs Web Analytics tools before current manifest-owned upserts. Cleanup evidence is `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/calaismidtownapartments-com/manual-zaraz-cleanup-apply-20260820T190402.json`; post-cleanup analytics smoke passed at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/calaismidtownapartments-com/manual-live-analytics-smoke-after-zaraz-cleanup-20260820T190425.json`.
- Calais also hardened the shared runtime/runner/static validator: award assets can be read from `src` as well as `url`, manifests must declare renderable award assets, safe same-origin YooTheme upload-thumbnail cache misses are repaired from the `wp-content/uploads/...` source parameter, and the Calais manifest shell payload was trimmed below the mobile byte budget.

### 08/20/2026 Resi Edge Analytics Proof And Existing-Worker Rollback Addendum

- The Vine latest-version apply exposed two system-shape issues now folded back into the governed package: a standalone native `window.HEAP_JS_DEBUG = true;` flag was incorrectly counted as a direct analytics loader, and failed-gate rollback assumed a per-domain canonical Worker name even when the manifest intentionally reused an existing Worker script.
- `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs` now treats standalone Heap debug environment flags as allowed environment preservation while still blocking direct native analytics loaders. Static validation now enforces this distinction.
- `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py` now reads the generated `wrangler.toml` worker name for rollback evidence and blocks automatic delete rollback for existing Worker scripts. This prevents unsafe deletion of shared scripts such as `edge-message-worker` or `townestone-native-optimizer`.
- The refined live shell proof for The Vine passed at `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/repair-20260820T225702Z/mobile-shell-proof-refined.json`. A subsequent governed retry stopped before deploy on Resi Website Management Firewall HTTP `403` source audit evidence in `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-09-2026/thevinekyle-com/apply-20260820T225948Z/`.
