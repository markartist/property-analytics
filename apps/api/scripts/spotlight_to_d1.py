#!/usr/bin/env python3
"""
Spotlight Pipeline → D1 Bridge
===============================
Reads a Spotlight Properties CSV and pushes Website & SEO data directly
into the POP Brief D1 database (marketing_data table).

Usage:
  # Standalone — import an existing CSV:
  python3 spotlight_to_d1.py /path/to/Spotlight_Properties_YYYYMMDD_HHMMSS.csv

  # Programmatic — call from the pipeline:
  from spotlight_to_d1 import push_to_d1
  push_to_d1(results_list, export_date)
"""

import csv
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

# Paths
SCRIPT_DIR = Path(__file__).parent
API_DIR = SCRIPT_DIR.parent
WRANGLER_TOML = API_DIR / "wrangler.toml"
GENERATED_DIR = SCRIPT_DIR / "generated"


def _get_community_map() -> Dict[str, str]:
    """Fetch community name → id mapping from D1 via wrangler."""
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            "--command", "SELECT id, name FROM communities WHERE deleted_at IS NULL;",
            "--config", str(WRANGLER_TOML),
            "--json",
        ],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        print(f"⚠️  Wrangler query failed: {result.stderr[:200]}")
        # Fallback: use the generated SQL mapping if available
        return _get_community_map_fallback()

    try:
        data = json.loads(result.stdout)
        rows = data[0]["results"] if isinstance(data, list) else data.get("results", [])
        mapping = {}
        for row in rows:
            mapping[row["name"].strip().lower()] = row["id"]
        print(f"📊 Loaded {len(mapping)} communities from D1")
        return mapping
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"⚠️  Failed to parse wrangler output: {e}")
        return _get_community_map_fallback()


def _get_community_map_fallback() -> Dict[str, str]:
    """Fallback: read community IDs from the last generated SQL files."""
    mapping = {}

    for sql_file in ["03_update_communities.sql", "04_insert_communities.sql"]:
        fpath = GENERATED_DIR / sql_file
        if not fpath.exists():
            continue
        with open(fpath) as f:
            for line in f:
                # Extract name and id from SQL
                if "WHERE id = '" in line:
                    # UPDATE ... WHERE id = 'uuid';
                    name_start = line.find("manager_name")
                    id_start = line.find("WHERE id = '") + len("WHERE id = '")
                    id_end = line.find("'", id_start)
                    uid = line[id_start:id_end]
                    # Extract community name from the SET clause or context
                    # This is fragile, prefer the wrangler approach
                elif "INSERT INTO communities" in line and "VALUES (" in line:
                    vals_start = line.find("VALUES (") + len("VALUES (")
                    vals = line[vals_start:].rstrip(");").split("', '")
                    if len(vals) >= 2:
                        uid = vals[0].strip("'")
                        name = vals[1].strip("'")
                        mapping[name.strip().lower()] = uid

    if mapping:
        print(f"📊 Loaded {len(mapping)} communities from SQL fallback")
    return mapping


def _escape_sql(val: str) -> str:
    """Escape single quotes for SQL literals."""
    return val.replace("'", "''")


def push_to_d1(results: List[Dict], export_date: str) -> int:
    """
    Push Spotlight results directly to D1 marketing_data table.

    Args:
        results: List of dicts with keys matching Spotlight CSV columns
        export_date: YYYY-MM-DD date string (should be a Friday)

    Returns:
        Number of rows successfully generated for import
    """
    community_map = _get_community_map()
    if not community_map:
        print("❌ No community mapping available — cannot push to D1")
        return 0

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sql_lines = [
        f"-- Auto-generated: Spotlight → D1 bridge",
        f"-- Generated: {now}",
        f"-- Export date: {export_date}",
        "",
    ]

    matched = 0
    skipped = []

    for row in results:
        prop_name = row.get("property_name", "").strip()
        week_date = row.get("date", export_date).strip()
        if not prop_name:
            continue

        # Look up community ID
        community_id = community_map.get(prop_name.lower())
        if not community_id:
            skipped.append(prop_name)
            continue

        # Build SET clause for Website & SEO fields
        sets = []
        for field in [
            "t7_engaged_sessions_delta", "t7_organic_sessions_delta",
            "t30_engaged_sessions_delta", "t30_organic_sessions_delta",
            "t7_organic_visibility", "t7_serp_traffic",
        ]:
            val = row.get(field)
            if val is not None and val != "" and val != 0:
                try:
                    sets.append(f"{field} = {float(val)}")
                except (ValueError, TypeError):
                    pass

        for field in ["website_notes", "seo_notes"]:
            val = row.get(field)
            if val and str(val).strip():
                sets.append(f"{field} = '{_escape_sql(str(val).strip())}'")

        sets.append(f"website_seo_saved_at = '{now}'")
        sets.append(f"updated_at = '{now}'")
        sets.append(f"updated_by = 'spotlight-pipeline'")

        if not sets:
            continue

        new_id = str(uuid.uuid4())
        set_clause = ", ".join(sets)

        # Upsert: try UPDATE first, then INSERT if no rows affected
        # Using INSERT OR IGNORE + UPDATE pattern for idempotency
        sql_lines.append(
            f"INSERT INTO marketing_data (id, community_id, week_date, created_at, created_by, updated_at, updated_by) "
            f"SELECT '{new_id}', '{community_id}', '{week_date}', '{now}', 'spotlight-pipeline', '{now}', 'spotlight-pipeline' "
            f"WHERE NOT EXISTS (SELECT 1 FROM marketing_data WHERE community_id = '{community_id}' AND week_date = '{week_date}');"
        )
        sql_lines.append(
            f"UPDATE marketing_data SET {set_clause} "
            f"WHERE community_id = '{community_id}' AND week_date = '{week_date}';"
        )
        matched += 1

    if skipped:
        print(f"⚠️  Skipped {len(skipped)} unmatched properties: {', '.join(skipped[:10])}")

    if matched == 0:
        print("❌ No rows matched — nothing to push")
        return 0

    # Write SQL file
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    sql_file = GENERATED_DIR / f"spotlight_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, "w") as f:
        f.write("\n".join(sql_lines))

    print(f"✅ Generated {matched} upserts → {sql_file.name}")

    # Execute via wrangler
    print(f"🚀 Executing against D1...")
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", "pop-brief-db", "--remote",
            f"--file={sql_file}",
            "--config", str(WRANGLER_TOML),
        ],
        capture_output=True, text=True, timeout=60,
        input="y\n",  # Auto-confirm
    )

    if result.returncode == 0:
        print(f"✅ Successfully pushed {matched} rows to D1")
    else:
        print(f"❌ Wrangler execute failed: {result.stderr[:300]}")
        print(f"   SQL file saved at: {sql_file}")

    return matched


def push_csv_to_d1(csv_path: str) -> int:
    """Read a Spotlight CSV file and push to D1."""
    print(f"\n{'='*60}")
    print(f"📋 SPOTLIGHT → D1 BRIDGE")
    print(f"{'='*60}")
    print(f"📁 Source: {csv_path}")

    if not os.path.exists(csv_path):
        print(f"❌ File not found: {csv_path}")
        return 0

    results = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert numeric fields
            clean = {}
            for key, val in row.items():
                if key in [
                    "t7_engaged_sessions_delta", "t7_organic_sessions_delta",
                    "t30_engaged_sessions_delta", "t30_organic_sessions_delta",
                    "t7_organic_visibility", "t7_serp_traffic",
                ]:
                    try:
                        clean[key] = float(val) if val and val.strip() else None
                    except ValueError:
                        clean[key] = None
                else:
                    clean[key] = val
            results.append(clean)

    if not results:
        print("❌ No rows found in CSV")
        return 0

    # Determine export date from first row
    export_date = results[0].get("date", datetime.now().strftime("%Y-%m-%d"))
    print(f"📅 Export date: {export_date}")
    print(f"📊 Rows in CSV: {len(results)}")

    return push_to_d1(results, export_date)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 spotlight_to_d1.py <csv_path>")
        print("  Reads a Spotlight Properties CSV and pushes to D1")
        sys.exit(1)

    csv_path = sys.argv[1]
    count = push_csv_to_d1(csv_path)
    print(f"\n{'='*60}")
    print(f"🏁 Done — {count} rows pushed to D1")
