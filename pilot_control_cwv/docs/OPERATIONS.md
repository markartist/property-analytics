# Operations Runbook

## Purpose

Run and deliver the standalone pilot-vs-control CWV report without affecting the
existing portfolio report stack.

## Inputs

- Config: `pilot_control_cwv/config/pilot_control_cwv_config.json`
- Template: `pilot_control_cwv/config/pilot_control_cwv_config.example.json`
- PSI API key:
  - currently referenced from
    `/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/pagespeed_api_key.txt`
- Database:
  - currently `data/portfolio_analytics.db`
  - dedicated table: `pilot_control_psi_metrics`

## Daily Commands

Collect only:

```bash
python3 pilot_control_cwv/scripts/collect_pilot_control_psi.py
```

Generate report only:

```bash
python3 pilot_control_cwv/scripts/generate_pilot_control_cwv_report.py
```

Send most recent dated report:

```bash
python3 pilot_control_cwv/scripts/send_pilot_control_cwv_report.py --date YYYY-MM-DD
```

Run the full workflow:

```bash
python3 pilot_control_cwv/scripts/run_pilot_control_cwv_daily.py --date YYYY-MM-DD
```

Dry run without email:

```bash
python3 pilot_control_cwv/scripts/run_pilot_control_cwv_daily.py --date YYYY-MM-DD --skip-send
```

## Testing

Limit to a single property during validation:

```bash
python3 pilot_control_cwv/scripts/collect_pilot_control_psi.py --limit 1
```

## Outputs

Generated artifacts are written to:

- `pilot_control_cwv/reports/Pilot_Control_CWV_Report_YYYY-MM-DD.xlsx`
- `pilot_control_cwv/reports/Pilot_Control_CWV_Report_YYYY-MM-DD.html`

## Production Readiness Checklist

- Add the 5 sister/control properties to the config
- Populate `sister_key` pairings
- Confirm recipient list
- Validate mobile PSI collection for all 10 properties
- Schedule the daily runner
- Verify email delivery on a test date
