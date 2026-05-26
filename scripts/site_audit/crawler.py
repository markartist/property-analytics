"""
Site Audit Crawler
==================
Playwright-based headless browser that crawls property pages and runs audit checks.

- Resi sites: discovers pages via sitemap.xml
- Legacy sites: uses hardcoded subpages (home, gallery, reviews)
"""

from __future__ import annotations

import asyncio
import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .checks import (
    check_broken_images,
    check_broken_links,
    check_missing_meta,
    check_unloaded_tours,
    process_console_errors,
)
from .models import AuditIssue, PageAuditResult, PropertyAuditResult

# Default fallback subpages relative to the property base URL
DEFAULT_SUBPAGES = ["", "gallery/", "reviews/"]

PAGE_LOAD_TIMEOUT_MS = 30_000
NETWORK_IDLE_TIMEOUT_MS = 10_000


# ---------------------------------------------------------------------------
# Sitemap discovery (Resi sites)
# ---------------------------------------------------------------------------

async def _discover_pages_from_sitemap(
    context: BrowserContext, base_url: str
) -> List[str]:
    """Fetch and parse sitemap.xml to get page URLs for a Resi site."""
    parsed = urlparse(base_url)
    sitemap_url = f"{parsed.scheme}://{parsed.hostname}/sitemap.xml"

    try:
        resp = await context.request.get(sitemap_url, timeout=15_000)
        if resp.status != 200:
            # Fallback: just use the homepage
            return [base_url]

        body = await resp.text()
        root = ET.fromstring(body)

        # Handle both sitemap index and urlset
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls: List[str] = []

        # Direct urlset
        for loc in root.findall(".//sm:url/sm:loc", ns):
            if loc.text:
                urls.append(loc.text.strip())

        # If it's a sitemap index, fetch child sitemaps
        if not urls:
            for sitemap_loc in root.findall(".//sm:sitemap/sm:loc", ns):
                if sitemap_loc.text:
                    child_urls = await _fetch_child_sitemap(context, sitemap_loc.text.strip(), ns)
                    urls.extend(child_urls)

        if not urls:
            return [base_url]

        # Filter to same domain only
        domain = parsed.hostname
        urls = [u for u in urls if urlparse(u).hostname == domain]

        return urls or [base_url]

    except Exception as e:
        print(f"    ⚠️  Sitemap fetch failed for {base_url}: {e}")
        return [base_url]


async def _fetch_child_sitemap(
    context: BrowserContext, url: str, ns: dict
) -> List[str]:
    """Fetch a child sitemap from a sitemap index."""
    try:
        resp = await context.request.get(url, timeout=15_000)
        if resp.status != 200:
            return []
        body = await resp.text()
        root = ET.fromstring(body)
        return [
            loc.text.strip()
            for loc in root.findall(".//sm:url/sm:loc", ns)
            if loc.text
        ]
    except Exception:
        return []


def _discover_pages_from_contract(base_url: str, prop: dict) -> List[str]:
    """Build page URLs from explicit known page paths on the property contract."""
    known_page_paths = prop.get("known_page_paths") or []
    if not known_page_paths:
        return []

    base = base_url.rstrip("/")
    urls: List[str] = []
    seen = set()
    for raw_path in known_page_paths:
        path = str(raw_path or "").strip()
        if not path:
            continue
        if path == "/":
            url = base + "/"
        elif path.startswith("http://") or path.startswith("https://"):
            url = path
        else:
            normalized = path if path.startswith("/") else f"/{path}"
            url = base + normalized
        key = url.rstrip("/") or url
        if key in seen:
            continue
        seen.add(key)
        urls.append(url)

    return urls


# ---------------------------------------------------------------------------
# Single page audit
# ---------------------------------------------------------------------------

async def _audit_page(
    page: Page,
    url: str,
    base_domain: str,
    link_cache: dict,
) -> PageAuditResult:
    """Load a single page and run all audit checks."""
    console_errors: List[dict] = []

    # Collect console errors during page load
    def on_console(msg):
        if msg.type == "error":
            console_errors.append({"text": msg.text})

    def on_pageerror(error):
        console_errors.append({"text": str(error)})

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    start = time.monotonic()
    status_code = 0

    try:
        response = await page.goto(
            url,
            wait_until="networkidle",
            timeout=PAGE_LOAD_TIMEOUT_MS,
        )
        status_code = response.status if response else 0
    except Exception as e:
        load_time_ms = int((time.monotonic() - start) * 1000)
        return PageAuditResult(
            url=url,
            status_code=0,
            load_time_ms=load_time_ms,
            issues=[
                AuditIssue(
                    severity="critical",
                    category="broken_link",
                    page_url=url,
                    description=f"Page failed to load: {type(e).__name__}",
                    detail=str(e)[:200],
                )
            ],
        )

    # Wait a bit for lazy-loaded content
    try:
        await page.wait_for_timeout(2000)
    except Exception:
        pass

    load_time_ms = int((time.monotonic() - start) * 1000)

    # Run all checks
    issues: List[AuditIssue] = []

    try:
        issues.extend(await check_broken_images(page, url))
    except Exception as e:
        print(f"    ⚠️  Image check failed on {url}: {e}")

    try:
        issues.extend(await check_unloaded_tours(page, url))
    except Exception as e:
        print(f"    ⚠️  Tour check failed on {url}: {e}")

    try:
        issues.extend(process_console_errors(console_errors, url))
    except Exception as e:
        print(f"    ⚠️  Console error processing failed on {url}: {e}")

    try:
        issues.extend(await check_broken_links(page, url, base_domain, link_cache))
    except Exception as e:
        print(f"    ⚠️  Link check failed on {url}: {e}")

    try:
        issues.extend(await check_missing_meta(page, url))
    except Exception as e:
        print(f"    ⚠️  Meta check failed on {url}: {e}")

    # Deduplicate: if the same URL is flagged as both broken_image and
    # broken_link, keep only the broken_image (more specific).
    broken_image_urls = {
        issue.detail.split(" — ")[0]
        for issue in issues
        if issue.category == "broken_image" and issue.detail
    }
    if broken_image_urls:
        issues = [
            issue for issue in issues
            if not (
                issue.category == "broken_link"
                and any(img_url in issue.detail for img_url in broken_image_urls)
            )
        ]

    # Remove listeners
    page.remove_listener("console", on_console)
    page.remove_listener("pageerror", on_pageerror)

    return PageAuditResult(
        url=url,
        status_code=status_code,
        load_time_ms=load_time_ms,
        issues=issues,
    )


# ---------------------------------------------------------------------------
# Property-level audit
# ---------------------------------------------------------------------------

async def audit_property(
    browser: Browser,
    prop: dict,
    verbose: bool = True,
) -> PropertyAuditResult:
    """Audit all pages of a single property."""
    name = prop["name"]
    base_url = prop["full_url"].rstrip("/") + "/"
    site_type = prop.get("site_type", "legacy")
    base_domain = urlparse(base_url).hostname or ""

    if verbose:
        print(f"  🔍 {name} ({site_type}) — {base_url}")

    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) VenterraAuditBot/1.0",
        viewport={"width": 1440, "height": 900},
        ignore_https_errors=True,
    )

    # Discover pages
    contract_pages = _discover_pages_from_contract(base_url, prop)
    if contract_pages:
        pages_to_check = contract_pages
    elif site_type == "resi":
        pages_to_check = await _discover_pages_from_sitemap(context, base_url)
    else:
        pages_to_check = [base_url + sub for sub in DEFAULT_SUBPAGES]

    if verbose:
        print(f"    📄 {len(pages_to_check)} pages to audit")

    link_cache: dict = {}
    page_results: List[PageAuditResult] = []

    page = await context.new_page()

    for page_url in pages_to_check:
        try:
            result = await _audit_page(page, page_url, base_domain, link_cache)
            page_results.append(result)
            issue_count = len(result.issues)
            if verbose and issue_count > 0:
                print(f"    ⚠️  {page_url} — {issue_count} issue(s)")
        except Exception as e:
            print(f"    ❌ {page_url} — error: {e}")
            page_results.append(PageAuditResult(
                url=page_url,
                status_code=0,
                load_time_ms=0,
                issues=[AuditIssue(
                    severity="critical",
                    category="broken_link",
                    page_url=page_url,
                    description=f"Audit failed: {type(e).__name__}",
                    detail=str(e)[:200],
                )],
            ))

    await page.close()
    await context.close()

    return PropertyAuditResult(
        name=name,
        site_type=site_type,
        base_url=base_url,
        pages=page_results,
    )


# ---------------------------------------------------------------------------
# Portfolio-level orchestration
# ---------------------------------------------------------------------------

async def audit_portfolio(
    properties: List[dict],
    max_concurrent: int = 3,
    verbose: bool = True,
) -> List[PropertyAuditResult]:
    """
    Audit all properties in the portfolio.

    Uses a semaphore to limit concurrent browser contexts.
    """
    results: List[PropertyAuditResult] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        semaphore = asyncio.Semaphore(max_concurrent)

        async def _bounded_audit(prop: dict) -> PropertyAuditResult:
            async with semaphore:
                return await audit_property(browser, prop, verbose=verbose)

        tasks = [_bounded_audit(prop) for prop in properties]
        results = await asyncio.gather(*tasks, return_exceptions=False)

        await browser.close()

    return list(results)
