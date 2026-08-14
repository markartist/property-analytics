# Resi Edge Canonical Audit: TowneStone And The Vine

Date: 08/08/2026
Scope: `townestoneat359.com` and `thevinekyle.com` only
Mode: read-only audit; no live Cloudflare, Worker, WordPress, DNS, Ahrefs, GSC, or Captain mutation

## Executive Finding

There is no safe, universal Resi optimization package until the proven TowneStone and The Vine behaviors are extracted into one locked shared package with validators. TowneStone and The Vine are reference implementations, not a reusable artifact by themselves.

The canonical package must be a shared, property-agnostic implementation plus a property manifest. A future agent must not copy a property Worker, rebuild a lookalike, or decide which pieces to keep. The only allowed variation is manifest data and explicitly approved property tokens.

## Reference Verdict

| Area | Best Reference | Reason |
|---|---:|---|
| Mobile standalone shell architecture | Both | Both pass the standalone mobile-shell contract: edge-owned first view, optimized same-origin hero asset, lazy native continuation, desktop pass-through. |
| Visual theming and lease-up brand color support | The Vine | The Vine v4 proves property-specific promo/drawer/panel colors without changing the shell contract. |
| Analytics ownership | TowneStone | TowneStone has GA4, Heap, Ahrefs, and Resi event bridge in Zaraz with purpose assignment. |
| Consent ownership | Both, with TowneStone as fuller tool matrix | Both pass read-only Zaraz consent audits; TowneStone covers four enabled tools, The Vine covers three. |
| Resi event instrumentation | TowneStone | TowneStone has the Resi event bridge tool in Zaraz. The Vine audit did not show a matching bridge tool. This is a gap before treating Vine as the complete analytics model. |
| WordPress direct-script cleanup | TowneStone | TowneStone has stronger evidence for GTM/native script removal and live body cleanup. The Vine desktop body still exposed `HEAP_JS_DEBUG` in a simple live scan and must not be the cleanup reference. |
| `llms.txt` | Both | Both live files contain a Markdown H1 and 10 links. |
| Ahrefs profile posture | Both | Both have existing Ahrefs projects and must be lookup-first, not create-first. |
| Captain activation evidence | Both historical only | Seed files show Captain Townestone and Captain Vine with 11 support agents each. Fresh routine audit was blocked by the missing active routine manifest, so Captain readiness cannot be asserted from a fresh gate. |
| GSC/indexing baseline | Both | GSC baseline exists; TowneStone has indexing work remaining, The Vine was stronger in inspected URL coverage. |

## Audited Live State

### TowneStone

Domain: `https://townestoneat359.com/`
Property code: `TX4FC`
Community id: `d41b32d1-9476-4936-9248-cd418f8c86be`
GA4 property id: `507293675`
GSC property: `sc-domain:townestoneat359.com`

Live mobile GET headers proved:

- `HTTP/2 200`
- `content-type: text/html; charset=utf-8`
- `cache-control: no-store`
- `vary: User-Agent`
- `server-timing: vtr_mobile_topper;desc="production"`
- `x-vtr-mobile-topper-production: 1`
- `x-vtr-townestone-native-optimizer: 2026-08-08.mobile-topper-production-cmp-v22`

Live desktop GET headers proved:

- `HTTP/2 200`
- native WordPress/YOOtheme content type
- `cache-control: public, max-age=0, s-maxage=86400`
- `vary: Accept-Encoding, User-Agent`
- `server-timing: vtr_townestone_native;desc="desktop-jpg"`
- same Worker marker `2026-08-08.mobile-topper-production-cmp-v22`

Live marker scan proved:

- Mobile includes `mobile-topper-production-cmp-v22`, `edge_mobile_topper_view`, `native-continuation`, `vtr_zaraz`, and `Find Your Home`.
- Desktop does not include the mobile topper marker and still includes native `Find Your Home` plus `vtr_zaraz`.

Key evidence:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v19/browser-smoke-summary.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v20-qa/summary.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v21-qa/summary.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/townestone/architecture/mobile-shell-proof.json`
- `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/townestone_20260805_gtm_to_zaraz/`
- `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/heap_interaction_only_20260807/townestone.after.json`
- `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/20260809_004042_zaraz_consent_audit.json`

TowneStone proven behaviors:

- Mobile standalone shell active only for mobile GET on homepage.
- Mobile first view geometry: 60px promo, 80px header, 704px hero on 390px test viewport.
- Mobile phone target: `tel:+13466231550`.
- Drawer nav v21 corrected to approved route set and removed stale `Location`, `About Venterra`, and `SMARTHUB`.
- Lazy continuation uses `edge_native_continuation=1`.
- Desktop is native pass-through, not an edge shell.
- WordPress direct GTM removed from proof.
- Phone normalized to `(346) 623-1550`.
- Tracking attributes normalized to `Townestone at 359` and `TX4FC`.
- Zaraz owns GA4 `G-J582E0V5T5`, Heap, Ahrefs, and Resi event bridge.
- Heap uses `interaction-only-queue-v2`, with passive timers disabled.
- Consent purposes present: `Analytics & Performance` and `Marketing & Leasing Attribution`.
- `llms.txt` live: H1 present, 10 links, first line `# Townestone at 359`.

TowneStone gaps or cautions:

- The live Worker source is a property-specific implementation. It is a reference, not a package.
- HEAD is not enough proof because mobile shell behavior is GET-specific.
- Fresh Captain routine audit could not run because `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json` is missing.
- Historical GSC audit showed TowneStone indexing needed work: 1/6 inspected URL pass at the time of the 08/03/2026 readout.

### The Vine

Domain: `https://thevinekyle.com/`
Property code: `TX4EK`
Community id: `44a4349b-6ac2-46fe-b8ef-167e4f1c3e3e`
GA4 property id: `505234023`
GSC property: `sc-domain:thevinekyle.com`

Live mobile GET headers proved:

- `HTTP/2 200`
- `content-type: text/html; charset=utf-8`
- `cache-control: no-store`
- `vary: User-Agent`
- `server-timing: vtr_vine_mobile_topper;desc="production"`
- `x-vtr-the-vine-mobile-topper: 2026-08-07.the-vine-mobile-topper-v4-brand-theme`

Live desktop GET headers proved:

- `HTTP/2 200`
- native WordPress/YOOtheme content type
- `cache-control: public, max-age=0, s-maxage=86400`
- `vary: Accept-Encoding`
- `server-timing: vtr_zaraz_consent_notice;desc="passive"`
- no mobile topper header

Live marker scan proved:

- Mobile includes `the-vine-mobile-topper-v4-brand-theme`, `edge_mobile_topper_view`, `native-continuation`, `vtr_zaraz`, and `Find Your Home`.
- Desktop does not include the mobile topper marker and includes native `Find Your Home`.
- Desktop body scan still showed `HEAP_JS_DEBUG`; this is not acceptable as the analytics cleanup reference.

Key evidence:

- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/browser-qa.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/browser-console-font-fix-v3.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/psi-keyed-v3/`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/psi-keyed-v3-desktop/`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-07/thevine-brand-theme-v4/live-brand-theme-proof.json`
- `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/the-vine/architecture/mobile-shell-proof.json`
- `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/heap_interaction_only_20260807/thevinekyle.after.json`
- `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/20260809_004044_zaraz_consent_audit.json`

The Vine proven behaviors:

- Mobile standalone shell active only for mobile GET on homepage.
- Mobile first view geometry: 60px promo, 80px header, 704px hero on 390px test viewport.
- Mobile phone target: `tel:+17373578867`.
- Desktop is native pass-through, not an edge shell.
- Drawer uses property-specific brand color `rgb(78, 52, 63)`.
- Promo panel uses property-specific surface/text/CTA colors:
  - closed promo background `rgb(78, 52, 63)`
  - open panel background `rgb(241, 239, 235)`
  - panel text `rgb(53, 52, 58)`
  - CTA background `rgb(121, 38, 64)`
- Font-fix evidence shows `consoleErrors: []` and `failedRequests: []` after removing guessed/bad font requests.
- PSI evidence after topper showed mobile 100 and desktop 98 in stored reports.
- Zaraz owns GA4 `G-5PFVF8Y3NT`, Heap, and Ahrefs.
- Heap uses `interaction-only-queue-v2`, with passive timers disabled.
- Consent purposes present: `Analytics & Performance` and `Marketing & Leasing Attribution`.
- `llms.txt` live: H1 present, 10 links, first line `# The Vine Kyle Parkway`.

The Vine gaps or cautions:

- The Vine Worker lives inside `ops/cloudflare/edge-transparent-pricing-intro/worker.js`, mixed with older edge-message/Pilot logic. It must not be copied as the canonical package.
- The Vine audit did not show a Resi event bridge tool in Zaraz. That is a package gap unless an approved exception exists.
- Desktop still showed `HEAP_JS_DEBUG` in a simple body scan. The future package must strip direct debug/bootstrap residue everywhere analytics are Zaraz-owned.
- Native continuation evidence for The Vine focuses on promo/header/hero and does not prove first two copied content blocks. If the final package requires first two blocks for every property, The Vine alone is incomplete.

## Ahrefs State

Dry-run plan: `/tmp/ahrefs_admin_readonly/ahrefs_project_plan_20260809T004209Z.json`

Confirmed existing projects:

| Property | Existing Ahrefs Project | Project id | Target |
|---|---:|---:|---|
| The Vine Kyle Parkway (`TX4EK`) | `The Vine Kyle` | `10125260` | `thevinekyle.com/` |
| Townestone at 359 (`TX4FC`) | `Townestoneat359` | `9051293` | `townestoneat359.com/` |

Rule:

- Lookup existing project first.
- Do not create a duplicate project for the vanity domain.
- Name normalization is manual/UI-only based on current API posture.
- Do not create future `venterraliving.com/apartments/...` prefix projects until the governed identity matrix moves the website URL.

## Captain State

Historical activation seed evidence:

- `/Users/mark/Property_Analytics/reports/captains_log/activation/chunks_seed_only/captain_activation_tx4fc_tx4ek_2026-08-04.json`
- `/Users/mark/Property_Analytics/reports/captains_log/activation/chunks_seed_only/captain_activation_tx4fc_2026-08-04.sql`
- `/Users/mark/Property_Analytics/reports/captains_log/activation/chunks_seed_only/captain_activation_tx4ek_2026-08-04.sql`

Historical activation shows:

- Captain Townestone activated for TowneStone at 359 (`TX4FC`) with 11 support agents.
- Captain Vine activated for The Vine Kyle Parkway (`TX4EK`) with 11 support agents.

Fresh gate status:

- `scripts/audit_captain_active_routines.py` could not assert current state because `/Users/mark/Property_Analytics/config/captain_active_routine_manifest.json` was missing.
- Therefore a future launch package may cite historical activation as evidence, but must stop before saying Captain is current/ready unless a fresh readback passes.

## GSC And Indexing State

Reference report:

- `/Users/mark/Property_Analytics/reports/gsc_townestone_vine/20260803_audit/AUDIT_READOUT.md`

Historical findings:

- The Vine: `sc-domain:thevinekyle.com`, 203 clicks, 1095 impressions, CTR 18.54%, average position 14.0; URL Inspection 6/6 passed indexed at that time.
- TowneStone: `sc-domain:townestoneat359.com`, 216 clicks, 691 impressions, CTR 31.26%, average position 4.4; URL Inspection 1/6 passed, other pages unknown/discovered/not indexed at that time.

Package rule:

- GSC is not a performance-only gate. It must record property ownership, sitemap/indexability, key URL inspection, request-indexing status where appropriate, and stale identity checks.

## Canonical Lessons

1. The mobile shell is the optimization architecture; native desktop remains the visual contract unless explicitly approved otherwise.
2. Visual proof beats headers. Headers can identify the route, but screenshots and computed checks prove the page is not raw, duplicated, or mis-styled.
3. GET proof is mandatory. HEAD may not execute the same branch.
4. The initial mobile document must be edge-owned, lightweight, and free of native WordPress/YOOtheme runtime blockers.
5. The lazy native continuation must not duplicate shell-owned sections.
6. Analytics must live in Zaraz; WordPress direct GTM/gtag/Heap/Ahrefs/Resi loaders are blockers.
7. Heap must be interaction-only, with passive timers disabled.
8. Consent must include both required purposes, all enabled tools must be assigned to a purpose, and reject must block network leakage.
9. Ahrefs is lookup-first.
10. Captain cannot be asserted from memory alone; current readback is required.
11. `llms.txt`, schema/meta/OG, phone attribution, tracking attributes, special text, source IDs, and reviews are package elements, not optional polish.
12. Champions and Calais are lessons, not proof of the package. TowneStone and The Vine are the current reference implementations; the actual scalable package still must be extracted.

## Required Next Artifact

Before another property is mutated, create a shared package with:

- one shell renderer
- one CSS token contract
- one continuation/dedupe module
- one analytics/CMP module
- one source-attribution phone module
- one `llms.txt`/SEO module
- one manifest schema
- one validator suite
- one evidence packet generator

Until that artifact exists and passes validators for TowneStone and The Vine, no property may be described as receiving "the exact same package."
