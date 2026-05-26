#!/usr/bin/env python3
"""Verify DataForSEO Keeper-backed authentication without printing secrets."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.dataforseo_auth import resolve_dataforseo_credentials  # noqa: E402


def main() -> None:
    credentials = resolve_dataforseo_credentials()
    request = urllib.request.Request(
        "https://api.dataforseo.com/v3/appendix/user_data",
        headers={"Authorization": credentials.authorization_header},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    print(
        json.dumps(
            {
                "http_ok": True,
                "status_code": payload.get("status_code"),
                "status_message": payload.get("status_message"),
                "tasks_count": len(payload.get("tasks") or []),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
