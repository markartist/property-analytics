#!/usr/bin/env python3
"""Thin local-Mac caller for Phase 1 governed platform routes.

This script deliberately uses the /v1/platform HTTP surface instead of direct
database access so local validated batches and property-advocate runs pass
through the same enforcement boundaries as the cloud runtime.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def _base_url(value: str | None) -> str:
    return (value or os.environ.get("PLATFORM_BASE_URL") or "http://127.0.0.1:8787").rstrip("/")


def _shared_token(value: str | None) -> str:
    token = value or os.environ.get("PLATFORM_SHARED_TOKEN")
    if not token:
      raise SystemExit("PLATFORM_SHARED_TOKEN is required via --shared-token or environment")
    return token


def _post_json(base_url: str, shared_token: str, path: str, payload: dict[str, Any], actor: str, source: str) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {shared_token}",
            "Content-Type": "application/json",
            "X-Platform-Actor": actor,
            "X-Platform-Source": source,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise SystemExit(f"{path} failed with {exc.code}: {body}") from exc


def _load_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text())


def command_mirror_batch(args: argparse.Namespace) -> int:
    base_url = _base_url(args.base_url)
    shared_token = _shared_token(args.shared_token)
    payload = _load_json(args.input)

    intake = _post_json(base_url, shared_token, "/v1/platform/mirror/intake", payload, args.actor, args.source)
    reconcile = _post_json(
        base_url,
        shared_token,
        "/v1/platform/mirror/reconcile",
        {
            "domainKey": payload["domainKey"],
            "mirrorBatchId": payload["mirrorBatchId"],
            "reconciledBy": args.reconciled_by,
            "reconciliationReason": args.reconciliation_reason,
        },
        args.actor,
        args.source,
    )
    reconcile_status = reconcile.get("result", {}).get("status")
    if reconcile_status != "reconciled":
        raise SystemExit(
            f"/v1/platform/mirror/reconcile did not produce a reconciled batch: {json.dumps(reconcile)}"
        )
    activate = _post_json(
        base_url,
        shared_token,
        "/v1/platform/mirror/activate",
        {
            "domainKey": payload["domainKey"],
            "mirrorBatchId": payload["mirrorBatchId"],
            "activationReason": args.activation_reason,
            "activatedBy": args.activated_by,
        },
        args.actor,
        args.source,
    )

    print(
        json.dumps(
            {
                "intake": intake,
                "reconcile": reconcile,
                "activate": activate,
            },
            indent=2,
        )
    )
    return 0


def command_property_advocate_run(args: argparse.Namespace) -> int:
    base_url = _base_url(args.base_url)
    shared_token = _shared_token(args.shared_token)
    payload = {
        "propertyId": args.property_id,
        "agentId": args.agent_id,
        "contractBundleId": args.contract_bundle_id,
        "executionPolicyId": args.execution_policy_id,
        "requestedBy": args.requested_by,
        "operatorId": args.operator_id,
        "triggerType": args.trigger_type,
        "triggerSource": args.trigger_source,
        "triggerReferenceId": args.trigger_reference_id,
    }
    response = _post_json(
        base_url,
        shared_token,
        "/v1/platform/property-advocate/run",
        payload,
        args.actor,
        args.source,
    )
    print(json.dumps(response, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Phase 1 governed platform client")
    parser.set_defaults(func=lambda _: parser.print_help() or 1)

    shared = argparse.ArgumentParser(add_help=False)
    shared.add_argument("--base-url", help="Platform API base URL (defaults to PLATFORM_BASE_URL or http://127.0.0.1:8787)")
    shared.add_argument("--shared-token", help="Platform shared bearer token (defaults to PLATFORM_SHARED_TOKEN)")
    shared.add_argument("--actor", default="local_mac_runner", help="X-Platform-Actor header value")
    shared.add_argument("--source", default="local_mac", help="X-Platform-Source header value")

    mirror = parser.add_subparsers(dest="command")

    mirror_batch = mirror.add_parser("mirror-batch", parents=[shared], help="Post one validated local batch through intake, reconcile, and activate")
    mirror_batch.add_argument("--input", required=True, help="Path to validated mirror intake payload JSON")
    mirror_batch.add_argument("--reconciled-by", default="local_mac_reconciler")
    mirror_batch.add_argument("--reconciliation-reason", default="local_validated_batch")
    mirror_batch.add_argument("--activated-by", default="local_mac_operator")
    mirror_batch.add_argument("--activation-reason", default="local_validated_batch")
    mirror_batch.set_defaults(func=command_mirror_batch)

    advocate = mirror.add_parser("property-advocate-run", parents=[shared], help="Run one governed property advocate flow through /v1/platform/property-advocate/run")
    advocate.add_argument("--property-id", required=True)
    advocate.add_argument("--agent-id", default="agent_prop_1")
    advocate.add_argument("--contract-bundle-id", default="cb_phase1_v1")
    advocate.add_argument("--execution-policy-id", default="exec_policy_property_advocate")
    advocate.add_argument("--requested-by", default="local_mac")
    advocate.add_argument("--operator-id", default="mark")
    advocate.add_argument("--trigger-type", default="manual")
    advocate.add_argument("--trigger-source", default="local_mac")
    advocate.add_argument("--trigger-reference-id", default=None)
    advocate.set_defaults(func=command_property_advocate_run)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
