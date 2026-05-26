# PIB Section Catalog and Builder Standard

Status: Approved planning standard
Date: 2026-05-22
Owner: MarketingOps / Property Analytics

## Purpose

PIB is a sectioned report family. Future PIB work should treat each major report block as a named, stable section that can be included, excluded, or bundled into presets by a self-serve report generator.

This standard does not create a new PIB renderer, template, sender, or report family. It defines the catalog and selection model that a future PIB Builder should use while preserving the canonical PIB generation path.

## Current Section Catalog

The machine-readable seed catalog lives at:

- `/Users/mark/Property_Analytics/config/pib_section_catalog.json`

That catalog is the planning bridge between the existing sectioned PIB report and a future self-serve generator. Section ids should be stable, lower-case, and explicit enough to survive UI labels changing.

## ApartmentIQ Section

Stable section id:

- `apartmentiq_market_enrichment`

Approved section label:

- `ApartmentIQ Market Enrichment`

Role:

- advisory competitive market context
- not source-of-truth operating, occupancy, inventory, pricing, guest-card, BI, Pond, ResMan, GA4, GBP, or review authority

Approved contents:

- advisory-only source banner and latest snapshot context
- market-visible asking rent, rent per square foot, exposure, leased estimate, and rating tiles
- nearest complete ApartmentIQ peers, excluding rows that do not have a full line of displayable values
- listed peer offers with normalized concession percentage where ApartmentIQ provides enough detail
- `Offer Pressure`
- `Unit-Type Offer Pressure` as a table with `Type`, `Offers`, `Avg Discount`, and `Peer $/SF`
- `Fees / Deposits`
- `Amenity Differentiators`

Explicit exclusions:

- ApartmentIQ subject inventory, unit count, floorplan pulse, or subject pricing facts should not be shown as PIB source-of-truth content because internal Pond sources are authoritative and more current.
- Incomplete peer lines should not render. If a peer has missing displayed values or zero/missing rent, omit that peer from displayed comparison rows and averages.

## DataForSEO Section

Stable section id:

- `dataforseo_search_visibility`

Approved section label:

- `Search Market Visibility`

Role:

- advisory outside-in search-market context
- not source-of-truth for owned Google Search Console clicks/impressions, GA4 on-site behavior, Google Ads spend/clicks/conversions, or operating outcomes

Approved contents:

- advisory-only source banner and latest DataForSEO snapshot context
- search-market KPI tiles for local demand, live SERP visibility, best rank, and OnPage flags
- `Keyword Demand + Rank Check`
- `Live SERP Visibility`
- `SERP Pressure`
- `DataForSEO Labs Ranked Keywords`
- `OnPage Readiness`
- `Local Entity Read`
- `AI Visibility Probe`

Source boundary:

- DataForSEO answers what the outside market/search surface shows for selected keywords, devices, locations, pages, and prompts.
- GSC remains authoritative for owned organic search impressions, clicks, CTR, and average position.
- GA4 remains authoritative for on-site sessions and behavior after arrival.
- Google Ads remains authoritative for paid spend, paid keywords, clicks, and conversions.
- If a DataForSEO subsection has no rows, show the absence plainly rather than inventing a read.

## Builder Direction

The future PIB Builder should let a user select sections before generating a report.

Recommended initial presets:

- `Full PIB`: all default executive sections, including ApartmentIQ when data is available.
- `Website / Funnel Review`: site evaluation, traffic, search, DataForSEO market visibility, paid media, PageSpeed, CIR, and conversion-path sections.
- `Leasing / Inventory Review`: availability, guest cards, floorplan pressure, SightMap where applicable, and relevant operating context.
- `Market Context`: competitor intelligence, DataForSEO market visibility, and ApartmentIQ market enrichment.
- `Reputation / Local Presence`: GBP/local presence, reviews, reputation, DataForSEO entity/search visibility, and related search/local context.

Required always-on report elements:

- report identity: property, date window, generated timestamp, version
- source coverage and freshness
- methodology / source authority notes
- advisory/source-of-truth disclaimers when advisory sections are selected

Implementation rule:

- Selection should be a render-time contract over the canonical PIB payload and template family, not a new app-side alternate PIB renderer.
- Locked PIB versions still require explicit approval before mutation.
- The selectable section UI should call into the canonical PIB route/generator family and pass requested section ids or preset ids.
- If a selected section lacks sufficient data, the report should either omit it with source coverage explaining why, or show an approved explanatory empty state for explanatory sections. Do not render partial rows that imply precision.

## Section Governance

When adding a future PIB section:

1. Add or update the section in `/Users/mark/Property_Analytics/config/pib_section_catalog.json`.
2. Define source authority and whether the section is source-of-truth or advisory.
3. Define minimum display completeness.
4. Define whether the section is selectable, default in Full PIB, and which presets include it.
5. Keep rendering inside the canonical PIB family unless explicit approval is given for a versioned PIB change.
6. Update this standard when the approved section contract changes materially.
