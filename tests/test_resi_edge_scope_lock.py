import argparse
import json
from datetime import datetime, timedelta, timezone

from scripts.run_resi_edge_upgrade import validate_scope_lock
from scripts.resi_edge_deploy_adapter import selected_worker_name, validate_apply_scope_lock


def write_lock(path, targets, *, status="ACTIVE", expires_delta=timedelta(hours=1)):
    now = datetime.now(timezone.utc)
    payload = {
        "version": "test",
        "status": status,
        "scope_id": "test-scope",
        "created_at": now.isoformat(),
        "expires_at": (now + expires_delta).isoformat(),
        "allowed_targets": targets,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def test_runner_blocks_missing_scope_lock(tmp_path):
    args = argparse.Namespace(property_code="GA4AB", domain="axialbuckhead.com", mode="apply")

    result = validate_scope_lock(args, tmp_path / "missing.json")

    assert result["pass"] is False
    assert result["blocked"] is True
    assert "missing" in result["reason"]


def test_runner_allows_only_exact_locked_target(tmp_path):
    lock_path = tmp_path / "scope.json"
    write_lock(
        lock_path,
        [{"property_code": "TX4WZ", "domain": "parkonwurzbach.com", "modes": ["plan", "stage", "apply"]}],
    )

    allowed = validate_scope_lock(
        argparse.Namespace(property_code="TX4WZ", domain="parkonwurzbach.com", mode="stage"),
        lock_path,
    )
    blocked = validate_scope_lock(
        argparse.Namespace(property_code="GA4AB", domain="axialbuckhead.com", mode="apply"),
        lock_path,
    )

    assert allowed["pass"] is True
    assert blocked["pass"] is False
    assert "outside the active scope lock" in blocked["reason"]


def test_deploy_adapter_apply_blocks_outside_scope(tmp_path):
    lock_path = tmp_path / "scope.json"
    write_lock(
        lock_path,
        [{"property_code": "TX4WZ", "domain": "parkonwurzbach.com", "modes": ["apply"]}],
    )
    manifest = {"target": {"property_code": "GA4AB", "domain": "axialbuckhead.com"}}

    result = validate_apply_scope_lock(manifest, lock_path)

    assert result["pass"] is False
    assert "outside the active Resi Edge scope lock" in result["reason"]


def test_deploy_adapter_apply_allows_exact_scope(tmp_path):
    lock_path = tmp_path / "scope.json"
    write_lock(
        lock_path,
        [{"property_code": "GA4AB", "domain": "axialbuckhead.com", "modes": ["apply"]}],
    )
    manifest = {"target": {"property_code": "GA4AB", "domain": "axialbuckhead.com"}}

    result = validate_apply_scope_lock(manifest, lock_path)

    assert result["pass"] is True


def test_deploy_adapter_never_uses_placeholder_worker_name():
    for placeholder in ("not_yet_recorded", "not_yet_assigned_in_governed_package", "pending", "none"):
        assert (
            selected_worker_name({"existing_worker_script": placeholder}, "carlyleplacesa.com")
            == "resi-edge-canonical-carlyleplacesa-com"
        )

    assert (
        selected_worker_name({"existing_worker_script": "resi-edge-canonical-carlyleplacesa-com"}, "carlyleplacesa.com")
        == "resi-edge-canonical-carlyleplacesa-com"
    )
