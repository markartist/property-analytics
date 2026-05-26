# Property Regions Source Contract

Date: 2026-05-04

Owner: Data Pond + Property Identity Governance

Source file:

- `/Users/mark/Downloads/regions.xlsx`

Canonical ingest path:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_regions_ingest.py`

Canonical outputs:

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`, table `properties`, column `encasa_region`
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`, property field `encasa_region`
- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`, field `encasa_region`

## Purpose

This workbook is the governed property-region grouping source for active portfolio properties. Region membership is used by Captain, POP Brief, peer-family reads, regional benchmarks, Commodore synthesis, and app community display.

## Current Load

The 2026-05-04 workbook load resolved `91` property rows through the governed property identity resolver and found `0` unmapped property rows.

The workbook contained `14` region groups:

- Arkansas
- Atlanta, GA
- Austin, TX
- Dallas, TX
- Florida
- Houston, TX
- Kansas City
- Kentucky
- Killeen
- Nashville, TN
- Oklahoma
- Raleigh, NC
- San Antonio, TX
- Savannah, GA

Two registry properties were not present in the workbook and remain without an `encasa_region` in the official registry/local DB:

- Sundara at Spring Cypress
- The Vine Kyle Parkway

Both still receive identity-matrix region context from existing community/source evidence when available.

## Governance Rules

- Resolve every workbook property through `Data_Collection/utils/property_identity.py`.
- Do not add downstream one-off region maps for Captain, POP Brief, peer-family reads, or regional benchmark logic.
- If a future workbook contains an unmapped property label, promote the alias through the governed identity matrix generation path before using the row.
- Rebuild `config/property_identity_matrix.json` after a successful region load.
- Run property identity governance and PIB guardrail checks after material changes.
