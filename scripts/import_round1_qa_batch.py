#!/usr/bin/env python3
"""Import a portfolio QA property URL list into EVS target JSON.

The source Word doc is treated as the launch-batch authority. The official
workbook is used to reconcile tab coverage, while property identity resolution
uses the governed matrix.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_DOCX = Path("/Users/mark/Downloads/Round 1 QA.docx")
DEFAULT_WORKBOOK = Path("/Users/mark/Downloads/_QA_Round 1_Property_Websites.xlsx")
DEFAULT_OUTPUT = ROOT / "evs/config/round-1-qa-targets.json"
DEFAULT_REPORT = ROOT / "evs/reports/round-1-qa-batch-import.json"
DEFAULT_CONFIRMED_EXTRA_TARGETS = ROOT / "evs/config/round-1-qa-confirmed-extra-targets.json"
DEFAULT_BATCH_ID = "round_1_property_websites"
DEFAULT_ENVIRONMENT = "round_1_kinsta"

sys.path.insert(0, str(ROOT))
from Data_Collection.utils.property_identity import (  # noqa: E402
    normalize_property_key,
    resolve_property_identity,
)

NS_WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS_SHEET = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
URL_PATTERN = re.compile(r"https?://[^\s)]+", re.IGNORECASE)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "property"


def normalize_url(value: str) -> str:
    return str(value or "").strip().rstrip("/") + "/"


def clean_docx_label(value: str) -> str:
    return str(value or "").replace("\xa0", " ").strip(" -—\t: ")


def extract_docx_lines(docx_path: Path) -> list[str]:
    with zipfile.ZipFile(docx_path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    lines: list[str] = []
    for paragraph in root.iter(f"{NS_WORD}p"):
        parts: list[str] = []
        for node in paragraph.iter():
            if node.tag == f"{NS_WORD}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{NS_WORD}br":
                parts.append("\n")
        for line in "".join(parts).splitlines():
            cleaned = line.strip()
            if cleaned:
                lines.append(cleaned)
    return lines


def parse_docx_targets(docx_path: Path) -> list[dict[str, str]]:
    targets: list[dict[str, str]] = []
    current_name = ""
    for line in extract_docx_lines(docx_path):
        match = URL_PATTERN.search(line)
        if not match:
            if not re.search(r"please see|julie's email|juli[e’']s email", line, re.IGNORECASE):
                current_name = line.strip()
            continue
        label = clean_docx_label(line[: match.start()])
        if re.match(r"pastel$", label, re.IGNORECASE):
            continue
        if label and not re.match(r"staging$", label, re.IGNORECASE):
            name = label
        elif current_name:
            name = current_name
        else:
            name = ""
        url = normalize_url(match.group(0))
        if not name:
            name = slugify(url)
        targets.append({"input_name": name, "target_url": url})
    return targets


def load_confirmed_extra_targets(extra_targets_path: Path) -> list[dict[str, str]]:
    if not extra_targets_path.exists():
        return []
    payload = json.loads(extra_targets_path.read_text(encoding="utf-8"))
    raw_targets = payload.get("targets", payload if isinstance(payload, list) else [])
    targets: list[dict[str, str]] = []
    for raw in raw_targets:
        name = str(raw.get("input_name") or raw.get("property_name") or "").strip()
        url = str(raw.get("target_url") or "").strip()
        if not name or not url:
            continue
        targets.append(
            {
                "input_name": name,
                "target_url": normalize_url(url),
                "source": str(extra_targets_path),
            }
        )
    return targets


def workbook_sheet_names(workbook_path: Path) -> list[str]:
    with zipfile.ZipFile(workbook_path) as archive:
        xml = archive.read("xl/workbook.xml")
    root = ET.fromstring(xml)
    return [sheet.attrib["name"] for sheet in root.iter(f"{NS_SHEET}sheet")]


def find_workbook_sheet(
    input_name: str,
    identity_name: str | None,
    workbook_sheets: list[str],
) -> str | None:
    property_sheets = workbook_sheets[1:]
    lookup = {normalize_property_key(sheet): sheet for sheet in property_sheets}
    candidates = [input_name, identity_name or ""]
    for candidate in candidates:
        key = normalize_property_key(candidate)
        if key in lookup:
            return lookup[key]
    candidate_keys = [normalize_property_key(candidate) for candidate in candidates if candidate]
    for key in candidate_keys:
        matches = [
            sheet
            for sheet in property_sheets
            if key and (key in normalize_property_key(sheet) or normalize_property_key(sheet) in key)
        ]
        if len(matches) == 1:
            return matches[0]
    return None


def build_targets(
    docx_path: Path,
    workbook_path: Path | None,
    extra_targets_path: Path,
    batch_id: str,
    environment: str,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    raw_targets = parse_docx_targets(docx_path)
    confirmed_extra_targets = load_confirmed_extra_targets(extra_targets_path)
    seen_target_keys = {
        (normalize_property_key(target["input_name"]), normalize_url(target["target_url"]))
        for target in raw_targets
    }
    for extra in confirmed_extra_targets:
        key = (normalize_property_key(extra["input_name"]), normalize_url(extra["target_url"]))
        if key not in seen_target_keys:
            raw_targets.append(extra)
            seen_target_keys.add(key)
    sheets = workbook_sheet_names(workbook_path) if workbook_path else []
    used_sheets: set[str] = set()
    targets: list[dict[str, object]] = []
    warnings: list[str] = []

    for index, raw in enumerate(raw_targets, start=1):
        identity = resolve_property_identity(raw["input_name"])
        if not identity:
            warnings.append(f"No governed identity match for {raw['input_name']!r}.")
        sheet = find_workbook_sheet(raw["input_name"], identity.property_name if identity else None, sheets) if sheets else None
        if sheet:
            used_sheets.add(sheet)
        elif sheets:
            warnings.append(f"No workbook property tab match for {raw['input_name']!r}.")
        property_id = identity.canonical_property_id if identity else slugify(raw["input_name"])
        targets.append(
            {
                "property_id": property_id,
                "property_name": identity.property_name if identity else raw["input_name"],
                "property_code": identity.property_code if identity else None,
                "target_url": raw["target_url"],
                "environment": environment,
                "metadata": {
                    "batch_id": batch_id,
                    "batch_order": index,
                    "input_name": raw["input_name"],
                    "official_workbook_sheet": sheet,
                    "source_docx": str(docx_path),
                    "source_extra_targets": raw.get("source"),
                    "official_workbook": str(workbook_path) if workbook_path else None,
                    "identity_match_source": "property_identity_matrix" if identity else "unresolved",
                    "canonical_website_url": identity.website_url if identity else None,
                    "property_code": identity.property_code if identity else None,
                    "community_id": identity.community_id if identity else None,
                },
            }
        )

    workbook_property_sheets = sheets[1:] if sheets else []
    missing_from_doc = [sheet for sheet in workbook_property_sheets if sheet not in used_sheets]
    if missing_from_doc:
        warnings.append(
            "Workbook tabs not present in source Word doc: " + ", ".join(missing_from_doc)
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_docx": str(docx_path),
        "confirmed_extra_targets": str(extra_targets_path),
        "confirmed_extra_target_count": len(confirmed_extra_targets),
        "official_workbook": str(workbook_path) if workbook_path else None,
        "batch_id": batch_id,
        "environment": environment,
        "target_count": len(targets),
        "workbook_property_tab_count": len(workbook_property_sheets),
        "warnings": warnings,
        "missing_workbook_tabs_from_docx": missing_from_doc,
        "targets": targets,
    }
    return targets, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docx", type=Path, default=DEFAULT_DOCX)
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--skip-workbook-reconcile", action="store_true")
    parser.add_argument("--extra-targets", type=Path, default=DEFAULT_CONFIRMED_EXTRA_TARGETS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--batch-id", default=DEFAULT_BATCH_ID)
    parser.add_argument("--environment", default=DEFAULT_ENVIRONMENT)
    args = parser.parse_args()

    workbook_path = None if args.skip_workbook_reconcile else args.workbook
    targets, report = build_targets(args.docx, workbook_path, args.extra_targets, args.batch_id, args.environment)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(targets, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "report": str(args.report),
                "target_count": report["target_count"],
                "warnings": report["warnings"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
