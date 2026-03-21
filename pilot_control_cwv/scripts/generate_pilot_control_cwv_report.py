#!/usr/bin/env python3
"""
Generate the dedicated pilot/control daily CWV workbook and HTML summary.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
OUTPUT_DIR = BASE_DIR / "reports"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class CohortEntry:
    key: str
    display_name: str
    role: str
    property_id: Optional[str]
    site_url: str
    history_source: str
    sister_key: Optional[str]
    active: bool


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        config = json.load(fh)
    config.setdefault("report_start_date", config.get("launch_date"))
    return config


def active_entries(config: Dict[str, object]) -> List[CohortEntry]:
    rows = []
    for row in config.get("cohorts", []):
        if not row.get("active", True):
            continue
        rows.append(
            CohortEntry(
                key=row["key"],
                display_name=row["display_name"],
                role=row["role"],
                property_id=row.get("property_id"),
                site_url=row["site_url"],
                history_source=row.get("history_source", "dedicated"),
                sister_key=row.get("sister_key"),
                active=bool(row.get("active", True)),
            )
        )
    return rows


def fmt_num(value: Optional[float]) -> str:
    return "" if value is None else f"{value:.1f}"


def fmt_delta(value: Optional[float]) -> str:
    return "" if value is None else f"{value:+.1f}"


def judgment(score: Optional[float], lcp: Optional[float], cls: Optional[float], tbt: Optional[float]) -> str:
    if score is None:
        return "No Data"
    if score >= 90 and (lcp is None or lcp <= 2.5) and (cls is None or cls <= 0.10) and (tbt is None or tbt <= 200):
        return "Strong"
    poor_flags = sum(
        int(val)
        for val in [
            lcp is not None and lcp > 4.0,
            cls is not None and cls > 0.25,
            tbt is not None and tbt > 600,
        ]
    )
    if score < 60 or poor_flags >= 1:
        return "At Risk"
    if score < 75:
        return "Needs Improvement"
    return "Healthy"


def get_dedicated_history(conn: sqlite3.Connection, entry: CohortEntry, as_of_date: str) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT metric_date, performance_score, lcp_value, cls_value, total_blocking_time
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date <= ?
        ORDER BY metric_date DESC
        """,
        (entry.key, as_of_date),
    ).fetchall()


def get_portfolio_history(conn: sqlite3.Connection, entry: CohortEntry, as_of_date: str) -> List[sqlite3.Row]:
    if not entry.property_id:
        return []
    return conn.execute(
        """
        SELECT metric_date, performance_score, lcp_value, cls_value, total_blocking_time
        FROM pagespeed_metrics
        WHERE property_id = ?
          AND strategy = 'mobile'
          AND metric_date <= ?
        ORDER BY metric_date DESC
        """,
        (entry.property_id, as_of_date),
    ).fetchall()


def get_history(conn: sqlite3.Connection, entry: CohortEntry, as_of_date: str) -> List[sqlite3.Row]:
    if entry.history_source == "portfolio_property":
        return get_portfolio_history(conn, entry, as_of_date)
    return get_dedicated_history(conn, entry, as_of_date)


def average_prior(history: List[sqlite3.Row], as_of_date: str, days: int) -> Optional[float]:
    vals = [row["performance_score"] for row in history if row["metric_date"] < as_of_date and row["performance_score"] is not None][:days]
    if len(vals) < days:
        return None
    return sum(vals) / len(vals)


def yoy_score(history: List[sqlite3.Row], as_of_date: str) -> Optional[float]:
    target = (datetime.strptime(as_of_date, "%Y-%m-%d").date() - timedelta(days=365)).isoformat()
    for row in history:
        if row["metric_date"] == target:
            return row["performance_score"]
    return None


def current_mobile_row(conn: sqlite3.Connection, entry: CohortEntry, as_of_date: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT metric_date, performance_score, lcp_value, cls_value, total_blocking_time
        FROM pilot_control_psi_metrics
        WHERE cohort_key = ?
          AND strategy = 'mobile'
          AND metric_date = ?
        """,
        (entry.key, as_of_date),
    ).fetchone()


def all_dates(conn: sqlite3.Connection, report_start_date: str) -> List[str]:
    rows = conn.execute(
        """
        SELECT DISTINCT metric_date
        FROM pilot_control_psi_metrics
        WHERE metric_date >= ?
        ORDER BY metric_date ASC
        """,
        (report_start_date,),
    ).fetchall()
    return [row[0] for row in rows]


def raw_rows(conn: sqlite3.Connection, report_start_date: str) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT
            metric_date,
            cohort_key,
            display_name,
            role,
            site_url,
            strategy,
            performance_score,
            lcp_value,
            cls_value,
            total_blocking_time
        FROM pilot_control_psi_metrics
        WHERE metric_date >= ?
        ORDER BY metric_date ASC, display_name ASC, strategy ASC
        """,
        (report_start_date,),
    ).fetchall()


def build_dataset(conn: sqlite3.Connection, entries: List[CohortEntry], report_start_date: str) -> Dict[str, Dict[str, Dict[str, Optional[float]]]]:
    index = {entry.key: entry for entry in entries}
    dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]] = {}
    for metric_date in all_dates(conn, report_start_date):
        dataset[metric_date] = {}
        for entry in entries:
            current = current_mobile_row(conn, entry, metric_date)
            history = get_history(conn, entry, metric_date)
            score = current["performance_score"] if current else None
            t30 = average_prior(history, metric_date, 30)
            t90 = average_prior(history, metric_date, 90)
            yoy = yoy_score(history, metric_date)
            sister_score = None
            if entry.sister_key and entry.sister_key in index:
                sister = current_mobile_row(conn, index[entry.sister_key], metric_date)
                sister_score = sister["performance_score"] if sister else None
            dataset[metric_date][entry.key] = {
                "score": score,
                "t30": t30,
                "variance_t30": (score - t30) if score is not None and t30 is not None else None,
                "t90": t90,
                "variance_t90": (score - t90) if score is not None and t90 is not None else None,
                "yoy": yoy,
                "variance_yoy": (score - yoy) if score is not None and yoy is not None else None,
                "variance_sister": (score - sister_score) if score is not None and sister_score is not None else None,
                "judgment": judgment(
                    score,
                    current["lcp_value"] if current else None,
                    current["cls_value"] if current else None,
                    current["total_blocking_time"] if current else None,
                ),
            }
    return dataset


def build_workbook(
    config: Dict[str, object],
    entries: List[CohortEntry],
    dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]],
    raw_metric_rows: List[sqlite3.Row],
) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Matrix"

    header_fill = PatternFill("solid", fgColor="D9E2F3")
    section_fill = PatternFill("solid", fgColor="EEF3F8")
    bold = Font(bold=True)
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws["A1"] = config["report_name"]
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = "Trailing and YoY fields remain blank for new vanity domains until enough direct history exists."

    columns = [
        ("Score", "score"),
        ("T30", "t30"),
        ("Variance from T30", "variance_t30"),
        ("Rolling T90", "t90"),
        ("Variance from T90", "variance_t90"),
        ("YoY Trend", "yoy"),
        ("Variance from YoY", "variance_yoy"),
        ("Variance from Sister", "variance_sister"),
    ]

    ws.merge_cells(start_row=4, start_column=1, end_row=5, end_column=1)
    ws["A4"] = "Day"
    ws["A4"].font = bold
    ws["A4"].alignment = center
    ws.column_dimensions["A"].width = 14

    col = 2
    for entry in entries:
        ws.merge_cells(start_row=4, start_column=col, end_row=4, end_column=col + len(columns) - 1)
        cell = ws.cell(row=4, column=col, value=entry.display_name)
        cell.font = bold
        cell.fill = header_fill
        cell.alignment = center
        for offset, (label, _) in enumerate(columns):
            sub = ws.cell(row=5, column=col + offset, value=label)
            sub.font = bold
            sub.fill = section_fill
            sub.alignment = center
            ws.column_dimensions[get_column_letter(col + offset)].width = 16
        col += len(columns)

    report_start_dt = datetime.strptime(config["report_start_date"], "%Y-%m-%d").date()
    row = 6
    for metric_date in sorted(dataset.keys()):
        day_num = (datetime.strptime(metric_date, "%Y-%m-%d").date() - report_start_dt).days + 1
        ws.cell(row=row, column=1, value=f"Day {day_num}")
        col = 2
        for entry in entries:
            values = dataset[metric_date][entry.key]
            for _, key in columns:
                val = values[key]
                rendered = fmt_delta(val) if key.startswith("variance") else fmt_num(val)
                ws.cell(row=row, column=col, value=rendered)
                col += 1
        row += 1

    raw = wb.create_sheet("Raw PSI")
    raw.append(
        [
            "metric_date",
            "cohort_key",
            "display_name",
            "role",
            "site_url",
            "strategy",
            "performance_score",
            "lcp_value",
            "cls_value",
            "total_blocking_time",
        ]
    )
    for row_data in raw_metric_rows:
        raw.append(
            [
                row_data["metric_date"],
                row_data["cohort_key"],
                row_data["display_name"],
                row_data["role"],
                row_data["site_url"],
                row_data["strategy"],
                row_data["performance_score"],
                row_data["lcp_value"],
                row_data["cls_value"],
                row_data["total_blocking_time"],
            ]
        )
    for column in range(1, 11):
        raw.column_dimensions[get_column_letter(column)].width = 20

    notes = wb.create_sheet("Notes")
    notes["A1"] = "Methodology"
    notes["A1"].font = bold
    notes["A3"] = "Score"
    notes["B3"] = "Actual PSI Mobile Performance Score collected for the configured site URL."
    notes["A4"] = "T30 / Rolling T90"
    notes["B4"] = "Trailing averages excluding the current day. New pilot vanity domains stay blank until enough direct history exists."
    notes["A5"] = "YoY Trend"
    notes["B5"] = "Same calendar date prior-year score when available; blank otherwise."
    notes["A6"] = "Variance from Sister"
    notes["B6"] = "Current score minus assigned sister/control property's current score on the same date."
    notes["A7"] = "Judgment"
    notes["B7"] = "Supporting status only. Score remains the primary commissioned metric."

    return wb


def write_html_summary(config: Dict[str, object], entries: List[CohortEntry], dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]], out_path: Path) -> None:
    latest_date = max(dataset.keys()) if dataset else None
    rows = []
    if latest_date:
        for entry in entries:
            vals = dataset[latest_date][entry.key]
            rows.append(
                f"""
                <tr>
                  <td>{entry.display_name}</td>
                  <td>{entry.role.title()}</td>
                  <td>{fmt_num(vals['score']) or '—'}</td>
                  <td>{vals['judgment']}</td>
                  <td>{fmt_num(vals['t30']) or '—'}</td>
                  <td>{fmt_delta(vals['variance_t30']) or '—'}</td>
                  <td>{fmt_delta(vals['variance_sister']) or '—'}</td>
                </tr>
                """
            )

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a;">
        <h1>{config['report_name']}</h1>
        <p>Latest collection date: {latest_date or 'No data'}</p>
        <p>This dedicated report is isolated from portfolio PSI history. Pilots use dedicated vanity-domain history only; sister/control properties can be configured to compare against existing portfolio PSI history.</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          <tr style="background: #d9e2f3; font-weight: 700;">
            <th>Property</th>
            <th>Role</th>
            <th>Score</th>
            <th>Judgment</th>
            <th>T30</th>
            <th>Variance from T30</th>
            <th>Variance from Sister</th>
          </tr>
          {''.join(rows)}
        </table>
      </body>
    </html>
    """
    out_path.write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the pilot/control CWV report")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to config JSON")
    parser.add_argument("--date", default=None, help="Optional label date for output filenames")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    entries = active_entries(config)
    db_path = Path(config["db_path"])
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    dataset = build_dataset(conn, entries, config["report_start_date"])
    raw_metric_rows = raw_rows(conn, config["report_start_date"])
    conn.close()

    label_date = args.date or (max(dataset.keys()) if dataset else date.today().isoformat())
    workbook_path = OUTPUT_DIR / f"Pilot_Control_CWV_Report_{label_date}.xlsx"
    html_path = OUTPUT_DIR / f"Pilot_Control_CWV_Report_{label_date}.html"

    wb = build_workbook(config, entries, dataset, raw_metric_rows)
    wb.save(workbook_path)
    write_html_summary(config, entries, dataset, html_path)

    print(f"Saved workbook: {workbook_path}")
    print(f"Saved HTML:     {html_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
