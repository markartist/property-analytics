#!/usr/bin/env python3
"""
Update measurement dashboard CWV cells through Microsoft Graph Excel APIs.

Requires either:
- GRAPH_ACCESS_TOKEN, or
- GRAPH_CLIENT_ID (public client app) and optional GRAPH_TENANT_ID
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import requests

from measurement_dashboard_parser import MEASUREMENT_DROP_DIR, resolve_measurement_path


ROOT = Path("/Users/mark/Property_Analytics")
DEFAULT_CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"


def default_workbook_relative_path() -> str:
    workbook = resolve_measurement_path()
    try:
        return "/" + workbook.relative_to(MEASUREMENT_DROP_DIR.parent).as_posix()
    except ValueError:
        return f"/Guest_Card_Reports/{workbook.name}"

PROPERTY_ROW_ALIASES = {
    "Calais Midtown": "Calais",
    "Champions Green": "Champions Green",
    "The District Universal Boulevard": "District",
    "The Harrison": "Harrison",
    "Ventana": "Ventana",
    "Avasa Spring Branch": "Spring Branch",
    "Axial Buckhead": "Axial",
    "Northbridge at Millenia Lake": "Northbridge",
    "The Whitney": "Whitney",
    "Park on Wurzbach": "Wurzbach",
}

ROW_INDEX_BY_ALIAS = {
    "District": 3,
    "Ventana": 4,
    "Calais": 5,
    "Champions Green": 6,
    "Harrison": 7,
    "Northbridge": 10,
    "Wurzbach": 11,
    "Spring Branch": 12,
    "Axial": 13,
    "Whitney": 14,
}


@dataclass
class CohortRow:
    key: str
    display_name: str
    role: str
    property_id: str


def load_config(path: Path) -> Dict[str, object]:
    with path.open() as fh:
        return json.load(fh)


def load_rows(path: Path) -> List[CohortRow]:
    config = load_config(path)
    return [
        CohortRow(
            key=row["key"],
            display_name=row["display_name"],
            role=row["role"],
            property_id=str(row["property_id"]),
        )
        for row in config["cohorts"]
        if row.get("active", True)
    ]


def get_token_from_device_code(client_id: str, tenant_id: str, scopes: List[str]) -> str:
    base = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0"
    device = requests.post(
        f"{base}/devicecode",
        data={"client_id": client_id, "scope": " ".join(scopes)},
        timeout=30,
    )
    device.raise_for_status()
    payload = device.json()
    print(payload["message"])
    interval = int(payload.get("interval", 5))
    deadline = time.time() + int(payload.get("expires_in", 900))

    while time.time() < deadline:
        token = requests.post(
            f"{base}/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "client_id": client_id,
                "device_code": payload["device_code"],
            },
            timeout=30,
        )
        if token.status_code == 200:
            token_payload = token.json()
            return token_payload["access_token"]

        error_payload = token.json()
        error_code = error_payload.get("error")
        if error_code == "authorization_pending":
            time.sleep(interval)
            continue
        if error_code == "slow_down":
            interval += 5
            time.sleep(interval)
            continue
        raise requests.HTTPError(
            f"Device code flow failed: {error_payload}",
            response=token,
        )

    raise TimeoutError("Timed out waiting for Microsoft Graph device code authorization.")


def graph_headers(token: str, session_id: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if session_id:
        headers["workbook-session-id"] = session_id
    return headers


def resolve_item_id(token: str, relative_path: str) -> str:
    url = f"https://graph.microsoft.com/v1.0/me/drive/root:{relative_path}"
    response = requests.get(url, headers=graph_headers(token), timeout=30)
    response.raise_for_status()
    return response.json()["id"]


def create_session(token: str, item_id: str) -> str:
    url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/createSession"
    response = requests.post(url, headers=graph_headers(token), json={"persistChanges": True}, timeout=30)
    response.raise_for_status()
    return response.json()["id"]


def close_session(token: str, item_id: str, session_id: str) -> None:
    url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/closeSession"
    response = requests.post(url, headers=graph_headers(token, session_id), timeout=30)
    response.raise_for_status()


def patch_range(token: str, item_id: str, session_id: str, sheet_name: str, address: str, values: List[List[object]]) -> None:
    url = (
        f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/"
        f"worksheets('{sheet_name}')/range(address='{sheet_name}!{address}')"
    )
    response = requests.patch(url, headers=graph_headers(token, session_id), json={"values": values}, timeout=30)
    response.raise_for_status()


def latest_scores(conn: sqlite3.Connection, rows: List[CohortRow], metric_date: str) -> tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    psi_scores: Dict[str, Optional[float]] = {}
    gt_scores: Dict[str, Optional[float]] = {}
    for row in rows:
        psi = conn.execute(
            """
            SELECT performance_score
            FROM pilot_control_psi_metrics
            WHERE cohort_key = ?
              AND strategy = 'mobile'
              AND metric_date = ?
            """,
            (row.key, metric_date),
        ).fetchone()
        gt = conn.execute(
            """
            SELECT pagespeed_score
            FROM gtmetrix_metrics
            WHERE property_id = ?
              AND metric_date = ?
            """,
            (row.property_id, metric_date),
        ).fetchone()
        psi_scores[row.display_name] = float(psi[0]) if psi and psi[0] is not None else None
        gt_scores[row.display_name] = round(float(gt[0])) if gt and gt[0] is not None else None
    return psi_scores, gt_scores


def build_column_values(rows: List[CohortRow], score_map: Dict[str, Optional[float]]) -> List[List[object]]:
    values: List[List[object]] = []
    ordered = sorted(rows, key=lambda r: ROW_INDEX_BY_ALIAS[PROPERTY_ROW_ALIASES[r.display_name]])
    for row in ordered:
        score = score_map[row.display_name]
        values.append([score if score is not None else ""])
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description="Update measurement dashboard through Microsoft Graph")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--sheet-date", required=True, help="Workbook sheet date YYYY-MM-DD, e.g. 2026-04-10")
    parser.add_argument("--metric-date", required=True, help="Metric date YYYY-MM-DD, e.g. 2026-04-10")
    parser.add_argument("--relative-path", default=default_workbook_relative_path(), help="OneDrive path from drive root")
    parser.add_argument("--update-psi", action="store_true")
    parser.add_argument("--update-gt", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rows = load_rows(Path(args.config))
    conn = sqlite3.connect(Path(args.db))
    psi_scores, gt_scores = latest_scores(conn, rows, args.metric_date)
    conn.close()

    sheet_name_parts = args.sheet_date.split("-")
    sheet_name = f"{int(sheet_name_parts[1])}.{int(sheet_name_parts[2])}.{sheet_name_parts[0][2:]}"

    token = os.getenv("GRAPH_ACCESS_TOKEN")
    if not token:
        client_id = os.getenv("GRAPH_CLIENT_ID")
        tenant_id = os.getenv("GRAPH_TENANT_ID", "organizations")
        if not client_id:
            raise SystemExit("Set GRAPH_ACCESS_TOKEN or GRAPH_CLIENT_ID before using Graph updater.")
        token = get_token_from_device_code(client_id, tenant_id, ["Files.ReadWrite"])

    item_id = resolve_item_id(token, args.relative_path)
    session_id = create_session(token, item_id)
    try:
        if args.update_psi:
            patch_range(
                token,
                item_id,
                session_id,
                sheet_name,
                "C3:C7",
                build_column_values([r for r in rows if r.role == "pilot"], psi_scores),
            )
            patch_range(
                token,
                item_id,
                session_id,
                sheet_name,
                "C10:C14",
                build_column_values([r for r in rows if r.role == "control"], psi_scores),
            )
        if args.update_gt:
            patch_range(
                token,
                item_id,
                session_id,
                sheet_name,
                "E3:E7",
                build_column_values([r for r in rows if r.role == "pilot"], gt_scores),
            )
            patch_range(
                token,
                item_id,
                session_id,
                sheet_name,
                "E10:E14",
                build_column_values([r for r in rows if r.role == "control"], gt_scores),
            )
    finally:
        close_session(token, item_id, session_id)

    print(f"Updated workbook via Graph: {args.relative_path}")
    print(f"Sheet: {sheet_name}")
    print(f"Metric date: {args.metric_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
