#!/usr/bin/env python3
"""
Daily Cloudflare cache audit collector for pilot domains.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import shutil
import sys
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
import yaml

_data_collection_root = str(Path(__file__).resolve().parents[2])
if _data_collection_root not in sys.path:
    sys.path.insert(0, _data_collection_root)

from Data_Collection.db.database_manager import DatabaseManager
from Data_Collection.queries.cloudflare_graphql_cache_metrics import (
    CloudflareGraphQLCacheMetricsClient,
)
from Data_Collection.reports.cloudflare_cache_daily_report import build_daily_markdown_report
from Data_Collection.reports.cloudflare_cache_daily_report import build_pib_email_html


DEFAULT_HEADERS_TO_CAPTURE = [
    "CF-Cache-Status",
    "Age",
    "Cache-Control",
    "CF-RAY",
    "Server-Timing",
    "ETag",
    "Expires",
    "Vary",
    "Content-Type",
]


STATUS_ORDER = {"pass": 0, "warn": 1, "fail": 2}


def _worst_status(statuses: List[str]) -> str:
    if not statuses:
        return "warn"
    return max(statuses, key=lambda item: STATUS_ORDER.get(item, 1))


@dataclass
class UrlVariant:
    key: str
    path: str
    query_params: Dict[str, str] = field(default_factory=dict)


@dataclass
class DeviceProfile:
    key: str
    user_agent: str
    accept_language: str = "en-US,en;q=0.9"


@dataclass
class DomainConfig:
    property_id: str
    property_name: str
    domain: str
    zone_name: str
    zone_tag: Optional[str]
    urls: List[UrlVariant]


class CloudflareCacheAuditCollector:
    """Runs synthetic and GraphQL cache diagnostics for configured pilot domains."""

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
        self.base_dir = Path(__file__).resolve().parents[2]
        self.output_root = self.base_dir / self.config["outputs"]["root_dir"]
        self.output_root.mkdir(parents=True, exist_ok=True)
        self._graphql_client: Optional[CloudflareGraphQLCacheMetricsClient] = None
        self._graphql_init_error: Optional[str] = None

    def _build_logger(self) -> logging.Logger:
        logger = logging.getLogger("cloudflare_cache_audit")
        if logger.handlers:
            return logger
        logger.setLevel(logging.INFO)
        log_dir = Path(__file__).resolve().parents[2] / "Data_Collection" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_dir / "cloudflare_cache_audit.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.addHandler(logging.StreamHandler(sys.stdout))
        return logger

    @staticmethod
    def _load_config(config_path: Path) -> Dict[str, Any]:
        with config_path.open("r", encoding="utf-8") as handle:
            config = yaml.safe_load(handle) or {}
        if "domains" not in config:
            raise ValueError(f"Cloudflare cache audit config missing domains: {config_path}")
        config.setdefault("synthetic", {})
        config.setdefault("graphql", {})
        config.setdefault("outputs", {})
        config["outputs"].setdefault("root_dir", "reports/cloudflare_cache_audit")
        config["synthetic"].setdefault("headers_to_capture", DEFAULT_HEADERS_TO_CAPTURE)
        config["synthetic"].setdefault("sequential_requests", 2)
        config["synthetic"].setdefault("timeout_seconds", 20)
        config["synthetic"].setdefault("retry_attempts", 2)
        config["synthetic"].setdefault("retry_backoff_seconds", 1.0)
        config["synthetic"].setdefault("follow_redirects", True)
        config["synthetic"].setdefault("warm_cache_success_statuses", ["HIT"])
        config["synthetic"].setdefault("ttfb_warn_ms", 800)
        config["synthetic"].setdefault("total_time_warn_ms", 2500)
        config["synthetic"].setdefault("query_string_variants_enabled", True)
        config["synthetic"].setdefault("query_string_params", {"cf_audit": "1"})
        config["synthetic"].setdefault(
            "user_agent",
            "Mozilla/5.0 (compatible; PropertyAnalyticsCacheAudit/1.0; +https://venterraliving.com)",
        )
        config["synthetic"].setdefault(
            "device_profiles",
            [
                {
                    "key": "desktop",
                    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
                },
                {
                    "key": "mobile",
                    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
                },
            ],
        )
        config["synthetic"].setdefault("domain_fail_on_uncached_url_count", 2)
        config["synthetic"].setdefault("domain_warn_on_uncached_url_count", 1)
        config["synthetic"].setdefault("expected_query_string_behavior", "pass_through")
        config["graphql"].setdefault("enabled", True)
        config["graphql"].setdefault("capture_zone_config_snapshot", True)
        config["graphql"].setdefault("use_previous_day_window", True)
        config["graphql"].setdefault("cache_hit_ratio_warn_below", 50.0)
        config["graphql"].setdefault("cache_hit_ratio_fail_below", 20.0)
        config["graphql"].setdefault("day_over_day_drop_warn_points", 10.0)
        config["outputs"].setdefault("write_latest_copies", True)
        return config

    def _device_profiles(self) -> List[DeviceProfile]:
        profiles = []
        for item in self.config["synthetic"]["device_profiles"]:
            profiles.append(
                DeviceProfile(
                    key=item["key"],
                    user_agent=item["user_agent"],
                    accept_language=item.get("accept_language", "en-US,en;q=0.9"),
                )
            )
        return profiles

    def _domain_configs(self, only_domain: Optional[str] = None) -> List[DomainConfig]:
        domains: List[DomainConfig] = []
        query_enabled = bool(self.config["synthetic"].get("query_string_variants_enabled"))
        query_params = dict(self.config["synthetic"].get("query_string_params", {}))
        for entry in self.config["domains"]:
            domain = entry["domain"].lower()
            if only_domain and domain != only_domain.lower():
                continue

            urls = [UrlVariant(key="clean", path="/")]
            for path in entry.get("paths", []):
                urls.append(UrlVariant(key="clean", path=path))
            expanded: List[UrlVariant] = []
            for url in urls:
                expanded.append(url)
                if query_enabled:
                    expanded.append(UrlVariant(key="query_string", path=url.path, query_params=query_params))

            deduped: Dict[tuple[str, str], UrlVariant] = {}
            for item in expanded:
                normalized_path = item.path if item.path.startswith("/") else f"/{item.path}"
                deduped[(item.key, normalized_path)] = UrlVariant(
                    key=item.key,
                    path=normalized_path,
                    query_params=item.query_params,
                )

            domains.append(
                DomainConfig(
                    property_id=str(entry["property_id"]),
                    property_name=entry["property_name"],
                    domain=domain,
                    zone_name=entry.get("zone_name", domain),
                    zone_tag=entry.get("zone_tag"),
                    urls=list(deduped.values()),
                )
            )
        return domains

    def _get_graphql_client(self) -> CloudflareGraphQLCacheMetricsClient:
        if self._graphql_client is not None:
            return self._graphql_client
        if self._graphql_init_error is not None:
            raise RuntimeError(self._graphql_init_error)

        graphql_config = self.config.get("graphql", {})
        try:
            self._graphql_client = CloudflareGraphQLCacheMetricsClient(
                timeout_seconds=int(graphql_config.get("timeout_seconds", 30)),
                max_retries=int(graphql_config.get("max_retries", 2)),
            )
            return self._graphql_client
        except Exception as exc:
            self._graphql_init_error = str(exc)
            raise RuntimeError(self._graphql_init_error)

    def _build_url(self, domain: str, variant: UrlVariant) -> str:
        base = f"https://{domain}"
        query = urlencode(variant.query_params, doseq=True) if variant.query_params else ""
        return urlunparse(("https", domain, variant.path, "", query, ""))

    def _capture_headers(self, response: requests.Response) -> Dict[str, Optional[str]]:
        return {
            header: response.headers.get(header)
            for header in self.config["synthetic"]["headers_to_capture"]
        }

    def _full_headers(self, response: requests.Response) -> Dict[str, str]:
        return dict(response.headers.items())

    def _redirect_chain(self, response: requests.Response) -> List[Dict[str, Any]]:
        chain = []
        for item in list(response.history) + [response]:
            chain.append(
                {
                    "url": item.url,
                    "status_code": item.status_code,
                    "location": item.headers.get("Location"),
                }
            )
        return chain

    def _cacheability_diagnostics(self, response: requests.Response, requested_url: str) -> Dict[str, Any]:
        headers = {key.lower(): value for key, value in response.headers.items()}
        cache_control = headers.get("cache-control", "")
        vary = headers.get("vary", "")
        set_cookie = headers.get("set-cookie")
        final_url = response.url
        requested_parsed = urlparse(requested_url)
        final_parsed = urlparse(final_url)
        reasons = []
        expected_cacheability = "expected_cacheable"

        if set_cookie:
            reasons.append("set-cookie present")
            expected_cacheability = "needs_review"
        if any(token in cache_control.lower() for token in ["private", "no-store", "no-cache", "max-age=0"]):
            reasons.append(f"cache-control suggests bypass: {cache_control}")
            expected_cacheability = "needs_review"
        if "cookie" in vary.lower():
            reasons.append(f"vary includes cookie: {vary}")
            expected_cacheability = "needs_review"
        if response.status_code in {401, 403}:
            reasons.append(f"http status {response.status_code} is typically non-cacheable")
            expected_cacheability = "expected_bypass"
        if requested_parsed.query and final_parsed.path != requested_parsed.path:
            reasons.append("query-string request redirected to a different path")
        if requested_parsed.query and not final_parsed.query:
            reasons.append("query string was stripped from final URL")
        if response.is_redirect:
            reasons.append("request ended on redirect")

        return {
            "expected_cacheability": expected_cacheability,
            "reasons": reasons,
            "has_set_cookie": bool(set_cookie),
            "cache_control": cache_control,
            "vary": vary,
            "set_cookie": set_cookie,
            "query_string_present": bool(requested_parsed.query),
            "requested_query_keys": sorted(key for key, _ in parse_qsl(requested_parsed.query, keep_blank_values=True)),
        }

    def _perform_single_request(self, session: requests.Session, url: str, device_profile: DeviceProfile) -> Dict[str, Any]:
        synthetic = self.config["synthetic"]
        retries = int(synthetic["retry_attempts"])
        last_error: Optional[Exception] = None

        for attempt in range(1, retries + 2):
            try:
                start = time.perf_counter()
                response = session.get(
                    url,
                    timeout=float(synthetic["timeout_seconds"]),
                    allow_redirects=bool(synthetic["follow_redirects"]),
                    headers={
                        "User-Agent": device_profile.user_agent,
                        "Accept": "text/html,application/xhtml+xml",
                        "Accept-Language": device_profile.accept_language,
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                    },
                    stream=True,
                )
                ttfb_ms = (time.perf_counter() - start) * 1000

                total_bytes = 0
                for chunk in response.iter_content(chunk_size=16384):
                    total_bytes += len(chunk)
                total_time_ms = (time.perf_counter() - start) * 1000

                redirect_chain = self._redirect_chain(response)
                cacheability = self._cacheability_diagnostics(response, url)
                return {
                    "requested_url": url,
                    "final_url": response.url,
                    "http_status": response.status_code,
                    "headers": self._capture_headers(response),
                    "headers_full": self._full_headers(response),
                    "cf_cache_status": response.headers.get("CF-Cache-Status"),
                    "ttfb_ms": round(ttfb_ms, 2),
                    "total_time_ms": round(total_time_ms, 2),
                    "response_bytes": total_bytes,
                    "redirect_count": max(len(redirect_chain) - 1, 0),
                    "redirect_chain": redirect_chain,
                    "cacheability": cacheability,
                    "device_profile": device_profile.key,
                    "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                }
            except Exception as exc:
                last_error = exc
                if attempt <= retries:
                    time.sleep(float(synthetic["retry_backoff_seconds"]))
        raise RuntimeError(str(last_error))

    def _evaluate_url_status(self, request_rows: List[Dict[str, Any]]) -> tuple[str, List[str]]:
        synthetic = self.config["synthetic"]
        notes: List[str] = []
        second_row = request_rows[1] if len(request_rows) > 1 else None

        if any((row.get("http_status") or 0) != 200 for row in request_rows):
            notes.append("non-200 response observed")
            return "fail", notes

        if second_row:
            cache_status = (second_row.get("cf_cache_status") or "").upper()
            if cache_status not in [value.upper() for value in synthetic["warm_cache_success_statuses"]]:
                notes.append(f"second request cache status was {cache_status or 'missing'}")
                status = "warn"
            else:
                status = "pass"
        else:
            notes.append("missing second request")
            status = "fail"

        threshold_ttfb = float(synthetic["ttfb_warn_ms"])
        threshold_total = float(synthetic["total_time_warn_ms"])
        if second_row and second_row.get("ttfb_ms") is not None and float(second_row["ttfb_ms"]) > threshold_ttfb:
            notes.append(f"warm-cache TTFB above {threshold_ttfb:.0f} ms")
            status = _worst_status([status, "warn"])
        if second_row and second_row.get("total_time_ms") is not None and float(second_row["total_time_ms"]) > threshold_total:
            notes.append(f"warm-cache total time above {threshold_total:.0f} ms")
            status = _worst_status([status, "warn"])
        return status, notes

    def _synthetic_checks_for_domain(self, domain_config: DomainConfig, audit_date: date) -> Dict[str, Any]:
        url_summaries: List[Dict[str, Any]] = []
        request_rows: List[Dict[str, Any]] = []

        for device_profile in self._device_profiles():
            session = requests.Session()
            for variant in domain_config.urls:
                target_url = self._build_url(domain_config.domain, variant)
                variant_key = f"{variant.key}_{device_profile.key}"
                sequential_rows: List[Dict[str, Any]] = []
                for request_sequence in range(1, int(self.config["synthetic"]["sequential_requests"]) + 1):
                    result = self._perform_single_request(session, target_url, device_profile)
                    result.update(
                        {
                            "property_id": domain_config.property_id,
                            "property_name": domain_config.property_name,
                            "domain": domain_config.domain,
                            "zone_name": domain_config.zone_name,
                            "zone_tag": domain_config.zone_tag,
                            "request_date": audit_date.isoformat(),
                            "path_tested": variant.path,
                            "variant_key": variant_key,
                            "variant_mode": variant.key,
                            "request_sequence": request_sequence,
                        }
                    )
                    sequential_rows.append(result)
                    request_rows.append(result)

                status, notes = self._evaluate_url_status(sequential_rows)
                first_row = sequential_rows[0]
                second_row = sequential_rows[1] if len(sequential_rows) > 1 else {}
                baseline_delta = None
                if second_row.get("ttfb_ms") is not None and first_row.get("ttfb_ms") is not None:
                    baseline_delta = round(float(first_row["ttfb_ms"]) - float(second_row["ttfb_ms"]), 2)
                diagnostics = second_row.get("cacheability") or first_row.get("cacheability") or {}
                notes = list(notes)
                notes.extend(diagnostics.get("reasons") or [])
                url_summaries.append(
                    {
                        "property_id": domain_config.property_id,
                        "domain": domain_config.domain,
                        "path": variant.path,
                        "variant_key": variant_key,
                        "variant_mode": variant.key,
                        "device_profile": device_profile.key,
                        "status": status,
                        "notes": notes,
                        "http_status": second_row.get("http_status") or first_row.get("http_status"),
                        "first_cache_status": first_row.get("cf_cache_status"),
                        "second_cache_status": second_row.get("cf_cache_status"),
                        "first_ttfb_ms": first_row.get("ttfb_ms"),
                        "second_ttfb_ms": second_row.get("ttfb_ms"),
                        "first_total_time_ms": first_row.get("total_time_ms"),
                        "second_total_time_ms": second_row.get("total_time_ms"),
                        "baseline_vs_warm_ttfb_delta_ms": baseline_delta,
                        "final_url": second_row.get("final_url") or first_row.get("final_url"),
                        "redirect_count": second_row.get("redirect_count") or first_row.get("redirect_count"),
                        "cacheability": diagnostics,
                    }
                )

        return {"request_rows": request_rows, "url_summaries": url_summaries}

    def _evaluate_graphql_status(self, graphql_row: Dict[str, Any]) -> tuple[str, List[str]]:
        notes: List[str] = []
        graphql_config = self.config["graphql"]
        if not graphql_row.get("ok"):
            return "fail", [graphql_row.get("error", "GraphQL query failed")]

        hit_ratio = graphql_row.get("cache_hit_ratio")
        if hit_ratio is None:
            notes.append("cache hit ratio unavailable in schema")
            return "warn", notes
        if hit_ratio < float(graphql_config["cache_hit_ratio_fail_below"]):
            notes.append(f"cache hit ratio {hit_ratio:.2f}% below fail threshold")
            return "fail", notes
        if hit_ratio < float(graphql_config["cache_hit_ratio_warn_below"]):
            notes.append(f"cache hit ratio {hit_ratio:.2f}% below warn threshold")
            return "warn", notes
        return "pass", notes

    def _persist_results(
        self,
        *,
        collection_id: int,
        audit_date: date,
        domain_config: DomainConfig,
        request_rows: List[Dict[str, Any]],
        url_summaries: List[Dict[str, Any]],
        graphql_row: Dict[str, Any],
        graphql_status: str,
    ) -> None:
        summary_map = {(row["path"], row["variant_key"]): row for row in url_summaries}
        for request_row in request_rows:
            summary = summary_map[(request_row["path_tested"], request_row["variant_key"])]
            self.db.insert_cloudflare_cache_synthetic_check(
                property_id=request_row["property_id"],
                property_name=request_row["property_name"],
                normalized_domain=request_row["domain"],
                zone_name=request_row["zone_name"],
                zone_tag=request_row.get("zone_tag"),
                request_date=audit_date.isoformat(),
                path_tested=request_row["path_tested"],
                variant_key=request_row["variant_key"],
                request_sequence=request_row["request_sequence"],
                request_data={
                    "final_url": request_row.get("final_url"),
                    "http_status": request_row.get("http_status"),
                    "cf_cache_status": request_row.get("cf_cache_status"),
                    "ttfb_ms": request_row.get("ttfb_ms"),
                    "total_time_ms": request_row.get("total_time_ms"),
                    "headers_json": json.dumps(request_row.get("headers") or {}, sort_keys=True),
                    "headers_full_json": json.dumps(request_row.get("headers_full") or {}, sort_keys=True),
                    "timestamp": request_row.get("timestamp"),
                    "response_bytes": request_row.get("response_bytes"),
                    "audit_status": summary["status"],
                    "notes_json": json.dumps(summary.get("notes") or []),
                    "device_profile": request_row.get("device_profile"),
                    "requested_url": request_row.get("requested_url"),
                    "redirect_count": request_row.get("redirect_count"),
                    "redirect_chain_json": json.dumps(request_row.get("redirect_chain") or []),
                    "cacheability_json": json.dumps(request_row.get("cacheability") or {}, sort_keys=True),
                },
                collection_id=collection_id,
            )

        if graphql_row:
            self.db.insert_cloudflare_zone_cache_daily(
                property_id=request_rows[0]["property_id"] if request_rows else domain_config.property_id,
                property_name=request_rows[0]["property_name"] if request_rows else domain_config.property_name,
                normalized_domain=request_rows[0]["domain"] if request_rows else domain_config.domain,
                zone_name=graphql_row.get("zone_name"),
                zone_tag=graphql_row.get("zone_tag"),
                hostname=graphql_row.get("hostname"),
                metric_date=audit_date.isoformat(),
                zone_data={
                    "window_start": graphql_row.get("window_start"),
                    "window_end": graphql_row.get("window_end"),
                    "dataset_name": graphql_row.get("dataset_name"),
                    "total_requests": graphql_row.get("total_requests"),
                    "cached_requests": graphql_row.get("cached_requests"),
                    "uncached_requests": graphql_row.get("uncached_requests"),
                    "cache_hit_ratio": graphql_row.get("cache_hit_ratio"),
                    "cache_status_breakdown_json": json.dumps(graphql_row.get("cache_status_breakdown") or []),
                    "supported_dimensions_json": json.dumps(graphql_row.get("supported_dimensions") or []),
                    "supported_sum_fields_json": json.dumps(graphql_row.get("supported_sum_fields") or []),
                    "query_attempts_json": json.dumps(graphql_row.get("query_attempts") or []),
                    "raw_response_json": json.dumps(graphql_row, sort_keys=True),
                    "query_status": "ok" if graphql_row.get("ok") else "error",
                    "audit_status": graphql_status,
                },
                collection_id=collection_id,
            )

    def _fetch_zone_config_snapshot(self, domain_config: DomainConfig) -> Dict[str, Any]:
        try:
            return self._get_graphql_client().fetch_zone_config_snapshot(
                zone_name=domain_config.zone_name,
                zone_tag=domain_config.zone_tag,
            )
        except Exception as exc:
            return {
                "ok": False,
                "zone_name": domain_config.zone_name,
                "zone_tag": domain_config.zone_tag,
                "error": str(exc),
            }

    def _previous_domain_results(self, audit_date: date) -> List[Dict[str, Any]]:
        return self.db.get_cloudflare_cache_daily_summary(audit_date=(audit_date - timedelta(days=1)).isoformat())

    def _write_artifacts(
        self,
        *,
        audit_date: date,
        payload: Dict[str, Any],
        markdown: str,
    ) -> Dict[str, str]:
        output_dir = self.output_root / audit_date.isoformat()
        output_dir.mkdir(parents=True, exist_ok=True)

        json_path = output_dir / f"cloudflare_cache_audit_{audit_date.isoformat()}.json"
        csv_path = output_dir / f"cloudflare_cache_audit_{audit_date.isoformat()}.csv"
        md_path = output_dir / f"cloudflare_cache_audit_{audit_date.isoformat()}.md"
        html_path = output_dir / f"cloudflare_cache_audit_{audit_date.isoformat()}.html"

        json_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

        fieldnames = [
            "property_id",
            "property_name",
            "domain",
            "domain_status",
            "path",
            "device_profile",
            "variant_key",
            "variant_mode",
            "url_status",
            "http_status",
            "first_cache_status",
            "second_cache_status",
            "first_ttfb_ms",
            "second_ttfb_ms",
            "baseline_vs_warm_ttfb_delta_ms",
            "redirect_count",
            "expected_cacheability",
            "graphql_cache_hit_ratio",
            "graphql_total_requests",
            "graphql_cached_requests",
            "graphql_uncached_requests",
            "notes",
        ]
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for domain_row in payload["domain_results"]:
                for url_row in domain_row["url_summaries"]:
                    writer.writerow(
                        {
                            "property_id": domain_row["property_id"],
                            "property_name": domain_row["property_name"],
                            "domain": domain_row["domain"],
                            "domain_status": domain_row["domain_status"],
                            "path": url_row["path"],
                            "device_profile": url_row.get("device_profile"),
                            "variant_key": url_row["variant_key"],
                            "variant_mode": url_row.get("variant_mode"),
                            "url_status": url_row["status"],
                            "http_status": url_row["http_status"],
                            "first_cache_status": url_row["first_cache_status"],
                            "second_cache_status": url_row["second_cache_status"],
                            "first_ttfb_ms": url_row["first_ttfb_ms"],
                            "second_ttfb_ms": url_row["second_ttfb_ms"],
                            "baseline_vs_warm_ttfb_delta_ms": url_row["baseline_vs_warm_ttfb_delta_ms"],
                            "redirect_count": url_row.get("redirect_count"),
                            "expected_cacheability": (url_row.get("cacheability") or {}).get("expected_cacheability"),
                            "graphql_cache_hit_ratio": domain_row.get("graphql_cache_hit_ratio"),
                            "graphql_total_requests": domain_row.get("graphql_total_requests"),
                            "graphql_cached_requests": domain_row.get("graphql_cached_requests"),
                            "graphql_uncached_requests": domain_row.get("graphql_uncached_requests"),
                            "notes": "; ".join(url_row.get("notes") or []),
                        }
                    )

        md_path.write_text(markdown, encoding="utf-8")
        html_path.write_text(
            build_pib_email_html(report_date=audit_date, domain_results=payload["domain_results"]),
            encoding="utf-8",
        )

        if self.config["outputs"]["write_latest_copies"]:
            latest_json = self.output_root / "cloudflare_cache_audit_latest.json"
            latest_csv = self.output_root / "cloudflare_cache_audit_latest.csv"
            latest_md = self.output_root / "cloudflare_cache_audit_latest.md"
            latest_html = self.output_root / "cloudflare_cache_audit_latest.html"
            shutil.copyfile(json_path, latest_json)
            shutil.copyfile(csv_path, latest_csv)
            shutil.copyfile(md_path, latest_md)
            shutil.copyfile(html_path, latest_html)

        return {
            "json_path": str(json_path),
            "csv_path": str(csv_path),
            "markdown_path": str(md_path),
            "html_path": str(html_path),
        }

    def run(
        self,
        *,
        audit_date: Optional[date] = None,
        only_domain: Optional[str] = None,
        skip_synthetic: bool = False,
        skip_graphql: bool = False,
    ) -> Dict[str, Any]:
        audit_date = audit_date or date.today()
        graphql_metric_date = audit_date - timedelta(days=1) if self.config["graphql"]["use_previous_day_window"] else audit_date
        domains = self._domain_configs(only_domain=only_domain)
        collection_id = self.db.start_data_collection(
            collection_date=audit_date,
            collection_type="daily",
            data_source="cloudflare_cache_audit",
        )

        domain_results: List[Dict[str, Any]] = []
        failures = 0

        for domain_config in domains:
            self.logger.info("Auditing Cloudflare cache for %s", domain_config.domain)
            request_rows: List[Dict[str, Any]] = []
            url_summaries: List[Dict[str, Any]] = []
            observations: List[str] = []
            try:
                if not skip_synthetic:
                    synthetic_result = self._synthetic_checks_for_domain(domain_config, audit_date)
                    request_rows = synthetic_result["request_rows"]
                    url_summaries = synthetic_result["url_summaries"]
                else:
                    url_summaries = []

                uncached_count = sum(1 for row in url_summaries if row["status"] != "pass")
                synthetic_status = _worst_status([row["status"] for row in url_summaries]) if url_summaries else "warn"
                if uncached_count >= int(self.config["synthetic"]["domain_fail_on_uncached_url_count"]):
                    synthetic_status = _worst_status([synthetic_status, "fail"])
                    observations.append(f"{domain_config.domain} had {uncached_count} URLs miss warm-cache expectations")
                elif uncached_count >= int(self.config["synthetic"]["domain_warn_on_uncached_url_count"]):
                    observations.append(f"{domain_config.domain} had {uncached_count} URLs not clearly warm-cached")

                graphql_row: Dict[str, Any] = {}
                graphql_status = "warn"
                graphql_notes: List[str] = []
                if not skip_graphql and self.config["graphql"]["enabled"]:
                    try:
                        graphql_row = self._get_graphql_client().fetch_zone_daily_diagnostics(
                            zone_name=domain_config.zone_name,
                            zone_tag=domain_config.zone_tag,
                            metric_date=graphql_metric_date,
                            hostname=domain_config.domain,
                        )
                    except Exception as exc:
                        graphql_row = {
                            "ok": False,
                            "zone_name": domain_config.zone_name,
                            "zone_tag": domain_config.zone_tag,
                            "hostname": domain_config.domain,
                            "metric_date": graphql_metric_date.isoformat(),
                            "error": str(exc),
                        }
                    graphql_status, graphql_notes = self._evaluate_graphql_status(graphql_row)
                    observations.extend(graphql_notes)

                domain_status = _worst_status([synthetic_status, graphql_status])

                warm_hit_total = sum(
                    1 for row in url_summaries if (row.get("second_cache_status") or "").upper() in ["HIT"]
                )
                warm_hit_percent = round((warm_hit_total / len(url_summaries)) * 100, 2) if url_summaries else None
                homepage_row = next((row for row in url_summaries if row["path"] == "/" and row["variant_key"] == "clean_desktop"), None)
                mobile_homepage_row = next((row for row in url_summaries if row["path"] == "/" and row["variant_key"] == "clean_mobile"), None)
                query_rows = [row for row in url_summaries if row["variant_mode"] == "query_string"]
                if query_rows and any(row["status"] == "fail" for row in query_rows):
                    observations.append(f"{domain_config.domain} query-string variant failed on at least one device")

                zone_config_snapshot: Dict[str, Any] = {}
                if not skip_graphql and self.config["graphql"]["enabled"] and self.config["graphql"]["capture_zone_config_snapshot"]:
                    zone_config_snapshot = self._fetch_zone_config_snapshot(domain_config)
                    self.db.insert_cloudflare_zone_config_snapshot(
                        property_id=domain_config.property_id,
                        property_name=domain_config.property_name,
                        normalized_domain=domain_config.domain,
                        zone_name=domain_config.zone_name,
                        zone_tag=zone_config_snapshot.get("zone_tag") or domain_config.zone_tag,
                        snapshot_date=audit_date.isoformat(),
                        snapshot=zone_config_snapshot,
                        collection_id=collection_id,
                    )

                if request_rows or graphql_row:
                    self._persist_results(
                        collection_id=collection_id,
                        audit_date=audit_date,
                        domain_config=domain_config,
                        request_rows=request_rows,
                        url_summaries=url_summaries,
                        graphql_row=graphql_row,
                        graphql_status=graphql_status,
                    )

                domain_results.append(
                    {
                        "property_id": domain_config.property_id,
                        "property_name": domain_config.property_name,
                        "domain": domain_config.domain,
                        "zone_name": domain_config.zone_name,
                        "zone_tag": graphql_row.get("zone_tag") or domain_config.zone_tag,
                        "domain_status": domain_status,
                        "synthetic_status": synthetic_status,
                        "graphql_status": graphql_status,
                        "graphql_metric_date": graphql_metric_date.isoformat(),
                        "graphql_total_requests": graphql_row.get("total_requests"),
                        "graphql_cached_requests": graphql_row.get("cached_requests"),
                        "graphql_uncached_requests": graphql_row.get("uncached_requests"),
                        "graphql_cache_hit_ratio": graphql_row.get("cache_hit_ratio"),
                        "graphql_cache_status_breakdown": graphql_row.get("cache_status_breakdown") or [],
                        "zone_config_snapshot": zone_config_snapshot,
                        "homepage_status": homepage_row["status"] if homepage_row else None,
                        "homepage_second_ttfb_ms": homepage_row.get("second_ttfb_ms") if homepage_row else None,
                        "homepage_mobile_status": mobile_homepage_row["status"] if mobile_homepage_row else None,
                        "homepage_mobile_second_ttfb_ms": mobile_homepage_row.get("second_ttfb_ms") if mobile_homepage_row else None,
                        "warm_hit_percent": warm_hit_percent,
                        "url_summaries": url_summaries,
                        "observations": observations,
                    }
                )
            except Exception as exc:
                failures += 1
                self.logger.exception("Cache audit failed for %s", domain_config.domain)
                domain_results.append(
                    {
                        "property_id": domain_config.property_id,
                        "property_name": domain_config.property_name,
                        "domain": domain_config.domain,
                        "zone_name": domain_config.zone_name,
                        "zone_tag": domain_config.zone_tag,
                        "domain_status": "fail",
                        "synthetic_status": "fail",
                        "graphql_status": "fail",
                        "graphql_metric_date": graphql_metric_date.isoformat(),
                        "graphql_total_requests": None,
                        "graphql_cached_requests": None,
                        "graphql_uncached_requests": None,
                        "graphql_cache_hit_ratio": None,
                        "graphql_cache_status_breakdown": [],
                        "homepage_status": None,
                        "homepage_second_ttfb_ms": None,
                        "warm_hit_percent": None,
                        "url_summaries": [],
                        "observations": [str(exc)],
                    }
                )

        previous_day_results = self._previous_domain_results(audit_date)
        for domain_row in domain_results:
            previous = next((item for item in previous_day_results if item["property_id"] == domain_row["property_id"]), None)
            if not previous:
                continue
            current_ratio = domain_row.get("graphql_cache_hit_ratio")
            previous_ratio = previous.get("graphql_cache_hit_ratio")
            if current_ratio is None or previous_ratio is None:
                continue
            delta = current_ratio - previous_ratio
            if delta <= -float(self.config["graphql"]["day_over_day_drop_warn_points"]):
                domain_row["observations"].append(
                    f"{domain_row['domain']} cache hit ratio dropped {abs(delta):.2f} points vs previous day"
                )
                domain_row["domain_status"] = _worst_status([domain_row["domain_status"], "warn"])

        markdown = build_daily_markdown_report(
            report_date=audit_date,
            domain_results=domain_results,
            previous_domain_results=previous_day_results,
        )
        payload = {
            "audit_date": audit_date.isoformat(),
            "graphql_metric_date": graphql_metric_date.isoformat(),
            "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "config_path": str(self.config_path),
            "domain_results": domain_results,
            "previous_day_results": previous_day_results,
        }
        artifact_paths = self._write_artifacts(audit_date=audit_date, payload=payload, markdown=markdown)

        self.db.complete_data_collection(
            collection_id=collection_id,
            properties_collected=len(domains) - failures,
            properties_failed=failures,
            error_message="; ".join(
                f"{row['domain']}: {'; '.join(row['observations'][:1])}"
                for row in domain_results
                if row["domain_status"] == "fail"
            )[:500] or None,
        )

        return {
            "audit_date": audit_date.isoformat(),
            "artifact_paths": artifact_paths,
            "domains_total": len(domains),
            "domains_failed": failures,
            "domain_results": domain_results,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the daily Cloudflare cache audit.")
    parser.add_argument(
        "--config",
        default="/Users/mark/Property_Analytics/config/cloudflare_cache_audit.yaml",
        help="Path to cloudflare_cache_audit YAML config.",
    )
    parser.add_argument("--date", help="Audit date in YYYY-MM-DD format. Defaults to today.")
    parser.add_argument("--domain", help="Only audit one configured domain.")
    parser.add_argument("--skip-synthetic", action="store_true", help="Skip live synthetic requests.")
    parser.add_argument("--skip-graphql", action="store_true", help="Skip Cloudflare GraphQL diagnostics.")
    args = parser.parse_args()

    audit_date = date.fromisoformat(args.date) if args.date else None
    collector = CloudflareCacheAuditCollector(config_path=Path(args.config))
    result = collector.run(
        audit_date=audit_date,
        only_domain=args.domain,
        skip_synthetic=args.skip_synthetic,
        skip_graphql=args.skip_graphql,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["domains_failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
