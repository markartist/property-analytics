#!/usr/bin/env python3
"""
Helpers for rendering and managing Cloudflare cache rules for the pilot domains.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests
import yaml

from ops.cloudflare.cloudflare_auth import resolve_cloudflare_token


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"


class CloudflareRulesError(RuntimeError):
    """Raised when a Cloudflare Rulesets API request fails."""


@dataclass
class PilotZone:
    property_id: str
    property_name: str
    domain: str
    zone_name: str
    zone_tag: Optional[str] = None


def _json_quote(value: str) -> str:
    return json.dumps(value)


def _group_join(parts: Iterable[str], operator: str) -> str:
    filtered = [part for part in parts if part]
    if not filtered:
        return "true"
    if len(filtered) == 1:
        return filtered[0]
    return "(" + f" {operator} ".join(filtered) + ")"


def _or(parts: Iterable[str]) -> str:
    return _group_join(parts, "or")


def _and(parts: Iterable[str]) -> str:
    return _group_join(parts, "and")


class CloudflareCacheRulesManager:
    """Thin Cloudflare Rulesets API client for cache-rule rollout work."""

    def __init__(self, *, timeout_seconds: int = 30):
        resolved = resolve_cloudflare_token()
        self.token = resolved.token
        self.token_source = resolved.source
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            }
        )

    @staticmethod
    def load_config(path: Path) -> Dict[str, Any]:
        with Path(path).open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        expected_statuses: Optional[Iterable[int]] = None,
    ) -> Dict[str, Any]:
        url = f"{CLOUDFLARE_API_BASE}{path}"
        response = self.session.request(
            method,
            url,
            params=params,
            json=payload,
            timeout=self.timeout_seconds,
        )
        if expected_statuses and response.status_code not in set(expected_statuses):
            raise CloudflareRulesError(
                f"{method} {path} returned {response.status_code}: {response.text[:500]}"
            )
        response.raise_for_status()
        decoded = response.json()
        if not decoded.get("success", False):
            errors = "; ".join(item.get("message", "unknown Cloudflare error") for item in decoded.get("errors", []))
            raise CloudflareRulesError(errors or f"{method} {path} failed")
        return decoded

    def resolve_zone(self, zone_name: str) -> Dict[str, Any]:
        payload = self._request("GET", "/zones", params={"name": zone_name, "status": "active", "per_page": 1})
        results = payload.get("result") or []
        if not results:
            raise CloudflareRulesError(f"No active zone found for {zone_name}")
        return results[0]

    def list_rulesets(self, zone_tag: str) -> List[Dict[str, Any]]:
        payload = self._request("GET", f"/zones/{zone_tag}/rulesets")
        return payload.get("result") or []

    def get_phase_entrypoint(self, zone_tag: str, phase: str) -> Optional[Dict[str, Any]]:
        response = self.session.get(
            f"{CLOUDFLARE_API_BASE}/zones/{zone_tag}/rulesets/phases/{phase}/entrypoint",
            timeout=self.timeout_seconds,
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        decoded = response.json()
        if not decoded.get("success", False):
            errors = "; ".join(item.get("message", "unknown Cloudflare error") for item in decoded.get("errors", []))
            raise CloudflareRulesError(errors or f"Failed to fetch phase entrypoint for {phase}")
        return decoded.get("result")

    def create_phase_entrypoint(self, zone_tag: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        decoded = self._request("POST", f"/zones/{zone_tag}/rulesets", payload=payload)
        return decoded.get("result") or {}

    def update_ruleset(self, zone_tag: str, ruleset_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        decoded = self._request("PUT", f"/zones/{zone_tag}/rulesets/{ruleset_id}", payload=payload)
        return decoded.get("result") or {}

    def purge_zone(self, zone_tag: str, *, files: Optional[List[str]] = None, purge_everything: bool = False) -> Dict[str, Any]:
        if purge_everything == bool(files):
            raise CloudflareRulesError("Specify either files or purge_everything.")
        payload: Dict[str, Any] = {"purge_everything": True} if purge_everything else {"files": files}
        decoded = self._request("POST", f"/zones/{zone_tag}/purge_cache", payload=payload)
        return decoded.get("result") or {}

    @staticmethod
    def pilot_zones(config: Dict[str, Any], only_domain: Optional[str] = None) -> List[PilotZone]:
        zones: List[PilotZone] = []
        for entry in config.get("domains", []):
            domain = entry["domain"].lower()
            if only_domain and domain != only_domain.lower():
                continue
            zones.append(
                PilotZone(
                    property_id=str(entry["property_id"]),
                    property_name=entry["property_name"],
                    domain=domain,
                    zone_name=entry.get("zone_name", domain),
                    zone_tag=entry.get("zone_tag"),
                )
            )
        return zones

    @staticmethod
    def effective_edge_ttl_seconds(config: Dict[str, Any], zone: Dict[str, Any]) -> tuple[int, List[str]]:
        desired = int(config["edge_ttl"]["desired_seconds"])
        legacy_id = (((zone.get("plan") or {}).get("legacy_id")) or "free").lower()
        minimum_map = {str(key).lower(): int(value) for key, value in config["edge_ttl"]["minimum_seconds_by_plan"].items()}
        minimum = int(minimum_map.get(legacy_id, desired))
        effective = max(desired, minimum)
        notes: List[str] = []
        if effective != desired:
            notes.append(
                f"Plan {legacy_id!r} enforces an effective edge TTL of {effective}s instead of the requested {desired}s."
            )
        return effective, notes

    @staticmethod
    def build_rule_expressions(config: Dict[str, Any], zone: PilotZone) -> Dict[str, str]:
        bypass = config["bypass"]
        allowed_methods = [str(item).upper() for item in bypass["allowed_methods"]]

        method_bypass = _and([f'http.request.method ne {_json_quote(method)}' for method in allowed_methods])
        path_bypass = [
            f"starts_with(http.request.uri.path, {_json_quote(prefix)})"
            for prefix in bypass.get("path_prefixes", [])
        ]
        query_bypass = [
            f"http.request.uri.query contains {_json_quote(fragment)}"
            for fragment in bypass.get("query_fragments", [])
        ]
        cookie_bypass = [
            f"http.cookie contains {_json_quote(fragment)}"
            for fragment in bypass.get("cookie_fragments", [])
        ]

        bypass_conditions = [method_bypass, *path_bypass, *query_bypass, *cookie_bypass]
        bypass_expression = _or(bypass_conditions)

        homepage_path_expr = _or(
            [f"http.request.uri.path eq {_json_quote(path)}" for path in config["phase1"]["homepage_paths"]]
        )
        homepage_eligible_expression = _and(
            [
                f"http.host eq {_json_quote(zone.domain)}",
                _or([f'http.request.method eq {_json_quote(method)}' for method in allowed_methods]),
                homepage_path_expr,
                *[f"not ({expr})" for expr in path_bypass],
                *[f"not ({expr})" for expr in query_bypass],
                *[f"not ({expr})" for expr in cookie_bypass],
            ]
        )

        return {
            "bypass_expression": bypass_expression,
            "homepage_eligible_expression": homepage_eligible_expression,
        }

    def build_phase1_ruleset_payload(self, config: Dict[str, Any], zone: PilotZone, zone_details: Dict[str, Any]) -> Dict[str, Any]:
        expressions = self.build_rule_expressions(config, zone)
        effective_ttl_seconds, ttl_notes = self.effective_edge_ttl_seconds(config, zone_details)
        managed_marker = config["ruleset"]["managed_marker"]
        rules = [
            {
                "ref": "pilot_bypass_dynamic_and_authenticated",
                "description": "Bypass admin, preview, session, and non-idempotent traffic.",
                "expression": expressions["bypass_expression"],
                "action": "set_cache_settings",
                "action_parameters": {"cache": False},
                "enabled": True,
            },
            {
                "ref": "pilot_cache_homepage_html",
                "description": "Cache anonymous homepage HTML for pilot rollout.",
                "expression": expressions["homepage_eligible_expression"],
                "action": "set_cache_settings",
                "action_parameters": {
                    "cache": True,
                    "edge_ttl": {
                        "mode": "override_origin",
                        "default": effective_ttl_seconds,
                    },
                    "browser_ttl": {
                        "mode": config["browser_ttl"]["mode"],
                    },
                },
                "enabled": True,
            },
        ]
        return {
            "name": config["ruleset"]["name"],
            "description": f"{config['ruleset']['description']} [{managed_marker}]",
            "kind": "zone",
            "phase": config["ruleset"]["phase"],
            "rules": rules,
            "metadata": {
                "managed_marker": managed_marker,
                "phase": config["phase"],
                "effective_edge_ttl_seconds": effective_ttl_seconds,
                "ttl_notes": ttl_notes,
                "cache_key_strategy": config["cache_key"]["strategy"],
            },
        }
