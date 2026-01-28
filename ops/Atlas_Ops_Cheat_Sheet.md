# Atlas Ops Cheat Sheet

## Canonical Database

**Path:** `/Users/mark/Property_Analytics/data/portfolio_analytics.db`

**Environment Variable:** `PORTFOLIO_ANALYTICS_DB_PATH`

**Standard Helper:** `src/db/db_helper.py`

## Standard Usage Snippet

```python
from src.db.db_helper import connect_db
conn = connect_db()
```

## Atlas Scripts

- **`/Users/mark/Property_Analytics/ops/atlas_runner.py`**  
  Backups + verification + helper/README note

- **`/Users/mark/Property_Analytics/ops/atlas_refactor.py`**  
  Replaced `sqlite3.connect(...)` with `connect_db()`, created `.py.bak` backups

## Smoke Test

### Commands

```bash
export PORTFOLIO_ANALYTICS_DB_PATH="/Users/mark/Property_Analytics/data/portfolio_analytics.db"
```

### Expected Output

- **Integrity:** ok
- **ga4_event_facts:** 405489

## Cleanup

**.py.bak Files:**  
The refactor script created `.py.bak` backup files for each modified Python file. Once you've verified the refactored code works correctly, you can remove them:

```bash
find /Users/mark/Property_Analytics -name "*.py.bak" -type f -delete
```

Or review them first:

```bash
find /Users/mark/Property_Analytics -name "*.py.bak" -type f
```

## Governance Notes

**Date:** 2025-12-25

- **Integrity:** ok
- **ga4_event_facts:** 405489
- **Refactor:** 49 files / 90 replacements
- **Orphan DBs:** archived
- **Timestamped backup:** created
