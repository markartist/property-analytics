import importlib.util
import io
import json
import sys
from pathlib import Path
from urllib.error import HTTPError

import pytest


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "apply_resi_zaraz_analytics_package.py"
SPEC = importlib.util.spec_from_file_location("apply_resi_zaraz_analytics_package", MODULE_PATH)
apply_resi_zaraz = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(apply_resi_zaraz)


class JsonResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return io.BytesIO(json.dumps(self.payload).encode("utf-8"))

    def __exit__(self, exc_type, exc, tb):
        return False


def http_error(code: int) -> HTTPError:
    return HTTPError("https://api.cloudflare.com/client/v4/test", code, "error", {}, io.BytesIO(b"{}"))


def test_cloudflare_5xx_retries_then_succeeds(monkeypatch):
    attempts = []

    def fake_urlopen(request, timeout):
        attempts.append(request.full_url)
        if len(attempts) == 1:
            raise http_error(500)
        return JsonResponse({"success": True, "result": {"ok": True}})

    monkeypatch.setattr(apply_resi_zaraz, "urlopen", fake_urlopen)
    monkeypatch.setattr(apply_resi_zaraz.time, "sleep", lambda seconds: None)

    payload = apply_resi_zaraz._api("token", "/test")

    assert payload["success"] is True
    assert len(attempts) == 2


def test_cloudflare_4xx_does_not_retry(monkeypatch):
    attempts = []

    def fake_urlopen(request, timeout):
        attempts.append(request.full_url)
        raise http_error(403)

    monkeypatch.setattr(apply_resi_zaraz, "urlopen", fake_urlopen)
    monkeypatch.setattr(apply_resi_zaraz.time, "sleep", lambda seconds: None)

    with pytest.raises(HTTPError):
        apply_resi_zaraz._api("token", "/test")

    assert len(attempts) == 1


def test_main_writes_redacted_failure_packet(monkeypatch, tmp_path):
    manifest_path = tmp_path / "manifest.json"
    output_path = tmp_path / "zaraz-result.json"
    manifest_path.write_text(
        json.dumps(
            {
                "target": {
                    "domain": "example.com",
                    "property_code": "EX4PL",
                    "property_name": "Example Property",
                },
                "analytics": {
                    "ga4": {"measurement_id": "G-TEST"},
                    "heap": {"app_id": "286627304"},
                },
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(apply_resi_zaraz, "_apply", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("Cloudflare Zaraz API request failed after 3 attempts: HTTP 500")))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "apply_resi_zaraz_analytics_package.py",
            "--manifest",
            str(manifest_path),
            "--apply",
            "--output",
            str(output_path),
        ],
    )

    assert apply_resi_zaraz.main() == 1
    payload = json.loads(output_path.read_text(encoding="utf-8"))

    assert payload["status"] == "failed"
    assert payload["result"]["domain"] == "example.com"
    assert payload["result"]["property_code"] == "EX4PL"
    assert payload["result"]["changes"] == []
    assert "HTTP 500" in payload["result"]["errors"][0]
