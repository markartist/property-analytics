#!/usr/bin/env python3
"""
Send a combined PIB roundup email for a set of properties.

The roundup only includes scalar metrics that are populated for every
property in the group. Sections that are unavailable for the entire group
are omitted automatically.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Data_Collection.utils.email_sender import EmailSender


@dataclass(frozen=True)
class MetricDef:
    path: str
    label: str
    kind: str


METRICS: list[MetricDef] = [
    MetricDef("ga4.total_sessions", "Sessions", "int"),
    MetricDef("ga4.total_sessions_t30_delta", "Sessions T30 Δ", "pct1"),
    MetricDef("ga4.total_users", "Users", "int"),
    MetricDef("ga4.new_users", "New Users", "int"),
    MetricDef("ga4.pageviews", "Pageviews", "int"),
    MetricDef("ga4.avg_session_duration_sec", "Avg Session Duration", "seconds1"),
    MetricDef("gsc.total_clicks", "GSC Clicks", "int"),
    MetricDef("gsc.total_impressions", "GSC Impressions", "int"),
    MetricDef("gsc.avg_position", "GSC Avg Position", "float1"),
    MetricDef("pagespeed.mobile_score", "Mobile PSI", "int"),
    MetricDef("pagespeed.desktop_score", "Desktop PSI", "int"),
    MetricDef("google_ads.total_spend", "Ad Spend", "currency0"),
    MetricDef("google_ads.total_clicks", "Ad Clicks", "int"),
    MetricDef("google_ads.total_conversions", "Ad Conversions", "float1"),
    MetricDef("google_ads.cost_per_conversion", "Cost / Conversion", "currency2"),
    MetricDef("google_ads.classified_pct", "Classified Spend %", "pct1"),
    MetricDef("review_sentiment.total_reviews", "Reviews", "int"),
    MetricDef("review_sentiment.avg_rating", "Avg Rating", "float2"),
    MetricDef("review_sentiment.avg_sentiment", "Avg Sentiment", "float2"),
    MetricDef("availability.total_available_now", "Units Available Now", "int"),
    MetricDef("availability.total_available_30d", "Units Available 30d", "int"),
    MetricDef("availability.total_available_60d", "Units Available 60d", "int"),
]

ZERO_ONLY_METRICS = {
    "ga4.tour_clicks",
    "ga4.phone_calls",
    "ga4.apply_clicks",
    "ga4.price_quotes",
    "ga4.directions_clicks",
    "cir.cir_percentage",
    "cir.intent_events",
}

SECTION_TITLES = {
    "ga4": "Traffic",
    "gsc": "Search",
    "pagespeed": "PageSpeed",
    "google_ads": "Paid Media",
    "review_sentiment": "Reviews",
    "availability": "Availability",
}


def load_payload(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def resolve_value(payload: dict[str, Any], path: str) -> Any:
    section, key = path.split(".", 1)
    source = payload["current"][section] if section in payload["current"] else payload[section]
    return source.get(key)


def all_available(payloads: list[dict[str, Any]], section: str) -> bool:
    for payload in payloads:
        source = payload["current"][section] if section in payload["current"] else payload[section]
        if source.get("available") is False:
            return False
    return True


def is_metric_present_for_group(payloads: list[dict[str, Any]], metric: MetricDef) -> bool:
    values = []
    for payload in payloads:
        value = resolve_value(payload, metric.path)
        if value is None or value == "":
            return False
        values.append(value)
    if metric.path in ZERO_ONLY_METRICS and all(float(v) == 0 for v in values):
        return False
    return True


def fmt(value: Any, kind: str) -> str:
    if kind == "int":
        return f"{int(round(float(value))):,}"
    if kind == "float1":
        return f"{float(value):,.1f}"
    if kind == "float2":
        return f"{float(value):,.2f}"
    if kind == "pct1":
        return f"{float(value):+.1f}%"
    if kind == "currency0":
        return f"${float(value):,.0f}"
    if kind == "currency2":
        return f"${float(value):,.2f}"
    if kind == "seconds1":
        return f"{float(value):,.1f}s"
    return str(value)


def metric_rows(payloads: list[dict[str, Any]]) -> list[MetricDef]:
    rows: list[MetricDef] = []
    for metric in METRICS:
        section = metric.path.split(".", 1)[0]
        if not all_available(payloads, section):
            continue
        if is_metric_present_for_group(payloads, metric):
            rows.append(metric)
    return rows


def build_html(payloads: list[dict[str, Any]], metrics: list[MetricDef]) -> str:
    first = payloads[0]
    window = first["metadata"]["date_window"]
    generated_at = datetime.now().strftime("%B %d, %Y %I:%M %p")
    properties = [payload["property"]["name"] for payload in payloads]
    grouped: dict[str, list[MetricDef]] = {}
    for metric in metrics:
        grouped.setdefault(metric.path.split(".", 1)[0], []).append(metric)

    section_blocks: list[str] = []
    for section, section_metrics in grouped.items():
        headers = "".join(f"<th>{escape(payload['property']['name'])}</th>" for payload in payloads)
        body_rows = []
        for metric in section_metrics:
            values = "".join(
                f"<td>{escape(fmt(resolve_value(payload, metric.path), metric.kind))}</td>"
                for payload in payloads
            )
            body_rows.append(f"<tr><th>{escape(metric.label)}</th>{values}</tr>")
        section_blocks.append(
            f"""
            <section class="card">
              <h2>{escape(SECTION_TITLES.get(section, section.title()))}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    {headers}
                  </tr>
                </thead>
                <tbody>
                  {''.join(body_rows)}
                </tbody>
              </table>
            </section>
            """
        )

    omitted = [
        "GBP insights",
        "portfolio standing",
        "event-based conversion metrics with no activity across all four properties",
    ]

    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PIB Roundup</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      background: #eef3f8;
      color: #10233f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    .shell {{
      max-width: 1400px;
      margin: 0 auto;
    }}
    .hero {{
      background: #15284b;
      color: #fff;
      border-radius: 18px;
      padding: 28px 32px;
      margin-bottom: 18px;
    }}
    .hero h1 {{
      margin: 0 0 8px;
      font-size: 28px;
    }}
    .hero p {{
      margin: 6px 0;
      color: #d7e3fb;
      font-size: 14px;
    }}
    .meta {{
      display: inline-block;
      margin: 10px 8px 0 0;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      font-size: 12px;
      font-weight: 600;
    }}
    .card {{
      background: #fff;
      border-radius: 18px;
      padding: 22px 24px;
      margin-bottom: 16px;
      box-shadow: 0 8px 24px rgba(16, 35, 63, 0.08);
    }}
    h2 {{
      margin: 0 0 14px;
      color: #15284b;
      font-size: 20px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }}
    thead th {{
      text-align: left;
      background: #edf3fb;
      color: #24426f;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }}
    th, td {{
      padding: 10px 12px;
      border-bottom: 1px solid #e6edf6;
    }}
    tbody th {{
      color: #203859;
      width: 240px;
    }}
    td {{
      color: #10233f;
      font-variant-numeric: tabular-nums;
    }}
    .note {{
      color: #4d6487;
      font-size: 13px;
      line-height: 1.5;
    }}
    ul {{
      margin: 8px 0 0 18px;
      padding: 0;
      color: #4d6487;
      font-size: 13px;
    }}
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>PIB Roundup</h1>
      <p>Combined property brief for {escape(", ".join(properties))}</p>
      <p>Window: {escape(window['start'])} to {escape(window['end'])} ({window['days']} days)</p>
      <span class="meta">Generated {escape(generated_at)}</span>
      <span class="meta">{len(properties)} properties</span>
      <span class="meta">{len(metrics)} shared metrics included</span>
    </section>
    <section class="card">
      <h2>Scope</h2>
      <p class="note">This roundup only includes scalar metrics populated across the full property group. Sections or fields missing for any property were removed so every row remains directly comparable.</p>
      <ul>
        <li>Omitted: {escape(", ".join(omitted))}</li>
      </ul>
    </section>
    {''.join(section_blocks)}
  </div>
</body>
</html>
"""


def build_text(payloads: list[dict[str, Any]], metrics: list[MetricDef]) -> str:
    window = payloads[0]["metadata"]["date_window"]
    names = ", ".join(payload["property"]["name"] for payload in payloads)
    return (
        f"PIB Roundup\n\n"
        f"Properties: {names}\n"
        f"Window: {window['start']} to {window['end']} ({window['days']} days)\n"
        f"Shared metrics included: {len(metrics)}\n"
    )


def latest_payload_for_slug(slug: str) -> Path:
    base = ROOT / "reports" / slug
    candidates = sorted(base.rglob("*__payload.json"))
    if not candidates:
        raise FileNotFoundError(f"No payload found for {slug}")
    return candidates[-1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a combined PIB roundup email")
    parser.add_argument(
        "--slugs",
        nargs="+",
        default=[
            "the-reserves-of-thomas-glen",
            "botanic-luxury",
            "elation-at-grandway-west",
            "the-anatole",
        ],
        help="Property slugs to include",
    )
    parser.add_argument(
        "--to",
        default="mlaufhutte@venterraliving.com",
        help="Comma-separated recipients",
    )
    parser.add_argument(
        "--subject",
        default="PIB Roundup - Thomas Glen, Botanic, Elation, Anatole",
        help="Email subject",
    )
    args = parser.parse_args()

    paths = [latest_payload_for_slug(slug) for slug in args.slugs]
    payloads = [load_payload(path) for path in paths]
    metrics = metric_rows(payloads)
    html = build_html(payloads, metrics)
    text = build_text(payloads, metrics)

    out_dir = ROOT / "reports" / "roundups" / datetime.now().strftime("%Y")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d__pib-roundup")
    out_path = out_dir / f"{stamp}.html"
    out_path.write_text(html, encoding="utf-8")

    sender = EmailSender(verbose=True)
    recipients = [item.strip() for item in args.to.split(",") if item.strip()]
    sender.send_email(subject=args.subject, html_body=html, plain_text=text, recipients=recipients)

    print(f"\nSaved HTML: {out_path}")
    print(f"Shared metrics included: {len(metrics)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
