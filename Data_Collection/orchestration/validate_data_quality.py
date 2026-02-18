#!/usr/bin/env python3
"""
Phase 7: Enhanced Data Quality Validation
==========================================
Runs comprehensive data quality checks across all 9 data sources.

Called by daily_master_collection.py after data collection completes.

Exit codes:
    0 - All checks passed
    1 - Some checks failed (non-critical)
    2 - Critical validation errors
"""

import sys
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Data_Collection.utils.data_quality_validator import DataQualityValidator


def main():
    """Run comprehensive data quality validation across all sources."""
    
    db_path = Path('/Users/mark/Property_Analytics/data/portfolio_analytics.db')
    registry_path = Path('/Users/mark/Property_Analytics/config/venterra_properties_official.json')
    
    print('=' * 80)
    print('🔬 ENHANCED DATA QUALITY VALIDATION')
    print('=' * 80)
    print()
    
    # Load official property registry
    with open(registry_path) as f:
        registry = json.load(f)
        total_properties = len(registry['properties'])
    
    print(f'📋 Official Registry: {total_properties} properties')
    print()
    
    # Initialize validator
    validator = DataQualityValidator(db_path)
    
    # Validate data with proper delays per source
    # GA4/PSI: Yesterday (no delay)
    # GSC: 3 days ago (API delay)
    # GBP: 2 days ago (API delay)
    print('Validating data quality (accounting for API delays)...')
    print('  • GA4, PSI, ThirtyLines: Yesterday')
    print('  • GSC: 3 days ago (API delay)')
    print('  • GBP Insights: 2 days ago (API delay)')
    print('  • GBP Reviews: Last 7 days')
    print()
    
    results = validator.validate_all_recent_data(days_back=1)
    
    # Print results by data source
    total_properties = 0
    total_checks = 0
    total_failures = 0
    critical_sources = []
    
    sources = ['ga4', 'gsc', 'psi', 'google_ads', 'semrush', 'gbp_reviews', 'gbp_insights', 'gtmetrix', 'thirtylines']
    
    for source in sources:
        if source not in results:
            continue
            
        data = results[source]
        properties_checked = data['properties_checked']
        checks = data['total_checks']
        failed = data['failed_checks']
        score = data['quality_score']
        target_date = data.get('target_date', 'N/A')
        
        if properties_checked == 0:
            status = '⚠️'
            detail = f'No data ({target_date})'
        elif failed == 0:
            status = '✅'
            detail = f'{checks} checks passed ({target_date})'
        else:
            if score < 70:
                status = '❌'
                critical_sources.append(source)
            else:
                status = '⚠️'
            detail = f'{failed}/{checks} failed, score: {score}% ({target_date})'
        
        print(f'  {status} {source.upper():15s} {properties_checked:3d} properties | {detail}')
        
        total_properties += properties_checked
        total_checks += checks
        total_failures += failed
    
    print()
    
    # Check for missing properties by comparing registry to what was validated
    print('Checking property coverage...')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get properties with GA4 data for yesterday
    yesterday = date.today() - timedelta(days=1)
    cursor.execute("""
        SELECT DISTINCT property_id FROM ga4_daily_metrics 
        WHERE metric_date = ?
    """, (yesterday,))
    properties_with_data = {row[0] for row in cursor.fetchall()}
    
    # Check which registry properties are missing
    registry_ga4_ids = {p.get('ga4_property_id') for p in registry['properties'] if p.get('ga4_property_id')}
    missing_properties = registry_ga4_ids - properties_with_data
    
    if missing_properties:
        # Get property names for missing IDs
        missing_names = []
        for prop in registry['properties']:
            if prop.get('ga4_property_id') in missing_properties:
                missing_names.append(prop['name'])
        
        print(f'⚠️  {len(missing_properties)} properties from registry missing GA4 data:')
        for name in sorted(missing_names):
            print(f'     • {name}')
    else:
        print(f'✅ All {total_properties} properties have GA4 data')

    # GA4 field completeness checks (yesterday)
    print()
    print('Checking GA4 field completeness (yesterday)...')
    cursor.execute("""
        SELECT
            SUM(CASE WHEN total_users > 0 THEN 1 ELSE 0 END) as rows_with_users,
            SUM(CASE WHEN total_users > 0 AND new_users = 0 THEN 1 ELSE 0 END) as rows_users_newusers_zero,
            SUM(CASE WHEN sessions > 0 AND pageviews = 0 THEN 1 ELSE 0 END) as rows_sessions_pageviews_zero
        FROM ga4_daily_metrics
        WHERE metric_date = ?
    """, (yesterday,))
    rows_with_users, rows_users_newusers_zero, rows_sessions_pageviews_zero = cursor.fetchone()
    rows_with_users = rows_with_users or 0
    rows_users_newusers_zero = rows_users_newusers_zero or 0
    rows_sessions_pageviews_zero = rows_sessions_pageviews_zero or 0

    if rows_with_users > 0:
        pct_newusers_zero = (rows_users_newusers_zero / rows_with_users) * 100.0
        pct_pageviews_zero = (rows_sessions_pageviews_zero / rows_with_users) * 100.0
        print(f'  New Users zeros: {rows_users_newusers_zero}/{rows_with_users} ({pct_newusers_zero:.1f}%)')
        print(f'  Pageviews zeros: {rows_sessions_pageviews_zero}/{rows_with_users} ({pct_pageviews_zero:.1f}%)')
    else:
        pct_newusers_zero = 0.0
        pct_pageviews_zero = 0.0
        print('  ⚠️  No GA4 rows with users found for yesterday.')

    # GA4 sanity checks (ratios)
    print()
    print('Checking GA4 sanity ratios (yesterday)...')
    cursor.execute("""
        SELECT property_id, sessions, total_users, pageviews
        FROM ga4_daily_metrics
        WHERE metric_date = ?
    """, (yesterday,))
    rows = cursor.fetchall()
    ratio_outliers = 0
    total_ratio_rows = 0
    for _pid, sessions, users, pageviews in rows:
        if not users or not sessions:
            continue
        total_ratio_rows += 1
        sess_per_user = sessions / users if users else 0
        views_per_session = pageviews / sessions if sessions else 0
        if sess_per_user < 0.8 or sess_per_user > 5.0 or views_per_session < 0.8 or views_per_session > 6.0:
            ratio_outliers += 1
    if total_ratio_rows:
        outlier_pct = (ratio_outliers / total_ratio_rows) * 100.0
        print(f'  Ratio outliers: {ratio_outliers}/{total_ratio_rows} ({outlier_pct:.1f}%)')
    else:
        outlier_pct = 0.0
        print('  ⚠️  No GA4 ratio rows to evaluate.')
    
    print()
    print(f'📊 Summary: {total_properties} in registry | {len(properties_with_data)} with data | {total_checks} checks | {total_failures} failures')
    conn.close()
    
    # Determine exit code
    if critical_sources:
        print()
        print(f'❌ CRITICAL: {len(critical_sources)} data source(s) have quality score < 70%:')
        for source in critical_sources:
            print(f'   • {source}')
        return 2
    # GA4 completeness critical threshold
    if pct_newusers_zero > 50.0 or pct_pageviews_zero > 50.0:
        print()
        print('❌ CRITICAL: GA4 completeness failure (excessive zero values for new_users or pageviews)')
        return 2
    # GA4 sanity warning threshold
    if outlier_pct > 20.0:
        print()
        print('ℹ️  GA4 sanity ratios show elevated outliers')
        return 1
    elif total_failures > 0:
        print()
        print('ℹ️  Some quality checks failed, but all within acceptable thresholds')
        return 1
    else:
        print()
        print('✅ All data quality checks passed!')
        return 0


if __name__ == '__main__':
    sys.exit(main())
