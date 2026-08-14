#!/usr/bin/env python3
"""Benchmark vanity-domain redirect behavior before and after Cloudflare cutover."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import subprocess
import sys
import tempfile
import ipaddress
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urljoin, urlsplit


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPORT_ROOT = ROOT / "reports" / "domain_ops"
DEFAULT_TEST_PATH = "/floorplans"
DEFAULT_TEST_QUERY = "utm_source=domainops-benchmark&utm_medium=redirect-move"
SCHEMES = ("http", "https")


@dataclass
class RequestResult:
    phase: str
    domain: str
    host: str
    scheme: str
    start_url: str
    expected_base_url: str
    expected_final_prefix: str
    expected_query_key: str
    success: int
    final_url: str
    final_status: str
    hop_count: int
    first_status: str
    first_location: str
    path_preserved: int
    query_preserved: int
    target_base_matched: int
    dns_ns: str
    dns_a: str
    dns_cname: str
    dns_source: str
    first_remote_ip: str
    first_server_header: str
    first_cf_ray: str
    first_time_namelookup_ms: str
    first_time_connect_ms: str
    first_time_appconnect_ms: str
    first_time_starttransfer_ms: str
    first_time_total_ms: str
    total_chain_time_ms: str
    error: str


@dataclass
class DomainSummary:
    phase: str
    domain: str
    requests: int
    successful_requests: int
    path_preserved_requests: int
    query_preserved_requests: int
    target_matched_requests: int
    https_successful_requests: int
    cf_ray_requests: int
    median_first_response_ms: str
    median_chain_ms: str
    max_hop_count: int
    nameservers: str


@dataclass
class ComparisonRow:
    domain: str
    before_successful_requests: int
    after_successful_requests: int
    success_delta: int
    before_https_successful_requests: int
    after_https_successful_requests: int
    https_success_delta: int
    before_path_preserved_requests: int
    after_path_preserved_requests: int
    before_query_preserved_requests: int
    after_query_preserved_requests: int
    before_cf_ray_requests: int
    after_cf_ray_requests: int
    before_median_first_response_ms: str
    after_median_first_response_ms: str
    first_response_delta_ms: str
    before_median_chain_ms: str
    after_median_chain_ms: str
    chain_delta_ms: str
    before_nameservers: str
    after_nameservers: str


def latest_import_plan() -> Path:
    candidates = sorted(DEFAULT_REPORT_ROOT.glob("*_cloudflare_import_plan/summary.json"))
    if not candidates:
        raise SystemExit("No Cloudflare import plan found under reports/domain_ops.")
    return candidates[-1].parent


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[Any], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def run_command(args: list[str], timeout: int = 25) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        return 124, exc.stdout or "", exc.stderr or "command timed out"
    return proc.returncode, proc.stdout, proc.stderr


def dig(name: str, record_type: str, resolver: Optional[str]) -> list[str]:
    args = ["dig", "+short", record_type, name]
    if resolver:
        args.append(f"@{resolver}")
    code, stdout, _stderr = run_command(args, timeout=12)
    if code != 0:
        return []
    return [line.strip().rstrip(".") for line in stdout.splitlines() if line.strip()]


def ipv4_answers(name: str, resolver: Optional[str]) -> list[str]:
    answers = []
    for value in dig(name, "A", resolver):
        try:
            ipaddress.IPv4Address(value)
        except ValueError:
            continue
        answers.append(value)
    return answers


def parse_host_from_expression(expression: str) -> str:
    marker = 'http.host eq "'
    if marker not in expression:
        return ""
    return expression.split(marker, 1)[1].split('"', 1)[0]


def expected_base_from_rule(rule: dict[str, Any]) -> str:
    target_url = str(rule.get("target_url") or "")
    if target_url:
        parsed = urlsplit(target_url)
        return parsed._replace(path=parsed.path.rstrip("/"), query="", fragment="").geturl()
    expression = (
        rule.get("action_parameters", {})
        .get("from_value", {})
        .get("target_url", {})
        .get("expression", "")
    )
    if expression.startswith("concat("):
        try:
            return json.loads(expression.split("concat(", 1)[1].split(",", 1)[0])
        except json.JSONDecodeError:
            return ""
    return ""


def expected_rules(plan_dir: Path, plan_rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    output: dict[str, dict[str, str]] = {}
    for row in plan_rows:
        payload = json.loads((plan_dir / row["redirect_payload_file"]).read_text(encoding="utf-8"))
        domain = row["domain"].lower()
        output[domain] = {}
        for rule in payload.get("rules") or []:
            host = parse_host_from_expression(str(rule.get("expression") or ""))
            base = expected_base_from_rule(rule)
            if host and base:
                output[domain][host] = base
    return output


def selected_plan_rows(plan_dir: Path, domains: list[str], limit: Optional[int]) -> list[dict[str, str]]:
    rows = load_csv(plan_dir / "domain_import_plan.csv")
    selected = {domain.lower() for domain in domains}
    if selected:
        rows = [row for row in rows if row["domain"].lower() in selected]
    if limit:
        rows = rows[:limit]
    rows = [row for row in rows if row.get("plan_status") == "planned" and not row.get("review_flags")]
    if not rows:
        raise SystemExit("No clean planned domain rows selected.")
    return rows


def milliseconds(value: str) -> str:
    try:
        return str(round(float(value) * 1000, 1))
    except (TypeError, ValueError):
        return ""


def curl_once(url: str, host: str, scheme: str, resolver: Optional[str]) -> dict[str, Any]:
    resolve_args: list[str] = []
    dns_source = "system"
    if resolver:
        ips = ipv4_answers(host, resolver)
        if ips:
            port = "443" if scheme == "https" else "80"
            resolve_args = ["--resolve", f"{host}:{port}:{ips[0]}"]
            dns_source = resolver
    timing_format = "\n__DOMAINOPS_TIMING__\t%{http_code}\t%{time_namelookup}\t%{time_connect}\t%{time_appconnect}\t%{time_starttransfer}\t%{time_total}\t%{remote_ip}\t%{ssl_verify_result}\t%{redirect_url}\t%{url_effective}\n"
    args = [
        "curl",
        "-sS",
        "--connect-timeout",
        "8",
        "--max-time",
        "20",
        "-o",
        "/dev/null",
        "-D",
        "-",
        "-w",
        timing_format,
        *resolve_args,
        url,
    ]
    code, stdout, stderr = run_command(args, timeout=25)
    headers, _, timing = stdout.partition("__DOMAINOPS_TIMING__\t")
    timing_parts = timing.strip().split("\t") if timing else []
    header_lines = [line.strip() for line in headers.splitlines() if line.strip()]
    status_lines = [line for line in header_lines if line.upper().startswith("HTTP/")]
    status = status_lines[-1].split(" ", 2)[1] if status_lines and len(status_lines[-1].split(" ", 2)) > 1 else ""
    locations = [line.split(":", 1)[1].strip() for line in header_lines if line.lower().startswith("location:")]
    server_headers = [line.split(":", 1)[1].strip() for line in header_lines if line.lower().startswith("server:")]
    cf_rays = [line.split(":", 1)[1].strip() for line in header_lines if line.lower().startswith("cf-ray:")]
    fields = {
        "http_code": timing_parts[0] if len(timing_parts) > 0 else status,
        "time_namelookup": timing_parts[1] if len(timing_parts) > 1 else "",
        "time_connect": timing_parts[2] if len(timing_parts) > 2 else "",
        "time_appconnect": timing_parts[3] if len(timing_parts) > 3 else "",
        "time_starttransfer": timing_parts[4] if len(timing_parts) > 4 else "",
        "time_total": timing_parts[5] if len(timing_parts) > 5 else "",
        "remote_ip": timing_parts[6] if len(timing_parts) > 6 else "",
        "ssl_verify_result": timing_parts[7] if len(timing_parts) > 7 else "",
        "redirect_url": timing_parts[8] if len(timing_parts) > 8 else "",
        "url_effective": timing_parts[9] if len(timing_parts) > 9 else url,
    }
    return {
        "curl_exit": code,
        "error": stderr.strip()[:700] if code != 0 else "",
        "status": status or fields["http_code"],
        "location": locations[-1] if locations else fields["redirect_url"],
        "server": server_headers[-1] if server_headers else "",
        "cf_ray": cf_rays[-1] if cf_rays else "",
        "timing": fields,
        "dns_source": dns_source,
    }


def follow_chain(start_url: str, host: str, scheme: str, resolver: Optional[str]) -> dict[str, Any]:
    current_url = start_url
    hops = []
    total_time_ms = 0.0
    for _ in range(8):
        hop = curl_once(current_url, host, scheme, resolver)
        hops.append({"url": current_url, **hop})
        try:
            total_time_ms += float(milliseconds(hop["timing"].get("time_total", "")) or 0)
        except ValueError:
            pass
        status = str(hop.get("status") or "")
        location = str(hop.get("location") or "")
        if not status.startswith("3") or not location:
            break
        current_url = urljoin(current_url, location)
    final = hops[-1] if hops else {}
    return {
        "hops": hops,
        "final_url": current_url,
        "final_status": str(final.get("status") or ""),
        "total_chain_time_ms": round(total_time_ms, 1) if hops else "",
    }


def has_query(final_url: str, key: str) -> bool:
    return key in parse_qs(urlsplit(final_url).query)


def summarize(phase: str, domain: str, rows: list[RequestResult]) -> DomainSummary:
    first_times = [float(row.first_time_starttransfer_ms) for row in rows if row.first_time_starttransfer_ms]
    chain_times = [float(row.total_chain_time_ms) for row in rows if row.total_chain_time_ms]
    return DomainSummary(
        phase=phase,
        domain=domain,
        requests=len(rows),
        successful_requests=sum(row.success for row in rows),
        path_preserved_requests=sum(row.path_preserved for row in rows),
        query_preserved_requests=sum(row.query_preserved for row in rows),
        target_matched_requests=sum(row.target_base_matched for row in rows),
        https_successful_requests=sum(1 for row in rows if row.scheme == "https" and row.success),
        cf_ray_requests=sum(1 for row in rows if row.first_cf_ray),
        median_first_response_ms=str(round(statistics.median(first_times), 1)) if first_times else "",
        median_chain_ms=str(round(statistics.median(chain_times), 1)) if chain_times else "",
        max_hop_count=max((row.hop_count for row in rows), default=0),
        nameservers=rows[0].dns_ns if rows else "",
    )


def compare_values(before: str, after: str) -> str:
    try:
        return str(round(float(after) - float(before), 1))
    except (TypeError, ValueError):
        return ""


def write_readout(path: Path, summary: dict[str, Any], comparisons: list[ComparisonRow]) -> None:
    lines = [
        "# Cloudflare Redirect Move Benchmark",
        "",
        f"- Generated: {human_utc(summary['generated_at_utc'])}",
        f"- Phase: `{summary['phase']}`",
        f"- Domains tested: `{summary['domains_tested']}`",
        f"- Requests tested: `{summary['requests_tested']}`",
        f"- Successful requests: `{summary['successful_requests']}`",
        f"- Path preserved: `{summary['path_preserved_requests']}`",
        f"- Query preserved: `{summary['query_preserved_requests']}`",
        f"- Cloudflare edge responses: `{summary['cf_ray_requests']}`",
        "",
    ]
    if comparisons:
        lines.extend(["## Before / After", ""])
        for row in comparisons:
            lines.append(
                f"- `{row.domain}`: success `{row.before_successful_requests}` -> `{row.after_successful_requests}`, "
                f"HTTPS success `{row.before_https_successful_requests}` -> `{row.after_https_successful_requests}`, "
                f"Cloudflare edge `{row.before_cf_ray_requests}` -> `{row.after_cf_ray_requests}`, "
                f"median first response `{row.before_median_first_response_ms}` ms -> `{row.after_median_first_response_ms}` ms."
            )
        lines.append("")
    lines.extend(
        [
            "## Evidence Files",
            "",
            "- `request_results.csv` has one row per scheme/host probe.",
            "- `domain_summary.csv` has one row per domain.",
            "- `details.json` contains DNS answers and full redirect hops.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def human_utc(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return value
    return parsed.strftime("%m/%d/%Y %-I:%M %p UTC")


def load_domain_summaries(path: Path) -> dict[str, DomainSummary]:
    rows = load_csv(path)
    return {
        row["domain"]: DomainSummary(
            phase=row["phase"],
            domain=row["domain"],
            requests=int(row["requests"] or 0),
            successful_requests=int(row["successful_requests"] or 0),
            path_preserved_requests=int(row["path_preserved_requests"] or 0),
            query_preserved_requests=int(row["query_preserved_requests"] or 0),
            target_matched_requests=int(row["target_matched_requests"] or 0),
            https_successful_requests=int(row["https_successful_requests"] or 0),
            cf_ray_requests=int(row["cf_ray_requests"] or 0),
            median_first_response_ms=row["median_first_response_ms"],
            median_chain_ms=row["median_chain_ms"],
            max_hop_count=int(row["max_hop_count"] or 0),
            nameservers=row["nameservers"],
        )
        for row in rows
    }


def build_comparisons(before_dir: Path, after_summaries: list[DomainSummary]) -> list[ComparisonRow]:
    before = load_domain_summaries(before_dir / "domain_summary.csv")
    comparisons = []
    for after in after_summaries:
        old = before.get(after.domain)
        if not old:
            continue
        comparisons.append(
            ComparisonRow(
                domain=after.domain,
                before_successful_requests=old.successful_requests,
                after_successful_requests=after.successful_requests,
                success_delta=after.successful_requests - old.successful_requests,
                before_https_successful_requests=old.https_successful_requests,
                after_https_successful_requests=after.https_successful_requests,
                https_success_delta=after.https_successful_requests - old.https_successful_requests,
                before_path_preserved_requests=old.path_preserved_requests,
                after_path_preserved_requests=after.path_preserved_requests,
                before_query_preserved_requests=old.query_preserved_requests,
                after_query_preserved_requests=after.query_preserved_requests,
                before_cf_ray_requests=old.cf_ray_requests,
                after_cf_ray_requests=after.cf_ray_requests,
                before_median_first_response_ms=old.median_first_response_ms,
                after_median_first_response_ms=after.median_first_response_ms,
                first_response_delta_ms=compare_values(old.median_first_response_ms, after.median_first_response_ms),
                before_median_chain_ms=old.median_chain_ms,
                after_median_chain_ms=after.median_chain_ms,
                chain_delta_ms=compare_values(old.median_chain_ms, after.median_chain_ms),
                before_nameservers=old.nameservers,
                after_nameservers=after.nameservers,
            )
        )
    return comparisons


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark vanity-domain redirect behavior.")
    parser.add_argument("--import-plan-dir", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--phase", choices=["before", "after", "pilot", "monitor"], default="before")
    parser.add_argument("--domain", action="append", help="Limit to one or more domains.")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--resolver", default="1.1.1.1", help="Resolver used for DNS evidence and curl --resolve IP selection. Use empty string for system DNS.")
    parser.add_argument("--test-path", default=DEFAULT_TEST_PATH)
    parser.add_argument("--test-query", default=DEFAULT_TEST_QUERY)
    parser.add_argument("--compare-before-dir", type=Path)
    args = parser.parse_args()

    plan_dir = args.import_plan_dir or latest_import_plan()
    plan_rows = selected_plan_rows(plan_dir, args.domain or [], args.limit)
    rules = expected_rules(plan_dir, plan_rows)
    resolver = args.resolver or None

    run_id = datetime.now(timezone.utc).strftime(f"%Y%m%d_%H%M%S_cloudflare_redirect_benchmark_{args.phase}")
    output_dir = args.output_dir or DEFAULT_REPORT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    details: dict[str, Any] = {
        "run_type": "cloudflare_redirect_benchmark",
        "phase": args.phase,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "import_plan_dir": str(plan_dir),
        "resolver": resolver or "system",
        "test_path": args.test_path,
        "test_query": args.test_query,
        "domains": {},
    }
    request_rows: list[RequestResult] = []
    summaries: list[DomainSummary] = []
    query_key = args.test_query.split("=", 1)[0] if args.test_query else ""

    for plan_row in plan_rows:
        domain = plan_row["domain"].lower()
        domain_rows: list[RequestResult] = []
        domain_details = {"hosts": {}, "expected_bases": rules.get(domain, {})}
        for host in sorted(rules.get(domain, {})):
            ns_answers = dig(domain, "NS", resolver)
            a_answers = dig(host, "A", resolver)
            cname_answers = dig(host, "CNAME", resolver)
            domain_details["hosts"][host] = {"ns": ns_answers, "a": a_answers, "cname": cname_answers, "requests": {}}
            for scheme in SCHEMES:
                start_url = f"{scheme}://{host}{args.test_path}?{args.test_query}"
                chain = follow_chain(start_url, host, scheme, resolver)
                first = chain["hops"][0] if chain["hops"] else {}
                final_url = str(chain["final_url"] or "")
                expected_base = rules[domain][host]
                expected_final_prefix = f"{expected_base}{args.test_path}"
                first_location = str(first.get("location") or "")
                redirect_target = urljoin(start_url, first_location) if first_location else final_url
                target_base_matched = redirect_target.startswith(expected_base)
                path_preserved = redirect_target.startswith(expected_final_prefix)
                query_preserved = target_base_matched and has_query(redirect_target, query_key)
                success = path_preserved and query_preserved
                row = RequestResult(
                    phase=args.phase,
                    domain=domain,
                    host=host,
                    scheme=scheme,
                    start_url=start_url,
                    expected_base_url=expected_base,
                    expected_final_prefix=expected_final_prefix,
                    expected_query_key=query_key,
                    success=1 if success else 0,
                    final_url=final_url,
                    final_status=str(chain.get("final_status") or ""),
                    hop_count=max(len(chain.get("hops") or []) - 1, 0),
                    first_status=str(first.get("status") or ""),
                    first_location=first_location,
                    path_preserved=1 if path_preserved else 0,
                    query_preserved=1 if query_preserved else 0,
                    target_base_matched=1 if target_base_matched else 0,
                    dns_ns=";".join(ns_answers),
                    dns_a=";".join(a_answers),
                    dns_cname=";".join(cname_answers),
                    dns_source=str(first.get("dns_source") or resolver or "system"),
                    first_remote_ip=str(first.get("timing", {}).get("remote_ip") or ""),
                    first_server_header=str(first.get("server") or ""),
                    first_cf_ray=str(first.get("cf_ray") or ""),
                    first_time_namelookup_ms=milliseconds(str(first.get("timing", {}).get("time_namelookup") or "")),
                    first_time_connect_ms=milliseconds(str(first.get("timing", {}).get("time_connect") or "")),
                    first_time_appconnect_ms=milliseconds(str(first.get("timing", {}).get("time_appconnect") or "")),
                    first_time_starttransfer_ms=milliseconds(str(first.get("timing", {}).get("time_starttransfer") or "")),
                    first_time_total_ms=milliseconds(str(first.get("timing", {}).get("time_total") or "")),
                    total_chain_time_ms=str(chain.get("total_chain_time_ms") or ""),
                    error=str(first.get("error") or ""),
                )
                request_rows.append(row)
                domain_rows.append(row)
                domain_details["hosts"][host]["requests"][scheme] = chain
        summaries.append(summarize(args.phase, domain, domain_rows))
        details["domains"][domain] = domain_details

    comparisons = build_comparisons(args.compare_before_dir, summaries) if args.compare_before_dir else []
    summary = {
        "output_dir": str(output_dir),
        "import_plan_dir": str(plan_dir),
        "phase": args.phase,
        "generated_at_utc": details["generated_at_utc"],
        "domains_tested": len(summaries),
        "requests_tested": len(request_rows),
        "successful_requests": sum(row.success for row in request_rows),
        "path_preserved_requests": sum(row.path_preserved for row in request_rows),
        "query_preserved_requests": sum(row.query_preserved for row in request_rows),
        "target_matched_requests": sum(row.target_base_matched for row in request_rows),
        "https_successful_requests": sum(1 for row in request_rows if row.scheme == "https" and row.success),
        "cf_ray_requests": sum(1 for row in request_rows if row.first_cf_ray),
        "domains_with_all_requests_successful": sum(1 for row in summaries if row.successful_requests == row.requests),
        "resolver": resolver or "system",
        "comparison_before_dir": str(args.compare_before_dir) if args.compare_before_dir else "",
    }
    details["summary"] = summary
    write_csv(output_dir / "request_results.csv", request_rows, list(RequestResult.__annotations__.keys()))
    write_csv(output_dir / "domain_summary.csv", summaries, list(DomainSummary.__annotations__.keys()))
    if comparisons:
        write_csv(output_dir / "before_after_comparison.csv", comparisons, list(ComparisonRow.__annotations__.keys()))
        write_json(output_dir / "before_after_comparison.json", [asdict(row) for row in comparisons])
    write_json(output_dir / "details.json", details)
    write_json(output_dir / "summary.json", summary)
    write_readout(output_dir / "BENCHMARK_READOUT.md", summary, comparisons)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
