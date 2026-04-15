from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
DEFAULT_HISTORY = ROOT / "pilot_control_cwv" / "reports" / "pilot_bi_metric_history.csv"
DEFAULT_OUTPUT = ROOT / "pilot_control_cwv" / "reports" / "pilot_bi_report_series.csv"

BI_METRICS = {
    "lead_to_available_unit_rate": {"metric_code": "GC/AU", "daily_window": "T7D_DAILY_AVG", "baseline_window": "T90D"},
    "website_sales_funnel_price_quote": {"metric_code": "PQ/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_sales_funnel_visits_schedule_tour": {"metric_code": "ST/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_sales_funnel_completed_applications": {"metric_code": "A/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_funnel_conversions_click_to_call": {"metric_code": "C2C/GC", "daily_window": "T7D", "baseline_window": "T90D"},
    "website_funnel_conversions_contact_form": {"metric_code": "CFrm/GC", "daily_window": "T7D", "baseline_window": "T90D"},
}


def load_pairs() -> list[dict]:
    cfg = json.loads(CONFIG_PATH.read_text())
    cohorts = {c["key"]: c for c in cfg["cohorts"] if c.get("active")}
    pairs = []
    for cohort in cohorts.values():
        if cohort["role"] != "pilot":
            continue
        sister = cohorts[cohort["sister_key"]]
        pairs.append(
            {
                "pilot_name": cohort["display_name"],
                "pilot_id": cohort["property_id"],
                "sister_name": sister["display_name"],
                "sister_id": sister["property_id"],
            }
        )
    return pairs


def read_csv(path: Path) -> list[dict]:
    with path.open() as f:
        return list(csv.DictReader(f))


def build_history_index(rows: list[dict]) -> dict[tuple[str, str, str, str, str], float]:
    index = {}
    for row in rows:
        key = (
            row["snapshot_date"],
            row["property_name"],
            row["conv_source"],
            row["metric_code"],
            row["comparison_type"],
        )
        if row["window"] not in {"T7D", "T7D_DAILY_AVG", "T90D"}:
            continue
        index[(row["window"],) + key] = float(row["value"])
    return index


def latest_baseline_by_metric(rows: list[dict]) -> dict[tuple[str, str, str], tuple[str, float]]:
    latest: dict[tuple[str, str, str], tuple[str, float]] = {}
    for row in rows:
        if row["conv_source"] != "Website Conversion":
            continue
        if row["comparison_type"] not in {"current", "sister"}:
            continue
        if row["window"] not in {"T90D", "T90D_DAILY_AVG"}:
            continue
        key = (row["property_name"], row["metric_code"], row["comparison_type"])
        snapshot_date = row["snapshot_date"]
        value = float(row["value"])
        if key not in latest or snapshot_date > latest[key][0]:
            latest[key] = (snapshot_date, value)
    return latest


def build_rows(history_rows: list[dict], baseline_rows: list[dict] | None) -> list[dict]:
    history_index = build_history_index(history_rows)
    baseline_index = latest_baseline_by_metric(baseline_rows or history_rows)
    history_dates = sorted({row["snapshot_date"] for row in history_rows})
    output: list[dict] = []

    for pair in load_pairs():
        for section_key, metric in BI_METRICS.items():
            metric_code = metric["metric_code"]
            daily_window = metric["daily_window"]

            pilot_baseline = baseline_index.get((pair["pilot_name"], metric_code, "current"))
            sister_baseline = (
                baseline_index.get((pair["pilot_name"], metric_code, "sister"))
                or baseline_index.get((pair["sister_name"], metric_code, "current"))
            )

            for snapshot_date in history_dates:
                pilot_value = history_index.get(
                    (daily_window, snapshot_date, pair["pilot_name"], "Website Conversion", metric_code, "current")
                )
                sister_value = history_index.get(
                    (daily_window, snapshot_date, pair["pilot_name"], "Website Conversion", metric_code, "sister")
                )

                output.append(
                    {
                        "snapshot_date": snapshot_date,
                        "section_key": section_key,
                        "metric_code": metric_code,
                        "pilot_property_name": pair["pilot_name"],
                        "pilot_property_id": pair["pilot_id"],
                        "sister_property_name": pair["sister_name"],
                        "sister_property_id": pair["sister_id"],
                        "daily_window": daily_window,
                        "baseline_window": metric["baseline_window"],
                        "pilot_daily_value": pilot_value if pilot_value is not None else "",
                        "sister_daily_value": sister_value if sister_value is not None else "",
                        "pilot_baseline_value": pilot_baseline[1] if pilot_baseline else "",
                        "sister_baseline_value": sister_baseline[1] if sister_baseline else "",
                        "baseline_source_date": pilot_baseline[0] if pilot_baseline else "",
                        "row_filter": "Website Conversion",
                    }
                )
    return output


def write_rows(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "snapshot_date",
        "section_key",
        "metric_code",
        "pilot_property_name",
        "pilot_property_id",
        "sister_property_name",
        "sister_property_id",
        "daily_window",
        "baseline_window",
        "pilot_daily_value",
        "sister_daily_value",
        "pilot_baseline_value",
        "sister_baseline_value",
        "baseline_source_date",
        "row_filter",
    ]
    with output_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build BI report-ready series from retained BI history and a baseline seed.")
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--baseline-snapshot", type=Path, help="Optional normalized baseline snapshot CSV, e.g. from 2026-03-26.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    history_rows = read_csv(args.history)
    baseline_rows = read_csv(args.baseline_snapshot) if args.baseline_snapshot else None
    rows = build_rows(history_rows, baseline_rows)
    write_rows(rows, args.output)

    print(args.output)
    print(f"rows={len(rows)}")


if __name__ == "__main__":
    main()
