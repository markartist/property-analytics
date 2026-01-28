# Agent Quick Start: Report Request System

## When User Says...
- "Check for report requests"
- "Process REPORT_REQUESTS"
- "Any pending report requests?"
- "Execute report queue"

## What To Do

### Step 1: Run Processor
```bash
cd /Users/mark/Property_Analytics
python3 process_report_requests.py
```

### Step 2: Review Output
The processor will:
- ✅ Find pending `.json` request files in `REPORT_REQUESTS/`
- ✅ Execute the appropriate report generator
- ✅ Send email if `action: "generate_and_email"`
- ✅ Archive completed requests to `REPORT_REQUESTS/completed/`
- ❌ Archive failed requests to `REPORT_REQUESTS/failed/` with error log

### Step 3: Report Results to User
Example:
```
Found 1 pending request:
  • request_2026-01-27_property_assessment.json

✅ Property Assessment report generated and emailed to mlaufhutte@venterraliving.com
Request archived to: COMPLETED_2026-01-27_120530_request_2026-01-27_property_assessment.json
```

---

## Common Request Types

### Property Assessment (Most Common)
**File:** `request_YYYY-MM-DD_property_assessment.json`
**Executes:** `generate_executive_assessment.py` + `send_property_assessment.py`
**Output:** `/Users/mark/Downloads/report/Property_Assessment_Executive.html`
**Email To:** mlaufhutte@venterraliving.com

### Custom Ad-Hoc Report
**File:** `request_YYYY-MM-DD_custom_description.json`
**Executes:** Custom report using `utils/report_builder.py`
**Note:** May require manual implementation depending on complexity

---

## Dry Run Mode (For Testing)
```bash
python3 process_report_requests.py --dry-run
```

Shows what would be executed without actually doing it.

---

## Troubleshooting

### No Pending Requests Found
Expected output:
```
✓ No pending requests found
  Location checked: /Users/mark/Property_Analytics/REPORT_REQUESTS
```

This is normal - tell user there are no pending requests.

### Request Failed
Check `REPORT_REQUESTS/failed/` directory for error details.
Failed requests include `_processing_error` field with details.

### Request Requires Manual Implementation
Some requests (custom ad-hoc, PIB integration) may need manual work.
Processor will note this and NOT archive the request.
Work with user to implement, then re-run processor.

---

## Documentation References

**Full System Docs:** `/Users/mark/Property_Analytics/REPORT_REQUESTS/README.md`

**Property Assessment Details:** `/Users/mark/Property_Analytics/PROPERTY_ASSESSMENT_REPORTS.md`

**Ad-Hoc Builder API:** `/Users/mark/Property_Analytics/utils/ADHOC_REPORT_BUILDER_README.md`

**Main System:** `/Users/mark/Property_Analytics/README.md`

---

## Quick Context Check

If user mentions reports but you have no session context:
1. Ask: "Should I check for report requests?"
2. If yes, run: `python3 process_report_requests.py`
3. If none found, read: `PROPERTY_ASSESSMENT_REPORTS.md` for current report details

---

## Creating New Requests (If User Asks)

Template location: `REPORT_REQUESTS/request_EXAMPLE_property_assessment.json.template`

Create new request:
```bash
# Copy template
cp REPORT_REQUESTS/request_EXAMPLE_property_assessment.json.template \
   REPORT_REQUESTS/request_2026-MM-DD_description.json

# Edit with user's requirements
# Ensure valid JSON
# Include descriptive filename with date
```

User can then say "check for report requests" in next session.
