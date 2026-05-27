# Initiative Closeout Ledger

Status: Active closeout plan  
Date: 2026-05-26  
Owner: MarketingOps / Property Analytics  
Primary branch: `codex/stabilization-foundation-2026-05-26`  
Preserved broad branch: `codex/pilot-control-cwv-reporting`  
Baseline branch: `codex/release-reconcile`

## Purpose

This ledger is the working list for closing out the current initiative stack without mixing unfinished work into production release paths.

The rule for every initiative is simple:

- `Promote` only after focused validation and ownership review.
- `Split` when a lane contains more than one production decision.
- `Park` when the work is valuable but not needed for the next stable release.
- `Archive` when the work is superseded or reference-only.
- `Delete/Ignore` only for generated artifacts, local scratch, or obsolete outputs.

## Current Operating Posture

- `codex/stabilization-foundation-2026-05-26` is the clean stabilization branch.
- `codex/pilot-control-cwv-reporting` preserves the full organized initiative stack.
- The stabilization branch currently promotes only release-reconcile tooling and context posture.
- A broad data cherry-pick was attempted and intentionally aborted because it pulled 173 files and conflicted with core collection/reporting paths.
- Locked PIB generation/rendering files remain off limits unless explicitly approved in the current task.
- Keeper/KSM remains the required credential source of truth for any credential-backed closeout validation.

## Preserved Shelves

| Shelf | Source | Contents | Closeout disposition |
| --- | --- | --- | --- |
| `pre-stabilization dirty changes 2026-05-26` | `codex/pilot-control-cwv-reporting` | New local edits to working memory, capability register, `reputation_com_ingest.py`, and Monteverde watch script | Review after source-contract lanes; do not auto-apply |
| `pre-stabilization untracked artifacts 2026-05-26` | `codex/stabilization-foundation-2026-05-26` | EVS/browser screenshots and local package artifacts | Delete/ignore unless needed as evidence |
| `quarantine focus config after lane organization` | `codex/pilot-control-cwv-reporting` | Focus configuration state | Park pending Focus Report ownership review |
| `quarantine local scratch after lane organization` | `codex/pilot-control-cwv-reporting` | Local scratch, environment-adjacent files, memory state, temp folders | Keep quarantined; likely archive/delete after inspection |
| `WIP (out of scope): Data_Collection + Project_Memory` | `codex/cleanup-2026-02-18` | Older out-of-scope work | Archive unless a specific file is requested |

## Closeout Order

1. Release and stabilization governance
2. Data collection hardening
3. Property identity and source contracts
4. Data Warehouse upstream source integration
5. Platform app / Watchtower / control surfaces
6. Zero Trust / SSO / Keeper auth posture
7. Captain governance runtime
8. Site Content / Intelligence Office / VACS
9. EVS / BrowserStack validation
10. Pilot CWV / tracker / roundup reporting
11. PIB / POP Brief reporting lane
12. Model gateway
13. Edge messages experimentation
14. ApartmentIQ market intelligence
15. Copy-change and content watch
16. Cloudflare ops
17. Paid media workbook
18. Docs and memory governance
19. Local scratch and generated artifacts

## Initiative Ledger

| Initiative | Status | Evidence / location | Current condition | Disposition | Closeout test | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| Release and stabilization governance | Closed-foundation | `8077288`, `3969bbe`, `80024ec`, `scripts/generate_release_reconcile_snapshot.py`, `config/release_reconcile_snapshot.json` | Clean stabilization branch exists and is pushed | Promote | Guardrails pass; branch stays narrow | Use as the review base for closeout work |
| Data collection hardening | Split needed | `66890f9`, `Data_Collection/`, collection monitoring/orchestration paths | Valuable but too broad for one promotion; conflicts in daily collection, retry, closure, alerting, and morning report | Split | Property identity governance passes; daily collection/retry paths validate in isolation | Split into source-contract/read-model migrations, then runtime collection changes |
| Property identity and source contracts | Promoted foundation | `property_identity_and_source_contracts`, `Data_Collection/utils/property_identity.py`, `config/property_identity_matrix.json`, `scripts/check_property_identity_governance.sh` | Exact-match resolver and governed matrix are ready as the first source-identity foundation for Data Warehouse closeout | Promote | `bash scripts/check_property_identity_governance.sh` passes | Use as the required identity gate for each source-ingest closeout |
| Data Warehouse upstream source integration | Promoted advisory shadow | Current dirty tree, `docs/DATA_WAREHOUSE_*_2026-05-26.md`, `scripts/run_data_warehouse_daily_harvest.mjs`, `scripts/reconcile_data_warehouse_guest_card_exports.mjs`, `scripts/supply_guest_card_metrics_from_data_warehouse.mjs` | Active discovery/shadow-harvest lane with Keeper-backed upstream, guest-card reconciliation, direct no-CSV shadow supply, and Captain advisory packets | Promote as advisory / split canonical replacement | Keeper-backed auth verified without secrets; property identity governance passes; reconciliation status remains `degraded_advisory` until source-owner review | Keep shadow/advisory lane active; do not run canonical apply by default |
| Platform app / Watchtower / control surfaces | Split needed | `a6952e3`, `apps/api/`, `apps/web/`, `packages/shared/` | Large app/control-plane upgrade with many tests and UI surfaces | Split | API tests and web type/build checks pass for a narrowed slice | Start with Watchtower/read-only release visibility, then auth-sensitive surfaces |
| Zero Trust / SSO / Keeper auth posture | Split needed | `a326064`, Cloudflare Access docs and app auth paths | Security-critical and useful, but needs credential-aware validation | Split | Keeper-backed auth preflight passes without printing secrets; app fallback states verified | Review service-token/browser identity changes separately from documentation |
| Captain governance runtime | Parked pending platform | `ee99975`, captain migrations, scripts, reports | Large governance runtime lane with database and app surface implications | Park then split | Migration order and API routes validate in a branch dedicated to Captain runtime | Close after platform baseline is settled |
| Site Content / Intelligence Office / VACS | Split needed | `02aef9a`, `apps/web/src/app/site-content/`, `apps/api/src/routes/admin-site-content.ts`, VACS routes/docs | Active product lane; already partly represented in release-reconcile history | Split | Site Content core workflow passes; VACS contract tests pass separately | Promote only editorial-first Site Content fixes that are already clean; park broader VACS planning |
| EVS / BrowserStack validation | Parked | `42663fc`, `evs/`, `ops/browserstack/`, EVS migrations/routes | Useful QA lane with external service dependency and generated screenshots | Park then promote evidence tooling | BrowserStack credentials resolve through Keeper; local artifacts excluded | Keep code separate from generated screenshot artifacts |
| Pilot CWV / tracker / roundup reporting | Partially promoted - reporting ops | `ff7ec1a`, `codex/closeout-pilot-reporting-2026-05-27`, `pilot_control_cwv/`, `pilot_roundup/`, `apps/web/src/app/tracker/`, nested `apps/pilot-tracker-standalone/` | Pilot reporting operations are now split from tracker/app work; the moved-report/export failure path is fixed, GTMetrix collection is Keeper-first, generated reports stay ignored, and roundup/data-export senders have duplicate-send guards | Promote reporting ops / keep tracker split | Python compile, shell syntax, GTMetrix cohort validation, email dry-runs, context discipline, and PIB guardrails pass | Review main web tracker next; keep standalone tracker parked until consolidation decision |
| PIB / POP Brief reporting lane | Guardrail review | `ea3c045`, `POP_Brief/`, app PIB pages, `pib_data_to_d1.py` | Adjacent reporting work; canonical PIB files are locked | Split with guardrails | `bash scripts/check_pib_guardrails.sh` passes; no locked PIB files touched | Promote POP Brief/app support only after confirming no canonical PIB mutation |
| Model gateway | Parked | `903fc9c`, `apps/api/src/platform/model-gateway/`, model gateway docs/tests | API/provider abstraction lane; not needed for stabilization | Park | Model gateway test suite passes in dedicated branch | Revisit after platform/auth branch is stable |
| Edge messages experimentation | Parked | `cb85b06`, experiments routes, public preview, docs | Experimental content/pricing lane | Park | Worker dry-run contract and admin UI spec verified | Keep out of production release until experiment owner approves |
| ApartmentIQ market intelligence | Split needed | `apartmentiq_market_intelligence`, collector, migrations, scripts, docs | New external data source with schema and collector implications | Split | Source contract reviewed; collector auth uses Keeper path; migrations reconcile | Treat as a source-ingest project after identity governance |
| Copy-change and content watch | Split needed | `copy_change_and_content_watch`, Monteverde watch, GBP posts, content office | Mixed monitoring/content operations lane | Split | Watch script source contract and content-office UI validate separately | Review `pre-stabilization dirty changes` before deciding |
| Cloudflare ops | Split needed | `cloudflare_ops`, cache audit, cache rollout, analytics collector, Wrangler auth | Operationally important but credential-sensitive | Split | Wrangler auth helper resolves token through Keeper; no direct secret paths added | Promote Wrangler/Keeper helper changes before analytics collector expansion |
| Paid media workbook | Quick review | `35286d5`, `paid_media_workbook/` | Small specialized workbook lane | Promote or park | Workbook generation smoke test passes with Keeper-backed Google Ads config | Quick review candidate after data/auth foundations |
| Docs and memory governance | Ongoing | `8c44a21`, `ATLAS_WORKING_MEMORY.md`, capability/audit docs, guardrail scripts | Valuable but very large documentation/governance sweep | Split | Context discipline and PIB guardrails pass | Promote only docs needed by each initiative closeout |
| Local scratch and generated artifacts | Quarantined | stashes, root screenshots, `tmp/`, `tools/`, `.env.production`, nested build outputs | Preserved but not production work | Delete/Ignore after review | Parent repo remains clean; no secrets printed or committed | Inspect shelves one by one and delete only confirmed generated/scratch artifacts |

## Branch And Stash Map

| Lane | Source branch / shelf | Target branch | Promotion rule |
| --- | --- | --- | --- |
| Stabilization governance | `codex/stabilization-foundation-2026-05-26` | same branch | Keep narrow; only release governance and closeout-control docs |
| Broad organized stack | `codex/pilot-control-cwv-reporting` | dedicated lane branches | Never merge wholesale; cherry-pick or rebuild one initiative at a time |
| Data Collection hardening | `66890f9` on `codex/pilot-control-cwv-reporting` | `codex/closeout-data-collection-foundation-*` | Split property identity and non-runtime source contracts before orchestration/runtime paths |
| Data Warehouse upstream | current dirty tree | `codex/closeout-data-warehouse-shadow-*` | Treat as advisory validation until reconciliation status is reviewed |
| Platform / Watchtower | `a6952e3` on `codex/pilot-control-cwv-reporting` | `codex/closeout-platform-watchtower-*` | Promote read-only visibility separately from auth-sensitive control flows |
| Auth / Zero Trust | `a326064` on `codex/pilot-control-cwv-reporting` | `codex/closeout-zero-trust-*` | Keeper-first validation required; do not add local credential paths |
| PIB / POP Brief | `ea3c045` on `codex/pilot-control-cwv-reporting` | `codex/closeout-pop-brief-*` | No locked PIB file mutations without explicit approval |
| Stashed dirty changes | named stashes | lane-specific branches only | Inspect by path; do not apply shelves wholesale |

## Validation Playbooks

| Lane | Required validation |
| --- | --- |
| Any closeout branch | `git diff --check`; `bash scripts/check_context_discipline.sh`; `bash scripts/check_pib_guardrails.sh` |
| Property identity | `bash scripts/check_property_identity_governance.sh`; confirm no one-off property maps were added |
| Data Warehouse upstream | Keeper/KSM source resolution only; no raw secret output; property identity check; reconciliation artifact reviewed before any canonical replacement |
| Data Collection runtime | Unit/import smoke for touched collectors; daily collection dry-run or bounded source dry-run; retry/closure output inspected |
| Platform app / Watchtower | API test subset for touched routes; web type/build check; browser verification for touched UI when applicable |
| Auth / Zero Trust | Sanitized auth preflight; Access fallback states verified; no direct local credential files introduced |
| EVS / BrowserStack | Keeper-backed BrowserStack credential presence only; generated screenshots excluded unless explicitly needed as evidence |
| PIB / POP Brief | PIB guardrail check; confirm locked PIB files remain untouched; preserve approved artifact shape |

## Data Collection Closeout Split

| Sub-lane | Scope | Promotion posture |
| --- | --- | --- |
| Property identity governance | `property_identity.py`, `property_identity_matrix.json`, identity guardrail script | First candidate; foundational and low-blast-radius if validated |
| Data Warehouse shadow source | daily harvest, reconciliation, Captain advisory, upstream docs | Advisory only until reconciliation deltas are accepted or resolved |
| Source contracts and migrations | source contract docs, schema/migration files, non-runtime read models | Promote only after ownership and migration ordering review |
| Collectors | source-specific collector changes | Promote one source family at a time |
| Runtime orchestration | daily collection, retry, closure, alerting, morning report | Last; conflicts indicate this needs careful branch-specific resolution |

## Decision Log

| Date | Decision | Rationale | Follow-up |
| --- | --- | --- | --- |
| 2026-05-26 | Keep stabilization branch narrow | Broad data/platform cherry-picks conflicted and bundled many initiatives | Use ledger to split lanes before promotion |
| 2026-05-26 | Add Data Warehouse upstream as its own closeout lane | Fresh dirty-tree work shows a distinct governed source integration with identity, Captain, and Pond implications | Review as validation-first advisory lane before replacing manual exports |
| 2026-05-26 | Promote Data Warehouse as advisory shadow, not canonical replacement | Property identity and code validation pass, but guest-card export reconciliation still has quote, pipeline-app, and tour drift | Continue source-owner reconciliation before enabling canonical guest-card apply |
| 2026-05-27 | Promote pilot reporting operations separately from tracker/product work | The daily GTMetrix/PSI export and roundup workflow is operationally useful, while tracker surfaces and standalone app consolidation remain separate decisions | Keep generated report artifacts ignored; review tracker/app lane after reporting ops branch is merged or parked |

## Immediate Next Moves

1. Keep `codex/stabilization-foundation-2026-05-26` as the clean base.
2. Keep the Data Warehouse replacement-track stash quarantined until that lane is explicitly resumed.
3. Finish pilot reporting ops review, then move to the main tracker path as the next Pilot CWV closeout slice.
4. Keep all credential validation Keeper-first and sanitized.
5. Do not apply stashes wholesale; inspect each shelf by path and intent.

## Closeout Definition

An initiative is closed when all of the following are true:

- Disposition is recorded as `Promoted`, `Parked`, `Archived`, or `Deleted/Ignored`.
- Canonical owner and future extension path are clear.
- Required guardrails pass.
- User-facing or executive-facing artifact contracts are preserved.
- Any remaining work has a branch, stash, or document pointer and a named next action.
