# Portfolio Core Web Vitals Snapshot Report

## Overview
The Portfolio Core Web Vitals Snapshot is a comprehensive performance monitoring report that provides a complete ranking of all 91 properties in the Venterra portfolio, sorted by mobile performance score. The report includes detailed Core Web Vitals metrics, Lighthouse scores, and month-over-month trend indicators.

**Created:** January 27, 2026  
**Version:** 1.0  
**Author:** Mark Laufhutte

---

## Report Components

### 1. HTML Email Report
- **Location:** `reports/cwv_snapshot/Portfolio_CWV_Snapshot_YYYY-MM-DD.html`
- **Delivery:** Email with inline HTML
- **Recipients:** mlaufhutte@venterraliving.com (configurable)
- **Schedule:** On-demand (can be automated via cron/launchd)

### 2. Excel Export
- **Location:** `reports/cwv_snapshot/Portfolio_CWV_Snapshot_YYYY-MM-DD.xlsx`
- **Delivery:** Email attachment
- **Format:** Single worksheet with color-coded grades and trend indicators

---

## Report Sections

### A. Portfolio KPI Tiles (Top Section)
Three key performance indicators showing portfolio-wide averages:

1. **Mobile Performance** (Primary - Blue Border)
   - Average mobile performance score across all properties
   - Sublabel: Performance grade (GOOD/NEEDS IMPROVEMENT/POOR)
   - Trend: MoM change with arrow (↑/↓) and delta value
   - Color: Green for improvement, Red for decline

2. **Avg LCP (Largest Contentful Paint)**
   - Average LCP time in seconds
   - Sublabel: Performance grade based on Core Web Vitals thresholds
   - Trend: MoM change (↓ arrow = green = improvement, since lower is better)
   - Thresholds: ≤2.5s = Good, ≤4.0s = Needs Improvement, >4.0s = Poor

3. **Avg CLS (Cumulative Layout Shift)**
   - Average CLS score (dimensionless)
   - Sublabel: Performance grade based on Core Web Vitals thresholds
   - Trend: MoM change (↓ arrow = green = improvement, since lower is better)
   - Thresholds: ≤0.1 = Good, ≤0.25 = Needs Improvement, >0.25 = Poor

### B. Portfolio Overview
Distribution of properties by performance grade:
- **Poor (<50):** Red background, count of properties
- **Needs Improvement (50-89):** Orange background (#ff8800), count of properties
- **Good (90+):** Green background, count of properties

### C. Complete Property Performance Ranking
All properties listed in descending order by mobile performance score.

**Each property card displays:**

**Left Side - Detailed Metrics:**
- **Row 1:** Mobile Score | Desktop Score | Accessibility (A11y) | Best Practices (BP)
- **Row 2:** LCP (with trend) | CLS | FID | FCP
- **Row 3:** TTFB | Speed Index (SI) | TTI | TBT

**Right Side - Summary Scores:**
- **Large Score (32px):** Mobile performance score in orange (#ff8800 for 50-89)
- **Mobile Trend:** Arrow with delta from previous collection
- **Medium Score (20px):** Desktop performance score
- **Desktop Trend:** Arrow with delta from previous collection

**Visual Elements:**
- Left border color indicates performance grade (green/orange/red)
- All metrics color-coded by performance thresholds
- Trend indicators show directional arrows with values

### D. Data Integrity Footer
Confirms data quality and collection status:
- Data Collection Date
- Properties in Report
- Data Source (PageSpeed Insights API)
- Metrics Included

---

## Excel Export Details

### Columns (in order):
1. **Rank** - Position in mobile performance ranking
2. **Property Name** - Canonical property name
3. **Grade** - GOOD/NEEDS IMPROVEMENT/POOR (color-coded)
4. **Mobile Score** - Mobile performance score
5. **Mobile Change** - MoM trend (color-coded: green=improvement, red=decline)
6. **Desktop Score** - Desktop performance score
7. **Desktop Change** - MoM trend (color-coded)
8. **Accessibility** - Accessibility score
9. **Best Practices** - Best Practices score
10. **SEO** - SEO score
11. **LCP (s)** - Largest Contentful Paint in seconds
12. **LCP Change (s)** - MoM LCP trend (color-coded: green=decrease, red=increase)
13. **LCP Score** - Normalized LCP score
14. **CLS** - Cumulative Layout Shift
15. **CLS Score** - Normalized CLS score
16. **FID (ms)** - First Input Delay in milliseconds
17. **FID Score** - Normalized FID score
18. **FCP (s)** - First Contentful Paint in seconds
19. **TTFB (ms)** - Time to First Byte in milliseconds
20. **Speed Index (s)** - Speed Index in seconds
21. **TTI (s)** - Time to Interactive in seconds
22. **TBT (ms)** - Total Blocking Time in milliseconds

### Formatting:
- Header row frozen for scrolling
- Color-coded grade column (green/yellow/red backgrounds)
- Trend indicators with directional colors
- Optimized column widths for readability

---

## Data Sources

### Primary Table: `pagespeed_metrics`
- **Database:** `data/portfolio_analytics.db`
- **Collection:** Daily via PageSpeed Insights API
- **Strategy:** Mobile and Desktop
- **Metrics:** Performance, Accessibility, Best Practices, SEO, Core Web Vitals

### Trend Calculation:
- **Current Date:** Latest collection date (e.g., 2026-01-27)
- **Previous Date:** Most recent date before current (e.g., 2026-01-25)
- **Logic:** Current value - Previous value = Delta
- **Display:** Only shown if previous data exists and delta ≠ 0

---

## Color Scheme

### Performance Scores (Lighthouse):
- **90-100:** Green (#28a745) - "GOOD"
- **50-89:** Orange (#ff8800) - "NEEDS IMPROVEMENT"
- **0-49:** Red (#dc3545) - "POOR"

### Core Web Vitals:

**LCP (Largest Contentful Paint):**
- **≤2.5s:** Green (#28a745)
- **2.5-4.0s:** Yellow (#ffc107)
- **>4.0s:** Red (#dc3545)

**CLS (Cumulative Layout Shift):**
- **≤0.1:** Green (#28a745)
- **0.1-0.25:** Yellow (#ffc107)
- **>0.25:** Red (#dc3545)

**FID (First Input Delay):**
- **≤100ms:** Green (#28a745)
- **100-300ms:** Yellow (#ffc107)
- **>300ms:** Red (#dc3545)

**FCP (First Contentful Paint):**
- **≤1.8s:** Green (#28a745)
- **1.8-3.0s:** Yellow (#ffc107)
- **>3.0s:** Red (#dc3545)

**TTFB (Time to First Byte):**
- **≤800ms:** Green (#28a745)
- **800-1800ms:** Yellow (#ffc107)
- **>1800ms:** Red (#dc3545)

**Speed Index:**
- **≤3.4s:** Green (#28a745)
- **3.4-5.8s:** Yellow (#ffc107)
- **>5.8s:** Red (#dc3545)

**TTI (Time to Interactive):**
- **≤3.8s:** Green (#28a745)
- **3.8-7.3s:** Yellow (#ffc107)
- **>7.3s:** Red (#dc3545)

**TBT (Total Blocking Time):**
- **≤200ms:** Green (#28a745)
- **200-600ms:** Yellow (#ffc107)
- **>600ms:** Red (#dc3545)

### Trend Indicators:
- **Green (#28a745):** Improvement
  - For scores: ↑ (increase)
  - For times/metrics: ↓ (decrease - faster/better)
- **Red (#dc3545):** Decline
  - For scores: ↓ (decrease)
  - For times/metrics: ↑ (increase - slower/worse)

---

## Scripts

### Generation Script
**File:** `generate_cwv_snapshot.py`

**Key Functions:**
- `_get_data()`: Queries database for current and previous date metrics
- `_generate_overview()`: Creates portfolio distribution tiles
- `_generate_property_list()`: Creates ranked property cards with metrics
- `_generate_data_integrity_section()`: Creates data quality footer
- `_generate_excel()`: Creates formatted Excel export
- `generate()`: Orchestrates full report generation

**Usage:**
```bash
python3 generate_cwv_snapshot.py
```

**Output:**
```
Portfolio_CWV_Snapshot_2026-01-27.html
Portfolio_CWV_Snapshot_2026-01-27.xlsx
```

### Email Sender Script
**File:** `send_cwv_snapshot_email.py`

**Configuration:**
- Uses `utils/email_config.py` for SMTP settings
- Gmail SMTP: smtp.gmail.com:587
- From: marklaufhutte@gmail.com
- Default recipient: mlaufhutte@venterraliving.com

**Usage:**
```bash
python3 send_cwv_snapshot_email.py
```

**Email Components:**
- Subject: "Portfolio Core Web Vitals Snapshot - YYYY-MM-DD"
- Body: Inline HTML report
- Attachment: Excel file

---

## Development History & Changes

### Version 1.0 - January 27, 2026

#### Initial Requirements:
- Complete property listing sorted by mobile performance score
- Full detail metrics for each property (like existing reports)
- Excel export as email attachment
- Data integrity checks at bottom

#### Iterations & Improvements:

**1. Basic Structure (Initial Build)**
- Created complete property listing
- Sorted by mobile performance score (descending)
- Added all Core Web Vitals and Lighthouse scores
- Included data integrity footer

**2. Excel Export Enhancement**
- Added Excel generation with formatting
- Color-coded grades (green/yellow/red backgrounds)
- Included all metrics and scores
- Optimized column widths

**3. Metric Selection Refinement**
- **Removed:** SEO from property cards (kept in Excel)
  - Reason: Needed clean layout with 4 items per row
- **Removed:** PWA column from Excel
  - Reason: No data collected (all NULL values in database)

**4. Visual Score Display**
- Added large mobile score (32px) on right side of property cards
- Added smaller desktop score (20px) below mobile
- Request: Both mobile and desktop scores with progress stats

**5. KPI Tiles Addition**
- Added 3 portfolio-wide KPI tiles at top
- **Metrics chosen:** Mobile Performance, Avg LCP, Avg CLS
  - Rationale: Most important performance indicators
- Mobile Performance tile: Primary with blue border
- All tiles show portfolio-wide averages

**6. Status Badge Removal**
- Removed "Healthy/Watch/Action Needed" pills from section headers
- Created custom `SectionNoStatus` class
- Reason: Status indicators were distracting

**7. Color Standardization - Orange (#ff8800)**
- **Issue:** Yellow color for 50-89 scores was too light (#ffc107)
- **Fix:** Changed to darker orange (#ff8800) throughout:
  - `score_color()` function (line 239)
  - `_get_score_badge()` method (line 163)
  - Overview distribution tile (line 195)
  - Property card border colors (line 288)
  - KPI tile LCP/CLS threshold colors (lines 510, 521)
- **Result:** Consistent darker orange matching reference screenshot

**8. MoM Trend Indicators - Major Addition**
- **Issue:** Trend indicators not displaying despite code being in place
- **Root Cause:** `KPITile.to_html()` method accepted `trend` parameter but never rendered it
- **Fix:**
  - Added trend rendering in `utils/report_builder.py` (lines 148-151)
  - Added `trend_inverse` parameter for "lower is better" metrics
  - Implemented color logic:
    - Normal metrics (scores): ↑ = green, ↓ = red
    - Inverse metrics (LCP, CLS): ↓ = green, ↑ = red
  - Set `trend_inverse=True` for LCP and CLS tiles
- **Result:** All 3 KPI tiles now show MoM trends with correct colors

**9. Property Card Trend Indicators**
- Added mobile and desktop score trends to property cards
- Format: Arrow (↑/↓) + numeric delta
- Color: Green for improvement, red for decline
- Position: Below respective score numbers

**10. Excel Trend Indicators**
- Mobile Change column with color coding
- Desktop Change column with color coding
- LCP Change column with inverse color coding (↓ = green)

---

## Key Design Decisions

### 1. Mobile-First Ranking
**Decision:** Sort by mobile performance score, not desktop  
**Rationale:** Mobile traffic is primary for property websites; Google uses mobile-first indexing

### 2. Comprehensive Metrics
**Decision:** Include all Core Web Vitals + additional timing metrics  
**Rationale:** Provides complete performance picture for technical analysis

### 3. Trend Comparison Period
**Decision:** Compare to most recent previous date (typically 2 days ago)  
**Rationale:** Provides meaningful short-term trend; accommodates 3-day outage scenario

### 4. Color Coding Philosophy
**Decision:** Green = Good, Orange = Caution, Red = Action Needed  
**Rationale:** Universal color language; matches Google's Core Web Vitals grading

### 5. Excel + HTML Dual Format
**Decision:** Provide both formatted email and spreadsheet export  
**Rationale:** Email for quick review, Excel for detailed analysis and sharing

### 6. No Status Pills on Sections
**Decision:** Remove "Healthy/Watch/Action Needed" badges  
**Rationale:** Reduced visual clutter; performance status is clear from scores and colors

### 7. PWA Exclusion
**Decision:** Remove PWA column entirely  
**Rationale:** No data collected; column showed "N/A" for all properties

### 8. Inverse Trend Logic
**Decision:** Implement `trend_inverse` parameter for time-based metrics  
**Rationale:** Lower times (LCP, CLS, FCP, etc.) = better performance; visual indicators should reflect this

---

## Performance Thresholds Reference

All thresholds based on Google Core Web Vitals and Lighthouse scoring:

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| Performance Score | 90-100 | 50-89 | 0-49 |
| LCP | ≤2.5s | 2.5-4.0s | >4.0s |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |
| FID | ≤100ms | 100-300ms | >300ms |
| FCP | ≤1.8s | 1.8-3.0s | >3.0s |
| TTFB | ≤800ms | 800-1800ms | >1800ms |
| Speed Index | ≤3.4s | 3.4-5.8s | >5.8s |
| TTI | ≤3.8s | 3.8-7.3s | >7.3s |
| TBT | ≤200ms | 200-600ms | >600ms |

---

## Database Schema

### pagespeed_metrics Table
```sql
CREATE TABLE pagespeed_metrics (
    id INTEGER PRIMARY KEY,
    property_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    collection_id INTEGER,
    strategy TEXT NOT NULL,  -- 'mobile' or 'desktop'
    performance_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    seo_score INTEGER,
    pwa_score INTEGER,  -- Note: Currently NULL for all records
    lcp_value REAL,
    lcp_score REAL,
    fid_value REAL,
    fid_score REAL,
    cls_value REAL,
    cls_score REAL,
    fcp_value REAL,
    ttfb_value REAL,
    speed_index REAL,
    time_to_interactive REAL,
    total_blocking_time REAL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Query Pattern for Report
```sql
-- Current data
SELECT * FROM pagespeed_metrics 
WHERE metric_date = '2026-01-27' 
  AND strategy = 'mobile';

-- Previous data for trends
SELECT * FROM pagespeed_metrics 
WHERE metric_date = (
    SELECT MAX(metric_date) 
    FROM pagespeed_metrics 
    WHERE metric_date < '2026-01-27'
) 
AND strategy = 'mobile';
```

---

## Future Enhancement Opportunities

### Potential Additions:
1. **Week-over-Week Trends:** Add 7-day comparison option
2. **Property Grouping:** Segment by location, property type, or manager
3. **Threshold Alerts:** Highlight properties below critical thresholds
4. **Historical Charts:** Add sparklines showing trend over time
5. **Competitive Benchmarking:** Compare against industry averages
6. **Automated Scheduling:** Set up launchd/cron for regular delivery
7. **Custom Recipients:** Allow per-report recipient configuration
8. **PDF Export:** Add PDF generation option alongside Excel
9. **Mobile Responsiveness:** Optimize HTML email for mobile viewing
10. **Desktop Strategy Report:** Create parallel report for desktop metrics

### Known Limitations:
1. PWA scores not currently collected by API
2. Trend calculation requires at least 2 collection dates
3. Large property count (91) creates long email - consider pagination option
4. Excel file size grows with property count - may need compression
5. Email HTML may be clipped by some email clients (Gmail's 102KB limit)

---

## Maintenance Notes

### Regular Updates Required:
- **Color thresholds:** Update if Google changes Core Web Vitals standards
- **Metrics:** Add new Lighthouse metrics as they're introduced
- **Email recipients:** Update in email configuration as team changes
- **Column widths:** Adjust Excel column widths if metric names change

### Monitoring:
- Verify data collection runs daily (5:00 AM via launchd)
- Check for missing dates in pagespeed_metrics table
- Monitor email delivery success
- Validate Excel file integrity after generation

### Troubleshooting:
- **Missing trends:** Verify previous date data exists
- **Color issues:** Check hex codes in score_color() and border_color logic
- **Excel errors:** Validate column references match data structure
- **Email delivery fails:** Check SMTP credentials and network connectivity

---

## Contact & Support

**Report Owner:** Mark Laufhutte (mlaufhutte@venterraliving.com)  
**System:** Property Analytics Platform  
**Repository:** `/Users/mark/Property_Analytics/`  
**Report Location:** `reports/cwv_snapshot/`

---

*Last Updated: January 27, 2026*
