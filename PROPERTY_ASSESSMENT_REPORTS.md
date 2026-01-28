# Property Assessment Report System

## Overview
Ad-hoc report generator for property performance assessments using PIB v1.9 styling. Built to analyze active websites with Core Web Vitals, SEO metadata, and schema assessments.

## Recent Issue Resolution: Logo Rendering
**Problem**: Venterra logo displayed incorrectly in ad-hoc reports despite using same base64 encoding as PIB reports.

**Root Cause**: The `VENTERRA_LOGO_BASE64` constant in `/Users/mark/Property_Analytics/utils/report_builder.py` (line 43) contained 7 character typos scattered throughout the 10,724-character base64 string at positions: 1626, 2978, 2982, 4622, 6194, 6195, 6196, and 7070.

**Resolution**: Extracted correct base64 string from working PIB report and replaced entire constant. Logo now renders correctly.

**Date Fixed**: 2026-01-27

---

## Key Files

### Core Framework
- `/Users/mark/Property_Analytics/utils/report_builder.py` (421 lines)
  - Core library: `ReportBuilder`, `KPITile`, `Section` classes
  - Contains `VENTERRA_LOGO_BASE64` constant (line 43) - **verified correct as of 2026-01-27**
  - Helper functions for email-safe HTML generation

- `/Users/mark/Property_Analytics/utils/generate_adhoc_report.py` (337 lines)
  - CLI tool with example templates
  - Usage documentation and patterns

- `/Users/mark/Property_Analytics/utils/ADHOC_REPORT_BUILDER_README.md` (442 lines)
  - Complete framework documentation
  - API reference and examples

### Property Assessment Report (Active Sites)
- `/Users/mark/Property_Analytics/generate_executive_assessment.py`
  - **Current production report generator**
  - Generates executive-ready property performance assessments
  - Includes: Executive Summary, Priority Matrix, Timeline Guidance, Recommended Action
  - Language: Conservative, outcome-focused, appropriate for leadership

- `/Users/mark/Property_Analytics/send_property_assessment.py`
  - Email sender for Property Assessment reports
  - Uses `/Users/mark/Property_Analytics/utils/email_sender.py`
  - Default recipient: mlaufhutte@venterraliving.com
  - Subject: "Property Assessment - Performance & Technical SEO Analysis"

### Output Location
- `/Users/mark/Downloads/report/Property_Assessment_Executive.html`

---

## Property Assessment Report: Current Configuration

### 5 Active Sites Assessed
1. **Camber Ridge** (Fulshear, TX)
   - URL: https://camberridgeapartments.com/
   - Mobile: 55, Desktop: 96
   - CWV Status: **Passing** (LCP 2.2s passing field data)
   - Priority: Low

2. **Monteverde** (San Antonio, TX)
   - URL: https://monteverdesatx.com/
   - Mobile: 69, Desktop: 92
   - CWV Status: **Failing** (CLS 0.12)
   - Priority: High

3. **Sundara** (Cypress, TX)
   - URL: https://whatscomingtocypress.com/
   - Mobile: 54, Desktop: 90
   - CWV Status: **At Risk** (LCP 11.6s, no field data yet)
   - Priority: Medium

4. **Vine** (Kyle, TX)
   - URL: https://whatscomingtokyle.com/
   - Mobile: 50, Desktop: 89
   - CWV Status: **At Risk** (LCP 9.4s, no field data yet)
   - Priority: Medium

5. **Townestone** (Richmond, TX)
   - URL: https://townestoneat359.com/
   - Mobile: 47, Desktop: 90
   - CWV Status: **At Risk** (LCP 14.5s, no field data yet)
   - Priority: Medium

### SEO Metadata (All Sites)
- ✅ OpenGraph tags present
- ✅ Twitter Cards configured
- ✅ Canonical URLs set
- ✅ Basic schema.org markup

### Report Sections
1. **Executive Summary** - Key insights for leadership
2. **Property Assessments** - Individual property breakdowns with CWV, schema, SEO
3. **Priority & Impact Matrix** - Urgency/effort/impact analysis
4. **Estimated Timeline & Resources** - Directional guidance (no hard week counts)
5. **Recommended Next Action** - Single, actionable recommendation

---

## Generating & Sending Reports

### Generate Report
```bash
cd /Users/mark/Property_Analytics
python3 generate_executive_assessment.py
```

Output: `/Users/mark/Downloads/report/Property_Assessment_Executive.html`

### Send Report via Email
```bash
cd /Users/mark/Property_Analytics
python3 send_property_assessment.py
```

Sends to: mlaufhutte@venterraliving.com from marklaufhutte@gmail.com

---

## Important Notes

### Core Web Vitals Framing
- Reports reflect Google's **actual** evaluation criteria
- Mobile-first evaluation (75th percentile of field data when available)
- "Passing" = All CWV metrics pass
- "Failing" = At least one CWV metric fails
- "At Risk" = Lab data shows issues but no field data yet

### Language Guidelines
- **Executive-appropriate**: Conservative, outcome-focused
- **Active sites**: No "pre-launch" or "launch window" language
- **Schema**: Conservative language (e.g., "basic schema.org markup present" not "comprehensive")
- **Recommendations**: Actionable, not alarmist

### Data Sources
Property data manually entered from:
- `/Users/mark/Downloads/report/` (PageSpeed screenshots, source HTML)
- User-provided URLs and performance metrics

---

## Version History

### v1.0.0 - Initial Release (2026-01-26)
- Ad-hoc report builder framework created
- Property Assessment report template built
- Email integration added

### v1.0.1 - Logo Fix (2026-01-27)
- **Fixed**: Venterra logo rendering issue
- Corrected 7-character typos in `VENTERRA_LOGO_BASE64` constant
- Logo now displays correctly in all ad-hoc reports
