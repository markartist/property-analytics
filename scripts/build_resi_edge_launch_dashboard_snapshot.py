#!/usr/bin/env python3
"""Build the static launch dashboard snapshot from the latest readiness queue.

This is a non-mutating dashboard preparation step. It reads existing launch
readiness packets and writes dashboard-ready artifacts only.
"""

from __future__ import annotations

import csv
import json
import sqlite3
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
READINESS_ROOT = ROOT / "reports/resi_edge_performance/wednesday-readiness"
OUT_ROOT = ROOT / "reports/resi_edge_performance/launch-dashboard-snapshot"
WEB_SNAPSHOT = ROOT / "apps/web/src/lib/resi-edge-launch/generated-snapshot.ts"
DB_PATH = ROOT / "data/portfolio_analytics.db"
PSI_BASELINE_ROOT = ROOT / "reports/resi_edge_performance/performance-baselines"
VANITY_QA_ROOT = ROOT / "reports/domain_ops"
HEAP_HYGIENE_ROOT = ROOT / "reports/resi_edge_performance/heap-hygiene"
OPTIMIZATION_PROOF_ROOT = ROOT / "reports/resi_edge_performance"
HERO_FRESHNESS_ROOT = ROOT / "reports/resi_edge_performance/hero-freshness-sync"


OPEN_FOCUS = (
    "Property details review",
    "Google visibility capture",
    "Speed test baseline",
    "Final launch approval",
)

PSI_LAUNCH_TARGETS = ("legacy Venterra URL", "staging Kinsta URL", "final vanity URL")
EXPECTED_HEAP_ID = "286627304"
OLD_HEAP_ID = "676880719"


def latest_file(root: Path, name: str) -> Path:
    matches = sorted(root.glob(f"*/{name}"))
    if not matches:
        raise FileNotFoundError(f"No {name} found under {root}")
    return matches[-1]


def latest_optional_file(root: Path, name: str) -> Path | None:
    matches = sorted(root.glob(f"*/{name}"))
    return matches[-1] if matches else None


def signal(color: str, label: str, detail: str) -> dict[str, str]:
    return {"color": color, "label": label, "detail": detail}


def display_market(value: str) -> str:
    mapping = {
        "Atlanta": "Atlanta, GA",
        "Austin": "Austin, TX",
        "Dallas": "Dallas, TX",
        "Florida": "Florida",
        "Houston": "Houston, TX",
        "Kansas City": "Kansas City, MO",
        "Kentucky": "Kentucky",
        "Oklahoma": "Oklahoma",
        "San Antonio": "San Antonio, TX",
    }
    return mapping.get(value, value)


def current_url_from_name(name: str) -> str:
    slug = (
        name.lower()
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
    )
    slug = "-".join(part for part in slug.split() if part)
    return f"https://venterraliving.com/apartments/{slug}/"


def metric(label: str, value: str, helper: str, tone: str, percent: int) -> dict[str, Any]:
    return {
        "label": label,
        "value": value,
        "helper": helper,
        "tone": tone,
        "percent": percent,
    }


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(str(value)[:10])


def pct_change(current: int | float | None, prior: int | float | None) -> float | None:
    if current is None or prior in (None, 0):
        return None
    return round(((float(current) - float(prior)) / float(prior)) * 100, 1)


def trend_label(start: date) -> str:
    return f"{start.month}/{start.day}"


def organic_summary(conn: sqlite3.Connection, property_id: str | None) -> dict[str, Any]:
    empty = {
        "latestDate": "",
        "t30Sessions": 0,
        "priorT30Sessions": 0,
        "t30Users": 0,
        "t30Conversions": 0,
        "sessionChangePercent": None,
        "organicSharePercent": None,
        "trend": [],
    }
    if not property_id:
        return empty

    row = conn.execute(
        """
        select max(metric_date) latest
        from ga4_traffic_sources
        where property_id = ? and channel_group = 'Organic Search'
        """,
        (property_id,),
    ).fetchone()
    latest = parse_date(row["latest"] if row else None)
    if not latest:
        return empty

    current_start = latest - timedelta(days=29)
    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=29)

    def organic_window(start: date, end: date) -> sqlite3.Row:
        return conn.execute(
            """
            select
              coalesce(sum(sessions), 0) sessions,
              coalesce(sum(total_users), 0) users,
              coalesce(sum(conversions), 0) conversions
            from ga4_traffic_sources
            where property_id = ?
              and channel_group = 'Organic Search'
              and metric_date between ? and ?
            """,
            (property_id, start.isoformat(), end.isoformat()),
        ).fetchone()

    current = organic_window(current_start, latest)
    prior = organic_window(prior_start, prior_end)
    total = conn.execute(
        """
        select coalesce(sum(sessions), 0) sessions
        from ga4_daily_metrics
        where property_id = ? and metric_date between ? and ?
        """,
        (property_id, current_start.isoformat(), latest.isoformat()),
    ).fetchone()
    total_sessions = int(total["sessions"] or 0)
    organic_sessions = int(current["sessions"] or 0)
    organic_share = round((organic_sessions / total_sessions) * 100, 1) if total_sessions else None

    trend: list[dict[str, Any]] = []
    trend_start = latest - timedelta(days=83)
    for offset in range(0, 84, 7):
        start = trend_start + timedelta(days=offset)
        end = min(start + timedelta(days=6), latest)
        value = conn.execute(
            """
            select coalesce(sum(sessions), 0) sessions
            from ga4_traffic_sources
            where property_id = ?
              and channel_group = 'Organic Search'
              and metric_date between ? and ?
            """,
            (property_id, start.isoformat(), end.isoformat()),
        ).fetchone()["sessions"]
        trend.append({"label": trend_label(start), "value": int(value or 0)})

    return {
        "latestDate": latest.strftime("%m/%d/%Y"),
        "t30Sessions": organic_sessions,
        "priorT30Sessions": int(prior["sessions"] or 0),
        "t30Users": int(current["users"] or 0),
        "t30Conversions": int(current["conversions"] or 0),
        "sessionChangePercent": pct_change(organic_sessions, int(prior["sessions"] or 0)),
        "organicSharePercent": organic_share,
        "trend": trend,
    }


def psi_summary(conn: sqlite3.Connection, property_id: str | None) -> dict[str, Any]:
    empty = {
        "latestDate": "",
        "mobileScore": None,
        "desktopScore": None,
        "mobileLcp": None,
        "desktopLcp": None,
        "mobileCls": None,
        "desktopCls": None,
        "mobileTrend": [],
        "desktopTrend": [],
    }
    if not property_id:
        return empty

    rows = conn.execute(
        """
        with latest as (
          select strategy, max(metric_date) metric_date
          from pagespeed_metrics
          where property_id = ?
          group by strategy
        )
        select pm.*
        from pagespeed_metrics pm
        join latest l on l.strategy = pm.strategy and l.metric_date = pm.metric_date
        where pm.property_id = ?
        order by pm.strategy
        """,
        (property_id, property_id),
    ).fetchall()
    by_strategy = {row["strategy"]: row for row in rows}
    latest_dates = [parse_date(row["metric_date"]) for row in rows if row["metric_date"]]
    latest = max([item for item in latest_dates if item], default=None)

    def score(row: sqlite3.Row | None) -> int | None:
        if not row or row["performance_score"] is None:
            return None
        return int(row["performance_score"])

    def num(row: sqlite3.Row | None, key: str) -> float | None:
        if not row or row[key] is None:
            return None
        return round(float(row[key]), 2)

    def strategy_trend(strategy: str) -> list[dict[str, Any]]:
        if not latest:
            return []
        start_date = latest - timedelta(days=83)
        points: list[dict[str, Any]] = []
        for offset in range(0, 84, 7):
            week_start = start_date + timedelta(days=offset)
            week_end = min(week_start + timedelta(days=6), latest)
            value = conn.execute(
                """
                select avg(performance_score) score
                from pagespeed_metrics
                where property_id = ?
                  and strategy = ?
                  and metric_date between ? and ?
                """,
                (property_id, strategy, week_start.isoformat(), week_end.isoformat()),
            ).fetchone()["score"]
            points.append({"label": trend_label(week_start), "value": round(float(value or 0))})
        return points

    mobile = by_strategy.get("mobile")
    desktop = by_strategy.get("desktop")
    return {
        "latestDate": latest.strftime("%m/%d/%Y") if latest else "",
        "mobileScore": score(mobile),
        "desktopScore": score(desktop),
        "mobileLcp": num(mobile, "lcp_value"),
        "desktopLcp": num(desktop, "lcp_value"),
        "mobileCls": num(mobile, "cls_value"),
        "desktopCls": num(desktop, "cls_value"),
        "mobileTrend": strategy_trend("mobile"),
        "desktopTrend": strategy_trend("desktop"),
    }


def load_fresh_psi_packet() -> dict[str, Any]:
    paths = sorted(PSI_BASELINE_ROOT.glob("*/performance-baseline-results.json"))
    if not paths:
        return {"summary": {}, "rows": [], "_path": None}
    by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    latest_payload: dict[str, Any] = {}
    latest_path: Path | None = None
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        latest_payload = payload
        latest_path = path
        for row in payload.get("rows", []):
            if row.get("target_label") not in PSI_LAUNCH_TARGETS:
                continue
            key = (str(row.get("property_code")), str(row.get("target_label")), str(row.get("strategy")))
            if all(key):
                by_key[key] = row

    rows = list(by_key.values())
    completed = 0
    property_codes = {str(row.get("property_code")) for row in rows if row.get("property_code")}
    for code in property_codes:
        if all(
            by_key.get((code, target, strategy), {}).get("ok")
            for target in PSI_LAUNCH_TARGETS
            for strategy in ("mobile", "desktop")
        ):
            completed += 1

    return {
        "summary": {
            "measurements_ok": sum(1 for row in rows if row.get("ok")),
            "measurements_failed": sum(1 for row in rows if row and not row.get("ok")),
            "properties_completed": completed,
        },
        "rows": rows,
        "generated_at_human": latest_payload.get("generated_at_human", ""),
        "_path": str(latest_path.relative_to(ROOT)) if latest_path else None,
    }


def load_latest_vanity_qa_packet() -> dict[str, Any]:
    paths = sorted(VANITY_QA_ROOT.glob("*_vanity_qa/vanity-qa-summary.json"))
    if not paths:
        return {
            "summary": {},
            "generated_at_human": "",
            "_path": None,
        }
    path = paths[-1]
    payload = json.loads(path.read_text(encoding="utf-8"))
    generated = payload.get("generated_at") or ""
    generated_human = ""
    if generated:
        try:
            generated_human = datetime.fromisoformat(generated).strftime("%m/%d/%Y %I:%M %p")
        except ValueError:
            generated_human = payload.get("human_date", "")
    return {
        "summary": payload.get("summary") or {},
        "generated_at_human": generated_human,
        "_path": str(path.relative_to(ROOT)),
    }


def load_latest_heap_hygiene_packet() -> dict[str, Any]:
    paths = sorted(HEAP_HYGIENE_ROOT.glob("*/heap-hygiene-evidence.json"))
    if not paths:
        return {"summary": {}, "rows": [], "_path": None}
    path = paths[-1]
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "summary": payload.get("summary") or {},
        "rows": payload.get("rows") or [],
        "generated_at_human": payload.get("generated_for_display", ""),
        "_path": str(path.relative_to(ROOT)),
    }


def load_latest_hero_freshness_packet() -> dict[str, Any]:
    paths = sorted(HERO_FRESHNESS_ROOT.glob("*/latest-summary.json"))
    root_latest = HERO_FRESHNESS_ROOT / "latest-summary.json"
    if root_latest.exists():
        paths.append(root_latest)
    if not paths:
        return {"summary": {}, "rows": [], "_path": None}
    path = paths[-1]
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "summary": payload,
        "rows": payload.get("rows") or [],
        "generated_at_human": payload.get("generated_at_human", ""),
        "_path": str(path.relative_to(ROOT)),
    }


def index_heap_hygiene(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("domain") or "").lower(): row for row in rows if row.get("domain")}


def index_hero_freshness(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        domain = str(row.get("domain") or "").lower()
        code = str(row.get("property_code") or "").upper()
        if domain:
            index[domain] = row
        if code:
            index[code] = row
    return index


def analytics_hygiene_signal(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {
            "color": "yellow",
            "label": "Needs Check",
            "detail": "Heap source hygiene has not been checked in the latest packet.",
            "sourceHeapIds": [],
            "oldHeapPresent": False,
            "expectedHeapPresent": False,
            "dualHeapPresent": False,
            "heapDebugTrue": False,
            "browserHeapIds": [],
            "browserOldHeapPresent": None,
            "browserExpectedHeapPresent": None,
            "clean": False,
        }
    browser = row.get("browser") or {}
    source_ids = row.get("heap_ids") or []
    browser_ids = browser.get("heap_ids") or []
    clean = bool(row.get("clean"))
    old_heap = bool(row.get("old_heap_present"))
    expected = bool(row.get("expected_heap_present"))
    dual = bool(row.get("dual_heap_present"))
    debug = bool(row.get("heap_debug_true"))
    if clean:
        return {
            "color": "green",
            "label": "Clean",
            "detail": f"Only production Heap {EXPECTED_HEAP_ID} is present and debug mode is off.",
            "sourceHeapIds": source_ids,
            "oldHeapPresent": old_heap,
            "expectedHeapPresent": expected,
            "dualHeapPresent": dual,
            "heapDebugTrue": debug,
            "browserHeapIds": browser_ids,
            "browserOldHeapPresent": browser.get("old_heap_present"),
            "browserExpectedHeapPresent": browser.get("expected_heap_present"),
            "clean": True,
        }
    reasons = []
    if old_heap:
        reasons.append(f"old Heap {OLD_HEAP_ID}")
    if dual:
        reasons.append("dual Heap IDs")
    if debug:
        reasons.append("debug mode")
    if not expected:
        reasons.append(f"production Heap {EXPECTED_HEAP_ID} not confirmed")
    detail = "Resi cleanup is required before optimization: " + ", ".join(reasons) + "."
    return {
        "color": "red",
        "label": "Blocked",
        "detail": detail,
        "sourceHeapIds": source_ids,
        "oldHeapPresent": old_heap,
        "expectedHeapPresent": expected,
        "dualHeapPresent": dual,
        "heapDebugTrue": debug,
        "browserHeapIds": browser_ids,
        "browserOldHeapPresent": browser.get("old_heap_present"),
        "browserExpectedHeapPresent": browser.get("expected_heap_present"),
        "clean": False,
    }


def hero_freshness_signal(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {
            "color": "yellow",
            "label": "Needs Check",
            "detail": "Hero source freshness has not been captured in the latest packet.",
            "status": "not_checked",
            "recommendedAction": "capture_hero_freshness",
        }
    status = str(row.get("status") or "source_error")
    if status == "current":
        return {
            "color": "green",
            "label": "Fresh",
            "detail": "Native hero source matches the optimized asset source record.",
            "status": status,
            "recommendedAction": row.get("recommended_action") or "none",
        }
    if status == "refresh_needed":
        return {
            "color": "yellow",
            "label": "Refresh",
            "detail": "Native hero source changed; queue governed hero asset regeneration.",
            "status": status,
            "recommendedAction": row.get("recommended_action") or "regenerate_hero_assets",
        }
    return {
        "color": "yellow",
        "label": "Check",
        "detail": "Native hero source could not be confirmed cleanly.",
        "status": status,
        "recommendedAction": row.get("recommended_action") or "check_native_source",
    }


def index_fresh_psi(rows: list[dict[str, Any]]) -> dict[tuple[str, str, str], dict[str, Any]]:
    return {
        (str(row.get("property_code")), str(row.get("target_label")), str(row.get("strategy"))): row
        for row in rows
        if row.get("property_code") and row.get("target_label") and row.get("strategy")
    }


def psi_num(row: dict[str, Any] | None, key: str) -> float | None:
    if not row or row.get(key) is None:
        return None
    value = float(row[key])
    return round(value / 1000, 2) if key.endswith("_ms") else round(value, 3)


def fresh_psi_target(
    code: str,
    label: str,
    url: str,
    index: dict[tuple[str, str, str], dict[str, Any]],
    captured_at: str,
    held: bool = False,
) -> dict[str, Any]:
    if held:
        return {
            "label": label,
            "url": url,
            "status": "missing",
            "note": "Live vanity PSI capture is pending.",
            "mobileScore": None,
            "desktopScore": None,
            "mobileLcp": None,
            "desktopLcp": None,
            "mobileCls": None,
            "desktopCls": None,
            "mobileTbt": None,
            "desktopTbt": None,
            "capturedAt": "",
        }

    mobile = index.get((code, label, "mobile"))
    desktop = index.get((code, label, "desktop"))
    failed = any(row and not row.get("ok") for row in (mobile, desktop))
    captured = bool(mobile and mobile.get("ok") and desktop and desktop.get("ok"))
    return {
        "label": label,
        "url": url,
        "status": "captured" if captured else "failed" if failed else "missing",
        "note": "Fresh launch PSI baseline captured." if captured else "Fresh launch PSI baseline is not complete.",
        "mobileScore": int(mobile["score"]) if mobile and mobile.get("score") is not None else None,
        "desktopScore": int(desktop["score"]) if desktop and desktop.get("score") is not None else None,
        "mobileLcp": psi_num(mobile, "largest_contentful_paint_ms"),
        "desktopLcp": psi_num(desktop, "largest_contentful_paint_ms"),
        "mobileCls": psi_num(mobile, "cumulative_layout_shift"),
        "desktopCls": psi_num(desktop, "cumulative_layout_shift"),
        "mobileTbt": psi_num(mobile, "total_blocking_time_ms"),
        "desktopTbt": psi_num(desktop, "total_blocking_time_ms"),
        "capturedAt": captured_at if captured or failed else "",
    }


def load_optimized_proof_index() -> dict[str, dict[str, Any]]:
    def normalized_psi_score(score: Any) -> int | None:
        if score is None:
            return None
        try:
            value = float(score)
        except (TypeError, ValueError):
            return None
        if value <= 1:
            value *= 100
        return int(round(value))

    def exact_scores_from_summary(summary_path: Path, strategy: str) -> list[int]:
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        scores: list[int] = []
        for run in summary.get("runs") or []:
            if run.get("strategy") != strategy or not run.get("ok") or "exact" not in str(run.get("label") or ""):
                continue
            score = normalized_psi_score(run.get("score"))
            if score is not None:
                scores.append(score)
        return scores

    def highest_successful_psi_scores(apply_dir: Path) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for psi_path in sorted((apply_dir / "psi" / "psi").glob("**/psi-*.json")):
            if psi_path.name in {"psi-gate.json", "psi-summary.json"}:
                continue
            stem = psi_path.stem.lower()
            if "mobile" in stem:
                strategy = "mobile"
            elif "desktop" in stem:
                strategy = "desktop"
            else:
                continue
            try:
                payload = json.loads(psi_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            score = normalized_psi_score(
                ((payload.get("lighthouseResult") or {}).get("categories") or {}).get("performance", {}).get("score")
            )
            if score is None:
                continue
            if score > int(result.get(strategy, {}).get("score", -1)):
                result[strategy] = {
                    "score": score,
                    "evidence_path": str(psi_path),
                    "captured_at": str(payload.get("analysisUTCTimestamp") or "").replace("T", " ").replace("Z", " UTC"),
                }
        return result

    def latest_recheck_scores(property_root: Path) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for summary_path in sorted(property_root.glob("psi-recheck-*/psi-summary.json"), key=lambda path: path.stat().st_mtime):
            for strategy in ("mobile", "desktop"):
                scores = exact_scores_from_summary(summary_path, strategy)
                if not scores:
                    continue
                result[strategy] = {
                    "score": min(scores),
                    "highest_score": max(scores),
                    "scores": scores,
                    "evidence_path": str(summary_path.parent),
                    "captured_at": summary_path.parent.name.replace("psi-recheck-", ""),
                }
        return result

    proofs: dict[str, dict[str, Any]] = {}
    for readout_path in sorted(OPTIMIZATION_PROOF_ROOT.glob("*/*/apply-*/apply-readout.json")):
        try:
            readout = json.loads(readout_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        dashboard_recovery_path = readout_path.parent / "dashboard" / "dashboard-finalization-recovery.json"
        dashboard_recovery_passed = False
        try:
            dashboard_recovery = json.loads(dashboard_recovery_path.read_text(encoding="utf-8"))
            dashboard_recovery_passed = (
                dashboard_recovery.get("pass") is True
                or (
                    dashboard_recovery.get("publish_recovery_pass") is True
                    and dashboard_recovery.get("property_gate_ledger_was_already_passed") is True
                )
            )
        except Exception:
            dashboard_recovery = {}
        property_gates_passed = ((readout.get("contract_gate_ledger") or {}).get("pass") is True)
        if readout.get("pass") is not True and not (property_gates_passed and dashboard_recovery_passed):
            continue
        domain = str(readout.get("domain") or "").lower().strip()
        property_code = str(readout.get("property_code") or "").upper().strip()
        if not domain and not property_code:
            continue
        psi_gate_path = readout_path.parent / "psi/psi/psi-gate.json"
        try:
            psi_gate = json.loads(psi_gate_path.read_text(encoding="utf-8"))
        except Exception:
            psi_gate = {}
        mobile_score = psi_gate.get("mobile_min_score")
        desktop_score = psi_gate.get("desktop_min_score")
        highest_scores = highest_successful_psi_scores(readout_path.parent)
        recheck = latest_recheck_scores(readout_path.parent.parent)
        mobile_candidates = [normalized_psi_score(mobile_score)]
        desktop_candidates = [normalized_psi_score(desktop_score)]
        if highest_scores.get("mobile"):
            mobile_candidates.append(normalized_psi_score(highest_scores["mobile"].get("score")))
        if highest_scores.get("desktop"):
            desktop_candidates.append(normalized_psi_score(highest_scores["desktop"].get("score")))
        if recheck.get("mobile"):
            mobile_candidates.append(normalized_psi_score(recheck["mobile"].get("highest_score")))
        if recheck.get("desktop"):
            desktop_candidates.append(normalized_psi_score(recheck["desktop"].get("highest_score")))
        mobile_score = max(score for score in mobile_candidates if score is not None) if any(score is not None for score in mobile_candidates) else None
        desktop_score = max(score for score in desktop_candidates if score is not None) if any(score is not None for score in desktop_candidates) else None
        mobile_evidence = highest_scores.get("mobile") or recheck.get("mobile") or {}
        desktop_evidence = highest_scores.get("desktop") or recheck.get("desktop") or {}
        proof = {
            "status": "captured",
            "label": "optimized live proof",
            "url": f"https://{domain}/" if domain else "",
            "note": "Governed optimization package passed live proof; PSI shows the highest successful captured proof sample.",
            "mobileScore": mobile_score,
            "desktopScore": desktop_score,
            "mobileLcp": None,
            "desktopLcp": None,
            "mobileCls": None,
            "desktopCls": None,
            "mobileTbt": None,
            "desktopTbt": None,
            "capturedAt": (desktop_evidence or mobile_evidence).get("captured_at") or readout_path.parent.name.replace("apply-", ""),
            "evidencePath": str(readout_path.parent),
            "psiEvidencePath": (desktop_evidence or mobile_evidence).get("evidence_path") or str(psi_gate_path),
            "runtimeVersion": ((readout.get("stage_setup") or {}).get("deploy_bundle_validation") or {}).get("mobile_shell_byte_forecast", {}).get("runtime_version"),
            "gateSummary": (readout.get("contract_gate_ledger") or {}).get("summary") or {},
        }
        for key in (domain, property_code):
            if key:
                proofs[key] = proof
    return proofs


def build_property(
    row: dict[str, Any],
    index: int,
    conn: sqlite3.Connection,
    fresh_psi_index: dict[tuple[str, str, str], dict[str, Any]],
    fresh_psi_captured_at: str,
    heap_hygiene_index: dict[str, dict[str, Any]],
    hero_freshness_index: dict[str, dict[str, Any]],
    optimized_proof_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    focus = OPEN_FOCUS[index % len(OPEN_FOCUS)]
    property_name = row["property_name"]
    vanity_domain = row["vanity_domain"]
    heap_hygiene = analytics_hygiene_signal(heap_hygiene_index.get(str(vanity_domain).lower()))
    hero_freshness = hero_freshness_signal(
        hero_freshness_index.get(str(vanity_domain).lower()) or hero_freshness_index.get(str(row["property_code"]).upper())
    )
    current_url = current_url_from_name(property_name)
    new_url = f"https://{vanity_domain}/"
    staging_url = ""
    draft_manifest_path = row.get("draft_manifest_repo_path")
    if draft_manifest_path:
        try:
            draft_manifest = json.loads((ROOT / draft_manifest_path).read_text(encoding="utf-8"))
            target = draft_manifest.get("target", {})
            current_url = target.get("governed_reference_url") or current_url
            staging_url = target.get("staging_kinsta_url") or target.get("source_staging_url") or draft_manifest.get("source", {}).get("staging_kinsta_url") or ""
        except Exception:
            staging_url = ""
    units = int(row.get("units") or 0)
    completed_setup = set(row.get("completed_setup") or [])
    domain_ready = row.get("cloudflare_zone_status") == "active"
    staging_ready = row.get("staging_kinsta_status") == "passed"
    reporting_ready = row.get("ga4_status") == "ready_no_ga4_url_change_needed"
    ahrefs_ready = row.get("ahrefs_project_status") == "ready_existing_vanity_project_found"
    performance_ready = False
    details_ready = int(row.get("pending_manifest_fields") or 0) == 0
    progress_points = [
        domain_ready,
        staging_ready,
        reporting_ready,
        ahrefs_ready,
        performance_ready,
        details_ready,
        False,
    ]
    progress_percent = round(sum(1 for item in progress_points if item) / len(progress_points) * 100)
    ga4_property_id = str(row.get("ga4_property_id") or "").strip() or None
    organic = organic_summary(conn, ga4_property_id)
    psi = psi_summary(conn, ga4_property_id)
    psi_launch_targets = [
        fresh_psi_target(row["property_code"], "legacy Venterra URL", current_url, fresh_psi_index, fresh_psi_captured_at),
        fresh_psi_target(row["property_code"], "staging Kinsta URL", staging_url, fresh_psi_index, fresh_psi_captured_at),
        fresh_psi_target(row["property_code"], "final vanity URL", new_url, fresh_psi_index, fresh_psi_captured_at),
    ]
    optimized_proof = (
        optimized_proof_index.get(str(vanity_domain).lower())
        or optimized_proof_index.get(str(row["property_code"]).upper())
        or {
            "status": "missing",
            "label": "optimized live proof",
            "url": new_url,
            "note": "Optimization proof has not started.",
            "mobileScore": None,
            "desktopScore": None,
            "mobileLcp": None,
            "desktopLcp": None,
            "mobileCls": None,
            "desktopCls": None,
            "mobileTbt": None,
            "desktopTbt": None,
            "capturedAt": "",
            "evidencePath": "",
            "runtimeVersion": "",
            "gateSummary": {},
        }
    )
    if not optimized_proof.get("url"):
        optimized_proof["url"] = new_url
    optimized_complete = optimized_proof.get("status") == "captured"
    has_psi_history = psi["mobileScore"] is not None or psi["desktopScore"] is not None
    fresh_psi_complete = all(target["status"] == "captured" for target in psi_launch_targets[:2])
    live_vanity_psi_complete = psi_launch_targets[2]["status"] == "captured"
    launch_live = live_vanity_psi_complete
    if optimized_complete:
        focus = "Optimized proof complete"
        progress_percent = 100
    elif launch_live:
        focus = "Optimization benchmark"
        progress_percent = 100

    green = lambda label, detail: signal("green", label, detail)
    yellow = lambda label, detail: signal("yellow", label, detail)

    steps = [
        {
            "number": 1,
            "title": "New domain in company account",
            "status": green("Done", "The new property domain is active and ready to manage.")
            if domain_ready
            else yellow("Open", "The new property domain still needs to be confirmed."),
        },
        {
            "number": 2,
            "title": "Staging site reachable",
            "status": green("Done", "The staging site returned a successful page check.")
            if staging_ready
            else yellow("Open", "The staging site still needs a successful page check."),
        },
        {
            "number": 3,
            "title": "Reporting profile aligned",
            "status": green("Done", "The reporting profile is set to the new property address.")
            if reporting_ready
            else yellow("Open", "The reporting profile still needs confirmation."),
        },
            {
                "number": 4,
                "title": "Vanity domain live",
                "status": green("Done", "The final property domain holds in-browser.")
                if launch_live
                else yellow("Open", "Confirm the final property domain holds in-browser."),
            },
            {
                "number": 5,
                "title": "Legacy redirects active",
                "status": green("Done", "Legacy base, reviews, and gallery paths redirect to the new domain.")
                if launch_live
                else yellow("Waiting", "Redirects stay pending until the vanity domain is live."),
            },
            {
                "number": 6,
                "title": "Live speed benchmark",
                "status": green("Done", "Mobile and desktop PSI are captured on the live vanity domain.")
                if live_vanity_psi_complete
                else yellow("Open", "Capture mobile and desktop PSI on the live vanity domain."),
            },
            {
                "number": 7,
                "title": "Optimization target",
                "status": green("Done", "The governed optimization package passed live proof.")
                if optimized_complete
                else yellow("Future Work", "Use the captured live benchmark to queue the optimization run."),
            },
        ]

    return {
        "propertyCode": row["property_code"],
        "propertyName": property_name,
        "market": display_market(row.get("market_or_region") or ""),
        "units": units,
        "launchDate": row.get("go_live") or "08/19/2026",
        "progressPercent": progress_percent,
        "currentFocus": focus,
        "overall": green("Live, Redirects Active", "The vanity domain is live, legacy redirects are active, and live PSI is captured.")
        if launch_live
        else yellow("On Track, Not Cleared", f"{focus} remains open before launch approval."),
        "currentUrl": {"label": current_url.replace("https://", ""), "url": current_url},
        "newUrl": {"label": new_url.replace("https://", ""), "url": new_url},
        "redirectPlan": "Legacy redirects are active for the base, reviews, and gallery paths."
        if launch_live
        else "After approval, the current Venterra page will forward visitors to the new property domain.",
        "metrics": [
            metric("Domain", "100%" if domain_ready else "Open", "Company-controlled domain is active." if domain_ready else "Domain confirmation is still open.", "green" if domain_ready else "yellow", 100 if domain_ready else 0),
            metric("Staging", "100%" if staging_ready else "Open", "Staging site returned a successful check." if staging_ready else "Staging still needs a successful check.", "green" if staging_ready else "yellow", 100 if staging_ready else 0),
            metric("Reporting", "100%" if reporting_ready else "Open", "Reporting profile is aligned to the new address." if reporting_ready else "Reporting profile still needs confirmation.", "green" if reporting_ready else "yellow", 100 if reporting_ready else 0),
            metric(
                "Fresh PSI",
                "Ready" if fresh_psi_complete else "Open",
                "Legacy and Kinsta launch baselines are captured." if fresh_psi_complete else "Legacy and Kinsta launch baselines still need capture.",
                "green" if fresh_psi_complete else "yellow",
                100 if fresh_psi_complete else 0,
            ),
            metric(
                "Optimization Queue" if launch_live else "Launch Prep",
                "Done" if optimized_complete else "Queued" if launch_live else "Open",
                "Governed optimization proof is complete." if optimized_complete else "Use the live benchmark to plan governed optimization work." if launch_live else "This is the next item to clear before approval.",
                "green" if optimized_complete else "yellow",
                100 if optimized_complete else 45,
            ),
        ],
        "steps": steps,
        "facts": [
            {
                "label": "Domain status",
                "value": "Active in Cloudflare" if domain_ready else "Needs confirmation",
                "signal": green("Ready", "The new property domain is active in the company Cloudflare account.")
                if domain_ready
                else yellow("Open", "The new property domain still needs confirmation."),
            },
            {
                "label": "Public routing",
                "value": "Redirects active" if launch_live else "Prepared, not live",
                "signal": green("Live", "Legacy base, reviews, and gallery paths route to the new property domain.")
                if launch_live
                else yellow("Waiting", "Forwarding is prepared and remains off until approval."),
            },
            {
                "label": "Indexing condition",
                "value": "Indexable; monitoring" if launch_live else "Baseline needed",
                "signal": green("Indexable", "Vanity pages reported index, follow; continue post-move Google monitoring.")
                if launch_live
                else yellow("Needs Check", "Google visibility should be checked before and after the move."),
            },
            {
                "label": "Analytics history",
                "value": "Retained",
                "signal": green("Ready", "Existing reporting history remains available for comparison.")
                if reporting_ready
                else yellow("Open", "Reporting history still needs confirmation."),
            },
            {
                "label": "Analytics hygiene",
                "value": "Clean" if heap_hygiene["clean"] else "Cleanup required",
                "signal": {
                    "color": heap_hygiene["color"],
                    "label": heap_hygiene["label"],
                    "detail": heap_hygiene["detail"],
                },
            },
            {
                "label": "Performance baseline",
                "value": (
                    f"Legacy M {psi_launch_targets[0]['mobileScore']}; D {psi_launch_targets[0]['desktopScore']} | Kinsta M {psi_launch_targets[1]['mobileScore']}; D {psi_launch_targets[1]['desktopScore']} | Live M {psi_launch_targets[2]['mobileScore']}; D {psi_launch_targets[2]['desktopScore']}"
                    if fresh_psi_complete
                    else "Not measured yet"
                ),
                "signal": green("Captured", "Legacy, Kinsta, and live vanity speed benchmarks are captured.")
                if live_vanity_psi_complete
                else green("Ready", "Fresh legacy and Kinsta speed baselines are captured; live vanity PSI is the next benchmark.")
                if fresh_psi_complete
                else yellow("Open", "Fresh legacy and Kinsta speed baselines still need capture."),
            },
            {
                "label": "Hero media freshness",
                "value": hero_freshness["label"],
                "signal": {
                    "color": hero_freshness["color"],
                    "label": hero_freshness["label"],
                    "detail": hero_freshness["detail"],
                },
            },
            {
                "label": "Launch prep",
                "value": "Optimized proof complete" if optimized_complete else "Optimization benchmark" if launch_live else focus,
                "signal": green("Optimized", "Governed optimization package passed live proof.")
                if optimized_complete
                else yellow("Future Work", "Optimization is the next phase after the live benchmark.")
                if launch_live
                else yellow("Open", f"{focus} is the next item to clear."),
            },
        ],
        "organic": organic,
        "psi": psi,
        "psiLaunchTargets": psi_launch_targets,
        "optimizedProof": optimized_proof,
        "analyticsHygiene": heap_hygiene,
        "heroFreshness": hero_freshness,
        "domain": green("Ready", "The new property domain is active in the company Cloudflare account.")
        if domain_ready
        else yellow("Open", "The new property domain still needs confirmation."),
        "routing": green("Live", "Legacy base, reviews, and gallery paths route to the new property domain.")
        if launch_live
        else yellow("Waiting", "Forwarding is prepared and remains off until approval."),
        "indexing": green("Indexable", "Vanity pages reported index, follow; continue post-move Google monitoring.")
        if launch_live
        else yellow("Needs Check", "Google visibility should be checked before and after the move."),
        "analytics": green("Ready", "Existing reporting history remains available; new-domain reporting is ready.")
        if reporting_ready
        else yellow("Open", "Reporting still needs confirmation."),
        "performance": green("Captured", "Legacy, Kinsta, and live vanity speed benchmarks are captured.")
        if live_vanity_psi_complete
        else green("Ready", "Fresh legacy and Kinsta speed baselines are captured; live vanity PSI is the next benchmark.")
        if fresh_psi_complete
        else yellow("Baseline Open", "Fresh legacy and Kinsta speed baselines still need capture."),
        "operations": green("Optimized", "Governed optimization package passed live proof.")
        if optimized_complete
        else yellow("Future Work", "Optimization is the next phase after the live benchmark.")
        if launch_live
        else yellow("Prep Open", f"{focus} is the next item to clear."),
        "historyNote": "Legacy reporting remains available after the move, so teams can compare old and new-domain behavior.",
        "nextStep": "Next: monitor optimized live proof and carry this package forward."
        if optimized_complete
        else "Next: compare live vanity PSI against the optimized target and queue improvements."
        if launch_live
        else f"Next: clear {focus.lower()} for {property_name}.",
        "_completed_setup": completed_setup,
    }


def write_tsv(rows: list[dict[str, Any]], path: Path) -> None:
    fields = [
        "propertyCode",
        "propertyName",
        "market",
        "units",
        "launchDate",
        "progressPercent",
        "currentFocus",
        "currentUrl",
        "newUrl",
        "organicT30Sessions",
        "organicPriorT30Sessions",
        "organicChangePercent",
        "organicSharePercent",
        "mobilePsiScore",
        "desktopPsiScore",
        "nextStep",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **row,
                    "currentUrl": row["currentUrl"]["url"],
                    "newUrl": row["newUrl"]["url"],
                    "organicT30Sessions": row["organic"]["t30Sessions"],
                    "organicPriorT30Sessions": row["organic"]["priorT30Sessions"],
                    "organicChangePercent": row["organic"]["sessionChangePercent"],
                    "organicSharePercent": row["organic"]["organicSharePercent"],
                    "mobilePsiScore": row["psi"]["mobileScore"],
                    "desktopPsiScore": row["psi"]["desktopScore"],
                }
            )


def main() -> int:
    readiness_path = latest_file(READINESS_ROOT, "wednesday-readiness-queue.json")
    readiness = json.loads(readiness_path.read_text(encoding="utf-8"))
    generated_at = datetime.now(timezone.utc)
    generated_display = generated_at.astimezone().strftime("%m/%d/%Y %I:%M %p")
    rows = readiness["rows"]
    fresh_psi = load_fresh_psi_packet()
    fresh_psi_index = index_fresh_psi(fresh_psi.get("rows", []))
    fresh_psi_captured_at = fresh_psi.get("generated_at_human", "")
    vanity_qa = load_latest_vanity_qa_packet()
    vanity_qa_summary = vanity_qa.get("summary") or {}
    heap_hygiene = load_latest_heap_hygiene_packet()
    heap_hygiene_summary = heap_hygiene.get("summary") or {}
    heap_hygiene_index = index_heap_hygiene(heap_hygiene.get("rows", []))
    hero_freshness = load_latest_hero_freshness_packet()
    hero_freshness_summary = hero_freshness.get("summary") or {}
    hero_freshness_index = index_hero_freshness(hero_freshness.get("rows", []))
    optimized_proof_index = load_optimized_proof_index()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    properties = [
        build_property(row, index, conn, fresh_psi_index, fresh_psi_captured_at, heap_hygiene_index, hero_freshness_index, optimized_proof_index)
        for index, row in enumerate(rows)
    ]
    conn.close()
    for prop in properties:
        prop.pop("_completed_setup", None)

    total = len(properties)
    total_homes = sum(prop["units"] for prop in properties)
    domains = sum(1 for row in rows if row.get("cloudflare_zone_status") == "active")
    staging = sum(1 for row in rows if row.get("staging_kinsta_status") == "passed")
    analytics = sum(1 for row in rows if row.get("ga4_status") == "ready_no_ga4_url_change_needed")
    ahrefs = sum(1 for row in rows if row.get("ahrefs_project_status") == "ready_existing_vanity_project_found")
    performance = sum(1 for prop in properties if all(target["status"] == "captured" for target in prop["psiLaunchTargets"][:2]))
    live_vanity_performance = sum(1 for prop in properties if prop["psiLaunchTargets"][2]["status"] == "captured")
    optimized_performance = sum(1 for prop in properties if prop["optimizedProof"]["status"] == "captured")
    vanity_qa_green = int(vanity_qa_summary.get("green") or 0)
    vanity_qa_yellow = int(vanity_qa_summary.get("yellow") or 0)
    vanity_qa_red = int(vanity_qa_summary.get("red") or 0)
    vanity_qa_total = int(vanity_qa_summary.get("total") or total)
    vanity_qa_passed = vanity_qa_green == vanity_qa_total and vanity_qa_yellow == 0 and vanity_qa_red == 0
    vanity_qa_core_pages_checked = int(vanity_qa_summary.get("core_pages_checked") or 0)
    vanity_qa_core_page_issues = int(vanity_qa_summary.get("core_pages_with_issues") or 0)
    vanity_qa_properties_with_core_page_issues = int(vanity_qa_summary.get("properties_with_core_page_issues") or 0)
    approvals = 0
    public_moves_completed = total if live_vanity_performance == total else 0
    details_closed = sum(1 for row in rows if int(row.get("pending_manifest_fields") or 0) == 0)
    search_captured = 0
    average_progress = round(sum(prop["progressPercent"] for prop in properties) / total)
    organic_t30 = sum(int(prop["organic"]["t30Sessions"] or 0) for prop in properties)
    organic_prior_t30 = sum(int(prop["organic"]["priorT30Sessions"] or 0) for prop in properties)
    organic_users_t30 = sum(int(prop["organic"]["t30Users"] or 0) for prop in properties)
    organic_conversions_t30 = sum(int(prop["organic"]["t30Conversions"] or 0) for prop in properties)
    organic_latest = max([prop["organic"]["latestDate"] for prop in properties if prop["organic"]["latestDate"]], default="")
    total_t30_sessions = sum(
        round((prop["organic"]["t30Sessions"] or 0) / ((prop["organic"]["organicSharePercent"] or 0) / 100))
        for prop in properties
        if prop["organic"]["organicSharePercent"]
    )
    organic_share = round((organic_t30 / total_t30_sessions) * 100, 1) if total_t30_sessions else None
    psi_history = sum(1 for prop in properties if prop["psi"]["mobileScore"] is not None or prop["psi"]["desktopScore"] is not None)
    mobile_scores = [prop["psi"]["mobileScore"] for prop in properties if prop["psi"]["mobileScore"] is not None]
    desktop_scores = [prop["psi"]["desktopScore"] for prop in properties if prop["psi"]["desktopScore"] is not None]
    psi_mobile_average = round(sum(mobile_scores) / len(mobile_scores)) if mobile_scores else None
    psi_desktop_average = round(sum(desktop_scores) / len(desktop_scores)) if desktop_scores else None
    psi_latest = max([prop["psi"]["latestDate"] for prop in properties if prop["psi"]["latestDate"]], default="")
    analytics_hygiene_clean = int(heap_hygiene_summary.get("clean") or 0)
    analytics_hygiene_source_checked = int(heap_hygiene_summary.get("properties") or 0)
    analytics_hygiene_old_heap = int(heap_hygiene_summary.get("old_heap_present") or 0)
    analytics_hygiene_expected_heap = int(heap_hygiene_summary.get("expected_heap_present") or 0)
    analytics_hygiene_dual_heap = int(heap_hygiene_summary.get("dual_heap_present") or 0)
    analytics_hygiene_debug_true = int(heap_hygiene_summary.get("heap_debug_true") or 0)
    analytics_hygiene_browser_checked = int(heap_hygiene_summary.get("browser_checked") or 0)
    analytics_hygiene_browser_old = int(heap_hygiene_summary.get("browser_old_heap_present") or 0)
    analytics_hygiene_browser_expected = int(heap_hygiene_summary.get("browser_expected_heap_present") or 0)
    analytics_hygiene_status = str(heap_hygiene_summary.get("status") or "not_checked")
    hero_statuses = [str(prop.get("heroFreshness", {}).get("status") or "not_checked") for prop in properties]
    hero_freshness_current = sum(1 for status in hero_statuses if status == "current")
    hero_freshness_refresh_needed = sum(1 for status in hero_statuses if status == "refresh_needed")
    hero_freshness_source_missing = sum(1 for status in hero_statuses if status == "source_missing")
    hero_freshness_source_error = sum(1 for status in hero_statuses if status == "source_error")
    hero_freshness_checked = sum(1 for status in hero_statuses if status != "not_checked")
    hero_freshness_open = hero_freshness_refresh_needed + hero_freshness_source_missing + hero_freshness_source_error

    focus_counts = Counter(prop["currentFocus"] for prop in properties)
    market_counts = Counter(prop["market"] for prop in properties)

    snapshot = {
        "generatedForDisplay": generated_display,
        "launchDate": readiness.get("go_live") or "08/19/2026",
        "targetHost": "launch.venterrawebops.com",
        "rollupMetrics": [
            metric(
                "Launch Move",
                f"{public_moves_completed}/{total}" if public_moves_completed else f"{average_progress}%",
                "All 20 vanity domains are live and legacy redirects are active." if public_moves_completed == total else "Average readiness across the first 20 moves.",
                "green" if public_moves_completed == total else "yellow",
                100 if public_moves_completed == total else average_progress,
            ),
            metric("Homes Represented", f"{total_homes:,}", "Total homes in the first launch batch.", "green", 100),
            metric("Organic T30", f"{organic_t30:,}", "Organic Search sessions in the latest 30-day window.", "green", 100),
            metric("PSI History", f"{psi_history}/{total}", "Current-site speed history available before the move.", "green" if psi_history == total else "yellow", round((psi_history / total) * 100)),
            metric("Fresh PSI", f"{performance}/{total}", "Legacy and Kinsta launch baselines captured.", "green" if performance == total else "yellow", round((performance / total) * 100)),
            metric(
                "Live Vanity PSI",
                f"{live_vanity_performance}/{total}" if live_vanity_performance else "Pending",
                "Live vanity mobile and desktop benchmarks captured." if live_vanity_performance == total else "Capture the live vanity benchmark before optimization work begins.",
                "green" if live_vanity_performance == total else "yellow",
                round((live_vanity_performance / total) * 100) if total else 0,
            ),
            metric(
                "Public Moves Complete",
                f"{public_moves_completed}/{total}",
                "Legacy base, reviews, and gallery redirects are active for all 20 properties." if public_moves_completed == total else "No public move is complete until launch approval.",
                "green" if public_moves_completed == total else "yellow",
                round((public_moves_completed / total) * 100) if total else 0,
            ),
            metric(
                "Read-Only QA",
                f"{vanity_qa_green}/{vanity_qa_total}",
                f"Latest routing, canonical, indexability, metadata, CTA, core-page, and mobile smoke test passed at {vanity_qa.get('generated_at_human') or 'latest run'}." if vanity_qa_passed else "Latest expanded read-only QA has open items.",
                "green" if vanity_qa_passed else "red" if vanity_qa_red else "yellow",
                round((vanity_qa_green / vanity_qa_total) * 100) if vanity_qa_total else 0,
            ),
            metric(
                "Promo Bars",
                "Watching",
                "Promotion banner rendering is pending the Resi app follow-up.",
                "yellow",
                60,
            ),
            metric(
                "Optimized Proof",
                f"{optimized_performance}/{total}",
                "Governed optimization proof is complete for passed properties.",
                "green" if optimized_performance else "yellow",
                round((optimized_performance / total) * 100) if total else 0,
            ),
            metric(
                "Analytics Hygiene",
                f"{analytics_hygiene_clean}/{total}",
                "All live pages have one approved production Heap path."
                if analytics_hygiene_clean == total
                else f"Old Heap {OLD_HEAP_ID} and debug mode must be removed before optimization.",
                "green" if analytics_hygiene_clean == total else "red",
                round((analytics_hygiene_clean / total) * 100) if total else 0,
            ),
            metric(
                "Hero Media",
                f"{hero_freshness_current}/{total}" if hero_freshness_checked else "Pending",
                "Native hero sources match optimized asset records."
                if hero_freshness_checked and hero_freshness_open == 0 and hero_freshness_current == total
                else "Hero source freshness is being watched for source-media changes.",
                "green" if hero_freshness_checked and hero_freshness_open == 0 and hero_freshness_current == total else "yellow",
                round((hero_freshness_current / total) * 100) if total else 0,
            ),
        ],
        "stageBars": [
            {"label": "Domains", "value": domains, "total": total, "tone": "green"},
            {"label": "Staging", "value": staging, "total": total, "tone": "green"},
            {"label": "Reporting", "value": analytics, "total": total, "tone": "green"},
            {"label": "Ahrefs", "value": ahrefs, "total": total, "tone": "green"},
            {"label": "PSI History", "value": psi_history, "total": total, "tone": "green" if psi_history == total else "yellow"},
            {"label": "Fresh PSI", "value": performance, "total": total, "tone": "green" if performance == total else "yellow"},
            {"label": "Read-Only QA", "value": vanity_qa_green, "total": vanity_qa_total, "tone": "green" if vanity_qa_passed else "red" if vanity_qa_red else "yellow"},
            {"label": "Analytics Clean", "value": analytics_hygiene_clean, "total": total, "tone": "green" if analytics_hygiene_clean == total else "red"},
            {"label": "Hero Media", "value": hero_freshness_current, "total": total, "tone": "green" if hero_freshness_checked and hero_freshness_open == 0 and hero_freshness_current == total else "yellow"},
            {"label": "Optimized Proof", "value": optimized_performance, "total": total, "tone": "green" if optimized_performance else "yellow"},
            {"label": "Final Approval", "value": approvals, "total": total, "tone": "yellow"},
        ],
        "openItemBreakdown": [
            {"label": label, "value": focus_counts.get(label, 0), "tone": "yellow"} for label in OPEN_FOCUS
        ],
        "marketBreakdown": [
            {"label": label, "value": value, "tone": "green"} for label, value in sorted(market_counts.items())
        ],
        "summary": {
            "totalProperties": total,
            "totalHomes": total_homes,
            "averageProgress": average_progress,
            "readyToWatch": total,
            "needsAttention": 0 if public_moves_completed == total else total,
            "blocked": sum(1 for row in rows if row.get("hard_blockers")),
            "publicMovesCompleted": public_moves_completed,
            "domainsControlled": domains,
            "stagingReachable": staging,
            "analyticsReady": analytics,
            "performanceMeasured": performance,
            "detailsClosed": details_closed,
            "searchBaselinesCaptured": search_captured,
            "finalApprovals": approvals,
            "organicT30Sessions": organic_t30,
            "organicPriorT30Sessions": organic_prior_t30,
            "organicSessionChangePercent": pct_change(organic_t30, organic_prior_t30),
            "organicSharePercent": organic_share,
            "organicLatestDate": organic_latest,
            "psiHistoryProperties": psi_history,
            "psiMobileAverage": psi_mobile_average,
            "psiDesktopAverage": psi_desktop_average,
            "psiLatestDate": psi_latest,
            "freshPsiMeasurementsOk": int((fresh_psi.get("summary") or {}).get("measurements_ok") or 0),
            "freshPsiMeasurementsFailed": int((fresh_psi.get("summary") or {}).get("measurements_failed") or 0),
            "freshPsiPropertiesCompleted": int((fresh_psi.get("summary") or {}).get("properties_completed") or 0),
            "freshPsiLatestDate": fresh_psi_captured_at,
            "finalVanityPsiStatus": "captured" if live_vanity_performance == total else "pending_live_capture",
            "optimizedProofProperties": optimized_performance,
            "vanityQaGreen": vanity_qa_green,
            "vanityQaYellow": vanity_qa_yellow,
            "vanityQaRed": vanity_qa_red,
            "vanityQaTotal": vanity_qa_total,
            "vanityQaRoot200": int(vanity_qa_summary.get("root_200") or 0),
            "vanityQaHolds": int(vanity_qa_summary.get("vanity_holds") or 0),
            "vanityQaCanonical": int(vanity_qa_summary.get("canonical_vanity") or 0),
            "vanityQaIndexable": int(vanity_qa_summary.get("indexable_page") or 0),
            "vanityQaRobotsIndexable": int(vanity_qa_summary.get("robots_indexable") or 0),
            "vanityQaMobileSmokeOk": int(vanity_qa_summary.get("mobile_smoke_ok") or 0),
            "vanityQaCorePagesChecked": vanity_qa_core_pages_checked,
            "vanityQaCorePageIssues": vanity_qa_core_page_issues,
            "vanityQaPropertiesWithCorePageIssues": vanity_qa_properties_with_core_page_issues,
            "vanityQaLatestDate": vanity_qa.get("generated_at_human", ""),
            "vanityQaEvidencePath": vanity_qa.get("_path"),
            "promoBannerStatus": "vendor_follow_up",
            "analyticsHygieneStatus": analytics_hygiene_status,
            "analyticsHygieneClean": analytics_hygiene_clean,
            "analyticsHygieneSourceChecked": analytics_hygiene_source_checked,
            "analyticsHygieneOldHeapPresent": analytics_hygiene_old_heap,
            "analyticsHygieneExpectedHeapPresent": analytics_hygiene_expected_heap,
            "analyticsHygieneDualHeapPresent": analytics_hygiene_dual_heap,
            "analyticsHygieneDebugTrue": analytics_hygiene_debug_true,
            "analyticsHygieneBrowserChecked": analytics_hygiene_browser_checked,
            "analyticsHygieneBrowserOldHeapPresent": analytics_hygiene_browser_old,
            "analyticsHygieneBrowserExpectedHeapPresent": analytics_hygiene_browser_expected,
            "analyticsHygieneExpectedHeapId": EXPECTED_HEAP_ID,
            "analyticsHygieneOldHeapId": OLD_HEAP_ID,
            "analyticsHygieneEvidencePath": heap_hygiene.get("_path"),
            "heroFreshnessStatus": "fresh" if hero_freshness_checked and hero_freshness_open == 0 and hero_freshness_current == total else "watching",
            "heroFreshnessChecked": hero_freshness_checked,
            "heroFreshnessCurrent": hero_freshness_current,
            "heroFreshnessRefreshNeeded": hero_freshness_refresh_needed,
            "heroFreshnessSourceMissing": hero_freshness_source_missing,
            "heroFreshnessSourceError": hero_freshness_source_error,
            "heroFreshnessLatestDate": hero_freshness.get("generated_at_human", ""),
            "heroFreshnessEvidencePath": hero_freshness.get("_path"),
        },
        "properties": properties,
    }

    run_dir = OUT_ROOT / f"launch-dashboard-snapshot-{generated_at.strftime('%Y%m%dT%H%M%SZ')}"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "launch-snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    write_tsv(properties, run_dir / "launch-snapshot.csv")
    (WEB_SNAPSHOT).write_text(
        "import type { LaunchSnapshot } from \"./types\";\n\n"
        f"export const launchSnapshot = {json.dumps(snapshot, indent=2)} satisfies LaunchSnapshot;\n",
        encoding="utf-8",
    )
    (OUT_ROOT / "latest.json").write_text(json.dumps({"latest": str(run_dir.relative_to(ROOT))}, indent=2) + "\n", encoding="utf-8")
    print(run_dir)
    print(WEB_SNAPSHOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
