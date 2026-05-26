#!/usr/bin/env python3
"""Create, validate, ingest, and apply official operating metrics to a Captain Brief.

This wrapper keeps the operating-truth source route concrete for operators:

- copy the drop-ready CSV template into the monitored OneDrive directory
- validate an incoming CSV/XLSX with the canonical ingester
- optionally write local Pond + remote D1 rows
- optionally regenerate the Captain Brief

It intentionally delegates parsing/writes to apps/api/scripts/operating_metrics_to_d1.py.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from datetime import date, datetime
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
TEMPLATE_PATH = ROOT / "docs/contracts/property_operating_metrics_template_AR4PB.csv"
DROP_DIR = Path("/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports")
INGEST_SCRIPT = ROOT / "apps/api/scripts/operating_metrics_to_d1.py"
BRIEF_SCRIPT = ROOT / "reports/captains_log/generate_captains_brief_vnext.py"


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="")
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def create_template(report_date: date) -> Path:
    DROP_DIR.mkdir(parents=True, exist_ok=True)
    target = DROP_DIR / f"Property-Operating-Metrics-AR4PB-{report_date.strftime('%Y%m%d')}.csv"
    shutil.copyfile(TEMPLATE_PATH, target)
    return target


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Official operating metrics intake helper for Captain Briefs.")
    parser.add_argument("--source-file", help="Filled CSV/XLSX/XLSM operating metrics file to validate/ingest.")
    parser.add_argument("--sheet", help="Workbook sheet name for XLSX/XLSM input.")
    parser.add_argument("--property-key", default="AR4PB")
    parser.add_argument("--captain", default="Benton")
    parser.add_argument("--date", default=date.today().isoformat(), help="Brief/report date, YYYY-MM-DD.")
    parser.add_argument("--create-template", action="store_true", help="Copy a blank AR4PB template into the monitored drop.")
    parser.add_argument("--ingest", action="store_true", help="Write the validated source file into the local Pond.")
    parser.add_argument("--remote", action="store_true", help="When ingesting, also mirror the operating metrics row to remote D1.")
    parser.add_argument("--regenerate-brief", action="store_true", help="Regenerate the Captain Brief after validation/ingest.")
    parser.add_argument("--send", action="store_true", help="Send the regenerated Captain Brief email.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generated_date = datetime.strptime(args.date, "%Y-%m-%d").date()

    if args.create_template:
        target = create_template(generated_date)
        print(f"Wrote drop-ready template: {target}")

    if args.source_file:
        ingest_cmd = [
            "python3",
            str(INGEST_SCRIPT),
            "--source-file",
            args.source_file,
            "--property-key",
            args.property_key,
        ]
        if args.sheet:
            ingest_cmd.extend(["--sheet", args.sheet])
        if args.ingest:
            if args.remote:
                ingest_cmd.append("--remote")
        else:
            ingest_cmd.append("--dry-run")

        run(ingest_cmd)
    elif not args.create_template:
        raise SystemExit("Provide --source-file to validate/ingest, or use --create-template.")

    if args.regenerate_brief:
        brief_cmd = [
            "python3",
            str(BRIEF_SCRIPT),
            "--property-key",
            args.property_key,
            "--captain",
            args.captain,
            "--date",
            args.date,
        ]
        if args.send:
            brief_cmd.append("--send")
        run(brief_cmd)


if __name__ == "__main__":
    main()
