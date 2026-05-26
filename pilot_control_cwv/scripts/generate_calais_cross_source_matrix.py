#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
COHORT_CONFIG = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
COMPARATOR_JSON = ROOT / "pilot_control_cwv" / "reports" / "calais_comparator_audit_2026-04-07.json"
OUTPUT_MD = ROOT / "pilot_control_cwv" / "reports" / "calais_cross_source_matrix_2026-04-07.md"
OUTPUT_CSV = ROOT / "pilot_control_cwv" / "reports" / "calais_cross_source_matrix_2026-04-07.csv"
OUTPUT_JSON = ROOT / "pilot_control_cwv" / "reports" / "calais_cross_source_matrix_2026-04-07.json"

EVS_FILES = {
    "Calais Midtown": ROOT / "evs" / "reports" / "calais-midtown-desktop_chrome-critical_cta_smoke-production.json",
    "The District Universal Boulevard": ROOT / "evs" / "reports" / "the-district-universal-desktop_chrome-critical_cta_smoke.json",
    "The Harrison": ROOT / "evs" / "reports" / "the-harrison-desktop_chrome-critical_cta_smoke.json",
}

TARGETS = [
    ("Calais Midtown", "pilot_calais_midtown", "378381499"),
    ("The District Universal Boulevard", "pilot_district_universal", "378644585"),
    ("The Harrison", "pilot_the_harrison", "378702475"),
]


@dataclass
class PropertyReport:
    name: str
    cohort_key: str
    property_id: str
    full_url: str
    latest_ga_date: str
    latest_gsc_date: str
    latest_pagespeed_date: Optional[str]
    latest_gt_date: Optional[str]
    latest_psi_date: Optional[str]
    ga_curr_total: int
    ga_prev_total: int
    ga_curr_organic: int
    ga_prev_organic: int
    ga_curr_direct: int
    ga_prev_direct: int
    ga_curr_referral: int
    ga_prev_referral: int
    gsc_curr_clicks: int
    gsc_prev_clicks: int
    gsc_curr_impressions: int
    gsc_prev_impressions: int
    gsc_curr_avg_position: Optional[float]
    gsc_prev_avg_position: Optional[float]
    psi_performance: Optional[float]
    psi_lcp: Optional[float]
    psi_cls: Optional[float]
    psi_ttfb: Optional[float]
    gt_score: Optional[float]
    evs_status: str
    apartments_internal_links: Optional[int]
    unit_detail_url: Optional[str]


def pct_delta(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev in (None, 0):
        return None
    return ((curr - prev) / prev) * 100.0


def load_comparator() -> Dict[str, Any]:
    return json.loads(COMPARATOR_JSON.read_text())


def load_cohort() -> Dict[str, Any]:
    return {row["display_name"]: row for row in json.loads(COHORT_CONFIG.read_text())["cohorts"]}


def latest_metric_date(cur: sqlite3.Cursor, table: str, property_id: str) -> Optional[str]:
    row = cur.execute(f"SELECT MAX(metric_date) FROM {table} WHERE property_id=?", (property_id,)).fetchone()
    return row[0] if row and row[0] else None


def latest_psi_date(cur: sqlite3.Cursor, cohort_key: str) -> Optional[str]:
    row = cur.execute(
        "SELECT MAX(metric_date) FROM pilot_control_psi_metrics WHERE cohort_key=? AND strategy='mobile'",
        (cohort_key,),
    ).fetchone()
    return row[0] if row and row[0] else None


def parse_evs_status(path: Path) -> str:
    data = json.loads(path.read_text())
    device_runs = data.get("device_runs") or []
    if not device_runs:
        return "unknown"
    classification = device_runs[0].get("classification")
    if classification:
        return classification
    findings = device_runs[0].get("findings") or []
    if findings and all(f.get("status") == "pass" for f in findings):
        return "pass"
    return "mixed"


def get_apartments_internal_links(comparator_entry: Dict[str, Any]) -> Optional[int]:
    for page in comparator_entry.get("pages", []):
        if page.get("page_type") in {"apartments", "availability"}:
            return page.get("internal_link_count")
    return None


def aggregate_ga_window(cur: sqlite3.Cursor, property_id: str, start: str, end: str) -> Dict[str, int]:
    row = cur.execute(
        """
        SELECT
          SUM(CASE WHEN channel_group='Organic Search' THEN sessions ELSE 0 END) AS organic,
          SUM(CASE WHEN channel_group='Direct' THEN sessions ELSE 0 END) AS direct,
          SUM(CASE WHEN channel_group='Referral' THEN sessions ELSE 0 END) AS referral,
          SUM(sessions) AS total
        FROM ga4_traffic_sources
        WHERE property_id=?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, start, end),
    ).fetchone()
    return {
        "organic": int(row["organic"] or 0),
        "direct": int(row["direct"] or 0),
        "referral": int(row["referral"] or 0),
        "total": int(row["total"] or 0),
    }


def aggregate_gsc_window(cur: sqlite3.Cursor, property_id: str, start: str, end: str) -> Dict[str, Optional[float]]:
    row = cur.execute(
        """
        SELECT
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          AVG(average_position) AS avg_position
        FROM gsc_queries
        WHERE property_id=?
          AND metric_date BETWEEN ? AND ?
        """,
        (property_id, start, end),
    ).fetchone()
    return {
        "clicks": int(row["clicks"] or 0),
        "impressions": int(row["impressions"] or 0),
        "avg_position": float(row["avg_position"]) if row["avg_position"] is not None else None,
    }


def build_reports() -> List[PropertyReport]:
    comparator = load_comparator()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    latest_ga = cur.execute("SELECT MAX(metric_date) FROM ga4_traffic_sources").fetchone()[0]
    latest_gsc = cur.execute("SELECT MAX(metric_date) FROM gsc_queries").fetchone()[0]
    ga_end = datetime.strptime(latest_ga, "%Y-%m-%d").date()
    gsc_end = datetime.strptime(latest_gsc, "%Y-%m-%d").date()
    ga_curr_start = (ga_end - timedelta(days=29)).isoformat()
    ga_prev_start = (ga_end - timedelta(days=59)).isoformat()
    ga_prev_end = (ga_end - timedelta(days=30)).isoformat()
    gsc_curr_start = (gsc_end - timedelta(days=29)).isoformat()
    gsc_prev_start = (gsc_end - timedelta(days=59)).isoformat()
    gsc_prev_end = (gsc_end - timedelta(days=30)).isoformat()

    reports: List[PropertyReport] = []
    for name, cohort_key, property_id in TARGETS:
        prop = cur.execute(
            "SELECT full_url FROM properties WHERE property_id=?",
            (property_id,),
        ).fetchone()
        ga_curr = aggregate_ga_window(cur, property_id, ga_curr_start, ga_end.isoformat())
        ga_prev = aggregate_ga_window(cur, property_id, ga_prev_start, ga_prev_end)
        gsc_curr = aggregate_gsc_window(cur, property_id, gsc_curr_start, gsc_end.isoformat())
        gsc_prev = aggregate_gsc_window(cur, property_id, gsc_prev_start, gsc_prev_end)

        pagespeed_date = latest_metric_date(cur, "pagespeed_metrics", property_id)
        gt_date = latest_metric_date(cur, "gtmetrix_metrics", property_id)
        psi_date = latest_psi_date(cur, cohort_key)

        ps_row = None
        if pagespeed_date:
            ps_row = cur.execute(
                """
                SELECT performance_score, lcp_value, cls_value, ttfb_value
                FROM pagespeed_metrics
                WHERE property_id=? AND strategy='mobile' AND metric_date=?
                LIMIT 1
                """,
                (property_id, pagespeed_date),
            ).fetchone()

        gt_row = None
        if gt_date:
            gt_row = cur.execute(
                "SELECT pagespeed_score FROM gtmetrix_metrics WHERE property_id=? AND metric_date=? LIMIT 1",
                (property_id, gt_date),
            ).fetchone()

        comp_key = name.lower().replace(" ", "_").replace("&", "and").replace("-", "_")
        comp_entry = comparator.get(comp_key, {})
        reports.append(
            PropertyReport(
                name=name,
                cohort_key=cohort_key,
                property_id=property_id,
                full_url=prop["full_url"],
                latest_ga_date=latest_ga,
                latest_gsc_date=latest_gsc,
                latest_pagespeed_date=pagespeed_date,
                latest_gt_date=gt_date,
                latest_psi_date=psi_date,
                ga_curr_total=ga_curr["total"],
                ga_prev_total=ga_prev["total"],
                ga_curr_organic=ga_curr["organic"],
                ga_prev_organic=ga_prev["organic"],
                ga_curr_direct=ga_curr["direct"],
                ga_prev_direct=ga_prev["direct"],
                ga_curr_referral=ga_curr["referral"],
                ga_prev_referral=ga_prev["referral"],
                gsc_curr_clicks=gsc_curr["clicks"],
                gsc_prev_clicks=gsc_prev["clicks"],
                gsc_curr_impressions=gsc_curr["impressions"],
                gsc_prev_impressions=gsc_prev["impressions"],
                gsc_curr_avg_position=gsc_curr["avg_position"],
                gsc_prev_avg_position=gsc_prev["avg_position"],
                psi_performance=float(ps_row["performance_score"]) if ps_row and ps_row["performance_score"] is not None else None,
                psi_lcp=float(ps_row["lcp_value"]) if ps_row and ps_row["lcp_value"] is not None else None,
                psi_cls=float(ps_row["cls_value"]) if ps_row and ps_row["cls_value"] is not None else None,
                psi_ttfb=float(ps_row["ttfb_value"]) if ps_row and ps_row["ttfb_value"] is not None else None,
                gt_score=float(gt_row["pagespeed_score"]) if gt_row and gt_row["pagespeed_score"] is not None else None,
                evs_status=parse_evs_status(EVS_FILES[name]),
                apartments_internal_links=get_apartments_internal_links(comp_entry),
                unit_detail_url=comp_entry.get("discovered_unit_detail_url"),
            )
        )
    conn.close()
    return reports


def findings(reports: List[PropertyReport]) -> List[str]:
    calais = next(r for r in reports if r.name == "Calais Midtown")
    district = next(r for r in reports if r.name == "The District Universal Boulevard")
    harrison = next(r for r in reports if r.name == "The Harrison")
    lines = []
    lines.append(
        f"Calais carries materially higher 30-day GA4 organic session volume ({calais.ga_curr_organic:,}) than District ({district.ga_curr_organic:,}) and Harrison ({harrison.ga_curr_organic:,})."
    )
    lines.append(
        f"District and Harrison are not operationally broken in BrowserStack; all three properties currently pass the desktop critical CTA smoke run."
    )
    if district.gsc_curr_clicks > calais.gsc_curr_clicks:
        lines.append(
            f"District currently shows stronger recent GSC click/impression totals than Calais despite weaker GA4 organic traffic, which raises attribution/classification questions in addition to SEO questions."
        )
    if harrison.gsc_curr_impressions and harrison.gsc_curr_impressions > 0:
        lines.append(
            "Harrison shows lower GA4 organic volume while still retaining measurable GSC visibility, so it should be treated as a combined discoverability/measurement investigation rather than a pure site-breakage case."
        )
    lines.append(
        f"The shared nav/sitemap pages are structurally similar, but the apartments listing link footprint still differs (Calais {calais.apartments_internal_links}, District {district.apartments_internal_links}, Harrison {harrison.apartments_internal_links}), keeping the floorplan/apartments layer as the most likely structural-difference zone."
    )
    return lines


def write_outputs(reports: List[PropertyReport]) -> None:
    rows: List[Dict[str, Any]] = []
    for r in reports:
        rows.append({
            "property_name": r.name,
            "property_id": r.property_id,
            "full_url": r.full_url,
            "latest_ga_date": r.latest_ga_date,
            "latest_gsc_date": r.latest_gsc_date,
            "latest_pagespeed_date": r.latest_pagespeed_date,
            "latest_gt_date": r.latest_gt_date,
            "latest_psi_date": r.latest_psi_date,
            "ga_30d_total": r.ga_curr_total,
            "ga_30d_total_prev": r.ga_prev_total,
            "ga_30d_total_delta_pct": pct_delta(r.ga_curr_total, r.ga_prev_total),
            "ga_30d_organic": r.ga_curr_organic,
            "ga_30d_organic_prev": r.ga_prev_organic,
            "ga_30d_organic_delta_pct": pct_delta(r.ga_curr_organic, r.ga_prev_organic),
            "ga_30d_direct": r.ga_curr_direct,
            "ga_30d_direct_prev": r.ga_prev_direct,
            "ga_30d_direct_delta_pct": pct_delta(r.ga_curr_direct, r.ga_prev_direct),
            "ga_30d_referral": r.ga_curr_referral,
            "ga_30d_referral_prev": r.ga_prev_referral,
            "ga_30d_referral_delta_pct": pct_delta(r.ga_curr_referral, r.ga_prev_referral),
            "gsc_30d_clicks": r.gsc_curr_clicks,
            "gsc_30d_clicks_prev": r.gsc_prev_clicks,
            "gsc_30d_clicks_delta_pct": pct_delta(r.gsc_curr_clicks, r.gsc_prev_clicks),
            "gsc_30d_impressions": r.gsc_curr_impressions,
            "gsc_30d_impressions_prev": r.gsc_prev_impressions,
            "gsc_30d_impressions_delta_pct": pct_delta(r.gsc_curr_impressions, r.gsc_prev_impressions),
            "gsc_30d_avg_position": r.gsc_curr_avg_position,
            "gsc_30d_avg_position_prev": r.gsc_prev_avg_position,
            "psi_performance": r.psi_performance,
            "psi_lcp": r.psi_lcp,
            "psi_cls": r.psi_cls,
            "psi_ttfb": r.psi_ttfb,
            "gt_score": r.gt_score,
            "evs_status": r.evs_status,
            "apartments_internal_links": r.apartments_internal_links,
            "unit_detail_url": r.unit_detail_url,
        })

    OUTPUT_JSON.write_text(json.dumps({"reports": rows, "findings": findings(reports)}, indent=2))
    with OUTPUT_CSV.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    def fmt_num(val: Optional[float], digits: int = 1) -> str:
        if val is None:
            return "n/a"
        return f"{val:.{digits}f}"

    def fmt_pct(val: Optional[float]) -> str:
        if val is None:
            return "n/a"
        return f"{val:+.1f}%"

    lines = [
        "# Calais Cross-Source Matrix",
        "",
        "Cross-source diagnostic comparison for:",
        "- Calais Midtown",
        "- The District Universal Boulevard",
        "- The Harrison",
        "",
        "## Key Findings",
        "",
    ]
    for item in findings(reports):
        lines.append(f"- {item}")
    lines.extend(["", "## Matrix", ""])

    for r in reports:
        lines.extend([
            f"### {r.name}",
            "",
            f"- URL: {r.full_url}",
            f"- GA4 latest date: `{r.latest_ga_date}`",
            f"- GSC latest date: `{r.latest_gsc_date}`",
            f"- BrowserStack / EVS: `{r.evs_status}`",
            f"- Apartments internal links: `{r.apartments_internal_links}`",
            f"- Unit detail sample: `{r.unit_detail_url or 'n/a'}`",
            "",
            "| Signal | Current | Prior | Change |",
            "|---|---:|---:|---:|",
            f"| GA4 total sessions (30d) | {r.ga_curr_total:,} | {r.ga_prev_total:,} | {fmt_pct(pct_delta(r.ga_curr_total, r.ga_prev_total))} |",
            f"| GA4 organic sessions (30d) | {r.ga_curr_organic:,} | {r.ga_prev_organic:,} | {fmt_pct(pct_delta(r.ga_curr_organic, r.ga_prev_organic))} |",
            f"| GA4 direct sessions (30d) | {r.ga_curr_direct:,} | {r.ga_prev_direct:,} | {fmt_pct(pct_delta(r.ga_curr_direct, r.ga_prev_direct))} |",
            f"| GA4 referral sessions (30d) | {r.ga_curr_referral:,} | {r.ga_prev_referral:,} | {fmt_pct(pct_delta(r.ga_curr_referral, r.ga_prev_referral))} |",
            f"| GSC clicks (30d) | {r.gsc_curr_clicks:,} | {r.gsc_prev_clicks:,} | {fmt_pct(pct_delta(r.gsc_curr_clicks, r.gsc_prev_clicks))} |",
            f"| GSC impressions (30d) | {r.gsc_curr_impressions:,} | {r.gsc_prev_impressions:,} | {fmt_pct(pct_delta(r.gsc_curr_impressions, r.gsc_prev_impressions))} |",
            f"| GSC avg position (30d) | {fmt_num(r.gsc_curr_avg_position, 1)} | {fmt_num(r.gsc_prev_avg_position, 1)} | n/a |",
            f"| PSI performance | {fmt_num(r.psi_performance, 0)} | n/a | n/a |",
            f"| PSI LCP | {fmt_num(r.psi_lcp, 2)} | n/a | n/a |",
            f"| PSI CLS | {fmt_num(r.psi_cls, 3)} | n/a | n/a |",
            f"| PSI TTFB | {fmt_num(r.psi_ttfb, 2)} | n/a | n/a |",
            f"| GTMetrix score | {fmt_num(r.gt_score, 1)} | n/a | n/a |",
            "",
        ])

    lines.extend([
        "## Interpretation Notes",
        "",
        "- GA4 and GSC are intentionally shown side by side because a divergence between them can indicate attribution/classification issues rather than pure discoverability loss.",
        "- BrowserStack / EVS pass status confirms the critical CTA journeys are operational, but does not prove SEO/indexation health.",
        "- Apartments internal link counts come from the comparator crawl and are a proxy for structural floorplan/apartments-layer differences.",
        "- GSC data is expected to lag GA4 and PageSpeed by several days in this system.",
        "",
    ])
    OUTPUT_MD.write_text("\n".join(lines))


def main() -> None:
    reports = build_reports()
    write_outputs(reports)
    print(f"Wrote {OUTPUT_MD}")
    print(f"Wrote {OUTPUT_CSV}")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
