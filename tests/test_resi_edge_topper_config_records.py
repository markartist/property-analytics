import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_single_manifest_topper_config_record(tmp_path):
    manifest = ROOT / "config/portfolio_resi_edge_stabilization/anatoleatnorman-com.manifest.json"
    result = subprocess.run(
        [
            sys.executable,
            "scripts/build_resi_edge_topper_config_records.py",
            "--manifest",
            str(manifest),
            "--output-dir",
            str(tmp_path),
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert summary["pass"] is True
    assert summary["record_count"] == 1
    row = summary["records"][0]
    assert row["key"] == "resi-edge-topper-config/ok4an-anatoleatnorman-com/current.json"

    record = json.loads((tmp_path / row["key"]).read_text())
    assert record["schema_version"] == "resi_edge_topper_config_record.v1"
    assert record["property_code"] == "OK4AN"
    assert record["domain"] == "anatoleatnorman.com"
    assert record["analytics"]["owner"] == "cloudflare_zaraz"
    assert record["analytics"]["heap"]["app_id"] == "286627304"
    assert record["consent"]["widget_version"] == "compact_shell_pill_v29_2026_08_20"
    assert record["record_keys"]["promo"] == "resi-edge-promo/ok4an-anatoleatnorman-com/current.json"
    assert record["record_keys"]["hero_freshness"] == "resi-edge-hero-freshness/ok4an-anatoleatnorman-com/current.json"
    assert len(record["mobile_shell"]["navigation"]["links"]) >= 10
