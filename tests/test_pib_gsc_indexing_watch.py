import importlib.util
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "Property_Intelligence_Brief"
    / "generate_property_intelligence_brief_v2_3_1.py"
)
spec = importlib.util.spec_from_file_location("pib_v231", MODULE_PATH)
pib = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pib)


def _row(url, coverage_state, verdict="NEUTRAL", inspection_date="2026-08-28"):
    return {
        "inspected_url": url,
        "verdict": verdict,
        "coverage_state": coverage_state,
        "indexing_state": "INDEXING_STATE_UNSPECIFIED",
        "page_fetch_state": "PAGE_FETCH_STATE_UNSPECIFIED",
        "robots_txt_state": "ALLOWED",
        "inspection_date": inspection_date,
    }


def test_currently_not_indexed_is_not_counted_as_indexed():
    watch = pib._build_standard_gsc_indexing_watch(
        [
            _row(
                "https://example.com/",
                "Crawled - currently not indexed",
            )
        ]
    )

    assert watch["standard_indexed"] == 0
    assert watch["root_indexed"] is False
    assert watch["root_status"] == "crawled_not_indexed"
    assert watch["watch_count"] == 11
    assert watch["blocked_count"] == 0
    assert watch["fetch_issue_count"] == 0


def test_standard_watch_prefers_vanity_rows_over_legacy_rows():
    rows = []
    for path in pib.STANDARD_RESI_CORE_PATHS:
        rows.append(
            _row(
                f"https://venterraliving.com/apartments/sample-property{path}",
                "URL is on Google",
                verdict="PASS",
            )
        )
        rows.append(
            _row(
                f"https://samplevanity.com{path}",
                "Discovered - currently not indexed",
            )
        )

    watch = pib._build_standard_gsc_indexing_watch(rows)

    assert watch["domain"] == "samplevanity.com"
    assert watch["standard_indexed"] == 0
    assert watch["standard_inspected"] == 11
    assert watch["watch_count"] == 11
    assert watch["root_status"] == "discovered_not_indexed"


def test_all_standard_paths_indexed_returns_clean_watch():
    rows = [
        _row(
            f"https://samplevanity.com{path}",
            "URL is on Google",
            verdict="PASS",
        )
        for path in pib.STANDARD_RESI_CORE_PATHS
    ]

    watch = pib._build_standard_gsc_indexing_watch(rows)

    assert watch["available"] is True
    assert watch["standard_indexed"] == 11
    assert watch["standard_indexed_pct"] == 100.0
    assert watch["root_indexed"] is True
    assert watch["watch_count"] == 0
    assert watch["missing_paths"] == []
    assert watch["non_indexed_paths"] == []
