#!/usr/bin/env python3
"""
Markdown report builder for the Cloudflare cache audit.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from utils.pib_email_shell import wrap_pib_light_email


SEVERITY_ORDER = {"pass": 0, "warn": 1, "fail": 2}
VENTERRA_BLUE = "#15284B"
SUCCESS_GREEN = "#1E7F4F"
WARNING_AMBER = "#A86400"
RISK_RED = "#A61E2A"
SLATE = "#5B6575"
CARD_BG = "#F8FAFD"
RULE = "#D8DFEA"


def _worst_status(statuses: List[str]) -> str:
    if not statuses:
        return "warn"
    return max(statuses, key=lambda value: SEVERITY_ORDER.get(value, 1))


def _fmt_ms(value: Optional[float]) -> str:
    if value is None:
        return "n/a"
    return f"{value:.1f} ms"


def _fmt_ratio(value: Optional[float]) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2f}%"


def _avg(values: List[Optional[float]]) -> Optional[float]:
    numeric = [value for value in values if value is not None]
    if not numeric:
        return None
    return sum(numeric) / len(numeric)


def _status_color(value: Optional[str]) -> str:
    normalized = (value or "").lower()
    if normalized == "pass":
        return SUCCESS_GREEN
    if normalized == "warn":
        return WARNING_AMBER
    return RISK_RED


def _build_kpi_card(label: str, value: str, note: str) -> str:
    return f"""
    <td style="width:25%;vertical-align:top;padding:8px;">
      <div style="background:{CARD_BG};border:1px solid {RULE};padding:16px 14px;border-radius:6px;">
        <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:{SLATE};text-transform:uppercase;letter-spacing:0.3px;">{label}</div>
        <div style="font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:{VENTERRA_BLUE};margin-top:8px;">{value}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:{SLATE};margin-top:6px;line-height:1.45;">{note}</div>
      </div>
    </td>
    """


def build_pib_email_html(*, report_date: date, domain_results: List[Dict[str, Any]]) -> str:
    pass_count = sum(1 for row in domain_results if row["domain_status"] == "pass")
    warn_count = sum(1 for row in domain_results if row["domain_status"] == "warn")
    fail_count = sum(1 for row in domain_results if row["domain_status"] == "fail")
    avg_cache_hit_ratio = _avg([row.get("graphql_cache_hit_ratio") for row in domain_results])
    avg_desktop_ttfb = _avg([row.get("homepage_second_ttfb_ms") for row in domain_results])
    avg_mobile_ttfb = _avg([row.get("homepage_mobile_second_ttfb_ms") for row in domain_results])
    avg_warm_hit_percent = _avg([row.get("warm_hit_percent") for row in domain_results])

    cards = []
    for row in domain_results:
        notes = row.get("observations") or ["No major notes captured."]
        status_color = _status_color(row.get("domain_status"))
        variant_items = "".join(
            f"<li>{item.get('device_profile', 'n/a').title()} {item.get('variant_mode', 'n/a')}: second {item.get('second_cache_status') or 'n/a'}, warm TTFB {_fmt_ms(item.get('second_ttfb_ms'))}</li>"
            for item in row.get("url_summaries", [])[:4]
        )
        cards.append(
            f"""
            <div style="background:{CARD_BG};border:1px solid {RULE};border-radius:6px;padding:18px 18px 14px 18px;margin:0 0 16px 0;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div>
                  <div style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:{VENTERRA_BLUE};">{row['domain']}</div>
                  <div style="font-family:Arial,sans-serif;font-size:12px;color:{SLATE};margin-top:4px;">Cloudflare zone: {row.get('zone_name') or row['domain']}</div>
                </div>
                <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;color:#fff;background:{status_color};">{row['domain_status'].upper()}</div>
              </div>
              <div style="font-family:Arial,sans-serif;font-size:13px;color:{SLATE};margin-top:10px;line-height:1.6;">
                Cache hit ratio: {_fmt_ratio(row.get('graphql_cache_hit_ratio'))} |
                Warm HIT coverage: {_fmt_ratio(row.get('warm_hit_percent'))} |
                Homepage warm TTFB: {_fmt_ms(row.get('homepage_second_ttfb_ms'))} desktop / {_fmt_ms(row.get('homepage_mobile_second_ttfb_ms'))} mobile
              </div>
              <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:{VENTERRA_BLUE};margin-top:14px;">Findings</div>
              <ul style="margin:8px 0 0 18px;padding:0;font-family:Arial,sans-serif;font-size:13px;color:#1f2937;line-height:1.55;">
                {''.join(f'<li>{item}</li>' for item in notes[:3])}
              </ul>
              <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:{VENTERRA_BLUE};margin-top:14px;">Homepage variants</div>
              <ul style="margin:8px 0 0 18px;padding:0;font-family:Arial,sans-serif;font-size:13px;color:#1f2937;line-height:1.55;">
                {variant_items}
              </ul>
            </div>
            """
        )

    body_html = f"""
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <div style="padding:8px 4px 18px 4px;border-bottom:1px solid {RULE};">
        <div style="font-size:15px;line-height:1.65;">
          This PIB-style baseline summarizes Cloudflare full-page caching behavior across the five pilot domains using synthetic anonymous requests, daily Cloudflare analytics, and zone settings snapshots.
        </div>
        <ul style="margin:12px 0 0 18px;padding:0;font-size:14px;line-height:1.65;">
          <li>The synthetic homepage baseline is currently showing second-request <strong>CF-Cache-Status: DYNAMIC</strong> across all tested variants.</li>
          <li>Cloudflare analytics show the zones are caching some traffic overall, but that is not yet translating into warm homepage HIT behavior in this test path.</li>
          <li>This creates a clean pre-change baseline for future cache-rule rollout tracking.</li>
        </ul>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
        <tr>
          {_build_kpi_card("Domains Audited", str(len(domain_results)), "Pilot domains included in the baseline run.")}
          {_build_kpi_card("Status Mix", f"{pass_count}/{warn_count}/{fail_count}", "Pass / Warn / Fail by domain.")}
          {_build_kpi_card("Avg Cache Hit Ratio", _fmt_ratio(avg_cache_hit_ratio), "Cloudflare daily request-level cache hit ratio across the five pilot zones.")}
          {_build_kpi_card("Warm HIT Coverage", _fmt_ratio(avg_warm_hit_percent), "Synthetic homepage variants achieving a second-request HIT.")}
        </tr>
      </table>

      <div style="margin-top:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            {_build_kpi_card("Desktop Warm TTFB", _fmt_ms(avg_desktop_ttfb), "Average second-request homepage TTFB for desktop synthetic checks.")}
            {_build_kpi_card("Mobile Warm TTFB", _fmt_ms(avg_mobile_ttfb), "Average second-request homepage TTFB for mobile synthetic checks.")}
            {_build_kpi_card("Query Handling", "Passing Through", "Query-string variants currently preserve parameters on final URL in the baseline runs.")}
            {_build_kpi_card("Config Pattern", "Aggressive", "All zones currently report cache_level=aggressive and sort_query_string_for_cache=off.")}
          </tr>
        </table>
      </div>

      <div style="margin-top:22px;font-size:18px;font-weight:700;color:{VENTERRA_BLUE};">Pilot Domain Detail</div>
      <div style="margin-top:12px;">
        {''.join(cards)}
      </div>
    </div>
    """

    return wrap_pib_light_email(
        title="Cloudflare Cache Audit Brief",
        subtitle=f"PIB-style pilot cache baseline | {report_date.isoformat()}",
        body_html=body_html,
        badge_text="Baseline Snapshot",
        badge_fg="#ffffff",
        badge_bg=VENTERRA_BLUE,
    )


def build_daily_markdown_report(
    *,
    report_date: date,
    domain_results: List[Dict[str, Any]],
    previous_domain_results: Optional[List[Dict[str, Any]]] = None,
) -> str:
    previous_map = {item["property_id"]: item for item in (previous_domain_results or [])}
    overall_status = _worst_status([row["domain_status"] for row in domain_results])
    pass_count = sum(1 for row in domain_results if row["domain_status"] == "pass")
    warn_count = sum(1 for row in domain_results if row["domain_status"] == "warn")
    fail_count = sum(1 for row in domain_results if row["domain_status"] == "fail")
    avg_cache_hit_ratio = _avg([row.get("graphql_cache_hit_ratio") for row in domain_results])
    avg_desktop_ttfb = _avg([row.get("homepage_second_ttfb_ms") for row in domain_results])
    avg_mobile_ttfb = _avg([row.get("homepage_mobile_second_ttfb_ms") for row in domain_results])
    avg_warm_hit_percent = _avg([row.get("warm_hit_percent") for row in domain_results])

    lines = [
        f"# Cloudflare Cache Audit Daily Summary ({report_date.isoformat()})",
        "",
        f"Overall portfolio status: **{overall_status.upper()}**",
        "",
        "## Baseline Scoreboard",
        "",
        f"- Domains audited: {len(domain_results)}",
        f"- Status mix: {pass_count} pass, {warn_count} warn, {fail_count} fail",
        f"- Average Cloudflare cache-hit ratio: {_fmt_ratio(avg_cache_hit_ratio)}",
        f"- Average homepage warm TTFB: {_fmt_ms(avg_desktop_ttfb)} desktop, {_fmt_ms(avg_mobile_ttfb)} mobile",
        f"- Average warm HIT coverage: {_fmt_ratio(avg_warm_hit_percent)}",
        "",
        "## Domain-by-domain cache health",
        "",
        "| Domain | Status | Warm HIT % | Desktop homepage | Mobile homepage | Cache hit ratio | Notes |",
        "| --- | --- | ---: | --- | --- | ---: | --- |",
    ]

    for row in domain_results:
        previous = previous_map.get(row["property_id"])
        delta_note = ""
        if previous and row.get("graphql_cache_hit_ratio") is not None and previous.get("graphql_cache_hit_ratio") is not None:
            delta = row["graphql_cache_hit_ratio"] - previous["graphql_cache_hit_ratio"]
            delta_note = f"ratio {'+' if delta >= 0 else ''}{delta:.2f} pts"

        notes = "; ".join(row.get("observations", [])[:2]) or "none"
        if delta_note:
            notes = f"{notes}; {delta_note}" if notes != "none" else delta_note

        lines.append(
            "| {domain} | {status} | {warm_hit_pct} | {homepage_status} | {homepage_mobile_status} | {ratio} | {notes} |".format(
                domain=row["domain"],
                status=row["domain_status"].upper(),
                warm_hit_pct=_fmt_ratio(row.get("warm_hit_percent")),
                homepage_status=(row.get("homepage_status") or "n/a").upper(),
                homepage_mobile_status=(row.get("homepage_mobile_status") or "n/a").upper(),
                ratio=_fmt_ratio(row.get("graphql_cache_hit_ratio")),
                notes=notes,
            )
        )

    failing_urls = []
    for row in domain_results:
        for url_row in row.get("url_summaries", []):
            if url_row["status"] != "pass":
                failing_urls.append((row["domain"], url_row))

    lines.extend(
        [
            "",
            "## URLs failing warm-cache expectations",
            "",
        ]
    )
    if not failing_urls:
        lines.append("- None")
    else:
        for domain, url_row in failing_urls:
            lines.append(
                f"- `{domain}{url_row['path']}` [{url_row.get('device_profile', 'n/a')}/{url_row.get('variant_mode', 'n/a')}]: {url_row['status'].upper()} "
                f"(second={url_row.get('second_cache_status') or 'n/a'}, "
                f"status={url_row.get('http_status') or 'n/a'}, "
                f"ttfb={_fmt_ms(url_row.get('second_ttfb_ms'))})"
            )

    lines.extend(
        [
            "",
            "## Top observations / anomalies",
            "",
        ]
    )
    observations: List[str] = []
    for row in domain_results:
        observations.extend(row.get("observations", []))
    if not observations:
        lines.append("- No material anomalies detected.")
    else:
        for observation in observations[:10]:
            lines.append(f"- {observation}")

    lines.extend(
        [
            "",
            "## Comparison vs previous day",
            "",
        ]
    )
    if not previous_domain_results:
        lines.append("- No prior audit data available for comparison.")
    else:
        for row in domain_results:
            previous = previous_map.get(row["property_id"])
            if not previous:
                lines.append(f"- {row['domain']}: no prior baseline in history.")
                continue
            deltas = []
            if row.get("graphql_cache_hit_ratio") is not None and previous.get("graphql_cache_hit_ratio") is not None:
                delta = row["graphql_cache_hit_ratio"] - previous["graphql_cache_hit_ratio"]
                deltas.append(f"cache hit ratio {'+' if delta >= 0 else ''}{delta:.2f} pts")
            if row.get("homepage_second_ttfb_ms") is not None and previous.get("homepage_second_ttfb_ms") is not None:
                delta = row["homepage_second_ttfb_ms"] - previous["homepage_second_ttfb_ms"]
                deltas.append(f"desktop homepage warm TTFB {'+' if delta >= 0 else ''}{delta:.1f} ms")
            if row.get("homepage_mobile_second_ttfb_ms") is not None and previous.get("homepage_mobile_second_ttfb_ms") is not None:
                delta = row["homepage_mobile_second_ttfb_ms"] - previous["homepage_mobile_second_ttfb_ms"]
                deltas.append(f"mobile homepage warm TTFB {'+' if delta >= 0 else ''}{delta:.1f} ms")
            if row.get("warm_hit_percent") is not None and previous.get("warm_hit_percent") is not None:
                delta = row["warm_hit_percent"] - previous["warm_hit_percent"]
                deltas.append(f"warm HIT coverage {'+' if delta >= 0 else ''}{delta:.2f} pts")
            lines.append(f"- {row['domain']}: " + (", ".join(deltas) if deltas else "no comparable metrics"))

    return "\n".join(lines) + "\n"
