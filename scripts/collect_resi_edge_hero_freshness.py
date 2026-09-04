#!/usr/bin/env python3
"""Collect Resi Edge native hero-source freshness evidence.

This is read-only. It compares each active manifest's recorded hero source to
the current native homepage hero source and writes dashboard-ready evidence.
Asset regeneration remains a separate governed action.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "config/portfolio_resi_edge_stabilization"
DEFAULT_OUT_DIR = ROOT / "reports/resi_edge_performance/hero-freshness-sync"
SCHEMA_VERSION = "resi_edge_hero_freshness_record.v1"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 "
    "ResiEdgeHeroFreshness/1.0"
)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-") or "unknown"


def normalize_url(value: str, base_url: str) -> str:
    if not value:
        return ""
    parsed = urllib.parse.urljoin(base_url, value)
    parts = urllib.parse.urlsplit(parsed)
    if parts.path == "/__resi-edge/native-dam-asset":
        source = urllib.parse.parse_qs(parts.query).get("src", [""])[0]
        if source:
            return normalize_url(source, base_url)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def extract_attr(html: str, name: str) -> str:
    match = re.search(rf"""{name}=["']([^"']+)["']""", html, re.I)
    return match.group(1) if match else ""


def extract_hero_source(html: str, base_url: str) -> tuple[str, str]:
    patterns = (
        r"""data-page-section=["']hero["'][\s\S]{0,7000}?data-src=["']([^"']+)["']""",
        r"""data-src=["']([^"']+)["'][\s\S]{0,7000}?data-page-section=["']hero["']""",
    )
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            return normalize_url(match.group(1), base_url), "hero_data_src"

    og_match = re.search(r"""<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>""", html, re.I)
    if og_match:
        return normalize_url(og_match.group(1), base_url), "og_image_fallback"
    return "", "missing"


def active_manifest_paths(args: argparse.Namespace) -> list[Path]:
    if args.manifest:
        return [Path(path).resolve() for path in args.manifest]
    paths: list[Path] = []
    for path in sorted(MANIFEST_DIR.glob("*.manifest.json")):
        if path.name.startswith("pilot-"):
            continue
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if manifest.get("package_contract_id") == "resi-edge-canonical-upgrade-package":
            paths.append(path)
    return paths


def request_url(url: str, timeout: int, accept: str | None = None) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": accept or "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": USER_AGENT,
        },
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        headers = {key.lower(): value for key, value in response.headers.items()}
        return response.status, headers, response.read()


def source_metadata(url: str, timeout: int) -> dict[str, Any]:
    status, headers, body = request_url(url, timeout, accept="image/jpeg,image/png,image/*,*/*;q=0.8")
    return {
        "url": url,
        "http_status": status,
        "content_type": clean(headers.get("content-type")),
        "content_length": clean(headers.get("content-length")) or str(len(body)),
        "etag": clean(headers.get("etag")),
        "last_modified": clean(headers.get("last-modified")),
        "sha256": hashlib.sha256(body).hexdigest(),
    }


def edge_assets(manifest: dict[str, Any], code: str) -> dict[str, str]:
    image_mobile = clean(((manifest.get("mobile_shell") or {}).get("hero") or {}).get("image_mobile"))
    return {
        "mobile_avif": image_mobile or f"/assets/resi-edge-assets/{code}/home/hero-mobile-750x1000.avif",
        "mobile_webp": re.sub(r"\.avif(\?.*)?$", ".webp", image_mobile, flags=re.I)
        if image_mobile
        else f"/assets/resi-edge-assets/{code}/home/hero-mobile-750x1000.webp",
    }


def load_previous(root: Path, key: str) -> dict[str, Any] | None:
    previous_path = root / "_records" / f"{slug(key)}.json"
    if not previous_path.exists():
        return None
    try:
        return json.loads(previous_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def write_record_mirror(root: Path, key: str, record: dict[str, Any]) -> None:
    mirror = root / "_records"
    mirror.mkdir(parents=True, exist_ok=True)
    (mirror / f"{slug(key)}.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


def build_record(manifest_path: Path, run_id: str, generated_at: str, out_root: Path, timeout: int) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    target = manifest.get("target") or {}
    code = clean(target.get("source_property_code") or target.get("property_code")).upper()
    domain = clean(target.get("domain"))
    key = f"resi-edge-hero-freshness/{slug(code)}-{slug(domain)}/current.json"
    native_url = f"https://{domain}/?vtr_source_freshness_probe={run_id}"
    manifest_source = normalize_url(clean(((manifest.get("mobile_shell") or {}).get("hero") or {}).get("source_image")), native_url)
    previous = load_previous(out_root, key)

    record: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "property_code": code,
        "domain": domain,
        "property_name": clean(target.get("property_name")),
        "manifest": str(manifest_path.relative_to(ROOT)),
        "key": key,
        "native_url": native_url,
        "manifest_source_image": manifest_source,
        "detected_source_image": "",
        "status": "source_error",
        "recommended_action": "check_native_source",
        "source_metadata": None,
        "edge_assets": edge_assets(manifest, code),
        "source": {
            "system": "native_homepage_html",
            "selector": "data-page-section=hero data-src",
            "fetched_at": generated_at,
        },
    }
    if previous:
        record["previous"] = {
            "detected_source_image": previous.get("detected_source_image"),
            "source_sha256": (previous.get("source_metadata") or {}).get("sha256"),
            "generated_at": previous.get("generated_at"),
        }

    try:
        status, _, body = request_url(native_url, timeout)
        if status < 200 or status >= 400:
            raise RuntimeError(f"Native homepage returned HTTP {status}")
        detected_source, method = extract_hero_source(body.decode("utf-8", "ignore"), native_url)
        record["detected_source_image"] = detected_source
        record["source"]["extraction_method"] = method
        if not detected_source or method == "og_image_fallback":
            record["status"] = "source_missing"
            record["recommended_action"] = "check_native_source"
            return record

        metadata = source_metadata(detected_source, timeout)
        record["source_metadata"] = metadata
        previous_sha = ((previous or {}).get("source_metadata") or {}).get("sha256")
        if detected_source != manifest_source or (previous_sha and previous_sha != metadata.get("sha256")):
            record["status"] = "refresh_needed"
            record["recommended_action"] = "regenerate_hero_assets"
        else:
            record["status"] = "current"
            record["recommended_action"] = "none"
        return record
    except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
        record["error"] = str(exc)
        return record


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect Resi Edge hero freshness evidence.")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--manifest", action="append", help="Specific active manifest path. Repeatable.")
    parser.add_argument("--timeout", type=int, default=30)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out_root = Path(args.out_dir).resolve()
    generated_at_dt = datetime.now(timezone.utc)
    generated_at = generated_at_dt.isoformat()
    run_id = generated_at_dt.strftime("%Y%m%dT%H%M%SZ")
    run_dir = out_root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    records = [
        build_record(path, run_id, generated_at, out_root, args.timeout)
        for path in active_manifest_paths(args)
    ]
    for record in records:
        record_path = run_dir / f"{slug(record['domain'])}.hero-freshness.json"
        record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        write_record_mirror(out_root, record["key"], record)

    rows = [
        {
            "property_code": record.get("property_code"),
            "domain": record.get("domain"),
            "property_name": record.get("property_name"),
            "status": record.get("status"),
            "manifest_source_image": record.get("manifest_source_image"),
            "detected_source_image": record.get("detected_source_image"),
            "source_sha256": (record.get("source_metadata") or {}).get("sha256", ""),
            "recommended_action": record.get("recommended_action"),
            "error": record.get("error", ""),
        }
        for record in records
    ]
    summary = {
        "ok": all(row["status"] != "source_error" for row in rows),
        "run_id": run_id,
        "generated_at": generated_at,
        "generated_at_human": generated_at_dt.strftime("%m/%d/%Y %I:%M %p UTC"),
        "property_count": len(rows),
        "current_count": sum(1 for row in rows if row["status"] == "current"),
        "refresh_needed_count": sum(1 for row in rows if row["status"] == "refresh_needed"),
        "source_missing_count": sum(1 for row in rows if row["status"] == "source_missing"),
        "source_error_count": sum(1 for row in rows if row["status"] == "source_error"),
        "write_count": len(records),
        "rows": rows,
    }
    (run_dir / "latest-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (out_root / "latest-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(run_dir)
    print(json.dumps({key: summary[key] for key in ("property_count", "current_count", "refresh_needed_count", "source_missing_count", "source_error_count")}))
    return 0 if summary["source_error_count"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
