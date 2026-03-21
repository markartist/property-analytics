#!/usr/bin/env python3
"""
Run the full daily pilot/control CWV workflow:
1. Collect PSI for the configured cohort
2. Generate the dedicated report
3. Email the report
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"


def run_step(cmd: list[str]) -> None:
    print("\n>", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the full pilot/control CWV daily workflow")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--date", default=date.today().isoformat(), help="Metric/report date label")
    parser.add_argument("--skip-send", action="store_true", help="Collect and generate, but skip email send")
    parser.add_argument(
        "--strategies",
        nargs="+",
        default=["mobile"],
        choices=["mobile", "desktop"],
        help="PSI strategies to collect for the daily workflow",
    )
    args = parser.parse_args()

    run_step(
        [
            sys.executable,
            str(BASE_DIR / "scripts" / "collect_pilot_control_psi.py"),
            "--config",
            args.config,
            "--date",
            args.date,
            "--strategies",
            *args.strategies,
        ]
    )
    run_step(
        [
            sys.executable,
            str(BASE_DIR / "scripts" / "validate_pilot_control_psi.py"),
            "--config",
            args.config,
            "--date",
            args.date,
            "--strategies",
            *args.strategies,
        ]
    )
    run_step([sys.executable, str(BASE_DIR / "scripts" / "generate_pilot_control_cwv_report.py"), "--config", args.config, "--date", args.date])
    if not args.skip_send:
        run_step([sys.executable, str(BASE_DIR / "scripts" / "send_pilot_control_cwv_report.py"), "--config", args.config, "--date", args.date])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
