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


MARKETINGOPS_HOME = "/Users/mark"
MARKETINGOPS_USER = "mark"
DEFAULT_PROFILE = "marketingops"
DEFAULT_BOOTSTRAP_TOKEN_FILES = (
    "/Users/mark/KSM_Credentials_v2.txt",
    "/Users/mark/KSM_Credentials.txt",
)
EXTRA_PATH_SEGMENTS = (
    "/Library/Frameworks/Python.framework/Versions/3.12/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
)

_KEEPER_READY_BY_PROFILE: dict[str, bool] = {}


def _build_keeper_env(base_env: Optional[dict[str, str]] = None) -> dict[str, str]:
    env = dict(base_env or os.environ)
    env["HOME"] = MARKETINGOPS_HOME
    env["USER"] = MARKETINGOPS_USER
    env["LOGNAME"] = MARKETINGOPS_USER
    merged_path: list[str] = []
    for segment in [*EXTRA_PATH_SEGMENTS, *(env.get("PATH", "").split(":"))]:
        value = (segment or "").strip()
        if value and value not in merged_path:
            merged_path.append(value)
    env["PATH"] = ":".join(merged_path)
    env["KSM_PROFILE"] = env.get("KSM_PROFILE") or DEFAULT_PROFILE
    return env


def _ksm_binary() -> str:
    env = _build_keeper_env()
    search_path = env.get("PATH", "")
    merged_path = ":".join(seg for seg in search_path.split(":") if seg)
    return shutil.which("ksm", path=merged_path) or "ksm"


def _clean_value(raw: str) -> str:
    return raw.strip().strip('"').strip("'")


def _run_ksm(args: list[str], env: Optional[dict[str, str]] = None) -> subprocess.CompletedProcess[str]:
    keeper_env = _build_keeper_env(env)
    return subprocess.run(
        [_ksm_binary(), *args],
        capture_output=True,
        text=True,
        env=keeper_env,
    )


def _resolve_bootstrap_token_file(env: dict[str, str]) -> Optional[Path]:
    configured = (env.get("KSM_BOOTSTRAP_TOKEN_FILE") or "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.exists():
            return candidate
        return None

    for candidate_str in DEFAULT_BOOTSTRAP_TOKEN_FILES:
        candidate = Path(candidate_str)
        if candidate.exists():
            return candidate
    return None


def _read_bootstrap_token(env: dict[str, str]) -> tuple[Optional[str], Optional[Path]]:
    token_file = _resolve_bootstrap_token_file(env)
    if token_file is None:
        return None, None
    token = _clean_value(token_file.read_text())
    if not token:
        return None, token_file
    return token, token_file


def _probe_keeper_profile(profile: str, env: Optional[dict[str, str]] = None) -> subprocess.CompletedProcess[str]:
    return _run_ksm(["-p", profile, "secret", "list", "--json"], env=env)


def ensure_keeper_profile_ready(profile: str) -> dict[str, str]:
    env = _build_keeper_env()
    if _KEEPER_READY_BY_PROFILE.get(profile):
        os.environ.update(env)
        os.environ["PA_KEEPER_RUNTIME_READY"] = "1"
        return env

    probe = _probe_keeper_profile(profile, env=env)
    if probe.returncode == 0:
        _KEEPER_READY_BY_PROFILE[profile] = True
        os.environ.update(env)
        os.environ["PA_KEEPER_RUNTIME_READY"] = "1"
        return env

    _run_ksm(["profile", "active", profile], env=env)
    probe = _probe_keeper_profile(profile, env=env)
    if probe.returncode == 0:
        _KEEPER_READY_BY_PROFILE[profile] = True
        os.environ.update(env)
        os.environ["PA_KEEPER_RUNTIME_READY"] = "1"
        return env

    bootstrap_token, token_file = _read_bootstrap_token(env)
    if bootstrap_token:
        _run_ksm(["profile", "init", "-p", profile, "-t", bootstrap_token], env=env)
        probe = _probe_keeper_profile(profile, env=env)
        if probe.returncode == 0:
            _KEEPER_READY_BY_PROFILE[profile] = True
            os.environ.update(env)
            os.environ["PA_KEEPER_RUNTIME_READY"] = "1"
            return env

    detail = probe.stderr.strip() or probe.stdout.strip() or "unknown Keeper error"
    source_note = f" bootstrap_file={token_file}" if token_file else ""
    raise KsmResolutionError(
        f"Keeper runtime is not ready for profile {profile!r}.{source_note} stderr={detail}"
    )


def _read_keeper_notation(notation: str, profile: str, description: str) -> str:
    env = ensure_keeper_profile_ready(profile)
    result = _run_ksm(["-p", profile, "secret", "notation", notation], env=env)
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
    keeper_error: KsmResolutionError | None = None
    if notation_env_var:
        notation = os.getenv(notation_env_var)
    if not notation and default_notation:
        notation = default_notation
    if notation:
        profile = os.getenv("KSM_PROFILE", default_profile or DEFAULT_PROFILE)
        try:
            return _read_keeper_notation(notation, profile, description)
        except KsmResolutionError as exc:
            keeper_error = exc

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

    message = f"No value found for {description}. Checked: {', '.join(missing_sources)}"
    if keeper_error is not None:
        message = f"{message}. Keeper attempt failed first: {keeper_error}"
    raise KsmResolutionError(message)


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
    profile = os.getenv("KSM_PROFILE", default_profile or DEFAULT_PROFILE)

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
