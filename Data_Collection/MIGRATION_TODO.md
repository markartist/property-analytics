# Migration TODO - Import Fixes Required

## Status: Phase 3 Complete (Files Copied)
**Next**: Update imports to use unified Data_Collection structure

## Files Requiring Import Updates

### 1. `orchestration/daily_master_collection.py` ✏️ HIGH PRIORITY
**Current imports** (lines 24-59):
```python
sys.path.insert(0, _parent_dir)
sys.path.insert(0, _dashboard_utils)  
sys.path.insert(0, _local_src)
# ... messy path manipulation
```

**Should become**:
```python
# No sys.path manipulation needed!
from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.collectors.gsc_collector import GoogleSearchConsoleCollector  
from Data_Collection.collectors.gbp_collector import GBPCollector
from Data_Collection.monitoring.collection_monitor import CollectionMonitor
from Data_Collection.monitoring.credential_monitor import CredentialMonitor
from Data_Collection.monitoring.anomaly_detector import AnomalyDetector
from Data_Collection.utils.preflight import validate_preflight
```

### 2. `collectors/gsc_collector.py` ✏️ MEDIUM PRIORITY
**Issue**: Imports `data_cache` from Spotlight utils (line 35)
```python
from data_cache import DataCacheManager
```

**Options**:
- A) Remove caching logic (not needed for daily scheduled runs)
- B) Copy data_cache.py to `Data_Collection/utils/`

**Recommendation**: Remove caching - simplifies code, no performance impact for once-daily runs

**Other fixes needed**:
- Update config paths (lines 89, 100, 182) to use Property_Analytics paths
- Remove relative path lookups (`..`, `../..`)

### 3. `collectors/gbp_collector.py` ✏️ MEDIUM PRIORITY  
**Check needed**: May have similar path/import issues

### 4. `monitoring/alert_sender.py` ✏️ LOW PRIORITY
**Issue**: Imports from parent directories
```python
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.email_sender import EmailSender
```

**Should become**:
```python
from Data_Collection.utils.email_sender import EmailSender
```

**Note**: May need to copy `email_sender.py` to `Data_Collection/utils/`

### 5. `monitoring/credential_monitor.py` ✏️ LOW PRIORITY
**Check imports** - may reference old paths

### 6. `monitoring/anomaly_detector.py` ✏️ LOW PRIORITY
**Check imports** - may reference old paths

### 7. `utils/preflight.py` ✏️ LOW PRIORITY
**Check imports** - likely clean since it's a standalone utility

## Additional Files Needed

### Missing collectors (currently embedded in daily_master_collection.py):
These are NOT separate files yet - logic is inline in the main script:
- `collectors/ga4_collector.py` (extract from daily_master_collection.py)
- `collectors/google_ads_collector.py` (extract from daily_master_collection.py)
- `collectors/semrush_collector.py` (extract from daily_master_collection.py)
- `collectors/gtmetrix_collector.py` (extract from daily_master_collection.py)
- `collectors/psi_collector.py` (from Portfolio_Dashboard OR extract from daily script)

### Utility files to copy:
- `utils/email_sender.py` (from Property_Analytics/utils/)
- `utils/report_builder.py` (if needed by any collectors)

## Testing Checklist

Before declaring migration complete:

1. [ ] Fix imports in `daily_master_collection.py`
2. [ ] Fix imports in `gsc_collector.py` (remove data_cache)
3. [ ] Fix imports in `gbp_collector.py`
4. [ ] Copy `email_sender.py` to utils/
5. [ ] Test import in isolation:
   ```bash
   cd /Users/mark/Property_Analytics
   python3 -c "from Data_Collection.db.database_manager import DatabaseManager; print('✅')"
   ```
6. [ ] Run test collection:
   ```bash
   python3 Data_Collection/orchestration/daily_master_collection.py --test
   ```
7. [ ] Verify database writes
8. [ ] Update launchd plist to point to new script
9. [ ] Run one successful scheduled collection
10. [ ] Monitor for 1 week before archiving old code

## Spotlight Properties Report Compatibility

✅ **VERIFIED: Spotlight will work with unified system**

**Why it works**:
- Spotlight is read-only - it only queries the database
- Uses `CANONICAL_DB = "/Users/mark/Property_Analytics/data/portfolio_analytics.db"`
- No data collection logic in Spotlight anymore
- All reports query from tables populated by Data_Collection system

**Key scripts**:
- `generate_weekly_spotlight_report_from_db.py` - reads from DB
- `automated_weekly_report.py` - reads from DB  
- All exports pull from ga4_daily_metrics, ga4_traffic_sources, pagespeed_metrics, etc.

**Action required**: None! As long as Data_Collection populates the database, Spotlight reports continue working.

## Next Session Priority

**START HERE**: Fix imports in `orchestration/daily_master_collection.py`
- This is the orchestrator that ties everything together
- Once this works, individual collector fixes are easier to test
- Should take ~15 minutes
