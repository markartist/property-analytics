#!/usr/bin/env python3
"""
Enrich D1 communities from the canonical portfolio_analytics.db.

1. Reads all properties from canonical DB (93 props with unit_count, region, etc.)
2. Reads guest_card_metrics property codes for Encasa mapping
3. Maps to existing POP Brief community names (fuzzy matching for mismatches)
4. Generates SQL to UPDATE existing communities and INSERT missing ones

Usage:
    python3 scripts/enrich_communities.py
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

CANONICAL_DB = Path("/Users/mark/Property_Analytics/data/portfolio_analytics.db")
CONFIG_FILE = Path("/Users/mark/Property_Analytics/config/venterra_all_properties_ga4.json")

# ── Current D1 communities (id|name) from wrangler query ──
D1_COMMUNITIES = {
    "Anatole Daytona": "9c34af7c-1737-4ee5-9473-5a15de00c88b",
    "Apex West Midtown": "eed3da54-7b7a-4dae-984b-a203113fc2f3",
    "Avasa Grove West": "a1e35a67-3040-4335-9cb9-d51219247b2e",
    "Avasa Spring Branch": "df6b7013-2781-4547-bb71-1dcd0f2f6831",
    "Avasa at 1604": "e5a393b1-9bc0-4b99-b936-92ce80725dd0",
    "Belterra": "3e1ccb7f-b2ac-4ab1-9afd-3867940ae245",
    "Botanic": "2c2b46f3-f107-4651-9045-ca911586d46f",
    "Calais Midtown": "4607fc30-325a-4f4f-9499-70ffe40ebdf0",
    "Camber Ridge": "f3e80364-e2f3-45d0-a267-edb87fdeeb86",
    "Cane Island": "1d7a0f16-501e-4823-955e-9faa1dab91c3",
    "Canton Mill Lofts": "3c51a5be-3799-426e-b1d3-820008a2b5e0",
    "Cendana District West": "d8433d1a-fdaf-4d4e-bf9a-3bfc443d1691",
    "CoHo": "98989258-c049-4fc8-a7da-955b5bbd6055",
    "Elation at Grandway West": "c7054051-2919-443f-82a2-cd3b845ce82d",
    "Fairways at South Shore": "9dd947ad-53e1-4f67-959d-c13b0f17eb58",
    "Grand Harbor": "e73c76b2-4a4b-44ba-883e-7b270a9be617",
    "Keystone": "82a34f88-24ca-432f-ba8d-de217a17af23",
    "Lakeland": "f2236f7e-cd81-4a44-9baf-925c66b6c4bf",
    "Luma Headwaters": "70b83505-01dc-4899-abd5-70df936a8a0d",
    "Mayfield": "4f443302-4b2d-4f83-afe1-aebb77790c57",
    "Northbridge at Millenia Lake": "b730d1ad-0f73-441c-8ce2-f2091315e5bb",
    "Pointe at Bentonville": "bf2db957-6413-4cb7-b3b0-c96cc398fe23",
    "Retreat": "d097c652-b7ff-4508-8816-44c565cabed2",
    "San Palmilla": "be012825-6321-4e32-bbc9-8ea6559477cd",
    "Steeplechase": "2bfc48bb-7a3c-45a0-8344-21ba26c96409",
    "Stonecreek": "a49ec15b-71b0-419d-ae9a-624e73dbf51c",
    "The Metropolitan": "11376862-a8e9-4c35-9997-8307130f0a7b",
    "The Reserves of Thomas Glen": "c886943c-c675-4594-82d9-ce7e7017c208",
    "The Villages at Oakleaf": "442a284a-7446-43ba-9acf-ab8d42cf29a6",
    "The Whitney": "bf2a24f1-8f17-41ee-b5c3-2c2397bf7806",
    "Timber Mill": "3cf73e7e-b0ca-49c1-9c19-28804f90b765",
    "Townhomes": "f793205e-2db4-49ff-9541-5880c31f1c19",
    "Trevesta": "7e14194a-5f1e-4ebc-9fa0-9876e9755903",
    "Valencia": "2c97dbcf-edf9-42cf-a424-000a90b1e30b",
    "Villa Lago": "97e5eb66-ea38-49da-bfb0-0e6fc20cfb12",
    "West 46th": "a35601a1-bc31-4d07-91c2-dd5ecfc79470",
    "Westover": "d48d9d11-657a-44a0-9e92-daf03b5af969",
    "Zang": "3c690849-ef31-4b41-a8ad-f1e892c3dbd3",
}

# ── Manual name mapping: canonical DB property_name → POP Brief community name ──
# For the cases where names don't match automatically
MANUAL_NAME_MAP = {
    # canonical DB name → POP Brief name
    "The Anatole": "Anatole Daytona",
    "Botanic Luxury": "Botanic",
    "Camber Ridge": "Camber Ridge",
    "CoHo": "CoHo",
    "The Cape at Grand Harbor": "Grand Harbor",
    "Keystone": "Keystone",
    "The Retreat at Lakeland": "Lakeland",
    "Mission Mayfield Downs": "Mayfield",
    "Retreat at Kedron Village": "Retreat",
    "Steeplechase": "Steeplechase",
    "Stonecreek Ranch": "Stonecreek",
    "Timber Mill": "Timber Mill",
    "Townhomes at Lake Park": "Townhomes",
    "Trevesta Place": "Trevesta",
    "Valencia at Westchase": "Valencia",
    "Villa Lago": "Villa Lago",
    "West 46th": "West 46th",
    "Westover Oaks": "Westover",
    "Zang Triangle": "Zang",
    "The Metropolitan": "The Metropolitan",
    "The Whitney": "The Whitney",
    "Pointe at Bentonville": "Pointe at Bentonville",
    "Luma Headwaters": "Luma Headwaters",
    "Northbridge at Millenia Lake": "Northbridge at Millenia Lake",
    "The Reserves of Thomas Glen": "The Reserves of Thomas Glen",
    "The Villages at Oakleaf": "The Villages at Oakleaf",
    "Fairways at South Shore": "Fairways at South Shore",
    "San Palmilla": "San Palmilla",
    "Canton Mill Lofts": "Canton Mill Lofts",
    "Cendana District West": "Cendana District West",
    "Cane Island": "Cane Island",
    "Calais Midtown": "Calais Midtown",
    "Elation at Grandway West": "Elation at Grandway West",
    "Belterra": "Belterra",
    "Avasa at 1604": "Avasa at 1604",
    "Avasa Spring Branch": "Avasa Spring Branch",
    "Avasa Grove West": "Avasa Grove West",
    "Apex West Midtown": "Apex West Midtown",
}

# ── Guest card property_name → canonical DB property_name mapping ──
# For the 15 that don't match directly
GC_TO_CANONICAL = {
    "Botanic Apartments": "Botanic Luxury",
    "Camber Ridge at Cross Creek Ranch": "Camber Ridge",
    "Carlyle Place Apartments": "Carlyle Place",
    "CoHo Apartments": "CoHo",
    "College View Apartments": "College View",
    "Creekside Apartment Homes": "Creekside",
    "The District Universal Boulevard Apartments": "The District Universal Boulevard",
    "French Place Apartments": "French Place",
    "Keystone Apartments": "Keystone",
    "The Parker Apartment Homes": "The Parker",
    "Pointe at Bentonville": "Pointe at Bentonville",
    "Steeplechase Apartments": "Steeplechase",
    "Timberlane Village Apartments": "Timberlane Village",
    "Trevesta Place Apartments": "Trevesta Place",
    "West 46th Apartments": "West 46th",
}


def sql_str(val):
    if val is None:
        return "NULL"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def sql_int(val):
    if val is None:
        return "NULL"
    return str(int(val))


def main():
    import json

    conn = sqlite3.connect(CANONICAL_DB)
    conn.row_factory = sqlite3.Row

    # ── Load canonical properties ──
    props = conn.execute("SELECT * FROM properties ORDER BY property_name").fetchall()
    print(f"Canonical DB: {len(props)} properties")

    # ── Load guest card property codes ──
    gc_codes = conn.execute(
        "SELECT DISTINCT property_code, property_name FROM guest_card_metrics ORDER BY property_name"
    ).fetchall()
    gc_map = {row["property_name"]: row["property_code"] for row in gc_codes}
    print(f"Guest card property codes: {len(gc_map)}")

    # ── Load config for manager names ──
    manager_map = {}
    try:
        with open(CONFIG_FILE) as f:
            config = json.load(f)
        for key, val in config.get("spotlight_properties", {}).items():
            manager_map[val.get("ga4_property_id")] = val.get("manager")
    except Exception:
        print("Warning: Could not load config file for manager names")

    # ── Build POP Brief name → canonical property mapping ──

    # First, try direct match by canonical property_name
    d1_name_lower = {name.lower(): name for name in D1_COMMUNITIES}

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out_dir = Path(__file__).parent / "generated"
    out_dir.mkdir(exist_ok=True)

    update_lines = [
        "-- Auto-generated: enrich existing D1 communities with canonical DB metadata",
        f"-- Generated: {now}",
        "",
    ]
    insert_lines = [
        "-- Auto-generated: create missing communities from canonical DB",
        f"-- Generated: {now}",
        "",
    ]

    matched = 0
    created = 0
    unmatched = []

    for prop in props:
        prop_name = prop["property_name"]
        prop_id = prop["property_id"]  # GA4 ID
        unit_count = prop["unit_count"]
        encasa_short = prop["encasa_short_name"]
        encasa_region = prop["encasa_region"]
        full_url = prop["full_url"]
        city = prop["city"]
        state = prop["state"]
        manager = manager_map.get(prop_id)

        # Find the guest card property_code
        gc_code = gc_map.get(prop_name)
        if not gc_code:
            # Try via GC_TO_CANONICAL reverse lookup
            for gc_name, canon_name in GC_TO_CANONICAL.items():
                if canon_name == prop_name:
                    gc_code = gc_map.get(gc_name)
                    break

        # Determine POP Brief community name
        pop_name = MANUAL_NAME_MAP.get(prop_name)

        if not pop_name:
            # Try direct match
            if prop_name.lower() in d1_name_lower:
                pop_name = d1_name_lower[prop_name.lower()]
            elif encasa_short and encasa_short.lower() in d1_name_lower:
                pop_name = d1_name_lower[encasa_short.lower()]

        d1_id = D1_COMMUNITIES.get(pop_name) if pop_name else None

        # Build location from encasa_region or city/state
        location = encasa_region
        if not location and city and state:
            location = f"{city}, {state}"

        if d1_id:
            # UPDATE existing community
            matched += 1
            update_lines.append(
                f"UPDATE communities SET "
                f"manager_name = {sql_str(manager)}, "
                f"unit_count = {sql_int(unit_count)}, "
                f"ga4_property_id = {sql_str(prop_id)}, "
                f"full_url = {sql_str(full_url)}, "
                f"encasa_short_name = {sql_str(encasa_short)}, "
                f"encasa_property_code = {sql_str(gc_code)}, "
                f"region = {sql_str(location)}, "
                f"city = {sql_str(city)}, "
                f"state = {sql_str(state)}, "
                f"updated_at = '{now}', "
                f"updated_by = 'system' "
                f"WHERE id = '{d1_id}';"
            )
        else:
            # INSERT new community — use encasa_short_name or prop_name as display name
            created += 1
            new_id = str(uuid.uuid4())
            display_name = encasa_short or prop_name

            insert_lines.append(
                f"INSERT INTO communities "
                f"(id, name, external_key, region, status, "
                f"manager_name, unit_count, ga4_property_id, full_url, "
                f"encasa_short_name, encasa_property_code, city, state, "
                f"created_at, created_by, updated_at, updated_by) "
                f"VALUES ("
                f"'{new_id}', {sql_str(display_name)}, {sql_str(prop_id)}, {sql_str(location)}, 'active', "
                f"{sql_str(manager)}, {sql_int(unit_count)}, {sql_str(prop_id)}, {sql_str(full_url)}, "
                f"{sql_str(encasa_short)}, {sql_str(gc_code)}, {sql_str(city)}, {sql_str(state)}, "
                f"'{now}', 'system', '{now}', 'system');"
            )
            unmatched.append(f"  NEW: {display_name} (canonical: {prop_name})")

    conn.close()

    # Write SQL files
    update_file = out_dir / "03_update_communities.sql"
    update_file.write_text("\n".join(update_lines) + "\n")

    insert_file = out_dir / "04_insert_communities.sql"
    insert_file.write_text("\n".join(insert_lines) + "\n")

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"  Matched & will update: {matched}")
    print(f"  New communities to create: {created}")
    print(f"\n  New communities:")
    for u in sorted(unmatched):
        print(u)

    print(f"\nWrote: {update_file}")
    print(f"Wrote: {insert_file}")
    print(f"\nNext steps:")
    print(f"  1. npx wrangler d1 execute pop-brief-db --remote --file={update_file}")
    print(f"  2. npx wrangler d1 execute pop-brief-db --remote --file={insert_file}")


if __name__ == "__main__":
    main()
