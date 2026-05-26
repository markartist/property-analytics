# VP Property Retrieval JSON Contract

Date: 2026-05-06
Owner: Data Collection / Data Pond
Status: Active v1 specimen

## Purpose

This contract is the retrieval layer requested by the VP. It produces one clean JSON object per property for a downstream diagnostic agent. It is not a report, not a Captain Brief renderer, and not a PIB renderer.

The output is intentionally structured around source retrieval and comparability, not interpretation. The consuming agent should decide what is broken, what is improving or declining, and which actions to take.

## Canonical Script

Primary serializer:

`/Users/mark/Property_Analytics/Data_Collection/read_models/vp_property_retrieval_json.py`

Example command:

```bash
python3 Data_Collection/read_models/vp_property_retrieval_json.py --property TX4EG
```

Default output directory:

`/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract`

First approved specimen:

`/Users/mark/Property_Analytics/reports/property_diagnostics/vp_contract/tx4eg_vp_retrieval_2026-05-06.json`

## Contract Shape

Each file contains one property object with these top-level sections:

- `property`
- `as_of_date`
- `time_series_definition`
- `demand_signals`
- `funnel_conversion`
- `inventory_product`
- `demand_vs_inventory_matching`
- `pricing_market_position`
- `marketing_efficiency`
- `reputation_product_friction`
- `website_performance`
- `derived_flags`
- `missing_data`

## Required Business Semantics

- Current month means month-to-date through the latest available source date.
- `pd` means paid traffic.
- T30 means trailing 30 days or the closest source-supplied last-full-month equivalent.
- T90 means trailing 90 days or the closest source-supplied last-three-month equivalent.
- Required unavailable values must not be invented.
- Required unavailable values are represented with `available: false` plus `missing_data_path`.
- Source limitations are listed once in `missing_data`.
- The serializer should avoid noisy repeated `null` comparison scaffolding. The Elation specimen currently emits `0` JSON null values.

## Source Rules

- Property identity must resolve through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`.
- Spend must come from the spend workbook route, especially `marketing_bi_monthly_ad_spend_source_rows`.
- Funnel performance should use Marketing BI rows where available.
- Website engagement should use GA4 rows where available.
- PSI and Core Web Vitals should use portfolio-wide `pagespeed_metrics` first, with pilot-only PSI as fallback only when needed.
- Abandoned application rows are loaded but not property-attributable when the export has no property key. Do not publish property-level abandoned counts from unattributed rows.
- T365 move-in source rows must not store resident names.

## Boundary

This is a Data Pond read model. It must not touch locked PIB files, create alternate PIB rendering templates, or substitute for the Captain Brief presentation layer.

## Production Next Step

After VP approval of the Elation specimen, generate one file per Spotlight property. The expected production posture is 11 separate JSON files, one object per file, each resolved through the governed property identity matrix.
