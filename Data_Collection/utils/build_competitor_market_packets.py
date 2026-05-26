#!/usr/bin/env python3
"""Build sourced competitor market research packets from governed comp sets.

This builder is intentionally conservative. It captures official-page evidence
into the manual competitor packet format, but it does not infer rent, specials,
or USP gaps when the public page does not expose usable text.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUT_DIR = ROOT / "Data_Collection" / "manual_sources" / "competitor_market_research"

SPOTLIGHT_PROPERTIES = [
    "Botanic",
    "Hammock Landing",
    "Steeplechase",
    "The Anatole",
    "Avasa 1604",
    "College View",
    "Forest View",
    "The Reserves of Thomas Glen",
    "The Retreat at Lakeland",
    "The Retreat",
    "The Metropolitan",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

SPECIAL_TERMS = (
    "special",
    "specials",
    "free",
    "discount",
    "discounted",
    "off",
    "limited time",
    "look and lease",
    "move-in",
    "move in",
    "concession",
    "credit",
)

USP_TERMS = (
    "washer",
    "dryer",
    "smart",
    "fiber",
    "internet",
    "garage",
    "attached garage",
    "pet",
    "dog park",
    "bark park",
    "pool",
    "fitness",
    "cowork",
    "business center",
    "package",
    "locker",
    "pickleball",
    "putting green",
    "balcony",
    "granite",
    "quartz",
    "stainless",
    "furnished",
    "short-term",
    "short term",
    "gated",
    "EV",
)


@dataclass
class PageEvidence:
    url: str
    ok: bool
    final_url: str | None = None
    title: str | None = None
    meta_description: str | None = None
    text: str | None = None
    status_code: int | None = None
    error: str | None = None


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def clean_text(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = " ".join(html.unescape(value).split())
    return cleaned or None


def strip_html(markup: str) -> str:
    markup = re.sub(r"(?is)<script.*?</script>", " ", markup)
    markup = re.sub(r"(?is)<style.*?</style>", " ", markup)
    markup = re.sub(r"(?is)<noscript.*?</noscript>", " ", markup)
    markup = re.sub(r"(?s)<[^>]+>", " ", markup)
    return clean_text(markup) or ""


def fetch_page(url: str) -> PageEvidence:
    try:
        response = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
    except requests.RequestException as exc:
        return PageEvidence(url=url, ok=False, error=str(exc))

    raw = response.text or ""
    title_match = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw)
    meta_match = re.search(
        r"(?is)<meta[^>]+name=[\"']description[\"'][^>]+content=[\"'](.*?)[\"']",
        raw,
    )
    text = strip_html(raw)
    title = clean_text(title_match.group(1) if title_match else None)
    meta = clean_text(meta_match.group(1) if meta_match else None)
    lower_title = (title or "").lower()
    lower_text = text.lower()
    blocked = (
        "just a moment" in lower_title
        or "checking your browser" in lower_text[:1000]
        or "enable javascript" in lower_text[:1000]
        or len(text) < 400
    )
    return PageEvidence(
        url=url,
        ok=response.ok and not blocked,
        final_url=response.url,
        title=title,
        meta_description=meta,
        text=text,
        status_code=response.status_code,
        error="blocked_or_low_text" if blocked else None,
    )


def amount_values(text: str) -> list[int]:
    values: list[int] = []
    for match in re.finditer(r"\$\s*([0-9][0-9,]{2,5})(?:\.00)?", text):
        value = int(match.group(1).replace(",", ""))
        if 700 <= value <= 6000:
            values.append(value)
    return values


def has_rent_context(text: str, url: str) -> bool:
    lower = f"{url} {text[:5000]}".lower()
    return any(term in lower for term in ("floorplan", "floor plan", "pricing", "availability", "rent", "available apartments"))


def sentence_snippets(text: str, terms: tuple[str, ...], limit: int = 5) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    found: list[str] = []
    for sentence in sentences:
        cleaned = clean_text(sentence)
        if not cleaned or len(cleaned) < 25:
            continue
        lower = cleaned.lower()
        if any(term.lower() in lower for term in terms):
            if cleaned not in found:
                found.append(cleaned[:280])
        if len(found) >= limit:
            break
    return found


def competitors_for_property(conn: sqlite3.Connection, ga4_property_id: str, property_code: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT pc.competitor_rank, c.competitor_name, c.competitor_url, pc.data_source
        FROM property_competitors pc
        JOIN competitors c ON c.competitor_id = pc.competitor_id
        WHERE pc.property_id IN (?, ?)
        ORDER BY pc.competitor_rank, c.competitor_name
        """,
        (ga4_property_id, property_code),
    ).fetchall()


def subject_observation(conn: sqlite3.Connection, identity: Any, snapshot_date: str) -> dict[str, Any] | None:
    rows = conn.execute(
        """
        SELECT rent_from, rent_to, pricing_and_specials_message
        FROM unit_availability_units
        WHERE property_id IN (?, ?)
          AND snapshot_date = (
            SELECT MAX(snapshot_date)
            FROM unit_availability_units
            WHERE property_id IN (?, ?)
          )
          AND rent_from IS NOT NULL
          AND rent_from > 0
        """,
        (identity.ga4_property_id, identity.property_code, identity.ga4_property_id, identity.property_code),
    ).fetchall()
    if not rows:
        return None
    rents = [float(row["rent_from"]) for row in rows if row["rent_from"]]
    specials = sorted({row["pricing_and_specials_message"] for row in rows if row["pricing_and_specials_message"]})
    count = len(rows)
    return {
        "competitor_name": identity.property_name,
        "competitor_url": identity.website_url,
        "source_name": "Venterra unit availability feed",
        "source_url": identity.website_url,
        "source_type": "internal_unit_feed",
        "evidence_category": "subject_position",
        "captured_date": snapshot_date,
        "floorplan_name": "Current visible availability",
        "rent_min": min(rents),
        "rent_max": max(rents),
        "availability_status": f"{count} available units in internal unit feed",
        "special_text": "; ".join(specials) if specials else None,
        "raw_claim": (
            f"The latest unit feed shows {identity.property_name} visible rents from "
            f"${min(rents):,.0f} to ${max(rents):,.0f} across {count} current available units."
        ),
        "confidence": "confirmed",
        "source_freshness_label": "captured_today",
        "evidence": {
            "db_table": "unit_availability_units",
            "db_snapshot_date": snapshot_date,
        },
    }


def competitor_observations(row: sqlite3.Row, snapshot_date: str) -> list[dict[str, Any]]:
    name = row["competitor_name"]
    url = row["competitor_url"]
    rank = row["competitor_rank"]
    if not url:
        return [
            {
                "competitor_name": name,
                "competitor_url": None,
                "source_name": "Data Pond comp set",
                "source_url": "data/portfolio_analytics.db:property_competitors",
                "source_type": "source_gap",
                "evidence_category": "source_gap",
                "captured_date": snapshot_date,
                "raw_claim": (
                    f"{name} exists in the governed comp set at rank {rank}, but the comp-set "
                    "record does not include a public competitor URL."
                ),
                "confidence": "missing",
                "source_freshness_label": "needs_source",
            }
        ]

    page = fetch_page(url)
    source_url = page.final_url or url
    if not page.ok or not page.text:
        return [
            {
                "competitor_name": name,
                "competitor_url": url,
                "source_name": f"{name} official page",
                "source_url": source_url,
                "source_type": "source_gap",
                "evidence_category": "source_gap",
                "captured_date": snapshot_date,
                "raw_claim": (
                    f"{name}'s official page could not provide usable crawlable evidence in this run "
                    f"({page.error or page.status_code or 'unknown fetch result'})."
                ),
                "confidence": "missing",
                "source_freshness_label": "needs_source",
            }
        ]

    observations: list[dict[str, Any]] = []
    values = amount_values(page.text)
    if values and has_rent_context(page.text, source_url):
        observations.append(
            {
                "competitor_name": name,
                "competitor_url": url,
                "source_name": f"{name} official page",
                "source_url": source_url,
                "source_type": "official_competitor_page",
                "evidence_category": "rent",
                "captured_date": snapshot_date,
                "rent_min": min(values),
                "rent_max": max(values),
                "availability_status": "visible_or_structured_pricing_on_public_page",
                "raw_claim": (
                    f"{name}'s official page exposes apartment-pricing context with visible dollar "
                    f"values from ${min(values):,.0f} to ${max(values):,.0f}."
                ),
                "confidence": "directional",
                "source_freshness_label": "captured_today",
            }
        )

    specials = sentence_snippets(page.text, SPECIAL_TERMS, limit=2)
    for snippet in specials:
        observations.append(
            {
                "competitor_name": name,
                "competitor_url": url,
                "source_name": f"{name} official page",
                "source_url": source_url,
                "source_type": "official_competitor_page",
                "evidence_category": "special",
                "captured_date": snapshot_date,
                "special_text": snippet,
                "raw_claim": f"{name}'s official page includes this visible offer/pricing language: {snippet}",
                "confidence": "directional",
                "source_freshness_label": "captured_today",
            }
        )

    usps = sentence_snippets(page.text, USP_TERMS, limit=4)
    if usps:
        observations.append(
            {
                "competitor_name": name,
                "competitor_url": url,
                "source_name": f"{name} official page",
                "source_url": source_url,
                "source_type": "official_competitor_page",
                "evidence_category": "usp",
                "captured_date": snapshot_date,
                "usp_text": " ".join(usps),
                "raw_claim": (
                    f"{name}'s official page provides competitor positioning evidence around: "
                    + " ".join(usps)
                ),
                "confidence": "confirmed",
                "source_freshness_label": "captured_today",
                "evidence": {
                    "title": page.title,
                    "meta_description": page.meta_description,
                },
            }
        )

    if not observations:
        observations.append(
            {
                "competitor_name": name,
                "competitor_url": url,
                "source_name": f"{name} official page",
                "source_url": source_url,
                "source_type": "source_gap",
                "evidence_category": "source_gap",
                "captured_date": snapshot_date,
                "raw_claim": (
                    f"{name}'s official page was reachable, but this run did not find conservative "
                    "rent, special, or USP evidence suitable for reporting."
                ),
                "confidence": "missing",
                "source_freshness_label": "needs_source",
            }
        )
    return observations


def build_packet(property_label: str, snapshot_date: str, conn: sqlite3.Connection) -> tuple[Path, dict[str, Any]]:
    identity = resolve_property_identity(property_label)
    if identity is None:
        raise ValueError(f"Could not resolve property identity for {property_label!r}")

    observations: list[dict[str, Any]] = []
    subject = subject_observation(conn, identity, snapshot_date)
    if subject:
        observations.append(subject)

    for row in competitors_for_property(conn, identity.ga4_property_id, identity.property_code):
        observations.extend(competitor_observations(row, snapshot_date))

    packet = {
        "snapshot_date": snapshot_date,
        "captured_at": f"{snapshot_date}T00:00:00-05:00",
        "property_id": identity.property_code,
        "property_name": identity.property_name,
        "market_name": f"{identity.city}, {identity.state}" if identity.city and identity.state else None,
        "research_scope": "watchlist_competitor_run",
        "source_author": "Codex competitor packet builder",
        "notes": (
            "Official-page competitor evidence packet. Confirmed rows can feed report copy; "
            "directional rows should be used as advisory prompts; source-gap rows should remain "
            "visible only in data integrity/source panels."
        ),
        "evidence": {
            "integrity_standard": "Do not report a rent, special, USP, or package/media claim unless source_url and captured_date are present.",
            "comp_set_basis": "Governed property_competitors records in the Data Pond.",
            "builder": "Data_Collection/utils/build_competitor_market_packets.py",
        },
        "observations": observations,
    }
    path = OUT_DIR / f"{slugify(identity.property_name)}_{snapshot_date}.json"
    path.write_text(json.dumps(packet, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return path, packet


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property", action="append", dest="properties", help="Property label to build. Repeatable.")
    parser.add_argument("--spotlight", action="store_true", help="Build packets for the 11 current Spotlight properties.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Snapshot date, YYYY-MM-DD.")
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()

    labels = list(args.properties or [])
    if args.spotlight:
        labels.extend(SPOTLIGHT_PROPERTIES)
    if not labels:
        raise SystemExit("Pass --property or --spotlight")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    try:
        results = []
        for label in labels:
            path, packet = build_packet(label, args.date, conn)
            results.append(
                {
                    "property": packet["property_name"],
                    "property_id": packet["property_id"],
                    "path": str(path),
                    "observations": len(packet["observations"]),
                }
            )
    finally:
        conn.close()

    print(json.dumps({"built_at": datetime.now().isoformat(timespec="seconds"), "results": results}, indent=2))


if __name__ == "__main__":
    main()
