#!/usr/bin/env python3
"""Accept generated Resi Edge hero assets as the current media baseline."""

from __future__ import annotations

import argparse
import hashlib
import json
import ssl
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BUCKET_NAME = "resi-edge-assets"
FRESHNESS_SCHEMA_VERSION = "resi_edge_hero_freshness_record.v1"
MEDIA_STATE_SCHEMA_VERSION = "resi_edge_hero_media_state.v1"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402
from collect_resi_edge_hero_freshness import (  # noqa: E402
    clean,
    edge_assets,
    extract_hero_source,
    normalize_url,
    request_url,
    slug,
    source_metadata,
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def upload_json(key: str, path: Path) -> dict[str, Any]:
    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        return {"pass": False, "key": key, "reason": "Cloudflare API token was not resolved through Keeper-backed Wrangler auth."}
    command = [
        *npx_wrangler_prefix(env),
        "r2",
        "object",
        "put",
        f"{BUCKET_NAME}/{key}",
        "--file",
        str(path),
        "--content-type",
        "application/json",
        "--remote",
    ]
    result = subprocess.run(command, cwd=str(ROOT), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return {
        "pass": result.returncode == 0,
        "key": key,
        "file": str(path),
        "exit_code": result.returncode,
        "stdout": result.stdout[-1200:],
        "stderr": result.stderr[-1200:],
    }


def parse_json_body(text: str) -> dict[str, Any]:
    first = text.find("{")
    if first < 0:
        raise ValueError("Wrangler output did not include a JSON object body.")
    parsed, _ = json.JSONDecoder().raw_decode(text[first:])
    if not isinstance(parsed, dict):
        raise ValueError("Wrangler output JSON body was not an object.")
    return parsed


def read_r2_json(env: dict[str, str], key: str) -> dict[str, Any]:
    command = [
        *npx_wrangler_prefix(env),
        "r2",
        "object",
        "get",
        f"{BUCKET_NAME}/{key}",
        "--remote",
        "--pipe",
    ]
    result = subprocess.run(command, cwd=str(ROOT), env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        return {"pass": False, "key": key, "error": (result.stderr or result.stdout)[-1200:]}
    try:
        record = parse_json_body(result.stdout)
    except ValueError as exc:
        return {"pass": False, "key": key, "error": str(exc)}
    return {"pass": True, "key": key, "record": record}


def same_origin_asset_readback(domain: str, expected: dict[str, dict[str, Any]]) -> dict[str, Any]:
    rows: dict[str, Any] = {}
    context = ssl.create_default_context()
    for label, item in expected.items():
        public_url = clean(item.get("public_url"))
        url = f"https://{domain}{public_url if public_url.startswith('/') else '/' + public_url}"
        request = urllib.request.Request(
            url,
            headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "ResiEdgeHeroAcceptance/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=45, context=context) as response:
                body = response.read()
                actual_sha = hashlib.sha256(body).hexdigest()
                rows[label] = {
                    "pass": response.status == 200 and actual_sha == item.get("sha256") and len(body) == item.get("bytes"),
                    "url": url,
                    "http_status": response.status,
                    "content_type": response.headers.get("content-type"),
                    "bytes": len(body),
                    "sha256": actual_sha,
                    "expected_bytes": item.get("bytes"),
                    "expected_sha256": item.get("sha256"),
                }
        except Exception as exc:  # noqa: BLE001 - evidence only
            rows[label] = {"pass": False, "url": url, "error": str(exc)}
    return rows


def hero_asset(packet: dict[str, Any], variant: str) -> dict[str, Any]:
    for asset in packet.get("assets") or []:
        if asset.get("role") == "hero" and asset.get("variant") == variant:
            return asset
    raise SystemExit(f"Generated packet is missing hero {variant} asset.")


def build_records(packet_path: Path, out_dir: Path, timeout: int) -> dict[str, Any]:
    packet = load_json(packet_path)
    manifest_path = Path(packet.get("manifestPath") or "")
    if not manifest_path.is_absolute():
        manifest_path = ROOT / manifest_path
    manifest = load_json(manifest_path)
    target = manifest.get("target") or {}
    hero = (manifest.get("mobile_shell") or {}).get("hero") or {}
    code = clean(target.get("source_property_code") or target.get("property_code")).upper()
    domain = clean(target.get("domain"))
    property_name = clean(target.get("property_name"))
    manifest_source = clean(hero.get("source_image"))
    if not code or not domain or not manifest_source:
        raise SystemExit("Manifest is missing property code, domain, or hero source image.")

    run_dt = datetime.now(timezone.utc)
    generated_at = run_dt.isoformat()
    run_id = run_dt.strftime("%Y%m%dT%H%M%SZ")
    native_url = f"https://{domain}/?vtr_source_freshness_probe={run_id}"
    normalized_manifest_source = normalize_url(manifest_source, native_url)

    status, _, body = request_url(native_url, timeout)
    if status < 200 or status >= 400:
        raise SystemExit(f"Native homepage returned HTTP {status}.")
    detected_source, extraction_method = extract_hero_source(body.decode("utf-8", "ignore"), native_url)
    if not detected_source:
        raise SystemExit("Native homepage hero source was not detected.")
    if detected_source != normalized_manifest_source:
        raise SystemExit(f"Native hero source differs from manifest source: {detected_source}")

    metadata = source_metadata(detected_source, timeout)
    packet_source_sha = ""
    for source in packet.get("sources") or []:
        if source.get("role") == "hero":
            packet_source_sha = clean(source.get("sha256"))
            break
    if packet_source_sha and packet_source_sha != metadata.get("sha256"):
        raise SystemExit("Generated packet hero source hash differs from current source hash.")

    manifest_key = f"{slug(code)}-{slug(domain)}"
    freshness_key = f"resi-edge-hero-freshness/{manifest_key}/current.json"
    media_state_key = f"resi-edge-media-state/{manifest_key}/current.json"
    media_state = {
        "schema_version": MEDIA_STATE_SCHEMA_VERSION,
        "generated_at": generated_at,
        "property_code": code,
        "domain": domain,
        "status": "accepted",
        "source_image": detected_source,
        "source_sha256": metadata.get("sha256"),
        "source_metadata": metadata,
    }
    freshness = {
        "schema_version": FRESHNESS_SCHEMA_VERSION,
        "generated_at": generated_at,
        "property_code": code,
        "domain": domain,
        "property_name": property_name,
        "key": freshness_key,
        "native_url": native_url,
        "manifest_source_image": normalized_manifest_source,
        "detected_source_image": detected_source,
        "status": "current",
        "recommended_action": "none",
        "source_metadata": metadata,
        "edge_assets": edge_assets(manifest, code),
        "source": {
            "system": "native_homepage_html",
            "selector": "data-page-section=hero data-src",
            "extraction_method": extraction_method,
            "fetched_at": generated_at,
        },
        "baseline": {
            "system": "media_state",
            "key": media_state_key,
            "source_image": detected_source,
            "source_sha256": metadata.get("sha256"),
            "generated_at": generated_at,
        },
    }

    hero_avif = hero_asset(packet, "mobile-avif")
    hero_webp = hero_asset(packet, "mobile-webp")
    evidence = {
        "schema_version": "resi_edge_generated_hero_acceptance.v1",
        "generated_at": generated_at,
        "property_code": code,
        "domain": domain,
        "manifest_path": str(manifest_path.relative_to(ROOT)),
        "packet": str(packet_path.relative_to(ROOT)),
        "native_url": native_url,
        "source_sha256": metadata.get("sha256"),
        "records": {
            "freshness": freshness_key,
            "media_state": media_state_key,
        },
        "hero_assets": {
            "mobile_avif": {
                "public_url": hero_avif.get("publicUrl"),
                "bytes": hero_avif.get("bytes"),
                "sha256": hero_avif.get("sha256"),
            },
            "mobile_webp": {
                "public_url": hero_webp.get("publicUrl"),
                "bytes": hero_webp.get("bytes"),
                "sha256": hero_webp.get("sha256"),
            },
        },
    }

    write_json(out_dir / media_state_key, media_state)
    write_json(out_dir / freshness_key, freshness)
    write_json(out_dir / "acceptance-summary.json", evidence)
    return {
        "summary": evidence,
        "writes": [
            {"key": media_state_key, "file": str(out_dir / media_state_key)},
            {"key": freshness_key, "file": str(out_dir / freshness_key)},
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Accept generated Resi Edge hero assets as current.")
    parser.add_argument("--packet", required=True, type=Path, help="generated-assets.json from generate_resi_edge_assets.py")
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--readback", action="store_true", help="Read back uploaded R2 records and same-origin hero assets.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    packet_path = args.packet.resolve()
    out_dir = (args.out_dir or packet_path.parent / "accepted-records").resolve()
    result = build_records(packet_path, out_dir, args.timeout)
    uploads: list[dict[str, Any]] = []
    if args.upload:
        for item in result["writes"]:
            uploads.append(upload_json(item["key"], Path(item["file"])))
    readback: dict[str, Any] | None = None
    if args.readback:
        env = build_runtime_env()
        summary = result["summary"]
        freshness_key = summary["records"]["freshness"]
        media_state_key = summary["records"]["media_state"]
        r2_rows = {
            "media_state": read_r2_json(env, media_state_key),
            "freshness": read_r2_json(env, freshness_key),
        }
        r2_pass = (
            r2_rows["media_state"].get("pass")
            and (r2_rows["media_state"].get("record") or {}).get("status") == "accepted"
            and r2_rows["freshness"].get("pass")
            and (r2_rows["freshness"].get("record") or {}).get("status") == "current"
            and (r2_rows["freshness"].get("record") or {}).get("recommended_action") == "none"
        )
        asset_rows = same_origin_asset_readback(summary["domain"], summary["hero_assets"])
        asset_pass = all(row.get("pass") for row in asset_rows.values())
        readback = {
            "pass": bool(r2_pass and asset_pass),
            "r2": r2_rows,
            "same_origin_assets": asset_rows,
        }
        write_json(out_dir / "readback-summary.json", readback)
    output = {
        **result["summary"],
        "out_dir": str(out_dir),
        "upload_requested": args.upload,
        "upload_count": sum(1 for item in uploads if item.get("pass")),
        "upload_failures": [item for item in uploads if not item.get("pass")],
        "readback": readback,
    }
    print(json.dumps(output, indent=2))
    return 1 if output["upload_failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
