# Fix GA4 API Access

## The Issue

The service account credentials are for project **`authentic-reach-474618-r6`**, but the API was enabled in project **`911627664995`**.

## Service Account Details

- **Project ID**: `authentic-reach-474618-r6`
- **Service Account**: `venterraanalytics@authentic-reach-474618-r6.iam.gserviceaccount.com`
- **Credentials File**: `credentials/authentic-reach-474618-r6-16e824bab2c3.json`

## Solution

Enable the Google Analytics Data API in the **correct project**:

### Option 1: Enable API in Service Account Project (Recommended)

1. Visit: https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=authentic-reach-474618-r6

2. Click **"ENABLE"**

3. Wait 2-5 minutes for propagation

4. Test again:
   ```bash
   cd ~/Property_Analytics
   python3 test_all_collectors.py
   ```

### Option 2: Use Different Credentials

If you don't have access to project `authentic-reach-474618-r6`, you'll need to:

1. Create a new service account in project `911627664995`
2. Grant it access to GA4 properties
3. Download new credentials
4. Replace the credentials file

## Quick Test

After enabling the API, test with:

```bash
cd ~/Property_Analytics
python3 -c "
from test_all_collectors import test_ga4_collector
result = test_ga4_collector()
if result.get('status') == 'working':
    print('✅ GA4 is working!')
    print(f\"Response time: {result.get('response_time')}\")
    print(f\"Estimated time for 91 properties: {result.get('estimated_time_all')}\")
else:
    print('❌ Still not working')
    print(f\"Error: {result.get('message', '')[:200]}\")
"
```

## Verify Project Access

To check which project you're currently in:

```bash
gcloud config get-value project
```

To switch projects:

```bash
gcloud config set project authentic-reach-474618-r6
```

## Next Steps After Fix

Once GA4 is working:

1. ✅ Test GA4 collector
2. ⏭️ Set up GSC OAuth
3. ⏭️ Create unified daily collection script
4. ⏭️ Set up cron job

## Summary

**Action needed**: Enable Google Analytics Data API in project **`authentic-reach-474618-r6`** (not `911627664995`)

**URL**: https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=authentic-reach-474618-r6
