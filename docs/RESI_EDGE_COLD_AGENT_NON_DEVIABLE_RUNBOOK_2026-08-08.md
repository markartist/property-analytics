# Resi Edge Cold-Agent Non-Deviable Runbook

Date: 08/08/2026
Audience: an outside agent with repository access but no thread memory
Status: mandatory build-and-launch contract
Source references: Champions Green base, plus TowneStone at 359 and The Vine Kyle Parkway fixtures

08/11/2026 current execution lock: this runbook is executable only through `/Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py`. Do not translate it into hand work. Do not run Cloudflare, Zaraz, Ahrefs, WordPress, DNS, cache, or Worker changes outside the runner unless Mark explicitly approves that exact exception in the current task. If the runner fails, the process failed; rollback if mutation occurred, write evidence, and stop for discussion.

08/12/2026 Vine golden-source reset: the working The Vine Kyle Parkway mobile topper is the golden template. The package must copy its structure and populate data only. Read `/Users/mark/Property_Analytics/docs/RESI_EDGE_VINE_GOLDEN_TEMPLATE_LOCK_2026-08-12.md` before using this runbook. Protected references may only be validated or captured. A generated package must never be deployed over The Vine, TowneStone, or another protected reference to "level set" it.

08/11/2026 Ventana readiness state: `ventanaapts.com` is a selected target with preflight resolved, but it is not live-upgraded. The latest live apply rolled back successfully after the analytics proof used a synthetic query URL that the site/WAF returned as `403`; GA4 realtime on the canonical homepage did show Ventana events. The runner has been corrected to call analytics smoke with `--no-unique-query`. Next allowed command after a green plan is:

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code TX4VE \
  --domain ventanaapts.com \
  --mode apply \
  --require-live-proof
```

If this command fails any gate, stop. Do not modify the package, retry, or create a workaround until Mark reviews the failed evidence.

08/11/2026 PSI timing correction: a PageSpeed/Lighthouse `500` with no returned score is a transient proof condition. The runner may retry only the affected PSI strategy after a bounded stabilization wait. A measured mobile or desktop score below `90` is still a hard failure and must not be retried as timing.

08/11/2026 parity hardening: the package now treats `90+` as the minimum floor, not the success definition. A live property is not equivalent to the proven package unless the mobile PSI parity gate clears `98+`, all required PSI samples return scores, the initial mobile shell carries only the LCP hero as an eager image, the first two content-block images are deferred by the canonical loader, and all R2 assets pass role-specific byte budgets. The runner must generate and upload the optimized asset packet through the canonical asset builder/uploader before Worker deploy. If asset generation, upload, R2 byte/readback, content-type, cache, mobile parity, or initial-payload gates fail, rollback if needed and stop.

08/10/2026 Champions base supersession is now superseded by the 08/12/2026 Vine golden-source reset. Champions is retained as a lesson source and future target candidate only. Do not reuse the old experimental Champions Worker, old legacy Champions manifest, or any generated Champions lookalike as implementation source.

08/09/2026 reconciliation: read `/Users/mark/Property_Analytics/docs/RESI_EDGE_THREAD_RECONCILIATION_AND_LOCKED_REQUIREMENTS_2026-08-09.md` before using this runbook. That record is the active lock on no-deviation execution, Pilot-first application, and stop-on-failure behavior.

08/09/2026 package artifact status: the canonical package now exists at `/Users/mark/Property_Analytics/ops/cloudflare/shared/resi-edge-package/runtime.mjs` with package id `resi-edge-canonical-upgrade-package` and version `2026-08-09.canonical-runtime-v1`. Pilot uses `/Users/mark/Property_Analytics/ops/cloudflare/resi-edge-canonical-worker/worker.js` plus `/Users/mark/Property_Analytics/config/portfolio_resi_edge_stabilization/pilot-ga4ax.manifest.json`. Static validation, Pilot plan mode, and Wrangler dry-run pass after the Wrangler account config correction. The first apply attempt failed before mutation, so do not run a second live apply unless Mark explicitly approves it.

## Prime Directive

Do not improvise. Do not rebuild a lookalike. Do not choose a subset. Do not call anything "same as TowneStone/Vine" unless the shared package artifact, property manifest, and every stop gate in this runbook pass on the live production hostname.

The target operator is an ignorant agent. That agent should not need thread history, design taste, memory of prior mistakes, or judgment about which tasks matter. The agent should be able to run the package, read pass/fail output, and stop when instructed.

There are no live property "versions" in this process. The package has one canonical identity. A run either passes or fails. If it fails, record the failed run, correct the shared package or manifest, and rerun the same canonical package. Do not create or promote a sequence of property-specific v1/v2/v3 fixes.

This runbook has two modes:

1. Package extraction mode: build or update the shared package.
2. Property execution mode: apply the already-extracted package to one property.

If the shared package artifact does not exist, the only allowed work is package extraction mode. Do not mutate a live property while pretending a package exists.

## Required Automation Interface

The final package is not complete until this interface exists:

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code PROPERTY_CODE \
  --domain DOMAIN \
  --mode plan
```

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code PROPERTY_CODE \
  --domain DOMAIN \
  --mode validate-reference
```

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code PROPERTY_CODE \
  --domain DOMAIN \
  --mode apply \
  --require-live-proof
```

The command must:

- load governed identity
- load and validate the property manifest
- refuse execution if the package artifact/hash is missing
- refuse execution if the property Worker contains custom shell logic
- run the governed Zaraz analytics package upsert before Worker deploy
- generate optimized assets through `/Users/mark/Property_Analytics/scripts/generate_resi_edge_assets.py`
- upload optimized assets through `/Users/mark/Property_Analytics/scripts/upload_resi_edge_assets_to_r2.py`
- block if the mobile hero exceeds `80 KB`, first two AVIF content-block images exceed `55 KB`, R2 readback lacks immutable cache, or any same-origin R2 marker/content type is wrong
- verify source attribution phones
- verify specials/reviews/content blocks
- configure or verify Zaraz analytics
- configure or verify Zaraz consent
- verify Ahrefs lookup-first state
- verify `llms.txt`, meta, schema, and tracking attributes
- verify Captain state or explicitly mark it blocked
- deploy only after preflight passes
- purge cache
- run live browser proof
- run live analytics/consent proof
- run PSI
- require mobile PSI reference parity, currently `98+`, in addition to the desktop `90+` floor
- write the evidence packet
- write a final pass/fail readout

The command must stop at the first failed mandatory gate unless an approved exception file is supplied. The exception file must name the gate, reason, approver, date, and scope. Without that file, no failed gate may be bypassed.

The command must not use synthetic query parameters for final live analytics smoke. Several domains can WAF-block unusual query strings. Use the canonical homepage URL unless an approved WAF bypass is written in the evidence packet.

## Reference Replay Gate

Current golden reference command:

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code TX4EK \
  --domain thevinekyle.com \
  --mode validate-reference
```

Expected result: reference validation passes and no live mutation occurs. If the command attempts to mutate live infrastructure, stop.

Before the package can be applied to any live production property, it must replay against both reference properties in validation mode:

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code TX4FC \
  --domain townestoneat359.com \
  --mode validate-reference
```

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code TX4EK \
  --domain thevinekyle.com \
  --mode validate-reference
```

Both reference replays must pass. A pass means the shared package reproduces the required TowneStone and The Vine behaviors through the package interface, not through hand-coded property Workers.

Stop if either reference replay fails.

## Earlier Pilot Test Property Gate - Superseded Unless Re-Selected

08/10/2026 supersession: Pilot is no longer the automatic first apply target unless Mark explicitly selects it again. Use this section only after a separate target decision is recorded.

Earlier target details retained for reference:

- domain: `pilot.venterradev.com`
- purpose: prove the package runner, manifest schema, validators, evidence packet, visual composition, analytics, consent, source attribution, and rollback behavior before touching live standalone property domains
- status: test/proving ground, not a substitute for later production proof

Required sequence:

1. Run TowneStone reference replay.
2. Run The Vine reference replay.
3. Run Pilot plan mode.
4. Run Pilot apply mode only after the plan has no failed mandatory gates.
5. Run Pilot live proof.
6. Fix only the shared package or Pilot manifest when gates fail.
7. Rerun from the top of the failed stage.
8. Do not hand-patch Pilot outside the package.
9. Do not touch TowneStone, The Vine, or any other live property until Pilot passes as the benchmark.

Required Pilot command:

```bash
python3 /Users/mark/Property_Analytics/scripts/run_resi_edge_upgrade.py \
  --property-code PILOT \
  --domain pilot.venterradev.com \
  --mode apply \
  --require-live-proof
```

The final Pilot readout must become the benchmark packet for the next stage. If Pilot fails, the package is not ready.

## Live Level-Set Gate

After Pilot passes, level-set the two reference live sites through the same package path:

1. TowneStone live level-set.
2. The Vine live level-set.

This stage is not a rebuild-by-hand. It is a controlled run through the same package runner. If TowneStone or The Vine would regress, stop and fix the shared package or manifest. Do not manually adjust the live site to make the proof pass.

## Absolute Stop Gates

Stop immediately and report the failure if any of these are true:

- There is no reset card for the property.
- There is no canonical package identity and content hash.
- The Worker contains property-specific shell markup or CSS outside the manifest adapter.
- The property manifest fails schema validation.
- Source identity cannot be resolved through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` or `/Users/mark/Property_Analytics/config/property_identity_matrix.json`.
- Credentials are not available through Keeper/KSM helpers.
- Ahrefs lookup has not been performed before any create/setup action.
- Zaraz tools are enabled without consent purposes.
- A required analytics tool remains directly injected by WordPress when Zaraz owns it.
- The governed Zaraz analytics package upsert fails before Worker deploy.
- A manual Zaraz loader is present in the Worker. Cloudflare Zaraz auto-injection is the only approved loader.
- The live GET proof is missing.
- Browser screenshot proof is missing.
- Desktop contains a mobile shell/topper without explicit approval.
- Desktop is raw/unstyled/default blue-link HTML.
- Mobile initial document includes native WordPress/YOOtheme runtime blockers.
- Mobile initial document eagerly loads shell-owned welcome/features/content-block images instead of deferring them.
- Mobile hero optimized AVIF exceeds `80 KB`.
- First two content-block AVIF assets exceed `55 KB`.
- R2 readback does not prove same-origin R2 marker, expected image content type, and `public, max-age=31536000, immutable` cache.
- Mobile shell omits required shell-owned sections.
- Lazy native continuation duplicates shell-owned sections.
- `llms.txt` lacks a Markdown H1 or links.
- Phone attribution cannot prove default VWS and source-coded numbers where required.
- Fresh Captain readback is unavailable and the readout attempts to call Captain ready.
- PSI is run before browser architecture proof.
- Mobile PSI returns a measured score below the reference-parity target. Do not call this timing and do not retry as a workaround.
- Any proof is local-only, workers.dev-only, or preview-only when the claim is about production.

## Vocabulary Lock

Allowed only after all relevant gates pass:

- `ready`
- `done`
- `complete`
- `approved`
- `exact`
- `same as TowneStone/Vine`
- `package applied`
- `production proven`

If any gate is missing, use:

- `blocked`
- `partial`
- `historical evidence only`
- `not asserted`
- `requires approved exception`

## Canonical Package Boundary

The final scalable package must be one shared implementation. The property Worker may only:

- load the shared package
- load the property manifest
- route traffic by hostname and device class
- pass request/context into the shared package

The property Worker must not define:

- custom shell HTML
- custom shell CSS
- custom drawer markup
- custom analytics snippets
- custom consent UI
- custom continuation dedupe CSS
- custom phone replacement logic
- custom `llms.txt` templates
- custom star/review rendering

All property variation belongs in the manifest.

## Canonical Files And Inputs

Read these before any execution:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_TOWNESTONE_VINE_CANONICAL_AUDIT_2026-08-08.md`
- `/Users/mark/Property_Analytics/docs/RESI_EDGE_ACCOUNTABILITY_AND_FULL_PACKAGE_RESET_2026-08-08.md`
- `/Users/mark/Property_Analytics/docs/RESI_PROPERTY_UPGRADE_RUNBOOK_2026-08-08.md`
- `/Users/mark/Property_Analytics/docs/RESI_SOURCE_ATTRIBUTION_LOOKUP_RUNBOOK_2026-08-06.md`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

Reference Workers:

- TowneStone: `/Users/mark/Property_Analytics/ops/cloudflare/townestone-native-optimizer/worker.js`
- The Vine: `/Users/mark/Property_Analytics/ops/cloudflare/edge-transparent-pricing-intro/worker.js`

These Workers are reference implementations only. Do not copy either file into a new property as the package.

## Manifest Contract

Each property manifest must include these fields:

- `property_code`
- `property_name`
- `domain`
- `canonical_url`
- `city`
- `state`
- `community_id`
- `ga4_property_id`
- `ga4_measurement_id`
- `gsc_property`
- `ahrefs_existing_project_id`
- `ahrefs_target`
- `heap_app_id`
- `default_phone_label`
- `default_phone_number`
- `source_phone_lookup`
- `tour_url`
- `apply_url`
- `availability_url`
- `special_title`
- `special_body`
- `special_disclaimer`
- `hero_title_text`
- `hero_image_mobile`
- `review_rating`
- `review_count`
- `review_url`
- `review_source`
- `review_last_verified`
- `content_blocks`
- `award_assets`
- `brand_theme`
- `font_assets`
- `llms_links`
- `schema_identity`
- `meta_title`
- `meta_description`
- `og_image`
- `zaraz_tools`
- `consent_purposes`
- `captain_id`
- `captain_evidence_path`

Allowed variation:

- property names, codes, IDs, phone mappings, URLs, specials, assets, colors, fonts, review values, and copy pulled from approved sources.

Not allowed variation:

- shell structure, lazy-loading behavior, consent behavior, analytics ownership, validation gates, evidence naming, or readiness language.

## Source Authority

Use this source order:

1. Governed identity matrix for property IDs, community IDs, GA4/GSC IDs, website URLs.
2. Feed/source-of-record for specials, phone attribution IDs, floorplan/availability context, and property source lookup.
3. Live native property page for visual geometry, copy sequence, fonts, colors, nav labels, and first content blocks.
4. GSC/GA4/Ahrefs/Zaraz APIs for platform state.
5. User-approved manual override only when the source is missing or wrong.

Do not use the specials page as the source of truth when the feed carries the actual special.

## Build Sequence

### 1. Reset Card

Create a reset card before touching the property.

Required fields:

- property code
- domain
- current Worker and route state
- current DNS/CDN state
- current WordPress script state
- current Zaraz state
- current Ahrefs project state
- current GSC state
- current Captain state
- current known blockers
- explicit statement of what will and will not be changed

Stop if the reset card is missing.

### 2. Identity Resolution

Resolve identity from the governed matrix.

Required command:

```bash
python3 - <<'PY'
import json
code = "PROPERTY_CODE_HERE"
m = json.load(open("/Users/mark/Property_Analytics/config/property_identity_matrix.json"))
for p in m.get("properties", []):
    if p.get("property_code") == code or p.get("canonical_property_id") == code:
        print(json.dumps(p, indent=2))
        break
else:
    raise SystemExit(f"missing property identity: {code}")
PY
```

Stop if:

- property code is missing
- community id is missing
- website URL conflicts with the intended domain
- GA4 or GSC ID is absent and the package requires it

### 3. Live Baseline

Capture production baseline before changes.

Required proof:

- mobile GET headers
- desktop GET headers
- mobile screenshot
- desktop screenshot
- body marker scan
- script/analytics scan
- `llms.txt`
- robots/meta/canonical
- current PSI mobile and desktop
- current GSC/indexing state if launch/indexing is in scope

GET headers are required. HEAD is not enough.

### 4. Source Manifest

Build the property manifest from source data.

Required checks:

- special title comes from feed/source-of-record and uses marketing casing, such as `Up To ...` when applicable
- special body/disclaimer are sourced or approved
- default phone is VWS attribution, not office phone
- source-coded incoming URL IDs map to attribution phone numbers
- review rating, count, and link are sourced and timestamped
- partial stars are rendered when rating is not a whole number
- no `TM` is added to LBLE unless the user explicitly approves a golden-source update
- brand theme captures lease-up colors
- fonts use actual site fonts when available
- first two content blocks match native mobile sequence, including award/badge position and mobile hidden-media behavior

Stop if any required source is guessed.

### 5. Shared Package Render

Render the mobile shell from the shared package only.

Required locked structure:

1. promo bar
2. mobile header
3. full-height hero
4. review row when sourced
5. Vine golden LBLE text-mark treatment
6. primary headline/subheadline
7. primary CTA
8. first native content block
9. award/badge if native sequence places it there
10. second native content block
11. lazy native continuation
12. consent pill/preferences entry point

Required geometry target for 390px mobile test viewport:

- promo: 60px
- header: 80px
- hero starts at y=140
- hero height: approximately 704px
- no horizontal overflow

Stop if the shell is hero-only, omits the first two content blocks when required, duplicates native sections, or changes desktop.

### 6. Native Continuation

The lazy continuation must load only after user intent or scroll.

Required behavior:

- initial state is idle/not loaded
- after scroll, iframe loads
- iframe is same-origin route
- iframe has noindex
- iframe hides shell-owned native sections
- iframe begins at the correct next section
- iframe height is sized to content
- no duplicate welcome/features/promo/hero blocks

Stop if a screenshot after scroll is missing.

### 7. Desktop Lane

Desktop is native unless Mark explicitly approves a desktop shell.

Required desktop behavior:

- no mobile topper marker
- no standalone mobile shell markup
- native header visible and styled
- native hero visible and styled
- no raw/default blue-link HTML
- no horizontal overflow
- desktop analytics cleanup still applies
- desktop consent still applies

Stop if desktop rendering is judged only from headers.

### 8. Analytics Ownership

Zaraz owns analytics.

Required tools:

- GA4
- Heap
- Ahrefs
- Resi event bridge
- Cloudflare Web Analytics/RUM posture recorded when applicable

Required behavior:

- GA4 pageviews and all custom `zaraz.track()` events routed through Zaraz
- Heap installed through Zaraz in `interaction_only_queue_v6_input_only_cs_verify_home_204`
- passive Heap timers disabled
- no passive or late-passive Heap/Contentsquare network in readiness proof
- Contentsquare verify-installation handling is limited to same-origin `/?vtr_cs_verify_suppressed=1` returning `204`
- no manual Zaraz loader in the Worker; Cloudflare Zaraz auto-injection owns the loader
- Ahrefs installed through Zaraz with property-specific data-key
- Resi event bridge captures leasing actions
- WordPress direct GTM/gtag/Heap/Ahrefs/Resi Pixel scripts removed or blocked

Stop if any direct loader remains active outside Zaraz without an approved exception.

### 9. Consent Management

Cloudflare Zaraz Consent Management is the owner.

Required purposes:

- `Analytics & Performance`
- `Marketing & Leasing Attribution`

Required proof:

- read-only Zaraz config audit passes
- every enabled tool has a purpose
- first-visit UI visible
- preferences UI visible
- reject sets both purposes false
- accept sets both purposes true
- no GA/Heap/Ahrefs/Resi/Contentsquare leakage before consent or after reject

Required command:

```bash
python3 /Users/mark/Property_Analytics/scripts/audit_zaraz_consent_package.py --domain DOMAIN_HERE
```

Stop if the command fails.

### 10. Ahrefs

Lookup first.

Required command:

```bash
python3 /Users/mark/Property_Analytics/scripts/ahrefs_project_admin.py --limit 200 --output-dir /tmp/ahrefs_admin_readonly
```

Required proof:

- existing project id or explicit missing state
- target URL
- project name
- duplicate check

Stop if a duplicate would be created.

TowneStone reference:

- project id `9051293`
- target `townestoneat359.com/`

The Vine reference:

- project id `10125260`
- target `thevinekyle.com/`

### 11. SEO, AI, And Identity Cleanup

Required checks:

- title
- meta description
- canonical
- robots
- OG title/description/image
- Twitter card fields
- schema `url`
- schema property name/code
- tracking attributes
- stale property references
- stale Kinsta validation or Apex/TX054 residue
- `llms.txt`
- XML sitemap link
- GSC property and URL inspection state

Required `llms.txt` minimum:

- Markdown H1
- property description
- current date
- homepage link
- apartments link
- features link when present
- amenities link
- gallery link
- neighborhood link
- specials link when present
- contact link
- search link
- XML sitemap link

Stop if `llms.txt` has no H1 or no links.

### 12. Captain And Control Surface

Historical Captain seed is not enough for launch readiness.

Required:

- fresh Captain active routine readback
- support lanes present
- open blockers/actions reflected
- control surface displays live state, done state, running state, next action, blockers, and evidence cards

If the routine manifest/readback is missing, write:

`Captain readiness not asserted; fresh audit blocked by missing active routine manifest.`

Do not write:

`Captain ready`

### 13. Validation Before Deploy

Required local checks:

```bash
npx wrangler deploy --dry-run --outdir /tmp/resi-edge-dryrun-PROPERTY_CODE
node /Users/mark/Property_Analytics/scripts/validate_resi_mobile_shell_contract.mjs https://DOMAIN_HERE/
bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh
bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh
```

Use Keeper-backed Cloudflare auth helpers. Do not create local credential files.

Stop if any check fails.

### 14. Deploy And Purge

Only deploy after all pre-deploy gates pass.

Required after deploy:

- Worker version readback
- route readback
- Cloudflare cache purge for homepage and continuation URL
- R2 asset readback if assets are served from R2

Stop if route readback does not match intended hostname/path.

### 15. Live Acceptance

Live production proof must include:

- mobile GET header proof
- desktop GET header proof
- clean mobile screenshot at first view
- mobile promo open screenshot
- mobile drawer open screenshot
- mobile after-scroll continuation screenshot
- desktop screenshot
- browser console/network proof
- no bad responses except approved baseline vendor noise
- no horizontal overflow
- phone link proof
- source-coded phone proof where applicable
- analytics passive proof
- consent accept/reject proof
- `llms.txt` proof
- Ahrefs lookup proof
- GSC/indexing proof or recorded blocker
- Captain proof or recorded blocker
- PSI mobile
- PSI desktop

Stop if screenshots do not match the expected page.

### 16. PSI Rule

Goal: 90+ mobile and 90+ desktop.

PSI is the final confirmation, not the first validation.

Required:

- run after live browser proof
- record exact/fresh status if applicable
- store JSON response and summary
- include LCP, FCP, TBT, CLS, request count
- include screenshot thumbnail proof

Do not chase unscored PSI warnings if the fix lowers the primary score.

### 17. Readout

Every property readout must state:

- canonical package identity/content hash
- manifest path
- Worker name/version
- route
- live status
- changed items
- unchanged items
- proof paths
- passed gates
- failed gates
- approved exceptions
- next action

If a gate failed, the first line must be:

`Status: blocked`

## Evidence Packet Structure

Use this structure:

```text
reports/resi_edge_performance/MM-DD-YYYY/PROPERTY_SLUG/package-VERSION/
  reset-card.md
  manifest.json
  source-readback/
  dry-run/
  deploy-readback/
  headers/
  browser/
    mobile-first-view.png
    mobile-promo-open.png
    mobile-drawer-open.png
    mobile-after-scroll.png
    desktop.png
    browser-proof.json
  architecture/
    mobile-shell-proof.json
  analytics/
    zaraz-config-before.json
    zaraz-config-after.json
    passive-smoke.json
    interaction-smoke.json
  consent/
    zaraz-consent-audit.json
    browser-consent-proof.json
  ahrefs/
    project-lookup.json
  gsc/
    inspection-readout.json
  captain/
    readback.json
  psi/
    mobile.json
    desktop.json
    summary.md
  final-readout.md
```

## Required Validator Assertions

The validator suite must fail on:

- missing canonical package identity/content hash
- property-specific shell CSS in Worker
- initial mobile document over agreed byte limit
- native WordPress/YOOtheme scripts in initial mobile shell
- native DAM hero image as mobile LCP when optimized same-origin image is required
- missing promo/header/hero
- hero height below contract
- missing review row when review source is present
- whole-star rendering when rating is partial
- missing first two content blocks when required
- missing award/badge when native sequence includes it
- duplicated shell-owned sections in continuation
- desktop mobile shell marker
- desktop raw blue-link render
- direct GTM/gtag/Heap/Ahrefs/Resi loader leakage
- missing Zaraz tool purpose
- Heap passive timer mode
- Ahrefs duplicate create risk
- missing `llms.txt` links
- stale property code/name in tracking attributes
- unverified phone mapping
- missing screenshot proof
- missing fresh live GET proof

## Current Reference Evidence To Re-Run Against Package

Before applying to any third property, run the extracted shared package against TowneStone and The Vine in validation mode and compare to these evidence packets:

- TowneStone browser: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v19/browser-smoke-summary.json`
- TowneStone nav: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/townestone-mobile-topper-production-v21-qa/summary.json`
- TowneStone architecture: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/townestone/architecture/mobile-shell-proof.json`
- TowneStone consent: `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/20260809_004042_zaraz_consent_audit.json`
- The Vine browser: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/browser-qa.json`
- The Vine font fix: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-06/thevine-mobile-topper-production-v1/browser-console-font-fix-v3.json`
- The Vine brand theme: `/Users/mark/Property_Analytics/reports/resi_edge_performance/2026-08-07/thevine-brand-theme-v4/live-brand-theme-proof.json`
- The Vine architecture: `/Users/mark/Property_Analytics/reports/resi_edge_performance/08-07-2026/the-vine/architecture/mobile-shell-proof.json`
- The Vine consent: `/Users/mark/Property_Analytics/reports/cloudflare_zaraz/consent_management/20260809_004044_zaraz_consent_audit.json`

Stop if the extracted package cannot reproduce the applicable reference behaviors on both reference properties.

## What The Agent Must Not Do

- Do not use the old Champions prototype Worker or old legacy Champions manifest as the package source.
- Do not reuse any prior Champions implementation as proof of the package; only the fresh Champions base manifest and current package validators count.
- Do not copy Calais as the clean model; use Calais only as a failure-pattern checklist.
- Do not apply only the mobile topper and defer analytics silently.
- Do not touch desktop visually unless explicitly approved.
- Do not decide that first two blocks, reviews, awards, fonts, consent, Ahrefs, phone attribution, schema, or `llms.txt` can wait.
- Do not claim success from PSI while screenshots are wrong.
- Do not claim success from local proof.
- Do not create duplicate Ahrefs projects.
- Do not create direct credential files.
- Do not print secrets.

## Required Completion Statement

The final readout for a completed property must include this exact line:

`All mandatory gates passed on the live production hostname with no unapproved exceptions.`

If that line is not true, do not write it.
