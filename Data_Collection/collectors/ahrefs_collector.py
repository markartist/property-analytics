#!/usr/bin/env python3
"""Ahrefs API collector for governed Data Pond SEO and website intelligence."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sqlite3
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import date, datetime, time as dt_time, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
import yaml

UTC = timezone.utc

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from utils.ahrefs_auth import resolve_ahrefs_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "config" / "ahrefs.yaml"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0060_create_ahrefs_tables.sql"
API_BASE_URL = "https://api.ahrefs.com/v3"


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def bool_int(value: Any) -> int | None:
    if value is None:
        return None
    return 1 if bool(value) else 0


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def error_class(payload: dict[str, Any] | None) -> str | None:
    if not isinstance(payload, dict):
        return None
    if payload.get("error"):
        return str(payload["error"])[:500]
    errors = payload.get("errors")
    if isinstance(errors, list) and errors:
        return "; ".join(str(item) for item in errors[:3])[:500]
    return None


def target_candidates(project: dict[str, Any]) -> list[str]:
    raw_url = str(project.get("url") or "").strip()
    project_name = str(project.get("project_name") or project.get("name") or "").strip()
    parsed_host = ""
    if raw_url:
        candidate = raw_url if "://" in raw_url else f"https://{raw_url}"
        parsed = urlparse(candidate)
        parsed_host = parsed.netloc or parsed.path.split("/")[0]
    candidates = [
        project_name,
        raw_url,
        f"https://{raw_url}" if raw_url else "",
        f"https://www.{raw_url}" if raw_url and not raw_url.startswith("www.") else "",
        parsed_host,
        f"https://{parsed_host}/" if parsed_host else "",
        f"https://www.{parsed_host}/" if parsed_host and not parsed_host.startswith("www.") else "",
    ]
    return [candidate for candidate in candidates if candidate]


def resolve_project_identity(project: dict[str, Any]) -> tuple[str | None, str | None, str | None, str | None]:
    for candidate in target_candidates(project):
        identity = resolve_property_identity(candidate)
        if identity:
            return (
                identity.marketing_bi_property_id,
                identity.community_id,
                identity.property_name,
                f"property_identity_matrix:{candidate}",
            )
    return None, None, None, None


@dataclass
class AhrefsCollectionResult:
    projects_seen: int = 0
    projects_upserted: int = 0
    site_audit_rows_upserted: int = 0
    web_analytics_rows_upserted: int = 0
    gsc_rows_upserted: int = 0
    domain_rating_rows_upserted: int = 0
    subscription_snapshots_upserted: int = 0
    requests_made: int = 0
    projects_failed: int = 0
    skipped: bool = False
    errors: list[str] = field(default_factory=list)

    @property
    def rows_written(self) -> int:
        return (
            self.projects_upserted
            + self.site_audit_rows_upserted
            + self.web_analytics_rows_upserted
            + self.gsc_rows_upserted
            + self.domain_rating_rows_upserted
            + self.subscription_snapshots_upserted
        )


class AhrefsCollector:
    """Collect free Ahrefs API source facts into the canonical SQLite pond."""

    def __init__(
        self,
        *,
        db_path: Path = DB_PATH,
        config_path: Path = CONFIG_PATH,
        logger: logging.Logger | None = None,
    ) -> None:
        self.db_path = Path(db_path)
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.base_url = str(self.config.get("api_base_url") or API_BASE_URL).rstrip("/")
        collection = self.config.get("collection") or {}
        self.timeout_seconds = int(collection.get("timeout_seconds", 30))
        self.max_retries = int(collection.get("max_retries", 2))
        self.rate_limit_sleep_seconds = float(
            os.getenv("AHREFS_RATE_LIMIT_SLEEP_SECONDS", collection.get("rate_limit_sleep_seconds", 1.1))
        )
        self.session: requests.Session | None = None
        self.logger = logger or self._build_logger()

    def _load_config(self) -> dict[str, Any]:
        if not self.config_path.exists():
            return {"enabled": False, "collection": {}}
        with self.config_path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}

    def _build_logger(self) -> logging.Logger:
        logger = logging.getLogger("ahrefs_collector")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = ROOT / "Data_Collection" / "logs"
        try:
            log_dir.mkdir(parents=True, exist_ok=True)
            handler = logging.FileHandler(log_dir / "ahrefs_collector.log")
        except OSError:
            fallback_dir = Path(tempfile.gettempdir()) / "property_analytics_logs"
            fallback_dir.mkdir(parents=True, exist_ok=True)
            handler = logging.FileHandler(fallback_dir / "ahrefs_collector.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    def enabled(self) -> bool:
        return bool(self.config.get("enabled", False))

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        credentials = resolve_ahrefs_credentials()
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "User-Agent": "PropertyAnalytics-AhrefsConnector/1.0",
            }
        )
        self.session = session

    def _request(self, path: str, params: dict[str, Any] | None = None) -> tuple[int, dict[str, Any] | None]:
        self._ensure_session()
        assert self.session is not None
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.get(url, params=params or {}, timeout=self.timeout_seconds)
                if response.status_code == 429 and attempt < self.max_retries:
                    retry_after = response.headers.get("retry-after")
                    try:
                        delay = float(retry_after) if retry_after else max(self.rate_limit_sleep_seconds, 5.0)
                    except ValueError:
                        delay = max(self.rate_limit_sleep_seconds, 5.0)
                    self.logger.warning("Ahrefs rate limited on %s; sleeping %.0fs", path, delay)
                    time.sleep(delay)
                    continue
                payload = response.json() if response.content else None
                if response.status_code >= 500 and attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                if self.rate_limit_sleep_seconds:
                    time.sleep(self.rate_limit_sleep_seconds)
                return response.status_code, payload
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
        raise RuntimeError(f"GET {path} failed: {last_error}") from last_error

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=120)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 120000")
        conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))
        return conn

    def _upsert(self, conn: sqlite3.Connection, table: str, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        columns = list(rows[0].keys())
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(f"{column}=excluded.{column}" for column in columns if column not in {"collected_at"})
        if table == "ahrefs_projects":
            conflict = "project_id"
        elif table == "ahrefs_subscription_usage_snapshots":
            conflict = "snapshot_date"
        elif table == "ahrefs_site_audit_project_health":
            conflict = "snapshot_date, project_id"
        elif table in {"ahrefs_web_analytics_daily", "ahrefs_gsc_daily_summary"}:
            conflict = "metric_date, project_id"
        elif table == "ahrefs_domain_rating_snapshots":
            conflict = "snapshot_date, target_url"
        else:
            raise ValueError(f"Unsupported Ahrefs table: {table}")
        conn.executemany(
            f"""
            INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})
            ON CONFLICT({conflict}) DO UPDATE SET {updates}
            """,
            [[row.get(column) for column in columns] for row in rows],
        )
        return len(rows)

    def _project_row(self, project: dict[str, Any]) -> dict[str, Any]:
        property_id, community_id, property_name, match_source = resolve_project_identity(project)
        return {
            "project_id": str(project.get("project_id") or project.get("id")),
            "project_name": project.get("project_name") or project.get("name"),
            "target_url": project.get("url"),
            "mode": project.get("mode"),
            "protocol": project.get("protocol"),
            "access_scope": project.get("access"),
            "verified": bool_int(project.get("verified")),
            "keyword_count": as_int(project.get("keyword_count")),
            "has_web_analytics_key": bool_int(bool(project.get("web_analytics_data_key"))),
            "property_id": property_id,
            "community_id": community_id,
            "property_name": property_name,
            "identity_match_source": match_source,
            "raw_json": json_dumps(project),
            "updated_at": utc_timestamp(),
        }

    def _subscription_row(self, snapshot_date: date, collection_id: int | None, payload: dict[str, Any]) -> dict[str, Any]:
        limits = payload.get("limits_and_usage") or {}
        return {
            "snapshot_date": snapshot_date.isoformat(),
            "collection_id": collection_id,
            "subscription": limits.get("subscription"),
            "units_limit_api_key": as_int(limits.get("units_limit_api_key")),
            "units_limit_workspace": as_int(limits.get("units_limit_workspace")),
            "units_usage_api_key": as_int(limits.get("units_usage_api_key")),
            "units_usage_workspace": as_int(limits.get("units_usage_workspace")),
            "api_key_expiration_date": limits.get("api_key_expiration_date"),
            "usage_reset_date": limits.get("usage_reset_date"),
            "raw_json": json_dumps(payload),
            "updated_at": utc_timestamp(),
        }

    def _site_audit_rows(
        self,
        snapshot_date: date,
        collection_id: int | None,
        healthscores: list[dict[str, Any]],
        project_rows: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        rows = []
        for item in healthscores:
            project_id = str(item.get("project_id") or "")
            project = project_rows.get(project_id, {})
            rows.append(
                {
                    "snapshot_date": snapshot_date.isoformat(),
                    "project_id": project_id,
                    "collection_id": collection_id,
                    "project_name": item.get("project_name") or project.get("project_name"),
                    "target_url": item.get("target_url") or project.get("target_url"),
                    "property_id": project.get("property_id"),
                    "community_id": project.get("community_id"),
                    "property_name": project.get("property_name"),
                    "health_score": as_float(item.get("health_score")),
                    "status": item.get("status"),
                    "last_crawl_date": item.get("date"),
                    "total_urls": as_int(item.get("total")),
                    "urls_with_errors": as_int(item.get("urls_with_errors")),
                    "urls_with_warnings": as_int(item.get("urls_with_warnings")),
                    "urls_with_notices": as_int(item.get("urls_with_notices")),
                    "raw_json": json_dumps(item),
                    "updated_at": utc_timestamp(),
                }
            )
        return rows

    def _web_analytics_row(
        self,
        *,
        metric_date: date,
        collection_id: int | None,
        project: dict[str, Any],
        window_start: str,
        window_end: str,
        status_code: int,
        payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        stats = (payload or {}).get("stats") if status_code < 400 else None
        ok = status_code < 400 and isinstance(stats, dict)
        return {
            "metric_date": metric_date.isoformat(),
            "project_id": project["project_id"],
            "collection_id": collection_id,
            "project_name": project.get("project_name"),
            "target_url": project.get("target_url"),
            "property_id": project.get("property_id"),
            "community_id": project.get("community_id"),
            "property_name": project.get("property_name"),
            "window_start": window_start,
            "window_end": window_end,
            "visits": as_int(stats.get("visits")) if ok else None,
            "visitors": as_int(stats.get("visitors")) if ok else None,
            "pageviews": as_int(stats.get("pageviews")) if ok else None,
            "avg_session_duration_sec": as_float(stats.get("avg_session_duration_sec") or stats.get("avg_session_length")) if ok else None,
            "bounce_rate": as_float(stats.get("session_bounce_rate") or stats.get("bounce_rate")) if ok else None,
            "collection_status": "ok" if ok else "error",
            "error_message": None if ok else error_class(payload) or f"Ahrefs status {status_code}",
            "raw_json": json_dumps(payload),
            "updated_at": utc_timestamp(),
        }

    def _gsc_row(
        self,
        *,
        metric_date: date,
        collection_id: int | None,
        project: dict[str, Any],
        status_code: int,
        payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        metrics = (payload or {}).get("metrics") if status_code < 400 else None
        ok = status_code < 400 and isinstance(metrics, list)
        clicks = sum(as_int(row.get("clicks")) or 0 for row in metrics or [])
        impressions = sum(as_int(row.get("impressions")) or 0 for row in metrics or [])
        weighted_position = None
        if impressions:
            weighted_position = sum((as_float(row.get("position")) or 0.0) * (as_int(row.get("impressions")) or 0) for row in metrics or []) / impressions
        return {
            "metric_date": metric_date.isoformat(),
            "project_id": project["project_id"],
            "collection_id": collection_id,
            "project_name": project.get("project_name"),
            "target_url": project.get("target_url"),
            "property_id": project.get("property_id"),
            "community_id": project.get("community_id"),
            "property_name": project.get("property_name"),
            "clicks": clicks if ok else None,
            "impressions": impressions if ok else None,
            "ctr": (clicks / impressions) if ok and impressions else None,
            "avg_position": weighted_position if ok else None,
            "row_count": len(metrics) if ok else 0,
            "collection_status": "ok" if ok else "no_data" if error_class(payload) == "No GSC data available for the requested date range" else "error",
            "error_message": None if ok else error_class(payload) or f"Ahrefs status {status_code}",
            "raw_json": json_dumps(payload),
            "updated_at": utc_timestamp(),
        }

    def _domain_rating_row(
        self,
        *,
        snapshot_date: date,
        collection_id: int | None,
        project: dict[str, Any],
        status_code: int,
        payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        data = (payload or {}).get("domain_rating") if status_code < 400 else None
        ok = status_code < 400 and isinstance(data, dict)
        return {
            "snapshot_date": snapshot_date.isoformat(),
            "target_url": project.get("target_url") or project["project_id"],
            "project_id": project["project_id"],
            "collection_id": collection_id,
            "project_name": project.get("project_name"),
            "property_id": project.get("property_id"),
            "community_id": project.get("community_id"),
            "property_name": project.get("property_name"),
            "domain_rating": as_float(data.get("domain_rating")) if ok else None,
            "has_license": bool_int(data.get("license")) if ok else None,
            "warning_message": data.get("warning") if ok else None,
            "collection_status": "ok" if ok else "error",
            "error_message": None if ok else error_class(payload) or f"Ahrefs status {status_code}",
            "raw_json": json_dumps(payload),
            "updated_at": utc_timestamp(),
        }

    @staticmethod
    def _window_for_metric_date(metric_date: date) -> tuple[str, str]:
        start = datetime.combine(metric_date, dt_time.min, tzinfo=UTC)
        end = start + timedelta(days=1)
        return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")

    def collect(
        self,
        *,
        collection_date: date | None = None,
        collection_id: int | None = None,
        discovery_only: bool = False,
        max_projects: int | None = None,
    ) -> AhrefsCollectionResult:
        result = AhrefsCollectionResult()
        if not self.enabled():
            result.skipped = True
            return result

        collection = self.config.get("collection") or {}
        metric_date = collection_date or date.today()
        if bool(collection.get("use_previous_day_window", True)) and collection_date is None:
            metric_date = date.today() - timedelta(days=1)
        snapshot_date = metric_date
        window_start, window_end = self._window_for_metric_date(metric_date)
        max_projects = int(collection.get("max_projects", 0)) if max_projects is None else max_projects

        with self._connect() as conn:
            if bool(collection.get("collect_subscription_usage", True)):
                status_code, payload = self._request("/subscription-info/limits-and-usage")
                result.requests_made += 1
                if status_code >= 400 or not payload:
                    raise RuntimeError(error_class(payload) or f"Ahrefs subscription endpoint returned {status_code}")
                result.subscription_snapshots_upserted += self._upsert(
                    conn,
                    "ahrefs_subscription_usage_snapshots",
                    [self._subscription_row(snapshot_date, collection_id, payload)],
                )

            status_code, payload = self._request("/management/projects")
            result.requests_made += 1
            if status_code >= 400 or not payload:
                raise RuntimeError(error_class(payload) or f"Ahrefs projects endpoint returned {status_code}")
            projects = payload.get("projects") or []
            if not isinstance(projects, list):
                projects = []
            if max_projects and max_projects > 0:
                projects = projects[:max_projects]
            result.projects_seen = len(projects)
            project_rows = [self._project_row(project) for project in projects]
            result.projects_upserted += self._upsert(conn, "ahrefs_projects", project_rows)
            project_by_id = {row["project_id"]: row for row in project_rows}

            if discovery_only:
                conn.commit()
                return result

            if bool(collection.get("collect_site_audit", True)):
                status_code, payload = self._request("/site-audit/projects")
                result.requests_made += 1
                if status_code < 400 and payload:
                    healthscores = payload.get("healthscores") or []
                    result.site_audit_rows_upserted += self._upsert(
                        conn,
                        "ahrefs_site_audit_project_health",
                        self._site_audit_rows(snapshot_date, collection_id, healthscores, project_by_id),
                    )
                else:
                    result.errors.append(error_class(payload) or f"site-audit/projects returned {status_code}")

            total_projects = len(project_rows)
            for index, project in enumerate(project_rows, 1):
                project_id = project["project_id"]
                if index == 1 or index == total_projects or index % 10 == 0:
                    self.logger.info("Ahrefs project progress: %s/%s (%s)", index, total_projects, project.get("project_name") or project_id)
                if bool(collection.get("collect_web_analytics", True)):
                    status_code, payload = self._request(
                        "/web-analytics/stats",
                        {"project_id": project_id, "from": window_start, "to": window_end},
                    )
                    result.requests_made += 1
                    result.web_analytics_rows_upserted += self._upsert(
                        conn,
                        "ahrefs_web_analytics_daily",
                        [
                            self._web_analytics_row(
                                metric_date=metric_date,
                                collection_id=collection_id,
                                project=project,
                                window_start=window_start,
                                window_end=window_end,
                                status_code=status_code,
                                payload=payload,
                            )
                        ],
                    )

                if bool(collection.get("collect_gsc_insights", True)):
                    status_code, payload = self._request(
                        "/gsc/performance-history",
                        {
                            "project_id": project_id,
                            "date_from": metric_date.isoformat(),
                            "date_to": metric_date.isoformat(),
                            "history_grouping": "daily",
                            "search_type": "web",
                        },
                    )
                    result.requests_made += 1
                    result.gsc_rows_upserted += self._upsert(
                        conn,
                        "ahrefs_gsc_daily_summary",
                        [
                            self._gsc_row(
                                metric_date=metric_date,
                                collection_id=collection_id,
                                project=project,
                                status_code=status_code,
                                payload=payload,
                            )
                        ],
                    )

                if bool(collection.get("collect_domain_rating", True)):
                    status_code, payload = self._request(
                        "/public/domain-rating-free",
                        {"target": project.get("target_url") or project_id},
                    )
                    result.requests_made += 1
                    result.domain_rating_rows_upserted += self._upsert(
                        conn,
                        "ahrefs_domain_rating_snapshots",
                        [
                            self._domain_rating_row(
                                snapshot_date=snapshot_date,
                                collection_id=collection_id,
                                project=project,
                                status_code=status_code,
                                payload=payload,
                            )
                        ],
                    )
            conn.commit()
        return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect Ahrefs source facts into Data Pond.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--date", help="Metric/snapshot date to collect, in YYYY-MM-DD. Defaults to yesterday.")
    parser.add_argument("--discovery-only", action="store_true")
    parser.add_argument("--max-projects", type=int)
    args = parser.parse_args()

    started_at = datetime.now()
    started_at_value = started_at.isoformat(sep=" ", timespec="seconds")
    collector = AhrefsCollector(db_path=Path(args.db), config_path=Path(args.config))
    collection = collector.config.get("collection") or {}
    collection_date = date.fromisoformat(args.date) if args.date else None
    metric_date = collection_date
    if metric_date is None:
        metric_date = date.today() - timedelta(days=1) if bool(collection.get("use_previous_day_window", True)) else date.today()
    collection_id: int | None = None
    with sqlite3.connect(str(args.db)) as conn:
        cursor = conn.execute(
            """
            INSERT INTO data_collections (
                collection_date,
                collection_type,
                data_source,
                started_at,
                status
            )
            VALUES (?, 'daily', 'ahrefs', ?, 'in_progress')
            """,
            (metric_date.isoformat(), started_at_value),
        )
        collection_id = int(cursor.lastrowid)
        conn.commit()

    try:
        result = collector.collect(
            collection_date=collection_date,
            collection_id=collection_id,
            discovery_only=args.discovery_only,
            max_projects=args.max_projects,
        )
    except Exception as exc:
        completed_at = datetime.now()
        completed_at_value = completed_at.isoformat(sep=" ", timespec="seconds")
        with sqlite3.connect(str(args.db)) as conn:
            conn.execute(
                """
                UPDATE data_collections
                SET completed_at = ?,
                    status = 'partial',
                    properties_collected = 0,
                    properties_total = 1,
                    properties_success = 0,
                    properties_failed = 1,
                    duration_seconds = ?,
                    api_calls_failed = 1,
                    error_message = ?,
                    notes = 'Ahrefs failed gracefully; standalone collector closed its collection record.'
                WHERE collection_id = ?
                """,
                (
                    completed_at_value,
                    (completed_at - started_at).total_seconds(),
                    str(exc)[:500],
                    collection_id,
                ),
            )
            conn.commit()
        raise
    completed_at = datetime.now()
    completed_at_value = completed_at.isoformat(sep=" ", timespec="seconds")
    status = "completed"
    if result.skipped:
        status = "completed"
    elif result.errors:
        status = "partial"
    with sqlite3.connect(str(args.db)) as conn:
        conn.execute(
            """
            UPDATE data_collections
            SET completed_at = ?,
                status = ?,
                properties_collected = ?,
                properties_total = ?,
                properties_success = ?,
                properties_failed = ?,
                properties_skipped = ?,
                duration_seconds = ?,
                api_calls_total = ?,
                api_calls_failed = ?,
                error_message = ?,
                notes = ?
            WHERE collection_id = ?
            """,
            (
                completed_at_value,
                status,
                result.rows_written,
                result.projects_seen,
                result.rows_written,
                len(result.errors),
                1 if result.skipped else 0,
                (completed_at - started_at).total_seconds(),
                result.requests_made,
                len(result.errors),
                "; ".join(result.errors[:3]) if result.errors else None,
                (
                    "Ahrefs collector skipped by configuration."
                    if result.skipped
                    else (
                        f"Ahrefs collected free-endpoint source facts: {result.projects_seen} projects, "
                        f"{result.requests_made} API requests, {result.rows_written} rows upserted."
                    )
                ),
                collection_id,
            ),
        )
        conn.commit()
    print(json.dumps(result.__dict__ | {"rows_written": result.rows_written}, indent=2, sort_keys=True))
    if result.errors and result.rows_written == 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
