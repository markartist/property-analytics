# AGENTS.md

This repository has strict guardrails for PIB.

## Non-Negotiable Rule: Resi Edge Scope Lock

For any Resi Edge rollout, optimization, Worker, routing, analytics, consent, dashboard-finalization, or launch-proof work:

1. Read `ATLAS_WORKING_MEMORY.md` and the active Resi Edge run packet before any tool action.
2. Act only on the property/action the user explicitly names in the current task.
3. Do not inspect, audit, repair, rerun, or mutate completed properties unless the user names that exact target.
4. Do not treat discovered adjacent evidence as scope.
5. Before running `scripts/run_resi_edge_upgrade.py` in `plan`, `stage`, or `apply`, set an explicit current-turn lock with `scripts/set_resi_edge_scope_lock.py`. The lock must name the exact property code, domain, and allowed mode.
6. Clear the lock after the approved target is complete.

The runner and deploy adapter enforce this mechanically through `config/portfolio_resi_edge_stabilization/active-resi-edge-scope-lock.json`.

## Non-Negotiable Rule: Locked PIB Versions Require Explicit Approval

Never mutate canonical PIB generation/rendering behavior unless the user gives explicit approval in the current task.

Locked files:

- `Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `Property_Intelligence_Brief/templates/executive_email_template.py`
- `Property_Intelligence_Brief/send_property_intelligence_brief_email.py`
- `Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_0.py`
- `Property_Intelligence_Brief/templates/executive_email_template_v2_2_0.py`
- `Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_0.py`
- `Property_Intelligence_Brief/generate_property_intelligence_brief_v2_2_1.py`
- `Property_Intelligence_Brief/templates/executive_email_template_v2_2_1.py`
- `Property_Intelligence_Brief/send_property_intelligence_brief_email_v2_2_1.py`

## Required Behavior for Agents

### Jira / Customer-Facing Communication Discipline

When writing Jira comments, ticket updates, or other customer-facing status messages on the user's behalf:

1. Start with a personalized greeting like `Hi, Name` or `Hello, Name` when the recipient's name is known.
2. Use a warm, natural tone rather than terse or sterile status language.
3. Close with: `Thanks, and have a great day!`
4. Preserve exact technical details, statuses, ticket keys, and instructions; warmth should not blur accountability or next steps.

### Keeper / KSM Credential Discipline

Keeper Secrets Manager is the mandatory source of truth for credentials, API tokens, OAuth artifacts, service tokens, and deployment auth in this repository.

Agents must:

1. Resolve credentials through Keeper/KSM helpers, notation env vars, or Keeper-backed file materialization before trying any direct environment variable, local credential file, browser login, or manual token path.
2. Treat direct env vars and local credential files as transitional fallbacks only when an existing canonical helper explicitly supports them, or when the user explicitly provides a one-time value in the current task.
3. Never create a new local credential file, checked-in secret, ad hoc `.env` secret, or non-KSM credential path unless the user explicitly approves that exception in the current task.
4. Never print, log, persist, paste, or summarize raw secret values. Verification should report only presence, source class, success/failure, and sanitized error context.
5. Before declaring a credential missing, inspect the relevant KSM manifest/helper path. For Cloudflare Wrangler work, use `/Users/mark/Property_Analytics/apps/api/scripts/wrangler_auth.py` or the existing Cloudflare auth helpers so `CLOUDFLARE_API_TOKEN` is injected from Keeper.
6. If a needed credential is not yet represented in Keeper/KSM, stop and ask for the credential to be added to Keeper and documented in the appropriate manifest instead of inventing a local workaround.

### Venterra Brand Color Discipline

Use only the official Venterra brand palette for new or materially updated user-facing UI, reports, decks, documents, charts, and generated assets unless the user explicitly specifies otherwise in the current task.

Official colors:

- Venterra Navy: `#15284B`
- San Marino: `#3D66B9`
- Bay: `#294782`
- Indigo: `#5A81CF`
- Monte Carlo: `#7DCAC2`
- Pink: `#E02472`
- White Smoke: `#F6F6F5`
- Terra Cotta: `#BD4830`
- Quill Gray: `#D6D6D2`
- Blue Chill: `#3B9189`
- Delta: `#9B9B96`
- Black: `#000000`
- White: `#FFFFFF`

Discontinued colors must not appear in new color palettes or swatch controls. Galliano `#EAAB00` is discontinued and should be replaced with an active palette color when a touched configurable color still uses it.

If an existing surface still contains legacy colors, do not broaden a task into a full redesign unless asked; however, any color controls, swatches, or touched visual elements should be brought back to this palette.

### Executive Deliverable Discipline

When the user says a report, email, deck, document, spreadsheet, JSON contract, or other executive-facing artifact has been approved, that approved artifact format is locked for that workstream.

Agents must:

1. Reuse the exact approved template, structure, section order, labels, terminology, and delivery channel unless the user explicitly asks for a change.
2. Treat requested corrections as data/source/content alignment work first, not as permission to redesign, simplify, enhance, rename, or reframe the artifact.
3. Preserve the approved audience boundary. If a companion Community Manager / Site Manager document was approved as a reduced-data attachment, do not replace it with a different reduced report format.
4. Ask before changing visual layout, report family, email shell, attachment strategy, section names, or narrative stance once executive approval has been established.
5. Prefer exact reproduction of the approved artifact over creative improvement. Creativity is allowed only inside the requested lane and only after the approved deliverable contract is satisfied.
6. If an approved output and a local/generated output differ, stop and reconcile to the approved output before sending anything.

Failure mode to avoid: generating a technically reasonable alternate report when the user asked for the already-approved format.

### Human-Facing Date Format Discipline

Use `MM/DD/YYYY` for all dates shown to humans in reports, emails, decks, documents, spreadsheets, UI labels, narrative summaries, screenshots/captions, and final user-facing messages unless the user explicitly requests a different display format in the current task.

Agents must:

1. Treat ISO dates like `YYYY-MM-DD` as internal/machine format only by default.
2. Preserve ISO dates for filenames, file paths, JSON contracts, API payloads, database values, logs, sortable IDs, specs, validation metadata, and other machine-readable artifacts.
3. Convert internal dates to `MM/DD/YYYY` before rendering human-facing copy, table cells, chart labels, section headers, email subjects, and executive summaries.
4. For date-time displays intended for humans, use `MM/DD/YYYY h:mm AM/PM` with timezone context when the timezone matters.
5. When quoting or referencing an existing internal file path or artifact ID, do not rewrite the date embedded in that path; explain nearby human-facing date ranges in `MM/DD/YYYY`.

Failure mode to avoid: exposing internal ISO-style dates in executive-facing or reader-facing prose just because the source data, filenames, or system time use ISO dates.

### Ad Hoc Executive Report Discipline

When the user requests a new ad hoc executive report, specialty report, or Outlook/HTML email report and no already-approved report family owns the request, use the governed Ad Hoc Executive Report System instead of creating a one-off renderer or sender.

Agents must:

1. Route preliminary ad hoc report work through `/Users/mark/Property_Analytics/scripts/run_adhoc_report.py` and the supporting engine in `/Users/mark/Property_Analytics/utils/adhoc_report_orchestrator.py`.
2. Render through `/Users/mark/Property_Analytics/utils/outlook_report_builder.py` and validate with `/Users/mark/Property_Analytics/scripts/check_outlook_email_safety.py` before any email send.
3. Preserve the run-packet contract under `/Users/mark/Property_Analytics/reports/adhoc_executive/`: `request.json`, `report_spec.json`, `report.html`, `report.xlsx`, `validation.json`, `delivery.json`, and `sources_used.md`.
4. Send only through the universal email sender (`/Users/mark/Property_Analytics/utils/email_sender.py`) unless the user explicitly approves another delivery path in the current task.
5. Extend the source registry/report builders instead of adding standalone custom HTML email scripts for each new subject.

Failure mode to avoid: guessing at layout or delivery when the ad hoc report system can produce an Outlook-safe PIB-style report packet and enforce validation.

### Session Discipline

Before planning, building, or creating a new capability:

1. Read `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
2. Review `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
3. Review `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
4. Check whether the requested work should extend an existing canonical system instead of creating a parallel one

When a request mentions PIB:

1. Default to orchestration-only work.
2. Do not create alternate PIB renderers/templates in `apps/api` or `apps/web`.
3. Use existing PIB pages/pipeline (`/pib`, `/pib/property`, canonical generator/sender).
4. If the task would touch locked files, stop and ask for explicit approval first.

### Property Identity Discipline

Before adding or changing any source ingestion, Captain read, report input, or property-scoped automation:

1. Resolve property identity through `/Users/mark/Property_Analytics/Data_Collection/utils/property_identity.py`
2. Treat `/Users/mark/Property_Analytics/config/property_identity_matrix.json` as the governed identity matrix
3. Do not add local one-off property maps, hardcoded `AR4PB`/GA4/community-id bundles, or per-report identity exceptions when the matrix can resolve the source value
4. If a new source exposes another property identifier, add it to the matrix generation path instead of handling it downstream
5. Run `bash scripts/check_property_identity_governance.sh`

After any significant capability, workflow, ownership, or system-shape change:

1. Update `ATLAS_WORKING_MEMORY.md`
2. Update `docs/CAPABILITY_REGISTER_2026-04-10.md` if the capability inventory, owner, status, or disposition changed
3. Update `docs/FULL_SYSTEM_AUDIT_2026-04-10.md` if the narrative system map materially changed
4. Run `bash scripts/check_context_discipline.sh`

## CI/Automation Enforcement

Run:

- `bash scripts/check_pib_guardrails.sh`

The script fails when:

- locked PIB files were modified in the diff, or
- disallowed custom PIB renderer patterns were introduced.
