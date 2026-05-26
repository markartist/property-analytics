#!/usr/bin/env python3
"""Ingest the daily Marketing BI portfolio packet for Captain Brief grounding."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
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
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0031_create_marketing_bi_daily_packets.sql"
CONVERSION_SUMMARY_MIGRATION_SQL = (
    ROOT / "apps" / "api" / "migrations" / "0034_create_marketing_bi_conversion_summary.sql"
)
DEFAULT_SEARCH_DIRS = [
    Path("/Users/mark/Library/CloudStorage/OneDrive-VenterraRealty(Canada)Inc/Guest_Card_Reports"),
    Path("/Users/mark/Downloads"),
]
DEFAULT_FILENAME_PATTERNS = (
    "*Conversion_Dashboard*.pdf",
    "*Marketing BI 2.0*.pdf",
    "*Marketing_BI*.pdf",
)

CONVERSION_SUMMARY_COLUMNS = [
    "guest_cards_paid",
    "visits_paid",
    "applications_paid",
    "leases_paid",
    "guest_cards_all",
    "visits_all",
    "applications_all",
    "leases_all",
    "cost_per_guest_card_paid",
    "cost_per_visit_paid",
    "cost_per_application_paid",
    "cost_per_lease_paid",
    "cost_per_guest_card_all",
    "cost_per_visit_all",
    "cost_per_application_all",
    "cost_per_lease_all",
    "ad_spend_total",
    "ad_spend_traditional",
    "ad_spend_social",
    "ad_spend_google",
    "ad_spend_social_pct",
    "ad_spend_per_door",
]


@dataclass
class MarketingBiPacketIngestResult:
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    files_skipped: int = 0
    packets_upserted: int = 0
    pages_upserted: int = 0
    property_rows_upserted: int = 0
    conversion_summary_rows_upserted: int = 0
    report_dates: list[str] = field(default_factory=list)
    source_files: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_pdf_creation_date(raw: str | None) -> str | None:
    if not raw:
        return None
    match = re.search(r"D:(\d{4})(\d{2})(\d{2})", raw)
    if not match:
        return None
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def parse_display_date(value: str) -> str | None:
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", value)
    if not match:
        return None
    month, day, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    text = value.replace(",", "").strip()
    if not text:
        return None
    return int(text)


def parse_money(value: str | None) -> float | None:
    if value is None:
        return None
    text = value.replace("$", "").replace(",", "").strip()
    if not text:
        return None
    return float(text)


def parse_pct(value: str | None) -> float | None:
    if value is None:
        return None
    text = value.replace("%", "").strip()
    if not text:
        return None
    return float(text)


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def clean_line(line: str) -> str:
    return (
        line.replace("\uf166", " ")
        .replace("\uf164", " ")
        .replace("\uf165", " ")
        .replace("\ue102", " ")
        .replace("\xa0", " ")
        .strip()
    )


def split_line(line: str) -> list[str]:
    return [part.strip() for part in re.split(r"\s{2,}", clean_line(line)) if part.strip()]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_calendar_period(value: str) -> str:
    if value.lower() == "total":
        return "total"
    parsed = datetime.strptime(value, "%m/%d/%Y").date()
    return parsed.isoformat()


def discover_packet_files(search_dirs: list[Path] | None = None) -> list[Path]:
    candidates: dict[Path, float] = {}
    for directory in search_dirs or DEFAULT_SEARCH_DIRS:
        if not directory.exists():
            continue
        for pattern in DEFAULT_FILENAME_PATTERNS:
            for path in directory.glob(pattern):
                if path.is_file() and path.suffix.lower() == ".pdf":
                    candidates[path.resolve()] = path.stat().st_mtime
    return [path for path, _ in sorted(candidates.items(), key=lambda item: item[1], reverse=True)]


def extract_page_title(text: str) -> str | None:
    for line in text.splitlines():
        cleaned = clean_line(line)
        if cleaned and len(cleaned) > 3:
            return re.sub(r"\s+", " ", cleaned)[:180]
    return None


def extract_period(text: str) -> tuple[str | None, str | None]:
    match = re.search(r"Selected period:\s*(\d{1,2}/\d{1,2}/\d{4})\s+to\s+(\d{1,2}/\d{1,2}/\d{4})", text)
    if not match:
        return None, None
    return parse_display_date(match.group(1)), parse_display_date(match.group(2))


def extract_traffic_data_as_of(text: str) -> str | None:
    match = re.search(r"Traffic Data As Of:\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})", text)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%b %d, %Y").date().isoformat()
    except ValueError:
        return None


def parse_property_summary_rows(
    packet_id: str,
    report_date: str,
    traffic_data_as_of: str | None,
    source_file: str,
    page_text: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw_line in page_text.splitlines():
        line = clean_line(raw_line)
        match = re.match(
            r"^(?P<region>[A-Za-z][A-Za-z ,.]+?)\s{2,}(?P<property>.+?)\s{2,}(?P<apartments>[\d,]+)\s+(?P<acquired>\d{4}-\d{2}-\d{2})\s+(?P<year>\d{4})\b",
            line,
        )
        if not match:
            continue
        property_name = match.group("property").strip()
        identity = resolve_property_identity(property_name)
        mapped = identity.as_mapping() if identity else {}
        evidence = {"raw_line": line}
        rows.append(
            {
                "id": f"property_summary_{packet_id}_{slug(match.group('region'))}_{slug(property_name)}",
                "packet_id": packet_id,
                "report_date": report_date,
                "region": match.group("region").strip(),
                "property_name": property_name,
                "property_id": mapped.get("property_id") or None,
                "community_id": mapped.get("community_id") or None,
                "apartments": parse_int(match.group("apartments")),
                "acquired_date": match.group("acquired"),
                "year_built": parse_int(match.group("year")),
                "traffic_data_as_of": traffic_data_as_of,
                "source_file": source_file,
                "evidence_json": json.dumps(evidence, sort_keys=True),
            }
        )
    return rows


def number_tokens(line: str) -> list[str]:
    return re.findall(r"\$?[\d,]+(?:\.\d+)?%?", line)


def parse_conversion_performance_summary_rows(
    report_date: str,
    source_file: str,
    page_text: str,
) -> list[dict[str, Any]]:
    """Parse the portfolio-level Conversion Performance Summary page.

    The Power BI PDF export preserves this page as rows of numbers but splits
    table columns unevenly. Use ordered numeric tokens and only accept the
    known row shapes that are stable in the exported report.
    """

    if "Conversion Performance Summary" not in page_text:
        return []

    rows: dict[str, dict[str, Any]] = {}
    table_index = 0
    for raw_line in page_text.splitlines():
        line = clean_line(raw_line)
        if line.startswith("Calendar Period (bins)"):
            table_index += 1
            continue
        match = re.match(r"^(?P<period>\d{1,2}/1/\d{4}|Total)\s+(?P<body>.+)$", line)
        if not match:
            continue

        period = normalize_calendar_period(match.group("period"))
        tokens = number_tokens(match.group("body"))
        row = rows.setdefault(
            period,
            {
                "id": f"marketing_bi_conversion_summary_{report_date.replace('-', '')}_{period.replace('-', '')}",
                "report_date": report_date,
                "calendar_period": period,
                "source_file": source_file,
                "evidence_json": json.dumps({"raw_lines": []}, sort_keys=True),
            },
        )
        evidence = json.loads(row["evidence_json"])
        evidence["raw_lines"].append(line)
        row["evidence_json"] = json.dumps(evidence, sort_keys=True)

        if table_index == 1:
            row["units_avg"] = parse_int(tokens[0]) if tokens else None
            values = tokens[1:]
            if len(values) == 4:
                (
                    row["guest_cards_all"],
                    row["visits_all"],
                    row["applications_all"],
                    row["leases_all"],
                ) = [parse_int(value) for value in values]
            elif len(values) == 16:
                (
                    row["guest_cards_paid"],
                    row["visits_paid"],
                    row["applications_paid"],
                    row["leases_paid"],
                    row["guest_cards_all"],
                    row["visits_all"],
                    row["applications_all"],
                    row["leases_all"],
                    row["cost_per_guest_card_paid"],
                    row["cost_per_visit_paid"],
                    row["cost_per_application_paid"],
                    row["cost_per_lease_paid"],
                    row["cost_per_guest_card_all"],
                    row["cost_per_visit_all"],
                    row["cost_per_application_all"],
                    row["cost_per_lease_all"],
                ) = [
                    *(parse_int(value) for value in values[:8]),
                    *(parse_money(value) for value in values[8:]),
                ]
        elif table_index == 2:
            row["units_avg"] = parse_int(tokens[0]) if tokens else row.get("units_avg")
            values = tokens[1:]
            if len(values) == 6:
                (
                    row["ad_spend_total"],
                    row["ad_spend_traditional"],
                    row["ad_spend_social"],
                    row["ad_spend_google"],
                    row["ad_spend_social_pct"],
                    row["ad_spend_per_door"],
                ) = [
                    parse_money(values[0]),
                    parse_money(values[1]),
                    parse_money(values[2]),
                    parse_money(values[3]),
                    parse_pct(values[4]),
                    parse_money(values[5]),
                ]

    ordered = []
    for row in rows.values():
        if row.get("units_avg") is not None:
            for column in CONVERSION_SUMMARY_COLUMNS:
                row.setdefault(column, None)
            ordered.append(row)
    return ordered


def parse_packet(
    path: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    source_sha256 = sha256_file(path)
    reader = PdfReader(str(path))
    pages: list[dict[str, Any]] = []
    full_text_parts: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text(extraction_mode="layout") or ""
        except TypeError:
            page_text = page.extract_text() or ""
        pages.append(
            {
                "page_number": index,
                "page_title": extract_page_title(page_text),
                "page_text": page_text,
            }
        )
        full_text_parts.append(page_text)

    full_text = "\n".join(full_text_parts)
    selected_period_start, selected_period_end = extract_period(full_text)
    traffic_data_as_of = extract_traffic_data_as_of(full_text)
    report_date = (
        traffic_data_as_of
        or selected_period_end
        or parse_pdf_creation_date(str(reader.metadata.get("/CreationDate") if reader.metadata else ""))
        or datetime.now().date().isoformat()
    )
    packet_id = f"marketing_bi_packet_{report_date.replace('-', '')}_{source_sha256[:12]}"
    packet = {
        "id": packet_id,
        "report_date": report_date,
        "selected_period_start": selected_period_start,
        "selected_period_end": selected_period_end,
        "traffic_data_as_of": traffic_data_as_of,
        "source_file": str(path.resolve()),
        "source_sha256": source_sha256,
        "page_count": len(pages),
        "report_title": pages[0]["page_title"] if pages else None,
    }
    page_rows = [
        {
            "id": f"marketing_bi_packet_page_{packet_id}_{page['page_number']:02d}",
            "packet_id": packet_id,
            "report_date": report_date,
            **page,
        }
        for page in pages
    ]
    property_rows = parse_property_summary_rows(
        packet_id=packet_id,
        report_date=report_date,
        traffic_data_as_of=traffic_data_as_of,
        source_file=str(path.resolve()),
        page_text=pages[0]["page_text"] if pages else "",
    )
    conversion_summary_rows: list[dict[str, Any]] = []
    for page in pages:
        conversion_summary_rows.extend(
            parse_conversion_performance_summary_rows(
                report_date=report_date,
                source_file=str(path.resolve()),
                page_text=page["page_text"],
            )
        )
    return packet, page_rows, property_rows, conversion_summary_rows


def ensure_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))
    conn.executescript(CONVERSION_SUMMARY_MIGRATION_SQL.read_text(encoding="utf-8"))


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


def ingest_marketing_bi_packets(
    db_path: Path = DB_PATH,
    file_paths: list[Path] | None = None,
    search_dirs: list[Path] | None = None,
) -> MarketingBiPacketIngestResult:
    files = [path.expanduser().resolve() for path in file_paths] if file_paths else discover_packet_files(search_dirs)
    result = MarketingBiPacketIngestResult(files_found=len(files))
    if not files:
        return result

    with sqlite3.connect(str(db_path)) as conn:
        ensure_tables(conn)
        for path in files:
            try:
                source_sha256 = sha256_file(path)
                existing = conn.execute(
                    "SELECT 1 FROM marketing_bi_daily_packets WHERE source_sha256 = ?",
                    (source_sha256,),
                ).fetchone()
                if existing:
                    _, _, _, conversion_summary_rows = parse_packet(path)
                    result.conversion_summary_rows_upserted += upsert_rows(
                        conn,
                        "marketing_bi_conversion_performance_summary",
                        conversion_summary_rows,
                    )
                    result.files_skipped += 1
                    continue
                packet, pages, property_rows, conversion_summary_rows = parse_packet(path)
                upsert_rows(conn, "marketing_bi_daily_packets", [packet])
                result.pages_upserted += upsert_rows(conn, "marketing_bi_daily_packet_pages", pages)
                result.property_rows_upserted += upsert_rows(conn, "marketing_bi_property_summary_rows", property_rows)
                result.conversion_summary_rows_upserted += upsert_rows(
                    conn,
                    "marketing_bi_conversion_performance_summary",
                    conversion_summary_rows,
                )
                result.packets_upserted += 1
                result.files_processed += 1
                result.report_dates.append(str(packet["report_date"]))
                result.source_files.append(str(path))
            except Exception as exc:
                result.files_failed += 1
                result.errors.append(f"{path}: {exc}")
        conn.commit()
    result.files_skipped = max(result.files_skipped, result.files_found - result.files_processed - result.files_failed)
    result.report_dates = sorted(set(result.report_dates))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Marketing BI daily packet PDF exports.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--source", action="append", help="Specific PDF source path. May be passed more than once.")
    parser.add_argument("--search-dir", action="append", help="Directory to search for packet PDFs. May be passed more than once.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sources = [Path(value) for value in args.source] if args.source else None
    search_dirs = [Path(value) for value in args.search_dir] if args.search_dir else None

    if args.dry_run:
        files = [path.expanduser().resolve() for path in sources] if sources else discover_packet_files(search_dirs)
        parsed = []
        for path in files:
            packet, pages, property_rows, conversion_summary_rows = parse_packet(path)
            parsed.append(
                {
                    "source_file": str(path),
                    "report_date": packet["report_date"],
                    "page_count": len(pages),
                    "property_rows": len(property_rows),
                    "conversion_summary_rows": len(conversion_summary_rows),
                }
            )
        print(json.dumps({"files_found": len(files), "parsed": parsed}, indent=2, sort_keys=True))
        return

    result = ingest_marketing_bi_packets(
        db_path=Path(args.db).expanduser().resolve(),
        file_paths=sources,
        search_dirs=search_dirs,
    )
    print(json.dumps(result.__dict__, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
