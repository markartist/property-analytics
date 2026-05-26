"""
Site Audit Checks
=================
Individual audit check functions that run against a loaded Playwright page.
Each returns a list of AuditIssue objects.
"""

from __future__ import annotations

import re
from typing import List, Set
from urllib.parse import urljoin, urlparse

from playwright.async_api import Page, Response

from .models import AuditIssue

# ---------------------------------------------------------------------------
# Tour iframe URL patterns
# ---------------------------------------------------------------------------
TOUR_PATTERNS = re.compile(
    r"(matterport\.com|my\.matterport\.com|tourmkr\.com|kuula\.co|theta360\.com"
    r"|cupix\.com|cloudpano\.com|ricoh360\.com|eyespy360\.com|panoskin\.com"
    r"|vieweet\.com|3dvista\.com)",
    re.IGNORECASE,
)

# Required meta / OG tags
REQUIRED_META = [
    ("title", "title tag"),
    ("meta[name='description']", "meta description"),
    ("meta[property='og:title']", "og:title"),
    ("meta[property='og:image']", "og:image"),
]

# ---------------------------------------------------------------------------
# Shared JS: walk up the DOM to identify visual location of an element
# ---------------------------------------------------------------------------
LOCATION_JS = """
function getLocation(el) {
    const keywords = [
        ['gallery', 'Gallery'],
        ['hero', 'Hero'],
        ['banner', 'Hero Banner'],
        ['slider', 'Gallery'],
        ['carousel', 'Gallery'],
        ['slick', 'Gallery'],
        ['swiper', 'Gallery'],
        ['tour', 'Tour Section'],
        ['virtual-tour', 'Virtual Tour'],
        ['matterport', 'Virtual Tour'],
        ['unit', 'Unit Card'],
        ['floorplan', 'Floor Plan'],
        ['floor-plan', 'Floor Plan'],
        ['amenity', 'Amenities'],
        ['amenities', 'Amenities'],
        ['review', 'Reviews'],
        ['testimonial', 'Reviews'],
        ['neighborhood', 'Neighborhood'],
        ['contact', 'Contact'],
        ['footer', 'Footer'],
        ['header', 'Header / Nav'],
        ['nav', 'Header / Nav'],
        ['sidebar', 'Sidebar'],
        ['specials', 'Specials'],
        ['promo', 'Specials'],
        ['cta', 'CTA Section'],
        ['faq', 'FAQ'],
        ['map', 'Map Section'],
        ['video', 'Video Section'],
        ['feature', 'Features'],
        ['about', 'About Section'],
    ];

    let node = el;
    for (let depth = 0; depth < 12 && node && node !== document.body; depth++) {
        const id = (node.id || '').toLowerCase();
        const cls = (node.className && typeof node.className === 'string')
            ? node.className.toLowerCase() : '';
        const tag = node.tagName ? node.tagName.toLowerCase() : '';
        const role = (node.getAttribute && node.getAttribute('role') || '').toLowerCase();
        const aria = (node.getAttribute && node.getAttribute('aria-label') || '').toLowerCase();
        const blob = id + ' ' + cls + ' ' + role + ' ' + aria;

        // Check semantic HTML5 tags
        if (tag === 'header' || tag === 'nav') return 'Header / Nav';
        if (tag === 'footer') return 'Footer';
        if (tag === 'main') { node = node.parentElement; continue; }

        for (const [kw, label] of keywords) {
            if (blob.includes(kw)) return label;
        }

        // Check closest heading for context
        const heading = node.querySelector && node.querySelector('h1, h2, h3');
        if (heading) {
            const hText = (heading.textContent || '').trim().substring(0, 40);
            if (hText) {
                for (const [kw, label] of keywords) {
                    if (hText.toLowerCase().includes(kw)) return label;
                }
            }
        }

        node = node.parentElement;
    }
    return 'Page Body';
}
"""


# ---------------------------------------------------------------------------
# 1. Broken Images
# ---------------------------------------------------------------------------

async def check_broken_images(page: Page, page_url: str) -> List[AuditIssue]:
    """Find images that failed to load or have empty/missing src."""
    issues: List[AuditIssue] = []

    results = await page.evaluate("(() => {\n" + LOCATION_JS + """
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(img => ({
                src: img.src || img.getAttribute('src') || '',
                alt: img.alt || '',
                naturalWidth: img.naturalWidth,
                complete: img.complete,
                width: img.width,
                height: img.height,
                location: getLocation(img),
            }));
        })()
    """)

    for img in results:
        src = img["src"].strip()
        loc = img.get("location", "Page Body")
        # Skip tracking pixels and spacer images (1x1 or smaller)
        if img["width"] <= 1 and img["height"] <= 1:
            continue
        # Skip data URIs and SVG inline
        if src.startswith("data:") or src.startswith("blob:"):
            continue

        if not src:
            # Skip empty-src images inside map containers (Google Maps API
            # placeholders, marker icons, etc.) — these are not real content.
            if loc == "Map Section":
                continue
            issues.append(AuditIssue(
                severity="critical",
                category="broken_image",
                page_url=page_url,
                description="Image with empty or missing src",
                detail=f"alt=\"{img['alt'][:80]}\"",
                location=loc,
            ))
        elif img["complete"] and img["naturalWidth"] == 0:
            # naturalWidth=0 can be a false positive for lazy-loaded images
            # that haven't scrolled into view. Verify with an HTTP HEAD request.
            truly_broken = await _verify_url_broken(page, src)
            if truly_broken is not None:
                issues.append(AuditIssue(
                    severity="critical",
                    category="broken_image",
                    page_url=page_url,
                    description=f"Image failed to load (HTTP {truly_broken})",
                    detail=_truncate_url(src),
                    location=loc,
                ))

    return issues


# ---------------------------------------------------------------------------
# 2. Unloaded Tours
# ---------------------------------------------------------------------------

async def check_unloaded_tours(page: Page, page_url: str) -> List[AuditIssue]:
    """Detect tour iframes that failed to load."""
    issues: List[AuditIssue] = []

    iframes = await page.evaluate("(() => {\n" + LOCATION_JS + """
            const frames = Array.from(document.querySelectorAll('iframe'));
            return frames.map(f => ({
                src: f.src || f.getAttribute('src') || '',
                width: f.offsetWidth,
                height: f.offsetHeight,
                display: window.getComputedStyle(f).display,
                location: getLocation(f),
            }));
        })()
    """)

    for iframe in iframes:
        src = iframe["src"].strip()
        if not src:
            continue
        if not TOUR_PATTERNS.search(src):
            continue

        loc = iframe.get("location", "Tour Section")
        # Tour iframe found — check if it rendered
        if iframe["width"] == 0 or iframe["height"] == 0 or iframe["display"] == "none":
            issues.append(AuditIssue(
                severity="critical",
                category="unloaded_tour",
                page_url=page_url,
                description="Tour iframe present but not visible (0 dimension or hidden)",
                detail=_truncate_url(src),
                location=loc,
            ))
        else:
            # Try to verify the iframe actually loaded content
            try:
                frame_handle = None
                for frame in page.frames:
                    if frame.url and TOUR_PATTERNS.search(frame.url):
                        frame_handle = frame
                        break
                if frame_handle:
                    # A simple check: if the frame navigated to an error page
                    frame_title = await frame_handle.title()
                    if any(err in (frame_title or "").lower() for err in ["error", "not found", "404", "unavailable"]):
                        issues.append(AuditIssue(
                            severity="critical",
                            category="unloaded_tour",
                            page_url=page_url,
                            description=f"Tour iframe loaded error page: \"{frame_title}\"",
                            detail=_truncate_url(src),
                            location=loc,
                        ))
            except Exception:
                # Frame cross-origin — can't inspect, but iframe is visible so likely OK
                pass

    return issues


# ---------------------------------------------------------------------------
# 3. Console / JS Errors (collected externally, processed here)
# ---------------------------------------------------------------------------

def process_console_errors(
    errors: List[dict], page_url: str
) -> List[AuditIssue]:
    """Convert collected console errors into AuditIssues."""
    issues: List[AuditIssue] = []
    seen: Set[str] = set()

    for err in errors:
        msg = err.get("text", "")[:200]
        # Deduplicate identical messages on same page
        key = f"{page_url}|{msg}"
        if key in seen:
            continue
        seen.add(key)

        # Skip common noise: favicon, third-party analytics, cookie consent
        if _is_noise_error(msg):
            continue

        issues.append(AuditIssue(
            severity="warning",
            category="js_error",
            page_url=page_url,
            description="JavaScript error",
            detail=msg,
        ))

    return issues


def _is_noise_error(msg: str) -> bool:
    noise_patterns = [
        "favicon",
        "googletagmanager",
        "google-analytics",
        "gtag",
        "fbevents",
        "hotjar",
        "cookie",
        "consent",
        "adsbygoogle",
        "doubleclick",
        "clarity.ms",
    ]
    lower = msg.lower()
    return any(p in lower for p in noise_patterns)


# ---------------------------------------------------------------------------
# 4. Broken Links
# ---------------------------------------------------------------------------

async def check_broken_links(
    page: Page, page_url: str, base_domain: str, session_cache: dict
) -> List[AuditIssue]:
    """Check same-domain <a> links for 4xx/5xx status codes."""
    issues: List[AuditIssue] = []

    links = await page.evaluate("(() => {\n" + LOCATION_JS + """
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors.map(a => ({
                href: a.href,
                text: (a.textContent || '').trim().substring(0, 80),
                location: getLocation(a),
            }));
        })()
    """)

    checked: Set[str] = set()
    for link in links:
        href = link["href"].strip()
        if not href or href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("tel:"):
            continue

        parsed = urlparse(href)
        # Only check same-domain links
        if parsed.hostname and base_domain not in parsed.hostname:
            continue

        # Normalise and deduplicate
        normalised = f"{parsed.scheme}://{parsed.hostname}{parsed.path}"
        if normalised in checked:
            continue
        checked.add(normalised)

        # Check cache first
        if normalised in session_cache:
            status = session_cache[normalised]
        else:
            try:
                resp = await page.context.request.head(href, timeout=10_000)
                status = resp.status
                session_cache[normalised] = status
            except Exception:
                status = 0
                session_cache[normalised] = status

        if status >= 400 or status == 0:
            # HEAD returned an error — verify with GET before flagging
            confirmed = await _verify_url_broken(page, href)
            if confirmed is not None:
                severity = "critical" if confirmed in (404, 0) else "warning"
                loc = link.get("location", "Page Body")
                issues.append(AuditIssue(
                    severity=severity,
                    category="broken_link",
                    page_url=page_url,
                    description=f"Broken link (HTTP {confirmed})" if confirmed else "Broken link (connection failed)",
                    detail=f"{_truncate_url(href)} — \"{link['text'][:60]}\"",
                    location=loc,
                ))

    return issues


# ---------------------------------------------------------------------------
# 5. Missing Meta / OG Tags
# ---------------------------------------------------------------------------

async def check_missing_meta(page: Page, page_url: str) -> List[AuditIssue]:
    """Check for required meta and OG tags."""
    issues: List[AuditIssue] = []

    for selector, label in REQUIRED_META:
        if selector == "title":
            title = await page.title()
            if not title or not title.strip():
                issues.append(AuditIssue(
                    severity="warning",
                    category="missing_meta",
                    page_url=page_url,
                    description=f"Missing or empty {label}",
                ))
        else:
            value = await page.evaluate(
                f"document.querySelector(\"{selector}\")?.getAttribute('content') || ''"
            )
            if not value or not value.strip():
                issues.append(AuditIssue(
                    severity="warning",
                    category="missing_meta",
                    page_url=page_url,
                    description=f"Missing or empty {label}",
                ))

    return issues


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_url_broken(page: Page, url: str) -> int | None:
    """Verify a URL is truly broken. HEAD first, then GET fallback.
    Returns the HTTP status if truly broken, else None."""
    for attempt in range(2):
        try:
            # Try HEAD first (fast), fall back to GET (some servers reject HEAD)
            if attempt == 0:
                resp = await page.context.request.head(url, timeout=8_000)
            else:
                resp = await page.context.request.get(url, timeout=8_000)
            if resp.status < 400:
                return None  # URL is reachable
            # On first attempt 4xx, retry with GET before giving up
            if attempt == 0 and resp.status >= 400:
                continue
            return resp.status
        except Exception:
            if attempt == 0:
                continue  # Retry once
            return 0  # Connection failure on both attempts
    return None


def _truncate_url(url: str, max_len: int = 120) -> str:
    if len(url) <= max_len:
        return url
    return url[:max_len - 3] + "..."
