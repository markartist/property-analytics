#!/usr/bin/env python3
"""CLI wrapper for the Outlook email safety validator."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "utils"))

from outlook_email_validator import validate_outlook_email_file  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an Outlook-safe executive report HTML file.")
    parser.add_argument("html_path", help="HTML file to validate")
    parser.add_argument("--max-width", type=int, default=720, help="Maximum allowed email width in pixels")
    parser.add_argument("--json", action="store_true", help="Print full JSON validation result")
    args = parser.parse_args()

    result = validate_outlook_email_file(Path(args.html_path), max_width_px=args.max_width)
    if args.json:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=True))
    elif result.passed:
        print("Outlook email safety check passed.")
    else:
        print("Outlook email safety check failed.")
        for error in result.errors:
            print(f"- {error}")
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
