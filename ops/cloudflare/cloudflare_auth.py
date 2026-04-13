#!/usr/bin/env python3
"""
Cloudflare credential resolution with Keeper-first precedence.

Resolution order:
1. Keeper Secrets Manager notation via `ksm secret notation`
2. `CLOUDFLARE_API_TOKEN`
3. `CLOUDFLARE_API_TOKEN_FILE`
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class CloudflareAuthError(RuntimeError):
    """Raised when no Cloudflare credentials can be resolved."""


@dataclass
class ResolvedToken:
    token: str
    source: str


def _clean_token(raw: str) -> str:
    text = raw.strip()
    if "Bearer " in text:
        text = text.split("Bearer ", 1)[1]
    text = text.strip().strip('"').strip("'")
    return text


def _from_keeper() -> Optional[ResolvedToken]:
    notation = os.getenv("KSM_CLOUDFLARE_TOKEN_NOTATION")
    if not notation:
        return None

    profile = os.getenv("KSM_PROFILE", "cloudflare-dns")
    cmd = ["ksm", "-p", profile, "secret", "notation", notation]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise CloudflareAuthError(
            "Keeper lookup failed. "
            f"Profile={profile!r} notation={notation!r} stderr={result.stderr.strip()}"
        )

    token = _clean_token(result.stdout)
    if not token:
        raise CloudflareAuthError(
            "Keeper returned an empty Cloudflare token. "
            f"Profile={profile!r} notation={notation!r}"
        )
    return ResolvedToken(token=token, source=f"keeper:{profile}")


def _from_env() -> Optional[ResolvedToken]:
    value = os.getenv("CLOUDFLARE_API_TOKEN")
    if not value:
        return None
    token = _clean_token(value)
    return ResolvedToken(token=token, source="env:CLOUDFLARE_API_TOKEN")


def _from_file() -> Optional[ResolvedToken]:
    path_value = os.getenv("CLOUDFLARE_API_TOKEN_FILE")
    if not path_value:
        return None

    path = Path(path_value).expanduser()
    if not path.exists():
        raise CloudflareAuthError(f"CLOUDFLARE_API_TOKEN_FILE does not exist: {path}")

    token = _clean_token(path.read_text())
    if not token:
        raise CloudflareAuthError(f"CLOUDFLARE_API_TOKEN_FILE is empty: {path}")
    return ResolvedToken(token=token, source=f"file:{path}")


def resolve_cloudflare_token() -> ResolvedToken:
    for resolver in (_from_keeper, _from_env, _from_file):
        resolved = resolver()
        if resolved:
            return resolved

    raise CloudflareAuthError(
        "No Cloudflare credentials found. "
        "Set KSM_CLOUDFLARE_TOKEN_NOTATION for Keeper, "
        "or CLOUDFLARE_API_TOKEN, "
        "or CLOUDFLARE_API_TOKEN_FILE as last resort."
    )
