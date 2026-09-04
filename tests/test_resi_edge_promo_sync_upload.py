from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
SCRIPT_PATH = ROOT / "scripts" / "sync_resi_edge_promo_records.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("sync_resi_edge_promo_records", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_promo_upload_targets_remote_r2(monkeypatch, tmp_path: Path) -> None:
    module = _load_module()
    commands: list[list[str]] = []

    def fake_run(command: list[str], env: dict[str, str]):
        commands.append(command)

        class Result:
            returncode = 0
            stdout = "ok"
            stderr = ""

        return Result()

    monkeypatch.setattr(module, "run", fake_run)
    monkeypatch.setattr(module, "npx_wrangler_prefix", lambda env: ["npx", "wrangler"])

    source = tmp_path / "promo.json"
    source.write_text("{}\n", encoding="utf-8")

    result = module.upload_record(source, "resi-edge-promo/test/current.json", {"CLOUDFLARE_API_TOKEN": "set"})

    assert result["pass"] is True
    assert commands == [
        [
            "npx",
            "wrangler",
            "r2",
            "object",
            "put",
            "resi-edge-assets/resi-edge-promo/test/current.json",
            "--file",
            str(source),
            "--content-type",
            "application/json; charset=utf-8",
            "--remote",
        ]
    ]
