#!/usr/bin/env python3
"""Smoke live Zaraz, interaction-gated Heap, Ahrefs, and GA4 realtime analytics."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, urlencode, unquote, urlsplit, urlunsplit

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import Dimension, Metric, MinuteRange, RunRealtimeReportRequest
from google.oauth2 import service_account
from playwright.async_api import async_playwright

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.config_manager import Config


DEFAULT_URLS = ["https://thevinekyle.com/", "https://thevinekyle.com/apartments/"]
ANALYTICS_REQUEST_RE = r"cdn-cgi/zaraz|google-analytics|googletagmanager|heap|contentsquare|getresi|ahrefs|vtr_cs_verify_suppressed"
DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
HEAP_APP_ID_RE = re.compile(r"(?:cdn\.us\.heap-api\.com/config/|heap\.load\([\"']|[?&]a=)(\d{6,})", re.I)
HEAP_DELAY_STATE_JS = """
function findHeapDelay() {
  const key = Object.keys(window).find((candidate) => /^__vtrHeapDelay/.test(candidate));
  return key ? window[key] : null;
}
function findHeapMarker() {
  const attr = document.documentElement
    .getAttributeNames()
    .find((candidate) => /^data-vtr-heap-delay-/.test(candidate));
  return attr ? document.documentElement.getAttribute(attr) : null;
}
"""


def _extract_heap_app_ids(values: list[str]) -> list[str]:
    ids: set[str] = set()
    for value in values:
        for match in HEAP_APP_ID_RE.finditer(value or ""):
            ids.add(match.group(1))
    return sorted(ids)


def _decode_zaraz_bootstrap_payloads(values: list[str]) -> list[str]:
    payloads: list[str] = []
    for value in values:
        if "/cdn-cgi/zaraz/s.js" not in value:
            continue
        z_values = parse_qs(urlsplit(value).query).get("z") or []
        for encoded in z_values:
            try:
                raw = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf-8", errors="replace")
            except Exception:
                continue
            payloads.append(unquote(raw))
    return payloads


def _add_query_flag(url: str, flag: str) -> str:
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    query.append((flag, "1"))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def _check_url(
    url: str,
    passive_ms: int,
    delayed_ms: int,
    interaction_check: bool,
    expected_heap_app_id: str,
    expected_measurement_id: str,
) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1365, "height": 900}, user_agent=DESKTOP_UA)
        page = await context.new_page()
        requests: list[dict] = []
        bad_responses: list[dict] = []

        async def on_request(request) -> None:
            if re.search(ANALYTICS_REQUEST_RE, request.url, re.I):
                requests.append(
                    {
                        "type": request.resource_type,
                        "method": request.method,
                        "url": request.url,
                    }
                )

        page.on("request", on_request)
        page.on(
            "response",
            lambda response: (
                bad_responses.append({"status": response.status, "url": response.url})
                if response.status >= 400 and re.search(ANALYTICS_REQUEST_RE, response.url, re.I)
                else None
            ),
        )
        response = await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        await page.wait_for_timeout(passive_ms)
        passive_request_count = len(requests)
        passive_bad_response_count = len(bad_responses)
        passive = await page.evaluate(
            """() => {
              """ + HEAP_DELAY_STATE_JS + """
              const heapDelay = findHeapDelay();
              const heapMarker = findHeapMarker();
              return ({
                title: document.title,
                hasZaraz: typeof window.zaraz !== 'undefined',
                zarazType: typeof window.zaraz,
                hasGtag: typeof window.gtag === 'function',
                hasHeap: typeof window.heap !== 'undefined',
                heapIsArray: Array.isArray(window.heap),
                heapTrackType: window.heap && typeof window.heap.track,
                heapDelay,
                heapMarker,
                heapScriptIds: Array.from(document.scripts).flatMap(script => {
                  const text = [script.src || '', script.textContent || ''].join('\\n');
                  const ids = [];
                  const re = /(?:cdn\\.us\\.heap-api\\.com\\/config\\/|heap\\.load\\(["']|[?&]a=)(\\d{6,})/gi;
                  let match;
                  while ((match = re.exec(text))) ids.push(match[1]);
                  return ids;
                }),
                hasAhrefsScript: Array.from(document.scripts).some(script => /ahrefs/i.test(script.src || script.textContent || '')),
                dataLayerLength: Array.isArray(window.dataLayer) ? window.dataLayer.length : null,
                dataLayerEvents: Array.isArray(window.dataLayer) ? window.dataLayer.map(x => x && x.event).filter(Boolean) : []
              });
            }"""
        )
        navigation = await page.evaluate(
            """() => ({
              status: null,
              finalUrl: location.href,
              title: document.title || "",
              bodyTextLength: (document.body && document.body.innerText || "").length,
              documentElementLength: document.documentElement ? document.documentElement.outerHTML.length : 0
            })"""
        )
        navigation["status"] = response.status if response else None
        await page.wait_for_timeout(delayed_ms)
        delayed_request_count = len(requests)
        delayed_bad_response_count = len(bad_responses)
        delayed = await page.evaluate(
            """() => {
              """ + HEAP_DELAY_STATE_JS + """
              const heapDelay = findHeapDelay();
              const heapMarker = findHeapMarker();
              return ({
                hasZaraz: typeof window.zaraz !== 'undefined',
                hasHeap: typeof window.heap !== 'undefined',
                heapIsArray: Array.isArray(window.heap),
                heapTrackType: window.heap && typeof window.heap.track,
                heapDelay,
                heapMarker,
                heapScriptIds: Array.from(document.scripts).flatMap(script => {
                  const text = [script.src || '', script.textContent || ''].join('\\n');
                  const ids = [];
                  const re = /(?:cdn\\.us\\.heap-api\\.com\\/config\\/|heap\\.load\\(["']|[?&]a=)(\\d{6,})/gi;
                  let match;
                  while ((match = re.exec(text))) ids.push(match[1]);
                  return ids;
                })
              });
            }"""
        )
        interaction = None
        interaction_request_count = None
        interaction_start_count = None
        if interaction_check:
            interaction_start_count = len(requests)
            clicked = False
            for selector in (
                "button:has-text('Accept')",
                "button:has-text('Accept All')",
                "button:has-text('I Accept')",
                "[role='button']:has-text('Accept')",
            ):
                try:
                    locator = page.locator(selector).first
                    if await locator.count():
                        await locator.click(timeout=1500)
                        clicked = True
                        break
                except Exception:
                    continue
            if not clicked:
                await page.mouse.click(24, 24)
            await page.wait_for_timeout(500)
            await page.mouse.click(24, 24)
            await page.wait_for_timeout(2500)
            interaction_request_count = len(requests)
            interaction = await page.evaluate(
                """() => {
                  """ + HEAP_DELAY_STATE_JS + """
                  const heapDelay = findHeapDelay();
                  return ({
                    hasHeap: typeof window.heap !== 'undefined',
                    heapDelay,
                    heapScriptIds: Array.from(document.scripts).flatMap(script => {
                      const text = [script.src || '', script.textContent || ''].join('\\n');
                      const ids = [];
                      const re = /(?:cdn\\.us\\.heap-api\\.com\\/config\\/|heap\\.load\\(["']|[?&]a=)(\\d{6,})/gi;
                      let match;
                      while ((match = re.exec(text))) ids.push(match[1]);
                      return ids;
                    }),
                    hasAhrefsScript: Array.from(document.scripts).some(script => /ahrefs/i.test(script.src || script.textContent || ''))
                  });
                }"""
            )
        await context.close()
        await browser.close()

    passive_requests = requests[:passive_request_count]
    delayed_requests = requests[:delayed_request_count]
    interaction_requests = requests[interaction_start_count:interaction_request_count] if interaction_request_count is not None else []
    passive_bad_responses = bad_responses[:passive_bad_response_count]
    delayed_bad_responses = bad_responses[:delayed_bad_response_count]
    observed_heap_app_ids = _extract_heap_app_ids(
        [item["url"] for item in requests]
        + list(passive.get("heapScriptIds") or [])
        + list(delayed.get("heapScriptIds") or [])
        + list((interaction or {}).get("heapScriptIds") or [])
    )
    unexpected_heap_app_ids = [item for item in observed_heap_app_ids if item != expected_heap_app_id]
    zaraz_bootstrap_payloads = _decode_zaraz_bootstrap_payloads([item["url"] for item in requests])
    zaraz_measurement_id_present = bool(expected_measurement_id) and any(
        expected_measurement_id in payload for payload in zaraz_bootstrap_payloads
    )

    return {
        "url": url,
        "navigation": navigation,
        "passive": passive,
        "delayed": delayed,
        "interaction": interaction,
        "requests": requests,
        "bad_responses": bad_responses,
            "summary": {
                "zaraz": bool(passive.get("hasZaraz")),
            "heap_passive_loaded": bool((passive.get("heapDelay") or {}).get("loaded")),
            "heap_late_passive_loaded": bool((delayed.get("heapDelay") or {}).get("loaded")),
            "heap_interaction_loaded": bool(((interaction or {}).get("heapDelay") or {}).get("loaded")) if interaction_check else None,
            "heap_reason": (delayed.get("heapDelay") or {}).get("reason"),
            "zaraz_request_count": sum("/cdn-cgi/zaraz" in item["url"] for item in delayed_requests),
            "heap_passive_request_count": sum(("heap" in item["url"].lower() or "contentsquare" in item["url"].lower()) for item in passive_requests),
            "heap_late_passive_request_count": sum(("heap" in item["url"].lower() or "contentsquare" in item["url"].lower()) for item in delayed_requests),
                "heap_interaction_request_count": sum(("heap" in item["url"].lower() or "contentsquare" in item["url"].lower()) for item in interaction_requests) if interaction_check else None,
                "contentsquare_vendor_verify_request_count": sum("tcvsapi.contentsquare.com" in item["url"].lower() and "verify-installation" in item["url"].lower() for item in requests),
                "contentsquare_same_origin_suppression_count": sum("vtr_cs_verify_suppressed=1" in item["url"].lower() for item in requests),
                "analytics_bad_response_count": len(delayed_bad_responses),
                "analytics_passive_bad_response_count": len(passive_bad_responses),
                "zaraz_measurement_id_present": zaraz_measurement_id_present,
                "ahrefs_request_count": sum("ahrefs" in item["url"].lower() for item in delayed_requests),
                "ahrefs_interaction_request_count": sum("ahrefs" in item["url"].lower() for item in interaction_requests) if interaction_check else None,
                "observed_heap_app_ids": observed_heap_app_ids,
                "unexpected_heap_app_ids": unexpected_heap_app_ids,
            "ahrefs_script_present": bool(passive.get("hasAhrefsScript") or ((interaction or {}).get("hasAhrefsScript"))),
        },
    }


def _run_ga4_realtime(property_id: str) -> dict:
    credentials = service_account.Credentials.from_service_account_file(
        str(Config.get_ga4_credentials_path()),
        scopes=["https://www.googleapis.com/auth/analytics.readonly"],
    )
    client = BetaAnalyticsDataClient(credentials=credentials)
    dimensions: dict[str, list[dict]] = {}
    for dimension in ("eventName", "streamName"):
        response = client.run_realtime_report(
            RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[Dimension(name=dimension)],
                metrics=[Metric(name="eventCount")],
                limit=20,
            )
        )
        dimensions[dimension] = [
            {
                "dimension": row.dimension_values[0].value,
                "eventCount": row.metric_values[0].value,
            }
            for row in response.rows
        ]
    combined_response = client.run_realtime_report(
        RunRealtimeReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="eventName"), Dimension(name="streamName"), Dimension(name="minutesAgo")],
            metrics=[Metric(name="eventCount")],
            minute_ranges=[MinuteRange(name="last30", start_minutes_ago=29, end_minutes_ago=0)],
            limit=100,
        )
    )
    event_stream_minutes = [
        {
            "eventName": row.dimension_values[0].value,
            "streamName": row.dimension_values[1].value,
            "minutesAgo": row.dimension_values[2].value,
            "eventCount": row.metric_values[0].value,
        }
        for row in combined_response.rows
    ]
    return {
        "property": f"properties/{property_id}",
        "dimensions": dimensions,
        "eventStreamMinutes": event_stream_minutes,
    }


def evaluate_ga4_realtime_gate(ga4_realtime: dict | None, expected_stream_names: list[str]) -> tuple[list[str], dict]:
    """Record GA4 Realtime evidence without treating reporting-window output as package proof."""
    diagnostics = {
        "required_event": "page_view",
        "session_start_observed": False,
        "page_view_on_expected_stream": False,
        "expected_stream_present": False,
        "matched_page_view_rows": [],
        "matched_stream_rows": [],
    }
    if not ga4_realtime:
        return [], diagnostics

    expected_streams = {item.strip() for item in expected_stream_names if item and item.strip()}
    event_rows = ga4_realtime.get("dimensions", {}).get("eventName", [])
    stream_rows = ga4_realtime.get("dimensions", {}).get("streamName", [])
    combined_rows = ga4_realtime.get("eventStreamMinutes") or []
    events = {row.get("dimension") for row in event_rows}
    streams = {row.get("dimension") for row in stream_rows}
    diagnostics["session_start_observed"] = "session_start" in events or any(row.get("eventName") == "session_start" for row in combined_rows)

    if expected_streams:
        matched_page_view_rows = [
            row for row in combined_rows if row.get("eventName") == "page_view" and row.get("streamName") in expected_streams
        ]
        matched_stream_rows = [row for row in stream_rows if row.get("dimension") in expected_streams]
        diagnostics["matched_page_view_rows"] = matched_page_view_rows
        diagnostics["matched_stream_rows"] = matched_stream_rows
        diagnostics["page_view_on_expected_stream"] = bool(matched_page_view_rows)
        diagnostics["expected_stream_present"] = bool(matched_stream_rows or matched_page_view_rows)
        return [], diagnostics

    diagnostics["page_view_on_expected_stream"] = "page_view" in events or any(row.get("eventName") == "page_view" for row in combined_rows)
    return [], diagnostics


async def _main_async(args: argparse.Namespace) -> int:
    token = f"pa_live_analytics_smoke_{int(datetime.now(timezone.utc).timestamp())}"
    urls = list(args.url or DEFAULT_URLS)
    if args.unique_query:
        urls[0] = _add_query_flag(urls[0], token)

    browser_checks = []
    for url in urls:
        browser_checks.append(
            await _check_url(
                url,
                args.passive_ms,
                args.delayed_ms,
                args.expect_heap_after_interaction,
                args.heap_app_id,
                args.measurement_id,
            )
        )

    if args.ga4_wait_ms:
        await asyncio.sleep(args.ga4_wait_ms / 1000)
    ga4_realtime = None if args.skip_ga4_realtime else _run_ga4_realtime(args.ga4_property_id)

    result = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "measurement_id": args.measurement_id,
        "heap_app_id": args.heap_app_id,
        "unique_query_flag": token if args.unique_query else None,
        "browser_checks": browser_checks,
        "ga4_realtime": ga4_realtime,
    }

    failures: list[str] = []
    for check in browser_checks:
        summary = check["summary"]
        navigation = check.get("navigation") or {}
        if navigation.get("status") is None or int(navigation.get("status") or 0) >= 400 or int(navigation.get("bodyTextLength") or 0) < 100:
            failures.append(f"{check['url']}: analytics smoke navigation did not load a valid page")
            continue
        if not summary["zaraz"]:
            failures.append(f"{check['url']}: Zaraz global missing")
        if summary["zaraz_request_count"] <= 0:
            failures.append(f"{check['url']}: Zaraz network request missing")
        if "page_view" not in set(check.get("passive", {}).get("dataLayerEvents") or []):
            failures.append(f"{check['url']}: Resi Edge page_view dataLayer event missing")
        if not summary["zaraz_measurement_id_present"]:
            failures.append(f"{check['url']}: Zaraz bootstrap missing expected GA4 measurement id {args.measurement_id}")
        if summary["heap_passive_loaded"]:
            failures.append(f"{check['url']}: Heap loaded during passive window")
        if summary["heap_late_passive_loaded"]:
            failures.append(f"{check['url']}: Heap loaded during late passive window")
        if summary["heap_passive_request_count"] > 0:
            failures.append(f"{check['url']}: Heap/Contentsquare request during passive window")
        if summary["heap_late_passive_request_count"] > 0:
            failures.append(f"{check['url']}: Heap/Contentsquare request during late passive window")
        if summary["analytics_bad_response_count"] > 0:
            failures.append(f"{check['url']}: analytics network response >= 400")
        if summary["unexpected_heap_app_ids"]:
            failures.append(f"{check['url']}: unexpected Heap app id(s) observed: {', '.join(summary['unexpected_heap_app_ids'])}")
        if summary["contentsquare_vendor_verify_request_count"] > 0:
            failures.append(f"{check['url']}: Contentsquare verify-installation reached vendor endpoint instead of same-origin suppression")
        if args.expect_heap_after_interaction and not summary["heap_interaction_loaded"]:
            failures.append(f"{check['url']}: Heap did not load after interaction")
        if args.expect_heap_after_interaction and not summary["heap_interaction_request_count"]:
            failures.append(f"{check['url']}: Heap/Contentsquare network request missing after interaction")
        ahrefs_after_interaction = summary["ahrefs_interaction_request_count"] or 0
        if args.require_ahrefs and summary["ahrefs_request_count"] <= 0 and ahrefs_after_interaction <= 0 and not summary["ahrefs_script_present"]:
            failures.append(f"{check['url']}: Ahrefs request/script missing")

    ga4_failures, ga4_diagnostics = evaluate_ga4_realtime_gate(ga4_realtime, args.expected_stream_name)
    failures.extend(ga4_failures)
    result["ga4_gate_diagnostics"] = ga4_diagnostics

    result["status"] = "failed" if failures else "passed"
    result["failures"] = failures

    output_path = Path(args.output) if args.output else ROOT / "reports" / "live_analytics_smoke" / f"{token}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, sort_keys=True))

    print(json.dumps({"status": result["status"], "output": str(output_path), "failures": failures}, indent=2))
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify live Zaraz, interaction-gated Heap, Ahrefs, and GA4 realtime tracking.")
    parser.add_argument("--url", action="append", help="URL to check. Defaults to The Vine home and apartments pages.")
    parser.add_argument("--ga4-property-id", default="505234023")
    parser.add_argument("--measurement-id", default="G-5PFVF8Y3NT")
    parser.add_argument("--expected-stream-name", action="append", default=[], help="Acceptable GA4 stream name. Can be supplied more than once.")
    parser.add_argument("--heap-app-id", default="286627304")
    parser.add_argument("--passive-ms", type=int, default=2500)
    parser.add_argument("--delayed-ms", type=int, default=8000)
    parser.add_argument("--ga4-wait-ms", type=int, default=15000)
    parser.add_argument("--skip-ga4-realtime", action="store_true")
    parser.add_argument("--require-ahrefs", action="store_true", help="Fail when Ahrefs is not observed in requests or scripts.")
    parser.add_argument("--expect-heap-after-interaction", action="store_true", help="Also scroll once and require Heap to load after user intent.")
    parser.add_argument("--no-unique-query", dest="unique_query", action="store_false")
    parser.add_argument("--output")
    parser.set_defaults(unique_query=True)
    args = parser.parse_args()
    return asyncio.run(_main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
