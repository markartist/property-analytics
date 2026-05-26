#!/usr/bin/env python3
"""Generate a human-readable BI missing metrics report from the audit CSV."""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
REPORTS_DIR = ROOT / "pilot_control_cwv" / "reports"
AUDIT_CSV = REPORTS_DIR / "bi_missing_metrics_audit_2026-04-01.csv"
OUTPUT_MD = REPORTS_DIR / "bi_missing_metrics_report_2026-04-01.md"


METRIC_LABELS = {
    "GC/AU": "Lead (Guest Card) to Available Unit Rate",
    "PQ/GC": "Price Quote",
    "ST/GC": "Visits (Schedule a Tour)",
    "A/GC": "Completed Applications",
    "C2C/GC": "Click to Call / Phone",
    "CFrm/GC": "Contact Form",
    "L/GC": "Leases",
    "M/GC": "Move-ins",
}


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def fmt_metric(metric_code: str) -> str:
    return METRIC_LABELS.get(metric_code, metric_code)


def main() -> None:
    rows = load_rows(AUDIT_CSV)
    if not rows:
        raise SystemExit("Audit CSV is empty; nothing to report.")

    snapshot_date = rows[0]["snapshot_date"]
    by_window = Counter(row["window"] for row in rows)
    by_metric = Counter(row["metric_code"] for row in rows)
    by_pair: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_pair[(row["pilot_property_name"], row["sister_property_name"])].append(row)

    lines: list[str] = []
    lines.append(f"# BI Missing Metrics Report ({snapshot_date})")
    lines.append("")
    lines.append("This report lists metrics that are absent from the latest BI host file.")
    lines.append(
        "These are source gaps from BI, not values that should be backfilled, estimated, or inferred."
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Latest BI snapshot audited: `{snapshot_date}`")
    lines.append(f"- Total missing rows: `{len(rows)}`")
    lines.append(
        f"- Missing by window: "
        + ", ".join(f"`{window}` = {count}" for window, count in by_window.most_common())
    )
    lines.append(
        f"- Missing by metric: "
        + ", ".join(
            f"`{fmt_metric(metric)}` ({metric}) = {count}"
            for metric, count in by_metric.most_common()
        )
    )
    lines.append("")
    lines.append("## What To Request From BI Owners")
    lines.append("")
    for window, count in by_window.most_common():
        metric_list = ", ".join(
            f"`{fmt_metric(metric)}`"
            for metric, metric_count in by_metric.most_common()
            if any(r["window"] == window and r["metric_code"] == metric for r in rows)
        )
        lines.append(f"- `{window}`: request complete population for {metric_list}.")
    lines.append("")
    lines.append("## Property Pair Detail")
    lines.append("")

    for (pilot_name, sister_name), pair_rows in sorted(by_pair.items()):
        lines.append(f"### {pilot_name} vs {sister_name}")
        lines.append("")
        pair_metric_counter = Counter(row["metric_code"] for row in pair_rows)
        pair_window_counter = Counter(row["window"] for row in pair_rows)
        lines.append(
            "- Missing by window: "
            + ", ".join(f"`{window}` = {count}" for window, count in pair_window_counter.most_common())
        )
        lines.append(
            "- Missing by metric: "
            + ", ".join(
                f"`{fmt_metric(metric)}` ({metric}) = {count}"
                for metric, count in pair_metric_counter.most_common()
            )
        )
        lines.append("- Exact missing fields:")
        for row in sorted(
            pair_rows,
            key=lambda r: (r["window"], r["metric_code"], r["comparison_type"]),
        ):
            lines.append(
                f"  - `{row['window']}` | `{fmt_metric(row['metric_code'])}` ({row['metric_code']})"
                f" | `{row['comparison_type']}`"
            )
        lines.append("")

    OUTPUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote BI missing metrics report to: {OUTPUT_MD}")


if __name__ == "__main__":
    main()
