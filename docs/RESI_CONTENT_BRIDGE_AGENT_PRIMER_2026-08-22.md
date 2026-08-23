# Resi Content Bridge Agent Primer

Date: 08/22/2026
Audience: Codex / future Data Pond implementation agents
Status: Required context before extending Resi content integration

## Read This First

This project is no longer an API experiment. It is an emerging operating model for connecting Resi's live content system into Venterra's Data Pond, content workflows, Captain/Navigator, VACS, Site Content, Content Office, property groups, and supervisors.

The correct mental model:

> Resi remains the live external CMS/source system. Data Pond becomes the governed content brain. Resi Content Bridge is the narrow, auditable hand that applies approved changes and proves them.

Do not treat Resi as a sandbox. Do not treat the bridge as a bulk editor. Do not make live Resi writes unless Mark explicitly approves the specific mutation in the current task.

## Canonical Local Assets

Operational bridge:

- `/Users/mark/Property_Analytics/scripts/resi_content_bridge.py`
- `/Users/mark/Property_Analytics/docs/RESI_CONTENT_BRIDGE_RUNBOOK_2026-08-21.md`

Inventory foundation:

- `/Users/mark/Property_Analytics/Data_Collection/collectors/resi_v2_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/resi_v2_content_inventory_collector.py`
- `/Users/mark/Property_Analytics/docs/RESI_CONTENT_INVENTORY_DATA_POND_INTEGRATION_2026-08-20.md`

Schema:

- `/Users/mark/Property_Analytics/apps/api/migrations/0063_create_resi_v2_api_snapshots.sql`
- `/Users/mark/Property_Analytics/infra/migrations/040_create_resi_v2_api_snapshots.sql`
- `/Users/mark/Property_Analytics/apps/api/migrations/0064_create_resi_content_inventory_tables.sql`
- `/Users/mark/Property_Analytics/infra/migrations/041_create_resi_content_inventory_tables.sql`

Partner-facing material:

- `/Users/mark/Property_Analytics/docs/RESI_API_FINDINGS_AND_CAPABILITIES_SUMMARY_FOR_RESI_2026-08-21.md`
- `/Users/mark/Property_Analytics/reports/resi_api/resi_api_findings_architecture_summary_2026-08-21.docx`
- `/Users/mark/Property_Analytics/reports/resi_api/build_resi_api_findings_word_doc.py`

Memory/register/audit records:

- `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
- `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
- `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`

## API Shape

Resi V2 management API:

- Base: `https://v2.getresi.com/api/v2`
- Authenticated with a Bearer token resolved through Keeper/KSM by `/Users/mark/Property_Analytics/utils/resi_auth.py`
- Used for management reads and the first validated content write
- Validated read endpoints include `/me`, `/properties`, `/lead-sources`, and content endpoints
- Validated write endpoint so far: `PATCH /faqs/{id}` for an approved FAQ answer update

Resi V1 public/delivery API:

- Base: `https://v2.getresi.com/api/v1`
- Used for public delivery readback and cache clearing
- Validated cache endpoint: `POST /cache/clear`
- Cache body must contain exactly one target, such as `property_id`
- Resi confirmed website cache clearing exists in V1 today and is not yet present in V2

Keep this split unless Resi later changes the API:

- V2 = management/content layer
- V1 = public delivery and cache proof layer

## Credential Discipline

Keeper/KSM is mandatory.

Use the existing helper:

```python
from utils.resi_auth import resolve_resi_credentials
```

Never print, log, paste, or summarize raw token material. Do not create `.env` files or local credential files. If a credential is missing, ask for it to be added to Keeper/KSM and documented through the existing manifest/helper path.

## Current Data Pond Tables

Core snapshot:

- `resi_v2_api_snapshots`

Content inventory:

- `resi_content_inventory_runs`
- `resi_content_objects`
- `resi_content_property_links`
- `resi_content_fields`
- `resi_content_changeability_rules`

Cross-system and workflow:

- `pond_content_system_bindings`
- `pond_content_change_requests`

The bridge must sit on these tables. Do not create a parallel Resi content database, one-off property map, or private side ledger.

## Known Inventory Evidence

Latest foundational V2 property/source proof:

- Snapshot: `resi_v2_bdf1c63ebece`
- Fetched: `08/20/2026`
- Account: `Venterra`
- Properties observed: `98`
- Lead sources observed: `1,168`
- Lookup rows after de-duplication: `1,142`
- Properties mapped in the first source lookup: `93`

Latest foundational content inventory proof:

- Run: `resi_content_3fb41752b3aa`
- Fetched: `08/20/2026 7:06 PM CT`
- Content objects captured: `52,472`
- Field facts captured: `140,673`
- Read-only GET requests: `795`
- Media: skipped intentionally in this run

Property-link coverage:

- Reviews: `24,363` links across `90` properties
- Content items: `12,775` links across `93` properties
- Content blocks: `8,785` links across `93` properties
- Neighborhood places: `6,037` links across `93` properties
- Amenities: `5,528` links across `92` properties
- FAQs: `2,260` links across `92` properties
- Galleries: `190` links across `93` properties
- Announcements: `22` links across `17` properties

Known identity/data warnings:

- `Venterra Theme Backup (Depreciated)` has no `reference_id`
- `Sundara` has no `reference_id`
- `Non-YS Training` uses unresolved `TRNYS`
- `TX4RB` had no lead sources in the first V2 lookup
- Some duplicate source tracking IDs were collapsed in the lookup build

Do not paper over these warnings downstream. Resolve new identifiers through the governed property identity matrix path.

## Field Editability Classes

Current classes:

- `safe_content_change`
- `publication_sensitive`
- `legal_sensitive_copy`
- `media_global_asset_change`
- `media_local_embed_change`
- `rights_sensitive`
- `operational_sensitive`
- `read_only_or_unmapped`

Interpretation:

- `safe_content_change` can become editable only through explicit approval and bridge proof.
- `publication_sensitive` can hide/reveal live content and needs elevated review.
- `legal_sensitive_copy` needs policy/legal/business proof.
- `media_global_asset_change` can affect every placement of an asset.
- `media_local_embed_change` may be placement-scoped but still needs media/feed review.
- `rights_sensitive` covers reviews and similar sourced content.
- `operational_sensitive` covers PMS/pricing/fee-like facts and should not be treated as marketing copy.
- `read_only_or_unmapped` is not approved for editing.

## Current Bridge Commands

Read local inventory snapshot:

```bash
python3 scripts/resi_content_bridge.py show-faq \
  --property-code TX4EK \
  --question "Can I tour The Vine?"
```

Read live V2:

```bash
python3 scripts/resi_content_bridge.py read-v2-faq \
  --property-code TX4EK \
  --faq-id 019ebdff-c18d-7195-80cc-e1e61b42e2df \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"
```

Verify public V1 delivery:

```bash
python3 scripts/resi_content_bridge.py verify-public-faq \
  --property-code TX4EK \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"
```

Apply approved FAQ answer:

```bash
python3 scripts/resi_content_bridge.py apply-faq-answer \
  --property-code TX4EK \
  --faq-id 019ebdff-c18d-7195-80cc-e1e61b42e2df \
  --question "Can I tour The Vine?" \
  --answer-html '<p>Approved answer HTML goes here.</p>' \
  --confirm APPLY_RESI_CONTENT_CHANGE
```

Clear Resi property cache:

```bash
python3 scripts/resi_content_bridge.py clear-property-cache \
  --property-code TX4EK \
  --change-request-id resi_faq_hard_hat_tx4ek_3d1e27857b7e \
  --confirm CLEAR_RESI_CONTENT_CACHE
```

Mutation commands require exact confirm phrases. The confirm phrase is not a substitute for user approval. It is a technical guard after approval.

## First Live Proof

Property:

- The Vine Kyle Parkway
- Property code: `TX4EK`
- Website: `https://thevinekyle.com/`
- Resi property id: `019e6750-98ae-732d-9ef2-f4839506787c`

FAQ:

- FAQ id: `019ebdff-c18d-7195-80cc-e1e61b42e2df`
- Question: `Can I tour The Vine?`
- Change request id: `resi_faq_hard_hat_tx4ek_3d1e27857b7e`
- Local ledger status: `approved` / `applied_readback_verified`

Validated chain:

1. Local content inventory identified the stale FAQ answer.
2. Mark explicitly approved publishing the replacement.
3. Bridge patched V2 FAQ answer.
4. V2 readback matched exactly.
5. Local `pond_content_change_requests` row was recorded.
6. V1 property cache clear returned `202 Accepted`.
7. V1 public FAQ delivery returned updated answer.
8. Mark confirmed the public site rendered the updated FAQ in browser.

Important nuance: local inventory is point-in-time. After a live change, `show-faq` can still show stale pre-change inventory until the next collector run. Use `read-v2-faq` or `verify-public-faq` for present-tense proof.

## Partner Feedback From Resi / Grady

Grady's reply matters. Capture these points in future planning:

- Resi API is still beta, but the nuts and bolts are available.
- Docs are updated with code and nothing is intentionally gated at this stage.
- Website cache clearing is a clear V1 capability and is not present in V2 yet.
- Media should generally not be updated through the API right now because media syncs from Venterra feeds.
- Resi is still working on the right way to handle API activity against external syncing rules.
- Incremental/change-detection support is in development.
- Webhooks/event callbacks/activity logging are on the roadmap and will likely pair with general activity logging in the Resi app.
- Resi's partnership posture is positive: they want Venterra to build where we can run and to provide guidance where needed.

Consequence for agents:

- Keep media read-only until explicit current-task approval from Mark and clear Resi guidance.
- Keep cache clear V1.
- Do not assume incremental sync or webhooks exist yet.
- Use Data Pond snapshots and `pond_content_change_requests` as the local audit ledger until Resi activity logging/webhooks mature.
- Prepare future asks in a collaborative partner tone, not a vendor-defect tone.

## The Pond Integration Direction

Mark intends to introduce this heavily into the Pond.

Expected operating model:

- Data Pond UI shows property-scoped Resi content inventory.
- Users can search/filter by property, object type, field role, editability, freshness, and owning system.
- Content Office governs approval and final content accountability.
- Site Content maps visible website sections to Resi source objects and drafts copy updates.
- VACS generates proposed copy and recommendations, but never writes directly to Resi.
- Captain/Navigator flags stale, thin, inconsistent, or risky content.
- Captain groups aggregate property-level content issues into regional/portfolio views.
- Supervisors review rollups, approve work, and monitor applied/readback status.
- Resi Content Bridge applies approved changes and proves them.

Future user-facing workflow:

1. See current live Resi value.
2. See affected properties and shared/global scope.
3. Draft proposed change.
4. Classify field risk/editability.
5. Route to owner/supervisor approval.
6. Apply with minimal payload through bridge.
7. Read back V2.
8. Clear Resi cache if needed.
9. Verify public V1 delivery.
10. Optionally verify public website/browser layer.
11. Record proof and close loop.

## Planned Build Sequence

Recommended next steps:

1. Add protected Data Pond read API/routes for Resi inventory browsing.
2. Build property-level Content Office view: property -> object -> field -> editability -> current value.
3. Add draft-only change request creation into `pond_content_change_requests`.
4. Add approval workflow states for Content Office, Captains, groups, and supervisors.
5. Extend bridge to non-FAQ object types only after each type has a safe update contract.
6. Add media inventory as read-only first, with global/local placement impact.
7. Add incremental sync if/when Resi exposes filters, activity logs, or webhooks.
8. Create canary workflows for next object types: likely FAQ question, announcement text, or simple amenity/neighborhood labels before nested content blocks.

## Object-Type Caution

FAQ answer is proven.

Not yet proven:

- FAQ question update
- content block update
- nested content item update
- announcement update
- amenity update
- neighborhood place update
- gallery update
- review update
- media file metadata update
- media embed update
- media delete/detach

Content blocks are especially sensitive because nested content items may require parent-payload semantics. Do not patch nested content blocks casually.

Reviews are rights-sensitive. Do not edit review text without explicit business/legal/source approval.

Fees and pricing-adjacent fields are operational/PMS-owned. Do not treat them as marketing copy.

## Public Website Versus API Proof

There are three proof layers:

1. V2 management readback: "Resi management state changed."
2. V1 public delivery readback: "Resi public delivery data changed."
3. Public website/browser check: "The rendered website changed for users."

These can diverge temporarily because of cache, CDN, firewall, or hosted-site behavior.

The Vine proved all three, but note:

- A scripted HTTP check of `https://thevinekyle.com/faqs/` returned `403` at one point while normal app/browser traffic later showed the update.
- The bridge should not confuse website firewall behavior with failed Resi API state.
- Website-page checks are useful evidence, not the sole source of truth for Resi state.

## Guardrails And Stop Rules

Stop and ask Mark before:

- Any live Resi write not explicitly requested in the current task.
- Any bulk Resi write.
- Any media update.
- Any content-block/nested content-item update.
- Any announcement date/publication state update.
- Any review text update.
- Any fee/pricing/operational field update.
- Any cache clear unless Mark asks for it or it is part of an approved test.
- Any host/admin/DNS/Cloudflare/Worker/WordPress/Kinsta change.
- Any change to locked PIB files.

Always:

- Resolve property through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Use `/Users/mark/Property_Analytics/config/property_identity_matrix.json` as identity source.
- Use Keeper/KSM for credentials.
- Record approved changes in `pond_content_change_requests`.
- Preserve before/after hashes.
- Read back after mutation.
- Keep commands and docs human-facing dates in `MM/DD/YYYY`.
- Run governance checks after significant capability/workflow changes.

## Required Checks After Extension

Use the relevant subset, and expand when risk increases:

```bash
python3 -m py_compile scripts/resi_content_bridge.py \
  Data_Collection/collectors/resi_v2_collector.py \
  Data_Collection/collectors/resi_v2_content_inventory_collector.py \
  utils/resi_auth.py

bash scripts/check_pib_guardrails.sh
bash scripts/check_property_identity_governance.sh
bash scripts/check_context_discipline.sh
git diff --check
```

For read-only bridge verification:

```bash
python3 scripts/resi_content_bridge.py read-v2-faq \
  --property-code TX4EK \
  --faq-id 019ebdff-c18d-7195-80cc-e1e61b42e2df \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"

python3 scripts/resi_content_bridge.py verify-public-faq \
  --property-code TX4EK \
  --question "Can I tour The Vine?" \
  --expected-text "The Vine is now offering Hard Hat Tours"
```

## Communication Nuance

When talking to Resi:

- Be collaborative and curious.
- Acknowledge beta status.
- Frame requests as shared improvement loops.
- Avoid implying Resi is deficient when an API feature is not mature.
- Mention that Venterra wants to connect Resi cleanly into our operating systems, not work around Resi.

When talking internally:

- Emphasize that this is a governance system, not just API access.
- Separate "can technically patch" from "approved to patch."
- Explain that local inventory can be stale after a live edit until refreshed.
- Keep media/feed sync and operational/PMS ownership very visible.

## One-Sentence Summary For Future Agents

Use Resi Content Bridge to make approved Resi content changes visible, governed, applied, and proven through Data Pond; do not expand write scope until the object type, approval path, property impact, cache behavior, and readback proof are all explicit.
