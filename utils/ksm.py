#!/usr/bin/env python3
"""
Keeper Secrets Manager helpers for local scripts.

Resolution order:
1. Keeper notation via `ksm secret notation`
2. Direct environment variable
3. Optional local file fallback
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional


class KsmResolutionError(RuntimeError):
    """Raised when a secret cannot be resolved from any configured source."""


def _ksm_binary() -> str:
    search_path = os.getenv("PATH", "")
    extra_segments = [
        "/Library/Frameworks/Python.framework/Versions/3.12/bin",
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    merged_path = ":".join(seg for seg in [*extra_segments, search_path] if seg)
    return shutil.which("ksm", path=merged_path) or "ksm"


def _clean_value(raw: str) -> str:
    return raw.strip().strip('"').strip("'")


def _read_keeper_notation(notation: str, profile: str, description: str) -> str:
    result = subprocess.run(
        [_ksm_binary(), "-p", profile, "secret", "notation", notation],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise KsmResolutionError(
            f"Keeper lookup failed for {description}. "
            f"Profile={profile!r} notation={notation!r} stderr={result.stderr.strip()}"
        )

    value = _clean_value(result.stdout)
    if not value:
        raise KsmResolutionError(
            f"Keeper returned an empty value for {description}. "
            f"Profile={profile!r} notation={notation!r}"
        )
    return value


def resolve_secret(
    *,
    description: str,
    notation_env_var: Optional[str] = None,
    default_notation: Optional[str] = None,
    direct_env_var: Optional[str] = None,
    file_path: Optional[Path] = None,
    default_profile: Optional[str] = None,
) -> str:
    """
    Resolve a secret using Keeper-first precedence.

    Args:
        description: Human-readable label for error messages.
        notation_env_var: Env var holding a Keeper notation string.
        default_notation: Keeper notation to use when the env var is absent.
        direct_env_var: Plain env var fallback containing the secret value.
        file_path: Local file fallback path.
        default_profile: Fallback KSM profile if KSM_PROFILE is not set.
    """
    notation = None
    if notation_env_var:
        notation = os.getenv(notation_env_var)
    if not notation and default_notation:
        notation = default_notation
    if notation:
        profile = os.getenv("KSM_PROFILE", default_profile or "default")
        return _read_keeper_notation(notation, profile, description)

    if direct_env_var:
        direct_value = os.getenv(direct_env_var)
        if direct_value:
            value = _clean_value(direct_value)
            if value:
                return value

    if file_path:
        path = Path(file_path).expanduser()
        if path.exists():
            value = _clean_value(path.read_text())
            if value:
                return value
            raise KsmResolutionError(f"{description} file is empty: {path}")

    missing_sources = []
    if notation_env_var:
        missing_sources.append(notation_env_var)
    if default_notation:
        missing_sources.append("default_notation")
    if direct_env_var:
        missing_sources.append(direct_env_var)
    if file_path:
        missing_sources.append(str(file_path))

    raise KsmResolutionError(
        f"No value found for {description}. Checked: {', '.join(missing_sources)}"
    )


def resolve_secret_from_multiple_notations(
    *,
    description: str,
    notation_env_vars: list[str],
    direct_env_var: Optional[str] = None,
    file_path: Optional[Path] = None,
    default_profile: Optional[str] = None,
) -> str:
    """
    Resolve a secret from multiple Keeper notation env vars before other fallbacks.

    This is useful during migrations, where a secret may temporarily exist in both
    a legacy file-attachment record and a new structured Keeper record.
    """
    profile = os.getenv("KSM_PROFILE", default_profile or "default")

    for notation_env_var in notation_env_vars:
        notation = os.getenv(notation_env_var)
        if notation:
            return _read_keeper_notation(notation, profile, description)

    return resolve_secret(
        description=description,
        notation_env_var=None,
        direct_env_var=direct_env_var,
        file_path=file_path,
        default_profile=default_profile,
    )
