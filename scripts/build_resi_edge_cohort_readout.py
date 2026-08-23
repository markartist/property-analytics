#!/usr/bin/env python3
"""Build a concise Resi Edge cohort readout from governed evidence packets.

This script does not touch live domains. It reads existing apply evidence,
summarizes operator-facing proof, and can sync the rollout register to the
latest passing apply directory for selected properties.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_ROOT = REPO_ROOT / "reports/resi_edge_performance/08-09-2026"
REGISTER_PATH = REPO_ROOT / "config/portfolio_resi_edge_stabilization/resi-edge-pilot-rollout-register.json"
CONTRACT_PATH = REPO_ROOT / "ops/cloudflare/shared/resi-edge-package/contract.json"
READOUT_ROOT = REPO_ROOT / "reports/resi_edge_performance/cohort-readouts"
LOCAL_TZ = ZoneInfo("America/Chicago")
MOBILE_TARGET = 98


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def human_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")
    except ValueError:
        return value


def local_iso_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(LOCAL_TZ).strftime("%Y-%m-%d")
    except ValueError:
        return value[:10] if len(value) >= 10 else value


def run_started_at(apply_dir: Path) -> datetime | None:
    match = re.fullmatch(r"apply-(\d{8}T\d{6}Z)", apply_dir.name)
    if not match:
        return None
    return datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def duration_minutes(apply_dir: Path, generated_at: str | None) -> float | None:
    start = run_started_at(apply_dir)
    if not start or not generated_at:
        return None
    try:
        end = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return round((end - start).total_seconds() / 60, 1)


def gate_summary_text(summary: dict[str, Any] | None) -> str:
    if not summary:
        return "missing"
    return (
        f"{summary.get('passed', 0)}/{summary.get('total', 0)} passed; "
        f"{summary.get('failed', 0)} failed; {summary.get('blocked', 0)} blocked; "
        f"{summary.get('not_run', 0)} not run"
    )


def current_required_gates() -> list[str]:
    contract = load_json(CONTRACT_PATH)
    return list(contract.get("required_gates") or [])


def latest_passing_apply_dir(property_id: str) -> Path | None:
    root = REPORT_ROOT / property_id
    if not root.exists():
        return None
    for candidate in sorted(root.glob("apply-*"), reverse=True):
        readout = candidate / "apply-readout.json"
        if not readout.exists():
            continue
        payload = load_json(readout)
        if payload.get("pass") is True:
            return candidate
    return None


def summarize_property(row: dict[str, Any], *, prefer_latest: bool) -> dict[str, Any]:
    property_id = row["id"]
    evidence_dir: Path | None = None
    if prefer_latest:
        evidence_dir = latest_passing_apply_dir(property_id)
    if evidence_dir is None and row.get("live_evidence"):
        evidence_dir = REPO_ROOT / row["live_evidence"]

    summary: dict[str, Any] = {
        "id": property_id,
        "property_code": row.get("property_code"),
        "property_name": row.get("property_name"),
        "domain": row.get("domain"),
        "register_status": row.get("status"),
        "register_evidence": row.get("live_evidence"),
        "evidence_dir": rel(evidence_dir) if evidence_dir else None,
        "ready": False,
        "issues": [],
    }
    if not evidence_dir or not evidence_dir.exists():
        summary["issues"].append("No evidence directory found.")
        return summary

    apply_path = evidence_dir / "apply-readout.json"
    packet_path = evidence_dir / "evidence-packet.json"
    psi_path = evidence_dir / "psi/psi/psi-gate.json"
    browser_path = evidence_dir / "browser-proof/browser-acceptance.json"
    zaraz_path = evidence_dir / "analytics-setup/zaraz-analytics-package-apply.json"

    apply_payload = load_json(apply_path) if apply_path.exists() else {}
    packet_payload = load_json(packet_path) if packet_path.exists() else {}
    psi_payload = load_json(psi_path) if psi_path.exists() else {}
    browser_payload = load_json(browser_path) if browser_path.exists() else {}
    zaraz_payload = load_json(zaraz_path) if zaraz_path.exists() else {}

    ledger = apply_payload.get("contract_gate_ledger") or {}
    required_gates = current_required_gates()
    proven_gate_names = {
        gate.get("name")
        for gate in ledger.get("gates") or []
        if gate.get("status") in {"pass", "not_applicable"} and gate.get("name")
    }
    missing_current_gates = [gate for gate in required_gates if gate not in proven_gate_names]
    gate_summary = ledger.get("summary") or packet_payload.get("gate_summary")
    mandatory_failures = ledger.get("mandatory_failures") or []
    packet_failures = packet_payload.get("mandatory_failures") or []
    mobile = browser_payload.get("mobile") or {}
    hero_full_height = mobile.get("heroFullHeight") or {}
    hero_stack = mobile.get("heroStack") or {}
    mobile_score = psi_payload.get("mobile_min_score")
    desktop_score = psi_payload.get("desktop_min_score")

    if apply_payload.get("pass") is not True:
        summary["issues"].append("Apply readout is not passing.")
    if mandatory_failures:
        summary["issues"].append(f"Mandatory gate failures: {', '.join(mandatory_failures)}.")
    if missing_current_gates:
        summary["issues"].append(f"Evidence packet is missing current required gates: {', '.join(missing_current_gates)}.")
    if packet_failures and not mandatory_failures:
        summary["issues"].append(f"Evidence packet has historical/self-index artifact: {', '.join(packet_failures)}.")
    if mobile_score is None or float(mobile_score) < MOBILE_TARGET:
        summary["issues"].append(f"Mobile PSI below target or missing: {mobile_score}.")
    if browser_payload.get("pass") is not True:
        summary["issues"].append("Browser acceptance did not pass.")
    if hero_full_height.get("ok") is not True:
        summary["issues"].append("Mobile hero full-height proof missing or failed.")
    if hero_stack.get("fadeAnimationsPresent") is not True:
        summary["issues"].append("Hero fade animation proof missing or failed.")

    summary.update(
        {
            "apply_pass": apply_payload.get("pass"),
            "generated_at": apply_payload.get("generated_at"),
            "generated_at_human": human_date(apply_payload.get("generated_at")),
            "duration_minutes": duration_minutes(evidence_dir, apply_payload.get("generated_at")),
            "gate_summary": gate_summary,
            "gate_summary_text": gate_summary_text(gate_summary),
            "current_contract_gate_count": len(required_gates),
            "current_contract_missing_gates": missing_current_gates,
            "mandatory_failures": mandatory_failures,
            "packet_file_count": packet_payload.get("file_count"),
            "packet_mandatory_failures": packet_failures,
            "mobile_psi": mobile_score,
            "desktop_psi_recorded": desktop_score,
            "psi_pass": psi_payload.get("pass"),
            "browser_pass": browser_payload.get("pass"),
            "hero_full_height": {
                "ok": hero_full_height.get("ok"),
                "topDelta": hero_full_height.get("topDelta"),
                "bottomDelta": hero_full_height.get("bottomDelta"),
                "viewportHeight": hero_full_height.get("viewportHeight"),
                "heroTop": (hero_full_height.get("heroRect") or {}).get("top"),
                "heroBottom": (hero_full_height.get("heroRect") or {}).get("bottom"),
            },
            "hero_stack": {
                "titleMode": hero_stack.get("titleMode"),
                "titleSrc": hero_stack.get("titleSrc"),
                "ratingPresent": hero_stack.get("ratingPresent"),
                "fadeAnimationsPresent": hero_stack.get("fadeAnimationsPresent"),
                "noOverlap": hero_stack.get("noOverlap"),
                "orderOk": hero_stack.get("orderOk"),
            },
            "zaraz_status": (zaraz_payload.get("result") or {}).get("status"),
            "zaraz_changes": (zaraz_payload.get("result") or {}).get("changes"),
            "evidence_paths": {
                "apply_readout": rel(apply_path),
                "evidence_packet": rel(packet_path),
                "browser_acceptance": rel(browser_path),
                "psi_gate": rel(psi_path),
                "zaraz_package": rel(zaraz_path),
            },
        }
    )
    blocking_issues = [
        issue
        for issue in summary["issues"]
        if not issue.startswith("Evidence packet has historical/self-index artifact")
    ]
    summary["ready"] = not blocking_issues
    summary["blocking_issues"] = blocking_issues
    return summary


def markdown_readout(payload: dict[str, Any]) -> str:
    rows = payload["properties"]
    lines = [
        "# Resi Edge Cohort Readout",
        "",
        f"Generated: {payload['generated_at_human']}",
        "",
        "## Current Proof",
        "",
        "| Property | Ready | Mobile PSI | Desktop Recorded | Gates | Hero | Analytics | Evidence |",
        "|---|---:|---:|---:|---|---|---|---|",
    ]
    for row in rows:
        ready = "Yes" if row["ready"] else "No"
        hero = row.get("hero_full_height") or {}
        hero_text = "full-height" if hero.get("ok") else "needs proof"
        analytics = row.get("zaraz_status") or "missing"
        lines.append(
            "| {name} | {ready} | {mobile} | {desktop} | {gates} | {hero} | {analytics} | {evidence} |".format(
                name=row["property_name"],
                ready=ready,
                mobile=row.get("mobile_psi"),
                desktop=row.get("desktop_psi_recorded"),
                gates=row.get("gate_summary_text"),
                hero=hero_text,
                analytics=analytics,
                evidence=row.get("evidence_dir"),
            )
        )
    lines.extend(["", "## Watch Items", ""])
    for row in rows:
        if not row["issues"]:
            lines.append(f"- {row['property_name']}: none.")
        else:
            lines.append(f"- {row['property_name']}: " + " ".join(row["issues"]))
    lines.extend(
        [
            "",
            "## Scale Notes",
            "",
            "- This readout is evidence-only and does not touch live Cloudflare routes, Workers, DNS, WordPress, Zaraz, or Ahrefs.",
            "- `Desktop Recorded` is native passthrough evidence; mobile remains the blocking performance target.",
            "- Packet self-index artifacts are tracked separately from the authoritative apply ledger so a healthy live proof is not mislabeled.",
        ]
    )
    return "\n".join(lines) + "\n"


def sync_register(register: dict[str, Any], summaries: list[dict[str, Any]]) -> None:
    by_id = {row["id"]: row for row in register.get("properties") or []}
    for summary in summaries:
        target = by_id.get(summary["id"])
        if not target or not summary.get("ready"):
            continue
        target["live_evidence"] = summary["evidence_dir"]
        target["last_live_proof_date"] = local_iso_date(summary.get("generated_at"))
        target["mobile_psi"] = summary.get("mobile_psi")
        target["desktop_psi"] = summary.get("desktop_psi_recorded")
        target.setdefault("evidence", {})
        target["evidence"].update(
            {
                "gate_summary": summary.get("gate_summary_text"),
                "evidence_file_count": summary.get("packet_file_count"),
                "psi_gate": summary["evidence_paths"]["psi_gate"],
                "latest_apply_readout": summary["evidence_paths"]["apply_readout"],
            }
        )
        target.setdefault("timing", {})
        target["timing"]["latest_live_apply_elapsed_minutes"] = summary.get("duration_minutes")
    register["updated"] = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Resi Edge cohort readout from latest passing evidence.")
    parser.add_argument("--property-id", action="append", help="Register property id to include. Defaults to live/protected pilot rows.")
    parser.add_argument("--prefer-latest", action="store_true", help="Prefer latest passing apply evidence over register evidence.")
    parser.add_argument("--update-register", action="store_true", help="Sync selected ready rows back to the rollout register.")
    parser.add_argument("--output-dir", default=str(READOUT_ROOT), help="Directory for JSON and Markdown readouts.")
    args = parser.parse_args()

    register = load_json(REGISTER_PATH)
    selected = set(args.property_id or [])
    rows = [
        row for row in register.get("properties", [])
        if (not selected and row.get("live_evidence")) or row.get("id") in selected
    ]
    summaries = [summarize_property(row, prefer_latest=args.prefer_latest) for row in rows]

    generated_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "schema": "resi_edge_cohort_readout_v1",
        "generated_at": generated_at,
        "generated_at_human": human_date(generated_at),
        "source_register": rel(REGISTER_PATH),
        "prefer_latest": bool(args.prefer_latest),
        "properties": summaries,
        "summary": {
            "total": len(summaries),
            "ready": sum(1 for row in summaries if row["ready"]),
            "needs_attention": sum(1 for row in summaries if not row["ready"]),
        },
    }

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = output_dir / f"resi-edge-cohort-readout-{stamp}.json"
    md_path = output_dir / f"resi-edge-cohort-readout-{stamp}.md"
    write_json(json_path, payload)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(markdown_readout(payload), encoding="utf-8")

    if args.update_register:
        sync_register(register, summaries)
        write_json(REGISTER_PATH, register)

    print(
        json.dumps(
            {
                "status": "passed",
                "json": rel(json_path),
                "markdown": rel(md_path),
                "register_updated": bool(args.update_register),
                "summary": payload["summary"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
