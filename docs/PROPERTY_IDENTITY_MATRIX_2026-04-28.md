# Property Identity Matrix

Date: 2026-04-28
Owner: Data Pond / Captain's Log
Status: Active foundation

## Purpose

Each property has multiple valid identifiers across Venterra systems. The Captain's Log, POP Brief, BI ingestion, search reporting, paid media, and unit-feed reads must resolve those identifiers through one governed matrix before producing property-level facts.

The canonical matrix is:

- `/Users/mark/Property_Analytics/config/property_identity_matrix.json`

The reusable resolver is:

- `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`

## Canonical Key Policy

Use the property code as the visible and Captain-facing property id when one exists.

Examples:

- The Pointe Bentonville visible property id: `AR4PB`
- GA4 property id: `482958962`
- GSC property id: `https://venterraliving.com/apartments/the-pointe-bentonville/`
- Captain / app community id: `5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440`

If no property code exists, fall back to the GA4 property id until a true operating code is assigned.

## Matrix Fields

Each row carries:

- `canonical_property_id`: property code when available, otherwise GA4 property id
- `display_property_id`: the property-facing id to show in reports
- `property_code`: Encasa / property operating code
- `community_id`: Data Pond / app community UUID where known
- `ga4_property_id`: Google Analytics property id
- `gsc_url`: Google Search Console site property
- `website_url`: canonical property website URL
- `property_name`: official registry name
- `community_name`: app community name where known
- `encasa_short_name`: short name used by BI / operating exports
- `encasa_region`, `city`, `state`, `company_id`, `gbp_location_id`, `unit_count`
- `aliases`: accepted source names for matching imported reports
- `source_refs`: source presence flags

## Source Inputs

The matrix is generated from:

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`, table `properties`
- `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- `/Users/mark/Property_Analytics/apps/api/scripts/generated/04_insert_communities.sql`
- `/Users/mark/Property_Analytics/config/generated/remote_communities_snapshot.json`

Location enrichment is applied to the local `properties` table with:

```bash
python3 scripts/enrich_property_locations.py
```

That path uses GBP location city, Spotlight registry location where available, and property-code / Encasa-region state inference.

Refresh the remote community snapshot with:

```bash
python3 scripts/refresh_remote_communities_snapshot.py
```

Regenerate with:

```bash
python3 scripts/build_property_identity_matrix.py
```

Validate with:

```bash
python3 scripts/check_property_identity_matrix.py
```

## Enforcement

New source ingesters should use `resolve_property_identity()` instead of local hardcoded maps.

Current first enforcement points:

- `Data_Collection/utils/marketing_bi_conversion_ingest.py`
- `Data_Collection/utils/marketing_bi_packet_ingest.py`
- `Data_Collection/utils/available_unit_interest_ingest.py`
- `Data_Collection/utils/dataforseo_serp_ingest.py`
- `apps/api/scripts/operating_metrics_to_d1.py`
- `apps/api/scripts/captain_sources_to_d1.py`

This removes the special-case The Pointe mapping from those ingesters and lets all BI rows resolve through the governed identity matrix.

Governance check:

```bash
bash scripts/check_property_identity_governance.sh
```

The governance check validates the matrix and verifies that required ingestion / Captain bridge files use `resolve_property_identity()` rather than local property maps or hardcoded property-id bundles.
It also requires full `community_id` coverage for every property in the matrix.

Agent/session discipline now also requires the matrix for new property-scoped ingestion, Captain reads, report inputs, and automations. New identifiers should be added upstream to the matrix build path rather than handled as downstream exceptions.

## Current Coverage

As of 2026-04-28:

- 93 properties in the matrix
- 93 with app / D1 `community_id`
- 93 with city/state
- 91 with property code
- 2 without property code: prelaunch / non-standard communities that do not currently have operating property codes in the local `properties` table
