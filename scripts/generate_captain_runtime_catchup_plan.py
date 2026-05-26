#!/usr/bin/env python3
"""Generate a practical catch-up plan for newly activated Captains lacking recent runtime evidence."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from captain_fleet_support import ROOT, today_ymd

READINESS_DIR = ROOT / 'reports' / 'captains_log' / 'readiness'
OUTPUT_DIR = ROOT / 'reports' / 'captains_log' / 'commodore'


def latest_readiness_payload() -> dict:
    candidates = sorted(READINESS_DIR.glob('captain_readiness_audit_*.json'))
    if not candidates:
        raise FileNotFoundError('No Captain readiness audit found. Run audit_captain_readiness.py first.')
    return json.loads(candidates[-1].read_text(encoding='utf-8'))


def build_plan() -> dict:
    readiness = latest_readiness_payload()
    rows = readiness['properties']
    catchup = [row for row in rows if 'no recent runtime' in row.get('issues', [])]
    catchup.sort(key=lambda row: (
        0 if row.get('designation') == 'Critical' else 1 if row.get('designation') in {'Sale', 'Spotlight'} else 2,
        row['property_code'],
    ))
    lanes = defaultdict(list)
    for row in catchup:
        if row['readiness'] == 'source_gap':
            lane = 'fix_sources_first'
        elif row.get('designation') == 'Critical':
            lane = 'urgent_cadence'
        elif row.get('designation') in {'Sale', 'Spotlight'}:
            lane = 'focused_cadence'
        else:
            lane = 'baseline_cadence'
        lanes[lane].append({
            'property_code': row['property_code'],
            'property_name': row['property_name'],
            'designation': row.get('designation'),
            'market': row.get('market'),
            'issues': row.get('issues', []),
        })
    return {
        'generated_on': today_ymd(),
        'catchup_property_count': len(catchup),
        'lanes': dict(lanes),
        'recommended_sequence': [
            'fix_sources_first',
            'urgent_cadence',
            'focused_cadence',
            'baseline_cadence',
        ],
    }


def write_outputs(payload: dict, output_stem: Path) -> None:
    output_stem.with_suffix('.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')
    lines = [
        '# Captain Runtime Catch-up Plan',
        '',
        f"Date: {payload['generated_on']}",
        '',
        f"- Properties with no recent runtime: `{payload['catchup_property_count']}`",
        '',
        '## Recommended Sequence',
        '',
    ]
    labels = {
        'fix_sources_first': 'Fix source gaps before runtime catch-up',
        'urgent_cadence': 'Critical properties to force into immediate rhythm',
        'focused_cadence': 'Spotlight and Sale properties to bring into current rhythm next',
        'baseline_cadence': 'Remaining portfolio baseline properties to settle into the normal fleet cadence',
    }
    for key in payload['recommended_sequence']:
        lines.append(f"### {labels[key]}")
        lines.append('')
        rows = payload['lanes'].get(key, [])
        lines.append(f"- Count: `{len(rows)}`")
        if rows:
            lines.append('| Property | Designation | Why It Is Here |')
            lines.append('| --- | --- | --- |')
            for row in rows[:25]:
                lines.append(f"| {row['property_code']} - {row['property_name']} | {row.get('designation') or 'Unspecified'} | {', '.join(row['issues'][:3])} |")
        lines.append('')
    output_stem.with_suffix('.md').write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate a Captain runtime catch-up plan.')
    parser.add_argument('--output', type=Path, default=OUTPUT_DIR / f'captain_runtime_catchup_plan_{today_ymd()}')
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = build_plan()
    write_outputs(payload, args.output)
    print(json.dumps({
        'json': str(args.output.with_suffix('.json')),
        'markdown': str(args.output.with_suffix('.md')),
        'catchup_property_count': payload['catchup_property_count'],
    }, indent=2))


if __name__ == '__main__':
    main()
