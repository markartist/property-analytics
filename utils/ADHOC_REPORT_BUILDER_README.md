# Ad-Hoc Report Builder - Documentation

**Version:** 1.0.0  
**Date:** 2026-01-26  
**Author:** Mark Laufhutte

## Overview

The Ad-Hoc Report Builder provides a flexible framework for creating custom HTML reports using the Property Intelligence Brief (PIB) v1.9 styling system. It allows you to generate professional, email-safe reports on-the-fly without modifying core PIB code.

## Key Features

- ✅ **PIB v1.9 Styling** - Uses exact visual styling from PIB v1.9
- ✅ **Email-Safe HTML** - Table-based layouts with inline styles (Outlook compatible)
- ✅ **Reusable Components** - KPI tiles, sections, data tables, side-by-side layouts
- ✅ **Flexible Input** - Python API or JSON data files
- ✅ **CLI Tool** - Command-line generation for quick reports
- ✅ **Example Templates** - Pre-built examples to get started

## Architecture

```
utils/
├── report_builder.py         # Core library (classes and components)
├── generate_adhoc_report.py  # CLI tool
└── ADHOC_REPORT_BUILDER_README.md  # This file
```

## Quick Start

### 1. Generate Example Reports

```bash
# Traffic summary with KPI tiles and table
python3 utils/generate_adhoc_report.py --example traffic_summary --output traffic.html

# Property comparison with grades
python3 utils/generate_adhoc_report.py --example comparison --output comparison.html

# Executive dashboard
python3 utils/generate_adhoc_report.py --example dashboard --output dashboard.html
```

### 2. Python API

```python
from utils.report_builder import ReportBuilder, KPITile, Section

# Create report
builder = ReportBuilder(
    title="Custom Analysis",
    subtitle="Performance Report",
    version="1.0.0",
    date_range="01/19/2026 to 01/26/2026"
)

# Add KPI tiles
builder.add_kpi_tiles([
    KPITile(
        label="Total Sessions",
        value="12,456",
        trend="+15%",
        is_primary=True
    ),
    KPITile(
        label="Conversion Rate",
        value="3.2%",
        comparison="Portfolio avg: 2.8%",
        percentile="72nd percentile"
    )
], columns=2)

# Add section with content
builder.add_section(Section(
    title="Analysis",
    status="healthy",  # healthy, watch, action_needed
    description="Detailed metrics and trends",
    content="<p>Your custom HTML content here</p>"
))

# Generate HTML
html = builder.generate()

# Or save to file
builder.save("report.html")
```

### 3. JSON Data File

Create a JSON file with your data:

```json
{
  "title": "Weekly Report",
  "subtitle": "Performance Analysis",
  "version": "1.0.0",
  "date_range": "01/19/2026 to 01/26/2026",
  "kpi_tiles": [
    {
      "label": "Sessions",
      "value": "12,456",
      "trend": "+15%",
      "is_primary": true
    },
    {
      "label": "CIR",
      "value": "3.2%",
      "comparison": "Target: 3.0%"
    }
  ],
  "kpi_columns": 2,
  "sections": [
    {
      "title": "Traffic Analysis",
      "status": "healthy",
      "description": "Week-over-week traffic trends",
      "content": "<p>Your HTML content here</p>"
    }
  ]
}
```

Then generate:

```bash
python3 utils/generate_adhoc_report.py --data myreport.json --output report.html
```

## Components

### KPITile

Display key metrics in styled tiles.

**Parameters:**
- `label` (str) - Tile label (e.g., "Total Sessions")
- `value` (str) - Main value to display
- `sublabel` (str, optional) - Small text below value
- `trend` (str, optional) - Trend indicator (e.g., "+15%")
- `comparison` (str, optional) - Comparison text (e.g., "vs avg: 10,000")
- `percentile` (str, optional) - Percentile ranking
- `is_primary` (bool) - Blue border for primary metric
- `grade` (str, optional) - Letter grade (A+, B, C, etc.)
- `grade_label` (str, optional) - Grade description (Excellent, Good, etc.)

**Example:**
```python
KPITile(
    label="Local Discovery",
    grade="A+",
    grade_label="Excellent",
    is_primary=True
)
```

### Section

Report section with header and status tag.

**Parameters:**
- `title` (str) - Section title
- `content` (str) - HTML content
- `status` (str) - "healthy", "watch", or "action_needed"
- `description` (str, optional) - Subtitle description

**Example:**
```python
Section(
    title="Traffic Sources",
    status="healthy",
    description="Channel-level breakdown",
    content="<p>Custom content</p>"
)
```

### Helper Functions

#### create_side_by_side_layout()

Create two-column layout (like Mobile/Desktop in PIB).

```python
from utils.report_builder import create_side_by_side_layout

left = "<div>Left content</div>"
right = "<div>Right content</div>"

html = create_side_by_side_layout(left, right, gap_pct=4)
```

#### create_data_table()

Create styled data table.

```python
from utils.report_builder import create_data_table

table = create_data_table(
    headers=["Source", "Sessions", "Change"],
    rows=[
        ["Organic", "5,234", "+18%"],
        ["Direct", "3,456", "+12%"]
    ]
)
```

#### create_metric_card()

Create single metric display with emoji and goal.

```python
from utils.report_builder import create_metric_card

card = create_metric_card(
    label="LCP",
    value="2.4s",
    emoji="🟢",
    goal="<2.5s"
)
```

## Status Tags

Sections can have one of three status levels:

- **Healthy** (Green) - Metrics within expected ranges
- **Watch** (Yellow) - Metrics show noteworthy variance
- **Action Needed** (Red) - Metrics indicate issues requiring attention

## Color Scheme

Follows PIB v1.9 color palette:

- **Venterra Blue:** `#0066cc` (primary)
- **Navy:** `#15284B` (section headers)
- **Success:** `#28a745` (green)
- **Warning:** `#ffc107` (yellow)
- **Danger:** `#dc3545` (red)
- **Gray shades:** `#6c757d`, `#868e96`, `#adb5bd`, `#e9ecef`, `#f8f9fa`

## Best Practices

### Email Compatibility

✅ **DO:**
- Use table-based layouts
- Use inline styles only
- Keep max width to 720px
- Test in Gmail, Outlook, Apple Mail

❌ **DON'T:**
- Use flexbox or CSS grid
- Use `<style>` tags
- Use JavaScript
- Use external images (use data URIs)

### Report Structure

1. **Header** - Title, version, date range
2. **KPI Tiles** - Top metrics (2-4 tiles recommended)
3. **Sections** - Detailed analysis with status tags
4. **Keep it concise** - Executive-friendly length

### Data Display

- Use commas for large numbers: `12,456`
- Include trend indicators: `+15%`
- Provide context: "vs prior week: 10,811"
- Show percentiles when relevant: "72nd percentile"

## Examples

### Example 1: Simple KPI Report

```python
builder = ReportBuilder(title="Weekly Metrics")
builder.add_kpi_tiles([
    KPITile(label="Sessions", value="10,234", trend="+8%"),
    KPITile(label="CIR", value="2.9%", trend="+0.3%")
], columns=2)
html = builder.generate()
```

### Example 2: Multi-Section Report

```python
from utils.report_builder import (
    ReportBuilder, KPITile, Section, create_data_table
)

builder = ReportBuilder(title="Property Analysis")

# KPI tiles
builder.add_kpi_tiles([
    KPITile(label="Traffic", value="12K", is_primary=True),
    KPITile(label="Position", value="18.4")
], columns=2)

# Traffic section
traffic_table = create_data_table(
    headers=["Channel", "Sessions"],
    rows=[["Organic", "5,234"], ["Direct", "3,456"]]
)

builder.add_section(Section(
    title="Traffic Breakdown",
    status="healthy",
    content=traffic_table
))

# Performance section
builder.add_section(Section(
    title="Site Performance",
    status="watch",
    description="PageSpeed scores need improvement",
    content="<p>Mobile: 62 | Desktop: 87</p>"
))

html = builder.generate()
```

### Example 3: Comparison Report

```python
from utils.report_builder import create_side_by_side_layout

left = '''
    <h3 style="text-align: center;">Property A</h3>
    <p>Sessions: 12,456</p>
    <p>CIR: 4.2%</p>
'''

right = '''
    <h3 style="text-align: center;">Property B</h3>
    <p>Sessions: 8,234</p>
    <p>CIR: 2.8%</p>
'''

comparison = create_side_by_side_layout(left, right)

builder = ReportBuilder(title="Property Comparison")
builder.add_section(Section(
    title="Side-by-Side",
    status="healthy",
    content=comparison
))
```

## Integration with Existing Systems

### Use with Database

```python
import sqlite3
from utils.report_builder import ReportBuilder, KPITile

# Query database
conn = sqlite3.connect('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
cursor = conn.execute("SELECT SUM(sessions) FROM ga4_daily_metrics WHERE metric_date >= date('now', '-7 days')")
total_sessions = cursor.fetchone()[0]

# Build report
builder = ReportBuilder(title="Database Report")
builder.add_kpi_tiles([
    KPITile(label="7-Day Sessions", value=f"{total_sessions:,}")
])

html = builder.generate()
```

### Email Delivery

Use existing email sender utility:

```python
from utils.email_sender import EmailSender

# Generate report
builder = ReportBuilder(title="Weekly Report")
# ... add content ...
builder.save("report.html")

# Send via email
sender = EmailSender()
sender.send_email(
    to_emails=["recipient@example.com"],
    subject="Weekly Report",
    html_file="report.html"
)
```

## Troubleshooting

### Report not rendering in Outlook

- Ensure all styles are inline (no `<style>` tags)
- Use tables for layout, not divs with flexbox
- Keep max-width to 720px

### KPI tiles not aligning

- Check column count matches number of tiles
- Use gap of 2% between tiles (default)
- Verify total width calculation: `(100 - gap * (cols-1)) / cols`

### Custom HTML not displaying

- Wrap content in proper table structure
- Use inline styles for all formatting
- Test HTML in isolation first

## Version History

### v1.0.0 (2026-01-26)
- Initial release
- Core ReportBuilder class
- KPITile, Section components
- Helper functions (tables, side-by-side, metric cards)
- CLI tool with example templates
- JSON data file support

## Future Enhancements

- [ ] Chart/graph components (static images)
- [ ] More pre-built templates
- [ ] PDF export support
- [ ] Batch report generation
- [ ] Template inheritance/extension

## Support

For questions or issues with the ad-hoc report builder:

**System Owner:** Mark Laufhutte  
**Email:** mlaufhutte@venterraliving.com  
**Location:** `/Users/mark/Property_Analytics/utils/`

## Related Documentation

- PIB v1.9 Technical Documentation: `Property_Intelligence_Brief/docs/PIB_v1.9.0_Technical_Documentation.md`
- PIB v1.8 Locked Standard: `Property_Intelligence_Brief/docs/PIB_v1.8.0_LOCKED_STANDARD.md`
- System Architecture: `SYSTEM_ARCHITECTURE_MEMORY.md`
