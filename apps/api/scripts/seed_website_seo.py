#!/usr/bin/env python3
"""
Seed D1 with Website & SEO data from Base44 CSV export.

Reads the CSV, normalises dates to the nearest Friday, deduplicates,
creates missing communities, and generates SQL files for wrangler to apply.

Usage:
    python3 scripts/seed_website_seo.py /path/to/website_seo_backup.csv
"""

import csv
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# ── Existing community names in D1 (as of 2026-02-22) ──

EXISTING_COMMUNITIES = {
    "Anatole Daytona",
    "Apex West Midtown",
    "Avasa at 1604",
    "Belterra",
    "Botanic",
    "Camber Ridge",
    "CoHo",
    "Elation at Grandway West",
    "Grand Harbor",
    "Lakeland",
    "Mayfield",
    "Pointe at Bentonville",
    "Steeplechase",
    "Stonecreek",
    "The Reserves of Thomas Glen",
    "Timber Mill",
    "Townhomes",
    "Valencia",
    "Villa Lago",
    "West 46th",
}

SKIP_NAMES = {"Unknown", ""}

DATA_FIELDS = [
    "t7_engaged_sessions_delta",
    "t7_organic_sessions_delta",
    "t30_engaged_sessions_delta",
    "t30_organic_sessions_delta",
    "t7_organic_visibility",
    "t7_serp_traffic",
    "website_notes",
    "seo_notes",
]

NUMERIC_FIELDS = {
    "t7_engaged_sessions_delta",
    "t7_organic_sessions_delta",
    "t30_engaged_sessions_delta",
    "t30_organic_sessions_delta",
    "t7_organic_visibility",
    "t7_serp_traffic",
}


def nearest_friday(date_str: str) -> str | None:
    """Snap a date string to the nearest Friday. Returns YYYY-MM-DD or None."""
    # Fix obvious typos
    if date_str.startswith("0025-"):
        date_str = "2025-" + date_str[5:]

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None

    weekday = dt.weekday()  # Monday=0 ... Friday=4
    if weekday == 4:
        return dt.strftime("%Y-%m-%d")

    # Snap to nearest Friday
    days_since_friday = (weekday - 4) % 7
    days_until_friday = (4 - weekday) % 7
    if days_since_friday <= days_until_friday:
        nearest = dt - timedelta(days=days_since_friday)
    else:
        nearest = dt + timedelta(days=days_until_friday)
    return nearest.strftime("%Y-%m-%d")


def row_has_data(row: dict) -> bool:
    """True if row has at least one non-empty data field."""
    for f in DATA_FIELDS:
        val = row.get(f, "").strip()
        if val:
            return True
    return False


def merge_rows(existing: dict, incoming: dict) -> dict:
    """Merge incoming data into existing row, preferring non-empty values."""
    merged = dict(existing)
    for f in DATA_FIELDS:
        incoming_val = incoming.get(f, "").strip()
        existing_val = merged.get(f, "").strip()
        if incoming_val and not existing_val:
            merged[f] = incoming_val
        elif incoming_val and existing_val:
            # For text fields, concatenate if different
            if f in ("website_notes", "seo_notes"):
                if incoming_val != existing_val:
                    merged[f] = existing_val + "; " + incoming_val
            else:
                # For numeric, keep the one that's not empty (prefer incoming if both exist)
                merged[f] = incoming_val
    return merged


def sql_str(val: str | None) -> str:
    """Escape a string for SQL."""
    if val is None or val.strip() == "":
        return "NULL"
    escaped = val.replace("'", "''")
    return f"'{escaped}'"


def sql_num(val: str | None) -> str:
    """Convert a numeric string to SQL value."""
    if val is None or val.strip() == "":
        return "NULL"
    try:
        return str(float(val))
    except ValueError:
        return "NULL"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 seed_website_seo.py <csv_file>")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    if not csv_path.exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    out_dir = Path(__file__).parent / "generated"
    out_dir.mkdir(exist_ok=True)

    # ── Step 1: Read and clean CSV ──

    raw_rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_rows.append(row)

    print(f"Read {len(raw_rows)} raw rows from CSV")

    # ── Step 2: Normalize dates, skip bad rows, deduplicate ──

    # key = (property_name, week_date) → merged row
    deduped: dict[tuple[str, str], dict] = {}
    skipped_unknown = 0
    skipped_empty = 0
    skipped_bad_date = 0
    date_fixes = 0

    for row in raw_rows:
        name = row.get("property_name", "").strip()
        if name in SKIP_NAMES:
            skipped_unknown += 1
            continue

        raw_date = row.get("date", "").strip()
        friday = nearest_friday(raw_date)
        if friday is None:
            skipped_bad_date += 1
            continue

        if friday != raw_date:
            date_fixes += 1

        if not row_has_data(row):
            skipped_empty += 1
            continue

        key = (name, friday)
        if key in deduped:
            deduped[key] = merge_rows(deduped[key], row)
        else:
            deduped[key] = dict(row)
            deduped[key]["date"] = friday

    print(f"After cleaning: {len(deduped)} unique property-week rows")
    print(f"  Skipped {skipped_unknown} 'Unknown' rows")
    print(f"  Skipped {skipped_empty} empty rows")
    print(f"  Skipped {skipped_bad_date} bad-date rows")
    print(f"  Fixed {date_fixes} non-Friday dates")

    # ── Step 3: Identify missing communities ──

    all_names = set(row[0] for row in deduped.keys())
    new_names = sorted(all_names - EXISTING_COMMUNITIES)
    print(f"\nNew communities to create: {len(new_names)}")
    for n in new_names:
        print(f"  + {n}")

    # ── Step 4: Generate communities SQL ──

    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    communities_sql_lines = [
        "-- Auto-generated: create missing communities for Website & SEO import",
        f"-- Generated: {now}",
        "",
    ]

    for name in new_names:
        cid = str(uuid.uuid4())
        communities_sql_lines.append(
            f"INSERT INTO communities (id, name, status, created_at, created_by, updated_at, updated_by) "
            f"VALUES ('{cid}', {sql_str(name)}, 'active', '{now}', 'system', '{now}', 'system');"
        )

    communities_sql = "\n".join(communities_sql_lines) + "\n"
    communities_file = out_dir / "01_create_communities.sql"
    communities_file.write_text(communities_sql)
    print(f"\nWrote: {communities_file}")

    # ── Step 5: Generate marketing_data upsert SQL ──

    # Sort by date, then property for nice ordering
    sorted_keys = sorted(deduped.keys(), key=lambda k: (k[1], k[0]))

    marketing_sql_lines = [
        "-- Auto-generated: import Website & SEO data from Base44 backup",
        f"-- Generated: {now}",
        f"-- Total rows: {len(sorted_keys)}",
        "",
    ]

    for name, friday in sorted_keys:
        row = deduped[(name, friday)]
        mid = str(uuid.uuid4())

        t7_eng = sql_num(row.get("t7_engaged_sessions_delta"))
        t7_org = sql_num(row.get("t7_organic_sessions_delta"))
        t30_eng = sql_num(row.get("t30_engaged_sessions_delta"))
        t30_org = sql_num(row.get("t30_organic_sessions_delta"))
        t7_vis = sql_num(row.get("t7_organic_visibility"))
        t7_serp = sql_num(row.get("t7_serp_traffic"))
        wnotes = sql_str(row.get("website_notes", "").strip() or None)
        snotes = sql_str(row.get("seo_notes", "").strip() or None)

        marketing_sql_lines.append(
            f"INSERT INTO marketing_data "
            f"(id, community_id, week_date, "
            f"t7_engaged_sessions_delta, t7_organic_sessions_delta, "
            f"t30_engaged_sessions_delta, t30_organic_sessions_delta, "
            f"t7_organic_visibility, t7_serp_traffic, "
            f"website_notes, seo_notes, website_seo_saved_at, "
            f"created_at, created_by, updated_at, updated_by) "
            f"VALUES ("
            f"'{mid}', "
            f"(SELECT id FROM communities WHERE LOWER(name) = LOWER({sql_str(name)})), "
            f"'{friday}', "
            f"{t7_eng}, {t7_org}, {t30_eng}, {t30_org}, "
            f"{t7_vis}, {t7_serp}, "
            f"{wnotes}, {snotes}, '{now}', "
            f"'{now}', 'system', '{now}', 'system') "
            f"ON CONFLICT(community_id, week_date) DO UPDATE SET "
            f"t7_engaged_sessions_delta = COALESCE(excluded.t7_engaged_sessions_delta, marketing_data.t7_engaged_sessions_delta), "
            f"t7_organic_sessions_delta = COALESCE(excluded.t7_organic_sessions_delta, marketing_data.t7_organic_sessions_delta), "
            f"t30_engaged_sessions_delta = COALESCE(excluded.t30_engaged_sessions_delta, marketing_data.t30_engaged_sessions_delta), "
            f"t30_organic_sessions_delta = COALESCE(excluded.t30_organic_sessions_delta, marketing_data.t30_organic_sessions_delta), "
            f"t7_organic_visibility = COALESCE(excluded.t7_organic_visibility, marketing_data.t7_organic_visibility), "
            f"t7_serp_traffic = COALESCE(excluded.t7_serp_traffic, marketing_data.t7_serp_traffic), "
            f"website_notes = COALESCE(excluded.website_notes, marketing_data.website_notes), "
            f"seo_notes = COALESCE(excluded.seo_notes, marketing_data.seo_notes), "
            f"website_seo_saved_at = '{now}', "
            f"updated_at = '{now}', "
            f"updated_by = 'system';"
        )

    marketing_sql = "\n".join(marketing_sql_lines) + "\n"
    marketing_file = out_dir / "02_import_website_seo.sql"
    marketing_file.write_text(marketing_sql)
    print(f"Wrote: {marketing_file}")

    # ── Summary ──

    # Count rows per property for verification
    property_counts = defaultdict(int)
    for name, _ in sorted_keys:
        property_counts[name] += 1

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Communities to create: {len(new_names)}")
    print(f"  Marketing data rows:   {len(sorted_keys)}")
    print(f"  Date range:            {sorted_keys[0][1]} → {sorted_keys[-1][1]}")
    print(f"\n  Rows per property:")
    for name in sorted(property_counts.keys()):
        print(f"    {name:40s} {property_counts[name]:3d} weeks")

    print(f"\nNext steps:")
    print(f"  1. npx wrangler d1 execute pop-brief-db --remote --file={communities_file}")
    print(f"  2. npx wrangler d1 execute pop-brief-db --remote --file={marketing_file}")


if __name__ == "__main__":
    main()
