# Cloudflare Billable Usage Source Contract

Date: 08/04/2026
Owner: Data Collection / Data Pond / Watchtower
Status: v1 additive FinOps source ingestion

## Purpose

Cloudflare Billable Usage captures account-level usage and cost facts for Cloudflare products. It answers operational questions such as:

- which Cloudflare product families are creating usage-based cost
- whether Workers, R2, D1, Workers AI, Vectorize, Images, Stream, or zone-scoped services are changing spend patterns
- whether agentic workflows are creating unexpected Cloudflare consumption
- which usage/cost facts should be visible to Watchtower before month-end invoice review

The collector follows the Data Pond contract:

collect -> store source facts -> rollups/alerts/insights later

## Canonical Paths

- Collector: `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_billable_usage_collector.py`
- Config: `/Users/mark/Property_Analytics/config/cloudflare_billable_usage.yaml`
- Canonical DB: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Tables: `cloudflare_billable_usage_daily`, `cloudflare_billable_usage_collections`
- Migration: `/Users/mark/Property_Analytics/apps/api/migrations/0061_create_cloudflare_billable_usage_tables.sql`
- Orchestrator: `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- D1 bridge: `/Users/mark/Property_Analytics/apps/api/scripts/cloudflare_billable_usage_to_d1.py`
- Watchtower visibility: `/Users/mark/Property_Analytics/apps/api/src/routes/health.ts`

## Credentials

Keeper Secrets Manager remains the credential authority.

Required Cloudflare token capability:

- `Billing Read`

Supported resolution:

- `KSM_CLOUDFLARE_BILLING_TOKEN_NOTATION`, defaulting to `keeper://LttlGLhno7Ddd-GYZPWFTw/field/password`
- transitional `CLOUDFLARE_BILLING_API_TOKEN`

Account id resolution:

1. `account_id` in `/Users/mark/Property_Analytics/config/cloudflare_billable_usage.yaml`, currently `5a5a60afaad00085864fe6bab7eb2882`
2. `CLOUDFLARE_ACCOUNT_ID`
3. read-only `/accounts` discovery only when exactly one account is visible

Do not create a local credential file or checked-in token for this source. Billing Read is represented by the Keeper record titled `Cloudflare Billing Token`; keep this billing token separate from the broader `Cloudflare API Token` used by Cloudflare ops scripts.

## Stored Facts

`cloudflare_billable_usage_daily` stores one row per account / charge period / service / zone attribution:

- `charge_period_start`
- `charge_period_end`
- `billing_period_start`
- `billing_period_end`
- `account_id`
- `account_name`
- `service_name`
- `service_family_name`
- `billing_currency`
- `pricing_quantity`
- `consumed_quantity`
- `consumed_unit`
- `contracted_cost`
- `cumulated_pricing_quantity`
- `cumulated_contracted_cost`
- `zone_id`
- `zone_name`
- `collection_status`
- `raw_json`

Rows upsert on:

`account_id, charge_period_start, charge_period_end, service_name, zone_id`

Rows that are account-level rather than zone-scoped use `zone_id='__account__'`.

`cloudflare_billable_usage_collections` stores the collection run summary for Watchtower and auditability.

## Source Boundaries

Cloudflare Billable Usage is a cost/usage source, not a performance, traffic, attribution, search, or property operating source.

It does not replace:

- GA4 for visitor/session/channel analytics
- GSC for search visibility
- Heap/Zaraz for behavior and event instrumentation
- Cloudflare Edge Delivery Analytics for request/cache facts
- vendor invoices or contract terms for final finance reconciliation

This collector is read-only. It must not create zones, deploy Workers, purge cache, edit DNS, mutate billing state, or call payment/wallet APIs.

## Run

Manual collection for the current billing period:

```bash
python3 Data_Collection/collectors/cloudflare_billable_usage_collector.py
```

Specific date, collected as `from=<date>` and exclusive `to=<next day>`:

```bash
python3 Data_Collection/collectors/cloudflare_billable_usage_collector.py --date 2026-08-03
```

Daily orchestration calls this after Cloudflare Edge Delivery Analytics as an advisory source. The default query intentionally omits `from` / `to` so Cloudflare returns the current billing period; Cloudflare documents that custom dated ranges must include the subscription billing-cycle anchor day or the endpoint can return no usage rows. Missing Billing Read permission should record a graceful advisory failure or skip without blocking core collection.

Mirror local source facts to D1:

```bash
python3 apps/api/scripts/cloudflare_billable_usage_to_d1.py --days 90
```

The daily D1 mirror runs this script as an advisory sync. Watchtower counts only collection rows where `api_status='ok'`, so authentication or permission failures remain visible for audit without being treated as fresh billable usage data.
