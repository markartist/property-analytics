#!/usr/bin/env python3
"""Validate the governed property identity matrix."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_MATRIX = ROOT / "config" / "property_identity_matrix.json"


def normalize(value: str | None) -> str:
    if not value:
        return ""
    text = value.lower()
    text = re.sub(r"\b(apartments|apartment|at|the)\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def add_duplicate(index: dict[str, list[str]], key: str | None, owner: str) -> None:
    normalized = normalize(key)
    if normalized:
        index[normalized].append(owner)


def main() -> None:
    parser = argparse.ArgumentParser(description="Check config/property_identity_matrix.json.")
    parser.add_argument("--matrix", default=str(DEFAULT_MATRIX))
    args = parser.parse_args()

    matrix = json.loads(Path(args.matrix).read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = matrix.get("properties", [])
    errors: list[str] = []
    warnings: list[str] = []

    for required in ("version", "authority", "canonical_key", "properties"):
        if required not in matrix:
            errors.append(f"Missing top-level field: {required}")

    seen_canonical: dict[str, str] = {}
    seen_ga4: dict[str, str] = {}
    seen_code: dict[str, str] = {}
    alias_index: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        name = row.get("property_name") or "<unnamed>"
        canonical = row.get("canonical_property_id")
        ga4 = row.get("ga4_property_id")
        code = row.get("property_code")
        if not canonical:
            errors.append(f"{name}: missing canonical_property_id")
        if not ga4:
            errors.append(f"{name}: missing ga4_property_id")
        if not row.get("website_url"):
            warnings.append(f"{name}: missing website_url")
        if not row.get("gsc_url"):
            warnings.append(f"{name}: missing gsc_url")
        if canonical in seen_canonical:
            errors.append(f"Duplicate canonical_property_id {canonical}: {seen_canonical[canonical]} / {name}")
        if ga4 and ga4 in seen_ga4:
            errors.append(f"Duplicate ga4_property_id {ga4}: {seen_ga4[ga4]} / {name}")
        if code and code in seen_code:
            errors.append(f"Duplicate property_code {code}: {seen_code[code]} / {name}")
        if canonical:
            seen_canonical[canonical] = name
        if ga4:
            seen_ga4[ga4] = name
        if code:
            seen_code[code] = name
        for alias in [name, row.get("community_name"), row.get("encasa_short_name"), *(row.get("aliases") or [])]:
            add_duplicate(alias_index, alias, str(canonical))

    ambiguous_aliases = {
        alias: sorted(set(owners))
        for alias, owners in alias_index.items()
        if len(set(owners)) > 1 and alias not in {"pointe"}
    }
    for alias, owners in sorted(ambiguous_aliases.items())[:25]:
        warnings.append(f"Ambiguous alias '{alias}' maps to {', '.join(owners)}")

    print(
        json.dumps(
            {
                "properties": len(rows),
                "with_property_code": sum(1 for row in rows if row.get("property_code")),
                "with_community_id": sum(1 for row in rows if row.get("community_id")),
                "errors": errors,
                "warnings": warnings,
            },
            indent=2,
            sort_keys=True,
        )
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
