#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import KsmResolutionError, resolve_secret


DEFAULT_KSM_PROFILE = "marketingops"
DEFAULT_CLOUDFLARE_TOKEN_NOTATION = "keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password"
VERIFY_URL = "https://api.cloudflare.com/client/v4/user/tokens/verify"


def resolve_cloudflare_token() -> str:
    return resolve_secret(
        description="Cloudflare API token",
        notation_env_var="KSM_CLOUDFLARE_TOKEN_NOTATION",
        default_notation=DEFAULT_CLOUDFLARE_TOKEN_NOTATION,
        direct_env_var="CLOUDFLARE_API_TOKEN",
        default_profile=DEFAULT_KSM_PROFILE,
    )


def verify_token(token: str) -> dict:
    req = urllib.request.Request(
        VERIFY_URL,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify that the current Cloudflare admin token is valid for non-interactive release promotion."
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable output.")
    args = parser.parse_args()

    result = {
        "status": "review",
        "source": None,
        "message": None,
    }

    try:
        token = resolve_cloudflare_token()
        result["source"] = "keeper_or_env"
    except KsmResolutionError as exc:
        result["status"] = "blocked"
        result["message"] = f"Unable to resolve Cloudflare API token: {exc}"
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result["message"])
        return 1

    try:
        payload = verify_token(token)
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        result["status"] = "blocked"
        result["message"] = f"Cloudflare token verification request failed: {exc}"
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result["message"])
        return 1

    if payload.get("success"):
        result["status"] = "healthy"
        result["message"] = "Cloudflare admin token is valid for release promotion."
        result["verification"] = payload.get("result")
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result["message"])
        return 0

    result["status"] = "blocked"
    errors = payload.get("errors") or []
    first = errors[0] if errors else {}
    code = first.get("code")
    message = first.get("message", "Cloudflare token verification failed")
    result["message"] = f"Cloudflare admin token is not valid for release promotion: [{code}] {message}"
    result["errors"] = errors
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result["message"])
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
