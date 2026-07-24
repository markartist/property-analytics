#!/usr/bin/env python3
"""Run repeat PSI tests for a Resi edge prototype URL."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import resolve_secret_from_multiple_notations


PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
PSI_KEY_PATH = ROOT / "Spotlight_Properties_Report" / "config" / "pagespeed_api_key.txt"


@dataclass
class PsiResult:
    label: str
    strategy: str
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
    final_url: str | None = None
    error: str | None = None


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


def numeric_audit(payload: dict[str, Any], name: str) -> float | None:
    value = (
        payload.get("lighthouseResult", {})
        .get("audits", {})
        .get(name, {})
        .get("numericValue")
    )
    return float(value) if value is not None else None


def score_to_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(round(float(value) * 100))


def network_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = (
        payload.get("lighthouseResult", {})
        .get("audits", {})
        .get("network-requests", {})
        .get("details", {})
        .get("items", [])
    )
    return items if isinstance(items, list) else []


def summarize(label: str, strategy: str, url: str, artifact: Path, payload: dict[str, Any], status_code: int) -> PsiResult:
    if status_code >= 400 or "lighthouseResult" not in payload:
        err = payload.get("error", {})
        return PsiResult(
            label=label,
            strategy=strategy,
            url=url,
            artifact=str(artifact),
            ok=False,
            status_code=status_code,
            error=err.get("message") if isinstance(err, dict) else payload.get("text", "PSI response missing lighthouseResult"),
        )
    lh = payload.get("lighthouseResult", {})
    audits = lh.get("audits", {})
    categories = lh.get("categories", {})
    total_bytes = audits.get("total-byte-weight", {}).get("numericValue")
    return PsiResult(
        label=label,
        strategy=strategy,
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
        network_requests=len(network_items(payload)),
        final_url=lh.get("finalDisplayedUrl") or lh.get("finalUrl") or payload.get("id"),
    )


def run_psi(api_key: str, label: str, strategy: str, url: str, out_dir: Path) -> PsiResult:
    artifact = out_dir / f"psi-{label}.json"
    params = {
        "url": url,
        "key": api_key,
        "strategy": strategy,
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }
    try:
        response = requests.get(PSI_ENDPOINT, params=params, timeout=150)
        try:
            payload = response.json()
        except ValueError:
            payload = {"status_code": response.status_code, "text": response.text[:1000]}
        artifact.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return summarize(label, strategy, url, artifact, payload, response.status_code)
    except Exception as exc:
        artifact.write_text(json.dumps({"error": str(exc)}, indent=2) + "\n", encoding="utf-8")
        return PsiResult(label=label, strategy=strategy, url=url, artifact=str(artifact), ok=False, status_code=0, error=str(exc))


def stats(values: list[float]) -> dict[str, float | list[float] | None]:
    if not values:
        return {"values": [], "min": None, "median": None, "max": None, "spread": None}
    return {
        "values": values,
        "min": min(values),
        "median": statistics.median(values),
        "max": max(values),
        "spread": max(values) - min(values),
    }


def grouped_summary(results: list[PsiResult]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for strategy in sorted({r.strategy for r in results}):
        group = [r for r in results if r.strategy == strategy]
        ok = [r for r in group if r.ok]
        summary[strategy] = {
            "okRuns": len(ok),
            "totalRuns": len(group),
            "score": stats([float(r.score) for r in ok if r.score is not None]),
            "fcpMs": stats([float(r.fcp_ms) for r in ok if r.fcp_ms is not None]),
            "lcpMs": stats([float(r.lcp_ms) for r in ok if r.lcp_ms is not None]),
            "tbtMs": stats([float(r.tbt_ms) for r in ok if r.tbt_ms is not None]),
            "cls": stats([float(r.cls) for r in ok if r.cls is not None]),
            "speedIndexMs": stats([float(r.speed_index_ms) for r in ok if r.speed_index_ms is not None]),
            "networkRequests": stats([float(r.network_requests) for r in ok if r.network_requests is not None]),
        }
    return summary


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--strategies", nargs="+", default=["mobile", "desktop"], choices=["mobile", "desktop"])
    parser.add_argument("--fresh-runs", type=int, default=3)
    parser.add_argument("--sleep", type=float, default=2.0)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    api_key = load_psi_api_key()
    results: list[PsiResult] = []
    stamp = int(time.time())
    for strategy in args.strategies:
        for i in range(1, args.runs + 1):
            label = f"{strategy}-exact-{i}"
            result = run_psi(api_key, label, strategy, args.url, args.out_dir)
            print(json.dumps(asdict(result), indent=2))
            results.append(result)
            time.sleep(args.sleep)
        for i in range(1, args.fresh_runs + 1):
            separator = "&" if "?" in args.url else "?"
            fresh_url = f"{args.url}{separator}edge_psi_fresh={stamp}-{strategy}-{i}"
            label = f"{strategy}-fresh-{i}"
            result = run_psi(api_key, label, strategy, fresh_url, args.out_dir)
            print(json.dumps(asdict(result), indent=2))
            results.append(result)
            time.sleep(args.sleep)
    packet = {
        "schemaVersion": "2026-07-09.prototype-psi",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "url": args.url,
        "runs": [asdict(r) for r in results],
        "summary": grouped_summary(results),
    }
    (args.out_dir / "psi-summary.json").write_text(json.dumps(packet, indent=2) + "\n", encoding="utf-8")
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
