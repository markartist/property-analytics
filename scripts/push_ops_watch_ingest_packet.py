#!/usr/bin/env python3
"""
Sign and push an Ops Watch ingest packet.

The signing secret is Keeper-only. Set KSM_OPS_WATCH_INGEST_SHARED_SECRET_NOTATION
to the Keeper notation for the shared HMAC secret before running this script.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import KsmResolutionError, resolve_secret

DEFAULT_ENDPOINT = "https://ops-watch.venterrawebops.com/v1/ops-watch/ingest"
DEFAULT_KSM_OPS_WATCH_INGEST_SECRET_NOTATION = "keeper://w2b3ipQrf1DXfZ53Gpz9aw/field/password"


def resolve_ingest_secret() -> str:
    return resolve_secret(
        description="Ops Watch ingest shared secret",
        notation_env_var="KSM_OPS_WATCH_INGEST_SHARED_SECRET_NOTATION",
        default_notation=DEFAULT_KSM_OPS_WATCH_INGEST_SECRET_NOTATION,
        default_profile="marketingops",
    )


def sign_body(secret: str, timestamp: str, raw_body: bytes) -> str:
    message = timestamp.encode("utf-8") + b"." + raw_body
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Push a signed Ops Watch ingest packet.")
    parser.add_argument("packet", type=Path)
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--dry-run", action="store_true", help="Validate/sign only; do not send.")
    args = parser.parse_args()

    raw_body = args.packet.read_bytes()
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON packet: {exc}") from exc

    try:
        secret = resolve_ingest_secret()
    except KsmResolutionError as exc:
        raise SystemExit(f"Keeper secret resolution failed: {exc}") from exc

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    signature = sign_body(secret, timestamp, raw_body)

    print(
        json.dumps(
            {
                "packet": str(args.packet),
                "endpoint": args.endpoint,
                "source": payload.get("source"),
                "run_id": payload.get("run_id"),
                "record_count": len(payload.get("records") or []),
                "signature_ready": True,
                "dry_run": bool(args.dry_run),
            },
            indent=2,
            sort_keys=True,
        )
    )

    if args.dry_run:
        return 0

    request = urllib.request.Request(
        args.endpoint,
        data=raw_body,
        method="POST",
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "Venterra-Ops-Watch-Ingest/1.0",
            "x-ops-watch-timestamp": timestamp,
            "x-ops-watch-signature": signature,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(body)
            return 0 if 200 <= response.status < 300 else 1
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(body, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
