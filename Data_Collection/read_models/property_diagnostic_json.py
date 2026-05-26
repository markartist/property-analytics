#!/usr/bin/env python3
"""Build the retrieval-first property diagnostic JSON contract.

This is a source-read model for downstream agents. It is intentionally separate
from locked PIB rendering/sending code.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path("/Users/mark/Property_Analytics")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Data_Collection.utils.property_identity import resolve_property_identity

DB_PATH = ROOT / "data" / "portfolio_analytics.db"
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "property_diagnostics"


def _today() -> date:
    return date(2026, 5, 6)


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        return round(value, 6)
    return value


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

        calculated_cost_per_move_in = None
        if estimated_spend is not None and move_ins not in (None, 0):
            calculated_cost_per_move_in = clean(float(estimated_spend) / float(move_ins))

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
                "calculated_cost_per_move_in": calculated_cost_per_move_in,
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


def pct(numerator: float | int | None, denominator: float | int | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return clean(float(numerator) / float(denominator))


def direction(current: float | int | None, prior: float | int | None) -> str | None:
    if current is None or prior is None:
        return None
    if current > prior:
        return "improving"
    if current < prior:
        return "declining"
    return "flat"


def row_to_dict(cursor: sqlite3.Cursor, row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


class DiagnosticBuilder:
    def __init__(self, db_path: Path, as_of: date) -> None:
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.as_of = as_of
        self.missing: list[dict[str, Any]] = []
        self.sources: list[dict[str, Any]] = []

    def close(self) -> None:
        self.conn.close()

    def q1(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        cur = self.conn.execute(sql, params)
        return row_to_dict(cur, cur.fetchone())

    def qall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        return [dict(row) for row in self.conn.execute(sql, params).fetchall()]

    def source(self, source_id: str, table: str, source_name: str, latest_date: str | None, use: str) -> None:
        if not any(item["source_id"] == source_id for item in self.sources):
            self.sources.append(
                {
                    "source_id": source_id,
                    "table": table,
                    "source_name": source_name,
                    "latest_date": latest_date,
                    "use": use,
                }
            )

    def add_missing(self, field: str, expected_source: str, note: str) -> None:
        if not any(item["field"] == field for item in self.missing):
            self.missing.append({"field": field, "expected_source": expected_source, "note": note})

    def metric(
        self,
        value: float | int | None,
        portfolio_average: float | int | None = None,
        prior_value: float | int | None = None,
        market_average: float | int | None = None,
        source_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "property_value": clean(value),
            "portfolio_average": clean(portfolio_average),
            "delta_vs_portfolio": clean(None if value is None or portfolio_average is None else value - portfolio_average),
            "market_average": clean(market_average),
            "delta_vs_market": clean(None if value is None or market_average is None else value - market_average),
            "prior_period_value": clean(prior_value),
            "direction": direction(value, prior_value),
            "source_id": source_id,
        }

    def latest_traffic_row(self, property_id: str) -> dict[str, Any] | None:
        return self.q1(
            """
            select * from marketing_bi_traffic_conversions_full
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )

    def traffic_portfolio(self, report_date: str) -> dict[str, Any]:
        row = self.q1(
            """
            select
              avg(guest_cards_t30) guest_cards_t30_avg,
              avg(guest_cards_t90) guest_cards_t90_avg,
              avg(visits_t30) visits_t30_avg,
              avg(visits_t90) visits_t90_avg,
              avg(apps_t30) apps_t30_avg,
              avg(apps_t90) apps_t90_avg,
              avg(rfp_t30) rfp_t30_avg,
              avg(rfp_t90) rfp_t90_avg,
              1.0 * sum(visits_t30) / nullif(sum(guest_cards_t30), 0) gc_visit_t30,
              1.0 * sum(visits_t90) / nullif(sum(guest_cards_t90), 0) gc_visit_t90,
              1.0 * sum(apps_t30) / nullif(sum(visits_t30), 0) visit_app_t30,
              1.0 * sum(apps_t90) / nullif(sum(visits_t90), 0) visit_app_t90,
              1.0 * sum(rfp_t30) / nullif(sum(apps_t30), 0) app_lease_t30,
              1.0 * sum(rfp_t90) / nullif(sum(apps_t90), 0) app_lease_t90,
              avg(closing_ratio_t30) closing_ratio_t30_avg
            from marketing_bi_traffic_conversions_full
            where report_date = ?
            """,
            (report_date,),
        )
        return row or {}

    def latest_ops_row(self, property_id: str) -> dict[str, Any] | None:
        return self.q1(
            """
            select * from marketing_ops_summary_rows
            where property_id = ?
            order by source_as_of_date desc, report_date desc
            limit 1
            """,
            (property_id,),
        )

    def ops_portfolio(self, source_as_of: str | None) -> dict[str, Any]:
        if not source_as_of:
            return {}
        return self.q1(
            """
            select
              avg(occupancy) occupancy_avg,
              avg(atr30) atr30_avg,
              avg(atr) atr_avg,
              avg(traffic_per_unit) traffic_per_unit_avg,
              avg(close_ratio) close_ratio_avg,
              avg(current_month_expirations) current_month_expirations_avg,
              avg(forward_3_month_expirations) forward_3_month_expirations_avg,
              avg(ad_spend_t1_actual) ad_spend_t1_actual_avg,
              avg(ad_spend_t3_actual) ad_spend_t3_actual_avg
            from marketing_ops_summary_rows
            where source_as_of_date = ?
            """,
            (source_as_of,),
        ) or {}

    def ga4_window(self, property_id: str, start: date, end: date) -> dict[str, Any]:
        row = self.q1(
            """
            select
              sum(sessions) sessions,
              sum(engaged_sessions) engaged_sessions,
              sum(conversions) conversions,
              sum(pageviews) pageviews,
              sum(total_users) total_users,
              sum(new_users) new_users,
              1.0 * sum(conversions) / nullif(sum(sessions), 0) conversion_rate,
              1.0 * sum(bounce_rate * sessions) / nullif(sum(sessions), 0) bounce_rate,
              1.0 * sum(avg_session_duration * sessions) / nullif(sum(sessions), 0) avg_session_duration
            from ga4_daily_metrics
            where property_id = ?
              and metric_date between ? and ?
            """,
            (property_id, start.isoformat(), end.isoformat()),
        )
        return row or {}

    def ga4_portfolio_window(self, start: date, end: date) -> dict[str, Any]:
        row = self.q1(
            """
            with property_rollup as (
              select
                property_id,
                sum(sessions) sessions,
                sum(engaged_sessions) engaged_sessions,
                sum(conversions) conversions,
                sum(pageviews) pageviews,
                sum(total_users) total_users,
                sum(new_users) new_users,
                1.0 * sum(conversions) / nullif(sum(sessions), 0) conversion_rate,
                1.0 * sum(bounce_rate * sessions) / nullif(sum(sessions), 0) bounce_rate,
                1.0 * sum(avg_session_duration * sessions) / nullif(sum(sessions), 0) avg_session_duration
              from ga4_daily_metrics
              where metric_date between ? and ?
              group by property_id
            )
            select
              avg(sessions) sessions_avg,
              avg(conversion_rate) conversion_rate_avg,
              avg(bounce_rate) bounce_rate_avg,
              avg(avg_session_duration) avg_session_duration_avg
            from property_rollup
            """,
            (start.isoformat(), end.isoformat()),
        )
        return row or {}

    def ga4_sources(self, property_id: str, start: date, end: date) -> list[dict[str, Any]]:
        rows = self.qall(
            """
            select channel_group, sum(sessions) sessions, sum(conversions) conversions,
                   1.0 * sum(conversions) / nullif(sum(sessions), 0) conversion_rate,
                   1.0 * sum(bounce_rate * sessions) / nullif(sum(sessions), 0) bounce_rate
            from ga4_traffic_sources
            where property_id = ?
              and metric_date between ? and ?
            group by channel_group
            order by sessions desc
            """,
            (property_id, start.isoformat(), end.isoformat()),
        )
        return [{key: clean(value) for key, value in row.items()} for row in rows]

    def inventory(self, property_id: str, feed_property_id: str) -> dict[str, Any]:
        latest = self.q1(
            """
            select max(snapshot_date) snapshot_date
            from unit_availability_units
            where feed_property_id = ? or property_id = ?
            """,
            (feed_property_id, property_id),
        )
        snapshot_date = latest["snapshot_date"] if latest else None
        if not snapshot_date:
            self.add_missing("inventory_product.available_units", "unit_availability_units", "No unit-feed rows found.")
            return {}
        rows = self.qall(
            """
            select availability_bucket, count(*) units,
                   min(case when rent_from > 0 then rent_from end) rent_min,
                   max(case when rent_to > 0 then rent_to end) rent_max
            from unit_availability_units
            where (feed_property_id = ? or property_id = ?)
              and snapshot_date = ?
            group by availability_bucket
            order by units desc
            """,
            (feed_property_id, property_id, snapshot_date),
        )
        total = sum(row["units"] or 0 for row in rows)
        current_units = sum(row["units"] or 0 for row in rows if row["availability_bucket"] == "current")
        rent_row = self.q1(
            """
            select min(case when rent_from > 0 then rent_from end) rent_min,
                   max(case when rent_to > 0 then rent_to end) rent_max
            from unit_availability_units
            where (feed_property_id = ? or property_id = ?)
              and snapshot_date = ?
            """,
            (feed_property_id, property_id, snapshot_date),
        ) or {}
        self.source("S4", "unit_availability_units", "Unit availability feed", snapshot_date, "Availability, available-now bucket, visible rent range, visible specials.")
        return {
            "snapshot_date": snapshot_date,
            "available_units": total,
            "available_now_units": current_units,
            "vacant_ready_percentage": pct(current_units, total),
            "definition": "available_now_units / available_units, using unit feed availability_bucket='current'",
            "availability_buckets": [{key: clean(value) for key, value in row.items()} for row in rows],
            "visible_rent_min": clean(rent_row.get("rent_min")),
            "visible_rent_max": clean(rent_row.get("rent_max")),
            "source_id": "S4",
        }

    def competitor(self, property_id: str, subject_name: str, subject_rent_min: float | None, subject_rent_max: float | None) -> dict[str, Any]:
        latest = self.q1(
            "select max(snapshot_date) snapshot_date from competitor_market_research_observations where property_id = ?",
            (property_id,),
        )
        snapshot_date = latest["snapshot_date"] if latest else None
        if not snapshot_date:
            self.add_missing("pricing_market_position.market_survey_inputs", "competitor_market_research_observations", "No competitor research snapshot found.")
            return {}
        rows = self.qall(
            """
            select competitor_name, evidence_category, rent_min, rent_max, special_text, usp_text, confidence, source_name, source_url
            from competitor_market_research_observations
            where property_id = ?
              and snapshot_date = ?
              and competitor_name != ?
              and competitor_name != 'Competitive Research'
            order by competitor_name, evidence_category
            """,
            (property_id, snapshot_date, subject_name),
        )
        rent_rows = [row for row in rows if row["evidence_category"] == "rent" and row["rent_min"] is not None]
        comp_min = min((row["rent_min"] for row in rent_rows), default=None)
        comp_max = max((row["rent_max"] for row in rent_rows if row["rent_max"] is not None), default=None)
        comp_avg_min = None if not rent_rows else sum(row["rent_min"] for row in rent_rows) / len(rent_rows)
        special_rows = [row for row in rows if row["evidence_category"] == "special" and row["special_text"]]
        self.source("S8", "competitor_market_research_observations", "Competitor market research evidence ledger", snapshot_date, "Competitor visible rents, specials, source confidence, and market survey inputs.")
        return {
            "snapshot_date": snapshot_date,
            "subject_visible_rent_min": clean(subject_rent_min),
            "subject_visible_rent_max": clean(subject_rent_max),
            "competitor_lowest_visible_rent": clean(comp_min),
            "competitor_highest_visible_rent": clean(comp_max),
            "competitor_average_low_visible_rent": clean(comp_avg_min),
            "rent_vs_comp_low_end_delta": clean(None if subject_rent_min is None or comp_min is None else subject_rent_min - comp_min),
            "rent_vs_comp_average_low_delta": clean(None if subject_rent_min is None or comp_avg_min is None else subject_rent_min - comp_avg_min),
            "confirmed_competitor_special_count": len(special_rows),
            "market_survey_inputs": [{key: clean(value) for key, value in row.items()} for row in rows],
            "source_id": "S8",
        }

    def reputation(self, property_id: str) -> dict[str, Any]:
        row = self.q1(
            """
            select * from reputation_com_location_leaderboard
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )
        trend_rows = self.qall(
            """
            select report_date, reputation_score
            from reputation_com_score_time_series
            where property_id = ?
            order by report_date desc
            limit 6
            """,
            (property_id,),
        )
        themes = self.q1(
            """
            select
              sum(case when theme_maintenance then 1 else 0 end) maintenance,
              sum(case when theme_staff then 1 else 0 end) staff,
              sum(case when theme_amenities then 1 else 0 end) amenities,
              sum(case when theme_noise then 1 else 0 end) noise,
              sum(case when theme_location then 1 else 0 end) location,
              sum(case when theme_value then 1 else 0 end) value,
              sum(case when theme_move_in then 1 else 0 end) move_in,
              sum(case when theme_move_out then 1 else 0 end) move_out,
              sum(case when theme_pets then 1 else 0 end) pets,
              sum(case when theme_parking then 1 else 0 end) parking,
              count(*) analyzed_reviews
            from gbp_review_sentiment
            where property_id = ?
            """,
            (property_id,),
        ) or {}
        top_themes = sorted(
            [{"theme": key, "count": themes.get(key) or 0} for key in themes.keys() if key != "analyzed_reviews"],
            key=lambda item: item["count"],
            reverse=True,
        )[:5]
        latest_date = row.get("report_date") if row else None
        if row:
            self.source("S9", "reputation_com_location_leaderboard", "Reputation.com location leaderboard", latest_date, "Rating, score, review mix, response rate.")
        if themes.get("analyzed_reviews"):
            self.source("S10", "gbp_review_sentiment", "GBP review sentiment", None, "Resident review themes and friction signals.")
        return {
            "rating": self.metric(row.get("average_rating") if row else None, source_id="S9" if row else None),
            "reputation_score": self.metric(row.get("reputation_score") if row else None, source_id="S9" if row else None),
            "review_count": self.metric(row.get("current_total_reviews") if row else None, source_id="S9" if row else None),
            "response_rate": self.metric(row.get("response_rate") if row else None, source_id="S9" if row else None),
            "score_trend": [{key: clean(value) for key, value in item.items()} for item in trend_rows],
            "top_complaint_themes": top_themes,
            "analyzed_review_count": clean(themes.get("analyzed_reviews")),
        }

    def source_performance(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            """
            select max(report_date) report_date
            from marketing_bi_source_performance_rows
            where property_id = ?
              and (
                export_name like 'perf-by-source-%'
                or export_name like 'marketing-source-%'
                or export_name = 'perf-region'
              )
            """,
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
            order by export_name
            limit 1
            """,
            (property_id, report_date),
        )
        if not preferred:
            preferred = self.q1(
                """
                select export_name
                from marketing_bi_source_performance_rows
                where property_id = ?
                  and report_date = ?
                  and export_name like 'marketing-source-%'
                order by export_name
                limit 1
                """,
                (property_id, report_date),
            )
        export_name = preferred["export_name"] if preferred else "perf-region"
        rows = self.qall(
            """
            select report_date, export_name, source_kind, source_group, source_desc,
                   guest_cards, visits, first_tours, applications, leases,
                   cancel_denials, move_ins, visit_guest_card_conversion,
                   app_guest_card_conversion, lease_guest_card_conversion,
                   lease_visit_ratio, cancel_denial_pct_of_guest_cards,
                   move_in_guest_card_conversion, move_in_visit_ratio,
                   guest_cards_delta, visits_delta, applications_delta,
                   leases_delta, cancel_denials_delta, move_ins_delta
            from marketing_bi_source_performance_rows
            where property_id = ?
              and report_date = ?
              and export_name = ?
            order by case when source_group = 'Total' then 0 else 1 end, guest_cards desc
            """,
            (property_id, report_date, export_name),
        )
        if rows:
            self.source("S13", "marketing_bi_source_performance_rows", "Marketing BI source/origin performance", report_date, "Guest cards, visits, applications, leases, C&Ds, and move-ins by property origin/source.")
        return [{key: clean(value) for key, value in row.items()} for row in rows]

    def box_score(self, property_id: str) -> dict[str, Any] | None:
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
        if row:
            self.source("S17", "marketing_bi_portfolio_box_score_rows", "Portfolio Box Score", row["report_date"], "Box score occupancy, rent, concessions, traffic, leasing, make-ready, service, Kingsley.")
            return {key: clean(value) for key, value in row.items() if key not in {"evidence_json", "created_at", "updated_at"}}
        return None

    def service_delivery(self, property_id: str) -> dict[str, Any] | None:
        row = self.q1(
            """
            select *
            from marketing_bi_service_delivery_rows
            where property_id = ?
            order by report_date desc
            limit 1
            """,
            (property_id,),
        )
        if row:
            self.source("S18", "marketing_bi_service_delivery_rows", "T90 Service Delivery", row["report_date"], "No-response, unresolved 48h+, first response, total resolution, reopen and ticket-volume posture.")
            return {key: clean(value) for key, value in row.items() if key not in {"evidence_json", "created_at", "updated_at"}}
        return None

    def abandoned_application_status(self) -> dict[str, Any]:
        row = self.q1(
            """
            select count(*) loaded_rows,
                   count(distinct property_id) distinct_property_ids,
                   min(report_date) min_report_date,
                   max(report_date) max_report_date,
                   count(distinct unit_code || '|' || ifnull(floorplan_type,'') || '|' ||
                                  ifnull(sqft,'') || '|' || ifnull(applied_date,'') || '|' ||
                                  ifnull(contract_created_date,'') || '|' || ifnull(net_rent,'')) likely_unique_rows
            from marketing_bi_abandoned_application_rows
            """
        ) or {}
        loaded_rows = row.get("loaded_rows") or 0
        if loaded_rows:
            self.source(
                "S19",
                "marketing_bi_abandoned_application_rows",
                "Marketing BI abandoned applications export",
                row.get("max_report_date"),
                "Abandoned application rows; current export does not include a property key, so property-level counts are not published.",
            )
        return {
            "property_attributed_count": None,
            "percent_of_total_applications": None,
            "reasons": None,
            "property_attribution_status": "source_loaded_no_property_key" if loaded_rows else "not_loaded",
            "loaded_rows": clean(loaded_rows),
            "likely_unique_rows": clean(row.get("likely_unique_rows")),
            "distinct_property_ids": clean(row.get("distinct_property_ids")),
            "latest_report_date": row.get("max_report_date"),
            "publish_property_count": False,
            "note": "Abandoned application export is loaded, but it has no property id/name/region/community key; exact property-level abandoned counts are intentionally not attributed from this source.",
            "source_id": "S19" if loaded_rows else None,
        }

    def move_ins_by_source(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            "select max(report_date) report_date from marketing_bi_move_ins_by_source_rows where property_id = ?",
            (property_id,),
        )
        report_date = latest["report_date"] if latest else None
        if not report_date:
            return []
        rows = self.qall(
            """
            select marketing_source, conversion_source, count(*) move_ins
            from marketing_bi_move_ins_by_source_rows
            where property_id = ?
              and report_date = ?
            group by marketing_source, conversion_source
            order by move_ins desc
            limit 25
            """,
            (property_id, report_date),
        )
        if rows:
            self.source("S14", "marketing_bi_move_ins_by_source_rows", "T365 move-ins with marketing/conversion source", report_date, "Actual move-ins by marketing and conversion source; resident names intentionally not stored.")
        return [{key: clean(value) for key, value in row.items()} for row in rows]

    def spend_by_source(self, property_id: str) -> list[dict[str, Any]]:
        latest = self.q1(
            "select max(report_date) report_date from marketing_bi_monthly_ad_spend_source_rows where property_id = ?",
            (property_id,),
        )
        report_date = latest["report_date"] if latest else None
        if not report_date:
            return []
        rows = self.qall(
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
        if rows:
            self.source("S16", "marketing_bi_monthly_ad_spend_source_rows", "Monthly advertising spend per property workbook", report_date, "Source-level monthly ad spend, monthly totals, budget, and actual-vs-budget.")
        return [{key: clean(value) for key, value in row.items()} for row in rows]

    def website_health(self, property_id: str, ga4_id: str | None = None) -> dict[str, Any]:
        psi_key = ga4_id or property_id
        psi_rows = self.qall(
            """
            select metric_date, strategy, performance_score, lcp_value, cls_value,
                   fid_value as interaction_to_next_paint,
                   accessibility_score, best_practices_score, seo_score,
                   fcp_value, ttfb_value, speed_index, time_to_interactive,
                   total_blocking_time,
                   'pagespeed_metrics' as source_table
            from pagespeed_metrics
            where property_id = ?
            order by metric_date desc
            limit 4
            """,
            (psi_key,),
        )
        if not psi_rows:
            psi_rows = self.qall(
                """
                select metric_date, strategy, performance_score, lcp_value, cls_value,
                       interaction_to_next_paint,
                       accessibility_score, best_practices_score, seo_score,
                       fcp_value, ttfb_value, speed_index, time_to_interactive,
                       total_blocking_time,
                       'pilot_control_psi_metrics' as source_table
                from pilot_control_psi_metrics
                where property_id in (?, ?)
                order by metric_date desc
                limit 4
                """,
                (psi_key, property_id),
            )
        if not psi_rows:
            self.add_missing("website_performance.psi_scores", "pagespeed_metrics or pilot_control_psi_metrics", "No PSI rows are currently stored for this property key.")
        else:
            source_table = psi_rows[0].get("source_table") or "pagespeed_metrics"
            self.source("S11", source_table, "PageSpeed Insights", psi_rows[0]["metric_date"], "PSI scores and Core Web Vitals.")

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
        issues: list[dict[str, Any]] = []
        if onpage:
            checks = json.loads(onpage.get("checks_json") or "{}")
            timing = json.loads(onpage.get("page_timing_json") or "{}")
            h1s = json.loads(onpage.get("h1_json") or "[]")
            if checks.get("high_loading_time") or checks.get("high_waiting_time"):
                issues.append({"flag": "slow_page_load", "value": True, "evidence": checks})
            if len(h1s) > 1:
                issues.append({"flag": "weak_content_structure", "value": True, "evidence": {"h1_count": len(h1s), "h1_values": h1s}})
            if checks.get("duplicate_meta_tags"):
                issues.append({"flag": "duplicate_meta_tags", "value": True, "evidence": True})
            if checks.get("no_image_alt"):
                issues.append({"flag": "image_alt_text_gap", "value": True, "evidence": True})
            if onpage.get("status_code") and int(onpage["status_code"]) >= 400:
                issues.append({"flag": "broken_page_or_error", "value": True, "evidence": {"status_code": onpage["status_code"]}})
            self.source("S12", "dataforseo_onpage_page_snapshots", "DataForSEO on-page snapshot", onpage["run_date"], "Technical page checks, crawlable structure, timing evidence.")
            onpage_read = {
                "run_date": onpage["run_date"],
                "status_code": onpage["status_code"],
                "title_length": onpage["title_length"],
                "description_length": onpage["description_length"],
                "h1_count": len(h1s),
                "word_count": onpage["word_count"],
                "duration_time_ms": clean(timing.get("duration_time")),
                "time_to_interactive_ms": clean(timing.get("time_to_interactive")),
                "source_id": "S12",
            }
        else:
            self.add_missing("website_performance.technical_onpage", "dataforseo_onpage_page_snapshots", "No on-page snapshot stored.")
            onpage_read = None

        return {
            "psi_scores": [{key: clean(value) for key, value in row.items()} for row in psi_rows],
            "core_web_vitals": {
                "mobile_lcp": next((clean(row["lcp_value"]) for row in psi_rows if row["strategy"] == "mobile"), None),
                "desktop_lcp": next((clean(row["lcp_value"]) for row in psi_rows if row["strategy"] == "desktop"), None),
                "mobile_cls": next((clean(row["cls_value"]) for row in psi_rows if row["strategy"] == "mobile"), None),
                "desktop_cls": next((clean(row["cls_value"]) for row in psi_rows if row["strategy"] == "desktop"), None),
                "mobile_inp": next((clean(row["interaction_to_next_paint"]) for row in psi_rows if row["strategy"] == "mobile"), None),
                "desktop_inp": next((clean(row["interaction_to_next_paint"]) for row in psi_rows if row["strategy"] == "desktop"), None),
            },
            "technical_onpage": onpage_read,
            "critical_technical_issues": issues,
        }

    def build(self, property_lookup: str) -> dict[str, Any]:
        identity = resolve_property_identity(property_lookup)
        if not identity:
            raise SystemExit(f"Could not resolve property identity: {property_lookup}")
        property_id = identity.marketing_bi_property_id
        ga4_id = identity.ga4_property_id or property_id

        traffic = self.latest_traffic_row(property_id)
        if not traffic:
            self.add_missing("funnel_conversion", "marketing_bi_traffic_conversions_full", "No BI traffic conversion row found.")
            traffic_port = {}
        else:
            self.source("S1", "marketing_bi_traffic_conversions_full", "Marketing BI Traffic Conversions", traffic["report_date"], "Guest cards, visits, applications, PQ/lease proxy, closing ratios, T30/T90.")
            traffic_port = self.traffic_portfolio(traffic["report_date"])

        ops = self.latest_ops_row(property_id)
        if not ops:
            self.add_missing("pricing_market_position.box_score", "marketing_ops_summary_rows", "No Marketing Ops Summary row found.")
            ops_port = {}
        else:
            self.source("S2", "marketing_ops_summary_rows", "Marketing Ops Summary", ops.get("source_as_of_date") or ops["report_date"], "Occupancy, ATR, traffic, close ratio, expirations, budget vs actual.")
            ops_port = self.ops_portfolio(ops.get("source_as_of_date"))

        ga4_latest = self.q1("select max(metric_date) latest from ga4_daily_metrics where property_id = ?", (ga4_id,))
        ga4_end = datetime.strptime(ga4_latest["latest"], "%Y-%m-%d").date() if ga4_latest and ga4_latest["latest"] else self.as_of - timedelta(days=1)
        windows = {
            "current_month": (ga4_end.replace(day=1), ga4_end),
            "t30": (ga4_end - timedelta(days=29), ga4_end),
            "t90": (ga4_end - timedelta(days=89), ga4_end),
        }
        self.source("S3", "ga4_daily_metrics / ga4_traffic_sources", "Google Analytics 4", ga4_end.isoformat(), "Website sessions, engagement, bounce, conversion, and channel traffic.")
        ga4_by_window = {}
        ga4_source_windows = {}
        for name, (start, end) in windows.items():
            prop = self.ga4_window(ga4_id, start, end)
            port = self.ga4_portfolio_window(start, end)
            prior_prop = self.ga4_window(ga4_id, start - (end - start) - timedelta(days=1), start - timedelta(days=1))
            ga4_by_window[name] = {
                "sessions": self.metric(prop.get("sessions"), port.get("sessions_avg"), prior_prop.get("sessions"), source_id="S3"),
                "conversion_rate": self.metric(prop.get("conversion_rate"), port.get("conversion_rate_avg"), prior_prop.get("conversion_rate"), source_id="S3"),
                "bounce_rate": self.metric(prop.get("bounce_rate"), port.get("bounce_rate_avg"), prior_prop.get("bounce_rate"), source_id="S3"),
                "time_on_site_seconds": self.metric(prop.get("avg_session_duration"), port.get("avg_session_duration_avg"), prior_prop.get("avg_session_duration"), source_id="S3"),
                "organic_sessions": self.metric(sum(row["sessions"] for row in self.ga4_sources(ga4_id, start, end) if row["channel_group"] == "Organic Search"), source_id="S3"),
                "paid_sessions": self.metric(sum(row["sessions"] for row in self.ga4_sources(ga4_id, start, end) if row["channel_group"] in ("Paid Search", "Cross-network")), source_id="S3"),
                "pd_sessions": self.metric(sum(row["sessions"] for row in self.ga4_sources(ga4_id, start, end) if row["channel_group"] in ("Paid Search", "Cross-network")), source_id="S3"),
                "referral_sessions": self.metric(sum(row["sessions"] for row in self.ga4_sources(ga4_id, start, end) if row["channel_group"] == "Referral"), source_id="S3"),
            }
            ga4_source_windows[name] = self.ga4_sources(ga4_id, start, end)

        inv = self.inventory(ga4_id, property_id)
        comp = self.competitor(property_id, identity.property_name, inv.get("visible_rent_min"), inv.get("visible_rent_max"))

        # Spend workbook rows.
        spend_latest = self.q1("select max(report_date) report_date from marketing_bi_ad_spend_performance_month where property_id = ?", (property_id,))
        spend_rows = []
        if spend_latest and spend_latest["report_date"]:
            spend_rows = self.qall(
                """
                select report_date, calendar_month, guest_cards, visits, leases, ad_spend_total, ad_spend_delta
                from marketing_bi_ad_spend_performance_month
                where property_id = ? and report_date = ?
                order by calendar_month desc
                """,
                (property_id, spend_latest["report_date"]),
            )
            self.source("S5", "marketing_bi_ad_spend_performance_month", "Ad spend workbook", spend_latest["report_date"], "Spend workbook source of truth for month-level spend, guest cards, visits, leases.")
        else:
            self.add_missing("marketing_efficiency.spend_workbook", "marketing_bi_ad_spend_performance_month", "No spend workbook rows found.")
        property_spend_latest = self.q1("select max(report_date) report_date from marketing_bi_ad_spend_property_month where property_id = ?", (property_id,))
        property_spend_rows = []
        if property_spend_latest and property_spend_latest["report_date"]:
            property_spend_rows = self.qall(
                """
                select report_date, calendar_month, region, property_name, ad_spend_total, ad_spend_delta
                from marketing_bi_ad_spend_property_month
                where property_id = ? and report_date = ?
                order by calendar_month desc
                """,
                (property_id, property_spend_latest["report_date"]),
            )
            self.source("S15", "marketing_bi_ad_spend_property_month", "Ad spend workbook property/month totals", property_spend_latest["report_date"], "Property-level ad spend totals by month.")

        cost_latest = self.q1("select max(report_date) report_date from marketing_bi_cost_per_conversion_rows where property_id = ?", (property_id,))
        cost_rows = []
        if cost_latest and cost_latest["report_date"]:
            cost_rows = self.qall(
                """
                select report_date, calendar_month, marketing_source_group, marketing_source_desc,
                       cost_per_guest_card, cost_per_visit, cost_per_application, cost_per_lease
                from marketing_bi_cost_per_conversion_rows
                where property_id = ? and report_date = ?
                order by calendar_month desc, marketing_source_group
                """,
                (property_id, cost_latest["report_date"]),
            )
            self.source("S6", "marketing_bi_cost_per_conversion_rows", "Cost per conversion workbook", cost_latest["report_date"], "Cost per guest card, visit, application, and lease by source where active.")
        else:
            self.add_missing("marketing_efficiency.cost_per_conversion_by_source", "marketing_bi_cost_per_conversion_rows", "No cost-per-conversion rows found.")

        rep = self.reputation(property_id)
        web = self.website_health(property_id, ga4_id)
        source_perf_rows = self.source_performance(property_id)
        move_in_source_rows = self.move_ins_by_source(property_id)
        spend_by_source_rows = self.spend_by_source(property_id)
        box_score = self.box_score(property_id)
        service_delivery = self.service_delivery(property_id)
        if not spend_by_source_rows:
            self.add_missing("marketing_efficiency.spend_by_source", "spend workbook source-level export", "No source-level ad-spend rows are available for this property.")

        current_available = inv.get("available_units")
        unit_count = identity.unit_count
        target_gap_net_units = None
        exposure = pct(current_available, unit_count)
        if current_available is not None and unit_count:
            target_gap_net_units = max(0, current_available - int(unit_count * 0.10))

        t30_gc = traffic.get("guest_cards_t30") if traffic else None
        t30_visits = traffic.get("visits_t30") if traffic else None
        t30_apps = traffic.get("apps_t30") if traffic else None
        t30_leases = traffic.get("rfp_t30") if traffic else None
        t90_gc = traffic.get("guest_cards_t90") if traffic else None
        t90_visits = traffic.get("visits_t90") if traffic else None
        t90_apps = traffic.get("apps_t90") if traffic else None
        t90_leases = traffic.get("rfp_t90") if traffic else None
        current_month_key = self.as_of.replace(day=1).isoformat()
        current_month_spend_row = next((row for row in spend_rows if row.get("calendar_month") == current_month_key), None)
        current_month_gc = current_month_spend_row.get("guest_cards") if current_month_spend_row else None
        current_month_visits = current_month_spend_row.get("visits") if current_month_spend_row else None
        current_month_leases = current_month_spend_row.get("leases") if current_month_spend_row else None

        demand_signals = {
            "guest_cards_total": {
                "current_month": self.metric(current_month_gc, source_id="S5" if current_month_spend_row else None),
                "t30": self.metric(t30_gc, traffic_port.get("guest_cards_t30_avg"), traffic.get("guest_cards_t30_py") if traffic else None, source_id="S1" if traffic else None),
                "t90": self.metric(t90_gc, traffic_port.get("guest_cards_t90_avg"), traffic.get("guest_cards_t90_py") if traffic else None, source_id="S1" if traffic else None),
            },
            "guest_cards_by_source": None,
            "inquiries_per_available_unit": self.metric(ops.get("traffic_per_unit") if ops else None, ops_port.get("traffic_per_unit_avg"), source_id="S2" if ops else None),
            "traffic_by_source": ga4_source_windows,
            "website_engagement": ga4_by_window,
        }
        if source_perf_rows:
            demand_signals["guest_cards_by_source"] = {
                "latest_period": [
                    row
                    for row in source_perf_rows
                    if row.get("source_group") and row.get("source_group") != "Total"
                ],
                "total_row": next((row for row in source_perf_rows if row.get("source_group") == "Total"), None),
                "source_id": "S13",
            }
        else:
            self.add_missing("demand_signals.guest_cards_by_source", "guest card/source workbook or BI source-level guest-card route", "Source-level guest-card totals are not available in a purpose-built route for this property.")

        funnel_conversion = {
            "gc_to_visit": {
                "current_month": self.metric(pct(current_month_visits, current_month_gc), source_id="S5" if current_month_spend_row else None),
                "t30": self.metric(pct(t30_visits, t30_gc), traffic_port.get("gc_visit_t30"), pct(traffic.get("visits_t30_py"), traffic.get("guest_cards_t30_py")) if traffic else None, source_id="S1" if traffic else None),
                "t90": self.metric(pct(t90_visits, t90_gc), traffic_port.get("gc_visit_t90"), pct(traffic.get("visits_t90_py"), traffic.get("guest_cards_t90_py")) if traffic else None, source_id="S1" if traffic else None),
            },
            "visit_to_application": {
                "current_month": None,
                "t30": self.metric(pct(t30_apps, t30_visits), traffic_port.get("visit_app_t30"), pct(traffic.get("apps_t30_py"), traffic.get("visits_t30_py")) if traffic else None, source_id="S1" if traffic else None),
                "t90": self.metric(pct(t90_apps, t90_visits), traffic_port.get("visit_app_t90"), pct(traffic.get("apps_t90_py"), traffic.get("visits_t90_py")) if traffic else None, source_id="S1" if traffic else None),
            },
            "application_to_lease": {
                "current_month": None,
                "t30": self.metric(pct(t30_leases, t30_apps), traffic_port.get("app_lease_t30"), pct(traffic.get("rfp_t30_py"), traffic.get("apps_t30_py")) if traffic else None, source_id="S1" if traffic else None),
                "t90": self.metric(pct(t90_leases, t90_apps), traffic_port.get("app_lease_t90"), pct(traffic.get("rfp_t90_py"), traffic.get("apps_t90_py")) if traffic else None, source_id="S1" if traffic else None),
            },
            "closing_ratio": {
                "current_month": self.metric(pct(current_month_leases, current_month_gc), source_id="S5" if current_month_spend_row else None),
                "t30": self.metric(traffic.get("closing_ratio_t30") if traffic else None, traffic_port.get("closing_ratio_t30_avg"), traffic.get("closing_ratio_t30_py") if traffic else None, source_id="S1" if traffic else None),
            },
            "abandoned_applications": self.abandoned_application_status(),
        }
        self.add_missing("funnel_conversion.visit_to_application.current_month", "current-month BI funnel source", "Current-month visit-to-application is not present in the current source route.")
        self.add_missing("funnel_conversion.application_to_lease.current_month", "current-month BI funnel source", "Current-month application-to-lease is not present in the current source route.")

        active_cost_rows = [
            {key: clean(value) for key, value in row.items()}
            for row in cost_rows
            if any(row.get(metric) is not None for metric in ("cost_per_guest_card", "cost_per_visit", "cost_per_application", "cost_per_lease"))
        ]
        channel_economics_rows = build_channel_economics_rows(source_perf_rows, cost_rows)

        pricing = {
            "occupancy": self.metric(ops.get("occupancy") if ops else None, ops_port.get("occupancy_avg"), source_id="S2" if ops else None),
            "atr": self.metric(ops.get("atr") if ops else None, ops_port.get("atr_avg"), source_id="S2" if ops else None),
            "atr30": self.metric(ops.get("atr30") if ops else None, ops_port.get("atr30_avg"), source_id="S2" if ops else None),
            "rent_vs_comp": {
                "subject_visible_rent_min": clean(comp.get("subject_visible_rent_min")),
                "subject_visible_rent_max": clean(comp.get("subject_visible_rent_max")),
                "competitor_lowest_visible_rent": clean(comp.get("competitor_lowest_visible_rent")),
                "competitor_average_low_visible_rent": clean(comp.get("competitor_average_low_visible_rent")),
                "rent_vs_comp_low_end_delta": clean(comp.get("rent_vs_comp_low_end_delta")),
                "rent_vs_comp_average_low_delta": clean(comp.get("rent_vs_comp_average_low_delta")),
                "source_id": comp.get("source_id"),
            },
            "make_ready_percentage": self.metric(box_score.get("make_ready_pct") if box_score else None, source_id="S17" if box_score else None),
            "vacant_ready_percentage": self.metric(inv.get("vacant_ready_percentage"), source_id="S4" if inv else None),
            "expirations": {
                "current_month": self.metric(ops.get("current_month_expirations") if ops else None, ops_port.get("current_month_expirations_avg"), source_id="S2" if ops else None),
                "forward_3_month": self.metric(ops.get("forward_3_month_expirations") if ops else None, ops_port.get("forward_3_month_expirations_avg"), source_id="S2" if ops else None),
            },
            "market_survey_inputs": comp.get("market_survey_inputs", []),
        }
        if not box_score or box_score.get("make_ready_pct") is None:
            self.add_missing("pricing_market_position.make_ready_percentage", "Portfolio Box Score", "Make-ready percentage is not available for this property.")

        technical_issue = len(web["critical_technical_issues"]) > 0 or not web["psi_scores"]
        conversion_t30 = funnel_conversion["application_to_lease"]["t30"]["property_value"]
        conversion_port = funnel_conversion["application_to_lease"]["t30"]["portfolio_average"]
        derived_flags = {
            "demand_issue": bool(t30_gc is not None and traffic_port.get("guest_cards_t30_avg") is not None and t30_gc < traffic_port["guest_cards_t30_avg"]),
            "conversion_issue": bool(conversion_t30 is not None and conversion_port is not None and conversion_t30 < conversion_port),
            "pricing_issue": bool((ops.get("occupancy") if ops else 1) is not None and ops and ops.get("occupancy") < 0.90 and comp.get("rent_vs_comp_low_end_delta") and comp["rent_vs_comp_low_end_delta"] > 0),
            "product_reputation_issue": bool(rep["rating"]["property_value"] is not None and rep["rating"]["property_value"] < 4.0),
            "inventory_imbalance": bool(exposure is not None and exposure > 0.10),
            "technical_website_issue": bool(technical_issue),
        }

        return {
            "schema_version": "property_diagnostic_json_v1",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "as_of_date": self.as_of.isoformat(),
            "property": {
                "property_id": property_id,
                "canonical_property_id": identity.canonical_property_id,
                "ga4_property_id": ga4_id,
                "community_id": identity.community_id,
                "name": identity.property_name,
                "encasa_short_name": identity.encasa_short_name,
                "region": identity.encasa_region,
                "city": identity.city,
                "state": identity.state,
                "unit_count": identity.unit_count,
                "website_url": identity.website_url,
            },
            "demand_signals": demand_signals,
            "funnel_conversion": funnel_conversion,
            "inventory_product": {
                "available_units": self.metric(current_available, source_id="S4" if inv else None),
                "available_units_vs_unit_count": {"available_units": current_available, "unit_count": unit_count, "exposure": exposure},
                "vacant_ready_percentage": self.metric(inv.get("vacant_ready_percentage"), source_id="S4" if inv else None),
                "make_ready_percentage": self.metric(box_score.get("make_ready_pct") if box_score else None, source_id="S17" if box_score else None),
                "ready_available_units": self.metric(box_score.get("ready_available") if box_score else None, source_id="S17" if box_score else None),
                "availability_buckets": inv.get("availability_buckets", []),
                "visible_rent_min": inv.get("visible_rent_min"),
                "visible_rent_max": inv.get("visible_rent_max"),
                "box_score": box_score,
            },
            "demand_vs_inventory_matching": {
                "available_units": current_available,
                "t30_inquiries": t30_gc,
                "t90_inquiries": t90_gc,
                "t30_inquiries_per_available_unit": clean(None if not current_available or t30_gc is None else t30_gc / current_available),
                "t90_inquiries_per_available_unit": clean(None if not current_available or t90_gc is None else t90_gc / current_available),
                "target_gap_net_units_to_under_10pct": target_gap_net_units,
                "current_trend_with_no_changes": {
                    "basis": "T30 PQ / lease proxy from BI traffic conversion row",
                    "t30_leases_or_rfp": t30_leases,
                    "target_gap_net_units": target_gap_net_units,
                    "net_units_remaining_after_one_t30_at_current_lease_volume": None if target_gap_net_units is None or t30_leases is None else max(0, target_gap_net_units - t30_leases),
                },
            },
            "pricing_market_position": pricing,
            "marketing_efficiency": {
                "spend_by_source": spend_by_source_rows,
                "spend_workbook_months": [{key: clean(value) for key, value in row.items()} for row in spend_rows],
                "property_spend_totals": [{key: clean(value) for key, value in row.items()} for row in property_spend_rows],
                "budget_vs_actual": {
                    "current_month_budget": self.metric(ops.get("ad_spend_t1_budget") if ops else None, source_id="S2" if ops else None),
                    "current_month_actual": self.metric(ops.get("ad_spend_t1_actual") if ops else None, ops_port.get("ad_spend_t1_actual_avg"), source_id="S2" if ops else None),
                    "trailing_3_month_budget": self.metric(ops.get("ad_spend_t3_budget") if ops else None, source_id="S2" if ops else None),
                    "trailing_3_month_actual": self.metric(ops.get("ad_spend_t3_actual") if ops else None, ops_port.get("ad_spend_t3_actual_avg"), source_id="S2" if ops else None),
                },
                "cost_per_move_in": {
                    "by_source": channel_economics_rows,
                    "source": "marketing_bi_cost_per_conversion_rows + marketing_bi_source_performance_rows",
                    "note": "Cost per move-in is derived where channel lease economics and move-in counts are both present.",
                },
                "move_ins_by_source": move_in_source_rows,
                "cost_per_guest_card": active_cost_rows,
                "cost_per_conversion_active_only": active_cost_rows,
                "channel_economics_by_source": channel_economics_rows,
            },
            "reputation_product_friction": rep,
            "service_delivery": service_delivery,
            "website_performance": web,
            "derived_flags": derived_flags,
            "missing_data": self.missing,
            "sources": self.sources,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--property", default="Elation at Grandway West")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    builder = DiagnosticBuilder(Path(args.db), _today())
    try:
        payload = builder.build(args.property)
    finally:
        builder.close()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    property_id = payload["property"]["property_id"].lower()
    output_path = output_dir / f"{property_id}_property_diagnostic_{payload['as_of_date']}.json"
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
