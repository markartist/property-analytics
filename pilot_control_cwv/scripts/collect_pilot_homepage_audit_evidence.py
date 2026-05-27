#!/usr/bin/env python3
"""
Collect daily homepage browser evidence for pilot properties.

Outputs:
- dated JSON artifact with one row per pilot homepage
- DB rows in pilot_homepage_audit_evidence
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

import sys

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "pilot_control_cwv_config.json"
DB_PATH = REPO_ROOT / "data" / "portfolio_analytics.db"
OUTPUT_DIR = BASE_DIR / "reports" / "homepage_audit_evidence"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR = OUTPUT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
EVS_REPORTS_DIR = REPO_ROOT / "evs" / "reports"
CHROME_PROBE_PATH = OUTPUT_DIR / "chrome_lcp_probe.mjs"
CHROME_BINARY = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

sys.path.insert(0, str(REPO_ROOT))

from Data_Collection.db.database_manager import DatabaseManager


PROBE_SCRIPT = r"""
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.argv[2];
const screenshotPath = process.argv[3];
if (!url) throw new Error('URL required');

const userDataDir = mkdtempSync(join(tmpdir(), 'chrome-lcp-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path, opts = {}) {
  const res = await fetch(`http://127.0.0.1:9222${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function waitForEndpoint() {
  for (let i = 0; i < 50; i++) {
    try { return await get('/json/version'); } catch {}
    await sleep(200);
  }
  throw new Error('endpoint not ready');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
      }
    });
  }

  async open() {
    if (this.ws.readyState === this.ws.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async waitFor(method, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.events.findIndex((event) => event.method === method);
      if (idx >= 0) return this.events.splice(idx, 1)[0];
      await sleep(50);
    }
    throw new Error(`timeout ${method}`);
  }

  close() {
    this.ws.close();
  }
}

try {
  await waitForEndpoint();
  const target = await get(`/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
    .catch(async () => await get(`/json/new?${encodeURIComponent('about:blank')}`));
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.open();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__lcpData = { entries: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const el = entry.element;
          const data = {
            startTime: entry.startTime,
            size: entry.size,
            url: entry.url || null,
            id: el && el.id || null,
            tagName: el && el.tagName || null,
            className: el && typeof el.className === 'string' ? el.className : null,
            text: el && el.innerText ? el.innerText.trim().slice(0, 160) : null,
            outerHTML: el && el.outerHTML ? el.outerHTML.slice(0, 800) : null,
            currentSrc: el && (el.currentSrc || el.src) || null,
            backgroundImage: el ? getComputedStyle(el).backgroundImage : null,
          };
          window.__lcpData.entries.push(data);
          window.__lcpData.latest = data;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    `,
  });

  await cdp.send('Page.navigate', { url });
  try { await cdp.waitFor('Page.loadEventFired', 20000); } catch {}
  await sleep(5000);
  const evalResult = await cdp.send('Runtime.evaluate', {
    expression: `
      JSON.stringify((() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType || null,
          startTime: entry.startTime,
          responseEnd: entry.responseEnd,
          duration: entry.duration,
          transferSize: entry.transferSize || 0,
          encodedBodySize: entry.encodedBodySize || 0,
          decodedBodySize: entry.decodedBodySize || 0,
          renderBlockingStatus: entry.renderBlockingStatus || null,
          nextHopProtocol: entry.nextHopProtocol || null,
        }));
        return {
          lcp: window.__lcpData,
          navigation: nav ? {
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
            loadEventEnd: nav.loadEventEnd,
            responseStart: nav.responseStart,
            responseEnd: nav.responseEnd,
            transferSize: nav.transferSize || 0,
            encodedBodySize: nav.encodedBodySize || 0,
            decodedBodySize: nav.decodedBodySize || 0,
            type: nav.type || null,
          } : null,
          resources,
          title: document.title,
          finalUrl: location.href,
        };
      })())
    `,
    returnByValue: true,
  });
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  if (screenshotPath && screenshot.data) {
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  }
  const payload = {
    probe: JSON.parse(evalResult.result.value || 'null'),
    events: cdp.events,
    screenshotPath: screenshotPath || null,
  };
  console.log(JSON.stringify(payload));
  cdp.close();
} finally {
  chrome.kill('SIGKILL');
  rmSync(userDataDir, { recursive: true, force: true });
}
"""


@dataclass
class Target:
    key: str
    display_name: str
    property_id: str
    site_url: str


def normalize_site_url(url: str) -> str:
    return url.rstrip("/") + "/"


def load_browserstack_index() -> Dict[str, Dict[str, object]]:
    report_specs = [
        ("desktop", EVS_REPORTS_DIR / "browserstack-pilot-critical_cta_smoke-production-desktop_chrome.json"),
        ("iphone", EVS_REPORTS_DIR / "browserstack-pilot-critical_cta_smoke-production-iphone_safari.json"),
    ]
    merged: Dict[str, Dict[str, object]] = {}
    for label, path in report_specs:
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        for result in data.get("results", []):
            payload = result.get("payload")
            if not payload and result.get("stdout"):
                try:
                    payload = json.loads(result["stdout"])
                except Exception:
                    payload = None
            if not payload or not payload.get("device_runs"):
                continue
            run = payload["device_runs"][0]
            screenshot_ref = next(
                (
                    ref.get("url")
                    for ref in (run.get("evidence_refs") or [])
                    if ref.get("kind") == "artifact" and "screenshot" in (ref.get("label") or "").lower()
                ),
                None,
            )
            if not screenshot_ref:
                stderr_text = result.get("stderr") or ""
                match = re.search(r'"screenshot_path":"([^"]+)"', stderr_text)
                if match:
                    screenshot_ref = f"file://{match.group(1)}"
            screenshot_path = None
            if screenshot_ref and screenshot_ref.startswith("file://"):
                candidate = REPO_ROOT / screenshot_ref.replace("file://", "", 1)
                screenshot_path = str(candidate) if candidate.exists() else screenshot_ref
            elif screenshot_ref:
                screenshot_path = screenshot_ref

            join_key = normalize_site_url(result.get("target_url") or "")
            if not join_key.strip("/"):
                continue
            record = merged.setdefault(
                join_key,
                {
                    "browserstack_desktop_classification": None,
                    "browserstack_desktop_screenshot_path": None,
                    "browserstack_iphone_classification": None,
                    "browserstack_iphone_screenshot_path": None,
                    "browserstack_summary_json": None,
                },
            )
            if label == "desktop":
                record["browserstack_desktop_classification"] = run.get("classification")
                record["browserstack_desktop_screenshot_path"] = screenshot_path
            else:
                record["browserstack_iphone_classification"] = run.get("classification")
                record["browserstack_iphone_screenshot_path"] = screenshot_path
            record["browserstack_summary_json"] = json.dumps(
                {
                    "desktop_classification": record.get("browserstack_desktop_classification"),
                    "desktop_screenshot_path": record.get("browserstack_desktop_screenshot_path"),
                    "iphone_classification": record.get("browserstack_iphone_classification"),
                    "iphone_screenshot_path": record.get("browserstack_iphone_screenshot_path"),
                }
            )
    return merged


def load_targets(config_path: Path) -> List[Target]:
    config = json.loads(config_path.read_text())
    rows: List[Target] = []
    for row in config.get("cohorts", []):
        if row.get("role") != "pilot" or not row.get("active", True):
            continue
        rows.append(
            Target(
                key=row["key"],
                display_name=row["display_name"],
                property_id=str(row["property_id"]),
                site_url=row["site_url"],
            )
        )
    return rows


def ensure_probe_script() -> None:
    CHROME_PROBE_PATH.write_text(PROBE_SCRIPT, encoding="utf-8")


def run_probe(url: str, screenshot_path: Path) -> Dict[str, object]:
    env = os.environ.copy()
    env["CHROME_BINARY"] = CHROME_BINARY
    try:
        result = subprocess.run(
            ["node", str(CHROME_PROBE_PATH), url, str(screenshot_path)],
            capture_output=True,
            text=True,
            env=env,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = stderr or stdout or str(exc)
        raise RuntimeError(f"Chrome LCP probe failed for {url}: {detail[-1200:]}") from exc
    return json.loads(result.stdout.strip() or "null")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def find_lcp_url(latest: Dict[str, object]) -> Optional[str]:
    if latest.get("url"):
        return str(latest["url"])
    if latest.get("currentSrc"):
        return str(latest["currentSrc"])
    background_image = latest.get("backgroundImage")
    if isinstance(background_image, str):
        match = re.search(r'url\("?(.*?)"?\)', background_image)
        if match:
            return match.group(1)
    return None


def normalize_headers(headers: object) -> str:
    if isinstance(headers, dict):
        return json.dumps(headers, sort_keys=True)
    return json.dumps({})


def build_network_derived_fields(probe_payload: Dict[str, object]) -> Dict[str, object]:
    probe = probe_payload.get("probe") or {}
    events = probe_payload.get("events") or []
    lcp = (probe.get("lcp") or {}).get("latest") or {}
    lcp_url = find_lcp_url(lcp)
    lcp_start = lcp.get("startTime") or 0

    responses: Dict[str, Dict[str, object]] = {}
    failures: Dict[str, Dict[str, object]] = {}
    encoded_lengths: Dict[str, int] = {}
    console_errors: List[Dict[str, object]] = []

    for event in events:
        method = event.get("method")
        params = event.get("params") or {}
        if method == "Network.responseReceived":
            response = params.get("response") or {}
            responses[params.get("requestId")] = {
                "url": response.get("url"),
                "status": response.get("status"),
                "mimeType": response.get("mimeType"),
                "headers": response.get("headers") or {},
                "type": params.get("type"),
                "protocol": response.get("protocol"),
            }
        elif method == "Network.loadingFinished":
            encoded_lengths[params.get("requestId")] = int(params.get("encodedDataLength") or 0)
        elif method == "Network.loadingFailed":
            failures[params.get("requestId")] = {
                "errorText": params.get("errorText"),
                "canceled": params.get("canceled"),
                "blockedReason": params.get("blockedReason"),
            }
        elif method == "Runtime.consoleAPICalled" and params.get("type") == "error":
            args = []
            for arg in params.get("args") or []:
                value = arg.get("value")
                if value is not None:
                    args.append(str(value))
            console_errors.append(
                {
                    "source": "console",
                    "type": params.get("type"),
                    "text": " ".join(args)[:500],
                }
            )
        elif method == "Log.entryAdded":
            entry = params.get("entry") or {}
            if entry.get("level") == "error":
                console_errors.append(
                    {
                        "source": entry.get("source"),
                        "type": entry.get("level"),
                        "text": (entry.get("text") or "")[:500],
                    }
                )

    response_rows: List[Dict[str, object]] = []
    for request_id, response in responses.items():
        response_rows.append(
            {
                **response,
                "requestId": request_id,
                "encodedDataLength": encoded_lengths.get(request_id, 0),
                "failed": request_id in failures,
                "failure": failures.get(request_id),
            }
        )

    resources = probe.get("resources") or []
    resources_sorted = sorted(resources, key=lambda row: row.get("transferSize") or 0, reverse=True)
    blocking_resources = [
        {
            "url": row.get("name"),
            "initiatorType": row.get("initiatorType"),
            "responseEnd": row.get("responseEnd"),
            "duration": row.get("duration"),
            "transferSize": row.get("transferSize"),
            "renderBlockingStatus": row.get("renderBlockingStatus"),
        }
        for row in resources
        if (row.get("responseEnd") or 0) <= lcp_start
        and row.get("initiatorType") in {"link", "script", "css"}
    ]
    blocking_resources.sort(key=lambda row: (row.get("transferSize") or 0, row.get("duration") or 0), reverse=True)

    main_document = next((row for row in response_rows if row.get("type") == "Document"), None)
    lcp_resource = next((row for row in response_rows if row.get("url") == lcp_url), None)

    total_transfer_size = int(sum((row.get("transferSize") or 0) for row in resources))
    request_count = len(response_rows)
    failed_request_count = sum(1 for row in response_rows if row.get("failed"))

    network_summary = {
        "title": probe.get("title"),
        "final_url": probe.get("finalUrl"),
        "navigation": probe.get("navigation"),
        "top_requests_by_transfer_size": [
            {
                "url": row.get("name"),
                "initiatorType": row.get("initiatorType"),
                "transferSize": row.get("transferSize"),
                "duration": row.get("duration"),
                "responseEnd": row.get("responseEnd"),
            }
            for row in resources_sorted[:10]
        ],
        "top_requests_before_lcp": [
            {
                "url": row.get("name"),
                "initiatorType": row.get("initiatorType"),
                "transferSize": row.get("transferSize"),
                "duration": row.get("duration"),
                "responseEnd": row.get("responseEnd"),
            }
            for row in sorted(
                [row for row in resources if (row.get("responseEnd") or 0) <= lcp_start],
                key=lambda row: row.get("transferSize") or 0,
                reverse=True,
            )[:10]
        ],
    }

    return {
        "lcp_url": lcp_url,
        "main_document_status_code": main_document.get("status") if main_document else None,
        "main_document_headers_json": normalize_headers(main_document.get("headers") if main_document else {}),
        "lcp_resource_status_code": lcp_resource.get("status") if lcp_resource else None,
        "lcp_resource_headers_json": normalize_headers(lcp_resource.get("headers") if lcp_resource else {}),
        "total_request_count": request_count,
        "failed_request_count": failed_request_count,
        "total_transfer_size": total_transfer_size,
        "network_summary_json": json.dumps(network_summary),
        "blocking_resources_json": json.dumps(blocking_resources[:10]),
        "console_errors_json": json.dumps(console_errors[:20]),
        "raw_probe_json": json.dumps(probe_payload),
    }


def collect_one(target: Target, metric_date: str, browserstack_index: Dict[str, Dict[str, object]]) -> Dict[str, object]:
    screenshot_name = f"{metric_date}_{slugify(target.display_name)}.png"
    screenshot_path = SCREENSHOT_DIR / screenshot_name
    probe_payload = run_probe(target.site_url, screenshot_path)
    probe_data = probe_payload.get("probe") or {}
    latest = (probe_data.get("lcp") or {}).get("latest") or {}
    derived = build_network_derived_fields(probe_payload)
    browserstack_data = browserstack_index.get(normalize_site_url(target.site_url), {})
    return {
        "property_id": target.property_id,
        "property_name": target.display_name,
        "page_url": target.site_url,
        "metric_date": metric_date,
        "device_profile": "mobile_chrome_headless",
        "lcp_start_time_ms": latest.get("startTime"),
        "lcp_size": latest.get("size"),
        "lcp_url": derived.get("lcp_url"),
        "lcp_tag_name": latest.get("tagName"),
        "lcp_class_name": latest.get("className"),
        "lcp_text": latest.get("text"),
        "lcp_outer_html": latest.get("outerHTML"),
        "lcp_background_image": latest.get("backgroundImage"),
        "screenshot_path": str(screenshot_path),
        "main_document_status_code": derived.get("main_document_status_code"),
        "main_document_headers_json": derived.get("main_document_headers_json"),
        "lcp_resource_status_code": derived.get("lcp_resource_status_code"),
        "lcp_resource_headers_json": derived.get("lcp_resource_headers_json"),
        "total_request_count": derived.get("total_request_count"),
        "failed_request_count": derived.get("failed_request_count"),
        "total_transfer_size": derived.get("total_transfer_size"),
        "network_summary_json": derived.get("network_summary_json"),
        "blocking_resources_json": derived.get("blocking_resources_json"),
        "console_errors_json": derived.get("console_errors_json"),
        "browserstack_desktop_classification": browserstack_data.get(
            "browserstack_desktop_classification"
        ),
        "browserstack_desktop_screenshot_path": browserstack_data.get(
            "browserstack_desktop_screenshot_path"
        ),
        "browserstack_iphone_classification": browserstack_data.get(
            "browserstack_iphone_classification"
        ),
        "browserstack_iphone_screenshot_path": browserstack_data.get(
            "browserstack_iphone_screenshot_path"
        ),
        "browserstack_summary_json": browserstack_data.get("browserstack_summary_json"),
        "raw_probe_json": derived.get("raw_probe_json"),
    }


def is_retryable_homepage_error(exc: Exception) -> bool:
    text = str(exc).lower()
    retryable_markers = [
        "remote end closed connection without response",
        "connection aborted",
        "connection reset",
        "timed out",
        "timeout",
        "empty reply from server",
        "econnreset",
        "econnrefused",
        "socket hang up",
        "net::err_",
        "chrome lcp probe failed",
    ]
    return any(marker in text for marker in retryable_markers)


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect daily pilot homepage browser evidence")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--retries", type=int, default=2, help="Retry attempts per property after the initial failure")
    parser.add_argument("--retry-delay-seconds", type=int, default=15)
    args = parser.parse_args()

    ensure_probe_script()
    targets = load_targets(Path(args.config))
    browserstack_index = load_browserstack_index()
    if args.limit > 0:
        targets = targets[: args.limit]

    db = DatabaseManager(DB_PATH)
    collection_id = db.start_data_collection(args.date, "daily", "homepage_audit_evidence")
    rows: List[Dict[str, object]] = []
    successes = 0
    failures = 0
    errors: List[str] = []

    for target in targets:
        attempts = 0
        max_attempts = max(1, args.retries + 1)
        while attempts < max_attempts:
            attempts += 1
            try:
                if attempts > 1:
                    print(
                        f"Retrying homepage evidence for {target.display_name} "
                        f"({attempts}/{max_attempts}) after transient failure..."
                    )
                row = collect_one(target, args.date, browserstack_index)
                rows.append(row)
                db.insert_pilot_homepage_audit_evidence(
                    property_id=target.property_id,
                    property_name=target.display_name,
                    page_url=target.site_url,
                    metric_date=args.date,
                    evidence=row,
                    collection_id=collection_id,
                )
                successes += 1
                print(f"Collected homepage evidence for {target.display_name}")
                break
            except Exception as exc:
                should_retry = attempts < max_attempts and is_retryable_homepage_error(exc)
                if should_retry:
                    print(
                        f"Transient homepage evidence failure for {target.display_name}: {exc}\n"
                        f"Waiting {args.retry_delay_seconds}s before retry..."
                    )
                    time.sleep(max(0, args.retry_delay_seconds))
                    continue

                failures += 1
                errors.append(f"{target.display_name}: {exc}")
                print(f"Failed homepage evidence for {target.display_name}: {exc}")
                break

    payload = {
        "metric_date": args.date,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "rows": rows,
        "errors": errors,
    }
    dated_json = OUTPUT_DIR / f"pilot_homepage_audit_evidence_{args.date}.json"
    latest_json = OUTPUT_DIR / "pilot_homepage_audit_evidence_latest.json"
    dated_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    latest_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    db.complete_data_collection(
        collection_id=collection_id,
        properties_collected=successes,
        properties_failed=failures,
        error_message="; ".join(errors[:10]) if errors else None,
    )
    print(f"Wrote {dated_json}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
