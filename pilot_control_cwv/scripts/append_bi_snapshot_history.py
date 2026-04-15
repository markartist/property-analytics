from __future__ import annotations

import argparse
import csv
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_INPUT = ROOT / "pilot_control_cwv" / "reports" / "pilot_bi_snapshot_normalized_2026-03-31.csv"
DEFAULT_HISTORY = ROOT / "pilot_control_cwv" / "reports" / "pilot_bi_metric_history.csv"

KEY_FIELDS = [
    "snapshot_date",
    "property_name",
    "conv_source",
    "metric_code",
    "window",
    "comparison_type",
]

FIELDNAMES = [
    "snapshot_date",
    "property_name",
    "property_id",
    "role",
    "sister_property_name",
    "conv_source",
    "metric_code",
    "window",
    "comparison_type",
    "value",
    "source_file",
    "source_sheet",
    "source_row",
    "source_column",
    "header_raw",
]


def load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as f:
        rows = list(csv.DictReader(f))
    return [{field: ("" if row.get(field) is None else row.get(field, "")) for field in FIELDNAMES} for row in rows]


def row_key(row: dict) -> tuple[str, ...]:
    return tuple(str(row[field]) for field in KEY_FIELDS)


def append_history(snapshot_path: Path, history_path: Path) -> tuple[int, int]:
    snapshot_rows = load_rows(snapshot_path)
    history_rows = load_rows(history_path)

    existing = {row_key(row) for row in history_rows}
    appended = 0

    for row in snapshot_rows:
        key = row_key(row)
        if key in existing:
            continue
        history_rows.append({field: row.get(field, "") for field in FIELDNAMES})
        existing.add(key)
        appended += 1

    history_rows.sort(
        key=lambda row: (
            row["snapshot_date"],
            row["property_name"],
            row["conv_source"],
            row["metric_code"],
            row["window"],
            row["comparison_type"],
        )
    )

    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(history_rows)

    return appended, len(history_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Append a normalized BI snapshot into BI metric history.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    args = parser.parse_args()

    appended, total = append_history(args.input, args.history)
    print(args.history)
    print(f"appended={appended}")
    print(f"total_rows={total}")


if __name__ == "__main__":
    main()
