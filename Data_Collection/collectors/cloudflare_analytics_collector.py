#!/usr/bin/env python3
"""
Cloudflare GraphQL edge-delivery analytics collector.

This collector stores source facts only. Rollups, alerts, dashboards, and
insights should consume the stored rows later instead of embedding conclusions
in the collection step.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests
import yaml

UTC = timezone.utc

_repo_root = str(Path(__file__).resolve().parents[2])
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.utils.property_identity import resolve_property_identity
from ops.cloudflare.cloudflare_auth import CloudflareAuthError, resolve_cloudflare_token


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
CLOUDFLARE_GRAPHQL_ENDPOINT = f"{CLOUDFLARE_API_BASE}/graphql"


def _utc_day_window(metric_date: date) -> tuple[str, str]:
    start = datetime.combine(metric_date, time.min, tzinfo=UTC)
    end = start + timedelta(days=1)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@dataclass
class HostnameConfig:
    hostname: str
    property_key: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None


@dataclass
class ZoneConfig:
    zone_id: Optional[str]
    zone_name: Optional[str]
    hostnames: List[HostnameConfig]


class CloudflareAnalyticsCollector:
    """Collect daily Cloudflare edge-delivery metrics for configured zones."""

    def __init__(
        self,
        *,
        config_path: Path,
        db: Optional[DatabaseManager] = None,
        db_path: Optional[Path] = None,
        logger: Optional[logging.Logger] = None,
    ):
        self.config_path = Path(config_path)
        self.config = self._load_config(self.config_path)
        self.db = db or DatabaseManager(db_path)
        self.logger = logger or self._build_logger()
        self.graphql_config = self.config.get("graphql", {})
        self.timeout_seconds = int(self.graphql_config.get("timeout_seconds", 30))
        self.max_retries = int(self.graphql_config.get("max_retries", 2))
        self.top_paths_limit = int(self.graphql_config.get("top_paths_limit", 25))
        self.session: Optional[requests.Session] = None
        self.token_source: Optional[str] = None

    @staticmethod
    def _load_config(config_path: Path) -> Dict[str, Any]:
        with config_path.open("r", encoding="utf-8") as handle:
            config = yaml.safe_load(handle) or {}
        config.setdefault("graphql", {})
        config["graphql"].setdefault("enabled", True)
        config["graphql"].setdefault("timeout_seconds", 30)
        config["graphql"].setdefault("max_retries", 2)
        config["graphql"].setdefault("use_previous_day_window", True)
        config["graphql"].setdefault("top_paths_limit", 25)
        config.setdefault("zones", [])
        return config

    def _build_logger(self) -> logging.Logger:
        logger = logging.getLogger("cloudflare_edge_analytics")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = Path(__file__).resolve().parents[2] / "Data_Collection" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_dir / "cloudflare_edge_analytics.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    def _ensure_session(self) -> bool:
        if self.session is not None:
            return True
        try:
            resolved = resolve_cloudflare_token()
        except CloudflareAuthError as exc:
            self.logger.warning("Cloudflare analytics skipped: %s", exc)
            return False

        session = requests.Session()
        session.headers.update(
            {
                "Authorization": f"Bearer {resolved.token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )
        self.session = session
        self.token_source = resolved.source
        return True

    def _post_graphql(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Cloudflare session has not been initialized")

        payload = {"query": query, "variables": variables}
        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 2):
            try:
                response = self.session.post(
                    CLOUDFLARE_GRAPHQL_ENDPOINT,
                    json=payload,
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                decoded = response.json()
                if decoded.get("errors"):
                    message = "; ".join(error.get("message", "unknown GraphQL error") for error in decoded["errors"])
                    raise RuntimeError(message)
                return decoded
            except Exception as exc:
                last_error = exc
                if attempt > self.max_retries:
                    break
        raise RuntimeError(str(last_error))

    def _rest_get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.session:
            raise RuntimeError("Cloudflare session has not been initialized")
        response = self.session.get(f"{CLOUDFLARE_API_BASE}{path}", params=params, timeout=self.timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success", False):
            errors = "; ".join(err.get("message", "unknown REST error") for err in payload.get("errors", []))
            raise RuntimeError(errors or f"Cloudflare REST request failed for {path}")
        return payload

    def _resolve_zone_id(self, zone: ZoneConfig) -> tuple[str, Optional[str]]:
        if zone.zone_id:
            zone_name = zone.zone_name
            if not zone_name:
                try:
                    payload = self._rest_get(f"/zones/{zone.zone_id}")
                    zone_name = (payload.get("result") or {}).get("name")
                except Exception as exc:
                    self.logger.warning("Could not resolve Cloudflare zone name for %s: %s", zone.zone_id, exc)
            return zone.zone_id, zone_name

        if not zone.zone_name:
            raise ValueError("Cloudflare zone entry requires zone_id or zone_name")
        payload = self._rest_get("/zones", params={"name": zone.zone_name, "status": "active", "per_page": 1})
        results = payload.get("result") or []
        if not results:
            raise RuntimeError(f"No active Cloudflare zone found for {zone.zone_name}")
        return results[0]["id"], results[0].get("name") or zone.zone_name

    def _configured_zones(self) -> List[ZoneConfig]:
        zones: List[ZoneConfig] = []
        for raw_zone in self.config.get("zones", []):
            hostnames: List[HostnameConfig] = []
            for raw_host in raw_zone.get("hostnames", []) or []:
                if isinstance(raw_host, str):
                    hostnames.append(HostnameConfig(hostname=raw_host))
                else:
                    hostnames.append(
                        HostnameConfig(
                            hostname=str(raw_host.get("hostname") or "").strip(),
                            property_key=raw_host.get("property_key"),
                            property_id=raw_host.get("property_id"),
                            property_name=raw_host.get("property_name"),
                        )
                    )
            if not hostnames and raw_zone.get("hostname"):
                hostnames.append(HostnameConfig(hostname=str(raw_zone["hostname"]).strip()))
            zones.append(
                ZoneConfig(
                    zone_id=raw_zone.get("zone_id") or raw_zone.get("zone_tag"),
                    zone_name=raw_zone.get("zone_name") or raw_zone.get("name"),
                    hostnames=[host for host in hostnames if host.hostname],
                )
            )

        env_zone_ids = [
            item.strip()
            for item in os.getenv("CLOUDFLARE_ZONE_IDS", "").split(",")
            if item.strip()
        ]
        configured_ids = {zone.zone_id for zone in zones if zone.zone_id}
        for zone_id in env_zone_ids:
            if zone_id not in configured_ids:
                zones.append(ZoneConfig(zone_id=zone_id, zone_name=None, hostnames=[]))
        return zones

    def _identity_for_host(self, host: HostnameConfig) -> tuple[Optional[str], Optional[str]]:
        candidates = [
            host.property_key,
            host.property_id,
            host.property_name,
            host.hostname,
            f"https://{host.hostname}/",
            f"https://www.{host.hostname}/" if not host.hostname.startswith("www.") else None,
        ]
        for candidate in candidates:
            if not candidate:
                continue
            identity = resolve_property_identity(str(candidate))
            if identity:
                return identity.marketing_bi_property_id, identity.property_name
        return host.property_id or host.property_key, host.property_name

    @staticmethod
    def _aggregate_query() -> str:
        return """
        query CloudflareDailyAggregate($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 1, filter: $filter) {
                count
                sum {
                  edgeResponseBytes
                }
              }
            }
          }
        }
        """

    @staticmethod
    def _cache_status_query() -> str:
        return """
        query CloudflareCacheStatus($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 100, filter: $filter, orderBy: [count_DESC]) {
                count
                sum {
                  edgeResponseBytes
                }
                dimensions {
                  cacheStatus
                }
              }
            }
          }
        }
        """

    @staticmethod
    def _edge_status_query() -> str:
        return """
        query CloudflareEdgeStatus($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 100, filter: $filter, orderBy: [count_DESC]) {
                count
                dimensions {
                  edgeResponseStatus
                }
              }
            }
          }
        }
        """

    def _path_query(self) -> str:
        limit = max(1, min(int(self.top_paths_limit), 1000))
        return """
        query CloudflareTopPaths($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: %d, filter: $filter, orderBy: [count_DESC]) {
                count
                sum {
                  edgeResponseBytes
                }
                dimensions {
                  clientRequestPath
                }
              }
            }
          }
        }
        """ % limit

    def _extract_rows(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        zones = payload.get("data", {}).get("viewer", {}).get("zones", [])
        if not zones:
            return []
        return zones[0].get("httpRequestsAdaptiveGroups", []) or []

    def _fetch_aggregate(self, zone_id: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        rows = self._extract_rows(self._post_graphql(self._aggregate_query(), {"zoneTag": zone_id, "filter": filters}))
        row = rows[0] if rows else {}
        return {
            "requests": _as_int(row.get("count")) or 0,
            "bytes": _as_int((row.get("sum") or {}).get("edgeResponseBytes")) or 0,
            "raw": row,
        }

    def _fetch_cache_breakdown(self, zone_id: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = self._extract_rows(self._post_graphql(self._cache_status_query(), {"zoneTag": zone_id, "filter": filters}))
        breakdown = []
        for row in rows:
            status = (row.get("dimensions") or {}).get("cacheStatus") or "UNKNOWN"
            breakdown.append(
                {
                    "cache_status": status,
                    "requests": _as_int(row.get("count")) or 0,
                    "bytes": _as_int((row.get("sum") or {}).get("edgeResponseBytes")) or 0,
                }
            )
        return breakdown

    def _fetch_status_breakdown(self, zone_id: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        rows = self._extract_rows(self._post_graphql(self._edge_status_query(), {"zoneTag": zone_id, "filter": filters}))
        buckets = {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "other": 0}
        raw = []
        for row in rows:
            status = _as_int((row.get("dimensions") or {}).get("edgeResponseStatus"))
            count = _as_int(row.get("count")) or 0
            raw.append({"edge_response_status": status, "requests": count})
            if status is None:
                buckets["other"] += count
            elif 200 <= status <= 299:
                buckets["2xx"] += count
            elif 300 <= status <= 399:
                buckets["3xx"] += count
            elif 400 <= status <= 499:
                buckets["4xx"] += count
            elif 500 <= status <= 599:
                buckets["5xx"] += count
            else:
                buckets["other"] += count
        return {"buckets": buckets, "raw": raw}

    def _fetch_top_paths(self, zone_id: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        if self.top_paths_limit <= 0:
            return []
        rows = self._extract_rows(
            self._post_graphql(
                self._path_query(),
                {"zoneTag": zone_id, "filter": filters},
            )
        )
        paths = []
        for row in rows:
            path = (row.get("dimensions") or {}).get("clientRequestPath")
            if not path:
                continue
            paths.append(
                {
                    "path": path,
                    "requests": _as_int(row.get("count")) or 0,
                    "bytes": _as_int((row.get("sum") or {}).get("edgeResponseBytes")) or 0,
                    "raw": row,
                }
            )
        return paths

    @staticmethod
    def _cached_totals(cache_breakdown: Iterable[Dict[str, Any]]) -> tuple[int, int]:
        cached_statuses = {"HIT", "REVALIDATED", "STALE", "UPDATING"}
        cached_requests = 0
        cached_bytes = 0
        for item in cache_breakdown:
            if str(item.get("cache_status") or "").upper() in cached_statuses:
                cached_requests += int(item.get("requests") or 0)
                cached_bytes += int(item.get("bytes") or 0)
        return cached_requests, cached_bytes

    def _metric_payload(
        self,
        *,
        aggregate: Dict[str, Any],
        cache_breakdown: List[Dict[str, Any]],
        status_breakdown: Dict[str, Any],
        raw: Dict[str, Any],
    ) -> Dict[str, Any]:
        requests_count = int(aggregate.get("requests") or 0)
        cached_requests, cached_bytes = self._cached_totals(cache_breakdown)
        uncached_requests = max(requests_count - cached_requests, 0)
        ratio = round((cached_requests / requests_count) * 100, 2) if requests_count else None
        buckets = status_breakdown.get("buckets") or {}
        return {
            "requests": requests_count,
            "bytes": int(aggregate.get("bytes") or 0),
            "cached_requests": cached_requests,
            "cached_bytes": cached_bytes,
            "uncached_requests": uncached_requests,
            "origin_request_estimate": uncached_requests,
            "cache_hit_ratio": ratio,
            "edge_response_status_2xx": buckets.get("2xx", 0),
            "edge_response_status_3xx": buckets.get("3xx", 0),
            "edge_response_status_4xx": buckets.get("4xx", 0),
            "edge_response_status_5xx": buckets.get("5xx", 0),
            "edge_response_status_other": buckets.get("other", 0),
            "edge_response_status_breakdown_json": json.dumps(status_breakdown.get("raw") or [], sort_keys=True),
            "cache_status_breakdown_json": json.dumps(cache_breakdown, sort_keys=True),
            "bot_security_json": None,
            "dataset_name": "httpRequestsAdaptiveGroups",
            "query_status": "ok",
            "raw_response_json": json.dumps(raw, sort_keys=True),
        }

    def collect_for_date(self, metric_date: date, collection_id: Optional[int] = None) -> Dict[str, Any]:
        if not self.graphql_config.get("enabled", True):
            self.logger.warning("Cloudflare analytics skipped: graphql.enabled is false")
            return {"ok": True, "skipped": True, "rows_written": 0, "zones_total": 0, "zones_failed": 0}
        if not self._ensure_session():
            return {"ok": True, "skipped": True, "rows_written": 0, "zones_total": 0, "zones_failed": 0}

        zones = self._configured_zones()
        if not zones:
            self.logger.warning("Cloudflare analytics skipped: no zones configured")
            return {"ok": True, "skipped": True, "rows_written": 0, "zones_total": 0, "zones_failed": 0}

        window_start, window_end = _utc_day_window(metric_date)
        rows_written = 0
        zones_failed = 0
        errors: List[str] = []

        for zone in zones:
            try:
                zone_id, zone_name = self._resolve_zone_id(zone)
                hosts = zone.hostnames or [HostnameConfig(hostname="__zone__")]
                for host in hosts:
                    hostname = None if host.hostname == "__zone__" else host.hostname
                    property_id, property_name = self._identity_for_host(host) if hostname else (None, None)
                    filters: Dict[str, Any] = {
                        "datetime_geq": window_start,
                        "datetime_lt": window_end,
                        "requestSource": "eyeball",
                    }
                    if hostname:
                        filters["clientRequestHTTPHost"] = hostname

                    aggregate = self._fetch_aggregate(zone_id, filters)
                    cache_breakdown = self._fetch_cache_breakdown(zone_id, filters)
                    status_breakdown = self._fetch_status_breakdown(zone_id, filters)
                    raw = {
                        "window_start": window_start,
                        "window_end": window_end,
                        "aggregate": aggregate.get("raw"),
                        "cache_status_breakdown": cache_breakdown,
                        "edge_response_status_breakdown": status_breakdown.get("raw"),
                        "token_source": self.token_source,
                    }
                    self.db.upsert_cloudflare_edge_daily_metric(
                        metric_date=metric_date.isoformat(),
                        zone_id=zone_id,
                        zone_name=zone_name,
                        property_id=property_id,
                        property_name=property_name,
                        hostname=hostname,
                        path=None,
                        metric_data=self._metric_payload(
                            aggregate=aggregate,
                            cache_breakdown=cache_breakdown,
                            status_breakdown=status_breakdown,
                            raw=raw,
                        ),
                        collection_id=collection_id,
                    )
                    rows_written += 1

                    try:
                        for path_row in self._fetch_top_paths(zone_id, filters):
                            self.db.upsert_cloudflare_edge_daily_metric(
                                metric_date=metric_date.isoformat(),
                                zone_id=zone_id,
                                zone_name=zone_name,
                                property_id=property_id,
                                property_name=property_name,
                                hostname=hostname,
                                path=path_row["path"],
                                metric_data={
                                    "requests": path_row["requests"],
                                    "bytes": path_row["bytes"],
                                    "cached_requests": None,
                                    "cached_bytes": None,
                                    "uncached_requests": None,
                                    "origin_request_estimate": None,
                                    "cache_hit_ratio": None,
                                    "edge_response_status_2xx": None,
                                    "edge_response_status_3xx": None,
                                    "edge_response_status_4xx": None,
                                    "edge_response_status_5xx": None,
                                    "edge_response_status_other": None,
                                    "edge_response_status_breakdown_json": None,
                                    "cache_status_breakdown_json": None,
                                    "bot_security_json": None,
                                    "dataset_name": "httpRequestsAdaptiveGroups",
                                    "query_status": "ok",
                                    "raw_response_json": json.dumps(
                                        {
                                            "window_start": window_start,
                                            "window_end": window_end,
                                            "path_row": path_row.get("raw"),
                                            "note": "Path rows carry request/byte facts only in v1; host aggregate rows carry cache/status breakdowns.",
                                        },
                                        sort_keys=True,
                                    ),
                                },
                                collection_id=collection_id,
                            )
                            rows_written += 1
                    except Exception as exc:
                        self.logger.warning("Cloudflare top-path query skipped for %s: %s", hostname or zone_id, exc)
            except Exception as exc:
                zones_failed += 1
                message = f"{zone.zone_name or zone.zone_id}: {exc}"
                errors.append(message)
                self.logger.warning("Cloudflare analytics zone failed: %s", message)

        return {
            "ok": zones_failed == 0 or rows_written > 0,
            "skipped": False,
            "rows_written": rows_written,
            "zones_total": len(zones),
            "zones_failed": zones_failed,
            "errors": errors,
        }

    def run(self, metric_date: Optional[date] = None, collection_id: Optional[int] = None) -> Dict[str, Any]:
        if metric_date is None:
            metric_date = datetime.now(UTC).date()
            if self.graphql_config.get("use_previous_day_window", True):
                metric_date = metric_date - timedelta(days=1)
        return self.collect_for_date(metric_date=metric_date, collection_id=collection_id)


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect Cloudflare GraphQL edge analytics.")
    parser.add_argument(
        "--config",
        default="/Users/mark/Property_Analytics/config/cloudflare_analytics.yaml",
        help="Path to Cloudflare analytics YAML config.",
    )
    parser.add_argument("--date", help="Metric date to collect, YYYY-MM-DD. Defaults to previous UTC day.")
    parser.add_argument("--db", default="/Users/mark/Property_Analytics/data/portfolio_analytics.db")
    args = parser.parse_args()

    metric_date = date.fromisoformat(args.date) if args.date else None
    db = DatabaseManager(Path(args.db))
    collector = CloudflareAnalyticsCollector(config_path=Path(args.config), db=db)
    collection_id = db.start_data_collection(
        collection_date=metric_date or (datetime.now(UTC).date() - timedelta(days=1)),
        collection_type="daily",
        data_source="cloudflare_edge_analytics",
    )
    result = collector.run(metric_date=metric_date, collection_id=collection_id)
    db.complete_data_collection(
        collection_id=collection_id,
        properties_collected=result.get("rows_written", 0),
        properties_failed=result.get("zones_failed", 0),
        properties_total=result.get("zones_total", 0),
        properties_success=result.get("rows_written", 0),
        properties_skipped=1 if result.get("skipped") else 0,
        status="completed" if result.get("ok") else "partial",
        error_message="; ".join(result.get("errors", [])[:3]) if result.get("errors") else None,
        notes="Cloudflare edge analytics source-fact collection.",
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
