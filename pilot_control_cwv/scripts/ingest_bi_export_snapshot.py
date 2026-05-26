from __future__ import annotations

import argparse
from pathlib import Path

from append_bi_snapshot_history import append_history
from bi_database import connect_db, ensure_bi_tables, upsert_bi_normalized_records, upsert_bi_raw_records
from normalize_bi_export_snapshot import derive_snapshot_date, extract_bi_export_records, write_csv


ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_OUTPUT_DIR = ROOT / "pilot_control_cwv" / "reports"


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize a BI export snapshot and append it to BI history.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--date", help="Snapshot date in YYYY-MM-DD format. Defaults from filename when possible.")
    parser.add_argument("--snapshot-output", type=Path, help="Optional normalized snapshot CSV path.")
    parser.add_argument(
        "--history-output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR / "pilot_bi_metric_history.csv",
        help="History CSV to append into.",
    )
    args = parser.parse_args()

    snapshot_date = derive_snapshot_date(args.input, args.date)
    snapshot_output = args.snapshot_output or (DEFAULT_OUTPUT_DIR / f"pilot_bi_snapshot_normalized_{snapshot_date}.csv")

    raw_records, normalized_records = extract_bi_export_records(args.input, snapshot_date)
    write_csv(normalized_records, snapshot_output)
    appended, total = append_history(snapshot_output, args.history_output)

    conn = connect_db()
    ensure_bi_tables(conn)
    raw_upserted = upsert_bi_raw_records(conn, raw_records)
    normalized_upserted = upsert_bi_normalized_records(conn, normalized_records)
    conn.close()

    print(f"snapshot={snapshot_output}")
    print(f"history={args.history_output}")
    print(f"appended={appended}")
    print(f"history_total_rows={total}")
    print(f"raw_upserted={raw_upserted}")
    print(f"normalized_upserted={normalized_upserted}")


if __name__ == "__main__":
    main()
