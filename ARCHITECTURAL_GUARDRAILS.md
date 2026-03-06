# Architectural Guardrails

## PIB v2.1 Lock (Hard Rule)

The canonical Property Intelligence Brief (PIB) v2.1.1 renderer is **locked**.

Do not change PIB generation/rendering behavior without explicit owner approval in the task.

Locked files:

- `Property_Intelligence_Brief/generate_property_intelligence_brief.py`
- `Property_Intelligence_Brief/templates/executive_email_template.py`
- `Property_Intelligence_Brief/send_property_intelligence_brief_email.py`

## Allowed PIB Work (Without Override)

Allowed changes that do not mutate PIB output:

- UI routing/navigation to existing PIB pages (`/pib`, `/pib/property`)
- Orchestration only: parameter capture, job trigger, status polling, links
- Email transport plumbing that sends existing generated PIB artifacts

## Prohibited PIB Work (Without Override)

- Any alternate PIB HTML renderer/template in `apps/api` or `apps/web`
- Any simplified/derived PIB report format replacing canonical v2.1 output
- Any endpoint that composes PIB HTML outside `Property_Intelligence_Brief/*`

## Override Protocol

If a PIB lock override is intentionally approved:

1. Approval must be explicit in the task request.
2. Commit/deploy notes must mention `PIB-LOCK-OVERRIDE`.
3. Include before/after validation against canonical v2.1 behavior.
