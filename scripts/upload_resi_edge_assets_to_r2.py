#!/usr/bin/env python3
"""Upload generated Resi edge assets to R2 using Keeper-backed Wrangler auth."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.scripts.wrangler_auth import build_runtime_env, npx_wrangler_prefix


IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
UPLOAD_ATTEMPTS = 3
UPLOAD_RETRY_SECONDS = 5


def content_type_for_path(path: str) -> str:
    lower = path.split("?", 1)[0].lower()
    if lower.endswith(".avif"):
        return "image/avif"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".svg"):
        return "image/svg+xml; charset=utf-8"
    if lower.endswith(".woff2"):
        return "font/woff2"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return "application/octet-stream"


def load_packet(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packet", required=True, type=Path, help="generated-assets.json from generate_resi_edge_assets.py")
    parser.add_argument("--apply", action="store_true", help="Actually upload objects. Omit for dry-run.")
    parser.add_argument("--local", action="store_true", help="Use Wrangler's local R2 store instead of remote Cloudflare R2.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    packet = load_packet(args.packet.resolve())
    plan = packet.get("uploadPlan", [])
    if not plan:
        raise SystemExit("No uploadPlan entries found.")

    env = build_runtime_env()
    if not env.get("CLOUDFLARE_API_TOKEN"):
        raise SystemExit("Cloudflare API token was not resolved through the Keeper-backed Wrangler helper.")

    prefix = npx_wrangler_prefix(env)
    uploaded = 0
    failures: list[dict[str, str]] = []

    for item in plan:
        local_path = Path(item["localPath"])
        if not local_path.exists():
            failures.append({"localPath": str(local_path), "error": "missing local file"})
            continue

        command = prefix + [
            "r2",
            "object",
            "put",
            f"{item['bucket']}/{item['r2Key']}",
            "--file",
            str(local_path),
            "--content-type",
            content_type_for_path(item["r2Key"]),
            "--cache-control",
            IMMUTABLE_CACHE_CONTROL,
        ]
        if not args.local:
            command.append("--remote")
        if not args.apply:
            print(f"DRY RUN: {item['bucket']}/{item['r2Key']} <- {local_path}")
            continue

        result = None
        for attempt in range(1, UPLOAD_ATTEMPTS + 1):
            result = subprocess.run(command, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
            if result.returncode == 0:
                uploaded += 1
                suffix = "" if attempt == 1 else f" after {attempt} attempts"
                print(f"UPLOADED: {item['bucket']}/{item['r2Key']}{suffix}")
                break
            if attempt < UPLOAD_ATTEMPTS:
                time.sleep(UPLOAD_RETRY_SECONDS)

        if result is not None and result.returncode != 0:
            failures.append(
                {
                    "localPath": str(local_path),
                    "r2Key": item["r2Key"],
                    "error": (result.stderr or result.stdout).strip()[-500:],
                }
            )

    summary = {"mode": "apply" if args.apply else "dry-run", "planned": len(plan), "uploaded": uploaded, "failures": failures}
    print(json.dumps(summary, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
