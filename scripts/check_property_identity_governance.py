#!/usr/bin/env python3
"""Governance check for unified property identity usage."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
MATRIX = ROOT / "config" / "property_identity_matrix.json"

REQUIRED_RESOLVER_USERS = [
    ROOT / "Data_Collection" / "utils" / "available_unit_interest_ingest.py",
    ROOT / "Data_Collection" / "utils" / "dataforseo_serp_ingest.py",
    ROOT / "Data_Collection" / "utils" / "marketing_bi_conversion_ingest.py",
    ROOT / "Data_Collection" / "utils" / "marketing_bi_packet_ingest.py",
    ROOT / "apps" / "api" / "scripts" / "captain_sources_to_d1.py",
    ROOT / "apps" / "api" / "scripts" / "operating_metrics_to_d1.py",
]

FORBIDDEN_TOKENS = [
    "DEFAULT_PROPERTY_MAP",
    "DEFAULT_PROPERTY_CODE = \"AR4PB\"",
    "DEFAULT_COMMUNITY_ID = \"5d2b4e24-d6cb-42ba-8aa2-adfd7c81d440\"",
]

SCAN_ROOTS = [
    ROOT / "Data_Collection",
    ROOT / "apps" / "api" / "scripts",
]

EXCLUDED_PARTS = {
    "__pycache__",
    "generated",
}


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def run_validator() -> dict:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_property_identity_matrix.py")],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)
    return json.loads(result.stdout)


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for root in SCAN_ROOTS:
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in {".py", ".ts", ".tsx", ".js", ".mjs"}:
                continue
            if any(part in EXCLUDED_PARTS for part in path.parts):
                continue
            files.append(path)
    return files


def main() -> None:
    if not MATRIX.exists():
        build = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_property_identity_matrix.py")],
            cwd=str(ROOT),
            text=True,
            capture_output=True,
        )
        if build.returncode != 0:
            print(build.stdout)
            print(build.stderr, file=sys.stderr)
            fail(f"Missing property identity matrix and rebuild failed: {MATRIX}")

    summary = run_validator()
    if summary.get("errors"):
        fail("Property identity matrix has validation errors.")
    if summary.get("with_community_id") != summary.get("properties"):
        fail(
            "Property identity matrix is missing community_id coverage: "
            f"{summary.get('with_community_id')} of {summary.get('properties')}"
        )
    rows = json.loads(MATRIX.read_text(encoding="utf-8")).get("properties", [])
    with_location = sum(1 for row in rows if row.get("city") and row.get("state"))
    if with_location != summary.get("properties"):
        fail(
            "Property identity matrix is missing city/state coverage: "
            f"{with_location} of {summary.get('properties')}"
        )

    missing_resolver = [
        str(path.relative_to(ROOT))
        for path in REQUIRED_RESOLVER_USERS
        if "resolve_property_identity" not in path.read_text(encoding="utf-8")
    ]
    if missing_resolver:
        fail("Required files do not use resolve_property_identity():\n" + "\n".join(missing_resolver))

    forbidden_hits: list[str] = []
    for path in iter_source_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for token in FORBIDDEN_TOKENS:
            if token in text:
                forbidden_hits.append(f"{path.relative_to(ROOT)}: {token}")
    if forbidden_hits:
        fail("Forbidden local property identity defaults found:\n" + "\n".join(forbidden_hits))

    print(
        json.dumps(
            {
                "status": "passed",
                "properties": summary.get("properties"),
                "with_property_code": summary.get("with_property_code"),
                "with_community_id": summary.get("with_community_id"),
                "with_city_state": with_location,
                "required_resolver_users": len(REQUIRED_RESOLVER_USERS),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
