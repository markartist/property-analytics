#!/usr/bin/env python3
"""Post-run acceptance checks for morning report generation + email delivery."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

ROOT = Path('/Users/mark/Property_Analytics')
REPORT_DIR = ROOT / 'reports' / 'daily_health'
DELIVERY_DIR = ROOT / 'logs' / 'email_delivery'
STATUS_DIR = ROOT / 'logs' / 'morning_full_status'
PRIMARY_RECIPIENT = 'mlaufhutte@venterraliving.com'


def _load_delivery_entries(path: Path):
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _load_status(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description='Verify morning report delivery acceptance gates')
    parser.add_argument('--date', help='Date YYYY-MM-DD (default: today local)')
    args = parser.parse_args()

    date_str = args.date or datetime.now().strftime('%Y-%m-%d')
    report_file = REPORT_DIR / f'Morning_Full_Portfolio_Report_{date_str}.html'
    log_file = DELIVERY_DIR / f'email_delivery_{date_str}.jsonl'
    status_file = STATUS_DIR / f'morning_full_status_{date_str}.json'
    expected_subject = f'Morning Full Portfolio Report - {date_str}'
    backup = os.getenv('EMAIL_BACKUP_RECIPIENT', '').strip()
    status_payload = _load_status(status_file) or {}
    status = status_payload.get('status')

    failures = []
    if not report_file.exists():
        failures.append(f'missing report file: {report_file}')

    if status == 'held':
        closure = status_payload.get('closure') or {}
        print('ACCEPTANCE CHECK PASSED')
        print(f"- report: {report_file.name}")
        print(
            f"- delivery deferred: {closure.get('state')} "
            f"({closure.get('summary_reason')})"
        )
        return 0

    if status == 'dry_run':
        print('ACCEPTANCE CHECK PASSED')
        print(f'- report: {report_file.name}')
        print('- dry-run execution; delivery verification skipped')
        return 0

    entries = _load_delivery_entries(log_file)
    if not entries:
        failures.append(f'missing/empty delivery log: {log_file}')
    else:
        matches = [
            e for e in entries
            if e.get('success') is True and e.get('subject') == expected_subject
        ]
        if not matches:
            failures.append(f'no successful delivery record for subject: {expected_subject}')
        elif len(matches) > 1 and status != 'already_delivered':
            failures.append(f'duplicate successful deliveries recorded for subject: {expected_subject} ({len(matches)} entries)')
        else:
            latest = matches[-1]
            recipients = latest.get('to') or []
            if PRIMARY_RECIPIENT not in recipients:
                failures.append('primary recipient missing from delivery record')
            if backup and backup not in recipients:
                failures.append('backup recipient configured but missing from delivery record')

    if failures:
        print('ACCEPTANCE CHECK FAILED')
        for failure in failures:
            print(f'- {failure}')
        if status_file.exists():
            print(f'- status file: {status_file}')
        return 1

    print('ACCEPTANCE CHECK PASSED')
    print(f'- report: {report_file.name}')
    print(f'- delivery log: {log_file.name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
