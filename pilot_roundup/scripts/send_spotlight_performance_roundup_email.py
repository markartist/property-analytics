#!/usr/bin/env python3
"""Generate and send the Spotlight PageSpeed Insights Performance roundup."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

import sys

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "pilot_roundup" / "scripts"))
sys.path.insert(0, str(ROOT / "utils"))

from email_sender import EmailSender  # noqa: E402
from generate_spotlight_performance_roundup import build_report  # noqa: E402
from summary_email_guard import successful_delivery_exists  # noqa: E402

RECIPIENTS = [
    "mlaufhutte@venterraliving.com",
    "elongoria@venterraliving.com",
    "jadomingue@venterraliving.com",
    "dcrandall@venterraliving.com",
]

DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery" / "spotlight_performance_roundup"


def plain_text_from_report(report_date: str, md_path: Path) -> str:
    if md_path.exists():
        return md_path.read_text(encoding="utf-8")
    subject_date = datetime.strptime(report_date, "%Y-%m-%d").strftime("%m-%d-%Y")
    return f"Spotlight PageSpeed Insights Performance - {subject_date}\n\nHTML report attached inline."


def send_spotlight_roundup(
    report_date: Optional[str] = None,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    report_date = report_date or datetime.now().strftime("%Y-%m-%d")
    subject_date = datetime.strptime(report_date, "%Y-%m-%d").strftime("%m-%d-%Y")

    html_path, md_path = build_report(report_date)
    html_body = html_path.read_text(encoding="utf-8")
    plain_text = plain_text_from_report(report_date, md_path)
    subject = f"Spotlight PageSpeed Insights Performance - {subject_date}"
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{report_date}.jsonl"

    if dry_run:
        print("Dry run only (no email sent)")
        print(f"Report: {html_path}")
        print(f"Subject: {subject}")
        print(f"Recipients: {', '.join(RECIPIENTS)}")
        print(f"Log: {log_path}")
        return True

    if not force and successful_delivery_exists(log_path, subject):
        print("Spotlight PageSpeed Insights Performance already delivered successfully for this date; skipping duplicate send")
        print(f"Subject: {subject}")
        print(f"Log: {log_path}")
        return True

    sender = EmailSender(verbose=True)
    metadata = sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
        recipients=RECIPIENTS,
        log_path=log_path,
    )
    print(f"Spotlight PageSpeed Insights Performance sent for {report_date}: {metadata.get('message_id')}")
    return bool(metadata.get("success"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Email Spotlight PageSpeed Insights Performance roundup")
    parser.add_argument("--date", help="Report date YYYY-MM-DD; defaults to today")
    parser.add_argument("--force", action="store_true", help="Send even if this subject has already succeeded today")
    parser.add_argument("--dry-run", action="store_true", help="Generate and validate without sending")
    args = parser.parse_args()

    return 0 if send_spotlight_roundup(args.date, force=args.force, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
