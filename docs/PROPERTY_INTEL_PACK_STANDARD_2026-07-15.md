# Property Intel Pack Standard

Status: Product standard v1.0
Established: 07/15/2026
Owners: Mark Laufhutte and Alexandra Hopkins
System lane: Governed Ad Hoc Executive Report System
Companion product: Property Intelligence Brief (PIB)

## Purpose

The Property Intel Pack is the Content Ops companion to the Property Intelligence Brief. PIB answers how a property is performing in the approved executive brief format. The Property Intel Pack turns outside-in research, Data Pond evidence, search visibility, competitor positioning, review language, and content opportunities into a working action pack for Alex and Content Ops.

The pack is not a replacement for PIB, not a redesigned PIB, and not a one-off custom email. It is a set product that will evolve through Mark and Alex's feedback while preserving a stable evidence contract.

## Audience

- Primary: Alexandra Hopkins / Content Ops
- Secondary: Mark Laufhutte, Marketing Ops, and collaborators who need to understand why a content recommendation exists
- Optional: Dustin Crandall or other stakeholders when the pack is used for broader property positioning work

## Product Boundary

The Property Intel Pack may:

- Use PIB-adjacent styling and Venterra brand colors.
- Use the governed ad hoc packet system under `/Users/mark/Property_Analytics/reports/adhoc_executive/`.
- Include an Outlook-safe HTML email plus a workbook attachment.
- Recommend content actions, page edits, FAQ topics, local-search copy, and competitor-response framing.
- Evolve its sections, workbook tabs, and phrasing through Mark/Alex review.

The Property Intel Pack must not:

- Modify locked PIB generators, templates, or senders.
- Replace canonical PIB delivery.
- Invent unsupported facts, competitor claims, review themes, concessions, rent claims, or ranking conclusions.
- Create standalone report senders or one-off HTML scripts when the governed ad hoc system can render and validate the packet.
- Expose internal ISO dates to human readers except in paths, IDs, JSON, or other machine-readable artifacts.

## Evidence Contract

Property Intel Pack evidence should be sourced from governed systems first:

- Property identity: `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py` and `/Users/mark/Property_Analytics/config/property_identity_matrix.json`
- DataForSEO SERP evidence: `dataforseo_property_keyword_rankings` and `dataforseo_serp_results`
- DataForSEO demand and page evidence: `dataforseo_keyword_metrics`, `dataforseo_labs_ranked_keywords`, `dataforseo_onpage_page_snapshots`, `dataforseo_business_profiles`, and `dataforseo_ai_visibility_probes`
- Competitor market evidence: `competitor_market_research_observations`, built through `/Users/mark/Property_Analytics/Data_Collection/utils/build_competitor_market_packets.py` and ingested through `/Users/mark/Property_Analytics/Data_Collection/utils/competitor_market_research_ingest.py`
- Review language: `gbp_review_sentiment` and related governed review tables
- Content and conversion context as needed: GA4, GSC, availability, guest-card, operating, and PageSpeed Data Pond tables

Fresh research runs should be Keeper/KSM-backed. Do not add local credential files or ad hoc secret paths.

## Output Contract

Every generated Property Intel Pack should preserve the governed ad hoc report packet:

- `request.json`
- `report_spec.json`
- `report.html`
- `report.xlsx`
- `validation.json`
- `delivery.json`
- `sources_used.md`

The HTML email is the reader-facing brief. The workbook is the working file for Alex and should carry deeper tables that would make the email too wide or too dense.

## Core Sections

Future packs should generally include:

- Executive Read for Alex
- Content Assignments / Action Brief
- SERP and Keyword Evidence
- Competitor and Review Language
- OnPage and AI Visibility
- Source Notes / Data Pond Evidence

Section names may evolve with Mark and Alex, but the pack should remain action-oriented: what to write, where to write it, and what evidence supports the recommendation.

## Layout Standard

The first production send on 07/15/2026 proved the evidence lane but was too wide in Outlook preview. Future Property Intel Pack emails must be narrower and more email-pane friendly:

- Use fewer KPI columns per row, preferably two per row when the email will be viewed in Outlook preview.
- Keep the visible question/subject text compact.
- Avoid wide tables in the email body; move deep tables to the workbook.
- Prefer short evidence summaries in email and full evidence rows in the workbook.
- Validate visually in Outlook-style preview when changing the template or section density.

This layout note is a product requirement, not a request to recreate or resend the first packets.

## Versioning

Use visible product language:

- Product name: `Property Intel Pack`
- Internal report type: `content_intelligence_pack` may remain for system continuity unless renamed through a deliberate migration.
- Version: start at `1.0.0`; increment when the artifact structure, section set, or evidence contract changes.

## Relationship To PIB

PIB is the approved executive performance brief. It is locked by version and governed by PIB guardrails.

Property Intel Pack is a companion research and action product. It can point back to PIB metrics, but its job is to help Content Ops decide what to write, adjust, test, or investigate next.

When there is conflict, PIB remains the canonical executive performance artifact; Property Intel Pack remains the content research/action layer.
