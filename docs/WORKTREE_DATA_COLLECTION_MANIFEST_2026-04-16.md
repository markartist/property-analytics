# Data Collection Hardening Worktree Manifest

Date: 2026-04-16
Compartment: `data-collection-hardening`

## Purpose

This manifest defines the current Data Collection hardening lane so orchestration, retry, closure, freshness, and alerting work can be finished separately from the app/platform and content lanes.

## Included Files

### Collection Core

- `/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/retry_incomplete_collections.py`
- `/Users/mark/Property_Analytics/Data_Collection/db/database_manager.py`

### Monitoring / Alerts / Closure

- `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- `/Users/mark/Property_Analytics/Data_Collection/monitoring/anomaly_detector.py`
- `/Users/mark/Property_Analytics/Data_Collection/monitoring/credential_monitor.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/daily_collection_closure.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/source_freshness_policy.py`
- `/Users/mark/Property_Analytics/scripts/check_context_discipline.sh`

### Collectors / Feed-Specific Hardening

- `/Users/mark/Property_Analytics/Data_Collection/collectors/gsc_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/guest_card_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/collectors/gtmetrix_collector.py`
- `/Users/mark/Property_Analytics/Data_Collection/orchestration/backfill_cwv_history.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/bi_manual_ingest.py`

### Shared Utility Synchronization

- `/Users/mark/Property_Analytics/Data_Collection/utils/data_quality_validator.py`
- `/Users/mark/Property_Analytics/Data_Collection/utils/email_sender.py`
- `/Users/mark/Property_Analytics/utils/config_manager.py`
- `/Users/mark/Property_Analytics/utils/data_quality_validator.py`
- `/Users/mark/Property_Analytics/utils/email_sender.py`

### Scheduled Entry Points / Report Delivery

- `/Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- `/Users/mark/Property_Analytics/run_daily_health_report.sh`
- `/Users/mark/Property_Analytics/send_daily_health_report.py`
- `/Users/mark/Property_Analytics/send_weekly_progress_report.py`
- `/Users/mark/Property_Analytics/generate_morning_full_report.py`

### Data Collection Docs

- `/Users/mark/Property_Analytics/DATA_COLLECTION_README.md`
- `/Users/mark/Property_Analytics/Data_Collection/SYSTEM_BOUNDARY_AND_INTEGRATION_REPORT.md`

## Included Themes

- same-day retry and recovery flow
- collection closure state
- source freshness policy
- guest card / GSC / GTMetrix hardening
- alert/report delivery alignment

## Excluded Themes

These should stay out of `data-collection-hardening` commits unless they are required for execution:

- Watchtower frontend and app auth flow
- Site Content / Intelligence / VACS
- Pilot report prototypes unrelated to collection truth

## Recommended Finish Order

1. settle closure-state and retry orchestration
2. settle alert sender behavior against the new closure model
3. verify guest card / GSC / GTMetrix collector expectations
4. reconcile shared utility duplicates if still necessary
5. commit delivery scripts/docs after runtime behavior is stable

Companion finish-order doc:

- `/Users/mark/Property_Analytics/docs/WORKTREE_DATA_COLLECTION_FINISH_ORDER_2026-04-16.md`
