#!/usr/bin/env python3
"""
Materialize Keeper file records to temporary local files.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class KeeperFileMaterializerError(RuntimeError):
    """Raised when a Keeper file record cannot be materialized."""


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
        raise KeeperFileMaterializerError(
            f"Keeper record lookup failed. uid={uid!r} stderr={result.stderr.strip()}"
        )
    data = json.loads(result.stdout)
    return data[0] if isinstance(data, list) else data


def materialize_keeper_file(
    *,
    uid_env_var: str,
    default_profile: str = "marketingops",
    fallback_path: str,
) -> Path:
    """
    Download the first file attachment from a Keeper record to a temp file.
    """
    uid = os.getenv(uid_env_var)
    if not uid:
        fallback = Path(fallback_path)
        if fallback.exists():
            return fallback
        raise KeeperFileMaterializerError(
            f"{uid_env_var} is not set and fallback path is missing: {fallback}"
        )

    profile = os.getenv("KSM_PROFILE", default_profile)
    record = _record_json(uid, profile)
    files = record.get("files") or []
    if not files:
        raise KeeperFileMaterializerError(f"Keeper record {uid!r} has no file attachments.")

    attachment = files[0]
    name = attachment.get("name") or attachment.get("title") or "keeper-file.bin"
    suffix = Path(name).suffix
    handle = tempfile.NamedTemporaryFile(
        prefix="keeper-file-",
        suffix=suffix,
        delete=False,
    )
    output_path = Path(handle.name)
    handle.close()

    result = subprocess.run(
        [
            _ksm_binary(),
            "-p",
            profile,
            "secret",
            "download",
            "-u",
            uid,
            "--file-uid",
            attachment["file_uid"],
            "--file-output",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise KeeperFileMaterializerError(
            f"Keeper file download failed. uid={uid!r} stderr={result.stderr.strip()}"
        )

    return output_path


def upload_keeper_file(
    *,
    uid_env_var: str,
    source_path: str | Path,
    default_profile: str = "marketingops",
) -> None:
    """
    Upload a local file to an existing Keeper file record.
    """
    uid = os.getenv(uid_env_var)
    if not uid:
        return

    profile = os.getenv("KSM_PROFILE", default_profile)
    src = Path(source_path)
    if not src.exists():
        raise KeeperFileMaterializerError(f"Upload source does not exist: {src}")

    result = subprocess.run(
        [
            _ksm_binary(),
            "-p",
            profile,
            "secret",
            "upload",
            "-u",
            uid,
            "--file",
            str(src),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise KeeperFileMaterializerError(
            f"Keeper file upload failed. uid={uid!r} stderr={result.stderr.strip()}"
        )
