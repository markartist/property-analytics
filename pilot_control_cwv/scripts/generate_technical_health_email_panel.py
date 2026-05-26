from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.offsetbox import AnnotationBbox, HPacker, TextArea


ROOT = Path("/Users/mark/Property_Analytics")
DB_PATH = ROOT / "data" / "portfolio_analytics.db"
CONFIG_PATH = ROOT / "pilot_control_cwv" / "config" / "pilot_control_cwv_config.json"
OUTPUT_DIR = ROOT / "pilot_control_cwv" / "reports" / "email_panels"
OUTPUT_PATH = OUTPUT_DIR / f"technical_health_panel_{datetime.now().strftime('%Y-%m-%d')}.png"

PILOT_COLOR = "#4473D0"
SISTER_COLOR = "#7CCAC2"
BASELINE_COLOR = "#A3A3A3"
FLOOR_COLOR = "#F2A7A7"
TEXT_BLACK = "#0F172A"
MUTED_TEXT = "#64748B"
BG = "#FFFFFF"
DIVIDER = "#E2E8F0"

PSI_BASELINE = 90
PSI_FLOOR = 60
GTM_BASELINE = 94
GTM_FLOOR = 70


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


def get_shared_dates(conn: sqlite3.Connection, property_ids: list[str]) -> list[str]:
    psi_date_sets = []
    gtm_date_sets = []
    for property_id in property_ids:
        psi_rows = conn.execute(
            """
            SELECT DISTINCT metric_date
            FROM pilot_control_psi_metrics
            WHERE property_id = ? AND strategy = 'mobile'
            ORDER BY metric_date
            """,
            (property_id,),
        ).fetchall()
        psi_date_sets.append({row[0] for row in psi_rows})

        gtm_rows = conn.execute(
            """
            SELECT DISTINCT metric_date
            FROM gtmetrix_metrics
            WHERE property_id = ?
            ORDER BY metric_date
            """,
            (property_id,),
        ).fetchall()
        gtm_date_sets.append({row[0] for row in gtm_rows})

    common_psi = set.intersection(*psi_date_sets)
    common_gtm = set.intersection(*gtm_date_sets)
    return sorted(common_psi.intersection(common_gtm))[-6:]


def fetch_series(
    conn: sqlite3.Connection,
    property_id: str,
    dates: list[str],
    kind: str,
) -> list[float | None]:
    if kind == "psi":
        rows = conn.execute(
            """
            SELECT metric_date, performance_score
            FROM pilot_control_psi_metrics
            WHERE property_id = ? AND strategy = 'mobile'
            """,
            (property_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT metric_date, pagespeed_score
            FROM gtmetrix_metrics
            WHERE property_id = ?
            """,
            (property_id,),
        ).fetchall()
    by_date = {row[0]: float(row[1]) for row in rows if row[1] is not None}
    return [by_date.get(day) for day in dates]


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
        textprops=dict(color=PILOT_COLOR, fontsize=8.5, fontweight="bold", family="DejaVu Sans"),
    )
    vs = TextArea(
        " vs ",
        textprops=dict(color=TEXT_BLACK, fontsize=8.3, fontweight="bold", family="DejaVu Sans"),
    )
    sister = TextArea(
        compact_name(sister_name),
        textprops=dict(color=SISTER_COLOR, fontsize=8.5, fontweight="bold", family="DejaVu Sans"),
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


def draw_row(
    ax,
    pilot_name: str,
    sister_name: str,
    dates: list[str],
    pilot_values: list[float | None],
    sister_values: list[float | None],
    baseline_value: float,
    floor_value: float,
    show_dates: bool = False,
) -> None:
    x = np.arange(len(dates))
    ymin = min(floor_value, *(v for v in pilot_values + sister_values if v is not None))
    ymax = max(baseline_value, *(v for v in pilot_values + sister_values if v is not None))
    padding = max((ymax - ymin) * 0.35, 4)

    ax.set_facecolor(BG)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_yticks([])
    ax.set_xlim(-0.4, len(dates) - 0.6)
    ax.set_ylim(ymin - padding, ymax + padding)

    ax.plot(
        x,
        [baseline_value] * len(dates),
        color=BASELINE_COLOR,
        linewidth=1.2,
        linestyle=(0, (3, 2)),
        zorder=1,
    )
    ax.plot(
        x,
        [floor_value] * len(dates),
        color=FLOOR_COLOR,
        linewidth=1.2,
        linestyle=(0, (3, 2)),
        zorder=1,
    )
    ax.plot(
        x,
        sister_values,
        color=SISTER_COLOR,
        linewidth=2.0,
        marker="o",
        markersize=5.0,
        zorder=3,
    )
    ax.plot(
        x,
        pilot_values,
        color=PILOT_COLOR,
        linewidth=2.2,
        marker="o",
        markersize=5.5,
        zorder=4,
    )

    draw_pair_label(ax, pilot_name, sister_name)
    ax.text(
        1.01,
        0.62,
        f"{pilot_values[-1]:.0f}" if pilot_values[-1] is not None else "n/a",
        transform=ax.transAxes,
        ha="left",
        va="center",
        fontsize=8.5,
        color=PILOT_COLOR,
        fontweight="bold",
    )
    ax.text(
        1.01,
        0.34,
        f"{sister_values[-1]:.0f}" if sister_values[-1] is not None else "n/a",
        transform=ax.transAxes,
        ha="left",
        va="center",
        fontsize=8.5,
        color=SISTER_COLOR,
        fontweight="bold",
    )

    ax.set_xticks(x)
    if show_dates:
        ax.set_xticklabels([datetime.fromisoformat(d).strftime("%-m/%d") for d in dates], fontsize=7, color=MUTED_TEXT)
    else:
        ax.set_xticklabels([])
    ax.tick_params(axis="x", length=0, pad=1)


def build_panel() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pairs = load_pairs()
    property_ids = []
    for pair in pairs:
        property_ids.append(pair["pilot"]["property_id"])
        property_ids.append(pair["sister"]["property_id"])

    with sqlite3.connect(DB_PATH) as conn:
        dates = get_shared_dates(conn, property_ids)
        fig = plt.figure(figsize=(12.8, 5.15), dpi=150, facecolor=BG)
        gs = fig.add_gridspec(
            nrows=14,
            ncols=1,
            height_ratios=[0.65, 0.45, 0.72, 0.72, 0.72, 0.72, 0.92, 0.45, 0.72, 0.72, 0.72, 0.72, 0.92, 0.12],
            left=0.14,
            right=0.88,
            top=0.96,
            bottom=0.06,
            hspace=0.08,
        )

        title_ax = fig.add_subplot(gs[0, 0])
        title_ax.axis("off")
        title_ax.text(0.0, 0.72, "Technical Health", fontsize=16, fontweight="bold", color=TEXT_BLACK, ha="left")
        title_ax.text(
            0.0,
            0.16,
            f"Pilot vs sister pairs | Shared CWV window {datetime.fromisoformat(dates[0]).strftime('%-m/%d')}–{datetime.fromisoformat(dates[-1]).strftime('%-m/%d')}",
            fontsize=8.5,
            color=MUTED_TEXT,
            ha="left",
        )

        psi_header = fig.add_subplot(gs[1, 0])
        psi_header.axis("off")
        psi_header.text(0.0, 0.5, "Core Web Vitals - PSI", fontsize=10.5, fontweight="bold", color=TEXT_BLACK, ha="left")
        psi_header.text(0.93, 0.68, "Pilot", fontsize=8, fontweight="bold", color=PILOT_COLOR, ha="left")
        psi_header.text(0.93, 0.22, "Sister", fontsize=8, fontweight="bold", color=SISTER_COLOR, ha="left")

        psi_rows = [fig.add_subplot(gs[i, 0]) for i in range(2, 7)]
        for idx, (ax, pair) in enumerate(zip(psi_rows, pairs)):
            pilot_values = fetch_series(conn, pair["pilot"]["property_id"], dates, "psi")
            sister_values = fetch_series(conn, pair["sister"]["property_id"], dates, "psi")
            draw_row(
                ax,
                pair["pilot"]["display_name"],
                pair["sister"]["display_name"],
                dates,
                pilot_values,
                sister_values,
                PSI_BASELINE,
                PSI_FLOOR,
                show_dates=(idx == len(psi_rows) - 1),
            )

        gtm_header = fig.add_subplot(gs[7, 0])
        gtm_header.axis("off")
        gtm_header.text(0.0, 0.5, "Core Web Vitals - GTMetrix", fontsize=10.5, fontweight="bold", color=TEXT_BLACK, ha="left")
        gtm_header.text(0.93, 0.68, "Pilot", fontsize=8, fontweight="bold", color=PILOT_COLOR, ha="left")
        gtm_header.text(0.93, 0.22, "Sister", fontsize=8, fontweight="bold", color=SISTER_COLOR, ha="left")

        gtm_rows = [fig.add_subplot(gs[i, 0]) for i in range(8, 13)]
        for idx, (ax, pair) in enumerate(zip(gtm_rows, pairs)):
            pilot_values = fetch_series(conn, pair["pilot"]["property_id"], dates, "gtm")
            sister_values = fetch_series(conn, pair["sister"]["property_id"], dates, "gtm")
            draw_row(
                ax,
                pair["pilot"]["display_name"],
                pair["sister"]["display_name"],
                dates,
                pilot_values,
                sister_values,
                GTM_BASELINE,
                GTM_FLOOR,
                show_dates=(idx == len(gtm_rows) - 1),
            )

        footer_ax = fig.add_subplot(gs[13, 0])
        footer_ax.axis("off")

        for row_ax in psi_rows[:-1] + gtm_rows[:-1]:
            row_ax.axhline(row_ax.get_ylim()[0], color=DIVIDER, linewidth=0.8, xmin=0.0, xmax=1.0)

        fig.savefig(OUTPUT_PATH, dpi=150, facecolor=BG, bbox_inches="tight", pad_inches=0.08)
        plt.close(fig)
    return OUTPUT_PATH


if __name__ == "__main__":
    print(build_panel())
