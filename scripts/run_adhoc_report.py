#!/usr/bin/env python3
"""Generate, validate, archive, and optionally email an ad hoc executive report."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT / "utils"))

from adhoc_report_orchestrator import load_request_from_json, run_adhoc_report  # noqa: E402
from adhoc_report_sources import ReportRequest  # noqa: E402


def parse_recipients(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the governed ad hoc executive report generator.")
    parser.add_argument("--subject", help="Natural-language report subject")
    parser.add_argument(
        "--report-type",
        default="auto",
        help=(
            "auto, organic_search_share, ga4_traffic_summary, ils_search_behavior, "
            "content_manager_workup, or content_intelligence_pack (Property Intel Pack)"
        ),
    )
    parser.add_argument(
        "--period",
        default="trailing_30_days",
        choices=["trailing_7_days", "trailing_30_days", "trailing_90_days", "trailing_12_months", "trailing_24_months"],
    )
    parser.add_argument("--start-date", help="Custom start date, YYYY-MM-DD")
    parser.add_argument("--end-date", help="Custom end date, YYYY-MM-DD")
    parser.add_argument("--scope", default="portfolio")
    parser.add_argument("--request-json", help="Structured ReportRequest JSON file")
    parser.add_argument("--email", action="store_true", help="Send through the universal email sender after validation")
    parser.add_argument("--recipients", help="Comma-separated override recipients")
    parser.add_argument("--provider", default="aws_ses", choices=["aws_ses", "gmail", "office365"])
    parser.add_argument("--no-workbook", action="store_true", help="Do not build workbook attachment")
    args = parser.parse_args()

    if args.request_json:
        request = load_request_from_json(Path(args.request_json))
    else:
        if not args.subject:
            parser.error("--subject is required unless --request-json is provided")
        request = ReportRequest(
            subject=args.subject,
            report_type=args.report_type,
            period=args.period,
            start_date=args.start_date,
            end_date=args.end_date,
            scope=args.scope,
            include_workbook=not args.no_workbook,
        )

    result = run_adhoc_report(
        request,
        email=args.email,
        recipients=parse_recipients(args.recipients),
        provider=args.provider,
    )
    print(json.dumps(result, indent=2, ensure_ascii=True))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
