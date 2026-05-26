#!/usr/bin/env python3
"""
Helpers for materializing Google Ads YAML config from Keeper.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class GoogleAdsKsmError(RuntimeError):
    """Raised when Google Ads config cannot be resolved from Keeper or file."""


def _ksm_binary() -> str:
    search_path = os.getenv("PATH", "")
    extra_segments = [
        "/Library/Frameworks/Python.framework/Versions/3.12/bin",
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    merged_path = ":".join(seg for seg in [*extra_segments, search_path] if seg)
    return shutil.which("ksm", path=merged_path) or "ksm"


def _record_json(uid: str, profile: str) -> dict[str, Any]:
    result = subprocess.run(
        [_ksm_binary(), "-p", profile, "secret", "get", "-u", uid, "--json"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise GoogleAdsKsmError(
            f"Keeper lookup failed for Google Ads config. uid={uid!r} stderr={result.stderr.strip()}"
        )

    data = json.loads(result.stdout)
    return data[0] if isinstance(data, list) else data


def _field_value(record: dict[str, Any], field_type: str) -> str:
    for field in record.get("fields", []):
        if field.get("type") == field_type:
            values = field.get("value") or []
            if values:
                return str(values[0]).strip()
    return ""


def _custom_value(record: dict[str, Any], label: str) -> str:
    for field in record.get("custom", []):
        if field.get("label") == label:
            values = field.get("value") or []
            if values:
                return str(values[0]).strip()
    return ""


def materialize_google_ads_yaml(
    *,
    uid_env_var: str = "KSM_GOOGLE_ADS_CONFIG_UID",
    default_profile: str = "marketingops",
    default_uid: str | None = None,
    file_fallback: str = "/Users/mark/Property_Analytics/Portfolio_Monitoring/google-ads.yaml",
) -> Path:
    """
    Build a temporary google-ads.yaml from Keeper, falling back to an existing file.
    """
    uid = os.getenv(uid_env_var) or default_uid
    if not uid:
        fallback = Path(file_fallback)
        if fallback.exists():
            return fallback
        raise GoogleAdsKsmError(
            f"{uid_env_var} is not set and fallback Google Ads config is missing: {fallback}"
        )

    profile = os.getenv("KSM_PROFILE", default_profile)
    record = _record_json(uid, profile)

    developer_token = _custom_value(record, "developer_token")
    client_id = _field_value(record, "login")
    client_secret = _field_value(record, "password")
    refresh_token = _custom_value(record, "refresh_token")
    login_customer_id = _custom_value(record, "login_customer_id")
    use_proto_plus = _custom_value(record, "use_proto_plus") or "True"

    missing = [
        name
        for name, value in [
            ("developer_token", developer_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("refresh_token", refresh_token),
            ("login_customer_id", login_customer_id),
        ]
        if not value
    ]
    if missing:
        raise GoogleAdsKsmError(f"Google Ads Keeper record is missing required values: {', '.join(missing)}")

    text = (
        "# Materialized from Keeper Secrets Manager\n"
        f"developer_token: {developer_token}\n\n"
        f"client_id: {client_id}\n"
        f"client_secret: {client_secret}\n"
        f"refresh_token: {refresh_token}\n\n"
        f"login_customer_id: {login_customer_id}\n"
        f"use_proto_plus: {use_proto_plus}\n"
    )

    handle = tempfile.NamedTemporaryFile(
        mode="w",
        prefix="google-ads-",
        suffix=".yaml",
        delete=False,
    )
    with handle:
        handle.write(text)
    return Path(handle.name)
