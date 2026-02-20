# 08 Email Integration
Title: POP Brief Email Integration (Resend)
Version: 1.0.0
Status: MVP Integration Baseline
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Integration Steward: TBD
- Operations Steward: TBD
## Provider And Scope
- Provider for v1: Resend via HTTPS API.
- Supported send categories in v1:
  - Invite emails.
  - Mention notification emails.
## From Address Conventions
- Use environment-configured from address, for example `pop-brief@venterradev.com`.
- Keep a stable sender identity across environments to reduce deliverability variance.
- Display name format: `POP Brief`.
## Invite Email Template Outline
Subject:
- `You're invited to POP Brief`
Body sections:
- Greeting with recipient email context.
- Purpose statement for POP Brief access.
- Invite redemption link with expiry date/time.
- Security note: do not forward invite links.
- Support contact placeholder (TBD).
## Mention Email Template Outline
Subject:
- `POP Brief mention alert for week ending YYYY-MM-DD`
Body sections:
- Summary of mention context.
- Community reference and week-ending date.
- Direct link to authenticated app page.
- Deduped delivery note if related notifications were suppressed.
## Dedupe Strategy
- Every send attempt maps to a deterministic `notification_events.dedupe_key`.
- Suggested format: `<event_type>:<week_ending>:<recipient_email>:<entity_ref>`.
- Before sending, API checks for existing key:
  - If present, create no additional send and mark response as deduped.
  - If absent, send email and persist event status.
## Throttling Rules (MVP)
- Default send cap: maximum 50 emails per user-triggering actor per 24 hours.
- Burst cap: maximum 10 sends per minute per actor.
- System-wide safety cap: configurable daily ceiling to prevent runaway sends.
- Exceeded limits return controlled error and write audit entry.
## Future Adapter Strategy (Planned Post-v1)
- Abstract provider interface (`sendInvite`, `sendMention`).
- Keep provider-specific payload mapping in adapter layer.
- Target future adapters: Microsoft Graph and SES relay.
- Preserve `notification_events` dedupe behavior independent of provider.
