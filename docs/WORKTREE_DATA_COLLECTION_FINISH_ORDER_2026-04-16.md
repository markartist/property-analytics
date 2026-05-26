# Data Collection Hardening Finish Order

Date: 2026-04-16
Compartment: `data-collection-hardening`

## Status Snapshot

The core collection runtime is already substantially real:

- daily orchestration exists
- retry worker exists
- closure-state logic exists
- Watchtower consumes the closure model

The current hardening work is mostly about alignment:

- making alerting match canonical collection semantics
- reducing false-positive operator noise
- tightening collector-specific expectations where retry and freshness have evolved

## Verified Today

- `python3 -m py_compile Data_Collection/db/database_manager.py Data_Collection/utils/daily_collection_closure.py Data_Collection/utils/source_freshness_policy.py Data_Collection/utils/bi_manual_ingest.py Data_Collection/orchestration/retry_incomplete_collections.py Data_Collection/orchestration/daily_master_collection.py Data_Collection/monitoring/alert_sender.py`
- `python3 Data_Collection/orchestration/retry_incomplete_collections.py --dry-run --json`
- `bash -n /Users/mark/Property_Analytics/run_collection_retry_cycle.sh`
- `python3 Data_Collection/monitoring/alert_sender.py --test`

## What Was Tightened

- Google Ads alerting now respects canonical collection outcomes instead of treating `no_activity` properties as stale data loss.
- Collection failure alerting now reflects the latest source posture rather than replaying older recovered failures from the lookback window.
- Specialty-only job failures now downgrade to warning posture instead of forcing a critical alert subject.

## Finish Sequence

### Phase 1

Lock closure-state and retry orchestration:

- `Data_Collection/utils/daily_collection_closure.py`
- `Data_Collection/orchestration/retry_incomplete_collections.py`
- `Data_Collection/orchestration/daily_master_collection.py`

### Phase 2

Lock operator alerting against that model:

- `Data_Collection/monitoring/alert_sender.py`
- `generate_morning_full_report.py`
- `send_morning_full_report.py`

### Phase 3

Reconcile collector-specific semantics:

- GSC retry + freshness expectations
- guest card / BI manual-feed expectations
- GTMetrix specialty failure posture

### Phase 4

Reconcile shared utility duplication only where it still causes drift:

- `Data_Collection/utils/*`
- `utils/*`

## Rule For Commits

- keep closure/retry logic separate from collector-specific fixes when possible
- do not mix data-lane hardening with Watchtower/auth or content-operation changes
