#!/usr/bin/env python3
"""Plan or patch Phase 2 GA4 web stream default URIs.

Default mode is non-mutating. Apply mode requires an explicit confirmation
token and stops on the first failed readback.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from google.analytics import admin_v1beta
from google.analytics.admin_v1beta import AnalyticsAdminServiceClient
from google.oauth2 import service_account
from google.protobuf.field_mask_pb2 import FieldMask


ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from build_resi_edge_phase2_analytics_profile_plan import DEFAULT_GA4_SERVICE_ACCOUNT_UID  # noqa: E402
from utils.config_manager import Config  # noqa: E402
from utils.ksm import ensure_keeper_profile_ready  # noqa: E402


UTC = timezone.utc
LOCAL_TZ = ZoneInfo("America/Chicago")
DEFAULT_ANALYTICS_PLAN_ROOT = ROOT / "reports/resi_edge_performance/phase2-analytics-profile-plan"
DEFAULT_OUTPUT_DIR = ROOT / "reports/ga4_admin/phase2_default_uri"
READ_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
EDIT_SCOPE = "https://www.googleapis.com/auth/analytics.edit"
APPLY_CONFIRMATION = "PATCH_PHASE2_GA4_DEFAULT_URIS"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def human_time(value: datetime) -> str:
    return value.astimezone(LOCAL_TZ).strftime("%m/%d/%Y %I:%M %p %Z")


def provider_error(exc: Exception) -> dict[str, str]:
    return {"type": type(exc).__name__, "message": str(exc)[:700]}


def latest_analytics_plan(root: Path) -> Path:
    candidates = sorted(root.glob("phase-2-analytics-profile-plan-*/analytics_profile_plan.json"))
    if not candidates:
        raise FileNotFoundError(f"No analytics profile plan found under {root}")
    return candidates[-1]


def normalize_uri(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or parsed.path.split("/")[0]).lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path if parsed.netloc else ""
    if not path:
        path = "/"
    path = "/" + path.lstrip("/")
    if path != "/":
        path = path.rstrip("/") + "/"
    return f"https://{host}{path}"


def load_client(scope: str) -> AnalyticsAdminServiceClient:
    os.environ.setdefault("KSM_GA4_SERVICE_ACCOUNT_UID", DEFAULT_GA4_SERVICE_ACCOUNT_UID)
    ensure_keeper_profile_ready(os.getenv("KSM_PROFILE", "marketingops"))
    credentials = service_account.Credentials.from_service_account_file(
        str(Config.get_ga4_credentials_path()),
        scopes=[scope],
    )
    return AnalyticsAdminServiceClient(credentials=credentials)


def stream_row(stream: Any) -> dict[str, Any]:
    web = stream.web_stream_data
    return {
        "name": stream.name,
        "display_name": stream.display_name,
        "measurement_id": web.measurement_id,
        "default_uri": web.default_uri,
        "normalized_default_uri": normalize_uri(web.default_uri),
    }


def extract_rows(analytics_plan: dict[str, Any], only_property_codes: set[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in analytics_plan.get("properties") or []:
        property_code = str(row.get("property_code") or "").strip()
        if only_property_codes and property_code not in only_property_codes:
            continue
        ga4 = row.get("ga4") or {}
        selected = ga4.get("selected_stream") or {}
        if not selected:
            continue
        rows.append(
            {
                "phase": row.get("phase"),
                "go_live": row.get("go_live"),
                "property_code": property_code,
                "property_name": row.get("property_name"),
                "domain": row.get("domain"),
                "ga4_property_id": ga4.get("property_id"),
                "measurement_id": ga4.get("expected_measurement_id"),
                "stream_name": selected.get("name"),
                "stream_display_name": selected.get("display_name"),
                "current_default_uri_from_plan": selected.get("default_uri"),
                "proposed_default_uri": ga4.get("proposed_default_uri"),
                "ga4_status_from_plan": ga4.get("status"),
            }
        )
    return rows


@dataclass
class Ga4DefaultUriAdmin:
    client: AnalyticsAdminServiceClient

    def get_stream(self, stream_name: str) -> dict[str, Any]:
        stream = self.client.get_data_stream(name=stream_name)
        return stream_row(stream)

    def patch_default_uri(self, stream_name: str, default_uri: str) -> dict[str, Any]:
        data_stream = admin_v1beta.DataStream(name=stream_name)
        data_stream.web_stream_data.default_uri = default_uri
        updated = self.client.update_data_stream(
            request=admin_v1beta.UpdateDataStreamRequest(
                data_stream=data_stream,
                update_mask=FieldMask(paths=["web_stream_data.default_uri"]),
            )
        )
        return stream_row(updated)


def status_for_row(row: dict[str, Any], live_stream: dict[str, Any] | None, error: dict[str, str] | None) -> str:
    if error:
        return "blocked_ga4_stream_read_failed"
    if not row.get("ga4_property_id") or not row.get("stream_name") or not row.get("proposed_default_uri"):
        return "blocked_missing_ga4_patch_fields"
    if not live_stream:
        return "blocked_ga4_stream_not_found"
    if normalize_uri(live_stream.get("default_uri")) == normalize_uri(row.get("proposed_default_uri")):
        return "ready_no_ga4_url_change_needed"
    return "planned_patch_default_uri_pending_approval"


def build_plan(args: argparse.Namespace) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    generated_at = datetime.now(UTC)
    analytics_plan_path = Path(args.analytics_plan) if args.analytics_plan else latest_analytics_plan(DEFAULT_ANALYTICS_PLAN_ROOT)
    analytics_plan = read_json(analytics_plan_path)
    only_property_codes = {value.strip() for value in (args.only_property_code or []) if value.strip()}
    source_rows = extract_rows(analytics_plan, only_property_codes)

    client_error: dict[str, str] | None = None
    try:
        admin = Ga4DefaultUriAdmin(client=load_client(READ_SCOPE))
    except Exception as exc:  # pragma: no cover - exercised in local ops
        admin = None
        client_error = provider_error(exc)

    rows: list[dict[str, Any]] = []
    for source in source_rows:
        live_stream = None
        stream_error = client_error
        if admin and source.get("stream_name"):
            try:
                live_stream = admin.get_stream(source["stream_name"])
            except Exception as exc:  # pragma: no cover - exercised in local ops
                stream_error = provider_error(exc)
        status = status_for_row(source, live_stream, stream_error)
        rows.append(
            {
                **source,
                "live_stream": live_stream,
                "status": status,
                "programmatic_action": (
                    "patch_data_stream_default_uri"
                    if status == "planned_patch_default_uri_pending_approval"
                    else "none"
                ),
                "future_apply_preview": (
                    {
                        "method": "AnalyticsAdminService.UpdateDataStream",
                        "stream_name": source.get("stream_name"),
                        "update_mask": "web_stream_data.default_uri",
                        "current_default_uri": (live_stream or {}).get("default_uri"),
                        "proposed_default_uri": source.get("proposed_default_uri"),
                        "required_oauth_scope": EDIT_SCOPE,
                    }
                    if status == "planned_patch_default_uri_pending_approval"
                    else None
                ),
                "error": stream_error,
            }
        )

    status_counts: dict[str, int] = {}
    for row in rows:
        status_counts[row["status"]] = status_counts.get(row["status"], 0) + 1

    payload = {
        "generated_at": generated_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_at_human": human_time(generated_at),
        "mutations_performed": False,
        "mode": "apply" if args.apply else "dry_run",
        "analytics_profile_plan": str(analytics_plan_path),
        "provider_roster_state": {
            "attempted": True,
            "available": client_error is None,
            "error": client_error,
            "oauth_scope_used": READ_SCOPE,
        },
        "filters": {
            "only_property_codes": sorted(only_property_codes),
        },
        "summary": {
            "total_properties": len(rows),
            "status_counts": dict(sorted(status_counts.items())),
            "planned_patches": status_counts.get("planned_patch_default_uri_pending_approval", 0),
            "already_current": status_counts.get("ready_no_ga4_url_change_needed", 0),
            "blocked": sum(count for status, count in status_counts.items() if status.startswith("blocked_")),
        },
        "rows": rows,
        "apply_guard": {
            "requires_apply": True,
            "confirmation_required": APPLY_CONFIRMATION,
            "stop_on_first_failed_readback": True,
        },
        "notes": [
            "This packet is non-mutating unless --apply and the confirmation token are supplied.",
            "GA4 apply patches only web_stream_data.default_uri on the selected existing web data stream.",
            "This does not create or delete GA4 properties, streams, events, conversions, audiences, or historical data.",
            "Use --only-property-code for a one-property canary before a bulk patch.",
        ],
    }
    return payload, rows


def apply_patches(payload: dict[str, Any], rows: list[dict[str, Any]], args: argparse.Namespace, output_dir: Path) -> int:
    if args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"--apply requires --confirm {APPLY_CONFIRMATION}")
    admin = Ga4DefaultUriAdmin(client=load_client(EDIT_SCOPE))
    payload["mutations_performed"] = True
    payload["provider_roster_state"]["oauth_scope_used_for_apply"] = EDIT_SCOPE
    results: list[dict[str, Any]] = []
    for row in rows:
        if row["status"] != "planned_patch_default_uri_pending_approval":
            continue
        before = admin.get_stream(row["stream_name"])
        patched = None
        after = None
        failure = None
        try:
            patched = admin.patch_default_uri(row["stream_name"], row["proposed_default_uri"])
            if args.readback_delay_seconds:
                time.sleep(args.readback_delay_seconds)
            after = admin.get_stream(row["stream_name"])
        except Exception as exc:  # pragma: no cover - exercised in local ops
            failure = provider_error(exc)
        patch_proven = bool(after and normalize_uri(after.get("default_uri")) == normalize_uri(row.get("proposed_default_uri")))
        if not patch_proven and failure is None:
            failure = {"type": "ReadbackMismatch", "message": "GA4 stream default_uri readback did not match proposed URI."}
        result = {
            "property_code": row.get("property_code"),
            "property_name": row.get("property_name"),
            "stream_name": row.get("stream_name"),
            "before": before,
            "patched_response": patched,
            "after": after,
            "proposed_default_uri": row.get("proposed_default_uri"),
            "patch_proven": patch_proven,
            "failure": failure,
        }
        results.append(result)
        payload["apply_results"] = results
        write_json(output_dir / "phase2_ga4_default_uri_plan.json", payload)
        if failure:
            return 1
    payload["apply_results"] = results
    return 0


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload["summary"]
    lines = [
        "# Phase 2 GA4 Default URI Plan",
        "",
        f"Generated: {payload['generated_at_human']}",
        f"Mode: `{payload['mode']}`",
        f"Mutations performed: `{payload['mutations_performed']}`",
        f"Source plan: `{payload['analytics_profile_plan']}`",
        "",
        "## Summary",
        "",
        f"- total_properties: {summary['total_properties']}",
        f"- planned_patches: {summary['planned_patches']}",
        f"- already_current: {summary['already_current']}",
        f"- blocked: {summary['blocked']}",
        "",
        "## Queue",
        "",
        "| Property | Code | Stream | Current URI | Proposed URI | Status |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in payload["rows"]:
        live = row.get("live_stream") or {}
        lines.append(
            "| {property} | `{code}` | {stream} | {current} | {proposed} | `{status}` |".format(
                property=row.get("property_name") or "",
                code=row.get("property_code") or "",
                stream=row.get("stream_name") or "",
                current=live.get("default_uri") or row.get("current_default_uri_from_plan") or "",
                proposed=row.get("proposed_default_uri") or "",
                status=row.get("status") or "",
            )
        )
    lines.extend(
        [
            "",
            "## Boundary",
            "",
            "- This lane patches GA4 web stream default URI only.",
            "- It does not create/delete GA4 properties or streams, change events/conversions, update Ahrefs, update Zaraz, route domains, touch WordPress, purge cache, or deploy Workers.",
            f"- Apply requires `--apply --confirm {APPLY_CONFIRMATION}` and stops on the first failed readback.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "property_code",
        "property_name",
        "domain",
        "ga4_property_id",
        "measurement_id",
        "stream_name",
        "stream_display_name",
        "current_default_uri",
        "proposed_default_uri",
        "status",
        "programmatic_action",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            live = row.get("live_stream") or {}
            writer.writerow(
                {
                    "property_code": row.get("property_code"),
                    "property_name": row.get("property_name"),
                    "domain": row.get("domain"),
                    "ga4_property_id": row.get("ga4_property_id"),
                    "measurement_id": row.get("measurement_id"),
                    "stream_name": row.get("stream_name"),
                    "stream_display_name": row.get("stream_display_name"),
                    "current_default_uri": live.get("default_uri") or row.get("current_default_uri_from_plan"),
                    "proposed_default_uri": row.get("proposed_default_uri"),
                    "status": row.get("status"),
                    "programmatic_action": row.get("programmatic_action"),
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or patch Phase 2 GA4 web stream default URIs.")
    parser.add_argument("--analytics-plan", help="analytics_profile_plan.json path. Defaults to latest Phase 2 plan.")
    parser.add_argument("--only-property-code", action="append", help="Limit planning/apply to one or more property codes.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--apply", action="store_true", help="Patch planned streams. Default is dry-run.")
    parser.add_argument("--confirm", help=f"Required with --apply. Must equal {APPLY_CONFIRMATION}.")
    parser.add_argument("--readback-delay-seconds", type=float, default=2.0)
    args = parser.parse_args()

    output_dir = Path(args.output_dir) / f"phase2-ga4-default-uri-{utc_stamp()}"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload, rows = build_plan(args)
    exit_code = 0
    if args.apply:
        exit_code = apply_patches(payload, rows, args, output_dir)

    plan_path = output_dir / "phase2_ga4_default_uri_plan.json"
    readout_path = output_dir / "PHASE2_GA4_DEFAULT_URI_READOUT.md"
    csv_path = output_dir / "phase2_ga4_default_uri_plan.csv"
    write_json(plan_path, payload)
    readout_path.write_text(markdown_report(payload), encoding="utf-8")
    write_csv(csv_path, payload["rows"])

    print(
        json.dumps(
            {
                "plan_path": str(plan_path),
                "readout_path": str(readout_path),
                "csv_path": str(csv_path),
                "summary": payload["summary"],
                "mutations_performed": payload["mutations_performed"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": provider_error(exc)}, indent=2, sort_keys=True), file=sys.stderr)
        raise
