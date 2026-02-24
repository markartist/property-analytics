#!/usr/bin/env python3
"""
SEM/SEO T60 audit for selected properties.

Outputs:
1) CSV companion file with per-property SEM + SEO comparisons
2) Email summary with attached CSV
"""

from __future__ import annotations

import csv
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import sys

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUTPUT_DIR = ROOT / "reports" / "audits"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT / "scripts"))
from send_sem_seo_t60_pib import send_pib_email  # noqa: E402


@dataclass
class PropertySpec:
    request_name: str
    property_id: str
    canonical_name: str


PROPERTY_SPECS: List[PropertySpec] = [
    PropertySpec("Coho", "378415300", "CoHo"),
    PropertySpec("Estancia", "378432451", "Estancia at Morningstar"),
    PropertySpec("Pheonix", "378402543", "The Phoenix"),
    PropertySpec("Republic park", "378383339", "Republic Park Vista"),
    PropertySpec("Villa lago", "378284749", "Villa Lago"),
    PropertySpec("Norman", "383878732", "Anatole at Norman"),
    PropertySpec("Botanic", "453129717", "Botanic Luxury"),
    PropertySpec("Cendana", "424416990", "Cendana District West"),
    PropertySpec("Fairways", "378444042", "Fairways at South Shore"),
]


def pct_change(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev is None or prev == 0:
        return None
    return (curr - prev) / prev


def fmt_pct(value: Optional[float]) -> str:
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%"


def parse_date(s: str) -> datetime.date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def date_windows(latest_str: str) -> Dict[str, Tuple[str, str]]:
    latest = parse_date(latest_str)
    curr_start = latest - timedelta(days=59)
    prev_end = curr_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=59)
    return {
        "current": (curr_start.isoformat(), latest.isoformat()),
        "previous": (prev_start.isoformat(), prev_end.isoformat()),
    }


def sem_metrics(conn: sqlite3.Connection, property_id: str, start: str, end: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT
          COUNT(DISTINCT metric_date) AS days,
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks,
          SUM(conversions) AS conversions,
          SUM(cost_micros)/1000000.0 AS spend
        FROM google_ads_campaigns
        WHERE property_id = ?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, start, end),
    ).fetchone()
    days = row["days"] or 0
    impressions = row["impressions"] or 0
    clicks = row["clicks"] or 0
    conversions = row["conversions"] or 0
    spend = row["spend"] or 0.0
    ctr = (clicks / impressions) if impressions else None
    cvr = (conversions / clicks) if clicks else None
    cpa = (spend / conversions) if conversions else None
    return {
        "days": float(days),
        "impressions": float(impressions),
        "clicks": float(clicks),
        "conversions": float(conversions),
        "spend": float(spend),
        "ctr": ctr,
        "cvr": cvr,
        "cpa": cpa,
        "clicks_per_day": (clicks / days) if days else None,
        "conversions_per_day": (conversions / days) if days else None,
        "spend_per_day": (spend / days) if days else None,
    }


def sem_proxy_metrics(conn: sqlite3.Connection, property_id: str, start: str, end: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT
          COUNT(DISTINCT metric_date) AS days,
          SUM(sessions) AS paid_sessions,
          SUM(conversions) AS paid_conversions
        FROM ga4_traffic_sources
        WHERE property_id = ?
          AND channel_group = 'Paid Search'
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, start, end),
    ).fetchone()
    days = row["days"] or 0
    sessions = row["paid_sessions"] or 0
    conversions = row["paid_conversions"] or 0
    return {
        "days": float(days),
        "impressions": None,
        "clicks": float(sessions),
        "conversions": float(conversions),
        "spend": None,
        "ctr": None,
        "cvr": (conversions / sessions) if sessions else None,
        "cpa": None,
        "clicks_per_day": (sessions / days) if days else None,
        "conversions_per_day": (conversions / days) if days else None,
        "spend_per_day": None,
    }


def seo_metrics(conn: sqlite3.Connection, property_id: str, start: str, end: str) -> Dict[str, Optional[float]]:
    row = conn.execute(
        """
        SELECT
          COUNT(DISTINCT metric_date) AS days,
          AVG(organic_keywords_top_10) AS kw_top10_avg,
          AVG(organic_traffic_estimate) AS organic_traffic_avg,
          AVG(visibility_score) AS visibility_avg,
          AVG(average_position) AS avg_position_avg,
          AVG(referring_domains) AS ref_domains_avg
        FROM semrush_domain_metrics
        WHERE property_id = ?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, start, end),
    ).fetchone()
    return {
        "days": float(row["days"] or 0),
        "kw_top10_avg": row["kw_top10_avg"],
        "organic_traffic_avg": row["organic_traffic_avg"],
        "visibility_avg": row["visibility_avg"],
        "avg_position_avg": row["avg_position_avg"],
        "ref_domains_avg": row["ref_domains_avg"],
    }


def evaluate_sem(curr: Dict[str, Optional[float]], prev: Dict[str, Optional[float]]) -> Tuple[str, str]:
    if curr["days"] < 30 or prev["days"] < 10:
        return "insufficient_data", f"SEM baseline not sufficient (current_days={int(curr['days'])}, previous_days={int(prev['days'])})"

    checks = []
    d_clicks = pct_change(curr["clicks_per_day"], prev["clicks_per_day"])
    d_conv = pct_change(curr["conversions_per_day"], prev["conversions_per_day"])
    d_ctr = pct_change(curr["ctr"], prev["ctr"])
    d_cpa = pct_change(curr["cpa"], prev["cpa"])

    score = 0
    if d_clicks is not None:
        if d_clicks >= 0.05:
            score += 1
            checks.append(f"clicks/day up {fmt_pct(d_clicks)}")
        elif d_clicks <= -0.05:
            score -= 1
            checks.append(f"clicks/day down {fmt_pct(d_clicks)}")
    if d_conv is not None:
        if d_conv >= 0.05:
            score += 1
            checks.append(f"conversions/day up {fmt_pct(d_conv)}")
        elif d_conv <= -0.05:
            score -= 1
            checks.append(f"conversions/day down {fmt_pct(d_conv)}")
    if d_ctr is not None:
        if d_ctr >= 0.05:
            score += 1
            checks.append(f"CTR up {fmt_pct(d_ctr)}")
        elif d_ctr <= -0.05:
            score -= 1
            checks.append(f"CTR down {fmt_pct(d_ctr)}")
    if d_cpa is not None:
        if d_cpa <= -0.05:
            score += 1
            checks.append(f"CPA improved {fmt_pct(-d_cpa)}")
        elif d_cpa >= 0.05:
            score -= 1
            checks.append(f"CPA worsened {fmt_pct(d_cpa)}")

    if score >= 2:
        return "improved", "; ".join(checks) if checks else "net SEM improvement"
    if score <= -2:
        return "declined", "; ".join(checks) if checks else "net SEM decline"
    return "mixed", "; ".join(checks) if checks else "mixed SEM movement"


def evaluate_seo(curr: Dict[str, Optional[float]], prev: Dict[str, Optional[float]]) -> Tuple[str, str]:
    # SEMrush historical snapshots are monthly; two points per window is sufficient
    # for directional T60 comparisons when daily history is not available.
    if curr["days"] < 2 or prev["days"] < 2:
        return "insufficient_data", f"SEO baseline not sufficient (current_days={int(curr['days'])}, previous_days={int(prev['days'])})"

    checks = []
    score = 0

    d_kw10 = pct_change(curr["kw_top10_avg"], prev["kw_top10_avg"])
    d_traffic = pct_change(curr["organic_traffic_avg"], prev["organic_traffic_avg"])
    d_vis = pct_change(curr["visibility_avg"], prev["visibility_avg"])
    d_pos = pct_change(curr["avg_position_avg"], prev["avg_position_avg"])  # lower is better
    d_ref = pct_change(curr["ref_domains_avg"], prev["ref_domains_avg"])

    if d_kw10 is not None:
        if d_kw10 >= 0.05:
            score += 1
            checks.append(f"Top-10 keywords up {fmt_pct(d_kw10)}")
        elif d_kw10 <= -0.05:
            score -= 1
            checks.append(f"Top-10 keywords down {fmt_pct(d_kw10)}")
    if d_traffic is not None:
        if d_traffic >= 0.05:
            score += 1
            checks.append(f"organic traffic est. up {fmt_pct(d_traffic)}")
        elif d_traffic <= -0.05:
            score -= 1
            checks.append(f"organic traffic est. down {fmt_pct(d_traffic)}")
    if d_vis is not None:
        if d_vis >= 0.05:
            score += 1
            checks.append(f"visibility up {fmt_pct(d_vis)}")
        elif d_vis <= -0.05:
            score -= 1
            checks.append(f"visibility down {fmt_pct(d_vis)}")
    if d_pos is not None:
        if d_pos <= -0.03:
            score += 1
            checks.append(f"avg position improved {fmt_pct(-d_pos)}")
        elif d_pos >= 0.03:
            score -= 1
            checks.append(f"avg position worsened {fmt_pct(d_pos)}")
    if d_ref is not None:
        if d_ref >= 0.03:
            score += 1
            checks.append(f"referring domains up {fmt_pct(d_ref)}")
        elif d_ref <= -0.03:
            score -= 1
            checks.append(f"referring domains down {fmt_pct(d_ref)}")

    if score >= 2:
        return "improved", "; ".join(checks) if checks else "net SEO improvement"
    if score <= -2:
        return "declined", "; ".join(checks) if checks else "net SEO decline"
    return "mixed", "; ".join(checks) if checks else "mixed SEO movement"


def build_email_html(rows: List[Dict[str, str]], sem_latest: str, seo_latest: str, csv_path: Path) -> str:
    sem_improved = sum(1 for r in rows if r["sem_status"] == "improved")
    sem_declined = sum(1 for r in rows if r["sem_status"] == "declined")
    sem_insuf = sum(1 for r in rows if r["sem_status"] == "insufficient_data")
    seo_improved = sum(1 for r in rows if r["seo_status"] == "improved")
    seo_declined = sum(1 for r in rows if r["seo_status"] == "declined")
    seo_insuf = sum(1 for r in rows if r["seo_status"] == "insufficient_data")

    table_rows = []
    for r in rows:
        table_rows.append(
            "<tr>"
            f"<td>{r['request_name']}</td>"
            f"<td>{r['property_name']}</td>"
            f"<td>{r.get('sem_source', 'n/a')}</td>"
            f"<td>{r['sem_status']}</td>"
            f"<td>{r['seo_status']}</td>"
            f"<td>{r['sem_how']}</td>"
            f"<td>{r['seo_how']}</td>"
            "</tr>"
        )

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #222;">
        <h2>SEM/SEO T60 Audit (vs Previous T60)</h2>
        <p><strong>SEM latest date:</strong> {sem_latest}<br/>
           <strong>SEO latest date:</strong> {seo_latest if seo_latest else 'n/a'}<br/>
           <strong>Properties audited:</strong> {len(rows)}</p>
        <p><strong>SEM:</strong> improved={sem_improved}, declined={sem_declined}, insufficient={sem_insuf}<br/>
           <strong>SEO:</strong> improved={seo_improved}, declined={seo_declined}, insufficient={seo_insuf}</p>
        <p>Companion CSV attached: <code>{csv_path.name}</code></p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">
          <thead style="background: #f4f4f4;">
            <tr>
              <th>Requested Name</th>
              <th>Matched Property</th>
              <th>SEM Source</th>
              <th>SEM Status</th>
              <th>SEO Status</th>
              <th>SEM How</th>
              <th>SEO How</th>
            </tr>
          </thead>
          <tbody>
            {''.join(table_rows)}
          </tbody>
        </table>
        <p style="margin-top: 16px; font-size: 12px; color: #666;">
          Note: "Pheonix" was matched to "The Phoenix".
        </p>
      </body>
    </html>
    """


def main() -> int:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    sem_latest = conn.execute(
        """
        SELECT MAX(metric_date) AS latest
        FROM google_ads_campaigns
        WHERE property_id IN ({})
        """.format(",".join("?" for _ in PROPERTY_SPECS)),
        [p.property_id for p in PROPERTY_SPECS],
    ).fetchone()["latest"]

    seo_latest = conn.execute(
        """
        SELECT MAX(metric_date) AS latest
        FROM semrush_domain_metrics
        WHERE property_id IN ({})
        """.format(",".join("?" for _ in PROPERTY_SPECS)),
        [p.property_id for p in PROPERTY_SPECS],
    ).fetchone()["latest"]

    sem_windows = date_windows(sem_latest) if sem_latest else None
    seo_windows = date_windows(seo_latest) if seo_latest else None

    rows: List[Dict[str, str]] = []

    for p in PROPERTY_SPECS:
        row: Dict[str, str] = {
            "request_name": p.request_name,
            "property_id": p.property_id,
            "property_name": p.canonical_name,
            "sem_source": "google_ads",
            "sem_status": "insufficient_data",
            "seo_status": "insufficient_data",
            "sem_how": "No SEM data",
            "seo_how": "No SEO data",
        }

        if sem_windows:
            sem_curr = sem_metrics(conn, p.property_id, *sem_windows["current"])
            sem_prev = sem_metrics(conn, p.property_id, *sem_windows["previous"])
            # Fallback to GA4 Paid Search proxy if Google Ads data is not available.
            if (sem_curr["days"] or 0) < 10 and (sem_prev["days"] or 0) < 10:
                sem_curr = sem_proxy_metrics(conn, p.property_id, *sem_windows["current"])
                sem_prev = sem_proxy_metrics(conn, p.property_id, *sem_windows["previous"])
                row["sem_source"] = "ga4_paid_search_proxy"
            sem_status, sem_how = evaluate_sem(sem_curr, sem_prev)
            row["sem_status"] = sem_status
            row["sem_how"] = sem_how
            row["sem_current_days"] = str(int(sem_curr["days"]))
            row["sem_previous_days"] = str(int(sem_prev["days"]))
            row["sem_clicks_per_day_current"] = f"{(sem_curr['clicks_per_day'] or 0):.2f}"
            row["sem_clicks_per_day_previous"] = f"{(sem_prev['clicks_per_day'] or 0):.2f}"
            row["sem_conversions_per_day_current"] = f"{(sem_curr['conversions_per_day'] or 0):.2f}"
            row["sem_conversions_per_day_previous"] = f"{(sem_prev['conversions_per_day'] or 0):.2f}"
            row["sem_ctr_current"] = f"{((sem_curr['ctr'] or 0) * 100):.2f}"
            row["sem_ctr_previous"] = f"{((sem_prev['ctr'] or 0) * 100):.2f}"
            row["sem_cpa_current"] = f"{(sem_curr['cpa'] or 0):.2f}"
            row["sem_cpa_previous"] = f"{(sem_prev['cpa'] or 0):.2f}"

        if seo_windows:
            seo_curr = seo_metrics(conn, p.property_id, *seo_windows["current"])
            seo_prev = seo_metrics(conn, p.property_id, *seo_windows["previous"])
            seo_status, seo_how = evaluate_seo(seo_curr, seo_prev)
            row["seo_status"] = seo_status
            row["seo_how"] = seo_how
            row["seo_current_days"] = str(int(seo_curr["days"]))
            row["seo_previous_days"] = str(int(seo_prev["days"]))
            row["seo_kw_top10_current"] = f"{(seo_curr['kw_top10_avg'] or 0):.2f}"
            row["seo_kw_top10_previous"] = f"{(seo_prev['kw_top10_avg'] or 0):.2f}"
            row["seo_traffic_current"] = f"{(seo_curr['organic_traffic_avg'] or 0):.2f}"
            row["seo_traffic_previous"] = f"{(seo_prev['organic_traffic_avg'] or 0):.2f}"
            row["seo_visibility_current"] = f"{(seo_curr['visibility_avg'] or 0):.4f}"
            row["seo_visibility_previous"] = f"{(seo_prev['visibility_avg'] or 0):.4f}"
            row["seo_avg_position_current"] = f"{(seo_curr['avg_position_avg'] or 0):.2f}"
            row["seo_avg_position_previous"] = f"{(seo_prev['avg_position_avg'] or 0):.2f}"
            row["seo_ref_domains_current"] = f"{(seo_curr['ref_domains_avg'] or 0):.2f}"
            row["seo_ref_domains_previous"] = f"{(seo_prev['ref_domains_avg'] or 0):.2f}"

        rows.append(row)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = OUTPUT_DIR / f"sem_seo_t60_audit_{timestamp}.csv"

    fieldnames = sorted({k for r in rows for k in r.keys()})
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    pib_html_path = send_pib_email(csv_path)
    print(f"PIB_HTML: {pib_html_path}")
    print(f"CSV: {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
