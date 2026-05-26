#!/usr/bin/env python3
"""Send the Morning Full Portfolio Report via canonical email sender."""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

from Data_Collection.utils.daily_collection_closure import evaluate_daily_collection_closure
from utils.email_sender import EmailSender
from utils.summary_email_guard import successful_delivery_exists


ROOT = Path("/Users/mark/Property_Analytics")
REPORT_DIR = ROOT / "reports" / "daily_health"
DEFAULT_RECIPIENTS = ["mlaufhutte@venterraliving.com"]
DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery"
STATUS_DIR = ROOT / "logs" / "morning_full_status"


def _write_status(date_str: str, payload: dict) -> None:
    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    path = STATUS_DIR / f"morning_full_status_{date_str}.json"
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Morning Full Portfolio Report")
    parser.add_argument("--date", help="Report date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument(
        "--recipient",
        action="append",
        dest="recipients",
        help="Recipient email (repeatable). Defaults to configured recipient list.",
    )
    parser.add_argument("--force", action="store_true", help="Send even if this summary was already delivered today")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print details without sending")
    args = parser.parse_args()

    report_date = datetime.strptime(args.date, "%Y-%m-%d") if args.date else datetime.now()
    date_str = report_date.strftime("%Y-%m-%d")
    report_file = REPORT_DIR / f"Morning_Full_Portfolio_Report_{date_str}.html"

    if not report_file.exists():
        _write_status(
            date_str,
            {
                "status": "report_missing",
                "subject": f"Morning Full Portfolio Report - {date_str}",
                "report_file": str(report_file),
            },
        )
        print(f"Report not found: {report_file}")
        print("Generate it first with: python3 generate_morning_full_report.py")
        return 1

    recipients = args.recipients[:] if args.recipients else DEFAULT_RECIPIENTS[:]
    backup_recipient = os.getenv("EMAIL_BACKUP_RECIPIENT", "").strip()
    if backup_recipient and backup_recipient not in recipients:
        recipients.append(backup_recipient)

    subject = f"Morning Full Portfolio Report - {date_str}"
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{date_str}.jsonl"

    if args.dry_run:
        closure = evaluate_daily_collection_closure(ROOT / "data" / "portfolio_analytics.db", target_date=report_date.date())
        _write_status(
            date_str,
            {
                "status": "dry_run",
                "subject": subject,
                "report_file": str(report_file),
                "closure": {
                    "state": closure.get("state"),
                    "summary_reason": closure.get("summary_reason"),
                    "ready_for_summary": closure.get("ready_for_summary"),
                },
            },
        )
        print("Dry run only (no email sent)")
        print(f"Report: {report_file}")
        print(f"Recipients: {', '.join(recipients)}")
        print(f"Subject: {subject}")
        print(f"Closure state: {closure['state']} ({closure['summary_reason']})")
        return 0

    closure = evaluate_daily_collection_closure(ROOT / "data" / "portfolio_analytics.db", target_date=report_date.date())
    if not args.force and not closure.get("ready_for_summary"):
        _write_status(
            date_str,
            {
                "status": "held",
                "subject": subject,
                "report_file": str(report_file),
                "closure": {
                    "state": closure.get("state"),
                    "summary_reason": closure.get("summary_reason"),
                    "ready_for_summary": closure.get("ready_for_summary"),
                    "next_retry_at": closure.get("next_retry_at"),
                    "unresolved_sources": closure.get("unresolved_sources") or [],
                },
            },
        )
        print("Morning full report is being held because core collection work is still open.")
        print(f"Closure state: {closure['state']} ({closure['summary_reason']})")
        if closure.get("next_retry_at"):
            print(f"Next retry at: {closure['next_retry_at']}")
        unresolved = closure.get("unresolved_sources") or []
        if unresolved:
            print("Unresolved sources:")
            for item in unresolved:
                print(f" - {item.get('source')}: {item.get('status')} ({item.get('reason')})")
        return 0

    if not args.force and successful_delivery_exists(log_path, subject):
        _write_status(
            date_str,
            {
                "status": "already_delivered",
                "subject": subject,
                "report_file": str(report_file),
                "delivery_log": str(log_path),
            },
        )
        print("Morning full report already delivered successfully for this date; skipping duplicate send")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return 0

    html_body = report_file.read_text(encoding="utf-8")
    sender = EmailSender(verbose=True)
    metadata = sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        recipients=recipients,
        log_path=log_path,
    )
    _write_status(
        date_str,
        {
            "status": "delivered",
            "subject": subject,
            "report_file": str(report_file),
            "delivery_log": str(log_path),
            "message_id": metadata.get("message_id"),
            "recipients": recipients,
        },
    )

    print("Morning full report emailed successfully")
    print(f"Report: {report_file.name}")
    print(f"Recipients: {', '.join(recipients)}")
    print(f"Message ID: {metadata.get('message_id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
