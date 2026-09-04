#!/usr/bin/env python3
"""Manually trigger the production Resi Edge hero freshness monitor."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import KsmResolutionError, resolve_secret

DEFAULT_BASE_URL = "https://pop-brief-api.mlaufhutte.workers.dev"
DEFAULT_PLATFORM_ACCESS_CLIENT_ID_NOTATION = "keeper://qj9iKxhtQzG96nxfNdDrNQ/field/login"
DEFAULT_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION = "keeper://qj9iKxhtQzG96nxfNdDrNQ/field/password"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "reports" / "resi_edge_performance" / "hero-freshness-manual-sync"


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def resolve_platform_access_client_id(explicit: str | None) -> str:
    if explicit:
        return explicit.strip()
    return resolve_secret(
        description="Platform Access client id",
        notation_env_var="KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_ID_NOTATION",
        default_notation=DEFAULT_PLATFORM_ACCESS_CLIENT_ID_NOTATION,
        direct_env_var="PLATFORM_ACCESS_CLIENT_ID",
        default_profile="marketingops",
    )


def resolve_platform_access_client_secret(explicit: str | None) -> str:
    if explicit:
        return explicit.strip()
    return resolve_secret(
        description="Platform Access client secret",
        notation_env_var="KSM_CLOUDFLARE_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION",
        default_notation=DEFAULT_PLATFORM_ACCESS_CLIENT_SECRET_NOTATION,
        direct_env_var="PLATFORM_ACCESS_CLIENT_SECRET",
        default_profile="marketingops",
    )


def resolve_platform_shared_token(explicit: str | None) -> str:
    if explicit:
        return explicit.strip()
    return resolve_secret(
        description="Platform shared token",
        notation_env_var="KSM_PLATFORM_SHARED_TOKEN_NOTATION",
        direct_env_var="PLATFORM_SHARED_TOKEN",
        default_profile="marketingops",
    )


def auth_headers(args: argparse.Namespace) -> dict[str, str]:
    try:
        client_id = resolve_platform_access_client_id(args.access_client_id)
        client_secret = resolve_platform_access_client_secret(args.access_client_secret)
        if client_id and client_secret:
            return {
                "CF-Access-Client-Id": client_id,
                "CF-Access-Client-Secret": client_secret,
            }
    except KsmResolutionError:
        pass

    try:
        token = resolve_platform_shared_token(args.shared_token)
    except KsmResolutionError as exc:
        raise SystemExit(
            "Either platform Access client credentials or PLATFORM_SHARED_TOKEN must resolve through Keeper/env."
        ) from exc
    return {"Authorization": f"Bearer {token}"}


def post_sync(base_url: str, headers: dict[str, str], actor: str, source: str, request_id: str) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/v1/platform/resi-edge/hero-freshness/sync",
        data=b"{}",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "PropertyAnalytics-ResiEdgeManualHeroFreshness/1.0",
            "X-Request-Id": request_id,
            "X-Platform-Actor": actor,
            "X-Platform-Source": source,
            **headers,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return {
                "status_code": response.status,
                "body": json.loads(response.read().decode("utf-8")),
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return {
            "status_code": exc.code,
            "body": {
                "error": "http_error",
                "status_code": exc.code,
                "response": body[:2000],
            },
        }


def compact_summary(response: dict[str, Any]) -> dict[str, Any]:
    body = response.get("body") or {}
    result = body.get("result") or {}
    return {
        "status_code": response.get("status_code"),
        "request_id": (body.get("meta") or {}).get("requestId"),
        "ok": result.get("ok"),
        "skipped": result.get("skipped"),
        "run_id": result.get("run_id"),
        "generated_at": result.get("generated_at"),
        "property_count": result.get("property_count"),
        "current_count": result.get("current_count"),
        "refresh_needed_count": result.get("refresh_needed_count"),
        "source_missing_count": result.get("source_missing_count"),
        "source_error_count": result.get("source_error_count"),
        "queue": result.get("queue"),
    }


def write_evidence(output_root: Path, response: dict[str, Any], summary: dict[str, Any]) -> Path:
    run_id = summary.get("run_id") or summary.get("request_id") or utc_stamp()
    output_dir = output_root / str(run_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "response.json").write_text(json.dumps(response.get("body"), indent=2, sort_keys=True) + "\n")
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    return output_dir


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manually trigger Resi Edge hero freshness sync.")
    parser.add_argument("--base-url", default=os.environ.get("PLATFORM_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--shared-token", help="Platform shared bearer token fallback")
    parser.add_argument("--access-client-id", help="Cloudflare Access service-token client id")
    parser.add_argument("--access-client-secret", help="Cloudflare Access service-token client secret")
    parser.add_argument("--actor", default="local_mac_runner")
    parser.add_argument("--source", default="resi_edge_manual_monitor_kick")
    parser.add_argument("--request-id", default=f"resi-edge-hero-freshness-manual-{uuid.uuid4()}")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--no-save", action="store_true", help="Print the compact result without writing evidence files")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    headers = auth_headers(args)
    response = post_sync(args.base_url, headers, args.actor, args.source, args.request_id)
    summary = compact_summary(response)
    if not args.no_save:
        summary["evidence_dir"] = str(write_evidence(args.output_root, response, summary))
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0 if response.get("status_code") == 200 and summary.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
