#!/usr/bin/env python3
"""Read-only audit for the Resi Zaraz consent-management package."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ksm import resolve_secret


DEFAULT_DOMAINS = [
    "venterradev.com",
    "championsgreen-ga.com",
    "townestoneat359.com",
    "thevinekyle.com",
    "calaismidtownapartments.com",
]
DEFAULT_PURPOSE_NEEDLES = ["analytics", "performance", "marketing", "leasing", "attribution"]


def _api(token: str, path: str) -> dict:
    request = Request(
        f"https://api.cloudflare.com/client/v4{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def _localized_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("en", "en-US"):
            if isinstance(value.get(key), str):
                return value[key]
        for item in value.values():
            if isinstance(item, str):
                return item
    return ""


def _purpose_rows(consent: dict) -> list[dict]:
    purposes = consent.get("purposesWithTranslations") or consent.get("purposes") or {}
    rows: list[dict] = []
    if isinstance(purposes, dict):
        for purpose_id, purpose in sorted(purposes.items()):
            if not isinstance(purpose, dict):
                continue
            rows.append(
                {
                    "id": purpose_id,
                    "name": _localized_text(purpose.get("name")),
                    "description": _localized_text(purpose.get("description")),
                    "order": purpose.get("order"),
                }
            )
    elif isinstance(purposes, list):
        for purpose in purposes:
            if not isinstance(purpose, dict):
                continue
            rows.append(
                {
                    "id": purpose.get("id"),
                    "name": _localized_text(purpose.get("name")),
                    "description": _localized_text(purpose.get("description")),
                    "order": purpose.get("order"),
                }
            )
    return rows


def _tool_rows(config: dict, purpose_by_id: dict[str, dict]) -> list[dict]:
    tools = config.get("tools") or {}
    rows: list[dict] = []
    if not isinstance(tools, dict):
        return rows
    for tool_id, tool in sorted(tools.items()):
        if not isinstance(tool, dict):
            continue
        purpose_id = tool.get("defaultPurpose")
        rows.append(
            {
                "id": tool_id,
                "name": tool.get("name"),
                "component": tool.get("component"),
                "enabled": bool(tool.get("enabled")),
                "defaultPurpose": purpose_id,
                "purposeName": (purpose_by_id.get(purpose_id or "") or {}).get("name"),
                "purposeAssigned": bool(purpose_id and purpose_id in purpose_by_id),
            }
        )
    return rows


def _audit_domain(token: str, domain: str, purpose_needles: list[str]) -> dict:
    result = {
        "domain": domain,
        "status": "failed",
        "zoneFound": False,
        "failures": [],
        "warnings": [],
    }
    try:
        zones = _api(token, f"/zones?name={quote(domain)}")
        if not zones.get("success") or not zones.get("result"):
            result["failures"].append("Cloudflare zone not found")
            return result
        zone = zones["result"][0]
        result["zoneFound"] = True
        result["zoneStatus"] = zone.get("status")
        config_payload = _api(token, f"/zones/{zone['id']}/settings/zaraz/config")
    except HTTPError as exc:
        result["failures"].append(f"Cloudflare API returned HTTP {exc.code}")
        return result

    config = config_payload.get("result") or {}
    settings = config.get("settings") or {}
    consent = config.get("consent")
    purpose_rows = _purpose_rows(consent or {}) if isinstance(consent, dict) else []
    purpose_by_id = {row["id"]: row for row in purpose_rows if row.get("id")}
    tool_rows = _tool_rows(config, purpose_by_id)
    enabled_tools = [row for row in tool_rows if row["enabled"]]
    unassigned_tools = [row for row in enabled_tools if not row["purposeAssigned"]]
    purpose_haystack = " ".join(f"{row.get('name','')} {row.get('description','')}" for row in purpose_rows).lower()
    missing_needles = [needle for needle in purpose_needles if needle.lower() not in purpose_haystack]

    result.update(
        {
            "zarazAutoInject": bool(settings.get("autoInjectScript")),
            "consentEnabled": bool(isinstance(consent, dict) and consent.get("enabled")),
            "consentModalHidden": bool(isinstance(consent, dict) and consent.get("hideModal")),
            "consentCookieName": consent.get("cookieName") if isinstance(consent, dict) else None,
            "customCssPresent": bool(isinstance(consent, dict) and (consent.get("customCSS") or "").strip()),
            "purposeCount": len(purpose_rows),
            "purposes": purpose_rows,
            "toolCount": len(tool_rows),
            "enabledToolCount": len(enabled_tools),
            "tools": tool_rows,
        }
    )

    if not result["zarazAutoInject"]:
        result["failures"].append("Zaraz auto-injection is not enabled")
    if not result["consentEnabled"]:
        result["failures"].append("Zaraz Consent Management is not enabled")
    if not purpose_rows:
        result["failures"].append("No consent purposes are configured")
    if missing_needles:
        result["warnings"].append(f"Purpose text does not contain expected terms: {', '.join(missing_needles)}")
    if unassigned_tools:
        names = ", ".join(f"{row['id']}:{row.get('name')}" for row in unassigned_tools)
        result["failures"].append(f"Enabled tools are not assigned to configured consent purposes: {names}")
    if result["consentModalHidden"]:
        result["warnings"].append("Cloudflare CMP modal is hidden; live proof must show the approved Worker/UX consent entry point")

    result["status"] = "passed" if not result["failures"] else "failed"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only audit of Zaraz CMP readiness for Resi package domains.")
    parser.add_argument("--domain", action="append", help="Domain to audit. Defaults to Pilot plus current Resi cohort.")
    parser.add_argument(
        "--expected-purpose-term",
        action="append",
        dest="purpose_terms",
        help="Expected purpose-name/description term. Defaults to analytics/performance/marketing/leasing/attribution.",
    )
    parser.add_argument("--output", help="Output JSON path.")
    args = parser.parse_args()

    token = resolve_secret(
        description="Cloudflare Zaraz Editor token",
        default_notation="keeper://hZFfWzx_qwOn19J-zICiPg/field/password",
        direct_env_var=None,
        default_profile="marketingops",
    ).strip()
    domains = args.domain or DEFAULT_DOMAINS
    purpose_terms = args.purpose_terms or DEFAULT_PURPOSE_NEEDLES
    checked_at = datetime.now(timezone.utc).isoformat()
    results = [_audit_domain(token, domain, purpose_terms) for domain in domains]
    failures = [item for item in results if item["status"] != "passed"]
    payload = {
        "checked_at": checked_at,
        "status": "failed" if failures else "passed",
        "scope": "read_only_zaraz_consent_package_audit",
        "domains": results,
        "summary": {
            "domain_count": len(results),
            "passed": len(results) - len(failures),
            "failed": len(failures),
        },
    }

    if args.output:
        output = Path(args.output)
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output = ROOT / "reports" / "cloudflare_zaraz" / "consent_management" / f"{stamp}_zaraz_consent_audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "output": str(output), "summary": payload["summary"]}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
