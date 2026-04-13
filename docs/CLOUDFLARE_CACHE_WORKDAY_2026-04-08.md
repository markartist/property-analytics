# Cloudflare Cache Workday Memory

**Date:** 2026-04-08  
**Scope:** Resi pilot domains on Cloudflare + Kinsta  
**Intent:** Preserve the decisions, baseline, tooling, and operational context from the initial Cloudflare caching day.

## What Was Completed

### 1. Daily Cloudflare cache audit was built and wired into the existing collectors

Implemented:

- [cloudflare_cache_audit.py](/Users/mark/Property_Analytics/Data_Collection/collectors/cloudflare_cache_audit.py)
- [cloudflare_graphql_cache_metrics.py](/Users/mark/Property_Analytics/Data_Collection/queries/cloudflare_graphql_cache_metrics.py)
- [cloudflare_cache_daily_report.py](/Users/mark/Property_Analytics/Data_Collection/reports/cloudflare_cache_daily_report.py)
- [cloudflare_cache_audit.yaml](/Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml)

Supporting integration:

- [database_manager.py](/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py)
- [daily_master_collection.py](/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py)
- [pib_email_shell.py](/Users/mark/Property_Analytics/utils/pib_email_shell.py)

### 2. The pilot baseline was captured across all five domains

Pilot domains:

- `championsgreen-ga.com`
- `thedistrictuniversal.com`
- `theharrisonsandysprings.com`
- `ventanaapts.com`
- `calaismidtownapartments.com`

Daily baseline findings:

- All five domains failed the synthetic homepage warm-cache gate
- Every tested homepage variant returned second-request `CF-Cache-Status: DYNAMIC`
- Warm HIT coverage was `0.00%` across the portfolio
- Cloudflare zone-level cache-hit ratios ranged from `38.70%` to `53.71%`
- Current zone settings observed across pilots:
  - `cache_level = aggressive`
  - `browser_cache_ttl = 14400`
  - `sort_query_string_for_cache = off`

Portfolio scoreboard from the April 8, 2026 report:

- Domains audited: `5`
- Status mix: `0 pass, 0 warn, 5 fail`
- Average Cloudflare cache-hit ratio: `47.20%`
- Average homepage warm TTFB: `59.3 ms` desktop, `63.5 ms` mobile
- Average warm HIT coverage: `0.00%`

### 3. Reporting artifacts were generated

Report directory:

- [2026-04-08 cache audit outputs](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08)

Key artifacts:

- [JSON artifact](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08/cloudflare_cache_audit_2026-04-08.json)
- [CSV summary](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08/cloudflare_cache_audit_2026-04-08.csv)
- [Markdown summary](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08/cloudflare_cache_audit_2026-04-08.md)
- [PIB-style HTML email preview](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit/2026-04-08/cloudflare_cache_audit_2026-04-08.html)

### 4. Phase 1 homepage-only Cloudflare full-page cache rollout tooling was created

Implemented:

- [cloudflare_full_page_cache.yaml](/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml)
- [cache_rules_manager.py](/Users/mark/Property_Analytics/ops/cloudflare/cache_rules_manager.py)
- [apply_pilot_full_page_cache.py](/Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py)
- [purge_cloudflare_cache.py](/Users/mark/Property_Analytics/ops/cloudflare/purge_cloudflare_cache.py)
- [CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md)

## Key Technical Decisions

### Architecture

Non-negotiable direction:

- `Kinsta = origin + application host + origin cache`
- `Cloudflare = primary HTML edge cache we control`
- Avoid stacked HTML edge caches
- Do not rely on Kinsta Edge Caching for HTML delivery on these pilot domains

### Phase 1 rule strategy

Two-rule `http_request_cache_settings` entrypoint:

1. Bypass dynamic/admin/authenticated/preview/non-GET traffic
2. Cache homepage HTML for anonymous `GET` and `HEAD` traffic

### Query strings

Not normalized in Phase 1.

Reason:

- preserve attribution behavior
- observe fragmentation before making key changes
- use audit data to decide later normalization

### Browser vs edge TTL

Desired rollout TTL was `1800s`, but all pilot zones are on Cloudflare `Free Website`.

Effective implementation:

- edge TTL clamped to `7200s`
- browser TTL remains conservative via `respect_origin`

## Cloudflare Access and Token Findings

Important lesson from the day:

- the first two tested account-style tokens did not expose analytics access at runtime
- the third token in Downloads did expose `#analytics:read` and allowed GraphQL analytics queries

Working read token used for validation:

- `/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt`

Current limitation:

- this token is read-only
- it can validate, inspect, dry-run, and collect analytics
- it cannot apply or purge cache rules

To live-apply the Phase 1 rules, a write-capable token is still required with at least:

- `Zone Read`
- `Cache Settings Write`

## Live Validation Performed

### Cloudflare state inspection

Confirmed:

- all 5 pilot zones are active
- all 5 are on `Free Website`
- no existing custom `http_request_cache_settings` entrypoint exists

### Dry-run cache rules render

Dry-run command succeeded:

```bash
export CLOUDFLARE_API_TOKEN_FILE=/Users/mark/Downloads/Cloudflare_Cache_Audit_Token_3.txt
python3 /Users/mark/Property_Analytics/ops/cloudflare/apply_pilot_full_page_cache.py \
  --config /Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml
```

Dry-run export:

- [ruleset render snapshots](/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache/20260409T010139Z)

Meaning:

- the rules payload is rendered and exportable
- no unexpected existing cache-rules entrypoint blocked the rollout
- live apply was intentionally not attempted with the read-only token

## Known Open Items

1. Confirm Kinsta Edge Caching is off for the five pilot domains before live enablement.
2. Generate or obtain a write-capable Cloudflare token for rule application and purge actions.
3. Apply Phase 1 homepage-only rules.
4. Purge Cloudflare after apply.
5. Re-run the cache audit and verify second-request homepage `HIT`.
6. If Phase 1 passes, expand to key public pages in Phase 2.

## Recovery Checklist for a Future Session

If a future session needs to resume this work:

1. Read [ATLAS_WORKING_MEMORY.md](/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md).
2. Read [CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_CACHE_WORKDAY_2026-04-08.md).
3. Read [CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md](/Users/mark/Property_Analytics/docs/CLOUDFLARE_FULL_PAGE_CACHE_PHASE1.md).
4. Review the current audit artifact in [reports/cloudflare_cache_audit](/Users/mark/Property_Analytics/reports/cloudflare_cache_audit).
5. Review the dry-run JSON in [outputs/cloudflare_full_page_cache](/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache).
6. Use the write-capable token only when ready to apply.
