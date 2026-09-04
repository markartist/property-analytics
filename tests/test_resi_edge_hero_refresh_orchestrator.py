from argparse import Namespace
import json

import pytest

from scripts.run_resi_edge_hero_refresh import parse_args, parse_last_json_object, resolve_manifest


def test_parse_last_json_object_returns_final_top_level_object():
    output = """UPLOADED: bucket/key
{
  "mode": "apply",
  "nested": {"pass": true},
  "items": [{"name": "hero"}]
}
"""

    assert parse_last_json_object(output) == {
        "mode": "apply",
        "nested": {"pass": True},
        "items": [{"name": "hero"}],
    }


def test_resolve_manifest_requires_exact_property_code_and_domain(tmp_path):
    manifest = tmp_path / "axialbuckhead-com.manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "target": {
                    "property_code": "GA4AB",
                    "source_property_code": "GA4AB",
                    "domain": "axialbuckhead.com",
                }
            }
        ),
        encoding="utf-8",
    )
    args = Namespace(property_code="GA4AB", domain="axialbuckhead.com", manifest=manifest)

    assert resolve_manifest(args) == manifest.resolve()

    mismatch = Namespace(property_code="GA4BV", domain="axialbuckhead.com", manifest=manifest)
    with pytest.raises(SystemExit):
        resolve_manifest(mismatch)


def test_apply_mode_triggers_manual_monitor_sync_by_default():
    args = parse_args(["--property-code", "GA4AB", "--domain", "axialbuckhead.com", "--apply"])

    assert args.apply is True
    assert args.skip_monitor_sync is False
    assert args.monitor_base_url == "https://pop-brief-api.mlaufhutte.workers.dev"


def test_operator_can_skip_manual_monitor_sync_when_needed():
    args = parse_args(
        [
            "--property-code",
            "GA4AB",
            "--domain",
            "axialbuckhead.com",
            "--apply",
            "--skip-monitor-sync",
        ]
    )

    assert args.apply is True
    assert args.skip_monitor_sync is True
