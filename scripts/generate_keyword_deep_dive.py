#!/usr/bin/env python3
"""
Generate a deep keyword and competitor brief for selected properties.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

import requests

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
REGISTRY_PATH = ROOT / "config" / "venterra_properties_official.json"
REPORT_DIR = ROOT / "reports" / "search_intelligence"
SEMRUSH_URL = "https://api.semrush.com/"

import sys

sys.path.insert(0, str(ROOT))
from utils.ksm import resolve_secret_from_multiple_notations  # noqa: E402


STOPWORDS = {
    "apartments",
    "apartment",
    "the",
    "at",
    "and",
    "for",
    "rent",
    "luxury",
    "homes",
    "home",
    "living",
    "fl",
    "orlando",
    "kissimmee",
    "near",
}

PROPERTY_COMPETITOR_SHORTLISTS = {
    "378405224": [
        "Astoria At Celebration",
        "Aventon Opal",
        "Bainbridge World Center",
        "Dream Kissimmee",
        "Integra Sunrise Parc",
        "Tapestry Headwaters",
    ],
    "383898543": [
        "Addison at Universal Boulevard",
        "Corban Freedom",
        "V by Alta",
        "Altis Grand Lake Willis",
        "The Courtney at Universal",
        "Town Vineland",
        "Triton Cay",
    ],
}


@dataclass
class KeywordRow:
    keyword: str
    position: int
    search_volume: int
    cpc: float
    url: str
    traffic_pct: float
    traffic_cost_pct: float
    competition: float
    results_count: int


@dataclass
class CompetitorSpec:
    name: str
    url: str
    domain: str
    path: str


@dataclass
class PropertySpec:
    name: str
    property_id: str
    full_url: str
    domain: str
    path: str


def load_registry() -> dict:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def extract_domain_and_path(full_url: str) -> Tuple[str, str]:
    parsed = urlparse(full_url)
    domain = parsed.netloc.lower()
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    return domain, path


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def get_semrush_key() -> str:
    return resolve_secret_from_multiple_notations(
        description="SEMRush API key",
        notation_env_vars=[
            "KSM_SEMRUSH_API_KEY_NOTATION",
            "KSM_SEMRUSH_API_KEY_FILE_NOTATION",
        ],
        direct_env_var="SEMRUSH_API_KEY",
        file_path=ROOT / "Spotlight_Properties_Report" / "config" / "semrush_api_key.txt",
        default_profile="data-collection-prod",
    )


def resolve_property(name: str, registry: dict) -> PropertySpec:
    for item in registry.get("properties", []):
        if item.get("name", "").lower() == name.lower():
            full_url = item.get("full_url") or item.get("url")
            if not full_url:
                raise ValueError(f"Property {name} is missing full_url in registry")
            domain, path = extract_domain_and_path(full_url)
            return PropertySpec(
                name=item["name"],
                property_id=item["ga4_property_id"],
                full_url=full_url,
                domain=domain,
                path=path,
            )
    raise ValueError(f"Property not found in registry: {name}")


def fetch_semrush_keywords(api_key: str, domain: str, path: str, limit: int = 100) -> List[KeywordRow]:
    params = {
        "type": "domain_organic",
        "key": api_key,
        "display_limit": limit,
        "export_columns": "Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Nr",
        "domain": domain,
        "display_filter": f"+|Ur|Co|{path}",
        "database": "us",
    }
    response = requests.get(SEMRUSH_URL, params=params, timeout=30)
    response.raise_for_status()

    lines = [line for line in response.text.splitlines() if line.strip()]
    if not lines or lines[0].startswith("ERROR"):
        return []

    rows: List[KeywordRow] = []
    for line in lines[1:]:
        fields = line.split(";")
        if len(fields) < 9:
            continue
        try:
            rows.append(
                KeywordRow(
                    keyword=fields[0],
                    position=int(float(fields[1])) if fields[1] else 0,
                    search_volume=int(float(fields[2])) if fields[2] else 0,
                    cpc=float(fields[3]) if fields[3] else 0.0,
                    url=fields[4],
                    traffic_pct=float(fields[5]) if fields[5] else 0.0,
                    traffic_cost_pct=float(fields[6]) if fields[6] else 0.0,
                    competition=float(fields[7]) if fields[7] else 0.0,
                    results_count=int(float(fields[8])) if fields[8] else 0,
                )
            )
        except ValueError:
            continue
    return rows


def load_competitor_shortlist(conn: sqlite3.Connection, property_id: str) -> List[CompetitorSpec]:
    shortlist = PROPERTY_COMPETITOR_SHORTLISTS.get(property_id, [])
    if not shortlist:
        return []

    placeholders = ",".join("?" for _ in shortlist)
    rows = conn.execute(
        f"""
        SELECT c.competitor_name, c.competitor_url
        FROM property_competitors pc
        JOIN competitors c ON c.competitor_id = pc.competitor_id
        WHERE pc.property_id = ?
          AND c.competitor_name IN ({placeholders})
          AND c.competitor_url IS NOT NULL
        ORDER BY pc.competitor_rank ASC
        """,
        [property_id, *shortlist],
    ).fetchall()

    specs: List[CompetitorSpec] = []
    seen = set()
    for row in rows:
        url = row["competitor_url"]
        domain, path = extract_domain_and_path(url)
        key = (row["competitor_name"], domain, path)
        if key in seen:
            continue
        seen.add(key)
        specs.append(
            CompetitorSpec(
                name=row["competitor_name"],
                url=url,
                domain=domain,
                path=path,
            )
        )
    return specs


def aggregate_gsc_queries(conn: sqlite3.Connection, property_id: str, start_date: str) -> List[dict]:
    rows = conn.execute(
        """
        SELECT
          query,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          ROUND(SUM(clicks) * 1.0 / NULLIF(SUM(impressions), 0), 4) AS ctr,
          ROUND(AVG(average_position), 2) AS average_position
        FROM gsc_queries
        WHERE property_id = ?
          AND metric_date >= ?
        GROUP BY query
        ORDER BY clicks DESC, impressions DESC
        LIMIT 25
        """,
        (property_id, start_date),
    ).fetchall()
    return [dict(row) for row in rows]


def aggregate_ads_keywords(conn: sqlite3.Connection, property_id: str) -> List[dict]:
    rows = conn.execute(
        """
        SELECT
          keyword_text,
          match_type,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          ROUND(SUM(cost_micros) / 1000000.0, 2) AS cost,
          ROUND(SUM(conversions), 2) AS conversions
        FROM google_ads_keywords
        WHERE property_id = ?
        GROUP BY keyword_text, match_type
        ORDER BY cost DESC, clicks DESC
        LIMIT 20
        """,
        (property_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def latest_local_semrush(conn: sqlite3.Connection, property_id: str) -> Tuple[Optional[str], List[dict]]:
    latest = conn.execute(
        "SELECT MAX(metric_date) AS latest FROM semrush_keyword_rankings WHERE property_id = ?",
        (property_id,),
    ).fetchone()["latest"]
    if not latest:
        return None, []

    rows = conn.execute(
        """
        SELECT keyword, position, search_volume, traffic_percent, keyword_type
        FROM semrush_keyword_rankings
        WHERE property_id = ?
          AND metric_date = ?
        ORDER BY traffic_percent DESC, search_volume DESC
        LIMIT 25
        """,
        (property_id, latest),
    ).fetchall()
    return latest, [dict(row) for row in rows]


def tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) >= 3 and token not in STOPWORDS
    }


def is_branded(keyword: str, brand_tokens: set[str]) -> bool:
    kw_tokens = tokenize(keyword)
    if not kw_tokens:
        return False
    return bool(kw_tokens & brand_tokens)


def is_noise_keyword(keyword: str) -> bool:
    lowered = keyword.lower()
    if re.search(r"\b\d{3,}\b", lowered):
        return True
    if any(
        phrase in lowered
        for phrase in (
            "reviews",
            "photos",
            "address",
        )
    ):
        return True
    return False


def keyword_map(rows: Sequence[KeywordRow]) -> Dict[str, KeywordRow]:
    out: Dict[str, KeywordRow] = {}
    for row in rows:
        key = row.keyword.lower()
        if key not in out or row.position < out[key].position:
            out[key] = row
    return out


def summarize_mix(rows: Sequence[KeywordRow], brand_tokens: set[str]) -> dict:
    brand_rows = [row for row in rows if is_branded(row.keyword, brand_tokens)]
    generic_rows = [row for row in rows if not is_branded(row.keyword, brand_tokens)]

    def pack(items: Sequence[KeywordRow]) -> dict:
        return {
            "keywords": len(items),
            "total_volume": sum(item.search_volume for item in items),
            "top10": sum(1 for item in items if 0 < item.position <= 10),
            "traffic_pct": round(sum(item.traffic_pct for item in items), 2),
        }

    return {"brand": pack(brand_rows), "generic": pack(generic_rows)}


def build_gap_table(
    property_rows: Sequence[KeywordRow],
    competitor_rows: Dict[str, Sequence[KeywordRow]],
    property_brand_tokens: set[str],
    competitor_brand_tokens: Dict[str, set[str]],
) -> List[dict]:
    property_lookup = keyword_map(property_rows)
    aggregate: Dict[str, dict] = {}
    all_competitor_brand_tokens = set().union(*competitor_brand_tokens.values()) if competitor_brand_tokens else set()

    for competitor_name, rows in competitor_rows.items():
        brand_tokens = competitor_brand_tokens[competitor_name]
        for row in rows:
            keyword = row.keyword.lower()
            if (
                is_branded(keyword, property_brand_tokens)
                or is_branded(keyword, brand_tokens)
                or is_branded(keyword, all_competitor_brand_tokens)
                or is_noise_keyword(keyword)
            ):
                continue
            if row.search_volume < 50 or row.position <= 0 or row.position > 20:
                continue

            property_row = property_lookup.get(keyword)
            if property_row and 0 < property_row.position <= 10:
                continue

            record = aggregate.setdefault(
                keyword,
                {
                    "keyword": row.keyword,
                    "search_volume": row.search_volume,
                    "best_competitor_position": row.position,
                    "property_position": property_row.position if property_row else None,
                    "competitors": set(),
                    "score": 0,
                },
            )
            record["competitors"].add(competitor_name)
            record["best_competitor_position"] = min(record["best_competitor_position"], row.position)
            if property_row:
                record["property_position"] = property_row.position
            record["score"] += max(1, 21 - row.position) * max(1, row.search_volume // 50)

    ranked = sorted(
        aggregate.values(),
        key=lambda item: (
            item["score"],
            len(item["competitors"]),
            item["search_volume"],
        ),
        reverse=True,
    )
    for item in ranked:
        item["competitors"] = sorted(item["competitors"])
    return ranked[:12]


def weak_keywords(
    property_rows: Sequence[KeywordRow],
    property_brand_tokens: set[str],
) -> List[KeywordRow]:
    items = [
        row
        for row in property_rows
        if not is_branded(row.keyword, property_brand_tokens)
        and not is_noise_keyword(row.keyword)
        and 11 <= row.position <= 40
        and row.search_volume >= 70
    ]
    return sorted(items, key=lambda row: (row.search_volume, -row.position), reverse=True)[:10]


def top_generic_keywords(rows: Sequence[KeywordRow], brand_tokens: set[str]) -> List[KeywordRow]:
    items = [
        row
        for row in rows
        if not is_branded(row.keyword, brand_tokens)
        and not is_noise_keyword(row.keyword)
    ]
    return sorted(items, key=lambda row: (row.traffic_pct, row.search_volume), reverse=True)[:10]


def classify_ads_issues(rows: Sequence[dict], property_name: str) -> List[str]:
    if not rows:
        return ["No keyword-level Google Ads rows are present in the local warehouse for this property."]

    property_tokens = tokenize(property_name)
    issues = []
    foreign_brand_cost = 0.0
    foreign_brand_terms: List[str] = []
    for row in rows:
        keyword_text = row["keyword_text"].lower()
        kw_tokens = tokenize(keyword_text)
        explicit_foreign_brand = any(
            phrase in keyword_text
            for phrase in (
                "tapestry ",
                "grandewood",
                "lucent",
                "burano",
                "camden",
                "addison",
                "alta ",
            )
        )
        if explicit_foreign_brand and not (kw_tokens & property_tokens and "headwaters" in kw_tokens):
            foreign_brand_cost += row["cost"] or 0.0
            foreign_brand_terms.append(row["keyword_text"])
        elif "tapestry headwaters" in keyword_text:
            foreign_brand_cost += row["cost"] or 0.0
            foreign_brand_terms.append(row["keyword_text"])

    if foreign_brand_terms:
        issues.append(
            f"Spend is landing on likely non-current or competitor-brand terms such as {', '.join(sorted(set(foreign_brand_terms[:4])))} "
            f"(${foreign_brand_cost:,.2f} in the visible keyword rows)."
        )
    else:
        issues.append("Paid terms are not obviously leaking into competitor-brand or legacy-brand keywords in the visible keyword rows.")
    return issues


def market_head_terms(
    property_rows: Sequence[KeywordRow],
    competitor_rows: Dict[str, Sequence[KeywordRow]],
    property_brand_tokens: set[str],
    competitor_brand_tokens: Dict[str, set[str]],
) -> List[Tuple[str, int, int]]:
    counts: Counter[str] = Counter()
    best_pos: Dict[str, int] = {}
    all_competitor_brand_tokens = set().union(*competitor_brand_tokens.values()) if competitor_brand_tokens else set()
    for competitor_name, rows in competitor_rows.items():
        brand_tokens = competitor_brand_tokens[competitor_name]
        for row in rows:
            if row.search_volume < 90:
                continue
            if (
                is_branded(row.keyword, property_brand_tokens)
                or is_branded(row.keyword, brand_tokens)
                or is_branded(row.keyword, all_competitor_brand_tokens)
                or is_noise_keyword(row.keyword)
            ):
                continue
            counts[row.keyword] += 1
            best_pos[row.keyword] = min(best_pos.get(row.keyword, 999), row.position)
    ranked = sorted(counts.items(), key=lambda item: (item[1], best_pos[item[0]] * -1), reverse=True)
    out = []
    property_lookup = keyword_map(property_rows)
    for keyword, overlap in ranked[:12]:
        out.append((keyword, overlap, property_lookup[keyword].position if keyword in property_lookup else 0))
    return out


def render_keyword_table(rows: Iterable[KeywordRow]) -> str:
    lines = ["| Keyword | Pos | Volume | Traffic % |", "| --- | ---: | ---: | ---: |"]
    for row in rows:
        lines.append(f"| {row.keyword} | {row.position} | {row.search_volume} | {row.traffic_pct:.2f} |")
    return "\n".join(lines)


def render_gap_table(rows: Sequence[dict]) -> str:
    lines = [
        "| Keyword | Volume | Best Comp Pos | Our Pos | Competitors |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        property_pos = row["property_position"] if row["property_position"] is not None else "NR"
        competitors = ", ".join(row["competitors"][:3])
        lines.append(
            f"| {row['keyword']} | {row['search_volume']} | {row['best_competitor_position']} | {property_pos} | {competitors} |"
        )
    return "\n".join(lines)


def render_simple_table(rows: Sequence[dict], columns: Sequence[Tuple[str, str]]) -> str:
    headers = [label for _, label in columns]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" if i == 0 else "---:" for i in range(len(columns))) + " |",
    ]
    for row in rows:
        values = []
        for key, _ in columns:
            value = row.get(key)
            if isinstance(value, float):
                values.append(f"{value:.2f}")
            else:
                values.append(str(value))
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def build_property_section(
    property_spec: PropertySpec,
    local_semrush_date: Optional[str],
    local_semrush_rows: Sequence[dict],
    gsc_rows: Sequence[dict],
    ads_rows: Sequence[dict],
    live_property_rows: Sequence[KeywordRow],
    competitor_rows: Dict[str, Sequence[KeywordRow]],
) -> str:
    property_brand_tokens = tokenize(property_spec.name)
    mix = summarize_mix(live_property_rows, property_brand_tokens)
    competitor_brand_tokens = {name: tokenize(name) for name in competitor_rows}
    gaps = build_gap_table(live_property_rows, competitor_rows, property_brand_tokens, competitor_brand_tokens)
    weak = weak_keywords(live_property_rows, property_brand_tokens)
    generic_leaders = top_generic_keywords(live_property_rows, property_brand_tokens)
    head_terms = market_head_terms(live_property_rows, competitor_rows, property_brand_tokens, competitor_brand_tokens)
    ads_issues = classify_ads_issues(ads_rows, property_spec.name)

    competitor_lines = "\n".join(
        f"- `{name}`: {rows[0].keyword if rows else 'No live keywords returned'}"
        for name, rows in competitor_rows.items()
    )
    if not competitor_lines:
        competitor_lines = "- No competitor live keyword sets were returned."

    gsc_table = render_simple_table(
        gsc_rows[:10],
        [
            ("query", "Query"),
            ("clicks", "Clicks"),
            ("impressions", "Impr."),
            ("ctr", "CTR"),
            ("average_position", "Avg Pos"),
        ],
    ) if gsc_rows else "_No recent GSC query rows found._"

    ads_table = render_simple_table(
        ads_rows[:10],
        [
            ("keyword_text", "Keyword"),
            ("match_type", "Match"),
            ("clicks", "Clicks"),
            ("impressions", "Impr."),
            ("cost", "Cost"),
            ("conversions", "Conv."),
        ],
    ) if ads_rows else "_No keyword-level Google Ads rows found._"

    head_term_lines = "\n".join(
        f"- `{keyword}` appears across `{overlap}` competitor sets; current property position: `{position if position else 'NR'}`"
        for keyword, overlap, position in head_terms[:8]
    ) or "- No shared market head terms were identified from the live competitor pulls."

    recommendation_lines = []
    if gaps:
        recommendation_lines.append(
            f"Build or strengthen landing-page relevance around `{gaps[0]['keyword']}` and the other top generic gaps where competitors already rank on page one."
        )
    if weak:
        recommendation_lines.append(
            f"Prioritize page and on-page improvements for `{weak[0].keyword}`-style queries where the property already ranks but is stuck in positions `{weak[0].position}` and beyond."
        )
    recommendation_lines.extend(ads_issues)

    return f"""## {property_spec.name}

**Property URL:** {property_spec.full_url}
**Live SEMrush pull date:** {date.today().isoformat()}
**Local SEMrush keyword snapshot:** {local_semrush_date or 'none'}

### Executive Read

- Brand demand dominates this property's current keyword footprint.
- Live SEMrush mix: `{mix['brand']['keywords']}` brand keywords vs `{mix['generic']['keywords']}` generic keywords.
- Estimated traffic share from live SEMrush: `{mix['brand']['traffic_pct']:.2f}%` brand vs `{mix['generic']['traffic_pct']:.2f}%` generic.
- The clearest growth path is non-brand apartment-intent visibility, not more brand defense.

### Current Keyword Leaders

#### Top generic live SEMrush keywords
{render_keyword_table(generic_leaders) if generic_leaders else '_No generic live keywords returned._'}

#### Top local GSC queries, last 30 days
{gsc_table}

#### Local SEMrush warehouse leaders
{render_simple_table(
    local_semrush_rows[:10],
    [
        ("keyword", "Keyword"),
        ("position", "Pos"),
        ("search_volume", "Volume"),
        ("traffic_percent", "Traffic %"),
        ("keyword_type", "Type"),
    ],
) if local_semrush_rows else '_No local SEMrush keyword rows found._'}

### Competitor Set Used

{competitor_lines}

### Competitor Keyword Gaps

{render_gap_table(gaps) if gaps else '_No strong non-brand gaps were identified from the live competitor pulls._'}

### Weak-but-Winnable Terms

{render_keyword_table(weak) if weak else '_No page-two or page-three non-brand terms met the threshold._'}

### Market Head Terms Competitors Are Winning

{head_term_lines}

### Paid Search Alignment

{ads_table}

### Recommendation Stack

""" + "\n".join(f"- {line}" for line in recommendation_lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a keyword deep dive for selected properties.")
    parser.add_argument(
        "--properties",
        nargs="+",
        default=["Cane Island", "Luma Headwaters"],
        help="Property names from the registry",
    )
    args = parser.parse_args()

    registry = load_registry()
    semrush_key = get_semrush_key()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    sections: List[str] = []
    payload = {"generated_at": date.today().isoformat(), "properties": []}

    try:
        for property_name in args.properties:
            spec = resolve_property(property_name, registry)
            local_semrush_date, local_semrush_rows = latest_local_semrush(conn, spec.property_id)
            gsc_rows = aggregate_gsc_queries(conn, spec.property_id, "2026-03-15")
            ads_rows = aggregate_ads_keywords(conn, spec.property_id)

            live_property_rows = fetch_semrush_keywords(semrush_key, spec.domain, spec.path)

            competitor_specs = load_competitor_shortlist(conn, spec.property_id)
            live_competitors: Dict[str, List[KeywordRow]] = {}
            for competitor in competitor_specs:
                rows = fetch_semrush_keywords(semrush_key, competitor.domain, competitor.path)
                if rows:
                    live_competitors[competitor.name] = rows

            section = build_property_section(
                spec,
                local_semrush_date,
                local_semrush_rows,
                gsc_rows,
                ads_rows,
                live_property_rows,
                live_competitors,
            )
            sections.append(section)
            payload["properties"].append(
                {
                    "name": spec.name,
                    "property_id": spec.property_id,
                    "local_semrush_date": local_semrush_date,
                    "gsc_rows": gsc_rows,
                    "ads_rows": ads_rows,
                    "live_keyword_count": len(live_property_rows),
                    "competitors_used": list(live_competitors.keys()),
                }
            )
    finally:
        conn.close()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    base_name = f"{date.today().isoformat()}__cane-island__luma-headwaters__keyword-deep-dive"
    report_path = REPORT_DIR / f"{base_name}.md"
    payload_path = REPORT_DIR / f"{base_name}.json"

    report = f"""# Cane Island + Luma Headwaters Search Intelligence Deep Dive

Generated: {date.today().isoformat()}

## What This Brief Uses

- Live SEMrush `domain_organic` pulls for each property page
- Live SEMrush `domain_organic` pulls for selected local competitors
- Local `semrush_keyword_rankings`
- Local `gsc_queries` for the last 30 days
- Local `google_ads_keywords`

## Portfolio-Level Read

- Both properties are currently much stronger on brand capture than non-brand apartment-intent visibility.
- `Cane Island` has almost no paid-keyword history in the local warehouse, so SEO and live SEMrush carry most of the diagnostic weight there.
- `Luma Headwaters` has both SEO and paid-keyword signal, and the paid layer shows likely campaign naming drift or legacy-brand leakage that deserves cleanup.

{chr(10).join(sections)}
"""

    report_path.write_text(report, encoding="utf-8")
    payload_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"REPORT: {report_path}")
    print(f"PAYLOAD: {payload_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
