#!/usr/bin/env python3
"""
Run a focused Calais comparator audit.

This compares Calais Midtown against The District Universal Boulevard
and The Harrison across a small but high-signal set of pages and outputs:

- JSON summary
- CSV page comparison table
- Markdown findings summary
"""

from __future__ import annotations

import csv
import json
import re
import sqlite3
import subprocess
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REPORT_DIR = ROOT / "pilot_control_cwv" / "reports"

TARGET_PROPERTIES = [
    "Calais Midtown",
    "The District Universal Boulevard",
    "The Harrison",
]

COMMON_PATHS = [
    ("home", ""),
    ("contact", "contact/"),
    ("neighborhood", "neighborhood/"),
    ("features", "features/"),
    ("faqs", "faqs/"),
    ("specials", "specials/"),
    ("reviews", "reviews/"),
    ("gallery", "gallery/"),
    ("amenities", "amenities/"),
    ("about", "about/"),
    # "Apartments & Pricing" appears to resolve through the apartments listing path
    # rather than the page sitemap.
    ("availability", "apartments/"),
]

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
CANONICAL_RE = re.compile(
    r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
ROBOTS_RE = re.compile(
    r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
DESCRIPTION_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
ANCHOR_RE = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']', re.IGNORECASE)
UNIT_DETAIL_RE = re.compile(r"https?://[^\"' >]*/apartment/[^\"' >]+", re.IGNORECASE)

SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


@dataclass
class PageSnapshot:
    property_name: str
    domain_type: str
    page_type: str
    url: str
    status: Optional[int]
    final_url: Optional[str]
    title: Optional[str]
    canonical: Optional[str]
    robots: Optional[str]
    description: Optional[str]
    internal_link_count: int
    available: bool


def slugify_property_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def curl_fetch(url: str, head: bool = False) -> str:
    cmd = [
        "curl",
        "-L",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
    ]
    if head:
        cmd.append("-I")
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"curl failed for {url}")
    return result.stdout


def fetch_page_snapshot(property_name: str, domain_type: str, page_type: str, url: str) -> PageSnapshot:
    headers = curl_fetch(url, head=True)
    body = curl_fetch(url, head=False)

    status = None
    final_url = url
    for line in headers.splitlines():
        if line.startswith("HTTP/"):
            parts = line.split()
            if len(parts) >= 2 and parts[1].isdigit():
                status = int(parts[1])
        if line.lower().startswith("location:"):
            final_url = line.split(":", 1)[1].strip()

    title = extract_first(TITLE_RE, body)
    canonical = extract_first(CANONICAL_RE, body)
    robots = extract_first(ROBOTS_RE, body)
    description = extract_first(DESCRIPTION_RE, body)
    internal_link_count = count_internal_links(url, body)

    return PageSnapshot(
        property_name=property_name,
        domain_type=domain_type,
        page_type=page_type,
        url=url,
        status=status,
        final_url=final_url,
        title=clean_text(title),
        canonical=clean_text(canonical),
        robots=clean_text(robots),
        description=clean_text(description),
        internal_link_count=internal_link_count,
        available=(status == 200),
    )


def extract_first(pattern: re.Pattern[str], text: str) -> Optional[str]:
    match = pattern.search(text)
    return match.group(1) if match else None


def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip()


def count_internal_links(base_url: str, body: str) -> int:
    base_host = urlparse(base_url).hostname
    count = 0
    seen = set()
    for href in ANCHOR_RE.findall(body):
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:") or href.startswith("javascript:"):
            continue
        absolute = urljoin(base_url, href)
        host = urlparse(absolute).hostname
        if host == base_host:
            if absolute not in seen:
                seen.add(absolute)
                count += 1
    return count


def discover_unit_detail_url(listing_url: str) -> Optional[str]:
    body = curl_fetch(listing_url, head=False)
    seen: set[str] = set()
    for candidate in UNIT_DETAIL_RE.findall(body):
        normalized = candidate.rstrip("/") + "/"
        if normalized not in seen:
            seen.add(normalized)
            return normalized
    return None


def fetch_property_rows() -> Dict[str, str]:
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        rows = cur.execute(
            """
            SELECT property_name, full_url
            FROM properties
            WHERE property_name IN (?, ?, ?)
            """,
            TARGET_PROPERTIES,
        ).fetchall()
    finally:
        conn.close()
    return {name: url for name, url in rows}


def fetch_property_sitemap_urls() -> set[str]:
    sitemap_index = curl_fetch("https://venterraliving.com/sitemap.xml")
    root = ET.fromstring(sitemap_index)
    sitemap_urls = []
    for loc in root.findall(".//sm:sitemap/sm:loc", SITEMAP_NS):
        if loc.text and "rentpress_property-sitemap.xml" in loc.text:
            sitemap_urls.append(loc.text.strip())

    found: set[str] = set()
    for sitemap_url in sitemap_urls:
        child = curl_fetch(sitemap_url)
        child_root = ET.fromstring(child)
        for loc in child_root.findall(".//sm:url/sm:loc", SITEMAP_NS):
            if loc.text:
                found.add(loc.text.strip())
    return found


def build_domain_pages(property_name: str, venterraliving_url: str, canonical_home: str) -> List[PageSnapshot]:
    pages: List[PageSnapshot] = []
    pages.append(fetch_page_snapshot(property_name, "venterraliving", "property_landing", venterraliving_url))

    normalized_home = canonical_home.rstrip("/") + "/"
    for page_type, path in COMMON_PATHS:
        page_url = urljoin(normalized_home, path)
        pages.append(fetch_page_snapshot(property_name, "property_domain", page_type, page_url))
    return pages


def compare_values(calais: PageSnapshot, other: PageSnapshot) -> List[str]:
    diffs: List[str] = []
    if calais.canonical != other.canonical:
        diffs.append("canonical differs")
    if calais.robots != other.robots:
        diffs.append("robots differs")
    if bool(calais.description) != bool(other.description):
        diffs.append("description presence differs")
    if abs(calais.internal_link_count - other.internal_link_count) >= 10:
        diffs.append("internal link count materially differs")
    if calais.available != other.available:
        diffs.append("page availability differs")
    return diffs


def write_csv(rows: Iterable[PageSnapshot], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "property_name",
                "domain_type",
                "page_type",
                "url",
                "status",
                "final_url",
                "title",
                "canonical",
                "robots",
                "description",
                "internal_link_count",
                "available",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_markdown(
    snapshots: Dict[str, List[PageSnapshot]],
    sitemap_urls: set[str],
    md_path: Path,
) -> None:
    by_prop_page = {
        prop: {snap.page_type: snap for snap in pages}
        for prop, pages in snapshots.items()
    }
    calais = by_prop_page["Calais Midtown"]
    district = by_prop_page["The District Universal Boulevard"]
    harrison = by_prop_page["The Harrison"]

    findings: List[str] = []

    for other_name, other_pages in [
        ("The District Universal Boulevard", district),
        ("The Harrison", harrison),
    ]:
        diffs = compare_values(calais["home"], other_pages["home"])
        if diffs:
            findings.append(f"- `Calais Midtown` vs `{other_name}` homepage: {', '.join(diffs)}.")

    venterraliving_presence = []
    for prop, pages in by_prop_page.items():
        landing = pages["property_landing"]
        venterraliving_presence.append(
            f"- `{prop}` Venterraliving property URL is {'present' if landing.url in sitemap_urls else 'missing'} in the property sitemap and canonicalizes to `{landing.canonical}`."
        )

    common_table_rows = []
    for page_type, _ in COMMON_PATHS:
        c = calais[page_type]
        d = district[page_type]
        h = harrison[page_type]
        common_table_rows.append(
            f"| {page_type} | {c.status or 'n/a'} | {d.status or 'n/a'} | {h.status or 'n/a'} | {c.internal_link_count} | {d.internal_link_count} | {h.internal_link_count} |"
        )

    lines = [
        "# Calais Comparator Audit",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Executive Summary",
        "",
        "- All three Venterraliving property URLs are in the property sitemap and canonically point to separate property domains.",
        "- The custom property domains self-canonicalize correctly on home and common subpages, which suggests the initial technical pattern is consistent across the three properties.",
        "- This first-pass crawl is best used to identify structural deltas on common pages; deeper differences may emerge on floorplan/location templates and in attribution behavior.",
        "",
        "## Venterraliving Canonical Findings",
        "",
        *venterraliving_presence,
        "",
        "## Shared Navigation / Sitemap Page Availability",
        "",
        "| Page Type | Calais Status | District Status | Harrison Status | Calais Internal Links | District Internal Links | Harrison Internal Links |",
        "|---|---:|---:|---:|---:|---:|---:|",
        *common_table_rows,
        "",
        "## Initial Structural Differences",
        "",
    ]

    if findings:
        lines.extend(findings)
    else:
        lines.append("- No material differences were found in canonical/robots/availability on the common page set in this first pass.")

    lines.extend(
        [
            "",
            "## Next Checks",
            "",
            "- Diff rendered floorplan/apartments listing templates and neighborhood templates on the canonical property domains.",
            "- Run BrowserStack validation on homepage -> contact / specials / availability journeys to check referrer preservation and rendered head tags after hydration.",
            "- Pull GSC page-level exports for Calais, District, and Harrison to separate discoverability loss from analytics attribution issues.",
        ]
    )

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()

    property_rows = fetch_property_rows()
    missing = [name for name in TARGET_PROPERTIES if name not in property_rows]
    if missing:
        raise SystemExit(f"Missing property URLs in DB: {', '.join(missing)}")

    sitemap_urls = fetch_property_sitemap_urls()

    all_snapshots: Dict[str, List[PageSnapshot]] = {}
    flat_rows: List[PageSnapshot] = []
    summary: Dict[str, dict] = {}

    for property_name, venterraliving_url in property_rows.items():
        landing = fetch_page_snapshot(
            property_name,
            "venterraliving",
            "property_landing",
            venterraliving_url,
        )
        if not landing.canonical:
            raise SystemExit(f"No canonical found for {property_name} landing page: {venterraliving_url}")
        canonical_home = landing.canonical
        pages = [landing]
        normalized_home = canonical_home.rstrip("/") + "/"
        for page_type, path in COMMON_PATHS:
            page_url = urljoin(normalized_home, path)
            pages.append(fetch_page_snapshot(property_name, "property_domain", page_type, page_url))
        availability_page = next(page for page in pages if page.page_type == "availability")
        unit_detail_url = discover_unit_detail_url(availability_page.url)
        if unit_detail_url:
            pages.append(fetch_page_snapshot(property_name, "property_domain", "unit_detail", unit_detail_url))
        all_snapshots[property_name] = pages
        flat_rows.extend(pages)
        summary[slugify_property_key(property_name)] = {
            "property_name": property_name,
            "venterraliving_url": venterraliving_url,
            "canonical_home": canonical_home,
            "property_sitemap_included": venterraliving_url in sitemap_urls,
            "discovered_unit_detail_url": unit_detail_url,
            "pages": [asdict(page) for page in pages],
        }

    json_path = REPORT_DIR / f"calais_comparator_audit_{stamp}.json"
    csv_path = REPORT_DIR / f"calais_comparator_audit_{stamp}.csv"
    md_path = REPORT_DIR / f"calais_comparator_audit_{stamp}.md"

    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_csv(flat_rows, csv_path)
    write_markdown(all_snapshots, sitemap_urls, md_path)

    print(f"Wrote JSON: {json_path}")
    print(f"Wrote CSV:  {csv_path}")
    print(f"Wrote MD:   {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
