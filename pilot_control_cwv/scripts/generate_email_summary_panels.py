from __future__ import annotations

import csv
import json
import sqlite3
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.offsetbox import AnnotationBbox, HPacker, TextArea

from measurement_dashboard_parser import (
    organic_heap_current_and_baseline,
    organic_heap_series,
    latest_heap_status,
)

ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
BI_SERIES_PATH = ROOT / "pilot_control_cwv" / "reports" / "pilot_bi_report_series.csv"
OUTPUT_DIR = ROOT / "pilot_control_cwv" / "reports" / "email_panels"
STAMP = datetime.now().strftime("%Y-%m-%d")

PILOT_COLOR = "#4473D0"
SISTER_COLOR = "#7CCAC2"
BASELINE_COLOR = "#A3A3A3"
TEXT_BLACK = "#0F172A"
MUTED_TEXT = "#64748B"
BG = "#FFFFFF"
DIVIDER = "#E2E8F0"
PENDING_BG = "#F8FAFC"

BI_PANEL_GROUPS = [
    (
        "funnel_quality",
        "Funnel Quality",
        [
            "lead_to_available_unit_rate",
            "website_sales_funnel_price_quote",
            "website_sales_funnel_visits_schedule_tour",
        ],
    ),
    (
        "conversion_actions",
        "Conversion Actions",
        [
            "website_sales_funnel_completed_applications",
            "website_funnel_conversions_click_to_call",
            "website_funnel_conversions_contact_form",
        ],
    ),
]

BI_LABELS = {
    "lead_to_available_unit_rate": "Lead to AU Rate",
    "website_sales_funnel_price_quote": "Price Quote",
    "website_sales_funnel_visits_schedule_tour": "Schedule a Tour",
    "website_sales_funnel_completed_applications": "Applications",
    "website_funnel_conversions_click_to_call": "Click to Call",
    "website_funnel_conversions_contact_form": "Contact Form",
}


def load_pairs() -> list[dict]:
    cfg = json.loads(CONFIG_PATH.read_text())
    cohorts = {c["key"]: c for c in cfg["cohorts"] if c.get("active")}
    pairs = []
    for cohort in cohorts.values():
        if cohort["role"] != "pilot":
            continue
        sister = cohorts[cohort["sister_key"]]
        pairs.append({"pilot": cohort, "sister": sister})
    return pairs


def compact_name(name: str) -> str:
    replacements = {
        "The District Universal Boulevard": "District",
        "Northbridge at Millenia Lake": "Northbridge",
        "Avasa Spring Branch": "Spring Branch",
        "Park on Wurzbach": "Wurzbach",
        "Champions Green": "Champions",
        "Calais Midtown": "Calais",
        "The Harrison": "Harrison",
        "The Whitney": "Whitney",
        "Ventana": "Ventana",
        "Axial Buckhead": "Axial",
    }
    return replacements.get(name, name)


def draw_pair_label(ax, pilot_name: str, sister_name: str) -> None:
    pilot = TextArea(
        compact_name(pilot_name),
        textprops=dict(color=PILOT_COLOR, fontsize=7.7, fontweight="bold", family="DejaVu Sans"),
    )
    vs = TextArea(
        " vs ",
        textprops=dict(color=TEXT_BLACK, fontsize=7.4, fontweight="bold", family="DejaVu Sans"),
    )
    sister = TextArea(
        compact_name(sister_name),
        textprops=dict(color=SISTER_COLOR, fontsize=7.7, fontweight="bold", family="DejaVu Sans"),
    )
    packed = HPacker(children=[pilot, vs, sister], align="center", pad=0, sep=0)
    ab = AnnotationBbox(
        packed,
        (-0.02, 0.5),
        xycoords=ax.transAxes,
        box_alignment=(1, 0.5),
        frameon=False,
        pad=0,
        annotation_clip=False,
    )
    ax.add_artist(ab)


def draw_metric_row(
    ax,
    pilot_name: str,
    sister_name: str,
    dates: list[str],
    pilot_values: list[float | None],
    sister_values: list[float | None],
    *,
    baseline_value: float | None = None,
    show_dates: bool = False,
    show_baseline_label: bool = False,
    percent_values: bool = True,
) -> None:
    x = np.arange(len(dates))
    non_null = [v for v in pilot_values + sister_values if v is not None]
    if baseline_value is not None:
        non_null.append(baseline_value)
    ymin = min(non_null)
    ymax = max(non_null)
    padding = max((ymax - ymin) * 0.35, 0.03 if ymax <= 1.5 else 4)

    ax.set_facecolor(BG)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_yticks([])
    ax.set_xlim(-0.4, len(dates) - 0.6)
    ax.set_ylim(ymin - padding, ymax + padding)

    if baseline_value is not None:
        ax.plot(
            x,
            [baseline_value] * len(dates),
            color=BASELINE_COLOR,
            linewidth=1.1,
            linestyle=(0, (3, 2)),
            zorder=1,
        )

    ax.plot(
        x,
        sister_values,
        color=SISTER_COLOR,
        linewidth=1.9,
        marker="o",
        markersize=4.6,
        zorder=3,
    )
    ax.plot(
        x,
        pilot_values,
        color=PILOT_COLOR,
        linewidth=2.1,
        marker="o",
        markersize=5.1,
        zorder=4,
    )

    draw_pair_label(ax, pilot_name, sister_name)

    pilot_last = next((v for v in reversed(pilot_values) if v is not None), None)
    sister_last = next((v for v in reversed(sister_values) if v is not None), None)
    ax.text(
        1.01,
        0.66,
        "n/a" if pilot_last is None else fmt_value(pilot_last, percent_values),
        transform=ax.transAxes,
        ha="left",
        va="center",
        fontsize=7.7,
        color=PILOT_COLOR,
        fontweight="bold",
    )
    ax.text(
        1.01,
        0.36,
        "n/a" if sister_last is None else fmt_value(sister_last, percent_values),
        transform=ax.transAxes,
        ha="left",
        va="center",
        fontsize=7.7,
        color=SISTER_COLOR,
        fontweight="bold",
    )
    if show_baseline_label and baseline_value is not None:
        ax.text(
            1.01,
            0.08,
            f"BL {fmt_value(baseline_value, percent_values)}",
            transform=ax.transAxes,
            ha="left",
            va="center",
            fontsize=6.7,
            color=BASELINE_COLOR,
        )

    ax.set_xticks(x)
    if show_dates:
        labels = []
        for d in dates:
            if "-" in d:
                labels.append(datetime.fromisoformat(d).strftime("%-m/%d"))
            else:
                labels.append(d)
        ax.set_xticklabels(labels, fontsize=6.6, color=MUTED_TEXT)
    else:
        ax.set_xticklabels([])
    ax.tick_params(axis="x", length=0, pad=1)


def fmt_value(value: float, percent_values: bool = True) -> str:
    if percent_values:
        return f"{value * 100:.1f}%"
    return f"{value:.1f}" if value >= 10 else f"{value:.3f}".rstrip("0").rstrip(".")


def align_series(
    pilot_series: list[tuple[str, float]],
    sister_series: list[tuple[str, float]],
) -> tuple[list[str], list[float | None], list[float | None]]:
    dates = sorted({d for d, _ in pilot_series} | {d for d, _ in sister_series}, key=lambda s: (int(s.split('/')[0]), int(s.split('/')[1])))
    pilot_map = {d: v for d, v in pilot_series}
    sister_map = {d: v for d, v in sister_series}
    pilot_values = [pilot_map.get(d) for d in dates]
    sister_values = [sister_map.get(d) for d in dates]

    def backfill_leading(values: list[float | None]) -> list[float | None]:
        first = next((v for v in values if v is not None), None)
        if first is None:
            return values
        out = values[:]
        for i, val in enumerate(out):
            if val is None:
                out[i] = first
            else:
                break
        return out

    return dates, backfill_leading(pilot_values), backfill_leading(sister_values)


def load_bi_rows() -> list[dict]:
    with BI_SERIES_PATH.open() as f:
        return list(csv.DictReader(f))


def build_bi_index(rows: list[dict]) -> dict[tuple[str, str, str], list[dict]]:
    index: dict[tuple[str, str, str], list[dict]] = {}
    grouped: dict[tuple[str, str, str], list[dict]] = {}
    for row in rows:
        key = (row["section_key"], row["pilot_property_name"], row["sister_property_name"])
        grouped.setdefault(key, []).append(row)
    for key, vals in grouped.items():
        vals.sort(key=lambda r: r["snapshot_date"])
        index[key] = vals
    return index


def make_traffic_panel(pairs: list[dict]) -> Path:
    path = OUTPUT_DIR / f"traffic_and_engagement_panel_{STAMP}.png"
    status = latest_heap_status()
    fig = plt.figure(figsize=(12.8, 3.15), dpi=150, facecolor=BG)
    gs = fig.add_gridspec(
        nrows=9,
        ncols=1,
        height_ratios=[0.56, 0.34, 0.58, 0.58, 0.58, 0.58, 0.72, 0.48, 0.08],
        left=0.14,
        right=0.88,
        top=0.95,
        bottom=0.08,
        hspace=0.08,
    )

    title_ax = fig.add_subplot(gs[0, 0])
    title_ax.axis("off")
    title_ax.text(0.0, 0.7, "Traffic & Engagement", fontsize=14, fontweight="bold", color=TEXT_BLACK, ha="left")
    title_ax.text(0.0, 0.18, f"Heap source | Latest available {status.latest_date_label} | Today's Heap drop pending", fontsize=7.8, color=MUTED_TEXT, ha="left")

    header = fig.add_subplot(gs[1, 0])
    header.axis("off")
    header.text(0.0, 0.5, "Organic Traffic as % of Unique Users", fontsize=9.5, fontweight="bold", color=TEXT_BLACK, ha="left")
    header.text(0.93, 0.68, "Pilot", fontsize=7.4, fontweight="bold", color=PILOT_COLOR, ha="left")
    header.text(0.93, 0.22, "Sister", fontsize=7.4, fontweight="bold", color=SISTER_COLOR, ha="left")

    for idx, pair in enumerate(pairs):
        ax = fig.add_subplot(gs[2 + idx, 0])
        pilot_series = organic_heap_series(pair["pilot"]["display_name"])[-6:]
        sister_series = organic_heap_series(pair["sister"]["display_name"])[-6:]
        dates, pilot_values, sister_values = align_series(pilot_series, sister_series)
        draw_metric_row(
            ax,
            pair["pilot"]["display_name"],
            pair["sister"]["display_name"],
            dates,
            pilot_values,
            sister_values,
            baseline_value=organic_heap_current_and_baseline(pair["pilot"]["display_name"])[1],
            show_dates=(idx == len(pairs) - 1),
            show_baseline_label=True,
        )
        if idx != len(pairs) - 1:
            ax.axhline(ax.get_ylim()[0], color=DIVIDER, linewidth=0.8, xmin=0.0, xmax=1.0)

    pending_ax = fig.add_subplot(gs[7, 0])
    pending_ax.set_facecolor(PENDING_BG)
    pending_ax.set_xticks([])
    pending_ax.set_yticks([])
    for spine in pending_ax.spines.values():
        spine.set_visible(False)
    pending_ax.text(0.0, 0.68, "High Intent User Rate", fontsize=9.2, fontweight="bold", color=TEXT_BLACK, ha="left")
    pending_ax.text(0.0, 0.22, "Pending Heap export", fontsize=7.8, color=MUTED_TEXT, ha="left")

    fig.savefig(path, dpi=150, facecolor=BG, bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)
    return path


def make_bi_panel(pairs: list[dict], panel_key: str, panel_title: str, sections: list[str], bi_index: dict[tuple[str, str, str], list[dict]]) -> Path:
    path = OUTPUT_DIR / f"{panel_key}_panel_{STAMP}.png"
    rows_count = 2 + len(sections) * (1 + len(pairs))
    heights = [0.56, 0.32]
    for _ in sections:
        heights.append(0.30)
        heights.extend([0.52] * len(pairs))
    heights.append(0.08)

    fig = plt.figure(figsize=(12.8, 0.92 + 0.255 * rows_count), dpi=150, facecolor=BG)
    gs = fig.add_gridspec(
        nrows=len(heights),
        ncols=1,
        height_ratios=heights,
        left=0.14,
        right=0.88,
        top=0.96,
        bottom=0.06,
        hspace=0.08,
    )

    title_ax = fig.add_subplot(gs[0, 0])
    title_ax.axis("off")
    title_ax.text(0.0, 0.7, panel_title, fontsize=14, fontweight="bold", color=TEXT_BLACK, ha="left")
    title_ax.text(0.0, 0.18, "BI T7D snapshots | T90D baseline seeded from 3/26", fontsize=7.8, color=MUTED_TEXT, ha="left")

    header = fig.add_subplot(gs[1, 0])
    header.axis("off")
    header.text(0.93, 0.68, "Pilot", fontsize=7.3, fontweight="bold", color=PILOT_COLOR, ha="left")
    header.text(0.93, 0.40, "Sister", fontsize=7.3, fontweight="bold", color=SISTER_COLOR, ha="left")
    header.text(0.93, 0.12, "BL", fontsize=6.5, color=BASELINE_COLOR, ha="left")

    row_index = 2
    for section in sections:
        section_ax = fig.add_subplot(gs[row_index, 0])
        section_ax.axis("off")
        section_ax.text(0.0, 0.48, BI_LABELS[section], fontsize=9.2, fontweight="bold", color=TEXT_BLACK, ha="left")
        row_index += 1

        for pair_idx, pair in enumerate(pairs):
            ax = fig.add_subplot(gs[row_index, 0])
            key = (section, pair["pilot"]["display_name"], pair["sister"]["display_name"])
            series_rows = bi_index[key]
            dates = [row["snapshot_date"] for row in series_rows]
            pilot_values = [float(row["pilot_daily_value"]) if row["pilot_daily_value"] != "" else None for row in series_rows]
            sister_values = [float(row["sister_daily_value"]) if row["sister_daily_value"] != "" else None for row in series_rows]
            baseline_raw = next((row["pilot_baseline_value"] for row in reversed(series_rows) if row["pilot_baseline_value"] != ""), "")
            baseline_value = float(baseline_raw) if baseline_raw != "" else None
            draw_metric_row(
                ax,
                pair["pilot"]["display_name"],
                pair["sister"]["display_name"],
                dates,
                pilot_values,
                sister_values,
                baseline_value=baseline_value,
                show_dates=(pair_idx == len(pairs) - 1),
                show_baseline_label=True,
            )
            if pair_idx != len(pairs) - 1:
                ax.axhline(ax.get_ylim()[0], color=DIVIDER, linewidth=0.8, xmin=0.0, xmax=1.0)
            row_index += 1

    fig.savefig(path, dpi=150, facecolor=BG, bbox_inches="tight", pad_inches=0.08)
    plt.close(fig)
    return path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pairs = load_pairs()
    rows = load_bi_rows()
    bi_index = build_bi_index(rows)

    outputs = [make_traffic_panel(pairs)]
    for panel_key, panel_title, sections in BI_PANEL_GROUPS:
        outputs.append(make_bi_panel(pairs, panel_key, panel_title, sections, bi_index))

    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
