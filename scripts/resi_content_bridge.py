#!/usr/bin/env python3
"""Guarded Resi Content Bridge operations for Data Pond content workflows.

Read commands are safe by default. Live Resi mutations require exact confirm
phrases and Keeper-backed credentials.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
RESI_V2_BASE = "https://v2.getresi.com/api/v2"
RESI_V1_BASE = "https://v2.getresi.com/api/v1"
APPLY_CONFIRM = "APPLY_RESI_CONTENT_CHANGE"
CACHE_CONFIRM = "CLEAR_RESI_CONTENT_CACHE"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity  # noqa: E402
from utils.resi_auth import resolve_resi_credentials  # noqa: E402


class BridgeError(RuntimeError):
    """Expected operational error with sanitized context."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_text(value: str | None) -> str | None:
    if value is None:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_question(value: str | None) -> str:
    text = html.unescape(value or "").lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_html(value: str | None) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def read_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def latest_resi_property_snapshot(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT snapshot_id, raw_properties_json
        FROM resi_v2_api_snapshots
        ORDER BY fetched_at DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        raise BridgeError("No Resi V2 property snapshot found. Run the read-only Resi V2 collector first.")
    return {"snapshot_id": row["snapshot_id"], "properties": extract_items(json.loads(row["raw_properties_json"]))}


def resolve_resi_property(conn: sqlite3.Connection, property_code: str) -> dict[str, Any]:
    code = property_code.strip().upper()
    identity = resolve_property_identity(code)
    if not identity or (identity.property_code or "").upper() != code:
        raise BridgeError(f"{code} is not resolved by the governed property identity matrix.")

    snapshot = latest_resi_property_snapshot(conn)
    for prop in snapshot["properties"]:
        reference_id = str(prop.get("reference_id") or prop.get("referenceId") or "").upper()
        if reference_id == code:
            return {
                "property_code": code,
                "canonical_property_id": identity.canonical_property_id,
                "community_id": identity.community_id,
                "website_url": identity.website_url,
                "resi_property_id": str(prop.get("id")),
                "resi_property_name": prop.get("name") or prop.get("title") or identity.property_name,
                "source_snapshot_id": snapshot["snapshot_id"],
            }
    raise BridgeError(f"{code} was not found in the latest Resi V2 property snapshot.")


def latest_inventory_run_id(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        "SELECT run_id FROM resi_content_inventory_runs ORDER BY fetched_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        raise BridgeError("No Resi content inventory run found. Run the content inventory collector first.")
    return str(row["run_id"])


def extract_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("data", "items", "results", "properties", "faqs"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = extract_items(value)
            if nested:
                return nested
    for value in payload.values():
        if isinstance(value, list) and any(isinstance(item, dict) for item in value):
            return [item for item in value if isinstance(item, dict)]
    return []


def local_faq_rows(conn: sqlite3.Connection, property_code: str, question: str | None = None) -> list[dict[str, Any]]:
    run_id = latest_inventory_run_id(conn)
    params: list[Any] = [run_id, property_code.upper()]
    rows = conn.execute(
        """
        SELECT DISTINCT o.object_id, o.raw_object_json, o.updated_at, o.is_enabled
        FROM resi_content_objects o
        JOIN resi_content_property_links l
          ON l.run_id = o.run_id
         AND l.object_type = o.object_type
         AND l.object_id = o.object_id
        WHERE o.run_id = ?
          AND o.object_type = 'faq'
          AND l.property_code = ?
        ORDER BY o.sort_order, o.object_id
        """,
        params,
    ).fetchall()
    target = normalize_question(question)
    results: list[dict[str, Any]] = []
    for row in rows:
        raw = json.loads(row["raw_object_json"])
        raw_question = str(raw.get("question") or "")
        if target and target not in normalize_question(raw_question):
            continue
        results.append(
            {
                "run_id": run_id,
                "faq_id": row["object_id"],
                "question": raw_question,
                "answer_html": raw.get("answer") or "",
                "answer_text": strip_html(raw.get("answer")),
                "updated_at": row["updated_at"],
                "is_enabled": row["is_enabled"],
            }
        )
    return results


def assert_faq_linked(conn: sqlite3.Connection, property_code: str, faq_id: str) -> None:
    run_id = latest_inventory_run_id(conn)
    row = conn.execute(
        """
        SELECT 1
        FROM resi_content_property_links
        WHERE run_id = ?
          AND object_type = 'faq'
          AND object_id = ?
          AND property_code = ?
        LIMIT 1
        """,
        (run_id, faq_id, property_code.upper()),
    ).fetchone()
    if not row:
        raise BridgeError(
            f"FAQ {faq_id} is not linked to {property_code.upper()} in latest inventory run {run_id}."
        )


def resi_v2_session() -> requests.Session:
    creds = resolve_resi_credentials()
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": creds.authorization_header,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "property-analytics-resi-content-bridge/1.0",
        }
    )
    return session


def request_json(session: requests.Session, method: str, url: str, **kwargs: Any) -> tuple[int, Any]:
    response = session.request(method, url, timeout=30, **kwargs)
    try:
        payload: Any = response.json()
    except ValueError:
        payload = {"text": response.text[:500]}
    if response.status_code >= 400:
        raise BridgeError(f"Resi {method} {url} failed with HTTP {response.status_code}.")
    return response.status_code, payload


def fetch_v2_faq(session: requests.Session, faq_id: str) -> dict[str, Any]:
    _, payload = request_json(session, "GET", f"{RESI_V2_BASE}/faqs/{faq_id}")
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    if isinstance(payload, dict):
        return payload
    raise BridgeError(f"Unexpected Resi FAQ readback shape for {faq_id}.")


def find_public_faq(resi_property_id: str, question: str) -> tuple[int, dict[str, Any] | None, list[dict[str, Any]]]:
    response = requests.get(
        f"{RESI_V1_BASE}/property/{resi_property_id}/faqs",
        headers={"Accept": "application/json", "User-Agent": "property-analytics-resi-content-bridge/1.0"},
        timeout=30,
    )
    try:
        payload: Any = response.json()
    except ValueError:
        payload = {"text": response.text[:500]}
    if response.status_code >= 400:
        raise BridgeError(f"Resi public FAQ readback failed with HTTP {response.status_code}.")
    items = extract_items(payload)
    target = normalize_question(question)
    for item in items:
        if normalize_question(str(item.get("question") or "")) == target:
            return response.status_code, item, items
    for item in items:
        if target and target in normalize_question(str(item.get("question") or "")):
            return response.status_code, item, items
    return response.status_code, None, items


def merge_change_request_audit(
    conn: sqlite3.Connection,
    change_request_id: str,
    audit_patch: dict[str, Any],
    apply_status: str | None = None,
) -> None:
    row = conn.execute(
        "SELECT audit_json FROM pond_content_change_requests WHERE change_request_id = ?",
        (change_request_id,),
    ).fetchone()
    if not row:
        raise BridgeError(f"Change request {change_request_id} was not found in the local ledger.")
    audit = read_json(row["audit_json"], {})
    audit.update(audit_patch)
    assignments = ["audit_json = ?", "updated_at = CURRENT_TIMESTAMP"]
    params: list[Any] = [json.dumps(audit, sort_keys=True)]
    if apply_status:
        assignments.append("apply_status = ?")
        params.append(apply_status)
    params.append(change_request_id)
    conn.execute(
        f"UPDATE pond_content_change_requests SET {', '.join(assignments)} WHERE change_request_id = ?",
        params,
    )
    conn.commit()


def cmd_show_faq(args: argparse.Namespace) -> None:
    with connect(Path(args.db)) as conn:
        prop = resolve_resi_property(conn, args.property_code)
        rows = local_faq_rows(conn, prop["property_code"], args.question)
    print(
        json.dumps(
            {
                "mode": "local_inventory_read",
                "property_code": prop["property_code"],
                "resi_property_id": prop["resi_property_id"],
                "resi_property_name": prop["resi_property_name"],
                "faq_count": len(rows),
                "faqs": rows,
            },
            indent=2,
            sort_keys=True,
        )
    )


def cmd_read_v2_faq(args: argparse.Namespace) -> None:
    with connect(Path(args.db)) as conn:
        prop = resolve_resi_property(conn, args.property_code)
        assert_faq_linked(conn, prop["property_code"], args.faq_id)
    session = resi_v2_session()
    faq = fetch_v2_faq(session, args.faq_id)
    if args.question and normalize_question(faq.get("question")) != normalize_question(args.question):
        raise BridgeError("V2 FAQ readback question did not match the requested question.")
    answer_html = str(faq.get("answer") or "")
    answer_text = strip_html(answer_html)
    expected_present = None
    if args.expected_text:
        expected_present = args.expected_text in answer_text or args.expected_text in answer_html
    print(
        json.dumps(
            {
                "mode": "live_resi_v2_read",
                "bridge_name": "Resi Content Bridge",
                "property_code": prop["property_code"],
                "resi_property_id": prop["resi_property_id"],
                "faq_id": args.faq_id,
                "question": faq.get("question"),
                "answer_html": answer_html,
                "answer_text": answer_text,
                "expected_text_present": expected_present,
                "resi_updated_at": faq.get("updated_at"),
            },
            indent=2,
            sort_keys=True,
        )
    )
    if expected_present is False:
        raise BridgeError("Live V2 FAQ readback did not contain the expected text.")


def load_answer_html(args: argparse.Namespace) -> str:
    if args.answer_html_file:
        value = Path(args.answer_html_file).read_text(encoding="utf-8")
    else:
        value = args.answer_html or ""
    value = value.strip()
    if not value:
        raise BridgeError("Proposed answer HTML is empty.")
    return value


def cmd_apply_faq_answer(args: argparse.Namespace) -> None:
    if args.confirm != APPLY_CONFIRM:
        raise BridgeError(f"Live Resi writes require --confirm {APPLY_CONFIRM}.")

    proposed_answer = load_answer_html(args)
    with connect(Path(args.db)) as conn:
        prop = resolve_resi_property(conn, args.property_code)
        assert_faq_linked(conn, prop["property_code"], args.faq_id)
        session = resi_v2_session()
        before = fetch_v2_faq(session, args.faq_id)
        if args.question and normalize_question(before.get("question")) != normalize_question(args.question):
            raise BridgeError("V2 FAQ readback question did not match the requested question.")

        requested_at = utc_now()
        base_id = f"{prop['property_code']}:{args.faq_id}:answer:{sha256_text(proposed_answer)[:12]}"
        change_request_id = args.change_request_id or f"resi_content_bridge_{sha256_text(base_id)[:16]}"
        audit = {
            "bridge_name": "Resi Content Bridge",
            "operation": "apply_faq_answer",
            "property_code": prop["property_code"],
            "resi_property_id": prop["resi_property_id"],
            "v2_read_before_status": "ok",
            "source_snapshot_id": prop["source_snapshot_id"],
            "approval_source": "cli_confirm_phrase",
            "confirm_phrase": APPLY_CONFIRM,
        }
        conn.execute(
            """
            INSERT OR REPLACE INTO pond_content_change_requests (
              change_request_id,
              source_system,
              source_api,
              source_object_type,
              source_object_id,
              source_field_path,
              property_code,
              community_id,
              originating_system,
              requested_by,
              requested_at,
              current_value_sha256,
              proposed_value_text,
              proposed_payload_json,
              editability_class,
              approval_status,
              apply_status,
              resi_update_method,
              resi_update_path_template,
              approved_by,
              approved_at,
              applied_by,
              applied_at,
              readback_value_sha256,
              audit_json
            ) VALUES (?, 'resi', 'resi_v2', 'faq', ?, 'answer', ?, ?, ?, ?, ?, ?, ?, ?, 'safe_content_change',
              'approved', 'applying', 'PATCH', '/faqs/{id}', ?, ?, ?, ?, ?, ?)
            """,
            (
                change_request_id,
                args.faq_id,
                prop["property_code"],
                prop["community_id"],
                args.originating_system,
                args.requested_by,
                requested_at,
                sha256_text(str(before.get("answer") or "")),
                proposed_answer,
                json.dumps({"answer": proposed_answer}, sort_keys=True),
                args.approved_by,
                requested_at,
                args.applied_by,
                requested_at,
                sha256_text(proposed_answer),
                json.dumps(audit, sort_keys=True),
            ),
        )
        conn.commit()

        status, patch_payload = request_json(
            session,
            "PATCH",
            f"{RESI_V2_BASE}/faqs/{args.faq_id}",
            json={"answer": proposed_answer},
        )
        after = fetch_v2_faq(session, args.faq_id)
        readback_answer = str(after.get("answer") or "")
        verified = readback_answer == proposed_answer
        merge_change_request_audit(
            conn,
            change_request_id,
            {
                "v2_patch_http_status": status,
                "v2_patch_response_shape": "json" if isinstance(patch_payload, dict) else type(patch_payload).__name__,
                "v2_readback_verified": verified,
                "v2_updated_at": after.get("updated_at"),
            },
            apply_status="applied_readback_verified" if verified else "applied_readback_mismatch",
        )
    if not verified:
        raise BridgeError("Resi PATCH completed but V2 readback did not match the proposed answer.")
    print(
        json.dumps(
            {
                "mode": "live_resi_write",
                "bridge_name": "Resi Content Bridge",
                "change_request_id": change_request_id,
                "property_code": prop["property_code"],
                "faq_id": args.faq_id,
                "http_status": status,
                "readback_verified": verified,
                "resi_updated_at": after.get("updated_at"),
            },
            indent=2,
            sort_keys=True,
        )
    )


def cmd_clear_property_cache(args: argparse.Namespace) -> None:
    if args.confirm != CACHE_CONFIRM:
        raise BridgeError(f"Resi cache clearing requires --confirm {CACHE_CONFIRM}.")
    with connect(Path(args.db)) as conn:
        prop = resolve_resi_property(conn, args.property_code)
        response = requests.post(
            f"{RESI_V1_BASE}/cache/clear",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json={"property_id": prop["resi_property_id"]},
            timeout=30,
        )
        try:
            payload: Any = response.json()
        except ValueError:
            payload = {"text": response.text[:500]}
        if response.status_code >= 400:
            raise BridgeError(f"Resi cache clear failed with HTTP {response.status_code}.")
        audit_patch = {
            "cache_clear_requested_at": utc_now(),
            "cache_clear_endpoint": "/api/v1/cache/clear",
            "cache_clear_scope": "property_id",
            "cache_clear_property_id": prop["resi_property_id"],
            "cache_clear_http_status": response.status_code,
            "cache_clear_response": payload,
        }
        if args.change_request_id:
            merge_change_request_audit(conn, args.change_request_id, audit_patch)
    print(
        json.dumps(
            {
                "mode": "live_resi_cache_clear",
                "bridge_name": "Resi Content Bridge",
                "property_code": prop["property_code"],
                "resi_property_id": prop["resi_property_id"],
                "http_status": response.status_code,
                "message": payload.get("message") if isinstance(payload, dict) else None,
                "change_request_id": args.change_request_id,
            },
            indent=2,
            sort_keys=True,
        )
    )


def cmd_verify_public_faq(args: argparse.Namespace) -> None:
    with connect(Path(args.db)) as conn:
        prop = resolve_resi_property(conn, args.property_code)
    status, faq, items = find_public_faq(prop["resi_property_id"], args.question)
    answer_html = str((faq or {}).get("answer") or "")
    answer_text = strip_html(answer_html)
    expected_present = args.expected_text in answer_text or args.expected_text in answer_html
    page_result: dict[str, Any] | None = None
    if args.page_url:
        page_response = requests.get(
            args.page_url,
            headers={"User-Agent": "property-analytics-resi-content-bridge/1.0"},
            timeout=30,
        )
        page_text = page_response.text
        page_result = {
            "url": args.page_url,
            "http_status": page_response.status_code,
            "expected_text_present": args.expected_text in page_text,
            "x_vtr": page_response.headers.get("x-vtr"),
            "cf_cache_status": page_response.headers.get("cf-cache-status"),
        }
    result = {
        "mode": "public_resi_delivery_verify",
        "bridge_name": "Resi Content Bridge",
        "property_code": prop["property_code"],
        "resi_property_id": prop["resi_property_id"],
        "http_status": status,
        "faq_count": len(items),
        "question_found": faq is not None,
        "expected_text_present": expected_present,
        "faq_id": (faq or {}).get("id"),
        "answer_text": answer_text,
        "page_result": page_result,
    }
    if args.change_request_id:
        with connect(Path(args.db)) as conn:
            merge_change_request_audit(
                conn,
                args.change_request_id,
                {
                    "public_faq_readback_checked_at": utc_now(),
                    "public_faq_http_status": status,
                    "public_faq_question_found": faq is not None,
                    "public_faq_expected_text_present": expected_present,
                    "public_page_result": page_result,
                },
            )
    print(json.dumps(result, indent=2, sort_keys=True))
    if not faq or not expected_present:
        raise BridgeError("Public FAQ verification did not find the expected live answer text.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resi Content Bridge guarded operations.")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to the local Data Pond SQLite database.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    show = subparsers.add_parser("show-faq", help="Read mapped FAQ content from local Data Pond inventory.")
    show.add_argument("--property-code", required=True)
    show.add_argument("--question")
    show.set_defaults(func=cmd_show_faq)

    read_v2 = subparsers.add_parser("read-v2-faq", help="Read one FAQ directly from live Resi V2.")
    read_v2.add_argument("--property-code", required=True)
    read_v2.add_argument("--faq-id", required=True)
    read_v2.add_argument("--question")
    read_v2.add_argument("--expected-text")
    read_v2.set_defaults(func=cmd_read_v2_faq)

    apply_faq = subparsers.add_parser("apply-faq-answer", help="Apply an approved FAQ answer change to live Resi.")
    apply_faq.add_argument("--property-code", required=True)
    apply_faq.add_argument("--faq-id", required=True)
    apply_faq.add_argument("--question")
    apply_faq.add_argument("--answer-html")
    apply_faq.add_argument("--answer-html-file")
    apply_faq.add_argument("--change-request-id")
    apply_faq.add_argument("--originating-system", default="resi_content_bridge")
    apply_faq.add_argument("--requested-by", default="Mark Laufhutte")
    apply_faq.add_argument("--approved-by", default="Mark Laufhutte")
    apply_faq.add_argument("--applied-by", default="Codex")
    apply_faq.add_argument("--confirm", required=True)
    apply_faq.set_defaults(func=cmd_apply_faq_answer)

    clear = subparsers.add_parser("clear-property-cache", help="Request a Resi V1 property cache clear.")
    clear.add_argument("--property-code", required=True)
    clear.add_argument("--change-request-id")
    clear.add_argument("--confirm", required=True)
    clear.set_defaults(func=cmd_clear_property_cache)

    verify = subparsers.add_parser("verify-public-faq", help="Verify FAQ copy through the public Resi delivery API.")
    verify.add_argument("--property-code", required=True)
    verify.add_argument("--question", required=True)
    verify.add_argument("--expected-text", required=True)
    verify.add_argument("--change-request-id")
    verify.add_argument("--page-url")
    verify.set_defaults(func=cmd_verify_public_faq)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
        return 0
    except BridgeError as exc:
        print(json.dumps({"error": str(exc)}, indent=2, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
