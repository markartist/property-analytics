#!/usr/bin/env python3
"""
Wrangler authentication/runtime helpers for local D1 sync scripts.
"""

from __future__ import annotations

import glob
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from utils.ksm import KsmResolutionError, resolve_secret

DEFAULT_KSM_PROFILE = "marketingops"
DEFAULT_CLOUDFLARE_TOKEN_NOTATION = "keeper://sBtNdBG1I4n0mjvKcSC3MA/field/password"


def build_runtime_env() -> Dict[str, str]:
    """Build a launchd-safe env and inject Cloudflare auth when available."""
    env = os.environ.copy()
    existing = env.get("PATH", "")
    path_segments: List[str] = []

    for p in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Library/Frameworks/Python.framework/Versions/3.12/bin",
    ]:
        if Path(p).exists():
            path_segments.append(p)

    nvm_bins = sorted(glob.glob(str(Path.home() / ".nvm" / "versions" / "node" / "*" / "bin")))
    if nvm_bins:
        path_segments.append(nvm_bins[-1])

    if existing:
        path_segments.extend(existing.split(":"))

    deduped: List[str] = []
    seen = set()
    for seg in path_segments:
        seg = seg.strip()
        if seg and seg not in seen:
            seen.add(seg)
            deduped.append(seg)

    env["PATH"] = ":".join(deduped)
    env.setdefault("KSM_PROFILE", DEFAULT_KSM_PROFILE)
    env.setdefault("KSM_CLOUDFLARE_TOKEN_NOTATION", DEFAULT_CLOUDFLARE_TOKEN_NOTATION)

    if not env.get("CLOUDFLARE_API_TOKEN"):
        try:
            env["CLOUDFLARE_API_TOKEN"] = resolve_secret(
                description="Cloudflare API token",
                notation_env_var="KSM_CLOUDFLARE_TOKEN_NOTATION",
                default_notation=DEFAULT_CLOUDFLARE_TOKEN_NOTATION,
                direct_env_var="CLOUDFLARE_API_TOKEN",
                default_profile=DEFAULT_KSM_PROFILE,
            )
        except KsmResolutionError:
            pass

    return env


def npx_wrangler_prefix(env: Dict[str, str]) -> List[str]:
    """Return [npx, wrangler] using the resolved PATH."""
    npx_path = shutil.which("npx", path=env.get("PATH", "")) or "npx"
    return [npx_path, "wrangler"]
