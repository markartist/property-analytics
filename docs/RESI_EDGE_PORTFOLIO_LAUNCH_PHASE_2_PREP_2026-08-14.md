# Resi Edge Portfolio Launch Phase 2 Prep

Status: Planning and non-mutating preparation
Date: 08/14/2026
Owner: WebOps

## Baseline

Current committed baseline:

- Commit: `a0954c1 chore: close Resi Edge launch package`
- Branch: `codex/pilot-control-cwv-reporting`
- Active package: `resi-edge-canonical-upgrade-package`
- Active release token: `2026-08-13.townestone-promo-bar-v2`

This phase does not approve live deploys, live route changes, WordPress changes, Zaraz changes, Ahrefs project changes, GSC/Captain/Data Pond writes, DNS changes, or cache purges. Those actions require explicit approval before execution.

## Formal Worker And Cache Policy

The canonical Worker policy is path-class based:

| Path class | Examples | Worker behavior | Cache behavior | Proof requirement |
| --- | --- | --- | --- | --- |
| Edge internal routes | `/__resi-edge/health`, same-origin Resi Edge assets, `llms.txt`, Contentsquare verify suppression | May be served by the canonical Worker/runtime before WordPress control bypass | Assets may use immutable cache; `llms.txt` may use short public cache; suppression may use short public cache | Static validation and live package health/readback during apply |
| WordPress control paths | `/wp-login.php`, `/wp-admin`, `/wp-admin/*`, `/wp-json`, `/wp-json/*`, `/xmlrpc.php`, `/wp-cron.php`, `/wp-comments-post.php` | Transparent origin pass-through only; no shell, no cleanup, no analytics injection, no cookie stripping, no redirect following | No Cloudflare cache mutation: `cf: { cacheEverything: false, cacheTtl: 0 }`; cache hit is a failed proof | `wordpress_test_cookie`, native admin redirect, native JSON, no edge markers |
| Non-`GET`/`HEAD` requests | Any protected postback, form, API, admin request | Transparent origin pass-through unless a current-task exception is explicitly approved and proved | No Cloudflare cache mutation | Treated as protected control behavior |
| Mobile public homepage | Clean mobile homepage request | Canonical mobile shell only; one shared runtime; property manifest data only | Response is `no-store`; optimized assets are same-origin/R2 immutable | Mobile browser proof, source phone proof, R2 readback, PSI |
| Desktop public homepage | Clean desktop homepage request | Native passthrough with surgical analytics/identity cleanup only; no desktop topper or desktop shell | Preserve native behavior except explicit analytics/identity cleanup; no generated desktop assets | Desktop native/no-topper browser proof and desktop PSI recorded |
| Native continuation | `__resi_edge_native_continuation=1` | Lazy native continuation with shell-owned section dedupe and analytics cleanup | `private, no-store`; origin fetch bypasses cache mutation | Continuation blocks present and dedupe proof |

Ordering rule: WordPress control-path bypass must run before homepage shell routing, native continuation rendering, desktop native cleanup, analytics cleanup, `Set-Cookie` deletion, and cache rewrites. It may run after internal edge-only routes such as health, same-origin package assets, `llms.txt`, and Contentsquare verify suppression.

## Gate Coverage Confirmation

Non-mutating validation on 08/14/2026 confirmed:

- `python3 scripts/validate_resi_edge_release_control.py` passed.
- `python3 scripts/check_resi_edge_gate_coverage.py` passed with `52` current required gates represented.
- Static package validation passed for Townestone, Champions Green, Ventana, The Vine Kyle Parkway, and The District Universal Boulevard.
- `bash scripts/check_pib_guardrails.sh` passed.

Coverage status:

| Required area | Coverage owner | Status |
| --- | --- | --- |
| Worker routing | Canonical Worker, route probe, package health gate | Covered |
| Cache behavior | WordPress bypass proof, R2 readback, cache purge gate, runtime cache headers | Covered |
| Admin/control bypass | `wordpress_control_path_bypass_proven` | Covered in current runner; older packets lack this proof |
| Zaraz analytics ownership | Stage analytics package gate and live analytics smoke | Covered |
| Consent | Shared consent contract, Zaraz consent audit, browser consent proof | Covered |
| Source attribution | Manifest/source lookup, source-coded phone proof, browser source-coded mobile proof | Covered |
| R2 assets | Asset generation/upload, same-origin R2 readback, immutable metadata check | Covered |
| Mobile shell visual proof | Mobile shell validator and Playwright browser acceptance | Covered |
| PSI | Mobile reference parity and desktop native recorded gates | Covered |
| Ahrefs legacy profile handling | Lookup-first stage/apply evidence and existing project gate | Covered |
| GSC/Captain/Data Pond evidence | Preflight gates `gsc_indexing_recorded` and `captain_data_pond_updated` | Covered |
| Rollback | Rollback plan and post-deploy rollback-on-failure paths | Covered |
| Batch readout | Cohort readout builder now checks current contract gates before marking ready | Covered after 08/14/2026 hardening |

## Readout Hardening

`scripts/build_resi_edge_cohort_readout.py` now compares every evidence ledger against the current contract before marking a property ready. This prevents older `54/54` packets from appearing batch-current when they are missing newly added gates.

Non-mutating readout generated on 08/14/2026:

- Markdown: `reports/resi_edge_performance/cohort-readouts/resi-edge-cohort-readout-20260814T234845Z.md`
- JSON: `reports/resi_edge_performance/cohort-readouts/resi-edge-cohort-readout-20260814T234845Z.json`
- Result: `0` ready, `4` needs attention.

The four current live pilot properties remain historically proven on their prior packets, but they are not current-contract batch-ready until fresh evidence includes `wordpress_control_path_bypass_proven`.

## Rollout Decision

Decision: keep the portfolio launch capped at the pilot set until fresh current-contract evidence exists for the active pilot cohort.

The next live phase, when explicitly approved, should run in this order:

1. Townestone at 359: canary refresh for the current token and WordPress control-path gate.
2. Champions Green: mature-property proof after canary refresh passes.
3. Ventana: no-active-promo/proven high-PSI proof after Champions passes.
4. The Vine Kyle Parkway: lease-up/SVG/no-review proof after Ventana passes.

Do not use old Champions or Calais experiments as implementation sources. Calais remains a control-path lesson source only unless explicitly selected for a future governed run.

After all four pilot refresh packets pass the current contract, the next planned non-live candidate remains The District Universal Boulevard. Its current status is `planned_not_live`; it should receive non-mutating plan/preflight review first, then stage/apply only after explicit approval.

Batch rollout remains `20` properties every `2` weeks after:

- the refreshed pilot cohort passes current-contract readout,
- a batch manifest queue exists,
- a non-mutating batch preflight reports blockers by property,
- Ahrefs legacy/new-domain profile decisions are documented,
- GSC/Captain/Data Pond evidence is present,
- R2 asset plans are ready,
- source specials/reviews/awards/phones are resolved,
- rollback targets are established.

## Phase 2 Current Prep State

Updated on 08/15/2026:

- Corrected Phase 2 preflight packet: `reports/resi_edge_performance/phase2-preflight/phase-2-preflight-20260815T171327Z/`.
- Current Phase 2 board: `20` total, `0` blocked, `0` needs-decision, `0` source-ready, and `20` source-ready-manifest-needed.
- Manifest discovery now parses active manifest JSON instead of raw text, preventing false source-ready matches such as the Canton Mill / Calais `GA4CM` warning collision.
- Manifest prep packet: `reports/resi_edge_performance/phase2-manifest-prep/phase-2-manifest-prep-20260815T175534Z/`.
- Manifest prep result: `20` report-scoped draft manifests written, `0` active manifest matches, `0` promote-ready manifests, `20/20` GA4 measurement IDs present, and `20/20` governed source-phone rows present.
- Draft manifests are not active launch manifests. They remain blocked by `required_before_apply` fields for staging source audit, hero/content/source images, brand/theme tokens, reviews, awards, specials, Ahrefs profile lookup, GSC URL Inspection, Captain/Data Pond handoff, rollback snapshot, and stage/live proof placeholders.
- Analytics profile plan packet: `reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260815T175542Z/`.
- GA4 result: `20/20` existing GA4 web data streams were found and are programmatically patch-ready for a future approved default URI update from the current Venterra apartment URL to the vanity domain. No GA4 mutation has been performed.
- Ahrefs result: `20/20` new vanity-domain projects are planned because no Phase 2 vanity projects currently exist in the Ahrefs roster, and `20/20` legacy Venterra-path source projects were found for historical readback. The launch path is create/reuse vanity-domain project first, retain old source-path project for history, and do not retarget the old project. No Ahrefs mutation has been performed.
- Ahrefs URL-update canary: after Mark asked to try the UI-visible edit path, guarded CLI apply on Zang Triangle (`project_id: 10125850`) returned HTTP `200` but readback did not change from `venterraliving.com/apartments/zang-triangle/`, `https`, `prefix` to `zangtriangle.com/`, `both`, `subdomains`. Evidence: `reports/ahrefs_admin/target_updates/ahrefs-target-update-10125850-20260815T174150Z/ahrefs_target_update_evidence.json`. Status remains `target_update_proven:false`; stop before alternate payload attempts.
- Ahrefs housekeeping plan: `/Users/mark/Property_Analytics/scripts/build_ahrefs_legacy_folder_plan.py` now prepares the legacy-folder queue from the Phase 2 analytics plan. Dry-run packet `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T180425Z/` found all `20` legacy projects, `0` blockers, and `20` rows waiting on the manually created Ahrefs Legacy folder ID. Canary dry run `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T180433Z/` proved `--only-project-id` filtering. No Ahrefs mutation has been performed. Future movement requires `--apply --confirm MOVE_AHREFS_LEGACY_PROJECTS` plus the Ahrefs folder ID or folder URL and stops on the first failed readback; use `--only-project-id` for a one-project canary before any bulk move.
- Ahrefs Legacy folder ID `32616` is now known. Folder-ID dry run `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T200829Z/` planned `20/20` moves with `0` blockers, and canary dry run `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T200839Z/` planned Anatole at Norman (`10125566`) only. No Ahrefs mutation has been performed.
- Ahrefs canary apply: after Mark approved proceeding with the canary, packet `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T201848Z/` moved Anatole at Norman (`10125566`) into folder `32616` and readback proved folder `Legacy`, `move_proven:true`, HTTP `200`. Refreshed full dry run `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T201903Z/` reports `1` already in Legacy, `19` planned moves, and `0` blockers. No bulk move has been performed.
- Ahrefs legacy folder complete: after Mark approved the bulk move, packet `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T205455Z/` moved the remaining `19` legacy projects into folder `32616`; all apply results read back `move_proven:true` with no failures. Final dry-run readback `reports/ahrefs_admin/legacy_folder/ahrefs-legacy-folder-plan-20260815T205630Z/` reports `20` already in Legacy, `0` planned moves, and `0` blockers.
- Ahrefs vanity project creation: `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_ahrefs_vanity_project_plan.py` now scopes creation to the Phase 2 analytics packet and masks raw Ahrefs Web Analytics data keys. Dry-run packet `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233416Z/` planned `20` vanity creates with `0` blockers. Canary apply `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233429Z/` created Anatole at Norman (`OK4AN`) vanity project `10240452` with `create_proven:true`.
- Ahrefs vanity project stop: bulk apply `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233545Z/` created `17` additional vanity projects and stopped on Balmoral Village (`GA4BV`) with Ahrefs HTTP `403`, response `Projects limit reached`. The Whitney (`GA4TW`) was not attempted after the stop. Final read-only packet `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T233835Z/` reports `18` existing vanity projects, `2` planned creates (`GA4BV`, `GA4TW`), and `0` duplicate blockers. Do not continue this lane until the Ahrefs project-limit decision is resolved.
- Ahrefs capacity test and vanity completion: after Mark clarified legacy projects should be purged to clear capacity, `/Users/mark/Property_Analytics/scripts/build_ahrefs_legacy_project_purge_plan.py` was added as the guarded Legacy-folder deletion lane. Capacity-test apply `reports/ahrefs_admin/legacy_project_purge/ahrefs-legacy-project-purge-20260815T234619Z/` deleted two Legacy-folder projects (`10125566`, `10125770`) with HTTP `200` and `delete_proven:true`. Remaining-create apply `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T234658Z/` created Balmoral Village (`GA4BV`) vanity project `10240483` and The Whitney (`GA4TW`) vanity project `10240484`, both with `create_proven:true`. Final vanity readback `reports/ahrefs_admin/phase2_vanity_projects/phase2-ahrefs-vanity-projects-20260815T234731Z/` reports `20/20` existing vanity projects, `0` planned creates, and `0` blockers. Legacy purge readback `reports/ahrefs_admin/legacy_project_purge/ahrefs-legacy-project-purge-20260815T234731Z/` reports `18` Legacy-folder projects still available to purge.
- Analytics profile refresh after Ahrefs completion: packet `reports/resi_edge_performance/phase2-analytics-profile-plan/phase-2-analytics-profile-plan-20260816T000844Z/` reports `20/20` Ahrefs vanity projects found, `0` new Ahrefs projects planned, `18` remaining legacy source projects, and `20/20` GA4 web streams patch-ready. No provider mutation was performed by this refresh.
- GA4 default URI dry run: `/Users/mark/Property_Analytics/scripts/build_resi_edge_phase2_ga4_default_uri_plan.py` now prepares the Phase 2 GA4 web stream default URI patch lane. Full dry-run packet `reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T001028Z/` reports `20` planned patches from current Venterra apartment URLs to vanity URLs, `0` already-current, and `0` blockers. Canary dry run `reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T001029Z/` scopes to OK4AN only with `1` planned patch and `0` blockers. No GA4 mutation has been performed; future apply requires `--apply --confirm PATCH_PHASE2_GA4_DEFAULT_URIS` and readback proof.
- GA4 canary apply stop: after Mark approved the OK4AN canary, apply packet `reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T003544Z/` stopped with GA4 `PermissionDenied`, message `403 The caller does not have permission`; `patch_proven:false`, `after:null`, and the stream before state remained `https://venterraliving.com/apartments/anatole-at-norman/`. Read-only refresh `reports/ga4_admin/phase2_default_uri/phase2-ga4-default-uri-20260816T003710Z/` confirms OK4AN remains unchanged and planned. Do not continue GA4 patching until edit permission is granted to the Keeper-backed GA4 service account or an approved alternate Keeper-backed GA4 Admin credential is added.

## Stop Conditions

Stop and discuss if any of these occur:

- Any validator fails.
- A stage gate fails.
- A live apply gate fails.
- A WordPress control path shows edge markers, cache hit behavior, missing WordPress test cookie, changed admin redirect behavior, or non-native JSON.
- Zaraz is not the analytics owner.
- Consent purpose assignment or browser proof fails.
- Source phone attribution is wrong or internal labels render to customers.
- R2 readback/cache metadata fails.
- Mobile shell visual proof, desktop no-topper proof, or PSI fails.
- Ahrefs profile handling would create a duplicate project.
- GSC/Captain/Data Pond evidence is missing.
- Rollback proof is missing or ambiguous.
