#!/usr/bin/env python3
"""
Reusable GTMetrix API collector for Property Analytics.
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import requests

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import resolve_secret, resolve_secret_from_multiple_notations


DEFAULT_API_KEY_PATH = Path("/Users/mark/Property_Analytics/Spotlight_Properties_Report/config/GTMetrix_API_Key.txt")
DEFAULT_API_KEY_NOTATION = "keeper://lkluImtpQHpBWcldViKfiQ/field/password"
DEFAULT_API_KEY_NOTATION_ENV_VARS = (
    "KSM_GTMETRIX_API_KEY_NOTATION",
    "KSM_GTMETRIX_API_KEY_FILE_NOTATION",
)


@dataclass
class GTMetrixSettings:
    api_key_path: Path = DEFAULT_API_KEY_PATH
    default_api_key_notation: str = DEFAULT_API_KEY_NOTATION
    api_key_notation_env_vars: tuple[str, ...] = DEFAULT_API_KEY_NOTATION_ENV_VARS
    api_key_env_var: str = "GTMETRIX_API_KEY"
    ksm_profile: str = "marketingops"
    location: str = "4"  # San Antonio, TX, USA
    browser: str = "3"   # Chrome Desktop (Lighthouse-capable)
    simulate_device: Optional[str] = None
    throttle: Optional[str] = None
    poll_interval_seconds: int = 10
    max_wait_seconds: int = 480
    request_timeout_seconds: int = 30


class GTMetrixCollector:
    API_BASE_URL = "https://gtmetrix.com/api/2.0"

    def __init__(self, settings: Optional[GTMetrixSettings] = None):
        self.settings = settings or GTMetrixSettings()
        self.session = requests.Session()
        self.api_key = self._load_api_key()
        self.rate_limit_snapshots: List[Dict[str, object]] = []

    def _load_api_key(self) -> str:
        env_path = os.getenv("GTMETRIX_API_KEY_PATH")
        fallback_path = Path(env_path) if env_path else self.settings.api_key_path

        if not any(os.getenv(var) for var in self.settings.api_key_notation_env_vars):
            return resolve_secret(
                description="GTMetrix API key",
                notation_env_var=self.settings.api_key_notation_env_vars[0],
                default_notation=self.settings.default_api_key_notation,
                direct_env_var=self.settings.api_key_env_var,
                file_path=fallback_path,
                default_profile=self.settings.ksm_profile,
            )

        return resolve_secret_from_multiple_notations(
            description="GTMetrix API key",
            notation_env_vars=list(self.settings.api_key_notation_env_vars),
            direct_env_var=self.settings.api_key_env_var,
            file_path=fallback_path,
            default_profile=self.settings.ksm_profile,
        )

    def _headers(self) -> Dict[str, str]:
        return {"Content-Type": "application/vnd.api+json"}

    def _capture_rate_limit_headers(self, response: requests.Response, stage: str) -> None:
        snapshot = {
            "observed_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "stage": stage,
            "status_code": response.status_code,
            "url": response.url,
            "x_ratelimit_limit": response.headers.get("x-ratelimit-limit"),
            "x_ratelimit_remaining": response.headers.get("x-ratelimit-remaining"),
            "x_ratelimit_reset": response.headers.get("x-ratelimit-reset"),
            "retry_after": response.headers.get("retry-after"),
        }
        if any(
            snapshot[key] is not None
            for key in ("x_ratelimit_limit", "x_ratelimit_remaining", "x_ratelimit_reset", "retry_after")
        ):
            self.rate_limit_snapshots.append(snapshot)

    def consume_rate_limit_snapshots(self) -> List[Dict[str, object]]:
        snapshots = list(self.rate_limit_snapshots)
        self.rate_limit_snapshots.clear()
        return snapshots

    def _raise_for_status_with_details(self, response: requests.Response) -> None:
        self._capture_rate_limit_headers(response, stage="response")
        if response.ok:
            return

        detail_parts = []
        try:
            payload = response.json()
        except ValueError:
            payload = None

        if isinstance(payload, dict):
            errors = payload.get("errors")
            if isinstance(errors, list):
                for error in errors:
                    if not isinstance(error, dict):
                        continue
                    title = str(error.get("title", "")).strip()
                    detail = str(error.get("detail", "")).strip()
                    status = str(error.get("status", "")).strip()
                    joined = " | ".join(part for part in [status, title, detail] if part)
                    if joined:
                        detail_parts.append(joined)
            else:
                detail = payload.get("message") or payload.get("detail") or payload.get("error")
                if detail:
                    detail_parts.append(str(detail).strip())

        if not detail_parts:
            body = response.text.strip()
            if body:
                detail_parts.append(body[:500])

        remaining = response.headers.get("x-ratelimit-remaining")
        reset = response.headers.get("x-ratelimit-reset")
        retry_after = response.headers.get("retry-after")
        rate_parts = []
        if remaining is not None:
            rate_parts.append(f"remaining={remaining}")
        if reset is not None:
            rate_parts.append(f"reset={reset}")
        if retry_after is not None:
            rate_parts.append(f"retry_after={retry_after}")
        if rate_parts:
            detail_parts.append("rate_limit[" + ", ".join(rate_parts) + "]")

        detail_suffix = f": {'; '.join(detail_parts)}" if detail_parts else ""
        raise requests.HTTPError(
            f"{response.status_code} {response.reason} for url: {response.url}{detail_suffix}",
            response=response,
        )

    def create_test(self, url: str) -> str:
        attributes = {
            "url": url,
            "location": self.settings.location,
            "browser": self.settings.browser,
        }
        if self.settings.simulate_device:
            attributes["simulate_device"] = self.settings.simulate_device
        if self.settings.throttle:
            attributes["throttle"] = self.settings.throttle

        response = self.session.post(
            f"{self.API_BASE_URL}/tests",
            auth=(self.api_key, ""),
            headers=self._headers(),
            json={
                "data": {
                    "type": "test",
                    "attributes": attributes,
                }
            },
            timeout=self.settings.request_timeout_seconds,
        )
        self._capture_rate_limit_headers(response, stage="create_test")
        self._raise_for_status_with_details(response)
        payload = response.json()
        return payload["data"]["id"]

    def wait_for_report(self, test_id: str) -> Dict:
        started = time.time()
        while (time.time() - started) < self.settings.max_wait_seconds:
            response = self.session.get(
                f"{self.API_BASE_URL}/tests/{test_id}",
                auth=(self.api_key, ""),
                headers=self._headers(),
                timeout=self.settings.request_timeout_seconds,
            )
            self._capture_rate_limit_headers(response, stage="poll_test")

            if response.status_code == 303:
                report_url = response.headers.get("Location", "")
                if not report_url:
                    raise RuntimeError("GTMetrix test completed without a report URL")
                if not report_url.startswith("http"):
                    report_url = f"{self.API_BASE_URL}{report_url}"
                report_response = self.session.get(
                    report_url,
                    auth=(self.api_key, ""),
                    headers=self._headers(),
                    timeout=self.settings.request_timeout_seconds,
                )
                self._capture_rate_limit_headers(report_response, stage="fetch_report")
                self._raise_for_status_with_details(report_response)
                return report_response.json()

            self._raise_for_status_with_details(response)
            payload = response.json()
            data = payload.get("data", {})
            if data.get("type") == "report":
                return payload

            state = data.get("attributes", {}).get("state")
            if state == "error":
                raise RuntimeError(data.get("attributes", {}).get("error", "GTMetrix test failed"))

            time.sleep(self.settings.poll_interval_seconds)

        raise TimeoutError(f"GTMetrix test {test_id} timed out after {self.settings.max_wait_seconds}s")

    def parse_report(self, report_data: Dict) -> Dict:
        data = report_data.get("data", {})
        attrs = data.get("attributes", {})
        links = data.get("links", {})
        return {
            "pagespeed_score": attrs.get("pagespeed_score", attrs.get("performance_score")),
            "yslow_score": attrs.get("yslow_score"),
            "structure_score": attrs.get("structure_score", attrs.get("yslow_score")),
            "fully_loaded_time_ms": attrs.get("fully_loaded_time"),
            "onload_time_ms": attrs.get("onload_time"),
            "first_contentful_paint_ms": attrs.get("first_contentful_paint", attrs.get("first_paint_time")),
            "time_to_interactive_ms": attrs.get("time_to_interactive", attrs.get("dom_interactive_time")),
            "page_bytes": attrs.get("page_bytes"),
            "page_requests": attrs.get("page_requests"),
            "test_server_location": attrs.get("location", self.settings.location),
            "test_browser": attrs.get("browser_name", attrs.get("browser", self.settings.browser)),
            "report_url": links.get("report_url"),
            "raw_state": attrs.get("state"),
        }

    def run_test(self, url: str) -> Dict:
        test_id = self.create_test(url)
        report_data = self.wait_for_report(test_id)
        parsed = self.parse_report(report_data)
        parsed["test_id"] = test_id
        return parsed
