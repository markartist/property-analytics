#!/usr/bin/env python3
"""
Backfill SEMrush monthly snapshots (display_date=YYYYMM15) for selected properties.

This pulls real historical SEMrush snapshots and writes them to semrush_domain_metrics
with metric_date aligned to each snapshot date.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
API_KEY_PATH = ROOT / "Spotlight_Properties_Report" / "config" / "SEMRush_API_Key.txt"
SEMRUSH_URL = "https://api.semrush.com/"


@dataclass
class Target:
    request_name: str
    property_id: str
    canonical_name: str


TARGETS: List[Target] = [
    Target("Coho", "378415300", "CoHo"),
    Target("Estancia", "378432451", "Estancia at Morningstar"),
    Target("Pheonix", "378402543", "The Phoenix"),
    Target("Republic park", "378383339", "Republic Park Vista"),
    Target("Villa lago", "378284749", "Villa Lago"),
    Target("Norman", "383878732", "Anatole at Norman"),
    Target("Botanic", "453129717", "Botanic Luxury"),
    Target("Cendana", "424416990", "Cendana District West"),
    Target("Fairways", "378444042", "Fairways at South Shore"),
]

# Deeper monthly history for stronger trend confidence.
SNAPSHOT_MONTHS = [
    "20250315",
    "20250415",
    "20250515",
    "20250615",
    "20250715",
    "20250815",
    "20250915",
    "20251015",
    "20251115",
    "20251215",
    "20260115",
]


def load_registry_urls() -> Dict[str, str]:
    registry = json.loads(REGISTRY_PATH.read_text())
    mapping: Dict[str, str] = {}
    for p in registry.get("properties", []):
        pid = p.get("ga4_property_id")
        full_url = p.get("full_url") or p.get("url")
        if pid and full_url:
            mapping[pid] = full_url
    return mapping


def extract_domain_and_path(full_url: str) -> Tuple[str, str]:
    url = full_url.replace("https://", "").replace("http://", "")
    parts = url.split("/", 1)
    domain = parts[0].strip().lower()
    path = "/" + parts[1] if len(parts) > 1 else "/"
    if not path.endswith("/"):
        path += "/"
    return domain, path


def fetch_snapshot(api_key: str, domain: str, path: str, display_date: str) -> Optional[Dict[str, float]]:
    params = {
        "type": "domain_organic",
        "key": api_key,
        "display_limit": 100,
        "export_columns": "Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Nr",
        "domain": domain,
        "display_filter": f"+|Ur|Co|{path}",
        "database": "us",
        "display_date": display_date,
    }
    resp = requests.get(SEMRUSH_URL, params=params, timeout=30)
    if resp.status_code != 200:
        return None
    lines = [ln for ln in resp.text.strip().split("\n") if ln.strip()]
    if not lines:
        return None
    if lines[0].startswith("ERROR 50"):
        return None
    if len(lines) < 2:
        return None

    keyword_count = 0
    top_3 = 0
    top_10 = 0
    top_100 = 0
    traffic_est = 0.0
    traffic_cost_est = 0.0
    positions: List[float] = []

    for line in lines[1:]:
        fields = line.split(";")
        if len(fields) < 9:
            continue
        try:
            pos = float(fields[1]) if fields[1] else 0.0
            tr = float(fields[5]) if fields[5] else 0.0
            tc = float(fields[6]) if fields[6] else 0.0
        except ValueError:
            continue

        keyword_count += 1
        if pos > 0:
            positions.append(pos)
            if pos <= 3:
                top_3 += 1
            if pos <= 10:
                top_10 += 1
            if pos <= 100:
                top_100 += 1
        traffic_est += tr
        traffic_cost_est += tc

    avg_position = (sum(positions) / len(positions)) if positions else None
    return {
        "organic_keywords_count": float(keyword_count),
        "organic_keywords_top_3": float(top_3),
        "organic_keywords_top_10": float(top_10),
        "organic_keywords_top_100": float(top_100),
        "organic_traffic_estimate": float(round(traffic_est)),
        "organic_traffic_cost_estimate": float(round(traffic_cost_est, 2)),
        "average_position": avg_position,
    }


def upsert_semrush(conn: sqlite3.Connection, property_id: str, metric_date: str, data: Dict[str, float]) -> None:
    conn.execute(
        """
        INSERT INTO semrush_domain_metrics (
            property_id, metric_date,
            organic_keywords_count, organic_keywords_top_3, organic_keywords_top_10, organic_keywords_top_100,
            organic_traffic_estimate, organic_traffic_cost_estimate, average_position, collected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(property_id, metric_date) DO UPDATE SET
            organic_keywords_count = excluded.organic_keywords_count,
            organic_keywords_top_3 = excluded.organic_keywords_top_3,
            organic_keywords_top_10 = excluded.organic_keywords_top_10,
            organic_keywords_top_100 = excluded.organic_keywords_top_100,
            organic_traffic_estimate = excluded.organic_traffic_estimate,
            organic_traffic_cost_estimate = excluded.organic_traffic_cost_estimate,
            average_position = excluded.average_position,
            collected_at = CURRENT_TIMESTAMP
        """,
        (
            property_id,
            metric_date,
            data["organic_keywords_count"],
            data["organic_keywords_top_3"],
            data["organic_keywords_top_10"],
            data["organic_keywords_top_100"],
            data["organic_traffic_estimate"],
            data["organic_traffic_cost_estimate"],
            data["average_position"],
        ),
    )


def main() -> int:
    api_key = API_KEY_PATH.read_text().strip()
    url_map = load_registry_urls()
    conn = sqlite3.connect(DB_PATH)

    inserted = 0
    missing = 0
    failed = 0

    try:
        for target in TARGETS:
            full_url = url_map.get(target.property_id)
            if not full_url:
                print(f"missing_url,{target.request_name},{target.property_id}")
                missing += len(SNAPSHOT_MONTHS)
                continue
            domain, path = extract_domain_and_path(full_url)
            for snap in SNAPSHOT_MONTHS:
                metric_date = f"{snap[:4]}-{snap[4:6]}-{snap[6:8]}"
                data = fetch_snapshot(api_key, domain, path, snap)
                if not data:
                    print(f"no_data,{target.request_name},{metric_date}")
                    missing += 1
                else:
                    upsert_semrush(conn, target.property_id, metric_date, data)
                    inserted += 1
                    print(f"upserted,{target.request_name},{metric_date},{int(data['organic_keywords_count'])}")
                time.sleep(0.8)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f"error,{exc}")
        failed += 1
    finally:
        conn.close()

    print(f"summary,inserted={inserted},missing={missing},failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
