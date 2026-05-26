#!/usr/bin/env python3
"""
Populate the stakeholder-supplied KPI tracker workbook while preserving its
exact structure.

Important: this script does not round-trip the workbook through openpyxl for
save because that damages this template. Instead it patches the XLSX package
XML directly and removes the unsafe external-link package parts.
"""

from __future__ import annotations

import json
import sqlite3
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import xml.etree.ElementTree as ET


BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
TEMPLATE_PATH = Path("/Users/mark/Downloads/Website Project - KPI Impact and Risk Tracker_MACXS (1).xlsx")
OUTPUT_DIR = BASE_DIR / "reports"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "docrel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "x14ac": "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac",
    "x15ac": "http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac",
    "xr": "http://schemas.microsoft.com/office/spreadsheetml/2014/revision",
    "xr2": "http://schemas.microsoft.com/office/spreadsheetml/2015/revision2",
    "xr3": "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3",
    "xr6": "http://schemas.microsoft.com/office/spreadsheetml/2016/revision6",
    "xr10": "http://schemas.microsoft.com/office/spreadsheetml/2016/revision10",
    "x15": "http://schemas.microsoft.com/office/spreadsheetml/2010/11/main",
    "xcalcf": "http://schemas.microsoft.com/office/spreadsheetml/2018/calcfeatures",
}

ET.register_namespace("", NS["main"])
ET.register_namespace("r", NS["docrel"])
ET.register_namespace("mc", NS["mc"])
ET.register_namespace("x14ac", NS["x14ac"])
ET.register_namespace("x15ac", NS["x15ac"])
ET.register_namespace("xr", NS["xr"])
ET.register_namespace("xr2", NS["xr2"])
ET.register_namespace("xr3", NS["xr3"])
ET.register_namespace("xr6", NS["xr6"])
ET.register_namespace("xr10", NS["xr10"])
ET.register_namespace("x15", NS["x15"])
ET.register_namespace("xcalcf", NS["xcalcf"])


@dataclass
class CohortEntry:
    key: str
    display_name: str
    role: str
    property_id: str
    sister_key: Optional[str]


def load_entries(path: Path) -> List[CohortEntry]:
    with path.open() as fh:
        config = json.load(fh)
    entries: List[CohortEntry] = []
    for row in config.get("cohorts", []):
        if not row.get("active", True):
            continue
        entries.append(
            CohortEntry(
                key=row["key"],
                display_name=row["display_name"],
                role=row["role"],
                property_id=str(row.get("property_id", "")),
                sister_key=row.get("sister_key"),
            )
        )
    return entries


def fmt_pct(value: Optional[float]) -> str:
    if value is None:
        return "Pending"
    return f"{value:+.1%}"


def fmt_num(value: Optional[float], digits: int = 1) -> str:
    if value is None:
        return "Pending"
    return f"{value:.{digits}f}"


def fmt_int(value: Optional[float]) -> str:
    if value is None:
        return "Pending"
    return f"{int(round(value))}"


def status_from_variance(value: Optional[float]) -> str:
    if value is None:
        return "Pending"
    if value >= 0.05:
        return "Green"
    if value <= -0.05:
        return "Red"
    return "Yellow"


def latest_dates(conn: sqlite3.Connection) -> dict:
    return {
        "psi": conn.execute("SELECT MAX(metric_date) FROM pilot_control_psi_metrics WHERE strategy='mobile'").fetchone()[0],
        "gt": conn.execute("SELECT MAX(metric_date) FROM gtmetrix_metrics").fetchone()[0],
        "ga": conn.execute("SELECT MAX(metric_date) FROM ga4_traffic_sources").fetchone()[0],
        "gc": conn.execute("SELECT MAX(run_date) FROM guest_card_metrics").fetchone()[0],
    }


def fetch_entry_metrics(conn: sqlite3.Connection, entries: List[CohortEntry]) -> Dict[str, dict]:
    conn.row_factory = sqlite3.Row
    data: Dict[str, dict] = {}
    latest_gc = conn.execute("SELECT MAX(run_date) FROM guest_card_metrics").fetchone()[0]
    for entry in entries:
        result = {
            "psi_score": None,
            "gt_score": None,
            "organic_sessions": None,
            "direct_sessions": None,
            "total_sessions": None,
            "organic_avg_7d": None,
            "total_avg_7d": None,
            "direct_avg_7d": None,
            "gc_this_period": None,
            "quotes_this_period": None,
            "tours_this_period": None,
            "apps_this_period": None,
            "available_units": None,
        }

        psi_row = conn.execute(
            """
            SELECT performance_score
            FROM pilot_control_psi_metrics
            WHERE cohort_key = ? AND strategy='mobile'
            ORDER BY metric_date DESC
            LIMIT 1
            """,
            (entry.key,),
        ).fetchone()
        if psi_row:
            result["psi_score"] = psi_row[0]

        gt_row = conn.execute(
            """
            SELECT pagespeed_score
            FROM gtmetrix_metrics
            WHERE property_id = ?
            ORDER BY metric_date DESC
            LIMIT 1
            """,
            (entry.property_id,),
        ).fetchone()
        if gt_row:
            result["gt_score"] = gt_row[0]

        traffic_row = conn.execute(
            """
            WITH latest AS (
              SELECT MAX(metric_date) AS md
              FROM ga4_traffic_sources
              WHERE property_id = ?
            ),
            today AS (
              SELECT
                SUM(CASE WHEN channel_group='Organic Search' THEN sessions ELSE 0 END) AS organic,
                SUM(CASE WHEN channel_group='Direct' THEN sessions ELSE 0 END) AS direct,
                SUM(sessions) AS total
              FROM ga4_traffic_sources
              WHERE property_id = ? AND metric_date = (SELECT md FROM latest)
            ),
            avg7 AS (
              SELECT
                AVG(organic) AS organic_avg,
                AVG(direct) AS direct_avg,
                AVG(total) AS total_avg
              FROM (
                SELECT
                  metric_date,
                  SUM(CASE WHEN channel_group='Organic Search' THEN sessions ELSE 0 END) AS organic,
                  SUM(CASE WHEN channel_group='Direct' THEN sessions ELSE 0 END) AS direct,
                  SUM(sessions) AS total
                FROM ga4_traffic_sources
                WHERE property_id = ?
                  AND metric_date >= date((SELECT md FROM latest), '-7 day')
                GROUP BY metric_date
              )
            )
            SELECT today.organic, today.direct, today.total, avg7.organic_avg, avg7.direct_avg, avg7.total_avg
            FROM today, avg7
            """,
            (entry.property_id, entry.property_id, entry.property_id),
        ).fetchone()
        if traffic_row:
            result["organic_sessions"] = traffic_row[0]
            result["direct_sessions"] = traffic_row[1]
            result["total_sessions"] = traffic_row[2]
            result["organic_avg_7d"] = traffic_row[3]
            result["direct_avg_7d"] = traffic_row[4]
            result["total_avg_7d"] = traffic_row[5]

        gc_row = conn.execute(
            """
            SELECT gc_this_period, quotes_this_period, ipt_appt_this_period, apps_this_period
            FROM guest_card_metrics
            WHERE property_name = ? AND run_date = ?
            LIMIT 1
            """,
            (entry.display_name, latest_gc),
        ).fetchone()
        if gc_row:
            result["gc_this_period"] = gc_row[0]
            result["quotes_this_period"] = gc_row[1]
            result["tours_this_period"] = gc_row[2]
            result["apps_this_period"] = gc_row[3]

        au_row = conn.execute(
            """
            WITH latest AS (
              SELECT MAX(last_seen_date) AS md
              FROM available_units
              WHERE property_id = ?
            )
            SELECT COUNT(*)
            FROM available_units
            WHERE property_id = ?
              AND last_seen_date = (SELECT md FROM latest)
              AND COALESCE(status, 'available') = 'available'
            """,
            (entry.property_id, entry.property_id),
        ).fetchone()
        if au_row:
            result["available_units"] = au_row[0]

        data[entry.key] = result
    return data


def aggregate_pilot_metrics(pilots: List[CohortEntry], metrics: Dict[str, dict]) -> dict:
    total = lambda key: sum((metrics[p.key].get(key) or 0) for p in pilots)
    gc_total = total("gc_this_period")
    apps_total = total("apps_this_period")
    avail_total = total("available_units")
    total_today = total("total_sessions")
    total_avg_7d = sum((metrics[p.key].get("total_avg_7d") or 0) for p in pilots)
    organic_today = total("organic_sessions")
    organic_avg_7d = sum((metrics[p.key].get("organic_avg_7d") or 0) for p in pilots)
    direct_today = total("direct_sessions")
    direct_avg_7d = sum((metrics[p.key].get("direct_avg_7d") or 0) for p in pilots)
    return {
        "gc_total": gc_total,
        "apps_total": apps_total,
        "avail_total": avail_total,
        "app_rate": (apps_total / gc_total) if gc_total else None,
        "gc_per_avail": (gc_total / avail_total) if avail_total else None,
        "gc_per_app": (gc_total / apps_total) if apps_total else None,
        "organic_today": organic_today,
        "organic_var_7d": ((organic_today - organic_avg_7d) / organic_avg_7d) if organic_avg_7d else None,
        "direct_today": direct_today,
        "direct_var_7d": ((direct_today - direct_avg_7d) / direct_avg_7d) if direct_avg_7d else None,
    }


def build_14_day_dates(latest_date: str) -> List[str]:
    anchor = datetime.strptime(latest_date, "%Y-%m-%d").date()
    return [(anchor - timedelta(days=offset)).isoformat() for offset in range(13, -1, -1)]


def get_cell(root: ET.Element, ref: str) -> Optional[ET.Element]:
    for cell in root.findall(".//main:c", NS):
        if cell.get("r") == ref:
            return cell
    return None


def split_ref(ref: str) -> tuple[str, int]:
    col = "".join(ch for ch in ref if ch.isalpha())
    row = int("".join(ch for ch in ref if ch.isdigit()))
    return col, row


def col_to_num(col: str) -> int:
    num = 0
    for ch in col:
        num = num * 26 + (ord(ch.upper()) - 64)
    return num


def ensure_cell(root: ET.Element, ref: str) -> ET.Element:
    existing = get_cell(root, ref)
    if existing is not None:
        return existing

    col, row_num = split_ref(ref)
    sheet_data = root.find("main:sheetData", NS)
    if sheet_data is None:
        raise KeyError("sheetData not found")

    row_el = None
    for r in sheet_data.findall("main:row", NS):
        if int(r.get("r")) == row_num:
            row_el = r
            break
    if row_el is None:
        row_el = ET.SubElement(sheet_data, f"{{{NS['main']}}}row", {"r": str(row_num)})

    new_cell = ET.Element(f"{{{NS['main']}}}c", {"r": ref})
    target_num = col_to_num(col)
    inserted = False
    for idx, cell in enumerate(list(row_el)):
        cell_col, _ = split_ref(cell.get("r"))
        if col_to_num(cell_col) > target_num:
            row_el.insert(idx, new_cell)
            inserted = True
            break
    if not inserted:
        row_el.append(new_cell)
    return new_cell


def set_cell_value(root: ET.Element, ref: str, value) -> None:
    cell = ensure_cell(root, ref)

    for child in list(cell):
        cell.remove(child)

    if value in (None, ""):
        cell.attrib.pop("t", None)
        return

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        cell.attrib.pop("t", None)
        v = ET.SubElement(cell, f"{{{NS['main']}}}v")
        v.text = str(value)
        return

    cell.set("t", "inlineStr")
    is_el = ET.SubElement(cell, f"{{{NS['main']}}}is")
    t_el = ET.SubElement(is_el, f"{{{NS['main']}}}t")
    text = str(value)
    if text.startswith(" ") or text.endswith(" ") or "\n" in text:
        t_el.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t_el.text = text


def remove_external_links(parts: Dict[str, bytes]) -> Dict[str, bytes]:
    workbook = ET.fromstring(parts["xl/workbook.xml"])
    ext_refs = workbook.find("main:externalReferences", NS)
    if ext_refs is not None:
        workbook.remove(ext_refs)
    parts["xl/workbook.xml"] = ET.tostring(workbook, encoding="utf-8", xml_declaration=True)

    rels = ET.fromstring(parts["xl/_rels/workbook.xml.rels"])
    for rel in list(rels):
        rel_type = rel.get("Type", "")
        target = rel.get("Target", "")
        if rel_type.endswith("/externalLink") or rel_type.endswith("/calcChain"):
            rels.remove(rel)
            if target.startswith("externalLinks/"):
                parts.pop(f"xl/{target}", None)
                rels_path = f"xl/externalLinks/_rels/{Path(target).name}.rels"
                parts.pop(rels_path, None)
            if target == "calcChain.xml":
                parts.pop("xl/calcChain.xml", None)
    parts["xl/_rels/workbook.xml.rels"] = ET.tostring(rels, encoding="utf-8", xml_declaration=True)

    content_types = ET.fromstring(parts["[Content_Types].xml"])
    for override in list(content_types):
        part_name = override.get("PartName", "")
        if part_name in ("/xl/calcChain.xml", "/xl/externalLinks/externalLink1.xml"):
            content_types.remove(override)
    parts["[Content_Types].xml"] = ET.tostring(content_types, encoding="utf-8", xml_declaration=True)

    return parts


def populate_exec_dashboard(root: ET.Element, dates: dict) -> None:
    set_cell_value(root, "F2", f"Live source: PSI through {dates['psi']} and GTMetrix through {dates['gt']}. CWV pass-rate logic to be added.")
    set_cell_value(root, "F3", f"Live source: GA4 Organic Search through {dates['ga']}. T12 and market-adjusted baseline still to be defined.")
    set_cell_value(root, "F4", "Awaiting Heap export.")
    set_cell_value(root, "F5", f"Live source: guest-card snapshot through {dates['gc']}; available-unit counts are current. Baseline logic still pending.")
    set_cell_value(root, "F6", "Awaiting Snowflake / BI funnel export.")


def populate_heap(root: ET.Element, dates: dict) -> None:
    set_cell_value(root, "C3", dates["ga"])
    set_cell_value(root, "F3", "Awaiting Heap feed")
    set_cell_value(root, "C6", "Awaiting Heap users")
    set_cell_value(root, "G6", "Awaiting Heap clicks")
    set_cell_value(root, "K6", "Awaiting Heap CTR")
    for ref in ("C7", "G7", "K7"):
        set_cell_value(root, ref, "")
    set_cell_value(root, "C9", "Pending")
    set_cell_value(root, "G9", "Pending")
    set_cell_value(root, "K9", "Pending")
    for row, label_date in zip(range(16, 30), build_14_day_dates(dates["ga"])):
        set_cell_value(root, f"B{row}", label_date)
        set_cell_value(root, f"C{row}", "")
        set_cell_value(root, f"D{row}", "")
        set_cell_value(root, f"E{row}", "")
    set_cell_value(root, "B34", "Heap feed is not connected yet. Keep this tab structure intact and populate once the extract is available.")


def populate_operations(root: ET.Element, dates: dict, pilot_agg: dict) -> None:
    set_cell_value(root, "C3", dates["gc"])
    set_cell_value(root, "F3", "Partial: operations live / Heap pending")
    set_cell_value(root, "C7", "Awaiting Heap")
    set_cell_value(root, "G7", pilot_agg["gc_total"])
    set_cell_value(root, "K7", pilot_agg["app_rate"] if pilot_agg["app_rate"] is not None else "Pending")
    set_cell_value(root, "O7", pilot_agg["gc_total"])
    for ref in ("C8", "G8", "K8", "O8", "P17", "T17"):
        set_cell_value(root, ref, "")
    set_cell_value(root, "C10", "Pending")
    set_cell_value(root, "G10", "Pending")
    set_cell_value(root, "K10", "Live")
    set_cell_value(root, "O10", "Live")
    set_cell_value(root, "C15", pilot_agg["gc_per_avail"] if pilot_agg["gc_per_avail"] is not None else "Pending")
    set_cell_value(root, "I16", pilot_agg["gc_per_app"] if pilot_agg["gc_per_app"] is not None else "Pending")
    set_cell_value(root, "P16", pilot_agg["organic_today"])
    set_cell_value(root, "T16", pilot_agg["direct_today"])
    set_cell_value(root, "P17", pilot_agg["organic_var_7d"] if pilot_agg["organic_var_7d"] is not None else "")
    set_cell_value(root, "T17", pilot_agg["direct_var_7d"] if pilot_agg["direct_var_7d"] is not None else "")
    set_cell_value(root, "P19", status_from_variance(pilot_agg["organic_var_7d"]))
    set_cell_value(root, "T19", status_from_variance(pilot_agg["direct_var_7d"]))
    for row, label_date in zip(range(22, 36), build_14_day_dates(dates["gc"])):
        set_cell_value(root, f"B{row}", label_date)
        set_cell_value(root, f"C{row}", "")
        set_cell_value(root, f"D{row}", "")
        set_cell_value(root, f"E{row}", "")


def metric_block_rows() -> List[int]:
    return [2, 14, 24, 35, 46]


def write_metric_block(root: ET.Element, start_row: int, pilot: CohortEntry, sister: Optional[CohortEntry], metrics: Dict[str, dict]) -> None:
    p = metrics[pilot.key]
    s = metrics[sister.key] if sister else {}

    baseline_text = "Pending T12 / YoY baseline"
    cwv_text = f"PSI {fmt_int(p.get('psi_score'))} | GT {fmt_num(p.get('gt_score'))}"
    sister_cwv = f"PSI {fmt_int(s.get('psi_score'))} | GT {fmt_num(s.get('gt_score'))}" if sister else "Pending"
    gc_per_avail = ((p.get("gc_this_period") or 0) / (p.get("available_units") or 0)) if (p.get("gc_this_period") and p.get("available_units")) else None
    app_rate = ((p.get("apps_this_period") or 0) / (p.get("gc_this_period") or 0)) if p.get("gc_this_period") else None
    total_var = (((p.get("total_sessions") or 0) - (p.get("total_avg_7d") or 0)) / (p.get("total_avg_7d") or 0)) if p.get("total_avg_7d") else None
    organic_var = (((p.get("organic_sessions") or 0) - (p.get("organic_avg_7d") or 0)) / (p.get("organic_avg_7d") or 0)) if p.get("organic_avg_7d") else None
    sister_gc_per_avail = ((s.get("gc_this_period") or 0) / (s.get("available_units") or 0)) if (sister and s.get("gc_this_period") and s.get("available_units")) else None
    sister_app_rate = ((s.get("apps_this_period") or 0) / (s.get("gc_this_period") or 0)) if (sister and s.get("gc_this_period")) else None

    title = pilot.display_name if pilot.display_name != "The District Universal Boulevard" else "The District"
    set_cell_value(root, f"A{start_row}", title)

    def put(row: int, values: List[str]) -> None:
        for idx, value in enumerate(values, start=2):
            set_cell_value(root, f"{chr(64+idx)}{row}", value)

    put(start_row + 1, [baseline_text] * 7)
    put(start_row + 2, [baseline_text] * 7)
    put(
        start_row + 3,
        [
            fmt_int(s.get("total_sessions")) if sister else "Pending",
            sister.display_name if sister else "Pending",
            "Awaiting Heap",
            fmt_int(s.get("gc_this_period")) if sister else "Pending",
            fmt_num(sister_gc_per_avail, 3) if sister else "Pending",
            fmt_pct(sister_app_rate) if sister else "Pending",
            sister_cwv,
        ],
    )
    put(
        start_row + 4,
        [
            fmt_int(p.get("total_sessions")),
            fmt_int(p.get("organic_sessions")),
            "Awaiting Heap",
            fmt_int(p.get("gc_this_period")),
            fmt_num(gc_per_avail, 3),
            fmt_pct(app_rate),
            cwv_text,
        ],
    )
    put(start_row + 5, [fmt_pct(total_var), fmt_pct(organic_var), "Pending", "Pending", "Pending", "Pending", "Pending"])
    put(start_row + 6, ["Pending"] * 7)
    put(start_row + 7, ["Pending"] * 7)
    if start_row in (24, 35, 46):
        put(start_row + 8, ["Pending"] * 7)
    put(start_row + 9 if start_row in (24, 35, 46) else start_row + 8, ["Thresholds pending"] * 7)


def populate_metric_measurement(root: ET.Element, pilots: List[CohortEntry], entry_index: Dict[str, CohortEntry], metrics: Dict[str, dict]) -> None:
    for start_row, pilot in zip(metric_block_rows(), pilots):
        sister = entry_index.get(pilot.sister_key or "")
        write_metric_block(root, start_row, pilot, sister, metrics)
    set_cell_value(root, "A57", "")


def patch_package(parts: Dict[str, bytes], dates: dict, pilots: List[CohortEntry], entries: List[CohortEntry], metrics: Dict[str, dict], pilot_agg: dict) -> Dict[str, bytes]:
    parts = remove_external_links(parts)

    exec_root = ET.fromstring(parts["xl/worksheets/sheet1.xml"])
    heap_root = ET.fromstring(parts["xl/worksheets/sheet4.xml"])
    ops_root = ET.fromstring(parts["xl/worksheets/sheet5.xml"])
    mm_root = ET.fromstring(parts["xl/worksheets/sheet6.xml"])

    populate_exec_dashboard(exec_root, dates)
    populate_heap(heap_root, dates)
    populate_operations(ops_root, dates, pilot_agg)
    entry_index = {entry.key: entry for entry in entries}
    populate_metric_measurement(mm_root, pilots, entry_index, metrics)

    parts["xl/workbook.xml"] = fix_root_prefix_declarations(
        "xl/workbook.xml",
        parts["xl/workbook.xml"],
    )
    parts["xl/worksheets/sheet1.xml"] = fix_root_prefix_declarations(
        "xl/worksheets/sheet1.xml",
        ET.tostring(exec_root, encoding="utf-8", xml_declaration=True),
    )
    parts["xl/worksheets/sheet4.xml"] = fix_root_prefix_declarations(
        "xl/worksheets/sheet4.xml",
        ET.tostring(heap_root, encoding="utf-8", xml_declaration=True),
    )
    parts["xl/worksheets/sheet5.xml"] = fix_root_prefix_declarations(
        "xl/worksheets/sheet5.xml",
        ET.tostring(ops_root, encoding="utf-8", xml_declaration=True),
    )
    parts["xl/worksheets/sheet6.xml"] = fix_root_prefix_declarations(
        "xl/worksheets/sheet6.xml",
        ET.tostring(mm_root, encoding="utf-8", xml_declaration=True),
    )
    return parts


def fix_root_prefix_declarations(name: str, data: bytes) -> bytes:
    text = data.decode("utf-8")
    if name == "xl/workbook.xml":
        insert = (
            ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            ' xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"'
            ' xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac"'
            ' xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"'
            ' xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"'
            ' xmlns:xr6="http://schemas.microsoft.com/office/spreadsheetml/2016/revision6"'
            ' xmlns:xr10="http://schemas.microsoft.com/office/spreadsheetml/2016/revision10"'
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            ' xmlns:xcalcf="http://schemas.microsoft.com/office/spreadsheetml/2018/calcfeatures"'
        )
        text = text.replace("<workbook ", f"<workbook{insert} ", 1)
    elif name.startswith("xl/worksheets/sheet"):
        insert = (
            ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            ' xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"'
            ' xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"'
            ' xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"'
            ' xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"'
        )
        text = text.replace("<worksheet ", f"<worksheet{insert} ", 1)
    return text.encode("utf-8")


def main() -> int:
    entries = load_entries(CONFIG_PATH)
    pilots = [entry for entry in entries if entry.role == "pilot"]

    with sqlite3.connect(DB_PATH) as conn:
        dates = latest_dates(conn)
        metrics = fetch_entry_metrics(conn, entries)
        pilot_agg = aggregate_pilot_metrics(pilots, metrics)

    with zipfile.ZipFile(TEMPLATE_PATH, "r") as zin:
        parts = {name: zin.read(name) for name in zin.namelist()}

    parts = patch_package(parts, dates, pilots, entries, metrics, pilot_agg)

    output_path = OUTPUT_DIR / f"Website Project - KPI Impact and Risk Tracker_Populated_{date.today().isoformat()}.xlsx"
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in parts.items():
            zout.writestr(name, data)

    print(f"Saved populated workbook: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
