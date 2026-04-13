#!/usr/bin/env python3
"""
Verify Cloudflare auth using the standard credential resolution chain.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from urllib.error import HTTPError

from cloudflare_auth import CloudflareAuthError, resolve_cloudflare_token


def fetch_json(url: str, token: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def main() -> int:
    try:
        resolved = resolve_cloudflare_token()
    except CloudflareAuthError as exc:
        print(str(exc))
        return 1

    payload = None
    endpoint = None

    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    if resolved.token.startswith("cfat_") and account_id:
        endpoint = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/tokens/verify"
        payload = fetch_json(endpoint, resolved.token)
    else:
        endpoint = "https://api.cloudflare.com/client/v4/user/tokens/verify"
        try:
            payload = fetch_json(endpoint, resolved.token)
        except HTTPError as exc:
            if exc.code != 401:
                raise
            if resolved.token.startswith("cfat_") and account_id:
                endpoint = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/tokens/verify"
                payload = fetch_json(endpoint, resolved.token)
            else:
                endpoint = "https://api.cloudflare.com/client/v4/zones?per_page=1"
                payload = fetch_json(endpoint, resolved.token)

    print(json.dumps({"source": resolved.source, "endpoint": endpoint, "verify": payload}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
