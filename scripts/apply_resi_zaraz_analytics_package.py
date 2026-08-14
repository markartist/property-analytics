#!/usr/bin/env python3
"""Apply the governed Resi Zaraz analytics package for one property.

This tool is intentionally narrow:
- preserve existing Zaraz tools
- upsert GA4, Heap v6, Ahrefs, and the Resi event bridge from the manifest
- emit redacted before/after evidence
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import socket
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.ahrefs_auth import resolve_ahrefs_credentials
from utils.ksm import resolve_secret


ANALYTICS_PURPOSE_ID = "AaID"
MARKETING_PURPOSE_ID = "fNmB"
EXPECTED_HEAP_MODE = "interaction_only_queue_v6_input_only_cs_verify_home_204"
CS_VERIFY_SUPPRESS_PATH = "/?vtr_cs_verify_suppressed=1"
API_RETRIES = 3
API_RETRY_WAIT_SECONDS = 4


def _api(token: str, path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    transient_errors = (TimeoutError, socket.timeout, URLError)
    last_error: Exception | None = None
    for attempt in range(1, API_RETRIES + 1):
        try:
            with urlopen(request, timeout=45) as response:
                return json.load(response)
        except HTTPError:
            raise
        except transient_errors as exc:
            last_error = exc
            if attempt == API_RETRIES:
                break
            time.sleep(API_RETRY_WAIT_SECONDS * attempt)
    raise RuntimeError(f"Cloudflare Zaraz API request failed after {API_RETRIES} attempts: {type(last_error).__name__}")


def _urlopen_json_with_retry(request: Request, *, label: str) -> dict:
    transient_errors = (TimeoutError, socket.timeout, URLError)
    last_error: Exception | None = None
    for attempt in range(1, API_RETRIES + 1):
        try:
            with urlopen(request, timeout=45) as response:
                return json.load(response)
        except HTTPError:
            raise
        except transient_errors as exc:
            last_error = exc
            if attempt == API_RETRIES:
                break
            time.sleep(API_RETRY_WAIT_SECONDS * attempt)
    raise RuntimeError(f"{label} request failed after {API_RETRIES} attempts: {type(last_error).__name__}")


def _slug(value: str) -> str:
    parts = re.findall(r"[A-Za-z0-9]+", value)
    return "".join(part[:1].upper() + part[1:] for part in parts) or "Property"


def _tool_id(prefix: str, property_code: str, configured: str | None) -> str:
    if configured and re.fullmatch(r"[A-Za-z0-9_-]{2,32}", configured):
        return configured
    suffix = re.sub(r"[^A-Za-z0-9]", "", property_code.upper())[:8] or "PROP"
    return f"{prefix}{suffix}"


def _action_id(prefix: str, slug: str) -> str:
    return f"{prefix}{slug}"


def _pageview_triggers() -> dict:
    return {
        "AllTracks": {
            "description": "All zaraz.track() calls",
            "excludeRules": [],
            "loadRules": [
                {"id": "rul1", "match": "{{ client.__zarazTrack }}", "op": "NOT_MATCH_REGEX", "value": "^__zaraz.*"},
                {"id": "rul2", "match": "{{ client.__zarazEcommerce }}", "op": "NOT_MATCH_REGEX", "value": "true"},
                {"id": "pgv2", "match": "{{ client.__zarazTrack }}", "op": "NOT_MATCH_REGEX", "value": "^Pageview$"},
            ],
            "name": "All Tracks",
        },
        "Pageview": {
            "clientRules": [],
            "description": "All page loads",
            "excludeRules": [],
            "loadRules": [{"match": "{{ client.__zarazTrack }}", "op": "EQUALS", "value": "Pageview"}],
            "name": "Pageview",
            "system": "pageload",
        },
    }


def _ga4_tool(name: str, measurement_id: str) -> dict:
    return {
        "actions": {
            "AllPageviews": {
                "actionType": "pageview",
                "blockingTriggers": [],
                "data": {"__enrichPayload": "client", "__zaraz_setting_name": "Pageview"},
                "enabled": True,
                "firingTriggers": ["Pageview"],
            },
            "AllTracks": {
                "actionType": "event",
                "blockingTriggers": [],
                "data": {
                    "__enrichPayload": "client",
                    "__zaraz_setting_name": "All other events",
                    "conversion": True,
                    "en": "{{ client.__zarazTrack }}",
                },
                "enabled": True,
                "firingTriggers": ["AllTracks"],
            },
        },
        "blockingTriggers": [],
        "component": "google-analytics_v4",
        "defaultFields": {},
        "defaultPurpose": ANALYTICS_PURPOSE_ID,
        "enabled": True,
        "name": f"Google Analytics 4 - {name}",
        "permissions": [
            "client_network_requests",
            "execute_unsafe_scripts",
            "access_client_kv",
            "server_network_requests",
        ],
        "settings": {"ecommerce": True, "tid": measurement_id},
        "type": "component",
    }


def _heap_html(domain: str, app_id: str, slug: str) -> str:
    state = f"__vtrHeapDelay{slug}"
    guard = f"__vtrCsVerifyGuard{slug}"
    attr = f"data-vtr-heap-delay-{slug.lower()}"
    allowed_hosts = f"host !== '{domain}' && host !== 'www.{domain}'"
    return f"""<script>
(function(){{
  var host = location.hostname;
  if ({allowed_hosts}) return;
  var appId = '{app_id}';

  if (!window.{guard}) {{
    window.{guard} = {{ version: 'cs-verify-guard-v3-home-query-204', suppressed: 0 }};
    var verifyPattern = /^https:\\/\\/tcvsapi\\.contentsquare\\.com\\/v2\\/projects\\/[^/]+\\/verify-installation\\/auto/i;
    var suppressPath = '{CS_VERIFY_SUPPRESS_PATH}';
    function isVerifyUrl(value){{ return verifyPattern.test(String(value || '')); }}
    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {{
      window.fetch = function(input, init){{
        var url = typeof input === 'string' ? input : input && input.url;
        if (isVerifyUrl(url)) {{
          window.{guard}.suppressed += 1;
          return originalFetch.call(this, suppressPath, {{ method: 'POST', credentials: 'same-origin', keepalive: true }});
        }}
        return originalFetch.apply(this, arguments);
      }};
    }}
    var originalBeacon = navigator.sendBeacon;
    if (typeof originalBeacon === 'function') {{
      navigator.sendBeacon = function(url, data){{
        if (isVerifyUrl(url)) {{
          window.{guard}.suppressed += 1;
          return originalBeacon.call(this, suppressPath, data || '');
        }}
        return originalBeacon.apply(this, arguments);
      }};
    }}
    var originalOpen = XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open;
    if (originalOpen) {{
      XMLHttpRequest.prototype.open = function(method, url){{
        if (isVerifyUrl(url)) {{
          window.{guard}.suppressed += 1;
          arguments[0] = 'POST';
          arguments[1] = suppressPath;
        }}
        return originalOpen.apply(this, arguments);
      }};
    }}
  }}
  var names = ['init','startTracking','stopTracking','track','resetIdentity','identify','getSessionId','getUserId','getIdentity','addUserProperties','addEventProperties','removeEventProperty','clearEventProperties','addAccountProperties','addAdapter','addTransformer','addTransformerFn','onReady','addPageviewProperties','removePageviewProperty','clearPageviewProperties','trackPageview'];
  var armedAt = Date.now();
  var loaded = false;
  var loadReason = '';
  window.heapReadyCb = window.heapReadyCb || [];
  window.heap = window.heap || [];
  window.{state} = {{ mode: '{EXPECTED_HEAP_MODE}', appId: appId, armedAt: armedAt, loaded: false, reason: null, queuedCalls: 0 }};
  try {{ document.documentElement.setAttribute('{attr}', 'armed-v6-input-only-cs-verify-home-204'); }} catch(e) {{}}
  function queueMethod(name){{
    return function(){{
      var args = Array.prototype.slice.call(arguments, 0);
      window.{state}.queuedCalls += 1;
      window.heapReadyCb.push({{ name: name, fn: function(){{ if (window.heap && heap[name]) heap[name].apply(heap, args); }} }});
    }};
  }}
  for (var p = 0; p < names.length; p++) {{
    if (typeof heap[names[p]] !== 'function') heap[names[p]] = queueMethod(names[p]);
  }}
  heap.load = function(e, t){{
    if (loaded) return;
    loaded = true;
    window.heap.envId = e;
    window.heap.clientConfig = t = t || {{}};
    window.heap.clientConfig.shouldFetchServerConfig = false;
    var a = document.createElement('script');
    a.type = 'text/javascript';
    a.async = true;
    a.src = 'https://cdn.us.heap-api.com/config/' + e + '/heap_config.js';
    var r = document.getElementsByTagName('script')[0];
    r.parentNode.insertBefore(a, r);
    window.{state}.loaded = true;
    window.{state}.loadedAt = Date.now();
    window.{state}.delayMs = window.{state}.loadedAt - armedAt;
    window.{state}.reason = loadReason || 'direct-load';
    try {{ document.documentElement.setAttribute('{attr}', 'loaded-v6-input-only-cs-verify-home-204'); }} catch(e) {{}}
  }};
  function triggerLoad(reason){{
    if (loaded) return;
    loadReason = reason || 'unknown';
    heap.load(appId);
    cleanup();
  }}
  function cleanup(){{
    for (var i = 0; i < events.length; i++) removeEventListener(events[i], onIntent, opts);
  }}
  function onIntent(){{ triggerLoad('interaction'); }}
  var opts = {{ once: true, passive: true }};
  var events = ['pointerdown','touchstart','keydown'];
  for (var i = 0; i < events.length; i++) addEventListener(events[i], onIntent, opts);
  // Passive timers and scroll/wheel are disabled: Heap/Contentsquare loads only after deliberate input.
}})();
</script>"""


def _heap_tool(name: str, domain: str, app_id: str, slug: str) -> dict:
    action_id = _action_id("LoadHeap", slug)
    return {
        "actions": {
            action_id: {
                "actionType": "event",
                "blockingTriggers": [],
                "data": {"__zaraz_setting_name": "Heap interaction-only loader", "htmlCode": _heap_html(domain, app_id, slug)},
                "enabled": True,
                "firingTriggers": ["Pageview"],
            }
        },
        "blockingTriggers": [],
        "component": "html",
        "defaultFields": {},
        "defaultPurpose": MARKETING_PURPOSE_ID,
        "enabled": True,
        "name": f"Heap Analytics - {name}",
        "permissions": ["execute_unsafe_scripts"],
        "settings": {},
        "type": "component",
    }


def _bridge_html(domain: str, property_code: str, property_name: str, slug: str) -> str:
    state = f"__vtrResiZarazBridge{slug}"
    attr = f"data-vtr-resi-zaraz-bridge-{slug.lower()}"
    allowed_hosts = f'host !== "{domain}" && host !== "www.{domain}"'
    return f"""<script>
(function(w,d){{
  var host = w.location && w.location.hostname;
  if ({allowed_hosts}) return;
  if (w.{state} && w.{state}.installed) return;
  var state = w.{state} = {{
    installed: true,
    version: "2026-08-05.zaraz-ga4-resi-bridge-v1",
    events: [],
    queued: []
  }};
  try {{ d.documentElement.setAttribute("{attr}", "armed-v1"); }} catch(e) {{}}
  function cleanText(value) {{
    return String(value || "").replace(/\\s+/g, " ").trim().slice(0, 160);
  }}
  function absoluteUrl(value) {{
    try {{ return new URL(value || "", w.location.href).href; }} catch(e) {{ return String(value || ""); }}
  }}
  function safeValue(value) {{
    if (value == null) return undefined;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return undefined;
  }}
  function basePayload(extra) {{
    var payload = {{
      property_code: "{property_code}",
      property_name: "{property_name}",
      site: "{domain}",
      event_source: "zaraz_resi_bridge",
      page_path: w.location ? w.location.pathname : undefined,
      page_location: w.location ? w.location.href : undefined
    }};
    extra = extra || {{}};
    Object.keys(extra).forEach(function(key){{
      var value = safeValue(extra[key]);
      if (value !== undefined) payload[key] = value;
    }});
    return payload;
  }}
  var recent = {{}};
  function shouldSend(name, payload) {{
    var sig = name + "|" + (payload.link_url || payload.phone_number || payload.email_address || payload.floor_plan_id || payload.form_id || payload.click_text || "");
    var now = Date.now();
    if (recent[sig] && now - recent[sig] < 1500) return false;
    recent[sig] = now;
    return true;
  }}
  function flushQueue() {{
    if (!w.zaraz || typeof w.zaraz.track !== "function") return false;
    while (state.queued.length) {{
      var item = state.queued.shift();
      try {{ w.zaraz.track(item.name, item.payload); }} catch(e) {{}}
    }}
    return true;
  }}
  function track(name, data) {{
    var payload = basePayload(data);
    if (!shouldSend(name, payload)) return;
    state.events.push({{name:name, payload:payload, at:Date.now()}});
    if (state.events.length > 50) state.events.shift();
    if (w.zaraz && typeof w.zaraz.track === "function") {{
      try {{ w.zaraz.track(name, payload); return; }} catch(e) {{}}
    }}
    state.queued.push({{name:name, payload:payload}});
    if (state.queued.length > 25) state.queued.shift();
  }}
  state.track = track;
  var tries = 0;
  var interval = w.setInterval(function(){{
    tries += 1;
    if (flushQueue() || tries > 40) w.clearInterval(interval);
  }}, 250);
  w.addEventListener("load", function(){{ setTimeout(flushQueue, 0); }}, {{once:true}});

  function floorPlanPayload(detail) {{
    detail = detail || {{}};
    var floorPlan = detail.floorPlan || detail;
    return {{
      floor_plan_id: floorPlan.id,
      floor_plan_type: floorPlan.floorPlanType || detail.floorPlanType,
      floor_plan_bedrooms: floorPlan.floorPlanBedrooms || detail.floorPlanBedrooms,
      floor_plan_bathrooms: floorPlan.floorPlanBathrooms || detail.floorPlanBathrooms,
      floor_plan_code: floorPlan.floorPlanCode || detail.floorPlanCode
    }};
  }}
  function bindJquery() {{
    var jq = w.jQuery;
    if (!jq || !jq.fn || state.jqueryBound) return false;
    state.jqueryBound = true;
    jq(d).on("resi_form_submission_success", function(evt, data){{
      track("resi_form_submission_success", {{form_id: data && (data.formID || data.formId || data.id)}});
    }});
    jq(d).on("gform_confirmation_loaded", function(evt, formId){{
      track("resi_form_submission_success", {{form_id: formId}});
    }});
    jq(d).on("resi_residence_viewed", function(evt){{
      track("resi_residence_view", floorPlanPayload(evt && evt.detail));
    }});
    jq(d).on("resi_residence_pdf_downloaded", function(evt){{
      track("resi_residence_pdf_download", floorPlanPayload(evt && evt.detail));
    }});
    jq(d).on("resi_application_start", function(){{ track("resi_application_start", {{}}); }});
    jq(d).on("resi_widget_opened", function(){{ track("resi_widget_opened", {{}}); }});
    jq(d).on("resi_popup_clicked", function(){{ track("resi_popup_clicked", {{}}); }});
    jq(d).on("resi_incentive_clicked", function(){{ track("resi_incentive_clicked", {{}}); }});
    return true;
  }}
  if (!bindJquery()) {{
    var jqTries = 0;
    var jqInterval = w.setInterval(function(){{
      jqTries += 1;
      if (bindJquery() || jqTries > 80) w.clearInterval(jqInterval);
    }}, 250);
  }}

  d.addEventListener("click", function(evt){{
    var target = evt.target && evt.target.closest ? evt.target.closest("a[href],button,[role='button']") : null;
    if (!target) return;
    var href = target.getAttribute("href") || "";
    var url = absoluteUrl(href);
    var text = cleanText(target.textContent || target.getAttribute("aria-label") || target.getAttribute("title") || "");
    var cls = String(target.className || "");
    var payload = {{click_text:text, link_url:url}};
    if (/^tel:/i.test(href)) {{
      track("resi_phone_click", Object.assign({{}}, payload, {{phone_number: href.replace(/^tel:/i, "")}}));
      return;
    }}
    if (/^mailto:/i.test(href)) {{
      track("email_click", Object.assign({{}}, payload, {{email_address: href.replace(/^mailto:/i, "").split("?")[0]}}));
      return;
    }}
    if (/facebook\\.com|instagram\\.com|linkedin\\.com|tiktok\\.com|(?:^|\\.)x\\.com/i.test(url)) {{
      track("resi_social_click", payload);
    }}
    if (/google\\.com\\/maps\\/search|google\\.com\\/maps|maps\\.app\\.goo\\.gl/i.test(url)) {{
      track("resi_get_directions", payload);
    }}
    if (cls.indexOf("resi_3d_tour_link") !== -1) track("resi_3d_tour_view", payload);
    if (cls.indexOf("resi_apt_price_quote") !== -1) track("resi_price_quote", payload);
    if (cls.indexOf("resi_apt_tour_link") !== -1) track("resi_apt_tour_click", payload);
    if (/Apply Now/i.test(text) || /createPipelineApplication/i.test(url) || cls.indexOf("resi_application_start") !== -1) {{
      track("resi_application_start", payload);
    }}
  }}, {{capture:true, passive:true}});
}})(window,document);
</script>"""


def _bridge_tool(name: str, domain: str, property_code: str, slug: str) -> dict:
    action_id = _action_id("LoadResiBridge", slug)
    return {
        "actions": {
            action_id: {
                "actionType": "event",
                "blockingTriggers": [],
                "data": {
                    "__zaraz_setting_name": "Resi event bridge",
                    "htmlCode": _bridge_html(domain, property_code, name, slug),
                },
                "enabled": True,
                "firingTriggers": ["Pageview"],
            }
        },
        "blockingTriggers": [],
        "component": "html",
        "defaultFields": {},
        "defaultPurpose": MARKETING_PURPOSE_ID,
        "enabled": True,
        "name": f"Resi Event Bridge - {name}",
        "permissions": ["execute_unsafe_scripts"],
        "settings": {},
        "type": "component",
    }


def _ahrefs_tool(name: str, data_key: str) -> dict:
    action_id = _action_id("LoadAhrefs", _slug(name))
    return {
        "actions": {
            action_id: {
                "actionType": "event",
                "blockingTriggers": [],
                "data": {
                    "__zaraz_setting_name": f"Ahrefs Web Analytics - {name}",
                    "htmlCode": f'<script src="https://analytics.ahrefs.com/analytics.js" data-key="{data_key}" async></script>',
                },
                "enabled": True,
                "firingTriggers": ["Pageview"],
            }
        },
        "blockingTriggers": [],
        "component": "html",
        "defaultFields": {},
        "defaultPurpose": ANALYTICS_PURPOSE_ID,
        "enabled": True,
        "name": f"Ahrefs Web Analytics - {name}",
        "permissions": ["execute_unsafe_scripts"],
        "settings": {},
        "type": "component",
    }


def _resolve_ahrefs_data_key(analytics: dict) -> dict:
    ahrefs = analytics.get("ahrefs") or {}
    project_id = str(ahrefs.get("existing_project_id") or "").strip()
    if not project_id:
        return {"resolved": False, "reason": "missing_existing_project_id"}
    credentials = resolve_ahrefs_credentials()
    request = Request(
        "https://api.ahrefs.com/v3/management/projects",
        headers={
            "Authorization": credentials.authorization_header,
            "Accept": "application/json",
            "User-Agent": "PropertyAnalytics-ZarazAnalyticsPackage/1.0",
        },
    )
    payload = _urlopen_json_with_retry(request, label="Ahrefs project roster")
    for project in payload.get("projects") or []:
        if str(project.get("project_id")) != project_id:
            continue
        data_key = str(project.get("web_analytics_data_key") or "").strip()
        return {
            "resolved": bool(data_key),
            "project_id": project_id,
            "project_name": project.get("project_name"),
            "target": project.get("url"),
            "verified": project.get("verified"),
            "data_key": data_key,
            "data_key_present": bool(data_key),
            "reason": None if data_key else "missing_web_analytics_data_key",
        }
    return {"resolved": False, "project_id": project_id, "reason": "project_not_found"}


def _load_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    target = manifest.get("target") or {}
    analytics = manifest.get("analytics") or {}
    required = {
        "target.property_code": target.get("property_code"),
        "target.domain": target.get("domain"),
        "target.property_name": target.get("property_name"),
        "analytics.ga4.measurement_id": (analytics.get("ga4") or {}).get("measurement_id"),
        "analytics.heap.app_id": (analytics.get("heap") or {}).get("app_id"),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise ValueError(f"Manifest is missing required fields: {', '.join(missing)}")
    return manifest


def _redact(config: dict) -> dict:
    rows = {}
    for tool_id, tool in sorted((config.get("tools") or {}).items()):
        text = json.dumps(tool, sort_keys=True)
        rows[tool_id] = {
            "name": tool.get("name"),
            "component": tool.get("component"),
            "enabled": tool.get("enabled"),
            "defaultPurpose": tool.get("defaultPurpose"),
            "actionIds": list((tool.get("actions") or {}).keys()) if isinstance(tool.get("actions"), dict) else [],
            "containsGA4": "google-analytics" in text.lower() or "google analytics" in text.lower(),
            "containsExpectedHeapMode": EXPECTED_HEAP_MODE in text,
            "containsCsGuard": "tcvsapi" in text and "vtr_cs_verify_suppressed" in text,
            "containsAhrefs": "analytics.ahrefs.com" in text,
            "containsBridge": "zaraz-ga4-resi-bridge-v1" in text,
        }
    return {
        "settings": config.get("settings"),
        "triggers": list((config.get("triggers") or {}).keys()) if isinstance(config.get("triggers"), dict) else [],
        "tools": rows,
    }


def _apply(manifest: dict, *, apply: bool) -> dict:
    target = manifest["target"]
    analytics = manifest["analytics"]
    domain = target["domain"]
    property_code = target["property_code"]
    property_name = target["property_name"]
    slug = _slug(property_name)
    ga4 = analytics["ga4"]
    heap = analytics["heap"]
    ahrefs = analytics.get("ahrefs") or {}
    token = resolve_secret(
        description="Cloudflare Zaraz Editor token",
        default_notation="keeper://hZFfWzx_qwOn19J-zICiPg/field/password",
        direct_env_var=None,
        default_profile="marketingops",
    ).strip()
    zones = _api(token, f"/zones?name={quote(domain)}")
    if not zones.get("success") or not zones.get("result"):
        raise RuntimeError(f"Cloudflare zone not found for {domain}")
    zone_id = zones["result"][0]["id"]
    config = _api(token, f"/zones/{zone_id}/settings/zaraz/config").get("result") or {}
    updated = copy.deepcopy(config)
    updated.setdefault("settings", {})["autoInjectScript"] = True
    updated.setdefault("triggers", {}).update(_pageview_triggers())
    updated.setdefault("tools", {})

    ga4_id = _tool_id("GA4", property_code, ga4.get("zaraz_tool_name"))
    heap_id = _tool_id("H", property_code, heap.get("zaraz_tool_name"))
    bridge_id = _tool_id("RB", property_code, (analytics.get("resi_event_bridge") or {}).get("zaraz_tool_name"))
    ahrefs_id = _tool_id("AH", property_code, ahrefs.get("zaraz_tool_name"))
    ahrefs_key = _resolve_ahrefs_data_key(analytics)
    proposed_tools = {
        ga4_id: _ga4_tool(property_name, ga4["measurement_id"]),
        heap_id: _heap_tool(property_name, domain, heap["app_id"], slug),
        bridge_id: _bridge_tool(property_name, domain, property_code, slug),
    }
    if ahrefs_key.get("resolved"):
        proposed_tools[ahrefs_id] = _ahrefs_tool(property_name, ahrefs_key["data_key"])
    changes = []
    for tool_id, tool in proposed_tools.items():
        if updated["tools"].get(tool_id) != tool:
            updated["tools"][tool_id] = tool
            changes.append(f"upsert_tool:{tool_id}:{tool['name']}")

    result = {
        "domain": domain,
        "property_code": property_code,
        "mode": "apply" if apply else "dry_run",
        "status": "unchanged",
        "zone_id": zone_id,
        "changes": changes,
        "before": _redact(config),
        "after": _redact(updated),
        "assertions": {
            "ga4_tool_id": ga4_id,
            "heap_tool_id": heap_id,
            "bridge_tool_id": bridge_id,
            "ahrefs_tool_id": ahrefs_id if ahrefs_key.get("resolved") else None,
            "ahrefs_project_id": ahrefs_key.get("project_id"),
            "ahrefs_project_name": ahrefs_key.get("project_name"),
            "ahrefs_target": ahrefs_key.get("target"),
            "ahrefs_verified": ahrefs_key.get("verified"),
            "ahrefs_data_key_present": bool(ahrefs_key.get("data_key_present")),
            "ahrefs_resolution_reason": ahrefs_key.get("reason"),
            "heap_mode": EXPECTED_HEAP_MODE,
            "contentsquare_same_origin_path": CS_VERIFY_SUPPRESS_PATH,
            "preserved_existing_tool_ids": sorted(set((config.get("tools") or {}).keys()) - set(proposed_tools.keys())),
        },
    }
    if not changes:
        return result
    result["status"] = "planned"
    if not apply:
        return result
    try:
        response = _api(token, f"/zones/{zone_id}/settings/zaraz/config", method="PUT", payload=updated)
    except HTTPError as exc:
        result["status"] = "failed"
        result["errors"] = [f"Cloudflare PUT returned HTTP {exc.code}"]
        return result
    if not response.get("success", True):
        result["status"] = "failed"
        result["errors"] = ["Cloudflare PUT returned unsuccessful response"]
        return result
    result["status"] = "applied"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply the Resi Zaraz analytics package from a governed manifest.")
    parser.add_argument("--manifest", required=True, help="Resi Edge manifest path.")
    parser.add_argument("--apply", action="store_true", help="Write the Zaraz config. Default is dry-run.")
    parser.add_argument("--output", help="Redacted run packet path.")
    args = parser.parse_args()

    manifest = _load_manifest(Path(args.manifest))
    result = _apply(manifest, apply=args.apply)
    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "scope": "resi_zaraz_analytics_package",
        "status": "failed" if result.get("status") == "failed" else "passed",
        "result": result,
    }
    output = Path(args.output) if args.output else ROOT / "reports" / "cloudflare_zaraz" / f"resi_zaraz_analytics_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "mode": result["mode"], "result_status": result["status"], "output": str(output), "changes": result.get("changes", [])}, indent=2))
    return 1 if payload["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
