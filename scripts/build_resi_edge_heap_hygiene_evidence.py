#!/usr/bin/env python3
"""Build read-only Heap hygiene evidence for the Resi Edge launch batch."""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OPTIMIZATION_PREP_ROOT = ROOT / "reports/resi_edge_performance/optimization-prep"
OUT_ROOT = ROOT / "reports/resi_edge_performance/heap-hygiene"
EXPECTED_HEAP_ID = "286627304"
OLD_HEAP_ID = "676880719"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123 Safari/537.36"
)
BROWSER_SAMPLE_DEFAULT = 3


def latest_optimization_prep() -> Path:
    matches = sorted(OPTIMIZATION_PREP_ROOT.glob("*/optimization-prep-readiness.json"))
    if not matches:
        raise FileNotFoundError(f"No optimization prep packet found under {OPTIMIZATION_PREP_ROOT}")
    return matches[-1]


def load_domains(path: Path) -> list[dict[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("rows") or []
    domains: list[dict[str, str]] = []
    for row in rows:
        domain = str(row.get("domain") or "").strip()
        if not domain:
            continue
        domains.append(
            {
                "domain": domain,
                "property_code": str(row.get("property_code") or ""),
                "property_name": str(row.get("property_name") or domain),
            }
        )
    return domains


def heap_ids_from_html(html: str) -> list[str]:
    patterns = (
        re.compile(r"heap\.load\(['\"](\d+)['\"]"),
        re.compile(r"cdn\.us\.heap-api\.com/config/(\d+)/"),
        re.compile(r"heap_config\.js[^0-9]*(\d+)"),
    )
    ids: list[str] = []
    for pattern in patterns:
        ids.extend(pattern.findall(html))
    return sorted({item for item in ids if item and item != "0"})


def fetch_source(row: dict[str, str]) -> dict[str, Any]:
    domain = row["domain"]
    url = f"https://{domain}/?heap_hygiene={int(time.time())}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            html = response.read().decode("utf-8", errors="replace")
            ids = heap_ids_from_html(html)
            return {
                **row,
                "url": url,
                "status": response.status,
                "final_url": response.geturl(),
                "ok": 200 <= response.status < 300,
                "heap_ids": ids,
                "old_heap_present": OLD_HEAP_ID in ids or OLD_HEAP_ID in html,
                "expected_heap_present": EXPECTED_HEAP_ID in ids or EXPECTED_HEAP_ID in html,
                "dual_heap_present": OLD_HEAP_ID in html and EXPECTED_HEAP_ID in html,
                "heap_debug_token_present": "HEAP_JS_DEBUG" in html,
                "heap_debug_true": bool(re.search(r"HEAP_JS_DEBUG\s*=\s*true", html)),
                "html_bytes": len(html.encode("utf-8")),
                "error": "",
            }
    except Exception as exc:  # noqa: BLE001 - evidence packet should preserve failures
        return {
            **row,
            "url": url,
            "status": 0,
            "final_url": url,
            "ok": False,
            "heap_ids": [],
            "old_heap_present": False,
            "expected_heap_present": False,
            "dual_heap_present": False,
            "heap_debug_token_present": False,
            "heap_debug_true": False,
            "html_bytes": 0,
            "error": str(exc),
        }


def run_browser_sample(rows: list[dict[str, Any]], browser_limit: int) -> list[dict[str, Any]]:
    if browser_limit <= 0:
        return []
    sample = rows[:browser_limit]
    node_script = ROOT / "scripts/tmp_heap_hygiene_browser_check.mjs"
    payload = json.dumps([row["domain"] for row in sample])
    script = f"""
import {{ chromium }} from 'playwright';
const domains = {payload};
const browser = await chromium.launch({{ headless: true }});
const results = [];
for (const domain of domains) {{
  const context = await browser.newContext({{
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: {{ width: 390, height: 844 }},
  }});
  const page = await context.newPage();
  const heapUrls = [];
  page.on('request', req => {{
    const url = req.url();
    if (url.includes('heap-api.com') || url.includes('heapanalytics.com')) heapUrls.push(url);
  }});
  let status = 0;
  let error = '';
  try {{
    const res = await page.goto(`https://${{domain}}/?heap_browser_check=${{Date.now()}}`, {{ waitUntil: 'domcontentloaded', timeout: 30000 }});
    status = res?.status() ?? 0;
    await page.waitForTimeout(6000);
  }} catch (err) {{
    error = String(err?.message || err);
  }}
  const ids = [...new Set(heapUrls.map(url => (url.match(/\\/config\\/(\\d+)\\//) || [])[1]).filter(Boolean))].sort();
  results.push({{
    domain,
    status,
    heap_ids: ids,
    old_heap_present: ids.includes('{OLD_HEAP_ID}') || heapUrls.some(url => url.includes('{OLD_HEAP_ID}')),
    expected_heap_present: ids.includes('{EXPECTED_HEAP_ID}') || heapUrls.some(url => url.includes('{EXPECTED_HEAP_ID}')),
    heap_request_count: heapUrls.length,
    capture_request_count: heapUrls.filter(url => url.includes('/api/capture/')).length,
    sample_urls: [...new Set(heapUrls)].slice(0, 10),
    error,
  }});
  await context.close();
}}
await browser.close();
console.log(JSON.stringify(results));
"""
    try:
        node_script.write_text(script, encoding="utf-8")
        result = subprocess.run(
            ["node", str(node_script)],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=max(45, browser_limit * 20),
        )
        if result.returncode != 0:
            return [
                {
                    "domain": row["domain"],
                    "status": 0,
                    "heap_ids": [],
                    "old_heap_present": False,
                    "expected_heap_present": False,
                    "heap_request_count": 0,
                    "capture_request_count": 0,
                    "sample_urls": [],
                    "error": result.stderr.strip() or result.stdout.strip(),
                }
                for row in sample
            ]
        return json.loads(result.stdout)
    finally:
        node_script.unlink(missing_ok=True)


def row_clean(row: dict[str, Any]) -> bool:
    return (
        row.get("ok")
        and not row.get("old_heap_present")
        and row.get("expected_heap_present")
        and not row.get("heap_debug_true")
        and not row.get("dual_heap_present")
    )


def write_outputs(rows: list[dict[str, Any]], browser_rows: list[dict[str, Any]], source_path: Path) -> Path:
    generated = datetime.now(timezone.utc)
    run_dir = OUT_ROOT / f"heap-hygiene-{generated.strftime('%Y%m%dT%H%M%SZ')}"
    run_dir.mkdir(parents=True, exist_ok=True)
    browser_by_domain = {row["domain"]: row for row in browser_rows}
    for row in rows:
        row["browser"] = browser_by_domain.get(row["domain"])
        row["clean"] = row_clean(row)
    summary = {
        "properties": len(rows),
        "clean": sum(1 for row in rows if row["clean"]),
        "source_ok": sum(1 for row in rows if row["ok"]),
        "old_heap_present": sum(1 for row in rows if row["old_heap_present"]),
        "expected_heap_present": sum(1 for row in rows if row["expected_heap_present"]),
        "dual_heap_present": sum(1 for row in rows if row["dual_heap_present"]),
        "heap_debug_true": sum(1 for row in rows if row["heap_debug_true"]),
        "browser_checked": len(browser_rows),
        "browser_old_heap_present": sum(1 for row in browser_rows if row.get("old_heap_present")),
        "browser_expected_heap_present": sum(1 for row in browser_rows if row.get("expected_heap_present")),
        "status": "clean" if rows and all(row["clean"] for row in rows) else "blocked",
        "expected_heap_id": EXPECTED_HEAP_ID,
        "old_heap_id": OLD_HEAP_ID,
    }
    payload = {
        "generated_at": generated.isoformat(),
        "generated_for_display": generated.astimezone().strftime("%m/%d/%Y %I:%M %p"),
        "source_packet": str(source_path.relative_to(ROOT)),
        "mutation_policy": "read_only_no_live_domain_mutation",
        "summary": summary,
        "rows": rows,
        "browser_rows": browser_rows,
    }
    (run_dir / "heap-hygiene-evidence.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with (run_dir / "heap-hygiene-evidence.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = [
            "property_code",
            "property_name",
            "domain",
            "status",
            "ok",
            "heap_ids",
            "old_heap_present",
            "expected_heap_present",
            "dual_heap_present",
            "heap_debug_true",
            "clean",
            "browser_heap_ids",
            "browser_old_heap_present",
            "browser_expected_heap_present",
            "error",
        ]
        writer = csv.DictWriter(handle, fields)
        writer.writeheader()
        for row in rows:
            browser = row.get("browser") or {}
            writer.writerow(
                {
                    "property_code": row["property_code"],
                    "property_name": row["property_name"],
                    "domain": row["domain"],
                    "status": row["status"],
                    "ok": row["ok"],
                    "heap_ids": ";".join(row["heap_ids"]),
                    "old_heap_present": row["old_heap_present"],
                    "expected_heap_present": row["expected_heap_present"],
                    "dual_heap_present": row["dual_heap_present"],
                    "heap_debug_true": row["heap_debug_true"],
                    "clean": row["clean"],
                    "browser_heap_ids": ";".join(browser.get("heap_ids") or []),
                    "browser_old_heap_present": browser.get("old_heap_present", ""),
                    "browser_expected_heap_present": browser.get("expected_heap_present", ""),
                    "error": row["error"] or browser.get("error", ""),
                }
            )
    lines = [
        "# Resi Edge Heap Hygiene Evidence",
        "",
        f"Human date: {generated.astimezone().strftime('%m/%d/%Y %I:%M %p')}",
        "",
        "Read-only packet. No DNS, Cloudflare, WordPress/Kinsta, Zaraz, GA4, Ahrefs, R2, cache, or Worker mutation was performed.",
        "",
        "## Summary",
        "",
        f"- Properties checked: `{summary['properties']}`",
        f"- Clean for optimization: `{summary['clean']}/{summary['properties']}`",
        f"- Old Heap `{OLD_HEAP_ID}` present in source: `{summary['old_heap_present']}/{summary['properties']}`",
        f"- Production Heap `{EXPECTED_HEAP_ID}` present in source: `{summary['expected_heap_present']}/{summary['properties']}`",
        f"- Dual Heap source present: `{summary['dual_heap_present']}/{summary['properties']}`",
        f"- `HEAP_JS_DEBUG = true` present: `{summary['heap_debug_true']}/{summary['properties']}`",
        f"- Browser samples checked: `{summary['browser_checked']}`",
        f"- Browser samples with old Heap network activity: `{summary['browser_old_heap_present']}/{summary['browser_checked']}`",
        "",
        "## Resi Fix Request",
        "",
        f"Remove the old/direct Heap loader `{OLD_HEAP_ID}` and disable `HEAP_JS_DEBUG` on the live launch sites. Keep the approved production Heap ID `{EXPECTED_HEAP_ID}` only.",
        "",
        "## Property Evidence",
        "",
        "| Property | Domain | Source IDs | Old | Prod | Debug | Browser IDs | Clean |",
        "| --- | --- | --- | ---: | ---: | ---: | --- | ---: |",
    ]
    for row in rows:
        browser = row.get("browser") or {}
        lines.append(
            f"| {row['property_name']} (`{row['property_code']}`) | `{row['domain']}` | `{','.join(row['heap_ids']) or 'none'}` | `{row['old_heap_present']}` | `{row['expected_heap_present']}` | `{row['heap_debug_true']}` | `{','.join(browser.get('heap_ids') or []) or 'not sampled'}` | `{row['clean']}` |"
        )
    (run_dir / "HEAP_HYGIENE_EVIDENCE.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest.json").write_text(json.dumps({"latest": str(run_dir.relative_to(ROOT))}, indent=2) + "\n", encoding="utf-8")
    return run_dir


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser-samples", type=int, default=BROWSER_SAMPLE_DEFAULT)
    parser.add_argument("--browser-all", action="store_true")
    args = parser.parse_args()
    source_path = latest_optimization_prep()
    domains = load_domains(source_path)
    if not domains:
        print("No domains found in latest optimization prep packet.", file=sys.stderr)
        return 2
    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(fetch_source, domains))
    browser_limit = len(rows) if args.browser_all else max(0, min(args.browser_samples, len(rows)))
    browser_rows = run_browser_sample(rows, browser_limit)
    run_dir = write_outputs(rows, browser_rows, source_path)
    print(json.dumps({"out_dir": str(run_dir), "properties": len(rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
