#!/usr/bin/env python3
"""Dry-run-first Cloudflare canary runner for Resi Edge hero media refreshes."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402

ACCOUNT_ID = "5a5a60afaad00085864fe6bab7eb2882"
QUEUE_NAME = "resi-edge-hero-media-refresh"
DLQ_NAME = "resi-edge-hero-media-refresh-dlq"
BUCKET_NAME = "resi-edge-assets"
WORKER_DIR = ROOT / "ops" / "cloudflare" / "resi-edge-hero-media-refresh-worker"
WORKER_CONFIG = WORKER_DIR / "wrangler.toml"
DEFAULT_REPORT_ROOT = ROOT / "reports" / "resi_edge_performance" / "hero-media-refresh-worker"
QUEUE_SCHEMA_VERSION = "resi_edge_hero_media_refresh_queue.v1"
USER_AGENT = "ResiEdgeHeroMediaRefreshCanary/2026-09-01"


def slug(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "unknown"


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def find_manifest(property_code: str, domain: str, manifest_arg: str | None) -> Path:
    if manifest_arg:
        path = Path(manifest_arg)
        if not path.is_absolute():
            path = ROOT / path
        if not path.exists():
            raise SystemExit(f"Manifest not found: {path}")
        return path

    wanted_code = property_code.strip().lower()
    wanted_domain = domain.strip().lower()
    matches: list[Path] = []
    for path in (ROOT / "config" / "portfolio_resi_edge_stabilization").glob("*.manifest.json"):
        raw = load_json(path)
        target = raw.get("target") or {}
        codes = {
            str(target.get("property_code") or "").lower(),
            str(target.get("source_property_code") or "").lower(),
        }
        if wanted_code in codes and str(target.get("domain") or "").lower() == wanted_domain:
            matches.append(path)
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one manifest for {property_code} / {domain}; found {len(matches)}.")
    return matches[0]


def validate_identity(property_code: str, domain: str) -> dict[str, Any]:
    identity = resolve_property_identity(property_code) or resolve_property_identity(domain)
    if not identity:
        raise SystemExit(f"Property identity unresolved through governed matrix for {property_code} / {domain}.")
    if identity.property_code and identity.property_code.lower() != property_code.lower():
        raise SystemExit(f"Identity matrix resolved {property_code} to {identity.property_code}; stopping.")
    return identity.as_mapping("property_identity_matrix")


def public_webp_from_avif(public_avif: str) -> str:
    if public_avif.endswith(".avif"):
        return public_avif[:-5] + ".webp"
    raise SystemExit(f"Hero mobile image is not an AVIF path and cannot derive WebP path: {public_avif}")


def fetch_source(url: str, timeout: int = 45) -> dict[str, Any]:
    context = ssl.create_default_context()
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request, context=context, timeout=timeout) as response:
        body = response.read()
        return {
            "url": url,
            "http_status": int(response.status),
            "content_type": response.headers.get("content-type"),
            "content_length": str(len(body)),
            "etag": response.headers.get("etag"),
            "last_modified": response.headers.get("last-modified"),
            "sha256": hashlib.sha256(body).hexdigest(),
        }


def build_message(manifest: dict[str, Any], source_metadata: dict[str, Any], run_id: str) -> dict[str, Any]:
    target = manifest.get("target") or {}
    hero = (manifest.get("mobile_shell") or {}).get("hero") or {}
    property_code = str(target.get("property_code") or target.get("source_property_code") or "").strip()
    domain = str(target.get("domain") or "").strip()
    source_image = str(hero.get("source_image") or "").strip()
    mobile_avif = str(hero.get("image_mobile") or "").strip()
    if not property_code or not domain or not source_image or not mobile_avif:
        raise SystemExit("Manifest is missing target property code/domain or mobile_shell.hero source/image paths.")
    return {
        "schema_version": QUEUE_SCHEMA_VERSION,
        "action": "refresh_hero_assets",
        "queued_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "run_id": run_id,
        "property_code": property_code,
        "domain": domain,
        "property_name": target.get("property_name"),
        "freshness_key": f"resi-edge-hero-freshness/{slug(property_code)}-{slug(domain)}/current.json",
        "media_state_key": f"resi-edge-media-state/{slug(property_code)}-{slug(domain)}/current.json",
        "native_url": f"https://{domain}/?vtr_source_freshness_probe={run_id}",
        "manifest_source_image": source_image,
        "detected_source_image": source_image,
        "source_sha256": source_metadata["sha256"],
        "source_metadata": source_metadata,
        "edge_assets": {
            "mobile_avif": mobile_avif,
            "mobile_webp": public_webp_from_avif(mobile_avif),
        },
        "transform": {
            "width": 750,
            "height": 1000,
            "fit": "cover",
            "gravity": "auto",
            "strategy": "cloudflare-images-canary",
        },
        "quality_policy": {
            "avif_max_bytes": 80000,
            "webp_max_bytes": 80000,
            "start_quality": 78,
            "min_avif_quality": 42,
            "min_webp_quality": 8,
        },
    }


def sanitize_output(value: str) -> str:
    return re.sub(r"Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [redacted]", value or "")[-4000:]


def run_cmd(label: str, cmd: list[str], env: dict[str, str], cwd: Path = ROOT, check: bool = True) -> dict[str, Any]:
    started = time.time()
    result = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)
    record = {
        "label": label,
        "returncode": result.returncode,
        "duration_seconds": round(time.time() - started, 3),
        "stdout": sanitize_output(result.stdout),
        "stderr": sanitize_output(result.stderr),
    }
    if check and result.returncode != 0:
        raise RuntimeError(f"{label} failed with exit {result.returncode}: {record['stderr'] or record['stdout']}")
    return record


def wrangler(env: dict[str, str]) -> list[str]:
    return npx_wrangler_prefix(env)


def worker_config_for_mode(mode: str, allowlist: str, out_dir: Path) -> Path:
    text = WORKER_CONFIG.read_text(encoding="utf-8")
    text = re.sub(
        r'main = "[^"]*"',
        f'main = "{(WORKER_DIR / "worker.mjs").as_posix()}"',
        text,
    )
    text = re.sub(
        r'RESI_EDGE_HERO_MEDIA_REFRESH_MODE = "[^"]*"',
        f'RESI_EDGE_HERO_MEDIA_REFRESH_MODE = "{mode}"',
        text,
    )
    text = re.sub(
        r'RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST = "[^"]*"',
        f'RESI_EDGE_HERO_MEDIA_CANARY_ALLOWLIST = "{allowlist}"',
        text,
    )
    config_path = out_dir / f"wrangler.{mode}.toml"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(text, encoding="utf-8")
    return config_path


def deploy_worker(env: dict[str, str], mode: str, allowlist: str = "", out_dir: Path | None = None) -> dict[str, Any]:
    config_path = worker_config_for_mode(mode, allowlist, out_dir) if out_dir else WORKER_CONFIG
    return run_cmd(
        f"deploy_{mode}",
        wrangler(env)
        + [
            "deploy",
            "--config",
            str(config_path),
        ],
        env,
        cwd=WORKER_DIR,
    )


def ensure_queue(env: dict[str, str], name: str) -> dict[str, Any]:
    result = run_cmd(f"ensure_queue_{name}", wrangler(env) + ["queues", "create", name], env, check=False)
    output = (result["stderr"] + result["stdout"]).lower()
    accepted = result["returncode"] == 0 or "already exists" in output or "already taken" in output
    if not accepted:
        raise RuntimeError(f"Queue create failed for {name}: {result['stderr'] or result['stdout']}")
    return result


def queue_info(env: dict[str, str], name: str) -> tuple[str, dict[str, Any]]:
    result = run_cmd(f"queue_info_{name}", wrangler(env) + ["queues", "info", name], env)
    text = f"{result['stdout']}\n{result['stderr']}"
    match = re.search(r"(?:Queue ID|id)\s*[:=]\s*([a-f0-9]{32})", text, re.IGNORECASE)
    if not match:
        raise RuntimeError(f"Could not parse queue id for {name} from Wrangler output.")
    return match.group(1), result


def purge_queue(env: dict[str, str], name: str) -> dict[str, Any]:
    return run_cmd(f"purge_queue_{name}", wrangler(env) + ["queues", "purge", name, "--force"], env)


def cloudflare_post_message(env: dict[str, str], account_id: str, queue_id: str, message: dict[str, Any]) -> dict[str, Any]:
    token = env.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise RuntimeError("CLOUDFLARE_API_TOKEN was not resolved by the Keeper-backed Wrangler helper.")
    payload = json.dumps({"body": message}).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/queues/{queue_id}/messages",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read().decode("utf-8", "replace")
            parsed = json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"Queue message post failed with HTTP {exc.code}: {sanitize_output(body)}") from exc
    if not parsed.get("success"):
        raise RuntimeError(f"Queue message post failed: {sanitize_output(json.dumps(parsed))}")
    return {"label": "post_queue_message", "success": True, "queue_id": queue_id}


def read_r2_json(env: dict[str, str], key: str) -> dict[str, Any] | None:
    result = run_cmd(
        f"read_r2_{slug(key)}",
        wrangler(env) + ["r2", "object", "get", f"{BUCKET_NAME}/{key}", "--remote", "--pipe"],
        env,
        check=False,
    )
    if result["returncode"] != 0:
        return None
    return json.loads(result["stdout"])


def expected_receipt_keys(message: dict[str, Any], statuses: list[str]) -> list[str]:
    source_hash = str(message.get("source_sha256") or "")[:12] or "nohash"
    prefix = f"{slug(message.get('run_id'))}-{slug(message.get('property_code'))}-{slug(message.get('domain'))}"
    return [f"resi-edge-media-refresh/_runs/{prefix}-{status}-{source_hash}.json" for status in statuses]


def same_origin_readback(message: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    context = ssl.create_default_context()
    for label, path in (message.get("edge_assets") or {}).items():
        url = f"https://{message['domain']}{path if str(path).startswith('/') else '/' + str(path)}"
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, context=context, timeout=45) as response:
                body = response.read()
                rows.append(
                    {
                        "label": label,
                        "url": url,
                        "http_status": int(response.status),
                        "content_type": response.headers.get("content-type"),
                        "bytes": len(body),
                        "sha256": hashlib.sha256(body).hexdigest(),
                    }
                )
        except Exception as exc:  # noqa: BLE001 - evidence only
            rows.append({"label": label, "url": url, "error": str(exc)})
    return rows


def run_apply(args: argparse.Namespace, out_dir: Path, message: dict[str, Any]) -> dict[str, Any]:
    env = build_runtime_env()
    steps: list[dict[str, Any]] = []
    closeout: dict[str, Any] | None = None
    if not env.get("CLOUDFLARE_API_TOKEN"):
        raise SystemExit("Cloudflare token was not resolved through Keeper/KSM; stopping before mutation.")
    try:
        steps.append(ensure_queue(env, DLQ_NAME))
        steps.append(ensure_queue(env, QUEUE_NAME))
        queue_id, info = queue_info(env, QUEUE_NAME)
        steps.append(info)
        if not args.skip_deploy:
            steps.append(deploy_worker(env, "disabled", out_dir=out_dir))
            steps.append(deploy_worker(env, "canary", f"{message['property_code']},{message['domain']}", out_dir=out_dir))
        steps.append(purge_queue(env, QUEUE_NAME))
        steps.append(purge_queue(env, DLQ_NAME))
        steps.append(cloudflare_post_message(env, args.account_id, queue_id, message))

        receipt = None
        receipt_key = None
        started = time.time()
        statuses = ["refreshed", "budget_exceeded", "stale", "invalid", "skipped", "refresh_failed"]
        while time.time() - started <= args.timeout_seconds:
            for candidate in expected_receipt_keys(message, statuses):
                receipt = read_r2_json(env, candidate)
                if receipt:
                    receipt_key = candidate
                    break
            if receipt:
                break
            time.sleep(args.poll_seconds)
        if not receipt:
            raise RuntimeError("Timed out waiting for hero media refresh run receipt in R2.")

        closeout = {
            "mode": "apply",
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "message": message,
            "receipt_key": receipt_key,
            "receipt": receipt,
            "media_state": read_r2_json(env, message["media_state_key"]),
            "freshness": read_r2_json(env, message["freshness_key"]),
            "same_origin_readback": same_origin_readback(message) if receipt.get("ok") else [],
            "cloudflare_steps": steps,
            "canary_passed": receipt.get("ok") is True and receipt.get("status") == "refreshed",
            "final_disabled": False,
            "live_traffic_changed": False,
        }
        return closeout
    except Exception as error:
        closeout = {
            "mode": "apply",
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "message": message,
            "error": str(error),
            "cloudflare_steps": steps,
            "canary_passed": False,
            "final_disabled": False,
            "live_traffic_changed": False,
        }
        write_json(out_dir / "canary-failure.json", closeout)
        raise
    finally:
        if not args.skip_deploy and not args.skip_final_disable and env.get("CLOUDFLARE_API_TOKEN"):
            final_step = deploy_worker(env, "disabled", out_dir=out_dir)
            final_path = out_dir / "final-disable.json"
            write_json(final_path, final_step)
            if closeout is not None:
                closeout["final_disabled"] = final_step["returncode"] == 0
                closeout["final_disable_path"] = str(final_path)
                failure_path = out_dir / "canary-failure.json"
                if failure_path.exists():
                    write_json(failure_path, closeout)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a governed Resi Edge hero media refresh Worker canary.")
    parser.add_argument("--property-code", required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--manifest")
    parser.add_argument("--out-dir")
    parser.add_argument("--apply", action="store_true", help="Perform Cloudflare queue/Worker/R2 mutation. Default is dry-run evidence only.")
    parser.add_argument("--skip-deploy", action="store_true", help="Use the current remote Worker deployment; intended only for recovery.")
    parser.add_argument("--skip-final-disable", action="store_true", help="Leave Worker in canary mode after apply; requires deliberate operator use.")
    parser.add_argument("--account-id", default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", ACCOUNT_ID))
    parser.add_argument("--timeout-seconds", type=int, default=120)
    parser.add_argument("--poll-seconds", type=int, default=5)
    args = parser.parse_args()

    identity = validate_identity(args.property_code, args.domain)
    manifest_path = find_manifest(args.property_code, args.domain, args.manifest)
    manifest = load_json(manifest_path)
    target = manifest.get("target") or {}
    if str(target.get("property_code") or target.get("source_property_code") or "").lower() != args.property_code.lower():
        raise SystemExit("Manifest property code does not match the requested canary target.")
    if str(target.get("domain") or "").lower() != args.domain.lower():
        raise SystemExit("Manifest domain does not match the requested canary target.")

    run_id = f"hero-media-canary-{utc_stamp()}-{slug(args.property_code)}-{slug(args.domain)}"
    out_dir = Path(args.out_dir) if args.out_dir else DEFAULT_REPORT_ROOT / slug(args.domain) / utc_stamp()
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    source_image = str(((manifest.get("mobile_shell") or {}).get("hero") or {}).get("source_image") or "")
    if not source_image:
        raise SystemExit("Manifest is missing mobile_shell.hero.source_image.")
    source_metadata = fetch_source(source_image)
    message = build_message(manifest, source_metadata, run_id)

    write_json(out_dir / "identity.json", identity)
    write_json(out_dir / "message.json", message)
    summary = {
        "mode": "apply" if args.apply else "dry_run",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "property_code": args.property_code,
        "domain": args.domain,
        "manifest_path": str(manifest_path),
        "message_path": str(out_dir / "message.json"),
        "source_metadata": source_metadata,
        "live_traffic_changed": False,
        "mutation_performed": bool(args.apply),
    }
    write_json(out_dir / "summary.json", summary)

    if args.apply:
        closeout = run_apply(args, out_dir, message)
        closeout_path = out_dir / "canary-closeout.json"
        write_json(closeout_path, closeout)
        print(json.dumps({"ok": bool(closeout.get("canary_passed")), "closeout_path": str(closeout_path), "receipt_key": closeout.get("receipt_key")}, indent=2))
        if not closeout.get("canary_passed"):
            return 2
    else:
        print(json.dumps({"ok": True, "mode": "dry_run", "out_dir": str(out_dir), "message_path": str(out_dir / "message.json")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
