#!/usr/bin/env python3
"""Apply the governed Zaraz CMP purpose package to selected Cloudflare zones."""

from __future__ import annotations

import argparse
import copy
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
    "championsgreen-ga.com",
    "townestoneat359.com",
    "thevinekyle.com",
    "calaismidtownapartments.com",
]
CONSENT_CONTRACT_PATH = ROOT / "ops/cloudflare/shared/resi-consent-widget/contract.json"
CONSENT_CONTRACT = json.loads(CONSENT_CONTRACT_PATH.read_text(encoding="utf-8"))
CONSENT_MODAL = CONSENT_CONTRACT["modal"]
ANALYTICS_PURPOSE = CONSENT_MODAL["purposes"]["analytics_performance"]
MARKETING_PURPOSE = CONSENT_MODAL["purposes"]["marketing_leasing_attribution"]
ANALYTICS_PURPOSE_ID = ANALYTICS_PURPOSE["id"]
MARKETING_PURPOSE_ID = MARKETING_PURPOSE["id"]
CONSENT_MODAL_CSS = """dialog::backdrop {
  background: rgba(21, 40, 75, 0.16);
}

.cf_modal {
  --padding: 18px;
  position: fixed;
  left: 50%;
  right: auto;
  bottom: 24px;
  width: min(760px, calc(100vw - 32px));
  max-width: 760px;
  max-height: min(76vh, 620px);
  background: #FFFFFF;
  color: #15284B;
  border: 1px solid #D6D6D2;
  border-radius: 10px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.18);
  font-family: Lato, Arial, sans-serif;
  overflow: auto;
  transform: translateX(-50%);
}

.title_container {
  display: none;
}

.cf_modal p,
.cf_consent-intro {
  color: #294782;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
}

.cf_modal a {
  color: #3D66B9;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cf_consent-container {
  margin-top: 14px;
}

.cf_consent-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  background: transparent;
  border: 0;
}

.cf_button {
  height: 34px;
  margin: 0;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  line-height: 34px;
}

.cf_button--accept {
  background: #15284B;
  color: #FFFFFF;
}

.cf_button--save {
  background: #3D66B9;
  color: #FFFFFF;
}

.cf_button--reject {
  background: #FFFFFF;
  color: #15284B;
  border: 1px solid #D6D6D2;
}

.cf_button:hover {
  filter: brightness(0.95);
}

.cf_button:focus,
.cf_modal a:focus {
  outline: 3px solid #7DCAC2;
  outline-offset: 2px;
}

@media (min-width: 760px) {
  .cf_modal {
    display: block;
  }

  .cf_consent-buttons {
    margin-top: 16px;
    white-space: nowrap;
  }
}

@media (max-width: 620px) {
  .cf_modal {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
    max-width: none;
    max-height: 68vh;
    transform: none;
  }

  .cf_consent-buttons {
    display: grid;
    grid-template-columns: 1fr;
  }

  .cf_button {
    width: 100%;
  }
}"""


def _api(token: str, path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def _consent_config() -> dict:
    return {
        "buttonTextTranslations": {
            "accept_all": {},
            "confirm_my_choices": {},
            "reject_all": {},
            "view_all_partners": {},
        },
        "consentModalIntroHTMLWithTranslations": {
            "en": CONSENT_MODAL["intro_html_en"]
        },
        "cookieName": "zaraz-consent",
        "customCSS": CONSENT_MODAL_CSS,
        "customIntroDisclaimerDismissed": True,
        "defaultLanguage": "en",
        "enabled": True,
        "hideModal": bool(CONSENT_MODAL["hide_native_modal"]),
        "purposesWithTranslations": {
            ANALYTICS_PURPOSE_ID: {
                "description": {"en": ANALYTICS_PURPOSE["description_en"]},
                "name": {"en": ANALYTICS_PURPOSE["name_en"]},
                "order": 0,
            },
            MARKETING_PURPOSE_ID: {
                "description": {"en": MARKETING_PURPOSE["description_en"]},
                "name": {"en": MARKETING_PURPOSE["name_en"]},
                "order": 100,
            },
        },
        "tcfCompliant": False,
    }


def _tool_purpose(tool: dict) -> str:
    text = f"{tool.get('name','')} {tool.get('component','')}".lower()
    if any(token in text for token in ("heap", "contentsquare", "resi event", "resi pixel", "bridge")):
        return MARKETING_PURPOSE_ID
    return ANALYTICS_PURPOSE_ID


def _redact_config(config: dict) -> dict:
    redacted = {
        "settings": config.get("settings"),
        "consent": copy.deepcopy(config.get("consent")),
        "tools": {},
        "triggers": list((config.get("triggers") or {}).keys()) if isinstance(config.get("triggers"), dict) else None,
    }
    for tool_id, tool in (config.get("tools") or {}).items():
        redacted["tools"][tool_id] = {
            "name": tool.get("name"),
            "component": tool.get("component"),
            "enabled": tool.get("enabled"),
            "defaultPurpose": tool.get("defaultPurpose"),
            "actionIds": list((tool.get("actions") or {}).keys()) if isinstance(tool.get("actions"), dict) else [],
        }
    return redacted


def _apply_domain(token: str, domain: str, apply: bool) -> dict:
    run = {"domain": domain, "status": "planned", "changes": [], "errors": []}
    zones = _api(token, f"/zones?name={quote(domain)}")
    if not zones.get("success") or not zones.get("result"):
        run["status"] = "failed"
        run["errors"].append("Cloudflare zone not found")
        return run
    zone_id = zones["result"][0]["id"]
    config = _api(token, f"/zones/{zone_id}/settings/zaraz/config").get("result") or {}
    updated = copy.deepcopy(config)
    before = _redact_config(config)

    if updated.get("consent") != _consent_config():
        updated["consent"] = _consent_config()
        run["changes"].append("set_consent_config")
    for tool_id, tool in (updated.get("tools") or {}).items():
        if not isinstance(tool, dict) or not tool.get("enabled"):
            continue
        wanted = _tool_purpose(tool)
        if tool.get("defaultPurpose") != wanted:
            tool["defaultPurpose"] = wanted
            run["changes"].append(f"assign_tool_purpose:{tool_id}:{wanted}")

    after = _redact_config(updated)
    run["before"] = before
    run["after"] = after
    if not run["changes"]:
        run["status"] = "unchanged"
        return run
    if not apply:
        return run
    try:
        response = _api(token, f"/zones/{zone_id}/settings/zaraz/config", method="PUT", payload=updated)
    except HTTPError as exc:
        run["status"] = "failed"
        run["errors"].append(f"Cloudflare PUT returned HTTP {exc.code}")
        return run
    if not response.get("success", True):
        run["status"] = "failed"
        run["errors"].append("Cloudflare PUT returned unsuccessful response")
        return run
    run["status"] = "applied"
    return run


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply the governed Zaraz CMP purpose package.")
    parser.add_argument("--domain", action="append", help="Domain to update. Defaults to current live Resi cohort.")
    parser.add_argument("--apply", action="store_true", help="Actually write the Zaraz config. Default is dry-run.")
    parser.add_argument("--output", help="Output redacted run packet path.")
    args = parser.parse_args()

    token = resolve_secret(
        description="Cloudflare Zaraz Editor token",
        default_notation="keeper://hZFfWzx_qwOn19J-zICiPg/field/password",
        direct_env_var=None,
        default_profile="marketingops",
    ).strip()
    domains = args.domain or DEFAULT_DOMAINS
    checked_at = datetime.now(timezone.utc).isoformat()
    results = [_apply_domain(token, domain, args.apply) for domain in domains]
    failures = [item for item in results if item["status"] == "failed"]
    payload = {
        "checked_at": checked_at,
        "mode": "apply" if args.apply else "dry_run",
        "status": "failed" if failures else "passed",
        "consent_contract": {
            "path": str(CONSENT_CONTRACT_PATH),
            "version": CONSENT_CONTRACT["version"],
            "owner": CONSENT_CONTRACT["owner"],
            "modal_owner": CONSENT_MODAL["owner"],
        },
        "results": results,
        "summary": {
            "domain_count": len(results),
            "applied": sum(1 for item in results if item["status"] == "applied"),
            "planned": sum(1 for item in results if item["status"] == "planned"),
            "unchanged": sum(1 for item in results if item["status"] == "unchanged"),
            "failed": len(failures),
        },
    }
    if args.output:
        output = Path(args.output)
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        suffix = "apply" if args.apply else "dry_run"
        output = ROOT / "reports" / "cloudflare_zaraz" / "consent_management" / f"{stamp}_zaraz_consent_{suffix}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "mode": payload["mode"], "output": str(output), "summary": payload["summary"]}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
