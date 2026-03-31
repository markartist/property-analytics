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
3. Optional Phase 1 governed platform sync for `ga4` + `psi`
   - enabled with `ENABLE_PHASE1_PLATFORM_SYNC=true`
   - uses:
     - [`platform_phase1_client.py`](/Users/mark/Property_Analytics/apps/api/scripts/platform_phase1_client.py)
     - `/v1/platform/mirror/intake`
     - `/v1/platform/mirror/reconcile`
     - `/v1/platform/mirror/activate`
   - optional `property_advocate` path enabled with:
     - `ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true`
4. Target Friday resolution from source-table recency
5. D1 sync jobs:
   - `guest_cards_to_d1.py`
   - `pib_data_to_d1.py`
   - `marketing_data_to_d1.py`
6. Remote D1 verification (freshness + row-count sanity)
7. JSON audit report output in:
   `/Users/mark/Property_Analytics/apps/api/scripts/generated/d1_mirror_report_*.json`
8. Optional Phase 1 activity artifact:
   `/Users/mark/Property_Analytics/apps/api/scripts/generated/platform_phase1_activity_*.json`

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

## Phase 1 enablement flags
```bash
export PLATFORM_BASE_URL="https://app.venterradev.com"
export PLATFORM_SHARED_TOKEN="..."
export ENABLE_PHASE1_PLATFORM_SYNC=true

# optional governed advocate path
export ENABLE_PHASE1_PROPERTY_ADVOCATE_RUN=true
```

## Phase 1 cutover verification
```bash
/Users/mark/Property_Analytics/apps/api/scripts/verify_phase1_platform_cutover.sh
```

## Orchestration integration
Daily collection now includes a dedicated mirror phase in:
`/Users/mark/Property_Analytics/Data_Collection/orchestration/daily_master_collection.py`

Phase label:
`PHASE 9: D1 MIRROR SYNC`
