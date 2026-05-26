#!/usr/bin/env python3
"""Generate and/or send the latest Pilot Organic New Users WoW report."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import List

import sys

ROOT = Path("/Users/mark/Property_Analytics")
REPORT_ROOT = ROOT / "reports" / "pilot_organic_new_users_wow"
GENERATOR_SCRIPT = ROOT / "scripts" / "generate_pilot_organic_new_users_wow_report.py"

sys.path.insert(0, str(ROOT))
from utils.email_sender import EmailSender  # noqa: E402


def latest_report_dir() -> Path:
    dirs = sorted([p for p in REPORT_ROOT.iterdir() if p.is_dir()])
    if not dirs:
        raise FileNotFoundError(f"No report directories found in {REPORT_ROOT}")
    return dirs[-1]


def generate_latest_report() -> Path:
    result = subprocess.run(
        ["python3", str(GENERATOR_SCRIPT)],
        check=True,
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    payload = json.loads(result.stdout.strip())
    return Path(payload["run_dir"])


def parse_recipients(value: str | None, sender: EmailSender) -> List[str]:
    if value:
        return [email.strip() for email in value.split(",") if email.strip()]
    if sender.default_recipients:
        return sender.default_recipients
    raise ValueError("No recipients specified and no default recipients configured")


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Pilot Organic New Users WoW email")
    parser.add_argument("--report-dir", help="Specific timestamped report directory to send")
    parser.add_argument("--recipients", help="Comma-separated recipient list")
    parser.add_argument(
        "--generate-latest",
        action="store_true",
        help="Generate a fresh report first, then send that output",
    )
    args = parser.parse_args()

    sender = EmailSender(verbose=True)
    if args.generate_latest:
        print("Generating fresh Pilot Organic New Users WoW report...")
        report_dir = generate_latest_report()
    else:
        report_dir = Path(args.report_dir) if args.report_dir else latest_report_dir()

    html_path = report_dir / "pilot_organic_new_users_wow_email_preview.html"
    text_path = report_dir / "pilot_organic_new_users_wow_email.txt"
    workbook_path = report_dir / "pilot_organic_new_users_wow.xlsx"

    for path in (html_path, text_path, workbook_path):
        if not path.exists():
            raise FileNotFoundError(f"Missing report artifact: {path}")

    recipients = parse_recipients(args.recipients, sender)
    html_body = html_path.read_text(encoding="utf-8")
    plain_text = text_path.read_text(encoding="utf-8")

    sender.send_email(
        subject="Pilot Organic New Users WoW | Pilot and Sister Property Pairs",
        html_body=html_body,
        plain_text=plain_text,
        recipients=recipients,
        attachments=[
            (workbook_path.name, workbook_path.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            (html_path.name, html_path.read_bytes(), "text/html"),
        ],
    )

    print(f"EMAIL_SENT_TO: {', '.join(recipients)}")
    print(f"REPORT_DIR: {report_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
