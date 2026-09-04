# Resi Content Inventory And Data Pond Integration

Date: 08/20/2026
Status: Phase 1 read/live-map foundation with guarded apply bridge
Owner: Data Pond / Content Office

## Purpose

Resi should be treated as an external live CMS/source system, not as a separate content workspace.

The Data Pond content layer should make Resi content visible, mappable, governable, and eventually editable through the same systems already forming around VACS, Site Content, Content Office, Captain/Navigator, and edge experimentation.

The safe model is:

1. Read live Resi content into Data Pond.
2. Normalize it into content objects, field facts, and property links.
3. Bind those objects to internal content systems.
4. Let internal systems draft and approve changes.
5. Apply live Resi writes only through an explicit apply gate with readback proof.

The official guarded apply lane is now the Resi Content Bridge:

- Runbook: `docs/RESI_CONTENT_BRIDGE_RUNBOOK_2026-08-21.md`
- Agent primer: `docs/RESI_CONTENT_BRIDGE_AGENT_PRIMER_2026-08-22.md`
- Command: `scripts/resi_content_bridge.py`

The inventory collector remains read-only. Live Resi writes are only enabled through the bridge and require exact confirmation phrases, local change-request ledgering, V2 readback, and public delivery verification.

## Implemented Foundation

### Local Collector

Collector:

```bash
python3 Data_Collection/collectors/resi_v2_content_inventory_collector.py \
  --use-latest-core-snapshot \
  --skip-media \
  --resolve-property-links \
  --verbose
```

The collector uses Keeper-backed Resi credentials from `utils/resi_auth.py`, performs only `GET` requests, and writes local Data Pond tables.

Latest proof run:

- Run ID: `resi_content_3fb41752b3aa`
- Resi account: `Venterra`
- Fetched at: `08/20/2026 7:06 PM CT`
- Properties seen: `98`
- Properties resolved to governed identity: `95`
- Content objects captured: `52,472`
- Field facts captured: `140,673`
- Media assets captured: `0` in this run because media was intentionally skipped
- Requests made: `795` read-only GET requests

Open identity warnings:

- `Venterra Theme Backup (Depreciated)` has no `reference_id`
- `Sundara` has no `reference_id`
- `Non-YS Training` uses unresolved `TRNYS`

### Schema

Migrations:

- `apps/api/migrations/0064_create_resi_content_inventory_tables.sql`
- `infra/migrations/041_create_resi_content_inventory_tables.sql`

Tables:

- `resi_content_inventory_runs`
- `resi_content_objects`
- `resi_content_property_links`
- `resi_content_fields`
- `resi_content_changeability_rules`
- `pond_content_system_bindings`
- `pond_content_change_requests`

## Data Model

### `resi_content_inventory_runs`

One row per collection run. This is the audit header for what was read, when, from which account, and with which collection manifest.

### `resi_content_objects`

One row per Resi content object observed in the account-level live readback.

Object types currently captured:

- `review`
- `content_block`
- `content_item`
- `neighborhood_place`
- `amenity`
- `faq`
- `gallery`
- `announcement`

The object table stores the raw Resi payload hash, raw JSON, enabled/global state where exposed, title-ish fields, sort order, media type, link count, and update timestamp.

### `resi_content_property_links`

This is the impact map.

Some Resi account-level list endpoints return content objects without explicit property membership. The collector therefore runs a second read-only pass using the documented `property_id` filter and records which properties each object affects.

Latest resolved-link shape:

- Reviews: `24,363` links across `90` properties
- Content items: `12,775` links across `93` properties
- Content blocks: `8,785` links across `93` properties
- Neighborhood places: `6,037` links across `93` properties
- Amenities: `5,528` links across `92` properties
- FAQs: `2,260` links across `92` properties
- Galleries: `190` links across `93` properties
- Announcements: `22` links across `17` properties

### `resi_content_fields`

One row per captured field value, with a role and editability classification.

Current field classifications:

- `safe_content_change`: titles, subtitles, descriptions, FAQ questions/answers, amenity copy, neighborhood place names/URLs
- `publication_sensitive`: `is_enabled` and other fields that can hide/reveal live content
- `legal_sensitive_copy`: announcement disclaimers
- `media_global_asset_change`: file captions/alt text, when media is included
- `media_local_embed_change`: embed title/URL, when media is included
- `rights_sensitive`: review text
- `operational_sensitive`: fee/pricing-adjacent fields
- `read_only_or_unmapped`: captured vendor fields without an approved edit lane

Latest field counts:

- `read_only_or_unmapped`: `73,429`
- `safe_content_change`: `61,717`
- `publication_sensitive`: `5,501`
- `legal_sensitive_copy`: `22`

### `pond_content_system_bindings`

This table maps Resi content into internal systems without duplicating truth.

Candidate bindings are created for:

- `content_office`
- `site_content`
- `vacs`
- `captain_navigator`

The binding table is intentionally neutral. It lets each internal system point at the same Resi source object instead of creating private content maps.

### `pond_content_change_requests`

This is the future live-edit control surface.

Internal systems should write proposed changes here first, not directly to Resi. A change request records:

- source object and field
- current value hash
- proposed value or payload
- originating system
- requester
- editability class
- approval status
- apply status
- Resi update method/path template
- readback proof after apply

Live Resi writes are handled by the guarded Resi Content Bridge. Internal systems should still draft into this table first; the bridge is the explicit apply/readback step, not a bypass around the ledger.

## How This Fits Existing Content Initiatives

### Site Content

Site Content should use Resi content objects as external live section evidence.

Examples:

- Map `content_block` to `site_content_sections`
- Map `faq` to FAQ section rewrite work
- Map `amenity` and `neighborhood_place` to property proof and specificity checks
- Store proposed rewrites in Site Content, then promote approved edits into `pond_content_change_requests`

### Content Office

Content Office should become the human-facing governance surface for live Resi content.

Expected views:

- property content map
- global/shared content map
- disabled vs enabled content
- field-level editability
- change request queue
- approval and readback status

### VACS

VACS should consume Resi content as governed inputs from Data Pond, not as private truth.

The recommended contract is:

- VACS reads `pond_content_system_bindings`
- VACS reads current Resi field facts from `resi_content_fields`
- VACS drafts proposed copy changes
- VACS writes proposed changes into `pond_content_change_requests`
- VACS never writes to Resi directly

### Captain / Navigator

Captain/Navigator should use Resi content as property-scoped evidence:

- what the live Resi system says
- which fields look stale or thin
- which properties share the same content block
- whether a proposed content recommendation would affect one property or many

### Edge Experiments

Edge experiments can bind tested sections back to Resi source objects through `pond_content_system_bindings`.

That keeps experiments from creating orphaned copy variants with no source-system awareness.

## Live Editing Standard

"Edit live" should mean:

1. Data Pond shows the current live Resi value.
2. A user or content system drafts a proposed change.
3. The Pond shows every affected property before approval.
4. The change is approved explicitly.
5. A guarded applier sends the minimal `PATCH` payload to Resi.
6. The applier performs live readback and records proof.
7. Any downstream cache/revalidation need is queued separately.

It should not mean:

- VACS directly writes to Resi
- Site Content silently patches Resi
- content-block changes are applied without showing global/property impact
- media file metadata is edited without warning that it can affect every placement
- operational/PMS-owned fields are treated as marketing copy

## Guarded Apply Path

The Resi Content Bridge supports the first live-ready apply workflow:

- local inventory read: `show-faq`
- live V2 readback: `read-v2-faq`
- approved FAQ answer apply: `apply-faq-answer`
- Mark/manual Resi control-panel system-cache clear for V2 sites when needed
- rendered public website/browser verification

Mutation commands require exact confirm phrases:

- `APPLY_RESI_CONTENT_CHANGE`
- `CLEAR_RESI_CONTENT_CACHE` only for legacy/original V1 sites where Resi confirms it applies

The first verified production proof was The Vine Kyle Parkway (`TX4EK`) FAQ `Can I tour The Vine?`, recorded as change request `resi_faq_hard_hat_tx4ek_3d1e27857b7e`.

09/01/2026 cache clarification: V1 is a different/original site set, including examples such as Delta, Camber, and Cendana. It is not the cache-control path for V2 sites such as The Vine. Until Resi exposes V2 cache control, V2-site cache clearing is a Mark/manual Resi control-panel action, followed by rendered public website/browser proof.

## Current Gaps

- Media library was not included in the first resolved run. Use a separate pass without `--skip-media`, or target media with endpoint filters.
- The UI/API surface for browsing `resi_content_*` tables is not built yet.
- Broader content-block, announcement, amenity, neighborhood, gallery, and media apply commands are not yet built into the bridge.
- Account-level content objects without property-link evidence remain visible but should not be edited until linkage is resolved.
- `TRNYS`, `Sundara`, and the deprecated theme backup record need identity disposition.

## Recommended Next Build

1. Add a protected Data Pond API route for Resi content inventory readback.
2. Add a Content Office / Site Content view that shows property -> Resi content objects -> fields -> editability.
3. Add draft-only change request creation into `pond_content_change_requests`.
4. Add media inventory as a separate slower lane.
5. Extend the Resi Content Bridge from FAQ answers to the next approved content object types, preserving minimal `PATCH`, preflight impact review, and readback proof.
