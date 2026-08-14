#!/usr/bin/env python3
"""Build the portfolio Resi source phone/email lookup from ThirtyLines."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path("/Users/mark/Property_Analytics")
sys.path.insert(0, str(ROOT))

from Data_Collection.collectors.thirtylines_collector import ThirtyLinesCollector
from Data_Collection.utils.property_identity import load_property_identities


DEFAULT_DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "resi_source_lookup"
SHARED_PROPERTY_HOSTS = {"venterraliving.com", "www.venterraliving.com"}
WEBSITE_DEFAULT_MARKETING_SOURCE = "VWS"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="SQLite Pond mirror path.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for JSON/CSV artifacts.")
    parser.add_argument("--external-source-field", default="id", help="Incoming URL parameter name.")
    parser.add_argument("--refresh-feed", action="store_true", help="Fetch a fresh ThirtyLines snapshot before building.")
    parser.add_argument("--run-id", help="Optional stable run id.")
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def hostname_variants(host: str | None) -> list[str]:
    host = (host or "").lower().strip()
    if not host:
        return []
    hosts = [host]
    if host.startswith("www."):
        hosts.append(host[4:])
    else:
        hosts.append(f"www.{host}")
    return sorted(set(hosts))


def hostnames_for_url(website_url: str | None) -> list[str]:
    if not website_url:
        return []
    host = urlparse(website_url).netloc.lower().strip()
    if not host or host in SHARED_PROPERTY_HOSTS:
        return []
    return hostname_variants(host)


def url_prefix_for_url(website_url: str | None) -> str | None:
    if not website_url:
        return None
    parsed = urlparse(website_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    path = parsed.path or "/"
    if not path.endswith("/"):
        path += "/"
    return f"{parsed.scheme}://{parsed.netloc.lower()}{path}"


def ensure_schema(conn: sqlite3.Connection) -> None:
    migration = ROOT / "apps" / "api" / "migrations" / "0062_create_resi_source_lookup_tables.sql"
    conn.executescript(migration.read_text(encoding="utf-8"))
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(resi_source_phone_lookup)").fetchall()}
    optional_columns = {
        "default_tracking_id": "TEXT",
        "default_marketing_source_cd": "TEXT",
        "default_phone_source": "TEXT",
        "default_email_source": "TEXT",
        "url_prefixes_json": "TEXT",
    }
    for column, definition in optional_columns.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE resi_source_phone_lookup ADD COLUMN {column} {definition}")


def latest_feed_snapshot(conn: sqlite3.Connection) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    row = conn.execute(
        """
        SELECT snapshot_id, snapshot_date, fetched_at, feed_url, payload_sha256, raw_payload_json
        FROM thirtylines_feed_snapshots
        ORDER BY snapshot_date DESC, snapshot_id DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        raise RuntimeError("No ThirtyLines feed snapshot found. Run with --refresh-feed or collect ThirtyLines first.")
    payload = json.loads(row["raw_payload_json"])
    properties = payload if isinstance(payload, list) else payload.get("properties", [])
    snapshot = {
        "snapshot_id": row["snapshot_id"],
        "snapshot_date": row["snapshot_date"],
        "fetched_at": row["fetched_at"],
        "feed_url": row["feed_url"],
        "payload_sha256": row["payload_sha256"],
    }
    return snapshot, [item for item in properties if isinstance(item, dict)]


def identity_by_property_code() -> dict[str, Any]:
    return {
        str(identity.property_code).strip(): identity
        for identity in load_property_identities()
        if identity.property_code
    }


def load_edge_manifest_overrides() -> dict[str, dict[str, list[str]]]:
    overrides: dict[str, dict[str, list[str]]] = {}
    for path in (ROOT / "config" / "portfolio_resi_edge_stabilization").glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        property_code = clean((data.get("property") or {}).get("propertyCode"))
        if not property_code:
            continue
        entry = overrides.setdefault(property_code, {"hostnames": [], "url_prefixes": []})
        for host in data.get("hostnames") or []:
            entry["hostnames"].extend(hostname_variants(str(host)))
        canonical = ((data.get("metadata") or {}).get("canonicalHref") or (data.get("observedBaseline") or {}).get("finalUrl"))
        prefix = url_prefix_for_url(canonical)
        if prefix:
            entry["url_prefixes"].append(prefix)
    return overrides


def load_official_url_overrides(identities: dict[str, Any]) -> dict[str, dict[str, list[str]]]:
    path = ROOT / "config" / "venterra_properties_official.json"
    if not path.exists():
        return {}
    by_ga4 = {identity.ga4_property_id: identity for identity in identities.values() if identity.ga4_property_id}
    overrides: dict[str, dict[str, list[str]]] = {}
    data = json.loads(path.read_text(encoding="utf-8"))
    for row in data.get("properties") or []:
        identity = by_ga4.get(str(row.get("ga4_property_id") or ""))
        if not identity:
            continue
        entry = overrides.setdefault(identity.property_code, {"hostnames": [], "url_prefixes": []})
        full_url = clean(row.get("full_url"))
        prefix = url_prefix_for_url(full_url)
        if prefix:
            entry["url_prefixes"].append(prefix)
        domain = clean(row.get("domain"))
        if domain and domain.lower() not in SHARED_PROPERTY_HOSTS:
            entry["hostnames"].extend(hostname_variants(domain))
    return overrides


def merge_overrides(*items: dict[str, dict[str, list[str]]]) -> dict[str, dict[str, list[str]]]:
    merged: dict[str, dict[str, list[str]]] = {}
    for item in items:
        for property_code, values in item.items():
            entry = merged.setdefault(property_code, {"hostnames": [], "url_prefixes": []})
            entry["hostnames"].extend(values.get("hostnames") or [])
            entry["url_prefixes"].extend(values.get("url_prefixes") or [])
    for values in merged.values():
        values["hostnames"] = sorted(set(values["hostnames"]))
        values["url_prefixes"] = sorted(set(values["url_prefixes"]))
    return merged


def website_default_tracking_code(prop: dict[str, Any]) -> dict[str, Any] | None:
    tracking_codes = [code for code in (prop.get("trackingCodes") or []) if isinstance(code, dict)]
    for code in tracking_codes:
        if clean(code.get("marketingSourceCd")) == WEBSITE_DEFAULT_MARKETING_SOURCE:
            return code
    for code in tracking_codes:
        tracking_id = clean(code.get("trackingId")) or ""
        if tracking_id.endswith("30L"):
            return code
    return None


def build_rows(
    feed_properties: list[dict[str, Any]],
    identities: dict[str, Any],
    hostname_overrides: dict[str, dict[str, list[str]]],
    snapshot: dict[str, Any],
    external_source_field: str,
    run_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for prop in feed_properties:
        property_code = clean(prop.get("id"))
        if not property_code:
            warnings.append({"warning": "feed_property_missing_id", "feed_name": prop.get("name")})
            continue

        identity = identities.get(property_code)
        identity_status = "resolved" if identity else "feed_only"
        if not identity:
            warnings.append(
                {
                    "warning": "identity_not_resolved",
                    "property_code": property_code,
                    "feed_property_name": prop.get("name"),
                }
            )

        website_url = identity.website_url if identity else None
        overrides = hostname_overrides.get(property_code, {"hostnames": [], "url_prefixes": []})
        hostnames = sorted(set(hostnames_for_url(website_url) + overrides.get("hostnames", [])))
        url_prefixes = sorted(
            set([value for value in [url_prefix_for_url(website_url)] if value] + overrides.get("url_prefixes", []))
        )
        default_code = website_default_tracking_code(prop)
        default_tracking_id = clean((default_code or {}).get("trackingId"))
        default_marketing_source_cd = clean((default_code or {}).get("marketingSourceCd"))
        default_phone = clean((default_code or {}).get("phoneNumber"))
        default_email = clean((default_code or {}).get("email"))
        fallback_phone = default_phone
        fallback_email = default_email
        default_phone_source = "trackingCodes.VWS" if default_phone else None
        default_email_source = "trackingCodes.VWS" if default_email else None
        if not default_phone:
            warnings.append(
                {
                    "warning": "missing_vws_default_phone",
                    "property_code": property_code,
                    "feed_property_name": prop.get("name"),
                    "fallback_phone_source": None,
                }
            )

        tracking_codes = prop.get("trackingCodes") or []
        if not tracking_codes:
            warnings.append({"warning": "no_tracking_codes", "property_code": property_code})

        for tracking_code in tracking_codes:
            if not isinstance(tracking_code, dict):
                continue
            tracking_id = clean(tracking_code.get("trackingId"))
            if not tracking_id:
                warnings.append({"warning": "tracking_code_missing_tracking_id", "property_code": property_code})
                continue

            source_phone = clean(tracking_code.get("phoneNumber"))
            source_email = clean(tracking_code.get("email"))
            rows.append(
                {
                    "property_code": property_code,
                    "tracking_id": tracking_id,
                    "external_source_field": external_source_field,
                    "marketing_source_cd": clean(tracking_code.get("marketingSourceCd")),
                    "source_phone": source_phone,
                    "source_email": source_email,
                    "fallback_phone": fallback_phone,
                    "fallback_email": fallback_email,
                    "default_tracking_id": default_tracking_id,
                    "default_marketing_source_cd": default_marketing_source_cd,
                    "default_phone_source": default_phone_source,
                    "default_email_source": default_email_source,
                    "concierge_phone": clean(prop.get("conciergePhone")),
                    "property_name": identity.property_name if identity else clean(prop.get("name")),
                    "canonical_property_id": identity.canonical_property_id if identity else None,
                    "ga4_property_id": identity.ga4_property_id if identity else None,
                    "community_id": identity.community_id if identity else None,
                    "website_url": website_url,
                    "hostnames_json": json_compact(hostnames),
                    "url_prefixes_json": json_compact(url_prefixes),
                    "feed_property_id": property_code,
                    "feed_property_name": clean(prop.get("name")),
                    "feed_snapshot_id": snapshot["snapshot_id"],
                    "feed_snapshot_date": snapshot["snapshot_date"],
                    "feed_fetched_at": snapshot["fetched_at"],
                    "feed_payload_sha256": snapshot["payload_sha256"],
                    "source_has_phone": 1 if source_phone else 0,
                    "source_has_email": 1 if source_email else 0,
                    "identity_status": identity_status,
                    "is_active": 1,
                    "raw_tracking_code_json": json_compact(tracking_code),
                    "run_id": run_id,
                }
            )

    return rows, warnings


def upsert_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> int:
    columns = [
        "property_code",
        "tracking_id",
        "external_source_field",
        "marketing_source_cd",
        "source_phone",
        "source_email",
        "fallback_phone",
        "fallback_email",
        "default_tracking_id",
        "default_marketing_source_cd",
        "default_phone_source",
        "default_email_source",
        "concierge_phone",
        "property_name",
        "canonical_property_id",
        "ga4_property_id",
        "community_id",
        "website_url",
        "hostnames_json",
        "url_prefixes_json",
        "feed_property_id",
        "feed_property_name",
        "feed_snapshot_id",
        "feed_snapshot_date",
        "feed_fetched_at",
        "feed_payload_sha256",
        "source_has_phone",
        "source_has_email",
        "identity_status",
        "is_active",
        "raw_tracking_code_json",
        "run_id",
    ]
    placeholders = ",".join("?" for _ in columns)
    update_columns = [col for col in columns if col not in {"property_code", "tracking_id"}]
    update_sql = ", ".join(f"{col}=excluded.{col}" for col in update_columns)
    sql = f"""
        INSERT INTO resi_source_phone_lookup ({",".join(columns)}, created_at, updated_at)
        VALUES ({placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(property_code, tracking_id) DO UPDATE SET
            {update_sql},
            updated_at=CURRENT_TIMESTAMP
    """
    conn.executemany(sql, [[row[col] for col in columns] for row in rows])
    return len(rows)


def kv_payload(rows: list[dict[str, Any]], snapshot: dict[str, Any], generated_at: str, external_source_field: str) -> dict[str, Any]:
    by_property: dict[str, Any] = {}
    by_hostname: dict[str, str] = {}
    by_url_prefix: dict[str, str] = {}
    by_tracking_id: dict[str, Any] = {}

    for row in rows:
        prop = by_property.setdefault(
            row["property_code"],
            {
                "propertyCode": row["property_code"],
                "propertyName": row["property_name"],
                "websiteUrl": row["website_url"],
                "hostnames": json.loads(row["hostnames_json"] or "[]"),
                "urlPrefixes": json.loads(row["url_prefixes_json"] or "[]"),
                "fallbackPhone": row["fallback_phone"],
                "fallbackEmail": row["fallback_email"],
                "defaultTrackingId": row["default_tracking_id"],
                "defaultMarketingSourceCd": row["default_marketing_source_cd"],
                "externalSourceField": row["external_source_field"],
                "sources": {},
            },
        )
        for host in prop["hostnames"]:
            by_hostname[host] = row["property_code"]
        for prefix in prop["urlPrefixes"]:
            by_url_prefix[prefix] = row["property_code"]
        source = {
            "trackingId": row["tracking_id"],
            "marketingSourceCd": row["marketing_source_cd"],
            "phone": row["source_phone"] or row["fallback_phone"],
            "email": row["source_email"] or row["fallback_email"],
            "sourcePhone": row["source_phone"],
            "sourceEmail": row["source_email"],
            "fallbackPhone": row["fallback_phone"],
            "fallbackEmail": row["fallback_email"],
            "hasSourcePhone": bool(row["source_has_phone"]),
            "hasSourceEmail": bool(row["source_has_email"]),
        }
        prop["sources"][row["tracking_id"]] = source
        by_tracking_id[row["tracking_id"]] = {
            "propertyCode": row["property_code"],
            **source,
        }

    return {
        "version": "2026-08-06.resi-source-lookup-v1",
        "generatedAt": generated_at,
        "source": "thirtylines_feed_snapshots.trackingCodes",
        "externalSourceField": external_source_field,
        "feedSnapshot": snapshot,
        "propertyCount": len(by_property),
        "sourceCount": len(by_tracking_id),
        "byHostname": by_hostname,
        "byUrlPrefix": by_url_prefix,
        "byProperty": by_property,
        "byTrackingId": by_tracking_id,
    }


def write_artifacts(output_dir: Path, run_id: str, rows: list[dict[str, Any]], kv: dict[str, Any], warnings: list[dict[str, Any]]) -> dict[str, str]:
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    kv_path = run_dir / "resi-source-lookup.kv.json"
    rows_path = run_dir / "resi-source-phone-lookup.rows.json"
    warnings_path = run_dir / "warnings.json"
    latest_path = output_dir / "latest-resi-source-lookup.kv.json"
    kv_path.write_text(json.dumps(kv, indent=2, ensure_ascii=False), encoding="utf-8")
    rows_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    warnings_path.write_text(json.dumps(warnings, indent=2, ensure_ascii=False), encoding="utf-8")
    latest_path.write_text(json.dumps(kv, indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "run_dir": str(run_dir),
        "kv_artifact_path": str(kv_path),
        "rows_artifact_path": str(rows_path),
        "warnings_path": str(warnings_path),
        "latest_kv_artifact_path": str(latest_path),
    }


def main() -> int:
    args = parse_args()
    db_path = Path(args.db)
    output_dir = Path(args.output_dir)

    if args.refresh_feed:
        ThirtyLinesCollector(db_path).ingest()

    generated_at = utc_now()
    run_base = args.run_id or generated_at.replace("-", "").replace(":", "").replace("Z", "Z")

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        ensure_schema(conn)
        snapshot, feed_properties = latest_feed_snapshot(conn)
        run_hash = hashlib.sha256(f"{snapshot['snapshot_id']}:{generated_at}".encode("utf-8")).hexdigest()[:12]
        run_id = run_base if args.run_id else f"resi_source_lookup_{run_hash}"
        identities = identity_by_property_code()
        hostname_overrides = merge_overrides(
            load_official_url_overrides(identities),
            load_edge_manifest_overrides(),
        )
        rows, warnings = build_rows(
            feed_properties=feed_properties,
            identities=identities,
            hostname_overrides=hostname_overrides,
            snapshot=snapshot,
            external_source_field=args.external_source_field,
            run_id=run_id,
        )
        rows_upserted = upsert_rows(conn, rows)
        kv = kv_payload(rows, snapshot, generated_at, args.external_source_field)
        artifacts = write_artifacts(output_dir, run_id, rows, kv, warnings)
        resolved_properties = len({row["property_code"] for row in rows if row["identity_status"] == "resolved"})
        feed_only_properties = len({row["property_code"] for row in rows if row["identity_status"] != "resolved"})
        conn.execute(
            """
            INSERT INTO resi_source_lookup_runs (
              run_id, feed_snapshot_id, feed_snapshot_date, feed_fetched_at, feed_url,
              feed_payload_sha256, generated_at, external_source_field, properties_seen,
              properties_resolved, properties_feed_only, tracking_codes_seen, rows_upserted,
              warnings_json, kv_artifact_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id) DO UPDATE SET
              tracking_codes_seen=excluded.tracking_codes_seen,
              rows_upserted=excluded.rows_upserted,
              warnings_json=excluded.warnings_json,
              kv_artifact_path=excluded.kv_artifact_path
            """,
            (
                run_id,
                snapshot["snapshot_id"],
                snapshot["snapshot_date"],
                snapshot["fetched_at"],
                snapshot["feed_url"],
                snapshot["payload_sha256"],
                generated_at,
                args.external_source_field,
                len(feed_properties),
                resolved_properties,
                feed_only_properties,
                len(rows),
                rows_upserted,
                json_compact(warnings),
                artifacts["kv_artifact_path"],
            ),
        )
        conn.commit()

    summary = {
        "run_id": run_id,
        "db_path": str(db_path),
        "feed_snapshot": snapshot,
        "properties_seen": len(feed_properties),
        "properties_resolved": resolved_properties,
        "properties_feed_only": feed_only_properties,
        "tracking_codes_seen": len(rows),
        "rows_upserted": rows_upserted,
        "warnings_count": len(warnings),
        **artifacts,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
