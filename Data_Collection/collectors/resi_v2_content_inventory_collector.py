#!/usr/bin/env python3
"""Read-only Resi V2 content inventory collector for Data Pond.

The collector mirrors live Resi content into local Data Pond tables and labels
field-level editability. It does not perform Resi writes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import load_property_identities  # noqa: E402
from utils.resi_auth import resolve_resi_credentials  # noqa: E402

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0064_create_resi_content_inventory_tables.sql"
CORE_SNAPSHOT_MIGRATION_SQL = ROOT / "apps" / "api" / "migrations" / "0063_create_resi_v2_api_snapshots.sql"
API_BASE_URL = "https://v2.getresi.com/api/v2"


CONTENT_ENDPOINTS: tuple[dict[str, Any], ...] = (
    {"object_type": "amenity", "path": "/amenities"},
    {"object_type": "fee", "path": "/fees"},
    {"object_type": "review", "path": "/reviews"},
    {"object_type": "announcement", "path": "/announcements"},
    {"object_type": "content_block", "path": "/content-blocks", "nested_items_key": "content_items"},
    {"object_type": "faq", "path": "/faqs"},
    {"object_type": "gallery", "path": "/galleries"},
    {"object_type": "neighborhood_place", "path": "/neighborhood-places"},
    {"object_type": "media_file", "path": "/media", "params": {"kind": "file"}, "media_kind": "file"},
    {"object_type": "media_embed", "path": "/media", "params": {"kind": "embed"}, "media_kind": "embed"},
)

PROPERTY_LINK_RESOLUTION_TYPES = {
    "amenity",
    "fee",
    "announcement",
    "content_block",
    "faq",
    "gallery",
}


FIELD_RULES: dict[tuple[str, str], dict[str, str]] = {
    ("content_block", "title"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{id}", "notes": "Verify global/property scope before approval."},
    ("content_block", "subtitle"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{id}", "notes": "Verify global/property scope before approval."},
    ("content_block", "description"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{id}", "notes": "Preserve approved claims and proof source."},
    ("content_block", "is_enabled"): {"role": "publication_state", "editability": "publication_sensitive", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{id}", "notes": "Can hide or reveal live website content."},
    ("content_item", "title"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{parent_id}", "notes": "Nested item is owned through the parent content block payload."},
    ("content_item", "text"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/content-blocks/{parent_id}", "notes": "Nested item is owned through the parent content block payload."},
    ("announcement", "title"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/announcements/{id}", "notes": "Check active date window before approval."},
    ("announcement", "meta"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/announcements/{id}", "notes": "Short visible announcement copy."},
    ("announcement", "text"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/announcements/{id}", "notes": "Check active date window before approval."},
    ("announcement", "disclaimer"): {"role": "public_copy", "editability": "legal_sensitive_copy", "owner": "Content Office", "method": "PATCH", "path": "/announcements/{id}", "notes": "Disclaimer language needs explicit approval."},
    ("announcement", "is_enabled"): {"role": "publication_state", "editability": "publication_sensitive", "owner": "Content Office", "method": "PATCH", "path": "/announcements/{id}", "notes": "Can hide or reveal live website content."},
    ("faq", "question"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/faqs/{id}", "notes": "Maintain renter-language clarity."},
    ("faq", "answer"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/faqs/{id}", "notes": "Avoid unsupported policy claims."},
    ("gallery", "title"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/galleries/{id}", "notes": "Media membership deletion is not API-supported."},
    ("gallery", "text"): {"role": "public_copy", "editability": "safe_content_change", "owner": "Content Office", "method": "PATCH", "path": "/galleries/{id}", "notes": "Media membership deletion is not API-supported."},
    ("media_file", "caption"): {"role": "media_metadata", "editability": "media_global_asset_change", "owner": "Content Office", "method": "PATCH", "path": "/media/{id}", "notes": "File metadata applies everywhere the asset is attached."},
    ("media_file", "alt_text"): {"role": "media_accessibility", "editability": "media_global_asset_change", "owner": "Content Office", "method": "PATCH", "path": "/media/{id}", "notes": "File metadata applies everywhere the asset is attached."},
    ("media_embed", "title"): {"role": "media_metadata", "editability": "media_local_embed_change", "owner": "Content Office", "method": "PATCH", "path": "/media/{id}", "notes": "Embed metadata is local to the placement."},
    ("media_embed", "url"): {"role": "media_url", "editability": "media_local_embed_change", "owner": "Content Office", "method": "PATCH", "path": "/media/{id}", "notes": "Changing an embed URL changes what visitors can watch or tour."},
    ("neighborhood_place", "name"): {"role": "location_content", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/neighborhood-places/{id}", "notes": "Verify map/category context."},
    ("neighborhood_place", "url"): {"role": "location_link", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/neighborhood-places/{id}", "notes": "Verify destination before approval."},
    ("amenity", "name"): {"role": "amenity_content", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/amenities/{id}", "notes": "Verify property applicability."},
    ("amenity", "description"): {"role": "amenity_content", "editability": "safe_content_change", "owner": "Site Content", "method": "PATCH", "path": "/amenities/{id}", "notes": "Verify property applicability."},
    ("review", "text"): {"role": "reputation_content", "editability": "rights_sensitive", "owner": "Reputation / Content Office", "method": "PATCH", "path": "/reviews/{id}", "notes": "Review rights and source policy must be checked."},
    ("fee", "amount"): {"role": "operational_fact", "editability": "operational_sensitive", "owner": "Operations / PMS", "method": "PATCH", "path": "/fees/{id}", "notes": "Do not treat as marketing copy."},
}

DEFAULT_FIELD_PATHS = (
    "name",
    "internal_title",
    "title",
    "subtitle",
    "description",
    "meta",
    "text",
    "answer",
    "question",
    "disclaimer",
    "caption",
    "alt_text",
    "url",
    "is_enabled",
    "starts_at",
    "ends_at",
    "sort_order",
    "tags",
)


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def payload_sha256(value: Any) -> str:
    return hashlib.sha256(json_compact(value).encode("utf-8")).hexdigest()


def value_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    return json_compact(value)


def value_kind(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "text"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def count_present_links(row: dict[str, Any]) -> int:
    keys = ("url", "website_url", "link_url", "primary_link_url", "secondary_link_url", "virtual_tour_url")
    return sum(1 for key in keys if row.get(key))


def count_inline_media(row: dict[str, Any]) -> int:
    total = 0
    for key, value in row.items():
        if "media" in key or "image" in key or "video" in key or "tour" in key:
            if isinstance(value, list):
                total += len(value)
            elif value:
                total += 1
    return total


def first_text(row: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def bool_as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return 1 if value else 0
    return None


def row_id(row: dict[str, Any], fallback_prefix: str) -> str:
    value = row.get("id") or row.get("uuid") or row.get("reference_id")
    if value:
        return str(value)
    return f"{fallback_prefix}_{payload_sha256(row)[:16]}"


def extract_property_ids(row: dict[str, Any]) -> list[str]:
    found: list[str] = []
    if row.get("property_id"):
        found.append(str(row["property_id"]))
    if isinstance(row.get("property_ids"), list):
        found.extend(str(value) for value in row["property_ids"] if value)
    property_obj = row.get("property")
    if isinstance(property_obj, dict) and property_obj.get("id"):
        found.append(str(property_obj["id"]))
    deduped: list[str] = []
    for value in found:
        if value not in deduped:
            deduped.append(value)
    return deduped


@dataclass(frozen=True)
class PropertyContext:
    resi_property_id: str
    property_code: str | None
    community_id: str | None
    canonical_property_id: str | None
    identity_status: str


@dataclass
class ResiContentInventoryResult:
    run_id: str
    fetched_at: str
    account_id: str | None
    account_name: str | None
    properties_seen: int = 0
    properties_resolved: int = 0
    content_objects_seen: int = 0
    content_fields_seen: int = 0
    media_assets_seen: int = 0
    requests_made: int = 0
    warnings: list[dict[str, Any]] = field(default_factory=list)


class ResiV2ContentInventoryCollector:
    """Collect and normalize Resi content objects through Keeper-backed auth."""

    def __init__(
        self,
        db_path: Path = DB_PATH,
        base_url: str = API_BASE_URL,
        timeout_seconds: int = 45,
        max_retries: int = 2,
        rate_limit_sleep_seconds: float = 0.2,
    ) -> None:
        self.db_path = Path(db_path)
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.rate_limit_sleep_seconds = rate_limit_sleep_seconds
        self.session: requests.Session | None = None
        self.requests_made = 0

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        credentials = resolve_resi_credentials()
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": credentials.authorization_header,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "PropertyAnalytics-ResiContentInventory/1.0",
            }
        )
        self.session = session

    def _request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._ensure_session()
        assert self.session is not None
        url = f"{self.base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.get(url, params=params or {}, timeout=self.timeout_seconds)
                self.requests_made += 1
                if response.status_code == 429 and attempt < self.max_retries:
                    retry_after = response.headers.get("retry-after")
                    try:
                        delay = float(retry_after) if retry_after else 30.0
                    except ValueError:
                        delay = 30.0
                    time.sleep(delay)
                    continue
                if response.status_code == 401:
                    raise RuntimeError("Resi V2 token was rejected with 401; stopping without retry.")
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise RuntimeError(f"Unexpected Resi V2 response shape for {path}: {type(payload).__name__}")
                if self.rate_limit_sleep_seconds:
                    time.sleep(self.rate_limit_sleep_seconds)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
        raise RuntimeError(f"GET {path} failed: {last_error}") from last_error

    def _paginated_get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        label: str | None = None,
        verbose: bool = False,
        max_pages: int | None = None,
    ) -> Iterable[dict[str, Any]]:
        page = 1
        while True:
            if max_pages is not None and page > max_pages:
                if verbose:
                    print(f"[resi-content] {label or path}: stopped at max_pages={max_pages}", file=sys.stderr)
                break
            query = dict(params or {})
            query.setdefault("per_page", 200)
            query["page"] = page
            payload = self._request(path, params=query)
            rows = payload.get("data") or []
            if not isinstance(rows, list):
                raise RuntimeError(f"Unexpected Resi V2 collection shape for {path}.")
            if verbose:
                print(f"[resi-content] {label or path}: page {page}, rows {len(rows)}", file=sys.stderr)
            for row in rows:
                if isinstance(row, dict):
                    yield row

            meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
            last_page = meta.get("last_page")
            if last_page is not None:
                if page >= int(last_page):
                    break
                page += 1
                continue

            links = payload.get("links") if isinstance(payload.get("links"), dict) else {}
            if not links.get("next"):
                break
            page += 1

    def ensure_schema(self, conn: sqlite3.Connection) -> None:
        if CORE_SNAPSHOT_MIGRATION_SQL.exists():
            conn.executescript(CORE_SNAPSHOT_MIGRATION_SQL.read_text(encoding="utf-8"))
        conn.executescript(MIGRATION_SQL.read_text(encoding="utf-8"))

    @staticmethod
    def _account_context(me: dict[str, Any]) -> tuple[str | None, str | None]:
        data = me.get("data") if isinstance(me.get("data"), dict) else {}
        accounts = data.get("accounts") if isinstance(data.get("accounts"), list) else []
        if not accounts or not isinstance(accounts[0], dict):
            return None, None
        return accounts[0].get("id"), accounts[0].get("name")

    def _properties_from_latest_core_snapshot(self, conn: sqlite3.Connection) -> tuple[str | None, list[dict[str, Any]]]:
        row = conn.execute(
            "SELECT snapshot_id, raw_properties_json FROM resi_v2_api_snapshots ORDER BY fetched_at DESC LIMIT 1"
        ).fetchone()
        if not row:
            return None, []
        return str(row[0]), json.loads(row[1])

    def _property_contexts(self, properties: list[dict[str, Any]]) -> dict[str, PropertyContext]:
        identities = {identity.property_code: identity for identity in load_property_identities() if identity.property_code}
        contexts: dict[str, PropertyContext] = {}
        for row in properties:
            resi_id = row.get("id")
            if not resi_id:
                continue
            reference_id = row.get("reference_id")
            identity = identities.get(str(reference_id)) if reference_id else None
            status = "resolved" if identity else ("missing_reference_id" if not reference_id else "identity_not_resolved")
            contexts[str(resi_id)] = PropertyContext(
                resi_property_id=str(resi_id),
                property_code=identity.property_code if identity else (str(reference_id) if reference_id else None),
                community_id=identity.community_id if identity else None,
                canonical_property_id=identity.canonical_property_id if identity else None,
                identity_status=status,
            )
        return contexts

    def _primary_property_context(self, row: dict[str, Any], contexts: dict[str, PropertyContext]) -> PropertyContext | None:
        ids = extract_property_ids(row)
        for resi_property_id in ids:
            if resi_property_id in contexts:
                return contexts[resi_property_id]
        attachable_type = row.get("attachable_type")
        attachable_id = row.get("attachable_id")
        if attachable_type == "property" and attachable_id and str(attachable_id) in contexts:
            return contexts[str(attachable_id)]
        return None

    def _insert_object(
        self,
        conn: sqlite3.Connection,
        run_id: str,
        object_type: str,
        row: dict[str, Any],
        context: PropertyContext | None,
        parent_type: str | None = None,
        parent_id: str | None = None,
    ) -> str:
        object_id = row_id(row, object_type)
        conn.execute(
            """
            INSERT OR REPLACE INTO resi_content_objects (
              run_id, source_api, object_type, object_id, parent_object_type, parent_object_id,
              resi_property_id, property_code, community_id, canonical_property_id, identity_status,
              is_global, is_enabled, lifecycle_status, internal_title, public_title, public_subtitle,
              text_summary, media_type, link_count, media_count, sort_order, elements_key, tags_json,
              updated_at, raw_payload_sha256, raw_object_json
            ) VALUES (?, 'resi_v2', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'observed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                object_type,
                object_id,
                parent_type,
                parent_id,
                context.resi_property_id if context else row.get("property_id"),
                context.property_code if context else None,
                context.community_id if context else None,
                context.canonical_property_id if context else None,
                context.identity_status if context else "unknown",
                bool_as_int(row.get("is_global")),
                bool_as_int(row.get("is_enabled")),
                first_text(row, ("internal_title", "name")),
                first_text(row, ("title", "name", "question")),
                first_text(row, ("subtitle", "meta")),
                first_text(row, ("description", "text", "answer", "caption", "alt_text")),
                row.get("media_type") or row.get("embed_type") or row.get("type"),
                count_present_links(row),
                count_inline_media(row),
                row.get("sort_order") if isinstance(row.get("sort_order"), int) else None,
                row.get("elements_key"),
                json_compact(row.get("tags") if isinstance(row.get("tags"), list) else []),
                row.get("updated_at"),
                payload_sha256(row),
                json_compact(row),
            ),
        )
        return object_id

    def _insert_property_links(
        self,
        conn: sqlite3.Connection,
        run_id: str,
        object_type: str,
        object_id: str,
        row: dict[str, Any],
        contexts: dict[str, PropertyContext],
        inherited_contexts: list[PropertyContext] | None = None,
    ) -> None:
        link_contexts: list[PropertyContext] = []
        if inherited_contexts:
            link_contexts.extend(inherited_contexts)
        for resi_property_id in extract_property_ids(row):
            context = contexts.get(resi_property_id)
            if context:
                link_contexts.append(context)
        attachable_type = row.get("attachable_type")
        attachable_id = row.get("attachable_id")
        if attachable_type == "property" and attachable_id and str(attachable_id) in contexts:
            link_contexts.append(contexts[str(attachable_id)])

        seen: set[str] = set()
        for context in link_contexts:
            if context.resi_property_id in seen:
                continue
            seen.add(context.resi_property_id)
            conn.execute(
                """
                INSERT OR REPLACE INTO resi_content_property_links (
                  run_id, object_type, object_id, resi_property_id, property_code, community_id,
                  canonical_property_id, link_source, identity_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    object_type,
                    object_id,
                    context.resi_property_id,
                    context.property_code,
                    context.community_id,
                    context.canonical_property_id,
                    "property_ids" if row.get("property_ids") else "property_id_or_attachment",
                    context.identity_status,
                ),
            )

    def _insert_fields(
        self,
        conn: sqlite3.Connection,
        run_id: str,
        object_type: str,
        object_id: str,
        row: dict[str, Any],
        context: PropertyContext | None,
        parent_id: str | None = None,
    ) -> int:
        count = 0
        candidate_paths = sorted(set(DEFAULT_FIELD_PATHS).union(key for (typ, key) in FIELD_RULES if typ == object_type))
        for path in candidate_paths:
            if path not in row:
                continue
            value = row.get(path)
            text = value_text(value)
            rule = FIELD_RULES.get((object_type, path), {})
            update_path = rule.get("path")
            if update_path and parent_id:
                update_path = update_path.replace("{parent_id}", parent_id)
            conn.execute(
                """
                INSERT OR REPLACE INTO resi_content_fields (
                  run_id, object_type, object_id, field_path, field_role, field_value_kind,
                  field_value_text, field_value_sha256, property_code, community_id,
                  editability_class, owning_system, resi_update_method, resi_update_path_template,
                  safety_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    object_type,
                    object_id,
                    path,
                    rule.get("role", "vendor_field"),
                    value_kind(value),
                    text,
                    hashlib.sha256((text or "").encode("utf-8")).hexdigest() if text is not None else None,
                    context.property_code if context else None,
                    context.community_id if context else None,
                    rule.get("editability", "read_only_or_unmapped"),
                    rule.get("owner", "Data Pond"),
                    rule.get("method"),
                    update_path,
                    rule.get("notes", "Captured for visibility; not mapped to an approved edit lane yet."),
                ),
            )
            count += 1
        return count

    def _insert_default_bindings(
        self,
        conn: sqlite3.Connection,
        object_type: str,
        object_id: str,
        context: PropertyContext | None,
        now: str,
    ) -> None:
        systems: list[tuple[str, str, float, str]] = [
            ("content_office", "external_resi_content_object", 0.75, "Content Office can inspect and govern Resi content objects."),
            ("captain_navigator", "content_evidence", 0.55, "Navigator can use this as property-scoped content evidence."),
        ]
        if object_type in {"content_block", "content_item", "faq", "amenity", "neighborhood_place", "gallery"}:
            systems.append(("site_content", "external_content_section_or_asset", 0.65, "Site Content can map live Resi objects to site sections and rewrite work."))
        if object_type in {"content_block", "content_item", "faq", "announcement", "gallery", "amenity", "neighborhood_place", "media_file", "media_embed"}:
            systems.append(("vacs", "governed_content_input", 0.45, "VACS can consume the content fact after Pond grounding."))

        for internal_system, entity_type, confidence, rationale in systems:
            binding_id = hashlib.sha256(
                f"resi_v2:{object_type}:{object_id}:{internal_system}:{entity_type}".encode("utf-8")
            ).hexdigest()[:24]
            conn.execute(
                """
                INSERT OR IGNORE INTO pond_content_system_bindings (
                  binding_id, source_system, source_api, source_object_type, source_object_id,
                  source_field_path, property_code, community_id, internal_system,
                  internal_entity_type, internal_entity_id, binding_status, confidence,
                  rationale, created_by, created_at, updated_at
                ) VALUES (?, 'resi', 'resi_v2', ?, ?, NULL, ?, ?, ?, ?, NULL, 'candidate', ?, ?, 'resi_content_inventory_collector', ?, ?)
                """,
                (
                    binding_id,
                    object_type,
                    object_id,
                    context.property_code if context else None,
                    context.community_id if context else None,
                    internal_system,
                    entity_type,
                    confidence,
                    rationale,
                    now,
                    now,
                ),
            )

    def ingest(
        self,
        use_latest_core_snapshot: bool = False,
        include_media: bool = True,
        endpoint_names: set[str] | None = None,
        verbose: bool = False,
        max_pages_per_endpoint: int | None = None,
        resolve_property_links: bool = False,
    ) -> ResiContentInventoryResult:
        fetched_at = utc_timestamp()
        snapshot_date = date.today().isoformat()
        warnings: list[dict[str, Any]] = []
        endpoint_payloads: dict[str, Any] = {}

        with sqlite3.connect(self.db_path) as conn:
            self.ensure_schema(conn)
            source_snapshot_id: str | None = None
            me = self._request("/me")
            account_id, account_name = self._account_context(me)
            if use_latest_core_snapshot:
                source_snapshot_id, properties = self._properties_from_latest_core_snapshot(conn)
                if not properties:
                    warnings.append({"warning": "latest_core_snapshot_missing", "action": "fetched_properties_live"})
                    properties = list(
                        self._paginated_get(
                            "/properties",
                            label="properties",
                            verbose=verbose,
                            max_pages=max_pages_per_endpoint,
                        )
                    )
            else:
                properties = list(
                    self._paginated_get(
                        "/properties",
                        label="properties",
                        verbose=verbose,
                        max_pages=max_pages_per_endpoint,
                    )
                )

            property_contexts = self._property_contexts(properties)
            for prop in properties:
                rid = prop.get("id")
                if rid and str(rid) in property_contexts and property_contexts[str(rid)].identity_status != "resolved":
                    warnings.append(
                        {
                            "warning": property_contexts[str(rid)].identity_status,
                            "resi_property_id": str(rid),
                            "property_name": prop.get("name"),
                            "reference_id": prop.get("reference_id"),
                        }
                    )

            all_objects: list[tuple[str, dict[str, Any], str | None, str | None, list[PropertyContext]]] = []
            inherited_links_by_object: dict[tuple[str, str], list[PropertyContext]] = {}
            media_assets_seen = 0
            selected_endpoints: list[dict[str, Any]] = []
            for endpoint in CONTENT_ENDPOINTS:
                object_type = str(endpoint["object_type"])
                if endpoint_names and object_type not in endpoint_names:
                    continue
                if not include_media and endpoint.get("media_kind"):
                    continue
                selected_endpoints.append(endpoint)
                key = f"{endpoint['object_type']}:{endpoint['path']}:{json_compact(endpoint.get('params') or {})}"
                rows = list(
                    self._paginated_get(
                        str(endpoint["path"]),
                        params=endpoint.get("params"),
                        label=object_type,
                        verbose=verbose,
                        max_pages=max_pages_per_endpoint,
                    )
                )
                endpoint_payloads[key] = rows
                if endpoint.get("media_kind"):
                    media_assets_seen += len(rows)
                for row in rows:
                    all_objects.append((object_type, row, None, None, []))
                    nested_key = endpoint.get("nested_items_key")
                    nested_items = row.get(nested_key) if nested_key else None
                    if isinstance(nested_items, list):
                        inherited_contexts = [
                            property_contexts[property_id]
                            for property_id in extract_property_ids(row)
                            if property_id in property_contexts
                        ]
                        parent_id = row_id(row, object_type)
                        for nested in nested_items:
                            if isinstance(nested, dict):
                                all_objects.append(("content_item", nested, object_type, parent_id, inherited_contexts))

            if resolve_property_links:
                linkable_endpoints = [
                    endpoint
                    for endpoint in selected_endpoints
                    if str(endpoint["object_type"]) in PROPERTY_LINK_RESOLUTION_TYPES
                ]
                resolved_properties = [
                    context
                    for context in property_contexts.values()
                    if context.identity_status == "resolved"
                ]
                for endpoint in linkable_endpoints:
                    object_type = str(endpoint["object_type"])
                    for context in resolved_properties:
                        params = dict(endpoint.get("params") or {})
                        params["property_id"] = context.resi_property_id
                        label = f"{object_type}:{context.property_code or context.resi_property_id}"
                        rows = list(
                            self._paginated_get(
                                str(endpoint["path"]),
                                params=params,
                                label=label,
                                verbose=verbose,
                                max_pages=max_pages_per_endpoint,
                            )
                        )
                        for row in rows:
                            parent_object_id = row_id(row, object_type)
                            inherited_links_by_object.setdefault((object_type, parent_object_id), []).append(context)
                            nested_key = endpoint.get("nested_items_key")
                            nested_items = row.get(nested_key) if nested_key else None
                            if isinstance(nested_items, list):
                                for nested in nested_items:
                                    if isinstance(nested, dict):
                                        inherited_links_by_object.setdefault(
                                            ("content_item", row_id(nested, "content_item")),
                                            [],
                                        ).append(context)
                        endpoint_payloads[f"property_links:{object_type}:{context.resi_property_id}"] = {
                            "object_type": object_type,
                            "property_code": context.property_code,
                            "rows_seen": len(rows),
                        }

            source_payload = {"properties": properties, "endpoints": endpoint_payloads}
            run_id = f"resi_content_{payload_sha256({'fetched_at': fetched_at, 'payload': source_payload})[:12]}"

            content_fields_seen = 0
            for object_type, row, parent_type, parent_id, inherited_contexts in all_objects:
                context = self._primary_property_context(row, property_contexts)
                resolved_links = inherited_links_by_object.get((object_type, row_id(row, object_type)), [])
                if resolved_links:
                    inherited_contexts = [*inherited_contexts, *resolved_links]
                if context is None and inherited_contexts:
                    context = inherited_contexts[0]
                object_id = self._insert_object(conn, run_id, object_type, row, context, parent_type, parent_id)
                self._insert_property_links(conn, run_id, object_type, object_id, row, property_contexts, inherited_contexts)
                content_fields_seen += self._insert_fields(conn, run_id, object_type, object_id, row, context, parent_id)
                self._insert_default_bindings(conn, object_type, object_id, context, fetched_at)

            conn.execute(
                """
                INSERT OR REPLACE INTO resi_content_inventory_runs (
                  run_id, source_snapshot_id, snapshot_date, fetched_at, api_base_url, account_id,
                  account_name, properties_seen, properties_resolved, content_objects_seen,
                  content_fields_seen, media_assets_seen, source_payload_sha256, warning_count,
                  warnings_json, collection_manifest_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    source_snapshot_id,
                    snapshot_date,
                    fetched_at,
                    self.base_url,
                    account_id,
                    account_name,
                    len(properties),
                    sum(1 for context in property_contexts.values() if context.identity_status == "resolved"),
                    len(all_objects),
                    content_fields_seen,
                    media_assets_seen,
                    payload_sha256(source_payload),
                    len(warnings),
                    json_compact(warnings),
                    json_compact(
                        {
                            "endpoints": CONTENT_ENDPOINTS,
                            "use_latest_core_snapshot": use_latest_core_snapshot,
                            "include_media": include_media,
                            "endpoint_names": sorted(endpoint_names) if endpoint_names else None,
                            "max_pages_per_endpoint": max_pages_per_endpoint,
                            "resolve_property_links": resolve_property_links,
                        }
                    ),
                ),
            )
            conn.commit()

        return ResiContentInventoryResult(
            run_id=run_id,
            fetched_at=fetched_at,
            account_id=account_id,
            account_name=account_name,
            properties_seen=len(properties),
            properties_resolved=sum(1 for context in property_contexts.values() if context.identity_status == "resolved"),
            content_objects_seen=len(all_objects),
            content_fields_seen=content_fields_seen,
            media_assets_seen=media_assets_seen,
            requests_made=self.requests_made,
            warnings=warnings,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DB_PATH), help="Canonical local SQLite database.")
    parser.add_argument(
        "--use-latest-core-snapshot",
        action="store_true",
        help="Reuse the latest local Resi property snapshot instead of calling GET /properties.",
    )
    parser.add_argument("--skip-media", action="store_true", help="Skip account-level media file/embed library endpoints.")
    parser.add_argument(
        "--endpoint",
        action="append",
        default=[],
        help="Limit collection to one object type. May be passed more than once, e.g. --endpoint faq --endpoint content_block.",
    )
    parser.add_argument("--verbose", action="store_true", help="Print endpoint/page progress to stderr.")
    parser.add_argument(
        "--resolve-property-links",
        action="store_true",
        help="Use per-property V2 property_id filters to map global/editorial objects to properties.",
    )
    parser.add_argument(
        "--max-pages-per-endpoint",
        type=int,
        default=None,
        help="Safety/testing limit. Omit for full collection.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = ResiV2ContentInventoryCollector(db_path=Path(args.db)).ingest(
        use_latest_core_snapshot=args.use_latest_core_snapshot,
        include_media=not args.skip_media,
        endpoint_names=set(args.endpoint) if args.endpoint else None,
        verbose=args.verbose,
        max_pages_per_endpoint=args.max_pages_per_endpoint,
        resolve_property_links=args.resolve_property_links,
    )
    print(json.dumps(result.__dict__, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
