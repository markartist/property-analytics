#!/usr/bin/env python3
"""Prepare the first-batch performance baseline queue.

This script does not run PageSpeed or change any property configuration. It
creates a clear queue of mobile and desktop measurements to capture before the
Wednesday launch approval.
"""

from __future__ import annotations

import csv
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
READINESS_ROOT = ROOT / "reports/resi_edge_performance/wednesday-readiness"
PREFLIGHT_ROOT = ROOT / "reports/resi_edge_performance/phase2-preflight"
OUT_ROOT = ROOT / "reports/resi_edge_performance/performance-baseline-queue"
IDENTITY_PATH = ROOT / "config/property_identity_matrix.json"


def latest_file(root: Path, name: str) -> Path:
    matches = sorted(root.glob(f"*/{name}"))
    if not matches:
        raise FileNotFoundError(f"No {name} found under {root}")
    return matches[-1]


def current_url_from_name(name: str) -> str:
    slug = (
        name.lower()
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
    )
    slug = "-".join(part for part in slug.split() if part)
    return f"https://venterraliving.com/apartments/{slug}/"


def index_by_code(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("property_code")): row for row in rows if row.get("property_code")}


def load_identities() -> dict[str, dict[str, Any]]:
    payload = json.loads(IDENTITY_PATH.read_text(encoding="utf-8"))
    return {
        str(row.get("property_code") or row.get("canonical_property_id")): row
        for row in payload.get("properties", [])
        if row.get("property_code") or row.get("canonical_property_id")
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--include-final-vanity",
        action="store_true",
        help="Include final vanity URL PSI captures. Pre-switch defaults to legacy + Kinsta only because vanity URLs may redirect to legacy.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    readiness_path = latest_file(READINESS_ROOT, "wednesday-readiness-queue.json")
    preflight_path = latest_file(PREFLIGHT_ROOT, "phase-preflight.json")
    readiness = json.loads(readiness_path.read_text(encoding="utf-8"))
    preflight = json.loads(preflight_path.read_text(encoding="utf-8"))
    preflight_by_code = index_by_code(preflight.get("properties", []))
    identities = load_identities()
    generated_at = datetime.now(timezone.utc)
    run_dir = OUT_ROOT / f"performance-baseline-queue-{generated_at.strftime('%Y%m%dT%H%M%SZ')}"
    run_dir.mkdir(parents=True, exist_ok=True)

    queue: list[dict[str, Any]] = []
    for row in readiness["rows"]:
        code = row["property_code"]
        identity = identities.get(code, {})
        preflight_row = preflight_by_code.get(code, {})
        current_url = identity.get("website_url") or identity.get("gsc_url") or current_url_from_name(row["property_name"])
        staging_url = preflight_row.get("staging_kinsta_url")
        new_url = f"https://{row['vanity_domain']}/"
        targets = [
            ("legacy Venterra URL", current_url),
            ("staging Kinsta URL", staging_url),
        ]
        if args.include_final_vanity:
            targets.append(("final vanity URL", new_url))
        for target_label, url in targets:
            if not url:
                continue
            for strategy in ("mobile", "desktop"):
                queue.append(
                    {
                        "property_code": row["property_code"],
                        "property_name": row["property_name"],
                        "vanity_domain": row["vanity_domain"],
                        "target_label": target_label,
                        "url": url,
                        "strategy": strategy,
                        "status": "queued",
                        "score": "",
                        "largest_contentful_paint": "",
                        "cumulative_layout_shift": "",
                        "interaction_to_next_paint": "",
                        "total_blocking_time": "",
                        "notes": "Fresh launch baseline capture before approval; repeat after public move.",
                    }
                )

    payload = {
        "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
        "generated_at_human": generated_at.astimezone().strftime("%m/%d/%Y %I:%M %p"),
        "mutations_performed": False,
        "source": str(readiness_path.relative_to(ROOT)),
        "sources": {
            "readiness": str(readiness_path.relative_to(ROOT)),
            "preflight": str(preflight_path.relative_to(ROOT)),
            "property_identity_matrix": str(IDENTITY_PATH.relative_to(ROOT)),
        },
        "summary": {
            "properties": len(readiness["rows"]),
            "measurements_queued": len(queue),
            "mobile_measurements": sum(1 for item in queue if item["strategy"] == "mobile"),
            "desktop_measurements": sum(1 for item in queue if item["strategy"] == "desktop"),
            "targets_per_property": 6 if args.include_final_vanity else 4,
            "final_vanity_included": bool(args.include_final_vanity),
            "final_vanity_status": "queued" if args.include_final_vanity else "held_until_switch",
        },
        "queue": queue,
    }

    (run_dir / "performance-baseline-queue.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    with (run_dir / "performance-baseline-queue.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, list(queue[0].keys()))
        writer.writeheader()
        writer.writerows(queue)
    (run_dir / "PERFORMANCE_BASELINE_QUEUE.md").write_text(
        "\n".join(
            [
                "# Resi Edge Performance Baseline Queue",
                "",
                f"Generated: {payload['generated_at_human']}",
                "",
                "## Summary",
                "",
                f"- Properties: {payload['summary']['properties']}",
                f"- Measurements queued: {payload['summary']['measurements_queued']}",
                f"- Mobile measurements: {payload['summary']['mobile_measurements']}",
                f"- Desktop measurements: {payload['summary']['desktop_measurements']}",
                "",
                "## Launch Use",
                "",
                "- Capture legacy Venterra URL and staging Kinsta URL before approval.",
                "- Hold final vanity URL PSI until switch because pre-switch vanity URLs may redirect to the legacy experience.",
                "- Capture final vanity URL after the public move.",
                "- Stop and discuss if any result is unavailable or materially below expected posture.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    (OUT_ROOT / "latest.json").write_text(json.dumps({"latest": str(run_dir.relative_to(ROOT))}, indent=2) + "\n", encoding="utf-8")
    print(run_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
