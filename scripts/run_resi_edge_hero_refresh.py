#!/usr/bin/env python3
"""Run the proven one-property Resi Edge hero media refresh lane."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "config" / "portfolio_resi_edge_stabilization"
DEFAULT_OUT_ROOT = ROOT / "reports" / "resi_edge_performance" / "hero-refresh-one-step"
DEFAULT_PLATFORM_BASE_URL = "https://pop-brief-api.mlaufhutte.workers.dev"


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slug(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "unknown"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_last_json_object(text: str) -> Any | None:
    decoder = json.JSONDecoder()
    parsed: Any | None = None
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, end = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if not text[index + end :].strip():
            return value
        parsed = value
    return parsed


def domain_matches(left: str, right: str) -> bool:
    return clean(left).lower().removeprefix("www.") == clean(right).lower().removeprefix("www.")


def manifest_matches(path: Path, property_code: str, domain: str) -> bool:
    manifest = load_json(path)
    target = manifest.get("target") or {}
    codes = {
        clean(target.get("property_code")).upper(),
        clean(target.get("source_property_code")).upper(),
    }
    return property_code.upper() in codes and domain_matches(clean(target.get("domain")), domain)


def resolve_manifest(args: argparse.Namespace) -> Path:
    if args.manifest:
        path = args.manifest if args.manifest.is_absolute() else ROOT / args.manifest
        if not path.exists():
            raise SystemExit(f"Manifest not found: {path}")
        if not manifest_matches(path, args.property_code, args.domain):
            raise SystemExit("Manifest does not match the requested property code/domain.")
        return path.resolve()

    matches: list[Path] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        if path.name.startswith("pilot-") or "-v2-canary" in path.name:
            continue
        try:
            if manifest_matches(path, args.property_code, args.domain):
                matches.append(path.resolve())
        except json.JSONDecodeError:
            continue
    if not matches:
        raise SystemExit(f"No active manifest matched {args.property_code} / {args.domain}.")
    if len(matches) > 1:
        joined = ", ".join(str(path.relative_to(ROOT)) for path in matches)
        raise SystemExit(f"Multiple active manifests matched {args.property_code} / {args.domain}: {joined}")
    return matches[0]


def run_command(label: str, command: list[str], out_dir: Path, check: bool = True, timeout: int = 600) -> dict[str, Any]:
    started = time.time()
    result = subprocess.run(command, cwd=str(ROOT), text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    record = {
        "label": label,
        "command": command,
        "returncode": result.returncode,
        "duration_seconds": round(time.time() - started, 3),
        "stdout": result.stdout[-8000:],
        "stderr": result.stderr[-8000:],
        "parsed_json": parse_last_json_object(result.stdout),
    }
    write_json(out_dir / "commands" / f"{label}.json", record)
    if check and result.returncode != 0:
        raise RuntimeError(f"{label} failed with exit {result.returncode}: {(result.stderr or result.stdout)[-1200:]}")
    return record


def packet_preview(packet_path: Path) -> dict[str, Any]:
    packet = load_json(packet_path)
    hero_assets = [
        {
            "role": asset.get("role"),
            "variant": asset.get("variant"),
            "public_url": asset.get("publicUrl"),
            "bytes": asset.get("bytes"),
            "sha256": asset.get("sha256"),
        }
        for asset in packet.get("assets") or []
        if asset.get("role") == "hero"
    ]
    hero_source = next((source for source in packet.get("sources") or [] if source.get("role") == "hero"), {})
    return {
        "packet": str(packet_path.relative_to(ROOT)),
        "property_code": packet.get("propertyCode"),
        "property_name": packet.get("propertyName"),
        "source_url": hero_source.get("sourceUrl"),
        "source_sha256": hero_source.get("sha256"),
        "hero_assets": hero_assets,
        "upload_plan_count": len(packet.get("uploadPlan") or []),
        "upload_plan": [
            {
                "bucket": item.get("bucket"),
                "r2_key": item.get("r2Key"),
                "public_url": item.get("publicUrl"),
            }
            for item in packet.get("uploadPlan") or []
        ],
    }


def summarize_acceptance(acceptance: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(acceptance, dict):
        return None
    readback = acceptance.get("readback") or {}
    return {
        "property_code": acceptance.get("property_code"),
        "domain": acceptance.get("domain"),
        "source_sha256": acceptance.get("source_sha256"),
        "upload_count": acceptance.get("upload_count"),
        "upload_failures": acceptance.get("upload_failures"),
        "readback_pass": readback.get("pass"),
        "records": acceptance.get("records"),
        "hero_assets": acceptance.get("hero_assets"),
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property-code", required=True, help="Exact Resi Edge property code, e.g. GA4AB.")
    parser.add_argument("--domain", required=True, help="Exact vanity domain, e.g. axialbuckhead.com.")
    parser.add_argument("--manifest", type=Path, help="Optional exact manifest path. Must match property code/domain.")
    parser.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    parser.add_argument("--quality", type=int, default=None, help="Optional quality override passed to asset generation.")
    parser.add_argument("--timeout", type=int, default=30, help="Native source fetch timeout for acceptance.")
    parser.add_argument("--apply", action="store_true", help="Upload R2 assets/config/media-state/freshness. Omit for dry-run.")
    parser.add_argument(
        "--skip-monitor-sync",
        action="store_true",
        help="In apply mode, skip the immediate production hero freshness monitor kick.",
    )
    parser.add_argument(
        "--monitor-base-url",
        default=os.environ.get("PLATFORM_BASE_URL", DEFAULT_PLATFORM_BASE_URL),
        help="Platform API base URL for the immediate monitor kick.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    property_code = clean(args.property_code).upper()
    domain = clean(args.domain).lower()
    if not property_code or not domain:
        raise SystemExit("Both --property-code and --domain are required.")

    run_dt = datetime.now(timezone.utc)
    run_id = run_dt.strftime("%Y%m%dT%H%M%SZ")
    out_dir = (args.out_root / slug(domain) / run_id).resolve()
    manifest_path = resolve_manifest(args)
    manifest = load_json(manifest_path)
    target = manifest.get("target") or {}
    hero = (manifest.get("mobile_shell") or {}).get("hero") or {}
    summary: dict[str, Any] = {
        "schema_version": "resi_edge_hero_refresh_one_step.v1",
        "status": "running",
        "mode": "apply" if args.apply else "dry-run",
        "run_id": run_id,
        "generated_at": run_dt.isoformat(),
        "property_code": property_code,
        "domain": domain,
        "property_name": clean(target.get("property_name")),
        "manifest_path": str(manifest_path.relative_to(ROOT)),
        "source_image": clean(hero.get("source_image")),
        "live_traffic_changed": False,
        "mutations_allowed": [
            "stable R2 asset objects",
            "single central topper config record",
            "single hero media-state record",
            "single hero freshness record",
        ]
        if args.apply
        else [],
        "mutations_excluded": [
            "property Worker",
            "route",
            "DNS",
            "WordPress/Kinsta",
            "dashboard production",
            "analytics admin",
            "source content",
            "locked PIB files",
            "other properties",
            "Cloudflare Queue/Images consumer",
        ],
        "steps": [],
    }
    write_json(out_dir / "hero-refresh-one-step-summary.json", summary)

    try:
        asset_out_dir = out_dir / "generated-assets"
        generate_cmd = [
            sys.executable,
            "scripts/generate_resi_edge_assets.py",
            "--manifest",
            str(manifest_path),
            "--out-dir",
            str(asset_out_dir),
        ]
        if args.quality is not None:
            generate_cmd.extend(["--quality", str(args.quality)])
        generate = run_command("generate_assets", generate_cmd, out_dir)
        packet_path = asset_out_dir / "generated-assets.json"
        summary["steps"].append({"name": "generate_assets", "pass": True, "duration_seconds": generate["duration_seconds"]})
        summary["generated_packet"] = str(packet_path.relative_to(ROOT))
        summary["packet_preview"] = packet_preview(packet_path)

        upload_preview_path = out_dir / "upload-plan-preview.json"
        write_json(upload_preview_path, summary["packet_preview"])
        summary["steps"].append({"name": "upload_plan_preview", "pass": True, "file": str(upload_preview_path.relative_to(ROOT))})

        config_out = out_dir / "config-records"
        config_cmd = [
            sys.executable,
            "scripts/build_resi_edge_topper_config_records.py",
            "--manifest",
            str(manifest_path),
            "--output-dir",
            str(config_out),
        ]
        if args.apply:
            config_cmd.append("--upload")

        if args.apply:
            upload = run_command(
                "upload_assets",
                [sys.executable, "scripts/upload_resi_edge_assets_to_r2.py", "--packet", str(packet_path), "--apply"],
                out_dir,
            )
            parsed_upload = upload.get("parsed_json") or {}
            if parsed_upload.get("failures"):
                raise RuntimeError("Asset upload completed with failures.")
            summary["steps"].append(
                {
                    "name": "upload_assets",
                    "pass": True,
                    "planned": parsed_upload.get("planned"),
                    "uploaded": parsed_upload.get("uploaded"),
                    "duration_seconds": upload["duration_seconds"],
                }
            )
        else:
            summary["steps"].append({"name": "upload_assets", "pass": True, "skipped": "dry-run"})

        config = run_command("build_config_record", config_cmd, out_dir)
        parsed_config = config.get("parsed_json") or {}
        if not parsed_config.get("pass"):
            raise RuntimeError("Central config record build did not pass.")
        summary["steps"].append(
            {
                "name": "build_config_record",
                "pass": True,
                "upload_count": parsed_config.get("upload_count"),
                "duration_seconds": config["duration_seconds"],
            }
        )

        accept_cmd = [
            sys.executable,
            "scripts/accept_resi_edge_generated_hero_assets.py",
            "--packet",
            str(packet_path),
            "--out-dir",
            str(out_dir / "accepted-records"),
            "--timeout",
            str(args.timeout),
        ]
        if args.apply:
            accept_cmd.extend(["--upload", "--readback"])
        acceptance = run_command("accept_generated_assets", accept_cmd, out_dir, timeout=300)
        parsed_acceptance = acceptance.get("parsed_json") or {}
        if args.apply:
            if parsed_acceptance.get("upload_failures"):
                raise RuntimeError("Acceptance record upload completed with failures.")
            if not ((parsed_acceptance.get("readback") or {}).get("pass")):
                raise RuntimeError("Acceptance readback did not pass.")
        summary["steps"].append(
            {
                "name": "accept_generated_assets",
                "pass": True,
                "upload_count": parsed_acceptance.get("upload_count"),
                "readback_pass": (parsed_acceptance.get("readback") or {}).get("pass"),
                "duration_seconds": acceptance["duration_seconds"],
            }
        )
        summary["acceptance"] = summarize_acceptance(parsed_acceptance)

        if args.apply and not args.skip_monitor_sync:
            monitor = run_command(
                "manual_monitor_sync",
                [
                    sys.executable,
                    "scripts/run_resi_edge_hero_freshness_sync_now.py",
                    "--base-url",
                    args.monitor_base_url,
                    "--output-root",
                    str(out_dir / "manual-monitor-sync"),
                ],
                out_dir,
                timeout=240,
            )
            parsed_monitor = monitor.get("parsed_json") or {}
            if not parsed_monitor.get("ok"):
                raise RuntimeError("Manual hero freshness monitor sync did not pass.")
            summary["steps"].append(
                {
                    "name": "manual_monitor_sync",
                    "pass": True,
                    "property_count": parsed_monitor.get("property_count"),
                    "current_count": parsed_monitor.get("current_count"),
                    "refresh_needed_count": parsed_monitor.get("refresh_needed_count"),
                    "duration_seconds": monitor["duration_seconds"],
                }
            )
            summary["manual_monitor_sync"] = parsed_monitor
        else:
            summary["steps"].append(
                {
                    "name": "manual_monitor_sync",
                    "pass": True,
                    "skipped": "dry-run" if not args.apply else "skip requested",
                }
            )

        summary["status"] = "passed"
        summary["completed_at"] = datetime.now(timezone.utc).isoformat()
        write_json(out_dir / "hero-refresh-one-step-summary.json", summary)
        print(json.dumps(summary, indent=2))
        return 0
    except Exception as exc:  # noqa: BLE001 - command-line closeout packet
        summary["status"] = "failed"
        summary["error"] = str(exc)
        summary["completed_at"] = datetime.now(timezone.utc).isoformat()
        write_json(out_dir / "hero-refresh-one-step-summary.json", summary)
        print(json.dumps(summary, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
