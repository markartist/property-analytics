#!/usr/bin/env python3
"""Export a detailed ApartmentIQ full-dive package from local Pond rows."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUTPUT_ROOT = ROOT / "reports" / "apartmentiq"

MARKET_FIELDS = [
    "collection_date",
    "comp_set_id",
    "subject_property",
    "property_id",
    "community_id",
    "apartmentiq_property_id",
    "property_name",
    "management_company_name",
    "address",
    "city",
    "state",
    "zip_code",
    "distance",
    "year_built",
    "total_units",
    "avg_rent",
    "avg_sq_ft",
    "avg_rent_per_sq_ft",
    "exposure_current",
    "exposure_next_30_days",
    "exposure_next_60_days",
    "leased_percent",
    "advertised_occupancy_percent",
    "concession_percentage",
    "cancelled_applications_percentage_last_30_days",
    "review_average_rating",
    "review_count",
]

FEE_KEYS = [
    "admin",
    "application",
    "deposit",
    "parking_fees",
    "parking_garage",
    "parking_surface_lot",
    "parking_carport",
    "pet_deposit",
    "pet_fee",
    "pet_rent",
    "storage",
]

UNIT_TYPE_KEYS = [
    "available_units_count",
    "leased_units_count",
    "vacant_units_count",
    "days_on_market_avg",
    "rent_avg",
    "rent_per_sq_ft_avg",
    "ner_avg",
    "ner_per_sq_ft_avg",
    "concession_avg",
    "concession_percentage_avg",
]

NOTABLE_AMENITIES = [
    "Access Gates (Driving)",
    "Assigned Parking",
    "Community Parking Garage",
    "Covered Parking",
    "Detached Garages",
    "EV Charging",
    "Elevator",
    "Furnished Available",
    "Fitness Center",
    "Pool",
    "Business Center",
    "Clubhouse/Lounge",
    "Controlled Access",
    "Courtesy Patrol",
]


def value_as_number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def pct(value: Any) -> str:
    number = value_as_number(value)
    if number is None:
        return "n/a"
    if abs(number) <= 1:
        number *= 100
    return f"{number:.1f}%"


def money(value: Any) -> str:
    number = value_as_number(value)
    if number is None:
        return "n/a"
    return f"${number:,.0f}"


def num(value: Any, digits: int = 1) -> str:
    number = value_as_number(value)
    if number is None:
        return "n/a"
    return f"{number:,.{digits}f}"


def parse_json(raw: Any) -> Any:
    if not raw:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(str(raw))
    except (TypeError, ValueError):
        return None


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def latest_collection_date(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT MAX(collection_date) AS d FROM apartmentiq_market_survey_items").fetchone()
    if not row or not row["d"]:
        raise RuntimeError("No ApartmentIQ market survey rows found")
    return str(row["d"])


def complete_peer_row(row: dict[str, Any]) -> bool:
    if row.get("subject_property"):
        return False
    if str(row.get("apartmentiq_property_id") or "").lower() == "comp_average":
        return False
    required_nonzero = ("avg_rent", "avg_rent_per_sq_ft", "review_average_rating")
    if any((value_as_number(row.get(field)) or 0) <= 0 for field in required_nonzero):
        return False
    return all(value_as_number(row.get(field)) is not None for field in ("exposure_current", "concession_percentage"))


def summarize_offer(row: dict[str, Any]) -> dict[str, Any]:
    concession = parse_json(row.get("concessions_json"))
    if not concession:
        return {
            "listed_offer": "No active offer listed",
            "offer_restrictions": "",
            "offer_expires": "",
            "offer_started": "",
            "offer_type": "",
            "offer_value": "",
        }

    display_text = str(concession.get("display_text") or "").strip()
    lines = [line.strip() for line in display_text.splitlines() if line.strip()]
    restrictions: list[str] = []
    started = ""
    offer_type = ""
    offer_value = ""
    for bucket in ("rent_concessions", "non_rent_concessions"):
        for item in concession.get(bucket, []) or []:
            restrictions.extend(str(value) for value in item.get("restrictions", []) if value)
            started = started or str(item.get("started_on_date") or "")
            offer_type = offer_type or str(item.get("subject") or bucket.replace("_", " "))
            offer_value = offer_value or str(item.get("type_value") or "")
    if not restrictions:
        restrictions = [line.replace("Restrictions:", "").strip() for line in lines[1:] if "restriction" in line.lower()]

    expires = str(concession.get("expires_at") or "")
    if expires:
        try:
            expires = datetime.fromisoformat(expires.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            pass

    return {
        "listed_offer": lines[0] if lines else "Offer listed",
        "offer_restrictions": "; ".join(dict.fromkeys(restrictions)),
        "offer_expires": expires,
        "offer_started": started,
        "offer_type": offer_type,
        "offer_value": offer_value,
    }


def market_rows(conn: sqlite3.Connection, collection_date: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in conn.execute(
        """
        SELECT *
        FROM apartmentiq_market_survey_items
        WHERE collection_date = ?
        ORDER BY comp_set_id, subject_property DESC, distance IS NULL, distance, property_name
        """,
        (collection_date,),
    ):
        item = dict(row)
        item.update(summarize_offer(item))
        item["complete_peer_row"] = complete_peer_row(item)
        rows.append(item)
    return rows


def offer_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "collection_date": row.get("collection_date"),
            "comp_set_id": row.get("comp_set_id"),
            "subject_property": row.get("subject_property"),
            "property_name": row.get("property_name"),
            "apartmentiq_property_id": row.get("apartmentiq_property_id"),
            "concession_percentage": row.get("concession_percentage"),
            "listed_offer": row.get("listed_offer"),
            "offer_restrictions": row.get("offer_restrictions"),
            "offer_expires": row.get("offer_expires"),
            "offer_started": row.get("offer_started"),
            "offer_type": row.get("offer_type"),
            "offer_value": row.get("offer_value"),
        }
        for row in rows
        if row.get("listed_offer") and row.get("listed_offer") != "No active offer listed"
    ]


def fee_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for row in rows:
        fees = parse_json(row.get("fees_and_deposits_json")) or {}
        for key in FEE_KEYS:
            value = fees.get(key)
            if isinstance(value, dict):
                output.append(
                    {
                        "collection_date": row.get("collection_date"),
                        "comp_set_id": row.get("comp_set_id"),
                        "property_name": row.get("property_name"),
                        "apartmentiq_property_id": row.get("apartmentiq_property_id"),
                        "fee_key": key,
                        "title": value.get("title"),
                        "description": value.get("description"),
                        "min": value.get("min"),
                        "max": value.get("max"),
                    }
                )
            elif value:
                output.append(
                    {
                        "collection_date": row.get("collection_date"),
                        "comp_set_id": row.get("comp_set_id"),
                        "property_name": row.get("property_name"),
                        "apartmentiq_property_id": row.get("apartmentiq_property_id"),
                        "fee_key": key,
                        "title": key,
                        "description": value,
                        "min": "",
                        "max": "",
                    }
                )
    return output


def amenity_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for row in rows:
        amenities = parse_json(row.get("amenities_json")) or {}
        for name, present in sorted(amenities.items()):
            output.append(
                {
                    "collection_date": row.get("collection_date"),
                    "comp_set_id": row.get("comp_set_id"),
                    "property_name": row.get("property_name"),
                    "apartmentiq_property_id": row.get("apartmentiq_property_id"),
                    "amenity": name,
                    "present": bool(present),
                }
            )
    return output


def unit_type_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for row in rows:
        raw = parse_json(row.get("raw_json")) or {}
        unit_types = set()
        for key in UNIT_TYPE_KEYS:
            values = raw.get(f"by_unit_type_{key}")
            if isinstance(values, dict):
                unit_types.update(values.keys())
        concessions = raw.get("by_unit_type_concessions")
        if isinstance(concessions, dict):
            unit_types.update(concessions.keys())
        for unit_type in sorted(unit_types):
            item = {
                "collection_date": row.get("collection_date"),
                "comp_set_id": row.get("comp_set_id"),
                "subject_property": row.get("subject_property"),
                "property_name": row.get("property_name"),
                "apartmentiq_property_id": row.get("apartmentiq_property_id"),
                "unit_type": unit_type,
            }
            for key in UNIT_TYPE_KEYS:
                values = raw.get(f"by_unit_type_{key}")
                item[key] = values.get(unit_type) if isinstance(values, dict) else ""
            concession_value = concessions.get(unit_type) if isinstance(concessions, dict) else None
            parsed_offer = summarize_offer({"concessions_json": json.dumps(concession_value) if concession_value else None})
            item.update(parsed_offer)
            output.append(item)
    return output


def notable_amenities(row: dict[str, Any]) -> str:
    amenities = parse_json(row.get("amenities_json")) or {}
    present = [name for name in NOTABLE_AMENITIES if amenities.get(name)]
    return ", ".join(present[:8]) if present else "None listed from notable set"


def write_markdown(path: Path, rows: list[dict[str, Any]], artifacts: dict[str, str]) -> None:
    subjects = [row for row in rows if row.get("subject_property")]
    lines = [
        f"# ApartmentIQ Full Dive - {rows[0]['collection_date'] if rows else date.today().isoformat()}",
        "",
        "ApartmentIQ is advisory market/comps intelligence. Internal Pond sources remain authoritative for operating, occupancy, availability, guest-card, BI, and GA4 facts.",
        "",
        "## Artifact Files",
        "",
    ]
    for label, file_path in artifacts.items():
        lines.append(f"- {label}: `{file_path}`")
    lines.extend(["", "## Coverage", ""])
    lines.append(f"- Market survey rows: {len(rows)}")
    lines.append(f"- Comp sets in current local snapshot: {len({row['comp_set_id'] for row in rows})}")
    lines.append(f"- Subject rows: {len(subjects)}")
    lines.append(f"- Complete peer rows: {sum(1 for row in rows if row.get('complete_peer_row'))}")
    lines.append("")

    for subject in subjects:
        comp_set_id = subject["comp_set_id"]
        peers = [row for row in rows if row["comp_set_id"] == comp_set_id and not row.get("subject_property") and str(row.get("apartmentiq_property_id")).lower() != "comp_average"]
        complete = [row for row in peers if row.get("complete_peer_row")]
        active_offers = [row for row in peers if row.get("listed_offer") and row.get("listed_offer") != "No active offer listed"]
        lines.extend(
            [
                f"## {subject.get('property_name')} / Comp Set `{comp_set_id}`",
                "",
                f"- Governed property id: {subject.get('property_id') or 'unmapped'}",
                f"- ApartmentIQ property id: {subject.get('apartmentiq_property_id')}",
                f"- Avg rent: {money(subject.get('avg_rent'))}",
                f"- Rent/SF: {num(subject.get('avg_rent_per_sq_ft'), 2)}",
                f"- Current exposure: {pct(subject.get('exposure_current'))}",
                f"- Next 30 exposure: {pct(subject.get('exposure_next_30_days'))}",
                f"- Market leased estimate: {pct(subject.get('leased_percent'))}",
                f"- Listed concession: {pct(subject.get('concession_percentage'))}",
                f"- Review rating/count: {num(subject.get('review_average_rating'), 1)} / {subject.get('review_count') or 'n/a'}",
                f"- Peers: {len(peers)} total, {len(complete)} complete display rows",
                f"- Peer active offers: {len(active_offers)}",
                f"- Notable amenities: {notable_amenities(subject)}",
                "",
                "### Peer Snapshot",
                "",
                "| Peer | Rent | $/SF | Exposure | Market Leased | Listed Offer | Rating | Complete Row |",
                "| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |",
            ]
        )
        for peer in peers:
            offer = peer.get("listed_offer") or "No active offer listed"
            if peer.get("offer_restrictions"):
                offer += f" ({peer['offer_restrictions']})"
            lines.append(
                "| "
                + " | ".join(
                    [
                        str(peer.get("property_name") or ""),
                        money(peer.get("avg_rent")),
                        num(peer.get("avg_rent_per_sq_ft"), 2),
                        pct(peer.get("exposure_current")),
                        pct(peer.get("leased_percent")),
                        offer.replace("|", "/"),
                        num(peer.get("review_average_rating"), 1),
                        "yes" if peer.get("complete_peer_row") else "no",
                    ]
                )
                + " |"
            )
        lines.append("")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def export_full_dive(db_path: Path, output_root: Path, collection_date: str | None = None) -> dict[str, Any]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        collection_date = collection_date or latest_collection_date(conn)
        rows = market_rows(conn, collection_date)

    output_dir = output_root / collection_date / "full_dive"
    output_dir.mkdir(parents=True, exist_ok=True)

    market_path = output_dir / f"apartmentiq_market_survey_full_{collection_date}.csv"
    offers_path = output_dir / f"apartmentiq_listed_offers_{collection_date}.csv"
    fees_path = output_dir / f"apartmentiq_fees_deposits_{collection_date}.csv"
    amenities_path = output_dir / f"apartmentiq_amenities_{collection_date}.csv"
    unit_type_path = output_dir / f"apartmentiq_unit_type_metrics_{collection_date}.csv"
    markdown_path = output_dir / f"apartmentiq_full_dive_{collection_date}.md"
    json_path = output_dir / f"apartmentiq_full_dive_manifest_{collection_date}.json"

    market_fieldnames = MARKET_FIELDS + [
        "complete_peer_row",
        "listed_offer",
        "offer_restrictions",
        "offer_expires",
        "offer_started",
        "offer_type",
        "offer_value",
    ]
    offer_fieldnames = [
        "collection_date",
        "comp_set_id",
        "subject_property",
        "property_name",
        "apartmentiq_property_id",
        "concession_percentage",
        "listed_offer",
        "offer_restrictions",
        "offer_expires",
        "offer_started",
        "offer_type",
        "offer_value",
    ]
    fee_fieldnames = [
        "collection_date",
        "comp_set_id",
        "property_name",
        "apartmentiq_property_id",
        "fee_key",
        "title",
        "description",
        "min",
        "max",
    ]
    amenity_fieldnames = [
        "collection_date",
        "comp_set_id",
        "property_name",
        "apartmentiq_property_id",
        "amenity",
        "present",
    ]
    unit_type_fieldnames = [
        "collection_date",
        "comp_set_id",
        "subject_property",
        "property_name",
        "apartmentiq_property_id",
        "unit_type",
        *UNIT_TYPE_KEYS,
        "listed_offer",
        "offer_restrictions",
        "offer_expires",
        "offer_started",
        "offer_type",
        "offer_value",
    ]

    offers = offer_rows(rows)
    fees = fee_rows(rows)
    amenities = amenity_rows(rows)
    unit_types = unit_type_rows(rows)

    write_csv(market_path, rows, market_fieldnames)
    write_csv(offers_path, offers, offer_fieldnames)
    write_csv(fees_path, fees, fee_fieldnames)
    write_csv(amenities_path, amenities, amenity_fieldnames)
    write_csv(unit_type_path, unit_types, unit_type_fieldnames)

    artifacts = {
        "summary_markdown": str(markdown_path),
        "market_survey_csv": str(market_path),
        "listed_offers_csv": str(offers_path),
        "fees_deposits_csv": str(fees_path),
        "amenities_csv": str(amenities_path),
        "unit_type_metrics_csv": str(unit_type_path),
        "manifest_json": str(json_path),
    }
    write_markdown(markdown_path, rows, artifacts)

    manifest = {
        "generated_date": date.today().isoformat(),
        "collection_date": collection_date,
        "authority_note": "ApartmentIQ is advisory market/comps intelligence. Internal Pond sources remain authoritative.",
        "counts": {
            "market_survey_rows": len(rows),
            "comp_sets": len({row["comp_set_id"] for row in rows}),
            "subject_rows": sum(1 for row in rows if row.get("subject_property")),
            "complete_peer_rows": sum(1 for row in rows if row.get("complete_peer_row")),
            "listed_offer_rows": len(offers),
            "fee_rows": len(fees),
            "amenity_rows": len(amenities),
            "unit_type_rows": len(unit_types),
        },
        "artifacts": artifacts,
    }
    json_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Export detailed ApartmentIQ full-dive artifacts.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--output-root", default=str(OUTPUT_ROOT))
    parser.add_argument("--collection-date")
    args = parser.parse_args()
    manifest = export_full_dive(Path(args.db), Path(args.output_root), args.collection_date)
    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
