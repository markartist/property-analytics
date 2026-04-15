# Pilot Roundup

Standalone pilot-site performance roundup.

This package is intentionally separate from canonical PIB. It borrows PIB-style
presentation patterns, but does not modify or invoke the locked PIB generator,
templates, or sender.

Default presentation:

- pilot properties remain the primary cohort
- sister/control properties are now included by default
- the overview uses two KPI rows:
  - first row for pilots
  - second row for sisters/controls
- the main performance section groups each pilot with its matched sister/control property

## Inputs

- Pilot/control PSI history from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- GTMetrix daily scores from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- GA4 new users from `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- BrowserStack production QA JSON under `/Users/mark/Property_Analytics/evs/reports`
- Cohort mapping from `/Users/mark/Property_Analytics/pilot_control_cwv/config/pilot_control_cwv_config.json`

## Outputs

- HTML roundup in `pilot_roundup/reports`
- Markdown roundup in `pilot_roundup/reports`

Current default report shape:

- `Pilot Overview`
  - pilot KPI row
  - sister/control KPI row
- `Individual Pilot And Sister Performance`
  - paired pilot + sister/control cards
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

## Daily automation

- Wrapper: `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`
- LaunchAgent source: `/Users/mark/Property_Analytics/ops/pilot_roundup/com.venterra.pilot.roundup.daily.plist`
