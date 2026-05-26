#!/usr/bin/env python3
"""
Compatibility shim for the retired standalone daily health summary email.

The canonical daily summary email is now the Morning Full Portfolio Report.
Legacy callers of this entrypoint are transparently routed there so we do not
reintroduce a second overlapping summary stream.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compatibility wrapper for daily summary email delivery")
    parser.add_argument("--date", help="Report date (YYYY-MM-DD), defaults to today")
    parser.add_argument("--dry-run", action="store_true", help="Validate routing without sending")
    parser.add_argument("--force", action="store_true", help="Bypass duplicate-send protection in the canonical sender")
    args = parser.parse_args()

    command = [sys.executable, str(ROOT / "send_morning_full_report.py")]
    if args.date:
        command.extend(["--date", args.date])
    if args.dry_run:
        command.append("--dry-run")
    if args.force:
        command.append("--force")

    print("Legacy daily health email path redirected to canonical Morning Full summary sender", flush=True)
    print(f"Command: {' '.join(command)}", flush=True)
    result = subprocess.run(command, cwd=ROOT)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
