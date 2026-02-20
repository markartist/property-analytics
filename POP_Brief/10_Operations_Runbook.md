# 10 Operations Runbook
Title: POP Brief Operations Runbook
Version: 1.0.0
Status: Day-2 Operational Guide
Last Updated: Feb 20, 2026
Owner / Stewardship:
- Operations Lead: TBD
- Support Steward: TBD
- Engineering On-Call: TBD
## Purpose
This runbook covers routine operation, access control actions, recovery procedures, and troubleshooting for POP Brief.
## Invite Users
- Confirm requestor is authorized to request access.
- Admin navigates to invite workflow and creates invite with correct role.
- Verify invite send status in notification event logs.
- Confirm user redeemed invite and appears as active in user list.
## Revoke Access
- Admin sets `is_active=false` for target user.
- Revoke active sessions for that user.
- Validate user can no longer access protected routes.
- Log reason and actor in audit records.
## Recover From Bad Import
- Identify failed or incorrect import run ID in `import_runs`.
- Export current state for safety snapshot.
- Re-import corrected data using same scope and validated Friday dates.
- Confirm post-import row counts and key metrics.
- Record incident notes in operational log.
## Verify Data Freshness
- Check latest `metric_date`/`week_ending` for expected Friday cutoff.
- Confirm both window sizes (7 and 30) exist for portfolio and relevant communities.
- Review import run status history for recent failures.
- Trigger analysis endpoint and verify non-empty payload where expected.
## Rotate Secrets
Resend API key:
- Create new key in provider console.
- Update Worker secret `RESEND_API_KEY`.
- Deploy Worker and validate invite send test.
Session signing secret:
- Generate new high-entropy value.
- Update `SESSION_SIGNING_SECRET` and deploy Worker.
- Invalidate existing sessions if required by policy.
- Verify fresh login/session issuance.
## Backup Procedure
Manual backup:
- Run backup export endpoint as admin.
- Confirm artifact written to R2 backup path.
- Validate file can be downloaded and parsed.
Planned automation (Post-v1):
- Schedule periodic backup export and retention management.
- Add checksum verification and alerting.
## Basic Troubleshooting Checklists
Authentication issues:
- Confirm session cookie flags and domain scope.
- Verify user is active and invite redemption completed.
- Check Worker logs for auth error codes.
Import failures:
- Inspect validation errors for non-Friday dates or enum mismatches.
- Confirm required columns and delimiter formatting.
- Verify community key resolution.
Email delivery issues:
- Verify Resend API key validity.
- Confirm sender domain DNS records remain valid.
- Check notification dedupe suppression behavior.
API/runtime issues:
- Confirm latest deployment health.
- Check D1 migration baseline compatibility.
- Validate R2 bucket bindings and object write permissions.
