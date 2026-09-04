import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "smoke_live_analytics.py"
SPEC = importlib.util.spec_from_file_location("smoke_live_analytics", MODULE_PATH)
smoke_live_analytics = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(smoke_live_analytics)


def test_ga4_gate_accepts_canonical_page_view_without_session_start():
    ga4_realtime = {
        "dimensions": {
            "eventName": [
                {"dimension": "page_view", "eventCount": "1"},
                {"dimension": "user_engagement", "eventCount": "2"},
            ],
            "streamName": [{"dimension": "Calais Midtown", "eventCount": "5"}],
        },
        "eventStreamMinutes": [
            {"eventName": "page_view", "streamName": "Calais Midtown", "minutesAgo": "03", "eventCount": "1"}
        ],
    }

    failures, diagnostics = smoke_live_analytics.evaluate_ga4_realtime_gate(ga4_realtime, ["Calais Midtown", "Website"])

    assert failures == []
    assert diagnostics["page_view_on_expected_stream"] is True
    assert diagnostics["expected_stream_present"] is True
    assert diagnostics["session_start_observed"] is False


def test_ga4_realtime_missing_page_view_is_diagnostic_not_blocking():
    ga4_realtime = {
        "dimensions": {
            "eventName": [{"dimension": "user_engagement", "eventCount": "2"}],
            "streamName": [{"dimension": "Calais Midtown", "eventCount": "2"}],
        },
        "eventStreamMinutes": [
            {"eventName": "user_engagement", "streamName": "Calais Midtown", "minutesAgo": "02", "eventCount": "2"}
        ],
    }

    failures, diagnostics = smoke_live_analytics.evaluate_ga4_realtime_gate(ga4_realtime, ["Calais Midtown"])

    assert failures == []
    assert diagnostics["page_view_on_expected_stream"] is False
    assert diagnostics["expected_stream_present"] is True


def test_ga4_gate_does_not_infer_stream_from_separate_totals():
    ga4_realtime = {
        "dimensions": {
            "eventName": [{"dimension": "page_view", "eventCount": "1"}],
            "streamName": [{"dimension": "Calais Midtown", "eventCount": "1"}],
        },
        "eventStreamMinutes": [
            {"eventName": "page_view", "streamName": "Wrong Stream", "minutesAgo": "01", "eventCount": "1"}
        ],
    }

    failures, diagnostics = smoke_live_analytics.evaluate_ga4_realtime_gate(ga4_realtime, ["Calais Midtown"])

    assert failures == []
    assert diagnostics["page_view_on_expected_stream"] is False
    assert diagnostics["expected_stream_present"] is True


def test_zaraz_bootstrap_decoder_finds_expected_measurement_id():
    url = (
        "https://calaismidtownapartments.com/cdn-cgi/zaraz/s.js?"
        "z=JTdCJTIycSUyMiUzQSU1QiU3QiUyMm0lMjIlM0ElMjJzZXQlMjIlMkMlMjJhJTIyJTNB"
        "JTVCJTIyMSUyMiUyQyUyMkctOFI2VzAzNERKUCUyMiUyQyU3QiUyMnNjb3BlJTIyJTNB"
        "JTIycGFnZSUyMiU3RCU1RCU3RCU1RCU3RA"
    )

    payloads = smoke_live_analytics._decode_zaraz_bootstrap_payloads([url])

    assert any("G-8R6W034DJP" in payload for payload in payloads)
