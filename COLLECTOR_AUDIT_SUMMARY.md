# Data Collector Audit Summary

**Date**: December 18, 2025  
**Properties**: 91 Venterra real estate properties  
**Purpose**: Assess feasibility of daily data collection across all sources

## Test Results

### ✅ Working/Available (5 collectors) - ALL VERIFIED DEC 19, 2025

| Collector | Status | Est. Time (All Props) | Recommendation |
|-----------|--------|----------------------|----------------|
| **GA4 Analytics** | ✅ VERIFIED WORKING | 1-2 minutes | Daily collection |
| **Google Search Console** | ✅ VERIFIED WORKING | 5-8 minutes | Daily collection |
| **SEMRush** | ✅ VERIFIED WORKING | 3-8 minutes | Every 2-3 days (conserve quota) |
| **GTMetrix** | ✅ VERIFIED WORKING | 30-90 minutes | Weekly rotation (13 props/day) |
| **GBP** | ⚠️ Config exists | 3-6 minutes | Daily (if quota allows) |

### ⚠️ Needs Configuration (1 collector)

| Collector | Issue | Fix Required |
|-----------|-------|--------------|
| **PageSpeed Insights** | Rate limited (429) | Wait 24 hours + implement rate limiting |

## Detailed Findings

### 1. GA4 Analytics ✅
**Status**: VERIFIED WORKING (Dec 19, 2025)  
**Credentials**: `/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json`

**Error Message**:
```
Google Analytics Data API has not been used in project 911627664995 
before or it is disabled.
```

**Fix**: 
1. Visit: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=911627664995
2. Click "Enable"
3. Wait 2-5 minutes for propagation
4. Retry test

**Priority**: 🔴 **CRITICAL** - GA4 is primary data source

**Time to collect (once fixed)**: 1-2 minutes for all 91 properties  
**Recommendation**: Daily collection at 2 AM

---

### 2. Google Search Console ✅
**Status**: OAuth configured and working  
**OAuth Completed**: December 18, 2025

**Current State**:
- ✅ OAuth credentials: `credentials/client_secret_153417615000-s5qfdqaahvpeq2b1o9hmh7ib31epkhm3.apps.googleusercontent.com.json`
- ✅ Token saved: `Spotlight_Properties_Report/token.json`
- ✅ API access verified: 111 sites/properties accessible
- ✅ Test successful: Collected 8 days of data from Cendana District West

**Performance**:
- GSC collector successfully initialized with OAuth
- Token auto-refreshes (no manual intervention needed)
- Tested with `sc-domain:cendanalife.com`

**Priority**: 🟢 **READY** - Configured for production use

**Time to collect**: 5-8 minutes for all 91 properties  
**Recommendation**: Daily collection at 2 AM

---

### 3. PageSpeed Insights ⚠️
**Status**: Rate limited  
**Issue**: HTTP 429 (Too Many Requests)

**Current State**:
- API is public and doesn't require auth
- Hit rate limit during test (likely from previous testing)

**Fix**:
- Wait 24 hours for quota reset
- Implement rate limiting (1 request/second)
- Add delays between requests

**Priority**: 🟢 **MEDIUM** - Nice to have but slow

**Time to collect**: 10-15 minutes for all properties (mobile + desktop)  
**Recommendation**: Weekly rotation (13 properties per day)

---

### 4. SEMRush ✅
**Status**: Available  
**Configuration**: API key present in collector code

**Performance**:
- Test time: 2-5 seconds per property
- Total time: 3-8 minutes for all 91 properties
- API quota: Depends on plan (typically 10K-50K units/month)
- Monthly cost: 4K-18K API units for daily collection

**Priority**: 🟢 **MEDIUM** - Valuable but costly

**Recommendation**: 
- Collect every 2-3 days (Mon/Wed/Fri) to conserve API units
- Monitor quota usage closely
- Alternative: Weekly collection to reduce cost

---

### 5. GTMetrix ✅
**Status**: Available  
**Configuration**: API key present in collector code

**Performance**:
- Test time: 20-60 seconds per property (SLOW!)
- Total time: 30-90 minutes for all 91 properties
- API quota: Depends on plan (100-500 tests/day typical)

**Why so slow**: 
- GTMetrix runs full page load tests
- Tests are queued and processed sequentially
- Cannot parallelize

**Priority**: 🟢 **LOW** - Nice to have but too slow

**Recommendation**: 
- Weekly rotation: Test 13 properties per day
- Mon-Sun rotation covers all 91 properties weekly
- Keeps daily collection time under 15 minutes

---

### 6. Google Business Profile ✅
**Status**: Available  
**Configuration**: Credentials exist

**Performance**:
- Test time: 2-4 seconds per property
- Total time: 3-6 minutes for all 91 properties
- API quota: Subject to GBP API limits

**Priority**: 🟡 **OPTIONAL** - Depends on use case

**Data collected**: Location info, reviews, ratings, Q&A

**Recommendation**: 
- Daily collection if reviews/ratings are important
- Otherwise, weekly collection is sufficient

## Recommended Collection Schedule

### Daily Collection (2-4 AM)

**Essential (Total: ~10-15 min)**:
1. **GA4** - 1-2 minutes ⚠️ (needs API enabled)
2. ✅ **Google Search Console** - 5-8 minutes (READY)

**Optional**:
3. **GBP** - 3-6 minutes (if needed)

### Every 2-3 Days (Monday/Wednesday/Friday)

**Quota Management**:
1. ✅ **SEMRush** - 3-8 minutes

### Weekly Rotation

**Slow Collectors (13 properties per day)**:
1. **GTMetrix** - 10-15 minutes/day
2. **PageSpeed Insights** - 10-15 minutes/day (once rate limit fixed)

**Monday**: Properties 1-13  
**Tuesday**: Properties 14-26  
**Wednesday**: Properties 27-39  
**Thursday**: Properties 40-52  
**Friday**: Properties 53-65  
**Saturday**: Properties 66-78  
**Sunday**: Properties 79-91

## Implementation Priority

### Phase 1: Critical Setup ⚡ (Do First)

1. **Enable GA4 API** 
   - Visit Google Cloud Console
   - Enable Analytics Data API
   - Test with audit script
   - **ETA**: 10 minutes

2. ✅ **Set up GSC OAuth** - COMPLETED
   - OAuth flow completed Dec 18, 2025
   - Token saved and verified
   - 111 sites/properties accessible
   - Ready for daily collection

3. **Test GA4 + GSC daily collection**
   - Run both collectors
   - Verify data stored in database
   - Check execution time
   - **ETA**: 30 minutes

### Phase 2: Add SEMRush 📊 (Week 1)

4. **Configure SEMRush collector**
   - Verify API key
   - Test collection
   - Monitor API quota usage
   - Set up Mon/Wed/Fri schedule
   - **ETA**: 1 hour

### Phase 3: Performance Collectors 🐌 (Week 2)

5. **Set up GTMetrix rotation**
   - Create weekly rotation script
   - Test 13 properties
   - Add to cron
   - **ETA**: 2 hours

6. **Fix PageSpeed Insights**
   - Add rate limiting
   - Test after quota reset
   - Add to weekly rotation
   - **ETA**: 1 hour

### Phase 4: Optional 📍 (Week 3)

7. **Add GBP collector (optional)**
   - Test collection
   - Evaluate usefulness
   - Add to daily or weekly schedule
   - **ETA**: 1 hour

## Storage Estimate

### Daily Storage (all collectors)

**Per day**:
- GA4: ~50 KB (91 properties × ~550 bytes)
- GSC: ~30 KB (91 properties × ~330 bytes)
- SEMRush: ~100 KB (every 2-3 days)
- GTMetrix: ~200 KB (13 properties/day)
- PageSpeed: ~150 KB (13 properties/day)
- GBP: ~20 KB

**Total daily**: ~400-500 KB

**Monthly**: ~15 MB  
**Yearly**: ~180 MB

This is **very manageable** for SQLite database.

## API Quota Management

### Current Limits

| API | Daily Limit | Monthly Limit | Cost |
|-----|-------------|---------------|------|
| GA4 | 250K tokens | Shared | Free |
| GSC | Very high | Very high | Free |
| PageSpeed | 25K requests | 750K requests | Free |
| SEMRush | - | 10K-50K units | Paid |
| GTMetrix | 100-500 tests | Depends on plan | Paid |
| GBP | Varies | Varies | Free |

### Risk Assessment

**Low Risk** (Free + generous):
- GA4 ✅
- GSC ✅
- PageSpeed Insights ✅ (with rate limiting)
- GBP ✅

**Medium Risk** (Paid but manageable):
- SEMRush ⚠️ (collect every 2-3 days)

**Medium Risk** (Free but slow):
- GTMetrix ⚠️ (weekly rotation)

## Next Steps

1. **Immediate** (Next 30 minutes):
   - [ ] Enable GA4 API in Google Cloud Console
   - [ ] Test GA4 collector again
   - [ ] Set up GSC OAuth

2. **This Week**:
   - [ ] Create unified daily collection script
   - [ ] Store data in Portfolio Monitoring database
   - [ ] Set up cron job for 2 AM daily collection
   - [ ] Add SEMRush on Mon/Wed/Fri schedule

3. **Next Week**:
   - [ ] Implement GTMetrix weekly rotation
   - [ ] Fix and test PageSpeed Insights
   - [ ] Add both to weekly rotation schedule

4. **Optional**:
   - [ ] Evaluate GBP usefulness
   - [ ] Add if needed

## Testing

To re-run the audit after fixes:

```bash
cd ~/Property_Analytics
python3 test_all_collectors.py
```

Results saved to: `collector_audit_results.json`

## Database Integration

All collected data should be stored in:
```
~/Property_Analytics/Portfolio_Monitoring/data/portfolio_monitoring.db
```

Using existing schema:
- `ga4_daily_metrics` - GA4 traffic data
- `gsc_daily_metrics` - Search Console data
- `gtmetrix_metrics` - Performance tests
- `pagespeed_metrics` - PageSpeed scores
- `semrush_domain_metrics` - SEO rankings

See `Portfolio_Monitoring/docs/DATABASE_QUICKSTART.md` for details.

## Summary

**Current State**:
- 4 collectors available/working
- 2 need quick configuration (GA4 API, GSC OAuth)
- 1 needs rate limiting fix (PageSpeed)

**Time Investment**:
- Setup: ~2 hours (mostly OAuth and testing)
- Daily maintenance: 10-15 minutes automated
- Weekly maintenance: None

**Benefits**:
- Comprehensive daily data for all 91 properties
- Historical trends in database
- Automated monitoring and alerting
- Foundation for advanced analytics

**Recommendation**:
✅ **Proceed with daily collection**

Start with GA4 + GSC (essential data, fast collection), then add others incrementally. The lift is manageable and the value is high.
