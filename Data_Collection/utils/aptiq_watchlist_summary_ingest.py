#!/usr/bin/env python3
"""Ingest AptIQ / ApartmentIQ-style watchlist summary PDFs.

The summaries are advisory market/recovery evidence for Captain Brief work. They
do not override source-of-record operating metrics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from pypdf import PdfReader

try:
    from Data_Collection.utils.property_identity import resolve_property_identity
except ModuleNotFoundError:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from Data_Collection.utils.property_identity import resolve_property_identity


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0044_create_aptiq_watchlist_summaries.sql"
DEFAULT_SOURCE_DIR = Path("/Users/mark/Downloads/watchlist")


@dataclass
class AptiqIngestResult:
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    summaries_upserted: int = 0
    pages_upserted: int = 0
    ocr_files: int = 0
    unmapped_files: list[str] = field(default_factory=list)
    source_files: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def clean_text(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value.replace("\xa0", " ")).strip()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_date_phrase(value: str) -> str | None:
    try:
        return datetime.strptime(value.strip(), "%B %d, %Y").date().isoformat()
    except ValueError:
        try:
            return datetime.strptime(value.strip(), "%b %d, %Y").date().isoformat()
        except ValueError:
            return None


def parse_created_dates(text: str) -> tuple[str | None, str | None]:
    created = None
    through = None
    match = re.search(r"Created:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})", text)
    if match:
        created = parse_date_phrase(match.group(1))
    match = re.search(r"Data through\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})", text)
    if match:
        through = parse_date_phrase(match.group(1))
    return created, through


def extract_section(text: str, start: str, stops: list[str]) -> str | None:
    start_match = re.search(re.escape(start), text, flags=re.IGNORECASE)
    if not start_match:
        return None
    end_index = len(text)
    for stop in stops:
        stop_match = re.search(re.escape(stop), text[start_match.end():], flags=re.IGNORECASE)
        if stop_match:
            end_index = min(end_index, start_match.end() + stop_match.start())
    section = clean_text(text[start_match.end():end_index])
    return section or None


def filename_property_label(path: Path) -> str:
    return re.sub(r"\s+Summary$", "", path.stem, flags=re.IGNORECASE).strip()


def report_title(text: str) -> str | None:
    for line in text.splitlines():
        line = clean_text(line)
        if line:
            return line[:220]
    return None


def title_property_label(text: str, path: Path) -> str:
    match = re.search(r"Operational Performance Report\s+[—-]\s+(.+)", text)
    if match:
        label = clean_text(match.group(1).splitlines()[0])
        if label:
            return label
    return filename_property_label(path)


METRIC_NAMES = [
    "Leased %",
    "Exposure",
    "Available Units",
    "Vacant Units",
    "Leasing Velocity (7 days)",
    "Leasing Velocity (30 days)",
    "Average Rent",
    "Net Effective Rent",
    "Concession Rate",
    "Avg Days on Market (1BR)",
    "Avg Days on Market (2BR)",
    "Avg Days on Market (3BR)",
    "Application Cancellation Rate (30d)",
    "Applications (30 days)",
]


def parse_metrics(text: str) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    normalized = re.sub(r"\s+", " ", text)
    for metric in METRIC_NAMES:
        pattern = re.escape(metric).replace(r"\ ", r"\s+")
        match = re.search(pattern + r"\s+([^|]{1,90}?)(?=\s+(?:" + "|".join(re.escape(m) for m in METRIC_NAMES) + r")\s+|$)", normalized)
        if match:
            metrics[metric] = clean_text(match.group(1))

    metric_lines = []
    in_metrics = False
    for raw_line in text.splitlines():
        line = clean_text(raw_line)
        if not line:
            continue
        if line.lower().startswith("metrics overview"):
            in_metrics = True
            continue
        if in_metrics and re.search(r"^(recommend|action|competitive|pricing|conclusion|appendix|source)", line, re.I):
            break
        if in_metrics:
            metric_lines.append(line)
    if metric_lines:
        metrics["_metric_lines"] = metric_lines[:80]
    return metrics


def extract_pdf_text(path: Path, use_ocr: bool = True) -> tuple[list[dict[str, str]], bool]:
    reader = PdfReader(str(path))
    pages: list[dict[str, str]] = []
    needs_ocr = False
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except TypeError:
            text = page.extract_text() or ""
        if len(text.strip()) < 50:
            needs_ocr = True
        pages.append({"page_number": index, "page_text": text, "method": "pdf_text"})

    if not needs_ocr or not use_ocr:
        return pages, False

    if not shutil.which("pdftoppm") or not shutil.which("tesseract"):
        return pages, False

    with tempfile.TemporaryDirectory(prefix="aptiq_ocr_") as tmp:
        prefix = str(Path(tmp) / "page")
        subprocess.run(["pdftoppm", "-r", "170", "-png", str(path), prefix], check=True, capture_output=True)
        images = sorted(Path(tmp).glob("page-*.png"))
        ocr_pages: list[dict[str, str]] = []
        for index, image in enumerate(images, start=1):
            result = subprocess.run(
                ["tesseract", str(image), "stdout", "--psm", "6"],
                check=False,
                capture_output=True,
                text=True,
            )
            text = result.stdout if result.returncode == 0 else ""
            ocr_pages.append({"page_number": index, "page_text": text, "method": "ocr"})
        if sum(len(page["page_text"].strip()) for page in ocr_pages) > sum(len(page["page_text"].strip()) for page in pages):
            return ocr_pages, True
    return pages, False


def ensure_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))


def upsert_rows(conn: sqlite3.Connection, table: str, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    columns = list(rows[0].keys())
    placeholders = ", ".join("?" for _ in columns)
    conn.executemany(
        f"INSERT OR REPLACE INTO {table} ({', '.join(columns)}) VALUES ({placeholders})",
        [[row.get(column) for column in columns] for row in rows],
    )
    return len(rows)


def parse_summary(path: Path, use_ocr: bool = True) -> tuple[dict[str, Any], list[dict[str, Any]], bool, bool]:
    source_sha = sha256_file(path)
    pages, ocr_used = extract_pdf_text(path, use_ocr=use_ocr)
    full_text = "\n".join(page["page_text"] for page in pages)
    created_date, data_through_date = parse_created_dates(full_text)
    report_date = data_through_date or created_date or datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
    # Use the file label as the identity anchor. Several OCR'd AptIQ PDFs have
    # truncated first-line titles, and the filename is the controlled operator
    # label supplied with the packet.
    label = filename_property_label(path)
    pdf_label = title_property_label(full_text, path)
    identity = resolve_property_identity(label) or resolve_property_identity(pdf_label)
    mapped = identity.as_mapping() if identity else {}
    summary_id = f"aptiq_watchlist_{report_date.replace('-', '')}_{slug(label)}_{source_sha[:10]}"
    executive = extract_section(full_text, "Executive Summary", ["Key Insights", "Metrics Overview"])
    insights = extract_section(full_text, "Key Insights", ["Metrics Overview", "Recommendations", "Recommended Actions"])
    recommendations = extract_section(full_text, "Recommendations", ["Appendix", "Sources"]) or extract_section(
        full_text, "Recommended Actions", ["Appendix", "Sources"]
    )
    metrics = parse_metrics(full_text)
    summary = {
        "id": summary_id,
        "report_date": report_date,
        "data_through_date": data_through_date,
        "property_label": label,
        "property_id": mapped.get("property_id"),
        "community_id": mapped.get("community_id"),
        "source_file": str(path.resolve()),
        "source_sha256": source_sha,
        "page_count": len(pages),
        "report_title": report_title(full_text),
        "executive_summary": executive,
        "key_insights": insights,
        "recommendations": recommendations,
        "metrics_json": json.dumps(metrics, sort_keys=True),
        "ocr_used": 1 if ocr_used else 0,
        "extraction_status": "mapped" if mapped else "unmapped",
        "evidence_json": json.dumps({"identity": mapped, "filename_label": label, "pdf_label": pdf_label}, sort_keys=True),
    }
    page_rows = [
        {
            "id": f"aptiq_watchlist_page_{summary_id}_{int(page['page_number']):02d}",
            "summary_id": summary_id,
            "report_date": report_date,
            "property_id": mapped.get("property_id"),
            "page_number": int(page["page_number"]),
            "page_title": report_title(page["page_text"]),
            "page_text": page["page_text"],
            "extraction_method": page["method"],
        }
        for page in pages
    ]
    return summary, page_rows, ocr_used, bool(mapped)


def discover_files(source_dir: Path = DEFAULT_SOURCE_DIR) -> list[Path]:
    return sorted(path for path in source_dir.glob("*.pdf") if path.is_file())


def ingest(db_path: Path = DB_PATH, files: list[Path] | None = None, source_dir: Path = DEFAULT_SOURCE_DIR, use_ocr: bool = True) -> AptiqIngestResult:
    selected = [path.expanduser().resolve() for path in files] if files else discover_files(source_dir)
    result = AptiqIngestResult(files_found=len(selected))
    with sqlite3.connect(str(db_path)) as conn:
        ensure_tables(conn)
        for path in selected:
            try:
                summary, pages, ocr_used, mapped = parse_summary(path, use_ocr=use_ocr)
                upsert_rows(conn, "aptiq_watchlist_summaries", [summary])
                result.pages_upserted += upsert_rows(conn, "aptiq_watchlist_summary_pages", pages)
                result.summaries_upserted += 1
                result.files_processed += 1
                result.ocr_files += 1 if ocr_used else 0
                result.source_files.append(str(path))
                if not mapped:
                    result.unmapped_files.append(str(path))
            except Exception as exc:
                result.files_failed += 1
                result.errors.append(f"{path}: {exc}")
        conn.commit()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest AptIQ watchlist summary PDFs.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--source-dir", default=str(DEFAULT_SOURCE_DIR))
    parser.add_argument("--source", action="append")
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    files = [Path(value) for value in args.source] if args.source else None
    if args.dry_run:
        parsed = []
        for path in files or discover_files(Path(args.source_dir)):
            summary, pages, ocr_used, mapped = parse_summary(path, use_ocr=not args.no_ocr)
            parsed.append(
                {
                    "source_file": str(path),
                    "property_label": summary["property_label"],
                    "property_id": summary["property_id"],
                    "report_date": summary["report_date"],
                    "pages": len(pages),
                    "ocr_used": ocr_used,
                    "mapped": mapped,
                    "executive_summary_chars": len(summary.get("executive_summary") or ""),
                    "metrics_count": len(json.loads(summary.get("metrics_json") or "{}")),
                }
            )
        print(json.dumps({"files_found": len(parsed), "parsed": parsed}, indent=2, sort_keys=True))
        return
    result = ingest(
        db_path=Path(args.db).expanduser().resolve(),
        files=files,
        source_dir=Path(args.source_dir).expanduser().resolve(),
        use_ocr=not args.no_ocr,
    )
    print(json.dumps(result.__dict__, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
