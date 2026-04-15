from __future__ import annotations

import sqlite3
from pathlib import Path

from measurement_dashboard_parser import METRIC_HEADER_MAP, _normalize_header_text


DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
OUT_PATH = Path(
    "/Users/mark/Property_Analytics/pilot_control_cwv/reports/measurement_daily_header_inventory_2026-04-06.md"
)


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    raw_headers = conn.execute(
        """
        SELECT
            header_raw,
            MIN(snapshot_date) AS first_seen,
            MAX(snapshot_date) AS last_seen,
            COUNT(*) AS populated_cells
        FROM measurement_daily_raw_values
        GROUP BY header_raw
        ORDER BY header_raw
        """
    ).fetchall()

    by_sheet = conn.execute(
        """
        SELECT
            snapshot_date,
            source_sheet,
            COUNT(*) AS populated_cells,
            COUNT(DISTINCT header_raw) AS distinct_headers
        FROM measurement_daily_raw_values
        GROUP BY snapshot_date, source_sheet
        ORDER BY snapshot_date, source_sheet
        """
    ).fetchall()

    normalized_map = {
        _normalize_header_text(header): meta for header, meta in METRIC_HEADER_MAP.items()
    }

    lines: list[str] = []
    lines.append("# Measurement Daily Header Inventory")
    lines.append("")
    lines.append(f"Source DB: `{DB_PATH}`")
    lines.append("")
    lines.append("This report inventories every non-empty header/value stored from the Measurement workbook daily tabs.")
    lines.append("")
    lines.append("## Daily Sheet Coverage")
    lines.append("")
    lines.append("| Snapshot Date | Sheet | Populated Cells | Distinct Headers |")
    lines.append("|---|---|---:|---:|")
    for row in by_sheet:
        lines.append(
            f"| {row['snapshot_date']} | `{row['source_sheet']}` | {row['populated_cells']} | {row['distinct_headers']} |"
        )

    lines.append("")
    lines.append("## Header Mapping Status")
    lines.append("")
    lines.append("| Header | First Seen | Last Seen | Cells | Normalized Metric | Value Type |")
    lines.append("|---|---|---|---:|---|---|")
    for row in raw_headers:
        header = row["header_raw"]
        mapping = normalized_map.get(_normalize_header_text(header))
        metric_key = mapping["metric_key"] if mapping else ""
        value_type = mapping["value_type"] if mapping else ""
        lines.append(
            f"| `{header}` | {row['first_seen']} | {row['last_seen']} | {row['populated_cells']} | `{metric_key}` | `{value_type}` |"
        )

    unmapped = [row for row in raw_headers if _normalize_header_text(row["header_raw"]) not in normalized_map]
    lines.append("")
    lines.append("## Unmapped Headers Still Preserved Raw")
    lines.append("")
    if not unmapped:
        lines.append("None.")
    else:
        for row in unmapped:
            lines.append(f"- `{row['header_raw']}`")

    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote measurement header inventory to {OUT_PATH}")


if __name__ == "__main__":
    main()
