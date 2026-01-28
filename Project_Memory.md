# Property Analytics Project Memory

## 2025-12-25 — Atlas Standardization Complete

**Canonical DB Path:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

**Environment Variable:** `PORTFOLIO_ANALYTICS_DB_PATH`

**Helper Module:** `src/db/db_helper.py`

**Atlas Scripts:**
- `/Users/mark/Property_Analytics/ops/atlas_runner.py` - Backups + verification + helper/README note
- `/Users/mark/Property_Analytics/ops/atlas_refactor.py` - Replaced sqlite3.connect(...) with connect_db(), created .py.bak backups

**Verification:**
- Integrity: ok
- ga4_event_facts: 405489 rows

**Refactor Statistics:**
- 49 files modified
- 90 replacements made

**Governance:**
- Backup location: `/Users/mark/Property_Analytics/data/backups`
- Orphan archive: `/Users/mark/Property_Analytics/data/archive`
- Timestamped backup created
- All repos updated with Database Access Standard section
