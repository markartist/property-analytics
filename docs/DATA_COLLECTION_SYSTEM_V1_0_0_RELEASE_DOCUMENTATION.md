# Data Collection System v1.0.0 - Release Documentation

**Release Date**: February 2, 2026  
**Status**: Production Ready (Monitoring in Progress)  
**Validation Level**: Data-Integrity First  
**Author**: AI Development Team  
**Maintainer**: Mark Laufhutte (mlaufhutte@venterraliving.com)

---

## Executive Summary

The **Data Collection System v1.0.0** is the unified, mission‑critical pipeline that powers all portfolio analytics. It performs scheduled daily collection, validates data quality, and writes all outputs into a single canonical database for downstream reporting (PIB, Spotlight, Health, etc.).

**Core Principles**
- **Single Source of Truth**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- **Single Registry**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`
- **Database‑First**: Reports read from DB only (no API calls during report generation)
- **Data Integrity Above All**: Validation, freshness checks, and audit trails are required

---

## System Architecture (Current State)

**Daily Execution**: macOS LaunchAgent (5:00 AM local)  
**Master Script**: `Data_Collection/orchestration/daily_master_collection.py`

```
LaunchAgent → daily_master_collection.py
  ├─ Preflight checks (DB + registry)
  ├─ Credential checks (GA4 + GSC OAuth)
  ├─ GA4 collection (tracked)
  ├─ GSC collection (inline)
  ├─ Cendana GSC special case (inline)
  ├─ Google Ads collection (inline)
  ├─ PSI collection (subprocess)
  ├─ GBP reviews (inline)
  ├─ GBP insights (inline)
  ├─ ThirtyLines availability (collector)
  ├─ SEMRush (inline, full mode)
  ├─ GTMetrix (inline, full mode)
  ├─ Anomaly detection
  ├─ Data quality validation
  └─ Daily collection report email
```

---

## Canonical Sources

**Database**: `/Users/mark/Property_Analytics/data/portfolio_analytics.db`  
**Registry**: `/Users/mark/Property_Analytics/config/venterra_properties_official.json`

**Registry Size (current)**: 93 properties  
(Includes 2 new properties with no GSC profiles and very low/near‑zero traffic. Do not hardcode property counts — always read from registry.)

---

## Data Sources Collected

| Source | Frequency | Status | Notes |
|---|---|---|---|
| GA4 | Daily | ✅ Working | Full 30‑day daily breakdown + traffic + device + events |
| GSC | Daily | ✅ Working | 30‑day daily metrics + query data (3‑day API lag); 2 new properties have no GSC profiles |
| PageSpeed | Daily | ✅ Working | Runs via `Portfolio_Dashboard/scripts/collect_daily_psi.py` |
| Google Ads | Daily | ✅ Working | Uses mapping table; if no mapping, report omits ads section |
| SEMRush | Daily (full mode) | ✅ Working | Direct API calls; can fail if network blocked |
| GBP Reviews | Daily | ✅ Working | Requires GBP mapping file |
| GBP Insights | Daily | ✅ Working | 2‑day API lag |
| ThirtyLines | Daily | ✅ Working | Availability + floorplans |
| GTMetrix | Weekly/Monthly | ✅ Working | Sampled subset (if enabled) |

---

## Database Tables (Actual Usage)

**Core Collection Tables**
- `ga4_daily_metrics`
- `ga4_traffic_sources`
- `ga4_device_metrics`
- `ga4_event_facts`
- `gsc_daily_metrics` (dual‑write, canonical `ga4_property_id`)
- `gsc_queries`
- `pagespeed_metrics`
- `google_ads_campaigns`
- `google_ads_keywords`
- `gbp_reviews`
- `gbp_review_sentiment`
- `gbp_daily_insights`
- `property_floorplans`
- `unit_availability`
- `semrush_domain_metrics`
- `gtmetrix_metrics`

**Monitoring / Validation Tables**
- `data_collections`
- `collection_errors`
- `validation_rules`
- `data_quality_checks`
- `data_quality_scores`

---

## Monitoring & Integrity (Current)

### Preflight Checks
- DB path and registry file exist (`Data_Collection/utils/preflight.py`)
- Credential check for GA4 + GSC (`Data_Collection/monitoring/credential_monitor.py`)

### Collection Tracking
- **Only GA4 uses `CollectionMonitor` in current orchestrator**
- Other collectors are inline and do not yet write full monitoring stats

### Data Quality Validation
- `Data_Collection/orchestration/validate_data_quality.py`
- Handles API delay windows:
  - GA4/PSI/ThirtyLines: yesterday
  - GSC: 3‑day lag
  - GBP Insights: 2‑day lag
  - GBP Reviews: last 7 days

### Daily Collection Report
- `Data_Collection/monitoring/daily_collection_report.py`
- HTML summary of results, freshness, and DB health
- Email provider determined by `credentials/email_config.json`

---

## Known Gaps (Current State)

1. **Registry validation script reference**
   - Master script calls `orchestration/validate_registry_completeness.py`
   - File does not exist today

2. **GSC timeouts**
   - GSC requests do not include explicit timeouts

3. **Collector tracking coverage**
   - GA4 is tracked, most others are not

4. **Quick mode behavior**
   - `--quick` still runs Google Ads, PSI, GBP, and ThirtyLines
   - It only skips SEMRush/GTMetrix

5. **SEMRush dependency**
   - Competitor analysis uses live API calls (not DB‑only)
   - Should be documented as runtime dependency

---

## Operational Procedures (Actual)

**Manual Runs**
```bash
cd /Users/mark/Property_Analytics/Data_Collection
python3 orchestration/daily_master_collection.py --test
python3 orchestration/daily_master_collection.py --quick
python3 orchestration/daily_master_collection.py --no-gtmetrix
python3 orchestration/daily_master_collection.py
```

**Quality Validation**
```bash
python3 orchestration/validate_data_quality.py
```

**Daily Report**
```bash
python3 monitoring/daily_collection_report.py
```

---

## Email & Alert System (Actual)

- Provider is **config‑driven**, not fixed.
- Configuration file: `/Users/mark/Property_Analytics/credentials/email_config.json`
- Backup Gmail config: `/Users/mark/Property_Analytics/credentials/email_config.json.gmail_backup`

---

## Troubleshooting (Short List)

**No new data**
- Check launch agent status
- Check latest `data_collections`
- Check `Data_Collection/logs/` for last run

**GSC missing / stale**
- Confirm 3‑day lag is expected
- Check credential refresh token

**Email not sending**
- Validate `email_config.json`
- Test `EmailSender` directly

---

## Document Version Control

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0.0 | 2026-02-02 | Initial accurate system release documentation | AI Development Team |

---

**END OF DOCUMENT**
