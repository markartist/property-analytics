#!/usr/bin/env python3
"""Build the VP-requested retrieval JSON, one object per property.

This is a contract-shaped data export for downstream diagnosis agents. It is not
a report renderer and does not touch PIB generation.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "property_diagnostics" / "vp_contract"


def as_of_date() -> date:
    return date(2026, 5, 6)


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        return round(value, 6)
    return value


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: compact(item)
            for key, item in value.items()
            if item is not None and compact(item) != {}
        }
    if isinstance(value, list):
        return [compact(item) for item in value if item is not None]
    return clean(value)


def direction(current: float | int | None, prior: float | int | None) -> str | None:
    if current is None or prior is None:
        return None
    if current > prior:
        return "improving"
    if current < prior:
        return "declining"
    return "flat"


def ratio(numerator: float | int | None, denominator: float | int | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return float(numerator) / float(denominator)


def normalize_marketing_source_label(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    lowered = text.lower()
    if lowered in {"adc", "apartments.com", "apartments.com / adc", "adc / apartments.com"}:
        return "Apartments.com / ADC"
    if lowered in {"drive by", "drive-by", "walk in", "walk-in", "walk in / drive-by", "walk-in / drive-by"}:
        return "Walk-In / Drive-By"
    return text


def build_channel_economics_rows(
    source_perf_rows: list[dict[str, Any]],
    cost_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    preferred_cost_rows: dict[str, dict[str, Any]] = {}
    for row in cost_rows:
        label = normalize_marketing_source_label(row.get("marketing_source_group") or row.get("marketing_source_desc"))
        if not label:
            continue
        current = preferred_cost_rows.get(label)
        if current is None or (current.get("calendar_month") is not None and row.get("calendar_month") is None):
            preferred_cost_rows[label] = row

    results: list[dict[str, Any]] = []
    for row in source_perf_rows:
        raw_label = row.get("source_group") or row.get("source_desc")
        if not raw_label or raw_label == "Total":
            continue
        label = normalize_marketing_source_label(raw_label) or str(raw_label)
        cost_row = preferred_cost_rows.get(label, {})
        guest_cards = clean(row.get("guest_cards"))
        visits = clean(row.get("visits"))
        applications = clean(row.get("applications"))
        leases = clean(row.get("leases"))
        move_ins = clean(row.get("move_ins"))
        cost_per_guest_card = clean(cost_row.get("cost_per_guest_card"))
        cost_per_visit = clean(cost_row.get("cost_per_visit"))
        cost_per_application = clean(cost_row.get("cost_per_application"))
        cost_per_lease = clean(cost_row.get("cost_per_lease"))

        estimated_spend = None
        if cost_per_lease is not None and leases not in (None, 0):
            estimated_spend = clean(cost_per_lease * float(leases))
        elif cost_per_application is not None and applications not in (None, 0):
            estimated_spend = clean(cost_per_application * float(applications))
        elif cost_per_guest_card is not None and guest_cards not in (None, 0):
            estimated_spend = clean(cost_per_guest_card * float(guest_cards))

        cost_per_move_in = None
        if estimated_spend is not None and move_ins not in (None, 0):
            cost_per_move_in = clean(float(estimated_spend) / float(move_ins))

        results.append(
            {
                "source": label,
                "guest_cards": guest_cards,
                "visits": visits,
                "applications": applications,
                "leases": leases,
                "move_ins": move_ins,
                "cost_per_guest_card": cost_per_guest_card,
                "cost_per_visit": cost_per_visit,
                "cost_per_application": cost_per_application,
                "cost_per_lease": cost_per_lease,
                "estimated_spend_basis": estimated_spend,
                "calculated_cost_per_move_in": cost_per_move_in,
            }
        )

    results.sort(
        key=lambda item: (
            -(float(item.get("leases") or 0)),
            -(float(item.get("move_ins") or 0)),
            -(float(item.get("guest_cards") or 0)),
            item.get("source") or "",
        )
    )
    return results


class VPRetrievalBuilder:
    def __init__(self, db_path: Path, as_of: date) -> None:
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.as_of = as_of
        self.current_month_start = as_of.replace(day=1).isoformat()
        self.missing_data: list[dict[str, Any]] = []

    def close(self) -> None:
        self.conn.close()

    def q1(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        row = self.conn.execute(sql, params).fetchone()
        return dict(row) if row else None

    def qall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        return [dict(row) for row in self.conn.execute(sql, params).fetchall()]

    def missing(self, path: str, expected_source: str, reason: str) -> None:
        if not any(item["path"] == path for item in self.missing_data):
            self.missing_data.append(
                {
                    "path": path,
                    "expected_source": expected_source,
                    "reason": reason,
                }
            )

    def metric(
        self,
        value: float | int | None,
        *,
        portfolio_average: float | int | None = None,
        prior_period_value: float | int | None = None,
        market_average: float | int | None = None,
        source: str | None = None,
        missing_path: str | None = None,
        expected_source: str | None = None,
        missing_reason: str | None = None,
    ) -> dict[str, Any]:
        if value is None and missing_path:
            self.missing(missing_path, expected_source or "unknown", missing_reason or "value unavailable")
            return compact(
                {
                    "available": False,
                    "missing_data_path": missing_path,
                    "source": source,
                }
            )
        payload = {
            "property_value": clean(value),
            "source": source,
        }
        if portfolio_average is not None:
            payload["portfolio_average"] = clean(portfolio_average)
            if value is not None:
                payload["delta_vs_portfolio"] = clean(value - portfolio_average)
        if market_average is not None:
            payload["market_average"] = clean(market_average)
            if value is not None:
                payload["delta_vs_market"] = clean(value - market_average)
        if prior_period_value is not None:
            payload["prior_period_value"] = clean(prior_period_value)
            payload["direction_of_change"] = direction(value, prior_period_value)
        return compact(payload)

    def periods(
        self,
        *,
        current_month: dict[str, Any],
        t30: dict[str, Any],
        t90: dict[str, Any],
    ) -> dict[str, Any]:
        return {"current_month": current_month, "t30": t30, "t90": t90}

    def latest_traffic(self, property_id: str) -> dict[str, Any] | None:
        return self.q1(
            """
            select *
            from marketing_bi_traffic_conversions_full
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )

    def traffic_portfolio(self, report_date: str | None) -> dict[str, Any]:
        if not report_date:
            return {}
        row = self.q1(
            """
            select avg(guest_cards_t30) guest_cards_t30_avg,
                   avg(guest_cards_t90) guest_cards_t90_avg,
                   avg(visits_t30) visits_t30_avg,
                   avg(visits_t90) visits_t90_avg,
                   avg(apps_t30) apps_t30_avg,
                   avg(apps_t90) apps_t90_avg,
                   avg(rfp_t30) rfp_t30_avg,
                   avg(rfp_t90) rfp_t90_avg,
                   avg(closing_ratio_t30) closing_ratio_t30_avg,
                   avg(cast(visits_t30 as real)/nullif(guest_cards_t30,0)) gc_visit_t30_avg,
                   avg(cast(visits_t90 as real)/nullif(guest_cards_t90,0)) gc_visit_t90_avg,
                   avg(cast(apps_t30 as real)/nullif(visits_t30,0)) visit_app_t30_avg,
                   avg(cast(apps_t90 as real)/nullif(visits_t90,0)) visit_app_t90_avg,
                   avg(cast(rfp_t30 as real)/nullif(apps_t30,0)) app_lease_t30_avg,
                   avg(cast(rfp_t90 as real)/nullif(apps_t90,0)) app_lease_t90_avg
            from marketing_bi_traffic_conversions_full
            where report_date = ?
            """,
            (report_date,),
        )
        return row or {}

    def current_month_perf(self, property_id: str) -> dict[str, Any] | None:
        return self.q1(
            """
            select *
            from marketing_bi_ad_spend_performance_month
            where property_id = ?
              and calendar_month = ?
            order by report_date desc
            limit 1
            """,
            (property_id, self.current_month_start),
        )

    def current_month_perf_portfolio(self, report_date: str | None) -> dict[str, Any]:
        if not report_date:
            return {}
        return self.q1(
            """
            select avg(guest_cards) guest_cards_avg,
                   avg(visits) visits_avg,
                   avg(leases) leases_avg,
                   avg(ad_spend_total) ad_spend_avg,
                   avg(cast(visits as real)/nullif(guest_cards,0)) gc_visit_avg,
                   avg(cast(leases as real)/nullif(guest_cards,0)) closing_ratio_avg
            from marketing_bi_ad_spend_performance_month
            where report_date = ?
              and calendar_month = ?
            """,
            (report_date, self.current_month_start),
        ) or {}

    def ga4_window(self, ga4_id: str, start: date, end: date) -> dict[str, Any]:
        return self.q1(
            """
            select sum(sessions) sessions,
                   sum(conversions) conversions,
                   cast(sum(conversions) as real)/nullif(sum(sessions),0) conversion_rate,
                   avg(bounce_rate) bounce_rate,
                   avg(avg_session_duration) time_on_site
            from ga4_daily_metrics
            where property_id = ?
              and metric_date between ? and ?
            """,
            (ga4_id, start.isoformat(), end.isoformat()),
        ) or {}

    def ga4_portfolio_window(self, start: date, end: date) -> dict[str, Any]:
        return self.q1(
            """
            select avg(sessions_sum) sessions_avg,
                   avg(conversions_sum) conversions_avg,
                   avg(conversion_rate_calc) conversion_rate_avg,
                   avg(bounce_rate_avg) bounce_rate_avg,
                   avg(time_on_site_avg) time_on_site_avg
            from (
              select property_id,
                     sum(sessions) sessions_sum,
                     sum(conversions) conversions_sum,
                     cast(sum(conversions) as real)/nullif(sum(sessions),0) conversion_rate_calc,
                     avg(bounce_rate) bounce_rate_avg,
                     avg(avg_session_duration) time_on_site_avg
              from ga4_daily_metrics
              where metric_date between ? and ?
              group by property_id
            )
            """,
            (start.isoformat(), end.isoformat()),
        ) or {}

    def ga4_channels(self, ga4_id: str, start: date, end: date) -> dict[str, Any]:
        rows = self.qall(
            """
            select channel_group,
                   sum(sessions) sessions,
                   sum(conversions) conversions,
                   avg(bounce_rate) bounce_rate,
                   avg(engagement_rate) engagement_rate
            from ga4_traffic_sources
            where property_id = ?
              and metric_date between ? and ?
            group by channel_group
            """,
            (ga4_id, start.isoformat(), end.isoformat()),
        )
        return {row["channel_group"]: {key: clean(value) for key, value in row.items() if key != "channel_group"} for row in rows}

    def channel_sessions(self, channels: dict[str, Any], names: tuple[str, ...]) -> int | None:
        total = 0
        found = False
        for name, values in channels.items():
            if any(token.lower() in name.lower() for token in names):
                total += values.get("sessions") or 0
                found = True
        return total if found else None

    def inventory(self, property_id: str, ga4_id: str) -> dict[str, Any]:
        latest = self.q1(
            """
            select max(snapshot_date) snapshot_date
            from unit_availability_units
            where feed_property_id = ? or property_id = ?
            """,
            (property_id, ga4_id),
        )
        snapshot_date = latest["snapshot_date"] if latest else None
        row = self.q1(
            """
            select count(*) available_units
            from unit_availability_units
            where snapshot_date = ?
              and (feed_property_id = ? or property_id = ?)
            """,
            (snapshot_date, property_id, ga4_id),
        ) if snapshot_date else None
        port = self.q1(
            """
            select avg(available_units) available_units_avg
            from (
              select coalesce(feed_property_id, property_id) pid, count(*) available_units
              from unit_availability_units
              where snapshot_date = ?
              group by coalesce(feed_property_id, property_id)
            )
            """,
            (snapshot_date,),
        ) if snapshot_date else {}
        return {"snapshot_date": snapshot_date, "row": row or {}, "portfolio": port or {}}

    def inventory_window_average(self, property_id: str, ga4_id: str, start: date, end: date) -> dict[str, Any]:
        return self.q1(
            """
            with property_daily as (
              select snapshot_date, count(*) available_units
              from unit_availability_units
              where snapshot_date between ? and ?
                and (feed_property_id = ? or property_id = ?)
              group by snapshot_date
            ),
            portfolio_daily as (
              select snapshot_date, coalesce(feed_property_id, property_id) pid, count(*) available_units
              from unit_availability_units
              where snapshot_date between ? and ?
              group by snapshot_date, coalesce(feed_property_id, property_id)
            ),
            portfolio_property_avg as (
              select pid, avg(available_units) available_units_avg
              from portfolio_daily
              group by pid
            )
            select (select avg(available_units) from property_daily) available_units_avg,
                   (select avg(available_units_avg) from portfolio_property_avg) portfolio_available_units_avg
            """,
            (start.isoformat(), end.isoformat(), property_id, ga4_id, start.isoformat(), end.isoformat()),
        ) or {}

    def box_score(self, property_id: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
        row = self.q1(
            """
            select *
            from marketing_bi_portfolio_box_score_rows
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )
        port = self.q1(
            """
            select avg(physical_occupancy_pct) physical_occupancy_pct_avg,
                   avg(current_occupancy_rent) current_occupancy_rent_avg,
                   avg(net_effective_rent) net_effective_rent_avg,
                   avg(make_ready_pct) make_ready_pct_avg,
                   avg(ready_available) ready_available_avg,
                   avg(current_occupancy_rent - net_effective_rent) rent_vs_comp_avg,
                   avg(ntv) expirations_avg
            from marketing_bi_portfolio_box_score_rows
            where report_date = (select max(report_date) from marketing_bi_portfolio_box_score_rows)
            """
        ) or {}
        return row, port

    def marketing_ops(self, property_id: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
        row = self.q1(
            """
            select *
            from marketing_ops_summary_rows
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )
        port = self.q1(
            """
            select avg(traffic_per_unit) traffic_per_unit_avg,
                   avg(occupancy) occupancy_avg,
                   avg(atr) atr_avg,
                   avg(atr30) atr30_avg,
                   avg(current_month_expirations) current_month_expirations_avg
            from marketing_ops_summary_rows
            where report_date = (select max(report_date) from marketing_ops_summary_rows)
            """
        ) or {}
        return row, port

    def source_performance_rows(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            "select max(report_date) report_date from marketing_bi_source_performance_rows where property_id = ?",
            (property_id,),
        )
        report_date = latest["report_date"] if latest else None
        if not report_date:
            return []
        preferred = self.q1(
            """
            select export_name
            from marketing_bi_source_performance_rows
            where property_id = ?
              and report_date = ?
              and export_name like 'perf-by-source-%'
            limit 1
            """,
            (property_id, report_date),
        )
        export_name = preferred["export_name"] if preferred else None
        return self.qall(
            """
            select source_group, source_desc, guest_cards, visits, first_tours, applications,
                   leases, cancel_denials, move_ins, visit_guest_card_conversion,
                   app_guest_card_conversion, lease_guest_card_conversion, lease_visit_ratio,
                   cancel_denial_pct_of_guest_cards, move_in_guest_card_conversion,
                   move_in_visit_ratio, guest_cards_delta, visits_delta, applications_delta,
                   leases_delta, cancel_denials_delta, move_ins_delta, report_date, export_name
            from marketing_bi_source_performance_rows
            where property_id = ?
              and report_date = ?
              and (? is null or export_name = ?)
            order by case when source_group = 'Total' then 0 else 1 end, guest_cards desc
            """,
            (property_id, report_date, export_name, export_name),
        )

    def source_spend_rows(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            "select max(report_date) report_date from marketing_bi_monthly_ad_spend_source_rows where property_id = ?",
            (property_id,),
        )
        report_date = latest["report_date"] if latest else None
        if not report_date:
            return []
        return self.qall(
            """
            select calendar_month, source_group, ad_spend_total, month_total, month_budget,
                   month_actual_vs_budget_delta, annual_budget, annual_spend_trend_to_date,
                   annual_trend_delta_to_date
            from marketing_bi_monthly_ad_spend_source_rows
            where property_id = ?
              and report_date = ?
            order by calendar_month desc, source_group
            """,
            (property_id, report_date),
        )

    def cost_rows(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            "select max(report_date) report_date from marketing_bi_cost_per_conversion_rows where property_id = ?",
            (property_id,),
        )
        report_date = latest["report_date"] if latest else None
        if not report_date:
            return []
        return self.qall(
            """
            select calendar_month, marketing_source_group, marketing_source_desc,
                   cost_per_guest_card, cost_per_visit, cost_per_application,
                   cost_per_lease, invalid_value_count
            from marketing_bi_cost_per_conversion_rows
            where property_id = ?
              and report_date = ?
            order by calendar_month desc, marketing_source_group
            """,
            (property_id, report_date),
        )

    def reputation(self, property_id: str) -> dict[str, Any]:
        latest = self.q1(
            """
            select *
            from reputation_com_location_leaderboard
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )
        port = self.q1(
            """
            select avg(average_rating) average_rating_avg,
                   avg(reputation_score) reputation_score_avg,
                   avg(response_rate) response_rate_avg
            from reputation_com_location_leaderboard
            where report_date = (select max(report_date) from reputation_com_location_leaderboard)
            """
        ) or {}
        trend = self.qall(
            """
            select score_month, reputation_score
            from reputation_com_score_time_series
            where property_id = ?
            order by score_month desc
            limit 6
            """,
            (property_id,),
        )
        themes_row = self.q1(
            """
            select sum(theme_maintenance) maintenance,
                   sum(theme_staff) staff,
                   sum(theme_amenities) amenities,
                   sum(theme_noise) noise,
                   sum(theme_location) location,
                   sum(theme_value) value,
                   sum(theme_move_in) move_in,
                   sum(theme_move_out) move_out,
                   sum(theme_pets) pets,
                   sum(theme_parking) parking
            from gbp_review_sentiment
            where property_id = ?
            """,
            (property_id,),
        ) or {}
        themes = [
            {"theme": key, "count": int(value)}
            for key, value in themes_row.items()
            if value
        ]
        themes.sort(key=lambda item: item["count"], reverse=True)
        return {"latest": latest, "portfolio": port, "trend": trend, "themes": themes[:5]}

    def website(self, property_id: str, ga4_id: str) -> dict[str, Any]:
        latest_date = self.q1(
            "select max(metric_date) metric_date from pagespeed_metrics where property_id = ?",
            (ga4_id,),
        )
        metric_date = latest_date["metric_date"] if latest_date else None
        psi_rows = self.qall(
            """
            select strategy, performance_score, lcp_value, cls_value, fid_value,
                   fcp_value, ttfb_value, speed_index, time_to_interactive,
                   total_blocking_time
            from pagespeed_metrics
            where property_id = ?
              and metric_date = ?
            order by strategy
            """,
            (ga4_id, metric_date),
        ) if metric_date else []
        port = self.qall(
            """
            select strategy,
                   avg(performance_score) performance_score_avg,
                   avg(lcp_value) lcp_value_avg,
                   avg(cls_value) cls_value_avg,
                   avg(fid_value) fid_value_avg
            from pagespeed_metrics
            where metric_date = ?
            group by strategy
            """,
            (metric_date,),
        ) if metric_date else []
        onpage = self.q1(
            """
            select *
            from dataforseo_onpage_page_snapshots
            where property_id = ?
            order by run_date desc
            limit 1
            """,
            (property_id,),
        )
        return {"metric_date": metric_date, "psi_rows": psi_rows, "portfolio": {r["strategy"]: r for r in port}, "onpage": onpage}

    def psi_window(self, ga4_id: str, strategy: str, start: date, end: date) -> dict[str, Any]:
        return self.q1(
            """
            select avg(performance_score) performance_score,
                   avg(lcp_value) lcp_value,
                   avg(cls_value) cls_value,
                   avg(fid_value) fid_value
            from pagespeed_metrics
            where property_id = ?
              and strategy = ?
              and metric_date between ? and ?
            """,
            (ga4_id, strategy, start.isoformat(), end.isoformat()),
        ) or {}

    def psi_portfolio_window(self, strategy: str, start: date, end: date) -> dict[str, Any]:
        return self.q1(
            """
            select avg(property_score) performance_score_avg,
                   avg(property_lcp) lcp_value_avg,
                   avg(property_cls) cls_value_avg,
                   avg(property_fid) fid_value_avg
            from (
              select property_id,
                     avg(performance_score) property_score,
                     avg(lcp_value) property_lcp,
                     avg(cls_value) property_cls,
                     avg(fid_value) property_fid
              from pagespeed_metrics
              where strategy = ?
                and metric_date between ? and ?
              group by property_id
            )
            """,
            (strategy, start.isoformat(), end.isoformat()),
        ) or {}

    def spend_period_summary(self, rows: list[dict[str, Any]], months: set[str]) -> dict[str, Any]:
        month_rows = [row for row in rows if row.get("calendar_month") in months]
        if not month_rows:
            return {}
        month_totals: dict[str, tuple[float, float]] = {}
        for row in month_rows:
            month = row["calendar_month"]
            month_totals[month] = (row.get("month_total") or 0.0, row.get("month_budget") or 0.0)
        return {
            "spend_total": sum(value[0] for value in month_totals.values()),
            "budget_total": sum(value[1] for value in month_totals.values()),
            "budget_vs_actual": sum(value[0] - value[1] for value in month_totals.values()),
        }

    def market_survey(self, property_id: str, ga4_id: str) -> dict[str, Any]:
        latest_comp = self.q1(
            """
            select max(snapshot_date) snapshot_date
            from competitor_market_research_observations
            where property_id = ?
              and rent_min is not null
            """,
            (property_id,),
        )
        comp_date = latest_comp["snapshot_date"] if latest_comp else None
        comp_rows = self.qall(
            """
            select competitor_name, rent_min, rent_max, special_text, confidence, source_name, source_url
            from competitor_market_research_observations
            where property_id = ?
              and snapshot_date = ?
              and rent_min is not null
            order by competitor_name
            """,
            (property_id, comp_date),
        ) if comp_date else []
        comp_avg = self.q1(
            """
            select avg(rent_min) rent_min_avg, avg(rent_max) rent_max_avg
            from competitor_market_research_observations
            where property_id = ?
              and snapshot_date = ?
              and rent_min is not null
            """,
            (property_id, comp_date),
        ) if comp_date else {}
        latest_units = self.q1(
            """
            select max(snapshot_date) snapshot_date
            from unit_availability_units
            where feed_property_id = ? or property_id = ?
            """,
            (property_id, ga4_id),
        )
        unit_date = latest_units["snapshot_date"] if latest_units else None
        subject = self.q1(
            """
            select min(nullif(rent_from, -1)) visible_rent_min,
                   max(nullif(rent_to, -1)) visible_rent_max
            from unit_availability_units
            where snapshot_date = ?
              and (feed_property_id = ? or property_id = ?)
            """,
            (unit_date, property_id, ga4_id),
        ) if unit_date else {}
        return {
            "snapshot_date": comp_date,
            "subject_visible_rent_min": (subject or {}).get("visible_rent_min"),
            "subject_visible_rent_max": (subject or {}).get("visible_rent_max"),
            "competitor_rent_min_average": (comp_avg or {}).get("rent_min_avg"),
            "competitor_rent_max_average": (comp_avg or {}).get("rent_max_avg"),
            "rows": comp_rows,
        }

    def time_windows(self) -> dict[str, tuple[date, date, date, date]]:
        current_start = self.as_of.replace(day=1)
        t30_start = self.as_of - timedelta(days=29)
        t90_start = self.as_of - timedelta(days=89)
        return {
            "current_month": (current_start, self.as_of, current_start - timedelta(days=(self.as_of - current_start).days + 1), current_start - timedelta(days=1)),
            "t30": (t30_start, self.as_of, t30_start - timedelta(days=30), self.as_of - timedelta(days=30)),
            "t90": (t90_start, self.as_of, t90_start - timedelta(days=90), self.as_of - timedelta(days=90)),
        }

    def ga4_metric_periods(self, ga4_id: str, field: str, source_path: str) -> dict[str, Any]:
        windows = self.time_windows()
        result = {}
        for period, (start, end, prior_start, prior_end) in windows.items():
            cur = self.ga4_window(ga4_id, start, end)
            prior = self.ga4_window(ga4_id, prior_start, prior_end)
            port = self.ga4_portfolio_window(start, end)
            result[period] = self.metric(
                cur.get(field),
                portfolio_average=port.get(f"{field}_avg"),
                prior_period_value=prior.get(field),
                source="ga4_daily_metrics",
                missing_path=f"{source_path}.{period}" if cur.get(field) is None else None,
                expected_source="ga4_daily_metrics",
                missing_reason=f"GA4 {field} unavailable for {period}",
            )
        return result

    def build(self, property_lookup: str) -> dict[str, Any]:
        identity = resolve_property_identity(property_lookup)
        if not identity:
            raise SystemExit(f"Could not resolve property: {property_lookup}")

        property_id = identity.marketing_bi_property_id
        ga4_id = identity.ga4_property_id or property_id

        traffic = self.latest_traffic(property_id) or {}
        traffic_port = self.traffic_portfolio(traffic.get("report_date"))
        current_perf = self.current_month_perf(property_id) or {}
        current_perf_port = self.current_month_perf_portfolio(current_perf.get("report_date"))
        inventory = self.inventory(property_id, ga4_id)
        box, box_port = self.box_score(property_id)
        box = box or {}
        ops, ops_port = self.marketing_ops(property_id)
        ops = ops or {}
        source_perf = self.source_performance_rows(property_id)
        source_total = next((row for row in source_perf if row.get("source_group") == "Total"), {})
        source_spend = self.source_spend_rows(property_id)
        cost_rows = self.cost_rows(property_id)
        channel_economics = build_channel_economics_rows(source_perf, cost_rows)
        rep = self.reputation(property_id)
        web = self.website(property_id, ga4_id)
        market = self.market_survey(property_id, ga4_id)

        available_units_value = inventory["row"].get("available_units")
        available_units_port = inventory["portfolio"].get("available_units_avg")
        traffic_per_unit_current = ratio(current_perf.get("guest_cards"), available_units_value)
        traffic_per_unit_t30 = ratio(traffic.get("guest_cards_t30"), available_units_value)
        traffic_per_unit_t90 = ratio(traffic.get("guest_cards_t90"), available_units_value)

        current_channels = self.ga4_channels(ga4_id, self.as_of.replace(day=1), self.as_of)
        t30_channels = self.ga4_channels(ga4_id, self.as_of - timedelta(days=29), self.as_of)
        t90_channels = self.ga4_channels(ga4_id, self.as_of - timedelta(days=89), self.as_of)
        windows = self.time_windows()
        inv_t30 = self.inventory_window_average(property_id, ga4_id, windows["t30"][0], windows["t30"][1])
        inv_t90 = self.inventory_window_average(property_id, ga4_id, windows["t90"][0], windows["t90"][1])

        def traffic_metric(field: str, t30_port: str, t90_port: str, current_port: str) -> dict[str, Any]:
            return self.periods(
                current_month=self.metric(
                    current_perf.get(field),
                    portfolio_average=current_perf_port.get(current_port),
                    source="marketing_bi_ad_spend_performance_month",
                    missing_path=f"demand_signals.guest_cards_total.current_month" if field == "guest_cards" and current_perf.get(field) is None else None,
                    expected_source="marketing_bi_ad_spend_performance_month",
                ),
                t30=self.metric(
                    traffic.get(f"{field}_t30"),
                    portfolio_average=traffic_port.get(t30_port),
                    prior_period_value=traffic.get(f"{field}_t30_py"),
                    source="marketing_bi_traffic_conversions_full",
                ),
                t90=self.metric(
                    traffic.get(f"{field}_t90"),
                    portfolio_average=traffic_port.get(t90_port),
                    prior_period_value=traffic.get(f"{field}_t90_py"),
                    source="marketing_bi_traffic_conversions_full",
                ),
            )

        demand_signals = {
            "guest_cards": {
                "total": traffic_metric("guest_cards", "guest_cards_t30_avg", "guest_cards_t90_avg", "guest_cards_avg"),
                "by_source": [
                    {
                        "source": row.get("source_group"),
                        "latest_bi_export": {
                            "guest_cards": clean(row.get("guest_cards")),
                            "visits": clean(row.get("visits")),
                            "applications": clean(row.get("applications")),
                            "leases": clean(row.get("leases")),
                            "move_ins": clean(row.get("move_ins")),
                            "guest_cards_delta": clean(row.get("guest_cards_delta")),
                            "report_date": row.get("report_date"),
                            "source": "marketing_bi_source_performance_rows",
                        },
                    }
                    for row in source_perf
                    if row.get("source_group") and row.get("source_group") != "Total"
                ],
            },
            "inquiries_per_available_unit": self.periods(
                current_month=self.metric(traffic_per_unit_current, source="marketing_bi_ad_spend_performance_month + unit_availability_units"),
                t30=self.metric(traffic_per_unit_t30, portfolio_average=ops_port.get("traffic_per_unit_avg"), source="marketing_bi_traffic_conversions_full + unit_availability_units"),
                t90=self.metric(traffic_per_unit_t90, source="marketing_bi_traffic_conversions_full + unit_availability_units"),
            ),
            "traffic_by_source": {
                "current_month": current_channels,
                "t30": t30_channels,
                "t90": t90_channels,
                "source": "ga4_traffic_sources",
            },
            "website_engagement": {
                "sessions": self.ga4_metric_periods(ga4_id, "sessions", "demand_signals.website_engagement.sessions"),
                "conversion_rate": self.ga4_metric_periods(ga4_id, "conversion_rate", "demand_signals.website_engagement.conversion_rate"),
                "bounce_rate": self.ga4_metric_periods(ga4_id, "bounce_rate", "demand_signals.website_engagement.bounce_rate"),
                "time_on_site": self.ga4_metric_periods(ga4_id, "time_on_site", "demand_signals.website_engagement.time_on_site"),
                "organic": {
                    "current_month": self.metric(self.channel_sessions(current_channels, ("Organic Search",)), source="ga4_traffic_sources"),
                    "t30": self.metric(self.channel_sessions(t30_channels, ("Organic Search",)), source="ga4_traffic_sources"),
                    "t90": self.metric(self.channel_sessions(t90_channels, ("Organic Search",)), source="ga4_traffic_sources"),
                },
                "pd": {
                    "current_month": self.metric(self.channel_sessions(current_channels, ("Paid", "Cross-network")), source="ga4_traffic_sources"),
                    "t30": self.metric(self.channel_sessions(t30_channels, ("Paid", "Cross-network")), source="ga4_traffic_sources"),
                    "t90": self.metric(self.channel_sessions(t90_channels, ("Paid", "Cross-network")), source="ga4_traffic_sources"),
                },
                "referral": {
                    "current_month": self.metric(self.channel_sessions(current_channels, ("Referral",)), source="ga4_traffic_sources"),
                    "t30": self.metric(self.channel_sessions(t30_channels, ("Referral",)), source="ga4_traffic_sources"),
                    "t90": self.metric(self.channel_sessions(t90_channels, ("Referral",)), source="ga4_traffic_sources"),
                },
            },
        }

        funnel_conversion = {
            "gc_to_visit": self.periods(
                current_month=self.metric(ratio(current_perf.get("visits"), current_perf.get("guest_cards")), portfolio_average=current_perf_port.get("gc_visit_avg"), source="marketing_bi_ad_spend_performance_month"),
                t30=self.metric(ratio(traffic.get("visits_t30"), traffic.get("guest_cards_t30")), portfolio_average=traffic_port.get("gc_visit_t30_avg"), prior_period_value=ratio(traffic.get("visits_t30_py"), traffic.get("guest_cards_t30_py")), source="marketing_bi_traffic_conversions_full"),
                t90=self.metric(ratio(traffic.get("visits_t90"), traffic.get("guest_cards_t90")), portfolio_average=traffic_port.get("gc_visit_t90_avg"), prior_period_value=ratio(traffic.get("visits_t90_py"), traffic.get("guest_cards_t90_py")), source="marketing_bi_traffic_conversions_full"),
            ),
            "visit_to_application": self.periods(
                current_month=self.metric(None, missing_path="funnel_conversion.visit_to_application.current_month", expected_source="current-month BI funnel source", missing_reason="Current-month applications are not present in the current-month spend/performance export."),
                t30=self.metric(ratio(traffic.get("apps_t30"), traffic.get("visits_t30")), portfolio_average=traffic_port.get("visit_app_t30_avg"), prior_period_value=ratio(traffic.get("apps_t30_py"), traffic.get("visits_t30_py")), source="marketing_bi_traffic_conversions_full"),
                t90=self.metric(ratio(traffic.get("apps_t90"), traffic.get("visits_t90")), portfolio_average=traffic_port.get("visit_app_t90_avg"), prior_period_value=ratio(traffic.get("apps_t90_py"), traffic.get("visits_t90_py")), source="marketing_bi_traffic_conversions_full"),
            ),
            "application_to_lease": self.periods(
                current_month=self.metric(None, missing_path="funnel_conversion.application_to_lease.current_month", expected_source="current-month BI funnel source", missing_reason="Current-month applications are not present in the current-month spend/performance export."),
                t30=self.metric(ratio(traffic.get("rfp_t30"), traffic.get("apps_t30")), portfolio_average=traffic_port.get("app_lease_t30_avg"), prior_period_value=ratio(traffic.get("rfp_t30_py"), traffic.get("apps_t30_py")), source="marketing_bi_traffic_conversions_full"),
                t90=self.metric(ratio(traffic.get("rfp_t90"), traffic.get("apps_t90")), portfolio_average=traffic_port.get("app_lease_t90_avg"), prior_period_value=ratio(traffic.get("rfp_t90_py"), traffic.get("apps_t90_py")), source="marketing_bi_traffic_conversions_full"),
            ),
            "abandoned_applications": {
                "count": self.metric(
                    None,
                    missing_path="funnel_conversion.abandoned_applications.count",
                    expected_source="marketing_bi_abandoned_application_rows with property key",
                    missing_reason="Abandoned application export is loaded but has no property id/name/region/community key.",
                ),
                "percent_of_total_applications": self.metric(
                    None,
                    missing_path="funnel_conversion.abandoned_applications.percent_of_total_applications",
                    expected_source="marketing_bi_abandoned_application_rows with property key",
                    missing_reason="Cannot calculate property-level abandoned application percentage without property-attributed abandoned count.",
                ),
                "property_attribution_status": "source_loaded_no_property_key",
                "loaded_rows": self.q1("select count(*) rows from marketing_bi_abandoned_application_rows")["rows"],
                "latest_report_date": self.q1("select max(report_date) latest from marketing_bi_abandoned_application_rows")["latest"],
                "publish_property_count": False,
                "source": "marketing_bi_abandoned_application_rows",
            },
        }

        inventory_product = {
            "available_units": self.periods(
                current_month=self.metric(available_units_value, portfolio_average=available_units_port, source="unit_availability_units"),
                t30=self.metric(inv_t30.get("available_units_avg"), portfolio_average=inv_t30.get("portfolio_available_units_avg"), source="unit_availability_units"),
                t90=self.metric(inv_t90.get("available_units_avg"), portfolio_average=inv_t90.get("portfolio_available_units_avg"), source="unit_availability_units"),
            ),
            "vacant_ready_percentage": self.periods(
                current_month=self.metric(box.get("make_ready_pct"), portfolio_average=box_port.get("make_ready_pct_avg"), source="marketing_bi_portfolio_box_score_rows"),
                t30=self.metric(None, missing_path="inventory_product.vacant_ready_percentage.t30", expected_source="Portfolio Box Score history", missing_reason="T30 vacant-ready percentage history is not present in the current route."),
                t90=self.metric(None, missing_path="inventory_product.vacant_ready_percentage.t90", expected_source="Portfolio Box Score history", missing_reason="T90 vacant-ready percentage history is not present in the current route."),
            ),
        }

        demand_inventory_matching = {
            "available_units_vs_inquiries": {
                "current_month": {
                    "available_units": clean(available_units_value),
                    "inquiries": clean(current_perf.get("guest_cards")),
                    "inquiries_per_available_unit": clean(traffic_per_unit_current),
                    "source": "unit_availability_units + marketing_bi_ad_spend_performance_month",
                },
                "t30": {
                    "available_units": clean(available_units_value),
                    "inquiries": clean(traffic.get("guest_cards_t30")),
                    "inquiries_per_available_unit": clean(traffic_per_unit_t30),
                    "source": "unit_availability_units + marketing_bi_traffic_conversions_full",
                },
                "t90": {
                    "available_units": clean(available_units_value),
                    "inquiries": clean(traffic.get("guest_cards_t90")),
                    "inquiries_per_available_unit": clean(traffic_per_unit_t90),
                    "source": "unit_availability_units + marketing_bi_traffic_conversions_full",
                },
            }
        }

        pricing_market_position = {
            "box_score": {
                "occupancy": self.periods(
                    current_month=self.metric(box.get("physical_occupancy_pct"), portfolio_average=box_port.get("physical_occupancy_pct_avg"), source="marketing_bi_portfolio_box_score_rows"),
                    t30=self.metric(box.get("occupancy_30_pct"), source="marketing_bi_portfolio_box_score_rows"),
                    t90=self.metric(None, missing_path="pricing_market_position.box_score.occupancy.t90", expected_source="Portfolio Box Score", missing_reason="T90 occupancy is not included in the current box-score export."),
                ),
                "atr": self.periods(
                    current_month=self.metric(ops.get("atr"), portfolio_average=ops_port.get("atr_avg"), source="marketing_ops_summary_rows"),
                    t30=self.metric(ops.get("atr30"), portfolio_average=ops_port.get("atr30_avg"), source="marketing_ops_summary_rows"),
                    t90=self.metric(None, missing_path="pricing_market_position.box_score.atr.t90", expected_source="Marketing Ops Summary", missing_reason="T90 ATR is not included in the current route."),
                ),
                "rent_vs_comp": self.periods(
                    current_month=self.metric(
                        market.get("subject_visible_rent_min"),
                        market_average=market.get("competitor_rent_min_average"),
                        source="competitor_market_research_observations + unit_availability_units" if market.get("rows") else None,
                        missing_path="pricing_market_position.box_score.rent_vs_comp.current_month" if not market.get("rows") else None,
                        expected_source="market survey inputs",
                        missing_reason="No competitor rent rows are loaded for this property.",
                    ),
                    t30=self.metric(None, missing_path="pricing_market_position.box_score.rent_vs_comp.t30", expected_source="market survey inputs", missing_reason="T30 rent-vs-market comparison is not loaded."),
                    t90=self.metric(None, missing_path="pricing_market_position.box_score.rent_vs_comp.t90", expected_source="market survey inputs", missing_reason="T90 rent-vs-market comparison is not loaded."),
                ),
                "make_ready_percentage": self.periods(
                    current_month=self.metric(box.get("make_ready_pct"), portfolio_average=box_port.get("make_ready_pct_avg"), source="marketing_bi_portfolio_box_score_rows"),
                    t30=self.metric(None, missing_path="pricing_market_position.box_score.make_ready_percentage.t30", expected_source="Portfolio Box Score history", missing_reason="T30 make-ready history is not present in current route."),
                    t90=self.metric(None, missing_path="pricing_market_position.box_score.make_ready_percentage.t90", expected_source="Portfolio Box Score history", missing_reason="T90 make-ready history is not present in current route."),
                ),
                "expirations": self.periods(
                    current_month=self.metric(ops.get("current_month_expirations"), portfolio_average=ops_port.get("current_month_expirations_avg"), source="marketing_ops_summary_rows"),
                    t30=self.metric(None, missing_path="pricing_market_position.box_score.expirations.t30", expected_source="Marketing Ops expiration history", missing_reason="T30 expirations are not present in current route."),
                    t90=self.metric(ops.get("forward_3_month_expirations"), source="marketing_ops_summary_rows"),
                ),
            },
            "market_survey_inputs": {
                "available": bool(market.get("rows")),
                "snapshot_date": market.get("snapshot_date"),
                "subject_visible_rent_min": clean(market.get("subject_visible_rent_min")),
                "subject_visible_rent_max": clean(market.get("subject_visible_rent_max")),
                "competitor_rent_min_average": clean(market.get("competitor_rent_min_average")),
                "competitor_rent_max_average": clean(market.get("competitor_rent_max_average")),
                "competitors": [{key: clean(value) for key, value in row.items()} for row in market.get("rows", [])],
                "source": "competitor_market_research_observations" if market.get("rows") else None,
            },
        }

        current_month_spend = [row for row in source_spend if row.get("calendar_month") == self.current_month_start]
        spend_total = current_month_spend[0].get("month_total") if current_month_spend else None
        budget = current_month_spend[0].get("month_budget") if current_month_spend else None
        spend_t30 = self.spend_period_summary(source_spend, {"2026-04-01"})
        spend_t90 = self.spend_period_summary(source_spend, {"2026-03-01", "2026-04-01", "2026-05-01"})

        marketing_efficiency = {
            "spend_by_source": {
                "current_month": [
                    {key: clean(value) for key, value in row.items()}
                    for row in current_month_spend
                ],
                "t30": [
                    {key: clean(value) for key, value in row.items()}
                    for row in source_spend
                    if row.get("calendar_month") == "2026-04-01"
                ],
                "t90": [
                    {key: clean(value) for key, value in row.items()}
                    for row in source_spend
                    if row.get("calendar_month") in {"2026-03-01", "2026-04-01", "2026-05-01"}
                ],
                "source": "marketing_bi_monthly_ad_spend_source_rows",
            },
            "budget_vs_actual": self.periods(
                current_month=self.metric(None if spend_total is None or budget is None else spend_total - budget, source="marketing_bi_monthly_ad_spend_source_rows"),
                t30=self.metric(spend_t30.get("budget_vs_actual"), source="marketing_bi_monthly_ad_spend_source_rows"),
                t90=self.metric(spend_t90.get("budget_vs_actual"), source="marketing_bi_monthly_ad_spend_source_rows"),
            ),
            "cost_per_move_in": {
                "current_month": self.metric(None, missing_path="marketing_efficiency.cost_per_move_in.current_month", expected_source="spend workbook + current-month move-in source", missing_reason="Current-month move-in count is not present in the spend workbook route."),
                "t30": self.metric(None, missing_path="marketing_efficiency.cost_per_move_in.t30", expected_source="spend workbook + move-in source history", missing_reason="T30 source-level move-in cost is not materialized in current route."),
                "t90": self.metric(None, missing_path="marketing_efficiency.cost_per_move_in.t90", expected_source="spend workbook + move-in source history", missing_reason="T90 source-level move-in cost is not materialized in current route."),
                "by_source": channel_economics,
                "source": "marketing_bi_cost_per_conversion_rows + marketing_bi_source_performance_rows",
            },
            "cost_per_guest_card": self.periods(
                current_month=self.metric(ratio(spend_total, current_perf.get("guest_cards")), source="marketing_bi_monthly_ad_spend_source_rows + marketing_bi_ad_spend_performance_month"),
                t30=self.metric(ratio(spend_t30.get("spend_total"), traffic.get("guest_cards_t30")), source="marketing_bi_monthly_ad_spend_source_rows + marketing_bi_traffic_conversions_full"),
                t90=self.metric(ratio(spend_t90.get("spend_total"), traffic.get("guest_cards_t90")), source="marketing_bi_monthly_ad_spend_source_rows + marketing_bi_traffic_conversions_full"),
            ),
            "cost_per_conversion_by_source": [
                {key: clean(value) for key, value in row.items()}
                for row in cost_rows
            ],
            "channel_economics_by_source": channel_economics,
        }

        reputation_product_friction = {
            "rating": self.periods(
                current_month=self.metric((rep["latest"] or {}).get("average_rating"), portfolio_average=rep["portfolio"].get("average_rating_avg"), source="reputation_com_location_leaderboard"),
                t30=self.metric(None, missing_path="reputation_product_friction.rating.t30", expected_source="Reputation.com trend export", missing_reason="Rating trend by T30 is not present; reputation score trend is available."),
                t90=self.metric(None, missing_path="reputation_product_friction.rating.t90", expected_source="Reputation.com trend export", missing_reason="Rating trend by T90 is not present; reputation score trend is available."),
            ),
            "trend_over_time": [{key: clean(value) for key, value in row.items()} for row in rep["trend"]],
            "top_complaint_themes": rep["themes"],
        }

        psi_by_strategy = {row["strategy"]: row for row in web["psi_rows"]}
        psi_port = web["portfolio"]
        onpage = web["onpage"] or {}
        checks = json.loads(onpage.get("checks_json") or "{}") if onpage else {}
        h1s = json.loads(onpage.get("h1_json") or "[]") if onpage else []
        mobile = psi_by_strategy.get("mobile", {})
        desktop = psi_by_strategy.get("desktop", {})
        psi_mobile_t30 = self.psi_window(ga4_id, "mobile", windows["t30"][0], windows["t30"][1])
        psi_mobile_t90 = self.psi_window(ga4_id, "mobile", windows["t90"][0], windows["t90"][1])
        psi_desktop_t30 = self.psi_window(ga4_id, "desktop", windows["t30"][0], windows["t30"][1])
        psi_desktop_t90 = self.psi_window(ga4_id, "desktop", windows["t90"][0], windows["t90"][1])
        psi_mobile_port_t30 = self.psi_portfolio_window("mobile", windows["t30"][0], windows["t30"][1])
        psi_mobile_port_t90 = self.psi_portfolio_window("mobile", windows["t90"][0], windows["t90"][1])
        psi_desktop_port_t30 = self.psi_portfolio_window("desktop", windows["t30"][0], windows["t30"][1])
        psi_desktop_port_t90 = self.psi_portfolio_window("desktop", windows["t90"][0], windows["t90"][1])
        issues = {
            "slow_page_load": bool((mobile.get("lcp_value") or 0) > 2.5 or (desktop.get("lcp_value") or 0) > 2.5),
            "layout_shift_issues": bool((mobile.get("cls_value") or 0) > 0.1 or (desktop.get("cls_value") or 0) > 0.1),
            "broken_pages_or_errors": bool(onpage.get("status_code") and int(onpage["status_code"]) >= 400),
            "indexing_issues": bool(checks.get("noindex") or checks.get("is_4xx_code") or checks.get("is_5xx_code")),
            "missing_or_weak_content_structure": bool(len(h1s) != 1 or not onpage.get("title") or not onpage.get("meta_description")),
            "issue_list": [],
        }
        for key, flagged in list(issues.items()):
            if key != "issue_list" and flagged:
                issues["issue_list"].append(key)

        website_performance = {
            "page_speed_technical_health": {
                "psi_scores": {
                    "mobile_score": self.periods(
                        current_month=self.metric(mobile.get("performance_score"), portfolio_average=(psi_port.get("mobile") or {}).get("performance_score_avg"), source="pagespeed_metrics"),
                        t30=self.metric(psi_mobile_t30.get("performance_score"), portfolio_average=psi_mobile_port_t30.get("performance_score_avg"), source="pagespeed_metrics"),
                        t90=self.metric(psi_mobile_t90.get("performance_score"), portfolio_average=psi_mobile_port_t90.get("performance_score_avg"), source="pagespeed_metrics"),
                    ),
                    "desktop_score": self.periods(
                        current_month=self.metric(desktop.get("performance_score"), portfolio_average=(psi_port.get("desktop") or {}).get("performance_score_avg"), source="pagespeed_metrics"),
                        t30=self.metric(psi_desktop_t30.get("performance_score"), portfolio_average=psi_desktop_port_t30.get("performance_score_avg"), source="pagespeed_metrics"),
                        t90=self.metric(psi_desktop_t90.get("performance_score"), portfolio_average=psi_desktop_port_t90.get("performance_score_avg"), source="pagespeed_metrics"),
                    ),
                },
                "core_web_vitals": {
                    "lcp": {
                        "mobile": clean(mobile.get("lcp_value")),
                        "desktop": clean(desktop.get("lcp_value")),
                    },
                    "cls": {
                        "mobile": clean(mobile.get("cls_value")),
                        "desktop": clean(desktop.get("cls_value")),
                    },
                    "inp_or_fid": {
                        "mobile": clean(mobile.get("fid_value")),
                        "desktop": clean(desktop.get("fid_value")),
                    },
                    "source": "pagespeed_metrics",
                },
                "critical_technical_issues": issues,
            }
        }

        derived_flags = {
            "demand_issue": bool(traffic_per_unit_t30 is not None and ops_port.get("traffic_per_unit_avg") is not None and traffic_per_unit_t30 < ops_port["traffic_per_unit_avg"]),
            "conversion_issue": bool(traffic.get("closing_ratio_t30") is not None and traffic_port.get("closing_ratio_t30_avg") is not None and traffic["closing_ratio_t30"] < traffic_port["closing_ratio_t30_avg"]),
            "pricing_issue": bool(box.get("physical_occupancy_pct") is not None and box["physical_occupancy_pct"] < 90),
            "product_reputation_issue": bool((rep["latest"] or {}).get("average_rating") is not None and rep["portfolio"].get("average_rating_avg") is not None and rep["latest"]["average_rating"] < rep["portfolio"]["average_rating_avg"]),
            "inventory_imbalance": bool(available_units_value is not None and available_units_port is not None and available_units_value > available_units_port),
            "technical_website_issue": bool(issues["issue_list"]),
        }

        payload = {
            "property": {
                "property_id": property_id,
                "property_name": identity.property_name,
                "ga4_property_id": ga4_id,
                "community_id": identity.community_id,
                "unit_count": identity.unit_count,
            },
            "as_of_date": self.as_of.isoformat(),
            "time_series_definition": {
                "current_month": "month-to-date through latest available source date",
                "t30": "trailing 30 days / last full month equivalent where source supplies it",
                "t90": "trailing 90 days / last 3 months equivalent where source supplies it",
            },
            "demand_signals": demand_signals,
            "funnel_conversion": funnel_conversion,
            "inventory_product": inventory_product,
            "demand_vs_inventory_matching": demand_inventory_matching,
            "pricing_market_position": pricing_market_position,
            "marketing_efficiency": marketing_efficiency,
            "reputation_product_friction": reputation_product_friction,
            "website_performance": website_performance,
            "derived_flags": derived_flags,
            "missing_data": self.missing_data,
        }
        return compact(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--property", default="TX4EG")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--db", default=str(DB_PATH))
    args = parser.parse_args()

    builder = VPRetrievalBuilder(Path(args.db), as_of_date())
    try:
        payload = builder.build(args.property)
    finally:
        builder.close()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{payload['property']['property_id'].lower()}_vp_retrieval_{payload['as_of_date']}.json"
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
