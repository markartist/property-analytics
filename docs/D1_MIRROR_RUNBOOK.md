# D1 Mirror Runbook

## Purpose
Keep Cloudflare D1 (`pop-brief-db`) aligned with the local canonical database:
`/Users/mark/Property_Analytics/data/portfolio_analytics.db`.

## Script
`/Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py`

## Daily behavior
The mirror script runs this sequence:
1. Local DB integrity checks (`PRAGMA quick_check`, `PRAGMA integrity_check`)
2. Local cleanup/optimization (`PRAGMA optimize`, `wal_checkpoint`)
3. Target Friday resolution from source-table recency
4. D1 sync jobs:
   - `guest_cards_to_d1.py`
   - `pib_data_to_d1.py`
   - `marketing_data_to_d1.py`
5. Remote D1 verification (freshness + row-count sanity)
6. JSON audit report output in:
   `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_*.json`

## Manual commands
```bash
# normal run
python3 /Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py

# explicit Friday
python3 /Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py --date 2026-02-13

# dry run (generate/validate flow without pushing updates)
python3 /Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py --dry-run

# include SQLite vacuum maintenance
python3 /Users/mark/Property_Analytics/apps/api/scripts/d1_mirror_sync.py --vacuum
```

## Orchestration integration
Daily collection now includes a dedicated mirror phase in:
`/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

Phase label:
`PHASE 9: D1 MIRROR SYNC`
