#!/usr/bin/env python3
"""Shared helpers for Captain fleet reporting and audits."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
API_DIR = ROOT / "apps" / "api"
WRANGLER_TOML = API_DIR / "wrangler.toml"
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
ACTIVATION_DIR = ROOT / "reports" / "captains_log" / "activation"

import sys
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(API_DIR / "scripts") not in sys.path:
    sys.path.insert(0, str(API_DIR / "scripts"))

from Data_Collection.utils.property_identity import PropertyIdentity, load_property_identities  # noqa: E402
from wrangler_auth import build_runtime_env, npx_wrangler_prefix  # noqa: E402


@dataclass(frozen=True)
class FleetContext:
    generated_on: date
    identities: dict[str, PropertyIdentity]
    manifest: dict[str, Any]


def today_ymd() -> str:
    return date.today().isoformat()


def load_latest_activation_manifest() -> dict[str, Any]:
    candidates = sorted(ACTIVATION_DIR.glob("captain_activation_roster_*.json"))
    if not candidates:
        raise FileNotFoundError("No Captain activation manifest found.")
    return json.loads(candidates[-1].read_text(encoding="utf-8"))


def build_fleet_context() -> FleetContext:
    identities = {identity.marketing_bi_property_id: identity for identity in load_property_identities()}
    return FleetContext(generated_on=date.today(), identities=identities, manifest=load_latest_activation_manifest())


def remote_d1_query(query: str) -> list[dict[str, Any]]:
    env = build_runtime_env()
    cmd = [
        *npx_wrangler_prefix(env),
        "d1",
        "execute",
        "pop-brief-db",
        "--remote",
        "--config",
        str(WRANGLER_TOML),
        "--json",
        "--command",
        query,
    ]
    result = subprocess.run(cmd, cwd=str(API_DIR), env=env, text=True, capture_output=True, timeout=180)
    if result.returncode != 0:
        raise RuntimeError(f"D1 query failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
    payload = json.loads(result.stdout)
    if not payload:
        return []
    return payload[0].get("results", []) or []


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if "T" in text:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    return date.fromisoformat(text)


def age_days(value: str | None, *, reference: date | None = None) -> int | None:
    parsed = parse_iso_date(value)
    if not parsed:
        return None
    ref = reference or date.today()
    return (ref - parsed).days


def freshness_band(age: int | None, *, current_days: int = 7, aging_days: int = 14) -> str:
    if age is None:
        return "missing"
    if age <= current_days:
        return "current"
    if age <= aging_days:
        return "aging"
    return "stale"
