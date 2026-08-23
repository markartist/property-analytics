#!/usr/bin/env python3
"""Build non-mutating indexing viability evidence for the Resi Edge launch batch."""

from __future__ import annotations

import argparse
import csv
import html.parser
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


IDENTITY_PATH = ROOT / "config/property_identity_matrix.json"
PREFLIGHT_ROOT = ROOT / "reports/resi_edge_performance/phase2-preflight"
DEFAULT_REPORT_ROOT = ROOT / "reports/resi_edge_performance/indexing-viability"
LOCAL_TZ = ZoneInfo("America/Chicago")
USER_AGENT = "PropertyAnalytics-IndexingViability/1.0 (+https://venterra.com)"


@dataclass
class UrlEvidence:
    surface: str
    url: str
    checked: bool
    status: str
    http_status: int | None
    final_url: str
    title: str
    canonical: str
    meta_robots: str
    x_robots_tag: str
    has_noindex: bool
    has_nofollow: bool
    rel_nofollow_links: int
    link_count: int
    robots_txt_status: int | None
    robots_txt_blocks_googlebot: bool
    robots_txt_blocks_all: bool
    content_type: str
    error: str


class HeadParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.title_parts: list[str] = []
        self.canonical = ""
        self.meta_robots: list[str] = []
        self.link_count = 0
        self.rel_nofollow_links = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {name.lower(): (value or "") for name, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
            return
        if tag == "link":
            rel = attr.get("rel", "").lower()
            if "canonical" in rel.split():
                self.canonical = attr.get("href", "").strip()
            if "nofollow" in rel.split():
                self.rel_nofollow_links += 1
            self.link_count += 1
            return
        if tag == "a":
            rel = attr.get("rel", "").lower()
            if "nofollow" in rel.split():
                self.rel_nofollow_links += 1
            self.link_count += 1
            return
        if tag == "meta":
            name = attr.get("name", "").lower()
            if name in {"robots", "googlebot"}:
                self.meta_robots.append(attr.get("content", "").strip())

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.title_parts)).strip()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def latest_preflight_csv() -> Path:
    matches = sorted(PREFLIGHT_ROOT.glob("*/phase-preflight.csv"))
    if not matches:
        raise FileNotFoundError(f"No phase-preflight.csv found under {PREFLIGHT_ROOT}")
    return matches[-1]


def current_url_from_name(name: str) -> str:
    slug = name.lower().replace("&", "and").replace("'", "").replace(".", "").replace(",", "")
    slug = "-".join(part for part in slug.split() if part)
    return f"https://venterraliving.com/apartments/{slug}/"


def load_identities() -> dict[str, dict[str, Any]]:
    payload = read_json(IDENTITY_PATH)
    return {
        str(row.get("property_code") or row.get("canonical_property_id")): row
        for row in payload.get("properties", [])
        if row.get("property_code") or row.get("canonical_property_id")
    }


def load_preflight_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return [{key: (value or "").strip() for key, value in row.items()} for row in csv.DictReader(handle)]


def request_url(url: str, timeout: int) -> tuple[int | None, str, dict[str, str], bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = {key.lower(): value for key, value in resp.headers.items()}
            return resp.status, resp.geturl(), headers, resp.read(2_000_000), ""
    except urllib.error.HTTPError as exc:
        headers = {key.lower(): value for key, value in exc.headers.items()}
        body = exc.read(300_000)
        return exc.code, exc.geturl(), headers, body, ""
    except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError) as exc:
        return None, url, {}, b"", str(exc)


def fetch_text(url: str, timeout: int) -> tuple[int | None, str]:
    status, _final_url, _headers, body, error = request_url(url, timeout)
    if error:
        return status, ""
    return status, body.decode("utf-8", errors="replace")


def robots_txt_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/robots.txt"


def robots_blocks(robots_text: str, agent: str) -> bool:
    active = False
    matched = False
    for raw_line in robots_text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = [part.strip() for part in line.split(":", 1)]
        key = key.lower()
        if key == "user-agent":
            active = value.lower() in {agent.lower(), "*"}
            matched = active
            continue
        if active and key == "disallow" and value.strip() == "/":
            return True
        if matched and key == "user-agent":
            active = False
    return False


def inspect_url(surface: str, url: str, timeout: int, checked: bool = True, status_override: str = "") -> UrlEvidence:
    if not checked:
        return UrlEvidence(
            surface=surface,
            url=url,
            checked=False,
            status=status_override or "held",
            http_status=None,
            final_url="",
            title="",
            canonical="",
            meta_robots="",
            x_robots_tag="",
            has_noindex=False,
            has_nofollow=False,
            rel_nofollow_links=0,
            link_count=0,
            robots_txt_status=None,
            robots_txt_blocks_googlebot=False,
            robots_txt_blocks_all=False,
            content_type="",
            error="",
        )

    http_status, final_url, headers, body, error = request_url(url, timeout)
    parser = HeadParser()
    content_type = headers.get("content-type", "")
    if body and "html" in content_type.lower():
        parser.feed(body[:1_000_000].decode("utf-8", errors="replace"))
    x_robots = headers.get("x-robots-tag", "")
    robots_text = " ".join([x_robots, *parser.meta_robots]).lower()
    robots_status, robots_body = fetch_text(robots_txt_url(url), timeout)
    blocks_googlebot = robots_blocks(robots_body, "googlebot") if robots_body else False
    blocks_all = robots_blocks(robots_body, "*") if robots_body else False
    has_noindex = "noindex" in robots_text
    has_nofollow = "nofollow" in robots_text or parser.rel_nofollow_links > 0
    status = "pass"
    if error:
        status = "fetch_failed"
    elif http_status and http_status >= 400:
        status = "http_not_ok"
    elif has_noindex or blocks_googlebot or blocks_all:
        status = "blocked_indexing"
    elif has_nofollow:
        status = "nofollow_present"

    return UrlEvidence(
        surface=surface,
        url=url,
        checked=True,
        status=status,
        http_status=http_status,
        final_url=final_url,
        title=parser.title,
        canonical=parser.canonical,
        meta_robots="; ".join(parser.meta_robots),
        x_robots_tag=x_robots,
        has_noindex=has_noindex,
        has_nofollow=has_nofollow,
        rel_nofollow_links=parser.rel_nofollow_links,
        link_count=parser.link_count,
        robots_txt_status=robots_status,
        robots_txt_blocks_googlebot=blocks_googlebot,
        robots_txt_blocks_all=blocks_all,
        content_type=content_type,
        error=error,
    )


def host_without_www(value: str) -> str:
    host = urllib.parse.urlparse(value).netloc.lower() if "://" in value else value.lower()
    return host[4:] if host.startswith("www.") else host


def canonical_status(evidence: UrlEvidence, expected_host: str) -> str:
    if not evidence.checked:
        return "held"
    if not evidence.canonical:
        return "missing"
    host = host_without_www(evidence.canonical)
    expected = host_without_www(expected_host)
    return "matches_expected_host" if host == expected else "points_elsewhere"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Resi Edge indexing viability packet.")
    parser.add_argument("--preflight-csv", type=Path, default=latest_preflight_csv())
    parser.add_argument("--include-final-vanity", action="store_true", help="Check final vanity URLs. Default holds them until switch.")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--spacing-seconds", type=float, default=0.15)
    args = parser.parse_args()

    rows = load_preflight_rows(args.preflight_csv)
    identities = load_identities()
    generated_at = datetime.now(timezone.utc)
    run_id = generated_at.strftime("%Y%m%d_%H%M%S_indexing_viability")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    out_rows: list[dict[str, Any]] = []
    for row in rows:
        code = row.get("property_code", "")
        identity = identities.get(code, {})
        property_name = row.get("canonical_name") or row.get("property_name") or code
        current_url = identity.get("gsc_url") or identity.get("website_url") or current_url_from_name(property_name)
        staging_url = row.get("staging_kinsta_url", "")
        vanity_domain = row.get("vanity_domain", "").lower()
        final_url = f"https://{vanity_domain}/" if vanity_domain else ""

        surfaces = [
            inspect_url("legacy_current", current_url, args.timeout),
            inspect_url("kinsta_staging", staging_url, args.timeout) if staging_url else inspect_url("kinsta_staging", "", args.timeout, False, "missing_url"),
            inspect_url("final_vanity", final_url, args.timeout) if args.include_final_vanity and final_url else inspect_url("final_vanity", final_url, args.timeout, False, "held_until_switch"),
        ]
        for evidence in surfaces:
            expected_host = vanity_domain
            if evidence.surface in {"legacy_current", "kinsta_staging"}:
                expected_host = urllib.parse.urlparse(evidence.url).netloc
            out_rows.append(
                {
                    "property_code": code,
                    "property_name": property_name,
                    "vanity_domain": vanity_domain,
                    "surface": evidence.surface,
                    **asdict(evidence),
                    "canonical_status": canonical_status(evidence, expected_host),
                    "canonical_matches_vanity": canonical_status(evidence, vanity_domain) == "matches_expected_host",
                }
            )
            time.sleep(args.spacing_seconds)

    status_counts = Counter(item["status"] for item in out_rows)
    checked_rows = [item for item in out_rows if item["checked"]]
    blocking_rows = [
        item
        for item in checked_rows
        if item["status"] in {"fetch_failed", "http_not_ok", "blocked_indexing"}
        or (item["surface"] == "final_vanity" and item["canonical_status"] == "points_elsewhere")
    ]
    summary = {
        "run_type": "resi_edge_indexing_viability",
        "generated_at_utc": generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_at_human": generated_at.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z"),
        "mutations_performed": False,
        "preflight_csv": str(args.preflight_csv),
        "include_final_vanity": args.include_final_vanity,
        "properties": len(rows),
        "url_rows": len(out_rows),
        "checked_url_rows": len(checked_rows),
        "held_url_rows": sum(1 for item in out_rows if not item["checked"]),
        "status_counts": dict(status_counts),
        "canonical_points_elsewhere": sum(1 for item in checked_rows if item["canonical_status"] == "points_elsewhere"),
        "canonical_matches_checked_host": sum(1 for item in checked_rows if item["canonical_status"] == "matches_expected_host"),
        "canonical_matches_vanity": sum(1 for item in checked_rows if item["canonical_matches_vanity"]),
        "has_noindex": sum(1 for item in checked_rows if item["has_noindex"]),
        "has_nofollow": sum(1 for item in checked_rows if item["has_nofollow"]),
        "robots_txt_blocks_googlebot": sum(1 for item in checked_rows if item["robots_txt_blocks_googlebot"]),
        "robots_txt_blocks_all": sum(1 for item in checked_rows if item["robots_txt_blocks_all"]),
        "blocking_or_review_rows": len(blocking_rows),
    }

    write_json(output_dir / "summary.json", summary)
    write_json(output_dir / "indexing-viability.json", {"summary": summary, "rows": out_rows})
    with (output_dir / "indexing-viability.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(out_rows[0].keys()) if out_rows else []
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)
    with (output_dir / "review-rows.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(out_rows[0].keys()) if out_rows else []
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(blocking_rows)
    readout_lines = [
        "# Resi Edge Indexing Viability",
        "",
        f"Generated: {summary['generated_at_human']}",
        f"Properties: {summary['properties']}",
        f"Checked URL rows: {summary['checked_url_rows']}",
        f"Held URL rows: {summary['held_url_rows']}",
        f"Noindex rows: {summary['has_noindex']}",
        f"Nofollow rows: {summary['has_nofollow']}",
        f"Canonical points elsewhere: {summary['canonical_points_elsewhere']}",
        f"Robots.txt blocks Googlebot: {summary['robots_txt_blocks_googlebot']}",
        f"Rows needing review: {summary['blocking_or_review_rows']}",
        "",
        "This packet is read-only. It does not mutate Cloudflare, DNS, Workers, WordPress, Kinsta, GA4, Ahrefs, GSC, Zaraz, R2, or cache.",
    ]
    (output_dir / "INDEXING_VIABILITY_READOUT.md").write_text("\n".join(readout_lines) + "\n", encoding="utf-8")
    latest = DEFAULT_REPORT_ROOT / "latest.json"
    latest.parent.mkdir(parents=True, exist_ok=True)
    write_json(latest, {"latest_packet": str(output_dir), "summary": summary})
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
