# Cloudflare Edge Delivery Analytics Source Contract

Date: 2026-05-14
Owner: Data Collection / Data Pond
Status: v1 additive source ingestion

## Purpose

Cloudflare Edge Delivery Analytics captures daily edge-network delivery facts for configured Cloudflare zones and hostnames. It answers infrastructure questions such as:

- how many requests reached Cloudflare edge
- how many bytes were served from the edge
- which requests were served from cache versus forwarded onward
- whether 4xx/5xx edge response volume changed
- which paths are the largest edge-delivery consumers when path grouping is available

The collector follows the Data Pond contract:

collect -> store raw/daily metrics -> rollups/insights later

## Canonical Paths

- Collector: `/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_analytics_collector.py`
- Config: `/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml`
- Smoke test: `/Users/mark/Property_Analytics/scripts/smoke_cloudflare_analytics.py`
- Canonical DB: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- Table: `cloudflare_edge_daily_metrics`
- Migration: `/Users/mark/Property_Analytics/apps/api/migrations/0054_create_cloudflare_edge_daily_metrics.sql`
- Infra mirror migration: `/Users/mark/Property_Analytics/infra/migrations/0040_create_cloudflare_edge_daily_metrics.sql`
- Orchestrator: `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

## Credentials

Required:

- `CLOUDFLARE_API_TOKEN`

Supported alternatives / companion env:

- `CLOUDFLARE_API_TOKEN_FILE`
- `KSM_CLOUDFLARE_TOKEN_NOTATION`
- `CLOUDFLARE_ACCOUNT_ID` for future account-scoped metrics
- `CLOUDFLARE_ZONE_IDS` for config-light zone discovery

Missing credentials are advisory for daily collection. The Cloudflare collector logs a warning, records a skipped collection state when invoked from the daily routine, and does not fail GA4, GSC, Portfolio Pulse, Insights Engine, or D1 mirror behavior.

## Stored Metrics

v1 stores one aggregate row per configured date / zone / hostname plus optional top-path rows:

- `metric_date`
- `zone_id`
- `zone_name`
- `property_id`
- `property_name`
- `hostname`
- `path`
- `requests`
- `bytes`
- `cached_requests`
- `cached_bytes`
- `uncached_requests`
- `origin_request_estimate`
- `cache_hit_ratio`
- `edge_response_status_2xx`
- `edge_response_status_3xx`
- `edge_response_status_4xx`
- `edge_response_status_5xx`
- `edge_response_status_other`
- `edge_response_status_breakdown_json`
- `cache_status_breakdown_json`
- `bot_security_json`
- `raw_response_json`

Rows upsert on:

`metric_date, zone_id, hostname, path`

`path='__all__'` means the hostname-level aggregate row. Path rows carry request/byte facts in v1; hostname aggregate rows carry cache and edge-status breakdowns.

## Source Boundaries

Cloudflare is an edge-delivery and cache source. It is not a user analytics replacement.

Cloudflare does not replace:

- GA4 for visitor/session/user/channel analytics
- Heap for behavioral product analytics
- GSC for search visibility, impressions, clicks, CTR, or indexation
- Portfolio Pulse or Insights Engine logic

Cloudflare metrics may later support infrastructure rollups, cache health reads, Website Change Watch context, performance diagnostics, and edge-experiment guardrails. v1 intentionally does not create dashboards, report sections, executive email changes, or speculative insights.

## GraphQL API

The collector uses Cloudflare GraphQL Analytics API at:

`https://api.cloudflare.com/client/v4/graphql`

Primary dataset:

- `httpRequestsAdaptiveGroups`

v1 filters to:

- one UTC day window
- `requestSource: "eyeball"`
- configured `clientRequestHTTPHost` when a hostname is present

v1 groups by:

- aggregate host/day row
- `cacheStatus`
- `edgeResponseStatus`
- `clientRequestPath` for top paths when available

Bot, security, and WAF metrics are intentionally left out unless they become available through a clean source shape that does not complicate daily collection reliability.
