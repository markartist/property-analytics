#!/usr/bin/env python3
"""
Generate the dedicated pilot/control daily CWV workbook and HTML summary.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
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


def complete_dates(conn: sqlite3.Connection, entries: List[CohortEntry], report_start_date: str) -> List[str]:
    expected_count = len(entries)
    rows = conn.execute(
        """
        SELECT metric_date
        FROM pilot_control_psi_metrics
        WHERE metric_date >= ?
          AND strategy = 'mobile'
        GROUP BY metric_date
        HAVING COUNT(DISTINCT cohort_key) >= ?
        ORDER BY metric_date ASC
        """,
        (report_start_date, expected_count),
    ).fetchall()
    return [row[0] for row in rows]


def raw_rows(conn: sqlite3.Connection, report_dates: List[str]) -> List[sqlite3.Row]:
    if not report_dates:
        return []
    placeholders = ",".join("?" for _ in report_dates)
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
        WHERE metric_date IN ({placeholders})
        ORDER BY metric_date ASC, display_name ASC, strategy ASC
        """.format(placeholders=placeholders),
        report_dates,
    ).fetchall()


def build_dataset(
    conn: sqlite3.Connection,
    entries: List[CohortEntry],
    report_start_date: str,
    report_dates: List[str],
) -> Dict[str, Dict[str, Dict[str, Optional[float]]]]:
    index = {entry.key: entry for entry in entries}
    dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]] = {}
    for metric_date in report_dates:
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


def pilot_control_pairs(entries: List[CohortEntry]) -> List[tuple[CohortEntry, Optional[CohortEntry]]]:
    pilots = [entry for entry in entries if entry.role == "pilot"]
    entry_index = {entry.key: entry for entry in entries}
    return [(pilot, entry_index.get(pilot.sister_key) if pilot.sister_key else None) for pilot in pilots]


def matrix_columns() -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    pilot_columns = [
        ("Score", "score"),
        ("T30", "t30"),
        ("Variance from T30", "variance_t30"),
        ("Rolling T90", "t90"),
        ("Variance from T90", "variance_t90"),
        ("YoY Trend", "yoy"),
        ("Variance from YoY", "variance_yoy"),
        ("Variance from Sister", "variance_sister"),
    ]
    control_columns = pilot_columns[:-1]
    return pilot_columns, control_columns


def matrix_rows(
    config: Dict[str, object],
    entries: List[CohortEntry],
    dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]],
) -> List[List[str]]:
    pilot_columns, control_columns = matrix_columns()
    pairs = pilot_control_pairs(entries)

    header_row_1 = [""]
    header_row_2 = [""]
    practice_row = ["PRACTICE ROW"]

    for pilot, sister in pairs:
        header_row_1.extend([pilot.display_name] + [""] * (len(pilot_columns) - 1))
        header_row_2.extend([label for label, _ in pilot_columns])
        practice_row.extend([""] * len(pilot_columns))
        if sister:
            header_row_1.extend([sister.display_name] + [""] * (len(control_columns) - 1))
            header_row_2.extend([label for label, _ in control_columns])
            practice_row.extend([""] * len(control_columns))

    rows = [header_row_1, header_row_2, practice_row]
    for metric_date in sorted(dataset.keys()):
        row = [metric_date]
        for pilot, sister in pairs:
            pilot_values = dataset[metric_date][pilot.key]
            for _, key in pilot_columns:
                value = pilot_values[key]
                row.append(fmt_delta(value) if key.startswith("variance") else fmt_num(value))
            if sister:
                sister_values = dataset[metric_date][sister.key]
                for _, key in control_columns:
                    value = sister_values[key]
                    row.append(fmt_delta(value) if key.startswith("variance") else fmt_num(value))
        rows.append(row)
    return rows


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
    white_fill = PatternFill("solid", fgColor="FFFFFF")
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_gray = Side(style="thin", color="D9DCE3")
    dark_gray = Side(style="thin", color="333333")
    light_border = Border(left=thin_gray, right=thin_gray, top=thin_gray, bottom=thin_gray)
    header_border = Border(left=dark_gray, right=dark_gray, top=dark_gray, bottom=dark_gray)

    pilot_columns, control_columns = matrix_columns()
    pairs = pilot_control_pairs(entries)

    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "B4"
    ws.column_dimensions["A"].width = 18
    ws.row_dimensions[1].height = 54
    ws.row_dimensions[2].height = 44

    col = 2
    for pilot, sister in pairs:

        ws.merge_cells(start_row=1, start_column=col, end_row=1, end_column=col + len(pilot_columns) - 1)
        cell = ws.cell(row=1, column=col, value=pilot.display_name)
        cell.font = Font(size=12)
        cell.fill = header_fill
        cell.alignment = center
        cell.border = header_border
        for offset, (label, _) in enumerate(pilot_columns):
            sub = ws.cell(row=2, column=col + offset, value=label)
            sub.font = Font(size=11)
            sub.fill = white_fill
            sub.alignment = center
            sub.border = light_border
            ws.column_dimensions[get_column_letter(col + offset)].width = 13
        col += len(pilot_columns)

        if sister:
            ws.merge_cells(start_row=1, start_column=col, end_row=1, end_column=col + len(control_columns) - 1)
            cell = ws.cell(row=1, column=col, value=sister.display_name)
            cell.font = Font(size=12)
            cell.fill = header_fill
            cell.alignment = center
            cell.border = header_border
            for offset, (label, _) in enumerate(control_columns):
                sub = ws.cell(row=2, column=col + offset, value=label)
                sub.font = Font(size=11)
                sub.fill = white_fill
                sub.alignment = center
                sub.border = light_border
                ws.column_dimensions[get_column_letter(col + offset)].width = 13
            col += len(control_columns)

    ws["A3"] = "PRACTICE ROW"
    ws["A3"].font = Font(size=11)
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center")
    ws["A3"].border = light_border
    for col_idx in range(2, ws.max_column + 1):
        cell = ws.cell(row=3, column=col_idx, value="")
        cell.border = light_border

    row = 4
    for metric_date in sorted(dataset.keys()):
        day_label = ws.cell(row=row, column=1, value=metric_date)
        day_label.font = Font(size=11)
        day_label.alignment = center
        day_label.border = light_border
        col = 2
        for pilot, sister in pairs:
            values = dataset[metric_date][pilot.key]
            for _, key in pilot_columns:
                val = values[key]
                rendered = fmt_delta(val) if key.startswith("variance") else fmt_num(val)
                data_cell = ws.cell(row=row, column=col, value=rendered)
                data_cell.alignment = center
                data_cell.border = light_border
                col += 1

            if sister:
                values = dataset[metric_date][sister.key]
                for _, key in control_columns:
                    val = values[key]
                    rendered = fmt_delta(val) if key.startswith("variance") else fmt_num(val)
                    data_cell = ws.cell(row=row, column=col, value=rendered)
                    data_cell.alignment = center
                    data_cell.border = light_border
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
    notes["A1"].font = Font(bold=True)
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
    notes["A8"] = "Date Inclusion"
    notes["B8"] = "Only dates with a complete required mobile cohort are included in the commissioned exports."

    return wb


def write_matrix_csv(
    config: Dict[str, object],
    entries: List[CohortEntry],
    dataset: Dict[str, Dict[str, Dict[str, Optional[float]]]],
    out_path: Path,
) -> None:
    rows = matrix_rows(config, entries, dataset)
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerows(rows)


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
    report_dates = complete_dates(conn, entries, config["report_start_date"])
    dataset = build_dataset(conn, entries, config["report_start_date"], report_dates)
    raw_metric_rows = raw_rows(conn, report_dates)
    conn.close()

    label_date = args.date or (max(dataset.keys()) if dataset else date.today().isoformat())
    workbook_path = OUTPUT_DIR / f"Pilot_Control_CWV_Report_{label_date}.xlsx"
    html_path = OUTPUT_DIR / f"Pilot_Control_CWV_Report_{label_date}.html"
    csv_path = OUTPUT_DIR / f"Pilot_Control_CWV_Report_{label_date}.csv"

    wb = build_workbook(config, entries, dataset, raw_metric_rows)
    wb.save(workbook_path)
    write_html_summary(config, entries, dataset, html_path)
    write_matrix_csv(config, entries, dataset, csv_path)

    print(f"Saved workbook: {workbook_path}")
    print(f"Saved HTML:     {html_path}")
    print(f"Saved CSV:      {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
