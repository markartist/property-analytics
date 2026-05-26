# Pilot Roundup

Standalone pilot-site performance roundup.

This package is intentionally separate from canonical PIB. It borrows PIB-style
presentation patterns, but does not modify or invoke the locked PIB generator,
templates, or sender.

Default presentation:

- pilot properties remain the primary cohort
- sister/control properties are now included by default
- same-region twin properties are now included by default under each pilot grouping
- the main pilot archetype site reference is now included as a separate bottom section
- the overview uses two KPI rows:
  - first row for pilots
  - second row for sisters/controls
- third row for twins
- the main performance section groups each pilot with:
  - its matched sister/control property
  - its same-region twin properties in a compact comparison block
- the standalone bottom reference reads from:
  - `https://pilot.venterradev.com/`

## Inputs

- Pilot/control PSI history from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- GTMetrix daily scores from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- GA4 new users from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- BrowserStack production QA JSON under `/Users/mark/Property_Analytics/evs/reports`
- Cohort mapping from `/Users/mark/Property_Analytics/pilot_control_cwv/config/pilot_control_cwv_config.json`

## Outputs

- HTML roundup in `pilot_roundup/reports`
- Markdown roundup in `pilot_roundup/reports`
- the routine email now carries the current `PSI_Day_Over_Day_Scores_latest.csv`
  and `GTMetrix_Daily_Scores_latest.csv` attachments instead of the markdown file
- those CSV companions now mirror the roundup structure with cohort labels for:
  - `pilot`
  - `sister`
  - `twin`
  - `main_pilot_reference`
- the daily pilot morning workflow now runs a dedicated same-day twin GTMetrix
  collection pass before exports, so twin GT rows should populate automatically
  on future routine sends
- the main pilot reference GT row remains blank by design because it is a
  separate live reference site rather than part of the stored GTMetrix cohort

Current default report shape:

- `Pilot Overview`
  - pilot KPI row
  - sister/control KPI row
  - twin KPI row
- `Individual Pilot And Sister Performance`
  - paired pilot + sister/control cards
  - compact twin property tables under each pilot pair
- `Main Pilot Reference`
  - standalone archetype PSI reference block
- `Diagnostic Insights`
- `Methodology Notes`

## Run

```bash
python3 /Users/mark/Property_Analytics/pilot_roundup/scripts/generate_pilot_roundup.py
```

## Email

```bash
python3 /Users/mark/Property_Analytics/pilot_roundup/scripts/send_pilot_roundup_email.py
```

The daily default is now a single consolidated summary email:

- subject: `Pilot Performance Roundup - MM-DD-YYYY`
- body: HTML roundup
- attachments:
  - `PSI_Day_Over_Day_Scores_latest.csv`
  - `GTMetrix_Daily_Scores_latest.csv`

The separate `Pilot Data Exports` routine email is no longer part of the daily
pilot morning workflow.

## Daily automation

- Wrapper: `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
- LaunchAgent source: `/Users/mark/Property_Analytics/ops/pilot_roundup/com.venterra.pilot.roundup.daily.plist`
