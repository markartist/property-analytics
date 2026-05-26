# Marketing BI Daily Packet Source Contract

Date: 2026-04-28
Owner: Data Pond + Captain's Log through The Pond
Status: Active source route

## Purpose

The Marketing BI daily packet is the portfolio-wide Power BI export that gives each property Captain a broad read on marketing demand, source quality, conversion movement, inventory pressure, cancel/denial friction, ad spend, cost per conversion, and CSS performance.

For The Pointe Bentonville, Captain Benton uses this packet as a recurring base-info source. It does not replace official operating metrics, unit-level availability, or Data Pond facts. It supplies portfolio and property marketing context that the Captain reconciles against those source-of-truth tables.

## Cadence

- Expected delivery: daily, after the Marketing BI refresh.
- Daily collector: `Data_Collection/orchestration/daily_master_collection.py`
- Retry posture: skipped when no new packet is present; existing packet hashes are not reprocessed.
- Formal interpretation: weekly Captain's Log, with daily exception monitoring.

## Source Discovery

Default monitored locations:

- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports`
- `/Users/mark/Downloads`

Accepted filename patterns:

- `*Conversion_Dashboard*.pdf`
- `*Marketing BI 2.0*.pdf`
- `*Marketing_BI*.pdf`

## Landing Tables

Migration:

- `apps/api/migrations/0031_create_marketing_bi_daily_packets.sql`
- `infra/migrations/018_create_marketing_bi_daily_packets.sql`

Tables:

- `marketing_bi_daily_packets`
  - one row per PDF packet, keyed by SHA-256.
  - stores report date, selected period, source file, page count, and report title.
- `marketing_bi_daily_packet_pages`
  - one searchable text row per page.
  - preserves page title, page number, and extracted page text.
- `marketing_bi_property_summary_rows`
  - normalized property summary rows from the Portfolio Summary page.
  - maps The Pointe row to `AR4PB` and Captain Benton community id.

## Current Extracted The Pointe Facts

From the initial packet load:

- Report date: `2026-04-27`
- Selected period: `2026-01-28` to `2026-04-27`
- Property row: `Arkansas / Pointe`
- Property code: `AR4PB`
- Community id: `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`
- Apartments: `452`
- Acquired date: `2025-04-15`
- Year built: `2021`
- Pages stored: `31`

## Authority Model

Use this packet for:

- portfolio benchmark context.
- marketing source and conversion interpretation.
- inventory-pressure context from BI visuals.
- follow-up questions and exception triggers for Captains.

Do not use this packet as the final authority for:

- official occupancy.
- official leased percentage.
- lease count.
- cancellations and denials when official operating files are present.
- unit-level availability, concession dollars, or stale-unit aging when the feed has the live unit fact.

Those values remain Data Pond / official-feed truth.

## D1 Mirror

`apps/api/scripts/captain_sources_to_d1.py` now mirrors:

- the latest 14 daily packet headers.
- all pages for those mirrored packets.
- recent portfolio-level Marketing BI advisory rows, including available-unit interest, traffic conversions, cancel/denial diagnostics, and property summary rows.

This makes the packet and normalized advisory facts available to Captain runtime reads without requiring the Worker to parse PDFs. The bridge is intentionally portfolio-aware so future Captains can consume shared Marketing BI source rows as they are activated.

## Portfolio Normalization Note

The `Traffic Conversions T7D-T90D` parser now ingests every visible property-level row in the exported PDF and maps it through guest-card property codes plus the official registry. Power BI exports only include the rows present in the exported visual/page. If the visual is scrolled or filtered at export time, only those visible rows can be normalized from that file. For full-portfolio coverage, the scheduled export should use a full-table export or a paginated/report subscription that includes every property row.
