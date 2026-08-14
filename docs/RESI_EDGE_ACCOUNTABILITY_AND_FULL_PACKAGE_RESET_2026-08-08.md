# Resi Edge Accountability And Full Package Reset

Date: 08/08/2026
Owner: MarketingOps / Property Analytics
Status: Active corrective record

## 08/11/2026 Parity Enforcement Addendum

The Ventana/Calais/Champions failures exposed another gap: the written doctrine was stronger than the executable package gates. The runner could still treat `90+` or a narrow shell pass as acceptable even when the proven package profile was closer to consistent mobile `100`, lean initial requests, and exact mobile composition.

Additional failures now recorded:

- Asset generation and R2 upload were not mandatory inside the runner, so optimized media could be stale, missing, oversized, or manually skipped.
- R2 readback proved existence only; it did not enforce byte budgets, content type, immutable cache, or role-specific expectations.
- Mobile shell validation did not block eager lower-page content-block images until after the failure was exposed.
- PSI mobile scoring used the old `90+` floor as the success threshold instead of a reference-parity gate.
- Reference replay confirmed broad architecture but did not prove the live network/request budget that made the working examples successful.

Corrective fences now required:

- `asset_budget_manifest_present` must pass before apply.
- `asset_generation_upload_passed` must run before route probe or Worker deploy.
- `r2_asset_readback_passed` must enforce byte budgets: mobile hero `80 KB`, first two content-block AVIFs `55 KB`, desktop hero `300 KB`, and other R2 assets `120 KB`.
- Mobile shell contract must reject eager content-block image `src` attributes in the first HTML response.
- `psi_mobile_reference_parity_live` must pass at `98+`; the old `90+` language is only a minimum floor.
- If any of these gates fail, the run stops. No live fixing, no variant, no lookalike, no “close enough.”

## Purpose

This record exists because the Champions Green upgrade pass exposed a serious operating failure: I treated a partial mobile-shell execution as if it were the full Resi upgrade package. That was wrong.

The full package was already defined across the TowneStone, The Vine, Calais, Champions, consent, analytics, Ahrefs, and source-attribution records. The operator's job is to hold that complete package together, not ask Mark to relist it and not silently narrow scope to the easiest subset.

This document supersedes any readiness language that calls Champions Green package-complete based only on mobile shell proof, PSI proof, desktop native pass-through proof, or a reduced "locked mobile" contract.

## Plain Accountability

What I did wrong:

- I collapsed the package into "mobile topper" work when the written runbook requires a whole-property upgrade package.
- I treated high PSI as readiness evidence before every required gate was proven.
- I allowed desktop "native pass-through" to become a reason to skip desktop analytics ownership proof. That is incorrect. Desktop may stay visually native, but direct GTM, direct gtag, direct Heap/Contentsquare, direct Ahrefs, direct Resi Pixel, consent state, and duplicate pageview paths still have to be audited and governed.
- I used "exact package" language while omitting pieces that were already part of the package: Zaraz analytics, consent proof, Ahrefs lookup-first setup, Cloudflare analytics/RUM posture, source-coded phone attribution, SEO/AI cleanup, llms.txt, schema/meta/OG, Captain/Data Pond state, and evidence cards.
- I made too many live iterations under pressure instead of stopping at failed gates.
- I relied on local or partial proof in places where Mark had already made clear that live production proof is the only proof that matters.
- I did not consistently reset to the record before acting, even after the Calais failure proved why that reset is mandatory.

The corrective rule is simple: no property can be called upgraded, ready, approved, complete, exact, or "same as TowneStone/Vine" unless the complete package below is proven or an explicit approved exception is written in the property readout.

## Documents Reviewed For This Reset

Mandatory session documents:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

Governing Resi package documents:

- `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_PORTFOLIO_MIGRATION_SYSTEM_2026-08-06.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_PACKAGE_READOUT_TEMPLATE_2026-08-07.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_CASE_STUDY_2026-08-06.md`
- `/Users/mark/Property_Analytics/docs/PORTFOLIO_RESI_EDGE_STABILIZATION_SOP_2026-07-09.md`

Supporting source contracts:

- `/Users/mark/Property_Analytics/docs/RESI_SOURCE_ATTRIBUTION_LOOKUP_RUNBOOK_2026-08-06.md`
- `/Users/mark/Property_Analytics/docs/AHREFS_SOURCE_CONTRACT_2026-07-20.md`
- `/Users/mark/Property_Analytics/docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md`

## Full Resi Upgrade Package Contract

### 1. Reset Card

Before any route mutation, Worker edit, cache purge, Zaraz change, Ahrefs action, or readiness claim, create a property reset card that states:

- property name, code, canonical hostname, governed Venterra URL, community id, GA4 id, GSC property, Ahrefs project posture
- approved mobile lane
- approved desktop lane
- analytics owner
- consent owner
- phone-attribution rule
- live scope
- rollback marker
- proof folder
- explicit stop conditions

If the reset card is missing, stop.

### 2. Governed Identity And Source Data

Resolve identity through the governed property identity matrix and source systems. Do not improvise property codes, phone numbers, GA4 ids, community ids, review values, URLs, specials, or Ahrefs targets.

Required proof:

- identity matrix resolution
- stale identity scan
- source page audit
- source feed facts for specials and phone attribution
- current live URL and canonical path

### 3. Source Attribution And Phone Numbers

Visible phone numbers must come from the governed Resi source-attribution lookup. The default visible phone is the VWS attribution number, not the raw office phone.

Required proof:

- clean URL uses VWS default attribution phone
- valid source-coded URL uses the matching source phone
- invalid source id falls back to VWS
- phone text and `tel:` links match
- hero/header/drawer/footer/native continuation agree

### 4. Mobile Standalone Shell

The approved mobile performance lane is a standalone edge-owned shell, not an integrated native WordPress transform.

The mobile shell must include:

- feed-backed promo/specials title using marketing language such as `Up to ...` when applicable
- branded promo/dropdown colors matching the property when lease-up/property branding differs
- native-parity mobile header and drawer
- full-height optimized hero
- official LBLE art with no TM added by the edge package
- sourced linked review row when present in the native property rating block
- fractional star fill tied to the numeric rating
- exact or captured property fonts when available
- first two native content blocks in the approved order
- required awards/badges in the native mobile sequence
- optimized same-origin/R2 assets
- lazy native continuation
- continuation dedupe so shell-owned sections do not repeat inside the iframe

Required proof:

- architecture validator pass
- live mobile screenshot
- scroll proof through shell and continuation
- console and failed-request scan
- font `200` proof
- image `200` proof
- no horizontal overflow
- CTA smoke proof

### 5. Desktop Native Lane

Desktop stays visually native by default. That does not mean desktop is ignored.

Allowed by default:

- native desktop rendering
- full-page cache and light guardrails
- surgical analytics cleanup that preserves native rendering
- no mobile topper
- no edge-added desktop review row
- no desktop shell unless separately approved

Required proof:

- desktop live screenshot
- no raw/default blue-link HTML
- native CSS loaded
- no edge mobile shell/topper on desktop
- desktop PSI exact and fresh
- direct native analytics audited and removed/stripped when Zaraz owns analytics

### 6. Zaraz Analytics Ownership

Zaraz is the default analytics owner for the Resi package.

Required tools/posture:

- GA4 through Zaraz
- Heap/Contentsquare interaction-gated through Zaraz
- Ahrefs Web Analytics through Zaraz when applicable
- Resi attribution/event bridge through Zaraz or the Worker bridge
- Cloudflare Analytics / RUM evidence where applicable

Required cleanup:

- remove or strip native GTM
- remove or strip direct `gtag.js`
- remove or strip direct Heap/Contentsquare
- remove or strip direct Ahrefs
- remove or strip direct Resi Pixel
- prevent duplicate pageviews/events

Required proof:

- rendered HTML/network audit
- Zaraz posts
- GA4 realtime or accepted GA4 proof
- passive lab proof with zero Heap/Contentsquare leakage
- interaction proof when required
- Ahrefs request/tool proof
- Resi event proof
- Cloudflare edge analytics/RUM state proof

### 7. Consent Management

Cloudflare Zaraz Consent Management is a required legal/compliance gate unless Mark explicitly approves another CMP before implementation.

Required proof:

- Zaraz CMP enabled
- `Analytics & Performance` purpose configured
- `Marketing & Leasing Attribution` purpose configured
- enabled tools assigned to purposes
- visible first-visit UI or approved Worker consent pill
- preferences panel works
- reject blocks purpose-bound tools
- accept grants and sends queued events
- no analytics leakage before consent or after reject

### 8. SEO, AI, And Indexing

The package includes SEO/AI cleanup, not only performance.

Required proof:

- title/meta description correct
- OG/Twitter tags correct
- canonical correct
- schema URLs correct and not stale
- stale property/code metadata removed
- favicon/icons correct
- sitemap/robots reachable
- `/llms.txt` has an H1 and real Markdown links after placeholder expansion
- GSC property/indexing status recorded
- indexing request state recorded when submitted

### 9. Ahrefs

Ahrefs must be lookup-first.

Required proof:

- existing project roster checked before creation
- correct standalone or portfolio path profile identified
- no duplicate project created unless approved
- Web Analytics data-key/tool proof recorded
- launch URL path change implications recorded
- crawl/audit state recorded when available

### 10. Assets, Fonts, And Cache

Required proof:

- optimized assets generated
- R2 upload verified by remote bytes/SHA where R2 is used
- first-party font URLs return `200`
- no broken first-party console resource errors
- Cloudflare and Kinsta cache purge recorded after production mutation
- clean production readback confirms current marker/body, not stale HTML

### 11. Captain And Data Pond

The package must leave an auditable operating record.

Required proof:

- Captain action/status reflects real gate state
- Data Pond/control surface row updated with usable status
- evidence cards or proof folder linked
- blockers named plainly
- no approval-ready state without every required gate or approved exception

### 12. Final Acceptance Evidence

A final property readout must include:

- baseline mobile and desktop PSI
- final mobile exact and fresh PSI
- final desktop exact and fresh PSI
- mobile and desktop screenshots
- browser console/network proof
- architecture proof
- analytics proof
- consent proof
- SEO/AI proof
- source-coded phone proof
- Ahrefs proof
- cache purge proof
- rollback marker
- approved exceptions, if any

## Stop Conditions

Stop immediately when:

- reset card is missing
- identity is ambiguous
- source facts are missing or stale
- mobile shell architecture validator fails
- live screenshot is missing
- desktop screenshot shows raw/default blue-link HTML
- desktop receives a mobile topper without explicit approval
- direct native analytics remain while Zaraz is declared owner
- consent purpose assignment is missing
- Ahrefs project/profile has not been looked up
- source-coded phone proof is missing
- first two content blocks, awards, review row, fonts, or branded colors are not proven
- PSI is used before architecture/browser/network proof
- local/workers.dev evidence is substituted for live production proof
- a property is described as complete with silent omissions

## Champions Green Correction

Champions Green has been reset and reworked multiple times. That churn is itself a failure signal.

Current corrective interpretation:

- The pure-source reset evidence is valid as a reset/baseline.
- The later mobile-shell proof is valid only as mobile-shell proof.
- It is not full package acceptance.
- Any language implying Champions is fully upgraded based on the partial mobile pass is superseded by this document.

Known Champions full-package blockers to verify before any future completion claim:

- full reset card for the next pass
- Zaraz analytics ownership across mobile and desktop
- Ahrefs lookup-first decision and Web Analytics posture
- Cloudflare Analytics/RUM evidence
- consent config and live accept/reject proof in current production state
- source-coded phone proof
- SEO/AI ledger
- desktop native proof after analytics cleanup
- Captain/Data Pond evidence card
- final exact/fresh PSI for both device classes after all package elements are present

## Required Language Going Forward

Allowed:

- `mobile shell proof passed`
- `desktop native pass-through proof passed`
- `analytics gate passed`
- `consent gate passed`
- `package blocked on ...`
- `full package complete`

Forbidden unless the full package is proven:

- `ready`
- `approved`
- `complete`
- `same as TowneStone/Vine`
- `exact package`
- `production approved`
- `all set`

## Remediation Plan

1. Freeze property mutations until the reset card and full package checklist are visible.
2. Use `/Users/mark/Property_Analytics/docs/RESI_EDGE_PACKAGE_READOUT_TEMPLATE_2026-08-07.md` for every property.
3. Treat every gate as complete, blocked, pending, or approved exception.
4. Do not run PSI as the primary proof. Run architecture/browser/network proof first.
5. Do not promote or claim completion until the full package passes on the live production hostname.
