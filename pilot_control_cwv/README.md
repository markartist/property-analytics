# Pilot vs Control CWV

This package contains the standalone Core Web Vitals / PageSpeed Insights workflow
for the commissioned pilot-vs-control reporting program.

It is intentionally separate from the portfolio reporting pipeline.

## Directory Layout

- `config/`
  - cohort definitions and report recipients
  - tracked example config plus local runtime config
- `scripts/`
  - daily collection, report generation, email delivery, and orchestration
- `docs/`
  - methodology and runbook notes
- `reports/`
  - generated Excel and HTML outputs

## Workflow

1. Collect PSI into dedicated history:
   - `python3 pilot_control_cwv/scripts/collect_pilot_control_psi.py`
2. Generate the commissioned daily matrix:
   - `python3 pilot_control_cwv/scripts/generate_pilot_control_cwv_report.py`
3. Email the artifacts:
   - `python3 pilot_control_cwv/scripts/send_pilot_control_cwv_report.py`
4. Run the full daily routine:
   - `python3 pilot_control_cwv/scripts/run_pilot_control_cwv_daily.py`

## Isolation Rules

- Pilot vanity-domain history is stored in `pilot_control_psi_metrics`
- Pilot history does not write into portfolio `pagespeed_metrics`
- Sister/control properties can later be configured to reference portfolio history
  without mixing pilot launch-day data into legacy baselines

## Config

- Tracked template:
  - `pilot_control_cwv/config/pilot_control_cwv_config.example.json`
- Local runtime file:
  - `pilot_control_cwv/config/pilot_control_cwv_config.json`

The runtime config is intentionally not committed because the repo ignores nested
`config/` paths.

## Current Status

- Pilot properties are configured
- Sister/control mappings are configured
- The workbook supports blank T30, T90, and YoY values until direct history exists
- `report_start_date` can be set earlier than `launch_date` to support prelaunch monitoring
