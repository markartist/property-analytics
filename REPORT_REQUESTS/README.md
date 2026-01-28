# Report Request System

## Purpose
This directory contains JSON request files that trigger report generation when Agent loses session context. Simply tell Agent to "check for report requests" or "process pending requests" to execute queued reports.

## How It Works

1. **Create a request file** in this directory with the pattern: `request_YYYY-MM-DD_description.json`
2. **Tell Agent**: "Check for report requests" or "Process REPORT_REQUESTS"
3. **Agent will**:
   - Read all `.json` files in this directory
   - Parse the request type and parameters
   - Execute the appropriate report generator
   - Send the report via email (if requested)
   - Archive the request file to `./completed/` with timestamp

## Request File Format

### Property Assessment Report
```json
{
  "request_type": "property_assessment",
  "created": "2026-01-27T00:00:00Z",
  "created_by": "Mark Laufhutte",
  "action": "generate_and_email",
  "parameters": {
    "report_type": "executive",
    "recipients": ["mlaufhutte@venterraliving.com"],
    "properties": "current_configuration",
    "notes": "Monthly assessment for leadership review"
  }
}
```

### Custom Ad-Hoc Report
```json
{
  "request_type": "custom_adhoc",
  "created": "2026-01-27T00:00:00Z",
  "created_by": "Mark Laufhutte",
  "action": "generate_and_email",
  "parameters": {
    "title": "Traffic Analysis Q1",
    "subtitle": "Quarterly Performance Review",
    "template": "dashboard",
    "recipients": ["mlaufhutte@venterraliving.com"],
    "data_source": "/path/to/data.json",
    "notes": "Include YoY comparison"
  }
}
```

### PIB Report (if needed)
```json
{
  "request_type": "pib",
  "created": "2026-01-27T00:00:00Z",
  "created_by": "Mark Laufhutte",
  "action": "generate_and_email",
  "parameters": {
    "property_code": "monteverde",
    "date_range_days": 30,
    "recipients": ["mlaufhutte@venterraliving.com"],
    "notes": "Special request for board meeting"
  }
}
```

## Request Types

### `property_assessment`
Generates Property Assessment report for active sites.

**Actions:**
- `generate_only` - Create HTML report, no email
- `generate_and_email` - Create and send via email
- `email_existing` - Send existing report from /Users/mark/Downloads/report/

**Parameters:**
- `report_type`: `"executive"` (default), `"technical"`, `"summary"`
- `recipients`: Array of email addresses
- `properties`: `"current_configuration"` (5 sites) or `"custom"` (requires property list)
- `notes`: Optional context for Agent

### `custom_adhoc`
Generates custom report using ad-hoc builder.

**Actions:**
- `generate_only`
- `generate_and_email`

**Parameters:**
- `title`: Report title
- `subtitle`: Optional subtitle
- `template`: `"dashboard"`, `"traffic_summary"`, `"custom"`
- `data_source`: Path to JSON data file
- `recipients`: Array of email addresses
- `notes`: Requirements/context

### `pib`
Generates Property Intelligence Brief for single property.

**Actions:**
- `generate_only`
- `generate_and_email`

**Parameters:**
- `property_code`: Property code from venterra_properties_official.json
- `date_range_days`: Number of days to analyze (default: 30)
- `recipients`: Array of email addresses
- `notes`: Optional context

## File Processing

### Active Requests
Location: `/Users/mark/Property_Analytics/REPORT_REQUESTS/`
Status: Pending, waiting for Agent to process

### Completed Requests
Location: `/Users/mark/Property_Analytics/REPORT_REQUESTS/completed/`
Format: `COMPLETED_YYYY-MM-DD_HHMMSS_original_filename.json`

### Failed Requests
Location: `/Users/mark/Property_Analytics/REPORT_REQUESTS/failed/`
Format: `FAILED_YYYY-MM-DD_HHMMSS_original_filename.json`
Contains: Original request + error log

## Example Usage

### Scenario 1: Monthly Property Assessment
**You**: Create a request file for next month's property assessment
**Agent**: Creates `request_2026-02-15_monthly_assessment.json`

(Later, new session...)

**You**: Check for report requests
**Agent**: Finds request, generates report, emails it, archives to completed/

### Scenario 2: Custom Traffic Report
**You**: I need a traffic report for Q1, put it in the request queue
**Agent**: Creates custom request file with your requirements

(Next session...)

**You**: Process pending requests
**Agent**: Generates custom report per specifications

## Quick Commands for Agent

When starting fresh session, say:
- "Check for report requests"
- "Process REPORT_REQUESTS"
- "Any pending report requests?"
- "Execute report queue"

## Directory Structure
```
/Users/mark/Property_Analytics/REPORT_REQUESTS/
├── README.md (this file)
├── completed/
│   └── COMPLETED_2026-01-27_120530_request_2026-01-27_test.json
├── failed/
│   └── FAILED_2026-01-27_120545_request_2026-01-27_broken.json
└── request_2026-01-27_property_assessment.json (pending)
```

## Notes
- Request files must be valid JSON
- Use descriptive filenames with dates
- Include `notes` field for context Agent needs
- Agent will create completed/ and failed/ directories as needed
- Completed requests are archived, not deleted (for audit trail)
