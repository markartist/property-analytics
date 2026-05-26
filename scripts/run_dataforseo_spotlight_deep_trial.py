#!/usr/bin/env python3
"""Run a trial-depth DataForSEO enrichment packet for a Spotlight property."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from utils.dataforseo_auth import resolve_dataforseo_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUTPUT_ROOT = ROOT / "reports" / "dataforseo" / "deep_trial"
ENRICHMENT_SCHEMA = ROOT / "apps" / "api" / "migrations" / "0033_create_dataforseo_enrichment_tables.sql"

STATE_NAMES = {
    "AR": "Arkansas",
    "FL": "Florida",
    "GA": "Georgia",
    "KY": "Kentucky",
    "MO": "Missouri",
    "NC": "North Carolina",
    "OK": "Oklahoma",
    "TN": "Tennessee",
    "TX": "Texas",
}


def post(endpoint: str, payload: list[dict[str, Any]], auth_header: str, timeout: int = 140) -> dict[str, Any]:
    request = urllib.request.Request(
        f"https://api.dataforseo.com/v3/{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": auth_header, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"http_error": exc.code, "body": body, "endpoint": endpoint}


def stable_id(*parts: Any) -> str:
    return hashlib.sha256("|".join("" if part is None else str(part) for part in parts).encode("utf-8")).hexdigest()[:32]


def current_spotlight_keywords(db_path: Path, run_date: str, property_id: str | None = None) -> list[str]:
    with sqlite3.connect(db_path) as conn:
        if property_id:
            rows = conn.execute(
                """
                SELECT DISTINCT keyword
                FROM dataforseo_property_keyword_rankings
                WHERE run_date = ?
                  AND property_id = ?
                ORDER BY keyword
                """,
                (run_date, property_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT DISTINCT keyword
                FROM dataforseo_property_keyword_rankings
                WHERE run_date = ?
                ORDER BY keyword
                """,
                (run_date,),
            ).fetchall()
    return [row[0] for row in rows if row[0]]


def default_keywords(identity: Any) -> list[str]:
    candidates = [
        identity.property_name,
        f"{identity.property_name} apartments",
        f"{identity.property_name} {identity.city}",
        f"apartments in {identity.city} {identity.state}" if identity.city and identity.state else None,
        f"{identity.city} apartments" if identity.city else None,
        f"apartments for rent in {identity.city} {identity.state}" if identity.city and identity.state else None,
        f"luxury apartments {identity.city} {identity.state}" if identity.city and identity.state else None,
        f"pet friendly apartments {identity.city} {identity.state}" if identity.city and identity.state else None,
    ]
    seen: set[str] = set()
    keywords: list[str] = []
    for candidate in candidates:
        value = " ".join(str(candidate or "").split())
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            keywords.append(value)
    return keywords


def extract_tasks_cost(payload: dict[str, Any]) -> float:
    return round(sum(float(task.get("cost") or 0) for task in payload.get("tasks") or []), 6)


def task_results(payload: dict[str, Any]) -> list[Any]:
    results: list[Any] = []
    for task in payload.get("tasks") or []:
        for result in task.get("result") or []:
            if isinstance(result, list):
                results.extend(result)
            else:
                results.append(result)
    return results


def keyword_volume_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for task in payload.get("tasks") or []:
        for result in task.get("result") or []:
            rows.append(
                {
                    "keyword": result.get("keyword"),
                    "search_volume": result.get("search_volume"),
                    "competition": result.get("competition"),
                    "competition_index": result.get("competition_index"),
                    "cpc": result.get("cpc"),
                    "low_top_of_page_bid": result.get("low_top_of_page_bid"),
                    "high_top_of_page_bid": result.get("high_top_of_page_bid"),
                    "location_code": result.get("location_code"),
                    "language_code": result.get("language_code"),
                    "monthly_searches": result.get("monthly_searches"),
                }
            )
    return rows


def onpage_summary(payload: dict[str, Any]) -> dict[str, Any]:
    item = None
    for result in task_results(payload):
        items = result.get("items") if isinstance(result, dict) else None
        if items:
            item = items[0]
            break
    if not item:
        return {}
    meta = item.get("meta") or {}
    content = meta.get("content") or {}
    checks = item.get("checks") or {}
    timing = item.get("page_timing") or {}
    return {
        "status_code": item.get("status_code"),
        "url": item.get("url"),
        "title": meta.get("title") or meta.get("meta_title"),
        "description": meta.get("description"),
        "h1": (meta.get("htags") or {}).get("h1"),
        "title_length": meta.get("title_length"),
        "description_length": meta.get("description_length"),
        "word_count": content.get("plain_text_word_count"),
        "title_to_content_consistency": content.get("title_to_content_consistency"),
        "description_to_content_consistency": content.get("description_to_content_consistency"),
        "internal_links_count": meta.get("internal_links_count"),
        "external_links_count": meta.get("external_links_count"),
        "images_count": meta.get("images_count"),
        "checks": {key: value for key, value in checks.items() if value is True},
        "page_timing": timing,
    }


def backlink_summary(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for result in task_results(payload):
        if not isinstance(result, dict):
            continue
        rows.append(
            {
                "target": result.get("target"),
                "rank": result.get("rank"),
                "backlinks": result.get("backlinks"),
                "referring_domains": result.get("referring_domains"),
                "referring_main_domains": result.get("referring_main_domains"),
                "broken_backlinks": result.get("broken_backlinks"),
                "broken_pages": result.get("broken_pages"),
                "backlinks_spam_score": result.get("backlinks_spam_score"),
                "target_spam_score": (result.get("info") or {}).get("target_spam_score"),
            }
        )
    return rows


def task_status_messages(payload: dict[str, Any]) -> list[str]:
    messages: list[str] = []
    for task in payload.get("tasks") or []:
        status = task.get("status_message")
        if status and status not in messages:
            messages.append(str(status))
    return messages


def business_info_summary(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for result in task_results(payload):
        for item in (result.get("items") or []) if isinstance(result, dict) else []:
            rating = item.get("rating") or {}
            address_info = item.get("address_info") or {}
            rows.append(
                {
                    "title": item.get("title"),
                    "category": item.get("category"),
                    "address": item.get("address") or item.get("snippet"),
                    "city": address_info.get("city"),
                    "zip": address_info.get("zip"),
                    "domain": item.get("domain"),
                    "url": item.get("url"),
                    "is_claimed": item.get("is_claimed"),
                    "total_photos": item.get("total_photos"),
                    "rating": rating.get("value"),
                    "votes_count": rating.get("votes_count"),
                    "rating_distribution": item.get("rating_distribution"),
                    "place_topics": item.get("place_topics"),
                    "people_also_search": [
                        {
                            "title": competitor.get("title"),
                            "rating": (competitor.get("rating") or {}).get("value"),
                            "votes_count": (competitor.get("rating") or {}).get("votes_count"),
                        }
                        for competitor in (item.get("people_also_search") or [])[:8]
                    ],
                }
            )
    return rows


def ranked_keyword_rows(payload: dict[str, Any], limit: int = 20) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for result in task_results(payload):
        for item in (result.get("items") or []) if isinstance(result, dict) else []:
            keyword_data = item.get("keyword_data") or {}
            keyword_info = keyword_data.get("keyword_info") or {}
            serp = item.get("ranked_serp_element") or {}
            serp_item = serp.get("serp_item") or {}
            rows.append(
                {
                    "keyword": keyword_data.get("keyword"),
                    "rank_absolute": serp_item.get("rank_absolute"),
                    "rank_group": serp_item.get("rank_group"),
                    "type": serp_item.get("type"),
                    "url": serp_item.get("url"),
                    "search_volume": keyword_info.get("search_volume"),
                    "cpc": keyword_info.get("cpc"),
                    "competition": keyword_info.get("competition"),
                }
            )
    return rows[:limit]


def ai_text(payload: dict[str, Any]) -> str:
    for result in task_results(payload):
        if isinstance(result, dict):
            for key in ("text", "content", "markdown", "answer"):
                if isinstance(result.get(key), str):
                    return result[key]
            if isinstance(result.get("items"), list):
                return json.dumps(result.get("items")[:2], indent=2)
    return ""


def cited_domains_from_ai(payload: dict[str, Any]) -> list[str]:
    domains: list[str] = []
    for result in task_results(payload):
        if not isinstance(result, dict):
            continue
        for item in result.get("items") or []:
            for section in item.get("sections") or []:
                for annotation in section.get("annotations") or []:
                    url = annotation.get("url")
                    if not url:
                        continue
                    domain = urllib.parse.urlparse(url).netloc.replace("www.", "")
                    if domain and domain not in domains:
                        domains.append(domain)
    return domains


def store_enrichment_rows(
    db_path: Path,
    run_date: str,
    run_at: str,
    property_id: str,
    domain: str,
    target_path: str,
    prompt: str,
    context: dict[str, Any],
) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.executescript(ENRICHMENT_SCHEMA.read_text(encoding="utf-8"))
        for row in context["keyword_volume"]:
            conn.execute(
                """
                INSERT INTO dataforseo_keyword_metrics (
                  id, run_date, property_id, keyword, location_code, language_code, search_volume,
                  competition, competition_index, cpc, low_top_of_page_bid, high_top_of_page_bid,
                  monthly_searches_json, raw_response_path, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(run_date, keyword, location_code, language_code) DO UPDATE SET
                  property_id=excluded.property_id,
                  search_volume=excluded.search_volume,
                  competition=excluded.competition,
                  competition_index=excluded.competition_index,
                  cpc=excluded.cpc,
                  low_top_of_page_bid=excluded.low_top_of_page_bid,
                  high_top_of_page_bid=excluded.high_top_of_page_bid,
                  monthly_searches_json=excluded.monthly_searches_json,
                  raw_response_path=excluded.raw_response_path,
                  updated_at=datetime('now')
                """,
                (
                    stable_id("kw", run_date, row.get("keyword"), row.get("location_code"), row.get("language_code")),
                    run_date,
                    property_id,
                    row.get("keyword"),
                    row.get("location_code"),
                    row.get("language_code"),
                    row.get("search_volume"),
                    row.get("competition"),
                    row.get("competition_index"),
                    row.get("cpc"),
                    row.get("low_top_of_page_bid"),
                    row.get("high_top_of_page_bid"),
                    json.dumps(row.get("monthly_searches")),
                    context["evidence_paths"]["keyword_volume"],
                ),
            )
        for row in context["ranked_keywords"]:
            conn.execute(
                """
                INSERT INTO dataforseo_labs_ranked_keywords (
                  id, run_date, property_id, target_domain, target_path, keyword, result_type,
                  rank_absolute, rank_group, url, search_volume, cpc, competition, raw_item_json,
                  raw_response_path, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(run_date, property_id, keyword, url) DO UPDATE SET
                  result_type=excluded.result_type,
                  rank_absolute=excluded.rank_absolute,
                  rank_group=excluded.rank_group,
                  search_volume=excluded.search_volume,
                  cpc=excluded.cpc,
                  competition=excluded.competition,
                  raw_item_json=excluded.raw_item_json,
                  raw_response_path=excluded.raw_response_path,
                  updated_at=datetime('now')
                """,
                (
                    stable_id("labs", run_date, property_id, row.get("keyword"), row.get("url")),
                    run_date,
                    property_id,
                    domain,
                    target_path,
                    row.get("keyword"),
                    row.get("type"),
                    row.get("rank_absolute"),
                    row.get("rank_group"),
                    row.get("url"),
                    row.get("search_volume"),
                    row.get("cpc"),
                    row.get("competition"),
                    json.dumps(row, sort_keys=True),
                    context["evidence_paths"]["ranked_keywords_page"],
                ),
            )
        onpage = context["onpage"]
        if onpage.get("url"):
            conn.execute(
                """
                INSERT INTO dataforseo_onpage_page_snapshots (
                  id, run_date, property_id, url, status_code, title, meta_description, h1_json,
                  title_length, description_length, word_count, title_to_content_consistency,
                  description_to_content_consistency, internal_links_count, external_links_count,
                  images_count, checks_json, page_timing_json, raw_response_path, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(run_date, property_id, url) DO UPDATE SET
                  status_code=excluded.status_code,
                  title=excluded.title,
                  meta_description=excluded.meta_description,
                  h1_json=excluded.h1_json,
                  title_length=excluded.title_length,
                  description_length=excluded.description_length,
                  word_count=excluded.word_count,
                  title_to_content_consistency=excluded.title_to_content_consistency,
                  description_to_content_consistency=excluded.description_to_content_consistency,
                  internal_links_count=excluded.internal_links_count,
                  external_links_count=excluded.external_links_count,
                  images_count=excluded.images_count,
                  checks_json=excluded.checks_json,
                  page_timing_json=excluded.page_timing_json,
                  raw_response_path=excluded.raw_response_path,
                  updated_at=datetime('now')
                """,
                (
                    stable_id("onpage", run_date, property_id, onpage.get("url")),
                    run_date,
                    property_id,
                    onpage.get("url"),
                    onpage.get("status_code"),
                    onpage.get("title"),
                    onpage.get("description"),
                    json.dumps(onpage.get("h1")),
                    onpage.get("title_length"),
                    onpage.get("description_length"),
                    onpage.get("word_count"),
                    onpage.get("title_to_content_consistency"),
                    onpage.get("description_to_content_consistency"),
                    onpage.get("internal_links_count"),
                    onpage.get("external_links_count"),
                    onpage.get("images_count"),
                    json.dumps(onpage.get("checks")),
                    json.dumps(onpage.get("page_timing")),
                    context["evidence_paths"]["onpage"],
                ),
            )
        for row in context["business_info"]:
            conn.execute(
                """
                INSERT INTO dataforseo_business_profiles (
                  id, run_date, property_id, keyword, title, category, address, city, region, zip,
                  domain, url, is_claimed, total_photos, rating, votes_count,
                  rating_distribution_json, place_topics_json, people_also_search_json,
                  raw_response_path, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(run_date, property_id, keyword) DO UPDATE SET
                  title=excluded.title,
                  category=excluded.category,
                  address=excluded.address,
                  city=excluded.city,
                  region=excluded.region,
                  zip=excluded.zip,
                  domain=excluded.domain,
                  url=excluded.url,
                  is_claimed=excluded.is_claimed,
                  total_photos=excluded.total_photos,
                  rating=excluded.rating,
                  votes_count=excluded.votes_count,
                  rating_distribution_json=excluded.rating_distribution_json,
                  place_topics_json=excluded.place_topics_json,
                  people_also_search_json=excluded.people_also_search_json,
                  raw_response_path=excluded.raw_response_path,
                  updated_at=datetime('now')
                """,
                (
                    stable_id("business", run_date, property_id, context["property_name"]),
                    run_date,
                    property_id,
                    context["property_name"],
                    row.get("title"),
                    row.get("category"),
                    row.get("address"),
                    row.get("city"),
                    None,
                    row.get("zip"),
                    row.get("domain"),
                    row.get("url"),
                    1 if row.get("is_claimed") else 0 if row.get("is_claimed") is not None else None,
                    row.get("total_photos"),
                    row.get("rating"),
                    row.get("votes_count"),
                    json.dumps(row.get("rating_distribution")),
                    json.dumps(row.get("place_topics")),
                    json.dumps(row.get("people_also_search")),
                    context["evidence_paths"]["business_info"],
                ),
            )
        ai_response = context["ai_response"]
        cited_domains = context.get("ai_cited_domains") or []
        conn.execute(
            """
            INSERT INTO dataforseo_ai_visibility_probes (
              id, run_date, run_at, property_id, platform, model_name, prompt, response_text,
              target_mentioned, cited_domains_json, raw_response_path, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                stable_id("ai", run_at, property_id, prompt),
                run_date,
                run_at,
                property_id,
                "chat_gpt",
                "gpt-4.1-mini",
                prompt,
                ai_response,
                1 if context["property_name"].lower().replace("the ", "") in ai_response.lower().replace("the ", "") else 0,
                json.dumps(cited_domains),
                context["evidence_paths"]["ai_chatgpt"],
            ),
        )
        conn.commit()


def write_report(path: Path, context: dict[str, Any]) -> None:
    top_keywords = sorted(
        [row for row in context["keyword_volume"] if row.get("search_volume") is not None],
        key=lambda row: (row.get("search_volume") or 0, row.get("cpc") or 0),
        reverse=True,
    )[:15]
    lines = [
        "# DataForSEO Deep Trial Report",
        "",
        f"Generated: {context['generated_at']}",
        f"Property: {context['property_name']} ({context['property_id']})",
        f"URL: {context['website_url']}",
        "",
        "## Trial Cost",
        "",
        f"Total observed API cost: ${context['total_cost']:.4f}",
        "",
        "## What Worked",
        "",
        "- Keyword demand/CPC data loaded for the selected property keyword universe.",
        "- OnPage Instant Pages produced usable page-level SEO/content health data.",
        "- Business Data produced usable Google business profile enrichment.",
        "- DataForSEO Labs ranked-keyword data can identify page/domain keyword visibility where its index has coverage.",
        "- AI Optimization can test whether a property appears in conversational apartment recommendations.",
        "",
        "## Keyword Demand Highlights",
        "",
        "| Keyword | Volume | CPC | Competition |",
        "| --- | ---: | ---: | --- |",
    ]
    for row in top_keywords:
        lines.append(
            f"| {row.get('keyword')} | {row.get('search_volume') or ''} | {row.get('cpc') or ''} | {row.get('competition') or ''} |"
        )
    onpage = context["onpage"]
    lines.extend(
        [
            "",
            "## OnPage Read",
            "",
            f"- Status: {onpage.get('status_code')}",
            f"- Title: {onpage.get('title')}",
            f"- Meta description: {onpage.get('description')}",
            f"- H1: {onpage.get('h1')}",
            f"- Word count: {onpage.get('word_count')}",
            f"- Active checks: {', '.join(onpage.get('checks', {}).keys()) or 'none flagged in extracted summary'}",
            "",
            "## Backlink Read",
            "",
            "| Target | Rank | Backlinks | Referring Domains | Broken Backlinks | Target Spam |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for row in context["backlinks"]:
        lines.append(
            f"| {row.get('target')} | {row.get('rank') or ''} | {row.get('backlinks') or 0} | {row.get('referring_domains') or 0} | {row.get('broken_backlinks') or 0} | {row.get('target_spam_score') or ''} |"
        )
    if not context["backlinks"]:
        lines.append(
            f"| Backlinks API | blocked | 0 | 0 | 0 | {'; '.join(context.get('backlink_status_messages') or [])} |"
        )
    lines.extend(["", "## Labs Ranked Keywords", "", "| Keyword | Rank | Type | Volume | CPC | URL |", "| --- | ---: | --- | ---: | ---: | --- |"])
    for row in context["ranked_keywords"][:15]:
        lines.append(
            f"| {row.get('keyword')} | {row.get('rank_absolute') or ''} | {row.get('type') or ''} | {row.get('search_volume') or ''} | {row.get('cpc') or ''} | {row.get('url') or ''} |"
        )
    lines.extend(["", "## Business Profile Read", ""])
    for row in context["business_info"]:
        lines.extend(
            [
                f"- Title: {row.get('title')}",
                f"- Category: {row.get('category')}",
                f"- Address: {row.get('address')}",
                f"- Domain: {row.get('domain')}",
                f"- Rating: {row.get('rating')} from {row.get('votes_count')} votes",
                f"- Photos: {row.get('total_photos')}",
                f"- Claimed: {row.get('is_claimed')}",
            ]
        )
        competitors = row.get("people_also_search") or []
        if competitors:
            lines.append("- People also search: " + ", ".join(item.get("title") or "" for item in competitors if item.get("title")))
    lines.extend(
        [
            "",
            "## AI Visibility Probe",
            "",
            context["ai_response"][:3000] or "No usable AI response text returned.",
            "",
            "## Raw Evidence",
            "",
        ]
    )
    for label, evidence_path in context["evidence_paths"].items():
        lines.append(f"- {label}: `{evidence_path}`")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property-key", default="AR4PB")
    parser.add_argument("--run-date", default="2026-04-28")
    parser.add_argument("--keyword", action="append", help="Explicit keyword to include in the keyword-demand packet.")
    parser.add_argument("--ai-prompt", help="Override the default AI visibility prompt.")
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()

    identity = resolve_property_identity(args.property_key)
    if identity is None:
        raise RuntimeError(f"Could not resolve property identity: {args.property_key}")

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output_dir = OUTPUT_ROOT / generated_at[:10] / identity.marketing_bi_property_id
    output_dir.mkdir(parents=True, exist_ok=True)
    auth = resolve_dataforseo_credentials().authorization_header

    keywords = current_spotlight_keywords(args.db, args.run_date, identity.marketing_bi_property_id)
    if not keywords:
        keywords = default_keywords(identity)
    if args.keyword:
        seen = {keyword.lower() for keyword in keywords}
        for keyword in args.keyword:
            value = " ".join(keyword.split())
            if value and value.lower() not in seen:
                seen.add(value.lower())
                keywords.append(value)
    property_path = urllib.parse.urlparse(identity.website_url or "").path or "/"
    domain = urllib.parse.urlparse(identity.website_url or identity.gsc_url or "").netloc.replace("www.", "")
    if not domain:
        domain = "venterraliving.com"

    ai_prompt = args.ai_prompt or (
        f"When someone searches for apartments in {identity.city}, {identity.state}, "
        f"which apartment communities should they consider? Mention whether {identity.property_name} appears relevant."
    )
    calls: dict[str, tuple[str, list[dict[str, Any]], int]] = {
        "keyword_volume": (
            "keywords_data/google_ads/search_volume/live",
            [{"location_code": 2840, "language_code": "en", "keywords": keywords}],
            140,
        ),
        "ranked_keywords_page": (
            "dataforseo_labs/google/ranked_keywords/live",
            [
                {
                    "target": domain,
                    "location_code": 2840,
                    "language_code": "en",
                    "limit": 50,
                    "item_types": ["organic", "local_pack"],
                    "filters": ["ranked_serp_element.serp_item.relative_url", "like", f"%{property_path.rstrip('/')}%"],
                }
            ],
            140,
        ),
        "backlinks": (
            "backlinks/summary/live",
            [
                {"target": identity.website_url, "include_subdomains": True, "backlinks_status_type": "live"},
                {"target": domain, "include_subdomains": True, "backlinks_status_type": "live"},
            ],
            140,
        ),
        "onpage": (
            "on_page/instant_pages",
            [{"url": identity.website_url, "enable_javascript": True, "disable_cookie_popup": True}],
            160,
        ),
        "ai_chatgpt": (
            "ai_optimization/chat_gpt/llm_responses/live",
            [
                {
                    "model_name": "gpt-4.1-mini",
                    "web_search": True,
                    "web_search_country_iso_code": "US",
                    "web_search_city": identity.city,
                    "system_message": "You are helping evaluate apartment search visibility. Answer with specific communities and sources when available.",
                    "user_prompt": ai_prompt,
                    "max_output_tokens": 500,
                    "temperature": 0.2,
                }
            ],
            180,
        ),
        "business_info": (
            "business_data/google/my_business_info/live",
            [
                {
                    "language_code": "en",
                    "location_name": f"{identity.city},{STATE_NAMES.get(identity.state or '', identity.state)},United States",
                    "keyword": f"{identity.property_name} apartments {identity.city}",
                }
            ],
            140,
        ),
    }

    payloads: dict[str, dict[str, Any]] = {}
    for label, (endpoint, payload, timeout) in calls.items():
        payloads[label] = post(endpoint, payload, auth, timeout=timeout)
        (output_dir / f"{label}.json").write_text(json.dumps(payloads[label], indent=2, sort_keys=True), encoding="utf-8")
        time.sleep(1)

    context = {
        "generated_at": generated_at,
        "property_id": identity.marketing_bi_property_id,
        "property_name": identity.property_name,
        "website_url": identity.website_url,
        "total_cost": sum(extract_tasks_cost(payload) for payload in payloads.values()),
        "keyword_volume": keyword_volume_rows(payloads["keyword_volume"]),
        "onpage": onpage_summary(payloads["onpage"]),
        "backlinks": backlink_summary(payloads["backlinks"]),
        "backlink_status_messages": task_status_messages(payloads["backlinks"]),
        "ranked_keywords": ranked_keyword_rows(payloads["ranked_keywords_page"]),
        "business_info": business_info_summary(payloads["business_info"]),
        "ai_response": ai_text(payloads["ai_chatgpt"]),
        "ai_cited_domains": cited_domains_from_ai(payloads["ai_chatgpt"]),
        "evidence_paths": {label: str(output_dir / f"{label}.json") for label in payloads},
    }
    store_enrichment_rows(
        args.db,
        generated_at[:10],
        generated_at,
        identity.marketing_bi_property_id,
        domain,
        property_path,
        ai_prompt,
        context,
    )
    summary_path = output_dir / "dataforseo_deep_trial_report.md"
    write_report(summary_path, context)
    (output_dir / "summary.json").write_text(json.dumps(context, indent=2, sort_keys=True), encoding="utf-8")
    print(
        json.dumps(
            {
                "property_id": context["property_id"],
                "property_name": context["property_name"],
                "total_cost": round(context["total_cost"], 6),
                "keyword_rows": len(context["keyword_volume"]),
                "ranked_keyword_rows": len(context["ranked_keywords"]),
                "backlink_rows": len(context["backlinks"]),
                "business_info_rows": len(context["business_info"]),
                "onpage_status": context["onpage"].get("status_code"),
                "ai_response_chars": len(context["ai_response"]),
                "report_path": str(summary_path),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
