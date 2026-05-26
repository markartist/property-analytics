#!/usr/bin/env python3
"""Generate Captain-facing ApartmentIQ enrichment summaries from Pond rows."""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
OUTPUT_ROOT = ROOT / "reports" / "apartmentiq"


def pct(value: Any) -> str:
    if value is None:
        return "n/a"
    return f"{float(value) * 100:.1f}%"


def money(value: Any) -> str:
    if value is None:
        return "n/a"
    return f"${float(value):,.0f}"


def num(value: Any, digits: int = 1) -> str:
    if value is None:
        return "n/a"
    return f"{float(value):,.{digits}f}"


def delta(value: Any, baseline: Any) -> float | None:
    if value is None or baseline is None:
        return None
    return float(value) - float(baseline)


def latest_collection_date(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT MAX(collection_date) AS d FROM apartmentiq_market_survey_items").fetchone()
    if not row or not row["d"]:
        raise RuntimeError("No ApartmentIQ market survey rows found")
    return str(row["d"])


def subject_market_rows(conn: sqlite3.Connection, collection_date: str) -> list[dict[str, Any]]:
    rows = []
    for row in conn.execute(
        """
        SELECT subject.*, avg_row.avg_rent AS comp_avg_rent,
               avg_row.avg_rent_per_sq_ft AS comp_avg_rent_per_sq_ft,
               avg_row.exposure_current AS comp_exposure_current,
               avg_row.exposure_next_30_days AS comp_exposure_next_30_days,
               avg_row.leased_percent AS comp_leased_percent,
               avg_row.concession_percentage AS comp_concession_percentage,
               avg_row.review_average_rating AS comp_review_average_rating
        FROM apartmentiq_market_survey_items subject
        LEFT JOIN apartmentiq_market_survey_items avg_row
          ON avg_row.collection_date = subject.collection_date
         AND avg_row.comp_set_id = subject.comp_set_id
         AND avg_row.apartmentiq_property_id = 'comp_average'
        WHERE subject.collection_date = ?
          AND subject.subject_property = 1
          AND subject.property_id IS NOT NULL
        ORDER BY subject.property_id, subject.comp_set_id
        """,
        (collection_date,),
    ):
        item = dict(row)
        item["rent_delta_vs_comp"] = delta(item.get("avg_rent"), item.get("comp_avg_rent"))
        item["rent_psf_delta_vs_comp"] = delta(item.get("avg_rent_per_sq_ft"), item.get("comp_avg_rent_per_sq_ft"))
        item["exposure_delta_vs_comp"] = delta(item.get("exposure_current"), item.get("comp_exposure_current"))
        item["concession_delta_vs_comp"] = delta(item.get("concession_percentage"), item.get("comp_concession_percentage"))
        item["leased_delta_vs_comp"] = delta(item.get("leased_percent"), item.get("comp_leased_percent"))
        item["review_rating_delta_vs_comp"] = delta(item.get("review_average_rating"), item.get("comp_review_average_rating"))
        rows.append(item)
    return rows


def unit_summary(conn: sqlite3.Connection, collection_date: str, property_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT COUNT(*) AS units_seen,
               SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available_units,
               SUM(CASE WHEN status = 'Applied' THEN 1 ELSE 0 END) AS applied_units,
               SUM(CASE WHEN is_leased = 1 THEN 1 ELSE 0 END) AS leased_units,
               AVG(CASE WHEN status = 'Available' THEN days_on_market END) AS avg_available_dom,
               MAX(CASE WHEN status = 'Available' THEN days_on_market END) AS max_available_dom,
               SUM(CASE WHEN status = 'Available' AND days_on_market >= 60 THEN 1 ELSE 0 END) AS aged_available_units
        FROM apartmentiq_units
        WHERE collection_date = ?
          AND property_id = ?
        """,
        (collection_date, property_id),
    ).fetchone()
    return dict(row) if row else {}


def floorplan_summary(conn: sqlite3.Connection, collection_date: str, property_id: str) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in conn.execute(
            """
            SELECT floorplan_name, bedroom_count, bathroom_count, unit_count,
                   asking_rent, net_effective_rent, sqft, days_on_market
            FROM apartmentiq_floorplans
            WHERE collection_date = ?
              AND property_id = ?
              AND unit_count > 0
            ORDER BY unit_count DESC, days_on_market DESC
            LIMIT 10
            """,
            (collection_date, property_id),
        )
    ]


def write_summary(db_path: Path = DB_PATH, output_root: Path = OUTPUT_ROOT) -> dict[str, Any]:
    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        collection_date = latest_collection_date(conn)
        subjects = subject_market_rows(conn, collection_date)
        for subject in subjects:
            property_id = str(subject["property_id"])
            subject["unit_summary"] = unit_summary(conn, collection_date, property_id)
            subject["top_floorplans"] = floorplan_summary(conn, collection_date, property_id)

        counts = {
            table: conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]
            for table in (
                "apartmentiq_accounts",
                "apartmentiq_comp_sets",
                "apartmentiq_market_survey_items",
                "apartmentiq_units",
                "apartmentiq_floorplans",
                "apartmentiq_property_identity_links",
            )
        }

    payload = {
        "generated_date": date.today().isoformat(),
        "collection_date": collection_date,
        "counts": counts,
        "mapped_subjects": subjects,
        "authority_note": "ApartmentIQ is advisory market/comps enrichment; Data Pond source-of-record facts govern internal claims.",
    }

    output_dir = output_root / collection_date
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / f"apartmentiq_enrichment_summary_{collection_date}.json"
    md_path = output_dir / f"apartmentiq_enrichment_summary_{collection_date}.md"
    json_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    lines = [
        f"# ApartmentIQ Enrichment Summary - {collection_date}",
        "",
        "ApartmentIQ is advisory market/comps enrichment. Data Pond remains source of truth for internal operating, leasing, availability, guest-card, and BI claims.",
        "",
        "## Coverage",
        "",
        f"- Accounts: {counts['apartmentiq_accounts']}",
        f"- Comp sets: {counts['apartmentiq_comp_sets']}",
        f"- Market survey rows: {counts['apartmentiq_market_survey_items']}",
        f"- Unit rows: {counts['apartmentiq_units']}",
        f"- Floorplan rows: {counts['apartmentiq_floorplans']}",
        f"- Governed ApartmentIQ identity links: {counts['apartmentiq_property_identity_links']}",
        "",
        "## Mapped Subject Reads",
        "",
    ]
    if not subjects:
        lines.append("- No subject properties are currently mapped through the governed identity matrix.")
    for subject in subjects:
        unit = subject.get("unit_summary") or {}
        lines.extend(
            [
                f"### {subject['property_name']} / {subject['property_id']}",
                "",
                f"- Comp set: `{subject['comp_set_id']}`",
                f"- Avg rent: {money(subject.get('avg_rent'))} vs comp {money(subject.get('comp_avg_rent'))} ({money(subject.get('rent_delta_vs_comp'))} delta)",
                f"- Rent PSF: {num(subject.get('avg_rent_per_sq_ft'), 2)} vs comp {num(subject.get('comp_avg_rent_per_sq_ft'), 2)} ({num(subject.get('rent_psf_delta_vs_comp'), 2)} delta)",
                f"- Exposure: {pct(subject.get('exposure_current'))} vs comp {pct(subject.get('comp_exposure_current'))} ({pct(subject.get('exposure_delta_vs_comp'))} delta)",
                f"- Next 30 exposure: {pct(subject.get('exposure_next_30_days'))} vs comp {pct(subject.get('comp_exposure_next_30_days'))}",
                f"- Concession: {pct(subject.get('concession_percentage'))} vs comp {pct(subject.get('comp_concession_percentage'))}",
                f"- Leased percent: {pct(subject.get('leased_percent'))} vs comp {pct(subject.get('comp_leased_percent'))}",
                f"- Reviews: {num(subject.get('review_average_rating'), 1)} rating / {subject.get('review_count') or 'n/a'} reviews vs comp rating {num(subject.get('comp_review_average_rating'), 1)}",
                f"- Unit pulse: {unit.get('available_units') or 0} available, {unit.get('applied_units') or 0} applied, avg available DOM {num(unit.get('avg_available_dom'), 1)}, aged available 60+ DOM {unit.get('aged_available_units') or 0}",
                "",
            ]
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    payload["artifacts"] = {"json": str(json_path), "markdown": str(md_path)}
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate ApartmentIQ enrichment summary artifacts.")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--output-root", default=str(OUTPUT_ROOT))
    args = parser.parse_args()
    payload = write_summary(Path(args.db), Path(args.output_root))
    print(
        json.dumps(
            {
                "collection_date": payload["collection_date"],
                "counts": payload["counts"],
                "mapped_subject_count": len(payload["mapped_subjects"]),
                "artifacts": payload["artifacts"],
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
