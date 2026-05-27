#!/usr/bin/env python3
"""
Helpers for preventing duplicate summary-email sends.
"""

from __future__ import annotations

import json
from pathlib import Path


def load_delivery_entries(path: Path) -> list[dict]:
    if not path.exists():
        return []

    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def successful_delivery_exists(path: Path, subject: str) -> bool:
    return any(
        row.get("success") is True and row.get("subject") == subject
        for row in load_delivery_entries(path)
    )
