# Pilot Report Depository Plan

## Goal

Create a stable, automation-ready home for pilot KPI reporting artifacts without breaking the current working scripts.

## Principles

- Keep existing top-level report paths working.
- Mirror deliverables into a cleaner depository structure.
- Separate daily packages from diagnostics, previews, and raw snapshots.
- Make automation operate on one stable destination.

## Depository Structure

- `pilot_control_cwv/reports/depository/daily_packages/YYYY-MM-DD/`
  - workbook
  - manifest
- `pilot_control_cwv/reports/depository/snapshots/bi/`
  - normalized BI snapshots
- `pilot_control_cwv/reports/depository/snapshots/dashboard/YYYY-MM-DD/`
  - exported dashboard JSON
- `pilot_control_cwv/reports/depository/email/previews/`
  - HTML previews
- `pilot_control_cwv/reports/depository/email/panels/YYYY-MM-DD/`
  - PNG panel sets
- `pilot_control_cwv/reports/depository/diagnostics/YYYY-MM-DD/`
  - comparator and cross-source reports
- `pilot_control_cwv/reports/depository/manifests/`
  - package manifests

## Recommended Automation Flow

When source files are deposited regularly:

1. Detect latest source drops in `Guest_Card_Reports`
2. Ingest latest BI workbook
3. Ingest latest Measurement workbook
4. Export dashboard snapshots
5. Generate workbook
6. Copy the workbook into `Guest_Card_Reports` per
   `pilot_control_cwv/docs/PILOT_WORKBOOK_EXPORT_SOP.md`
7. Optionally generate email preview/panels
8. Sync outputs into the depository
9. Deploy tracker
10. Optionally send the email

## Automation Stages

### Stage 1: Build Package

Safe to automate first.

- no email send
- no PIB locked file changes
- only refreshes data, workbook, dashboard snapshots, depository manifest

### Stage 2: Deploy Tracker

Runs after successful package build.

- build standalone tracker
- deploy to Cloudflare Pages
- record deploy URL in manifest

### Stage 3: Distribution

Optional, only after package review is trusted.

- generate HTML preview
- send attachment-first email

## Operational Notes

- BI file date and BI data coverage date are expected to differ by one day.
- The manifest should always record both:
  - source file date
  - data coverage date
- Missing values should remain explicit and never be filled by automation.
