#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))

from utils.email_sender import EmailSender

REPORTS = ROOT / "pilot_control_cwv" / "reports"
STAMP = datetime.now().strftime("%Y-%m-%d")
MATRIX_JSON = REPORTS / f"calais_cross_source_matrix_{STAMP}.json"
WORKBOOK = REPORTS / f"Pilot_Diagnostic_Package_{STAMP}.xlsx"
PREVIEW = REPORTS / f"pilot_diagnostic_email_preview_{STAMP}.html"


def load_payload() -> dict:
    return json.loads(MATRIX_JSON.read_text())


def build_html() -> str:
    return PREVIEW.read_text()


def build_plain_text(payload: dict) -> str:
    return (
        f"Pilot Diagnostic Executive Memo - {STAMP}\n\n"
        "Attached is the executive diagnostic package for Calais Midtown, The District Universal Boulevard, and The Harrison.\n\n"
        "Topline:\n"
        f"- {payload['findings'][0]}\n"
        f"- {payload['findings'][2]}\n"
        f"- {payload['findings'][3]}\n\n"
        f"Attachment: {WORKBOOK.name}\n"
    )


def main() -> int:
    payload = load_payload()
    sender = EmailSender(verbose=True)
    recipients = sender.default_recipients or [sender.sender_email]
    sender.send_email_with_tracking(
        subject=f"Pilot Diagnostic Executive Memo | {datetime.strptime(STAMP, '%Y-%m-%d').strftime('%B %-d, %Y')}",
        html_body=build_html(),
        plain_text=build_plain_text(payload),
        recipients=recipients,
        attachments=[(
            WORKBOOK.name,
            WORKBOOK.read_bytes(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )],
    )
    print(f"Sent diagnostic email to: {', '.join(recipients)}")
    print(f"Workbook: {WORKBOOK}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
