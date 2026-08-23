# Resi API Findings And New Capabilities Summary

Date: 08/21/2026
Prepared for: Resi
Prepared by: Venterra / Data Pond team

## Suggested Cover Note

Hi Resi team,

We wanted to share a concise summary of what we have validated so far with the Resi API and how we are starting to integrate Resi content into Venterra's Data Pond content systems. The short version is that we have successfully built read-only portfolio and content inventory, mapped content to property impact, and completed one guarded live FAQ update with management API readback, cache-clear testing, public delivery verification, and browser confirmation.

We would appreciate your review of the findings and the open API questions near the end, especially around cache clearing, public-delivery identifiers, incremental sync options, nested content-block updates, and media update/delete semantics.

## Executive Summary

Venterra has completed an initial Resi API integration proof that treats Resi as a live content and property source system feeding our internal Data Pond content layer.

We validated three major capabilities:

1. Portfolio-level Resi property and source inventory through the V2 management API.
2. Large-scale live content inventory and property-impact mapping across Resi content object types.
3. A guarded content-change bridge that can apply an approved live content edit, verify management API readback, clear Resi's property cache, and confirm public delivery API output.

We also completed a first end-to-end production proof on The Vine Kyle Parkway FAQ content with explicit approval, readback verification, cache-clear testing, and public-site confirmation.

## What We Validated

### 1. Resi V2 Property And Source Inventory

We successfully connected to the Resi V2 management API and collected a read-only portfolio snapshot.

Validated endpoints:

- `GET /api/v2/me`
- `GET /api/v2/properties`
- `GET /api/v2/lead-sources`

Initial read-only snapshot:

- Account: Venterra
- Properties observed: `98`
- Lead sources observed: `1,168`
- Property/source lookup rows generated after de-duplication: `1,142`
- Properties mapped to governed Venterra property codes in the first source lookup: `93`

This lets us use Resi as a source of truth for property-level Resi identifiers, source/tracking inventory, and downstream attribution mapping.

### 2. Resi Content Inventory

We built a read-only content inventory collector that captures Resi content into Venterra's Data Pond for mapping, governance, and future editing workflows.

Validated content object types:

- Amenities
- Announcements
- Content blocks
- Nested content items
- FAQs
- Galleries
- Neighborhood places
- Reviews

Initial resolved content run:

- Content objects captured: `52,472`
- Field-level facts captured: `140,673`
- Read-only API requests made: `795`
- Media intentionally skipped in the first large run

Resolved property-link coverage from the first run:

- Reviews: `24,363` links across `90` properties
- Content items: `12,775` links across `93` properties
- Content blocks: `8,785` links across `93` properties
- Neighborhood places: `6,037` links across `93` properties
- Amenities: `5,528` links across `92` properties
- FAQs: `2,260` links across `92` properties
- Galleries: `190` links across `93` properties
- Announcements: `22` links across `17` properties

### 3. Field-Level Changeability Mapping

We now classify Resi content fields by edit posture so our internal systems can distinguish ordinary marketing copy from operational, legal, media, publication, and rights-sensitive fields.

Initial field classifications included:

- `safe_content_change`
- `publication_sensitive`
- `legal_sensitive_copy`
- `media_global_asset_change`
- `media_local_embed_change`
- `rights_sensitive`
- `operational_sensitive`
- `read_only_or_unmapped`

This gives us the basis for showing teams exactly what can eventually be edited safely, what requires elevated approval, and what should remain read-only or vendor/PMS-owned.

### 4. Data Pond Content System Bindings

We have started mapping Resi content objects into internal Venterra systems rather than creating a separate content workspace.

Target systems:

- Content Office
- Site Content
- VACS
- Captain / Navigator

The intent is that internal teams can view live Resi copy, draft proposed changes, see property impact, approve changes, and then apply through a controlled bridge rather than editing Resi ad hoc.

## New Capability: Resi Content Bridge

We named and implemented our guarded operational lane as **Resi Content Bridge**.

The bridge supports:

- reading mapped FAQ content from our latest Data Pond inventory
- reading a specific FAQ directly from live Resi V2
- applying an approved FAQ answer update through Resi V2
- recording the change in our internal content-change ledger
- verifying V2 readback after the patch
- requesting a Resi V1 property cache clear
- verifying the public Resi V1 delivery API

Current write support is intentionally narrow: approved FAQ answer updates only. We expect to extend the same pattern to additional content object types after more testing.

All live write and cache operations are explicitly gated on our side. There is no bulk editor and no silent background mutation path.

## First Production Proof: The Vine Kyle Parkway FAQ

Property:

- The Vine Kyle Parkway
- Property code: `TX4EK`
- Website: `https://thevinekyle.com/`
- Resi property id: `019e6750-98ae-732d-9ef2-f4839506787c`

Content object:

- Object type: FAQ
- Resi FAQ id: `019ebdff-c18d-7195-80cc-e1e61b42e2df`
- Question: `Can I tour The Vine?`

Validated sequence:

1. Retrieved the FAQ from Resi/Data Pond inventory.
2. Confirmed the current stale answer.
3. Applied an approved answer update through `PATCH /api/v2/faqs/{id}`.
4. Received successful V2 patch response.
5. Performed V2 readback and confirmed the live answer matched the approved answer exactly.
6. Recorded the change in Venterra's internal Data Pond content-change ledger.
7. Tested `POST /api/v1/cache/clear` scoped to the Resi property id.
8. Verified the public V1 FAQ delivery endpoint returned the updated answer.
9. Confirmed the public website rendered the updated FAQ after the downstream cache refresh completed.

Approved live answer now shown:

```html
<p>Yes! The Vine is now offering Hard Hat Tours. Contact our team today to schedule yours and get an early look at our new apartment homes in Kyle.</p><p>Move in by 10/31 and get up to 8 weeks FREE + $750 OFF. <a href="https://online.venterraliving.com/eOnlineLease/portal/scheduleTour/TX4EK/"><strong>Schedule a Tour</strong></a> today.</p><p><em>*Restrictions apply. Contact us for details.</em></p>
```

## API Observations

### Positive Findings

- The V2 management API provided enough portfolio data to build a property and source lookup.
- The content endpoints provided enough structure to inventory content objects at scale.
- Property-scoped filtering gave us a practical way to build property-impact links for account-level content objects.
- V2 FAQ patching and readback worked cleanly for the first approved FAQ-answer update.
- The V1 cache clear endpoint accepted a property-scoped clear request.
- The V1 public FAQ delivery endpoint reflected the updated answer after the Resi cache clear.

### Integration Notes

- We treat V2 management data and V1 public delivery as separate readback layers.
- Local inventory snapshots are point-in-time; after a live change, live V2 or V1 readback is required until the next inventory collection run.
- The public website layer may have additional cache or firewall behavior outside the Resi API readback path.
- For at least one V1 public FAQ response shape, the public delivery item did not expose the same management object id used by V2. We can still match by question/content, but stable id exposure in V1 would make public readback correlation stronger.
- The media update model appears to distinguish global asset metadata from local embed metadata. We are treating media edits cautiously until we confirm safe update and detach/delete semantics.

## Open Questions For Resi

1. What is the recommended production pattern for cache clearing after content updates?
2. Does `POST /api/v1/cache/clear` clear only Resi delivery cache, or can it also trigger any hosted-site invalidation in some configurations?
3. Are V1 public delivery responses expected to expose stable V2 management ids for FAQs and other content objects?
4. Is there a recommended way to query only objects changed since a timestamp, such as an `updated_at` filter, to reduce full inventory scans?
5. What are the exact safe update semantics for content blocks with nested content items?
6. Are media detach/delete operations intentionally unavailable through the API, or are those endpoints separate from the documented media update path?
7. Are rate-limit headers or retry-after semantics available for large inventory workloads?
8. Are webhooks or event callbacks available for content changes, cache clears, or publish events?

## Suggested Next Collaboration Steps

1. Review our object inventory model against Resi's intended data model.
2. Confirm the safest write patterns for FAQs, content blocks, announcements, amenities, neighborhood places, galleries, and media metadata.
3. Confirm cache-clear expectations and any downstream hosted-site cache behavior.
4. Identify whether stable public-delivery ids, incremental sync filters, or webhook events are available or planned.
5. Select one additional low-risk content object type for a controlled canary after FAQ answer updates.

## Current Boundary

Our current bridge does not change Resi host configuration, website hosting, WordPress/Kinsta, Cloudflare, DNS, Resi Edge Workers, analytics, or property infrastructure.

The only validated live content mutation so far is the explicitly approved The Vine Kyle Parkway FAQ answer update described above.
