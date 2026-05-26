#!/usr/bin/env python3
"""Local registry and observation utilities for website copy-change monitoring."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

ROOT = Path("/Users/mark/Property_Analytics")

from property_identity import PropertyIdentity, resolve_property_identity  # noqa: E402


DEFAULT_APRIL_17_PROPERTIES = [
    "Fairways at South Shore",
    "Townhomes at Lake Park",
    "The Pointe Bentonville",
    "Elation at Grandway West",
    "The Anatole",
    "Forest View",
]


@dataclass(frozen=True)
class CopyChangeIntervention:
    intervention_id: str
    wave_id: str
    wave_name: str
    wave_status: str
    property_code: str
    canonical_property_id: str
    ga4_property_id: str
    community_id: str | None
    property_name: str
    page_url: str | None
    page_path: str | None
    page_type: str
    publish_timestamp: str
    first_full_post_day: str
    change_type: str
    changed_fields: tuple[str, ...]
    target_queries: tuple[str, ...]
    hypothesis: str | None
    owner: str | None
    status: str
    confounds: dict[str, Any]


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in value).strip("_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned or "copy_change"


def infer_first_full_post_day(publish_timestamp: str) -> str:
    day = datetime.fromisoformat(publish_timestamp.replace("Z", "+00:00")).date()
    return (day + timedelta(days=1)).isoformat()


def infer_page_path(page_url: str | None) -> str | None:
    if not page_url:
        return None
    parsed = urlparse(page_url)
    return parsed.path or "/"


def ensure_copy_change_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS copy_change_waves (
            wave_id TEXT PRIMARY KEY,
            wave_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            change_date TEXT NOT NULL,
            default_first_full_post_day TEXT NOT NULL,
            owner TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_copy_change_waves_status
          ON copy_change_waves(status, change_date);

        CREATE TABLE IF NOT EXISTS copy_change_interventions (
            intervention_id TEXT PRIMARY KEY,
            wave_id TEXT NOT NULL,
            property_code TEXT NOT NULL,
            canonical_property_id TEXT NOT NULL,
            ga4_property_id TEXT NOT NULL,
            community_id TEXT,
            property_name TEXT NOT NULL,
            page_url TEXT,
            page_path TEXT,
            page_type TEXT NOT NULL DEFAULT 'property_homepage',
            publish_timestamp TEXT NOT NULL,
            first_full_post_day TEXT NOT NULL,
            change_type TEXT NOT NULL DEFAULT 'copy_refresh',
            changed_fields_json TEXT NOT NULL DEFAULT '[]',
            target_queries_json TEXT NOT NULL DEFAULT '[]',
            old_content_json TEXT,
            new_content_json TEXT,
            hypothesis TEXT,
            owner TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            confounds_json TEXT NOT NULL DEFAULT '{}',
            source_system TEXT NOT NULL DEFAULT 'copy_change_monitoring',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (wave_id) REFERENCES copy_change_waves(wave_id),
            UNIQUE (wave_id, property_code, page_url)
        );

        CREATE INDEX IF NOT EXISTS idx_copy_change_interventions_active
          ON copy_change_interventions(status, first_full_post_day);

        CREATE INDEX IF NOT EXISTS idx_copy_change_interventions_property
          ON copy_change_interventions(property_code, ga4_property_id);

        CREATE TABLE IF NOT EXISTS copy_change_observations (
            observation_id TEXT PRIMARY KEY,
            intervention_id TEXT NOT NULL,
            observation_date TEXT NOT NULL,
            window_label TEXT NOT NULL,
            metric_source TEXT NOT NULL,
            metric_scope TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            current_value REAL,
            prior_value REAL,
            delta_abs REAL,
            delta_pct REAL,
            current_window_start TEXT NOT NULL,
            current_window_end TEXT NOT NULL,
            prior_window_start TEXT NOT NULL,
            prior_window_end TEXT NOT NULL,
            evidence_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (intervention_id) REFERENCES copy_change_interventions(intervention_id),
            UNIQUE (
                intervention_id,
                observation_date,
                window_label,
                metric_source,
                metric_scope,
                metric_name
            )
        );

        CREATE INDEX IF NOT EXISTS idx_copy_change_observations_intervention
          ON copy_change_observations(intervention_id, observation_date, window_label);

        CREATE INDEX IF NOT EXISTS idx_copy_change_observations_metric
          ON copy_change_observations(metric_source, metric_scope, metric_name, observation_date);
        """
    )


def resolve_identity(value: str) -> PropertyIdentity:
    identity = resolve_property_identity(value)
    if not identity or not identity.ga4_property_id:
        raise RuntimeError(f"Unable to resolve governed property identity with GA4 id: {value}")
    return identity


def upsert_wave(
    conn: sqlite3.Connection,
    *,
    wave_id: str,
    wave_name: str,
    change_date: str,
    default_first_full_post_day: str | None = None,
    status: str = "active",
    owner: str | None = None,
    notes: str | None = None,
) -> None:
    first_day = default_first_full_post_day or (date.fromisoformat(change_date) + timedelta(days=1)).isoformat()
    conn.execute(
        """
        INSERT INTO copy_change_waves (
            wave_id, wave_name, status, change_date, default_first_full_post_day, owner, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(wave_id) DO UPDATE SET
            wave_name = excluded.wave_name,
            status = excluded.status,
            change_date = excluded.change_date,
            default_first_full_post_day = excluded.default_first_full_post_day,
            owner = COALESCE(excluded.owner, copy_change_waves.owner),
            notes = COALESCE(excluded.notes, copy_change_waves.notes),
            updated_at = datetime('now')
        """,
        (wave_id, wave_name, status, change_date, first_day, owner, notes),
    )


def upsert_intervention(
    conn: sqlite3.Connection,
    *,
    wave_id: str,
    property_name_or_id: str,
    publish_timestamp: str,
    page_url: str | None = None,
    first_full_post_day: str | None = None,
    page_type: str = "property_homepage",
    change_type: str = "copy_refresh",
    changed_fields: Iterable[str] = (),
    target_queries: Iterable[str] = (),
    old_content: dict[str, Any] | None = None,
    new_content: dict[str, Any] | None = None,
    hypothesis: str | None = None,
    owner: str | None = None,
    status: str = "active",
    confounds: dict[str, Any] | None = None,
    source_system: str = "copy_change_monitoring",
) -> str:
    identity = resolve_identity(property_name_or_id)
    resolved_page_url = page_url or identity.website_url
    property_code = identity.property_code or identity.ga4_property_id or identity.canonical_property_id
    first_day = first_full_post_day or infer_first_full_post_day(publish_timestamp)
    intervention_id = f"{wave_id}__{slugify(property_code)}__{slugify(resolved_page_url or page_type)}"
    conn.execute(
        """
        INSERT INTO copy_change_interventions (
            intervention_id, wave_id, property_code, canonical_property_id, ga4_property_id, community_id,
            property_name, page_url, page_path, page_type, publish_timestamp, first_full_post_day,
            change_type, changed_fields_json, target_queries_json, old_content_json, new_content_json,
            hypothesis, owner, status, confounds_json, source_system, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(intervention_id) DO UPDATE SET
            page_url = excluded.page_url,
            page_path = excluded.page_path,
            page_type = excluded.page_type,
            publish_timestamp = excluded.publish_timestamp,
            first_full_post_day = excluded.first_full_post_day,
            change_type = excluded.change_type,
            changed_fields_json = excluded.changed_fields_json,
            target_queries_json = excluded.target_queries_json,
            old_content_json = COALESCE(excluded.old_content_json, copy_change_interventions.old_content_json),
            new_content_json = COALESCE(excluded.new_content_json, copy_change_interventions.new_content_json),
            hypothesis = COALESCE(excluded.hypothesis, copy_change_interventions.hypothesis),
            owner = COALESCE(excluded.owner, copy_change_interventions.owner),
            status = excluded.status,
            confounds_json = excluded.confounds_json,
            source_system = excluded.source_system,
            updated_at = datetime('now')
        """,
        (
            intervention_id,
            wave_id,
            property_code,
            identity.canonical_property_id,
            identity.ga4_property_id,
            identity.community_id,
            identity.property_name,
            resolved_page_url,
            infer_page_path(resolved_page_url),
            page_type,
            publish_timestamp,
            first_day,
            change_type,
            json_dumps(list(changed_fields)),
            json_dumps(list(target_queries)),
            json_dumps(old_content) if old_content else None,
            json_dumps(new_content) if new_content else None,
            hypothesis,
            owner,
            status,
            json_dumps(confounds or {}),
            source_system,
        ),
    )
    return intervention_id


def seed_april_17_wave(conn: sqlite3.Connection) -> None:
    ensure_copy_change_schema(conn)
    upsert_wave(
        conn,
        wave_id="copy_wave_2026_04_17",
        wave_name="April 17, 2026 Copy Changes",
        change_date="2026-04-17",
        default_first_full_post_day="2026-04-18",
        status="active",
        owner="MarketingOps",
        notes="Seeded legacy cohort for the existing daily Copy Change Impact Brief.",
    )
    for property_name in DEFAULT_APRIL_17_PROPERTIES:
        identity = resolve_identity(property_name)
        resolved_page_url = identity.website_url
        property_code = identity.property_code or identity.ga4_property_id or identity.canonical_property_id
        intervention_id = f"copy_wave_2026_04_17__{slugify(property_code)}__{slugify(resolved_page_url or 'property_homepage')}"
        existing = conn.execute(
            "SELECT 1 FROM copy_change_interventions WHERE intervention_id = ?",
            (intervention_id,),
        ).fetchone()
        if existing:
            continue
        upsert_intervention(
            conn,
            wave_id="copy_wave_2026_04_17",
            property_name_or_id=property_name,
            publish_timestamp="2026-04-17T15:00:00-05:00",
            first_full_post_day="2026-04-18",
            change_type="copy_refresh",
            changed_fields=["legacy_tracked_copy_update"],
            status="active",
            source_system="seeded_legacy_copy_change_brief",
        )
    conn.commit()


def list_interventions(
    conn: sqlite3.Connection,
    *,
    wave_ids: Iterable[str] | None = None,
    statuses: Iterable[str] = ("active", "monitoring"),
) -> list[CopyChangeIntervention]:
    ensure_copy_change_schema(conn)
    params: list[Any] = []
    status_list = list(statuses)
    clauses = [f"cci.status IN ({','.join('?' for _ in status_list)})"]
    params.extend(status_list)
    if wave_ids:
        wave_list = list(wave_ids)
        clauses.append(f"cci.wave_id IN ({','.join('?' for _ in wave_list)})")
        params.extend(wave_list)
    rows = conn.execute(
        f"""
        SELECT
            cci.*,
            ccw.wave_name,
            ccw.status AS wave_status
        FROM copy_change_interventions cci
        INNER JOIN copy_change_waves ccw ON ccw.wave_id = cci.wave_id
        WHERE {' AND '.join(clauses)}
          AND ccw.status IN ('active', 'monitoring')
        ORDER BY ccw.change_date ASC, cci.property_name ASC
        """,
        params,
    ).fetchall()
    interventions: list[CopyChangeIntervention] = []
    for row in rows:
        mapping = dict(row)
        interventions.append(
            CopyChangeIntervention(
                intervention_id=mapping["intervention_id"],
                wave_id=mapping["wave_id"],
                wave_name=mapping["wave_name"],
                wave_status=mapping["wave_status"],
                property_code=mapping["property_code"],
                canonical_property_id=mapping["canonical_property_id"],
                ga4_property_id=mapping["ga4_property_id"],
                community_id=mapping["community_id"],
                property_name=mapping["property_name"],
                page_url=mapping["page_url"],
                page_path=mapping["page_path"],
                page_type=mapping["page_type"],
                publish_timestamp=mapping["publish_timestamp"],
                first_full_post_day=mapping["first_full_post_day"],
                change_type=mapping["change_type"],
                changed_fields=tuple(json_loads(mapping["changed_fields_json"], [])),
                target_queries=tuple(json_loads(mapping["target_queries_json"], [])),
                hypothesis=mapping["hypothesis"],
                owner=mapping["owner"],
                status=mapping["status"],
                confounds=json_loads(mapping["confounds_json"], {}),
            )
        )
    return interventions


def pct_change(curr: float | None, prev: float | None) -> float | None:
    if curr is None or prev in (None, 0):
        return None
    return ((curr - prev) / prev) * 100.0


def store_observation(
    conn: sqlite3.Connection,
    *,
    intervention_id: str,
    observation_date: str,
    window_label: str,
    metric_source: str,
    metric_scope: str,
    metric_name: str,
    current_value: float | None,
    prior_value: float | None,
    current_window_start: str,
    current_window_end: str,
    prior_window_start: str,
    prior_window_end: str,
    evidence: dict[str, Any] | None = None,
) -> None:
    delta_abs = None if current_value is None or prior_value is None else current_value - prior_value
    delta_pct = pct_change(current_value, prior_value)
    observation_id = "__".join(
        [
            intervention_id,
            observation_date,
            window_label,
            slugify(metric_source),
            slugify(metric_scope),
            slugify(metric_name),
        ]
    )
    conn.execute(
        """
        INSERT INTO copy_change_observations (
            observation_id, intervention_id, observation_date, window_label, metric_source, metric_scope,
            metric_name, current_value, prior_value, delta_abs, delta_pct, current_window_start,
            current_window_end, prior_window_start, prior_window_end, evidence_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(
            intervention_id, observation_date, window_label, metric_source, metric_scope, metric_name
        ) DO UPDATE SET
            current_value = excluded.current_value,
            prior_value = excluded.prior_value,
            delta_abs = excluded.delta_abs,
            delta_pct = excluded.delta_pct,
            current_window_start = excluded.current_window_start,
            current_window_end = excluded.current_window_end,
            prior_window_start = excluded.prior_window_start,
            prior_window_end = excluded.prior_window_end,
            evidence_json = excluded.evidence_json,
            updated_at = datetime('now')
        """,
        (
            observation_id,
            intervention_id,
            observation_date,
            window_label,
            metric_source,
            metric_scope,
            metric_name,
            current_value,
            prior_value,
            delta_abs,
            delta_pct,
            current_window_start,
            current_window_end,
            prior_window_start,
            prior_window_end,
            json_dumps(evidence or {}),
        ),
    )
