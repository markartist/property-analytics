#!/usr/bin/env python3
"""
Morning Full Portfolio Report
=============================
Generates a daily operational report focused on reliability, freshness,
mirror integrity, and portfolio performance snapshot.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from Data_Collection.utils.source_freshness_policy import evaluate_source_freshness, is_source_suspended
from utils.pib_email_shell import wrap_pib_light_email

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_DIR = ROOT / "reports" / "daily_health"
MIRROR_REPORT_DIR = ROOT / "apps" / "api" / "scripts" / "generated"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

STALE_DAYS_WARNING = 2
STALE_DAYS_CRITICAL = 4


def _safe_iso_to_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _age_status(date_str: Optional[str], critical: bool = False) -> Tuple[str, str]:
    d = _safe_iso_to_date(date_str)
    if not d:
        return "N/A", "unknown"

    age = (date.today() - d).days
    if age <= 1:
        return f"{age}d", "fresh"

    warning_bar = STALE_DAYS_WARNING
    critical_bar = STALE_DAYS_CRITICAL

    if age >= critical_bar:
        return f"{age}d", "critical" if critical else "stale"
    if age >= warning_bar:
        return f"{age}d", "warning"
    return f"{age}d", "fresh"


def _shared_status_for_report(source_key: str, latest: Optional[str], critical: bool = False) -> Tuple[str, str]:
    expectation = evaluate_source_freshness(source_key, latest)
    d = _safe_iso_to_date(latest)
    actual_age = (date.today() - d).days if d else None
    age_text = "N/A" if actual_age is None else f"{actual_age}d"

    if expectation.status == "suspended":
        return "Paused", "suspended"
    if expectation.status == "missing":
        return age_text, "unknown"
    if expectation.status == "stale":
        return age_text, "critical" if critical else "stale"
    return age_text, expectation.status


def _source_freshness(conn: sqlite3.Connection) -> List[Dict[str, str]]:
    checks: Sequence[Tuple[str, str, bool, str]] = [
        ("GA4", "SELECT MAX(metric_date) FROM ga4_daily_metrics", True, "ga4"),
        ("GSC", "SELECT MAX(metric_date) FROM gsc_daily_metrics", True, "gsc"),
        ("Google Ads", "SELECT MAX(metric_date) FROM google_ads_campaigns", False, "google_ads"),
        ("Guest Cards", "SELECT MAX(run_date) FROM guest_card_metrics", False, "guest_cards"),
        ("Unit Availability", "SELECT MAX(snapshot_date) FROM unit_availability", False, "unit_availability"),
        ("PageSpeed", "SELECT MAX(metric_date) FROM pagespeed_metrics", False, "pagespeed"),
    ]

    rows: List[Dict[str, str]] = []
    for source, sql, is_critical, source_key in checks:
        latest: Optional[str] = None
        try:
            latest = conn.execute(sql).fetchone()[0]
        except sqlite3.Error:
            latest = None

        if source_key == "guest_cards" and is_source_suspended(source_key):
            rows.append(
                {
                    "source": source,
                    "latest": latest or "N/A",
                    "age": "Paused",
                    "status": "suspended",
                    "critical": "No",
                }
            )
            continue

        age_text, status = _shared_status_for_report(source_key, latest, critical=is_critical)
        rows.append(
            {
                "source": source,
                "latest": latest or "N/A",
                "age": age_text,
                "status": status,
                "critical": "Yes" if is_critical else "No",
            }
        )
    return rows


def _collection_status(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT
          data_source,
          COUNT(*) AS runs,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
          MAX(started_at) AS last_started
        FROM data_collections
        WHERE started_at >= datetime('now', '-24 hours')
        GROUP BY data_source
        ORDER BY failed DESC, in_progress DESC, data_source ASC
        """
    ).fetchall()


def _pagespeed_snapshot(conn: sqlite3.Connection) -> Dict[str, object]:
    latest = conn.execute(
        "SELECT MAX(metric_date) FROM pagespeed_metrics WHERE strategy='mobile'"
    ).fetchone()[0]
    if not latest:
        return {"latest_date": None}

    row = conn.execute(
        """
        SELECT
          COUNT(*) AS properties,
          ROUND(AVG(performance_score), 1) AS avg_score,
          ROUND(AVG(lcp_value), 2) AS avg_lcp_s,
          ROUND(AVG(cls_value), 3) AS avg_cls,
          SUM(CASE WHEN performance_score < 50 THEN 1 ELSE 0 END) AS poor,
          SUM(CASE WHEN performance_score >= 50 AND performance_score < 90 THEN 1 ELSE 0 END) AS needs_improvement,
          SUM(CASE WHEN performance_score >= 90 THEN 1 ELSE 0 END) AS good
        FROM pagespeed_metrics
        WHERE strategy='mobile' AND metric_date=?
        """,
        (latest,),
    ).fetchone()

    return {"latest_date": latest, **dict(row)}


def _top_failing_properties(conn: sqlite3.Connection) -> List[Dict[str, object]]:
    latest = conn.execute(
        "SELECT MAX(metric_date) FROM pagespeed_metrics WHERE strategy='mobile'"
    ).fetchone()[0]
    if not latest:
        return []

    previous = conn.execute(
        """
        SELECT MAX(metric_date)
        FROM pagespeed_metrics
        WHERE strategy='mobile' AND metric_date < ?
        """,
        (latest,),
    ).fetchone()[0]

    rows = conn.execute(
        """
        SELECT
          COALESCE(p.property_name, pm.property_id) AS property_name,
          pm.property_id,
          pm.performance_score,
          pm.lcp_value,
          pm.cls_value,
          pm.fid_value,
          prev.performance_score AS prev_score
        FROM pagespeed_metrics pm
        LEFT JOIN pagespeed_metrics prev
          ON prev.property_id = pm.property_id
         AND prev.strategy = 'mobile'
         AND prev.metric_date = ?
        LEFT JOIN properties p
          ON p.property_id = pm.property_id
        WHERE pm.strategy = 'mobile'
          AND pm.metric_date = ?
          AND pm.performance_score IS NOT NULL
        ORDER BY pm.performance_score ASC, pm.lcp_value DESC
        LIMIT 10
        """,
        (previous, latest),
    ).fetchall()

    results: List[Dict[str, object]] = []
    for row in rows:
        score = row["performance_score"]
        prev_score = row["prev_score"]
        delta = None if prev_score is None else score - prev_score
        results.append(
            {
                "property_name": row["property_name"],
                "property_id": row["property_id"],
                "score": score,
                "score_delta": delta,
                "lcp": row["lcp_value"],
                "cls": row["cls_value"],
                "fid": row["fid_value"],
                "risk_level": _psi_risk_level(score, row["lcp_value"], row["cls_value"]),
            }
        )
    return results


def _psi_risk_level(score: Optional[float], lcp: Optional[float], cls: Optional[float]) -> str:
    if score is None:
        return "unknown"
    if score < 40 or (lcp is not None and lcp > 4.0) or (cls is not None and cls > 0.25):
        return "high"
    if score < 60 or (lcp is not None and lcp > 2.5) or (cls is not None and cls > 0.1):
        return "medium"
    return "low"


def _latest_mirror_report() -> Dict[str, object]:
    files = sorted(
        MIRROR_REPORT_DIR.glob("d1_mirror_report_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        return {"found": False}

    parsed_reports = []
    for report_path in files:
        try:
            data = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        parsed_reports.append((report_path, data))

    if not parsed_reports:
        return {"found": True, "file": str(files[0]), "parse_error": True}

    latest_path, latest_data = parsed_reports[0]
    latest_finished = str(latest_data.get("finished_at_utc") or "")
    latest_day = latest_finished[:10] if latest_finished else ""
    if not latest_day:
        parts = latest_path.stem.split("_")
        if len(parts) >= 4 and len(parts[3]) == 8:
            latest_day = f"{parts[3][:4]}-{parts[3][4:6]}-{parts[3][6:8]}"

    # Prefer a successful same-day mirror over a later failed rerun. This keeps
    # a transient retry failure from overwriting an earlier verified mirror.
    report_path, data = latest_path, latest_data
    if latest_day:
        same_day_success = next(
            (
                (candidate_path, candidate_data)
                for candidate_path, candidate_data in parsed_reports
                if bool(candidate_data.get("success"))
                and (
                    str(candidate_data.get("finished_at_utc") or "").startswith(latest_day)
                    or candidate_path.stem.startswith(f"d1_mirror_report_{latest_day.replace('-', '')}")
                )
            ),
            None,
        )
        if same_day_success is not None:
            report_path, data = same_day_success

    return {
        "found": True,
        "file": str(report_path),
        "success": bool(data.get("success")),
        "core_success": bool(data.get("core_success", data.get("success"))),
        "mirror_status": data.get("mirror_status") or ("success" if data.get("success") else "failed"),
        "advisory_failures": data.get("advisory_failures", []),
        "core_failures": data.get("core_failures", []),
        "target_friday": data.get("target_friday"),
        "finished_at_utc": data.get("finished_at_utc"),
        "steps": data.get("steps", []),
    }


def _health_banner(freshness: Sequence[Dict[str, str]], mirror: Dict[str, object]) -> Tuple[str, str]:
    critical_issues: List[str] = []

    for row in freshness:
        if row["critical"] == "Yes" and row["status"] in {"critical", "unknown"}:
            critical_issues.append(f"{row['source']} is {row['status']} ({row['latest']})")

    if mirror.get("found") and not mirror.get("core_success", mirror.get("success")):
        critical_issues.append("D1 mirror verification failed")

    if critical_issues:
        return "ALERT", " | ".join(critical_issues)

    warnings = [
        f"{r['source']} {r['status']} ({r['latest']})"
        for r in freshness
        if r["status"] == "warning"
    ]
    if mirror.get("found") and mirror.get("core_success") and not mirror.get("success"):
        warnings.append("D1 mirror advisory sync degraded")
    if warnings:
        return "WATCH", " | ".join(warnings)

    return "HEALTHY", "All critical systems are fresh and passing checks"


def _build_risk_register(
    freshness: Sequence[Dict[str, str]],
    mirror: Dict[str, object],
    runs_24h: Sequence[sqlite3.Row],
    failing_properties: Sequence[Dict[str, object]],
) -> List[Dict[str, str]]:
    risks: List[Dict[str, str]] = []

    for row in freshness:
        if row["critical"] == "Yes" and row["status"] in {"critical", "unknown"}:
            risks.append(
                {
                    "severity": "HIGH",
                    "category": "Data Freshness",
                    "detail": f"{row['source']} is {row['status']} (latest={row['latest']})",
                    "impact": "Executive reporting may be inaccurate or stale.",
                }
            )
        elif row["status"] == "warning":
            risks.append(
                {
                    "severity": "MEDIUM",
                    "category": "Data Freshness",
                    "detail": f"{row['source']} aging (latest={row['latest']})",
                    "impact": "Trend reliability may degrade if delay increases.",
                }
            )

    if mirror.get("found") and not mirror.get("success"):
        if mirror.get("core_success", mirror.get("success")):
            risks.append(
                {
                    "severity": "MEDIUM",
                    "category": "Mirror Integrity",
                    "detail": "D1 mirror advisory sync is degraded.",
                    "impact": "Captain/source-table mirror slices may lag while core dashboard facts remain current.",
                }
            )
        else:
            risks.append(
                {
                    "severity": "HIGH",
                    "category": "Mirror Integrity",
                    "detail": "D1 mirror verification reported failure.",
                    "impact": "Dashboard mirror can diverge from source DB.",
                }
            )

    for run in runs_24h:
        failed = int(run["failed"] or 0)
        in_progress = int(run["in_progress"] or 0)
        source = str(run["data_source"])
        if failed > 0:
            risks.append(
                {
                    "severity": "HIGH",
                    "category": "Collection Reliability",
                    "detail": f"{source}: {failed} failed run(s) in last 24h.",
                    "impact": "Data gaps likely for one or more properties.",
                }
            )
        elif in_progress > 0:
            risks.append(
                {
                    "severity": "MEDIUM",
                    "category": "Collection Reliability",
                    "detail": f"{source}: {in_progress} run(s) still in progress.",
                    "impact": "Delayed completion can miss reporting windows.",
                }
            )

    high_fail_count = sum(1 for r in failing_properties if r["risk_level"] == "high")
    if high_fail_count >= 3:
        risks.append(
            {
                "severity": "MEDIUM",
                "category": "Web Performance Risk",
                "detail": f"{high_fail_count} properties in top-10 are high risk.",
                "impact": "User experience and SEO exposure remain elevated.",
            }
        )

    if not risks:
        risks.append(
            {
                "severity": "LOW",
                "category": "System Health",
                "detail": "No active high/medium risks detected.",
                "impact": "Current controls are holding.",
            }
        )

    severity_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    risks.sort(key=lambda r: severity_rank.get(r["severity"], 9))
    return risks


def _status_badge(status: str) -> str:
    colors = {
        "fresh": "#166534",
        "warning": "#92400e",
        "stale": "#92400e",
        "critical": "#991b1b",
        "unknown": "#334155",
    }
    bg = {
        "fresh": "#dcfce7",
        "warning": "#fef3c7",
        "stale": "#fef3c7",
        "critical": "#fee2e2",
        "unknown": "#e2e8f0",
    }
    color = colors.get(status, "#334155")
    background = bg.get(status, "#e2e8f0")
    return f'<span style="padding:2px 8px;border-radius:999px;color:{color};background:{background};font-weight:600;font-size:12px;">{status.upper()}</span>'


def _severity_badge(severity: str) -> str:
    palette = {
        "HIGH": ("#991b1b", "#fee2e2"),
        "MEDIUM": ("#92400e", "#fef3c7"),
        "LOW": ("#166534", "#dcfce7"),
    }
    fg, bg = palette.get(severity, ("#334155", "#e2e8f0"))
    return f'<span style="padding:2px 8px;border-radius:999px;color:{fg};background:{bg};font-weight:700;font-size:12px;">{severity}</span>'


def _html_table(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> str:
    head = "".join(f"<th>{h}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def build_report_html() -> str:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        freshness = _source_freshness(conn)
        runs_24h = _collection_status(conn)
        psi = _pagespeed_snapshot(conn)
        failing_properties = _top_failing_properties(conn)
    finally:
        conn.close()

    mirror = _latest_mirror_report()
    risk_register = _build_risk_register(freshness, mirror, runs_24h, failing_properties)
    health_state, health_message = _health_banner(freshness, mirror)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    freshness_rows = [
        [
            row["source"],
            row["latest"],
            row["age"],
            _status_badge(row["status"]),
            row["critical"],
        ]
        for row in freshness
    ]

    run_rows = [
        [
            str(r["data_source"]),
            str(r["runs"]),
            str(r["completed"]),
            str(r["failed"]),
            str(r["in_progress"]),
            str(r["last_started"] or "N/A"),
        ]
        for r in runs_24h
    ] or [["No runs", "-", "-", "-", "-", "-"]]

    mirror_status = "N/A"
    if mirror.get("found"):
        mirror_status = "PASS" if mirror.get("success") else "FAIL"

    mirror_steps = mirror.get("steps") or []
    mirror_step_rows = [
        [
            str(s.get("step", "N/A")),
            str(s.get("status", "N/A")),
            str(s.get("note", "")),
        ]
        for s in mirror_steps
    ] or [["No step detail", "N/A", ""]]

    failing_rows = [
        [
            str(idx),
            str(r["property_name"]),
            str(r["property_id"]),
            str(r["score"]),
            "N/A" if r["score_delta"] is None else f"{r['score_delta']:+.0f}",
            "N/A" if r["lcp"] is None else f"{r['lcp']:.2f}s",
            "N/A" if r["cls"] is None else f"{r['cls']:.3f}",
            _status_badge(str(r["risk_level"])),
        ]
        for idx, r in enumerate(failing_properties, start=1)
    ] or [["-", "No data", "-", "-", "-", "-", "-", _status_badge("unknown")]]

    risk_rows = [
        [
            _severity_badge(r["severity"]),
            r["category"],
            r["detail"],
            r["impact"],
        ]
        for r in risk_register
    ]

    psi_summary = "No PageSpeed data available"
    if psi.get("latest_date"):
        psi_summary = (
            f"{psi['properties']} properties | Avg Score {psi['avg_score']} | "
            f"Avg LCP {psi['avg_lcp_s']}s | Avg CLS {psi['avg_cls']} | "
            f"Poor {psi['poor']} | Needs Improvement {psi['needs_improvement']} | Good {psi['good']}"
        )

    health_bg = "#dcfce7"
    health_fg = "#166534"
    if health_state == "WATCH":
        health_bg, health_fg = "#fef3c7", "#92400e"
    if health_state == "ALERT":
        health_bg, health_fg = "#fee2e2", "#991b1b"

    content_html = f"""
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; color: #1f2937; background: #ffffff; }}
    .sub {{ color: #475569; margin-bottom: 14px; font-size: 13px; }}
    .card {{ background: #ffffff; border: 1px solid #e2e8f0; padding: 14px; margin: 12px 0; }}
    .banner {{ padding: 12px; margin: 10px 0 14px 0; font-weight: 600; border-left: 4px solid #15284B; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 13px; background: #ffffff; }}
    th, td {{ border: 1px solid #e2e8f0; text-align: left; padding: 8px; vertical-align: top; }}
    th {{ background: #f8fafc; font-weight: 700; color: #15284B; }}
    p {{ margin: 6px 0; }}
  </style>
  <div class=\"sub\">Generated: {generated_at}</div>

  <div class=\"banner\" style=\"background:{health_bg};color:{health_fg};\">
    Overall Status: {health_state} | {health_message}
  </div>

  <div class=\"card\">
    <h2>1) Data Freshness</h2>
    {_html_table(["Source", "Latest Date", "Age", "Status", "Critical"], freshness_rows)}
  </div>

  <div class=\"card\">
    <h2>2) Collection Runs (Last 24h)</h2>
    {_html_table(["Source", "Runs", "Completed", "Failed", "In Progress", "Last Started"], run_rows)}
  </div>

  <div class=\"card\">
    <h2>3) D1 Mirror Status</h2>
    <p><strong>Status:</strong> {mirror_status}</p>
    <p><strong>Target Friday:</strong> {mirror.get("target_friday", "N/A")}</p>
    <p><strong>Finished (UTC):</strong> {mirror.get("finished_at_utc", "N/A")}</p>
    <p><strong>Report File:</strong> {mirror.get("file", "N/A")}</p>
    {_html_table(["Step", "Status", "Note"], mirror_step_rows)}
  </div>

  <div class=\"card\">
    <h2>4) PageSpeed Snapshot</h2>
    <p><strong>Latest Date:</strong> {psi.get("latest_date", "N/A")}</p>
    <p>{psi_summary}</p>
  </div>

  <div class=\"card\">
    <h2>5) Top 10 Failing Properties (Mobile PageSpeed)</h2>
    {_html_table(["Rank", "Property", "Property ID", "Score", "Delta", "LCP", "CLS", "Risk"], failing_rows)}
  </div>

  <div class=\"card\">
    <h2>6) Vulnerability / Risk Register</h2>
    {_html_table(["Severity", "Category", "Finding", "Business Impact"], risk_rows)}
  </div>
"""

    return wrap_pib_light_email(
        title="Morning Full Portfolio Report",
        subtitle="Portfolio Analytics Operations",
        body_html=content_html,
        badge_text=health_state,
        badge_fg=health_fg,
        badge_bg=health_bg,
    )


def main() -> int:
    report_date = datetime.now().strftime("%Y-%m-%d")
    output_path = REPORT_DIR / f"Morning_Full_Portfolio_Report_{report_date}.html"
    output_path.write_text(build_report_html(), encoding="utf-8")
    print(f"Report generated: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
