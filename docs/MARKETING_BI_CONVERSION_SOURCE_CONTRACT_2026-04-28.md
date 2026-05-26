# Marketing BI Conversion Source Contract

Date: 2026-04-28
Owner: Data Pond + Captain's Log
Initial property: The Pointe Bentonville (`AR4PB`)

## Purpose

These reports provide advisory Marketing BI conversion diagnostics for Captain Briefs. They help Benton distinguish demand quality, lead-source performance, and conversion friction from raw traffic volume.

They do not replace official operating metrics, guest-card source facts, or unit-level availability facts.

## Processed Reports

- `/Users/mark/Downloads/Property CancelDenial by Mktg Source.pdf`
- `/Users/mark/Downloads/Traffic Conversions T7D-T90D.pdf`
- `/Users/mark/Downloads/cancel.xlsx`
- `/Users/mark/Downloads/Traffic Conversions.xlsx`
- `/Users/mark/Downloads/Portfolio Summary.xlsx`
- `/Users/mark/Downloads/Ad Spend Total and Ad Spend Δ by Calendar Period (bins).xlsx`
- `/Users/mark/Downloads/perf by src.xlsx`
- `/Users/mark/Downloads/cancel-deny-reasons.xlsx`
- `/Users/mark/Downloads/gift cards by source.xlsx`
- `/Users/mark/Downloads/traffic performance.xlsx`
- `/Users/mark/Downloads/conv per data.xlsx`
- `/Users/mark/Downloads/converdsion by source.xlsx`
- `/Users/mark/Downloads/conversion dashboard.xlsx`
- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/conversion-data.xlsx`
- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/converting-performance.xlsx`
- `/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/marketing-performance.xlsx`

The first two reports were exported from the Marketing BI app on 2026-04-28 based on PDF metadata. The native Excel cancel/denial export was added on 2026-04-29 and is the preferred source for portfolio-wide cancel/denial ingestion because it carries all exported rows instead of only the visible Power BI viewport.

Additional native Excel exports were added on 2026-04-29 for full-fidelity traffic conversion, property-month ad spend, portfolio summary, and smaller top-source/top-reason supporting reads.

## Canonical Tables

`marketing_cancel_denial_by_source`

Stores The Pointe rows by:

- region
- property
- cancel/denial type
- cancel/denial reason
- marketing source
- cancel/denial count
- applications
- guest cards when present

The table now accepts both PDF and Excel cancel/denial exports. For Captain reads, the latest Excel source is preferred when both PDF and Excel files exist for the same report date, because the Excel file is the complete export.

`marketing_traffic_conversions`

Stores The Pointe conversion-window summary:

- assigned percent T7D
- assigned percent T30D
- guest cards T7D
- guest cards T7D prior year
- guest cards T7D YoY
- guest cards T30D
- guest cards T30D prior year
- guest cards T30D YoY
- guest cards T60D
- guest cards T60D prior year

`marketing_bi_traffic_conversions_full`

Stores the native Excel Traffic Conversions export by property and responsible-agent slice, including:

- assigned T7D / T30D percentages
- guest cards, visits, applications, and ready-for-processing counts for T7D, T30D, T60D, and T90D
- prior-year and YoY fields where supplied
- closing ratios for T7D, T30D, and T45D
- current apartment unit count
- ATR averages for T7D, T30D, T60D, and T90D

`marketing_bi_ad_spend_property_month`

Stores property-month ad spend from the native Excel export.

`marketing_bi_portfolio_summary`

Stores portfolio-summary property context such as acquired date, built year, reported `Apts`, residents, leaseholders, occupants, adults, minors, unknown age count, and pets. This is an advisory BI demographic/context read and must not override the governed property identity matrix or official unit counts.

`marketing_bi_excel_export_rows`

Stores a generic row ledger for smaller native Excel exports where the table is useful as evidence but not yet promoted into a purpose-built table.

`marketing_bi_conversion_dashboard_rows`

Stores the native Excel Conversion Dashboard export by property and initial contact type, including:

- conversions
- comparison-period conversions
- conversion delta
- ATR average
- ATR delta

This source is useful for questions about which action path is producing interest and whether the property is winning or losing by initial contact type.

`conversion-data.xlsx` is now treated as a native alias of the earlier `conversion dashboard.xlsx` export and is promoted into this same structured table.

`marketing_bi_excel_export_rows`

The following new shared-drop workbooks are now preserved in the generic export ledger for portfolio use and later promotion decisions:

- `converting-performance.xlsx`
- `marketing-performance.xlsx`

Current use:

- `converting-performance.xlsx` preserves property-level conversion and delta rollups
- `marketing-performance.xlsx` preserves the same family with source/origin breakout rows

These are governed source artifacts in the Data Pond even though they have not yet been promoted into purpose-built tables.

## Initial The Pointe Load

`Property CancelDenial by Mktg Source.pdf` produced 24 The Pointe rows.

Important initial reads:

- Source summary rows show Google Ads with 1 C&D, 4 applications, and 4 guest cards.
- Source summary rows show Website with 2 C&Ds, 82 applications, and 61 guest cards.
- Cancellation rows are heavily concentrated in `Abandoned`, especially Website, Google, and Corporate Housing Provider.
- Denial rows are heavily concentrated in `Failed Credit or Criminal`, especially Website and Google.

## Portfolio Excel Load

`cancel.xlsx` produced 4,750 detail rows across 91 resolved properties on 2026-04-29.

Portfolio totals from the Excel export:

- 28,481 C&Ds
- 39,284 applications
- 187,480 guest cards

Identity governance:

- All exported property names resolved through `config/property_identity_matrix.json`.
- No one-off property mapping was added.

The Pointe rows from the Excel export:

- 25 rows
- 58 C&Ds
- 143 applications
- 720 guest cards

Anatole Daytona rows from the Excel export:

- 60 rows
- 377 C&Ds
- 476 applications
- 3,068 guest cards

`Traffic Conversions T7D-T90D.pdf` produced 1 The Pointe summary row:

- Assigned percent T7D: 100.0%
- Assigned percent T30D: 100.0%
- Guest cards T7D: 40
- Guest cards T7D prior year: 37
- Guest cards T7D YoY: +8.1%
- Guest cards T30D: 166
- Guest cards T30D prior year: 71
- Guest cards T30D YoY: +133.8%
- Guest cards T60D: 307
- Guest cards T60D prior year: 71

## Captain Brief Use

These sources should feed Benton as conversion evidence:

- demand exists and is materially higher YoY in the T30D window
- application volume from Website is substantial
- the Website channel also carries meaningful denial/cancellation friction
- `Abandoned` cancellation reasons and `Failed Credit or Criminal` denial reasons should become action prompts, not generic conversion commentary

## Authority Boundary

Marketing BI conversion reports are advisory diagnostics. They can explain source/channel friction, but they do not override:

- `guest_card_metrics` for raw guest-card facts
- `unit_availability_units` for unit-level inventory truth
- `property_operating_metrics` for official occupancy, leased percentage, lease count, cancellations, denials, and booked concession dollars
