#!/usr/bin/env python3
"""Read-only vanity-domain QA for the Resi Edge launch cohort."""

from __future__ import annotations

import csv
import json
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "apps/web/src/lib/resi-edge-launch/generated-snapshot.ts"
OUT_ROOT = ROOT / "reports/domain_ops"
HTTP_TIMEOUT = 25
UA = "VenterraWebOpsLaunchQA/1.0 (+read-only)"

PLACEHOLDER_PATTERNS = (
    r"\[\*[^]]+\*\]",
    r"\[PROPERTY",
    r"\*PROPERTY",
    r"lorem ipsum",
    r"TODO",
)

CTA_WORDS = (
    "availability",
    "available",
    "find your home",
    "apply",
    "tour",
    "schedule",
    "contact",
    "call",
    "lease",
)

CORE_PAGE_WORDS = (
    "apartment",
    "pricing",
    "floor",
    "feature",
    "amenit",
    "gallery",
    "location",
    "neighborhood",
    "faq",
    "review",
    "contact",
    "special",
    "about",
)


@dataclass
class LinkRecord:
    text: str
    href: str
    kind: str


@dataclass
class CorePageRecord:
    text: str
    url: str
    status: int | None
    final_url: str
    title: str
    canonical: str
    meta_robots: str
    issue: str = ""


@dataclass
class PropertyQa:
    property_code: str
    property_name: str
    domain: str
    current_url: str
    vanity_url: str
    root_status: int | None = None
    root_final_url: str = ""
    root_final_host: str = ""
    www_status: int | None = None
    www_final_url: str = ""
    title: str = ""
    meta_description: str = ""
    canonical: str = ""
    meta_robots: str = ""
    x_robots: str = ""
    robots_txt_status: int | None = None
    robots_txt_indexable: bool = False
    sitemap_status: int | None = None
    tel_links: int = 0
    cta_links: list[LinkRecord] = field(default_factory=list)
    core_pages: list[CorePageRecord] = field(default_factory=list)
    suspect_links: list[LinkRecord] = field(default_factory=list)
    placeholder_hits: list[str] = field(default_factory=list)
    kinsta_leaks: list[str] = field(default_factory=list)
    mobile_status: str = "not_run"
    mobile_final_url: str = ""
    mobile_title: str = ""
    mobile_screenshot: str = ""
    issues: list[str] = field(default_factory=list)
    result: str = "red"


def load_snapshot() -> dict[str, Any]:
    text = SNAPSHOT.read_text()
    start = text.index("export const launchSnapshot = ") + len("export const launchSnapshot = ")
    end = text.rindex(" satisfies LaunchSnapshot;")
    return json.loads(text[start:end])


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"User-Agent": UA})
    return sess


def fetch(sess: requests.Session, url: str) -> requests.Response | None:
    try:
        return sess.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True)
    except requests.RequestException:
        return None


def robots_allows_general_search(text: str) -> bool:
    """Return whether the general/search crawler groups avoid a root disallow."""

    active_agents: list[str] = []
    group_has_target_agent = False
    target_group_blocks_root = False

    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            active_agents = []
            group_has_target_agent = False
            continue
        if ":" not in line:
            continue
        key, value = [part.strip().lower() for part in line.split(":", 1)]
        if key == "user-agent":
            if not active_agents:
                group_has_target_agent = False
            active_agents.append(value)
            if value in {"*", "googlebot", "bingbot"}:
                group_has_target_agent = True
        elif key == "disallow" and group_has_target_agent and value == "/":
            target_group_blocks_root = True

    return not target_group_blocks_root


def meta_content(soup: BeautifulSoup, *, name: str | None = None, property_name: str | None = None) -> str:
    selector = {}
    if name:
        selector["attrs"] = {"name": name}
    if property_name:
        selector["attrs"] = {"property": property_name}
    tag = soup.find("meta", **selector)
    return clean_text(tag.get("content") if tag else "")


def classify_link(text: str, href: str) -> str:
    lower_text = text.lower()
    lower_href = href.lower()
    if href.startswith("tel:"):
        return "phone"
    if "scheduletour" in lower_href or "tour" in lower_text:
        return "tour"
    if "availability" in lower_text or "floorplan" in lower_href or "floor-plan" in lower_href:
        return "availability"
    if "apply" in lower_text or "onlinelease" in lower_href:
        return "leasing"
    if "contact" in lower_text:
        return "contact"
    if any(word in lower_text for word in CTA_WORDS):
        return "other_cta"
    return "other"


def same_vanity_url(url: str, domain: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and parsed.netloc in {domain, f"www.{domain}"}


def normalize_core_url(url: str) -> str:
    parsed = urlparse(urldefrag(url)[0])
    path = parsed.path or "/"
    if not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
        path = f"{path}/"
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme}://{parsed.netloc}{path}{query}"


def is_core_page_link(text: str, absolute: str, domain: str) -> bool:
    if not same_vanity_url(absolute, domain):
        return False
    parsed = urlparse(absolute)
    path = parsed.path or "/"
    if path in {"", "/"}:
        return True
    if "." in path.rsplit("/", 1)[-1]:
        return False
    haystack = f"{text} {path}".lower()
    return any(word in haystack for word in CORE_PAGE_WORDS)


def collect_core_page_links(soup: BeautifulSoup, root_url: str, domain: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = [("Home", normalize_core_url(root_url))]
    seen = {links[0][1]}
    for anchor in soup.find_all("a"):
        href = clean_text(anchor.get("href"))
        if not href:
            continue
        text = clean_text(anchor.get_text(" ")) or clean_text(anchor.get("aria-label"))
        absolute = normalize_core_url(urljoin(root_url, href))
        if not is_core_page_link(text, absolute, domain):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        links.append((text[:120] or urlparse(absolute).path, absolute))
    return links


def check_core_pages(qa: PropertyQa, soup: BeautifulSoup, root_url: str, sess: requests.Session) -> None:
    for text, url in collect_core_page_links(soup, root_url, qa.domain):
        response = fetch(sess, url)
        if response is None:
            qa.core_pages.append(CorePageRecord(text=text, url=url, status=None, final_url="", title="", canonical="", meta_robots="", issue="fetch_failed"))
            continue
        page_soup = BeautifulSoup(response.text, "lxml")
        title = clean_text(page_soup.title.string if page_soup.title else "")
        canonical_tag = page_soup.find("link", rel=lambda value: value and "canonical" in value)
        canonical = clean_text(canonical_tag.get("href") if canonical_tag else "")
        meta_robots = meta_content(page_soup, name="robots")
        final_host = urlparse(response.url).netloc
        canonical_host = urlparse(canonical).netloc if canonical else ""
        robots_blob = f"{meta_robots} {clean_text(response.headers.get('x-robots-tag', ''))}".lower()
        issue = ""
        if response.status_code != 200:
            issue = "core_page_not_200"
        elif final_host != qa.domain:
            issue = "core_page_vanity_does_not_hold"
        elif canonical and canonical_host != qa.domain:
            issue = "core_page_canonical_not_vanity"
        elif "noindex" in robots_blob or "nofollow" in robots_blob:
            issue = "core_page_noindex_or_nofollow"
        elif not title:
            issue = "core_page_title_missing"
        qa.core_pages.append(
            CorePageRecord(
                text=text,
                url=url,
                status=response.status_code,
                final_url=response.url,
                title=title,
                canonical=canonical,
                meta_robots=meta_robots,
                issue=issue,
            )
        )


def check_page(prop: dict[str, Any], out_dir: Path, sess: requests.Session) -> PropertyQa:
    vanity_url = prop["newUrl"]["url"]
    domain = urlparse(vanity_url).netloc
    qa = PropertyQa(
        property_code=prop["propertyCode"],
        property_name=prop["propertyName"],
        domain=domain,
        current_url=prop["currentUrl"]["url"],
        vanity_url=vanity_url,
    )

    root = fetch(sess, vanity_url)
    if root is None:
        qa.issues.append("root_fetch_failed")
        return finalize(qa)

    qa.root_status = root.status_code
    qa.root_final_url = root.url
    qa.root_final_host = urlparse(root.url).netloc
    qa.x_robots = clean_text(root.headers.get("x-robots-tag", ""))

    www = fetch(sess, f"https://www.{domain}/")
    if www is not None:
        qa.www_status = www.status_code
        qa.www_final_url = www.url
    else:
        qa.issues.append("www_fetch_failed")

    soup = BeautifulSoup(root.text, "lxml")
    qa.title = clean_text(soup.title.string if soup.title else "")
    qa.meta_description = meta_content(soup, name="description")
    canonical_tag = soup.find("link", rel=lambda value: value and "canonical" in value)
    qa.canonical = clean_text(canonical_tag.get("href") if canonical_tag else "")
    qa.meta_robots = meta_content(soup, name="robots")

    visible_text = clean_text(soup.get_text(" "))
    searchable = "\n".join([qa.title, qa.meta_description, qa.canonical, visible_text])
    for pattern in PLACEHOLDER_PATTERNS:
        match = re.search(pattern, searchable, flags=re.IGNORECASE)
        if match:
            qa.placeholder_hits.append(match.group(0)[:80])

    if "kinsta.cloud" in qa.root_final_url.lower():
        qa.kinsta_leaks.append("final_url")
    if "kinsta.cloud" in qa.canonical.lower():
        qa.kinsta_leaks.append("canonical")
    if "kinsta.cloud" in visible_text.lower():
        qa.kinsta_leaks.append("visible_text")

    for anchor in soup.find_all("a"):
        href = clean_text(anchor.get("href"))
        text = clean_text(anchor.get_text(" "))
        if not href:
            continue
        absolute = urljoin(root.url, href)
        kind = classify_link(text, href)
        if href.startswith("tel:"):
            qa.tel_links += 1
        if kind != "other":
            qa.cta_links.append(LinkRecord(text=text[:120], href=absolute, kind=kind))
        if href in {"#", "/#"} or href.lower().startswith("javascript:"):
            qa.suspect_links.append(LinkRecord(text=text[:120], href=href, kind="empty_or_script"))
        if "kinsta.cloud" in href.lower():
            qa.suspect_links.append(LinkRecord(text=text[:120], href=absolute, kind="kinsta_link"))

    check_core_pages(qa, soup, root.url, sess)

    robots = fetch(sess, urljoin(vanity_url, "/robots.txt"))
    if robots is not None:
        qa.robots_txt_status = robots.status_code
        qa.robots_txt_indexable = robots.status_code == 200 and robots_allows_general_search(robots.text)
    else:
        qa.issues.append("robots_txt_fetch_failed")

    sitemap = fetch(sess, urljoin(vanity_url, "/sitemap_index.xml"))
    if sitemap is None or sitemap.status_code >= 400:
        sitemap = fetch(sess, urljoin(vanity_url, "/sitemap.xml"))
    if sitemap is not None:
        qa.sitemap_status = sitemap.status_code
    else:
        qa.issues.append("sitemap_fetch_failed")

    return finalize(qa)


def finalize(qa: PropertyQa) -> PropertyQa:
    qa.issues = list(dict.fromkeys(qa.issues))
    if qa.root_status != 200:
        qa.issues.append("root_not_200")
    if qa.root_final_host != qa.domain:
        qa.issues.append("vanity_does_not_hold_root")
    if qa.www_final_url and urlparse(qa.www_final_url).netloc != qa.domain:
        qa.issues.append("www_does_not_resolve_to_root_vanity")
    if qa.canonical and urlparse(qa.canonical).netloc != qa.domain:
        qa.issues.append("canonical_not_vanity")
    if not qa.canonical:
        qa.issues.append("canonical_missing")
    robots_blob = " ".join([qa.meta_robots, qa.x_robots]).lower()
    if "noindex" in robots_blob or "nofollow" in robots_blob:
        qa.issues.append("page_noindex_or_nofollow")
    if not qa.robots_txt_indexable:
        qa.issues.append("robots_txt_needs_review")
    if qa.sitemap_status is None or qa.sitemap_status >= 400:
        qa.issues.append("sitemap_needs_review")
    if not qa.title:
        qa.issues.append("title_missing")
    if not qa.meta_description:
        qa.issues.append("description_missing")
    if qa.placeholder_hits:
        qa.issues.append("placeholder_text_found")
    if qa.kinsta_leaks:
        qa.issues.append("kinsta_reference_found")
    if not qa.core_pages:
        qa.issues.append("core_pages_missing")
    broken_core_pages = [page for page in qa.core_pages if page.issue]
    if broken_core_pages:
        qa.issues.append("core_page_issue_found")
    cta_kinds = {link.kind for link in qa.cta_links}
    if "phone" not in cta_kinds and qa.tel_links == 0:
        qa.issues.append("phone_cta_missing")
    if not ({"tour", "availability", "leasing", "contact", "other_cta"} & cta_kinds):
        qa.issues.append("primary_cta_missing")
    qa.issues = list(dict.fromkeys(qa.issues))

    red_issues = {
        "root_fetch_failed",
        "root_not_200",
        "vanity_does_not_hold_root",
        "canonical_not_vanity",
        "page_noindex_or_nofollow",
    }
    if any(issue in red_issues for issue in qa.issues):
        qa.result = "red"
    elif qa.issues:
        qa.result = "yellow"
    else:
        qa.result = "green"
    return qa


def run_mobile_smoke(results: list[PropertyQa], screenshot_dir: Path) -> None:
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent=UA,
        )
        for qa in results:
            page = context.new_page()
            try:
                response = page.goto(qa.vanity_url, wait_until="domcontentloaded", timeout=35_000)
                page.wait_for_timeout(2500)
                qa.mobile_status = str(response.status if response else "no_response")
                qa.mobile_final_url = page.url
                qa.mobile_title = clean_text(page.title())
                screenshot_path = screenshot_dir / f"{qa.domain}.png"
                page.screenshot(path=str(screenshot_path), full_page=False)
                qa.mobile_screenshot = str(screenshot_path)
                visible = clean_text(page.locator("body").inner_text(timeout=5000))
                for pattern in PLACEHOLDER_PATTERNS:
                    match = re.search(pattern, visible, flags=re.IGNORECASE)
                    if match and match.group(0)[:80] not in qa.placeholder_hits:
                        qa.placeholder_hits.append(match.group(0)[:80])
                if qa.mobile_final_url and urlparse(qa.mobile_final_url).netloc != qa.domain:
                    qa.issues.append("mobile_vanity_does_not_hold")
            except Exception as exc:  # noqa: BLE001
                qa.mobile_status = "failed"
                qa.issues.append(f"mobile_smoke_failed:{type(exc).__name__}")
            finally:
                page.close()
                finalize(qa)
        context.close()
        browser.close()


def write_outputs(results: list[PropertyQa], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    total = len(results)
    rows = []
    for qa in results:
        rows.append(
            {
                "property_code": qa.property_code,
                "property_name": qa.property_name,
                "domain": qa.domain,
                "result": qa.result,
                "root_status": qa.root_status,
                "root_final_url": qa.root_final_url,
                "www_status": qa.www_status,
                "www_final_url": qa.www_final_url,
                "title": qa.title,
                "meta_description_present": bool(qa.meta_description),
                "canonical": qa.canonical,
                "meta_robots": qa.meta_robots,
                "x_robots": qa.x_robots,
                "robots_txt_status": qa.robots_txt_status,
                "robots_txt_indexable": qa.robots_txt_indexable,
                "sitemap_status": qa.sitemap_status,
                "tel_links": qa.tel_links,
                "cta_count": len(qa.cta_links),
                "core_page_count": len(qa.core_pages),
                "core_page_issues": ";".join(
                    f"{page.url}:{page.issue}" for page in qa.core_pages if page.issue
                ),
                "mobile_status": qa.mobile_status,
                "mobile_final_url": qa.mobile_final_url,
                "issues": ";".join(dict.fromkeys(qa.issues)),
            }
        )

    with (out_dir / "vanity-qa-results.csv").open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    payload = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "human_date": datetime.now().strftime("%m/%d/%Y"),
        "scope": "First 20 Resi Edge vanity domains",
        "mutations_performed": False,
        "summary": {
            "total": len(results),
            "green": sum(1 for r in results if r.result == "green"),
            "yellow": sum(1 for r in results if r.result == "yellow"),
            "red": sum(1 for r in results if r.result == "red"),
            "root_200": sum(1 for r in results if r.root_status == 200),
            "vanity_holds": sum(1 for r in results if r.root_final_host == r.domain),
            "canonical_vanity": sum(1 for r in results if r.canonical and urlparse(r.canonical).netloc == r.domain),
            "indexable_page": sum(
                1
                for r in results
                if "noindex" not in f"{r.meta_robots} {r.x_robots}".lower()
                and "nofollow" not in f"{r.meta_robots} {r.x_robots}".lower()
            ),
            "robots_indexable": sum(1 for r in results if r.robots_txt_indexable),
            "mobile_smoke_ok": sum(1 for r in results if r.mobile_status not in {"not_run", "failed"}),
            "core_pages_checked": sum(len(r.core_pages) for r in results),
            "core_pages_with_issues": sum(
                1 for r in results for page in r.core_pages if page.issue
            ),
            "properties_with_core_page_issues": sum(
                1 for r in results if any(page.issue for page in r.core_pages)
            ),
        },
        "results": [asdict(r) for r in results],
    }
    (out_dir / "vanity-qa-summary.json").write_text(json.dumps(payload, indent=2))

    issue_lines = []
    for qa in results:
        if qa.issues:
            issue_lines.append(
                f"- `{qa.domain}`: {qa.result.upper()} - {', '.join(dict.fromkeys(qa.issues))}"
            )
    if not issue_lines:
        issue_lines.append("- No open automated QA issues found.")

    readout = "\n".join(
        [
            "# Resi Edge Vanity QA Readout",
            "",
            f"Human date: {datetime.now().strftime('%m/%d/%Y')}",
            "",
            "## Scope",
            "",
            "- First 20 Resi Edge vanity domains.",
            "- Read-only checks: root/www routing, canonical, robots/indexability, sitemap/robots.txt, metadata, CTA signals, visible placeholder text, Kinsta leakage, and mobile render smoke screenshots.",
            "- Core vanity pages are discovered from same-domain homepage navigation and checked for 200 status, vanity-host hold, vanity canonical, title, and indexability.",
            "- Mutations performed: none.",
            "",
            "## Summary",
            "",
            f"- Total domains: `{payload['summary']['total']}`.",
            f"- Green: `{payload['summary']['green']}`.",
            f"- Yellow: `{payload['summary']['yellow']}`.",
            f"- Red: `{payload['summary']['red']}`.",
            f"- Root 200: `{payload['summary']['root_200']}/{total}`.",
            f"- Vanity holds: `{payload['summary']['vanity_holds']}/{total}`.",
            f"- Vanity canonical: `{payload['summary']['canonical_vanity']}/{total}`.",
            f"- Page indexable: `{payload['summary']['indexable_page']}/{total}`.",
            f"- Robots.txt indexable: `{payload['summary']['robots_indexable']}/{total}`.",
            f"- Mobile smoke: `{payload['summary']['mobile_smoke_ok']}/{total}`.",
            f"- Core vanity pages checked: `{payload['summary']['core_pages_checked']}`.",
            f"- Core vanity page issues: `{payload['summary']['core_pages_with_issues']}`.",
            f"- Properties with core vanity page issues: `{payload['summary']['properties_with_core_page_issues']}`.",
            "",
            "## Open Items",
            "",
            *issue_lines,
            "",
            "## Evidence",
            "",
            f"- JSON: `{out_dir / 'vanity-qa-summary.json'}`",
            f"- CSV: `{out_dir / 'vanity-qa-results.csv'}`",
            f"- Screenshots: `{out_dir / 'screenshots'}`",
        ]
    )
    (out_dir / "vanity-qa-readout.md").write_text(readout + "\n")


def main() -> int:
    snapshot = load_snapshot()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = OUT_ROOT / f"{stamp}_vanity_qa"
    sess = session()
    results: list[PropertyQa] = []
    for prop in snapshot["properties"]:
        results.append(check_page(prop, out_dir, sess))
        time.sleep(0.35)

    run_mobile_smoke(results, out_dir / "screenshots")
    write_outputs(results, out_dir)
    print(out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
