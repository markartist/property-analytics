# AGENTS.md

This repository has strict guardrails for PIB.

## Non-Negotiable Rule: PIB v2.1 is Locked

Never mutate canonical PIB generation/rendering behavior unless the user gives explicit approval in the current task.

Locked files:

- `Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `Property_Intelligence_Brief/templates/executive_email_template.py`
- `Property_Intelligence_Brief/send_property_intelligence_brief_email.py`

## Required Behavior for Agents

When a request mentions PIB:

1. Default to orchestration-only work.
2. Do not create alternate PIB renderers/templates in `apps/api` or `apps/web`.
3. Use existing PIB pages/pipeline (`/pib`, `/pib/property`, canonical generator/sender).
4. If the task would touch locked files, stop and ask for explicit approval first.

## CI/Automation Enforcement

Run:

- `bash scripts/check_pib_guardrails.sh`

The script fails when:

- locked PIB files were modified in the diff, or
- disallowed custom PIB renderer patterns were introduced.
