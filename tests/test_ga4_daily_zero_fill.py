from datetime import date
from types import SimpleNamespace

import importlib.util
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "Data_Collection"
    / "orchestration"
    / "daily_master_collection.py"
)
SPEC = importlib.util.spec_from_file_location("daily_master_collection", MODULE_PATH)
daily_master_collection = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(daily_master_collection)


def _value(value):
    return SimpleNamespace(value=str(value))


def test_ga4_daily_collector_zero_fills_successful_omitted_dates():
    reported_row = SimpleNamespace(
        dimension_values=[_value("20260820")],
        metric_values=[
            _value(12),
            _value(8),
            _value(10),
            _value(4),
            _value(30),
            _value(42.0),
            _value(0.25),
        ],
    )

    class FakeGa4Client:
        def __init__(self):
            self.calls = 0

        def run_report(self, _request):
            self.calls += 1
            if self.calls == 1:
                return SimpleNamespace(rows=[reported_row])
            return SimpleNamespace(rows=[])

    class FakeDb:
        def __init__(self):
            self.daily_rows = []

        def insert_ga4_daily_metrics(self, property_id, metric_date, data, collection_id=None):
            self.daily_rows.append(
                {
                    "property_id": property_id,
                    "metric_date": metric_date,
                    "data": data,
                    "collection_id": collection_id,
                }
            )

        def insert_ga4_traffic_source(self, *args, **kwargs):
            raise AssertionError("Traffic rows were not expected in this test")

        def insert_ga4_device_metrics(self, *args, **kwargs):
            raise AssertionError("Device rows were not expected in this test")

    collector = daily_master_collection.PortfolioDataCollector.__new__(
        daily_master_collection.PortfolioDataCollector
    )
    collector.ga4_client = FakeGa4Client()
    collector.db = FakeDb()

    status, details = collector._collect_ga4_for_property(
        {"name": "Example", "ga4_property_id": "123"},
        date(2026, 8, 19),
        date(2026, 8, 21),
        collection_id=99,
    )

    assert status == "success"
    assert details == "Collected 3 daily rows (1 reported + 2 zero-filled) + traffic + devices"
    assert [row["metric_date"] for row in collector.db.daily_rows] == [
        "2026-08-20",
        "2026-08-19",
        "2026-08-21",
    ]
    zero_rows = [row for row in collector.db.daily_rows if row["metric_date"] != "2026-08-20"]
    assert all(row["data"]["sessions"] == 0 for row in zero_rows)
    assert all(row["data"]["pageviews"] == 0 for row in zero_rows)
