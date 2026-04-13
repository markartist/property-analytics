#!/usr/bin/env python3
"""
Render or apply homepage-only Cloudflare full-page cache rules for the pilot domains.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List

_repo_root = str(Path(__file__).resolve().parents[2])
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from ops.cloudflare.cache_rules_manager import CloudflareCacheRulesManager
from ops.cloudflare.cache_rules_manager import CloudflareRulesError


DEFAULT_CONFIG_PATH = "/Users/mark/Property_Analytics/config/cloudflare_full_page_cache.yaml"
DEFAULT_EXPORT_ROOT = "/Users/mark/Property_Analytics/outputs/cloudflare_full_page_cache"


def export_snapshot(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def managed_by_us(entrypoint: Dict[str, Any], marker: str) -> bool:
    text = " ".join(
        str(value or "")
        for value in (
            entrypoint.get("name"),
            entrypoint.get("description"),
        )
    )
    return marker in text


def summarize_ruleset(entrypoint: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for rule in entrypoint.get("rules", []):
        rows.append(
            {
                "ref": rule.get("ref"),
                "description": rule.get("description"),
                "action": rule.get("action"),
                "expression": rule.get("expression"),
                "enabled": rule.get("enabled"),
                "action_parameters": rule.get("action_parameters"),
            }
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Render or apply Cloudflare Phase 1 homepage cache rules.")
    parser.add_argument("--config", default=DEFAULT_CONFIG_PATH, help="Path to Cloudflare full-page cache YAML config.")
    parser.add_argument("--domain", help="Only operate on a single configured domain.")
    parser.add_argument("--export-root", default=DEFAULT_EXPORT_ROOT, help="Directory for JSON snapshots and dry-run plans.")
    parser.add_argument("--apply", action="store_true", help="Apply the rendered ruleset to Cloudflare.")
    parser.add_argument(
        "--allow-overwrite",
        action="store_true",
        help="Allow replacing an existing cache-settings entrypoint not previously managed by this script.",
    )
    args = parser.parse_args()

    manager = CloudflareCacheRulesManager()
    config = manager.load_config(Path(args.config))
    marker = config["ruleset"]["managed_marker"]
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    export_root = Path(args.export_root) / timestamp
    results: List[Dict[str, Any]] = []
    exit_code = 0

    for pilot_zone in manager.pilot_zones(config, only_domain=args.domain):
        zone_result: Dict[str, Any] = {
            "domain": pilot_zone.domain,
            "zone_name": pilot_zone.zone_name,
            "action": "dry_run",
        }
        try:
            zone_details = manager.resolve_zone(pilot_zone.zone_name)
            pilot_zone.zone_tag = pilot_zone.zone_tag or zone_details["id"]
            entrypoint = manager.get_phase_entrypoint(pilot_zone.zone_tag, config["ruleset"]["phase"])
            rendered_payload = manager.build_phase1_ruleset_payload(config, pilot_zone, zone_details)

            zone_result.update(
                {
                    "zone_tag": pilot_zone.zone_tag,
                    "plan_name": (zone_details.get("plan") or {}).get("name"),
                    "current_entrypoint_exists": bool(entrypoint),
                    "current_entrypoint_managed_by_us": managed_by_us(entrypoint or {}, marker) if entrypoint else False,
                    "current_rules": summarize_ruleset(entrypoint or {}),
                    "rendered_rules": summarize_ruleset(rendered_payload),
                    "rendered_payload": rendered_payload,
                }
            )

            export_snapshot(export_root / f"{pilot_zone.domain}.json", zone_result)

            if not args.apply:
                results.append(zone_result)
                continue

            if entrypoint and not managed_by_us(entrypoint, marker) and not args.allow_overwrite:
                raise CloudflareRulesError(
                    "Existing cache-settings entrypoint is not marked as Property Analytics managed. "
                    "Re-run with --allow-overwrite only after review."
                )

            if entrypoint:
                updated = manager.update_ruleset(
                    pilot_zone.zone_tag,
                    entrypoint["id"],
                    rendered_payload,
                )
                zone_result["action"] = "updated"
                zone_result["applied_ruleset_id"] = updated.get("id")
                zone_result["applied_rules"] = summarize_ruleset(updated)
            else:
                created = manager.create_phase_entrypoint(pilot_zone.zone_tag, rendered_payload)
                zone_result["action"] = "created"
                zone_result["applied_ruleset_id"] = created.get("id")
                zone_result["applied_rules"] = summarize_ruleset(created)

            export_snapshot(export_root / f"{pilot_zone.domain}.applied.json", zone_result)
            results.append(zone_result)
        except Exception as exc:
            exit_code = 1
            zone_result["error"] = str(exc)
            export_snapshot(export_root / f"{pilot_zone.domain}.error.json", zone_result)
            results.append(zone_result)

    print(json.dumps({"export_root": str(export_root), "results": results}, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
