#!/usr/bin/env python3
"""
Generate and email the daily Pilot Master speed stability brief.

This is intentionally scoped to the experimental Pilot Master homepage:
https://pilot.venterradev.com/
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import requests

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "utils"))

from utils.ksm import resolve_secret, resolve_secret_from_multiple_notations  # noqa: E402
from email_sender import EmailSender  # noqa: E402


CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
PSI_KEY_PATH = ROOT / "Spotlight_Properties_Report" / "config" / "pagespeed_api_key.txt"
REPORT_ROOT = ROOT / "pilot_control_cwv" / "reports" / "pilot_master_stability"
DELIVERY_LOG_DIR = ROOT / "logs" / "email_delivery"
PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
PILOT_URL = "https://pilot.venterradev.com/"
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
VENTERRA_NAVY = "#15284B"
SAN_MARINO = "#3D66B9"
MONTE_CARLO = "#7DCAC2"
PINK = "#E02472"
WHITE_SMOKE = "#F6F6F5"
QUILL_GRAY = "#D6D6D2"
TERRA_COTTA = "#BD4830"
DELTA = "#9B9B96"
BLACK = "#000000"


@dataclass
class PsiRun:
    label: str
    url: str
    artifact: str
    ok: bool
    status_code: int
    score: int | None = None
    fcp_ms: int | None = None
    lcp_ms: int | None = None
    tbt_ms: float | None = None
    cls: float | None = None
    speed_index_ms: int | None = None
    total_byte_weight: int | None = None
    network_requests: int | None = None
    heap_contentsquare_requests: int | None = None
    field_data_status: str | None = None
    final_url: str | None = None
    error: str | None = None


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def load_psi_api_key() -> str:
    return resolve_secret_from_multiple_notations(
        description="PageSpeed API key",
        notation_env_vars=[
            "KSM_PAGESPEED_API_KEY_NOTATION",
            "KSM_PAGESPEED_API_KEY_FILE_NOTATION",
        ],
        direct_env_var="PAGESPEED_API_KEY",
        file_path=PSI_KEY_PATH,
        default_profile="marketingops",
    )


def score_to_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(round(float(value) * 100))


def numeric_audit(payload: dict[str, Any], name: str) -> float | None:
    value = (
        payload.get("lighthouseResult", {})
        .get("audits", {})
        .get(name, {})
        .get("numericValue")
    )
    return float(value) if value is not None else None


def get_network_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = (
        payload.get("lighthouseResult", {})
        .get("audits", {})
        .get("network-requests", {})
        .get("details", {})
        .get("items", [])
    )
    return items if isinstance(items, list) else []


def field_data_status(payload: dict[str, Any]) -> str:
    loading = payload.get("loadingExperience") or {}
    origin = payload.get("originLoadingExperience") or {}
    if loading.get("metrics") or origin.get("metrics"):
        categories = [
            str(loading.get("overall_category") or "").strip(),
            str(origin.get("overall_category") or "").strip(),
        ]
        return ", ".join(part for part in categories if part) or "available"
    return "No CrUX field data in PSI response"


def summarize_psi_payload(label: str, url: str, artifact: Path, payload: dict[str, Any], status_code: int) -> PsiRun:
    if status_code >= 400 or "lighthouseResult" not in payload:
        return PsiRun(
            label=label,
            url=url,
            artifact=str(artifact),
            ok=False,
            status_code=status_code,
            error=(payload.get("error", {}).get("message") if isinstance(payload.get("error"), dict) else None)
            or payload.get("text")
            or "PSI response did not contain lighthouseResult",
        )
    lh = payload.get("lighthouseResult", {})
    audits = lh.get("audits", {})
    categories = lh.get("categories", {})
    net = get_network_items(payload)
    heap_reqs = [
        item
        for item in net
        if any(token in str(item.get("url", "")) for token in ("heap-api", "contentsquare"))
    ]
    total_bytes = audits.get("total-byte-weight", {}).get("numericValue")
    return PsiRun(
        label=label,
        url=url,
        artifact=str(artifact),
        ok=True,
        status_code=status_code,
        score=score_to_int(categories.get("performance", {}).get("score")),
        fcp_ms=round(numeric_audit(payload, "first-contentful-paint") or 0),
        lcp_ms=round(numeric_audit(payload, "largest-contentful-paint") or 0),
        tbt_ms=round(numeric_audit(payload, "total-blocking-time") or 0, 1),
        cls=numeric_audit(payload, "cumulative-layout-shift"),
        speed_index_ms=round(numeric_audit(payload, "speed-index") or 0),
        total_byte_weight=round(total_bytes) if total_bytes is not None else None,
        network_requests=len(net),
        heap_contentsquare_requests=len(heap_reqs),
        field_data_status=field_data_status(payload),
        final_url=lh.get("finalDisplayedUrl") or lh.get("finalUrl") or payload.get("id"),
    )


def run_psi(api_key: str, label: str, url: str, run_dir: Path) -> PsiRun:
    artifact = run_dir / f"psi-{label}.json"
    params = {
        "url": url,
        "key": api_key,
        "strategy": "mobile",
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }
    try:
        response = requests.get(PSI_ENDPOINT, params=params, timeout=140)
        try:
            payload = response.json()
        except ValueError:
            payload = {"status_code": response.status_code, "text": response.text[:1000]}
        artifact.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return summarize_psi_payload(label, url, artifact, payload, response.status_code)
    except Exception as exc:
        artifact.write_text(json.dumps({"error": str(exc)}, indent=2) + "\n", encoding="utf-8")
        return PsiRun(label=label, url=url, artifact=str(artifact), ok=False, status_code=0, error=str(exc))


def values(runs: Iterable[PsiRun], attr: str) -> list[float]:
    vals: list[float] = []
    for run in runs:
        value = getattr(run, attr)
        if value is not None:
            vals.append(float(value))
    return vals


def series_stats(runs: list[PsiRun], attr: str) -> dict[str, Any]:
    vals = values(runs, attr)
    if not vals:
        return {"values": [], "min": None, "max": None, "median": None, "spread": None}
    return {
        "values": vals,
        "min": min(vals),
        "max": max(vals),
        "median": statistics.median(vals),
        "spread": max(vals) - min(vals),
    }


def fetch_mobile_html(run_dir: Path) -> dict[str, Any]:
    html_path = run_dir / "mobile-home.html"
    headers_path = run_dir / "mobile-home.headers.json"
    try:
        response = requests.get(PILOT_URL, headers={"User-Agent": MOBILE_UA}, timeout=45)
    except Exception as exc:
        error = str(exc)
        html_path.write_text("", encoding="utf-8")
        headers_path.write_text(
            json.dumps({"error": error}, indent=2) + "\n",
            encoding="utf-8",
        )
        return {
            "available": False,
            "error": error,
            "status_code": 0,
            "artifact": str(html_path),
            "headers_artifact": str(headers_path),
        }
    html_path.write_text(response.text, encoding="utf-8", errors="ignore")
    headers_path.write_text(json.dumps(dict(response.headers), indent=2) + "\n", encoding="utf-8")
    html = response.text
    checks = {
        "hero_750": html.count("Apex-West-Midtown-Home-Hero-750.webp"),
        "data_edge_hero_mobile": html.count("data-edge-hero-mobile"),
        "home_amenities_900": html.count("Home-Amenities-900.webp"),
        "home_features_900": html.count("Home-Features-900.webp"),
        "jquery_migrate": html.count("jquery-migrate"),
        "filters_js": html.count("filters.js"),
        "fetchpriority_high": html.count('fetchpriority="high"'),
        "slideshow_markup": html.count("uk-slideshow"),
        "html_bytes": len(html.encode("utf-8")),
        "status_code": response.status_code,
        "artifact": str(html_path),
        "headers_artifact": str(headers_path),
    }
    return checks


def fetch_zaraz_heap_mode(run_dir: Path) -> dict[str, Any]:
    out_path = run_dir / "zaraz-heap-mode.json"
    result: dict[str, Any] = {
        "available": False,
        "tool_found": False,
        "mode": None,
        "error": None,
        "artifact": str(out_path),
    }
    try:
        token = resolve_secret(
            description="Cloudflare Zaraz Editor token",
            default_notation="keeper://hZFfWzx_qwOn19J-zICiPg/field/password",
            direct_env_var=None,
            default_profile="marketingops",
        ).strip()
        response = requests.get(
            "https://api.cloudflare.com/client/v4/zones/bbee6e80b4adec59dd5d2e8ebaa00c78/settings/zaraz/config",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=30,
        )
        if not response.ok:
            result["error"] = f"Cloudflare API status {response.status_code}"
            return result
        payload = response.json()
        config = payload.get("result", payload)
        tool = (config.get("tools") or {}).get("HpPl")
        result["available"] = True
        result["tool_found"] = bool(tool)
        if tool:
            html = (
                tool.get("actions", {})
                .get("LoadHeapPilot", {})
                .get("data", {})
                .get("htmlCode", "")
            )
            if "interaction-or-load-plus-6000-or-8000-queue-only" in html:
                mode = "v3: interaction, load+6000, hard 8000, queue-only"
            elif "interaction-or-load-plus-6000-or-8000" in html:
                mode = "v2: interaction, load+6000, hard 8000"
            elif "interaction-or-load-plus-2500-or-4000" in html:
                mode = "v1: interaction, load+2500, hard 4000"
            elif "heap.load('286627304')" in html or 'heap.load("286627304")' in html:
                mode = "immediate"
            else:
                mode = "unknown custom HTML"
            result["mode"] = mode
            result["enabled"] = bool(tool.get("enabled"))
        out_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        return result
    except Exception as exc:
        result["error"] = str(exc)
        out_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        return result


def latest_gtmetrix_artifact() -> dict[str, Any] | None:
    candidates = sorted(
        (ROOT / "reports" / "resi_edge_performance").glob("20*/**/gtmetrix/homepage-gtmetrix*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for path in candidates:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        return {
            "artifact": str(path),
            "score": payload.get("pagespeed_score"),
            "structure": payload.get("structure_score"),
            "fully_loaded_ms": payload.get("fully_loaded_time_ms"),
            "onload_ms": payload.get("onload_time_ms"),
            "fcp_ms": payload.get("first_contentful_paint_ms"),
            "tti_ms": payload.get("time_to_interactive_ms"),
            "bytes": payload.get("page_bytes"),
            "requests": payload.get("page_requests"),
            "report_url": payload.get("report_url"),
            "scenario": payload.get("scenario"),
            "collected_at_utc": payload.get("collected_at_utc"),
        }
    return None


def previous_summary(current_date: str) -> dict[str, Any] | None:
    candidates = sorted(REPORT_ROOT.glob("*/summary.json"), reverse=True)
    for path in candidates:
        if path.parent.name >= current_date:
            continue
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
    return None


def classify_consistency(exact: dict[str, Any], fresh: dict[str, Any]) -> str:
    exact_median = exact["score"].get("median")
    fresh_median = fresh["score"].get("median")
    exact_spread = exact["score"].get("spread")
    fresh_spread = fresh["score"].get("spread")
    if fresh_median is not None and fresh_median >= 90 and exact_median is not None and exact_median < 85:
        return "Fast path is healthy, but clean exact URL remains lab-unstable"
    if fresh_median is not None and exact_median is not None and min(fresh_median, exact_median) >= 90:
        if max(exact_spread or 0, fresh_spread or 0) <= 5:
            return "Stable 90+ lab posture"
        return "90+ median with moderate run-to-run variance"
    return "Needs attention"


def build_summary(run_date: str, exact_runs: list[PsiRun], fresh_runs: list[PsiRun], html: dict[str, Any], heap: dict[str, Any]) -> dict[str, Any]:
    exact = {
        "score": series_stats(exact_runs, "score"),
        "lcp_ms": series_stats(exact_runs, "lcp_ms"),
        "fcp_ms": series_stats(exact_runs, "fcp_ms"),
        "tbt_ms": series_stats(exact_runs, "tbt_ms"),
        "bytes": series_stats(exact_runs, "total_byte_weight"),
        "requests": series_stats(exact_runs, "network_requests"),
        "heap_contentsquare_requests": series_stats(exact_runs, "heap_contentsquare_requests"),
    }
    fresh = {
        "score": series_stats(fresh_runs, "score"),
        "lcp_ms": series_stats(fresh_runs, "lcp_ms"),
        "fcp_ms": series_stats(fresh_runs, "fcp_ms"),
        "tbt_ms": series_stats(fresh_runs, "tbt_ms"),
        "bytes": series_stats(fresh_runs, "total_byte_weight"),
        "requests": series_stats(fresh_runs, "network_requests"),
        "heap_contentsquare_requests": series_stats(fresh_runs, "heap_contentsquare_requests"),
    }
    crux_statuses = sorted({run.field_data_status for run in [*exact_runs, *fresh_runs] if run.field_data_status})
    summary = {
        "run_date": run_date,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "url": PILOT_URL,
        "verdict": classify_consistency(exact, fresh),
        "exact": exact,
        "fresh": fresh,
        "crux_field_data": crux_statuses or ["Not available"],
        "html_state": html,
        "heap_state": heap,
        "gtmetrix_latest": latest_gtmetrix_artifact(),
        "exact_runs": [run.__dict__ for run in exact_runs],
        "fresh_runs": [run.__dict__ for run in fresh_runs],
    }
    prev = previous_summary(run_date)
    if prev:
        summary["previous_comparison"] = {
            "previous_date": prev.get("run_date"),
            "exact_score_median_delta": delta(
                summary["exact"]["score"].get("median"),
                prev.get("exact", {}).get("score", {}).get("median"),
            ),
            "fresh_score_median_delta": delta(
                summary["fresh"]["score"].get("median"),
                prev.get("fresh", {}).get("score", {}).get("median"),
            ),
            "heap_mode_changed": summary.get("heap_state", {}).get("mode")
            != prev.get("heap_state", {}).get("mode"),
        }
    return summary


def delta(current: Any, previous: Any) -> float | None:
    if current is None or previous is None:
        return None
    return round(float(current) - float(previous), 2)


def fmt(value: Any, digits: int = 0, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    if isinstance(value, float):
        return f"{value:.{digits}f}{suffix}"
    return f"{value}{suffix}"


def fmt_ms(value: Any) -> str:
    if value is None:
        return "N/A"
    return f"{float(value) / 1000:.2f}s"


def status_color(verdict: str) -> str:
    if verdict.startswith("Stable"):
        return MONTE_CARLO
    if "healthy" in verdict:
        return SAN_MARINO
    return TERRA_COTTA


def build_recommendations(summary: dict[str, Any]) -> list[str]:
    recs: list[str] = []
    exact_score = summary["exact"]["score"].get("median")
    fresh_score = summary["fresh"]["score"].get("median")
    exact_heap = summary["exact"]["heap_contentsquare_requests"].get("max") or 0
    fresh_heap = summary["fresh"]["heap_contentsquare_requests"].get("max") or 0
    if exact_heap or fresh_heap:
        recs.append("Heap/Contentsquare appeared inside PSI. Keep the v3 queue-only delay or push passive fallback later.")
    if fresh_score is not None and fresh_score >= 90 and exact_score is not None and exact_score < 85:
        recs.append("Treat the exact clean-URL low score as first-party paint instability; ask YOOtheme to simplify the initial hero/render path.")
        recs.append("Continue reporting medians and ranges, not one-off public PSI screenshots.")
    if summary["html_state"].get("hero_750", 0) < 1:
        recs.append("Mobile hero rewrite is missing; restore the 750 hero or move the equivalent fix into YOOtheme.")
    if summary["html_state"].get("jquery_migrate", 0) > 0 or summary["html_state"].get("filters_js", 0) > 0:
        recs.append("Homepage asset-trim regression detected; jQuery Migrate or filters.js returned.")
    if not recs:
        recs.append("Keep current state; monitor Heap continuity and exact/fresh PSI consistency.")
    return recs


def load_history(summary: dict[str, Any], limit: int = 14) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    current_date = summary.get("run_date")
    for path in sorted(REPORT_ROOT.glob("*/summary.json")):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if item.get("run_date") == current_date:
            continue
        rows.append(item)
    rows.append(summary)
    return rows[-limit:]


def change_section(summary: dict[str, Any]) -> str:
    comparison = summary.get("previous_comparison")
    if not comparison:
        return "<p style='line-height:1.55;'>No prior Pilot Master stability summary was available for comparison yet.</p>"
    heap_note = "changed" if comparison.get("heap_mode_changed") else "unchanged"
    return f"""
      <ul style="line-height:1.55;">
        <li>Previous report date: {comparison.get('previous_date')}</li>
        <li>Clean PSI median delta: {fmt(comparison.get('exact_score_median_delta'), 1)} points</li>
        <li>Fresh PSI median delta: {fmt(comparison.get('fresh_score_median_delta'), 1)} points</li>
        <li>Heap/Zaraz mode: {heap_note}</li>
      </ul>
    """


def history_table(summary: dict[str, Any]) -> str:
    rows = []
    for item in load_history(summary):
        exact_score = item.get("exact", {}).get("score", {}).get("median")
        fresh_score = item.get("fresh", {}).get("score", {}).get("median")
        exact_lcp = item.get("exact", {}).get("lcp_ms", {}).get("median")
        fresh_lcp = item.get("fresh", {}).get("lcp_ms", {}).get("median")
        exact_width = max(0, min(100, int(exact_score or 0)))
        fresh_width = max(0, min(100, int(fresh_score or 0)))
        rows.append(
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};font-weight:700;'>{item.get('run_date')}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{bar(exact_width, SAN_MARINO)} {fmt(exact_score)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{bar(fresh_width, MONTE_CARLO)} {fmt(fresh_score)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt_ms(exact_lcp)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt_ms(fresh_lcp)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{item.get('verdict') or 'N/A'}</td>"
            f"</tr>"
        )
    return (
        f"<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px;'>"
        f"<tr style='background:{WHITE_SMOKE};'><th align='left' style='padding:8px;'>Date</th><th align='left' style='padding:8px;'>Clean</th><th align='left' style='padding:8px;'>Fresh</th><th align='left' style='padding:8px;'>Clean LCP</th><th align='left' style='padding:8px;'>Fresh LCP</th><th align='left' style='padding:8px;'>Verdict</th></tr>"
        + "".join(rows)
        + "</table>"
    )


def bar(width: int, color: str) -> str:
    return (
        f"<span style='display:inline-block;width:72px;height:8px;background:{QUILL_GRAY};vertical-align:middle;margin-right:6px;'>"
        f"<span style='display:block;width:{width}%;height:8px;background:{color};'></span>"
        f"</span>"
    )


def build_html(summary: dict[str, Any]) -> str:
    exact = summary["exact"]
    fresh = summary["fresh"]
    heap = summary["heap_state"]
    html = summary["html_state"]
    gt = summary.get("gtmetrix_latest") or {}
    recommendations = build_recommendations(summary)
    generated = datetime.fromisoformat(summary["generated_at_utc"].replace("Z", "+00:00")).strftime("%b %d, %Y %H:%M UTC")
    verdict = summary["verdict"]
    badge = status_color(verdict)

    return f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:{WHITE_SMOKE};font-family:Arial,sans-serif;color:{BLACK};">
  <div style="max-width:980px;margin:0 auto;padding:24px;">
    <div style="background:#FFFFFF;border:1px solid {QUILL_GRAY};border-radius:6px;padding:22px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:{DELTA};font-weight:700;">Pilot Master Speed Stability</div>
      <h1 style="margin:8px 0 8px 0;color:{VENTERRA_NAVY};font-size:26px;">Daily Stability Brief</h1>
      <div style="font-size:13px;color:{DELTA};">Generated {generated} for {summary['url']}</div>
      <div style="margin-top:16px;background:{badge};color:#fff;border-radius:4px;padding:10px 12px;font-weight:700;">{verdict}</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;">
        <tr>
          {kpi_card("Clean PSI Median", fmt(exact['score'].get('median')), f"range {fmt(exact['score'].get('min'))}-{fmt(exact['score'].get('max'))}")}
          {kpi_card("Fresh PSI Median", fmt(fresh['score'].get('median')), f"range {fmt(fresh['score'].get('min'))}-{fmt(fresh['score'].get('max'))}")}
          {kpi_card("Clean LCP Median", fmt_ms(exact['lcp_ms'].get('median')), f"spread {fmt_ms(exact['lcp_ms'].get('spread'))}")}
          {kpi_card("Fresh LCP Median", fmt_ms(fresh['lcp_ms'].get('median')), f"spread {fmt_ms(fresh['lcp_ms'].get('spread'))}")}
        </tr>
      </table>

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">Consistency</h2>
      {metric_table(summary)}

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">What Changed</h2>
      {change_section(summary)}

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">Rolling History</h2>
      {history_table(summary)}

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">User / Field Data</h2>
      <ul style="line-height:1.55;">
        <li>PSI CrUX field data: {', '.join(summary.get('crux_field_data') or ['Not available'])}</li>
        <li>Heap/Zaraz mode: {heap.get('mode') or 'Unavailable'}; tool found: {heap.get('tool_found')}</li>
        <li>Heap/Contentsquare requests inside PSI: clean max {fmt(exact['heap_contentsquare_requests'].get('max'))}, fresh max {fmt(fresh['heap_contentsquare_requests'].get('max'))}</li>
      </ul>

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">Live State Checks</h2>
      <ul style="line-height:1.55;">
        <li>Hero 750 references: {html.get('hero_750')} | fetchpriority high: {html.get('fetchpriority_high')}</li>
        <li>Content 900 images: Amenities {html.get('home_amenities_900')}, Features {html.get('home_features_900')}</li>
        <li>Homepage trims: jquery-migrate count {html.get('jquery_migrate')}, filters.js count {html.get('filters_js')}</li>
        <li>HTML bytes: {fmt(html.get('html_bytes'))}; slideshow markup count: {fmt(html.get('slideshow_markup'))}</li>
      </ul>

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">Latest GTMetrix Evidence</h2>
      <p style="line-height:1.55;">
        Score {fmt(gt.get('score'))}, Structure {fmt(gt.get('structure'))}, Fully Loaded {fmt_ms(gt.get('fully_loaded_ms'))},
        Onload {fmt_ms(gt.get('onload_ms'))}, Requests {fmt(gt.get('requests'))}.
        {gt_link(gt)}
      </p>

      <h2 style="color:{VENTERRA_NAVY};font-size:18px;margin-top:24px;">Recommended Next Moves</h2>
      <ol style="line-height:1.55;">
        {''.join(f'<li>{item}</li>' for item in recommendations)}
      </ol>

      <p style="font-size:12px;color:{DELTA};margin-top:22px;">
        Raw PSI payloads and the summary JSON are saved in the attached report packet.
      </p>
    </div>
  </div>
</body>
</html>"""


def kpi_card(label: str, value: str, note: str) -> str:
    return f"""
    <td style="width:25%;padding:6px;vertical-align:top;">
      <div style="border:1px solid {QUILL_GRAY};border-radius:6px;background:{WHITE_SMOKE};padding:13px;">
        <div style="font-size:11px;color:{DELTA};font-weight:700;text-transform:uppercase;">{label}</div>
        <div style="font-size:25px;color:{VENTERRA_NAVY};font-weight:700;margin-top:6px;">{value}</div>
        <div style="font-size:12px;color:{DELTA};margin-top:4px;">{note}</div>
      </div>
    </td>
    """


def metric_table(summary: dict[str, Any]) -> str:
    rows = [
        ("Score", "score", ""),
        ("FCP", "fcp_ms", "ms"),
        ("LCP", "lcp_ms", "ms"),
        ("TBT", "tbt_ms", "ms"),
        ("Bytes", "bytes", ""),
        ("Requests", "requests", ""),
    ]
    body = []
    for label, key, unit in rows:
        exact = summary["exact"][key]
        fresh = summary["fresh"][key]
        body.append(
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};font-weight:700;'>{label}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt(exact.get('median'), 1 if key == 'tbt_ms' else 0, unit)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt(exact.get('min'), 1 if key == 'tbt_ms' else 0, unit)}-{fmt(exact.get('max'), 1 if key == 'tbt_ms' else 0, unit)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt(fresh.get('median'), 1 if key == 'tbt_ms' else 0, unit)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid {QUILL_GRAY};'>{fmt(fresh.get('min'), 1 if key == 'tbt_ms' else 0, unit)}-{fmt(fresh.get('max'), 1 if key == 'tbt_ms' else 0, unit)}</td>"
            f"</tr>"
        )
    return (
        f"<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px;'>"
        f"<tr style='background:{WHITE_SMOKE};'><th align='left' style='padding:8px;'>Metric</th><th align='left' style='padding:8px;'>Clean Median</th><th align='left' style='padding:8px;'>Clean Range</th><th align='left' style='padding:8px;'>Fresh Median</th><th align='left' style='padding:8px;'>Fresh Range</th></tr>"
        + "".join(body)
        + "</table>"
    )


def gt_link(gt: dict[str, Any]) -> str:
    url = gt.get("report_url")
    if not url:
        return ""
    return f"<a href='{url}' style='color:{SAN_MARINO};'>GTMetrix report</a>"


def build_plain(summary: dict[str, Any]) -> str:
    recs = "\n".join(f"- {item}" for item in build_recommendations(summary))
    return f"""Pilot Master Speed Stability - {summary['run_date']}

Verdict: {summary['verdict']}

Clean PSI median: {fmt(summary['exact']['score'].get('median'))}
Fresh PSI median: {fmt(summary['fresh']['score'].get('median'))}
Clean LCP median: {fmt_ms(summary['exact']['lcp_ms'].get('median'))}
Fresh LCP median: {fmt_ms(summary['fresh']['lcp_ms'].get('median'))}
Heap/Zaraz mode: {summary['heap_state'].get('mode') or 'Unavailable'}
PSI CrUX field data: {', '.join(summary.get('crux_field_data') or ['Not available'])}

Recommended next moves:
{recs}
"""


def write_outputs(run_dir: Path, summary: dict[str, Any]) -> tuple[Path, Path]:
    summary_path = run_dir / "summary.json"
    html_path = run_dir / "pilot-master-stability-report.html"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    html_path.write_text(build_html(summary), encoding="utf-8")
    return summary_path, html_path


def run_report(
    *,
    run_date: str,
    exact_runs: int,
    fresh_runs: int,
    send: bool,
    dry_run: bool,
    recipients: list[str] | None,
) -> dict[str, Any]:
    run_dir = REPORT_ROOT / run_date
    run_dir.mkdir(parents=True, exist_ok=True)
    api_key = load_psi_api_key()
    exact: list[PsiRun] = []
    fresh: list[PsiRun] = []
    for idx in range(1, exact_runs + 1):
        exact.append(run_psi(api_key, f"clean-{idx}", PILOT_URL, run_dir))
    for idx in range(1, fresh_runs + 1):
        cache_url = f"{PILOT_URL}?pilot_master_stability={int(time.time())}-{idx}"
        fresh.append(run_psi(api_key, f"fresh-{idx}", cache_url, run_dir))
    html_state = fetch_mobile_html(run_dir)
    heap_state = fetch_zaraz_heap_mode(run_dir)
    summary = build_summary(run_date, exact, fresh, html_state, heap_state)
    summary_path, html_path = write_outputs(run_dir, summary)
    summary["summary_artifact"] = str(summary_path)
    summary["html_artifact"] = str(html_path)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    if send and not dry_run:
        config = load_config()
        to = recipients or config.get("report_recipients") or ["mlaufhutte@venterraliving.com"]
        DELIVERY_LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_path = DELIVERY_LOG_DIR / f"pilot_master_stability_{run_date}.jsonl"
        sender = EmailSender(verbose=False)
        sender.send_email_with_tracking(
            subject=f"Pilot Master Speed Stability Brief - {run_date}",
            html_body=build_html(summary),
            plain_text=build_plain(summary),
            recipients=to,
            attachments=[
                (summary_path.name, summary_path.read_bytes(), "application/json"),
                (html_path.name, html_path.read_bytes(), "text/html"),
            ],
            log_path=log_path,
        )
    else:
        print("Email not sent (dry run or --send omitted).")

    print(f"Saved summary: {summary_path}")
    print(f"Saved HTML: {html_path}")
    print(f"Verdict: {summary['verdict']}")
    return summary


def parse_recipients(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Pilot Master speed stability brief")
    parser.add_argument("--date", default=date.today().isoformat(), help="Report date label YYYY-MM-DD")
    parser.add_argument("--exact-runs", type=int, default=3, help="Clean exact URL PSI runs")
    parser.add_argument("--fresh-runs", type=int, default=3, help="Fresh query PSI runs")
    parser.add_argument("--send", action="store_true", help="Send email after generating report")
    parser.add_argument("--dry-run", action="store_true", help="Generate artifacts but do not send")
    parser.add_argument("--recipients", help="Comma-separated recipients; defaults to pilot config recipients")
    args = parser.parse_args()
    run_report(
        run_date=args.date,
        exact_runs=max(1, args.exact_runs),
        fresh_runs=max(1, args.fresh_runs),
        send=args.send,
        dry_run=args.dry_run,
        recipients=parse_recipients(args.recipients),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
