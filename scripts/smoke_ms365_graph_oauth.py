#!/usr/bin/env python3
"""Smoke test Keeper-backed Microsoft Graph OAuth for Ops Watch."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import KsmResolutionError  # noqa: E402
from utils.ms365_graph_auth import (  # noqa: E402
    Ms365GraphAuthError,
    acquire_ms365_graph_token,
    graph_get,
    resolve_ms365_graph_credentials,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test Microsoft Graph OAuth without exposing token or email content.")
    parser.add_argument("--check-mailbox", action="store_true", help="Also verify the configured mailbox inbox folder can be read.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of prose.")
    args = parser.parse_args()

    result: dict[str, Any] = {
        "status": "failed",
        "credential_source": "Keeper/KSM notation env vars",
        "token_acquired": False,
        "mailbox_checked": False,
        "mailbox_readable": False,
        "mailbox_user_present": False,
        "error": None,
    }

    try:
        credentials = resolve_ms365_graph_credentials()
        result["mailbox_user_present"] = bool(credentials.mailbox_user)
        token = acquire_ms365_graph_token(credentials)
        result["token_acquired"] = True
        result["token_type"] = token.token_type
        result["expires_in_seconds"] = token.expires_in

        if args.check_mailbox:
            mailbox = urllib.parse.quote(credentials.mailbox_user)
            path = f"users/{mailbox}/mailFolders/inbox?$select=id,displayName,totalItemCount,unreadItemCount"
            folder = graph_get(token, path)
            result["mailbox_checked"] = True
            result["mailbox_readable"] = True
            result["mailbox_summary"] = {
                "display_name": folder.get("displayName"),
                "total_item_count": folder.get("totalItemCount"),
                "unread_item_count": folder.get("unreadItemCount"),
            }

        result["status"] = "passed"
    except (KsmResolutionError, Ms365GraphAuthError) as exc:
        result["error"] = str(exc)

    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print(f"Status: {result['status']}")
        print(f"Credential source: {result['credential_source']}")
        print(f"Token acquired: {result['token_acquired']}")
        print(f"Mailbox checked: {result['mailbox_checked']}")
        print(f"Mailbox readable: {result['mailbox_readable']}")
        if result.get("mailbox_summary"):
            summary = result["mailbox_summary"]
            print(
                "Mailbox summary: "
                f"display={summary.get('display_name')!r}, "
                f"total={summary.get('total_item_count')}, "
                f"unread={summary.get('unread_item_count')}"
            )
        if result["error"]:
            print(f"Error: {result['error']}")

    return 0 if result["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
