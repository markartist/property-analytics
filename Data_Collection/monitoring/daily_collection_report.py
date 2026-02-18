#!/usr/bin/env python3
"""
Daily Collection Summary Report
================================
Comprehensive daily report sent after each collection run showing:
- Collection results (what ran, what succeeded/failed)
- Database health snapshot (record counts, latest dates)
- Data freshness status for all sources

Replaces the old alert-only system with always-on daily reporting.

Usage:
    python3 daily_collection_report.py [--test]
"""

import sys
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import json

# Import from unified structure
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from Data_Collection.utils.email_sender import EmailSender


class DailyCollectionReporter:
    """Generates and sends daily collection summary report."""
    
    def __init__(self, test_mode=False):
        self.test_mode = test_mode
        self.base_dir = Path(__file__).parent.parent.parent  # Property_Analytics root
        self.db_path = self.base_dir / 'data' / 'portfolio_analytics.db'
        self.registry_path = self.base_dir / 'config' / 'venterra_properties_official.json'
        
        # Load property registry
        with open(self.registry_path) as f:
            registry = json.load(f)
            self.properties = {p.get('ga4_property_id', p['name']): p['name'] 
                             for p in registry['properties']}
            self.total_properties = len(registry['properties'])
        
        self.recipient = 'mlaufhutte@venterraliving.com'
        
        # Create unified email sender
        if not test_mode:
            self.email_sender = EmailSender(verbose=False)
        
        if test_mode:
            print("🧪 TEST MODE: Email preview only (no actual send)")
    
    def get_latest_collection_results(self):
        """
        Get results from the most recent collection run.
        
        Returns:
            dict: Collection results by source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        results = {}
        
        try:
            # Discover available columns to keep compatibility with older DBs
            cursor.execute("PRAGMA table_info(data_collections)")
            columns = {row[1] for row in cursor.fetchall()}
            optional_cols = [
                'properties_collected',
                'api_calls_total',
                'api_calls_failed',
                'rate_limit_hits',
                'retry_attempts',
                'avg_response_time_ms',
                'notes'
            ]
            optional_select = []
            for col in optional_cols:
                if col in columns:
                    optional_select.append(col)
                else:
                    optional_select.append(f"NULL as {col}")

            # Get most recent collection for each data source (last 48 hours to catch morning runs)
            two_days_ago = datetime.now() - timedelta(hours=48)
            two_days_ago_str = two_days_ago.strftime('%Y-%m-%d')
            
            cursor.execute(f"""
                SELECT 
                    data_source,
                    started_at,
                    completed_at,
                    status,
                    properties_total,
                    properties_success,
                    properties_failed,
                    error_message,
                    {", ".join(optional_select)}
                FROM data_collections
                WHERE DATE(started_at) >= ?
                ORDER BY started_at DESC
            """, (two_days_ago_str,))
            
            rows = cursor.fetchall()
            
            # Group by data source, keeping only the most recent
            seen_sources = set()
            for row in rows:
                source = row[0]
                if source not in seen_sources:
                    started, completed, status, total, success, failed, error, properties_collected, api_total, api_failed, rate_limits, retries, avg_ms, notes = row[1:]
                    
                    seen_sources.add(source)
                    
                    # Calculate duration
                    if completed and started:
                        try:
                            # Handle timestamps with or without microseconds
                            start_dt = datetime.fromisoformat(started.replace('Z', '+00:00'))
                            complete_dt = datetime.fromisoformat(completed.replace('Z', '+00:00'))
                            duration = (complete_dt - start_dt).total_seconds()
                        except (ValueError, AttributeError):
                            duration = None
                    else:
                        duration = None
                    
                    # Normalize success/failed when older collectors only set properties_collected
                    success_final = success or 0
                    failed_final = failed or 0
                    properties_collected_val = properties_collected or 0
                    if success_final == 0 and failed_final == 0 and properties_collected_val > 0:
                        success_final = properties_collected_val

                    # Derive totals when missing (legacy rows may only have properties_collected)
                    total_final = total if total not in (None, 0) else properties_collected_val
                    if total_final == 0:
                        total_final = success_final + failed_final

                    results[source] = {
                        'started_at': started,
                        'completed_at': completed,
                        'status': status,
                        'properties_total': total_final,
                        'properties_successful': success_final,
                        'properties_failed': failed_final,
                        'error_message': error,
                        'duration_seconds': duration,
                        'properties_collected': properties_collected,
                        'api_calls_total': api_total,
                        'api_calls_failed': api_failed,
                        'rate_limit_hits': rate_limits,
                        'retry_attempts': retries,
                        'avg_response_time_ms': avg_ms,
                        'notes': notes
                    }
        
        except sqlite3.OperationalError as e:
            # Table might not exist
            print(f"   ⚠️  Database error: {e}")
        except Exception as e:
            # Unexpected error
            print(f"   ❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
        
        conn.close()
        return results
    
    def get_database_health_snapshot(self):
        """
        Get current database health metrics.
        
        Returns:
            dict: Health metrics by data source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        health = {}
        
        # GA4 metrics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as properties,
                COUNT(*) as total_records,
                MAX(metric_date) as latest_date,
                MIN(metric_date) as earliest_date
            FROM ga4_daily_metrics
        """)
        row = cursor.fetchone()
        health['ga4'] = {
            'properties': row[0] or 0,
            'total_records': row[1] or 0,
            'latest_date': row[2] or 'N/A',
            'earliest_date': row[3] or 'N/A'
        }
        
        # GA4 completeness (latest date)
        latest_ga4 = health['ga4']['latest_date']
        if latest_ga4 and latest_ga4 != 'N/A':
            cursor.execute("""
                SELECT
                    SUM(CASE WHEN total_users > 0 THEN 1 ELSE 0 END) as rows_with_users,
                    SUM(CASE WHEN total_users > 0 AND new_users = 0 THEN 1 ELSE 0 END) as new_users_zero,
                    SUM(CASE WHEN sessions > 0 AND pageviews = 0 THEN 1 ELSE 0 END) as pageviews_zero
                FROM ga4_daily_metrics
                WHERE metric_date = ?
            """, (latest_ga4,))
            rows_with_users, new_users_zero, pageviews_zero = cursor.fetchone()
            rows_with_users = rows_with_users or 0
            new_users_zero = new_users_zero or 0
            pageviews_zero = pageviews_zero or 0
            health['ga4']['rows_with_users'] = rows_with_users
            health['ga4']['new_users_zero_pct'] = round((new_users_zero / rows_with_users) * 100.0, 1) if rows_with_users else 0.0
            health['ga4']['pageviews_zero_pct'] = round((pageviews_zero / rows_with_users) * 100.0, 1) if rows_with_users else 0.0
        else:
            health['ga4']['rows_with_users'] = 0
            health['ga4']['new_users_zero_pct'] = 0.0
            health['ga4']['pageviews_zero_pct'] = 0.0
        
        # GSC metrics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT gsc_site_url) as sites,
                COUNT(*) as total_records,
                MAX(metric_date) as latest_date,
                MIN(metric_date) as earliest_date
            FROM gsc_daily_metrics
        """)
        row = cursor.fetchone()
        health['gsc'] = {
            'sites': row[0] or 0,
            'total_records': row[1] or 0,
            'latest_date': row[2] or 'N/A',
            'earliest_date': row[3] or 'N/A'
        }
        
        # Google Ads
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as properties,
                COUNT(*) as total_records,
                MAX(metric_date) as latest_date
            FROM google_ads_campaigns
        """)
        row = cursor.fetchone()
        health['google_ads'] = {
            'properties': row[0] or 0,
            'total_records': row[1] or 0,
            'latest_date': row[2] or 'N/A'
        }
        
        # PSI metrics
        try:
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT property_id) as properties,
                    COUNT(*) as total_records,
                    MAX(metric_date) as latest_date
                FROM pagespeed_metrics
            """)
            row = cursor.fetchone()
            health['psi'] = {
                'properties': row[0] or 0,
                'total_records': row[1] or 0,
                'latest_date': row[2] or 'N/A'
            }
        except sqlite3.OperationalError:
            health['psi'] = {'properties': 0, 'total_records': 0, 'latest_date': 'N/A'}
        
        # GBP Reviews
        try:
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT property_id) as properties,
                    COUNT(*) as total_reviews,
                    MAX(review_create_time) as latest_review
                FROM gbp_reviews
            """)
            row = cursor.fetchone()
            health['gbp_reviews'] = {
                'properties': row[0] or 0,
                'total_records': row[1] or 0,
                'latest_date': row[2][:10] if row[2] else 'N/A'
            }
        except sqlite3.OperationalError:
            health['gbp_reviews'] = {'properties': 0, 'total_records': 0, 'latest_date': 'N/A'}
        
        # GBP Insights
        try:
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT property_id) as properties,
                    COUNT(*) as total_records,
                    MAX(metric_date) as latest_date
                FROM gbp_daily_insights
            """)
            row = cursor.fetchone()
            health['gbp_insights'] = {
                'properties': row[0] or 0,
                'total_records': row[1] or 0,
                'latest_date': row[2] or 'N/A'
            }
        except sqlite3.OperationalError:
            health['gbp_insights'] = {'properties': 0, 'total_records': 0, 'latest_date': 'N/A'}
        
        # ThirtyLines availability
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT property_id) as properties,
                COUNT(*) as total_records,
                MAX(snapshot_date) as latest_date
            FROM unit_availability
        """)
        row = cursor.fetchone()
        health['thirtylines'] = {
            'properties': row[0] or 0,
            'total_records': row[1] or 0,
            'latest_date': row[2] or 'N/A'
        }

        # Guest Card metrics
        try:
            cursor.execute("""
                SELECT
                    COUNT(DISTINCT property_code) as properties,
                    COUNT(*) as total_records,
                    MAX(run_date) as latest_date
                FROM guest_card_metrics
            """)
            row = cursor.fetchone()
            health['guest_card'] = {
                'properties': row[0] or 0,
                'total_records': row[1] or 0,
                'latest_date': row[2] or 'N/A'
            }
        except sqlite3.OperationalError:
            health['guest_card'] = {'properties': 0, 'total_records': 0, 'latest_date': 'N/A'}
        
        # SEMRush domain metrics
        try:
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT property_id) as properties,
                    COUNT(*) as total_records,
                    MAX(metric_date) as latest_date
                FROM semrush_domain_metrics
            """)
            row = cursor.fetchone()
            health['semrush'] = {
                'properties': row[0] or 0,
                'total_records': row[1] or 0,
                'latest_date': row[2] or 'N/A'
            }
        except sqlite3.OperationalError:
            health['semrush'] = {'properties': 0, 'total_records': 0, 'latest_date': 'N/A'}
        
        conn.close()
        return health
    
    def check_data_freshness(self):
        """
        Check data freshness for all sources.
        
        Returns:
            dict: Freshness status by source
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        yesterday = (datetime.now() - timedelta(days=1)).date()
        gsc_expected = (datetime.now() - timedelta(days=3)).date()  # GSC has 3-day lag
        gbp_expected = (datetime.now() - timedelta(days=2)).date()  # GBP Insights has 2-day lag
        
        freshness = {}
        
        # GA4 freshness (expect yesterday's data)
        cursor.execute("SELECT MAX(metric_date) FROM ga4_daily_metrics")
        latest = cursor.fetchone()[0]
        if latest:
            latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
            freshness['ga4'] = {
                'latest_date': latest,
                'is_fresh': latest_date >= yesterday,
                'days_old': (datetime.now().date() - latest_date).days
            }
        else:
            freshness['ga4'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # GSC freshness (expect 3 days ago)
        cursor.execute("SELECT MAX(metric_date) FROM gsc_daily_metrics")
        latest = cursor.fetchone()[0]
        if latest:
            latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
            freshness['gsc'] = {
                'latest_date': latest,
                'is_fresh': latest_date >= gsc_expected,
                'days_old': (datetime.now().date() - latest_date).days
            }
        else:
            freshness['gsc'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # ThirtyLines freshness (expect today's data)
        cursor.execute("SELECT MAX(snapshot_date) FROM unit_availability")
        latest = cursor.fetchone()[0]
        if latest:
            latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
            freshness['thirtylines'] = {
                'latest_date': latest,
                'is_fresh': latest_date >= datetime.now().date(),
                'days_old': (datetime.now().date() - latest_date).days
            }
        else:
            freshness['thirtylines'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}

        # Guest Card freshness (expect today's data file)
        try:
            cursor.execute("SELECT MAX(run_date) FROM guest_card_metrics")
            latest = cursor.fetchone()[0]
            if latest:
                latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
                freshness['guest_card'] = {
                    'latest_date': latest,
                    'is_fresh': latest_date >= datetime.now().date(),
                    'days_old': (datetime.now().date() - latest_date).days
                }
            else:
                freshness['guest_card'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        except sqlite3.OperationalError:
            freshness['guest_card'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # Google Ads freshness
        cursor.execute("SELECT MAX(metric_date) FROM google_ads_campaigns")
        latest = cursor.fetchone()[0]
        if latest:
            latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
            freshness['google_ads'] = {
                'latest_date': latest,
                'is_fresh': latest_date >= yesterday,
                'days_old': (datetime.now().date() - latest_date).days
            }
        else:
            freshness['google_ads'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # GBP Insights freshness (expect 2 days ago due to API lag)
        try:
            cursor.execute("SELECT MAX(metric_date) FROM gbp_daily_insights")
            latest = cursor.fetchone()[0]
            if latest:
                latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
                freshness['gbp_insights'] = {
                    'latest_date': latest,
                    'is_fresh': latest_date >= gbp_expected,
                    'days_old': (datetime.now().date() - latest_date).days
                }
            else:
                freshness['gbp_insights'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        except sqlite3.OperationalError:
            freshness['gbp_insights'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # PSI freshness
        try:
            cursor.execute("SELECT MAX(metric_date) FROM pagespeed_metrics")
            latest = cursor.fetchone()[0]
            if latest:
                latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
                freshness['psi'] = {
                    'latest_date': latest,
                    'is_fresh': latest_date >= yesterday,
                    'days_old': (datetime.now().date() - latest_date).days
                }
            else:
                freshness['psi'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        except sqlite3.OperationalError:
            freshness['psi'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # SEMRush freshness (weekly, so allow up to 7 days)
        try:
            cursor.execute("SELECT MAX(metric_date) FROM semrush_domain_metrics")
            latest = cursor.fetchone()[0]
            if latest:
                latest_date = datetime.strptime(latest, '%Y-%m-%d').date()
                # SEMRush is fine if within 7 days
                semrush_expected = (datetime.now() - timedelta(days=7)).date()
                freshness['semrush'] = {
                    'latest_date': latest,
                    'is_fresh': latest_date >= semrush_expected,
                    'days_old': (datetime.now().date() - latest_date).days
                }
            else:
                freshness['semrush'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        except sqlite3.OperationalError:
            freshness['semrush'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        # GBP Reviews freshness
        try:
            cursor.execute("SELECT MAX(review_create_time) FROM gbp_reviews")
            latest = cursor.fetchone()[0]
            if latest:
                latest_date = datetime.fromisoformat(latest.replace('Z', '+00:00')).date()
                freshness['gbp_reviews'] = {
                    'latest_date': latest_date.isoformat(),
                    'is_fresh': latest_date >= (datetime.now() - timedelta(days=7)).date(),
                    'days_old': (datetime.now().date() - latest_date).days
                }
            else:
                freshness['gbp_reviews'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        except (sqlite3.OperationalError, ValueError):
            freshness['gbp_reviews'] = {'latest_date': 'N/A', 'is_fresh': False, 'days_old': 999}
        
        conn.close()
        return freshness
    
    def build_report_html(self, collection_results, db_health, freshness):
        """Build HTML report."""
        
        # Determine overall status
        has_failures = any(r.get('status') == 'failed' for r in collection_results.values())
        has_stale_data = any(not f.get('is_fresh', False) for f in freshness.values())
        
        if has_failures:
            overall_status = "⚠️ COLLECTION FAILURES"
            header_color = "#dc3545"
        elif has_stale_data:
            overall_status = "⚠️ STALE DATA DETECTED"
            header_color = "#ff9800"
        else:
            overall_status = "✅ ALL SYSTEMS HEALTHY"
            header_color = "#15284B"
        
        report_time = datetime.now().strftime('%B %d, %Y at %I:%M %p')
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
               line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; 
               background: #f5f5f5; }}
        .header {{ background: {header_color}; color: white; padding: 30px;
                   border-radius: 12px; margin-bottom: 30px; text-align: center; 
                   box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .header h1 {{ margin: 0; font-size: 28px; font-weight: 700; }}
        .header .subtitle {{ opacity: 0.95; margin-top: 8px; font-size: 14px; }}
        .section {{ background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05); }}
        .section h2 {{ margin-top: 0; font-size: 20px; color: #2c3e50; border-bottom: 2px solid #e0e0e0; 
                       padding-bottom: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th {{ background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; 
              border-bottom: 2px solid #dee2e6; font-size: 13px; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #e9ecef; font-size: 13px; }}
        tr:hover {{ background: #f8f9fa; }}
        .status-success {{ color: #28a745; font-weight: 600; }}
        .status-failed {{ color: #dc3545; font-weight: 600; }}
        .status-fresh {{ color: #28a745; }}
        .status-stale {{ color: #ffc107; }}
        .status-missing {{ color: #dc3545; }}
        .badge {{ padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; 
                  display: inline-block; }}
        .badge-success {{ background: #d4edda; color: #155724; }}
        .badge-warning {{ background: #fff3cd; color: #856404; }}
        .badge-danger {{ background: #f8d7da; color: #721c24; }}
        .metric {{ display: inline-block; margin-right: 20px; }}
        .metric-value {{ font-size: 24px; font-weight: 700; color: #2c3e50; }}
        .metric-label {{ font-size: 12px; color: #6c757d; text-transform: uppercase; }}
        .footer {{ text-align: center; padding: 20px; color: #6c757d; font-size: 12px; }}
        code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{overall_status}</h1>
        <div class="subtitle">Daily Collection Report · {report_time}</div>
    </div>
"""
        
        # SECTION 1: Data Freshness Status (MOVED TO TOP)
        html += """
    <div class="section">
        <h2>🕐 Data Freshness Status</h2>
        <table>
            <thead>
                <tr>
                    <th>Data Source</th>
                    <th>Latest Date</th>
                    <th>Data Age</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
"""
        
        source_labels = {
            'ga4': 'Google Analytics 4',
            'gsc': 'Google Search Console',
            'google_ads': 'Google Ads',
            'psi': 'PageSpeed Insights',
            'gbp_reviews': 'GBP Reviews',
            'gbp_insights': 'GBP Insights',
            'thirtylines': 'ThirtyLines',
            'guest_card': 'Guest Card Metrics',
            'semrush': 'SEMRush'
        }
        
        for source in ['ga4', 'gsc', 'google_ads', 'psi', 'gbp_insights', 'gbp_reviews', 'thirtylines', 'guest_card', 'semrush']:
            if source not in freshness:
                continue
            
            f = freshness[source]
            latest = f['latest_date']
            days_old = f['days_old']
            is_fresh = f['is_fresh']
            
            if is_fresh:
                status_badge = '<span class="badge badge-success">✅ FRESH</span>'
            elif days_old < 3:
                status_badge = '<span class="badge badge-warning">⚠️ MINOR LAG</span>'
            else:
                status_badge = '<span class="badge badge-danger">❌ STALE</span>'
            
            source_label = source_labels.get(source, source.upper())
            
            # Add expected lag notes
            lag_note = ""
            if source == 'gsc':
                lag_note = ' <span style="color: #6c757d; font-size: 11px;">(3-5 day API lag normal)</span>'
            elif source == 'gbp_insights':
                lag_note = ' <span style="color: #6c757d; font-size: 11px;">(2-3 day API lag normal)</span>'
            elif source == 'semrush':
                lag_note = ' <span style="color: #6c757d; font-size: 11px;">(weekly collection)</span>'
            elif source == 'gbp_reviews':
                lag_note = ' <span style="color: #6c757d; font-size: 11px;">(rolling data)</span>'
            
            html += f"""
                <tr>
                    <td><strong>{source_label}</strong>{lag_note}</td>
                    <td>{latest}</td>
                    <td>{days_old} day{'s' if days_old != 1 else ''}</td>
                    <td>{status_badge}</td>
                </tr>
"""
        
        html += """
            </tbody>
        </table>
    </div>
"""

        # SECTION 1B: GA4 Completeness
        ga4_health = db_health.get('ga4', {})
        html += f"""
    <div class="section">
        <h2>✅ GA4 Completeness (Latest Date)</h2>
        <div class="metric">
            <div class="metric-label">Latest Date</div>
            <div class="metric-value">{ga4_health.get('latest_date', 'N/A')}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Rows w/ Users</div>
            <div class="metric-value">{ga4_health.get('rows_with_users', 0)}</div>
        </div>
        <div class="metric">
            <div class="metric-label">New Users Zero %</div>
            <div class="metric-value">{ga4_health.get('new_users_zero_pct', 0.0)}%</div>
        </div>
        <div class="metric">
            <div class="metric-label">Pageviews Zero %</div>
            <div class="metric-value">{ga4_health.get('pageviews_zero_pct', 0.0)}%</div>
        </div>
    </div>
"""
        
        # SECTION 2: Collection Results
        html += """
    <div class="section">
        <h2>📊 Collection Results (Last 24 Hours)</h2>
"""
        
        if collection_results:
            html += """
        <table>
            <thead>
                <tr>
                    <th>Data Source</th>
                    <th>Status</th>
                    <th>Properties</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Duration</th>
                    <th>Completed At</th>
                </tr>
            </thead>
            <tbody>
"""
            
            source_order = ['ga4', 'gsc', 'google_ads', 'psi', 'gbp_reviews', 'gbp_insights',
                          'thirtylines', 'guest_card', 'semrush', 'gtmetrix']
            
            for source in source_order:
                result = collection_results.get(source)
                if result:
                    status = result['status']
                    status_class = 'status-success' if status == 'completed' else 'status-failed'
                    status_icon = '✅' if status == 'completed' else '❌'
                    
                    total = result['properties_total'] if result['properties_total'] is not None else 'N/A'
                    success = result['properties_successful']
                    failed = result['properties_failed']
                    
                    duration = result['duration_seconds']
                    if duration:
                        duration_str = f"{int(duration)}s"
                    else:
                        duration_str = 'N/A'
                    
                    completed = result['completed_at']
                    if completed:
                        completed_str = datetime.fromisoformat(completed).strftime('%I:%M %p')
                    else:
                        completed_str = 'In Progress'

                    # If completed but no successes/failures, show warning
                    if status == 'completed' and (success or 0) == 0 and (failed or 0) == 0 and (result.get('properties_collected') or 0) == 0 and total not in (0, 'N/A'):
                        status = 'completed (no data)'
                        status_class = 'status-stale'
                        status_icon = '⚠️'
                else:
                    # Fallback: infer status from data freshness when no collection tracking exists
                    fresh = freshness.get(source)
                    if fresh:
                        is_fresh = fresh.get('is_fresh', False)
                        latest_date = fresh.get('latest_date', 'N/A')
                        if is_fresh:
                            status = 'data fresh (no tracking)'
                            status_class = 'status-success'
                            status_icon = '✅'
                        else:
                            status = 'stale (no tracking)'
                            status_class = 'status-stale'
                            status_icon = '⚠️'
                        completed_str = latest_date
                    else:
                        status = 'no recent run'
                        status_class = 'status-stale'
                        status_icon = '—'
                        completed_str = 'N/A'
                    total = 'N/A'
                    success = 'N/A'
                    failed = 'N/A'
                    duration_str = 'N/A'
                
                html += f"""
                <tr>
                    <td><strong>{source.upper()}</strong></td>
                    <td class="{status_class}">{status_icon} {status}</td>
                    <td>{total}</td>
                    <td>{success}</td>
                    <td>{failed}</td>
                    <td>{duration_str}</td>
                    <td>{completed_str}</td>
                </tr>
"""
            
            html += """
            </tbody>
        </table>
"""
        else:
            html += """
        <p style="color: #6c757d; font-style: italic;">No collection runs found in the last 24 hours.</p>
"""
        
        html += """
    </div>
"""

        # SECTION 2B: Collector Details (Latest Run)
        html += """
    <div class="section">
        <h2>🧾 Collector Details (Latest Run)</h2>
"""

        if collection_results:
            html += """
        <table>
            <thead>
                <tr>
                    <th>Data Source</th>
                    <th>API Calls</th>
                    <th>Failed Calls</th>
                    <th>Rate Limits</th>
                    <th>Retries</th>
                    <th>Avg Response</th>
                    <th>Error / Notes</th>
                </tr>
            </thead>
            <tbody>
"""
            source_order = ['ga4', 'gsc', 'google_ads', 'psi', 'gbp_reviews', 'gbp_insights',
                            'thirtylines', 'guest_card', 'semrush', 'gtmetrix', 'semrush_competitor']

            def _fmt(val, suffix=""):
                if val is None:
                    return 'N/A'
                try:
                    return f"{int(val)}{suffix}"
                except (ValueError, TypeError):
                    return f"{val}{suffix}"

            for source in source_order:
                result = collection_results.get(source)
                if result:
                    api_total = result.get('api_calls_total')
                    api_failed = result.get('api_calls_failed')
                    rate_limits = result.get('rate_limit_hits')
                    retries = result.get('retry_attempts')
                    avg_ms = result.get('avg_response_time_ms')
                    avg_ms_str = 'N/A' if avg_ms is None else f"{float(avg_ms):.0f} ms"

                    error = result.get('error_message')
                    notes = result.get('notes')
                    detail = error or notes or ''
                else:
                    api_total = api_failed = rate_limits = retries = None
                    avg_ms_str = 'N/A'
                    fresh = freshness.get(source)
                    if fresh:
                        is_fresh = fresh.get('is_fresh', False)
                        latest_date = fresh.get('latest_date', 'N/A')
                        if is_fresh:
                            detail = f'No tracking; data fresh ({latest_date})'
                        else:
                            detail = f'No tracking; stale ({latest_date})'
                    else:
                        detail = 'No recent run'
                
                html += f"""
                <tr>
                    <td><strong>{source.upper()}</strong></td>
                    <td>{_fmt(api_total)}</td>
                    <td>{_fmt(api_failed)}</td>
                    <td>{_fmt(rate_limits)}</td>
                    <td>{_fmt(retries)}</td>
                    <td>{avg_ms_str}</td>
                    <td>{detail}</td>
                </tr>
"""

            html += """
            </tbody>
        </table>
"""
        else:
            html += """
        <p style="color: #6c757d; font-style: italic;">No collector details available.</p>
"""

        html += """
    </div>
"""
        
        # SECTION 3: Database Health Snapshot
        html += f"""
    <div class="section">
        <h2>💾 Database Health Snapshot</h2>
        <p style="color: #6c757d; margin-bottom: 20px;">Current state of <code>{self.db_path}</code></p>
        
        <table>
            <thead>
                <tr>
                    <th>Data Source</th>
                    <th>Properties/Sites</th>
                    <th>Total Records</th>
                    <th>Latest Date</th>
                    <th>Data Range</th>
                </tr>
            </thead>
            <tbody>
"""
        
        source_labels = {
            'ga4': 'Google Analytics 4',
            'gsc': 'Google Search Console',
            'google_ads': 'Google Ads',
            'psi': 'PageSpeed Insights',
            'gbp_reviews': 'GBP Reviews',
            'gbp_insights': 'GBP Insights',
            'thirtylines': 'ThirtyLines',
            'guest_card': 'Guest Card Metrics',
            'semrush': 'SEMRush'
        }
        
        for source, label in source_labels.items():
            if source not in db_health:
                continue
            
            health = db_health[source]
            props = health.get('properties', health.get('sites', 0))
            records = health['total_records']
            latest = health['latest_date']
            earliest = health.get('earliest_date', 'N/A')
            
            if earliest != 'N/A' and latest != 'N/A':
                data_range = f"{earliest} to {latest}"
            else:
                data_range = 'N/A'
            
            html += f"""
                <tr>
                    <td><strong>{label}</strong></td>
                    <td>{props:,}</td>
                    <td>{records:,}</td>
                    <td>{latest}</td>
                    <td>{data_range}</td>
                </tr>
"""
        
        html += """
            </tbody>
        </table>
    </div>
"""
        
        
        # Footer
        html += f"""
    <div class="footer">
        <p><strong>Automated Daily Collection Report</strong></p>
        <p>Database: <code>{self.db_path}</code></p>
        <p>Generated by Data_Collection system · Portfolio: {self.total_properties} properties</p>
    </div>
</body>
</html>"""
        
        return html
    
    def send_report(self, collection_results, db_health, freshness):
        """Send daily report email."""
        
        # Build email
        html_body = self.build_report_html(collection_results, db_health, freshness)
        
        # Determine subject based on status
        has_failures = any(r.get('status') == 'failed' for r in collection_results.values())
        has_stale_data = any(not f.get('is_fresh', False) for f in freshness.values())
        
        if has_failures:
            subject = "⚠️ Daily Collection Report: FAILURES DETECTED"
        elif has_stale_data:
            subject = "⚠️ Daily Collection Report: Stale Data"
        else:
            subject = "✅ Daily Collection Report: All Systems Healthy"
        
        # Plain text fallback
        plain_text = f"""Daily Collection Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Please view this email in an HTML-capable client for full details.

Database: {self.db_path}
Portfolio: {self.total_properties} properties
"""
        
        if self.test_mode:
            print("\n" + "="*80)
            print("📧 EMAIL PREVIEW (Test Mode)")
            print("="*80)
            print(f"To: {self.recipient}")
            print(f"Subject: {subject}")
            print("\n[HTML body would be sent - preview saved to /tmp/collection_report_preview.html]")
            
            # Save preview
            with open('/tmp/collection_report_preview.html', 'w') as f:
                f.write(html_body)
            print("Preview saved to: /tmp/collection_report_preview.html")
            return True
        
        # Send email via unified sender
        try:
            self.email_sender.send_email(
                subject=subject,
                html_body=html_body,
                plain_text=plain_text,
                recipients=[self.recipient],
                reply_to='mlaufhutte@venterraliving.com'
            )
            
            print(f"✅ Daily report sent to {self.recipient}")
            print(f"   Subject: {subject}")
            return True
            
        except Exception as e:
            print(f"❌ Email send failed: {e}")
            return False
    
    def run(self):
        """Main execution: generate and send daily report."""
        print("="*80)
        print("📊 DAILY COLLECTION REPORT GENERATOR")
        print("="*80)
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Get collection results
        print("📋 Fetching collection results...")
        collection_results = self.get_latest_collection_results()
        print(f"   Found {len(collection_results)} collection runs")
        
        # Get database health
        print("💾 Analyzing database health...")
        db_health = self.get_database_health_snapshot()
        print(f"   Analyzed {len(db_health)} data sources")
        
        # Check data freshness
        print("🕐 Checking data freshness...")
        freshness = self.check_data_freshness()
        print(f"   Checked {len(freshness)} sources")
        
        # Send report
        print()
        print("📧 Sending daily report...")
        success = self.send_report(collection_results, db_health, freshness)
        
        if success:
            print()
            print("="*80)
            print("✅ DAILY REPORT SENT SUCCESSFULLY")
            print("="*80)
            return 0
        else:
            print()
            print("="*80)
            print("❌ FAILED TO SEND DAILY REPORT")
            print("="*80)
            return 1


if __name__ == '__main__':
    test_mode = '--test' in sys.argv
    reporter = DailyCollectionReporter(test_mode=test_mode)
    sys.exit(reporter.run())
