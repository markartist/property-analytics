# Resi Edge Optimization Case Study

Date: 08/06/2026
Scope: TowneStone, The Vine, Champions Green, Calais Midtown
Owner: MarketingOps / Property Analytics

## 08/09/2026 Reconciliation Note

This case study is retained as a lesson record, not an execution authority. For live execution, use `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md`.

Current correction: TowneStone and The Vine are the only active read-only reference fixtures. Calais and Champions Green are failure/lesson sources unless Mark explicitly re-approves a bounded test. The first apply target is `pilot.venterradev.com`. Any language below that describes Champions as a prototype or Calais as a scale proof is historical context and is superseded for execution.

## Executive Summary

The last several days proved that the Resi edge optimization program can produce major mobile performance wins, cleaner analytics ownership, and safer launch behavior. It also exposed a process failure: Calais was advanced as a strong mobile preview while the analytics ownership lesson from TowneStone and The Vine was not enforced early enough.

The correction is now locked into the portfolio migration system:

- analytics ownership is a required early gate
- architecture equivalence is a required early gate
- Zaraz migration or an approved exception is required before final performance acceptance
- integrated native mobile transforms are forbidden for 90+ mobile package approval unless Mark explicitly approves the exception first
- desktop native pass-through cannot be described as optimized desktop
- every gate must have evidence, state, and stop conditions
- every live property move must begin with a reset card that names the approved pattern, mobile lane, desktop lane, analytics ownership, live scope, proof, and stop conditions
- every property must carry a whole-property launch ledger covering `llms.txt`, meta/OG, schema URLs, stale identity, phone/CTA/nav, favicon/icons, sitemap/robots, GSC/indexing, cache, Captain, Data Pond, rollback, and evidence

## Properties Reviewed

| Property | Code | Role In Case Study | Outcome |
| --- | --- | --- | --- |
| TowneStone at 359 | `TX4FC` | Launch repair and production topper proof | Zaraz-first analytics, mobile topper production, identity/phone/nav/llms fixes |
| The Vine Kyle Parkway | `TX4EK` | Repeat production topper and benchmark | Zaraz present, mobile topper production, console/font cleanup, llms fix |
| Champions Green | `GA4CG` | Original prototype lineage | R2 asset system, query-gated topper, preview analytics proof |
| Calais Midtown | `TX4MI` | Replication test, failure, and corrected scale proof | Failed when integrated; corrected live as standalone shell with mobile `100` / desktop `98` PSI |

## Timeline And Findings

### TowneStone

TowneStone established the modern launch pattern.

What worked:

- Moved GA4 and Resi events from WordPress-side GTM into Cloudflare Zaraz.
- Preserved Ahrefs and delayed Heap through Zaraz.
- Removed GTM/noscript/debug/inline `gtag` remnants from WordPress or stripped stale cache output at the Worker.
- Verified Zaraz posts, no GTM network traces, GA4 realtime, and migrated Resi events.
- Promoted the mobile-only topper with correct phone, same-origin optimized hero, no mobile overflow, lazy native continuation, and desktop native pass-through.
- Fixed `/llms.txt` and drawer navigation issues after PSI/browser feedback.

Key lesson:

Analytics migration is not an optional performance polish step. It is part of launch correctness, duplicate-tracking prevention, and desktop JavaScript control.

### The Vine

The Vine showed that the pattern could be repeated, but also reinforced that post-launch browser proof matters.

What worked:

- Verified live benchmark, meta/schema hygiene, Zaraz presence, no GTM, and no wrong TowneStone/Apex identity.
- Promoted mobile topper through the existing Worker rather than creating a competing Worker.
- Corrected font 404s after PageSpeed/console surfaced browser errors.
- Preserved desktop-native behavior intentionally.

Key lesson:

Production proof must include console errors, failed requests, and font/image health, not just PSI scores.

### Champions Green

Champions Green provided the prototype architecture.

What worked:

- Created the R2 asset lane and key pattern.
- Generated optimized derivatives and uploaded R2 assets.
- Proved the mobile topper pattern can score high when first-viewport content is edge-owned and lightweight.
- Preview-scoped Zaraz tools restored analytics proof without loading early Heap/Contentsquare.

Key lesson:

The mobile topper is the high-score delivery lane. Exact-native/native-desktop is a separate calibration or guardrail lane and must be labeled honestly.

### Calais Midtown

Calais was the clean replication test and the process correction.

What worked:

- Resolved property identity as `TX4MI`; explicitly avoided the `GA4CM` Canton Mill Lofts collision.
- Generated Calais assets and uploaded 16 of 16 R2 objects after Cloudflare token permissions were expanded.
- Verified sampled remote R2 objects by bytes and SHA.
- Deployed a workers.dev preview with no production route or DNS change.
- Mobile preview scored `100` exact and `99-100` fresh with `0ms` TBT and 9 requests.

What failed:

- The package treated analytics proof as a late promotion item instead of a prerequisite for final performance acceptance.
- Rendered Calais desktop HTML still contains native GTM/`gtag.js`/Heap paths and no Zaraz bootstrap.
- Desktop performance was described too generously as native-guard acceptance before the analytics ownership gap was escalated.
- A later integrated native-page rebuild drifted away from the proven TowneStone/Vine architecture. It injected the topper into the full native WordPress document, which reintroduced native stylesheet links, jQuery, UIkit/YOOtheme, Resi app scripts, and DAM images into the initial mobile document.

Root cause:

The knowledge existed in records from TowneStone, The Vine, and Champions, but the Calais package checklist did not force that knowledge into a hard gate. The system allowed progress based on a strong mobile preview while a cross-property prerequisite remained unresolved.

Additional root cause:

The process did not require a machine-readable architecture proof before saying Calais was using the same pattern as TowneStone and The Vine. Visual similarity was allowed to stand in for architectural equivalence. That is no longer allowed.

Corrective action:

- Created `docs/RESI_EDGE_PORTFOLIO_MIGRATION_SYSTEM_2026-08-06.md`.
- Updated `docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md` with a locked ordered package procedure.
- Added analytics ownership as an early stop/pass gate.
- Added architecture equivalence as an early stop/pass gate.
- Added `/Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs` so the proven TowneStone/Vine shell contract is machine-checked before PSI/readiness claims.
- Added the mandatory reset card and approved pattern matrix so the operator cannot silently drift from the TowneStone/Vine/Champions precedent.
- Added the whole-property launch ledger so performance work cannot outrun `llms.txt`, schema/meta/OG, stale identity, phone/CTA/nav, search, cache, Captain, and Data Pond proof.
- Updated Calais manifest/readout/memory/Captain language to mark analytics ownership incomplete.
- Rebuilt Calais from the reset card as the standalone TowneStone/Vine shell, promoted only after clean/source architecture validators, deployed preview browser proof, live browser proof, and live PSI all passed.

## Best Practices Locked

### 1. Read The Record First

Before starting a property:

- read working memory, capability register, full audit, migration system, and SOP
- search for the property code, hostname, GA4 id, and property name
- summarize comparable lessons in the package readout

### 2. Resolve Identity Before Implementation

Use the governed identity matrix. Do not improvise property codes, GA4 ids, URLs, phone numbers, or community ids.

### 3. Make Analytics Ownership A First-Class Gate

The preferred launch pattern is:

- Zaraz owns GA4
- Zaraz owns interaction-gated Heap/Contentsquare
- Zaraz owns Ahrefs when applicable
- Zaraz or the Worker bridge owns Resi event forwarding
- WordPress GTM/gtag/Heap duplicates are removed

If this cannot be done, the exception must be approved and documented before performance acceptance.

### 4. Separate Mobile Topper From Desktop Native

Mobile topper performance does not prove desktop optimization.

Desktop states must be labeled as:

- `optimized_desktop`
- `native_guard_acceptance`
- `not_in_scope`
- `blocked`

Do not imply desktop is optimized when it is native pass-through.

### 4A. Prove The Architecture Before Scoring

The approved mobile optimization package is a standalone edge-owned shell, not an integrated native transform.

The required architecture proof must show:

- mobile initial HTML under the shell budget
- zero stylesheet links
- no native jQuery/UIkit/YOOtheme/Resi runtime blockers
- no DAM images in the initial document
- no direct native analytics loaders when Zaraz owns analytics
- no desktop topper unless approved

TowneStone and The Vine pass this proof. Calais integrated native transform fails this proof and is treated as the named failure mode.

### 5. Require Exact And Fresh PSI

Every PSI packet must include:

- mobile exact
- mobile fresh
- desktop exact
- desktop fresh

The readout must explain variance and whether the result is official PSI, local Chrome, or unavailable due quota.

### 6. Verify R2 Remotely

R2 is not complete until:

- dry-run passes
- upload succeeds
- sampled remote downloads match local bytes/SHA

### 7. Validate Browser Reality

Every preview or production change needs:

- Playwright screenshot
- console error scan
- failed request scan
- first-party font/image/script health
- mobile overflow scan
- CTA click smoke

### 8. Keep Captain Honest

Captain state must be no more optimistic than the package evidence.

Examples:

- `blocked` when R2 cannot upload
- `in_progress` when mobile preview passes but analytics/rollback remain
- `passed` only when all required gates pass or approved exceptions exist

## New Stop Rules

Stop the package immediately when:

- identity is ambiguous
- stale identity appears in public HTML
- analytics ownership is unresolved and no exception is approved
- architecture equivalence proof fails or is missing
- GTM/gtag/Heap duplicates remain while Zaraz is supposed to own analytics
- R2 remote readback fails
- any core CTA is broken
- any production route/DNS change would be required before preview proof
- Captain state would overstate readiness

## Required Case Study Carry-Forward

Every next pilot property package must include this line in `PACKAGE_READOUT.md`:

```text
This package followed docs/RESI_EDGE_PORTFOLIO_MIGRATION_SYSTEM_2026-08-06.md and records each gate state explicitly.
```

Every deviation must be listed under `Approved Exceptions`.
