# Captain's Brief Display Standard v1.2

Status: Active display baseline
Date: 05/01/2026
Owner: MarketingOps / Property Analytics
Scope: Captain's Brief, Captain's Log outbound reads, emergency scans, Spotlight Captain reads, and recovery-directive email artifacts

## Purpose

Captain's Brief v1.2 defines the human-readable display standard for data-heavy property intelligence.

The report may carry deep BI, Pond, Ads, GA4, GSC, DataForSEO, GBP, unit-feed, vacancy, reputation, and action-register evidence, but the reader should not have to parse long comma-separated data rows to understand the property posture.

The v1.2 standard is:

- at-a-glance first
- source-backed throughout
- action-ready by section
- Outlook-safe for email delivery
- separate from locked PIB generation/rendering files

## Baseline Artifact

The first approved v1.2 proof is the readable Elation emergency scan:

- `/Users/mark/Property_Analytics/reports/captains_log/emergency/elation_at_grandway_west/elation_high_alert_seo_scan_2026-05-01_readable_email_outlook.html`
- email message id `05bf3670-e81a-4892-b391-4c5956b71e0a@property-analytics.local`

## Required Structure

Each Captain's Brief v1.2 artifact should use this reading order when the evidence exists:

1. PIB-family header: brand, report type, property, date, property code, Captain/read audience.
2. Correction or source note when the artifact supersedes a prior read.
3. High-alert or executive finding in one short callout.
4. At-a-glance KPI tiles for the most important property facts.
5. One-line read tiles that explain the posture without burying data.
6. Evidence blocks grouped by lane.
7. Search/content/entity evidence when relevant.
8. Operations and conversion pressure.
9. Directives with action, due date when known, expected effect, and proof expected. Do not show owner columns or role-call lines in external-facing Captain Brief email bodies unless explicitly requested for an internal execution appendix.
10. Source posture footer.

## Locked Header Contract

The Captain's Brief v1.2 header is locked to the PIB header structure.

Canonical renderer:

- `/Users/mark/Property_Analytics/reports/captains_log/captain_brief_header.py`

Guardrail:

- `/Users/mark/Property_Analytics/scripts/check_captains_brief_header_lock.sh`

Required header rules:

- use the real Venterra logo from `/Users/mark/Property_Analytics/Portfolio_Dashboard/assets/venterra_logo.png`
- embed the logo as a validated base64 PNG data URI for Outlook-safe email delivery
- do not use text-only `VENTERRA` as a fallback
- logo height is `15px`
- report title is `14px`, uppercase, `0.5px` letter spacing
- property name is `28px`, not larger
- optional subtitle/version is `11px`
- date/property metadata is `13px`
- header uses the PIB sequence: logo, report title, property name, optional subtitle/version, metadata line
- header is not reauthored inside individual Captain generators

If a Captain report needs an emergency label, the report title may say `Emergency High-Alert SEO Scan`, but it must still use the same size, sequence, logo treatment, and spacing.

## Display Rules

Do not present multiple data points as a run-on sentence inside one table cell.

Use:

- KPI cards for headline numbers
- mini-stat tiles for related numeric clusters
- evidence blocks for source lanes
- short read statements for interpretation
- action/proof rows for directives

Avoid:

- wide `Metric / Current Evidence / Read` rows where the evidence cell becomes a paragraph
- comma-separated metric strings such as `247 GCs, 56 visits, 32 apps, 12 PQ`
- burying a source correction inside a paragraph
- repeating `Not available` across rows when a source lane is missing
- mixing facts, interpretation, and action in the same cell
- visible owner columns, `Owner:` lines, or role-call labels such as `Captain + Leasing Manager` in the main email body unless the current request explicitly asks for an ownership appendix

## Date Display

All human-facing dates in Captain / Watchlist / Spotlight email artifacts must display as `MM/DD/YYYY`.

- Do not show ISO dates such as `2026-05-07`.
- Do not show timestamps in report bodies.
- Month-only source periods should display as the first day of the month, for example `03/01/2026`.

## Evidence Block Pattern

Each evidence block should have:

- a short lane name
- 2 to 4 data points with label, value, and context
- one interpretation line beginning with `Read:`

Example shape:

| Lane | Data Points | Read |
| --- | --- | --- |
| BI Funnel | Guest Cards `247` / `+18.2% YoY`; Visits `56` / `+47.4% YoY`; Apps/PQ `32 / 12` / declining | Demand exists; conversion friction must be addressed. |

In HTML/email, this should render as a card or nested table, not as a dense spreadsheet row.

## KPI Tile Requirements

KPI tiles should be centered horizontally, with:

- small uppercase label
- large value
- one concise context line
- clear color accent only when it helps the read

The value should not wrap unless unavoidable. If a metric is compound, split it into separate tiles.

## Source Authority

The display standard does not change source authority.

- Data Pond and governed source tables control internal facts.
- Marketing BI is advisory or authoritative only for the field it owns.
- DataForSEO, GSC, GA4, GBP, and Ads are source-specific evidence lanes.
- Missing source lanes should be labeled as missing source notes, not filled with guesses.

## Version Notes

v1.2 supersedes the earlier dense Captain emergency scan display.

The primary improvement is readability: the same data is preserved, but the layout shifts from row-based data dumping to layered executive/analyst consumption.

05/01/2026 header lock: v1.2 also supersedes the custom oversized Captain header. The approved header must be rendered through `captain_brief_header.py`; active Captain generators are checked by `check_captains_brief_header_lock.sh`.
