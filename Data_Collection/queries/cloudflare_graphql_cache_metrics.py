#!/usr/bin/env python3
"""
Cloudflare GraphQL analytics helpers for the daily cache audit.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests

from ops.cloudflare.cloudflare_auth import resolve_cloudflare_token


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
CLOUDFLARE_GRAPHQL_ENDPOINT = f"{CLOUDFLARE_API_BASE}/graphql"


class CloudflareGraphQLError(RuntimeError):
    """Raised when a Cloudflare GraphQL request cannot be completed."""


def _utc_window(target_date: date) -> tuple[str, str]:
    start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def _unwrap_type(type_info: Optional[Dict[str, Any]]) -> Optional[str]:
    current = type_info or {}
    while current:
        name = current.get("name")
        if name:
            return name
        current = current.get("ofType") or {}
    return None


@dataclass
class QueryAttempt:
    dataset: str
    ok: bool
    message: str
    query: str


class CloudflareGraphQLCacheMetricsClient:
    """Schema-tolerant Cloudflare analytics client for cache diagnostics."""

    def __init__(self, timeout_seconds: int = 30, max_retries: int = 2):
        resolved = resolve_cloudflare_token()
        self.token = resolved.token
        self.token_source = resolved.source
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            }
        )
        self._type_cache: Dict[str, Dict[str, Any]] = {}

    def _post(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        last_error: Optional[Exception] = None
        payload = {"query": query, "variables": variables}
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
                    raise CloudflareGraphQLError(message)
                return decoded
            except Exception as exc:
                last_error = exc
                if attempt > self.max_retries:
                    break
        raise CloudflareGraphQLError(str(last_error))

    def _rest_get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        response = self.session.get(
            f"{CLOUDFLARE_API_BASE}{path}",
            params=params,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success", False):
            errors = "; ".join(err.get("message", "unknown REST error") for err in payload.get("errors", []))
            raise CloudflareGraphQLError(errors or f"REST request failed for {path}")
        return payload

    def resolve_zone_tag(self, zone_name: str) -> str:
        payload = self._rest_get("/zones", params={"name": zone_name, "status": "active", "per_page": 1})
        results = payload.get("result") or []
        if not results:
            raise CloudflareGraphQLError(f"No active zone found for {zone_name}")
        return results[0]["id"]

    def get_zone_details(self, zone_tag: str) -> Dict[str, Any]:
        payload = self._rest_get(f"/zones/{zone_tag}")
        return payload.get("result") or {}

    def get_zone_settings(self, zone_tag: str) -> List[Dict[str, Any]]:
        payload = self._rest_get(f"/zones/{zone_tag}/settings")
        return payload.get("result") or []

    def get_ruleset_phase(self, zone_tag: str, phase: str) -> Dict[str, Any]:
        try:
            payload = self._rest_get(f"/zones/{zone_tag}/rulesets/phases/{phase}/entrypoint")
            return {"ok": True, "phase": phase, "result": payload.get("result")}
        except Exception as exc:
            return {"ok": False, "phase": phase, "error": str(exc)}

    def fetch_zone_config_snapshot(self, *, zone_name: str, zone_tag: Optional[str] = None) -> Dict[str, Any]:
        zone_tag = zone_tag or self.resolve_zone_tag(zone_name)
        zone = self.get_zone_details(zone_tag)
        settings = self.get_zone_settings(zone_tag)
        cache_related_settings = [
            item for item in settings
            if item.get("id") in {
                "cache_level",
                "browser_cache_ttl",
                "always_online",
                "development_mode",
                "cache_reserve",
                "tiered_cache",
                "origin_cache_control",
                "sort_query_string_for_cache",
                "respect_strong_etags",
            }
        ]
        phase_names = [
            "http_request_cache_settings",
            "http_request_dynamic_redirect",
            "http_request_transform",
            "http_response_headers_transform",
        ]
        rulesets = [self.get_ruleset_phase(zone_tag, phase) for phase in phase_names]
        return {
            "ok": True,
            "zone_tag": zone_tag,
            "zone_name": zone_name,
            "captured_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "zone": {
                "id": zone.get("id"),
                "name": zone.get("name"),
                "status": zone.get("status"),
                "paused": zone.get("paused"),
                "type": zone.get("type"),
                "development_mode": zone.get("development_mode"),
                "name_servers": zone.get("name_servers"),
            },
            "cache_related_settings": cache_related_settings,
            "rulesets": rulesets,
            "raw_zone_result": zone,
        }

    def introspect_type(self, type_name: str) -> Dict[str, Any]:
        if type_name in self._type_cache:
            return self._type_cache[type_name]

        query = """
        query IntrospectType($typeName: String!) {
          __type(name: $typeName) {
            name
            fields {
              name
              type {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
        """
        payload = self._post(query, {"typeName": type_name})
        type_info = payload.get("data", {}).get("__type")
        if not type_info:
            raise CloudflareGraphQLError(f"GraphQL schema type not found: {type_name}")
        self._type_cache[type_name] = type_info
        return type_info

    def _zone_dataset_metadata(self, dataset_name: str) -> Dict[str, Any]:
        zone_type = self.introspect_type("zone")
        field_info = next((field for field in zone_type.get("fields", []) if field.get("name") == dataset_name), None)
        if not field_info:
            raise CloudflareGraphQLError(f"Zone dataset not present in schema: {dataset_name}")

        group_type_name = _unwrap_type(field_info.get("type"))
        if not group_type_name:
            raise CloudflareGraphQLError(f"Unable to resolve GraphQL type for dataset: {dataset_name}")

        group_type = self.introspect_type(group_type_name)
        group_fields = {field["name"]: field for field in group_type.get("fields", [])}

        dimensions_type_name = _unwrap_type(group_fields.get("dimensions", {}).get("type"))
        sum_type_name = _unwrap_type(group_fields.get("sum", {}).get("type"))

        dimensions_type = self.introspect_type(dimensions_type_name) if dimensions_type_name else {"fields": []}
        sum_type = self.introspect_type(sum_type_name) if sum_type_name else {"fields": []}

        return {
            "dataset_name": dataset_name,
            "group_type_name": group_type_name,
            "group_fields": sorted(group_fields.keys()),
            "dimensions_type_name": dimensions_type_name,
            "dimensions_fields": sorted(field["name"] for field in dimensions_type.get("fields", [])),
            "sum_type_name": sum_type_name,
            "sum_fields": sorted(field["name"] for field in sum_type.get("fields", [])),
        }

    def _build_summary_query(self, metadata: Dict[str, Any], include_host: bool) -> tuple[str, List[str], List[str]]:
        dimensions_candidates = ["date"]
        if include_host:
            dimensions_candidates.extend(["clientRequestHTTPHost", "hostname"])
        selected_dimensions = [name for name in dimensions_candidates if name in metadata["dimensions_fields"]]
        if "date" not in selected_dimensions:
            raise CloudflareGraphQLError(
                f"{metadata['dataset_name']} does not expose a daily date dimension: {metadata['dimensions_fields']}"
            )

        sum_candidates = [
            "requests",
            "cachedRequests",
            "uncachedRequests",
            "cachedBytes",
            "bytes",
            "pageViews",
            "visits",
            "encryptedRequests",
            "encryptedBytes",
        ]
        selected_sum_fields = [name for name in sum_candidates if name in metadata["sum_fields"]]
        if "requests" not in selected_sum_fields:
            raise CloudflareGraphQLError(
                f"{metadata['dataset_name']} does not expose request totals: {metadata['sum_fields']}"
            )

        query = f"""
        query DailyCacheSummary($zoneTag: string, $filter: ZoneHttpRequests1dGroupsFilter_InputObject) {{
          viewer {{
            zones(filter: {{ zoneTag: $zoneTag }}) {{
              {metadata['dataset_name']}(limit: 10, filter: $filter) {{
                dimensions {{
                  {' '.join(selected_dimensions)}
                }}
                sum {{
                  {' '.join(selected_sum_fields)}
                }}
              }}
            }}
          }}
        }}
        """
        return query, selected_dimensions, selected_sum_fields

    def _build_cache_status_query(self) -> str:
        return """
        query CacheStatusDistribution($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 50, filter: $filter) {
                dimensions {
                  cacheStatus
                }
                sum {
                  requests
                }
              }
            }
          }
        }
        """

    def fetch_zone_daily_diagnostics(
        self,
        *,
        zone_name: str,
        metric_date: date,
        zone_tag: Optional[str] = None,
        hostname: Optional[str] = None,
    ) -> Dict[str, Any]:
        zone_tag = zone_tag or self.resolve_zone_tag(zone_name)
        datetime_geq, datetime_lt = _utc_window(metric_date)
        attempts: List[QueryAttempt] = []

        for dataset_name in ("httpRequests1dGroups", "httpRequests1dByColoGroups"):
            try:
                metadata = self._zone_dataset_metadata(dataset_name)
                query, dimensions_fields, sum_fields = self._build_summary_query(metadata, include_host=bool(hostname))
                summary_filter: Dict[str, Any] = {"date_geq": metric_date.isoformat(), "date_leq": metric_date.isoformat()}
                if hostname:
                    if "clientRequestHTTPHost" in metadata["dimensions_fields"]:
                        summary_filter["clientRequestHTTPHost"] = hostname
                    elif "hostname" in metadata["dimensions_fields"]:
                        summary_filter["hostname"] = hostname
                payload = self._post(query, {"zoneTag": zone_tag, "filter": summary_filter})
                rows = payload.get("data", {}).get("viewer", {}).get("zones", [{}])[0].get(dataset_name, [])
                attempts.append(QueryAttempt(dataset=dataset_name, ok=True, message="ok", query=query))
                if not rows:
                    raise CloudflareGraphQLError(f"{dataset_name} returned no rows for zone={zone_name}")
                row = rows[0]
                summary = row.get("sum") or {}
                breakdown = self._fetch_cache_status_distribution(zone_tag=zone_tag, datetime_geq=datetime_geq, datetime_lt=datetime_lt, hostname=hostname)
                total_requests = int(summary.get("requests") or 0)
                cached_requests = summary.get("cachedRequests")
                uncached_requests = summary.get("uncachedRequests")
                if cached_requests is None and breakdown:
                    cached_requests = sum(item["requests"] for item in breakdown if item["cache_status"] == "HIT")
                if uncached_requests is None and cached_requests is not None:
                    uncached_requests = max(total_requests - int(cached_requests), 0)
                cache_hit_ratio = None
                if total_requests > 0 and cached_requests is not None:
                    cache_hit_ratio = round((int(cached_requests) / total_requests) * 100, 2)

                return {
                    "ok": True,
                    "zone_tag": zone_tag,
                    "zone_name": zone_name,
                    "hostname": hostname,
                    "metric_date": metric_date.isoformat(),
                    "window_start": datetime_geq,
                    "window_end": datetime_lt,
                    "dataset_name": dataset_name,
                    "supported_dimensions": dimensions_fields,
                    "supported_sum_fields": sum_fields,
                    "total_requests": total_requests,
                    "cached_requests": int(cached_requests) if cached_requests is not None else None,
                    "uncached_requests": int(uncached_requests) if uncached_requests is not None else None,
                    "cache_hit_ratio": cache_hit_ratio,
                    "cache_status_breakdown": breakdown,
                    "summary_row": row,
                    "query_attempts": [attempt.__dict__ for attempt in attempts],
                    "schema_metadata": metadata,
                }
            except Exception as exc:
                attempts.append(QueryAttempt(dataset=dataset_name, ok=False, message=str(exc), query=""))

        return {
            "ok": False,
            "zone_tag": zone_tag,
            "zone_name": zone_name,
            "hostname": hostname,
            "metric_date": metric_date.isoformat(),
            "window_start": datetime_geq,
            "window_end": datetime_lt,
            "query_attempts": [attempt.__dict__ for attempt in attempts],
            "error": attempts[-1].message if attempts else "No query attempts executed",
        }

    def _fetch_cache_status_distribution(
        self,
        *,
        zone_tag: str,
        datetime_geq: str,
        datetime_lt: str,
        hostname: Optional[str],
    ) -> List[Dict[str, Any]]:
        try:
            adaptive_metadata = self._zone_dataset_metadata("httpRequestsAdaptiveGroups")
            if "cacheStatus" not in adaptive_metadata["dimensions_fields"] or "requests" not in adaptive_metadata["sum_fields"]:
                return []
            query = self._build_cache_status_query()
            filters: Dict[str, Any] = {"datetime_geq": datetime_geq, "datetime_lt": datetime_lt}
            if hostname:
                if "clientRequestHTTPHost" in adaptive_metadata["dimensions_fields"]:
                    filters["clientRequestHTTPHost"] = hostname
                elif "hostname" in adaptive_metadata["dimensions_fields"]:
                    filters["hostname"] = hostname
            payload = self._post(query, {"zoneTag": zone_tag, "filter": filters})
            rows = payload.get("data", {}).get("viewer", {}).get("zones", [{}])[0].get("httpRequestsAdaptiveGroups", [])
            breakdown: List[Dict[str, Any]] = []
            for row in rows:
                dimensions = row.get("dimensions") or {}
                sum_row = row.get("sum") or {}
                cache_status = dimensions.get("cacheStatus")
                requests_count = sum_row.get("requests")
                if cache_status is None or requests_count is None:
                    continue
                breakdown.append({"cache_status": cache_status, "requests": int(requests_count)})
            return breakdown
        except Exception:
            return []

    def healthcheck(self) -> Dict[str, Any]:
        zone_type = self.introspect_type("zone")
        return {
            "token_source": self.token_source,
            "zone_fields": sorted(field["name"] for field in zone_type.get("fields", [])),
        }


def pretty_json(data: Dict[str, Any]) -> str:
    return json.dumps(data, indent=2, sort_keys=True)
