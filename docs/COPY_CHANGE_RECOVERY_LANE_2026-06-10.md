# Copy Change Recovery Lane

Date: 2026-06-10
Owner: MarketingOps / Data Pond / Site Content Creator
Status: Active recurring workflow

## Purpose

Copy Change Recovery Lane is the recurring operating workflow for properties whose copy-change performance has softened enough to require action. It is designed to improve rankings, click-through, and conversion support, not merely to produce agreeable copy.

This lane extends Copy Change Monitoring. It does not create a new report family, a new PIB renderer, or a parallel tracking system.

## Trigger

Use this lane when the Copy Change Impact Brief or a related Captain/Watchtower read identifies a property as needing copy action, especially:

- Act Now properties
- worst performers below the current operating threshold
- properties with declining GSC clicks, CTR, GA4 organic sessions, or conversions after a copy change
- pages where technical/social metadata confounds could distort the read

## Required Inputs

Before writing replacement copy, gather:

- latest Copy Change Impact Brief JSON/HTML
- active `copy_change_waves`, `copy_change_interventions`, and `copy_change_observations`
- governed property identity from `Data_Collection/utils/property_identity.py`
- live page title, meta, OG/Twitter tags, H1, Hero copy, Romance copy, FAQ, and CTA structure
- DataForSEO ranking, keyword, SERP, and on-page evidence where available
- Data Pond GSC, GA4 Organic Search, GSC query, unit availability, specials, Google Ads freshness, and operating context
- property Captain consultation or current Captain handoff notes
- Website Change Watch or live-diff evidence where available

## Workflow

1. Identify the properties requiring recovery from the daily Copy Change Impact Brief.
2. Resolve each property through the governed identity matrix.
3. Read the current directives: Copy Change Monitoring Source Contract, Site Change Captain Handoff Standard, Property Narrative Canon, and relevant Captain notes.
4. Pull live-page evidence and compare it to the proposed/current copy-change registry state.
5. Diagnose the actual performance problem: query mix, CTR softness, search promise mismatch, inventory/specials pressure, page health, duplicate metadata, paid-media confounds, or immature measurement window.
6. Rewrite for rank and conversion support while preserving the live CMS section structure.
7. Deliver WordPress-ready paste targets with separate SEO, Hero, and Romance sections; each SEO field must have its own copy button.
8. After publishing, verify the live page from public HTML: title, meta, Rank Math social fields, first OG values, H1, Hero, Romance, and key section headings.
9. Register the intervention in Data Pond with changed fields, target queries, hypothesis, new-content artifact, confounds, publish timestamp, and first full post-change day.
10. Write a Captain/Logkeeper handoff under `reports/captains_log/copy_change_alerts/` when runtime Captain tables are unavailable.
11. Generate the filtered Copy Change Impact Brief and send a test email before relying on the next daily run.
12. Monitor T7, T14, and T30 using the canonical Copy Change Impact Brief.

## Required Outputs

Each Recovery Lane pass should produce:

- a rank-focused source packet
- a WordPress paste board with separate SEO, Hero, and Romance copy targets
- structured `new_content` JSON per property
- structured `confounds` JSON per property
- a Captain/Logkeeper handoff note
- registered Data Pond interventions
- a generated Copy Change Impact Brief artifact and test email proof

## WordPress Paste Board Standard

The paste board must match how the operator edits the CMS:

- SEO title, meta description, Open Graph title, and Open Graph description are separate visible fields.
- Each SEO field has its own copy button.
- Hero and Romance sections are separate paste targets.
- Bullets use real HTML list markup, not markdown dashes.
- Implementation notes are clearly labeled as not-for-page-body.

## Data Pond Storage

Register each recovery change through `scripts/register_copy_change_intervention.py`.

Use:

- `changed_fields`: `title,meta,og,h1,hero,romance` when the full page package changes
- `new_content_json`: the structured approved replacement copy
- `confounds_json`: live verification, duplicate OG, offer/image, paid-media, page-health, or inventory context
- `first_full_post_day`: the day after the publish timestamp when the change is published during the day

Wave names should use the lane title:

`Copy Change Recovery Lane - <date/context>`

## Reporting

The email remains the approved `Copy Change Impact Brief v1.3` template. Recovery Lane notes should appear in the per-property change summary and in the generated JSON/observation evidence, not as a redesigned email.

If the page is too newly published for a clean read, the action should remain `Too Early` until the first shared milestone is mature.

## Technical Watch Pattern

If Rank Math social fields are correct but live source emits older OG tags before the Rank Math block, record this as:

`duplicate pre-Rank-Math OG tags remain a technical cleanup, not an editor miss`

This must be stored as a confound and handed off to engineering/theme ownership.
