#!/usr/bin/env python3
"""
Phase 6: Registry Completeness Validation
=========================================
Validates that ALL configured properties are actually being collected.

This is the unified Data_Collection version (DB + registry are canonical).
"""

import sys
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta

# Add utils path for email sender
sys.path.insert(0, str(Path(__file__).parent.parent / 'utils'))
try:
    from email_sender import EmailSender
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False
    print("⚠️  Email sender not available - validation results will not be emailed")

# Paths
DB_PATH = Path('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
REGISTRY_PATH = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')
GBP_MAPPING_PATH = Path('/Users/mark/Property_Analytics/Portfolio_Monitoring/data/all_properties_gbp_matched.json')


def validate_registry_completeness():
    """Validate that all registry properties have data."""
    print("="*80)
    print("PHASE 6: REGISTRY COMPLETENESS VALIDATION")
    print("="*80)
    print()

    print("📋 Loading property registry...")
    with open(REGISTRY_PATH) as f:
        registry = json.load(f)
        registry_props = registry['properties']

    print(f"   ✓ Loaded {len(registry_props)} properties from registry")
    print()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    ga4_properties = [p for p in registry_props if p.get('ga4_property_id')]
    print(f"📊 Registry properties with GA4: {len(ga4_properties)}")
    print()

    issues = []
    skipped_prelaunch = 0

    cutoff_date = (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d")

    for prop in ga4_properties:
        name = prop['name']
        ga4_id = prop['ga4_property_id']
        gsc_access = prop.get('gsc_access', 'none')
        lifecycle = prop.get('lifecycle')

        if lifecycle == 'prelaunch':
            skipped_prelaunch += 1
            continue

        cursor.execute("""
            SELECT COUNT(*), MAX(metric_date)
            FROM ga4_daily_metrics
            WHERE property_id = ?
        """, (ga4_id,))
        result = cursor.fetchone()
        ga4_count = result[0]
        ga4_latest = result[1]

        gsc_count = 0
        gsc_latest = None
        if gsc_access and gsc_access != 'none':
            cursor.execute("""
                SELECT COUNT(*), MAX(metric_date)
                FROM gsc_queries
                WHERE property_id = ?
            """, (ga4_id,))
            gsc_result = cursor.fetchone()
            gsc_count = gsc_result[0] if gsc_result else 0
            gsc_latest = gsc_result[1] if gsc_result else None

        cursor.execute("""
            SELECT COUNT(*), MAX(metric_date)
            FROM pagespeed_metrics
            WHERE property_id = ?
        """, (ga4_id,))
        psi_result = cursor.fetchone()
        psi_count = psi_result[0] if psi_result else 0
        psi_latest = psi_result[1] if psi_result else None

        cursor.execute("""
            SELECT COUNT(*), MAX(metric_date)
            FROM semrush_domain_metrics
            WHERE property_id = ?
        """, (ga4_id,))
        semrush_result = cursor.fetchone()
        semrush_count = semrush_result[0] if semrush_result else 0
        semrush_latest = semrush_result[1] if semrush_result else None

        # GA4 validation
        if ga4_count == 0 or (ga4_latest and ga4_latest < cutoff_date):
            issues.append({
                'property': name,
                'ga4_id': ga4_id,
                'issue': 'GA4 missing/stale',
                'latest': ga4_latest
            })

        # GSC validation (only if configured)
        if gsc_access and gsc_access != 'none':
            if gsc_count == 0 or (gsc_latest and gsc_latest < cutoff_date):
                issues.append({
                    'property': name,
                    'ga4_id': ga4_id,
                    'issue': 'GSC missing/stale',
                    'latest': gsc_latest
                })

        # PSI validation
        if psi_count == 0:
            issues.append({
                'property': name,
                'ga4_id': ga4_id,
                'issue': 'PSI missing',
                'latest': psi_latest
            })

        # SEMRush validation
        if semrush_count == 0:
            issues.append({
                'property': name,
                'ga4_id': ga4_id,
                'issue': 'SEMRush missing',
                'latest': semrush_latest
            })

    conn.close()

    print(f"✅ Prelaunch properties skipped: {skipped_prelaunch}")
    print()

    if issues:
        print(f"⚠️  Registry validation found {len(issues)} issues")
        for issue in issues[:20]:
            print(f"  - {issue['property']} ({issue['ga4_id']}): {issue['issue']} (latest: {issue['latest']})")
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more")
        return 1

    print("✅ Registry validation passed - all properties collecting data")
    return 0


def main():
    return validate_registry_completeness()


if __name__ == '__main__':
    sys.exit(main())
