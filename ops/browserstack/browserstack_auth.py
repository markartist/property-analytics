#!/usr/bin/env python3
"""
BrowserStack credential resolution with Keeper-first precedence.

Resolution order:
1. Keeper Secrets Manager notation via `ksm secret notation`
2. `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`
3. `BROWSERSTACK_CREDENTIALS_FILE`
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import KsmResolutionError, resolve_secret


class BrowserStackAuthError(RuntimeError):
    """Raised when BrowserStack credentials cannot be resolved."""


DEFAULT_BROWSERSTACK_USERNAME_NOTATION = "keeper://y6GUrHJgXsSxybHruXcVWg/field/login"
DEFAULT_BROWSERSTACK_ACCESS_KEY_NOTATION = "keeper://y6GUrHJgXsSxybHruXcVWg/field/password"


@dataclass
class ResolvedCredentials:
    username: str
    access_key: str
    source: str


def _clean_value(raw: str) -> str:
    return raw.strip().strip('"').strip("'")


def _from_keeper() -> Optional[ResolvedCredentials]:
    username_notation = os.getenv("KSM_BROWSERSTACK_USERNAME_NOTATION", DEFAULT_BROWSERSTACK_USERNAME_NOTATION)
    access_key_notation = os.getenv("KSM_BROWSERSTACK_ACCESS_KEY_NOTATION", DEFAULT_BROWSERSTACK_ACCESS_KEY_NOTATION)
    if not username_notation or not access_key_notation:
        return None

    profile = os.getenv("KSM_PROFILE", "marketingops")
    try:
        username = resolve_secret(
            description="BrowserStack username",
            notation_env_var="KSM_BROWSERSTACK_USERNAME_NOTATION",
            default_notation=DEFAULT_BROWSERSTACK_USERNAME_NOTATION,
            direct_env_var=None,
            default_profile=profile,
        )
        access_key = resolve_secret(
            description="BrowserStack access key",
            notation_env_var="KSM_BROWSERSTACK_ACCESS_KEY_NOTATION",
            default_notation=DEFAULT_BROWSERSTACK_ACCESS_KEY_NOTATION,
            direct_env_var=None,
            default_profile=profile,
        )
    except KsmResolutionError as exc:
        raise BrowserStackAuthError(str(exc)) from exc
    return ResolvedCredentials(username=username, access_key=access_key, source=f"keeper:{profile}")


def _from_env() -> Optional[ResolvedCredentials]:
    username = os.getenv("BROWSERSTACK_USERNAME")
    access_key = os.getenv("BROWSERSTACK_ACCESS_KEY")
    if not username or not access_key:
        return None

    return ResolvedCredentials(
        username=_clean_value(username),
        access_key=_clean_value(access_key),
        source="env:BROWSERSTACK_USERNAME+BROWSERSTACK_ACCESS_KEY",
    )


def _parse_credentials_file(text: str) -> ResolvedCredentials:
    username = None
    access_key = None

    for line in text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = _clean_value(value)
        if key == "username":
            username = value
        elif key in {"access key", "access_key"}:
            access_key = value

    if not username or not access_key:
        raise BrowserStackAuthError(
            "BROWSERSTACK_CREDENTIALS_FILE must contain 'Username:' and 'Access Key:' lines."
        )

    return ResolvedCredentials(
        username=username,
        access_key=access_key,
        source="file",
    )


def _from_file() -> Optional[ResolvedCredentials]:
    path_value = os.getenv("BROWSERSTACK_CREDENTIALS_FILE")
    if not path_value:
        return None

    path = Path(path_value).expanduser()
    if not path.exists():
        raise BrowserStackAuthError(f"BROWSERSTACK_CREDENTIALS_FILE does not exist: {path}")

    creds = _parse_credentials_file(path.read_text())
    return ResolvedCredentials(
        username=creds.username,
        access_key=creds.access_key,
        source=f"file:{path}",
    )


def resolve_browserstack_credentials() -> ResolvedCredentials:
    for resolver in (_from_keeper, _from_env, _from_file):
        resolved = resolver()
        if resolved:
            return resolved

    raise BrowserStackAuthError(
        "No BrowserStack credentials found. "
        "Set KSM_BROWSERSTACK_USERNAME_NOTATION and "
        "KSM_BROWSERSTACK_ACCESS_KEY_NOTATION for Keeper, "
        "or BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY, "
        "or BROWSERSTACK_CREDENTIALS_FILE as last resort."
    )


def main() -> int:
    resolved = resolve_browserstack_credentials()
    output_format = os.getenv("BROWSERSTACK_AUTH_OUTPUT", "json")
    if output_format == "exports":
        print(f'export BROWSERSTACK_USERNAME="{resolved.username}"')
        print(f'export BROWSERSTACK_ACCESS_KEY="{resolved.access_key}"')
        print(f'export BROWSERSTACK_AUTH_SOURCE="{resolved.source}"')
        return 0

    print(
        json.dumps(
            {
                "username": resolved.username,
                "access_key": resolved.access_key,
                "source": resolved.source,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
