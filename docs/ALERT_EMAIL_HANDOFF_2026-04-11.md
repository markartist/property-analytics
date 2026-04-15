# Alert Email Handoff

Status: Active handoff note  
Date: 2026-04-11  
Scope: Morning failure alerting, duplicate suppression, and pilot/portfolio alert ownership

## 1. Why This Exists

This document is the cold-start handoff for the morning alert email task set.

It is meant to let a fresh thread answer these questions without rediscovery:

- what email should send when morning systems fail
- which scripts currently send alert-style emails
- what was changed on 2026-04-11
- what is still unresolved
- how to verify the system without guessing

## 2. Current Goal State

Desired operator outcome:

- one morning failure email
- exhaustive content
- no duplicate validator / specialty alert spam
- no stale or fake data masking

Plainly:

- one inbox item for the morning failure
- that one email should summarize portfolio collection failures, registry validation issues, and relevant pilot failure context

## 3. Current Architecture

### Canonical portfolio failure alert

Primary file:

- `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`

Role:

- sends the canonical portfolio failure email
- now uses the subject:
  - `🔴 CRITICAL: Consolidated Morning Failure Alert ({n} jobs failed)`
- now inlines a `Registry Validation Summary` section sourced from the database table:
  - `registry_validation_failures`

Important behavior already in place:

- filters some non-actionable prelaunch / GSC inspection noise
- classifies core vs specialty failures
- includes remediation actions when available
- wraps output with the PIB light email shell

### Pilot-specific failure alert

Primary files:

- `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
- `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_recovery_email.py`

Role:

- protects the dedicated pilot morning workflow
- sends a pilot failure email when:
  - GTMetrix retries exhaust
  - PSI retries exhaust
  - bootstrap / shell failure happens before normal stages complete

Current subject:

- `CRITICAL: Consolidated Morning Failure Alert - Pilot {stage} - {report_date}`

Important behavior already in place:

- Bash 3.2-safe loader logic replaced earlier `mapfile` usage
- `ERR` trap sends shell/bootstrap context:
  - Bash version
  - exit code
  - line number
  - failing command
- wrapper now also tracks and reports the active stage, and rewrites misleading pipeline-tail `tee` context into stage-aware wording when a deeper command in the block fails
- wrapper now records same-day failure marker state under:
  - `~/Library/Logs/Venterra/pilot_morning_status/`
- if a pilot failure alert was sent earlier in the day but the workflow later completes successfully, the wrapper now sends:
  - `RESOLVED: Pilot Morning Workflow Recovered - YYYY-MM-DD`
- stale GT fallback exports are blocked

### Registry completeness validator

Primary file:

- `/Users/mark/Property_Analytics/Portfolio_Monitoring/validate_registry_completeness.py`

Role:

- still performs validation
- no longer emails by default

Current control:

- `REGISTRY_VALIDATION_EMAILS_ENABLED`
- default is disabled via:
  - `REGISTRY_VALIDATION_EMAILS_ENABLED = 0`

This validator now feeds the consolidated morning failure email through the database instead of sending its own direct mail.

### Disabled duplicate source

Standalone LaunchAgent:

- `/Users/mark/Library/LaunchAgents/com.venterra.registry_validation.plist`

Current state:

- disabled

Verification command:

```bash
launchctl print-disabled gui/503 | rg registry_validation
```

Expected:

- `"com.venterra.registry_validation" => disabled`

## 4. What Changed On 2026-04-11

### Duplicate alert reduction

Implemented:

- disabled standalone registry validation LaunchAgent
- suppressed direct registry validation emails by default
- merged latest registry validation findings into the main portfolio alert
- changed alert wording to `Consolidated Morning Failure Alert`

Result:

- registry findings should no longer produce their own separate morning validator emails

### Pilot shell/bootstrap hardening

Implemented in:

- `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`

Changes:

- `set -Eeuo pipefail`
- Bash 3.2-safe array loading instead of `mapfile`
- bootstrap/shell `ERR` trap
- explicit failure alert for early shell/orchestration failures

Result:

- if the pilot morning script dies before collection stages, the alert should say why

### April 13 follow-up hardening

Observed failure mode:

- the global `ERR` trap still misclassified a retryable GTMetrix partial-pass as `Bootstrap / Shell`
- later in the same run, homepage evidence failed because LaunchAgent `PATH` did not include the local Node binary

Fixes applied:

- `run_pilot_morning_daily.sh` now calls `run_gtmetrix_until_fresh` and `run_psi_until_fresh` inside `if ! ...; then exit 1; fi` guards so an expected nonzero return from a controlled retry loop does not trigger the shell/bootstrap alert path
- downstream stages now use explicit stage-aware failure handling for:
  - homepage audit evidence
  - GTMetrix export
  - PSI export
  - pilot CSV export notification
  - merged pilot evaluation
  - pilot roundup generation
  - pilot roundup notification
- LaunchAgent runtime `PATH` in `run_pilot_morning_daily.sh` now includes:
  - `/Users/mark/.nvm/versions/node/v22.22.1/bin`

Operational meaning:

- retryable GT loops should no longer emit false bootstrap emails
- real downstream failures should name the actual failing stage
- homepage evidence can now find `node` during launchd execution on this machine
- if an earlier pilot failure alert was already sent, a later same-day successful completion now emits a recovery/closure email to correct the inbox state

### Pilot informational email behavior

Current live wrappers:

- `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- `/Users/mark/Property_Analytics/run_pilot_roundup_daily.sh`

Current default:

- `PILOT_SUMMARY_EMAILS_ENABLED=1`

This is important because some older repo memory still says pilot summary emails are suppressed by default. That is no longer true in the current wrappers.

## 5. Known Open Gap

The system is closer, but not perfectly unified yet.

Current likely remaining duplication risk:

- central portfolio failure alert can still send
- pilot-specific failure alert can also still send
- legacy untracked pilot failure emails may not appear in the JSON delivery log because the pilot failure sender currently uses `send_email(...)` rather than tracked send logging

So the system has already eliminated the duplicate registry-validation spam, but it may still produce:

- one central consolidated morning failure email
- plus one pilot-specific consolidated failure email

if both systems fail independently the same morning.

### Next recommended consolidation target

Unify pilot failure details into the central alert path so that:

- pilot failures are appended into the same central email body
- `send_pilot_collection_failure_email.py` becomes optional, suppressed, or write-only to a shared state source

## 6. Canonical File Map

### Alert ownership

- Portfolio alert owner:
  - `/Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py`
- Pilot workflow owner:
  - `/Users/mark/Property_Analytics/run_pilot_morning_daily.sh`
- Pilot failure mailer:
  - `/Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py`
- Registry validator:
  - `/Users/mark/Property_Analytics/Portfolio_Monitoring/validate_registry_completeness.py`

### Related schedulers / launch agents

- `/Users/mark/Library/LaunchAgents/com.venterra.portfolio.collection.plist`
- `/Users/mark/Library/LaunchAgents/com.venterra.registry_validation.plist`
- `/Users/mark/Library/LaunchAgents/com.venterra.pilot.morning.daily.plist`

### Relevant data sources

- `/Users/mark/Property_Analytics/data/portfolio_analytics.db`
- table:
  - `data_collections`
- table:
  - `registry_validation_failures`
- delivery logs:
  - `/Users/mark/Property_Analytics/logs/email_delivery/`

### Useful logs

- `/Users/mark/Library/Logs/Venterra/pilot_morning_daily_YYYY-MM-DD.log`
- `/Users/mark/Library/Logs/Venterra/pilot_morning_daily_stdout.log`

## 7. Cold-Start Checklist For A New Thread

If a new thread is asked to work the alerting issue, do this in order:

1. Read:
   - `/Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md`
   - `/Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md`
   - `/Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md`
   - `/Users/mark/Property_Analytics/docs/ALERT_EMAIL_HANDOFF_2026-04-11.md`
2. Confirm the registry validator LaunchAgent is disabled.
3. Confirm `validate_registry_completeness.py` still suppresses direct email by default.
4. Confirm `alert_sender.py` still injects `Registry Validation Summary`.
5. Confirm pilot wrapper still has the shell `ERR` trap and Bash 3.2-safe logic.
6. Decide whether the work is:
   - duplicate reduction
   - alert content expansion
   - pilot + portfolio alert unification
7. Run the validation commands in Section 8 before closing the task.

## 8. Verification Commands

### Check registry validator disablement

```bash
launchctl print-disabled gui/503 | rg registry_validation
```

### Check direct registry email suppression

```bash
rg -n "REGISTRY_VALIDATION_EMAILS_ENABLED|Validation email suppressed" /Users/mark/Property_Analytics/Portfolio_Monitoring/validate_registry_completeness.py
```

### Check consolidated subject lines

```bash
rg -n "Consolidated Morning Failure Alert" /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py /Users/mark/Property_Analytics/pilot_control_cwv/scripts/send_pilot_collection_failure_email.py
```

### Check pilot shell hardening

```bash
rg -n "handle_unexpected_error|trap 'handle_unexpected_error|PILOT_SUMMARY_EMAILS_ENABLED" /Users/mark/Property_Analytics/run_pilot_morning_daily.sh /Users/mark/Property_Analytics/run_pilot_roundup_daily.sh
```

### Preview the central alert body

```bash
python3 /Users/mark/Property_Analytics/Data_Collection/monitoring/alert_sender.py --test
```

Then inspect:

- `/tmp/alert_preview.html`

### Guardrails

```bash
bash /Users/mark/Property_Analytics/scripts/check_pib_guardrails.sh
bash /Users/mark/Property_Analytics/scripts/check_context_discipline.sh
```

## 9. Decision Rules

When modifying this task set:

- do not re-enable standalone validator emails unless explicitly requested
- do not silently reintroduce stale/fallback data messaging
- prefer one canonical alert body over multiple specialized failure emails
- keep pilot failures truthful and explicit
- if multiple alerts still exist, document exactly which script emitted each one

## 10. Recommended Next Step

Best next improvement:

- collapse pilot failure details into the central portfolio alert flow so the inbox gets one truly exhaustive failure email

That can be done by either:

- having pilot failures write structured state that `alert_sender.py` renders, or
- having the pilot wrapper call into the same central sender instead of its own dedicated mailer

## 11. Ready-To-Paste Next-Thread Prompt

Use this if starting a fresh Codex thread on the alerting work:

```text
Read:
- /Users/mark/Property_Analytics/ATLAS_WORKING_MEMORY.md
- /Users/mark/Property_Analytics/docs/CAPABILITY_REGISTER_2026-04-10.md
- /Users/mark/Property_Analytics/docs/FULL_SYSTEM_AUDIT_2026-04-10.md
- /Users/mark/Property_Analytics/docs/ALERT_EMAIL_HANDOFF_2026-04-11.md

Task:
Continue the morning alert email consolidation work. The goal is one exhaustive morning failure email and no duplicate validator/pilot alert spam. Start by verifying the current alert paths, then identify whether central portfolio and pilot failure alerts are still split, and if so, unify them without weakening error visibility. Do not touch locked PIB files. Update memory/docs and run context/guardrail checks before finishing.
```
