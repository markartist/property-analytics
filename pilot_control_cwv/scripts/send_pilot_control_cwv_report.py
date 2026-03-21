#!/usr/bin/env python3
"""
Send the pilot/control CWV report email.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
REPORT_DIR = BASE_DIR / "reports"

sys.path.insert(0, str(REPO_ROOT / "utils"))
from email_sender import EmailSender  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Send the pilot/control CWV email report")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--date", default=date.today().isoformat(), help="Report date label")
    args = parser.parse_args()

    config_path = Path(args.config)
    config = json.loads(config_path.read_text())

    html_path = REPORT_DIR / f"Pilot_Control_CWV_Report_{args.date}.html"
    xlsx_path = REPORT_DIR / f"Pilot_Control_CWV_Report_{args.date}.xlsx"
    if not html_path.exists() or not xlsx_path.exists():
        print("Missing report artifacts. Generate the report first.")
        return 1

    sender = EmailSender()
    html_body = html_path.read_text(encoding="utf-8")
    attachments = [
        (
            xlsx_path.name,
            xlsx_path.read_bytes(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    ]
    recipients = config.get("report_recipients") or None
    sender.send_email(
        subject=f"{config['report_name']} - {args.date}",
        html_body=html_body,
        recipients=recipients,
        attachments=attachments,
    )
    print(f"Sent report for {args.date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
