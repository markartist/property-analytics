# Data Warehouse Pond Integration Map

Status: Active discovery / validation lane
Date: 2026-05-26
Owner: Data Warehouse / Data Collection / Data Pond

## Purpose

Represent the newly available corporate Data Warehouse inside The Pond as a governed upstream source, not as a parallel reporting stack.

The immediate goal is to preserve known output contracts, especially the daily guest-card CSV, while we validate where direct warehouse extraction can replace manual exports and workbook refreshes.

## Verified Access

- Server alias used by Excel / SQL clients: `sqlreport.ocs-vr.onecornerstone.com`
- Database: `data_warehouse`
- Login: `dw_reader`
- Access path: AWS VPN plus SQL Server authentication
- Credential source: Keeper/KSM record `Data Warehouse`
- Verified SQL Server name: `ALPHA-DA-1`
- Verified active property count from `dw_read.property_bv`: 92

Raw credential values must never be stored in scripts, manifests, docs, logs, Task Scheduler arguments, or workbook connection strings committed to this repo.

## Pond Classification

- Landscape node: `data_warehouse_upstream`
- Trust boundary: `corporate_vpn_sql_readonly`
- Canonical surface: Watchtower / System control-plane visibility
- Integration posture: transitional
- Canonical destination for extraction: `Data_Collection`

This is an external governed source. The Data Pond should store normalized, validated facts and lineage derived from it; the warehouse itself remains the upstream system.

## Highest-Confidence Source Lanes

| Lane | Warehouse Objects Observed | Current Confidence | Recommended Use |
| --- | --- | --- | --- |
| Property reference | `dw_read.property_bv` | High | Active property roster, names, aliases, addresses, reporting flags, region fields |
| Leasing funnel | `dw_read.prospect_bv`, `dw_read.prospect_quote_bv`, `dw_read.online_application_bv`, `dbo.dw_pipeline_applications`, `dbo.dw_prospect_log_entry` | High | Guest cards, quotes, apps, pipeline apps, IPT/SGT appointment counts |
| Resident voice / reputation | `dw_read.kingsley_survey_response_v`, Kingsley question/scale/verbatim views | Medium-high | Kingsley workbook/reputation feed replacement candidates after reconciliation |
| Marketing attribution | `dw_read.marketing_sources_bv`, `dw_read.marketing_source_vendor_site_bv` | Medium | Source-code and vendor/site bridge once prospect/app joins are validated |
| Pricing / availability / lease ops | lease pricing, lease expiry, apartment pricing, vacant-unit detail candidates | Medium | Operational analysis after metric owner definition |
| Service operations | service request and performance views | Medium | Separate operations lane after leasing/reputation validation |
| Financial / ledger | transaction, ledger, invoice, payment families | Low initially | Defer until finance/data owners define approved measures |

## Guest-Card Contract Lineage

The current daily CSV contract can be reproduced from warehouse data using these source families:

| CSV Metric Family | Source | Notes |
| --- | --- | --- |
| Active property rows | `dw_read.property_bv` | Current query filters `status_cd = 'active'` |
| Guest cards and initial contact mix | `dw_read.prospect_bv` | Uses `created_dtt` and `init_contact_type_dv` |
| Portal quotes | `dw_read.prospect_quote_bv` | Current query filters `quote_origin_dv = 'portal'` |
| Online applications | `dw_read.online_application_bv` | Uses `created_dtt` |
| Pipeline applications | `dbo.dw_pipeline_applications` | Uses `created_dtt`; keep date filters tight |
| IPT / SGT appointments | `dbo.dw_prospect_log_entry` joined to prospects | Uses `tour_type_dv`, `follow_up_type_dv = 'SA'`, and period filters |

The current safest production step is to automate the same CSV output into the existing OneDrive drop, then compare 5-10 generated files against the old export files before bypassing the file-drop collector.

## Recommended Integration Sequence

1. Preserve the current `Website Data CSV-YYYYMMDD_HHMMSS.csv` schema and generate it from the warehouse with Keeper-backed credentials.
2. Validate generated files against historical daily exports by run date, property code, and metric totals.
3. Add a canonical Data Collection extractor that either writes the same CSV contract or writes directly to `guest_card_metrics` with the same reconciliation checks.
4. Add source freshness/contract status to Watchtower so warehouse-derived lanes do not become invisible manual dependencies.
5. Repeat the same method for Kingsley/reputation and BI workbook replacement candidates.

The detailed harvest-to-Captain implementation plan is maintained at `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_HARVEST_TO_CAPTAINS_PLAN_2026-05-26.md`.

## Guardrails

- Use Keeper/KSM as the credential source of truth.
- Treat direct environment variables and local credential files only as transitional fallback paths when an existing helper explicitly supports them.
- Keep queries date-windowed; several underlying warehouse tables are large.
- Resolve property identity through `Data_Collection/utils/property_identity.py` and `config/property_identity_matrix.json` before adding downstream property joins.
- Do not replace approved executive artifacts or report formats until regenerated outputs reconcile to the approved files.
- Prefer extending `Data_Collection` and Pond control-plane manifests over one-off scripts.

## Current Artifacts

- First-pass workbook map: `/Users/mark/Property_Analytics/outputs/data_warehouse/Data_Warehouse_Map_2026-05-26.xlsx`
- Harvest-to-Captains plan: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_HARVEST_TO_CAPTAINS_PLAN_2026-05-26.md`
- Daily shadow harvest runbook: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DAILY_SHADOW_HARVEST_RUNBOOK_2026-05-26.md`
- Daily shadow harvest script: `/Users/mark/Property_Analytics/scripts/run_data_warehouse_daily_harvest.mjs`
- First clean daily shadow packet: `/Users/mark/Property_Analytics/outputs/data_warehouse/daily_harvest/2026-05-26_20260526_152346`
- Direct guest-card supplier: `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`
- Direct guest-card supply runbook: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DIRECT_GUEST_CARD_SUPPLY_2026-05-26.md`
- Guest-card export reconciliation script: `/Users/mark/Property_Analytics/scripts/reconcile_data_warehouse_guest_card_exports.mjs`
- Guest-card reconciliation result: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_GUEST_CARD_RECONCILIATION_2026-05-26.md`
- Direct no-CSV guest-card shadow supplier: `/Users/mark/Property_Analytics/scripts/supply_guest_card_metrics_from_data_warehouse.mjs`
- Direct guest-card supply runbook: `/Users/mark/Property_Analytics/docs/DATA_WAREHOUSE_DIRECT_GUEST_CARD_SUPPLY_2026-05-26.md`
- Captain Signal Flow runbook: `/Users/mark/Property_Analytics/docs/CAPTAIN_SIGNAL_FLOW_2026-05-26.md`
- Data Warehouse Captain advisory generator: `/Users/mark/Property_Analytics/scripts/generate_data_warehouse_captain_advisory.mjs`
- First Captain advisory packet: `/Users/mark/Property_Analytics/outputs/captain_signal_flow/data_warehouse/2026-05-26_20260526_154651`
- Pond landscape manifest: `/Users/mark/Property_Analytics/config/system_landscape_manifest.json`
- Service operations manifest: `/Users/mark/Property_Analytics/config/service_operations_manifest.json`
