#!/usr/bin/env python3
"""Run the non-mutating Resi Edge launch PSI baseline queue."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.run_resi_edge_prototype_psi import load_psi_api_key, run_psi  # noqa: E402


LOCAL_TZ = ZoneInfo("America/Chicago")
QUEUE_ROOT = ROOT / "reports/resi_edge_performance/performance-baseline-queue"
OUT_ROOT = ROOT / "reports/resi_edge_performance/performance-baselines"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def repo_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def default_queue_path() -> Path:
    latest_pointer = read_json(QUEUE_ROOT / "latest.json")["latest"]
    return ROOT / latest_pointer / "performance-baseline-queue.json"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def result_row(item: dict[str, Any], result: Any, index: int, total: int) -> dict[str, Any]:
    row = {
        "index": index,
        "total": total,
        "property_code": item["property_code"],
        "property_name": item["property_name"],
        "vanity_domain": item["vanity_domain"],
        "target_label": item["target_label"],
        "url": item["url"],
        "strategy": item["strategy"],
        "ok": result.ok,
        "status_code": result.status_code,
        "score": result.score,
        "largest_contentful_paint_ms": result.lcp_ms,
        "cumulative_layout_shift": result.cls,
        "interaction_to_next_paint_ms": None,
        "total_blocking_time_ms": result.tbt_ms,
        "first_contentful_paint_ms": result.fcp_ms,
        "speed_index_ms": result.speed_index_ms,
        "total_byte_weight": result.total_byte_weight,
        "network_requests": result.network_requests,
        "final_url": result.final_url,
        "artifact": repo_path(Path(result.artifact)),
        "error": result.error,
    }
    return row


def summarize(rows: list[dict[str, Any]], stopped_early: bool) -> dict[str, Any]:
    ok_rows = [row for row in rows if row["ok"]]
    failed_rows = [row for row in rows if not row["ok"]]
    by_target: dict[str, dict[str, Any]] = {}
    for key in sorted({f"{row['target_label']} / {row['strategy']}" for row in rows}):
        group = [row for row in rows if f"{row['target_label']} / {row['strategy']}" == key]
        ok_group = [row for row in group if row["ok"]]
        scores = [int(row["score"]) for row in ok_group if row["score"] is not None]
        by_target[key] = {
            "runs": len(group),
            "ok": len(ok_group),
            "failed": len(group) - len(ok_group),
            "min_score": min(scores) if scores else None,
            "max_score": max(scores) if scores else None,
            "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        }
    return {
        "measurements_attempted": len(rows),
        "measurements_ok": len(ok_rows),
        "measurements_failed": len(failed_rows),
        "properties_completed": len({row["property_code"] for row in ok_rows}),
        "stopped_early": stopped_early,
        "by_target": by_target,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = [
        "index",
        "total",
        "property_code",
        "property_name",
        "vanity_domain",
        "target_label",
        "url",
        "strategy",
        "ok",
        "status_code",
        "score",
        "largest_contentful_paint_ms",
        "cumulative_layout_shift",
        "total_blocking_time_ms",
        "first_contentful_paint_ms",
        "speed_index_ms",
        "total_byte_weight",
        "network_requests",
        "final_url",
        "artifact",
        "error",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_md(path: Path, payload: dict[str, Any]) -> None:
    summary = payload["summary"]
    lines = [
        "# Resi Edge Performance Baseline Results",
        "",
        f"Generated: {payload['generated_at_human']}",
        "Mutation posture: none.",
        "",
        "## Summary",
        "",
        f"- Measurements attempted: `{summary['measurements_attempted']}`",
        f"- Measurements passed: `{summary['measurements_ok']}`",
        f"- Measurements failed: `{summary['measurements_failed']}`",
        f"- Stopped early: `{summary['stopped_early']}`",
        f"- Interrupted: `{summary.get('interrupted', False)}`",
        "",
        "## Target Rollup",
        "",
        "| Target | Runs | OK | Failed | Avg Score | Min | Max |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for label, row in summary["by_target"].items():
        lines.append(
            f"| {label} | {row['runs']} | {row['ok']} | {row['failed']} | {row['average_score']} | {row['min_score']} | {row['max_score']} |"
        )
    lines.extend(["", "## Failed Measurements", ""])
    failures = [row for row in payload["rows"] if not row["ok"]]
    if not failures:
        lines.append("- None")
    else:
        for row in failures:
            lines.append(f"- {row['property_code']} {row['target_label']} {row['strategy']}: {row['error'] or row['status_code']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", type=Path, default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--sleep", type=float, default=1.0)
    parser.add_argument("--stop-on-fail", action=argparse.BooleanOptionalAction, default=True)
    return parser.parse_args()


def write_packet(out_dir: Path, queue_path: Path, rows: list[dict[str, Any]], stopped_early: bool, interrupted: bool, generated_at: datetime, generated_human: str) -> dict[str, Any]:
    summary = summarize(rows, stopped_early)
    summary["interrupted"] = interrupted
    payload = {
        "schema": "resi_edge_performance_baseline_results_v1",
        "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
        "generated_at_human": generated_human,
        "mutations_performed": False,
        "queue_source": repo_path(queue_path),
        "summary": summary,
        "rows": rows,
    }
    write_json(out_dir / "performance-baseline-results.json", payload)
    write_csv(out_dir / "performance-baseline-results.csv", rows)
    write_md(out_dir / "PERFORMANCE_BASELINE_RESULTS.md", payload)
    write_json(OUT_ROOT / "latest.json", {"latest": repo_path(out_dir)})
    return payload


def main() -> int:
    args = parse_args()
    queue_path = args.queue or default_queue_path()
    queue_payload = read_json(queue_path)
    queue = queue_payload["queue"]
    if args.limit:
        queue = queue[: args.limit]

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    generated_human = now.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    out_dir = OUT_ROOT / f"performance-baseline-{stamp}"
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    api_key = load_psi_api_key()
    rows: list[dict[str, Any]] = []
    stopped_early = False
    total = len(queue)
    interrupted = False
    try:
        for index, item in enumerate(queue, start=1):
            result = None
            attempts: list[dict[str, Any]] = []
            for attempt in range(1, max(args.retries, 0) + 2):
                label = f"{index:03d}-{slug(item['property_code'])}-{slug(item['target_label'])}-{item['strategy']}-try{attempt}"
                result = run_psi(api_key, label, item["strategy"], item["url"], raw_dir)
                attempts.append(
                    {
                        "attempt": attempt,
                        "ok": result.ok,
                        "status_code": result.status_code,
                        "score": result.score,
                        "artifact": repo_path(Path(result.artifact)),
                        "error": result.error,
                    }
                )
                if result.ok:
                    break
                if attempt <= args.retries:
                    time.sleep(max(args.sleep, 1.0))
            if result is None:
                raise RuntimeError("PSI run did not produce a result")
            row = result_row(item, result, index, total)
            row["attempts"] = attempts
            rows.append(row)
            print(json.dumps({key: row[key] for key in ["index", "total", "property_code", "target_label", "strategy", "ok", "score", "error"]}, sort_keys=True))
            if not result.ok and args.stop_on_fail:
                stopped_early = True
                break
            time.sleep(args.sleep)
    except KeyboardInterrupt:
        interrupted = True
        stopped_early = True

    payload = write_packet(out_dir, queue_path, rows, stopped_early, interrupted, now, generated_human)
    print(json.dumps({"out_dir": repo_path(out_dir), "summary": payload["summary"]}, indent=2, sort_keys=True))
    return 130 if interrupted else 1 if payload["summary"]["measurements_failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
