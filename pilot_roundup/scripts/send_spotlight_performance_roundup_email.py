#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))

from utils.email_sender import EmailSender
from utils.specialty_email_policy import specialty_summary_emails_enabled
from utils.summary_email_guard import successful_delivery_exists

from pilot_roundup.scripts.generate_spotlight_performance_roundup import build_report


DEFAULT_RECIPIENTS = ["mlaufhutte@venterraliving.com"]

TEAM_RECIPIENTS = [
    "mlaufhutte@venterraliving.com",
    "sbynum@venterraliving.com",
    "elongoria@venterraliving.com",
    "jadomingue@venterraliving.com",
]

DELIVERY_LOG_DIR = Path("/Users/mark/Property_Analytics/logs/email_delivery/spotlight_performance_roundup")


def display_date(value: str) -> str:
    return datetime.fromisoformat(value).strftime("%m/%d/%Y")


def _plain_text_from_md(md_path: Path) -> str:
    lines: list[str] = []
    for line in md_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# ") or line.startswith("## "):
            continue
        if line.startswith("|"):
            continue
        if line.startswith("- Generated:") or line.startswith("- Report run date:"):
            continue
        if not line.strip():
            continue
        lines.append(line)
        if len(lines) >= 25:
            break
    return "\n".join(lines) if lines else "Spotlight PageSpeed Insights Performance roundup."


def send_spotlight_roundup(
    report_date: Optional[str],
    *,
    recipients: list[str],
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    report_date = report_date or datetime.now().date().isoformat()
    DELIVERY_LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = DELIVERY_LOG_DIR / f"email_delivery_{report_date}.jsonl"

    report_display_date = display_date(report_date)
    base_subject = f"Spotlight PageSpeed Insights Performance - {report_display_date}"
    legacy_subject = f"Spotlight PageSpeed Insights Performance - {report_display_date.replace('/', '-')}"
    already_sent = successful_delivery_exists(log_path, base_subject, alternate_subjects=[legacy_subject])
    subject = base_subject
    correction_note = ""
    if force and already_sent:
        subject = f"CORRECTION: {base_subject}"
        correction_note = (
            "<div style='padding:12px;border:1px solid #fecaca;background:#fff5f5;"
            "font-family:Arial, sans-serif;margin:12px 0;'>"
            "<strong>Correction:</strong> The earlier email sent today contained missing metrics due to an automation "
            "entrypoint issue. This message contains the corrected report.</div>"
        )

    html_path, md_path = build_report(report_date)
    html_body = html_path.read_text(encoding="utf-8")
    if correction_note:
        html_body = html_body.replace("<body>", "<body>" + correction_note, 1)
    plain_text = _plain_text_from_md(md_path)

    print("📤 Sending email...")
    print(f"   To: {', '.join(recipients)}")
    print(f"   Subject: {subject}")
    print(f"   Log: {log_path}")

    if dry_run:
        print("🧪 DRY RUN: generated report but did not send.")
        return True

    if not force and already_sent:
        print(f"✅ Delivery already recorded for {report_display_date}; skipping send.")
        print(f"   Log: {log_path}")
        return True

    if not force and not specialty_summary_emails_enabled():
        print("Spotlight performance roundup email suppressed by policy; report artifact remains available on disk")
        print(f"Report: {html_path}")
        return True

    sender = EmailSender(verbose=True)
    metadata = sender.send_email_with_tracking(
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
        recipients=recipients,
        log_path=log_path,
    )
    print(f"Spotlight PageSpeed Insights Performance sent for {report_display_date}: {metadata.get('message_id')}")
    return bool(metadata.get("success"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Email Spotlight PageSpeed Insights Performance roundup")
    parser.add_argument("--date", help="Report date YYYY-MM-DD; defaults to today")
    parser.add_argument("--force", action="store_true", help="Send even if this subject has already succeeded today")
    parser.add_argument("--dry-run", action="store_true", help="Generate and validate without sending")
    parser.add_argument(
        "--team",
        action="store_true",
        help="Send to the full team distribution (default is Mark only)",
    )
    parser.add_argument(
        "--recipients",
        help="Comma-separated recipients override (default Mark only)",
    )
    args = parser.parse_args()

    recipients = DEFAULT_RECIPIENTS
    if args.team:
        recipients = TEAM_RECIPIENTS
    if args.recipients:
        recipients = [r.strip() for r in str(args.recipients).split(",") if r.strip()]
    ok = send_spotlight_roundup(args.date, recipients=recipients, force=args.force, dry_run=args.dry_run)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
