# Methodology

## Primary Commissioned Metric

- `Score` = actual `PSI Mobile Performance Score`

The commissioned matrix uses the Google PageSpeed Insights mobile performance
score directly so pilot properties and sister/control properties remain directly
comparable.

## Daily Matrix Fields

- `Score`
  - actual PSI mobile score for the configured site URL on that date
- `T30`
  - trailing 30-day average excluding the current day
- `Variance from T30`
  - `Score - T30`
- `Rolling T90`
  - trailing 90-day average excluding the current day
- `Variance from T90`
  - `Score - Rolling T90`
- `YoY Trend`
  - same-calendar-date prior-year score when available
- `Variance from YoY`
  - `Score - YoY Trend`
- `Variance from Sister`
  - current property score minus the assigned sister/control property score on
    the same date

## Blank Value Rules

For newly launched pilot vanity domains:

- `T30` remains blank until 30 prior daily observations exist
- `Rolling T90` remains blank until 90 prior daily observations exist
- `YoY Trend` remains blank until prior-year direct history exists
- corresponding variance fields remain blank when the comparison baseline is blank

## Date Handling

- `launch_date`
  - business launch milestone
- `report_start_date`
  - first date included in the commissioned matrix and used for day numbering

This allows prelaunch collection to appear in the report without changing the
declared launch date.

## Supporting Metrics

The raw PSI tab preserves:

- `performance_score`
- `lcp_value`
- `cls_value`
- `total_blocking_time`
- strategy and collection date metadata

These are included for auditability and troubleshooting, but the commissioned
headline metric remains the PSI mobile score.

## History Sources

- `dedicated`
  - reads history from `pilot_control_psi_metrics`
- `portfolio_property`
  - reads history from portfolio `pagespeed_metrics`

Use `dedicated` for pilot vanity domains to avoid contaminating their baselines
with legacy-property history.
