# Ad Hoc Executive Report System

Status: Preliminary canonical system
Owner: MarketingOps / Property Analytics
Created: 2026-06-25

## Purpose

The Ad Hoc Executive Report System is the governed path for one-off executive reports that should look and behave like a light-mode PIB-style email without mutating locked PIB generators or templates.

The system exists so a natural-language report request can become:

- an Outlook-safe HTML report
- a workbook attachment
- a validated run packet
- an optional AWS SES email send
- a durable archive for future Pond integration

## Canonical Entry Point

Use:

```bash
python3 scripts/run_adhoc_report.py --subject "Portfolio traffic summary by channel" --period trailing_30_days
```

To send after validation:

```bash
python3 scripts/run_adhoc_report.py --subject "Portfolio traffic summary by channel" --period trailing_30_days --email
```

The current registry supports:

- `organic_search_share`
- `ga4_traffic_summary`
- `content_manager_workup`
- `content_intelligence_pack` (`Property Intel Pack`)

The CLI can infer these from the subject, or the report type can be supplied explicitly:

```bash
python3 scripts/run_adhoc_report.py --report-type organic_search_share --subject "Organic search share of traffic"
```

## Architecture

```text
CLI now / Pond later
  -> adhoc_report_orchestrator
    -> adhoc_report_sources
    -> outlook_report_builder
    -> outlook_email_validator
    -> EmailSender
    -> reports/adhoc_executive/<report_type>/<run_id>/
```

## Run Packet

Every run writes:

- `request.json`
- `report_spec.json`
- `report.html`
- `report.xlsx`
- `validation.json`
- `delivery.json`
- `sources_used.md`

The run packet is the future Pond handoff object. Pond should read these same artifacts rather than inventing a separate web-only report model.

## Outlook Safety Contract

Report email HTML must pass `scripts/check_outlook_email_safety.py`.

The validator blocks:

- `<style>` tags
- `<script>` tags
- external stylesheets
- CSS flexbox
- CSS grid
- CSS variables
- media queries
- JavaScript URLs
- class-dependent layout
- external images
- email width above `720px`
- non-official Venterra hex colors

Required posture:

- table-based layout
- inline styles
- light-mode only
- data URI logo
- official Venterra palette
- generated timestamp
- source note

Product-specific posture:

- `content_intelligence_pack` is the Property Intel Pack, the Content Ops companion to PIB.
- Property Intel Pack emails must be narrower than the first 07/15/2026 proof: fewer KPI columns per row, compact visible question text, and email tables that avoid horizontal clipping in Outlook preview.
- Deep evidence rows should live in `report.xlsx`; the email body should stay action-oriented and pane-friendly.

## Delivery Contract

All email sends go through:

- `utils/email_sender.py`
- default provider `aws_ses`
- delivery log under `logs/email_delivery/`

Direct SMTP snippets, custom Gmail senders, and one-off email wrappers are not the ad hoc report path.

## Extension Rules

To add a new subject family:

1. Add a report type resolver in `utils/adhoc_report_sources.py`.
2. Add a source builder that returns `ReportBuild`.
3. Use governed source tables, existing source helpers, and property identity resolution.
4. Render only through `utils/outlook_report_builder.py`.
5. Validate with `scripts/check_outlook_email_safety.py`.
6. Keep the output archive packet shape unchanged.

Do not add alternate ad hoc report renderers in `apps/api`, `apps/web`, or report-specific scripts. Future Pond integration should call this engine first, then expose request/spec/render/send/archive controls in the UI.
