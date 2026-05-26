#!/usr/bin/env python3
"""Backfill transparent GBP review sentiment rows from collected GBP reviews.

This utility is intentionally deterministic. It does not invent review facts or
call an LLM; it classifies sentiment from the review star rating and flags
themes only when source review text contains matching words.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "portfolio_analytics.db"

import sys

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402


THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "theme_maintenance": (
        "maintenance",
        "repair",
        "work order",
        "workorder",
        "broken",
        "fix",
        "leak",
        "mold",
        "pest",
        "roach",
        "dirty",
        "clean",
        "trash",
    ),
    "theme_staff": (
        "staff",
        "office",
        "manager",
        "management",
        "leasing",
        "agent",
        "team",
        "helpful",
        "rude",
        "professional",
    ),
    "theme_amenities": (
        "amenity",
        "amenities",
        "pool",
        "gym",
        "fitness",
        "clubhouse",
        "package",
        "gate",
        "elevator",
    ),
    "theme_noise": ("noise", "noisy", "loud", "neighbor", "neighbors", "quiet"),
    "theme_location": (
        "location",
        "near",
        "close",
        "convenient",
        "school",
        "shopping",
        "highway",
        "downtown",
    ),
    "theme_value": (
        "rent",
        "price",
        "expensive",
        "affordable",
        "fee",
        "fees",
        "charge",
        "deposit",
        "value",
    ),
    "theme_move_in": ("move in", "move-in", "moved in", "application", "tour", "lease"),
    "theme_move_out": ("move out", "move-out", "moved out", "deposit", "refund"),
    "theme_pets": ("pet", "dog", "cat", "bark", "barking", "dog park"),
    "theme_parking": ("parking", "garage", "car", "vehicle", "tow", "towed"),
}

ATTENTION_WORDS = (
    "unsafe",
    "crime",
    "mold",
    "roach",
    "rat",
    "pest",
    "flood",
    "leak",
    "broken",
    "rude",
    "ignored",
    "never fixed",
    "unresponsive",
    "deposit",
    "towed",
)


@dataclass
class BackfillResult:
    property_id: str
    source_property_id: str
    reviews_seen: int = 0
    rows_upserted: int = 0
    skipped_existing: int = 0


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def sentiment_from_rating(star_rating: int) -> tuple[float, str, str]:
    if star_rating >= 5:
        return 0.9, "positive", "happy"
    if star_rating == 4:
        return 0.55, "positive", "satisfied"
    if star_rating == 3:
        return 0.0, "neutral", "neutral"
    if star_rating == 2:
        return -0.55, "negative", "frustrated"
    return -0.9, "negative", "angry"


def classify_review(row: sqlite3.Row) -> dict[str, Any]:
    comment = normalize_text(row["comment"])
    text = comment.lower()
    star_rating = int(row["star_rating_numeric"] or 0)
    score, label, emotion = sentiment_from_rating(star_rating)
    themes = {theme: any(keyword in text for keyword in keywords) for theme, keywords in THEME_KEYWORDS.items()}
    key_phrases = [theme.replace("theme_", "").replace("_", " ") for theme, matched in themes.items() if matched]
    requires_attention = bool(star_rating <= 2 or any(word in text for word in ATTENTION_WORDS))
    action_items = None
    if requires_attention:
        if themes.get("theme_maintenance"):
            action_items = "Review maintenance-related concern and confirm work-order follow-up."
        elif themes.get("theme_staff"):
            action_items = "Review staff/service concern and confirm resident follow-up."
        elif themes.get("theme_value"):
            action_items = "Review rent, fee, deposit, or value concern and confirm resident follow-up."
        elif themes.get("theme_parking"):
            action_items = "Review parking/towing concern and confirm resident follow-up."
        else:
            action_items = "Review low-rating resident concern and confirm follow-up."
    return {
        "sentiment_score": score,
        "sentiment_label": label,
        "sentiment_confidence": 0.85 if comment else 0.7,
        "emotion": emotion,
        **themes,
        "key_phrases": json.dumps(key_phrases),
        "requires_attention": int(requires_attention),
        "action_items": action_items,
        "openai_model": "deterministic-rating-theme-v1",
        "openai_prompt_tokens": 0,
        "openai_completion_tokens": 0,
        "analysis_cost_usd": 0.0,
    }


def resolve_source_property_ids(property_key: str) -> tuple[str, list[str]]:
    identity = resolve_property_identity(property_key)
    if not identity:
        raise ValueError(f"Could not resolve property identity for {property_key!r}")
    ids = [
        identity.property_code,
        identity.ga4_property_id,
        identity.community_id,
        identity.gbp_location_id,
        str(identity.company_id or ""),
    ]
    return identity.ga4_property_id or identity.property_code, [item for item in ids if item]


def backfill(property_key: str, *, db_path: Path = DB_PATH, limit: int | None = None, replace: bool = False) -> BackfillResult:
    sentiment_property_id, source_ids = resolve_source_property_ids(property_key)
    placeholders = ", ".join("?" for _ in source_ids)
    params: list[Any] = list(source_ids)
    query = f"""
        SELECT *
        FROM gbp_reviews
        WHERE property_id IN ({placeholders})
        ORDER BY review_create_time DESC
    """
    if limit:
        query += " LIMIT ?"
        params.append(limit)

    result = BackfillResult(property_id=property_key, source_property_id=sentiment_property_id)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, params).fetchall()
        result.reviews_seen = len(rows)
        for row in rows:
            exists = conn.execute(
                "SELECT 1 FROM gbp_review_sentiment WHERE review_id = ?",
                (row["review_id"],),
            ).fetchone()
            if exists and not replace:
                result.skipped_existing += 1
                continue
            classified = classify_review(row)
            conn.execute(
                """
                INSERT OR REPLACE INTO gbp_review_sentiment (
                    review_id, property_id, sentiment_score, sentiment_label, sentiment_confidence, emotion,
                    theme_maintenance, theme_staff, theme_amenities, theme_noise,
                    theme_location, theme_value, theme_move_in, theme_move_out,
                    theme_pets, theme_parking, key_phrases, requires_attention, action_items,
                    openai_model, openai_prompt_tokens, openai_completion_tokens, analysis_cost_usd, analyzed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["review_id"],
                    sentiment_property_id,
                    classified["sentiment_score"],
                    classified["sentiment_label"],
                    classified["sentiment_confidence"],
                    classified["emotion"],
                    int(classified["theme_maintenance"]),
                    int(classified["theme_staff"]),
                    int(classified["theme_amenities"]),
                    int(classified["theme_noise"]),
                    int(classified["theme_location"]),
                    int(classified["theme_value"]),
                    int(classified["theme_move_in"]),
                    int(classified["theme_move_out"]),
                    int(classified["theme_pets"]),
                    int(classified["theme_parking"]),
                    classified["key_phrases"],
                    classified["requires_attention"],
                    classified["action_items"],
                    classified["openai_model"],
                    classified["openai_prompt_tokens"],
                    classified["openai_completion_tokens"],
                    classified["analysis_cost_usd"],
                    now,
                ),
            )
            result.rows_upserted += 1
        conn.commit()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill deterministic GBP review sentiment from source reviews.")
    parser.add_argument("property_key", help="Property code, name, GA4 id, URL, or governed alias.")
    parser.add_argument("--db-path", type=Path, default=DB_PATH)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    result = backfill(args.property_key, db_path=args.db_path, limit=args.limit, replace=args.replace)
    print(json.dumps(result.__dict__, indent=2))


if __name__ == "__main__":
    main()
