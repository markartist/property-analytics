#!/usr/bin/env python3
"""Canonical property identity resolver for Data Pond source ingestion.

This module is intentionally small and dependency-light so collectors can use it
before any richer app/runtime layer is available.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
IDENTITY_MATRIX_PATH = ROOT / "config" / "property_identity_matrix.json"


@dataclass(frozen=True)
class PropertyIdentity:
    canonical_property_id: str
    display_property_id: str
    property_code: str | None
    community_id: str | None
    ga4_property_id: str | None
    gsc_url: str | None
    website_url: str | None
    property_name: str
    community_name: str | None
    encasa_short_name: str | None
    encasa_region: str | None
    city: str | None
    state: str | None
    company_id: int | None
    gbp_location_id: str | None
    unit_count: int | None
    apartmentiq_property_ids: tuple[str, ...]
    aliases: tuple[str, ...]

    @property
    def marketing_bi_property_id(self) -> str:
        """Property id to store for BI/Captain-facing rows."""
        return self.property_code or self.ga4_property_id or self.canonical_property_id

    def as_mapping(self, match_source: str = "property_identity_matrix") -> dict[str, Any]:
        return {
            "canonical_property_id": self.canonical_property_id,
            "property_id": self.marketing_bi_property_id,
            "display_property_id": self.display_property_id,
            "property_code": self.property_code,
            "community_id": self.community_id,
            "ga4_property_id": self.ga4_property_id,
            "gsc_url": self.gsc_url,
            "website_url": self.website_url,
            "canonical_name": self.property_name,
            "property_name": self.property_name,
            "community_name": self.community_name,
            "encasa_short_name": self.encasa_short_name,
            "encasa_region": self.encasa_region,
            "city": self.city,
            "state": self.state,
            "company_id": self.company_id,
            "gbp_location_id": self.gbp_location_id,
            "unit_count": self.unit_count,
            "apartmentiq_property_ids": list(self.apartmentiq_property_ids),
            "match_source": match_source,
        }


def normalize_property_key(value: str | None) -> str:
    if not value:
        return ""
    text = value.lower()
    text = re.sub(r"\b(apartments|apartment|at|the)\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _identity_from_row(row: dict[str, Any]) -> PropertyIdentity:
    aliases = tuple(str(value) for value in row.get("aliases", []) if value)
    return PropertyIdentity(
        canonical_property_id=str(row["canonical_property_id"]),
        display_property_id=str(row.get("display_property_id") or row["canonical_property_id"]),
        property_code=row.get("property_code"),
        community_id=row.get("community_id"),
        ga4_property_id=row.get("ga4_property_id"),
        gsc_url=row.get("gsc_url"),
        website_url=row.get("website_url"),
        property_name=str(row["property_name"]),
        community_name=row.get("community_name"),
        encasa_short_name=row.get("encasa_short_name"),
        encasa_region=row.get("encasa_region"),
        city=row.get("city"),
        state=row.get("state"),
        company_id=row.get("company_id"),
        gbp_location_id=row.get("gbp_location_id"),
        unit_count=row.get("unit_count"),
        apartmentiq_property_ids=tuple(str(value) for value in row.get("apartmentiq_property_ids", []) if value),
        aliases=aliases,
    )


@lru_cache(maxsize=1)
def load_property_identities(matrix_path: str | Path = IDENTITY_MATRIX_PATH) -> tuple[PropertyIdentity, ...]:
    raw = json.loads(Path(matrix_path).read_text(encoding="utf-8"))
    return tuple(_identity_from_row(row) for row in raw.get("properties", []))


@lru_cache(maxsize=1)
def build_property_identity_lookup(matrix_path: str | Path = IDENTITY_MATRIX_PATH) -> dict[str, PropertyIdentity]:
    lookup: dict[str, PropertyIdentity] = {}
    for identity in load_property_identities(matrix_path):
        keys = {
            identity.canonical_property_id,
            identity.display_property_id,
            identity.property_code,
            identity.ga4_property_id,
            identity.gsc_url,
            identity.website_url,
            identity.property_name,
            identity.community_name,
            identity.encasa_short_name,
            *(f"apartmentiq:{source_id}" for source_id in identity.apartmentiq_property_ids),
            *(f"aptiq:{source_id}" for source_id in identity.apartmentiq_property_ids),
            *identity.aliases,
        }
        for key in keys:
            normalized = normalize_property_key(str(key)) if key else ""
            if normalized:
                lookup.setdefault(normalized, identity)
    return lookup


def resolve_property_identity(value: str, matrix_path: str | Path = IDENTITY_MATRIX_PATH) -> PropertyIdentity | None:
    key = normalize_property_key(value)
    if not key:
        return None
    lookup = build_property_identity_lookup(matrix_path)
    if key in lookup:
        return lookup[key]
    matches = [identity for alias, identity in lookup.items() if f" {key} " in f" {alias} "]
    unique = {identity.canonical_property_id: identity for identity in matches}
    if len(unique) == 1:
        return next(iter(unique.values()))
    return None
