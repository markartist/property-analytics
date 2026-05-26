from __future__ import annotations

import csv
import json
import sqlite3
from datetime import datetime
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
OUTPUT_DIR = ROOT / "pilot_control_cwv" / "reports"

EXPECTED_ROWS = [
    ("Total", "GC/AU", "Yesterday"),
    ("Total", "GC/AU", "T7D_DAILY_AVG"),
    ("Total", "GC/AU", "T30D_DAILY_AVG"),
    ("Website Conversion", "GC/AU", "Yesterday"),
    ("Website Conversion", "GC/AU", "T7D_DAILY_AVG"),
    ("Website Conversion", "GC/AU", "T30D_DAILY_AVG"),
    ("Website Conversion", "PQ/GC", "Yesterday"),
    ("Website Conversion", "PQ/GC", "T7D"),
    ("Website Conversion", "PQ/GC", "T30D"),
    ("Website Conversion", "ST/GC", "Yesterday"),
    ("Website Conversion", "ST/GC", "T7D"),
    ("Website Conversion", "ST/GC", "T30D"),
    ("Website Conversion", "A/GC", "Yesterday"),
    ("Website Conversion", "A/GC", "T7D"),
    ("Website Conversion", "A/GC", "T30D"),
    ("Website Conversion", "C2C/GC", "Yesterday"),
    ("Website Conversion", "C2C/GC", "T7D"),
    ("Website Conversion", "C2C/GC", "T30D"),
    ("Website Conversion", "CFrm/GC", "Yesterday"),
    ("Website Conversion", "CFrm/GC", "T7D"),
    ("Website Conversion", "CFrm/GC", "T30D"),
    ("Website Conversion", "L/GC", "Yesterday"),
    ("Website Conversion", "L/GC", "T7D"),
    ("Website Conversion", "L/GC", "T30D"),
    ("Website Conversion", "M/GC", "Yesterday"),
    ("Website Conversion", "M/GC", "T7D"),
    ("Website Conversion", "M/GC", "T30D"),
]


def load_pairs() -> list[dict[str, str]]:
    cfg = json.loads(CONFIG_PATH.read_text())
    cohorts = {c["key"]: c for c in cfg["cohorts"] if c.get("active")}
    pairs: list[dict[str, str]] = []
    for cohort in cohorts.values():
        if cohort["role"] != "pilot":
            continue
        sister = cohorts[cohort["sister_key"]]
        pairs.append(
            {
                "pilot_name": cohort["display_name"],
                "sister_name": sister["display_name"],
            }
        )
    return pairs


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    latest_snapshot = conn.execute("SELECT MAX(snapshot_date) FROM bi_normalized_metrics").fetchone()[0]
    if not latest_snapshot:
        raise SystemExit("No BI data found in bi_normalized_metrics")

    present = {
        (
            row[0],
            row[1],
            row[2],
            row[3],
            row[4],
            row[5],
        )
        for row in conn.execute(
            """
            SELECT property_name, sister_property_name, conv_source, metric_code, window, comparison_type
            FROM bi_normalized_metrics
            WHERE snapshot_date = ?
            """,
            (latest_snapshot,),
        )
    }

    missing_rows: list[dict[str, str]] = []
    for pair in load_pairs():
        for conv_source, metric_code, window in EXPECTED_ROWS:
            for comparison_type in ("current", "sister"):
                key = (
                    pair["pilot_name"],
                    pair["sister_name"],
                    conv_source,
                    metric_code,
                    window,
                    comparison_type,
                )
                if key in present:
                    continue
                missing_rows.append(
                    {
                        "snapshot_date": latest_snapshot,
                        "pilot_property_name": pair["pilot_name"],
                        "sister_property_name": pair["sister_name"],
                        "conv_source": conv_source,
                        "metric_code": metric_code,
                        "window": window,
                        "comparison_type": comparison_type,
                    }
                )

    output_path = OUTPUT_DIR / f"bi_missing_metrics_audit_{latest_snapshot}.csv"
    with output_path.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "snapshot_date",
                "pilot_property_name",
                "sister_property_name",
                "conv_source",
                "metric_code",
                "window",
                "comparison_type",
            ],
        )
        writer.writeheader()
        writer.writerows(missing_rows)

    print(output_path)
    print(f"latest_snapshot={latest_snapshot}")
    print(f"missing_rows={len(missing_rows)}")


if __name__ == "__main__":
    main()
