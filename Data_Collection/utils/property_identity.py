#!/usr/bin/env python3
"""Governed property identity resolver.

This helper is intentionally exact-match only. It resolves source identifiers
through config/property_identity_matrix.json and reports gaps instead of
inventing fuzzy mappings.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MATRIX_PATH = REPO_ROOT / "config" / "property_identity_matrix.json"
DEFAULT_HARVEST_ROOT = REPO_ROOT / "outputs" / "data_warehouse" / "daily_harvest"

STRICT_IDENTIFIER_FIELDS = (
    "property_code",
    "canonical_property_id",
    "display_property_id",
    "ga4_property_id",
    "community_id",
    "gbp_location_id",
)

URL_IDENTIFIER_FIELDS = ("website_url", "gsc_url")
TEXT_IDENTIFIER_FIELDS = (
    "property_name",
    "community_name",
    "encasa_short_name",
    "aliases",
)

SOURCE_ALIASES = {
    "property_cd": "property_code",
    "property_code": "property_code",
    "canonical_property_id": "canonical_property_id",
    "display_property_id": "display_property_id",
    "ga4": "ga4_property_id",
    "ga4_property_id": "ga4_property_id",
    "community_id": "community_id",
    "gbp_location_id": "gbp_location_id",
    "website_url": "website_url",
    "gsc_url": "gsc_url",
    "url_slug": "url_slug",
    "property_name": "property_name",
    "community_name": "community_name",
    "alias": "aliases",
    "aliases": "aliases",
    "name": "property_name",
}


@dataclass(frozen=True)
class PropertyIdentityResult:
    matched: bool
    source: str
    value: str
    reason: str
    canonical_property_id: Optional[str] = None
    property_code: Optional[str] = None
    property_name: Optional[str] = None
    match_key: Optional[str] = None
    ambiguity_count: int = 0
    property_record: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "matched": self.matched,
            "source": self.source,
            "value": self.value,
            "reason": self.reason,
            "canonical_property_id": self.canonical_property_id,
            "property_code": self.property_code,
            "property_name": self.property_name,
            "match_key": self.match_key,
            "ambiguity_count": self.ambiguity_count,
            "property_record": self.property_record,
        }


def normalize_token(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().lower().split())


def normalize_url(value: Any) -> str:
    token = normalize_token(value)
    if token.endswith("/"):
        return token[:-1]
    return token


def _property_label(record: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    return (
        record.get("canonical_property_id"),
        record.get("property_code"),
        record.get("property_name") or record.get("community_name"),
    )


class PropertyIdentityResolver:
    def __init__(self, matrix_path: Path = DEFAULT_MATRIX_PATH):
        self.matrix_path = Path(matrix_path)
        self.matrix = self._load_matrix(self.matrix_path)
        self.properties = self.matrix["properties"]
        self.index: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        self._build_index()

    @staticmethod
    def _load_matrix(matrix_path: Path) -> Dict[str, Any]:
        if not matrix_path.exists():
            raise FileNotFoundError(f"Property identity matrix not found: {matrix_path}")
        with matrix_path.open("r", encoding="utf-8") as f:
            matrix = json.load(f)
        properties = matrix.get("properties")
        if not isinstance(properties, list) or not properties:
            raise ValueError("property_identity_matrix.json must contain a non-empty properties array.")
        return matrix

    def _add(self, field: str, value: Any, record: Dict[str, Any]) -> None:
        if field in URL_IDENTIFIER_FIELDS:
            token = normalize_url(value)
        else:
            token = normalize_token(value)
        if not token:
            return
        self.index.setdefault((field, token), []).append(record)

    def _build_index(self) -> None:
        for record in self.properties:
            for field in STRICT_IDENTIFIER_FIELDS:
                self._add(field, record.get(field), record)
            self._add("url_slug", record.get("url_slug"), record)
            for field in URL_IDENTIFIER_FIELDS:
                self._add(field, record.get(field), record)
            for field in TEXT_IDENTIFIER_FIELDS:
                value = record.get(field)
                if isinstance(value, list):
                    for item in value:
                        self._add(field, item, record)
                else:
                    self._add(field, value, record)

    def resolve(self, source: str, value: Any) -> PropertyIdentityResult:
        raw_value = "" if value is None else str(value).strip()
        source_key = SOURCE_ALIASES.get(source, source)
        if source_key in URL_IDENTIFIER_FIELDS:
            token = normalize_url(raw_value)
        else:
            token = normalize_token(raw_value)

        if not token:
            return PropertyIdentityResult(False, source, raw_value, "blank_value")

        matches = self.index.get((source_key, token), [])
        if not matches:
            return PropertyIdentityResult(False, source, raw_value, "not_found", match_key=source_key)
        if len(matches) > 1:
            return PropertyIdentityResult(
                False,
                source,
                raw_value,
                "ambiguous",
                match_key=source_key,
                ambiguity_count=len(matches),
            )

        record = matches[0]
        canonical_property_id, property_code, property_name = _property_label(record)
        return PropertyIdentityResult(
            True,
            source,
            raw_value,
            "matched",
            canonical_property_id=canonical_property_id,
            property_code=property_code,
            property_name=property_name,
            match_key=source_key,
            ambiguity_count=1,
            property_record=record,
        )

    def active_property_codes(self) -> List[str]:
        return sorted(
            str(record["property_code"])
            for record in self.properties
            if record.get("status") == "active" and record.get("property_code")
        )

    def validate_matrix(self) -> Tuple[List[str], List[str]]:
        errors: List[str] = []
        warnings: List[str] = []
        seen: Dict[Tuple[str, str], str] = {}

        for index, record in enumerate(self.properties, start=1):
            label = record.get("property_name") or record.get("community_name") or f"row {index}"
            if not record.get("canonical_property_id"):
                errors.append(f"{label}: missing canonical_property_id")
            if not record.get("property_name") and not record.get("community_name"):
                errors.append(f"{label}: missing property_name/community_name")
            if not record.get("status"):
                warnings.append(f"{label}: missing status")
            if record.get("status") == "active" and not record.get("property_code"):
                warnings.append(f"{label}: active property has no property_code; must resolve by another identifier")

            for field in STRICT_IDENTIFIER_FIELDS:
                value = normalize_token(record.get(field))
                if not value:
                    continue
                key = (field, value)
                owner = seen.get(key)
                if owner:
                    errors.append(f"duplicate {field}={record.get(field)} for {owner} and {label}")
                else:
                    seen[key] = str(label)

        return errors, warnings


def resolve_property_identity(source: str, value: Any, matrix_path: Path = DEFAULT_MATRIX_PATH) -> PropertyIdentityResult:
    return PropertyIdentityResolver(matrix_path).resolve(source, value)


def load_property_identity_matrix(matrix_path: Path = DEFAULT_MATRIX_PATH) -> Dict[str, Any]:
    return PropertyIdentityResolver._load_matrix(Path(matrix_path))


def latest_harvest_property_funnel(harvest_root: Path = DEFAULT_HARVEST_ROOT) -> Optional[Path]:
    if not harvest_root.exists():
        return None
    candidates = [path for path in harvest_root.glob("*/property_funnel.csv") if path.is_file()]
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def check_harvest_csv(resolver: PropertyIdentityResolver, csv_path: Path) -> Tuple[List[str], int]:
    errors: List[str] = []
    checked = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if "property_cd" not in (reader.fieldnames or []):
            return [f"{csv_path}: missing property_cd column"], checked
        for row in reader:
            checked += 1
            property_cd = (row.get("property_cd") or "").strip()
            result = resolver.resolve("property_code", property_cd)
            if not result.matched:
                name = (row.get("property_name") or "").strip()
                errors.append(f"{csv_path}: unresolved property_cd={property_cd} property_name={name} reason={result.reason}")
    return errors, checked


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Check governed property identity resolution.")
    parser.add_argument("--matrix", type=Path, default=DEFAULT_MATRIX_PATH)
    parser.add_argument("--harvest-csv", type=Path, default=None)
    parser.add_argument("--skip-harvest", action="store_true")
    args = parser.parse_args(list(argv) if argv is not None else None)

    resolver = PropertyIdentityResolver(args.matrix)
    errors, warnings = resolver.validate_matrix()
    checked_rows = 0

    harvest_csv = args.harvest_csv
    if not args.skip_harvest and harvest_csv is None:
        harvest_csv = latest_harvest_property_funnel()

    if harvest_csv:
        harvest_errors, checked_rows = check_harvest_csv(resolver, harvest_csv)
        errors.extend(harvest_errors)
    elif not args.skip_harvest:
        warnings.append("No daily harvest property_funnel.csv found; skipped harvest identity check")

    for warning in warnings:
        print(f"WARN: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(
        "Property identity governance check passed "
        f"({len(resolver.properties)} matrix properties, {checked_rows} harvest rows checked)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
