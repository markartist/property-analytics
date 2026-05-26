#!/usr/bin/env python3
"""
CWV history backfill utility.

Implements:
1) Honest historical export from existing pagespeed_metrics (no synthetic fill).
3) CrUX history pull + storage (requires chromeuxreport.googleapis.com enabled).
"""

import argparse
import csv
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Data_Collection.db.database_manager import DatabaseManager
from utils.ksm import resolve_secret_from_multiple_notations


DB_PATH = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
REGISTRY_PATH = Path("/Users/mark/Property_Analytics/config/venterra_properties_official.json")
PSI_API_KEY_FILE = Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/pagespeed_api_key.txt")
CRUX_HISTORY_URL = "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord"


def _load_registry() -> Dict[str, Any]:
    with open(REGISTRY_PATH, "r") as f:
        return json.load(f)


def _load_psi_api_key() -> str:
    return resolve_secret_from_multiple_notations(
        description="PageSpeed API key",
        notation_env_vars=[
            "KSM_PAGESPEED_API_KEY_NOTATION",
            "KSM_PAGESPEED_API_KEY_FILE_NOTATION",
        ],
        direct_env_var="PAGESPEED_API_KEY",
        file_path=PSI_API_KEY_FILE,
        default_profile="marketingops",
    )


def _resolve_property(prop_input: str) -> Dict[str, Any]:
    registry = _load_registry().get("properties", [])
    lowered = prop_input.lower().strip()
    for p in registry:
        if p.get("name", "").lower() == lowered or p.get("ga4_property_id") == prop_input:
            return p
    matches = [p for p in registry if lowered in p.get("name", "").lower()]
    if len(matches) == 1:
        return matches[0]
    if not matches:
        raise ValueError(f"Property not found: {prop_input}")
    raise ValueError(f"Ambiguous property '{prop_input}' ({len(matches)} matches)")


def _daterange(start: date, end: date) -> List[date]:
    days = (end - start).days + 1
    return [start + timedelta(days=i) for i in range(days)]


def export_honest_cwv_history(
    db: DatabaseManager,
    property_id: str,
    property_name: str,
    start_date: date,
    end_date: date
) -> Tuple[Path, Dict[str, Any]]:
    rows_by_date: Dict[str, Dict[str, Any]] = {}
    with db.get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT metric_date, strategy, performance_score, seo_score,
                   lcp_value, fid_value, cls_value, fcp_value, speed_index, total_blocking_time
            FROM pagespeed_metrics
            WHERE property_id = ?
              AND metric_date BETWEEN ? AND ?
            ORDER BY metric_date ASC
        """, (property_id, start_date.isoformat(), end_date.isoformat()))
        for r in cur.fetchall():
            d = r[0]
            s = (r[1] or "").lower()
            if d not in rows_by_date:
                rows_by_date[d] = {}
            rows_by_date[d][f"{s}_performance_score"] = r[2]
            rows_by_date[d][f"{s}_seo_score"] = r[3]
            rows_by_date[d][f"{s}_lcp"] = r[4]
            rows_by_date[d][f"{s}_fid"] = r[5]
            rows_by_date[d][f"{s}_cls"] = r[6]
            rows_by_date[d][f"{s}_fcp"] = r[7]
            rows_by_date[d][f"{s}_speed_index"] = r[8]
            rows_by_date[d][f"{s}_tbt"] = r[9]

    out_dir = Path("/Users/mark/Property_Analytics/reports/adhoc")
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = property_name.lower().replace(" ", "-").replace("/", "-")
    out_file = out_dir / f"{date.today().isoformat()}__CWV-History-Honest__{slug}__{start_date}_to_{end_date}.csv"

    headers = [
        "date",
        "has_desktop", "has_mobile", "is_missing_any",
        "desktop_performance_score", "desktop_seo_score", "desktop_lcp", "desktop_fid", "desktop_cls", "desktop_fcp", "desktop_speed_index", "desktop_tbt",
        "mobile_performance_score", "mobile_seo_score", "mobile_lcp", "mobile_fid", "mobile_cls", "mobile_fcp", "mobile_speed_index", "mobile_tbt",
    ]

    missing_days = 0
    with open(out_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for d in _daterange(start_date, end_date):
            ds = d.isoformat()
            r = rows_by_date.get(ds, {})
            has_desktop = any(k.startswith("desktop_") for k in r.keys())
            has_mobile = any(k.startswith("mobile_") for k in r.keys())
            if not (has_desktop and has_mobile):
                missing_days += 1
            writer.writerow({
                "date": ds,
                "has_desktop": int(has_desktop),
                "has_mobile": int(has_mobile),
                "is_missing_any": int(not (has_desktop and has_mobile)),
                **{h: r.get(h) for h in headers if h not in {"date", "has_desktop", "has_mobile", "is_missing_any"}}
            })

    summary = {
        "window_start": start_date.isoformat(),
        "window_end": end_date.isoformat(),
        "total_days": len(_daterange(start_date, end_date)),
        "days_missing_any_surface": missing_days,
        "csv_path": str(out_file)
    }
    return out_file, summary


def _load_api_key() -> str:
    return _load_psi_api_key()


def _extract_period_dates(period: Dict[str, Any]) -> Tuple[str, str]:
    f = period.get("firstDate", {})
    l = period.get("lastDate", {})
    start = f"{int(f.get('year', 1970)):04d}-{int(f.get('month', 1)):02d}-{int(f.get('day', 1)):02d}"
    end = f"{int(l.get('year', 1970)):04d}-{int(l.get('month', 1)):02d}-{int(l.get('day', 1)):02d}"
    return start, end


def collect_crux_history(
    db: DatabaseManager,
    property_id: str,
    property_url: str,
    collection_period_count: int = 40
) -> Dict[str, Any]:
    api_key = _load_api_key()
    metrics = [
        "largest_contentful_paint",
        "cumulative_layout_shift",
        "experimental_interaction_to_next_paint",
        "first_contentful_paint",
        "experimental_time_to_first_byte",
    ]
    inserted = 0

    for form_factor in ["PHONE", "DESKTOP"]:
        payload = {
            "url": property_url,
            "formFactor": form_factor,
            "metrics": metrics,
            "collectionPeriodCount": collection_period_count,
        }
        resp = requests.post(CRUX_HISTORY_URL, params={"key": api_key}, json=payload, timeout=45)
        if resp.status_code != 200:
            detail = ""
            try:
                body = resp.json()
                detail = body.get("error", {}).get("message", "")
            except Exception:
                detail = resp.text[:200]
            return {
                "ok": False,
                "status_code": resp.status_code,
                "error": detail,
                "inserted_rows": inserted
            }

        body = resp.json()
        record = body.get("record", {})
        periods = record.get("collectionPeriods", []) or []
        metric_map = record.get("metrics", {}) or {}

        for metric_name, metric_data in metric_map.items():
            p75s = (((metric_data or {}).get("percentilesTimeseries") or {}).get("p75s")) or []
            n = min(len(periods), len(p75s))
            for i in range(n):
                start, end = _extract_period_dates(periods[i])
                raw = p75s[i]
                value = None
                if raw is not None:
                    try:
                        value = float(raw)
                    except Exception:
                        value = None
                db.insert_crux_history_metric(
                    property_id=property_id,
                    property_url=property_url,
                    form_factor=form_factor,
                    metric_name=metric_name,
                    period_start_date=start,
                    period_end_date=end,
                    p75_value=value,
                    raw_value=str(raw) if raw is not None else None
                )
                inserted += 1

    return {"ok": True, "inserted_rows": inserted}


def _process_property(db: DatabaseManager, prop: Dict[str, Any], days: int, skip_crux: bool) -> int:
    property_id = prop["ga4_property_id"]
    property_name = prop["name"]
    property_url = prop.get("full_url") or prop.get("gsc_url")
    if not property_url:
        print(f"Skipping {property_name}: no URL")
        return 1

    end = date.today()
    start = end - timedelta(days=max(days - 1, 0))
    csv_path, honest_summary = export_honest_cwv_history(
        db=db,
        property_id=property_id,
        property_name=property_name,
        start_date=start,
        end_date=end
    )
    print(f"[{property_name}] Honest CWV export: {csv_path}")
    print(json.dumps(honest_summary, indent=2))

    if skip_crux:
        return 0

    crux = collect_crux_history(db=db, property_id=property_id, property_url=property_url, collection_period_count=40)
    if crux.get("ok"):
        print(f"[{property_name}] CrUX history collection: inserted/updated {crux.get('inserted_rows', 0)} rows")
        return 0

    print(f"[{property_name}] CrUX history collection failed:")
    print(json.dumps(crux, indent=2))
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill honest CWV history + collect CrUX history")
    parser.add_argument("--property", help="Property name or GA4 ID")
    parser.add_argument("--all", action="store_true", help="Run for all properties in registry")
    parser.add_argument("--days", type=int, default=365, help="Trailing days for honest export (default: 365)")
    parser.add_argument("--skip-crux", action="store_true", help="Skip CrUX history API call")
    args = parser.parse_args()

    if not args.all and not args.property:
        parser.error("Provide --property or --all")
    if args.all and args.property:
        parser.error("Use either --property or --all, not both")

    db = DatabaseManager(DB_PATH)
    if args.property:
        prop = _resolve_property(args.property)
        return _process_property(db, prop, args.days, args.skip_crux)

    failures = 0
    for prop in _load_registry().get("properties", []):
        if not prop.get("ga4_property_id"):
            continue
        failures += _process_property(db, prop, args.days, args.skip_crux)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
