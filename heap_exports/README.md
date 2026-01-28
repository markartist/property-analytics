# Heap Funnel Exports - Staging Folder

## ⚠️ AUTHORITY NOTICE

**Heap data is exploratory/tertiary and must not be used as authoritative KPI source.**

- **GA4 remains the authoritative data source** for all official reporting
- Heap exports are for **exploratory analysis and context only**
- Do NOT use Heap data for KPIs, dashboards, or authoritative metrics
- This data supplements (but does not replace) GA4 analytics

## Purpose

This folder is for manual drops of Heap funnel export CSVs. These exports are ingested into the shared Portfolio Analytics database for exploratory analysis.

## File Naming Convention

**Required format:**
```
heap_funnel_<site_or_group>_<YYYYMMDD>.csv
```

**Examples:**
- `heap_funnel_property_site_20251223.csv`
- `heap_funnel_all_properties_20251223.csv`
- `heap_funnel_apex_west_midtown_20251223.csv`

## How to Export from Heap

1. Log into Heap Analytics
2. Navigate to **Funnels** or **Reports**
3. Configure funnel steps (e.g., User Journey Drop-off)
4. Set date range (e.g., Last 90 days)
5. Set segment filter (e.g., "Property Site")
6. Export as CSV
7. Download and rename per convention above
8. Place in this folder

## CSV Format Requirements

**Expected columns:**
- `Step` (or similar) - Step name/label
- `Number of Users` (or similar) - User count for that step

The importer will detect headers automatically. If column names differ from expected, the import will fail with a clear error message.

## How to Import

```bash
cd /Users/mark/Property_Analytics/Portfolio_Monitoring

# Import a Heap funnel CSV
python3 scripts/import_heap_funnel.py \
  --csv ../heap_exports/heap_funnel_property_site_20251223.csv \
  --report-name "User Journey Drop-off (Exploratory – Heap)" \
  --date-range-days 90 \
  --segment "Property Site"
```

**Arguments:**
- `--csv` - Path to Heap CSV export (required)
- `--report-name` - Descriptive name for this funnel (required)
- `--date-range-days` - Number of days in the date range (required)
- `--segment` - Heap segment name, e.g., "Property Site" (optional, default: "unknown")

## Database Location

Heap data is stored in the shared Portfolio Analytics database:
```
/Users/mark/Property_Analytics/data/portfolio_analytics.db
```

**Table:** `heap_funnel_steps`

## Query Examples

```sql
-- View most recent import
SELECT * FROM heap_funnel_steps 
ORDER BY ingested_at DESC, step_index 
LIMIT 10;

-- View specific report
SELECT step_index, step_name, users, pct_of_step1 
FROM heap_funnel_steps 
WHERE report_name = 'User Journey Drop-off (Exploratory – Heap)'
AND date_range_days = 90
ORDER BY step_index;

-- Compare segments
SELECT segment, step_index, step_name, users, pct_of_step1
FROM heap_funnel_steps
WHERE report_name = 'User Journey Drop-off (Exploratory – Heap)'
ORDER BY segment, step_index;
```

## Notes

- **No secrets** should be stored in this folder
- CSV files contain aggregate user counts only (no PII)
- Files are not automatically cleaned up - archive manually as needed
- This is a manual import process - no automated collection
- Heap data does NOT replace GA4 as source of truth

## Troubleshooting

**Import fails with "Columns not found":**
- Check CSV headers match expected format
- Verify Step and user count columns exist
- Error message will list found columns

**Duplicate row error:**
- Same report_name + date_range + segment + step_index already exists
- This is expected behavior to prevent accidental re-imports
- Delete old data or change report_name if intentional re-import

**Database not found:**
- Verify shared database exists at path above
- Check PORTFOLIO_ANALYTICS_DB_PATH environment variable
- Run Portfolio_Monitoring collection at least once to create DB

## References

- Import script: `Portfolio_Monitoring/scripts/import_heap_funnel.py`
- Documentation: `Portfolio_Monitoring/docs/HEAP_IMPORT.md`
- Shared database schema: `Portfolio_Monitoring/schema/`
