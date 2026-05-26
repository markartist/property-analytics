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
4. Platform app / Watchtower / control surfaces
5. Zero Trust / SSO / Keeper auth posture
6. Captain governance runtime
7. Site Content / Intelligence Office / VACS
8. EVS / BrowserStack validation
9. Pilot CWV / tracker / roundup reporting
10. PIB / POP Brief reporting lane
11. Model gateway
12. Edge messages experimentation
13. ApartmentIQ market intelligence
14. Copy-change and content watch
15. Cloudflare ops
16. Paid media workbook
17. Docs and memory governance
18. Local scratch and generated artifacts

## Initiative Ledger

| Initiative | Evidence / location | Current condition | Disposition | Closeout test | Next action |
| --- | --- | --- | --- | --- | --- |
| Release and stabilization governance | `8077288`, `3969bbe`, `scripts/generate_release_reconcile_snapshot.py`, `config/release_reconcile_snapshot.json` | Clean stabilization branch exists and is pushed | Promote | Guardrails pass; branch stays narrow | Use as the review base for closeout work |
| Data collection hardening | `66890f9`, `Data_Collection/`, collection monitoring/orchestration paths | Valuable but too broad for one promotion; conflicts in daily collection, retry, closure, alerting, and morning report | Split | Property identity governance passes; daily collection/retry paths validate in isolation | Split into source-contract/read-model migrations, then runtime collection changes |
| Property identity and source contracts | `property_identity_and_source_contracts`, `Data_Collection/utils/property_identity.py`, `config/property_identity_matrix.json` | High-value foundation mixed with many source ingests | Split | `bash scripts/check_property_identity_governance.sh` passes | Promote identity matrix/governance before individual source ingests |
| Platform app / Watchtower / control surfaces | `a6952e3`, `apps/api/`, `apps/web/`, `packages/shared/` | Large app/control-plane upgrade with many tests and UI surfaces | Split | API tests and web type/build checks pass for a narrowed slice | Start with Watchtower/read-only release visibility, then auth-sensitive surfaces |
| Zero Trust / SSO / Keeper auth posture | `a326064`, Cloudflare Access docs and app auth paths | Security-critical and useful, but needs credential-aware validation | Split | Keeper-backed auth preflight passes without printing secrets; app fallback states verified | Review service-token/browser identity changes separately from documentation |
| Captain governance runtime | `ee99975`, captain migrations, scripts, reports | Large governance runtime lane with database and app surface implications | Park then split | Migration order and API routes validate in a branch dedicated to Captain runtime | Close after platform baseline is settled |
| Site Content / Intelligence Office / VACS | `02aef9a`, `apps/web/src/app/site-content/`, `apps/api/src/routes/admin-site-content.ts`, VACS routes/docs | Active product lane; already partly represented in release-reconcile history | Split | Site Content core workflow passes; VACS contract tests pass separately | Promote only editorial-first Site Content fixes that are already clean; park broader VACS planning |
| EVS / BrowserStack validation | `42663fc`, `evs/`, `ops/browserstack/`, EVS migrations/routes | Useful QA lane with external service dependency and generated screenshots | Park then promote evidence tooling | BrowserStack credentials resolve through Keeper; local artifacts excluded | Keep code separate from generated screenshot artifacts |
| Pilot CWV / tracker / roundup reporting | `ff7ec1a`, `pilot_control_cwv/`, `apps/web/src/app/tracker/`, nested `apps/pilot-tracker-standalone/` | Active pilot lane, includes nested repo boundary and generated outputs | Split | Main tracker path validates independently; standalone tracker disposition decided | Close main web tracker first; park standalone tracker until consolidation decision |
| PIB / POP Brief reporting lane | `ea3c045`, `POP_Brief/`, app PIB pages, `pib_data_to_d1.py` | Adjacent reporting work; canonical PIB files are locked | Split with guardrails | `bash scripts/check_pib_guardrails.sh` passes; no locked PIB files touched | Promote POP Brief/app support only after confirming no canonical PIB mutation |
| Model gateway | `903fc9c`, `apps/api/src/platform/model-gateway/`, model gateway docs/tests | API/provider abstraction lane; not needed for stabilization | Park | Model gateway test suite passes in dedicated branch | Revisit after platform/auth branch is stable |
| Edge messages experimentation | `cb85b06`, experiments routes, public preview, docs | Experimental content/pricing lane | Park | Worker dry-run contract and admin UI spec verified | Keep out of production release until experiment owner approves |
| ApartmentIQ market intelligence | `apartmentiq_market_intelligence`, collector, migrations, scripts, docs | New external data source with schema and collector implications | Split | Source contract reviewed; collector auth uses Keeper path; migrations reconcile | Treat as a source-ingest project after identity governance |
| Copy-change and content watch | `copy_change_and_content_watch`, Monteverde watch, GBP posts, content office | Mixed monitoring/content operations lane | Split | Watch script source contract and content-office UI validate separately | Review `pre-stabilization dirty changes` before deciding |
| Cloudflare ops | `cloudflare_ops`, cache audit, cache rollout, analytics collector, Wrangler auth | Operationally important but credential-sensitive | Split | Wrangler auth helper resolves token through Keeper; no direct secret paths added | Promote Wrangler/Keeper helper changes before analytics collector expansion |
| Paid media workbook | `35286d5`, `paid_media_workbook/` | Small specialized workbook lane | Promote or park | Workbook generation smoke test passes with Keeper-backed Google Ads config | Quick review candidate after data/auth foundations |
| Docs and memory governance | `8c44a21`, `ATLAS_WORKING_MEMORY.md`, capability/audit docs, guardrail scripts | Valuable but very large documentation/governance sweep | Split | Context discipline and PIB guardrails pass | Promote only docs needed by each initiative closeout |
| Local scratch and generated artifacts | stashes, root screenshots, `tmp/`, `tools/`, `.env.production`, nested build outputs | Preserved but not production work | Delete/Ignore after review | Parent repo remains clean; no secrets printed or committed | Inspect shelves one by one and delete only confirmed generated/scratch artifacts |

## Immediate Next Moves

1. Keep `codex/stabilization-foundation-2026-05-26` as the clean base.
2. Start with data collection hardening, but split the branch before resolving runtime conflicts.
3. Promote property identity governance before adding source-specific ingestion changes.
4. Keep all credential validation Keeper-first and sanitized.
5. Do not apply stashes wholesale; inspect each shelf by path and intent.

## Closeout Definition

An initiative is closed when all of the following are true:

- Disposition is recorded as `Promoted`, `Parked`, `Archived`, or `Deleted/Ignored`.
- Canonical owner and future extension path are clear.
- Required guardrails pass.
- User-facing or executive-facing artifact contracts are preserved.
- Any remaining work has a branch, stash, or document pointer and a named next action.
