# Available Unit Interest Metrics Source Contract

Date: 2026-04-27
Owner: Data Pond + Captain's Log
Initial report: `Available Units With Low Inquiries.pdf`

## Purpose

This source measures demand intensity against available inventory. It is advisory BI intelligence for Captain Briefs, not source-of-record operating truth.

It helps answer:

- how much inventory is available
- how much of it is vacant now versus on notice
- whether guest-card and quote demand is keeping pace with available inventory
- whether recent demand is improving or softening versus the prior comparable period

## Current Source

Monitored file:

`/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports/Available Units With Low Inquiries.pdf`

BI page name:

`Available Units With Low Inquiries` -> `Guest Cards Per Unit Type`

## Canonical Table

`available_unit_interest_metrics`

The initial landing table stores:

- report date
- location
- current level: region, property, or total
- property id / community id where mapped
- unit count
- available units
- vacant available units
- notice available units
- percent available
- T7/T30 guest-card volume
- T7/T30 guest cards per available unit
- T7/T30 guest-card delta
- T7/T30 prospect quote volume
- T7/T30 quote delta
- source file and evidence JSON

## Authority Boundary

This source is authoritative for the BI report's demand-versus-availability view at export time.

It does not override:

- `unit_availability_units` for unit-level available inventory detail
- `guest_card_metrics` for raw guest-card daily facts
- `property_operating_metrics` for official occupancy, leased percentage, lease counts, cancellations, and booked concession dollars

## Initial The Pointe Row

The 2026-04-27 PDF includes The Pointe (`AR4PB`):

- Unit count: 452
- Available units: 55
- Vacant available units: 37
- Notice available units: 18
- Percent available: 12.2%
- T7 guest cards: 40
- T7 guest cards per available unit: 0.7
- T7 guest-card delta: -14.9%
- T30 guest cards: 166
- T30 guest cards per available unit: 3.0
- T30 guest-card delta: +15.3%
- T7 prospect quotes: 96
- T7 quote delta: +4.3%
- T30 prospect quotes: 316
- T30 quote delta: +5.7%

## Adjacent BI Source Lanes Seen

The Marketing BI app also exposes these adjacent areas that should be evaluated as future Captain/Pond lanes:

- T365D Move-ins with Mktg Source
- Traffic Conversions
- Property Cancel/Denial by Mktg Source
- WOW Program Spending
- SmartDesk 2.0
- Value Proposition Dashboard

Recommended priority:

1. Property Cancel/Denial by Mktg Source
2. Traffic Conversions
3. T365D Move-ins with Mktg Source
4. WOW Program Spending
5. SmartDesk 2.0
6. Value Proposition Dashboard
