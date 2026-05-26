#!/usr/bin/env python3
"""Execute a governed Captain runtime catch-up batch from the latest catch-up plan."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import sys
ROOT = Path('/Users/mark/Property_Analytics')
API_SCRIPTS = ROOT / 'apps' / 'api' / 'scripts'
if str(API_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(API_SCRIPTS))

from platform_phase1_client import _auth_headers, _base_url, _post_json  # noqa: E402

PLAN_DIR = ROOT / 'reports' / 'captains_log' / 'commodore'


def latest_plan() -> dict:
    candidates = sorted(PLAN_DIR.glob('captain_runtime_catchup_plan_*.json'))
    if not candidates:
        raise FileNotFoundError('No Captain runtime catch-up plan found. Generate the plan first.')
    return json.loads(candidates[-1].read_text(encoding='utf-8'))


def build_targets(plan: dict, lane: str | None, limit: int | None) -> list[dict]:
    if lane:
        rows = list(plan['lanes'].get(lane, []))
    else:
        rows = []
        for key in plan['recommended_sequence']:
            rows.extend(plan['lanes'].get(key, []))
    return rows[: limit or len(rows)]


def main() -> None:
    parser = argparse.ArgumentParser(description='Run Captain runtime catch-up batches from the latest plan.')
    parser.add_argument('--lane', choices=['fix_sources_first', 'urgent_cadence', 'focused_cadence', 'baseline_cadence'])
    parser.add_argument('--limit', type=int, default=None)
    parser.add_argument('--apply', action='store_true', help='Actually call the Captain runtime route. Default is dry-run.')
    parser.add_argument('--brief', action='store_true', help='Also create a Captain brief run after each agent run.')
    parser.add_argument('--base-url', help='Platform API base URL.')
    parser.add_argument('--shared-token', help='Platform shared bearer token.')
    parser.add_argument('--access-client-id', help='Cloudflare Access client id.')
    parser.add_argument('--access-client-secret', help='Cloudflare Access client secret.')
    parser.add_argument('--actor', default='captain_runtime_catchup')
    parser.add_argument('--source', default='marketingops_catchup')
    args = parser.parse_args()

    plan = latest_plan()
    targets = build_targets(plan, args.lane, args.limit)
    if not args.apply:
        print(json.dumps({
            'mode': 'dry_run',
            'lane': args.lane or 'all',
            'target_count': len(targets),
            'targets': targets,
        }, indent=2))
        return

    auth_headers = _auth_headers(args.shared_token, args.access_client_id, args.access_client_secret)
    base_url = _base_url(args.base_url)
    responses = []
    for row in targets:
        property_code = row['property_code']
        run_response = _post_json(
            base_url,
            auth_headers,
            f'/v1/captain/properties/{property_code}/run',
            {'run_type': 'manual'},
            args.actor,
            args.source,
        )
        item = {
            'property_code': property_code,
            'property_name': row['property_name'],
            'run': run_response,
        }
        if args.brief:
            brief_response = _post_json(
                base_url,
                auth_headers,
                f'/v1/captain/properties/{property_code}/brief',
                {'brief_type': 'captain_brief'},
                args.actor,
                args.source,
            )
            item['brief'] = brief_response
        responses.append(item)
    print(json.dumps({
        'mode': 'apply',
        'lane': args.lane or 'all',
        'target_count': len(targets),
        'responses': responses,
    }, indent=2))


if __name__ == '__main__':
    main()
